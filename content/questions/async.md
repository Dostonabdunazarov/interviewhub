# Async / Await

Вопросы категории `async` в формате импорта (`tools/questions.md`): 27 шт.

```bash
node tools/import-questions.mjs --file content/questions/async.md --dry-run
node tools/import-questions.mjs --file content/questions/async.md --url … --email … --update
```

---

## Как работает `async/await`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-rabotaet-async-await
tags: async
```

`async/await` — синтаксический сахар, который позволяет написать асинхронный код линейно. Компилятор превращает `async`-метод в машину состояний, а `await` в месте незавершённой операции не блокирует поток, а **отдаёт его** и регистрирует продолжение, которое выполнится, когда операция закончится.

```csharp
async Task<int> GetLengthAsync(HttpClient http, string url)
{
    var body = await http.GetStringAsync(url); // поток освобождается на время запроса
    return body.Length;                        // продолжение после ответа
}
```

**Что происходит по шагам:**

1. Метод вызывается и выполняется **синхронно** до первого `await`, как обычный код.
2. `await` берёт у объекта awaiter (`GetAwaiter()`) и проверяет `IsCompleted`. Если операция уже завершена, выполнение просто идёт дальше без переключений.
3. Если нет — машина состояний запоминает номер шага, локальные переменные уже лежат в её полях, awaiter получает колбэк (`OnCompleted`), и метод **возвращает вызывающему** незавершённый `Task`.
4. Когда операция завершается (например, пришёл ответ от сокета через IOCP/epoll), колбэк вызывает `MoveNext()` машины состояний — выполнение продолжается со следующей строки. Где именно — зависит от захваченного `SynchronizationContext`/`TaskScheduler` (UI-поток в WinForms/WPF, пул потоков в ASP.NET Core).
5. `return` в методе завершает возвращённый `Task` результатом, исключение — переводит его в `Faulted`.

**Ключевая мысль:** асинхронность — это не «параллельно» и не «в другом потоке», а «не занимать поток, пока идёт ожидание». Выигрыш — масштабируемость: сервер с десятком потоков пула обслуживает тысячи одновременных запросов, которые в основном ждут БД и сеть.

**Цена.** Если метод действительно уходит в ожидание, машина состояний переезжает в кучу (аллокация), плюс объект `Task`. Для горячих путей, которые часто завершаются синхронно, есть `ValueTask`.

**Что спрашивают дальше:** создаётся ли поток (нет), где выполняется продолжение, что делает `ConfigureAwait(false)`, почему `.Result` может дать deadlock, чем плох `async void`.

## Создаёт ли `async/await` новый поток?

```yaml
category: async
level: middle
difficulty: 3
slug: async-sozdaet-li-async-await-novyi-potok
tags: async, threading
```

Нет. Ни ключевое слово `async`, ни `await` сами по себе потоков не создают. `async` лишь разрешает использовать `await` внутри метода и включает генерацию машины состояний; `await` подписывает продолжение на завершение операции и освобождает текущий поток.

```csharp
async Task DemoAsync()
{
    Console.WriteLine(Environment.CurrentManagedThreadId); // например, 1
    await Task.Delay(100);                                 // никакой поток не «спит» 100 мс
    Console.WriteLine(Environment.CurrentManagedThreadId); // в консоли — поток пула, например 6
}
```

**Почему после `await` другой id потока.** В консольном приложении и ASP.NET Core нет `SynchronizationContext`, поэтому продолжение выполняется на любом свободном потоке пула. Это **переиспользование существующих потоков**, а не создание нового. В UI-приложении продолжение вернётся в тот же UI-поток.

**Кто же ждёт IO, если потока нет.** Для настоящих асинхронных операций (сокеты, файлы с `FileOptions.Asynchronous`, `Task.Delay`) ожидание происходит в ОС или в таймере: драйвер завершает операцию, IO completion port (Windows) или epoll/kqueue (Linux/macOS) уведомляет рантайм, и лишь тогда поток пула на короткое время берёт продолжение. Во время самого ожидания ни один поток не заблокирован — это известная мысль «There is no thread».

**Когда поток всё-таки задействуется:**

| Ситуация | Что происходит |
| --- | --- |
| `await Task.Run(...)` | работа ставится в очередь пула потоков (поток берётся из пула, обычно не создаётся) |
| `Task.Factory.StartNew(..., TaskCreationOptions.LongRunning)` | создаётся выделенный поток |
| «async»-обёртка над синхронным API | внутри блокируется поток пула — асинхронность фиктивная |
| пул исчерпан и растёт | рантайм сам добавляет потоки (hill climbing), но это не из-за `await` |

**Типичная ошибка на собеседовании** — сказать «`await` запускает метод в фоне». Код до первого `await` выполняется синхронно в вызывающем потоке; если внутри тяжёлые вычисления без `await`, вызывающий поток будет занят всё это время, а компилятор даже предупредит CS1998 об `async`-методе без `await`.

## Что такое `Task`?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-takoe-task
tags: async
```

`Task` — объект, представляющий асинхронную операцию и её будущий результат (promise/future). `Task` описывает операцию без значения, `Task<TResult>` — операцию, которая вернёт `TResult`. Это не поток и не «кусок кода в фоне», а **состояние операции плюс список продолжений**.

**Что хранит `Task`:**

- статус: `Created`, `WaitingForActivation`, `WaitingToRun`, `Running`, `RanToCompletion`, `Faulted`, `Canceled`;
- результат (`Result`) или исключения (`Exception` — всегда `AggregateException`);
- продолжения, которые надо вызвать после завершения (сюда `await` регистрирует остаток метода).

**Откуда берутся задачи:**

```csharp
Task<string> a = http.GetStringAsync(url);       // IO — поток не нужен
Task<int>    b = Task.Run(() => Compute());      // CPU-работа в пуле потоков
Task<int>    c = Task.FromResult(42);            // уже завершённая
Task         d = Task.Delay(1000);               // таймер

var tcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
Task<int> e = tcs.Task;                          // завершаем вручную: tcs.SetResult(1)
```

`TaskCompletionSource` — способ обернуть в `Task` что угодно: событие, колбэк, сообщение из очереди. Флаг `RunContinuationsAsynchronously` — хорошая привычка: иначе продолжения ожидающих выполнятся синхронно внутри `SetResult`.

**Как получить результат:**

| Способ | Поведение |
| --- | --- |
| `await task` | не блокирует; при ошибке бросает **первое** исключение как есть |
| `task.Result` / `task.Wait()` | блокирует поток; бросает `AggregateException` |
| `task.GetAwaiter().GetResult()` | блокирует; бросает исходное исключение |

Блокирующие варианты допустимы только для уже завершённой задачи или в редких точках входа — иначе риск deadlock и голодания пула.

**Важные детали:**

- Задачи из `async`-методов и `Task.Run` — «горячие»: уже запущены при возврате. `new Task(...)` + `Start()` почти никогда не нужен.
- Завершённый `Task` можно `await`-ить сколько угодно раз и из разных мест — в отличие от `ValueTask`.
- `Task` не надо `Dispose`-ить в обычном коде.
- Если задача упала, а её никто не ожидал, исключение «не наблюдено»: процесс не падает (с .NET 4.5), но срабатывает событие `TaskScheduler.UnobservedTaskException` при финализации.

## Чем `Task` отличается от `Thread`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-chem-task-otlichaetsya-ot-thread
tags: async, threading
```

`Thread` — это поток операционной системы, механизм **выполнения** кода. `Task` — абстракция **операции и её результата**, которая может выполняться на потоке пула, а может не требовать потока вовсе (ожидание сети, таймер). Это сущности разного уровня: Task описывает «что и чем закончилось», Thread — «где исполняется».

| | `Thread` | `Task` |
| --- | --- | --- |
| Что это | поток ОС со своим стеком (по умолчанию резервируется ~1 МБ) | объект-обещание с состоянием и продолжениями |
| Стоимость создания | высокая: системный вызов, стек | дешёвая: небольшой объект в куче |
| Где выполняется | на себе | на пуле потоков через `TaskScheduler` или без потока (IO) |
| Результат | нет, только через общие переменные | `Task<T>.Result` / `await` |
| Исключения | необработанное в потоке **роняет процесс** | сохраняются в задаче и пробрасываются при `await` |
| Отмена | нет штатной (`Thread.Abort` не поддерживается в .NET Core+) | кооперативная через `CancellationToken` |
| Композиция | `Join` | `await`, `WhenAll`, `WhenAny`, продолжения |

```csharp
// Thread: сам управляешь жизнью потока
var t = new Thread(() => Work()) { IsBackground = true };
t.Start();
t.Join();

// Task: описываешь операцию, планировщик решает, где её выполнить
int result = await Task.Run(() => Compute());
```

**Почему по умолчанию выбирают `Task`.** Пул потоков переиспользует ограниченное число потоков и сам регулирует их количество; задачи легко комбинировать, отменять и обрабатывать ошибки. А для IO-операций `Task` вообще не занимает поток на время ожидания — 10 000 одновременных HTTP-запросов не требуют 10 000 потоков.

**Когда нужен именно `Thread`:**

- долгая блокирующая работа на весь срок жизни приложения (цикл чтения из устройства, собственный планировщик) — чтобы не занимать поток пула навсегда;
- нужны свойства потока: `ApartmentState.STA` для COM/UI, приоритет, имя, размер стека;
- альтернатива — `Task.Factory.StartNew(..., TaskCreationOptions.LongRunning)`, который создаст выделенный поток, сохранив модель задач. Но с `async`-делегатом смысла в этом нет: после первого `await` выделенный поток освободится.

**Что спрашивают дальше:** что такое ThreadPool и почему его голодание (thread pool starvation) — частая проблема при `.Result` в ASP.NET Core; чем `Task.Run` отличается от `Task.Factory.StartNew`.

## Чем `Task` отличается от `ValueTask`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-chem-task-otlichaetsya-ot-valuetask
tags: async
```

`Task` — класс, каждый незавершённый (и большинство завершённых) результатов требует объекта в куче. `ValueTask<T>` — структура, которая хранит **либо готовый результат, либо `Task<T>`, либо `IValueTaskSource<T>`**. Если метод часто завершается синхронно (кэш, буфер уже заполнен), `ValueTask` позволяет не аллоцировать ничего.

```csharp
private readonly Dictionary<int, User> _cache = new();

public ValueTask<User> GetUserAsync(int id)
{
    if (_cache.TryGetValue(id, out var user))
        return ValueTask.FromResult(user);        // без аллокации

    return new ValueTask<User>(LoadAndCacheAsync(id)); // медленный путь — обычный Task
}
```

| | `Task<T>` | `ValueTask<T>` |
| --- | --- | --- |
| Тип | класс | `readonly struct` |
| Синхронный результат | аллокация (кроме кэшированных `Task.CompletedTask`, некоторых `bool`/малых `int`) | без аллокации |
| Сколько раз можно `await` | сколько угодно, из разных мест | **ровно один раз** |
| `.Result` до завершения | блокирует, но корректно | не поддерживается для `IValueTaskSource` — неопределённое поведение |
| `WhenAll`/`WhenAny` | напрямую | только через `.AsTask()` |
| Размер при передаче | одна ссылка | больше (поля результата + ссылка + служебные) |

**Почему «только один раз».** За `ValueTask` может стоять переиспользуемый `IValueTaskSource` — например, сокеты в .NET возвращают `ValueTask` из `ReceiveAsync`, используя один объект на много операций. После первого `await` источник может быть уже отдан под следующую операцию, и повторное ожидание прочитает чужой результат.

Запрещено для `ValueTask`:

- `await` дважды, хранить в поле и ожидать из нескольких мест;
- ожидать параллельно из разных потоков;
- вызывать `.Result`/`GetAwaiter().GetResult()` до завершения.

Если нужно что-то из этого — один раз вызови `.AsTask()` и работай с `Task`.

**Когда выбирать.** По умолчанию — `Task`: проще и безопаснее. `ValueTask` — для горячих путей библиотек с частым синхронным завершением, подтверждённых профилированием, и для реализации интерфейсов, где так решил автор API (`IAsyncEnumerator<T>.MoveNextAsync`, `IAsyncDisposable.DisposeAsync`, `Stream.ReadAsync(Memory<byte>)`). Необобщённый `ValueTask` полезен реже, так как `Task.CompletedTask` и так кэширован.

## Что происходит после `await`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-chto-proishodit-posle-await
tags: async
```

После `await` выполнение метода продолжается со следующей строки, но **не обязательно сразу и не обязательно в том же потоке**. Если ожидаемая задача уже завершена, код идёт дальше синхронно. Если нет — метод возвращает управление вызывающему, а остаток метода выполнится как продолжение, когда задача завершится.

**Где выполнится продолжение** решает то, что было захвачено в момент `await`:

| Окружение | Захваченный контекст | Где продолжится код |
| --- | --- | --- |
| WinForms / WPF / MAUI | UI `SynchronizationContext` | в UI-потоке (через очередь сообщений) |
| ASP.NET Core, консоль, worker | контекста нет, `TaskScheduler.Default` | на любом потоке пула |
| Классический ASP.NET (Framework) | `AspNetSynchronizationContext` | в контексте запроса (по одному потоку за раз) |
| Любое + `ConfigureAwait(false)` | контекст игнорируется | на потоке, который завершил задачу, или в пуле |

```csharp
private async void Button_Click(object s, EventArgs e)
{
    var data = await LoadAsync();   // UI-поток свободен, окно отзывчиво
    label.Text = data;              // снова UI-поток — можно трогать контролы
}
```

**Что сохраняется, а что нет:**

- Локальные переменные и параметры — живут в полях машины состояний, значения на месте.
- `ExecutionContext` (а значит, `AsyncLocal<T>`, текущая культура, `Activity` для трассировки) **перетекает** через `await` всегда, даже с `ConfigureAwait(false)`.
- `ThreadLocal`/`[ThreadStatic]` — не сохраняются: поток может быть другим.
- Блокировка `lock` через `await` невозможна — компилятор запрещает `await` внутри `lock`. Для асинхронной взаимоисключаемости есть `SemaphoreSlim.WaitAsync`.

**Результат и исключения.** `await` на `Task<T>` возвращает значение; если задача завершилась с ошибкой, `await` бросает исходное исключение (первое из `AggregateException`) с сохранённым стектрейсом; если отменена — `OperationCanceledException`.

**Тонкость про «синхронно».** Продолжение может выполниться синхронно прямо в потоке, который завершил задачу (например, внутри `TaskCompletionSource.SetResult`). Поэтому при создании `TaskCompletionSource` часто указывают `RunContinuationsAsynchronously`, чтобы чужой код не выполнялся внутри вашего вызова.

## Что такое state machine для async-метода?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-takoe-state-machine-dlya-async-metoda
tags: async
```

State machine — тип, в который компилятор C# переписывает `async`-метод. Тело метода разрезается по точкам `await` на шаги, текущий шаг хранится в поле `state`, а локальные переменные становятся полями. Метод `MoveNext()` выполняет код от текущей точки до следующего `await`, и его же вызывают снова, когда ожидаемая операция завершилась.

```csharp
async Task<int> LoadAsync(string url)
{
    var text = await _http.GetStringAsync(url);
    return text.Length;
}
```

Упрощённо превращается в:

```csharp
struct LoadAsyncStateMachine : IAsyncStateMachine
{
    public int state;                              // -1 — старт, 0 — после первого await
    public AsyncTaskMethodBuilder<int> builder;    // создаёт и завершает Task
    public string url;                             // параметры и локальные — поля
    private TaskAwaiter<string> awaiter;

    public void MoveNext()
    {
        try
        {
            if (state != 0)
            {
                awaiter = _http.GetStringAsync(url).GetAwaiter();
                if (!awaiter.IsCompleted)
                {
                    state = 0;
                    builder.AwaitUnsafeOnCompleted(ref awaiter, ref this); // подписка и выход
                    return;
                }
            }
            var text = awaiter.GetResult();        // результат или исключение
            builder.SetResult(text.Length);
        }
        catch (Exception ex) { builder.SetException(ex); }
    }
}
```

Сам метод `LoadAsync` превращается в заглушку: создаёт структуру, заполняет параметры, вызывает `builder.Start(ref sm)` и возвращает `builder.Task`.

**Роли участников:**

- **State machine** — хранит состояние и код шагов.
- **Builder** (`AsyncTaskMethodBuilder`, `AsyncValueTaskMethodBuilder`, `AsyncVoidMethodBuilder`) — создаёт возвращаемую задачу, завершает её результатом или исключением.
- **Awaiter** — то, что возвращает `GetAwaiter()`: `IsCompleted`, `OnCompleted`, `GetResult`. `await` работает с любым типом, у которого есть такой паттерн.

**Практические следствия:**

- В Release машина состояний — структура; пока метод завершается синхронно, в куче ничего не создаётся. При первом реальном ожидании она **боксится** в кучу вместе со всеми полями. В Debug это класс — для удобства отладки.
- Исключения ловятся внутри `MoveNext` и кладутся в `Task`, поэтому ошибка из `async`-метода не вылетает при вызове, а только при `await`.
- Стектрейсы содержат `MoveNext` и `<LoadAsync>d__3` — это и есть сгенерированный тип; современный .NET умеет показывать их в читаемом виде.
- Если метод просто возвращает чужую задачу, можно убрать `async` и вернуть `Task` напрямую — машины состояний не будет. Но тогда исключения и `using` ведут себя иначе, поэтому по умолчанию оставляют `async/await`.

## Что такое CPU-bound и IO-bound операции?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-takoe-cpu-bound-i-io-bound-operacii
```

**CPU-bound** — операция, скорость которой ограничена процессором: вычисления, сжатие, хеширование, парсинг больших объёмов, обработка изображений. **IO-bound** — операция, которая в основном **ждёт** внешний ресурс: базу данных, HTTP, диск, очередь сообщений. От этого разделения зависит, какой инструмент применять.

| | CPU-bound | IO-bound |
| --- | --- | --- |
| Чем занята | ядро процессора считает | ждёт ответа от устройства/сети |
| Нужен ли поток на время работы | да, всё время | нет, только до и после ожидания |
| Как ускорить | распараллелить на ядра | не блокировать поток, выполнять запросы конкурентно |
| Инструменты | `Parallel.For/ForEach`, PLINQ, `Task.Run` | настоящие `...Async` API + `await` |
| Предел | число ядер | внешняя система (пул соединений БД, rate limit API) |

```csharp
// IO-bound: поток не занят, пока идёт запрос
var json = await httpClient.GetStringAsync(url);

// CPU-bound: нужен поток; в UI выносим с UI-потока
var hash = await Task.Run(() => ComputeHash(bigFile));
```

**Почему это важно для async/await.** `await` на IO-операции освобождает поток: в сервере это даёт масштабируемость, в UI — отзывчивость. Для CPU-работы `await` сам по себе ничего не даёт — вычисление всё равно должно где-то выполняться. Оборачивание его в `Task.Run` лишь переносит нагрузку на другой поток пула.

**Типичные ошибки:**

- Обернуть IO в `Task.Run(() => client.Get(url))` — синхронный вызов блокирует поток пула, выигрыша нет, лишняя стоимость есть.
- Запускать CPU-работу в ASP.NET Core через `Task.Run` в запросе «для асинхронности» — запрос всё равно ждёт, а поток пула занят; нагрузка не уменьшилась.
- Распараллеливать IO через `Parallel.ForEach` с синхронными вызовами — блокирует потоки. Для конкурентного IO — `Task.WhenAll`, `Parallel.ForEachAsync` или `SemaphoreSlim`.
- Считать, что IO-операции бесконечно параллельны: реальный предел задают пул соединений и внешний сервис.

На практике операции часто смешанные: запрос в БД (IO) → десериализация большого ответа (CPU). Важно понимать, какая часть доминирует и где узкое место.

## Когда нужен `Task.Run()`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kogda-nuzhen-task-run
tags: async
```

`Task.Run` ставит делегат в очередь пула потоков и возвращает `Task`, представляющий его выполнение. Он нужен, когда **CPU-bound работу надо увести с текущего потока**, который нельзя занимать: чаще всего UI-поток, иногда — чтобы распараллелить независимые вычисления.

```csharp
private async void OnProcessClick(object s, EventArgs e)
{
    progress.Visible = true;
    var report = await Task.Run(() => BuildHeavyReport(data)); // UI не зависает
    grid.DataSource = report;                                  // снова UI-поток
}
```

**Уместные сценарии:**

- **UI-приложения** (WPF, WinForms, MAUI): тяжёлые вычисления вне UI-потока, чтобы окно оставалось отзывчивым.
- **Параллельные вычисления**: несколько независимых CPU-задач `Task.Run` + `Task.WhenAll` (хотя для данных чаще удобнее `Parallel.ForEach`/PLINQ).
- **Вынужденная обёртка синхронного API** в UI, когда асинхронной версии нет и поток UI блокировать нельзя.
- **Фоновая обработка в консольных/worker-приложениях**, если нужен явный запуск на пуле.

**Когда `Task.Run` не нужен или вреден:**

- Для IO-операций, у которых есть `...Async` версия — они и так не занимают поток.
- В ASP.NET Core внутри запроса: запрос всё равно ждёт результат, а поток пула просто меняется на другой поток пула. Только лишние переключения и нагрузка на пул.
- В библиотеке, «чтобы метод выглядел асинхронным» (`Task.Run(() => Compute())` под именем `ComputeAsync`). Это обман потребителя: пусть вызывающий сам решает, куда выносить работу.
- «Fire-and-forget» в веб-приложении: задача может быть убита при остановке приложения, исключения потеряются, scoped-сервисы из DI уже будут освобождены. Для фоновой работы — `BackgroundService` + очередь (`Channel<T>`).

**`Task.Run` и `async`-лямбды.** `Task.Run(async () => await ...)` корректно разворачивает внутреннюю задачу и возвращает `Task`, завершающийся вместе с лямбдой. `Task.Factory.StartNew` с `async`-лямбдой вернёт `Task<Task>`, и `await` дождётся только первого `await` внутри — классическая ловушка, лечится `.Unwrap()` или использованием `Task.Run`.

**Отмена.** `Task.Run(work, token)` проверяет токен только до старта: если он уже отменён, задача сразу станет `Canceled`. Внутри делегата токен нужно проверять самостоятельно.

## Почему `Task.Run()` обычно не нужен для IO-bound операций?

```yaml
category: async
level: middle
difficulty: 3
slug: async-pochemu-task-run-obychno-ne-nuzhen-dlya-io-bound-operacii
tags: async
```

Потому что настоящая асинхронная IO-операция и так **не занимает поток** во время ожидания. `Task.Run` берёт поток из пула; если внутри вызывается асинхронный API, этот поток почти сразу освобождается и ничего не выигрывается, а если синхронный — поток пула просто блокируется на всё время запроса.

```csharp
// Плохо: поток пула заблокирован на всё время запроса
var data = await Task.Run(() => File.ReadAllText(path));

// Бессмысленно: лишний переход в пул перед тем же самым асинхронным вызовом
var data = await Task.Run(() => File.ReadAllTextAsync(path));

// Правильно
var data = await File.ReadAllTextAsync(path);
```

**Как устроен асинхронный IO.** Метод вроде `Socket.ReceiveAsync` отправляет запрос в ОС и сразу возвращает незавершённую задачу. Пока данные в пути, ни один .NET-поток не ждёт. Когда драйвер завершает операцию, ОС уведомляет рантайм (IO completion ports в Windows, epoll/kqueue в Unix), и поток пула ненадолго выполняет продолжение. Ожидание стоит почти ничего.

**Сравнение на нагрузке.** Сервер получает 1000 одновременных запросов, каждый ждёт БД 200 мс:

| Подход | Сколько потоков заняты во время ожидания |
| --- | --- |
| `await db.QueryAsync(...)` | практически ноль |
| синхронный `db.Query(...)` | 1000 |
| `await Task.Run(() => db.Query(...))` | те же 1000, только из пула — плюс накладные расходы |

Во втором и третьем случае пул потоков быстро исчерпывается, он растёт медленно (hill climbing добавляет потоки постепенно), задержки растут — это **thread pool starvation**.

**Когда исключение оправдано:**

- В UI-приложении нужно вызвать **только синхронный** IO API (старая библиотека, драйвер без async): `Task.Run` освободит UI-поток ценой потока пула. Это компромисс, а не асинхронность.
- Асинхронный API, который на самом деле делает значительную синхронную работу до первого `await` (некоторые клиенты, резолв DNS, построение запроса), и его нельзя вызывать в UI-потоке.

В серверном коде правильное решение для синхронного IO — найти асинхронную альтернативу, а не прятать блокировку в `Task.Run`.

## Что будет, если забыть `await`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-chto-budet-esli-zabyt-await
tags: async
```

Метод запустится, но код пойдёт дальше, **не дождавшись его завершения**. Получится незапланированный fire-and-forget: порядок операций нарушен, результат не получен, а исключение из задачи никто не увидит — ошибка молча пропадёт.

```csharp
public async Task SaveOrderAsync(Order order)
{
    _db.Orders.Add(order);
    _db.SaveChangesAsync();          // забыли await
    await _bus.PublishAsync(new OrderCreated(order.Id));
}
```

**Что здесь может пойти не так:**

- Событие опубликовано раньше, чем заказ сохранён, или заказ не сохранится вовсе, а вызывающий об этом не узнает.
- Исключение из `SaveChangesAsync` останется в задаче, которую никто не ожидает. Процесс не упадёт (с .NET 4.5 необработанные исключения задач не роняют приложение), в лучшем случае сработает `TaskScheduler.UnobservedTaskException` при сборке мусора.
- В ASP.NET Core запрос завершится, scoped `DbContext` будет освобождён, пока операция ещё идёт: `ObjectDisposedException` или «A second operation was started on this context» при параллельном использовании.
- Если в `using`-блоке не дождаться операции, ресурс освободится до её окончания.

**Как компилятор помогает.** Внутри `async`-метода вызов, возвращающий `Task`, без `await` и без использования результата даёт предупреждение **CS4014**. Но не везде:

- в не-`async` методе предупреждения нет;
- если результат присвоен переменной (`var t = SaveAsync();`) и потом не ожидается — тоже нет.

Поэтому полезно включать анализаторы (например, `CA2012` для `ValueTask`, правила из `Microsoft.VisualStudio.Threading.Analyzers`) и делать CS4014 ошибкой через `<WarningsAsErrors>`.

**Родственная ошибка — забыть `await` при получении результата:**

```csharp
var user = GetUserAsync(id);   // Task<User>, а не User
if (user == null) { ... }      // никогда не true
```

Обычно ловится компилятором при обращении к членам, но `==`, `ToString()`, логирование и сериализация «проглотят» `Task`.

**Если fire-and-forget действительно нужен,** делайте это явно: `_ = DoAsync();` с обработкой исключений внутри метода, а в веб-приложении — лучше передать работу в фоновую очередь (`Channel<T>` + `BackgroundService`), чтобы задача не жила дольше запроса и сервисов, от которых зависит.

## Почему `async void` обычно использовать не рекомендуется?

```yaml
category: async
level: middle
difficulty: 3
slug: async-pochemu-async-void-obychno-ispolzovat-ne-rekomenduetsya
tags: async
```

`async void` метод нельзя ожидать и нельзя поймать его исключение снаружи. Вызывающий код не знает, когда метод закончился и закончился ли успешно, а необработанное исключение выбрасывается в `SynchronizationContext` или пул потоков и обычно **роняет процесс**. Единственное штатное применение — обработчики событий, где сигнатура `void` навязана.

```csharp
async void SendAsync() => throw new InvalidOperationException();

try
{
    SendAsync();            // вернулся сразу, ждать нечего
}
catch (Exception)           // сюда не попадём никогда
{
}
```

**Почему исключение не ловится.** У `async Task` исключение сохраняется в возвращаемой задаче и пробрасывается при `await`. У `async void` задачи нет, поэтому `AsyncVoidMethodBuilder` перебрасывает исключение в `SynchronizationContext`, захваченный на старте метода. В UI это событие необработанного исключения диспетчера, в ASP.NET Core и консоли контекста нет — исключение бросается в поток пула, а необработанное исключение там завершает процесс.

**Сравнение:**

| | `async Task` | `async void` |
| --- | --- | --- |
| Можно `await` | да | нет |
| Исключения | в задаче, ловятся через `await` | в контекст/пул, обычно краш |
| Узнать о завершении | да | нет |
| Тестирование | `await` в тесте | тест завершится раньше метода |
| Композиция (`WhenAll`) | да | нет |

**Где ещё прячется `async void`:**

- Лямбда, переданная в параметр типа `Action`: `list.ForEach(async x => await SaveAsync(x));` — каждая лямбда становится `async void`, `ForEach` не ждёт ни одной, исключения роняют процесс. Нужен обычный `foreach` с `await` или `Task.WhenAll`.
- Подписка на события `async (s, e) => ...` — допустимо, но с `try/catch` внутри.
- `Timer` с колбэком-`async`-лямбдой.

**Как правильно писать обработчик события:**

```csharp
private async void OnSaveClick(object sender, EventArgs e)
{
    try
    {
        await SaveAsync();       // вся логика в async Task — её можно тестировать
    }
    catch (Exception ex)
    {
        ShowError(ex);
    }
}
```

Обработчик — тонкая обёртка, всё содержимое в `async Task`-методе. Если библиотека принимает только `Action`, ищите перегрузку с `Func<Task>` — многие API (`Parallel.ForEachAsync`, ASP.NET Core middleware, Polly) её предоставляют.

## Что такое deadlock при использовании async/await?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-takoe-deadlock-pri-ispolzovanii-async-await
tags: async, deadlock, synchronization
```

Классический async-deadlock возникает, когда поток **синхронно блокируется** на задаче (`.Result`, `.Wait()`, `GetAwaiter().GetResult()`), а продолжение этой задачи должно выполниться **в том же потоке** через однопоточный `SynchronizationContext`. Поток ждёт задачу, задача ждёт поток — никто не двигается.

```csharp
// WPF / WinForms / классический ASP.NET
private void Button_Click(object s, EventArgs e)
{
    var text = LoadAsync().Result;   // UI-поток заблокирован
    label.Text = text;
}

private async Task<string> LoadAsync()
{
    var r = await http.GetStringAsync(url); // продолжение хочет вернуться в UI-поток
    return r;
}
```

**Пошагово:**

1. UI-поток вызывает `LoadAsync`, тот доходит до `await` и захватывает UI-контекст.
2. `LoadAsync` возвращает незавершённую задачу, UI-поток встаёт на `.Result`.
3. HTTP-ответ приходит, продолжение отправляется в очередь UI-потока.
4. UI-поток заблокирован и очередь не обрабатывает — продолжение не выполнится никогда, задача не завершится.

**Где это случается.** В WinForms, WPF, MAUI, классическом ASP.NET (System.Web) — везде, где есть контекст, допускающий один поток. В **ASP.NET Core и консольных приложениях `SynchronizationContext` нет**, продолжение уходит в пул, и именно такого deadlock не будет. Но блокировка там всё равно вредна: каждый `.Result` держит поток пула, и под нагрузкой это приводит к thread pool starvation — сервис «замирает», хотя формально не дедлок.

**Как избегать:**

- **Async all the way**: если снизу `async`, то и вызывающий код `async`, вплоть до обработчика события или action контроллера. Это основное решение.
- **`ConfigureAwait(false)` в библиотечном коде** — продолжения не требуют исходного контекста, и блокировка сверху не вызовет deadlock. Но нужно ставить его на *каждый* `await` во всей цепочке, включая чужие библиотеки, поэтому это страховка, а не лечение.
- Если синхронная точка входа неизбежна (старый интерфейс, `Main` в древнем проекте), вызывать через `Task.Run(() => LoadAsync()).GetAwaiter().GetResult()` — внутри `Task.Run` нет UI-контекста. Это костыль с ценой потока.

**Другие async-deadlock'и,** о которых тоже спрашивают:

- `SemaphoreSlim` с `count = 1`, повторно захваченный в той же логической цепочке (он не реентерабелен).
- Два потока ожидают `TaskCompletionSource` друг друга.
- Продолжение, выполненное синхронно внутри `SetResult` под `lock`, пытается взять тот же `lock` в другом порядке — поэтому используют `RunContinuationsAsynchronously`.

## Что такое `SynchronizationContext`?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-takoe-synchronizationcontext
tags: async, synchronization
```

`SynchronizationContext` — абстракция «места», куда можно отправить делегат на выполнение. Основные методы — `Post` (асинхронно поставить в очередь) и `Send` (выполнить синхронно). `await` по умолчанию захватывает текущий контекст и через него запускает продолжение, благодаря чему в UI-приложении код после `await` снова оказывается в UI-потоке.

```csharp
// Что по сути делает await в UI-приложении
var ctx = SynchronizationContext.Current;          // UI-контекст
http.GetStringAsync(url).ContinueWith(t =>
    ctx.Post(_ => label.Text = t.Result, null));    // вернуть в UI-поток
```

**Реализации в разных окружениях:**

| Окружение | `SynchronizationContext.Current` | Поведение |
| --- | --- | --- |
| WinForms | `WindowsFormsSynchronizationContext` | `Post` → `Control.BeginInvoke`, UI-поток |
| WPF | `DispatcherSynchronizationContext` | через `Dispatcher` UI-потока |
| MAUI / Avalonia | собственные контексты UI | UI-поток |
| Классический ASP.NET | `AspNetSynchronizationContext` | контекст запроса, `HttpContext.Current`, один поток за раз |
| ASP.NET Core | `null` | продолжения на пуле потоков |
| Консоль, worker service | `null` | пул потоков |

**Зачем он нужен.** UI-фреймворки однопоточны: контролы можно трогать только из того потока, который их создал. Без контекста после `await` пришлось бы вручную вызывать `Invoke`/`Dispatcher`. Контекст делает это прозрачно.

**Как `await` решает, куда вернуться:**

1. Если `ConfigureAwait(false)` — контекст игнорируется.
2. Иначе, если `SynchronizationContext.Current` не `null` и не базовый `SynchronizationContext` — продолжение отправляется через его `Post`.
3. Иначе, если текущий `TaskScheduler` не `Default` — через него.
4. Иначе продолжение выполняется на пуле потоков (часто прямо на потоке, завершившем операцию).

**Практические следствия:**

- Однопоточный контекст + синхронная блокировка (`.Result`) = deadlock.
- Каждый возврат в UI-контекст стоит переключения; в библиотеках, которым UI-поток не нужен, пишут `ConfigureAwait(false)`.
- В ASP.NET Core контекста нет сознательно: это упрощает модель и снимает класс deadlock'ов. Но это же значит, что после `await` код может продолжиться в другом потоке, и `[ThreadStatic]` там бесполезен — данные «запроса» передают через `AsyncLocal<T>`/`HttpContext`.
- Не путать с `ExecutionContext`: он переносит «окружение» (`AsyncLocal`, культуру, security) и течёт через `await` всегда; `SynchronizationContext` решает только, **где** выполнить продолжение.

## Что делает `ConfigureAwait(false)`?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-delaet-configureawait-false
tags: async
```

`ConfigureAwait(false)` говорит `await`: **не возвращай продолжение в захваченный `SynchronizationContext`/`TaskScheduler`**, выполняй его там, где удобно — обычно на потоке, завершившем операцию, или в пуле потоков. Метод ничего не меняет в самой задаче, он лишь настраивает, как её ожидать.

```csharp
public async Task<Config> LoadConfigAsync(string path)
{
    var json = await File.ReadAllTextAsync(path).ConfigureAwait(false);
    return JsonSerializer.Deserialize<Config>(json)!;   // уже не в UI-потоке
}
```

**Зачем это нужно:**

- **Производительность в UI.** Каждое продолжение не встаёт в очередь UI-потока, лишние переключения исчезают, UI-поток не нагружается библиотечной работой.
- **Защита от deadlock.** Если кто-то сверху сделает `.Result` в UI-потоке, продолжения библиотеки не будут ждать занятый UI-поток.

**Когда применять:**

| Код | Рекомендация |
| --- | --- |
| Библиотека общего назначения (NuGet), не зависящая от UI | `ConfigureAwait(false)` на каждом `await` |
| UI-код, который после `await` трогает контролы | **не** использовать |
| Код приложения ASP.NET Core | не обязателен: контекста нет, эффекта практически нет |
| Классический ASP.NET | осторожно: после `false` нет `HttpContext.Current`, культуры запроса |

**Частые заблуждения:**

- «`ConfigureAwait(false)` переносит работу в фоновый поток». Нет: если задача уже завершена, `await` продолжит синхронно в текущем потоке, и контекст останется прежним. Поэтому ставить его надо на все `await`, а не только на первый.
- «Он отключает перенос `AsyncLocal`». Нет: `ExecutionContext` течёт всегда.
- «Достаточно поставить в одном месте, чтобы избежать deadlock». Нет: достаточно одного `await` без него в цепочке, чтобы продолжение попросилось в UI-поток.

**Современные возможности.** С .NET 8 есть перегрузка `ConfigureAwait(ConfigureAwaitOptions)` для `Task`:

- `ConfigureAwaitOptions.None` — эквивалент `false`;
- `ContinueOnCapturedContext` — эквивалент `true`;
- `SuppressThrowing` — дождаться, но не бросать исключение (удобно, когда надо просто дождаться завершения);
- `ForceYielding` — всегда асинхронно уходить из текущего метода, даже если задача завершена.

Для `IAsyncEnumerable<T>` и `IAsyncDisposable` тоже есть `ConfigureAwait`: `await foreach (var x in source.ConfigureAwait(false))`, `await using (res.ConfigureAwait(false))`.

## Как работает `CancellationToken`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-rabotaet-cancellationtoken
tags: async
```

`CancellationToken` — механизм **кооперативной** отмены. Отменяет операцию не рантайм, а сам код: владелец `CancellationTokenSource` вызывает `Cancel()`, токен переходит в состояние «отменено», а операция, которая этот токен получила, замечает это и завершается, обычно выбрасывая `OperationCanceledException`.

**Роли:**

- `CancellationTokenSource` (CTS) — у того, кто **решает** отменить: `Cancel()`, `CancelAfter(TimeSpan)`, `CancelAsync()` (.NET 8). Реализует `IDisposable`.
- `CancellationToken` — лёгкая структура, которую **передают** вниз. Она может только наблюдать: `IsCancellationRequested`, `ThrowIfCancellationRequested()`, `Register(callback)`, `WaitHandle`.

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

try
{
    await ProcessAsync(files, cts.Token);
}
catch (OperationCanceledException) when (cts.IsCancellationRequested)
{
    Console.WriteLine("Отменено");
}

async Task ProcessAsync(IEnumerable<string> files, CancellationToken ct)
{
    foreach (var f in files)
    {
        ct.ThrowIfCancellationRequested();              // CPU-цикл: явная проверка
        var text = await File.ReadAllTextAsync(f, ct);  // IO: передаём токен дальше
        Handle(text);
    }
}
```

**Как отмена доходит до IO.** Асинхронные API регистрируют колбэк через `token.Register(...)`: при отмене он прерывает операцию на уровне ОС (закрывает запрос, отменяет IO, останавливает таймер `Task.Delay`) и завершает задачу в состоянии `Canceled`. Колбэки выполняются синхронно в потоке, вызвавшем `Cancel()`, поэтому они должны быть короткими.

**Состояние задачи.** Если в `async`-методе вылетело `OperationCanceledException`, возвращённая задача переходит в `Canceled`, а не `Faulted`. `await` на ней снова бросит `OperationCanceledException` (часто в виде наследника `TaskCanceledException`).

**Полезные приёмы:**

- `CancellationTokenSource.CreateLinkedTokenSource(a, b)` — отмена по любому из токенов (например, токен запроса + свой таймаут).
- `CancellationToken.None` / `default` — «не отменяется никогда».
- `token.CanBeCanceled` — можно пропустить регистрацию, если отмены быть не может.
- В ASP.NET Core `HttpContext.RequestAborted` (или параметр `CancellationToken` в action) отменяется, когда клиент разорвал соединение; в `BackgroundService` — `stoppingToken` при остановке хоста.

**Подводные камни:**

- Токен ничего не отменяет сам: код, который его не проверяет и не передаёт дальше, продолжит работать.
- `CTS` с таймером (`CancelAfter`) держит таймер — нужно `Dispose`, особенно если создаётся на каждый запрос.
- `Register` возвращает `CancellationTokenRegistration`, который тоже надо освобождать, иначе колбэк живёт вместе с долгоживущим токеном — утечка.

## Как правильно отменять async operation?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-pravilno-otmenyat-async-operation
tags: async
```

Правильно — принимать `CancellationToken` параметром, **передавать его во все вложенные асинхронные вызовы**, в CPU-циклах периодически проверять `ThrowIfCancellationRequested()`, а о факте отмены сообщать через `OperationCanceledException`, не маскируя её под успех или обычную ошибку.

**Правила для автора метода:**

```csharp
public async Task<Report> BuildReportAsync(int id, CancellationToken cancellationToken = default)
{
    var rows = await _db.Rows.Where(r => r.ReportId == id)
                             .ToListAsync(cancellationToken);   // передаём дальше

    var report = new Report();
    foreach (var row in rows)
    {
        cancellationToken.ThrowIfCancellationRequested();       // проверка в цикле
        report.Add(Calculate(row));
    }

    await _storage.SaveAsync(report, cancellationToken);
    return report;
}
```

- Токен — последний параметр, по соглашению `cancellationToken`, в публичных API часто со значением по умолчанию.
- Проверять до начала дорогой работы и между шагами, но не перед каждым мелким действием.
- Не превращать отмену в `return null` или `false` — вызывающий должен отличать «отменили» от «нет данных».
- Если после отмены нужна очистка, делать её в `finally`, а не в `catch (OperationCanceledException)`.
- Некритичные к отмене завершающие шаги (запись аудита, откат транзакции) вызывать с `CancellationToken.None`, иначе они тоже отменятся.

**Правила для вызывающего:**

```csharp
using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
using var linked = CancellationTokenSource.CreateLinkedTokenSource(
    timeout.Token, HttpContext.RequestAborted);

try
{
    return Ok(await _service.BuildReportAsync(id, linked.Token));
}
catch (OperationCanceledException) when (timeout.IsCancellationRequested)
{
    return StatusCode(504);          // отличили таймаут от ухода клиента
}
```

- Ловить `OperationCanceledException`, а не `TaskCanceledException`: первый — базовый класс, второй бросают не все API.
- Фильтр `when (cts.IsCancellationRequested)` отличает «отменили мы» от чужой отмены или таймаута внутри (например, `HttpClient.Timeout`).
- Освобождать `CancellationTokenSource` через `using`.

**Что делать с API без токена.** Если внутри вызов, который токен не принимает, отменить его по-настоящему нельзя. Можно перестать **ждать**: `await task.WaitAsync(token)` (.NET 6+) вернёт управление при отмене, но сама операция продолжит работать в фоне, и её результат/исключение надо учитывать.

**Чего не делать:**

- `Thread.Abort` — не поддерживается в .NET Core+ и был опасен всегда.
- Игнорировать переданный токен — метод формально «поддерживает» отмену, но на деле нет.
- Логировать отмену запроса клиентом как ошибку уровня Error — это нормальная ситуация.

## Что делает `Task.WhenAll()`?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-delaet-task-whenall
tags: async
```

`Task.WhenAll` принимает набор задач и возвращает одну задачу, которая завершится, когда **завершатся все**. Для `Task<T>` результат — массив `T[]` в порядке переданных задач. Сам по себе `WhenAll` ничего не запускает: он лишь ожидает уже запущенные операции, позволяя им выполняться конкурентно.

```csharp
var userTask   = _users.GetAsync(id);
var ordersTask = _orders.GetByUserAsync(id);
var bonusTask  = _bonus.GetBalanceAsync(id);

await Task.WhenAll(userTask, ordersTask, bonusTask);   // ~max(время), а не сумма

var user   = userTask.Result;      // задачи уже завершены — блокировки нет
var orders = ordersTask.Result;    // (или await userTask — тоже мгновенно)
```

```csharp
int[] sizes = await Task.WhenAll(urls.Select(u => GetSizeAsync(u)));
```

**Последовательно vs конкурентно:**

```csharp
// Последовательно: 3 × 200 мс = 600 мс
var a = await GetAAsync();
var b = await GetBAsync();
var c = await GetCAsync();

// Конкурентно: ~200 мс
var ta = GetAAsync(); var tb = GetBAsync(); var tc = GetCAsync();
await Task.WhenAll(ta, tb, tc);
```

**Поведение в граничных случаях:**

- Пустой набор — возвращает уже завершённую задачу (для `Task<T>` — пустой массив).
- Если хотя бы одна задача упала, итоговая задача станет `Faulted`, но только **после завершения всех**. `await` бросит первое исключение, все остальные лежат в `whenAllTask.Exception.InnerExceptions`.
- Если ошибок нет, но есть отменённые — итоговая задача `Canceled`.
- `WhenAll` не отменяет оставшиеся задачи при ошибке одной — это надо делать самому через общий `CancellationToken`.

**Подводные камни:**

- `WhenAll` по ленивому `IEnumerable` материализует его и запускает все задачи сразу. 10 000 URL — 10 000 одновременных запросов; для ограничения конкурентности нужен `Parallel.ForEachAsync` или `SemaphoreSlim`.
- Не все операции можно делать параллельно: один `DbContext` не поддерживает конкурентные запросы — будет `InvalidOperationException`.
- Если нужно обрабатывать результаты по мере готовности, а не ждать всех, — `Task.WhenEach` (.NET 9) или цикл с `WhenAny`.

## Что делает `Task.WhenAny()`?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-delaet-task-whenany
tags: async
```

`Task.WhenAny` возвращает задачу, которая завершается, как только **завершилась любая** из переданных. Её результат — сама первая завершившаяся задача (`Task<Task>` или `Task<Task<T>>`), а не её значение. Остальные задачи продолжают выполняться — `WhenAny` их не отменяет.

```csharp
var primary = GetFromPrimaryAsync(key, cts.Token);
var replica = GetFromReplicaAsync(key, cts.Token);

Task<string> first = await Task.WhenAny(primary, replica);
cts.Cancel();                     // остановить проигравшего
string value = await first;       // достать результат или получить исключение
```

**Важная деталь: `WhenAny` никогда не падает.** Итоговая задача всегда завершается успешно, даже если первая задача упала или отменилась. Поэтому результат нужно **ещё раз `await`**, а не читать `.Status` и забывать про ошибку. `await first` мгновенно вернёт значение или бросит исключение.

**Типичные сценарии:**

- **Таймаут вручную** (до появления `WaitAsync`):

```csharp
var work = DoWorkAsync(ct);
if (await Task.WhenAny(work, Task.Delay(TimeSpan.FromSeconds(3), ct)) != work)
    throw new TimeoutException();
await work;
```

Сегодня проще `await work.WaitAsync(TimeSpan.FromSeconds(3))`. И в обоих случаях сама `work` не останавливается — её надо отменить токеном.

- **Hedged requests / гонка реплик** — берём самый быстрый ответ, остальные отменяем.
- **Ожидание работы или сигнала остановки** — `WhenAny(work, stopSignal.Task)`.
- **Обработка по мере завершения**:

```csharp
var pending = urls.Select(DownloadAsync).ToList();
while (pending.Count > 0)
{
    var done = await Task.WhenAny(pending);
    pending.Remove(done);
    Process(await done);
}
```

Такой цикл — O(n²): каждый `WhenAny` заново подписывается на все оставшиеся задачи. Для больших наборов в .NET 9+ есть `Task.WhenEach`, возвращающий `IAsyncEnumerable<Task<T>>` в порядке завершения: `await foreach (var t in Task.WhenEach(tasks))`.

**Подводные камни:**

- Проигравшие задачи продолжают работать и потреблять ресурсы; их исключения никто не наблюдает. Отменяйте их и при необходимости дожидайтесь.
- `Task.Delay` для таймаута без отмены оставляет висеть таймер до срабатывания — передавайте токен и отменяйте после успеха.
- Пустой набор задач — `ArgumentException`.

## Как обрабатываются исключения в async-методах?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-obrabatyvayutsya-isklyucheniya-v-async-metodah
tags: async
```

Исключение, выброшенное внутри `async Task`-метода, **не вылетает в момент вызова**: машина состояний ловит его и сохраняет в возвращаемой задаче, переводя её в `Faulted`. Наружу оно выходит при `await` — как исходное исключение с сохранённым стектрейсом, поэтому привычный `try/catch` вокруг `await` работает так же, как в синхронном коде.

```csharp
async Task<int> ParseAsync(string s)
{
    await Task.Yield();
    return int.Parse(s);               // FormatException
}

Task<int> t = ParseAsync("abc");       // исключения ещё нет, t.Status == Faulted чуть позже
try
{
    await t;
}
catch (FormatException ex)             // ловится исходный тип
{
    Log(ex);
}
```

**Даже до первого `await`.** В `async`-методе исключение из синхронной части (например, проверка аргументов) тоже попадёт в задачу, а не бросится при вызове. Если нужна немедленная ошибка валидации, делают не-`async` обёртку с проверками, которая вызывает приватный `async` метод.

**Способы получить исключение:**

| Способ | Что бросается |
| --- | --- |
| `await task` | первое исключение из задачи, исходного типа |
| `task.Wait()` / `task.Result` | `AggregateException` со всеми исключениями внутри |
| `task.GetAwaiter().GetResult()` | исходное исключение, без обёртки |
| `task.Exception` | `AggregateException` (или `null`), без выброса |

**Отмена — отдельное состояние.** `OperationCanceledException` переводит задачу в `Canceled`, а не `Faulted`; `await` бросит `OperationCanceledException`/`TaskCanceledException`. Ловить её обычно надо отдельно от ошибок.

**`async void` — исключение из правил.** Задачи нет, исключение пробрасывается в `SynchronizationContext` или пул потоков и обычно роняет процесс. Там `try/catch` должен быть внутри метода.

**Незамеченные исключения.** Если задачу никто не ожидал, исключение «не наблюдено». С .NET 4.5 процесс из-за этого не падает; при финализации задачи срабатывает `TaskScheduler.UnobservedTaskException`, где можно залогировать. Это последний рубеж, а не механизм обработки.

**Как сохраняется стектрейс.** При `await` рантайм использует `ExceptionDispatchInfo.Capture(ex).Throw()`, так что стек включает исходное место выброса плюс отметку о перебросе. Если нужно перебросить исключение, пойманное в другом месте, делайте так же, а не `throw ex;`.

**Типичные ошибки:**

- `catch` вокруг вызова без `await` — не поймает ничего.
- `catch (AggregateException)` вокруг `await` — не сработает, придёт исходный тип.
- Потеря исключений всех, кроме первого, при `await Task.WhenAll(...)` — остальные доступны через задачу.
- `try/catch` вокруг `return SomeAsync();` в не-`async` методе не поймает асинхронную ошибку — нужен `return await`.

## Что произойдёт, если одна из задач в `Task.WhenAll()` завершится с exception?

```yaml
category: async
level: middle
difficulty: 4
slug: async-chto-proizoidet-esli-odna-iz-zadach-v-task-whenall-zavershitsya-s-exce
tags: async
```

Задача, возвращённая `Task.WhenAll`, станет `Faulted`, но **не сразу**, а только когда завершатся все остальные задачи. Остальные продолжают работать и не отменяются. `await` на результате бросит **только первое** исключение, а полный набор ошибок лежит в `AggregateException` самой задачи `WhenAll`.

```csharp
var t1 = Task.Run(async () => { await Task.Delay(100); throw new InvalidOperationException("A"); });
var t2 = Task.Run(async () => { await Task.Delay(300); throw new ArgumentException("B"); });
var t3 = Task.Run(async () => { await Task.Delay(500); return 42; });

var all = Task.WhenAll(t1, t2, t3);
try
{
    await all;                      // вернёт управление через ~500 мс, не через 100
}
catch (Exception ex)
{
    Console.WriteLine(ex.Message);  // "A" — только первое
    foreach (var inner in all.Exception!.InnerExceptions)
        Console.WriteLine(inner.Message);   // "A", "B"
}
Console.WriteLine(t3.Result);       // 42 — успешные результаты доступны через свои задачи
```

**Разберём детали:**

- **Какое исключение «первое».** `await` бросает `InnerExceptions[0]`. В современном .NET исключения накапливаются по мере завершения задач, поэтому на практике это ошибка той задачи, что упала раньше (проверено на .NET 10), а не первой по списку аргументов. Документированным контрактом порядок не является — не стройте на нём логику.
- **Результаты успешных задач не теряются**, но `await Task.WhenAll<T>(...)` массив не вернёт — берите их из самих задач (`t3.Result`, они уже завершены).
- **Отмена.** Если какая-то задача отменена, а упавших нет, итог — `Canceled` и `await` бросит `TaskCanceledException`. Если есть и упавшие, и отменённые — `Faulted`, с исключениями упавших.
- **Незамеченные исключения** не возникнут: `WhenAll` наблюдает все вложенные ошибки.

**Как получить все ошибки при `await`:**

```csharp
var all = Task.WhenAll(tasks);
try
{
    await all;
}
catch
{
    if (all.Exception is { } agg)
        throw agg.Flatten();        // или логировать каждое InnerException
    throw;                          // отмена
}
```

С .NET 8 можно дождаться без выброса и разобрать итог вручную: `await all.ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);`, затем анализировать `all.Status` и каждую задачу. Опция работает только для необобщённого `Task`: для `Task<T[]>` будет `ArgumentOutOfRangeException` (анализатор CA2261 предупредит), поэтому обобщённую задачу сначала приводят к `Task`.

**Как не ждать остальных после первой ошибки (fail fast).** `WhenAll` этого не умеет. Варианты:

- общий `CancellationTokenSource`; в каждой задаче `try/catch` → `cts.Cancel()`, остальные задачи наблюдают токен и завершаются;
- `Parallel.ForEachAsync` — при исключении в одном теле он перестаёт запускать новые итерации и отменяет токен, переданный в тело;
- цикл по `WhenAny`/`Task.WhenEach` с немедленной реакцией на первую `Faulted` задачу.

**Что спрашивают дальше:** почему `.Wait()` бросает `AggregateException`, а `await` — нет; что будет, если одна задача зависнет навсегда (`WhenAll` не завершится — нужен таймаут).

## Как сделать timeout для async-операции?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-sdelat-timeout-dlya-async-operacii
tags: async, resilience
```

Основной способ — `CancellationTokenSource` с таймаутом, токен которого передаётся в операцию: по истечении времени операция **действительно прерывается**. Если операция токен не принимает, можно лишь перестать её ждать через `task.WaitAsync(timeout)`, но сама она продолжит работать.

**1. Таймаут через отмену (предпочтительно):**

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
try
{
    var result = await _client.GetReportAsync(id, cts.Token);
}
catch (OperationCanceledException) when (cts.IsCancellationRequested)
{
    throw new TimeoutException("Отчёт не получен за 5 секунд");
}
```

Если у метода уже есть внешний токен (запрос, остановка сервиса), таймаут комбинируют:

```csharp
using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
cts.CancelAfter(TimeSpan.FromSeconds(5));
await DoAsync(cts.Token);
```

**2. `WaitAsync` — перестать ждать (.NET 6+):**

```csharp
try
{
    var data = await legacy.LoadAsync().WaitAsync(TimeSpan.FromSeconds(5));
}
catch (TimeoutException)
{
    // LoadAsync всё ещё выполняется в фоне!
}
```

Есть перегрузки с `CancellationToken` и с `TimeSpan` + токен. Бросает `TimeoutException`, а не `OperationCanceledException`.

**3. `Task.WhenAny` + `Task.Delay`** — исторический вариант до .NET 6. Та же семантика «не ждать», больше кода, и таймер надо отменять после успеха.

**Сравнение:**

| Способ | Операция прерывается | Исключение |
| --- | --- | --- |
| токен из CTS с `CancelAfter` | да, если поддерживает токен | `OperationCanceledException` |
| `WaitAsync(timeout)` | нет, только ожидание | `TimeoutException` |
| `WhenAny` + `Delay` | нет | своё |

**Встроенные таймауты, о которых стоит знать:**

- `HttpClient.Timeout` — по умолчанию **100 секунд** на весь запрос; при срабатывании бросается `TaskCanceledException` (с .NET 5 — с `TimeoutException` во `InnerException`, что позволяет отличить от отмены).
- EF Core / ADO.NET: `CommandTimeout` (по умолчанию 30 секунд в SqlClient).
- Для HTTP в продакшене — политики устойчивости: `Microsoft.Extensions.Http.Resilience` (на базе Polly v8) с timeout на попытку и общим timeout, плюс retry и circuit breaker.

**Подводные камни:**

- Не создавать `CancellationTokenSource` с таймером и забывать `Dispose` — таймер живёт до срабатывания.
- Отличать «наш таймаут» от отмены внешним токеном: фильтр `when (cts.IsCancellationRequested && !cancellationToken.IsCancellationRequested)`.
- Таймаут с ретраями: общий бюджет времени должен быть больше, чем таймаут одной попытки, иначе ретраи бесполезны.
- После `WaitAsync`-таймаута фоновая операция может завершиться ошибкой, которую никто не увидит, — и продолжать держать ресурсы.

## Как ограничить количество одновременно выполняющихся async-задач?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-ogranichit-kolichestvo-odnovremenno-vypolnyayuschihsya-async-zadac
tags: async
```

Самые распространённые способы — `Parallel.ForEachAsync` с `MaxDegreeOfParallelism` (.NET 6+) и `SemaphoreSlim` с асинхронным `WaitAsync`. Для сложных конвейеров — `Channel<T>` с фиксированным числом потребителей. Цель одна: не запускать тысячи операций разом и не перегрузить пул соединений, внешний API или себя.

**1. `Parallel.ForEachAsync` — самый простой вариант для коллекции:**

```csharp
var options = new ParallelOptions
{
    MaxDegreeOfParallelism = 8,
    CancellationToken = ct
};

await Parallel.ForEachAsync(urls, options, async (url, token) =>
{
    var html = await http.GetStringAsync(url, token);
    await SaveAsync(url, html, token);
});
```

Не больше 8 тел одновременно; при исключении новые итерации не запускаются, а токен в теле отменяется. Минус — нет сбора результатов, их кладут в `ConcurrentBag`/`ConcurrentDictionary`.

**2. `SemaphoreSlim` — гибкий «турникет»:**

```csharp
var gate = new SemaphoreSlim(8);

var tasks = urls.Select(async url =>
{
    await gate.WaitAsync(ct);
    try
    {
        return await http.GetStringAsync(url, ct);
    }
    finally
    {
        gate.Release();          // обязательно в finally
    }
});

string[] pages = await Task.WhenAll(tasks);
```

Результаты собираются в порядке исходной коллекции. Такой же семафор можно держать в singleton-сервисе, чтобы ограничить обращения к внешнему API из всего приложения. Нюанс: все задачи создаются сразу и ждут на семафоре, для миллиона элементов это миллион объектов в памяти.

**3. `Channel<T>` + N потребителей — для потоков данных и фоновой обработки:**

```csharp
var channel = Channel.CreateBounded<Job>(capacity: 100);   // backpressure для писателя

var workers = Enumerable.Range(0, 4).Select(_ => Task.Run(async () =>
{
    await foreach (var job in channel.Reader.ReadAllAsync(ct))
        await HandleAsync(job, ct);
})).ToArray();
```

**Сравнение:**

| Способ | Когда брать |
| --- | --- |
| `Parallel.ForEachAsync` | обработать известную коллекцию, результат не нужен или собирается сбоку |
| `SemaphoreSlim` | нужны результаты, ограничение на уровне сервиса, нестандартный поток управления |
| `Channel<T>` | продюсер–консьюмер, поток задач неизвестной длины, backpressure |
| `System.Threading.RateLimiting` | ограничение не одновременности, а частоты (N запросов в секунду) |

**Чего не делать:**

- `Parallel.ForEach` с `async`-лямбдой — лямбда станет `async void`, ограничение не работает, исключения роняют процесс.
- `Task.WhenAll` по всей коллекции без ограничения — сотни одновременных запросов в БД быстро исчерпают пул соединений.
- Разбивать на пачки по N и ждать каждую через `WhenAll` — работает, но пачка ждёт самую медленную задачу, конвейер простаивает.
- `lock` вместо семафора — внутри `lock` нельзя `await`.

## Что такое async streaming?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-takoe-async-streaming
tags: async
```

Async streaming (асинхронные потоки, C# 8) — возможность возвращать последовательность элементов, **каждый из которых получается асинхронно**, и обрабатывать их по мере поступления. В .NET это `IAsyncEnumerable<T>`, генерируемый методом с `async` + `yield return`, и потребляемый через `await foreach`.

```csharp
async IAsyncEnumerable<Order> ReadOrdersAsync(
    [EnumeratorCancellation] CancellationToken ct = default)
{
    int page = 0;
    while (true)
    {
        var batch = await _api.GetOrdersAsync(page++, ct);   // асинхронная подгрузка
        if (batch.Count == 0) yield break;
        foreach (var order in batch)
            yield return order;                              // отдаём по одному
    }
}

await foreach (var order in ReadOrdersAsync(ct))
    await ProcessAsync(order);
```

**Какую проблему решает.** Раньше было два плохих варианта:

| Вариант | Проблема |
| --- | --- |
| `Task<List<T>>` | ждём **все** данные, держим их в памяти целиком, первый элемент — только в конце |
| `IEnumerable<T>` с синхронной подгрузкой | блокирует поток на каждом IO |
| `IAsyncEnumerable<T>` | элементы приходят по мере готовности, поток не блокируется, память — на один элемент/страницу |

**Где встречается на практике:**

- **EF Core**: `query.AsAsyncEnumerable()` — строки читаются из `DbDataReader` потоково, без материализации всего результата.
- **ASP.NET Core**: action, возвращающий `IAsyncEnumerable<T>`, сериализуется `System.Text.Json` в JSON-массив по мере поступления элементов.
- **gRPC** server/client streaming, **SignalR** streaming — стримы сообщений как `IAsyncEnumerable<T>`.
- **`Channel<T>`**: `reader.ReadAllAsync()` — потребление очереди.
- **LLM/SSE-клиенты** — токены ответа приходят потоком.
- Постраничные API, чтение больших файлов построчно, события из брокера сообщений.

**Pull-модель.** Потребитель сам запрашивает следующий элемент (`MoveNextAsync`), и генератор не бежит вперёд, пока его не попросят — встроенный backpressure. Это отличие от `IObservable<T>` (Rx), где источник сам «толкает» события.

**Операторы.** LINQ для асинхронных последовательностей долго жил в пакете `System.Linq.Async` (из проекта Reactive Extensions); в .NET 10 появилась встроенная реализация `System.Linq.AsyncEnumerable`, так что `Where`, `Select`, `ToListAsync` доступны из коробки.

**Подводные камни:** отмена требует `[EnumeratorCancellation]`, перечисление ленивое (ничего не выполняется до `await foreach`), повторный `await foreach` запускает генератор заново — например, повторяет запросы к API.

## Как работает `IAsyncEnumerable<T>`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-rabotaet-iasyncenumerable-t
tags: async
```

`IAsyncEnumerable<T>` — асинхронный аналог `IEnumerable<T>`. Он выдаёт `IAsyncEnumerator<T>`, у которого переход к следующему элементу асинхронный: `ValueTask<bool> MoveNextAsync()`, а освобождение — `ValueTask DisposeAsync()`. Метод с `async` и `yield return` компилятор превращает в класс, который одновременно является и машиной состояний, и итератором.

```csharp
public interface IAsyncEnumerable<out T>
{
    IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default);
}

public interface IAsyncEnumerator<out T> : IAsyncDisposable
{
    T Current { get; }
    ValueTask<bool> MoveNextAsync();
}
```

**Как выполняется генератор:**

```csharp
async IAsyncEnumerable<int> CountAsync([EnumeratorCancellation] CancellationToken ct = default)
{
    try
    {
        for (int i = 0; i < 3; i++)
        {
            await Task.Delay(100, ct);   // асинхронное ожидание
            yield return i;              // пауза: отдаём элемент потребителю
        }
    }
    finally
    {
        Console.WriteLine("cleanup");   // выполнится в DisposeAsync
    }
}
```

1. Вызов `CountAsync()` ничего не выполняет — возвращает объект-генератор (ленивость).
2. `MoveNextAsync()` запускает код до ближайшего `yield return` (или конца). Если по дороге есть незавершённый `await`, возвращается незавершённый `ValueTask<bool>`.
3. На `yield return` значение кладётся в `Current`, `MoveNextAsync` завершается с `true`, генератор замирает.
4. Следующий `MoveNextAsync` продолжает с места остановки.
5. `yield break` или конец метода — `false`. `DisposeAsync` выполняет `finally`-блоки, даже если потребитель вышел из цикла раньше (`break`, исключение).

**Почему `ValueTask`.** Между элементами часто нет реального ожидания (элементы из уже загруженной страницы), и `MoveNextAsync` завершается синхронно. Сгенерированный итератор реализует `IValueTaskSource<bool>` сам, так что переиспользует один объект и почти не аллоцирует на элемент.

**Отмена.** Токен можно передать двумя путями: аргументом метода или через `source.WithCancellation(ct)`, который прокидывает его в `GetAsyncEnumerator`. Атрибут `[EnumeratorCancellation]` на параметре говорит компилятору объединить оба токена — без него токен из `WithCancellation` в генератор не попадёт (компилятор выдаст предупреждение CS8425).

**Контракт использования:**

- Не вызывать `MoveNextAsync` конкурентно — следующий вызов только после завершения предыдущего.
- Каждый `GetAsyncEnumerator` — новый проход, генератор запускается заново.
- Обязательно `DisposeAsync` — `await foreach` делает это сам.

**Реализация вручную** нужна редко: обычно хватает `async yield`, `Channel<T>.Reader.ReadAllAsync()` или обёрток библиотек. Вручную пишут, когда нужен особый контроль над буферизацией или пулингом.

## Чем `await foreach` отличается от обычного `foreach`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-chem-await-foreach-otlichaetsya-ot-obychnogo-foreach
tags: async
```

Обычный `foreach` перебирает `IEnumerable<T>` и на каждом шаге **синхронно** вызывает `MoveNext()`. `await foreach` перебирает `IAsyncEnumerable<T>` и на каждом шаге **ожидает** `MoveNextAsync()`, освобождая поток, пока следующий элемент не готов; в конце — `await DisposeAsync()`. Поэтому `await foreach` можно использовать только в `async`-методе.

**Во что раскрывается `await foreach`:**

```csharp
await foreach (var item in source)
    Handle(item);

// примерно эквивалентно
var e = source.GetAsyncEnumerator();
try
{
    while (await e.MoveNextAsync())
    {
        var item = e.Current;
        Handle(item);
    }
}
finally
{
    await e.DisposeAsync();
}
```

**Сравнение:**

| | `foreach` | `await foreach` |
| --- | --- | --- |
| Источник | `IEnumerable<T>` или тип с `GetEnumerator()` | `IAsyncEnumerable<T>` или тип с `GetAsyncEnumerator()` |
| Шаг | `bool MoveNext()` | `ValueTask<bool> MoveNextAsync()` |
| Освобождение | `Dispose()` | `await DisposeAsync()` |
| Где можно | где угодно | только в `async`-методе |
| Отмена | нет | `.WithCancellation(ct)` |
| Контекст | — | `.ConfigureAwait(false)` |

Оба работают по **паттерну** (duck typing): интерфейс не обязателен, достаточно методов с нужными сигнатурами, в том числе методов-расширений `GetAsyncEnumerator` (C# 9+).

**Важно: `await foreach` не распараллеливает.** Элементы обрабатываются строго по одному, следующий запрашивается только после завершения тела цикла. Если в теле долгий `await`, источник ждёт. Для параллельной обработки — `Parallel.ForEachAsync`, который принимает и `IAsyncEnumerable<T>`.

**Частые ошибки:**

- `foreach (var t in tasks) await t;` путают с `await foreach` — это обычный цикл по коллекции задач, всё корректно, но это другая конструкция.
- `await foreach` по `IEnumerable<Task<T>>` не скомпилируется — это не асинхронная последовательность.
- Материализация `await source.ToListAsync()` там, где можно обрабатывать потоково, — теряется весь смысл стриминга.
- Забытая отмена: `await foreach (var x in GetItems().WithCancellation(ct))` — без `[EnumeratorCancellation]` в генераторе токен не дойдёт.
- В EF Core держать `await foreach` по запросу открытым и параллельно делать другие запросы через тот же `DbContext` — нельзя, соединение занято чтением.

## Какие ошибки чаще всего допускают при использовании async/await?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kakie-oshibki-chasche-vsego-dopuskayut-pri-ispolzovanii-async-await
tags: async
```

Большинство ошибок сводятся к трём корням: **смешивание синхронного и асинхронного кода** (блокировки на задачах), **потеря задач** (нет `await`, `async void`, fire-and-forget) и **непонимание, что `async` не значит «в другом потоке»**. Ниже — список, который обычно ожидают услышать на собеседовании.

**1. Sync-over-async: `.Result`, `.Wait()`, `GetAwaiter().GetResult()`.** В UI и классическом ASP.NET — deadlock, в ASP.NET Core — блокировка потоков пула и thread pool starvation под нагрузкой. Решение — async all the way.

**2. `async void`.** Исключения не ловятся и роняют процесс, завершения не дождаться. Особенно коварно в лямбдах: `list.ForEach(async x => ...)`, `Parallel.ForEach(items, async x => ...)`.

**3. Забытый `await`.** Операция выполняется «в фоне», порядок нарушен, исключение теряется. Помогают предупреждение CS4014 и анализаторы.

**4. Последовательные `await` там, где можно конкурентно:**

```csharp
// 3 независимых запроса по 200 мс — 600 мс
var a = await GetAAsync();
var b = await GetBAsync();

// ~200 мс
var ta = GetAAsync(); var tb = GetBAsync();
await Task.WhenAll(ta, tb);
```

**5. Обратная ошибка — неограниченная конкурентность.** `Task.WhenAll(items.Select(ProcessAsync))` на 10 000 элементов — перегруженная БД и исчерпанный пул соединений. Нужны `Parallel.ForEachAsync` или `SemaphoreSlim`.

**6. `Task.Run` не по назначению.** Обёртка над IO (`Task.Run(() => File.ReadAllText(...))`), «асинхронный» фасад над синхронным кодом в библиотеке, `Task.Run` в каждом action ASP.NET Core.

**7. Игнорирование `CancellationToken`.** Метод принимает токен, но не передаёт его во вложенные вызовы; запросы продолжают работать после ухода клиента.

**8. Общий неконкурентный ресурс.** Параллельные `await` на одном `DbContext`, `lock` вокруг `await` (не компилируется) — нужен `SemaphoreSlim`. Также `SemaphoreSlim(1)` не реентерабелен: повторный захват из той же цепочки — deadlock.

**9. Неверная работа с исключениями.** `catch (AggregateException)` вокруг `await`; `try/catch` вокруг вызова без `await`; `return SomeAsync()` внутри `try` или `using` в не-`async` методе — ресурс освободится раньше, исключение не поймается:

```csharp
Task<string> ReadAsync()
{
    using var reader = new StreamReader(path);
    return reader.ReadToEndAsync();     // reader освобождён до завершения чтения
}
```

**10. Неправильный `ValueTask`.** Двойной `await`, хранение в поле, `.Result` до завершения.

**11. Fire-and-forget в веб-приложении.** `_ = SendEmailAsync()` в контроллере: scoped-сервисы освобождаются после ответа, исключения теряются, при остановке хоста работа обрывается. Нужна очередь + `BackgroundService`.

**12. `ConfigureAwait` не к месту.** `ConfigureAwait(false)` в UI-коде, который затем трогает контролы (исключение о доступе из чужого потока), или вера, что один `ConfigureAwait(false)` в начале метода спасает от deadlock.

**13. Мелочи, которые выдают опыт:**

- `async` метод без `await` (CS1998) — выполняется полностью синхронно, но платит за машину состояний.
- Суффикс `Async` у метода, который возвращает не `Task`/`ValueTask`, или отсутствие суффикса у асинхронного.
- `Thread.Sleep` в асинхронном коде вместо `await Task.Delay`.
- `[ThreadStatic]`/`ThreadLocal` для данных, которые должны пережить `await`, — нужен `AsyncLocal<T>`.
- `TaskCompletionSource` без `RunContinuationsAsynchronously` — продолжения ожидающих выполнятся внутри `SetResult` вызывающего.

**Что спрашивают дальше:** как диагностировать thread pool starvation (`dotnet-counters`: длина очереди пула и число потоков, `dotnet-dump` со стеками, заблокированными на `.Result`), и как постепенно переводить синхронную кодовую базу на async без sync-over-async в середине цепочки.
