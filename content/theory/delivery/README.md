# Раздел «Доставка» — исходники статей

Статьи трека `Инфраструктура` (`infrastructure`) → раздела `delivery`.
Метаданные — во фронтматтере каждого файла, тело — markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/delivery

node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/delivery

IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/delivery --publish
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
| `01-ci-cd-payplayn.md` | CI/CD-пайплайн | `ci-cd-payplayn` | senior | 1 |
| `02-rolling-blue-green-canary.md` | Rolling, blue-green, canary | `rolling-blue-green-canary` | senior | 2 |
| `03-migracii-bd-pri-neskolkih-replikah.md` | Миграции БД при нескольких репликах | `migracii-bd-pri-neskolkih-replikah` | senior | 3 |
| `04-sekrety-i-rotaciya.md` | Секреты и ротация | `sekrety-i-rotaciya` | senior | 4 |

Все четыре — трек `infrastructure`, раздел `delivery`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек `infrastructure` сидер создаёт скрытым; включает его первый
опубликованный раздел — см. README раздела `containers`.

## Раздел написан целиком

Все 4 статьи по плану (`THEORY_PLAN.md`) написаны. Источник материала —
ответы категории `devops` из `content/questions/devops.md`, переписанные
в связный текст.

Разделение с соседями: как EF Core вычисляет миграции, что лежит в
`__EFMigrationsHistory` и как построить индекс `CONCURRENTLY` — в статье
`Миграции` раздела `ef-core`; здесь — где и в каком порядке с раскаткой
их применять при нескольких репликах. Провайдеры конфигурации и
`IOptionsMonitor` — в `Конфигурация и options`. Метрики для анализа
canary и SLO — в разделе `observability`.

Сверено с документацией: переименование `--atomic` в `--rollback-on-failure`
в Helm 4 (старое имя работает с предупреждением), `--wait` без значения
в Helm 4 — стратегия `watcher`, `apiVersion: external-secrets.io/v1`
у External Secrets Operator, блокировка в `Migrate` с EF Core 9.
