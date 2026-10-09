# Раздел «PostgreSQL» — исходники статей

Статьи трека `.NET Backend` → раздела `postgresql`. Метаданные — во
фронтматтере каждого файла, тело — markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной. Сначала посмотреть, что будет сделано:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/postgresql
```

Локально:

```bash
node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/postgresql
```

В прод — пароль через переменную окружения, а не флагом: флаг виден
в списке процессов и остаётся в history шелла.

```bash
IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/postgresql
```

По умолчанию статьи создаются **черновиками** и существующие не трогаются.
`--update` обновляет по slug, `--publish` ставит статус «Опубликована».
Привязки к вопросам импорт не стирает: при обновлении они переносятся как есть.

Метаданные берутся из фронтматтера в начале каждого файла — `title`, `slug`,
`track`, `section`, `level`, `sortOrder`, `summary`. `readingMinutes` не задаётся:
его считает `AppDbContext.SaveChangesAsync` (200 слов в минуту, минимум 1).

Импорт идёт через админ-API, а не SQL: так работают валидация, генерация slug
и сброс кэша публичного дерева. После прямого INSERT статья появилась бы
на сайте только через 15 минут и с нулевым временем чтения.

## Файлы и источник правды

**Источник правды — база.** Мелкие правки удобнее делать в админке
(`/admin/theory`). Если правите файл здесь — прогоните импорт с `--update`,
иначе версии разойдутся.

Автоматического сидера, который заливал бы эти файлы при старте, нет
намеренно: он конфликтовал бы с правками из админки, то есть дал бы
два источника правды на один текст. Импорт запускается руками и осознанно.

## Что куда

| Файл | Заголовок | Slug | Грейд | Порядок |
| --- | --- | --- | --- | --- |
| `01-indeksy-btree-gin-brin.md` | Индексы: B-tree, GIN, BRIN | `indeksy-btree-gin-brin` | middle | 1 |
| `02-explain-i-plan-zaprosa.md` | EXPLAIN и план запроса | `explain-i-plan-zaprosa` | middle | 2 |
| `03-mvcc-i-vacuum.md` | MVCC и vacuum | `mvcc-i-vacuum` | middle | 3 |
| `04-urovni-izolyacii.md` | Уровни изоляции | `pg-urovni-izolyacii` | middle | 4 |
| `05-blokirovki-i-deadlock.md` | Блокировки и deadlock | `pg-blokirovki-i-deadlock` | middle | 5 |
| `06-particionirovanie.md` | Партиционирование | `pg-particionirovanie` | senior | 6 |
| `07-replikaciya.md` | Репликация | `pg-replikaciya` | senior | 7 |
| `08-polnotekstovyy-poisk.md` | Полнотекстовый поиск | `polnotekstovyy-poisk` | middle | 8 |

Все восемь — трек `dotnet-backend`, раздел `postgresql`.

Префикс `pg-` у четырёх слагов — не случайность. Slug статьи глобально
уникален, а похожие темы есть в других разделах: уровни изоляции —
в `ef-core`, deadlock — в `concurrency`, партиционирование и репликация —
в `data-at-scale`. Префикс оставляет эти слаги свободными для тех статей.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек `dotnet-backend` уже опубликован, так что достаточно опубликовать статьи.

**Импорт берёт один каталог за раз**, поэтому нужен `--dir` — без него
скрипт возьмёт `csharp-lang` и этот раздел просто не зальётся.

## Раздел написан целиком

Все 8 статей по плану (`THEORY_PLAN.md`) написаны. Источник фактов —
ответы в `content/questions/postgresql.md`, переписанные связным текстом.
Поведение описано для PostgreSQL 15–17; то, что появилось в 18, помечено
явно (skip scan, `BUFFERS` по умолчанию в `EXPLAIN ANALYZE`).

Замеров в разделе нет, и это сознательно: локально нет ни Docker,
ни PostgreSQL, а проверять против прода нельзя. Поэтому:

- **вывод `EXPLAIN` везде иллюстративный** и помечен так в тексте —
  числа подобраны для наглядности, а не сняты с реальной базы;
- **значения по умолчанию** (уровень изоляции, пороги autovacuum,
  `deadlock_timeout`, `work_mem`, `synchronous_commit` и т. п.) взяты
  из документации, а не из памяти о конкретном сервере;
- **вывод `to_tsvector`** в статье про полнотекстовый поиск показан
  приблизительно: точные основы зависят от словаря Snowball.

При правках стоит прогнать спорные примеры на настоящем PostgreSQL
той же версии, что в проде, и заменить иллюстративные планы реальными.
