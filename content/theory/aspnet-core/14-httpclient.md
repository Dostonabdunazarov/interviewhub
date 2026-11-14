---
title: HttpClient
slug: aspnet-httpclient
track: dotnet-backend
section: aspnet-core
level: senior
sortOrder: 14
summary: Почему HttpClient на каждый запрос исчерпывает порты, а статический не видит смену DNS, где на самом деле живёт пул соединений и как IHttpClientFactory, SocketsHttpHandler и resilience-пайплайн складываются в правильную конфигурацию.
questions: advanced-aspnet-kak-ihttpclientfactory-reshaet-problemu-ustarevaniya-dns, advanced-aspnet-pochemu-voznikaet-ischerpanie-portov-pri-ispolzovanii-httpclient-i-kak, advanced-aspnet-kak-nastroit-pul-soedinenii-httpclient-i-pochemu-staticheskii-httpclie
---

`HttpClient` — один из немногих классов .NET, где оба очевидных способа использования неправильны. Создавать его на каждый запрос нельзя — под нагрузкой кончатся порты. Держать один на всё приложение тоже плохо — он перестаёт замечать смену DNS и прилипает к старым бэкендам. Правильный ответ лежит между ними, и чтобы его понять, нужно знать, где на самом деле живут соединения.

Ключевой факт: пул TCP-соединений принадлежит не `HttpClient`, а его обработчику — `SocketsHttpHandler`. `HttpClient` лишь тонкая обёртка с базовым адресом, заголовками по умолчанию и таймаутом. Все проблемы и все решения дальше — это вопрос о том, сколько живут обработчик и его соединения.

## Исчерпание портов

Классическая ошибка выглядит безобидно:

```csharp
public async Task<string> GetAsync(string url)
{
    using var client = new HttpClient();
    return await client.GetStringAsync(url);
}
```

Каждый вызов создаёт новый обработчик с пустым пулом, открывает новое TCP-соединение и при `Dispose` закрывает его. Закрывает первым наш сервис, а значит, на нашей стороне сокет переходит в `TIME_WAIT` и держит локальный эфемерный порт ещё какое-то время: на Linux 60 секунд, на Windows — до двух минут.

Диапазон эфемерных портов конечен: на Windows по умолчанию 49152–65535, около 16 тысяч, на Linux обычно 32768–60999. Лимит считается на пару «локальный адрес — удалённый endpoint», поэтому всё упирается в самый нагруженный upstream. При 300 RPS к одному сервису и новом соединении на запрос за минуту накапливается 18 000 сокетов в `TIME_WAIT` — диапазон Windows исчерпан. Симптомы: `SocketException (10048)` на Windows, `Cannot assign requested address` на Linux, ошибки волнами на пике, которые сами проходят через минуту-две после спада.

`new HttpClient()` — не единственная причина. Порты утекают и тогда, когда пул есть, но не работает:

- не прочитано и не освобождено тело ответа — соединение нельзя вернуть в пул, и для следующего запроса открывается новое; особенно с `HttpCompletionOption.ResponseHeadersRead` без `Dispose` у `HttpResponseMessage`;
- upstream или прокси отвечает `Connection: close` и рвёт соединение после каждого ответа;
- слишком короткие `PooledConnectionLifetime` или `PooledConnectionIdleTimeout`;
- в облаке за NAT-шлюзом лимит SNAT-портов на инстанс намного меньше системного, и исчерпание наступает раньше, чем его видно в ОС.

Диагностика начинается с подсчёта сокетов по удалённым адресам — сразу видно, к какому upstream'у утечка:

```bash
ss -tan state time-wait | awk '{print $4}' | sort | uniq -c | sort -rn | head
dotnet-counters monitor -p <pid> --counters System.Net.Http
```

Если число открытых соединений и частота их создания растут вместе с RPS, пул не переиспользуется. С .NET 8 те же данные есть в метриках `System.Net.Http`: `http.client.open_connections`, `http.client.connection.duration`, `http.client.request.time_in_queue` — подключаются к дашбордам так, как описано в статье `OpenTelemetry в .NET`. Крутить ядро (`tcp_tw_reuse`, расширение диапазона) — только отсрочка: лечится переиспользованием соединений.

## Статический клиент и DNS

Очевидный фикс — один `static HttpClient` на приложение. Порты он спасает, но DNS резолвится только при открытии TCP-соединения, а по умолчанию `PooledConnectionLifetime` бесконечен. Соединение к старому IP живёт, пока им пользуются, и TTL DNS-записи на это не влияет. Blue-green переключение, failover, переезд сервиса — клиент продолжает слать трафик на старый адрес, пока тот не перестанет отвечать.

Та же причина ломает балансировку: долгоживущие соединения к сервису за L4-балансировщиком прилипают к бэкендам, которые были при открытии, и новые реплики после масштабирования не получают нагрузку.

Кроме того, разным upstream'ам нужны разные таймауты, заголовки и политики повторов, а изменение `DefaultRequestHeaders` у разделяемого клиента из параллельных запросов — гонка.

## Настройка SocketsHttpHandler

Проблему DNS точнее всего решает сам обработчик: `PooledConnectionLifetime` ограничивает возраст соединения. Когда он истёк, соединение закрывается после текущего запроса, а следующее откроется с новым резолвом. Пул и обработчик при этом остаются.

```csharp
var handler = new SocketsHttpHandler
{
    PooledConnectionLifetime = TimeSpan.FromMinutes(5),
    PooledConnectionIdleTimeout = TimeSpan.FromSeconds(30),
    MaxConnectionsPerServer = 200,
    ConnectTimeout = TimeSpan.FromSeconds(3)
};
var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(10) };
```

| Свойство | По умолчанию | Зачем трогать |
| --- | --- | --- |
| `PooledConnectionLifetime` | бесконечно | ротация соединений для DNS и балансировки |
| `PooledConnectionIdleTimeout` | 1 минута | закрывать простаивающие соединения раньше, чем это сделает сервер или прокси |
| `MaxConnectionsPerServer` | без ограничения | верхняя граница соединений к одному хосту, сверх неё — очередь |
| `ConnectTimeout` | бесконечно | быстро отказать, если хост недоступен |

Значение `PooledConnectionLifetime` подбирают по тому, как быстро должна подхватываться смена адреса: минуты, а не секунды, — иначе пользу пула съедят новые TCP- и TLS-рукопожатия.

`MaxConnectionsPerServer` без ограничения опасен при деградации upstream'а: ответы замедляются, запросы не ждут свободного соединения, а открывают новые — клиент добивает и upstream, и собственные порты. Ограничение превращает это в очередь, рост которой видно по `http.client.request.time_in_queue`. Для HTTP/2 важнее `EnableMultipleHttp2Connections`: запросы мультиплексируются по одному соединению и упираются в лимит стримов, об этом в статье `Kestrel, HTTP/2, HTTP/3 и стриминг`.

## IHttpClientFactory

В приложении на Generic Host клиентов получают через фабрику. Она хранит обработчики в кэше по имени клиента, а каждый `CreateClient` создаёт новый лёгкий `HttpClient` поверх закэшированной цепочки, не владеющий ею. Поэтому клиенты из фабрики можно создавать на каждую операцию и освобождать — соединения при этом не теряются.

```csharp
builder.Services.AddHttpClient("github", c =>
{
    c.BaseAddress = new Uri("https://api.github.com/");
    c.DefaultRequestHeaders.UserAgent.ParseAdd("interviewhub");
});

builder.Services.AddHttpClient<CatalogClient>(c =>
{
    c.BaseAddress = new Uri("https://catalog.internal");
    c.Timeout = TimeSpan.FromSeconds(10);
});

public sealed class CatalogClient(HttpClient http)
{
    public Task<Product?> GetAsync(int id, CancellationToken ct) =>
        http.GetFromJsonAsync<Product>($"products/{id}", ct);
}
```

Named client получают через `IHttpClientFactory.CreateClient("github")`. Typed client — класс, принимающий `HttpClient` в конструкторе; фабрика регистрирует его как transient и передаёт уже настроенный клиент. Typed client удобнее: конфигурация и API к upstream'у в одном месте, потребитель зависит от осмысленного типа, а не от строки.

### Ротация обработчиков

Свою защиту от устаревшего DNS фабрика реализует ротацией: по истечении `HandlerLifetime` (по умолчанию 2 минуты) запись в кэше помечается устаревшей, и следующий `CreateClient` получает новую цепочку с новым пулом. Старый обработчик не закрывается сразу — им ещё могут пользоваться ранее созданные клиенты. Фабрика отслеживает его через слабую ссылку и освобождает вместе с соединениями, когда ссылок не осталось.

Фабрика не смотрит на TTL DNS — она просто ограничивает возраст пула. Механизм появился во времена .NET Framework, где у `HttpClientHandler` не было `PooledConnectionLifetime`. В современном .NET первичный обработчик — `SocketsHttpHandler`, и рекомендуемая схема такая: ротацию соединений отдать `PooledConnectionLifetime`, а ротацию обработчиков фабрикой отключить, чтобы не пересобирать пул без нужды:

```csharp
builder.Services.AddHttpClient<PaymentsClient>(c =>
        c.BaseAddress = new Uri("https://payments.internal"))
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
    {
        PooledConnectionLifetime = TimeSpan.FromMinutes(5),
        MaxConnectionsPerServer = 200
    })
    .SetHandlerLifetime(Timeout.InfiniteTimeSpan);
```

Фабрика при этом остаётся ради DI, раздельной конфигурации, конвейера `DelegatingHandler` и resilience-политик.

### Ловушка: typed client в singleton

Typed client — transient. Если внедрить его в singleton, тот навсегда получит один `HttpClient` с одним обработчиком. Ротация перестаёт работать, и проблема DNS возвращается — тихо, без ошибок, до первого переезда upstream'а:

```csharp
builder.Services.AddSingleton<PriceService>();

public sealed class PriceService(CatalogClient catalog);
```

Это разновидность captive dependency из статьи `DI и жизненные циклы`. Выходы: не делать потребителя singleton'ом; внедрять `IHttpClientFactory` и вызывать `CreateClient` на каждую операцию; либо настроить `PooledConnectionLifetime` у первичного обработчика — тогда соединения ротируются внутри одного обработчика, и захват уже не опасен.

## DelegatingHandler

Между `HttpClient` и `SocketsHttpHandler` фабрика строит цепочку обработчиков — исходящий аналог middleware из статьи `Pipeline и middleware`. Каждый `DelegatingHandler` получает запрос, может изменить его, вызвать `base.SendAsync` и обработать ответ:

```csharp
public sealed class ApiKeyHandler(IOptions<CatalogOptions> options) : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        request.Headers.Add("X-Api-Key", options.Value.ApiKey);
        return base.SendAsync(request, ct);
    }
}

builder.Services.AddTransient<ApiKeyHandler>();
builder.Services.AddHttpClient<CatalogClient>()
    .AddHttpMessageHandler<ApiKeyHandler>();
```

Обработчик регистрируется как transient; выполняются они в порядке добавления.

Неочевидная деталь: цепочка живёт столько же, сколько обработчик в кэше, и создаётся в собственном DI-scope фабрики, а не в scope HTTP-запроса. Scoped-сервис, внедрённый в `DelegatingHandler`, — это не тот экземпляр, что в контроллере, и данные текущего пользователя через него не получить. Для пробрасывания токена входящего запроса используют `IHttpContextAccessor` или передают значение через `HttpRequestMessage.Options`.

## Таймауты и resilience

`HttpClient.Timeout` — общий таймаут на весь вызов, по умолчанию 100 секунд, что для межсервисного вызова почти всегда слишком много. По его истечении бросается `TaskCanceledException`, поэтому таймаут отличают от отмены по токену вызывающего кода. Таймаут клиента всегда комбинируется с `CancellationToken` запроса: если пользователь ушёл, исходящий вызов тоже должен прерваться — это тема статьи `CancellationToken и таймауты`.

Повторы, таймаут на попытку и circuit breaker руками в `DelegatingHandler` не пишут. Пакет `Microsoft.Extensions.Http.Resilience` строит их поверх Polly v8 одной строкой:

```csharp
builder.Services.AddHttpClient<CatalogClient>()
    .AddStandardResilienceHandler();
```

Стандартный пайплайн включает ограничитель параллелизма, общий таймаут, повторы с экспоненциальной задержкой и jitter, circuit breaker и таймаут на одну попытку. Таймауты задают в нём, а `HttpClient.Timeout` не должен быть меньше общего таймаута пайплайна, иначе он сработает раньше и повторы не успеют. Почему повторы без jitter и бюджета превращаются в retry storm и как работает размыкание цепи — в статьях `Retry, jitter и retry storm` и `Circuit breaker`.

## Что стоит ответить на собеседовании

Пул соединений живёт в `SocketsHttpHandler`, а не в `HttpClient`. `new HttpClient()` на запрос выбрасывает пул, каждое закрытое соединение оставляет порт в `TIME_WAIT`, и под нагрузкой эфемерные порты кончаются. Статический клиент спасает порты, но его соединения живут бесконечно и не видят смену DNS. Решения два: долгоживущий клиент с `PooledConnectionLifetime` или `IHttpClientFactory`, который кэширует обработчики и ротирует их раз в `HandlerLifetime`, по умолчанию 2 минуты.

Сильный ответ добавит, что в современном .NET рекомендуемая связка — фабрика с `PooledConnectionLifetime` у первичного обработчика и отключённой ротацией, а сама фабрика нужна ради typed clients, `DelegatingHandler` и `AddStandardResilienceHandler`. Назовёт ловушку typed client в singleton, которая тихо отключает ротацию, то, что `DelegatingHandler` живёт в своём scope, а не в scope запроса, опасность неограниченного `MaxConnectionsPerServer` и недочитанного ответа, и умение диагностировать проблему по `ss`, `dotnet-counters` и метрикам `http.client.*`.
