# Раздел «Паттерны» — исходники статей

Статьи трека `Код и архитектура` (`code-design`) → раздела `patterns`.
Метаданные — во фронтматтере каждого файла, тело — markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/patterns

node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/patterns

IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/patterns
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
| `01-factory.md` | Factory | `pattern-factory` | middle | 1 |
| `02-strategy-vs-switch.md` | Strategy vs switch | `strategy-vs-switch` | middle | 2 |
| `03-decorator-vs-nasledovanie.md` | Decorator vs наследование | `decorator-vs-nasledovanie` | middle | 3 |
| `04-proxy.md` | Proxy | `pattern-proxy` | middle | 4 |
| `05-adapter.md` | Adapter | `pattern-adapter` | middle | 5 |
| `06-mediator-i-ego-riski.md` | Mediator и его риски | `mediator-i-ego-riski` | senior | 6 |
| `07-repository-poverh-orm.md` | Repository поверх ORM | `repository-poverh-orm` | senior | 7 |
| `08-kogda-pattern-navredil.md` | Когда паттерн навредил | `kogda-pattern-navredil` | senior | 8 |

Все восемь — трек `code-design`, раздел `patterns`. У Factory, Proxy
и Adapter slug с префиксом `pattern-`: голые `factory`, `proxy` и `adapter`
слишком общие для всего сайта.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек `code-design` включается переключателем «виден» в админке — сидер
создаёт треки скрытыми (подробнее — в `content/theory/oop-solid/README.md`).

## Раздел написан целиком

Все 8 статей по плану (`THEORY_PLAN.md`) написаны. Источник материала —
ответы категорий `architecture-patterns` и `ef-core` (вопросы про Repository
и Unit of Work) в `content/questions/`, переписанные в связный текст.

Замеров в этом разделе нет. Примеры кода собраны на .NET 10 в отдельном
проекте против пакетов Scrutor 7, MediatR 14, Castle.Core 5 и EF Core 10
(SQLite): декораторы с регистрацией через Scrutor, динамические прокси,
конвейер MediatR и его замена декораторами, репозиторий агрегата
и Unit of Work поверх `DbContext`.

Статьи ссылаются на соседние разделы по заголовкам: `Инкапсуляция,
наследование, полиморфизм`, `Нарушение LSP на реальном коде` (раздел
`oop-solid`), `DI и жизненные циклы`, `Фильтры` (`aspnet-core`),
`ChangeTracker`, `Загрузка связей и N+1`, `Когда ORM мешает` (`ef-core`),
`Clean Architecture и её цена`, `CQRS`, `Преждевременные абстракции`,
`Документирование решений (ADR)` (`app-architecture`).
