# Раздел «Надёжность» — исходники статей

Статьи трека `Распределённые системы` (`distributed`) → раздела
`reliability`. Метаданные — во фронтматтере каждого файла, тело — markdown
под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/reliability

node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/reliability

IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/reliability
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
| `01-retry-jitter-i-retry-storm.md` | Retry, jitter и retry storm | `retry-jitter-i-retry-storm` | middle | 1 |
| `02-timeout-budget.md` | Timeout budget | `timeout-budget` | senior | 2 |
| `03-circuit-breaker.md` | Circuit breaker | `circuit-breaker` | middle | 3 |
| `04-backpressure.md` | Backpressure | `backpressure` | senior | 4 |
| `05-idempotentnost.md` | Идемпотентность | `idempotentnost` | middle | 5 |
| `06-gray-failure-i-health-checks.md` | Gray failure и health checks | `gray-failure-i-health-checks` | senior | 6 |
| `07-rto-rpo-i-disaster-recovery.md` | RTO/RPO и disaster recovery | `rto-rpo-i-disaster-recovery` | senior | 7 |

Все семь — трек `distributed`, раздел `reliability`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Если трек `distributed` к моменту импорта ещё скрыт, после публикации статей
его нужно включить переключателем «виден» в админке — сидер создаёт
треки скрытыми.

## Раздел написан целиком

Все 7 статей по плану (`THEORY_PLAN.md`) написаны. Источник материала —
ответы из `content/questions/distributed-systems.md`, `microservices.md`
и `system-design.md`, переписанные в связный текст.

Поведение .NET-кода проверено запуском на .NET 10 с
`Microsoft.Extensions.Http.Resilience` 10.10 (проекты лежат в
`.claude/tempfiles/theory-rel/`, в git не попадают):

- **ретраи**: дефолты `RetryStrategyOptions` и `HttpRetryStrategyOptions`,
  `POST` через стандартный обработчик уходит четыре раза,
  `DisableForUnsafeHttpMethods` отключает `POST`, `PUT`, `PATCH`, `DELETE`, `CONNECT`;
- **таймауты**: дефолты 30 с и 10 с, обе проверки валидации опций,
  общий таймаут 1000 мс при попытке 300 мс обрывает вызов после трёх попыток;
- **circuit breaker**: дефолты 0.1, 100, 30 с, 5 с, размыкание на
  `MinimumThroughput`, один пробный вызов в half-open;
- **backpressure**: код отказа rate limiter по умолчанию `503`, лимит 2 и очередь 2
  из десяти запросов пропускают четыре; в drop-режимах `Channel<T>`
  `TryWrite` всегда возвращает `true`, потеря видна только через `itemDropped`;
  Polly concurrency limiter отказывает `RateLimiterRejectedException`;
- **hedging**: дефолты стандартного обработчика (1 попытка, 2 с, 30 с, 10 с,
  breaker на endpoint), `POST` дублируется, `DisableForUnsafeHttpMethods` у hedging нет;
- **идемпотентность**: пример с EF Core и Npgsql компилируется, но против
  базы не запускался.

Арифметика: 4 × 4 × 4 = 64 запроса при трёх повторах на трёх уровнях,
3⁴ = 81 на четырёх хопах; очередь при 1200 RPS против 1000 RPS растёт
на 200 в секунду; восстановление 5 ТБ при 500 МБ/с — 10 000 с, почти три часа.

Не проверено запуском: дефолты outlier detection в Envoy (доля исключаемых 10%)
— по документации, а не по замеру.

Темы, которые здесь только упоминаются, раскрываются в соседних разделах:
liveness, readiness и остановка сервиса — `aspnet-core`, `Channel<T>` —
`concurrency`, репликация и failover — `data-at-scale`, CAP и модели
согласованности — `consistency`, outbox и exactly-once — `microservices`,
Kafka — `messaging`.
