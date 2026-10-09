# Раздел «Данные под нагрузкой» — исходники статей

Статьи трека `Распределённые системы` (`distributed`) → раздела `data-at-scale`.
Метаданные — во фронтматтере каждого файла, тело — markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной. Сначала посмотреть, что будет сделано:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/data-at-scale
```

Локально:

```bash
node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/data-at-scale
```

В прод пароль передаётся через переменную окружения, а не флагом: флаг виден
в списке процессов и остаётся в history шелла.

```bash
IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/data-at-scale
```

**Импорт берёт один каталог за раз**, по умолчанию `csharp-lang`, поэтому
`--dir` обязателен — без него раздел просто не зальётся, и ошибки не будет.

По умолчанию статьи создаются **черновиками** и существующие не трогаются.
`--update` обновляет по slug, `--publish` ставит статус «Опубликована».
Привязки к вопросам импорт не стирает: при обновлении они переносятся как есть.

Метаданные берутся из фронтматтера — `title`, `slug`, `track`, `section`,
`level`, `sortOrder`, `summary`. `readingMinutes` не задаётся: его считает
`AppDbContext.SaveChangesAsync` (200 слов в минуту, минимум 1).

Импорт идёт через админ-API, а не SQL: так работают валидация, генерация slug
и сброс кэша публичного дерева.

## Файлы и источник правды

**Источник правды — база.** Мелкие правки удобнее делать в админке
(`/admin/theory`). Если правите файл здесь — прогоните импорт с `--update`,
иначе версии разойдутся.

## Что куда

| Файл | Заголовок | Slug | Грейд | Порядок |
| --- | --- | --- | --- | --- |
| `01-shardirovanie-i-vybor-klyucha.md` | Шардирование и выбор ключа | `shardirovanie-i-vybor-klyucha` | middle | 1 |
| `02-reshardirovanie-bez-prostoya.md` | Решардинг без простоя | `reshardirovanie-bez-prostoya` | senior | 2 |
| `03-replikaciya-i-failover.md` | Репликация и failover | `replikaciya-i-failover` | middle | 3 |
| `04-keshirovanie.md` | Кэширование | `keshirovanie` | middle | 4 |
| `05-cache-stampede.md` | Cache stampede | `cache-stampede` | senior | 5 |
| `06-partitsionirovanie-dannyh.md` | Партиционирование | `partitsionirovanie-dannyh` | middle | 6 |

Все шесть — трек `distributed`, раздел `data-at-scale`. Источник материала —
категория каталога `system-design` (шардирование, решардинг, кэш, stampede,
деградация без Redis), плюс вопросы про репликацию и партиционирование
из `postgresql` и про read-your-writes и выбор лидера из `distributed-systems`.

## Границы с соседними разделами

- `postgresql` → `Партиционирование` и `Репликация` разбирают механику одной
  базы: секции, pruning, WAL, слоты, `synchronous_commit`. Здесь — взгляд
  на систему из многих узлов, на них только ссылки.
- `system-design-basics` → `Вертикальное и горизонтальное масштабирование`,
  `SQL vs NoSQL` — когда вообще пора делить данные.
- `consistency` → `Модели согласованности`, `Read-your-writes`, `Выбор лидера`,
  `Распределённые блокировки` — теория, на которую опираются статьи
  про репликацию и lease.
- `reliability` → `Circuit breaker`, `RTO/RPO и disaster recovery`.
- `messaging` → `Партиции и порядок событий` — партиции Kafka подробно.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Если трек `distributed` ещё не опубликован, статьи не появятся на сайте даже
после `--publish`.

## Раздел написан целиком

Все 6 статей по плану (`THEORY_PLAN.md`) написаны. Замеров рантайма в разделе
нет: утверждения касаются поведения Redis, Citus, Cassandra, DynamoDB,
ClickHouse и PostgreSQL и сверены с их документацией. Значения по умолчанию,
которые стоит перепроверять при обновлении версий: `citus.shard_count` (32),
`cluster-node-timeout` Redis (15 с), `down-after-milliseconds` из примера
конфигурации Sentinel (30 с), `maxmemory-policy` (`noeviction`),
`maxmemory-samples` (5), таймауты `StackExchange.Redis` (5 с).
