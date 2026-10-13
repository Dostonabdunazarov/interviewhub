# Задачи: ASP.NET Core

## Порядок middleware

```yaml
slug: aspnet-core-poryadok-middleware
category: aspnet-core
level: junior
kind: output
difficulty: 2
```

Что появится в консоли после одного запроса `GET /`? Логирование отключено.

```csharp
var app = WebApplication.Create();

app.Use(async (ctx, next) =>
{
    Console.Write("A ");
    await next();
    Console.Write("B");
});
app.Run(async ctx =>
{
    Console.Write("C ");
    await ctx.Response.WriteAsync("ok");
});
app.Use(async (ctx, next) =>
{
    Console.Write("D ");
    await next();
});

app.Run();
```

### Варианты

- [ ] `A C D B`
- [ ] `A D C B`
- [x] `A C B`
- [ ] `A B C`

### Разбор

Конвейер middleware строится в порядке регистрации, и каждый компонент сам решает, вызывать ли следующий. `Use` получает `next` и оборачивает остаток конвейера: код до `await next()` выполняется на пути запроса «внутрь», код после — на обратном пути, когда ответ уже сформирован. Поэтому `B` печатается последним, после `C`.

`app.Run(...)` регистрирует **терминальный** middleware: у него нет `next`, он завершает конвейер. Всё, что зарегистрировано после него, никогда не получит управление, поэтому `D` не выводится. Ошибки компиляции или исключения при этом нет — такой код просто молча не работает.

Именно поэтому порядок `UseRouting`, `UseAuthentication`, `UseAuthorization`, `UseExceptionHandler` и т. п. важен: обработчик исключений должен стоять первым, чтобы обернуть всё остальное, аутентификация — перед авторизацией, а CORS — до компонентов, которые могут завершить запрос. И нельзя менять статус-код и заголовки после `await next()`, если ответ уже начал отправляться клиенту, — это приведёт к исключению; для таких правок есть `ctx.Response.OnStarting(...)`.

## Кэш прайс-листа

```yaml
slug: aspnet-core-captive-dependency
category: aspnet-core
level: middle
kind: bug
difficulty: 3
```

В чём проблема этого кода?

```csharp
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connectionString));
builder.Services.AddSingleton<PriceCache>();

public class PriceCache(AppDbContext db)
{
    private Dictionary<int, decimal>? _prices;

    public async Task<decimal> GetPriceAsync(int productId)
    {
        _prices ??= await db.Products.ToDictionaryAsync(p => p.Id, p => p.Price);
        return _prices[productId];
    }
}
```

### Варианты

- [ ] `AddDbContext` регистрирует контекст как transient, и каждый вызов `GetPriceAsync` получит новый экземпляр
- [x] Singleton захватывает scoped `AppDbContext`: один контекст живёт всё время работы приложения и используется из параллельных запросов (в Development приложение упадёт ещё при `Build()`)
- [ ] Primary constructor нельзя использовать для внедрения зависимостей в сервисы, зарегистрированные как singleton
- [ ] `ToDictionaryAsync` загружает данные с трекингом, и цены окажутся устаревшими — это единственная проблема

### Разбор

Это captive dependency: сервис с более длинным временем жизни удерживает зависимость с более коротким. Singleton создаётся один раз из корневого контейнера, и `AppDbContext`, полученный в конструкторе, становится фактически singleton — со всеми вытекающими: `DbContext` не потокобезопасен, параллельные запросы получат `InvalidOperationException` о второй операции на том же контексте, change tracker будет только расти. С любой другой scoped-зависимостью (текущий пользователь, единица работы, транзакция) получится то же самое: в singleton навсегда «застрянет» экземпляр, созданный для первого запроса.

В окружении Development `WebApplicationBuilder` включает `ValidateScopes` и `ValidateOnBuild`, и `builder.Build()` бросит `AggregateException` с сообщением `Cannot consume scoped service 'AppDbContext' from singleton 'PriceCache'`. В Production эти проверки по умолчанию выключены, и ошибка проявится только под нагрузкой — поэтому полезно включать `ValidateOnBuild` явно и для остальных окружений.

Исправления: внедрять `IDbContextFactory<AppDbContext>` и создавать контекст на время загрузки (`await using var db = await factory.CreateDbContextAsync()`), либо `IServiceScopeFactory` и отдельный scope. Сам кэш при этом тоже стоит сделать потокобезопасным — здесь две параллельные первые загрузки выполнятся обе.

## Прокси к погодному API

```yaml
slug: aspnet-core-new-httpclient-na-zapros
category: aspnet-core
level: middle
kind: bug
difficulty: 3
```

В чём проблема этого кода?

```csharp
app.MapGet("/weather/{city}", async (string city) =>
{
    using var http = new HttpClient();
    http.Timeout = TimeSpan.FromSeconds(5);
    var json = await http.GetStringAsync($"https://api.weather.example/v1/{city}");
    return Results.Content(json, "application/json");
});
```

### Варианты

- [ ] `using` закроет клиент до того, как придёт ответ, и запрос оборвётся
- [ ] `HttpClient` не потокобезопасен, поэтому его обязательно нужно создавать на каждый запрос — код правильный
- [x] Новый `HttpClient` с собственным пулом соединений на каждый запрос: соединения не переиспользуются, под нагрузкой накапливаются сокеты в `TIME_WAIT` и возможно исчерпание портов
- [ ] `Timeout` нельзя менять у созданного клиента — будет `InvalidOperationException`

### Разбор

Каждый `new HttpClient()` создаёт свой `SocketsHttpHandler` со своим пулом соединений. После `Dispose` соединение закрывается, но сокет на стороне клиента ещё какое-то время висит в состоянии `TIME_WAIT`. При сотнях запросов в секунду эфемерные порты заканчиваются, и новые запросы начинают падать с `SocketException`, хотя удалённый сервис здоров. Плюс на каждый запрос заново выполняются DNS-резолв, TCP- и TLS-рукопожатия — лишние десятки миллисекунд задержки.

Обратная крайность — один статический `HttpClient` на всё приложение — решает проблему сокетов, но долгоживущие соединения не замечают смены DNS-записей. Её закрывают настройкой `PooledConnectionLifetime` у `SocketsHttpHandler`.

Идиоматичный вариант в ASP.NET Core — `IHttpClientFactory`: `builder.Services.AddHttpClient<WeatherClient>(c => { c.BaseAddress = ...; c.Timeout = ...; })`. Фабрика переиспользует и периодически ротирует обработчики, а заодно даёт место для Polly/resilience-политик и логирования. Сам `HttpClient` для отправки запросов потокобезопасен, поэтому его не нужно создавать заново на каждый запрос.
