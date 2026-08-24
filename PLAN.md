# InterviewHub — план реализации

Сайт для подготовки к собеседованиям. Вопросы и ответы добавляет админ,
гости читают без регистрации. Дополнительный раздел — вопросы по компаниям
(Google, Яндекс, Ozon и т.д.).

- **Домен**: `interview.hypex.site`
- **Репозиторий**: `git@github.com:Dostonabdunazarov/interviewhub.git` (приватный, ветка `main`)

---

## 0. Состояние на сейчас — читать первым

**Готово:** backend целиком — схема БД, миграция, публичное API, аутентификация.
Проверено на живом Postgres 16, не «должно работать».

**Не начато:** админский CRUD (шаг 6), весь фронтенд (7–9), Docker (10).

**Следующий шаг:** [шаг 6](#шаг-6--api-admin) — админский CRUD.

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

### Что уже лежит в репозитории

```
src/InterviewHub.Domain/          10 сущностей, Enums, BaseEntity
src/InterviewHub.Application/     DTO, PagedResult, QuestionQuery
src/InterviewHub.Infrastructure/
  Persistence/                    AppDbContext, 3 файла EF-конфигураций,
                                  DbSeeder (справочники), DemoContent (13 вопросов),
                                  Migrations/20260824063353_InitialCreate
  Auth/                           PasswordHashing, JwtOptions, JwtTokenService,
                                  AuthService, AdminBootstrapper
  Services/                       QuestionService, CatalogService
src/InterviewHub.Api/             Program.cs, Endpoints/{Public,Auth}Endpoints.cs,
                                  appsettings{,.Development}.json
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

### Админ (JWT, роль Admin/Editor) — шаг 6

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
DTO для всего этого уже написаны — `Application/Dtos/AdminDtos.cs`.

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

### Осталось

#### Шаг 6 — Api admin

- [ ] `AdminEndpoints.cs` — группа `/api/admin` с `RequireAuthorization()`
- [ ] Политики: `Editor` правит контент, `Admin` — ещё и пользователей
- [ ] `QuestionAdminService`: create/update/delete + связи Companies и Tags
- [ ] Генерация `Slug` из `Title` (транслитерация кириллицы) + проверка уникальности
- [ ] CRUD ответов; `SearchText` обновится сам через `SaveChanges` (грабли №2)
- [ ] CRUD справочников; на удаление используемого — понятная 409, не 500
- [ ] CRUD пользователей + смена пароля; запретить снятие последнего админа
- [ ] `UpdatedAt` выставлять при изменении
- [ ] FluentValidation на входные DTO (пакет уже подключён в Application)
- [ ] Проверить на живой БД: Editor не может дойти до `/api/admin/users`

#### Шаг 7 — Frontend каркас

- [ ] `frontend/` — Vite + React 19 + TS, версии пакетов взять из `barberos/frontend/package.json`
- [ ] Tailwind 4 через `@tailwindcss/vite`, дизайн-токены в три слоя
- [ ] Тема (тёмная по умолчанию) + переключатель, состояние в `localStorage`
- [ ] Layout: хедер с поиском, футер, мобильное меню
- [ ] Роутинг, `ErrorBoundary`, страница 404
- [ ] Axios-клиент + TanStack Query; интерсептор на 401 → refresh
- [ ] Типы API — сгенерировать из OpenAPI или описать вручную
- [ ] `vite.config.ts`: прокси `/api` → `localhost:5199`

#### Шаг 8 — Публичные страницы

- [ ] Главная: hero, статистика из `/api/stats`, категории, популярные вопросы
- [ ] Каталог `/questions`: фильтры (категория, грейд, компания, тег, сложность),
      поиск с debounce, пагинация, фильтры в URL — чтобы ссылка была шарящейся
- [ ] Вопрос `/questions/:slug`: markdown + shiki, кнопка «показать ответ»,
      бейджи компаний с годом и этапом
- [ ] Витрины `/categories/:slug`, `/levels/:slug`
- [ ] `/companies` — сетка логотипов с фолбэком; `/companies/:slug`
- [ ] `/about`
- [ ] Скелетоны, пустые состояния, обработка ошибок сети

#### Шаг 9 — Админка

- [ ] `/admin/login`, хранение токенов, `ProtectedRoute` по роли
- [ ] Дашборд: счётчики, черновики, недавно изменённое
- [ ] Список вопросов: фильтр по статусу, поиск, bulk publish/archive
- [ ] Редактор вопроса: markdown с превью, выбор категории/грейда/компаний/тегов,
      несколько ответов с `IsPrimary`, сохранение как черновик
- [ ] CRUD справочников (таблицы + модалки)
- [ ] Управление пользователями (только для `Admin`)
- [ ] Тосты об успехе/ошибке, подтверждение удаления

#### Шаг 10 — Docker и деплой

- [ ] `src/InterviewHub.Api/Dockerfile` — multi-stage, образцы в `barberos`
- [ ] `frontend/Dockerfile` + `nginx.conf` (SPA fallback, gzip, кэш статики)
- [ ] `docker-compose.yml` (dev) и `docker-compose.prod.yml`
- [ ] `.env.example`: `Jwt__Key`, `Bootstrap__Admin__*`, пароль Postgres
- [ ] Healthcheck'и, volume для данных Postgres
- [ ] `DEPLOY.md` для `interview.hypex.site` — сверить с `DEPLOY_HYPEX.md` в корне HYPEX
- [ ] Проверить, что прод-сборка не сеет `DemoContent`

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
