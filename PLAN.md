# InterviewHub — план реализации

Сайт для подготовки к собеседованиям. Вопросы и ответы добавляет админ,
гости читают без регистрации. Дополнительный раздел — вопросы по компаниям
(Google, Яндекс, Ozon и т.д.).

- **Домен**: `interview.hypex.site`
- **Репозиторий**: `git@github.com:Dostonabdunazarov/interviewhub.git` (приватный, ветка `main`)

---

## 0. Состояние на сейчас — читать первым

**Готово:** backend целиком — схема БД, миграция, публичное API, аутентификация,
админский CRUD. Проверено на живом Postgres 16, не «должно работать»:
сценарий приёмки шага 6 — 46 проверок, все зелёные.
Фронтенд — каркас, публичные страницы и админка.
Docker и деплой — образы, compose, CI, `DEPLOY.md`.

**Не начато:** ничего из плана. Проект готов к первому деплою —
осталось выполнить ручные шаги на сервере (клон, `.env`, маршрут в Caddy,
DNS), они описаны в [`DEPLOY.md`](DEPLOY.md).

**Дальше:** идеи из раздела «Предложения на будущее».

### Как запустить локально

```bash
# 1. Postgres (порт 55432, чтобы не конфликтовать с другими проектами HYPEX)
docker run -d --name ih-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=interviewhub -p 55432:5432 postgres:16-alpine

# 2. API — миграции и сидинг применяются сами при старте
cd d:/HYPEX/interviewhub
ConnectionStrings__Default="Host=localhost;Port=55432;Database=interviewhub;Username=postgres;Password=postgres" \
ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS="http://localhost:5199" \
dotnet run --project src/InterviewHub.Api --no-launch-profile
```

Проверка: `curl http://localhost:5199/health` → `Healthy`.
OpenAPI (только в Development): `http://localhost:5199/openapi/v1.json`.

Dev-админ из `appsettings.Development.json`: `admin@interview.hypex.site` / `Admin123!`.
В Development сеются 13 демо-вопросов, в проде — только справочники.

Фронтенд (нужен запущенный API — Vite проксирует `/api` на 5199):

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173

# дымовые тесты публичных страниц против живого API
VITE_API_URL=http://localhost:5199 npm run smoke
```

Весь стек в контейнерах (то же, что поедет в прод, но с портами наружу):

```bash
docker compose up -d --build     # http://localhost:8088
docker compose down -v           # -v стирает и данные
```

Приёмка админского API (46 проверок против запущенного API):

```bash
bash tests/api/admin-acceptance.sh
```

Сценарий пишет в БД и за собой убирает, но гонять его лучше на свежей базе:
`docker exec ih-pg psql -U postgres -c "DROP DATABASE interviewhub WITH (FORCE);" -c "CREATE DATABASE interviewhub;"`

### Что уже лежит в репозитории

```
src/InterviewHub.Domain/          10 сущностей, Enums, BaseEntity, ISluggable
src/InterviewHub.Application/
  Common/                         PagedResult, QuestionQuery, SlugGenerator,
                                  OperationResult
  Dtos/                           публичные и админские DTO
  Validation/                     AdminValidators (FluentValidation)
src/InterviewHub.Infrastructure/
  Persistence/                    AppDbContext, 3 файла EF-конфигураций,
                                  DbSeeder (справочники), DemoContent (13 вопросов),
                                  Migrations/20260824063353_InitialCreate
  Auth/                           PasswordHashing, JwtOptions, JwtTokenService,
                                  AuthService, AdminBootstrapper
  Services/                       QuestionService, CatalogService,
                                  QuestionAdminService, CatalogAdminService,
                                  UserAdminService
src/InterviewHub.Api/             Program.cs,
                                  Endpoints/{Public,Auth,Admin}Endpoints.cs,
                                  Filters/ (AuthPolicies, ValidationFilter,
                                  OperationResultExtensions),
                                  appsettings{,.Development}.json
tests/api/                        admin-acceptance.sh — приёмка шага 6
docker-compose.yml                локальная проверка прод-сборки
docker-compose.hypex.yml          прод-стек для сервера (за общим Caddy)
.env.example                      секреты прода: Jwt__Key, Bootstrap__Admin__*, БД
.github/workflows/deploy.yml      CI: push в main → пересборка на сервере
DEPLOY.md                         деплой на interview.hypex.site
frontend/
  src/app/                        router.tsx (админка — отдельным чанком)
  src/components/                 Layout, AdminLayout, ErrorBoundary,
                                  ProtectedRoute, ScrollToTop, ThemeToggle,
                                  Toaster, Markdown, QuestionCard,
                                  QuestionFilters, QuestionShowcase,
                                  ui/ (Button, Card, Badge, Skeleton, Modal,
                                  ConfirmDialog, Field, Pagination, States,
                                  DifficultyDots, CategoryIcon, CompanyLogo)
  src/lib/                        api (axios + refresh), hooks, adminHooks,
                                  queryClient, utils, useDebounced
  src/store/                      authStore, themeStore, toastStore
  src/types/                      api.ts (ответы), admin.ts (тела запросов)
  src/pages/                      публичные страницы + admin/
  src/index.css                   дизайн-токены в три слоя + типографика markdown
  smoke/                          дымовые тесты против живого API
  Dockerfile, nginx.conf          сборка статики и раздача (без gzip!)
```

### Грабли, на которые уже наступили

Это не теория — каждый пункт стоил отладки. Не переигрывать заново.

1. **`[AsParameters]` требует в query каждое value-type свойство.**
   `/api/questions` без параметров падал с 400 («Required parameter "int Page"»).
   Поэтому в `PublicEndpoints` параметры перечислены явно с дефолтами.
   Если будете биндить `QuestionQuery` в админском API — та же ловушка.
2. **Generated-колонка не может читать другую таблицу.**
   Поиск по «ConfigureAwait» не находил вопрос, у которого это слово только
   в ответе. Решение: денормализованное поле `Question.SearchText`, которое
   `AppDbContext.SaveChanges()` пересобирает из текста ответов.
   **При правке ответов через админский CRUD `SearchText` обновится сам** —
   но только если менять их через `SaveChanges`, а не `ExecuteUpdate`.
3. **Postgres лексемизирует `async/await` как единый токен.**
   Поиск по `async` не найдёт «Что происходит под капотом async/await?».
   Это поведение `to_tsvector`, не баг. Если понадобится — добавить
   отдельный триграммный индекс (`pg_trgm`) для подстрочного поиска.
4. **Npgsql не должен попадать в Domain.**
   `NpgsqlTsVector` сначала добавили полем сущности — Domain перестал
   собираться. `SearchVector` объявлен shadow property в `ContentConfigurations`.
5. **`dotnet build` падает, пока запущен API** (файловые блокировки Windows).
   `pkill` не помогает — нужен
   `Get-Process -Name 'InterviewHub.Api' | Stop-Process -Force`.
6. **Кириллица в URL требует кодирования** — иначе поиск «молча» вернёт 0
   совпадений. При тестах curl: `?q=%D0%B8%D0%BD%D0%B4%D0%B5%D0%BA%D1%81`.
7. **`BaseEntity` задаёт `Id` в конструкторе — добавлять сущность только через `Add`.**
   `question.Answers.Add(answer)` без `db.Answers.Add(answer)` роняло POST ответа
   с `DbUpdateConcurrencyException: expected to affect 1 row(s), but actually
   affected 0`. По непустому ключу EF считает объект уже существующим и делает
   UPDATE вместо INSERT. Явный `Add` ставит `Added` независимо от значения ключа.
8. **`Where` после `Select` по полю DTO не транслируется в SQL.**
   `GetTagsAsync` фильтровал `.Select(new TagDto(...)).Where(x => x.QuestionCount > 0)` —
   `/api/tags` отдавал 500 на живой БД. Фильтр и сортировка должны идти
   по выражению над сущностью, до проекции.
9. **Тело curl с кириллицей передавать файлом (`--data-binary @file`), не через `-d`.**
   Инлайн-строка в bash на Windows теряет UTF-8, в API приезжает «??????»,
   и slug генерируется из мусора. Симптом выглядит как баг транслитерации.
10. **`lucide-react` давно не `0.x`.** Актуальная версия — `1.33.0`;
    привычный `^0.4xx` из старых проектов не установится.
    Версии стоит сверять `npm view <pkg> version`, а не копировать по памяти.
11. **Props компонента, конфликтующие с HTML/библиотечными, требуют `Omit`.**
    `color` у `span` и `name` у `LucideProps` — `string`, а из API они приходят
    `string | null`. Без `Omit<HTMLAttributes<...>, "color">` сборка падает
    с TS2430. Всплывает только на `tsc -b`, dev-сервер это не ловит.
12. **`shiki` и `lucide-react` тянут в бандл всё разом.**
    Импорт `from "shiki"` подключает bundle-full — ~200 языков, включая Wolfram
    и Emacs Lisp; список `langs` в конфиге highlighter не помогает, он про
    регистрацию. Барельный `import { icons }` из lucide кладёт все ~1600 иконок.
    Итог был 1,23 МБ вместо 567 кБ. Лечится `shiki/core` с грамматиками поштучно
    и `lucide-react/dynamic`. Сборка при этом «проходит» — ловится только
    по размеру чанков.
13. **jsdom не исполняет `<script type="module">`.**
    Дымовой тест на нём показывал пустую страницу для всех роутов —
    выглядело как тотальная поломка, хотя приложение работало.
    Рендерить SPA вне браузера — через `react-dom/server`, а не jsdom.
14. **`gcTime: 0` в дымовом тесте делает его флаки.**
    После `prefetchQuery` подписчиков ещё нет, и данные вычищаются
    до рендера — тест падал через раз. В `smoke/render.tsx` gcTime ненулевой.
15. **Свои компоненты для `react-markdown` должны отбрасывать проп `node`.**
    Иначе он через спред уезжает в DOM как `node="[object Object]"`.
    Там же: react-markdown сам оборачивает код в `<pre>`, поэтому свой `<pre>`
    внутри давал невалидное `<pre><pre>`.
16. **`PUT /api/admin/questions/{id}` — полное состояние, а не патч.**
    Бэкенд пишет `Body = input.Body` как есть, поэтому `body: null` **стирает**
    постановку вопроса. Массовая смена статуса, собранная из карточек списка
    (в них тела нет), молча уничтожала текст — проверено на живой БД.
    Bulk обязан сначала запросить деталь каждого вопроса. Если появится
    отдельный bulk-эндпоинт, это правило снимется вместе с ним.
17. **`z.coerce.number()` ломает типы react-hook-form.**
    Входной тип схемы становится `unknown`, и `resolver` перестаёт совпадать
    с `useForm<T>`. Лечится `z.union([z.string(), z.number()]).transform(Number)`
    плюс `useForm<Вход, unknown, Выход>` — третий параметр нужен, иначе
    `handleSubmit` отдаёт входной тип (строки из `<select>`), а не выходной.
18. **`createPortal(..., document.body)` роняет рендер вне браузера.**
    Модалка вызывала его безусловно, и дымовой тест падал с
    `ReferenceError: document is not defined` на каждой странице с модалкой.
    Нужен `typeof document === "undefined"` перед порталом.
19. **В образе `dotnet/aspnet` нет ни `curl`, ни `wget`.**
    Healthcheck вида `wget -qO- /health` держал контейнер вечно `unhealthy`
    (проверено). Проба перенесена на фронтенд: в `nginx:alpine` wget есть,
    а через его прокси `/health` покрывает и API, и Postgres.
20. **`localhost` в healthcheck контейнера резолвится в `::1`.**
    nginx слушает только IPv4, поэтому проба падала с «Connection refused».
    В healthcheck писать `127.0.0.1`, а не `localhost`.
21. **`expires` и `add_header Cache-Control` вместе дают два заголовка.**
    В ответе оказывались конфликтующие `max-age=31536000` и
    `public, immutable`. Оставлять что-то одно — у нас только `add_header`.

---

## 1. Решения, принятые на старте

| Вопрос | Решение |
|---|---|
| Модель данных | Гибкие теги: `Category` + `Level` + M2M `Companies` + свободные `Tags` |
| Аутентификация | Публичной регистрации нет. Гость читает, админ входит по JWT |
| Управление юзерами | Таблица `Users` с ролями есть; аккаунты создаёт админ из панели |
| Формат ответов | Markdown + подсветка кода при рендере |
| Логотипы компаний | Внешние URL в `Companies.LogoUrl`, без загрузки файлов и стораджа |
| Модерация | Нет. Админ правит сразу в прод; `Status` — только переключатель видимости |

Про «только админ + гости» и «админ управляет юзерами»: саморегистрации нет,
но `Users` и CRUD по ним заложены сразу, иначе управлять было бы нечем.

## 2. Стек

Выровнен на `barberos` (`d:\HYPEX\barberos`) — там же рабочие образцы
`Dockerfile`, `nginx.conf`, i18n и auth. Причина: одинаковые версии пакетов
и знакомая структура важнее «идеального с нуля».

- **Backend**: .NET 10, Clean Architecture (Domain/Application/Infrastructure/Api)
- **БД**: PostgreSQL 16 + EF Core 10.0.4, Npgsql 10.0.3, миграции в Infrastructure
- **Auth**: JWT Bearer + refresh-токены с ротацией, роли `Admin` / `Editor`
- **Frontend**: React 19, TypeScript, Vite, Tailwind 4, framer-motion,
  TanStack Query, react-router-dom 7, zustand, react-hook-form + zod
- **Markdown**: `react-markdown` + `shiki` для подсветки кода
- **Иконки**: `lucide-react`

> Ставили по мере надобности, а не всё сразу: `react-markdown` + `shiki`
> пришли в шаге 8 вместе с рендером ответов, `react-hook-form` + `zod` —
> в шаге 9 с редактором вопроса (на логине двух полей хватило `useState`).
> Про импорты shiki и lucide см. грабли №12: обе библиотеки при наивном
> подключении утраивают размер бандла.
>
> `i18next` из стека не ставился: интерфейс одноязычный, ru. Понадобится —
> рабочий образец в `barberos`.
- **Деплой**: docker-compose (postgres + api + nginx со статикой фронта)

> Версии EF Core жёстко выровнены на 10.0.4 — под Npgsql 10.0.3.
> Комментарии в `.csproj` объясняют, почему; не поднимать вслепую.

## 3. Схема БД

### Справочники

- **Categories** — `Slug`, `Name`, `Description`, `Icon` (имя lucide-иконки),
  `Color`, `SortOrder`
  (React, .NET, PostgreSQL, DevOps, Algorithms, System Design, Soft Skills)
- **Levels** — `Slug`, `Name`, `Rank` (для сортировки), `Color`
  (intern / junior / middle / senior / lead)
- **Companies** — `Slug`, `Name`, `LogoUrl`, `Color`, `Description`,
  `Country`, `SortOrder`
- **Tags** — `Slug`, `Name`

### Контент

- **Questions** — `Slug`, `Title`, `Body` (markdown, необязательно),
  `CategoryId`, `LevelId`, `Difficulty` (1–5), `Status`, `ViewCount`,
  `IsFeatured`, `SearchText` (служебное), `CreatedAt`, `UpdatedAt`, `CreatedByUserId`
- **Answers** — `QuestionId`, `Body` (markdown), `IsPrimary`, `SortOrder`
  Несколько ответов на вопрос: короткий и развёрнутый.
- **QuestionCompanies** — M2M + `AskedYear`, `Round` (Screening/Technical/SystemDesign/Final)
- **QuestionTags** — M2M

### Пользователи

- **Users** — `Email`, `PasswordHash` (PBKDF2), `DisplayName`, `Role`,
  `IsActive`, `LastLoginAt`
- **RefreshTokens** — `UserId`, `Token`, `ExpiresAt`, `RevokedAt`

### Индексы

- `Questions`: уникальный `Slug`; составной `(CategoryId, LevelId, Status)`
  под основной фильтр каталога
- Полнотекстовый поиск: генерируемая `tsvector`-колонка с GIN-индексом по
  `Title` + `Body` + `SearchText` (см. грабли №2)
- `Companies.Slug`, `Categories.Slug`, `Levels.Slug`, `Tags.Slug`, `Users.Email`,
  `RefreshTokens.Token` — уникальные

### Поведение при удалении

- `Question` → `Answers`, `QuestionCompanies`, `QuestionTags`: **Cascade**
- `Question` → `Category` / `Level`: **Restrict** (нельзя удалить используемый справочник)
- `Question.CreatedByUser`: **SetNull** (удаление юзера не трогает контент)

## 4. API

### Публичное (гость, без токена) — готово

```
GET  /api/questions            ?category=&level=&company=&tag=&q=&difficulty=
                               &isFeatured=&sort=&page=&pageSize=
GET  /api/questions/{slug}     вопрос + ответы, инкремент ViewCount
GET  /api/categories           со счётчиками вопросов
GET  /api/levels               со счётчиками
GET  /api/companies            со счётчиками
GET  /api/companies/{slug}
GET  /api/tags                 только непустые, по популярности
GET  /api/stats                для главной
GET  /health
```
Отдаются только `Status = Published`. Параметр `?status=` от гостя игнорируется.

`sort`: `Newest` (по умолчанию), `Oldest`, `Popular`, `DifficultyAsc`, `DifficultyDesc`.
`pageSize` ограничен сверху 100.

### Аутентификация — готово

```
POST /api/auth/login      → access (15 мин) + refresh (30 дней)
POST /api/auth/refresh    ротация: старый токен гасится
POST /api/auth/logout
```
Неверный пароль и неактивный аккаунт отвечают одинаково (401) — чтобы
нельзя было перебирать существующие аккаунты.

### Админ (JWT, роль Admin/Editor) — готово

```
GET    /api/admin/questions           включая черновики, свои фильтры
POST   /api/admin/questions
PUT    /api/admin/questions/{id}
DELETE /api/admin/questions/{id}
POST   /api/admin/questions/{id}/answers
PUT    /api/admin/answers/{id}
DELETE /api/admin/answers/{id}
CRUD   /api/admin/categories | levels | companies | tags
CRUD   /api/admin/users               только роль Admin
POST   /api/admin/users/{id}/password
```
DTO — `Application/Dtos/AdminDtos.cs`, валидаторы — `Application/Validation/`.

`GET /api/admin/questions` принимает `?status=Draft|Published|Archived|All`
(по умолчанию `All` — админке нужны и черновики). Публичный `?status=`
по-прежнему игнорируется.

Коды ответов: `404` — нет сущности, `409` — занятый slug, используемый справочник
или попытка убрать последнего админа, `400` — невалидный ввод и ссылки
на несуществующие связи.

## 5. Страницы фронтенда

**Публичные**

- `/` — главная: hero, статистика, категории плиткой, популярные вопросы
- `/questions` — каталог: сайдбар с фильтрами, поиск, пагинация
- `/questions/:slug` — вопрос, ответы в markdown с подсветкой кода
- `/categories/:slug`, `/levels/:slug` — витрины
- `/companies` — сетка логотипов
- `/companies/:slug` — вопросы конкретной компании
- `/about`

**Админка** (`/admin`, под защитой роута)

- дашборд, список вопросов с фильтрами и bulk-действиями
- редактор вопроса: markdown-редактор с превью, теги, компании
- CRUD категорий / грейдов / компаний / тегов
- управление пользователями

## 6. Дизайн

- Тёмная тема по умолчанию + переключатель, на CSS-переменных
- Дизайн-токены в три слоя: primitive → semantic → component
- Акцентный градиент, стеклянные карточки, аккуратные тени
- Анимации через framer-motion: появление списков, переходы страниц,
  hover на карточках; уважать `prefers-reduced-motion`
- Цвет-код по грейдам берётся из БД (`Levels.Color`), не хардкодить:
  junior — `#22c55e`, middle — `#3b82f6`, senior — `#a855f7`
- Иконки категорий — из `Categories.Icon` (имена lucide-react)
- Логотипы компаний — `Companies.LogoUrl` + фолбэк на буквенную заглушку
  (часть компаний в сидинге намеренно без логотипа — фолбэк проверяется сразу)
- Адаптив: мобильный сайдбар в drawer, таблицы со скроллом
- Скелетоны при загрузке вместо спиннеров

---

## 7. Порядок работ

### Сделано

1. [x] **Каркас решения** — `InterviewHub.slnx`, 4 проекта, `.gitignore`
2. [x] **Domain** — 10 сущностей, енумы, `BaseEntity`
3. [x] **Infrastructure** — `AppDbContext`, EF-конфигурации, миграция
   `InitialCreate`, `DbSeeder` (5 грейдов, 7 категорий, 10 компаний),
   `DemoContent` (13 вопросов с markdown-ответами, только Development).
   Проверено на живом Postgres 16: схема, GIN-индекс, полнотекстовый поиск
   с русской морфологией («индекс» находит «индексы»), латиницей и по тексту
   ответов («ConfigureAwait», «merge sort»).
4. [x] **Application** — DTO публичные и админские, `PagedResult`, `QuestionQuery`
5. [x] **Api публичный** — JWT, Serilog, health-check, CORS, OpenAPI, миграции
   и сидинг при старте, бутстрап админа, публичные эндпоинты + `/api/auth`.
   Проверено на живой БД: фильтры, пагинация, сортировки, ротация
   refresh-токенов (повторное использование → 401), изоляция черновиков
   (404 по slug, `?status=` игнорируется), инкремент `ViewCount`.
6. [x] **Api admin** — `AdminEndpoints` (группа `/api/admin`), политики
   `Editor` / `Admin`, `QuestionAdminService` со связями Companies и Tags,
   `CatalogAdminService`, `UserAdminService`, `SlugGenerator`
   с транслитерацией кириллицы, `OperationResult` → HTTP-коды,
   FluentValidation через `ValidationFilter`.

   Проверено на живой БД сценарием из 46 проверок, все зелёные:
   транслитерация («Что такое индексы в PostgreSQL?» → `chto-takoe-indeksy-v-postgresql`),
   суффикс `-2` при коллизии, 409 на явный занятый slug, 400 вместо 500
   на несуществующую категорию, пересборка `SearchText` при добавлении
   и удалении ответа, единственность `IsPrimary`, `UpdatedAt` при PUT,
   полная замена связей, 409 на удаление используемого справочника,
   403 для Editor на `/api/admin/users`, защита последнего админа
   (понижение / деактивация / удаление → 409), отзыв refresh-токенов
   при смене пароля, каскадное удаление вопроса.

   Попутно починен публичный `GET /api/tags` — он отдавал 500 на живой БД
   (грабли №8); в шаге 5 это не поймали.
7. [x] **Frontend каркас** — Vite 8 + React 19 + TS, Tailwind 4,
   дизайн-токены в три слоя (primitive → semantic → component),
   тёмная тема по умолчанию с переключателем, Layout с поиском и мобильным
   меню, AdminLayout, роутинг с lazy-загрузкой админки, `ErrorBoundary`,
   404, `ProtectedRoute` (в т.ч. `requireAdmin` для раздела пользователей),
   axios с ротацией refresh при 401, TanStack Query, типы API вручную.

   Проверено: `npm run build` и `oxlint` чисто; Vite проксирует `/api`
   на 5199 (`/api/stats`, `/api/tags`, логин — 200 через прокси);
   SPA-fallback на глубоком роуте; все три слоя токенов доехали
   до собранного CSS вместе со светлыми и тёмными значениями.
   Формы ответов всех 9 публичных эндпоинтов сверены с типами
   `types/api.ts` поле в поле.

   Страницы — заглушки: наполняются в шагах 8 и 9. Рабочий уже
   `/admin/login`, на нём проверяется весь auth-контур.
8. [x] **Публичные страницы** — главная (hero, статистика, категории,
   популярные вопросы), каталог с фильтрами в URL и поиском с debounce,
   страница вопроса с markdown + shiki и раскрытием ответа, витрины
   категорий / грейдов / компаний, `/about`. Скелетоны, пустые состояния
   и обработка ошибок сети — везде.

   Проверено на живом API дымовыми тестами (`npm run smoke`, 26 проверок):
   все 9 роутов отрисовываются с реальными данными; markdown даёт корректную
   разметку, экранирует сырой HTML и не порождает невалидную вложенность;
   shiki собирается и отдаёт обе темы.

   Размер сборки: 1,23 МБ → 567 кБ после правки импортов shiki и lucide
   (грабли №12). Markdown-рендерер вынесен в ленивый чанк — он нужен
   только на странице вопроса.

   Витрины категории, грейда и компании — один компонент `QuestionShowcase`:
   они отличаются лишь шапкой и зафиксированным фильтром.
9. [x] **Админка** — дашборд со счётчиками и черновиками, список вопросов
   с фильтром по статусу, поиском и bulk publish/archive, редактор вопроса
   (markdown с превью, категория/грейд/компании с годом и этапом/теги,
   несколько ответов с `IsPrimary`), CRUD справочников таблицами с модалками,
   управление пользователями со сменой пароля, тосты и подтверждение удаления.
   Формы — `react-hook-form` + `zod`; ограничения повторяют `AdminValidators.cs`,
   но источник правды остаётся серверный, его 400 показывается тостом.

   Проверено на живом API (`npm run smoke`, 44 проверки суммарно, из них 18
   админских): рендер всех страниц админки, жизненный цикл вопроса
   (создание → ответ → смена статуса → удаление), сохранность тела вопроса
   при bulk-действии, 409 на удаление используемой категории и на понижение
   последнего админа. Отдельно на живой БД: Editor получает 403
   на `/api/admin/users` и 200 на контентных эндпоинтах.

   Bulk-действие устроено дороже, чем кажется: PUT перезаписывает вопрос
   целиком, поэтому перед сменой статуса запрашивается деталь каждого
   вопроса (грабли №16). Наивная версия, собранная из карточек списка,
   стирала постановку вопроса — поймано на живой БД, не в теории.

   Разграничение ролей продублировано: `AdminLayout` прячет вкладку
   пользователей от Editor, `ProtectedRoute requireAdmin` не пускает
   на роут, бэкенд отвечает 403 независимо от фронта.
10. [x] **Docker и деплой** — multi-stage `Dockerfile` для API и фронтенда,
    `nginx.conf` (SPA fallback, прокси `/api/` и `/health`, кэш статики),
    `docker-compose.yml` для локальной проверки прод-сборки,
    `docker-compose.hypex.yml` для сервера, `.env.example`, healthcheck'и,
    volume для Postgres, CI-workflow и `DEPLOY.md`.

    Проверено на живых контейнерах, не на бумаге: стек поднимается с нуля
    (`down -v` → `up --build`) и приходит в `healthy`; SPA-fallback работает,
    `/api/nope` отдаёт 404 от .NET, а не HTML; **в Production засеяны только
    справочники — 0 вопросов**, `DemoContent` не поехал; бутстрап-админ
    логинится; 18 админских дымовых проверок проходят против контейнера;
    бэкап и восстановление проверены round-trip'ом (маркерный вопрос
    удалён и возвращён из дампа); API падает на старте с коротким `Jwt__Key`.

    Отступление от плана: вместо `docker-compose.prod.yml` сделан
    `docker-compose.hypex.yml` — на сервере общий Caddy из `corpdev/infra`,
    поэтому свой прокси и TLS проекту не нужны, порты наружу не публикуются,
    а gzip в nginx проекта **запрещён** (даёт белый экран за Caddy).
    Всё это — требования `DEPLOY_HYPEX.md`, автономный прод-стек
    в эту инфраструктуру не вписался бы.

### Осталось

Ничего. Ручные шаги первого деплоя — в [`DEPLOY.md`](DEPLOY.md).

---

## 8. Предложения на будущее

Не входит в каркас, но схема к этому готова:

- **Режим тренировки** — карточки «показать ответ», отметки «знаю / повторить»
- **Моковое интервью** — подборка N вопросов по грейду с таймером
- **Избранное** — на `localStorage`, работает и без аккаунтов
- **Импорт вопросов** — CSV/JSON; наполнять базу через форму по одному больно
- **Экспорт в PDF** — шпаргалка по категории
- **SEO** — пререндер или SSR, sitemap. Для контентного сайта органика —
  основной канал, заложить раньше, чем позже
- **i18next** — ru/en, рабочий образец в `barberos`
- **pg_trgm** — подстрочный поиск в дополнение к tsvector (грабли №3)
- **Прогресс пользователя** — если решите включить регистрацию

## 9. Заметки по безопасности

- `Jwt:Key` и `Bootstrap:Admin:*` в проде — только через env.
  API падает на старте, если ключ короче 32 символов.
- В `appsettings.Development.json` лежит dev-пароль `Admin123!`.
  Репозиторий приватный, поэтому это допустимо. **Если решите открыть
  репозиторий — сначала убрать файл, он останется в истории коммитов.**
- Пароли — PBKDF2 через ASP.NET Core `PasswordHasher`, с поддержкой rehash.
- Логи Serilog не пишут пароли и токены.
