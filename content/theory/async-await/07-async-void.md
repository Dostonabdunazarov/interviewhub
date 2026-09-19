---
title: async void
slug: async-void
track: dotnet-backend
section: async-await
level: middle
sortOrder: 7
summary: Почему исключение из async void роняет процесс, как его нельзя дождаться и протестировать, и единственный случай, где он уместен.
---

`async void` — форма, которую в C# разрешили ради одного сценария и которая во всех остальных случаях создаёт проблемы: её нельзя дождаться, её исключения не ловятся обычным `try/catch` и роняют процесс. Разбираемся, откуда это следует и что писать вместо.

## Откуда берётся разница

Всё объясняется билдером машины состояний (см. `State machine`). У `async Task` билдер — `AsyncTaskMethodBuilder`: он создаёт `Task`, а результат и исключение кладёт **в него**. У `async void` билдер другой — `AsyncVoidMethodBuilder`, и класть ему некуда: возвращаемого объекта нет.

Поэтому при ошибке он делает единственное, что может, — **перебрасывает исключение в контекст синхронизации**, а если контекста нет, то прямо в поток пула. Там его никто не ждёт, и оно становится необработанным.

## Три проблемы

**1. Исключение не поймать.**

```csharp
async void FireAndForget()
{
    await Task.Delay(10);
    throw new InvalidOperationException("упало");
}

try
{
    FireAndForget();        // метод вернулся сразу, на первом await
    await Task.Delay(100);  // исключение прилетит где-то здесь
}
catch (Exception)
{
    // сюда НЕ попадёт: мы давно вышли из FireAndForget
}
```

`try/catch` не срабатывает, потому что к моменту броска вызывающий код уже ушёл вперёд. Необработанное исключение в .NET Core **завершает процесс** — не логирует, не игнорирует, а роняет.

С `async Task` этого не происходит: исключение оседает в задаче и всплывает там, где её ждут.

**2. Нельзя дождаться завершения.**

```csharp
async void SaveAsync() { await _db.SaveChangesAsync(); }

SaveAsync();
// продолжаем выполнение; сохранилось ли — неизвестно
```

Вызывающий не может узнать ни когда метод закончил, ни чем. В тестах это проявляется как «тест зелёный, но ничего не проверил»: проверка выполняется до завершения операции.

**3. Не тестируется.** Тестовые фреймворки ждут `Task`; у `async void` его нет, поэтому тест завершится раньше метода.

## Единственный законный случай — обработчики событий

Сигнатура события задана заранее (`void OnClick(object?, EventArgs)`), вернуть `Task` из неё нельзя. Поэтому обработчик — тот самый случай, ради которого `async void` и существует:

```csharp
private async void Button_Click(object sender, EventArgs e)
{
    try
    {
        button.Enabled = false;
        var data = await LoadAsync();     // UI не заморожен
        label.Text = data;
    }
    catch (Exception ex)
    {
        ShowError(ex);                     // ловим ВНУТРИ обработчика
    }
    finally
    {
        button.Enabled = true;
    }
}
```

Правило для такого кода жёсткое: **весь `async void`-обработчик оборачивается в `try/catch`**. Наружу исключению уйти нельзя — снаружи его никто не поймает.

## Что писать вместо

**Обычный случай — `async Task`:**

```csharp
// Плохо
async void ProcessAsync() { await DoWorkAsync(); }

// Хорошо
async Task ProcessAsync() { await DoWorkAsync(); }
```

**Намеренный «запустить и забыть»** — если задача действительно не нужна вызывающему, это стоит сделать явным, с обработкой ошибок:

```csharp
_ = ProcessAsync().ContinueWith(
    t => _logger.LogError(t.Exception, "фоновая задача упала"),
    TaskContinuationOptions.OnlyOnFaulted);
```

Или обёрткой, которая честно называет намерение:

```csharp
static async void FireAndForget(Task task, ILogger logger)
{
    try { await task; }
    catch (Exception ex) { logger.LogError(ex, "фоновая задача упала"); }
}
```

Здесь `async void` допустим ровно потому, что внутри стоит `try/catch`, а метод существует именно для поглощения ошибки.

**Фоновая работа в сервисе — `BackgroundService`**, а не запуск задачи из контроллера:

```csharp
public class Worker : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await DoWorkAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
```

Причина не только в исключениях: задача, запущенная из обработчика запроса, живёт дольше запроса и может быть прервана остановкой приложения на середине.

## Ловушки, которые выглядят иначе

**`async` лямбда, переданная как `Action`, становится `async void`:**

```csharp
list.ForEach(async item => await ProcessAsync(item));   // это async void!
```

`List<T>.ForEach` принимает `Action<T>`, поэтому лямбда компилируется в `async void` со всеми его свойствами: ошибки не ловятся, завершения не дождаться, и цикл пойдёт дальше, не дожидаясь обработки. Правильно — обычный `foreach`:

```csharp
foreach (var item in list)
    await ProcessAsync(item);
```

Или, если операции независимы:

```csharp
await Task.WhenAll(list.Select(ProcessAsync));
```

**То же самое с `Timer`:**

```csharp
new Timer(async _ => await TickAsync(), null, 0, 1000);   // async void
```

Колбэк таймера — `TimerCallback`, то есть `void`. Внутри обязателен `try/catch`, либо стоит взять `PeriodicTimer`, который работает с `await` честно:

```csharp
using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
while (await timer.WaitForNextTickAsync(token))
    await TickAsync();
```

**Перегрузки, принимающие и `Action`, и `Func<Task>`.** Если в API есть обе, компилятор может выбрать `Action` — и лямбда снова станет `async void`. Стоит проверять, какая перегрузка выбрана, особенно у методов вроде `Assert.Throws` или middleware.

## Как поймать

Анализатор **VSTHRD100** из `Microsoft.VisualStudio.Threading.Analyzers` («Avoid async void methods») находит и сами методы, и лямбды. Для проектов, где обработчиков событий нет — веб-сервисы, библиотеки, — правило стоит включить как ошибку: ложных срабатываний там практически не бывает.

## Что стоит ответить на собеседовании

`async void` отличается билдером машины состояний: класть результат и исключение некуда, поэтому ошибка перебрасывается в контекст синхронизации или в поток пула, где её никто не ждёт, — в .NET Core это завершает процесс. Дождаться такого метода тоже нельзя: вызывающий не получает `Task`, поэтому ни `await`, ни тест не знают, когда операция закончилась.

Сильный ответ назовёт единственный законный случай — обработчики событий, чью сигнатуру нельзя изменить, — с обязательным `try/catch` внутри всего обработчика. И добавит неочевидную ловушку: `async`-лямбда, переданная туда, где ожидается `Action` (например, `List.ForEach` или колбэк `Timer`), молча становится `async void` со всеми последствиями; ловится анализатором VSTHRD100.
