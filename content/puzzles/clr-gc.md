# Задачи: CLR и GC

## Порядок Dispose во вложенных using

```yaml
slug: poryadok-dispose-vo-vlozhennyh-using
category: clr-gc
level: junior
kind: output
difficulty: 2
```

Что выведет программа?

```csharp
using var a = new Res("A");
using (var b = new Res("B"))
{
    using var c = new Res("C");
    Console.Write("1");
}
Console.Write("2");

class Res(string name) : IDisposable
{
    public void Dispose() => Console.Write(name);
}
```

### Варианты

- [ ] `1BC2A`
- [x] `1CB2A`
- [ ] `12CBA`
- [ ] `1CB2`

### Разбор

`using`-объявление (`using var x = ...`, C# 8) вызывает `Dispose` в конце **охватывающей области видимости**, а `using`-оператор с блоком — в конце своего блока. Компилятор разворачивает и то и другое в `try/finally`, и вложенность этих `try/finally` определяет порядок: ресурсы освобождаются в порядке, **обратном** порядку захвата.

`c` объявлен внутри блока `b`, поэтому его `finally` вложен глубже и выполняется первым: после `1` печатается `C`, затем `B` при выходе из блока `using (var b ...)`. Потом печатается `2`, и в самом конце top-level-кода (то есть метода `Main`) освобождается `a`. `Dispose` для `a` вызовется обязательно — `finally` отрабатывает и при нормальном выходе, и при исключении.

На практике важно помнить, что `using var` держит ресурс до конца метода, а не до последнего использования переменной: соединение с БД или файловая блокировка могут жить дольше, чем кажется. Если ресурс нужен только на часть метода, лучше явный блок `using (...) { }`.

## Передача struct и class в метод

```yaml
slug: peredacha-struct-i-class-v-metod
category: clr-gc
level: junior
kind: output
difficulty: 2
```

Что выведет программа?

```csharp
var s = new S { V = 1 };
var c = new C { V = 1 };
Mutate(s, c);
Console.Write($"{s.V} {c.V}");

static void Mutate(S s, C c)
{
    s.V++;
    c.V++;
    c = new C { V = 100 };
}

struct S { public int V; }
class C { public int V; }
```

### Варианты

- [ ] `2 2`
- [x] `1 2`
- [ ] `1 100`
- [ ] `2 100`

### Разбор

В C# параметры по умолчанию передаются **по значению** — и для структур, и для классов. Разница в том, что именно копируется. Для `struct` копируется всё содержимое: метод получает собственный экземпляр `S`, и `s.V++` меняет копию — у вызывающего остаётся `1`.

Для `class` копируется **ссылка** на объект в куче. Обе ссылки указывают на один объект, поэтому `c.V++` видно снаружи — `2`. А присваивание `c = new C { ... }` меняет только локальную копию ссылки внутри метода: вызывающий код по-прежнему указывает на старый объект, и `100` он не увидит.

Чтобы изменения структуры или переприсваивание ссылки были видны снаружи, нужен `ref`: `Mutate(ref s, ref c)`. Для больших структур, которые не надо менять, есть `in` — передача по ссылке без копирования, но с риском защитных копий при вызове не-`readonly` методов. Поэтому структуры принято делать маленькими и неизменяемыми.

## Финализатор и Dispose

```yaml
slug: finalizator-i-dispose
category: clr-gc
level: senior
kind: bug
difficulty: 4
```

В чём проблема этого кода?

```csharp
using System.Runtime.InteropServices;

using (var buffer = new NativeBuffer()) { }

class NativeBuffer : IDisposable
{
    private readonly IntPtr _ptr = Marshal.AllocHGlobal(1024);
    private readonly FileStream _log = File.OpenWrite("log.txt");

    ~NativeBuffer() => Dispose();

    public void Dispose()
    {
        _log.Dispose();
        Marshal.FreeHGlobal(_ptr);
    }
}
```

### Варианты

- [ ] Финализатор никогда не вызовется, потому что класс реализует `IDisposable`
- [ ] `Marshal.AllocHGlobal` выделяет память в управляемой куче, и освобождать её вручную не нужно
- [x] `Dispose` не вызывает `GC.SuppressFinalize` и не защищён от повторного вызова: финализатор освободит `_ptr` второй раз
- [ ] `FileStream` не закрывается при вызове `Dispose`

### Разбор

Объект с финализатором при создании регистрируется в очереди финализации. Явный `Dispose()` этого не отменяет: без `GC.SuppressFinalize(this)` после сборки объекта финализатор всё равно выполнится на потоке финализации, снова вызовет `Dispose()` и сделает `Marshal.FreeHGlobal` по уже освобождённому указателю. Двойное освобождение неуправляемой памяти — повреждение кучи и падение процесса в случайный момент, далеко от места ошибки.

Вторая проблема — финализатор трогает управляемый объект `_log`. Порядок финализации не определён, и к этому моменту `FileStream` может быть уже финализирован. Плюс объект с финализатором переживает лишнюю сборку мусора (его продвигают в следующее поколение, чтобы выполнить финализатор), а исключение, вылетевшее из финализатора, завершает процесс.

Каноничный паттерн — `Dispose(bool disposing)`: управляемые ресурсы освобождаются только при `disposing == true`, неуправляемые — всегда, флаг `_disposed` защищает от повторов, а публичный `Dispose()` вызывает `GC.SuppressFinalize(this)`. Ещё лучше — обернуть указатель в `SafeHandle`: у него уже есть корректный критический финализатор, и собственный финализатор классу не нужен вовсе.

## Подписка на событие долгоживущего объекта

```yaml
slug: podpiska-na-sobytie-dolgozhivushchego-obekta
category: clr-gc
level: middle
kind: bug
difficulty: 3
```

В чём проблема этого кода?

```csharp
var feed = new PriceFeed();
for (var i = 0; i < 1000; i++)
{
    var widget = new PriceWidget(feed);
    widget.Render();
}

class PriceFeed
{
    public event Action<decimal>? PriceChanged;
    public void Publish(decimal price) => PriceChanged?.Invoke(price);
}

class PriceWidget
{
    private readonly byte[] _buffer = new byte[100_000];
    public PriceWidget(PriceFeed feed) => feed.PriceChanged += OnPrice;
    private void OnPrice(decimal price) => _buffer[0] = (byte)price;
    public void Render() { }
}
```

### Варианты

- [ ] `Publish` бросит `NullReferenceException`, если подписчиков нет
- [ ] GC соберёт виджеты, и событие вызовет обработчик у уже уничтоженного объекта
- [x] Каждый `PriceWidget` остаётся в подписчиках `feed` и не собирается GC, пока жив `feed`
- [ ] Массивы по 100 000 байт выделяются на стеке и переполнят его

### Разбор

`feed.PriceChanged += OnPrice` создаёт делегат, у которого поле `Target` ссылается на экземпляр `PriceWidget`, и добавляет его в список вызовов события. Получается цепочка корней: `feed` → делегат → виджет → `_buffer`. Пока жив `feed`, ни один из тысячи виджетов не становится недостижимым для GC, хотя в коде на них больше никто не ссылается. Это самая частая управляемая утечка памяти.

Здесь это ещё и дорого: каждый массив больше 85 000 байт и попадает в Large Object Heap, который собирается только вместе с поколением 2. А каждый `Publish` будет вызывать обработчики у всех «мёртвых» виджетов — растёт не только память, но и время.

Исправление — отписываться, когда подписчик больше не нужен: реализовать `IDisposable` с `feed.PriceChanged -= OnPrice` и вызывать его. Альтернативы — слабые события (`WeakEventManager` в WPF, `ConditionalWeakTable`, `WeakReference` к подписчику) или `IObservable` с возвратом `IDisposable` из `Subscribe`. Обратная ситуация безопасна: если короткоживущий объект является источником события, а подписчик живёт долго, утечки нет.

## Статический кэш с замыканием

```yaml
slug: staticheskij-kesh-s-zamykaniem
category: clr-gc
level: senior
kind: bug
difficulty: 4
```

В чём проблема этого кода?

```csharp
Console.WriteLine(ReportFormatter.Format(Guid.NewGuid(), new byte[10]));

static class ReportFormatter
{
    private static readonly Dictionary<Guid, Func<string>> Cache = new();

    public static string Format(Guid reportId, byte[] content)
    {
        if (!Cache.TryGetValue(reportId, out var render))
        {
            render = () => Convert.ToBase64String(content);
            Cache[reportId] = render;
        }
        return render();
    }
}
```

### Варианты

- [ ] Лямбда захватывает копию массива, поэтому потребление памяти удваивается
- [ ] Делегат пересоздаётся при каждом вызове, и кэш никогда не срабатывает
- [ ] `Convert.ToBase64String` бросает исключение на массиве из нулей
- [x] Статический словарь без вытеснения навсегда удерживает замыкания, а через них — все массивы `content`

### Разбор

Лямбда захватывает параметр `content`, поэтому компилятор создаёт класс-замыкание с полем `content` и делегат, `Target` которого указывает на экземпляр этого класса. Цепочка ссылок: статическое поле `Cache` (корень GC, живёт до конца процесса) → словарь → делегат → замыкание → массив. Ключи — уникальные `Guid`, удаления нет, поэтому каждый вызов с новым отчётом навсегда оставляет в памяти его содержимое. Захватывается именно ссылка на массив, а не копия, но и одной ссылки достаточно, чтобы массив никогда не собрался.

Кэш к тому же бессмысленный: он хранит не результат, а способ его вычислить, и `Convert.ToBase64String` выполняется при каждом вызове. А `Dictionary` без синхронизации при параллельных записях из разных запросов может повредить свою внутреннюю структуру.

Исправление: если кэш действительно нужен — хранить готовую строку, а не делегат, и использовать `MemoryCache` с ограничением размера (`SizeLimit`) и временем жизни записей; для параллельного доступа — `ConcurrentDictionary` или `MemoryCache`. Общее правило: всё, что попадает в статическое поле, живёт до конца процесса вместе со всем, на что ссылается, включая неявно захваченные замыканиями переменные.

## stackalloc и размер входных данных

```yaml
slug: stackalloc-i-razmer-vhodnyh-dannyh
category: clr-gc
level: senior
kind: bug
difficulty: 4
```

В чём проблема этого кода?

```csharp
Console.WriteLine(ToHex(new byte[] { 1, 171 }));

static string ToHex(ReadOnlySpan<byte> data)
{
    Span<char> buffer = stackalloc char[data.Length * 2];
    for (var i = 0; i < data.Length; i++)
    {
        data[i].TryFormat(buffer.Slice(i * 2, 2), out _, "x2");
    }
    return new string(buffer);
}
```

### Варианты

- [ ] `new string(buffer)` возвращает строку, ссылающуюся на память стека, которая освободится после выхода из метода
- [x] Размер `stackalloc` зависит от входа: на большом массиве будет `StackOverflowException`, который нельзя перехватить
- [ ] Память, выделенную `stackalloc`, нужно освобождать вручную
- [ ] `TryFormat` не умеет писать в `Span<char>`, результат будет пустой строкой

### Разбор

`stackalloc` выделяет память прямо в кадре стека текущего метода — это быстро и не нагружает GC, но стек потока мал (по умолчанию порядка 1 МБ на Windows). Здесь размер буфера — `data.Length * 2` символов, то есть по 4 байта стека на каждый входной байт. Массив в 1 МБ потребует 4 МБ стека, и процесс упадёт со `StackOverflowException`. Это исключение нельзя перехватить `catch`: среда выполнения просто завершает процесс.

Остальные варианты неверны: конструктор `new string(ReadOnlySpan<char>)` копирует символы в новую строку в куче, а память `stackalloc` освобождается автоматически при выходе из метода. Отсюда, кстати, ещё одна ловушка: `stackalloc` внутри цикла не освобождается на каждой итерации и копится до возврата из метода (анализатор CA2014).

Стандартный паттерн — порог: маленькие буферы на стеке, большие в куче или из пула:

```csharp
Span<char> buffer = data.Length <= 128
    ? stackalloc char[data.Length * 2]
    : new char[data.Length * 2];
```

Для больших и частых буферов вместо `new` берут `ArrayPool<char>.Shared.Rent` с возвратом в `finally`. А конкретно для этой задачи есть готовые `Convert.ToHexString` и `Convert.ToHexStringLower` (.NET 9+).

## Сборка строки в цикле

```yaml
slug: sborka-stroki-v-cikle
category: clr-gc
level: junior
kind: bug
difficulty: 2
```

В чём проблема этого кода?

```csharp
var orders = Enumerable.Range(1, 5).Select(i => new Order(i, i * 10m));
Console.Write(BuildCsv(orders));

static string BuildCsv(IEnumerable<Order> orders)
{
    var csv = "Id;Total\n";
    foreach (var order in orders)
        csv += $"{order.Id};{order.Total}\n";
    return csv;
}

record Order(int Id, decimal Total);
```

### Варианты

- [ ] Строка `csv` изменяется на месте, и при параллельных вызовах данные перемешаются
- [x] Каждая конкатенация копирует всю накопленную строку: O(n²) по времени и памяти
- [ ] `foreach` заранее материализует весь `IEnumerable` в список
- [ ] Интерполяция в цикле компилируется в `string.Format` с рефлексией на каждой итерации

### Разбор

Строки в .NET неизменяемы. `csv += ...` не дописывает текст в существующую строку, а создаёт **новую**, копируя в неё всё накопленное содержимое плюс новый фрагмент. На `n`-й итерации копируется примерно `n` строк, итого O(n²) копирования символов и `n` промежуточных строк-мусора. На пяти заказах это незаметно, на ста тысячах — секунды CPU и гигабайты аллокаций.

Как только строка вырастает больше 85 000 байт (примерно 42 500 символов), каждая новая копия выделяется в Large Object Heap, который собирается только вместе с поколением 2, — это частые полные сборки мусора и фрагментация.

Исправление — `StringBuilder`, который дописывает в расширяемый буфер с амортизированным O(1) на добавление, или `string.Join` по последовательности строк. Если результат всё равно уходит в файл или HTTP-ответ, лучше вообще не собирать его целиком в памяти, а писать построчно в `StreamWriter`/`PipeWriter`. Вариант с параллельностью неверен именно из-за неизменяемости строк, а интерполяция с C# 10 компилируется в `DefaultInterpolatedStringHandler` без рефлексии.
