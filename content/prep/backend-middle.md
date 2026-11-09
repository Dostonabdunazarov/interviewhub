---
title: Backend .NET — Middle
slug: backend-middle
role: backend
roleName: Backend .NET
level: middle
sortOrder: 1
summary: Пошаговый план подготовки к собеседованию на Middle Backend .NET: что именно спрашивают по C#, async, EF Core, PostgreSQL и микросервисам, и какие вопросы, статьи и задачи прорабатывать в каком порядке.
---

# Вступление

Гайд рассчитан на разработчика с 2–4 годами коммерческого опыта на .NET, который идёт на позицию Middle Backend. Он подойдёт и тому, кто уже работает Middle, но давно не проходил собеседования и хочет быстро восстановить базу.

От Middle ждут не энциклопедических знаний, а самостоятельности. Вы берёте задачу без детального ТЗ, понимаете, как работает код под капотом, находите причину бага в проде и можете объяснить, почему выбрали одно решение, а не другое. Junior отвечает «как это делается», Middle отвечает «как это работает и чем придётся заплатить».

Конкретно это значит:

- уверенно владеть языком и рантаймом: типы, коллекции, LINQ, память и сборка мусора;
- писать корректный асинхронный и многопоточный код и знать типичные ловушки;
- строить Web API на ASP.NET Core: pipeline, DI, конфигурация, аутентификация, обработка ошибок;
- работать с БД: EF Core без N+1, SQL с джойнами и оконными функциями, индексы, план запроса, транзакции;
- понимать основы архитектуры и распределённых систем: SOLID, паттерны, микросервисы, брокеры сообщений;
- решать несложные алгоритмические задачи и оценивать сложность.

**Как пользоваться гайдом**

- Темы идут в порядке изучения: от языка к рантайму, затем веб, данные, архитектура. Если есть сильные и слабые стороны, начните со слабых, но хотя бы раз пройдите все темы.
- В каждой теме сначала прочитайте чек-лист «Что нужно знать» и честно отметьте, что можете объяснить вслух без подглядывания. Затем идите по вопросам от простых к сложным, читайте статьи по пробелам и решайте задачи на код.
- Бюджет времени: 3–6 недель при 1–2 часах в день. Три недели хватит, если опыт свежий и вы закрываете пробелы. Шесть недель нужны, если вы давно не трогали SQL, многопоточность или алгоритмы.
- Раз в неделю проговаривайте ответы вслух или записывайте на диктофон. Знание «в голове» и умение связно объяснить за две минуты — разные навыки.

**Какой глубины достаточно**

Достаточно уровня «объясню механизм и приведу пример из практики». Для async/await это означает: понимаю state machine, знаю, где возвращается управление, могу объяснить дедлок на `.Result`. Не нужно помнить внутренности `ConcurrentDictionary` или флаги JIT. Если вопрос уходит глубже, нормально сказать «дальше я не копал, но предположу так» и рассуждать. Это лучше, чем уверенная выдумка.

# Формат собеседования

Типичный процесс на Middle Backend .NET занимает 2–4 этапа за 1–3 недели. Ниже описаны все возможные этапы, но компании часто объединяют или пропускают часть из них: например, скрининг проводит тимлид, а SQL и дизайн входят в техническое интервью.

**1. HR или скрининг, 20–30 минут.** Проверяют мотивацию, стек, ожидания по деньгам и формату, английский (иногда). Готовьте рассказ о себе на 2 минуты: где работали, какие задачи делали, чем гордитесь. Называйте масштаб: нагрузка, размер команды, объём данных.

**2. Техническое интервью по .NET и C#, 60–90 минут.** Самый плотный этап. Спрашивают типы, коллекции, LINQ, async, многопоточность, GC, ASP.NET Core, EF Core. Идут от простого к сложному, пока не найдут границу знаний. Часто цепляются за технологии из вашего резюме, поэтому не пишите то, что не готовы обсуждать.

**3. Live coding или алгоритмы, 45–60 минут.** Одна-две задачи уровня «два указателя», «хеш-таблица», «скобочная последовательность», «LRU-кэш», иногда небольшая прикладная задача (пагинация, парсинг, rate limiter). Проверяют ход мысли, чистоту кода, умение тестировать себя на примерах и называть сложность.

**4. База данных и SQL, 30–45 минут.** Иногда отдельный этап, иногда часть технического. Джойны, группировки, оконные функции, индексы, `EXPLAIN`, транзакции и уровни изоляции. Часто дают таблицы и просят написать запрос.

**5. Системный дизайн, 30–60 минут.** Для Middle обычно облегчённый: спроектировать сервис уведомлений, сокращатель ссылок, корзину. Не ждут идеальной архитектуры, ждут уточняющих вопросов, оценки нагрузки, выбора хранилища и осознанных компромиссов.

**6. Разговор с тимлидом или командой, 30–60 минут.** Опыт работы в команде, конфликты, ошибки в проде, приоритизация, code review. Используйте формат STAR: ситуация, задача, действие, результат.

**Чем Middle отличается от Junior в глазах интервьюера**

- Junior знает определения, Middle объясняет причины и последствия: не «`Scoped` живёт на запрос», а «почему нельзя внедрить `Scoped` в `Singleton` и как это проявится».
- Middle приводит примеры из практики: «у нас был N+1 в отчёте, нашли по логам SQL, решили проекцией».
- Middle называет компромиссы: кэш ускоряет чтение, но создаёт проблему инвалидации.
- Middle не боится сказать «не знаю», но тут же предлагает, как бы это выяснил.

**Типичные ошибки**

- Заученные ответы без понимания: стоит задать уточняющий вопрос, и разговор рассыпается.
- Молчаливое решение задачи. Интервьюер не видит мышления и ставит минимальную оценку.
- Сразу писать код без уточнения условий: размер входа, граничные случаи, допустимы ли дубликаты.
- Уверенная ложь вместо «не уверен, но думаю так».
- Критика прошлых работодателей и коллег.
- Отсутствие вопросов к компании в конце интервью.

**Как отвечать**

- Структура ответа: определение в одну фразу, как работает, пример или когда применяется, подвох или компромисс.
- Думайте вслух: «Первое, что приходит в голову, это перебор за O(n²). Можно лучше через хеш-таблицу за O(n) ценой дополнительной памяти».
- В задачах сначала пример и граничные случаи, потом решение, потом прогон по примеру и оценка сложности.
- На вопрос «что лучше» отвечайте «зависит от…» и называйте критерии: нагрузка, консистентность, сложность поддержки.

**Вопросы, которые стоит задать компании**

- Как устроен процесс разработки: ревью, тесты, релизы, кто и как дежурит по продакшену?
- Какой стек и какая доля легаси? Как работаете с техдолгом?
- Как выглядит типичная задача Middle и какая у него зона ответственности?
- Как измеряете качество: метрики, алерты, разбор инцидентов?
- Как устроен онбординг и что ожидаете от меня через 3 месяца?

## C# и система типов

```yaml
slug: csharp-types
questions: csharp-chto-takoe-value-type-i-reference-type, csharp-chem-class-otlichaetsya-ot-struct, csharp-gde-hranyatsya-value-types-i-reference-types-v-stack-ili-heap, csharp-chto-takoe-boxing-i-unboxing, csharp-kogda-proishodit-boxing, csharp-chto-budet-pri-sravnenii-dvuh-struct, csharp-chem-otlichayutsya-equals-referenceequals-i, csharp-dlya-chego-nuzhen-gethashcode, csharp-chto-takoe-immutable-object-i-zachem-on-nuzhen, csharp-chem-otlichayutsya-record-class-i-struct, csharp-chto-takoe-init-accessor, csharp-chto-takoe-nullable-reference-types
articles: value-type-i-reference-type, upakovka-i-raspakovka, class-struct-record, equals-gethashcode-operator, nullable-reference-types
puzzles: peredacha-struct-i-class-v-metod, struktura-v-spiske-i-massive, ravenstvo-record-i-anonimnyh-tipov, nullable-i-operator-coalesce
```

**Что нужно знать**

- Value type хранит данные «по месту» (в стеке, в поле объекта или в массиве), reference type хранит ссылку на объект в куче. «Struct всегда в стеке» неверно.
- Копирование: структура копируется целиком при присваивании и передаче в метод, класс передаёт копию ссылки.
- Boxing и unboxing: когда возникает (приведение к `object` или интерфейсу, вызовы non-generic API), чем грозит (аллокации, нагрузка на GC).
- Когда выбирать struct: маленький (до 16 байт), неизменяемый, короткоживущий тип. Почему изменяемые структуры опасны.
- Равенство: `==`, `Equals`, `ReferenceEquals`; как по умолчанию сравниваются классы, структуры и record.
- Контракт `Equals` и `GetHashCode`: равные объекты обязаны давать равный хеш; почему нельзя менять поля, входящие в хеш, пока объект лежит в `Dictionary`.
- `record`: value-семантика равенства, `with`-выражения, `init`-свойства, `record struct`.
- Immutable-объекты: зачем нужны (потокобезопасность, предсказуемость), как делаются.
- Nullable reference types: что это (аннотации для компилятора, а не проверки в рантайме), операторы `?`, `!`, `??`, `?.`.
- Разница между `Nullable<T>` (`int?`) и nullable reference types.
- Обобщения: ограничения (`where T : class/struct/new()/интерфейс`), отсутствие boxing у `List<int>`, один JIT-код для ссылочных типов и отдельная специализация для value types, `default(T)`, `EqualityComparer<T>.Default`.
- `default`, значения по умолчанию, `ref`-семантика на базовом уровне.

**На чём валятся**

- Говорят «структуры живут в стеке, классы в куче» и не могут объяснить случай поля структуры внутри класса.
- Переопределяют `Equals` и забывают `GetHashCode`, не понимают последствий для `Dictionary` и `HashSet`.
- Путают `record class` и `record struct`, не знают, что `with` создаёт копию.
- Считают `string?` проверкой на null в рантайме.

## Язык C#: строки, делегаты, современные возможности

```yaml
slug: csharp-language
questions: csharp-chem-otlichayutsya-const-readonly-i-static-readonly, csharp-chto-delayut-ref-out-i-in, csharp-chem-otlichayutsya-string-i-stringbuilder, csharp-pochemu-string-immutable, csharp-chto-takoe-delegates, csharp-chto-takoe-events, csharp-chem-otlichayutsya-action-func-i-predicate, csharp-chto-takoe-lambda-expression, csharp-chto-takoe-extension-methods, csharp-chto-takoe-pattern-matching-v-c, csharp-chto-takoe-covariance-i-contravariance, csharp-chto-takoe-span-t-i-memory-t
articles: stroki-i-stringbuilder, delegaty-i-sobytiya, pattern-matching, kovariantnost, span-i-memory
puzzles: internirovanie-strok, zamykanie-v-cikle-for, izmenenie-peremennoj-v-finally, perepolnenie-pri-umnozhenii
```

**Что нужно знать**

- `const` подставляется на этапе компиляции, `readonly` вычисляется в рантайме, `static readonly` инициализируется один раз на тип. Почему изменение `const` в библиотеке требует пересборки зависимых проектов.
- `ref`, `out`, `in`: что передаётся, когда это оправдано, чем `in` отличается от передачи по значению.
- Строки неизменяемы: что это даёт (потокобезопасность, интернирование, безопасные ключи) и чем платим (аллокации при конкатенации в цикле).
- Когда нужен `StringBuilder`, когда хватает интерполяции или `string.Join`.
- Делегаты: многоадресные, `Action`, `Func`, `Predicate`; чем событие отличается от публичного поля-делегата.
- Утечки через события: подписчик живёт столько же, сколько издатель, если не отписаться.
- Лямбды и замыкания: захват переменных, классическая ловушка с переменной цикла.
- Методы расширения: статические методы с особым синтаксисом вызова, где применяются (LINQ, DI-регистрация).
- Pattern matching: `is`, `switch`-выражения, property и relational patterns.
- Ковариантность и контравариантность: `IEnumerable<out T>`, `Action<in T>`, почему `List<T>` инвариантен.
- `Span<T>` и `Memory<T>`: срезы без копирования, ограничения `ref struct` (нельзя хранить в поле класса, нельзя держать через `await` и `yield`; с C# 13 локальные ref struct в async-методах и итераторах допустимы, если не живут через `await`/`yield`).
- `checked`/`unchecked`: что происходит при переполнении целых по умолчанию.

**На чём валятся**

- Не могут объяснить разницу между событием и делегатом, кроме «событие нельзя вызвать снаружи».
- Не видят захват переменной цикла в лямбде и не знают, как это изменилось для `foreach`.
- Конкатенируют строки в цикле и не понимают стоимости.
- Не знают, почему `Span<T>` нельзя использовать после `await`.

## Коллекции и LINQ

```yaml
slug: collections-linq
questions: csharp-chem-array-otlichaetsya-ot-list-t, csharp-chem-list-t-otlichaetsya-ot-linkedlist-t, csharp-chem-otlichayutsya-ienumerable-icollection-i-ilist, csharp-kak-rabotaet-dictionary, csharp-kak-rabotaet-hashset, csharp-pochemu-nelzya-izmenyat-obekt-poka-on-ispolzuetsya-kak-klyuch-dictiona, csharp-chto-takoe-linq-i-kak-on-vypolnyaetsya, csharp-chto-takoe-deferred-execution, csharp-chem-otlichayutsya-first-firstordefault-single-i-singleordefault, csharp-chem-otlichayutsya-ienumerable-i-iqueryable, csharp-chto-delaet-yield-return, csharp-chto-takoe-iasyncenumerable-t
articles: array-vs-list, kak-ustroen-dictionary, vybor-kollekcii, linq-i-otlozhennoe-vypolnenie, ienumerable-vs-iqueryable
puzzles: povtornoe-perechislenie-linq, validaciya-v-metode-iteratore
```

**Что нужно знать**

- `List<T>`: динамический массив, удвоение ёмкости, `Add` за амортизированное O(1), вставка в середину O(n), поиск O(n).
- `LinkedList<T>`: когда реально выигрывает (почти никогда на практике из-за кэша процессора и аллокаций).
- `Dictionary<TKey,TValue>`: хеш-таблица с корзинами, коллизии, поиск за O(1) в среднем, что происходит при ресайзе, почему порядок перечисления нельзя считать гарантированным.
- `HashSet<T>`: проверка принадлежности за O(1), операции над множествами.
- Иерархия интерфейсов `IEnumerable`, `ICollection`, `IList`, `IReadOnlyList`: что принимать в параметрах, что возвращать из методов.
- LINQ: отложенное (deferred) выполнение, что выполняется сразу (`ToList`, `Count`, `First`), что лениво (`Where`, `Select`).
- Множественное перечисление запроса: дублирование работы и побочных эффектов.
- `First`, `FirstOrDefault`, `Single`, `SingleOrDefault`: что и когда бросают.
- `IEnumerable` против `IQueryable`: где выполняется фильтр (в памяти или в БД), почему лямбда превращается в дерево выражений.
- `yield return`: итератор как автомат состояний, ленивость, проверка аргументов срабатывает только при первом `MoveNext`.
- `IAsyncEnumerable<T>` и `await foreach` для потоковой выдачи.
- Выбор коллекции под задачу: частый поиск, уникальность, очередь, стек, отсортированный доступ.

**На чём валятся**

- Не могут объяснить, как `Dictionary` ищет элемент при коллизии.
- Вызывают `Count()` и `ToList()` на запросе многократно, не замечая повторных выполнений.
- Возвращают `IQueryable` из репозитория и не понимают, где выполнится фильтр.
- Путают `Single` и `First` и получают исключение на проде.

## CLR, память и сборка мусора

```yaml
slug: clr-memory-gc
questions: clr-gc-chto-takoe-clr, clr-gc-chto-proishodit-s-c-kodom-ot-kompilyacii-do-vypolneniya, clr-gc-chto-takoe-jit, clr-gc-kak-rabotaet-garbage-collector, clr-gc-chto-takoe-gen-0-gen-1-i-gen-2, clr-gc-pochemu-v-net-ispolzuetsya-pokolencheskii-gc, clr-gc-chto-takoe-large-object-heap-loh, clr-gc-chto-takoe-gc-root, clr-gc-chto-takoe-memory-leak-v-net, clr-gc-chto-takoe-idisposable, clr-gc-chem-dispose-otlichaetsya-ot-finalizer, clr-gc-kak-umenshit-kolichestvo-allokacii
articles: clr-il-jit, kak-rabotaet-gc, pokoleniya-gen0-gen2, idisposable-using-finalizatory, utechki-pamyati
puzzles: poryadok-dispose-vo-vlozhennyh-using, podpiska-na-sobytie-dolgozhivushchego-obekta
```

**Что нужно знать**

- Путь кода: C# компилируется в IL внутри сборки, JIT компилирует IL в машинный код при первом вызове, tiered compilation, AOT и ReadyToRun как варианты.
- Managed и unmanaged память: что контролирует GC, а что нет (дескрипторы файлов, сокеты, нативные ресурсы).
- Как GC решает, что объект мёртв: достижимость от корней (GC roots: статические поля, стеки потоков, регистры, handles). Циклические ссылки не мешают сборке.
- Поколения Gen 0, 1, 2: почему молодые объекты умирают чаще, как объекты переходят в старшие поколения, чем дорога сборка Gen 2.
- LOH: объекты от 85 000 байт, почему большие аллокации вредят, фрагментация.
- Утечки в managed-коде: статические коллекции и кэши без ограничений, события, замыкания, `Timer`, забытый `Dispose`.
- `IDisposable` и `using`: детерминированное освобождение неуправляемых ресурсов, паттерн Dispose, `using` как `try/finally`.
- Финализатор: недетерминирован, замедляет сборку, нужен только как страховка для нативных ресурсов; `SafeHandle`.
- Server GC и Workstation GC, concurrent GC: общие представления.
- Как снижать аллокации: переиспользование (`ArrayPool`), структуры, `Span<T>`, отказ от boxing и лишней материализации LINQ.
- Как диагностировать память: `dotnet-counters`, дампы, профайлер; метрики GC (частота Gen 2, размер LOH).

**На чём валятся**

- Говорят «в .NET утечек не бывает», хотя утечки через события и статические кэши самые частые.
- Путают `Dispose` и финализатор, предлагают вызывать `GC.Collect()` как лекарство.
- Не знают про LOH и считают, что любой большой массив соберётся «как обычно».
- Не могут объяснить, зачем нужны поколения.

## async/await и Task

```yaml
slug: async-await
questions: async-kak-rabotaet-async-await, async-sozdaet-li-async-await-novyi-potok, async-chto-takoe-task, async-chem-task-otlichaetsya-ot-thread, async-chem-task-otlichaetsya-ot-valuetask, async-chto-takoe-cpu-bound-i-io-bound-operacii, async-kogda-nuzhen-task-run, async-chto-budet-esli-zabyt-await, async-pochemu-async-void-obychno-ispolzovat-ne-rekomenduetsya, async-chto-takoe-deadlock-pri-ispolzovanii-async-await, async-chto-delaet-configureawait-false, async-kak-pravilno-otmenyat-async-operation
articles: kak-rabotaet-async-await, state-machine, task-vs-thread-vs-valuetask, dedloki-na-result, cancellationtoken-i-taymauty
puzzles: async-sinhronnaya-chast-metoda, async-void-isklyuchenie, async-kogda-vyletaet-isklyuchenie, async-dedlok-result, async-isklyucheniya-task-whenall
```

**Что нужно знать**

- Компилятор превращает `async`-метод в автомат состояний. Код до первого незавершённого `await` выполняется синхронно в вызывающем потоке.
- `async/await` сам по себе не создаёт потоков. Для IO-операций поток освобождается на время ожидания.
- `Task` как обещание результата, отличие от `Thread`. `ValueTask`: когда экономит аллокацию и какие правила использования (нельзя ждать дважды).
- CPU-bound и IO-bound: `Task.Run` для вычислений, не для IO; почему `Task.Run` в серверном коде обычно лишний.
- Что происходит после `await`: продолжение выполняется в захваченном `SynchronizationContext` или в потоке пула.
- Дедлок на `.Result` и `.Wait()`: схема, почему в ASP.NET Core классического дедлока нет, но есть голодание пула потоков.
- `ConfigureAwait(false)`: что делает, где нужен (библиотеки), где не нужен (ASP.NET Core приложения).
- `async void` допустим только для обработчиков событий: исключение падает в контекст и может уронить процесс.
- Забытый `await`: «выстрелили и забыли», потерянные исключения, гонки.
- `Task.WhenAll`, `Task.WhenAny`, таймауты; как агрегируются исключения (`await` разворачивает первое).
- `CancellationToken`: кооперативная отмена, передача по всей цепочке вызовов, `OperationCanceledException`.
- Ограничение параллелизма async-задач: `SemaphoreSlim`, `Parallel.ForEachAsync`.

**На чём валятся**

- Утверждают, что `await` «запускает новый поток».
- Не объясняют, почему блокировка на `.Result` вредна в ASP.NET Core, если классического дедлока нет.
- Не прокидывают `CancellationToken` дальше контроллера.
- Не знают, что исключение из `async void` не поймать через `try/catch` снаружи.

## Многопоточность и синхронизация

```yaml
slug: multithreading
questions: multithreading-chem-process-otlichaetsya-ot-potoka, multithreading-kak-rabotaet-threadpool-v-net, multithreading-chto-takoe-concurrency-i-parallelism, multithreading-chto-takoe-race-condition, multithreading-chto-takoe-thread-safety, multithreading-chto-delaet-lock, multithreading-chto-takoe-interlocked, multithreading-kogda-ispolzovat-interlocked-a-kogda-lock, multithreading-chem-semaphore-otlichaetsya-ot-semaphoreslim, multithreading-chem-concurrentdictionary-otlichaetsya-ot-obychnogo-dictionary, multithreading-kak-izbezhat-deadlock, multithreading-pochemu-nelzya-delat-await-vnutri-obychnogo-lock
articles: processy-potoki-threadpool, race-condition, lock-i-monitor, deadlock-livelock-starvation, konkurentnye-kollekcii
puzzles: mnogopotochnost-gonka-na-inkremente, mnogopotochnost-dictionary-v-singleton, mnogopotochnost-lock-na-stroku
```

**Что нужно знать**

- Процесс и поток, стоимость потоков, зачем нужен ThreadPool и как он подбирает число потоков (hill climbing, голодание при блокировках).
- Concurrency (структурирование под одновременность) против parallelism (одновременное исполнение).
- Race condition: классический пример `counter++` и `check-then-act`, как их воспроизвести и исправить.
- `lock` как `Monitor.Enter/Exit` в `try/finally`: на чём блокировать (приватный объект, не `this`, не строка, не `Type`).
- `Interlocked` для атомарных операций над одной переменной и случаи, когда он не заменяет `lock`.
- `volatile` и видимость изменений: общее понимание (глубже относится к Senior).
- `Semaphore`, `SemaphoreSlim`, `Mutex`, `ReaderWriterLockSlim`: что для чего.
- Потокобезопасные коллекции: `ConcurrentDictionary` (и почему `GetOrAdd` не гарантирует однократный вызов фабрики), `ConcurrentQueue`, `BlockingCollection`, `Channel<T>`.
- Deadlock: четыре условия, пример с двумя замками, способы избежать (единый порядок, таймауты, отказ от вложенных блокировок).
- `await` внутри `lock` запрещён; асинхронная синхронизация через `SemaphoreSlim.WaitAsync`.
- Паттерн producer-consumer на `Channel<T>`.
- `Parallel.ForEach` и PLINQ: когда оправданы (CPU-bound, независимые итерации).

**На чём валятся**

- Блокируют на `this` или строках и не видят риска.
- Используют обычный `Dictionary` из нескольких потоков («у нас же только чтение», а запись есть при инициализации).
- Не отличают потокобезопасность коллекции от атомарности составной операции.
- Не могут нарисовать схему deadlock.

## ASP.NET Core: pipeline, DI и конфигурация

```yaml
slug: aspnet-core-foundations
questions: aspnet-core-kak-ustroen-request-pipeline-v-asp-net-core, aspnet-core-chto-takoe-middleware, aspnet-core-v-kakom-poryadke-vypolnyayutsya-middleware, aspnet-core-chto-proizoidet-esli-middleware-ne-vyzovet-next, aspnet-core-chto-takoe-dependency-injection, aspnet-core-chem-otlichayutsya-transient-scoped-i-singleton, aspnet-core-pochemu-nelzya-napryamuyu-vnedryat-scoped-servis-v-singleton, aspnet-core-kak-ustroena-konfiguraciya-asp-net-core, aspnet-core-chto-takoe-options-pattern, aspnet-core-chto-takoe-ioptions-ioptionssnapshot-i-ioptionsmonitor, aspnet-core-kak-rabotaet-logging, aspnet-core-chto-takoe-structured-logging
articles: aspnet-pipeline-i-middleware, aspnet-di-i-zhiznennye-cikly, aspnet-konfiguraciya-i-options
puzzles: aspnet-core-poryadok-middleware, aspnet-core-captive-dependency
```

**Что нужно знать**

- Запрос проходит цепочку middleware (`Use`, `Run`, `Map`), каждый может обработать запрос, передать дальше через `next` или прервать конвейер (short-circuit).
- Порядок важен: обработка исключений, HTTPS, статические файлы, routing, CORS, authentication, authorization, endpoints.
- Как написать собственный middleware: класс с `InvokeAsync` или встроенная лямбда.
- DI: регистрация, constructor injection, три времени жизни. `Scoped` живёт на запрос, `Singleton` на приложение, `Transient` создаётся при каждом запросе к контейнеру.
- Captive dependency: `Scoped` в `Singleton` фактически превращается в `Singleton`; как обойти через `IServiceScopeFactory`.
- Проверки контейнера: `ValidateScopes` ловит получение `Scoped`-сервиса из корневого провайдера (в момент резолва), `ValidateOnBuild` проверяет весь граф зависимостей при построении контейнера на старте; оба включены по умолчанию в Development.
- Конфигурация: слои провайдеров (`appsettings.json`, `appsettings.{Environment}.json`, user secrets, переменные окружения, аргументы командной строки) и приоритеты, смена окружения.
- Options pattern: `IOptions` (однократно), `IOptionsSnapshot` (на запрос), `IOptionsMonitor` (с уведомлением об изменениях), валидация опций.
- Логирование: уровни, провайдеры, категории; structured logging с шаблонами сообщений вместо конкатенации.
- Хранение секретов: не в репозитории, user secrets для разработки, переменные окружения и хранилище секретов на проде.

**На чём валятся**

- Не помнят порядок middleware и не могут объяснить, почему CORS или authorization «не срабатывают».
- Внедряют `DbContext` в `Singleton` и не понимают, откуда берётся странное поведение.
- Путают три варианта `IOptions`.
- Пишут `logger.LogInformation($"User {id}")` и не видят проблемы.

## Web API: контроллеры, безопасность, ошибки и фоновые задачи

```yaml
slug: aspnet-core-web-api
questions: aspnet-core-controller-vs-minimal-api, aspnet-core-kakie-byvayut-filters-v-asp-net-core, aspnet-core-middleware-vs-filter-v-chem-raznica, aspnet-core-chto-takoe-model-validation, aspnet-core-authentication-vs-authorization, aspnet-core-kak-rabotaet-jwt-authentication, aspnet-core-chto-takoe-cors, aspnet-core-chto-takoe-rest, aspnet-core-kakie-http-methods-yavlyayutsya-idempotent, aspnet-core-kakie-http-status-codes-nuzhno-znat-backend-razrabotchiku, aspnet-core-kak-globalno-obrabatyvat-isklyucheniya, aspnet-core-chem-ihostedservice-otlichaetsya-ot-backgroundservice
articles: minimal-api-vs-kontrollery, aspnet-filtry, aspnet-autentifikaciya-i-jwt, aspnet-dizayn-api-i-versionirovanie, aspnet-health-checks
puzzles: aspnet-core-new-httpclient-na-zapros
```

**Что нужно знать**

- Контроллеры и Minimal API: что выбрать, когда и почему (фильтры, структура, производительность).
- Фильтры (authorization, resource, action, exception, result) и их отличие от middleware: фильтры работают внутри MVC и знают контекст действия.
- Model binding и валидация: атрибуты, `[ApiController]` и автоматический 400, FluentValidation как альтернатива.
- Аутентификация и авторизация: кто вы и что вам можно. JWT: структура, подпись, проверка (издатель, аудитория, срок), почему токен нельзя «отозвать» без дополнительных механизмов.
- Роли, claims, policy-based авторизация.
- CORS: что защищает (браузер), почему не защищает от серверных запросов, preflight.
- REST и проектирование API: ресурсы, методы, идемпотентность (`GET`, `PUT`, `DELETE` идемпотентны, `POST` нет), статус-коды (200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, 503).
- Единый формат ошибок через `ProblemDetails` и глобальная обработка исключений (middleware или `IExceptionHandler`).
- Версионирование API и обратная совместимость контрактов.
- `IHostedService` и `BackgroundService`: фоновая работа, корректная остановка по `CancellationToken`.
- Health checks: liveness и readiness; graceful shutdown.
- `HttpClient`: почему нельзя создавать на каждый запрос, `IHttpClientFactory`, таймауты и политики повторов.

**На чём валятся**

- Не отличают 401 от 403 и 400 от 422.
- Считают, что JWT «безопасен сам по себе», не знают про срок жизни и refresh-токены.
- Создают `new HttpClient()` в обработчике и получают исчерпание сокетов.
- Не знают, что `POST` не идемпотентен, и не умеют сделать идемпотентным платёжный endpoint.

## EF Core

```yaml
slug: ef-core
questions: ef-core-kak-rabotaet-dbcontext, ef-core-kak-rabotaet-change-tracking, ef-core-kogda-ispolzovat-asnotracking, ef-core-chem-eager-lazy-i-explicit-loading-otlichayutsya, ef-core-chto-takoe-problema-n-1, ef-core-kak-obnaruzhit-i-ispravit-n-1, ef-core-chto-takoe-projection-cherez-select, ef-core-kak-posmotret-sql-kotoryi-generiruet-ef-core, ef-core-kak-rabotayut-ef-core-migrations, ef-core-chto-takoe-transaction-v-ef-core, ef-core-kak-rabotaet-optimistic-concurrency, ef-core-kogda-ispolzovat-dapper-vmesto-ef-core
articles: ef-changetracker, zagruzka-svyazey-i-n-plus-1, translyaciya-iqueryable-v-sql, ef-optimistichnaya-blokirovka, ef-migracii
puzzles: ef-core-n-plus-1-lazy-loading, ef-core-ienumerable-vmesto-iqueryable
```

**Что нужно знать**

- `DbContext` как Unit of Work и identity map и change tracker (повторный запрос к БД всё равно уходит, но вернёт уже отслеживаемые экземпляры): короткоживущий, не потокобезопасный, регистрируется как `Scoped`.
- Change tracking: состояния сущностей, как `SaveChanges` формирует SQL, `AsNoTracking` для чтения.
- Стратегии загрузки связей: eager (`Include`), explicit, lazy; чем грозит lazy loading.
- Проблема N+1: как возникает, как находится (логи SQL, счётчик запросов), как исправляется (`Include`, проекция). `AsSplitQuery` нужен против «взрыва» декартова произведения при нескольких `Include`, а не против N+1.
- Проекция через `Select`: забирать только нужные колонки, не материализовать сущности ради DTO.
- Трансляция LINQ в SQL: что выполнится на сервере, что в памяти; опасность раннего `ToList()` или `AsEnumerable()`.
- Как посмотреть SQL: `ToQueryString()`, логирование, `EnableSensitiveDataLogging` только для разработки.
- Миграции: создание, применение, откат, миграции на проде при нескольких инстансах (скрипты, отдельный шаг деплоя).
- Транзакции: `SaveChanges` атомарен сам по себе, явная транзакция для нескольких вызовов, стратегии повторов.
- Оптимистичная конкуренция: concurrency token (`rowversion`, `xmin` в PostgreSQL), `DbUpdateConcurrencyException`.
- Когда использовать Dapper или сырой SQL: тяжёлые отчёты, массовые операции, критичная производительность.
- Пул соединений и время жизни `DbContext`.

**На чём валятся**

- Не замечают N+1 в коде и не умеют его доказать цифрами.
- Возвращают `IEnumerable` из репозитория и фильтруют в памяти миллионы строк.
- Регистрируют `DbContext` как `Singleton`.
- Не знают, как EF обнаруживает конфликт при параллельном обновлении.

## SQL: запросы и работа с данными

```yaml
slug: sql-queries
questions: postgresql-chem-inner-join-otlichaetsya-ot-left-join, postgresql-chem-where-otlichaetsya-ot-having, postgresql-chem-union-otlichaetsya-ot-union-all, postgresql-exists-vs-in-chto-vybrat, postgresql-chto-takoe-cte, postgresql-chto-takoe-window-functions, postgresql-chem-row-number-rank-i-dense-rank-otlichayutsya, postgresql-kak-poluchit-n-poslednih-zapisei-dlya-kazhdogo-polzovatelya, postgresql-kak-naiti-dublikaty, postgresql-kak-rabotaet-null, postgresql-pochemu-null-null-ne-daet-true, postgresql-offset-limit-vs-keyset-pagination
articles:
puzzles: postgresql-not-in-s-null, postgresql-count-i-null, postgresql-paginaciya-bez-order-by, postgresql-like-s-vedushchim-procentom
```

**Что нужно знать**

- Виды `JOIN`: `INNER`, `LEFT`, `FULL`, `CROSS`; результат при отсутствии совпадений; типичная ошибка с условием на правую таблицу в `WHERE` вместо `ON`.
- Порядок выполнения запроса: `FROM`, `WHERE`, `GROUP BY`, `HAVING`, `SELECT`, `ORDER BY`, `LIMIT`; отсюда разница `WHERE` и `HAVING`.
- `UNION` против `UNION ALL` (дедупликация и стоимость), `DISTINCT`.
- Подзапросы, коррелированные подзапросы, `EXISTS` против `IN`, ловушка `NOT IN` с `NULL`.
- CTE: читаемость, рекурсивные CTE для деревьев, поведение материализации в PostgreSQL.
- Оконные функции: `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `LAG`, `LEAD`, `SUM() OVER`, `PARTITION BY`.
- Типовые задачи: N последних записей на пользователя, поиск и удаление дубликатов, топ-N по группе, накопительная сумма.
- `NULL`: трёхзначная логика, `IS NULL`, `COALESCE`, `NULLIF`, поведение агрегатов (`COUNT(*)` и `COUNT(col)`).
- Пагинация: `OFFSET/LIMIT` и его цена на больших смещениях, keyset-пагинация, обязательный стабильный `ORDER BY`.
- `LIKE '%text'` не использует B-tree индекс.

**На чём валятся**

- Используют `NOT IN` с подзапросом, где встречается `NULL`, и получают пустой результат.
- Не могут написать запрос на оконной функции, решают подзапросами и самоджойнами.
- Пагинируют без `ORDER BY` или с нестабильной сортировкой.
- Не объясняют, почему `COUNT(col)` и `COUNT(*)` дают разное.

## PostgreSQL: индексы, планы и транзакции

```yaml
slug: postgresql-internals
questions: postgresql-kakie-tipy-indeksov-est-v-postgresql, postgresql-chto-takoe-b-tree-index, postgresql-kogda-b-tree-indeks-ne-pomogaet, postgresql-v-kakom-poryadke-vybirat-kolonki-dlya-composite-index, postgresql-chto-takoe-explain-analyze, postgresql-pochemu-postgresql-inogda-ne-ispolzuet-indeks, postgresql-chto-takoe-mvcc, postgresql-chto-takoe-vacuum, postgresql-kakie-urovni-izolyacii-tranzakcii-suschestvuyut, postgresql-chto-takoe-row-level-lock, postgresql-kak-voznikaet-deadlock-v-postgresql, postgresql-kak-optimizirovat-medlennyi-sql-zapros
articles: indeksy-btree-gin-brin, explain-i-plan-zaprosa, mvcc-i-vacuum, pg-urovni-izolyacii, pg-blokirovki-i-deadlock
puzzles:
```

**Что нужно знать**

- B-tree: какие запросы ускоряет (равенство, диапазоны, сортировка), как работает поиск, цена индекса на запись.
- Составные индексы: порядок колонок, правило левого префикса, покрывающие индексы (`INCLUDE`), частичные индексы.
- Когда индекс не используется: низкая селективность, функция над колонкой, несовпадение типов, устаревшая статистика, малая таблица.
- Другие индексы: GIN (JSONB, полнотекстовый поиск, массивы), GiST, BRIN для больших упорядоченных данных.
- `EXPLAIN` и `EXPLAIN (ANALYZE, BUFFERS)`: Seq Scan, Index Scan, Bitmap Scan, виды join (Nested Loop, Hash, Merge), разница оценки и факта.
- MVCC: версии строк, почему читатели не блокируют писателей, откуда берётся раздувание таблиц.
- `VACUUM`, `autovacuum`, `ANALYZE`: зачем нужны и чем грозит их отсутствие.
- Транзакции и ACID, уровни изоляции (`Read Committed` по умолчанию, `Repeatable Read`, `Serializable`), аномалии (dirty, non-repeatable, phantom read). Особенности PostgreSQL: dirty read не бывает ни на одном уровне; `Repeatable Read` это snapshot isolation, он защищает от фантомов, но допускает write skew; `Serializable` может завершиться ошибкой сериализации, и транзакцию нужно повторить.
- Блокировки строк (`SELECT FOR UPDATE`, `SKIP LOCKED`), как возникает deadlock и как его диагностировать.
- Пул соединений (Npgsql), почему соединения дороги и зачем PgBouncer.
- Алгоритм работы с медленным запросом: найти (`pg_stat_statements`, логи), посмотреть план, исправить (индекс, переписывание, статистика), перемерить.

**На чём валятся**

- Создают индекс «на всякий случай» и не понимают его цены для `INSERT/UPDATE`.
- Не читают план запроса и не отличают оценку от факта.
- Не могут объяснить, зачем нужен `VACUUM`.
- Путают уровни изоляции и не знают, какой действует по умолчанию.

## Архитектура, SOLID и паттерны

```yaml
slug: architecture-solid-patterns
questions: csharp-chto-takoe-inkapsulyaciya-nasledovanie-polimorfizm-i-abstrakciya, csharp-chem-interface-otlichaetsya-ot-abstract-class, csharp-chto-delayut-virtual-override-i-new, csharp-chto-takoe-solid, aspnet-core-chto-takoe-constructor-injection, aspnet-core-kak-rabotaet-vstroennyi-di-konteiner-asp-net-core, ef-core-chto-takoe-unit-of-work, ef-core-nuzhen-li-repository-pattern-poverh-ef-core, ef-core-plyusy-i-minusy-ef-core, microservices-chto-takoe-mikroservisnaya-arhitektura, architecture-patterns-kogda-strategy-luchshe-konstrukcii-switch-i-kogda-naoborot, architecture-patterns-kak-ponyat-chto-abstrakciya-prezhdevremenna
articles: inkapsulyaciya-nasledovanie-polimorfizm, solid-po-principam, strategy-vs-switch, sloistaya-vs-geksagonalnaya, prezhdevremennye-abstrakcii
puzzles: virtualnyj-vyzov-iz-konstruktora, sokrytie-metoda-cherez-new
```

**Что нужно знать**

- Четыре принципа ООП и их практический смысл: инкапсуляция как защита инвариантов, композиция предпочтительнее наследования.
- Интерфейс и абстрактный класс: когда что, default-методы интерфейсов.
- `virtual`, `override`, `new`: динамическая и статическая диспетчеризация, сокрытие метода.
- SOLID с примерами из своего кода: SRP как «одна причина для изменений», OCP через стратегию, LSP как корректная подстановка, ISP как узкие интерфейсы, DIP как зависимость от абстракций через DI.
- Где SOLID вредит: интерфейс на каждый класс без второй реализации.
- Паттерны, которые используются ежедневно: Factory, Strategy, Decorator, Adapter, Proxy, Observer, Unit of Work, Repository.
- Нужен ли Repository поверх EF Core и какие аргументы за и против.
- Слоистая и гексагональная архитектура, Clean Architecture на уровне идеи: направление зависимостей, изоляция доменной логики от инфраструктуры.
- Как отличить нужную абстракцию от преждевременной.

**На чём валятся**

- Перечисляют SOLID по буквам и не могут привести пример нарушения.
- Выдают «паттерны ради паттернов» и не умеют назвать цену.
- Путают `override` и `new`, не понимают результат вызова через базовый тип.
- Не видят разницы между DI как техникой и DIP как принципом.

## Микросервисы и Kafka

```yaml
slug: microservices-kafka
questions: microservices-monolit-vs-mikroservisy, microservices-synchronous-vs-asynchronous-communication, microservices-chto-takoe-circuit-breaker, microservices-pochemu-retry-mozhet-byt-opasen, microservices-chto-takoe-idempotency, microservices-chto-takoe-outbox-pattern, kafka-chto-takoe-apache-kafka, kafka-chto-takoe-consumer-group, kafka-kak-kafka-obespechivaet-poryadok-soobschenii, kafka-auto-commit-vs-manual-commit, kafka-chto-takoe-at-least-once-delivery, kafka-chto-takoe-idempotent-consumer
articles: ms-granicy-servisov, sinhronnoe-vs-asinhronnoe-vzaimodeystvie, circuit-breaker, idempotentnost, kafka-model
puzzles:
```

**Что нужно знать**

- Монолит и микросервисы: когда микросервисы оправданы (независимые команды и релизы, разная нагрузка), когда нет (маленькая команда, неясные границы).
- Границы сервисов по предметной области (bounded context), а не по таблицам.
- Синхронное (REST, gRPC) и асинхронное (очереди, события) взаимодействие, их компромиссы по связности и отказоустойчивости.
- Устойчивость: таймауты, retry с экспоненциальной задержкой и jitter, circuit breaker, bulkhead; почему retry без ограничения создаёт лавину запросов.
- Идемпотентность операций и ключи идемпотентности.
- Согласованность без распределённых транзакций: eventual consistency, saga, outbox (запись события и данных в одной транзакции БД).
- Наблюдаемость: логи, метрики, трассировка, correlation ID.
- Kafka: topic, partition, offset, producer, consumer group; как распределяются партиции между потребителями.
- Порядок гарантируется только внутри партиции; ключ сообщения определяет партицию.
- Семантики доставки: at-most-once, at-least-once, exactly-once; почему на практике берут at-least-once плюс идемпотентный consumer.
- Коммит offset: автоматический и ручной, когда коммитить (после успешной обработки).
- Обработка ошибок: retry-топики и dead letter topic, poison messages, consumer lag как главная метрика.
- Kafka и RabbitMQ: лог событий против классической очереди.

**На чём валятся**

- Предлагают микросервисы для любой задачи и не называют цену (сетевые сбои, консистентность, сложность эксплуатации).
- Не понимают, как гарантировать порядок и что делать при увеличении числа партиций.
- Не знают, что при at-least-once возможны дубликаты, и не закладывают идемпотентность.
- Пишут в БД и в брокер двумя независимыми вызовами и теряют события при сбое.

## Системный дизайн и кэширование для Middle

```yaml
slug: system-design-basics
questions: system-design-kak-nachat-proektirovanie-sistemy, system-design-kak-ocenit-nagruzku-sistemy, system-design-kogda-nuzhen-redis, system-design-chto-takoe-caching-layer, microservices-cache-aside-pattern, system-design-sproektirovat-notification-service, system-design-sproektirovat-url-shortener, system-design-sproektirovat-servis-korziny
articles: kak-prohodit-dizayn-sekciyu, ocenka-nagruzki-i-rps, vertikalnoe-i-gorizontalnoe-masshtabirovanie, keshirovanie, url-shortener, notification-service
puzzles:
```

Для углублённой подготовки есть отдельный гайд «System Design — Middle» (`/prep/system-design-middle`). Здесь только минимум, который обычно спрашивают у Middle.

**Что нужно знать**

- Порядок работы на дизайн-секции: уточнить требования (функциональные и нефункциональные), оценить нагрузку, набросать API и модель данных, нарисовать общую схему, найти узкие места.
- Прикидка нагрузки: пользователи, RPS и пиковый RPS, объём хранилища, соотношение чтений и записей.
- Масштабирование: вертикальное и горизонтальное, stateless-сервисы за балансировщиком.
- Хранилище: когда достаточно PostgreSQL, когда нужны реплики для чтения, кэш, очередь.
- Кэширование: cache-aside, TTL, инвалидация, защита от cache stampede, что кэшировать и что нет.
- Redis: типичные применения (кэш, счётчики, rate limit, блокировки) и ограничения.
- Асинхронная обработка через очередь для отправки уведомлений и тяжёлых задач, идемпотентность и повторы.
- Типовые задачи: сокращатель ссылок (генерация ключа, чтения сильно преобладают), сервис уведомлений (очередь, ретраи, приоритеты), корзина (хранилище, консистентность).
- Явно называть компромиссы и то, что вы сознательно упрощаете.

**На чём валятся**

- Сразу рисуют микросервисы и брокеры, не уточнив требования и нагрузку.
- Не считают цифры и не могут обосновать, нужен ли кэш или шардирование.
- Добавляют кэш и не говорят, как он инвалидируется.
- Не обсуждают отказы: что будет, если БД или брокер недоступны.

## Алгоритмы и структуры данных

```yaml
slug: algorithms
questions: algorithms-chto-takoe-big-o, algorithms-kak-ocenit-slozhnost-algoritma, algorithms-kak-rabotaet-binary-search, algorithms-chem-quicksort-otlichaetsya-ot-mergesort, algorithms-chto-takoe-hash-table, algorithms-kogda-ispolzovat-dictionary-a-kogda-hashset, algorithms-kak-naiti-dva-chisla-s-zadannoi-summoi, algorithms-chto-takoe-two-pointers, algorithms-chto-takoe-sliding-window, algorithms-kak-proverit-korrektnost-skobok, algorithms-chem-bfs-otlichaetsya-ot-dfs, algorithms-kak-realizovat-lru-cache
articles: algo-big-o, algo-hesh-tablica, algo-dva-ukazatelya, algo-skolzyashchee-okno, algo-dfs-i-bfs
puzzles:
```

**Что нужно знать**

- Big O: отбрасывание констант и младших членов, оценка по времени и памяти, амортизированная сложность `List.Add`.
- Сложность операций в стандартных коллекциях: `List`, `Dictionary`, `HashSet`, `Queue`, `Stack`, `SortedDictionary`.
- Бинарный поиск: условие (отсортированные данные), границы, ловушки с переполнением индекса и бесконечным циклом.
- Сортировки: quicksort и mergesort (идея, сложность, устойчивость), что использует `Array.Sort` и `List.Sort`.
- Хеш-таблица как универсальный инструмент: подсчёт частот, поиск дубликатов, two sum за O(n).
- Приёмы: два указателя, скользящее окно, префиксные суммы, стек для скобок.
- Стек и очередь, реализация LRU-кэша через словарь и связный список.
- Обход графов и деревьев: BFS (кратчайший путь в невзвешенном графе), DFS, рекурсия и риск переполнения стека.
- Базовое динамическое программирование на уровне «ступеньки» и «рюкзак»: хотя бы вывести рекуррентную формулу.
- Как решать на собеседовании: уточнить условие, привести пример, предложить брутфорс, улучшить, закодировать, прогнать на примере, назвать сложность.

**На чём валятся**

- Сразу пишут код, не уточнив граничные случаи (пустой вход, дубликаты, отрицательные числа).
- Не называют сложность или называют неверно (забывают про `Substring` и конкатенацию строк).
- Не умеют объяснить выбор структуры данных и предлагают вложенные циклы там, где достаточно словаря.
- Теряются на задачах с индексами (граничные условия окна, бинарного поиска).
