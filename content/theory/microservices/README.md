# Раздел «Микросервисы» — исходники статей

Статьи трека `Распределённые системы` (`distributed`) → раздела
`microservices`. Метаданные — во фронтматтере каждого файла, тело —
markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/microservices

node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/microservices

IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/microservices
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
| `01-granicy-servisov.md` | Границы сервисов | `ms-granicy-servisov` | middle | 1 |
| `02-sinhronnoe-vs-asinhronnoe-vzaimodeystvie.md` | Синхронное vs асинхронное взаимодействие | `sinhronnoe-vs-asinhronnoe-vzaimodeystvie` | middle | 2 |
| `03-saga.md` | Saga | `ms-saga` | senior | 3 |
| `04-outbox.md` | Outbox | `ms-outbox` | senior | 4 |
| `05-exactly-once-na-praktike.md` | Exactly-once на практике | `exactly-once-na-praktike` | senior | 5 |
| `06-versionirovanie-kontraktov.md` | Версионирование контрактов | `ms-versionirovanie-kontraktov` | senior | 6 |

Все шесть — трек `distributed`, раздел `microservices`. Префикс `ms-`
добавлен там, где slug без него был бы слишком общим для всего сайта.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек `distributed` включается переключателем «виден» в админке — сидер
создаёт треки скрытыми.

## Раздел написан целиком

Все 6 статей по плану (`THEORY_PLAN.md`) написаны. Источник материала —
ответы категорий `microservices`, `distributed-systems` и `kafka` из
`content/questions/`, переписанные в связный текст.

Замеров в этом разделе нет. Арифметика в тексте одна: четыре сервиса
по 99.9% в синхронной цепочке дают ≈ 99.6% — около трёх часов простоя
в месяц вместо 43 минут.

API библиотек сверены с документацией: транзакционный outbox MassTransit
для EF Core (`AddEntityFrameworkOutbox`, `UseBusOutbox`,
`AddTransactionalOutboxEntities`), транзакции Confluent.Kafka
(`InitTransactions`, `SendOffsetsToTransaction`, `CommitTransaction`).

Соседние разделы, на которые статьи ссылаются, а не повторяют их:
2PC и выбор лидера — `consistency`, ретраи, таймауты и идемпотентность —
`reliability`, транзакции EF Core и оптимистичная блокировка — `ef-core`,
версионирование REST API через `Asp.Versioning` — `aspnet-core`.
Гарантии доставки, партиции и DLQ в Kafka подробно раскрываются
в разделе `messaging`, полные разборы задач — в `design-drills`.
