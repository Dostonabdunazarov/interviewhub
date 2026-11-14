---
title: Что компилятор делает за вас
slug: cs-chto-delaet-kompilyator
track: dotnet-backend
section: csharp-lang
level: senior
sortOrder: 14
summary: Как CLR компилирует generics для классов и структур, какие конструкции C# работают по шаблону, а не через интерфейс, как records чинят равенство в иерархии и как interpolated string handlers убирают форматирование.
questions: csharp-kak-clr-realizuet-generics-i-pochemu-kod-dlya-value-types-specializiruetsya-a-dly, csharp-kakie-konstrukcii-c-kompilyator-razvorachivaet-po-shablonu-a-ne-cherez-interfeisy, csharp-kak-korrektno-realizovat-ravenstvo-v-ierarhii-tipov-i-zachem-records-ispolzuyut-e, csharp-kak-rabotayut-interpolated-string-handlers-i-kak-s-ih-pomoschyu-ubrat-allokacii-i
---

Значительная часть производительности C# зависит не от того, что вы написали, а от того, во что это превратили компилятор Roslyn и JIT. Одна и та же строка `foreach` аллоцирует или нет в зависимости от статического типа переменной, `$"..."` может вообще не вычислить выражения в фигурных скобках, а `List<int>` работает без упаковки, потому что для него сгенерирован отдельный машинный код.

На уровне senior спрашивают именно про эти механизмы: где обычный синтаксис превращается в вызовы методов, найденных по имени, и чем за это платят.

## Generics: общий код для классов, отдельный для структур

В отличие от type erasure в Java, generics в .NET существуют в рантайме: `List<int>` и `List<string>` — разные типы со своими `MethodTable` и своими статическими полями. Машинный код JIT строит по-разному.

Для всех reference-типов метод компилируется **один раз** — как инстанциация над `System.__Canon`. Ссылка всегда занимает одинаково места, и GC отслеживает её одинаково, поэтому `List<string>` и `List<object>` делят код. Для каждого value type код **специализируется**: размер и layout у `int`, `double` и вашей структуры разные. Поэтому `List<int>` хранит `int` в `int[]` и сравнивает их напрямую — без упаковки, которая была бы неизбежна в `ArrayList` (см. `Упаковка и распаковка`).

В общем коде JIT не знает точный `T`, а операциям вроде `typeof(T)`, `new T()`, обращения к `Cache<T>.Value` или вызова другого generic-метода он нужен. Такие обращения идут через **generic dictionary** — таблицу слотов, которые заполняются лениво. Для экземплярных методов контекст берётся из `MethodTable` объекта `this`, а статическим и generic-методам передаётся скрытый параметр с указателем на конкретную инстанциацию.

```csharp
static bool IsDefault<T>(T value) => EqualityComparer<T>.Default.Equals(value, default);

IsDefault(42);
IsDefault("x");
```

Для `IsDefault<int>` JIT девиртуализует компаратор и может свести вызов к `value == 0`. Для `IsDefault<string>` выполняется общий код над `__Canon`: поиск компаратора через словарь и виртуальный вызов.

Специализация даёт ещё несколько вещей. `typeof(T) == typeof(int)` для value type становится константой, и мёртвая ветка вырезается — на этом построены многие оптимизации BCL. Вызов метода интерфейса через ограничение `where T : IComparable<T>` компилируется в `constrained. callvirt`, и для структуры это прямой вызов без упаковки. Тот же механизм лежит под generic math и `static abstract` членами интерфейсов: передав поведение через параметр-структуру, получаете аналог шаблонов C++ с инлайнингом.

Цена тоже есть. Каждая инстанциация над структурой — отдельная JIT-компиляция и отдельный машинный код, сотни разных `Dictionary<TStruct, ...>` заметно утяжеляют прогрев. `new T()` превращается в `Activator.CreateInstance<T>()`, что для классов дороже прямого `new`. Generic virtual methods диспетчеризуются через поиск в хеш-таблице рантайма, а не через слот vtable. Под Native AOT `MakeGenericType` над структурой, о которой компилятор не знал, может упасть в рантайме — отсюда предупреждения `RequiresDynamicCode`. И сами ограничения код не ускоряют: выигрыш даёт только то, что `T` оказался value type.

## Конструкции по шаблону, а не по интерфейсу

Многие конструкции C# привязаны к **шаблону**: компилятор ищет метод с нужным именем и сигнатурой, экземплярный или часто extension. Интерфейс — лишь запасной путь. Смысл в том, чтобы тип мог отдать структуру напрямую и обойтись без упаковки и интерфейсных вызовов.

**`foreach`** ищет доступный `GetEnumerator()`, возвращающий тип с `MoveNext()` и `Current`; с C# 9 подходит и extension. `List<T>` возвращает `List<T>.Enumerator` — структуру:

```csharp
var list = new List<int> { 1, 2, 3 };
foreach (var x in list) { }

IEnumerable<int> seq = list;
foreach (var x in seq) { }
```

Замер на .NET 10 через `GC.GetAllocatedBytesForCurrentThread()`: первый цикл — 0 байт, второй — 40 байт на каждый проход, это упакованный енумератор плюс интерфейсные вызовы `MoveNext`/`Current`. Для массивов и `Span<T>` `foreach` вообще превращается в `for` по индексу. Отсюда правило для горячих API: возвращать конкретный тип, а не `IEnumerable<T>`, если вызывающему важны аллокации. Обратная ловушка — изменяемый struct-енумератор в `readonly`-поле: каждый `MoveNext()` вызывается на защитной копии, и енумератор не сдвигается.

**`await`** требует `GetAwaiter()` (можно extension), а у awaiter — `IsCompleted`, `GetResult()` и реализации `INotifyCompletion`. Наполовину шаблон, наполовину интерфейс — именно поэтому `ValueTask` и `ConfigureAwait` работают со struct-awaiter (подробнее — `Как работает async/await`).

**`using`** для `ref struct` достаточно метода `Dispose()`: до C# 13 `ref struct` не мог реализовать интерфейсы. `await using` ищет `DisposeAsync()`.

**Деконструкция** `var (k, v) = pair` ищет `Deconstruct(out ..., out ...)`: у `KeyValuePair` он есть, у records и кортежей генерируется.

**Collection initializer** `new List<int> { 1, 2, 3 }` требует `IEnumerable` и разворачивается в вызовы `Add` на каждый элемент — без заданной ёмкости. Collection expressions из C# 12 умнее: `ReadOnlySpan<int> r = [1, 2, 3]` берёт данные из секции сборки без аллокации, `List<int> l = [x, y, z]` создаётся с точной ёмкостью, а свой тип подключается через `[CollectionBuilder]`.

**LINQ query syntax** `from x in src where … select …` переписывается в вызовы `Where`/`Select` по имени — подойдёт любой тип с такими методами, интерфейс не нужен. Сюда же относятся индексы и диапазоны (`list[^1]` — это `list[list.Count - 1]`, но `array[1..3]` создаёт копию массива), `fixed` через `GetPinnableReference()` и `await foreach` через `GetAsyncEnumerator()`.

## Равенство в иерархии и EqualityContract

Контракт `Equals` требует симметричности и транзитивности (общие правила — в `Equals, GetHashCode и ==`). В иерархии с дополнительными полями они ломаются почти неизбежно. Пусть `Point(X, Y)` сравнивает координаты, а `ColorPoint : Point` добавляет `Color`. Если `ColorPoint.Equals` отвечает `false` на «просто `Point`», то `p.Equals(cp)` истинно, а `cp.Equals(p)` — ложно. Если откатывается к сравнению координат, то красная и синяя точки равны обычной, но не друг другу — нарушена транзитивность. `HashSet` после этого ведёт себя в зависимости от порядка вставки.

Рабочих решений три: `sealed`, сравнение точного runtime-типа или records. Ручной вариант:

```csharp
public virtual bool Equals(Point? other) =>
    other is not null && other.GetType() == GetType() && X == other.X && Y == other.Y;

public override int GetHashCode() => HashCode.Combine(GetType(), X, Y);
```

Records делают то же самое, но через виртуальное свойство. Для `record Point(int X, int Y)` компилятор генерирует, упрощённо:

```csharp
protected virtual Type EqualityContract => typeof(Point);

public virtual bool Equals(Point? other) =>
    (object)this == other ||
    other is not null && EqualityContract == other.EqualityContract &&
    EqualityComparer<int>.Default.Equals(X, other.X) &&
    EqualityComparer<int>.Default.Equals(Y, other.Y);
```

Наследник `record ColorPoint(...) : Point(X, Y)` переопределяет `EqualityContract` на свой тип, а его `Equals` вызывает базовый и добавляет `Color`. Проверено на .NET 10: `new Point(1, 2)` и `new ColorPoint(1, 2, "red")` не равны ни через `Equals` в обе стороны, ни через `==`. Преимущество перед `GetType()` в том, что наследник может явно объявить себя сравнимым с базой, переопределив контракт. У `record struct` такого свойства нет — наследования у структур нет.

Подводные камни records: коллекции в свойствах сравниваются по ссылке, так что `record Order(List<string> Items)` с одинаковым содержимым не равны, а изменяемые records теряются в `HashSet` после изменения поля. И `==` по-прежнему не полиморфен: для переменных типа `object` он сравнивает ссылки.

## Interpolated string handlers

С C# 10 интерполированная строка — не обязательно `string.Format`. Если целевой тип параметра — handler, компилятор разворачивает `$"..."` в вызовы `AppendLiteral`/`AppendFormatted`. Для обычного `string` это `DefaultInterpolatedStringHandler`: он пишет в буфер из `ArrayPool<char>`, форматирует значения через `ISpanFormattable.TryFormat` без упаковки и аллоцирует только итоговую строку. В нашем замере `$"Order {id} sum {sum:N2}"` дал 96 байт против 120 у эквивалентного `string.Format` — числа иллюстративные и зависят от аргументов.

BCL принимает handler напрямую: `StringBuilder.Append($"...")` пишет в билдер без промежуточной строки, `span.TryWrite($"{id:D8}", out int written)` форматирует в `Span<char>` — 0 байт в замере, `string.Create(CultureInfo.InvariantCulture, $"...")` задаёт культуру, которая важна для ключей кэша и протоколов.

Главная возможность — свой handler с `out bool shouldAppend`:

```csharp
[InterpolatedStringHandler]
public ref struct LogHandler
{
    private DefaultInterpolatedStringHandler _inner;

    public LogHandler(int literalLength, int formattedCount, Logger logger, Level level, out bool shouldAppend)
    {
        shouldAppend = logger.IsEnabled(level);
        _inner = shouldAppend ? new DefaultInterpolatedStringHandler(literalLength, formattedCount) : default;
    }

    public void AppendLiteral(string s) => _inner.AppendLiteral(s);
    public void AppendFormatted<T>(T value) => _inner.AppendFormatted(value);
    public string ToStringAndClear() => _inner.ToStringAndClear();
}

public void Log(Level level, [InterpolatedStringHandlerArgument("", "level")] ref LogHandler message)
{
    if (IsEnabled(level)) Write(message.ToStringAndClear());
}
```

`""` в атрибуте означает получателя вызова. Компилятор создаёт handler, и если `shouldAppend == false`, не вызывает ни одного `Append` — выражения в дырках **не вычисляются**. Проверено: при выключенном уровне `logger.Log(Level.Debug, $"state {Serialize(state)}")` не вызвал `Serialize` и не аллоцировал ни байта. Так же устроен `Debug.Assert(cond, $"...")` с .NET 6: сообщение строится только при ложном условии.

Важно не перепутать с `ILogger`: у `LogInformation` из Microsoft.Extensions.Logging перегрузки с handler нет, и `$"User {id}"` там всегда строит строку и к тому же убивает структурное логирование. Для него правильно передавать шаблон с параметрами или генерировать методы через `[LoggerMessage]`, который проверяет `IsEnabled` до форматирования.

Ограничения: handler — `ref struct`, поэтому метод с ним не может быть `async`, а побочные эффекты в дырках (`$"{i++}"`) при пропуске форматирования не выполнятся — для такого API это надо документировать.

## Что стоит ответить на собеседовании

Generics в .NET живут в рантайме: для reference-типов JIT генерирует общий код над `__Canon` и узнаёт точный тип через generic dictionary, для каждого value type — специализированный, поэтому `List<int>` работает без упаковки, а `typeof(T)`-ветки и constrained-вызовы схлопываются. `foreach`, `await`, `using` для `ref struct`, деконструкция, инициализаторы коллекций и LINQ query syntax ищут методы по имени, что позволяет обойтись struct-енумератором и struct-awaiter без аллокаций.

Сильный ответ покажет цену: `foreach` по `IEnumerable<int>` упаковывает енумератор, инстанциации над структурами раздувают код и прогрев, `new T()` идёт через `Activator`. Про равенство объяснит, почему наследование ломает симметрию и как `EqualityContract` в records это чинит. Про строки — что handler с `shouldAppend` не вычисляет аргументы при выключенном уровне, но `ILogger.LogInformation($"...")` этим не пользуется, и там нужен шаблон или `[LoggerMessage]`.
