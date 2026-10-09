---
title: Минимальный образ .NET
slug: k8s-minimalnyy-obraz-net
track: infrastructure
section: containers
level: senior
sortOrder: 1
summary: Как multi-stage сборка отделяет SDK от рантайма, почему порядок COPY решает скорость сборки, чем chiseled-образ отличается от обычного и что в нём ломается, зачем non-root, порт 8080 и фиксация digest.
---

Образ — это то, что реально работает в продакшене, и его размер — лишь вершина вопроса. Важнее, что в нём лежит: компилятор, shell, пакетный менеджер и исходники не нужны работающему сервису, но расширяют поверхность атаки, добавляют строки в отчёт сканера уязвимостей и замедляют каждый деплой на новый узел. На собеседовании проверяют, умеете ли вы собрать образ, который быстро пересобирается, мало весит, запускается не от root и не ломается в мелочах вроде культуры и часовых поясов.

## Multi-stage: SDK отдельно, рантайм отдельно

SDK весит сотни мегабайт: компилятор, MSBuild, NuGet. В рантайме ничего из этого не нужно. Multi-stage сборка делит Dockerfile на стадии: в первой стоит SDK и выполняются `restore` и `publish`, а в финальный образ копируется только результат публикации поверх маленькой базы.

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Packages.props Directory.Build.props ./
COPY src/Orders.Api/Orders.Api.csproj src/Orders.Api/
RUN dotnet restore src/Orders.Api/Orders.Api.csproj
COPY . .
RUN dotnet publish src/Orders.Api/Orders.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Orders.Api.dll"]
```

Всё, что было в стадии `build`, в итоговый образ не попадает: ни SDK, ни исходники, ни кэш пакетов. Остаётся рантайм ASP.NET Core и опубликованные сборки.

`ENTRYPOINT` записан в exec-форме, массивом. Shell-форма `ENTRYPOINT dotnet Orders.Api.dll` запускает процесс через `sh -c`, и PID 1 становится shell, который не пробрасывает `SIGTERM`, — к этому вернёмся в статье `Graceful shutdown в K8s`. В chiseled-образе shell-форма не запустится вовсе: shell там нет.

## Порядок слоёв и кэш

Каждая инструкция Dockerfile — слой, и слой берётся из кэша, пока не изменились его входы. Поэтому сначала копируются только `.csproj` и props-файлы, затем `restore`, и лишь потом весь код. Пока зависимости не менялись, тяжёлый слой с пакетами переиспользуется, а сборка после правки кода занимает секунды.

Если начать с `COPY . .`, любой изменённый файл инвалидирует кэш `restore`, и пакеты качаются на каждый коммит. Вторая половина той же задачи — `.dockerignore`:

```text
**/bin/
**/obj/
.git/
.vs/
**/*.user
```

Без него в контекст сборки уходят `bin`, `obj` и вся история git: контекст раздувается, а `obj` с другой машины ещё и ломает сборку.

На CI, где кэш слоёв часто теряется между запусками, помогает кэш-монтирование BuildKit — пакеты NuGet переживают сборки, не попадая в образ:

```dockerfile
RUN --mount=type=cache,id=nuget,target=/root/.nuget/packages \
    dotnet restore src/Orders.Api/Orders.Api.csproj
```

## Какую базу выбрать

| База | Что внутри | Когда брать |
| --- | --- | --- |
| `aspnet:10.0` | полный Ubuntu, shell, apt | нативные зависимости, отладка внутри контейнера |
| `aspnet:10.0-alpine` | musl, shell, маленький размер | когда нужен shell, а размер важен; помнить об отличиях musl |
| `aspnet:10.0-noble-chiseled` | рантайм и минимум библиотек, без shell и пакетного менеджера | дефолт для продакшена |
| `aspnet:10.0-noble-chiseled-extra` | то же плюс ICU и tzdata | нужны культуры и часовые пояса |
| `runtime-deps:10.0-noble-chiseled` | только нативные зависимости, без рантайма .NET | self-contained, trimmed или Native AOT |

Chiseled — это Ubuntu, из которой «вырезано» всё, что не нужно для запуска процесса. В ней нет shell, `apt`, `curl`, и по умолчанию она запускается от непривилегированного пользователя. Меньше пакетов — меньше CVE в отчёте сканера и меньше инструментов у злоумышленника, если он всё-таки попал внутрь.

## Non-root и порт 8080

С .NET 8 все официальные образы содержат пользователя `app`, а его UID доступен в переменной `APP_UID` (это 1654). Числовой UID важен для Kubernetes: проверка `runAsNonRoot: true` по имени пользователя не может убедиться, что он не root, и отказывается запускать контейнер. `USER $APP_UID` в Dockerfile задаёт именно число.

Вместе с этим дефолтный порт ASP.NET Core в контейнерах сменился с 80 на 8080: непривилегированный процесс не может слушать порты ниже 1024. Меняется он переменной `ASPNETCORE_HTTP_PORTS`. Вернуть 80 можно только ценой запуска от root.

Связка с манифестом пода выглядит так:

```yaml
securityContext:
  runAsNonRoot: true
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
volumeMounts:
  - name: tmp
    mountPath: /tmp
```

`readOnlyRootFilesystem` заранее ловит код, который пишет в `/app` или куда-то ещё в файловую систему образа. Временные файлы уезжают в `emptyDir`, смонтированный в `/tmp`.

## Self-contained, trimming и AOT

Framework-dependent публикация опирается на рантайм из базового образа — это вариант по умолчанию и он самый простой. Self-contained кладёт рантайм рядом с приложением, и тогда база нужна только с нативными зависимостями — `runtime-deps`. Trimming вырезает неиспользуемый код и уменьшает размер, но ломается на рефлексии.

Native AOT компилирует приложение в нативный бинарник: образ сжимается до десятков мегабайт, старт занимает миллисекунды, нет JIT. Цена — ограничения: нет генерации кода во время выполнения, рефлексия требует аннотаций, часть библиотек (EF Core в полном объёме, некоторые сериализаторы) не поддерживается. Для небольших сервисов и функций это хороший выбор, для типичного API с EF Core — пока нет.

## Сборка без Dockerfile

SDK умеет собрать образ сам, без Dockerfile, а при публикации прямо в registry (свойство `ContainerRegistry`) — и без Docker-демона:

```bash
dotnet publish src/Orders.Api -c Release \
  --os linux --arch x64 \
  /t:PublishContainer \
  -p:ContainerFamily=noble-chiseled \
  -p:ContainerRepository=orders-api
```

Базу SDK выбирает по типу проекта и версии фреймворка, `ContainerFamily` переключает её на chiseled, а пользователь `app` включается по умолчанию. Это удобно для простых сервисов, но нестандартные шаги — нативные пакеты, свои файлы, сложная сборка — по-прежнему проще описать в Dockerfile.

## Что ломается в chiseled

**Культура.** В chiseled нет ICU, и .NET работает в invariant mode: `CultureInfo("ru-RU")` не даст русских форматов, сравнение строк и сортировка становятся ординальными, а `TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow")` не найдёт пояс без tzdata. Если это нужно — `-extra`.

**Нет shell.** `kubectl exec -it pod -- sh` не сработает, а `HEALTHCHECK CMD curl` в Dockerfile невозможен. Здоровье проверяют пробами Kubernetes (см. `Readiness vs liveness`), а для отладки подключают ephemeral container с инструментами:

```bash
kubectl debug -it orders-api-7c9f -n orders --image=busybox --target=api
```

`--target` даёт общее пространство процессов с контейнером приложения. Как так снимать дампы и трейсы, разобрано в статьях `dotnet-counters и dotnet-trace` и `Анализ дампа`.

**preStop через `exec`.** Хук `["sleep", "10"]` упадёт — бинарника `sleep` нет. Нужно встроенное действие `sleep` в манифесте, подробности — в `Graceful shutdown в K8s`.

## Тег против digest

Тег `aspnet:10.0` перезаписывается при каждом патче рантайма: сегодняшняя сборка и вчерашняя получают разные базы. Для воспроизводимости в Dockerfile фиксируют digest, а обновления базы подтягивают ботами (Renovate, Dependabot) отдельными PR — так патч безопасности приходит осознанно и проходит тесты:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled@sha256:<digest>
```

Если кластер работает на ARM-узлах (Graviton, Ampere), образ собирают multi-arch: `docker buildx build --platform linux/amd64,linux/arm64`. SDK-образ при этом лучше запускать на платформе сборщика и публиковать под целевую через `--arch`, чтобы не компилировать под эмуляцией QEMU.

## Что стоит ответить на собеседовании

Multi-stage сборка: SDK в стадии `build`, в финальный образ копируется только результат `publish` поверх рантайм-базы, поэтому в нём нет компилятора, исходников и кэша пакетов. Порядок слоёв — сначала `.csproj` и `restore`, потом код, плюс `.dockerignore`, — решает, будет ли пересборка занимать секунды или минуты. Для продакшена по умолчанию берут chiseled: без shell и пакетного менеджера, с non-root пользователем.

Сильный ответ назовёт детали .NET 8+: пользователь `app` с `APP_UID` для `runAsNonRoot`, порт 8080 вместо 80, exec-форма `ENTRYPOINT`, чтобы сигналы доходили до процесса. И расскажет, что ломается в chiseled — invariant globalization без `-extra`, отсутствие shell для `kubectl exec` и `preStop` с `sleep`, — а также зачем фиксировать digest базового образа и когда оправдан Native AOT.
