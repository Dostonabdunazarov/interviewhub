---
title: Транзакции и уровни изоляции
slug: ef-tranzakcii-i-urovni-izolyacii
track: dotnet-backend
section: ef-core
level: senior
sortOrder: 4
summary: Какую транзакцию EF открывает сам и когда не открывает вовсе, как объединить несколько SaveChanges, зачем EF ставит savepoint, как выбрать уровень изоляции и почему ручная транзакция ломается при включённых ретраях.
---

Про ACID и аномалии параллельных транзакций подробно рассказывает статья `Уровни изоляции` из раздела про PostgreSQL. Здесь — вопрос с другой стороны: что из этого делает EF Core сам, где граница его неявной транзакции, как открыть свою, и какие ошибки возникают на стыке транзакций с execution strategy. На собеседовании обычно начинают с «`SaveChanges` атомарен?» и быстро доходят до «а два `SaveChanges` подряд?».

## Неявная транзакция SaveChanges

Каждый вызов `SaveChanges()` атомарен: все `INSERT`, `UPDATE` и `DELETE`, которые он вычислил, либо применяются вместе, либо не применяются вовсе. Но «каждый вызов в транзакции» — не совсем точно. Проверено по логу транзакций EF Core 10:

```
одна изменённая сущность       UPDATE без BEGIN/COMMIT
UPDATE + INSERT                BEGIN; UPDATE …; INSERT …; COMMIT
```

Если команда одна, отдельная транзакция не нужна: одиночный оператор в PostgreSQL атомарен сам по себе, и EF экономит два roundtrip'а. Это поведение по умолчанию `AutoTransactionBehavior.WhenNeeded` (EF Core 7+); `Always` заставит открывать транзакцию всегда, `Never` — не открывать вовсе, на свой риск.

Несколько команд Npgsql-провайдер отправляет одним пакетом. SQL, который сгенерировал EF Core 10 для изменения одного клиента и добавления другого:

```sql
UPDATE "Customers" SET "Email" = @p0
WHERE "Id" = @p1;
INSERT INTO "Customers" ("Email", "Name")
VALUES (@p2, @p3)
RETURNING "Id";
```

`RETURNING "Id"` возвращает сгенерированный базой ключ, и EF сразу проставляет его в объект. Если одна из команд упадёт, откатятся все, а сущности в трекере останутся в прежних состояниях — их можно исправить и сохранить повторно.

Чего неявная транзакция **не** покрывает:

| Операция | Атомарность |
| --- | --- |
| один `SaveChanges()` | да |
| два `SaveChanges()` подряд | каждый сам по себе, вместе — нет |
| `ExecuteUpdateAsync` / `ExecuteDeleteAsync` | одна команда, не связанная с остальными |
| `ExecuteSql` / `FromSql` | нет, если не открыта явная транзакция |
| HTTP-вызов, отправка в брокер | никогда — это не база |

Последняя строка — повод для outbox: запись в таблицу исходящих сообщений в том же `SaveChanges`, что и бизнес-изменение, а отправку делает отдельный процесс (подробнее — в разделе про микросервисы).

## Явная транзакция

Когда атомарными должны быть несколько операций, транзакцию открывают сами:

```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);

var account = await db.Accounts.SingleAsync(a => a.Id == fromId, ct);
account.Balance -= amount;
await db.SaveChangesAsync(ct);

await db.Transfers
    .Where(t => t.Id == transferId)
    .ExecuteUpdateAsync(s => s.SetProperty(t => t.Status, TransferStatus.Done), ct);

await tx.CommitAsync(ct);
```

Все операции контекста до `CommitAsync` идут в этой транзакции — `SaveChanges`, `ExecuteUpdate`, raw SQL, даже обычные запросы. Если до коммита вылетит исключение, `await using` вызовет `DisposeAsync`, и транзакция откатится. Поэтому `BeginTransaction` без `using` — ошибка: при исключении соединение останется с незавершённой транзакцией.

Пока транзакция открыта, контекст **держит соединение** и не возвращает его в пул. Вне транзакции EF открывает соединение только на время команды.

## Savepoint внутри SaveChanges

Лог той же транзакции показывает деталь, о которой мало кто знает:

```
Beginning transaction
Creating transaction savepoint
UPDATE "Customers" SET "Name" = @p0 WHERE "Id" = @p1
Releasing transaction savepoint
UPDATE "Orders" AS "o" SET "Status" = @p WHERE "o"."CustomerId" = 7
Committing transaction
```

Если `SaveChanges` вызывается внутри уже открытой транзакции, EF ставит перед ним savepoint. Если сохранение упадёт, EF откатится к savepoint, и транзакция останется живой: можно исправить данные и попробовать снова, не теряя предыдущих операций. В PostgreSQL это особенно важно — после любой ошибки транзакция переходит в состояние «aborted» и не принимает команды, пока её не откатят целиком или до savepoint.

Savepoint можно ставить и вручную:

```csharp
await tx.CreateSavepointAsync("BeforeBonus", ct);
try
{
    db.Bonuses.Add(bonus);
    await db.SaveChangesAsync(ct);
}
catch (DbUpdateException)
{
    await tx.RollbackToSavepointAsync("BeforeBonus", ct);
}
```

## Уровень изоляции

Уровень задаётся при открытии:

```csharp
await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
```

Без явного уровня используется умолчание базы — в PostgreSQL это **Read Committed**. Каждый оператор видит данные, зафиксированные на момент его начала, и этого достаточно, чтобы классический сценарий EF дал lost update:

```text
запрос A: SELECT balance → 100          запрос B: SELECT balance → 100
запрос A: balance = 100 - 30            запрос B: balance = 100 - 50
запрос A: UPDATE … SET balance = 70     запрос B: UPDATE … SET balance = 50
итог: 50, списание A потеряно
```

Транзакция здесь ничего не спасает: оба `UPDATE` записывают значение, вычисленное в C#, из устаревшего чтения. Защита — одно из четырёх:

1. **Атомарная операция в SQL** — `ExecuteUpdate` с выражением от текущего значения:

```csharp
await db.Accounts
    .Where(a => a.Id == id && a.Balance >= amount)
    .ExecuteUpdateAsync(s => s.SetProperty(a => a.Balance, a => a.Balance - amount), ct);
```

```sql
UPDATE "Accounts" AS a
SET "Balance" = a."Balance" - @amount
WHERE a."Id" = @id AND a."Balance" >= @amount
```

Проверка остатка и списание — одна команда; число затронутых строк скажет, хватило ли денег. Для счётчиков, остатков и балансов это самый простой и надёжный вариант.

2. **Optimistic concurrency** — токен версии в `WHERE`, конфликт как исключение (см. `Оптимистичная блокировка`).

3. **Пессимистичная блокировка** — `SELECT … FOR UPDATE` внутри явной транзакции. Встроенного LINQ-оператора для неё нет, поэтому через `FromSql`:

```csharp
var account = await db.Accounts
    .FromSql($"SELECT * FROM \"Accounts\" WHERE \"Id\" = {id} FOR UPDATE")
    .SingleAsync(ct);
```

Второй запрос на ту же строку будет ждать коммита первого. Цена — ожидание и риск дедлоков при блокировке нескольких строк в разном порядке (см. `Блокировки и deadlock`).

4. **Repeatable Read или Serializable.** На этих уровнях PostgreSQL не даст второму `UPDATE` перезаписать изменённую строку и прервёт транзакцию с ошибкой `40001` — «could not serialize access». Это часть контракта: транзакцию нужно **повторить целиком**, с перечитыванием данных.

## Ретраи и ручные транзакции

С `EnableRetryOnFailure` EF повторяет операции при транзиентных ошибках — обрыв соединения, таймаут. Npgsql относит к транзиентным и ошибки параллелизма: проверка `PostgresException.IsTransient` даёт `true` для `40001` (serialization failure) и `40P01` (deadlock detected), но `false` для `23505` (нарушение уникальности). Так что стратегия повторит и транзакцию, проигравшую на `Serializable`.

Отдельную команду можно повторить безопасно, а команду в середине вашей транзакции — нет: предыдущие уже откатились вместе с ней. Поэтому при включённых ретраях ручная транзакция падает сразу:

```
InvalidOperationException: The configured execution strategy 'NpgsqlRetryingExecutionStrategy'
does not support user-initiated transactions. Use the execution strategy returned by
'DbContext.Database.CreateExecutionStrategy()' to execute all the operations in the
transaction as a retriable unit.
```

Решение — отдать стратегии весь блок:

```csharp
var strategy = db.Database.CreateExecutionStrategy();
await strategy.ExecuteAsync(async () =>
{
    await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
    var account = await db.Accounts.SingleAsync(a => a.Id == id, ct);
    account.Balance -= amount;
    await db.SaveChangesAsync(ct);
    await tx.CommitAsync(ct);
});
```

Код внутри лямбды должен быть безопасен для повтора: без внешних побочных эффектов, и с учётом того, что трекер после неудачной попытки содержит изменения прошлого прохода. Надёжнее всего создавать контекст внутри лямбды, через `IDbContextFactory<T>`.

## Общая транзакция с Dapper и TransactionScope

Если часть работы делает Dapper на том же соединении, транзакцию EF можно отдать ему:

```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);
db.Orders.Add(order);
await db.SaveChangesAsync(ct);

var conn = db.Database.GetDbConnection();
await conn.ExecuteAsync("UPDATE stock SET reserved = reserved + @qty WHERE product_id = @id",
    new { qty, id }, transaction: tx.GetDbTransaction());

await tx.CommitAsync(ct);
```

Обратное направление — `db.Database.UseTransaction(dbTransaction)`, если транзакцию открыл ADO.NET-код.

`TransactionScope` тоже работает, но с двумя оговорками: для async нужен `TransactionScopeAsyncFlowOption.Enabled`, иначе scope не переживёт `await`, а распределённые транзакции между разными базами в .NET на Linux не поддерживаются. В новом коде явный `BeginTransactionAsync` предсказуемее.

## Что ломает транзакции на практике

- **Долгая транзакция.** HTTP-вызов или ожидание пользователя внутри транзакции держит соединение и блокировки. В `pg_stat_activity` это видно как `idle in transaction`, а в приложении — как исчерпание пула соединений.
- **«Два `SaveChanges` в одном методе атомарны»** — нет, если не открыта явная транзакция.
- **`ExecuteUpdate` между `SaveChanges`** выполняется сразу и не откатится, если следующий `SaveChanges` упадёт, — без общей транзакции.
- **Split query без транзакции** читает данные несколькими запросами, и между ними их могут изменить (см. `Загрузка связей и N+1`).
- **Ожидание, что Serializable «просто работает».** Он работает только вместе с повтором при `40001`.

## Что стоит ответить на собеседовании

`SaveChanges` атомарен: если команд больше одной, EF открывает транзакцию и отправляет их пакетом, а одиночную команду выполняет без неё — это `AutoTransactionBehavior.WhenNeeded`. Несколько `SaveChanges`, `ExecuteUpdate` и raw SQL объединяют явной транзакцией через `BeginTransactionAsync` с `await using`; внутри неё EF ставит savepoint перед каждым `SaveChanges`, чтобы ошибка сохранения не убивала всю транзакцию. По умолчанию в PostgreSQL Read Committed, и он не защищает от lost update при схеме «прочитал в C# — посчитал — записал».

Сильный ответ перечислит способы защиты: атомарный `ExecuteUpdate` от текущего значения, токен версии, `SELECT … FOR UPDATE` через `FromSql`, Repeatable Read или Serializable с повтором при `40001`. И объяснит, почему с `EnableRetryOnFailure` ручная транзакция бросает исключение: повторять можно только весь блок целиком, поэтому его заворачивают в `CreateExecutionStrategy().ExecuteAsync`, а Npgsql считает serialization failure и deadlock транзиентными и сам повторит такой блок.
