# Задачи: async/await

## Синхронная часть async-метода

```yaml
slug: async-sinhronnaya-chast-metoda
category: async
level: junior
kind: output
difficulty: 2
```

Что выведет программа?

```csharp
Console.Write("A ");
var t = WorkAsync();
Console.Write("C ");
await t;
Console.Write("E");

static async Task WorkAsync()
{
    Console.Write("B ");
    await Task.Delay(100);
    Console.Write("D ");
}
```

### Варианты

- [ ] `A C B D E`
- [x] `A B C D E`
- [ ] `A C E B D`
- [ ] `A B D C E`

### Разбор

Вызов async-метода не уходит в другой поток и не откладывается: метод выполняется **синхронно в вызывающем потоке** до первого `await` на незавершённой задаче. Поэтому `B` печатается сразу при вызове `WorkAsync()`, ещё до `C`.

На `await Task.Delay(100)` задержка ещё не истекла, метод сохраняет своё состояние (машина состояний, сгенерированная компилятором), регистрирует продолжение и возвращает вызывающему незавершённый `Task`. Управление возвращается в `Main`, печатается `C`. Затем `await t` ждёт завершения: через 100 мс продолжение печатает `D`, задача завершается, и только после этого выполняется `E`.

Практический вывод: тяжёлая синхронная работа до первого `await` (парсинг, хеширование, синхронный I/O) выполняется в потоке вызывающего кода и блокирует его. Если её нужно увести с текущего потока, это делают явно (`Task.Run` для CPU-bound работы), а не надеются, что «async сам всё распараллелит».

## Исключение в async void

```yaml
slug: async-void-isklyuchenie
category: async
level: middle
kind: output
difficulty: 3
```

Что произойдёт при запуске консольного приложения?

```csharp
try
{
    Fire();
}
catch (Exception)
{
    Console.WriteLine("caught");
}
await Task.Delay(500);
Console.WriteLine("end");

static async void Fire()
{
    await Task.Yield();
    throw new InvalidOperationException("boom");
}
```

### Варианты

- [ ] Выведет `caught`, затем `end`
- [ ] Выведет только `end`: исключение потеряется
- [x] Процесс упадёт с необработанным `InvalidOperationException`, ни `caught`, ни `end` не будет
- [ ] Выведет `end`, а исключение попадёт в `TaskScheduler.UnobservedTaskException`

### Разбор

У `async void` нет `Task`, в который можно положить исключение, поэтому `try/catch` вокруг вызова его не увидит: к моменту исключения `Fire()` уже вернул управление (после `await Task.Yield()`). Исключение из `async void` пробрасывается в `SynchronizationContext`, который был активен при старте метода, а если контекста нет (консоль, ASP.NET Core) — выбрасывается в пуле потоков. Необработанное исключение в потоке пула завершает процесс, поэтому `end` напечатан не будет.

`TaskScheduler.UnobservedTaskException` здесь ни при чём: это событие для исключений в `Task`, результат которых никто не наблюдал, и оно процесс не роняет. Как раз поэтому `async Task` безопаснее: ошибка сохраняется в задаче и выбрасывается на `await`.

Правило: `async void` допустим только для обработчиков событий (WinForms/WPF), где сигнатура навязана делегатом, и внутри такого обработчика всё тело стоит обернуть в `try/catch`. Во всех остальных местах — `async Task`. Особенно коварны `async`-лямбды, переданные туда, где ожидается `Action` (например, `list.ForEach(async x => …)`): они тоже становятся `async void`.

## Исключения из Task.WhenAll

```yaml
slug: async-isklyucheniya-task-whenall
category: async
level: middle
kind: output
difficulty: 3
```

Что выведет программа?

```csharp
var all = Task.WhenAll(Fail("first", 100), Fail("second", 10));
try
{
    await all;
}
catch (Exception ex)
{
    Console.WriteLine($"{ex.GetType().Name} {all.Exception!.InnerExceptions.Count}");
}

static async Task Fail(string message, int delayMs)
{
    await Task.Delay(delayMs);
    throw new InvalidOperationException(message);
}
```

### Варианты

- [ ] `AggregateException 2`
- [x] `InvalidOperationException 2`
- [ ] `InvalidOperationException 1`
- [ ] `AggregateException 1`

### Разбор

`Task.WhenAll` дожидается **всех** задач, даже если одна уже упала, и сохраняет в своём `Task.Exception` (это `AggregateException`) все ошибки — здесь их две. Но `await` при пробросе разворачивает `AggregateException` и выбрасывает только **одно** — первое исключение из `InnerExceptions`. Поэтому в `catch` прилетает `InvalidOperationException`, а не `AggregateException`.

Какое именно из нескольких исключений окажется первым — деталь реализации (в современном .NET это порядок, в котором задачи завершились, а не порядок аргументов), на неё не стоит полагаться. Если нужны все ошибки, сохраните задачу `WhenAll` в переменную и в `catch` прочитайте `all.Exception.InnerExceptions` — как в коде выше. `.Wait()` и `.Result`, в отличие от `await`, выбрасывают сам `AggregateException`.

На практике это важно при параллельных вызовах внешних сервисов: логируя только `ex` из `catch`, вы теряете остальные сбои и видите в логах лишь часть картины.

## Когда вылетает исключение

```yaml
slug: async-kogda-vyletaet-isklyuchenie
category: async
level: middle
kind: output
difficulty: 4
```

Что выведет программа?

```csharp
try
{
    var t1 = FailAsync("1");
    Console.Write("A ");
    var t2 = Fail("2");
    Console.Write("B ");
    await Task.WhenAll(t1, t2);
}
catch (InvalidOperationException ex)
{
    Console.Write(ex.Message);
}

static async Task FailAsync(string m) => throw new InvalidOperationException(m);
static Task Fail(string m) => throw new InvalidOperationException(m);
```

### Варианты

- [ ] `1`
- [ ] `A B 1`
- [x] `A 2`
- [ ] `A B 2`

### Разбор

Методы выглядят одинаково, но ведут себя по-разному. `FailAsync` помечен `async`: компилятор превращает его в машину состояний, и любое исключение внутри, даже выброшенное до первого `await`, **кладётся в возвращаемый `Task`**. Вызов `FailAsync("1")` не бросает ничего — он возвращает упавшую задачу, поэтому печатается `A`.

`Fail` — обычный метод, который просто возвращает `Task`. Исключение из него вылетает **сразу при вызове**, как из любого синхронного метода. До `B` и до `await Task.WhenAll` дело не доходит, в `catch` попадает исключение с сообщением `2`, а упавшая задача `t1` так и остаётся неожиданной.

Отсюда известная рекомендация для валидации аргументов: если метод не `async` и возвращает `Task`, `ArgumentNullException` прилетит в момент вызова; если `async` — только на `await`. Обе модели допустимы, но их нельзя путать, иначе `try/catch` оказывается не вокруг того кода.

## Блокирующий вызов async-метода

```yaml
slug: async-dedlok-result
category: async
level: middle
kind: bug
difficulty: 3
```

В чём проблема этого кода? Приложение — WinForms.

```csharp
public partial class MainForm : Form
{
    private readonly HttpClient _http = new();

    private void LoadButton_Click(object sender, EventArgs e)
    {
        var text = LoadAsync().Result;
        resultLabel.Text = text;
    }

    private async Task<string> LoadAsync()
    {
        var body = await _http.GetStringAsync("https://example.com/status");
        return body.Trim();
    }
}
```

### Варианты

- [ ] `.Result` вернёт `null`, потому что задача ещё не завершилась
- [ ] После `await` код продолжится в потоке пула, и `resultLabel.Text` бросит исключение доступа из чужого потока
- [x] Взаимоблокировка: UI-поток заблокирован на `.Result`, а продолжение после `await` ждёт освобождения этого же потока
- [ ] Проблемы нет: `.Result` просто заморозит окно на время запроса

### Разбор

В WinForms (как и в WPF и в классическом ASP.NET) есть `SynchronizationContext`, и `await` по умолчанию захватывает его: продолжение после `await` (здесь — `return body.Trim()`) будет поставлено в очередь UI-потока. Но UI-поток в это время стоит на `.Result` и ждёт завершения задачи. Задача не может завершиться, пока не выполнится продолжение, а продолжение не может выполниться, пока поток не освободится, — классический дедлок, окно зависает навсегда.

Правильное исправление — асинхронность «до самого верха»: `private async void LoadButton_Click(...)` (обработчик события — единственное законное место для `async void`) и `var text = await LoadAsync();`. В библиотечном коде, которому не нужен контекст, дополнительно пишут `await ... .ConfigureAwait(false)`, чтобы продолжение не возвращалось в UI-поток, — это убирает дедлок и у тех, кто всё-таки блокируется, но лечит симптом, а не причину.

В ASP.NET Core `SynchronizationContext` нет, поэтому такого дедлока там не будет. Но `.Result`/`.Wait()` всё равно вредны: они занимают поток пула на всё время ожидания, и под нагрузкой это приводит к thread pool starvation.

## Повторный await ValueTask

```yaml
slug: async-povtornyj-await-valuetask
category: async
level: senior
kind: bug
difficulty: 4
```

В чём проблема этого кода?

```csharp
public async Task<int> ReceiveAsync(Socket socket, Memory<byte> buffer, CancellationToken ct)
{
    ValueTask<int> pending = socket.ReceiveAsync(buffer, SocketFlags.None, ct);

    var received = await pending;
    if (received == 0)
        return 0;

    _logger.LogDebug("Received {Bytes} bytes", await pending);
    return received;
}
```

### Варианты

- [ ] Второй `await` заново выполнит приём и прочитает следующую порцию данных из сокета
- [x] `ValueTask` можно ожидать только один раз: после первого `await` его источник может быть переиспользован, и повторный `await` даёт неопределённое поведение
- [ ] Ошибка компиляции: `ValueTask<int>` нельзя сохранять в локальную переменную
- [ ] Проблемы нет: повторный `await` уже завершённой задачи мгновенно вернёт тот же результат

### Разбор

`ValueTask<T>` — это не «лёгкий `Task`». Он может быть обёрткой над готовым значением, над `Task<T>` или над `IValueTaskSource<T>` — переиспользуемым объектом из пула. `Socket.ReceiveAsync(Memory<byte>, ...)` как раз использует пулируемый источник: после того как результат забрали первым `await`, объект возвращается в пул и может обслуживать следующую операцию на этом сокете. Повторный `await` того же `ValueTask` может бросить `InvalidOperationException`, зависнуть или вернуть результат чужой операции.

Правила для `ValueTask` из документации: ожидать ровно один раз, не ожидать конкурентно, не читать `.Result` до завершения. Здесь достаточно использовать уже полученное значение: `_logger.LogDebug("Received {Bytes} bytes", received);`. Если результат действительно нужен в нескольких местах или для `Task.WhenAll`, вызовите `.AsTask()` один раз и дальше работайте с обычным `Task`.

С `Task` повторный `await` безопасен, поэтому ошибка легко проходит тесты: пока операция завершается синхронно или источник не переиспользован, всё работает, а падает только под нагрузкой.

## Отправка письма после ответа

```yaml
slug: async-fire-and-forget-v-kontrollere
category: async
level: middle
kind: bug
difficulty: 3
```

В чём проблема этого кода? `AppDbContext` зарегистрирован через `AddDbContext`.

```csharp
[HttpPost("register")]
public async Task<IActionResult> Register(RegisterRequest request)
{
    var user = new User(request.Email);
    _db.Users.Add(user);
    await _db.SaveChangesAsync();

    _ = SendWelcomeAsync(user.Id);
    return Ok();
}

private async Task SendWelcomeAsync(int userId)
{
    var user = await _db.Users.SingleAsync(u => u.Id == userId);
    await _mailer.SendAsync(user.Email, "Добро пожаловать!");
}
```

### Варианты

- [ ] Ответ клиенту не уйдёт, пока письмо не отправится: `_ =` не отменяет ожидание
- [x] Задача не ожидается: после ответа scope запроса и `_db` освобождаются, `SendWelcomeAsync` может упасть с `ObjectDisposedException`, и ошибку никто не увидит
- [ ] Ошибка компиляции: результат `Task` нельзя присвоить discard-переменной `_`
- [ ] `SingleAsync` не найдёт пользователя, потому что `SaveChangesAsync` ещё не закоммитил транзакцию

### Разбор

`SendWelcomeAsync` синхронно начинает запрос к базе, на первом `await` возвращает незавершённую задачу, и обработчик сразу отдаёт `Ok()`. После отправки ответа ASP.NET Core освобождает scope запроса, а вместе с ним `DbContext` и остальные scoped-зависимости (возможно, и `_mailer`). Всё, что `SendWelcomeAsync` делает дальше, идёт уже на освобождённых объектах и может упасть с `ObjectDisposedException`. Поскольку задачу никто не ожидает, исключение остаётся в ней и тихо теряется: письмо не ушло, в логах пусто.

Тот же приём опасен и в другую сторону: если бы обработчик после запуска фоновой задачи продолжал работать с `_db`, получилось бы конкурентное использование одного `DbContext`, которое EF Core запрещает. Плюс при остановке приложения такие «висящие» задачи просто обрываются.

Как правильно: если письмо обязано уйти до ответа — `await`. Если его нужно отправить в фоне — положить задание в очередь (`Channel<T>` + `BackgroundService`, Hangfire, брокер сообщений, outbox), а в фоновом обработчике создавать собственный scope через `IServiceScopeFactory` и логировать ошибки.
