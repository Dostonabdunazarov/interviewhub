---
title: DbContext, пулинг и global query filters
slug: ef-dbcontext-pooling-i-query-filters
track: dotnet-backend
section: ef-core
level: middle
sortOrder: 9
summary: Что такое DbContext и DbSet, почему контекст живёт один запрос, как устроен пул AddDbContextPool и что он ломает, и где global query filters для soft delete и multi-tenancy подводят.
questions: ef-core-chto-takoe-entity-framework-core, ef-core-chto-takoe-dbset-t, ef-core-kak-ustroen-pul-dbcontext-i-chto-lomaetsya-pri-perehode-na-adddbcontextpool, ef-core-kakie-podvodnye-kamni-u-global-query-filters-pri-soft-delete-i-multi-tenancy
---

EF Core — ORM от Microsoft: отображает классы на таблицы, переводит LINQ в SQL, отслеживает изменения загруженных объектов и сохраняет их одним `SaveChanges()`. С конкретной СУБД он работает через провайдер: Npgsql для PostgreSQL, SqlServer, Sqlite. Центральный объект — `DbContext`, сессия работы с базой и unit of work: он держит соединение, change tracker и транзакцию, а на `SaveChanges` превращает накопленные изменения в команды.

Эта статья — про жизненный цикл контекста: сколько он живёт, как его переиспользует пул и почему два удобных механизма, пулинг и глобальные фильтры, вместе дают самую неприятную ошибку мультитенантного приложения — данные чужого тенанта в ответе.

## DbSet<T>: точка входа

`DbSet<T>` — набор сущностей одного типа внутри контекста. Он одновременно реализует `IQueryable<T>`, то есть служит корнем LINQ-запросов (см. `Трансляция IQueryable в SQL`), и даёт API регистрации изменений:

```csharp
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();
}

var order = await db.Orders.FindAsync(id);
db.Orders.Add(new Order { Total = 100 });
db.Orders.Remove(order!);
await db.SaveChangesAsync();
```

`DbSet` — не коллекция в памяти: `db.Orders.Count()` — это `SELECT COUNT(*)`. `Add` и `Remove` в базу ничего не пишут, только меняют состояние сущности в трекере на `Added` или `Deleted`; SQL уходит на `SaveChanges` (подробно — в статье `ChangeTracker`).

`FindAsync(id)` и `FirstOrDefaultAsync(o => o.Id == id)` различаются принципиально. `Find` работает только по первичному ключу и сначала смотрит в change tracker: если сущность уже загружена, запроса не будет вовсе. `FirstOrDefault` всегда идёт в базу, но умеет `Include`, `AsNoTracking` и произвольные условия. Для «достать по ключу и поменять» внутри одного контекста `Find` естественнее, для чтения с проекцией — запрос.

## Контекст живёт один запрос

`AddDbContext` регистрирует контекст как scoped: в ASP.NET Core один экземпляр на HTTP-запрос. Это не случайность, а следствие устройства. Трекер растёт с каждым отслеживаемым запросом, и долгоживущий контекст превращается в кэш с устаревшими данными и растущим `DetectChanges`. Контекст держит одну транзакцию и одно соединение на время операции, поэтому он **не потокобезопасен**: второй запрос, запущенный до завершения первого, падает с `InvalidOperationException` («A second operation was started on this context instance…»).

```csharp
var a = db.Orders.CountAsync();
var b = db.Customers.CountAsync();
await Task.WhenAll(a, b);
```

Этот код не распараллеливает запросы, а ломается. Параллельная работа — это отдельный контекст на ветку, обычно через `IDbContextFactory<T>`. Та же фабрика нужна в фоновых воркерах и Blazor Server, где естественного scope на запрос нет.

## Как устроен пул

`AddDbContextPool` не создаёт контекст на каждый scope, а берёт экземпляр из пула. Цикл такой:

1. Scope запрашивает контекст. Пул отдаёт свободный экземпляр или создаёт новый, если свободных нет.
2. Контекст используется как обычно.
3. На `Dispose` EF сбрасывает состояние контекста и его внутренних сервисов (`IResettableService`): очищается change tracker, закрывается соединение, откатываются к умолчаниям настройки вроде `QueryTrackingBehavior` и `AutoDetectChangesEnabled`.
4. Экземпляр возвращается в пул, если там меньше `poolSize` объектов (по умолчанию 1024 начиная с EF Core 6). Переполнение ничего не блокирует: лишние экземпляры просто создаются и уничтожаются.

Экономится создание контекста и инициализация его внутренних сервисов. Это видно на тысячах RPS с короткими запросами и почти не видно, когда запрос к базе идёт десятки миллисекунд: время уходит в трансляцию, сеть и материализацию. Решение о пуле стоит принимать по профилю, а не по умолчанию (см. `Как мерить: BenchmarkDotNet`). Пул контекстов не связан с пулом соединений Npgsql: возвращённый контекст соединение не держит (см. `Пул соединений и PgBouncer`).

## Что ломается при переходе на пул

Цена пула в том, что контекст перестаёт быть чистым объектом на запрос. Конструктор и `OnConfiguring` выполняются один раз на экземпляр, а не на каждую аренду.

- **Зависимости в конструкторе.** EF требует конструктор, принимающий только `DbContextOptions<T>`. Внедрить `ITenantProvider` или `ICurrentUser` нельзя: экземпляр переживает любой scope.
- **Собственные поля контекста.** `TenantId`, `CurrentUserId`, кэши — EF их не сбрасывает. Если значение выставляется не при каждой аренде, следующий запрос получит значение предыдущего.
- **`OnConfiguring` по данным запроса.** Выбор строки подключения по тенанту там отработает один раз.
- **Перехватчики со scoped-зависимостями.** Options пула строятся однократно из корневого провайдера, и перехватчик фактически становится singleton — классическая captive dependency.
- **Ссылки, пережившие scope.** Без пула контекст, захваченный фоновой задачей, бросит `ObjectDisposedException`. С пулом тот же объект к этому моменту может обслуживать чужой запрос, и ошибка превращается в порчу чужого трекера.

Рабочий обход — scoped-фабрика поверх пула, которая выставляет состояние на каждой аренде:

```csharp
builder.Services.AddPooledDbContextFactory<AppDbContext>(o => o.UseNpgsql(cs));
builder.Services.AddScoped<TenantDbContextFactory>();
builder.Services.AddScoped(sp => sp.GetRequiredService<TenantDbContextFactory>().CreateDbContext());

public sealed class TenantDbContextFactory(
    IDbContextFactory<AppDbContext> pooled, ITenantProvider tenant) : IDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext()
    {
        var db = pooled.CreateDbContext();
        db.TenantId = tenant.TenantId;
        return db;
    }
}
```

Контекст, созданный фабричной лямбдой, контейнер утилизирует сам в конце scope, и экземпляр вернётся в пул. Значение предыдущего запроса не утечёт, потому что присваивание происходит при каждой аренде.

## Global query filters

`HasQueryFilter` добавляет предикат ко всем LINQ-запросам к сущности, включая `Include`, `Find`, промахнувшийся мимо трекера, и `ExecuteUpdate`/`ExecuteDelete`. Типичные применения — soft delete и изоляция тенантов:

```csharp
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public Guid TenantId { get; set; }

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasQueryFilter(o => o.TenantId == TenantId && !o.IsDeleted);
        b.Entity<Order>().HasIndex(o => new { o.TenantId, o.CreatedAt });
    }
}
```

`IgnoreQueryFilters()` снимает фильтры для конкретного запроса — для админки или восстановления удалённого.

## Подводные камни фильтров

**Захват значения.** Модель строится один раз на тип контекста и кэшируется. Ссылку на член контекста (`TenantId` выше) EF превращает в параметр, который читается из текущего экземпляра. Если же в `OnModelCreating` захватить локальную переменную или сервис, в модель навсегда попадёт значение первого контекста, и все пользователи увидят данные первого тенанта. В тестах с одним тенантом это незаметно. С пулом добавляется второй риск: свойство корректно читается из экземпляра, но если его не выставили при аренде, там осталось значение прошлого запроса — поэтому фабрика из предыдущего раздела обязательна.

**Пропадающие родители и дети.** Пусть у `Order` обязательная связь с `Customer`, а на `Customer` стоит soft delete. `db.Orders.Include(o => o.Customer)` строит `INNER JOIN` к отфильтрованным клиентам, и заказы удалённых клиентов исчезают, хотя на заказах фильтра нет. EF предупреждает об этом в логе (`PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning`). Лечится согласованными фильтрами на обеих сторонах связи или опциональной навигацией.

**Всё или ничего.** До EF Core 10 у сущности один фильтр: повторный `HasQueryFilter` заменяет предыдущий, а `IgnoreQueryFilters()` снимает всё сразу. Экран «показать удалённые» начинает показывать и чужих тенантов, поэтому после такого вызова условие по тенанту дописывают вручную. В EF Core 10 появились именованные фильтры: `HasQueryFilter("SoftDelete", o => !o.IsDeleted)` и выборочное `IgnoreQueryFilters(["SoftDelete"])`.

**Запись фильтр не защищает.** `Add` с чужим `TenantId` или `Attach` с `Update` по известному ключу пройдут. Проставлять тенант на `Added`, запрещать его смену и превращать `Deleted` в `IsDeleted = true` должен `SaveChangesInterceptor`. Но `ExecuteDelete` перехватчик `SaveChanges` обходит: при soft delete массовое удаление станет физическим. Raw SQL через `Database.ExecuteSql` и Dapper фильтр тоже не видят.

**Индексы.** Фильтр добавляет `tenant_id = @t AND NOT is_deleted` в каждый запрос, поэтому `tenant_id` должен быть ведущей колонкой составных индексов. Уникальность при soft delete ломается — удалённый пользователь блокирует регистрацию с тем же email; решение — частичный уникальный индекс:

```csharp
b.Entity<User>().HasIndex(u => new { u.TenantId, u.Email })
    .IsUnique()
    .HasFilter("NOT is_deleted");
```

Для настоящей гарантии изоляции в PostgreSQL вторым рубежом добавляют Row-Level Security: фильтр EF остаётся удобством и защитой от забывчивости, а не границей безопасности.

## Что стоит ответить на собеседовании

`DbContext` — короткоживущий unit of work, scoped на запрос и не потокобезопасный; `DbSet<T>` — корень `IQueryable` и API для `Add`/`Remove`, где `Find` сначала ищет в трекере. `AddDbContextPool` переиспользует экземпляры: на `Dispose` EF сбрасывает трекер, соединение и настройки, но не ваши поля, а конструктор и `OnConfiguring` выполняются один раз. Global query filters через `HasQueryFilter` добавляют условие ко всем запросам и снимаются `IgnoreQueryFilters()`.

Сильный ответ свяжет обе темы: фильтр по тенанту должен ссылаться на свойство контекста, а не на захваченную переменную, и с пулом это свойство нужно выставлять при каждой аренде через scoped-фабрику над `AddPooledDbContextFactory`, иначе утечёт тенант прошлого запроса. Добавит, что фильтр на обязательной навигации теряет строки через `INNER JOIN`, не защищает запись и `ExecuteDelete`, требует индексов с `tenant_id` впереди и частичных уникальных индексов, а для жёсткой изоляции дополняется RLS. Про выигрыш пула скажет честно: он заметен только на высоком RPS с короткими запросами и проверяется замером.
