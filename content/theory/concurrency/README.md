# Раздел «Многопоточность» — исходники статей

Статьи трека `.NET Backend` → раздела `concurrency`. Метаданные — во
фронтматтере каждого файла, тело — markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной. Сначала посмотреть, что будет сделано:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/concurrency
```

Локально:

```bash
node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/concurrency
```

В прод — пароль через переменную окружения, а не флагом: флаг виден в списке
процессов и остаётся в history шелла.

```bash
IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/concurrency --update --publish
```

По умолчанию статьи создаются **черновиками** и существующие не трогаются.
`--update` обновляет по slug, `--publish` ставит статус «Опубликована».
Привязки к вопросам импорт не стирает: при обновлении они переносятся как есть.

Метаданные берутся из фронтматтера в начале каждого файла — `title`, `slug`,
`track`, `section`, `level`, `sortOrder`, `summary`. `readingMinutes` не задаётся:
его считает `AppDbContext.SaveChangesAsync` (200 слов в минуту, минимум 1).

Импорт идёт через админ-API, а не SQL: так работают валидация, генерация slug
и сброс кэша публичного дерева.

## Файлы и источник правды

**Источник правды — база.** Мелкие правки удобнее делать в админке
(`/admin/theory`). Если правите файл здесь — прогоните импорт с `--update`,
иначе версии разойдутся.

## Что куда

| Файл | Заголовок | Slug | Порядок | Грейд |
| --- | --- | --- | --- | --- |
| `01-processy-potoki-threadpool.md` | Процессы, потоки и ThreadPool | `processy-potoki-threadpool` | 1 | middle |
| `02-concurrency-vs-parallelism.md` | Concurrency vs parallelism | `concurrency-vs-parallelism` | 2 | middle |
| `03-race-condition.md` | Race condition | `race-condition` | 3 | middle |
| `04-lock-i-monitor.md` | lock и Monitor | `lock-i-monitor` | 4 | middle |
| `05-mutex-semaphore-readerwriterlockslim.md` | Mutex, Semaphore и ReaderWriterLockSlim | `mutex-semaphore-readerwriterlockslim` | 5 | middle |
| `06-interlocked-i-atomarnost.md` | Interlocked и атомарность | `interlocked-i-atomarnost` | 6 | middle |
| `07-volatile-i-barery-pamyati.md` | volatile и барьеры памяти | `volatile-i-barery-pamyati` | 7 | senior |
| `08-deadlock-livelock-starvation.md` | Deadlock, livelock, starvation | `deadlock-livelock-starvation` | 8 | middle |
| `09-konkurentnye-kollekcii.md` | Конкурентные коллекции | `konkurentnye-kollekcii` | 9 | middle |
| `10-channel-t.md` | Channel&lt;T&gt; | `channel-t` | 10 | middle |
| `11-asinhronnaya-sinhronizaciya.md` | Асинхронная синхронизация | `asinhronnaya-sinhronizaciya` | 11 | middle |

Все одиннадцать — трек `dotnet-backend`, раздел `concurrency`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек `dotnet-backend` уже опубликован, так что достаточно опубликовать статьи.
**Импорт берёт один каталог за раз**, поэтому `--dir` обязателен — без него
зальётся `csharp-lang`, и об этом никто не скажет.

## Раздел написан целиком

Все 11 статей по плану (`THEORY_PLAN.md`) написаны. Источник черновиков —
`content/questions/multithreading.md`, переписанный в связный текст.
Числа измерены на .NET 10.0.10, x64, Ryzen 7 5800H (8 ядер, 16 потоков),
Windows 11; консольные проекты лежат в `.claude/tempfiles/theory-concurrency/`.
Что проверялось:

- **цена потока**: тысяча `new Thread` + `Join` — 168–235 мс, тысяча задач пула —
  1–5 мс; выше минимума пул добавляет поток раз в полсекунды-секунду;
- **гонка `count++`**: миллион инкрементов из `Parallel.For` дают 89–253 тысячи;
- **блокировки без конкуренции** (BenchmarkDotNet): `lock` 5,6 нс, `Lock` 4,9 нс,
  `SemaphoreSlim` 17,8 нс, `Mutex` 820 нс;
- **конкуренция**: шестнадцать потоков на общем `lock` в шесть раз медленнее
  одного, на общем `Interlocked`-счётчике — в пять-шесть раз; false sharing —
  замедление в 10–21 раз;
- **модель памяти**: цикл на обычном поле в Release не видит флаг остановки;
  протокол Деккера на `Volatile.Write/Read` проваливается в 3541 случае из
  200 000, с полным барьером — ни разу; на x64 volatile-обращения — обычные `mov`;
- **deadlock**: встречные переводы с наивным порядком блокировок зависают
  после нескольких тысяч операций, CPU процесса в дедлоке — 0 мс;
- **коллекции**: параллельная запись роняет `Dictionary` во всех прогонах;
  `ConcurrentDictionary` на чтении в 60 раз быстрее словаря под `lock`,
  но занимает 51 байт на элемент против 28; `GetOrAdd` вызвал фабрику 16 раз
  из 16 потоков; на горячем ключе `AddOrUpdate` вчетверо медленнее `lock`;
- **каналы**: bounded-канал в устойчивом режиме не аллоцирует, 32 ожидающих
  `ReadAsync` не занимают потоков, 32 `BlockingCollection.Take()` подняли пул
  с 7 до 20 потоков;
- **асинхронная синхронизация**: двести задач через `SemaphoreSlim` — 3 с
  с `WaitAsync` и 80 с со 108 потоками пула с `Wait`; `ThreadLocal` после
  `await` отдал чужое значение в 997 случаях из 1000.

**Что не замерено:** поведение на ARM64 (инструкции `ldar`/`stlr`/`dmb`,
перестановки, которые x86 не делает) описано по документации runtime
(`docs/design/specs/Memory-model.md`) — ARM-машины под рукой не было.

**Грабля замера:** первая версия эксперимента с порядком пробуждения
`SemaphoreSlim` показала «случайный» порядок — продолжения выполнялись в пуле,
и замер ловил порядок их запуска, а не порядок входа. Правильный замер —
каждый вошедший записывает свой номер и сам вызывает `Release`; так порядок
оказался строго по очереди.
