---
title: Minimal API vs контроллеры
slug: minimal-api-vs-kontrollery
track: dotnet-backend
section: aspnet-core
level: middle
sortOrder: 4
summary: Что общего у двух моделей и где они расходятся — binding, валидация, фильтры, AOT, — как устроен каждый подход внутри и по каким признакам выбирать между ними.
---

Вопрос «Minimal API или контроллеры» часто задают так, будто это два разных фреймворка. На деле оба работают поверх одного endpoint routing, одного конвейера middleware, одной аутентификации и одного DI. Различается только то, как описан обработчик и какая инфраструктура его окружает. Поэтому честный ответ начинается не с выбора, а с того, что у них общего.

## Контроллеры

Контроллер — класс, объединяющий связанные обработчики-actions:

```csharp
[ApiController]
[Route("api/orders")]
public sealed class OrdersController(IOrderService orders) : ControllerBase
{
    [HttpGet("{id:int}")]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderDto>> Get(int id, CancellationToken ct)
    {
        var order = await orders.FindAsync(id, ct);
        return order is null ? NotFound() : Ok(order);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderRequest request, CancellationToken ct)
    {
        var id = await orders.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id }, null);
    }
}

builder.Services.AddControllers();
app.MapControllers();
```

Для API наследуются от `ControllerBase` — он даёт хелперы `Ok`, `NotFound`, `Problem`, доступ к `User` и `ModelState`. `Controller` добавляет поддержку представлений и нужен только для MVC с Razor.

Контроллер создаётся заново **на каждый запрос**, зависимости берутся из DI. Хранить состояние в полях между запросами нельзя. Побочный эффект, о котором редко думают: все зависимости конструктора создаются даже для самого простого action, которому они не нужны. Контроллер на двадцать методов с десятком зависимостей платит за все десять на каждый вызов.

Атрибут `[ApiController]` включает поведение, без которого современный API на контроллерах почти не пишут:

- обязательный attribute routing;
- вывод источников привязки: сложный тип — из тела, параметр из шаблона маршрута — из route;
- автоматический ответ `400` с `ValidationProblemDetails`, если модель невалидна;
- `ProblemDetails` для ошибочных статус-кодов.

Без `[ApiController]` сложный тип по умолчанию собирается не из JSON-тела, а из формы и query — классическая причина «в action приходит пустой объект».

## Minimal API

Тот же функционал в Minimal API:

```csharp
var orders = app.MapGroup("/api/orders")
    .WithTags("Orders")
    .RequireAuthorization();

orders.MapGet("/{id:int}", async Task<Results<Ok<OrderDto>, NotFound>> (
    int id, IOrderService svc, CancellationToken ct) =>
{
    var order = await svc.FindAsync(id, ct);
    return order is null ? TypedResults.NotFound() : TypedResults.Ok(order);
});

orders.MapPost("/", async (CreateOrderRequest req, IOrderService svc, CancellationToken ct) =>
{
    var id = await svc.CreateAsync(req, ct);
    return TypedResults.Created($"/api/orders/{id}");
});
```

Появились в .NET 6, а к .NET 7–8 получили всё, чтобы стать полноценной альтернативой: `MapGroup` для общих префиксов, авторизации и фильтров, `TypedResults` и `Results<T1, T2>`, endpoint filters, поддержку форм и Native AOT.

`Results<Ok<OrderDto>, NotFound>` в сигнатуре — не украшение. Тип возврата перечисляет все возможные ответы, поэтому OpenAPI-документ строится без атрибутов `ProducesResponseType`, а юнит-тест может проверить тип результата напрямую.

Зависимости здесь объявляются **на уровне обработчика**: `IOrderService` нужен только тем endpoint'ам, которые его используют, а не всему классу.

## Как параметры получают значения

В Minimal API правила вывода фиксированы: параметр из шаблона маршрута — из route, простые типы — из query, зарегистрированные в DI типы — из контейнера, `HttpContext`, `CancellationToken`, `ClaimsPrincipal` — специальные, сложный тип — из JSON-тела. Явно источник задаётся атрибутами `[FromRoute]`, `[FromQuery]`, `[FromHeader]`, `[FromBody]`, `[FromServices]`, а `[AsParameters]` собирает параметры в класс.

Nullable reference types здесь влияют на поведение. Проверено на .NET 10:

```
MapGet("/mq",   (string q) ...)    без ?q=       → 400 Bad Request
MapGet("/mqn",  (string? q) ...)   без ?q=       → 200, q = null
MapGet("/mint", (int n) ...)       ?n=abc        → 400 Bad Request
```

Ненулевой `string` делает параметр обязательным, неудачный парсинг сразу даёт 400 в формате ProblemDetails. В контроллерах иначе: ошибка конвертации не бросает исключение, параметр получает значение по умолчанию, а ошибка пишется в `ModelState`. Ответ 400 появится, только если включён `[ApiController]`.

Расширяется binding по-разному. В Minimal API — статическим `TryParse` или `BindAsync(HttpContext, ParameterInfo)` на своём типе. В MVC — провайдерами `IModelBinder` и value providers, то есть гибче, но и тяжелее.

Общее правило для обоих: тело читается **один раз**, поэтому параметр из тела может быть только один. И общий риск — overposting: если привязывать тело прямо к сущности EF, клиент пришлёт `"isAdmin": true`. На вход нужны отдельные DTO.

## Валидация

В контроллерах с `[ApiController]` валидация DataAnnotations выполняется автоматически, и невалидная модель до action не доходит. Проверено на .NET 10, глобальный action filter плюс POST с пустым телом на action с `[Required]`-полем:

```
400 One or more validation errors occurred.
errors: { "Name": ["The Name field is required."] }
лог: глобальный action filter не вызывался, action не вызывался
```

Автоматический 400 реализован как action filter с очень ранним порядком, поэтому до пользовательских action filters с порядком по умолчанию дело не доходит. Подробнее про порядок — в статье `Фильтры`.

В Minimal API до .NET 10 автоматической валидации не было: валидатор вызывали вручную или в endpoint filter. В .NET 10 появилась встроенная:

```csharp
builder.Services.AddValidation();

app.MapPost("/users", (CreateUser user) => TypedResults.Ok(user));

public sealed record CreateUser(
    [property: Required, StringLength(5)] string Name,
    [property: Range(18, 120)] int Age);
```

Проверено на .NET 10 — запрос с длинным именем и возрастом 5 получает 400 с обеими ошибками в `errors`, обработчик не вызывается.

В обоих подходах валидация формата — не бизнес-правила. «Email уникален» и «товар есть на складе» — логика домена, ей место в сервисе, а не в атрибутах.

## Как они устроены внутри

Для каждого обработчика Minimal API `RequestDelegateFactory` при старте генерирует оптимизированный `RequestDelegate`: разбор параметров, вызов лямбды, сериализация результата. Для Native AOT то же самое делает source generator на этапе компиляции.

У контроллера между endpoint'ом и методом стоит `ControllerActionInvoker`: создание контроллера через DI, model binding на провайдерах, валидация, конвейер из пяти типов фильтров, выбор форматтера. Это мощно и расширяемо, но каждый слой стоит времени и аллокаций.

## Сравнение

| | Контроллеры | Minimal API |
| --- | --- | --- |
| Организация | классы, атрибуты, наследование | лямбды и методы, `MapGroup` |
| Зависимости | общий конструктор контроллера | на уровне обработчика |
| Фильтры | пять типов MVC-фильтров | endpoint filters |
| Валидация | автоматическая с `[ApiController]` | встроенная с .NET 10 |
| Model binding | расширяемый: binders, value providers | фиксированные правила, `TryParse`, `BindAsync` |
| Конвенции, `ApplicationModel` | есть | нет |
| Native AOT | не поддерживается | поддерживается |
| OpenAPI | атрибуты `ProducesResponseType` | из `TypedResults` автоматически |

## Как выбирать

**Контроллеры** — когда большой проект уже на MVC и команда к нему привыкла; когда нужны возможности, которых в Minimal API нет: свои model binders и value providers, конвенции application model, OData, `JsonPatch` на Newtonsoft; когда фильтров много и важен их сложный порядок, включая resource и result filters.

**Minimal API** — для новых сервисов и микросервисов, vertical slice-архитектуры, при требованиях к старту и памяти, под Native AOT.

Про производительность стоит сказать честно: Minimal API быстрее на синтетических бенчмарках, но на реальном сервисе с базой и сетью разница теряется на фоне I/O. Выбирать стоит по возможностям и удобству, а не по микросекундам.

Подходы можно совмещать в одном приложении: `MapControllers()` рядом с `MapGet`. Главный риск Minimal API — не производительность, а отсутствие структуры, когда весь API оказывается в `Program.cs`. Решается группировкой по фичам:

```csharp
public static class OrderEndpoints
{
    public static IEndpointRouteBuilder MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/orders").WithTags("Orders");
        group.MapGet("/{id:int}", GetOrder);
        group.MapPost("/", CreateOrder);
        return app;
    }

    private static async Task<Results<Ok<OrderDto>, NotFound>> GetOrder(
        int id, IOrderService svc, CancellationToken ct) =>
        await svc.FindAsync(id, ct) is { } o ? TypedResults.Ok(o) : TypedResults.NotFound();

    private static async Task<Created> CreateOrder(
        CreateOrderRequest req, IOrderService svc, CancellationToken ct) =>
        TypedResults.Created($"/api/orders/{await svc.CreateAsync(req, ct)}");
}
```

Именованные методы вместо лямбд ещё и тестируются напрямую.

## Что стоит ответить на собеседовании

Контроллеры и Minimal API работают поверх одного endpoint routing, одного конвейера middleware, одной аутентификации и одного DI. Контроллер — класс MVC, создаваемый на каждый запрос, с `ControllerActionInvoker`, расширяемым model binding'ом и пятью типами фильтров; `[ApiController]` добавляет вывод источников привязки и автоматический 400 при невалидной модели. Minimal API — функции, для которых при старте генерируется лёгкий `RequestDelegate`, с `MapGroup`, `TypedResults`, endpoint filters и поддержкой Native AOT.

Сильный ответ назовёт конкретные различия: в Minimal API ненулевой `string` делает query-параметр обязательным и неудачный парсинг сразу даёт 400, а в MVC ошибка уходит в `ModelState`; встроенная валидация в Minimal API появилась только в .NET 10 через `AddValidation()`; зависимости в Minimal API объявляются на уровне обработчика, а не общим конструктором. И скажет, что выбор делают по нужным возможностям — кастомный binding, сложный конвейер фильтров, AOT, — а не по бенчмаркам, потому что в реальном сервисе разницу съедает I/O.
