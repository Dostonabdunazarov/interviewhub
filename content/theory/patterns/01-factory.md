---
title: Factory
slug: pattern-factory
track: code-design
section: patterns
level: middle
sortOrder: 1
summary: Когда хватает конструктора, когда нужен статический фабричный метод или фабрика-сервис, чем Factory Method отличается от Abstract Factory и кто освобождает созданный объект.
---

«Фабрика» на собеседовании — это сразу несколько разных вещей: статический метод `Create`, класс-фабрика, Factory Method и Abstract Factory из GoF, `IHttpClientFactory` из платформы. Общий у них только мотив — у создания объекта появилась собственная логика, которую не хочется размазывать по вызывающему коду. Правильный ответ начинается не с паттерна, а с вопроса: а зачем здесь что-то кроме конструктора?

## По умолчанию — конструктор

Конструктор прост, виден в коде и проверяется компилятором. Если объект создаётся всегда одинаково и все его зависимости известны, никакая фабрика не нужна — в приложении с DI конструктор вызывает контейнер, и это уже решает задачу «кто создаёт».

Типичная вредная фабрика выглядит так:

```csharp
public interface IOrderFactory
{
    Order Create(int customerId);
}

public sealed class OrderFactory : IOrderFactory
{
    public Order Create(int customerId) => new(customerId);
}
```

Интерфейс, класс и регистрация в DI ради одного `new`. Логики создания нет — значит, и фабрики быть не должно.

## Статический фабричный метод

Первый уровень, на котором фабрика окупается, — когда конструктору не хватает выразительности. Ему нельзя дать имя, и он не может вернуть ничего, кроме экземпляра или исключения:

```csharp
public sealed record Email
{
    public string Value { get; }

    private Email(string value) => Value = value;

    public static bool TryCreate(string input, [NotNullWhen(true)] out Email? email)
    {
        var normalized = input.Trim().ToLowerInvariant();
        email = MailAddress.TryCreate(normalized, out _) ? new Email(normalized) : null;
        return email is not null;
    }
}

public readonly record struct Money(long MinorUnits, string Currency)
{
    public static Money FromMajor(decimal amount, string currency) =>
        new((long)Math.Round(amount * 100, MidpointRounding.ToEven), currency);

    public static Money FromMinor(long minorUnits, string currency) => new(minorUnits, currency);
}
```

Что это даёт:

- **Имя говорит о смысле.** `Money.FromMinor(15_000, "RUB")` не перепутать с рублями, а `new Money(15_000, "RUB")` — легко.
- **Невалидный объект создать нельзя.** Конструктор `Email` закрыт, и единственный путь — через проверку.
- **Ожидаемая ошибка без исключения.** Неверный email от пользователя — не исключительная ситуация, и паттерн `TryCreate` (как у `int.TryParse`) честнее, чем `throw` в конструкторе.

В BCL такие методы повсюду: `TimeSpan.FromSeconds`, `Guid.NewGuid`, `Task.FromResult`, `File.OpenRead`.

## Фабрика-сервис: тип выбирается во время выполнения

Второй уровень — когда конкретный тип определяется данными, а у реализаций есть свои зависимости из DI. Например, экспорт отчёта в разные форматы. В .NET 8 для этого появились keyed services:

```csharp
public interface IReportExporter
{
    Task<byte[]> ExportAsync(Report report, CancellationToken ct);
}

public sealed class ReportExporterFactory(IServiceProvider services)
{
    public IReportExporter Create(ExportFormat format) =>
        services.GetRequiredKeyedService<IReportExporter>(format);
}

public static class ExportRegistration
{
    public static IServiceCollection AddExporters(this IServiceCollection services)
    {
        services.AddKeyedScoped<IReportExporter, CsvExporter>(ExportFormat.Csv);
        services.AddKeyedScoped<IReportExporter, XlsxExporter>(ExportFormat.Xlsx);
        services.AddScoped<ReportExporterFactory>();
        return services;
    }
}
```

`IServiceProvider` внутри фабрики — допустимое исключение из правила «не использовать service locator»: фабрика — часть сборки приложения, а не бизнес-логика. Бизнес-код зависит от `ReportExporterFactory` с понятным методом, а не от контейнера.

Если ключ известен на этапе компиляции, фабрика не нужна вовсе — зависимость можно получить через `[FromKeyedServices(ExportFormat.Csv)] IReportExporter exporter` в параметре конструктора.

## Фабрика для времени жизни

Третий повод — несовпадение времён жизни. Singleton-сервис или `BackgroundService` не может получить scoped-зависимость через конструктор: это захват, разобранный в статье `DI и жизненные циклы`. Ему нужна фабрика, создающая объект на каждую единицу работы:

```csharp
public sealed class OutboxPublisher(IDbContextFactory<AppDbContext> contexts, IMessageBus bus) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await using var db = await contexts.CreateDbContextAsync(stoppingToken);
            var pending = await db.OutboxMessages
                .Where(m => m.SentAt == null)
                .OrderBy(m => m.Id)
                .Take(100)
                .ToListAsync(stoppingToken);

            foreach (var message in pending)
            {
                await bus.PublishAsync(message.Payload, stoppingToken);
                message.SentAt = DateTimeOffset.UtcNow;
            }

            await db.SaveChangesAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
    }
}
```

Платформа даёт несколько готовых фабрик такого рода:

- `IDbContextFactory<TContext>` — контекст на итерацию цикла, а не на всю жизнь сервиса;
- `IServiceScopeFactory` — scope целиком, когда нужно несколько scoped-сервисов сразу;
- `IHttpClientFactory` — управляет временем жизни `HttpMessageHandler`, чтобы не исчерпать сокеты и не залипнуть на устаревшем DNS;
- `ActivatorUtilities.CreateInstance<T>(provider, args)` — смешивает аргументы из DI с переданными вручную.

## Factory Method и Abstract Factory

Это два классических паттерна GoF, и их регулярно путают.

**Factory Method** — виртуальный метод базового класса, который наследники переопределяют, чтобы решить, какой объект создать. Базовый класс содержит алгоритм, а один его шаг — «создать продукт» — отдан наследнику:

```csharp
public abstract class DocumentImporter
{
    public async Task<int> ImportAsync(Stream input, CancellationToken ct)
    {
        var parser = CreateParser();
        var rows = await parser.ParseAsync(input, ct);
        return rows.Count;
    }

    protected abstract IRowParser CreateParser();
}

public sealed class CsvImporter : DocumentImporter
{
    protected override IRowParser CreateParser() => new CsvRowParser(';');
}
```

**Abstract Factory** — объект, создающий **семейство** связанных объектов, которые должны сочетаться друг с другом: например, клиент, сериализатор и обработчик ошибок для одного провайдера. Подменяя фабрику, подменяют всё семейство целиком.

В современном .NET оба паттерна встречаются реже, чем в книгах: Factory Method вытеснен внедрением зависимостей и делегатами, а Abstract Factory — регистрацией группы сервисов в DI. Но на собеседовании разницу спрашивают: метод-наследник против объекта-семейства.

## Кто освобождает созданный объект

Самая практичная деталь. Объект, полученный из контейнера, освобождает контейнер — при закрытии scope. Объект, созданный фабрикой через `new` или `ActivatorUtilities`, контейнер не отслеживает, и освободить его должен тот, кто получил. Поэтому в примере с `OutboxPublisher` стоит `await using`: без него каждая итерация оставляла бы открытое соединение.

Фабрика, которая возвращает `IDisposable`, должна явно говорить о владении — именем метода (`Create` против `Get`), документацией или возвращаемым типом. Иначе утечки соединений и хендлов неизбежны.

## Когда фабрика вредит

- интерфейс фабрики с методом, внутри которого один `new`;
- Abstract Factory «на будущее» для одного семейства;
- фабрика, которая создаёт объект частично, а остальное «досетапливается» свойствами потом;
- фабрика как способ обойти DI: `new` для сервисов с зависимостями, и вместе с ним потеря управления временем жизни и `Dispose`.

## Что стоит ответить на собеседовании

По умолчанию — конструктор или DI. Фабрика оправдана, когда у создания есть логика: выбор типа во время выполнения (фабрика-сервис или keyed services), валидация с ожидаемой ошибкой (статический `TryCreate` с закрытым конструктором), осмысленное имя (`FromMinor`), несовпадение времён жизни (`IDbContextFactory`, `IServiceScopeFactory`), дорогое создание. Factory Method — виртуальный метод, которым наследник выбирает продукт; Abstract Factory — объект, создающий семейство совместимых объектов.

Сильный ответ добавит про владение: созданное фабрикой контейнер не освобождает, и `Dispose` — ответственность получателя.
