---
title: WhenAll, WhenAny и исключения
slug: whenall-whenany-isklyucheniya
track: dotnet-backend
section: async-await
level: middle
sortOrder: 8
summary: Параллельный запуск задач, почему await показывает только одно исключение из нескольких, брошенные задачи после WhenAny и ограничение параллелизма.
---

`Task.WhenAll` и `Task.WhenAny` — основные способы работать с несколькими задачами сразу. Оба просты в использовании и оба имеют неочевидное поведение при ошибках: `WhenAll` скрывает часть исключений, а `WhenAny` оставляет проигравшие задачи выполняться. Разберём с проверкой на реальных замерах.

## WhenAll: дождаться всех

```csharp
var userTask = LoadUserAsync(id);
var ordersTask = LoadOrdersAsync(id);
var settingsTask = LoadSettingsAsync(id);

await Task.WhenAll(userTask, ordersTask, settingsTask);

var user = await userTask;        // уже завершена, берём результат
var orders = await ordersTask;
```

Или сразу с результатами, если тип общий:

```csharp
User[] users = await Task.WhenAll(ids.Select(LoadUserAsync));
```

Выигрыш измерим — три операции по 200 мс на .NET 10:

```
три await подряд:         641 мс
запустили, потом WhenAll: 214 мс
```

Ключевой момент: задачи должны быть **запущены до ожидания**. `WhenAll` ничего не запускает, он лишь ждёт уже работающие задачи. Поэтому `await` внутри цикла сводит всю затею на нет.

## Исключения в WhenAll: главная ловушка

Если упали несколько задач, `await` покажет только **одно** исключение. Проверено на трёх падающих задачах:

```
await WhenAll бросил: FormatException — «третья»
а в .Exception лежит: AggregateException c 3 исключениями
```

`await` разворачивает `AggregateException` и бросает одно из вложенных — остальные два теряются из виду, хотя физически сохранены в задаче. Для диагностики это плохо: в логе окажется случайная из ошибок.

Чтобы увидеть все, нужно обращаться к задаче, а не к результату `await`:

```csharp
var all = Task.WhenAll(tasks);
try
{
    await all;
}
catch
{
    // В all.Exception лежат ВСЕ исключения
    foreach (var ex in all.Exception!.InnerExceptions)
        _logger.LogError(ex, "задача упала");

    throw;
}
```

Второй важный факт: **`WhenAll` дожидается всех задач**, даже если первая упала сразу. Это правильное поведение — иначе остались бы невидимые выполняющиеся операции, — но означает, что время ожидания определяется самой медленной задачей, а не самой быстрой ошибкой.

Если нужно оборвать остальные при первой ошибке, это делается через `CancellationToken`, общий для всех задач (см. `CancellationToken и таймауты`).

## WhenAny: дождаться первой

```csharp
Task<string> primary = LoadFromPrimaryAsync();
Task<string> replica = LoadFromReplicaAsync();

Task<string> winner = await Task.WhenAny(primary, replica);
string result = await winner;     // нужен второй await за результатом
```

`WhenAny` возвращает **задачу**, а не результат, поэтому нужен второй `await`. И он возвращает первую **завершившуюся** — в том числе завершившуюся с ошибкой; «первая успешная» — это не про него.

Главная особенность проверена замером:

```
WhenAny вернул завершённую задачу, slow ещё выполняется: True
```

Проигравшая задача **продолжает выполняться**. Она не отменяется и не исчезает, а значит:

- её ресурсы заняты до конца;
- её исключение, если оно случится, останется ненаблюдаемым;
- её результат никто не заберёт.

Отсюда два правила. Передавайте проигравшим `CancellationToken` и отменяйте их после победы. И не оставляйте их ошибки без внимания:

```csharp
var winner = await Task.WhenAny(primary, replica);
cts.Cancel();                                   // сворачиваем проигравшую

foreach (var t in new[] { primary, replica })
    _ = t.ContinueWith(x => _logger.LogWarning(x.Exception, "фоновая ветка упала"),
                       TaskContinuationOptions.OnlyOnFaulted);

return await winner;
```

Исторически ненаблюдаемое исключение в .NET Framework могло уронить процесс при финализации задачи; начиная с .NET Core поведение мягче — такие исключения по умолчанию игнорируются и только вызывают событие `TaskScheduler.UnobservedTaskException`. То есть тишина вместо падения, что для диагностики даже хуже.

## Таймаут: чем заменить WhenAny

Классический приём «гонка с задержкой» сегодня писать не нужно:

```csharp
// Старый способ
var completed = await Task.WhenAny(work, Task.Delay(5000));
if (completed != work) throw new TimeoutException();
```

С .NET 6 есть встроенный `WaitAsync`, и он же корректно снимает таймер:

```csharp
await work.WaitAsync(TimeSpan.FromSeconds(5));
```

Проверено — бросает `TimeoutException`. Подробности про отмену — в следующей статье.

## Ограничение параллелизма

`WhenAll` на тысяче задач запустит **все тысячу** сразу. Для обращений к базе или внешнему API это верный способ получить отказ по числу соединений.

Современный способ — `Parallel.ForEachAsync` с явным пределом:

```csharp
await Parallel.ForEachAsync(
    items,
    new ParallelOptions { MaxDegreeOfParallelism = 10, CancellationToken = token },
    async (item, ct) => await ProcessAsync(item, ct));
```

Классический — семафор:

```csharp
var semaphore = new SemaphoreSlim(10);

var tasks = items.Select(async item =>
{
    await semaphore.WaitAsync(token);
    try { return await ProcessAsync(item, token); }
    finally { semaphore.Release(); }
});

var results = await Task.WhenAll(tasks);
```

Обратите внимание на `finally`: без него исключение внутри навсегда отнимет слот у семафора.

## Частые ошибки

**`await` внутри цикла там, где нужен параллелизм.** Даёт последовательное выполнение — ровно случай «641 мс вместо 214».

**`WhenAll` без сохранения задач.** `await Task.WhenAll(tasks)` без ссылок на отдельные задачи лишает возможности разобрать, какая из них упала.

**Ожидание результата у `WhenAny` одним `await`.** `await Task.WhenAny(...)` возвращает задачу; забытый второй `await` даёт `Task<T>` вместо `T` — компилятор подскажет, но привычка нужна.

**`WhenAll` над `ValueTask`.** Напрямую нельзя, нужен `AsTask()` (см. `Task vs Thread vs ValueTask`).

**Запуск всего и сразу на тяжёлых операциях.** Без ограничения параллелизма тысяча одновременных запросов к базе кладёт пул соединений.

## Что стоит ответить на собеседовании

`WhenAll` ждёт все задачи и позволяет выполнять независимые операции внахлёст — три ожидания по 200 мс занимают 214 мс вместо 641, но только если задачи запущены до ожидания. При нескольких ошибках `await` бросает лишь одно исключение из `AggregateException`: чтобы увидеть все, нужно смотреть `task.Exception.InnerExceptions`. И `WhenAll` всегда дожидается всех задач, даже когда первая упала сразу.

Сильный ответ добавит про `WhenAny`: он возвращает первую **завершившуюся** задачу (не обязательно успешную), требует второго `await` за результатом, а проигравшие продолжают выполняться — их нужно отменять токеном и обрабатывать их ошибки, иначе они станут ненаблюдаемыми и молча пропадут. И упомянет ограничение параллелизма через `Parallel.ForEachAsync` или `SemaphoreSlim` вместо `WhenAll` на тысяче задач.
