# Задачи: многопоточность

## Счётчик посещений

```yaml
slug: mnogopotochnost-gonka-na-inkremente
category: multithreading
level: junior
kind: bug
difficulty: 2
```

В чём проблема этого кода?

```csharp
var counter = new HitCounter();
Parallel.For(0, 1_000_000, _ => counter.Hit());
Console.WriteLine(counter.Value);

public class HitCounter
{
    private int _count;

    public void Hit() => _count++;

    public int Value => _count;
}
```

### Варианты

- [ ] `Parallel.For` выполнит не все итерации, если какой-то поток завершится раньше
- [ ] Переполнение `int`: значение станет отрицательным
- [x] Гонка: `_count++` — это чтение, сложение и запись, конкурентные инкременты теряются, и результат обычно меньше 1 000 000
- [ ] Нужно пометить поле `volatile` — тогда инкремент станет атомарным

### Разбор

`_count++` компилируется в три шага: прочитать значение, прибавить единицу, записать обратно. Если два потока одновременно прочитали `41`, оба запишут `42` — один инкремент потерян. На многоядерной машине программа почти всегда печатает число меньше миллиона, причём каждый раз разное.

`volatile` не помогает: он запрещает кэширование и переупорядочивание чтений/записей, но не делает составную операцию «прочитал-изменил-записал» атомарной. Исправления: `Interlocked.Increment(ref _count)` — атомарная инструкция процессора, самый дешёвый вариант для одного счётчика; `lock` — если нужно атомарно менять несколько полей сразу. Для очень горячих счётчиков применяют шардирование по потокам с суммированием в конце (так устроены, например, счётчики в `System.Diagnostics.Metrics`).

## Блокировка по ключу

```yaml
slug: mnogopotochnost-lock-na-stroku
category: multithreading
level: middle
kind: bug
difficulty: 4
```

В чём проблема этого кода? `ReportService` зарегистрирован как singleton, `region` приходит из параметра HTTP-запроса.

```csharp
public class ReportService
{
    private readonly Dictionary<string, Report> _cache = new();

    public Report GetReport(string region)
    {
        lock (region)
        {
            if (!_cache.TryGetValue(region, out var report))
            {
                report = BuildReport(region);
                _cache[region] = report;
            }
            return report;
        }
    }
}
```

### Варианты

- [ ] Ошибка компиляции: `lock` нельзя применять к `string`
- [ ] Дедлок, если `GetReport` вызовут повторно из того же потока
- [x] Каждый запрос блокирует свой экземпляр строки: `lock` ничего не защищает, и `Dictionary` изменяется из нескольких потоков одновременно
- [ ] Единственная проблема — производительность: `BuildReport` выполняется под блокировкой

### Разбор

`lock` работает по ссылке на объект, а не по значению. Строка `region`, полученная из запроса, — новый объект при каждом запросе, поэтому два потока с одинаковым `"eu"` берут блокировки на **разные** объекты и спокойно входят в критическую секцию одновременно. А запросы с разными регионами и подавно не исключают друг друга, хотя оба пишут в один `Dictionary`. Итог — конкурентная запись в непотокобезопасный словарь (повреждение внутренней структуры, исключения, в старых версиях .NET — даже бесконечный цикл) и повторный `BuildReport` для одного ключа.

Блокировка на строку опасна и в обратную сторону: строковые литералы интернируются, и `lock ("sync")` в двух несвязанных классах — это одна и та же блокировка на весь процесс. Та же логика у `lock (this)` и `lock (typeof(X))`: объект виден снаружи, и чужой код может заблокироваться на нём же.

Правильно — блокироваться на приватном объекте (`private readonly object _gate = new();` или `System.Threading.Lock` в .NET 9+), а для кэша по ключу взять `ConcurrentDictionary<string, Lazy<Report>>` с `GetOrAdd`: словарь потокобезопасен, а `Lazy` гарантирует, что отчёт для ключа построится один раз.

## Кэш курсов валют

```yaml
slug: mnogopotochnost-dictionary-v-singleton
category: multithreading
level: middle
kind: bug
difficulty: 3
```

В чём проблема этого кода?

```csharp
builder.Services.AddSingleton<CurrencyRates>();

public class CurrencyRates(IRatesApi api)
{
    private readonly Dictionary<string, decimal> _cache = new();

    public decimal Get(string code)
    {
        if (!_cache.TryGetValue(code, out var rate))
        {
            rate = api.Load(code);
            _cache[code] = rate;
        }
        return rate;
    }
}
```

### Варианты

- [ ] Кэш будет пересоздаваться на каждый запрос, потому что `Dictionary` создаётся в инициализаторе поля
- [x] Singleton вызывается из многих потоков одновременно, а `Dictionary` не потокобезопасен: конкурентная запись может повредить его внутреннее состояние
- [ ] `TryGetValue` бросит `KeyNotFoundException` для нового кода валюты
- [ ] Проблемы нет: чтения и записи в `Dictionary` атомарны

### Разбор

Singleton в ASP.NET Core — один объект на всё приложение, и его методы вызываются из параллельно обрабатываемых запросов. `Dictionary<TKey, TValue>` безопасен только для параллельного **чтения** без писателей. Две одновременные записи (или запись во время чтения) могут попасть на перестройку внутренних массивов при росте словаря: результат — потерянные элементы, `IndexOutOfRangeException`, `InvalidOperationException` о конкурентной операции, а на старых версиях .NET известен даже бесконечный цикл, съедающий ядро процессора. Ошибка проявляется только под нагрузкой и плохо воспроизводится.

Исправление — `ConcurrentDictionary<string, decimal>` и `_cache.GetOrAdd(code, c => api.Load(c))`. Важная оговорка: `GetOrAdd` не гарантирует, что фабрика вызовется один раз — при гонке `api.Load` может выполниться несколько раз, а в словарь попадёт одно значение. Если повторная загрузка дорогая, хранят `Lazy<decimal>`. Для реального кэша с истечением срока лучше подходит `IMemoryCache` или `HybridCache`.

## Lazy и исключение в фабрике

```yaml
slug: mnogopotochnost-lazy-keshiruet-isklyuchenie
category: multithreading
level: senior
kind: output
difficulty: 4
```

Что выведет программа?

```csharp
var calls = 0;
var lazy = new Lazy<int>(() =>
{
    calls++;
    if (calls == 1) throw new InvalidOperationException("fail");
    return 42;
});

for (var i = 0; i < 2; i++)
{
    try { Console.Write($"{lazy.Value} "); }
    catch (InvalidOperationException ex) { Console.Write($"{ex.Message} "); }
}
Console.Write(calls);
```

### Варианты

- [ ] `fail 42 2`
- [x] `fail fail 1`
- [ ] `fail fail 2`
- [ ] `42 42 1`

### Разбор

Конструктор `Lazy<T>(Func<T>)` использует режим `LazyThreadSafetyMode.ExecutionAndPublication`: фабрика выполняется не больше одного раза даже при конкурентных обращениях. Обратная сторона — если фабрика бросила исключение, `Lazy` **кэширует это исключение** и при каждом следующем обращении к `Value` выбрасывает его снова, не вызывая фабрику. Поэтому `calls` остаётся равным 1, а оба обращения печатают `fail`.

На практике это ловушка для ленивой инициализации подключений и конфигурации: если при первом обращении временно была недоступна сеть, объект «отравлен» до перезапуска процесса. Варианты: режим `LazyThreadSafetyMode.PublicationOnly` (исключения не кэшируются, но фабрика может выполниться в нескольких потоках, а победит первый опубликованный результат), пересоздание `Lazy` при ошибке или явная инициализация на старте приложения.

Тот же механизм лежит в основе классического double-checked locking: вручную его легко написать неправильно (без `volatile` или без второй проверки под `lock`), поэтому в C# вместо него используют `Lazy<T>` или `LazyInitializer.EnsureInitialized`.

## Вложенный lock

```yaml
slug: mnogopotochnost-vlozhennyj-lock
category: multithreading
level: junior
kind: output
difficulty: 2
```

Что выведет программа?

```csharp
var gate = new object();

lock (gate)
{
    Console.Write("A ");
    Inner();
}
Console.Write("C");

void Inner()
{
    lock (gate)
    {
        Console.Write("B ");
    }
}
```

### Варианты

- [ ] `A`, после чего программа зависнет навсегда
- [ ] `A`, затем `SynchronizationLockException`
- [x] `A B C`
- [ ] Ошибка компиляции: `lock` на одном объекте нельзя вкладывать

### Разбор

`lock` в C# построен на `Monitor` (или на `System.Threading.Lock` в .NET 9+, если объект имеет этот тип), а оба механизма **реентерабельны**: поток, который уже владеет блокировкой, может захватить её повторно. Внутри хранится владелец и счётчик рекурсии; вложенный `lock` увеличивает счётчик, выход из него уменьшает, а реально блокировка освобождается, когда счётчик дойдёт до нуля. Поэтому `Inner()` спокойно входит в секцию, и программа печатает `A B C`.

Дедлок возникает, когда **разные** потоки захватывают **разные** блокировки в разном порядке: поток 1 держит `a` и ждёт `b`, поток 2 держит `b` и ждёт `a`. Лечится единым порядком захвата блокировок или их укрупнением.

Реентерабельны не все примитивы: `SemaphoreSlim(1, 1)` о владельце ничего не знает, и повторный `Wait()` в том же потоке заблокирует его навсегда. Это важно, потому что именно `SemaphoreSlim` используют вместо `lock` в async-коде (внутри `lock` нельзя писать `await`).
