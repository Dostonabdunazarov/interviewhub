# Раздел «Soft skills» — исходники статей

Статьи трека `Собеседование` (`interview`) → раздела `soft-skills`. Это второй
раздел трека, после `process`. Метаданные — во фронтматтере каждого файла,
тело — markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/soft-skills

node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/soft-skills

IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/soft-skills --update --publish
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
| `01-metod-star.md` | STAR | `metod-star` | junior | 1 |
| `02-rasskaz-o-sebe.md` | Рассказ о себе | `rasskaz-o-sebe` | junior | 2 |
| `03-konflikt-v-komande.md` | Конфликт в команде | `konflikt-v-komande` | middle | 3 |
| `04-oshibka-v-prode.md` | Ошибка в проде | `oshibka-v-prode` | middle | 4 |
| `05-nesoglasie-s-resheniem-komandy.md` | Несогласие с решением команды | `nesoglasie-s-resheniem-komandy` | middle | 5 |
| `06-prioritizaciya.md` | Приоритизация | `prioritizaciya` | middle | 6 |
| `07-mentorstvo.md` | Менторство | `mentorstvo` | senior | 7 |
| `08-razgovor-s-biznesom.md` | Разговор с бизнесом | `razgovor-s-biznesom` | senior | 8 |

Все восемь — трек `interview`, раздел `soft-skills`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Трек `interview` включается переключателем «виден» в админке после
публикации раздела `process` — см. `content/theory/process/README.md`.
Если этот раздел публикуется первым, переключатель нужно включить сейчас.

## Раздел написан целиком

Все 8 статей по плану (`THEORY_PLAN.md`) написаны. Источник материала —
ответы из `Soft_Skills_Questions.md` в корне репозитория, переписанные
в связные статьи: каждая строится вокруг одной истории по схеме STAR из
работы .NET backend-разработчика, с разбором слабых ответов и итоговым
разделом «Что стоит ответить на собеседовании».

Истории в статьях — собирательные примеры, а не случаи из конкретных
компаний; цифр о найме в них нет. Технические детали историй
(`SKIP LOCKED` против дублей в фоновой задаче, N+1 в EF Core,
Testcontainers в CI) раскрываются в разделах трека «.NET Backend» и
«Распределённые системы».

Вопросы уровня lead из исходного файла (найм и увольнение) отдельной
статьи не получили: часть про отказ бизнесу вошла в `Разговор с бизнесом`,
а критика кода на ревью — в `Конфликт в команде`.
