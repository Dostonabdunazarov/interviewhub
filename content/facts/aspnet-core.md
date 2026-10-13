# Факты: ASP.NET Core

## new HttpClient() на каждый запрос исчерпывает сокеты

```yaml
slug: httpclient-ischerpanie-soketov
category: aspnet-core
```

`HttpClient` реализует `IDisposable`, и рука сама тянется написать `using`. Но после `Dispose` закрытое соединение ещё какое-то время висит в состоянии `TIME_WAIT`, и под нагрузкой свободные порты заканчиваются: `SocketException` при живом сервере.

Обратная крайность — один статический клиент навсегда: соединения живут вечно и не замечают смены DNS. Правильно — `IHttpClientFactory`, либо долгоживущий клиент с `SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(2) }`.

## Scoped внутри singleton ловится только в Development

```yaml
slug: captive-dependency-validatescopes
category: aspnet-core
```

Если singleton получает в конструктор scoped-сервис, например `DbContext`, тот живёт вечно и разделяется между всеми запросами. Это captive dependency, и проявляется она гонками и устаревшими данными.

Проверки `ValidateScopes` и `ValidateOnBuild` по умолчанию включены только в окружении Development. На стенде с `Production` приложение молча стартует с этой ошибкой. Внутри singleton создавайте scope явно: `IServiceScopeFactory.CreateScope()`.

## Заголовки нельзя менять после начала ответа

```yaml
slug: headers-read-only-response-started
category: aspnet-core
```

Как только в тело ответа записан первый байт, статус и заголовки уже улетели клиенту. Попытка выставить заголовок или статус после этого бросит `InvalidOperationException: Headers are read-only, response has already started`.

Классический сценарий: middleware добавляет заголовок после `await next()`, а эндпоинт к тому моменту уже всё записал. Используйте `context.Response.OnStarting(...)` — колбэк вызовется прямо перед отправкой заголовков. В обработчике ошибок проверяйте `Response.HasStarted`.

## HttpContext не переживает запрос

```yaml
slug: httpcontext-v-fonovoy-zadache
category: aspnet-core
```

`HttpContext` не потокобезопасен и переиспользуется сервером после завершения запроса. Если запустить «огонь и забудь» задачу и обратиться в ней к `IHttpContextAccessor.HttpContext`, можно получить `null`, `ObjectDisposedException` или, хуже всего, данные чужого запроса.

Перед уходом в фон скопируйте нужные значения (id пользователя, заголовки) в обычные переменные. А саму фоновую работу лучше отдать `BackgroundService` через очередь, а не `Task.Run` из контроллера.

## Тело запроса читается один раз

```yaml
slug: request-body-odin-raz
category: aspnet-core
```

`Request.Body` — это поток из сети, а не буфер. Если middleware логирования прочитал тело до конца, model binding дальше получит пустой поток и пустую модель без всякой ошибки.

Чтобы читать повторно, включите буферизацию и верните позицию:

```csharp
context.Request.EnableBuffering();
var body = await new StreamReader(context.Request.Body, leaveOpen: true).ReadToEndAsync();
context.Request.Body.Position = 0;
```

Большие тела при этом уходят во временный файл, так что логируйте тело только там, где оно действительно нужно.
