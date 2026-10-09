---
title: Конфигурация и options
slug: aspnet-konfiguraciya-i-options
track: dotnet-backend
section: aspnet-core
level: middle
sortOrder: 3
summary: Как провайдеры конфигурации накладываются друг на друга, почему переменная окружения перебивает appsettings.json, чем различаются IOptions, IOptionsSnapshot и IOptionsMonitor и где хранить секреты.
---

Конфигурация в ASP.NET Core устроена проще, чем кажется по количеству API вокруг неё: это плоский словарь «строковый ключ → строковое значение», собранный из нескольких источников. Всё остальное — типизированные классы, валидация, перезагрузка без рестарта — надстройки над этим словарём. Если понять, как источники накладываются друг на друга, почти все вопросы вида «почему приложение видит не то значение» решаются сами.

## Провайдеры и порядок

`WebApplication.CreateBuilder` подключает источники в таком порядке:

1. `appsettings.json`
2. `appsettings.{Environment}.json`, например `appsettings.Production.json`
3. User Secrets — только в окружении `Development`
4. Переменные окружения
5. Аргументы командной строки

**Побеждает последний.** При чтении ключа конфигурация опрашивает провайдеры с конца, и первый нашедший значение выигрывает. Поэтому переменная окружения перебивает файл, а аргумент командной строки — переменную окружения.

Иерархия ключей выражается двоеточием: `Smtp:Port`, `ConnectionStrings:Default`. В именах переменных окружения двоеточие на Linux недопустимо, и его заменяет двойное подчёркивание: `Smtp__Port=2525` переопределит `Smtp:Port`. Это основной способ конфигурировать приложение в Docker и Kubernetes — образ один, отличаются только переменные.

Ключи регистронезависимы, значения всегда строки — типизация происходит позже, при привязке.

```csharp
var builder = WebApplication.CreateBuilder(args);

string? cs = builder.Configuration.GetConnectionString("Default");
int port = builder.Configuration.GetValue<int>("Smtp:Port");
var smtp = builder.Configuration.GetSection("Smtp").Get<SmtpOptions>();
```

## Свой источник встаёт последним

Из правила «побеждает последний» следует неочевидная вещь. Проверено на .NET 10: файл `lab.json` добавлен через `AddJsonFile` после `CreateBuilder`, и одновременно задана переменная окружения на тот же ключ.

```
appsettings.json: Probe=json,  env Probe=env       → env
lab.json:         Lab:Env=from-json, env Lab__Env=env → from-json
```

Для стандартного `appsettings.json` переменная окружения выиграла, как и ожидается. А файл, добавленный вручную, встал **после** переменных окружения и перебил их. Если такой файл появился в проекте ради удобства, переопределить его значения из Kubernetes уже не получится — нужно либо вставлять источник в нужную позицию, либо после него заново вызвать `AddEnvironmentVariables()`.

Когда непонятно, откуда пришло значение, помогает `builder.Configuration.GetDebugView()`: она печатает каждый ключ вместе с провайдером, который его дал. Только не выводите её в лог в проде — там будут пароли.

## Окружение

Какой `appsettings.{Environment}.json` подключится, решает переменная `ASPNETCORE_ENVIRONMENT` (или `DOTNET_ENVIRONMENT`). По умолчанию окружение — **`Production`**. Классическая ошибка — ожидать, что настройки из `appsettings.Development.json` применятся на сервере, где переменную забыли задать, или наоборот, удивляться, что на машине разработчика не включилась валидация DI: в статье `DI и жизненные циклы` видно, что `ValidateScopes` зависит именно от окружения.

## Options pattern

Читать `IConfiguration["Smtp:Host"]` в сервисах можно, но это магические строки, отсутствие типов и зависимость каждого сервиса от всей конфигурации сразу. Options pattern привязывает секцию к классу:

```json
{
  "Smtp": { "Host": "smtp.example.com", "Port": 587, "UseSsl": true }
}
```

```csharp
public sealed class SmtpOptions
{
    public const string Section = "Smtp";

    [Required] public string Host { get; init; } = "";
    [Range(1, 65535)] public int Port { get; init; } = 25;
    public bool UseSsl { get; init; }
}

builder.Services.AddOptions<SmtpOptions>()
    .BindConfiguration(SmtpOptions.Section)
    .ValidateDataAnnotations()
    .ValidateOnStart();

public sealed class EmailSender(IOptions<SmtpOptions> options)
{
    private readonly SmtpOptions _smtp = options.Value;
}
```

Сервис зависит только от своего набора настроек, в тесте достаточно `Options.Create(new SmtpOptions { ... })`, а правила проверки собраны в одном месте.

## Валидация при старте

Привязка не ругается на опечатки: ключ `"Prot"` вместо `"Port"` просто оставит значение по умолчанию. Поэтому валидация нужна, а `ValidateOnStart()` — особенно. Без него проверка выполняется лениво, при первом обращении к `.Value`, то есть приложение благополучно стартует и падает через час на первом письме.

Помимо атрибутов, правила можно задать лямбдой `Validate(o => o.Port != 0, "Port обязателен")` или классом `IValidateOptions<T>`. С .NET 8 есть source generator `[OptionsValidator]` — валидация без рефлексии, она же нужна для Native AOT. Там же появился генератор для самой привязки конфигурации.

## IOptions, IOptionsSnapshot, IOptionsMonitor

Три способа получить один и тот же объект настроек. Отличаются временем жизни и тем, видят ли изменения:

| | `IOptions<T>` | `IOptionsSnapshot<T>` | `IOptionsMonitor<T>` |
| --- | --- | --- | --- |
| Lifetime | singleton | scoped | singleton |
| Видит изменения без рестарта | нет | да, со следующего запроса | да, сразу |
| Named options | нет | `Get(name)` | `Get(name)` |
| Уведомление об изменении | нет | нет | `OnChange` |
| Можно внедрять в singleton | да | нет | да |

Проверено на .NET 10: приложение запущено, затем в JSON-файле значение `one` заменено на `two`, следующий запрос:

```
IOptions=one  Snapshot=two  Monitor=two
```

`IOptions<T>.Value` вычисляется один раз и кэшируется навсегда. Snapshot пересоздаётся на каждый запрос и внутри одного запроса не меняется посередине. Monitor отдаёт актуальное значение через `CurrentValue` в любой момент.

Как выбирать:

- **`IOptions<T>`** — для того, что в рантайме не меняется: адреса, лимиты, строки подключения. Самый дешёвый вариант.
- **`IOptionsSnapshot<T>`** — нужны свежие значения в scoped-сервисе, и важно, чтобы в рамках запроса они были стабильны. Цена — пересоздание и повторная валидация на каждый запрос.
- **`IOptionsMonitor<T>`** — singleton-сервисы и фоновые воркеры, которым нужны изменения или реакция на них.

```csharp
public sealed class FeatureGate : IDisposable
{
    private readonly IDisposable? _subscription;
    private volatile FeatureOptions _current;

    public FeatureGate(IOptionsMonitor<FeatureOptions> monitor)
    {
        _current = monitor.CurrentValue;
        _subscription = monitor.OnChange(o => _current = o);
    }

    public bool IsOn(string name) => _current.Enabled.Contains(name);
    public void Dispose() => _subscription?.Dispose();
}
```

Подписку `OnChange` нужно освобождать, а обработчик делать идемпотентным: на одно сохранение файла он может сработать несколько раз.

Внедрять `IOptionsSnapshot<T>` в singleton нельзя — это тот же захват scoped-сервиса, что разобран в предыдущей статье. В Development контейнер упадёт при старте, в Production singleton навсегда запомнит первый снимок.

## Откуда берутся изменения

Перезагрузка работает, только если её поддерживает провайдер. JSON-файлы `WebApplication` подключает с `reloadOnChange: true`, поэтому правка `appsettings.json` подхватывается. Переменные окружения и аргументы командной строки в рантайме не меняются — для них перезагрузки нет. Из внешних источников перезагрузку умеют Azure App Configuration и Key Vault с `ReloadInterval`.

Если новое значение не проходит валидацию, исключение `OptionsValidationException` прилетит при следующем обращении к настройкам, а не в момент сохранения файла.

## Named options

Когда нужно несколько экземпляров одного типа — например, два SMTP-сервера:

```csharp
builder.Services.Configure<SmtpOptions>("transactional", builder.Configuration.GetSection("Smtp:Transactional"));
builder.Services.Configure<SmtpOptions>("marketing", builder.Configuration.GetSection("Smtp:Marketing"));

public sealed class Mailer(IOptionsMonitor<SmtpOptions> options)
{
    private SmtpOptions Marketing => options.Get("marketing");
}
```

`IOptions<T>` именованных экземпляров не знает — только default.

## Секреты

Несекретная конфигурация живёт в `appsettings*.json` в репозитории. Секреты — пароли, API-ключи, ключи подписи — **никогда не в git**:

| Где | Чем | Пример |
| --- | --- | --- |
| Машина разработчика | User Secrets | `dotnet user-secrets set "Payment:ApiKey" "..."` |
| Контейнер, CI | переменные окружения | `Payment__ApiKey=...` |
| Kubernetes | Secret как переменные или файлы | `AddKeyPerFile("/run/secrets")` |
| Облако | хранилище секретов | Azure Key Vault, AWS Secrets Manager, Vault |

Код при этом не меняется: всё читается через один `IConfiguration`, отличаются только провайдеры.

Несколько вещей, которые проверяют на собеседовании:

- **User Secrets — не шифрование.** Это обычный JSON в профиле пользователя. Его смысл — держать секреты вне каталога проекта, чтобы они не попали в коммит.
- **Переменные окружения видны** через `docker inspect`, `/proc/<pid>/environ` и дампы процесса. Файлы с ограниченными правами и хранилища надёжнее.
- **Лучший секрет — отсутствующий.** Managed identity для доступа к Key Vault или IAM-аутентификация к базе убирают из конфигурации даже «секрет для доступа к секретам».
- **Ротация.** Секрет, прочитанный при старте через `IOptions<T>`, не обновится. Для ротируемых значений — `IOptionsMonitor<T>` и провайдер с перезагрузкой.
- **Секрет уже в git** — его нужно ротировать. Удаление из истории не помогает: копии уже разошлись.

## Что стоит ответить на собеседовании

Конфигурация — плоский словарь строк из провайдеров, наложенных по порядку: `appsettings.json`, `appsettings.{Environment}.json`, User Secrets в Development, переменные окружения, аргументы командной строки. Побеждает последний, поэтому `Smtp__Port` из окружения перебивает файл, а окружение по умолчанию — `Production`. Сервисы читают настройки через options pattern: секция привязывается к классу, валидируется атрибутами, и `ValidateOnStart()` роняет приложение при старте, а не при первом обращении.

Сильный ответ разведёт три интерфейса: `IOptions<T>` — singleton, вычисляется один раз и изменений не видит; `IOptionsSnapshot<T>` — scoped, свежий на каждый запрос и стабильный внутри него, в singleton его внедрять нельзя; `IOptionsMonitor<T>` — singleton с `CurrentValue` и `OnChange`. И добавит две практические детали: источник, добавленный вручную после `CreateBuilder`, встаёт после переменных окружения и перебивает их, а секреты хранятся вне репозитория — в User Secrets локально и в переменных, файлах или хранилище секретов на окружениях.
