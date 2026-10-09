---
title: Загрузка связей и N+1
slug: zagruzka-svyazey-i-n-plus-1
track: dotnet-backend
section: ef-core
level: middle
sortOrder: 2
summary: Eager, lazy и explicit loading, откуда берётся N+1 и как его поймать, что генерирует Include, почему две коллекции дают декартово произведение и когда проекция лучше всех трёх стратегий.
---

Навигационное свойство `order.Lines` выглядит как обычная коллекция, но за ним стоит другая таблица. Вопрос «когда и каким запросом её загрузить» EF Core решает тремя способами, и выбор между ними определяет, сколько SQL-команд уйдёт в базу на одну операцию — одна, три или тысяча. Последний вариант называется N+1, и это самая частая проблема производительности в коде на EF.

## Три стратегии загрузки

Стратегии различаются тем, **кто и когда** решает загрузить связанные данные:

```csharp
var orders = await db.Orders.Include(o => o.Lines).ToListAsync();

var order = await db.Orders.FirstAsync();
var n = order.Lines.Count;

var other = await db.Orders.FirstAsync();
if (needLines)
    await db.Entry(other).Collection(o => o.Lines).LoadAsync();
```

| | Eager (`Include`) | Lazy | Explicit (`Load`) |
| --- | --- | --- | --- |
| Когда грузится | вместе с основным запросом | при первом обращении к навигации | при вызове `LoadAsync` |
| Кто решает | запрос | рантайм, через прокси | код после запроса |
| Число запросов | известно заранее | непредсказуемо | по одному на вызов |
| Асинхронность | да | нет, геттер синхронный | да |
| Нужен живой контекст | нет | да | да |

Lazy loading в EF Core по умолчанию выключен. Включается он пакетом `Microsoft.EntityFrameworkCore.Proxies` и вызовом `UseLazyLoadingProxies()`; навигации должны быть `virtual`, а классы — не `sealed`, потому что EF создаёт в рантайме наследника и переопределяет геттеры. В замере ниже материализованные заказы имеют тип `OrderProxy`, а не `Order`.

## Как выглядит N+1

Код, который выглядит безобидно:

```csharp
var orders = await db.Orders.ToListAsync();
foreach (var o in orders)
    total += o.Lines.Count;
```

С включёнными прокси каждое обращение к `o.Lines` — отдельный `SELECT`. Замер с логированием команд на 50 заказах:

```
lazy loading в цикле                 51 команда
explicit LoadAsync в цикле           51 команда
Include(o => o.Lines)                 1 команда
Where(c => ids.Contains(c.Id))        2 команды (список + пачка по ключам)
```

Lazy и explicit дают одно и то же: проблема не в механизме, а в том, что запрос стоит внутри цикла. По отдельности каждая команда быстрая, но сетевой roundtrip, разбор, планирование и выдача соединения из пула умножаются на N. Для lazy loading добавляется ещё и синхронность: геттер свойства не может быть `async`, поэтому каждый скрытый запрос блокирует поток пула, и под нагрузкой это ведёт к голоданию thread pool (см. `Дедлоки на .Result`).

N+1 возникает не только от прокси. Типичные источники в реальном коде: сервисный метод `GetCustomer(id)`, вызванный в `foreach`; маппинг после `ToList()`, который трогает навигации; резолверы GraphQL, каждый из которых ходит в базу сам. С Dapper проблема та же — это паттерн доступа к данным, а не свойство ORM.

## Что генерирует Include

`Include` по ссылке превращается в `JOIN`, по коллекции — в `LEFT JOIN` с сортировкой по ключам. SQL, который сгенерировал Npgsql-провайдер EF Core 10 (список колонок сокращён):

```csharp
db.Orders
    .Include(o => o.Customer)
    .Include(o => o.Lines).ThenInclude(l => l.Product)
    .Where(o => o.CreatedAt >= from);
```

```sql
SELECT o."Id", o."CreatedAt", …, c."Id", c."Name", …, s."Id", s."ProductId", …, s."Description", …
FROM "Orders" AS o
INNER JOIN "Customers" AS c ON o."CustomerId" = c."Id"
LEFT JOIN (
    SELECT l."Id", l."OrderId", …, p."Id" AS "Id0", p."Description", p."Name", …
    FROM "Lines" AS l
    INNER JOIN "Products" AS p ON l."ProductId" = p."Id"
) AS s ON o."Id" = s."OrderId"
WHERE o."CreatedAt" >= @from
ORDER BY o."Id", c."Id", s."Id"
```

`ORDER BY` по ключам нужен не вам, а EF: результат читается потоком, и чтобы собрать заказ со строками, все строки одного заказа должны идти подряд. Обратите внимание на `p."Description"`: `Include` тянет **все** колонки связанной таблицы. Если у товара описание на 20 КБ, оно приедет столько раз, сколько у заказов строк с этим товаром.

Есть и filtered include (EF Core 5+), где внутри можно писать `Where`, `OrderBy`, `Take`. «Последние пять оплаченных заказов каждого клиента» транслируется в оконную функцию:

```sql
LEFT JOIN (
    SELECT o0.*
    FROM (
        SELECT o.*, ROW_NUMBER() OVER(PARTITION BY o."CustomerId" ORDER BY o."CreatedAt" DESC) AS row
        FROM "Orders" AS o
        WHERE o."Status" = 1
    ) AS o0
    WHERE o0.row <= 5
) AS o1 ON c."Id" = o1."CustomerId"
```

Ловушка filtered include — трекинг: если часть заказов клиента уже лежит в трекере, fix-up добавит их в навигацию, и коллекция окажется больше, чем пропустил фильтр.

## Две коллекции — декартово произведение

`Include` двух коллекций одного уровня порождает `JOIN` с обеими:

```sql
SELECT o.*, l.*, p.*
FROM "Orders" AS o
LEFT JOIN "Lines" AS l ON o."Id" = l."OrderId"
LEFT JOIN "Payment" AS p ON o."Id" = p."OrderId"
ORDER BY o."Id", l."Id"
```

Для каждого заказа база вернёт `строки × платежи` комбинаций. В тестовых данных было 50 заказов, 200 строк и 150 платежей — 400 «полезных» записей. Запрос с двумя `LEFT JOIN` вернул **600 строк**, и в каждой продублированы все колонки заказа. При 20 строках и 10 платежах на заказ множитель уже 200 вместо 30. Это называется cartesian explosion, и EF сам предупреждает о нём через `MultipleCollectionIncludeWarning`.

Решение — split query:

```csharp
db.Orders.Include(o => o.Lines).Include(o => o.Payments).AsSplitQuery();
```

```sql
SELECT o.* FROM "Orders" AS o ORDER BY o."Id";
SELECT l.*, o."Id" FROM "Orders" AS o INNER JOIN "Lines" AS l ON o."Id" = l."OrderId" ORDER BY o."Id";
SELECT p.*, o."Id" FROM "Orders" AS o INNER JOIN "Payment" AS p ON o."Id" = p."OrderId" ORDER BY o."Id";
```

Три команды вместо одной (проверено по логу), зато без перемножения. Цена тоже есть:

- несколько roundtrip'ов вместо одного;
- **консистентность**: без транзакции с подходящим уровнем изоляции данные между запросами могут измениться (см. `Транзакции и уровни изоляции`);
- с `Skip`/`Take` нужна однозначная сортировка, иначе запросы разойдутся в том, какую страницу они видят.

Режим можно поменять глобально: `UseNpgsql(cs, o => o.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery))`, а в конкретных запросах возвращаться к `AsSingleQuery()`.

## Проекция — четвёртая стратегия

Для чтения часто лучше всех трёх стратегий — проекция через `Select`. EF сам решает, какие таблицы подключить, и выбирает только нужные колонки, а агрегаты считает в базе:

```csharp
db.Orders
    .Where(o => o.Status == OrderStatus.Paid)
    .OrderByDescending(o => o.CreatedAt)
    .Select(o => new
    {
        o.Id,
        Customer = o.Customer.Name,
        LinesCount = o.Lines.Count,
        Sum = o.Lines.Sum(l => l.Price * l.Quantity)
    })
    .Take(50);
```

```sql
SELECT o0."Id", c."Name" AS "Customer", (
    SELECT count(*)::int FROM "Lines" AS l WHERE o0."Id" = l."OrderId") AS "LinesCount", (
    SELECT COALESCE(sum(l0."Price" * l0."Quantity"::numeric), 0.0)
    FROM "Lines" AS l0 WHERE o0."Id" = l0."OrderId") AS "Sum"
FROM (
    SELECT o."Id", o."CreatedAt", o."CustomerId"
    FROM "Orders" AS o
    WHERE o."Status" = 1
    ORDER BY o."CreatedAt" DESC
    LIMIT @p
) AS o0
INNER JOIN "Customers" AS c ON o0."CustomerId" = c."Id"
ORDER BY o0."CreatedAt" DESC
```

Один запрос, ни одной лишней колонки, `Include` не нужен (если он стоит перед `Select`, EF его игнорирует), трекинга нет. Вложенная коллекция в проекции (`Lines = o.Lines.Select(…).ToList()`) по-прежнему даёт `LEFT JOIN` с дублированием строк родителя, но строки узкие, и `AsSplitQuery()` работает и здесь.

`Include` остаётся правильным выбором, когда граф будет изменён и сохранён: загрузить агрегат, поменять, вызвать `SaveChanges`. Для ответа API, списка или отчёта — проекция.

## Пакетная загрузка по ключам

Когда связанные данные нужны из другого запроса или другого сервиса, N+1 убирают пачкой:

```csharp
var ids = orders.Select(o => o.CustomerId).Distinct().ToList();
var customers = await db.Customers
    .Where(c => ids.Contains(c.Id))
    .ToDictionaryAsync(c => c.Id);
```

```sql
-- @ids={ '1', '2', '3' } (DbType = Object)
SELECT c."Id", c."Email", c."Name"
FROM "Customers" AS c
WHERE c."Id" = ANY (@ids)
```

Npgsql передаёт список одним параметром-массивом PostgreSQL, поэтому текст запроса не зависит от длины списка и план переиспользуется. В сервисном слое то же самое выглядит как замена `GetById` в цикле на `GetByIds(ids)`, в GraphQL — как DataLoader.

## Как поймать N+1

N+1 обнаруживают по **числу команд на операцию**, а не по времени одной команды:

- **Лог EF.** Категория `Microsoft.EntityFrameworkCore.Database.Command` на уровне `Information`: десятки одинаковых `SELECT … WHERE "OrderId" = @p` подряд с разными параметрами.
- **Трейсинг.** OpenTelemetry-инструментирование Npgsql показывает db-span'ы внутри HTTP-запроса — пачка одинаковых спанов видна сразу.
- **`pg_stat_statements`** на стороне PostgreSQL: запрос с огромным `calls` и крошечным средним временем.
- **Тест-страховка.** `DbCommandInterceptor`, который считает команды, и интеграционный тест «эндпоинт делает не больше трёх запросов» — это единственный способ не вернуть N+1 при следующем рефакторинге.

```csharp
public sealed class CommandCounter : DbCommandInterceptor
{
    public int Count;

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command, CommandEventData eventData,
        InterceptionResult<DbDataReader> result, CancellationToken ct = default)
    {
        Interlocked.Increment(ref Count);
        return base.ReaderExecutingAsync(command, eventData, result, ct);
    }
}
```

И организационная мера: многие команды просто не подключают прокси lazy loading в веб-сервисах — без них скрытых запросов в геттерах не бывает. Чего делать не стоит — лечить N+1 гигантским `Include` на пять коллекций: вместо тысячи маленьких запросов получится один огромный с декартовым произведением.

## Что стоит ответить на собеседовании

Eager loading (`Include`) загружает связи в том же запросе, lazy — при первом обращении к навигации через прокси, explicit — отдельным `LoadAsync` по решению кода. N+1 возникает, когда запрос за связанными данными стоит внутри цикла по списку: на 50 заказах lazy loading дал 51 команду против одной у `Include`, и explicit loading в цикле дал те же 51. Ловят его по числу команд на операцию — логом, трейсингом, `pg_stat_statements` или тестом со счётчиком команд.

Сильный ответ добавит, что `Include` двух коллекций даёт декартово произведение — 600 строк вместо 400 полезных на тестовых данных — и лечится `AsSplitQuery()` ценой нескольких roundtrip'ов и консистентности без транзакции. И скажет, что для чтения лучше всего проекция через `Select`: один запрос, только нужные колонки, агрегаты в SQL и никакого трекинга, а `Include` нужен там, где граф будут менять и сохранять.
