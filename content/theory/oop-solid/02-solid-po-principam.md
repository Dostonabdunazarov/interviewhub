---
title: SOLID по принципам
slug: solid-po-principam
track: code-design
section: oop-solid
level: middle
sortOrder: 2
summary: Пять принципов SOLID на примерах кода: что каждый говорит на самом деле, как выглядит нарушение и чем DIP отличается от DI-контейнера.
---

SOLID — пять принципов объектного дизайна, собранных Робертом Мартином. Расшифровать аббревиатуру может любой кандидат, поэтому на собеседовании её почти не спрашивают в лоб. Спрашивают иначе: «приведите пример нарушения SRP из своего кода» или «чем DIP отличается от DI». Все пять принципов про одно — как устроить зависимости, чтобы изменение в одном месте не расползалось по системе, — и каждый удобнее понимать через симптом, который он лечит.

| Буква | Принцип | Симптом нарушения |
| --- | --- | --- |
| **S** | Single Responsibility | класс правят по несвязанным причинам разные люди |
| **O** | Open/Closed | каждый новый вариант — правка одного и того же `switch` |
| **L** | Liskov Substitution | в клиентском коде появляются `if (x is Special)` |
| **I** | Interface Segregation | реализации бросают `NotSupportedException` |
| **D** | Dependency Inversion | бизнес-логику не протестировать без базы и сети |

## S — одна причина для изменения

Самое частое заблуждение — «один класс делает одну вещь» или «один метод на класс». Мартин формулирует иначе: у модуля должна быть одна **причина меняться**, то есть один источник требований.

```csharp
public sealed class InvoiceService(AppDb db, SmtpSender smtp)
{
    public async Task IssueAsync(int orderId)
    {
        var order = await db.LoadOrderAsync(orderId);
        var vat = order.Subtotal * 0.2m;
        var pdf = PdfRenderer.Render(order, vat, logo: "logo-2024.png");
        await smtp.SendAsync(order.CustomerEmail, "Счёт", pdf);
    }
}
```

Метод короткий, но его будут менять три разные группы людей: бухгалтерия (ставка НДС, правила округления), дизайнеры (макет счёта) и те, кто отвечает за доставку писем. Правка макета пересобирает и перетестирует расчёт налога.

```csharp
public sealed class InvoiceCalculator
{
    public Invoice Calculate(OrderData order) =>
        new(order.Id, order.Subtotal, Math.Round(order.Subtotal * 0.2m, 2));
}

public sealed class InvoiceIssuer(
    AppDb db, InvoiceCalculator calculator, IInvoiceRenderer renderer, IInvoiceDelivery delivery)
{
    public async Task IssueAsync(int orderId)
    {
        var order = await db.LoadOrderAsync(orderId);
        var invoice = calculator.Calculate(order);
        var document = renderer.Render(invoice);
        await delivery.DeliverAsync(order.CustomerEmail, document);
    }
}
```

Теперь `InvoiceIssuer` только координирует, а каждое правило меняется в своём месте. Обратите внимание: `InvoiceCalculator` — конкретный класс, без интерфейса. SRP — про причины изменений, а не про количество интерфейсов.

## O — расширение без правки

Принцип открытости/закрытости говорит: поведение расширяется **добавлением** кода, а не правкой существующего. Нарушение выглядит как `switch`, в который каждый месяц дописывают ветку:

```csharp
public static class DiscountCalculator
{
    public static decimal Discount(Cart cart, string promo) => promo switch
    {
        "NEWBIE" => cart.Subtotal * 0.1m,
        "BLACKFRIDAY" => cart.Subtotal * 0.3m,
        "FREESHIP" => cart.Shipping,
        _ => 0m
    };
}
```

Если правила скидок действительно растут, каждое из них можно сделать отдельным классом:

```csharp
public interface IDiscountRule
{
    decimal Apply(Cart cart);
}

public sealed class PriceCalculator(IEnumerable<IDiscountRule> rules)
{
    public decimal Total(Cart cart) =>
        cart.Subtotal + cart.Shipping - rules.Sum(r => r.Apply(cart));
}
```

Новая скидка — новый класс и строка регистрации в DI, калькулятор не трогается. Важная оговорка: OCP не запрещает править код. Он говорит, что в местах, где **ожидаются** новые варианты, нужно заранее оставить точку расширения. Если за два года появилось три промокода, `switch` из первого примера лучше — это разобрано в статье `Strategy vs switch`.

## L — подстановка без сюрпризов

Принцип Лисков: код, написанный против базового типа, должен работать с любым наследником без проверок типа. Это про поведение, а не про сигнатуры: наследник не должен требовать больше, гарантировать меньше или бросать исключения, которых база не обещала.

Пример прямо из BCL — массив реализует `IList<T>`, но `Add` у него бросает `NotSupportedException`:

```csharp
public static class Lsp
{
    public static void AddDefault(IList<string> items) => items.Add("default");

    public static void Run()
    {
        AddDefault(new List<string>());
        AddDefault(new string[1]);
    }
}
```

Второй вызов упадёт во время выполнения, хотя компилятор всё пропустил. Этот принцип стоит отдельного разбора — он в статье `Нарушение LSP на реальном коде`.

## I — узкие интерфейсы

Клиент не должен зависеть от методов, которыми не пользуется. Нарушение — «толстый» интерфейс, который реализации заполняют заглушками:

```csharp
public interface IUserStore
{
    Task<User?> FindAsync(int id);
    Task<IReadOnlyList<User>> SearchAsync(string query);
    Task SaveAsync(User user);
    Task DeleteAsync(int id);
    Task<byte[]> ExportCsvAsync();
}
```

Сервису профиля нужен один `FindAsync`, но в тесте придётся реализовать все пять методов, а кэширующая реализация «только для чтения» будет бросать исключения на `SaveAsync`. Разделение по реальным клиентам:

```csharp
public interface IUserReader
{
    Task<User?> FindAsync(int id);
    Task<IReadOnlyList<User>> SearchAsync(string query);
}

public interface IUserWriter
{
    Task SaveAsync(User user);
    Task DeleteAsync(int id);
}
```

Экспорт в CSV — вообще не про хранилище и уходит в отдельный класс. В BCL этот принцип виден на коллекциях: рядом с `IList<T>` есть `IReadOnlyList<T>`, и метод, которому нужно только читать, принимает его.

## D — инверсия зависимостей

Формулировка: модули верхнего уровня не зависят от модулей нижнего уровня; оба зависят от абстракции. Ключевое слово — **инверсия**: абстракцией владеет тот, кто её использует, а не тот, кто реализует.

```csharp
public interface IPaymentGateway
{
    Task<bool> ChargeAsync(string customerId, decimal amount, CancellationToken ct);
}

public sealed class SubscriptionRenewal(IPaymentGateway payments, TimeProvider time)
{
    public async Task<bool> RenewAsync(Subscription s, CancellationToken ct)
    {
        if (s.PaidUntil > time.GetUtcNow())
            return false;

        return await payments.ChargeAsync(s.CustomerId, s.Price, ct);
    }
}
```

Интерфейс `IPaymentGateway` лежит в модуле подписок и описан в его терминах. Реализация для конкретного платёжного провайдера живёт в инфраструктуре и зависит от этого интерфейса — стрелка зависимости развёрнута снизу вверх. Время абстрагировано через встроенный `TimeProvider`, и в тесте его заменяет `FakeTimeProvider`.

Три понятия, которые часто смешивают:

- **DIP** — принцип о направлении зависимостей между модулями;
- **IoC** — общая идея «не ты вызываешь фреймворк, а он тебя»;
- **DI** — техника передачи зависимостей снаружи, обычно через конструктор.

DI-контейнер — лишь способ собрать граф объектов, он устроен в статье `DI и жизненные циклы`. Можно внедрять зависимости через контейнер и при этом нарушать DIP: если интерфейс лежит в инфраструктурной сборке рядом с реализацией и повторяет её методы один в один, зависимость по-прежнему направлена вниз — просто через лишний тип.

## Как принципы связаны между собой

Принципы не независимы. Узкие интерфейсы (I) упрощают честную подстановку (L): чем меньше обещает контракт, тем проще его выполнить. Точки расширения (O) обычно строятся на полиморфизме и инверсии (D). А SRP задаёт, где проводить границы, вокруг которых всё остальное строится.

И у всех пяти есть цена. Применённые без реальной изменчивости, они превращаются в интерфейс на каждый класс и пять файлов вместо трёх строк логики. Об этом — статья `Где SOLID вредит`.

## Что стоит ответить на собеседовании

SRP — одна причина для изменения, то есть один источник требований, а не «один метод на класс». OCP — новые варианты добавляются новым кодом там, где изменчивость ожидается, а не везде. LSP — наследник подставляется без проверок типа: не усиливает предусловия, не ослабляет постусловия, не бросает новых исключений; пример из BCL — `Add` у массива, приведённого к `IList<T>`. ISP — клиент зависит только от нужных ему методов, отсюда `IReadOnlyList<T>` рядом с `IList<T>`. DIP — абстракцией владеет потребитель, и DIP не равен DI-контейнеру.

Сильный ответ приведёт нарушение каждого принципа из реального кода и сам назовёт цену: SOLID — эвристики, и слепое следование им даёт лишние слои.
