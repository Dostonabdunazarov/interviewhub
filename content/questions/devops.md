# DevOps и инфраструктура

Вопросы категории `devops` в формате импорта (`tools/questions.md`): 18 шт.

```bash
node tools/import-questions.mjs --file content/questions/devops.md --dry-run
node tools/import-questions.mjs --file content/questions/devops.md --url … --email … --update
```

---

## Как собрать минимальный образ .NET-приложения и что даёт multi-stage сборка?

```yaml
category: devops
level: senior
difficulty: 4
slug: devops-senior-kak-sobrat-minimalnyi-obraz-net-prilozheniya-i-chto-daet-multi-stage-s
tags: docker, build
```

Multi-stage сборка разделяет Dockerfile на стадии: в одной стоит SDK (около 800 МБ), там выполняются `restore`, `build` и `publish`, а в финальный образ копируется только результат `publish` поверх маленького runtime-образа. Для минимального образа берут **chiseled**-базу (`aspnet:10.0-noble-chiseled` или `runtime-deps` для self-contained/AOT): это Ubuntu без shell и пакетного менеджера, которая по умолчанию работает от non-root пользователя.

**Типичный Dockerfile:**

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Packages.props Directory.Build.props ./
COPY src/Orders.Api/Orders.Api.csproj src/Orders.Api/
RUN dotnet restore src/Orders.Api/Orders.Api.csproj
COPY . .
RUN dotnet publish src/Orders.Api/Orders.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Orders.Api.dll"]
```

**Что здесь важно:**

- **Порядок слоёв ради кэша.** Сначала копируются только `.csproj` и props-файлы, затем `restore`. Пока зависимости не менялись, слой с пакетами берётся из кэша, и сборка после правки кода идёт за секунды, а не минуты. Без `.dockerignore` (`bin/`, `obj/`, `.git/`) `COPY . .` инвалидирует кэш на каждый коммит и тащит мусор в контекст.
- **Финальный образ не содержит SDK, исходников и NuGet-кэша.** Меньше размер, меньше CVE в сканере, нет компилятора внутри контейнера.
- **Non-root.** С .NET 8 образы содержат пользователя `app` (переменная `APP_UID`), а дефолтный порт ASP.NET Core сменился с 80 на 8080, потому что непривилегированный процесс не может слушать порты ниже 1024. Chiseled-образы уже запускаются от non-root, `USER` в примере делает это явным, что удобно для `runAsNonRoot: true` в `securityContext`.

**Варианты базы по размеру:**

| База | Что внутри | Когда брать |
| --- | --- | --- |
| `aspnet:10.0` (Debian/Ubuntu) | полный дистрибутив, shell, apt | нужны нативные зависимости, отладка внутри контейнера |
| `aspnet:10.0-alpine` | musl, маленький | небольшой размер с shell; помнить о различиях musl |
| `aspnet:10.0-noble-chiseled` | только runtime и минимум библиотек | дефолт для продакшена |
| `aspnet:10.0-noble-chiseled-extra` | плюс ICU и tzdata | нужна культура и часовые пояса |
| `runtime-deps:10.0-noble-chiseled` | только нативные зависимости | self-contained, trimmed или Native AOT |

С Native AOT образ сжимается до десятков мегабайт, но ценой ограничений: нет runtime-кодогенерации, рефлексия требует аннотаций, часть библиотек (EF Core в полном объёме, некоторые сериализаторы) не поддерживается.

**Альтернатива без Dockerfile** — SDK собирает образ сам:

```bash
dotnet publish src/Orders.Api -c Release /t:PublishContainer -p:ContainerFamily=noble-chiseled -p:ContainerRepository=orders-api
```

**Подводные камни в продакшене:**

- **Globalization.** В chiseled нет ICU, и .NET в таких образах работает в invariant mode: `ToUpper` для турецкого, сортировка по-русски и `CultureInfo("ru-RU")` ведут себя иначе. Нужна культура — берите `-extra`.
- **Нет shell.** `kubectl exec ... sh` не сработает, `HEALTHCHECK CMD curl` тоже. Отладка — через `kubectl debug -it pod --image=busybox --target=app` (ephemeral container), healthcheck — через probes Kubernetes.
- **Права на файлы.** Non-root процесс не может писать в `/app`. Временные файлы — в `emptyDir`, а `readOnlyRootFilesystem: true` в `securityContext` надёжно ловит такие места заранее.
- **Тег против digest.** `aspnet:10.0` перезаписывается при каждом патче. Для воспроизводимости в CI фиксируют digest, а обновления базового образа подтягивают Renovate/Dependabot.

**Что спрашивают дальше:** почему layer caching ломается при неправильном порядке `COPY`; чем self-contained отличается от framework-dependent и trimmed; как собирать multi-arch образы (`docker buildx --platform linux/amd64,linux/arm64`); что даёт BuildKit `--mount=type=cache,target=/root/.nuget/packages`.

## Как настроить лимиты CPU и памяти для .NET в Kubernetes, чтобы не получить троттлинг и OOMKilled?

```yaml
category: devops
level: senior
difficulty: 5
slug: devops-senior-kak-nastroit-limity-cpu-i-pamyati-dlya-net-v-kubernetes-chtoby-ne-polu
tags: kubernetes, performance
```

Рабочая схема для большинства .NET-сервисов: **память — `requests` равен `limits`**, потому что память несжимаемый ресурс и её превышение заканчивается убийством процесса; **CPU — `requests` по реальному потреблению, а `limits` либо нет, либо с большим запасом**, потому что CPU сжимаемый ресурс и его превышение даёт троттлинг, а не падение. И обязательно согласовать с лимитами настройки runtime: размер кучи GC и число процессоров, которые видит .NET.

**Как Kubernetes применяет ресурсы:**

| Параметр | Механизм на ноде | Последствие превышения |
| --- | --- | --- |
| `requests.cpu` | вес в cgroup (`cpu.weight`), учитывается планировщиком | ничего: это гарантия доли при конкуренции |
| `limits.cpu` | CFS quota на период 100 мс | троттлинг до конца периода |
| `requests.memory` | планирование и приоритет вытеснения | при нехватке памяти на ноде под вытесняется раньше |
| `limits.memory` | `memory.max` в cgroup | OOM killer, `OOMKilled`, exit code 137 |

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "768Mi"
  limits:
    memory: "768Mi"
```

**Как .NET видит контейнер.** Runtime читает cgroup v1/v2:

- `Environment.ProcessorCount` равен CPU limit, округлённому вверх (`1500m` даёт 2). Если limit не задан, .NET видит все ядра ноды, и Server GC создаёт по куче и GC-потоку на каждое из 32–64 ядер, а ThreadPool стартует с тем же минимумом потоков. Поэтому без CPU limit стоит явно задать `DOTNET_PROCESSOR_COUNT` или `DOTNET_GCHeapCount`.
- `GCHeapHardLimit` по умолчанию равен 75% от memory limit. Остальные 25% — для всего, что не управляемая куча: стеки потоков, JIT-код, нативные буферы Kestrel и TLS, `MemoryMappedFile`, нативные библиотеки (SkiaSharp, драйверы).

```yaml
env:
  - name: DOTNET_GCHeapHardLimitPercent
    value: "0x46"
  - name: DOTNET_PROCESSOR_COUNT
    value: "2"
```

Значения `DOTNET_GC*` задаются в шестнадцатеричном виде: `0x46` — это 70%. Частая ошибка — написать `70`: это будет прочитано как `0x70`, то есть 112%.

**Почему всё равно OOMKilled.** Процесс убивает ядро по RSS всего контейнера, а не по размеру кучи. Частые причины:

- нативная память растёт мимо GC: незакрытые `HttpClient`/`SslStream`, большие `ArrayPool` на unmanaged-буферах, интероп;
- много потоков (каждый резервирует стек, по умолчанию 1.5 МБ на Linux x64 в .NET, плюс коммит по мере роста) — например, синхронные блокировки в async-коде, которые раздувают ThreadPool;
- memory limit впритык к рабочему набору: GC не успевает уплотнить кучу при пиковом выделении;
- в контейнере есть второй процесс (sidecar внутри одного образа, `dotnet-dump`), который делит тот же лимит.

`kubectl describe pod` покажет `Last State: Terminated, Reason: OOMKilled`. А если в логах `OutOfMemoryException`, то это наоборот сработал `GCHeapHardLimit`: куча упёрлась в свой лимит раньше контейнера, и это диагностируется гораздо проще.

**Как подобрать числа.** Не угадывать, а снимать нагрузочным тестом и из продакшена: `container_memory_working_set_bytes`, `dotnet.gc.heap.total_allocated`, `dotnet.process.memory.working_set` (метрики runtime в .NET 9+) и p95/p99 `container_cpu_usage_seconds_total`. Memory limit — пиковый working set плюс 20–30%; CPU request — p90 потребления; CPU limit для latency-sensitive API, если он нужен, ставить кратно выше request, а не 1:1 — кроме случаев, когда требуется Guaranteed QoS.

**Нюансы, которые спрашивают дальше:**

- **QoS-классы.** Guaranteed (requests = limits для CPU и памяти у всех контейнеров) вытесняется последним и нужен для CPU Manager со static policy. Burstable — типичный выбор для API.
- **Много реплик на одной ноде.** CPU без limit не значит «бесплатно»: соседи с большим потреблением ухудшат latency, поэтому request должен честно отражать нагрузку, иначе планировщик переупакует ноду.
- **DATAS** (dynamic adaptation в .NET 9+ включена для Server GC по умолчанию) уменьшает число куч под реальную нагрузку и заметно снижает память у маленьких подов. На .NET 8 её включают через `DOTNET_GCDynamicAdaptationMode=1`.
- **VPA** в режиме рекомендаций помогает найти requests, но одновременно с HPA по той же метрике CPU их не используют: они будут тянуть в разные стороны.

## Почему приложение работает медленнее при лимите CPU и как это связано с GC?

```yaml
category: devops
level: senior
difficulty: 5
slug: devops-senior-pochemu-prilozhenie-rabotaet-medlennee-pri-limite-cpu-i-kak-eto-svyaza
tags: kubernetes, gc
```

CPU limit в Kubernetes — это не «сколько ядер», а **квота процессорного времени на период CFS (по умолчанию 100 мс)**. Многопоточный процесс выедает квоту за первые миллисекунды периода и до его конца стоит на паузе: отсюда скачки p99 при средней загрузке CPU 30–40%. .NET-сервис особенно чувствителен, потому что Server GC запускает параллельные GC-потоки на каждую кучу, и пауза сборки сама расходует квоту и сама попадает под троттлинг.

**Арифметика троттлинга:**

```text
limits.cpu = 1  ->  quota 100ms CPU-времени на каждые 100ms
8 потоков работают параллельно -> квота исчерпана за 12.5ms
оставшиеся 87.5ms процесс не получает CPU вообще
запрос, попавший в этот момент, получает +87.5ms к latency
```

Средняя утилизация за минуту при этом может быть умеренной, поэтому дашборд «CPU usage» ничего не показывает. Смотреть надо на троттлинг:

```text
sum(rate(container_cpu_cfs_throttled_periods_total{pod=~"orders-.*"}[5m]))
/
sum(rate(container_cpu_cfs_periods_total{pod=~"orders-.*"}[5m]))
```

Доля throttled-периодов выше 10–20% для API — сигнал, что limit мешает.

**Где здесь GC:**

- **Число куч Server GC = `Environment.ProcessorCount`.** При limit `2` это 2 кучи и 2 GC-потока — нормально. Без limit или при `DOTNET_PROCESSOR_COUNT`, не согласованном с квотой, .NET видит 32 ядра ноды, создаёт 32 кучи и запускает 32 потока сборки. Они разом съедают квоту, и пауза stop-the-world, которая заняла бы 5 мс, растягивается на несколько периодов CFS — 100–300 мс.
- **Фоновый GC** (concurrent) работает параллельно с приложением и делит с ним ту же квоту: в моменты сборки gen2 приложение получает меньше CPU.
- **Аллокации → частота GC → CPU.** Сервис, который много аллоцирует, тратит заметную долю квоты на сборку, и при жёстком limit эта доля становится видна в latency.
- **Workstation против Server GC.** При limit ниже 1 CPU или очень маленьком поде Server GC даёт мало выгоды, а памяти ест больше; Workstation concurrent GC (`<ServerGarbageCollector>false</ServerGarbageCollector>`) часто лучше.

**Что ещё страдает от лимита:**

- **ThreadPool.** Минимум потоков равен `ProcessorCount`; при limit 1 и синхронных блокировках hill climbing добавляет потоки медленно — получается thread starvation, похожая на троттлинг.
- **JIT и старт.** Tiered compilation в первые секунды активно компилирует методы фоновыми потоками. При маленьком limit старт растягивается, startup probe не успевает, под перезапускается. Помогают ReadyToRun (`<PublishReadyToRun>true</PublishReadyToRun>`) и разумный `failureThreshold` у startup probe.
- **Kestrel и TLS-хендшейки** — CPU-тяжёлые, при пиковых подключениях упираются в квоту первыми.

**Что делать:**

| Мера | Эффект |
| --- | --- |
| Убрать CPU limit, оставить честный request | троттлинга нет, CPU берётся из свободного на ноде |
| Оставить limit, но согласовать `DOTNET_PROCESSOR_COUNT` с ним | GC и ThreadPool не создают лишнего параллелизма |
| Включить DATAS (по умолчанию в .NET 9+) или задать `DOTNET_GCHeapCount` | меньше куч и GC-потоков при небольшой нагрузке |
| `DOTNET_GCHeapAffinitizeMask` / `GCNoAffinitize` | имеет смысл только при CPU Manager static и целых ядрах |
| Снизить аллокации (`ArrayPool`, `Span`, пулинг) | меньше GC, меньше расход квоты |

**Как доказать связь с GC.** Метрики runtime (`dotnet.gc.pause.time`, `dotnet.gc.collections` по поколениям в .NET 9+, или `dotnet-counters monitor -n Orders.Api System.Runtime`) накладываются на график throttled-периодов и p99. Если всплески latency совпадают со сборками gen2 и с ростом троттлинга — причина найдена. Для точного анализа снимают трейс `dotnet-trace collect --profile gc-verbose`.

**Что спрашивают дальше:** почему многие команды отказываются от CPU limits для API и чем это рискует для соседей по ноде; как cgroup v2 меняет учёт (`cpu.max` вместо `cpu.cfs_quota_us`); как ведёт себя `ProcessorCount` при дробном limit; чем HPA по CPU плох при троттлинге.

## Чем readiness отличается от liveness и что произойдёт при их путанице?

```yaml
category: devops
level: senior
difficulty: 4
slug: devops-senior-chem-readiness-otlichaetsya-ot-liveness-i-chto-proizoidet-pri-ih-putan
tags: kubernetes, availability
```

**Readiness** отвечает на вопрос «можно ли сейчас слать трафик в этот под»: при провале под убирается из EndpointSlice сервиса, но продолжает жить. **Liveness** — «процесс сломан необратимо и его надо перезапустить»: при провале kubelet убивает контейнер. Путаница опасна в обе стороны: проверка зависимостей в liveness превращает сбой базы в каскадный рестарт всего кластера, а пустой readiness пускает трафик в неготовый под.

**Третья проба — startup.** Пока startup probe не прошла, liveness и readiness не выполняются. Она нужна для медленного старта (прогрев кэша, миграции, JIT), чтобы не задирать `initialDelaySeconds` у liveness навсегда.

```yaml
startupProbe:
  httpGet:
    path: /healthz/live
    port: 8080
  periodSeconds: 2
  failureThreshold: 60
livenessProbe:
  httpGet:
    path: /healthz/live
    port: 8080
  periodSeconds: 10
  timeoutSeconds: 2
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /healthz/ready
    port: 8080
  periodSeconds: 5
  timeoutSeconds: 2
  failureThreshold: 2
```

**Что проверять в каждой:**

| Проба | Проверяет | Не должна проверять |
| --- | --- | --- |
| liveness | процесс отвечает, нет deadlock, event loop / ThreadPool не мёртв | БД, Redis, брокер, соседние сервисы |
| readiness | прогрев завершён, обязательные локальные ресурсы готовы, под не в процессе остановки, при необходимости — критичные зависимости | медленные и дорогие проверки на каждый вызов |
| startup | приложение вообще поднялось | — |

**В .NET это разделяется тегами:**

```csharp
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
    .AddCheck<CacheWarmupHealthCheck>("warmup", tags: ["ready"])
    .AddNpgSql(builder.Configuration.GetConnectionString("Orders")!, tags: ["ready"]);

var app = builder.Build();

app.MapHealthChecks("/healthz/live", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("live")
});
app.MapHealthChecks("/healthz/ready", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready")
});
```

**Что происходит при путанице:**

- **Проверка БД в liveness.** База на минуту ушла в failover → у всех подов liveness падает → kubelet перезапускает их все одновременно → при старте они разом открывают пулы соединений и прогревают кэши, добивая только что поднявшуюся базу. Маленький сбой зависимости превратился в полный outage, плюс `CrashLoopBackOff` с экспоненциальной задержкой до 5 минут.
- **Проверка БД в readiness у всех подов.** Тоже ловушка: при недоступной базе все поды разом выпадают из сервиса, клиенты получают `503` от ingress вместо осмысленной ошибки или ответа из кэша. Если сервис умеет частично работать без зависимости, её лучше не включать в readiness, а обрабатывать деградацию в коде (circuit breaker, fallback).
- **Liveness без startup probe.** Медленный старт (> `failureThreshold * periodSeconds`) — под убивается, не успев подняться, и бесконечно перезапускается.
- **Тяжёлая проверка с маленьким `timeoutSeconds`.** Под нагрузкой эндпоинт отвечает дольше 1 секунды (дефолт), проба падает, поды перезапускаются именно в пик — положительная обратная связь.
- **Одинаковый эндпоинт для обеих проб.** Тогда семантика у них одна, и любой «не готов» становится «убей меня».

**Тонкости:**

- Readiness проверяется весь жизненный цикл, не только на старте: под может временно выйти из ротации при перегрузке и вернуться.
- Liveness должна ловить то, что сам процесс не может исправить: зависание, исчерпание ThreadPool. Если таких сценариев нет, честный вариант — не ставить liveness вообще; упавший процесс kubelet перезапустит и без неё.
- Результаты дорогих проверок кэшируют (фоновая проверка через `IHealthCheckPublisher` или собственный кэш с TTL), чтобы проба не превращалась в нагрузочный тест зависимостей: 50 подов × проба каждые 5 секунд — это постоянный поток запросов в базу.
- Пробы ходят напрямую на порт пода; эндпоинты проб не должны требовать аутентификации и не должны идти через rate limiter.

**Что спрашивают дальше:** как readiness участвует в rolling update (`maxUnavailable` считает неготовые поды); что делает readiness gate; почему при остановке пода readiness не успевает его убрать из балансировки (это уже вопрос graceful shutdown).

## Как настроить graceful shutdown в Kubernetes, чтобы не терять запросы при деплое?

```yaml
category: devops
level: senior
difficulty: 5
slug: devops-senior-kak-nastroit-graceful-shutdown-v-kubernetes-chtoby-ne-teryat-zaprosy-p
tags: kubernetes, availability
```

Главная проблема в том, что Kubernetes **параллельно** отправляет контейнеру SIGTERM и убирает под из EndpointSlice, а kube-proxy, ingress-контроллеры и service mesh узнают об этом с задержкой в секунды. Если приложение сразу перестаёт принимать соединения, на него ещё несколько секунд летит трафик, и клиенты получают `502`/connection refused. Решение: **сначала подождать (preStop), затем корректно дослужить начатые запросы, уложившись в `terminationGracePeriodSeconds`**.

**Последовательность остановки пода:**

```text
t=0     под помечается Terminating
        ├─ EndpointSlice: endpoint ready=false, terminating=true
        │    → kube-proxy / ingress / mesh обновляют маршруты (0.5–10 с)
        └─ kubelet: выполняет preStop, затем шлёт SIGTERM
t=grace kubelet шлёт SIGKILL, если процесс ещё жив
```

`terminationGracePeriodSeconds` (по умолчанию 30) отсчитывается с начала, и preStop входит в него.

**Конфигурация пода:**

```yaml
spec:
  terminationGracePeriodSeconds: 45
  containers:
    - name: api
      image: registry.example.com/orders-api@sha256:...
      lifecycle:
        preStop:
          sleep:
            seconds: 10
```

Действие `sleep` в preStop появилось недавно (бета и включено по умолчанию с Kubernetes 1.30). Привычный вариант `exec: command: ["sleep", "10"]` **не работает в chiseled и distroless образах**: там нет бинарника `sleep` и shell, preStop падает, и SIGTERM приходит сразу. На старых кластерах задержку делают внутри приложения.

**Сторона .NET.** Generic Host ловит SIGTERM, вызывает `IHostApplicationLifetime.ApplicationStopping`, Kestrel перестаёт принимать новые соединения и ждёт завершения активных запросов, затем останавливаются `IHostedService`. Всё это ограничено `HostOptions.ShutdownTimeout` (с .NET 8 по умолчанию 30 секунд, раньше было 5):

```csharp
builder.Services.Configure<HostOptions>(o =>
{
    o.ShutdownTimeout = TimeSpan.FromSeconds(25);
});
```

Бюджет должен сходиться: `preStop (10) + ShutdownTimeout (25) < terminationGracePeriodSeconds (45)`, с запасом на остановку фоновых сервисов и flush телеметрии.

**Что ещё нужно сделать в приложении:**

- **Фоновые воркеры** (`BackgroundService`) должны уважать `stoppingToken`: дочитать текущее сообщение из очереди и не брать следующее, а не обрывать посреди обработки. Сообщения подтверждаются (ack) только после обработки — тогда SIGKILL приведёт к повторной доставке, а не к потере.
- **Long-lived соединения** (WebSocket, SignalR, gRPC streaming, SSE) не завершатся сами за 30 секунд. Их надо закрывать по `ApplicationStopping`, отправляя клиенту сигнал переподключиться; клиент обязан уметь reconnect.
- **HTTP keep-alive.** Клиент или upstream (ingress, другой сервис через `HttpClient`) держит пул соединений к поду. После preStop Kestrel закрывает idle-соединения, а клиент должен ретраить идемпотентные запросы при обрыве. У nginx-ingress это `proxy_next_upstream`, в `HttpClient` — Polly/`Microsoft.Extensions.Http.Resilience`.
- **Readiness на время остановки.** Можно дополнительно переводить readiness в «не готов» по `ApplicationStopping`, но это не заменяет preStop: endpoint уже и так помечен terminating, проблема именно в задержке распространения.

**Как проверить, что всё работает.** Под нагрузкой k6/hey делать `kubectl rollout restart deployment/orders-api` и смотреть на долю ошибок у клиента и в метриках ingress. Ноль `5xx` во время рестарта — критерий готовности. Без такого теста обычно выясняется, что ingress ещё 3–5 секунд шлёт трафик в мёртвый под.

**Связанные настройки уровня Deployment:**

- `PodDisruptionBudget` защищает от одновременного вытеснения при `kubectl drain` и обновлении нод, но не от rolling update — там работают `maxUnavailable`/`maxSurge`.
- `minReadySeconds` не даёт считать новый под доступным сразу после первой успешной readiness, что сглаживает раскатку.

**Что спрашивают дальше:** почему процесс не получает SIGTERM, если в `ENTRYPOINT` используется shell-форма (`sh -c` становится PID 1 и не пробрасывает сигнал); как ведёт себя AWS ALB / GCP LB с deregistration delay; что будет с транзакцией в БД, если пришёл SIGKILL.

## Как устроен rolling deployment и что произойдёт при несовместимой миграции БД?

```yaml
category: devops
level: senior
difficulty: 5
slug: devops-senior-kak-ustroen-rolling-deployment-i-chto-proizoidet-pri-nesovmestimoi-mig
tags: deployment, migration
```

Rolling update постепенно заменяет поды старой версии новыми, поэтому **какое-то время (от минут до часа при откате) обе версии работают одновременно с одной и той же базой**. Несовместимая миграция (переименование или удаление колонки, `NOT NULL` без дефолта, смена типа) ломает старые поды сразу после применения: они получают `column does not exist` и сыпят 500-ми, а откат приложения становится невозможным, потому что старый код несовместим с новой схемой.

**Механика Deployment:**

```yaml
spec:
  replicas: 10
  revisionHistoryLimit: 10
  progressDeadlineSeconds: 600
  minReadySeconds: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 0
```

- Контроллер создаёт новый ReplicaSet и масштабирует его вверх, а старый вниз, соблюдая ограничения: не больше `replicas + maxSurge` подов всего и не меньше `replicas - maxUnavailable` доступных. Значения по умолчанию — 25% и 25%.
- Под считается доступным, когда readiness прошла и прошло `minReadySeconds`. Без нормальной readiness rolling update превращается в «убить всех и надеяться».
- Если за `progressDeadlineSeconds` прогресса нет, Deployment получает условие `Progressing=False`. **Автоматического отката нет** — его делает CI (`kubectl rollout status` с ненулевым кодом → `kubectl rollout undo`) или Argo Rollouts / Helm.
- `maxUnavailable: 0` + `maxSurge > 0` — раскатка без потери ёмкости, но нужен запас ресурсов в кластере на дополнительные поды.

```bash
kubectl rollout status deployment/orders-api --timeout=10m
kubectl rollout history deployment/orders-api
kubectl rollout undo deployment/orders-api --to-revision=41
```

**Сценарий поломки.** Версия N+1 переименовывает `customer_name` в `full_name`. Миграция применяется до раскатки (или первым новым подом на старте). Девять старых подов из десяти мгновенно начинают падать на `SELECT customer_name`. Откатить образ бесполезно: колонки уже нет. Откат миграции `Down()` при этом удалит данные, записанные новой версией в `full_name`.

**Правило: каждая миграция совместима с предыдущей и следующей версией кода.** Ломающее изменение разбивается на шаги expand → migrate → contract, каждый в отдельном релизе:

| Релиз | Схема | Код |
| --- | --- | --- |
| 1 (expand) | добавить `full_name` nullable | пишет в обе колонки, читает старую |
| 2 (migrate) | бэкфилл `full_name` пачками | читает новую с fallback на старую |
| 3 | — | пишет и читает только `full_name` |
| 4 (contract) | удалить `customer_name` | — |

Между релизами 3 и 4 должно пройти время, за которое откат на релиз 2 перестанет быть нужным.

**Что считается безопасным, а что нет (на примере PostgreSQL):**

| Безопасно | Опасно |
| --- | --- |
| добавить nullable-колонку или колонку с константным дефолтом (с PG 11 без перезаписи таблицы) | переименовать или удалить колонку, используемую старым кодом |
| `CREATE INDEX CONCURRENTLY` | обычный `CREATE INDEX` на большой таблице — блокирует запись |
| добавить `CHECK`/`FOREIGN KEY` как `NOT VALID`, затем `VALIDATE CONSTRAINT` | `SET NOT NULL` на большой таблице — полный скан под `ACCESS EXCLUSIVE` |
| новая таблица | смена типа колонки с перезаписью |

Отдельный риск — **блокировки**. Даже быстрый `ALTER TABLE` ждёт `ACCESS EXCLUSIVE`; если впереди долгая транзакция, за `ALTER` выстраивается очередь всех запросов к таблице. Поэтому в миграциях ставят `SET lock_timeout = '5s'` и ретраят.

**EF Core добавляет свои грабли:** `RenameColumn` генерирует ровно тот самый несовместимый rename, а изменение свойства в модели незаметно превращается в `DropColumn` + `AddColumn`. Сгенерированную миграцию нужно читать как код, а в CI полезно проверять SQL (`dotnet ef migrations script`) на запрещённые операции.

**Что спрашивают дальше:** как откатывать релиз, если миграция уже применена (только forward-fix или код, совместимый с обеими схемами); где запускать миграции при нескольких инстансах; как feature flags помогают разделить деплой и включение функциональности.

## Как накатывать миграции базы данных при нескольких инстансах приложения?

```yaml
category: devops
level: senior
difficulty: 5
slug: devops-senior-kak-nakatyvat-migracii-bazy-dannyh-pri-neskolkih-instansah-prilozheniy
tags: deployment, migration
```

Миграции должны выполняться **одним отдельным шагом пайплайна до раскатки нового кода**, а не каждым инстансом на старте. Типичные реализации — Kubernetes Job (или Helm pre-upgrade hook) с EF Core migration bundle либо шаг CI, запускающий тот же bundle или идемпотентный SQL-скрипт. Сами миграции при этом пишутся обратно совместимыми, потому что во время раскатки старый код работает с новой схемой.

**Почему `Database.Migrate()` в `Program.cs` — плохая идея:**

- **Гонка.** Десять подов стартуют одновременно и пытаются применить одну и ту же миграцию. До EF Core 9 никакой блокировки не было: получались дубликаты DDL, ошибки `relation already exists` и частично применённые миграции. С EF Core 9 `Migrate()` берёт блокировку на уровне БД, гонка исчезает, но остальные проблемы остаются.
- **Права.** Приложению нужен DDL-доступ (`CREATE`, `ALTER`, `DROP`) к продакшен-базе — нарушение принципа наименьших привилегий.
- **Старт и пробы.** Долгая миграция (индекс на большой таблице, бэкфилл) держит старт пода, startup probe падает, kubelet перезапускает под посреди миграции.
- **Нет контроля.** Нельзя остановить деплой, если миграция упала, и нельзя запустить её отдельно от кода.

**Migration bundle** — самодостаточный исполняемый файл с миграциями, не требующий SDK и исходников:

```bash
dotnet ef migrations bundle -p src/Orders.Infrastructure -s src/Orders.Api -o ./efbundle --self-contained -r linux-x64
./efbundle --connection "$MIGRATIONS_CONNECTION_STRING"
```

Его собирают в CI вместе с образом приложения (часто в отдельный образ с тем же тегом), а запускают Job'ом:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: orders-migrate-{{ .Release.Revision }}
  annotations:
    helm.sh/hook: pre-install,pre-upgrade
    helm.sh/hook-weight: "-5"
    helm.sh/hook-delete-policy: before-hook-creation,hook-succeeded
spec:
  backoffLimit: 0
  activeDeadlineSeconds: 1800
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: registry.example.com/orders-migrations:{{ .Values.image.tag }}
          args: ["--connection", "$(MIGRATIONS_CONNECTION_STRING)"]
          envFrom:
            - secretRef:
                name: orders-migrations-db
```

Если Job падает, Helm не переходит к обновлению Deployment, и новый код не раскатывается. `backoffLimit: 0` — сознательно: автоматический повтор частично применённой DDL-миграции лучше разбирать руками. У Argo CD аналог — `argocd.argoproj.io/hook: PreSync`.

**Альтернатива — идемпотентный SQL-скрипт:**

```bash
dotnet ef migrations script --idempotent -o migrate.sql
```

Скрипт проверяет `__EFMigrationsHistory` перед каждой миграцией, его можно отдать на ревью DBA и применить `psql` из CI. Минус — некоторые операции (например, `CREATE INDEX CONCURRENTLY`, который нельзя выполнять в транзакции) требуют ручной правки, и идемпотентность в некоторых провайдерах работает не для всех конструкций.

**Блокировка как страховка.** Если по каким-то причинам миграции всё же запускаются из нескольких мест, сериализуйте их сами — в PostgreSQL через advisory lock на время применения:

```sql
SELECT pg_advisory_lock(727001);
```

**Что ещё учитывать:**

- **Отдельная учётная запись** с правами DDL для Job и отдельная, с правами только на DML, для приложения.
- **`lock_timeout` и `statement_timeout`** в миграциях, чтобы DDL не повесил продакшен в очереди за долгой транзакцией.
- **Долгие data-миграции** (бэкфилл миллионов строк) не делают в той же транзакции, что DDL: их выносят в отдельный фоновый процесс, обрабатывающий пачками и устойчивый к перезапуску.
- **Порядок «миграция → код»** работает только при обратной совместимости схемы. Удаляющие изменения (contract) идут отдельным релизом, когда старого кода уже нет.
- **Проверка в CI:** поднять БД в Testcontainers, применить все миграции с нуля и поверх снапшота продакшен-схемы, проверить, что `dotnet ef migrations has-pending-model-changes` (EF Core 8+) ничего не находит.

**Что спрашивают дальше:** что будет, если Job упал на середине миграции без транзакционного DDL (MySQL); как раскатывать миграцию в нескольких регионах; почему init container для миграций хуже Job (выполняется в каждом поде, при каждом рестарте).

## Когда стоит выбрать blue-green, а когда canary?

```yaml
category: devops
level: senior
difficulty: 5
slug: devops-senior-kogda-stoit-vybrat-blue-green-a-kogda-canary
tags: deployment, strategy
```

**Blue-green** держит два полных окружения и переключает весь трафик разом: выигрыш — мгновенный и предсказуемый откат и возможность прогнать smoke-тесты на новой версии до переключения; цена — двойные ресурсы на время релиза и то, что ошибку, проявляющуюся только под реальной нагрузкой, увидят сразу все пользователи. **Canary** направляет в новую версию небольшую долю реального трафика и наращивает её по метрикам: ограничивает радиус поражения, но требует развитой наблюдаемости, достаточного трафика для статистики и терпимости к тому, что две версии живут вместе долго.

**Сравнение по сути:**

| Критерий | Blue-green | Canary |
| --- | --- | --- |
| Кто видит новую версию первым | тестировщики и smoke-тесты, затем все | 1–5% реальных пользователей |
| Откат | переключить роутинг обратно, секунды | обнулить вес canary, секунды |
| Ресурсы | ×2 на время релиза | +несколько подов |
| Что ловит | ошибки старта, конфигурации, интеграций | регрессии под реальной нагрузкой и данными, деградацию latency |
| Сосуществование версий | короткое (на время переключения и drain) | долгое (десятки минут — часы) |
| Требования | балансировщик/Service с переключением, прогрев | weighted routing (mesh, Gateway API, ingress), метрики по версиям |
| Трафик | любой | нужен объём, чтобы 5% дали статистически значимые числа |

**Когда blue-green:**

- **Мало трафика.** На 20 RPS 5% — это один запрос в секунду; ошибку в 1% вы будете ждать часами. Лучше полностью проверить окружение синтетикой и переключиться.
- **Версии не могут сосуществовать.** Смена протокола между клиентом и сервером, stateful-сервисы, где нельзя пустить часть клиентов на новую схему. Blue-green сокращает период сосуществования до минимума (хотя не до нуля — схему БД всё равно надо делать совместимой).
- **Нужна проверка перед открытием трафика.** Регуляторные требования, ручная приёмка, прогрев кэшей и JIT на «зелёном» окружении.
- **Инфраструктурные изменения:** переезд на новую версию кластера, рантайма, базового образа — поднимаете второе окружение целиком.

**Когда canary:**

- **Большой трафик и много пользователей**, где регрессия на 100% стоит дорого, а на 2% — терпимо.
- **Есть метрики по версиям**: доля ошибок и latency с лейблом версии, бизнес-метрики (конверсия, успешные оплаты).
- **Частые релизы**: автоматический анализ (Argo Rollouts, Flagger) позволяет катить много раз в день без ручного контроля.
- **Риск в поведении, а не в старте**: новый алгоритм, изменение запросов к БД, новые кэши — проявляется только на реальных данных.

**Общие подводные камни:**

- **БД и очереди общие.** Ни одна стратегия не делает миграции безопасными: при blue-green обе версии используют одну базу, «откат» после несовместимой миграции не сработает.
- **Фоновые воркеры.** Canary-под с консьюмером очереди получает не 5% трафика, а свою долю партиций/сообщений, не связанную с весом роутинга. Для воркеров нужна отдельная стратегия.
- **Sticky-сессии и кэш клиента.** При canary один пользователь может попадать то на старую, то на новую версию — для изменений UI или API-контрактов используют привязку по заголовку/cookie.
- **Длинные соединения.** WebSocket и gRPC-стримы не перераспределяются при смене весов; переключение срабатывает только для новых соединений.
- **Двойная стоимость blue-green** для крупных сервисов часто неприемлема, поэтому её применяют на уровне отдельных сервисов или кластеров.

**На практике** часто комбинируют: canary-подход с первым шагом «0% трафика + smoke-тесты по preview-сервису», что даёт проверку до открытия трафика, как у blue-green, и постепенное наращивание после. Argo Rollouts поддерживает обе стратегии (`blueGreen` с `previewService` и `autoPromotionEnabled: false`, и `canary` с шагами).

**Отдельно от деплоя — feature flags.** Они переносят риск с релиза на включение функции: код раскатывается выключенным, а включается для 1% пользователей уже на уровне приложения. Это часто дешевле canary на инфраструктуре и позволяет таргетировать конкретные сегменты.

**Что спрашивают дальше:** как сделать canary для сервиса без service mesh (через число реплик — грубо, или Gateway API `HTTPRoute` с весами); как blue-green сочетается с миграцией БД; как проверить «зелёное» окружение, если у сервиса есть сайд-эффекты (письма, платежи).

## Как организовать canary-деплой и по каким метрикам принимать решение об откате?

```yaml
category: devops
level: senior
difficulty: 5
slug: devops-senior-kak-organizovat-canary-deploi-i-po-kakim-metrikam-prinimat-reshenie-ob
tags: deployment, observability
```

Canary строится из трёх частей: **взвешенная маршрутизация** трафика между stable и canary (service mesh, Gateway API, ingress с весами), **метрики с разделением по версии** и **автоматический анализ**, который на каждом шаге сравнивает canary с порогами или с baseline и откатывает при деградации. Решение принимается по золотым сигналам самого сервиса (доля ошибок, latency p95/p99, насыщение) и по бизнес-метрике, а не по тому, «не упал ли под».

**Пример на Argo Rollouts:**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: orders-api
spec:
  replicas: 10
  selector:
    matchLabels:
      app: orders-api
  template:
    metadata:
      labels:
        app: orders-api
    spec:
      containers:
        - name: api
          image: registry.example.com/orders-api:1.42.0
  strategy:
    canary:
      canaryService: orders-api-canary
      stableService: orders-api-stable
      trafficRouting:
        nginx:
          stableIngress: orders-api
      analysis:
        templates:
          - templateName: orders-success-rate
        startingStep: 1
        args:
          - name: service
            value: orders-api-canary
      steps:
        - setWeight: 5
        - pause: { duration: 10m }
        - setWeight: 25
        - pause: { duration: 10m }
        - setWeight: 50
        - pause: { duration: 15m }
```

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: orders-success-rate
spec:
  args:
    - name: service
  metrics:
    - name: success-rate
      interval: 1m
      count: 30
      failureLimit: 2
      successCondition: len(result) == 0 || result[0] >= 0.99
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_server_request_duration_seconds_count{service="{{args.service}}",http_response_status_code!~"5.."}[2m]))
            /
            sum(rate(http_server_request_duration_seconds_count{service="{{args.service}}"}[2m]))
```

Анализ запускается фоном со второго шага; при `failureLimit` неудачных измерений Rollout прерывается, вес canary обнуляется, трафик возвращается на stable. Аналогично работает Flagger с `Canary`-ресурсом и `metrics`/`thresholdRange`.

**Какие метрики брать:**

| Сигнал | Метрика | Как сравнивать |
| --- | --- | --- |
| Ошибки | доля `5xx` и исключений по версии | абсолютный порог (≥ 99%) и относительный (не хуже stable больше чем на X) |
| Latency | p95/p99 `http.server.request.duration` | относительно stable, а не к абсолютному SLO |
| Насыщение | CPU, память, GC pause, пул соединений к БД | рост по сравнению со stable — признак утечки или регрессии |
| Бизнес | успешные оплаты, созданные заказы на запрос | падение конверсии при нормальных 200 OK |
| Зависимости | ошибки и latency исходящих вызовов, нагрузка на БД | новая версия может «положить» соседа |

**Почему сравнение с baseline надёжнее порогов.** Абсолютный порог «p99 < 300 мс» срабатывает на ночной трафик иначе, чем на пиковый, а общий инцидент в зависимости роняет обе версии сразу. Сравнение canary со stable (а ещё лучше — с отдельным baseline-подом, запущенным одновременно с canary, чтобы исключить эффект холодного старта) отвечает на правильный вопрос: «новая версия хуже старой?». Kayenta (Spinnaker) и Argo Rollouts с экспериментами реализуют именно такой подход.

**Типичные ошибки:**

- **Мало данных.** 5% от 50 RPS за 10 минут — 1500 запросов; одна ошибка сдвигает долю на 0.07%. Порог должен учитывать объём: минимальное число запросов в шаге (`len(result) == 0` в примере — защита от пустого результата) или более длинные паузы.
- **Метрики не различают версии.** Нужен лейбл версии/ревизии или отдельный Service для canary; иначе Prometheus усредняет canary с stable, и 5% трафика растворяются в шуме.
- **Ошибки клиента считаются ошибками.** `4xx` обычно исключают, но рост `400` после смены валидации — тоже регрессия; её стоит отслеживать отдельно.
- **Холодный старт.** Первые минуты canary медленнее из-за JIT и пустых кэшей — первую паузу не анализируют или прогревают поды.
- **Нет отката для данных.** Canary мог уже записать данные в новом формате; автоматический откат кода не откатывает их.

**Ручной контроль:**

```bash
kubectl argo rollouts get rollout orders-api --watch
kubectl argo rollouts promote orders-api
kubectl argo rollouts abort orders-api
```

**Что спрашивают дальше:** как делать canary без service mesh (только числом реплик — грубая гранулярность); как поступать с фоновыми консьюмерами в canary; как выбрать длительность шагов при суточной сезонности трафика.

## Как построить пайплайн CI/CD с быстрым и безопасным откатом?

```yaml
category: devops
level: senior
difficulty: 4
slug: devops-senior-kak-postroit-paiplain-ci-cd-s-bystrym-i-bezopasnym-otkatom
tags: cicd, deployment
```

Быстрый откат возможен, только если **откатываться есть куда и это ничего не ломает**: артефакт собирается один раз и неизменяемым продвигается по окружениям, деплой декларативен и версионирован (GitOps или хотя бы Helm-ревизии), схема БД совместима с предыдущей версией кода, а решение об откате принимается по метрикам автоматически. Тогда откат — это повторный деплой предыдущего digest за минуту, а не пересборка из старого коммита в стрессе.

**Скелет пайплайна:**

```text
commit → build + unit tests → image (тег = git sha) → scan + SBOM + подпись
       → integration tests (Testcontainers) → push в registry
       → deploy dev → e2e/smoke
       → promote в staging (тот же digest) → нагрузочный smoke
       → promote в prod: canary/rolling + автоанализ метрик
       → при деградации: автоматический откат на предыдущий digest
```

**Принципы, без которых откат не работает:**

- **Build once, deploy many.** Образ собирается один раз, а в окружения продвигается по digest (`orders-api@sha256:...`). Пересборка «для прода» даёт другой артефакт: другие версии пакетов, другую базу образа. Конфигурация окружения — отдельно (Helm values, ConfigMap), не внутри образа.
- **Неизменяемые теги.** Тег `latest` или `prod` нельзя использовать как идентификатор версии: откатиться «на прошлый latest» невозможно. В registry включают immutable tags.
- **Обратная совместимость данных.** Миграции по expand/contract, контракты API и сообщений совместимы в обе стороны. Это главное условие: технически откатить образ можно всегда, но после несовместимой миграции откат ломает систему.
- **Отделение деплоя от релиза.** Feature flags: рискованная функция раскатывается выключенной, откат — это выключение флага за секунды, без деплоя.

**GitOps-вариант (Argo CD / Flux).** Желаемое состояние лежит в git-репозитории окружений; CI только обновляет тег/digest:

```yaml
image:
  repository: registry.example.com/orders-api
  digest: sha256:5f1c...
```

Откат — `git revert` коммита с обновлением digest; контроллер приведёт кластер к нему. Плюсы: полный аудит, одна точка правды, откат делается тем же механизмом, что и деплой. Ручной `kubectl rollout undo` в GitOps-кластере будет отменён контроллером при следующей синхронизации — частая ловушка во время инцидента.

**Helm-вариант с автоматическим откатом:**

```bash
helm upgrade --install orders-api ./charts/orders-api \
  --namespace orders \
  --values values-prod.yaml \
  --set image.digest="$IMAGE_DIGEST" \
  --atomic --wait --timeout 10m
```

`--atomic` откатывает релиз, если ресурсы не стали готовыми за `--timeout`. В Helm 4 флаг переименован в `--rollback-on-failure`. Ручной откат — `helm rollback orders-api <revision>`. Ограничение: Helm смотрит только на готовность подов, а не на ошибки и latency, поэтому для анализа по метрикам нужен Argo Rollouts/Flagger или шаг пайплайна, проверяющий SLO после деплоя.

**GitHub Actions: продвижение по digest, а не по тегу:**

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      digest: ${{ steps.push.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - id: push
        uses: docker/build-push-action@v6
        with:
          push: true
          tags: registry.example.com/orders-api:${{ github.sha }}
  deploy-prod:
    needs: build
    environment: production
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh "${{ needs.build.outputs.digest }}"
```

`environment: production` даёт ручное подтверждение и отдельные секреты окружения.

**Безопасность самого пайплайна:**

- секреты не в переменных репозитория, а через OIDC-федерацию (короткоживущие токены к облаку и registry);
- сканирование образа (Trivy/Grype) и зависимостей, подпись образа (cosign) и проверка подписи admission-контроллером в кластере;
- права CI-раннера на прод минимальны: в GitOps CI вообще не имеет доступа к кластеру, только пишет в git.

**Метрики качества процесса (DORA):** частота деплоев, lead time, change failure rate, время восстановления. Хороший откат напрямую уменьшает последнее.

**Что спрашивают дальше:** что делать, если откат невозможен из-за данных (forward fix, флаги); как организовать откат нескольких связанных сервисов; как тестировать сам откат (регулярные учения, rollback в staging как обязательный шаг).

## Что должно попадать в метрики, а что в логи, и почему это разные инструменты?

```yaml
category: devops
level: senior
difficulty: 4
slug: devops-senior-chto-dolzhno-popadat-v-metriki-a-chto-v-logi-i-pochemu-eto-raznye-inst
tags: observability, strategy
```

**Метрики** — это числовые агрегаты с небольшим фиксированным набором измерений: дёшево хранить годами, быстро считать по ним проценты и квантили, на них строят алерты и дашборды, но они отвечают только на вопрос «что и сколько». **Логи** — это отдельные события с произвольным контекстом: дорогие в хранении и поиске, зато отвечают на «почему именно с этим запросом». Разные инструменты нужны потому, что у них противоположные модели стоимости: стоимость метрики зависит от числа уникальных комбинаций лейблов, а стоимость логов — от числа событий.

**Как это выглядит в цифрах.** Сервис на 2 000 RPS:

| | Метрика `http.server.request.duration` | Лог на каждый запрос |
| --- | --- | --- |
| Объём | ~ десятки временных рядов (маршрут × метод × статус × бакеты) | 170 млн строк в сутки |
| Стоимость | не зависит от RPS | растёт линейно с RPS |
| Запрос «доля 5xx за час» | миллисекунды | полный скан индекса |
| Запрос «почему упал заказ 8f3a» | невозможно | один поиск |

**Что класть в метрики:**

- RED по каждому эндпоинту и исходящей зависимости: rate, errors, duration (гистограммы, а не средние);
- USE для ресурсов: утилизация, насыщение, ошибки — CPU, память, GC, ThreadPool queue length, пул соединений к БД, лаг консьюмера;
- бизнес-счётчики: созданные заказы, неудачные оплаты, отказы антифрода;
- всё, на что будет алерт или SLO.

**Что класть в логи:**

- ошибки с исключением и контекстом (ID заказа, пользователя, tenant), который нужен для разбора;
- значимые бизнес-события и переходы состояний (аудит — отдельный поток с другими требованиями к хранению);
- предупреждения о деградации: ретраи, сработавший circuit breaker, fallback;
- не каждый успешный запрос — для этого есть метрики и трассировки с сэмплированием.

**Главный антипаттерн в метриках — высокая кардинальность.** Каждая уникальная комбинация лейблов — отдельный временной ряд в Prometheus. `user_id`, `order_id`, полный URL с параметрами (`/orders/8f3a...`), текст исключения в лейблах взрывают число рядов до миллионов: падает Prometheus, растут счета в managed-решениях. Правило — лейблы только с ограниченным известным набором значений: маршрут-шаблон (`/orders/{id}`), метод, класс статуса, имя зависимости.

```csharp
public sealed class OrderMetrics
{
    private readonly Counter<long> _created;
    private readonly Histogram<double> _checkoutDuration;

    public OrderMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create("Orders");
        _created = meter.CreateCounter<long>("orders.created", unit: "{order}");
        _checkoutDuration = meter.CreateHistogram<double>("orders.checkout.duration", unit: "s");
    }

    public void Created(string channel, string paymentMethod) =>
        _created.Add(1, new KeyValuePair<string, object?>("channel", channel),
                        new KeyValuePair<string, object?>("payment.method", paymentMethod));

    public void Checkout(double seconds) => _checkoutDuration.Record(seconds);
}
```

**Главный антипаттерн в логах — использовать их как метрики.** «Посчитать в Kibana количество строк `Payment failed` за час» работает до первого изменения текста сообщения или включения сэмплирования логов. Плюс логи на каждое событие под нагрузкой сами становятся источником latency и аллокаций. В .NET это лечится структурированным логированием через source generator:

```csharp
public static partial class Log
{
    [LoggerMessage(Level = LogLevel.Warning, Message = "Payment {PaymentId} for order {OrderId} declined: {Reason}")]
    public static partial void PaymentDeclined(ILogger logger, string paymentId, Guid orderId, string reason);
}
```

Параметры попадают в бэкенд отдельными полями, их можно фильтровать, а не парсить регулярками.

**Где их место пересекается:**

- **Трассировки** — третий сигнал: путь конкретного запроса через сервисы с таймингами. Большая часть вопросов «почему медленно» решается ими, а не логами.
- **Exemplars** связывают точку метрики с `trace_id` конкретного медленного запроса: из всплеска p99 на графике можно перейти в трассу.
- **Логи с `trace_id`/`span_id`** позволяют от трассы перейти к логам, и наоборот.
- **Метрики из логов** (recording в Loki, log-based metrics) — компромисс для систем, которые нельзя инструментировать, но не замена настоящим счётчикам.

**Что спрашивают дальше:** почему средняя latency бесполезна и как работают гистограммы (бакеты, нативные/экспоненциальные гистограммы); как контролировать стоимость логов (уровни, сэмплирование, retention по типам); почему лейбл `pod` тоже даёт кардинальность при частых деплоях.

## Как выбрать SLI и SLO для сервиса и что делать при исчерпании error budget?

```yaml
category: devops
level: senior
difficulty: 5
slug: devops-senior-kak-vybrat-sli-i-slo-dlya-servisa-i-chto-delat-pri-ischerpanii-error-b
tags: observability, slo
```

**SLI** — измеримая доля «хороших» событий с точки зрения пользователя (успешные запросы быстрее порога / все запросы), **SLO** — целевое значение этой доли за окно (99.9% за 28 дней), а **error budget** — допустимая доля плохих событий (0.1%). Выбирать SLI нужно по пользовательским сценариям, а не по ресурсам сервиса. При исчерпании бюджета действует заранее согласованная политика: фокус команды смещается с фич на надёжность, рискованные релизы замораживаются, пока бюджет не восстановится.

**Как выбрать SLI:**

1. Выписать критичные пользовательские пути: «оформить заказ», «посмотреть каталог», «получить статус доставки».
2. Для каждого определить, что такое «хорошее» событие: ответ не `5xx` и быстрее 400 мс; сообщение обработано быстрее 5 минут; данные в отчёте свежее часа.
3. Выбрать точку измерения как можно ближе к пользователю: метрики балансировщика/ingress лучше, чем метрики приложения (ловят и падения подов), синтетика добавляет взгляд снаружи.

| Тип сервиса | SLI |
| --- | --- |
| Синхронный API | availability: доля не-`5xx`; latency: доля запросов быстрее порога |
| Асинхронный обработчик | freshness: доля сообщений, обработанных за N секунд от публикации |
| Пайплайн данных | доля успешных запусков, свежесть и полнота данных |
| Хранилище | durability, доля успешных чтений/записей |

Latency формулируется как доля, а не как «p99 < 400 мс»: доля хорошо складывается в бюджет и корректно агрегируется между подами, а квантили — нет.

**Как выбрать SLO:**

- исходить из исторических данных и ожиданий пользователей, а не из «пяти девяток»: каждая девятка в 10 раз дороже и требует другой архитектуры;
- SLO сервиса не может быть выше, чем у его жёстких зависимостей без резервирования;
- начинать с достижимой цели, ужесточать по мере необходимости; SLO ниже внешнего SLA, чтобы иметь запас.

| SLO за 30 дней | Бюджет недоступности |
| --- | --- |
| 99% | 7 ч 12 мин |
| 99.5% | 3 ч 36 мин |
| 99.9% | 43 мин |
| 99.95% | 21.6 мин |
| 99.99% | 4.3 мин |

**SLI в Prometheus как recording rule:**

```yaml
groups:
  - name: orders-sli
    rules:
      - record: sli:orders_availability:ratio_rate5m
        expr: |
          sum(rate(http_server_request_duration_seconds_count{service="orders-api",http_response_status_code!~"5.."}[5m]))
          /
          sum(rate(http_server_request_duration_seconds_count{service="orders-api"}[5m]))
      - record: sli:orders_latency:ratio_rate5m
        expr: |
          sum(rate(http_server_request_duration_seconds_bucket{service="orders-api",le="0.4"}[5m]))
          /
          sum(rate(http_server_request_duration_seconds_count{service="orders-api"}[5m]))
```

Порог latency должен совпадать с границей бакета гистограммы; если бакета `0.4` нет, SLI будет считаться по ближайшему и врать. Для генерации правил и алертов из спецификации SLO удобны Sloth или Pyrra.

**Error budget policy** — документ, согласованный с продуктом до инцидента, а не во время него. Пример:

- **бюджет > 50%** — релизы в обычном режиме, можно экспериментировать;
- **бюджет < 25%** — только релизы с canary и автооткатом, приоритет у задач надёжности;
- **бюджет исчерпан** — заморозка фич-релизов (кроме исправлений надёжности и безопасности), постмортем по крупнейшим тратам бюджета, задачи из постмортемов идут первыми;
- **один инцидент съел > 20% бюджета** — обязательный постмортем независимо от остатка.

Смысл бюджета — сделать разговор «скорость против стабильности» количественным: пока бюджет есть, команда имеет право рисковать; когда его нет, решение принято заранее.

**Типичные ошибки:**

- SLI на ресурсах (CPU < 80%) — пользователю всё равно, сколько CPU;
- средние значения вместо долей;
- SLO для всего сервиса разом, хотя health-check и оформление заказа имеют разную важность — эндпоинты группируют по критичности;
- SLO есть, но нет политики — тогда это просто ещё один дашборд;
- учёт плановых работ и ошибок клиентов (`4xx`) в бюджете без явного решения.

**Что спрашивают дальше:** как по SLO строить алерты (burn rate); calendar window против rolling window; как считать SLO для сервиса с малым трафиком, где одна ошибка — это 1% за час; как зависимости влияют на достижимый SLO.

## Какие алерты действительно нужны и как избежать усталости от оповещений?

```yaml
category: devops
level: senior
difficulty: 5
slug: devops-senior-kakie-alerty-deistvitelno-nuzhny-i-kak-izbezhat-ustalosti-ot-opovesche
tags: observability, alerting
```

Будить человека должны только алерты на **симптомы, которые видят пользователи и которые требуют действия сейчас**: быстрое сжигание error budget, полная недоступность, накапливающаяся очередь, которая вот-вот нарушит SLO. Всё остальное (высокий CPU у одного пода, рестарт контейнера, ошибка в логе) — тикеты, дашборды или ничего. Усталость от алертов лечится не порогами «повыше», а принципом «каждый пейдж actionable» и регулярной чисткой: алерт, после которого никто ничего не сделал, удаляется или понижается.

**Симптомы против причин:**

| Алерт | Тип | Что с ним делать |
| --- | --- | --- |
| Сжигание бюджета availability в 14× быстрее нормы | симптом | page |
| Лаг консьюмера растёт и превысит 10 минут через 30 минут | симптом (предиктивный) | page |
| CPU пода > 90% | причина | дашборд, автоскейлинг |
| Под перезапустился | причина | ничего, если SLO не страдает; тикет при регулярности |
| Диск заполнится через 4 часа | причина, но неизбежная | page в рабочее время / тикет |
| Сертификат истекает через 14 дней | причина | тикет |

Причинные метрики нужны для диагностики, но алертить на них — значит будить людей из-за ситуаций, которые система переживает сама (Kubernetes перезапустит под, HPA добавит реплик).

**Multi-window multi-burn-rate — стандарт для SLO-алертов.** Burn rate — во сколько раз быстрее нормы тратится бюджет. Для SLO 99.9% за 30 дней burn rate 14.4 съедает 2% бюджета за час. Короткое окно подтверждает, что проблема всё ещё идёт, и позволяет алерту быстро погаснуть после исправления. В примере используются recording rules доли успешных запросов на окнах 5m, 30m, 1h и 6h:

```yaml
groups:
  - name: orders-slo-alerts
    rules:
      - alert: OrdersErrorBudgetFastBurn
        expr: |
          (
            1 - sli:orders_availability:ratio_rate1h > 14.4 * 0.001
          and
            1 - sli:orders_availability:ratio_rate5m > 14.4 * 0.001
          )
        for: 2m
        labels:
          severity: page
          team: orders
        annotations:
          summary: "orders-api тратит error budget в 14x быстрее нормы"
          runbook_url: https://runbooks.example.com/orders/error-budget
          dashboard: https://grafana.example.com/d/orders-slo
      - alert: OrdersErrorBudgetSlowBurn
        expr: |
          (
            1 - sli:orders_availability:ratio_rate6h > 6 * 0.001
          and
            1 - sli:orders_availability:ratio_rate30m > 6 * 0.001
          )
        labels:
          severity: ticket
          team: orders
```

Типичная схема из Google SRE Workbook: 14.4× на окнах 1h/5m и 6× на 6h/30m — page; 1× на 3d/6h — тикет. Это даёт быстрое обнаружение серьёзных сбоев и не реагирует на короткие всплески.

**Alertmanager — где убирается шум:**

```yaml
route:
  receiver: slack-default
  group_by: [alertname, service]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - matchers: [severity="page"]
      receiver: pagerduty-orders
inhibit_rules:
  - source_matchers: [alertname="KubeNodeNotReady"]
    target_matchers: [severity="page"]
    equal: [node]
```

- **group_by** склеивает 50 алертов от 50 подов в одно уведомление;
- **inhibit_rules** подавляют следствия, когда известна причина (нода упала — не надо пейджить за каждый сервис на ней);
- **silences** на время плановых работ;
- **repeat_interval** не должен быть 5 минут — повторный пейдж каждые 5 минут гарантирует, что его начнут игнорировать.

**Обязательные атрибуты хорошего алерта:**

- ссылка на runbook с первыми шагами диагностики и вариантами действий;
- ссылка на дашборд с нужным временным окном;
- владелец (команда), а не «общий канал»;
- понятный summary: что сломалось для пользователя, а не `expr` в тексте.

**Процесс против усталости:**

- **еженедельный разбор** всех сработавших пейджей: actionable ли, был ли runbook, ложный ли;
- **метрика шума**: число пейджей на дежурство, доля без действия; ориентир — единицы инцидентов за смену, а не десятки;
- **удаление по умолчанию**: алерт, который трижды подряд закрыли без действий, переписывается или удаляется;
- **`for:` и `keep_firing_for:`** против флаппинга: короткие всплески не будят, а алерт не мигает при колебаниях около порога;
- **синтетические проверки и watchdog-алерт** (всегда активный алерт, отсутствие которого означает, что сломался сам мониторинг).

**Что спрашивают дальше:** как алертить на сервис с малым трафиком (минимальный объём запросов в условии, синтетика); почему алерты на абсолютную latency хуже, чем на долю медленных запросов; как не пропустить тихий отказ, когда трафик упал до нуля (`absent()` и алерт на отсутствие запросов).

## Как настроить OpenTelemetry в .NET и что инструментировать в первую очередь?

```yaml
category: devops
level: senior
difficulty: 4
slug: devops-senior-kak-nastroit-opentelemetry-v-net-i-chto-instrumentirovat-v-pervuyu-och
tags: opentelemetry, observability
```

В .NET OpenTelemetry опирается на встроенные API платформы: трассировки — это `ActivitySource`/`Activity`, метрики — `Meter` из `System.Diagnostics.Metrics`, логи — `ILogger`. SDK лишь подписывается на них и экспортирует по OTLP в Collector. Инструментировать в первую очередь стоит **границы процесса**: входящие HTTP/gRPC-запросы, исходящие `HttpClient`, обращения к БД, кэшу и брокеру, а также метрики runtime. Это даёт 80% пользы почти без кода; ручные спаны и бизнес-метрики добавляются потом в местах, где не хватает детализации.

**Базовая настройка:**

```csharp
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r
        .AddService(serviceName: "orders-api", serviceVersion: typeof(Program).Assembly.GetName().Version?.ToString()))
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddNpgsql()
        .AddSource("Orders"))
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation()
        .AddMeter("Orders"))
    .WithLogging()
    .UseOtlpExporter();
```

Пакеты: `OpenTelemetry.Extensions.Hosting`, `OpenTelemetry.Exporter.OpenTelemetryProtocol`, `OpenTelemetry.Instrumentation.AspNetCore`, `OpenTelemetry.Instrumentation.Http`, `OpenTelemetry.Instrumentation.Runtime`, `Npgsql.OpenTelemetry`. Для SQL Server — `OpenTelemetry.Instrumentation.SqlClient`, для Redis — `OpenTelemetry.Instrumentation.StackExchangeRedis`. Часть contrib-инструментаций всё ещё в beta, и это нужно учитывать при обновлениях.

**Конфигурация через переменные окружения**, а не в коде:

```yaml
env:
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: http://otel-collector.observability:4317
  - name: OTEL_RESOURCE_ATTRIBUTES
    value: deployment.environment.name=prod,service.namespace=shop
  - name: OTEL_SERVICE_NAME
    value: orders-api
```

**Почему через Collector, а не напрямую в бэкенд.** Приложение отдаёт OTLP в ближайший Collector (DaemonSet или sidecar), а он батчит, ретраит, добавляет атрибуты Kubernetes (`k8sattributes`), фильтрует, делает tail sampling и рассылает в Prometheus/Tempo/Loki/вендора. Смена бэкенда не требует передеплоя приложений.

**Порядок внедрения:**

1. **Входящие запросы и runtime.** `http.server.request.duration` с маршрутом-шаблоном, GC, ThreadPool, исключения. В .NET 8+ ASP.NET Core сам публикует метрики через `Meter` (`Microsoft.AspNetCore.Hosting`, `Microsoft.AspNetCore.Server.Kestrel`), в .NET 9+ runtime публикует метер `System.Runtime`.
2. **Исходящие вызовы.** `HttpClient`, БД, кэш, брокер — именно там обычно сидит причина latency. Контекст W3C `traceparent` пробрасывается в HTTP автоматически.
3. **Асинхронные границы.** Для очередей контекст нужно положить в заголовки сообщения и извлечь при обработке — MassTransit и Confluent/RabbitMQ-инструментации умеют сами, для самописных консьюмеров используют `Propagators.DefaultTextMapPropagator`.
4. **Логи с корреляцией.** Через OTel-логирование в каждой записи автоматически есть `TraceId`/`SpanId` текущей `Activity`.
5. **Бизнес-спаны и метрики** в ключевых операциях.

**Ручной спан:**

```csharp
public sealed class CheckoutService(OrderRepository repository, PaymentClient payments)
{
    private static readonly ActivitySource Source = new("Orders");

    public async Task<Order> CheckoutAsync(Cart cart, CancellationToken ct)
    {
        using var activity = Source.StartActivity("checkout");
        activity?.SetTag("order.items_count", cart.Items.Count);

        try
        {
            var order = await repository.CreateAsync(cart, ct);
            await payments.ChargeAsync(order, ct);
            return order;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.AddException(ex);
            throw;
        }
    }
}
```

`StartActivity` вернёт `null`, если на источник никто не подписан или спан не прошёл сэмплирование — отсюда `?.` и практически нулевая стоимость выключенной инструментации. Имя источника в `AddSource` должно совпадать, иначе спаны молча теряются — самая частая причина «почему моих спанов нет». `Activity.AddException` появился в .NET 9; в более ранних версиях используют `RecordException` из пакета OpenTelemetry.

**Подводные камни:**

- **Кардинальность атрибутов в метриках.** `user.id` в теге спана — нормально, в теге метрики — катастрофа.
- **PII в атрибутах.** Тела запросов, query string с токенами, SQL с параметрами. Инструментации по умолчанию большую часть этого не пишут; включая опции записи текста SQL или тел запросов, проверяйте, что уходит наружу.
- **Шум.** Health-check эндпоинты и `/metrics` генерируют трассы на каждый вызов; их отфильтровывают (`AddAspNetCoreInstrumentation(o => o.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/healthz"))`).
- **Потеря телеметрии при остановке.** Exporter батчит данные; при SIGKILL последний батч теряется — ещё одна причина правильного graceful shutdown.
- **Семантические конвенции.** Имена атрибутов стабилизировались (`http.response.status_code` вместо `http.status_code`); на дашбордах после обновления пакетов могут «пропасть» данные.

**Что спрашивают дальше:** как работает propagation и baggage; чем `Activity` отличается от span в терминах OTel; почему Prometheus-exporter (pull) и OTLP (push) дают разную семантику временности (cumulative/delta); как устроено сэмплирование.

## Как работает сэмплирование трассировок и как не потерять редкие ошибки?

```yaml
category: devops
level: senior
difficulty: 5
slug: devops-senior-kak-rabotaet-semplirovanie-trassirovok-i-kak-ne-poteryat-redkie-oshibk
tags: tracing, observability
```

Сэмплирование решает, какие трассы сохранить. **Head sampling** принимает решение в начале трассы (обычно по хэшу `trace_id` с заданной вероятностью) и передаёт его дальше через флаг `sampled` в `traceparent`, поэтому все сервисы сохраняют одну и ту же трассу целиком. Оно дешёвое, но решает вслепую: при 1% вы теряете 99% ошибок. **Tail sampling** собирает все спаны трассы в OpenTelemetry Collector, ждёт её завершения и только потом решает — так можно сохранить 100% ошибок и медленных запросов и 1–5% обычных.

**Head sampling в .NET:**

```csharp
builder.Services.AddOpenTelemetry()
    .WithTracing(t => t
        .SetSampler(new ParentBasedSampler(new TraceIdRatioBasedSampler(0.05)))
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation());
```

- `TraceIdRatioBasedSampler` детерминирован по `trace_id`: разные сервисы с одинаковым коэффициентом примут одинаковое решение.
- `ParentBasedSampler` уважает решение вызывающего: если upstream сэмплировал запрос, его продолжение тоже сохранится, иначе получаются «дырявые» трассы без середины.
- Не сэмплированная трасса всё равно создаёт `Activity` для propagation, но без записи атрибутов (`Recorded = false`) — накладные расходы минимальны.

**Почему head sampling теряет редкие ошибки.** Ошибка в 0.1% запросов при сэмплировании 5% даёт 0.005% трасс с ошибкой — при 100 RPS это одна трасса в 30 минут. Именно та, которая нужна при разборе, скорее всего не сохранится.

**Tail sampling в Collector:**

```yaml
processors:
  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
    expected_new_traces_per_sec: 2000
    policies:
      - name: errors
        type: status_code
        status_code:
          status_codes: [ERROR]
      - name: slow
        type: latency
        latency:
          threshold_ms: 1000
      - name: checkout
        type: string_attribute
        string_attribute:
          key: http.route
          values: [/api/orders/checkout]
      - name: baseline
        type: probabilistic
        probabilistic:
          sampling_percentage: 5
```

Политики объединяются по «ИЛИ»: трасса сохраняется, если подошла под любую. Для сложной логики есть `and` и `composite` с распределением квоты между политиками.

**Архитектурные требования tail sampling:**

- **Все спаны трассы должны попасть в один экземпляр Collector.** При нескольких репликах ставят двухуровневую схему: первый слой с `loadbalancing` exporter (`routing_key: traceID`) распределяет спаны по `trace_id`, второй слой делает tail sampling.
- **Память.** Collector держит все спаны за `decision_wait` в памяти: 2 000 трасс/с × 10 с × десятки спанов. `num_traces` ограничивает буфер; при переполнении старые трассы вытесняются раньше решения.
- **Долгие трассы.** Если трасса длится дольше `decision_wait` (асинхронная обработка через очередь), решение принимается по неполным данным, а поздние спаны получают отдельное решение.
- **Приложение отправляет 100% спанов** до Collector — это сетевой трафик и CPU на экспорт. Компромисс — head sampling с высоким коэффициентом (например, 25%) плюс tail sampling на Collector.

**Как не потерять редкие ошибки другими способами:**

- **Метрики не сэмплируются.** Доля ошибок и гистограммы считаются по 100% запросов в SDK; сэмплирование трасс на них не влияет. Если метрики выводятся из спанов (spanmetrics connector), то делать это нужно до сэмплирования.
- **Exemplars** привязывают к бакетам гистограммы `trace_id` именно сохранённых трасс, давая переход «от всплеска к примеру».
- **Логи ошибок** пишутся всегда и содержат `trace_id` — даже без трассы можно найти все логи этого запроса во всех сервисах.
- **Принудительное сэмплирование** для отладки: заголовок или флаг для конкретного клиента, который кастомный sampler превращает в `RecordAndSample`.
- **Отдельные правила для критичных маршрутов** — оплата сэмплируется на 100%, каталог на 1%.

**Свой sampler в .NET** — наследник `Sampler` с методом `ShouldSample(in SamplingParameters)`, который возвращает `SamplingResult(SamplingDecision.RecordAndSample)` или `Drop`. Его используют для принудительного сэмплирования по признаку, доступному при старте спана (имя операции, вид спана, контекст родителя), и оборачивают в `ParentBasedSampler`, чтобы не ломать решения upstream. Отсев health checks надёжнее делать фильтром инструментации ASP.NET Core, а не sampler'ом: атрибуты запроса к моменту сэмплирования могут быть ещё не заполнены.

**Что спрашивают дальше:** как сэмплирование влияет на подсчёт метрик из трасс (нужен учёт коэффициента); что такое consistent probability sampling и `th` в `tracestate`; как сэмплировать трассы, проходящие через очередь, где у консьюмера свой корневой спан и ссылка (span link) на продюсера.

## Как связать логи, метрики и трассировки при разборе инцидента?

```yaml
category: devops
level: senior
difficulty: 5
slug: devops-senior-kak-svyazat-logi-metriki-i-trassirovki-pri-razbore-incidenta
tags: observability, incident
```

Сигналы связываются через **общие идентификаторы**: одинаковые атрибуты ресурса (`service.name`, `service.version`, `deployment.environment.name`, `k8s.pod.name`) у всех трёх сигналов, `trace_id`/`span_id` в каждой записи лога и **exemplars** в метриках, которые хранят `trace_id` конкретного измерения. Разбор инцидента тогда идёт сверху вниз: метрика показывает *что* и *когда*, exemplar или поиск по атрибутам ведёт к трассе, которая показывает *где*, а логи этой трассы объясняют *почему*.

**Типичный путь при инциденте:**

```text
алерт по burn rate (метрика)
  → дашборд RED: какой эндпоинт, с какого времени, какая версия
  → разрез по атрибутам: один под/зона/версия или все
  → exemplar на всплеске p99 или поиск трасс с status=ERROR в окне
  → трасса: какой спан медленный или упал (БД, внешний API, lock)
  → логи по trace_id во всех сервисах: исключение, параметры, ретраи
  → метрики зависимости: это причина или ещё один симптом
```

**Что нужно настроить заранее, чтобы это работало:**

**Одинаковые имена сервиса и окружения.** Если в метриках `job="orders"`, в логах `app=orders-api`, а в трассах `service.name=Orders.Api`, корреляция превращается в ручной поиск. Источник истины — `OTEL_SERVICE_NAME` и `OTEL_RESOURCE_ATTRIBUTES` плюс `k8sattributes` в Collector, который одинаково обогащает все сигналы.
**`trace_id` в логах.** В .NET через OTel-логирование он добавляется автоматически; при логировании в stdout (JSON console, Serilog) нужно включить трекинг активности:

```csharp
builder.Logging.Configure(o =>
    o.ActivityTrackingOptions = ActivityTrackingOptions.TraceId | ActivityTrackingOptions.SpanId);
builder.Logging.AddJsonConsole(o => o.IncludeScopes = true);
```

**Exemplars.** SDK должен их собирать, а хранилище — принимать:

```csharp
builder.Services.AddOpenTelemetry()
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .SetExemplarFilter(ExemplarFilterType.TraceBased));
```

Prometheus хранит exemplars только с `--enable-feature=exemplar-storage` (или при приёме через OTLP/remote write в бэкенд с их поддержкой — Mimir, Grafana Cloud).

**Переходы между источниками в Grafana:**

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    uid: prometheus
    url: http://prometheus:9090
    jsonData:
      exemplarTraceIdDestinations:
        - name: trace_id
          datasourceUid: tempo
  - name: Loki
    type: loki
    uid: loki
    url: http://loki:3100
    jsonData:
      derivedFields:
        - name: TraceID
          matcherRegex: '"TraceId":"(\w+)"'
          url: '$${__value.raw}'
          datasourceUid: tempo
  - name: Tempo
    type: tempo
    uid: tempo
    url: http://tempo:3200
    jsonData:
      tracesToLogsV2:
        datasourceUid: loki
        filterByTraceID: true
        spanStartTimeShift: '-5m'
        spanEndTimeShift: '5m'
      serviceMap:
        datasourceUid: prometheus
```

Регулярка в `derivedFields` должна совпадать с реальным форматом лога — после смены логгера или формата ссылки молча перестают работать.

**Версия и деплой как событие.** Аннотации деплоев на дашбордах (из CI или Argo CD) и `service.version` в атрибутах отвечают на самый частый вопрос инцидента: «что поменялось?».

**Ловушки при разборе:**

- **Сэмплирование.** Нужной трассы может не быть. Логи с `trace_id` пишутся всегда, поэтому по ним можно восстановить путь запроса и без трассы; tail sampling с политикой «все ошибки» снимает проблему для упавших запросов.
- **Асинхронные границы.** Если контекст не пробросили в сообщение очереди, трасса обрывается на продюсере; консьюмер начинает новую, и связь теряется. Проверяется заранее, не во время инцидента.
- **Разное время хранения.** Метрики хранятся месяцами, трассы — дни, логи — неделю-две. Постмортем через три недели обнаружит, что детализация уже удалена; для крупных инцидентов данные экспортируют сразу.
- **Симптом и причина в разных сервисах.** Рост latency у API часто — следствие насыщения пула соединений к БД или ретраев в соседе. Service map по трассам и метрики исходящих вызовов показывают, где очередь, а не где жалоба.
- **Расхождение часов.** Спаны с разных нод могут «залезать» друг на друга; при чтении трассы опираться на структуру родитель–потомок, а не только на абсолютные таймстампы.

**После инцидента** ссылки на конкретные графики, трассы и запросы в логах вставляют в постмортем, а недостающие сигналы (не было метрики пула, не было `trace_id` в логах воркера) становятся задачами — так observability растёт из реальных разборов, а не по чек-листу.

**Что спрашивают дальше:** чем профилирование (continuous profiling) дополняет три сигнала; как коррелировать с пользовательскими сессиями на фронтенде (RUM и `traceparent` из браузера); как устроен spanmetrics connector и когда метрики из трасс лучше SDK-метрик.

## Как хранить секреты и организовать их ротацию без простоя?

```yaml
category: devops
level: senior
difficulty: 4
slug: devops-senior-kak-hranit-sekrety-i-organizovat-ih-rotaciyu-bez-prostoya
tags: security, secrets
```

Секреты хранятся во внешнем менеджере (HashiCorp Vault, Azure Key Vault, AWS Secrets Manager, GCP Secret Manager), а в кластер попадают через External Secrets Operator или Secrets Store CSI Driver; в git — только ссылки на них или зашифрованные значения (SOPS, Sealed Secrets). Ротация без простоя строится на **периоде, когда валидны оба значения — старое и новое**, и на том, что приложение умеет подхватить новое значение без рестарта или пережить rolling restart.

**Почему Kubernetes Secret — не хранилище секретов.** Это base64, а не шифрование: любой с правом `get secrets` в неймспейсе видит значения, по умолчанию они лежат в etcd открытым текстом (если не настроено encryption at rest через KMS-провайдер), а `kubectl get secret -o yaml` попадает в историю терминала и логи CI. Kubernetes Secret — это транспорт до пода; хранить, версионировать, аудировать и ротировать нужно снаружи.

**External Secrets Operator** синхронизирует значения из менеджера в обычный Secret:

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: orders-db
spec:
  refreshInterval: 15m
  secretStoreRef:
    kind: ClusterSecretStore
    name: vault
  target:
    name: orders-db
  data:
    - secretKey: password
      remoteRef:
        key: orders/db
        property: password
```

Для доступа к менеджеру под использует workload identity (IRSA в EKS, Workload Identity в AKS/GKE, Kubernetes auth в Vault), а не статический ключ, который сам стал бы секретом без ротации.

**Как секрет доходит до .NET и почему это важно для ротации:**

| Способ | Обновится без рестарта | Комментарий |
| --- | --- | --- |
| Переменная окружения из Secret | нет | значение фиксируется при старте контейнера |
| Файл из volume Secret | да, с задержкой (до минуты-двух) | не работает с `subPath` |
| CSI Secrets Store | да, при включённой ротации драйвера | монтирует напрямую из менеджера |
| Чтение из менеджера в приложении | да, по `ReloadInterval` | Azure Key Vault / AWS провайдеры конфигурации |

```csharp
builder.Configuration.AddKeyPerFile("/mnt/secrets", optional: false, reloadOnChange: true);
```

С `reloadOnChange` новое значение попадает в `IConfiguration` и в `IOptionsMonitor<T>`; `IOptions<T>` и значения, скопированные в синглтон на старте, останутся старыми. Если обновление на лету не поддерживается, используют Reloader (аннотация на Deployment) — он делает rolling restart при изменении Secret.

**Ротация без простоя — схема для пароля БД:**

1. Создать второго пользователя или второй пароль (в PostgreSQL — две роли `orders_app_a` / `orders_app_b` с одинаковыми правами, в облачных БД — встроенная dual-user ротация Secrets Manager).
2. Записать новые креды в менеджер; ESO обновит Secret, приложение подхватит или переразвернётся.
3. Убедиться по метрикам/логам БД, что старыми кредами больше никто не подключается.
4. Только тогда отозвать старый пароль.

Ключевая ловушка — **пул соединений**. Npgsql и SqlClient держат открытые соединения, авторизованные старым паролем; они работают до закрытия, а новые открываются с тем паролем, который в строке подключения. Если строка не обновилась, а старый пароль уже отозван, сервис падает при первом росте пула. Npgsql умеет получать пароль динамически:

```csharp
var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
dataSourceBuilder.UsePeriodicPasswordProvider(
    (_, ct) => secretProvider.GetDbPasswordAsync(ct),
    successRefreshInterval: TimeSpan.FromMinutes(5),
    failureRefreshInterval: TimeSpan.FromSeconds(10));
await using var dataSource = dataSourceBuilder.Build();
```

Ещё лучше — **динамические секреты** Vault (database secrets engine): каждый под получает собственные короткоживущие креды с TTL, ротация становится постоянным процессом, а утёкший пароль живёт часы. Для облачных БД — аутентификация managed identity / IAM-токеном вовсе без пароля.

**Другие типы секретов:**

- **Ключи подписи JWT** — публиковать несколько ключей в JWKS с `kid`, подписывать новым, проверять обоими до истечения последнего выданного токена.
- **Ключи Data Protection в ASP.NET Core** — хранить общий key ring (Redis, Blob Storage, БД) с шифрованием, иначе каждый под генерирует свои ключи, и cookies/antiforgery-токены ломаются между репликами и после рестарта.
- **TLS-сертификаты** — cert-manager выпускает и обновляет их заранее; TLS обычно терминируют на ingress или в mesh, которые подхватывают новый Secret сами. Если сертификат загружен в Kestrel, нужно проверить, перечитывает ли приложение обновлённый файл, иначе после обновления нужен rolling restart.
- **API-ключи партнёров** — поддерживать два активных ключа на стороне провайдера.

**Типичные утечки:** секреты в `appsettings.Production.json` в образе, в аргументах командной строки (видны в `ps` и в описании пода), в логах при логировании конфигурации или строки подключения, в переменных CI, выводимых `set -x`. Сканеры (gitleaks, GitHub secret scanning) в пайплайне и pre-commit ловят большую часть случаев.

**Что спрашивают дальше:** как Sealed Secrets/SOPS сочетаются с GitOps; что делать, если секрет уже утёк (ротация немедленно, аудит доступа, а не удаление из истории git); как ограничить RBAC так, чтобы разработчики не читали прод-секреты.

## Как организовать нагрузочное тестирование в окружении, близком к продакшену?

```yaml
category: devops
level: senior
difficulty: 5
slug: devops-senior-kak-organizovat-nagruzochnoe-testirovanie-v-okruzhenii-blizkom-k-proda
tags: load-testing, devops
```

Окружение для нагрузочного теста должно совпадать с продакшеном **в том, что определяет производительность**: те же образы и версии, те же лимиты ресурсов и настройки runtime, такая же топология (ingress, mesh, число реплик, HPA), сопоставимый объём и распределение данных в БД и реалистичный профиль трафика. Полная копия прода редко нужна; нужна копия узкого места плюс понимание, как результаты масштабируются. А сам тест должен отвечать на конкретный вопрос — «держим ли 3× от пика при p99 < 400 мс» — с порогами, которые автоматически определяют результат.

**Что важно воспроизвести, а что можно упростить:**

| Аспект | Почему важно | Как добиться |
| --- | --- | --- |
| Объём данных | план запросов PostgreSQL на 10 тыс. строк и на 100 млн — разный | обезличенный снапшот прода или генерация с теми же распределениями |
| Лимиты CPU/памяти, `DOTNET_*` | троттлинг и GC проявляются только при реальных лимитах | те же Helm values, что в проде |
| Сетевая топология | TLS, ingress, mesh-sidecar добавляют latency и CPU | тот же путь трафика, генератор вне кластера |
| Внешние зависимости | платёжный шлюз нельзя нагружать | стабы с реалистичной latency и долей ошибок (WireMock, mountebank) |
| Профиль трафика | 90% чтений каталога и 10% чекаутов нагружают систему иначе, чем 100% одного эндпоинта | смесь сценариев по данным access-логов |
| Кэши | тест на прогретом кэше по одному ключу ничего не говорит | разброс ключей, сравнимый с продом |

**Модель нагрузки: open против closed.** Closed-модель (N виртуальных пользователей в цикле) автоматически снижает нагрузку, когда система тормозит, и маскирует деградацию — это coordinated omission. Реальные пользователи приходят независимо от того, тормозит ли сервис, поэтому для API нужна open-модель с заданной интенсивностью запросов:

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 2000,
      stages: [
        { target: 900, duration: '10m' },
        { target: 900, duration: '20m' },
      ],
      exec: 'browse',
    },
    checkout: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '30m',
      preAllocatedVUs: 100,
      exec: 'checkout',
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration{scenario:checkout}': ['p(99)<800'],
    'http_req_duration{scenario:browse}': ['p(99)<300'],
  },
};

export function browse() {
  const res = http.get(`${__ENV.BASE_URL}/api/catalog?page=${Math.floor(Math.random() * 500)}`);
  check(res, { 'status 200': (r) => r.status === 200 });
}

export function checkout() {
  const res = http.post(`${__ENV.BASE_URL}/api/orders/checkout`, JSON.stringify({ cartId: `load-${__VU}-${__ITER}` }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'status 201': (r) => r.status === 201 });
}
```

При невыполнении `thresholds` k6 завершается с ненулевым кодом, и шаг CI падает. Для .NET-команд альтернатива — NBomber со сценариями на C#.

**Виды тестов и что они ловят:**

- **load** — целевая нагрузка, проверка SLO;
- **stress** — рост до отказа: где точка насыщения и как система деградирует (отдаёт `429`/`503` или лавинообразно падает);
- **soak** — несколько часов на постоянной нагрузке: утечки памяти, рост числа соединений, фрагментация LOH, переполнение логов;
- **spike** — резкий скачок: успевает ли HPA, не умирают ли поды на старте, нет ли cache stampede на холодном кэше;
- **failover под нагрузкой** — убить под или реплику БД во время теста.

**Наблюдаемость во время теста важнее отчёта k6.** Генератор показывает только симптомы; ответ «почему» — в тех же дашбордах, что используются в проде: RED по эндпоинтам, троттлинг CPU, GC pause, ThreadPool queue, пул соединений, `pg_stat_statements`, лаг консьюмеров. Тест без этих данных даёт число, но не узкое место.

**Типичные ошибки:**

- генератор нагрузки сам упирается в CPU или сеть — его метрики тоже нужно мониторить, а при больших RPS распределять (k6 operator в Kubernetes);
- генератор в том же кластере и на тех же нодах, что и сервис — делит с ним ресурсы и обходит ingress;
- одни и те же тестовые данные: все запросы бьют в одну строку или ключ кэша;
- тест на «прогретой» системе без учёта старта и автоскейлинга;
- общее staging-окружение с соседями, которые в это время гоняют свои тесты, — результаты невоспроизводимы;
- разовый тест перед релизом вместо регулярного прогона с трендом: регрессию на 15% в p99 видно только в сравнении с предыдущими запусками.

**Тестирование в проде** — финальная стадия для зрелых команд: shadow traffic (зеркалирование запросов в новую версию без ответа клиенту), синтетические заказы с пометкой теста, плановые game days. Требует изоляции сайд-эффектов и договорённостей с бизнесом.

**Что спрашивают дальше:** как экстраполировать результаты с уменьшенного окружения (линейно масштабируются только stateless-слои); как определить ёмкость одного пода для настройки HPA; почему средняя latency и даже p99 из отчёта генератора могут врать при coordinated omission.
