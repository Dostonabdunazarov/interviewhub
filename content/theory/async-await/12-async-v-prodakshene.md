---
title: Async в продакшене
slug: async-v-prodakshene
track: dotnet-backend
section: async-await
level: middle
sortOrder: 12
summary: Три типичных продакшен-проблемы асинхронного кода — забытый await, зависшая операция, которой нет в стеках потоков, и корректное асинхронное освобождение ресурсов.
questions: async-chto-budet-esli-zabyt-await, async-kak-naiti-zavisshuyu-async-operaciyu-v-prodakshene-esli-v-stekah-potokov-ee-ne-vid, async-kak-pravilno-realizovat-iasyncdisposable-v-tipe-kotoryi-vladeet-sinhronnymi-i-asin
---

Асинхронный код ломается иначе, чем синхронный. Ошибка не роняет процесс, а тихо оседает в задаче, которую никто не ждёт; зависший запрос не занимает ни одного потока, и привычный снимок стеков ничего не показывает; освобождение ресурса само оказывается вводом-выводом и падает уже после того, как полезная работа сделана.

Все три сюжета следуют из одного факта, разобранного в `State machine`: `await` не держит поток, а асинхронная операция между точками ожидания существует только как объект в куче.

## Забытый await

Без `await` метод запускается, но вызывающий код идёт дальше, не дождавшись завершения. Получается незапланированный fire-and-forget:

```csharp
public async Task SaveOrderAsync(Order order)
{
    _db.Orders.Add(order);
    _db.SaveChangesAsync();
    await _bus.PublishAsync(new OrderCreated(order.Id));
}
```

Последствий сразу несколько. Событие уходит раньше, чем заказ сохранён, или заказ не сохраняется вовсе, а вызывающий об этом не узнаёт. Исключение из `SaveChangesAsync` остаётся внутри задачи, которую никто не наблюдает. Процесс при этом не падает: начиная с .NET 4.5 ненаблюдаемые исключения задач приложение не роняют. Максимум, что случится, — событие `TaskScheduler.UnobservedTaskException`, и то лишь когда сборщик мусора доберётся до упавшей задачи, то есть недетерминированно и с задержкой. Полагаться на него как на механизм обработки ошибок нельзя.

Третье последствие специфично для веба. Запрос завершается, DI освобождает scoped-`DbContext`, а операция над ним ещё идёт — отсюда `ObjectDisposedException`. Если же следующий вызов успел стартовать на том же контексте, получится «A second operation was started on this context», потому что `DbContext` не потокобезопасен (см. `ChangeTracker`). Тот же эффект даёт `using`-блок: ресурс освобождается на выходе из блока, а операция над ним ещё не закончилась.

Родственная ошибка — `var user = GetUserAsync(id);` без `await`: в `user` лежит `Task<User>`. Обращение к членам `User` компилятор поймает, а сравнение с `null`, `ToString()`, логирование и сериализация молча «проглотят» задачу.

### Что ловит компилятор

Внутри `async`-метода вызов, возвращающий задачу, без `await` и без использования результата даёт предупреждение **CS4014**. Покрытие неполное: в обычном (не-`async`) методе предупреждения нет, и если результат присвоен переменной (`var t = SaveAsync();`), которую потом не ждут, — тоже нет. Поэтому в серьёзном проекте CS4014 переводят в ошибку через `<WarningsAsErrors>` и подключают анализаторы: `CA2012` следит за корректным использованием `ValueTask`, пакет `Microsoft.VisualStudio.Threading.Analyzers` добавляет правила про ненаблюдаемые асинхронные вызовы.

Если fire-and-forget нужен намеренно, это делают явно: `_ = DoAsync();`, с обработкой исключений внутри самого метода. В веб-приложении правильнее передать работу в фоновую очередь — `Channel<T>` плюс `BackgroundService`, — чтобы задача не пережила запрос и scoped-зависимости, на которые опирается. Почему для этого не годится `async void`, разобрано в `async void`.

## Зависшая операция, которой нет в стеках

Картина знакомая: запросы висят, CPU около нуля, а `clrstack -all` показывает спокойный пул потоков. Причина в том, что зависшая асинхронная операция не занимает поток. Это коробка машины состояний в куче, подписанная продолжением на задачу, которая никогда не завершится.

Сначала стоит отличить это от голодания пула (см. `Дедлоки на .Result`): там растут число потоков и `threadpool-queue-length` в `dotnet-counters`, в стеках видно `Task.Wait` и `GetResult`, деградируют все эндпоинты. При зависшей async-цепочке очередь пуста, стеки пустые, а соседние эндпоинты работают нормально.

### Поиск по куче

Раз операции нет в стеках, искать её надо в куче. Дамп снимают `dotnet-dump collect -p <pid>` и открывают `dotnet-dump analyze` (общий порядок работы — в `Анализ дампа`). Дальше помогают команды SOS:

```text
> dumpasync
> dumpheap -stat -type AsyncStateMachineBox
> dumpobj <адрес коробки>
> gcroot <адрес ожидаемой задачи>
```

`dumpasync` восстанавливает «асинхронные стеки» — цепочки незавершённых операций, ожидающих друг друга: контроллер ждёт сервис, сервис ждёт клиент, клиент ждёт `TaskCompletionSource`. Нижнее звено и есть то, что не завершилось. `dumpheap -stat` по типу коробок показывает, сколько операций висит в каждом методе: тысячи коробок одного метода при умеренной нагрузке — утечка зависших операций. В `dumpobj` у коробки есть поле `StateMachine`, а в нём `<>1__state` — номер `await`, на котором стоит метод, и поднятые в поля локальные переменные: параметры запроса, идентификаторы, счётчики попыток. `gcroot` отвечает на вопрос, кто держит ожидаемую задачу: словарь ожидающих ответов в клиенте, очередь `SemaphoreSlim`, `Channel`.

Если дамп можно унести на рабочую машину, Visual Studio покажет то же самое в окне **Parallel Stacks** в режиме Tasks и в окне **Tasks** — асинхронные логические стеки вместо потоковых.

Если на зависшую задачу не ссылается ничего, кроме её же ожидающих, вся цепочка недостижима и собирается GC: в дампе её уже нет, а `finally` так и не выполнились. Поэтому дамп снимают, пока проблема воспроизводится.

Типичные находки: `TaskCompletionSource`, не завершённый на одном из путей; `SemaphoreSlim.Release()` не в `finally`; `await foreach` по каналу, писатель которого не вызвал `Complete()`; ожидание внешней системы без таймаута.

### Как сделать зависания видимыми заранее

У каждой внешней операции должен быть дедлайн: `CancellationToken` с таймаутом или `WaitAsync(timeout)` на границе системы (см. `CancellationToken и таймауты`). Бесконечное ожидание — дефект, а не поведение по умолчанию. Полезна метрика «операций в полёте» — `UpDownCounter` или размер словаря ожидающих ответов: рост без роста нагрузки — ранний сигнал. Незакрытые спаны `Activity` в OpenTelemetry показывают, на каком вызове повис запрос. И примитивы должны завершаться гарантированно: `Release` в `finally`, `Complete` у писателя канала и на ошибочном пути, `TrySetException` всем ожидающим при потере соединения:

```csharp
private void OnConnectionLost(Exception ex)
{
    foreach (var (id, tcs) in _pending)
        if (_pending.TryRemove(id, out _))
            tcs.TrySetException(new IOException("Соединение потеряно", ex));
}
```

## IAsyncDisposable

`IAsyncDisposable` нужен, когда освобождение само требует ввода-вывода: сбросить буфер в поток, отправить «закрытие» по сети, дождаться фонового цикла. Базовую механику `Dispose` и финализаторов см. в `IDisposable, using и финализаторы`.

Хороший пример того, зачем это нужно, — синхронный `Dispose`, который делает синхронный IO. `StreamWriter.Dispose()` синхронно сбрасывает буфер, а в ASP.NET Core синхронные операции с телом ответа по умолчанию запрещены. Такой эндпоинт падает с `InvalidOperationException: Synchronous operations are disallowed` уже после того, как работа выполнена:

```csharp
app.MapGet("/report", async (HttpContext context) =>
{
    await using var writer = new StreamWriter(context.Response.Body);
    await writer.WriteAsync("payload");
});
```

С `await using` всё работает, с `using` — падает на выходе. То же касается `GZipStream`, `CryptoStream`, `Utf8JsonWriter`.

### Тип с синхронными и асинхронными ресурсами

Тип, владеющий такими ресурсами, обычно реализует **оба** интерфейса: не все потребители умеют освобождать асинхронно. Оба пути освобождают всё, идемпотентны и не зависят друг от друга. Документация .NET рекомендует для наследуемого типа шаблон `DisposeAsync` + `DisposeAsyncCore`:

```csharp
public class MessageSink : IAsyncDisposable, IDisposable
{
    private readonly Stream _stream;
    private readonly StreamWriter _writer;
    private readonly CancellationTokenSource _cts = new();
    private readonly Task _pump;
    private int _disposed;

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        await DisposeAsyncCore().ConfigureAwait(false);
        Dispose(disposing: false);
        GC.SuppressFinalize(this);
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        Dispose(disposing: true);
        GC.SuppressFinalize(this);
    }

    protected virtual async ValueTask DisposeAsyncCore()
    {
        _cts.Cancel();
        try { await _pump.ConfigureAwait(false); }
        catch (OperationCanceledException) { }

        await _writer.DisposeAsync().ConfigureAwait(false);
        await _stream.DisposeAsync().ConfigureAwait(false);
        _cts.Dispose();
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!disposing) return;
        _cts.Cancel();
        _writer.Dispose();
        _stream.Dispose();
        _cts.Dispose();
    }
}
```

Конструктор с запуском `_pump` опущен. `DisposeAsync` вызывает `Dispose(false)`, чтобы наследник, освобождающий неуправляемые ресурсы в `Dispose(bool)`, не потерял это на асинхронном пути; управляемые уже освобождены в `DisposeAsyncCore`. `GC.SuppressFinalize` вызывается на обоих путях — если наследник добавит финализатор, он не должен отработать после явного освобождения. Для `sealed`-класса виртуальные методы не нужны: хватит двух прямых реализаций.

Синхронный путь **не ждёт** фоновую задачу через `.Wait()`: он отменяет работу и закрывает ресурсы, а гарантия «всё дописано» есть только у асинхронного пути. Порядок освобождения обратен созданию: остановить производителей, дождаться их, затем закрыть то, во что они пишут. Флаг через `Interlocked` защищает от двойного и конкурентного вызова. `DisposeAsync` не должен бросать из-за ожидаемых ситуаций вроде отмены: `await using` вызывает его в `finally`, и если упадут и тело, и освобождение, исходное исключение потеряется.

### await using и ConfigureAwait

`ConfigureAwait(false)` на `await using` возвращает обёртку `ConfiguredAsyncDisposable`, поэтому переменную ресурса объявляют отдельно:

```csharp
var conn = new NpgsqlConnection(cs);
await using (conn.ConfigureAwait(false))
{
    await conn.OpenAsync(ct).ConfigureAwait(false);
}
```

Это актуально для библиотек; в коде приложения ASP.NET Core контекста синхронизации нет и это не нужно (см. `ConfigureAwait(false)`).

### Как это использует DI

Асинхронно освобождаемый скоуп (`CreateAsyncScope`, скоуп запроса) вызывает `DisposeAsync`, если он есть, иначе `Dispose`. Синхронно освобождаемый скоуп на сервисе, реализующем **только** `IAsyncDisposable`, бросит `InvalidOperationException` — поэтому такие типы реализуют оба интерфейса. Объекты, созданные через `new`, контейнер не видит: освобождает их владелец.

## Что стоит ответить на собеседовании

Забытый `await` превращает вызов в незапланированный fire-and-forget: порядок операций нарушен, исключение оседает в ненаблюдаемой задаче и максимум всплывёт в `UnobservedTaskException` при сборке мусора, а scoped-ресурсы вроде `DbContext` освобождаются раньше, чем операция над ними закончилась. Компилятор предупреждает CS4014 только в `async`-методах, поэтому его переводят в ошибку и добавляют анализаторы. Для освобождения с вводом-выводом реализуют `IAsyncDisposable` и используют `await using`.

Сильный ответ объяснит, почему зависшая async-операция не видна в стеках потоков — она живёт в куче как коробка машины состояний — и как её найти: дамп, `dumpasync`, `dumpheap -stat` по коробкам, поле `<>1__state` и `gcroot` на ожидаемую задачу, Parallel Stacks в режиме Tasks; а главное — как не доводить до дампа: дедлайны на каждой внешней операции, метрика операций в полёте, спаны `Activity`, `Release` в `finally`. И покажет шаблон `DisposeAsync` + `DisposeAsyncCore` вместе с `Dispose(bool)`, объяснив, почему синхронный путь не должен делать sync-over-async и почему DI требует обоих интерфейсов, если скоуп может освобождаться синхронно.
