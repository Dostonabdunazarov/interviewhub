---
title: CORS и CSRF
slug: aspnet-cors-i-csrf
track: dotnet-backend
section: aspnet-core
level: middle
sortOrder: 11
summary: Как браузер ограничивает кросс-доменные запросы и как CORS ослабляет эти ограничения, почему CORS не защищает сервер, чем опасна cookie-аутентификация и как от CSRF защищают SameSite и antiforgery-токены в ASP.NET Core.
questions: aspnet-core-chto-takoe-cors, aspnet-core-kak-rabotaet-cors, aspnet-core-chto-takoe-csrf
---

CORS и CSRF постоянно путают, потому что оба про «чужой сайт и наш API». Но решают они противоположные задачи. CORS — механизм, которым сервер **разрешает** браузеру отдать скрипту с другого origin ответ. CSRF — атака, при которой чужой сайт заставляет браузер жертвы выполнить действие на нашем сервере, и ответ атакующему вообще не нужен.

Оба механизма существуют только в браузере: `curl`, Postman и серверный `HttpClient` не знают ни про same-origin policy, ни про cookies жертвы.

## Same-origin policy и origin

Origin — тройка «схема + хост + порт». `https://a.com` и `https://a.com:8443` — разные origin, `http://a.com` и `https://a.com` — тоже. Путь роли не играет.

Same-origin policy запрещает скрипту читать ответы с чужого origin. Запрос из `fetch` на `https://app.example.com` к `https://api.example.com` браузер, как правило, **отправит**, но ответ скрипту не отдаст. Важно, что запрещено именно чтение: отправлять формы, грузить картинки и скрипты с чужих доменов браузер позволяет всегда, на этом построен веб. Именно эта асимметрия делает возможным CSRF.

Рядом стоит понятие site — схема плюс регистрируемый домен (eTLD+1). `app.example.com` и `api.example.com` — разные origin, но один site. Для CORS важен origin, для `SameSite`-cookies — site.

## Как работает CORS

Браузер добавляет к кросс-доменному запросу заголовок `Origin`, сервер отвечает заголовками `Access-Control-*`. Если нужных заголовков нет или они не совпадают с запросом, браузер блокирует доступ скрипта к ответу. Запросы при этом делятся на два вида.

**Простой запрос** — метод `GET`, `HEAD` или `POST`, только «безопасные» заголовки, а `Content-Type` — один из `text/plain`, `multipart/form-data`, `application/x-www-form-urlencoded`. Браузер отправляет его сразу и проверяет `Access-Control-Allow-Origin` уже в ответе. То есть запрос до сервера дошёл и, если он что-то менял, изменение произошло.

**Preflight** нужен для всего остального: `PUT`, `DELETE`, `PATCH`, `Content-Type: application/json`, заголовок `Authorization` или любой кастомный. Сначала браузер спрашивает разрешения запросом `OPTIONS`:

```http
OPTIONS /orders/42 HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: DELETE
Access-Control-Request-Headers: authorization

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: DELETE
Access-Control-Allow-Headers: authorization
Access-Control-Max-Age: 600
```

Только после успешного preflight уйдёт настоящий `DELETE`, и в его ответе тоже должен быть `Access-Control-Allow-Origin`.

| Заголовок ответа | Смысл |
| --- | --- |
| `Access-Control-Allow-Origin` | разрешённый origin или `*` |
| `Access-Control-Allow-Credentials: true` | можно отправлять cookies и читать ответ |
| `Access-Control-Allow-Methods`, `-Headers` | что разрешено в основном запросе |
| `Access-Control-Expose-Headers` | какие заголовки ответа видны скрипту; `Location` или `X-Total-Count` без этого скрыты |
| `Access-Control-Max-Age` | сколько секунд кэшировать результат preflight |

Preflight на каждый запрос удваивает число round-trip'ов. `Max-Age` помогает, но браузеры ограничивают его сверху: у Chromium — два часа.

## Credentials и запрет `*`

По умолчанию кросс-доменный `fetch` не отправляет cookies. Чтобы отправил, клиент указывает `credentials: 'include'`, а сервер отвечает `Access-Control-Allow-Credentials: true` и **конкретным** origin. Спецификация запрещает сочетать credentials с `Access-Control-Allow-Origin: *`: браузер такой ответ отвергнет.

ASP.NET Core ловит это ещё раньше — при построении политики `AllowAnyOrigin()` вместе с `AllowCredentials()` выбрасывает `InvalidOperationException`. Обходить запрет через `SetIsOriginAllowed(_ => true)`, который зеркалирует любой пришедший `Origin`, — фактически отключить same-origin policy для залогиненных пользователей: любой сайт сможет делать запросы от их имени и **читать** ответы, включая персональные данные.

## Настройка в ASP.NET Core

Политики регистрируются в DI, применяет их `CorsMiddleware`:

```csharp
builder.Services.AddCors(o =>
{
    o.AddPolicy("Spa", p => p
        .WithOrigins("https://app.example.com")
        .WithMethods("GET", "POST", "DELETE")
        .WithHeaders("Content-Type", "Authorization")
        .AllowCredentials()
        .WithExposedHeaders("Location")
        .SetPreflightMaxAge(TimeSpan.FromMinutes(10)));

    o.AddPolicy("Public", p => p.AllowAnyOrigin().WithMethods("GET"));
});

var app = builder.Build();

app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/orders/{id}", GetOrder).RequireCors("Spa");
app.MapGet("/rates", GetRates).RequireCors("Public");
app.MapControllers();
```

Здесь `UseCors()` без имени: политика берётся из метаданных endpoint'а — `RequireCors` в Minimal API или `[EnableCors("Spa")]` на контроллере и action. `[DisableCors]` снимает CORS с конкретного action. Вариант `UseCors("Spa")` применяет одну политику ко всему конвейеру, `AddDefaultPolicy` задаёт политику для `UseCors()` без имени и без метаданных.

Место в конвейере принципиально, подробно оно разобрано в статье `Pipeline и middleware`. `UseCors` идёт после `UseRouting` — иначе он не видит метаданных endpoint'а, — и до `UseAuthentication` и `UseAuthorization`. Preflight браузер шлёт без токена и без cookies; если авторизация стоит раньше, `OPTIONS` получит `401`, а в консоли браузера будет «CORS error», хотя политика настроена верно.

Что делает middleware на запросе:

- на preflight отвечает сам и замыкает конвейер, до обработчика запрос не доходит;
- на обычный запрос дописывает `Access-Control-*` к ответу обработчика;
- если origin не разрешён, просто **не добавляет** заголовки — сервер возвращает нормальный ответ, блокирует его браузер;
- добавляет `Vary: Origin`, чтобы CDN и прокси не отдали закэшированный ответ с одним `Allow-Origin` клиенту с другого сайта.

Ловушка диагностики: ответ `500` или `404` без CORS-заголовков браузер показывает как блокировку CORS. Настоящую ошибку видно во вкладке Network или в логах.

## CORS не защищает сервер

Главное, что проверяют на собеседовании. CORS **ослабляет** same-origin policy, а не усиливает её: настраивая CORS, вы открываете доступ, а не закрываете. Отсюда следствия:

- простой запрос с запрещённого origin всё равно доходит до сервера и выполняется, браузер лишь прячет ответ;
- любой небраузерный клиент CORS игнорирует, поэтому CORS — не аутентификация, не авторизация и не защита от ботов;
- `Origin` подделывается вне браузера одной строкой, принимать по нему решения о доступе нельзя.

Если фронт и API живут за одним reverse proxy на одном origin, CORS не нужен вовсе — это самый простой и надёжный вариант.

## CSRF: почему уязвимы cookies

Cookie-аутентификация держится на том, что браузер сам прикладывает cookies к каждому запросу на домен — независимо от того, какая страница его инициировала. Пользователь залогинен в банке и открывает `evil.com`:

```html
<form action="https://bank.example.com/transfer" method="post">
  <input name="to" value="attacker"><input name="amount" value="1000">
</form>
<script>document.forms[0].submit()</script>
```

Отправка формы — простой запрос, preflight нет, CORS ему не помеха. Браузер приложит сессионную cookie, сервер увидит валидного пользователя и выполнит перевод. Ответ атакующий не прочитает, но ему и не нужно — достаточно побочного эффекта. Уязвимо всё, что браузер отправляет автоматически: cookies, Basic и Windows-аутентификация, клиентские сертификаты.

## SameSite

Атрибут `SameSite` управляет тем, отправлять ли cookie на кросс-сайтовые запросы:

| Значение | Поведение |
| --- | --- |
| `Strict` | не отправляется ни на какие кросс-сайтовые запросы, даже на переход по ссылке |
| `Lax` | отправляется только при навигации верхнего уровня безопасным методом; кросс-сайтовый `POST` идёт без cookie |
| `None` | отправляется всегда, требует `Secure` |

Chromium-браузеры трактуют cookie без атрибута как `Lax`, а cookie-аутентификация ASP.NET Core выставляет `SameSite=Lax` явно. Это закрывает классическую атаку формой, но полной защитой не является: `SameSite` работает на уровне site, а не origin, поэтому скомпрометированный поддомен `promo.example.com` атакует `app.example.com` как «свой». Кроме того, `Lax` пропускает `GET`, поэтому изменяющие действия через `GET` остаются уязвимы — их не делают никогда.

## Antiforgery-токены

Основная защита в ASP.NET Core — synchronizer token. Сервер выдаёт секрет в cookie и ещё раз — в форму или заголовок; на небезопасных методах проверяет, что пара совпадает и принадлежит текущему пользователю. Чужой сайт не может прочитать значение со страницы и подставить его в запрос.

В MVC и Razor Pages tag helper `<form method="post">` сам добавляет скрытое поле `__RequestVerificationToken`. Проверку включают атрибутом `[ValidateAntiForgeryToken]` на action или глобально:

```csharp
builder.Services.AddControllersWithViews(o =>
    o.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()));
```

`AutoValidateAntiforgeryToken` проверяет только небезопасные методы и не трогает `GET`, `HEAD`, `OPTIONS`, `TRACE`; исключения помечают `[IgnoreAntiforgeryToken]`. Razor Pages проверяют токен по умолчанию.

В Minimal API поддержка появилась в .NET 8:

```csharp
builder.Services.AddAntiforgery();

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();

app.MapPost("/profile", ([FromForm] ProfileForm form) => Results.Ok());
app.MapPost("/upload", (IFormFile file) => Results.Ok()).DisableAntiforgery();
```

Endpoint'ы, которые принимают данные формы — `[FromForm]` или `IFormFile`, — проверяются автоматически; без валидного токена запрос получит `400`. JSON-эндпоинты под эту проверку не попадают. `UseAntiforgery` ставят после аутентификации и авторизации, потому что токен привязан к пользователю. `DisableAntiforgery()` — осознанное исключение, а не способ «починить 400».

Для SPA с cookie-аутентификацией токен выдают через `IAntiforgery`, а клиент возвращает его в заголовке:

```csharp
builder.Services.AddAntiforgery(o => o.HeaderName = "X-XSRF-TOKEN");

app.MapGet("/antiforgery/token", (IAntiforgery af, HttpContext ctx) =>
{
    var tokens = af.GetAndStoreTokens(ctx);
    return Results.Ok(new { token = tokens.RequestToken });
});
```

Для произвольного endpoint'а проверку вызывают явно: `IAntiforgery.ValidateRequestAsync` или `IsRequestValidAsync`. Дополнительный слой — проверка `Origin` или `Referer` на изменяющих запросах.

## Bearer-токены и связь с CORS

API с `Authorization: Bearer ...` CSRF не подвержен. Браузер не прикладывает такой заголовок сам, чужой сайт не может прочитать токен из памяти или `localStorage` вашего приложения, а выставить `Authorization` в кросс-доменном запросе можно только через preflight, который политика CORS не пропустит. Поэтому SPA с JWT в заголовке antiforgery обычно не включают. Цена — другой риск: токен, доступный JavaScript, крадётся через XSS. Подробнее о токенах — в статье `Аутентификация и JWT`.

Отсюда и ответ на частый вопрос «защищает ли CORS от CSRF». Нет: CORS регулирует чтение ответов, а CSRF эксплуатирует побочный эффект запроса, который CORS пропускает. Связь между ними косвенная. Preflight срабатывает на `application/json`, поэтому JSON-API, который **строго** требует этот `Content-Type`, форма с чужого сайта вызвать не может. Но если сервер принимает тот же JSON как `text/plain` или форму, preflight не нужен и защита исчезает. Контроллеры с `[ApiController]` и `[FromBody]` отвечают `415` на неподдерживаемый `Content-Type` — это помогает, но защитой от CSRF не считается. И наоборот, разрешающая CORS-политика с credentials и зеркалированием origin превращает CSRF в нечто худшее: атакующий не только совершает действие, но и читает ответ.

## Что стоит ответить на собеседовании

Origin — схема, хост и порт; same-origin policy запрещает скрипту читать ответы с чужого origin, а CORS — способ сервера ослабить этот запрет заголовками `Access-Control-*`. Простые запросы браузер отправляет сразу и проверяет ответ, остальные предваряет preflight `OPTIONS`. В ASP.NET Core политики регистрируются через `AddCors`, применяются `UseCors` после `UseRouting` и до аутентификации, точечно — через `RequireCors` или `[EnableCors]`; `AllowAnyOrigin` с `AllowCredentials` запрещён. CSRF — атака, при которой чужая страница заставляет браузер отправить запрос с cookies жертвы; защищают `SameSite`, antiforgery-токены (`[ValidateAntiForgeryToken]`, `AutoValidateAntiforgeryTokenAttribute`, в Minimal API с .NET 8 — `AddAntiforgery` и `UseAntiforgery`) и запрет изменяющих `GET`.

Сильный ответ подчеркнёт, что CORS реализует браузер и он не защищает сервер: простой запрос с запрещённого origin всё равно выполняется, а `curl` CORS игнорирует. Объяснит, почему CORS не спасает от CSRF — он про чтение ответа, а не про отправку, — и почему Bearer-токен в заголовке CSRF не подвержен, но открывает риск XSS. Назовёт тонкости: `SameSite` работает по site, а не по origin, и не защищает от атак с поддоменов; `UseCors` после авторизации ломает preflight с `401`; зеркалирование `Origin` вместе с credentials равносильно отключению same-origin policy.
