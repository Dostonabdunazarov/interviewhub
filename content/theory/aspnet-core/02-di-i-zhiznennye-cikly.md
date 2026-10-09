---
title: DI и жизненные циклы
slug: aspnet-di-i-zhiznennye-cikly
track: dotnet-backend
section: aspnet-core
level: middle
sortOrder: 2
summary: Как устроен встроенный DI-контейнер, чем отличаются Transient, Scoped и Singleton, что такое captive dependency и почему в Production контейнер о ней молчит.
---

В ASP.NET Core почти ничего не создаётся через `new`: контроллеры, middleware, фильтры, hosted services, options и логгеры получаются из DI-контейнера. Поэтому вопрос «какой lifetime у сервиса» — не формальность. Неверно выбранное время жизни даёт гонки, утечки памяти и данные одного пользователя в ответе другому, причём проявляется это только под нагрузкой.

## Зачем DI

Dependency Injection — приём, при котором класс не создаёт свои зависимости сам, а получает их извне, обычно через конструктор:

```csharp
public sealed class OrderService(IOrderRepository repo, TimeProvider clock)
{
    public Task PlaceAsync(Order order, CancellationToken ct) =>
        repo.AddAsync(order with { CreatedAt = clock.GetUtcNow() }, ct);
}

builder.Services.AddScoped<IOrderRepository, SqlOrderRepository>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddSingleton(TimeProvider.System);
```

Это реализация принципа инверсии зависимостей: `OrderService` знает только абстракцию `IOrderRepository`, а конкретную реализацию подставит контейнер. Выигрыш практический — в тесте вместо базы передаётся фейк, а вместо системных часов `FakeTimeProvider`, и для этого не нужно ничего менять в самом классе.

Внедрение через конструктор — основной способ. Объект нельзя создать без зависимостей, они явно видны в сигнатуре, а разросшийся до десяти параметров конструктор сразу сигнализирует, что класс делает слишком много. Property injection встроенный контейнер не поддерживает, и это к лучшему: необязательные зависимости маскируют ошибки конфигурации.

## Две фазы контейнера

Контейнер работает в два этапа. Сначала в `IServiceCollection` складываются описания — `ServiceDescriptor` с типом сервиса, lifetime и способом создания. Затем `builder.Build()` превращает их в `IServiceProvider`, который создаёт объекты, рекурсивно разрешая параметры конструкторов.

```csharp
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddScoped<IUnitOfWork>(sp => new UnitOfWork(sp.GetRequiredService<AppDbContext>()));
builder.Services.AddSingleton(new ApiSettings("https://api"));
builder.Services.TryAddTransient<IEmailSender, SmtpSender>();
builder.Services.AddKeyedSingleton<ICache, RedisCache>("redis");
```

Здесь пять способов регистрации: по типу, фабрикой, готовым экземпляром, «только если ещё не зарегистрировано» и с ключом. Keyed services появились в .NET 8 и закрыли старую потребность в именованных реализациях: потребитель пишет `[FromKeyedServices("redis")] ICache cache`.

Несколько регистраций одного интерфейса — нормальная ситуация, и правило у неё простое. Проверено на .NET 10, два `AddSingleton<IFoo, ...>` подряд:

```
IFoo            → FooB
IEnumerable<IFoo> → FooA, FooB
```

Одиночное разрешение отдаёт **последнюю** регистрацию, коллекция — все в порядке регистрации. На этом построены цепочки обработчиков и возможность библиотеки переопределить поведение по умолчанию.

Если у реализации несколько публичных конструкторов, контейнер берёт тот, у которого больше всего параметров, которые он умеет разрешить. Циклическая зависимость `A(B)`, `B(A)` даёт исключение при разрешении — это признак неудачного дизайна, а не повод искать обход.

## Три времени жизни

| | Transient | Scoped | Singleton |
| --- | --- | --- | --- |
| Сколько экземпляров | новый при каждом разрешении | один на scope | один на приложение |
| Когда освобождается | с концом scope, в котором создан | с концом scope | при остановке приложения |
| Потокобезопасность | обычно не нужна | не нужна | обязательна |
| Примеры | валидаторы, лёгкие stateless-сервисы | `DbContext`, текущий пользователь | кэш, `TimeProvider`, `IHttpClientFactory` |

Scope в веб-приложении — это один HTTP-запрос. Фреймворк создаёт его в начале запроса и освобождает в конце; `HttpContext.RequestServices` — провайдер этого scope.

Почувствовать разницу проще всего на `DbContext`. Если контроллер и репозиторий в одном запросе получают его как scoped, это **один и тот же объект**: изменения, сделанные в обоих местах, сохраняются одним `SaveChanges`. Будь контекст transient, каждый получил бы свой экземпляр, и единица работы развалилась бы на части.

Контейнер ещё и владеет объектами: всё, что он создал и что реализует `IDisposable` или `IAsyncDisposable`, он освободит сам вместе со scope. Экземпляры, переданные готовыми через `AddSingleton(instance)`, он не освобождает — ими владеете вы. Как вообще устроено освобождение ресурсов, разобрано в статье `IDisposable, using и финализаторы`.

## Правило совместимости

Сервис может зависеть только от сервисов **с тем же или более долгим** временем жизни:

- scoped → singleton — нормально;
- singleton → transient — transient фактически становится singleton, потому что создаётся один раз в конструкторе;
- singleton → scoped — ошибка, она называется captive dependency.

## Captive dependency

Singleton создаётся один раз, и scoped-зависимость, полученная им в конструкторе, будет жить столько же — всё время работы приложения:

```csharp
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(cs));
builder.Services.AddSingleton<PriceCache>();

public sealed class PriceCache(AppDbContext db)
{
    public Task<decimal> GetAsync(int id, CancellationToken ct) =>
        db.Products.Where(p => p.Id == id).Select(p => p.Price).FirstAsync(ct);
}
```

Что сломается:

- **Гонки.** `DbContext` не потокобезопасен, а через singleton его используют все параллельные запросы. Результат — `InvalidOperationException: A second operation was started on this context instance` или испорченные данные.
- **Утечка памяти.** Change tracker единственного контекста копит сущности всех запросов. Память растёт линейно с трафиком, а `DetectChanges` работает всё медленнее. Это классический сценарий из статьи `Утечки памяти в managed-коде`: объект достижим из корня — корневого провайдера.
- **Чужие данные.** Scoped-сервис «текущий пользователь» или «текущий тенант», захваченный singleton'ом, навсегда запомнит того, чей запрос создал singleton.
- **Ресурсы.** Соединения не возвращаются в пул вовремя.

Захват бывает транзитивным и неочевидным: singleton → `IOptionsSnapshot<T>` (он scoped), `IHostedService` → репозиторий, singleton → typed `HttpClient`.

## Почему в Production контейнер молчит

У контейнера есть две проверки: `ValidateScopes` ловит scoped внутри singleton и разрешение scoped из корня, `ValidateOnBuild` при `Build()` пробует построить граф для всех регистраций. По умолчанию они **включены только в Development**. Проверено на .NET 10, один и тот же код с singleton, зависящим от scoped:

```
Development: AggregateException при builder.Build():
  Cannot consume scoped service 'ScopedDep' from singleton 'CaptiveSingleton'.
Production:  resolved without error
```

В Development приложение не стартует, в Production — стартует и работает, пока нагрузка не вскроет гонку. Проверки выключены ради скорости запуска, но включить их явно ничего не стоит:

```csharp
builder.Host.UseDefaultServiceProvider((ctx, o) =>
{
    o.ValidateScopes = true;
    o.ValidateOnBuild = true;
});
```

Минимум — в интеграционных тестах на `WebApplicationFactory` и на стенде. Но и это не всё ловит: `ValidateOnBuild` не видит, что вызывается внутри фабрики-лямбды `sp => ...` или через внедрённый `IServiceProvider`, а захват через статическое поле не видит вообще никакая проверка.

## Как делать правильно

Сначала стоит спросить, нужен ли потребителю singleton вообще. Часто его можно сделать scoped, и проблема исчезает.

Если singleton оправдан, scope создаётся на каждую операцию:

```csharp
public sealed class PriceCache(IServiceScopeFactory scopes)
{
    public async Task<decimal> GetAsync(int id, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Products.Where(p => p.Id == id).Select(p => p.Price).FirstAsync(ct);
    }
}
```

`IServiceScopeFactory` — singleton, его безопасно внедрять куда угодно. `CreateAsyncScope` предпочтительнее `CreateScope`: сервис, реализующий только `IAsyncDisposable`, при синхронном освобождении scope бросит исключение.

Для EF Core есть готовое решение — `AddDbContextFactory` и `IDbContextFactory<T>`, который выдаёт новый короткоживущий контекст по требованию. Для options — `IOptionsMonitor<T>` вместо `IOptionsSnapshot<T>`, подробнее в статье `Конфигурация и options`.

Тот же приём нужен в фоновых сервисах: они singleton, а scope вне HTTP-запроса никто за вас не создаст. Скоуп на итерацию — стандартный шаблон, о нём в статье `Graceful shutdown`.

## Ещё две ловушки

**Transient `IDisposable` из корня.** Контейнер запоминает каждый созданный им disposable-объект, чтобы освободить его вместе со scope. Если разрешать такой transient из корневого провайдера — например, `app.Services.GetRequiredService<T>()` в цикле, — список в корневом scope растёт до остановки приложения. Это утечка, которая не видна ни в одном конструкторе.

**Service Locator.** Внедрить `IServiceProvider` в бизнес-класс и вызывать `GetService<T>()` внутри методов — значит снова спрятать зависимости: сигнатура ничего не говорит, ошибки регистрации всплывают в рантайме. Это допустимо только в инфраструктурном коде — фабриках, фоновых сервисах, middleware.

## Когда менять контейнер

Встроенного контейнера хватает почти всегда. Он быстрый, совместим с Native AOT, и на него рассчитаны оптимизации самого фреймворка. Типовые «нехватки» закрываются без замены: сканирование сборок и декораторы — библиотекой Scrutor поверх встроенного, именованные реализации — keyed services.

Autofac, DryIoc или Lamar оправданы, когда нужно то, чего встроенный не умеет принципиально: перехват через динамические прокси, дочерние контейнеры на тенанта, модули, `Owned<T>`. На собеседовании ценится не «Autofac мощнее», а умение назвать конкретную потребность.

## Что стоит ответить на собеседовании

Встроенный контейнер работает в две фазы: регистрации в `IServiceCollection` и разрешения через `IServiceProvider`, который рекурсивно создаёт зависимости конструктора и освобождает созданные им disposable-объекты вместе со scope. Transient создаётся при каждом разрешении, scoped — один на scope, то есть на HTTP-запрос, singleton — один на приложение и обязан быть потокобезопасным. При нескольких регистрациях одного интерфейса одиночное разрешение отдаёт последнюю, `IEnumerable<T>` — все.

Сильный ответ разберёт captive dependency: singleton, получивший scoped `DbContext` в конструктор, делит его между всеми запросами — гонки, рост change tracker, чужие данные. И уточнит, что валидация `ValidateScopes` и `ValidateOnBuild` включена только в Development: там приложение падает при `Build()` с `Cannot consume scoped service ... from singleton`, а в Production тот же код стартует молча. Исправление — пересмотреть lifetime или создавать scope на операцию через `IServiceScopeFactory.CreateAsyncScope`, для EF Core — `IDbContextFactory<T>`.
