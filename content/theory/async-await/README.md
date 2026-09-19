# Раздел «Асинхронность» — исходники статей

Статьи трека `.NET Backend` → раздела `async-await`. Метаданные — во
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
  --email admin@interview.hypex.site
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
| `01-kak-rabotaet-async-await.md` | Как работает async/await | `kak-rabotaet-async-await` | 1 |
| `02-state-machine.md` | State machine асинхронного метода | `state-machine` | 2 |
| `03-task-vs-thread-vs-valuetask.md` | Task vs Thread vs ValueTask | `task-vs-thread-vs-valuetask` | 3 |
| `04-synchronizationcontext.md` | SynchronizationContext | `synchronizationcontext` | 4 |
| `05-configureawait-false.md` | ConfigureAwait(false) | `configureawait-false` | 5 |
| `06-dedloki-na-result.md` | Дедлоки на .Result | `dedloki-na-result` | 6 |
| `07-async-void.md` | async void | `async-void` | 7 |
| `08-whenall-whenany-isklyucheniya.md` | WhenAll, WhenAny и исключения | `whenall-whenany-isklyucheniya` | 8 |
| `09-cancellationtoken-i-taymauty.md` | CancellationToken и таймауты | `cancellationtoken-i-taymauty` | 9 |
| `10-iasyncenumerable.md` | IAsyncEnumerable | `iasyncenumerable` | 10 |

Все десять — трек `dotnet-backend`, раздел `async-await`, грейд `middle`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек `dotnet-backend` уже опубликован, так что достаточно опубликовать статьи.

**Импорт берёт один каталог за раз**, поэтому нужен `--dir`:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/async-await
```

## Раздел написан целиком

Все 10 статей по плану (`THEORY_PLAN.md`) написаны. Числа — замеренные
на .NET 10.0.10, а не взятые по памяти. Что именно проверялось:

- **дедлок на `.Result`** воспроизведён: под однопоточным контекстом
  зависает (1209 мс до таймаута), с `ConfigureAwait(false)` внутри —
  59 мс. Важно: насос очереди и блокировка должны быть на **одном**
  потоке, иначе дедлока не будет и замер соврёт;
- **голодание пула**: 50 блокирующих задач — 749 мс, те же через
  `await` — 109 мс;
- **`Task.Run` против `new Thread`** на 1000 блокирующих операций:
  970 мс против 138 мс — пул растёт постепенно, и это довод не в пользу
  потоков, а против блокировки потоков пула (`Task.Delay` — 15 мс);
- **аллокации**: `async Task` при синхронном завершении — 0 байт,
  `Task.FromResult` — 72 байта (вопреки ожиданию, что async дороже);
- **`WhenAll`** с тремя падающими задачами: `await` бросает одно
  исключение, в `.Exception` лежат все три.
