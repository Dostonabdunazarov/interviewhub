# Раздел «Наблюдаемость» — исходники статей

Статьи трека `Инфраструктура` (`infrastructure`) → раздела `observability`.
Метаданные — во фронтматтере каждого файла, тело — markdown под ним.

## Как залить в базу

Скриптом, а не руками по одной:

```bash
node tools/import-theory.mjs --dry-run --dir content/theory/observability

node tools/import-theory.mjs \
  --url http://localhost:5103 \
  --email admin@interview.hypex.site \
  --password 'Admin123!' \
  --dir content/theory/observability

IH_ADMIN_PASSWORD='…' node tools/import-theory.mjs \
  --url https://interview.hypex.site \
  --email admin@hypex.site \
  --dir content/theory/observability --publish
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
| `01-logi-metriki-trassirovki.md` | Логи, метрики, трассировки | `logi-metriki-trassirovki` | middle | 1 |
| `02-opentelemetry-v-dotnet.md` | OpenTelemetry в .NET | `opentelemetry-v-dotnet` | senior | 2 |
| `03-semplirovanie.md` | Сэмплирование | `semplirovanie-trassirovok` | senior | 3 |
| `04-sli-i-slo.md` | SLI и SLO | `sli-i-slo` | senior | 4 |
| `05-alerty-bez-shuma.md` | Алерты без шума | `alerty-bez-shuma` | senior | 5 |
| `06-razbor-incidenta.md` | Разбор инцидента | `razbor-incidenta` | senior | 6 |

Все шесть — трек `infrastructure`, раздел `observability`.

## Чтобы статьи стали видны гостям

Нужны **оба** условия: статус статьи `Published` и трек `IsPublished = true`.
Если трек `infrastructure` ещё скрыт, после публикации статей его нужно
включить переключателем «виден» в админке — сидер создаёт треки скрытыми.

## Раздел написан целиком

Все 6 статей по плану (`THEORY_PLAN.md`) написаны. Источник материала —
ответы категории `devops` из `content/questions/devops.md` (метрики и логи,
SLI и SLO, алерты, OpenTelemetry, сэмплирование, связь сигналов при
инциденте), а также `performance-profiling.md` и `microservices.md`
про распределённую трассировку и порядок действий при деградации,
переписанные в связный текст.

Код на C# собран на .NET 10 с OpenTelemetry 1.19 и `Npgsql.OpenTelemetry` 10.
Проверено запуском:

- `AddOpenTelemetry().WithTracing().WithMetrics().WithLogging().UseOtlpExporter()`
  стартует без ошибок;
- `StartActivity` без подписчика возвращает `null`, а при отброшенном
  сэмплированием span'е — `Activity` с `Recorded = false`
  и `IsAllDataRequested = false` и флагом `00` в `traceparent`;
- инструменты Meter `System.Runtime` на .NET 10: `dotnet.gc.pause.time`,
  `dotnet.gc.collections`, `dotnet.thread_pool.queue.length`,
  `dotnet.process.cpu.time`, `dotnet.exceptions` и другие;
- границы бакетов `http.server.request.duration`: 0,005 … 10 секунд,
  14 значений, порога 0,4 среди них нет.

Сверено с документацией: `UseOtlpExporter` с версии 1.8, переменные
`OTEL_TRACES_SAMPLER` с 1.8, `AddRuntimeInstrumentation` на .NET 9+
подписывается на встроенный `System.Runtime`; параметры `tail_sampling`
(`decision_wait`, `num_traces`, `expected_new_traces_per_sec`, политики
`status_code`, `latency`, `string_attribute`, `probabilistic`, `and`,
`drop`, `composite`); переименование компонентов Collector в snake_case
(`otlp_grpc`, `otlp_http`, `load_balancing`, `k8s_attributes`,
`prometheus_remote_write`) со старыми именами как псевдонимами.

Арифметика перепроверена: burn rate 14,4 за час — 2% бюджета за 30 дней,
6 за 6 часов — 5%, 1 за 3 дня — 10% (схема Google SRE Workbook);
бюджет 99,9% — 43,2 минуты за 30 дней; при 50 RPS, 0,1% ошибок
и head sampling 1% сохраняется один трейс с ошибкой примерно в 33 минуты.

Имена меток в PromQL (`job`, `service_version`) иллюстративны и зависят
от того, как метрики попадают в Prometheus, — это сказано в статьях.

Разделение с соседями: `dotnet-counters`, `dotnet-trace`, exemplars
и поиск хвоста — в разделе `performance` (`Что делать с p99`,
`База или приложение`); gray failure и пробы — в `reliability`
и `aspnet-core`; стратегии выкатки — в `Rolling, blue-green, canary`
раздела `delivery`, здесь — только метрики для анализа canary.
