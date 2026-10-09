---
title: Graceful shutdown
slug: aspnet-graceful-shutdown
track: dotnet-backend
section: aspnet-core
level: senior
sortOrder: 9
summary: Что делает Generic Host по SIGTERM, что происходит с запросами в работе и пришедшими после сигнала, как фоновым сервисам успеть остановиться и почему в Kubernetes запросы теряются даже при правильном коде.
---

Приложение останавливают постоянно: каждый деплой, каждое масштабирование вниз, каждый переезд пода на другой узел. Если остановка грубая, каждый такой момент — это оборванные запросы, недообработанные сообщения и всплеск 502 на графиках. Graceful shutdown — остановка, при которой приложение перестаёт принимать новую работу, доделывает текущую и освобождает ресурсы. В ASP.NET Core механизм для этого уже есть, но работает он только при соблюдении нескольких условий в коде и в окружении.

## Что делает хост

Остановкой управляет Generic Host. Сигналом служит `SIGTERM`, Ctrl+C или вызов `IHostApplicationLifetime.StopApplication()`. Дальше:

1. Срабатывает `ApplicationStopping`.
2. Kestrel закрывает слушающие сокеты — новые соединения не принимаются. Простаивающие keep-alive соединения закрываются, на активных HTTP/1.1 ответ уходит с `Connection: close`, на HTTP/2 сервер отправляет `GOAWAY`.
3. Хост ждёт завершения запросов в работе.
4. Hosted services останавливаются в порядке, **обратном** регистрации: у `BackgroundService` отменяется `stoppingToken`, хост ждёт завершения `ExecuteAsync`.
5. Срабатывает `ApplicationStopped`, контейнер освобождает сервисы, процесс выходит.

Всё это должно уложиться в `HostOptions.ShutdownTimeout`. Проверено на .NET 10 — значение по умолчанию:

```
default ShutdownTimeout = 00:00:30
```

## Запрос в работе и запрос после сигнала

Проверено на .NET 10: запрос с задержкой 5 секунд, через секунду после его начала — `StopApplication()`, ещё через полсекунды — новый запрос:

```
[42 848 ms] slow start 5000
[43 902 ms] ApplicationStopping
новый запрос: Failed to connect to localhost port 5199
[47 858 ms] slow done
[47 863 ms] ApplicationStopped
медленный запрос: 200 за 5,01 с
```

Начатый запрос спокойно доработал и получил свой `200`, приложение остановилось сразу после него. А новый запрос получил отказ в соединении: listener закрыт в момент сигнала.

Теперь тот же сценарий с `ShutdownTimeout = 2 с` и запросом на 8 секунд:

```
[4 099 ms] slow start 8000
[5 279 ms] ApplicationStopping
[7 293 ms] slow canceled by RequestAborted
[7 299 ms] ApplicationStopped
клиент: Connection was reset через 3,36 с
```

Ровно через две секунды после сигнала хост перестал ждать: соединение оборвано, клиент видит сброс, а код обработчика получает отмену через `HttpContext.RequestAborted`. Если токен проброшен вниз, работа прекращается; если нет — продолжается впустую уже после того, как клиент ушёл. Это та же кооперативная отмена из статьи `CancellationToken и таймауты`.

Таймаут меняется так:

```csharp
builder.Services.Configure<HostOptions>(o => o.ShutdownTimeout = TimeSpan.FromSeconds(25));
```

## Фоновые сервисы

Hosted services получают сигнал через токен. У `IHostedService` это токен в `StopAsync`, который отменится по истечении таймаута. У `BackgroundService` — `stoppingToken` в `ExecuteAsync`, и его нужно передавать во **все** ожидания:

```csharp
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    while (!stoppingToken.IsCancellationRequested)
    {
        var msg = await _queue.ReceiveAsync(stoppingToken);
        try
        {
            await HandleAsync(msg, stoppingToken);
            await _queue.AckAsync(msg, CancellationToken.None);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            break;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка обработки {Id}", msg.Id);
        }
    }
}
```

Здесь несколько решений, каждое по своей причине:

- **Токен в `ReceiveAsync` и `HandleAsync`** — иначе хост дождётся таймаута и бросит задачу на полпути. `Task.Delay` без токена в цикле опроса задержит остановку на всю длину паузы.
- **`ack` только после обработки** и без токена остановки. Необработанное сообщение вернётся брокеру и уйдёт другому экземпляру, а подтверждение уже обработанного не должно отменяться сигналом.
- **`try/catch` вокруг итерации.** С .NET 6 необработанное исключение в `ExecuteAsync` по умолчанию **останавливает весь хост** (`BackgroundServiceExceptionBehavior.StopHost`). Одно ядовитое сообщение не должно ронять сервис.
- **Отмена — не ошибка.** `OperationCanceledException` при остановке логировать как `Error` незачем.

Сервис — singleton, поэтому `DbContext` и прочие scoped-зависимости он получает через scope на итерацию, как в статье `DI и жизненные циклы`.

Есть изменение в .NET 10, о котором стоит знать. Раньше код `ExecuteAsync` до первого настоящего `await` выполнялся синхронно внутри `StartAsync` и задерживал запуск остальных сервисов и Kestrel; классическим костылём был `await Task.Yield()` первой строкой. В .NET 10 `ExecuteAsync` целиком запускается отдельной задачей. Проверено: `Thread.Sleep(3000)` в начале `ExecuteAsync`, а `ApplicationStarted` сработал на 158-й миллисекунде.

## Что ещё сделать в коде

**Сбросить буферы.** Батчи метрик, логов, накопленные записи — в `StopAsync` или в обработчике `ApplicationStopping`. Singleton'ы с `IAsyncDisposable` контейнер освободит сам после остановки сервисов.

**Закрыть долгие соединения.** WebSocket, SSE и long polling сами не завершатся — они доживут до таймаута и будут оборваны. Их закрывают по `ApplicationStopping`, с сигналом клиенту переподключиться.

**Не запускать работу мимо хоста.** `Task.Run` или `async void` из обработчика запроса хост не отслеживает: такая задача погибнет вместе с процессом без предупреждения, а её исключения потеряются — почему, разобрано в статье `async void`. Фоновую работу передают в hosted service через очередь, например `Channel<T>`.

**Не начинать необратимое без защиты.** Если процесс прибьют между «списать деньги» и «записать заказ», спасут только транзакция, outbox или идемпотентный повтор. Операции на минуты в graceful shutdown не вписываются в принципе — их делают прерываемыми и возобновляемыми.

`Environment.Exit` и `Process.Kill` из кода обходят всю эту механику.

## Почему в Kubernetes теряются запросы

Можно сделать всё перечисленное и всё равно видеть `502` на каждом деплое. Причина не в запросах, которые были в работе, а в новых. При удалении пода происходят две вещи **параллельно**:

1. kubelet запускает `preStop`-хук, затем шлёт процессу `SIGTERM`;
2. контроллер EndpointSlice убирает под из списка готовых endpoints, и это изменение асинхронно расходится по kube-proxy на узлах, ingress-контроллерам, service mesh и облачному балансировщику.

Второе занимает секунды. Без `preStop` первое выигрывает гонку: приложение уже закрыло порт, а сеть ещё шлёт на него трафик — клиенты видят connection refused и `502`. Ровно то, что показал замер выше: новый запрос после сигнала не принимается.

Решение — задержать начало остановки, пока сеть не забудет о поде:

```yaml
spec:
  terminationGracePeriodSeconds: 60
  containers:
    - name: api
      lifecycle:
        preStop:
          exec:
            command: ["sleep", "10"]
      readinessProbe:
        httpGet: { path: /health/ready, port: 8080 }
        periodSeconds: 5
```

```csharp
builder.Services.Configure<HostOptions>(o => o.ShutdownTimeout = TimeSpan.FromSeconds(40));
```

Бюджет считается так: `preStop (10 с) + ShutdownTimeout (40 с) < terminationGracePeriodSeconds (60 с)`. Отсчёт grace period включает время `preStop`, и если процесс не успел выйти, kubelet пришлёт `SIGKILL`. По умолчанию grace period — 30 секунд, ровно столько же, сколько `ShutdownTimeout` по умолчанию, то есть без настройки запаса нет совсем. В образах без утилиты `sleep` — distroless, chiseled — используют встроенное действие `preStop.sleep` в новых версиях Kubernetes или задержку в обработчике `ApplicationStopping`.

Дополнительно readiness при `ApplicationStopping` переключают на `503`: часть облачных балансировщиков маршрутизирует напрямую на поды и ориентируется на свои проверки, а не на EndpointSlice. Как устроены сами пробы — в статье `Health checks`.

## Частые ошибки

**`SIGTERM` не доходит до процесса.** Приложение запущено через shell-скрипт или shell-форму `ENTRYPOINT`, и `dotnet` не PID 1: сигнал получает shell и не пробрасывает его. Под ждёт весь grace period и получает `SIGKILL`. Нужна exec-форма: `ENTRYPOINT ["dotnet", "App.dll"]`.

**`ShutdownTimeout` больше grace period.** Приложение вежливо ждёт, а его убивают.

**Liveness с зависимостями во время деплоя** перезапускает здоровые поды, пока новые ещё прогреваются.

**Проверка graceful только локальным Ctrl+C.** Реальную картину показывает нагрузочный тест во время rolling update с подсчётом ошибок на стороне клиента.

**Нет запаса реплик.** `PodDisruptionBudget` и параметры rolling update (`maxUnavailable`, `maxSurge`) не дают одновременно уйти слишком многим подам, пока новые не стали ready.

Остаточные гонки закрывает клиентская сторона: ретраи идемпотентных запросов на `502`, `503` и обрыв соединения.

## Что стоит ответить на собеседовании

По `SIGTERM` Generic Host вызывает `ApplicationStopping`, Kestrel закрывает listener и ждёт запросы в работе, затем в обратном порядке останавливаются hosted services, и всё это укладывается в `ShutdownTimeout` — по умолчанию 30 секунд. Начатый запрос дорабатывает и получает ответ; новый после сигнала получает отказ в соединении; не успевший до таймаута обрывается, а его код получает отмену через `RequestAborted`. Фоновые сервисы обязаны передавать `stoppingToken` во все ожидания, подтверждать сообщения только после обработки и ловить исключения на уровне итерации, потому что с .NET 6 исключение в `ExecuteAsync` останавливает хост.

Сильный ответ объяснит, почему в Kubernetes запросы теряются даже при правильном коде: удаление пода из endpoints и `SIGTERM` происходят параллельно, сеть узнаёт об удалении с задержкой, а приложение закрывает порт сразу. Отсюда `preStop`-задержка, бюджет `preStop + ShutdownTimeout < terminationGracePeriodSeconds`, readiness в `503` при остановке и exec-форма `ENTRYPOINT`, чтобы сигнал вообще дошёл до `dotnet`.
