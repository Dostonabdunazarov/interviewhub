---
title: Оптимистичная блокировка
slug: ef-optimistichnaya-blokirovka
track: dotnet-backend
section: ef-core
level: middle
sortOrder: 5
summary: Как concurrency token попадает в WHERE, почему в PostgreSQL для этого хватает xmin, что делать с DbUpdateConcurrencyException, как не сломать проверку в веб-API и когда атомарный UPDATE проще версии.
---

Оптимистичная блокировка исходит из того, что конфликты редки. Строку не блокируют при чтении, а при сохранении проверяют, что её никто не изменил с момента загрузки. В EF Core это делается одним механизмом — **concurrency token**: исходное значение специального свойства добавляется в `WHERE` у `UPDATE` и `DELETE`. Если команда не нашла строку, значит её поменяли или удалили, и EF бросает `DbUpdateConcurrencyException`. Вся сложность — не в настройке, а в том, что делать дальше, и в том, как не потерять исходное значение по дороге через API.

## От чего это защищает

Сценарий lost update, который транзакция в Read Committed не ловит (см. `Транзакции и уровни изоляции`):

```text
Алиса открывает карточку товара: Price = 100, Version = 5
Боб   открывает ту же карточку:  Price = 100, Version = 5
Боб   сохраняет Price = 120      → Version = 6
Алиса сохраняет Price = 90       → без проверки молча затрёт изменение Боба
```

Между чтением и записью здесь минуты — пользователь думает над формой. Держать всё это время блокировку строки нельзя, а транзакция на минуты — тем более. Остаётся проверить при записи, что версия всё ещё 5.

## Как это выглядит в SQL

Токен, который генерирует база, объявляется через `[Timestamp]` или `IsRowVersion()`. В PostgreSQL отдельная колонка для этого не нужна: у каждой строки есть системная колонка `xmin` — идентификатор транзакции, последней изменившей строку. Npgsql (с версии 7) мапит на неё свойство типа `uint` с атрибутом `[Timestamp]`:

```csharp
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }

    [Timestamp]
    public uint Version { get; set; }
}
```

Метаданные модели после этого: колонка `xmin`, тип `xid`, `IsConcurrencyToken = true`, `ValueGenerated = OnAddOrUpdate`. Миграция для такого свойства операцию формально содержит, но SQL не генерирует — колонка системная и уже есть.

SQL, который сгенерировал EF Core 10 с Npgsql для изменения цены:

```sql
UPDATE "Products" SET "Price" = @p0
WHERE "Id" = @p1 AND xmin = @p2
RETURNING xmin;
```

`@p2` — **исходное** значение токена, прочитанное при загрузке. `RETURNING xmin` возвращает новое значение, и EF кладёт его в сущность — следующее сохранение того же объекта будет проверять уже его. Для удаления:

```sql
DELETE FROM "Products"
WHERE "Id" = @p0 AND xmin = @p1;
```

При вставке токен не проверяется — проверять нечего, но `INSERT … RETURNING "Id", xmin` сразу заполнит его.

Для SQL Server то же самое даёт `[Timestamp] byte[] RowVersion` с типом `rowversion`.

## Токен, которым управляет приложение

Если база не умеет менять версию сама, или нужна переносимость, токен делают обычным свойством и меняют сами:

```csharp
modelBuilder.Entity<Article>()
    .Property(a => a.Version)
    .IsConcurrencyToken();

article.Body = newBody;
article.Version = Guid.NewGuid();
await db.SaveChangesAsync();
```

```sql
UPDATE "Articles" SET "Body" = @p0, "Version" = @p1
WHERE "Id" = @p2 AND "Version" = @p3;
```

Новое значение — в `SET`, старое — в `WHERE`. Забыть поменять `Version` — значит получить проверку, которая пропускает конкурентную запись, если та тоже забыла. `[ConcurrencyCheck]` можно поставить и на бизнес-поле, например `Email`: тогда конфликт будет только при изменении именно его. Это точечная защита вместо защиты всей строки.

## DbUpdateConcurrencyException

Проверено: после того как другой процесс изменил строку, `SaveChanges` падает с сообщением

```
The database operation was expected to affect 1 row(s), but actually affected 0 row(s);
data may have been modified or deleted since entities were loaded.
```

Это не транзиентная ошибка, `EnableRetryOnFailure` её не повторяет. В `ex.Entries` лежат конфликтующие записи, и у каждой три набора значений:

| Набор | Что это |
| --- | --- |
| `entry.CurrentValues` | что вы хотите сохранить |
| `entry.OriginalValues` | что было прочитано, по ним строился `WHERE` |
| `await entry.GetDatabaseValuesAsync()` | что в базе сейчас; `null`, если строку удалили |

В замере: текущая цена 90, исходная 2, в базе 999 — третий набор EF получает отдельным `SELECT`. Если строку удалили, `GetDatabaseValuesAsync()` действительно возвращает `null`, и это отдельный случай: 404, а не перезапись.

## Стратегии разрешения

**Сообщить о конфликте** — самый частый и обычно правильный вариант в API:

```csharp
try
{
    await db.SaveChangesAsync(ct);
}
catch (DbUpdateConcurrencyException)
{
    return Results.Conflict("Запись изменена другим пользователем, обновите страницу");
}
```

**Store wins** — отказаться от своих изменений и принять данные базы:

```csharp
foreach (var entry in ex.Entries)
    await entry.ReloadAsync(ct);
```

**Client wins** — перезаписать, приняв текущую версию базы за исходную:

```csharp
foreach (var entry in ex.Entries)
{
    var dbValues = await entry.GetDatabaseValuesAsync(ct);
    if (dbValues is null) throw;
    entry.OriginalValues.SetValues(dbValues);
}
await db.SaveChangesAsync(ct);
```

В замере повторный `SaveChanges` после такого обновления прошёл: новый токен попал в `WHERE`. Но это тот же lost update, только осознанный, — чужое изменение затёрто. И повтор может снова упасть, если строку поменяли ещё раз между чтением и записью, поэтому его делают в цикле с лимитом в две-три попытки.

**Merge по свойствам** — перенести только то, что пользователь реально менял:

```csharp
var dbValues = await entry.GetDatabaseValuesAsync(ct);
foreach (var p in entry.Properties.Where(p => !p.IsModified))
    p.CurrentValue = dbValues![p.Metadata];
entry.OriginalValues.SetValues(dbValues!);
```

Чужие изменения в нетронутых полях сохраняются, свои — побеждают в тех, что меняли. Для документов и форм это хороший компромисс. Для денег и остатков надёжнее повторить бизнес-операцию целиком: перечитать данные, заново применить команду, сохранить — с новым контекстом на каждую попытку.

## Главная ловушка: токен в веб-API

Типичный код обновления выглядит так и почти ничего не защищает:

```csharp
var product = await db.Products.FindAsync(dto.Id);
product.Price = dto.Price;
await db.SaveChangesAsync();
```

Исходное значение токена прочитано **в этом же запросе**, за миллисекунды до записи. Окно конфликта — между `FindAsync` и `SaveChanges`, а не между моментом, когда пользователь открыл форму, и моментом, когда нажал «сохранить». Сценарий с Алисой и Бобом проходит без ошибки.

Чтобы проверка работала, токен отдают клиенту вместе с данными (поле в DTO или `ETag`), получают обратно и выставляют как исходное значение:

```csharp
var product = await db.Products.FindAsync(dto.Id);
db.Entry(product).Property(p => p.Version).OriginalValue = dto.Version;
product.Price = dto.Price;
await db.SaveChangesAsync();
```

Теперь в `WHERE xmin = @p2` уйдёт версия, которую видел пользователь. В REST это естественно ложится на `If-Match` с `ETag` и ответ `412 Precondition Failed` или `409 Conflict`.

## Где токен не работает

**`ExecuteUpdate` и `ExecuteDelete`** обходят трекер и токены не проверяют. Если версия важна, условие на неё пишут в `Where` руками и смотрят на число затронутых строк:

```csharp
var n = await db.Products
    .Where(p => p.Id == id && p.Version == expectedVersion)
    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, newPrice), ct);
if (n == 0) return Results.Conflict();
```

**Атомарный инкремент часто проще версии.** Для счётчиков и остатков не нужно читать, проверять и ловить конфликт — достаточно одной команды:

```sql
UPDATE "Products" AS p
SET "Stock" = p."Stock" - 1
WHERE p."Id" = 4 AND p."Stock" > 0
```

Это реальный SQL `ExecuteUpdate` с `SetProperty(p => p.Stock, p => p.Stock - 1)`. Конфликта нет by design: база вычисляет новое значение от текущего, а не от прочитанного в C#.

## Optimistic против pessimistic

| | Optimistic (токен) | Pessimistic (`SELECT … FOR UPDATE`) |
| --- | --- | --- |
| Блокировки | нет | строка заблокирована до конца транзакции |
| Где уместно | редкие конфликты, долгое «думание» пользователя | частые конфликты за одну строку |
| Цена конфликта | исключение и повтор или 409 | ожидание, риск дедлока |
| Поддержка в EF | встроена | через `FromSql` в явной транзакции |

Правило выбора простое: если между чтением и записью есть человек или сеть — оптимистичная; если это короткая серверная операция над горячей строкой — атомарный `UPDATE` или пессимистичная блокировка (см. `Блокировки и deadlock`).

## Что стоит ответить на собеседовании

Concurrency token — свойство, исходное значение которого EF добавляет в `WHERE` у `UPDATE` и `DELETE`; если затронуто 0 строк, бросается `DbUpdateConcurrencyException`. В PostgreSQL для этого не нужна отдельная колонка: `[Timestamp] uint` мапится на системную `xmin`, и EF 10 генерирует `UPDATE … WHERE "Id" = @p1 AND xmin = @p2 RETURNING xmin`. Токен, управляемый приложением, объявляют через `IsConcurrencyToken()` и обязаны менять при каждом сохранении.

Сильный ответ разберёт стратегии — 409 клиенту, store wins через `ReloadAsync`, client wins через `OriginalValues.SetValues`, merge по неизменённым свойствам — и скажет, что client wins — это осознанный lost update. Главное — ловушка веб-API: токен нужно вернуть с клиента и выставить как `OriginalValue`, иначе проверка покрывает миллисекунды внутри запроса. И что `ExecuteUpdate` токены не проверяет, а для счётчиков атомарный `SET x = x - 1 WHERE x > 0` проще любой версии.
