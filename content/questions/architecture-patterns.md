# Архитектура и паттерны

Вопросы категории `architecture-patterns` в формате импорта (`tools/questions.md`): 16 шт.

```bash
node tools/import-questions.mjs --file content/questions/architecture-patterns.md --dry-run
node tools/import-questions.mjs --file content/questions/architecture-patterns.md --url … --email … --update
```

---

## Где SOLID помогает, а где следование ему усложняет код без пользы?

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-gde-solid-pomogaet-a-gde-sledovanie-emu-uslozhnyaet-kod-bez-polzy
tags: solid, design
```

SOLID помогает там, где есть реальная изменчивость: несколько реализаций, разные причины изменений, граница с инфраструктурой, код, который часто меняют разные люди. Он вредит, когда принципы применяют превентивно — к коду, который не меняется и у которого одна реализация: тогда вместо гибкости получается косвенность, а читатель прыгает по пяти файлам, чтобы понять три строки логики.

**Где каждый принцип реально окупается и где нет:**

| Принцип | Окупается | Превращается в церемонию |
| --- | --- | --- |
| SRP | класс меняют по разным причинам разные команды (расчёт цены и формирование PDF) | «один метод — один класс», `OrderValidator`, `OrderValidatorFactory`, `OrderValidationResultMapper` для 20 строк |
| OCP | плагины, правила, провайдеры оплаты — новые варианты добавляются регулярно | расширяемость «на будущее» там, где за два года не появилось второго варианта |
| LSP | любая иерархия и любой интерфейс с несколькими реализациями | — нарушение LSP всегда баг, цены у него нет |
| ISP | клиенты используют разные подмножества большого интерфейса (read/write, admin/user) | интерфейс на каждый метод, композиция десятка мини-интерфейсов |
| DIP | бизнес-логика против БД, брокера, внешних API, времени и случайности | `IOrderMapper` с одной реализацией и без замены в тестах |

**Признаки, что SOLID применён без пользы:**

- интерфейс с единственной реализацией, который никогда не мокают и не подменяют (`IFoo` + `Foo` рядом, все члены 1:1);
- навигация «Go to implementation» требуется на каждом шаге, а реальная логика размазана по классам по 10 строк;
- изменение одного поля требует правки DTO, маппера, интерфейса, реализации, валидатора и фабрики;
- абстракции названы по паттернам (`Manager`, `Handler`, `Provider`), а не по смыслу предметной области;
- юнит-тесты проверяют, что один мок вызвал другой мок, и ломаются при любом рефакторинге.

**Где он действительно нужен:**

```csharp
public sealed class SubscriptionRenewal(
    ISubscriptionRepository subscriptions,
    IPaymentGateway payments,
    TimeProvider time)
{
    public async Task<RenewalResult> RenewAsync(SubscriptionId id, CancellationToken ct)
    {
        var subscription = await subscriptions.GetAsync(id, ct);
        if (!subscription.IsDueForRenewal(time.GetUtcNow()))
            return RenewalResult.NotDue;

        var charge = await payments.ChargeAsync(subscription.PaymentMethod, subscription.Price, ct);
        subscription.Renew(charge, time.GetUtcNow());
        await subscriptions.SaveAsync(subscription, ct);
        return RenewalResult.Renewed;
    }
}
```

Здесь абстракции стоят на настоящих швах: платёжный шлюз меняется и мокается в тестах, время подменяется через `TimeProvider`, хранилище — граница с инфраструктурой. А `Subscription.IsDueForRenewal` и `Renew` — обычные методы доменного объекта без интерфейсов: их тестируют напрямую.

**Как рассуждать на практике:**

- **Сначала простой код, потом абстракция по факту.** Правило трёх: абстрагировать при втором-третьем реальном варианте, а не при первом.
- **Абстракция по границе, а не по классу.** Интерфейсы нужны на стыке с внешним миром и между модулями, внутри модуля — редко.
- **Cohesion важнее количества классов.** SRP — про причины изменений, а не про размер. Класс на 300 строк с одной ответственностью лучше пяти по 60, которые всегда меняются вместе.
- **Стоимость отмены.** Ввести интерфейс в .NET-проекте позже — десять минут с IDE. Поддерживать лишнюю абстракцию годами дороже.

**Что спрашивают дальше:** чем SRP отличается от «маленьких классов», как OCP соотносится с YAGNI, приведите пример нарушения LSP в стандартной библиотеке .NET (`ReadOnlyCollection<T>` как `IList<T>` с исключением на `Add`, `Stream` с `CanSeek = false`).

## Как выглядит нарушение Liskov Substitution Principle на реальном примере?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kak-vyglyadit-narushenie-liskov-substitution-principle-na-realnom-prim
tags: solid, design
```

LSP нарушается, когда подтип формально реализует контракт базового типа, но ведёт себя иначе, чем вправе ожидать код, написанный против базы: усиливает предусловия, ослабляет постусловия, ломает инварианты или бросает исключения там, где база их не бросает. Внешний признак — проверки `if (x is Special)` или `try/catch NotSupportedException` в клиентском коде.

**Пример из реального сервиса.** Есть абстракция хранилища файлов, и все её используют для загрузки документов:

```csharp
public interface IFileStorage
{
    Task SaveAsync(string path, Stream content, CancellationToken ct);
    Task<Stream> OpenReadAsync(string path, CancellationToken ct);
    Task DeleteAsync(string path, CancellationToken ct);
}
```

Появляется архивное хранилище с WORM-политикой (write once, read many) для юридических документов:

```csharp
public sealed class ArchiveStorage(IWormBucket bucket) : IFileStorage
{
    public Task SaveAsync(string path, Stream content, CancellationToken ct) =>
        bucket.PutIfAbsentAsync(path, content, ct);
    public Task<Stream> OpenReadAsync(string path, CancellationToken ct) =>
        bucket.GetAsync(path, ct);
    public Task DeleteAsync(string path, CancellationToken ct) =>
        throw new NotSupportedException("Archive is immutable");
}
```

Всё компилируется. Через месяц фоновая задача очистки временных файлов, получающая `IFileStorage` из DI, начинает падать в проде, а `SaveAsync` по существующему пути тихо отказывает или создаёт версию вместо перезаписи. Код, написанный против интерфейса, оказался неверен для одной реализации — это и есть нарушение LSP.

**Классические формы нарушения:**

- **Усиленное предусловие.** База принимает любой `Stream`, наследник требует `CanSeek == true`. Сетевой поток на нём падает.
- **Ослабленное постусловие.** `Repository.SaveAsync` гарантирует, что после возврата данные сохранены, а кэширующая реализация откладывает запись и может её потерять.
- **Нарушенный инвариант.** Хрестоматийный `Square : Rectangle`: установка `Width` у квадрата меняет `Height`, и код, который ставит ширину 5 и высоту 4 и ожидает площадь 20, получает 16.
- **Новые исключения.** `NotImplementedException`/`NotSupportedException` в реализации метода интерфейса.
- **Изменённая семантика.** `IEnumerable<T>`, который можно перечислить только один раз (поток из БД), передан в метод, перечисляющий его дважды.
- **Побочные эффекты.** «Чтение», которое в одной реализации меняет состояние или делает сетевой вызов с задержкой в секунды.

**Примеры в .NET:** `ReadOnlyCollection<T>` реализует `IList<T>` и бросает `NotSupportedException` на `Add`; `Stream` закрывает часть проблемы флагами `CanSeek`/`CanWrite`, перекладывая проверку на клиента; массив, приведённый к `IList<T>`, тоже не поддерживает `Add`. Это осознанные компромиссы дизайна, но они показывают цену: клиент обязан знать, что проверять.

**Как исправить пример:**

```csharp
public interface IFileReader
{
    Task<Stream> OpenReadAsync(string path, CancellationToken ct);
}

public interface IFileStorage : IFileReader
{
    Task SaveAsync(string path, Stream content, CancellationToken ct);
    Task DeleteAsync(string path, CancellationToken ct);
}

public interface IArchive : IFileReader
{
    Task AppendAsync(string path, Stream content, CancellationToken ct);
}
```

Архив больше не притворяется обычным хранилищем, у операции записи честное имя и семантика «только добавить», а задача очистки физически не может получить архив. Это одновременно ISP: интерфейсы разделены по реальным возможностям.

**Как ловить заранее:** контрактные тесты — один набор тестов против интерфейса, который прогоняется для каждой реализации (абстрактный тестовый класс с наследниками на каждую реализацию). Если для реализации приходится отключать тесты, контракт ей не подходит.

**Что спрашивают дальше:** почему LSP — про поведение, а не про сигнатуры; как ковариантность и контравариантность (`out`/`in` в обобщениях) связаны с подстановкой; нарушает ли LSP декоратор, добавляющий таймаут (да, если база обещала не бросать `TimeoutException` и клиент к этому не готов).

## Что даёт Clean Architecture и какова цена её строгого соблюдения?

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-chto-daet-clean-architecture-i-kakova-cena-ee-strogogo-soblyudeniya
tags: clean-architecture, design
```

Clean Architecture даёт одно главное свойство: зависимости направлены внутрь, к бизнес-правилам, поэтому домен и сценарии использования не знают о веб-фреймворке, ORM и брокере и тестируются без них. Цена строгого соблюдения — много проектов, интерфейсов, DTO и маппингов, медленная разработка простых CRUD-фич и соблазн «чистоты ради чистоты», когда большая часть кода — перекладывание данных между слоями.

**Типичная раскладка в .NET:**

```text
src/
  Billing.Domain          сущности, value objects, доменные события, без зависимостей
  Billing.Application     use cases, порты (интерфейсы репозиториев, шлюзов), DTO
  Billing.Infrastructure  EF Core, Npgsql, Kafka, HTTP-клиенты — реализации портов
  Billing.Api             ASP.NET Core, composition root, маппинг HTTP ↔ команды
```

Правило зависимостей проверяется не на ревью, а автоматически: ссылки между проектами (Domain ни на что не ссылается) и архитектурные тесты.

```csharp
[Fact]
public void Domain_does_not_depend_on_infrastructure()
{
    var result = Types.InAssembly(typeof(Invoice).Assembly)
        .ShouldNot()
        .HaveDependencyOnAny("Microsoft.EntityFrameworkCore", "Npgsql", "Confluent.Kafka", "Microsoft.AspNetCore")
        .GetResult();

    Assert.True(result.IsSuccessful);
}
```

**Что это реально даёт:**

- **Тестируемость бизнес-логики.** Правила расчёта счёта проверяются юнит-тестами на чистых объектах за миллисекунды.
- **Изоляция от инфраструктурных изменений.** Замена брокера, переход с HTTP-клиента на gRPC, обновление EF Core затрагивают Infrastructure, а не use cases.
- **Явные сценарии.** Каждый use case — отдельный класс или обработчик, по структуре проекта видно, что система умеет.
- **Дисциплина для большой команды.** Нельзя случайно вызвать `DbContext` из контроллера или отправить сообщение в Kafka из доменной сущности.

**Цена строгого соблюдения:**

- **Маппинг на каждом шаге.** HTTP-запрос → команда → доменная сущность → EF-модель → обратно в DTO. Для фичи «добавить поле в карточку» правятся 6–8 файлов.
- **Отдельные персистентные модели.** Попытка сделать домен совершенно не знающим об EF Core приводит к дублированию сущностей и ручному маппингу; на практике многие команды разрешают EF маппить доменные сущности через Fluent API (это не требует ссылки Domain на EF).
- **Репозиторий поверх `DbContext`** ради чистоты прячет `Include`, проекции, `AsNoTracking`, `ExecuteUpdate` — и потом их приходится вытаскивать обратно через спецификации.
- **Сложные чтения.** Отчёты и списки с фильтрами, проведённые через доменные агрегаты, медленные и неудобные. Отсюда разделение: команды через домен, запросы напрямую через Dapper/EF-проекции (CQRS-подход внутри сервиса).
- **Порог входа.** Новому разработчику нужно понять соглашения, прежде чем сделать первую правку.
- **Анемичный результат.** Если домен — это свойства с геттерами-сеттерами, а логика в «сервисах приложения», команда платит всю цену слоёв и не получает выгоды: защищать нечего.

**Когда оно того стоит:** сложная предметная область с правилами и инвариантами (биллинг, страхование, логистика), долгоживущий продукт, несколько точек входа (API, консьюмеры, фоновые задачи) над одной логикой, интеграции, которые реально меняются.

**Когда избыточно:** CRUD-сервисы и админки, интеграционные «перекладчики» данных, прототипы, небольшие микросервисы, где весь сервис меньше одного bounded context. Здесь лучше вертикальные слайсы: фича в одной папке с эндпоинтом, обработчиком и запросом к БД.

**Прагматичный компромисс:** строгие границы вокруг домена и внешних интеграций, но без обязательных интерфейсов на всё; `DbContext` допустим в Application-слое для запросов; меньше проектов (иногда Domain + Application в одной сборке с проверкой архитектурными тестами).

**Что спрашивают дальше:** где в Clean Architecture живут транзакции и outbox, как обрабатывать доменные события, чем Clean Architecture отличается от Onion и гексагональной (терминологией больше, чем сутью — во всех трёх зависимости направлены к домену).

## Чем гексагональная архитектура отличается от слоёной на практике?

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-chem-geksagonalnaya-arhitektura-otlichaetsya-ot-sloenoi-na-praktike
tags: hexagonal, design
```

В классической слоёной архитектуре зависимости идут сверху вниз: UI → бизнес-логика → доступ к данным, и бизнес-слой зависит от слоя данных. В гексагональной (Ports and Adapters) центр — приложение с доменом, оно объявляет порты (интерфейсы того, что ему нужно и что оно предлагает), а всё внешнее — HTTP, БД, брокеры, внешние API — это адаптеры, которые подключаются к портам снаружи. Практическая разница: база данных перестаёт быть «нижним слоем», на котором всё стоит, и становится такой же заменяемой деталью, как веб-фреймворк.

**Направление зависимостей:**

```text
Слоёная:        Api → Business → DataAccess → БД
                       (Business ссылается на DataAccess)

Гексагональная: [HTTP-адаптер] → (входной порт) → Application/Domain ← (выходной порт) ← [Postgres-адаптер]
                                                                      ← [Kafka-адаптер]
```

**Порты двух видов:**

- **Входные (driving)** — то, что приложение умеет: use case-интерфейсы или команды. Их вызывают адаптеры: контроллер, gRPC-сервис, Kafka-консьюмер, CLI, тест.
- **Выходные (driven)** — то, что приложению нужно от мира: хранилище, отправка уведомлений, курс валют, время. Их реализуют адаптеры.

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

app.MapPost("/orders", async (PlaceOrderRequest req, IPlaceOrder placeOrder, CancellationToken ct) =>
{
    var id = await placeOrder.HandleAsync(req.ToCommand(), ct);
    return Results.Created($"/orders/{id}", new { id });
});
```

Тот же `IPlaceOrder` вызывает и Kafka-консьюмер, обрабатывающий заказы из маркетплейса, — второй входной адаптер без дублирования логики.

**Что меняется на практике:**

| | Слоёная | Гексагональная |
| --- | --- | --- |
| Кто определяет интерфейс хранилища | слой данных | приложение, под свои нужды |
| Форма интерфейса | повторяет таблицы и ORM (`GetById`, `GetAll`, `Update`) | повторяет потребности сценария (`FindPendingForCustomer`, `ReserveAsync`) |
| Тестирование логики | с БД или моками DAL | с in-memory адаптерами выходных портов |
| Новая точка входа | часто дублирование логики в новом «верхнем слое» | ещё один входной адаптер |
| Типичная деградация | бизнес-логика уезжает в хранимые процедуры или в сервисы, знающие про EF | лишние порты на каждую мелочь |

**Ключевая идея — владение интерфейсом.** В слоёной архитектуре `IOrderRepository` лежит в DataAccess и отражает возможности хранилища. В гексагональной `IOrderStore` лежит в приложении и отражает потребности приложения, а Postgres-адаптер подстраивается. Это и есть dependency inversion на уровне архитектуры.

**Тестирование.** Сценарий проверяется целиком через входной порт с фейковыми выходными адаптерами — без HTTP и БД, но и без мокинга каждого вызова. Адаптеры проверяются отдельными интеграционными тестами против реальной PostgreSQL в Testcontainers.

**Трезвый взгляд:**

- Для сервиса с одной точкой входа и одной БД разница с аккуратно написанной слоёной архитектурой невелика.
- «Заменить PostgreSQL на MongoDB одним адаптером» почти никогда не случается: транзакции, консистентность и запросы протекают через порты. Реальная выгода — тестируемость и несколько входных каналов.
- Порт на каждую внешнюю библиотеку — перебор. Порт нужен там, где есть реальная граница процесса или нестабильная внешняя зависимость.

**Что спрашивают дальше:** где в гексагональной архитектуре транзакция (обычно — вокруг вызова входного порта, через Unit of Work или `DbContext` выходного адаптера), куда положить маппинг между HTTP-моделью и командой, как гексагональная архитектура соотносится с Clean и Onion.

## Как применить Dependency Inversion, не создавая интерфейс на каждый класс?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kak-primenit-dependency-inversion-ne-sozdavaya-interfeis-na-kazhdyi-kl
tags: solid, design
```

Dependency Inversion — это не «у каждого класса есть интерфейс», а «высокоуровневая политика не зависит от низкоуровневых деталей; обе зависят от абстракции, которой владеет политика». Интерфейс нужен там, где есть граница с нестабильной или внешней деталью — БД, сеть, брокер, время, файловая система, сторонний SDK. Внутри модуля конкретные классы, внедряемые через конструктор, вполне соответствуют принципу: DI-контейнер и инверсия зависимостей — разные вещи.

**Где абстракция нужна:**

- внешний ввод-вывод: репозитории/хранилища, HTTP-клиенты сторонних API, отправка в Kafka, email/SMS;
- недетерминированность: время, случайность, идентификаторы (`TimeProvider` в .NET 8 закрывает время без самописного `IClock`);
- несколько реализаций в проде: провайдеры оплаты, стратегии ценообразования;
- граница между модулями монолита: модуль A общается с B через опубликованный контракт, а не через его внутренние классы.

**Где не нужна:**

- доменные объекты и value objects;
- чистые вычисления: калькуляторы, маппинг, валидация без I/O;
- внутренние сервисы модуля с единственной реализацией, которые не нужно подменять в тестах;
- обёртки над стабильными BCL-типами без поведения, которое хочется подменять.

**Как выглядит прагматичный вариант:**

```csharp
public sealed class PriceCalculator(DiscountPolicy discounts)
{
    public Money Calculate(Cart cart, Customer customer) =>
        discounts.Apply(cart.Subtotal, customer.Tier);
}

public interface IExchangeRates
{
    Task<decimal> GetRateAsync(Currency from, Currency to, CancellationToken ct);
}

public sealed class CheckoutService(
    PriceCalculator calculator,
    IExchangeRates rates,
    IOrderStore orders,
    TimeProvider time)
{
}

builder.Services.AddSingleton<DiscountPolicy>();
builder.Services.AddSingleton<PriceCalculator>();
builder.Services.AddHttpClient<IExchangeRates, CbrExchangeRatesClient>();
builder.Services.AddScoped<IOrderStore, PostgresOrderStore>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<CheckoutService>();
```

`PriceCalculator` и `DiscountPolicy` — конкретные классы: в тестах их создают настоящими, потому что они быстрые и детерминированные. `IExchangeRates` и `IOrderStore` — интерфейсы, потому что за ними сеть и БД. Владелец интерфейсов — модуль `Checkout`, а не модуль инфраструктуры: интерфейс описывает то, что нужно чекауту, в его терминах.

**Альтернативы интерфейсу:**

- **Делегат.** Если зависимость — одна функция, `Func<CancellationToken, Task<decimal>>` проще интерфейса с одной реализацией.
- **Абстрактный класс или виртуальные методы** — когда есть общая логика; но чаще это первый шаг к хрупкому наследованию.
- **Передача данных вместо зависимости.** Вместо `ICurrentUser` в доменном методе — параметр `UserId`. Метод становится чистым, абстракция не нужна.
- **Интерфейс появляется при необходимости.** Выделение интерфейса из класса — автоматический рефакторинг. Если через полгода понадобится вторая реализация, это займёт минуты.

**Про тестирование.** Главный аргумент «интерфейсы нужны для моков» часто приводит к тестам, которые проверяют реализацию, а не поведение. Лучше: настоящие объекты для логики, фейки (in-memory реализации) для портов, интеграционные тесты с Testcontainers для адаптеров. Тогда интерфейсов становится ровно столько, сколько настоящих границ.

**Признак правильной инверсии:** при замене PostgreSQL-адаптера на in-memory или при смене провайдера курсов не меняется ни одна строка в модуле `Checkout`. Признак ложной: интерфейс лежит рядом с реализацией в инфраструктурной сборке и повторяет её публичные методы один в один — зависимость направлена по-прежнему вниз, просто через лишний тип.

**Что спрашивают дальше:** чем DIP отличается от DI и IoC, где должен лежать интерфейс репозитория, почему `IServiceProvider`, внедрённый в класс (service locator), нарушает идею инверсии.

## Когда паттерн Repository поверх ORM избыточен?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kogda-pattern-repository-poverh-orm-izbytochen
tags: patterns, orm
```

Repository поверх EF Core избыточен, когда он просто повторяет `DbSet<T>` (`GetById`, `GetAll`, `Add`, `Update`, `Delete`): `DbContext` уже реализует Repository и Unit of Work, а обёртка скрывает его сильные стороны — LINQ-проекции, `Include`, `AsNoTracking`, `ExecuteUpdate`, компилированные запросы. Repository оправдан, когда он задаёт границу агрегата и словарь предметной области или изолирует сложное хранилище, а не дублирует ORM.

**Типичный избыточный вариант:**

```csharp
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(int id);
    Task<IEnumerable<T>> GetAllAsync();
    Task AddAsync(T entity);
    void Update(T entity);
    void Delete(T entity);
    Task SaveChangesAsync();
}
```

Проблемы:

- `GetAllAsync` материализует всю таблицу; для фильтрации добавляют `Find(Expression<Func<T,bool>>)` — и это уже протекающий `IQueryable` в худшей форме.
- Нет проекций: экран списка тянет полные сущности с навигациями вместо трёх колонок.
- `Include` и `AsNoTracking` либо недоступны, либо появляются параметры-флаги и спецификации — переизобретение LINQ.
- `SaveChangesAsync` в каждом репозитории размывает границу транзакции: два репозитория — два сохранения?
- Тесты с моком `IRepository<T>` не проверяют главное — что LINQ транслируется в SQL и запрос корректен.

**Когда `DbContext` напрямую — нормальный выбор:**

- CRUD-сервисы и админки;
- запросы на чтение (query side), где нужны проекции в DTO;
- vertical slice архитектура: обработчик фичи сам строит нужный запрос;
- небольшие сервисы, где EF Core — единственное хранилище и его замена не планируется.

```csharp
app.MapGet("/customers/{id:int}/orders", async (int id, AppDbContext db, CancellationToken ct) =>
    await db.Orders
        .AsNoTracking()
        .Where(o => o.CustomerId == id && o.Status != OrderStatus.Cancelled)
        .OrderByDescending(o => o.CreatedAt)
        .Select(o => new OrderListItem(o.Id, o.CreatedAt, o.Total))
        .Take(50)
        .ToListAsync(ct));
```

Тестируется интеграционным тестом против настоящей PostgreSQL в Testcontainers — это проверяет и трансляцию LINQ, и индексы.

**Когда Repository оправдан:**

- **Агрегаты DDD на стороне записи.** Репозиторий на агрегат (не на таблицу) гарантирует, что агрегат загружается целиком и сохраняется как единое целое: `Task<Order?> FindAsync(OrderId id)` с нужными `Include` внутри, `Add(Order)`, без `Update` и без доступа к дочерним сущностям напрямую. Это доменная граница, а не обёртка над ORM.
- **Язык предметной области.** `FindOverdueInvoices(DateOnly asOf)` вместо разбросанных по коду одинаковых `Where`, когда запрос нетривиален и переиспользуется.
- **Несколько источников или сложное хранилище.** Данные частично в PostgreSQL, частично в Redis или внешнем API; Dapper с ручным SQL для горячих запросов.
- **Изоляция доменного слоя** в Clean/гексагональной архитектуре, где Application не должен ссылаться на EF Core.

**Если всё же делаете репозиторий:**

- специфичные методы под сценарии, а не generic CRUD;
- не возвращать `IQueryable` наружу — иначе граница фиктивна;
- `SaveChanges` вызывается в одном месте (обработчик команды или Unit of Work), а не в каждом репозитории;
- для чтения — отдельные query-сервисы или прямой `DbContext`, а не репозиторий агрегата.

**Аргумент «а вдруг сменим ORM»** почти никогда не реализуется: смена ORM меняет семантику транзакций, отслеживания изменений и ленивой загрузки, и generic-репозиторий от этого не защищает.

**Что спрашивают дальше:** как тестировать код, использующий `DbContext` напрямую (Testcontainers, а не InMemory-провайдер, у которого другая семантика), что такое Specification pattern и когда он оправдан, как делать Unit of Work при нескольких репозиториях.

## Когда Strategy лучше конструкции switch и когда наоборот?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kogda-strategy-luchshe-konstrukcii-switch-i-kogda-naoborot
tags: patterns, design
```

`switch` лучше, когда набор вариантов закрыт, известен заранее, ветки короткие и все изменения происходят в одном месте — особенно с pattern matching по закрытой иерархии. Strategy лучше, когда варианты добавляются независимо от вызывающего кода, у каждого своя нетривиальная логика и зависимости, выбор зависит от конфигурации или данных в рантайме, или варианты поставляются разными командами и модулями.

**Когда `switch` — правильный выбор:**

```csharp
public static decimal ShippingCost(Shipment s) => s switch
{
    { Method: ShippingMethod.Pickup } => 0m,
    { Method: ShippingMethod.Courier, WeightKg: <= 5 } => 300m,
    { Method: ShippingMethod.Courier } => 300m + (s.WeightKg - 5) * 40m,
    { Method: ShippingMethod.Post } => 250m + s.WeightKg * 25m,
    _ => throw new UnreachableException($"Unknown method {s.Method}")
};
```

- Вся логика видна на одном экране, её легко читать и тестировать таблицей входов-выходов.
- Добавление варианта — одна строка, и все решения по стоимости доставки остаются в одном месте.
- Нет DI-регистраций, фабрик, интерфейсов и прыжков по файлам.

**Когда нужна Strategy:**

```csharp
public interface IPaymentProvider
{
    string Code { get; }
    Task<PaymentResult> ChargeAsync(PaymentRequest request, CancellationToken ct);
    Task RefundAsync(PaymentId id, Money amount, CancellationToken ct);
}

public sealed class PaymentRouter(IEnumerable<IPaymentProvider> providers)
{
    private readonly Dictionary<string, IPaymentProvider> _byCode =
        providers.ToDictionary(p => p.Code, StringComparer.OrdinalIgnoreCase);

    public IPaymentProvider Resolve(string code) =>
        _byCode.TryGetValue(code, out var provider)
            ? provider
            : throw new UnsupportedPaymentMethodException(code);
}

builder.Services.AddScoped<IPaymentProvider, StripeProvider>();
builder.Services.AddScoped<IPaymentProvider, YooKassaProvider>();
builder.Services.AddScoped<PaymentRouter>();
```

- У каждого провайдера свой HTTP-клиент, настройки, ретраи, маппинг ошибок — в `switch` это превратилось бы в сотни строк с зависимостями всех вариантов в одном классе.
- Варианты связаны общим поведением из нескольких методов (`Charge`, `Refund`) — один `switch` превратился бы в несколько параллельных, которые нужно держать синхронными.
- Новый провайдер добавляется новым классом и регистрацией, без правки маршрутизатора.
- Варианты можно включать по конфигурации или фича-флагу и тестировать изолированно.

В .NET 8+ для выбора по ключу есть keyed services: `AddKeyedScoped<IPaymentProvider, StripeProvider>("stripe")` и `[FromKeyedServices("stripe")]` или `GetRequiredKeyedService`.

**Критерии выбора:**

| Вопрос | `switch` | Strategy |
| --- | --- | --- |
| Набор вариантов закрыт? | да | нет, растёт |
| Логика ветки | несколько строк | классы, зависимости, состояние |
| Сколько мест выбирает по типу | одно | несколько параллельных `switch` — сигнал к Strategy |
| Выбор в рантайме по конфигурации | редко | часто |
| Кто добавляет варианты | та же команда в том же файле | разные команды, плагины |

**Expression problem.** Это фундаментальный компромисс. `switch` по закрытому набору типов делает лёгким добавление новых *операций* (ещё одна функция с `switch`) и трудным добавление новых *вариантов* (править все `switch`). Strategy/полиморфизм — наоборот: новый вариант — новый класс, новая операция — правка интерфейса и всех реализаций. Выбирайте по тому, что будет меняться чаще.

**Опасности обеих сторон:** с `switch` — одинаковые `switch` по одному и тому же enum, разбросанные по десяти классам, и забытая ветка при добавлении значения (для enum компилятор не всегда предупреждает, поэтому `_ => throw`). Со Strategy — интерфейс ради двух веток по три строки, «стратегии», которые на деле требуют разных параметров и вынуждают раздувать общий контракт.

**Что спрашивают дальше:** как Strategy связан с DI и почему внедрение `IEnumerable<T>` — удобный способ получить все реализации, чем Strategy отличается от State (кто меняет текущую реализацию), когда хватает словаря делегатов `Dictionary<string, Func<...>>`.

## Какую задачу решает Mediator и почему он часто превращается в свалку?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kakuyu-zadachu-reshaet-mediator-i-pochemu-on-chasto-prevraschaetsya-v
tags: patterns, design
```

Классический Mediator убирает прямые связи между множеством взаимодействующих объектов: они общаются через посредника, который знает правила координации. В .NET под этим словом обычно имеют в виду другое — in-process диспетчер запросов в стиле MediatR: контроллер отправляет команду, а библиотека находит обработчик и прогоняет его через pipeline behaviors. Свалкой он становится, когда его используют как замену обычным вызовам методов: всё идёт через `Send`, обработчики вызывают друг друга через медиатор, а поведение размазано по behavior'ам, которые никто не видит при чтении кода.

**Что реально даёт диспетчер запросов:**

- **Один класс на сценарий.** `PlaceOrderHandler` вместо `OrderService` на 40 методов с десятком зависимостей.
- **Сквозная функциональность в одном месте.** Валидация, логирование, транзакция, метрики, идемпотентность — через pipeline behaviors, а не копипастой в каждом обработчике.
- **Тонкие эндпоинты.** Контроллер или minimal API только маппит HTTP в команду.

```csharp
public sealed class TransactionBehavior<TRequest, TResponse>(AppDbContext db)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : ICommand<TResponse>
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var response = await next();
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return response;
    }
}
```

**Как он превращается в свалку:**

- **Обработчик вызывает обработчик.** `await mediator.Send(new GetCustomerQuery(...))` внутри `PlaceOrderHandler`. Зависимость стала невидимой: по конструктору не понять, что нужно классу, «Go to definition» ведёт в интерфейс библиотеки, а цепочки вложенных `Send` повторно проходят все behaviors — вложенные транзакции, двойное логирование, двойная валидация.
- **Notifications как скрытая шина событий.** `Publish` вызывает обработчики синхронно в том же процессе и транзакции; один упавший обработчик ломает основной сценарий, порядок не гарантирован, а со стороны выглядит как асинхронная событийная архитектура без её надёжности.
- **Медиатор ради медиатора.** Запрос `GetUserByIdQuery` с обработчиком в одну строку `db.Users.FindAsync(id)` — три файла вместо одного вызова.
- **Behaviors с бизнес-логикой.** Авторизация конкретной сущности, обогащение запроса, кэширование с ключами по типу — неявное поведение, которое ломает понимание «что происходит при вызове».
- **Стоимость.** Рефлексия при разрешении обработчиков, аллокации на каждый `Send`, длинные стеки в профиле и трассировке. Обычно не критично, но на горячем пути заметно.

**Правила, которые удерживают от деградации:**

1. **Медиатор только на границе.** `Send` вызывается из эндпоинтов, консьюмеров и фоновых задач — точек входа. Внутри доменной логики — обычные зависимости через конструктор.
2. **Переиспользуемая логика — в обычных сервисах или доменных объектах**, а не в «обработчиках, которые вызывают другие обработчики».
3. **Behaviors только для действительно сквозных задач** и в ограниченном количестве; их порядок явный и задокументирован.
4. **События между модулями — через outbox и брокер** или через явный механизм доменных событий с понятной семантикой транзакции, а не через `INotification`.
5. **Можно без библиотеки.** Обработчики как обычные классы, зарегистрированные в DI и внедряемые прямо в эндпоинт, плюс декораторы для сквозной функциональности. Это те же преимущества без невидимой маршрутизации. Учтите и то, что начиная с версии 13 (2025) MediatR распространяется под коммерческой лицензией с бесплатным уровнем для небольших компаний — многие команды из-за этого переходят на собственный тонкий диспетчер или source-generated аналоги.

**Что спрашивают дальше:** чем MediatR отличается от классического GoF Mediator (тот координирует взаимодействие объектов-коллег, а не маршрутизирует запросы), как реализовать pipeline без библиотеки через декораторы, как трассировать вложенные `Send` в OpenTelemetry.

## Когда Decorator предпочтительнее наследования?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kogda-decorator-predpochtitelnee-nasledovaniya
tags: patterns, design
```

Decorator предпочтительнее, когда нужно добавлять независимые сквозные поведения (кэш, ретраи, метрики, логирование, авторизацию) к объекту в разных комбинациях, не трогая его код, и выбирать эти комбинации при сборке приложения. Наследование фиксирует поведение на этапе компиляции и в одной иерархии: при трёх независимых добавках получается 2³ подклассов или одна длинная цепочка `CachedLoggedRetryingClient`, где порядок нельзя поменять.

**Почему наследование здесь ломается:**

- **Комбинаторный взрыв.** Кэш + метрики, только метрики, ретраи + кэш — каждая комбинация требует отдельного класса.
- **Хрупкий базовый класс.** Подкласс зависит от внутренних деталей базы: какой метод вызывает какой, в каком порядке. Изменение базы ломает наследников.
- **Привязка к реализации.** Нельзя «отнаследоваться» от интерфейса с поведением, только от конкретного класса — а у `sealed` класса или класса из чужой библиотеки и этого нет.
- **Нельзя менять в рантайме или по конфигурации.** Включить кэш только в проде, а трассировку только на одном окружении — наследованием это не выразить.

**Декоратор — та же абстракция, обёрнутая вокруг другой реализации:**

```csharp
public interface IProductCatalog
{
    Task<Product?> GetAsync(ProductId id, CancellationToken ct);
}

public sealed class CachedProductCatalog(IProductCatalog inner, HybridCache cache) : IProductCatalog
{
    public async Task<Product?> GetAsync(ProductId id, CancellationToken ct) =>
        await cache.GetOrCreateAsync(
            $"product:{id}",
            async token => await inner.GetAsync(id, token),
            cancellationToken: ct);
}

public sealed class MeteredProductCatalog(IProductCatalog inner, CatalogMetrics metrics) : IProductCatalog
{
    public async Task<Product?> GetAsync(ProductId id, CancellationToken ct)
    {
        var started = Stopwatch.GetTimestamp();
        try
        {
            return await inner.GetAsync(id, ct);
        }
        finally
        {
            metrics.RecordLookup(Stopwatch.GetElapsedTime(started));
        }
    }
}
```

Регистрация с декорированием — встроенный DI в .NET этого не умеет напрямую, поэтому используют Scrutor или ручную фабрику:

```csharp
builder.Services.AddScoped<IProductCatalog, PostgresProductCatalog>();
builder.Services.Decorate<IProductCatalog, CachedProductCatalog>();
builder.Services.Decorate<IProductCatalog, MeteredProductCatalog>();
```

Последний зарегистрированный декоратор — внешний: вызов идёт `Metered → Cached → Postgres`, то есть метрики измеряют время с учётом кэша. Поменяв порядок, вы будете мерить только промахи кэша — порядок декораторов является частью поведения, и это нужно осознанно выбирать.

**Где декораторы уже встроены в .NET:**

- `DelegatingHandler` в `HttpClient` — цепочка обработчиков вокруг `HttpMessageHandler`; на этом построены Polly/`Microsoft.Extensions.Http.Resilience`, логирование и аутентификация.
- `Stream`-обёртки: `BufferedStream`, `GZipStream`, `CryptoStream` вокруг другого `Stream`.
- ASP.NET Core middleware — по сути цепочка декораторов вокруг `RequestDelegate`.

**Когда наследование всё же уместно:**

- настоящая иерархия «является» с общим инвариантом и шаблонным поведением (Template Method в базовом классе фреймворка: `BackgroundService.ExecuteAsync`, `DelegatingHandler.SendAsync`, `JsonConverter<T>`);
- нужно переопределить часть поведения, а не обернуть целиком, и базовый класс спроектирован для этого (`virtual`/`abstract` методы задокументированы как точки расширения).

**Подводные камни декораторов:**

- **Большой интерфейс.** Декоратор обязан реализовать все методы, даже те, где он ничего не добавляет, — сигнал, что интерфейс стоит разделить.
- **Нарушение контракта.** Декоратор с таймаутом или кэшем может изменить семантику: кэширование результата, который клиент ожидает свежим, или новое исключение, к которому вызывающий код не готов.
- **Lifetime.** Декоратор-singleton вокруг scoped-реализации — захват scoped-зависимости.
- **Отладка.** Стек вызовов проходит через несколько обёрток; без хорошего именования трудно понять, какой слой что делает.

**Что спрашивают дальше:** чем декоратор отличается от прокси и адаптера, как декорировать без Scrutor (фабрика `AddScoped<IProductCatalog>(sp => new MeteredProductCatalog(new CachedProductCatalog(...), ...))` или keyed services), почему middleware ASP.NET Core — это тоже Chain of Responsibility.

## Чем Proxy отличается от Decorator по назначению?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-chem-proxy-otlichaetsya-ot-decorator-po-naznacheniyu
tags: patterns, design
```

Структурно Proxy и Decorator одинаковы: объект реализует тот же интерфейс и держит ссылку на другой объект. Различие в намерении: Decorator **добавляет поведение** к объекту, который уже есть, и рассчитан на произвольную композицию; Proxy **управляет доступом** к объекту — откладывает его создание, проверяет права, скрывает удалённость, кэширует или считает ссылки — и обычно сам отвечает за то, как и когда реальный объект появляется.

**Сравнение по сути:**

| | Decorator | Proxy |
| --- | --- | --- |
| Цель | расширить функциональность | контролировать доступ к субъекту |
| Кто создаёт обёрнутый объект | клиент или DI передают его снаружи | часто сам прокси (лениво или удалённо) |
| Композиция | несколько декораторов в цепочке — норма | обычно один прокси |
| Знание о клиенте | клиент собирает цепочку осознанно | клиент не знает, что работает с прокси |
| Типичные примеры | метрики, логирование, ретраи, сжатие | lazy loading, remote proxy, защита, ограничение |

**Виды прокси с примерами из .NET:**

- **Virtual proxy (ленивое создание).** Ленивые навигационные свойства EF Core (`UseLazyLoadingProxies`) — EF генерирует подкласс сущности, который при первом обращении к `Order.Customer` выполняет запрос. Отсюда требование `virtual` на навигациях и типичная ловушка N+1.
- **Remote proxy.** Сгенерированный gRPC-клиент или клиент Refit: вызываете метод интерфейса, а прокси сериализует аргументы и делает сетевой вызов. Опасность — прокси скрывает, что это сеть: задержки, отказы, частичные ошибки выглядят как обычный вызов метода.
- **Protection proxy.** Обёртка, проверяющая права перед вызовом: `Delete` разрешён только администратору.
- **Smart reference / caching proxy.** Подсчёт ссылок, кэширование результатов дорогих операций, пул соединений, отдающий прокси вместо реального соединения (так устроено «закрытие» соединения из пула: `Dispose` возвращает его в пул, а не рвёт физически).
- **Динамические прокси.** Castle DynamicProxy (на нём работают Moq и NSubstitute), `System.Reflection.DispatchProxy` — генерация прокси в рантайме для перехвата вызовов.

```csharp
public sealed class LazyReportGenerator(Func<IReportGenerator> factory) : IReportGenerator
{
    private readonly Lazy<IReportGenerator> _real = new(factory);

    public Task<Report> BuildAsync(ReportRequest request, CancellationToken ct) =>
        _real.Value.BuildAsync(request, ct);
}
```

Прокси решает, когда создать тяжёлый генератор отчётов (с загрузкой шаблонов и шрифтов), — клиент не знает об этом.

**Почему различие важно на практике, а не только на собеседовании:**

- **Ожидания по прозрачности.** Прокси должен быть максимально незаметным для клиента, и именно поэтому он опасен: ленивая загрузка или удалённый вызов меняют стоимость операции так, что это не видно в коде. Декоратор обычно явно собран в composition root.
- **Ответственность за жизненный цикл.** Прокси владеет субъектом (создаёт и освобождает), декоратор — нет.
- **Граница бывает размыта.** Кэширующая обёртка — это и декоратор (добавляет кэш), и caching proxy (контролирует обращения к дорогому объекту). Тут важнее назвать класс по смыслу (`CachedProductCatalog`), чем спорить о классификации.

**Связь с AOP.** Interceptors в Castle DynamicProxy, `DispatchProxy` и C# interceptors (возможность компилятора для source generator'ов, на которой, например, построен генератор Request Delegate в ASP.NET Core для AOT) — способы автоматически создавать прокси или декораторы, не записывая их вручную. Цена — магия и отладка: поведение не видно в исходниках.

**Что спрашивают дальше:** почему lazy loading proxies в EF Core считаются анти-паттерном для веб-API, как `DispatchProxy` создаёт прокси интерфейса и почему он не умеет работать с классами, чем Adapter отличается от обоих (меняет интерфейс, а не поведение или доступ).

## Зачем нужен Adapter при интеграции со сторонним API?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-zachem-nuzhen-adapter-pri-integracii-so-storonnim-api
tags: patterns, integration
```

Adapter переводит чужой интерфейс в интерфейс, который нужен вашему приложению. При интеграции со сторонним API это граница, на которой модель, ошибки, единицы измерения и особенности провайдера превращаются в понятия вашего домена, — чтобы изменения у провайдера, его смена или подключение второго провайдера затрагивали один класс, а не весь код, где встречаются его DTO и коды ошибок.

**Без адаптера** типы SDK или DTO провайдера расползаются по коду: `StripeException` ловят в контроллере, `PaymentIntent.Status == "requires_action"` проверяют в бизнес-логике, суммы в копейках как `long` смешиваются с `decimal` в рублях. Смена версии API или провайдера превращается в поиск по всему решению.

**С адаптером:**

```csharp
public interface IPaymentGateway
{
    Task<ChargeResult> ChargeAsync(ChargeRequest request, CancellationToken ct);
}

public sealed record ChargeRequest(PaymentMethodToken Method, Money Amount, string IdempotencyKey);

public abstract record ChargeResult
{
    public sealed record Succeeded(string ExternalId) : ChargeResult;
    public sealed record RequiresConfirmation(Uri RedirectUrl) : ChargeResult;
    public sealed record Declined(DeclineReason Reason) : ChargeResult;
}

public sealed class AcmePayAdapter(HttpClient http, ILogger<AcmePayAdapter> logger) : IPaymentGateway
{
    public async Task<ChargeResult> ChargeAsync(ChargeRequest request, CancellationToken ct)
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, "v2/charges")
        {
            Content = JsonContent.Create(new AcmeChargeDto(
                request.Method.Value,
                request.Amount.ToMinorUnits(),
                request.Amount.Currency.Code.ToLowerInvariant()))
        };
        message.Headers.Add("Idempotency-Key", request.IdempotencyKey);

        using var response = await http.SendAsync(message, ct);
        var body = await response.Content.ReadFromJsonAsync<AcmeChargeResponse>(ct);

        return (response.StatusCode, body?.Status) switch
        {
            (HttpStatusCode.OK, "succeeded") => new ChargeResult.Succeeded(body!.Id),
            (HttpStatusCode.OK, "requires_action") => new ChargeResult.RequiresConfirmation(new Uri(body!.NextActionUrl!)),
            (HttpStatusCode.PaymentRequired, _) => new ChargeResult.Declined(MapDecline(body?.DeclineCode)),
            _ => throw new PaymentGatewayUnavailableException($"AcmePay returned {(int)response.StatusCode}")
        };
    }

    private static DeclineReason MapDecline(string? code) => code switch
    {
        "insufficient_funds" => DeclineReason.InsufficientFunds,
        "card_expired" => DeclineReason.CardExpired,
        _ => DeclineReason.Other
    };
}
```

**Что адаптер берёт на себя:**

- **Модель.** DTO провайдера (`AcmeChargeDto`) не выходят за пределы адаптера; наружу — доменные типы (`Money`, `ChargeResult`).
- **Единицы и форматы.** Минорные единицы валюты, регистр кодов, часовые пояса, форматы дат и идентификаторов.
- **Ошибки.** Коды и исключения провайдера → доменные результаты (отказ — ожидаемый исход, а не исключение) и инфраструктурные исключения (недоступность), на которые настроены ретраи и circuit breaker.
- **Протокол.** Идемпотентные ключи, подписи запросов, пагинация, токены авторизации и их обновление, ограничения rate limit.
- **Изоляция версий.** Переход на v3 API провайдера — правка адаптера и его контрактных тестов.

**Это Anti-Corruption Layer в малом.** В терминах DDD адаптер защищает вашу модель от чужой. Если у провайдера своя странная модель статусов из 14 значений, ваш домен видит три осмысленных исхода.

**Подводные камни:**

- **Протекающая абстракция.** Интерфейс «под одного провайдера» (`CreatePaymentIntentAsync`) — при подключении второго придётся всё переделывать. Проектируйте порт по своим потребностям, глядя хотя бы на двух провайдеров.
- **Наименьший общий знаменатель.** Обратная крайность: интерфейс настолько общий, что уникальные возможности провайдера (3-D Secure, частичный возврат) недоступны. Иногда честнее иметь расширенный интерфейс или явные возможности (`SupportsPartialRefund`).
- **Скрытая сеть.** Адаптер выглядит как обычный вызов, но это HTTP: таймауты, ретраи только для идемпотентных операций, circuit breaker — настраиваются на `HttpClient` через `AddResilienceHandler` или стандартный pipeline.
- **Тестирование.** Юнит-тесты маппинга на записанных ответах провайдера (включая ошибки) плюс контрактные тесты против песочницы. WireMock.Net для сценариев таймаутов и 5xx.

**Что спрашивают дальше:** чем Adapter отличается от Facade (Facade упрощает сложную подсистему, Adapter согласует несовместимые интерфейсы), как обрабатывать вебхуки провайдера (тоже через адаптер: проверка подписи, маппинг, идемпотентность по id события), где хранить внешние идентификаторы.

## Как выбрать между Factory и прямым конструктором?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kak-vybrat-mezhdu-factory-i-pryamym-konstruktorom
tags: patterns, design
```

По умолчанию — прямой конструктор (или DI, который его вызывает): он прост, виден и проверяется компилятором. Фабрика нужна, когда у создания появляется собственная логика: выбор конкретного типа в рантайме, валидация с осмысленным результатом вместо исключения, создание объектов с коротким временем жизни внутри долгоживущего сервиса, смешение рантайм-параметров с зависимостями из DI, кэширование или пулинг экземпляров.

**Уровни, от простого к сложному:**

**Уровень 1: `new` или DI-конструктор** — объект создаётся одинаково, все зависимости известны.

**Уровень 2: статический фабричный метод** — именованный способ создания и валидация:

```csharp
public sealed record Email
{
    public string Value { get; }
    private Email(string value) => Value = value;

    public static Result<Email> Create(string input)
    {
        var normalized = input.Trim().ToLowerInvariant();
        return MailAddress.TryCreate(normalized, out _)
            ? Result.Success(new Email(normalized))
            : Result.Failure<Email>("invalid_email");
    }
}

var deadline = TimeSpan.FromSeconds(30);
var money = Money.FromMinorUnits(15_000, Currency.Rub);
```

Имя говорит о смысле (`FromMinorUnits` против `FromMajorUnits`), конструктор закрыт, поэтому невалидный объект создать нельзя. Результат вместо исключения — для ожидаемых ошибок ввода.

**Уровень 3: фабрика-сервис** — когда для создания нужны зависимости и рантайм-данные:

```csharp
public sealed class ReportExporterFactory(IServiceProvider services)
{
    public IReportExporter Create(ExportFormat format) => format switch
    {
        ExportFormat.Csv => services.GetRequiredService<CsvExporter>(),
        ExportFormat.Xlsx => services.GetRequiredService<XlsxExporter>(),
        _ => throw new ArgumentOutOfRangeException(nameof(format))
    };
}
```

Использование `IServiceProvider` здесь допустимо: это часть composition root, а не service locator в бизнес-логике. Для выбора по ключу в .NET 8+ есть keyed services.

**Уровень 4: фабрики из BCL и платформы** — готовые решения типовых задач создания:

- `IHttpClientFactory` — управляет временем жизни `HttpMessageHandler`, чтобы избежать исчерпания сокетов и устаревания DNS;
- `IDbContextFactory<TContext>` — `DbContext` для singleton-сервисов, `BackgroundService` и Blazor Server, где scope не совпадает с единицей работы;
- `ActivatorUtilities.CreateInstance<T>(sp, runtimeArg)` — смешивает аргументы из DI и переданные вручную;
- `ObjectPool<T>` — переиспользование дорогих объектов.

**Когда фабрика — правильный выбор:**

- конкретный тип определяется данными (формат, провайдер, тип сообщения);
- объект короткоживущий, а потребитель — singleton (фабрика создаёт scoped-объект в своём scope);
- конструктор не может выразить инвариант без исключений, а ошибка ожидаема;
- создание дорогое и нужно кэширование, пулинг, ленивость;
- нужна последовательность шагов с промежуточной валидацией — тогда это уже Builder.

**Когда фабрика вредит:**

- `IOrderFactory` с методом `Create()`, внутри которого `new Order()` — ещё один интерфейс и класс без логики;
- Abstract Factory «на будущее» для одной реализации;
- фабрика, которая скрывает обязательные зависимости: объект создаётся частично инициализированным, а остальное «досетапливается» потом;
- фабрика как способ обойти DI, вызывающая `new` для сервисов с зависимостями, — теряется управление временем жизни и `Dispose`.

**Важный нюанс про `Dispose`.** Объекты, полученные из DI-контейнера, освобождает контейнер. Объекты, созданные фабрикой через `new` или `ActivatorUtilities`, должен освободить тот, кто их получил. Фабрика должна явно документировать владение, иначе — утечки соединений и хендлов.

**Что спрашивают дальше:** чем Factory Method отличается от Abstract Factory, почему `HttpClient` нельзя создавать через `new` на каждый запрос и что именно решает `IHttpClientFactory`, когда статический фабричный метод лучше конструктора с исключением.

## Приведите пример, где паттерн навредил проекту

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-privedite-primer-gde-pattern-navredil-proektu
tags: patterns, design
```

Хороший ответ здесь — конкретная история: какой паттерн, какую проблему им хотели решить, во что это обошлось и как вышли. Типичный реальный пример — generic Repository + Unit of Work + Specification поверх EF Core, введённые «для чистой архитектуры» в сервисе, где не было ни сложного домена, ни второго хранилища. Паттерн навредил не сам по себе, а тем, что решал отсутствующую проблему и закрыл доступ к возможностям, которые были нужны.

**Пример в формате, который ждут на собеседовании:**

**Контекст.** Сервис каталога и заказов, около 40 сущностей, команда из 6 человек. На старте приняли решение: весь доступ к данным — через `IRepository<T>` и `IUnitOfWork`, сложные выборки — через `ISpecification<T>`, никакого `DbContext` вне инфраструктурного проекта.

**Что пошло не так:**

- **Производительность.** Репозиторий возвращал полные сущности. Экраны списков тянули заказы со всеми позициями и адресами ради пяти колонок. Проекции (`Select` в DTO) в абстракцию не помещались, `AsNoTracking` добавили флагом, потом флагов стало шесть.
- **N+1 и `Include`.** Спецификации обросли списками `Include`, которые копировались между классами; забытый `Include` давал lazy loading или `null`.
- **Транзакции.** `SaveChangesAsync` вызывался и в репозиториях, и в `UnitOfWork`; в одном сценарии половина изменений сохранялась до исключения.
- **Массовые операции.** `ExecuteUpdateAsync` и `ExecuteDeleteAsync` из EF Core 7 в интерфейс не вписывались; пакетное обновление цен шло через загрузку 200 000 сущностей.
- **Тесты.** Юнит-тесты мокали `IRepository<T>` и проверяли вызовы моков. Баги трансляции LINQ в SQL находились только в проде.
- **Скорость разработки.** Новая выборка — новая спецификация, новый метод в интерфейсе, новая реализация. Простые задачи занимали в разы больше времени, новые разработчики путались.

**Как вышли:** не переписыванием целиком, а постепенно.

```csharp
public sealed class GetOrderListHandler(AppDbContext db)
{
    public Task<List<OrderListItem>> HandleAsync(OrderListQuery q, CancellationToken ct) =>
        db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == q.CustomerId)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OrderListItem(o.Id, o.Number, o.CreatedAt, o.Total, o.Status))
            .Skip(q.Offset).Take(q.Limit)
            .ToListAsync(ct);
}
```

1. Чтения перевели на прямые запросы через `DbContext` с проекциями.
2. Для агрегата `Order` на стороне записи оставили специфичный репозиторий с методами по сценариям — там граница была осмысленной.
3. `SaveChanges` перенесли в одно место — обработчик команды.
4. Моки репозиториев заменили интеграционными тестами с PostgreSQL в Testcontainers.

**Результат:** время ответа списков сократилось в несколько раз, удалили несколько тысяч строк инфраструктурного кода, новые выборки снова пишутся за минуты.

**Другие частые примеры, которые можно привести:**

- **Event sourcing** в CRUD-домене: сложность проекций, миграций событий и отладки без бизнес-потребности в истории.
- **Микросервисы** для команды из пяти человек: распределённые транзакции и деплой там, где хватало модульного монолита.
- **Mediator везде**, включая вызовы обработчиков из обработчиков, — невидимые зависимости и вложенные транзакции.
- **Наследование вместо композиции**: базовый `BaseService<T>` с десятком виртуальных методов, где каждое изменение ломало наследников.
- **Singleton со статическим состоянием** — проблемы с тестами и многопоточностью.

**Что обычно хотят услышать:**

- вы различаете паттерн и проблему, которую он решает;
- можете назвать измеримые последствия, а не «было некрасиво»;
- вышли инкрементально, с защитой тестами, а не большим переписыванием;
- сделали вывод на процессном уровне: решения такого масштаба теперь фиксируются в ADR с явными альтернативами и критериями пересмотра.

**Что спрашивают дальше:** как вы убедили команду отказаться от принятого подхода, как понять заранее, что паттерн не нужен, какие паттерны, наоборот, окупились у вас.

## Как понять, что абстракция преждевременна?

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-kak-ponyat-chto-abstrakciya-prezhdevremenna
tags: design, architecture
```

Абстракция преждевременна, если у неё одна реализация и нет реальной причины для второй, если её форма угадана, а не выведена из нескольких конкретных случаев, и если вызывающий код из-за неё становится сложнее, а не проще. Главный критерий — абстракция должна убирать знание из вызывающего кода; если она просто добавляет слой, через который это знание всё равно приходится протаскивать, она преждевременна.

**Признаки преждевременной абстракции:**

- **Одна реализация и нет второй в планах.** `INotificationSender` с единственной `EmailNotificationSender` два года подряд.
- **Параметры-флаги.** Общий метод обрастает `bool includeArchived`, `bool skipValidation`, `Mode mode`, потому что два вызывающих кода хотят чуть разного. Это сигнал, что «общего» было меньше, чем казалось.
- **Абстракция повторяет реализацию.** Интерфейс 1:1 с публичными методами класса, включая детали конкретной технологии (`ExecuteSqlAsync`, `GetBlobContainer`).
- **Протекание деталей.** Чтобы использовать абстракцию правильно, нужно знать, что под ней (например, что «хранилище» на самом деле S3 и `List` по префиксу дорогой).
- **Изменения всегда идут парами.** Любая правка требует одновременно менять абстракцию и реализацию — значит, граница проведена не там.
- **Название из словаря паттернов**, а не из предметной области: `IProcessor`, `IHandlerFactoryProvider`, `BaseManager<T>`.
- **«Для гибкости» без сценария.** На вопрос «какое изменение станет проще благодаря этому?» нет конкретного ответа.

**Почему неправильная абстракция хуже дублирования.** Дублирование видно и локально: два похожих куска кода можно объединить позже, когда станет понятно, что у них действительно общее. Неправильная абстракция распространяется: на неё завязываются новые места, каждое добавляет параметр или условие, и через год её уже страшно трогать. Удалить абстракцию дороже, чем ввести её вовремя.

```csharp
public decimal CalculateFee(Order order, bool isPartner, bool isInternational,
    bool applyPromo, bool legacyRounding, FeeMode mode)
```

Так обычно выглядит «переиспользуемый» метод через год: два исходных сценария, четыре флага и `mode`, который половина вызывающих передаёт как `FeeMode.Default`. Честнее разделить обратно на два-три явных метода и выделить только реально общую часть.

**Эвристики, когда вводить абстракцию:**

- **Правило трёх.** Первый раз — пишем, второй — замечаем повтор, третий — обобщаем, глядя на три реальных случая.
- **Граница с внешним миром.** БД, сеть, брокер, время, сторонние SDK — здесь абстракция окупается почти всегда, потому что нужна для тестов и изоляции.
- **Стабильный контракт между командами или модулями.** Абстракция — это договор, она оправдана там, где нужна независимая эволюция.
- **Известный сценарий изменения.** «В следующем квартале подключаем второго платёжного провайдера» — конкретная причина; «вдруг когда-нибудь» — нет.

**Как исправлять преждевременную абстракцию:**

1. Встроить её обратно (inline) в вызывающие места — IDE делает это механически.
2. Посмотреть на получившийся конкретный код и найти реальное общее.
3. Выделить новую, меньшую абстракцию или оставить небольшое дублирование.

**Стоимость отложенного решения обычно мала.** В современном .NET-проекте выделение интерфейса из класса, замена конструкторов и обновление регистрации DI — рефакторинг на минуты. Исключение — публичные API библиотек и межсервисные контракты: их изменение дорого, и там стоит думать заранее, но даже там лучше начать с минимального контракта и расширять его.

**Что спрашивают дальше:** как это соотносится с OCP и YAGNI, что такое «wrong abstraction» и почему дублирование бывает дешевле, как вы убеждаете коллегу не вводить абстракцию на ревью (спросить про конкретный сценарий изменения, который она упростит).

## Как принимать архитектурные решения и как их документировать?

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-kak-prinimat-arhitekturnye-resheniya-i-kak-ih-dokumentirovat
tags: architecture, process
```

Архитектурное решение принимают от требований и ограничений, а не от технологий: явно формулируют проблему и критерии качества (нагрузка, задержки, консистентность, стоимость, сроки, компетенции команды), сравнивают минимум две-три альтернативы по этим критериям, оценивают обратимость решения и фиксируют результат в коротком Architecture Decision Record рядом с кодом. Главное в документации — не что выбрали, а почему и при каких условиях решение стоит пересмотреть.

**Процесс принятия:**

1. **Сформулировать проблему и драйверы.** «Нужно обрабатывать 5 000 событий в секунду с задержкой до 2 секунд, терять события нельзя, команда знает PostgreSQL и Kafka». Без измеримых требований сравнение альтернатив превращается во вкусовщину.
2. **Оценить обратимость.** Решения «двустворчатой двери» (библиотека логирования, структура папок) принимает команда быстро. Необратимые или дорогие для отмены (модель данных, границы сервисов, выбор брокера, публичный API) — требуют больше анализа и согласования.
3. **Рассмотреть альтернативы**, включая «ничего не менять» и самый простой вариант. Для каждой — плюсы, минусы, риски, стоимость владения.
4. **Снять неопределённость дёшево.** Прототип, spike, нагрузочный тест на ключевом сценарии. Неделя прототипа дешевле полугода на неудачной технологии.
5. **Обсудить с теми, кого затрагивает.** Эксплуатация, безопасность, соседние команды. Цель — не консенсус, а учёт ограничений и понятный владелец решения.
6. **Зафиксировать и сообщить.** ADR, ссылка в канале команды, при необходимости — обновлённая диаграмма.
7. **Назначить точку пересмотра.** Метрики или условия, при которых решение нужно вернуть на обсуждение.

**Формат ADR** — короткий Markdown-файл в репозитории (`docs/adr/0012-outbox-for-order-events.md`), неизменяемый после принятия; новое решение отменяет старое отдельным ADR со ссылкой.

```text
ADR-0012. Публикация событий заказа через transactional outbox

Статус: принято (2025-03-14). Заменяет: —

Контекст
Сервис заказов должен публиковать OrderPlaced в Kafka. Двойная запись
в PostgreSQL и Kafka теряет события при сбоях между ними (два инцидента за квартал).

Решение
Таблица outbox в той же транзакции, что и заказ; отдельный publisher
читает её и отправляет в Kafka; потребители идемпотентны по event_id.

Рассмотренные альтернативы
- Debezium CDC: меньше кода в сервисе, но новый компонент в эксплуатации.
- Публикация после коммита с ретраями: проще, но не гарантирует доставку.

Последствия
+ at-least-once доставка, события не теряются
- задержка публикации до ~1 с, дополнительная таблица и очистка
- потребители обязаны быть идемпотентными

Пересмотреть, если
поток событий превысит 10 000/с или появится платформенный CDC.
```

**Что делает ADR полезным, а не формальным:**

- **Контекст и альтернативы важнее решения.** Через два года новый член команды должен понять, почему не выбрали очевидный вариант, и не тратить время на повторную дискуссию.
- **Последствия, включая негативные.** Честно записанная цена решения помогает потом не удивляться.
- **Рядом с кодом и в ревью.** ADR приходит в merge request вместе с изменениями или до них; так он версионируется и находится поиском.
- **Короткий.** Одна-две страницы. Длинный документ не читают и не обновляют.

**Что ещё документировать:**

- **Диаграммы по C4** (context и container уровни) — общая картина системы для новичков и смежных команд; поддерживать как код (Structurizr DSL, Mermaid, PlantUML), иначе устаревают.
- **Fitness functions** — автоматические проверки архитектурных ограничений: архитектурные тесты зависимостей, бюджеты latency в нагрузочных тестах, линтеры контрактов. Решение, которое проверяется в CI, не размывается со временем.
- **RFC/design doc** для крупных изменений до реализации — шире ADR, с планом миграции и рисками.

**Частые ошибки:** решение «по резюме» (технология, которую хочется попробовать), отсутствие альтернатив в обсуждении, документирование задним числом без настоящего контекста, вики, оторванная от репозитория и устаревшая через квартал, и решение, у которого нет владельца.

**Что спрашивают дальше:** как вы принимали решение, с которым не была согласна часть команды, как пересматривать ADR, какие решения можно принимать без обсуждения.

## Как обосновать техдолг перед бизнесом и приоритизировать его?

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-kak-obosnovat-tehdolg-pered-biznesom-i-prioritizirovat-ego
tags: architecture, process
```

Техдолг обосновывают не словами «код плохой», а последствиями в языке бизнеса: время выхода фич, инциденты и их стоимость, риски безопасности и соответствия требованиям, стоимость инфраструктуры, скорость онбординга. Приоритизируют по соотношению «процент» (сколько долг стоит регулярно) к стоимости погашения и по тому, насколько он мешает ближайшим бизнес-целям, — а не по тому, какой код неприятнее читать.

**Как превратить техдолг в аргумент:**

| Технически | Для бизнеса |
| --- | --- |
| «Модуль биллинга связан со всем, тесты не покрывают расчёты» | «Каждое изменение тарифов занимает 3 недели вместо 3 дней и в двух из пяти последних релизов приводило к ошибкам в счетах» |
| «Устаревший .NET 6 без поддержки» | «С ноября 2024 нет патчей безопасности, аудит по требованиям клиентов-банков не пройдём» |
| «Синхронная интеграция со складом» | «При сбое склада недоступно оформление заказа: 4 инцидента за квартал, около N млн выручки» |
| «Ручной деплой» | «Релиз раз в две недели и 4 часа инженера на каждый; откат занимает час» |

**Откуда брать цифры:**

- **DORA-метрики**: lead time изменений, частота деплоев, change failure rate, время восстановления — до и после.
- **Время на фичи в проблемной области** по трекеру задач против остальных областей.
- **Инциденты и постмортемы** с указанием корневой причины и длительности; стоимость простоя.
- **Hotspots**: файлы, которые часто меняются и при этом сложны или часто фигурируют в багфиксах (анализ истории git — сочетание частоты изменений и сложности показывает, где долг реально «платит проценты»).
- **Инфраструктура**: лишние расходы на ресурсы из-за неэффективного кода.
- **Онбординг**: сколько времени новый разработчик тратит до первой самостоятельной задачи в этой области.

**Как приоритизировать:**

- **Процент против основного долга.** Плохой код в модуле, который никто не трогает, почти ничего не стоит — оставить. Сложный модуль, через который идёт половина фич, — платить в первую очередь.
- **Связь с roadmap.** Долг в области, где в следующем квартале планируются крупные фичи, — первый кандидат: его погашение ускоряет именно то, что бизнес и так хочет.
- **Риск.** Неподдерживаемые версии, известные уязвимости, единственный человек, понимающий систему, — это не «улучшения», а управление рисками с вероятностью и ущербом.
- **Стоимость и делимость.** Работа, которую можно делать инкрементально (strangler fig, постепенное покрытие тестами), лучше «переписать за полгода» — её проще продать и меньше риск.

**Как встроить в процесс:**

- **Постоянная доля мощности** (например, 15–20% каждого спринта) на улучшения без отдельного согласования каждой задачи.
- **Долг рядом с фичей.** Рефакторинг области делается в рамках задачи, которая её затрагивает (правило бойскаута), и включается в оценку.
- **Реестр техдолга** с оценкой влияния и стоимости, который регулярно пересматривается вместе с продуктом, а не список «когда-нибудь».
- **Явные сроки для сознательного долга.** Если ради дедлайна сделали упрощение, сразу заводится задача и записывается в ADR, какое условие требует возврата.

**Чего не делать:** просить «спринт на рефакторинг» без измеримой цели; предлагать переписывание с нуля как первый вариант; называть долгом всё, что сделано не по вашему вкусу; обещать ускорение без способа его потом показать. После погашения обязательно вернитесь с результатом — «изменение тарифов теперь 4 дня» — это кредит доверия на следующий раз.

**Что спрашивают дальше:** как отличить техдолг от нормального эволюционного кода, как вы договаривались с продактом в реальной ситуации, когда переписывание всё-таки оправдано.
