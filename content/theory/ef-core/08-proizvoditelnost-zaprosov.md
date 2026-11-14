---
title: Производительность запросов EF Core
slug: ef-proizvoditelnost-zaprosov
track: dotnet-backend
section: ef-core
level: senior
sortOrder: 8
summary: Какие рычаги реально ускоряют работу EF Core с базой — проекция вместо сущностей, стабильный кэш трансляции, compiled queries, выбор между single и split query, массовые ExecuteUpdate и ExecuteDelete — и чем каждый из них платит.
questions: ef-core-chto-takoe-projection-cherez-select, ef-core-kak-ef-core-keshiruet-translyaciyu-linq-zaprosov-i-pochemu-konstanty-i-contains, ef-core-kak-vybrat-mezhdu-single-query-i-split-query-pri-zagruzke-neskolkih-kollekcii-i, ef-core-chto-obhodyat-executeupdate-i-executedelete-i-kak-sovmeschat-ih-s-otslezhivaemym
---

Медленный EF Core почти никогда не упирается в «ORM как таковой». Время уходит на четыре вещи: лишние колонки и строки, которые база отдаёт и клиент материализует; перекомпиляцию запросов, у которых каждый раз новая форма; перемноженные строки при загрузке графа; и загрузку тысяч сущностей ради одного массового изменения. У каждой проблемы есть штатный инструмент, и у каждого инструмента — своя цена.

Базовые механизмы — в статьях `ChangeTracker`, `Загрузка связей и N+1` и `Трансляция IQueryable в SQL`; здесь — как ими пользоваться на горячем пути.

## Проекция вместо сущностей

Проекция — это `Select` в DTO, record или анонимный тип вместо загрузки целых сущностей. EF видит выражение и читает только используемые колонки, а связанные данные подтягивает сам — через `JOIN` для ссылок и коррелированные подзапросы для агрегатов:

```csharp
public record OrderListItem(int Id, DateTime CreatedAt, string Customer, int Lines, decimal Total);

var page = await db.Orders
    .Where(o => o.Status == OrderStatus.Paid)
    .OrderByDescending(o => o.CreatedAt).ThenBy(o => o.Id)
    .Select(o => new OrderListItem(
        o.Id, o.CreatedAt, o.Customer.Name,
        o.Lines.Count,
        o.Lines.Sum(l => l.Price * l.Quantity)))
    .Take(50)
    .ToListAsync(ct);
```

Получается один SQL с `JOIN "Customers"` и двумя подзапросами `count(*)` и `sum(...)`. По сравнению с `Include(o => o.Customer).Include(o => o.Lines)` выигрыш складывается из нескольких частей: по сети идут пять колонок, а не все колонки трёх таблиц; агрегаты считает база, а не LINQ to Objects над загруженными коллекциями; строки не дублируются из-за коллекции; DTO не сущность, поэтому трекера нет вовсе и `AsNoTracking()` не нужен.

Нетранслируемый код допустим только в финальном `Select`, и если он спрятан в конструкторе DTO или методе маппинга, EF не видит, какие поля нужны, и может прочитать сущность целиком. `ProjectTo<T>()` в AutoMapper и `ProjectToType<T>()` в Mapster строят тот же `Select` автоматически — это правильная интеграция, в отличие от `ToListAsync()` с последующим `Map()`. Проекция подходит только для чтения: чтобы изменить данные, нужны отслеживаемые сущности или `ExecuteUpdate`. `Include` остаётся там, где граф будут менять и сохранять.

## Кэш трансляции: форма запроса

Трансляция LINQ в SQL дорогая: раскрытие навигаций, перевод в SQL-дерево, генерация текста, компиляция shaper'а. EF кэширует результат по **структуре** дерева выражений плюс часть настроек (трекинг, режим split). Перед поиском в кэше EF извлекает параметры: всё, что вычислимо без базы — замыкания, поля, вызовы методов, — заменяется узлом-параметром. Отсюда правило:

```csharp
await db.Orders.Where(o => o.Status == OrderStatus.New).ToListAsync(ct);

var customerId = request.CustomerId;
await db.Orders.Where(o => o.CustomerId == customerId).ToListAsync(ct);
```

Литерал `OrderStatus.New` вклеивается в SQL как `o."Status" = 0` и входит в ключ кэша. Захваченная переменная превращается в поле класса-замыкания, EF видит обращение к члену и делает из него `@customerId` — в ключ кэша значение не входит. Литерал в коде безвреден, потому что он фиксирован. Беда начинается, когда «литерал» меняется: типичный источник — динамически собранные деревья с `Expression.Constant(value)`, `EF.Constant` на переменных значениях, `FromSqlRaw` с интерполяцией. Каждое новое значение даёт новую запись в кэше EF, полную компиляцию (от сотен микросекунд до единиц миллисекунд на сложный запрос), новый текст SQL и новый prepared statement на стороне PostgreSQL. Кэш ограничен по размеру, и поток уникальных запросов начинает вытеснять нормальные.

Диагностика: `dotnet-counters monitor Microsoft.EntityFrameworkCore` показывает `Query Cache Hit Rate`, который на прогретом сервисе должен быть близок к 100% (см. `dotnet-counters и dotnet-trace`). В `pg_stat_statements` засорение выглядит как сотни почти одинаковых запросов с малым `calls`.

## Contains по коллекции

`ids.Contains(o.Id)` — самый частый случай. До EF Core 8 на SQL Server значения списка вклеивались константами: `IN (1, 2, 3)`. Каждый набор id давал новый текст SQL, новый план в кэше сервера и генерацию SQL при каждом выполнении. В EF Core 8 появились primitive collections: коллекция стала обычным параметром. На SQL Server это `IN (SELECT value FROM OPENJSON(@ids))`, а Npgsql передаёт её нативным массивом:

```sql
SELECT o."Id", o."Status" FROM "Orders" AS o WHERE o."Id" = ANY (@ids)
```

Один текст на любые наборы, одна запись в кэше. Обратная сторона — после нескольких выполнений prepared statement PostgreSQL может перейти на generic-план, где размер массива неизвестен, и списки на 3 и на 30 000 элементов получат один план. Если план с конкретными значениями заметно лучше, инлайн возвращают точечно через `EF.Constant(ids)` или глобально через `TranslateParameterizedCollectionsToConstants()` (EF Core 9). Огромные списки лучше соединять с `unnest(@ids)` или временной таблицей.

## Compiled queries

Кэш снимает стоимость трансляции, но на каждый вызов EF всё равно строит дерево, извлекает параметры и структурно сравнивает его с ключами кэша. `EF.CompileAsyncQuery` делает это один раз и возвращает делегат:

```csharp
private static readonly Func<AppDbContext, int, Task<Order?>> OrderById =
    EF.CompileAsyncQuery((AppDbContext db, int id) =>
        db.Orders.AsNoTracking().FirstOrDefault(o => o.Id == id));
```

Экономятся микросекунды и аллокации на вызов, а не время в базе. Смысл есть на горячем пути с быстрым SQL фиксированной формы — поиск по ключу тысячи раз в секунду. Динамические фильтры так не скомпилировать, а отчёт на 200 мс в базе от этого не ускорится.

## Single query или split query

По умолчанию граф с `Include` грузится одним SQL через `LEFT JOIN`. Пока коллекция одна, это просто дублирование колонок родителя. С двумя коллекциями одного уровня строки перемножаются: блог с 200 постами и 30 авторами даёт 6000 строк вместо 231, и в каждой повторяется, например, широкая колонка `Description`. EF выбросит дубли при материализации, но база их уже отсортировала, сеть передала, а клиент разобрал. На таких запросах EF пишет предупреждение `MultipleCollectionIncludeWarning`.

`AsSplitQuery()` разбивает загрузку на отдельный `SELECT` для корня и по одному на каждую коллекцию; потоки отсортированы по ключу корня, и EF сшивает их. Режим задают глобально и переопределяют локально:

```csharp
services.AddDbContext<AppDbContext>(o => o.UseNpgsql(cs, npgsql =>
    npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));

var order = await db.Orders.Include(o => o.Lines).AsSingleQuery().FirstAsync(o => o.Id == id, ct);
```

Цена split query:

- **Нет общего снимка.** В `Read Committed` каждый `SELECT` видит свой момент времени, и граф может собраться из разных состояний. Если нужна согласованность, запросы оборачивают в транзакцию `RepeatableRead` — в PostgreSQL это один снимок на всю транзакцию (см. `Транзакции и уровни изоляции`).
- **Сортировка должна быть детерминированной.** `Skip`/`Take` и фильтр корня повторяются в каждом запросе. При `OrderBy(b => b.CreatedAt)` с одинаковыми датами разные запросы выберут разные «страницы», и коллекции пристанут не к тем корням. Нужен `ThenBy(b => b.Id)`.
- **Повтор тяжёлого `WHERE`** и отдельный round-trip на каждую коллекцию: при задержке до базы в несколько миллисекунд на маленьких графах split медленнее.
- **Буферизация.** Npgsql читает на соединении один результат за раз, поэтому предыдущие результаты держатся в памяти, пока выполняются следующие.

Single подходит для одной коллекции, ссылочных навигаций и маленьких графов; split — для нескольких заметных коллекций и широких корней. А если нужны часть полей или агрегаты, правильный ответ — проекция.

## ExecuteUpdate и ExecuteDelete

С EF Core 7 `ExecuteUpdateAsync` и `ExecuteDeleteAsync` транслируют запрос в один `UPDATE` или `DELETE` и выполняют его сразу, без загрузки сущностей:

```csharp
var affected = await db.Orders
    .Where(o => o.Status == OrderStatus.New && o.CreatedAt < cutoff)
    .ExecuteUpdateAsync(s => s
        .SetProperty(o => o.Status, OrderStatus.Expired)
        .SetProperty(o => o.UpdatedAt, DateTime.UtcNow), ct);
```

Скорость берётся из того, что пропускается всё, что делает `SaveChanges`. Change tracker не участвует, и уже загруженные сущности остаются со старыми значениями. `SaveChangesInterceptor` и событие `SavingChanges` не срабатывают — значит, молча не работают аудит, проставление `UpdatedAt`, outbox и soft delete, если они построены на сохранении: `ExecuteDeleteAsync` удалит строки физически. Каскады на клиенте не выполняются, работает только `ON DELETE` в схеме, а при `RESTRICT` команда упадёт на внешнем ключе. Concurrency token не проверяется (см. `Оптимистичная блокировка`). При этом `DbCommandInterceptor` команду видит, а global query filters попадают в `WHERE`.

Конкурентность восстанавливают вручную — условием в `Where` и проверкой числа строк:

```csharp
var n = await db.Accounts
    .Where(a => a.Id == id && a.Version == expected && a.Balance >= amount)
    .ExecuteUpdateAsync(s => s
        .SetProperty(a => a.Balance, a => a.Balance - amount)
        .SetProperty(a => a.Version, a => a.Version + 1), ct);
if (n == 0) throw new DbUpdateConcurrencyException("Счёт изменён или средств недостаточно");
```

Совмещать с отслеживаемыми сущностями нужно осторожно. Если сущность загружена до массового обновления, повторный tracking-запрос вернёт **тот же экземпляр** из identity map со старыми значениями, а последующий `SaveChanges` по нему может перезаписать результат массовой операции. Варианты: выполнять массовые операции до загрузки или в отдельном коротком контексте; после операции вызывать `ChangeTracker.Clear()` или `Entry(x).ReloadAsync()`; читать дальше через `AsNoTracking()`.

Своей транзакции с остальными изменениями у `ExecuteUpdate` нет: команда уходит немедленно, отдельно от неявной транзакции `SaveChanges`. Если массовая операция должна быть атомарна вместе с сохранением, нужна явная транзакция, а при `EnableRetryOnFailure` — внутри execution strategy:

```csharp
var strategy = db.Database.CreateExecutionStrategy();
await strategy.ExecuteAsync(async () =>
{
    await using var tx = await db.Database.BeginTransactionAsync(ct);
    db.AuditEntries.Add(new AuditEntry("orders.expire", cutoff));
    await db.SaveChangesAsync(ct);
    await db.Orders.Where(o => o.CreatedAt < cutoff).ExecuteDeleteAsync(ct);
    await tx.CommitAsync(ct);
});
```

## Что стоит ответить на собеседовании

Для чтения основной инструмент — проекция через `Select`: только нужные колонки, агрегаты в SQL, нет трекинга и дублирования строк, в отличие от `Include`. EF кэширует трансляцию по форме дерева: захваченные переменные становятся параметрами, литералы входят в ключ, поэтому динамические константы засоряют кэш. `Contains` по списку с EF Core 8 передаётся одним параметром, в PostgreSQL — `= ANY(@ids)`, а раньше на SQL Server давал новый `IN (...)` на каждый набор. Несколько коллекций в `Include` дают декартов взрыв, который лечит `AsSplitQuery()`. Массовые изменения — через `ExecuteUpdate`/`ExecuteDelete`.

Сильный ответ называет цену каждого рычага. У split query нет общего снимка без транзакции `RepeatableRead`, ему нужна детерминированная сортировка, и он платит лишними round-trip'ами. `ExecuteUpdate` обходит трекер, перехватчики `SaveChanges`, клиентские каскады и concurrency token, поэтому конкурентность пишут условием в `Where`, загруженные сущности перечитывают или чистят трекер, а атомарность с `SaveChanges` обеспечивают явной транзакцией внутри execution strategy. Compiled queries экономят микросекунды на горячем пути, а не время в базе.
