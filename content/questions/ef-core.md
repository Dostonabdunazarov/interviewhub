# EF Core / Dapper / ORM

Вопросы категории `ef-core` в формате импорта (`tools/questions.md`): 40 шт.

```bash
node tools/import-questions.mjs --file content/questions/ef-core.md --dry-run
node tools/import-questions.mjs --file content/questions/ef-core.md --url … --email … --update
```

---

## Что такое Entity Framework Core?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-entity-framework-core
```

Entity Framework Core — это ORM от Microsoft для .NET. Он отображает C#-классы на таблицы,
переводит LINQ-запросы в SQL, отслеживает изменения загруженных объектов и сохраняет их
одним вызовом `SaveChanges()`. Это кроссплатформенный open-source фреймворк: не порт EF6, а
переписанная с нуля библиотека. С конкретной СУБД он работает через провайдер: Npgsql для
PostgreSQL, SqlServer, Sqlite, Cosmos и другие.

```csharp
public class Blog
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public List<Post> Posts { get; set; } = [];
}

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Blog> Blogs => Set<Blog>();
}

var blogs = await db.Blogs
    .Where(b => b.Title.StartsWith("EF"))
    .ToListAsync();
```

```sql
SELECT b."Id", b."Title"
FROM "Blogs" AS b
WHERE b."Title" LIKE 'EF%'
```

**Из чего состоит:**

| Компонент | Роль |
| --- | --- |
| Модель | метаданные о сущностях, ключах, связях; строится из конвенций, атрибутов и Fluent API (`OnModelCreating`) |
| `DbContext` | сессия работы с БД и Unit of Work |
| `DbSet<T>` | точка входа для запросов и добавления/удаления сущностей |
| LINQ-провайдер | транслирует expression tree в SQL |
| Change tracker | запоминает состояние сущностей и вычисляет, что сохранить |
| Migrations | эволюция схемы БД вместе с моделью |

**Что есть в современных версиях (7–10):** `ExecuteUpdate`/`ExecuteDelete` для массовых
операций без загрузки сущностей, JSON-колонки (`ToJson()`), complex types, коллекции
примитивов, compiled models для быстрого старта, пулинг `DbContext`.

**Чего EF Core не отменяет.** SQL всё равно нужно понимать. Он генерирует SQL за вас, но
N+1, cartesian explosion, отсутствие индексов и лишний tracking — это проблемы
разработчика, а не ORM. На собеседовании после этого вопроса обычно спрашивают про
tracking, `IQueryable` против `IEnumerable`, N+1 и сравнение с Dapper.

## Как работает DbContext?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-rabotaet-dbcontext
tags: orm
```

`DbContext` — это короткоживущая сессия работы с базой. Он держит модель, change tracker,
соединение и текущую транзакцию. Через него строятся запросы, в нём копятся изменения, а
`SaveChanges()` применяет их одной транзакцией. По сути это готовые Unit of Work и Identity
Map.

**Что внутри:**

- **Model** строится один раз на тип контекста (конвенции + `OnModelCreating`) и
  кэшируется. Поэтому первый запрос медленный, а следующие быстрые.
- **ChangeTracker** хранит загруженные сущности и их состояния (`Added`, `Modified`...).
- **Database** даёт доступ к соединению, транзакциям, raw SQL и миграциям.
- Внутренний **service provider** содержит компоненты провайдера, кэш запросов и
  логирование.

**Жизненный цикл** — один контекст на единицу работы:

```csharp
builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Db")));
// регистрация Scoped: один экземпляр на HTTP-запрос

public class OrderService(AppDbContext db)
{
    public async Task PayAsync(int id)
    {
        var order = await db.Orders.FindAsync(id);   // SELECT + tracking
        order!.Status = OrderStatus.Paid;            // изменение в памяти
        await db.SaveChangesAsync();                 // DetectChanges → UPDATE в транзакции
    }
}
```

Соединение открывается лениво, только на время команды, и потом возвращается в пул. Если
открыта транзакция, соединение остаётся открытым до её конца.

**Главные правила:**

- **Не thread-safe.** Две параллельные операции на одном контексте (например,
  `Task.WhenAll` двух запросов) дадут `InvalidOperationException: A second operation was
  started on this context instance...`. Для параллелизма нужен отдельный контекст на каждую
  задачу, их удобно брать из `IDbContextFactory<T>` (`AddDbContextFactory`).
- **Не держать долго.** Singleton-контекст или контекст на всю жизнь фонового воркера
  накапливает сущности в трекере: память растёт, `DetectChanges` замедляется, данные
  устаревают.
- **Singleton не должен получать scoped-контекст.** В `BackgroundService` создавайте scope
  (`IServiceScopeFactory`) или используйте фабрику.
- **Пулинг.** `AddDbContextPool` переиспользует экземпляры контекста и сбрасывает их
  состояние. Это снижает аллокации в высоконагруженных API, но контекст тогда не может
  хранить собственное scoped-состояние (например, tenant id в поле) без дополнительной
  работы.

Следом обычно спрашивают, почему контекст scoped, а не singleton, и что произойдёт при
параллельных запросах на одном контексте.

## Как работает change tracking?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-rabotaet-change-tracking
tags: orm
```

Change tracking — это механизм, которым `DbContext` запоминает загруженные и добавленные
сущности, а при `SaveChanges()` вычисляет, какие `INSERT`/`UPDATE`/`DELETE` нужно
выполнить. По умолчанию используется snapshot tracking: при загрузке EF сохраняет копию
исходных значений свойств, а позже сравнивает с ней текущие.

**Состояния сущности (`EntityState`):**

| Состояние | Что будет при `SaveChanges` |
| --- | --- |
| `Detached` | контекст о сущности не знает |
| `Unchanged` | ничего |
| `Added` | `INSERT` |
| `Modified` | `UPDATE` только изменённых колонок |
| `Deleted` | `DELETE` |

```csharp
var user = await db.Users.FirstAsync(u => u.Id == 1); // Unchanged, snapshot сохранён
user.Email = "new@mail.com";                          // пока EF об этом не знает

db.ChangeTracker.DetectChanges();                     // сравнение со snapshot
db.Entry(user).State;                                 // Modified
db.Entry(user).Property(u => u.Email).IsModified;     // true

await db.SaveChangesAsync();
```

```sql
UPDATE "Users" SET "Email" = @p0 WHERE "Id" = @p1;
```

**Когда вызывается `DetectChanges`.** Явно вызывать его почти никогда не нужно: его
автоматически вызывают `SaveChanges`, `Entry()`, `ChangeTracker.Entries()`,
`HasChanges()` и некоторые другие API. Цена — полный проход по всем отслеживаемым
сущностям. При десятках тысяч сущностей в контексте это заметно, поэтому массовые
вставки делают пачками на свежих контекстах или через `AutoDetectChangesEnabled = false`.

**Identity resolution.** Трекер — это ещё и identity map: одна строка БД соответствует
одному экземпляру в контексте. Если повторный запрос вернёт тот же ключ, вы получите уже
отслеживаемый объект. Его значения из БД не перезапишутся, изменения в памяти побеждают.

**Работа с отсоединёнными сущностями** (DTO пришёл из API):

- `Attach(entity)` — `Unchanged`, дальше можно пометить отдельные свойства как изменённые;
- `Update(entity)` — весь граф `Modified`, `UPDATE` пойдёт по всем колонкам;
- `Entry(e).CurrentValues.SetValues(dto)` — скопировать значения в загруженную сущность, и
  обновятся только реально изменившиеся поля.

**Типичные ошибки:**

- `The instance of entity type 'X' cannot be tracked because another instance with the
  same key value is already being tracked` — вызвали `Attach`/`Update` для объекта, чей ключ
  уже есть в трекере;
- долгоживущий контекст, который копит тысячи сущностей;
- ожидание, что изменения в сущности из `AsNoTracking()`-запроса сохранятся.

Для отладки удобен `db.ChangeTracker.DebugView.LongView`: он показывает все сущности,
состояния и изменённые свойства.

## Что такое tracking и no-tracking query?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-tracking-i-no-tracking-query
```

Tracking query возвращает сущности, которые регистрируются в change tracker контекста:
их изменения можно сохранить через `SaveChanges()`. No-tracking query (`AsNoTracking()`)
возвращает обычные объекты, о которых контекст не знает. Такой запрос быстрее и дешевле по
памяти, но менять через него данные нельзя.

```csharp
// tracking (по умолчанию для запросов, возвращающих сущности)
var order = await db.Orders.FirstAsync(o => o.Id == id);
order.Status = OrderStatus.Shipped;
await db.SaveChangesAsync();          // UPDATE выполнится

// no-tracking
var orders = await db.Orders.AsNoTracking()
    .Where(o => o.CustomerId == customerId)
    .ToListAsync();
orders[0].Status = OrderStatus.Shipped;
await db.SaveChangesAsync();          // ничего не произойдёт
```

SQL в обоих случаях одинаковый. Разница только в том, что EF делает с результатом после
материализации.

| | Tracking | No-tracking |
| --- | --- | --- |
| Snapshot исходных значений | да | нет |
| Identity resolution | да, одна строка — один объект | нет, дубликаты — разные объекты |
| Повторный запрос того же ключа | вернёт уже отслеживаемый экземпляр | создаст новый |
| `SaveChanges` увидит изменения | да | нет |
| Цена | выше (CPU + память) | ниже |

**Промежуточный вариант** — `AsNoTrackingWithIdentityResolution()`. Трекинга нет, но в
пределах одного запроса одинаковые сущности схлопываются в один экземпляр. Полезно при
`Include`, где один и тот же `Author` встречается у сотни постов.

**Когда tracking не включается вообще.** Проекции в DTO или анонимные типы
(`Select(o => new { o.Id, o.Total })`) не отслеживаются, трекать там нечего. Но если
проекция содержит саму сущность (`new { Order = o, ... }`), эта сущность будет
отслеживаться.

**Настройка по умолчанию.** Для read-heavy контекста можно выставить
`UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)` и включать трекинг точечно
через `AsTracking()`.

## Когда использовать `AsNoTracking()`?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kogda-ispolzovat-asnotracking
```

`AsNoTracking()` стоит использовать всегда, когда данные только читаются и не будут
изменяться через этот же контекст. Это списки, карточки, отчёты, экспорт, ответы
read-only API. Для сценария «загрузил → изменил → `SaveChanges`» нужен tracking.

**Почему это быстрее.** Для tracking-запроса EF после материализации каждой строки:

1. ищет сущность по ключу в identity map;
2. создаёт `InternalEntityEntry` и snapshot исходных значений;
3. держит всё это в памяти до конца жизни контекста;
4. при каждом следующем `DetectChanges` снова проходит по этим сущностям.

С `AsNoTracking()` ничего из этого не происходит. На больших выборках разница по времени
и аллокациям бывает кратной. SQL при этом не меняется.

```csharp
// read-only endpoint
app.MapGet("/products", async (AppDbContext db) =>
    await db.Products
        .AsNoTracking()
        .Where(p => p.IsActive)
        .OrderBy(p => p.Name)
        .Take(50)
        .ToListAsync());
```

**Когда `AsNoTracking()` не нужен или вреден:**

- **Проекция в DTO.** `Select(p => new ProductDto(...))` и так не трекается, добавлять
  `AsNoTracking()` бессмысленно, хотя и не вредно.
- **Сущность будет изменена.** Если потом сделать `db.Update(entity)`, EF пометит все
  колонки как изменённые, и вы получите лишний полный `UPDATE` вместо точечного.
- **Нужна дедупликация графа.** Без identity resolution один `Customer`, встретившийся в
  1000 заказах, материализуется 1000 раз. Здесь поможет
  `AsNoTrackingWithIdentityResolution()`.
- **Контекст уже держит эти сущности.** No-tracking запрос не вернёт отслеживаемый
  экземпляр с несохранёнными изменениями, придут данные из БД.

**Глобальная настройка.** Для read-model контекста или CQRS-стороны чтения удобно включить
`optionsBuilder.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)` и явно писать
`AsTracking()` там, где нужны изменения.

**Частый вопрос на собеседовании:** «Ускорит ли `AsNoTracking()` медленный запрос?». Если
время уходит в саму БД (нет индекса, full scan), то нет: он экономит только CPU и память
приложения на материализации. Проверять нужно план запроса.

## Что такое `DbSet<T>`?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-dbset-t
```

`DbSet<T>` — это представление набора сущностей типа `T` внутри `DbContext`, обычно одной
таблицы. Это одновременно корень LINQ-запросов (`IQueryable<T>`) и API для регистрации
изменений: добавить, удалить, присоединить сущность.

```csharp
public class AppDbContext(DbContextOptions<AppDbContext> o) : DbContext(o)
{
    public DbSet<Product> Products => Set<Product>();
    // или авто-свойство: public DbSet<Product> Products { get; set; }
}
```

Авто-свойства `DbSet` контекст заполняет сам в конструкторе. Кроме того, наличие свойства
включает тип в модель. Без свойства тип можно получить через `db.Set<T>()`, если он
описан в `OnModelCreating` или достижим по навигациям.

**Основные операции:**

| Метод | Что делает |
| --- | --- |
| `Where`, `Select`, `ToListAsync`... | строят и выполняют запрос (`DbSet<T>` реализует `IQueryable<T>`) |
| `FindAsync(key)` | сначала ищет в change tracker, только потом идёт в БД |
| `Add` / `AddRange` | состояние `Added` (для графа — всех новых связанных сущностей) |
| `Remove` | состояние `Deleted` |
| `Attach` | начать отслеживать как `Unchanged` |
| `Update` | начать отслеживать как `Modified` |
| `Local` | уже отслеживаемые сущности, без запроса к БД |

Важно: `Add`/`Remove` сами ничего не пишут в базу, они только меняют состояние в трекере.
SQL выполнится при `SaveChanges()`.

**`Find` против `FirstOrDefault`.** `FindAsync(id)` работает только по первичному ключу и
может вообще не делать запрос, если сущность уже в контексте. `FirstOrDefaultAsync(x =>
x.Id == id)` всегда идёт в БД, но умеет `Include`, `AsNoTracking` и произвольные условия.

**Нюансы:**

- `DbSet<T>` не коллекция в памяти: `db.Products.Count()` — это `SELECT COUNT(*)`, а не
  подсчёт загруженного;
- для keyless-типов (view, результат SQL) `DbSet` есть, но только для чтения;
- `ExecuteUpdateAsync`/`ExecuteDeleteAsync` вызываются на `IQueryable` от `DbSet` и
  обходят change tracker, выполняя SQL сразу.

## Что такое `Include()`?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-include
tags: orm
```

`Include()` говорит EF Core загрузить навигационное свойство тем же запросом, что и
основную сущность. Это способ eager loading. Без него навигации остаются `null` или
пустыми коллекциями, если не включён lazy loading.

```csharp
var orders = await db.Orders
    .Include(o => o.Customer)                 // reference-навигация
    .Include(o => o.Lines)                    // коллекция
        .ThenInclude(l => l.Product)          // следующий уровень
    .Where(o => o.CreatedAt >= from)
    .ToListAsync();
```

```sql
SELECT o.*, c.*, s.*
FROM "Orders" AS o
JOIN "Customers" AS c ON o."CustomerId" = c."Id"
LEFT JOIN (
    SELECT l.*, p.* FROM "OrderLines" AS l
    JOIN "Products" AS p ON l."ProductId" = p."Id"
) AS s ON o."Id" = s."OrderId"
WHERE o."CreatedAt" >= @from
ORDER BY o."Id", c."Id", s."Id"
```

**Возможности API:**

- **`ThenInclude`** — переход на следующий уровень графа. Для двух веток от одной
  коллекции `Include(...).ThenInclude(...)` повторяется для каждой.
- **Filtered include** (EF 5+): внутри можно использовать `Where`, `OrderBy`, `Skip`,
  `Take`:

  ```csharp
  db.Blogs.Include(b => b.Posts
      .Where(p => p.IsPublished)
      .OrderByDescending(p => p.CreatedAt)
      .Take(5));
  ```

- **Строковая форма** `Include("Lines.Product")` — для динамических сценариев.
- **`AsSplitQuery()`** — загрузить каждую коллекцию отдельным `SELECT` вместо одного
  большого `JOIN`.
- **`AutoInclude()`** в модели — навигация подгружается всегда; отключается через
  `IgnoreAutoIncludes()`.

**Подводные камни:**

- **Cartesian explosion.** Две коллекции в одном запросе дают строки `Lines × Payments`
  для каждого заказа. Нужен `AsSplitQuery()` или projection.
- **`Include` игнорируется при проекции.** Если после него идёт
  `Select(o => new OrderDto(...))`, EF сам решает, что грузить, по выражению в `Select`.
- **Лишние данные.** `Include` тянет все колонки связанной таблицы. Для read-only
  сценариев projection почти всегда дешевле.
- **Filtered include с tracking.** Если часть коллекции уже в трекере, навигация может
  содержать больше элементов, чем прошло через фильтр.

## Что такое eager loading?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-eager-loading
tags: orm
```

Eager loading — это стратегия, при которой связанные данные загружаются заранее, вместе с
основным запросом, а не при первом обращении к навигации. В EF Core она выражается
через `Include`/`ThenInclude`. Итог — предсказуемое количество запросов к БД, известное
до выполнения.

**Как это выглядит в SQL.** Есть два режима, и это главное, что спрашивают:

```csharp
var blogs = await db.Blogs
    .Include(b => b.Posts)
    .Include(b => b.Tags)
    .ToListAsync();
```

| Режим | SQL | Плюсы | Минусы |
| --- | --- | --- | --- |
| Single query (по умолчанию) | один `SELECT` с `LEFT JOIN` по всем навигациям | один roundtrip, консистентный снимок | при нескольких коллекциях строк `Posts × Tags` на каждый блог; колонки блога дублируются в каждой строке |
| Split query (`AsSplitQuery()`) | отдельный `SELECT` на каждую коллекцию, связанный по ключу | нет декартова произведения | несколько roundtrip'ов; без транзакции данные между запросами могут поменяться; для `Skip/Take` нужен стабильный `OrderBy` |

```csharp
var blogs = await db.Blogs
    .Include(b => b.Posts)
    .Include(b => b.Tags)
    .AsSplitQuery()
    .ToListAsync();
// SELECT ... FROM "Blogs"
// SELECT ... FROM "Posts" JOIN "Blogs" ... ORDER BY b."Id"
// SELECT ... FROM "Tags"  JOIN "Blogs" ... ORDER BY b."Id"
```

Когда в single query больше одной коллекции, EF пишет warning
(`MultipleCollectionIncludeWarning`). Режим по умолчанию можно поменять глобально:
`UseNpgsql(cs, o => o.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery))`.

**Когда eager loading уместен:**

- заранее известно, что навигация понадобится для каждого элемента. Это основная защита
  от N+1;
- нужен граф сущностей для изменения и сохранения (tracking + `SaveChanges`).

**Когда лучше иначе:**

- read-only ответ API — projection через `Select` загрузит только нужные колонки;
- навигация нужна для малой части элементов — explicit loading по условию;
- очень глубокие графы — они часто сигнализируют о проблеме в дизайне запроса.

## Что такое lazy loading?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-lazy-loading
tags: orm
```

Lazy loading — это загрузка связанных данных автоматически, в момент первого обращения к
навигационному свойству. В EF Core она по умолчанию выключена и включается явно. Удобство
у неё обманчивое: это главный источник проблемы N+1.

**Как включить** (через прокси):

```csharp
// пакет Microsoft.EntityFrameworkCore.Proxies
services.AddDbContext<AppDbContext>(o => o
    .UseNpgsql(cs)
    .UseLazyLoadingProxies());

public class Blog
{
    public int Id { get; set; }
    public virtual ICollection<Post> Posts { get; set; } = []; // virtual обязателен
}
```

EF генерирует в runtime класс-наследник (`Castle.Proxies.BlogProxy`) и переопределяет
`virtual`-навигации. Геттер проверяет, загружена ли навигация, и если нет — выполняет
запрос. Поэтому сущности должны быть не `sealed`, а навигации — `virtual`. Есть и вариант
без прокси: сущность получает `ILazyLoader` через конструктор и вызывает его в геттере
сама.

**Где проблема:**

```csharp
var blogs = await db.Blogs.ToListAsync();      // 1 запрос
foreach (var blog in blogs)
    Console.WriteLine(blog.Posts.Count);       // +1 запрос на КАЖДЫЙ блог
```

Код выглядит безобидно, а к БД уходит N+1 запросов, причём синхронно: геттер свойства не
может быть `async`, и на сервере это блокирует потоки.

**Другие подводные камни:**

- **Сериализация.** `System.Text.Json` при сериализации сущности обходит навигации и
  лениво загружает весь граф; возможны циклы.
- **Обращение после Dispose контекста.** Лениво загрузить уже нечем, по умолчанию будет
  исключение.
- **Невидимость.** Запросы к БД спрятаны в обычные обращения к свойствам, и по коду не
  видно, где и сколько раз вы идёте в базу.

**Когда допустимо:** десктоп-приложения и прототипы, где контекст живёт долго, объём
данных мал и важнее скорость разработки. В веб-API и сервисах обычно предпочитают явный
eager loading или projection. Многие команды запрещают lazy loading правилом код-ревью.

## Что такое explicit loading?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-explicit-loading
```

Explicit loading — это явная догрузка навигации у уже отслеживаемой сущности отдельным
запросом, когда вы сами решаете, что она нужна. Делается через `db.Entry(entity)`:
`.Collection(...)` для коллекций и `.Reference(...)` для одиночных ссылок.

```csharp
var order = await db.Orders.FirstAsync(o => o.Id == id);

if (order.Status == OrderStatus.Disputed)
{
    await db.Entry(order).Collection(o => o.Lines).LoadAsync();
    await db.Entry(order).Reference(o => o.Customer).LoadAsync();
}
```

```sql
SELECT l.* FROM "OrderLines" AS l WHERE l."OrderId" = @id
```

После `LoadAsync()` EF заполняет навигацию (fix-up) и помечает её как загруженную
(`IsLoaded = true`). Повторный вызов снова сходит в БД, поэтому флаг можно проверить
заранее: `db.Entry(order).Collection(o => o.Lines).IsLoaded`.

**Запрос по навигации без её загрузки.** `.Query()` возвращает `IQueryable` для связанных
данных, к которому можно добавить фильтры и агрегаты:

```csharp
var lastComments = await db.Entry(post)
    .Collection(p => p.Comments)
    .Query()
    .OrderByDescending(c => c.CreatedAt)
    .Take(10)
    .ToListAsync();

var count = await db.Entry(post).Collection(p => p.Comments).Query().CountAsync();
```

**Когда полезно:**

- навигация нужна только при определённом условии, и `Include` грузил бы её впустую;
- сущность уже загружена (например, через `FindAsync`), и нужно дотянуть часть графа;
- нужен агрегат по связанным данным без их материализации.

**Ограничения и ловушки:**

- работает с отслеживаемыми сущностями; для detached-объекта его сначала нужно `Attach`;
- explicit loading в цикле по списку — это тот же N+1, только написанный руками. Если
  навигация нужна для всех элементов, используйте `Include` или projection;
- каждая загрузка — отдельный roundtrip, в отличие от eager loading.

## Чем eager, lazy и explicit loading отличаются?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-chem-eager-lazy-i-explicit-loading-otlichayutsya
tags: orm
```

Стратегии различаются тем, кто и когда решает загрузить связанные данные. При eager
loading это решаете вы заранее, в самом запросе (`Include`). При lazy loading EF сам делает
запрос при первом обращении к навигации. При explicit loading вы сами вызываете догрузку
позже, отдельной командой (`Entry(...).Collection(...).LoadAsync()`).

```csharp
// Eager: 1 запрос (или несколько при AsSplitQuery), всё известно заранее
var blogs = await db.Blogs.Include(b => b.Posts).ToListAsync();

// Lazy: запрос спрятан в геттер свойства
var blog = await db.Blogs.FirstAsync();
var n = blog.Posts.Count;                    // здесь неявный SELECT

// Explicit: догрузка по решению кода
var b2 = await db.Blogs.FirstAsync();
if (needPosts)
    await db.Entry(b2).Collection(x => x.Posts).LoadAsync();
```

| | Eager | Lazy | Explicit |
| --- | --- | --- | --- |
| Когда грузится | вместе с основным запросом | при первом доступе к навигации | при вызове `Load`/`LoadAsync` |
| Кто решает | запрос | runtime (прокси / `ILazyLoader`) | код после запроса |
| Число запросов | фиксировано | непредсказуемо, риск N+1 | по одному на вызов |
| Async | да | нет, геттер синхронный | да |
| Настройка | ничего | пакет Proxies, `virtual`-навигации | ничего |
| Нужен живой контекст | нет, данные уже загружены | да | да, сущность должна трекаться |
| Риск | cartesian explosion, лишние данные | N+1, скрытые запросы, сериализация графа | N+1, если вызывать в цикле |

**Как выбирать:**

- **Eager** — вариант по умолчанию, когда навигация точно нужна для всех загружаемых
  сущностей и они будут изменяться.
- **Explicit** — когда навигация нужна условно или только для одной уже загруженной
  сущности. Плюс `.Query()` для фильтров и агрегатов без загрузки всей коллекции.
- **Lazy** — только там, где удобство важнее контроля: desktop, прототипы. В веб-сервисах
  его обычно избегают.

**Четвёртый вариант, о котором стоит сказать самому** — projection через `Select`. Для
read-only сценариев он часто лучше всех трёх: EF строит один запрос и выбирает только те
колонки, которые реально нужны DTO.

На собеседовании ждут, что вы свяжете lazy loading с N+1 и расскажете про cartesian
explosion при eager loading нескольких коллекций и про `AsSplitQuery()` как решение.

## Что такое проблема N+1?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-problema-n-1
tags: orm
```

N+1 — это ситуация, когда код делает один запрос за списком из N записей, а потом ещё по
одному запросу на каждую запись, чтобы получить связанные данные. Итого N+1 roundtrip'ов
вместо одного-двух. На 10 строках этого не видно, на 1000 это секунды латентности и
лишняя нагрузка на БД.

```csharp
var orders = await db.Orders.Where(o => o.Date == today).ToListAsync(); // 1 запрос

foreach (var order in orders)
{
    // lazy loading: +1 запрос на каждый заказ
    Console.WriteLine(order.Customer.Name);
}
```

```sql
SELECT * FROM "Orders" WHERE "Date" = @today;
SELECT * FROM "Customers" WHERE "Id" = @p;   -- × N
SELECT * FROM "Customers" WHERE "Id" = @p;
...
```

**Почему это дорого.** Каждый запрос по отдельности быстрый, 1–2 мс, но накладные
расходы на сетевой roundtrip, парсинг, планирование и выдачу соединения из пула
умножаются на N. Суммарная задержка растёт линейно, а БД обслуживает в сотни раз больше
запросов, чем нужно.

**Откуда берётся в .NET-коде:**

- **lazy loading** — классический источник, запрос спрятан в геттере свойства;
- **explicit loading или отдельный запрос в цикле** — `foreach (...) await
  db.Lines.Where(l => l.OrderId == o.Id).ToListAsync()`;
- **репозиторий/сервис, вызываемый в цикле** — `GetCustomer(id)` для каждого элемента;
- **GraphQL-резолверы и маппинг** — AutoMapper, `Select` после `ToList()`, резолвер поля,
  который сам ходит в базу;
- **Dapper** тоже подвержен: ORM тут ни при чём, это паттерн доступа к данным.

**Решение в общем виде** — загрузить связанные данные набором, а не поштучно:
`Include`, projection через `Select` в один запрос, либо второй запрос с `WHERE Id =
ANY(@ids)` и склейка в памяти через словарь.

Обычно следующий вопрос — как такое обнаружить. Про логирование SQL, метрики количества
команд на запрос и трейсинг — в отдельном вопросе.

## Как обнаружить и исправить N+1?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-obnaruzhit-i-ispravit-n-1
tags: orm
```

Обнаруживают N+1 по количеству SQL-команд на одну операцию: логи EF, трейсинг,
профайлер, счётчик в тестах. Исправляют так, чтобы связанные данные приходили набором:
`Include`, projection через `Select`, пакетный запрос по списку ключей.

### Как обнаружить

- **Логи EF Core.** `LogTo` или категория `Microsoft.EntityFrameworkCore.Database.Command`
  на уровне `Information`. Повторяющийся `SELECT ... WHERE "Id" = @p` с разными
  параметрами — явный признак.
- **Трейсинг.** OpenTelemetry (`Npgsql.OpenTelemetry` или инструментирование EF Core) в
  Jaeger/Grafana/Aspire Dashboard показывает десятки одинаковых db-span'ов внутри одного
  HTTP-запроса. Это самый удобный способ в проде.
- **Профайлеры.** MiniProfiler, dotTrace/Rider, `pg_stat_statements` на стороне
  PostgreSQL: запрос с огромным `calls` и крошечным временем на вызов.
- **Тест-страховка.** `DbCommandInterceptor`, который считает команды, и тест
  «эндпоинт делает не больше 3 запросов».
- **Запрет lazy loading.** Не подключать прокси. Если он уже есть, можно настроить EF,
  чтобы отдельные lazy-load warning'и превращались в исключения (`ConfigureWarnings`).

```csharp
public sealed class CommandCounter : DbCommandInterceptor
{
    public int Count;
    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand cmd, CommandEventData data, InterceptionResult<DbDataReader> result,
        CancellationToken ct = default)
    {
        Interlocked.Increment(ref Count);
        return base.ReaderExecutingAsync(cmd, data, result, ct);
    }
}
```

### Как исправить

**1. Projection** — лучший вариант для чтения:

```csharp
var dto = await db.Orders
    .Where(o => o.Date == today)
    .Select(o => new OrderDto(o.Id, o.Customer.Name, o.Lines.Count))
    .ToListAsync();                    // один SQL с JOIN и подзапросом
```

**2. `Include`**, если нужны сущности для изменения. Для нескольких коллекций добавить
`AsSplitQuery()`: несколько фиксированных запросов вместо N.

**3. Пакетная загрузка** — когда данные из другого источника или запрос сложный:

```csharp
var ids = orders.Select(o => o.CustomerId).Distinct().ToList();
var customers = await db.Customers
    .Where(c => ids.Contains(c.Id))   // PostgreSQL: WHERE c."Id" = ANY(@ids)
    .ToDictionaryAsync(c => c.Id);
```

**4. Убрать запрос из цикла** в сервисном слое: вместо `GetById` в `foreach` сделать
`GetByIds(ids)`. В GraphQL для этого используются DataLoader'ы.

**Чего не делать:** заменять N+1 гигантским `Include` на пять коллекций. Вы получите
cartesian explosion, один огромный ответ и ту же медленную операцию.

## Когда реально выполняется LINQ-запрос?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kogda-realno-vypolnyaetsya-linq-zapros
tags: linq
```

LINQ-запрос к EF Core выполняется не там, где его написали, а в момент, когда результат
начинают перечислять или запрашивают одно значение. Операторы вроде `Where`, `Select`,
`OrderBy`, `Include` только достраивают expression tree. SQL уходит в базу, когда вызывается
материализующий или скалярный оператор.

```csharp
var query = db.Orders
    .Where(o => o.Total > 100)
    .OrderBy(o => o.CreatedAt);     // SQL ещё не выполнен

var list  = await query.ToListAsync();        // выполнение №1
var count = await query.CountAsync();         // выполнение №2, другой SQL
```

**Что запускает выполнение:**

| Группа | Операторы |
| --- | --- |
| Материализация | `ToList(Async)`, `ToArray(Async)`, `ToDictionary(Async)`, `ToHashSet(Async)` |
| Перечисление | `foreach`, `await foreach` (`AsAsyncEnumerable`) — строки читаются потоково |
| Одно значение | `First`, `Single`, `Last` (+ `OrDefault`), `Find` |
| Агрегаты | `Count`, `LongCount`, `Any`, `All`, `Sum`, `Min`, `Max`, `Average` |
| Команды | `ExecuteUpdate(Async)`, `ExecuteDelete(Async)` |
| Служебное | `Load()` — выполнить и положить результат в трекер |

**Что выполнение не запускает:** `Where`, `Select`, `Join`, `GroupBy`, `Skip`, `Take`,
`Include`, `AsNoTracking`, `AsSplitQuery`. `ToQueryString()` тоже не запускает: он только
показывает SQL.

**Практические следствия:**

- **Повторное выполнение.** `IQueryable` в переменной — это описание запроса, а не данные.
  Два `foreach` по нему дадут два запроса, и данные между ними могут поменяться.
- **Замыкания и параметры.** Значения захваченных переменных читаются в момент
  выполнения, а не в момент построения запроса:

  ```csharp
  var min = 100;
  var q = db.Orders.Where(o => o.Total > min);
  min = 500;
  var r = await q.ToListAsync();    // WHERE "Total" > 500
  ```

- **Время жизни контекста.** Если вернуть из метода `IQueryable`, а контекст уже
  освобождён, при перечислении получите `ObjectDisposedException`.
- **Где ловить ошибки трансляции.** Исключение «could not be translated» тоже возникает в
  момент выполнения, а не на строке с `Where`.
- **`foreach` без материализации** держит `DataReader` и соединение открытыми, пока идёт
  цикл. Если внутри цикла выполнить ещё один запрос на том же контексте, будет ошибка (в
  PostgreSQL нет MARS), либо соединение останется занятым надолго.

## Что такое deferred execution в EF Core?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-deferred-execution-v-ef-core
tags: linq, orm
```

Deferred execution (отложенное выполнение) — это свойство LINQ, при котором запрос
описывается, но не выполняется, пока результат действительно не понадобится. В EF Core
цепочка операторов над `IQueryable<T>` накапливает expression tree. Трансляция в SQL и
поход в БД происходят только при перечислении или вызове оператора, возвращающего
значение.

```csharp
IQueryable<Product> q = db.Products;

if (!string.IsNullOrEmpty(search))
    q = q.Where(p => EF.Functions.ILike(p.Name, $"%{search}%"));
if (categoryId is not null)
    q = q.Where(p => p.CategoryId == categoryId);

q = q.OrderBy(p => p.Name).Skip(page * 20).Take(20);

var items = await q.ToListAsync();   // один SQL со всеми условиями
```

```sql
SELECT ... FROM "Products" AS p
WHERE p."Name" ILIKE @search AND p."CategoryId" = @categoryId
ORDER BY p."Name"
LIMIT @take OFFSET @skip
```

**Зачем это нужно:**

- **Композиция.** Запрос собирается по частям (фильтры, сортировка, пагинация), и в базу
  уходит один оптимальный SQL, а не выборка всей таблицы с фильтрацией в памяти.
- **Переиспользование.** Базовый запрос можно выполнить по-разному: `CountAsync()` для
  total и `ToListAsync()` для страницы.
- **Потоковое чтение.** `await foreach` по `AsAsyncEnumerable()` читает строки по мере
  прихода, без буферизации всего результата.

**Связь с expression tree.** Отложенность работает и в LINQ to Objects, но там цепочка —
это вложенные итераторы с делегатами. В EF Core лямбды компилируются в
`Expression<Func<...>>`, то есть в данные, которые провайдер анализирует и переводит в
SQL целиком.

**Ловушки:**

- **Многократное перечисление.** Каждое перечисление `IQueryable` — новый SQL-запрос.
  Если результат нужен дважды, материализуйте его один раз.
- **Поздняя ошибка.** Нетранслируемое выражение упадёт не при `Where`, а при
  `ToListAsync()`, иногда в другом слое.
- **Контекст освобождён.** `IQueryable`, возвращённый из `using`-блока, при перечислении
  выбросит `ObjectDisposedException`.
- **Изменение захваченных переменных** до выполнения меняет параметры запроса.

## Чем `IEnumerable` отличается от `IQueryable` в EF Core?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-chem-ienumerable-otlichaetsya-ot-iqueryable-v-ef-core
tags: linq, orm
```

`IQueryable<T>` описывает запрос в виде expression tree, который провайдер EF Core
переводит в SQL и выполняет в базе. `IEnumerable<T>` — последовательность в памяти, и
её операторы выполняются в .NET делегатами. На практике разница в том, где будут
выполнены `Where`, `OrderBy`, `Take`: в PostgreSQL или в вашем процессе после загрузки
данных.

| | `IQueryable<T>` | `IEnumerable<T>` |
| --- | --- | --- |
| Методы расширения | `Queryable.*` | `Enumerable.*` |
| Лямбда компилируется в | `Expression<Func<T, bool>>` (данные) | `Func<T, bool>` (код) |
| Кто выполняет | `IQueryProvider` → SQL в БД | LINQ to Objects в памяти |
| Что можно в лямбде | только транслируемое в SQL | любой C#-код |
| Наследование | `IQueryable<T> : IEnumerable<T>` | — |

**Классическая ошибка — тип параметра или возвращаемого значения:**

```csharp
// Плохо: фильтр принимает IEnumerable
IEnumerable<Order> Active(IEnumerable<Order> src) => src.Where(o => o.IsActive);

var orders = Active(db.Orders).Take(10).ToList();
```

```sql
SELECT * FROM "Orders"        -- вся таблица! Where и Take выполнены в памяти
```

```csharp
// Хорошо: IQueryable сохраняет композицию
IQueryable<Order> Active(IQueryable<Order> src) => src.Where(o => o.IsActive);
```

```sql
SELECT * FROM "Orders" WHERE "IsActive" LIMIT 10
```

Компилятор выбирает перегрузку `Where` по статическому типу переменной. Как только
запрос приведён к `IEnumerable<T>` (явно, через `AsEnumerable()` или сигнатуру метода),
все дальнейшие операторы идут в память.

**Когда `IEnumerable` уместен:**

- после выборки нужной порции данных нужно применить логику, которую SQL не умеет
  (сложный C#-метод, regex, вызов сервиса);
- возвращать из репозитория уже материализованные данные, чтобы запрос не утёк за
  пределы слоя и не выполнился после `Dispose` контекста.

**Нюансы:**

- `IQueryable` не значит «всё транслируется». Нетранслируемый метод в `Where` даст
  `InvalidOperationException ... could not be translated`. EF Core 3+ не делает скрытую
  клиентскую оценку, кроме финального `Select`.
- Возвращать `IQueryable` из репозитория спорно: гибко, но потребитель может построить
  любой запрос, и граница слоя размывается.
- Для асинхронности у `IQueryable` есть `ToListAsync`/`AsAsyncEnumerable`. У
  `IEnumerable` таких методов нет, данные уже в памяти или читаются синхронно.

## Что происходит при вызове `ToList()`?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-chto-proishodit-pri-vyzove-tolist
```

`ToList()` запускает выполнение запроса. EF Core переводит expression tree в SQL (или
берёт готовый перевод из кэша), выполняет команду, читает все строки через
`DbDataReader`, материализует объекты, при tracking регистрирует их в change tracker и
складывает результат в `List<T>` в памяти. После этого соединение освобождается, и
дальнейшие операции идут уже по списку.

**Шаги внутри:**

1. **Извлечение параметров.** Захваченные переменные (`id`, `from`) вынимаются из
   дерева и становятся параметрами SQL. Структура дерева без значений служит ключом кэша.
2. **Query cache.** Если запрос такой формы уже выполнялся, берётся скомпилированный
   делегат. Иначе дерево проходит через pipeline трансляции: нормализация, раскрытие
   навигаций и `Include`, генерация SQL, компиляция shaper'а. Это самая дорогая часть.
3. **Соединение.** Контекст открывает соединение (берёт из пула драйвера), если оно не
   открыто.
4. **Выполнение.** `DbCommand.ExecuteReader` с SQL и параметрами.
5. **Материализация.** Для каждой строки shaper создаёт объект и заполняет свойства. При
   tracking сначала ищет сущность с таким ключом в identity map и снимает snapshot
   для новых.
6. **Fix-up навигаций.** Связанные сущности, загруженные через `Include` или уже бывшие в
   трекере, связываются между собой.
7. **Буферизация и закрытие.** Все строки прочитаны, reader закрыт, соединение
   возвращено в пул (если нет транзакции).

```csharp
var orders = await db.Orders
    .Where(o => o.CustomerId == id)
    .ToListAsync(ct);   // в серверном коде — всегда async-версия
```

**Практические следствия:**

- **`ToList()` в середине цепочки** — всё, что после него, выполняется в памяти:

  ```csharp
  db.Orders.ToList().Where(o => o.Total > 100);   // вся таблица в память
  ```

- **Память.** Весь результат лежит в списке. Для экспорта миллионов строк лучше
  `await foreach` по `AsAsyncEnumerable()` с no-tracking: потоковое чтение без буфера.
- **Sync против async.** `ToList()` блокирует поток на время I/O. В ASP.NET Core
  используйте `ToListAsync(cancellationToken)`.
- **Повторный `ToList()`** на том же `IQueryable` — новый запрос в БД, а не копия
  списка.
- **Когда материализация полезна:** нужно отпустить соединение до долгой обработки, или
  результат будет перечисляться несколько раз.

## Что происходит при вызове `AsEnumerable()`?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-chto-proishodit-pri-vyzove-asenumerable
```

`AsEnumerable()` ничего не выполняет и ничего не загружает. Он только меняет статический
тип с `IQueryable<T>` на `IEnumerable<T>`. Всё, что написано до него, EF Core переведёт в
SQL, а все операторы после него будут выполнены LINQ to Objects в памяти, над строками,
которые потоково читаются из базы при перечислении.

```csharp
var result = db.Products
    .Where(p => p.CategoryId == 5)           // → SQL
    .AsEnumerable()                           // граница
    .Where(p => MyRules.IsVisible(p))         // C#-метод, в памяти
    .Select(p => new { p.Name, Slug = Slugify(p.Name) })
    .ToList();                                // здесь выполняется SQL и цепочка
```

```sql
SELECT p.* FROM "Products" AS p WHERE p."CategoryId" = 5
```

**Отличие от `ToList()`:**

| | `AsEnumerable()` | `ToList()` |
| --- | --- | --- |
| Выполняет запрос сразу | нет, при перечислении | да |
| Буферизирует результат | нет, строки идут потоком | да, весь список в памяти |
| Соединение | занято, пока идёт перечисление | освобождено после чтения |
| Повторное перечисление | новый SQL-запрос | работа с тем же списком |

**Зачем нужен:**

- явно разделить серверную и клиентскую части запроса, когда часть логики не
  транслируется в SQL. EF Core 3+ не делает клиентскую оценку молча и бросает исключение
  «could not be translated»;
- обработать большой поток строк без буферизации всего результата (для async-кода это
  `AsAsyncEnumerable()` и `await foreach`).

**Ловушки:**

- **Рано поставленная граница.** `db.Orders.AsEnumerable().Where(...).Take(10)` вытянет
  всю таблицу. Фильтры, сортировку и `Take` нужно ставить до `AsEnumerable()`.
- **Синхронный I/O.** Перечисление `IEnumerable` читает из БД синхронно. В ASP.NET Core
  используйте `AsAsyncEnumerable()`, а для клиентских операторов — `System.Linq.Async`
  или материализацию через `ToListAsync()` с обработкой после.
- **Открытый reader.** Пока идёт перечисление, другой запрос на этом же контексте
  выполнить нельзя (Npgsql не поддерживает несколько активных reader'ов на одном
  соединении).
- **Tracking сохраняется.** Если запрос возвращает сущности, они отслеживаются, даже
  если дальше идёт LINQ to Objects.

## Что такое projection через `Select()`?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-projection-cherez-select
tags: linq
```

Projection — это выборка через `Select()` не целых сущностей, а только нужных полей: в
DTO, record или анонимный тип. EF Core видит выражение в `Select` и генерирует SQL,
который читает только используемые колонки. Нужные связанные данные он подтягивает
через `JOIN` или подзапросы сам, без `Include`.

```csharp
public record OrderListItem(int Id, DateTime CreatedAt, string Customer,
                            int LinesCount, decimal Total);

var items = await db.Orders
    .Where(o => o.Status == OrderStatus.Paid)
    .OrderByDescending(o => o.CreatedAt)
    .Select(o => new OrderListItem(
        o.Id,
        o.CreatedAt,
        o.Customer.Name,                         // JOIN
        o.Lines.Count,                           // подзапрос COUNT
        o.Lines.Sum(l => l.Price * l.Quantity))) // подзапрос SUM
    .Take(50)
    .ToListAsync();
```

```sql
SELECT o."Id", o."CreatedAt", c."Name",
       (SELECT count(*) FROM "OrderLines" AS l WHERE o."Id" = l."OrderId"),
       (SELECT COALESCE(sum(l0."Price" * l0."Quantity"), 0.0)
          FROM "OrderLines" AS l0 WHERE o."Id" = l0."OrderId")
FROM "Orders" AS o
JOIN "Customers" AS c ON o."CustomerId" = c."Id"
WHERE o."Status" = 1
ORDER BY o."CreatedAt" DESC
LIMIT 50
```

**Что даёт:**

- меньше данных по сети и меньше работы на материализацию;
- нет change tracking: DTO не сущности, трекать нечего;
- агрегаты считаются в БД, а не в памяти после загрузки коллекций;
- можно попасть в covering index (index-only scan), если выбираются только
  проиндексированные колонки.

**Вложенные коллекции тоже можно проецировать:**

```csharp
.Select(o => new { o.Id, Lines = o.Lines.Select(l => new { l.ProductId, l.Quantity }).ToList() })
```

**Ограничения и нюансы:**

- **Только финальный `Select` может содержать нетранслируемый код.** Вызов обычного
  C#-метода там выполнится на клиенте после чтения колонок. В `Where` или в середине
  запроса — исключение.
- **Конструктор DTO с логикой** выполняется в памяти. EF не видит, какие колонки нужны
  внутри вашего метода, и может потянуть лишнее.
- **Для изменения данных projection не подходит.** Нужны отслеживаемые сущности или
  `ExecuteUpdateAsync`.
- **AutoMapper `ProjectTo<T>()`** и Mapster `ProjectToType<T>()` строят такой же `Select`
  автоматически. Это лучше, чем `ToList()` с последующим `Map()`.

## Почему projection часто лучше `Include()`?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-pochemu-projection-chasto-luchshe-include
tags: linq, orm
```

`Include()` грузит связанные сущности целиком: все колонки, с tracking, snapshot'ами и
identity resolution. Projection через `Select()` грузит только поля, которые реально нужны
результату, и позволяет считать агрегаты на стороне БД. Для read-only сценариев (API,
списки, отчёты) projection обычно в разы экономнее по сети, памяти и CPU.

**Сравнение на примере карточки заказа:**

```csharp
// Include: сущности целиком
var order = await db.Orders
    .Include(o => o.Customer)
    .Include(o => o.Lines).ThenInclude(l => l.Product)
    .FirstAsync(o => o.Id == id);
return new OrderDto(order.Id, order.Customer.Name,
    order.Lines.Select(l => new LineDto(l.Product.Name, l.Quantity)).ToList());

// Projection: только нужное
var dto = await db.Orders
    .Where(o => o.Id == id)
    .Select(o => new OrderDto(o.Id, o.Customer.Name,
        o.Lines.Select(l => new LineDto(l.Product.Name, l.Quantity)).ToList()))
    .FirstAsync();
```

| | `Include` | Projection |
| --- | --- | --- |
| Колонки | все колонки всех таблиц (включая `Description`, `jsonb`, `bytea`) | только используемые |
| Change tracking | да, если нет `AsNoTracking` | нет |
| Агрегаты (`Count`, `Sum`) | в памяти после загрузки коллекции | в SQL |
| Cartesian explosion | при нескольких коллекциях | тоже возможен, но строки узкие |
| Попадание в covering index | почти никогда | возможно |
| Годится для `SaveChanges` | да | нет |

**Почему разница бывает огромной:** у `Product` может быть колонка с HTML-описанием на
20 КБ. `Include` потянет её для каждой строки заказа, повторённой в каждой строке
результирующего `JOIN`, а projection не прочитает её вообще. Плюс для сущностей EF строит
tracking-структуры, которые живут до конца жизни контекста.

**Когда `Include` всё-таки правильный выбор:**

- граф будет изменён и сохранён: загрузить агрегат, поменять, `SaveChanges()`;
- доменная логика работает с сущностями, а не с DTO (DDD-агрегат с инвариантами);
- нужна почти вся сущность, и писать projection на 30 полей нет смысла.

**Сопутствующие детали:**

- при projection `Include` не нужен: если он есть перед `Select`, EF его проигнорирует;
- маппинг через AutoMapper после `ToList()` сводит преимущество на нет, используйте
  `ProjectTo`;
- projection тоже может быть «толстым»: вложенные коллекции в `Select` по-прежнему дают
  `JOIN` с дублированием строк, и `AsSplitQuery()` работает и для них.

## Как посмотреть SQL, который генерирует EF Core?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-posmotret-sql-kotoryi-generiruet-ef-core
tags: orm
```

Самый быстрый способ — `ToQueryString()` на `IQueryable`: он возвращает SQL без
выполнения. Для реальной работы приложения включают логирование: `LogTo` в
`DbContextOptions` или категорию `Microsoft.EntityFrameworkCore.Database.Command` через
`ILogger`. В проде SQL и время выполнения смотрят в трейсинге (OpenTelemetry) и на стороне
БД (`pg_stat_statements`, `EXPLAIN`).

**1. `ToQueryString()`** — для отладки и тестов:

```csharp
var q = db.Orders.Where(o => o.Total > min).OrderBy(o => o.Id);
Console.WriteLine(q.ToQueryString());
```

```sql
-- @min='100'
SELECT o."Id", o."Total" FROM "Orders" AS o
WHERE o."Total" > @min
ORDER BY o."Id"
```

Работает только для запросов, заканчивающихся на `IQueryable`. Для `First`, `Count` или
`ExecuteUpdate` так не получится, там нужен лог.

**2. `LogTo`** — простое логирование без DI:

```csharp
options.UseNpgsql(cs)
       .LogTo(Console.WriteLine, [DbLoggerCategory.Database.Command.Name], LogLevel.Information)
       .EnableSensitiveDataLogging()   // значения параметров — только в dev!
       .EnableDetailedErrors();
```

**3. Через `ILogger` ASP.NET Core** (`appsettings.Development.json`):

```json
{
  "Logging": {
    "LogLevel": {
      "Microsoft.EntityFrameworkCore.Database.Command": "Information"
    }
  }
}
```

В логе будет `Executed DbCommand (3ms) [Parameters=[...]] SELECT ...` — сразу видно
время каждой команды.

**4. `TagWith`** — пометить запрос, чтобы найти его в логах БД:

```csharp
db.Orders.TagWith("GetDashboardOrders").Where(...)
// SQL начнётся с комментария: -- GetDashboardOrders
```

**5. Другие инструменты:**

- `DbCommandInterceptor` — перехват команд, можно логировать, считать, модифицировать;
- OpenTelemetry (Npgsql и EF Core instrumentation) — SQL как span'ы в трейсе запроса;
- на стороне PostgreSQL — `log_min_duration_statement`, `pg_stat_statements`,
  `auto_explain`;
- SQL Server Profiler / Extended Events — для SQL Server.

**Предостережения:**

- `EnableSensitiveDataLogging` пишет значения параметров (пароли, персональные данные) —
  в проде выключать;
- SQL нужно не только смотреть, но и проверять планом: `EXPLAIN (ANALYZE, BUFFERS)` на
  реальных данных показывает, используется ли индекс.

## Что такое migrations?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-migrations
tags: orm
```

Migrations — это способ версионировать схему базы данных вместе с кодом. Каждое
изменение модели EF Core (новая сущность, колонка, индекс) оформляется как класс
миграции с методами `Up()` и `Down()`. Миграции хранятся в репозитории и
применяются к базе по порядку, а в БД записывается, какие уже применены.

```bash
dotnet ef migrations add AddOrderStatus     # сгенерировать миграцию по diff модели
dotnet ef database update                   # применить к БД
dotnet ef migrations script --idempotent    # SQL-скрипт для прода
```

```csharp
public partial class AddOrderStatus : Migration
{
    protected override void Up(MigrationBuilder mb)
    {
        mb.AddColumn<int>("Status", "Orders", nullable: false, defaultValue: 0);
        mb.CreateIndex("IX_Orders_Status", "Orders", "Status");
    }

    protected override void Down(MigrationBuilder mb)
    {
        mb.DropIndex("IX_Orders_Status", "Orders");
        mb.DropColumn("Status", "Orders");
    }
}
```

**Зачем это нужно:**

- схема воспроизводима: любая среда (dev, CI, stage, prod) поднимается до одного и того
  же состояния;
- изменения схемы проходят код-ревью вместе с кодом, который их использует;
- нет ручных «накатить этот скрипт перед релизом».

**Из чего состоит:**

- файлы миграций (`Up`/`Down` + `.Designer.cs` с метаданными);
- `ModelSnapshot` — текущее состояние модели, с которым сравнивается следующая миграция;
- таблица `__EFMigrationsHistory` в БД со списком применённых миграций.

**Что важно понимать:**

- **Сгенерированную миграцию нужно читать.** Переименование свойства EF может
  распознать как `DropColumn` + `AddColumn`, то есть потерю данных. Такие места правят
  руками (`RenameColumn`) и пишут в миграцию `Sql(...)` для переноса данных.
- **Не редактировать уже применённые миграции**, а создавать новые.
- **Альтернативы:** code-first миграции EF — не единственный путь. Команды с DBA часто
  используют database-first и отдельные инструменты (Flyway, DbUp, Liquibase), а EF
  только маппит существующую схему (`dotnet ef dbcontext scaffold`).

## Как работают EF Core migrations?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-rabotayut-ef-core-migrations
tags: orm
```

При `migrations add` EF Core строит текущую модель из кода, сравнивает её с
`ModelSnapshot` (моделью на момент прошлой миграции) и генерирует операции, превращающие
одну в другую. При применении EF читает таблицу `__EFMigrationsHistory`, находит
неприменённые миграции, переводит их операции в SQL провайдера и выполняет по
порядку, записывая каждую в историю.

**Этап 1 — создание (design time):**

1. `dotnet ef` собирает проект и создаёт `DbContext` (через `IDesignTimeDbContextFactory`
   или host приложения).
2. Строится модель: конвенции + атрибуты + `OnModelCreating`.
3. `IMigrationsModelDiffer` сравнивает её со snapshot и выдаёт список операций
   (`AddColumn`, `CreateIndex`, `RenameTable`...).
4. Генерируются файлы: миграция (`Up`/`Down`), `.Designer.cs` (снимок модели на момент
   этой миграции) и обновлённый `AppDbContextModelSnapshot.cs`.

Поэтому snapshot критичен при merge: две ветки с миграциями дают конфликт в snapshot, и
его нужно разрешить, иногда пересоздав последнюю миграцию.

**Этап 2 — применение (runtime / deploy):**

```sql
-- что по сути делает database update
SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY "MigrationId";
-- для каждой неприменённой:
BEGIN;
ALTER TABLE "Orders" ADD "Status" integer NOT NULL DEFAULT 0;
CREATE INDEX "IX_Orders_Status" ON "Orders" ("Status");
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260901120000_AddOrderStatus', '9.0.0');
COMMIT;
```

Миграции упорядочены по id с timestamp'ом в имени. В PostgreSQL DDL транзакционный, так
что неудачная миграция откатывается целиком. Исключение — операции, которые нельзя
выполнять в транзакции, например `CREATE INDEX CONCURRENTLY`.

**Способы применения в проде:**

| Способ | Комментарий |
| --- | --- |
| `dotnet ef migrations script --idempotent` | SQL-скрипт с проверками по истории; можно ревьюить и отдать DBA |
| Migration bundle (`dotnet ef migrations bundle`) | самодостаточный exe для CI/CD, без SDK и исходников |
| `db.Database.MigrateAsync()` при старте | просто, но опасно: несколько реплик стартуют одновременно, приложению нужны права на DDL, долгие миграции блокируют старт |

В EF 9 `Migrate` берёт блокировку БД для защиты от параллельного запуска и бросает
исключение, если модель содержит изменения без миграции (pending model changes). Но
отдельный шаг деплоя всё равно надёжнее.

**Подводные камни:**

- **Zero-downtime.** Миграция и новый код выкатываются не атомарно. Опасные изменения
  (переименование, `NOT NULL` без default, удаление колонки) делают в несколько релизов:
  expand → migrate data → contract.
- **Долгие блокировки.** `ALTER TABLE` на большой таблице может взять
  `ACCESS EXCLUSIVE` lock. Индексы на больших таблицах лучше создавать конкурентно: в
  Npgsql это `HasIndex(...).IsCreatedConcurrently()` или
  `migrationBuilder.Sql("CREATE INDEX CONCURRENTLY ...", suppressTransaction: true)`.
- **`Down()` почти никогда не используется в проде.** Откат обычно делается новой
  миграцией вперёд.

## Что такое transaction в EF Core?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-transaction-v-ef-core
tags: transactions, orm
```

Транзакция — это группа операций с БД, которая применяется целиком или не применяется
вовсе (ACID). В EF Core каждый вызов `SaveChanges()` по умолчанию сам выполняется в
транзакции: все `INSERT`/`UPDATE`/`DELETE` одного вызова либо коммитятся вместе, либо
откатываются при ошибке. Явная транзакция нужна, когда атомарными должны быть
несколько `SaveChanges`, raw SQL или `ExecuteUpdate`.

```csharp
db.Orders.Add(order);
db.Stock.Single(s => s.ProductId == pid).Quantity -= 1;
await db.SaveChangesAsync();   // BEGIN; INSERT...; UPDATE...; COMMIT;
```

Если упадёт `UPDATE`, `INSERT` тоже откатится, а в памяти сущности останутся в прежних
состояниях: можно исправить и повторить.

**Что покрывает неявная транзакция, а что нет:**

| Операция | В транзакции по умолчанию |
| --- | --- |
| Один `SaveChanges()` | да (если команд больше одной или провайдер так решит) |
| Несколько `SaveChanges()` подряд | нет, каждый в своей |
| `ExecuteUpdateAsync` / `ExecuteDeleteAsync` | одна SQL-команда, атомарна сама по себе, но не связана с другими |
| `ExecuteSql` / `FromSql` | нет, если не открыта явная транзакция |
| Запросы (`ToListAsync`) | нет |

Поведение `SaveChanges` настраивается через
`db.Database.AutoTransactionBehavior` (EF 7+): `WhenNeeded` по умолчанию, `Always`,
`Never`.

**Варианты явных транзакций:**

- `db.Database.BeginTransactionAsync()` — основной способ, с выбором isolation level;
- `CreateSavepointAsync` / `RollbackToSavepointAsync` — частичный откат внутри
  транзакции (EF сам ставит savepoint перед `SaveChanges` в уже открытой транзакции);
- `db.Database.UseTransaction(dbTransaction)` — разделить транзакцию с ADO.NET или
  Dapper на том же соединении;
- `TransactionScope` — ambient-транзакция; работает, но с async нужен
  `TransactionScopeAsyncFlowOption.Enabled`, а распределённые транзакции в .NET на Linux
  не поддерживаются.

**Isolation level.** По умолчанию используется уровень БД: в PostgreSQL это
`Read Committed`. Транзакция EF не защищает от lost update сама по себе. Для этого
нужны optimistic concurrency (токены), `SELECT ... FOR UPDATE` через raw SQL или уровень
`Serializable`/`RepeatableRead` с обработкой ошибок сериализации.

**Частые ошибки:**

- держать транзакцию открытой во время HTTP-вызовов и другой долгой работы — это
  блокировки и занятое соединение;
- считать, что два `SaveChanges` в одном методе атомарны;
- забыть про execution strategy: с `EnableRetryOnFailure` ручную транзакцию нужно
  оборачивать в `strategy.ExecuteAsync`, иначе EF бросит исключение.

## Как вручную открыть transaction?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-vruchnuyu-otkryt-transaction
tags: transactions
```

Через `db.Database.BeginTransactionAsync()`. Все последующие операции этого контекста
(`SaveChanges`, `ExecuteUpdate`, raw SQL, запросы) выполняются в ней, пока вы не вызовете
`CommitAsync()`. Если коммита не было, `Dispose` транзакции откатывает её
автоматически.

```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);

var account = await db.Accounts.SingleAsync(a => a.Id == fromId, ct);
account.Balance -= amount;
await db.SaveChangesAsync(ct);

await db.Transfers
    .Where(t => t.Id == transferId)
    .ExecuteUpdateAsync(s => s.SetProperty(t => t.Status, TransferStatus.Done), ct);

await tx.CommitAsync(ct);
// исключение до CommitAsync → await using вызовет Dispose → ROLLBACK
```

**Isolation level:**

```csharp
await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
```

На `Serializable` и `RepeatableRead` PostgreSQL может отклонить транзакцию с ошибкой
сериализации (`40001`). Её нужно повторить целиком, это часть контракта.

**С execution strategy (retry).** Если включён `EnableRetryOnFailure`, EF не может сам
повторить отдельную команду внутри ручной транзакции и бросит исключение. Весь блок
оборачивают в стратегию, чтобы при сбое повторялась вся транзакция:

```csharp
var strategy = db.Database.CreateExecutionStrategy();
await strategy.ExecuteAsync(async () =>
{
    await using var tx = await db.Database.BeginTransactionAsync(ct);
    // ... операции ...
    await db.SaveChangesAsync(ct);
    await tx.CommitAsync(ct);
});
```

Код внутри должен быть безопасен для повтора: без побочных эффектов вне БД, а
состояние трекера после неудачной попытки учитывать (или создавать контекст внутри
лямбды).

**Savepoints** — частичный откат:

```csharp
await tx.CreateSavepointAsync("BeforeBonus", ct);
try { /* ... */ await db.SaveChangesAsync(ct); }
catch { await tx.RollbackToSavepointAsync("BeforeBonus", ct); }
```

**Общая транзакция с Dapper** на том же соединении:

```csharp
var conn = db.Database.GetDbConnection();
var dbTx = tx.GetDbTransaction();
await conn.ExecuteAsync("UPDATE ...", param, transaction: dbTx);
```

**Правила:** транзакция должна быть короткой, без внешних HTTP-вызовов внутри. Никогда
не делайте `BeginTransaction` без `using`, иначе при исключении соединение останется с
незавершённой транзакцией.

## Как работает optimistic concurrency?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-rabotaet-optimistic-concurrency
tags: threading
```

Optimistic concurrency предполагает, что конфликты редки. Строка не блокируется при
чтении, а при сохранении EF проверяет, что её никто не изменил с момента загрузки. Для
этого в `WHERE` у `UPDATE`/`DELETE` добавляется исходное значение concurrency token. Если
команда затронула 0 строк, значит строку поменяли или удалили, и EF бросает
`DbUpdateConcurrencyException`.

**Сценарий lost update, от которого это защищает:**

```text
Алиса читает товар (Price=100, Version=5)
Боб   читает товар (Price=100, Version=5)
Боб   сохраняет Price=120  → Version=6
Алиса сохраняет Price=90   → без проверки перезапишет изменение Боба
```

**Настройка для PostgreSQL** — системная колонка `xmin`. Она меняется при каждом
обновлении строки, так что отдельная колонка не нужна:

```csharp
public class Product
{
    public int Id { get; set; }
    public decimal Price { get; set; }

    [Timestamp]                 // Npgsql 7+: uint + Timestamp → xmin
    public uint Version { get; set; }
}
```

```sql
UPDATE "Products" SET "Price" = @p0
WHERE "Id" = @p1 AND xmin = @p2
RETURNING xmin;
```

Для SQL Server то же самое даёт `[Timestamp] byte[] RowVersion` (тип `rowversion`).
Универсальный вариант — `[ConcurrencyCheck]` на обычном свойстве, но тогда значение
(например, `Guid Version`) нужно менять самому перед каждым сохранением.

**Что происходит при конфликте:**

1. EF выполнил `UPDATE`, база вернула «0 rows affected».
2. EF бросает `DbUpdateConcurrencyException`, в `ex.Entries` лежат конфликтующие
   сущности.
3. Приложение решает, что делать: показать ошибку (HTTP 409), перечитать и повторить,
   смержить значения.

**Optimistic против pessimistic:**

| | Optimistic | Pessimistic (`SELECT ... FOR UPDATE`) |
| --- | --- | --- |
| Блокировки | нет | строка заблокирована до конца транзакции |
| Где уместно | редкие конфликты, веб, долгие «think time» пользователя | частые конфликты за одну строку (баланс, остатки) |
| Цена конфликта | ошибка и повтор | ожидание блокировки, риск дедлоков |
| Поддержка в EF | встроена | только raw SQL (`FromSql`) в явной транзакции |

**Нюансы:**

- **Web-сценарий.** Токен нужно передать клиенту и вернуть обратно (ETag / поле в DTO), а
  при сохранении выставить его как original value:
  `db.Entry(p).Property(x => x.Version).OriginalValue = dto.Version`. Иначе проверка
  идёт против значения, прочитанного в этом же запросе, и почти ничего не защищает.
- **`ExecuteUpdate`/`ExecuteDelete`** обходят change tracker и токен не проверяют. Условие
  на версию нужно добавить в `Where` вручную и смотреть на число затронутых строк.
- **Атомарный инкремент** (`SET "Stock" = "Stock" - 1 WHERE "Stock" > 0`) через
  `ExecuteUpdate` часто проще, чем optimistic concurrency с ретраями.

## Что такое concurrency token?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-concurrency-token
tags: threading
```

Concurrency token — это свойство сущности, исходное значение которого EF Core
добавляет в `WHERE` при `UPDATE` и `DELETE`. Если за время между чтением и сохранением
значение в БД изменилось, команда не найдёт строку, и EF бросит
`DbUpdateConcurrencyException`. Это основа optimistic concurrency.

**Два вида токенов:**

| Вид | Кто меняет значение | Как объявить |
| --- | --- | --- |
| Генерируемый БД (row version) | база автоматически при каждом изменении строки | `[Timestamp]` / `.IsRowVersion()` |
| Управляемый приложением | ваш код | `[ConcurrencyCheck]` / `.IsConcurrencyToken()` |

**PostgreSQL (Npgsql)** — роль row version играет системная колонка `xmin` (id
транзакции, последней изменившей строку):

```csharp
public class Document
{
    public int Id { get; set; }
    public string Body { get; set; } = "";

    [Timestamp]
    public uint Version { get; set; }   // замапится на xmin, колонку создавать не нужно
}
```

**SQL Server:**

```csharp
[Timestamp]
public byte[] RowVersion { get; set; } = [];   // rowversion
```

**Токен, управляемый приложением** (подходит для любой БД):

```csharp
public class Article
{
    public int Id { get; set; }
    public string Body { get; set; } = "";
    public Guid Version { get; set; }
}

modelBuilder.Entity<Article>()
    .Property(a => a.Version).IsConcurrencyToken();

article.Body = newBody;
article.Version = Guid.NewGuid();      // обязательно менять при каждом изменении
await db.SaveChangesAsync();
```

```sql
UPDATE "Articles" SET "Body" = @p0, "Version" = @p1
WHERE "Id" = @p2 AND "Version" = @p3;    -- @p3 — исходное значение
```

`[ConcurrencyCheck]` можно поставить и на бизнес-поле (например, `Email`). Тогда конфликт
будет, только если изменилось именно оно. Это точечная защита вместо защиты всей
строки.

**Практические детали:**

- EF сравнивает с **original value**, то есть значением на момент начала трекинга. В API
  с DTO его нужно выставить из запроса клиента, иначе проверка теряет смысл.
- Токен проверяется в `UPDATE` и `DELETE`, но не в `INSERT`.
- Row version, сгенерированный БД, после сохранения возвращается в сущность (в PostgreSQL
  через `RETURNING`), и следующее сохранение того же объекта проверит уже новое значение.
- Массовые `ExecuteUpdate`/`ExecuteDelete` токены не учитывают.

## Как обрабатывать `DbUpdateConcurrencyException`?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-obrabatyvat-dbupdateconcurrencyexception
tags: threading
```

`DbUpdateConcurrencyException` означает, что `UPDATE`/`DELETE` с проверкой concurrency
token затронул 0 строк: запись изменили или удалили после того, как вы её прочитали.
Обработка — это выбор стратегии разрешения конфликта. Можно вернуть ошибку клиенту
(`409 Conflict`), отдать приоритет базе (store wins), перезаписать своими данными
(client wins) или смержить значения. Конфликтующие сущности лежат в `ex.Entries`.

**Три набора значений у каждой записи:**

| Набор | Что это |
| --- | --- |
| `entry.CurrentValues` | то, что вы хотите сохранить |
| `entry.OriginalValues` | то, что было прочитано (по нему строился `WHERE`) |
| `await entry.GetDatabaseValuesAsync()` | что сейчас в БД; `null`, если строку удалили |

**Самый частый вариант в API — сообщить о конфликте:**

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

**Client wins** — перезаписать, приняв текущую версию БД за «исходную»:

```csharp
catch (DbUpdateConcurrencyException ex)
{
    foreach (var entry in ex.Entries)
    {
        var dbValues = await entry.GetDatabaseValuesAsync(ct);
        if (dbValues is null) throw;               // строка удалена — перезаписывать нечего
        entry.OriginalValues.SetValues(dbValues);  // новый токен попадёт в WHERE
    }
    await db.SaveChangesAsync(ct);                 // может снова упасть — нужен цикл с лимитом
}
```

**Store wins** — отказаться от своих изменений:

```csharp
foreach (var entry in ex.Entries)
    await entry.ReloadAsync(ct);   // Current и Original = значения из БД, состояние Unchanged
```

**Merge по свойствам** — перенести только поля, которые пользователь реально менял:

```csharp
var dbValues = await entry.GetDatabaseValuesAsync(ct);
foreach (var p in entry.Properties.Where(p => !p.IsModified))
    p.CurrentValue = dbValues![p.Metadata];   // чужие изменения в нетронутых полях сохраняем
entry.OriginalValues.SetValues(dbValues!);
```

**Правила:**

- **Повтор с лимитом.** Между `GetDatabaseValues` и вторым `SaveChanges` строку могут
  изменить снова. Обработку делают в цикле с 2–3 попытками.
- **Client wins часто неправильный выбор**, потому что это тот же lost update, только
  осознанный. Для денег и остатков лучше атомарный `ExecuteUpdate` или повтор всей
  бизнес-операции с перечитыванием данных.
- **Удалённая строка** (`GetDatabaseValuesAsync() == null`) — отдельный случай: 404 или
  410, а не перезапись.
- **Повтор бизнес-операции целиком** (перечитать, заново применить команду, сохранить)
  надёжнее ручного merge. Для этого удобно создавать новый `DbContext` на каждую попытку.
- Это исключение не относится к transient-ошибкам. `EnableRetryOnFailure` его не
  повторяет.

## Что такое connection pooling?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-connection-pooling
tags: orm
```

Connection pooling — это переиспользование уже открытых физических соединений с БД.
Когда код вызывает `connection.Close()`/`Dispose()`, драйвер (Npgsql, SqlClient) не
разрывает TCP-сессию, а возвращает соединение в пул. Следующий `Open()` с той же
connection string получает его за микросекунды, без нового handshake и аутентификации.

**Почему это важно.** Открыть соединение с PostgreSQL дорого: TCP (+TLS), аутентификация
(SCRAM), а на стороне сервера — отдельный backend-процесс на каждое соединение. Это
единицы–десятки миллисекунд и мегабайты памяти на сервере. Без пула каждый HTTP-запрос
платил бы эту цену.

```csharp
await using var conn = new NpgsqlConnection(cs);
await conn.OpenAsync();    // берёт соединение из пула (или создаёт новое)
// ...
// DisposeAsync → соединение сбрасывается и возвращается в пул, а не закрывается
```

**Как устроен пул в Npgsql:**

- отдельный пул на каждую уникальную connection string (или на каждый `NpgsqlDataSource`);
- параметры в connection string:

| Параметр | По умолчанию | Смысл |
| --- | --- | --- |
| `Pooling` | `true` | включён ли пул |
| `Minimum Pool Size` | 0 | сколько соединений держать всегда |
| `Maximum Pool Size` | 100 | верхний предел соединений из этого пула |
| `Timeout` | 15 с | сколько ждать свободное соединение (и открытие нового) |
| `Connection Idle Lifetime` | 300 с | через сколько закрывать простаивающие лишние соединения |
| `Connection Lifetime` | 0 (без ограничения) | максимальный возраст соединения |

**Типичные проблемы:**

- **Исчерпание пула.** Соединения не возвращаются (забытый `Dispose`, долгие транзакции,
  sync-over-async) или нагрузка выше `Max Pool Size`. Запросы ждут и падают с ошибкой
  «The connection pool has been exhausted». Лечится устранением утечки, а не только
  увеличением лимита.
- **Суммарный лимит на сервере.** 10 инстансов × 100 соединений = 1000 при
  `max_connections = 100` в PostgreSQL. Для горизонтального масштабирования ставят
  внешний пулер: PgBouncer в transaction mode, или Pgpool/Odyssey.
- **Разные connection string** (например, с разным `Application Name` на запрос)
  создают разные пулы и сводят пулинг на нет.
- **Состояние сессии.** Соединение из пула могло использоваться другим кодом. Npgsql
  сбрасывает состояние (`DISCARD ALL`) при возврате, но `SET` в transaction-mode
  PgBouncer может «утечь» к другому клиенту.

Пул драйвера — не то же самое, что пул `DbContext` (`AddDbContextPool`). Второй
переиспользует объекты контекста, а не соединения.

## Как EF Core работает с connection pool?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-ef-core-rabotaet-s-connection-pool
tags: orm
```

EF Core сам пулом соединений не управляет. Он работает через ADO.NET-провайдер
(`NpgsqlConnection`), а пулинг делает драйвер. EF открывает соединение непосредственно
перед командой и закрывает сразу после, то есть возвращает в пул. Благодаря этому даже
долгоживущий `DbContext` не держит физическое соединение между запросами.

**Когда соединение открыто:**

| Ситуация | Соединение |
| --- | --- |
| `ToListAsync`, `SaveChangesAsync`, `ExecuteUpdateAsync` | открывается на время операции, потом возвращается в пул |
| `await foreach` / `AsEnumerable` | занято, пока идёт перечисление |
| Явная транзакция `BeginTransactionAsync` | занято до `Commit`/`Rollback`/`Dispose` |
| `db.Database.OpenConnectionAsync()` вручную | занято до `CloseConnection` или `Dispose` контекста |
| Между запросами на одном контексте | не занято |

**Конфигурация с `NpgsqlDataSource`** (рекомендуемый путь в Npgsql 7+): data source
владеет пулом, настройками и маппингами типов.

```csharp
var dataSource = new NpgsqlDataSourceBuilder(cs)
    .EnableDynamicJson()
    .Build();

builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(dataSource));
// или просто UseNpgsql(cs) — Npgsql сам создаст/переиспользует data source
```

**DbContext pooling — другой уровень:**

```csharp
builder.Services.AddDbContextPool<AppDbContext>(o => o.UseNpgsql(cs), poolSize: 1024);
```

Здесь переиспользуются объекты `DbContext` вместе с внутренними сервисами: после
`Dispose` контекст сбрасывается (трекер, настройки) и возвращается в пул. Это экономит
аллокации и инициализацию на каждый запрос. С количеством соединений с БД это не
связано. Ограничение: контекст не должен хранить собственное состояние в полях
(например, tenant id), или его нужно сбрасывать вручную.

**Что влияет на загрузку пула драйвера:**

- **Долгие транзакции** держат соединение всё время: пока идёт HTTP-вызов внутри
  транзакции, соединение простаивает занятым.
- **Параллельные запросы.** Каждый параллельный `DbContext` (через
  `IDbContextFactory`) берёт своё соединение. `Task.WhenAll` на 200 задач упрётся в
  `Max Pool Size`.
- **Sync-over-async** (`.Result`) под нагрузкой приводит к голоданию thread pool, и
  соединения возвращаются медленно.
- **PgBouncer в transaction mode**: не рассчитывайте на состояние сессии; с prepared
  statements проверьте, поддерживает ли их ваша версия PgBouncer, либо отключите
  автоматическую подготовку в Npgsql.

**Диагностика:** метрики Npgsql (`System.Diagnostics.Metrics`: число занятых и
свободных соединений, время ожидания), `pg_stat_activity` на сервере (много `idle in
transaction` — утечка транзакций).

## Что такое compiled query?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-compiled-query
tags: orm
```

Compiled query — это LINQ-запрос, который один раз заранее превращается в готовый
делегат через `EF.CompileQuery` / `EF.CompileAsyncQuery`. При вызове EF Core не нужно
заново разбирать expression tree, вычислять ключ кэша и искать перевод. Он сразу
подставляет параметры и выполняет SQL.

```csharp
public static class Queries
{
    public static readonly Func<AppDbContext, int, Task<Order?>> OrderById =
        EF.CompileAsyncQuery((AppDbContext db, int id) =>
            db.Orders
              .AsNoTracking()
              .Include(o => o.Lines)
              .FirstOrDefault(o => o.Id == id));

    public static readonly Func<AppDbContext, int, IAsyncEnumerable<Order>> ByCustomer =
        EF.CompileAsyncQuery((AppDbContext db, int customerId) =>
            db.Orders.Where(o => o.CustomerId == customerId));
}

var order = await Queries.OrderById(db, 42);
await foreach (var o in Queries.ByCustomer(db, 7)) { /* ... */ }
```

**Что экономится.** Даже без компиляции EF Core кэширует переводы запросов. Но на каждый
вызов обычного запроса он:

1. строит expression tree (аллокации при каждом вызове метода);
2. извлекает параметры из замыканий;
3. вычисляет хэш и сравнивает дерево с закэшированными (это тоже обход дерева);
4. достаёт готовый executor.

Compiled query пропускает шаги 1–3. Выигрыш — микросекунды и аллокации на вызов, а не
время в базе.

**Ограничения:**

- лямбда — фиксированная форма запроса: динамически добавлять `Where` по условию нельзя;
- параметры передаются только аргументами делегата; захват внешних переменных
  внутри не параметризуется;
- число параметров ограничено перегрузками (для больших наборов — передать объект или
  коллекцию);
- результат — `Task<T>` для одиночного значения и `IAsyncEnumerable<T>` для
  последовательности; `ToListAsync()` внутри лямбды не пишется.

**Не путать с compiled model.** `dotnet ef dbcontext optimize` генерирует код
модели, чтобы ускорить старт приложения на больших моделях (сотни сущностей). Compiled
query ускоряет выполнение конкретного запроса. А в EF 9 появились экспериментальные
precompiled queries для NativeAOT: трансляция запросов на этапе сборки.

## Когда compiled queries полезны?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kogda-compiled-queries-polezny
tags: orm
```

Compiled queries полезны на **горячем пути**: один и тот же запрос фиксированной формы вызывается тысячи раз в секунду, сам SQL быстрый (поиск по ключу, короткая выборка по индексу), и накладные расходы EF на подготовку запроса становятся заметной долей общего времени. Во всех остальных случаях выигрыш теряется на фоне сетевого round-trip и работы базы.

**Откуда берётся выигрыш.** EF Core и без компиляции кэширует перевод LINQ → SQL. Но на каждый вызов он заново строит expression tree, извлекает параметры из замыканий и сравнивает дерево с ключами кэша. На простом запросе это единицы–десятки микросекунд и несколько килобайт аллокаций. Запрос по первичному ключу в PostgreSQL в той же сети занимает порядка сотен микросекунд, поэтому доля EF может достигать десятков процентов — и именно её убирает `EF.CompileAsyncQuery`.

**Хорошие кандидаты:**

- чтение по ключу/уникальному индексу в высоконагруженных API (`GetUserById`, `GetProductBySku`);
- проверка прав, feature flags, справочники — запросы, выполняемые на каждый HTTP-запрос;
- обработчики сообщений, где на одно сообщение приходится несколько однотипных запросов;
- бенчмарк показал, что узкое место — CPU и аллокации приложения, а не база.

```csharp
private static readonly Func<AppDbContext, string, CancellationToken, Task<ProductDto?>> BySku =
    EF.CompileAsyncQuery((AppDbContext db, string sku, CancellationToken ct) =>
        db.Products
          .Where(p => p.Sku == sku)
          .Select(p => new ProductDto(p.Id, p.Name, p.Price))
          .FirstOrDefault());

var dto = await BySku(db, sku, ct);
```

**Когда не нужны или мешают:**

- **динамические запросы** — фильтры, сортировка и пагинация, собираемые по условиям. Форма запроса в compiled query фиксирована; пришлось бы плодить десятки вариантов;
- **тяжёлые запросы** — отчёт на 200 мс в базе не ускорится от экономии 20 мкс;
- **редкие запросы** — админка, фоновые задачи раз в минуту;
- **ранняя оптимизация** — код становится менее читаемым (статические поля-делегаты, отдельный класс запросов), а эффект не измерен.

**Как принимать решение.** Замерить BenchmarkDotNet с `[MemoryDiagnoser]` обычный и скомпилированный вариант на реальном запросе и посмотреть на профиль продакшена: если CPU приложения упирается в `QueryCompiler`/построение выражений, компиляция оправдана. Обычно ускорение на простых запросах — десятки процентов по времени на стороне приложения, но не по latency запроса целиком.

**Что сделать до compiled queries** — это даёт больше:

- `AsNoTracking()` или проекция в DTO вместо загрузки сущностей;
- `AddDbContextPool` — меньше затрат на создание контекста;
- убрать N+1 и лишние `Include`;
- compiled model (`dotnet ef dbcontext optimize`), если медленный именно старт на большой модели.

**Подводные камни:** делегат должен быть `static readonly` — компиляция на каждый вызов бессмысленна; все переменные передаются параметрами делегата; внутри нельзя вызывать `ToListAsync()` — последовательность возвращается как `IAsyncEnumerable<T>`.

## Что такое raw SQL в EF Core?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-raw-sql-v-ef-core
tags: orm
```

Raw SQL в EF Core — возможность написать SQL руками, но получить результат через EF: как сущности (`FromSql`), как произвольные типы (`Database.SqlQuery<T>`) или просто выполнить команду (`Database.ExecuteSql`). Нужен, когда LINQ не выражает запрос или генерирует неэффективный SQL, а переходить на Dapper ради одного места не хочется.

**Основные API (EF Core 8+):**

| Метод | Что делает |
| --- | --- |
| `DbSet<T>.FromSql($"...")` | запрос, возвращающий сущности `T`; интерполяция превращается в параметры |
| `FromSqlRaw("... {0}", arg)` | то же со строкой и позиционными параметрами — для динамически собранного SQL |
| `Database.SqlQuery<T>($"...")` | скаляры (EF 7) и произвольные немаппленные типы (EF 8) |
| `Database.ExecuteSql($"...")` / `ExecuteSqlAsync` | `UPDATE`/`DELETE`/DDL, возвращает число строк |
| `ExecuteSqlRaw` | то же для строки с параметрами |

```csharp
// Интерполяция — НЕ конкатенация: {minPrice} становится параметром @p0
var products = await db.Products
    .FromSql($"SELECT * FROM products WHERE price > {minPrice}")
    .Where(p => p.IsActive)          // композиция с LINQ
    .OrderBy(p => p.Name)
    .ToListAsync();
```

```sql
-- Npgsql (snake_case-имена): исходный SQL оборачивается в подзапрос
SELECT p.id, p.name, p.price, p.is_active
FROM (SELECT * FROM products WHERE price > @p0) AS p
WHERE p.is_active
ORDER BY p.name
```

**Как это устроено.** `FromSql` принимает `FormattableString`: EF видит отдельно шаблон и аргументы и превращает каждый аргумент в `DbParameter`. Поэтому `FromSql($"... {x}")` безопасен, а `FromSqlRaw($"... {x}")` — SQL-инъекция: там интерполяция выполняется до вызова, и в метод приходит готовая строка.

**Правила для `FromSql`:**

- SQL должен вернуть **все колонки** сущности с именами, совпадающими с маппингом (включая owned-типы); лишние колонки игнорируются;
- композиция (`Where`, `Include`, `OrderBy`) работает, только если SQL можно обернуть в подзапрос, — обычный `SELECT` или `WITH`. Вызов хранимой процедуры или `UPDATE ... RETURNING` так не оборачиваются: после них сразу `AsAsyncEnumerable()`/`ToListAsync()`, дальнейший LINQ — уже в памяти;
- результат по умолчанию **трекается**, как обычный запрос; для чтения — `AsNoTracking()`;
- имена таблиц и колонок параметризовать нельзя — только значения.

**`SqlQuery<T>` для DTO и скаляров:**

```csharp
var stats = await db.Database
    .SqlQuery<CategoryStat>($"""
        SELECT category_id AS "CategoryId", count(*) AS "Count"
        FROM products GROUP BY category_id
        """)
    .ToListAsync();

// Скаляр с композицией: колонка должна называться Value
var ids = await db.Database
    .SqlQuery<int>($"SELECT id AS \"Value\" FROM products")
    .Where(id => id > 100)
    .ToListAsync();
```

**Когда применять:** оконные функции, рекурсивные CTE, `LATERAL`, полнотекстовый поиск и специфичные для PostgreSQL конструкции, хинты, вызов функций БД, точечная оптимизация проблемного запроса. Для массовых `UPDATE`/`DELETE` сначала стоит посмотреть на `ExecuteUpdateAsync`/`ExecuteDeleteAsync` (EF 7+) — они типобезопасны и не требуют SQL.

**Минусы:** SQL не проверяется компилятором и ломается при переименовании колонок без ошибки сборки, привязывает код к конкретной СУБД. Держите такие запросы в одном месте и покрывайте интеграционными тестами на реальной базе (Testcontainers).

## Когда использовать Dapper вместо EF Core?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kogda-ispolzovat-dapper-vmesto-ef-core
tags: orm
```

Dapper берут там, где SQL важнее модели: сложные отчёты и аналитика, запросы, которые LINQ не выражает или переводит плохо, горячие read-пути с жёсткими требованиями к latency, работа с чужой или legacy-схемой и хранимыми процедурами. Для обычного CRUD с бизнес-логикой и изменением агрегатов EF Core остаётся удобнее. Частый зрелый вариант — **оба в одном проекте**: EF для записи, Dapper для тяжёлого чтения.

**Сигналы в пользу Dapper:**

- **Сложный SQL**: оконные функции, рекурсивные CTE, `LATERAL`, `GROUPING SETS`, `DISTINCT ON`, полнотекстовый поиск. В EF это либо невозможно, либо превращается в `FromSql` — а тогда проще сразу Dapper.
- **Отчёты и read-модели (CQRS query side)**: результат — плоские DTO, change tracking и навигации не нужны.
- **Производительность на горячем пути.** Dapper — тонкая обёртка над ADO.NET с кэшированным материализатором: почти нулевой оверхед сверх драйвера. EF Core 8+ с `AsNoTracking` и проекциями очень близок, но добавляет трансляцию запроса и больше аллокаций. Разница заметна на тысячах RPS, а не на обычном API.
- **Нет контроля над схемой**: legacy-база, хранимые процедуры, представления, несколько схем с неочевидными связями — маппить это в модель EF дороже, чем писать SQL.
- **Полный контроль над SQL** — команда хорошо знает PostgreSQL и хочет видеть в коде ровно тот запрос, что попадёт в `EXPLAIN`.

**Сигналы остаться на EF Core:**

- богатая доменная модель, агрегаты с вложенными коллекциями, которые меняются и сохраняются вместе;
- много CRUD — ручной SQL для каждой вставки и обновления означает много однотипного кода и ошибок;
- нужны миграции, optimistic concurrency, глобальные фильтры (soft delete, multi-tenancy), interceptors;
- рефакторинг: переименование свойства в EF ловится компилятором, в строке SQL — только тестами.

**Совместное использование** — общее соединение и транзакция:

```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);

db.Orders.Add(order);
await db.SaveChangesAsync(ct);

var conn = db.Database.GetDbConnection();            // то же NpgsqlConnection
var report = await conn.QueryAsync<OrderStat>(
    new CommandDefinition("""
        SELECT customer_id AS CustomerId, sum(total) AS Total
        FROM orders WHERE created_at >= @from
        GROUP BY customer_id
        """,
        new { from = since },
        transaction: tx.GetDbTransaction(),          // обязательно передать транзакцию
        cancellationToken: ct));

await tx.CommitAsync(ct);
```

В PostgreSQL транзакция — состояние соединения, поэтому Npgsql выполнит команду в ней даже без явной передачи; SqlClient в такой ситуации бросает исключение. Явная передача `transaction` делает код переносимым и намерение очевидным. Имена колонок без кавычек PostgreSQL приводит к нижнему регистру (`customerid`), но Dapper сопоставляет их со свойствами без учёта регистра.

**Как выбрать на собеседовании:** не «Dapper быстрее, значит лучше», а «EF по умолчанию, Dapper для запросов, где SQL — главная ценность, или где профилирование показало оверхед ORM». И упомянуть, что до перехода на Dapper стоит проверить `AsNoTracking`, проекцию, compiled query и `FromSql`/`SqlQuery<T>` — часто этого хватает.

## Плюсы и минусы EF Core?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-plyusy-i-minusy-ef-core
tags: orm
```

EF Core даёт высокую продуктивность: типобезопасные LINQ-запросы, change tracking, миграции и Unit of Work из коробки. Цена — абстракция, которая может генерировать неожиданный SQL, требует понимания своих механизмов (трекинг, загрузка связей, момент выполнения запроса) и добавляет накладные расходы по сравнению с ручным SQL.

**Плюсы:**

- **LINQ и типобезопасность.** Запросы проверяются компилятором, переименование свойства — обычный рефакторинг, а не поиск по строкам SQL.
- **Change tracking и Unit of Work.** Загрузили агрегат, поменяли объекты, вызвали `SaveChangesAsync` — EF сам вычислит `INSERT`/`UPDATE`/`DELETE`, упорядочит их по зависимостям и выполнит в одной транзакции пакетом.
- **Миграции** — схема версионируется вместе с кодом, генерируются SQL-скрипты или идемпотентные бандлы для CI/CD.
- **Моделирование:** owned types, value converters, наследование (TPH/TPT/TPC), complex types (EF 8), JSON-колонки (`ToJson`, в Npgsql — `jsonb`), глобальные фильтры запросов для soft delete и multi-tenancy.
- **Optimistic concurrency** через concurrency token (в PostgreSQL удобно — системная колонка `xmin`).
- **Расширяемость:** interceptors, логирование SQL, `TagWith`, метрики и трассировка через `System.Diagnostics`.
- **Производительность стала хорошей.** С `AsNoTracking`, проекциями, пулингом контекстов, `ExecuteUpdate`/`ExecuteDelete` (EF 7+) и compiled queries разрыв с Dapper на типичных запросах небольшой.
- **Провайдеры**: PostgreSQL (Npgsql), SQL Server, SQLite, MySQL, Cosmos DB — хотя «сменить СУБД без изменений кода» на практике всё равно не получится.

**Минусы:**

- **Протекающая абстракция.** Нужно понимать, какой SQL получится: N+1 при lazy loading, картезианский взрыв при нескольких `Include` коллекций, клиентская оценка, неиндексируемые условия.
- **Сложный SQL выражается плохо.** Оконные функции, рекурсивные CTE, `LATERAL`, специфичные конструкции PostgreSQL — через `FromSql` или отдельный инструмент.
- **Оверхед** трансляции запросов, материализации и трекинга — CPU и аллокации на горячих путях. Трекинг тысяч сущностей в долгоживущем контексте замедляет `DetectChanges`.
- **Неочевидное поведение**: момент выполнения `IQueryable`, отложенные изменения до `SaveChanges`, трекинг одной сущности дважды (`InvalidOperationException` при attach дубля), `DbContext` не потокобезопасен.
- **Массовые операции.** Вставка сотен тысяч строк через `AddRange` медленнее, чем `COPY` (в Npgsql — `BeginBinaryImport`) или сторонние bulk-библиотеки.
- **Миграции в команде** — конфликты снапшота модели при параллельных ветках, осторожность с деструктивными изменениями на больших таблицах.
- **Порог входа.** Чтобы использовать EF хорошо, нужно знать и EF, и SQL; «ORM, чтобы не знать SQL» не работает.

**Итог:** EF Core — разумный выбор по умолчанию для бизнес-приложений с доменной моделью и CRUD. Смотрите SQL в логах, используйте проекции для чтения, а для отчётов и узких мест не стесняйтесь `FromSql`/`SqlQuery<T>` или Dapper рядом с EF.

## Плюсы и минусы Dapper?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-plyusy-i-minusy-dapper
tags: orm
```

Dapper — micro-ORM: набор extension-методов над `IDbConnection`, которые выполняют ваш SQL и быстро маппят результат в объекты. Плюсы — полный контроль над SQL, минимальный оверхед и простота. Минусы — всё, что EF делает за вас (трекинг изменений, генерация `INSERT`/`UPDATE`, миграции, связи), придётся писать и поддерживать самому.

```csharp
await using var conn = dataSource.CreateConnection();   // NpgsqlDataSource
var orders = await conn.QueryAsync<OrderDto>(
    "SELECT id, total, created_at AS CreatedAt FROM orders WHERE customer_id = @customerId",
    new { customerId });
```

**Плюсы:**

- **Производительность.** Материализатор генерируется через IL один раз на комбинацию «SQL + тип результата» и кэшируется; дальше скорость почти как у ручного `DbDataReader`. Нет трансляции LINQ и change tracking.
- **Прозрачность.** В коде ровно тот SQL, который выполнится: легко вставить в `EXPLAIN ANALYZE`, обсудить с DBA, оптимизировать.
- **Вся мощь СУБД** — CTE, оконные функции, `jsonb`-операторы, хранимые функции, `RETURNING`, `ON CONFLICT` — без ограничений LINQ-провайдера.
- **Простота.** Нет контекста с жизненным циклом, нет скрытых запросов и lazy loading; поведение предсказуемо.
- **Удобные возможности:** multi-mapping (`splitOn`) для join-ов в граф объектов, `QueryMultiple` для нескольких результатов за один round-trip, `DynamicParameters`, `CommandDefinition` с `CancellationToken`, развёртывание списков в `IN`.
- **Хорошо уживается с EF Core** на одном соединении и в одной транзакции.

**Минусы:**

- **SQL в строках.** Ошибка в имени колонки или переименование в схеме обнаруживаются только в рантайме — нужны интеграционные тесты на реальной базе.
- **Нет change tracking и Unit of Work.** Каждый `INSERT`/`UPDATE` пишется руками, транзакции и порядок операций — ваша ответственность. Для сложных агрегатов это много кода.
- **Нет миграций** — нужен отдельный инструмент (DbUp, FluentMigrator, Flyway или миграции EF).
- **Связи вручную.** Загрузка «заказ + строки» — либо multi-mapping с дедупликацией родителей через словарь, либо два запроса и склейка в памяти.
- **Маппинг по именам.** Без настройки snake_case-колонки не совпадают со свойствами — нужны алиасы в SQL или `DefaultTypeMap.MatchNamesWithUnderscores = true`.
- **Динамические запросы** (фильтры по условиям) собираются строками — легко получить SQL-инъекцию или нечитаемый код; помогают `Dapper.SqlBuilder` и строгий whitelist для имён колонок.
- **Привязка к СУБД** — SQL-диалект зашит в код.

**Кэш запросов — неочевидный момент.** Dapper кэширует метаданные по тексту SQL. Если генерировать уникальный текст на каждый вызов (например, подставлять значения в строку), кэш забивается одноразовыми записями, растёт расход памяти и CPU на генерацию материализаторов, а на стороне PostgreSQL не переиспользуются планы — ещё одна причина всегда использовать параметры.

**Где Dapper уместен:** read-side в CQRS, отчёты, высоконагруженные эндпоинты чтения, legacy-схемы и хранимые процедуры, небольшие сервисы с простым доступом к данным.

## Как избежать SQL injection при использовании Dapper?

```yaml
category: ef-core
level: middle
difficulty: 4
slug: ef-core-kak-izbezhat-sql-injection-pri-ispolzovanii-dapper
tags: dependency-injection, orm
```

Правило одно: **значения — только через параметры** (`@name` в SQL + объект с параметрами), никогда через конкатенацию или интерполяцию строки. Параметр уходит в PostgreSQL отдельно от текста запроса, поэтому не может изменить его структуру. А то, что параметром быть не может (имена колонок, направление сортировки), выбирается из белого списка в коде.

```csharp
// Уязвимо: $"..." у Dapper — это обычная string, значение вклеивается в SQL
var bad = await conn.QueryAsync<User>($"SELECT * FROM users WHERE email = '{email}'");

// Безопасно: @email — параметр, значение передаётся отдельно
var user = await conn.QuerySingleOrDefaultAsync<User>(
    "SELECT id, email, name FROM users WHERE email = @email",
    new { email });
```

**Главная ловушка — интерполяция.** В EF Core `FromSql($"...")` принимает `FormattableString` и превращает аргументы в параметры. Dapper так не умеет: `QueryAsync($"... {x}")` получает уже склеенную строку. Код выглядит одинаково, поведение противоположное — на ревью это стоит проверять специально.

**Частые случаи и как их делать правильно:**

- **Списки.** С Npgsql Dapper передаёт массив одним параметром-массивом PostgreSQL, поэтому пишут `= ANY(@ids)`:

  ```csharp
  var rows = await conn.QueryAsync<Order>(
      "SELECT * FROM orders WHERE id = ANY(@ids)", new { ids = idArray });
  ```

  Для других провайдеров Dapper разворачивает `IN @ids` в `IN (@ids1, @ids2, …)` — тоже параметры.

- **LIKE/ILIKE.** Шаблон собирается в C#, но передаётся параметром; спецсимволы `%`, `_` и `\` экранируются, иначе пользователь управляет шаблоном (это не инъекция, но может дать полный перебор таблицы):

  ```csharp
  var escaped = term.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_");
  await conn.QueryAsync<Product>(
      "SELECT * FROM products WHERE name ILIKE @pattern", new { pattern = $"%{escaped}%" });
  ```

- **Динамическая сортировка и имена колонок** — параметризовать нельзя, поэтому только whitelist:

  ```csharp
  var sortColumns = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
  {
      ["name"] = "name", ["price"] = "price", ["created"] = "created_at",
  };
  if (!sortColumns.TryGetValue(request.SortBy, out var column)) column = "created_at";
  var dir = request.Desc ? "DESC" : "ASC";
  var sql = $"SELECT * FROM products ORDER BY {column} {dir} LIMIT @take";
  ```

  В строку попадают только константы из кода, пользовательский ввод — лишь ключ словаря.

- **Динамические фильтры** — собирать текст из фиксированных фрагментов, а значения класть в `DynamicParameters`; для этого есть пакет `Dapper.SqlBuilder` (`/**where**/`-шаблоны).

- **Хранимые функции** тоже бывают уязвимы: динамический SQL внутри PL/pgSQL (`EXECUTE 'SELECT ... ' || arg`) — это та же конкатенация. Там используют `EXECUTE ... USING` для значений и `format('%I', name)` для идентификаторов.

**Дополнительные слои защиты:**

- у пользователя БД приложения — минимальные права: без DDL, без доступа к чужим схемам, отдельная роль только на чтение для отчётов;
- анализатор CA2100 и правила ревью: любой `$"` или `+` рядом с `Query`/`Execute` — повод остановиться;
- не показывать клиенту тексты ошибок БД — они помогают атакующему подбирать запрос;
- валидация входа (тип, длина, формат) — полезна, но **не заменяет** параметры.

**Бонус параметризации** — производительность: текст запроса одинаков для всех значений, поэтому Dapper переиспользует кэш материализатора, а PostgreSQL — подготовленные планы.

## Что такое Unit of Work?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-unit-of-work
tags: orm
```

Unit of Work — паттерн (Мартин Фаулер, PoEAA), который отслеживает все изменения объектов в рамках одной бизнес-операции и применяет их к базе **одной атомарной операцией** в конце. В EF Core эту роль уже играет `DbContext`: он копит изменения в change tracker, а `SaveChangesAsync()` записывает их в одной транзакции.

```csharp
var order = await db.Orders.Include(o => o.Lines).FirstAsync(o => o.Id == id, ct);
order.AddLine(productId, qty);                 // изменение в памяти
var stock = await db.Stock.FirstAsync(s => s.ProductId == productId, ct);
stock.Reserve(qty);                            // ещё одно изменение
db.OutboxMessages.Add(OutboxMessage.From(new OrderChanged(order.Id)));

await db.SaveChangesAsync(ct);                 // INSERT + UPDATE + INSERT в одной транзакции
```

**Что делает Unit of Work:**

- **регистрирует изменения** — новые, изменённые и удалённые объекты (в EF — состояния `Added`, `Modified`, `Deleted`);
- **откладывает запись** до момента коммита, а не пишет в базу на каждое присваивание;
- **упорядочивает операции** с учётом внешних ключей (сначала родитель, потом дети) и отправляет их пакетом;
- **гарантирует атомарность** — либо сохраняется всё, либо ничего.

**Зачем это нужно:** бизнес-операция затрагивает несколько объектов, и частичное сохранение оставило бы данные в неконсистентном состоянии. Классический пример выше — строка заказа, резерв на складе и outbox-сообщение должны появиться вместе.

**Отдельный интерфейс поверх `DbContext`** иногда вводят, чтобы слой приложения не зависел от EF:

```csharp
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public sealed class AppDbContext(DbContextOptions<AppDbContext> o) : DbContext(o), IUnitOfWork;
```

Это полезно в Clean Architecture, когда handler работает с репозиториями и в конце вызывает `unitOfWork.SaveChangesAsync()`. Писать собственный UoW с `Commit`/`Rollback` и кучей репозиториев-свойств обычно избыточно — это обёртка над уже существующим паттерном.

**Практические нюансы:**

- **Границы UoW = время жизни контекста.** В ASP.NET Core `DbContext` регистрируется как scoped — один UoW на HTTP-запрос. Долгоживущий контекст копит тысячи отслеживаемых сущностей и устаревшие данные.
- **Один `SaveChanges` на операцию.** Несколько вызовов подряд — это уже несколько транзакций; если нужна атомарность между ними, открывают явную транзакцию `BeginTransactionAsync`.
- **Границы UoW не выходят за пределы базы.** Отправка сообщения в брокер или HTTP-вызов в ту же транзакцию не попадут — для этого outbox.
- **`ExecuteUpdate`/`ExecuteDelete` и raw SQL выполняются сразу**, минуя change tracker, — они не часть отложенного UoW и не откатятся, если следующий `SaveChanges` упадёт, без общей явной транзакции.

## Нужен ли Repository Pattern поверх EF Core?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-nuzhen-li-repository-pattern-poverh-ef-core
tags: orm
```

Обязательно — нет: `DbSet<T>` уже является репозиторием, а `DbContext` — Unit of Work, и **generic-репозиторий** (`IRepository<T>` с `GetById/Add/Update/Delete`) поверх них обычно только теряет возможности EF. Но **специализированный репозиторий агрегата** в DDD-стиле бывает оправдан: он задаёт границы агрегата и прячет детали загрузки. Ответ зависит от архитектуры и сложности домена.

**Почему generic-репозиторий — антипаттерн с EF Core:**

```csharp
public interface IRepository<T>
{
    Task<T?> GetByIdAsync(int id);
    Task<IEnumerable<T>> GetAllAsync();                        // всю таблицу в память?
    IQueryable<T> Query();                                     // абстракция протекла
    void Add(T entity);
}
```

- **Теряются возможности EF:** проекции, `Include`, `AsNoTracking`, `AsSplitQuery`, пагинация. Либо интерфейс раздувается до копии `IQueryable`, либо всё делается через `GetAllAsync()` и LINQ в памяти.
- **Возврат `IQueryable<T>`** формально скрывает EF, а по факту вызывающий код зависит от поведения LINQ-провайдера — абстракция декоративная.
- **Двойной UoW:** `repository.Save()` в каждом репозитории ломает атомарность операции, затрагивающей несколько сущностей.
- **«Чтобы можно было сменить ORM»** — на практике почти не случается, а если случается, переписывать приходится запросы, а не интерфейсы.

**Когда репозиторий уместен:**

- **DDD, репозиторий на агрегат.** `IOrderRepository` с методами `GetAsync(OrderId)` и `Add(Order)`. Он гарантирует, что агрегат загружается целиком (со строками заказа) и сохраняется только через корень. Это выражение доменной модели, а не обёртка над ORM.
- **Повторяющиеся сложные запросы** — именованный метод `GetOverdueInvoicesAsync(date)` читаемее, чем копия LINQ в пяти хендлерах. Альтернатива — extension-методы над `IQueryable<T>` или спецификации (Ardalis.Specification).
- **Слой приложения не должен ссылаться на EF** — строгая Clean Architecture с отдельным проектом Infrastructure.
- **Смешанный доступ к данным** — часть методов на EF, часть на Dapper или внешнем API, и потребителю неважно, откуда данные.

```csharp
public interface IOrderRepository
{
    Task<Order?> GetAsync(OrderId id, CancellationToken ct);
    void Add(Order order);
}

internal sealed class OrderRepository(AppDbContext db) : IOrderRepository
{
    public Task<Order?> GetAsync(OrderId id, CancellationToken ct) =>
        db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, ct);

    public void Add(Order order) => db.Orders.Add(order);
}
// Сохранение — через общий IUnitOfWork (сам DbContext), а не в репозитории
```

**Типичный прагматичный компромисс:** запись идёт через репозитории агрегатов, чтение (queries, отчёты, списки для UI) — напрямую через `DbContext` с проекциями в DTO или через Dapper. Это по сути CQRS без отдельной базы.

**Про тестируемость** — частый аргумент «за», но слабый. Мокать репозиторий удобно для юнит-тестов доменной логики, однако запросы всё равно нужно проверять на настоящей базе: InMemory-провайдер ведёт себя иначе, чем PostgreSQL (нет транзакций, ограничений, регистрозависимости). Интеграционные тесты на Testcontainers с реальным PostgreSQL полезнее, чем абстракции ради моков.

**Ответ на собеседовании:** «generic-репозиторий поверх EF не нужен; репозиторий агрегата — если используем DDD или хотим изолировать инфраструктуру; для чтения — прямой доступ к `DbContext`». Главное — аргументировать, а не повторять догму в любую сторону.

## Как оптимизировать медленный EF Core запрос?

```yaml
category: ef-core
level: middle
difficulty: 4
slug: ef-core-kak-optimizirovat-medlennyi-ef-core-zapros
tags: query-planning, orm
```

Сначала измерить и увидеть SQL, потом понять, где теряется время — в базе или в приложении, и только затем чинить. Типичные причины медленного EF-запроса: N+1, загрузка лишних данных (целые сущности с `Include` вместо проекции), отсутствие индекса или неиндексируемое условие, картезианский взрыв, фильтрация в памяти и лишний change tracking.

**Шаг 1. Увидеть SQL и время.**

```csharp
builder.Services.AddDbContext<AppDbContext>(o => o
    .UseNpgsql(cs)
    .LogTo(Console.WriteLine, LogLevel.Information)   // SQL + время выполнения
    .EnableSensitiveDataLogging());                   // значения параметров — только в dev

var query = db.Orders.Where(o => o.Status == Status.New).TagWith("Orders: new list");
Console.WriteLine(query.ToQueryString());             // SQL без выполнения
```

`TagWith` добавляет комментарий в SQL — по нему запрос находится в `pg_stat_statements` и логах PostgreSQL. В продакшене — OpenTelemetry-трассировка (пакет `Npgsql.OpenTelemetry` публикует спаны с текстом команды).

**Шаг 2. Где время — в базе или в приложении.** Если время команды в логе мало, а операция медленная — проблема в приложении: много запросов (N+1), материализация и трекинг тысяч сущностей. Если медленна сама команда — `EXPLAIN (ANALYZE, BUFFERS)` на этом SQL с реальными параметрами.

**Шаг 3. Типичные исправления.**

| Симптом | Исправление |
| --- | --- |
| десятки одинаковых запросов в логе | N+1 → `Include` или проекция с вложенной коллекцией; выключить lazy loading |
| `SELECT` всех колонок, `Include` ради пары полей | проекция `Select` в DTO — меньше данных и нет трекинга |
| чтение без изменений | `AsNoTracking()` (или `QueryTrackingBehavior.NoTracking` по умолчанию) |
| несколько `Include` коллекций, строк в ответе в разы больше | `AsSplitQuery()` — отдельный запрос на каждую коллекцию |
| `Seq Scan` в плане | индекс под фильтр и сортировку, составной в правильном порядке колонок |
| функция над колонкой: `o.Email.ToLower() == x` | индекс по выражению `lower(email)`, тип `citext` или `EF.Functions.ILike` + индекс `pg_trgm` для поиска подстроки |
| `Skip(100000).Take(20)` | keyset-пагинация: `Where(o => o.Id > lastId).OrderBy(o => o.Id).Take(20)` |
| `ToList()` до `Where`, `AsEnumerable()` посередине | вернуть фильтрацию в `IQueryable`, чтобы она ушла в SQL |
| массовое обновление в цикле с `SaveChanges` | `ExecuteUpdateAsync` / `ExecuteDeleteAsync` одной командой |
| `Count()` + выборка страницы, `Any()` через `Count() > 0` | `AnyAsync()`; подумать, нужен ли точный счётчик |

**Пример: проекция вместо `Include`.**

```csharp
// Было: заказы со всеми колонками, строками и клиентом, всё трекается
var orders = await db.Orders.Include(o => o.Lines).Include(o => o.Customer)
    .Where(o => o.CreatedAt >= from).ToListAsync(ct);

// Стало: только нужные поля, агрегат считается в базе
var rows = await db.Orders
    .Where(o => o.CreatedAt >= from)
    .OrderByDescending(o => o.CreatedAt)
    .Select(o => new OrderRow(o.Id, o.Customer.Name, o.Lines.Sum(l => l.Price * l.Qty)))
    .Take(50)
    .ToListAsync(ct);
```

```sql
-- примерно такой SQL генерирует Npgsql (snake_case-имена)
SELECT o.id, c.name, (
    SELECT COALESCE(sum(l.price * l.qty), 0.0)
    FROM order_lines AS l WHERE o.id = l.order_id)
FROM orders AS o
INNER JOIN customers AS c ON o.customer_id = c.id
WHERE o.created_at >= @from
ORDER BY o.created_at DESC
LIMIT @p
```

И индекс `orders (created_at DESC)` плюс индекс по `order_lines (order_id)` — PostgreSQL не создаёт индексы на внешние ключи сам, их создаёт EF-миграция по соглашению.

**Шаг 4. Оптимизации на стороне приложения** — когда SQL уже хорош, а CPU и аллокации заметны: `AddDbContextPool`, compiled queries для горячих запросов, стриминг через `AsAsyncEnumerable()` вместо `ToListAsync()` для больших выборок, `SqlQuery<T>`/`FromSql` или Dapper для запросов, которые LINQ переводит неоптимально.

**Подводные камни:** оптимизируйте по плану на данных продакшен-объёма — на десяти строках в dev любой запрос быстрый; после изменения проверьте, что ускорение подтверждается метриками, а не ощущениями; не включайте `EnableSensitiveDataLogging` в продакшене.
