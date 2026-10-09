# Раздел «EF Core и данные» — исходники статей

Статьи трека `.NET Backend` → раздела `ef-core`. Метаданные — во
фронтматтере каждого файла, тело — markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
# Сначала посмотреть, что будет сделано:
node tools/import-theory.mjs --dry-run --dir content/theory/ef-core

# Локально:
node tools/import-theory.mjs --dir content/theory/ef-core \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!'

# В прод (пароль через переменную окружения, а не флагом:
# флаг виден в списке процессов и остаётся в history шелла):
IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs --dir content/theory/ef-core \
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
| `01-changetracker.md` | ChangeTracker | `ef-changetracker` | 1 | middle |
| `02-zagruzka-svyazey-i-n-plus-1.md` | Загрузка связей и N+1 | `zagruzka-svyazey-i-n-plus-1` | 2 | middle |
| `03-translyaciya-iqueryable-v-sql.md` | Трансляция IQueryable в SQL | `translyaciya-iqueryable-v-sql` | 3 | middle |
| `04-ef-tranzakcii-i-urovni-izolyacii.md` | Транзакции и уровни изоляции | `ef-tranzakcii-i-urovni-izolyacii` | 4 | senior |
| `05-ef-optimistichnaya-blokirovka.md` | Оптимистичная блокировка | `ef-optimistichnaya-blokirovka` | 5 | middle |
| `06-ef-migracii.md` | Миграции | `ef-migracii` | 6 | middle |
| `07-kogda-orm-meshaet.md` | Когда ORM мешает | `kogda-orm-meshaet` | 7 | senior |

Все семь — трек `dotnet-backend`, раздел `ef-core`. Префикс `ef-` у части
слагов нужен, потому что слаги глобально уникальны, а уровни изоляции,
блокировки и миграции есть и в разделах `postgresql` и `delivery`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек `dotnet-backend` уже опубликован, так что достаточно опубликовать статьи.

**Импорт берёт один каталог за раз**, поэтому нужен `--dir` — без него
скрипт возьмёт `csharp-lang` и молча не зальёт этот раздел.

## Раздел написан целиком

Все 7 статей по плану (`THEORY_PLAN.md`) написаны. Локально Docker
и PostgreSQL для проверок нет, поэтому проверки разделены на два вида.

**SQL** сгенерирован настоящим Npgsql-провайдером (EF Core 10.0.4,
Npgsql.EntityFrameworkCore.PostgreSQL 10.0.3) без подключения к базе:
запросы — через `ToQueryString()`, команды `SaveChanges` и `ExecuteUpdate` —
перехватчиком, который подменяет открытие соединения и ловит текст команды,
миграции — через `IMigrationsModelDiffer` и `IMigrationsSqlGenerator`.
Там, где в статье список колонок сокращён, это отмечено.

**Поведение и числа** измерены на .NET 10.0.10 и SQLite in-memory:

- **`DetectChanges`** растёт линейно: 0,027 мс на 100 сущностей,
  0,278 на 1000, 2,79 на 10 000, 5,59 на 20 000;
- **трекинг на чтении** 20 000 строк: 25 191 КБ против 8 075 КБ
  у `AsNoTracking` и 6 357 КБ у проекции; время между запусками
  гуляет (53–103 мс против 14–23), память стабильна;
- **identity resolution**: повторный запрос возвращает тот же объект
  и не обновляет даже нетронутые свойства значениями из базы;
- **N+1**: 50 заказов с lazy loading — 51 команда, explicit loading
  в цикле — тоже 51, `Include` — 1, split query на две коллекции — 3;
  `JOIN` двух коллекций дал 600 строк вместо 400 полезных;
- **транзакции**: одиночный `UPDATE` в `SaveChanges` уходит без
  `BEGIN`, два и больше — в транзакции; внутри явной транзакции EF
  ставит savepoint перед каждым `SaveChanges`;
- **`PostgresException.IsTransient`** в Npgsql 10.0.3: `true` для
  `40001` и `40P01`, `false` для `23505`;
- **миграции**: простое переименование свойства — `RENAME COLUMN`,
  переименование вместе с `HasMaxLength` — `DROP COLUMN` + `ADD`;
- **оверхед EF** на запрос по ключу: 94 мкс против 23 у ADO.NET,
  compiled query — 52 мкс.

**Грабля замера:** SQLite выполняет «асинхронные» методы синхронно, поэтому
две параллельные операции на одном контексте там не падают. Ошибка
«A second operation was started on this context instance» в статье про
ChangeTracker взята из документации, а не воспроизведена.
