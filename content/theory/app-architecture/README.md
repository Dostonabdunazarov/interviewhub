# Раздел «Архитектура приложения» — исходники статей

Статьи трека `Код и архитектура` (`code-design`) → раздела
`app-architecture`. Метаданные — во фронтматтере каждого файла, тело —
markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/app-architecture

node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/app-architecture

IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/app-architecture
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
| `01-sloistaya-vs-geksagonalnaya.md` | Слоистая vs гексагональная | `sloistaya-vs-geksagonalnaya` | middle | 1 |
| `02-clean-architecture-i-ee-cena.md` | Clean Architecture и её цена | `clean-architecture-i-ee-cena` | senior | 2 |
| `03-cqrs.md` | CQRS | `cqrs-razdelenie-komand-i-zaprosov` | senior | 3 |
| `04-prezhdevremennye-abstrakcii.md` | Преждевременные абстракции | `prezhdevremennye-abstrakcii` | middle | 4 |
| `05-adr-dokumentirovanie-resheniy.md` | Документирование решений (ADR) | `adr-dokumentirovanie-resheniy` | senior | 5 |
| `06-tehdolg-i-razgovor-s-biznesom.md` | Техдолг и разговор с бизнесом | `tehdolg-i-razgovor-s-biznesom` | senior | 6 |

Все шесть — трек `code-design`, раздел `app-architecture`. У CQRS slug
длиннее заголовка: голое `cqrs` слишком общее для всего сайта.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек `code-design` включается переключателем «виден» в админке — сидер
создаёт треки скрытыми.

## Раздел написан целиком

Все 6 статей по плану (`THEORY_PLAN.md`) написаны. Источник материала —
ответы категории `architecture-patterns` и вопросы про CQRS из категории
`microservices` в `content/questions/`, переписанные в связный текст.

Замеров в этом разделе нет. Примеры кода собраны на .NET 10 в отдельном
проекте: порты и адаптеры с in-memory тестом, конфигурация EF Core для
доменной сущности (проверена на SQLite: счёт со строками сохраняется
и читается обратно), вертикальный слайс, обработчики CQRS на EF Core
и Dapper, примеры из статьи про абстракции.

API NetArchTest (`Types.InAssembly`, `ResideInNamespace`,
`HaveDependencyOnAny`, `GetResult`, `FailingTypeNames`) сверен
с документацией библиотеки и собран против пакета `NetArchTest.Rules` 1.3.2.

Статьи ссылаются на соседние разделы по заголовкам: `Repository поверх ORM`,
`Mediator и его риски`, `Когда паттерн навредил` (раздел `patterns`),
`Где SOLID вредит` (`oop-solid`), `Разговор с бизнесом` (`soft-skills`),
`Outbox` (`microservices`), `Read-your-writes` (`consistency`),
`Репликация и failover` (`data-at-scale`).
