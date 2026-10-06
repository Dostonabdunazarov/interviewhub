# Kafka и брокеры сообщений

Вопросы категории `kafka` в формате импорта (`tools/questions.md`): 60 шт.

```bash
node tools/import-questions.mjs --file content/questions/kafka.md --dry-run
node tools/import-questions.mjs --file content/questions/kafka.md --url … --email … --update
```

---

## Что такое Apache Kafka?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-apache-kafka
tags: kafka
```

Apache Kafka — распределённый журнал событий (distributed commit log): брокеры хранят сообщения в упорядоченных append-only логах на диске, а клиенты пишут в них и читают с любой позиции. Это не классическая очередь, из которой сообщение «забирают», а хранилище событий, которое можно читать сколько угодно раз.

**Ключевые понятия:**

- **Topic** — именованный поток событий (`orders`, `payments`).
- **Partition** — единица параллелизма и порядка; topic состоит из нескольких партиций, каждая — отдельный лог.
- **Offset** — порядковый номер записи в партиции.
- **Broker** — сервер Kafka; кластер из нескольких брокеров хранит реплики партиций.
- **Producer / Consumer / Consumer group** — кто пишет, кто читает и как чтение делится между экземплярами сервиса.
- **KRaft** — встроенный Raft-кворум контроллеров для метаданных. В Kafka 4.0 ZooKeeper удалён полностью; раньше метаданные кластера хранились в нём.

**Чем отличается от брокера очередей:**

| | Kafka | Классическая очередь (RabbitMQ) |
| --- | --- | --- |
| Что происходит после чтения | запись остаётся до истечения retention | сообщение удаляется после ack |
| Кто помнит позицию | consumer (commit offset) | брокер |
| Перечитать историю | да, сдвинуть offset | нет |
| Масштабирование чтения | партициями | числом consumer'ов на очередь |

**Почему она быстрая.** Последовательная запись на диск, page cache ОС, батчи и сжатие на стороне клиента, zero-copy (`sendfile`) при отдаче данных. Брокер почти не думает о каждом сообщении отдельно — он раздаёт куски файлов.

**Типичные сценарии:** event-driven интеграция микросервисов, CDC (Debezium), сбор логов и метрик, стриминговая обработка (Kafka Streams, Flink), транспорт для event sourcing.

**Что спросят дальше:** как устроены партиции и порядок, какие гарантии доставки (`acks`, idempotence), чем Kafka отличается от RabbitMQ и когда она избыточна.

## Что такое topic?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-topic
tags: kafka
```

Topic — именованная логическая категория событий, в которую producer'ы пишут и из которой consumer'ы читают. Физически topic — набор партиций, каждая из которых — отдельный append-only лог на брокерах.

**Что задаётся при создании:**

```bash
kafka-topics.sh --bootstrap-server localhost:9092 --create \
  --topic orders --partitions 12 --replication-factor 3 \
  --config retention.ms=604800000 --config min.insync.replicas=2
```

- **число партиций** — верхняя граница параллелизма чтения в одной consumer group;
- **replication factor** — сколько копий каждой партиции держит кластер;
- **конфиги уровня топика** — переопределяют настройки брокера.

**Как topic хранит данные — `cleanup.policy`:**

| Политика | Поведение | Когда |
| --- | --- | --- |
| `delete` (по умолчанию) | старые сегменты удаляются по `retention.ms` (по умолчанию 7 дней) или `retention.bytes` | поток событий |
| `compact` | для каждого ключа остаётся последнее значение, `null`-значение (tombstone) удаляет ключ | состояние сущностей, changelog |
| `compact,delete` | и то и другое | компактный лог с ограничением по времени |

**Важные свойства:**

- Topic не удаляет сообщение после чтения — его независимо читают разные consumer group'ы.
- Порядок гарантируется только внутри партиции, не во всём topic.
- Число партиций можно только увеличить, и это ломает соответствие «ключ → партиция».

**Практика.** Имена обычно строят как `<домен>.<сущность>.<событие>`. `auto.create.topics.enable` в проде лучше выключать, чтобы опечатка в имени не создавала мусорный topic с дефолтными настройками.

**Что спросят дальше:** сколько партиций заводить и почему «побольше на всякий случай» не бесплатно — файлы, память клиентов, время failover и rebalance.

## Что такое partition?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-partition
tags: partitioning
```

Partition — упорядоченный неизменяемый лог записей внутри topic. Это единица параллелизма (одну партицию в группе читает ровно один consumer), единица порядка (порядок гарантирован только внутри неё) и единица репликации (у каждой партиции свой leader и follower'ы).

**Как запись попадает в партицию:**

- **Есть ключ** — партиция = `hash(key) % numPartitions`. Одинаковый ключ всегда попадает в одну партицию, пока число партиций не меняется.
- **Ключа нет** — клиент распределяет записи сам: в Java-клиенте с 3.3 — «sticky»-партиционирование (батч целиком в одну партицию, потом следующая), чтобы батчи были крупнее.
- **Партиция указана явно** — пишется туда.

Нюанс для .NET: Confluent.Kafka работает поверх librdkafka, у которой партиционер по умолчанию `consistent_random` (CRC32), а у Java-клиента — murmur2. Если один topic пишут и Java-, и .NET-сервисы с одинаковыми ключами, в .NET нужно выставить `Partitioner = Partitioner.Murmur2Random`, иначе один ключ окажется в разных партициях.

**Физическое устройство.** Партиция на диске — каталог `orders-3/` с сегментами: `.log` (данные), `.index` (offset → позиция в файле), `.timeindex` (время → offset). Запись идёт только в активный сегмент, удаление по retention — целыми сегментами.

**Как выбирать количество:**

- ориентир — целевая пропускная способность, делённая на пропускную способность одного consumer'а, плюс запас на рост;
- больше партиций — больше параллелизма, но больше открытых файлов, памяти на клиентах, дольше failover и rebalance;
- уменьшить число партиций нельзя; увеличить можно, но это меняет распределение ключей.

**Типичные ошибки:** одна партиция «ради порядка» (нет масштабирования), ключ с малой кардинальностью или «горячий» ключ — одна партиция перегружена, остальные простаивают.

## Что такое offset?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-offset
tags: kafka
```

Offset — порядковый номер записи внутри партиции: монотонно растущее 64-битное число, которое брокер присваивает при записи. Тройка (topic, partition, offset) однозначно идентифицирует сообщение.

**Какие offset'ы бывают:**

| Понятие | Смысл |
| --- | --- |
| log start offset | самая старая доступная запись (всё до неё удалено retention) |
| log end offset (LEO) | offset следующей записи, которая будет добавлена |
| high watermark | до этого offset'а данные реплицированы во все ISR; consumer'ы видят только записи ниже него |
| committed offset | позиция, сохранённая consumer group'ой, — «следующая запись, которую надо прочитать» |
| position | текущая позиция конкретного consumer'а в памяти |

**Где хранится позиция consumer'а.** Не в брокере «по сообщению», а во внутреннем compacted topic `__consumer_offsets`: ключ — (group, topic, partition), значение — offset. Поэтому Kafka легко держит тысячи групп: состояние каждой — одно число на партицию.

**Тонкость:** коммитится offset *следующего* сообщения, а не обработанного. Confluent.Kafka делает `+1` сам в `Commit(consumeResult)` и `StoreOffset(consumeResult)`, а при ручной работе с `TopicPartitionOffset` об этом легко забыть и получить повторную обработку последнего сообщения после рестарта.

**Если сохранённого offset'а нет или он уже удалён retention'ом**, поведение задаёт `auto.offset.reset`: `latest` (по умолчанию — только новые), `earliest` (с начала), `none` в Java / `error` в librdkafka (исключение).

**Перемотка группы:**

```bash
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group billing \
  --topic orders --reset-offsets --to-datetime 2026-09-01T00:00:00.000 --execute
```

Группа при этом должна быть неактивна. В compacted topic'ах и топиках с транзакциями offset'ы идут с пропусками (удалённые ключи, commit-маркеры), поэтому полагаться на «offset + 1 всегда существует» нельзя.

## Что такое producer?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-producer
tags: kafka
```

Producer — клиент, который публикует записи в topic. Он сам решает, в какую партицию отправить запись, копит записи в батчи и отправляет их напрямую leader-брокеру нужной партиции.

**Путь сообщения:** сериализация key/value → выбор партиции → буфер в памяти (батч на партицию) → отправка по `linger.ms` или заполнению батча → ответ брокера по правилу `acks` → delivery report (или ошибка после исчерпания ретраев).

```csharp
var config = new ProducerConfig
{
    BootstrapServers = "localhost:9092",
    Acks = Acks.All,
    EnableIdempotence = true,
    LingerMs = 5,
    CompressionType = CompressionType.Lz4
};

using var producer = new ProducerBuilder<string, string>(config).Build();

var result = await producer.ProduceAsync("orders",
    new Message<string, string> { Key = order.Id, Value = json });
// result.Status == PersistenceStatus.Persisted, result.Offset
```

**Ключевые настройки:**

| Настройка | Что делает |
| --- | --- |
| `acks` | сколько реплик должно подтвердить запись: `0`, `1`, `all` |
| `enable.idempotence` | брокер отбрасывает дубли от ретраев и сохраняет порядок |
| `linger.ms`, `batch.size` | компромисс задержки и пропускной способности |
| `compression.type` | `lz4`/`zstd`/`snappy`/`gzip`, сжимается батч целиком |
| `delivery.timeout.ms` (Java) / `message.timeout.ms` (librdkafka) | сколько всего пытаться доставить сообщение |

Про дефолты: в Java-клиенте с Kafka 3.0 по умолчанию `acks=all` и `enable.idempotence=true`. В librdkafka (а значит, в Confluent.Kafka) `acks` по умолчанию тоже `all`, но `enable.idempotence` по умолчанию `false` — его надо включать явно.

**Практические моменты:**

- Producer потокобезопасен и дорог в создании — один экземпляр на приложение (singleton в DI).
- `await ProduceAsync` на каждое сообщение в цикле убивает пропускную способность: батч не успевает набраться. Для потока используют `Produce` с callback'ом или пачки задач.
- Перед остановкой — `Flush(timeout)`, иначе сообщения из буфера пропадут.
- Ошибка доставки приходит асинхронно — её обязательно обрабатывают, а не делают «fire and forget».

## Что такое consumer?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-consumer
tags: kafka
```

Consumer — клиент, который читает записи из партиций topic'а и сам управляет своей позицией (offset). Kafka ничего не «проталкивает»: consumer в цикле делает poll, получает пачку записей и после обработки фиксирует прогресс commit'ом.

```csharp
var config = new ConsumerConfig
{
    BootstrapServers = "localhost:9092",
    GroupId = "billing",
    AutoOffsetReset = AutoOffsetReset.Earliest,
    EnableAutoCommit = true,
    EnableAutoOffsetStore = false   // offset помечаем сами, после обработки
};

using var consumer = new ConsumerBuilder<string, string>(config).Build();
consumer.Subscribe("orders");

while (!ct.IsCancellationRequested)
{
    var cr = consumer.Consume(ct);
    await HandleAsync(cr.Message);
    consumer.StoreOffset(cr);        // закоммитится фоновым auto commit
}
consumer.Close();                    // корректно покидает группу
```

**Pull-модель и её следствия:**

- consumer сам регулирует скорость — backpressure получается естественно;
- данные можно перечитать, сдвинув offset (`Seek`);
- брокер не отслеживает каждое сообщение — только committed offset группы.

**Два режима:**

- `Subscribe` — работа в consumer group: партиции назначаются автоматически, есть rebalance;
- `Assign` — ручное назначение конкретных партиций без группового управления (утилиты, реплей).

**Жизненно важные таймауты:**

| Настройка | Смысл |
| --- | --- |
| `session.timeout.ms` (45 с в современных клиентах) | нет heartbeat'ов — consumer считается мёртвым |
| `heartbeat.interval.ms` (3 с) | частота heartbeat'ов из фонового потока |
| `max.poll.interval.ms` (5 мин) | максимум между вызовами poll/Consume; превысил — выкинут из группы |

**Типичные грабли:**

- Долгая обработка внутри цикла → превышение `max.poll.interval.ms` → rebalance → повторная обработка.
- Consumer не потокобезопасен: `Consume`, `Commit`, `StoreOffset` вызываются из одного потока.
- Без `Close()` при остановке группа ждёт `session.timeout.ms`, прежде чем отдать партиции другим.

## Что такое consumer group?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-consumer-group
tags: kafka
```

Consumer group — набор consumer'ов с одинаковым `group.id`, которые совместно читают topic: каждая партиция в группе назначается ровно одному участнику. Так Kafka делит нагрузку внутри сервиса и одновременно позволяет разным сервисам читать один topic независимо.

**Две модели в одном механизме:**

- **Очередь (competing consumers)** — экземпляры одного сервиса в одной группе делят партиции между собой.
- **Pub/Sub** — разные сервисы в разных группах: каждая группа получает все сообщения topic'а и хранит свои offset'ы.

```text
topic orders: P0 P1 P2 P3

group billing:        c1 <- P0,P1    c2 <- P2,P3
group notifications:  n1 <- P0,P1,P2,P3
```

**Кто управляет группой.** Один из брокеров — **group coordinator** (выбирается по hash от `group.id` → партиция `__consumer_offsets`). Он принимает heartbeat'ы, запускает rebalance и хранит committed offset'ы. В классическом протоколе план распределения считает consumer-лидер группы; в новом протоколе (KIP-848, GA в Kafka 4.0, `group.protocol=consumer`) распределение считает сам брокер.

**Что важно знать:**

- Параллелизм группы ограничен числом партиций: лишние consumer'ы простаивают.
- Offset'ы привязаны к группе. Новая группа начинает с позиции по `auto.offset.reset`.
- Изменение состава группы (деплой, падение, масштабирование) вызывает rebalance.
- Смена `group.id` — это «новый подписчик»: он либо перечитает всё (`earliest`), либо пропустит историю (`latest`).

**Мониторинг:**

```bash
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing
# TOPIC PARTITION CURRENT-OFFSET LOG-END-OFFSET LAG CONSUMER-ID HOST
```

**Частая ошибка:** считать, что два consumer'а одной группы могут параллельно читать одну партицию. В классических consumer group'ах — нет. Совместное чтение одной партиции появилось только в share groups (KIP-932, «Queues for Kafka»), и это отдельный тип группы без гарантии порядка.

## Как consumer group распределяет partitions?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-consumer-group-raspredelyaet-partitions
tags: partitioning, kafka
```

Распределение партиций делает **assignor** — стратегия, выбранная через `partition.assignment.strategy`. В классическом протоколе coordinator-брокер собирает участников, один consumer становится лидером группы, считает план выбранным assignor'ом и отправляет его остальным через coordinator.

**Классический протокол по шагам:**

1. Consumer'ы шлют `JoinGroup` coordinator'у со списком подписок и поддерживаемых стратегий.
2. Coordinator выбирает общую стратегию и назначает лидера.
3. Лидер считает распределение и отдаёт его в `SyncGroup`.
4. Каждый участник получает свои партиции и начинает читать с committed offset'ов.

**Стратегии:**

| Assignor | Как делит | Особенности |
| --- | --- | --- |
| `range` | по каждому topic'у отдельно: партиции подряд кусками | при нескольких topic'ах первые consumer'ы получают больше; зато одинаковые номера партиций разных topic'ов у одного consumer'а (co-partitioning) |
| `roundrobin` | все партиции всех topic'ов по кругу | ровнее, но при rebalance всё перетасовывается |
| `sticky` | ровно и с минимумом перемещений | протокол eager: на время rebalance всё равно отзываются все партиции |
| `cooperative-sticky` | как sticky, но инкрементально | отзываются только перемещаемые партиции, остальные продолжают работать |

Дефолты различаются: в Java-клиенте с 3.0 — `[RangeAssignor, CooperativeStickyAssignor]`, в librdkafka/Confluent.Kafka — `range,roundrobin`.

```csharp
var config = new ConsumerConfig
{
    GroupId = "billing",
    PartitionAssignmentStrategy = PartitionAssignmentStrategy.CooperativeSticky,
    GroupInstanceId = Environment.GetEnvironmentVariable("POD_NAME") // static membership
};
```

**Новый протокол (KIP-848, GA в Kafka 4.0).** Включается `group.protocol=consumer`. Распределение считает брокер (серверные assignor'ы `uniform` и `range`), rebalance инкрементальный и без глобального барьера синхронизации, изменения участники получают через heartbeat.

**Что спрашивают дальше:**

- У всех участников должна быть общая стратегия, поэтому переход с eager на cooperative делают двумя rolling-деплоями.
- Static membership (`group.instance.id`) позволяет перезапустить pod без rebalance, если он вернулся в пределах `session.timeout.ms`.
- При одном topic'е `range` и `roundrobin` дают похожий результат; разница видна на подписке на несколько topic'ов.

## Что произойдёт, если consumers больше, чем partitions?

```yaml
category: kafka
level: middle
difficulty: 4
slug: kafka-chto-proizoidet-esli-consumers-bolshe-chem-partitions
tags: partitioning, kafka
```

Лишние consumer'ы останутся без партиций и будут простаивать: в классической consumer group одну партицию читает не больше одного участника. При 6 партициях и 8 экземплярах сервиса двое ничего не читают, а пропускная способность группы та же, что и при 6.

```text
topic orders: 4 партиции, группа из 6 consumer'ов

c1 <- P0   c2 <- P1   c3 <- P2   c4 <- P3   c5 <- -   c6 <- -
```

**Почему так устроено.** Порядок в Kafka гарантирован внутри партиции. Если бы партицию читали двое параллельно, порядок и простая модель «один committed offset на партицию» развалились бы.

**Есть ли от простаивающих польза:**

- они — горячий резерв: при падении активного consumer'а rebalance отдаст его партиции свободному без ожидания нового pod'а;
- но каждый участник всё равно держит соединения, шлёт heartbeat'ы и участвует в каждом rebalance, то есть делает его дольше.

**Практические последствия:**

- Автоскейлинг по lag'у (KEDA и т.п.) должен ограничивать максимум реплик числом партиций — выше масштабироваться бессмысленно.
- Если одна группа подписана на несколько topic'ов, считать нужно по сумме партиций и по выбранному assignor'у: `range` делит каждый topic отдельно, поэтому при topic'ах с малым числом партиций часть consumer'ов может простаивать, даже если всего партиций много.
- Разные consumer group'ы друг другу не мешают: ограничение действует внутри группы.

**Что делать, если нужно больше параллелизма:**

1. Увеличить число партиций (с учётом того, что поменяется распределение ключей).
2. Распараллелить обработку внутри consumer'а: один поток читает, обработка идёт в пуле воркеров с сохранением порядка по ключу (как в Confluent Parallel Consumer).
3. Ускорить саму обработку: батчевые записи в БД, меньше синхронных сетевых вызовов.
4. Для задач без требований к порядку — share groups (KIP-932, «Queues for Kafka» в Kafka 4.x), где несколько участников читают одну партицию с поштучным подтверждением.

**Что проверяют интервьюеры:** понимаешь ли ты, что «добавить подов» не лечит lag после определённого предела, и знаешь ли, где этот предел.

## Как Kafka обеспечивает порядок сообщений?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-kafka-obespechivaet-poryadok-soobschenii
tags: kafka
```

Kafka гарантирует порядок только внутри одной партиции: записи получают возрастающие offset'ы в порядке записи на leader'е, и consumer читает их строго по возрастанию. Чтобы связанные события шли по порядку, их отправляют с одинаковым ключом — тогда они попадают в одну партицию.

**Три условия, без которых порядок ломается:**

1. **На записи — один ключ для связанных событий.** `OrderCreated`, `OrderPaid`, `OrderShipped` с ключом `orderId` окажутся в одной партиции.
2. **Producer не переставляет записи при ретраях.** Если батч 1 упал с ошибкой, а батч 2 уже записан, ретрай батча 1 окажется после него. Это решает idempotent producer: брокер проверяет sequence number и не примет батч «вне очереди». Без идемпотентности порядок сохраняется только при `max.in.flight.requests.per.connection=1`.
3. **Consumer обрабатывает записи партиции последовательно.** Если после `Consume` раскидать сообщения по `Task.Run`, порядок исчезнет на стороне приложения.

```csharp
var producerConfig = new ProducerConfig
{
    BootstrapServers = "kafka:9092",
    EnableIdempotence = true,   // в librdkafka по умолчанию false
    Acks = Acks.All             // обязательно при идемпотентности
};

await producer.ProduceAsync("orders",
    new Message<string, string> { Key = order.Id.ToString(), Value = payload });
```

**Где порядок теряется незаметно:**

- **Увеличение числа партиций** — `hash(key) % N` меняется, новые события ключа уходят в другую партицию, пока старые ещё не дочитаны.
- **Ретраи через отдельный retry-topic** — упавшее событие обработается позже следующих за ним.
- **Несколько producer'ов на один ключ** — порядок между разными producer'ами Kafka не определяет, он задаётся тем, кто первым дошёл до leader'а.
- **Разные партиционеры** в Java- и .NET-producer'ах (murmur2 и CRC32) — один ключ в разных партициях.

**Что спрашивают дальше:** как сохранить порядок при параллельной обработке внутри consumer'а, и как быть, если порядок нужен глобально (ответ: одна партиция и отказ от масштабирования — или пересмотр требования, обычно порядок нужен только в пределах сущности).

## Гарантируется ли порядок сообщений во всём topic?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-garantiruetsya-li-poryadok-soobschenii-vo-vsem-topic
tags: kafka
```

Нет. Kafka гарантирует порядок только внутри одной партиции. Между партициями никакого общего порядка нет: сообщение, записанное в P1 позже, может быть прочитано раньше сообщения из P0, потому что партиции читаются разными consumer'ами или просто с разной скоростью.

**Почему нет глобального порядка.** Партиции — независимые логи, часто на разных брокерах, со своими leader'ами и своими offset'ами. Глобальный порядок потребовал бы единой точки сериализации всех записей, а это убило бы горизонтальное масштабирование — главное, ради чего партиции существуют.

**Варианты, если порядок нужен:**

| Требование | Решение | Цена |
| --- | --- | --- |
| Порядок событий одной сущности | ключ = id сущности | нет, это стандартный путь |
| Порядок внутри агрегата из нескольких сущностей | ключ = id агрегата (например, `accountId`, а не `transactionId`) | риск горячих ключей |
| Строгий порядок всего потока | topic с одной партицией | пропускная способность одного consumer'а, нет параллелизма |
| Порядок «по времени» между разными ключами | упорядочивание на стороне consumer'а по timestamp/sequence с буферизацией | задержка и сложность, окно ожидания |

**Практический вывод.** В большинстве систем «глобальный порядок» на самом деле не нужен — нужен порядок в рамках сущности. На собеседовании хороший ответ — уточнить, порядок *чего* именно нужен, и выбрать ключ партиционирования под это.

**Дополнительные тонкости:**

- Timestamp сообщения (`CreateTime` по умолчанию) задаёт producer, часы разных машин расходятся — сортировать по нему между партициями ненадёжно.
- Даже внутри партиции порядок сохраняется только при idempotent producer (или `max.in.flight.requests.per.connection=1`) и последовательной обработке на consumer'е.
- При увеличении числа партиций ключ может «переехать», и порядок по этому ключу временно нарушится.

## Что произойдёт, если consumer упал?

```yaml
category: kafka
level: middle
difficulty: 4
slug: kafka-chto-proizoidet-esli-consumer-upal
tags: kafka
```

Coordinator группы перестанет получать heartbeat'ы и через `session.timeout.ms` (по умолчанию 45 с в современных клиентах) исключит consumer'а из группы, после чего rebalance отдаст его партиции живым участникам. Они начнут читать с последнего **закоммиченного** offset'а, поэтому всё, что упавший consumer обработал, но не успел закоммитить, будет обработано повторно.

**Хронология:**

```text
t0   consumer обработал offset'ы 100..150, закоммичен 120
t0   процесс убит (OOM, kill -9)
t0+45s  coordinator: session timeout -> rebalance
     партиция уходит другому consumer'у -> читает с 120
     сообщения 120..150 обрабатываются второй раз
```

**От чего зависит время простоя партиции:**

| Сценарий | Когда группа узнает |
| --- | --- |
| Корректная остановка с `Close()` | сразу: consumer шлёт LeaveGroup |
| Падение процесса / сети | через `session.timeout.ms` |
| Процесс жив, но завис в обработке | через `max.poll.interval.ms` (по умолчанию 5 мин) — heartbeat'ы идут из фонового потока, но при превышении интервала между poll'ами consumer сам покидает группу |
| Static membership (`group.instance.id`) | rebalance не запускается, пока не истёк `session.timeout.ms`; вернувшийся под тем же id consumer получает свои партиции обратно |

**Что из этого следует для кода:**

- **Обработка должна быть идемпотентной** — повторы после падения неизбежны при at-least-once.
- **Коммитить после обработки**, а не до, иначе необработанные сообщения потеряются.
- **Корректный shutdown**: по `SIGTERM` дать текущему сообщению завершиться, закоммитить offset и вызвать `consumer.Close()`. В ASP.NET Core — через `CancellationToken` в `BackgroundService` и достаточный `HostOptions.ShutdownTimeout`.
- Слишком маленький `session.timeout.ms` ускоряет обнаружение, но на GC-паузах и сетевых всплесках даёт ложные rebalance.

**Сами данные не теряются** — они лежат в брокере до retention. Потеряться может только прогресс: если consumer лежал дольше retention и сохранённый offset уже удалён, сработает `auto.offset.reset`, и при `latest` часть сообщений будет пропущена.

## Что такое consumer rebalance?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-consumer-rebalance
tags: kafka
```

Consumer rebalance — перераспределение партиций между участниками consumer group, когда меняется её состав или подписка. Во время rebalance часть или все партиции временно не читаются, а после него каждая партиция продолжает читаться с committed offset'а уже новым владельцем.

**Что запускает rebalance:**

- consumer присоединился (новый pod, scale-up);
- consumer ушёл корректно (`Close()`) или по таймауту (`session.timeout.ms`, `max.poll.interval.ms`);
- в подписанном topic'е добавились партиции;
- подписка по regex начала охватывать новый topic.

**Eager и cooperative:**

| | Eager (`range`, `roundrobin`, `sticky`) | Cooperative (`cooperative-sticky`) |
| --- | --- | --- |
| Что отзывается | все партиции у всех участников | только те, что переезжают |
| Простой | вся группа стоит до конца rebalance | остальные партиции продолжают читаться |
| Число раундов | один | два (сначала отзыв, потом назначение) |

С Kafka 4.0 доступен новый протокол групп (KIP-848, `group.protocol=consumer`): распределение считает брокер, rebalance инкрементальный и не требует синхронизации всех участников.

**Как узнать в .NET-коде:**

```csharp
var consumer = new ConsumerBuilder<string, string>(config)
    .SetPartitionsAssignedHandler((c, parts) => log.LogInformation("assigned {P}", parts))
    .SetPartitionsRevokedHandler((c, parts) =>
    {
        // последний шанс закоммитить обработанное по этим партициям
        c.Commit();
    })
    .SetPartitionsLostHandler((c, parts) => log.LogWarning("lost {P}", parts))
    .Build();
```

`Revoked` — партиции забирают штатно, коммит ещё возможен. `Lost` — consumer уже выкинут из группы, коммитить поздно, партиции, скорее всего, у другого участника.

**Почему это важно:**

- Частые rebalance'ы («rebalance storm») — типичная причина роста lag'а: при eager-протоколе группа почти не читает.
- После rebalance возможны дубли: новый владелец начнёт с committed offset'а.
- Rolling-деплой из N pod'ов без static membership даёт до 2N rebalance'ов.

**Как уменьшить влияние:** cooperative-sticky или KIP-848, static membership (`group.instance.id`), разумные таймауты, быстрая обработка без выхода за `max.poll.interval.ms`, корректный `Close()` при остановке.

## Что такое offset commit?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-offset-commit
tags: kafka
```

Offset commit — сохранение consumer group'ой позиции «докуда обработано» для каждой партиции. Коммит записывается во внутренний topic `__consumer_offsets`, и после рестарта или rebalance чтение продолжается с этой позиции.

**Что именно коммитится.** Offset *следующего* сообщения, которое нужно прочитать. Обработали запись с offset 41 — коммитим 42. В Confluent.Kafka `consumer.Commit(consumeResult)` и `StoreOffset(consumeResult)` прибавляют единицу сами.

**Способы:**

| Способ | Как | Особенности |
| --- | --- | --- |
| Auto commit | `enable.auto.commit=true`, раз в `auto.commit.interval.ms` (по умолчанию 5 с) | просто, но коммитит «по таймеру», а не по факту обработки |
| Auto commit + ручной store (librdkafka) | `EnableAutoOffsetStore=false` + `StoreOffset(cr)` после обработки | фон коммитит только то, что приложение пометило обработанным |
| Синхронный ручной | `consumer.Commit(cr)` | точный контроль, но блокирующий сетевой вызов |
| Асинхронный ручной (Java) | `commitAsync` | быстро, но ошибки и порядок коммитов на совести приложения |
| В транзакции | `SendOffsetsToTransaction` | offset'ы фиксируются атомарно с записью в выходной topic |

```csharp
var cr = consumer.Consume(ct);
await ProcessAsync(cr.Message);
consumer.Commit(cr);   // коммит после успешной обработки = at-least-once
```

**Момент коммита определяет семантику:**

- коммит **до** обработки → at-most-once (упали — сообщение потеряно);
- коммит **после** обработки → at-least-once (упали — сообщение обработают повторно).

**Нюансы:**

- Коммит на каждое сообщение — лишняя нагрузка на брокер и задержка. Обычно коммитят пачкой или по таймеру через offset store.
- Коммит offset'а N означает «всё до N обработано». Если сообщения обрабатываются параллельно, нельзя коммитить offset сообщения, пока не завершены все предыдущие.
- Offset'ы неактивной группы удаляются через `offsets.retention.minutes` (по умолчанию 7 дней) — после долгого простоя группа стартует по `auto.offset.reset`.
- Коммит из обработчика `Lost` уже невозможен — партиции у другого участника.

## Auto commit vs manual commit?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-auto-commit-vs-manual-commit
```

Auto commit фиксирует offset'ы по таймеру в фоне, manual commit — когда приложение явно решило, что сообщение обработано. Auto commit проще, но не знает о результате обработки, поэтому может как потерять сообщения, так и дать дубли; manual commit даёт предсказуемую at-least-once семантику ценой кода и лишних вызовов.

**Как работает auto commit.** При `enable.auto.commit=true` клиент раз в `auto.commit.interval.ms` (по умолчанию 5000 мс) коммитит текущую позицию. В Java-клиенте это происходит внутри `poll()`, коммитится позиция уже выданных записей. В librdkafka коммит делает фоновый поток, а коммитятся offset'ы из **offset store**, куда по умолчанию (`enable.auto.offset.store=true`) offset попадает сразу при выдаче сообщения приложению.

**Риски auto commit «как есть»:**

- **Потеря.** Сообщение выдано, offset попал в store, таймер закоммитил, а обработка ещё идёт или упала — после рестарта сообщение не вернётся. Особенно опасно при асинхронной обработке в фоне.
- **Дубли.** Обработали 4 секунды сообщений, упали до очередного коммита — всё это прочитают снова.

**Рекомендуемый паттерн в Confluent.Kafka** — auto commit, но с ручным store:

```csharp
var config = new ConsumerConfig
{
    GroupId = "billing",
    EnableAutoCommit = true,        // фоновые коммиты раз в 5 с
    EnableAutoOffsetStore = false   // но только того, что мы пометили
};

var cr = consumer.Consume(ct);
await HandleAsync(cr.Message);
consumer.StoreOffset(cr);           // «обработано» — теперь можно коммитить
```

Получается at-least-once без синхронного сетевого вызова на каждое сообщение.

**Полностью ручной коммит:**

```csharp
config.EnableAutoCommit = false;
// ...
if (++processed % 100 == 0) consumer.Commit();   // коммит сохранённых позиций
```

**Сравнение:**

| | Auto commit | Manual commit |
| --- | --- | --- |
| Код | минимум | явные вызовы, обработка ошибок коммита |
| Семантика | неопределённая: и потери, и дубли | at-least-once (коммит после обработки) |
| Нагрузка на брокер | низкая, по таймеру | зависит от частоты; поштучно — дорого |
| Rebalance | коммитит при отзыве партиций | нужно коммитить в `PartitionsRevoked` |

**Что спрашивают дальше:** почему даже ручной коммит не даёт exactly-once (падение между обработкой и коммитом), и как это закрывают — идемпотентной обработкой или хранением offset'а в той же транзакции БД, что и результат.

## Что такое at-most-once delivery?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-at-most-once-delivery
tags: idempotency
```

At-most-once — гарантия «не больше одного раза»: сообщение будет обработано один раз или не будет обработано вообще. Дублей нет, но потери допустимы.

**Как получается в Kafka.**

На стороне consumer'а — offset коммитится **до** обработки:

```csharp
var cr = consumer.Consume(ct);
consumer.Commit(cr);        // сначала фиксируем прогресс
await HandleAsync(cr);      // упали здесь — сообщение уже «прочитано» и не вернётся
```

На стороне producer'а — отправка без подтверждений и ретраев:

```csharp
var config = new ProducerConfig
{
    Acks = Acks.None,              // acks=0: не ждём ответа брокера
    MessageSendMaxRetries = 0      // не повторяем
};
```

При `acks=0` producer не знает, дошло ли сообщение: упал брокер или сеть — запись просто пропала.

Ещё один неявный путь к at-most-once — auto commit с асинхронной обработкой: offset уже закоммичен таймером, а обработка в фоне ещё не закончилась или упала.

**Когда это осознанный выбор:**

- телеметрия, метрики, логи с высокой частотой, где потеря доли процента не важна;
- данные, которые быстро устаревают (позиция на карте, котировка «сейчас»), — повторно обработанное старое значение хуже пропущенного;
- максимальная пропускная способность и минимальная задержка важнее полноты.

**Когда недопустимо:** платежи, заказы, изменения состояния, всё, что нельзя восстановить из следующего сообщения.

**Сравнение с остальными семантиками:**

| Семантика | Потери | Дубли | Как |
| --- | --- | --- | --- |
| at-most-once | возможны | нет | commit до обработки, `acks=0` |
| at-least-once | нет | возможны | commit после обработки, `acks=all` + ретраи |
| exactly-once | нет | нет (в рамках Kafka) | идемпотентный producer + транзакции |

На собеседовании полезно подчеркнуть: at-most-once — это не «плохая» семантика, а компромисс, который выбирают явно, а не получают случайно из-за неправильного места коммита.

## Что такое at-least-once delivery?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-at-least-once-delivery
tags: idempotency
```

At-least-once — гарантия «хотя бы один раз»: сообщение не потеряется, но может быть доставлено и обработано повторно. Это самая распространённая семантика в Kafka-системах, а дубли компенсируют идемпотентной обработкой.

**Что для неё нужно с двух сторон.**

Producer — запись подтверждена репликами и повторяется при ошибке:

```csharp
var producerConfig = new ProducerConfig
{
    Acks = Acks.All,            // ждём ISR
    EnableIdempotence = true    // ретраи без дублей в логе (в librdkafka по умолчанию false)
};
```

Плюс topic с `replication.factor=3` и `min.insync.replicas=2`, и обработка ошибки доставки в коде — не игнорировать delivery report.

Consumer — коммит **после** успешной обработки:

```csharp
var cr = consumer.Consume(ct);
await HandleAsync(cr.Message);   // сначала обработали
consumer.StoreOffset(cr);        // потом пометили (EnableAutoOffsetStore = false)
```

**Откуда берутся дубли:**

| Где | Сценарий |
| --- | --- |
| Producer | запись прошла, но ответ потерялся по сети → ретрай. Idempotent producer это устраняет внутри одной сессии producer'а |
| Producer (уровень приложения) | сервис упал после отправки, но до отметки «отправлено» в своей БД → повторная отправка при рестарте (outbox-релей) |
| Consumer | обработал, упал до коммита → следующий владелец партиции прочитает снова |
| Rebalance | партиция переехала, а последний пакет offset'ов не закоммичен |

**Как с этим жить:** consumer должен быть идемпотентным — повторная обработка того же сообщения не меняет результат. Типичные приёмы: таблица обработанных `messageId` с уникальным индексом, upsert вместо insert, проверка версии сущности, естественные идемпотентные операции («установить статус Paid» вместо «прибавить 100 к балансу»).

**Частая ошибка.** Включить `acks=all`, но забыть, что при `min.insync.replicas=1` запись подтверждается одной репликой, — формально at-least-once, а при падении этого брокера сообщение пропадает. Гарантия складывается из настроек producer'а, topic'а и места коммита на consumer'е, и слабое звено определяет итог.

## Что такое exactly-once?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-exactly-once
tags: idempotency
```

Exactly-once — гарантия, что результат обработки каждого сообщения учтён ровно один раз: без потерь и без дублей. В Kafka она достижима в пределах самой Kafka (read-process-write из topic'а в topic) за счёт идемпотентного producer'а и транзакций; для внешних систем её приходится строить самому.

**Из чего состоит EOS в Kafka:**

1. **Idempotent producer** — брокер отбрасывает дубли батчей по (producer id, epoch, sequence number). Убирает дубли от сетевых ретраев.
2. **Transactions** — producer с `transactional.id` атомарно пишет в несколько партиций и фиксирует offset'ы consumer'а через `SendOffsetsToTransaction`. Либо видно всё, либо ничего.
3. **`isolation.level=read_committed`** у читателей — они не видят записи незавершённых и отменённых транзакций. В Java-клиенте по умолчанию `read_uncommitted`, в librdkafka — `read_committed`.

```csharp
producer.InitTransactions(TimeSpan.FromSeconds(10));
producer.BeginTransaction();
producer.Produce("payments-out", new Message<string, string> { Key = k, Value = v });
producer.SendOffsetsToTransaction(
    new[] { new TopicPartitionOffset(cr.TopicPartition, cr.Offset + 1) },
    consumer.ConsumerGroupMetadata, TimeSpan.FromSeconds(10));
producer.CommitTransaction();
```

Kafka Streams включает это одной настройкой `processing.guarantee=exactly_once_v2`.

**Что exactly-once НЕ означает:**

- что код обработчика выполнится один раз — при сбое транзакция отменится и обработка повторится; «ровно один раз» относится к видимому результату в Kafka;
- что запись в PostgreSQL, HTTP-вызов или письмо будут выполнены один раз — они вне транзакции Kafka;
- что consumer, читающий в `read_uncommitted`, не увидит отменённых данных.

**Для внешних систем** exactly-once эмулируют: at-least-once + идемпотентный приёмник, либо хранение offset'а в той же транзакции БД, что и результат (тогда при старте consumer делает `Seek` к сохранённому offset'у).

**Цена:** дополнительные round-trip'ы к transaction coordinator'у, задержка чтения до коммита транзакции, более сложная обработка ошибок (`ProducerFencedException`, abort). Поэтому EOS используют там, где конвейер целиком живёт в Kafka, а в остальных случаях чаще выбирают at-least-once с идемпотентностью.

## Почему в реальных системах часто используют at-least-once?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-pochemu-v-realnyh-sistemah-chasto-ispolzuyut-at-least-once
tags: idempotency
```

Потому что at-least-once дёшев и надёжен, а exactly-once Kafka покрывает только путь «Kafka → Kafka». Как только обработка затрагивает базу данных, внешний API или почту, транзакции Kafka уже не помогают, и честное решение — не терять сообщения, а дубли гасить идемпотентной обработкой.

**Почему не at-most-once.** Потеря заказа или платежа обычно недопустима, а восстановить её постфактум сложнее, чем отбросить дубль.

**Почему не exactly-once:**

- **Границы транзакции.** Транзакция Kafka атомарно фиксирует записи в topic'и и offset'ы, но не `INSERT` в PostgreSQL и не `POST` в платёжный шлюз. Сбой между ними даёт тот же дубль или ту же потерю.
- **Стоимость.** Транзакции добавляют вызовы к coordinator'у, маркеры в лог, задержку для `read_committed`-читателей (они ждут коммита транзакции), усложняют обработку ошибок и управление `transactional.id`.
- **Операционная сложность.** Зависшие транзакции блокируют last stable offset и тормозят всех `read_committed`-читателей партиции.
- **Всё равно нужна идемпотентность.** Повторная доставка может прийти не только из Kafka: ретраи HTTP-клиента, повторный запуск джоба, ручной реплей топика.

**Как выглядит типичная связка:**

| Слой | Решение |
| --- | --- |
| Запись из сервиса | Transactional Outbox: событие пишется в таблицу в той же транзакции БД, релей публикует в Kafka |
| Producer | `acks=all`, `enable.idempotence=true`, ретраи |
| Topic | `replication.factor=3`, `min.insync.replicas=2` |
| Consumer | коммит после обработки |
| Обработчик | дедупликация по `messageId` / бизнес-ключу, upsert, версии сущностей |

**Итоговая формула:** *at-least-once + idempotent consumer = effectively-once*. Результат такой же, как при exactly-once, но механизм понятнее, работает с любыми приёмниками и не зависит от специфики брокера.

**Что спрашивают дальше:** как конкретно сделать обработчик идемпотентным, где хранить ключи дедупликации и сколько, что делать, если операция по природе не идемпотентна (списание денег — через уникальный идентификатор операции на стороне приёмника).

## Что такое idempotent consumer?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-idempotent-consumer
tags: kafka, idempotency
```

Idempotent consumer — обработчик, для которого повторная обработка того же сообщения не меняет итоговое состояние системы. Он нужен потому, что Kafka при at-least-once неизбежно иногда доставляет сообщения повторно: после падения до коммита, после rebalance, после реплея.

**Идемпотентность — свойство эффекта, а не кода.** Код может выполниться дважды, но результат должен быть как после одного выполнения.

| Операция | Идемпотентна? |
| --- | --- |
| `UPDATE orders SET status = 'Paid' WHERE id = @id` | да |
| `INSERT ... ON CONFLICT (id) DO NOTHING` | да |
| `UPDATE accounts SET balance = balance + 100` | нет |
| отправить письмо / вызвать платёжный API | нет, если приёмник не поддерживает idempotency key |

**Основные приёмы:**

- **Журнал обработанных сообщений** (inbox / processed messages): таблица с уникальным ключом `message_id`, вставка в той же транзакции, что и бизнес-изменение. Конфликт по ключу — дубль, пропускаем.
- **Естественная идемпотентность** — формулировать изменения как «установить значение», а не «изменить на дельту».
- **Версии и последовательности** — событие несёт `version`, применяем только если `version > current`. Заодно защищает от переупорядочивания.
- **Idempotency key для внешних вызовов** — передаём `messageId` в платёжный шлюз или сервис, который сам отсекает повторы.

**Откуда брать ключ.** Лучше всего — стабильный `eventId`, который producer кладёт в заголовок или payload при создании события. Координаты `topic/partition/offset` тоже уникальны, но только пока сообщение не переопубликовано: реплей в другой topic или повторная отправка из outbox'а даст новый offset при том же смысле.

**Отличие от idempotent producer.** Idempotent producer (`enable.idempotence=true`) убирает дубли, возникающие при ретраях отправки, внутри брокера. Он не спасает от повторной обработки на стороне consumer'а и от повторной отправки приложением после рестарта. Это разные уровни, и обычно нужны оба.

**Типичные ошибки:** проверка «уже обработано?» и запись результата в разных транзакциях (гонка между двумя экземплярами), хранение ключей дедупликации только в памяти, бессрочная таблица обработанных id без очистки.

## Как сделать обработку Kafka message идемпотентной?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-sdelat-obrabotku-kafka-message-idempotentnoi
tags: kafka, idempotency
```

Нужно, чтобы повторная обработка того же события не меняла результат. Надёжнее всего — фиксировать факт обработки (id сообщения) атомарно с бизнес-изменением в одной транзакции БД, опираясь на уникальный индекс, а там, где возможно, формулировать операции как естественно идемпотентные.

**Шаг 1. Стабильный идентификатор события.** Producer генерирует `eventId` (GUID/ULID) при создании события и передаёт в заголовке. При реплее или переотправке из outbox'а id остаётся тем же — в отличие от offset'а.

```csharp
var msg = new Message<string, string>
{
    Key = order.Id.ToString(),
    Value = json,
    Headers = new Headers { { "event-id", Encoding.UTF8.GetBytes(evt.Id.ToString()) } }
};
```

**Шаг 2. Inbox-таблица + бизнес-изменение в одной транзакции:**

```sql
CREATE TABLE processed_messages (
    consumer    text        NOT NULL,
    message_id  uuid        NOT NULL,
    processed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (consumer, message_id)
);
```

```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);

var inserted = await db.Database.ExecuteSqlInterpolatedAsync(
    $"INSERT INTO processed_messages (consumer, message_id) VALUES ('billing', {eventId}) ON CONFLICT DO NOTHING", ct);

if (inserted == 1)
{
    await ApplyBusinessChangeAsync(evt, ct);
    await db.SaveChangesAsync(ct);
}
await tx.CommitAsync(ct);
consumer.StoreOffset(cr);   // коммит offset'а — после коммита БД
```

Уникальный ключ закрывает гонку: даже если два экземпляра параллельно обрабатывают одно сообщение (например, во время rebalance), второй получит конфликт, а не двойное списание.

**Шаг 3. Там, где можно, — идемпотентные операции без журнала:**

- upsert по бизнес-ключу (`INSERT ... ON CONFLICT (order_id) DO UPDATE`);
- «установить статус», а не «переключить»;
- оптимистичная проверка версии: `UPDATE ... WHERE id = @id AND version < @eventVersion`.

**Шаг 4. Внешние побочные эффекты.** Письма, платежи, вызовы API: передавать `eventId` как idempotency key приёмнику или записывать намерение в outbox, который сам отправляется ровно по одному разу на ключ.

**Что не забыть:**

- Очистка журнала: хранить id дольше, чем максимальное окно повторов (retention topic'а плюс запас), и удалять старые записи по `processed_at`.
- Дедупликация в памяти (кэш последних id) — только как оптимизация, не как гарантия: после рестарта кэш пуст.
- Если обработка не трогает БД (например, пишет в другой topic), идемпотентность дают транзакции Kafka.

## Что такое retry?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-retry
tags: resilience
```

Retry — повторная попытка выполнить операцию, которая завершилась временной ошибкой, в расчёте на то, что со следующей попытки она пройдёт. Ключевое слово — *временной*: повтор помогает от таймаута сети или недоступности сервиса, но бесполезен и вреден для ошибки валидации или бага в коде.

**Какие ошибки ретраить:**

| Transient (повторять) | Permanent (не повторять) |
| --- | --- |
| таймаут, обрыв соединения | ошибка десериализации |
| HTTP 503, 429, 502 | HTTP 400, 404, 422 |
| deadlock / serialization failure в БД | нарушение бизнес-правила |
| leader партиции переизбирается | сообщение не проходит валидацию схемы |

**Составляющие грамотного retry:**

- **Ограничение числа попыток** — иначе бесконечный цикл на неисправимой ошибке.
- **Задержка с экспоненциальным ростом** (100 мс, 200, 400...) — не добивать и так перегруженный сервис.
- **Jitter** — случайный разброс задержки, чтобы тысячи клиентов не ретраили синхронно.
- **Общий дедлайн** — сумма попыток не должна превышать таймаут вызывающей стороны.
- **Идемпотентность операции** — повтор после «таймаута, который на самом деле прошёл» не должен дублировать эффект.
- **Что делать после исчерпания** — DLQ, алерт, компенсация.

```csharp
// Polly v8 / Microsoft.Extensions.Resilience
var pipeline = new ResiliencePipelineBuilder()
    .AddRetry(new RetryStrategyOptions
    {
        MaxRetryAttempts = 3,
        BackoffType = DelayBackoffType.Exponential,
        UseJitter = true,
        Delay = TimeSpan.FromMilliseconds(200),
        ShouldHandle = new PredicateBuilder().Handle<HttpRequestException>().Handle<TimeoutException>()
    })
    .Build();

await pipeline.ExecuteAsync(async ct => await client.SendAsync(req, ct), ct);
```

**Retry в контексте Kafka** бывает на двух уровнях: producer ретраит отправку сам (`retries`/`message.send.max.retries` в пределах `delivery.timeout.ms`/`message.timeout.ms`), а для consumer'а встроенного retry обработки нет — его проектирует приложение: локальные повторы, retry-topic'и, DLQ.

**Опасности:** retry storm (ретраи многократно умножают нагрузку на упавший сервис — лечится circuit breaker'ом и ограничением попыток), неидемпотентные операции, длинные ретраи внутри consumer'а, которые блокируют партицию и выбивают его из группы по `max.poll.interval.ms`.

## Как реализовать retry для Kafka?

```yaml
category: kafka
level: middle
difficulty: 4
slug: kafka-kak-realizovat-retry-dlya-kafka
tags: kafka, resilience
```

В Kafka нет встроенного механизма повторной обработки для consumer'а: сообщение нельзя «вернуть в очередь», можно только не сдвигать offset или переопубликовать его. Поэтому retry строят в приложении, обычно в два уровня: короткие локальные повторы для кратких сбоев и отдельные retry-topic'и с задержкой для долгих, с DLT в конце цепочки.

**Уровень 1 — локальный retry в consumer'е.** Несколько быстрых попыток с backoff прямо в обработчике (Polly). Порядок сохраняется, но партиция стоит, пока идут попытки.

```csharp
var cr = consumer.Consume(ct);
try
{
    await retryPipeline.ExecuteAsync(ct2 => HandleAsync(cr.Message, ct2), ct); // 3 попытки, до ~2 с
}
catch (Exception ex) when (IsTransient(ex))
{
    await PublishToRetryAsync(cr, "orders.retry.1m", attempt: 1, ex);
}
catch (Exception ex)
{
    await PublishToDltAsync(cr, ex);            // permanent: сразу в DLT
}
consumer.StoreOffset(cr);                       // партиция идёт дальше
```

Ограничение: суммарное время попыток должно быть далеко от `max.poll.interval.ms`, иначе consumer выкинут из группы и сообщение обработается повторно другим экземпляром.

**Уровень 2 — retry-topic'и.**

```text
orders -> orders.retry.1m -> orders.retry.10m -> orders.dlt
```

- Сообщение копируется в следующий topic с заголовками: `attempt`, `original-topic`, `original-offset`, `error`, `not-before` (время, раньше которого не обрабатывать).
- Consumer retry-topic'а читает сообщение и, если `not-before` в будущем, ставит партицию на паузу (`consumer.Pause`) до нужного времени, затем `Seek` на то же сообщение и `Resume`. Ждать через `Thread.Sleep` нельзя — сработает `max.poll.interval.ms`.
- Внутри одного retry-topic'а задержка одинаковая, поэтому сообщения в нём и так идут в порядке «кто раньше должен выполниться» — достаточно ждать только голову партиции.

**Что обязательно продумать:**

| Вопрос | Решение |
| --- | --- |
| Порядок по ключу | retry-topic его ломает: следующее событие того же заказа обработается раньше упавшего. Если важно — при наличии ключа в retry пересылать и последующие события этого ключа, пока retry не завершится |
| Что ретраить | только transient-ошибки; ошибки десериализации и валидации — сразу в DLT |
| Идемпотентность | повторная обработка должна быть безопасной |
| Атомарность «переслал в retry + сдвинул offset» | at-least-once: сначала дождаться подтверждения записи в retry-topic, потом коммит; либо транзакция Kafka |
| Наблюдаемость | метрики по числу сообщений в каждом retry-topic'е и в DLT, алерты |

**Готовые решения.** В Java — Spring Kafka `@RetryableTopic`. В .NET встроенного нет: используют middleware KafkaFlow (retry-simple, retry-forever, retry-durable), MassTransit Rider или собственную реализацию по схеме выше.

**Что спрашивают дальше:** как сделать задержку, не блокируя основную партицию, и как не потерять порядок для ключа, у которого одно сообщение ушло в retry.

## Что такое Dead Letter Topic / Queue?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-dead-letter-topic-queue
tags: kafka, data-structures
```

Dead Letter Topic (в Kafka) или Dead Letter Queue (в RabbitMQ и облачных очередях) — отдельное место, куда отправляются сообщения, которые не удалось обработать после всех попыток или которые заведомо не обработать. DLT позволяет не блокировать основной поток и не терять проблемное сообщение: его можно разобрать, исправить и переобработать.

**Что туда попадает:**

- сообщения, которые не десериализуются (битый JSON, неизвестная версия схемы);
- нарушающие бизнес-валидацию;
- исчерпавшие лимит ретраев по временным ошибкам;
- вызывающие баг в обработчике (исключение на каждом повторе).

**Что класть вместе с сообщением.** Исходные key и value байт в байт (не пересериализованные), плюс заголовки:

```csharp
var headers = new Headers
{
    { "dlt-original-topic",     Encoding.UTF8.GetBytes(cr.Topic) },
    { "dlt-original-partition", Encoding.UTF8.GetBytes(cr.Partition.Value.ToString()) },
    { "dlt-original-offset",    Encoding.UTF8.GetBytes(cr.Offset.Value.ToString()) },
    { "dlt-exception",          Encoding.UTF8.GetBytes(ex.GetType().FullName!) },
    { "dlt-reason",             Encoding.UTF8.GetBytes(ex.Message) },
    { "dlt-failed-at",          Encoding.UTF8.GetBytes(DateTimeOffset.UtcNow.ToString("O")) }
};
await dltProducer.ProduceAsync("orders.dlt",
    new Message<byte[], byte[]> { Key = cr.Message.Key, Value = cr.Message.Value, Headers = headers });
```

Поэтому consumer удобно строить на `byte[]` с явной десериализацией внутри обработчика: так ошибку десериализации можно поймать и отправить сообщение в DLT как есть.

**Kafka vs RabbitMQ:**

| | Kafka | RabbitMQ |
| --- | --- | --- |
| Встроенная поддержка | нет в самом брокере; есть в Kafka Connect (`errors.deadletterqueue.topic.name`), Spring Kafka, KafkaFlow | есть: dead letter exchange (`x-dead-letter-exchange`) при reject/nack без requeue, TTL, превышении длины очереди, `x-delivery-limit` в quorum-очередях |
| Кто отправляет | приложение | брокер |

**Жизненный цикл DLT — важнее самого topic'а:**

- **Алерт** на появление сообщений: DLT, в который никто не смотрит, — это тихая потеря данных.
- **Инструмент разбора**: просмотр, фильтр по причине.
- **Redrive**: после исправления бага сообщения переотправляются в исходный topic; обработчик должен быть идемпотентным.
- **Retention** DLT делают больше основного, чтобы успеть разобраться.

**Подводный камень:** отправка в DLT нарушает порядок по ключу. Если после «мёртвого» `OrderCreated` пришёл `OrderPaid`, его обработка может сломаться или дать неконсистентное состояние — это нужно учитывать в дизайне.

## Что делать с poison message?

```yaml
category: kafka
level: middle
difficulty: 4
slug: kafka-chto-delat-s-poison-message
tags: kafka
```

Poison message — сообщение, обработка которого падает при каждой попытке: битые данные, несовместимая схема, значение, вызывающее баг. Его нужно распознать как неисправимое, убрать из основного потока (в DLT) с полной диагностикой и сдвинуть offset — иначе consumer будет вечно падать на одном и том же offset'е и вся партиция встанет.

**Почему в Kafka это особенно больно.** Consumer читает партицию строго по порядку и коммитит один offset. Если обработчик бросает исключение и приложение не коммитит offset (или процесс падает и рестартует), следующий запуск снова прочитает то же сообщение. Lag по партиции растёт, а соседние партиции работают — классический симптом «одна партиция не двигается».

**Как отличить poison от временной ошибки:**

| Признак | Poison | Transient |
| --- | --- | --- |
| Тип ошибки | десериализация, валидация, `NullReferenceException`, `FormatException` | таймаут, 503, недоступность БД |
| Поведение при повторе | всегда одинаково | может пройти |
| Затрагивает | одно сообщение | многие сообщения подряд |

**Стратегия обработки:**

1. **Десериализовывать внутри try.** Consumer на `byte[]`, десериализация в обработчике — тогда ошибку формата можно поймать. Если десериализатор встроен в `ConsumerBuilder`, Confluent.Kafka бросит `ConsumeException`, у которой в `ConsumerRecord` есть сырые байты и координаты — их тоже можно отправить в DLT.
2. **Классифицировать ошибку.** Permanent — сразу в DLT, без ретраев. Transient — ограниченные ретраи, затем retry-topic или DLT.
3. **Счётчик попыток.** Если по сообщению было N неудач — считать poison независимо от типа ошибки.
4. **Отправить в DLT и только потом сдвинуть offset.** Дождаться подтверждения записи в DLT, иначе сообщение потеряется.
5. **Алерт и разбор.** Причина, стек, исходные байты, координаты. После фикса — redrive в исходный topic.

**Чего не делать:**

- Пропускать сообщение молча (`catch { }` и коммит) — тихая потеря данных.
- Бесконечно ретраить — партиция стоит, lag растёт, а при превышении `max.poll.interval.ms` начинается карусель rebalance'ов.
- Отключать проблемный consumer целиком из-за одного сообщения.

**Особый случай — когда нарушать порядок нельзя.** Например, события одного счёта. Тогда вместо пропуска можно «отложить» весь ключ: poison-сообщение и все последующие сообщения этого ключа отправляются в DLT/parking-topic, пока инцидент не разобран, а другие ключи идут дальше. Либо осознанно остановить партицию и позвать человека — это тоже решение, если цена неконсистентности выше цены простоя.

**Профилактика:** Schema Registry с проверкой совместимости на producer'е, контрактные тесты, валидация на входе в систему.

## Как масштабировать Kafka consumers?

```yaml
category: kafka
level: middle
difficulty: 4
slug: kafka-kak-masshtabirovat-kafka-consumers
tags: kafka, scalability
```

Горизонтально — добавлением экземпляров в ту же consumer group, но только до числа партиций topic'а: дальше лишние consumer'ы простаивают. Когда этот предел достигнут, масштабируют либо число партиций, либо параллелизм и эффективность обработки внутри consumer'а.

**Сначала — где узкое место.** Масштабировать имеет смысл, только если consumer упирается в собственную обработку. Если он ждёт БД, внешний API или downstream-сервис, дополнительные экземпляры только увеличат нагрузку на этот ресурс.

**Варианты по порядку применения:**

| Способ | Когда помогает | Ограничения |
| --- | --- | --- |
| Больше экземпляров в группе | consumer'ов меньше, чем партиций | потолок — число партиций |
| Больше партиций | все партиции заняты, каждая упирается в один consumer | меняется распределение ключей, уменьшить нельзя |
| Параллелизм внутри consumer'а | обработка I/O-bound, ключей много | нужно сохранять порядок по ключу и аккуратно коммитить |
| Батчевая обработка | много мелких записей в БД | сложнее обработка ошибок по одному сообщению |
| Оптимизация fetch'а | много маленьких запросов к брокеру | `fetch.min.bytes`, `fetch.wait.max.ms`, `max.partition.fetch.bytes` |

**Параллелизм внутри consumer'а без потери порядка.** Один поток читает, сообщения раскладываются по воркерам по `hash(key) % N`: один ключ — всегда один воркер, поэтому порядок по ключу сохраняется. Offset партиции можно коммитить только до первого незавершённого сообщения. Это то, что делают Confluent Parallel Consumer (Java) и KafkaFlow (`WorkersCount` с распределением по ключу) в .NET.

**Автоскейлинг.** KEDA со scaler'ом `kafka` масштабирует Deployment по lag'у группы. Настройки, о которых спрашивают:

- `maxReplicaCount` не больше числа партиций;
- cooldown, чтобы не дёргать группу постоянными rebalance'ами;
- каждый scale-up/scale-down — это rebalance, поэтому cooperative-sticky или новый протокол групп (KIP-848) и static membership здесь особенно важны.

**Про число партиций заранее.** Раз их можно только добавлять и это ломает распределение ключей, число партиций закладывают с запасом под рост на год-два: например, 12 или 24, а не 3. Но не тысячи — каждая партиция стоит ресурсов брокеров и удлиняет rebalance.

**Типичные ошибки:** масштабировать pod'ы при горячем ключе (lag одной партиции не уменьшится), распараллеливать обработку через `Task.Run` без контроля порядка и коммитов, игнорировать downstream-ограничения.

## Что такое producer acknowledgement (`acks`)?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-producer-acknowledgement-acks
tags: kafka
```

`acks` — настройка producer'а, определяющая, сколько реплик партиции должны подтвердить запись, прежде чем брокер ответит producer'у успехом. Это главный рычаг компромисса между надёжностью и задержкой записи.

| Значение | Когда брокер отвечает | Риск |
| --- | --- | --- |
| `acks=0` | не отвечает вообще, producer считает запись успешной после отправки | потеря при любой ошибке, ретраи не работают |
| `acks=1` | когда leader записал в свой лог | потеря, если leader упал до репликации |
| `acks=all` (`-1`) | когда запись есть во всех репликах из ISR | потеря только при потере всех ISR; зависит от `min.insync.replicas` |

**Дефолты.** В Java-клиенте с Kafka 3.0 — `acks=all` (раньше было `1`). В librdkafka, а значит в Confluent.Kafka, `acks` по умолчанию тоже `all` (`-1`).

```csharp
var config = new ProducerConfig
{
    BootstrapServers = "kafka:9092",
    Acks = Acks.All,
    EnableIdempotence = true   // требует acks=all
};
```

**`acks=all` без `min.insync.replicas` — ловушка.** «Все ISR» может означать одну реплику, если остальные отстали и выпали из ISR. Поэтому `acks=all` работает в паре с настройкой topic'а или брокера `min.insync.replicas` (по умолчанию `1`). При `replication.factor=3` и `min.insync.replicas=2` запись подтверждается минимум двумя репликами, а если в ISR осталась одна, producer получит `NotEnoughReplicas` вместо тихого снижения надёжности.

**Влияние на задержку и пропускную способность.** `acks=all` добавляет время на репликацию: leader ждёт, пока follower'ы заберут данные. На практике разница с `acks=1` — единицы миллисекунд в пределах одного ДЦ, а пропускная способность держится за счёт батчей и нескольких in-flight запросов. Поэтому `acks=0/1` выбирают только для данных, потерю которых можно пережить: метрики, логи, клики.

**Что `acks` не гарантирует:**

- что запись fsync'нута на диск — Kafka по умолчанию полагается на репликацию и page cache, а не на fsync каждой записи;
- отсутствие дублей — от них защищает idempotent producer;
- доставку, если приложение не обработало ошибку из delivery report.

**Что спросят дальше:** что произойдёт при `acks=1` и падении leader'а, и как связаны `acks`, `min.insync.replicas` и `unclean.leader.election.enable`.

## Что такое replication factor?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-replication-factor
tags: replication
```

Replication factor — сколько копий каждой партиции хранит кластер: одна на leader'е и остальные на follower'ах, на разных брокерах. При `replication.factor=3` партиция переживает потерю двух брокеров без потери данных (при правильных настройках подтверждений) и потерю одного — без остановки записи.

**Как задаётся:**

```bash
kafka-topics.sh --bootstrap-server kafka:9092 --create --topic orders \
  --partitions 12 --replication-factor 3 --config min.insync.replicas=2
```

Дефолт для автосоздаваемых topic'ов — `default.replication.factor` брокера (по умолчанию `1`, поэтому полагаться на автосоздание в проде нельзя). Replication factor не может быть больше числа брокеров.

**Типичная конфигурация и что она выдерживает:**

| RF | `min.insync.replicas` | Потеря 1 брокера | Потеря 2 брокеров |
| --- | --- | --- | --- |
| 1 | 1 | партиции на нём недоступны, данные могут пропасть | — |
| 2 | 1 | запись работает, но в этот момент копия одна | возможна потеря |
| 3 | 2 | чтение и запись работают | запись с `acks=all` отклоняется, чтение идёт, данные целы на оставшейся реплике |

`RF=3, min.insync.replicas=2, acks=all` — стандарт для важных данных.

**Rack awareness.** Копии должны быть не просто на разных брокерах, а в разных стойках или зонах доступности. Для этого у брокеров задают `broker.rack`, и Kafka размещает реплики по разным rack'ам. Consumer может читать с ближайшей реплики (`client.rack` + `replica.selector.class` на брокере, KIP-392), экономя межзонный трафик.

**Стоимость:** в RF раз больше дискового пространства и межброкерного трафика на запись.

**Изменение RF у существующего topic'а** делается не через `--alter`, а переназначением реплик: `kafka-reassign-partitions.sh` с JSON-планом, где у каждой партиции указан новый список реплик. Это копирование данных — на больших topic'ах его ограничивают по скорости (`--throttle`).

**Чем репликация не является:** это не бэкап. Удаление topic'а, ошибочная запись или retention удаляют данные во всех репликах сразу. От логических ошибок защищают отдельные механизмы: MirrorMaker 2 в другой кластер, tiered storage, экспорт.

## Что такое leader и follower partition replicas?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-leader-i-follower-partition-replicas
tags: partitioning, replication
```

У каждой партиции одна реплика — **leader**, остальные — **follower'ы**. Все записи идут через leader'а, а follower'ы непрерывно копируют его лог, чтобы при падении leader'а один из них мог занять его место без потери подтверждённых данных.

**Роли:**

| | Leader | Follower |
| --- | --- | --- |
| Приём записей от producer'ов | да | нет |
| Отдача данных consumer'ам | да, по умолчанию | только если настроено чтение с ближайшей реплики (KIP-392) |
| Репликация | отдаёт данные follower'ам | сам делает fetch-запросы к leader'у, как consumer |

**Как работает репликация.** Follower'ы отправляют leader'у fetch-запросы с offset'ом, до которого у них есть данные. По этим offset'ам leader понимает, кто успевает (входит в ISR), и сдвигает **high watermark** — offset, до которого запись есть во всех ISR. Consumer'ы видят только записи ниже high watermark, поэтому они никогда не прочитают то, что может исчезнуть при смене leader'а.

**Кто назначает leader'а.** Controller кластера — в современной Kafka это кворум KRaft-контроллеров. При падении брокера controller выбирает нового leader'а для каждой затронутой партиции из её ISR и распространяет новые метаданные. Клиенты получают ошибку `NOT_LEADER_OR_FOLLOWER`, обновляют метаданные и переключаются на нового leader'а сами.

**Preferred leader.** Первая реплика в списке назначения считается предпочтительной. После восстановления брокера leadership возвращается к ней автоматически (`auto.leader.rebalance.enable=true` по умолчанию) или вручную через `kafka-leader-election.sh --election-type PREFERRED`. Это нужно, чтобы нагрузка не скапливалась на брокерах, переживших сбой.

**Unclean leader election.** Если все ISR-реплики недоступны, можно выбрать leader'ом отставшую реплику — партиция оживёт, но потеряет часть подтверждённых записей. По умолчанию `unclean.leader.election.enable=false`: Kafka предпочитает недоступность потере данных.

**Практические следствия:**

- Нагрузка брокера определяется числом партиций, где он leader, а не общим числом реплик.
- Отказ одного брокера из трёх при RF=3 для клиентов выглядит как кратковременные ретраи, а не как ошибка.
- Отставание follower'а видно по метрикам `UnderReplicatedPartitions` и размеру ISR.

## Что такое ISR?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-isr
tags: replication
```

ISR (in-sync replicas) — множество реплик партиции, которые успевают за leader'ом: leader входит в него всегда, а follower остаётся в ISR, пока дочитывает лог leader'а не дольше чем за `replica.lag.time.max.ms` (по умолчанию 30 с). Именно ISR определяет, что значит «запись подтверждена» при `acks=all`, и из кого можно выбрать нового leader'а без потери данных.

**Зачем нужен ISR.** Ждать подтверждения от всех реплик нельзя: одна медленная или упавшая реплика остановила бы запись. Ждать только leader'а — рискованно. ISR — динамический компромисс: подтверждение нужно от тех, кто сейчас в строю, а отставшие временно исключаются и возвращаются, когда догонят.

**Как связаны настройки:**

- `acks=all` — запись подтверждается, когда её получили все текущие ISR.
- `min.insync.replicas` — минимальный размер ISR, при котором запись с `acks=all` вообще принимается. Если ISR меньше — producer получает `NotEnoughReplicas` (или `NotEnoughReplicasAfterAppend`).
- `unclean.leader.election.enable=false` (по умолчанию) — leader выбирается только из ISR.

**Пример.** RF=3, `min.insync.replicas=2`:

| ISR | Запись с `acks=all` | Чтение |
| --- | --- | --- |
| {1, 2, 3} | да, ждём три реплики | да |
| {1, 2} — брокер 3 отстал | да, ждём две | да |
| {1} | ошибка `NotEnoughReplicas` | да |

**Почему реплика выпадает из ISR:** брокер упал или перегружен, долгая GC-пауза, медленный диск, сетевые проблемы, реплика догоняет после рестарта, всплеск нагрузки больше пропускной способности репликации.

**Что мониторить:**

- `UnderReplicatedPartitions` — партиций, у которых ISR меньше RF; в здоровом кластере 0.
- `UnderMinIsrPartitionCount` — партиций, где запись с `acks=all` уже отклоняется; это инцидент.
- `IsrShrinksPerSec` / `IsrExpandsPerSec` — частые колебания говорят о нестабильности сети или брокера.

**Историческая ремарка.** До Kafka 0.9 follower выпадал из ISR и по числу отстающих сообщений (`replica.lag.max.messages`), что давало ложные срабатывания на всплесках нагрузки. Сейчас критерий только временной.

## Что происходит при падении Kafka broker?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-chto-proishodit-pri-padenii-kafka-broker
tags: kafka
```

Controller кластера замечает потерю брокера и для каждой партиции, где он был leader'ом, выбирает нового leader'а из оставшихся реплик ISR. Клиенты получают ошибки вида `NOT_LEADER_OR_FOLLOWER` или таймауты, обновляют метаданные и переключаются на новых leader'ов сами; при RF≥2 и правильных настройках это выглядит как всплеск задержки на секунды, без потери подтверждённых данных.

**Пошагово (KRaft):**

1. Брокер перестаёт слать heartbeat'ы активному controller'у; через `broker.session.timeout.ms` (по умолчанию 9 с) он считается отключённым. При штатной остановке брокер сам заранее передаёт leadership (controlled shutdown), и переключение почти мгновенное.
2. Controller убирает брокер из ISR его партиций и выбирает новых leader'ов из ISR.
3. Изменения записываются в metadata log и распространяются на все брокеры.
4. Producer'ы и consumer'ы обновляют метаданные и продолжают работу с новыми leader'ами.
5. Партиции становятся under-replicated: копий меньше, чем RF, пока брокер не вернётся или реплики не будут переназначены.

**Что видят клиенты:**

| Клиент | Поведение |
| --- | --- |
| Producer | запросы к старому leader'у падают, батчи ретраятся в пределах `delivery.timeout.ms` / `message.timeout.ms`; idempotent producer не создаёт дублей при этих ретраях |
| Consumer | fetch'и падают, после обновления метаданных чтение продолжается с того же offset'а |
| Group coordinator на упавшем брокере | его роль переходит к новому leader'у соответствующей партиции `__consumer_offsets`, группа проходит rebalance |

**Когда данные могут пропасть или партиция станет недоступна:**

- RF=1 — партиции на упавшем брокере недоступны до его возвращения; при потере диска данные потеряны.
- `acks=1` — записи, подтверждённые leader'ом, но не успевшие реплицироваться, исчезнут при смене leader'а.
- Все ISR-реплики на упавших брокерах — партиция offline. При `unclean.leader.election.enable=true` оживёт с потерей данных, при `false` (по умолчанию) — ждёт возвращения реплики.
- ISR меньше `min.insync.replicas` — запись с `acks=all` отклоняется, чтение работает.

**После возвращения брокера** его реплики догоняют leader'ов и возвращаются в ISR, затем leadership перебалансируется на preferred-реплики (`auto.leader.rebalance.enable`). Если брокер не вернётся — реплики переносят на другие брокеры через `kafka-reassign-partitions.sh`.

**Кворум контроллеров.** В KRaft controller'ы — отдельный Raft-кворум (обычно 3 или 5 узлов). Падение одного controller'а переживается выбором нового активного, потеря большинства останавливает изменения метаданных (новые leader'ы не выбираются), хотя уже работающие партиции продолжают обслуживаться.

## Как гарантировать отсутствие потери сообщений?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-garantirovat-otsutstvie-poteri-soobschenii
```

Потеря возможна на трёх участках — при записи, при хранении и при чтении, и закрывать нужно все три: producer ждёт подтверждения от нескольких реплик и корректно обрабатывает ошибки, topic хранит достаточно копий, а consumer коммитит offset только после обработки.

**1. Producer:**

```csharp
var config = new ProducerConfig
{
    BootstrapServers = "kafka:9092",
    Acks = Acks.All,
    EnableIdempotence = true,       // ретраи без дублей и перестановок
    MessageTimeoutMs = 120_000      // сколько всего пытаться доставить
};

producer.Produce("orders", msg, report =>
{
    if (report.Error.IsError)
        // не игнорировать: сохранить, переотправить, алерт
        log.LogError("delivery failed: {Reason}", report.Error.Reason);
});
// ...
producer.Flush(TimeSpan.FromSeconds(30));   // при остановке
```

Типичные потери здесь — «fire and forget» без проверки delivery report и выход процесса без `Flush`, когда сообщения остались в буфере.

**2. Брокер и topic:**

| Настройка | Значение | Зачем |
| --- | --- | --- |
| `replication.factor` | 3 | копии на разных брокерах (и rack'ах через `broker.rack`) |
| `min.insync.replicas` | 2 | `acks=all` означает минимум две копии |
| `unclean.leader.election.enable` | `false` (дефолт) | не выбирать отставшего leader'а ценой потери |
| retention | больше максимального возможного простоя consumer'а | данные не удалятся раньше, чем их прочитают |

**3. Consumer:** коммит после обработки (at-least-once), обработка `PartitionsRevoked` для коммита перед отзывом партиций, `auto.offset.reset=earliest` для новых групп, если важна полнота. Poison-сообщения — в DLT, а не молча пропускать.

**4. Граница «БД ↔ Kafka».** Самая частая реальная потеря — не в Kafka, а в приложении: транзакция в БД закоммитилась, а публикация события упала (или наоборот). Решение — Transactional Outbox: событие пишется в таблицу outbox в той же транзакции, отдельный процесс публикует его с ретраями.

**Чего это всё стоит:** at-least-once без потерь почти всегда означает возможные дубли — поэтому consumer'ы должны быть идемпотентными.

**Остаточные риски:** одновременная потеря всех реплик (весь ДЦ) — лечится rack awareness по зонам и репликацией в другой кластер (MirrorMaker 2, Cluster Linking); Kafka подтверждает запись по факту репликации в память/page cache, а не fsync, поэтому одновременное отключение питания всех реплик теоретически может потерять последние записи.

## Что такое idempotent producer?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-idempotent-producer
tags: kafka, idempotency
```

Idempotent producer — режим producer'а (`enable.idempotence=true`), при котором брокер отбрасывает повторно отправленные батчи и не допускает их перестановки. В результате ретраи из-за сетевых ошибок не создают дублей в партиции и не ломают порядок.

**Проблема, которую он решает.** Producer отправил батч, брокер записал его, но ответ потерялся по сети. Producer ретраит — без идемпотентности в логе окажется две копии. Кроме того, при нескольких in-flight запросах ретрай первого батча может записаться после второго.

**Как работает:**

- при инициализации producer получает от брокера **producer id (PID)** и **epoch**;
- каждый батч в партицию получает монотонный **sequence number**;
- брокер помнит последние sequence number'ы для каждого (PID, партиция) и отклоняет батч, который уже был записан (дубль), или пришёл с разрывом (перестановка), — producer в этом случае переотправит в правильном порядке.

Порядок гарантируется при `max.in.flight.requests.per.connection` ≤ 5 — брокер хранит состояние для последних пяти батчей.

**Настройки и дефолты:**

| | Java-клиент (с Kafka 3.0) | librdkafka / Confluent.Kafka |
| --- | --- | --- |
| `enable.idempotence` | `true` по умолчанию | `false` по умолчанию |
| Требует | `acks=all`, `retries > 0`, `max.in.flight.requests.per.connection ≤ 5` | то же; при явных несовместимых значениях — ошибка конфигурации |

```csharp
var config = new ProducerConfig
{
    BootstrapServers = "kafka:9092",
    EnableIdempotence = true   // автоматически выставит acks=all и безопасные ретраи
};
```

**Границы гарантии — главное, о чём спрашивают:**

- Работает в пределах **одного экземпляра producer'а и одной сессии**. Перезапустился процесс — новый PID, брокер не узнает, что сообщение уже отправлялось.
- Не защищает от дублей на уровне приложения: сервис упал после успешной отправки, но до отметки «отправлено» — при рестарте отправит снова с новым PID.
- Не касается consumer'а: повторная обработка после рестарта — отдельная задача (idempotent consumer).
- Для дедупликации между сессиями нужен `transactional.id` — стабильный идентификатор, по которому брокер восстанавливает состояние и «отстреливает» (fencing) зомби-экземпляры.

**Цена** — практически нулевая: небольшое состояние на брокере и требование `acks=all`. Поэтому в .NET-клиенте его стоит включать явно почти всегда.

## Что такое transactions в Kafka?

```yaml
category: kafka
level: middle
difficulty: 2
slug: kafka-chto-takoe-transactions-v-kafka
tags: transactions, kafka
```

Транзакции Kafka позволяют producer'у атомарно записать набор сообщений в несколько партиций и topic'ов, а также закоммитить offset'ы consumer'а: либо все эти записи станут видны читателям с `read_committed`, либо ни одна. Это основа exactly-once для конвейеров «прочитал из Kafka → обработал → записал в Kafka».

**Как устроено:**

- Producer получает `transactional.id` — стабильный идентификатор, переживающий рестарты. По нему брокер находит **transaction coordinator** и хранит состояние в internal topic `__transaction_state`.
- `InitTransactions` регистрирует producer и повышает epoch: старый экземпляр с тем же `transactional.id` («зомби») будет отстрелян (`ProducerFenced`).
- Записи транзакции пишутся в партиции сразу, но при коммите или откате coordinator дописывает в каждую партицию **control-маркер** (commit/abort).
- Consumer с `isolation.level=read_committed` читает только до **last stable offset** — до первой незавершённой транзакции — и пропускает записи отменённых транзакций.

```csharp
var producer = new ProducerBuilder<string, string>(new ProducerConfig
{
    BootstrapServers = "kafka:9092",
    TransactionalId = "billing-processor-1"
}).Build();

producer.InitTransactions(TimeSpan.FromSeconds(30));

producer.BeginTransaction();
try
{
    producer.Produce("invoices", new Message<string, string> { Key = k, Value = v });
    producer.Produce("audit",    new Message<string, string> { Key = k, Value = a });
    producer.SendOffsetsToTransaction(consumer.Assignment
        .Select(tp => new TopicPartitionOffset(tp, consumer.Position(tp))),
        consumer.ConsumerGroupMetadata, TimeSpan.FromSeconds(30));
    producer.CommitTransaction();
}
catch (KafkaException)
{
    producer.AbortTransaction();   // и откатить consumer к последнему закоммиченному offset'у
}
```

Consumer в такой схеме работает с `EnableAutoCommit = false` — offset'ы фиксирует транзакция.

**Дефолты `isolation.level`:** Java-клиент — `read_uncommitted`, librdkafka/Confluent.Kafka — `read_committed`.

**Чего транзакции НЕ делают:**

- не охватывают базу данных, HTTP-вызовы и любые внешние системы;
- не делают обработчик выполняемым один раз — после abort его выполнят снова;
- не защищают читателей с `read_uncommitted` от отменённых данных.

**Цена:** дополнительные запросы к coordinator'у на каждую транзакцию (поэтому транзакции делают на пачку сообщений, а не на каждое), задержка видимости для читателей до коммита, `transaction.timeout.ms` (по умолчанию 60 с в Java-клиенте), после которого coordinator отменит зависшую транзакцию, более сложная обработка ошибок. Kafka Streams скрывает всё это за `processing.guarantee=exactly_once_v2`.

## Kafka vs RabbitMQ?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kafka-vs-rabbitmq
tags: kafka
```

Kafka — распределённый лог: сообщения хранятся по retention, consumer'ы сами ведут offset и могут перечитывать историю, масштабирование и порядок — через партиции. RabbitMQ — брокер сообщений с очередями и гибкой маршрутизацией: брокер доставляет сообщение consumer'у и удаляет его после ack. Разница в модели, а не в «кто быстрее».

| | Kafka | RabbitMQ |
| --- | --- | --- |
| Модель | append-only лог, pull | очереди + exchange'и, push к consumer'у (с `prefetch`) |
| После обработки | сообщение остаётся до retention | удаляется после ack |
| Повторное чтение | да, `Seek`/reset offset'ов, новые группы читают историю | нет (кроме Streams) |
| Состояние доставки | один offset на партицию у группы | ack/nack по каждому сообщению |
| Маршрутизация | topic + ключ → партиция | direct, topic, fanout, headers exchange'и, bindings |
| Порядок | внутри партиции | внутри очереди, пока один consumer; с несколькими и redelivery — нарушается |
| Масштабирование чтения | до числа партиций в группе | competing consumers на очереди без жёсткого предела |
| Retry / DLQ | строится в приложении | встроенные: nack без requeue → dead letter exchange, TTL, `x-delivery-limit` |
| Задержанная доставка | нет встроенной | через TTL + DLX или плагин delayed message exchange |
| Приоритеты | нет | priority queues |
| Пропускная способность | очень высокая (батчи, последовательный I/O) | ниже, зато ниже задержка на отдельное сообщение |
| Протоколы | собственный бинарный | AMQP 0-9-1, AMQP 1.0, MQTT, STOMP |

**Современные размывания границ:**

- **RabbitMQ Streams** (с 3.9) — append-only лог с повторным чтением по offset'у, похожий на Kafka.
- **Quorum queues** в RabbitMQ — реплицируемые очереди на Raft, стандарт вместо устаревших mirrored queues (удалены в 4.0).
- **Kafka share groups** (KIP-932, «Queues for Kafka») — совместное чтение партиции с поштучным ack, шаг Kafka к очередной семантике.

**Практические различия в .NET:**

- Confluent.Kafka — низкоуровневый клиент, retry/DLQ/сериализацию пишут сами или берут KafkaFlow, MassTransit.
- RabbitMQ.Client (v7 — полностью асинхронный API) и MassTransit/NServiceBus с готовыми retry, outbox, sagas.

**Типичный вопрос дальше:** когда какой выбирать — Kafka для потоков событий, реплея и множества независимых подписчиков; RabbitMQ для задач, команд и сложной маршрутизации с поштучным подтверждением.

## Когда выбрать Kafka, а когда RabbitMQ?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kogda-vybrat-kafka-a-kogda-rabbitmq
tags: kafka
```

Kafka выбирают, когда нужен долговременный поток событий: высокий объём, повторное чтение истории, много независимых подписчиков, порядок по ключу, стриминговая обработка. RabbitMQ — когда нужна очередь задач или команд: поштучное подтверждение, гибкая маршрутизация, приоритеты, отложенная доставка и готовые retry/DLQ.

**Kafka подходит, если:**

- **Событие — факт, который нужен многим.** `OrderPlaced` читают биллинг, склад, аналитика, поиск — каждый своей группой, в своём темпе, и новый сервис через год может прочитать историю.
- **Нужен реплей.** Исправили баг в обработчике — перемотали offset'ы и пересчитали. Построили новую проекцию — прочитали с начала (compacted topic как источник состояния).
- **Большой поток.** Сотни тысяч и миллионы событий в секунду: логи, клики, телеметрия, CDC из БД (Debezium).
- **Стриминг.** Агрегации, окна, join'ы потоков через Kafka Streams, Flink, ksqlDB.
- **Порядок по сущности** важен, и хватает гарантии «внутри партиции».

**RabbitMQ подходит, если:**

- **Очередь работ.** Сгенерировать отчёт, отправить письмо, обработать файл: каждую задачу берёт один воркер, ack по факту выполнения, неудачные — в DLX.
- **Сложная маршрутизация.** Topic exchange с шаблонами `orders.*.eu`, headers exchange, разные очереди для разных типов сообщений без создания topic'а на каждый.
- **Request/reply и RPC-подобные сценарии** (`reply-to`, `correlation-id`).
- **Приоритеты, TTL, отложенная доставка, лимиты длины очереди** — из коробки.
- **Неравномерная длительность задач**: RabbitMQ раздаёт сообщения свободным воркерам с учётом `prefetch`, а в Kafka одно медленное сообщение задерживает всю партицию.
- **Небольшой объём и маленькая команда**: RabbitMQ проще развернуть и обслуживать.

**Сигналы, что выбор неверный:**

| Симптом | Скорее всего |
| --- | --- |
| В Kafka пишут свой механизм отложенных задач, приоритетов и поштучных ack'ов | нужна очередь (RabbitMQ или share groups в новых Kafka) |
| В RabbitMQ хранят события «на всякий случай», чтобы потом перечитать | нужен лог (Kafka или RabbitMQ Streams) |
| Кластер Kafka ради 100 сообщений в минуту | избыточно; хватит RabbitMQ или даже outbox + polling |

**Часто используют оба.** Kafka — шина доменных событий между сервисами и в аналитику; RabbitMQ — внутренние очереди задач сервиса. Ответ на собеседовании сильнее, если начать с требований (объём, реплей, порядок, модель подтверждения, операционная экспертиза команды), а не с «Kafka быстрее».

## Как обеспечить порядок обработки событий?

```yaml
category: kafka
level: middle
difficulty: 4
slug: kafka-kak-obespechit-poryadok-obrabotki-sobytii
```

Порядок нужно сохранить на всём пути: связанные события пишутся с одним ключом в одну партицию, producer не переставляет их при ретраях (idempotence), consumer обрабатывает события одного ключа последовательно, а retry и DLT не выпускают следующее событие ключа раньше упавшего. Сломать порядок может любое из этих звеньев.

**1. Правильный ключ.** Ключ — та сущность, внутри которой нужен порядок. Для событий заказа — `orderId`; если важен порядок операций по счёту — `accountId`, а не `transactionId`. Слишком крупный ключ (например, `tenantId`) даёт горячие партиции.

**2. Producer без перестановок:**

```csharp
var config = new ProducerConfig
{
    EnableIdempotence = true,   // иначе ретрай батча может встать после следующего
    Acks = Acks.All
};
```

Если события одного ключа отправляют несколько сервисов или экземпляров, Kafka не упорядочит их между собой — порядок задаётся тем, кто раньше дошёл до leader'а. Надёжнее один источник событий для сущности (например, outbox её сервиса, публикуемый в порядке `id`).

**3. Consumer последовательно по ключу.** Простейший вариант — один поток на партицию. Для параллелизма — раскладка по воркерам по `hash(key)`: разные ключи параллельно, один ключ — строго по очереди. Коммитить offset можно только до первого незавершённого сообщения партиции.

**4. Ошибки и ретраи.** Классический retry-topic нарушает порядок: упавшее событие обработается позже следующих. Варианты:

- блокирующий retry на месте (партиция ждёт) — порядок сохранён, но ценой задержки;
- «парковка» ключа: пока по ключу есть сообщение в retry, последующие события того же ключа тоже отправляются в retry/parking;
- событие несёт версию, consumer применяет только `version = current + 1` и откладывает остальные.

**5. Защита от переупорядочивания на стороне приёмника.** Даже при всех мерах возможны реплеи и ручные redrive'ы. Надёжный последний рубеж — версия в событии:

```sql
UPDATE orders SET status = @status, version = @version
WHERE id = @id AND version < @version;
```

Событие старее текущего состояния просто игнорируется.

**6. Изменения инфраструктуры.** Увеличение числа партиций переносит ключи: в переходный период события одного ключа могут оказаться в двух партициях. Перед этим дают дочитать старые данные или мигрируют через новый topic.

**Что спрашивают дальше:** нужен ли на самом деле строгий порядок (часто достаточно версий и идемпотентности), и как быть с событиями разных сущностей, где порядок нужен между ними — тогда либо общий ключ, либо саги/процесс-менеджер, который ждёт нужных событий.

## Как обрабатывать дубликаты сообщений?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-obrabatyvat-dublikaty-soobschenii
tags: sql
```

Дубликаты в Kafka-системах неизбежны при at-least-once, поэтому их гасят на стороне обработчика: фиксируют уникальный идентификатор события в БД атомарно с бизнес-изменением (уникальный индекс не даст обработать дважды) или делают саму операцию идемпотентной — upsert, «установить значение», проверка версии.

**Откуда дубли:** ретраи producer'а без идемпотентности, повторная отправка приложением после рестарта (outbox-релей), падение consumer'а между обработкой и коммитом, rebalance, ручной реплей.

**Способ 1. Inbox-таблица с уникальным ключом (PostgreSQL):**

```sql
CREATE TABLE inbox (
    message_id   uuid PRIMARY KEY,
    handler      text NOT NULL,
    received_at  timestamptz NOT NULL DEFAULT now()
);
```

```sql
BEGIN;
INSERT INTO inbox (message_id, handler) VALUES ($1, 'billing')
ON CONFLICT (message_id) DO NOTHING;
-- если вставлена 0 строк — дубль, выходим (ROLLBACK или COMMIT без изменений)
UPDATE invoices SET status = 'Paid' WHERE order_id = $2;
COMMIT;
```

Ключевое — одна транзакция. Если отметку «обработано» писать отдельно, между бизнес-изменением и отметкой остаётся окно для дубля. Проверка `SELECT EXISTS` перед обработкой без уникального индекса тоже не спасает: два параллельных обработчика пройдут проверку одновременно.

**Способ 2. Идемпотентная операция без журнала:**

```sql
-- upsert по бизнес-ключу
INSERT INTO payments (payment_id, order_id, amount)
VALUES ($1, $2, $3)
ON CONFLICT (payment_id) DO NOTHING;

-- применять только более новое состояние
UPDATE orders SET status = $2, version = $3
WHERE id = $1 AND version < $3;
```

**Способ 3. Хранение offset'а вместе с результатом.** Consumer в той же транзакции БД сохраняет `(topic, partition, offset)`, а при назначении партиции делает `Seek` к сохранённому значению. Дубли исключены для этого конкретного потока, но не для переопубликованных сообщений с новым offset'ом.

**Какой ключ дедупликации выбрать:**

| Ключ | Плюсы | Минусы |
| --- | --- | --- |
| `eventId` от producer'а | переживает реплей и повторную отправку | producer должен его генерировать |
| бизнес-ключ (`paymentId`) | естественный, не требует журнала | не у всех событий есть |
| `topic/partition/offset` | всегда есть | меняется при переотправке |

**Эксплуатация:** журнал дедупликации растёт — чистить записи старше окна возможных повторов (retention topic'а плюс запас) пакетами или партиционированием таблицы по дате. Кэш в памяти или Redis с TTL — допустимая оптимизация перед БД, но не замена уникальному ограничению.

**Внешние побочные эффекты** (письма, платежи) дедуплицируют через idempotency key у приёмника или через собственный outbox с уникальным ключом на исходящее действие.

## Как изменить количество partitions?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-izmenit-kolichestvo-partitions
tags: partitioning
```

Число партиций можно только увеличить — командой `kafka-topics.sh --alter --partitions N` или через Admin API; уменьшить нельзя. При увеличении существующие данные не перемещаются, а новые записи с ключами начинают распределяться по новой формуле `hash(key) % N`, поэтому часть ключей «переедет» в другие партиции и порядок по ним временно нарушится.

```bash
kafka-topics.sh --bootstrap-server kafka:9092 --alter --topic orders --partitions 24
kafka-topics.sh --bootstrap-server kafka:9092 --describe --topic orders
```

```csharp
using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = "kafka:9092" }).Build();
await admin.CreatePartitionsAsync(new[]
{
    new PartitionsSpecification { Topic = "orders", IncreaseTo = 24 }
});
```

**Что происходит после увеличения:**

- Новые партиции пустые и создаются на брокерах по обычным правилам размещения.
- Producer'ы узнают о них при обновлении метаданных (`metadata.max.age.ms`, по умолчанию 5 минут, или при ошибке) — какое-то время разные экземпляры пишут по старой и новой формуле.
- Consumer group'ы получают rebalance и назначают новые партиции. Важно: для новой партиции у группы нет committed offset'а, и если `auto.offset.reset=latest`, записи, попавшие туда до назначения, будут пропущены. Для важных topic'ов перед расширением стоит выставить `earliest`.
- Ключ `K`, который был в P3, теперь может оказаться в P17: старые события ключа — в P3, новые — в P17, и их могут параллельно обрабатывать разные consumer'ы.

**Когда увеличивать безопасно:**

- у сообщений нет ключей или порядок по ключу не важен;
- consumer'ы идемпотентны и защищены версиями от переупорядочивания;
- можно приостановить producer'ов, дать consumer'ам дочитать до конца, расширить topic и возобновить запись.

**Если порядок по ключу критичен** — создают новый topic с нужным числом партиций и мигрируют: пишут в оба или переключают producer'ов, consumer'ы дочитывают старый topic и переходят на новый.

**Почему нельзя уменьшить.** Данные удаляемых партиций пришлось бы слить в другие с нарушением порядка и переписыванием offset'ов. Единственный путь — новый topic и перенос.

**Для compacted topic'ов и Kafka Streams** расширение особенно опасно: state store'ы и co-partitioning с другими topic'ами завязаны на число партиций, поэтому в Streams его меняют через новый topic и сброс приложения.

## Как мониторить Kafka consumer lag?

```yaml
category: kafka
level: middle
difficulty: 3
slug: kafka-kak-monitorit-kafka-consumer-lag
tags: kafka
```

Consumer lag — разница между log end offset партиции и committed offset группы, то есть сколько сообщений записано, но ещё не обработано. Мониторят его по каждой партиции, а не только суммарно, и смотрят не столько на абсолютное значение, сколько на тренд и на lag во времени — сколько секунд отстаёт обработка.

**Быстрая проверка через CLI:**

```bash
kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group billing
# TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG    CONSUMER-ID  HOST
# orders  0          10500           10520           20     consumer-1   /10.0.0.5
# orders  1          8000            52000           44000  consumer-2   /10.0.0.6
```

По такому выводу сразу видно, что проблема в одной партиции (горячий ключ, poison-сообщение или медленный consumer), а не во всей группе.

**Источники метрик:**

| Источник | Что даёт |
| --- | --- |
| Admin API (`ListConsumerGroupOffsets` + `ListOffsets`) | lag по committed offset'у; так работают внешние экспортёры |
| kafka-exporter / kafka-lag-exporter / Burrow | Prometheus-метрики lag'а по группам и партициям, у lag-exporter — оценка lag'а во времени |
| Метрики клиента | в Java — `records-lag-max`; в librdkafka — статистика (`statistics.interval.ms`, `SetStatisticsHandler`) с `consumer_lag` по партициям |
| Managed-сервисы | Confluent Cloud, MSK, Aiven показывают lag в своих консолях |

```csharp
var consumer = new ConsumerBuilder<string, string>(new ConsumerConfig
{
    GroupId = "billing",
    StatisticsIntervalMs = 15000
})
.SetStatisticsHandler((_, json) => lagMetrics.Update(json)) // topics.*.partitions.*.consumer_lag
.Build();
```

**Что считать нормой и на что алертить:**

- **Lag во времени** понятнее бизнесу: «обработка отстаёт на 3 минуты» вместо «на 180 000 сообщений» — одинаковое число сообщений значит разное на разных topic'ах.
- **Тренд**: lag, который растёт на протяжении 10–15 минут, — проблема; кратковременный пик после деплоя — нет.
- **Lag одной партиции** при нормальных остальных — горячий ключ или застрявшее сообщение.
- **Committed offset не двигается при нулевом потреблении** — группа мертва, хотя lag может быть небольшим, если и запись идёт медленно.
- **Lag близок к retention** — риск, что непрочитанные данные удалятся.

**Подвох метрики по committed offset'у:** при редких коммитах (раз в 5 с, большими пачками) lag «пилит», а у consumer'а, который обрабатывает, но не коммитит, lag растёт, хотя работа идёт. Поэтому полезно смотреть и клиентские метрики, и throughput обработки рядом.

**Использование lag'а для автоскейлинга** — KEDA kafka scaler по `lagThreshold`, с верхней границей реплик по числу партиций.

## Как выбрать стратегию партиционирования и что произойдёт при перекосе ключей?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-kak-vybrat-strategiyu-particionirovaniya-i-chto-proizoidet-pri-perekos
tags: partitioning, architecture
```

Ключ партиционирования выбирают по единице, внутри которой нужен порядок (заказ, счёт, устройство), и проверяют, что у этой единицы достаточно высокая кардинальность и равномерное распределение нагрузки. При перекосе ключей одна партиция получает непропорционально много трафика: её consumer становится узким местом, lag растёт только на ней, а добавление consumer'ов и партиций не помогает — горячий ключ всё равно попадёт в одну партицию.

**Как producer выбирает партицию:**

- **Есть ключ** — `hash(key) % numPartitions`. Одинаковый ключ всегда в одной партиции (пока число партиций не меняется).
- **Ключа нет** — Java-клиент с 3.3 использует встроенное «липкое» распределение (KIP-794): заполняет батч в одну партицию, затем переключается. Порядка между сообщениями нет.
- **Явная партиция** или custom partitioner — полный контроль, но и вся ответственность.

**Ловушка в .NET:** librdkafka по умолчанию использует `consistent_random` (CRC32), а Java-клиент — murmur2. Один и тот же ключ из .NET- и Java-producer'а попадёт в разные партиции, и порядок по ключу сломается. Если в топик пишут разные клиенты, выравнивают алгоритм:

```csharp
var config = new ProducerConfig
{
    BootstrapServers = "kafka:9092",
    Partitioner = Partitioner.Murmur2Random // совместимо с Java DefaultPartitioner
};
```

**Критерии выбора ключа:**

| Вопрос | Почему важно |
| --- | --- |
| Где нужен порядок? | ключ должен быть не мельче этой единицы — иначе порядок потеряется |
| Сколько различных значений? | `tenantId` из 20 значений на 48 партиций — половина партиций пустует |
| Есть ли «киты»? | один крупный клиент с 40% трафика = одна перегруженная партиция |
| Нужна ли co-partitioning для join'ов? | в Kafka Streams топики для join должны иметь одинаковый ключ и число партиций |

**Симптомы перекоса:** lag и `BytesInPerSec` сильно отличаются между партициями, один consumer загружен на 100%, остальные простаивают; на брокере-лидере горячей партиции выше диск и сеть; размер партиций на диске неравный.

**Что делать при горячем ключе:**

- **Укрупнить или уточнить ключ.** Если порядок нужен по заказу, а ключом был `customerId`, переход на `orderId` снимает перекос от крупного клиента.
- **Солить ключ** — `customerId + ":" + (orderId % 8)`: нагрузка клиента делится на 8 партиций, но порядок сохраняется только внутри «соли». Допустимо, если бизнес-порядок нужен по более мелкой сущности.
- **Выделить горячих в отдельный топик** с собственным пулом consumer'ов.
- **Параллелить внутри consumer'а** по под-ключу, если порядок нужен только по части сообщений.
- **Не путать с перекосом лидеров**: иногда нагрузка неравна не из-за ключей, а из-за того, что лидеры партиций скучены на одном брокере, — это лечится preferred leader election и перебалансировкой реплик (Cruise Control).

**Что спросят дальше:** как изменится маппинг ключей при добавлении партиций (он сломается для всех ключей — поэтому число партиций для keyed-топиков закладывают с запасом), и почему округлое число вроде 12/24/48 удобнее — оно делится на много вариантов числа consumer'ов.

## Что происходит во время consumer rebalance и как минимизировать простой?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-chto-proishodit-vo-vremya-consumer-rebalance-i-kak-minimizirovat-prost
tags: rebalance, availability
```

Во время rebalance group coordinator на брокере заново собирает состав группы, один из участников (leader группы в классическом протоколе) считает назначение партиций, и все получают новое распределение. При eager-протоколе в этот момент вся группа перестаёт читать; при cooperative — только переезжающие партиции. Простой минимизируют тремя способами: реже запускать rebalance, делать его короче и делать его инкрементальным.

**Фазы классического протокола:**

1. **Триггер** — участник пришёл, ушёл, не прислал heartbeat за `session.timeout.ms` (по умолчанию 45 с) или не вызвал poll за `max.poll.interval.ms` (по умолчанию 5 мин).
2. **JoinGroup** — coordinator ответом на heartbeat сообщает `REBALANCE_IN_PROGRESS`, каждый участник заново присылает JoinGroup. Coordinator ждёт всех, но не дольше таймаута rebalance (он равен максимальному `max.poll.interval.ms` в группе).
3. **Revoke** — при eager все отдают все партиции и перед этим должны закоммитить offset'ы.
4. **SyncGroup** — лидер группы присылает назначение, coordinator раздаёт его участникам.
5. **Assign** — участники начинают читать с committed offset'ов.

Самая долгая часть обычно не сам протокол, а ожидание медленного участника, который сейчас обрабатывает большую пачку и доберётся до poll не скоро.

**Как сократить число rebalance'ов:**

- **Static membership** — `group.instance.id` для каждого pod'а (например, имя StatefulSet-pod'а). Рестарт в пределах `session.timeout.ms` не вызывает rebalance: coordinator отдаёт тому же id те же партиции.
- **Не вылетать по `max.poll.interval.ms`** — ограничить размер пачки, выносить тяжёлую работу, не блокировать poll-цикл на внешних вызовах без таймаутов.
- **Корректный shutdown** — `Close()` отправляет LeaveGroup, и rebalance начинается сразу, а не через 45 с ожидания heartbeat'а.
- **`group.initial.rebalance.delay.ms`** (брокер, 3 с по умолчанию) — при старте пустой группы coordinator подождёт, пока соберутся все, вместо серии rebalance'ов.

```csharp
var config = new ConsumerConfig
{
    GroupId = "billing",
    GroupInstanceId = Environment.GetEnvironmentVariable("POD_NAME"),
    SessionTimeoutMs = 60000,          // покрывает время рестарта pod'а
    MaxPollIntervalMs = 300000,
    PartitionAssignmentStrategy = PartitionAssignmentStrategy.CooperativeSticky,
    EnableAutoCommit = false
};
```

**Как сделать rebalance дешевле:**

- **Cooperative-sticky** — отзываются только переезжающие партиции.
- **Новый протокол KIP-848** (`group.protocol=consumer`, GA в Kafka 4.0) — назначение считает брокер, нет глобального барьера синхронизации, медленный участник не тормозит остальных.
- **Быстрый revoke-handler** — коммит обработанного и выход; не дожидаться обработки всего буфера.

**Цена static membership:** если pod действительно умер, его партиции никто не читает до истечения `session.timeout.ms`. Большой таймаут = меньше rebalance'ов при деплое, но дольше простой при реальной аварии.

**Что проверяют на собеседовании:** почему rolling-деплой из 10 pod'ов даёт 20 rebalance'ов и как это исправить; что будет с сообщениями, обработанными, но не закоммиченными до revoke (их прочитает новый владелец — нужна идемпотентность); чем `PartitionsLost` отличается от `PartitionsRevoked`.

## Чем cooperative rebalancing лучше eager и когда стоит переходить?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-chem-cooperative-rebalancing-luchshe-eager-i-kogda-stoit-perehodit
tags: rebalance, availability
```

Eager-rebalance — «stop the world»: каждый участник отдаёт все свои партиции, и группа не читает, пока не получит новое назначение. Cooperative (incremental) rebalance отзывает только партиции, которые реально переезжают, а остальные продолжают обрабатываться. Переходить стоит почти всегда, когда группа большая, деплои частые или rebalance'ы заметно поднимают lag; сегодня альтернатива — сразу новый протокол KIP-848.

**Пример: в группе 3 consumer'а и 6 партиций, добавился четвёртый.**

| | Eager | Cooperative-sticky |
| --- | --- | --- |
| Что отзывается | все 6 партиций у всех | 2 партиции, которые уходят новому участнику |
| Кто стоит | вся группа | только эти 2 партиции |
| Раунды | один | два: сначала отзыв, затем назначение освободившихся |
| Локальное состояние (кэши, state store) | теряется или перезагружается | остаётся у старых владельцев |

Второй раунд нужен из-за гарантии: партицию нельзя назначить новому владельцу, пока старый не подтвердил отказ от неё. В первом раунде coordinator видит, что партиция должна переехать, старый владелец её отпускает, во втором она назначается.

**Изменения в коде.** В cooperative-режиме обработчики получают только дельту, а не полный список:

```csharp
var consumer = new ConsumerBuilder<string, string>(new ConsumerConfig
{
    GroupId = "billing",
    PartitionAssignmentStrategy = PartitionAssignmentStrategy.CooperativeSticky
})
.SetPartitionsAssignedHandler((c, added) =>
    log.LogInformation("добавлены {P}", added))      // не весь assignment
.SetPartitionsRevokedHandler((c, revoked) =>
{
    CommitProcessed(c, revoked);                        // коммитим только отзываемые
    DropLocalState(revoked);
})
.Build();
```

Код, который в `Revoked` сбрасывает все кэши или в `Assigned` считает, что пришёл полный список, после перехода начнёт ошибаться. Если возвращаете offset'ы из обработчика, в cooperative-режиме Confluent.Kafka применяет их через incremental assign.

**Как мигрировать:**

- **Java-клиент** — два rolling-деплоя: сначала `partition.assignment.strategy = [cooperative-sticky, range]` (группа продолжает использовать общий eager-протокол), затем убрать `range`, и группа переключится на cooperative.
- **librdkafka / Confluent.Kafka** — стратегии с разными протоколами в одном списке смешивать нельзя, а участники без общего протокола в одну группу не войдут. Практически это означает остановку всей группы и запуск уже с новой стратегией, то есть короткое плановое окно.
- **KIP-848** (`group.protocol=consumer`, Kafka 4.0+) — назначение считает брокер, инкрементальность встроена, `partition.assignment.strategy` на клиенте не используется. Если брокеры и клиенты поддерживают, лучше переходить сразу на него (поддержку в конкретной версии librdkafka стоит проверить).

**Когда eager ещё оправдан:** маленькие группы с редкими изменениями и логикой, завязанной на полный пересчёт назначения, где второй раунд не даёт выигрыша.

**Типичный вопрос вдогонку:** решает ли cooperative проблему rolling-деплоя? Частично — простой меньше, но rebalance'ов всё равно 2N. Число rebalance'ов уменьшает static membership, и эти механизмы комбинируют.

## Как работает exactly-once в Kafka и какова его реальная цена?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-kak-rabotaet-exactly-once-v-kafka-i-kakova-ego-realnaya-cena
tags: exactly-once, transactions
```

Exactly-once в Kafka — это не «обработчик выполнится один раз», а гарантия, что результат конвейера read → process → write внутри Kafka будет зафиксирован ровно один раз: выходные сообщения и offset'ы входа коммитятся атомарно одной транзакцией. Собирается он из трёх частей: idempotent producer, транзакции и `read_committed` у читателей. Цена — задержка видимости, дополнительная нагрузка на брокеры и заметно более сложная обработка ошибок; и гарантия заканчивается на границе Kafka.

**Из чего складывается:**

| Механизм | Что убирает |
| --- | --- |
| Idempotent producer (PID + sequence number на партицию) | дубли от ретраев producer'а внутри одной сессии |
| Транзакции (`transactional.id`, coordinator, control-маркеры) | частичную запись в несколько партиций; фиксирует выход и offset'ы входа атомарно |
| Fencing по epoch | «зомби» — старый экземпляр, который продолжает писать после того, как его заменили |
| `isolation.level=read_committed` | чтение незакоммиченных и отменённых записей |

**Почему повторная обработка всё равно бывает.** Если consumer упал после `Produce`, но до `CommitTransaction`, транзакция отменится, offset'ы не сдвинутся, и новый владелец обработает те же сообщения снова. Для Kafka-результата это невидимо — отменённые записи читатели `read_committed` пропустят. Но email, HTTP-вызов или INSERT в БД из обработчика выполнятся повторно.

**Эволюция:** в исходном EOS (Kafka 0.11) нужен был отдельный producer на каждую входную партицию. С KIP-447 (Kafka 2.5, в Streams — `exactly_once_v2`) fencing работает через consumer group metadata, передаваемую в `SendOffsetsToTransaction`, и достаточно одного транзакционного producer'а на экземпляр.

**Реальная цена:**

- **Задержка end-to-end.** Читатель `read_committed` видит данные только после коммита транзакции. Коммит раз в N мс или N сообщений добавляет эти N мс к задержке. В Kafka Streams при EOS `commit.interval.ms` по умолчанию 100 мс вместо 30 с.
- **Throughput.** Каждая транзакция — запросы к transaction coordinator'у, запись в `__transaction_state` и control-маркеры во все затронутые партиции. Транзакция на каждое сообщение убивает пропускную способность, поэтому транзакции делают на пачку.
- **Last stable offset.** Одна долгая или зависшая транзакция задерживает всех `read_committed`-читателей партиции до коммита или `transaction.timeout.ms`.
- **Обработка ошибок.** `ProducerFenced` — фатально, нужно пересоздать producer; abortable-ошибки — `AbortTransaction` и откат consumer'а к последним committed offset'ам (seek), иначе он пропустит сообщения, обработанные в отменённой транзакции.
- **Операционка.** Стабильные `transactional.id`, ACL на них, мониторинг зависших транзакций (`kafka-transactions.sh`).

```csharp
catch (KafkaException ex) when (ex.Error.IsFatal) { RecreateProducer(); }
catch (KafkaException ex) when (ex is KafkaTxnRequiresAbortException)
{
    producer.AbortTransaction();
    RewindToCommitted(consumer);   // seek на committed offset'ы
}
```

**Когда оно того стоит:** stream processing внутри Kafka — агрегаты, денежные расчёты, конвейеры Kafka Streams, где дубль в выходном топике означает неверную сумму. **Когда нет:** выход во внешнюю систему. Там дешевле at-least-once плюс идемпотентный обработчик (upsert, ключ идемпотентности), и эта комбинация даёт тот же наблюдаемый результат.

## Как транзакции Kafka взаимодействуют с записью в базу данных?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-kak-tranzakcii-kafka-vzaimodeistvuyut-s-zapisyu-v-bazu-dannyh
tags: transactions, consistency
```

Никак: транзакция Kafka и транзакция БД — две независимые транзакции в разных системах, распределённого коммита между ними нет. Сколько бы вы ни вкладывали одну в другую, всегда остаётся момент, когда одна уже зафиксирована, а вторая ещё нет, и падение в этот момент даёт рассинхрон. Поэтому консистентность строят не на транзакциях Kafka, а на хранении offset'ов в БД, идемпотентности или Outbox.

**Почему «вложить» не работает.** Два порядка коммита, оба с дырой:

| Порядок | Падение между коммитами | Результат |
| --- | --- | --- |
| Сначала БД, потом Kafka | БД зафиксирована, Kafka-транзакция отменится | offset'ы не сдвинуты → сообщение обработают снова → повторная запись в БД; событие в Kafka не ушло |
| Сначала Kafka, потом БД | событие опубликовано, offset'ы закоммичены, БД откатилась | подписчики видят событие о том, чего нет; повторной обработки не будет — изменение потеряно |

XA/2PC для Kafka не поддерживается в стабильных релизах (KIP-939 о participation в 2PC — отдельная работа, на неё в продакшене не рассчитывают).

**Рабочие схемы по сценариям:**

**1. Consume → запись в БД (выход только в БД).** Транзакции Kafka не нужны. Храните offset в той же транзакции БД, что и результат, и при старте/assign делайте seek на него:

```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);
db.Payments.Add(payment);
await db.ConsumerOffsets
    .Where(o => o.Group == "billing" && o.Topic == r.Topic && o.Partition == r.Partition.Value)
    .ExecuteUpdateAsync(s => s.SetProperty(o => o.Offset, r.Offset.Value + 1), ct);
await db.SaveChangesAsync(ct);
await tx.CommitAsync(ct);

// в PartitionsAssigned: вернуть offset'ы из таблицы ConsumerOffsets
```

Это настоящий exactly-once для эффекта в БД. Упрощённый вариант — at-least-once плюс уникальный ключ/upsert (идемпотентный consumer).

**2. Изменение в БД → событие в Kafka.** Transactional Outbox: событие пишется в таблицу outbox в той же транзакции БД, отдельный relay (или Debezium CDC) публикует его в Kafka. Доставка at-least-once, у подписчиков — дедупликация по id события.

**3. Consume → БД → produce.** Комбинация: offset и outbox-запись в одной транзакции БД, публикация через relay. Kafka-транзакция здесь не добавляет гарантий.

**Где транзакции Kafka уместны рядом с БД** — только когда БД в этом шаге не участвует или участвует идемпотентно (например, БД читается как справочник, а результат пишется в Kafka).

**Частая ошибка кандидата** — «оберну `SaveChanges` и `CommitTransaction` в один `try`, и при ошибке откачу обе». Откат возможен до коммита; проблема — в падении процесса между двумя успешными коммитами, и никакой `catch` его не поймает.

## Почему для консистентности с БД выбирают Outbox, а не транзакции Kafka?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-pochemu-dlya-konsistentnosti-s-bd-vybirayut-outbox-a-ne-tranzakcii-kaf
tags: outbox, consistency
```

Потому что транзакции Kafka атомарны только внутри Kafka и не решают проблему dual write: «изменить строку в БД и опубликовать событие» — это две системы без общего коммита. Outbox сводит задачу к одной локальной ACID-транзакции БД: бизнес-данные и событие пишутся вместе, а доставка в Kafka становится отдельным, повторяемым шагом с гарантией at-least-once.

**Как устроен Outbox:**

```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);
order.MarkPaid();
db.Outbox.Add(new OutboxMessage
{
    Id = Guid.NewGuid(),                     // id события = ключ дедупликации
    Topic = "orders",
    Key = order.Id.ToString(),               // ключ партиционирования
    Payload = JsonSerializer.Serialize(new OrderPaid(order.Id, order.Total)),
    CreatedAt = DateTime.UtcNow
});
await db.SaveChangesAsync(ct);
await tx.CommitAsync(ct);                    // событие есть ⇔ заказ оплачен
```

Дальше relay публикует записи:

- **Polling publisher** — фоновый сервис выбирает неотправленные записи (`FOR UPDATE SKIP LOCKED` в PostgreSQL для нескольких экземпляров), публикует, ждёт delivery report, помечает отправленными.
- **CDC (Debezium)** — читает WAL/binlog и публикует вставки в outbox (Outbox Event Router). Нет нагрузки polling'а, порядок — порядок коммитов в БД.

**Сравнение подходов:**

| | Kafka-транзакции | Outbox |
| --- | --- | --- |
| Атомарность с БД | нет | да, одна транзакция БД |
| Гарантия доставки | exactly-once внутри Kafka | at-least-once (дубли при падении relay между publish и отметкой) |
| Требования к подписчикам | `read_committed` | идемпотентность, дедупликация по `Id` |
| Задержка | коммит транзакции | интервал polling'а или лаг CDC |
| Инфраструктура | только Kafka | таблица, relay/Debezium, очистка outbox |
| Работает без Kafka | нет — запрос падает, если брокер недоступен | да — события копятся в БД и уйдут позже |

Последняя строка часто решающая: Outbox развязывает доступность сервиса и брокера. Если Kafka лежит, заказ всё равно оформляется.

**Подводные камни:**

- **Порядок.** Несколько relay-экземпляров или параллельная публикация могут перемешать события одного агрегата — публикуйте по ключу последовательно, используйте идемпотентный producer, ключ = id агрегата.
- **Дубли неизбежны** — relay упал после публикации до отметки `SentAt`. Подписчики обязаны быть идемпотентными; `Id` события кладут в header.
- **Рост таблицы** — чистить отправленное по расписанию или партиционировать таблицу по дате.
- **Polling-нагрузка** — индекс по неотправленным, батчи, разумный интервал.

**Зеркальный паттерн — Inbox** на стороне consumer'а: id входящего события и результат обработки пишутся в одной транзакции, уникальный индекс по `Id` отсекает дубли. Outbox + Inbox вместе дают эффективный exactly-once между сервисами поверх at-least-once транспорта.

## Какие гарантии доставки даёт Kafka и как настройки acks и retries на них влияют?

```yaml
category: kafka
level: senior
difficulty: 4
slug: kafka-advanced-kakie-garantii-dostavki-daet-kafka-i-kak-nastroiki-acks-i-retries-na-n
tags: delivery, durability
```

Kafka умеет все три семантики — at-most-once, at-least-once и exactly-once, — и какая получится, определяет комбинация настроек producer'а (`acks`, ретраи, идемпотентность), брокера (`min.insync.replicas`, replication factor) и момента коммита offset'а у consumer'а. `acks` отвечает за то, когда запись считается сохранённой, ретраи — за то, что producer делает при сбое, а идемпотентность — за то, чтобы ретраи не создавали дублей и не ломали порядок.

**Сторона producer'а:**

| Настройки | Что получаем |
| --- | --- |
| `acks=0` | fire-and-forget: ответа нет, ретраи бессмысленны → at-most-once, возможна тихая потеря |
| `acks=1` | лидер записал в свой лог; потеря при падении лидера до репликации |
| `acks=all` + ретраи без идемпотентности | не теряем, но ретрай после потерянного ответа даёт дубль → at-least-once |
| `acks=all` + `enable.idempotence=true` | без потерь и без дублей от ретраев в рамках сессии producer'а, порядок в партиции сохраняется |
| + транзакции + `read_committed` | exactly-once для read-process-write внутри Kafka |

**Ретраи и их границы.** В Java-клиенте `retries` по умолчанию `Integer.MAX_VALUE`, а реальная граница — `delivery.timeout.ms` (120 с): общее время на отправку, включая ожидание в буфере и все попытки. В librdkafka аналог — `message.timeout.ms` (по умолчанию 300 с). Когда время вышло, сообщение считается недоставленным, и это приходит в delivery report — если его не проверять, потеря будет тихой.

**Ретраи и порядок.** Без идемпотентности при `max.in.flight.requests.per.connection > 1` батч 1 может упасть, батч 2 пройти, а ретрай батча 1 записаться после него. Идемпотентный producer сохраняет порядок при in-flight до 5: брокер отклоняет запись с «дыркой» в sequence number.

**Дефолты — важная деталь для .NET:**

- Java-клиент с Kafka 3.0 по умолчанию `acks=all` и `enable.idempotence=true`.
- librdkafka (Confluent.Kafka) по умолчанию `acks=all`, но `enable.idempotence=false` — его включают явно.

```csharp
var config = new ProducerConfig
{
    BootstrapServers = "kafka:9092",
    Acks = Acks.All,
    EnableIdempotence = true,      // в Confluent.Kafka по умолчанию false
    MessageTimeoutMs = 120000
};

var result = await producer.ProduceAsync("orders", msg); // бросит ProduceException при недоставке
```

`Produce` с колбэком без проверки `report.Error` — самый частый источник «Kafka потеряла сообщения».

**Сторона брокера:** `acks=all` означает «все реплики из ISR», а ISR может сжаться до одного лидера. Реальную защиту даёт `min.insync.replicas=2` при RF=3 — иначе `acks=all` вырождается в `acks=1`.

**Сторона consumer'а:**

- коммит до обработки → at-most-once;
- коммит после обработки → at-least-once (дубли после падения или rebalance);
- транзакционный коммит offset'ов вместе с выходом или хранение offset'а в БД вместе с результатом → exactly-once эффекта.

**Итог для собеседования:** end-to-end гарантия — самое слабое звено цепочки. Надёжный producer не поможет, если consumer коммитит offset'ы автоматически до завершения обработки.

## Что произойдёт при acks=1 и падении лидера партиции?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-chto-proizoidet-pri-acks-1-i-padenii-lidera-particii
tags: delivery, replication
```

Сообщения, которые лидер уже подтвердил producer'у, но которые followers ещё не успели скопировать, будут потеряны. Новым лидером станет реплика из ISR, у которой этих записей нет; когда старый лидер вернётся, он обрежет свой лог до точки расхождения с новым лидером, и подтверждённые записи исчезнут окончательно. Producer об этом не узнает — он уже получил успешный ack.

**Пошагово (RF=3, реплики B1 — лидер, B2, B3):**

1. Producer с `acks=1` отправляет сообщения offset 100–104. B1 пишет их в свой лог и сразу отвечает «OK».
2. B2 и B3 успели скопировать до offset 101 включительно. High watermark — 102: consumer'ы видят только offset'ы до 101.
3. B1 падает. Controller (в KRaft — quorum controller) выбирает нового лидера из ISR, например B2. Его log end offset — 102.
4. Producer получает `NOT_LEADER_OR_FOLLOWER`, обновляет метаданные и пишет новые сообщения в B2 — они получают offset'ы 102, 103, ...
5. B1 возвращается как follower, по leader epoch (KIP-101) находит точку расхождения и **обрезает** свои 102–104. Их данные заменяются новыми записями с теми же offset'ами.

Итог: три сообщения, для которых producer получил подтверждение, потеряны. Consumer'ы их не видели (они были выше high watermark), так что с их точки зрения всё консистентно — просто этих событий никогда не было.

**Сколько можно потерять** — всё, что лидер записал, а followers не забрали. Обычно это миллисекунды трафика, но если follower'ы отставали (перегружены, сеть), окно больше — вплоть до `replica.lag.time.max.ms` (по умолчанию 30 с), пока отставших не выкинут из ISR.

**Хуже: unclean leader election.** Если в ISR никого, кроме упавшего лидера, и включён `unclean.leader.election.enable=true` (по умолчанию `false`), лидером станет отставший follower вне ISR — потеряться может намного больше, включая записи, которые consumer'ы уже прочитали. При `false` партиция будет недоступна, пока не вернётся реплика из ISR.

**Сравнение с `acks=all`:**

| | `acks=1` | `acks=all` + `min.insync.replicas=2` |
| --- | --- | --- |
| Когда ack | запись у лидера | запись у всех ISR (минимум 2) |
| Падение лидера | потеря неreplicated-хвоста | подтверждённое есть минимум на одном выжившем из ISR — он и станет лидером |
| Задержка | ниже | + время репликации до самого медленного ISR |

**Почему `acks=1` всё ещё встречается:** метрики, логи, клики — где редкая потеря допустима, а задержка важна. Но с Kafka 3.0 дефолт Java-клиента — `acks=all`, и выигрыш по задержке при нормальной сети обычно невелик, особенно при батчинге.

**Вопрос-ловушка:** «Идемпотентный producer защитит?» Нет — идемпотентность устраняет дубли от ретраев, но при `acks=1` ретрая не будет: producer считает сообщения доставленными. Кстати, `enable.idempotence=true` требует `acks=all`, поэтому с `acks=1` его вообще нельзя включить.

## Consumer lag растёт линейно. Как найти причину и что предпринять?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-consumer-lag-rastet-lineino-kak-naiti-prichinu-i-chto-predprinyat
tags: lag, performance
```

Линейный рост lag'а означает, что скорость потребления стабильно ниже скорости записи на постоянную величину — либо consumer не потребляет вообще (наклон равен входящему трафику), либо потребляет, но медленнее. Сначала выясняют, какой из двух случаев и затронуты все партиции или одна; от этого зависит, чинить ли застрявший consumer, узкое место в обработке или масштабирование.

**Шаг 1. Посмотреть lag по партициям и сравнить наклон с входящим трафиком.**

```bash
kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group billing
```

| Наблюдение | Вероятная причина |
| --- | --- |
| Наклон = входящему трафику, `CURRENT-OFFSET` не меняется | consumer стоит: завис, падает в цикле, poison message, нет участников (`CONSUMER-ID` пустой) |
| Растёт одна партиция, остальные в норме | горячий ключ, застрявшее сообщение, медленный конкретный экземпляр |
| Растут все, offset'ы двигаются, но медленно | не хватает пропускной способности обработки |
| Рост начался в определённый момент | деплой, рост трафика, деградация зависимости (БД, внешний API) |
| Lag «пилит» и растёт ступеньками | частые rebalance'ы — группа большую часть времени не читает |

**Шаг 2. Проверить, что consumer жив и не в rebalance-петле.** Логи `PartitionsRevoked/Assigned`, ошибки `MaxPollIntervalExceeded` — обработка пачки дольше `max.poll.interval.ms`, consumer выкидывается из группы, партиция уходит другому, тот тоже не успевает. Lag растёт, работа повторяется.

**Шаг 3. Найти, куда уходит время обработки.** Метрики на обработчике: время на сообщение, время внешних вызовов (БД, HTTP), размер пачки, CPU и GC pod'а, пул соединений. Типичные находки:

- синхронный вызов в БД на каждое сообщение вместо батча;
- ретраи внутри обработчика с задержкой, блокирующие партицию;
- lock contention в БД, исчерпанный connection pool;
- синхронный `Commit()` после каждого сообщения — лишний round-trip к брокеру;
- медленная десериализация или огромные сообщения.

**Шаг 4. Действовать по причине:**

- **Застрял** — пропустить/отправить в DLT poison message, починить обработчик, перезапустить.
- **Не хватает мощности, партиций больше, чем consumer'ов** — добавить экземпляры (KEDA по lag'у), до числа партиций.
- **Упёрлись в число партиций** — параллелизм внутри consumer'а по ключу, батч-обработка, увеличение партиций (с оглядкой на порядок ключей).
- **Горячий ключ** — пересмотреть ключ, вынести крупного клиента.
- **Узкое место в зависимости** — масштабировать её или ограничить; больше consumer'ов лишь сильнее нагрузит упавшую БД.

**Срочные меры, если lag подбирается к retention.** Оценить, когда непрочитанные сегменты начнут удаляться (lag во времени против `retention.ms`), и при необходимости временно увеличить retention топика — это дешевле, чем потерять данные. Если данные устарели и не нужны, можно сознательно сдвинуть offset'ы: `kafka-consumer-groups.sh --reset-offsets --to-datetime ... --execute` при остановленной группе.

**Что хотят услышать:** не «добавлю consumer'ов», а последовательность «где стоит → почему → что масштабировать», плюс понимание, что добавление consumer'ов упирается в число партиций и в пропускную способность зависимостей.

## Как ускорить обработку, если добавление consumer'ов больше не помогает?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-kak-uskorit-obrabotku-esli-dobavlenie-consumer-ov-bolshe-ne-pomogaet
tags: lag, scalability
```

Добавление consumer'ов перестаёт помогать в двух случаях: consumer'ов уже столько же, сколько партиций, или узкое место не в consumer'ах, а в зависимости (БД, внешний API) или горячей партиции. Дальше ускоряют не количеством экземпляров, а эффективностью обработки: батчи вместо поштучных вызовов, параллелизм внутри consumer'а по ключу, асинхронный I/O; и только потом — больше партиций.

**Сначала — где предел.** Если consumer'ов меньше, чем партиций, но рост ничего не даёт, упёрлись в зависимость: больше экземпляров = больше конкурентных запросов к той же БД. Если lag сосредоточен в одной партиции, это горячий ключ — его не распараллелить добавлением партиций.

**1. Батчевая обработка.** Самый большой выигрыш обычно здесь: одна вставка на 500 строк вместо 500 round-trip'ов.

```csharp
var batch = new List<ConsumeResult<string, string>>(500);
var deadline = DateTime.UtcNow.AddMilliseconds(200);

while (batch.Count < 500 && DateTime.UtcNow < deadline)
{
    var r = consumer.Consume(TimeSpan.FromMilliseconds(50));
    if (r != null) batch.Add(r);
}
if (batch.Count > 0)
{
    await repository.BulkUpsertAsync(batch.Select(Map), ct);   // COPY / bulk insert / upsert
    consumer.Commit(batch.Last());                               // для одной партиции; в общем случае — max offset по каждой
}
```

**2. Параллелизм внутри consumer'а.** Одна партиция обрабатывается несколькими воркерами, но сообщения одного ключа — строго последовательно в одном воркере (`hash(key) % N`). Offset коммитится только до самого старого незавершённого сообщения. В Java это готовая библиотека Confluent Parallel Consumer; в .NET обычно пишут на `Channel<T>` по воркерам.

**3. Убрать блокирующие операции:**

- синхронный `Commit()` на каждое сообщение → `StoreOffset` + периодический автокоммит сохранённых offset'ов (`EnableAutoOffsetStore = false`);
- ретраи с задержкой внутри обработчика → retry-топики;
- последовательные внешние вызовы → `Task.WhenAll` в пределах ключа, кэш справочников.

**4. Настройки fetch.** Если consumer часто простаивает в ожидании данных, крупнее fetch'и: `FetchMinBytes`, `FetchMaxBytes`, `MaxPartitionFetchBytes`. Эффект обычно заметен меньше, чем от батчинга обработки.

**5. Увеличить число партиций.** Даёт больший предел для горизонтального масштабирования, но ломает маппинг ключей и порядок на время переходного периода; обратно уменьшить нельзя. Для keyed-топиков иногда проще создать новый топик с большим числом партиций и мигрировать.

**6. Разделить работу.** Лёгкая часть обработки (валидация, запись сырого события) — в одном consumer'е, тяжёлая (обогащение, внешние вызовы) — асинхронно через следующий топик со своим числом партиций и масштабированием.

**7. Share groups (KIP-932, «очереди для Kafka»).** В Kafka 4.x появились share groups, где несколько consumer'ов читают одну партицию с поштучным подтверждением, без привязки партиции к одному участнику. Порядок при этом не гарантируется; статус фичи (early access / preview / GA) и поддержку клиентом нужно проверять для своей версии.

**Что спрашивают дальше:** как коммитить offset'ы при параллельной обработке, чтобы не потерять сообщения при падении, и что будет с порядком при увеличении партиций.

## Как сохранить порядок сообщений при параллельной обработке внутри одного consumer'а?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-kak-sohranit-poryadok-soobschenii-pri-parallelnoi-obrabotke-vnutri-odn
tags: ordering, concurrency
```

Параллелят не по сообщениям, а по ключам: все сообщения одного ключа направляются в один и тот же воркер (`hash(key) % N`) и обрабатываются им последовательно, разные ключи — параллельно. Вторая половина задачи — offset'ы: коммитить можно только до первого ещё не обработанного сообщения партиции, иначе при падении часть сообщений будет потеряна.

**Уровни порядка:**

| Стратегия | Порядок | Параллелизм |
| --- | --- | --- |
| Последовательно по партиции | вся партиция | = число партиций |
| По ключу (key-ordered) | внутри ключа | число активных ключей |
| Без упорядочивания | нет | максимальный |

Обычно бизнесу нужен только порядок внутри ключа (события одного заказа), так что key-ordered даёт 10–100× параллелизма без нарушения семантики.

**Реализация на `Channel<T>`:**

```csharp
var workers = Enumerable.Range(0, 16)
    .Select(_ => Channel.CreateBounded<ConsumeResult<string, string>>(1000))
    .ToArray();

// воркеры: каждый читает свой канал последовательно
foreach (var ch in workers)
    _ = Task.Run(async () =>
    {
        await foreach (var r in ch.Reader.ReadAllAsync(ct))
        {
            await HandleAsync(r, ct);
            tracker.Complete(r.TopicPartition, r.Offset);
        }
    });

// poll-цикл: только раздаёт
while (!ct.IsCancellationRequested)
{
    var r = consumer.Consume(ct);
    tracker.Register(r.TopicPartition, r.Offset);
    var idx = (int)((uint)StableHash(r.Message.Key) % (uint)workers.Length);
    await workers[idx].Writer.WriteAsync(r, ct);   // bounded → естественный backpressure
}
```

`StableHash` — детерминированный хэш (например, xxHash или FNV); `string.GetHashCode()` в .NET рандомизирован между процессами, хотя внутри одного процесса он тоже подойдёт.

**Отслеживание offset'ов.** Сообщения 10, 11, 12 партиции ушли в разные воркеры; 11 и 12 готовы, 10 ещё в работе. Коммитить 13 нельзя — при падении 10 потеряется. Tracker хранит по каждой партиции множество незавершённых offset'ов и периодически коммитит `min(незавершённые)` либо `последний выданный + 1`, если незавершённых нет. После падения переобработаются 11 и 12 — нужна идемпотентность.

**Детали, о которых спрашивают:**

- **Backpressure.** Bounded-каналы; если воркеры не успевают, poll-цикл блокируется на `WriteAsync` — но нельзя выйти за `max.poll.interval.ms`. Надёжнее ставить партиции на паузу (`consumer.Pause`) при заполнении и возобновлять (`Resume`), продолжая вызывать `Consume`.
- **Rebalance.** В `PartitionsRevoked` нужно дождаться (или отменить) обработки отзываемых партиций и закоммитить готовое, иначе новый владелец начнёт параллельно обрабатывать те же ключи — порядок и идемпотентность нарушатся.
- **Горячий ключ** всё равно обрабатывается одним воркером — параллелизм по ключам не спасает от перекоса.
- **Ретраи.** Если сообщение ключа ушло на retry, последующие сообщения этого ключа должны ждать его или тоже уйти в retry, иначе порядок нарушится.

**Готовые решения:** в Java — Confluent Parallel Consumer с режимами `PARTITION`, `KEY`, `UNORDERED` и кодированием незавершённых offset'ов в commit metadata. В .NET готового стандарта нет, обычно пишут своё по схеме выше.

## Как работает min.insync.replicas и что произойдёт при потере реплик?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-kak-rabotaet-min-insync-replicas-i-chto-proizoidet-pri-potere-replik
tags: replication, durability
```

`min.insync.replicas` — минимальный размер ISR, при котором лидер принимает запись от producer'а с `acks=all`. Если ISR сжался ниже этого порога, запись отклоняется с `NOT_ENOUGH_REPLICAS`: Kafka выбирает недоступность записи вместо риска потери. Чтение при этом продолжается, а producer'ы с `acks=0/1` порог не проверяют вообще.

**Зачем он нужен.** `acks=all` означает «все реплики из текущего ISR», а не «все реплики». Если два follower'а отстали и выпали из ISR, в нём остаётся только лидер, и `acks=all` фактически становится `acks=1`. `min.insync.replicas=2` гарантирует, что подтверждённая запись лежит минимум на двух брокерах.

**Стандартная конфигурация — RF=3, `min.insync.replicas=2`:**

| Живых реплик в ISR | `acks=all` запись | Чтение | Комментарий |
| --- | --- | --- | --- |
| 3 | работает | работает | норма |
| 2 | работает | работает | переживаем потерю одного брокера — rolling-рестарт без простоя |
| 1 | `NotEnoughReplicas` | работает | партиция доступна только на чтение для надёжных producer'ов |
| 0 | лидера нет | нет | партиция offline, ждём возврата реплики из ISR |

Отсюда правило: `min.insync.replicas = RF - 1`. Варианты вроде RF=2, `min.isr=2` означают, что рестарт любого брокера останавливает запись; RF=3, `min.isr=3` — то же самое.

**Нюансы:**

- **Дефолт брокера — 1**, то есть защиты нет. Задают на брокере (`min.insync.replicas`) или на топике. В KRaft-кластере это обычная динамическая конфигурация.
- **`NOT_ENOUGH_REPLICAS_AFTER_APPEND`** — лидер записал сообщение, но ISR сжался до подтверждения. Producer получит ошибку и сделает ретрай; без идемпотентности — дубль.
- **Когда реплика выпадает из ISR** — если не догнала лидера дольше `replica.lag.time.max.ms` (30 с). Медленный диск или сеть одного брокера может сжимать ISR без падения.
- **Проверка ISR — при записи, а не при создании.** Топик с RF=3 спокойно создаётся и работает, пока реплик хватает.

**Что видит producer в .NET.** `NotEnoughReplicas` — retriable-ошибка: librdkafka ретраит её до `message.timeout.ms`, и только потом delivery report вернёт ошибку. Приложение в это время копит сообщения в буфере.

```csharp
try { await producer.ProduceAsync("payments", msg, ct); }
catch (ProduceException<string, string> ex)
    when (ex.Error.Code is ErrorCode.NotEnoughReplicas or ErrorCode.Local_MsgTimedOut)
{
    // сообщение не сохранено надёжно — outbox/повтор/отказ клиенту, но не «успех»
}
```

**Мониторинг:** `UnderMinIsrPartitionCount` и `UnderReplicatedPartitions` на брокерах, `IsrShrinksPerSec`/`IsrExpandsPerSec`. Under-min-ISR — алерт уровня «прямо сейчас»: запись в эти партиции уже не проходит.

**Выбор лидера при потере реплик.** При `unclean.leader.election.enable=false` (дефолт) лидером может стать только реплика из ISR. В Kafka 4.x развивается ELR (Eligible Leader Replicas, KIP-966) — механизм, который позволяет безопасно выбирать лидера из реплик, выпавших из ISR, но гарантированно имеющих все подтверждённые записи, что уменьшает число ситуаций «партиция offline». Наличие и дефолтное включение зависит от версии.

## Что случится с продюсером, если брокер станет недоступен, и как не потерять сообщения?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-chto-sluchitsya-s-prodyuserom-esli-broker-stanet-nedostupen-i-kak-ne-p
tags: resilience, durability
```

Если недоступен один брокер, producer обновит метаданные и продолжит писать новым лидерам его партиций — обычно это секунды ретраев без участия приложения. Если недоступен весь кластер (или все реплики нужных партиций), сообщения копятся в локальном буфере клиента, пока не истечёт таймаут доставки или не переполнится буфер; после этого они теряются, если приложение не обработало ошибку. Не терять — значит правильно настроить надёжность, всегда проверять результат доставки и иметь план на долгую недоступность (outbox).

**Что происходит внутри клиента:**

1. `Produce` кладёт сообщение в локальную очередь и сразу возвращается. Отправка идёт в фоновом потоке librdkafka батчами.
2. Брокер не отвечает → клиент ретраит, периодически обновляет метаданные, ищет нового лидера партиции.
3. Сообщение живёт в очереди до `message.timeout.ms` (librdkafka, 300 с; в Java — `delivery.timeout.ms`, 120 с). По истечении — delivery report с `Local_MsgTimedOut`.
4. Если очередь заполнена (`queue.buffering.max.messages` / `queue.buffering.max.kbytes`), `Produce` бросает `ProduceException` с `Local_QueueFull`. В Java аналог — блокировка `send()` до `max.block.ms`, затем исключение.
5. При завершении процесса без `Flush` всё, что лежит в очереди, пропадает.

**Типичные потери и их причины:**

| Ошибка | Результат |
| --- | --- |
| `Produce(...)` без обработчика delivery report | тихая потеря по таймауту |
| Нет `Flush` при остановке (SIGTERM в Kubernetes) | потеря хвоста очереди |
| `acks=1` / нет `min.insync.replicas` | потеря подтверждённого при падении лидера |
| Ответ клиенту «OK» сразу после `Produce` | пользователь думает, что операция прошла |
| Ловим `Local_QueueFull` и игнорируем | потеря при длительном сбое |

**Надёжная конфигурация и код:**

```csharp
var producer = new ProducerBuilder<string, string>(new ProducerConfig
{
    BootstrapServers = "kafka-1:9092,kafka-2:9092,kafka-3:9092", // не один адрес
    Acks = Acks.All,
    EnableIdempotence = true,
    MessageTimeoutMs = 120000
}).Build();

try
{
    var r = await producer.ProduceAsync("orders", msg, ct);   // ждём подтверждения
}
catch (ProduceException<string, string> ex)
{
    // Local_MsgTimedOut, Local_QueueFull, NotEnoughReplicas...
    await fallback.SaveAsync(msg, ex.Error, ct);              // не «проглатывать»
}

// при остановке приложения
producer.Flush(TimeSpan.FromSeconds(30));
```

Для высокой нагрузки вместо `await` на каждое сообщение используют `Produce` с колбэком, но колбэк обязательно проверяет `report.Error.IsError`.

**Что делать с долгой недоступностью.** Буфер клиента в памяти и конечен. Если нельзя ни потерять событие, ни отказать клиенту:

- **Transactional Outbox** — событие пишется в БД вместе с бизнес-данными, relay публикует его, когда Kafka вернётся. Лучший вариант для доменных событий.
- **Локальный durable-буфер** (файл/SQLite) — для агентов и edge-устройств без своей БД.
- **Fail fast** — вернуть клиенту 503 и дать ему повторить, если синхронный ответ не требует гарантии публикации.

**Про увеличение таймаута.** Большой `message.timeout.ms` переживёт более длинный сбой, но увеличит память и задержку, а при бесконечном ожидании один «застрявший» топик заполнит очередь и заблокирует запись во все остальные. Лучше конечный таймаут и явный fallback.

**Дубли после восстановления.** Ретраи после неясного ответа при идемпотентном producer'е дублей не создают, но повторная отправка из outbox/fallback — создаёт. Consumer'ам всё равно нужна дедупликация по id события.

## Как безопасно увеличить число партиций в работающем топике?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-kak-bezopasno-uvelichit-chislo-particii-v-rabotayuschem-topike
tags: partitioning, operations
```

Технически это одна команда, и данные не переезжают: `kafka-topics.sh --alter --partitions N`. Опасность в другом — у keyed-топиков меняется `hash(key) % N`, и новые сообщения многих ключей начинают попадать в другие партиции, из-за чего на переходном периоде нарушается порядок по ключу. Безопасно увеличивать — значит заранее решить, важен ли порядок, и если важен, провести переход с «осушением» или через новый топик.

```bash
kafka-topics.sh --bootstrap-server kafka:9092 --describe --topic orders
kafka-topics.sh --bootstrap-server kafka:9092 --alter --topic orders --partitions 24
```

Уменьшить число партиций нельзя — только пересоздать топик.

**Что происходит после увеличения:**

- Старые данные остаются в старых партициях, новые партиции пустые.
- Producer'ы узнают о новых партициях при следующем обновлении метаданных (`topic.metadata.refresh.interval.ms` в librdkafka, `metadata.max.age.ms` в Java, по умолчанию 5 минут), поэтому часть producer'ов какое-то время пишет по старой схеме, а часть — по новой.
- Consumer group получает rebalance и начинает читать новые партиции. Для них важен `auto.offset.reset`: если группа не увидит новую партицию до того, как в неё начнут писать, при `latest` первые сообщения будут пропущены. Для топиков, куда могут добавлять партиции, ставят `earliest`.

**Почему ломается порядок.** Ключ `order-42` до изменения жил в партиции 3, после — в 17. В партиции 3 ещё могут лежать необработанные события этого заказа, а новые уже появились в 17 и могут быть обработаны другим consumer'ом раньше. Для событий «создан → оплачен → отменён» это означает обработку не по порядку.

**Варианты по степени строгости:**

| Ситуация | Подход |
| --- | --- |
| Ключей нет или порядок не важен | просто `--alter`, `auto.offset.reset=earliest` |
| Порядок важен, короткая пауза допустима | остановить producer'ов → дождаться lag = 0 → увеличить партиции → запустить consumer'ов, затем producer'ов |
| Порядок важен, остановка невозможна | новый топик с нужным числом партиций, dual write или перекладка, переключение consumer'ов после того, как старый топик вычитан |
| Порядок важен, но обработчик устойчив | версионирование сущностей: consumer отбрасывает событие, если у него версия ниже уже применённой |

**Сопутствующие последствия:**

- **Kafka Streams и join'ы** — co-partitioning нарушится: входные топики join'а должны иметь одинаковое число партиций, иначе приложение упадёт на старте. Внутренние repartition- и changelog-топики тоже нужно учитывать; для Streams-приложений обычно правильнее новый топик и reset приложения.
- **Compacted-топики** — после изменения старое значение ключа остаётся в старой партиции и не будет затёрто новым из другой; при восстановлении состояния с начала топика возможны «воскресшие» значения.
- **Нагрузка на кластер** — новые партиции размещаются на брокерах; проверьте распределение лидеров, при необходимости переназначьте (`kafka-reassign-partitions.sh`, Cruise Control).
- **Лимиты** — каждая партиция стоит файловых дескрипторов, памяти и времени восстановления; KRaft поднял потолок по числу партиций в кластере, но он не бесконечен.

**Профилактика:** закладывать число партиций с запасом под пиковую нагрузку на годы вперёд — дешевле, чем миграция.

## Как обрабатывать poison message, не останавливая обработку всей партиции?

```yaml
category: kafka
level: senior
difficulty: 4
slug: kafka-advanced-kak-obrabatyvat-poison-message-ne-ostanavlivaya-obrabotku-vsei-partici
tags: error-handling, resilience
```

Нужно отличать «сообщение плохое» от «сломалась зависимость» и для первого случая быстро выводить сообщение из партиции: после ограниченного числа попыток отправить его в dead letter topic с метаданными об ошибке, закоммитить offset и идти дальше. Партиция тогда стоит только на время нескольких быстрых попыток, а не бесконечно.

**Классификация ошибок — главное решение:**

| Тип | Примеры | Реакция |
| --- | --- | --- |
| Неисправимые (poison) | невалидный JSON, неизвестная версия схемы, нарушение бизнес-инварианта, `NullReferenceException` на данных | сразу в DLT, без ретраев |
| Временные | таймаут БД, 503 от API, deadlock | ретраи с backoff; если долго — retry-топик |
| Системные | БД лежит целиком | не слать всё в DLT: поставить consumer на паузу / остановить, иначе DLT заполнится нормальными сообщениями |

Последняя строка — частая ошибка: при аварии БД наивный обработчик отправляет в DLT весь поток за час.

**Десериализация — отдельный случай.** Если десериализатор указан в `ConsumerBuilder`, ошибка прилетит как `ConsumeException` до вашего кода. Надёжнее читать байты и десериализовать самим — тогда сырое сообщение всегда доступно для DLT:

```csharp
var consumer = new ConsumerBuilder<string, byte[]>(config).Build();

while (!ct.IsCancellationRequested)
{
    var r = consumer.Consume(ct);
    try
    {
        var evt = Deserialize(r.Message.Value);        // может бросить
        await handler.HandleAsync(evt, ct);
    }
    catch (Exception ex) when (IsPermanent(ex))
    {
        await SendToDltAsync(r, ex, ct);               // ждём подтверждения записи в DLT
    }
    consumer.StoreOffset(r);                           // offset двигается в обоих случаях
}
```

**Что класть в DLT:** исходные ключ, value и headers без изменений (чтобы можно было переиграть), плюс headers с метаданными — исходный topic/partition/offset, тип и текст ошибки, время, число попыток, имя сервиса. Ключ сохраняют исходный, чтобы при переигрывании сохранился порядок по ключу.

**Критичные детали:**

- **Offset коммитится только после успешной записи в DLT.** Если DLT недоступен, лучше остановиться, чем потерять сообщение.
- **Порядок по ключу.** Если событие заказа ушло в DLT, следующие события того же заказа могут быть бессмысленны без него. Для строгих сценариев ведут список «заблокированных» ключей и отправляют их последующие сообщения в DLT тоже (или в «парковочный» топик) до разбора.
- **Лимит на DLT-поток.** Алерт на рост DLT и circuit breaker: если за минуту в DLT ушло больше N% сообщений — это не poison, а системная проблема, consumer стоит остановить.
- **Разбор DLT.** Отдельный consumer или инструмент для просмотра и переотправки в исходный топик после исправления. Без процесса разбора DLT превращается в кладбище.

**Что с уже упавшим consumer'ом в цикле рестартов.** Если сообщение валит процесс (например, OOM на огромном payload'е), обработчик не успевает его классифицировать. Лечение — ограничение размера (`max.partition.fetch.bytes`, проверка размера до десериализации), а как аварийная мера — ручной сдвиг offset'а группы на следующее сообщение при остановленной группе: `kafka-consumer-groups.sh --reset-offsets --shift-by 1 --topic orders:3 --execute`.

## Как реализовать retry с задержкой, не блокируя партицию?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-kak-realizovat-retry-s-zaderzhkoi-ne-blokiruya-particiyu
tags: retries, architecture
```

Упавшее сообщение не ждут в основном consumer'е, а перекладывают в отдельный retry-топик и коммитят исходный offset — основная партиция сразу идёт дальше. Consumer retry-топика обрабатывает сообщение только когда наступило его время (`timestamp + delay`), а если попытки кончились, отправляет его в DLT. Цена — потеря порядка для этого ключа, поэтому схема подходит, когда порядок не критичен или защищён отдельно.

**Почему нельзя просто `Task.Delay` в обработчике.** Партиция читается последовательно: 30 с ожидания одного сообщения — 30 с простоя для всех остальных ключей этой партиции. А если задержка больше `max.poll.interval.ms`, consumer вылетит из группы и начнётся rebalance.

**Топология с нарастающими задержками:**

```text
orders ──fail──> orders.retry.10s ──fail──> orders.retry.1m ──fail──> orders.retry.10m ──fail──> orders.dlt
```

Каждый retry-топик имеет фиксированную задержку. Это важно: внутри топика сообщения идут по времени записи, поэтому если первое ещё не «созрело», последующие тоже не созрели, и consumer может просто ждать первого. Смешанные задержки в одном топике ломают этот приём.

**Consumer retry-топика — ждать через `Pause`, а не блокировать poll:**

```csharp
var r = consumer.Consume(TimeSpan.FromMilliseconds(100));
if (r is null) { ResumeDuePartitions(); continue; }

var dueAt = DateTime.Parse(Header(r, "retry-due-at"), null, DateTimeStyles.RoundtripKind);
if (dueAt > DateTime.UtcNow)
{
    consumer.Pause(new[] { r.TopicPartition });
    consumer.Seek(r.TopicPartitionOffset);           // перечитать это сообщение позже
    ScheduleResume(r.TopicPartition, dueAt);          // Resume в poll-потоке по наступлении времени
    continue;
}

try { await handler.HandleAsync(r, ct); }
catch (Exception ex) when (IsTransient(ex))
{
    await ForwardAsync(r, NextTopic(r), attempt: Attempt(r) + 1, ex, ct); // retry.1m / dlt
}
consumer.StoreOffset(r);
```

`Consume` продолжают вызывать и во время паузы — так consumer остаётся в группе, а `max.poll.interval.ms` не срабатывает. `Pause/Resume` и `Seek` вызываются из потока poll-цикла.

**Метаданные в headers:** номер попытки, исходный topic/partition/offset, время следующей попытки, последняя ошибка. Ключ сообщения сохраняется, чтобы партиционирование в retry-топиках было тем же.

**Порядок — главный компромисс.** Пока событие A заказа 42 ждёт в retry, событие B того же заказа уже обработано из основного топика. Варианты:

- принять, если события независимы (уведомления, метрики);
- версионировать сущность и отбрасывать устаревшие события;
- держать реестр ключей «в ретрае» (в БД/кэше) и отправлять последующие сообщения этих ключей следом в retry-топик, пока первое не пройдёт.

**Альтернативы:**

- **Короткие in-process ретраи** (Polly, 3 попытки за ~1 с) перед retry-топиком — отсекают большинство мимолётных сбоев без лишней инфраструктуры.
- **Пауза всей партиции** при системной ошибке (БД недоступна) — все сообщения всё равно будут падать, перекладывать их в retry бессмысленно.
- **Готовые реализации** — non-blocking retries в Spring Kafka (`@RetryableTopic`); в .NET аналогичную топологию дают библиотеки вроде KafkaFlow, либо её пишут вручную.

**Что ещё уточнят:** идемпотентность обязательна (сообщение может быть переложено и обработано повторно при падении между `Forward` и коммитом), а число retry-топиков и их retention нужно учитывать при планировании кластера.

## Как построить consumer на 100 000 сообщений в секунду и что станет узким местом?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-kak-postroit-consumer-na-100-000-soobschenii-v-sekundu-i-chto-stanet-u
tags: throughput, performance
```

Сам Kafka-клиент 100 000 сообщений в секунду выдерживает легко — librdkafka на одном ядре читает сотни тысяч небольших сообщений. Узким местом почти всегда становится то, что вы делаете с сообщением: запись в БД, внешние вызовы, десериализация и аллокации, коммиты. Поэтому архитектура строится от бюджета: 100k msg/s — это 10 мкс на сообщение на одно ядро, или 1 мс на сообщение при 100 параллельных исполнителях.

**Шаг 1. Посчитать.** 100k msg/s × 1 КБ = ~100 МБ/с входящего трафика (плюс репликация на брокерах). При 1 мс на обработку сообщения нужен параллелизм ≥ 100. Если порядок нужен по ключу, это 100+ партиций или параллелизм по ключам внутри consumer'а. Запас под пики и догон lag'а — ×2–3.

**Шаг 2. Партиции и экземпляры.** Например, 48–96 партиций и 8–16 pod'ов, каждый читает 6 партиций и обрабатывает их параллельно (по партиции или по ключу). Один consumer на процесс — несколько `IConsumer` в одном процессе редко лучше, чем один с внутренним параллелизмом.

**Шаг 3. Не делать ничего поштучно:**

- **Батчи в БД** — `COPY`/bulk insert/`INSERT ... ON CONFLICT` на 500–5000 строк вместо поштучных запросов. Поштучная запись в PostgreSQL на 100k/s — первая стена, в которую упираются.
- **Асинхронные коммиты** — `EnableAutoOffsetStore = false` + `StoreOffset` после обработки + автокоммит раз в несколько секунд. Синхронный `Commit()` на каждое сообщение — round-trip к брокеру.
- **Внешние API** — батчевые эндпоинты, кэш справочников в памяти, ограничение конкуренции.

**Шаг 4. Настройки fetch (Confluent.Kafka):**

```csharp
var config = new ConsumerConfig
{
    BootstrapServers = "kafka:9092",
    GroupId = "ingest",
    EnableAutoCommit = true,
    EnableAutoOffsetStore = false,     // offset сохраняем сами после обработки
    AutoCommitIntervalMs = 5000,
    FetchMinBytes = 64 * 1024,         // не дёргать брокер ради пары сообщений
    FetchWaitMaxMs = 100,
    MaxPartitionFetchBytes = 4 * 1024 * 1024,
    QueuedMaxMessagesKbytes = 256 * 1024 // локальный prefetch-буфер librdkafka
};
```

Prefetch-буфер (`queued.min.messages`, `queued.max.messages.kbytes`) определяет, сколько данных librdkafka держит в памяти заранее — достаточно, чтобы обработка не ждала сеть, но не столько, чтобы съесть память pod'а.

**Шаг 5. CPU и GC в .NET.** На таком потоке аллокации на сообщение заметны:

- десериализация — System.Text.Json source generators, Protobuf/Avro вместо рефлексивного JSON;
- не создавать лишних строк из байтов, переиспользовать буферы (`ArrayPool`), Server GC;
- логирование на каждое сообщение отключить — одна строка лога на сообщение даёт 100k строк в секунду.

**Что станет узким местом — по частоте:**

| Место | Симптом |
| --- | --- |
| БД/внешняя система | высокий latency обработчика, растёт lag на всех партициях, CPU consumer'а низкий |
| Сериализация и GC | CPU pod'а 100%, частые GC gen0/gen1 |
| Горячая партиция | lag в одной партиции, один pod загружен |
| Коммиты / rebalance'ы | «пила» lag'а, всплески задержки при деплоях |
| Сеть и брокеры | высокий fetch latency, `BytesOutPerSec` брокеров у предела, throttling квотами |

**Проверка.** Нагрузочный тест (`kafka-producer-perf-test.sh` для генерации, `kafka-consumer-perf-test.sh` для базового предела клиента без обработки) плюс метрики: lag, throughput на pod, p99 обработки пачки, CPU/GC. Сначала меряют «голый» consume, потом добавляют обработку и видят, где теряется пропускная способность.

## Как настройки batching и linger.ms влияют на пропускную способность и задержку?

```yaml
category: kafka
level: senior
difficulty: 4
slug: kafka-advanced-kak-nastroiki-batching-i-linger-ms-vliyayut-na-propusknuyu-sposobnost
tags: throughput, performance
```

Producer не отправляет сообщения по одному: он копит их в батчи по партициям и отправляет батч, когда тот заполнился (`batch.size`) или истёк `linger.ms`. Чем больше батч, тем меньше запросов, накладных расходов и тем лучше сжатие — растёт throughput. Платой служит задержка: при слабом потоке сообщение может ждать в буфере до `linger.ms`, прежде чем уйдёт на брокер.

**Как работает накопление:**

1. `Produce` кладёт сообщение в локальную очередь партиции.
2. Сообщения одной партиции собираются в батч (record batch) — он сжимается целиком и пишется брокером в лог одним куском.
3. Батч уходит, когда выполнено одно из условий: достигнут лимит размера/числа сообщений, прошло `linger.ms` с момента первого сообщения в батче, вызван `Flush`.
4. Несколько батчей для партиций одного брокера объединяются в один `ProduceRequest`.

**Основные параметры (Confluent.Kafka / librdkafka):**

| Параметр | По умолчанию (librdkafka) | Влияние |
| --- | --- | --- |
| `LingerMs` (`linger.ms`) | 5 мс | сколько ждать добора батча |
| `BatchSize` (`batch.size`) | 1 000 000 байт | максимальный размер батча |
| `BatchNumMessages` | 10 000 | максимум сообщений в батче |
| `CompressionType` | none | lz4/zstd на больших батчах дают сжатие в разы |
| `QueueBufferingMaxMessages` / `QueueBufferingMaxKbytes` | 100 000 / 1 ГБ | объём локального буфера producer'а |

В Java-клиенте умолчания другие: `batch.size` = 16 КБ, `linger.ms` = 5 мс начиная с Kafka 4.0 (раньше было 0). Поэтому «один и тот же» конфиг на Java и .NET ведёт себя по-разному.

**Почему эффект нелинейный.** При высокой нагрузке батчи заполняются сами, пока предыдущий запрос ещё в полёте, — `linger.ms` почти ничего не добавляет к задержке. При слабом потоке именно `linger.ms` решает: 1 сообщение каждые 10 мс при `linger.ms = 50` превращается в батчи по 5 сообщений и +до 50 мс задержки.

**Профили:**

```csharp
var throughput = new ProducerConfig
{
    BootstrapServers = "kafka:9092",
    Acks = Acks.All,
    EnableIdempotence = true,
    LingerMs = 20,
    BatchSize = 1_000_000,
    CompressionType = CompressionType.Lz4
};

var lowLatency = new ProducerConfig
{
    BootstrapServers = "kafka:9092",
    Acks = Acks.All,
    LingerMs = 0
};
```

Для потоковой загрузки логов и событий `linger.ms` 10–100 мс и сжатие — обычная практика; для интерактивных команд, где пользователь ждёт ответа, — 0–5 мс.

**Главная ловушка в .NET** — последовательный `await` на каждое сообщение:

```csharp
foreach (var e in events)
    await producer.ProduceAsync("orders", Map(e));
```

Следующее сообщение попадает в буфер только после подтверждения предыдущего, поэтому каждый батч содержит одно сообщение, и никакой `linger.ms` не поможет. Правильно — `Produce` с delivery handler или запуск пачки `ProduceAsync` и `Task.WhenAll`.

**На что ещё влияет батчинг:**

- **Брокер.** Меньше запросов — меньше CPU и сетевых потоков; маленькие батчи на большом потоке нагружают брокер сильнее, чем объём данных.
- **Ограничения.** Сжатый батч не должен превышать `max.message.bytes` топика (по умолчанию ~1 МБ), иначе `MESSAGE_TOO_LARGE`.
- **Буфер.** Если брокер не успевает, локальная очередь заполняется и `Produce` бросает `ProduceException` с `Local_QueueFull` — это сигнал backpressure, а не повод бесконечно увеличивать буфер.
- **Таймауты.** Время в буфере входит в `message.timeout.ms` (`delivery.timeout.ms` в Java) — при перегрузке сообщения истекают ещё до отправки.

**Что спросят дальше:** как это сочетается с `acks=all` (задержка репликации добавляется к linger), почему порядок не нарушается при идемпотентном producer'е и нескольких запросах в полёте, и как измерять — по метрикам `batch-size-avg`, `record-queue-time-avg` в Java или статистике librdkafka (`StatisticsIntervalMs`).

## Как перенести обработку на новую схему сообщений без простоя?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-kak-perenesti-obrabotku-na-novuyu-shemu-soobschenii-bez-prostoya
tags: migration, schema
```

Сначала определить, совместимо ли изменение. Совместимое изменение (новое опциональное поле, поле с default) катится в том же топике: Schema Registry проверяет совместимость, а порядок деплоя producer'ов и consumer'ов задаёт режим совместимости. Несовместимое изменение (смена типа, переименование, другой смысл поля) делают через новый топик и период параллельной работы: обе версии живут одновременно, consumer'ы переходят по одному, старый топик выключают последним.

**Совместимые изменения — порядок деплоя:**

| Режим Schema Registry | Что гарантирует | Кого обновлять первым |
| --- | --- | --- |
| `BACKWARD` (по умолчанию) | новая схема читает старые данные | consumer'ов |
| `FORWARD` | старая схема читает новые данные | producer'ов |
| `FULL` | и то и другое | в любом порядке |
| `*_TRANSITIVE` | то же, но против всех прошлых версий | важно, если в топике лежат старые данные с долгим retention |

Типичный безопасный путь — «расширить, потом сузить»:

1. Добавить новое поле как опциональное, consumer'ы учатся его читать и работают без него.
2. Producer'ы начинают его заполнять.
3. Когда старых сообщений без поля не осталось (истёк retention или consumer'ы прошли их), поле можно сделать логически обязательным.
4. Удаление поля — тот же путь в обратную сторону: сначала все consumer'ы перестают его читать, потом producer'ы перестают писать.

Для JSON без реестра те же правила держит код: tolerant reader (неизвестные поля игнорируются, отсутствующие получают default) и поле `schemaVersion` в headers.

**Несовместимое изменение — новый топик:**

1. Создать `orders.v2` с новой схемой.
2. Producer пишет в оба топика (через Outbox — две записи в одной транзакции) либо отдельный сервис-транслятор читает `orders.v1` и публикует `orders.v2`. Транслятор проще: продюсер не трогается, а ключ сохраняется, значит, и партиционирование с порядком по ключу.
3. Consumer'ы по одному переключаются на v2. Новая consumer group стартует не с начала, а с момента переключения — offset'ы находят по времени (`OffsetsForTimes`):

```csharp
var since = DateTime.UtcNow.AddMinutes(-10);
var request = consumer.Assignment
    .Select(tp => new TopicPartitionTimestamp(tp, new Timestamp(since)))
    .ToList();
var offsets = consumer.OffsetsForTimes(request, TimeSpan.FromSeconds(10));
foreach (var o in offsets)
    consumer.Seek(o);
```

Небольшое перекрытие по времени неизбежно, поэтому обработчики должны быть идемпотентными (Inbox, upsert по ключу).

Последний шаг: когда lag всех consumer'ов v1 равен нулю и новых читателей нет, остановить запись в v1, удалить после retention.

**Смена логики обработки без смены схемы** (новый алгоритм, перестройка проекции) — blue/green consumer'ы: новая версия в отдельной consumer group читает топик с начала в новую таблицу, догоняет, затем чтение переключается на неё. Старая группа работает до момента переключения, простоя нет.

**Подводные камни:**

- `BACKWARD` без `TRANSITIVE` проверяет только против предыдущей версии — цепочка изменений может оказаться несовместимой с данными годичной давности, а replay их прочитает;
- compacted-топики хранят старые версии бесконечно: «дождаться retention» не сработает, нужна перезапись ключей;
- в переходный период перемешиваются версии внутри одной партиции, consumer должен уметь обе;
- dual-write без Outbox даёт расхождение топиков при сбое между двумя `Produce`.

**Что спросят дальше:** как откатиться (при переходе через новый топик — вернуть consumer'ов на v1, он всё ещё пишется), кто владеет схемой и как проверка совместимости встраивается в CI (maven/gradle плагины Schema Registry или вызов REST API `/compatibility` до деплоя).

## Что произойдёт при переполнении диска брокера и как это предотвратить?

```yaml
category: kafka
level: senior
difficulty: 5
slug: kafka-advanced-chto-proizoidet-pri-perepolnenii-diska-brokera-i-kak-eto-predotvratit
tags: operations, resilience
```

Когда запись в лог падает с `No space left on device`, брокер помечает этот log directory как offline. Если это единственный каталог (обычный случай), брокер останавливается; его партиции переходят к репликам на других брокерах. Опасность в каскаде: нагрузка распределена равномерно, поэтому остальные брокеры обычно заполнены почти так же и падают следом. Поднять заполненный брокер без освобождения места тоже нельзя — при старте ему нужно место для восстановления логов и индексов.

**Что видно снаружи по шагам:**

1. Первый брокер падает, лидерство его партиций переходит к follower'ам из ISR, а ISR сужается.
2. При `acks=all` и `min.insync.replicas=2` партиции с RF=3, потерявшие ещё одну реплику, начинают отклонять запись (`NOT_ENOUGH_REPLICAS`) — producer'ы ретраят, буферы забиваются, растёт latency.
3. Если в ISR партиции не осталось ни одной живой реплики, она становится offline (при `unclean.leader.election.enable=false` они ждут, без потери данных).
4. Consumer'ы продолжают читать уцелевшие партиции, остальные стоят.

Если `metadata.log.dir` в KRaft лежит на том же диске, что и данные, переполнение задевает и метаданные контроллера — поэтому его выносят на отдельный том.

**Почему диск вообще заполняется:**

- retention только по времени (`log.retention.hours=168` по умолчанию), а входящий поток вырос — объём = поток × RF × retention;
- `retention.bytes` задаётся **на партицию**, а не на топик — увеличение числа партиций увеличивает и лимит;
- удаляются только закрытые сегменты: активный сегмент живёт до `segment.bytes` (1 ГБ) или `segment.ms`;
- compacted-топик без tombstone'ов растёт вместе с числом уникальных ключей;
- перекос: горячие партиции или неудачное размещение реплик забивают один брокер раньше остальных;
- reassignment партиций без throttle временно удваивает объём перемещаемых данных.

**Восстановление:**

1. Остановить приток: квоты на крупных producer'ов, временно уменьшить `retention.ms` топиков через `kafka-configs.sh` (команда идёт через живых брокеров и контроллер).
2. Расширить том (в облаке и Kubernetes — увеличить PV) и поднять брокер; после старта он сам удалит сегменты по новому retention.
3. Ручное удаление старейших сегментов из каталога партиции — крайняя мера, только для остановленного брокера и только для партиций, у которых есть полные реплики на других брокерах.
4. Дождаться, пока under-replicated партиции догонят ISR, затем вернуть retention.

**Профилактика:**

- **Планирование ёмкости:** поток × RF × retention + запас 30–40% на перекосы, reassignment и рост.
- **Алерты** на заполненность диска (70% предупреждение, 85% критично) и на скорость роста — прогноз «до заполнения N часов» полезнее порога.
- **Ограничения объёма:** `retention.bytes` на партицию для топиков с непредсказуемым потоком, разумный retention по умолчанию для новых топиков, запрет автосоздания топиков (`auto.create.topics.enable=false`).
- **Квоты:** `producer_byte_rate` на client-id/пользователя, чтобы один сервис с багом в цикле не забил кластер.
- **Балансировка:** регулярный rebalancing реплик (Cruise Control или reassignment с `--throttle`).
- **Tiered storage** (production-ready с Kafka 3.9): старые сегменты уходят в объектное хранилище, на локальном диске остаётся только «горячий» хвост (`local.retention.ms`).
- **Отдельный диск** под метаданные KRaft, JBOD или несколько томов — сбой одного каталога выводит из строя только его партиции.

**Что спросят дальше:** почему нельзя просто полагаться на retention (он проверяется раз в `log.retention.check.interval.ms`, по умолчанию 5 минут, и не трогает активный сегмент), что будет с данными при unclean leader election, и как посчитать, сколько диска нужно под конкретный топик.
