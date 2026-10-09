---
title: Трансляция IQueryable в SQL
slug: translyaciya-iqueryable-v-sql
track: dotnet-backend
section: ef-core
level: middle
sortOrder: 3
summary: Что происходит между ToListAsync и SQL, что EF умеет переводить и во что, где параметр, а где литерал, как работает null-семантика, где разрешена клиентская часть и как увидеть итоговый запрос.
---

Статья `IEnumerable vs IQueryable` объясняет, почему `Where` над `IQueryable` уезжает в базу: цепочка хранит дерево выражений, а не делегаты. Здесь — следующий шаг: что EF Core делает с этим деревом, во что превращаются конкретные методы C#, когда значение становится параметром, а когда вклеивается в текст, и почему один и тот же LINQ может дать разный SQL. Весь SQL ниже сгенерирован Npgsql-провайдером EF Core 10 через `ToQueryString()`, в некоторых местах сокращён список колонок.

## Путь от LINQ до SQL

Операторы `Where`, `Select`, `OrderBy`, `Include` только достраивают дерево. Запрос выполняется, когда вызывают материализующий или скалярный оператор: `ToListAsync`, `FirstAsync`, `CountAsync`, `AnyAsync`, `foreach`, `ExecuteUpdateAsync`. В этот момент EF проходит несколько шагов:

1. **Извлечение параметров.** Захваченные переменные (`id`, `from`) вынимаются из дерева и становятся параметрами SQL. Дерево без значений — ключ кэша.
2. **Кэш запросов.** Если запрос такой формы уже выполнялся, берётся готовый скомпилированный исполнитель. Иначе дерево проходит весь конвейер: нормализация, раскрытие навигаций и `Include`, трансляция методов, генерация SQL, компиляция shaper'а, который собирает объекты из строк. Это самая дорогая часть, и платится она один раз на форму запроса.
3. **Выполнение и материализация.** Команда уходит в базу, shaper читает строки, при трекинге сущности регистрируются в трекере (см. `ChangeTracker`).

Из первого шага есть практическое следствие: значения переменных читаются **в момент выполнения**, а не при построении запроса.

```csharp
var min = 0;
var q = db.Orders.Where(o => o.Id > min);
min = 45;
q.Count();   // 5 из 50 — использовано значение 45
```

И второе: ошибка трансляции тоже возникает в момент выполнения, иногда в другом слое, далеко от строки с `Where`.

## Что во что переводится

Провайдер знает перевод для заметной части BCL. Несколько примеров из одного прогона:

| C# | SQL (Npgsql) |
| --- | --- |
| `c.Name.StartsWith("EF")` | `c."Name" LIKE 'EF%'` |
| `c.Name.StartsWith(name)` | `c."Name" LIKE @name_startswith` |
| `c.Email.ToLower() == name` | `lower(c."Email") = @name` |
| `EF.Functions.ILike(c.Email, pattern)` | `c."Email" ILIKE @pattern ESCAPE ''` |
| `ids.Contains(c.Id)` | `c."Id" = ANY (@ids)` |
| `c.Orders.Any(o => o.Total > min)` | `EXISTS (SELECT 1 FROM "Orders" … )` |
| `o.CreatedAt.Year == 2026` | `date_part('year', o."CreatedAt" AT TIME ZONE 'UTC')::int = 2026` |
| `c.Name + " <" + c.Email + ">"` | `c."Name" \|\| ' <' \|\| c."Email" \|\| '>'` |
| `o.Lines.Sum(l => l.Price * l.Quantity)` | `COALESCE(sum(…), 0.0)` в подзапросе |
| `GroupBy(o => o.CustomerId).Select(g => g.Count())` | `GROUP BY o."CustomerId"` с `count(*)::int` |

Две строки из этой таблицы стоит запомнить из-за последствий для индексов. `ToLower()` превращается в `lower(колонка)`, и обычный B-tree индекс по `"Email"` для такого условия не подойдёт — нужен индекс по выражению `lower("Email")` или тип `citext`. Условие на `Year` тоже оборачивает колонку функцией и тоже ломает индекс; диапазон `o.CreatedAt >= start && o.CreatedAt < end` даёт тот же результат и индекс использует (см. `Индексы: B-tree, GIN, BRIN`). EF переводит код честно, но не думает о плане за вас.

`StartsWith` с переменной EF 10 переводит в `LIKE` с параметром, к которому сам дописал `%` и экранировал спецсимволы, — пользовательский `%` в строке поиска не превратится в шаблон.

## Параметр или литерал

От того, попадёт ли значение в текст запроса или придёт параметром, зависит переиспользование планов в PostgreSQL и кэша запросов в самом EF. Правило:

- **константа в коде** (`"EF"`, `2026`, `OrderStatus.Paid`) вклеивается литералом: `o."Status" = 1`;
- **захваченная переменная** становится параметром: `o."Total" > @min`;
- аргументы `Skip`/`Take` в EF 10 тоже параметры: `LIMIT @p1 OFFSET @p`.

```sql
-- @min='100'
SELECT o."Id", o."Comment", o."CreatedAt", o."CustomerId", o."Status", o."Total"
FROM "Orders" AS o
WHERE o."Status" = 1 AND o."Total" > @min
```

Параметры — правильное умолчание: один текст запроса на все значения, один план, одна запись в кэше. Литерал иногда нужен намеренно — например, когда значение сильно влияет на план (редкий статус против массового). Для этого есть `EF.Constant(value)`: `o.Status == EF.Constant(st)` даёт `o."Status" = 1`, а `EF.Constant(ids).Contains(o.Id)` — `o."Id" IN (1, 2)`. Обратное — `EF.Parameter(value)` — заставляет параметризовать то, что EF вклеил бы литералом. Злоупотреблять `EF.Constant` нельзя: каждое новое значение — новый текст SQL, новая запись в кэше EF и новый план в базе.

## Null-семантика

В C# `null == null` — это `true`, в SQL `NULL = NULL` — это `NULL`, то есть «ложь» для `WHERE`. EF эмулирует семантику C# и подстраивает SQL под фактическое значение параметра:

```sql
-- o.Comment == name, где name = null
WHERE o."Comment" IS NULL

-- o.Comment != name, где name = "x"
WHERE o."Comment" <> @name OR o."Comment" IS NULL

-- o.Comment != o.Customer.Name
WHERE o."Comment" <> c."Name" OR o."Comment" IS NULL
```

Для `null` в переменной получился другой текст запроса — EF кэширует варианты отдельно по тому, какие параметры равны `null`. Добавка `OR … IS NULL` в неравенстве нужна, чтобы строки с `NULL` в колонке не потерялись: в C# `null != "x"` истинно. Если колонка объявлена как `NOT NULL` в модели, EF эти проверки не добавляет — ещё одна причина держать nullability модели в соответствии со схемой (см. `Nullable reference types`).

## Где разрешена клиентская часть

Начиная с EF Core 3.0 непереводимое выражение в `Where`, `OrderBy` или середине запроса не выполняется на клиенте молча, а бросает исключение:

```
InvalidOperationException: The LINQ expression 'DbSet<Customer>()
    .Where(c => SqlDemo.MyCheck(c.Name))' could not be translated.
Additional information: Translation of method 'SqlDemo.MyCheck' failed. …
Either rewrite the query in a form that can be translated, or switch to client
evaluation explicitly by inserting a call to 'AsEnumerable', 'AsAsyncEnumerable',
'ToList', or 'ToListAsync'.
```

Единственное место, где свой метод разрешён, — **финальная проекция**. EF выберет из базы колонки, которые нужны методу, а сам метод вызовет при материализации:

```csharp
db.Orders.Select(o => new { o.Id, T = Format(o.Total) });
```

```sql
SELECT o."Id", o."Total"
FROM "Orders" AS o
```

Это безопасно, потому что не меняет объём выборки: строк столько же, сколько вернул бы SQL. Опасно другое — конструктор DTO или метод маппинга, внутри которого EF не видит, какие поля используются: тогда он может потянуть сущность целиком.

Если метод в фильтре действительно нужен, его либо выражают через транслируемые конструкции, либо маппят на функцию базы (`HasDbFunction`), либо явно разделяют запрос на серверную и клиентскую части через `AsEnumerable()` — после того как фильтры и `Take` уже сузили выборку.

## Что ещё меняет форму SQL

Несколько преобразований, которые удивляют при первом чтении лога:

- **`Take` перед `JOIN`.** В проекции с `Take(50)` EF сначала выбрал 50 заказов во вложенном `SELECT … LIMIT @p`, а уже потом присоединил клиентов и посчитал подзапросы — чтобы `JOIN` не размножил строки до лимита.
- **`FromSql` оборачивается в подзапрос**, и поверх него работает обычный LINQ:

```csharp
db.Products
    .FromSql($"SELECT * FROM \"Products\" WHERE \"Price\" > {min}")
    .Where(p => p.Stock > 0)
    .OrderBy(p => p.Name);
```

```sql
-- p0='100'
SELECT p."Id", p."Description", p."Name", p."Price", p."Stock", p."Version"
FROM (
    SELECT * FROM "Products" WHERE "Price" > @p0
) AS p
WHERE p."Stock" > 0
ORDER BY p."Name"
```

Интерполяция в `FromSql` — не склейка строк: метод принимает `FormattableString` и превращает `{min}` в параметр `@p0`. А вот `FromSqlRaw($"… {min}")` получит уже готовую строку — это SQL-инъекция. Подробнее про raw SQL — в статье `Когда ORM мешает`.

## Как увидеть итоговый SQL

**`ToQueryString()`** — без выполнения, удобно в отладке и тестах. Работает для запросов, которые заканчиваются на `IQueryable`; для `First`, `Count` или `ExecuteUpdate` нужен лог. Для split query показывает только первую команду и честно об этом предупреждает.

**`LogTo` или `ILogger`** с категорией `Microsoft.EntityFrameworkCore.Database.Command`:

```csharp
options.UseNpgsql(cs)
    .LogTo(Console.WriteLine, [DbLoggerCategory.Database.Command.Name], LogLevel.Information)
    .EnableSensitiveDataLogging();
```

В логе будет `Executed DbCommand (3ms) [Parameters=[…]]` и текст — сразу видно время каждой команды. `EnableSensitiveDataLogging` пишет значения параметров, включая персональные данные, — только для разработки.

**`TagWith`** добавляет комментарий в начало SQL, по которому запрос находится в `pg_stat_statements` и логах PostgreSQL:

```sql
-- Dashboard: orders

SELECT o."Id", …
FROM "Orders" AS o
WHERE o."Total" > @min
```

Увидеть SQL — половина дела. Вторая половина — `EXPLAIN (ANALYZE, BUFFERS)` на данных продакшен-объёма (см. `EXPLAIN и план запроса`): на десяти строках в dev любой запрос быстрый.

## Compiled queries

Перевод кэшируется, но на каждый вызов EF всё равно строит дерево выражений, вынимает параметры и сравнивает дерево с ключами кэша. `EF.CompileAsyncQuery` убирает эти шаги:

```csharp
static readonly Func<AppDbContext, int, Task<Order?>> OrderById =
    EF.CompileAsyncQuery((AppDbContext db, int id) =>
        db.Orders.AsNoTracking().FirstOrDefault(o => o.Id == id));
```

Выигрыш — микросекунды и аллокации на вызов, а не время в базе. Он заметен только на горячем пути с быстрым SQL фиксированной формы: поиск по ключу тысячи раз в секунду. Динамические фильтры так не скомпилировать, а отчёт на 200 мс в базе от экономии 20 мкс не ускорится.

## Что стоит ответить на собеседовании

При материализации EF извлекает параметры из дерева выражений, ищет перевод в кэше по форме запроса и только при промахе проходит конвейер трансляции и компилирует shaper. Константы из кода вклеиваются литералами, захваченные переменные становятся параметрами, причём их значения читаются в момент выполнения. Непереводимый метод в `Where` с EF Core 3.0 бросает исключение, а свой код разрешён только в финальном `Select`, где EF выбирает нужные колонки и вызывает метод при материализации.

Сильный ответ добавит, что трансляция честная, но не думает о плане: `ToLower()` и `.Year` оборачивают колонку функцией и ломают обычный индекс. Расскажет про null-семантику — `!=` с nullable-колонкой даёт `OR … IS NULL`, а `null` в параметре порождает отдельный вариант SQL — и про инструменты: `ToQueryString()`, лог команд, `TagWith` и проверка плана через `EXPLAIN ANALYZE`.
