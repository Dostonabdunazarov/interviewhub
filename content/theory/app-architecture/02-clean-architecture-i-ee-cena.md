---
title: Clean Architecture и её цена
slug: clean-architecture-i-ee-cena
track: code-design
section: app-architecture
level: senior
sortOrder: 2
summary: Что на самом деле даёт правило зависимостей Clean Architecture, как проверять его автоматически, во что обходится строгое соблюдение и какие компромиссы и альтернативы — вертикальные слайсы — выбирают зрелые команды.
---

Clean Architecture — самый популярный шаблон .NET-решения последних лет: четыре проекта, `Domain` в центре, `Infrastructure` снаружи, MediatR между ними. Шаблон легко скопировать, и его часто копируют туда, где он не нужен: в CRUD-сервис из пятнадцати эндпоинтов, где добавление одного поля в карточку требует правки восьми файлов. На собеседовании senior-уровня вопрос звучит не «что такое Clean Architecture», а «что она даёт и сколько стоит» — и ждут ответа, в котором есть обе половины.

## Правило зависимостей

Вся Clean Architecture сводится к одному правилу: **исходный код зависит только внутрь**, к бизнес-правилам. Домен не знает о сценариях, сценарии не знают о базе и вебе, а ORM, брокер и HTTP-клиенты — детали, которые подключаются снаружи. По сути это та же идея, что в гексагональной архитектуре (см. `Слоистая vs гексагональная`), только нарисованная концентрическими кругами и с более жёсткой терминологией.

Типичная раскладка в .NET:

```text
src/
  Billing.Domain           сущности, value objects, доменные события; без ссылок
  Billing.Application      сценарии, порты (интерфейсы хранилищ и шлюзов), DTO; ссылается на Domain
  Billing.Infrastructure   EF Core, Npgsql, Kafka, HTTP-клиенты; ссылается на Application
  Billing.Api              ASP.NET Core, composition root; ссылается на всё
tests/
  Billing.Domain.Tests
  Billing.Application.Tests
  Billing.ArchitectureTests
```

Первая линия защиты правила — ссылки между проектами. Если у `Billing.Domain` нет `ProjectReference` и `PackageReference` на EF Core, написать там `using Microsoft.EntityFrameworkCore` невозможно: код не скомпилируется.

## Проверять правило в CI, а не на ревью

Ссылки между проектами ловят не всё: транзитивные пакеты, правила внутри одной сборки, договорённости вида «контроллеры не трогают `DbContext`». Для этого пишут архитектурные тесты — например, на NetArchTest:

```csharp
[Fact]
public void Domain_does_not_depend_on_frameworks()
{
    var result = Types.InAssembly(typeof(Invoice).Assembly)
        .That().ResideInNamespace("Billing.Domain")
        .ShouldNot()
        .HaveDependencyOnAny("Microsoft.EntityFrameworkCore", "Microsoft.AspNetCore", "Npgsql", "Confluent.Kafka")
        .GetResult();

    Assert.True(result.IsSuccessful, string.Join(", ", result.FailingTypeNames ?? []));
}
```

Тест анализирует IL, а не текст: зависимость найдётся и в базовом типе, и в поле, и в теле метода. Похожий API есть у ArchUnitNET. Такие тесты — пример fitness function: решение, которое проверяется автоматически, не размывается через год, когда авторы ушли из команды.

## Что это даёт

- **Тестируемость правил.** Расчёт счёта, скидки, переходы статусов проверяются юнит-тестами на чистых объектах за миллисекунды, без базы и контейнеров.
- **Изоляция от инфраструктуры.** Смена HTTP-клиента на gRPC, обновление EF Core или брокера затрагивает `Infrastructure`, а не сценарии.
- **Явные сценарии.** Каждый use case — отдельный обработчик; по структуре `Application` видно, что система умеет.
- **Несколько входов над одной логикой.** API, консьюмеры, фоновые задачи вызывают одни и те же сценарии.
- **Дисциплина для большой команды.** Нельзя случайно отправить сообщение в Kafka из доменной сущности или сходить в `DbContext` из контроллера.

## Во что это обходится

Самая заметная цена — маппинг. Запрос «добавить в карточку счёта поле `PaymentTerms`» в строгом варианте проходит через все слои:

```text
Billing.Api/Contracts/InvoiceResponse.cs              новое поле в ответе
Billing.Api/Mapping/InvoiceMappingProfile.cs          маппинг ответа
Billing.Application/Invoices/GetInvoice/InvoiceDto.cs новое поле в DTO
Billing.Application/Invoices/GetInvoice/Handler.cs    маппинг DTO
Billing.Domain/Invoices/Invoice.cs                    свойство и правило
Billing.Infrastructure/Persistence/InvoiceRecord.cs   персистентная модель
Billing.Infrastructure/Persistence/InvoiceMapper.cs   маппинг домен ↔ запись
Billing.Infrastructure/Migrations/…                   миграция
```

Восемь файлов там, где в простом сервисе хватило бы трёх. Остальные статьи расхода:

- **Отдельные персистентные модели.** Стремление сделать домен абсолютно не знающим об ORM рождает дублирующие классы `InvoiceRecord` и ручной маппинг в обе стороны.
- **Репозиторий поверх `DbContext`.** Ради чистоты прячут `Include`, проекции, `AsNoTracking`, `ExecuteUpdate`, а потом вытаскивают их обратно через спецификации (подробнее — в `Repository поверх ORM`).
- **Медленные сложные чтения.** Список с фильтрами и сортировкой, проведённый через агрегаты и репозиторий, тянет полные сущности ради пяти колонок.
- **Порог входа.** Новичку нужно выучить соглашения раньше, чем сделать первую правку.
- **Анемичный результат.** Если в домене только свойства с геттерами и сеттерами, а логика живёт в «сервисах приложения», команда платит всю цену слоёв, а защищать нечего.

## Где обычно смягчают правила

Зрелые команды держат строгую границу там, где она окупается, и отпускают остальное.

**EF маппит доменные сущности напрямую.** Конфигурация лежит в `Infrastructure`, домен про EF не знает, дублирующих классов нет:

```csharp
public sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).HasConversion(id => id.Value, value => new InvoiceId(value));
        builder.Ignore(i => i.Total);
        builder.OwnsMany(i => i.Lines, lines =>
        {
            lines.ToTable("invoice_lines");
            lines.WithOwner().HasForeignKey("InvoiceId");
            lines.Property<int>("Id");
            lines.HasKey("Id");
        });
    }
}
```

Цена компромисса небольшая и честная: в `Invoice` появляется приватный конструктор без параметров и `private set`, а коллекция строк хранится в поле `_lines`, которое EF находит по соглашению. Домен чуть подстраивается под ORM, зато не надо поддерживать вторую модель.

**Чтения идут мимо домена.** Команды проходят через агрегаты и репозиторий, а запросы списков — прямо через `DbContext` с проекцией или через Dapper. Это CQRS внутри одного сервиса и одной базы (см. `CQRS`).

**Меньше проектов.** `Domain` и `Application` нередко живут в одной сборке, а граница между ними проверяется архитектурным тестом.

## Альтернатива: вертикальные слайсы

Для сервисов, где логики мало, а фич много, лучше работает нарезка не по слоям, а по фичам. Всё, что относится к одному сценарию, лежит рядом:

```text
src/Billing/
  Features/
    Invoices/
      IssueInvoice.cs          эндпоинт, команда, обработчик, валидация
      GetCustomerInvoices.cs   эндпоинт и запрос с проекцией
    Payments/
      RegisterPayment.cs
  Domain/                      только то, где есть настоящие инварианты
  Infrastructure/              DbContext, внешние клиенты
```

```csharp
public static class GetCustomerInvoices
{
    public sealed record Item(Guid Id, DateTime IssuedAt, decimal Total);

    public static void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/customers/{customerId:guid}/invoices", HandleAsync);

    private static async Task<IResult> HandleAsync(Guid customerId, BillingDbContext db, CancellationToken ct)
    {
        var items = await db.Invoices
            .AsNoTracking()
            .Where(i => i.CustomerId == customerId)
            .OrderByDescending(i => i.IssuedAt)
            .Select(i => new Item(i.Id, i.IssuedAt, i.Total))
            .Take(50)
            .ToListAsync(ct);
        return Results.Ok(items);
    }
}
```

Изменение фичи затрагивает один файл, а слайсы с настоящей бизнес-логикой могут опираться на богатый домен. Цена — дублирование между слайсами и риск, что общие правила расползутся по обработчикам, если за доменом не следить.

## Когда оно того стоит

Строгая Clean Architecture окупается в сложной предметной области с инвариантами (биллинг, страхование, логистика), в долгоживущем продукте, при нескольких точках входа над одной логикой и интеграциях, которые действительно меняются. Избыточна — в CRUD-сервисах и админках, интеграционных «перекладчиках», прототипах и микросервисах, которые меньше одного bounded context. Хороший тест: если убрать слои, станет ли сложнее проверить хоть одно бизнес-правило? Если нет — слоёв больше, чем правил.

## Что стоит ответить на собеседовании

Clean Architecture — это правило зависимостей: код зависит только внутрь, к домену и сценариям, а EF Core, ASP.NET и брокеры — детали снаружи. Даёт тестируемость правил без инфраструктуры, изоляцию от смены технологий, явные сценарии и одну логику для разных входов. Правило проверяют не на ревью, а ссылками между проектами и архитектурными тестами (NetArchTest, ArchUnitNET) в CI.

Цена строгого варианта — маппинг на каждом шаге (новое поле — восемь файлов), дублирующие персистентные модели, репозиторий, прячущий возможности EF, медленные чтения через агрегаты и порог входа; при анемичном домене она платится впустую. Сильный ответ называет компромиссы: EF маппит доменные сущности через Fluent API из `Infrastructure`, чтения идут мимо домена проекциями, проектов меньше, а для CRUD-сервисов — вертикальные слайсы вместо слоёв.
