---
title: Нарушение LSP на реальном коде
slug: narushenie-lsp-na-realnom-kode
track: code-design
section: oop-solid
level: senior
sortOrder: 3
summary: Почему принцип Лисков — про поведение, а не про сигнатуры, как выглядят его нарушения в сервисах и в BCL и как ловить их контрактными тестами.
---

Принцип подстановки Барбары Лисков звучит академично: свойства, доказуемые для объектов базового типа, должны выполняться и для объектов подтипа. В практических терминах — код, написанный против абстракции, должен одинаково правильно работать с любой её реализацией, без `if (x is Special)` и без `try/catch NotSupportedException`. На собеседовании про квадрат и прямоугольник уже рассказывают все; отличает кандидата пример из живого сервиса и понимание, что компилятор здесь не помощник: он проверяет сигнатуры, а LSP — про поведение.

## Контракт — это больше, чем сигнатура

У любого метода, помимо типов параметров, есть неявный договор:

- **предусловия** — что метод требует от вызывающего;
- **постусловия** — что он гарантирует после возврата;
- **инварианты** — что остаётся истинным всегда;
- **исключения** — какие ошибки возможны и в каких случаях.

Подтип может предусловия **ослабить** (принимать больше), а постусловия **усилить** (гарантировать больше). Наоборот — нельзя. Всё, что требует больше или обещает меньше, ломает код, который честно писали против базы.

## Хрестоматия: квадрат и прямоугольник

```csharp
public class Rectangle
{
    public virtual int Width { get; set; }
    public virtual int Height { get; set; }
    public int Area => Width * Height;
}

public sealed class Square : Rectangle
{
    public override int Width
    {
        get => base.Width;
        set { base.Width = value; base.Height = value; }
    }

    public override int Height
    {
        get => base.Height;
        set { base.Width = value; base.Height = value; }
    }
}
```

Код, который ставит ширину 5 и высоту 4, ожидает площадь 20 и получит 16. Квадрат «является» прямоугольником в геометрии, но не в поведении изменяемого объекта: у прямоугольника есть неявное постусловие «установка ширины не меняет высоту». Для неизменяемых фигур проблемы бы не было — нарушение возникает из-за сеттеров.

Этот пример полезен как иллюстрация, но на собеседовании лучше сразу перейти к реальному.

## Пример из сервиса: хранилище, которое нельзя удалить

Есть абстракция файлового хранилища, через которую работают загрузка документов и фоновая очистка временных файлов:

```csharp
public interface IFileStorage
{
    Task SaveAsync(string path, Stream content, CancellationToken ct);
    Task<Stream> OpenReadAsync(string path, CancellationToken ct);
    Task DeleteAsync(string path, CancellationToken ct);
}
```

Для юридических документов появляется архив с WORM-политикой (write once, read many) — записанное нельзя ни изменить, ни удалить:

```csharp
public sealed class ArchiveStorage(IWormBucket bucket) : IFileStorage
{
    public Task SaveAsync(string path, Stream content, CancellationToken ct) =>
        bucket.PutIfAbsentAsync(path, content, ct);

    public Task<Stream> OpenReadAsync(string path, CancellationToken ct) =>
        bucket.GetAsync(path, ct);

    public Task DeleteAsync(string path, CancellationToken ct) =>
        throw new NotSupportedException("Архив неизменяем.");
}
```

Всё компилируется, ревью проходит. Через месяц задача очистки, получающая `IFileStorage` из DI, падает в проде на `DeleteAsync`. А `SaveAsync` по существующему пути у архива молча ничего не делает, тогда как обычное хранилище перезаписывает файл, — то есть ослаблено постусловие «после возврата по этому пути лежит переданное содержимое».

Исправление — не обработка исключения в задаче очистки, а честные контракты:

```csharp
public interface IFileReader
{
    Task<Stream> OpenReadAsync(string path, CancellationToken ct);
}

public interface IMutableFileStorage : IFileReader
{
    Task SaveAsync(string path, Stream content, CancellationToken ct);
    Task DeleteAsync(string path, CancellationToken ct);
}

public interface IArchive : IFileReader
{
    Task AppendAsync(string path, Stream content, CancellationToken ct);
}
```

Архив больше не притворяется обычным хранилищем, у его записи честное имя с семантикой «только добавить», и задача очистки физически не может его получить — она зависит от `IMutableFileStorage`. Заодно это ISP: интерфейсы разделены по реальным возможностям.

## Другие формы нарушения

**Усиленное предусловие.** База принимает любой `Stream`, реализация требует `CanSeek == true`, потому что дважды читает содержимое — сначала для хеша, потом для загрузки. На сетевом потоке она падает.

**Ослабленное постусловие.** `SaveAsync` у репозитория обещает, что после возврата данные сохранены. Кэширующая реализация с отложенной записью возвращается раньше и при падении процесса теряет данные. Внешне — тот же интерфейс.

**Новое исключение в декораторе.** Обёртка с таймаутом бросает `TimeoutException`, а вызывающий код писался против реализации, которая так не делала, и обрабатывает только `HttpRequestException`. Декоратор — тоже подтип, и правила для него те же.

**Изменённая семантика перечисления.** Метод принимает `IEnumerable<T>` и перечисляет его дважды:

```csharp
public static class Report
{
    public static string Summary(IEnumerable<decimal> amounts) =>
        $"{amounts.Count()} платежей на {amounts.Sum()}";
}
```

Со списком всё работает. С ленивой последовательностью, которая читает из базы, запрос выполнится дважды; с последовательностью над сетевым потоком второе перечисление вернёт пустоту или упадёт. Формально нарушение здесь у вызывающего — он предполагает больше, чем обещает `IEnumerable<T>`. Лекарство — принимать `IReadOnlyCollection<T>`, если нужно несколько проходов.

## Нарушения в самой BCL

Хорошая деталь для собеседования — LSP нарушается и в стандартной библиотеке, осознанно.

- **Массив как `IList<T>`.** `Add` и `Remove` бросают `NotSupportedException`. Интерфейс был спроектирован до появления `IReadOnlyList<T>`, и массивы получили его ради совместимости.
- **`ReadOnlyCollection<T>`** реализует `IList<T>` и бросает исключение на любую запись.
- **Ковариантность массивов.** `object[] items = new string[1]` компилируется, а `items[0] = 42` бросает `ArrayTypeMismatchException`. Массив строк подставлен вместо массива объектов, но не выполняет его контракт на запись — подробнее в статье `Ковариантность и контравариантность`.
- **`Stream`** решает проблему флагами `CanRead`, `CanWrite`, `CanSeek`: контракт честно говорит, что возможности различаются, и перекладывает проверку на клиента.

Флаги возможностей — легитимный компромисс, когда разделить интерфейсы уже нельзя. Но цена видна: каждый клиент обязан помнить про проверку, и забытая проверка снова превращается в исключение во время выполнения.

## Как ловить заранее: контрактные тесты

Компилятор нарушение не найдёт, поэтому его ловят тестами — одним набором против интерфейса, который прогоняется для каждой реализации:

```csharp
public abstract class FileStorageContract
{
    protected abstract IMutableFileStorage CreateStorage();

    [Fact]
    public async Task Save_overwrites_existing_file()
    {
        var storage = CreateStorage();
        await storage.SaveAsync("a.txt", new MemoryStream([1]), CancellationToken.None);
        await storage.SaveAsync("a.txt", new MemoryStream([2]), CancellationToken.None);

        await using var read = await storage.OpenReadAsync("a.txt", CancellationToken.None);
        Assert.Equal(2, read.ReadByte());
    }
}

public sealed class InMemoryStorageTests : FileStorageContract
{
    protected override IMutableFileStorage CreateStorage() => new InMemoryStorage();
}
```

Каждая новая реализация получает наследника с одной строкой и проходит те же проверки. Если для реализации приходится отключать тесты контракта — она этот контракт не выполняет, и это повод разделить интерфейс, а не добавить исключение.

## Признаки нарушения в код-ревью

- проверка типа реализации в клиенте: `if (storage is ArchiveStorage)`;
- `NotSupportedException` или `NotImplementedException` в реализации метода интерфейса;
- комментарий или документация вида «не вызывать для …»;
- наследник переопределяет метод пустым телом, чтобы «отключить» поведение базы;
- `try/catch` вокруг вызова, который для остальных реализаций никогда не бросает.

## Что стоит ответить на собеседовании

LSP — про поведение, а не про сигнатуры: подтип не может усиливать предусловия, ослаблять постусловия, нарушать инварианты базы и бросать исключения, которых база не обещала. Внешний признак — проверки типа и `catch NotSupportedException` в клиентском коде. Пример лучше брать живой: хранилище, которое не умеет удалять, кэш с отложенной записью, декоратор с новым исключением. Из BCL — массив как `IList<T>` с исключением на `Add` и ковариантность массивов с `ArrayTypeMismatchException`.

Сильный ответ назовёт исправление — разделение интерфейса по реальным возможностям, а не обработку исключения у клиента, — и способ ловить нарушения заранее: контрактные тесты, общие для всех реализаций.
