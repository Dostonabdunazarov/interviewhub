---
title: Слоистая vs гексагональная
slug: sloistaya-vs-geksagonalnaya
track: code-design
section: app-architecture
level: middle
sortOrder: 1
summary: Чем классическая слоистая архитектура отличается от гексагональной на практике — направлением зависимостей и тем, кто владеет интерфейсом хранилища, — и когда эта разница действительно окупается.
---

Почти каждый .NET-проект начинается с трёх папок: `Controllers`, `Services`, `Repositories`. Это слоистая архитектура, и она работает, пока не выясняется, что бизнес-логику нельзя проверить без базы, а второй канал входа — консьюмер Kafka или фоновая задача — дублирует половину сервиса. Гексагональная архитектура (Ports and Adapters) решает именно это, но не магией, а одним сдвигом: база данных перестаёт быть фундаментом, на котором стоит приложение. На собеседовании вопрос «чем они отличаются» проверяет, понимает ли кандидат этот сдвиг, или знает только картинку с шестиугольником.

## Слоистая: зависимости идут вниз, к базе

Классическая схема — UI → бизнес-логика → доступ к данным. Каждый слой ссылается на нижний:

```text
src/
  Shop.Api            контроллеры, ссылается на Shop.Business
  Shop.Business       сервисы, ссылается на Shop.DataAccess
  Shop.DataAccess     EF Core, сущности, репозитории
```

Интерфейс хранилища при этом лежит в слое данных и описывает то, что умеет хранилище:

```csharp
namespace Shop.DataAccess;

public interface IOrderRepository
{
    OrderEntity? GetById(int id);
    IReadOnlyList<OrderEntity> GetAll();
    void Update(OrderEntity order);
}
```

```csharp
namespace Shop.Business;

public sealed class OrderService(IOrderRepository repository)
{
    public void Cancel(int orderId)
    {
        var order = repository.GetById(orderId)
            ?? throw new InvalidOperationException("Заказ не найден");
        if (order.Status == OrderStatus.Shipped)
            throw new InvalidOperationException("Отгруженный заказ не отменить");
        order.Status = OrderStatus.Cancelled;
        repository.Update(order);
    }
}
```

Интерфейс есть, DI есть, но зависимость по-прежнему направлена вниз: `Shop.Business` ссылается на `Shop.DataAccess` и работает с `OrderEntity` — классом, форма которого продиктована таблицей. Изменилась таблица — меняется бизнес-слой.

## Во что это превращается

Слоистая схема сама по себе не плоха: для небольшого сервиса с одной базой она проста и понятна. Проблемы появляются с ростом:

- **интерфейсы повторяют таблицы**: `GetById`, `GetAll`, `Update` — CRUD над сущностями, а не операции предметной области;
- **логика утекает вниз**: в хранимые процедуры, в конфигурацию EF, в «умные» репозитории с бизнес-фильтрами;
- **тест бизнес-правила требует базы** или мока, который повторяет поведение EF;
- **новая точка входа** — консьюмер, gRPC, CLI — получает свой «верхний слой», и логика начинает дублироваться между контроллером и обработчиком сообщений.

## Порты и адаптеры

Гексагональная архитектура ставит в центр приложение с доменом. Оно объявляет **порты** — интерфейсы, через которые общается с миром, — а всё внешнее подключается к ним **адаптерами**:

```text
Слоистая:       Api → Business → DataAccess → БД

Гексагональная: [HTTP] → (входной порт) → Application + Domain ← (выходной порт) ← [PostgreSQL]
                [Kafka-консьюмер] ↗                                              ← [HTTP-клиент склада]
```

Порты бывают двух видов. **Входные** (driving) описывают, что приложение умеет; их вызывают контроллер, консьюмер, тест. **Выходные** (driven) описывают, что приложению нужно от мира; их реализуют адаптеры базы, брокера, внешних API.

```csharp
public interface IPlaceOrder
{
    Task<OrderId> HandleAsync(PlaceOrderCommand command, CancellationToken ct);
}

public interface IOrderStore
{
    Task<Order?> FindAsync(OrderId id, CancellationToken ct);
    Task AddAsync(Order order, CancellationToken ct);
}

public interface IStockReservation
{
    Task<ReservationResult> ReserveAsync(IReadOnlyList<OrderLine> lines, CancellationToken ct);
}
```

Сценарий реализует входной порт и пользуется выходными, ничего не зная о том, что за ними:

```csharp
public sealed class PlaceOrderHandler(IOrderStore orders, IStockReservation stock) : IPlaceOrder
{
    public async Task<OrderId> HandleAsync(PlaceOrderCommand command, CancellationToken ct)
    {
        var order = Order.Place(command.CustomerId, command.Lines);
        var reservation = await stock.ReserveAsync(order.Lines, ct);
        if (!reservation.Success)
            throw new InvalidOperationException(reservation.Reason);
        await orders.AddAsync(order, ct);
        return order.Id;
    }
}
```

Раскладка проектов отражает то же направление: инфраструктура ссылается на приложение, а не наоборот.

```text
src/
  Shop.Application     домен, сценарии, порты; ни одной ссылки на EF или ASP.NET
  Shop.Adapters.Http   Minimal API, маппинг запросов в команды
  Shop.Adapters.Kafka  консьюмер заказов с маркетплейса
  Shop.Adapters.Db     EF Core, реализация IOrderStore
  Shop.Host            composition root: регистрирует адаптеры в DI
```

## Главное отличие — кто владеет интерфейсом

В слоистой архитектуре `IOrderRepository` лежит в слое данных и отражает возможности хранилища. В гексагональной `IOrderStore` лежит в приложении и отражает потребности сценария, а адаптер PostgreSQL под него подстраивается. Это и есть принцип инверсии зависимостей, применённый на уровне архитектуры, а не отдельного класса.

| | Слоистая | Гексагональная |
| --- | --- | --- |
| Где лежит интерфейс хранилища | в слое данных | в приложении |
| Форма интерфейса | повторяет таблицы: `GetById`, `GetAll`, `Update` | повторяет сценарий: `FindPendingForCustomer`, `ReserveAsync` |
| Тест бизнес-логики | с базой или моками DAL | с in-memory адаптерами |
| Новая точка входа | новый верхний слой, риск дублирования | ещё один входной адаптер |
| Типичная деградация | логика уезжает в процедуры и репозитории | порт на каждую мелочь |

## Второй вход без дублирования

Выгода видна, как только появляется второй канал. Заказы с маркетплейса приходят через Kafka, и консьюмер вызывает тот же входной порт, что и HTTP-эндпоинт:

```csharp
app.MapPost("/orders", async (PlaceOrderRequest req, IPlaceOrder placeOrder, CancellationToken ct) =>
{
    var id = await placeOrder.HandleAsync(req.ToCommand(), ct);
    return Results.Created($"/orders/{id}", new { id });
});

public sealed class MarketplaceOrderConsumer(IPlaceOrder placeOrder)
{
    public Task HandleAsync(MarketplaceOrderMessage message, CancellationToken ct) =>
        placeOrder.HandleAsync(new PlaceOrderCommand(message.BuyerId, message.Items), ct);
}
```

Адаптеры здесь тонкие: перевести внешний формат в команду и вызвать порт. Правила оформления заказа живут в одном месте.

## Тест через порт

Сценарий проверяется целиком через входной порт с фейковыми выходными адаптерами — без HTTP, без базы и без мокинга каждого вызова:

```csharp
public sealed class InMemoryOrderStore : IOrderStore
{
    private readonly Dictionary<OrderId, Order> _orders = new();

    public Task<Order?> FindAsync(OrderId id, CancellationToken ct) =>
        Task.FromResult(_orders.GetValueOrDefault(id));

    public Task AddAsync(Order order, CancellationToken ct)
    {
        _orders.Add(order.Id, order);
        return Task.CompletedTask;
    }
}

[Fact]
public async Task Placed_order_is_stored()
{
    var store = new InMemoryOrderStore();
    var handler = new PlaceOrderHandler(store, new AlwaysAvailableStock());

    var id = await handler.HandleAsync(
        new PlaceOrderCommand(Guid.NewGuid(), [new OrderLine("SKU-1", 2, 100m)]),
        CancellationToken.None);

    var saved = await store.FindAsync(id, CancellationToken.None);
    Assert.NotNull(saved);
}
```

Фейк проверяет поведение, а не последовательность вызовов, и переживает рефакторинг обработчика. Сами адаптеры проверяются отдельно — интеграционными тестами против настоящего PostgreSQL в контейнере: только так видно, что LINQ транслируется в правильный SQL.

## Трезвый взгляд

Гексагональную архитектуру часто продают аргументом «заменим PostgreSQL на MongoDB одним адаптером». Это почти никогда не случается и почти никогда не получается: транзакции, модель согласованности и форма запросов протекают через любой порт. Настоящая выгода в другом — тестируемость сценариев и несколько входных каналов над одной логикой.

Отсюда и границы применимости:

- для сервиса с одной точкой входа и одной базой разница с аккуратной слоистой архитектурой невелика;
- порт нужен там, где есть граница процесса или нестабильная внешняя зависимость, а не на каждую библиотеку — иначе получаются абстракции с единственной реализацией (см. `Преждевременные абстракции`);
- транзакция обычно оборачивает вызов входного порта: Unit of Work или `DbContext` выходного адаптера, сохранение — один раз в конце сценария.

Onion и Clean Architecture — та же идея под другими названиями: зависимости направлены к домену, инфраструктура — снаружи. Различий в терминологии больше, чем в сути; цена строгого варианта разобрана в статье `Clean Architecture и её цена`.

## Что стоит ответить на собеседовании

В слоистой архитектуре зависимости идут сверху вниз, и бизнес-слой зависит от слоя данных: интерфейс репозитория лежит рядом с EF и повторяет таблицы. В гексагональной центр — приложение с доменом; оно объявляет входные порты (что умеет) и выходные (что ему нужно), а HTTP, база, брокер и внешние API подключаются адаптерами. Ключевая разница — владение интерфейсом: `IOrderStore` описывает потребности сценария и лежит в приложении, а адаптер PostgreSQL под него подстраивается. Это инверсия зависимостей на уровне архитектуры.

Практическая выгода — сценарии тестируются через входной порт с in-memory адаптерами, а новая точка входа вроде Kafka-консьюмера становится ещё одним тонким адаптером без дублирования логики. Сильный ответ добавит трезвость: «заменить базу одним адаптером» — миф, для маленького сервиса с одним входом разница невелика, а порт на каждую зависимость — перебор. Onion и Clean — вариации той же идеи.
