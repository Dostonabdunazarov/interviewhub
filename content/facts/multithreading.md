# Факты: многопоточность

## await внутри lock не скомпилируется

```yaml
slug: lock-i-await
category: multithreading
```

`lock` привязан к потоку: монитор захватывает конкретный поток, и освободить его должен тот же самый. После `await` продолжение может выполниться на другом потоке, поэтому компилятор запрещает такой код ошибкой CS1996.

Для асинхронной критической секции берите `SemaphoreSlim(1, 1)` и `await WaitAsync()` с `Release()` в `finally`. Новый тип `System.Threading.Lock` из .NET 9 эту проблему не решает: он тоже синхронный.

## counter++ из нескольких потоков теряет инкременты

```yaml
slug: inkrement-ne-atomaren
category: multithreading
```

`counter++` — это три операции: прочитать, прибавить, записать. Два потока читают одно и то же значение, и один инкремент пропадает. Миллион инкрементов через `Parallel.For` легко превращается в 150 тысяч.

```csharp
Parallel.For(0, 1_000_000, _ => Interlocked.Increment(ref counter));
```

Для одного числа хватит `Interlocked`, для составного состояния нужен `lock`. А `volatile` не помогает вовсе: он про видимость, а не про атомарность.

## Task.Delay(1) на Windows ждёт около 15 мс

```yaml
slug: task-delay-razreshenie-taimera
category: multithreading
```

Таймеры ОС тикают не чаще, чем позволяет системное разрешение. На Windows это обычно 15,6 мс, поэтому `Task.Delay(1)` и `Thread.Sleep(1)` спят не миллисекунду, а около пятнадцати. Цикл из десяти «пауз по 1 мс» займёт полторы сотни миллисекунд. На Linux разрешение таймеров намного выше, и тот же код ведёт себя иначе.

Задержки меньше пары десятков миллисекунд нельзя считать точными. А для замеров времени нужен `Stopwatch`: `DateTime.Now` медленнее из-за пересчёта в местное время и прыгает при синхронизации часов и смене летнего времени.

## Parallel.ForEach с async-лямбдой не ждёт ничего

```yaml
slug: parallel-foreach-async-lambda
category: multithreading
```

`Parallel.ForEach` принимает `Action<T>`, поэтому `async x => await ...` превращается в `async void`. Каждая итерация возвращает управление на первом `await`, цикл тут же завершается, а работа продолжается неизвестно когда, и исключения роняют процесс.

```csharp
await Parallel.ForEachAsync(items, new ParallelOptions { MaxDegreeOfParallelism = 8 },
    async (x, ct) => await ProcessAsync(x, ct));
```

С .NET 6 для асинхронной работы есть `Parallel.ForEachAsync` с ограничением параллелизма.

## ConcurrentDictionary.GetOrAdd может вызвать фабрику много раз

```yaml
slug: getoradd-fabrika-neskolko-raz
category: multithreading
```

`GetOrAdd` атомарен только в части записи в словарь. Фабрика выполняется вне блокировки, и если несколько потоков одновременно не нашли ключ, каждый вызовет её. В словарь попадёт одно значение, остальные выбросятся. На 64 параллельных вызовах легко получить десяток запусков фабрики.

Если фабрика дорогая или с побочными эффектами (открывает соединение, ходит в сеть), храните `Lazy<T>`: `dict.GetOrAdd(key, k => new Lazy<T>(() => Create(k))).Value`.
