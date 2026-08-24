# InterviewHub — план реализации каркаса

Сайт для подготовки к собеседованиям. Вопросы и ответы добавляет админ,
гости читают без регистрации. Дополнительный раздел — вопросы по компаниям
(Google, Яндекс, Ozon и т.д.).

## 1. Решения, принятые на старте

| Вопрос | Решение |
|---|---|
| Модель данных | Гибкие теги: `Category` + `Level` + M2M `Companies` + свободные `Tags` |
| Аутентификация | Публичной регистрации нет. Гость читает, админ входит по JWT |
| Управление юзерами | Таблица `Users` с ролями есть; аккаунты создаёт админ из панели |
| Формат ответов | Markdown + подсветка кода при рендере |
| Объём этапа | Backend + миграции, фронт-каркас с дизайном, админка, Docker |

Про «только админ + гости» и «админ управляет юзерами»: саморегистрации нет,
но `Users` и CRUD по ним заложены сразу, иначе управлять было бы нечем.

## 2. Стек

Выровнен на `barberos` — тот же .NET 10 / EF Core 10.0.4 / Npgsql 10.0.3,
React 19 + Vite + Tailwind 4 + framer-motion. Причина: одинаковые версии
пакетов и знакомая структура важнее «идеального с нуля».

- **Backend**: .NET 10, Clean Architecture (Domain/Application/Infrastructure/Api)
- **БД**: PostgreSQL 16 + EF Core 10.0.4, миграции в Infrastructure
- **Auth**: JWT Bearer + refresh-токены, роли `Admin` / `Editor`
- **Frontend**: React 19, TypeScript, Vite, Tailwind 4, framer-motion,
  TanStack Query, react-router-dom 7, zustand, react-hook-form + zod
- **Markdown**: `react-markdown` + `shiki` для подсветки кода
- **Иконки**: `lucide-react`
- **Деплой**: docker-compose (postgres + api + nginx со статикой фронта)

## 3. Схема БД

### Справочники
- **Categories** — `Id`, `Slug`, `Name`, `Description`, `Icon`, `Color`, `SortOrder`
  (React, .NET, PostgreSQL, DevOps, Algorithms, System Design, Soft Skills)
- **Levels** — `Id`, `Slug`, `Name`, `Rank`
  (intern / junior / middle / senior / lead — `Rank` для сортировки)
- **Companies** — `Id`, `Slug`, `Name`, `LogoUrl`, `Color`, `Description`,
  `Country`, `SortOrder`
- **Tags** — `Id`, `Slug`, `Name`

### Контент
- **Questions** — `Id`, `Slug`, `Title`, `Body` (markdown, необязательно),
  `CategoryId` (FK), `LevelId` (FK), `Difficulty` (1–5),
  `Status` (Draft/Published/Archived), `ViewCount`, `IsFeatured`,
  `CreatedAt`, `UpdatedAt`, `CreatedByUserId`
- **Answers** — `Id`, `QuestionId` (FK), `Body` (markdown), `IsPrimary`,
  `SortOrder`, `CreatedAt`, `UpdatedAt`
  Несколько ответов на вопрос: короткий и развёрнутый.
- **QuestionCompanies** — M2M `QuestionId` + `CompanyId`,
  доп. поля `AskedYear`, `Round` (screening / tech / final)
- **QuestionTags** — M2M `QuestionId` + `TagId`

### Пользователи
- **Users** — `Id`, `Email`, `PasswordHash`, `DisplayName`, `Role`,
  `IsActive`, `CreatedAt`, `LastLoginAt`
- **RefreshTokens** — `Id`, `UserId`, `Token`, `ExpiresAt`, `RevokedAt`

### Индексы
- `Questions`: уникальный `Slug`; составной `(CategoryId, LevelId, Status)`
  под основной фильтр каталога
- Полнотекстовый поиск: генерируемая `tsvector`-колонка с GIN-индексом по
  `Title` + `Body` + `SearchText`. `SearchText` — денормализованный текст ответов,
  который `AppDbContext.SaveChanges` держит в актуальном состоянии: generated-колонка
  не умеет читать другую таблицу, а искать нужно и по ответам («ConfigureAwait»)
- `Companies.Slug`, `Categories.Slug`, `Tags.Slug` — уникальные

## 4. API

### Публичное (гость, без токена)
```
GET  /api/questions            ?category=&level=&company=&tag=&q=&page=&pageSize=
GET  /api/questions/{slug}     вопрос + ответы, инкремент ViewCount
GET  /api/categories           с счётчиками вопросов
GET  /api/levels
GET  /api/companies            с счётчиками
GET  /api/companies/{slug}     компания + её вопросы
GET  /api/tags
GET  /api/stats                для главной: всего вопросов, по грейдам
```
Отдаются только `Status = Published`.

### Админ (JWT, роль Admin/Editor)
```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/admin/questions           включая черновики
POST   /api/admin/questions
PUT    /api/admin/questions/{id}
DELETE /api/admin/questions/{id}
POST   /api/admin/questions/{id}/answers
PUT    /api/admin/answers/{id}
DELETE /api/admin/answers/{id}
CRUD   /api/admin/categories | levels | companies | tags
CRUD   /api/admin/users
```

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

- Тёмная тема по умолчанию + переключатель, `next-themes`-подход на CSS-переменных
- Дизайн-токены в три слоя: primitive → semantic → component
- Акцентный градиент, стеклянные карточки, аккуратные тени
- Анимации через framer-motion: появление списков, переходы страниц,
  hover на карточках; уважать `prefers-reduced-motion`
- Цвет-код по грейдам: junior — зелёный, middle — синий, senior — фиолетовый
- Адаптив: мобильный сайдбар в drawer, таблицы со скроллом
- Скелетоны при загрузке вместо спиннеров

## 7. Порядок работ

1. [x] **Каркас решения** — `InterviewHub.slnx`, 4 проекта, `.gitignore`
2. [x] **Domain** — 10 сущностей, енумы, `BaseEntity`
3. [x] **Infrastructure** — `AppDbContext`, EF-конфигурации, миграция
   `InitialCreate`, сидинг справочников (5 грейдов, 7 категорий, 10 компаний).
   Проверено на живом Postgres 16: схема, GIN-индекс, полнотекстовый поиск
   с русской морфологией («индекс» находит «индексы») и латиницей.
4. [x] **Application** — DTO, `PagedResult`, `QuestionQuery` с фильтрами
5. [x] **Api публичный** — JWT, Serilog, health-check, CORS, OpenAPI, миграции
   при старте, бутстрап админа, все публичные эндпоинты + `/api/auth`.
   Проверено на живой БД: фильтры, пагинация, поиск, ротация refresh-токенов,
   изоляция черновиков (404 по slug, `?status=` игнорируется).
6. [ ] **Api admin** — CRUD, авторизация по ролям
7. **Frontend каркас** — Vite, Tailwind 4, токены, layout, тема, роутинг
8. **Публичные страницы** — каталог, фильтры, вопрос с markdown, компании
9. **Админка** — логин, дашборд, редактор вопросов, справочники, юзеры
10. **Docker + деплой** — Dockerfile'ы, nginx.conf, compose, `DEPLOY.md`

## 8. Предложения на будущее

Не входит в текущий каркас, но схема к этому готова:

- **Режим тренировки** — карточки «показать ответ», отметки «знаю / повторить»
- **Моковое интервью** — подборка N вопросов по грейду с таймером
- **Прогресс пользователя** — если позже включить регистрацию
- **Избранное / закладки** — на `localStorage` даже без аккаунтов
- **Экспорт в PDF** — шпаргалка по категории
- **Импорт вопросов** — CSV/JSON, чтобы наполнять базу пачками
- **Счётчик просмотров → популярность** — сортировка «самые частые вопросы»
- **SEO** — SSR или пререндер, sitemap; для такого контента даёт трафик
- **i18next** — ru/en, в `barberos` уже есть рабочий образец

## 9. Решённые вопросы инфраструктуры

- **Домен**: `interview.hypex.site`
- **Логотипы компаний**: внешние URL, поле `Companies.LogoUrl` (без загрузки файлов,
  без стораджа). На фронте — фолбэк на буквенную заглушку, если картинка не отдалась.
- **Модерация**: нет. Админ правит сразу в прод, `Status` (Draft/Published)
  остаётся как переключатель видимости черновиков.
