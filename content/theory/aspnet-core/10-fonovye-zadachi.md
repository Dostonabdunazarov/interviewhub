---
title: Фоновые задачи
slug: aspnet-fonovye-zadachi
track: dotnet-backend
section: aspnet-core
level: middle
sortOrder: 10
summary: Как устроены IHostedService и BackgroundService, почему исключение в ExecuteAsync роняет хост, как писать периодические задачи без перекрытий, очереди на Channel<T> и когда пора брать Hangfire или Quartz.
questions: aspnet-core-chem-ihostedservice-otlichaetsya-ot-backgroundservice, aspnet-core-kak-rabotaet-ihostedservice, aspnet-core-kak-realizovat-background-worker, advanced-concurrency-kak-realizovat-periodicheskuyu-zadachu-ustoichivuyu-k-perekrytiyu-zapu, advanced-concurrency-kak-pravilno-zavershit-dolgii-background-obrabotchik-pri-ostanovke-pri
---

Почти каждому веб-приложению нужна работа вне запроса: публикация outbox, очистка устаревших данных, отправка писем, прогрев кэша. Делать её через `Task.Run` из контроллера нельзя — такую задачу никто не отслеживает, её исключения теряются, а при остановке процесса она обрывается молча. В ASP.NET Core для этого есть hosted services: работа, которая стартует и останавливается вместе с хостом.

## IHostedService: старт и стоп

Базовый контракт — интерфейс из двух методов:

```csharp
public interface IHostedService
{
    Task StartAsync(CancellationToken cancellationToken);
    Task StopAsync(CancellationToken cancellationToken);
}
```

Регистрация — `builder.Services.AddHostedService<T>()`, сервис становится singleton. При `app.Run()` Generic Host вызывает `StartAsync` у всех hosted services **последовательно** в порядке регистрации и ждёт завершения каждого. Kestrel в `WebApplication` — тоже hosted service, и он стартует после пользовательских. Отсюда главное следствие: пока ваш `StartAsync` не вернул управление, приложение не принимает HTTP-запросы. Бесконечный цикл в `StartAsync` не даст хосту стартовать вообще.

Это поведение бывает полезным. Обязательная инициализация до приёма трафика — миграции, проверка конфигурации, прогрев кэша — ложится в `StartAsync` естественно, а исключение в нём уронит запуск, и приложение не поднимется в сломанном состоянии:

```csharp
public sealed class CacheWarmupService(IServiceScopeFactory scopes, PriceCache cache) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        cache.Load(await db.Prices.AsNoTracking().ToListAsync(ct));
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
```

При остановке `StopAsync` вызывается в **обратном** порядке, а токен в нём отменяется по истечении `HostOptions.ShutdownTimeout`. С .NET 8 есть `IHostedLifecycleService` с хуками `StartingAsync`, `StartedAsync`, `StoppingAsync`, `StoppedAsync`, а `HostOptions.ServicesStartConcurrently` и `ServicesStopConcurrently` позволяют запускать и останавливать независимые сервисы параллельно.

## BackgroundService и ExecuteAsync

Для долгоживущей работы — цикла по очереди, polling'а, расписания — есть абстрактный класс `BackgroundService`. Он реализует `IHostedService` сам, а вы переопределяете один метод `ExecuteAsync(CancellationToken stoppingToken)`.

Внутри всё сводится к трём действиям. `StartAsync` создаёт связанный `CancellationTokenSource`, запускает `ExecuteAsync` и сразу возвращает управление, не дожидаясь её завершения, — поэтому бесконечный цикл не блокирует старт. `StopAsync` отменяет `stoppingToken` и ждёт задачу `ExecuteAsync`, но не дольше, чем позволяет его собственный токен.

| | `IHostedService` | `BackgroundService` |
| --- | --- | --- |
| Что реализуете | `StartAsync` и `StopAsync` | только `ExecuteAsync` |
| Блокирует старт | да, пока не вернётся `StartAsync` | нет |
| Отмена | сами | готовый `stoppingToken` |
| Для чего | инициализация до трафика, обёртка над чужим lifecycle | бесконечные циклы, очереди, расписания |

Есть исторический нюанс. До .NET 10 код `ExecuteAsync` до первого настоящего `await` выполнялся синхронно внутри `StartAsync` и задерживал запуск остальных сервисов и Kestrel. Классический костыль — `await Task.Yield()` первой строкой. В .NET 10 `ExecuteAsync` целиком запускается отдельной задачей, но код, рассчитанный на более ранние версии, всё ещё стоит писать с этим в уме.

## Исключение в ExecuteAsync

До .NET 6 необработанное исключение в `ExecuteAsync` молча завершало задачу: приложение продолжало отвечать на запросы, а фоновая обработка тихо умирала. С .NET 6 по умолчанию действует `BackgroundServiceExceptionBehavior.StopHost`: исключение логируется, и хост **останавливается целиком**. Вернуть старое поведение можно через `HostOptions.BackgroundServiceExceptionBehavior = Ignore`, но это почти всегда маскировка проблемы.

Правильный ответ на это поведение — ловить исключения на уровне одной итерации, а не всего метода. Одно ядовитое сообщение или кратковременный сбой БД не должны ни ронять процесс, ни останавливать расписание. При этом `OperationCanceledException` при остановке — не ошибка, её отделяют фильтром `when (stoppingToken.IsCancellationRequested)` и выходят из цикла.

## Scoped-зависимости

Hosted service — singleton. `DbContext`, внедрённый в конструктор, прожил бы всё время работы процесса: копил бы отслеживаемые сущности, держал соединение и делился между итерациями. Это captive dependency из статьи `DI и жизненные циклы`.

Решение — `IServiceScopeFactory` и отдельный скоуп на каждую единицу работы: итерацию таймера или одно сообщение из очереди. `CreateAsyncScope()` предпочтительнее `CreateScope()`, потому что корректно освобождает зависимости с `IAsyncDisposable`.

## Периодическая задача на PeriodicTimer

Каноничная периодическая задача с .NET 6 — цикл на `PeriodicTimer`:

```csharp
public sealed class CleanupJob(
    IServiceScopeFactory scopes,
    ILogger<CleanupJob> logger,
    TimeProvider time) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5), time);
        do
        {
            using var runCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            runCts.CancelAfter(TimeSpan.FromMinutes(4));
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<Cleaner>().RunAsync(runCts.Token);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Cleanup failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
```

Почему не перекрывается: следующий `WaitForNextTickAsync` вызывается только после того, как итерация закончилась. Если работа длилась дольше периода, ожидание завершится сразу, но один раз — пропущенные тики не копятся и не превращаются в пачку параллельных запусков. У `System.Threading.Timer` всё наоборот: колбэк вызывается по расписанию, даже если предыдущий ещё работает, `async`-лямбда в нём становится `async void`, а необработанное исключение роняет процесс.

Связанный токен с `CancelAfter` ограничивает длительность одной итерации: зависший запрос не съест все последующие запуски. Конструктор с `TimeProvider` (.NET 8+) позволяет проверять расписание в тестах через `FakeTimeProvider`.

После рестарта расписание начинается заново. Если пропуски недопустимы, время последнего **успешного** запуска хранят в БД и при старте решают, нужно ли догонять. Это же время стоит выставить метрикой с алертом, иначе `try/catch` неделями скрывает падения.

## Несколько экземпляров

`PeriodicTimer` защищает от перекрытия только внутри одного процесса. Три реплики приложения запустят одну и ту же очистку трижды. Нужна распределённая защита: аренда (lease) в таблице БД, `pg_try_advisory_lock` в PostgreSQL, `SET NX PX` в Redis, либо планировщик с кластерным хранилищем. Срок аренды должен быть больше максимальной длительности запуска, иначе долгую итерацию перехватит другой экземпляр.

Идемпотентность при этом обязательна всё равно: блокировка может истечь посреди работы из-за GC-паузы или сетевого сбоя, и на короткое время два экземпляра будут работать одновременно. Если реплики стартуют синхронно, помогает случайный сдвиг первого тика, как в статье `Retry, jitter и retry storm`.

## Очередь на Channel<T>

Второй типичный сценарий — работа, которую порождает HTTP-запрос, но выполнять её в запросе незачем: письмо, отчёт, вызов медленного внешнего API. Endpoint кладёт задачу в очередь и сразу отвечает `202 Accepted`, а worker разбирает очередь в фоне:

```csharp
public sealed class EmailQueue
{
    private readonly Channel<EmailJob> _channel = Channel.CreateBounded<EmailJob>(
        new BoundedChannelOptions(1_000) { FullMode = BoundedChannelFullMode.Wait });

    public ValueTask EnqueueAsync(EmailJob job, CancellationToken ct) => _channel.Writer.WriteAsync(job, ct);
    public IAsyncEnumerable<EmailJob> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

public sealed class EmailWorker(EmailQueue queue, IServiceScopeFactory scopes, ILogger<EmailWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<IEmailSender>().SendAsync(job, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Email {Id} failed", job.Id);
            }
        }
    }
}

builder.Services.AddSingleton<EmailQueue>();
builder.Services.AddHostedService<EmailWorker>();

app.MapPost("/reports", async (ReportRequest req, EmailQueue queue, CancellationToken ct) =>
{
    await queue.EnqueueAsync(new EmailJob(req.Email), ct);
    return Results.Accepted();
});
```

Bounded-канал даёт backpressure: при переполнении запись ждёт, а не раздувает память.

Главное ограничение — очередь живёт в памяти процесса. При рестарте или падении всё, что в ней лежит, пропадает, а при нескольких репликах каждая обрабатывает только своё. Для работы, которую нельзя терять, нужен внешний брокер (RabbitMQ, Kafka, SQS) или таблица-очередь в БД, а подтверждение сообщения — только после обработки.

## Корректное завершение

По сигналу остановки хост отменяет `stoppingToken` и ждёт выхода из `ExecuteAsync` не дольше `HostOptions.ShutdownTimeout` — по умолчанию 30 секунд с .NET 6. Таймаут общий на всех: при последовательной остановке сервисы делят его между собой. Что успело — успело, остальное обрывается вместе с процессом. Как это согласуется с Kestrel и Kubernetes, разобрано в статье `Graceful shutdown`.

Отсюда несколько решений, которые принимают осознанно:

- **Токен — во все ожидания.** `Task.Delay`, чтение очереди, запрос к БД без токена задержат остановку на всю свою длительность.
- **Перестать брать новое, а текущее — дождаться или прервать.** Передать `stoppingToken` в транзакцию — значит прервать её на середине. Часто лучше не брать новые элементы сразу, а текущей итерации дать завершиться со своим таймаутом, заметно меньшим `ShutdownTimeout`.
- **Начатый элемент не терять.** Если итерация прервана, элемент возвращают в очередь или не подтверждают брокеру.
- **На `StopAsync` не полагаться при аварии.** OOM или `SIGKILL` не вызовут ничего, поэтому повторная обработка после рестарта должна быть безопасной.

## Когда брать Hangfire или Quartz

Самописный `BackgroundService` хорош, пока задач мало. Как только нужны cron-выражения, персистентность, повторы с backoff, «один запуск на кластер» и дашборд, писать это руками — значит переизобретать планировщик. Quartz.NET — расписания, cron и кластерный режим с хранилищем в БД, `[DisallowConcurrentExecution]` против перекрытия. Hangfire — персистентные fire-and-forget, отложенные и recurring-задачи с повторами и дашбордом. Kubernetes `CronJob` с `concurrencyPolicy: Forbid` — когда задачу проще запускать отдельным процессом, чем держать в веб-приложении.

## Что стоит ответить на собеседовании

`IHostedService` — контракт из `StartAsync` и `StopAsync`, которые хост вызывает при запуске по порядку регистрации и при остановке в обратном порядке; `StartAsync` блокирует старт, поэтому в нём делают обязательную инициализацию. `BackgroundService` реализует его для долгой работы: запускает `ExecuteAsync` в фоне и отменяет `stoppingToken` при остановке. Оба — singleton, поэтому `DbContext` берут через `IServiceScopeFactory`, скоуп на итерацию. Периодические задачи пишут на `PeriodicTimer`, работу из запросов передают через bounded `Channel<T>`.

Сильный ответ добавит, что с .NET 6 исключение в `ExecuteAsync` по умолчанию останавливает весь хост, поэтому ошибки ловят на уровне итерации; объяснит, почему `PeriodicTimer` не даёт перекрытий, а `System.Threading.Timer` даёт, и что между репликами нужна распределённая блокировка плюс идемпотентность. Назовёт ограничения in-memory очереди, бюджет `ShutdownTimeout` при остановке и момент, когда самописный worker пора заменить на Quartz.NET, Hangfire или внешний брокер.
