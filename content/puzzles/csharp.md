# Задачи: C#

## Замыкание в цикле for

```yaml
slug: zamykanie-v-cikle-for
category: csharp
level: middle
kind: output
difficulty: 2
```

Что выведет программа?

```csharp
var actions = new List<Action>();
for (var i = 0; i < 3; i++)
    actions.Add(() => Console.Write(i));
foreach (var a in actions) a();
```

### Варианты

- [ ] `012`
- [x] `333`
- [ ] `222`
- [ ] Ошибка компиляции

### Разбор

Лямбда захватывает **переменную**, а не её значение в момент создания. У цикла `for` переменная `i` одна на весь цикл: компилятор выносит её в поле сгенерированного класса-замыкания (display class), экземпляр которого создаётся один раз до входа в цикл. Все три делегата ссылаются на этот один объект, и к моменту вызова `i` уже равна `3` — значению, на котором условие `i < 3` стало ложным.

Исправление — завести копию внутри тела цикла, тогда на каждой итерации создаётся новый экземпляр замыкания:

```csharp
for (var i = 0; i < 3; i++)
{
    var copy = i;
    actions.Add(() => Console.Write(copy));
}
```

С `foreach` такой проблемы нет начиная с C# 5: переменная итерации считается объявленной внутри тела, и `foreach (var x in new[] { 0, 1, 2 })` с той же лямбдой выведет `012`. На практике баг встречается при запуске задач в цикле (`Task.Run(() => Process(i))`) и подписке обработчиков в `for`.

## Повторное перечисление LINQ

```yaml
slug: povtornoe-perechislenie-linq
category: csharp
level: middle
kind: output
difficulty: 3
```

Что выведет программа?

```csharp
var calls = 0;
var numbers = new List<int> { 1, 2, 3 };
var doubled = numbers.Select(x => { calls++; return x * 2; });
numbers.Add(4);
var sum = doubled.Sum();
var max = doubled.Max();
Console.Write($"{sum} {max} {calls}");
```

### Варианты

- [ ] `12 6 3`
- [ ] `12 6 6`
- [ ] `20 8 4`
- [x] `20 8 8`

### Разбор

`Select` ничего не вычисляет в момент вызова — он возвращает объект-итератор, который хранит ссылку на источник и делегат. Это **отложенное выполнение**: элементы проецируются только при перечислении. Поэтому `numbers.Add(4)` успевает попасть в выборку, и сумма считается по `2, 4, 6, 8`.

Второй эффект — **повторное перечисление**: `Sum()` и `Max()` каждый заново проходят по источнику и заново вызывают лямбду. Четыре элемента × два прохода = `8` вызовов. Если в лямбде запрос к БД, HTTP-вызов или тяжёлое вычисление, работа удваивается незаметно.

Исправление — материализовать результат один раз: `var doubled = numbers.Select(...).ToList();`. Тогда `calls` будет `4`, а последующий `numbers.Add` на `doubled` уже не повлияет. Анализатор CA1851 и подсказка IDE «Possible multiple enumeration» ловят именно этот паттерн. Особенно коварен он с `IQueryable` из EF Core: каждое перечисление — отдельный SQL-запрос.

## Структура в списке и массиве

```yaml
slug: struktura-v-spiske-i-massive
category: csharp
level: middle
kind: output
difficulty: 3
```

Что выведет программа?

```csharp
var list = new List<Point> { new Point() };
list[0].Inc();
var arr = new[] { new Point() };
arr[0].Inc();
foreach (var p in arr) p.Inc();
Console.Write($"{list[0].X}{arr[0].X}");

struct Point
{
    public int X;
    public void Inc() => X++;
}
```

### Варианты

- [ ] `11`
- [x] `01`
- [ ] `12`
- [ ] `02`

### Разбор

`list[0]` — это вызов индексатора `get_Item`, который возвращает структуру **по значению**. `Inc()` вызывается на временной копии, и изменение тут же теряется. Именно поэтому присваивание `list[0].X = 5` компилятор запрещает (ошибка CS1612), а вызов мутирующего метода — нет, хотя эффект тот же.

Элемент массива — другое дело: `arr[0]` компилируется в инструкцию `ldelema`, которая даёт **адрес** элемента, и `Inc()` меняет структуру прямо в массиве. А переменная `foreach` — это копия элемента, причём доступная только для чтения: мутирующий метод снова работает с копией, массив не меняется. Итого `0` и `1`.

Как исправить: делать структуры неизменяемыми (`readonly struct`, методы возвращают новый экземпляр), либо записывать изменённую копию обратно (`var p = list[0]; p.Inc(); list[0] = p;`), либо в горячем коде работать через `CollectionsMarshal.AsSpan(list)[0].Inc()` — span отдаёт ссылку на элемент внутреннего массива списка.

## Мутация readonly-поля структуры

```yaml
slug: mutaciya-readonly-polya-struktury
category: csharp
level: senior
kind: output
difficulty: 4
```

Что выведет программа?

```csharp
var h = new Holder();
h.Bump();
h.Bump();
Console.Write(h.Value);

class Holder
{
    private readonly Counter _counter;
    public void Bump() => _counter.Inc();
    public int Value => _counter.N;
}

struct Counter
{
    public int N;
    public void Inc() => N++;
}
```

### Варианты

- [x] `0`
- [ ] `1`
- [ ] `2`
- [ ] Ошибка компиляции: нельзя изменять readonly-поле

### Разбор

Поле `_counter` объявлено `readonly`, а метод `Inc()` структуры не помечен как `readonly` — компилятор не может гарантировать, что он не изменит состояние. Чтобы не нарушить неизменяемость поля, он делает **защитную копию** (defensive copy): в IL это загрузка значения поля в скрытую локальную переменную и вызов `Inc()` на её адресе. Каждый `Bump()` увеличивает счётчик у одноразовой копии, само поле остаётся `0`. Ошибки компиляции нет, предупреждения по умолчанию тоже.

Защитные копии бьют и по производительности: для больших структур каждое обращение к методу через `readonly`-поле или `in`-параметр копирует всю структуру. Поэтому методы, которые не меняют состояние, стоит помечать `readonly` (`public readonly int Get() => N;`) — для них копия не нужна, а для `readonly struct` все члены такие автоматически.

Исправление здесь — убрать `readonly` с поля, если счётчик действительно должен мутировать, или сделать `Counter` классом. Классический случай из практики — `private readonly SpinLock _lock`: `Enter` и `Exit` вызываются на копиях, и блокировка ничего не защищает.

## Упаковка и сравнение

```yaml
slug: upakovka-i-sravnenie
category: csharp
level: junior
kind: output
difficulty: 2
```

Что выведет программа?

```csharp
int a = 42;
object x = a;
object y = a;
Console.Write($"{x == y} {x.Equals(y)} {(object)a == (object)a}");
```

### Варианты

- [ ] `True True True`
- [x] `False True False`
- [ ] `False True True`
- [ ] `True True False`

### Разбор

Присваивание `int` в переменную типа `object` — это **упаковка** (boxing, инструкция `box`): в куче создаётся новый объект, в который копируется значение. `x` и `y` — два разных объекта-«коробки» с одинаковым содержимым.

Оператор `==` для операндов типа `object` сравнивает **ссылки**, поэтому `x == y` — `False`. `Equals` — виртуальный метод, вызов уходит в `Int32.Equals(object)`, который распаковывает аргумент и сравнивает значения — `True`. Выражение `(object)a == (object)a` упаковывает `a` дважды, получаются две разные коробки — снова `False`. В отличие от Java, в .NET нет кэша упакованных маленьких чисел, поэтому результат не зависит от значения.

На практике это всплывает в обобщённом коде без ограничений, при работе с `object`-словарями и в старых коллекциях вроде `ArrayList`. Для сравнения значений неизвестного типа используйте `Equals` или `EqualityComparer<T>.Default.Equals(a, b)` — последний ещё и не упаковывает значимые типы.

## Интернирование строк

```yaml
slug: internirovanie-strok
category: csharp
level: middle
kind: output
difficulty: 3
```

Что выведет программа?

```csharp
var a = "hello";
var b = "hel" + "lo";
var part = "hel";
var c = part + "lo";
Console.Write($"{ReferenceEquals(a, b)} {ReferenceEquals(a, c)} {ReferenceEquals(a, string.Intern(c))} {a == c}");
```

### Варианты

- [ ] `True True True True`
- [ ] `False False True True`
- [x] `True False True True`
- [ ] `True False False True`

### Разбор

Все строковые литералы сборки попадают в **пул интернирования**: одинаковые литералы — один и тот же объект. Выражение `"hel" + "lo"` состоит из констант, и компилятор склеивает его на этапе компиляции в литерал `"hello"` — поэтому `b` ссылается на тот же объект, что и `a`.

`part` — обычная переменная, а не `const`, поэтому `part + "lo"` вычисляется в рантайме через `string.Concat` и создаёт **новую** строку в куче: ссылки разные. `string.Intern(c)` ищет в пуле строку с тем же содержимым и возвращает уже существующий экземпляр — тот самый, на который указывает `a`. Оператор `==` для строк перегружен и сравнивает содержимое — `True`.

Если объявить `const string part = "hel";`, конкатенация снова станет константной и второе сравнение тоже даст `True`. Вывод для практики: сравнивать строки по ссылке нельзя — результат зависит от того, как строка получена. А ручной `string.Intern` для экономии памяти опасен: интернированные строки живут до конца процесса.

## Разрешение перегрузок

```yaml
slug: razreshenie-peregruzok
category: csharp
level: senior
kind: output
difficulty: 5
```

Что выведет программа?

```csharp
Console.Write($"{P.M(1)} {P.M(1L)} {P.M(null)} {P.M()}");

static class P
{
    public static string M(object o) => "object";
    public static string M<T>(T t) => "generic";
    public static string M(params int[] xs) => "params";
}
```

### Варианты

- [ ] `generic generic object params`
- [ ] `generic generic params params`
- [x] `params generic params params`
- [ ] Ошибка компиляции: неоднозначный вызов `M(null)`

### Разбор

`M(1)`: применимы все три перегрузки — `object` через упаковку, `M<int>` с тождественным преобразованием и `params int[]` в **расширенной** форме (`new[] { 1 }`), тоже с тождественным преобразованием для аргумента. `object` проигрывает сразу: упаковка хуже тождества. Между generic и params по аргументам ничья, и в дело вступают правила разрыва ничьей. Первое из них — **необобщённый метод лучше обобщённого**, и оно проверяется раньше правила «нормальная форма лучше расширенной». Побеждает `params`.

`M(1L)`: `long` неявно в `int` не преобразуется, `params int[]` неприменим. `M<long>` с тождественным преобразованием лучше упаковки в `object` — `generic`.

`M(null)`: у `null` нет типа, вывести `T` не из чего — generic неприменим. Остаются `object` и `int[]` в нормальной форме (`xs = null`). `int[]` неявно приводится к `object`, значит он более специфичен и выигрывает — внутри метода `xs` будет `null`, а не пустой массив. `M()` подходит только `params` с пустым массивом. Если добавить ещё перегрузку `M(string)`, вызов `M(null)` станет неоднозначным: `string` и `int[]` друг в друга не приводятся.

## Порядок инициализации статических полей

```yaml
slug: poryadok-inicializacii-staticheskih-polej
category: csharp
level: middle
kind: output
difficulty: 3
```

Что выведет программа?

```csharp
Console.Write($"{Config.TimeoutMs} {Config.Retries}");

static class Config
{
    public static readonly int TimeoutMs = Retries * 1000;
    public static readonly int Retries = 3;
}
```

### Варианты

- [ ] `3000 3`
- [x] `0 3`
- [ ] `0 0`
- [ ] Ошибка компиляции: использование поля до объявления

### Разбор

Инициализаторы статических полей компилятор переносит в статический конструктор (`.cctor`) **в текстовом порядке объявления**. Когда вычисляется `TimeoutMs`, поле `Retries` ещё не проинициализировано и содержит значение по умолчанию — `0`. Компилятор это не запрещает: ссылаться на статическое поле, объявленное ниже, можно, предупреждения тоже нет.

Если сделать `Retries` константой (`public const int Retries = 3;`), результат станет `3000 3`: константа подставляется в место использования на этапе компиляции и от порядка инициализации не зависит.

Похожая ловушка — циклические зависимости между статическими полями двух классов: при обращении к классу `A`, чей инициализатор читает `B`, а инициализатор `B` читает `A`, один из них увидит недоинициализированные нули. А в `partial`-классах порядок инициализаторов из разных файлов вообще не определён. Надёжный способ — явный статический конструктор или ленивые свойства, не зависящие от порядка полей.

## Изменение переменной в finally

```yaml
slug: izmenenie-peremennoj-v-finally
category: csharp
level: middle
kind: output
difficulty: 2
```

Что выведет программа?

```csharp
Console.Write(Get());

static int Get()
{
    var x = 1;
    try
    {
        return x;
    }
    finally
    {
        x = 2;
        Console.Write("f");
    }
}
```

### Варианты

- [x] `f1`
- [ ] `f2`
- [ ] `1f`
- [ ] Ошибка компиляции

### Разбор

`return x` внутри `try` сначала **вычисляет** возвращаемое значение и сохраняет его во временную локальную переменную, затем выполняется `finally`, и только после этого метод реально возвращает сохранённое значение (в IL это `leave` на метку после блока, где стоит `ldloc` временной переменной и `ret`). Изменение `x` в `finally` на уже сохранённое значение не влияет — возвращается `1`.

`f` печатается первым, потому что `finally` выполняется до выхода из `Get()`, а внешний `Console.Write` получает результат только после этого.

Для ссылочных типов картина другая: если вернуть объект, а в `finally` изменить его состояние (`list.Add(...)`), вызывающий код увидит изменение — сохраняется ссылка, а не копия объекта. И в отличие от Java, написать `return` внутри `finally` в C# нельзя: это ошибка CS0157 «Control cannot leave the body of a finally clause».

## Переполнение при умножении

```yaml
slug: perepolnenie-pri-umnozhenii
category: csharp
level: junior
kind: bug
difficulty: 2
```

В чём проблема этого кода?

```csharp
Console.WriteLine(TotalBytes(100_000, 50_000));

static long TotalBytes(int count, int itemSize)
{
    long total = count * itemSize;
    return total;
}
```

### Варианты

- [ ] При присваивании в `long` будет `OverflowException`
- [x] Умножение выполняется в `int` и молча переполняется до расширения в `long`
- [ ] `long` не вмещает 5 000 000 000, нужен `decimal`
- [ ] Не хватает явного приведения результата: `(long)(count * itemSize)`

### Разбор

Тип выражения определяется типами операндов, а не переменной, в которую записывается результат. `count * itemSize` — это умножение двух `int`, результат `int`, и 5 000 000 000 в него не помещается. По умолчанию арифметика в C# **unchecked**: старшие биты отбрасываются без исключения, получается `705032704`, и только это уже испорченное значение расширяется до `long`.

Приведение результата `(long)(count * itemSize)` не помогает — переполнение уже произошло. Нужно расширить хотя бы один операнд до умножения: `(long)count * itemSize`, или использовать `Math.BigMul(count, itemSize)`.

Чтобы переполнение не проходило молча, есть `checked(count * itemSize)` — он бросит `OverflowException` — или настройка проекта `<CheckForOverflowUnderflow>true</CheckForOverflowUnderflow>`, включающая проверку для всей сборки. Типичные места: подсчёт размеров буферов и файлов, суммы в копейках, вычисление смещений и `Timestamp` в миллисекундах.

## Равенство record и анонимных типов

```yaml
slug: ravenstvo-record-i-anonimnyh-tipov
category: csharp
level: middle
kind: output
difficulty: 3
```

Что выведет программа?

```csharp
var r1 = new Point(1, 2);
var r2 = new Point(1, 2);
var a1 = new { X = 1, Y = 2 };
var a2 = new { X = 1, Y = 2 };
Console.Write($"{r1 == r2} {r1.Equals(r2)} {a1 == a2} {a1.Equals(a2)}");

record Point(int X, int Y);
```

### Варианты

- [ ] `True True True True`
- [ ] `False True False True`
- [x] `True True False True`
- [ ] `True True False False`

### Разбор

Для `record` компилятор генерирует полный набор value-равенства: `Equals(Point?)`, переопределение `Equals(object)`, `GetHashCode` и **операторы `==` и `!=`**. Сравниваются `EqualityContract` (фактический тип) и все поля. Поэтому и `==`, и `Equals` дают `True`.

Анонимные типы тоже переопределяют `Equals` и `GetHashCode` по значениям свойств — отсюда `a1.Equals(a2)` = `True`, и их удобно использовать как составные ключи в `GroupBy` и `Dictionary`. Но оператор `==` для них **не перегружен**, и он сравнивает ссылки двух разных объектов — `False`.

Для сравнения: обычный `class` без переопределений даст `False` везде, а `struct` по умолчанию сравнивается через `ValueType.Equals` по полям (в общем случае медленно и с упаковкой), и `==` для неё без явной перегрузки не скомпилируется.

## Nullable и оператор ??

```yaml
slug: nullable-i-operator-coalesce
category: csharp
level: middle
kind: output
difficulty: 3
```

Что выведет программа?

```csharp
int? a = null;
int? b = 5;
Console.Write(a + b ?? -1);
Console.Write(" ");
Console.Write(a > 0 || a <= 0);
```

### Варианты

- [ ] `5 False`
- [x] `-1 False`
- [ ] `-1 True`
- [ ] `5 True`

### Разбор

Арифметические операторы для `Nullable<T>` — **поднятые** (lifted): если хотя бы один операнд `null`, результат тоже `null`. У `+` приоритет выше, чем у `??`, поэтому выражение читается как `(a + b) ?? -1`: сумма равна `null`, и срабатывает правая часть — `-1`. `null` не трактуется как ноль.

Поднятые операторы сравнения `<`, `>`, `<=`, `>=` возвращают `false`, если любой операнд `null`. Поэтому и `a > 0`, и `a <= 0` ложны, и привычная логика «если не больше, значит меньше или равно» ломается. Исключение — `==` и `!=`: `a == null` даёт `true`, а `null == null` — тоже `true`.

На практике это всплывает в фильтрах вида `if (order.Discount > 0) ... else ...`, где ветка `else` неожиданно ловит и отсутствующие значения, и в LINQ-to-Entities, где семантика `null` в SQL похожа, но не всегда совпадает с C#. Явная обработка — `a.GetValueOrDefault()`, `a ?? 0` или проверка `a.HasValue`.

## Валидация в методе-итераторе

```yaml
slug: validaciya-v-metode-iteratore
category: csharp
level: middle
kind: bug
difficulty: 3
```

В чём проблема этого кода?

```csharp
var lines = ReadLines(null!);
Console.WriteLine("created");
foreach (var line in lines)
    Console.WriteLine(line);

static IEnumerable<string> ReadLines(string path)
{
    ArgumentNullException.ThrowIfNull(path);
    foreach (var line in File.ReadLines(path))
        yield return line.Trim();
}
```

### Варианты

- [x] Проверка аргумента отложена: исключение вылетит только при первом `MoveNext`, а не при вызове `ReadLines`
- [ ] `File.ReadLines` сразу читает весь файл в память
- [ ] Файл останется открытым, если прервать перечисление через `break`
- [ ] `yield return` нельзя использовать внутри `foreach`

### Разбор

Метод с `yield return` компилятор превращает в класс-машину состояний. Вызов `ReadLines(null!)` только создаёт этот объект — **ни одна строка тела не выполняется**, включая проверку аргумента. Программа напечатает `created`, и `ArgumentNullException` вылетит позже, на первом `MoveNext()` внутри `foreach`. Если последовательность передали дальше по слоям, стек вызовов будет указывать совсем не туда, где был передан `null`.

Исправление — разделить метод на обычную обёртку с проверками и итератор:

```csharp
static IEnumerable<string> ReadLines(string path)
{
    ArgumentNullException.ThrowIfNull(path);
    return Iterate(path);

    static IEnumerable<string> Iterate(string path)
    {
        foreach (var line in File.ReadLines(path))
            yield return line.Trim();
    }
}
```

Так устроены методы LINQ в BCL: `Where(null, ...)` бросает исключение сразу. Остальные варианты неверны: `File.ReadLines` читает файл лениво, `foreach` вызывает `Dispose` у итератора и при `break`, что выполняет `finally`-блоки и закрывает файл. Похожий эффект есть у `async`-методов: исключение до первого `await` не бросается из вызова, а сохраняется в возвращённой `Task`.

## Виртуальный вызов из конструктора

```yaml
slug: virtualnyj-vyzov-iz-konstruktora
category: csharp
level: senior
kind: output
difficulty: 4
```

Что выведет программа?

```csharp
new Derived();

class Base
{
    public Base() => Print();
    public virtual void Print() => Console.Write("Base");
}

class Derived : Base
{
    private readonly string _prefix = "Derived";
    private readonly string? _name;

    public Derived() => _name = "ready";

    public override void Print() => Console.Write($"{_prefix}:{_name ?? "null"}");
}
```

### Варианты

- [ ] `Base`
- [ ] `Derived:ready`
- [x] `Derived:null`
- [ ] `:null`

### Разбор

Порядок создания объекта в C#: сначала выполняются **инициализаторы полей** `Derived`, затем вызывается конструктор `Base` (он сам сначала выполняет свои инициализаторы и конструктор `object`), и только потом — тело конструктора `Derived`. В IL конструктора `Derived` это видно буквально: присваивание `_prefix`, затем `call Base::.ctor`, затем присваивание `_name`.

Тип объекта с самого начала — `Derived`, поэтому виртуальный вызов `Print()` из конструктора `Base` уходит в переопределение. К этому моменту `_prefix` уже заполнен инициализатором, а `_name` ещё `null` — тело конструктора `Derived` не выполнялось. Это отличие от C++, где во время работы базового конструктора объект считается объектом базового класса и вызывается `Base::Print`.

Опасность в том, что переопределённый метод видит наполовину созданный объект: `readonly`-поля, которые «всегда заполнены», и nullable-анализ, который считает `_name` инициализированным, здесь не спасают. Анализатор CA2214 предупреждает о вызове переопределяемых методов из конструктора. Исправление — не вызывать виртуальные методы в конструкторе или вынести инициализацию в отдельный метод, который вызывается после создания.

## Сокрытие метода через new

```yaml
slug: sokrytie-metoda-cherez-new
category: csharp
level: middle
kind: bug
difficulty: 3
```

В чём проблема этого кода?

```csharp
Repository repo = new CachedRepository();
Console.WriteLine(repo.Find(1));

class Repository
{
    public string Find(int id) => $"db:{id}";
}

class CachedRepository : Repository
{
    private readonly Dictionary<int, string> _cache = new();

    public new string Find(int id)
    {
        if (!_cache.TryGetValue(id, out var value))
            _cache[id] = value = base.Find(id);
        return "cache:" + value;
    }
}
```

### Варианты

- [ ] `base.Find` рекурсивно вызовет `CachedRepository.Find` и приведёт к `StackOverflowException`
- [ ] Код не скомпилируется: метод с тем же именем можно объявить только с `override`
- [x] `new` скрывает метод, а не переопределяет: через ссылку типа `Repository` кэш никогда не используется
- [ ] Значение в кэше перезаписывается при каждом вызове

### Разбор

Модификатор `new` объявляет **новый** метод, который просто скрывает одноимённый метод базового класса. Выбор между ними делается на этапе компиляции по **статическому типу** ссылки: переменная `repo` имеет тип `Repository`, поэтому вызывается `Repository.Find`, и программа печатает `db:1`. Кэширующая реализация сработает только при вызове через ссылку типа `CachedRepository`.

С `virtual`/`override` выбор происходит в рантайме по фактическому типу объекта через таблицу виртуальных методов (инструкция `callvirt` по слоту метода), и вызов через базовую ссылку попал бы в переопределение. Без `new` код тоже скомпилировался бы, но с предупреждением CS0108 — `new` лишь подавляет это предупреждение, ничего не исправляя.

Исправление — сделать метод в базе `virtual` и переопределить его, а ещё лучше выделить интерфейс `IRepository` и реализовать кэш декоратором. Именно так баг обычно и проявляется на практике: в DI регистрируется наследник, а потребители зависят от базового типа.
