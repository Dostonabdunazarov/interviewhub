---
title: IAsyncEnumerable
slug: iasyncenumerable
track: dotnet-backend
section: async-await
level: middle
sortOrder: 10
summary: Асинхронный поток вместо Task со списком, await foreach и yield return вместе, отмена через WithCancellation и стриминг из базы и в HTTP.
---

`Task<List<T>>` возвращает всё сразу: пока не готов последний элемент, вызывающий не получит ни одного. `IAsyncEnumerable<T>` отдаёт элементы **по мере готовности**, не собирая их в память. Это соединение двух механизмов, которые до C# 8 не сочетались: итераторов из `yield return` и асинхронности.

## Задача

Сравним два способа отдать сто тысяч записей из базы:

```csharp
// Всё в памяти: ждём последнюю запись, держим все сразу
async Task<List<Order>> GetOrdersAsync()
{
    var result = new List<Order>();
    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
        result.Add(Map(reader));
    return result;             // вернётся через N секунд и займёт много памяти
}

// Потоком: первый элемент сразу, память постоянна
async IAsyncEnumerable<Order> StreamOrdersAsync()
{
    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
        yield return Map(reader);
}
```

Разница та же, что между `List<T>` и итератором из статьи `yield return и итераторы`, только теперь каждый шаг может ждать. Потребление памяти не зависит от числа записей, а обработка начинается с первой.

## Как это выглядит

Объявление — `async` плюс `IAsyncEnumerable<T>` плюс `yield return`:

```csharp
static async IAsyncEnumerable<int> StreamAsync(int n)
{
    for (int i = 0; i < n; i++)
    {
        await Task.Delay(10);       // можно ждать между элементами
        yield return i;
    }
}
```

Потребление — `await foreach`:

```csharp
await foreach (var item in StreamAsync(5))
    Process(item);
```

Проверено на .NET 10: перечисление работает, элементы приходят по одному.

Компилятор порождает **комбинированную машину состояний** — одновременно итератора и `async`-метода (см. `State machine`). Интерфейсы тоже асинхронные:

```csharp
public interface IAsyncEnumerable<out T>
{
    IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken ct = default);
}

public interface IAsyncEnumerator<out T> : IAsyncDisposable
{
    T Current { get; }
    ValueTask<bool> MoveNextAsync();
}
```

`MoveNextAsync` возвращает `ValueTask<bool>` — именно тот случай, ради которого `ValueTask` создавался: шагов много, и большинство из них завершается синхронно из буфера.

## Отмена

Токен передаётся через `WithCancellation`:

```csharp
await foreach (var item in StreamAsync().WithCancellation(token))
    Process(item);
```

А чтобы токен попал **внутрь** генератора, параметр помечается атрибутом:

```csharp
static async IAsyncEnumerable<Order> StreamAsync(
    [EnumeratorCancellation] CancellationToken token = default)
{
    await using var reader = await cmd.ExecuteReaderAsync(token);
    while (await reader.ReadAsync(token))
        yield return Map(reader);
}
```

Без `[EnumeratorCancellation]` токен из `WithCancellation` до тела не дойдёт — тихая ошибка, которую легко не заметить. Анализатор CA2016 на неё указывает.

`ConfigureAwait` для потоков тоже есть, и в библиотеках он так же обязателен:

```csharp
await foreach (var item in StreamAsync().ConfigureAwait(false))
```

## Где применяется

**Стриминг из базы.** EF Core умеет отдавать результат потоком:

```csharp
await foreach (var order in _db.Orders.Where(o => o.IsActive).AsAsyncEnumerable())
    await ProcessAsync(order);
```

В отличие от `ToListAsync()`, записи не накапливаются в памяти. Важное ограничение: соединение занято всё время перечисления, поэтому долгая обработка каждого элемента удерживает его — иногда правильнее читать пачками.

**Стриминг в HTTP-ответ.** ASP.NET Core поддерживает `IAsyncEnumerable` напрямую:

```csharp
[HttpGet("orders")]
public IAsyncEnumerable<Order> GetOrders() => _service.StreamOrdersAsync();
```

JSON пишется в поток по мере готовности — клиент начинает получать данные, не дожидаясь конца выборки, а сервер не держит весь ответ в памяти.

**Чтение сообщений из очереди и длинные опросы** — естественный бесконечный поток:

```csharp
await foreach (var message in _consumer.ConsumeAsync(token))
    await HandleAsync(message, token);
```

**Постраничный обход API**, где следующая страница запрашивается по курсору из предыдущей, — потребитель видит просто последовательность элементов.

## LINQ над асинхронными потоками

Встроенного LINQ у `IAsyncEnumerable` нет — нужен пакет `System.Linq.Async`:

```csharp
var result = await StreamAsync()
    .Where(x => x.IsActive)
    .Select(x => x.Name)
    .Take(10)
    .ToListAsync();
```

Операторы ленивы так же, как обычный LINQ (см. `LINQ и отложенное выполнение`), и каждый шаг может ждать.

В .NET 10 часть операторов появилась и в самой платформе, но на проектах с более ранними версиями пакет по-прежнему нужен.

## Чего у него нет

**Нельзя перечислить дважды без повторного выполнения** — как и у обычного итератора, каждое перечисление запускает генератор заново. Для потока из сети это означает повторный запрос.

**Нет `Count` и индексатора.** Узнать длину заранее нельзя по определению.

**Не работает с `Parallel.ForEach`** — но есть `Parallel.ForEachAsync`, принимающий `IAsyncEnumerable`:

```csharp
await Parallel.ForEachAsync(StreamAsync(), new ParallelOptions
{
    MaxDegreeOfParallelism = 4
}, async (item, ct) => await ProcessAsync(item, ct));
```

**Нельзя вернуть из `async Task`-метода.** Метод либо `async Task<T>`, либо `async IAsyncEnumerable<T>` — совместить нельзя, потому что это разные машины состояний.

## Когда не нужен

Механизм не бесплатен по сложности, и брать его стоит не всегда.

**Элементов мало и они уже в памяти** — верните `Task<List<T>>`. Для десяти записей стриминг только усложняет код.

**Результат всё равно материализуют** — если у всех вызывающих сразу `ToListAsync()`, промежуточный поток не нужен.

**Нужен весь набор для решения** — сортировка, агрегат по всем элементам, подсчёт общего количества.

**Транзакция должна быть короткой.** Перечисление держит соединение и транзакцию открытыми всё время обработки — иногда прочитать пачкой и закрыть транзакцию правильнее.

## Что стоит ответить на собеседовании

`IAsyncEnumerable<T>` — асинхронный поток: элементы отдаются по мере готовности, а не собираются в коллекцию, поэтому память не зависит от их числа и обработка начинается с первого элемента. Объявляется как `async IAsyncEnumerable<T>` с `yield return`, потребляется через `await foreach`; компилятор порождает совмещённую машину состояний итератора и `async`-метода, а `MoveNextAsync` возвращает `ValueTask<bool>`, потому что большинство шагов завершается синхронно из буфера.

Сильный ответ назовёт практические применения — стриминг из EF Core через `AsAsyncEnumerable`, отдачу JSON потоком прямо из действия контроллера, чтение из очереди — и тонкость с отменой: токен передаётся через `.WithCancellation(token)`, но чтобы он дошёл до тела генератора, параметр нужно пометить `[EnumeratorCancellation]`, иначе отмена молча не сработает.
