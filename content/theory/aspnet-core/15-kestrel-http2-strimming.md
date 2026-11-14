---
title: Kestrel, HTTP/2, HTTP/3 и стриминг
slug: aspnet-kestrel-http2-strimming
track: dotnet-backend
section: aspnet-core
level: senior
sortOrder: 15
summary: Как Kestrel принимает соединения и какие лимиты защищают его под нагрузкой, что меняют HTTP/2 и HTTP/3 для сервера, как отдавать большие и потоковые ответы без буферизации и как писать middleware без аллокаций на запрос.
questions: advanced-aspnet-kak-kestrel-obrabatyvaet-soedineniya-i-kakie-limity-stoit-nastraivat-p, advanced-aspnet-chto-menyaetsya-dlya-servera-pri-perehode-na-http-2-i-kogda-multipleks, advanced-aspnet-kakie-problemy-reshaet-http-3-i-quic-i-kogda-perehod-opravdan, advanced-aspnet-chto-takoe-response-buffering-i-kogda-ego-nuzhno-otklyuchat, advanced-aspnet-kak-otdavat-bolshoi-otvet-ne-zagruzhaya-ego-celikom-v-pamyat, advanced-aspnet-kak-napisat-middleware-ne-sozdayuschee-allokacii-na-kazhdyi-zapros
---

Пока сервис отвечает мелкими JSON'ами, Kestrel незаметен. Он становится темой разговора, когда приходят десятки тысяч соединений, медленные клиенты, gRPC за балансировщиком, выгрузки на гигабайт и SSE, которые доходят до браузера пачками. Это уровень ниже конвейера из статьи `Pipeline и middleware`: соединение, протокол, тело ответа и стоимость горячего пути.

## Как Kestrel принимает соединение

Kestrel не выделяет поток на соединение. Транспорт (по умолчанию сокетный, `SocketTransportOptions`) крутит accept-цикл: забирает соединение из очереди ядра, оборачивает его в `ConnectionContext` с парой `System.IO.Pipelines` — входным и выходным пайпом — и передаёт протокольному слою. Тот разбирает HTTP/1.1, HTTP/2 или HTTP/3 и на каждый запрос (для HTTP/2 — на каждый стрим) создаёт `HttpContext` и вызывает собранный `RequestDelegate`.

Простаивающее keep-alive соединение потока не держит, поэтому десятки тысяч соединений для Kestrel — норма. Узкое место обычно в приложении: sync-over-async и голодание thread pool ломают сервер задолго до сокетов.

Пороги backpressure — `MaxRequestBufferSize` и `MaxResponseBufferSize` на соединение: пока выходной пайп заполнен, `await` записи не завершается, и медленный клиент тормозит того, кто пишет ответ.

## Лимиты `KestrelServerLimits`

Под нагрузкой настраивают не «скорость», а защитные лимиты:

| Лимит | По умолчанию | Смысл |
| --- | --- | --- |
| `MaxConcurrentConnections` | без ограничения | граница по памяти и дескрипторам |
| `MaxRequestBodySize` | ~30 МБ | уменьшить для API, точечно поднять через `[RequestSizeLimit]` |
| `MaxRequestHeadersTotalSize` | 32 КБ | сюда упираются большие JWT и куки — ответ `431` |
| `KeepAliveTimeout` | 130 с | больше idle timeout балансировщика перед Kestrel |
| `RequestHeadersTimeout` | 30 с | защита от slowloris |
| `MinRequestBodyDataRate` | 240 байт/с, grace 5 с | отсекает клиентов, которые почти ничего не передают |

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(k =>
{
    k.AddServerHeader = false;
    k.Limits.MaxConcurrentConnections = 20_000;
    k.Limits.MaxRequestBodySize = 1 * 1024 * 1024;
    k.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(75);
    k.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(10);
    k.Limits.MinRequestBodyDataRate = new MinDataRate(1024, TimeSpan.FromSeconds(5));
    k.Limits.Http2.MaxStreamsPerConnection = 200;
});

builder.WebHost.UseSockets(o => o.Backlog = 2048);
```

Две практические детали. Keep-alive таймаут Kestrel должен быть **больше**, чем у балансировщика. Иначе Kestrel закрывает соединение, когда LB уже шлёт по нему запрос, — отсюда «плавающие» `502`. И `MaxConcurrentConnections` — не rate limiting. Через одно HTTP/2-соединение идут сотни запросов; ограничение запросов — в статье `Rate limiting`. Backlog дополнительно обрезается ядром (`net.core.somaxconn`), а за сервером наблюдают через `dotnet-counters` с провайдером `Microsoft.AspNetCore.Server.Kestrel`: `current-connections`, `connection-queue-length`.

## HTTP/2: одно соединение, много стримов

HTTP/2 мультиплексирует: одно TCP-соединение несёт много параллельных стримов, каждый — отдельный запрос со своим `HttpContext`. Заголовки сжимаются HPACK с таблицей на соединение, данные идут бинарными фреймами с flow control на уровне соединения и каждого стрима. Соединений меньше, но каждое тяжелее и живёт часами. Ограничивать приходится стримы (`MaxStreamsPerConnection`, по умолчанию 100) и окна (`InitialConnectionWindowSize`, `InitialStreamWindowSize`), а мёртвые соединения за NAT находить пингами.

```csharp
builder.WebHost.ConfigureKestrel(k =>
{
    k.ListenAnyIP(5001, l => { l.Protocols = HttpProtocols.Http1AndHttp2; l.UseHttps(); });
    k.ListenAnyIP(5002, l => l.Protocols = HttpProtocols.Http2);
    k.Limits.Http2.KeepAlivePingDelay = TimeSpan.FromSeconds(30);
    k.Limits.Http2.KeepAlivePingTimeout = TimeSpan.FromSeconds(20);
});
```

Браузеры говорят HTTP/2 только поверх TLS через ALPN; порт 5002 — h2c без TLS, типичный для gRPC внутри кластера.

Где мультиплексирование вредит:

- **Head-of-line на уровне TCP.** Стримы независимы для HTTP, но едут в одном TCP-потоке: потерянный пакет задерживает все стримы до ретрансмита.
- **L4-балансировка.** Балансировщик TCP распределяет соединения, а не запросы. gRPC-клиент с одним соединением весь трафик шлёт на один под, новые реплики простаивают. Нужен L7-балансировщик или клиентская балансировка.
- **Лимит стримов на клиенте.** `HttpClient` с одним соединением и сотней занятых стримов ставит остальные запросы в очередь у себя; лечится `EnableMultipleHttp2Connections`, см. статью `HttpClient`.
- **Дешёвые атаки.** HTTP/2 Rapid Reset (CVE-2023-44487): тысячи открытых и сразу сброшенных стримов; защита пришла патчами рантайма.

Выгоднее всего HTTP/2 при множестве параллельных мелких вызовов между одними сторонами — прежде всего в gRPC.

## HTTP/3 и QUIC

HTTP/3 работает поверх QUIC — транспорта на UDP со встроенным TLS 1.3. Он закрывает то, что HTTP/2 унаследовал от TCP:

- стримы независимы на транспортном уровне, потеря пакета задерживает только свой стрим;
- транспорт и криптография договариваются за одно рукопожатие — 1 RTT вместо 2–3, а при возобновлении возможен 0-RTT;
- соединение определяется connection ID, а не четвёркой адресов, поэтому переход телефона с Wi-Fi на LTE не рвёт его.

Kestrel поддерживает HTTP/3 стабильно с .NET 7 через библиотеку `msquic`: на Windows 11 / Server 2022 и новее, на Linux — пакет `libmsquic`. HTTPS обязателен. Клиент сначала приходит по TCP, получает `Alt-Svc` и только потом пробует QUIC, так что TCP-endpoint нужен всегда:

```csharp
builder.WebHost.ConfigureKestrel(k =>
    k.ListenAnyIP(443, l =>
    {
        l.Protocols = HttpProtocols.Http1AndHttp2AndHttp3;
        l.UseHttps();
    }));
```

Цена ощутимая: UDP/443 режут файрволы, QUIC в user space дороже TCP по CPU, балансировщик должен уметь UDP и маршрутизацию по connection ID, а данные 0-RTT можно переиграть, поэтому на них допустимы только идемпотентные запросы.

Переход оправдан для публичных API и сайтов с мобильными или далёкими от дата-центра клиентами. Чаще всего HTTP/3 включают на CDN или edge, а до Kestrel идёт HTTP/2. Внутри дата-центра выигрыша нет. Решают по метрикам реальных клиентов: потери пакетов, p95 времени до первого байта.

## Response buffering

Буферизация ответа — накопление тела в памяти до отправки. Она позволяет до последнего менять статус, посчитать `Content-Length`, сжать или закэшировать ответ целиком. Цена — память пропорционально размеру ответа и задержка первого байта.

Сам Kestrel ответ целиком не копит: запись в `Response.Body` уходит в выходной пайп и сбрасывается в сокет. Буферизуют слои вокруг: сжатие, output cache, свой middleware с `MemoryStream` вместо `Response.Body` и nginx с `proxy_buffering on`.

Для стриминга — SSE, long polling, прогресс долгих операций — буферизацию отключают:

```csharp
app.MapGet("/events", async (HttpContext ctx, IEventFeed feed, CancellationToken ct) =>
{
    ctx.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();
    ctx.Response.ContentType = "text/event-stream";
    ctx.Response.Headers.CacheControl = "no-cache";
    ctx.Response.Headers["X-Accel-Buffering"] = "no";

    await foreach (var e in feed.ReadAsync(ct))
    {
        await ctx.Response.WriteAsync($"data: {e}\n\n", ct);
        await ctx.Response.Body.FlushAsync(ct);
    }
});
```

`DisableBuffering()` велит обёрткам тела, например сжатию, отдавать данные сразу, `FlushAsync` сбрасывает буферы, `X-Accel-Buffering: no` отключает буферизацию в nginx. В .NET 10 есть `TypedResults.ServerSentEvents`, который делает это сам. Если `curl -N` показывает события пачками, буфер где-то по пути.

## Большой ответ без загрузки в память

Принцип один: писать в `Response.Body` или `Response.BodyWriter` по мере чтения источника, а не собирать результат в `List<T>`, строку или `MemoryStream`. И источник тоже должен читаться потоково.

JSON-массив из базы отдаётся через `IAsyncEnumerable<T>`: EF Core читает строки по одной, System.Text.Json пишет их по мере поступления.

```csharp
app.MapGet("/export/orders", (AppDbContext db) =>
    db.Orders.AsNoTracking()
        .Select(o => new OrderRow(o.Id, o.Total, o.CreatedAt))
        .AsAsyncEnumerable());
```

`AsNoTracking` обязателен — иначе change tracker удержит каждую строку. Файлы и чужие потоки отдают через `Results.File` и `Results.Stream`: данные копируются кусками, а `enableRangeProcessing: true` включает докачку через `206 Partial Content`. Для собственного формата есть `Results.Stream` с колбэком `Func<Stream, Task>`, а для минимума копий — запись прямо в `PipeWriter` ответа, `HttpResponse.BodyWriter`:

```csharp
app.MapGet("/export/ids", async (HttpContext ctx, AppDbContext db, CancellationToken ct) =>
{
    ctx.Response.ContentType = "text/plain";
    var writer = ctx.Response.BodyWriter;
    var count = 0;
    await foreach (var o in db.Orders.AsNoTracking().AsAsyncEnumerable().WithCancellation(ct))
    {
        var span = writer.GetSpan(32);
        o.Id.TryFormat(span, out var n);
        span[n++] = (byte)'\n';
        writer.Advance(n);
        if (++count % 1000 == 0)
            await writer.FlushAsync(ct);
    }
    await writer.FlushAsync(ct);
});
```

Здесь `Id` — `long`, и его `TryFormat` в `Span<byte>` (.NET 8+, `IUtf8SpanFormattable`) пишет UTF-8 без промежуточных строк. `FlushAsync` раз в тысячу строк отдаёт накопленное клиенту и ждёт, если клиент не успевает, — так работает backpressure; сброс на каждой строке дал бы лишние системные вызовы. Про спаны — статья `Span<T> и Memory<T>`.

После первой записи заголовки ушли: ошибка посреди выгрузки уже не станет `500`, соединение просто оборвётся, поэтому валидируют всё до начала записи. Долгая выгрузка держит курсор в базе, а слишком медленного клиента оборвёт `MinResponseDataRate`. Для совсем больших выгрузок лучше файл в объектном хранилище и ссылка на скачивание.

## Middleware без аллокаций на запрос

Инфраструктурный middleware выполняется на каждом запросе: 200 байт при 50 000 RPS — 10 МБ мусора в секунду и частые сборки gen0. Цель — чтобы горячий путь не создавал объектов вообще:

```csharp
public sealed class TenantGuardMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext ctx)
    {
        var tenant = ctx.Request.Headers["X-Tenant"];
        if (tenant.Count == 1 && string.Equals(tenant[0], "blocked", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        }

        return next(ctx);
    }
}
```

- **Класс по соглашению, а не `IMiddleware`.** Экземпляр создаётся один раз; `IMiddleware` со scoped-регистрацией резолвится на каждый запрос.
- **Без `async`.** Метод либо отвечает синхронно, либо возвращает задачу `next` — машины состояний нет.
- **Заголовок как `StringValues`.** Это структура, `Count` и индексатор не аллоцируют, сравнение через `StringComparison` вместо `ToLower()`.
- **Нет замыканий.** Перегрузка `app.Use` с `Func<Task> next` создаёт замыкание на каждый запрос, перегрузка с `RequestDelegate` — нет. Для `OnStarting` и `OnCompleted` берут `static`-лямбду со state.
- **Время без объектов.** `Stopwatch.GetTimestamp()` вместо `new Stopwatch`.
- **Без LINQ и `Items`.** LINQ аллоцирует итераторы, `Items` создаёт словарь при первом обращении. Статические данные кешируются в `static readonly` полях.
- **Буферы из пула.** `ArrayPool<byte>.Shared` или `stackalloc`; логирование через `[LoggerMessage]`.

Проверка — BenchmarkDotNet с `[MemoryDiagnoser]` на `InvokeAsync` с `DefaultHttpContext`: в колонке `Allocated` должно быть `0 B`. Под нагрузкой — скорость аллокаций в `System.Runtime` через `dotnet-counters monitor`.

## Что стоит ответить на собеседовании

Kestrel — асинхронный сервер без потока на соединение: транспорт принимает сокет, оборачивает его в `ConnectionContext` с пайпами, протокольный слой создаёт `HttpContext` на запрос. Под нагрузкой настраивают защитные лимиты `KestrelServerLimits`: соединения, размеры, таймауты, минимальную скорость передачи. HTTP/2 мультиплексирует стримы в одном соединении и сжимает заголовки, но сохраняет head-of-line блокировку TCP; HTTP/3 на QUIC её убирает, ускоряет установление соединения и переживает смену сети. Для стриминга ответ пишут частями — `IAsyncEnumerable`, `Results.Stream`, `PipeWriter` — и отключают буферизацию через `DisableBuffering` и `FlushAsync`.

Сильный ответ покажет последствия: keep-alive Kestrel длиннее, чем у балансировщика, иначе `502`; `MaxConcurrentConnections` при HTTP/2 почти ничего не ограничивает; gRPC за L4-балансировщиком прилипает к одному поду; HTTP/3 чаще включают на edge, а не в Kestrel; буферизуют обычно сжатие, output cache, свои middleware и nginx; после начала стриминга статус не поменять. Middleware на горячем пути пишут без `async`, замыканий и строк и проверяют `[MemoryDiagnoser]` и `dotnet-counters`.
