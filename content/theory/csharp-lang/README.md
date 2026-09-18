# Раздел «Язык C#» — исходники статей

Статьи трека `.NET Backend` → раздела `csharp-lang`. Метаданные — во
фронтматтере каждого файла, тело — markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
# Сначала посмотреть, что будет сделано:
node tools/import-theory.mjs --dry-run

# Локально:
node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!'

# В прод (пароль через переменную окружения, а не флагом:
# флаг виден в списке процессов и остаётся в history шелла):
IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@interview.hypex.site
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

| Файл | Заголовок | Slug | Порядок |
| --- | --- | --- | --- |
| `01-value-type-i-reference-type.md` | Value type и reference type: в чём разница | `value-type-i-reference-type` | 1 |
| `02-upakovka-i-raspakovka.md` | Упаковка и распаковка | `upakovka-i-raspakovka` | 2 |
| `03-class-struct-record.md` | class, struct и record: что выбрать | `class-struct-record` | 3 |
| `04-stroki-i-stringbuilder.md` | Строки и StringBuilder | `stroki-i-stringbuilder` | 4 |

Все четыре — трек `dotnet-backend`, раздел `csharp-lang`, грейд `middle`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек публикуется в админке переключателем «виден» — сидер создаёт треки
скрытыми намеренно, чтобы в сайдбаре не появился трек с одной статьёй
из тридцати.

## Остальные 8 статей раздела

По плану (`THEORY_PLAN.md`) в разделе 12 статей. Не написаны:
`Equals`, `GetHashCode`, `==` · Делегаты и события · LINQ и отложенное
выполнение · `IEnumerable` vs `IQueryable` · `yield return` · Nullable
reference types · Pattern matching · Ковариантность.
