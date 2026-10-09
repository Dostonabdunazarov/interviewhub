# Раздел «Kafka и очереди» — исходники статей

Статьи трека `Распределённые системы` (`distributed`) → раздела
`messaging`. Метаданные — во фронтматтере каждого файла, тело — markdown
под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/messaging

node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/messaging

IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/messaging
```

Первая команда показывает, что будет сделано, вторая заливает локально,
третья — в прод. Пароль для прода передаётся через переменную окружения,
а не флагом: флаг виден в списке процессов и остаётся в history шелла.

**Импорт берёт один каталог за раз** и по умолчанию читает `csharp-lang`,
поэтому `--dir` обязателен — без него этот раздел просто не зальётся,
и сообщения об ошибке не будет.

По умолчанию статьи создаются **черновиками** и существующие не трогаются.
`--update` обновляет по slug, `--publish` ставит статус «Опубликована».
Привязки к вопросам импорт не стирает: при обновлении они переносятся как есть.

Метаданные берутся из фронтматтера в начале каждого файла — `title`, `slug`,
`track`, `section`, `level`, `sortOrder`, `summary`. `readingMinutes` не задаётся:
его считает `AppDbContext.SaveChangesAsync` (200 слов в минуту, минимум 1).

## Файлы и источник правды

**Источник правды — база.** Мелкие правки удобнее делать в админке
(`/admin/theory`). Если правите файл здесь — прогоните импорт с `--update`,
иначе версии разойдутся.

## Что куда

| Файл | Заголовок | Slug | Грейд | Порядок |
| --- | --- | --- | --- | --- |
| `01-kafka-model.md` | Модель Kafka | `kafka-model` | middle | 1 |
| `02-kafka-particii-i-poryadok-sobytiy.md` | Партиции и порядок событий | `kafka-particii-i-poryadok-sobytiy` | middle | 2 |
| `03-kafka-consumer-groups.md` | Consumer groups | `kafka-consumer-groups` | middle | 3 |
| `04-kafka-garantii-dostavki.md` | Гарантии доставки | `kafka-garantii-dostavki` | senior | 4 |
| `05-kafka-retention-i-compaction.md` | Retention и compaction | `kafka-retention-i-compaction` | middle | 5 |
| `06-kafka-obrabotka-oshibok-i-dlq.md` | Обработка ошибок и DLQ | `kafka-obrabotka-oshibok-i-dlq` | senior | 6 |

Все шесть — трек `distributed`, раздел `messaging`. Слаги начинаются
с `kafka-`, чтобы не пересекаться с общими темами других разделов
(«идемпотентность», «партиционирование»).

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Если трек `distributed` к моменту импорта ещё скрыт, после публикации статей
его нужно включить переключателем «виден» в админке — сидер создаёт
треки скрытыми.

## Раздел написан целиком

Все 6 статей по плану (`THEORY_PLAN.md`) написаны. Источник материала —
ответы категории `kafka` из `content/questions/kafka.md`, переписанные
в связный текст.

Примеры на C# собраны против Confluent.Kafka 2.15.0 и Polly.Core 8.6
на .NET 10 (проект лежит в `.claude/tempfiles/theory-kafka/`, в git не
попадает): все сниппеты компилируются, против живого брокера не
запускались.

Дефолты сверены с документацией Apache Kafka и librdkafka:

- **producer**: в Java-клиенте с 3.0 `acks=all` и `enable.idempotence=true`;
  в librdkafka `acks=all` (`-1`), но `enable.idempotence=false`,
  `message.timeout.ms` 300 с, партиционер `consistent_random`;
  `linger.ms` 5 мс в librdkafka (с 2.0) и в Java-клиенте с Kafka 4.0
  (до этого 0);
- **consumer**: `session.timeout.ms` 45 с, `max.poll.interval.ms` 5 мин;
  `group.protocol` по умолчанию `classic`, KIP-848 GA в Kafka 4.0
  и в librdkafka 2.12;
- **share groups** (KIP-932): early access в 4.0, preview в 4.1,
  production-ready в 4.2;
- **retention и compaction**: `retention.ms` 7 дней, `delete.retention.ms`
  24 часа, активный сегмент не компактится.

Арифметика: поток 20 МБ/с × RF 3 × 7 дней ≈ 36 ТБ.

Не сверено с первоисточником в этой сессии, взято из ответов
`content/questions/kafka.md` и общих знаний: `min.cleanable.dirty.ratio` 0.5,
`segment.bytes` 1 ГиБ и `segment.ms` 7 дней, `offsets.retention.minutes`
7 дней, `replica.lag.time.max.ms` 30 с, tiered storage как
production-ready с 3.9.

Темы, которые здесь только упоминаются, раскрываются в соседних разделах:
идемпотентность, ретраи и circuit breaker — `reliability`, Raft и
недоверие к часам — `consistency`, Outbox и exactly-once между сервисами —
`microservices`, `Channel<T>` — `concurrency`, остановка сервиса —
`aspnet-core`.
