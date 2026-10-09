# Раздел «ООП и SOLID» — исходники статей

Статьи трека `Код и архитектура` (`code-design`) → раздела `oop-solid`.
Метаданные — во фронтматтере каждого файла, тело — markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/oop-solid

node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/oop-solid

IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/oop-solid
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
| `01-inkapsulyaciya-nasledovanie-polimorfizm.md` | Инкапсуляция, наследование, полиморфизм | `inkapsulyaciya-nasledovanie-polimorfizm` | middle | 1 |
| `02-solid-po-principam.md` | SOLID по принципам | `solid-po-principam` | middle | 2 |
| `03-narushenie-lsp.md` | Нарушение LSP на реальном коде | `narushenie-lsp-na-realnom-kode` | senior | 3 |
| `04-gde-solid-vredit.md` | Где SOLID вредит | `gde-solid-vredit` | senior | 4 |

Все четыре — трек `code-design`, раздел `oop-solid`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.

**Трек `code-design` после публикации нужно включить вручную** —
переключателем «виден» в админке. Сидер создаёт треки скрытыми, а импорт
меняет только статьи, поэтому без этого шага опубликованные статьи
`oop-solid`, `patterns` и `app-architecture` гостям не покажутся.

## Раздел написан целиком

Все 4 статьи по плану (`THEORY_PLAN.md`) написаны. Источник материала —
ответы категории `architecture-patterns` в `content/questions/`,
переписанные в связный текст.

Замеров в этом разделе нет. Примеры кода собраны на .NET 10 в отдельном
проекте вместе с примерами раздела `patterns`.

Статьи ссылаются на соседние разделы по заголовкам: `Decorator vs наследование`
(раздел `patterns`), `Ковариантность и контравариантность`,
`Делегаты и события` (`csharp-lang`), `DI и жизненные циклы` (`aspnet-core`).
