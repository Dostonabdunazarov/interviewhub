---
title: Channel<T>
slug: channel-t
track: dotnet-backend
section: concurrency
level: middle
sortOrder: 10
summary: Асинхронная очередь producer-consumer внутри процесса — bounded и unbounded каналы, режимы переполнения, завершение и ошибки, backpressure, воркеры и конвейеры, фоновая обработка в BackgroundService и чем канал не является.
---

Задача «одни кладут работу, другие забирают» встречается постоянно: фоновая обработка после ответа на запрос, конвейер, батчевая запись в базу. Нужна очередь, которая потокобезопасна, умеет **ждать** — читатель ждёт данных, писатель ждёт места, — и не занимает потоки на время ожидания. `ConcurrentQueue<T>` ждать не умеет, `BlockingCollection<T>` ждёт, блокируя поток. `Channel<T>` из `System.Threading.Channels` — асинхронная версия того же, встроенная в .NET начиная с Core 3.0.

## Основы

Канал состоит из двух половин: `ChannelWriter<T>` для производителя и `ChannelReader<T>` для потребителя.

```csharp
var channel = Channel.CreateBounded<Order>(new BoundedChannelOptions(1000)
{
    FullMode = BoundedChannelFullMode.Wait,
    SingleReader = true
});

await channel.Writer.WriteAsync(order, ct);
channel.Writer.Complete();

await foreach (var item in channel.Reader.ReadAllAsync(ct))
    await ProcessAsync(item, ct);
```

`Complete` сообщает, что данных больше не будет. `ReadAllAsync` отдаёт элементы, пока канал не закрыт **и** не опустошён, — после этого цикл завершается сам.

| Сторона | Методы |
| --- | --- |
| писатель | `WriteAsync`, `TryWrite` без ожидания, `WaitToWriteAsync`, `Complete(exception?)`, `TryComplete` |
| читатель | `ReadAsync`, `TryRead`, `WaitToReadAsync`, `ReadAllAsync`, `Completion`, `Count` |

Хорошая практика — отдавать каждой стороне только её половину: потребитель получает `ChannelReader<T>`, производитель — `ChannelWriter<T>`. Тип сразу фиксирует, кто может писать и кто закрывает канал.

## Ожидание без потоков

Главное отличие от `BlockingCollection<T>` — ожидание через `ValueTask`, а не через заблокированный поток. Проверено на .NET 10: 32 ожидающих на пустой очереди из задач пула.

```
32 × BlockingCollection.Take()     потоков пула: 7 → 20
32 × Channel.Reader.ReadAsync()    потоков пула: 20 → 20
```

`Take` занял поток пула на каждого ожидающего, и пул начал добавлять новые — первый шаг к голоданию (см. `Процессы, потоки и ThreadPool`). `ReadAsync` зарегистрировал 32 продолжения и не занял ни одного потока.

Внутри канал — буфер элементов плюс очереди ожидающих операций на переиспользуемых `IValueTaskSource`. Если данные или место есть, операция завершается синхронно и без аллокаций. Замер на .NET 10, сто тысяч элементов от одного писателя одному читателю:

```
                         время        аллокации на элемент
unbounded                10–29 мс     10,5 байта
unbounded, SR/SW          8–12 мс     0,4–1,4 байта
bounded(100)             23–26 мс     0
bounded(100), SR/SW      23–30 мс     0
```

Сто тысяч элементов за десятки миллисекунд — канал почти никогда не узкое место. Unbounded хранит элементы в `ConcurrentQueue<T>` и аллоцирует её сегменты, bounded — кольцевой буфер под одной блокировкой и в устойчивом режиме не аллоцирует вовсе. Подсказки `SingleReader`/`SingleWriter` позволяют выбрать более дешёвую реализацию; нарушать их нельзя — поведение будет неопределённым.

## Bounded или unbounded

`Channel.CreateUnbounded<T>()` принимает всё: `WriteAsync` завершается сразу, `TryWrite` всегда возвращает `true`. Если писатель быстрее читателя, канал растёт без предела. Двадцать тысяч записей по килобайту при потребителе, который на каждом элементе делает `await Task.Delay(1)`, — .NET 10:

```
в канале 19 996 элементов, куча 20 МБ
```

При всплеске нагрузки так копится не 20 МБ, а вся доступная память, и процесс падает по OOM вместе со всем, что лежало в очереди. Неограниченная очередь не устраняет перегрузку — она превращает её в рост памяти и задержек.

`Channel.CreateBounded<T>(capacity)` ограничивает буфер и решает, что делать при переполнении. Проверено на канале ёмкостью 10, двадцать записей подряд через `TryWrite`:

| `FullMode` | Поведение | Результат замера |
| --- | --- | --- |
| `Wait` | `WriteAsync` ждёт места, `TryWrite` возвращает `false` | принято 10 из 20 |
| `DropOldest` | выбрасывается самый старый элемент | в канале 10..19 |
| `DropNewest` | выбрасывается самый новый элемент в буфере | редкий случай |
| `DropWrite` | новый элемент отбрасывается, а запись считается успешной | `true` 20 раз, в канале 0..9 |

Ловушка `DropWrite` видна в последней строке: писатель получает «успех», а данные пропадают молча. Для режимов с отбрасыванием есть перегрузка `Channel.CreateBounded(options, itemDropped)` — колбэк получает выброшенный элемент, туда пишут метрику или освобождают ресурсы.

Правило: **bounded почти всегда**. Unbounded оправдан, когда скорость записи ограничена извне и заведомо ниже скорости чтения — таймер раз в секунду, «почтовый ящик» компонента с небольшим трафиком — или когда писать нужно из синхронного кода без шанса на отказ. Ёмкость выбирают как «сколько элементов не жалко потерять при падении и сколько памяти не жалко», а не «побольше на всякий случай».

## Backpressure

Ограниченная очередь даёт **обратное давление**: медленный потребитель через полный канал замедляет быстрого производителя. Стратегия зависит от того, можно ли замедлить источник.

**Внутренний конвейер** — замедлить. Режим `Wait`, и давление распространяется само:

```csharp
var parsed = Channel.CreateBounded<Record>(new BoundedChannelOptions(500)
{
    FullMode = BoundedChannelFullMode.Wait,
    SingleWriter = true,
    SingleReader = true
});

var producer = Task.Run(async () =>
{
    await foreach (var line in ReadLinesAsync(path, ct))
        await parsed.Writer.WriteAsync(Parse(line), ct);
    parsed.Writer.Complete();
});

var batch = new List<Record>(100);
while (await parsed.Reader.WaitToReadAsync(ct))
{
    while (batch.Count < 100 && parsed.Reader.TryRead(out var record))
        batch.Add(record);
    await db.BulkInsertAsync(batch, ct);
    batch.Clear();
}
await producer;
```

Если база тормозит, `WriteAsync` ждёт, и чтение файла замедляется. Память ограничена сверху: 500 элементов в канале и один батч. Связка `WaitToReadAsync` + `TryRead` в цикле — стандартный способ собирать пачки.

**HTTP-вход** — отказать. Внешнего клиента притормозить нельзя, а ждать в обработчике плохо: запросы копятся в Kestrel, держат соединения и память, клиент всё равно отвалится по таймауту и, скорее всего, повторит запрос. Лучше быстрый отказ:

```csharp
app.MapPost("/events", (Event e, ChannelWriter<Event> writer) =>
    writer.TryWrite(e)
        ? Results.Accepted()
        : Results.StatusCode(StatusCodes.Status503ServiceUnavailable));
```

**Телеметрия** — отбросить. Важно последнее состояние, а не каждое событие: `DropOldest`.

Backpressure ломают скрытые неограниченные очереди рядом с каналом: `Task.Run` на каждый элемент, `Task.WhenAll` по всем элементам сразу, `SemaphoreSlim.WaitAsync` без таймаута.

## Воркеры

Несколько потребителей из одного канала — ограниченный параллелизм без семафора:

```csharp
var workers = Enumerable.Range(0, 4).Select(async _ =>
{
    await foreach (var job in channel.Reader.ReadAllAsync(ct))
        await HandleAsync(job, ct);
});
await Task.WhenAll(workers);
```

Каждый элемент достанется ровно одному воркеру. Замер на .NET 10: 200 заданий, четыре воркера, одновременно в работе было не больше четырёх, всё заняло 769 мс. Это и fan-out, и способ ограничить нагрузку на базу или внешний API без отдельного `SemaphoreSlim`.

Ещё один сценарий — **сериализация доступа к состоянию**: один потребитель владеет данными и обрабатывает команды по очереди. Блокировки не нужны вовсе — нет общего изменяемого состояния, нет гонок и deadlock (см. `Deadlock, livelock, starvation`). Это модель актора в минимальном виде.

## Завершение и ошибки

Поведение после `Complete` стоит знать точно — проверено на .NET 10:

- элементы, записанные до `Complete`, остаются доступны: `TryRead` их отдаёт, `ReadAllAsync` дочитывает;
- после опустошения `ReadAsync` бросает `ChannelClosedException`; если канал закрыт через `Complete(ex)`, переданное исключение лежит в `InnerException`;
- `WaitToReadAsync` после обычного `Complete` возвращает `false`, а после `Complete(ex)` **бросает** само переданное исключение;
- запись в закрытый канал: `WriteAsync` бросает `ChannelClosedException`, `TryWrite` возвращает `false`;
- `Reader.Completion` — задача, которая завершится, когда канал закрыт и пуст.

`Complete(ex)` — способ передать ошибку производителя потребителю без отдельного флага.

## Фоновый обработчик

Типичная связка в ASP.NET Core: обработчик запроса кладёт задание в канал и сразу отвечает `202 Accepted`, `BackgroundService` читает и выполняет.

```csharp
public sealed class EmailWorker(ChannelReader<Email> queue, ISender sender, ILogger<EmailWorker> log)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var email in queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await sender.SendAsync(email, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogError(ex, "Не удалось отправить {Id}", email.Id);
            }
        }
    }
}
```

Две вещи обязательны. Обработку **одного** элемента оборачивают в `try/catch`: необработанное исключение завершит цикл, потребителя не станет, bounded-канал заполнится, и все писатели встанут. И нужно решить, что происходит с элементами в канале при остановке: дочитать с таймаутом или сознательно потерять (см. `Graceful shutdown`).

## Чем канал не является

Канал живёт в памяти одного процесса. При падении или перезапуске всё, что в нём лежало, пропадает, а другой экземпляр сервиса эти элементы не увидит.

| Ситуация | Лучше |
| --- | --- |
| задания нельзя терять при рестарте | брокер (RabbitMQ, Kafka) или outbox в базе |
| работу нужно распределить между экземплярами | брокер |
| обработать готовую коллекцию параллельно | `Parallel.ForEachAsync` |
| потокобезопасный буфер без ожидания | `ConcurrentQueue<T>` |
| сложная маршрутизация, окна по времени, join | TPL Dataflow или Rx |

Из новинок — `Channel.CreateUnboundedPrioritized` (.NET 9): элементы отдаются по `IComparer<T>`, а не по порядку записи.

## Что стоит ответить на собеседовании

`Channel<T>` — потокобезопасная асинхронная очередь producer-consumer внутри процесса: писатель и читатель ждут через `ValueTask`, не занимая потоки, — на .NET 10 32 ожидающих `ReadAsync` не заняли ни одного потока пула, а 32 `BlockingCollection.Take()` подняли число потоков с 7 до 20. Bounded-канал ограничивает память и задаёт поведение при переполнении: `Wait` для backpressure, `DropOldest` для телеметрии, `DropWrite` с осторожностью — он молча выбрасывает данные, возвращая писателю `true`.

Сильный ответ объяснит, почему unbounded опасен (медленный потребитель — и память растёт без предела), как устроить backpressure во внутреннем конвейере и быстрый отказ `503` на HTTP-входе, зачем `Complete` и как он передаёт ошибку через `Complete(ex)`. Упомянет воркеры из одного канала как способ ограничить параллелизм, `try/catch` вокруг одного элемента в `BackgroundService` и то, что канал теряет данные при рестарте — для надёжной доставки нужен брокер или outbox.
