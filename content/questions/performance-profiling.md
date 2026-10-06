# Производительность и профилирование

Вопросы категории `performance-profiling` в формате импорта (`tools/questions.md`): 18 шт.

```bash
node tools/import-questions.mjs --file content/questions/performance-profiling.md --dry-run
node tools/import-questions.mjs --file content/questions/performance-profiling.md --url … --email … --update
```

---

## Как построить корректный бенчмарк на BenchmarkDotNet и какие ошибки его обесценивают?

```yaml
category: performance-profiling
level: senior
difficulty: 4
slug: performance-profiling-kak-postroit-korrektnyi-benchmark-na-benchmarkdotnet-i-kakie-oshibki-e
tags: benchmarking, tooling
```

Корректный бенчмарк сравнивает варианты на одинаковых, реалистичных входных данных, в Release-сборке, без подключённого отладчика, с прогревом и статистикой, а результат каждой итерации потребляется, чтобы JIT не выкинул работу. BenchmarkDotNet закрывает механику (отдельный процесс, прогрев, пилотные итерации, выбросы, доверительные интервалы), но не спасает от неправильно поставленного эксперимента.

**Минимальный каркас:**

```csharp
[MemoryDiagnoser]
[HideColumns("Error", "StdDev")]
public class ParseBenchmarks
{
    private string[] _lines = default!;

    [Params(100, 10_000)]
    public int Count;

    [GlobalSetup]
    public void Setup()
    {
        var rnd = new Random(42);
        _lines = Enumerable.Range(0, Count)
            .Select(_ => $"{rnd.Next()};{rnd.NextDouble():F4};item-{rnd.Next(1000)}")
            .ToArray();
    }

    [Benchmark(Baseline = true)]
    public long Split()
    {
        long sum = 0;
        foreach (var line in _lines)
            sum += int.Parse(line.Split(';')[0]);
        return sum;
    }

    [Benchmark]
    public long Span()
    {
        long sum = 0;
        foreach (var line in _lines)
        {
            var s = line.AsSpan();
            sum += int.Parse(s[..s.IndexOf(';')]);
        }
        return sum;
    }
}
```

```bash
dotnet run -c Release -- --filter "*ParseBenchmarks*" --runtimes net8.0 net10.0
```

**Что делает BenchmarkDotNet за вас:** запускает каждый бенчмарк в отдельном процессе, выполняет прогрев (Tier 0 → Tier 1, PGO), подбирает число вызовов на итерацию так, чтобы итерация длилась достаточно долго для точного таймера, вычитает overhead пустого вызова, считает Mean/Median/StdDev, отбрасывает выбросы и предупреждает о бимодальном распределении. `[MemoryDiagnoser]` добавляет `Allocated` на операцию и число сборок Gen0/1/2 на 1000 операций — для серверного кода это часто важнее времени.

**Ошибки, которые обесценивают результат:**

- **Debug-сборка или отладчик.** BDN по умолчанию откажется запускаться, но через `--job dry` или ручной Stopwatch-код это легко пропустить.
- **Dead code elimination.** Метод возвращает `void`, а результат никуда не идёт — JIT вправе выбросить вычисление. Всегда возвращайте результат или используйте `Consumer`.
- **Константные входы.** `int.Parse("123")` с литералом — JIT может свернуть часть работы, а branch predictor идеально выучит путь. Данные должны быть разнообразными и генерироваться в `[GlobalSetup]` с фиксированным seed.
- **Подготовка внутри бенчмарка.** Создание входных данных, `new List` или чтение файла в теле `[Benchmark]` измеряет не то. Если состояние нужно сбрасывать каждый раз, `[IterationSetup]` подходит только для долгих операций (от ~100 мс) — для микрооперации он ломает точность.
- **Неравные условия.** Один вариант работает с отсортированным массивом, другой — с перемешанным; один с прогретым кэшем, другой без.
- **Один размер данных.** O(n²) алгоритм выигрывает на 10 элементах и проигрывает на 10 000. Используйте `[Params]`.
- **Игнорирование аллокаций.** Вариант на 5% быстрее, но аллоцирует в 10 раз больше — под нагрузкой в проде он проиграет за счёт GC.
- **Шумная машина.** Ноутбук на батарее, включённый Teams, турбобуст, виртуалка с соседями. Для сравнения важна одна и та же машина и `StdDev` много меньше разницы между вариантами.
- **Чтение только Mean.** Смотрите на Error/StdDev, гистограмму и Ratio относительно baseline. Разница в 3% при StdDev 5% — это шум.

**Полезные инструменты сверху:** `[DisassemblyDiagnoser]` показывает машинный код (видно, что JIT убрал проверки границ или не сделал инлайнинг), `[ThreadingDiagnoser]` и `[ExceptionDiagnoser]` — contention и исключения, `EventPipeProfiler` снимает трассировку прямо из бенчмарка.

**Что спрашивают дальше:** почему `Stopwatch` в цикле на 1000 итераций врёт (нет прогрева, JIT tier-up посреди измерения, GC попадает в случайные итерации), как сравнить два рантайма или два NuGet-пакета (`--runtimes`, `Job.WithNuGet`), чем `OperationsPerInvoke` помогает для наносекундных операций.

## Почему результат микробенчмарка часто не воспроизводится в проде?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-pochemu-rezultat-mikrobenchmarka-chasto-ne-vosproizvoditsya-v-prode
tags: benchmarking, performance
```

Микробенчмарк измеряет код в стерильных условиях: горячий кэш процессора, один поток, нет конкуренции за память и блокировки, идеально предсказуемые ветки, Tier 1 с PGO под один тип входных данных и GC, который почти не работает. В проде всё это нарушается одновременно, поэтому «в 3 раза быстрее» в бенчмарке часто превращается в «незаметно» или даже «хуже» на реальной нагрузке.

**Главные причины расхождения:**

- **Кэши CPU.** В бенчмарке рабочий набор данных умещается в L1/L2 и переиспользуется миллионы раз. В проде между двумя вызовами вашего метода выполняется чужой код, который вытесняет кэш. Алгоритм, выигрывающий за счёт таблицы поиска на 64 КБ, в проде платит cache miss на каждом обращении.
- **Branch prediction.** На одинаковых входах предсказатель выучивает путь, и `if` становится бесплатным. На реальном распределении данных — misprediction по 15–20 тактов.
- **Профиль JIT.** Dynamic PGO в бенчмарке видит один конкретный тип в интерфейсном вызове и девиртуализирует его с guarded devirtualization. В проде через тот же call site идут пять реализаций, и оптимизация не срабатывает или срабатывает хуже.
- **GC и аллокации.** Бенчмарк с аллокацией 200 байт на вызов показывает наносекунды: Gen0 почти пуст и сборка дешёвая. В проде сотни потоков аллоцируют параллельно, Gen0 GC идут постоянно, объекты из долгих запросов переживают сборки и попадают в Gen1/Gen2. Стоимость аллокации — это не `new`, а последующая работа GC, и она нелинейна.
- **Конкуренция.** Однопоточный бенчмарк не видит lock contention, false sharing, ожидания в пуле потоков и пропускную способность памяти, которая делится между ядрами.
- **Окружение.** CPU-лимит контейнера и CFS-троттлинг, другой процессор (AVX-512 есть на машине разработчика и нет на облачном инстансе), другой режим GC (Workstation в BDN-процессе против Server в ASP.NET Core), включённые/выключенные `TieredPGO`, `TieredCompilation`, ReadyToRun.
- **Доля в общем времени.** Самая частая причина: ускорили функцию, которая занимает 2% времени запроса. По закону Амдала даже бесконечное ускорение даст 2%. Остальное — сеть, БД, сериализация.

```text
Запрос 40 мс:  БД 28 мс | JSON 6 мс | бизнес-логика 1 мс | прочее 5 мс
Бизнес-логику ускорили в 10 раз: 40 → 39.1 мс
```

**Как сделать измерения ближе к реальности:**

1. **Сначала профиль прода, потом бенчмарк.** Берите `dotnet-trace` с реального сервиса, находите горячие методы по inclusive time и бенчмаркайте только их.
2. **Реальные данные.** Выгрузите выборку настоящих payload'ов (обезличенных) и гоняйте бенчмарк по ним, а не по `"hello"`.
3. **Настройки рантайма как в проде.** В BDN можно задать `Job.Default.WithGcServer(true).WithGcConcurrent(true)` и нужный рантайм.
4. **Многопоточный вариант.** Для разделяемых структур — бенчмарк с `Parallel.For` или отдельный нагрузочный тест.
5. **Проверка в конце — только в проде или в нагрузке.** A/B через canary с метриками p50/p99, CPU на запрос, `alloc-rate`, `time-in-gc`. Если метрики не сдвинулись, оптимизацию стоит откатить ради простоты кода.

**Обратная ситуация тоже бывает:** бенчмарк показывает «одинаково», а в проде выигрыш заметный — обычно потому, что оптимизация убрала аллокации, и выигрыш проявляется через меньшую частоту GC под нагрузкой, а не через время одного вызова.

**Что спрашивают дальше:** как оценить вклад конкретного метода в latency запроса (inclusive time в трассировке, span'ы OpenTelemetry), почему ReadyToRun-код без tier-up медленнее и как это влияет на первые минуты после деплоя.

## Как снять трассировку в проде через dotnet-trace, не уронив сервис?

```yaml
category: performance-profiling
level: senior
difficulty: 4
slug: performance-profiling-kak-snyat-trassirovku-v-prode-cherez-dotnet-trace-ne-uroniv-servis
tags: tooling, profiling
```

`dotnet-trace` работает через EventPipe — встроенный в рантайм механизм, без подключения отладчика и без остановки процесса, поэтому он безопасен для прода при трёх условиях: ограниченный набор провайдеров, ограниченная длительность и место для файла. Опасны не сами трассировки, а «включить всё на Verbose на полчаса» — это реальный overhead по CPU, памяти буфера и диску.

**Как это устроено.** Утилита подключается к diagnostic port процесса (на Linux — Unix domain socket `dotnet-diagnostic-{pid}-…-socket` в `$TMPDIR`, по умолчанию `/tmp`) и просит рантайм включить набор провайдеров. События пишутся в кольцевой буфер внутри процесса (по умолчанию 256 МБ, `--buffersize`) и стримятся в файл `.nettrace`. Если файл не успевает записываться, события теряются, а не блокируют приложение.

**Типовой сценарий — CPU-профиль на 30 секунд:**

```bash
dotnet-trace ps
dotnet-trace collect -p 1 --profile cpu-sampling --duration 00:00:00:30 -o /tmp/cpu.nettrace
```

`cpu-sampling` включает `Microsoft-DotNETCore-SampleProfiler` (снимок стеков всех управляемых потоков примерно раз в миллисекунду) и базовые события рантайма. Список профилей в вашей версии инструмента — `dotnet-trace list-profiles`.

**Узкий набор провайдеров вместо профиля:**

```bash
dotnet-trace collect -p 1 --duration 00:00:01:00 \
  --providers Microsoft-Windows-DotNETRuntime:0x1:4
```

`0x1` — ключевое слово GC, уровень 4 — Informational: только начало/конец сборок и паузы, этого хватает, чтобы понять, виноват ли GC. Для аллокаций есть профиль `gc-verbose` (события `AllocationTick` примерно каждые 100 КБ аллокаций) — он заметно тяжелее, держите его секундами, а не минутами.

**Что делает трассировку опасной:**

- **Verbose-уровни и широкие keywords.** `Microsoft-Windows-DotNETRuntime` со всеми keywords на Verbose генерирует события на каждую аллокацию, JIT, загрузку типов — на нагруженном сервисе это десятки процентов CPU и гигабайты в минуту.
- **Собственные EventSource и `Microsoft-Extensions-Logging` на Debug** — каждое лог-сообщение становится событием.
- **Диск.** В контейнере файл ляжет в эфемерное хранилище; при превышении `ephemeral-storage` kubelet выселит под. Пишите в смонтированный `emptyDir` с лимитом или сразу копируйте наружу.
- **Без `--duration`.** Забытая сессия продолжит писать после того, как вы отключились. Всегда ставьте ограничение по времени.
- **Тяжёлая пост-обработка.** `--format speedscope` конвертирует на той же машине — лучше скопировать `.nettrace` и конвертировать локально.

**В Kubernetes** у прод-образа обычно нет SDK. Варианты: положить в образ standalone-бинарник `dotnet-trace`; запустить отладочный контейнер с общим `/tmp` (сокет должен быть виден инструменту); использовать `dotnet-monitor` как sidecar с HTTP API (`/trace?pid=…&durationSeconds=30`) и аутентификацией. Последний вариант удобнее всего для регулярного использования и автоматических триггеров по метрикам.

**Анализ.** `.nettrace` открывается в PerfView или Visual Studio; `speedscope` — в браузере. Смотрите на inclusive time сверху вниз (какой запрос дорогой) и exclusive time снизу вверх (какой метод реально жжёт CPU). Помните ограничения: SampleProfiler видит только управляемые стеки, нативный код и ядро — нет; для них нужен `perf` с `DOTNET_PerfMapEnabled=1`.

**Как снизить риск дополнительно:** сначала снимите на одном поде из N (через Service он и так получает часть трафика), сравните p99 этого пода с соседями во время записи, и только потом расширяйте.

**Что спрашивают дальше:** почему в профиле async-кода стеки выглядят разорванными (продолжения выполняются на потоках пула, нужна логическая склейка в PerfView/VS), чем EventPipe отличается от ETW и `perf`, как собрать трассировку старта процесса (`dotnet-trace collect -- dotnet app.dll` или `DOTNET_DiagnosticPorts` с `suspend`).

## Какие метрики dotnet-counters смотреть первыми при деградации производительности?

```yaml
category: performance-profiling
level: senior
difficulty: 4
slug: performance-profiling-kakie-metriki-dotnet-counters-smotret-pervymi-pri-degradacii-proizvodi
tags: tooling, observability
```

Первыми смотрят метрики, которые разделяют четыре гипотезы: процесс упирается в CPU, в GC, в пул потоков (блокировки и sync-over-async) или ждёт что-то внешнее. Это CPU usage, время в GC и скорость аллокаций, длина очереди и число потоков пула, lock contention, исключения в секунду и число активных запросов.

```bash
dotnet-counters monitor -p 1 --refresh-interval 2 \
  --counters System.Runtime,Microsoft.AspNetCore.Hosting,Microsoft-AspNetCore-Server-Kestrel,System.Net.Http
```

**Как читать в связке:**

| Метрика | Что означает рост | Следующий шаг |
| --- | --- | --- |
| `cpu-usage` (`dotnet.process.cpu.time`) около лимита | CPU-bound: алгоритм, сериализация, GC | `dotnet-trace --profile cpu-sampling` |
| `% Time in GC since last GC` / `dotnet.gc.pause.time` | давление на GC | `alloc-rate`, число Gen2 |
| `alloc-rate` (`dotnet.gc.heap.total_allocated` в секунду) | горячий путь аллоцирует | `gc-verbose` трассировка или `[MemoryDiagnoser]` |
| `gen-2-gc-count` растёт заметно | долгоживущие объекты, LOH-аллокации | дамп или `dotnet-gcdump` |
| `threadpool-queue-length` > 0 устойчиво | работы больше, чем потоков | смотреть, чем заняты потоки |
| `threadpool-thread-count` растёт ступеньками | пул инжектит потоки — блокирующие вызовы | `dotnet-stack report` или дамп + `pstacks` |
| `monitor-lock-contention-count` | конкуренция за `lock` | трассировка с contention-событиями |
| `exception-count` | исключения как control flow или каскад ошибок | логи, first-chance события |
| `current-requests` / `http.server.active_requests` растёт при том же RPS | запросы стали дольше (закон Литтла) | по какой зависимости ждут |
| `connection-queue-length`, `request-queue-length` (Kestrel) | сервер не успевает принимать | CPU или пул потоков |
| `requests-failed`, `requests-started` в System.Net.Http | проблема исходящих вызовов | трассировки, connection pool |

**Именование.** До .NET 9 `System.Runtime` публиковал EventCounters с именами вида `time-in-gc`, `alloc-rate`, `threadpool-queue-length`. В .NET 9+ появился `System.Runtime` Meter с OpenTelemetry-совместимыми именами (`dotnet.gc.collections`, `dotnet.thread_pool.queue.length`, `dotnet.monitor.lock_contentions`, `dotnet.exceptions`). Свежий `dotnet-counters` показывает то, что публикует конкретный рантайм; в дашбордах Prometheus/Grafana имена будут из Meter-варианта.

**Классические картины:**

- **CPU 100%, GC 5%, очередь пула пуста** — чистый CPU-bound код, идём в CPU-профиль.
- **CPU 40%, queue length растёт, thread count растёт на 1–2 в секунду, latency скачет** — thread pool starvation: где-то `.Result`, `.Wait()`, синхронный I/O или долгий `lock`. Добавление CPU не поможет.
- **CPU 90%, time in GC 30–50%, alloc rate гигабайты в секунду** — проблема аллокаций, а не алгоритма.
- **CPU 15%, пул в порядке, active requests растут** — процесс ждёт внешнюю зависимость: БД, HTTP, connection pool, семафор.
- **Working set растёт, GC heap стабилен** — неуправляемая память: нативные буферы, `HttpClient` без переиспользования, Kestrel-память, фрагментация.

**Практические советы.** Снимайте сразу в файл, чтобы потом сравнить «до» и «после»: `dotnet-counters collect -p 1 --format csv -o counters.csv --duration 00:00:05:00`. Сравнивайте проблемный под с соседним здоровым — разница информативнее абсолютных чисел. В проде эти же счётчики должны постоянно уходить в метрики через OpenTelemetry (`AddRuntimeInstrumentation`, `AddAspNetCoreInstrumentation`), а `dotnet-counters` — инструмент для точечного взгляда, когда дашборда не хватает.

**Что спрашивают дальше:** как отличить starvation от просто медленной БД (по queue length и скорости роста числа потоков), почему `threadpool-thread-count` в сотни потоков — симптом, а не решение, и чем опасно поднимать `ThreadPool.SetMinThreads` вслепую.

## Как проанализировать дамп памяти и найти источник утечки?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-proanalizirovat-damp-pamyati-i-naiti-istochnik-utechki
tags: memory, profiling
```

Утечку в управляемом коде ищут сравнением: два-три снимка кучи с интервалом под нагрузкой, разница по типам показывает, что растёт, а `gcroot` для экземпляров растущего типа показывает, кто их держит. Источник утечки — это почти всегда корень (статика, кэш, подписка на событие, таймер), а не сам растущий тип.

**Выбор инструмента:**

| Инструмент | Что содержит | Размер, пауза | Когда |
| --- | --- | --- | --- |
| `dotnet-gcdump` | только граф управляемых объектов | маленький; вызывает полную блокирующую сборку | быстрый ответ «какие типы растут» |
| `dotnet-dump --type Heap` | куча + потоки + модули | порядка managed heap | нужен `gcroot`, стеки, значения полей |
| `dotnet-dump --type Full` | вся память процесса | равен RSS | нативные утечки, полный разбор |

**Шаг 1. Убедиться, что растёт именно managed heap.** Если `dotnet.gc.last_collection.heap.size` (или `gc-heap-size`) стабилен, а RSS растёт — дамп кучи ничего не покажет, проблема в нативной памяти.

**Шаг 2. Снять серию снимков.**

```bash
dotnet-gcdump collect -p 1 -o /dumps/t0.gcdump
dotnet-gcdump collect -p 1 -o /dumps/t1.gcdump
dotnet-gcdump report /dumps/t1.gcdump
```

`.gcdump` открывается в Visual Studio или PerfView, где есть сравнение двух снимков (diff по числу и размеру объектов каждого типа). Между снимками должно пройти достаточно времени и нагрузки, чтобы рост превысил шум.

**Шаг 3. Найти, кто держит.** Для этого нужен полноценный дамп и SOS:

```bash
dotnet-dump collect -p 1 --type Heap -o /dumps/heap.dmp
dotnet-dump analyze /dumps/heap.dmp
```

```text
> dumpheap -stat
> dumpheap -mt 00007f3c1a2b4c58
> gcroot 00007f3bd8031e40
> dumpobj 00007f3bd8031e40
> eeheap -gc
```

`dumpheap -stat` выводит типы, отсортированные по суммарному размеру. Пусть сверху `OrderDto` — 4 млн экземпляров. `dumpheap -mt` даёт адреса экземпляров, `gcroot` по одному из них — цепочку ссылок до корня:

```text
HandleTable:
    00007f3c0c0013e8 (strong handle)
    -> 00007f3bd0001020 System.Object[]
    -> 00007f3bd0012340 MyApp.Caching.LocalCache
    -> 00007f3bd0012388 System.Collections.Concurrent.ConcurrentDictionary<String, OrderDto>
    -> ...
    -> 00007f3bd8031e40 MyApp.OrderDto
```

`System.Object[]` под strong handle — это хранилище статических полей. Ответ: статический кэш без вытеснения.

**Частые корни утечек в .NET-сервисах:**

- статический `Dictionary`/`ConcurrentDictionary` как кэш без TTL и лимита размера;
- подписка на событие долгоживущего объекта (`+=` без `-=`), в том числе `IOptionsMonitor.OnChange`, `ChangeToken`;
- `Timer` или `CancellationTokenRegistration`, которые не освободили;
- `IMemoryCache` без `SizeLimit` с ключами, содержащими уникальные значения (id запроса, время);
- singleton, захвативший scoped-сервис (вместе с его `DbContext` и всем change tracker'ом);
- `HttpClient`, создаваемый на запрос, и `EventSource`/`Meter`, создаваемые динамически;
- `AsyncLocal` и замыкания в долгоживущих задачах.

**Подводные камни анализа:**

- `dumpheap -stat` показывает shallow size. Если сверху `String` и `Byte[]`, это следствие — ищите их владельца через `gcroot` или по retained size в VS/PerfView.
- Объекты в очереди финализации или недавно ставшие мусором видны в дампе до следующей сборки; `dumpheap -live` (или `gcdump`, который делает GC) отсекает их.
- `gcroot` на огромной куче работает долго; берите несколько случайных экземпляров, а не первый.
- Фрагментация (`Free` сверху в `dumpheap -stat`, большой Gen2 при малом количестве живых объектов) — это не утечка; лечится по-другому (пиннинг, LOH).

**Что спрашивают дальше:** почему `dotnet-gcdump` может сам вызвать заметную паузу (он делает полную сборку), чем retained size отличается от shallow, как искать утечку, если управляемая куча стабильна (нативная память: `pmap`, `maps`, `DOTNET_GCgen0size` тут ни при чём — нужен Full-дамп и нативные инструменты).

## Как снять дамп в контейнере Kubernetes и какие подводные камни при этом есть?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-snyat-damp-v-konteinere-kubernetes-i-kakie-podvodnye-kamni-pri-eto
tags: tooling, devops
```

Дамп в Kubernetes снимают одним из трёх способов: `dotnet-dump` внутри контейнера или из debug-контейнера с общим `/tmp`, `dotnet-monitor` как sidecar с HTTP API, либо автоматически при падении через переменные `DOTNET_DbgEnableMiniDump`. Основные проблемы — доступ к diagnostic socket, права ptrace, место на диске, память и то, что под во время записи заморожен и может быть убит liveness-пробой.

**Почему не работает «просто зайти и снять».** Прод-образ на `aspnet`/`chiseled` не содержит SDK, shell и инструментов. `dotnet-dump` общается с процессом через Unix-сокет `dotnet-diagnostic-{pid}-*-socket` в `$TMPDIR` (по умолчанию `/tmp`), а сам дамп пишет `createdump`, который идёт в составе рантайма и использует ptrace. Значит, инструменту нужен доступ к тому же `/tmp` и к пространству процессов цели.

**Вариант 1. Sidecar с dotnet-monitor** — удобен, когда диагностику нужно делать регулярно:

```yaml
spec:
  containers:
    - name: app
      image: registry/app:1.4.2
      env:
        - name: DOTNET_DiagnosticPorts
          value: /diag/dotnet-monitor.sock
      volumeMounts:
        - { name: diag, mountPath: /diag }
        - { name: dumps, mountPath: /dumps }
    - name: monitor
      image: mcr.microsoft.com/dotnet/monitor:9
      args: ["collect", "--no-auth"]
      env:
        - name: DOTNETMONITOR_DiagnosticPort__ConnectionMode
          value: Listen
        - name: DOTNETMONITOR_DiagnosticPort__EndpointName
          value: /diag/dotnet-monitor.sock
        - name: DOTNETMONITOR_Storage__DumpTempFolder
          value: /dumps
      volumeMounts:
        - { name: diag, mountPath: /diag }
        - { name: dumps, mountPath: /dumps }
  volumes:
    - name: diag
      emptyDir: {}
    - name: dumps
      emptyDir: { sizeLimit: 8Gi }
```

Дальше `kubectl port-forward pod/app-xyz 52323` и `GET /dump?type=Full` (единственный подключившийся процесс выбирается по умолчанию). `--no-auth` здесь только для иллюстрации — в проде нужна аутентификация по ключу, потому что дамп содержит секреты и персональные данные.

**Вариант 2. Ephemeral debug container:**

```bash
kubectl debug -it pod/app-xyz --image=mcr.microsoft.com/dotnet/sdk:9.0 --target=app -- bash
```

`--target` даёт общий process namespace с контейнером приложения, но файловые системы остаются разными: сокет лежит в `/tmp` приложения, который из debug-контейнера виден только как `/proc/<pid>/root/tmp`. Работает ли такой путь, зависит от версии инструментов и прав, поэтому для регулярной диагностики надёжнее вариант 1. Пользователь в debug-контейнере должен совпадать с пользователем приложения (UID `app` в официальных образах — 1654), иначе не хватит прав.

**Вариант 3. Дамп при падении:**

```yaml
env:
  - name: DOTNET_DbgEnableMiniDump
    value: "1"
  - name: DOTNET_DbgMiniDumpType
    value: "2"
  - name: DOTNET_DbgMiniDumpName
    value: /dumps/core.%e.%p.%t
```

Тип `1` — Mini, `2` — Heap, `3` — Triage, `4` — Full. Дамп пишется при необработанном исключении или аварийном завершении, но **не при OOMKilled**: SIGKILL от ядра не даёт процессу ничего сделать. Для памяти используйте триггеры dotnet-monitor (collection rules по порогу `WorkingSet` или GC heap) или снимайте вручную до лимита.

**Подводные камни:**

- **Ptrace.** В некоторых средах `createdump` падает с ошибкой доступа; помогает capability `SYS_PTRACE` в `securityContext`. Согласуйте это с безопасностью — capability широкая.
- **Диск.** Full-дамп равен RSS процесса. Запись в слой контейнера расходует `ephemeral-storage` — при превышении kubelet выселит под. Пишите в `emptyDir` с `sizeLimit` или в PVC.
- **Память.** `emptyDir` с `medium: Memory` засчитывается в лимит памяти пода — дамп на 4 ГБ в tmpfs гарантированно вызовет OOMKilled.
- **Пауза.** Процесс заморожен на время записи (секунды–минуты для больших куч). Liveness-проба может решить, что контейнер мёртв, и перезапустить его посреди дампа. Перед снятием уберите под из балансировки (снимите label, который выбирает Service) или временно ослабьте пробу.
- **Чувствительные данные.** В дампе токены, connection string, PII. Хранение, доступ и удаление дампов — часть процесса.
- **Анализ на той же архитектуре и версии.** Дамп с linux-arm64 анализируйте на linux-arm64 с той же версией рантайма; `dotnet-symbol` подтянет нужные DAC и символы.

**Что спрашивают дальше:** как получить информацию о памяти, если под постоянно убивается OOMKilled (снизить лимит GC через `GCHeapHardLimit`/`GCHeapHardLimitPercent`, чтобы получить `OutOfMemoryException` с дампом вместо SIGKILL, или триггер dotnet-monitor), почему `gcdump` предпочтительнее Full-дампа для первого шага.

## Как найти причину 100% загрузки CPU, если нагрузка не изменилась?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-naiti-prichinu-100-zagruzki-cpu-esli-nagruzka-ne-izmenilas
tags: cpu, profiling
```

Если RPS прежний, а CPU упёрся в 100%, изменилась стоимость одного запроса или появилась работа, не связанная с запросами. Сначала отвечают на вопрос «что изменилось» (деплой, конфиг, объём данных, зависимость), затем снимают CPU-профиль и смотрят, какие стеки жгут процессор. Гадать по коду дольше, чем снять 30 секунд трассировки.

**Шаг 1. Корреляция по времени.** Совпадает ли начало с деплоем, сменой флага, миграцией, ростом таблицы, началом месяца (отчёты), обновлением базового образа или ноды? Растёт CPU на всех подах или на одном? На одном — скорее зависший поток или «плохой» ключ шардирования; на всех — код или данные.

**Шаг 2. Отделить GC и пул потоков.** По `dotnet-counters`: если `time-in-gc` высокий — это история про аллокации, а не алгоритм. Если GC в норме, идём в профиль.

**Шаг 3. CPU-профиль:**

```bash
dotnet-trace collect -p 1 --profile cpu-sampling --duration 00:00:00:30 -o cpu.nettrace
```

В PerfView/VS смотрите exclusive time по методам и hot path. Если нужен быстрый ответ без анализа трассировки — несколько снимков стеков подряд:

```bash
dotnet-stack report -p 1
```

Методы, которые повторяются в стеках многих потоков на нескольких снимках подряд, и есть горячая точка.

**Шаг 4. Если горит один поток.** `top -H -p <pid>` показывает нативный TID потока с максимальным CPU. В дампе `clrthreads` выводит соответствие managed-потоков и OSID, дальше `setthread` и `clrstack`:

```text
> clrthreads
> setthread -t 0x1a2f
> clrstack
```

**Типичные причины при неизменной нагрузке:**

- **Рост данных.** Квадратичный алгоритм на коллекции, которая росла месяцами: `List.Contains` в цикле, `IndexOf` по списку, LINQ `Where(...).First()` внутри другого цикла. Сто элементов — незаметно, сто тысяч — весь CPU.
- **Регулярное выражение с катастрофическим backtracking.** Один «плохой» input занимает поток на секунды. Защита: `RegexOptions.NonBacktracking` или `matchTimeout`, source-generated regex.
- **Повреждённый `Dictionary<TKey,TValue>`.** Конкурентная запись из нескольких потоков может испортить внутренние цепочки так, что `FindValue` зацикливается навсегда. В стеке видно `Dictionary.FindValue` или `TryInsert` на 100% CPU нескольких потоков. Лечится `ConcurrentDictionary` или блокировкой.
- **Spin и busy-wait.** `while (!flag) {}`, `SpinWait` без ограничения, `SemaphoreSlim`/`lock` под сильной конкуренцией тоже часть времени крутятся перед засыпанием.
- **Шторм повторов.** Зависимость стала отвечать ошибками, Polly ретраит без backoff, каждый запрос порождает десятки попыток: внешне RPS тот же, а работы в разы больше.
- **Исключения как control flow.** Исключение в .NET стоит микросекунды и больше (сбор стека), тысячи в секунду заметны в профиле (`exception-count`).
- **Фоновая работа.** `Timer`, `BackgroundService`, которые создаются на запрос и не освобождаются; «пересчитать кэш» каждые N секунд при выросшем кэше.
- **Логирование.** Включили Debug-уровень или добавили сериализацию объекта в лог на горячем пути.
- **Окружение.** Новая нода с более медленным CPU, шумный сосед, CFS-троттлинг (тогда в метриках контейнера растёт `container_cpu_cfs_throttled_periods_total`, а не реальное потребление).

**Как подтвердить гипотезу.** Не останавливайтесь на «нашли метод»: проверьте, почему он стал дорогим именно сейчас — размер коллекции в дампе (`dumpobj` на `List<T>` покажет `_size`), конкретный input для regex в логах, количество активных таймеров (`active-timer-count`). И после исправления сравните CPU на запрос (CPU / RPS), а не только абсолютный CPU.

**Что спрашивают дальше:** как без перезапуска понять, что поток висит в бесконечном цикле, а не в долгом вычислении (несколько снимков стека — один и тот же фрейм, CPU потока 100%), почему `ConcurrentDictionary` не защищает от гонок в `GetOrAdd` с фабрикой (фабрика может вызваться несколько раз).

## Как отличить проблему GC от проблемы алгоритма по метрикам?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-otlichit-problemu-gc-ot-problemy-algoritma-po-metrikam
tags: gc, profiling
```

Проблему GC выдаёт связь задержек и CPU со сборками: высокая доля времени в GC, частые Gen2 или длинные паузы, которые по времени совпадают со всплесками latency, и высокая скорость аллокаций. Проблема алгоритма выглядит наоборот: GC занимает единицы процентов, а CPU-профиль показывает пользовательские методы, и время растёт с размером данных, а не с объёмом аллокаций.

**Сравнительная картина:**

| Признак | GC | Алгоритм |
| --- | --- | --- |
| `time-in-gc` / `dotnet.gc.pause.time` | десятки процентов, всплески | 1–5%, ровно |
| `alloc-rate` | сотни МБ – ГБ в секунду | обычный |
| Частота Gen2 | растёт, иногда blocking Gen2 | редкие |
| Форма latency | периодические всплески на всех запросах сразу | дорогие конкретные запросы, зависит от входа |
| Нативный CPU-профиль (`perf`, ETW) | `gc_heap::mark_*`, `plan_phase`, `relocate_phase`, потоки Server GC | пользовательские методы, LINQ, regex, сериализация |
| Влияние нагрузки | нелинейно: больше RPS — больше переживших объектов — дороже сборки | примерно линейно по RPS |
| Влияние размера данных | через размер кучи | прямо: O(n²) видно сразу |

**Как проверить, а не гадать:**

**Сопоставить по времени.** Трассировка только с GC-событиями дешёвая и даёт точные паузы каждой сборки:

```bash
dotnet-trace collect -p 1 --providers Microsoft-Windows-DotNETRuntime:0x1:4 --duration 00:00:02:00
```

В PerfView отчёт **GCStats** показывает каждую сборку: поколение, тип (blocking/background), причину (`AllocSmall`, `AllocLarge`, `Induced`, `LowMemory`), паузу и размер до/после. Если p99-всплески запросов попадают на паузы Gen2 или на серии Gen1 по 50+ мс — это GC.

**Посмотреть, что делает CPU.** EventPipe-сэмплер видит только управляемые стеки, поэтому работа потоков GC в `cpu-sampling` почти не заметна. Нативную картину даёт `perf` на Linux (с `DOTNET_PerfMapEnabled=1` для имён управляемых методов) или ETW на Windows: там время GC видно как `coreclr!WKS::gc_heap::...` или `SVR::gc_heap::...`. Если на них приходится малая доля CPU, оптимизация аллокаций не даст многого.

**Эксперимент с настройками.** Временно на одном поде: включить/выключить `ConcurrentGC`, поменять `GCgen0size` или `GCConserveMemory`. Если latency меняется заметно — проблема в GC. Если нет — точно не в нём. Это не решение, а диагностический приём.

**Причина сборки важна.** `Induced` — кто-то зовёт `GC.Collect` (часто библиотека или код, «освобождающий память»). `LowMemory` — контейнер у лимита памяти, GC работает агрессивно — это проблема лимитов, а не кода. `AllocLarge` — LOH-аллокации больших массивов (буферы, `MemoryStream.ToArray`, большие строки).

**Пограничные случаи:**

- **Алгоритм, порождающий давление на GC.** LINQ-цепочки в горячем цикле, `string.Split`, боксинг в `Dictionary<object,…>`, замыкания. Корень — код, проявление — GC. Лечится уменьшением аллокаций, а не тюнингом GC.
- **Mid-life crisis.** Объекты живут ровно столько, чтобы пережить Gen0/Gen1 (кэш на минуту, буферизация запросов), и умирают в Gen2. Высокий alloc rate не обязателен, зато Gen2-сборки дорогие.
- **Пиннинг.** Много закреплённых буферов мешает компактизации, Gen0 не может освободиться эффективно; видно по `pinned-object-count` и фрагментации.
- **Пауза не от GC.** Suspension (`SuspendEE`) ждёт поток, долго выполняющий нативный код без safe point; в GCStats это видно как большое время приостановки при малом времени самой сборки.

**Что спрашивают дальше:** почему Server GC на машине с малым числом ядер в контейнере может ухудшить latency, что показывает `gc-fragmentation`, как DATAS (динамическая адаптация числа куч, включена по умолчанию для Server GC в .NET 9) меняет картину памяти.

## Что означает высокий процент времени в GC и с чего начать оптимизацию?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-chto-oznachaet-vysokii-procent-vremeni-v-gc-i-s-chego-nachat-optimizac
tags: gc, performance
```

Высокий процент времени в GC означает, что заметная доля процессорного времени (и пауз приложения) уходит на сборки, а не на полезную работу. Начинать нужно не с переписывания кода, а с ответа на вопрос «почему GC работает так часто или так долго»: из-за объёма аллокаций, из-за выживаемости объектов или из-за того, что ему не хватает памяти. От ответа зависит, лечить код, конфигурацию или лимиты.

**Как правильно читать метрику.** EventCounter `time-in-gc` считается как доля времени в GC с момента предыдущей сборки, поэтому скачет: одна длинная сборка после паузы в аллокациях даёт 80%. Смотрите тренд и `dotnet.gc.pause.time` как накопленное время пауз за интервал. Грубый ориентир для сервиса: до 5% — нормально, 10–20% — стоит разобраться, больше — GC определяет производительность.

**Шаг 1. Классифицировать сборки.** GC-трассировка и отчёт GCStats в PerfView:

```bash
dotnet-trace collect -p 1 --profile gc-collect --duration 00:00:02:00
```

Смотрите:

- **Распределение по поколениям.** Много Gen0 с короткими паузами — высокий alloc rate, это норма для .NET, если паузы малы. Много Gen1 и Gen2 — объекты выживают.
- **Причины.** `LowMemory` и рост `% memory load` — GC под давлением лимита контейнера, он компактизирует агрессивно. `Induced` — явный `GC.Collect`. `AllocLarge` — LOH.
- **Тип Gen2.** Background Gen2 почти не останавливает приложение; blocking Gen2 (особенно компактизирующий) — длинная пауза.
- **Promoted bytes.** Сколько памяти переживает каждую сборку. Высокий promotion из Gen0 в Gen1 — признак «средней жизни» объектов.

**Шаг 2. Отсечь проблемы конфигурации.**

| Симптом | Что проверить |
| --- | --- |
| `LowMemory`, частые Gen2, контейнер у лимита | лимит памяти мал для нагрузки; `GCHeapHardLimitPercent`, не 90% лимита под кучу, если есть нативная память |
| Workstation GC на многоядерном сервере | `<ServerGarbageCollector>true</ServerGarbageCollector>`, в ASP.NET Core включено по умолчанию |
| Server GC в поде с 1 CPU | Workstation может быть лучше; в .NET 9+ DATAS сглаживает проблему |
| Induced-сборки | найти вызовы `GC.Collect` в коде и библиотеках |
| Длинные blocking Gen2 | `ConcurrentGarbageCollection` не выключен ли |

**Шаг 3. Работать с кодом по данным, а не по интуиции.**

- **Если высокий alloc rate** — найти топ аллоцирующих стеков (`gc-verbose`, VS Allocation Tracking) и убрать аллокации на горячем пути: `Span<T>`, `ArrayPool<T>`, `StringBuilder` вместо конкатенаций, `System.Text.Json` с `Utf8JsonWriter` поверх пулированного буфера, отказ от LINQ в циклах, struct-энумераторы.
- **Если высокая выживаемость** — искать то, что держит объекты дольше запроса: буферизация тел запросов, кэши без ограничения, большие графы сущностей в `DbContext` с tracking, очереди в памяти. Здесь помогает уменьшение времени жизни, а не числа аллокаций.
- **Если LOH** — массивы и строки от 85 000 байт: `MemoryStream.ToArray`, `ReadAsStringAsync` больших ответов, `List<T>` с большой ёмкостью. Решение — пулинг (`ArrayPool`, `RecyclableMemoryStream`) и стриминг вместо материализации.

```csharp
await using var stream = await response.Content.ReadAsStreamAsync(ct);
var orders = await JsonSerializer.DeserializeAsync<OrderPage>(stream, JsonOptions, ct);
```

вместо `ReadAsStringAsync` + `Deserialize<OrderPage>(string)`: строка на десятки мегабайт уходит в LOH и копируется ещё раз в UTF-16.

**Шаг 4. Проверить эффект.** Метрики «до/после»: `alloc-rate` на запрос (alloc rate / RPS), частота Gen2, p99. Снижение `time-in-gc` с 25% до 5% обычно сразу видно по p99 и по CPU.

**Чего не делать:** вызывать `GC.Collect` «для освобождения памяти», выключать concurrent GC без измерений, включать `GCSettings.LatencyMode = SustainedLowLatency` как универсальное лекарство, бездумно ставить `GCgen0size` — всё это сдвигает проблему, а не решает.

**Что спрашивают дальше:** почему Server GC потребляет больше памяти, что такое DATAS и когда его выключают, как `GCConserveMemory` борется с фрагментацией LOH.

## Как профилировать аллокации и определить, какие из них действительно важны?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-profilirovat-allokacii-i-opredelit-kakie-iz-nih-deistvitelno-vazhn
tags: allocations, profiling
```

Аллокации профилируют сэмплированием: рантайм генерирует событие `GCAllocationTick` примерно каждые 100 КБ выделенной памяти с типом объекта и стеком, и по агрегации этих событий видно, какие стеки аллоцируют больше всего байт. Важны не все аллокации, а те, что дают большую долю байт на горячем пути, переживают Gen0 или попадают в LOH — именно они определяют частоту и стоимость сборок.

**Инструменты:**

| Инструмент | Как работает | Где применять |
| --- | --- | --- |
| `dotnet-trace --profile gc-verbose` | `AllocationTick` + GC-события, низкий overhead | прод, Linux, контейнер |
| Visual Studio, .NET Object Allocation Tracking | точный учёт каждой аллокации, высокий overhead | локально, воспроизводимый сценарий |
| dotMemory / PerfView «GC Heap Alloc Ignore Free» | агрегирование по стекам и типам | разбор трассировки |
| BenchmarkDotNet `[MemoryDiagnoser]` | байт на операцию | проверка конкретного метода |
| `GC.GetAllocatedBytesForCurrentThread()` | счётчик байт потока | тест-бюджет аллокаций |

```bash
dotnet-trace collect -p 1 --profile gc-verbose --duration 00:00:00:20 -o alloc.nettrace
```

Трассировку открывают в PerfView (представление `GC Heap Alloc Ignore Free (Coarse Sampling) Stacks`) или в Visual Studio. Сортировка по inclusive-байтам от корня запроса показывает, какая операция аллоцирует, а по exclusive — какой конкретный `new`.

**Какие аллокации действительно важны:**

1. **Доля в общем объёме.** Сэмплирование статистическое: стек, на который пришлось 40% тиков, — 40% байт. Оптимизация стека с 0,5% бесполезна, даже если он выглядит некрасиво.
2. **Байт на запрос.** Нормируйте: `alloc-rate / RPS`. 200 КБ на простой GET — повод разбираться, 5 КБ — скорее нет.
3. **Время жизни.** Объект, умирающий в Gen0, стоит почти только аллокации. Объект, переживший Gen0 и Gen1, копируется при компактизации и увеличивает стоимость каждой следующей сборки. Сравните alloc-трассировку с promoted bytes в GCStats: если promotion велик, искать надо выживающие объекты — кэши, буферизацию, долгие запросы.
4. **LOH.** События `AllocationTick` с `AllocationKind = Large` — массивы от 85 000 байт. Они сразу в Gen2-логике, собираются только с Gen2 и фрагментируют кучу.
5. **Конкуренция.** На многопоточной нагрузке частые аллокации быстрее исчерпывают allocation context потоков, что увеличивает частоту Gen0 и время приостановки всех потоков.

**Типичные находки и исправления:**

- `string.Format`/интерполяция в логах на выключенном уровне — `LoggerMessage` source generator.
- `ToList()`/`ToArray()` ради одного прохода, LINQ на горячем пути, замыкания с захватом.
- Боксинг: `Dictionary<Enum, …>` на старых рантаймах, `object`-параметры, `string.Join` с value types, интерфейсы над struct.
- `async`-методы, которые почти всегда завершаются синхронно, — `ValueTask`.
- Сериализация через промежуточные строки и `MemoryStream.ToArray()` — запись в `IBufferWriter<byte>`/`PipeWriter`.
- `Encoding.UTF8.GetBytes(string)` на каждый вызов — `stackalloc`/`ArrayPool`.

**Как закрепить результат:** тест с бюджетом аллокаций, чтобы регрессия не вернулась незаметно.

```csharp
[Fact]
public void Parse_DoesNotAllocate()
{
    var input = "12345;67.89;item-42"u8.ToArray();
    Parser.Parse(input);
    var before = GC.GetAllocatedBytesForCurrentThread();
    Parser.Parse(input);
    var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
    Assert.Equal(0, allocated);
}
```

**Подводные камни:** VS Allocation Tracking замедляет приложение в разы и меняет поведение под нагрузкой; `AllocationTick` даёт тип объекта, на котором сработал порог, поэтому мелкие редкие типы недопредставлены — это нормально для поиска основных источников. И помните, что снижение аллокаций на 30% в методе, отвечающем за 3% байт, на GC не повлияет.

**Что спрашивают дальше:** почему аллокация в .NET дешёвая, а GC — нет (bump pointer в allocation context против маркировки и копирования), как найти аллокации, создаваемые компилятором (замыкания, `params`, state machine), через sharplab или IL.

## Продакшен стал отвечать в пять раз медленнее. Каков ваш порядок действий?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-prodakshen-stal-otvechat-v-pyat-raz-medlennee-kakov-vash-poryadok-deis
tags: incident, profiling
```

Порядок такой: сначала стабилизировать (откат, масштабирование, отключение фичи), параллельно зафиксировать масштаб и момент начала, затем сузить проблему сверху вниз — какие эндпоинты, какие инстансы, какая зависимость — и только потом лезть в профилировщик. Поиск корневой причины не должен задерживать восстановление сервиса.

**1. Митигация в первые минуты.** Если деградация совпала с деплоем или изменением конфигурации — откат без долгих раздумий, разбор потом. Если нет — горизонтальное масштабирование, отключение тяжёлой фичи через feature flag, rate limiting на дорогие эндпоинты. Сохраните доказательства до рестарта: дамп или трассировку с одного пода, иначе после перезапуска проблема может «исчезнуть» до следующего раза.

**2. Масштаб и форма.** Ответить на вопросы по дашбордам:

- Все эндпоинты или некоторые? Один медленный эндпоинт — код или запрос к БД; все сразу — ресурсы процесса, общая зависимость или инфраструктура.
- Все поды или часть? Часть — нода, зона, «плохой» под с утечкой или после долгого аптайма.
- Медиана или только хвосты? Сдвиг p50 в пять раз — системная причина; рост только p99 — очереди, GC, ретраи, редкие тяжёлые запросы.
- Когда началось? Сопоставить с деплоями, миграциями, изменением трафика, cron-задачами, изменениями у провайдера.
- Изменился ли трафик по составу, а не по объёму? Новый клиент с огромными выборками может не изменить RPS, но изменить стоимость запроса.

**3. Где время.** Распределённая трассировка: открыть несколько медленных трейсов и посмотреть, какой span вырос. Это сразу делит пространство поиска пополам: время в собственном коде сервиса или в ожидании БД, HTTP, брокера, блокировки.

**4. Если время внутри процесса — ресурсы и рантайм.**

```bash
dotnet-counters monitor -p 1 --counters System.Runtime,Microsoft.AspNetCore.Hosting
```

- CPU у лимита — CPU-профиль; CFS-троттлинг — проверить лимиты.
- GC 20%+ — аллокации и память.
- Растут `threadpool-queue-length` и число потоков — starvation от блокирующих вызовов; снимок стеков (`dotnet-stack report -p 1`) покажет, где потоки стоят: `Task.Wait`, `.Result`, синхронный `Read`, `Monitor.Enter`.
- Метрики процесса в норме, но запросы долгие — ожидание: connection pool БД (`Npgsql` метрики `db.client.connections.usage`, ожидание соединения), пул `HttpClient`, `SemaphoreSlim`.

**5. Если время во внешней зависимости.** Проверить её метрики (для PostgreSQL — `pg_stat_activity`, блокировки, `pg_stat_statements`), сеть (DNS, TLS-рукопожатия, retransmits), не включились ли ретраи с экспоненциальным умножением нагрузки.

**6. Подтвердить причину и исправить.** Гипотеза считается подтверждённой, если объясняет и время начала, и масштаб, и форму (почему в пять раз, почему на этих эндпоинтах). «Нашли медленный запрос» без объяснения, почему он стал медленным сегодня, — не причина.

**7. После инцидента.** Постмортем без поиска виноватых, алерт, который поймал бы проблему раньше, регресс-тест или нагрузочный тест на найденный сценарий.

**Частые реальные причины пятикратной деградации:**

- новый план запроса в PostgreSQL после `ANALYZE` или роста таблицы (seq scan вместо index scan);
- исчерпание пула соединений из-за медленного запроса или утечки соединений;
- thread pool starvation после добавления синхронного вызова в async-цепочку;
- ретрай-шторм к деградировавшей зависимости;
- переход пода на ноду с CPU-троттлингом или соседом-шумом;
- включённый Debug-лог или синхронный sink, упёршийся в диск;
- истёкший кэш или холодный старт после деплоя (кэш прогревается под боевой нагрузкой).

**Что спрашивают дальше:** как вы поймёте, что откат помог, а не совпал с естественным спадом трафика; что сохраните с пода перед его перезапуском; как избежать того, чтобы масштабирование усугубило проблему (больше подов — больше соединений к и без того перегруженной БД).

## Потребление памяти постоянно растёт. Как выстроить расследование?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-potreblenie-pamyati-postoyanno-rastet-kak-vystroit-rassledovanie
tags: memory, incident
```

Сначала выясняют, растёт ли память на самом деле и какая: управляемая куча, нативная память процесса или учитываемый контейнером page cache. Потом — растёт ли она бесконечно или выходит на плато (кэши, прогрев, Server GC просто держит больше). И только для подтверждённого неограниченного роста управляемой кучи снимают серию снимков кучи и ищут корни.

**1. Какая именно метрика растёт.**

| Метрика | Что включает |
| --- | --- |
| `container_memory_working_set_bytes` | то, по чему kubelet принимает решения и OOMKilled; включает активный page cache |
| RSS процесса (`process.memory.usage`, `working-set`) | реально занятые процессом страницы |
| GC committed (`dotnet.gc.last_collection.memory.committed_size`) | память, которую GC взял у ОС |
| GC heap size (`dotnet.gc.last_collection.heap.size`) | живые объекты после последней сборки плюс фрагментация |

Если растёт только working set контейнера, а RSS стабилен — это page cache (например, логи в файл или чтение больших файлов), и ядро освободит его под давлением. Если растёт RSS, а GC heap стабилен — нативная утечка. Если растёт GC heap — управляемая.

**2. Утечка или плато.** Постройте график за несколько суток. Server GC с DATAS или без него может держать сотни мегабайт «про запас», кэши заполняются до лимита, после деплоя память растёт часами и стабилизируется. Утечка — это рост, коррелирующий с числом обработанных запросов или со временем, без выхода на плато, и заканчивающийся OOMKilled.

Простой тест: принудительная полная сборка на одном поде (через `dotnet-gcdump collect`, который её вызывает) — если heap после неё падает почти до базового уровня, это не утечка, а ленивый GC.

**3. Корреляция.** С чем связан рост: с RPS, с определённым эндпоинтом, с количеством подключений, с фоновой задачей, с ошибками (исключения, ретраи, незакрытые ресурсы)? Сравните поды с разным аптаймом. Если утечка появилась после деплоя — diff зависимостей и кода регистрации DI.

**4. Управляемая утечка.** Два-три `dotnet-gcdump` с интервалом под нагрузкой, сравнение по типам, затем полный дамп и `gcroot` по растущему типу (подробно — в вопросе про анализ дампа). Типичные корни: статические коллекции, `IMemoryCache` без `SizeLimit`, подписки на события, singleton, захвативший scoped-сервисы, `Timer` без `Dispose`.

**5. Нативная утечка.** Управляемые инструменты её не покажут. Признаки и источники:

- `gc-heap-size` стабилен, а RSS растёт;
- нативные библиотеки (SkiaSharp, драйверы БД с нативной частью, `librdkafka` в Confluent.Kafka — неосвобождённые producer/consumer);
- `HttpClient`/`SocketsHttpHandler`, создаваемые на запрос, — сокеты и TLS-контексты;
- `Marshal.AllocHGlobal` без освобождения, `SafeHandle` без `Dispose`, которые ждут финализатора;
- рост числа потоков: каждый поток — стек до 8 МБ виртуальной и реально занятые страницы (`threadpool-thread-count`, `/proc/<pid>/status` → `Threads`);
- фрагментация glibc malloc arena при большом числе потоков — лечится `MALLOC_ARENA_MAX=2`.

Инструменты: `pmap -x <pid>` или `/proc/<pid>/smaps` по снимкам во времени (какие регионы растут), Full-дамп и анализ в `lldb`/WinDbg с SOS, `valgrind`/`heaptrack` локально.

**6. Защита, пока причина ищется.** Корректные лимиты и `GCHeapHardLimitPercent`, чтобы получить управляемый `OutOfMemoryException` с дампом вместо SIGKILL; триггер `dotnet-monitor` на снятие дампа при пороге памяти; в крайнем случае плановый рестарт подов — как временная мера, а не решение.

**Ошибки в расследовании:** смотреть только на working set контейнера и паниковать из-за page cache; делать выводы по одному снимку кучи; искать утечку в типе, который сверху `dumpheap -stat` (`String`, `Byte[]`), вместо его владельца; забыть про финализируемые объекты — если финализатор блокируется, очередь финализации растёт и держит всё, на что ссылается (`finalizequeue` в SOS).

**Что спрашивают дальше:** почему процесс не отдаёт память ОС после спада нагрузки (GC держит committed-сегменты, Server GC особенно; `GCConserveMemory`, `GCRetainVM`), как DATAS меняет картину памяти в .NET 9+.

## Latency выросла только на p99. Где искать причину?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-latency-vyrosla-tolko-na-p99-gde-iskat-prichinu
tags: latency, observability
```

Если медиана не изменилась, а вырос только p99, значит, большинство запросов обрабатываются как раньше, а небольшая доля периодически чего-то ждёт: паузы GC, очередь в пуле потоков или соединений, ретраи с таймаутами, холодные пути (кэш-промах, JIT, новое соединение), CPU-троттлинг или конкретный тип «тяжёлых» запросов. Ищут это не по средним метрикам, а по самим медленным запросам: exemplars, трейсы из хвоста и корреляция всплесков по времени.

**Первое — понять форму хвоста.**

- **Хвост периодический** (всплески каждые N секунд) — GC Gen2, CFS-троттлинг на границе 100-мс периода, cron/фоновая задача, сброс кэша по TTL, checkpoint в PostgreSQL, ребалансировка консьюмеров Kafka.
- **Хвост постоянный, но редкий** — конкретные запросы: большие клиенты, редкие параметры, плохой план запроса для «тяжёлого» значения параметра, сериализация больших ответов.
- **Хвост на одном поде или ноде** — шумный сосед, медленный диск, перегруженная нода, под после долгого аптайма.
- **Хвост растёт вместе с нагрузкой** — очередь: утилизация ресурса близка к 100%, и по теории массового обслуживания время ожидания растёт нелинейно задолго до полной загрузки.

**Где искать:**

1. **Трейсы из хвоста.** Включите tail-based sampling или exemplars (гистограмма `http.server.request.duration` с привязанным `trace_id`), откройте 10–20 медленных трейсов и сравните с быстрыми того же эндпоинта. Чего больше: span'а БД, ожидания перед span'ом (пробел без активности — очередь или блокировка), повторного HTTP-вызова?
2. **Пробелы в трейсе.** Время между началом запроса и первым span'ом зависимости, не покрытое ничем, — ожидание потока из пула, соединения из пула, `SemaphoreSlim`, `lock`, паузы GC.
3. **GC.** Наложите график пауз GC (`dotnet.gc.pause.time`) на p99. Gen2-паузы в 100–300 мс прямо видны как ступеньки p99. Длинные паузы бывают и при малом проценте времени в GC.
4. **CPU-троттлинг.** `container_cpu_cfs_throttled_periods_total / container_cpu_cfs_periods_total`. Под может потреблять в среднем 40% лимита и при этом быть троттлинговым в пиках: Server GC с несколькими потоками выедает квоту периода за миллисекунды, остальные потоки ждут до конца периода.
5. **Пулы.** Npgsql: время ожидания соединения; `HttpClient`: `MaxConnectionsPerServer` и очередь запросов к хосту; Kafka producer: `linger.ms` и заполненность буфера.
6. **Ретраи и таймауты.** Запрос, у которого первая попытка упёрлась в таймаут 1 с и вторая прошла за 20 мс, — классический p99 в районе секунды. Смотрите на метрики ретраев Polly/Resilience и на распределение latency зависимостей: если у зависимости p99 = 1 с, у вас будет хуже.
7. **Fan-out.** Запрос, который параллельно ходит в 20 шардов или сервисов, ждёт самый медленный. Если у каждого p99 = 100 мс, то примерно 18% таких запросов (1 − 0,99²⁰) получат хотя бы один ответ из хвоста.
8. **Холодные пути.** После деплоя — Tier 0 код и пустые кэши; новые TCP/TLS-соединения после закрытия idle-соединений (`PooledConnectionIdleTimeout`); DNS-разрешение.

**Как правильно мерить.** Нельзя усреднять перцентили между подами — агрегируйте гистограммы. Проверьте, что метрика считается на сервере, а не включает очередь балансировщика, и наоборот — сравните p99 на клиенте и на сервере: разница означает очередь до приложения (Kestrel, ingress, сеть).

**Типичные исправления:** уменьшение аллокаций и пауз GC, правка лимитов CPU или отказ от CPU-лимита при наличии requests, hedged requests для идемпотентных чтений с fan-out, отдельный пул или bulkhead для тяжёлых запросов, таймауты с бюджетом вместо фиксированных, прогрев перед включением в балансировку.

**Что спрашивают дальше:** почему средняя latency скрывает проблему, что такое coordinated omission и почему нагрузочный инструмент без него рисует красивый p99, как hedged requests уменьшают хвост и чем за это платят (дополнительная нагрузка).

## Как найти узкое место, если каждый сервис по отдельности выглядит быстрым?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-naiti-uzkoe-mesto-esli-kazhdyi-servis-po-otdelnosti-vyglyadit-byst
tags: tracing, incident
```

Если каждый сервис по своим метрикам быстрый, а сквозной запрос медленный, время теряется между ними: в очередях, сетевых вызовах, последовательной цепочке вызовов, ретраях, ожидании соединений или в количестве вызовов (N+1 по сети). Найти это можно только сквозным взглядом — распределённой трассировкой с критическим путём, а не дашбордами отдельных сервисов.

**Почему «по отдельности всё быстро» обманывает:**

- **Сервис измеряет своё время, а не время клиента.** Серверная метрика начинается, когда Kestrel начал обрабатывать запрос. Очередь в ingress, sidecar, балансировщике, TCP accept backlog, установка TLS-соединения в неё не входят.
- **Сумма последовательных вызовов.** Каждый из 8 вызовов занимает 30 мс — каждый сервис «зелёный», а запрос длится 240 мс плюс сеть.
- **Количество вызовов.** Запрос к API делает 50 HTTP-вызовов в цикле — у вызываемого сервиса p99 = 5 мс, но запрос длится полсекунды.
- **Среднее скрывает хвост при fan-out.** Чем больше параллельных вызовов, тем выше вероятность, что хотя бы один попадёт в p99 вызываемого.
- **Асинхронные звенья.** Время в топике Kafka или очереди не принадлежит ни одному сервису: продюсер отправил быстро, консьюмер обработал быстро, а сообщение 40 секунд ждало из-за consumer lag.
- **Ретраи на стороне клиента.** Сервис видит две быстрые попытки, клиент — таймаут + повтор.

**Как искать:**

1. **Распределённая трассировка.** OpenTelemetry во всех сервисах с одним propagation (W3C `traceparent`), включая брокеры: для Kafka контекст передаётся в заголовках сообщения, и consumer-span связывается с producer-span через link. Без сквозного контекста трассировка не покажет межсервисные пробелы.
2. **Критический путь.** Откройте медленный трейс в Jaeger/Tempo/Honeycomb и смотрите не на самый длинный span, а на цепочку, определяющую общую длительность. Пробелы между дочерними span'ами — время, которое никто не инструментировал: очередь, сериализация, ожидание пула, паузы GC.
3. **Сравнение клиентского и серверного span'а одного вызова.** `HttpClient` span 120 мс, серверный span вызываемого сервиса 15 мс — 105 мс ушли на сеть, DNS, TLS, очередь соединений в `SocketsHttpHandler` или очередь до приложения.
4. **Агрегаты по трейсам.** Сколько span'ов на запрос, сколько вызовов к одному сервису, доля времени по сервисам. Рост числа span'ов на запрос после релиза — признак N+1.
5. **Метрики пулов и очередей.** Consumer lag в Kafka, длина очереди, время ожидания соединения к БД, `http.client.open_connections`, `http.client.request.time_in_queue` в .NET 8+.

**Типичные находки:**

- последовательные вызовы, которые можно сделать параллельно через `Task.WhenAll`;
- N+1 по сети — нужен batch-эндпоинт или агрегированный запрос;
- новый TLS-handshake на каждый вызов из-за `new HttpClient()` или короткого `PooledConnectionLifetime`;
- синхронная цепочка из 5 сервисов там, где хватило бы асинхронного события или локальной копии данных;
- `MaxConnectionsPerServer` или лимит соединений HTTP/1.1 при большом параллелизме — запросы ждут свободное соединение;
- service mesh sidecar с mTLS, добавляющий миллисекунды на каждый hop;
- межзональный трафик: сервисы в разных зонах доступности, +1–2 мс на каждый вызов.

**Что меняют архитектурно:** сокращают глубину синхронной цепочки, вводят бюджет времени (deadline propagation — передавать оставшееся время дальше, чтобы глубокие сервисы не работали над запросом, который клиент уже бросил), кэшируют данные других сервисов, переходят на события там, где не нужен синхронный ответ.

**Что спрашивают дальше:** как связать трассировку через Kafka (заголовки, span links), как сэмплирование может спрятать проблему, почему без инструментирования очередей и пулов трейс показывает «пустоту» и как её интерпретировать.

## Как понять, что проблема в базе данных, а не в приложении?

```yaml
category: performance-profiling
level: senior
difficulty: 4
slug: performance-profiling-kak-ponyat-chto-problema-v-baze-dannyh-a-ne-v-prilozhenii
tags: database, profiling
```

Проблему в базе подтверждают с двух сторон: в приложении время запроса должно приходиться на span'ы БД, а в самой БД должно быть видно, что эти запросы выполняются долго, ждут блокировки или ресурсы. Если span БД длинный, а в `pg_stat_statements` запрос быстрый, время теряется между ними — в пуле соединений, сети или в чтении и материализации результата на стороне приложения.

**Со стороны приложения.** Инструментирование Npgsql и EF Core через OpenTelemetry даёт span на каждую команду с текстом SQL:

```csharp
builder.Services.AddOpenTelemetry()
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation()
        .AddNpgsql())
    .WithMetrics(m => m
        .AddMeter("Npgsql")
        .AddRuntimeInstrumentation());
```

Смотрите в трейсах медленных запросов:

- доля времени запроса в span'ах БД;
- количество span'ов БД на запрос — 200 одинаковых `SELECT` означают N+1, и проблема в коде, хотя каждый запрос к базе быстрый;
- время ожидания соединения из пула (метрики Npgsql `db.client.connections.usage` по состояниям `idle`/`used` и ожидающие запросы); если пул исчерпан, запрос ждёт до того, как дойдёт до базы, и база тут ни при чём;
- разницу между span'ом команды и временем обработки строк: EF Core, материализующий 100 000 сущностей с change tracking, тратит время в приложении, а не в БД.

**Со стороны PostgreSQL:**

```sql
SELECT query, calls, mean_exec_time, total_exec_time, rows,
       shared_blks_read, shared_blks_hit, temp_blks_written
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

```sql
SELECT pid, state, wait_event_type, wait_event, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY duration DESC;
```

- **Высокий `mean_exec_time`** у ваших запросов — проблема в БД: план, индексы, объём данных. Дальше `EXPLAIN (ANALYZE, BUFFERS)` с реальными параметрами.
- **`wait_event_type = Lock`** — запросы стоят на блокировках; ищите блокирующую транзакцию через `pg_blocking_pids(pid)`. Часто это долгая транзакция приложения, которая держит строки и ждёт HTTP-вызова внутри транзакции.
- **`idle in transaction`** — приложение открыло транзакцию и не закрывает её: проблема в коде, но бьёт по базе (блокировки, раздутие таблиц, мешает VACUUM).
- **`wait_event_type = IO`, много `shared_blks_read`, `temp_blks_written`** — рабочий набор не помещается в память, сортировки уходят на диск.
- **CPU сервера БД на 100%** при нормальных отдельных запросах — суммарная нагрузка: слишком много вызовов, отсутствие кэша, тот же N+1 от многих подов.

**Таблица решений:**

| Приложение | БД | Где проблема |
| --- | --- | --- |
| span БД долгий | запрос долгий в `pg_stat_statements` | база: план, индексы, блокировки, ресурсы |
| span БД долгий | запрос быстрый | пул соединений, сеть, PgBouncer, большой объём передачи |
| много коротких span'ов | много `calls`, быстрые | код: N+1, отсутствие батчинга |
| span БД короткий, запрос долгий | — | приложение: материализация, сериализация, CPU, GC |
| растёт время у всех запросов | `Lock` или `IO` ожидания | конкуренция за ресурсы базы |

**Подводные камни:**

- `pg_stat_statements` усредняет; запрос с хорошим средним может иметь плохой хвост из-за разных параметров (generic plan против custom plan для prepared statements). Смотрите `max_exec_time`, `stddev_exec_time`.
- PgBouncer в transaction mode скрывает ожидание: приложение получило соединение к пулеру, а пулер ждёт свободное серверное соединение.
- `auto_explain` с порогом `log_min_duration` даёт реальные планы медленных выполнений — `EXPLAIN` вручную на другом наборе параметров может показать другой план.
- Масштабирование подов приложения при проблеме в базе ухудшает ситуацию: больше соединений, больше конкуренции.

**Что спрашивают дальше:** почему запрос быстрый в psql и медленный из приложения (параметризация и generic plan, другая `search_path`, другие настройки сессии, передача большого результата по сети), как найти утечку соединений из пула.

## Как измерить и снизить накладные расходы на сериализацию в горячем пути?

```yaml
category: performance-profiling
level: senior
difficulty: 4
slug: performance-profiling-kak-izmerit-i-snizit-nakladnye-rashody-na-serializaciyu-v-goryachem-pu
tags: serialization, performance
```

Стоимость сериализации меряют в двух местах: доля CPU и аллокаций в профиле прода (сколько времени запроса реально уходит на JSON) и BenchmarkDotNet на реальных payload'ах (время и байт на операцию). Снижают её в порядке убывания отдачи: меньше данных, отсутствие лишних промежуточных копий (строк и массивов), source generation вместо рефлексии, и только потом — смена формата.

**Как измерить:**

- **CPU-профиль** — inclusive time `System.Text.Json.JsonSerializer.*`, `Utf8JsonWriter`, конвертеров. Если это 3% времени, оптимизировать незачем.
- **Профиль аллокаций** — сериализация часто незаметна по CPU, но генерирует много байт: промежуточные `string`, `byte[]` в LOH, словари для `JsonDocument`.
- **Микробенчмарк на реальных данных** — выгрузите 50–100 типичных и крупных ответов, а не синтетический объект из трёх полей.

```csharp
[MemoryDiagnoser]
public class SerializeOrders
{
    private OrderPage _page = default!;
    private readonly ArrayBufferWriter<byte> _buffer = new(64 * 1024);

    [GlobalSetup]
    public void Setup() => _page = TestData.LoadOrderPage("orders-500.json");

    [Benchmark(Baseline = true)]
    public string Reflection() => JsonSerializer.Serialize(_page);

    [Benchmark]
    public int SourceGenToBuffer()
    {
        _buffer.ResetWrittenCount();
        using var writer = new Utf8JsonWriter(_buffer);
        JsonSerializer.Serialize(writer, _page, AppJsonContext.Default.OrderPage);
        return _buffer.WrittenCount;
    }
}

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(OrderPage))]
public partial class AppJsonContext : JsonSerializerContext;
```

**Что даёт эффект:**

1. **Меньше данных.** Отдельные DTO под эндпоинт вместо сериализации сущностей целиком, пагинация, отсутствие `null`-полей (`DefaultIgnoreCondition = WhenWritingNull`), отказ от вложенных графов. Сократить payload вдвое — это вдвое меньше работы на всех слоях, включая сеть и клиента.
2. **Без промежуточных строк.** `Serialize` в `string` и затем `Encoding.UTF8.GetBytes` — две копии, одна из которых в UTF-16. Пишите сразу в UTF-8: в `Stream`, `PipeWriter`, `IBufferWriter<byte>`. ASP.NET Core делает это сам, если вернуть объект из эндпоинта, а не строку.
3. **Без материализации больших входов.** `ReadAsStringAsync` + `Deserialize` против `DeserializeAsync(stream)`; для огромных массивов — `DeserializeAsyncEnumerable<T>`, обрабатывающий элементы по мере чтения.
4. **Source generation.** `JsonSerializerContext` убирает рефлексию и прогрев метаданных — заметно ускоряет первые вызовы, снижает память и обязателен для NativeAOT и trimming. В steady state выигрыш скромнее, особенно при fast-path сериализации.
5. **Переиспользование `JsonSerializerOptions`.** Создание `new JsonSerializerOptions()` на каждый вызов сбрасывает кэш метаданных — одна из самых дорогих ошибок. Options должны быть singleton.
6. **Конвертеры.** Самописный `JsonConverter`, который внутри вызывает `JsonDocument.Parse` или сериализацию в строку, убивает все выгоды. Пишите конвертеры через `Utf8JsonReader`/`Utf8JsonWriter`.
7. **Смена формата** — когда JSON действительно узкое место на межсервисном трафике: Protobuf (gRPC), MessagePack. Выигрыш — размер и CPU, цена — схема, отладка, совместимость контрактов, инструменты. Для публичного API JSON обычно остаётся.

**Для Kafka и кэшей** сериализация часто горячее, чем в HTTP: каждое сообщение проходит её на продюсере и консьюмере. Пулированные буферы, сериализация сразу в `byte[]` нужной длины или `IBufferWriter`, схемы с бинарным форматом (Avro, Protobuf) дают больше, чем в API.

**Подводные камни:** полиморфизм (`[JsonDerivedType]`) и `ReferenceHandler.Preserve` дороже обычной сериализации; `JsonNode`/`JsonDocument` удобны, но аллоцируют больше типизированных моделей; сжатие ответа (gzip/brotli) может стоить больше CPU, чем сама сериализация — для внутреннего трафика его часто отключают или используют уровень `Fastest`.

**Что спрашивают дальше:** чем `Utf8JsonReader` отличается от `JsonDocument` по модели памяти, почему `Newtonsoft.Json` медленнее (UTF-16, рефлексия, больше аллокаций), когда переход на gRPC оправдан.

## Как оценить стоимость логирования под нагрузкой и что с ней делать?

```yaml
category: performance-profiling
level: senior
difficulty: 4
slug: performance-profiling-kak-ocenit-stoimost-logirovaniya-pod-nagruzkoi-i-chto-s-nei-delat
tags: logging, performance
```

Стоимость логирования складывается из трёх частей: работа на вызывающем потоке (проверка уровня, боксинг аргументов, форматирование, захват scope'ов), доставка (sink, буфер, сериализация, сеть или диск) и обратное давление, когда sink не успевает. Её оценивают профилем CPU и аллокаций под нагрузкой и экспериментом «уровень выше / логирование выключено», а снижают через source-generated логгеры, меньший объём событий и асинхронную доставку с ограниченным буфером.

**Где прячется стоимость:**

- **Аргументы на выключенном уровне.** `_logger.LogDebug("Order {Id} {Total}", id, total)` при уровне Information не пишет ничего, но аллоцирует `object[]` под `params` и боксит `int`/`decimal`. На горячем пути это тысячи лишних аллокаций в секунду.
- **Интерполяция.** `_logger.LogInformation($"Order {id}")` форматирует строку всегда, ломает структурное логирование и кардинальность шаблонов.
- **Дорогие аргументы.** `JsonSerializer.Serialize(request)` в аргументе выполняется до проверки уровня.
- **Scope'ы.** `BeginScope` со словарём на каждый запрос и провайдер, который их собирает, — заметная доля аллокаций.
- **Синхронный sink.** Консоль в контейнере — синхронная запись в pipe; если сборщик логов (Fluent Bit, Vector) тормозит, запись блокирует потоки запросов. Файловый sink с `flush` на каждое сообщение упирается в диск.
- **Объём.** 20 строк на запрос при 5 000 RPS — 100 000 событий в секунду: CPU на сериализацию в JSON, сеть, стоимость хранения в Loki/Elasticsearch, которая часто дороже самого сервиса.

**Как измерить:**

1. CPU-профиль и профиль аллокаций под нагрузкой: доля `Microsoft.Extensions.Logging.*`, `Serilog.*`, `FormattedLogValues`, `Utf8JsonWriter` в sink'е.
2. Нагрузочный тест с текущей конфигурацией и с уровнем `Warning` — разница по RPS, p99 и CPU на запрос и есть цена.
3. Метрики самого конвейера: размер очереди асинхронного sink'а, отброшенные сообщения, lag сборщика.

**Source-generated логгеры** решают проблему вызывающего потока: проверка `IsEnabled` до любых аллокаций, без боксинга, шаблон разбирается на этапе компиляции.

```csharp
public static partial class OrderLog
{
    [LoggerMessage(EventId = 1001, Level = LogLevel.Debug,
        Message = "Order {OrderId} priced at {Total}")]
    public static partial void OrderPriced(this ILogger logger, long orderId, decimal total);

    [LoggerMessage(EventId = 1002, Level = LogLevel.Warning,
        Message = "Payment provider {Provider} responded in {ElapsedMs} ms")]
    public static partial void SlowPayment(this ILogger logger, string provider, double elapsedMs);
}

_logger.OrderPriced(order.Id, order.Total);
```

Анализатор CA1848 подсвечивает вызовы `LogXxx` с шаблоном там, где стоит перейти на `LoggerMessage`.

**Что ещё делать:**

- **Уровни по категориям.** `Microsoft.AspNetCore` и `Microsoft.EntityFrameworkCore` на `Warning`, свой код на `Information`, Debug только точечно и временно — через динамическую конфигурацию без рестарта.
- **Не логировать то, что уже есть в трейсах и метриках.** «Запрос начат/закончен с длительностью» — это метрика и span, а не две строки лога на запрос. Логи — для событий и ошибок с контекстом.
- **Асинхронная доставка с ограниченной очередью** и явной политикой переполнения: отбрасывать Debug/Info, но не ошибки. Неограниченный буфер под нагрузкой превращается в утечку памяти.
- **Сэмплирование и rate limiting** повторяющихся сообщений: одна и та же ошибка 10 000 раз в секунду при падении зависимости забьёт и CPU, и хранилище. В библиотеках `Microsoft.Extensions.Telemetry` (репозиторий dotnet/extensions) появилось встроенное сэмплирование логов.
- **Вывод в stdout в компактном формате** и сбор агентом на ноде дешевле, чем отправка по сети из процесса — процесс не держит соединения и буферы.

**Подводные камни:** исключение, залогированное на каждом уровне стека, даёт пять копий стектрейса; логирование тел запросов и ответов дорого и опасно (PII, секреты); высокая кардинальность в шаблоне (идентификатор в тексте сообщения вместо параметра) ломает группировку и индексы в хранилище.

**Что спрашивают дальше:** почему `IsEnabled` в ручном коде не спасает от боксинга без `LoggerMessage`, как не потерять логи при падении процесса (flush на shutdown, ограниченный буфер), где граница между логами и событиями аудита.

## Как построить нагрузочный тест, отражающий реальный трафик?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-postroit-nagruzochnyi-test-otrazhayuschii-realnyi-trafik
tags: load-testing, performance
```

Реалистичный нагрузочный тест воспроизводит не «RPS на один эндпоинт», а модель трафика: смесь запросов в реальных пропорциях, распределение параметров и размеров данных, открытую модель поступления запросов, разогретое состояние и объём данных как в проде. Модель берут из продовых логов и метрик, а результат проверяют по SLO (p99, ошибки, насыщение ресурсов), а не по среднему времени.

**1. Модель нагрузки из прода.**

- **Смесь операций.** По access-логам или метрикам `http.server.request.duration` с разбивкой по `http.route`: 70% чтение каталога, 20% поиск, 8% корзина, 2% оформление заказа. Тест одного эндпоинта не покажет конкуренцию за общие ресурсы — пул соединений, кэш, блокировки.
- **Распределение параметров.** Реальные пользователи запрашивают популярные товары чаще (Zipf-распределение), у нескольких крупных клиентов на порядок больше данных. Один и тот же `id` в каждом запросе даёт 100% попаданий в кэш и нереально хороший результат.
- **Профиль во времени.** Суточный пик, всплески (рассылка, начало распродажи), медленный рост — разные тесты.
- **Сессии и состояние.** Логин, токены, корзина — сценарии, а не независимые запросы.

**2. Открытая модель вместо закрытой.** Закрытая модель (N виртуальных пользователей, следующий запрос после ответа) при деградации системы сама снижает нагрузку — и тест рисует красивую latency. Это и есть coordinated omission. Реальные клиенты не ждут друг друга, поэтому используйте arrival rate:

```javascript
export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 2000,
      stages: [
        { target: 800, duration: '5m' },
        { target: 800, duration: '20m' },
        { target: 1500, duration: '5m' },
      ],
      exec: 'browse',
    },
    checkout: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '30m',
      preAllocatedVUs: 50,
      exec: 'checkout',
    },
  },
  thresholds: {
    'http_req_duration{scenario:browse}': ['p(99)<300'],
    'http_req_failed': ['rate<0.001'],
  },
};
```

Это k6; в NBomber для .NET аналог — `Simulation.Inject` против `KeepConstant`.

**3. Данные и окружение.** Объём базы как в проде (план запроса на 10 000 строк и на 50 млн — разные планы), реалистичные размеры payload'ов, те же лимиты подов, число реплик, настройки GC и пулов. Внешние зависимости — либо реальные стенды, либо заглушки с правдоподобной latency и ошибками, а не мгновенные ответы.

**4. Длительность и прогрев.** Минимум десятки минут на плато: утечки памяти, рост Gen2, переполнение кэшей, фрагментация, ротация соединений проявляются не сразу. Первые минуты (JIT, холодный кэш) анализируйте отдельно.

**5. Генератор не должен быть узким местом.** Нагрузчик на отдельных машинах, мониторинг его CPU и сети, проверка, что фактический rate совпадает с заданным (k6 сообщает `dropped_iterations`).

**6. Что снимать.** Клиентские p50/p95/p99 и ошибки, серверные метрики (CPU, троттлинг, GC, пул потоков, пулы соединений), метрики БД и брокеров, трейсы медленных запросов. Цель — найти не только «держит ли 1500 RPS», но и какой ресурс насыщается первым и на какой нагрузке начинается колено кривой latency.

**Альтернативы и дополнения:** shadow traffic (зеркалирование реальных запросов на тестовый стенд), replay записанного трафика (GoReplay), canary с постепенным увеличением доли трафика — они ближе к реальности, но требуют аккуратности с запросами, имеющими побочные эффекты.

**Что спрашивают дальше:** как тестировать операции записи без загрязнения данных, как встроить нагрузочный тест в CI (короткий smoke-perf на каждый релиз с порогами, полный — по расписанию), почему результат на стенде с одной репликой нельзя линейно умножать на число реплик.
