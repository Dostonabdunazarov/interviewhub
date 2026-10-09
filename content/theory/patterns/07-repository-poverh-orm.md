---
title: Repository поверх ORM
slug: repository-poverh-orm
track: code-design
section: patterns
level: senior
sortOrder: 7
summary: Почему generic-репозиторий над DbContext повторяет то, что EF Core уже даёт, и при этом отнимает его возможности, где репозиторий агрегата действительно оправдан и как развести запись и чтение.
---

Вопрос «нужен ли Repository поверх EF Core» проверяет не знание паттерна, а умение отличить паттерн от ритуала. Ответы «всегда, это чистая архитектура» и «никогда, это антипаттерн» одинаково слабые. Сильный ответ объясняет, что обёртка добавляет к уже существующему, и называет случаи, где она только отнимает.

## Что такое Repository на самом деле

В каталоге Фаулера (PoEAA) Repository — посредник между доменом и слоем отображения данных, который выглядит как коллекция доменных объектов в памяти: в неё добавляют, из неё достают по критерию, и клиент не знает про SQL. Рядом стоит Unit of Work — объект, который отслеживает изменения в рамках одной бизнес-операции и записывает их в базу одной атомарной операцией.

EF Core реализует оба паттерна из коробки. `DbSet<T>` — коллекционный интерфейс с `Add`, `Remove` и LINQ-запросами. `DbContext` — единица работы: change tracker копит изменения (подробно — в `ChangeTracker`), `SaveChangesAsync` применяет их в одной транзакции, упорядочив по зависимостям. Поэтому вопрос правильно ставить не «нужен ли репозиторий», а «что ваша обёртка добавляет к репозиторию, который уже есть».

## Generic-репозиторий: копия DbSet с потерями

Типичная обёртка, которую пишут «по шаблону» в первый день проекта:

```csharp
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(int id, CancellationToken ct);
    Task<IReadOnlyList<T>> GetAllAsync(CancellationToken ct);
    Task AddAsync(T entity, CancellationToken ct);
    void Remove(T entity);
    Task SaveChangesAsync(CancellationToken ct);
}

public class EfRepository<T>(AppDbContext db) : IRepository<T> where T : class
{
    public async Task<T?> GetByIdAsync(int id, CancellationToken ct) =>
        await db.Set<T>().FindAsync([id], ct);

    public async Task<IReadOnlyList<T>> GetAllAsync(CancellationToken ct) =>
        await db.Set<T>().ToListAsync(ct);

    public async Task AddAsync(T entity, CancellationToken ct) =>
        await db.Set<T>().AddAsync(entity, ct);

    public void Remove(T entity) => db.Set<T>().Remove(entity);

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
}
```

Каждый метод — переадресация в одну строку, и это главный симптом: слой ничего не добавляет, зато отнимает.

- **`GetAllAsync` материализует таблицу целиком**, и фильтр после него выполняется в памяти.
- **Нет проекций, `Include`, `AsNoTracking`, `ExecuteUpdateAsync`.** Экран из пяти колонок тянет полные сущности с отслеживанием изменений, а всё, ради чего выбирают EF Core, осталось по другую сторону интерфейса.
- **Граница транзакции фиктивна.** `DbContext` в веб-приложении scoped, и все репозитории в запросе делят один экземпляр. `orders.SaveChangesAsync()` сохранит и изменения клиента, сделанные через `customers`: метод на одном репозитории управляет состоянием всех. Если же каждый репозиторий сохраняет сам, операция над двумя сущностями перестаёт быть атомарной.

## Как обёртка протекает

Потери быстро упираются в реальные задачи, и интерфейс начинает расти по одному и тому же сценарию. Сначала появляется `Find(Expression<Func<T, bool>> predicate)`. Но выражение — это уже LINQ, и транслируется ли оно в SQL, решает EF: абстракция ничего не изолировала, а только переименовала `Where`. Потом добавляются флаг `asNoTracking` и массив `Include`. Потом — метод `Query()`, возвращающий `IQueryable<T>`, и обёртка становится декоративной: вызывающий код строит запросы, поведение которых зависит от LINQ-провайдера, но формально «не знает про EF».

Последняя ступень — Specification: класс на каждую выборку с критерием, списком `Include`, сортировкой и пагинацией, то есть LINQ, переизобретённый в виде объектов. У паттерна есть законное применение — именованные переиспользуемые критерии сложного домена, — но как способ протащить возможности EF через generic-интерфейс он только множит файлы.

## Репозиторий агрегата

Совсем другой инструмент — репозиторий в смысле DDD. Он заводится не на таблицу, а на агрегат: на корень, через который меняется вся группа связанных объектов. Методы называются по сценариям, а не по CRUD-операциям:

```csharp
public interface IOrderRepository
{
    Task<Order?> FindAsync(OrderId id, CancellationToken ct);
    Task<IReadOnlyList<Order>> FindAwaitingShipmentAsync(DateTimeOffset placedBefore, CancellationToken ct);
    void Add(Order order);
}

internal sealed class OrderRepository(AppDbContext db) : IOrderRepository
{
    public Task<Order?> FindAsync(OrderId id, CancellationToken ct) =>
        db.Orders
            .Include(o => o.Lines)
            .SingleOrDefaultAsync(o => o.Id == id, ct);

    public async Task<IReadOnlyList<Order>> FindAwaitingShipmentAsync(
        DateTimeOffset placedBefore, CancellationToken ct) =>
        await db.Orders
            .Include(o => o.Lines)
            .Where(o => o.Status == OrderStatus.Paid && o.PlacedAt < placedBefore)
            .ToListAsync(ct);

    public void Add(Order order) => db.Orders.Add(order);
}
```

Разница с generic-версией не в синтаксисе, а в том, что гарантирует граница:

- **агрегат загружается целиком:** `Include` живёт внутри, и получить заказ без строк нельзя;
- **нет `Update` и доступа к строкам напрямую:** изменения идут через методы `Order`, которые держат инварианты;
- **нет `IQueryable` наружу:** набор запросов конечен и виден в интерфейсе, его можно проверить и оптимизировать;
- **язык предметной области:** `FindAwaitingShipmentAsync` вместо одинаковых `Where` в пяти обработчиках.

## Где вызывается SaveChanges

Репозиторий агрегата не сохраняет. Сохраняет тот, кто владеет бизнес-операцией, — обработчик команды, ровно один раз в конце:

```csharp
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public sealed class ShipOrderHandler(IOrderRepository orders, IUnitOfWork unitOfWork)
{
    public async Task HandleAsync(OrderId id, string trackingNumber, CancellationToken ct)
    {
        var order = await orders.FindAsync(id, ct)
            ?? throw new InvalidOperationException($"Заказ {id} не найден");

        order.Ship(trackingNumber);
        await unitOfWork.SaveChangesAsync(ct);
    }
}
```

Собственный `UnitOfWork` с `Commit`, `Rollback` и свойствами-репозиториями обычно не нужен: сигнатура `IUnitOfWork` совпадает с методом `DbContext`, контекст реализует интерфейс сам и регистрируется как `AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<AppDbContext>())`. Обработчик не ссылается на EF Core, транзакция одна на операцию.

## Чтение — мимо репозитория

Репозиторий агрегата нужен там, где меняют состояние и держат инварианты. Экрану списка нужны пять колонок без отслеживания, и тащить ради них агрегат с `Include` расточительно, а метод под каждый экран снова растит интерфейс. Поэтому чтение идёт напрямую через `DbContext` с проекцией в DTO:

```csharp
public sealed record OrderListItem(string Number, DateTimeOffset PlacedAt, decimal Total);

public static class OrderQueries
{
    public static void MapOrderQueries(this WebApplication app) =>
        app.MapGet("/customers/{customerId:int}/orders",
            (int customerId, AppDbContext db, CancellationToken ct) =>
                db.Orders
                    .AsNoTracking()
                    .Where(o => o.CustomerId == customerId)
                    .OrderByDescending(o => o.PlacedAt)
                    .Select(o => new OrderListItem(
                        o.Number, o.PlacedAt, o.Lines.Sum(l => l.Price * l.Quantity)))
                    .Take(50)
                    .ToListAsync(ct));
}
```

Получается разделение «запись через репозитории агрегатов, чтение напрямую» — по сути первый уровень CQRS, без отдельного хранилища; подробно он разобран в статье `CQRS`. Если запросы тяжёлые, на стороне чтения так же спокойно живёт Dapper — смешанный доступ описан в `Когда ORM мешает`.

Повторяющийся критерий при этом не обязательно прятать в репозиторий: метод расширения `AwaitingShipment(this IQueryable<Order> orders, …)` даёт ему имя из предметной области и не мешает проекциям — `db.Orders.AwaitingShipment(cutoff).Select(…)` остаётся одним SQL-запросом.

## Тесты и «а вдруг сменим ORM»

**Тестируемость.** Мок `IRepository<T>` проверяет, что метод вызван, но не то, что LINQ транслируется в SQL и фильтр правильный; InMemory-провайдер тоже ведёт себя не как PostgreSQL. Запросы проверяют на реальной базе в контейнере. Где репозиторий агрегата действительно помогает — доменная логика обработчика: с поддельным `IOrderRepository` в памяти видно, что `Ship` переводит заказ в нужный статус, без базы.

**Смена ORM** почти не случается, а когда случается, generic-интерфейс не защищает: меняется семантика отслеживания, загрузки и транзакций, и переписывать приходится запросы и сценарии, а не сигнатуры. Защищает узкий интерфейс под потребности приложения — тот же репозиторий агрегата или порт из статьи `Adapter`.

## Когда репозиторий оправдан

- **агрегаты DDD на стороне записи**, которые загружают и сохраняют как целое;
- **строгая Clean или гексагональная архитектура**, где слой приложения не ссылается на EF Core, — с поправкой на цену из `Clean Architecture и её цена`;
- **смешанное хранилище**: часть данных в PostgreSQL, часть в Redis или во внешнем API.

Не оправдан в CRUD-сервисах, админках, vertical slice архитектуре и небольших сервисах, где EF Core — единственное хранилище. Что бывает, когда generic-репозиторий всё-таки ввели «для чистоты», — в `Когда паттерн навредил`.

## Что стоит ответить на собеседовании

`DbSet<T>` уже репозиторий, `DbContext` — Unit of Work, поэтому generic-репозиторий с `GetById`, `GetAll`, `Add`, `Update` ничего не добавляет, но отнимает проекции, `Include`, `AsNoTracking` и массовые операции, а `SaveChanges` в каждом репозитории размывает границу транзакции. Попытки вернуть возможности — предикаты, флаги, `IQueryable`, спецификации — превращают обёртку в переименованный LINQ.

Оправдан репозиторий агрегата: на корень, с методами по сценариям, с загрузкой агрегата целиком внутри и без `SaveChanges` — сохраняет обработчик команды один раз. Чтение идёт мимо репозитория, напрямую через `DbContext` с проекциями в DTO. Сильный ответ добавит, что запросы тестируют на настоящей базе, а не моками, и что «сменить ORM» generic-интерфейс не помогает.
