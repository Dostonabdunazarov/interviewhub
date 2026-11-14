---
title: API gateway, service discovery и service mesh
slug: ms-api-gateway-discovery-mesh
track: distributed
section: microservices
level: senior
sortOrder: 8
summary: Что делает API gateway на краю системы и почему в нём не место бизнес-логике, как сервисы находят друг друга через DNS Kubernetes, Consul и Microsoft.Extensions.ServiceDiscovery, какие задачи решает service mesh и сколько он стоит, и как один trace context проходит через HTTP, gRPC и Kafka.
questions: microservices-chto-takoe-api-gateway, microservices-advanced-chto-dolzhen-i-chego-ne-dolzhen-delat-api-gateway, microservices-chto-takoe-service-discovery, microservices-advanced-kakie-zadachi-reshaet-service-mesh-i-kogda-ego-slozhnost-ne-opravdana, microservices-kak-peredavat-correlation-id-mezhdu-servisami
---

Когда сервисов становится больше трёх, появляются вопросы, которых у монолита не было: куда клиенту слать запрос, как сервис заказов узнаёт адрес платежей, если поды каждые полчаса меняют IP, кто шифрует трафик внутри кластера и как найти все логи одного запроса. На них отвечают три инфраструктурных слоя: API gateway обслуживает north-south трафик — от клиентов внутрь, service discovery даёт адреса по логическим именам, service mesh берёт на себя east-west трафик между сервисами.

На собеседовании проверяют не знание продуктов, а границы ответственности: что каждый слой должен делать, чего не должен, и где дублирование превращается в проблему — например, ретраи, перемноженные на трёх уровнях.

## API gateway: тонкий слой на краю

Gateway — единая точка входа: клиент видит один адрес, а не двадцать сервисов. Его работа — сквозные задачи, одинаковые для всех маршрутов:

- **маршрутизация** по пути, хосту или заголовку, weighted-маршруты для canary, маршрутизация версий API;
- **TLS-терминация** — сертификаты в одном месте, внутри mTLS или сеть кластера;
- **аутентификация** — проверка подписи, срока и audience JWT, отсев анонимных запросов до того, как они дойдут до сервисов;
- **грубая авторизация** — «`/admin/*` только для роли admin»;
- **защита** — rate limiting на клиента или API-ключ, лимиты размера тела, таймауты, CORS (подробно — `Rate limiting`);
- **наблюдаемость** — access-логи, метрики по маршрутам, начало трассы;
- **трансляция протоколов** — gRPC-JSON transcoding, проксирование WebSocket.

В .NET типичный выбор — YARP: reverse proxy как обычное ASP.NET Core приложение, поэтому к нему подключаются стандартные middleware аутентификации и rate limiting, а политики привязываются к маршрутам в конфигурации:

```json
"ReverseProxy": {
  "Routes": {
    "orders": {
      "ClusterId": "orders",
      "AuthorizationPolicy": "customers",
      "RateLimiterPolicy": "per-client",
      "Match": { "Path": "/api/orders/{**rest}" },
      "Transforms": [ { "PathPattern": "/{**rest}" } ]
    }
  },
  "Clusters": {
    "orders": {
      "LoadBalancingPolicy": "PowerOfTwoChoices",
      "HealthCheck": { "Active": { "Enabled": true, "Interval": "00:00:10", "Path": "/health/ready" } },
      "HttpRequest": { "ActivityTimeout": "00:00:30" },
      "Destinations": { "d1": { "Address": "http://orders:8080/" } }
    }
  }
}
```

```csharp
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));
builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization(o =>
    o.AddPolicy("customers", p => p.RequireAuthenticatedUser()));
builder.Services.AddRateLimiter(o =>
    o.AddFixedWindowLimiter("per-client", w =>
    {
        w.PermitLimit = 100;
        w.Window = TimeSpan.FromSeconds(1);
    }));

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapReverseProxy();
```

Альтернативы — Ocelot, Envoy или Kong, managed-шлюзы облаков. Важнее продукта то, что gateway без состояния и работает в нескольких репликах.

## Чего gateway делать не должен

Gateway, который «немного проверяет заказ», быстро становится распределённым монолитом: его правят все команды, и ни одна не может релизиться независимо. Запрещённый список:

- **бизнес-правила** — «не больше 10 единиц в заказе» живёт в сервисе заказов, иначе правило дублируется или обходится внутренними вызовами;
- **оркестрация** — последовательные вызовы сервисов с откатами в gateway — это сага без хранимого состояния и без надёжности (как правильно — в `Saga`);
- **объектная авторизация** — «пользователь видит только свои заказы» требует данных, которые есть только у сервиса-владельца;
- **ретраи неидемпотентных запросов** — повтор POST на уровне прокси создаст два заказа;
- **доменная база и кэш персональных ответов** без понимания инвалидации.

Агрегация — пограничный случай. Если мобильному экрану нужны данные трёх сервисов, это делает BFF (Backend for Frontend) — отдельный сервис под конкретного клиента, которым владеет команда этого клиента. В BFF живёт логика представления, но не доменная, а общий gateway остаётся тонким.

Два практических риска. Таймаут gateway должен быть больше таймаута сервиса за ним, иначе клиент получит 504, а операция выполнится — и клиент повторит её. И сервисы не должны слепо доверять заголовку вроде `X-User-Id`: если до них можно достучаться в обход gateway, его подделает кто угодно. Надёжнее пробрасывать проверенный токен и валидировать его в сервисе.

## Service discovery

Экземпляры в контейнерах появляются и исчезают, поэтому адреса нельзя хранить в конфиге. Discovery — реестр живых экземпляров по логическому имени: экземпляр регистрируется (сам или его регистрирует платформа), реестр проверяет health check и выбрасывает мёртвых, клиент получает адреса по имени.

| | Client-side | Server-side |
| --- | --- | --- |
| кто выбирает экземпляр | клиент получает список и балансирует сам | балансировщик или прокси на пути запроса |
| примеры | Consul + клиентская библиотека, gRPC client-side LB | Kubernetes Service, облачный балансировщик, mesh |
| плюсы | нет лишнего хопа, гибкая балансировка | клиент простой, логика в инфраструктуре |
| минусы | библиотека в каждом стеке | дополнительный компонент на пути |

В Kubernetes discovery встроен: `Service` получает стабильное DNS-имя `orders.shop.svc.cluster.local` и виртуальный IP, а трафик распределяется по подам, прошедшим readiness probe. Отдельный Consul в кластере обычно не нужен; он остаётся для гибридных инсталляций с виртуальными машинами, где даёт тот же реестр с health checks через HTTP API и DNS-интерфейс.

Ловушка уровня senior — долгие соединения. Балансировка через `Service` работает на L4, то есть распределяет соединения, а не запросы. gRPC держит одно HTTP/2-соединение и мультиплексирует в нём всё, поэтому новый под после масштабирования может не получить ни одного запроса. Решения — headless service (DNS отдаёт IP подов) плюс клиентская балансировка gRPC, L7-прокси или mesh. Вторая ловушка — DNS-кэширование: реестр всегда отстаёт от реальности на секунды, поэтому таймауты и ретраи нужны и с идеальным discovery (см. `Retry, jitter и retry storm`).

В .NET есть `Microsoft.Extensions.ServiceDiscovery`, на котором построен Aspire: в `HttpClient` указывают логическое имя, а адрес берётся из конфигурации или DNS. Схема `https+http` означает «предпочесть https, если endpoint есть»:

```csharp
builder.Services.AddServiceDiscovery();
builder.Services.AddHttpClient<CatalogClient>(c =>
        c.BaseAddress = new("https+http://catalog"))
    .AddServiceDiscovery();
```

Для YARP есть отдельный адаптер, который резолвит адреса кластеров тем же механизмом.

## Service mesh

Mesh выносит сетевые задачи межсервисного трафика из кода в инфраструктуру. Data plane — прокси, перехватывающий весь трафик пода: Envoy-sidecar у Istio, собственный лёгкий прокси у Linkerd, в ambient-режиме Istio — прокси на уровне узла для L4 и отдельные waypoint-прокси для L7. Control plane раздаёт прокси конфигурацию, сертификаты и политики.

Что mesh даёт одинаково для всех сервисов на любом языке:

- **mTLS и идентичность** — автоматическая выдача и ротация сертификатов, у каждого сервиса SPIFFE-идентичность;
- **L7-политики** — сервис A может `GET /orders`, но не `DELETE`, тогда как NetworkPolicy работает только на L3/L4;
- **управление трафиком** — веса между версиями для внутренних вызовов, зеркалирование, outlier detection;
- **ретраи и таймауты** — единая конфигурация, в том числе для сервисов на других стеках;
- **телеметрия** — golden signals по каждому вызову без изменения кода.

Цена ощутима. Sidecar на каждый под — это память, CPU и дополнительные миллисекунды на хоп; на тысячах подов это заметные деньги. Control plane надо обновлять, следить за совместимостью версий и CRD, а при его сбое страдает весь трафик. Отладка усложняется: «запрос не дошёл» теперь может означать политику, режим mTLS или конфигурацию прокси, и 503 от Envoy с флагами `UF` или `URX` нужно уметь читать.
Отдельная ловушка — дублирование устойчивости. Три попытки в mesh и три в `Microsoft.Extensions.Http.Resilience` дают девять вызовов на каждый запрос, а через три уровня сервисов — retry storm. Договариваются явно: ретраи живут в одном слое, обычно ближе к тому, кто знает про идемпотентность операции.

Mesh не оправдан, когда сервисов немного и они на одном стеке — Polly, OpenTelemetry и NetworkPolicy дают большую часть пользы; когда нет требования шифровать внутренний трафик; когда нет людей, готовых владеть mesh'ем; и когда реальная проблема — границы сервисов, а не сеть. Промежуточные варианты — Linkerd как более простой mesh, mTLS и L7-политики на уровне CNI в Cilium, Istio ambient только с L4 mTLS. Внедряют постепенно: по одному namespace, сначала permissive mTLS, затем strict.

## Сквозной контекст: traceparent вместо самодельного ID

Чтобы найти все логи одного запроса, идентификатор должен пройти через все сервисы и сообщения. Стандарт для этого — W3C Trace Context: заголовок `traceparent` вида `00-<trace-id>-<parent-id>-<flags>`, где trace-id — 16 байт в hex, общий для всей трассы. В .NET он представлен `Activity`: ASP.NET Core читает входящий `traceparent` и создаёт `Activity` запроса, а `HttpClient` и gRPC-клиент сами добавляют заголовок в исходящие вызовы. Для HTTP ничего писать не нужно — достаточно не терять `Activity.Current`.

Важная деталь про mesh: прокси видит каждый вызов, но не может связать входящий запрос с исходящим внутри приложения. Контекст трассы всё равно пробрасывает код, и в .NET это происходит автоматически.

У Kafka автоматики нет: Confluent.Kafka не создаёт `Activity` и не пишет заголовки сам. Контекст переносят через заголовки сообщения тем же пропагатором, что использует OpenTelemetry:

```csharp
using var activity = Source.StartActivity($"{topic} publish", ActivityKind.Producer);

var headers = new Headers();
Propagators.DefaultTextMapPropagator.Inject(
    new PropagationContext(activity?.Context ?? default, Baggage.Current),
    headers,
    static (h, name, value) => h.Add(name, Encoding.UTF8.GetBytes(value)));

await producer.ProduceAsync(topic,
    new Message<string, string> { Key = orderId, Value = payload, Headers = headers }, ct);
```

```csharp
var parent = Propagators.DefaultTextMapPropagator.Extract(default, result.Message.Headers,
    static (h, name) => h.TryGetLastBytes(name, out var bytes)
        ? [Encoding.UTF8.GetString(bytes)]
        : Array.Empty<string>());

using var activity = Source.StartActivity(
    $"{result.Topic} process", ActivityKind.Consumer, parent.ActivityContext);
```

`Source` — это `ActivitySource`, зарегистрированный в OpenTelemetry через `AddSource`. При пакетной обработке одно сообщение — не единственный родитель, и вместо parent используют span links. MassTransit делает всё это сам и вдобавок несёт `CorrelationId` и `ConversationId`.

Чтобы TraceId попал в каждую запись лога, достаточно включить отслеживание активности у логгера или экспортировать логи через OpenTelemetry (подробно — `OpenTelemetry в .NET`):

```csharp
builder.Logging.Configure(o =>
    o.ActivityTrackingOptions = ActivityTrackingOptions.TraceId | ActivityTrackingOptions.SpanId);
```

Отдельный `X-Correlation-ID` нужен в двух случаях: идентификатор должен жить дольше одной трассы — сага на часы, повторная обработка из DLQ порождают несколько трасс, и тогда связующим служит бизнесовый ключ вроде `OrderId`; или его надо показать клиенту, чтобы поддержка нашла запрос по номеру из жалобы. Типичные ошибки: каждый сервис генерирует свой ID вместо входящего, а контекст теряется на асинхронной границе — задача ушла в `Channel` без него.

## Что стоит ответить на собеседовании

API gateway — тонкая точка входа для north-south трафика: маршрутизация, TLS, аутентификация, rate limiting, наблюдаемость; в .NET это обычно YARP со стандартными middleware. Бизнес-логики, оркестрации и объектной авторизации в нём нет, агрегацию под клиента делает BFF. Service discovery даёт адреса по логическим именам; в Kubernetes это DNS `Service`, вне его — Consul, в .NET — `Microsoft.Extensions.ServiceDiscovery`. Mesh забирает east-west трафик: mTLS, политики, ретраи, телеметрию. Сквозной идентификатор — W3C `traceparent`, который ASP.NET Core и `HttpClient` пропагируют сами, а в Kafka его кладут в заголовки сообщения.

Сильный ответ назовёт конкретные ловушки: таймаут gateway меньше таймаута сервиса, доверие к `X-User-Id` в обход gateway, L4-балансировку долгих gRPC-соединений, перемножение ретраев между mesh и Polly. Он оценит цену mesh — ресурсы sidecar, эксплуатацию control plane, отладку — и скажет, когда хватит Polly, OpenTelemetry и NetworkPolicy. И объяснит, почему mesh не избавляет от пропагации контекста в коде и когда рядом с TraceId нужен бизнесовый correlation id.
