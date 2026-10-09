---
title: Аутентификация и JWT
slug: aspnet-autentifikaciya-i-jwt
track: dotnet-backend
section: aspnet-core
level: middle
sortOrder: 6
summary: Чем аутентификация отличается от авторизации, как JwtBearer проверяет токен и когда на самом деле появляется 401, что такое claims и политики и какие ошибки с JWT делают чаще всего.
---

Аутентификация отвечает на вопрос «кто ты», авторизация — «что тебе можно». В ASP.NET Core это два разных middleware с разными результатами, и большая часть путаницы вокруг JWT — от того, что их считают одним шагом. Невалидный токен сам по себе не даёт 401, а валидный токен сам по себе ничего не разрешает.

## Два шага

| | Аутентификация | Авторизация |
| --- | --- | --- |
| Вопрос | кто это? | можно ли ему? |
| Результат | `ClaimsPrincipal` в `HttpContext.User` | разрешить или запретить |
| Middleware | `UseAuthentication` | `UseAuthorization` |
| Ошибка | `401` — личность не установлена | `403` — личность известна, прав нет |
| Настройка | схемы: JWT Bearer, cookies, OpenID Connect | `[Authorize]`, роли, политики |

Код `401 Unauthorized` назван исторически неудачно — по смыслу это «не аутентифицирован». Для «доступ запрещён» есть `403 Forbidden`.

Как они работают вместе:

1. `UseAuthentication` вызывает схему по умолчанию. Та ищет токен или cookie, проверяет и заполняет `HttpContext.User`. Если данных нет или они невалидны, пользователь просто **анонимный**, и запрос идёт дальше.
2. `UseAuthorization` читает метаданные выбранного endpoint'а — `[Authorize]`, `RequireAuthorization` — и проверяет политику для `HttpContext.User`. Поэтому он стоит после `UseRouting`, о чём шла речь в статье `Pipeline и middleware`.
3. Если пользователь анонимный, вызывается **challenge** схемы: у JWT это 401 с заголовком `WWW-Authenticate`, у cookies — редирект на страницу входа. Если пользователь известен, но политику не прошёл, — **forbid**, то есть 403.

## Когда на самом деле появляется 401

Проверено на .NET 10, JwtBearer, две конечные точки — открытая и с `RequireAuthorization()`:

```
открытая,  Authorization: Bearer garbage → 200, IsAuthenticated = False
закрытая,  без заголовка                  → 401, WWW-Authenticate: Bearer
закрытая,  Bearer garbage                 → 401, WWW-Authenticate: Bearer error="invalid_token"
закрытая,  валидный токен без роли "boss", политика RequireRole("boss") → 403
```

Мусорный токен на открытом endpoint'е не вызвал ошибки: аутентификация пометила результат как неудачный, пользователь стал анонимным, а авторизации на этом endpoint'е нет. 401 возникает только тогда, когда авторизация видит, что endpoint требует аутентификации.

Отсюда важное следствие: **аутентификация сама ничего не запрещает**. Endpoint без `[Authorize]` открыт всем. Закрыть всё по умолчанию и открывать точечно позволяет `FallbackPolicy`:

```csharp
builder.Services.AddAuthorization(o =>
    o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
```

Она применяется к endpoint'ам без каких-либо атрибутов авторизации, а исключения помечаются `[AllowAnonymous]` или `AllowAnonymous()`.

## Как устроен JWT

JWT — три части в Base64Url через точку: `header.payload.signature`.

```json
{ "alg": "RS256", "typ": "JWT", "kid": "2026-key-1" }
{
  "iss": "https://login.example.com",
  "aud": "orders-api",
  "sub": "user-42",
  "exp": 1790000000,
  "role": "admin"
}
```

Подпись считается от header и payload ключом издателя. Payload **не зашифрован** — его прочитает любой, кто получил токен. JWT защищён от подделки, но не от чтения, поэтому секретам и персональным данным в нём не место.

Поток выглядит так: клиент аутентифицируется у identity provider — своего endpoint'а логина, Keycloak, Entra ID — и получает access token. Дальше он отправляет его в каждом запросе в заголовке `Authorization: Bearer eyJ...`, а API проверяет токен **сам, без похода к издателю**.

## Что проверяет JwtBearer

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.Authority = "https://login.example.com";
        o.Audience = "orders-api";
        o.TokenValidationParameters.ClockSkew = TimeSpan.FromSeconds(30);
    });
```

Обработчик `JwtBearerHandler` по шагам:

1. **Извлекает токен** из заголовка `Authorization`. Нет заголовка — результат `NoResult`, пользователь анонимный.
2. **Проверяет подпись.** Ключ выбирается по `kid` из заголовка токена. При заданном `Authority` ключи загружаются из `/.well-known/openid-configuration` и `jwks_uri` и кэшируются с периодическим обновлением — так издатель может ротировать ключи без перенастройки API.
3. **Проверяет claims:** `iss` — ожидаемый издатель, `aud` — ваш API, `exp` не истёк, `nbf` наступил.
4. **Создаёт `ClaimsPrincipal`** и вызывает событие `OnTokenValidated`, где можно добавить свои проверки.

Срок действия проверяется с допуском `ClockSkew`, и по умолчанию он **5 минут**. Проверено на .NET 10:

```
токен истёк 100 секунд назад → 200
токен истёк 400 секунд назад → 401, error_description="The token expired at '...'"
```

Токен, истёкший полторы минуты назад, всё ещё принимается. Для коротких access token'ов на 5 минут это удваивает реальный срок жизни, поэтому `ClockSkew` обычно уменьшают до десятков секунд.

Причину отказа показывает событие `OnAuthenticationFailed` и логи категории `Microsoft.AspNetCore.Authentication` — там будет код вроде `IDX10223: Lifetime validation failed`.

## Симметричная и асимметричная подпись

`HS256` — один общий секрет: кто может проверить токен, тот может его и выпустить. Слабый секрет к тому же подбирается офлайн по любому перехваченному токену. `RS256` и `ES256` — издатель подписывает приватным ключом, а API проверяют публичным из JWKS. Как только сервисов больше одного, асимметричная подпись — единственный разумный вариант: компрометация одного API не позволяет выпускать токены.

## Claims и их маппинг

Claim — утверждение о пользователе в виде пары «тип — значение»: `sub = user-42`, `role = admin`, `tenant = acme`. `ClaimsIdentity` — набор claims от одного способа аутентификации, `ClaimsPrincipal` — пользователь, который может иметь несколько identity; это и есть `HttpContext.User`.

Имена типов claims — самый частый источник `null`. Проверено на .NET 10, токен с claims `sub` и `role`, настройки JwtBearer по умолчанию:

```
http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier = user-42
http://schemas.microsoft.com/ws/2008/06/identity/claims/role = admin
Identity.Name = null, IsInRole("admin") = True
```

Короткие имена из токена переименованы в длинные URI Microsoft: `user.FindFirst("sub")` вернёт `null`, а `User.Identity.Name` пуст, потому что claim с именем в токене нет. Это поведение `MapInboundClaims = true`. Если выключить его, claims сохранят исходные имена — проверено, тот же токен даёт `sub=user-42; role=admin`, — но `IsInRole("admin")` вернёт `False`: identity по-прежнему ищет роли под длинным типом. Поэтому вместе с отключением маппинга нужно явно указать `NameClaimType` и `RoleClaimType`:

```csharp
.AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters.NameClaimType = "sub";
    o.TokenValidationParameters.RoleClaimType = "role";
});
```

Дополнить claims на сервере, например правами из базы, позволяет `IClaimsTransformation`. Он может вызываться несколько раз за запрос, поэтому должен быть идемпотентным и кэшировать обращения к базе.

## Политики

Роли в атрибутах — `[Authorize(Roles = "admin,manager")]` — быстро размазывают правила доступа по всему коду. Политики собирают их в одном месте:

```csharp
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("CanRefund", p => p
        .RequireAuthenticatedUser()
        .RequireClaim("permission", "orders:refund"))
    .AddPolicy("Adult", p => p.AddRequirements(new MinimumAgeRequirement(18)));

builder.Services.AddSingleton<IAuthorizationHandler, MinimumAgeHandler>();

app.MapPost("/orders/{id}/refund", Refund).RequireAuthorization("CanRefund");
```

Политика выполнена, если выполнены **все** её requirements. У одного requirement может быть несколько handlers, и достаточно, чтобы один вызвал `Succeed`, — если никто не вызвал `Fail`, который работает как жёсткий запрет. Роли под капотом — тоже политика с `RolesAuthorizationRequirement`.

Когда решение зависит от конкретного объекта — «может ли пользователь редактировать **этот** документ», — политику проверяют в коде после загрузки ресурса:

```csharp
var result = await authz.AuthorizeAsync(User, document, "EditDocument");
if (!result.Succeeded) return Forbid();
```

Атрибут здесь бессилен: на этапе авторизации endpoint'а документ ещё не загружен.

## Отзыв и время жизни

Главный минус JWT — его **нельзя отозвать** до `exp`: API проверяет токен офлайн и не знает, что пользователя заблокировали. Стандартный ответ — короткоживущий access token на 5–15 минут и долгоживущий refresh token, который хранится на сервере и отзывается. Если отзыв нужен мгновенно, добавляют проверку по денилисту в `OnTokenValidated` или introspection у издателя, и платят за это походом в хранилище на каждый запрос.

## Частые ошибки

- **Хранить токен в `localStorage` в SPA** — он доступен любому XSS. Альтернатива — паттерн BFF, когда токены остаются на сервере, а браузер получает httpOnly-cookie.
- **Отключать проверку `aud` или `iss`**, «чтобы заработало». Тогда API примет токен, выпущенный для другого сервиса того же издателя.
- **Длинный access token без механизма отзыва.**
- **Класть в токен всё подряд** — сотни прав увеличивают каждый запрос и не обновляются до выдачи нового токена.
- **Доверять claims из тела запроса или заголовка**, заполненного клиентом. Claim заслуживает доверия только потому, что его подписал доверенный издатель.

## Что стоит ответить на собеседовании

Аутентификация устанавливает личность и кладёт `ClaimsPrincipal` в `HttpContext.User`, авторизация проверяет политику endpoint'а для этого пользователя. Невалидный или отсутствующий токен делает пользователя анонимным, а 401 появляется только тогда, когда endpoint требует аутентификации и авторизация вызывает challenge схемы; если пользователь известен, но прав нет, — 403. JwtBearer проверяет подпись по ключу из JWKS издателя, `iss`, `aud` и срок действия — офлайн, без похода к identity provider на каждый запрос.

Сильный ответ добавит детали, проверяемые на практике: `ClockSkew` по умолчанию 5 минут, поэтому токен, истёкший полторы минуты назад, ещё принимается; при `MapInboundClaims = true` claim `sub` превращается в `ClaimTypes.NameIdentifier`, и `FindFirst("sub")` возвращает `null`. Назовёт главный минус JWT — невозможность отзыва до `exp`, отсюда короткий access token и отзываемый refresh token — и объяснит, почему для нескольких сервисов нужна асимметричная подпись, а аутентификация без `[Authorize]` или `FallbackPolicy` ничего не запрещает.
