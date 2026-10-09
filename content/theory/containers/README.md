# Раздел «Контейнеры и Kubernetes» — исходники статей

Статьи трека `Инфраструктура` (`infrastructure`) → раздела `containers`.
Это первый раздел трека. Метаданные — во фронтматтере каждого файла,
тело — markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/containers

node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/containers

IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/containers --publish
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
| `01-k8s-minimalnyy-obraz-net.md` | Минимальный образ .NET | `k8s-minimalnyy-obraz-net` | senior | 1 |
| `02-k8s-limity-cpu-i-pamyati.md` | Лимиты CPU и памяти для .NET | `k8s-limity-cpu-i-pamyati` | senior | 2 |
| `03-k8s-readiness-vs-liveness.md` | Readiness vs liveness | `k8s-readiness-vs-liveness` | senior | 3 |
| `04-k8s-graceful-shutdown.md` | Graceful shutdown в K8s | `k8s-graceful-shutdown` | senior | 4 |

Все четыре — трек `infrastructure`, раздел `containers`. Префикс `k8s-`
у слагов нужен потому, что `aspnet-health-checks` и `aspnet-graceful-shutdown`
уже заняты статьями раздела `aspnet-core`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Это первый раздел трека `infrastructure`, поэтому после публикации статей
трек нужно включить переключателем «виден» в админке — сидер создаёт
треки скрытыми. Пока трек скрыт, опубликованные статьи гостям не видны.

## Раздел написан целиком

Все 4 статьи по плану (`THEORY_PLAN.md`) написаны. Источник материала —
ответы категории `devops` из `content/questions/devops.md` и вопрос про
Server GC в контейнере из `content/questions/clr-gc.md`, переписанные
в связный текст.

Разделение с соседями: сторона ASP.NET Core (теги health checks,
поведение Generic Host по `SIGTERM`) — в статьях `Health checks` и
`Graceful shutdown` раздела `aspnet-core`; здесь — сторона Kubernetes.
Устройство GC — в `clr-memory` и `performance`, здесь только то,
как рантайм видит лимиты контейнера.

Проверено замером на .NET 10 (консольный проект в
`.claude/tempfiles/theory-infra/probe`):

- `DOTNET_PROCESSOR_COUNT=10` даёт `Environment.ProcessorCount = 10` —
  значение десятичное;
- `DOTNET_GCHeapHardLimit=10000000` и `=0x10000000` дают кучу 256 МБ —
  значения `DOTNET_GC*` шестнадцатеричные, префикс необязателен;
- `DOTNET_GCHeapHardLimitPercent=0x46` и `=46` дают одинаковые 70%;
- `DOTNET_gcServer=1` включает Server GC.

Сверено с документацией: пользователь `app` и `APP_UID` (1654), порт 8080
с .NET 8, chiseled без ICU и shell, куча по умолчанию — 75% лимита
контейнера, порядок остановки пода и условия EndpointSlice, действие
`preStop.sleep` (бета и включено по умолчанию с Kubernetes 1.30).

Темы наблюдаемости — метрики, SLO, алерты, трассировки — оставлены
разделу `observability`.
