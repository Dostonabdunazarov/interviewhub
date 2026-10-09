# Раздел «ASP.NET Core» — исходники статей

Статьи трека `.NET Backend` → раздела `aspnet-core`. Метаданные — во
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
  --email admin@hypex.site
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

| Файл | Заголовок | Slug | Порядок | Грейд |
| --- | --- | --- | --- | --- |
| `01-pipeline-i-middleware.md` | Pipeline и middleware | `aspnet-pipeline-i-middleware` | 1 | middle |
| `02-di-i-zhiznennye-cikly.md` | DI и жизненные циклы | `aspnet-di-i-zhiznennye-cikly` | 2 | middle |
| `03-konfiguraciya-i-options.md` | Конфигурация и options | `aspnet-konfiguraciya-i-options` | 3 | middle |
| `04-minimal-api-vs-kontrollery.md` | Minimal API vs контроллеры | `minimal-api-vs-kontrollery` | 4 | middle |
| `05-filtry.md` | Фильтры | `aspnet-filtry` | 5 | middle |
| `06-autentifikaciya-i-jwt.md` | Аутентификация и JWT | `aspnet-autentifikaciya-i-jwt` | 6 | middle |
| `07-dizayn-api-i-versionirovanie.md` | Дизайн API и версионирование | `aspnet-dizayn-api-i-versionirovanie` | 7 | middle |
| `08-health-checks.md` | Health checks | `aspnet-health-checks` | 8 | middle |
| `09-graceful-shutdown.md` | Graceful shutdown | `aspnet-graceful-shutdown` | 9 | senior |

Все девять — трек `dotnet-backend`, раздел `aspnet-core`.

Слаги с префиксом `aspnet-` — намеренно: health checks и graceful shutdown
появятся ещё раз в разделах трека `infrastructure`, и слаг должен быть
уникален глобально, а не внутри раздела.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек `dotnet-backend` уже опубликован, так что достаточно опубликовать статьи.

**Импорт берёт один каталог за раз**, поэтому нужен `--dir`:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/aspnet-core
```

## Раздел написан целиком

Все 9 статей по плану (`THEORY_PLAN.md`) написаны. Источник фактов —
ответы в `content/questions/aspnet-core.md`, переписанные связным текстом.
Поведение фреймворка проверено на тестовом приложении (ASP.NET Core 10.0.10,
`Asp.Versioning` 10.0, JwtBearer 10.0.10), а не взято по памяти:

- **конвейер**: порядок `A in, B in, handler, B out, A out`; middleware,
  сделавший `return` без записи, отдаёт пустой `200`; заголовок после
  начала ответа — `InvalidOperationException: Headers are read-only`;
- **DI**: singleton со scoped-зависимостью в Development падает на
  `Build()` с `Cannot consume scoped service`, в Production стартует молча;
  при двух регистрациях одиночное разрешение отдаёт последнюю;
- **конфигурация**: переменная окружения перебивает `appsettings.json`,
  но файл, добавленный через `AddJsonFile` после `CreateBuilder`,
  перебивает переменную; после правки файла `IOptions` видит старое
  значение, `IOptionsSnapshot` и `IOptionsMonitor` — новое;
- **binding**: ненулевой `string` из query обязателен (400), `AddValidation()`
  в .NET 10 валидирует Minimal API;
- **фильтры**: порядок global → controller → action и его смена через
  `Order`; автоматический 400 `[ApiController]` не пускает до глобального
  action filter; exception filter не ловит исключение из выполнения результата;
- **JWT**: мусорный токен на открытом endpoint'е — 200 анонимно; `ClockSkew`
  5 минут (истёкший 100 с назад принят, 400 с — 401); `sub` мапится
  в `nameidentifier`, с `MapInboundClaims = false` `IsInRole` ломается;
- **API**: rate limiter по умолчанию отказывает `503`; неверная версия
  в URL-сегменте — 404, в query — 400 `UnsupportedApiVersion`;
- **health checks**: `Degraded` — 200, исключение в проверке — 503,
  `timeout` у проверки срабатывает;
- **остановка**: `ShutdownTimeout` по умолчанию 30 с; запрос в работе
  дорабатывает, новый после сигнала — connection refused; при таймауте 2 с
  запрос на 8 с обрывается и получает `RequestAborted`; в .NET 10
  синхронная часть `ExecuteAsync` не задерживает старт.

Тестовое приложение лежит вне репозитория (в `.claude/tempfiles/`) и в git
не попадает.
