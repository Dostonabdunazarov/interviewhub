# Ozon Middle .NET — вопросы для собеседования

Файл в формате импорта: каждый вопрос — заголовок `##`, под ним YAML-блок
с метаданными, дальше текст ответа. Полное описание формата — в
`tools/questions.md`.

**Ответы пока не написаны** — под каждым вопросом стоит `TODO`. Импорт такой
файл примет (валидация требует лишь непустой ответ), но лучше заполнять
раздел за разделом: у скрипта есть `--update`, поэтому повторный запуск
обновит уже загруженные вопросы, а не создаст дубли.

Проверить разбор перед отправкой:

```bash
node tools/import-questions.mjs --file Ozon_Middle_NET_Interview_Questions.md --dry-run
```

Категория и грейд стоят у каждого вопроса, так что порядок блоков в файле
на импорт не влияет — разделы ниже нужны только для чтения глазами.

| Раздел | Категория | Вопросов |
| --- | --- | --- |
| C# — язык и основные конструкции | `csharp` | 40 |
| CLR, Garbage Collector и память | `clr-gc` | 30 |
| Async / Await | `async` | 27 |
| Multithreading и синхронизация | `multithreading` | 40 |
| ASP.NET Core | `aspnet-core` | 50 |
| EF Core / Dapper / ORM | `ef-core` | 40 |
| PostgreSQL / SQL | `postgresql` | 78 |
| Kafka / Message Brokers | `kafka` | 40 |
| Microservices | `microservices` | 50 |
| Algorithms / Data Structures | `algorithms` | 40 |
| System Design | `system-design` | 50 |
| **Итого** | | **485** |

---

## Приоритет подготовки

Порядок, в котором стоит закрывать разделы для Middle .NET backend в Ozon:

1. C# / CLR / GC
2. Async/Await
3. Multithreading
4. PostgreSQL / SQL
5. Kafka
6. Microservices
7. ASP.NET Core
8. EF Core / Dapper
9. System Design
10. Algorithms

---

# C# — язык и основные конструкции

<!-- Типы и память -->

## Чем `class` отличается от `struct`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chem-class-otlichaetsya-ot-struct
tags: value-types
```

TODO

## Что такое value type и reference type?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-value-type-i-reference-type
tags: value-types
```

TODO

## Где хранятся value types и reference types — в stack или heap?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-gde-hranyatsya-value-types-i-reference-types-v-stack-ili-heap
tags: value-types, data-structures
```

TODO

## Что такое boxing и unboxing?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-boxing-i-unboxing
tags: boxing
```

TODO

## Когда происходит boxing?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-kogda-proishodit-boxing
tags: boxing
```

TODO

## Что будет при сравнении двух `struct`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chto-budet-pri-sravnenii-dvuh-struct
tags: value-types
```

TODO

## Чем отличаются `Equals()`, `ReferenceEquals()` и `==`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chem-otlichayutsya-equals-referenceequals-i
```

TODO

## Для чего нужен `GetHashCode()`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-dlya-chego-nuzhen-gethashcode
```

TODO

## Почему нельзя изменять объект, пока он используется как ключ `Dictionary`?

```yaml
category: csharp
level: middle
difficulty: 4
slug: csharp-pochemu-nelzya-izmenyat-obekt-poka-on-ispolzuetsya-kak-klyuch-dictiona
tags: collections
```

TODO

## Что такое immutable object и зачем он нужен?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-immutable-object-i-zachem-on-nuzhen
tags: value-types
```

TODO

<!-- Коллекции и LINQ -->

## Чем отличаются `IEnumerable`, `ICollection` и `IList`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chem-otlichayutsya-ienumerable-icollection-i-ilist
tags: linq, collections
```

TODO

## Чем отличаются `IEnumerable` и `IQueryable`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chem-otlichayutsya-ienumerable-i-iqueryable
tags: linq
```

TODO

## Что такое deferred execution?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-deferred-execution
tags: linq
```

TODO

## Что делает `yield return`?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-delaet-yield-return
tags: linq
```

TODO

## Как работает `Dictionary`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-kak-rabotaet-dictionary
tags: collections
```

TODO

## Как работает `HashSet`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-kak-rabotaet-hashset
tags: collections
```

TODO

## Чем `List<T>` отличается от `LinkedList<T>`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chem-list-t-otlichaetsya-ot-linkedlist-t
tags: collections
```

TODO

## Чем `Array` отличается от `List<T>`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chem-array-otlichaetsya-ot-list-t
tags: collections
```

TODO

## Чем отличаются `First`, `FirstOrDefault`, `Single` и `SingleOrDefault`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chem-otlichayutsya-first-firstordefault-single-i-singleordefault
```

TODO

## Что такое LINQ и как он выполняется?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-linq-i-kak-on-vypolnyaetsya
tags: linq
```

TODO

<!-- ООП и модификаторы -->

## Что такое SOLID?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-solid
tags: oop
```

TODO

## Что такое инкапсуляция, наследование, полиморфизм и абстракция?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-inkapsulyaciya-nasledovanie-polimorfizm-i-abstrakciya
tags: oop
```

TODO

## Чем `interface` отличается от `abstract class`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chem-interface-otlichaetsya-ot-abstract-class
tags: oop
```

TODO

## Что делают `virtual`, `override` и `new`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chto-delayut-virtual-override-i-new
tags: oop
```

TODO

## Чем отличаются `const`, `readonly` и `static readonly`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chem-otlichayutsya-const-readonly-i-static-readonly
```

TODO

## Что делают `ref`, `out` и `in`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chto-delayut-ref-out-i-in
```

TODO

## Чем отличаются `record`, `class` и `struct`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chem-otlichayutsya-record-class-i-struct
tags: value-types
```

TODO

## Что такое `init` accessor?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-init-accessor
```

TODO

## Что такое covariance и contravariance?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-covariance-i-contravariance
```

TODO

## Что такое delegates?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-delegates
```

TODO

## Что такое events?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-events
```

TODO

## Чем отличаются `Action`, `Func` и `Predicate`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chem-otlichayutsya-action-func-i-predicate
```

TODO

## Что такое lambda expression?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-lambda-expression
```

TODO

## Что такое extension methods?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-extension-methods
```

TODO

## Что такое pattern matching в C#?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-pattern-matching-v-c
```

TODO

## Что такое nullable reference types?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-nullable-reference-types
tags: value-types, sql
```

TODO

## Чем отличаются `string` и `StringBuilder`?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-chem-otlichayutsya-string-i-stringbuilder
```

TODO

## Почему `string` immutable?

```yaml
category: csharp
level: middle
difficulty: 3
slug: csharp-pochemu-string-immutable
tags: value-types
```

TODO

## Что такое `Span<T>` и `Memory<T>`?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-span-t-i-memory-t
tags: span
```

TODO

## Что такое `IAsyncEnumerable<T>`?

```yaml
category: csharp
level: middle
difficulty: 2
slug: csharp-chto-takoe-iasyncenumerable-t
tags: async
```

TODO

---

# CLR, Garbage Collector и память

## Что такое CLR?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-clr
tags: clr
```

TODO

## Что происходит с C# кодом от компиляции до выполнения?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-chto-proishodit-s-c-kodom-ot-kompilyacii-do-vypolneniya
```

TODO

## Что такое IL?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-il
tags: clr
```

TODO

## Что такое JIT?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-jit
tags: clr
```

TODO

## Чем managed memory отличается от unmanaged memory?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-chem-managed-memory-otlichaetsya-ot-unmanaged-memory
tags: memory
```

TODO

## Как работает Garbage Collector?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-kak-rabotaet-garbage-collector
tags: memory
```

TODO

## Что такое Gen 0, Gen 1 и Gen 2?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-gen-0-gen-1-i-gen-2
tags: memory
```

TODO

## Почему в .NET используется поколенческий GC?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-pochemu-v-net-ispolzuetsya-pokolencheskii-gc
tags: memory
```

TODO

## Что такое Large Object Heap (LOH)?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-large-object-heap-loh
tags: memory
```

TODO

## Когда объект попадает в Gen 1 или Gen 2?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-kogda-obekt-popadaet-v-gen-1-ili-gen-2
tags: memory
```

TODO

## Как GC определяет, какие объекты больше не нужны?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-kak-gc-opredelyaet-kakie-obekty-bolshe-ne-nuzhny
tags: memory
```

TODO

## Может ли GC удалить объекты, которые ссылаются друг на друга?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-mozhet-li-gc-udalit-obekty-kotorye-ssylayutsya-drug-na-druga
tags: memory
```

TODO

## Что такое GC Root?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-gc-root
tags: memory
```

TODO

## Что такое memory leak в .NET?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-memory-leak-v-net
tags: memory
```

TODO

## Может ли managed-приложение иметь memory leak?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-mozhet-li-managed-prilozhenie-imet-memory-leak
tags: memory
```

TODO

## Что такое `IDisposable`?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-idisposable
```

TODO

## Зачем нужен `Dispose()`?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-zachem-nuzhen-dispose
tags: memory
```

TODO

## Как работает `using`?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-kak-rabotaet-using
```

TODO

## Чем `Dispose()` отличается от finalizer?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-chem-dispose-otlichaetsya-ot-finalizer
tags: memory
```

TODO

## Что такое finalizer?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-finalizer
tags: memory
```

TODO

## Когда нужно использовать finalizer?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-kogda-nuzhno-ispolzovat-finalizer
tags: memory
```

TODO

## Что такое `WeakReference`?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-weakreference
tags: memory
```

TODO

## Что такое allocation?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-allocation
tags: memory
```

TODO

## Как уменьшить количество аллокаций?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-kak-umenshit-kolichestvo-allokacii
tags: memory
```

TODO

## Что такое boxing allocation?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-boxing-allocation
tags: memory, boxing
```

TODO

## Как можно диагностировать проблемы с памятью?

```yaml
category: clr-gc
level: middle
difficulty: 3
slug: clr-gc-kak-mozhno-diagnostirovat-problemy-s-pamyatyu
```

TODO

## Что такое `GC.Collect()` и почему обычно не стоит вызывать его вручную?

```yaml
category: clr-gc
level: middle
difficulty: 4
slug: clr-gc-chto-takoe-gc-collect-i-pochemu-obychno-ne-stoit-vyzyvat-ego-vruchnuyu
tags: memory
```

TODO

## Что такое Server GC и Workstation GC?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-server-gc-i-workstation-gc
tags: memory
```

TODO

## Что такое pinned object?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-pinned-object
tags: memory
```

TODO

## Что такое fragmentation в памяти?

```yaml
category: clr-gc
level: middle
difficulty: 2
slug: clr-gc-chto-takoe-fragmentation-v-pamyati
tags: memory
```

TODO

---

# Async / Await

## Как работает `async/await`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-rabotaet-async-await
tags: async
```

TODO

## Создаёт ли `async/await` новый поток?

```yaml
category: async
level: middle
difficulty: 3
slug: async-sozdaet-li-async-await-novyi-potok
tags: async, threading
```

TODO

## Что такое `Task`?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-takoe-task
tags: async
```

TODO

## Чем `Task` отличается от `Thread`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-chem-task-otlichaetsya-ot-thread
tags: async, threading
```

TODO

## Чем `Task` отличается от `ValueTask`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-chem-task-otlichaetsya-ot-valuetask
tags: async
```

TODO

## Что происходит после `await`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-chto-proishodit-posle-await
tags: async
```

TODO

## Что такое state machine для async-метода?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-takoe-state-machine-dlya-async-metoda
tags: async
```

TODO

## Что такое CPU-bound и IO-bound операции?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-takoe-cpu-bound-i-io-bound-operacii
```

TODO

## Когда нужен `Task.Run()`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kogda-nuzhen-task-run
tags: async
```

TODO

## Почему `Task.Run()` обычно не нужен для IO-bound операций?

```yaml
category: async
level: middle
difficulty: 3
slug: async-pochemu-task-run-obychno-ne-nuzhen-dlya-io-bound-operacii
tags: async
```

TODO

## Что будет, если забыть `await`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-chto-budet-esli-zabyt-await
tags: async
```

TODO

## Почему `async void` обычно использовать не рекомендуется?

```yaml
category: async
level: middle
difficulty: 3
slug: async-pochemu-async-void-obychno-ispolzovat-ne-rekomenduetsya
tags: async
```

TODO

## Что такое deadlock при использовании async/await?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-takoe-deadlock-pri-ispolzovanii-async-await
tags: async, deadlock, synchronization
```

TODO

## Что такое `SynchronizationContext`?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-takoe-synchronizationcontext
tags: async, synchronization
```

TODO

## Что делает `ConfigureAwait(false)`?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-delaet-configureawait-false
tags: async
```

TODO

## Как работает `CancellationToken`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-rabotaet-cancellationtoken
tags: async
```

TODO

## Как правильно отменять async operation?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-pravilno-otmenyat-async-operation
tags: async
```

TODO

## Что делает `Task.WhenAll()`?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-delaet-task-whenall
tags: async
```

TODO

## Что делает `Task.WhenAny()`?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-delaet-task-whenany
tags: async
```

TODO

## Как обрабатываются исключения в async-методах?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-obrabatyvayutsya-isklyucheniya-v-async-metodah
tags: async
```

TODO

## Что произойдёт, если одна из задач в `Task.WhenAll()` завершится с exception?

```yaml
category: async
level: middle
difficulty: 4
slug: async-chto-proizoidet-esli-odna-iz-zadach-v-task-whenall-zavershitsya-s-exce
tags: async
```

TODO

## Как сделать timeout для async-операции?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-sdelat-timeout-dlya-async-operacii
tags: async, resilience
```

TODO

## Как ограничить количество одновременно выполняющихся async-задач?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-ogranichit-kolichestvo-odnovremenno-vypolnyayuschihsya-async-zadac
tags: async
```

TODO

## Что такое async streaming?

```yaml
category: async
level: middle
difficulty: 2
slug: async-chto-takoe-async-streaming
tags: async
```

TODO

## Как работает `IAsyncEnumerable<T>`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kak-rabotaet-iasyncenumerable-t
tags: async
```

TODO

## Чем `await foreach` отличается от обычного `foreach`?

```yaml
category: async
level: middle
difficulty: 3
slug: async-chem-await-foreach-otlichaetsya-ot-obychnogo-foreach
tags: async
```

TODO

## Какие ошибки чаще всего допускают при использовании async/await?

```yaml
category: async
level: middle
difficulty: 3
slug: async-kakie-oshibki-chasche-vsego-dopuskayut-pri-ispolzovanii-async-await
tags: async
```

TODO

---

# Multithreading и синхронизация

## Что такое thread?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-thread
tags: threading
```

TODO

## Что такое ThreadPool?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-threadpool
tags: threading
```

TODO

## Как работает ThreadPool в .NET?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-kak-rabotaet-threadpool-v-net
tags: threading
```

TODO

## Чем процесс отличается от потока?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-chem-process-otlichaetsya-ot-potoka
tags: threading
```

TODO

## Что такое concurrency и parallelism?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-concurrency-i-parallelism
tags: threading
```

TODO

## Что такое race condition?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-race-condition
tags: threading
```

TODO

## Что такое thread safety?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-thread-safety
tags: threading
```

TODO

## Что такое critical section?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-critical-section
tags: synchronization
```

TODO

## Что делает `lock`?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-delaet-lock
tags: synchronization
```

TODO

## Как работает `Monitor`?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-kak-rabotaet-monitor
tags: synchronization, observability
```

TODO

## Чем `lock` отличается от `Monitor`?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-chem-lock-otlichaetsya-ot-monitor
tags: synchronization, observability
```

TODO

## Что такое `Mutex`?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-mutex
tags: synchronization
```

TODO

## Чем `Mutex` отличается от `lock`?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-chem-mutex-otlichaetsya-ot-lock
tags: synchronization
```

TODO

## Что такое `Semaphore`?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-semaphore
tags: synchronization
```

TODO

## Чем `Semaphore` отличается от `SemaphoreSlim`?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-chem-semaphore-otlichaetsya-ot-semaphoreslim
tags: synchronization
```

TODO

## Что такое `ReaderWriterLockSlim`?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-readerwriterlockslim
```

TODO

## Что такое `Interlocked`?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-interlocked
tags: synchronization
```

TODO

## Что такое `volatile`?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-volatile
tags: synchronization
```

TODO

## Когда использовать `Interlocked`, а когда `lock`?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-kogda-ispolzovat-interlocked-a-kogda-lock
tags: synchronization
```

TODO

## Что такое `ConcurrentDictionary`?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-concurrentdictionary
tags: collections, threading
```

TODO

## Чем `ConcurrentDictionary` отличается от обычного `Dictionary`?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-chem-concurrentdictionary-otlichaetsya-ot-obychnogo-dictionary
tags: collections, threading
```

TODO

## Какие существуют thread-safe коллекции?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-kakie-suschestvuyut-thread-safe-kollekcii
tags: collections, threading
```

TODO

## Что такое deadlock?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-deadlock
tags: deadlock, synchronization
```

TODO

## Как возникает deadlock?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-kak-voznikaet-deadlock
tags: deadlock, synchronization
```

TODO

## Как избежать deadlock?

```yaml
category: multithreading
level: middle
difficulty: 4
slug: multithreading-kak-izbezhat-deadlock
tags: deadlock, synchronization
```

TODO

## Что такое livelock?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-livelock
tags: synchronization
```

TODO

## Что такое starvation?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-starvation
tags: threading
```

TODO

## Что такое lock contention?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-lock-contention
tags: synchronization, threading
```

TODO

## Что такое atomic operation?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-atomic-operation
tags: threading
```

TODO

## Что такое memory barrier?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-memory-barrier
tags: synchronization
```

TODO

## Что такое false sharing?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-false-sharing
tags: threading
```

TODO

## Как правильно синхронизировать доступ к общему состоянию?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-kak-pravilno-sinhronizirovat-dostup-k-obschemu-sostoyaniyu
tags: synchronization
```

TODO

## Можно ли использовать `lock` с `async/await`?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-mozhno-li-ispolzovat-lock-s-async-await
tags: async, synchronization
```

TODO

## Почему нельзя делать `await` внутри обычного `lock`?

```yaml
category: multithreading
level: middle
difficulty: 4
slug: multithreading-pochemu-nelzya-delat-await-vnutri-obychnogo-lock
tags: async, synchronization
```

TODO

## Что использовать вместо `lock`, если нужна асинхронная блокировка?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-chto-ispolzovat-vmesto-lock-esli-nuzhna-asinhronnaya-blokirovka
tags: synchronization, locking
```

TODO

## Что такое `Channel<T>`?

```yaml
category: multithreading
level: middle
difficulty: 2
slug: multithreading-chto-takoe-channel-t
```

TODO

## Когда использовать `Channel<T>`?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-kogda-ispolzovat-channel-t
```

TODO

## Чем `Parallel.ForEach` отличается от обычного `foreach`?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-chem-parallel-foreach-otlichaetsya-ot-obychnogo-foreach
tags: threading
```

TODO

## Чем `Parallel.ForEachAsync` отличается от `Task.WhenAll`?

```yaml
category: multithreading
level: middle
difficulty: 3
slug: multithreading-chem-parallel-foreachasync-otlichaetsya-ot-task-whenall
tags: async, threading
```

TODO

## Как диагностировать проблемы многопоточности?

```yaml
category: multithreading
level: middle
difficulty: 4
slug: multithreading-kak-diagnostirovat-problemy-mnogopotochnosti
```

TODO

---

# ASP.NET Core

## Как устроен request pipeline в ASP.NET Core?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-ustroen-request-pipeline-v-asp-net-core
tags: middleware
```

TODO

## Что такое middleware?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-middleware
tags: middleware
```

TODO

## В каком порядке выполняются middleware?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-v-kakom-poryadke-vypolnyayutsya-middleware
tags: middleware
```

TODO

## Что произойдёт, если middleware не вызовет `next()`?

```yaml
category: aspnet-core
level: middle
difficulty: 4
slug: aspnet-core-chto-proizoidet-esli-middleware-ne-vyzovet-next
tags: middleware
```

TODO

## Как написать собственный middleware?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-napisat-sobstvennyi-middleware
tags: middleware
```

TODO

## Что такое Dependency Injection?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-dependency-injection
tags: dependency-injection
```

TODO

## Как работает встроенный DI-контейнер ASP.NET Core?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-rabotaet-vstroennyi-di-konteiner-asp-net-core
```

TODO

## Чем отличаются `Transient`, `Scoped` и `Singleton`?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-chem-otlichayutsya-transient-scoped-i-singleton
tags: dependency-injection
```

TODO

## Почему нельзя напрямую внедрять `Scoped` сервис в `Singleton`?

```yaml
category: aspnet-core
level: middle
difficulty: 4
slug: aspnet-core-pochemu-nelzya-napryamuyu-vnedryat-scoped-servis-v-singleton
tags: dependency-injection
```

TODO

## Что такое `IServiceProvider`?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-iserviceprovider
tags: dependency-injection
```

TODO

## Что такое service lifetime?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-service-lifetime
tags: dependency-injection
```

TODO

## Что такое constructor injection?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-constructor-injection
tags: value-types, dependency-injection
```

TODO

## Что такое options pattern?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-options-pattern
```

TODO

## Что такое `IOptions`, `IOptionsSnapshot` и `IOptionsMonitor`?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-ioptions-ioptionssnapshot-i-ioptionsmonitor
tags: synchronization, observability
```

TODO

## Как устроена конфигурация ASP.NET Core?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-ustroena-konfiguraciya-asp-net-core
```

TODO

## Как работает logging?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-rabotaet-logging
tags: indexes, observability
```

TODO

## Что такое structured logging?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-structured-logging
tags: value-types, indexes, observability
```

TODO

## Что такое Controller?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-controller
tags: api-design
```

TODO

## Что такое Minimal API?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-minimal-api
tags: api-design
```

TODO

## Controller vs Minimal API?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-controller-vs-minimal-api
tags: api-design
```

TODO

## Что такое routing?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-routing
tags: api-design
```

TODO

## Что такое model binding?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-model-binding
tags: api-design
```

TODO

## Что такое model validation?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-model-validation
```

TODO

## Что такое action filter?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-action-filter
tags: middleware
```

TODO

## Какие бывают filters в ASP.NET Core?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-kakie-byvayut-filters-v-asp-net-core
tags: middleware
```

TODO

## Middleware vs Filter — в чём разница?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-middleware-vs-filter-v-chem-raznica
tags: middleware
```

TODO

## Authentication vs Authorization?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-authentication-vs-authorization
tags: security
```

TODO

## Как работает JWT authentication?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-rabotaet-jwt-authentication
tags: security
```

TODO

## Где и как проверяется JWT?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-gde-i-kak-proveryaetsya-jwt
tags: security
```

TODO

## Что такое claims?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-claims
tags: security
```

TODO

## Что такое policy-based authorization?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-policy-based-authorization
tags: security
```

TODO

## Что такое CORS?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-cors
tags: security
```

TODO

## Как работает CORS?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-rabotaet-cors
tags: security
```

TODO

## Что такое CSRF?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-csrf
tags: security
```

TODO

## Что такое REST?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-rest
tags: api-design
```

TODO

## Какие HTTP methods являются idempotent?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kakie-http-methods-yavlyayutsya-idempotent
tags: api-design, idempotency
```

TODO

## Какие HTTP status codes нужно знать backend-разработчику?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kakie-http-status-codes-nuzhno-znat-backend-razrabotchiku
tags: api-design
```

TODO

## Что такое `ProblemDetails`?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-problemdetails
tags: api-design
```

TODO

## Как глобально обрабатывать исключения?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-globalno-obrabatyvat-isklyucheniya
```

TODO

## Что такое rate limiting?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-rate-limiting
tags: api-design
```

TODO

## Как реализовать rate limiting в ASP.NET Core?

```yaml
category: aspnet-core
level: middle
difficulty: 4
slug: aspnet-core-kak-realizovat-rate-limiting-v-asp-net-core
tags: api-design
```

TODO

## Что такое health checks?

```yaml
category: aspnet-core
level: middle
difficulty: 2
slug: aspnet-core-chto-takoe-health-checks
tags: observability
```

TODO

## Как сделать graceful shutdown?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-sdelat-graceful-shutdown
tags: hosting
```

TODO

## Что происходит с запросами при остановке приложения?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-chto-proishodit-s-zaprosami-pri-ostanovke-prilozheniya
```

TODO

## Как работает `IHostedService`?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-rabotaet-ihostedservice
tags: hosting
```

TODO

## Чем `IHostedService` отличается от `BackgroundService`?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-chem-ihostedservice-otlichaetsya-ot-backgroundservice
tags: hosting
```

TODO

## Как реализовать background worker?

```yaml
category: aspnet-core
level: middle
difficulty: 4
slug: aspnet-core-kak-realizovat-background-worker
tags: hosting
```

TODO

## Как хранить secrets/configuration?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-hranit-secrets-configuration
tags: security
```

TODO

## Как реализовать API versioning?

```yaml
category: aspnet-core
level: middle
difficulty: 4
slug: aspnet-core-kak-realizovat-api-versioning
tags: api-design
```

TODO

## Как сделать idempotent API endpoint?

```yaml
category: aspnet-core
level: middle
difficulty: 3
slug: aspnet-core-kak-sdelat-idempotent-api-endpoint
tags: idempotency
```

TODO

---

# EF Core / Dapper / ORM

## Что такое Entity Framework Core?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-entity-framework-core
```

TODO

## Как работает DbContext?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-rabotaet-dbcontext
tags: orm
```

TODO

## Как работает change tracking?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-rabotaet-change-tracking
tags: orm
```

TODO

## Что такое tracking и no-tracking query?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-tracking-i-no-tracking-query
```

TODO

## Когда использовать `AsNoTracking()`?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kogda-ispolzovat-asnotracking
```

TODO

## Что такое `DbSet<T>`?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-dbset-t
```

TODO

## Что такое `Include()`?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-include
tags: orm
```

TODO

## Что такое eager loading?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-eager-loading
tags: orm
```

TODO

## Что такое lazy loading?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-lazy-loading
tags: orm
```

TODO

## Что такое explicit loading?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-explicit-loading
```

TODO

## Чем eager, lazy и explicit loading отличаются?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-chem-eager-lazy-i-explicit-loading-otlichayutsya
tags: orm
```

TODO

## Что такое проблема N+1?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-problema-n-1
tags: orm
```

TODO

## Как обнаружить и исправить N+1?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-obnaruzhit-i-ispravit-n-1
tags: orm
```

TODO

## Когда реально выполняется LINQ-запрос?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kogda-realno-vypolnyaetsya-linq-zapros
tags: linq
```

TODO

## Что такое deferred execution в EF Core?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-deferred-execution-v-ef-core
tags: linq, orm
```

TODO

## Чем `IEnumerable` отличается от `IQueryable` в EF Core?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-chem-ienumerable-otlichaetsya-ot-iqueryable-v-ef-core
tags: linq, orm
```

TODO

## Что происходит при вызове `ToList()`?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-chto-proishodit-pri-vyzove-tolist
```

TODO

## Что происходит при вызове `AsEnumerable()`?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-chto-proishodit-pri-vyzove-asenumerable
```

TODO

## Что такое projection через `Select()`?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-projection-cherez-select
tags: linq
```

TODO

## Почему projection часто лучше `Include()`?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-pochemu-projection-chasto-luchshe-include
tags: linq, orm
```

TODO

## Как посмотреть SQL, который генерирует EF Core?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-posmotret-sql-kotoryi-generiruet-ef-core
tags: orm
```

TODO

## Что такое migrations?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-migrations
tags: orm
```

TODO

## Как работают EF Core migrations?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-rabotayut-ef-core-migrations
tags: orm
```

TODO

## Что такое transaction в EF Core?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-transaction-v-ef-core
tags: transactions, orm
```

TODO

## Как вручную открыть transaction?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-vruchnuyu-otkryt-transaction
tags: transactions
```

TODO

## Как работает optimistic concurrency?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-rabotaet-optimistic-concurrency
tags: threading
```

TODO

## Что такое concurrency token?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-concurrency-token
tags: threading
```

TODO

## Как обрабатывать `DbUpdateConcurrencyException`?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-obrabatyvat-dbupdateconcurrencyexception
tags: threading
```

TODO

## Что такое connection pooling?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-connection-pooling
tags: orm
```

TODO

## Как EF Core работает с connection pool?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kak-ef-core-rabotaet-s-connection-pool
tags: orm
```

TODO

## Что такое compiled query?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-compiled-query
tags: orm
```

TODO

## Когда compiled queries полезны?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kogda-compiled-queries-polezny
tags: orm
```

TODO

## Что такое raw SQL в EF Core?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-raw-sql-v-ef-core
tags: orm
```

TODO

## Когда использовать Dapper вместо EF Core?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-kogda-ispolzovat-dapper-vmesto-ef-core
tags: orm
```

TODO

## Плюсы и минусы EF Core?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-plyusy-i-minusy-ef-core
tags: orm
```

TODO

## Плюсы и минусы Dapper?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-plyusy-i-minusy-dapper
tags: orm
```

TODO

## Как избежать SQL injection при использовании Dapper?

```yaml
category: ef-core
level: middle
difficulty: 4
slug: ef-core-kak-izbezhat-sql-injection-pri-ispolzovanii-dapper
tags: dependency-injection, orm
```

TODO

## Что такое Unit of Work?

```yaml
category: ef-core
level: middle
difficulty: 2
slug: ef-core-chto-takoe-unit-of-work
tags: orm
```

TODO

## Нужен ли Repository Pattern поверх EF Core?

```yaml
category: ef-core
level: middle
difficulty: 3
slug: ef-core-nuzhen-li-repository-pattern-poverh-ef-core
tags: orm
```

TODO

## Как оптимизировать медленный EF Core запрос?

```yaml
category: ef-core
level: middle
difficulty: 4
slug: ef-core-kak-optimizirovat-medlennyi-ef-core-zapros
tags: query-planning, orm
```

TODO

---

# PostgreSQL / SQL

<!-- SQL -->

## Чем `INNER JOIN` отличается от `LEFT JOIN`?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-chem-inner-join-otlichaetsya-ot-left-join
tags: sql
```

TODO

## Чем `LEFT JOIN` отличается от `RIGHT JOIN`?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-chem-left-join-otlichaetsya-ot-right-join
tags: sql
```

TODO

## Что такое `FULL OUTER JOIN`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-full-outer-join
tags: sql
```

TODO

## Что такое `CROSS JOIN`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-cross-join
tags: sql
```

TODO

## Что такое `WHERE`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-where
```

TODO

## Чем `WHERE` отличается от `HAVING`?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-chem-where-otlichaetsya-ot-having
tags: sql
```

TODO

## Что такое `GROUP BY`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-group-by
tags: sql
```

TODO

## Как работает `ORDER BY`?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-rabotaet-order-by
```

TODO

## Что такое `DISTINCT`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-distinct
tags: sql
```

TODO

## Чем `UNION` отличается от `UNION ALL`?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-chem-union-otlichaetsya-ot-union-all
tags: sql
```

TODO

## Что такое subquery?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-subquery
tags: sql
```

TODO

## Что такое correlated subquery?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-correlated-subquery
tags: sql
```

TODO

## `EXISTS` vs `IN` — что выбрать?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-exists-vs-in-chto-vybrat
```

TODO

## Что такое CTE?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-cte
tags: sql
```

TODO

## Что такое recursive CTE?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-recursive-cte
tags: sql
```

TODO

## Что такое window functions?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-window-functions
tags: sql
```

TODO

## Чем `ROW_NUMBER`, `RANK` и `DENSE_RANK` отличаются?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-chem-row-number-rank-i-dense-rank-otlichayutsya
```

TODO

## Как получить N последних записей для каждого пользователя?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-poluchit-n-poslednih-zapisei-dlya-kazhdogo-polzovatelya
```

TODO

## Как найти дубликаты?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-naiti-dublikaty
tags: sql
```

TODO

## Как удалить дубликаты?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-udalit-dublikaty
tags: sql
```

TODO

## Как работает NULL?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-rabotaet-null
tags: sql
```

TODO

## Почему `NULL = NULL` не даёт true?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-pochemu-null-null-ne-daet-true
tags: sql
```

TODO

## Чем `COALESCE` отличается от `NULLIF`?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-chem-coalesce-otlichaetsya-ot-nullif
tags: sql
```

TODO

## Что такое CASE?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-case
tags: sql
```

TODO

## Как реализовать pagination?

```yaml
category: postgresql
level: middle
difficulty: 4
slug: postgresql-kak-realizovat-pagination
tags: indexes, sql
```

TODO

## `OFFSET/LIMIT` vs keyset pagination?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-offset-limit-vs-keyset-pagination
tags: indexes, sql, kafka
```

TODO

<!-- PostgreSQL -->

## Что такое PostgreSQL?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-postgresql
```

TODO

## Какие типы индексов есть в PostgreSQL?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-kakie-tipy-indeksov-est-v-postgresql
tags: indexes
```

TODO

## Что такое B-tree index?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-b-tree-index
tags: indexes
```

TODO

## Когда B-tree индекс не помогает?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kogda-b-tree-indeks-ne-pomogaet
tags: indexes
```

TODO

## Что такое composite index?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-composite-index
tags: indexes
```

TODO

## В каком порядке выбирать колонки для composite index?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-v-kakom-poryadke-vybirat-kolonki-dlya-composite-index
tags: indexes
```

TODO

## Что такое partial index?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-partial-index
tags: indexes
```

TODO

## Что такое expression index?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-expression-index
tags: indexes
```

TODO

## Что такое GIN?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-gin
tags: indexes
```

TODO

## Что такое GiST?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-gist
tags: indexes
```

TODO

## Что такое BRIN?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-brin
tags: indexes
```

TODO

## Что такое `EXPLAIN`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-explain
tags: query-planning
```

TODO

## Что такое `EXPLAIN ANALYZE`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-explain-analyze
tags: query-planning, transactions
```

TODO

## Что такое Sequential Scan?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-sequential-scan
tags: indexes
```

TODO

## Что такое Index Scan?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-index-scan
tags: indexes
```

TODO

## Что такое Bitmap Index Scan?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-bitmap-index-scan
tags: indexes
```

TODO

## Почему PostgreSQL иногда не использует индекс?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-pochemu-postgresql-inogda-ne-ispolzuet-indeks
tags: indexes
```

TODO

## Что такое selectivity/cardinality?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-selectivity-cardinality
tags: query-planning
```

TODO

## Что такое VACUUM?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-vacuum
tags: transactions
```

TODO

## Что такое ANALYZE?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-analyze
tags: transactions
```

TODO

## Что такое autovacuum?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-autovacuum
tags: transactions
```

TODO

## Что такое MVCC?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-mvcc
tags: transactions
```

TODO

## Что такое transaction?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-transaction
tags: transactions
```

TODO

## Какие уровни изоляции транзакций существуют?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-kakie-urovni-izolyacii-tranzakcii-suschestvuyut
tags: transactions
```

TODO

## Что такое Read Committed?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-read-committed
tags: transactions
```

TODO

## Что такое Repeatable Read?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-repeatable-read
tags: transactions
```

TODO

## Что такое Serializable?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-serializable
tags: transactions
```

TODO

## Что такое dirty read?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-dirty-read
tags: transactions
```

TODO

## Что такое non-repeatable read?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-non-repeatable-read
tags: transactions
```

TODO

## Что такое phantom read?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-phantom-read
tags: transactions
```

TODO

## Что такое row-level lock?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-row-level-lock
tags: synchronization, locking
```

TODO

## Что такое table-level lock?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-table-level-lock
tags: synchronization, locking
```

TODO

## Как возникает deadlock в PostgreSQL?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-voznikaet-deadlock-v-postgresql
tags: deadlock, synchronization
```

TODO

## Как диагностировать deadlock?

```yaml
category: postgresql
level: middle
difficulty: 4
slug: postgresql-kak-diagnostirovat-deadlock
tags: deadlock, synchronization
```

TODO

## Что такое connection pool?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-connection-pool
tags: orm
```

TODO

## Как работает connection pooling в PostgreSQL/Npgsql?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-rabotaet-connection-pooling-v-postgresql-npgsql
tags: orm
```

TODO

## Как оптимизировать медленный SQL-запрос?

```yaml
category: postgresql
level: middle
difficulty: 4
slug: postgresql-kak-optimizirovat-medlennyi-sql-zapros
tags: query-planning
```

TODO

## Как найти долгие запросы?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-naiti-dolgie-zaprosy
tags: query-planning
```

TODO

## Что такое `pg_stat_activity`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-pg-stat-activity
```

TODO

## Что такое `pg_locks`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-pg-locks
tags: locking
```

TODO

## Что такое stored procedure?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-stored-procedure
```

TODO

## Что такое PostgreSQL function?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-postgresql-function
```

TODO

## Function vs procedure?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-function-vs-procedure
```

TODO

## Когда стоит использовать PL/pgSQL?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kogda-stoit-ispolzovat-pl-pgsql
```

TODO

## Что такое JSONB?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-jsonb
tags: jsonb
```

TODO

## JSON vs JSONB?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-json-vs-jsonb
tags: jsonb
```

TODO

## Как индексировать JSONB?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-indeksirovat-jsonb
tags: indexes, jsonb
```

TODO

## Что такое partitioning?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-partitioning
tags: partitioning
```

TODO

## Когда использовать partitioning?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kogda-ispolzovat-partitioning
tags: partitioning
```

TODO

## Что такое materialized view?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-materialized-view
```

TODO

## View vs materialized view?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-view-vs-materialized-view
```

TODO

## Как работать с большими таблицами?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-rabotat-s-bolshimi-tablicami
```

TODO

---

# Kafka / Message Brokers

## Что такое Apache Kafka?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-apache-kafka
tags: kafka
```

TODO

## Что такое topic?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-topic
tags: kafka
```

TODO

## Что такое partition?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-partition
tags: partitioning
```

TODO

## Что такое offset?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-offset
tags: kafka
```

TODO

## Что такое producer?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-producer
tags: kafka
```

TODO

## Что такое consumer?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-consumer
tags: kafka
```

TODO

## Что такое consumer group?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-consumer-group
tags: kafka
```

TODO

## Как consumer group распределяет partitions?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-consumer-group-raspredelyaet-partitions
tags: partitioning, kafka
```

TODO

## Что произойдёт, если consumers больше, чем partitions?

```yaml
category: kafka
level: middle
difficulty: 4
slug: kafka-chto-proizoidet-esli-consumers-bolshe-chem-partitions
tags: partitioning, kafka
```

TODO

## Как Kafka обеспечивает порядок сообщений?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-kafka-obespechivaet-poryadok-soobschenii
tags: kafka
```

TODO

## Гарантируется ли порядок сообщений во всём topic?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-garantiruetsya-li-poryadok-soobschenii-vo-vsem-topic
tags: kafka
```

TODO

## Что произойдёт, если consumer упал?

```yaml
category: kafka
level: middle
difficulty: 4
slug: kafka-chto-proizoidet-esli-consumer-upal
tags: kafka
```

TODO

## Что такое consumer rebalance?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-consumer-rebalance
tags: kafka
```

TODO

## Что такое offset commit?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-offset-commit
tags: kafka
```

TODO

## Auto commit vs manual commit?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-auto-commit-vs-manual-commit
```

TODO

## Что такое at-most-once delivery?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-at-most-once-delivery
tags: idempotency
```

TODO

## Что такое at-least-once delivery?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-at-least-once-delivery
tags: idempotency
```

TODO

## Что такое exactly-once?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-exactly-once
tags: idempotency
```

TODO

## Почему в реальных системах часто используют at-least-once?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-pochemu-v-realnyh-sistemah-chasto-ispolzuyut-at-least-once
tags: idempotency
```

TODO

## Что такое idempotent consumer?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-idempotent-consumer
tags: kafka, idempotency
```

TODO

## Как сделать обработку Kafka message идемпотентной?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-sdelat-obrabotku-kafka-message-idempotentnoi
tags: kafka, idempotency
```

TODO

## Что такое retry?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-retry
tags: resilience
```

TODO

## Как реализовать retry для Kafka?

```yaml
category: kafka
level: middle
difficulty: 4
slug: kafka-kak-realizovat-retry-dlya-kafka
tags: kafka, resilience
```

TODO

## Что такое Dead Letter Topic / Queue?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-dead-letter-topic-queue
tags: kafka, data-structures
```

TODO

## Что делать с poison message?

```yaml
category: kafka
level: middle
difficulty: 4
slug: kafka-chto-delat-s-poison-message
tags: kafka
```

TODO

## Как масштабировать Kafka consumers?

```yaml
category: kafka
level: middle
difficulty: 4
slug: kafka-kak-masshtabirovat-kafka-consumers
tags: kafka, scalability
```

TODO

## Что такое producer acknowledgement (`acks`)?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-producer-acknowledgement-acks
tags: kafka
```

TODO

## Что такое replication factor?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-replication-factor
tags: replication
```

TODO

## Что такое leader и follower partition replicas?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-leader-i-follower-partition-replicas
tags: partitioning, replication
```

TODO

## Что такое ISR?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-isr
tags: replication
```

TODO

## Что происходит при падении Kafka broker?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-chto-proishodit-pri-padenii-kafka-broker
tags: kafka
```

TODO

## Как гарантировать отсутствие потери сообщений?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-garantirovat-otsutstvie-poteri-soobschenii
```

TODO

## Что такое idempotent producer?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-idempotent-producer
tags: kafka, idempotency
```

TODO

## Что такое transactions в Kafka?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-transactions-v-kafka
tags: transactions, kafka
```

TODO

## Kafka vs RabbitMQ?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kafka-vs-rabbitmq
tags: kafka
```

TODO

## Когда выбрать Kafka, а когда RabbitMQ?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kogda-vybrat-kafka-a-kogda-rabbitmq
tags: kafka
```

TODO

## Как обеспечить порядок обработки событий?

```yaml
category: kafka
level: middle
difficulty: 4
slug: kafka-kak-obespechit-poryadok-obrabotki-sobytii
```

TODO

## Как обрабатывать дубликаты сообщений?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-obrabatyvat-dublikaty-soobschenii
tags: sql
```

TODO

## Как изменить количество partitions?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-izmenit-kolichestvo-partitions
tags: partitioning
```

TODO

## Как мониторить Kafka consumer lag?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-monitorit-kafka-consumer-lag
tags: kafka
```

TODO

---

# Microservices

## Что такое микросервисная архитектура?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-mikroservisnaya-arhitektura
tags: microservices
```

TODO

## Монолит vs микросервисы?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-monolit-vs-mikroservisy
tags: microservices
```

TODO

## Когда микросервисы не нужны?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-kogda-mikroservisy-ne-nuzhny
tags: microservices
```

TODO

## Как определить границы микросервисов?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-kak-opredelit-granicy-mikroservisov
tags: microservices
```

TODO

## Что такое bounded context?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-bounded-context
tags: microservices
```

TODO

## Как микросервисы взаимодействуют между собой?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-kak-mikroservisy-vzaimodeistvuyut-mezhdu-soboi
tags: microservices
```

TODO

## REST vs gRPC?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-rest-vs-grpc
tags: api-design, microservices
```

TODO

## Synchronous vs asynchronous communication?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-synchronous-vs-asynchronous-communication
tags: async, synchronization
```

TODO

## Что такое API Gateway?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-api-gateway
tags: microservices
```

TODO

## Что такое Service Discovery?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-service-discovery
tags: microservices
```

TODO

## Что такое Circuit Breaker?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-circuit-breaker
tags: resilience
```

TODO

## Что такое Retry?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-retry
tags: resilience
```

TODO

## Почему retry может быть опасен?

```yaml
category: microservices
level: middle
difficulty: 4
slug: microservices-pochemu-retry-mozhet-byt-opasen
tags: resilience
```

TODO

## Что такое Timeout?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-timeout
tags: resilience
```

TODO

## Что такое Bulkhead pattern?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-bulkhead-pattern
tags: resilience
```

TODO

## Что такое idempotency?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-idempotency
tags: idempotency
```

TODO

## Как сделать API idempotent?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-kak-sdelat-api-idempotent
tags: idempotency
```

TODO

## Что такое distributed transaction?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-distributed-transaction
tags: transactions, consistency
```

TODO

## Почему distributed transactions сложны?

```yaml
category: microservices
level: middle
difficulty: 4
slug: microservices-pochemu-distributed-transactions-slozhny
tags: transactions, consistency
```

TODO

## Что такое Saga Pattern?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-saga-pattern
tags: consistency
```

TODO

## Choreography vs Orchestration?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-choreography-vs-orchestration
tags: consistency
```

TODO

## Что такое Outbox Pattern?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-outbox-pattern
tags: consistency
```

TODO

## Что такое Inbox Pattern?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-inbox-pattern
tags: consistency
```

TODO

## Что такое eventual consistency?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-eventual-consistency
tags: consistency
```

TODO

## Как обеспечить консистентность между сервисами?

```yaml
category: microservices
level: middle
difficulty: 4
slug: microservices-kak-obespechit-konsistentnost-mezhdu-servisami
tags: consistency
```

TODO

## Что такое distributed lock?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-distributed-lock
tags: synchronization
```

TODO

## Когда нужен distributed lock?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-kogda-nuzhen-distributed-lock
tags: synchronization
```

TODO

## Redis как distributed lock — какие проблемы?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-redis-kak-distributed-lock-kakie-problemy
tags: synchronization, caching
```

TODO

## Где использовать cache?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-gde-ispolzovat-cache
tags: caching
```

TODO

## Cache-aside pattern?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-cache-aside-pattern
tags: caching
```

TODO

## Write-through vs Write-behind cache?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-write-through-vs-write-behind-cache
tags: caching
```

TODO

## Что такое cache stampede?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-cache-stampede
tags: caching
```

TODO

## Что такое cache invalidation?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-cache-invalidation
tags: caching
```

TODO

## Как масштабировать микросервис?

```yaml
category: microservices
level: middle
difficulty: 4
slug: microservices-kak-masshtabirovat-mikroservis
tags: scalability, microservices
```

TODO

## Horizontal vs vertical scaling?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-horizontal-vs-vertical-scaling
tags: scalability
```

TODO

## Как обнаруживать падение сервиса?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-kak-obnaruzhivat-padenie-servisa
```

TODO

## Что такое health check?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-health-check
tags: observability
```

TODO

## Liveness vs readiness?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-liveness-vs-readiness
tags: observability
```

TODO

## Что такое observability?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-observability
tags: observability
```

TODO

## Logs vs metrics vs traces?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-logs-vs-metrics-vs-traces
tags: observability
```

TODO

## Что такое distributed tracing?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-distributed-tracing
```

TODO

## Как передавать correlation ID между сервисами?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-kak-peredavat-correlation-id-mezhdu-servisami
tags: observability
```

TODO

## Как обрабатывать повторные сообщения?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-kak-obrabatyvat-povtornye-soobscheniya
```

TODO

## Как проектировать API между микросервисами?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-kak-proektirovat-api-mezhdu-mikroservisami
tags: microservices
```

TODO

## Как версионировать API?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-kak-versionirovat-api
```

TODO

## Как мигрировать монолит на микросервисы?

```yaml
category: microservices
level: middle
difficulty: 4
slug: microservices-kak-migrirovat-monolit-na-mikroservisy
tags: microservices
```

TODO

## Что такое Strangler Fig Pattern?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-strangler-fig-pattern
tags: microservices
```

TODO

## Как тестировать микросервисы?

```yaml
category: microservices
level: middle
difficulty: 3
slug: microservices-kak-testirovat-mikroservisy
tags: microservices
```

TODO

## Что такое contract testing?

```yaml
category: microservices
level: middle
difficulty: 2
slug: microservices-chto-takoe-contract-testing
```

TODO

## Как обеспечить отказоустойчивость микросервисной системы?

```yaml
category: microservices
level: middle
difficulty: 4
slug: microservices-kak-obespechit-otkazoustoichivost-mikroservisnoi-sistemy
tags: resilience, microservices
```

TODO

---

# Algorithms / Data Structures

## Что такое Big O?

```yaml
category: algorithms
level: middle
difficulty: 2
slug: algorithms-chto-takoe-big-o
tags: complexity
```

TODO

## Как оценить сложность алгоритма?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-ocenit-slozhnost-algoritma
tags: complexity
```

TODO

## Что такое O(1), O(log n), O(n), O(n log n), O(n²)?

```yaml
category: algorithms
level: middle
difficulty: 2
slug: algorithms-chto-takoe-o-1-o-log-n-o-n-o-n-log-n-o-n
tags: complexity
```

TODO

## Сложность поиска в `Dictionary`?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-slozhnost-poiska-v-dictionary
tags: collections, complexity
```

TODO

## Сложность поиска в `List`?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-slozhnost-poiska-v-list
tags: complexity
```

TODO

## Сложность добавления элемента в `List`?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-slozhnost-dobavleniya-elementa-v-list
tags: complexity
```

TODO

## Как работает binary search?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-rabotaet-binary-search
tags: complexity
```

TODO

## Какая сложность binary search?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kakaya-slozhnost-binary-search
tags: complexity
```

TODO

## Как работает bubble sort?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-rabotaet-bubble-sort
tags: complexity
```

TODO

## Как работает quicksort?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-rabotaet-quicksort
tags: complexity
```

TODO

## Как работает mergesort?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-rabotaet-mergesort
tags: complexity
```

TODO

## Чем quicksort отличается от mergesort?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-chem-quicksort-otlichaetsya-ot-mergesort
tags: complexity
```

TODO

## Что такое stack?

```yaml
category: algorithms
level: middle
difficulty: 2
slug: algorithms-chto-takoe-stack
tags: data-structures
```

TODO

## Что такое queue?

```yaml
category: algorithms
level: middle
difficulty: 2
slug: algorithms-chto-takoe-queue
tags: data-structures
```

TODO

## Что такое linked list?

```yaml
category: algorithms
level: middle
difficulty: 2
slug: algorithms-chto-takoe-linked-list
tags: data-structures
```

TODO

## Что такое hash table?

```yaml
category: algorithms
level: middle
difficulty: 2
slug: algorithms-chto-takoe-hash-table
tags: data-structures
```

TODO

## Как найти дубликаты в массиве?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-naiti-dublikaty-v-massive
tags: sql
```

TODO

## Как найти первый уникальный символ в строке?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-naiti-pervyi-unikalnyi-simvol-v-stroke
```

TODO

## Как проверить, является ли строка palindrome?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-proverit-yavlyaetsya-li-stroka-palindrome
```

TODO

## Как развернуть строку?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-razvernut-stroku
```

TODO

## Как найти два числа с заданной суммой?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-naiti-dva-chisla-s-zadannoi-summoi
```

TODO

## Что такое Two Pointers?

```yaml
category: algorithms
level: middle
difficulty: 2
slug: algorithms-chto-takoe-two-pointers
tags: complexity
```

TODO

## Что такое Sliding Window?

```yaml
category: algorithms
level: middle
difficulty: 2
slug: algorithms-chto-takoe-sliding-window
tags: complexity
```

TODO

## Как найти максимальную сумму подмассива?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-naiti-maksimalnuyu-summu-podmassiva
```

TODO

## Как найти пересечение двух массивов?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-naiti-peresechenie-dvuh-massivov
```

TODO

## Как объединить два отсортированных массива?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-obedinit-dva-otsortirovannyh-massiva
```

TODO

## Как найти пропущенное число?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-naiti-propuschennoe-chislo
```

TODO

## Как проверить корректность скобок?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-proverit-korrektnost-skobok
```

TODO

## Как реализовать LRU Cache?

```yaml
category: algorithms
level: middle
difficulty: 4
slug: algorithms-kak-realizovat-lru-cache
tags: caching, data-structures
```

TODO

## Как найти top K элементов?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-naiti-top-k-elementov
```

TODO

## Когда использовать `Dictionary`, а когда `HashSet`?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kogda-ispolzovat-dictionary-a-kogda-hashset
tags: collections
```

TODO

## Как оценить память, которую использует алгоритм?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kak-ocenit-pamyat-kotoruyu-ispolzuet-algoritm
```

TODO

## Что такое recursion?

```yaml
category: algorithms
level: middle
difficulty: 2
slug: algorithms-chto-takoe-recursion
tags: complexity
```

TODO

## Какие проблемы могут возникнуть при глубокой рекурсии?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kakie-problemy-mogut-vozniknut-pri-glubokoi-rekursii
tags: complexity
```

TODO

## Что такое BFS?

```yaml
category: algorithms
level: middle
difficulty: 2
slug: algorithms-chto-takoe-bfs
tags: complexity
```

TODO

## Что такое DFS?

```yaml
category: algorithms
level: middle
difficulty: 2
slug: algorithms-chto-takoe-dfs
tags: complexity
```

TODO

## Чем BFS отличается от DFS?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-chem-bfs-otlichaetsya-ot-dfs
tags: complexity
```

TODO

## Когда использовать BFS?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kogda-ispolzovat-bfs
tags: complexity
```

TODO

## Когда использовать DFS?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kogda-ispolzovat-dfs
tags: complexity
```

TODO

## Какие алгоритмы обычно спрашивают на Middle backend interview?

```yaml
category: algorithms
level: middle
difficulty: 3
slug: algorithms-kakie-algoritmy-obychno-sprashivayut-na-middle-backend-interview
```

TODO

---

# System Design

<!-- Общие вопросы -->

## Что такое System Design?

```yaml
category: system-design
level: middle
difficulty: 2
slug: system-design-chto-takoe-system-design
```

TODO

## Как начать проектирование системы?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-nachat-proektirovanie-sistemy
```

TODO

## Какие требования нужно собрать перед проектированием?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kakie-trebovaniya-nuzhno-sobrat-pered-proektirovaniem
```

TODO

## Functional vs non-functional requirements?

```yaml
category: system-design
level: middle
difficulty: 3
slug: system-design-functional-vs-non-functional-requirements
```

TODO

## Как оценить нагрузку системы?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-ocenit-nagruzku-sistemy
tags: scalability
```

TODO

## Что такое RPS/QPS?

```yaml
category: system-design
level: middle
difficulty: 2
slug: system-design-chto-takoe-rps-qps
tags: scalability
```

TODO

## Как оценить количество пользователей?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-ocenit-kolichestvo-polzovatelei
```

TODO

## Как оценить storage requirements?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-ocenit-storage-requirements
```

TODO

## Как оценить network bandwidth?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-ocenit-network-bandwidth
tags: scalability
```

TODO

## Что такое bottleneck?

```yaml
category: system-design
level: middle
difficulty: 2
slug: system-design-chto-takoe-bottleneck
tags: scalability
```

TODO

<!-- Архитектура -->

## Как спроектировать REST API?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-sproektirovat-rest-api
tags: api-design, architecture
```

TODO

## Как выбрать database?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-vybrat-database
tags: architecture
```

TODO

## SQL vs NoSQL?

```yaml
category: system-design
level: middle
difficulty: 3
slug: system-design-sql-vs-nosql
tags: architecture
```

TODO

## Когда нужен Redis?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kogda-nuzhen-redis
tags: caching, architecture
```

TODO

## Когда нужен Kafka?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kogda-nuzhen-kafka
tags: kafka, architecture
```

TODO

## Когда нужен message broker?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kogda-nuzhen-message-broker
tags: kafka, architecture
```

TODO

## Как масштабировать API?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-masshtabirovat-api
tags: scalability, architecture
```

TODO

## Как масштабировать database?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-masshtabirovat-database
tags: scalability, architecture
```

TODO

## Что такое load balancer?

```yaml
category: system-design
level: middle
difficulty: 2
slug: system-design-chto-takoe-load-balancer
tags: scalability, architecture
```

TODO

## Что такое horizontal scaling?

```yaml
category: system-design
level: middle
difficulty: 2
slug: system-design-chto-takoe-horizontal-scaling
tags: scalability, architecture
```

TODO

## Что такое vertical scaling?

```yaml
category: system-design
level: middle
difficulty: 2
slug: system-design-chto-takoe-vertical-scaling
tags: scalability, architecture
```

TODO

## Что такое caching layer?

```yaml
category: system-design
level: middle
difficulty: 2
slug: system-design-chto-takoe-caching-layer
tags: architecture
```

TODO

## Как организовать CDN?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-organizovat-cdn
tags: scalability, architecture
```

TODO

## Как обеспечить high availability?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-obespechit-high-availability
tags: resilience, architecture
```

TODO

## Что такое failover?

```yaml
category: system-design
level: middle
difficulty: 2
slug: system-design-chto-takoe-failover
tags: resilience, architecture
```

TODO

## Что такое replication?

```yaml
category: system-design
level: middle
difficulty: 2
slug: system-design-chto-takoe-replication
tags: replication, architecture
```

TODO

## Что такое sharding?

```yaml
category: system-design
level: middle
difficulty: 2
slug: system-design-chto-takoe-sharding
tags: partitioning, architecture
```

TODO

## Что такое partitioning?

```yaml
category: system-design
level: middle
difficulty: 2
slug: system-design-chto-takoe-partitioning
tags: partitioning, architecture
```

TODO

## Как обеспечить data consistency?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-obespechit-data-consistency
tags: architecture
```

TODO

## Как обеспечить fault tolerance?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-obespechit-fault-tolerance
tags: resilience, architecture
```

TODO

<!-- Практические задачи -->

## Спроектировать сервис заказов.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-servis-zakazov
tags: practice
```

TODO

## Спроектировать сервис корзины.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-servis-korziny
tags: practice
```

TODO

## Спроектировать сервис доставки.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-servis-dostavki
tags: practice
```

TODO

## Спроектировать notification service.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-notification-service
tags: practice
```

TODO

## Спроектировать URL shortener.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-url-shortener
tags: practice
```

TODO

## Спроектировать file storage service.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-file-storage-service
tags: practice
```

TODO

## Спроектировать систему обработки платежей.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-sistemu-obrabotki-platezhei
tags: practice
```

TODO

## Спроектировать систему рекомендаций.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-sistemu-rekomendacii
tags: practice
```

TODO

## Спроектировать сервис отслеживания посылок.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-servis-otslezhivaniya-posylok
tags: practice
```

TODO

## Спроектировать систему массовой рассылки.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-sistemu-massovoi-rassylki
tags: practice
```

TODO

## Спроектировать систему обработки 10 000+ RPS.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-sistemu-obrabotki-10-000-rps
tags: scalability, practice
```

TODO

## Спроектировать сервис с Kafka.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-servis-s-kafka
tags: kafka, practice
```

TODO

## Спроектировать систему с PostgreSQL + Redis + Kafka.

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-sproektirovat-sistemu-s-postgresql-redis-kafka
tags: kafka, caching, practice
```

TODO

## Что произойдёт, если PostgreSQL станет недоступен?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-chto-proizoidet-esli-postgresql-stanet-nedostupen
tags: practice
```

TODO

## Что произойдёт, если Kafka станет недоступна?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-chto-proizoidet-esli-kafka-stanet-nedostupna
tags: kafka, practice
```

TODO

## Что делать при росте нагрузки в 10 раз?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-chto-delat-pri-roste-nagruzki-v-10-raz
tags: scalability, practice
```

TODO

## Как обеспечить idempotency в распределённой системе?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-obespechit-idempotency-v-raspredelennoi-sisteme
tags: idempotency, practice
```

TODO

## Как реализовать retry без создания лавины запросов?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-realizovat-retry-bez-sozdaniya-laviny-zaprosov
tags: resilience, practice
```

TODO

## Как обеспечить observability?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-obespechit-observability
tags: observability, practice
```

TODO

## Как обнаружить и устранить bottleneck?

```yaml
category: system-design
level: middle
difficulty: 4
slug: system-design-kak-obnaruzhit-i-ustranit-bottleneck
tags: scalability, practice
```

TODO
