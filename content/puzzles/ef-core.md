# Задачи: EF Core

## Отчёт по заказам

```yaml
slug: ef-core-n-plus-1-lazy-loading
category: ef-core
level: middle
kind: bug
difficulty: 3
```

В чём проблема этого кода? В контексте включён `UseLazyLoadingProxies()`, навигационные свойства `virtual`.

```csharp
var orders = await db.Orders
    .Where(o => o.CreatedAt >= from)
    .ToListAsync();

var lines = orders
    .Select(o => $"{o.Id}: {o.Customer.Name}, позиций: {o.Items.Count}")
    .ToList();
```

### Варианты

- [ ] `o.Customer` будет `null`, потому что связанные данные не загружены через `Include`
- [x] N+1: на каждый заказ выполняются отдельные запросы за `Customer` и `Items` — при 1000 заказов это ~2000 лишних обращений к базе
- [ ] `Select` выполнится на стороне базы, а интерполяцию строк EF Core перевести в SQL не сможет — будет исключение
- [ ] `Items.Count` загрузит только количество через `COUNT(*)`, проблемы нет

### Разбор

`ToListAsync()` выполняет один запрос за заказами, и дальше `Select` работает уже в памяти. Каждое обращение к `o.Customer` и `o.Items` через lazy-loading прокси незаметно идёт в базу отдельным запросом. Итого 1 + 2N запросов, каждый со своим сетевым раундтрипом: на локальной базе с десятком строк этого не видно, на проде с тысячами заказов страница грузится секундами. `Items.Count` при этом загружает всю коллекцию позиций целиком, а не делает `COUNT(*)`.

Без lazy loading код не упал бы, а тихо выдал бы неверный результат: `Customer` был бы `null` (NRE), а `Items` — пустой коллекцией или тоже `null`, в зависимости от того, инициализирована ли она в классе. Поэтому lazy loading в EF Core выключен по умолчанию и требует явного подключения.

Исправление — загрузить всё одним запросом. Лучше всего проекцией: `db.Orders.Where(...).Select(o => new { o.Id, CustomerName = o.Customer.Name, ItemCount = o.Items.Count() })` — EF Core построит JOIN и подзапрос с `COUNT`, и вытянет только нужные колонки. Либо `Include(o => o.Customer).Include(o => o.Items)`, если нужны сами сущности (при нескольких коллекциях стоит подумать об `AsSplitQuery()`). Найти N+1 помогает логирование SQL (`LogTo`, уровень `Microsoft.EntityFrameworkCore.Database.Command`) или MiniProfiler.

## Репозиторий с IEnumerable

```yaml
slug: ef-core-ienumerable-vmesto-iqueryable
category: ef-core
level: middle
kind: bug
difficulty: 3
```

В чём проблема этого кода?

```csharp
var recent = repository.GetAll()
    .Where(o => o.CreatedAt > DateTime.UtcNow.AddDays(-1))
    .OrderByDescending(o => o.CreatedAt)
    .Take(10)
    .ToList();

public class OrderRepository(AppDbContext db)
{
    public IEnumerable<Order> GetAll() => db.Orders;
}
```

### Варианты

- [x] `Where`, `OrderByDescending` и `Take` вызываются из `Enumerable`, а не `Queryable`: из базы читается вся таблица заказов, фильтрация идёт в памяти
- [ ] `DateTime.UtcNow` нельзя использовать в LINQ-запросе — EF Core бросит исключение трансляции
- [ ] `db.Orders` выполнит запрос сразу при вызове `GetAll()`, ещё до `Where`
- [ ] Проблемы нет: EF Core увидит, что за `IEnumerable` скрывается `DbSet`, и транслирует всё в SQL

### Разбор

`DbSet<Order>` реализует и `IQueryable<Order>`, и `IEnumerable<Order>`. Какая перегрузка `Where` будет вызвана, решает **статический тип** выражения. Здесь метод возвращает `IEnumerable<Order>`, поэтому компилятор выбирает `Enumerable.Where` с делегатом `Func<Order, bool>`, а не `Queryable.Where` с деревом выражений. EF Core не видит фильтр вообще: при `ToList()` он выполняет `SELECT * FROM orders` без условий, все строки материализуются (и попадают в change tracker), а фильтр, сортировка и `Take(10)` отрабатывают в памяти приложения.

Ошибки нет, тесты на маленькой базе проходят, но при миллионе заказов запрос тянет всю таблицу. Это одна из самых частых причин «внезапно медленных» эндпоинтов.

Исправление — возвращать `IQueryable<Order>` (или вообще не прятать `DbSet` за таким репозиторием), либо принимать условия параметрами и строить запрос внутри: `GetRecent(DateTime since, int take)`. Проверить, какой SQL реально уходит в базу, можно через `query.ToQueryString()` или логирование команд.

## Изменение без SaveChanges

```yaml
slug: ef-core-trekking-povtornyj-zapros
category: ef-core
level: senior
kind: output
difficulty: 4
```

Что выведет код? В таблице `Users` одна строка: `Id = 1`, `Name = "Ann"`. Контекст только что создан, провайдер — реляционная база.

```csharp
var a = db.Users.First(u => u.Id == 1);
a.Name = "Bob";

var b = db.Users.AsNoTracking().First(u => u.Id == 1);
var c = db.Users.First(u => u.Id == 1);

Console.WriteLine($"{b.Name} {c.Name} {ReferenceEquals(a, c)}");
```

### Варианты

- [ ] `Ann Ann False`
- [ ] `Bob Bob True`
- [x] `Ann Bob True`
- [ ] `Ann Ann True`

### Разбор

Изменение `a.Name` живёт только в памяти: `SaveChanges` не вызывался, в базе по-прежнему `Ann`. Запрос с `AsNoTracking()` не смотрит в change tracker — он выполняет SQL и создаёт новый объект из данных базы, поэтому `b.Name == "Ann"`.

Обычный отслеживаемый запрос **тоже идёт в базу** и получает строку с `Ann`, но затем срабатывает identity resolution: сущность с таким ключом уже отслеживается контекстом, и EF Core возвращает существующий экземпляр, не перезаписывая его значениями из базы. Поэтому `c` — это тот же объект `a` с несохранённым `Bob`. `Find(1)` вёл бы себя так же по результату, но вообще не ходил бы в базу — он сначала ищет сущность в трекере.

Практические следствия: внутри одного долгоживущего контекста повторный запрос не «обновляет» данные, изменённые другим процессом, — для этого нужен `Reload()`, новый контекст или `AsNoTracking()`. Поэтому `DbContext` делают короткоживущим (на запрос или на единицу работы).

## Регистрация контекста

```yaml
slug: ef-core-dbcontext-singleton
category: ef-core
level: junior
kind: bug
difficulty: 2
```

В чём проблема этого кода в веб-приложении?

```csharp
builder.Services.AddDbContext<AppDbContext>(
    o => o.UseNpgsql(builder.Configuration.GetConnectionString("Main")),
    ServiceLifetime.Singleton);
```

### Варианты

- [ ] Каждый запрос будет открывать новое соединение, и пул соединений Npgsql переполнится
- [ ] Ошибка при старте: `AddDbContext` не поддерживает время жизни `Singleton`
- [x] `DbContext` не потокобезопасен: параллельные запросы будут работать с одним экземпляром, а его change tracker будет бесконечно расти и отдавать устаревшие данные
- [ ] Миграции перестанут применяться, потому что design-time фабрика ожидает scoped-контекст

### Разбор

`DbContext` рассчитан на одну единицу работы и не поддерживает конкурентное использование. Когда он singleton, два параллельных HTTP-запроса обращаются к нему одновременно, и EF Core бросает `InvalidOperationException: A second operation was started on this context instance before a previous operation completed` — а в худшем случае повреждает внутреннее состояние, если гонку не удалось обнаружить.

Даже без параллелизма проблем много: change tracker накапливает каждую загруженную сущность за всё время жизни приложения (утечка памяти и замедление `SaveChanges`), отслеживаемые запросы возвращают закэшированные экземпляры вместо свежих данных из базы, а один неудачный `SaveChanges` оставляет в трекере «грязные» изменения, которые попадут в базу при следующем сохранении из совсем другого запроса.

Правильно — время жизни по умолчанию (`Scoped`, один контекст на HTTP-запрос). Если контекст нужен в singleton или фоновом сервисе, внедряют `IDbContextFactory<AppDbContext>` (`AddDbContextFactory`) и создают короткоживущий контекст на каждую операцию. Для снижения накладных расходов на создание есть `AddDbContextPool`.
