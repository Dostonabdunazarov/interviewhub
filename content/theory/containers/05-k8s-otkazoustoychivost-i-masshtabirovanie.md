---
title: Отказоустойчивость и автомасштабирование в K8s
slug: k8s-otkazoustoychivost-i-masshtabirovanie
track: infrastructure
section: containers
level: senior
sortOrder: 5
summary: Как разложить реплики по нодам и зонам, чтобы пережить их потерю, почему HPA по CPU опаздывает за всплеском и чем его заменить, и откуда в кластере берутся пятисекундные задержки DNS.
questions: devops-kak-sdelat-tak-chtoby-servis-v-kubernetes-perezhil-poteryu-nody-ili-celoi-zony-do, devops-pochemu-hpa-po-cpu-ne-uspevaet-za-vspleskom-nagruzki-i-kak-nastroit-avtomasshtabi, devops-pochemu-v-kubernetes-poyavlyayutsya-zaderzhki-i-taimauty-dns-rezolva-i-kak-ih-ust
---

`replicas: 3` ещё не отказоустойчивость. Планировщик без ограничений вполне может поставить все три пода на одну ноду, HPA добавит реплики через минуту после того, как пик уже ударил, а внешний вызов будет раз в несколько тысяч запросов висеть ровно пять секунд из-за DNS. Все три проблемы объединяет одно: кластер реагирует с задержками, и надёжность закладывается заранее — раскладкой, запасом ёмкости и конфигурацией, а не реакцией в момент сбоя.

## Что происходит при потере ноды

```text
t=0         нода перестала отвечать
t≈40–50 с   NotReady, taint unreachable:NoExecute, поды Ready=False,
            их убирают из EndpointSlice
t≈5 мин     истекает tolerationSeconds=300, поды вытесняются,
            Deployment создаёт замену на других нодах
```

Первые десятки секунд трафик ещё идёт на мёртвые поды, поэтому клиенты обязаны ретраить идемпотентные запросы с таймаутом. Замена появляется только через пять минут, и всё это время сервис живёт на оставшихся репликах — их должно хватить по ёмкости. Поды StatefulSet автоматически не пересоздаются, пока нода не удалена из кластера: Kubernetes не может убедиться, что старый под остановлен, а два пода с одной identity опаснее простоя.

## Раскладка по зонам и нодам

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app: orders-api
    matchLabelKeys:
      - pod-template-hash
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels:
        app: orders-api
```

По зонам ограничение жёсткое: разница числа подов между зонами не больше одного. По нодам — мягкое, иначе при нехватке нод поды застрянут в `Pending`. `matchLabelKeys` с `pod-template-hash` считает перекос отдельно для каждой ревизии, иначе во время rolling update старые и новые поды смешиваются в подсчёте. `minDomains` заставляет учитывать зоны, в которых пока нет нод, — это важно вместе с автоскейлером нод.

`podAntiAffinity` решает похожую задачу проще — «не больше одного пода на домен», — но при числе реплик больше числа нод или зон обязательное правило оставляет лишние поды в `Pending`. Spread гибче: он ограничивает перекос, а не количество. Оба правила действуют только в момент планирования: после восстановления зоны поды сами не перераспределятся, нужен descheduler или очередной rollout.

## PodDisruptionBudget

PDB ограничивает добровольные вытеснения через Eviction API: `kubectl drain` при обновлении нод и удаление нод автоскейлером. От падения ноды, OOM, `kubectl delete pod` и rolling update Deployment он не защищает — у раскатки свои `maxUnavailable` и `maxSurge`.

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: orders-api
spec:
  maxUnavailable: 1
  unhealthyPodEvictionPolicy: AlwaysAllow
  selector:
    matchLabels:
      app: orders-api
```

`maxUnavailable: 0` или `minAvailable`, равный числу реплик, блокирует drain навсегда, и обновление кластера зависает. При одной реплике PDB бесполезен в обе стороны. `AlwaysAllow` разрешает вытеснять уже неготовые поды, чтобы под в `CrashLoopBackOff` не держал drain.

## Ёмкость и состояние

При трёх зонах и потере одной оставшиеся две берут всю нагрузку: каждая должна выдержать полторы своей обычной доли. Это и есть N+1 на уровне зон. Запас можно держать постоянно — дорого, но мгновенно — или полагаться на HPA и автоскейлер нод. Второй вариант означает минуты деградации, причём в момент отказа зоны все клиенты облака разом просят ноды в оставшихся зонах. `maxReplicas` и квоты облака должны такой рост допускать.

Блочные тома привязаны к зоне: под со своим PVC в другую зону не переедет. Для StorageClass ставят `volumeBindingMode: WaitForFirstConsumer`, а отказоустойчивость данных обеспечивает репликация самой БД между зонами. Сервис, разнесённый по трём зонам, но ходящий в единственный primary, переживает потерю зоны только вместе с failover базы — проверять нужно всю цепочку. Проверяют учениями: drain ноды под нагрузкой, затем cordon и drain всей зоны с наблюдением за ошибками и latency.

## Почему HPA по CPU опаздывает

HPA — контур с обратной связью, и задержки в нём складываются:

| Этап | Порядок времени |
| --- | --- |
| metrics-server снимает usage с kubelet | раз в 15 с, усреднено за окно |
| цикл HPA | 15 с |
| планирование и pull образа | секунды, при холодном кэше дольше |
| старт .NET, прогрев, readiness | 5–30 с |
| новая нода от автоскейлера | минуты |

Расчёт один для всех метрик: `desired = ceil(current * currentMetric / target)`, при нескольких метриках берётся максимум, отклонение в пределах 10% игнорируется. Для CPU метрика — процент от `requests.cpu`. Отсюда три ловушки. Под, упёршийся в CPU limit, троттлится, и его usage не превысит `limit / request`: при равных значениях и цели 80% HPA растёт не больше чем в 1.25 раза за цикл, пока очередь запросов копится. I/O-bound API ждёт базу при CPU 30%, и HPA не делает ничего. Наконец, CPU неготовых подов в первые минуты после старта (`cpu-initialization-period`, по умолчанию 5 минут) не учитывается, чтобы JIT-прогрев не вызвал каскад, — это тоже замедляет реакцию. Про троттлинг подробно — в `Лимиты CPU и памяти для .NET`.

## Как настроить масштабирование

Масштабируются по опережающей метрике — RPS, числу запросов в работе, лагу очереди. Метрика `Pods` требует адаптера custom metrics API, например Prometheus Adapter, или KEDA:

```yaml
spec:
  minReplicas: 4
  maxReplicas: 40
  metrics:
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "150"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0
      selectPolicy: Max
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

Цель 150 RPS на под — иллюстрация: реальное число берут из нагрузочного теста как ёмкость пода при допустимом p99 минус запас на время, пока масштабирование догоняет. Вверх — быстро, вниз — медленно, иначе после пика HPA срежет поды и следующую волну встретит с нуля. KEDA удобна, когда метрика лежит в Prometheus, Kafka или RabbitMQ: она сама создаёт HPA, умеет масштабировать до нуля и по расписанию через `cron`-триггер. Для консьюмеров правильная метрика — лаг, и верхняя граница для Kafka — число партиций.

Остальное — сократить задержки контура. `minReplicas` держат с запасом, чтобы утренний пик не начинался с холодного старта; для предсказуемых пиков добавляют расписание. Старт пода ускоряют ReadyToRun или Native AOT, прогревом пулов и кэшей до readiness и образом, который уже лежит на ноде. Ёмкость нод резервируют через overprovisioning: поды-заглушки с отрицательным `PriorityClass` держат место, при всплеске планировщик мгновенно вытесняет их ради настоящих подов, а ноды докупаются в фоне. И помнят про общие зависимости: 40 реплик по 50 соединений в пуле превысят `max_connections` PostgreSQL. HPA и VPA по одной метрике CPU одновременно не используют.

## DNS: ndots и пятисекундные таймауты

В `/etc/resolv.conf` пода стоит `options ndots:5` и несколько search-доменов. Имя с числом точек меньше пяти сначала пробуется как относительное:

```text
api.stripe.com.orders.svc.cluster.local   A, AAAA -> NXDOMAIN
api.stripe.com.svc.cluster.local          A, AAAA -> NXDOMAIN
api.stripe.com.cluster.local              A, AAAA -> NXDOMAIN
api.stripe.com                            A, AAAA -> ответ
```

Вместо двух запросов — восемь и больше, и всё это нагружает CoreDNS. Вторая причина — гонка в conntrack: glibc отправляет A и AAAA параллельно с одного UDP-сокета, один пакет теряется на DNAT, и резолв ждёт таймаута ровно 5 секунд. Симптом — редкие пики latency в 5 и 10 секунд на фоне нормальной нагрузки.

```yaml
dnsConfig:
  options:
    - name: ndots
      value: "2"
    - name: single-request-reopen
```

`ndots: 2` отправляет внешние имена сразу как абсолютные, а короткие `orders` и `orders.ns` продолжают работать. FQDN с точкой в конце (`api.stripe.com.`) отключает search-домены для конкретного имени, но в SNI и `Host` точка не нужна. `single-request-reopen` разводит A и AAAA по разным сокетам — только в glibc, musl в Alpine его не поддерживает. Системное решение — NodeLocal DNSCache: кэш на каждой ноде, трафик к нему исключён из conntrack, промахи уходят в CoreDNS по TCP. Сам CoreDNS масштабируют по размеру кластера и не душат CPU limit.

В .NET на Linux своего DNS-кэша нет: `Dns.GetHostAddressesAsync` идёт в `getaddrinfo`, и каждое новое соединение — новый резолв. `SocketsHttpHandler` резолвит только при открытии соединения, поэтому `PooledConnectionLifetime` ставят в минуты, а не секунды, а `new HttpClient()` на запрос превращается в шторм DNS-запросов. Пики ровно около 5 секунд в p99 HTTP-клиента вместе с такими же пиками в метрике `dns.lookup.duration` указывают на DNS. В chiseled-образе нет `dig`, поэтому проверяют через `kubectl debug` с эфемерным контейнером, а на ноде смотрят `conntrack -S` и счётчик `insert_failed`.

## Что стоит ответить на собеседовании

Чтобы пережить потерю ноды или зоны, нужны реплики, разнесённые через `topologySpreadConstraints` по зонам и нодам, PDB с `maxUnavailable: 1` для плановых drain и запас ёмкости, чтобы две зоны из трёх выдержали всю нагрузку. HPA по CPU опаздывает из-за цепочки задержек и косвенности сигнала, поэтому масштабируются по RPS или лагу очереди через custom metrics или KEDA, с быстрым `scaleUp` и медленным `scaleDown`. Задержки DNS — это `ndots:5` с search-доменами и conntrack-гонка UDP, лечатся `ndots: 2`, FQDN и NodeLocal DNSCache.

Сильный ответ назовёт тайминги: около 40–50 секунд до NotReady и пять минут до вытеснения, 15 секунд на метрики и цикл HPA, ровно 5 секунд на потерянный DNS-пакет. Объяснит, почему CPU limit не даёт HPA увидеть нагрузку, зачем overprovisioning с отрицательным приоритетом и почему StatefulSet не переезжает с упавшей ноды сам. И напомнит, что отказоустойчивость сервиса ограничена его зависимостями: единственный primary базы или зональный том сводят на нет всю раскладку подов.
