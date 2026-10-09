---
title: OpenTelemetry в .NET
slug: opentelemetry-v-dotnet
track: infrastructure
section: observability
level: senior
sortOrder: 2
summary: Как OpenTelemetry ложится на встроенные Activity, Meter и ILogger, как выглядит минимальная настройка с UseOtlpExporter, что инструментировать первым, как писать свои span'ы и метрики, передавать контекст через очередь и зачем между приложением и бэкендом стоит Collector.
---

OpenTelemetry — открытый стандарт телеметрии: API для кода, SDK, который собирает и экспортирует данные, протокол OTLP и семантические соглашения об именах атрибутов и метрик. Он отвязывает инструментирование от бэкенда: данные уходят в Prometheus, Tempo, Loki или коммерческий APM без изменения приложения. В .NET у OpenTelemetry особое положение — API для трассировок и метрик встроен в саму платформу, и SDK лишь подписывается на то, что уже публикуют рантайм, ASP.NET Core и `HttpClient`.

## Что откуда берётся

| Сигнал | API в .NET | Термин OpenTelemetry |
| --- | --- | --- |
| Трассировки | `ActivitySource`, `Activity` из `System.Diagnostics` | Tracer, Span |
| Метрики | `Meter`, `Counter<T>`, `Histogram<T>` из `System.Diagnostics.Metrics` | Meter, Instrument |
| Логи | `ILogger` из `Microsoft.Extensions.Logging` | Logs Bridge |

Поэтому библиотеки инструментируют себя без зависимости от пакетов OpenTelemetry, а пока на источник никто не подписан, инструментация почти ничего не стоит: `StartActivity` без слушателя возвращает `null`.

## Минимальная настройка

Пакеты: `OpenTelemetry.Extensions.Hosting`, `OpenTelemetry.Exporter.OpenTelemetryProtocol`, `OpenTelemetry.Instrumentation.AspNetCore`, `OpenTelemetry.Instrumentation.Http`, `OpenTelemetry.Instrumentation.Runtime`, для PostgreSQL — `Npgsql.OpenTelemetry`.

```csharp
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService(
        serviceName: "orders-api",
        serviceVersion: typeof(Program).Assembly.GetName().Version?.ToString()))
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation(o =>
            o.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/health"))
        .AddHttpClientInstrumentation()
        .AddNpgsql()
        .AddSource("Orders"))
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation()
        .AddMeter("Orders"))
    .WithLogging()
    .UseOtlpExporter();
```

`UseOtlpExporter` появился в версии 1.8 и регистрирует экспорт OTLP сразу для всех трёх сигналов; смешивать его с `AddOtlpExporter` на отдельных сигналах не нужно. Адрес и атрибуты ресурса задают не в коде, а переменными окружения `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` и `OTEL_RESOURCE_ATTRIBUTES` (например, `deployment.environment.name=prod`) — так одна сборка работает в любом окружении. Фильтр в инструментации ASP.NET Core отсекает пробы Kubernetes, иначе каждая проверка `/health` становится трейсом.

## Что инструментировать первым

Инструментация границ процесса даёт большую часть пользы почти без кода, поэтому порядок такой.

**1. Входящие запросы и рантайм.** С .NET 8 ASP.NET Core сам публикует метрики через Meter `Microsoft.AspNetCore.Hosting` и `Microsoft.AspNetCore.Server.Kestrel`, главная из них — гистограмма `http.server.request.duration` с атрибутами `http.route`, `http.request.method` и `http.response.status_code`. С .NET 9 рантайм публикует Meter `System.Runtime`: `dotnet.gc.pause.time`, `dotnet.gc.collections`, `dotnet.thread_pool.queue.length`, `dotnet.process.cpu.time`, `dotnet.exceptions` и другие. `AddRuntimeInstrumentation` на .NET 9 и новее просто подписывается на этот встроенный Meter, на более старых рантаймах — публикует собственные метрики со старыми именами `process.runtime.dotnet.*`. При обновлении дашборды на старых именах опустеют.

**2. Исходящие вызовы.** `HttpClient`, база, кэш, брокер — именно там обычно сидит причина задержки. Для HTTP контекст `traceparent` пробрасывается в заголовки автоматически; метрики `http.client.request.duration` и `http.client.request.time_in_queue` из Meter `System.Net.Http` показывают в том числе ожидание свободного соединения. Как по span'ам Npgsql отделить проблему базы от проблемы приложения — в статье `База или приложение`.

**3. Логи с корреляцией.** При `WithLogging` каждая запись получает `TraceId` и `SpanId` текущей `Activity`; если логи идут в stdout, их добавляют через `ActivityTrackingOptions` (пример — в статье `Разбор инцидента`).

**4. Бизнес-span'ы и метрики** — там, где автоматической детализации не хватает, и проброс контекста через очереди.

## Свои span'ы и метрики

```csharp
public sealed class CheckoutService(OrderRepository orders, PaymentClient payments)
{
    private static readonly ActivitySource Source = new("Orders");

    public async Task<Order> CheckoutAsync(Cart cart, CancellationToken ct)
    {
        using var activity = Source.StartActivity("checkout");
        activity?.SetTag("orders.items_count", cart.Items.Count);

        try
        {
            var order = await orders.CreateAsync(cart, ct);
            await payments.ChargeAsync(order, ct);
            return order;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.AddException(ex);
            throw;
        }
    }
}
```

Имя источника должно совпадать с `AddSource("Orders")`, иначе span'ы молча пропадут — самая частая причина вопроса «где мои span'ы». `?.` нужен на случай `null` без подписчика. А если span не прошёл сэмплирование, `Activity` всё равно существует ради передачи контекста дальше, но у неё `IsAllDataRequested == false` — дорогие атрибуты стоит вычислять только при `true`. `Activity.AddException` появился в .NET 9.

Свои метрики создают через `IMeterFactory` и подключают через `AddMeter`; `user.id` в атрибуте span'а нормален, в метрике — катастрофа кардинальности (см. `Логи, метрики, трассировки`).

## Контекст через очередь

Для HTTP и gRPC контекст передаётся сам, а для брокера сообщений его нужно положить в заголовки при публикации и достать при обработке. MassTransit и инструментации популярных клиентов делают это сами, для своего консьюмера используют пропагатор:

```csharp
public static class MessagePropagation
{
    private static readonly TextMapPropagator Propagator = Propagators.DefaultTextMapPropagator;

    public static void Inject(Activity activity, IDictionary<string, byte[]> headers) =>
        Propagator.Inject(
            new PropagationContext(activity.Context, Baggage.Current),
            headers,
            (h, key, value) => h[key] = Encoding.UTF8.GetBytes(value));

    public static Activity? StartConsume(ActivitySource source, IDictionary<string, byte[]> headers)
    {
        var parent = Propagator.Extract(default, headers,
            (h, key) => h.TryGetValue(key, out var v) ? [Encoding.UTF8.GetString(v)] : []);

        return source.StartActivity(
            "orders process",
            ActivityKind.Consumer,
            default(ActivityContext),
            links: [new ActivityLink(parent.ActivityContext)]);
    }
}
```

Консьюмер начинает новый трейс со ссылкой (span link) на продюсера: для пакетной обработки это единственный корректный вариант, ведь у пачки из ста сообщений сто разных родителей. Без проброса контекста трейс обрывается на продюсере, и время в очереди не видно ни в одном span'е.

## Зачем Collector

Приложение отправляет OTLP не в бэкенд, а в ближайший OpenTelemetry Collector — DaemonSet на ноде или отдельный Deployment. Collector батчит, повторяет отправку, обогащает данные атрибутами Kubernetes, делает tail sampling и рассылает сигналы по хранилищам:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 25
  k8s_attributes:
    extract:
      metadata: [k8s.namespace.name, k8s.pod.name, k8s.deployment.name, k8s.node.name]
  batch: {}

exporters:
  otlp_grpc/tempo:
    endpoint: tempo.observability:4317
    tls:
      insecure: true
  prometheus_remote_write:
    endpoint: http://prometheus.observability:9090/api/v1/write
  otlp_http/loki:
    endpoint: http://loki.observability:3100/otlp

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, k8s_attributes, batch]
      exporters: [otlp_grpc/tempo]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, k8s_attributes, batch]
      exporters: [prometheus_remote_write]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, k8s_attributes, batch]
      exporters: [otlp_http/loki]
```

`memory_limiter` ставят первым, `batch` — после всех процессоров, которые отбрасывают данные. В свежих версиях Collector имена компонентов переведены в snake_case; старые `otlp`, `otlphttp`, `k8sattributes` и `prometheusremotewrite` работают как устаревшие псевдонимы и встречаются в большинстве примеров. Смена бэкенда — правка конфигурации Collector, а не передеплой сервисов. А экспортёр SDK держит данные в буфере и отправляет пачками, поэтому при `SIGKILL` последняя пачка теряется — ещё одна причина корректной остановки пода (см. `Graceful shutdown в K8s`).

## Что стоит ответить на собеседовании

В .NET OpenTelemetry опирается на встроенные API: трассировки — `ActivitySource` и `Activity`, метрики — `Meter`, логи — `ILogger`; SDK подписывается на них и экспортирует по OTLP. Настройка — `AddOpenTelemetry` с `WithTracing`, `WithMetrics`, `WithLogging` и `UseOtlpExporter`, адрес и имя сервиса — переменными окружения. Первым инструментируют границы процесса: входящие запросы, `HttpClient`, базу, брокер и рантайм, затем — бизнес-операции.

Сильный ответ упомянет встроенные метрики: `http.server.request.duration` с .NET 8 и Meter `System.Runtime` с .NET 9, на который переключается `AddRuntimeInstrumentation`. Назовёт ловушки: несовпадающее имя в `AddSource`, кардинальность атрибутов метрик, пробы в трейсах, потерю последней пачки при `SIGKILL`. Объяснит, что через очередь контекст нужно передавать в заголовках и связывать консьюмера с продюсером через span link. И обоснует Collector: батчинг, обогащение, tail sampling, смена бэкенда без передеплоя.
