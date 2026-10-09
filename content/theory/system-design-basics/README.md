# Раздел «Основы System Design» — исходники статей

Статьи трека `Распределённые системы` (`distributed`) → раздела
`system-design-basics`. Это первый раздел трека. Метаданные — во
фронтматтере каждого файла, тело — markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/system-design-basics

node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/system-design-basics

IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/system-design-basics
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
| `01-kak-prohodit-dizayn-sekciyu.md` | Как проходить дизайн-секцию | `kak-prohodit-dizayn-sekciyu` | middle | 1 |
| `02-funkcionalnye-i-nefunkcionalnye-trebovaniya.md` | Функциональные и нефункциональные требования | `funkcionalnye-i-nefunkcionalnye-trebovaniya` | middle | 2 |
| `03-ocenka-nagruzki-i-rps.md` | Оценка нагрузки и RPS | `ocenka-nagruzki-i-rps` | middle | 3 |
| `04-vertikalnoe-i-gorizontalnoe-masshtabirovanie.md` | Вертикальное и горизонтальное масштабирование | `vertikalnoe-i-gorizontalnoe-masshtabirovanie` | middle | 4 |
| `05-balansirovshchiki.md` | Балансировщики | `balansirovshchiki` | middle | 5 |
| `06-poisk-bottleneck.md` | Поиск bottleneck | `poisk-bottleneck` | senior | 6 |
| `07-sql-vs-nosql.md` | SQL vs NoSQL | `sql-vs-nosql` | middle | 7 |

Все семь — трек `distributed`, раздел `system-design-basics`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Это первый раздел трека `distributed`, поэтому после публикации статей
трек нужно включить переключателем «виден» в админке — сидер создаёт
треки скрытыми.

## Раздел написан целиком

Все 7 статей по плану (`THEORY_PLAN.md`) написаны. Источник материала —
ответы категории `system-design` из `content/questions/system-design.md`,
переписанные в связный текст.

Замеров в этом разделе нет: числа в статьях — оценки на собеседовании,
а не измерения. Арифметика в них перепроверена:

- **RPS из DAU**: 1M запросов в день ≈ 12 RPS; лента на 20M DAU даёт
  ≈ 4 630 RPS чтения в среднем и ≈ 13 900 в пике, запись ≈ 116 и ≈ 350;
- **хранение**: 10M постов по 500 B — 5 GB в день, ≈ 1.8 TB в год;
  мессенджер на 2B сообщений по 200 B — 400 GB в день, 146 TB в год;
- **доступность**: 99.9% — 43.2 минуты простоя в месяц, 99.99% — 4.32;
  две последовательные зависимости по 99.9% дают 99.8%;
- **хеширование по модулю**: при переходе с 4 узлов на 5 переезжает 80% ключей;
- **очередь**: ожидание растёт как ρ / (1 − ρ) — ×4 на 80% загрузки, ×9 на 90%.

Ориентиры мощности узлов (RPS на под, QPS PostgreSQL, ops/s Redis) даны
как порядки и в тексте прямо помечены «замерить».

Темы, которые здесь только упоминаются, раскрываются в следующих разделах
трека: репликация, шардирование и кэширование — `data-at-scale`,
ретраи, идемпотентность и gray failure — `reliability`, CAP и модели
согласованности — `consistency`, outbox и саги — `microservices`,
Kafka — `messaging`, полные разборы задач — `design-drills`.
