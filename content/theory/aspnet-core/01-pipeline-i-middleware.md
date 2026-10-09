---
title: Pipeline и middleware
slug: aspnet-pipeline-i-middleware
track: dotnet-backend
section: aspnet-core
level: middle
sortOrder: 1
summary: Как собирается конвейер запроса, почему порядок middleware — это логика приложения, что такое short-circuit и какие ошибки в своём middleware встречаются чаще всего.
---

Всё, что ASP.NET Core делает с HTTP-запросом, происходит в конвейере — цепочке компонентов, через которую запрос проходит «вниз» до обработчика, а ответ возвращается «вверх». Эти компоненты называются middleware. Почти любая неочевидная проблема веб-приложения — авторизация не видит токен, CORS отдаёт 401, ошибка не логируется — объясняется тем, в каком порядке они стоят.

## Что такое middleware

Middleware — функция, которая получает `HttpContext` и делегат `next` на следующий компонент. Она может сделать что-то до вызова `next`, вызвать его, поработать с результатом и вернуть управление:

```csharp
app.Use(async (context, next) =>
{
    var start = Stopwatch.GetTimestamp();
    await next(context);
    var elapsed = Stopwatch.GetElapsedTime(start);
    app.Logger.LogInformation("{Path} -> {Status} за {Ms} мс",
        context.Request.Path, context.Response.StatusCode, elapsed.TotalMilliseconds);
});
```

Код до `await next` выполняется на пути запроса, код после — на пути ответа, когда всё ниже по цепочке уже отработало. Это «матрёшка»: каждый слой оборачивает следующие.

Подключить компонент можно тремя способами:

| Метод | Что делает |
| --- | --- |
| `app.Use(...)` | обычный middleware, может вызвать `next` |
| `app.Run(...)` | терминальный: `next` нет, цепочка на нём заканчивается |
| `app.Map(...)`, `MapWhen`, `UseWhen` | ответвление конвейера по пути или условию |

## Как собирается конвейер

Вызовы `app.Use...()` при старте не обрабатывают запросы — они регистрируют фабрики вида `Func<RequestDelegate, RequestDelegate>`. Когда приложение запускается, билдер сворачивает их с конца в один `RequestDelegate`: последний компонент оборачивается предпоследним и так далее. Конвейер строится **один раз**, а на каждый запрос лишь вызывается готовый делегат.

Отсюда простое правило: порядок регистрации — это порядок выполнения. Проверено на .NET 10, два middleware и обработчик:

```csharp
app.Use(async (ctx, next) => { Log("A in"); await next(ctx); Log("A out"); });
app.Use(async (ctx, next) => { Log("B in"); await next(ctx); Log("B out"); });
app.MapGet("/order", () => { Log("handler"); return "ok"; });
```

```
A in | B in | handler | B out | A out
```

На входе — в порядке регистрации, на выходе — в обратном.

## Путь запроса целиком

Kestrel принимает соединение, разбирает HTTP, создаёт `HttpContext` и вызывает собранный делегат. Дальше этапы такие:

1. Middleware до `UseRouting` — обработка исключений, HTTPS-редирект, статические файлы.
2. `UseRouting` сопоставляет URL с endpoint'ом и кладёт его в контекст. С этого момента любой компонент может прочитать `context.GetEndpoint()` вместе с метаданными: `[Authorize]`, политикой CORS, лимитом запросов.
3. Middleware между routing и endpoint'ом — CORS, аутентификация, авторизация, rate limiting. Они уже знают, **куда** идёт запрос, и решают по его метаданным.
4. Endpoint middleware вызывает обработчик: action контроллера или лямбду Minimal API.
5. Ответ поднимается обратно через код после `await next`.

Для контроллеров и Minimal API это один и тот же endpoint routing — разница начинается только внутри endpoint'а, о чём подробнее в статье `Minimal API vs контроллеры`.

## Порядок — это логика

Рекомендуемая последовательность стандартных компонентов:

```csharp
var app = builder.Build();

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseHsts();
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseOutputCache();

app.MapControllers();
app.Run();
```

Каждая позиция в этом списке чем-то обоснована, и при нарушении ломается конкретная вещь:

- **`UseForwardedHeaders` первым.** За балансировщиком он подменяет IP клиента и схему по заголовкам `X-Forwarded-*`. Если он стоит позже, HTTPS-редирект видит `http` и зацикливается, а rate limiter складывает всех клиентов в одну партицию с IP балансировщика.
- **Обработчик исключений — до всего, что может бросить.** Он оборачивает `next` в `try/catch` и видит только то, что ниже него. Поставленный последним, он не поймает ошибку из соседних компонентов.
- **Статические файлы — рано.** Файл отдаётся без проверки токена и без прохода по остальной цепочке.
- **`UseAuthorization` после `UseRouting`.** Иначе авторизация не знает, какой endpoint выбран и есть ли на нём `[Authorize]`.
- **`UseAuthentication` до `UseAuthorization`.** Иначе авторизация видит анонимного пользователя и отдаёт 401 даже на запрос с валидным токеном.
- **`UseCors` до аутентификации.** Preflight-запрос `OPTIONS` браузер шлёт без токена; если CORS стоит после авторизации, preflight получает 401 и браузер блокирует настоящий запрос.

У `WebApplication` есть неявное поведение, о котором стоит знать: если `UseRouting` не вызван явно, он добавляется **в самое начало** конвейера, а endpoint middleware — в конец. Значит, routing выполняется до всех ваших компонентов. Если нужен точный порядок, вызывайте `UseRouting()` явно.

## Short-circuit

Middleware не обязан вызывать `next`. Если не вызвал — остаток конвейера, включая endpoint, не выполнится, а ответ сформирует он сам:

```csharp
app.Use(async (ctx, next) =>
{
    if (!ctx.Request.Headers.ContainsKey("X-Api-Key"))
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return;
    }
    await next(ctx);
});
```

Так работают статические файлы, CORS preflight, отказ авторизации, rate limiter и output cache. Это экономия: чем раньше отсечён ненужный запрос, тем меньше на него потрачено.

Компоненты выше по цепочке всё равно получат управление обратно и, например, залогируют 401; не выполнятся только те, что ниже.

Ловушка — забыть выставить ответ. Проверено на .NET 10: middleware, который просто сделал `return` без записи, даёт клиенту

```
HTTP/1.1 200 OK
Content-Length: 0
```

Пустой `200`, а не ошибку. Клиент считает, что всё прошло успешно.

С .NET 8 у endpoint'а есть `ShortCircuit()`: запрос завершается сразу после routing, минуя аутентификацию и остальные компоненты, — удобно для health-проб.

## Ответ уже начат

Заголовки ответа уходят клиенту с первой записью в тело. После этого статус и заголовки менять нельзя. Проверено на .NET 10 — middleware пытается добавить заголовок после `await next`, когда обработчик уже записал тело:

```
InvalidOperationException: Headers are read-only, response has already started.
```

Исправление — проверять `Response.HasStarted` или зарегистрировать изменение заранее через `OnStarting`, который сработает перед отправкой заголовков:

```csharp
app.Use((ctx, next) =>
{
    ctx.Response.OnStarting(static state =>
    {
        var c = (HttpContext)state;
        c.Response.Headers["X-Node"] = Environment.MachineName;
        return Task.CompletedTask;
    }, ctx);
    return next(ctx);
});
```

Перегрузка со `state` и `static`-лямбда избавляют от замыкания на каждый запрос.

## Свой middleware

Для чего-то повторно используемого пишут класс. Самый распространённый вариант — по соглашению:

```csharp
public sealed class CorrelationIdMiddleware(RequestDelegate next)
{
    private const string Header = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext ctx, ILogger<CorrelationIdMiddleware> logger)
    {
        var id = ctx.Request.Headers[Header].FirstOrDefault() ?? Guid.NewGuid().ToString("N");
        ctx.Response.Headers[Header] = id;

        using (logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = id }))
        {
            await next(ctx);
        }
    }
}

app.UseMiddleware<CorrelationIdMiddleware>();
```

Требования соглашения: публичный конструктор с `RequestDelegate`, метод `Invoke` или `InvokeAsync`, возвращающий `Task`, первый параметр — `HttpContext`. Остальные параметры метода берутся из DI **на каждый запрос**.

Главная ловушка этого варианта: экземпляр создаётся **один раз** при сборке конвейера и живёт всё время работы приложения. Фактически это singleton. Отсюда два правила:

- не хранить состояние запроса в полях класса — его делят все параллельные запросы;
- scoped-зависимости вроде `DbContext` получать параметрами `InvokeAsync`, а не через конструктор, — иначе получится captive dependency, разобранная в статье `DI и жизненные циклы`.

Второй вариант — реализовать `IMiddleware`:

```csharp
public sealed class TenantMiddleware(ITenantStore store) : IMiddleware
{
    public async Task InvokeAsync(HttpContext ctx, RequestDelegate next)
    {
        ctx.Items["Tenant"] = await store.ResolveAsync(ctx.Request.Host.Host);
        await next(ctx);
    }
}

builder.Services.AddScoped<TenantMiddleware>();
app.UseMiddleware<TenantMiddleware>();
```

| | По соглашению | `IMiddleware` |
| --- | --- | --- |
| Создание | один раз при сборке конвейера | из DI на каждый запрос |
| Scoped-зависимости | параметрами `InvokeAsync` | в конструктор |
| Регистрация в DI | не нужна | нужна |

## Частые ошибки

**`next` без `await`.** Цепочка запускается, но middleware завершается раньше неё. Код «после» выполнится до формирования ответа, исключения потеряются, а обращение к `HttpContext` после окончания запроса может упасть — объекты контекста переиспользуются между запросами.

**Чтение тела запроса без `EnableBuffering`.** Поток тела читается один раз; middleware, прочитавший его для логирования, оставит model binding'у пустоту. Нужно `ctx.Request.EnableBuffering()` и возврат позиции в ноль.

**Тяжёлая логика для всех запросов подряд.** Middleware выполняется и для статики, и для health-проб; логику только для API ограничивают через `UseWhen` или метаданные endpoint'а.

**Лишние аллокации на горячем пути.** Через инфраструктурный middleware идёт весь трафик: 200 байт на запрос при 50 000 RPS — 10 МБ мусора в секунду. Приёмы — из статьи `Снижение аллокаций`.

Middleware видит только сырой `HttpContext` и ничего не знает про аргументы action и `IActionResult` — для логики, которой нужен этот контекст, существуют фильтры, о них статья `Фильтры`.

## Что стоит ответить на собеседовании

Конвейер ASP.NET Core — цепочка middleware, собранная при старте в один `RequestDelegate`. Каждый компонент получает `HttpContext` и `next`, может поработать до и после вызова следующего или не вызывать его вовсе и ответить сам — это short-circuit, на нём построены статические файлы, CORS preflight, авторизация и rate limiting. На входе компоненты выполняются в порядке регистрации, на выходе — в обратном.

Сильный ответ объяснит, почему порядок — это логика: обработчик исключений первым, `UseRouting` до CORS и авторизации, потому что им нужны метаданные endpoint'а, аутентификация до авторизации, `UseForwardedHeaders` раньше всех, кто смотрит на IP и схему. И назовёт типичные ошибки: забытый ответ при short-circuit даёт пустой `200`, изменение заголовков после начала ответа бросает `InvalidOperationException`, а middleware по соглашению создаётся один раз, поэтому scoped-зависимости ему передают параметрами `InvokeAsync`, а не в конструктор.
