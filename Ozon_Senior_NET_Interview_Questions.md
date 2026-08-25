# Ozon Senior .NET — вопросы для собеседования

Файл в формате импорта: каждый вопрос — заголовок `##`, под ним YAML-блок
с метаданными, дальше текст ответа. Полное описание формата — в
`tools/questions.md`.

**Ответы пока не написаны** — под каждым вопросом стоит `TODO`. Импорт такой
файл примет (валидация требует лишь непустой ответ), но лучше заполнять
раздел за разделом: у скрипта есть `--update`, поэтому повторный запуск
обновит уже загруженные вопросы, а не создаст дубли.

Проверить разбор перед отправкой:

```bash
node tools/import-questions.mjs --file Ozon_Senior_NET_Interview_Questions.md --dry-run
```

## Чем senior-вопросы отличаются от middle

На senior-интервью меняется не количество вопросов, а их тип. Проверяют не
знание определений, а инженерное мышление: понимание trade-offs и умение
разбираться с production-проблемой.

| | Middle | Senior |
| --- | --- | --- |
| Формулировка | «Что такое SemaphoreSlim?» | «API обрабатывает 20 000 RPS, внешний сервис допускает 500 одновременных запросов. Как ограничите concurrency? Что будет при всплеске нагрузки? Как избежите ThreadPool starvation? Что произойдёт при падении внешнего сервиса?» |
| Что проверяют | знание API | выбор решения и цену этого выбора |
| Ожидаемый ответ | определение | компромиссы, метрики, поведение при отказе |

Поэтому вопросы ниже сформулированы через сценарий или сравнение вариантов, а
не через «что такое X». Сложность 4 — требует опыта, 5 — требует разбора
trade-offs или расследования production-инцидента.

| Раздел | Категория | Вопросов |
| --- | --- | --- |
| Advanced C# / CLR | `advanced-csharp` | 25 |
| Advanced Multithreading | `advanced-concurrency` | 20 |
| Advanced ASP.NET Core | `advanced-aspnet` | 22 |
| Advanced PostgreSQL | `advanced-postgresql` | 25 |
| Distributed Systems | `distributed-systems` | 20 |
| Kafka Advanced | `kafka-advanced` | 20 |
| Microservices Architecture | `microservices-advanced` | 20 |
| System Design — Senior | `system-design-senior` | 20 |
| Performance / Profiling | `performance-profiling` | 18 |
| Architecture & Design Patterns | `architecture-patterns` | 16 |
| DevOps / Infrastructure | `devops-senior` | 18 |
| **Итого** | | **224** |

---

## Приоритет подготовки

Порядок, в котором стоит закрывать разделы для Senior .NET backend:

1. Advanced C# / CLR — модель памяти, GC под нагрузкой, аллокации
2. Advanced Multithreading — lock-free, ThreadPool starvation, backpressure
3. Advanced PostgreSQL — MVCC, vacuum, планировщик, блокировки
4. Distributed Systems — согласованность, идемпотентность, отказы
5. Kafka Advanced — гарантии доставки, rebalance, lag
6. Performance / Profiling — разбор production-инцидентов
7. System Design — Senior — масштаб, multi-region, disaster recovery
8. Microservices Architecture — Saga, Outbox, распил монолита
9. Advanced ASP.NET Core — Kestrel, конвейер, high-load API
10. DevOps / Infrastructure — Kubernetes, деплой, observability
11. Architecture & Design Patterns — обоснование решений

---

# Advanced C# / CLR

## Что гарантирует модель памяти .NET и почему без volatile или барьера чтение может вернуть устаревшее значение?

```yaml
category: advanced-csharp
level: senior
difficulty: 5
slug: advanced-csharp-chto-garantiruet-model-pamyati-net-i-pochemu-bez-volatile-ili-barera-c
tags: memory-model, clr
```

TODO

## Чем отличаются гарантии volatile, Interlocked и Volatile.Read/Write, и когда каждого из них недостаточно?

```yaml
category: advanced-csharp
level: senior
difficulty: 5
slug: advanced-csharp-chem-otlichayutsya-garantii-volatile-interlocked-i-volatile-read-write
tags: memory-model, synchronization
```

TODO

## Как работает Tiered Compilation и почему первые вызовы метода могут быть медленнее в разы?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-kak-rabotaet-tiered-compilation-i-pochemu-pervye-vyzovy-metoda-mogut-b
tags: jit, performance
```

TODO

## Что такое OSR (On-Stack Replacement) и какую проблему Tiered Compilation он решает?

```yaml
category: advanced-csharp
level: senior
difficulty: 5
slug: advanced-csharp-chto-takoe-osr-on-stack-replacement-i-kakuyu-problemu-tiered-compilati
tags: jit, performance
```

TODO

## Как ReadyToRun и NativeAOT влияют на время старта, пиковую производительность и размер образа?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-kak-readytorun-i-nativeaot-vliyayut-na-vremya-starta-pikovuyu-proizvod
tags: jit, performance
```

TODO

## Почему в бенчмарке метод может быть быстрее, чем в проде, из-за инлайнинга — и как это проверить?

```yaml
category: advanced-csharp
level: senior
difficulty: 5
slug: advanced-csharp-pochemu-v-benchmarke-metod-mozhet-byt-bystree-chem-v-prode-iz-za-inlai
tags: jit, profiling
```

TODO

## Что такое escape analysis и стековая аллокация в .NET, и на что реально можно рассчитывать?

```yaml
category: advanced-csharp
level: senior
difficulty: 5
slug: advanced-csharp-chto-takoe-escape-analysis-i-stekovaya-allokaciya-v-net-i-na-chto-real
tags: allocations, jit
```

TODO

## Как найти и убрать аллокации в горячем пути, если профилировщик показывает высокий Gen 0?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-kak-naiti-i-ubrat-allokacii-v-goryachem-puti-esli-profilirovschik-poka
tags: allocations, profiling
```

TODO

## Почему Span<T> нельзя сохранить в поле класса и как обойти это ограничение?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-pochemu-span-t-nelzya-sohranit-v-pole-klassa-i-kak-oboiti-eto-ogranich
tags: span, memory
```

TODO

## Когда Memory<T> оправдан вместо Span<T>, и какова цена этого перехода?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-kogda-memory-t-opravdan-vmesto-span-t-i-kakova-cena-etogo-perehoda
tags: span, async
```

TODO

## Как устроен ArrayPool<T> и какие ошибки при его использовании приводят к утечкам?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-kak-ustroen-arraypool-t-i-kakie-oshibki-pri-ego-ispolzovanii-privodyat
tags: allocations, memory
```

TODO

## Что такое stackalloc и как не получить переполнение стека при его использовании?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-chto-takoe-stackalloc-i-kak-ne-poluchit-perepolnenie-steka-pri-ego-isp
tags: span, memory
```

TODO

## Когда unsafe-код действительно оправдан и какие гарантии рантайма он снимает?

```yaml
category: advanced-csharp
level: senior
difficulty: 5
slug: advanced-csharp-kogda-unsafe-kod-deistvitelno-opravdan-i-kakie-garantii-rantaima-on-sn
tags: unsafe, memory
```

TODO

## Что делает GC.KeepAlive и fixed, и почему без них unsafe-код может читать перемещённую память?

```yaml
category: advanced-csharp
level: senior
difficulty: 5
slug: advanced-csharp-chto-delaet-gc-keepalive-i-fixed-i-pochemu-bez-nih-unsafe-kod-mozhet-c
tags: unsafe, memory
```

TODO

## Почему reflection дорог и какие способы его ускорить существуют?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-pochemu-reflection-dorog-i-kakie-sposoby-ego-uskorit-suschestvuyut
tags: reflection, performance
```

TODO

## Как source generators решают проблемы reflection и какие ограничения у них есть?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-kak-source-generators-reshayut-problemy-reflection-i-kakie-ogranicheni
tags: source-generators, performance
```

TODO

## Когда expression trees предпочтительнее скомпилированных делегатов и наоборот?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-kogda-expression-trees-predpochtitelnee-skompilirovannyh-delegatov-i-n
tags: expression-trees, performance
```

TODO

## Как устроен вызов делегата и почему многоадресный делегат дороже одиночного?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-kak-ustroen-vyzov-delegata-i-pochemu-mnogoadresnyi-delegat-dorozhe-odi
tags: delegates, performance
```

TODO

## Чем Workstation GC отличается от Server GC под реальной нагрузкой и как выбрать режим?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-chem-workstation-gc-otlichaetsya-ot-server-gc-pod-realnoi-nagruzkoi-i-
tags: gc, performance
```

TODO

## Что такое Background GC и почему пауза Gen 2 всё равно может быть заметной?

```yaml
category: advanced-csharp
level: senior
difficulty: 5
slug: advanced-csharp-chto-takoe-background-gc-i-pochemu-pauza-gen-2-vse-ravno-mozhet-byt-za
tags: gc, performance
```

TODO

## Как влияет ServerGarbageCollection и ConcurrentGC на latency в контейнере с лимитом CPU?

```yaml
category: advanced-csharp
level: senior
difficulty: 5
slug: advanced-csharp-kak-vliyaet-servergarbagecollection-i-concurrentgc-na-latency-v-kontei
tags: gc, devops
```

TODO

## Почему LOH фрагментируется и как с этим бороться без ручного GC.Collect?

```yaml
category: advanced-csharp
level: senior
difficulty: 5
slug: advanced-csharp-pochemu-loh-fragmentiruetsya-i-kak-s-etim-borotsya-bez-ruchnogo-gc-col
tags: gc, memory
```

TODO

## Что такое GC pressure и по каким метрикам вы поймёте, что он стал узким местом?

```yaml
category: advanced-csharp
level: senior
difficulty: 4
slug: advanced-csharp-chto-takoe-gc-pressure-i-po-kakim-metrikam-vy-poimete-chto-on-stal-uzk
tags: gc, observability
```

TODO

## Как ограничение памяти в Kubernetes влияет на поведение GC и почему pod получает OOMKilled?

```yaml
category: advanced-csharp
level: senior
difficulty: 5
slug: advanced-csharp-kak-ogranichenie-pamyati-v-kubernetes-vliyaet-na-povedenie-gc-i-pochem
tags: gc, devops
```

TODO

## Приложение потребляет 8 ГБ, но dotnet-counters показывает heap 1 ГБ. Куда ушла память?

```yaml
category: advanced-csharp
level: senior
difficulty: 5
slug: advanced-csharp-prilozhenie-potreblyaet-8-gb-no-dotnet-counters-pokazyvaet-heap-1-gb-k
tags: memory, profiling
```

TODO

---

# Advanced Multithreading

## Когда lock-free структура реально быстрее блокировки, а когда только усложняет код?

```yaml
category: advanced-concurrency
level: senior
difficulty: 5
slug: advanced-concurrency-kogda-lock-free-struktura-realno-bystree-blokirovki-a-kogda-tolko-uslo
tags: lock-free, performance
```

TODO

## Как реализовать потокобезопасный счётчик через CAS и почему наивный цикл может не завершиться?

```yaml
category: advanced-concurrency
level: senior
difficulty: 5
slug: advanced-concurrency-kak-realizovat-potokobezopasnyi-schetchik-cherez-cas-i-pochemu-naivnyi
tags: lock-free, cas
```

TODO

## Что такое ABA-проблема и какими способами её решают?

```yaml
category: advanced-concurrency
level: senior
difficulty: 5
slug: advanced-concurrency-chto-takoe-aba-problema-i-kakimi-sposobami-ee-reshayut
tags: lock-free, cas
```

TODO

## Зачем нужны барьеры памяти и почему корректный на x86 код ломается на ARM?

```yaml
category: advanced-concurrency
level: senior
difficulty: 5
slug: advanced-concurrency-zachem-nuzhny-barery-pamyati-i-pochemu-korrektnyi-na-x86-kod-lomaetsya
tags: memory-model, memory-barriers
```

TODO

## Как diagnose lock contention и какие метрики покажут, что блокировка стала узким местом?

```yaml
category: advanced-concurrency
level: senior
difficulty: 5
slug: advanced-concurrency-kak-diagnose-lock-contention-i-kakie-metriki-pokazhut-chto-blokirovka-
tags: contention, profiling
```

TODO

## Что такое ThreadPool starvation, как он проявляется в метриках и чем отличается от нехватки CPU?

```yaml
category: advanced-concurrency
level: senior
difficulty: 5
slug: advanced-concurrency-chto-takoe-threadpool-starvation-kak-on-proyavlyaetsya-v-metrikah-i-ch
tags: threadpool, async
```

TODO

## Почему синхронное ожидание async-метода приводит к deadlock и почему в ASP.NET Core это иногда «работает»?

```yaml
category: advanced-concurrency
level: senior
difficulty: 4
slug: advanced-concurrency-pochemu-sinhronnoe-ozhidanie-async-metoda-privodit-k-deadlock-i-pochem
tags: async, deadlock
```

TODO

## Как ограничить concurrency при обращении к внешнему сервису, допускающему 500 одновременных запросов?

```yaml
category: advanced-concurrency
level: senior
difficulty: 5
slug: advanced-concurrency-kak-ogranichit-concurrency-pri-obraschenii-k-vneshnemu-servisu-dopuska
tags: throttling, resilience
```

TODO

## Чем SemaphoreSlim.WaitAsync лучше блокирующего Wait при высокой нагрузке?

```yaml
category: advanced-concurrency
level: senior
difficulty: 4
slug: advanced-concurrency-chem-semaphoreslim-waitasync-luchshe-blokiruyuschego-wait-pri-vysokoi-
tags: throttling, async
```

TODO

## Как устроен Channel<T> и когда bounded-канал предпочтительнее unbounded?

```yaml
category: advanced-concurrency
level: senior
difficulty: 4
slug: advanced-concurrency-kak-ustroen-channel-t-i-kogda-bounded-kanal-predpochtitelnee-unbounded
tags: channels, backpressure
```

TODO

## Как реализовать backpressure, чтобы очередь не съела всю память при всплеске нагрузки?

```yaml
category: advanced-concurrency
level: senior
difficulty: 5
slug: advanced-concurrency-kak-realizovat-backpressure-chtoby-ochered-ne-sela-vsyu-pamyat-pri-vsp
tags: backpressure, scalability
```

TODO

## Что делать, если ConcurrentDictionary стал узким местом под нагрузкой?

```yaml
category: advanced-concurrency
level: senior
difficulty: 5
slug: advanced-concurrency-chto-delat-esli-concurrentdictionary-stal-uzkim-mestom-pod-nagruzkoi
tags: collections, contention
```

TODO

## Как GetOrAdd в ConcurrentDictionary может вызвать фабрику дважды и чем это опасно?

```yaml
category: advanced-concurrency
level: senior
difficulty: 4
slug: advanced-concurrency-kak-getoradd-v-concurrentdictionary-mozhet-vyzvat-fabriku-dvazhdy-i-ch
tags: collections, concurrency
```

TODO

## Чем AsyncLocal отличается от ThreadLocal и где это критично?

```yaml
category: advanced-concurrency
level: senior
difficulty: 4
slug: advanced-concurrency-chem-asynclocal-otlichaetsya-ot-threadlocal-i-gde-eto-kritichno
tags: async, context
```

TODO

## Как правильно реализовать асинхронную блокировку и почему lock тут не подходит?

```yaml
category: advanced-concurrency
level: senior
difficulty: 4
slug: advanced-concurrency-kak-pravilno-realizovat-asinhronnuyu-blokirovku-i-pochemu-lock-tut-ne-
tags: synchronization, async
```

TODO

## Как протестировать код на race condition, если баг воспроизводится раз в сутки?

```yaml
category: advanced-concurrency
level: senior
difficulty: 5
slug: advanced-concurrency-kak-protestirovat-kod-na-race-condition-esli-bag-vosproizvoditsya-raz-
tags: testing, concurrency
```

TODO

## Что такое false sharing и как его обнаружить в реальном коде?

```yaml
category: advanced-concurrency
level: senior
difficulty: 5
slug: advanced-concurrency-chto-takoe-false-sharing-i-kak-ego-obnaruzhit-v-realnom-kode
tags: performance, cpu-cache
```

TODO

## Почему CancellationToken может не остановить операцию и как сделать отмену надёжной?

```yaml
category: advanced-concurrency
level: senior
difficulty: 4
slug: advanced-concurrency-pochemu-cancellationtoken-mozhet-ne-ostanovit-operaciyu-i-kak-sdelat-o
tags: cancellation, async
```

TODO

## Как правильно завершить долгий background-обработчик при остановке приложения?

```yaml
category: advanced-concurrency
level: senior
difficulty: 4
slug: advanced-concurrency-kak-pravilno-zavershit-dolgii-background-obrabotchik-pri-ostanovke-pri
tags: hosting, cancellation
```

TODO

## Как реализовать периодическую задачу, устойчивую к перекрытию запусков и падениям?

```yaml
category: advanced-concurrency
level: senior
difficulty: 4
slug: advanced-concurrency-kak-realizovat-periodicheskuyu-zadachu-ustoichivuyu-k-perekrytiyu-zapu
tags: hosting, resilience
```

TODO

---

# Advanced ASP.NET Core

## Как устроен конвейер ASP.NET Core изнутри и что происходит от сокета до эндпоинта?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-kak-ustroen-konveier-asp-net-core-iznutri-i-chto-proishodit-ot-soketa-
tags: pipeline, internals
```

TODO

## Как Kestrel обрабатывает соединения и какие лимиты стоит настраивать под высокую нагрузку?

```yaml
category: advanced-aspnet
level: senior
difficulty: 5
slug: advanced-aspnet-kak-kestrel-obrabatyvaet-soedineniya-i-kakie-limity-stoit-nastraivat-p
tags: kestrel, scalability
```

TODO

## Что меняется для сервера при переходе на HTTP/2 и когда мультиплексирование вредит?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-chto-menyaetsya-dlya-servera-pri-perehode-na-http-2-i-kogda-multipleks
tags: http2, performance
```

TODO

## Какие проблемы решает HTTP/3 и QUIC, и когда переход оправдан?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-kakie-problemy-reshaet-http-3-i-quic-i-kogda-perehod-opravdan
tags: http3, performance
```

TODO

## Как настроить пул соединений HttpClient и почему статический HttpClient не решает всех проблем?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-kak-nastroit-pul-soedinenii-httpclient-i-pochemu-staticheskii-httpclie
tags: httpclient, connections
```

TODO

## Почему возникает исчерпание портов при использовании HttpClient и как это диагностировать?

```yaml
category: advanced-aspnet
level: senior
difficulty: 5
slug: advanced-aspnet-pochemu-voznikaet-ischerpanie-portov-pri-ispolzovanii-httpclient-i-kak
tags: httpclient, connections
```

TODO

## Как IHttpClientFactory решает проблему устаревания DNS?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-kak-ihttpclientfactory-reshaet-problemu-ustarevaniya-dns
tags: httpclient, dns
```

TODO

## Как влияет порядок middleware на производительность и корректность?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-kak-vliyaet-poryadok-middleware-na-proizvoditelnost-i-korrektnost
tags: middleware, pipeline
```

TODO

## Как написать middleware, не создающее аллокаций на каждый запрос?

```yaml
category: advanced-aspnet
level: senior
difficulty: 5
slug: advanced-aspnet-kak-napisat-middleware-ne-sozdayuschee-allokacii-na-kazhdyi-zapros
tags: middleware, allocations
```

TODO

## Как устроен DI-контейнер ASP.NET Core и когда его стоит заменить сторонним?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-kak-ustroen-di-konteiner-asp-net-core-i-kogda-ego-stoit-zamenit-storon
tags: dependency-injection, internals
```

TODO

## Почему захват Scoped-сервиса в Singleton приводит к утечке и как это обнаружить?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-pochemu-zahvat-scoped-servisa-v-singleton-privodit-k-utechke-i-kak-eto
tags: dependency-injection, memory
```

TODO

## Как правильно пробросить CancellationToken до базы данных и что даёт отмена на практике?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-kak-pravilno-probrosit-cancellationtoken-do-bazy-dannyh-i-chto-daet-ot
tags: cancellation, api-design
```

TODO

## Что происходит с текущими запросами при graceful shutdown и как не потерять их в Kubernetes?

```yaml
category: advanced-aspnet
level: senior
difficulty: 5
slug: advanced-aspnet-chto-proishodit-s-tekuschimi-zaprosami-pri-graceful-shutdown-i-kak-ne-
tags: hosting, devops
```

TODO

## Как спроектировать API на 50 000 RPS: что станет узким местом первым?

```yaml
category: advanced-aspnet
level: senior
difficulty: 5
slug: advanced-aspnet-kak-sproektirovat-api-na-50-000-rps-chto-stanet-uzkim-mestom-pervym
tags: scalability, api-design
```

TODO

## Как реализовать rate limiting, работающий на нескольких инстансах одновременно?

```yaml
category: advanced-aspnet
level: senior
difficulty: 5
slug: advanced-aspnet-kak-realizovat-rate-limiting-rabotayuschii-na-neskolkih-instansah-odno
tags: rate-limiting, scalability
```

TODO

## Чем отличаются стратегии rate limiting и какую выбрать для публичного API?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-chem-otlichayutsya-strategii-rate-limiting-i-kakuyu-vybrat-dlya-public
tags: rate-limiting, api-design
```

TODO

## Как реализовать идемпотентный POST-эндпоинт в распределённой системе?

```yaml
category: advanced-aspnet
level: senior
difficulty: 5
slug: advanced-aspnet-kak-realizovat-idempotentnyi-post-endpoint-v-raspredelennoi-sisteme
tags: idempotency, api-design
```

TODO

## Как отдавать большой ответ, не загружая его целиком в память?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-kak-otdavat-bolshoi-otvet-ne-zagruzhaya-ego-celikom-v-pamyat
tags: streaming, memory
```

TODO

## Что такое response buffering и когда его нужно отключать?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-chto-takoe-response-buffering-i-kogda-ego-nuzhno-otklyuchat
tags: streaming, performance
```

TODO

## Как организовать версионирование API, чтобы не ломать клиентов при изменении контракта?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-kak-organizovat-versionirovanie-api-chtoby-ne-lomat-klientov-pri-izmen
tags: api-design, versioning
```

TODO

## Как диагностировать рост p99 latency при нормальном среднем времени ответа?

```yaml
category: advanced-aspnet
level: senior
difficulty: 5
slug: advanced-aspnet-kak-diagnostirovat-rost-p99-latency-pri-normalnom-srednem-vremeni-otve
tags: observability, performance
```

TODO

## Почему health check может отвечать OK, когда приложение фактически неработоспособно?

```yaml
category: advanced-aspnet
level: senior
difficulty: 4
slug: advanced-aspnet-pochemu-health-check-mozhet-otvechat-ok-kogda-prilozhenie-fakticheski-
tags: observability, devops
```

TODO

---

# Advanced PostgreSQL

## Как устроен MVCC в PostgreSQL и почему UPDATE создаёт новую версию строки?

```yaml
category: advanced-postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-kak-ustroen-mvcc-v-postgresql-i-pochemu-update-sozdaet-novuyu-versiyu-
tags: mvcc, internals
```

TODO

## Что такое bloat таблиц и индексов, как его обнаружить и убрать?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-chto-takoe-bloat-tablic-i-indeksov-kak-ego-obnaruzhit-i-ubrat
tags: vacuum, maintenance
```

TODO

## Почему autovacuum не успевает и как его настраивать под высокую нагрузку записи?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-pochemu-autovacuum-ne-uspevaet-i-kak-ego-nastraivat-pod-vysokuyu-nagru
tags: vacuum, maintenance
```

TODO

## Что такое transaction ID wraparound и чем он угрожает продакшену?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-chto-takoe-transaction-id-wraparound-i-chem-on-ugrozhaet-prodakshenu
tags: vacuum, mvcc
```

TODO

## Как работает WAL и как он влияет на скорость записи?

```yaml
category: advanced-postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-kak-rabotaet-wal-i-kak-on-vliyaet-na-skorost-zapisi
tags: wal, internals
```

TODO

## Что происходит во время checkpoint и почему latency периодически подскакивает?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-chto-proishodit-vo-vremya-checkpoint-i-pochemu-latency-periodicheski-p
tags: wal, performance
```

TODO

## Как настройки synchronous_commit влияют на надёжность и производительность?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-nastroiki-synchronous-commit-vliyayut-na-nadezhnost-i-proizvoditel
tags: wal, durability
```

TODO

## Чем физическая репликация отличается от логической и когда нужна каждая?

```yaml
category: advanced-postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-chem-fizicheskaya-replikaciya-otlichaetsya-ot-logicheskoi-i-kogda-nuzh
tags: replication, architecture
```

TODO

## Что такое replication lag, как его измерять и какие последствия у чтения с реплики?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-chto-takoe-replication-lag-kak-ego-izmeryat-i-kakie-posledstviya-u-cht
tags: replication, consistency
```

TODO

## Как выполнить переключение на реплику без потери данных и какой ценой?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-vypolnit-pereklyuchenie-na-repliku-bez-poteri-dannyh-i-kakoi-cenoi
tags: replication, resilience
```

TODO

## Как выбрать ключ партиционирования и что произойдёт при неудачном выборе?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-vybrat-klyuch-particionirovaniya-i-chto-proizoidet-pri-neudachnom-
tags: partitioning, architecture
```

TODO

## Как перевести большую работающую таблицу на партиционирование без простоя?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-perevesti-bolshuyu-rabotayuschuyu-tablicu-na-particionirovanie-bez
tags: partitioning, migration
```

TODO

## Как планировщик оценивает стоимость плана и почему ошибается на коррелированных условиях?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-planirovschik-ocenivaet-stoimost-plana-i-pochemu-oshibaetsya-na-ko
tags: query-planning, statistics
```

TODO

## Что делать, если PostgreSQL внезапно перешёл с Index Scan на Seq Scan?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-chto-delat-esli-postgresql-vnezapno-pereshel-s-index-scan-na-seq-scan
tags: query-planning, indexes
```

TODO

## Как расширенная статистика помогает планировщику и когда её стоит создавать?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-rasshirennaya-statistika-pomogaet-planirovschiku-i-kogda-ee-stoit-
tags: statistics, query-planning
```

TODO

## Как безопасно создать индекс на большой таблице в продакшене?

```yaml
category: advanced-postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-kak-bezopasno-sozdat-indeks-na-bolshoi-tablice-v-prodakshene
tags: indexes, maintenance
```

TODO

## Почему индекс может не использоваться, хотя он подходит под условие запроса?

```yaml
category: advanced-postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-pochemu-indeks-mozhet-ne-ispolzovatsya-hotya-on-podhodit-pod-uslovie-z
tags: indexes, query-planning
```

TODO

## Как диагностировать блокировки и найти запрос, держащий их?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-diagnostirovat-blokirovki-i-naiti-zapros-derzhaschii-ih
tags: locking, observability
```

TODO

## Как менять схему большой таблицы, не блокируя запись надолго?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-menyat-shemu-bolshoi-tablicy-ne-blokiruya-zapis-nadolgo
tags: locking, migration
```

TODO

## Почему deadlock возникает при обновлении в разном порядке и как этого избежать?

```yaml
category: advanced-postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-pochemu-deadlock-voznikaet-pri-obnovlenii-v-raznom-poryadke-i-kak-etog
tags: locking, transactions
```

TODO

## Чем отличаются уровни изоляции на практике и какие аномалии остаются на Repeatable Read?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-chem-otlichayutsya-urovni-izolyacii-na-praktike-i-kakie-anomalii-ostay
tags: transactions, consistency
```

TODO

## Когда стоит выбрать SELECT FOR UPDATE, а когда оптимистичную блокировку?

```yaml
category: advanced-postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-kogda-stoit-vybrat-select-for-update-a-kogda-optimistichnuyu-blokirovk
tags: locking, transactions
```

TODO

## Зачем нужен pgbouncer и какие возможности PostgreSQL ломает transaction pooling?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-zachem-nuzhen-pgbouncer-i-kakie-vozmozhnosti-postgresql-lomaet-transac
tags: connections, architecture
```

TODO

## Как найти и оптимизировать запрос, который стал медленным только под нагрузкой?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-naiti-i-optimizirovat-zapros-kotoryi-stal-medlennym-tolko-pod-nagr
tags: query-planning, performance
```

TODO

## Как удалить миллионы строк, не заблокировав таблицу и не раздув WAL?

```yaml
category: advanced-postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-udalit-milliony-strok-ne-zablokirovav-tablicu-i-ne-razduv-wal
tags: maintenance, performance
```

TODO

---

# Distributed Systems

## Что реально утверждает CAP-теорема и какие выводы из неё делают неверно?

```yaml
category: distributed-systems
level: senior
difficulty: 4
slug: distributed-systems-chto-realno-utverzhdaet-cap-teorema-i-kakie-vyvody-iz-nee-delayut-neve
tags: cap, theory
```

TODO

## Что добавляет PACELC к CAP и почему latency важна не меньше consistency?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-chto-dobavlyaet-pacelc-k-cap-i-pochemu-latency-vazhna-ne-menshe-consis
tags: cap, theory
```

TODO

## Чем отличаются модели согласованности и какую выбрать для корзины интернет-магазина?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-chem-otlichayutsya-modeli-soglasovannosti-i-kakuyu-vybrat-dlya-korziny
tags: consistency, architecture
```

TODO

## Что такое read-your-writes consistency и как обеспечить её при чтении с реплик?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-chto-takoe-read-your-writes-consistency-i-kak-obespechit-ee-pri-chteni
tags: consistency, replication
```

TODO

## Почему распределённые транзакции через two-phase commit плохо масштабируются?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-pochemu-raspredelennye-tranzakcii-cherez-two-phase-commit-ploho-massht
tags: transactions, architecture
```

TODO

## Как работает Raft и зачем нужен консенсус, если есть база данных?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-kak-rabotaet-raft-i-zachem-nuzhen-konsensus-esli-est-baza-dannyh
tags: consensus, theory
```

TODO

## Как реализовать выбор лидера и что произойдёт при split-brain?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-kak-realizovat-vybor-lidera-i-chto-proizoidet-pri-split-brain
tags: consensus, resilience
```

TODO

## Как обеспечить идемпотентность операции, если клиент повторяет запрос после таймаута?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-kak-obespechit-idempotentnost-operacii-esli-klient-povtoryaet-zapros-p
tags: idempotency, api-design
```

TODO

## Почему распределённая блокировка на Redis небезопасна и что предлагает Redlock?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-pochemu-raspredelennaya-blokirovka-na-redis-nebezopasna-i-chto-predlag
tags: distributed-locks, consistency
```

TODO

## Как обойтись без распределённой блокировки, изменив модель данных?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-kak-oboitis-bez-raspredelennoi-blokirovki-izmeniv-model-dannyh
tags: distributed-locks, architecture
```

TODO

## Почему нельзя доверять системным часам и что такое clock skew?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-pochemu-nelzya-doveryat-sistemnym-chasam-i-chto-takoe-clock-skew
tags: clocks, theory
```

TODO

## Что такое логические и векторные часы, и какую задачу они решают?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-chto-takoe-logicheskie-i-vektornye-chasy-i-kakuyu-zadachu-oni-reshayut
tags: clocks, theory
```

TODO

## Как retry без jitter создаёт лавину запросов и как проектировать повторы правильно?

```yaml
category: distributed-systems
level: senior
difficulty: 4
slug: distributed-systems-kak-retry-bez-jitter-sozdaet-lavinu-zaprosov-i-kak-proektirovat-povtor
tags: retries, resilience
```

TODO

## Что такое retry storm и как его предотвратить со стороны сервиса и клиента?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-chto-takoe-retry-storm-i-kak-ego-predotvratit-so-storony-servisa-i-kli
tags: retries, resilience
```

TODO

## Как устроен backpressure в распределённой системе и что делать, когда очередь переполнена?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-kak-ustroen-backpressure-v-raspredelennoi-sisteme-i-chto-delat-kogda-o
tags: backpressure, scalability
```

TODO

## Как отличить медленный сервис от упавшего и почему это принципиально?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-kak-otlichit-medlennyi-servis-ot-upavshego-i-pochemu-eto-principialno
tags: failure-detection, resilience
```

TODO

## Что такое gray failure и почему health check его не замечает?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-chto-takoe-gray-failure-i-pochemu-health-check-ego-ne-zamechaet
tags: failure-detection, observability
```

TODO

## Как спроектировать timeout budget для цепочки из пяти сервисов?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-kak-sproektirovat-timeout-budget-dlya-cepochki-iz-pyati-servisov
tags: timeouts, architecture
```

TODO

## Как реализовать exactly-once на практике, если сеть ненадёжна?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-kak-realizovat-exactly-once-na-praktike-esli-set-nenadezhna
tags: idempotency, consistency
```

TODO

## Как обеспечить порядок обработки событий для одной сущности при параллельных обработчиках?

```yaml
category: distributed-systems
level: senior
difficulty: 5
slug: distributed-systems-kak-obespechit-poryadok-obrabotki-sobytii-dlya-odnoi-suschnosti-pri-pa
tags: ordering, architecture
```

TODO

---

# Kafka Advanced

## Как выбрать стратегию партиционирования и что произойдёт при перекосе ключей?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-kak-vybrat-strategiyu-particionirovaniya-i-chto-proizoidet-pri-perekos
tags: partitioning, architecture
```

TODO

## Что происходит во время consumer rebalance и как минимизировать простой?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-chto-proishodit-vo-vremya-consumer-rebalance-i-kak-minimizirovat-prost
tags: rebalance, availability
```

TODO

## Чем cooperative rebalancing лучше eager и когда стоит переходить?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-chem-cooperative-rebalancing-luchshe-eager-i-kogda-stoit-perehodit
tags: rebalance, availability
```

TODO

## Как работает exactly-once в Kafka и какова его реальная цена?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-kak-rabotaet-exactly-once-v-kafka-i-kakova-ego-realnaya-cena
tags: exactly-once, transactions
```

TODO

## Как транзакции Kafka взаимодействуют с записью в базу данных?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-kak-tranzakcii-kafka-vzaimodeistvuyut-s-zapisyu-v-bazu-dannyh
tags: transactions, consistency
```

TODO

## Почему для консистентности с БД выбирают Outbox, а не транзакции Kafka?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-pochemu-dlya-konsistentnosti-s-bd-vybirayut-outbox-a-ne-tranzakcii-kaf
tags: outbox, consistency
```

TODO

## Какие гарантии доставки даёт Kafka и как настройки acks и retries на них влияют?

```yaml
category: kafka-advanced
level: senior
difficulty: 4
slug: kafka-advanced-kakie-garantii-dostavki-daet-kafka-i-kak-nastroiki-acks-i-retries-na-n
tags: delivery, durability
```

TODO

## Что произойдёт при acks=1 и падении лидера партиции?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-chto-proizoidet-pri-acks-1-i-padenii-lidera-particii
tags: delivery, replication
```

TODO

## Consumer lag растёт линейно. Как найти причину и что предпринять?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-consumer-lag-rastet-lineino-kak-naiti-prichinu-i-chto-predprinyat
tags: lag, performance
```

TODO

## Как ускорить обработку, если добавление consumer'ов больше не помогает?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-kak-uskorit-obrabotku-esli-dobavlenie-consumer-ov-bolshe-ne-pomogaet
tags: lag, scalability
```

TODO

## Как сохранить порядок сообщений при параллельной обработке внутри одного consumer'а?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-kak-sohranit-poryadok-soobschenii-pri-parallelnoi-obrabotke-vnutri-odn
tags: ordering, concurrency
```

TODO

## Как работает min.insync.replicas и что произойдёт при потере реплик?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-kak-rabotaet-min-insync-replicas-i-chto-proizoidet-pri-potere-replik
tags: replication, durability
```

TODO

## Что случится с продюсером, если брокер станет недоступен, и как не потерять сообщения?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-chto-sluchitsya-s-prodyuserom-esli-broker-stanet-nedostupen-i-kak-ne-p
tags: resilience, durability
```

TODO

## Как безопасно увеличить число партиций в работающем топике?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-kak-bezopasno-uvelichit-chislo-particii-v-rabotayuschem-topike
tags: partitioning, operations
```

TODO

## Как обрабатывать poison message, не останавливая обработку всей партиции?

```yaml
category: kafka-advanced
level: senior
difficulty: 4
slug: kafka-advanced-kak-obrabatyvat-poison-message-ne-ostanavlivaya-obrabotku-vsei-partici
tags: error-handling, resilience
```

TODO

## Как реализовать retry с задержкой, не блокируя партицию?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-kak-realizovat-retry-s-zaderzhkoi-ne-blokiruya-particiyu
tags: retries, architecture
```

TODO

## Как построить consumer на 100 000 сообщений в секунду и что станет узким местом?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-kak-postroit-consumer-na-100-000-soobschenii-v-sekundu-i-chto-stanet-u
tags: throughput, performance
```

TODO

## Как настройки batching и linger.ms влияют на пропускную способность и задержку?

```yaml
category: kafka-advanced
level: senior
difficulty: 4
slug: kafka-advanced-kak-nastroiki-batching-i-linger-ms-vliyayut-na-propusknuyu-sposobnost-
tags: throughput, performance
```

TODO

## Как перенести обработку на новую схему сообщений без простоя?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-kak-perenesti-obrabotku-na-novuyu-shemu-soobschenii-bez-prostoya
tags: migration, schema
```

TODO

## Что произойдёт при переполнении диска брокера и как это предотвратить?

```yaml
category: kafka-advanced
level: senior
difficulty: 5
slug: kafka-advanced-chto-proizoidet-pri-perepolnenii-diska-brokera-i-kak-eto-predotvratit
tags: operations, resilience
```

TODO

---

# Microservices Architecture

## Как определить границы сервисов через DDD и какие признаки говорят об ошибке?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kak-opredelit-granicy-servisov-cherez-ddd-i-kakie-priznaki-govoryat-ob
tags: ddd, architecture
```

TODO

## Что такое bounded context и почему одна сущность может по-разному выглядеть в разных сервисах?

```yaml
category: microservices-advanced
level: senior
difficulty: 4
slug: microservices-advanced-chto-takoe-bounded-context-i-pochemu-odna-suschnost-mozhet-po-raznomu-
tags: ddd, architecture
```

TODO

## Как реализовать Saga и в чём практическая разница между хореографией и оркестрацией?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kak-realizovat-saga-i-v-chem-prakticheskaya-raznica-mezhdu-horeografie
tags: saga, consistency
```

TODO

## Как проектировать компенсирующие транзакции, если откат физически невозможен?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kak-proektirovat-kompensiruyuschie-tranzakcii-esli-otkat-fizicheski-ne
tags: saga, consistency
```

TODO

## Как работает Outbox и почему без него возможна потеря события?

```yaml
category: microservices-advanced
level: senior
difficulty: 4
slug: microservices-advanced-kak-rabotaet-outbox-i-pochemu-bez-nego-vozmozhna-poterya-sobytiya
tags: outbox, consistency
```

TODO

## Зачем нужен Inbox и как он защищает от повторной обработки?

```yaml
category: microservices-advanced
level: senior
difficulty: 4
slug: microservices-advanced-zachem-nuzhen-inbox-i-kak-on-zaschischaet-ot-povtornoi-obrabotki
tags: inbox, idempotency
```

TODO

## Когда CQRS оправдан и какую сложность он приносит?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kogda-cqrs-opravdan-i-kakuyu-slozhnost-on-prinosit
tags: cqrs, architecture
```

TODO

## Как бороться с задержкой синхронизации read-модели в CQRS?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kak-borotsya-s-zaderzhkoi-sinhronizacii-read-modeli-v-cqrs
tags: cqrs, consistency
```

TODO

## Когда Event Sourcing действительно нужен и почему его часто внедряют напрасно?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kogda-event-sourcing-deistvitelno-nuzhen-i-pochemu-ego-chasto-vnedryay
tags: event-sourcing, architecture
```

TODO

## Как менять схему события в Event Sourcing, если история неизменяема?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kak-menyat-shemu-sobytiya-v-event-sourcing-esli-istoriya-neizmenyaema
tags: event-sourcing, schema
```

TODO

## Что должен и чего не должен делать API Gateway?

```yaml
category: microservices-advanced
level: senior
difficulty: 4
slug: microservices-advanced-chto-dolzhen-i-chego-ne-dolzhen-delat-api-gateway
tags: gateway, architecture
```

TODO

## Какие задачи решает service mesh и когда его сложность не оправдана?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kakie-zadachi-reshaet-service-mesh-i-kogda-ego-slozhnost-ne-opravdana
tags: service-mesh, devops
```

TODO

## Как комбинировать circuit breaker, retry и timeout, чтобы они не конфликтовали?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kak-kombinirovat-circuit-breaker-retry-i-timeout-chtoby-oni-ne-konflik
tags: resilience, patterns
```

TODO

## Как выбрать порог для circuit breaker и что произойдёт при неверной настройке?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kak-vybrat-porog-dlya-circuit-breaker-i-chto-proizoidet-pri-nevernoi-n
tags: resilience, patterns
```

TODO

## Как спланировать распил монолита и с чего начать в первую очередь?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kak-splanirovat-raspil-monolita-i-s-chego-nachat-v-pervuyu-ochered
tags: migration, architecture
```

TODO

## Как работает Strangler Fig на практике и как маршрутизировать трафик во время миграции?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kak-rabotaet-strangler-fig-na-praktike-i-kak-marshrutizirovat-trafik-v
tags: migration, architecture
```

TODO

## Как разделить общую базу данных при выделении сервиса из монолита?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kak-razdelit-obschuyu-bazu-dannyh-pri-vydelenii-servisa-iz-monolita
tags: migration, data
```

TODO

## Как согласовывать контракты между сервисами и что даёт contract testing?

```yaml
category: microservices-advanced
level: senior
difficulty: 4
slug: microservices-advanced-kak-soglasovyvat-kontrakty-mezhdu-servisami-i-chto-daet-contract-testi
tags: contracts, testing
```

TODO

## Как версионировать события, чтобы не ломать подписчиков?

```yaml
category: microservices-advanced
level: senior
difficulty: 5
slug: microservices-advanced-kak-versionirovat-sobytiya-chtoby-ne-lomat-podpischikov
tags: schema, contracts
```

TODO

## Как организовать распределённую трассировку и что делать, если контекст теряется?

```yaml
category: microservices-advanced
level: senior
difficulty: 4
slug: microservices-advanced-kak-organizovat-raspredelennuyu-trassirovku-i-chto-delat-esli-kontekst
tags: tracing, observability
```

TODO

---

# System Design — Senior

## Спроектируйте систему на 100 000 RPS: с чего начнёте и что станет узким местом?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-sproektiruite-sistemu-na-100-000-rps-s-chego-nachnete-i-chto-stanet-uz
tags: scalability, architecture
```

TODO

## Спроектируйте обработку миллиона событий в секунду с гарантией отсутствия потерь

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-sproektiruite-obrabotku-milliona-sobytii-v-sekundu-s-garantiei-otsutst
tags: throughput, architecture
```

TODO

## Как спроектировать geo-распределённую систему для пользователей на разных континентах?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-sproektirovat-geo-raspredelennuyu-sistemu-dlya-polzovatelei-na-raz
tags: geo-distribution, architecture
```

TODO

## Как обеспечить консистентность данных в multi-region архитектуре?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-obespechit-konsistentnost-dannyh-v-multi-region-arhitekture
tags: geo-distribution, consistency
```

TODO

## Как спроектировать active-active в двух регионах и как решать конфликты записи?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-sproektirovat-active-active-v-dvuh-regionah-i-kak-reshat-konflikty
tags: geo-distribution, consistency
```

TODO

## Как спланировать disaster recovery и что должно произойти при потере региона?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-splanirovat-disaster-recovery-i-chto-dolzhno-proizoiti-pri-potere-
tags: disaster-recovery, resilience
```

TODO

## Что такое RTO и RPO, и как выбранные значения меняют архитектуру?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-chto-takoe-rto-i-rpo-i-kak-vybrannye-znacheniya-menyayut-arhitekturu
tags: disaster-recovery, architecture
```

TODO

## Как проверить, что план восстановления работает, не устроив аварию в проде?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-proverit-chto-plan-vosstanovleniya-rabotaet-ne-ustroiv-avariyu-v-p
tags: disaster-recovery, testing
```

TODO

## Как выбрать схему шардирования и что делать при необходимости решардинга?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-vybrat-shemu-shardirovaniya-i-chto-delat-pri-neobhodimosti-reshard
tags: sharding, data
```

TODO

## Как перешардировать данные без простоя?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-pereshardirovat-dannye-bez-prostoya
tags: sharding, migration
```

TODO

## Как спроектировать кэш на десятки терабайт и что делать при потере кластера?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-sproektirovat-kesh-na-desyatki-terabait-i-chto-delat-pri-potere-kl
tags: caching, scalability
```

TODO

## Как предотвратить cache stampede при инвалидации популярного ключа?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-predotvratit-cache-stampede-pri-invalidacii-populyarnogo-klyucha
tags: caching, resilience
```

TODO

## Как решать конфликт между consistency и availability в оплате заказа?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-reshat-konflikt-mezhdu-consistency-i-availability-v-oplate-zakaza
tags: consistency, architecture
```

TODO

## Спроектируйте систему обработки платежей с гарантией однократного списания

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-sproektiruite-sistemu-obrabotki-platezhei-s-garantiei-odnokratnogo-spi
tags: idempotency, architecture
```

TODO

## Спроектируйте систему отслеживания посылок на 10 миллионов событий в день

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-sproektiruite-sistemu-otslezhivaniya-posylok-na-10-millionov-sobytii-v
tags: architecture, throughput
```

TODO

## Спроектируйте отказоустойчивый сервис уведомлений с приоритетами

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-sproektiruite-otkazoustoichivyi-servis-uvedomlenii-s-prioritetami
tags: architecture, resilience
```

TODO

## Как спроектировать хранение и раздачу пользовательских файлов на петабайты?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-sproektirovat-hranenie-i-razdachu-polzovatelskih-failov-na-petabai
tags: storage, scalability
```

TODO

## Как построить систему, переживающую недоступность PostgreSQL в течение 10 минут?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-postroit-sistemu-perezhivayuschuyu-nedostupnost-postgresql-v-teche
tags: resilience, architecture
```

TODO

## Что произойдёт при недоступности Redis и как заранее спроектировать деградацию?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-chto-proizoidet-pri-nedostupnosti-redis-i-kak-zaranee-sproektirovat-de
tags: resilience, caching
```

TODO

## Как система должна вести себя при десятикратном росте нагрузки за час?

```yaml
category: system-design-senior
level: senior
difficulty: 5
slug: system-design-senior-kak-sistema-dolzhna-vesti-sebya-pri-desyatikratnom-roste-nagruzki-za-c
tags: scalability, resilience
```

TODO

---

# Performance / Profiling

## Как построить корректный бенчмарк на BenchmarkDotNet и какие ошибки его обесценивают?

```yaml
category: performance-profiling
level: senior
difficulty: 4
slug: performance-profiling-kak-postroit-korrektnyi-benchmark-na-benchmarkdotnet-i-kakie-oshibki-e
tags: benchmarking, tooling
```

TODO

## Почему результат микробенчмарка часто не воспроизводится в проде?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-pochemu-rezultat-mikrobenchmarka-chasto-ne-vosproizvoditsya-v-prode
tags: benchmarking, performance
```

TODO

## Как снять трассировку в проде через dotnet-trace, не уронив сервис?

```yaml
category: performance-profiling
level: senior
difficulty: 4
slug: performance-profiling-kak-snyat-trassirovku-v-prode-cherez-dotnet-trace-ne-uroniv-servis
tags: tooling, profiling
```

TODO

## Какие метрики dotnet-counters смотреть первыми при деградации производительности?

```yaml
category: performance-profiling
level: senior
difficulty: 4
slug: performance-profiling-kakie-metriki-dotnet-counters-smotret-pervymi-pri-degradacii-proizvodi
tags: tooling, observability
```

TODO

## Как проанализировать дамп памяти и найти источник утечки?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-proanalizirovat-damp-pamyati-i-naiti-istochnik-utechki
tags: memory, profiling
```

TODO

## Как снять дамп в контейнере Kubernetes и какие подводные камни при этом есть?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-snyat-damp-v-konteinere-kubernetes-i-kakie-podvodnye-kamni-pri-eto
tags: tooling, devops
```

TODO

## Как найти причину 100% загрузки CPU, если нагрузка не изменилась?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-naiti-prichinu-100-zagruzki-cpu-esli-nagruzka-ne-izmenilas
tags: cpu, profiling
```

TODO

## Как отличить проблему GC от проблемы алгоритма по метрикам?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-otlichit-problemu-gc-ot-problemy-algoritma-po-metrikam
tags: gc, profiling
```

TODO

## Что означает высокий процент времени в GC и с чего начать оптимизацию?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-chto-oznachaet-vysokii-procent-vremeni-v-gc-i-s-chego-nachat-optimizac
tags: gc, performance
```

TODO

## Как профилировать аллокации и определить, какие из них действительно важны?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-profilirovat-allokacii-i-opredelit-kakie-iz-nih-deistvitelno-vazhn
tags: allocations, profiling
```

TODO

## Продакшен стал отвечать в пять раз медленнее. Каков ваш порядок действий?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-prodakshen-stal-otvechat-v-pyat-raz-medlennee-kakov-vash-poryadok-deis
tags: incident, profiling
```

TODO

## Потребление памяти постоянно растёт. Как выстроить расследование?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-potreblenie-pamyati-postoyanno-rastet-kak-vystroit-rassledovanie
tags: memory, incident
```

TODO

## Latency выросла только на p99. Где искать причину?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-latency-vyrosla-tolko-na-p99-gde-iskat-prichinu
tags: latency, observability
```

TODO

## Как найти узкое место, если каждый сервис по отдельности выглядит быстрым?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-naiti-uzkoe-mesto-esli-kazhdyi-servis-po-otdelnosti-vyglyadit-byst
tags: tracing, incident
```

TODO

## Как понять, что проблема в базе данных, а не в приложении?

```yaml
category: performance-profiling
level: senior
difficulty: 4
slug: performance-profiling-kak-ponyat-chto-problema-v-baze-dannyh-a-ne-v-prilozhenii
tags: database, profiling
```

TODO

## Как измерить и снизить накладные расходы на сериализацию в горячем пути?

```yaml
category: performance-profiling
level: senior
difficulty: 4
slug: performance-profiling-kak-izmerit-i-snizit-nakladnye-rashody-na-serializaciyu-v-goryachem-pu
tags: serialization, performance
```

TODO

## Как оценить стоимость логирования под нагрузкой и что с ней делать?

```yaml
category: performance-profiling
level: senior
difficulty: 4
slug: performance-profiling-kak-ocenit-stoimost-logirovaniya-pod-nagruzkoi-i-chto-s-nei-delat
tags: logging, performance
```

TODO

## Как построить нагрузочный тест, отражающий реальный трафик?

```yaml
category: performance-profiling
level: senior
difficulty: 5
slug: performance-profiling-kak-postroit-nagruzochnyi-test-otrazhayuschii-realnyi-trafik
tags: load-testing, performance
```

TODO

---

# Architecture & Design Patterns

## Где SOLID помогает, а где следование ему усложняет код без пользы?

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-gde-solid-pomogaet-a-gde-sledovanie-emu-uslozhnyaet-kod-bez-polzy
tags: solid, design
```

TODO

## Как выглядит нарушение Liskov Substitution Principle на реальном примере?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kak-vyglyadit-narushenie-liskov-substitution-principle-na-realnom-prim
tags: solid, design
```

TODO

## Что даёт Clean Architecture и какова цена её строгого соблюдения?

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-chto-daet-clean-architecture-i-kakova-cena-ee-strogogo-soblyudeniya
tags: clean-architecture, design
```

TODO

## Чем гексагональная архитектура отличается от слоёной на практике?

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-chem-geksagonalnaya-arhitektura-otlichaetsya-ot-sloenoi-na-praktike
tags: hexagonal, design
```

TODO

## Как применить Dependency Inversion, не создавая интерфейс на каждый класс?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kak-primenit-dependency-inversion-ne-sozdavaya-interfeis-na-kazhdyi-kl
tags: solid, design
```

TODO

## Когда паттерн Repository поверх ORM избыточен?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kogda-pattern-repository-poverh-orm-izbytochen
tags: patterns, orm
```

TODO

## Когда Strategy лучше конструкции switch и когда наоборот?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kogda-strategy-luchshe-konstrukcii-switch-i-kogda-naoborot
tags: patterns, design
```

TODO

## Какую задачу решает Mediator и почему он часто превращается в свалку?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kakuyu-zadachu-reshaet-mediator-i-pochemu-on-chasto-prevraschaetsya-v-
tags: patterns, design
```

TODO

## Когда Decorator предпочтительнее наследования?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kogda-decorator-predpochtitelnee-nasledovaniya
tags: patterns, design
```

TODO

## Чем Proxy отличается от Decorator по назначению?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-chem-proxy-otlichaetsya-ot-decorator-po-naznacheniyu
tags: patterns, design
```

TODO

## Зачем нужен Adapter при интеграции со сторонним API?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-zachem-nuzhen-adapter-pri-integracii-so-storonnim-api
tags: patterns, integration
```

TODO

## Как выбрать между Factory и прямым конструктором?

```yaml
category: architecture-patterns
level: senior
difficulty: 4
slug: architecture-patterns-kak-vybrat-mezhdu-factory-i-pryamym-konstruktorom
tags: patterns, design
```

TODO

## Приведите пример, где паттерн навредил проекту

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-privedite-primer-gde-pattern-navredil-proektu
tags: patterns, design
```

TODO

## Как понять, что абстракция преждевременна?

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-kak-ponyat-chto-abstrakciya-prezhdevremenna
tags: design, architecture
```

TODO

## Как принимать архитектурные решения и как их документировать?

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-kak-prinimat-arhitekturnye-resheniya-i-kak-ih-dokumentirovat
tags: architecture, process
```

TODO

## Как обосновать техдолг перед бизнесом и приоритизировать его?

```yaml
category: architecture-patterns
level: senior
difficulty: 5
slug: architecture-patterns-kak-obosnovat-tehdolg-pered-biznesom-i-prioritizirovat-ego
tags: architecture, process
```

TODO

---

# DevOps / Infrastructure

## Как собрать минимальный образ .NET-приложения и что даёт multi-stage сборка?

```yaml
category: devops-senior
level: senior
difficulty: 4
slug: devops-senior-kak-sobrat-minimalnyi-obraz-net-prilozheniya-i-chto-daet-multi-stage-s
tags: docker, build
```

TODO

## Как настроить лимиты CPU и памяти для .NET в Kubernetes, чтобы не получить троттлинг и OOMKilled?

```yaml
category: devops-senior
level: senior
difficulty: 5
slug: devops-senior-kak-nastroit-limity-cpu-i-pamyati-dlya-net-v-kubernetes-chtoby-ne-polu
tags: kubernetes, performance
```

TODO

## Почему приложение работает медленнее при лимите CPU и как это связано с GC?

```yaml
category: devops-senior
level: senior
difficulty: 5
slug: devops-senior-pochemu-prilozhenie-rabotaet-medlennee-pri-limite-cpu-i-kak-eto-svyaza
tags: kubernetes, gc
```

TODO

## Чем readiness отличается от liveness и что произойдёт при их путанице?

```yaml
category: devops-senior
level: senior
difficulty: 4
slug: devops-senior-chem-readiness-otlichaetsya-ot-liveness-i-chto-proizoidet-pri-ih-putan
tags: kubernetes, availability
```

TODO

## Как настроить graceful shutdown в Kubernetes, чтобы не терять запросы при деплое?

```yaml
category: devops-senior
level: senior
difficulty: 5
slug: devops-senior-kak-nastroit-graceful-shutdown-v-kubernetes-chtoby-ne-teryat-zaprosy-p
tags: kubernetes, availability
```

TODO

## Как устроен rolling deployment и что произойдёт при несовместимой миграции БД?

```yaml
category: devops-senior
level: senior
difficulty: 5
slug: devops-senior-kak-ustroen-rolling-deployment-i-chto-proizoidet-pri-nesovmestimoi-mig
tags: deployment, migration
```

TODO

## Как накатывать миграции базы данных при нескольких инстансах приложения?

```yaml
category: devops-senior
level: senior
difficulty: 5
slug: devops-senior-kak-nakatyvat-migracii-bazy-dannyh-pri-neskolkih-instansah-prilozheniy
tags: deployment, migration
```

TODO

## Когда стоит выбрать blue-green, а когда canary?

```yaml
category: devops-senior
level: senior
difficulty: 5
slug: devops-senior-kogda-stoit-vybrat-blue-green-a-kogda-canary
tags: deployment, strategy
```

TODO

## Как организовать canary-деплой и по каким метрикам принимать решение об откате?

```yaml
category: devops-senior
level: senior
difficulty: 5
slug: devops-senior-kak-organizovat-canary-deploi-i-po-kakim-metrikam-prinimat-reshenie-ob
tags: deployment, observability
```

TODO

## Как построить пайплайн CI/CD с быстрым и безопасным откатом?

```yaml
category: devops-senior
level: senior
difficulty: 4
slug: devops-senior-kak-postroit-paiplain-ci-cd-s-bystrym-i-bezopasnym-otkatom
tags: cicd, deployment
```

TODO

## Что должно попадать в метрики, а что в логи, и почему это разные инструменты?

```yaml
category: devops-senior
level: senior
difficulty: 4
slug: devops-senior-chto-dolzhno-popadat-v-metriki-a-chto-v-logi-i-pochemu-eto-raznye-inst
tags: observability, strategy
```

TODO

## Как выбрать SLI и SLO для сервиса и что делать при исчерпании error budget?

```yaml
category: devops-senior
level: senior
difficulty: 5
slug: devops-senior-kak-vybrat-sli-i-slo-dlya-servisa-i-chto-delat-pri-ischerpanii-error-b
tags: observability, slo
```

TODO

## Какие алерты действительно нужны и как избежать усталости от оповещений?

```yaml
category: devops-senior
level: senior
difficulty: 5
slug: devops-senior-kakie-alerty-deistvitelno-nuzhny-i-kak-izbezhat-ustalosti-ot-opovesche
tags: observability, alerting
```

TODO

## Как настроить OpenTelemetry в .NET и что инструментировать в первую очередь?

```yaml
category: devops-senior
level: senior
difficulty: 4
slug: devops-senior-kak-nastroit-opentelemetry-v-net-i-chto-instrumentirovat-v-pervuyu-och
tags: opentelemetry, observability
```

TODO

## Как работает сэмплирование трассировок и как не потерять редкие ошибки?

```yaml
category: devops-senior
level: senior
difficulty: 5
slug: devops-senior-kak-rabotaet-semplirovanie-trassirovok-i-kak-ne-poteryat-redkie-oshibk
tags: tracing, observability
```

TODO

## Как связать логи, метрики и трассировки при разборе инцидента?

```yaml
category: devops-senior
level: senior
difficulty: 5
slug: devops-senior-kak-svyazat-logi-metriki-i-trassirovki-pri-razbore-incidenta
tags: observability, incident
```

TODO

## Как хранить секреты и организовать их ротацию без простоя?

```yaml
category: devops-senior
level: senior
difficulty: 4
slug: devops-senior-kak-hranit-sekrety-i-organizovat-ih-rotaciyu-bez-prostoya
tags: security, secrets
```

TODO

## Как организовать нагрузочное тестирование в окружении, близком к продакшену?

```yaml
category: devops-senior
level: senior
difficulty: 5
slug: devops-senior-kak-organizovat-nagruzochnoe-testirovanie-v-okruzhenii-blizkom-k-proda
tags: load-testing, devops
```

TODO
