---
title: Adapter
slug: pattern-adapter
track: code-design
section: patterns
level: middle
sortOrder: 5
summary: Зачем при интеграции со сторонним API нужен адаптер, что он берёт на себя — модель, единицы, ошибки, протокол — и как не спроектировать порт под одного провайдера.
---

Adapter переводит чужой интерфейс в тот, который нужен вашему коду. В книгах его объясняют на розетках и вилках, а в бэкенде он почти всегда появляется в одном месте — на границе со сторонним API: платёжным провайдером, службой доставки, сервисом рассылок. Там адаптер решает задачу важнее, чем «согласовать сигнатуры»: он не пускает чужую модель внутрь вашей.

## Что происходит без адаптера

Интеграция с платёжным провайдером начинается с SDK или сгенерированного клиента, и его типы быстро расползаются по коду:

```csharp
public sealed class CheckoutService(AcmePayClient acme)
{
    public async Task<string> PayAsync(Order order, string cardToken, CancellationToken ct)
    {
        var response = await acme.CreateChargeAsync(new AcmeChargeDto(
            cardToken, (long)(order.Total * 100), "rub"), ct);

        if (response.Status == "requires_action")
            return response.NextActionUrl!;
        if (response.Status != "succeeded")
            throw new InvalidOperationException(response.DeclineCode);

        order.MarkPaid(response.Id);
        return "ok";
    }
}
```

В бизнес-логике оказались строковые статусы провайдера, суммы в копейках как `long`, коды отказов и DTO из чужого SDK. Через полгода то же самое повторяется в обработке возвратов, в отчётах и в вебхуках. Переход на новую версию API провайдера или подключение второго превращается в поиск по всему решению.

## Порт и адаптер

Сначала описывается то, что нужно **вашему** коду, в **ваших** терминах — порт:

```csharp
public interface IPaymentGateway
{
    Task<ChargeResult> ChargeAsync(ChargeRequest request, CancellationToken ct);
}

public sealed record ChargeRequest(string CardToken, Money Amount, string IdempotencyKey);

public abstract record ChargeResult
{
    public sealed record Succeeded(string ExternalId) : ChargeResult;
    public sealed record RequiresConfirmation(Uri RedirectUrl) : ChargeResult;
    public sealed record Declined(DeclineReason Reason) : ChargeResult;
}

public enum DeclineReason { InsufficientFunds, CardExpired, Other }
```

Отказ банка — ожидаемый исход, а не исключение, поэтому он часть результата. Исключение остаётся для настоящих сбоев — провайдер недоступен. Затем адаптер переводит порт в протокол конкретного провайдера:

```csharp
public sealed class AcmePayAdapter(HttpClient http) : IPaymentGateway
{
    public async Task<ChargeResult> ChargeAsync(ChargeRequest request, CancellationToken ct)
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, "v2/charges")
        {
            Content = JsonContent.Create(new AcmeChargeDto(
                request.CardToken,
                request.Amount.MinorUnits,
                request.Amount.Currency.ToLowerInvariant()))
        };
        message.Headers.Add("Idempotency-Key", request.IdempotencyKey);

        using var response = await http.SendAsync(message, ct);
        var body = await response.Content.ReadFromJsonAsync<AcmeChargeResponse>(ct);

        return (response.StatusCode, body?.Status) switch
        {
            (HttpStatusCode.OK, "succeeded") => new ChargeResult.Succeeded(body!.Id),
            (HttpStatusCode.OK, "requires_action") =>
                new ChargeResult.RequiresConfirmation(new Uri(body!.NextActionUrl!)),
            (HttpStatusCode.PaymentRequired, _) => new ChargeResult.Declined(MapDecline(body?.DeclineCode)),
            _ => throw new PaymentGatewayUnavailableException((int)response.StatusCode)
        };
    }

    private static DeclineReason MapDecline(string? code) => code switch
    {
        "insufficient_funds" => DeclineReason.InsufficientFunds,
        "card_expired" => DeclineReason.CardExpired,
        _ => DeclineReason.Other
    };
}
```

Бизнес-код теперь работает с `IPaymentGateway` и разбирает результат через pattern matching по трём осмысленным исходам. Всё, что знает про AcmePay, лежит в одном классе.

## Что адаптер берёт на себя

- **Модель.** DTO провайдера (`AcmeChargeDto`, `AcmeChargeResponse`) не выходят за пределы адаптера. Наружу — только доменные типы.
- **Единицы и форматы.** Минорные единицы валюты, регистр кодов валют, часовые пояса, форматы дат и идентификаторов.
- **Ошибки.** Коды провайдера превращаются в доменные исходы (отказ) и в инфраструктурные исключения (недоступность), на которые настроены ретраи и circuit breaker.
- **Протокол.** Ключи идемпотентности, подписи запросов, пагинация, обновление токенов, ограничения частоты запросов.
- **Версии.** Переход на v3 API провайдера — правка адаптера и его тестов, остальной код не меняется.

В терминах DDD это Anti-Corruption Layer в малом: адаптер защищает вашу модель от чужой. У провайдера может быть 14 статусов платежа, ваш домен видит три исхода.

## Адаптер, фасад и прокси

На собеседовании Adapter почти всегда просят отличить от соседей.

- **Adapter** согласует **несовместимые** интерфейсы: есть чужой API, есть нужный вам контракт, адаптер переводит одно в другое.
- **Facade** **упрощает** сложную подсистему: даёт один удобный вход вместо десятка классов, но не обязан ничего переводить. Клиент SDK с методом `PayAsync`, внутри которого создание клиента, авторизация и три вызова, — фасад.
- **Proxy** и **Decorator** сохраняют **тот же** интерфейс: первый управляет доступом, второй добавляет поведение. Адаптер интерфейс меняет. Подробнее о них — в статьях `Proxy` и `Decorator vs наследование`.

В GoF различают ещё адаптер объекта (держит ссылку на адаптируемый объект, как в примере) и адаптер класса (наследуется от адаптируемого класса и реализует целевой интерфейс). В C# почти всегда используют первый: он не требует наследования от чужого класса и работает с `sealed`-типами.

## Как спроектировать порт

Две противоположные ошибки.

**Порт под одного провайдера.** Интерфейс назван и устроен по API первого провайдера: `CreatePaymentIntentAsync`, `ConfirmPaymentIntentAsync`, статусы его же строками. При подключении второго провайдера, у которого нет «намерений платежа», порт придётся переделывать вместе со всеми, кто его использует. Порт описывает ваши потребности, а не чужой API. Помогает посмотреть хотя бы на двух провайдеров, даже если подключаете одного.

**Наименьший общий знаменатель.** Обратная крайность: порт настолько общий, что уникальные возможности провайдера — частичный возврат, 3-D Secure, рекуррентные платежи — недоступны. Иногда честнее явно описать возможности:

```csharp
public interface IRefundGateway
{
    bool SupportsPartialRefund { get; }
    Task RefundAsync(string externalId, Money amount, CancellationToken ct);
}
```

Флаг возможности — компромисс: клиент обязан его проверять. Но это лучше, чем адаптер, который бросает `NotSupportedException` на частичный возврат и тем самым нарушает контракт порта — разбор таких нарушений в статье `Нарушение LSP на реальном коде`.

## Адаптер — это всё ещё сеть

Адаптер делает внешний вызов похожим на обычный метод, но под ним HTTP. Отсюда обязательные вещи:

- **таймауты и устойчивость** настраиваются на `HttpClient` через `IHttpClientFactory` и `AddStandardResilienceHandler` или собственный конвейер;
- **ретраи только для идемпотентных операций** — списание без ключа идемпотентности повторять нельзя, иначе двойное списание;
- **логирование** запросов и ответов провайдера на границе — это первое, что понадобится при разборе спорного платежа.

Вебхуки провайдера проходят через ту же границу, только в обратную сторону: проверка подписи, маппинг события в доменный тип, идемпотентная обработка по идентификатору события.

## Как тестировать

- **Юнит-тесты маппинга** на записанных ответах провайдера, включая ошибки и странные статусы. Ответы хранятся файлами рядом с тестами.
- **Тесты устойчивости** с подменой HTTP — `WireMock.Net` или собственный `HttpMessageHandler`: таймаут, 500, обрыв соединения.
- **Контрактные тесты против песочницы** провайдера — редко, по расписанию, чтобы заметить изменение API раньше продакшена.

Бизнес-логику при этом тестируют с фейковой реализацией `IPaymentGateway`, без HTTP вовсе.

## Что стоит ответить на собеседовании

Adapter переводит чужой интерфейс в нужный вашему коду. При интеграции со сторонним API это граница, на которой модель, единицы, ошибки и протокол провайдера превращаются в понятия вашего домена, — Anti-Corruption Layer в малом. Порт описывается в терминах потребителя, DTO провайдера не выходят за адаптер, ожидаемый отказ — результат, недоступность — исключение. От Facade отличается тем, что согласует интерфейсы, а не упрощает подсистему; от Proxy и Decorator — тем, что меняет интерфейс.

Сильный ответ назовёт две ошибки проектирования порта — под одного провайдера и наименьший общий знаменатель — и напомнит, что за адаптером сеть: таймауты, ретраи только с ключом идемпотентности.
