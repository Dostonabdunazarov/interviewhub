---
title: Health checks
slug: aspnet-health-checks
track: dotnet-backend
section: aspnet-core
level: middle
sortOrder: 8
summary: Как устроены встроенные health checks и какие коды они отдают, чем liveness отличается от readiness, почему проверка базы в liveness приводит к каскадному отказу и почему зелёная проба ещё не значит, что сервис работает.
---

Health check — HTTP-endpoint, по которому оркестратор или балансировщик решает судьбу экземпляра приложения: слать ли на него трафик, перезапускать ли его. Написать такую проверку легко, а вот написать проверку, которая отвечает на правильный вопрос, — уже нет. Неудачная проба либо пропускает неработающий сервис, либо сама роняет здоровый.

## Встроенный механизм

```csharp
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
    .AddDbContextCheck<AppDbContext>(tags: ["ready"])
    .AddCheck<QueueLagHealthCheck>("queue", tags: ["ready"]);

var app = builder.Build();

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("live")
});
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready")
});
```

`AddHealthChecks()` регистрирует проверки, `MapHealthChecks()` публикует endpoint. Теги и `Predicate` позволяют разложить одни и те же проверки по разным endpoint'ам — это понадобится для liveness и readiness.

Своя проверка — реализация `IHealthCheck`:

```csharp
public sealed class QueueLagHealthCheck(IQueueClient queue) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        var lag = await queue.GetLagAsync(ct);
        return lag switch
        {
            < 1_000 => HealthCheckResult.Healthy(),
            < 10_000 => HealthCheckResult.Degraded($"lag {lag}"),
            _ => HealthCheckResult.Unhealthy($"lag {lag}")
        };
    }
}
```

Готовые проверки для PostgreSQL, Redis, RabbitMQ, Kafka и десятков других систем есть в пакетах `AspNetCore.HealthChecks.*` проекта Xabaril. `AddDbContextCheck` — в `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore`.

## Статусы и коды

У проверки три исхода: `Healthy`, `Degraded`, `Unhealthy`. Endpoint отдаёт худший из статусов включённых в него проверок. Проверено на .NET 10:

```
без проверок        → 200 Healthy
Degraded            → 200 Degraded
Unhealthy           → 503 Unhealthy
проверка бросила исключение → 503 Unhealthy
все проверки вместе → 503 Unhealthy
```

Несколько выводов из этой таблицы.

**Endpoint без проверок всегда зелёный.** `MapHealthChecks("/health")` без единой регистрации проверяет только то, что процесс жив и Kestrel отвечает.

**`Degraded` отдаёт тот же `200`, что и `Healthy`.** Балансировщик и Kubernetes смотрят на код, а не на тело, поэтому для них деградации не существует. Если она должна что-то значить, маппинг задают явно через `ResultStatusCodes`.

**Исключение в проверке не роняет endpoint** — оно превращается в статус `Unhealthy` с кодом 503. Статус при сбое задаётся параметром `failureStatus` при регистрации.

Ответ по умолчанию — `text/plain` со строкой статуса и заголовком `Cache-Control: no-store, no-cache`, чтобы промежуточный прокси не закэшировал результат. Детальный JSON с каждой проверкой настраивается через `ResponseWriter`.

## Таймауты

Проверки выполняются на каждый запрос к endpoint'у, параллельно. Зависшая зависимость подвесит и пробу, а проба Kubernetes с таймаутом в секунду просто посчитает это провалом без всякой диагностики. Поэтому у проверки стоит задавать собственный таймаут:

```csharp
builder.Services.AddHealthChecks()
    .AddCheck<SlowDependencyCheck>("dependency",
        failureStatus: HealthStatus.Degraded,
        tags: ["ready"],
        timeout: TimeSpan.FromSeconds(1));

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready"),
    ResultStatusCodes = { [HealthStatus.Degraded] = StatusCodes.Status503ServiceUnavailable }
});
```

Проверено на .NET 10: проверка, которая ждёт 10 секунд, с `timeout` в одну секунду завершилась за 1,16 с статусом `Degraded`, который благодаря `ResultStatusCodes` превратился в 503. Токен в `CheckHealthAsync` отменяется по таймауту — проверка обязана его уважать, ровно как любой асинхронный код из статьи `CancellationToken и таймауты`.

Тяжёлые проверки, которые нельзя запускать на каждую пробу раз в несколько секунд, кэшируют или выносят в `IHealthCheckPublisher` — он периодически выполняет проверки в фоне и публикует результат в мониторинг.

## Liveness, readiness, startup

В Kubernetes три вида проб, и они отвечают на разные вопросы:

| Проба | Вопрос | Реакция на провал |
| --- | --- | --- |
| liveness | процесс не завис? | перезапуск контейнера |
| readiness | можно ли слать сюда трафик? | под исключается из балансировки |
| startup | приложение уже стартовало? | пока не прошла, liveness не проверяется |

Главное правило: **в liveness не проверять внешние зависимости.** Представьте, что база недоступна минуту. Если liveness её проверяет, все реплики одновременно провалят пробу и уйдут в перезапуск. Перезапуск базу не починит, зато сервис на это время исчезнет целиком, а после восстановления базы все поды разом пойдут прогревать кэши и открывать соединения. Локальная проблема превращается в каскадный отказ.

Зависимости проверяют в readiness, и то осторожно. Если общая база недоступна, readiness всех подов упадёт разом, и вместо осмысленных `503` от приложения клиенты получат ошибки балансировщика, которому не на кого слать трафик. Readiness должна проверять то, без чего **этот** экземпляр не может обслужить запрос, а не всё подряд.

Startup-проба нужна приложениям с долгой инициализацией — прогрев кэша, загрузка модели. Без неё liveness с коротким таймаутом начнёт перезапускать под, который ещё просто не успел подняться.

## Почему зелёная проба врёт

Health check проверяет только то, что в нём запрограммировано, а это почти всегда меньше пути реального запроса. Типичные сценарии ложного OK:

- **Мёртвый фоновый сервис.** `BackgroundService`, читающий очередь, вышел из цикла или завис. HTTP-часть отвечает, сообщения копятся, проба зелёная.
- **Проверка соединения, а не операции.** `SELECT 1` проходит, а рабочие запросы падают: нет прав на новую таблицу после миграции, таблица заблокирована, пул соединений исчерпан.
- **Обход проблемного пути.** Health endpoint обычно исключён из аутентификации и rate limiting — а сломано как раз это: просрочен ключ подписи, лимитер отклоняет всех.
- **Проверка через балансировщик.** Внешний мониторинг попадает в здоровый под, а один из пяти отдаёт ошибки пятой части пользователей.

Честнее проверки делают так. Liveness учитывает heartbeat ключевых циклов: фоновый сервис после каждой итерации обновляет отметку времени, а проверка считает его мёртвым, если отметка слишком старая.

```csharp
public sealed class WorkerHeartbeat
{
    private long _lastTick;
    public void Beat(TimeProvider clock) => Interlocked.Exchange(ref _lastTick, clock.GetUtcNow().ToUnixTimeMilliseconds());
    public DateTimeOffset Last => DateTimeOffset.FromUnixTimeMilliseconds(Interlocked.Read(ref _lastTick));
}

public sealed class WorkerHealthCheck(WorkerHeartbeat hb, TimeProvider clock) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext ctx, CancellationToken ct = default)
    {
        var age = clock.GetUtcNow() - hb.Last;
        return Task.FromResult(age < TimeSpan.FromMinutes(2)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy($"worker молчит {age}"));
    }
}
```

`Interlocked` здесь нужен потому, что пишет один поток, а читает другой: запись `long` не атомарна на 32-битных платформах, а барьер памяти гарантирует, что проверка увидит свежее значение.

Readiness проверяет операцию, а не соединение: лёгкий запрос к реальной таблице с правами приложения, лаг очереди, а не только факт подключения к брокеру. А то, что пробы не видят в принципе, ловят алерты по реальному трафику — доле ошибок и латентности — и синтетический мониторинг, выполняющий настоящую пользовательскую операцию через публичный вход.

## Health checks в конвейере

Проба приходит раз в несколько секунд с каждого узла, и прогонять её через весь конвейер незачем. С .NET 8 endpoint можно завершить сразу после routing:

```csharp
app.MapHealthChecks("/health/live").ShortCircuit();
```

Такой запрос не проходит аутентификацию, авторизацию, rate limiting и логирование запросов — подробнее про `ShortCircuit` в статье `Pipeline и middleware`. При этом детальный ответ с перечнем зависимостей наружу не публикуют: он раскрывает инфраструктуру. Endpoint ограничивают отдельным портом или хостом через `RequireHost`, а подробный JSON отдают только на внутреннем адресе.

Readiness участвует и в остановке приложения: при получении сигнала она начинает отдавать 503, чтобы балансировщик быстрее вывел экземпляр из ротации. Как это связано с потерей запросов при деплое — в статье `Graceful shutdown`.

## Что стоит ответить на собеседовании

Health checks в ASP.NET Core — `AddHealthChecks()` с проверками `IHealthCheck` и `MapHealthChecks()` с фильтром по тегам. Endpoint отдаёт худший статус: `Healthy` и `Degraded` — `200`, `Unhealthy` — `503`, исключение внутри проверки тоже даёт `503`, а endpoint без проверок всегда зелёный. Маппинг меняется через `ResultStatusCodes`, у проверки можно задать `timeout` и `failureStatus`.

Сильный ответ разведёт пробы: liveness — только «процесс не завис», без внешних зависимостей, иначе недоступная база отправит все реплики в перезапуск и локальный сбой станет каскадным; readiness — «может ли этот экземпляр обслужить запрос»; startup — защита долгой инициализации от liveness. И объяснит, почему зелёная проба не значит «работает»: она проверяет только запрограммированное, поэтому нужны heartbeat фоновых сервисов, проверка операций вместо соединений и алерты по реальному трафику.
