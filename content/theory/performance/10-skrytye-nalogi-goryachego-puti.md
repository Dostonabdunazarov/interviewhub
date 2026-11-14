---
title: Скрытые налоги горячего пути
slug: perf-skrytye-nalogi-goryachego-puti
track: dotnet-backend
section: performance
level: senior
sortOrder: 10
summary: Три расхода, которые редко видны в коде, но заметны в профиле под нагрузкой — сериализация, массовые исключения и конфликты блокировок, — как их измерить и чем заменить.
questions: performance-profiling-kak-izmerit-i-snizit-nakladnye-rashody-na-serializaciyu-v-goryachem-pu, performance-profiling-kak-naiti-istochnik-massovyh-isklyuchenii-i-ocenit-ih-cenu-dlya-pr, advanced-concurrency-kak-diagnose-lock-contention-i-kakie-metriki-pokazhut-chto-blokirovka
---

Бизнес-логика горячего пути обычно занимает меньше времени, чем кажется. Остальное уходит на «налоги»: превратить объект в байты, бросить и поймать исключение, которое никто не логирует, подождать блокировку, которую держит соседний поток. По отдельности каждый вызов стоит микросекунды, но выполняется на каждом запросе и масштабируется вместе с RPS.

Общее правило для всех трёх: сначала доказать долю в профиле, потом чинить. Как снимать счётчики и трассировку, разобрано в статье `dotnet-counters и dotnet-trace`, как мерить отдельный метод — в `Как мерить: BenchmarkDotNet и ловушки микробенчмарков`.

## Сериализация: сначала измерить долю

Стоимость сериализации видна в двух местах. В CPU-профиле — inclusive time `JsonSerializer.*`, `Utf8JsonWriter` и конвертеров: если это 3% времени запроса, оптимизировать нечего. В профиле аллокаций — промежуточные `string`, крупные `byte[]`, попадающие в LOH, деревья `JsonDocument` (подробнее в статье `Профилирование аллокаций`). Сериализация часто незаметна по CPU, но генерирует основную часть байт, а значит работу для GC.

Микробенчмарк делают на реальных данных: выгружают несколько десятков типичных и крупных ответов, а не синтетический объект из трёх полей. Сравнивают и время, и `Allocated`:

```csharp
[MemoryDiagnoser]
public class SerializeOrders
{
    private OrderPage _page = default!;
    private readonly ArrayBufferWriter<byte> _buffer = new(64 * 1024);

    [GlobalSetup]
    public void Setup() => _page = TestData.LoadOrderPage("orders-500.json");

    [Benchmark(Baseline = true)]
    public string Reflection() => JsonSerializer.Serialize(_page);

    [Benchmark]
    public int SourceGenToBuffer()
    {
        _buffer.ResetWrittenCount();
        using var writer = new Utf8JsonWriter(_buffer);
        JsonSerializer.Serialize(writer, _page, AppJsonContext.Default.OrderPage);
        return _buffer.WrittenCount;
    }
}

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(OrderPage))]
public partial class AppJsonContext : JsonSerializerContext;
```

## Сериализация: что даёт эффект

Порядок по убыванию отдачи такой.

**Меньше данных.** Отдельный DTO под эндпоинт вместо сущности целиком, пагинация, `DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull`, отказ от вложенных графов. Вдвое меньший payload — вдвое меньше работы на всех слоях, включая сеть и клиента.

**Без промежуточных копий.** `Serialize` в `string`, затем `Encoding.UTF8.GetBytes` — две копии, одна в UTF-16. Писать нужно сразу в UTF-8: в `Stream`, `PipeWriter`, `IBufferWriter<byte>`. ASP.NET Core делает это сам, если эндпоинт возвращает объект, а не готовую строку. На входе то же: `ReadAsStringAsync` плюс `Deserialize` материализует весь ответ, `DeserializeAsync(stream)` читает потоком, а `DeserializeAsyncEnumerable<T>` отдаёт элементы большого массива по мере чтения.

**Один `JsonSerializerOptions` на приложение.** Кэш метаданных типов привязан к options. С .NET 7 рантайм умеет переиспользовать метаданные между экземплярами с одинаковыми настройками, но `new JsonSerializerOptions()` на каждый вызов всё равно платит за создание и поиск в этом кэше, а при нестандартных настройках — и за построение контрактов заново; анализатор CA1869 с .NET 8 ловит именно этот паттерн. Options держат статическим полем или singleton'ом.

**Source generation.** `JsonSerializerContext` убирает рефлексию и прогрев метаданных: быстрее первые вызовы, меньше памяти, обязателен для NativeAOT и trimming. В установившемся режиме выигрыш скромнее; режим fast-path (`GenerationMode = JsonSourceGenerationMode.Serialization`) пишет поля напрямую в `Utf8JsonWriter`, но поддерживает не все возможности сериализатора.

**Конвертеры без обходных путей.** Самописный `JsonConverter`, который внутри вызывает `JsonDocument.Parse` или сериализует в строку, съедает весь выигрыш. Конвертеры пишут на `Utf8JsonReader`/`Utf8JsonWriter`.

**Смена формата** — последний шаг, когда JSON действительно узкое место на межсервисном трафике. Protobuf (через gRPC) и MessagePack дают меньший размер и меньше CPU, цена — схема, сложнее отладка, отдельная дисциплина совместимости контрактов. Для публичного API JSON обычно остаётся.

## Исключения: как найти источник

Одно исключение на запрос при 2000 RPS — это 2000 выбросов в секунду. Первый сигнал — счётчик:

```bash
dotnet-counters monitor -p 1234 --counters System.Runtime
```

На .NET 8 это EventCounter `exception-count` за интервал, на .NET 9+ — метрика `dotnet.exceptions` в meter'е `System.Runtime` с атрибутом `error.type`, которую можно собирать через OpenTelemetry и разбивать по типам.

Место выброса показывает трассировка только с ключевым словом исключений (`0x8000`) — она дешёвая и подходит для прода:

```bash
dotnet-trace collect -p 1234 --duration 00:00:00:30 \
  --providers Microsoft-Windows-DotNETRuntime:0x8000:4
```

Каждое событие `ExceptionThrown` содержит тип, сообщение и стек, включая исключения, которые тут же проглочены в `catch` и в логи не попали. В PerfView представление Exceptions Stacks группирует их по типу и стеку. Для временной диагностики изнутри процесса годится подписка на first-chance исключения с агрегацией по типу:

```csharp
var counts = new ConcurrentDictionary<string, long>();
AppDomain.CurrentDomain.FirstChanceException += (_, e) =>
    counts.AddOrUpdate(e.Exception.GetType().FullName!, 1, (_, c) => c + 1);
```

Обработчик вызывается на каждом выбросе до поиска `catch`, поэтому он должен быть дешёвым и сам ничего не бросать. First-chance исключений при нормальной работе бывает много, путать их с необработанными нельзя.

## Исключения: цена и замена

Цена складывается из нескольких частей. Сам выброс — сбор стека, поиск обработчика, раскрутка — порядка единиц–десятков микросекунд на небольшой глубине и растёт с глубиной (порядок иллюстративный, зависит от версии и стека). В .NET 9 обработку исключений переписали по образцу NativeAOT, она стала в 2–4 раза быстрее; старую можно вернуть через `DOTNET_LegacyExceptionHandling=1`. В async-цепочке исключение сохраняется в `Task` и пробрасывается заново на каждом `await` — десять уровней означают десять выбросов. Часто дороже всего логирование: `ex.ToString()` резолвит имена методов и строит строку, а лог на каждом уровне умножает это.

`try/catch` без выброса почти ничего не стоит — обработчики описаны таблицами, а не кодом на пути выполнения. Платят только за `throw`.

Типичные источники массовых исключений — ожидаемые исходы, оформленные как исключительные: `int.Parse`/`Guid.Parse` внутри `try`, валидация через `ValidationException`, «не найдено» через `KeyNotFoundException`, отмена запроса клиентом (`OperationCanceledException`, которую не стоит логировать как ошибку), таймауты зависимости на каждом запросе без circuit breaker. Ожидаемый исход возвращают значением — Try-паттерн, nullable или тип-результат:

```csharp
public static bool TryParseOrderId(ReadOnlySpan<char> s, out OrderId id)
{
    if (Guid.TryParse(s, out var g))
    {
        id = new OrderId(g);
        return true;
    }
    id = default;
    return false;
}
```

Переписывать весь код на коды возврата ради скорости не нужно — только места, видимые в профиле.

## Lock contention: как увидеть

Блокировка стала узким местом, если одновременно видны три признака: счётчик конфликтов растёт быстрее нагрузки, пропускная способность перестаёт расти при добавлении ядер, а CPU недогружен — потоки ждут, а не работают. Метрики: EventCounter `monitor-lock-contention-count`, на .NET 9+ `dotnet.monitor.lock_contentions` в meter'е `System.Runtime`, в коде — `Monitor.LockContentionCount`. Рядом смотрят число потоков пула: его рост при низком CPU означает блокирующиеся потоки. Абсолютное число конфликтов мало что говорит; важна динамика — если при удвоении RPS конфликты растут вчетверо, а p99 ползёт вверх, блокировка сериализует запросы.

Какая именно блокировка, показывает трассировка с ключевым словом Contention (`0x4000`):

```bash
dotnet-trace collect -p 1234 --duration 00:00:00:30 \
  --providers Microsoft-Windows-DotNETRuntime:0x4000:4
```

События `ContentionStart`/`ContentionStop` идут со стеками, в новых версиях `ContentionStop` содержит длительность ожидания. Альтернативы — Thread Time в PerfView и два-три дампа под нагрузкой с интервалом в секунду: `syncblk` показывает объект, владельца и число ждущих, `clrstack -all` — чем занят владелец (см. `Анализ дампа`). Учтите слепые зоны: `SemaphoreSlim`, `ReaderWriterLockSlim` и `SpinLock` в счётчик Monitor не попадают, а ожидание `WaitAsync` не держит поток и проявляется только ростом латентности и числа висящих задач.

## Lock contention: как лечить

Лечение зависит от природы конфликта.

- **Длинная секция** — внутри I/O, логирование, сериализация, вызов чужого кода. Тяжёлую работу выносят за `lock`, под блокировкой остаётся только изменение общего состояния.
- **Короткая, но очень частая** — одна глобальная блокировка на кэш или счётчик. Помогает шардирование (lock striping), `ConcurrentDictionary`, `Interlocked`, неизменяемые снимки для чтения с атомарной заменой ссылки.
- **Много чтений, редкие записи** — `ReaderWriterLockSlim`, но только если секция чтения не крошечная: его собственный оверхед выше, чем у `Monitor`.
- **Lock convoy** — владельца вытесняет ОС, очередь растёт; видно по большому разбросу длительности ожиданий.

Шардирование по ключу выглядит так:

```csharp
public sealed class StripedCounter
{
    private readonly Lock[] _locks;
    private readonly Dictionary<string, long>[] _shards;

    public StripedCounter(int stripes)
    {
        _locks = new Lock[stripes];
        _shards = new Dictionary<string, long>[stripes];
        for (var i = 0; i < stripes; i++)
        {
            _locks[i] = new Lock();
            _shards[i] = new Dictionary<string, long>();
        }
    }

    public void Increment(string key)
    {
        var i = (int)((uint)key.GetHashCode() % (uint)_locks.Length);
        lock (_locks[i])
        {
            ref var value = ref CollectionsMarshal.GetValueRefOrAddDefault(_shards[i], key, out _);
            value++;
        }
    }
}
```

`System.Threading.Lock` появился в .NET 9: оператор `lock` над полем этого типа компилятор C# 13 разворачивает в `EnterScope()` вместо `Monitor.Enter`. Это отдельный легковесный тип блокировки без sync block у объекта, но он меняет стоимость захвата, а не устраняет конфликт — если все потоки идут в одну секцию, нужно менять дизайн. Устройство `Monitor`, thin lock и spin перед уходом в ядро разобраны в статье `lock и Monitor`, взаимные блокировки — в `Deadlock, livelock, starvation`.

## Что стоит ответить на собеседовании

Сериализацию, исключения и блокировки не оптимизируют вслепую: сначала их доля в CPU-профиле, профиле аллокаций и счётчиках. Для JSON — меньше данных, запись сразу в UTF-8 поток без промежуточных строк, один экземпляр `JsonSerializerOptions`, source generation, бинарный формат только для межсервисного трафика. Исключения находят по `exception-count`/`dotnet.exceptions` и событиям `ExceptionThrown` в трассировке, ожидаемые исходы переводят на Try-паттерн. Контеншн видно по `monitor-lock-contention-count` при недогруженном CPU и по событиям `ContentionStart`/`ContentionStop` со стеками.

Сильный ответ знает, что `try` без `throw` бесплатен, а async-цепочка пробрасывает исключение на каждом `await`, что в .NET 9 обработка исключений ускорилась в разы, а логирование стектрейса часто дороже самого выброса. Он помнит слепые зоны счётчика конфликтов (`SemaphoreSlim`, `ReaderWriterLockSlim`), различает длинную секцию, частую короткую и lock convoy и понимает, что `System.Threading.Lock` в .NET 9 удешевляет захват, но не убирает сериализацию — её убирают шардированием, lock-free структурами и неизменяемыми снимками.
