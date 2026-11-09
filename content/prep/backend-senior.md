---
title: Backend .NET — Senior
slug: backend-senior
role: backend
roleName: Backend .NET
level: senior
sortOrder: 2
summary: Гайд для .NET-разработчиков, которые идут на Senior-собеседование: от рантайма, async и производительности до PostgreSQL, Kafka, распределённых систем и System Design. Для каждой темы собран чек-лист того, что нужно уметь объяснить, и ссылки на самые важные вопросы, статьи и задачи.
---

# Вступление

Этот гайд для backend-разработчиков на .NET, которые уже уверенно работают на уровне Middle и готовятся к позиции Senior: собеседование на новую роль, внутренний переход или просто проверка своей глубины. Если базовые вещи (value/reference types, LINQ, DI, основы EF Core, базовый async/await) ещё вызывают сомнения, сначала пройдите гайд для Middle: здесь они подразумеваются.

**Чем Senior отличается от Middle на собеседовании**

- **Глубина.** Middle знает, что делает `await`. Senior объясняет, во что он компилируется, где в этот момент поток, что будет с контекстом и во что обойдётся лишняя аллокация на горячем пути.
- **Компромиссы вместо правил.** На любой вопрос «как лучше» Senior сначала спрашивает про нагрузку, требования к согласованности и стоимость ошибки, а потом называет вариант и цену, которую за него платят.
- **Ответственность за результат.** Senior думает не про «код написан», а про «это живёт в продакшене»: как мониторить, как откатить, что случится при отказе зависимости, кто будет разбирать инцидент.
- **Диагностика.** От симптома («p99 вырос в пять раз», «память растёт») к гипотезам, измерениям и причине. Порядок действий важнее знания конкретной утилиты.
- **Проектирование.** Умение разложить систему на компоненты, оценить нагрузку, найти узкое место и честно сказать, что вы упрощаете.
- **Влияние на команду.** Ревью, ADR, менторство, разговор с бизнесом о техдолге и сроках. Это отдельный блок собеседования, и по нему тоже отказывают.

**Как пользоваться гайдом**

- Темы идут в рекомендуемом порядке изучения: сначала рантайм, async и память, затем сервис и данные, затем распределённые системы и проектирование. Если времени мало, начинайте с тем, где у вас самые слабые места, а не с первой.
- В каждой теме есть чек-лист «Что нужно знать». Проверка простая: можете ли вы объяснить пункт за две минуты вслух, с примером и с ответом на «а что если нагрузка вырастет в десять раз». Если нет, откройте связанные вопросы и статьи.
- Вопросы в блоке темы упорядочены от базовых к сложным. Часть из них уровня Middle, там, где по теме мало Senior-материала. Не пропускайте их: на собеседовании Senior разговор часто начинается с «простого» вопроса и углубляется.
- Задачи на «что выведет код» и поиск бага решайте сами до просмотра ответа. На Senior-интервью их дают, чтобы увидеть ход рассуждения, а не ответ.

**Бюджет времени**

- Если вы работаете с .NET каждый день: 4-6 недель по 6-8 часов в неделю. Первые две недели на рантайм, async, многопоточность и производительность, остальное на данные, распределённые системы и проектирование.
- Если часть тем вам незнакома на практике (Kafka, Kubernetes, PostgreSQL изнутри): заложите 8-10 недель и обязательно воспроизводите примеры руками, а не только читайте.
- Последняя неделя уходит на прогон вслух: проектирование на время, рассказ о своём проекте, поведенческие истории.

**Какая глубина ожидается**

- По темам рантайма, async, памяти и производительности: уровень «объяснить механизм и показать, как это измерить».
- По PostgreSQL, EF Core, Kafka: уровень «понимать, что происходит под капотом и как это ломается под нагрузкой».
- По распределённым системам и архитектуре: уровень «выбрать подход под требования и защитить выбор».
- По алгоритмам: не олимпиадный. Ждут оценку сложности, выбор структуры данных и умение подумать про память и потоковую обработку.

# Формат собеседования

Типичный процесс на Senior .NET backend занимает 4-6 этапов, от одной до трёх недель. Состав зависит от компании, но набор повторяется.

**Этапы и что на них проверяют**

- **Скрининг с рекрутером или тимлидом (20-40 минут).** Опыт, масштаб систем (RPS, объёмы данных, размер команды), стек, ожидания по деньгам и формату. Здесь важно говорить цифрами и называть свою зону ответственности, а не «мы делали».
- **Техническое интервью по .NET (60-90 минут).** Рантайм, GC и память, async/await изнутри, многопоточность, коллекции, EF Core. Вопросы быстро уходят вглубь: после правильного ответа следует «а как это работает внутри» и «как вы это обнаружите в продакшене». Часто есть небольшой кодовый разбор: найти баг в фрагменте, предсказать вывод, оценить сложность.
- **Данные и инфраструктура (45-60 минут).** PostgreSQL (планы запросов, блокировки, MVCC), Kafka, кеши, контейнеры и деплой. Проверяют, что вы понимаете, как ломается система под нагрузкой.
- **System Design (60 минут).** Нужно спроектировать сервис на заданную нагрузку: уточнить требования, оценить RPS и объёмы, нарисовать компоненты, найти узкое место, обсудить отказы. Оценивают структуру рассуждения, а не «правильную» картинку.
- **Разбор прошлого проекта и архитектуры (45-60 минут).** Вас просят подробно рассказать о системе, в которой вы участвовали: почему такие границы, почему такая база, что бы вы сделали иначе, какие были инциденты. Это самая трудная для подготовки часть, потому что нельзя заучить: нужно знать свой проект на уровне решений и их последствий.
- **Поведенческое и лидерское (45-60 минут).** Конфликты, несогласие с решением команды, ошибка в продакшене, менторство, приоритизация, разговор с бизнесом. Ждут структурированные истории (ситуация, ваши действия, результат, выводы) и признаки ответственности.

**Чем ответ Senior отличается от ответа Middle**

- **Начинает с уточнений.** «Какая нагрузка? Какая допустимая потеря данных? Кто клиент?» Ответ без вводных воспринимается как догма.
- **Называет компромиссы.** Не «используем Kafka», а «Kafka даёт порядок в партиции и повторное чтение, но стоит операционной сложности и eventual consistency, а здесь достаточно очереди в PostgreSQL с `FOR UPDATE SKIP LOCKED`».
- **Оперирует числами.** Порядок RPS, размер сообщения, объём в день, латентность p99, размер пула соединений. Порядок величины важнее точности.
- **Описывает режимы отказа.** Что будет при падении зависимости, повторной доставке, разрыве сети, переполнении очереди, деплое во время обработки.
- **Говорит про наблюдаемость.** «Я бы смотрел на consumer lag, p99 и долю ошибок по этому эндпоинту, алерт на нарушение SLO, а не на загрузку CPU».
- **Признаёт границы знаний.** «Я не работал с этим на проде, но предположил бы так и проверил вот этим» лучше уверенной выдумки.

**Типичные красные флаги**

- Заученные определения без понимания причин: на вопрос «почему» ответа нет.
- Решения «по умолчанию»: микросервисы, Kafka, CQRS, Redis без обоснования и без цены.
- Ответ только про счастливый путь: нет ретраев, идемпотентности, таймаутов, обработки отказа.
- Нет собственного вклада: в рассказе о проекте всё «мы», нет решений, которые принимали вы, и нет ошибок.
- Оптимизация без измерения: «заменим на Span», «добавим кеш», «поставим больше подов» до того, как найдено узкое место.
- Пренебрежение командой: критика бывших коллег и компаний, отсутствие опыта ревью и менторства.
- Нечестность в деталях: заявленный опыт не выдерживает двух уточняющих вопросов.

**Что спросить у компании**

- Как выглядит on-call и разбор инцидентов, есть ли постмортемы без поиска виноватых.
- Какие SLO у ключевых сервисов, как они измеряются и что происходит при исчерпании error budget.
- Как устроен релизный процесс: частота деплоев, откаты, feature flags, окружения.
- Как принимаются архитектурные решения: есть ли ADR, кто имеет право вето, как оспорить решение.
- Какой процент времени уходит на техдолг и как он приоритизируется.
- Какой масштаб нагрузки и данных сейчас, и что считается главной технической проблемой на ближайший год.
- Чего ожидают от Senior в первые 3-6 месяцев, и как оценивается успех.
- Как устроено менторство и рост: сколько джунов и мидлов на одного Senior.

## C# и рантайм глубоко

```yaml
slug: csharp-runtime
questions: csharp-pochemu-nullable-reference-types-ne-dayut-garantii-v-runtime-i-kak-vystroit-null, csharp-kak-korrektno-realizovat-ravenstvo-v-ierarhii-tipov-i-zachem-records-ispolzuyut-e, csharp-kak-clr-realizuet-generics-i-pochemu-kod-dlya-value-types-specializiruetsya-a-dly, csharp-kak-rabotayut-interpolated-string-handlers-i-kak-s-ih-pomoschyu-ubrat-allokacii-i, advanced-csharp-kak-ustroen-vyzov-delegata-i-pochemu-mnogoadresnyi-delegat-dorozhe-odi, advanced-csharp-pochemu-reflection-dorog-i-kakie-sposoby-ego-uskorit-suschestvuyut, advanced-csharp-kak-source-generators-reshayut-problemy-reflection-i-kakie-ogranicheni, advanced-csharp-kogda-expression-trees-predpochtitelnee-skompilirovannyh-delegatov-i-n, advanced-csharp-kak-rabotaet-tiered-compilation-i-pochemu-pervye-vyzovy-metoda-mogut-b, advanced-csharp-chto-takoe-osr-on-stack-replacement-i-kakuyu-problemu-tiered-compilati, advanced-csharp-kak-readytorun-i-nativeaot-vliyayut-na-vremya-starta-pikovuyu-proizvod
articles: value-type-i-reference-type, class-struct-record, equals-gethashcode-operator, clr-il-jit, nullable-reference-types
puzzles: mutaciya-readonly-polya-struktury, razreshenie-peregruzok, virtualnyj-vyzov-iz-konstruktora
```

**Что нужно знать**

- Путь кода: C# в IL, затем JIT. Tiered compilation: быстрый tier-0 для старта, повторная компиляция горячих методов в tier-1, динамический PGO. Почему первые вызовы медленнее и что такое OSR для долгих циклов.
- ReadyToRun и NativeAOT: что дают для холодного старта, что отнимают (пиковая производительность, ограничения на reflection и динамическую генерацию кода).
- Generics в CLR: для value types код специализируется под каждый тип, для reference types разделяется один shared-код. Следствия для производительности и размера сборки.
- Struct против class на уровне размещения и копирования: defensive copies для `readonly`-полей и `in`-параметров, мутабельные структуры в коллекциях, `readonly struct`.
- Равенство: контракт `Equals` и `GetHashCode`, симметричность и транзитивность в иерархиях, `IEquatable<T>`, как устроено равенство в record и почему оно сложнее с наследованием.
- Делегаты: аллокации на замыкание, кеширование статических лямбд, стоимость multicast-вызова, `static` лямбды.
- Reflection: почему дорог (поиск метаданных, проверки, боксинг аргументов), способы ускорить: кеширование `MethodInfo`, скомпилированные делегаты, Expression Trees, source generators.
- Source generators: что решают (отсутствие reflection в рантайме, AOT-совместимость), ограничения и стоимость поддержки.
- Nullable reference types: это анализ на этапе компиляции, а не гарантия в рантайме; где аннотации обманываются (десериализация, `default!`, EF).
- Interpolated string handlers и другие конструкции, которые компилятор разворачивает по шаблону: как они убирают аллокации в логировании.
- Инлайнинг, виртуальные вызовы, девиртуализация: как они влияют на то, что вы видите в профиле.

**На чём валятся**

- Знают определения value и reference типов, но не могут объяснить, откуда берутся defensive copies и почему это замедляет код.
- Путают «Nullable включён» с «null невозможен» и не знают, где граница гарантий.
- Говорят «reflection медленный» без понимания, из чего складывается стоимость и чем его заменяют.
- Не различают tiered compilation и ReadyToRun, не знают, зачем OSR.

## CLR, GC и память

```yaml
slug: clr-gc-memory
questions: advanced-csharp-chem-workstation-gc-otlichaetsya-ot-server-gc-pod-realnoi-nagruzkoi-i, advanced-csharp-chto-takoe-background-gc-i-pochemu-pauza-gen-2-vse-ravno-mozhet-byt-za, advanced-csharp-kak-vliyaet-servergarbagecollection-i-concurrentgc-na-latency-v-kontei, advanced-csharp-pochemu-loh-fragmentiruetsya-i-kak-s-etim-borotsya-bez-ruchnogo-gc-col, advanced-csharp-chto-takoe-gc-pressure-i-po-kakim-metrikam-vy-poimete-chto-on-stal-uzk, advanced-csharp-kak-ogranichenie-pamyati-v-kubernetes-vliyaet-na-povedenie-gc-i-pochem, advanced-csharp-prilozhenie-potreblyaet-8-gb-no-dotnet-counters-pokazyvaet-heap-1-gb-k, advanced-csharp-pochemu-span-t-nelzya-sohranit-v-pole-klassa-i-kak-oboiti-eto-ogranich, advanced-csharp-kogda-memory-t-opravdan-vmesto-span-t-i-kakova-cena-etogo-perehoda, advanced-csharp-kak-ustroen-arraypool-t-i-kakie-oshibki-pri-ego-ispolzovanii-privodyat, advanced-csharp-chto-takoe-stackalloc-i-kak-ne-poluchit-perepolnenie-steka-pri-ego-isp, advanced-csharp-chto-delaet-gc-keepalive-i-fixed-i-pochemu-bez-nih-unsafe-kod-mozhet-c
articles: kak-rabotaet-gc, loh-i-fragmentaciya, utechki-pamyati, span-i-memory, snizhenie-allokaciy
puzzles: finalizator-i-dispose, staticheskij-kesh-s-zamykaniem, stackalloc-i-razmer-vhodnyh-dannyh, podpiska-na-sobytie-dolgozhivushchego-obekta
```

**Что нужно знать**

- Поколения gen0/gen1/gen2, card marking и почему ссылки из старого поколения на молодое дороги. Что такое GC root и что удерживает объект живым.
- Workstation и Server GC: число куч и потоков, влияние на пропускную способность, паузы и потребление памяти. Что меняет Concurrent (Background) GC и почему пауза gen2 всё равно возможна.
- LOH (объекты от 85 000 байт), почему он фрагментируется, как это лечится: пулы, чанки, `GCSettings.LargeObjectHeapCompactionMode` как крайняя мера, а не стратегия.
- GC pressure: по каким метрикам видно (частота gen0/gen1/gen2, процент времени в GC, allocation rate, размер кучи после сборки).
- Контейнеры: как `GCHeapHardLimit`, лимит памяти cgroup и число доступных ядер влияют на размер кучи и количество куч Server GC.
- «Процесс занимает 8 ГБ, а managed-куча 1 ГБ»: нативная память, фрагментация, пулы, `ArrayPool`, mapped files, потоки, кеши JIT. Чем это расследуется.
- `Span<T>` и `ref struct`: почему нельзя хранить в поле класса и держать через `await`/`yield` (с C# 13 локальные ref struct в async-методах допустимы, пока не живут через `await`), что делать вместо этого (`Memory<T>`, копирование, пул).
- `ArrayPool<T>`: типичные ошибки (возврат дважды, использование после возврата, утечка конфиденциальных данных без очистки, разные размеры).
- `stackalloc`: лимит стека, защита от размера пользовательских данных, порог перехода на пул.
- `IDisposable`, финализаторы, `SafeHandle`, `GC.KeepAlive` и `fixed` в unsafe-коде.
- Утечки в managed-коде: события, статические кеши, замыкания, `HttpClient`-хендлеры, `Timer`.

**На чём валятся**

- Описывают поколения как «молодые и старые объекты», но не знают, что запускает сборку и что такое allocation budget.
- Рекомендуют «вызвать GC.Collect()» вместо поиска причины.
- Не умеют ответить, как отличить утечку managed-памяти от нативной.
- Говорят «используем Span везде» и не знают его ограничений.

## async/await изнутри

```yaml
slug: async-await-internals
questions: async-chto-takoe-state-machine-dlya-async-metoda, async-chem-task-otlichaetsya-ot-valuetask, async-chto-delaet-configureawait-false, advanced-concurrency-pochemu-sinhronnoe-ozhidanie-async-metoda-privodit-k-deadlock-i-pochem, advanced-concurrency-chto-takoe-threadpool-starvation-kak-on-proyavlyaetsya-v-metrikah-i-ch, async-pochemu-prodolzheniya-taskcompletionsource-vypolnyayutsya-sinhronno-vnutri-setresu, async-skolko-na-samom-dele-stoit-async-metod-i-kogda-pomogayut-valuetask-otkaz-ot-async, async-kak-sdelat-pereispolzuemuyu-asinhronnuyu-operaciyu-bez-allokacii-cherez-ivaluetask, async-kak-naiti-zavisshuyu-async-operaciyu-v-prodakshene-esli-v-stekah-potokov-ee-ne-vid, advanced-concurrency-chem-asynclocal-otlichaetsya-ot-threadlocal-i-gde-eto-kritichno, async-kak-pravilno-realizovat-iasyncdisposable-v-tipe-kotoryi-vladeet-sinhronnymi-i-asin
articles: state-machine, synchronizationcontext, configureawait-false, task-vs-thread-vs-valuetask, cancellationtoken-i-taymauty
puzzles: async-povtornyj-await-valuetask, async-dedlok-result, async-isklyucheniya-task-whenall, async-fire-and-forget-v-kontrollere
```

**Что нужно знать**

- Во что компилируется `async`-метод: структура-машина состояний, `AsyncTaskMethodBuilder`, синхронная часть до первого незавершённого `await`, когда машина боксируется в кучу.
- Что происходит на `await`: проверка `IsCompleted`, регистрация продолжения, захват `ExecutionContext` и `SynchronizationContext`/`TaskScheduler`, возобновление.
- `ConfigureAwait(false)`: в ASP.NET Core нет `SynchronizationContext`, но в библиотеках и в UI-коде он остаётся важным. Что он не делает (не гарантирует переход на пул).
- Deadlock на `.Result`/`.Wait()`: условия, в которых он воспроизводится, и почему в ASP.NET Core это чаще превращается в thread pool starvation.
- Thread pool starvation: как проявляется (рост latency при низком CPU, медленный рост числа потоков), как диагностируется (`dotnet-counters`, `ThreadPool.PendingWorkItemCount`), как лечится.
- `ValueTask`: когда выигрыш реален, почему его нельзя awaitить дважды и использовать конкурентно, `IValueTaskSource` для переиспользуемых операций, цена в читаемости.
- `TaskCompletionSource`: `RunContinuationsAsynchronously` и почему без него продолжения могут выполниться синхронно внутри `SetResult`.
- Исключения: `async void`, `Task.WhenAll` и потерянные исключения, `AggregateException`, необработанные исключения в `Task`, fire-and-forget.
- Отмена: `CancellationToken` кооперативен, сквозная передача, `CancelAfter`, связанные токены, освобождение `CancellationTokenSource`.
- `AsyncLocal<T>`: как течёт через `ExecutionContext`, чем отличается от `ThreadLocal`, где это критично (корреляционные идентификаторы, мультитенантность).
- `IAsyncDisposable`: порядок `DisposeAsync`, `await using`, типы с синхронным и асинхронным владением ресурсами.
- Поиск зависшей async-операции в продакшене: дамп, `dotnet-stack`, анализ незавершённых state machines.

**На чём валятся**

- Говорят «await освобождает поток», но не могут сказать, куда возвращается продолжение и чем это определяется.
- Считают `ConfigureAwait(false)` универсальным лекарством от deadlock.
- Не знают, что async-метод без реального асинхронного завершения почти бесплатен, а с ним может аллоцировать.
- Не умеют объяснить, как они нашли бы starvation в проде.

## Многопоточность и синхронизация

```yaml
slug: multithreading-sync
questions: advanced-csharp-chto-garantiruet-model-pamyati-net-i-pochemu-bez-volatile-ili-barera-c, advanced-csharp-chem-otlichayutsya-garantii-volatile-interlocked-i-volatile-read-write, advanced-concurrency-kak-realizovat-potokobezopasnyi-schetchik-cherez-cas-i-pochemu-naivnyi, advanced-concurrency-kak-diagnose-lock-contention-i-kakie-metriki-pokazhut-chto-blokirovka, advanced-concurrency-chto-takoe-false-sharing-i-kak-ego-obnaruzhit-v-realnom-kode, advanced-concurrency-kak-getoradd-v-concurrentdictionary-mozhet-vyzvat-fabriku-dvazhdy-i-ch, advanced-concurrency-chto-delat-esli-concurrentdictionary-stal-uzkim-mestom-pod-nagruzkoi, advanced-concurrency-chem-semaphoreslim-waitasync-luchshe-blokiruyuschego-wait-pri-vysokoi, advanced-concurrency-kak-ogranichit-concurrency-pri-obraschenii-k-vneshnemu-servisu-dopuska, advanced-concurrency-kak-ustroen-channel-t-i-kogda-bounded-kanal-predpochtitelnee-unbounded, advanced-concurrency-kak-realizovat-backpressure-chtoby-ochered-ne-sela-vsyu-pamyat-pri-vsp, advanced-concurrency-kak-pravilno-realizovat-asinhronnuyu-blokirovku-i-pochemu-lock-tut-ne
articles: volatile-i-barery-pamyati, interlocked-i-atomarnost, konkurentnye-kollekcii, lock-i-monitor, channel-t
puzzles: mnogopotochnost-lazy-keshiruet-isklyuchenie, mnogopotochnost-dictionary-v-singleton, mnogopotochnost-lock-na-stroku
```

**Что нужно знать**

- Модель памяти .NET: что гарантируют `volatile`, `Volatile.Read/Write`, `Interlocked`, `lock`; почему код, корректный на x86, ломается на ARM.
- Атомарность и CAS: потокобезопасный счётчик через `Interlocked.CompareExchange`, цикл повтора, проблема ABA.
- Lock contention: как диагностировать (метрики блокировок, профиль, `dotnet-counters`), как снижать (уменьшение критической секции, шардирование, неблокирующие структуры).
- False sharing: что это, как проявляется (масштабирование не растёт с числом ядер), как лечится (выравнивание, padding).
- `ConcurrentDictionary`: `GetOrAdd` может вызвать фабрику дважды, значение попадёт только одно; решения через `Lazy<T>`; когда он становится узким местом.
- `SemaphoreSlim.WaitAsync` вместо блокирующего ожидания; ограничение параллелизма при обращении к внешнему сервису; почему `lock` нельзя держать через `await`.
- Асинхронная блокировка по ключу: реализация, очистка словаря блокировок, риск утечки.
- `Channel<T>`: bounded и unbounded, режимы переполнения, один или несколько читателей, завершение канала, как построить backpressure.
- Producer-consumer: размер буфера, поведение при отказе consumer, корректная остановка.
- Дедлоки: порядок захвата, `Monitor.TryEnter` с таймаутом, как диагностировать по дампу.
- Тестирование потоконебезопасного кода: стресс-тесты, детерминированное воспроизведение, анализаторы.

**На чём валятся**

- «Дедлок возникает, когда два потока ждут друг друга» без примера и без способа диагностики.
- Используют `ConcurrentDictionary` как панацею и не знают про повторный вызов фабрики.
- Не понимают, чем `volatile` отличается от `Interlocked` и что он на самом деле гарантирует.
- Предлагают unbounded-очередь без ответа на вопрос, что будет при всплеске.

## Производительность и профилирование

```yaml
slug: performance-profiling
questions: performance-profiling-kak-postroit-korrektnyi-benchmark-na-benchmarkdotnet-i-kakie-oshibki-e, performance-profiling-pochemu-rezultat-mikrobenchmarka-chasto-ne-vosproizvoditsya-v-prode, performance-profiling-kakie-metriki-dotnet-counters-smotret-pervymi-pri-degradacii-proizvodi, performance-profiling-kak-naiti-prichinu-100-zagruzki-cpu-esli-nagruzka-ne-izmenilas, performance-profiling-chto-oznachaet-vysokii-procent-vremeni-v-gc-i-s-chego-nachat-optimizac, performance-profiling-kak-profilirovat-allokacii-i-opredelit-kakie-iz-nih-deistvitelno-vazhn, performance-profiling-kak-proanalizirovat-damp-pamyati-i-naiti-istochnik-utechki, performance-profiling-kak-chitat-flame-graph-i-derevo-vyzovov-chtoby-ne-sdelat-lozhnyh-v, performance-profiling-potreblenie-pamyati-postoyanno-rastet-kak-vystroit-rassledovanie, performance-profiling-prodakshen-stal-otvechat-v-pyat-raz-medlennee-kakov-vash-poryadok-deis, performance-profiling-latency-vyrosla-tolko-na-p99-gde-iskat-prichinu, performance-profiling-kak-ponyat-chto-problema-v-baze-dannyh-a-ne-v-prilozhenii
articles: benchmarkdotnet-i-mikrobenchmarki, diagnostika-vysokogo-gc, analiz-dampa, baza-ili-prilozhenie, chto-delat-s-p99
puzzles:
```

**Что нужно знать**

- Порядок действий при деградации: определить масштаб и момент начала, сопоставить с релизами и нагрузкой, разделить «приложение или зависимость (база, сеть, внешний API)», только потом идти в профилировщик.
- `dotnet-counters`: какие метрики смотреть первыми (CPU, allocation rate, GC pause, thread pool queue length, число исключений, активные запросы).
- `dotnet-trace` и flame graph: как снять трассировку в проде без остановки сервиса, как читать (inclusive и exclusive время, ширина блоков) и какие выводы нельзя делать.
- `dotnet-dump` и `dotnet-gcdump`: снятие в контейнере, анализ кучи (в `dotnet-dump analyze` команды SOS `dumpheap -stat`, `gcroot`; `dotnet-gcdump` даёт лёгкий снимок кучи без этих команд), поиск источника утечки.
- 100 % CPU без роста нагрузки: подозреваемые (GC, бесконечные ретраи, regex-бэктрекинг, горячая сериализация, спин-ожидание) и как их разделять.
- Высокий процент времени в GC: что оптимизировать в первую очередь (самые массовые аллокации по профилю аллокаций, а не «всё подряд»).
- Рост только p99: GC-паузы, thread pool starvation, лок, холодные кеши, повторные попытки, соседи по ноде. Как это разделять по метрикам.
- BenchmarkDotNet: прогрев, `[MemoryDiagnoser]`, защита от выкидывания кода, почему микробенчмарк расходится с продом (инлайнинг, PGO, размер данных, кеши процессора).
- Нагрузочное тестирование: профиль трафика, открытая и закрытая модели нагрузки, измерение с учётом coordinated omission.
- Цена логирования и сериализации на горячем пути, как её измерить.
- Регрессии производительности в CI при шумных бенчмарках: относительные пороги, стабильное окружение.

**На чём валятся**

- Начинают с оптимизации кода, не измерив, где время.
- Не отличают проблему базы от проблемы приложения и не знают, чем это проверить.
- Читают flame graph как «самое широкое место и есть проблема», не учитывая асинхронность и ожидание.
- Верят одному запуску бенчмарка.

## ASP.NET Core в продакшене

```yaml
slug: aspnet-core-production
questions: advanced-aspnet-kak-ustroen-konveier-asp-net-core-iznutri-i-chto-proishodit-ot-soketa, advanced-aspnet-kak-vliyaet-poryadok-middleware-na-proizvoditelnost-i-korrektnost, advanced-aspnet-pochemu-zahvat-scoped-servisa-v-singleton-privodit-k-utechke-i-kak-eto, advanced-aspnet-kak-nastroit-pul-soedinenii-httpclient-i-pochemu-staticheskii-httpclie, advanced-aspnet-pochemu-voznikaet-ischerpanie-portov-pri-ispolzovanii-httpclient-i-kak, advanced-aspnet-kak-ihttpclientfactory-reshaet-problemu-ustarevaniya-dns, advanced-aspnet-kak-pravilno-probrosit-cancellationtoken-do-bazy-dannyh-i-chto-daet-ot, advanced-aspnet-chto-proishodit-s-tekuschimi-zaprosami-pri-graceful-shutdown-i-kak-ne, advanced-aspnet-kak-realizovat-idempotentnyi-post-endpoint-v-raspredelennoi-sisteme, advanced-aspnet-kak-otdavat-bolshoi-otvet-ne-zagruzhaya-ego-celikom-v-pamyat, advanced-aspnet-kak-realizovat-rate-limiting-rabotayuschii-na-neskolkih-instansah-odno, advanced-aspnet-pochemu-health-check-mozhet-otvechat-ok-kogda-prilozhenie-fakticheski
articles: aspnet-pipeline-i-middleware, aspnet-di-i-zhiznennye-cikly, aspnet-graceful-shutdown, aspnet-health-checks, aspnet-dizayn-api-i-versionirovanie
puzzles: aspnet-core-captive-dependency, aspnet-core-new-httpclient-na-zapros
```

**Что нужно знать**

- Путь запроса от сокета Kestrel до action: пайплайн middleware и почему порядок важен для корректности и стоимости: обработка исключений первой, затем routing, CORS, аутентификация, авторизация, rate limiter, endpoints; стоимость каждого слоя.
- Kestrel: лимиты соединений и размера тела, keep-alive, HTTP/2 мультиплексирование, когда HTTP/3 оправдан.
- DI: жизненные циклы, captive dependency (scoped в singleton), `ValidateScopes` и `ValidateOnBuild`, создание scope в фоновых сервисах.
- `HttpClient`: исчерпание портов от `new HttpClient()` на запрос, устаревание DNS у статического клиента, `IHttpClientFactory`, `SocketsHttpHandler.PooledConnectionLifetime`, типизированные клиенты, политики ретраев и таймаутов.
- `CancellationToken` через всю цепочку до базы: что реально отменяется, а что нет, и как это связано с разрывом соединения клиентом.
- Graceful shutdown: `SIGTERM`, `IHostApplicationLifetime`, время на завершение запросов, взаимодействие с readiness-пробой и балансировщиком.
- Идемпотентный `POST`: ключ идемпотентности, хранилище, поведение при конкурентных повторах, срок хранения.
- Большие ответы: стриминг, `IAsyncEnumerable`, отключение response buffering, `PipeWriter`.
- Rate limiting: стратегии (fixed window, sliding window, token bucket, concurrency), распределённый лимит на нескольких инстансах и его цена.
- Health checks: liveness против readiness, зависимости в проверках, почему приложение «здорово» по проверке, но недоступно для пользователей.
- Версионирование API, обратная совместимость, как не ломать клиентов при изменении контракта.

**На чём валятся**

- Не могут объяснить, почему scoped-сервис в singleton опасен именно в рантайме, а не при компиляции.
- Создают `HttpClient` вручную или держат статический без пересоздания соединений.
- Кладут проверку базы в liveness и получают каскадные перезапуски.
- Не думают про потерю запросов при деплое.

## EF Core и доступ к данным под нагрузкой

```yaml
slug: ef-core-under-load
questions: ef-core-kak-optimizirovat-medlennyi-ef-core-zapros, ef-core-pochemu-projection-chasto-luchshe-include, ef-core-kak-vybrat-mezhdu-single-query-i-split-query-pri-zagruzke-neskolkih-kollekcii-i, ef-core-kak-ef-core-keshiruet-translyaciyu-linq-zaprosov-i-pochemu-konstanty-i-contains, ef-core-chto-obhodyat-executeupdate-i-executedelete-i-kak-sovmeschat-ih-s-otslezhivaemym, ef-core-kak-ustroen-pul-dbcontext-i-chto-lomaetsya-pri-perehode-na-adddbcontextpool, ef-core-kakie-podvodnye-kamni-u-global-query-filters-pri-soft-delete-i-multi-tenancy, ef-core-kak-rabotaet-optimistic-concurrency, ef-core-kogda-ispolzovat-dapper-vmesto-ef-core
articles: ef-changetracker, zagruzka-svyazey-i-n-plus-1, translyaciya-iqueryable-v-sql, ef-tranzakcii-i-urovni-izolyacii, kogda-orm-meshaet
puzzles: ef-core-ienumerable-vmesto-iqueryable, ef-core-trekking-povtornyj-zapros, ef-core-n-plus-1-lazy-loading
```

**Что нужно знать**

- Change tracker: как определяет изменения (снимки против прокси), стоимость при тысячах сущностей, `AsNoTracking` и `AsNoTrackingWithIdentityResolution`, массовые операции.
- Загрузка связей: `Include` против проекции в `Select`, декартово произведение, single query и split query и их компромиссы (согласованность и количество запросов).
- N+1: как обнаружить (логи SQL, метрики числа запросов на запрос), как лечить.
- Трансляция LINQ в SQL: что не транслируется и вычисляется на клиенте, кеш запросов: до EF Core 8 константы и `Contains` с переменным списком плодили разные SQL и портили кеш; с EF Core 8 список передаётся одним параметром-массивом (`= ANY(@p)` в Npgsql, `OPENJSON` в SQL Server), и остаётся вопрос generic-плана и оценки кардинальности.
- `ExecuteUpdate`/`ExecuteDelete`: что обходят (трекер, интерцепторы, часть событий), как сочетать с отслеживаемыми сущностями.
- `DbContext` и пул: время жизни, потокобезопасность (нет), `AddDbContextPool`, что ломается при пуле (состояние в контексте).
- Пул соединений провайдера: размер, исчерпание, связь с длительными транзакциями и `async`.
- Global query filters: мягкое удаление и мультиарендность, подводные камни (навигации, `IgnoreQueryFilters`, производительность).
- Конкурентность: оптимистичная (токен конкурентности, `rowversion`/`xmin`) и пессимистичная, обработка `DbUpdateConcurrencyException`.
- Транзакции и уровни изоляции в EF, явные транзакции, стратегии повторов при временных сбоях.
- Скомпилированные запросы, сырой SQL, Dapper: когда ORM мешает и как совмещать подходы.

**На чём валятся**

- Не знают, что `ToList()` перед `Where` переносит фильтрацию в память.
- Лечат N+1 через `Include` и получают взрыв строк.
- Не понимают, как поведёт себя код при конфликте конкурентных обновлений.
- Не могут сказать, что реально отправляется в базу, и не смотрят SQL.

## PostgreSQL глубоко

```yaml
slug: postgresql-deep
questions: advanced-postgresql-kak-ustroen-mvcc-v-postgresql-i-pochemu-update-sozdaet-novuyu-versiyu, advanced-postgresql-chem-otlichayutsya-urovni-izolyacii-na-praktike-i-kakie-anomalii-ostay, advanced-postgresql-kogda-stoit-vybrat-select-for-update-a-kogda-optimistichnuyu-blokirovk, advanced-postgresql-pochemu-deadlock-voznikaet-pri-obnovlenii-v-raznom-poryadke-i-kak-etog, advanced-postgresql-kak-diagnostirovat-blokirovki-i-naiti-zapros-derzhaschii-ih, advanced-postgresql-chto-takoe-bloat-tablic-i-indeksov-kak-ego-obnaruzhit-i-ubrat, advanced-postgresql-pochemu-autovacuum-ne-uspevaet-i-kak-ego-nastraivat-pod-vysokuyu-nagru, advanced-postgresql-kak-planirovschik-ocenivaet-stoimost-plana-i-pochemu-oshibaetsya-na-ko, advanced-postgresql-chto-takoe-transaction-id-wraparound-i-chem-on-ugrozhaet-prodakshenu, advanced-postgresql-kak-bezopasno-sozdat-indeks-na-bolshoi-tablice-v-prodakshene, advanced-postgresql-kak-rabotaet-wal-i-kak-on-vliyaet-na-skorost-zapisi, advanced-postgresql-chto-takoe-replication-lag-kak-ego-izmeryat-i-kakie-posledstviya-u-cht, advanced-postgresql-zachem-nuzhen-pgbouncer-i-kakie-vozmozhnosti-postgresql-lomaet-transac
articles: mvcc-i-vacuum, explain-i-plan-zaprosa, pg-urovni-izolyacii, pg-blokirovki-i-deadlock, indeksy-btree-gin-brin
puzzles: postgresql-not-in-s-null, postgresql-like-s-vedushchim-procentom
```

**Что нужно знать**

- MVCC: версии строк (`xmin`/`xmax`), почему `UPDATE` создаёт новую версию, видимость строк для транзакции, что такое snapshot.
- VACUUM и autovacuum: что очищают, почему не успевают (долгие транзакции, настройки порогов, слишком медленный cost limit), bloat таблиц и индексов, как его обнаружить и убрать.
- Transaction ID wraparound: механика, признаки, почему это аварийная ситуация.
- Уровни изоляции на практике: Read Committed, Repeatable Read, Serializable; какие аномалии остаются; ретраи при serialization failure.
- Блокировки: режимы блокировок строк и таблиц, `SELECT ... FOR UPDATE`, `SKIP LOCKED`, `NOWAIT`, advisory locks, как найти блокирующий запрос (`pg_stat_activity`, `pg_locks`).
- Deadlock: типичная причина (разный порядок обновления), как проектировать порядок и как ловить в логах.
- `EXPLAIN (ANALYZE, BUFFERS)`: чтение плана, оценка и фактические строки, типы соединений и сканирований, откуда берутся ошибки оценки.
- Статистика планировщика, расширенная статистика, `ANALYZE`, переход с Index Scan на Seq Scan и причины.
- Индексы: B-tree, GIN, BRIN, частичные и покрывающие, составные и порядок колонок, почему индекс может не использоваться (функция над колонкой, приведение типов, низкая селективность).
- Безопасные изменения схемы: `CREATE INDEX CONCURRENTLY`, добавление колонки с default, `NOT VALID` для ограничений, короткий `lock_timeout`.
- Пулинг соединений: у каждого соединения PostgreSQL отдельный процесс, поэтому нужен PgBouncer; в transaction mode ломается всё, что привязано к сессии: prepared statements (в том числе auto-prepare в Npgsql), session-level `SET`, advisory locks на уровне сессии, `LISTEN/NOTIFY`.
- Массовое удаление: батчи, партиции, нагрузка на WAL и репликацию.
- WAL, checkpoint, `synchronous_commit` и репликация: как это связано с надёжностью и задержкой записи.

**На чём валятся**

- Не могут объяснить, почему после массового `UPDATE` таблица раздулась и что с этим делать.
- Добавляют индекс «на всякий случай» без анализа плана и без понимания цены записи.
- Путают `NOT IN` и `NOT EXISTS` при наличии `NULL`.
- Меняют схему большой таблицы одной командой в рабочее время.

## Kafka и messaging

```yaml
slug: kafka-messaging
questions: kafka-advanced-kakie-garantii-dostavki-daet-kafka-i-kak-nastroiki-acks-i-retries-na-n, kafka-advanced-chto-proizoidet-pri-acks-1-i-padenii-lidera-particii, kafka-advanced-kak-rabotaet-min-insync-replicas-i-chto-proizoidet-pri-potere-replik, kafka-advanced-kak-rabotaet-exactly-once-v-kafka-i-kakova-ego-realnaya-cena, kafka-advanced-pochemu-dlya-konsistentnosti-s-bd-vybirayut-outbox-a-ne-tranzakcii-kaf, kafka-advanced-kak-vybrat-strategiyu-particionirovaniya-i-chto-proizoidet-pri-perekos, kafka-advanced-chto-proishodit-vo-vremya-consumer-rebalance-i-kak-minimizirovat-prost, kafka-advanced-chem-cooperative-rebalancing-luchshe-eager-i-kogda-stoit-perehodit, kafka-advanced-consumer-lag-rastet-lineino-kak-naiti-prichinu-i-chto-predprinyat, kafka-advanced-kak-sohranit-poryadok-soobschenii-pri-parallelnoi-obrabotke-vnutri-odn, kafka-advanced-kak-obrabatyvat-poison-message-ne-ostanavlivaya-obrabotku-vsei-partici, kafka-advanced-kak-realizovat-retry-s-zaderzhkoi-ne-blokiruya-particiyu
articles: kafka-model, kafka-particii-i-poryadok-sobytiy, kafka-consumer-groups, kafka-garantii-dostavki, kafka-obrabotka-oshibok-i-dlq
puzzles:
```

**Что нужно знать**

- Модель: лог, партиции, offsets, реплики, лидер и ISR, retention и compaction.
- Гарантии доставки на стороне продюсера: `acks`, `retries`, идемпотентный продюсер, `enable.idempotence`, `max.in.flight`; что происходит при `acks=1` и падении лидера.
- `min.insync.replicas` вместе с `acks=all`: компромисс между доступностью записи и надёжностью.
- Гарантии на стороне consumer: когда коммитить offset (до или после обработки), at-least-once и необходимость идемпотентной обработки.
- Exactly-once в Kafka: транзакции продюсера, `read_committed`, и почему это не exactly-once для побочных эффектов во внешних системах.
- Связь с базой данных: почему Outbox, а не двойная запись и не транзакции Kafka.
- Партиционирование: выбор ключа, перекос (hot partition), порядок только внутри партиции, безопасное увеличение числа партиций.
- Consumer groups и rebalance: что останавливается, cooperative и eager, static membership, как минимизировать простой.
- Consumer lag: что показывает, как искать причину (медленная обработка, перекос, ребалансы, GC), что делать, когда добавление consumer не помогает (упёрлись в число партиций).
- Порядок при параллельной обработке внутри партиции: очередь по ключу, пул воркеров по ключу.
- Обработка ошибок: poison message, DLQ, retry-топики с задержкой без блокировки партиции.
- Пропускная способность: batching, `linger.ms`, сжатие, размеры сообщений; эволюция схемы сообщений без простоя.

**На чём валятся**

- Говорят «Kafka гарантирует exactly-once» без оговорок.
- Не знают, что порядок сообщений гарантирован только внутри партиции.
- Коммитят offset до обработки и не понимают, что это потеря сообщений при сбое.
- Предлагают «добавить consumers» при числе consumers уже равном числу партиций.

## Микросервисы и распределённые системы

```yaml
slug: microservices-distributed
questions: distributed-systems-chto-realno-utverzhdaet-cap-teorema-i-kakie-vyvody-iz-nee-delayut-neve, distributed-systems-chto-takoe-read-your-writes-consistency-i-kak-obespechit-ee-pri-chteni, microservices-advanced-kak-opredelit-granicy-servisov-cherez-ddd-i-kakie-priznaki-govoryat-ob, distributed-systems-pochemu-raspredelennye-tranzakcii-cherez-two-phase-commit-ploho-massht, microservices-advanced-kak-realizovat-saga-i-v-chem-prakticheskaya-raznica-mezhdu-horeografie, distributed-systems-chto-dobavlyaet-pacelc-k-cap-i-pochemu-latency-vazhna-ne-menshe-consis, distributed-systems-pochemu-raspredelennaya-blokirovka-na-redis-nebezopasna-i-chto-predlag, microservices-advanced-kak-rabotaet-outbox-i-pochemu-bez-nego-vozmozhna-poterya-sobytiya, distributed-systems-kak-obespechit-idempotentnost-operacii-esli-klient-povtoryaet-zapros-p, distributed-systems-kak-realizovat-exactly-once-na-praktike-esli-set-nenadezhna, distributed-systems-chto-takoe-retry-storm-i-kak-ego-predotvratit-so-storony-servisa-i-kli, distributed-systems-kak-sproektirovat-timeout-budget-dlya-cepochki-iz-pyati-servisov, microservices-advanced-kak-kombinirovat-circuit-breaker-retry-i-timeout-chtoby-oni-ne-konflik
articles: cap-na-samom-dele, read-your-writes, pochemu-2pc-problematichen, ms-saga, ms-outbox, exactly-once-na-praktike
puzzles:
```

**Что нужно знать**

- CAP и PACELC без мифов: при разделении сети (partition) выбирают между согласованностью и доступностью, а без разделения сети остаётся выбор между латентностью и согласованностью.
- Модели согласованности: eventual, read-your-writes, monotonic reads, линеаризуемость; как обеспечить read-your-writes при чтении с реплик.
- Границы сервисов: bounded context, владение данными, признаки неправильной нарезки (распределённый монолит, синхронные цепочки, общая база).
- Почему 2PC плохо масштабируется и когда используют саги: оркестрация против хореографии, компенсирующие транзакции, шаги, которые нельзя откатить.
- Outbox и Inbox: атомарная запись состояния и события, доставка at-least-once, дедупликация на стороне получателя, чистка таблиц.
- Идемпотентность: ключи, хранилище, окно дедупликации, поведение при конкурентных повторах.
- Exactly-once как «at-least-once плюс идемпотентность», а не как свойство транспорта.
- Устойчивость: таймауты и timeout budget для цепочки сервисов, retry с экспоненциальной задержкой и jitter, retry storm, circuit breaker, bulkhead, как они комбинируются и не конфликтуют.
- Backpressure и load shedding: что делать, когда зависимость деградирует.
- Gray failure: сервис «жив», но медленно или частично отвечает; почему health check этого не видит.
- Распределённые блокировки и их хрупкость, выбор лидера, консенсус на уровне «зачем это нужно приложению».
- Версионирование контрактов и событий, contract testing, наблюдаемость цепочки через распределённую трассировку.

**На чём валятся**

- Путают «микросервисы» с «много сервисов» и защищают их без цены (операционные издержки, консистентность, отладка).
- Предлагают 2PC, не обсуждая отказ координатора (участники зависают, удерживая блокировки), и саги, не обсуждая, что делать при сбое компенсации.
- Ставят ретраи на каждом уровне цепочки и получают умножение нагрузки.
- Считают распределённую блокировку на Redis абсолютно надёжной.

## Архитектурные паттерны

```yaml
slug: architecture-patterns
questions: architecture-patterns-gde-solid-pomogaet-a-gde-sledovanie-emu-uslozhnyaet-kod-bez-polzy, architecture-patterns-kak-vyglyadit-narushenie-liskov-substitution-principle-na-realnom-prim, architecture-patterns-kak-primenit-dependency-inversion-ne-sozdavaya-interfeis-na-kazhdyi-kl, architecture-patterns-chem-geksagonalnaya-arhitektura-otlichaetsya-ot-sloenoi-na-praktike, architecture-patterns-chto-daet-clean-architecture-i-kakova-cena-ee-strogogo-soblyudeniya, architecture-patterns-kogda-pattern-repository-poverh-orm-izbytochen, architecture-patterns-kogda-strategy-luchshe-konstrukcii-switch-i-kogda-naoborot, architecture-patterns-kakuyu-zadachu-reshaet-mediator-i-pochemu-on-chasto-prevraschaetsya-v, architecture-patterns-privedite-primer-gde-pattern-navredil-proektu, architecture-patterns-kak-ponyat-chto-abstrakciya-prezhdevremenna, architecture-patterns-kak-prinimat-arhitekturnye-resheniya-i-kak-ih-dokumentirovat, architecture-patterns-kak-obosnovat-tehdolg-pered-biznesom-i-prioritizirovat-ego
articles: clean-architecture-i-ee-cena, cqrs-razdelenie-komand-i-zaprosov, repository-poverh-orm, adr-dokumentirovanie-resheniy, tehdolg-i-razgovor-s-biznesom
puzzles:
```

**Что нужно знать**

- SOLID как инструмент, а не догма: где принцип снижает стоимость изменений, а где порождает интерфейс на каждый класс без пользы.
- Нарушение LSP на реальном коде: контракты, предусловия и постусловия, типичные примеры в иерархиях и коллекциях.
- Dependency Inversion без «интерфейса на всё»: абстракция там, где есть реальная граница (ввод-вывод, внешняя система, точка расширения).
- Слоистая, гексагональная и Clean Architecture: направление зависимостей, кто владеет интерфейсом хранилища, цена строгого соблюдения (мапперы, boilerplate).
- Репозиторий поверх ORM: когда он избыточен (`DbContext` уже репозиторий и Unit of Work), когда оправдан (изоляция от ORM, сложные запросы, тестируемость).
- Strategy против `switch`, Decorator против наследования, Proxy против Decorator, Adapter при интеграциях, Factory против конструктора: выбор по причине изменения.
- Mediator и CQRS: что решают, во что превращаются без дисциплины, как влияют на навигацию по коду.
- Преждевременные абстракции: признаки, цена, как откатывать.
- Модульный монолит как альтернатива микросервисам: границы модулей, правила зависимостей, проверка архитектурными тестами.
- ADR: что записывать, как фиксировать отвергнутые альтернативы, как возвращаться к решению.
- Техдолг: как измерять, как приоритизировать, как обосновывать бизнесу языком риска и стоимости задержки.

**На чём валятся**

- Перечисляют паттерны из учебника и не могут привести пример, где паттерн навредил.
- Защищают Clean Architecture во всех проектах независимо от размера.
- Не умеют объяснить архитектурное решение через требования и ограничения, только через «так принято».
- Описывают техдолг как «плохой код», а не как риск с ценой.

## DevOps и наблюдаемость

```yaml
slug: devops-observability
questions: devops-senior-kak-sobrat-minimalnyi-obraz-net-prilozheniya-i-chto-daet-multi-stage-s, devops-senior-kak-nastroit-limity-cpu-i-pamyati-dlya-net-v-kubernetes-chtoby-ne-polu, devops-senior-pochemu-prilozhenie-rabotaet-medlennee-pri-limite-cpu-i-kak-eto-svyaza, devops-senior-chem-readiness-otlichaetsya-ot-liveness-i-chto-proizoidet-pri-ih-putan, devops-senior-kak-nastroit-graceful-shutdown-v-kubernetes-chtoby-ne-teryat-zaprosy-p, devops-senior-kak-ustroen-rolling-deployment-i-chto-proizoidet-pri-nesovmestimoi-mig, devops-senior-kak-nakatyvat-migracii-bazy-dannyh-pri-neskolkih-instansah-prilozheniy, devops-senior-kak-organizovat-canary-deploi-i-po-kakim-metrikam-prinimat-reshenie-ob, devops-senior-chto-dolzhno-popadat-v-metriki-a-chto-v-logi-i-pochemu-eto-raznye-inst, devops-senior-kak-vybrat-sli-i-slo-dlya-servisa-i-chto-delat-pri-ischerpanii-error-b, devops-senior-kakie-alerty-deistvitelno-nuzhny-i-kak-izbezhat-ustalosti-ot-opovesche, devops-senior-kak-nastroit-opentelemetry-v-net-i-chto-instrumentirovat-v-pervuyu-och
articles: k8s-limity-cpu-i-pamyati, k8s-readiness-vs-liveness, rolling-blue-green-canary, migracii-bd-pri-neskolkih-replikah, opentelemetry-v-dotnet
puzzles:
```

**Что нужно знать**

- Образ .NET-приложения: multi-stage сборка, минимальный runtime-образ, запуск не от root, размер и поверхность атаки.
- Лимиты в Kubernetes: requests и limits для CPU и памяти, CPU throttling и его эффект на latency, связь лимита памяти с поведением GC и OOMKill.
- Пробы: liveness, readiness, startup; что произойдёт при их путанице; зависимости в проверках.
- Graceful shutdown: `preStop`, `terminationGracePeriodSeconds`, снятие инстанса с балансировки, завершение in-flight запросов и фоновой обработки.
- Стратегии деплоя: rolling, blue-green, canary; по каким метрикам принимать решение о продолжении и откате; feature flags.
- Миграции базы при нескольких инстансах и rolling-деплое: совместимость схемы с двумя версиями кода, подход expand/contract, кто и когда запускает миграцию.
- CI/CD: быстрый и безопасный откат, артефакт собирается один раз, защита цепочки поставки.
- Три столпа наблюдаемости: что в логи, что в метрики, что в трассировки; корреляция через trace id.
- OpenTelemetry в .NET: что инструментировать первым, семплирование (head и tail), как не потерять редкие ошибки.
- SLI, SLO и error budget: как выбирать индикаторы, что делать при исчерпании бюджета.
- Алерты без шума: алерт на симптом для пользователя, а не на причину; runbook на каждый алерт; усталость от оповещений.
- Секреты и их ротация без простоя; нагрузочное тестирование в окружении, близком к проду.

**На чём валятся**

- Ставят низкий CPU limit для bursty-нагрузки и удивляются троттлингу и скачкам latency.
- Ставят проверку зависимостей в liveness.
- Не знают, как выкатить несовместимую миграцию без остановки сервиса.
- Алертят на загрузку CPU и получают ночные ложные срабатывания.

## Алгоритмы для Senior

```yaml
slug: algorithms-senior
questions: algorithms-kak-realizovat-lru-cache, algorithms-kak-naiti-top-k-elementov, algorithms-kak-ocenit-pamyat-kotoruyu-ispolzuet-algoritm, algorithms-kakie-problemy-mogut-vozniknut-pri-glubokoi-rekursii, algorithms-pochemu-amortizirovannaya-o-1-mozhet-davat-spaiki-latentnosti-i-kak-etogo-izb, algorithms-kak-otsortirovat-ili-deduplicirovat-dannye-kotorye-ne-pomeschayutsya-v-pamyat, algorithms-kogda-tochnost-mozhno-obmenyat-na-pamyat-kak-rabotayut-bloom-filter-hyperlogl, algorithms-kak-opredelit-poryadok-vypolneniya-i-naiti-cikly-v-grafe-zavisimostei, algorithms-kak-schitat-percentili-latentnosti-na-potoke-ne-hranya-vse-izmereniya
articles: algo-ocenka-pamyati, algo-rekursiya-i-perepolnenie-steka, drill-top-k, algo-dfs-i-bfs, algo-dinamicheskoe-programmirovanie
puzzles:
```

**Что нужно знать**

- Оценка сложности по времени и по памяти, амортизированная сложность и её побочный эффект: редкие дорогие операции (рост `List<T>`, ресайз хеш-таблицы) дают всплески latency.
- Выбор структуры данных под нагрузку: `Dictionary`, `HashSet`, `SortedDictionary`, куча (`PriorityQueue`), массив и список, их цена по памяти и кешам процессора.
- LRU-кеш: хеш-таблица и двусвязный список, потокобезопасность, альтернативы (`MemoryCache`, вытеснение по времени), поведение при конкурентном доступе.
- Top-K: куча размера K против сортировки, потоковый вариант, объединение результатов с нескольких шардов.
- Внешняя сортировка и дедупликация данных, не помещающихся в память: разбиение на чанки, слияние, хеш-партиционирование.
- Вероятностные структуры: Bloom filter, HyperLogLog, Count-Min Sketch; что обменивают (точность на память), как оценивать ошибку.
- Процентили на потоке без хранения всех измерений: гистограммы, t-digest, HDR histogram.
- Топологическая сортировка и поиск циклов в графе зависимостей, порядок выполнения задач.
- Рекурсия: глубина стека, переход на итерацию с явным стеком, хвостовая рекурсия в .NET не оптимизируется гарантированно.
- Обход графов и деревьев: BFS против DFS и когда какой, память на хранение фронта.
- Динамическое программирование: выделение подзадач, оптимизация памяти до одной строки или двух.
- Оценка в терминах продакшена: размер данных, число запросов, что поместится в память одного инстанса.

**На чём валятся**

- Называют сложность, но не оценивают память и константы.
- Решают задачу в предположении, что все данные помещаются в память, и не готовы обсуждать поток.
- Реализуют LRU без учёта конкурентного доступа.
- Не видят, что амортизированная `O(1)` может давать пики на конкретном запросе.

## System Design кратко

```yaml
slug: system-design-short
questions: system-design-senior-sproektiruite-sistemu-na-100-000-rps-s-chego-nachnete-i-chto-stanet-uz, system-design-senior-chto-takoe-rto-i-rpo-i-kak-vybrannye-znacheniya-menyayut-arhitekturu, system-design-senior-kak-vybrat-shemu-shardirovaniya-i-chto-delat-pri-neobhodimosti-reshard, system-design-senior-kak-sproektirovat-active-active-v-dvuh-regionah-i-kak-reshat-konflikty, system-design-senior-kak-pereshardirovat-dannye-bez-prostoya, system-design-senior-kak-predotvratit-cache-stampede-pri-invalidacii-populyarnogo-klyucha, system-design-senior-kak-reshat-konflikt-mezhdu-consistency-i-availability-v-oplate-zakaza, system-design-senior-sproektiruite-sistemu-obrabotki-platezhei-s-garantiei-odnokratnogo-spi, system-design-senior-sproektiruite-otkazoustoichivyi-servis-uvedomlenii-s-prioritetami, system-design-senior-sproektiruite-obrabotku-milliona-sobytii-v-sekundu-s-garantiei-otsutst, system-design-senior-chto-proizoidet-pri-nedostupnosti-redis-i-kak-zaranee-sproektirovat-de, system-design-senior-kak-postroit-sistemu-perezhivayuschuyu-nedostupnost-postgresql-v-teche
articles: kak-prohodit-dizayn-sekciyu, sistema-na-100000-rps, obrabotka-platezhey, poisk-bottleneck, cache-stampede
puzzles:
```

**Что нужно знать**

- Структура ответа: функциональные и нефункциональные требования, оценка нагрузки (RPS, объём хранения, пропускная способность), API и модель данных, укрупнённая схема, углубление в узкие места, отказы и мониторинг.
- Оценка «на салфетке»: пиковый RPS из суточного объёма, размер хранилища за год, число инстансов, размер пула соединений.
- Поиск узкого места по цепочке (балансировщик, приложение, кеш, база, внешние зависимости) и порядок его устранения: сначала дешёвые меры, потом шардирование.
- Масштабирование: вертикальное и горизонтальное, stateless-сервисы, реплики на чтение и их лаг, шардирование и выбор ключа, перешардирование без простоя.
- Кеширование: уровни, инвалидация, cache stampede и способы защиты (блокировка, вероятностное раннее обновление, stale-while-revalidate), поведение при падении кеша.
- Согласованность в платежах и заказах: идемпотентность, outbox, саги, единственное списание, что показывать пользователю при неопределённом исходе.
- Асинхронная обработка: очереди и Kafka, порядок, дедупликация, DLQ, приоритеты уведомлений.
- Отказоустойчивость: что происходит при потере зоны, региона, базы, Redis; RTO и RPO и как они меняют архитектуру; как проверять план восстановления.
- Multi-region: active-passive против active-active, разрешение конфликтов, цена задержки между регионами.
- Поведение при росте нагрузки в десять раз: что сломается первым и что заранее подготовить.
- Наблюдаемость и эксплуатация как часть дизайна: метрики, алерты, ёмкость, деградация вместо отказа.

**На чём валятся**

- Сразу рисуют микросервисы, Kafka и Redis, не задав ни одного уточняющего вопроса.
- Не оценивают нагрузку и поэтому не могут обосновать ни шардирование, ни его отсутствие.
- Описывают только счастливый путь и не отвечают на вопрос «а если упадёт вот это».
- Не говорят про мониторинг и операционные аспекты вообще.
