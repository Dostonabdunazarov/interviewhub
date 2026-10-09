# Раздел «CLR и память» — исходники статей

Статьи трека `.NET Backend` → раздела `clr-memory`. Метаданные — во
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

| Файл | Заголовок | Slug | Порядок |
| --- | --- | --- | --- |
| `01-clr-il-jit.md` | CLR, IL и JIT | `clr-il-jit` | 1 |
| `02-stek-i-kucha.md` | Стек и куча | `stek-i-kucha` | 2 |
| `03-kak-rabotaet-gc.md` | Как работает GC | `kak-rabotaet-gc` | 3 |
| `04-pokoleniya-gen0-gen2.md` | Поколения Gen 0–2 | `pokoleniya-gen0-gen2` | 4 |
| `05-loh-i-fragmentaciya.md` | LOH и фрагментация | `loh-i-fragmentaciya` | 5 |
| `06-gc-root-i-weakreference.md` | GC Root и WeakReference | `gc-root-i-weakreference` | 6 |
| `07-idisposable-using-finalizatory.md` | IDisposable, using и финализаторы | `idisposable-using-finalizatory` | 7 |
| `08-utechki-pamyati.md` | Утечки памяти в managed-коде | `utechki-pamyati` | 8 |
| `09-span-i-memory.md` | Span<T> и Memory<T> | `span-i-memory` | 9 |
| `10-snizhenie-allokaciy.md` | Снижение аллокаций | `snizhenie-allokaciy` | 10 |

Все десять — трек `dotnet-backend`, раздел `clr-memory`, грейд `middle`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек `dotnet-backend` уже опубликован разделом `csharp-lang`, так что
для этого раздела достаточно опубликовать сами статьи.

## Раздел написан целиком

Все 10 статей по плану (`THEORY_PLAN.md`) написаны. Числа про аллокации,
поколения, финализацию и слабые ссылки — замеренные на .NET 10.0.10
(Workstation GC, x64) через `GC.GetAllocatedBytesForCurrentThread()`,
`GC.GetGeneration()` и `GC.CollectionCount()`, а не взятые по памяти.

Два замера пришлось переделать, и это стоит помнить при правках:

- **счётчик финализаций** загрязнялся прогревом замерочного цикла —
  объекты нужно создавать в отдельном методе с `[MethodImpl(NoInlining)]`;
- **слабая ссылка** не обнулялась, пока объект создавался в теле того же
  метода: в Release локальная переменная остаётся корнем до последнего
  использования. Объект тоже нужно создавать в отдельном методе.
