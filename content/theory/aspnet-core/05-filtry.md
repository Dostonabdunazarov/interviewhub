---
title: Фильтры
slug: aspnet-filtry
track: dotnet-backend
section: aspnet-core
level: middle
sortOrder: 5
summary: Пять типов MVC-фильтров и где каждый срабатывает, порядок global → controller → action и свойство Order, чего не ловит exception filter, endpoint filters в Minimal API и граница между фильтром и middleware.
---

Middleware видит запрос как HTTP: путь, заголовки, поток тела. Но часть сквозной логики требует большего — аргументов action после привязки, `ModelState`, объекта результата до сериализации. Для этого в MVC существует собственный конвейер внутри endpoint'а — фильтры. А в Minimal API у них есть упрощённый аналог.

## Пять типов фильтров

Фильтры MVC выполняются вокруг вызова action, каждый тип — на своём этапе:

```text
Authorization filters
  → Resource filters (до)
      → model binding и валидация
      → Action filters (до) → ACTION → Action filters (после)
      → Result filters (до) → выполнение результата → Result filters (после)
  → Resource filters (после)

Exception filters — при исключении в создании контроллера, binding, action filters, action
```

| Тип | Интерфейс | Когда | Для чего |
| --- | --- | --- | --- |
| Authorization | `IAuthorizationFilter`, `IAsyncAuthorizationFilter` | первыми | проверка доступа; сейчас вместо них — политики |
| Resource | `IResourceFilter`, `IAsyncResourceFilter` | до model binding и после всего | кэширование, отключение binding'а для больших загрузок |
| Action | `IActionFilter`, `IAsyncActionFilter` | вокруг action | аргументы, `ModelState`, аудит |
| Exception | `IExceptionFilter`, `IAsyncExceptionFilter` | при исключении | превращение исключения в ответ на уровне MVC |
| Result | `IResultFilter`, `IAsyncResultFilter` | вокруг выполнения `IActionResult` | заголовки, обёртка ответа |

Чаще всего пишут action filter, и выглядит он как middleware, только с другим контекстом:

```csharp
public sealed class ValidateTenantFilter(ITenantService tenants) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (context.ActionArguments.TryGetValue("tenantId", out var id)
            && !await tenants.ExistsAsync((int)id!))
        {
            context.Result = new NotFoundResult();
            return;
        }

        var executed = await next();

        if (executed.Exception is null && executed.Result is ObjectResult)
            context.HttpContext.Response.Headers["X-Tenant-Checked"] = "1";
    }
}
```

Здесь видно главное отличие от middleware: фильтр читает `ActionArguments` — уже привязанные и провалидированные аргументы, а после вызова видит `IActionResult`, а не байты в потоке ответа.

Short-circuit работает так же, как в конвейере middleware: фильтр выставил `context.Result` и не вызвал `next` — action не выполнится. Для синхронной версии есть пара `OnActionExecuting` / `OnActionExecuted`; реализовывать нужно что-то одно — синхронный или асинхронный интерфейс, не оба.

## Порядок выполнения

Фильтр можно повесить глобально, на контроллер и на action. На входе порядок — от широкого к узкому, на выходе — обратный. Проверено на .NET 10, по одному action filter на каждом уровне:

```
global in | controller in | action in | action | action out | controller out | global out
```

Порядок меняется свойством `Order` из `IOrderedFilter`: фильтры сортируются сначала по нему, и только при равенстве — по уровню. Тот же action filter с `Order = -1`:

```
action-order-minus in | global in | controller in | action | controller out | global out | action-order-minus out
```

Фильтр уровня action стал самым внешним. По умолчанию `Order` равен нулю, и этим пользуется сам фреймворк. Автоматический 400 от `[ApiController]` реализован как action filter с `Order = -2000`, поэтому при невалидной модели пользовательские action filters вообще не вызываются. Проверено на .NET 10: POST с пустым телом на action с `[Required]`-полем вернул 400, а глобальный action filter в логе не появился. Если фильтру нужно увидеть невалидную модель, его `Order` должен быть меньше.

## Чего не ловит exception filter

Exception filter перехватывает исключения из создания контроллера, model binding, action filters и самого action. Проверено на .NET 10, exception filter, отвечающий кодом 418:

```
GET /f/throw-action → 418, «handled by filter»
GET /f/throw-result → 500 от UseExceptionHandler, фильтр не вызывался
```

Исключение, брошенное при выполнении результата, — например, при сериализации — exception filter не видит. Не видит он и ошибок из middleware и из Minimal API. Поэтому глобальная обработка ошибок делается не фильтром, а `UseExceptionHandler` с `IExceptionHandler` — она покрывает весь конвейер:

```csharp
public sealed class DomainExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        var status = ex switch
        {
            NotFoundException => StatusCodes.Status404NotFound,
            ConflictException => StatusCodes.Status409Conflict,
            _ => 0
        };
        if (status == 0) return false;

        ctx.Response.StatusCode = status;
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = ctx,
            Exception = ex,
            ProblemDetails = { Title = ex.Message, Status = status }
        });
    }
}

builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddProblemDetails();
app.UseExceptionHandler();
```

Обработчики вызываются в порядке регистрации, первый вернувший `true` завершает обработку. Если никто не взялся, отдаётся стандартный ProblemDetails с кодом 500.

Exception filter остаётся уместным, когда реакция на исключение должна зависеть от контекста MVC — конкретного контроллера или action.

## Result filters и short-circuit

Result filter срабатывает вокруг выполнения `IActionResult` — удобное место, чтобы добавить заголовки или обернуть объект ответа до сериализации. Но он выполняется не всегда:

- если authorization или resource filter прервал конвейер — result filters не запускаются;
- если exception filter обработал исключение и выставил результат — тоже не запускаются;
- если action filter выставил `context.Result` — запускаются, для этого результата.

Когда фильтр должен сработать в любом случае, например чтобы поставить заголовок на любой ответ, есть `IAlwaysRunResultFilter`.

## Фильтры и DI

Обычный фильтр-атрибут не может получать зависимости через конструктор: атрибуты создаёт рефлексия, а не контейнер. Варианты:

```csharp
builder.Services.AddControllers(o => o.Filters.Add<AuditFilter>());

[ServiceFilter<ValidateTenantFilter>]
[TypeFilter<ValidateTenantFilter>]
```

- `Filters.Add<T>()` — глобальный фильтр, создаётся с разрешением зависимостей;
- `ServiceFilter<T>` — берёт экземпляр из DI, фильтр нужно зарегистрировать, и его lifetime определяете вы;
- `TypeFilter<T>` — создаёт через `ActivatorUtilities`, регистрация не нужна, можно передать дополнительные аргументы;
- `IFilterFactory` — атрибут, который сам решает, как создать фильтр.

С lifetime здесь та же опасность, что в статье `DI и жизненные циклы`: фильтр, зарегистрированный singleton'ом и получивший `DbContext` в конструктор, захватит его навсегда. У `IFilterFactory` за это отвечает свойство `IsReusable`: если оно `true`, экземпляр может переиспользоваться между запросами.

## Endpoint filters в Minimal API

MVC-фильтры работают только для контроллеров и Razor Pages. У Minimal API с .NET 7 есть свой механизм — endpoint filters:

```csharp
app.MapPost("/orders", (CreateOrder cmd) => TypedResults.Ok())
   .AddEndpointFilter(async (ctx, next) =>
   {
       var cmd = ctx.GetArgument<CreateOrder>(0);
       if (cmd.Quantity <= 0)
           return TypedResults.ValidationProblem(new Dictionary<string, string[]>
           {
               ["Quantity"] = ["Должно быть положительным"]
           });
       return await next(ctx);
   });
```

Это один тип вместо пяти: фильтр оборачивает вызов обработчика, видит его аргументы через `GetArgument<T>(index)` и может вернуть свой результат вместо вызова `next`. Вешается на endpoint или на группу целиком — `MapGroup("/api").AddEndpointFilter<AuditFilter>()`. Фильтры выполняются в порядке добавления: первый добавленный — внешний.

## Фильтр или middleware

| | Middleware | Фильтр |
| --- | --- | --- |
| Уровень | весь конвейер, все запросы | запросы к конкретным endpoint'ам |
| Что видит | `HttpContext` | аргументы, `ModelState`, дескриптор action, результат |
| Статика, health checks, gRPC | да | нет |
| Работа с результатом | только поток ответа | объект `IActionResult` до сериализации |
| Где настраивается | порядок в `Program.cs` | глобально, на контроллер, на action |

Грубое правило: сквозная HTTP-логика — исключения, заголовки безопасности, correlation id, CORS, сжатие, лимиты — в middleware, как в статье `Pipeline и middleware`. Логика, которой нужен контекст вызова — аудит с аргументами, проверка доступа к ресурсу по параметру, транзакция вокруг action, — в фильтр.

Есть и серая зона. Middleware после `UseRouting` может работать выборочно, читая метаданные endpoint'а:

```csharp
app.Use(async (ctx, next) =>
{
    if (ctx.GetEndpoint()?.Metadata.GetMetadata<AuditAttribute>() is not null)
        await ctx.RequestServices.GetRequiredService<IAuditLog>().WriteAsync(ctx.Request.Path);
    await next(ctx);
});
```

Так устроены встроенные авторизация, CORS и rate limiting. Такой подход хорош, когда логика должна одинаково работать и для контроллеров, и для Minimal API, — фильтры у них разные, а middleware общий.

## Что стоит ответить на собеседовании

В MVC пять типов фильтров: authorization, resource, action, exception и result, каждый на своём этапе вокруг action. Порядок по уровням — global, controller, action на входе и обратный на выходе, и его переопределяет свойство `Order`. Фильтры-атрибуты не получают зависимости через конструктор, поэтому для них есть `ServiceFilter`, `TypeFilter` и `IFilterFactory`. В Minimal API вместо них — endpoint filters, один тип с доступом к аргументам обработчика.

Сильный ответ назовёт границы: exception filter не видит исключений из выполнения результата, middleware и Minimal API, поэтому глобальная обработка ошибок делается через `UseExceptionHandler` и `IExceptionHandler`. Автоматический 400 от `[ApiController]` — action filter с `Order = -2000`, и пользовательские action filters при невалидной модели не вызываются. И объяснит выбор между фильтром и middleware: фильтру нужен контекст вызова — аргументы и `IActionResult`, middleware — только HTTP, но он работает для всех типов endpoint'ов сразу.
