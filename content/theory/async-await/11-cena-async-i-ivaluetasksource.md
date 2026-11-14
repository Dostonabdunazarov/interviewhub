---
title: Цена async и IValueTaskSource
slug: async-cena-i-ivaluetasksource
track: dotnet-backend
section: async-await
level: senior
sortOrder: 11
summary: Сколько на самом деле стоит async-метод, когда помогают ValueTask и отказ от async, как сделать переиспользуемую операцию без аллокаций и почему продолжения TaskCompletionSource выполняются внутри SetResult.
questions: async-skolko-na-samom-dele-stoit-async-metod-i-kogda-pomogayut-valuetask-otkaz-ot-async, async-kak-sdelat-pereispolzuemuyu-asinhronnuyu-operaciyu-bez-allokacii-cherez-ivaluetask, async-pochemu-prodolzheniya-taskcompletionsource-vypolnyayutsya-sinhronno-vnutri-setresu
---

Цена `async`-метода определяется одним вопросом: **уходит ли он реально в ожидание**. Если все `await` завершились синхронно, метод почти бесплатен. Если приостановился хотя бы раз — в куче появляется объект с машиной состояний. Всё остальное — `ValueTask`, отказ от `async`, пулинг, `IValueTaskSource` — способы убрать этот объект там, где профилировщик показал, что он важен.

Устройство машины состояний разобрано в `State machine`, здесь — её цена и инструменты для тех мест, где эта цена заметна.

## Синхронное завершение

Пока метод не приостановился, машина состояний остаётся структурой на стеке. Аллоцироваться может только сама возвращаемая задача, и тут есть тонкость, которую часто упускают. Замер на .NET 10, `GC.GetAllocatedBytesForCurrentThread()`, байт на вызов:

```
async Task, завершился синхронно             0
async Task<bool>, завершился синхронно       0
async Task<int>, вернул 5                    0
async Task<int>, вернул 42                  72
async ValueTask<int>, вернул 42              0
Task.FromResult(42)                         72
```

Для `async Task` рантайм отдаёт закэшированную завершённую задачу. Для `Task<T>` кэш есть только на узкий набор значений: `true`/`false`, небольшие `int` (примерно от −1 до 8), `null` и `default` для ряда примитивов. Это деталь реализации, а не контракт: строить на ней оптимизацию нельзя, но объяснить, откуда в профиле `Task<int>` при синхронном пути, — можно. `ValueTask<T>` здесь выигрывает честно: значение лежит прямо в структуре.

## Реальное ожидание: коробка

Когда `await` действительно ждёт, структуру нельзя оставить на стеке — кадр умрёт. Начиная с .NET Core 2.1 рантайм упаковывает её в `AsyncStateMachineBox<TStateMachine>`: объект, который **одновременно является возвращаемым `Task`**, хранит поля машины, захваченный `ExecutionContext` и продолжение. Один объект вместо прежних трёх-четырёх.

```
async Task с await Task.Yield()                    96
async Task<long>, локальная переменная через await 112
```

Цифры с .NET 10, включают и работу пула при `Task.Yield`, поэтому их стоит читать как порядок величины: около сотни байт плюс всё, что живёт через `await`. Повторные `await` внутри одного вызова новых коробок не создают. Но каждый **вложенный** async-метод, который тоже приостанавливается, добавляет свою: цепочка контроллер → сервис → репозиторий → обёртки из шести слоёв — шесть объектов на запрос.

`ExecutionContext` захватывается при каждой приостановке, и это не бесплатно, если в нём много `AsyncLocal` — каждое изменение `AsyncLocal` создаёт новый неизменяемый контекст. Подавлять поток контекста ради экономии не стоит: на нём держатся логирование, трассировка, `Activity`.

Масштаб важен: в типичном веб-API запрос аллоцирует килобайты на сериализацию, EF и строки, и сотня байт коробки — шум. Если в `dotnet-trace` (см. `dotnet-counters и dotnet-trace`) в топе `byte[]`, `string` и сущности, async-накладные расходы не ваша проблема. Если в топе `AsyncStateMachineBox<...>` конкретного метода — это кандидат на оптимизацию.

## Чем убирать

**Отказ от `async`.** Обёртка, которая только пробрасывает чужую задачу, может вернуть её напрямую:

```csharp
public Task<User?> GetAsync(int id, CancellationToken ct) => _inner.GetAsync(id, ct);
```

Минус коробка и кадр стека, но меняется семантика: исключения до первого `await` внутреннего метода вылетят при вызове; `using` вокруг `return` освободит ресурс до завершения операции; изменённый `AsyncLocal` утечёт вызывающему, потому что не-async метод не восстанавливает `ExecutionContext`; метод исчезнет из асинхронного стектрейса. Правило — только для однострочных обёрток и перегрузок.

**Быстрый путь.** Синхронная проверка плюс асинхронный хвост в отдельном методе:

```csharp
public ValueTask<Frame> ReadAsync(CancellationToken ct)
{
    if (_buffer.TryParse(out var frame))
        return new ValueTask<Frame>(frame);
    return ReadSlowAsync(ct);
}
```

**`ValueTask<T>`** окупается, когда заметная доля вызовов завершается синхронно: кэш, буферизованное чтение, данные уже в очереди. Если почти все вызовы ждут IO, коробка всё равно будет, а потребитель получит ограничения: ждать один раз, не хранить, не передавать в `WhenAll` без `AsTask()` (подробно — в `Task vs Thread vs ValueTask`).

**`PoolingAsyncValueTaskMethodBuilder`** (.NET 6+) ставится атрибутом `[AsyncMethodBuilder(typeof(PoolingAsyncValueTaskMethodBuilder<>))]` на метод, возвращающий `ValueTask<T>`, и берёт коробки из пула. Пул удерживает память и добавляет синхронизацию, выигрыш в бенчмарках бывает и отрицательным, а нарушение контракта `ValueTask` становится по-настоящему опасным: коробка уже может обслуживать другой вызов. Это инструмент для сетевых протоколов и брокеров, проверяемый `BenchmarkDotNet` с `[MemoryDiagnoser]` (см. `Как мерить: BenchmarkDotNet`).

## IValueTaskSource: операция без аллокаций

`ValueTask<T>` умеет держать три вещи: готовое значение, `Task<T>` или `IValueTaskSource<T>` плюс 16-битный токен. Третий вариант позволяет долгоживущему объекту обслуживать операции **по очереди**, переиспользуя себя: асинхронное завершение без единой аллокации. Так устроены `Socket.ReceiveAsync`, `PipeReader` и ожидающие операции `Channel<T>`.

Контракт из трёх методов: `GetStatus(token)` — завершена ли операция; `OnCompleted(continuation, state, token, flags)` — регистрация продолжения с флагами захвата контекстов; `GetResult(token)` — результат или исключение, после чего источник можно переиспользовать. Писать эту логику вручную не нужно — с .NET Core 3.0 есть `ManualResetValueTaskSourceCore<T>`:

```csharp
public sealed class ReceiveOperation : IValueTaskSource<int>
{
    private ManualResetValueTaskSourceCore<int> _core;

    public ReceiveOperation() => _core.RunContinuationsAsynchronously = true;

    public ValueTask<int> StartAsync() => new(this, _core.Version);
    public void Complete(int bytes) => _core.SetResult(bytes);
    public void Fail(Exception ex) => _core.SetException(ex);

    int IValueTaskSource<int>.GetResult(short token)
    {
        try { return _core.GetResult(token); }
        finally { if (token == _core.Version) _core.Reset(); }
    }

    ValueTaskSourceStatus IValueTaskSource<int>.GetStatus(short token) => _core.GetStatus(token);

    void IValueTaskSource<int>.OnCompleted(Action<object?> c, object? s, short token,
        ValueTaskSourceOnCompletedFlags flags) => _core.OnCompleted(c, s, token, flags);
}
```

`Reset()` увеличивает `Version`, и повторный `await` той же `ValueTask` получит `InvalidOperationException` вместо чужого результата. Защита не абсолютная: версия — `short`, после 65 536 операций значения повторяются.

Подвохи. `_core` — изменяемая структура: поле не может быть `readonly`, копия молча ломает состояние. Источник обслуживает **одну** незавершённую операцию; в реальном коде вход защищают флагом через `Interlocked`, а для параллельности держат пул источников. `Reset()` — строго после того, как потребитель забрал результат: раньше — потеря результата, забыли — следующий `SetResult` бросит исключение. Отмену и таймауты реализуете сами, включая гонку завершения с отменой. И главное: двойной `await` или `.Result` до завершения здесь не безобидны, как у `Task`, а могут прочитать результат **следующей** операции.

## TaskCompletionSource и синхронные продолжения

`await` регистрирует продолжение так, что при завершении задачи оно выполняется **прямо в потоке, вызвавшем `SetResult`**, если нет `SynchronizationContext` или нестандартного планировщика (см. `SynchronizationContext`). Это экономит постановку в очередь пула, но `SetResult` вернёт управление, только когда чужой код дойдёт до следующего `await` или до конца:

```csharp
var tcs = new TaskCompletionSource<int>();
_ = Task.Run(async () => { await tcs.Task; Thread.Sleep(500); });
await Task.Delay(100);
tcs.SetResult(1);
```

В замере на .NET 10 `SetResult` вернулся через 508 мс, а продолжение выполнилось на том же потоке. С `TaskCreationOptions.RunContinuationsAsynchronously` — через 0 мс.

Последствия в продакшене. **Застывший цикл чтения**: RPC-клиент по correlation id вызывает `pending[id].SetResult(response)`, вызывающий после `await` делает тяжёлую работу — и все запросы на соединении ждут, латентность растёт у всех, CPU низкий. **Реентерабельность под `lock`**: `SetResult` вызван под блокировкой, продолжение на том же потоке входит в тот же `lock` (`Monitor` реентерабелен) и видит нарушенный инвариант; если же продолжение синхронно ждёт ответа, который должен прочитать этот же цикл, — дедлок. **Рост стека**: цепочка TCS, завершающих друг друга; рантайм частично страхуется, при нехватке стека уводя продолжение в пул, но полагаться на это нельзя.

Защита — флаг при создании:

```csharp
var tcs = new TaskCompletionSource<Response>(TaskCreationOptions.RunContinuationsAsynchronously);
```

Ловушка: `TaskContinuationOptions.RunContinuationsAsynchronously` в конструктор подходит не по типу и молча привязывается к перегрузке `TaskCompletionSource(object? state)` — компилируется и ничего не делает. Флаг нужен, когда TCS завершается из цикла чтения, диспетчера, таймера, под блокировкой или из колбэка чужого API. Рядом стоит помнить: завершать через `TrySet*` (ответ, таймаут и отмена гонятся), освобождать регистрацию отмены, гарантировать завершение на всех путях. `CancellationTokenSource.Cancel()` тоже выполняет колбэки синхронно — с теми же последствиями.

## Что стоит ответить на собеседовании

`async`-метод, завершившийся синхронно, почти бесплатен: машина состояний — структура на стеке, для `async Task` берётся закэшированная задача, а для `Task<T>` аллоцируется результат, кроме узкого кэша для `bool` и маленьких `int`. При реальной приостановке появляется один объект `AsyncStateMachineBox`, он же возвращаемый `Task`, — порядка сотни байт плюс поля через `await`, и по одному на каждый приостановившийся слой. Убирают его отказом от `async` в тривиальных обёртках (с изменением семантики исключений, `using` и `AsyncLocal`), быстрым путём с `ValueTask<T>` и, в крайних случаях, `PoolingAsyncValueTaskMethodBuilder` — только после замера.

Сильный ответ объяснит, как `ValueTask` поверх `IValueTaskSource` и `ManualResetValueTaskSourceCore` даёт переиспользуемую операцию без аллокаций, зачем токен-версия и почему двойной `await` там портит данные, а не просто бросает исключение. И разберёт `TaskCompletionSource`: продолжения выполняются синхронно внутри `SetResult`, отчего стоят циклы чтения, ломаются инварианты под `lock` и случаются дедлоки, — лечится `TaskCreationOptions.RunContinuationsAsynchronously` с оговоркой про похожий флаг из `TaskContinuationOptions`.
