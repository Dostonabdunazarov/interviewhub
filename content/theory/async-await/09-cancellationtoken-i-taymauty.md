---
title: CancellationToken и таймауты
slug: cancellationtoken-i-taymauty
track: dotnet-backend
section: async-await
level: middle
sortOrder: 9
summary: Кооперативная отмена, отличие отменённой задачи от упавшей, связанные токены и почему OperationCanceledException не нужно логировать как ошибку.
---

В .NET нельзя прервать выполнение чужого кода насильно — `Thread.Abort` удалён как небезопасный. Отмена здесь **кооперативная**: вызывающий сообщает о желании отменить, а исполнитель сам проверяет сигнал в подходящих местах. Инструмент для этого — `CancellationToken`.

## Две стороны

`CancellationTokenSource` — у того, кто **отменяет**. `CancellationToken` — у того, кто **слушает**.

```csharp
using var cts = new CancellationTokenSource();

var task = DoWorkAsync(cts.Token);     // передаём токен исполнителю
cts.Cancel();                          // источник у нас — мы решаем, когда отменять

await task;
```

Токен — структура, копировать её дёшево; передавать нужно **вниз по всей цепочке вызовов**, ровно как `async`.

Три способа среагировать на сигнал:

```csharp
// 1. Бросить, если отменено — основной способ
token.ThrowIfCancellationRequested();

// 2. Проверить флаг, когда нужно завершиться мягко
if (token.IsCancellationRequested) return partialResult;

// 3. Передать дальше — почти все асинхронные API его принимают
await _http.GetAsync(url, token);
await _db.SaveChangesAsync(token);
await Task.Delay(1000, token);
```

Правило для своего кода: проверяйте токен **в цикле и перед долгими шагами**:

```csharp
async Task ProcessAsync(IEnumerable<Item> items, CancellationToken token)
{
    foreach (var item in items)
    {
        token.ThrowIfCancellationRequested();
        await HandleAsync(item, token);
    }
}
```

## Отменённая задача — не упавшая

Важное различие, которое часто упускают. Проверено на .NET 10:

```
статус отменённой задачи: Canceled, IsCanceled=True
```

У отменённой задачи статус **`Canceled`**, а не `Faulted`. Это отдельное состояние, и рантайм различает их по тому, **совпадает ли токен исключения с тем, по которому отменяли**:

```csharp
// Токен совпадает → задача Canceled
token.ThrowIfCancellationRequested();

// Токен не совпадает или его нет → задача Faulted
throw new OperationCanceledException();
```

Отсюда практическое следствие для обработки ошибок: **отмена — это не ошибка приложения**, а штатный исход. Логировать её как `Error` — верный способ засорить журнал при каждом закрытии браузера пользователем.

```csharp
try
{
    await ProcessAsync(token);
}
catch (OperationCanceledException) when (token.IsCancellationRequested)
{
    _logger.LogInformation("операция отменена");   // не ошибка
}
catch (Exception ex)
{
    _logger.LogError(ex, "операция упала");        // а вот это ошибка
}
```

Фильтр `when (token.IsCancellationRequested)` здесь существенен: он отличает **нашу** отмену от `OperationCanceledException`, прилетевшего по другой причине — например, по таймауту изнутри, который мы, возможно, хотим обработать иначе.

`TaskCanceledException`, который встречается в логах, — наследник `OperationCanceledException`, так что ловить достаточно базовый.

## Таймауты

`CancellationTokenSource` умеет отменяться сам:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
await LoadAsync(cts.Token);
```

Проверено — `OperationCanceledException` прилетает через заданные 100 мс.

С .NET 6 есть более прямой способ, если менять сигнатуру не хочется:

```csharp
await LoadAsync().WaitAsync(TimeSpan.FromSeconds(5));
```

Он бросает `TimeoutException` — проверено. Разница принципиальна: `WaitAsync` **прекращает ожидание**, но сама операция продолжает выполняться, потому что токена внутрь она не получала. `CancellationTokenSource` с таймаутом действительно доводит сигнал до исполнителя.

Поэтому предпочтительнее токен, а `WaitAsync` — для случаев, когда API отмену не поддерживает.

## Связанные токены

Типичная задача: отменить по таймауту **или** по запросу пользователя, смотря что случится раньше.

```csharp
using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
using var linked = CancellationTokenSource.CreateLinkedTokenSource(
    requestAborted, timeoutCts.Token);

await ProcessAsync(linked.Token);
```

`linked.Token` сработает от любого из источников. Связанный источник **обязательно** нужно освобождать: он подписывается на родительские токены, и без `Dispose` подписка останется — классическая утечка (см. `Утечки памяти в managed-коде`).

Понять, что именно сработало, можно по флагам:

```csharp
catch (OperationCanceledException)
{
    if (timeoutCts.IsCancellationRequested) return Results.StatusCode(504);
    if (requestAborted.IsCancellationRequested) return Results.StatusCode(499);
    throw;
}
```

## В ASP.NET Core

Токен отмены запроса доступен прямо в сигнатуре действия — его подставляет фреймворк:

```csharp
[HttpGet]
public async Task<IActionResult> Get(CancellationToken cancellationToken)
{
    var data = await _service.LoadAsync(cancellationToken);
    return Ok(data);
}
```

Он срабатывает, когда клиент разорвал соединение. Пробрасывать его дальше — в репозиторий, в `HttpClient`, в `SaveChangesAsync` — прямая экономия: сервис перестаёт тратить ресурсы на ответ, который уже никому не нужен.

Для фоновых сервисов токен приходит в `ExecuteAsync` и сигнализирует об остановке приложения:

```csharp
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    while (!stoppingToken.IsCancellationRequested)
    {
        await DoWorkAsync(stoppingToken);
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
    }
}
```

`Task.Delay` с токеном здесь обязателен: без него остановка приложения будет ждать целую минуту.

## Регистрация колбэка

Если нужно освободить ресурс именно в момент отмены:

```csharp
using var registration = token.Register(() => _connection.Abort());
```

Регистрацию надо освобождать, иначе долгоживущий токен удержит колбэк и всё, что тот захватил.

## Частые ошибки

**Токен принимают, но не используют.** Параметр есть, `ThrowIfCancellationRequested` внутри нет — отмена не работает, хотя код выглядит правильным.

**Токен не пробрасывают дальше.** Обрывается на первом же уровне — отменяется только верхний метод, а запрос к базе продолжается.

**`catch (Exception)` проглатывает отмену** и превращает её в ошибку — или, наоборот, гасит её вместе с настоящими ошибками.

**`CancellationToken.None` «чтобы компилировалось».** Явный отказ от отмены; допустим только там, где операция обязана завершиться (например, запись финального состояния).

**Забытый `Dispose` у `CancellationTokenSource`** — особенно у связанного и у созданного с таймаутом: внутри живёт таймер.

## Что стоит ответить на собеседовании

Отмена в .NET кооперативная: `CancellationTokenSource` у отменяющей стороны, `CancellationToken` у исполняющей, и исполнитель сам проверяет сигнал через `ThrowIfCancellationRequested` либо передаёт токен дальше во вложенные асинхронные вызовы. Насильно прервать чужой код нельзя — `Thread.Abort` удалён как небезопасный.

Сильный ответ отметит, что отменённая задача получает статус `Canceled`, а не `Faulted` (рантайм различает их по совпадению токена), и что отмена — штатный исход, который не нужно логировать как ошибку: ловить её стоит отдельным `catch (OperationCanceledException) when (token.IsCancellationRequested)`. И разведёт два способа таймаута: `CancellationTokenSource(timeout)` доводит сигнал до исполнителя и действительно сворачивает работу, а `WaitAsync(timeout)` лишь прекращает ожидание — операция под ним продолжает выполняться.
