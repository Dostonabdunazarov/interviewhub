# ASP.NET Core

Вопросы категории `aspnet-core` в формате импорта (`tools/questions.md`): 72 шт.

```bash
node tools/import-questions.mjs --file content/questions/aspnet-core.md --dry-run
node tools/import-questions.mjs --file content/questions/aspnet-core.md --url … --email … --update
```

---

## Как устроен request pipeline в ASP.NET Core?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-ustroen-request-pipeline-v-asp-net-core
tags: middleware
```

Request pipeline — это цепочка middleware, через которую проходит каждый HTTP-запрос. Каждый компонент получает `HttpContext`, может что-то сделать до и после вызова следующего, а в конце цепочки стоит endpoint — ваш контроллер или обработчик Minimal API.

**Как он собирается.** При старте `WebApplication` вызовы `app.Use...()` регистрируют функции вида `Func<RequestDelegate, RequestDelegate>`. При `app.Run()` билдер сворачивает их в обратном порядке в один `RequestDelegate` — вложенную «матрёшку», где каждый слой держит ссылку на следующий. Пайплайн строится один раз, а не на каждый запрос.

```csharp
var app = builder.Build();

app.UseExceptionHandler("/error");   // внешний слой: ловит всё, что ниже
app.UseHttpsRedirection();
app.UseStaticFiles();                // может ответить сам и не пустить дальше
app.UseRouting();                    // выбирает endpoint
app.UseAuthentication();             // кто пользователь
app.UseAuthorization();              // можно ли ему в выбранный endpoint

app.MapGet("/orders/{id:int}", (int id) => Results.Ok(id));  // терминал
app.Run();
```

**Путь запроса:**

1. Kestrel принимает соединение, парсит HTTP и создаёт `HttpContext`.
2. Запрос идёт «вниз» по middleware в порядке регистрации.
3. `UseRouting` сопоставляет URL с endpoint и кладёт его в `HttpContext` — дальше любой middleware может прочитать его через `context.GetEndpoint()` вместе с метаданными (`[Authorize]`, политики CORS, rate limiting).
4. Endpoint middleware вызывает обработчик, тот пишет ответ.
5. Управление возвращается «вверх» в обратном порядке — это код после `await next()`.

**Что важно понимать:**

- **Short-circuit.** Любой middleware может не вызывать `next` и ответить сам — так работают static files, CORS preflight, отказ авторизации.
- **Порядок — это логика.** `UseAuthorization` до `UseRouting` не знает, какой endpoint выбран и какие у него атрибуты. Exception handler, зарегистрированный последним, не поймает ошибки более ранних компонентов.
- **Неявные добавления.** `WebApplication` сам добавляет `UseRouting` в начало и endpoint middleware в конец, если вы их не вызвали, а в Development — страницу исключений разработчика.
- **Ответ уже начат.** После того как заголовки ушли клиенту (`Response.HasStarted`), менять статус и заголовки нельзя — это частая ошибка в middleware, работающем «после» `next`.

На собеседовании обычно дальше спрашивают про правильный порядок стандартных middleware и чем middleware отличается от фильтров MVC.

## Что такое middleware?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-middleware
tags: middleware
```

Middleware — это компонент конвейера обработки запроса: функция, которая получает `HttpContext` и делегат `next` на следующий компонент. Она может обработать запрос, изменить его, вызвать `next` и поработать с ответом, либо ответить сама и прервать цепочку.

```csharp
app.Use(async (context, next) =>
{
    var sw = Stopwatch.StartNew();          // до следующего компонента
    await next(context);
    // после: ответ уже сформирован ниже по цепочке
    app.Logger.LogInformation("{Path} -> {Status} за {Ms} мс",
        context.Request.Path, context.Response.StatusCode, sw.ElapsedMilliseconds);
});
```

**Три способа подключить:**

| Метод | Что делает |
| --- | --- |
| `app.Use(...)` | обычный middleware, может вызвать `next` |
| `app.Run(...)` | терминальный: `next` у него нет, цепочка заканчивается |
| `app.Map("/path", ...)` / `MapWhen` | ответвление пайплайна по пути или условию |

**Для чего используется.** Всё, что касается запроса целиком и не зависит от конкретного контроллера: обработка исключений, HTTPS-редирект, статические файлы, CORS, аутентификация и авторизация, сжатие ответов, rate limiting, логирование, correlation id, заголовки безопасности.

**Встроенные примеры:** `UseExceptionHandler`, `UseHsts`, `UseStaticFiles`, `UseRouting`, `UseCors`, `UseAuthentication`, `UseAuthorization`, `UseResponseCompression`, `UseRateLimiter`, `UseOutputCache`.

**Типичные ошибки:**

- Писать в `Response` после того, как следующий компонент уже начал ответ, — получите `InvalidOperationException` про уже отправленные заголовки.
- Вызывать `next` дважды.
- Хранить состояние запроса в поле класса middleware: экземпляр conventional middleware создаётся один раз на всё приложение и общий для всех запросов.
- Ставить middleware не в том месте: порядок регистрации — это порядок выполнения.

Middleware не знает про модели, model binding и результаты действий MVC — для этого есть фильтры. Middleware работает на уровне сырого `HttpContext`.

## В каком порядке выполняются middleware?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-v-kakom-poryadke-vypolnyayutsya-middleware
tags: middleware
```

Middleware выполняются в том порядке, в котором зарегистрированы в `Program.cs`, на пути запроса, и в обратном — на пути ответа. Код до `await next()` идёт сверху вниз, код после — снизу вверх.

```csharp
app.Use(async (ctx, next) => { Console.WriteLine("A in");  await next(ctx); Console.WriteLine("A out"); });
app.Use(async (ctx, next) => { Console.WriteLine("B in");  await next(ctx); Console.WriteLine("B out"); });
app.Run(ctx => { Console.WriteLine("handler"); return Task.CompletedTask; });

// A in, B in, handler, B out, A out
```

**Рекомендуемый порядок стандартных компонентов** (из документации ASP.NET Core):

1. `UseExceptionHandler` / developer exception page — первым, чтобы ловить ошибки всех остальных.
2. `UseHsts`, `UseHttpsRedirection`.
3. `UseStaticFiles` — рано, чтобы файлы отдавались без аутентификации и лишней работы.
4. `UseRouting` — выбор endpoint.
5. `UseCors` — после routing, до auth (preflight не несёт токена).
6. `UseAuthentication`, затем `UseAuthorization`.
7. `UseRateLimiter`, `UseResponseCompression`, `UseOutputCache`, собственные middleware.
8. `Map...` — endpoints.

**Почему порядок критичен:**

- `UseAuthorization` до `UseAuthentication` видит анонимного пользователя и отдаёт 401 даже с валидным токеном.
- `UseAuthorization` до `UseRouting` не знает endpoint и его `[Authorize]`.
- Exception handler в конце не поймает исключение из middleware, стоящих выше.
- `UseCors` после авторизации — preflight `OPTIONS` получит 401, и браузер заблокирует запрос.
- Сжатие, поставленное после middleware, который пишет ответ, этот ответ не сожмёт.

**Нюанс `WebApplication`.** Если не вызвать `UseRouting` явно, он добавляется в самое начало пайплайна, а endpoints — в конец. Если ваш middleware должен видеть выбранный endpoint, вызывайте `UseRouting()` явно перед ним. Аналогично в .NET 7+ `UseAuthentication`/`UseAuthorization` добавляются автоматически при зарегистрированных сервисах, но явный вызов делает порядок предсказуемым.

**Ветвления.** `Map` и `MapWhen` создают отдельную ветку: middleware, зарегистрированные после ветки в основном пайплайне, для неё не выполняются. `UseWhen` же возвращается в основную цепочку.

## Что произойдёт, если middleware не вызовет `next()`?

```yaml
category: aspnet-core
level: middle
difficulty: 4
slug: aspnet-core-chto-proizoidet-esli-middleware-ne-vyzovet-next
tags: middleware
```

Произойдёт short-circuit: остальная часть конвейера, включая endpoint, не выполнится, а ответ клиенту сформирует сам этот middleware. Если он ничего не запишет, клиент получит пустой ответ с кодом по умолчанию — `200 OK`, а не 404 или ошибку.

```csharp
app.Use(async (ctx, next) =>
{
    if (!ctx.Request.Headers.ContainsKey("X-Api-Key"))
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return;                       // next не вызван — контроллер не выполнится
    }
    await next(ctx);
});
```

**Когда это правильно.** Так работают многие встроенные компоненты:

- `UseStaticFiles` нашёл файл — отдал его, дальше не пошёл;
- CORS отвечает на preflight `OPTIONS` сам;
- авторизация возвращает 401/403;
- rate limiter отклоняет запрос;
- output cache отдаёт закэшированный ответ;
- health check endpoint, `app.Run(...)`.

Прерывание экономит работу: чем раньше отсекли ненужный запрос, тем меньше ресурсов потрачено.

**Когда это баг:**

- **Забыли `await`.** `next(ctx);` без `await` запускает цепочку, но middleware завершается раньше. Код «после» выполнится до формирования ответа, исключения потеряются, а обращение к `HttpContext` после завершения запроса может упасть с `ObjectDisposedException`.
- **Условная ветка без ответа.** Пропустили `next`, но не выставили статус — клиент видит пустой `200` и не понимает, что происходит.
- **Middleware «после» не выполнятся.** Код после `await next()` у внешних компонентов всё равно отработает — они получат управление обратно. Не выполнятся только те, что ниже по цепочке.

**Что ещё знать:**

- Прерывание в middleware, стоящем до `UseRouting`, означает, что endpoint даже не выбирался — метаданные вроде `[AllowAnonymous]` недоступны.
- В Minimal API есть ещё endpoint filters: там short-circuit — это возврат результата без вызова `next(context)`.
- Вызвать `next` дважды нельзя: второй проход по пайплайну попытается писать в уже начатый ответ.

Интервьюер может спросить: «А что увидят middleware выше?» — они получат управление после вашего `return` и смогут, например, залогировать статус 401.

## Как написать собственный middleware?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-napisat-sobstvennyi-middleware
tags: middleware
```

Есть три способа: inline-делегат через `app.Use`, класс по соглашению (convention-based) с методом `InvokeAsync`, и класс, реализующий `IMiddleware`. Для чего-то повторно используемого обычно пишут класс и extension-метод `UseXxx()`.

**Convention-based middleware** — самый распространённый вариант:

```csharp
public sealed class CorrelationIdMiddleware
{
    private const string Header = "X-Correlation-Id";
    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next) => _next = next;

    // Scoped-зависимости — параметрами метода, не конструктора
    public async Task InvokeAsync(HttpContext ctx, ILogger<CorrelationIdMiddleware> logger)
    {
        var id = ctx.Request.Headers[Header].FirstOrDefault() ?? Guid.NewGuid().ToString("N");
        ctx.Response.Headers[Header] = id;

        using (logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = id }))
        {
            await _next(ctx);
        }
    }
}

public static class CorrelationIdExtensions
{
    public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder app)
        => app.UseMiddleware<CorrelationIdMiddleware>();
}
```

Требования: публичный конструктор с `RequestDelegate`, публичный метод `Invoke` или `InvokeAsync`, возвращающий `Task`, первый параметр — `HttpContext`.

**`IMiddleware`** — фабричный вариант:

```csharp
public sealed class TenantMiddleware(ITenantStore store) : IMiddleware
{
    public async Task InvokeAsync(HttpContext ctx, RequestDelegate next)
    {
        ctx.Items["Tenant"] = await store.ResolveAsync(ctx.Request.Host.Host);
        await next(ctx);
    }
}

builder.Services.AddScoped<TenantMiddleware>();   // обязательно зарегистрировать
app.UseMiddleware<TenantMiddleware>();
```

| | Convention-based | `IMiddleware` |
| --- | --- | --- |
| Создание | один раз при сборке пайплайна | из DI на каждый запрос |
| Scoped-зависимости | только через параметры `InvokeAsync` | можно в конструктор |
| Регистрация в DI | не нужна | нужна |
| Строгая типизация | нет, по соглашению | да, интерфейс |

**Главная ловушка.** Convention-based middleware фактически singleton. Если внедрить в его конструктор `DbContext` или другой scoped-сервис, он будет один на всё приложение — с гонками и устаревшими данными. В Development это ловит валидация скоупов при старте.

**Советы:** не храните состояние запроса в полях; проверяйте `Response.HasStarted`, прежде чем менять заголовки после `next`, или используйте `ctx.Response.OnStarting(...)`; всегда `await next`.

## Что такое Dependency Injection?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-dependency-injection
tags: dependency-injection
```

Dependency Injection — это приём, при котором класс не создаёт свои зависимости сам, а получает их извне, обычно через конструктор. Создавать объекты и связывать их между собой берёт на себя внешний код — чаще всего DI-контейнер.

```csharp
// Без DI: жёсткая связь с конкретной реализацией
public class OrderService
{
    private readonly SqlOrderRepository _repo = new("Server=...");
}

// С DI: зависимость от абстракции, реализацию подставит контейнер
public class OrderService(IOrderRepository repo, TimeProvider clock)
{
    public Task PlaceAsync(Order o) => repo.AddAsync(o with { CreatedAt = clock.GetUtcNow() });
}

builder.Services.AddScoped<IOrderRepository, SqlOrderRepository>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddSingleton(TimeProvider.System);
```

**Связь с принципами.** DI — способ реализовать Dependency Inversion Principle (буква D в SOLID): модули верхнего уровня зависят от абстракций, а не от деталей. Более общее понятие — Inversion of Control: не ваш код управляет созданием объектов, а фреймворк.

**Что это даёт:**

- **Тестируемость.** В тесте подставляете фейк или мок `IOrderRepository` — без базы и сети.
- **Слабая связность.** Замена реализации (SQL → Mongo, реальный SMTP → заглушка) — одна строка в регистрации.
- **Управление временем жизни.** Контейнер решает, создать новый объект или переиспользовать, и сам вызывает `Dispose`.
- **Явные зависимости.** Конструктор честно показывает, что нужно классу. Десять параметров — сигнал, что класс делает слишком много.

**Виды внедрения:** через конструктор (основной в .NET), через параметр метода (`[FromServices]` в action, параметры `InvokeAsync` у middleware, параметры обработчика Minimal API), через свойство (встроенный контейнер не поддерживает).

**Антипаттерн — Service Locator.** Внедрить `IServiceProvider` и вызывать `GetService<T>()` внутри методов — зависимости снова скрыты, тестировать сложнее. Это допустимо только в инфраструктурном коде: фабриках, фоновых сервисах, создающих скоупы.

В ASP.NET Core DI встроен в фреймворк: контроллеры, middleware, фильтры, hosted services, options, логирование — всё получается из контейнера.

## Как работает встроенный DI-контейнер ASP.NET Core?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-rabotaet-vstroennyi-di-konteiner-asp-net-core
```

Встроенный контейнер (`Microsoft.Extensions.DependencyInjection`) работает в две фазы: сначала вы наполняете `IServiceCollection` описаниями сервисов, потом `builder.Build()` превращает их в `IServiceProvider`, который создаёт объекты, рекурсивно разрешая зависимости конструктора, и управляет их временем жизни.

**Фаза регистрации.** Каждая регистрация — это `ServiceDescriptor`: тип сервиса, lifetime и способ создания (тип реализации, фабрика или готовый экземпляр).

```csharp
builder.Services.AddSingleton<IClock, SystemClock>();                 // тип
builder.Services.AddScoped<IUnitOfWork>(sp =>                           // фабрика
    new UnitOfWork(sp.GetRequiredService<AppDbContext>()));
builder.Services.AddSingleton(new ApiSettings("https://api"));         // экземпляр
builder.Services.TryAddTransient<IEmailSender, SmtpSender>();          // только если ещё нет
builder.Services.AddKeyedSingleton<ICache, RedisCache>("redis");       // keyed, .NET 8+
```

**Фаза разрешения.**

- Контейнер выбирает конструктор реализации: из публичных — тот, у которого больше всего параметров, которые он может разрешить.
- Для каждого параметра рекурсивно разрешает зависимость, учитывая lifetime.
- Singleton хранится в корневом провайдере, scoped — в текущем `IServiceScope`, transient создаётся заново каждый раз.
- `IDisposable`/`IAsyncDisposable`-объекты, созданные контейнером, запоминаются и освобождаются при dispose их скоупа (или корня — для singleton).

**Скоупы в ASP.NET Core.** На каждый HTTP-запрос фреймворк создаёт scope; `HttpContext.RequestServices` — это его провайдер. В конце запроса scope уничтожается вместе со scoped-сервисами.

**Правила, о которых спрашивают:**

- Несколько регистраций одного интерфейса: `GetService<T>()` вернёт последнюю, `IEnumerable<T>` — все в порядке регистрации.
- `GetService` возвращает `null`, `GetRequiredService` бросает исключение.
- В Development включены `ValidateScopes` и `ValidateOnBuild`: контейнер при старте ругается на scoped внутри singleton и на неразрешимые зависимости.
- Экземпляры, переданные готовыми (`AddSingleton(instance)`), контейнер не dispose'ит — ими владеете вы.

**Чего нет «из коробки»:** property injection, декораторов, сканирования сборок, перехватчиков. Для этого берут Scrutor поверх встроенного контейнера или заменяют его на Autofac/DryIoc. Keyed services появились только в .NET 8 (`[FromKeyedServices("redis")]`).

## Чем отличаются `Transient`, `Scoped` и `Singleton`?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-chem-otlichayutsya-transient-scoped-i-singleton
tags: dependency-injection
```

Это три времени жизни сервиса в DI-контейнере: transient создаётся при каждом запросе к контейнеру, scoped — один на scope (в веб-приложении это один HTTP-запрос), singleton — один на всё приложение.

| | Transient | Scoped | Singleton |
| --- | --- | --- | --- |
| Сколько экземпляров | новый при каждом разрешении | один на scope | один на приложение |
| Когда dispose | с окончанием scope, в котором создан | с окончанием scope | при остановке приложения |
| Потокобезопасность | обычно не нужна | не нужна (один запрос) | обязательна |
| Типичные примеры | лёгкие stateless-сервисы, валидаторы | `DbContext`, unit of work, текущий пользователь | кэш, конфигурация, `HttpClient`-фабрика, `TimeProvider` |

```csharp
builder.Services.AddTransient<IValidator<Order>, OrderValidator>();
builder.Services.AddScoped<AppDbContext>();
builder.Services.AddSingleton<IMemoryCache, MemoryCache>();
```

**Как почувствовать разницу.** Если в одном запросе контроллер и сервис оба получают `AppDbContext`, это будет один и тот же объект — поэтому они видят общие изменения и сохраняют их одним `SaveChanges`. Если бы контекст был transient, каждый получил бы свой экземпляр, и транзакция «развалилась бы».

**Правило совместимости:** сервис может зависеть только от сервисов с таким же или более долгим временем жизни.

- singleton → scoped — ошибка (captive dependency): scoped «застревает» навсегда;
- singleton → transient — transient тоже фактически станет singleton;
- scoped → singleton — нормально.

**Подводные камни:**

- **Transient + `IDisposable`, разрешённый из корня.** Контейнер хранит ссылку на каждый такой объект до конца жизни корневого провайдера — утечка памяти.
- **Singleton со state.** Два параллельных запроса пишут в одно поле — гонка. Используйте `ConcurrentDictionary`, `Interlocked`, иммутабельные данные.
- **Scoped вне запроса.** В `BackgroundService` scope нет — его надо создать самому через `IServiceScopeFactory`.
- **Scoped ≠ «на поток».** Внутри одного запроса scoped-сервис может использоваться из разных потоков после `await`, но не параллельно — `DbContext` не поддерживает параллельные операции.

Выбор по умолчанию: stateless-сервис без тяжёлых ресурсов — transient или singleton, всё, что держит состояние запроса или соединение с БД, — scoped.

## Почему нельзя напрямую внедрять `Scoped` сервис в `Singleton`?

```yaml
category: aspnet-core
level: middle
difficulty: 4
slug: aspnet-core-pochemu-nelzya-napryamuyu-vnedryat-scoped-servis-v-singleton
tags: dependency-injection
```

Потому что singleton создаётся один раз, и scoped-зависимость, полученная им в конструкторе, будет жить столько же — всё время работы приложения. Это называется captive dependency: объект, рассчитанный на один запрос, «захвачен» и используется всеми запросами сразу.

```csharp
builder.Services.AddScoped<AppDbContext>();
builder.Services.AddSingleton<PriceCache>();

public class PriceCache(AppDbContext db)   // db создан в корневом scope и не умрёт
{
    public Task<decimal> GetAsync(int id) =>
        db.Products.Where(p => p.Id == id).Select(p => p.Price).FirstAsync();
}
```

**Что сломается:**

- **Потокобезопасность.** `DbContext` не потокобезопасен. Параллельные запросы через один экземпляр дадут `InvalidOperationException: A second operation was started on this context instance...` или порченые данные.
- **Устаревшее состояние.** Change tracker копит сущности всех запросов — память растёт, запросы возвращают закэшированные трекингом объекты вместо свежих.
- **Чужие данные.** Если scoped-сервис хранит текущего пользователя или тенанта, singleton будет видеть данные того запроса, который его создал, — утечка между пользователями.
- **Dispose.** Scoped-объект не освободится, пока жив корень, — соединения и ресурсы не вернутся в пул.

**Как контейнер защищает.** В Development `ValidateScopes = true`, и при попытке разрешить scoped из корня или внутри singleton будет исключение `Cannot consume scoped service ... from singleton ...`. В Production проверка по умолчанию выключена ради скорости — баг проявится только под нагрузкой. Её можно включить явно:

```csharp
builder.Host.UseDefaultServiceProvider(o =>
{
    o.ValidateScopes = true;
    o.ValidateOnBuild = true;
});
```

**Как делать правильно:**

1. Пересмотреть lifetime: может, сервису не нужен singleton, и он может стать scoped.
2. Создавать scope на каждую операцию:

```csharp
public class PriceCache(IServiceScopeFactory scopes)
{
    public async Task<decimal> GetAsync(int id)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Products.Where(p => p.Id == id).Select(p => p.Price).FirstAsync();
    }
}
```

3. Для EF Core — `IDbContextFactory<T>` (`AddDbContextFactory`), он singleton-safe и выдаёт новый контекст по требованию.
4. Передавать нужные данные параметром метода, а не зависимостью.

Обратное — scoped, зависящий от singleton, — полностью нормально.

## Что такое `IServiceProvider`?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-iserviceprovider
tags: dependency-injection
```

`IServiceProvider` — это интерфейс DI-контейнера для получения сервисов. У него единственный метод `object? GetService(Type serviceType)`; всё остальное (`GetRequiredService<T>`, `GetServices<T>`, `CreateScope`) — extension-методы поверх него.

```csharp
IServiceProvider sp = app.Services;                       // корневой провайдер

var clock  = sp.GetService<IClock>();                    // null, если не зарегистрирован
var sender = sp.GetRequiredService<IEmailSender>();      // исключение, если нет
var all    = sp.GetServices<INotificationHandler>();     // все реализации

using var scope = sp.CreateScope();                      // новый scope
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
```

**Какие провайдеры бывают:**

| Провайдер | Где взять | Что в нём |
| --- | --- | --- |
| Корневой | `app.Services`, конструктор singleton | singleton'ы; scoped оттуда брать нельзя |
| Scoped | `HttpContext.RequestServices`, `scope.ServiceProvider` | scoped-сервисы текущего запроса/скоупа |

Scoped-провайдер знает свой scope: запрошенный из него scoped-сервис будет общим в пределах скоупа и освободится вместе с ним.

**Связанные интерфейсы:**

- `IServiceScopeFactory` — создание скоупов, безопасно внедрять в singleton;
- `IServiceProviderIsService` — проверить, можно ли разрешить тип, не создавая его (использует Minimal API, чтобы понять, параметр из DI или из тела);
- `IKeyedServiceProvider` — получение keyed-сервисов (.NET 8+).

**Когда использовать напрямую.** В прикладном коде почти никогда — лучше constructor injection. Внедрение `IServiceProvider` в бизнес-класс превращает его в Service Locator: зависимости скрыты, тесты сложнее, ошибки регистрации всплывают в рантайме. Оправданные случаи:

- фоновые сервисы, создающие scope на итерацию;
- фабрики, выбирающие реализацию в рантайме;
- инфраструктурный код, middleware, `ActivatorUtilities.CreateInstance<T>(sp, extraArgs)`.

**Ловушка.** Разрешение scoped-сервиса из корневого провайдера (`app.Services.GetRequiredService<AppDbContext>()`) в Development падает на валидации скоупов, а в Production молча создаёт экземпляр, который живёт вечно. Для разовой работы при старте создавайте scope.

## Что такое service lifetime?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-service-lifetime
tags: dependency-injection
```

Service lifetime — это правило, по которому DI-контейнер решает, создать ли новый экземпляр сервиса или отдать существующий, и когда этот экземпляр освободить. Задаётся при регистрации и бывает трёх видов: `Singleton`, `Scoped`, `Transient` (enum `ServiceLifetime`).

```csharp
builder.Services.Add(new ServiceDescriptor(typeof(IClock), typeof(SystemClock), ServiceLifetime.Singleton));
// то же самое, короче:
builder.Services.AddSingleton<IClock, SystemClock>();
```

**Что определяет lifetime:**

1. **Переиспользование.** Singleton — один на приложение, scoped — один на scope, transient — новый на каждое разрешение.
2. **Владение и dispose.** Контейнер вызывает `Dispose`/`DisposeAsync` у созданных им объектов, когда заканчивается их scope: для scoped и transient — в конце запроса, для singleton — при остановке хоста.
3. **Допустимые зависимости.** Сервис не должен зависеть от сервиса с более коротким lifetime.

**Как выбирать:**

- Нет состояния, дешёвое создание — transient или singleton (singleton экономит аллокации, но обязан быть потокобезопасным).
- Состояние на один запрос, единица работы, соединение с БД — scoped.
- Дорогой в создании, разделяемый ресурс (кэш, клиент к внешнему сервису, скомпилированные регулярки) — singleton.

**Что считается scope.** В ASP.NET Core — HTTP-запрос (а в SignalR — вызов метода хаба, в Blazor Server — circuit пользователя). Вне запроса scope нужно создать вручную: `IServiceScopeFactory.CreateScope()` в фоновом сервисе или при инициализации в `Program.cs`.

**Как lifetime ломается на практике:**

- Singleton получил scoped-зависимость — она живёт вечно (captive dependency).
- Transient `IDisposable`, разрешённый из корневого провайдера, копится в памяти до остановки приложения.
- Lifetime зарегистрированного вами класса и lifetime класса, которым вы им пользуетесь, различаются — например, typed `HttpClient` (transient) внедрили в singleton, и он навсегда закрепился за одним handler'ом.

Проверить себя помогают `ValidateScopes` и `ValidateOnBuild` — в Development они включены по умолчанию.

## Что такое constructor injection?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-constructor-injection
tags: value-types, dependency-injection
```

Constructor injection — способ внедрения зависимостей, при котором класс объявляет всё, что ему нужно, параметрами конструктора, а DI-контейнер при создании объекта сам разрешает и передаёт эти параметры. Это основной и рекомендуемый вид внедрения в .NET.

```csharp
public sealed class InvoiceService(
    IInvoiceRepository repo,
    IOptions<BillingOptions> options,
    ILogger<InvoiceService> logger)
{
    public async Task IssueAsync(Invoice invoice, CancellationToken ct)
    {
        if (invoice.Total > options.Value.MaxAmount)
            logger.LogWarning("Invoice {Id} exceeds limit", invoice.Id);
        await repo.AddAsync(invoice, ct);
    }
}
```

Здесь использован primary constructor (C# 12); классический вариант с `private readonly` полями работает так же.

**Почему именно конструктор:**

- **Объект всегда в валидном состоянии.** Его нельзя создать без зависимостей — никаких `NullReferenceException` из-за незаполненного свойства.
- **Зависимости явные.** Сигнатура конструктора — это контракт класса. Разросшийся конструктор сразу показывает нарушение SRP.
- **Неизменяемость.** Зависимости сохраняются в `readonly`-поля.
- **Тесты.** Достаточно вызвать `new InvoiceService(fakeRepo, Options.Create(...), NullLogger<InvoiceService>.Instance)`.

**Как контейнер выбирает конструктор.** Если публичных конструкторов несколько, берётся тот, у которого больше всего параметров, которые контейнер умеет разрешить. Если таких «самых длинных» подходящих несколько и выбрать нельзя — исключение. Атрибут `[ActivatorUtilitiesConstructor]` позволяет указать конструктор явно для `ActivatorUtilities`.

**Параметры, которых нет в DI** (строка подключения, число), в конструктор напрямую не передать. Варианты: options pattern, фабрика при регистрации (`AddSingleton(sp => new X(sp.GetRequiredService<Y>(), "value"))`) или `ActivatorUtilities.CreateInstance<T>(sp, "value")`. Value types и строки контейнер не резолвит, если они не зарегистрированы — и регистрировать их обычно плохая идея.

**Альтернативы в ASP.NET Core:**

- method injection — `[FromServices]` в action, параметры `InvokeAsync` у middleware, параметры обработчика Minimal API;
- property injection встроенный контейнер не поддерживает (есть в Autofac), и это к лучшему — необязательные зависимости маскируют ошибки конфигурации.

**Циклические зависимости** (`A(B)`, `B(A)`) при constructor injection невозможны — контейнер бросит исключение про circular dependency. Это признак неудачного дизайна, а не повод искать обход.

## Что такое options pattern?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-options-pattern
```

Options pattern — способ работать с конфигурацией через строго типизированные классы вместо строковых ключей. Секция конфигурации привязывается к POCO-классу, а сервисы получают её через DI в виде `IOptions<T>` (или его вариантов).

```json
// appsettings.json
{
  "Smtp": { "Host": "smtp.example.com", "Port": 587, "UseSsl": true }
}
```

```csharp
public sealed class SmtpOptions
{
    public const string Section = "Smtp";

    [Required] public string Host { get; init; } = "";
    [Range(1, 65535)] public int Port { get; init; } = 25;
    public bool UseSsl { get; init; }
}

builder.Services.AddOptions<SmtpOptions>()
    .BindConfiguration(SmtpOptions.Section)
    .ValidateDataAnnotations()
    .ValidateOnStart();                 // упасть при старте, а не при первом письме

public sealed class EmailSender(IOptions<SmtpOptions> options)
{
    private readonly SmtpOptions _smtp = options.Value;
}
```

**Почему это лучше, чем `IConfiguration["Smtp:Host"]`:**

- типизация и IntelliSense вместо магических строк;
- валидация в одном месте, причём можно сделать её при старте;
- сервис зависит только от своего набора настроек (Interface Segregation), а не от всей конфигурации;
- в тестах достаточно `Options.Create(new SmtpOptions { ... })`.

**Возможности:**

- **Валидация:** `ValidateDataAnnotations()`, `Validate(o => o.Port != 0, "message")`, собственный `IValidateOptions<T>`; в .NET 8 есть source generator `[OptionsValidator]` для валидации без рефлексии.
- **Post-configure:** `Configure<T>(o => ...)` и `PostConfigure<T>(...)` позволяют дополнить значения кодом после привязки.
- **Named options:** несколько экземпляров одного типа — `Configure<SmtpOptions>("marketing", section)`, получение через `IOptionsMonitor<T>.Get("marketing")`.
- **Перезагрузка:** `IOptionsSnapshot<T>` и `IOptionsMonitor<T>` видят изменения `appsettings.json` без перезапуска, `IOptions<T>` — нет.

**Подводные камни:**

- Имена свойств должны совпадать с ключами (регистр не важен); опечатка в JSON просто даёт значение по умолчанию, без ошибки — поэтому валидация важна.
- Без `ValidateOnStart` валидация выполняется лениво, при первом обращении к `.Value`.
- Привязка требует публичного сеттера или `init`; в .NET 8 есть source generator для binder'а (нужен для Native AOT).

## Что такое `IOptions`, `IOptionsSnapshot` и `IOptionsMonitor`?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-ioptions-ioptionssnapshot-i-ioptionsmonitor
tags: synchronization, observability
```

Это три способа получить настроенный через options pattern объект. Они отличаются временем жизни и тем, видят ли изменения конфигурации: `IOptions<T>` вычисляется один раз, `IOptionsSnapshot<T>` — один раз на запрос, `IOptionsMonitor<T>` всегда отдаёт актуальное значение и умеет уведомлять об изменениях.

| | `IOptions<T>` | `IOptionsSnapshot<T>` | `IOptionsMonitor<T>` |
| --- | --- | --- | --- |
| Lifetime | singleton | scoped | singleton |
| Перезагрузка без рестарта | нет | да, со следующего запроса | да, сразу |
| Named options | нет (только default) | `Get(name)` | `Get(name)` |
| Уведомление об изменении | нет | нет | `OnChange(...)` |
| Можно внедрять в singleton | да | нет | да |
| Доступ к значению | `.Value` | `.Value` / `.Get(name)` | `.CurrentValue` / `.Get(name)` |

```csharp
// Singleton-сервис, которому нужны свежие настройки
public sealed class FeatureGate : IDisposable
{
    private readonly IDisposable? _sub;
    private volatile FeatureOptions _current;

    public FeatureGate(IOptionsMonitor<FeatureOptions> monitor)
    {
        _current = monitor.CurrentValue;
        _sub = monitor.OnChange(o => _current = o);   // вызовется при изменении файла
    }

    public bool IsOn(string name) => _current.Enabled.Contains(name);
    public void Dispose() => _sub?.Dispose();
}
```

**Когда что брать:**

- **`IOptions<T>`** — настройки, которые не меняются в рантайме: строки подключения, адреса, лимиты. Самый дешёвый вариант.
- **`IOptionsSnapshot<T>`** — нужны свежие значения в scoped/transient-сервисе, и важно, чтобы в рамках одного запроса они не поменялись посередине. Минус: объект пересоздаётся (и валидируется) на каждый запрос, что заметно в горячем пути.
- **`IOptionsMonitor<T>`** — singleton-сервисы и фоновые воркеры, которым нужны изменения, или нужно реагировать на них (пересоздать клиент, сбросить кэш).

**Откуда берутся изменения.** Перезагрузка работает, только если провайдер конфигурации её поддерживает: JSON-файлы добавлены с `reloadOnChange: true` (так по умолчанию в `WebApplication`), Azure App Configuration и т.п. Переменные окружения и аргументы командной строки в рантайме не меняются.

**Подводные камни:**

- `OnChange` может сработать несколько раз на одно сохранение файла — обработчик должен быть идемпотентным.
- Внедрение `IOptionsSnapshot<T>` в singleton — ошибка lifetime (scoped в singleton).
- `IOptions<T>.Value` кэшируется навсегда: изменили `appsettings.json` в контейнере — сервис этого не увидит.
- Невалидные новые значения при перезагрузке приведут к `OptionsValidationException` при следующем обращении.

## Как устроена конфигурация ASP.NET Core?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-ustroena-konfiguraciya-asp-net-core
```

Конфигурация в ASP.NET Core — это плоский словарь «ключ → строковое значение», собранный из нескольких провайдеров по порядку. Более поздний провайдер переопределяет значения более раннего. Иерархия ключей выражается через двоеточие: `ConnectionStrings:Default`, `Smtp:Port`.

**Источники по умолчанию** в `WebApplication.CreateBuilder` (в порядке добавления, последний побеждает):

1. `appsettings.json`
2. `appsettings.{Environment}.json` — например, `appsettings.Production.json`
3. User secrets — только в окружении `Development`
4. Переменные окружения
5. Аргументы командной строки

Плюс до них — переменные с префиксом `ASPNETCORE_` и `DOTNET_` для настроек хоста (окружение, URL).

```csharp
var builder = WebApplication.CreateBuilder(args);

// добавить свой источник поверх стандартных
builder.Configuration.AddJsonFile("features.json", optional: true, reloadOnChange: true);

string? cs   = builder.Configuration.GetConnectionString("Default");
int port     = builder.Configuration.GetValue<int>("Smtp:Port");
var section  = builder.Configuration.GetSection("Smtp");
var settings = section.Get<SmtpOptions>();
```

**Переопределение через окружение.** Двоеточие в имени переменной на Linux недопустимо, поэтому используется двойное подчёркивание: `Smtp__Port=2525` переопределит `Smtp:Port`. Массивы задаются индексами: `AllowedHosts__0`. Это основной способ конфигурировать приложение в Docker и Kubernetes.

**Устройство внутри:**

- `IConfigurationBuilder` собирает список `IConfigurationSource`;
- каждый источник создаёт `IConfigurationProvider`, который хранит свои пары ключ-значение;
- `IConfigurationRoot` при чтении ключа опрашивает провайдеры с конца — первый нашедший значение побеждает;
- ключи регистронезависимы, значения всегда строки — типизация делается при привязке.

**Другие провайдеры:** Azure Key Vault, Azure App Configuration, AWS Parameter Store (через пакет AWS), key-per-file (секреты Kubernetes, смонтированные файлами), INI, XML, in-memory (удобно в тестах).

**`IConfiguration` vs options.** Читать `IConfiguration` напрямую в сервисах можно, но лучше привязать секцию к классу через options pattern — будет типизация и валидация.

**Частые ошибки:**

- Ожидать, что `appsettings.Development.json` применится в проде: окружение определяется `ASPNETCORE_ENVIRONMENT` (по умолчанию `Production`).
- Класть секреты в `appsettings.json` и коммитить их.
- Забыть, что переменная окружения тихо перебивает значение из файла, — при отладке «почему не то значение» смотрите `builder.Configuration.GetDebugView()`.

## Как работает logging?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-rabotaet-logging
tags: indexes, observability
```

Логирование в ASP.NET Core построено на абстракции `Microsoft.Extensions.Logging`: код пишет в `ILogger<T>`, а куда уйдут сообщения, решают подключённые провайдеры (консоль, Debug, EventSource, OpenTelemetry, Serilog и т.д.). Между ними стоит фильтрация по категории и уровню, настраиваемая через конфигурацию.

```csharp
public sealed class OrderService(ILogger<OrderService> logger)
{
    public void Place(Order order)
    {
        logger.LogInformation("Order {OrderId} placed by {UserId}", order.Id, order.UserId);
    }
}
```

**Составные части:**

- **`ILogger<T>`** — логгер с категорией, равной полному имени типа `T`. Внедряется через DI.
- **`ILoggerFactory`** — создаёт логгеры с произвольной категорией: `factory.CreateLogger("Payments")`.
- **`ILoggerProvider`** — приёмник. Один вызов `LogInformation` уходит во все провайдеры, которые пропустили его по фильтру.
- **Уровни:** `Trace`, `Debug`, `Information`, `Warning`, `Error`, `Critical`, плюс `None` для отключения.
- **Scopes:** `using (logger.BeginScope(...))` добавляет контекст (например, `TraceId`, `OrderId`) ко всем сообщениям внутри блока.

**Провайдеры по умолчанию** в `WebApplication`: Console, Debug, EventSource, а на Windows ещё EventLog.

**Фильтрация через конфигурацию:**

```json
"Logging": {
  "LogLevel": {
    "Default": "Information",
    "Microsoft.AspNetCore": "Warning",
    "Microsoft.EntityFrameworkCore.Database.Command": "Information"
  },
  "Console": { "LogLevel": { "Default": "Warning" } }
}
```

Категория матчится по самому длинному префиксу, настройки конкретного провайдера важнее общих.

**Производительность.** Каждый вызов `LogInformation(...)` с аргументами-значимыми типами упаковывает их в `object[]`, даже если уровень выключен. В горячем пути используют source generator:

```csharp
public static partial class Log
{
    [LoggerMessage(Level = LogLevel.Information, Message = "Order {OrderId} placed")]
    public static partial void OrderPlaced(ILogger logger, int orderId);
}
```

Он генерирует код с проверкой `IsEnabled` и без боксинга. Для дорогих аргументов проверяйте `logger.IsEnabled(LogLevel.Debug)` вручную.

**Ошибки, о которых спрашивают:**

- интерполяция строк `$"Order {id}"` вместо шаблона — теряется структура и кэширование шаблона;
- логирование исключения как текста вместо перегрузки `LogError(ex, "...")`;
- синхронный провайдер на медленный приёмник — логирование начинает тормозить запросы (консольный логгер в .NET использует очередь, но и её можно переполнить);
- логирование персональных данных и токенов.

## Что такое structured logging?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-structured-logging
tags: value-types, indexes, observability
```

Structured logging — это логирование событий как набора именованных полей, а не просто строки текста. Сообщение хранится вместе с шаблоном и значениями параметров, поэтому по логам можно фильтровать и агрегировать: «все ошибки для `OrderId = 42`», «среднее `ElapsedMs` по эндпоинту».

```csharp
// Структурно: шаблон + свойства OrderId и ElapsedMs
logger.LogInformation("Order {OrderId} processed in {ElapsedMs} ms", order.Id, sw.ElapsedMilliseconds);

// Неструктурно: в хранилище попадёт только готовая строка
logger.LogInformation($"Order {order.Id} processed in {sw.ElapsedMilliseconds} ms");
```

В JSON-приёмнике первое событие выглядит примерно так:

```json
{
  "Timestamp": "2026-09-28T10:15:03Z",
  "Level": "Information",
  "MessageTemplate": "Order {OrderId} processed in {ElapsedMs} ms",
  "OrderId": 42,
  "ElapsedMs": 118,
  "TraceId": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

**Что это даёт:**

- поиск и фильтрация по полю без регулярок: `OrderId = 42`;
- группировка по шаблону: все экземпляры одного события объединяются, даже если значения разные;
- метрики и дашборды прямо из логов;
- корреляция с трейсами по `TraceId`/`SpanId`.

**Правила шаблонов:**

- Плейсхолдеры сопоставляются с аргументами **по позиции**, а не по имени.
- Имена полей — в PascalCase и одинаковые по всему коду (`UserId`, а не то `userId`, то `User`), иначе запросы в хранилище ломаются.
- Префикс `@` (`{@Order}`) в Serilog означает деструктуризацию объекта, в стандартном `ILogger` объект будет просто приведён к строке.
- Не используйте интерполяцию `$"..."`: теряется структура, а строка собирается даже при выключенном уровне.

**Контекст для всех сообщений** добавляется через scopes (`BeginScope`) или обогатители (enrichers в Serilog): correlation id, тенант, пользователь. Для консоли в JSON есть встроенный форматтер `builder.Logging.AddJsonConsole()`.

**Куда отправлять:** Seq, Elasticsearch/OpenSearch, Grafana Loki, Application Insights или OpenTelemetry Collector. Serilog и NLog — популярные библиотеки с богатым набором sink'ов, подключаются как провайдеры `ILogger`.

Минус — объём: каждое поле хранится и индексируется, поэтому высококардинальные поля и логирование каждого запроса на уровне `Information` быстро становятся дорогими.

## Что такое Controller?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-controller
tags: api-design
```

Controller — класс в ASP.NET Core MVC, группирующий связанные обработчики HTTP-запросов (actions). Каждый публичный метод-action сопоставляется с маршрутом, получает данные через model binding и возвращает результат, который фреймворк превращает в HTTP-ответ.

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

**`ControllerBase` vs `Controller`.** `ControllerBase` — база для API: хелперы `Ok`, `NotFound`, `BadRequest`, `CreatedAtAction`, `Problem`, доступ к `User`, `HttpContext`, `ModelState`. `Controller` наследует его и добавляет поддержку представлений (`View`, `ViewBag`, `TempData`) — для MVC с Razor. Для Web API наследуйтесь от `ControllerBase`.

**Что даёт атрибут `[ApiController]`:**

- обязательный attribute routing;
- автоматический ответ `400` с `ValidationProblemDetails`, если `ModelState` невалиден, — action даже не вызывается;
- вывод источников привязки: сложные типы — из тела, `id` из маршрута, `IFormFile` — из формы;
- `ProblemDetails` для ошибочных статус-кодов.

**Жизненный цикл.** Контроллер создаётся заново на каждый запрос (через `ActivatorUtilities`, зависимости берутся из DI). Хранить состояние в полях между запросами нельзя — и не нужно.

**Возвращаемые типы:** конкретный тип (`OrderDto`) → 200 с JSON; `IActionResult` — любой результат; `ActionResult<T>` — и то и другое, плюс корректные метаданные для OpenAPI.

**Хорошая практика:** держать контроллеры тонкими — только HTTP-логика (маршрут, статусы, маппинг), бизнес-логику выносить в сервисы или обработчики. Контроллер на 2000 строк с десятком зависимостей в конструкторе — частая проблема, из-за которой все эти зависимости создаются даже для простейшего action.

## Что такое Minimal API?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-minimal-api
tags: api-design
```

Minimal API — способ описывать HTTP-эндпоинты прямо как лямбды или методы через `app.MapGet/MapPost/...`, без контроллеров и MVC. Появились в .NET 6; с .NET 7–8 получили группы маршрутов, фильтры, `TypedResults`, поддержку Native AOT и стали полноценной альтернативой контроллерам.

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddProblemDetails();
var app = builder.Build();

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

app.Run();
```

**Как параметры получают значения.** Без атрибутов, по правилам вывода: параметры из шаблона маршрута — из route, простые типы — из query, зарегистрированные в DI — из контейнера, `HttpContext`, `CancellationToken`, `ClaimsPrincipal` — специальные, сложный тип — из JSON-тела. Явно: `[FromRoute]`, `[FromQuery]`, `[FromHeader]`, `[FromBody]`, `[FromServices]`, `[AsParameters]` для группировки в класс.

**Ключевые возможности:**

- **`MapGroup`** — общий префикс, авторизация, фильтры, теги для группы.
- **`TypedResults` и `Results<T1, T2>`** — типизированные результаты: удобно тестировать и OpenAPI знает все возможные ответы без атрибутов.
- **Endpoint filters** (`AddEndpointFilter`) — аналог action filters.
- **Метаданные:** `.WithName()`, `.Produces<T>()`, `.RequireRateLimiting()`, `.CacheOutput()`.
- **Валидация:** до .NET 10 — вручную или через FluentValidation в фильтре; в .NET 10 появилась встроенная валидация DataAnnotations (`builder.Services.AddValidation()`).

**Под капотом.** `RequestDelegateFactory` генерирует для каждого обработчика оптимизированный `RequestDelegate`, с парсингом параметров и сериализацией результата. Для AOT есть Request Delegate Generator — source generator, который делает то же на этапе компиляции.

**Почему выбирают:** меньше церемоний и кода, чуть меньше накладных расходов, чем у MVC, AOT-совместимость, удобно для микросервисов и vertical slice. Главный риск — «всё в `Program.cs`»: эндпоинты стоит выносить в extension-методы или модули по фичам.

## Controller vs Minimal API?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-controller-vs-minimal-api
tags: api-design
```

Оба подхода работают поверх одного и того же endpoint routing, одного пайплайна middleware и одной модели аутентификации — разница в том, как описываются обработчики и какая инфраструктура вокруг них. Контроллеры — это MVC с конвенциями, фильтрами и model binding'ом на провайдерах; Minimal API — функции, для которых фреймворк генерирует лёгкий `RequestDelegate`.

| | Controllers | Minimal API |
| --- | --- | --- |
| Организация | классы, наследование, атрибуты | лямбды/методы, `MapGroup` |
| Фильтры | 5 типов MVC-фильтров | endpoint filters (`IEndpointFilter`) |
| Валидация | автоматическая с `[ApiController]` | встроенная с .NET 10 (`AddValidation`), раньше — вручную |
| Model binding | расширяемый: `IModelBinder`, value providers | фиксированные правила, `TryParse`/`BindAsync` на типе |
| Form-binding, `IFormFile` | давно | поддерживается с .NET 7–8 |
| Конвенции, `ApplicationModel` | есть | нет |
| Native AOT | не поддерживается | поддерживается |
| Накладные расходы | больше (MVC-инфраструктура) | меньше |
| OpenAPI | через атрибуты `ProducesResponseType` | через `TypedResults`/`Results<...>` автоматически |

```csharp
// Контроллер
[HttpGet("{id}")]
public async Task<ActionResult<UserDto>> Get(int id) =>
    await _users.FindAsync(id) is { } u ? Ok(u) : NotFound();

// Minimal API
app.MapGet("/users/{id}", async Task<Results<Ok<UserDto>, NotFound>> (int id, IUserService users) =>
    await users.FindAsync(id) is { } u ? TypedResults.Ok(u) : TypedResults.NotFound());
```

**Когда контроллеры:**

- большой существующий проект на MVC, команда привыкла к нему;
- нужны возможности MVC, которых нет в Minimal API: кастомные model binders и value providers, application model conventions, `JsonPatch` через `Newtonsoft`, OData;
- много фильтров со сложным порядком и resource/result filters.

**Когда Minimal API:**

- новые сервисы, микросервисы, vertical slice-архитектура;
- важны старт и память, нужен Native AOT;
- хочется явных зависимостей на уровне каждого эндпоинта, а не общего конструктора контроллера.

**Про производительность.** Minimal API быстрее на бенчмарках, но на реальном сервисе с базой данных разница обычно теряется на фоне I/O. Выбирать стоит по удобству и возможностям, а не по микросекундам.

**Можно совмещать** в одном приложении: `AddControllers()` + `MapControllers()` рядом с `MapGet`. Частая ошибка в Minimal API — отсутствие структуры; решается группировкой эндпоинтов в статические классы с extension-методами `MapOrderEndpoints(this IEndpointRouteBuilder app)`.

## Что такое routing?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-routing
tags: api-design
```

Routing — механизм, который сопоставляет входящий запрос (путь, HTTP-метод, иногда хост и заголовки) с конкретным endpoint'ом и извлекает из URL значения параметров. В ASP.NET Core это endpoint routing: один механизм для контроллеров, Minimal API, Razor Pages, SignalR, gRPC и health checks.

**Две фазы.**

1. `UseRouting` (`EndpointRoutingMiddleware`) выбирает endpoint и кладёт его в `HttpContext` вместе с route values.
2. Endpoint middleware в конце пайплайна вызывает его обработчик.

Между ними работают CORS, аутентификация, авторизация, rate limiting — и уже знают, какой endpoint выбран и какие у него метаданные (`[Authorize]`, политики).

```csharp
app.MapGet("/products/{id:int}", (int id) => ...);             // constraint: только int
app.MapGet("/products/{slug}", (string slug) => ...);          // любой сегмент
app.MapGet("/files/{**path}", (string path) => ...);           // catch-all
app.MapGet("/search/{page:int:min(1)=1}", (int page) => ...);  // default value

[Route("api/[controller]")]                                    // attribute routing
public class OrdersController : ControllerBase
{
    [HttpGet("{id:guid}")] public IActionResult Get(Guid id) => Ok();
}
```

**Элементы шаблона:**

- `{id}` — параметр, `{id?}` — необязательный, `{id=5}` — со значением по умолчанию;
- constraints: `int`, `guid`, `bool`, `datetime`, `min(1)`, `length(3,20)`, `regex(...)`, `alpha`;
- `{*path}` / `{**path}` — catch-all до конца URL;
- токены `[controller]`, `[action]` в attribute routing.

**Attribute vs conventional routing.** Для API используется attribute routing: маршрут описан рядом с action. Conventional (`MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}")`) — для классического MVC с представлениями.

**Как выбирается маршрут при конфликте.** Маршрутизатор ранжирует кандидатов: литеральные сегменты важнее параметров, параметры с constraint важнее без него, catch-all — самый низкий приоритет. Если после этого остаются два равных кандидата — `AmbiguousMatchException`.

**Что стоит знать:**

- Constraints — не валидация. `{id:int}` при `/products/abc` даст 404, а не 400. Для проверки бизнес-правил используйте валидацию модели.
- Генерация ссылок: `LinkGenerator`, `CreatedAtAction`, `CreatedAtRoute` строят URL из имени маршрута, не хардкодя путь.
- Регистр пути по умолчанию не важен.
- `context.GetEndpoint()` в middleware после `UseRouting` позволяет читать метаданные endpoint'а.

## Что такое model binding?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-model-binding
tags: api-design
```

Model binding — механизм, который берёт данные из HTTP-запроса (маршрут, query string, заголовки, форма, тело) и превращает их в типизированные параметры action или обработчика Minimal API. Вместо ручного `Request.Query["page"]` и парсинга вы просто объявляете `int page`.

```csharp
[HttpGet("{id:int}")]
public IActionResult Get(
    [FromRoute] int id,
    [FromQuery] int page,
    [FromHeader(Name = "X-Tenant")] string tenant,
    [FromServices] IClock clock) => Ok();

[HttpPost]
public IActionResult Create([FromBody] CreateOrderRequest request) => Ok();
```

**Источники и атрибуты:**

| Атрибут | Откуда |
| --- | --- |
| `[FromRoute]` | значения из шаблона маршрута |
| `[FromQuery]` | query string |
| `[FromHeader]` | заголовки |
| `[FromForm]` | `application/x-www-form-urlencoded`, `multipart/form-data` |
| `[FromBody]` | тело запроса, десериализуется форматтером (JSON) |
| `[FromServices]` | DI-контейнер |

**Вывод источника без атрибутов** (с `[ApiController]` и в Minimal API): сложный тип — из тела, параметр, совпадающий с именем в шаблоне маршрута, — из route, остальные простые типы — из query, `IFormFile` — из формы, зарегистрированный в DI тип — из сервисов.

**Правила, о которых спрашивают:**

- **Тело читается один раз.** Параметр `[FromBody]` может быть только один: поток тела не перематывается. Нужно больше — объединяйте в одну модель.
- **Без `[ApiController]` в контроллерах** сложный тип по умолчанию собирается из формы/query/route, а не из JSON-тела — классическая причина «приходит пустой объект».
- **Ошибки конвертации не бросают исключение** в MVC: параметр получает значение по умолчанию, а ошибка пишется в `ModelState`. С `[ApiController]` это даст автоматический 400. В Minimal API неудачный парсинг даёт 400 сразу.
- **Nullable reference types.** В Minimal API ненулевой `string q` делает query-параметр обязательным: без него будет 400. `string? q` — необязательный.

**Расширение:**

- в Minimal API: статический `TryParse` (для простых типов из route/query) или `BindAsync(HttpContext, ParameterInfo)` на своём типе, `[AsParameters]` для сбора параметров в класс;
- в MVC: `IModelBinder` / `IModelBinderProvider`, value providers.

**Безопасность — overposting.** Если биндить тело прямо в сущность EF, клиент может прислать `IsAdmin: true`. Используйте отдельные DTO на вход с только разрешёнными полями.

## Что такое model validation?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-model-validation
```

Model validation — проверка того, что данные, полученные через model binding, соответствуют правилам: обязательные поля, диапазоны, форматы. В MVC она выполняется автоматически после привязки, результат попадает в `ModelState`, а с `[ApiController]` невалидная модель сразу даёт ответ `400` с `ValidationProblemDetails`.

```csharp
public sealed record CreateUserRequest(
    [Required, StringLength(50, MinimumLength = 2)] string Name,
    [Required, EmailAddress] string Email,
    [Range(18, 120)] int Age);

[ApiController, Route("api/users")]
public class UsersController : ControllerBase
{
    [HttpPost]
    public IActionResult Create(CreateUserRequest request) => Ok(); // сюда попадёт только валидная модель
}
```

Ответ при ошибке:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": { "Email": ["The Email field is not a valid e-mail address."] }
}
```

**Способы задать правила:**

- **DataAnnotations:** `[Required]`, `[Range]`, `[StringLength]`, `[RegularExpression]`, `[EmailAddress]`, собственные `ValidationAttribute`.
- **`IValidatableObject`** — метод `Validate` для правил, затрагивающих несколько полей (дата окончания позже даты начала).
- **FluentValidation** — популярная библиотека: правила в отдельных классах, легко тестируются, поддерживают асинхронные проверки. Автоматическую интеграцию с MVC её авторы больше не рекомендуют, обычно валидатор вызывают явно или в фильтре.

**Minimal API.** До .NET 10 автоматической валидации не было — вызывали валидатор вручную или в endpoint filter и возвращали `Results.ValidationProblem(errors)`. В .NET 10 появилась встроенная поддержка DataAnnotations: `builder.Services.AddValidation()`, и параметры проверяются до вызова обработчика.

**Что важно понимать:**

- **Валидация формата ≠ бизнес-правила.** «Email уникален», «товар есть на складе» — это логика домена, ей место в сервисе, а не в атрибутах.
- **Nullable reference types.** В MVC ненулевые `string`-свойства считаются обязательными — неожиданный 400 для полей, которые вы не помечали `[Required]`.
- **Без `[ApiController]`** нужно самому проверять `if (!ModelState.IsValid) return ValidationProblem(ModelState);`.
- **Кастомизация ответа** — через `ApiBehaviorOptions.InvalidModelStateResponseFactory` или отключение автоматического поведения `SuppressModelStateInvalidFilter`.
- Клиентской валидации доверять нельзя — серверная обязательна всегда.

## Что такое action filter?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-action-filter
tags: middleware
```

Action filter — фильтр MVC, который выполняется непосредственно до и после вызова action-метода контроллера, когда model binding уже прошёл. Он видит аргументы action, `ModelState`, сам контроллер и результат, и может подменить результат, не вызывая action.

```csharp
public sealed class ValidateTenantFilter(ITenantService tenants) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        // до action: аргументы уже привязаны
        if (context.ActionArguments.TryGetValue("tenantId", out var id)
            && !await tenants.ExistsAsync((int)id!))
        {
            context.Result = new NotFoundResult();   // short-circuit: action не вызовется
            return;
        }

        var executed = await next();                  // вызов action

        // после action
        if (executed.Exception is null && executed.Result is ObjectResult)
            context.HttpContext.Response.Headers["X-Tenant-Checked"] = "1";
    }
}
```

**Интерфейсы и базовые классы:**

- `IActionFilter` — синхронные `OnActionExecuting` / `OnActionExecuted`;
- `IAsyncActionFilter` — один метод с `next`, как у middleware; реализуйте что-то одно, не оба;
- `ActionFilterAttribute` — базовый атрибут, реализующий и action-, и result-фильтр.

**Регистрация и область действия:**

```csharp
builder.Services.AddControllers(o => o.Filters.Add<AuditFilter>());   // глобально

[ServiceFilter<ValidateTenantFilter>]   // из DI (нужна регистрация), на контроллер или action
[TypeFilter<ValidateTenantFilter>]      // создаётся через ActivatorUtilities, регистрация не нужна
```

Обычный атрибут-фильтр не может получать зависимости через конструктор — атрибуты создаёт рефлексия, а не контейнер. Поэтому для фильтров с зависимостями используют `ServiceFilter`/`TypeFilter` или `IFilterFactory`.

**Порядок:** глобальные → контроллер → action на входе, обратный на выходе. Можно изменить через `Order` (`IOrderedFilter`).

**Типичные применения:**

- проверка `ModelState` (то, что делает `[ApiController]` автоматически);
- аудит и логирование с доступом к аргументам;
- проверка доступа к конкретному ресурсу по аргументу;
- обёртка транзакции вокруг action.

**Чем action filter не является:** он срабатывает только для MVC-контроллеров и Razor Pages (там свой `IPageFilter`). Для Minimal API аналог — endpoint filter (`IEndpointFilter`). И он не видит исключения из model binding и авторизации — они происходят до него.

## Какие бывают filters в ASP.NET Core?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-kakie-byvayut-filters-v-asp-net-core
tags: middleware
```

В MVC есть пять типов фильтров, каждый срабатывает на своём этапе обработки action: authorization, resource, action, exception и result. Для Minimal API существует отдельный механизм — endpoint filters.

**Порядок выполнения внутри MVC:**

```text
Authorization filters
  → Resource filters (до)
      → model binding
      → Action filters (до) → ACTION → Action filters (после)
      → Result filters (до) → выполнение результата → Result filters (после)
  → Resource filters (после)
Exception filters — при исключении в создании контроллера, binding, action filters, action
```

| Тип | Интерфейс | Когда | Для чего |
| --- | --- | --- | --- |
| Authorization | `IAuthorizationFilter`, `IAsyncAuthorizationFilter` | первыми | проверка доступа; сейчас лучше policies |
| Resource | `IResourceFilter`, `IAsyncResourceFilter` | до model binding и после всего | кэширование, отключение binding'а формы для загрузки больших файлов |
| Action | `IActionFilter`, `IAsyncActionFilter` | вокруг action | аргументы, `ModelState`, аудит |
| Exception | `IExceptionFilter`, `IAsyncExceptionFilter` | при необработанном исключении | превращение исключений в ответы на уровне MVC |
| Result | `IResultFilter`, `IAsyncResultFilter` | вокруг выполнения `IActionResult` | заголовки, обёртка ответа |

Также есть `IAlwaysRunResultFilter` — result filter, который срабатывает даже при short-circuit в других фильтрах, и `IPageFilter` для Razor Pages.

**Endpoint filters (Minimal API, .NET 7+):**

```csharp
app.MapPost("/orders", (CreateOrder cmd) => TypedResults.Ok())
   .AddEndpointFilter(async (ctx, next) =>
   {
       var cmd = ctx.GetArgument<CreateOrder>(0);
       if (cmd.Quantity <= 0)
           return TypedResults.ValidationProblem(new Dictionary<string, string[]>
               { ["Quantity"] = ["Must be positive"] });
       return await next(ctx);
   });
```

Работают как middleware, но на уровне конкретного endpoint'а и с доступом к аргументам обработчика. Регистрируются на эндпоинт или группу (`MapGroup(...).AddEndpointFilter<T>()`).

**Scope и порядок.** Фильтры можно повесить глобально, на контроллер и на action. На входе порядок: global → controller → action, на выходе — обратный. Свойство `Order` переопределяет это.

**Нюансы, которые спрашивают:**

- Exception filters не ловят исключения из result filters и выполнения результата, а также из middleware — для глобальной обработки используйте `UseExceptionHandler`/`IExceptionHandler`.
- Если resource или action filter выставил `context.Result`, action не вызывается, но result filters выполняются для этого результата.
- Фильтры-атрибуты не поддерживают DI в конструкторе — используйте `ServiceFilter`, `TypeFilter` или `IFilterFactory`.

## Middleware vs Filter — в чём разница?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-middleware-vs-filter-v-chem-raznica
tags: middleware
```

Middleware работает на уровне всего HTTP-пайплайна и видит только `HttpContext`, а фильтр работает внутри MVC (или внутри конкретного endpoint'а Minimal API) и видит контекст action: аргументы после model binding, `ModelState`, метаданные action, `IActionResult`. Проще говоря, middleware — про HTTP, фильтры — про вызов конкретного обработчика.

| | Middleware | MVC-фильтр |
| --- | --- | --- |
| Уровень | весь пайплайн, все запросы | только запросы к контроллерам/Razor Pages |
| Что видит | `HttpContext` | `ActionContext`: аргументы, `ModelState`, дескриптор action, результат |
| Где настраивается | `Program.cs`, порядок регистрации | глобально, на контроллер, на action |
| Статические файлы, health checks, gRPC | да | нет |
| Работа с результатом | только с потоком ответа | с объектом `IActionResult` до сериализации |
| DI | конструктор (singleton) или `InvokeAsync`, `IMiddleware` | `ServiceFilter`, `TypeFilter`, `IFilterFactory` |

```csharp
// Middleware: ничего не знает про action, только про HTTP
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    await next(ctx);
});

// Action filter: знает аргументы и результат action
public class AuditFilter(IAuditLog log) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var result = await next();
        await log.WriteAsync(ctx.ActionDescriptor.DisplayName, ctx.ActionArguments);
    }
}
```

**Когда что выбирать:**

- **Middleware** — сквозная HTTP-логика для всех запросов: обработка исключений, заголовки безопасности, correlation id, логирование запросов, CORS, сжатие, rate limiting.
- **Фильтр** — логика, которой нужен контекст MVC: проверка `ModelState`, аудит с аргументами, модификация `ObjectResult` перед сериализацией, логика, применяемая выборочно к отдельным контроллерам по атрибуту.

**Серая зона.** Middleware после `UseRouting` тоже может выборочно срабатывать: читает `ctx.GetEndpoint()?.Metadata.GetMetadata<MyAttribute>()`. Так устроены встроенные авторизация, CORS и rate limiting. Это удобно, если логика должна работать и для контроллеров, и для Minimal API одинаково.

**Про исключения.** Exception filter ловит только исключения внутри MVC-конвейера и не видит ошибок сериализации результата и middleware. Глобальную обработку ошибок лучше делать в `UseExceptionHandler` с `IExceptionHandler` — она покрывает всё приложение.

**Производительность:** middleware выполняется для каждого запроса, включая статику, — тяжёлую логику, нужную только API, лучше ограничить через `UseWhen` или сделать фильтром.

## Authentication vs Authorization?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-authentication-vs-authorization
tags: security
```

Authentication отвечает на вопрос «кто ты?» — устанавливает личность пользователя по cookie, токену или сертификату. Authorization отвечает на вопрос «что тебе можно?» — решает, разрешено ли уже известному пользователю выполнить конкретное действие.

| | Authentication | Authorization |
| --- | --- | --- |
| Вопрос | кто это? | можно ли ему? |
| Результат | `ClaimsPrincipal` в `HttpContext.User` | разрешить / запретить |
| Middleware | `UseAuthentication` | `UseAuthorization` |
| Ошибка | `401 Unauthorized` — не удалось аутентифицировать | `403 Forbidden` — известен, но нельзя |
| Настройка | схемы: JWT Bearer, Cookies, OpenID Connect | `[Authorize]`, роли, политики, requirements |

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.Authority = "https://login.example.com";
        o.Audience  = "orders-api";
    });

builder.Services.AddAuthorization(o =>
    o.AddPolicy("CanRefund", p => p.RequireClaim("permission", "orders:refund")));

app.UseAuthentication();
app.UseAuthorization();

app.MapPost("/orders/{id}/refund", (int id) => Results.Ok())
   .RequireAuthorization("CanRefund");
```

**Как это работает в ASP.NET Core:**

1. `UseAuthentication` вызывает схему по умолчанию: она читает токен или cookie, проверяет его и заполняет `HttpContext.User`. Если данных нет — пользователь просто анонимный, запрос идёт дальше.
2. `UseAuthorization` смотрит метаданные выбранного endpoint'а (`[Authorize]`, `RequireAuthorization`), вычисляет политику и проверяет её для `HttpContext.User`.
3. Если пользователь анонимный — вызывается **challenge** схемы (для JWT это 401 с заголовком `WWW-Authenticate`, для cookies — редирект на логин). Если аутентифицирован, но не проходит политику — **forbid** (403 или редирект на AccessDenied).

**Про названия статусов.** `401 Unauthorized` исторически назван неудачно — по смыслу это «unauthenticated». Для «доступ запрещён» — именно 403.

**Что проверяют на собеседовании:**

- Порядок: `UseAuthentication` до `UseAuthorization`, обе после `UseRouting`.
- Аутентификация сама по себе ничего не запрещает — без `[Authorize]` или `FallbackPolicy` анонимный пользователь проходит везде. Для закрытия всего API по умолчанию: `o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build()`.
- Resource-based authorization («может ли пользователь редактировать **этот** документ») делается через `IAuthorizationService.AuthorizeAsync(User, document, "EditPolicy")` внутри обработчика, потому что ресурс известен только после загрузки.
- Несколько схем (cookie для UI + JWT для API) выбираются через `[Authorize(AuthenticationSchemes = ...)]` или policy scheme.

## Как работает JWT authentication?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-rabotaet-jwt-authentication
tags: security
```

JWT authentication — схема, при которой клиент после логина получает подписанный токен и отправляет его в каждом запросе в заголовке `Authorization: Bearer <token>`. Сервер не хранит сессию: он проверяет подпись и срок действия токена и берёт из него данные о пользователе (claims).

**Устройство токена.** JWT — три части в Base64Url через точку: `header.payload.signature`.

```json
// header
{ "alg": "RS256", "typ": "JWT", "kid": "2026-key-1" }
// payload
{
  "iss": "https://login.example.com",
  "aud": "orders-api",
  "sub": "user-42",
  "exp": 1790000000,
  "role": "admin",
  "scope": "orders.read orders.write"
}
```

Подпись вычисляется от header и payload ключом издателя. Payload **не зашифрован** — его может прочитать любой. JWT защищён от подделки, но не от чтения, поэтому секретов в нём быть не должно.

**Поток:**

1. Клиент аутентифицируется у identity provider (свой endpoint логина, Keycloak, Entra ID, Auth0) и получает access token (часто ещё refresh token).
2. Клиент вызывает API с `Authorization: Bearer eyJ...`.
3. Middleware JWT Bearer проверяет подпись, `iss`, `aud`, `exp`/`nbf` и создаёт `ClaimsPrincipal`.
4. Авторизация проверяет claims против политики.

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.Authority = "https://login.example.com";   // ключи берутся из OIDC discovery
        o.Audience  = "orders-api";
    });
```

**Симметричная vs асимметричная подпись.** `HS256` — один общий секрет: кто может проверить токен, тот может и выпустить. `RS256`/`ES256` — издатель подписывает приватным ключом, API проверяют публичным (по `kid` из JWKS). Для нескольких сервисов асимметричная — единственный разумный вариант.

**Плюсы и минусы:**

- **Stateless** — не нужен общий session store, легко масштабировать, удобно для микросервисов.
- **Нельзя отозвать** до истечения `exp`. Поэтому access token делают короткоживущим (5–15 минут), а refresh token — долгоживущим, хранимым на сервере и отзываемым.
- Токен большой, передаётся в каждом запросе.

**Типичные ошибки:**

- хранить токен в `localStorage` в SPA — доступен любому XSS; альтернатива — BFF-паттерн с httpOnly-cookie;
- отключать проверку `aud` или `iss` «чтобы заработало»;
- принимать `alg: none` или позволять токену самому выбирать алгоритм (современные библиотеки это блокируют);
- длинный срок жизни access token без механизма отзыва;
- класть в токен всё подряд — роли, права, персональные данные.

## Где и как проверяется JWT?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-gde-i-kak-proveryaetsya-jwt
tags: security
```

JWT проверяется в authentication middleware (`UseAuthentication`), который вызывает обработчик схемы `JwtBearerHandler` из пакета `Microsoft.AspNetCore.Authentication.JwtBearer`. Тот достаёт токен из заголовка `Authorization`, валидирует подпись и claims по `TokenValidationParameters` и при успехе кладёт `ClaimsPrincipal` в `HttpContext.User`.

**Шаги проверки:**

1. **Извлечение.** Токен берётся из `Authorization: Bearer ...`. Нет заголовка — результат `NoResult`, пользователь анонимный (это ещё не 401).
2. **Разбор** — три части, валидный Base64Url и JSON.
3. **Подпись.** По `kid` из заголовка выбирается ключ. При заданном `Authority` ключи загружаются из `/.well-known/openid-configuration` → `jwks_uri` и кэшируются с периодическим обновлением, что позволяет издателю ротировать ключи.
4. **Claims:** `iss` совпадает с ожидаемым издателем, `aud` содержит ваш API, `exp` не истёк, `nbf` уже наступил — с допуском `ClockSkew` (по умолчанию 5 минут).
5. **Создание `ClaimsPrincipal`** и событие `OnTokenValidated` для дополнительных проверок.

```csharp
builder.Services.AddAuthentication().AddJwtBearer(o =>
{
    o.Authority = "https://login.example.com";
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidAudience = "orders-api",
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromSeconds(30),
        NameClaimType = "sub",
        RoleClaimType = "role"
    };
    o.Events = new JwtBearerEvents
    {
        OnMessageReceived = ctx =>                       // токен из query для SignalR/WebSocket
        {
            if (ctx.Request.Path.StartsWithSegments("/hubs"))
                ctx.Token = ctx.Request.Query["access_token"];
            return Task.CompletedTask;
        },
        OnTokenValidated = async ctx =>                  // например, проверка отзыва
        {
            var jti = ctx.Principal!.FindFirst("jti")?.Value;
            var denylist = ctx.HttpContext.RequestServices.GetRequiredService<ITokenDenylist>();
            if (jti is not null && await denylist.ContainsAsync(jti)) ctx.Fail("revoked");
        }
    };
});
```

**Когда возвращается 401.** Сам факт невалидного токена не даёт 401 — authentication только помечает результат как failed. 401 появляется, когда authorization видит, что endpoint требует аутентификации, и вызывает challenge схемы. На эндпоинте без `[Authorize]` запрос с просроченным токеном пройдёт как анонимный.

**Offline-проверка.** API не ходит к identity provider на каждый запрос — только за ключами. Отсюда и скорость, и главный минус: отозванный токен остаётся валидным до `exp`, если не добавить денилист или introspection.

**Подводные камни:**

- **Маппинг claims.** Старый `JwtSecurityTokenHandler` переименовывал короткие claims (`sub`, `role`) в длинные URI Microsoft; с .NET 8 по умолчанию используется `JsonWebTokenHandler`, и поведение отличается — проверяйте `NameClaimType`/`RoleClaimType` и `MapInboundClaims`.
- **Расхождение часов** между серверами — токены «ещё не валидны» или внезапно истекают.
- **Без `Authority`** ключи нужно указать явно в `IssuerSigningKey`; с симметричным ключом слабый секрет легко подобрать офлайн.
- **Диагностика:** событие `OnAuthenticationFailed` и логи категории `Microsoft.AspNetCore.Authentication` показывают точную причину (`IDX10223: Lifetime validation failed` и т.п.).

## Что такое claims?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-claims
tags: security
```

Claim — это утверждение о пользователе в виде пары «тип — значение», выданное доверенным источником: `sub = user-42`, `email = a@b.com`, `role = admin`, `tenant = acme`. Вся модель идентичности в .NET построена на claims: аутентификация превращает токен или cookie в набор claims, а авторизация принимает решения на их основе.

**Иерархия типов:**

- `Claim` — одно утверждение: `Type`, `Value`, `Issuer`;
- `ClaimsIdentity` — набор claims, выданный одним способом аутентификации (одна «удостоверение»), с `AuthenticationType`;
- `ClaimsPrincipal` — пользователь, может иметь несколько identity. Это `HttpContext.User`.

```csharp
app.MapGet("/me", (ClaimsPrincipal user) => new
{
    Id       = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"),
    Name     = user.Identity?.Name,
    IsAdmin  = user.IsInRole("admin"),
    Tenant   = user.FindFirst("tenant")?.Value,
    Scopes   = user.FindAll("scope").Select(c => c.Value)
}).RequireAuthorization();
```

**Откуда берутся claims:** из payload JWT, из cookie аутентификации (сериализованный principal), из ответа OpenID Connect-провайдера, из Windows-аутентификации. Можно дополнять их на сервере через `IClaimsTransformation` — например, подгрузить права пользователя из БД:

```csharp
public sealed class PermissionsTransformation(IPermissionStore store) : IClaimsTransformation
{
    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.HasClaim(c => c.Type == "permission")) return principal;   // вызывается многократно
        var id = new ClaimsIdentity();
        foreach (var p in await store.GetAsync(principal.FindFirstValue("sub")!))
            id.AddClaim(new Claim("permission", p));
        principal.AddIdentity(id);
        return principal;
    }
}
```

**Claims и авторизация.**

- Роли — это просто claims определённого типа (`RoleClaimType`), `[Authorize(Roles = "admin")]` проверяет их.
- Политики: `p.RequireClaim("permission", "orders:refund")`.
- Claims-based подход гибче ролей: вместо «admin может всё» выдают конкретные права.

**Что важно:**

- Claims — это данные, которым вы доверяете только потому, что их подписал доверенный издатель. Claims из тела запроса или заголовка, заполненного клиентом, доверия не заслуживают.
- Не раздувайте токен: сотни прав в JWT увеличивают каждый запрос и не обновляются до выдачи нового токена.
- `IClaimsTransformation` может вызываться несколько раз за запрос — делайте его идемпотентным и кэшируйте обращения к БД.
- Имена типов claims зависят от маппинга (`ClaimTypes.NameIdentifier` против `sub`) — частая причина `null` при чтении.

## Что такое policy-based authorization?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-policy-based-authorization
tags: security
```

Policy-based authorization — модель авторизации в ASP.NET Core, в которой правила доступа описываются именованными политиками, а политика состоит из одного или нескольких requirements. Эндпоинт ссылается на политику по имени, а логика проверки живёт в обработчиках (`AuthorizationHandler`), которые можно тестировать и получать через DI.

```csharp
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("Admins", p => p.RequireRole("admin"))
    .AddPolicy("CanRefund", p => p
        .RequireAuthenticatedUser()
        .RequireClaim("permission", "orders:refund"))
    .AddPolicy("Adult", p => p.AddRequirements(new MinimumAgeRequirement(18)));

builder.Services.AddSingleton<IAuthorizationHandler, MinimumAgeHandler>();

app.MapPost("/orders/{id}/refund", ...).RequireAuthorization("CanRefund");
// в контроллере: [Authorize(Policy = "Adult")]
```

**Свой requirement и handler:**

```csharp
public sealed record MinimumAgeRequirement(int Age) : IAuthorizationRequirement;

public sealed class MinimumAgeHandler(TimeProvider clock)
    : AuthorizationHandler<MinimumAgeRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, MinimumAgeRequirement req)
    {
        var birth = context.User.FindFirst("birthdate")?.Value;
        if (birth is not null &&
            DateOnly.Parse(birth).AddYears(req.Age) <= DateOnly.FromDateTime(clock.GetUtcNow().Date))
        {
            context.Succeed(req);
        }
        return Task.CompletedTask;   // не вызвали Succeed — требование не выполнено
    }
}
```

**Правила вычисления:**

- Политика выполнена, если **все** её requirements выполнены (логическое И).
- У одного requirement может быть несколько handlers: достаточно, чтобы **один** вызвал `Succeed` (ИЛИ), если никто не вызвал `Fail`. `context.Fail()` — жёсткий запрет, перебивающий остальные handlers.
- Роли `[Authorize(Roles = "...")]` — это частный случай: под капотом тоже политика с `RolesAuthorizationRequirement`.

**Resource-based.** Когда решение зависит от объекта (автор документа), политику проверяют в коде после загрузки ресурса:

```csharp
var result = await authz.AuthorizeAsync(User, document, "EditDocument");
if (!result.Succeeded) return Forbid();
```

Handler наследуется от `AuthorizationHandler<TRequirement, TResource>`.

**Полезные настройки:**

- `DefaultPolicy` — что означает голый `[Authorize]`;
- `FallbackPolicy` — применяется к эндпоинтам без каких-либо атрибутов авторизации; удобно закрыть всё по умолчанию и открывать через `[AllowAnonymous]`;
- `IAuthorizationPolicyProvider` — динамические политики, например, `[HasPermission("orders:refund")]` без регистрации каждой политики вручную.

**Почему это лучше ролей в атрибутах:** правило в одном месте, а не размазано по `[Authorize(Roles = "admin,manager")]`; сложная логика тестируется отдельно от контроллеров; изменения прав не требуют правки всех эндпоинтов.

## Что такое CORS?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-cors
tags: security
```

CORS (Cross-Origin Resource Sharing) — механизм, с помощью которого сервер через HTTP-заголовки разрешает браузеру отдавать JavaScript-коду с **другого origin** ответы на его запросы. По умолчанию браузер применяет same-origin policy: скрипт с `https://app.example.com` не может прочитать ответ от `https://api.example.com`.

**Что такое origin.** Тройка «схема + хост + порт». `https://a.com` и `https://a.com:8443` — разные origin, `http://a.com` и `https://a.com` — тоже разные. Путь значения не имеет.

**Ключевое, что проверяют на собеседовании: CORS — это защита, которую реализует браузер, а не сервер.**

- Запрос с чужого origin до сервера, как правило, **доходит** — браузер лишь не отдаёт ответ скрипту, если нет нужных заголовков.
- `curl`, Postman, серверный `HttpClient` CORS не знают вообще. Поэтому CORS — не механизм аутентификации и не защита API от вызовов.
- CORS ослабляет same-origin policy, а не усиливает её: настраивая CORS, вы **открываете** доступ, а не закрываете.

**Минимальная настройка в ASP.NET Core:**

```csharp
builder.Services.AddCors(o => o.AddPolicy("Spa", p => p
    .WithOrigins("https://app.example.com")
    .WithMethods("GET", "POST")
    .WithHeaders("Content-Type", "Authorization")));

var app = builder.Build();
app.UseCors("Spa");               // до авторизации и эндпоинтов

app.MapGet("/orders", ...).RequireCors("Spa");   // или точечно на эндпоинт
```

**Типичные ошибки:**

- `AllowAnyOrigin()` вместе с `AllowCredentials()` — запрещено спецификацией, ASP.NET Core выбросит исключение при старте. Для cookies нужен явный список origin.
- Зеркалирование любого `Origin` из запроса через `SetIsOriginAllowed(_ => true)` вместе с credentials — фактически отключение защиты: любой сайт сможет делать запросы от имени залогиненного пользователя и читать ответы.
- Ошибка «CORS» в консоли браузера часто маскирует настоящую проблему: сервер вернул 500 или 404 без CORS-заголовков, и браузер показывает только блокировку.
- Если фронт и API за одним reverse proxy на одном домене, CORS вообще не нужен — это самый простой вариант.

## Как работает CORS?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-rabotaet-cors
tags: security
```

Браузер добавляет к кросс-доменному запросу заголовок `Origin`, а сервер отвечает заголовками `Access-Control-Allow-*`. Если ответ их не содержит или они не совпадают с запросом, браузер блокирует доступ скрипта к ответу. Для «непростых» запросов браузер сначала отправляет preflight — `OPTIONS`-запрос, спрашивая разрешения.

**Simple request** (без preflight) — метод `GET`, `HEAD` или `POST`, только «безопасные» заголовки, а `Content-Type` — один из `text/plain`, `multipart/form-data`, `application/x-www-form-urlencoded`. Браузер сразу шлёт запрос и проверяет `Access-Control-Allow-Origin` в ответе.

**Preflight** — всё остальное: `PUT`/`DELETE`/`PATCH`, `Content-Type: application/json`, заголовок `Authorization` или любой кастомный.

```http
OPTIONS /orders/42 HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: DELETE
Access-Control-Request-Headers: authorization

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: DELETE
Access-Control-Allow-Headers: authorization
Access-Control-Max-Age: 600
```

Только после успешного preflight браузер отправит сам `DELETE`, и в его ответе тоже должен быть `Access-Control-Allow-Origin`.

**Основные заголовки ответа:**

| Заголовок | Смысл |
| --- | --- |
| `Access-Control-Allow-Origin` | разрешённый origin или `*` |
| `Access-Control-Allow-Credentials: true` | можно отправлять cookies и читать ответ; несовместимо с `*` |
| `Access-Control-Allow-Methods` / `-Headers` | что разрешено в основном запросе |
| `Access-Control-Expose-Headers` | какие заголовки ответа видны JS (по умолчанию только простые, `Location` или `X-Total-Count` скрыты) |
| `Access-Control-Max-Age` | сколько секунд кэшировать preflight |

**Как это делает ASP.NET Core.** `CorsMiddleware` смотрит на `Origin`, находит политику (из `UseCors("name")` или метаданных эндпоинта `RequireCors`/`[EnableCors]`), на preflight отвечает сам и замыкает конвейер (short-circuit), на обычный запрос дописывает заголовки. Если origin не разрешён, middleware просто **не добавляет** заголовки — сервер возвращает нормальный ответ, блокирует его браузер.

```csharp
builder.Services.AddCors(o => o.AddPolicy("Spa", p => p
    .WithOrigins("https://app.example.com")
    .AllowAnyHeader().AllowAnyMethod()
    .AllowCredentials()
    .WithExposedHeaders("Location")
    .SetPreflightMaxAge(TimeSpan.FromMinutes(10))));
```

**Подводные камни:**

- **Порядок middleware.** `UseCors` должен идти после `UseRouting` (если он вызывается явно) и до `UseAuthentication`/`UseAuthorization`. Иначе preflight без токена получит 401 и CORS «сломается».
- **Preflight на каждый запрос** удваивает число round-trip'ов. `Max-Age` помогает, но браузеры ограничивают его сверху (Chromium — 2 часа).
- **`Vary: Origin`.** Если ответ зависит от origin, CDN/прокси должны учитывать это при кэшировании — иначе закэшированный ответ с одним `Allow-Origin` уйдёт клиенту с другого сайта. Middleware добавляет `Vary: Origin` сам.

## Что такое CSRF?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-csrf
tags: security
```

CSRF (Cross-Site Request Forgery) — атака, при которой чужой сайт заставляет браузер жертвы отправить запрос на ваш сервер, а браузер **автоматически прикладывает cookies** жертвы. Сервер видит валидную сессию и выполняет действие: перевод денег, смену email, удаление данных. Злоумышленник ответ не читает — ему достаточно побочного эффекта.

```html
<!-- на evil.com -->
<form action="https://bank.example.com/transfer" method="post">
  <input name="to" value="attacker"><input name="amount" value="1000">
</form>
<script>document.forms[0].submit()</script>
```

**Почему это работает.** Отправка формы — simple request, CORS её не блокирует (он запрещает только чтение ответа). Уязвимо всё, где аутентификация держится на том, что браузер отправляет сам: cookies, Basic/Windows auth, клиентские сертификаты.

**Кто НЕ уязвим:** API с токеном в заголовке `Authorization: Bearer ...`. Чужой сайт не может прочитать токен из вашего `localStorage` и не может выставить заголовок без preflight, который CORS не пропустит. Поэтому SPA с JWT в заголовке обычно CSRF-защиту не включает (но у них другая проблема — токен уязвим для XSS).

**Способы защиты:**

- **Antiforgery token (synchronizer token).** Сервер кладёт секрет в cookie и в форму/заголовок, при POST проверяет, что они совпадают. Чужой сайт не может прочитать значение и подставить его.
- **`SameSite` cookies.** `Lax` (дефолт в современных браузерах) не отправляет cookie на кросс-сайтовые POST, `Strict` — вообще ни на какие кросс-сайтовые запросы. Сильная защита, но не полная: не покрывает атаки с поддоменов (same-site ≠ same-origin) и старые браузеры.
- **Проверка `Origin`/`Referer`** на изменяющих запросах — дополнительный слой.
- Изменяющие действия никогда не делать через `GET`.

**В ASP.NET Core:**

- MVC/Razor Pages: tag helper `<form>` сам добавляет скрытое поле `__RequestVerificationToken`; `[ValidateAntiForgeryToken]` или глобальный `AutoValidateAntiforgeryTokenAttribute` проверяет его на небезопасных методах.
- Minimal API (.NET 8+): `builder.Services.AddAntiforgery()` + `app.UseAntiforgery()`; эндпоинты, принимающие `[FromForm]`/`IFormFile`, проверяются автоматически, отключить можно через `.DisableAntiforgery()`.
- Для SPA на cookie-аутентификации токен получают через `IAntiforgery.GetAndStoreTokens` и шлют в заголовке (`X-XSRF-TOKEN`).

Частый вопрос вдогонку: «CORS защищает от CSRF?» — нет. CORS про чтение ответов, CSRF про побочные эффекты запроса, который CORS пропускает.

## Что такое REST?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-rest
tags: api-design
```

REST (Representational State Transfer) — архитектурный стиль, описанный Роем Филдингом: система строится вокруг **ресурсов**, адресуемых URI, с которыми клиент работает через единый интерфейс (в HTTP — стандартные методы и коды ответа), обмениваясь их **представлениями** (JSON, XML). Это набор ограничений, а не протокол и не формат.

**Ограничения REST:**

- **Client–server** — разделение UI и хранения данных.
- **Stateless** — каждый запрос самодостаточен, сервер не хранит состояние сессии клиента между запросами. Отсюда горизонтальное масштабирование: любой инстанс может обработать любой запрос.
- **Cacheable** — ответы явно помечаются как кэшируемые или нет (`Cache-Control`, `ETag`).
- **Uniform interface** — ресурсы идентифицируются URI, операции выражаются методами, сообщения самоописательны, плюс HATEOAS (ссылки на возможные переходы в ответе).
- **Layered system** — клиент не знает, общается ли он с сервером или с прокси/балансировщиком/CDN.
- **Code on demand** — опционально.

**Как это выглядит на практике:**

```http
GET    /orders?status=paid      — список
GET    /orders/42               — один ресурс
POST   /orders                  — создать → 201 Created + Location: /orders/42
PUT    /orders/42               — полная замена
PATCH  /orders/42               — частичное изменение
DELETE /orders/42               — удалить → 204 No Content
POST   /orders/42/cancellation  — действие, выраженное как ресурс
```

```csharp
var orders = app.MapGroup("/orders");
orders.MapGet("/{id:int}", async (int id, AppDb db) =>
    await db.Orders.FindAsync(id) is { } o ? Results.Ok(o) : Results.NotFound());
orders.MapPost("/", async (CreateOrder cmd, AppDb db) =>
{
    var order = Order.From(cmd);
    db.Add(order); await db.SaveChangesAsync();
    return Results.Created($"/orders/{order.Id}", order);
});
```

**Что интервьюер проверяет дальше:**

- **Большинство «REST API» — не REST по Филдингу**, а HTTP API в стиле REST: HATEOAS почти никто не делает. Модель зрелости Ричардсона: уровень 0 (один эндпоинт, RPC), 1 (ресурсы), 2 (методы и статусы), 3 (гипермедиа). Большинство API — уровень 2, и это нормально.
- **Существительные, а не глаголы** в URI: `/orders/42/cancellation` вместо `/cancelOrder?id=42`.
- **Семантика методов важна** для инфраструктуры: прокси, кэши и клиенты с ретраями полагаются на то, что `GET` безопасен, а `PUT`/`DELETE` идемпотентны.
- **Когда REST не подходит:** сложные выборки с разной формой ответа (GraphQL), высоконагруженное межсервисное взаимодействие со строгим контрактом и стримингом (gRPC), чисто командные операции.

## Какие HTTP methods являются idempotent?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kakie-http-methods-yavlyayutsya-idempotent
tags: api-design, idempotency
```

По RFC 9110 идемпотентны `GET`, `HEAD`, `OPTIONS`, `TRACE`, `PUT` и `DELETE`. Не идемпотентны `POST` и `PATCH` (последний может быть идемпотентным в конкретной реализации, но спецификация этого не гарантирует). Идемпотентность означает: **повторение одного и того же запроса N раз даёт на сервере тот же эффект, что и один раз**.

| Метод | Safe (без побочных эффектов) | Idempotent |
| --- | --- | --- |
| `GET`, `HEAD`, `OPTIONS`, `TRACE` | да | да |
| `PUT` | нет | да |
| `DELETE` | нет | да |
| `POST` | нет | нет |
| `PATCH` | нет | не гарантирована |

**Safe ⊂ idempotent.** Safe-метод не меняет состояние вообще (с точки зрения клиента — логи и счётчики не считаются). Идемпотентный может менять, но повтор ничего не добавляет.

**Идемпотентность — про состояние сервера, а не про ответ.** Первый `DELETE /orders/42` вернёт `204`, второй — `404`. Ответы разные, но состояние одинаковое: заказа нет. Это корректно.

**Почему `PUT` идемпотентен, а `POST` нет:**

```http
PUT /users/7   {"name":"Ann","email":"a@x.io"}   — сколько ни повторяй, итог один
POST /orders   {"sku":"A1","qty":1}             — каждый вызов создаёт новый заказ
PATCH /counters/1  {"op":"increment"}           — каждый вызов +1, не идемпотентно
PATCH /users/7 {"email":"b@x.io"}               — фактически идемпотентно
```

**Зачем это знать на практике:**

- **Ретраи.** Polly/`Microsoft.Extensions.Http.Resilience`, gRPC, балансировщики и браузеры могут безопасно повторять идемпотентные запросы при таймауте. Повтор `POST` после таймаута — классический источник двойных списаний, потому что клиент не знает, дошёл ли первый запрос.
- **Реализация должна соответствовать контракту.** `PUT`, который внутри делает `balance += x`, или `DELETE`, который пишет в журнал «удалено N раз» и шлёт письмо на каждый вызов, нарушают семантику, и инфраструктура с ретраями создаст баги.
- **Как сделать `POST` идемпотентным** — заголовок `Idempotency-Key`: клиент генерирует ключ, сервер запоминает результат первой обработки и на повтор возвращает его же.
- **Конкурентные `PUT`** идемпотентны, но не защищают от lost update — для этого нужны `ETag` + `If-Match` (412 Precondition Failed при конфликте).

## Какие HTTP status codes нужно знать backend-разработчику?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kakie-http-status-codes-nuzhno-znat-backend-razrabotchiku
tags: api-design
```

Нужно уверенно знать около двадцати кодов и, главное, различия между соседними: `400` vs `422`, `401` vs `403`, `404` vs `410`, `502` vs `503` vs `504`. Первая цифра задаёт класс: 2xx — успех, 3xx — перенаправление, 4xx — ошибка клиента (повтор без изменений не поможет), 5xx — ошибка сервера (повтор может помочь).

**2xx:**

| Код | Когда |
| --- | --- |
| `200 OK` | успех с телом |
| `201 Created` | ресурс создан, заголовок `Location` на него |
| `202 Accepted` | принято в асинхронную обработку, результат позже |
| `204 No Content` | успех без тела (`DELETE`, `PUT`) |
| `206 Partial Content` | ответ на `Range`-запрос |

**3xx:** `301`/`308` — постоянный редирект (`308` сохраняет метод и тело), `302`/`307` — временный (`307` сохраняет метод), `304 Not Modified` — ответ на `If-None-Match`/`If-Modified-Since`, тело берётся из кэша.

**4xx:**

| Код | Когда |
| --- | --- |
| `400 Bad Request` | синтаксически невалидный запрос, ошибка валидации |
| `401 Unauthorized` | **не аутентифицирован**: нет токена или он невалиден; с `WWW-Authenticate` |
| `403 Forbidden` | аутентифицирован, но **нет прав** |
| `404 Not Found` | ресурса нет (или его скрывают от пользователя без прав) |
| `405 Method Not Allowed` | метод не поддерживается для ресурса |
| `409 Conflict` | конфликт состояния: дубликат, неверный переход статуса |
| `410 Gone` | ресурс удалён навсегда |
| `412 Precondition Failed` | не выполнен `If-Match` — оптимистичная блокировка |
| `413 Content Too Large` | тело больше лимита |
| `415 Unsupported Media Type` | неподдерживаемый `Content-Type` |
| `422 Unprocessable Content` | формат верный, но нарушены бизнес-правила |
| `429 Too Many Requests` | rate limit, с `Retry-After` |

**5xx:**

| Код | Когда |
| --- | --- |
| `500 Internal Server Error` | необработанное исключение |
| `502 Bad Gateway` | прокси получил невалидный ответ от upstream (упал, оборвал соединение) |
| `503 Service Unavailable` | сервис временно недоступен: перегрузка, обслуживание, остановка; можно `Retry-After` |
| `504 Gateway Timeout` | прокси не дождался ответа upstream |

**Что спрашивают вдогонку:**

- **401 vs 403** — самая частая путаница. В ASP.NET Core `Challenge` даёт 401, `Forbid` — 403. Сделать «404 вместо 403» допустимо, чтобы не раскрывать существование ресурса.
- **400 vs 422** — спорная граница. ASP.NET Core по умолчанию отдаёт на ошибки валидации `400` с `ValidationProblemDetails`. Главное — единообразие в рамках API.
- **Не возвращать `200` с `{"success": false}`** — ломает мониторинг, ретраи и кэширование, которые смотрят на код.
- **5xx влияют на ретраи и алерты:** клиенты с политиками повторов повторяют 5xx и 408/429, но не 4xx. Отдавать 500 на ошибку валидации — значит провоцировать бессмысленные повторы и ложные алерты.
- `499` — не стандарт, это код nginx для «клиент закрыл соединение»; полезно знать при разборе логов.

## Что такое `ProblemDetails`?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-problemdetails
tags: api-design
```

`ProblemDetails` — стандартный формат тела ошибки в HTTP API, описанный в RFC 9457 (раньше RFC 7807). Вместо самодельного `{"error": "..."}` сервер отдаёт JSON с типом `application/problem+json` и фиксированным набором полей, которые одинаково понимают клиенты, гейтвеи и инструменты.

```json
{
  "type": "https://example.com/problems/insufficient-funds",
  "title": "Недостаточно средств",
  "status": 422,
  "detail": "На счёте 30.00, требуется 50.00",
  "instance": "/accounts/42/withdrawals",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
}
```

**Поля:** `type` — URI, идентифицирующий вид ошибки (клиент ветвится по нему, а не по тексту), `title` — краткое человекочитаемое описание типа, `status` — дублирует HTTP-код, `detail` — описание конкретного случая, `instance` — URI конкретного вхождения. Всё остальное — extensions: `traceId`, `errors`, код бизнес-ошибки.

**Поддержка в ASP.NET Core:**

```csharp
builder.Services.AddProblemDetails(o =>
    o.CustomizeProblemDetails = ctx =>
        ctx.ProblemDetails.Extensions["node"] = Environment.MachineName);

app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapPost("/accounts/{id}/withdraw", (int id, decimal amount) =>
    amount <= 0
        ? TypedResults.ValidationProblem(new Dictionary<string, string[]>
            { ["amount"] = ["Сумма должна быть положительной"] })
        : TypedResults.Problem(
            title: "Недостаточно средств",
            statusCode: StatusCodes.Status422UnprocessableEntity,
            type: "https://example.com/problems/insufficient-funds"));
```

- `AddProblemDetails()` регистрирует `IProblemDetailsService`. После этого необработанные исключения (через `UseExceptionHandler`), пустые ответы с кодом ошибки (через `UseStatusCodePages`) и developer exception page отдают тело в формате ProblemDetails.
- `[ApiController]` автоматически возвращает `400` с `ValidationProblemDetails` — это наследник с полем `errors` (словарь «поле → сообщения»).
- `Results.Problem` / `TypedResults.Problem` / `ControllerBase.Problem()` — явный возврат ошибки.
- Фреймворк сам заполняет `type` ссылкой на раздел RFC 9110 для кода и добавляет `traceId` — по нему ошибку из ответа можно найти в логах и трейсах.

**На что смотрят на собеседовании:**

- **Не раскрывать внутренности.** `detail` с текстом исключения и стеком — только в Development. В продакшене — общий текст и `traceId`.
- **Стабильный `type`.** Это часть контракта API: клиенты пишут логику по нему, менять его — breaking change.
- **Единообразие.** Ошибки валидации, бизнес-ошибки и 500 должны иметь один формат, иначе клиенту приходится разбирать три разных тела.
- **Content negotiation.** `IProblemDetailsService` пишет ответ, только если клиент принимает JSON; браузеру с `Accept: text/html` может прийти пустое тело.

## Как глобально обрабатывать исключения?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-globalno-obrabatyvat-isklyucheniya
```

Глобально исключения ловит exception handler middleware (`UseExceptionHandler`), поставленный первым в пайплайне. С .NET 8 логику обработки удобно выносить в реализации `IExceptionHandler`, а ответ формировать как `ProblemDetails`.

```csharp
public sealed class DomainExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext ctx, Exception ex, CancellationToken ct)
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

var app = builder.Build();
app.UseExceptionHandler();
```

**Как это работает.** Middleware оборачивает `await next(context)` в `try/catch`. При исключении он логирует его, очищает ответ (если тот ещё не начат), кладёт исключение в `IExceptionHandlerFeature` и по очереди вызывает зарегистрированные `IExceptionHandler` в порядке регистрации. Первый вернувший `true` завершает обработку. Если никто не взялся — срабатывает fallback: путь (`UseExceptionHandler("/error")`), лямбда или стандартный ProblemDetails с `500`. Без `AddProblemDetails`, пути или лямбды вызов `UseExceptionHandler()` без аргументов упадёт при старте.

**Альтернативы и их место:**

| Способ | Что ловит |
| --- | --- |
| `UseExceptionHandler` + `IExceptionHandler` | всё, что ниже в пайплайне: middleware, MVC, Minimal API |
| `UseDeveloperExceptionPage` | то же, только для разработки, со стеком |
| Exception filter MVC | только исключения в контроллерах и фильтрах; не видит middleware |
| свой `try/catch`-middleware | работает, но это переизобретение встроенного |

**Подводные камни:**

- **Ответ уже начат.** Если заголовки ушли клиенту (`Response.HasStarted`), поменять статус нельзя — middleware только залогирует ошибку и оборвёт соединение. Типично для стриминга.
- **Исключения как control flow.** Бросать `NotFoundException` ради 404 удобно, но исключения дороги; для ожидаемых ситуаций лучше возвращать `Results.NotFound()` или Result-объект, а глобальный обработчик оставить для неожиданного.
- **`OperationCanceledException`** при отмене клиентом не стоит логировать как ошибку и отдавать 500 — клиент уже ушёл.
- **Утечка деталей.** Текст исключения и стек — только в Development.
- В .NET 9 появился `StatusCodeSelector` в `ExceptionHandlerOptions` для простого маппинга «тип исключения → код» без своего обработчика.

## Что такое rate limiting?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-rate-limiting
tags: api-design
```

Rate limiting — ограничение числа запросов, которые клиент (или все клиенты вместе) может сделать за единицу времени. Запросы сверх лимита сервер отклоняет, обычно кодом `429 Too Many Requests` с заголовком `Retry-After`, или ставит в короткую очередь.

**Зачем он нужен:**

- **Защита от перегрузки.** Один клиент с багом в цикле ретраев или резкий всплеск трафика не должны положить сервис и базу для всех остальных.
- **Справедливость.** Ресурсы делятся между клиентами: тяжёлый тенант не съедает всё.
- **Безопасность.** Замедляет перебор паролей, OTP-кодов, скрейпинг, перечисление ID.
- **Бизнес-модель.** Тарифы публичного API: бесплатный план — 60 запросов в минуту, платный — 6000.
- **Защита дорогих зависимостей.** Внешний API с собственной квотой, тяжёлый отчёт, отправка SMS.

**Ключевые понятия:**

- **Partition key** — по чему считаем: IP, пользователь, API-ключ, тенант, endpoint. Лимит «на всех сразу» защищает сервис, лимит «на клиента» — справедливость.
- **Алгоритм** — fixed window, sliding window, token bucket, concurrency limit. Они по-разному ведут себя на всплесках.
- **Что делать с лишним** — отказать сразу или подержать в очереди ограниченной длины.

**Пример алгоритма — фиксированное окно:**

```text
лимит 100 запросов / минута на API-ключ
12:00:00–12:00:59  → счётчик 0..100, 101-й получает 429
12:01:00           → счётчик сбрасывается
```

Проблема фиксированного окна: клиент может сделать 100 запросов в 12:00:59 и ещё 100 в 12:01:00 — двойной всплеск на границе. Sliding window и token bucket это сглаживают.

**Где его делают:**

| Уровень | Плюсы | Минусы |
| --- | --- | --- |
| API Gateway / ingress / CDN | отсекает трафик до приложения, общий счётчик | не знает бизнес-контекста |
| Middleware в приложении | знает пользователя, тариф, endpoint | счётчик локален для инстанса |
| Перед конкретной зависимостью | точечно защищает дорогой ресурс | не защищает остальной сервис |

На практике слои комбинируют: грубая защита на гейтвее, тонкие правила по тарифам — в приложении.

**Хороший тон для клиентов:** `429` вместо `503`, `Retry-After` с временем до следующей попытки, документированные лимиты. Клиент, получив `429`, должен ждать, а не повторять сразу — иначе ретраи сами превращаются в нагрузку.

В ASP.NET Core с .NET 7 есть встроенный middleware (`AddRateLimiter` / `UseRateLimiter`), но его счётчики живут в памяти одного процесса — при нескольких инстансах лимит фактически умножается на их число.

## Как реализовать rate limiting в ASP.NET Core?

```yaml
category: aspnet-core
level: middle
difficulty: 4
slug: aspnet-core-kak-realizovat-rate-limiting-v-asp-net-core
tags: api-design
```

С .NET 7 rate limiting встроен: пространство имён `Microsoft.AspNetCore.RateLimiting` поверх примитивов `System.Threading.RateLimiting`. Регистрируете политики через `AddRateLimiter`, включаете middleware `UseRateLimiter` и привязываете политики к endpoint'ам через `RequireRateLimiting` или `[EnableRateLimiting]`.

```csharp
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    o.AddFixedWindowLimiter("login", l =>
    {
        l.PermitLimit = 5;
        l.Window = TimeSpan.FromMinutes(1);
        l.QueueLimit = 0;
    });

    o.AddPolicy("per-user", ctx =>
        RateLimitPartition.GetTokenBucketLimiter(
            ctx.User.Identity?.Name ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
            _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = 100,
                TokensPerPeriod = 20,
                ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                QueueLimit = 0
            }));

    o.OnRejected = (ctx, ct) =>
    {
        if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry))
            ctx.HttpContext.Response.Headers.RetryAfter = ((int)retry.TotalSeconds).ToString();
        return ValueTask.CompletedTask;
    };
});

var app = builder.Build();
app.UseRouting();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapPost("/login", Login).RequireRateLimiting("login");
app.MapGroup("/api").RequireRateLimiting("per-user");
app.MapGet("/health", () => "ok").DisableRateLimiting();
```

**Встроенные алгоритмы:**

| Метод | Поведение |
| --- | --- |
| `AddFixedWindowLimiter` | N запросов на окно; всплеск на границе окон |
| `AddSlidingWindowLimiter` | окно разбито на `SegmentsPerWindow` сегментов, сглаживает границу |
| `AddTokenBucketLimiter` | разрешает всплеск до `TokenLimit`, средняя скорость — `TokensPerPeriod` |
| `AddConcurrencyLimiter` | ограничивает число одновременно выполняемых запросов, а не частоту |

**Партиционирование.** Политики `AddFixedWindowLimiter("name", ...)` создают один общий лимитер на все запросы к endpoint. Для лимита «на клиента» нужен `AddPolicy` с `RateLimitPartition.Get...Limiter(key, factory)`: для каждого ключа создаётся свой лимитер. `GlobalLimiter` (`PartitionedRateLimiter.Create<HttpContext, string>(...)`) применяется ко всем запросам до политик endpoint'а — удобно как общий предохранитель.

**Подводные камни:**

- **По умолчанию код отказа — `503`**, а не `429`. Это частая находка на ревью: выставляйте `RejectionStatusCode` или пишите статус в `OnRejected`.
- **Порядок middleware.** Для политик, привязанных к endpoint, `UseRateLimiter` должен идти после `UseRouting`. Если ключ партиции — пользователь, лимитер должен стоять после `UseAuthentication`, иначе `ctx.User` пуст.
- **IP за прокси.** Без `UseForwardedHeaders` все клиенты имеют IP балансировщика и попадают в одну партицию.
- **Кардинальность ключей.** Партиция на каждый IP — это память. Встроенный механизм периодически чистит простаивающие лимитеры, но ключ из пользовательского ввода (например, произвольный заголовок) позволяет раздуть словарь.
- **Очередь.** `QueueLimit > 0` держит запрос открытым, пока не освободится разрешение, — для API обычно лучше отказать сразу, чем копить висящие соединения.
- **Один инстанс.** Состояние в памяти процесса: при трёх репликах лимит `100/мин` превращается в «до 300/мин». Для общего лимита нужен Redis-лимитер, гейтвей или деление лимита на число инстансов.

## Что такое health checks?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-health-checks
tags: observability
```

Health checks — HTTP-эндпоинты, по которым оркестратор (Kubernetes, балансировщик, мониторинг) узнаёт, живо ли приложение и готово ли принимать трафик. В ASP.NET Core они встроены: `AddHealthChecks()` регистрирует проверки, `MapHealthChecks()` публикует их результат.

```csharp
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
    .AddDbContextCheck<AppDbContext>(tags: ["ready"])
    .AddCheck<QueueHealthCheck>("queue", tags: ["ready"]);

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("live")
});
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready")
});
```

**Своя проверка** — реализация `IHealthCheck`:

```csharp
public sealed class QueueHealthCheck(IQueueClient queue) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        var lag = await queue.GetLagAsync(ct);
        return lag switch
        {
            < 1_000 => HealthCheckResult.Healthy(),
            < 10_000 => HealthCheckResult.Degraded($"lag {lag}"),
            _ => HealthCheckResult.Unhealthy($"lag {lag}")
        };
    }
}
```

**Статусы и коды.** `Healthy` и `Degraded` по умолчанию дают `200`, `Unhealthy` — `503`. Маппинг меняется через `HealthCheckOptions.ResultStatusCodes`. Тело по умолчанию — просто строка статуса; детальный JSON настраивается через `ResponseWriter`.

**Три вида проб в Kubernetes:**

| Проба | Вопрос | Реакция на провал |
| --- | --- | --- |
| liveness | процесс не завис? | перезапуск контейнера |
| readiness | можно ли слать трафик? | под исключается из балансировки |
| startup | приложение уже стартовало? | пока не прошла, liveness не проверяется |

**Главное правило: в liveness не проверять внешние зависимости.** Если база недоступна, перезапуск подов её не починит, зато все реплики уйдут в рестарт одновременно — каскадный отказ. Зависимости проверяют в readiness, и то осторожно: если база общая, readiness всех подов упадёт разом, и сервис станет отдавать ошибки балансировщика вместо осмысленных `503`.

**Практические моменты:**

- Готовые проверки для PostgreSQL, Redis, RabbitMQ, Kafka есть в пакетах `AspNetCore.HealthChecks.*` (проект Xabaril); `AddDbContextCheck` — в `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore`.
- Проверки выполняются на каждый запрос к эндпоинту — тяжёлые проверки стоит кэшировать или ограничивать таймаутом.
- Эндпоинты здоровья обычно исключают из аутентификации, rate limiting и логирования запросов, но не публикуют детальный ответ наружу — он раскрывает инфраструктуру. Можно ограничить порт или хост через `RequireHost`.
- `IHealthCheckPublisher` периодически публикует результаты в мониторинг без внешнего опроса.

## Как сделать graceful shutdown?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-sdelat-graceful-shutdown
tags: hosting
```

Graceful shutdown — остановка, при которой приложение перестаёт принимать новую работу, дожидается завершения текущей и корректно освобождает ресурсы. В ASP.NET Core это обеспечивает Generic Host: по сигналу (`SIGTERM`, Ctrl+C) он даёт Kestrel и hosted services время до `HostOptions.ShutdownTimeout` (по умолчанию 30 секунд) и только потом завершает процесс.

**Что нужно сделать в коде:**

```csharp
builder.Services.Configure<HostOptions>(o => o.ShutdownTimeout = TimeSpan.FromSeconds(25));

var app = builder.Build();
var lifetime = app.Lifetime;

lifetime.ApplicationStopping.Register(() =>
    app.Logger.LogInformation("Получен сигнал остановки"));
lifetime.ApplicationStopped.Register(() =>
    app.Logger.LogInformation("Остановлено"));
```

1. **Фоновые сервисы уважают `stoppingToken`.** `ExecuteAsync` должен проверять токен и передавать его во все `await`: в `Task.Delay`, запросы к БД, чтение из очереди. Иначе хост дождётся таймаута и бросит задачу на полпути.
2. **Обработка сообщений атомарна.** Сообщение из очереди подтверждается (`ack`) только после успешной обработки; при остановке необработанное вернётся брокеру и уйдёт другому инстансу.
3. **Буферы сбрасываются.** Батчи метрик, логов, накопленные записи — в `StopAsync` или в обработчике `ApplicationStopping`.
4. **Ресурсы освобождаются через DI.** Singleton'ы с `IAsyncDisposable` контейнер освободит при остановке хоста.

```csharp
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    while (!stoppingToken.IsCancellationRequested)
    {
        var msg = await _queue.ReceiveAsync(stoppingToken);
        await HandleAsync(msg, stoppingToken);
        await _queue.AckAsync(msg, CancellationToken.None);
    }
}
```

**Последовательность остановки:**

1. Хост получает `SIGTERM`, срабатывает `ApplicationStopping`.
2. Kestrel перестаёт принимать новые соединения и ждёт завершения текущих запросов.
3. Hosted services останавливаются в порядке, обратном регистрации: у `BackgroundService` отменяется `stoppingToken`, хост ждёт завершения `ExecuteAsync`.
4. Срабатывает `ApplicationStopped`, контейнер освобождает сервисы, процесс выходит.

Всё это укладывается в общий `ShutdownTimeout`. Что не успело — прерывается.

**Типичные ошибки:**

- `ShutdownTimeout` больше, чем даёт оркестратор: Kubernetes пришлёт `SIGKILL` через `terminationGracePeriodSeconds` (по умолчанию 30 с), и graceful не случится. Таймаут хоста должен быть меньше с запасом.
- Приложение в контейнере запущено через shell-скрипт, который не пробрасывает `SIGTERM` процессу `dotnet`, — сигнал просто не доходит. Используйте exec-форму `ENTRYPOINT ["dotnet", "App.dll"]`.
- Долгие операции (минуты) нельзя вписать в graceful shutdown — их нужно делать прерываемыми и возобновляемыми: чекпоинты, outbox, повторная доставка.
- `Environment.Exit` или `Process.Kill` из кода обходят всю эту механику.

## Что происходит с запросами при остановке приложения?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-chto-proishodit-s-zaprosami-pri-ostanovke-prilozheniya
```

При штатной остановке Kestrel перестаёт принимать новые соединения, но даёт уже начатым запросам доработать в пределах `ShutdownTimeout` (по умолчанию 30 секунд). Запросы, не успевшие завершиться за это время, обрываются. Новые запросы, пришедшие после закрытия listener'а, получат отказ в соединении — если балансировщик всё ещё шлёт трафик на этот инстанс.

**По шагам:**

1. Процесс получает `SIGTERM` (или Ctrl+C, или `StopApplication()`), срабатывает `IHostApplicationLifetime.ApplicationStopping`.
2. Kestrel закрывает слушающие сокеты — новые TCP-соединения не принимаются.
3. Простаивающие keep-alive соединения закрываются. Активные HTTP/1.1-соединения дорабатывают текущий запрос, ответ уходит с `Connection: close`. Для HTTP/2 сервер отправляет `GOAWAY`: открытые стримы доживают, новые клиент должен открыть в другом соединении.
4. Хост ждёт завершения запросов. Если `ShutdownTimeout` истёк — оставшиеся соединения принудительно закрываются, клиент видит обрыв, а код обработчика получает отмену через `HttpContext.RequestAborted` и обычно падает с `OperationCanceledException`.
5. Останавливаются остальные hosted services, освобождается DI-контейнер, процесс выходит.

**Что видит клиент:**

| Ситуация | Результат |
| --- | --- |
| запрос уже выполнялся и успел | нормальный ответ |
| запрос не успел до таймаута | обрыв соединения, у прокси — `502`/`504` |
| новый запрос на этот инстанс после закрытия listener'а | connection refused, у прокси — `502` |
| keep-alive соединение закрыто сервером в момент отправки запроса клиентом | ошибка у клиента, безопасный повтор возможен для идемпотентных методов |

**Почему ошибки бывают даже при «правильном» коде.** Балансировщик узнаёт об остановке инстанса не мгновенно. Если приложение закрыло listener раньше, чем его убрали из ротации, часть новых запросов упадёт. Отсюда практика: при получении сигнала какое-то время продолжать обслуживать трафик (задержка перед остановкой, в Kubernetes — `preStop`), а readiness-проба начинает отдавать `503`, чтобы ускорить вывод из балансировки.

**Что важно для кода обработчиков:**

- Передавать `CancellationToken` дальше, чтобы при принудительной остановке работа прекращалась, а не продолжалась впустую.
- Не начинать необратимые операции без транзакционной защиты: если процесс прибьют посреди «списать деньги → записать заказ», нужны транзакция, outbox или идемпотентный повтор.
- Длинные соединения (WebSocket, SSE, long polling) сами не завершатся — их надо закрывать по `ApplicationStopping`, иначе они просто доживут до таймаута и будут оборваны.
- Фоновую работу, запущенную через `Task.Run` из запроса, хост не отслеживает — она погибнет вместе с процессом без предупреждения.

## Как работает `IHostedService`?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-rabotaet-ihostedservice
tags: hosting
```

`IHostedService` — интерфейс из двух методов, `StartAsync` и `StopAsync`, которые Generic Host вызывает при запуске и остановке приложения. Так в процесс встраивается любая работа, живущая вместе с хостом: фоновые обработчики очередей, таймеры, прогрев кэша, сам веб-сервер Kestrel.

```csharp
public interface IHostedService
{
    Task StartAsync(CancellationToken cancellationToken);
    Task StopAsync(CancellationToken cancellationToken);
}

builder.Services.AddHostedService<CacheWarmupService>();
```

**Жизненный цикл:**

1. При `app.Run()` хост разрешает все `IHostedService` из DI (они singleton) и вызывает `StartAsync` **последовательно** в порядке регистрации, ожидая завершения каждого.
2. Пользовательские hosted services в `WebApplication` стартуют до Kestrel: веб-сервер — тоже hosted service, и он добавляется последним. Пока ваш `StartAsync` не вернулся, приложение не принимает HTTP-запросы.
3. При остановке хост вызывает `StopAsync` в **обратном** порядке, передавая токен, который отменится по истечении `ShutdownTimeout`.

**Следствия, о которых спрашивают:**

- **`StartAsync` блокирует старт.** Долгая инициализация в нём задерживает запуск всего приложения; бесконечный цикл в `StartAsync` вообще не даст стартовать. Длительную работу нужно запускать отдельной задачей и сразу возвращаться — именно это делает `BackgroundService`.
- **Исключение в `StartAsync` роняет запуск хоста.** Это удобно для обязательной инициализации (миграции, проверка конфигурации): приложение не поднимется в сломанном состоянии.
- **Hosted service — singleton.** Scoped-зависимости (`DbContext`) нельзя внедрять в конструктор, нужен `IServiceScopeFactory.CreateAsyncScope()` на каждую единицу работы.
- **`StopAsync` должен уважать токен.** Если он не завершится вовремя, хост перестанет ждать.

```csharp
public sealed class CacheWarmupService(IServiceScopeFactory scopes, PriceCache cache) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        cache.Load(await db.Prices.AsNoTracking().ToListAsync(ct));
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
```

**Расширения в .NET 8:**

- `IHostedLifecycleService` добавляет `StartingAsync`, `StartedAsync`, `StoppingAsync`, `StoppedAsync` — хуки до и после основных фаз.
- `HostOptions.ServicesStartConcurrently` и `ServicesStopConcurrently` позволяют запускать и останавливать сервисы параллельно, если они независимы.

**Альтернативы для одноразовой логики:** колбэки `IHostApplicationLifetime.ApplicationStarted/Stopping/Stopped` — если не нужен отдельный класс с зависимостями.

## Чем `IHostedService` отличается от `BackgroundService`?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-chem-ihostedservice-otlichaetsya-ot-backgroundservice
tags: hosting
```

`IHostedService` — низкоуровневый интерфейс «старт/стоп», а `BackgroundService` — абстрактный класс, реализующий его для типичного случая долгоживущей фоновой задачи. Вы переопределяете один метод `ExecuteAsync(CancellationToken stoppingToken)`, а запуск в фоне, отмену и ожидание при остановке базовый класс делает сам.

**Что делает `BackgroundService` внутри (упрощённо):**

```csharp
public abstract class BackgroundService : IHostedService, IDisposable
{
    private Task? _executeTask;
    private CancellationTokenSource? _stoppingCts;

    protected abstract Task ExecuteAsync(CancellationToken stoppingToken);

    public virtual Task StartAsync(CancellationToken cancellationToken)
    {
        _stoppingCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _executeTask = ExecuteAsync(_stoppingCts.Token);
        return _executeTask.IsCompleted ? _executeTask : Task.CompletedTask;
    }

    public virtual async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_executeTask is null) return;
        _stoppingCts!.Cancel();
        await _executeTask.WaitAsync(cancellationToken).ConfigureAwait(false);
    }
}
```

`StartAsync` запускает `ExecuteAsync` и сразу возвращает управление, не дожидаясь её завершения, — поэтому бесконечный цикл не блокирует старт приложения. `StopAsync` отменяет `stoppingToken` и ждёт, пока `ExecuteAsync` завершится, но не дольше таймаута остановки.

**Сравнение:**

| | `IHostedService` | `BackgroundService` |
| --- | --- | --- |
| Что реализуете | `StartAsync` и `StopAsync` | только `ExecuteAsync` |
| Блокирует старт | да, пока не завершится `StartAsync` | нет (кроме нюанса ниже) |
| Отмена | сами | `stoppingToken` готов |
| Подходит для | инициализации до приёма трафика, обёрток над чужим lifecycle (таймер, подписка) | бесконечных циклов: очереди, polling, периодические задачи |

**Нюансы, которые проверяют на собеседовании:**

- **Синхронная часть `ExecuteAsync`.** До .NET 10 код до первого настоящего `await` выполнялся синхронно внутри `StartAsync` и блокировал запуск остальных сервисов и Kestrel. Классический костыль — `await Task.Yield()` первой строкой. В .NET 10 это поведение изменили: `ExecuteAsync` целиком запускается как отдельная задача.
- **Исключения.** С .NET 6 необработанное исключение в `ExecuteAsync` логируется и по умолчанию останавливает весь хост (`BackgroundServiceExceptionBehavior.StopHost`). До .NET 6 задача молча умирала, а приложение продолжало работать без фоновой обработки. Поэтому внутри цикла ловите исключения на уровне одной итерации, а не всего метода.
- **Нужен ли `IHostedService` напрямую.** Да, когда важно выполнить что-то **до** приёма запросов (миграции, прогрев кэша) — там блокировка старта как раз желательна. Либо когда нужен точный контроль над остановкой.
- **Оба — singleton.** Scoped-сервисы получают через `IServiceScopeFactory`, по скоупу на итерацию.
- Регистрируются одинаково: `AddHostedService<T>()`.

## Как реализовать background worker?

```yaml
category: aspnet-core
level: middle
difficulty: 4
slug: aspnet-core-kak-realizovat-background-worker
tags: hosting
```

Стандартный способ — наследник `BackgroundService` с циклом в `ExecuteAsync`, который на каждую итерацию создаёт DI-скоуп, обрабатывает исключения внутри итерации и уважает `stoppingToken`. Для периодических задач — `PeriodicTimer`, для обработки работы из запросов — очередь на `System.Threading.Channels`.

**Периодическая задача:**

```csharp
public sealed class OutboxPublisher(
    IServiceScopeFactory scopes,
    ILogger<OutboxPublisher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var publisher = scope.ServiceProvider.GetRequiredService<IOutboxProcessor>();
                await publisher.PublishBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Ошибка публикации outbox");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

builder.Services.AddHostedService<OutboxPublisher>();
```

**Очередь задач из HTTP-запросов:**

```csharp
public sealed class EmailQueue
{
    private readonly Channel<EmailJob> _channel =
        Channel.CreateBounded<EmailJob>(new BoundedChannelOptions(1_000)
        {
            FullMode = BoundedChannelFullMode.Wait
        });

    public ValueTask EnqueueAsync(EmailJob job, CancellationToken ct) => _channel.Writer.WriteAsync(job, ct);
    public IAsyncEnumerable<EmailJob> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

public sealed class EmailWorker(EmailQueue queue, IServiceScopeFactory scopes) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.ReadAllAsync(stoppingToken))
        {
            await using var scope = scopes.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<IEmailSender>().SendAsync(job, stoppingToken);
        }
    }
}
```

Endpoint кладёт задачу в очередь и сразу отвечает `202 Accepted`. Bounded-канал даёт backpressure: при переполнении запись ждёт, а не съедает память.

**Правила хорошего worker'а:**

- **Скоуп на итерацию.** Worker — singleton; `DbContext` из конструктора жил бы вечно.
- **`try/catch` вокруг итерации.** Иначе первое же исключение остановит весь хост (поведение по умолчанию с .NET 6).
- **`stoppingToken` везде** — в `Delay`, в запросах, в чтении очереди, чтобы остановка была быстрой.
- **`PeriodicTimer` вместо `Task.Delay` в цикле** — не накапливает дрейф и не создаёт таймер на каждой итерации.
- **Без `async void` и `Task.Run` из контроллеров** — такую работу хост не отслеживает, ошибки теряются.

**Ограничения in-memory очереди.** Канал живёт в памяти процесса: при рестарте или падении задачи пропадут, а при нескольких инстансах каждый обрабатывает только своё. Для надёжной обработки нужен внешний брокер (RabbitMQ, Kafka, SQS) или таблица-очередь в БД с outbox. Для задач по расписанию с гарантией «ровно один инстанс» — Quartz.NET с кластерным хранилищем или Hangfire, либо distributed lock (например, `pg_advisory_lock`).

**Отдельный процесс.** Тяжёлые worker'ы часто выносят в отдельный Worker Service (`dotnet new worker`) — тот же Generic Host без Kestrel. Так они масштабируются и деплоятся независимо от API и не делят с ним CPU.

## Как хранить secrets/configuration?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-hranit-secrets-configuration
tags: security
```

Несекретная конфигурация живёт в `appsettings.json` и `appsettings.{Environment}.json` в репозитории, а секреты (строки подключения с паролями, API-ключи, ключи подписи) — никогда не в git: локально в User Secrets, в окружениях — в переменных окружения, смонтированных файлах или хранилище секретов (Azure Key Vault, AWS Secrets Manager, HashiCorp Vault). Код при этом не меняется: всё читается через один `IConfiguration`.

**Почему это работает без изменений кода.** Конфигурация — набор провайдеров, наложенных друг на друга; более поздний перекрывает ключи предыдущего. Порядок по умолчанию у `WebApplication.CreateBuilder`:

1. `appsettings.json`
2. `appsettings.{Environment}.json`
3. User Secrets — только в `Development`
4. переменные окружения
5. аргументы командной строки

```csharp
var cs = builder.Configuration.GetConnectionString("Orders");
builder.Services.AddOptions<PaymentOptions>()
    .BindConfiguration("Payment")
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

**Источники по окружениям:**

| Где | Чем | Пример |
| --- | --- | --- |
| Машина разработчика | User Secrets | `dotnet user-secrets set "Payment:ApiKey" "..."` |
| Контейнер / CI | переменные окружения | `Payment__ApiKey=...` (двойное подчёркивание вместо `:`) |
| Kubernetes | Secret как env или файлы | `AddKeyPerFile("/run/secrets")` — имя файла = ключ |
| Облако | Key Vault / Secrets Manager | `AddAzureKeyVault(uri, new DefaultAzureCredential())` |

**User Secrets — не шифрование.** Это обычный JSON в профиле пользователя (`%APPDATA%\Microsoft\UserSecrets\<id>\secrets.json` или `~/.microsoft/usersecrets/...`). Его смысл — держать секреты вне каталога проекта, чтобы они не попали в коммит.

**Хранилище секретов и managed identity.** Лучший вариант в облаке: приложение аутентифицируется в Key Vault через managed identity / workload identity, поэтому в конфигурации нет даже «секрета для доступа к секретам». Хранилище даёт аудит доступа, ротацию и разграничение прав.

**Подводные камни:**

- **Переменные окружения видны** через `/proc/<pid>/environ`, `docker inspect`, дампы процесса и в логах падений. Файлы с ограниченными правами и хранилища надёжнее.
- **Логирование конфигурации.** `builder.Configuration.GetDebugView()` или лог всего объекта options раскрывает пароли.
- **Ротация.** Секрет, прочитанный один раз при старте в singleton, не обновится. Для ротируемых значений используйте `IOptionsMonitor` и провайдер с перезагрузкой (Key Vault поддерживает `ReloadInterval`), либо короткоживущие токены вместо паролей.
- **Валидация при старте.** `ValidateOnStart()` роняет приложение сразу, если секрет не задан, а не через час на первом платеже.
- **Секрет уже попал в git** — его нужно ротировать, удаления из истории недостаточно.
- Строки подключения без пароля (Entra ID-аутентификация к SQL, IAM-аутентификация к RDS) убирают проблему целиком.

## Как реализовать API versioning?

```yaml
category: aspnet-core
level: middle
difficulty: 4
slug: aspnet-core-kak-realizovat-api-versioning
tags: api-design
```

В ASP.NET Core версионирование обычно делают библиотекой `Asp.Versioning` (наследник `Microsoft.AspNetCore.Mvc.Versioning`): пакет `Asp.Versioning.Http` для Minimal API, `Asp.Versioning.Mvc` для контроллеров. Она читает версию из URL, query, заголовка или media type, маршрутизирует запрос на нужную реализацию и сообщает клиентам о поддерживаемых и устаревших версиях.

**Способы передачи версии:**

| Способ | Пример | Плюсы / минусы |
| --- | --- | --- |
| Сегмент URL | `/api/v2/orders` | наглядно, кэшируется, легко в логах; URL ресурса зависит от версии |
| Query string | `/api/orders?api-version=2.0` | путь стабилен; легко забыть |
| Заголовок | `X-Api-Version: 2` | чистые URL; не видно в браузере, сложнее в кэше |
| Media type | `Accept: application/json; v=2` | «правильно» по REST; неудобно клиентам |

На практике чаще всего выбирают URL-сегмент — из-за простоты для клиентов и гейтвеев.

**Minimal API:**

```csharp
builder.Services.AddApiVersioning(o =>
{
    o.DefaultApiVersion = new ApiVersion(1);
    o.AssumeDefaultVersionWhenUnspecified = true;
    o.ReportApiVersions = true;
    o.ApiVersionReader = ApiVersionReader.Combine(
        new UrlSegmentApiVersionReader(),
        new HeaderApiVersionReader("X-Api-Version"));
})
.AddApiExplorer(o =>
{
    o.GroupNameFormat = "'v'VVV";
    o.SubstituteApiVersionInUrl = true;
});

var orders = app.NewVersionedApi("Orders");

var v1 = orders.MapGroup("/api/v{version:apiVersion}/orders").HasApiVersion(1.0);
v1.MapGet("/{id}", (int id) => new OrderV1(id, "pending"));

var v2 = orders.MapGroup("/api/v{version:apiVersion}/orders").HasApiVersion(2.0);
v2.MapGet("/{id}", (int id) => new OrderV2(id, new Status("pending", DateTime.UtcNow)));
```

**Контроллеры:**

```csharp
[ApiController]
[ApiVersion(1.0, Deprecated = true)]
[ApiVersion(2.0)]
[Route("api/v{version:apiVersion}/orders")]
public class OrdersController : ControllerBase
{
    [HttpGet("{id}"), MapToApiVersion(1.0)]
    public OrderV1 GetV1(int id) => ...;

    [HttpGet("{id}"), MapToApiVersion(2.0)]
    public OrderV2 GetV2(int id) => ...;
}
```

**Что даёт библиотека:**

- `ReportApiVersions` добавляет заголовки `api-supported-versions` и `api-deprecated-versions` — клиент видит, что его версия устаревает.
- Запрос несуществующей версии получает осмысленную ошибку в формате ProblemDetails (код `UnsupportedApiVersion`), а не попадает в чужой обработчик.
- `AddApiExplorer` группирует endpoint'ы по версиям — по документу OpenAPI на версию.
- Политики sunset позволяют объявить дату отключения версии.

**Что спрашивают дальше:**

- **Когда нужна новая версия.** Только при breaking change: удаление или переименование поля, смена типа, новая обязательная валидация, изменение семантики. Добавление необязательного поля или нового endpoint'а — не повод.
- **Как не размножать код.** Общая доменная логика одна, версии отличаются только DTO и маппингом на границе.
- **Сколько версий держать.** Обычно текущую и предыдущую, со сроком поддержки и мониторингом трафика по версиям перед отключением.

## Как сделать idempotent API endpoint?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-sdelat-idempotent-api-endpoint
tags: idempotency
```

Идемпотентный endpoint — такой, повторный вызов которого с теми же данными не меняет результат: второй платёж не списывается, второй заказ не создаётся. `GET`, `PUT`, `DELETE` идемпотентны по семантике, а `POST` делают идемпотентным через ключ идемпотентности: клиент генерирует уникальный `Idempotency-Key`, сервер запоминает результат первого запроса с этим ключом и на повторы возвращает его же.

**Зачем.** Клиент отправил `POST /payments`, ответ потерялся по таймауту. Он не знает, прошёл ли платёж, и повторяет запрос. Без идемпотентности — двойное списание.

**Базовая реализация:**

```csharp
app.MapPost("/payments", async (
    [FromHeader(Name = "Idempotency-Key")] Guid key,
    CreatePayment cmd,
    AppDbContext db,
    CancellationToken ct) =>
{
    var existing = await db.IdempotencyRecords.FindAsync([key], ct);
    if (existing is not null)
        return existing.RequestHash == cmd.Hash()
            ? Results.Json(existing.Response, statusCode: existing.StatusCode)
            : Results.UnprocessableEntity("Ключ уже использован с другими данными");

    await using var tx = await db.Database.BeginTransactionAsync(ct);
    var payment = Payment.Create(cmd);
    db.Payments.Add(payment);
    db.IdempotencyRecords.Add(new IdempotencyRecord(key, cmd.Hash(), 201, payment.ToDto()));

    try
    {
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }
    catch (DbUpdateException) when (IsUniqueViolation(db))
    {
        return Results.Conflict("Запрос с этим ключом уже обрабатывается");
    }

    return Results.Created($"/payments/{payment.Id}", payment.ToDto());
});
```

**Ключевые моменты:**

- **Уникальный индекс на ключ** — единственная надёжная защита от гонки двух одновременных повторов. Проверка «есть ли запись» без него пропустит оба запроса.
- **Запись ключа и бизнес-изменение в одной транзакции.** Иначе можно сохранить платёж и упасть до сохранения ключа — повтор создаст второй.
- **Хэш запроса.** Тот же ключ с другим телом — ошибка клиента, отвечаем `422`, а не возвращаем чужой результат.
- **TTL.** Записи хранят ограниченное время (сутки–неделю) и чистят фоновой задачей.
- **Ключ привязан к клиенту** — к пользователю или API-ключу, чтобы один клиент не мог получить ответ другого.

**Идемпотентность без ключа.** Иногда естественный ключ уже есть в домене: номер заказа из внешней системы, `(userId, invoiceId)`, ID события из очереди. Тогда достаточно уникального ограничения и `INSERT ... ON CONFLICT DO NOTHING` — повтор просто ничего не изменит.

**Другие методы тоже требуют внимания:**

- `PUT` с полной заменой ресурса идемпотентен, но `PUT`, который делает `balance += amount`, — нет.
- `DELETE` повторно может вернуть `404` вместо `204` — код ответа разный, но состояние то же, это допустимо.
- Побочные эффекты (письма, события в брокер) тоже должны срабатывать один раз — их публикуют через outbox в той же транзакции.

Распространённый формат — заголовок `Idempotency-Key`, как у Stripe; для него есть черновик стандарта IETF.

## Как устроен конвейер ASP.NET Core изнутри и что происходит от сокета до эндпоинта?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-kak-ustroen-konveier-asp-net-core-iznutri-i-chto-proishodit-ot-soketa
tags: pipeline, internals
```

Путь запроса состоит из двух уровней: **транспорт и протокол** внутри Kestrel (сокет → пайпы → TLS → HTTP-парсер) и **хостинг-слой** ASP.NET Core (создание `HttpContext` → middleware → routing → endpoint). Между ними интерфейс `IHttpApplication<TContext>`: Kestrel ничего не знает о middleware, он лишь вызывает `CreateContext`, `ProcessRequestAsync` и `DisposeContext`.

**1. Транспорт.** По умолчанию — сокетный транспорт (`System.Net.Sockets`). На Linux асинхронный ввод-вывод идёт через epoll-движок сокетов, на Windows — IOCP. Accept-цикл принимает соединение и оборачивает сокет в `ConnectionContext` с парой `System.IO.Pipelines`: транспорт пишет прочитанные байты в входной пайп и забирает из выходного то, что нужно отправить. Работа распределяется по нескольким I/O-очередям (`SocketTransportOptions.IOQueueCount`), выделенного потока на соединение нет — всё на thread pool.

**2. Connection middleware.** Над соединением строится свой конвейер `ConnectionDelegate`: TLS-рукопожатие (`HttpsConnectionMiddleware` поверх `SslStream`, выбор протокола по ALPN), логирование соединения, лимиты. Здесь же можно вставить свой слой через `ListenOptions.Use(...)`.

**3. HTTP-протокол.** По результату ALPN или настройкам выбирается `Http1Connection`, `Http2Connection` или HTTP/3 поверх QUIC. HTTP/1.x-парсер разбирает стартовую строку и заголовки прямо из `ReadOnlySequence<byte>` без промежуточных строк; известные заголовки хранятся в предвычисленных полях, а не в словаре. В HTTP/2 соединение демультиплексируется на стримы, и каждый стрим — отдельный запрос.

**4. Создание контекста.** Kestrel вызывает `HostingApplication.CreateContext`: создаётся `DefaultHttpContext` поверх коллекции features (`IHttpRequestFeature`, `IHttpResponseFeature`, `IHttpConnectionFeature` и т.д. — их реализует сам объект протокола Kestrel). Для HTTP/1.1 объекты контекста переиспользуются между запросами одного соединения, что снижает аллокации. Здесь же стартует `Activity` (распределённый трейсинг), log scope с `RequestId` и метрики `http.server.request.duration`, создаётся DI-скоуп для `RequestServices`.

**5. Middleware.** `ProcessRequestAsync` вызывает собранный при старте `RequestDelegate` — цепочку middleware.

**6. Routing.** `EndpointRoutingMiddleware` (`UseRouting`) прогоняет путь через DFA-матчер, построенный по всем зарегистрированным маршрутам, учитывает ограничения (`{id:int}`, HTTP-метод, хост) и кладёт выбранный `Endpoint` с метаданными в `IEndpointFeature`. Следующие middleware (auth, CORS, rate limiting) читают эти метаданные.

**7. Endpoint.** `EndpointMiddleware` вызывает `Endpoint.RequestDelegate`. Для Minimal API это делегат, сгенерированный `RequestDelegateFactory` при старте (или source generator'ом при AOT): binding параметров, вызов лямбды, сериализация результата. Для MVC — `ControllerActionInvoker` с фильтрами, model binding и выбором форматтера.

**8. Обратный путь.** Ответ пишется в `PipeWriter` выходного пайпа; Kestrel формирует заголовки при первой записи или flush, применяет chunked-кодирование или фреймы HTTP/2, транспорт отправляет байты в сокет. После завершения `DisposeContext` закрывает Activity, логирует завершение, освобождает DI-скоуп.

```csharp
builder.WebHost.ConfigureKestrel(k =>
    k.ListenAnyIP(8080, listen =>
        listen.Use(next => async connection =>
        {
            Console.WriteLine($"conn {connection.ConnectionId} from {connection.RemoteEndPoint}");
            await next(connection);
        })));
```

**Почему это важно на практике:**

- **Нет потока на запрос.** Блокирующий вызов (`.Result`, синхронный I/O) держит поток thread pool, а не «свой» поток — под нагрузкой это приводит к thread pool starvation, от которой страдают все запросы и даже чтение из сокетов.
- **Backpressure встроен в пайпы.** Если приложение не успевает читать тело или клиент медленно забирает ответ, пайп перестаёт читать или писать — память не растёт бесконтрольно. Пороги задают `MaxRequestBufferSize` и `MaxResponseBufferSize`.
- **`HttpContext` нельзя использовать после завершения запроса** — объекты переиспользуются, и обращение из фоновой задачи даст чужие или испорченные данные.
- **Features — точка расширения.** Через них работают `UseForwardedHeaders` (подменяет IP и схему), тестовый сервер, IIS in-process — тот же пайплайн без Kestrel.

## Как Kestrel обрабатывает соединения и какие лимиты стоит настраивать под высокую нагрузку?

```yaml
category: aspnet-core
level: senior
difficulty: 5
slug: advanced-aspnet-kak-kestrel-obrabatyvaet-soedineniya-i-kakie-limity-stoit-nastraivat-p
tags: kestrel, scalability
```

Kestrel — асинхронный сервер без выделенного потока на соединение: сокетный транспорт принимает соединения и обслуживает их через неблокирующий I/O на thread pool, а данные передаёт протокольному слою через `System.IO.Pipelines`. Под высокой нагрузкой настраивают не столько «скорость», сколько защитные лимиты: число соединений, размеры и таймауты запросов, минимальную скорость передачи данных, параметры HTTP/2 и backlog.

**Как обрабатывается соединение.**

- Accept-цикл берёт соединение из очереди ядра (`backlog`, по умолчанию 512 у сокетного транспорта).
- Чтение и запись в сокет распределены по I/O-очередям (`IOQueueCount`, по умолчанию `min(ProcessorCount, 16)`). Callback'и epoll/IOCP ставят продолжения в эти очереди, оттуда код идёт на thread pool.
- Пока соединение простаивает в keep-alive, на него не тратится поток — только буферы и объекты соединения. Поэтому десятки тысяч открытых соединений — норма, а узкое место обычно в приложении.

**Лимиты `KestrelServerLimits`:**

| Лимит | По умолчанию | Зачем трогать |
| --- | --- | --- |
| `MaxConcurrentConnections` | без ограничения | верхняя граница по памяти и дескрипторам; лишние соединения сразу закрываются |
| `MaxConcurrentUpgradedConnections` | без ограничения | WebSocket живут долго и копятся |
| `MaxRequestBodySize` | ~30 МБ | уменьшить для API, увеличить точечно для загрузки файлов (`[RequestSizeLimit]`) |
| `MaxRequestHeadersTotalSize` / `MaxRequestHeaderCount` | 32 КБ / 100 | большие JWT и куки упираются сюда — ответ `431` |
| `KeepAliveTimeout` | 130 с | должен быть больше, чем idle timeout балансировщика перед Kestrel |
| `RequestHeadersTimeout` | 30 с | защита от slowloris — медленной отправки заголовков |
| `MinRequestBodyDataRate` / `MinResponseDataRate` | 240 байт/с с grace 5 с | отсекают клиентов, которые держат соединение, почти не передавая данных |
| `Http2.MaxStreamsPerConnection` | 100 | параллелизм внутри одного соединения |

```csharp
builder.WebHost.ConfigureKestrel(k =>
{
    k.Limits.MaxConcurrentConnections = 20_000;
    k.Limits.MaxConcurrentUpgradedConnections = 5_000;
    k.Limits.MaxRequestBodySize = 1 * 1024 * 1024;
    k.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(75);
    k.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(10);
    k.Limits.MinRequestBodyDataRate = new MinDataRate(bytesPerSecond: 1024, gracePeriod: TimeSpan.FromSeconds(5));
    k.Limits.Http2.MaxStreamsPerConnection = 200;
    k.AddServerHeader = false;
});

builder.WebHost.UseSockets(o => o.Backlog = 2048);
```

**На что смотреть кроме лимитов Kestrel:**

- **Thread pool.** Kestrel устойчив к тысячам соединений, но не к sync-over-async в приложении. Starvation проявляется ростом `threadpool-queue-length` и медленным приростом числа потоков. Лечится устранением блокировок; `ThreadPool.SetMinThreads` — временный пластырь.
- **Ограничения ОС.** Лимит дескрипторов (`ulimit -n`), `net.core.somaxconn` (обрезает backlog), диапазон эфемерных портов для исходящих соединений, conntrack-таблица на нодах Kubernetes.
- **Буферы.** `MaxRequestBufferSize` (по умолчанию 1 МБ) и `MaxResponseBufferSize` (64 КБ) — пороги backpressure на соединение. Увеличение повышает пропускную способность для больших тел, но умножается на число соединений.
- **Балансировщик.** Если перед Kestrel nginx или облачный LB, реальное число соединений к приложению определяется его пулом upstream-соединений. Несогласованные keep-alive таймауты (LB держит соединение дольше, чем Kestrel) дают редкие `502` — классический источник «плавающих» ошибок.
- **TLS.** Рукопожатие дорого по CPU. При множестве коротких соединений TLS выгодно завершать на балансировщике или обеспечить переиспользование соединений клиентами.
- **GC.** Server GC по умолчанию для ASP.NET Core; в контейнерах с малыми лимитами памяти стоит проверить настройки (`DOTNET_GCHeapHardLimit`, DATAS в .NET 9+).

**Что спросят дальше.** Как защититься от медленных клиентов (data rate, таймауты, лимиты на гейтвее), почему `MaxConcurrentConnections` не заменяет rate limiting (он считает соединения, а не запросы — через одно HTTP/2-соединение идут сотни), и как диагностировать: `dotnet-counters` с провайдером `Microsoft.AspNetCore.Server.Kestrel` (`current-connections`, `connection-queue-length`, `request-queue-length`, `tls-handshakes-per-second`).

## Что меняется для сервера при переходе на HTTP/2 и когда мультиплексирование вредит?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-chto-menyaetsya-dlya-servera-pri-perehode-na-http-2-i-kogda-multipleks
tags: http2, performance
```

С HTTP/2 одно TCP-соединение несёт много параллельных запросов (стримов), заголовки сжимаются HPACK, а данные идут бинарными фреймами с собственным flow control. Для сервера это значит: соединений меньше, но каждое тяжелее и дольше живёт, а ограничивать нужно уже не соединения, а стримы и окна. Вредит мультиплексирование там, где все запросы оказываются «в одной трубе»: при потерях пакетов, при L4-балансировке и при упоре в лимит стримов.

**Что меняется для сервера:**

- **Соединение → стримы.** В Kestrel каждый стрим — отдельный запрос с собственным `HttpContext`. `Http2.MaxStreamsPerConnection` (по умолчанию 100) ограничивает параллелизм на соединение; клиент, упёршийся в лимит, ставит запросы в очередь у себя.
- **Flow control.** У соединения и у каждого стрима есть окно — сколько байт можно отправить без подтверждения. Маленькие окна ограничивают пропускную способность больших ответов на каналах с высоким RTT (`InitialConnectionWindowSize`, `InitialStreamWindowSize`).
- **HPACK.** Таблица сжатия заголовков хранится на каждое соединение (`HeaderTableSize`) — экономит трафик на повторяющихся заголовках (куки, токены), но стоит памяти.
- **Длинные соединения.** Клиенты держат одно соединение часами. Нужны keep-alive пинги (`KeepAlivePingDelay`, `KeepAlivePingTimeout`), чтобы находить мёртвые соединения за NAT.
- **TLS и ALPN.** Браузеры поддерживают HTTP/2 только поверх TLS, протокол выбирается при рукопожатии. Без TLS возможен h2c с prior knowledge — типично для gRPC внутри кластера, но тогда endpoint должен слушать только HTTP/2.
- **Остановка.** Сервер шлёт `GOAWAY`: текущие стримы доживают, новые клиент открывает в другом соединении.

```csharp
builder.WebHost.ConfigureKestrel(k =>
{
    k.ListenAnyIP(5001, l => { l.Protocols = HttpProtocols.Http1AndHttp2; l.UseHttps(); });
    k.ListenAnyIP(5002, l => l.Protocols = HttpProtocols.Http2);
    k.Limits.Http2.MaxStreamsPerConnection = 100;
    k.Limits.Http2.KeepAlivePingDelay = TimeSpan.FromSeconds(30);
    k.Limits.Http2.KeepAlivePingTimeout = TimeSpan.FromSeconds(20);
});
```

**Когда мультиплексирование вредит:**

1. **TCP head-of-line blocking.** Стримы независимы на уровне HTTP, но идут в одном TCP-потоке. Потерянный пакет задерживает доставку всех стримов, пока не придёт ретрансмит. На сетях с потерями (мобильные) HTTP/2 может работать хуже, чем шесть параллельных HTTP/1.1-соединений. Это и решает HTTP/3.
2. **Балансировка на L4.** Балансировщик TCP распределяет соединения, а не запросы. gRPC-клиент открывает одно соединение и шлёт по нему всё — весь его трафик попадает на один под, новые реплики при автоскейлинге не получают нагрузки. Решения: L7-балансировщик (Envoy, YARP, ingress с поддержкой HTTP/2), клиентская балансировка gRPC, периодическая ротация соединений (`MaxConnectionAge` на стороне сервера gRPC или `PooledConnectionLifetime` у клиента).
3. **Упор в лимит стримов.** Сервис-клиент на `HttpClient` с одним HTTP/2-соединением и 100 стримами ставит остальные запросы в очередь — растёт латентность без видимой нагрузки на сервер. Лечится `SocketsHttpHandler.EnableMultipleHttp2Connections = true`.
4. **Большие загрузки.** Один большой стрим конкурирует за окно соединения с мелкими запросами; при малых окнах страдает и throughput загрузки, и латентность остальных.
5. **Ресурсы на соединение.** Злоумышленнику дешевле нагрузить сервер: один клиент открывает и сразу сбрасывает тысячи стримов (атака HTTP/2 Rapid Reset, CVE-2023-44487) или заваливает сервер служебными фреймами. Kestrel получил защиту в патчах, но обновлять рантайм и держать лимиты нужно обязательно.

**Что проверяют на собеседовании:** понимание, что HTTP/2 убирает head-of-line blocking на уровне HTTP, но не на уровне TCP; что `MaxConcurrentConnections` при HTTP/2 почти ничего не ограничивает; и почему gRPC требует особого подхода к балансировке.

## Какие проблемы решает HTTP/3 и QUIC, и когда переход оправдан?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-kakie-problemy-reshaet-http-3-i-quic-i-kogda-perehod-opravdan
tags: http3, performance
```

HTTP/3 переносит HTTP поверх QUIC — транспорта на UDP со встроенным TLS 1.3. Он решает проблемы, которые HTTP/2 унаследовал от TCP: head-of-line blocking на уровне транспорта, долгое установление соединения и разрыв при смене сети. Переход оправдан для клиентов на нестабильных сетях с высоким RTT (мобильные, международный трафик); между сервисами внутри дата-центра выигрыш обычно отсутствует.

**Что решает:**

| Проблема TCP + TLS | Как в QUIC |
| --- | --- |
| Потеря пакета блокирует все стримы соединения | стримы независимы на транспортном уровне, потеря задерживает только свой стрим |
| TCP-handshake + TLS-handshake = 2–3 RTT | транспорт и криптография в одном рукопожатии: 1 RTT, при возобновлении — 0-RTT |
| Смена IP (Wi-Fi → LTE) рвёт соединение | соединение идентифицируется connection ID, а не четвёркой адресов — миграция без переподключения |
| Эволюция TCP упирается в ядра ОС и middlebox'ы | QUIC работает в user space и шифрует почти все заголовки — протокол можно менять |

**Поддержка в ASP.NET Core.** Kestrel поддерживает HTTP/3 с .NET 7 (в .NET 6 — preview). Нужна библиотека `msquic`: на Windows — Windows 11 / Server 2022 и новее, на Linux — пакет `libmsquic`. HTTPS обязателен.

```csharp
builder.WebHost.ConfigureKestrel(k =>
    k.ListenAnyIP(443, l =>
    {
        l.Protocols = HttpProtocols.Http1AndHttp2AndHttp3;
        l.UseHttps();
    }));
```

Клиент сначала приходит по TCP (HTTP/1.1 или HTTP/2), получает заголовок `Alt-Svc: h3=":443"` и следующие запросы пробует слать по QUIC. Поэтому TCP-endpoint нужен всегда, а UDP-порт должен быть открыт на всём пути. В `HttpClient` HTTP/3 включается через `request.Version = HttpVersion.Version30` и `VersionPolicy`.

**Цена и риски:**

- **UDP режут.** Корпоративные файрволы и некоторые провайдеры блокируют или ограничивают UDP/443. Клиенты откатываются на TCP, так что сломаться ничего не должно, но и выигрыша нет.
- **CPU.** Шифрование каждого пакета в user space, меньше аппаратных оффлоадов, чем у TCP, — QUIC заметно дороже по CPU на гигабайт трафика.
- **Балансировка.** L4-балансировщик должен уметь UDP и маршрутизировать по connection ID, иначе миграция соединения ломается. Многие облачные LB и ingress-контроллеры поддерживают HTTP/3 только на внешней стороне.
- **Наблюдаемость.** `tcpdump` и привычные инструменты видят зашифрованный UDP; для отладки нужны qlog и ключи сессии.
- **0-RTT опасен для неидемпотентных запросов.** Ранние данные можно переиграть (replay), поэтому на них допустимы только безопасные методы.

**Когда переход оправдан:**

- публичные API и сайты с большой долей мобильного трафика или пользователями далеко от дата-центра — особенно много мелких параллельных запросов;
- длинные сессии у мобильных клиентов, где важна миграция соединения;
- когда HTTP/3 можно получить «бесплатно» на CDN или edge-балансировщике, а до Kestrel трафик идёт по HTTP/1.1 или HTTP/2 внутри дата-центра — самый частый практический вариант.

**Когда не стоит:** межсервисное взаимодействие в одном дата-центре (RTT доли миллисекунды, потерь почти нет — HTTP/2 или gRPC проще и дешевле), окружения без поддержки msquic, инфраструктура без UDP-балансировки. Решение принимают по метрикам: доля потерь пакетов, p95/p99 времени до первого байта у реальных клиентов, сравнение A/B.

## Как настроить пул соединений HttpClient и почему статический HttpClient не решает всех проблем?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-kak-nastroit-pul-soedinenii-httpclient-i-pochemu-staticheskii-httpclie
tags: httpclient, connections
```

Пул соединений живёт не в `HttpClient`, а в его обработчике — `SocketsHttpHandler`: на каждую комбинацию «схема + хост + порт (+ прокси)» он держит набор открытых TCP-соединений и переиспользует их между запросами. Статический `HttpClient` решает проблему исчерпания сокетов, но создаёт другую: его соединения живут вечно и не замечают смены DNS, а одна общая конфигурация не подходит для разных upstream'ов.

**Ключевые настройки `SocketsHttpHandler`:**

| Свойство | По умолчанию | Смысл |
| --- | --- | --- |
| `PooledConnectionLifetime` | бесконечно | сколько живёт соединение, прежде чем его закроют после текущего запроса — ротация для DNS и балансировки |
| `PooledConnectionIdleTimeout` | 1 минута | закрыть простаивающее соединение |
| `MaxConnectionsPerServer` | без ограничения | верхняя граница соединений к одному хосту; сверх неё запросы ждут в очереди |
| `ConnectTimeout` | бесконечно (ограничен `HttpClient.Timeout`) | таймаут установления соединения |
| `EnableMultipleHttp2Connections` | `false` | разрешить больше одного HTTP/2-соединения при упоре в лимит стримов |
| `KeepAlivePingDelay` / `KeepAlivePingTimeout` | выключено | пинги HTTP/2 для обнаружения мёртвых соединений |

```csharp
var handler = new SocketsHttpHandler
{
    PooledConnectionLifetime = TimeSpan.FromMinutes(5),
    PooledConnectionIdleTimeout = TimeSpan.FromSeconds(30),
    MaxConnectionsPerServer = 200,
    ConnectTimeout = TimeSpan.FromSeconds(3),
    EnableMultipleHttp2Connections = true
};
var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(10) };
```

С `IHttpClientFactory` то же самое:

```csharp
builder.Services.AddHttpClient<PaymentsClient>(c =>
    {
        c.BaseAddress = new Uri("https://payments.internal");
        c.Timeout = TimeSpan.FromSeconds(10);
    })
    .UseSocketsHttpHandler((h, _) =>
    {
        h.PooledConnectionLifetime = TimeSpan.FromMinutes(5);
        h.MaxConnectionsPerServer = 200;
    })
    .SetHandlerLifetime(Timeout.InfiniteTimeSpan)
    .AddStandardResilienceHandler();
```

Если ротацию соединений обеспечивает `PooledConnectionLifetime`, ротацию самих обработчиков фабрикой можно отключить — лишняя пересборка пула не нужна.

**Почему статический `HttpClient` не решает всего:**

- **DNS.** Без `PooledConnectionLifetime` соединение, открытое на старый IP, живёт, пока используется. При blue-green деплое, failover базы или смене IP за DNS-именем трафик продолжит идти на старый адрес.
- **Балансировка.** Долгоживущие соединения к сервису за L4-балансировщиком «прилипают» к тем бэкендам, что были при открытии, — новые реплики не получают нагрузки.
- **Одна конфигурация на всё.** Разным upstream'ам нужны разные таймауты, retry-политики, сертификаты, заголовки. Одним статическим клиентом это не выразить, а изменение `DefaultRequestHeaders` у разделяемого экземпляра — гонка.
- **Нет DelegatingHandler-конвейера из DI.** Логирование, трейсинг, токены, resilience-политики удобнее собирать через фабрику.
- **Тестируемость.** Статику не подменить в тестах.
- **Неограниченный пул.** `MaxConnectionsPerServer` по умолчанию не ограничен: при деградации upstream'а клиент откроет тысячи соединений и добьёт его (и свои эфемерные порты). Иногда разумнее ограничить и получить очередь.

**Что спросят дальше.** Как диагностировать очередь в пуле: метрики `System.Net.Http` (.NET 8+) — `http.client.open_connections`, `http.client.request.time_in_queue`, `http.client.connection.duration`. Чем HTTP/2 меняет картину: одно соединение на хост, лимит стримов, поэтому `MaxConnectionsPerServer` почти не важен, а `EnableMultipleHttp2Connections` — важен.

## Почему возникает исчерпание портов при использовании HttpClient и как это диагностировать?

```yaml
category: aspnet-core
level: senior
difficulty: 5
slug: advanced-aspnet-pochemu-voznikaet-ischerpanie-portov-pri-ispolzovanii-httpclient-i-kak
tags: httpclient, connections
```

Исчерпание портов возникает, когда приложение открывает исходящие TCP-соединения быстрее, чем освобождаются локальные эфемерные порты. Каждое исходящее соединение занимает локальный порт, а после закрытия этот порт ещё некоторое время держится в состоянии `TIME_WAIT`. Классическая причина — `new HttpClient()` (и `Dispose`) на каждый запрос: пул соединений выбрасывается вместе с клиентом, и каждый вызов открывает новое соединение.

```csharp
public async Task<string> GetAsync(string url)
{
    using var client = new HttpClient();
    return await client.GetStringAsync(url);
}
```

**Механика:**

- Диапазон эфемерных портов ограничен: на Windows по умолчанию 49152–65535 (~16 тысяч), на Linux `net.ipv4.ip_local_port_range` обычно 32768–60999 (~28 тысяч).
- `TIME_WAIT` остаётся на стороне, которая первой закрыла соединение. При `Dispose` клиента это ваш сервис. На Linux состояние длится 60 секунд, на Windows — до двух минут по умолчанию.
- Порт занят парой «локальный адрес + удалённый адрес + порт», поэтому лимит считается на конкретный удалённый endpoint. При 300 RPS к одному upstream с новым соединением на каждый запрос за 60 секунд накапливается 18 000 сокетов в `TIME_WAIT` — диапазон Windows уже исчерпан.

**Другие причины, кроме `new HttpClient()`:**

- `PooledConnectionLifetime` или `IdleTimeout` слишком маленькие — соединения не успевают переиспользоваться.
- Upstream или прокси закрывает соединение после каждого ответа (`Connection: close`, HTTP/1.0, keep-alive выключен) — проблема на стороне сервера, но порты кончаются у вас.
- Не читается тело ответа: соединение с недочитанным ответом нельзя вернуть в пул, и пул открывает новое. Особенно с `HttpCompletionOption.ResponseHeadersRead` без `Dispose` ответа.
- Неограниченный `MaxConnectionsPerServer` при медленном upstream: запросы не ждут свободного соединения, а открывают новые.
- **SNAT в облаке.** За NAT-шлюзом или облачным балансировщиком (Azure App Service, AKS с outbound LB, AWS NAT Gateway) лимит портов на инстанс намного меньше системного — исчерпание наступает раньше, чем в ОС.
- Те же проблемы у других клиентов: соединения к Redis, БД без пула, SMTP.

**Симптомы:**

- Windows: `SocketException (10048): Only one usage of each socket address (protocol/network address/port) is normally permitted`.
- Linux: `Cannot assign requested address` (`EADDRNOTAVAIL`).
- Ошибки соединения волнами под нагрузкой, сами проходят через минуту-две после спада трафика.

**Диагностика:**

```bash
ss -s
ss -tan state time-wait | awk '{print $4}' | sort | uniq -c | sort -rn | head
netstat -ano | find /c "TIME_WAIT"
dotnet-counters monitor -p <pid> --counters System.Net.Http
```

1. Посчитать сокеты в `TIME_WAIT` и `ESTABLISHED` по удалённым адресам — сразу видно, к какому upstream'у утечка.
2. Посмотреть метрики `System.Net.Http`: если число открытых соединений и частота их создания растут вместе с RPS, пул не работает.
3. Найти в коде `new HttpClient` в методах, `using` вокруг клиента, создание клиента в transient-сервисах без фабрики.
4. В облаке — метрики SNAT-портов балансировщика или NAT-шлюза.

**Исправление:** один долгоживущий `HttpClient` с `SocketsHttpHandler` и разумным `PooledConnectionLifetime` либо `IHttpClientFactory`; всегда `Dispose` для `HttpResponseMessage`; ограничение `MaxConnectionsPerServer`; keep-alive на стороне upstream. Крутить ядро (`tcp_tw_reuse`, расширение диапазона портов) — лишь отсрочка, а `tcp_tw_recycle` на современных ядрах удалён и раньше ломал клиентов за NAT.

## Как IHttpClientFactory решает проблему устаревания DNS?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-kak-ihttpclientfactory-reshaet-problemu-ustarevaniya-dns
tags: httpclient, dns
```

`IHttpClientFactory` периодически пересоздаёт обработчики (`HttpMessageHandler`) вместе с их пулами соединений: по умолчанию каждые 2 минуты (`HandlerLifetime`). Новое соединение в новом пуле заново резолвит DNS, поэтому смена IP за именем хоста подхватывается не позже чем через время жизни обработчика. При этом сами `HttpClient` дешёвые и короткоживущие, а соединения переиспользуются внутри жизни обработчика — исчерпания портов нет.

**Корень проблемы.** DNS резолвится только при открытии TCP-соединения. Долгоживущий `HttpClient` с бесконечным пулом держит соединение к старому IP сколько угодно: TTL DNS-записи здесь не участвует. Если сервис переехал (blue-green, failover, масштабирование за DNS), клиент продолжает стучаться на старый адрес — пока тот не перестанет отвечать.

**Как устроена ротация:**

1. `factory.CreateClient("payments")` (или typed client) берёт из кэша активную запись обработчика для этого имени — цепочку `DelegatingHandler` с первичным `SocketsHttpHandler` — и создаёт новый лёгкий `HttpClient` поверх неё, не владеющий обработчиком (`disposeHandler: false`).
2. Когда `HandlerLifetime` истекает, запись помечается как устаревшая; следующий `CreateClient` получает новую цепочку с новым пулом.
3. Старый обработчик не закрывается сразу: клиенты, созданные ранее, могут им ещё пользоваться. Фабрика отслеживает его через слабую ссылку и периодически проверяет; когда на него больше нет ссылок, он освобождается вместе с соединениями.

```csharp
builder.Services.AddHttpClient<CatalogClient>(c => c.BaseAddress = new Uri("https://catalog.internal"))
    .SetHandlerLifetime(TimeSpan.FromMinutes(5));
```

**Ловушка: захват клиента в singleton.** Typed client регистрируется как transient. Если внедрить его в singleton, тот навсегда получит один `HttpClient` с одним обработчиком — ротация перестаёт работать, и проблема DNS возвращается.

```csharp
builder.Services.AddSingleton<PriceService>();
public class PriceService(CatalogClient catalog) { }
```

Решения: внедрять `IHttpClientFactory` и вызывать `CreateClient` на каждую операцию; не делать потребителя singleton'ом; либо настроить у первичного обработчика `PooledConnectionLifetime` — тогда ротация соединений происходит внутри одного обработчика, и захват уже не страшен.

**Альтернатива и современная рекомендация.** `SocketsHttpHandler.PooledConnectionLifetime` решает DNS точнее: соединение закрывается после текущего запроса по достижении возраста, а пул и обработчик остаются. В этом случае ротацию обработчиков фабрикой отключают (`SetHandlerLifetime(Timeout.InfiniteTimeSpan)`), а фабрику используют ради конфигурации, DI, `DelegatingHandler`'ов и resilience-политик.

**Что важно понимать:**

- Фабрика не следит за TTL DNS — она просто ограничивает возраст соединений. Значение подбирают по тому, как быстро должна подхватываться смена адреса.
- Слишком короткий `HandlerLifetime` уничтожает пользу пула: частые новые TCP- и TLS-рукопожатия.
- Ротация соединений полезна не только для DNS: она перераспределяет нагрузку между бэкендами за L4-балансировщиком и уводит трафик с инстансов, которые выводят из ротации.
- В .NET Framework первичным обработчиком был `HttpClientHandler` без `PooledConnectionLifetime` — там фабрика была единственным удобным способом решить проблему. В современном .NET под капотом `SocketsHttpHandler`.

## Как влияет порядок middleware на производительность и корректность?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-kak-vliyaet-poryadok-middleware-na-proizvoditelnost-i-korrektnost
tags: middleware, pipeline
```

Порядок middleware определяет две вещи: **сколько работы выполняется до того, как запрос будет отвергнут или обслужен**, и **какие данные видит каждый компонент** (IP клиента, схема, пользователь, выбранный endpoint, тело ответа). Принцип для производительности — дешёвые проверки и short-circuit как можно раньше, дорогие компоненты как можно позже и только там, где нужны. Для корректности — компонент, который меняет контекст, должен стоять раньше тех, кто от этого контекста зависит.

**Корректность: кто от кого зависит.**

- **`UseForwardedHeaders` — первым.** Он подменяет `RemoteIpAddress` и `Scheme` по заголовкам прокси. Если он стоит после HTTPS-редиректа, rate limiter'а или логирования, они видят IP балансировщика и `http`: бесконечные редиректы, все клиенты в одной партиции лимитера, неверные redirect URI в OAuth.
- **Exception handler — до всего, что может бросить**, иначе исключение уходит в Kestrel и клиент получает пустой `500`.
- **`UseRouting` → `UseCors` → `UseAuthentication` → `UseAuthorization`.** CORS, авторизации и rate limiter'у нужны метаданные endpoint'а; preflight-запросы не должны упираться в авторизацию.
- **Rate limiter и пользователь.** Если партиция — по пользователю, лимитер после `UseAuthentication`; если цель — дешёвая защита от флуда по IP, лучше глобальный лимитер раньше и/или на гейтвее.
- **Сжатие.** `UseResponseCompression` сжимает только ответы компонентов, стоящих после него: static files, поставленные выше, уйдут несжатыми. Его положение относительно output cache определяет, что лежит в кэше: несжатый ответ (сжатие повторяется на каждый hit, тратится CPU) или сжатый (тогда ключ кэша обязан учитывать `Accept-Encoding`, иначе клиент без поддержки gzip получит нечитаемое тело).
- **Middleware, читающий тело запроса**, должен включить `EnableBuffering()` и вернуть позицию, иначе model binding дальше увидит пустой поток.

**Производительность: где тратится время.**

```csharp
app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseResponseCompression();
app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseOutputCache();

app.MapHealthChecks("/health/live").ShortCircuit();
app.MapControllers();
```

- **Static files раньше аутентификации и routing'а** — файл отдаётся без проверки токена и прохода по всему конвейеру.
- **Отказ должен быть дешёвым.** Rate limiter, отклоняющий запрос до аутентификации, экономит проверку подписи JWT, похода в БД за правами и десериализацию тела. При атаке это разница между «сервис устоял» и «сервис лёг».
- **Output cache до тяжёлой работы** — cache hit не доходит до контроллера и БД.
- **`ShortCircuit()` (.NET 8+)** у endpoint'а прерывает конвейер сразу после routing: health-проба или `robots.txt` не проходит через аутентификацию, авторизацию, логирование. `MapShortCircuit(404, "wp-admin", ".env")` дёшево отвечает на сканеры.
- **Дорогие middleware — только на нужные ветки.** `UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/api"), b => b.UseHttpLogging())` или метаданные endpoint'а вместо глобальной обработки каждого запроса. Детальное логирование тел (`UseHttpLogging` с телами) на каждом запросе — заметная нагрузка.
- **Каждый лишний слой — это не только время, но и `await` с аллокациями** на горячем пути. Десяток собственных middleware, каждый из которых читает заголовки, создаёт scope логгера и словари, складывается в ощутимый процент CPU.

**Тонкие места:**

- Middleware после `UseRouting` может проверить `ctx.GetEndpoint()` и пропустить работу для эндпоинтов без нужных метаданных — так авторизация и CORS не тратят ресурсы на анонимные endpoint'ы.
- `WebApplication` неявно добавляет `UseRouting` в начало, если вы его не вызвали: тогда все ваши middleware видят endpoint, но и routing выполняется до них — даже для запросов, которые отсекла бы проверка IP.
- Компонент, пишущий ответ (compression, кастомные обёртки `Response.Body`), может сломать стриминг: SSE и большие файлы начинают буферизоваться.

Проверить влияние порядка на практике можно нагрузочным тестом с отказами (сколько стоит отклонённый запрос) и профилированием CPU по фреймам middleware в `dotnet-trace`.

## Как написать middleware, не создающее аллокаций на каждый запрос?

```yaml
category: aspnet-core
level: senior
difficulty: 5
slug: advanced-aspnet-kak-napisat-middleware-ne-sozdayuschee-allokacii-na-kazhdyi-zapros
tags: middleware, allocations
```

Middleware без аллокаций на запрос — это convention-based класс, созданный один раз при сборке конвейера, в котором горячий путь не создаёт объектов: нет замыканий, лишних async-машин состояний, строк, LINQ, словарей и боксинга. Всё, что можно, вычисляется заранее (в конструкторе или статически), а на запрос остаются только чтение заголовков, сравнения и вызов `next`.

**Отправная точка — типичный «аллоцирующий» вариант:**

```csharp
app.Use(async (ctx, next) =>
{
    var sw = Stopwatch.StartNew();
    ctx.Response.OnStarting(() =>
    {
        ctx.Response.Headers["X-Elapsed"] = sw.ElapsedMilliseconds.ToString() + "ms";
        return Task.CompletedTask;
    });
    if (ctx.Request.Headers["X-Tenant"].ToString().ToLower() == "blocked")
    {
        ctx.Response.StatusCode = 403;
        return;
    }
    await next();
});
```

Здесь на каждый запрос: объект `Stopwatch`, замыкание и делегат для `OnStarting`, объединение строк и `ToString`, `ToLower()` создаёт новую строку, перегрузка `Use` с `Func<Task> next` создаёт ещё одно замыкание на `next`, плюс async-машина состояний.

**Тот же функционал без аллокаций на горячем пути:**

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

Метод не `async`: он либо отвечает сразу, либо возвращает задачу следующего компонента — машины состояний нет. Заголовок читается как `StringValues` (структура), сравнение без создания строк. Замер времени, если он нужен, делают через `Stopwatch.GetTimestamp()` и отдают метрикой, а не формируют строку заголовка на каждый запрос. Если колбэк всё же нужен, используют перегрузку со state и статическую лямбду:

```csharp
ctx.Response.OnStarting(static state =>
{
    var c = (HttpContext)state;
    c.Response.Headers.CacheControl = "no-store";
    return Task.CompletedTask;
}, ctx);
```

**Приёмы:**

- **Convention-based класс, а не `IMiddleware`.** Конструктор вызывается один раз; `IMiddleware`, зарегистрированный как scoped или transient, создаётся из DI на каждый запрос.
- **Без `async`, если не нужен.** Метод, который либо отвечает синхронно, либо возвращает `next(ctx)`, может вернуть `Task` напрямую — нет машины состояний. Если `await` есть, машина состояний аллоцируется только при реальной асинхронной приостановке, но лишний `async` всё равно стоит инструкций.
- **Правильная перегрузка `Use`.** `app.Use(Func<HttpContext, Func<Task>, Task>)` создаёт замыкание `() => next(ctx)` на каждый запрос; перегрузка с `RequestDelegate next` (.NET 6+) — нет.
- **Колбэки со state.** `Response.OnStarting(Func<object, Task>, object state)` и `OnCompleted` с тем же сигнатурным приёмом: `static`-лямбда плюс явный state вместо замыкания.
- **Время без объектов.** `Stopwatch.GetTimestamp()` и `Stopwatch.GetElapsedTime(start)` вместо `new Stopwatch`.
- **Заголовки без строк.** `StringValues` — структура; `Count` и индексатор не аллоцируют, а `ToString()` при нескольких значениях склеивает строку. Для известных заголовков есть свойства `ctx.Request.Headers.Authorization`, `ContentType` и т.д. Сравнение — `string.Equals` с `StringComparison`, `MemoryExtensions` по `ReadOnlySpan<char>`, а не `ToLower()`.
- **Метаданные endpoint'а.** `ctx.GetEndpoint()?.Metadata.GetMetadata<T>()` кэшируется на стороне endpoint'а и не аллоцирует; это лучше, чем разбирать путь строками.
- **Логирование.** `LoggerMessage` source generator (`[LoggerMessage]`) — нет боксинга аргументов и строк, если уровень отключён. `BeginScope` со словарём — аллокации на каждый запрос.
- **Пулы.** Временные буферы — `ArrayPool<byte>.Shared` или `stackalloc` для небольших размеров; объекты состояния — `ObjectPool<T>` из `Microsoft.Extensions.ObjectPool`.
- **Не заходить в `HttpContext.Items` и `Features.Set`** без нужды: `Items` — словарь, создаваемый лениво при первом обращении.

**Как проверить.** BenchmarkDotNet с `[MemoryDiagnoser]` на вызове `InvokeAsync` с `DefaultHttpContext` — колонка `Allocated` должна быть `0 B` или известным минимумом. Под нагрузкой — `dotnet-counters` (счётчик `alloc-rate` провайдера `System.Runtime`) и `dotnet-trace` с профилем `gc-verbose` для поиска типов, которые аллоцируются чаще всего.

**Когда это оправдано.** Middleware выполняется на каждом запросе, поэтому 200 байт на запрос при 50 000 RPS — 10 МБ/с мусора и частые GC gen0. Для бизнес-логики внутри одного endpoint'а такая оптимизация обычно не окупается — читаемость важнее; для инфраструктурных middleware, через которые идёт весь трафик, — окупается.

## Как устроен DI-контейнер ASP.NET Core и когда его стоит заменить сторонним?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-kak-ustroen-di-konteiner-asp-net-core-i-kogda-ego-stoit-zamenit-storon
tags: dependency-injection, internals
```

Встроенный контейнер — это `ServiceProvider`, который по списку `ServiceDescriptor` строит для каждого сервиса **call site** (дерево «как создать объект и его зависимости»), а затем превращает call site в скомпилированный делегат-фабрику. Он намеренно минималистичен: конструкторная инъекция, три lifetime'а, `IEnumerable<T>`, open generics и keyed services (.NET 8). Сторонний контейнер нужен, когда требуются возможности сверх этого — декораторы и перехватчики, модули, child-контейнеры для мультитенантности, сканирование по соглашениям, — и их не закрывает Scrutor поверх встроенного.

**Внутреннее устройство:**

- **`CallSiteFactory`** по дескрипторам строит call site: `ConstructorCallSite` (выбранный конструктор и call site'ы параметров), `FactoryCallSite`, `ConstantCallSite`, `IEnumerableCallSite`, плюс обёртки кэширования по lifetime (root, scope, нет кэша для transient). Call site'ы кэшируются, циклические зависимости детектируются здесь.
- **Движок разрешения.** Первые обращения к сервису выполняются интерпретатором call site'ов через reflection (`CallSiteRuntimeResolver`) — это быстро для старта. Если сервис разрешается повторно, в фоне он компилируется в делегат через IL emit (или expression trees), и последующие разрешения идут через скомпилированный код. Так контейнер не тратит время на компиляцию редко используемых сервисов.
- **Скоупы.** `ServiceProviderEngineScope` хранит словарь созданных scoped-экземпляров и список disposable-объектов для освобождения. Корневой провайдер — тоже скоуп, в нём живут singleton'ы.
- **Валидация.** `ValidateScopes` проверяет захват scoped в singleton и разрешение scoped из корня; `ValidateOnBuild` при `Build()` строит call site'ы для всех сервисов и падает на неразрешимых зависимостях.

```csharp
builder.Host.UseDefaultServiceProvider(o =>
{
    o.ValidateScopes = true;
    o.ValidateOnBuild = true;
});
```

**Неочевидные свойства, о которых спрашивают:**

- **Transient `IDisposable` из корня — утечка.** Контейнер запоминает каждый созданный им disposable transient, чтобы освободить его вместе со скоупом. Разрешаете такой сервис из корневого провайдера в цикле — список растёт до остановки приложения.
- **Только асинхронно-освобождаемый сервис** (`IAsyncDisposable` без `IDisposable`) в скоупе, освобождаемом синхронно через `Dispose`, вызывает исключение — используйте `CreateAsyncScope`.
- **Выбор конструктора:** из публичных — с наибольшим числом разрешимых параметров; при неоднозначности — исключение.
- **Фабрики-лямбды** выпадают из валидации графа: контейнер не знает, что вы вызовете внутри `sp => ...`.

**Когда встроенного хватает:** почти всегда в веб-API. Он быстрый, совместим со всеми библиотеками и с trimming / Native AOT, на него рассчитаны оптимизации самого фреймворка. Типовые «нехватки» закрываются без замены контейнера:

| Нужно | Решение на встроенном |
| --- | --- |
| Сканирование сборок, декораторы | Scrutor (`Scan`, `Decorate`) |
| Именованные реализации | keyed services (`AddKeyedScoped`, `[FromKeyedServices]`) |
| Фабрика по требованию | `IServiceScopeFactory`, `ActivatorUtilities`, свой `Func<T>` |
| Ленивое создание | своя регистрация `Lazy<T>` |

**Когда менять на Autofac, DryIoc, Lamar:**

- **Перехват (AOP)** — логирование, транзакции, кэширование через динамические прокси (`Autofac.Extras.DynamicProxy`).
- **Мультитенантность** с дочерними контейнерами: разные регистрации на тенанта.
- **Модули и сложная условная регистрация**, property injection, автоматические `Func<T>`, `Owned<T>`, `Lazy<T>`.
- **Наследие** — большой проект, уже построенный на возможностях Autofac.

```csharp
builder.Host.UseServiceProviderFactory(new AutofacServiceProviderFactory());
builder.Host.ConfigureContainer<ContainerBuilder>(b => b.RegisterModule<BillingModule>());
```

**Цена замены:** ещё одна зависимость и её поведение в граничных случаях (порядок регистраций, dispose, валидация); часть фреймворковых оптимизаций и AOT-сценариев рассчитана на встроенный контейнер; неявная магия (сканирование, перехват) усложняет понимание кода. Поэтому вопрос на собеседовании обычно проверяет, умеете ли вы назвать конкретную потребность, а не «Autofac мощнее».

## Почему захват Scoped-сервиса в Singleton приводит к утечке и как это обнаружить?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-pochemu-zahvat-scoped-servisa-v-singleton-privodit-k-utechke-i-kak-eto
tags: dependency-injection, memory
```

Scoped-сервис, захваченный singleton'ом, создаётся в корневом скоупе контейнера, а корневой скоуп живёт до остановки приложения. Значит, сам сервис и всё, что он удерживает (change tracker `DbContext`, кэши, подписки, созданные им disposable transient'ы), никогда не освобождается и растёт с каждым запросом. Обнаруживают это валидацией скоупов в тестах и на стенде, анализом дампов кучи по цепочке удержания от корневого провайдера и по косвенным симптомам — росту gen2 и ошибкам конкурентного доступа.

**Почему именно утечка, а не просто «один экземпляр».**

```csharp
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(cs));
builder.Services.AddSingleton<ProductLookup>();

public sealed class ProductLookup(AppDbContext db)
{
    public Task<Product?> FindAsync(int id) => db.Products.FirstOrDefaultAsync(p => p.Id == id);
}
```

- **Change tracker.** Каждый загруженный с трекингом `Product` остаётся в `ChangeTracker` единственного контекста. За сутки там миллионы сущностей и их снимков — память растёт линейно с трафиком, а `DetectChanges` и поиск становятся всё медленнее.
- **Корневой скоуп копит disposable.** Контейнер запоминает каждый созданный им `IDisposable`/`IAsyncDisposable`, чтобы освободить при уничтожении скоупа. Transient-зависимости захваченного сервиса и всё, что разрешается через `sp.GetService` у корня, попадают в список корневого скоупа и живут вечно.
- **Транзитивность.** Singleton держит scoped A, тот держит scoped B и transient C — вся ветка графа становится бессмертной. Захват может быть неочевидным: singleton → `IOptionsSnapshot` (scoped), singleton → typed `HttpClient`, `IHostedService` → репозиторий.
- **Не только память.** Соединение с БД не возвращается в пул вовремя, данные кэша устаревают, данные пользователя одного запроса видны в другом, параллельные запросы ломают контекст (`A second operation was started on this context instance`).

**Как обнаружить:**

1. **Валидация контейнера.** `ValidateScopes` и `ValidateOnBuild` включены по умолчанию только в Development. Включите их явно в интеграционных тестах (`WebApplicationFactory`) и на стенде — прямой захват через конструктор упадёт при старте с `Cannot consume scoped service ... from singleton ...`.

   ```csharp
   builder.Host.UseDefaultServiceProvider((ctx, o) =>
   {
       o.ValidateScopes = !ctx.HostingEnvironment.IsProduction();
       o.ValidateOnBuild = true;
   });
   ```

2. **Ограничения валидации.** `ValidateOnBuild` не видит захват через фабрику-лямбду и через `IServiceProvider`, внедрённый в singleton: такие ошибки всплывут только в рантайме, когда код выполнится (и только при включённом `ValidateScopes`). Захват через статические поля и ручное `new` не видит никакая проверка. Поэтому нужны ещё инструменты.
3. **Дамп кучи.** `dotnet-gcdump collect -p <pid>` дважды с интервалом и сравнение: растущее число `InternalEntityEntry`, `StateManager`, ваших сущностей. Цепочка удержания (retention path) в Visual Studio, PerfView или dotMemory приводит к `ServiceProviderEngineScope` корня и к полю вашего singleton'а. Растущий `List<object>` disposable-объектов в корневом скоупе — характерный признак.
4. **Метрики.** Монотонный рост `gc-heap-size` и размера gen2 при стабильном трафике, рост времени ответа одного и того же запроса со временем жизни процесса, «лечится рестартом».
5. **Логи EF Core.** Предупреждения о конкурентном использовании контекста и `InvalidOperationException` под нагрузкой при том, что локально всё работает.
6. **Архитектурные тесты.** Тест, перебирающий `IServiceCollection` и проверяющий, что у singleton-реализаций нет параметров конструктора со scoped lifetime, — ловит то, что валидация пропустит в фабриках.

**Как исправить:** пересмотреть lifetime потребителя; создавать скоуп на операцию (`IServiceScopeFactory.CreateAsyncScope`); для EF — `IDbContextFactory<T>` и короткоживущий контекст; для options — `IOptionsMonitor` вместо `IOptionsSnapshot`; для HTTP — `IHttpClientFactory.CreateClient` на вызов вместо захваченного typed client'а.

## Как правильно пробросить CancellationToken до базы данных и что даёт отмена на практике?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-kak-pravilno-probrosit-cancellationtoken-do-bazy-dannyh-i-chto-daet-ot
tags: cancellation, api-design
```

Токен берут из `HttpContext.RequestAborted` — в Minimal API и контроллерах достаточно объявить параметр `CancellationToken`, фреймворк подставит его сам, — и явно передают по всей цепочке вызовов до последнего асинхронного метода: EF Core, Dapper, `HttpClient`, брокера. На практике отмена прекращает запрос в базе, когда клиент ушёл или истёк таймаут, освобождает соединение из пула и поток, а не доводит до конца работу, результат которой никто не прочитает.

```csharp
app.MapGet("/reports/{id}", async (int id, ReportService svc, CancellationToken ct) =>
    await svc.BuildAsync(id, ct));

public sealed class ReportService(AppDbContext db)
{
    public async Task<Report> BuildAsync(int id, CancellationToken ct)
    {
        var rows = await db.Sales
            .Where(s => s.ReportId == id)
            .AsNoTracking()
            .ToListAsync(ct);
        return Report.From(rows);
    }
}
```

**Что происходит при отмене на уровне БД:**

- **Npgsql** при отмене токена отправляет PostgreSQL cancel request по отдельному соединению — сервер прерывает выполняющийся запрос (как `pg_cancel_backend`), и `ToListAsync` бросает `OperationCanceledException`.
- **SqlClient** отправляет SQL Server attention-сигнал, запрос прерывается, транзакция откатывается.
- Если отмена пришла, пока запрос ждёт свободного соединения из пула, ожидание просто прекращается.

Без токена запрос в БД продолжит выполняться после ухода клиента: тяжёлый отчёт, который пользователь отменил, обновив страницу пять раз, превращается в пять параллельных full scan'ов.

**Источники отмены:**

| Источник | Как |
| --- | --- |
| Клиент закрыл соединение | `RequestAborted` срабатывает автоматически |
| Таймаут запроса | `AddRequestTimeouts` + `.WithRequestTimeout(...)` или `[RequestTimeout]` (.NET 8+) — middleware отменяет `RequestAborted` |
| Своя граница | `CancellationTokenSource.CreateLinkedTokenSource(ct)` + `CancelAfter` |
| Остановка приложения | `stoppingToken` в фоновых сервисах, принудительный обрыв запросов по таймауту остановки |

```csharp
builder.Services.AddRequestTimeouts();
app.UseRequestTimeouts();
app.MapGet("/search", Search).WithRequestTimeout(TimeSpan.FromSeconds(5));
```

**Подводные камни:**

- **Отмена — кооперативная.** Токен проверяется только там, куда он передан. Пропущенный параметр в одном методе цепочки обнуляет всё; помогают анализаторы (CA2016 — «передайте CancellationToken»).
- **Не всё нужно отменять.** После того как платёж прошёл во внешней системе, запись результата в БД отменять нельзя — иначе состояние разъедется. Для «обязательной» части используйте `CancellationToken.None` или отдельный токен с таймаутом, а не `RequestAborted`.
- **Транзакции.** Отмена посреди `SaveChangesAsync` откатывает транзакцию БД, но не побочные эффекты вне неё (отправленное письмо, вызов API). Отсюда outbox.
- **Логи.** `OperationCanceledException` при `RequestAborted.IsCancellationRequested` — нормальная ситуация, а не ошибка: фильтруйте её в exception handler и логируйте как информацию, иначе алерты на 500 срабатывают от каждого нетерпеливого пользователя.
- **Синхронный код токен не прерывает.** Долгий цикл в CPU-bound коде должен сам вызывать `ct.ThrowIfCancellationRequested()`.
- **Прокси.** За nginx или балансировщиком обрыв клиентского соединения доходит до Kestrel только если прокси закрывает upstream-соединение; иначе `RequestAborted` сработает лишь по таймауту.
- **Request timeouts не работают под отладчиком** — это сделано намеренно, чтобы не мешать отладке.

Что даёт на практике: меньше нагрузки на БД при всплесках и ретраях клиентов, быстрее освобождаются соединения пула, меньше каскадных таймаутов при деградации зависимостей.

## Что происходит с текущими запросами при graceful shutdown и как не потерять их в Kubernetes?

```yaml
category: aspnet-core
level: senior
difficulty: 5
slug: advanced-aspnet-chto-proishodit-s-tekuschimi-zaprosami-pri-graceful-shutdown-i-kak-ne
tags: hosting, devops
```

ASP.NET Core по `SIGTERM` сразу закрывает listener и ждёт текущие запросы до `ShutdownTimeout`. В Kubernetes проблема не в этих запросах, а в новых: удаление пода из Service endpoints и остановка контейнера происходят **параллельно**, и kube-proxy, ingress-контроллеры и балансировщики узнают об удалении с задержкой в секунды. Всё это время трафик продолжает приходить на под, который уже не слушает порт, — клиенты видят `502` и connection refused. Решение — задержать начало остановки (`preStop`), согласовать таймауты и сделать сами запросы короткими и повторяемыми.

**Что происходит при удалении пода:**

1. API-сервер помечает под как Terminating.
2. Параллельно: (а) kubelet запускает `preStop`-хук, затем шлёт `SIGTERM` процессу; (б) контроллер EndpointSlice убирает под из списка готовых endpoints, и это изменение асинхронно расходится по kube-proxy на нодах, ingress-контроллерам, service mesh, облачному LB.
3. Если процесс не завершился за `terminationGracePeriodSeconds` (по умолчанию 30 с, отсчёт включает время `preStop`), kubelet шлёт `SIGKILL`.

Без `preStop` шаг 2(а) выигрывает гонку: приложение закрывает порт раньше, чем сеть перестаёт на него слать.

**Конфигурация:**

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

Бюджет: `preStop (10 с) + ShutdownTimeout (40 с) < terminationGracePeriodSeconds (60 с)`. В образах без `sleep` (distroless, chiseled) используйте встроенное действие `preStop: sleep` в новых версиях Kubernetes или задержку внутри приложения в обработчике `ApplicationStopping`.

**Что происходит с запросами в ASP.NET Core после `SIGTERM`:**

- Listener закрыт — новые соединения не принимаются.
- Idle keep-alive соединения закрываются; на активных HTTP/1.1 ответ уходит с `Connection: close`; на HTTP/2 отправляется `GOAWAY`.
- Запросы в работе дорабатывают до `ShutdownTimeout`, после — обрываются, а их код получает отмену `RequestAborted`.
- Hosted services получают отмену `stoppingToken` и должны успеть корректно остановиться в том же бюджете.

**Как не потерять запросы — по слоям:**

- **Сеть:** `preStop`-задержка больше, чем время распространения изменений endpoints в вашем кластере (обычно 5–15 секунд; для облачных LB с собственными health checks — больше).
- **Readiness:** при `ApplicationStopping` переводите readiness в `503` — некоторые балансировщики (облачные LB с прямой маршрутизацией на поды) ориентируются на свои проверки, а не на EndpointSlice.
- **Соединения:** клиенты с долгими keep-alive и HTTP/2 продолжают слать запросы по уже открытому соединению — `Connection: close`/`GOAWAY` закрывают его аккуратно, если сервер ещё жив; поэтому важно, чтобы под жил дольше, чем сеть о нём «помнит».
- **Долгие соединения** (WebSocket, SSE, gRPC streaming) закрывайте сами по `ApplicationStopping` с сигналом клиенту переподключиться.
- **Длинная работа** не должна зависеть от жизни пода: очереди с ack после обработки, идемпотентные ретраи, чекпоинты.
- **PodDisruptionBudget и rolling update** (`maxUnavailable`, `maxSurge`) — чтобы одновременно не уходило слишком много реплик, а новые успевали стать ready.
- **Клиенты:** ретраи идемпотентных запросов на `502/503` и обрыв соединения на стороне вызывающих сервисов закрывают остаточные гонки.

**Частые ошибки:**

- Процесс не PID 1 или запущен через shell без `exec` — `SIGTERM` не доходит до `dotnet`, под ждёт весь grace period и получает `SIGKILL`.
- `ShutdownTimeout` больше grace period — приложение «вежливо ждёт», а его убивают.
- Liveness-проба с зависимостями во время деплоя перезапускает здоровые поды.
- Проверка «graceful» только на локальном Ctrl+C: реальную картину показывает нагрузочный тест во время rolling update с подсчётом ошибок на клиенте.

## Как спроектировать API на 50 000 RPS: что станет узким местом первым?

```yaml
category: aspnet-core
level: senior
difficulty: 5
slug: advanced-aspnet-kak-sproektirovat-api-na-50-000-rps-chto-stanet-uzkim-mestom-pervym
tags: scalability, api-design
```

Сам Kestrel на одном современном сервере обрабатывает сотни тысяч простых запросов в секунду, поэтому 50 000 RPS упирается не в веб-сервер, а почти всегда сначала в **хранилище и пулы соединений**, затем в **CPU на сериализацию, аллокации и GC**, затем в **блокировки и thread pool**, и только потом в сеть. Проектирование начинается с расчёта: сколько запросов параллельно в работе, сколько из них идёт в БД и во внешние сервисы, и какой из этих ресурсов кончится первым.

**Оценка «на салфетке».** По закону Литтла параллельность = RPS × латентность. При 50 000 RPS и среднем времени 20 мс в системе одновременно ~1 000 запросов; если p99 растёт до 500 мс, хвост держит гораздо больше. Если каждый запрос делает два обращения в PostgreSQL по 5 мс, базе нужно 100 000 запросов в секунду и ~500 одновременных соединений — больше, чем разумно держать в одном инстансе Postgres. Отсюда первый вывод: **большая часть запросов не должна доходить до основной БД**.

**Узкие места по порядку появления:**

| Ресурс | Симптом | Что делать |
| --- | --- | --- |
| БД и пул соединений | рост времени ожидания соединения, `Timeout expired`, CPU базы 100% | кэширование (in-memory + Redis, `HybridCache` в .NET 9+), read-реплики, батчинг, денормализация, PgBouncer, асинхронная запись через очередь |
| Исходящие HTTP-вызовы | очередь в пуле `HttpClient`, исчерпание портов, каскадные таймауты | пулы и лимиты, таймауты, circuit breaker, кэш ответов, батч-API |
| CPU: сериализация, логирование, аллокации | высокий CPU при небольшой бизнес-логике, частые GC | System.Text.Json source generators, меньше полей в ответе, `LoggerMessage`, сэмплирование логов, без синхронного логирования в консоль |
| GC | паузы, рост p99 | меньше аллокаций на запрос, пулы буферов, Server GC, DATAS (по умолчанию с .NET 9) |
| Thread pool и блокировки | рост очереди thread pool, латентность при низком CPU | никакого sync-over-async, без глобальных `lock` на горячем пути, `ConcurrentDictionary`/шардирование |
| Сеть и TLS | CPU на рукопожатия, лимиты LB | keep-alive, HTTP/2 между сервисами, TLS на балансировщике |

**Архитектурные решения:**

- **Stateless-инстансы за балансировщиком** и горизонтальное масштабирование; состояние — во внешних хранилищах.
- **Разделение чтения и записи.** Чтения обслуживаются кэшем или репликой, запись — через очередь с асинхронной обработкой там, где допустима eventual consistency (`202 Accepted`).
- **Кэш на нескольких уровнях:** CDN/output cache для публичных ответов, локальный memory cache для горячих справочников, распределённый кэш для общих данных. Защита от cache stampede: коалесценция запросов (`HybridCache` делает это из коробки), jitter в TTL.
- **Контроль нагрузки:** rate limiting и concurrency limiter, таймауты на всех исходящих вызовах, load shedding — лучше быстро отдать `503`, чем держать запросы, пока не умрёт всё.
- **Лёгкий путь запроса:** Minimal API, отсутствие лишних middleware, компактные DTO, пагинация вместо больших выборок.

```csharp
builder.Services.AddHybridCache();
app.MapGet("/products/{id}", async (int id, HybridCache cache, ProductRepo repo, CancellationToken ct) =>
    await cache.GetOrCreateAsync($"product:{id}", async t => await repo.GetAsync(id, t), cancellationToken: ct));
```

**Как проверять, а не гадать:**

- Нагрузочный тест (k6, NBomber, wrk) с реалистичным профилем и данными, с открытой моделью нагрузки (фиксированный RPS), иначе результаты искажает coordinated omission.
- Наблюдение во время теста: `dotnet-counters` (CPU, GC, thread pool queue, `http.server.active_requests`), метрики пула БД, `pg_stat_activity`, трейсы самых медленных запросов.
- Поиск «колена»: при каком RPS начинает расти p99 и какой ресурс насыщается первым — его и масштабируют.

На собеседовании хорошо звучит не список технологий, а рассуждение: оценка нагрузки → какие запросы доминируют (чтение/запись) → где состояние → какой ресурс кончается первым → как его разгрузить и как это измерить.

## Как реализовать rate limiting, работающий на нескольких инстансах одновременно?

```yaml
category: aspnet-core
level: senior
difficulty: 5
slug: advanced-aspnet-kak-realizovat-rate-limiting-rabotayuschii-na-neskolkih-instansah-odno
tags: rate-limiting, scalability
```

Встроенный `UseRateLimiter` хранит счётчики в памяти процесса, поэтому при N инстансах лимит фактически умножается на N. Для общего лимита есть четыре подхода: **центральное хранилище счётчиков** (обычно Redis с атомарными Lua-скриптами), **лимит на уровне гейтвея**, **детерминированная маршрутизация** клиента на один инстанс и **локальные лимиты с долей от общего**. Выбор — компромисс между точностью, латентностью и поведением при отказе хранилища.

**1. Redis как общий счётчик.** Каждое решение «пропустить или нет» — атомарная операция в Redis. Атомарность обязательна: `GET` + `INCR` из приложения дают гонку между инстансами.

```lua
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
if current > tonumber(ARGV[2]) then
  return {0, redis.call('PTTL', KEYS[1])}
end
return {1, 0}
```

Это fixed window; для sliding log используют sorted set (`ZADD` с timestamp, `ZREMRANGEBYSCORE`, `ZCARD`), для token bucket — хэш с количеством токенов и временем последнего пополнения, пересчитываемым в скрипте. Компактный вариант token bucket — алгоритм GCRA: хранится одно значение «теоретическое время следующего разрешённого запроса».

Интеграция с ASP.NET Core — своя реализация `RateLimiter`/`PartitionedRateLimiter<HttpContext>` поверх такого скрипта, подключаемая через `AddPolicy` или `GlobalLimiter`; есть и community-пакеты (например, RedisRateLimiting), реализующие те же абстракции.

**Цена:** +1 RTT к Redis на каждый запрос (0,2–1 мс внутри зоны), Redis становится критической зависимостью и горячей точкой (один ключ популярного клиента попадает на один шард).

**2. Гейтвей.** nginx, Envoy (global rate limit service), Kong, облачные API Gateway, YARP со встроенным middleware. Лимит считается до приложения, отсекает трафик дешевле всего. Но у гейтвея тоже несколько реплик — либо у него своё общее хранилище, либо та же проблема умножения.

**3. Привязка клиента к инстансу.** Консистентное хэширование по API-ключу на балансировщике: все запросы клиента идут на один инстанс, и локальный лимитер становится точным. Проблемы — перераспределение при масштабировании и перекос нагрузки от крупных клиентов.

**4. Локальный лимит = общий / N.** Самое простое: при 4 репликах и лимите 1000/мин каждый инстанс пропускает 250. Точность зависит от равномерности балансировки и меняется при автоскейлинге — N нужно знать динамически. Хорошо подходит как защитный предохранитель, плохо — для тарифных лимитов, которые клиент оплатил.

**Гибрид для высокой нагрузки.** Инстанс «арендует» у Redis пачку токенов (например, 50) и раздаёт их локально, обращаясь в Redis только когда пачка кончилась. Число походов в Redis падает на порядок, точность снижается на размер пачки × число инстансов.

**Решения, о которых спросят:**

- **Fail-open или fail-closed** при недоступности Redis. Для защиты от злоупотреблений обычно fail-open с откатом на локальный лимит (сервис работает, лимит грубее); для платного API с жёсткими квотами — иногда fail-closed. Обязательно короткий таймаут на обращение к Redis, иначе лимитер сам становится причиной латентности.
- **Синхронизация часов.** Время окна берите из Redis (`TIME` внутри скрипта), а не с инстансов.
- **Двухуровневая схема.** Глобальный лимит в Redis для тарифа клиента + локальный concurrency limiter на инстансе для защиты самого процесса — они решают разные задачи.
- **Ответ клиенту** одинаков с любого инстанса: `429`, `Retry-After`, при необходимости заголовки с остатком квоты.
- **Наблюдаемость:** метрики отказов по партициям и по причинам (лимит, ошибка хранилища), чтобы отличить «клиент превысил» от «лимитер сломался».

## Чем отличаются стратегии rate limiting и какую выбрать для публичного API?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-chem-otlichayutsya-strategii-rate-limiting-i-kakuyu-vybrat-dlya-public
tags: rate-limiting, api-design
```

Стратегии отличаются тем, как они ведут себя на всплесках и на границах интервалов: fixed window прост, но пропускает двойной всплеск на границе окна; sliding window сглаживает границу; token bucket допускает контролируемый всплеск при заданной средней скорости; leaky bucket выравнивает поток; concurrency limit ограничивает не частоту, а одновременную нагрузку. Для публичного API обычно выбирают **token bucket (или GCRA) по API-ключу** с лимитами по тарифу плюс **concurrency limit** как защиту сервиса.

**Сравнение:**

| Алгоритм | Как работает | Плюсы | Минусы |
| --- | --- | --- | --- |
| Fixed window | счётчик на окно, сброс по границе | дёшево: один счётчик | до 2× лимита за короткий интервал на стыке окон |
| Sliding window log | хранит timestamp каждого запроса | точный | память пропорциональна лимиту |
| Sliding window counter | окно из сегментов или взвешенное среднее текущего и прошлого окна | почти точный, дёшев | приближение |
| Token bucket | ведро на `B` токенов, пополняется со скоростью `r` | всплеск до `B`, средняя скорость `r`; интуитивен | надо выбрать два параметра |
| Leaky bucket (очередь) | запросы стекают с постоянной скоростью | ровная нагрузка на бэкенд | всплески ждут в очереди — растёт латентность |
| Concurrency | не больше N запросов одновременно | защищает от медленных тяжёлых запросов | не ограничивает частоту дешёвых |

В ASP.NET Core им соответствуют `FixedWindowRateLimiter`, `SlidingWindowRateLimiter` (сегментированное окно), `TokenBucketRateLimiter` и `ConcurrencyLimiter`; leaky bucket — это по сути token bucket с очередью (`QueueLimit > 0`).

**Почему token bucket для публичного API.** Реальные клиенты шлют трафик пачками: открыли страницу — десять запросов за 100 мс, потом тишина. Fixed window с лимитом «10 в секунду» иногда отклоняет нормальное поведение, а иногда пропускает 20 запросов подряд на стыке. Token bucket формулирует контракт честно: «в среднем 10 запросов в секунду, всплеск до 50» — и клиенту его легко соблюдать.

```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("public-api", ctx =>
    {
        var key = ctx.Request.Headers["X-Api-Key"].ToString();
        var plan = ctx.RequestServices.GetRequiredService<IPlanResolver>().Resolve(key);
        return RateLimitPartition.GetTokenBucketLimiter(key, _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = plan.Burst,
            TokensPerPeriod = plan.PerSecond,
            ReplenishmentPeriod = TimeSpan.FromSeconds(1),
            QueueLimit = 0
        });
    });
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(_ =>
        RateLimitPartition.GetConcurrencyLimiter("global", _ => new ConcurrencyLimiterOptions
        {
            PermitLimit = 2_000,
            QueueLimit = 0
        }));
});
```

Фабрика партиции вызывается только при создании лимитера для нового ключа — смена тарифа у существующего ключа не подхватится, пока лимитер не будет вытеснен как простаивающий. Для динамических тарифов в ключ партиции включают и план.

**Как проектировать лимиты публичного API:**

- **Ключ партиции — API-ключ или клиент**, не IP: за одним NAT сидит целая компания, а один злоумышленник меняет IP. По IP — только грубая защита анонимных endpoint'ов.
- **Разные лимиты на разные операции.** Дорогие (поиск, экспорт, запись) — отдельной, более строгой политикой; можно считать «стоимость» запроса и списывать несколько токенов.
- **Несколько горизонтов:** секундный token bucket против всплесков плюс суточная или месячная квота для тарифа (её обычно считают в хранилище, а не в памяти).
- **Прозрачность для клиента:** `429` с `Retry-After`, документированные лимиты, заголовки с остатком квоты (`X-RateLimit-Limit`/`Remaining`/`Reset` де-факто или `RateLimit-Policy`/`RateLimit` по черновику IETF).
- **Без очереди.** Для API лучше отказ сразу, чем удержание соединения: клиент сам решит, когда повторить.
- **Распределённость.** При нескольких инстансах счётчик тарифных лимитов — в общем хранилище; локальный concurrency limiter остаётся на каждом инстансе.

**Что проверяют:** понимание проблемы границы окна, разницы «частота vs параллельность», выбор ключа партиции и то, что `429` — это контракт с клиентом, а не только защита сервера.

## Как реализовать идемпотентный POST-эндпоинт в распределённой системе?

```yaml
category: aspnet-core
level: senior
difficulty: 5
slug: advanced-aspnet-kak-realizovat-idempotentnyi-post-endpoint-v-raspredelennoi-sisteme
tags: idempotency, api-design
```

Клиент присылает `Idempotency-Key`, а сервер атомарно «захватывает» ключ в общем хранилище до начала работы, выполняет операцию и сохраняет результат так, чтобы бизнес-изменение и отметка о выполнении были в одной транзакции. Повтор с тем же ключом получает сохранённый ответ, параллельный повтор — `409`, тот же ключ с другим телом — `422`. Побочные эффекты за пределами БД (события, вызовы других сервисов) делаются через outbox и передают свой ключ идемпотентности дальше по цепочке.

**Почему простая схема «проверил — выполнил — записал» ломается в распределённой системе:**

- Два повтора одновременно приходят на разные инстансы: оба проверяют, оба не находят ключ, оба выполняют.
- Процесс упал между выполнением и записью результата: повтор выполнит операцию снова.
- Операция затрагивает внешний сервис (платёжный шлюз): БД откатилась, а деньги списаны.
- Первый запрос ещё выполняется, когда приходит повтор по таймауту клиента.

**Состояния ключа:**

```text
(нет записи) ──INSERT──► in_progress ──commit──► completed (status, body)
                              │
                              └── сбой / истёк lease ──► можно захватить снова
```

**Реализация на PostgreSQL:**

```sql
CREATE TABLE idempotency_keys (
    client_id     text        NOT NULL,
    key           uuid        NOT NULL,
    request_hash  bytea       NOT NULL,
    status        text        NOT NULL,
    response_code int,
    response_body jsonb,
    locked_until  timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (client_id, key)
);
```

1. **Захват.** `INSERT ... ON CONFLICT DO NOTHING RETURNING` с `status = 'in_progress'` и `locked_until = now() + 30s`. Вставка прошла — мы владельцы ключа.
2. **Конфликт.** Ключ существует: если `completed` и хэш тела совпадает — возвращаем сохранённый ответ; хэш другой — `422`; `in_progress` и lease не истёк — `409 Conflict` (клиент повторит позже); lease истёк — перехватываем через `UPDATE ... WHERE locked_until < now()`.
3. **Выполнение.** Бизнес-изменения, запись событий в outbox и перевод ключа в `completed` с телом ответа — **в одной транзакции**. Либо всё зафиксировано, либо ничего, и повтор выполнит операцию заново.
4. **Ответ** клиенту — тот же, что сохранён.

```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);
var order = Order.Place(cmd);
db.Orders.Add(order);
db.Outbox.Add(OutboxMessage.From(new OrderPlaced(order.Id), idempotencyKey: $"{clientId}:{key}"));
record.Complete(201, JsonSerializer.SerializeToDocument(order.ToDto()));
await db.SaveChangesAsync(ct);
await tx.CommitAsync(ct);
```

**Внешние побочные эффекты.** Транзакция БД не охватывает платёжный шлюз. Варианты:

- передать во внешний API собственный ключ идемпотентности, производный от клиентского (Stripe и большинство платёжных API это поддерживают) — тогда повторный вызов после сбоя не спишет деньги дважды;
- разбить операцию на шаги с сохранением состояния (saga): «создан → отправлен в шлюз → подтверждён», каждый шаг идемпотентен и возобновляем;
- асинхронные эффекты — через outbox: публикатор может отправить сообщение дважды, поэтому потребители тоже идемпотентны (таблица обработанных `message_id`, inbox).

**Redis вместо БД?** `SET key value NX PX 30000` удобен для быстрого захвата, но результат и бизнес-изменение тогда не в одной транзакции — между ними остаётся окно. Redis подходит как первый быстрый фильтр, источник истины — та же БД, что и данные.

**Детали, о которых спрашивают:**

- **Область ключа** — `(client_id, key)`, а не глобальный ключ: иначе один клиент получит ответ другого.
- **Хэш запроса** — по каноническому телу и значимым параметрам (метод, путь), чтобы отличить честный повтор от ошибки клиента.
- **Что сохранять** — финальные ответы `2xx` и детерминированные `4xx`. Ответы `5xx` и `429` не кэшируют: повтор должен иметь шанс на успех.
- **TTL** — часы или дни, согласованные с политикой ретраев клиента; очистка фоновым заданием или партициями по дате.
- **Шардирование.** Если данные шардированы, ключ идемпотентности хранится на том же шарде, что и сущность, — иначе снова нет общей транзакции.
- **Производительность:** лишний `INSERT` и индекс на каждую запись — обычно приемлемо; для очень горячих endpoint'ов — партиционирование таблицы ключей.

## Как отдавать большой ответ, не загружая его целиком в память?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-kak-otdavat-bolshoi-otvet-ne-zagruzhaya-ego-celikom-v-pamyat
tags: streaming, memory
```

Нужно писать ответ в `Response.Body` (или `Response.BodyWriter`) по частям по мере чтения источника, а не собирать его целиком в `List<T>`, `MemoryStream` или строку. В ASP.NET Core для этого есть готовые механизмы: `IAsyncEnumerable<T>` сериализуется в JSON потоково, `Results.File`/`Results.Stream` копируют поток кусками, `Results.Stream(Func<Stream, Task>)` даёт прямую запись, а с .NET 10 — `TypedResults.ServerSentEvents`. Ключевое условие — чтобы источник (БД, файл, другой сервис) тоже читался потоково, а промежуточные слои не буферизовали ответ.

**JSON-массив из БД без материализации:**

```csharp
app.MapGet("/export/orders", (AppDbContext db) =>
    db.Orders.AsNoTracking()
        .Where(o => o.CreatedAt >= DateTime.UtcNow.AddDays(-30))
        .Select(o => new OrderRow(o.Id, o.Total, o.CreatedAt))
        .AsAsyncEnumerable());
```

EF Core читает строки через `DbDataReader` по одной, System.Text.Json пишет каждый элемент в ответ и периодически сбрасывает буфер. В памяти одновременно — небольшое окно, а не весь результат. Важно: `AsNoTracking`, иначе change tracker сохранит каждую строку; и никаких `ToListAsync` по пути.

**Файлы и потоки:**

```csharp
app.MapGet("/files/{id}", async (Guid id, IBlobStore store, CancellationToken ct) =>
{
    var blob = await store.OpenReadAsync(id, ct);
    return Results.Stream(blob.Content, contentType: blob.ContentType,
        fileDownloadName: blob.Name, enableRangeProcessing: true);
});

app.MapGet("/static-report", () =>
    Results.File("/data/report.csv", "text/csv", enableRangeProcessing: true));
```

Для файлов на диске `Results.File`/`PhysicalFile` использует `SendFileAsync` — данные идут из ОС в сокет без копирования через управляемую память. `enableRangeProcessing` позволяет докачку и параллельную загрузку частями (`206 Partial Content`).

**Собственный формат — прямо в поток:**

```csharp
app.MapGet("/export.csv", (AppDbContext db, CancellationToken ct) =>
    Results.Stream(async body =>
    {
        await using var writer = new StreamWriter(body, bufferSize: 16 * 1024);
        await foreach (var o in db.Orders.AsNoTracking().AsAsyncEnumerable().WithCancellation(ct))
            await writer.WriteLineAsync($"{o.Id},{o.Total},{o.CreatedAt:O}");
    }, "text/csv"));
```

NDJSON (JSON-объект на строку) удобнее JSON-массива для клиентов, которые тоже хотят обрабатывать ответ потоково.

**Что может всё испортить:**

- **Буферизация по пути.** Response compression, output cache, свой middleware с `MemoryStream`-обёрткой `Response.Body`, прокси с включённой буферизацией (nginx `proxy_buffering`) — ответ снова собирается целиком, только в другом месте.
- **Невозможность сменить статус.** После первой записи заголовки отправлены — ошибка посреди выгрузки уже не превратится в `500`, соединение просто оборвётся. Валидируйте всё до начала записи, а клиенту дайте способ проверить целостность (число записей в конце, контрольная сумма).
- **Нет `Content-Length`.** Используется chunked-кодирование (или фреймы HTTP/2); клиент не знает размер заранее, если вы не знаете его сами.
- **Долгие соединения.** Выгрузка на несколько минут держит соединение и курсор/транзакцию в БД. Медленный клиент тормозит чтение из БД через backpressure, а `MinResponseDataRate` Kestrel оборвёт слишком медленного. Для очень больших выгрузок лучше асинхронная схема: задача формирует файл в объектное хранилище, клиент скачивает по ссылке.
- **LOH.** Даже при частичной буферизации большие массивы байт (85 КБ+) попадают в Large Object Heap; работайте фиксированными буферами из `ArrayPool`.
- **Отмена.** Передавайте `CancellationToken` в чтение источника, чтобы при уходе клиента прекращался и запрос к БД.

## Что такое response buffering и когда его нужно отключать?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-chto-takoe-response-buffering-i-kogda-ego-nuzhno-otklyuchat
tags: streaming, performance
```

Response buffering — накопление тела ответа в памяти до того, как оно уйдёт клиенту. Буферизация позволяет до последнего момента менять статус и заголовки, посчитать `Content-Length`, закэшировать или сжать ответ целиком. Цена — память пропорционально размеру ответа и задержка до первого байта. Отключать её нужно для стриминга: Server-Sent Events, long polling, потоковые выгрузки, большие файлы, `IAsyncEnumerable`-ответы и прогресс долгих операций.

**Где в ASP.NET Core бывает буферизация:**

| Уровень | Поведение |
| --- | --- |
| Kestrel | полноценно ответ не буферизует: запись в `Response.Body` уходит в выходной пайп и сбрасывается в сокет; `MaxResponseBufferSize` (64 КБ) — лишь порог backpressure |
| Формирование JSON | сериализатор пишет во внутренний буфер и сбрасывает его частями; `IAsyncEnumerable` сериализуется потоково |
| Response compression | сжимающий поток накапливает данные до заполнения блока сжатия — мелкие события SSE могут застрять |
| Output cache, Response caching | захватывают весь ответ, чтобы сохранить его |
| Свои middleware | подмена `Response.Body` на `MemoryStream` (для логирования тела, подписи, изменения ответа) — полная буферизация |
| IIS / прокси | ANCM, nginx (`proxy_buffering on` по умолчанию), облачные LB и CDN могут держать ответ у себя |

**Как отключить и сбросить:**

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

- `IHttpResponseBodyFeature.DisableBuffering()` — сигнал всем обёрткам тела (сжатию, серверу IIS) не накапливать данные. Компоненты, понимающие этот сигнал, переключаются в режим «сразу отдавать».
- `FlushAsync` после каждой порции — явный сброс того, что лежит в буферах.
- `X-Accel-Buffering: no` — заголовок, который nginx понимает как «не буферизовать этот ответ».
- В .NET 10 для SSE есть `TypedResults.ServerSentEvents(IAsyncEnumerable<...>)`, который берёт форматирование и сброс на себя.

**Когда буферизация, наоборот, полезна:**

- Ответ маленький, и важно иметь возможность вернуть ошибку с правильным статусом, даже если она случилась в конце формирования.
- Нужен `Content-Length` (некоторые клиенты и прокси без него работают хуже).
- Нужны кэширование, подпись или преобразование ответа целиком.
- Много мелких записей: без буфера каждая превращается в отдельный системный вызов и TCP-сегмент; буфер их объединяет.

**Подводные камни:**

- **Логирование тел ответов** через `UseHttpLogging` с `ResponseBody` или самописную обёртку делает потоковые endpoint'ы буферизованными или по крайней мере дорогими — исключайте их.
- **Сжатие SSE.** Либо отключить сжатие для `text/event-stream`, либо полагаться на `DisableBuffering` и flush; проверять реальной задержкой событий у клиента.
- **Буферизация запроса — другое.** `Request.EnableBuffering()` позволяет перечитать тело запроса (для логирования, подписи вебхуков); оно до 30 КБ держится в памяти, сверх — во временном файле. Это не относится к ответу, но на собеседовании их часто путают.
- **Проверка.** `curl -N` показывает, приходят ли события сразу; если пачками — где-то по пути буфер. Проверяйте через все слои: локально, через ingress, через CDN.

## Как организовать версионирование API, чтобы не ломать клиентов при изменении контракта?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-kak-organizovat-versionirovanie-api-chtoby-ne-lomat-klientov-pri-izmen
tags: api-design, versioning
```

Главное — не механизм версий, а дисциплина контракта: большинство изменений делают **обратно совместимыми** и вообще без новой версии, breaking change выпускают новой мажорной версией параллельно со старой, а старую выводят по заранее объявленному графику, измеряя её реальное использование. Механика (`Asp.Versioning`, URL-сегмент) — лишь способ держать две версии рядом.

**Что считается совместимым, а что ломает:**

| Совместимо | Ломает клиентов |
| --- | --- |
| новое необязательное поле в ответе | удаление или переименование поля |
| новый endpoint | смена типа (`int` → `string`, число → объект) |
| новый необязательный параметр запроса | новый обязательный параметр или поле запроса |
| ослабление валидации | ужесточение валидации |
| новый код ошибки в документированном классе | смена семантики поля или статус-кода |
| | новое значение enum в ответе — для клиентов со строгой десериализацией |
| | `null` там, где его раньше не было |

Последние два пункта — самые коварные: формально схема «расширилась», но строгий клиент падает.

**Приёмы, чтобы не плодить версии:**

- **Tolerant reader.** Документируйте, что клиенты обязаны игнорировать неизвестные поля и быть готовы к новым значениям enum. На своей стороне — то же для входящих запросов.
- **Expand–contract.** Нужно переименовать `name` в `fullName`: сначала отдаёте оба поля, принимаете оба, помечаете старое deprecated в OpenAPI, ждёте, пока трафик со старым полем не исчезнет, потом удаляете — в новой мажорной версии.
- **Расширяемые структуры.** Объект вместо примитива там, где возможен рост (`"price": {"amount": 10, "currency": "EUR"}` вместо `"price": 10`), курсорная пагинация, обёртки списков.
- **Отдельные DTO на версию на границе API**, общий домен внутри. Версия не должна размножать бизнес-логику.

**Автоматическая защита от случайных breaking changes:**

- Генерация OpenAPI на сборке (`Microsoft.AspNetCore.OpenApi` в .NET 9+ или Swashbuckle) и сравнение с опубликованной спецификацией в CI инструментом вроде `oasdiff` — сборка падает при breaking change без смены мажорной версии.
- Consumer-driven contract tests (Pact): потребители фиксируют, какие поля реально используют.
- Snapshot-тесты сериализации ответов — ловят случайную смену имени поля из-за рефакторинга или настроек сериализатора.

**Жизненный цикл версии:**

1. Новая версия выходит рядом со старой; обе обслуживаются одним приложением.
2. Старая помечается deprecated: заголовки `Deprecation` (RFC 9745) и `Sunset` (RFC 8594) с датой отключения, ссылка на гайд миграции; в `Asp.Versioning` — `Deprecated = true` и sunset-политики, `ReportApiVersions` в ответах.
3. Метрики использования по версии и по клиенту (API-ключ) — вы знаете, кого предупреждать лично.
4. Отключение после даты — сначала «brownout» (временные периоды отказов), чтобы забывшие клиенты заметили, затем `410 Gone`.

```csharp
builder.Services.AddApiVersioning(o =>
{
    o.ReportApiVersions = true;
    o.Policies.Sunset(1.0)
        .Effective(new DateTimeOffset(2027, 3, 1, 0, 0, 0, TimeSpan.Zero))
        .Link("https://docs.example.com/migrations/v2").Title("Миграция на v2").Type("text/html");
});
```

**Что дальше спросят:** где хранить версию (URL проще для кэшей и логов, заголовок чище), как версионировать события и сообщения в брокере (те же правила совместимости плюс schema registry), и почему GraphQL или gRPC меняют подход: в gRPC совместимость обеспечивается номерами полей protobuf — нельзя переиспользовать номер удалённого поля, а новые поля добавляются безопасно.

## Как диагностировать рост p99 latency при нормальном среднем времени ответа?

```yaml
category: aspnet-core
level: senior
difficulty: 5
slug: advanced-aspnet-kak-diagnostirovat-rost-p99-latency-pri-normalnom-srednem-vremeni-otve
tags: observability, performance
```

Нормальное среднее при растущем p99 означает, что большинство запросов быстрые, а небольшая доля периодически ждёт чего-то: паузы GC, свободного потока в thread pool, соединения в пуле, блокировки, ретрая, холодного кэша, CPU-квоты контейнера. Диагностика — это сужение: **какие** запросы медленные (endpoint, инстанс, клиент, время), **где** они проводят время (трейс), и **какой ресурс** в этот момент насыщен (метрики рантайма и зависимостей).

**Шаг 1. Убедиться, что метрика честная.** p99 считается по гистограммам (`http.server.request.duration` в .NET 8+), а не усреднением перцентилей между инстансами — усреднённый p99 по подам математически бессмыслен. В нагрузочных тестах — открытая модель нагрузки, иначе coordinated omission прячет хвост.

**Шаг 2. Разрезать хвост:**

- **По endpoint'ам.** Часто p99 «всего сервиса» — это один тяжёлый endpoint (экспорт, поиск), который редко вызывается и смещает общий перцентиль.
- **По инстансам.** Один под на перегруженной ноде, с CPU throttling или после рестарта (холодный JIT, пустой кэш) даёт хвост всем.
- **По клиентам/тенантам.** Крупный тенант с огромными выборками.
- **По времени.** Периодичность (каждые N минут) указывает на cron-задачи, ротацию кэша, gen2 GC, бэкапы БД, массовое истечение TTL.

**Шаг 3. Трейсы медленных запросов.** Distributed tracing (OpenTelemetry) с tail-based sampling или exemplars на гистограмме показывает, из чего состоит медленный запрос: долгий span в БД — ищем в БД; большой «пустой» промежуток между span'ами без дочерних вызовов — время ожидания внутри процесса: thread pool, блокировка, GC.

**Шаг 4. Типичные причины и их признаки:**

| Причина | Чем подтвердить |
| --- | --- |
| Паузы GC (gen2, LOH, фрагментация) | `dotnet-counters`: `gc-pause-time`/`time-in-gc`, число gen2 коллекций; корреляция всплесков latency с GC |
| Thread pool starvation (sync-over-async, `.Result`, синхронный I/O) | рост `threadpool-queue-length`, медленный рост `threadpool-thread-count`, при этом CPU невысокий; `dotnet-stack`/дамп показывает потоки в `Wait` |
| Ожидание соединения в пуле БД или `HttpClient` | метрики пула (Npgsql `db.client.connections.*`, `http.client.request.time_in_queue`), span «connection open» |
| Блокировки в коде | `monitor-lock-contention-count`, профиль `dotnet-trace` с contention-событиями |
| Блокировки и планы в БД | `pg_stat_activity`, `pg_locks`, auto_explain для медленных запросов, нестабильные планы на параметрах |
| CPU throttling в Kubernetes | `container_cpu_cfs_throttled_periods_total` растёт при средней загрузке ниже лимита |
| Ретраи с backoff | в трейсе несколько попыток вызова одной зависимости; метрики ретраев resilience-пайплайна |
| Холодный старт | хвост только после деплоя или масштабирования; помогают прогрев, ReadyToRun, отложенная readiness |
| Сеть | TCP-ретрансмиты, DNS-таймауты (5 с — характерное значение), исчерпание SNAT-портов |

**Шаг 5. Глубокая диагностика процесса:**

```bash
dotnet-counters monitor -p <pid> --counters System.Runtime,Microsoft.AspNetCore.Hosting,System.Net.Http
dotnet-trace collect -p <pid> --profile cpu-sampling --duration 00:00:30
dotnet-dump collect -p <pid>
```

Дамп в момент деградации и `dotnet-dump analyze` (`threadpool`, `clrstack -all`, `syncblk`) показывают, на чём стоят потоки. Профиль CPU объясняет, где горит процессор, но плохо видит ожидания — для них нужны трейсы и события contention/wait.

**Частые выводы и решения:**

- sync-over-async в редкой ветке (логирование, библиотека без async API) → убрать блокировку;
- большие аллокации на запрос → пулы, стриминг вместо материализации, уменьшение LOH-аллокаций;
- слишком маленький пул соединений или неограниченный параллелизм к зависимости → настроить пул и concurrency limit;
- тяжёлые запросы мешают лёгким → разнести по разным пулам/инстансам (bulkhead), вынести в фон;
- CPU-лимиты без запаса → поднять limit или убрать его, оставив request.

Вопрос на собеседовании проверяет подход: не «добавить ресурсов», а последовательно сузить хвост до конкретного ресурса и подтвердить гипотезу измерением до и после изменения.

## Почему health check может отвечать OK, когда приложение фактически неработоспособно?

```yaml
category: aspnet-core
level: senior
difficulty: 4
slug: advanced-aspnet-pochemu-health-check-mozhet-otvechat-ok-kogda-prilozhenie-fakticheski
tags: observability, devops
```

Потому что health check проверяет только то, что в нём явно запрограммировано, и обычно это гораздо меньше, чем путь реального запроса. Эндпоинт `/health` отвечает из того же процесса, но минуя аутентификацию, бизнес-логику, большинство зависимостей и фоновые обработчики. Приложение может «отвечать», при этом не умея делать свою работу: упал фоновый worker, кончился пул соединений, истёк сертификат к внешнему API, заблокирована таблица, сломалась конфигурация.

**Типичные сценарии ложного OK:**

- **Пустая проверка.** `MapHealthChecks("/health")` без зарегистрированных проверок всегда возвращает `Healthy` — это проверка «процесс жив и Kestrel отвечает», не более.
- **Мёртвый фоновый сервис.** `BackgroundService`, обрабатывающий очередь, завис на deadlock или вышел из цикла; HTTP-часть работает, сообщения копятся. Проверка о worker'е ничего не знает.
- **Проверка «соединения», а не операции.** `SELECT 1` проходит, а рабочие запросы падают: нет прав на новую таблицу после миграции, таблица заблокирована, реплика отстала, закончилось место, пул соединений исчерпан (проверка проскочила, потому что выполнилась в момент, когда соединение освободилось).
- **Обход проблемного пути.** Health endpoint исключён из аутентификации, rate limiting, `ForwardedHeaders` — а сломано именно это: просрочен ключ подписи JWT, неверная конфигурация CORS, лимитер отклоняет всех.
- **Внешние зависимости не проверяются**, потому что их правильно не включили в liveness — и не включили больше никуда.
- **`Degraded` = `200`.** По умолчанию статус `Degraded` отдаёт тот же код, что и `Healthy`, и балансировщик его не отличает.
- **Кэширование результата.** Проверка кэширует результат на минуты, а `IHealthCheckPublisher` или прокси отдают устаревшее значение.
- **Проверяется не тот инстанс.** Внешний мониторинг ходит через балансировщик и попадает в здоровый под, а один из пяти отдаёт ошибки 20% пользователей.
- **Thread pool starvation.** Проверка выполняется быстро, когда до неё дошла очередь; ответ «OK через 8 секунд» засчитывается, если таймаут пробы больше.

**Как сделать проверки честнее:**

- **Разделить вопросы.** Liveness — только «процесс не завис» (лёгкая проверка, но с учётом heartbeat ключевых циклов). Readiness — «могу обслужить запрос»: критичные зависимости, прогретые кэши, применённые миграции. Startup — длительная инициализация.
- **Heartbeat фоновых сервисов.** Worker после каждой итерации обновляет отметку времени; проверка считает его нездоровым, если отметка старше порога.

```csharp
public sealed class WorkerHeartbeat { public long LastTick; }

public sealed class WorkerHealthCheck(WorkerHeartbeat hb, TimeProvider clock) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext ctx, CancellationToken ct = default)
    {
        var age = clock.GetUtcNow() - DateTimeOffset.FromUnixTimeMilliseconds(Interlocked.Read(ref hb.LastTick));
        return Task.FromResult(age < TimeSpan.FromMinutes(2)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy($"worker idle for {age}"));
    }
}
```

- **Проверять операцию, а не соединение.** Лёгкий запрос к реальной таблице с теми же правами, что у приложения; проверка лага очереди, а не только подключения к брокеру.
- **Синтетический мониторинг.** Внешний сценарий, выполняющий реальную пользовательскую операцию (логин, чтение, запись тестовой сущности) через публичный вход — ловит то, что внутренние проверки не видят.
- **Алерты по реальному трафику, а не по пробам.** SLO на долю ошибок и латентность по метрикам запросов: если 5% запросов отдают `500`, это проблема, даже если все health checks зелёные.
- **Явный маппинг `Degraded`** в `ResultStatusCodes`, если балансировщик должен на него реагировать.

**Обратная крайность** тоже вредна: если readiness проверяет всё подряд, временный сбой некритичной зависимости выводит из балансировки все поды сразу — и частичная деградация превращается в полный отказ. Хорошая проверка отвечает на вопрос «стоит ли слать сюда трафик», а полную картину здоровья дают метрики, трейсы и синтетика.
