---
title: Decorator vs наследование
slug: decorator-vs-nasledovanie
track: code-design
section: patterns
level: middle
sortOrder: 3
summary: Почему кэш, метрики и ретраи лучше добавлять обёртками, а не наследниками, как регистрировать декораторы в DI, почему их порядок — часть поведения и когда наследование всё-таки уместно.
---

Decorator — объект, который реализует тот же интерфейс, что и обёрнутый, делегирует ему вызов и добавляет поведение до или после. На собеседовании его обычно спрашивают в паре с наследованием: оба способа позволяют «добавить кэш к сервису», но ведут себя по-разному, как только добавок становится больше одной. Хороший ответ показывает не определение паттерна, а момент, когда наследование ломается.

## Как наследование ломается

Есть каталог товаров, который читает из базы. Нужно добавить кэш. Через наследование это выглядит естественно:

```csharp
public class PostgresProductCatalog(AppDbContext db)
{
    public virtual async Task<Product?> GetAsync(int id, CancellationToken ct) =>
        await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct);
}

public class CachedPostgresProductCatalog(AppDbContext db, IMemoryCache cache)
    : PostgresProductCatalog(db)
{
    public override async Task<Product?> GetAsync(int id, CancellationToken ct) =>
        await cache.GetOrCreateAsync($"product:{id}", _ => base.GetAsync(id, ct));
}
```

Проблемы начинаются со второй добавки.

- **Комбинаторный взрыв.** Нужны метрики. Метрики с кэшем, метрики без кэша, кэш без метрик — каждая комбинация требует своего класса. Три независимые добавки дают до восьми классов.
- **Порядок зафиксирован.** `MeteredCachedPostgresProductCatalog` всегда меряет с учётом кэша. Чтобы мерить только обращения к базе, нужна другая цепочка наследников.
- **Привязка к реализации.** Кэш унаследован от `Postgres`-каталога. Для каталога из внешнего API придётся написать такой же кэширующий наследник ещё раз.
- **Нельзя менять по конфигурации.** Включить кэш только в продакшене, а трассировку — на одном окружении, наследованием не выразить: тип выбирается на этапе компиляции.
- **Нужен `virtual`.** От `sealed` класса или класса из чужой библиотеки без виртуальных методов наследоваться бесполезно.

Плюс хрупкость базового класса, разобранная в статье `Инкапсуляция, наследование, полиморфизм`: наследник зависит от того, какие методы база вызывает внутри себя.

## Decorator: та же абстракция, обёрнутая вокруг другой

```csharp
public interface IProductCatalog
{
    Task<Product?> GetAsync(int id, CancellationToken ct);
}

public sealed class CachedProductCatalog(IProductCatalog inner, HybridCache cache) : IProductCatalog
{
    public async Task<Product?> GetAsync(int id, CancellationToken ct) =>
        await cache.GetOrCreateAsync(
            $"product:{id}",
            async token => await inner.GetAsync(id, token),
            cancellationToken: ct);
}

public sealed class MeteredProductCatalog(IProductCatalog inner, CatalogMetrics metrics) : IProductCatalog
{
    public async Task<Product?> GetAsync(int id, CancellationToken ct)
    {
        var started = Stopwatch.GetTimestamp();
        try
        {
            return await inner.GetAsync(id, ct);
        }
        finally
        {
            metrics.RecordLookup(Stopwatch.GetElapsedTime(started));
        }
    }
}
```

Каждый декоратор знает только интерфейс. Кэш работает поверх любой реализации — базы, внешнего API, фейка в тестах. Комбинации собираются при старте приложения, а не на этапе компиляции, и для N добавок нужно N классов, а не 2^N.

## Регистрация в DI

Встроенный контейнер .NET не умеет декорировать регистрацию напрямую. Есть два пути.

**Scrutor** — библиотека поверх встроенного контейнера, добавляющая метод `Decorate`:

```csharp
public static class CatalogRegistration
{
    public static IServiceCollection AddCatalog(this IServiceCollection services)
    {
        services.AddScoped<IProductCatalog, PostgresProductCatalog>();
        services.Decorate<IProductCatalog, CachedProductCatalog>();
        services.Decorate<IProductCatalog, MeteredProductCatalog>();
        return services;
    }
}
```

**Вручную** — через фабрику регистрации, без библиотек:

```csharp
public static class ManualCatalogRegistration
{
    public static IServiceCollection AddCatalogManually(this IServiceCollection services)
    {
        services.AddScoped<PostgresProductCatalog>();
        services.AddScoped<IProductCatalog>(sp =>
            new MeteredProductCatalog(
                new CachedProductCatalog(
                    sp.GetRequiredService<PostgresProductCatalog>(),
                    sp.GetRequiredService<HybridCache>()),
                sp.GetRequiredService<CatalogMetrics>()));
        return services;
    }
}
```

Ручной вариант многословнее, но цепочка видна целиком в одном месте. Scrutor удобнее, когда декораторов много или они обобщённые: `Decorate(typeof(ICommandHandler<>), typeof(LoggingHandler<>))` оборачивает все реализации открытого обобщённого интерфейса разом.

## Порядок — часть поведения

У Scrutor каждый следующий `Decorate` оборачивает всё, что зарегистрировано до него. В примере выше вызов идёт `Metered → Cached → Postgres`: метрики меряют время **с учётом** кэша, и попадание в кэш снижает среднее. Если поменять две строки местами, получится `Cached → Metered → Postgres`: метрики увидят только промахи, то есть реальную нагрузку на базу.

Ни один вариант не правильнее другого — это разные метрики. Но порядок нужно выбирать осознанно, и это главный подводный камень декораторов, о котором стоит сказать на собеседовании. Та же логика у ретраев и таймаутов: таймаут снаружи ретраев ограничивает общее время, таймаут внутри — каждую попытку.

## Декораторы, которые уже есть в .NET

- **`DelegatingHandler`** в `HttpClient` — цепочка обработчиков вокруг `HttpMessageHandler`. На ней построены логирование запросов, добавление токенов и пакет `Microsoft.Extensions.Http.Resilience` с ретраями и circuit breaker.
- **Обёртки `Stream`** — `BufferedStream`, `GZipStream`, `CryptoStream` принимают другой `Stream` и сами являются `Stream`. `new GZipStream(new BufferedStream(file), ...)` — цепочка декораторов.
- **Middleware ASP.NET Core** — каждый компонент оборачивает следующий `RequestDelegate`. Это гибрид Decorator и Chain of Responsibility: обёртка может не вызвать следующий компонент. Похоже устроены фильтры MVC — они разобраны в статье `Фильтры`.

## Подводные камни

**Большой интерфейс.** Декоратор обязан реализовать все методы, даже те, к которым ничего не добавляет, и просто пробрасывает их. Десять методов-пробросов ради одного полезного — сигнал, что интерфейс пора разделить.

**Изменение контракта.** Декоратор — тоже реализация интерфейса, и на него распространяется принцип Лисков. Кэш, возвращающий устаревшие данные там, где клиент ждёт свежих, или таймаут, бросающий исключение, к которому вызывающий код не готов, — нарушение контракта. Подробнее — в статье `Нарушение LSP на реальном коде`.

**Времена жизни.** Декоратор-singleton вокруг scoped-реализации захватит её на всё время жизни приложения. У Scrutor декоратор получает время жизни декорируемой регистрации, а в ручной фабрике за этим следить нужно самому. Механика захвата — в статье `DI и жизненные циклы`.

**Отладка.** Стек вызовов проходит через несколько обёрток. Помогает именование по смыслу (`CachedProductCatalog`, а не `ProductCatalogDecorator2`) и сборка цепочки в одном месте.

## Когда наследование уместно

Наследование не запрещено — оно уместно, когда базовый класс **спроектирован** для расширения:

- фреймворк задаёт алгоритм, а наследник переопределяет шаг (Template Method): `BackgroundService.ExecuteAsync`, `DelegatingHandler.SendAsync`, `JsonConverter<T>`;
- есть настоящее отношение «является» с общим инвариантом, и наследник подставляется вместо базы без сюрпризов;
- нужно изменить часть поведения, а не обернуть целиком, и точки расширения (`virtual`, `abstract`) документированы как контракт.

Любопытно, что `DelegatingHandler` — одновременно и наследование, и декоратор: наследуются от фреймворкового класса ради шаблона, а работают как обёртка вокруг `InnerHandler`.

## Что стоит ответить на собеседовании

Decorator лучше наследования, когда нужно добавлять независимые сквозные поведения — кэш, метрики, ретраи, логирование — в разных комбинациях и выбирать их при сборке приложения. Наследование фиксирует поведение при компиляции, требует `virtual`, привязывает добавку к конкретной реализации и даёт комбинаторный взрыв классов. Встроенный DI декорировать не умеет — используют Scrutor или ручную фабрику.

Сильный ответ скажет, что порядок декораторов — часть поведения (метрики снаружи или внутри кэша — разные числа), назовёт декораторы из BCL (`DelegatingHandler`, обёртки `Stream`) и вспомнит, что декоратор обязан соблюдать контракт обёрнутого объекта.
