---
title: Rate limiting
slug: aspnet-rate-limiting
track: dotnet-backend
section: aspnet-core
level: middle
sortOrder: 12
summary: Зачем ограничивать частоту запросов, как устроен встроенный middleware ASP.NET Core и его алгоритмы, какую стратегию выбрать для публичного API и как держать общий лимит на нескольких инстансах.
questions: aspnet-core-chto-takoe-rate-limiting, advanced-aspnet-chem-otlichayutsya-strategii-rate-limiting-i-kakuyu-vybrat-dlya-public, advanced-aspnet-kak-realizovat-rate-limiting-rabotayuschii-na-neskolkih-instansah-odno
---

Rate limiting — ограничение числа запросов, которые клиент или все клиенты вместе могут сделать за единицу времени. Лишние запросы сервер отклоняет кодом `429 Too Many Requests` или ненадолго ставит в очередь. Задач у него несколько, и они тянут в разные стороны: защитить сервис и базу от всплеска или клиента с зациклившимися ретраями, честно поделить ресурсы между тенантами, замедлить перебор паролей и OTP-кодов, реализовать тарифы публичного API, уберечь дорогую зависимость со своей квотой.

От того, какая задача главная, зависят три решения: **по чему считать** (ключ партиции), **каким алгоритмом** и **что делать с лишним** — отказать сразу или подождать.

## Встроенный middleware

С .NET 7 в ASP.NET Core есть пакет `Microsoft.AspNetCore.RateLimiting`, построенный на абстракциях `System.Threading.RateLimiting`. Политики регистрируются в `AddRateLimiter`, middleware подключается `UseRateLimiter`, а политика привязывается к endpoint'у:

```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddFixedWindowLimiter("login", w =>
    {
        w.PermitLimit = 5;
        w.Window = TimeSpan.FromMinutes(1);
        w.QueueLimit = 0;
    });
});

var app = builder.Build();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapPost("/login", Login).RequireRateLimiting("login");
app.MapGet("/health", () => "ok").DisableRateLimiting();
```

Для контроллеров то же самое делают атрибуты `[EnableRateLimiting("login")]` и `[DisableRateLimiting]`. Политики на endpoint'ах читаются из метаданных, поэтому `UseRateLimiter` должен стоять после `UseRouting`, а если ключ — пользователь, то и после аутентификации, иначе все запросы окажутся анонимными. Подробнее о порядке — в статье `Pipeline и middleware`.

Первая ловушка: `RejectionStatusCode` по умолчанию — `503`, а не `429`. Клиент и балансировщик воспримут это как «сервис лёг», а не «ты превысил лимит», и поведение ретраев будет неправильным. Код выставляют явно.

## Четыре алгоритма

У встроенного middleware есть регистрации `AddFixedWindowLimiter`, `AddSlidingWindowLimiter`, `AddTokenBucketLimiter` и `AddConcurrencyLimiter`. Им соответствуют лимитеры `FixedWindowRateLimiter`, `SlidingWindowRateLimiter`, `TokenBucketRateLimiter` и `ConcurrencyLimiter`.

**Fixed window.** Счётчик на окно, сброс на границе. Самый дешёвый, но пропускает двойной всплеск: при лимите 100 в минуту клиент делает 100 запросов в 12:00:59 и ещё 100 в 12:01:00 — 200 за две секунды.

**Sliding window.** Окно разбито на сегменты (`SegmentsPerWindow`), и при сдвиге уходят разрешения только самого старого сегмента. Граница сглаживается, точность растёт с числом сегментов. Хранить метку каждого запроса, как в sliding window log, не нужно.

**Token bucket.** Ведро на `TokenLimit` токенов, каждые `ReplenishmentPeriod` добавляется `TokensPerPeriod`. Средняя скорость задаётся пополнением, допустимый всплеск — размером ведра. Leaky bucket с ровным потоком на бэкенд — это по сути тот же token bucket с очередью.

**Concurrency.** Ограничивает не частоту, а число одновременно выполняющихся запросов: разрешение возвращается, когда запрос закончился. Защищает от медленных тяжёлых операций, но не от потока дешёвых.

| Алгоритм | Сильная сторона | Слабость |
| --- | --- | --- |
| Fixed window | один счётчик | до 2× лимита на стыке окон |
| Sliding window | сглаженная граница | приближение, больше состояния |
| Token bucket | контролируемый всплеск при заданной средней скорости | два параметра вместо одного |
| Concurrency | защита от тяжёлых запросов | не ограничивает частоту |

## Очередь

У всех лимитеров есть `QueueLimit` и `QueueProcessingOrder`. При `QueueLimit > 0` запрос сверх лимита не отклоняется, а ждёт освобождения разрешения, удерживая соединение. Для внутреннего клиента или фоновой обработки это сглаживает пики. Для публичного API обычно ставят ноль: держать соединение дороже, чем ответить `429`, а клиент сам решит, когда повторить.

## Партиционирование

Один лимитер на всех защищает сервис, но не даёт справедливости: один шумный клиент выедает лимит у остальных. Для лимита «на клиента» используют `PartitionedRateLimiter` — лимитер, который по ключу создаёт и хранит отдельный экземпляр для каждой партиции:

```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    o.AddPolicy("public-api", ctx =>
    {
        var key = ctx.Request.Headers["X-Api-Key"].ToString();
        var plan = ctx.RequestServices.GetRequiredService<IPlanResolver>().Resolve(key);
        return RateLimitPartition.GetTokenBucketLimiter($"{key}:{plan.Name}", _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = plan.Burst,
            TokensPerPeriod = plan.PerSecond,
            ReplenishmentPeriod = TimeSpan.FromSeconds(1),
            QueueLimit = 0
        });
    });

    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(_ =>
        RateLimitPartition.GetConcurrencyLimiter("global", _ => new ConcurrencyLimiterOptions
        {
            PermitLimit = 2_000,
            QueueLimit = 0
        }));
});
```

`GlobalLimiter` применяется ко всем запросам до политики endpoint'а. Здесь их две, и они решают разные задачи: token bucket по API-ключу — тарифный контракт, глобальный concurrency limiter — предохранитель процесса.

Фабрика партиции вызывается только при создании лимитера для нового ключа. Если тариф клиента сменился, а ключ тот же, старые параметры продолжат действовать, пока простаивающий лимитер не будет вытеснен. Поэтому план включён в ключ.

Выбор ключа важнее выбора алгоритма. Для публичного API — API-ключ, клиент или тенант. IP подходит только для грубой защиты анонимных endpoint'ов вроде логина: за одним NAT сидит целый офис, а атакующий меняет адреса. За балансировщиком `Connection.RemoteIpAddress` без `UseForwardedHeaders` — адрес балансировщика, и все клиенты попадают в одну партицию.

## Ответ клиенту и Retry-After

`429` — это контракт, а не только защита. Клиенту нужно знать, когда повторять, иначе немедленные ретраи сами станут нагрузкой — о правильном поведении клиента в статье `Retry, jitter и retry storm`. Заголовок выставляют в `OnRejected`, достав подсказку из lease:

```csharp
o.OnRejected = (context, ct) =>
{
    if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
    {
        context.HttpContext.Response.Headers.RetryAfter =
            ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
    }
    return ValueTask.CompletedTask;
};
```

Оконные лимитеры и token bucket знают, когда освободится разрешение, а concurrency limiter — нет: время окончания чужих запросов неизвестно. Сверх `Retry-After` публичные API отдают остаток квоты: де-факто `X-RateLimit-Limit`/`Remaining`/`Reset` или `RateLimit-Policy`/`RateLimit` из черновика IETF. Встроенный middleware их не пишет — это делают сами.

## Какую стратегию выбрать для публичного API

Реальные клиенты шлют трафик пачками: открыли страницу — десять запросов за 100 мс, потом тишина. Fixed window с лимитом «10 в секунду» то отклоняет нормальное поведение, то пропускает 20 запросов на стыке. Token bucket формулирует контракт честно — «в среднем 10 в секунду, всплеск до 50», — и соблюдать его легко. Отсюда типовой выбор:

- **token bucket (или GCRA) по API-ключу**, параметры — из тарифа;
- **отдельная, более строгая политика** для дорогих операций: поиск, экспорт, запись;
- **несколько горизонтов**: секундный bucket против всплесков плюс суточная или месячная квота, которую считают в хранилище, а не в памяти;
- **concurrency limiter** как глобальный предохранитель;
- **без очереди**, с `429` и `Retry-After`.

## Ограничение: лимит на инстанс

Встроенные лимитеры хранят состояние в памяти процесса. При четырёх репликах лимит «100 в минуту» на деле становится 400, а при автоскейлинге плавает. Для предохранителя это приемлемо, для оплаченной квоты — нет. Варианты общего лимита:

**Redis как общий счётчик.** Каждое решение — атомарная операция. `GET` и `INCR` отдельными командами из приложения дают гонку между инстансами, поэтому логику выполняют Lua-скриптом целиком на сервере:

```lua
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
if current > tonumber(ARGV[2]) then
  return {0, redis.call('PTTL', KEYS[1])}
end
return {1, 0}
```

Это fixed window. Скользящее окно делают на sorted set (`ZADD` с меткой, `ZREMRANGEBYSCORE`, `ZCARD`), token bucket — на хэше с числом токенов и временем пополнения. Компактный вариант — GCRA: на ключ хранится одно значение, «теоретическое время следующего разрешённого запроса». Время берут из Redis (`TIME` в скрипте), а не с инстансов, чьи часы расходятся. В ASP.NET Core это подключают своей реализацией `RateLimiter` или `PartitionedRateLimiter<HttpContext>` через `AddPolicy`/`GlobalLimiter`; есть community-пакеты поверх тех же абстракций. Цена — лишний round-trip на каждый запрос и критическая зависимость с горячими ключами крупных клиентов.

**Гибрид.** Инстанс берёт у Redis пачку токенов, например 50, и раздаёт их локально. Походов в Redis на порядок меньше, погрешность — размер пачки на число инстансов.

**Gateway или ingress.** nginx, Envoy с global rate limit service, Kong, облачные API Gateway, YARP со встроенным middleware. Трафик отсекается дешевле всего и до приложения, но гейтвей не знает бизнес-контекста, а у него самого несколько реплик — нужна своя общая точка подсчёта.

**Доля от общего.** Каждый из N инстансов пропускает `лимит / N`. Просто, но зависит от равномерности балансировки и знания N. Годится как предохранитель, не как тарифный лимит.

## Когда Redis недоступен

Это решение надо принять заранее. **Fail-open** с откатом на локальный лимитер: сервис работает, лимит становится грубее — обычный выбор для защиты от злоупотреблений. **Fail-closed** — для платного API с жёсткими квотами, где перерасход недопустим. В обоих случаях на обращение к Redis нужен короткий таймаут, а при серии отказов — разрыв цепи по схеме из статьи `Circuit breaker`, иначе лимитер сам становится источником латентности. Метрики отказов разделяют по причинам — «клиент превысил» против «хранилище не ответило»; с .NET 8 middleware публикует собственные метрики в `System.Diagnostics.Metrics`, о сборе — в `OpenTelemetry в .NET`.

## Что стоит ответить на собеседовании

Rate limiting ограничивает число запросов клиента за интервал и отвечает `429` с `Retry-After`. В ASP.NET Core с .NET 7 есть middleware: `AddRateLimiter` с политиками fixed window, sliding window, token bucket и concurrency, `UseRateLimiter` после routing и аутентификации, `RequireRateLimiting` или `[EnableRateLimiting]` на endpoint'ах, `PartitionedRateLimiter` для лимита на пользователя или ключ. Код отказа по умолчанию — `503`, его меняют на `429`.

Сильный ответ объяснит разницу алгоритмов на всплесках — двойной всплеск fixed window, контролируемый всплеск token bucket, «частота против параллельности» у concurrency — и обоснует выбор для публичного API: token bucket по API-ключу без очереди плюс глобальный concurrency-предохранитель. Назовёт главное ограничение — счётчики in-memory на инстанс, — и как его снять: атомарный Lua-скрипт в Redis (окно, sliding log, GCRA), лимит на гейтвее или гибрид с арендой токенов, с осознанным fail-open или fail-closed и коротким таймаутом при недоступности Redis.
