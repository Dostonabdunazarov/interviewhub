---
title: Supply chain образов
slug: delivery-supply-chain-obrazov
track: infrastructure
section: delivery
level: senior
sortOrder: 6
summary: Откуда в образ попадает чужой код и как закрыть каждый вход — lock-файлы и source mapping NuGet, фиксация базы по digest, сканирование и SBOM, подпись cosign с provenance и политика допуска в кластере, которая не пустит неподписанное.
questions: devops-kak-zaschitit-cepochku-postavki-obrazov-ot-zavisimostei-do-zapuska-v-klastere
---

Образ сервиса — это ваш код плюс сотни пакетов NuGet, базовый образ с десятками системных библиотек, сборочная среда с чужими actions и реестр, из которого кластер всё это тянет. Атака на любой из этих входов даёт злоумышленнику выполнение кода в проде без единой строчки в вашем репозитории. Цель защиты формулируется так: в кластере запускается только то, что собрал ваш CI из вашего репозитория и проверенных зависимостей, и это можно доказать криптографически.На собеседовании ждут не перечня инструментов, а модели угроз: какая мера закрывает какую дыру.

## Модель угроз

| Вход | Что может пойти не так | Основная мера |
| --- | --- | --- |
| зависимости NuGet | тайпсквоттинг, dependency confusion, скомпрометированная новая версия | lock-файл, source mapping, аудит |
| базовый образ | подвижный тег, CVE в системных пакетах, подменённый образ | digest, минимальная база, регулярное обновление |
| сборочная среда | подменённый action, утечка ключей реестра, заражённый раннер | pin по SHA, OIDC, эфемерные раннеры |
| реестр и доставка | push в обход CI, подмена тега | подпись digest, provenance, admission-политика |

Сканер уязвимостей закрывает только часть первой и второй строки: известные CVE. Против намеренно вредоносного пакета или образа, собранного на чужом ноутбуке, он бесполезен — здесь работают фиксация версий и подпись.

## Зависимости NuGet

Без lock-файла `dotnet restore` разрешает плавающие версии и транзитивный граф каждый раз заново, и две сборки одного коммита могут получить разные пакеты. Lock-файл фиксирует граф вместе с хешами содержимого:

```xml
<PropertyGroup>
  <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  <RestoreLockedMode Condition="'$(CI)' == 'true'">true</RestoreLockedMode>
  <NuGetAuditMode>all</NuGetAuditMode>
  <NuGetAuditLevel>moderate</NuGetAuditLevel>
  <WarningsAsErrors>$(WarningsAsErrors);NU1903;NU1904</WarningsAsErrors>
</PropertyGroup>
```

`packages.lock.json` коммитится, а в CI restore в locked mode (`RestoreLockedMode` или `dotnet restore --locked-mode`) падает, если граф разошёлся с закоммиченным. Обновление зависимостей превращается в явный PR с диффом lock-файла, который проходит review.

**Package Source Mapping** в `nuget.config` закрывает dependency confusion: атакующий публикует в nuget.org пакет с именем вашего внутреннего `Acme.Billing` и версией 99.0, и restore без маппинга может выбрать его. С маппингом каждый шаблон имени разрешается только из своего источника:

```xml
<packageSourceMapping>
  <packageSource key="nuget.org">
    <package pattern="*" />
  </packageSource>
  <packageSource key="acme">
    <package pattern="Acme.*" />
  </packageSource>
</packageSourceMapping>
```

Побеждает самый специфичный шаблон, поэтому `Acme.*` уйдёт только во внутренний фид, даже при наличии `*` у nuget.org. Префикс стоит дополнительно зарезервировать на nuget.org.

**Аудит.** NuGetAudit в SDK начиная с .NET 8 проверяет пакеты при restore по базе advisory и выдаёт предупреждения NU1901–NU1904 (от low до critical); в примере выше high и critical становятся ошибками сборки. Ручная проверка — `dotnet list package --vulnerable --include-transitive`. Транзитивная уязвимость закрывается явной ссылкой на исправленную версию пакета или Central Package Management с `CentralPackageTransitivePinningEnabled`.

## Базовый образ

Тег `aspnet:10.0` подвижный: Microsoft перевыпускает его с патчами, и сегодня и через месяц это разные байты. Это хорошо для безопасности и плохо для воспроизводимости, поэтому базу фиксируют по digest, а обновление digest отдают боту:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled@sha256:<digest>
```

Renovate или Dependabot открывают PR с новым digest, пайплайн прогоняет тесты, и патч безопасности доходит до прода за часы, но через review. Без такого бота pin по digest консервирует уязвимости: образ годами живёт на базе с известными CVE.

**Минимальная база** — самая дешёвая мера по соотношению усилий и эффекта. Chiseled-образы Microsoft на Ubuntu не содержат shell и пакетного менеджера и по умолчанию запускаются от non-root пользователя; distroless от Google устроены похоже. В отчёте сканера становится на порядок меньше находок, а у атакующего внутри контейнера нет ни `sh`, ни `curl`. Цена — отладка через ephemeral containers (`kubectl debug`) вместо `kubectl exec`. Детали размера и слоёв — в `Минимальный образ .NET`.

## Сканирование и SBOM

**SBOM** (Software Bill of Materials) — машиночитаемый перечень компонентов образа в формате CycloneDX или SPDX. Он нужен, чтобы на вопрос «где у нас уязвимая версия библиотеки» ответить за минуты, а не за день обхода репозиториев. Генерируют его BuildKit (`--sbom=true`), Syft по готовому образу или CycloneDX-инструменты на уровне проекта .NET.

**Сканеры** Trivy и Grype сопоставляют компоненты образа с базами уязвимостей и умеют ронять пайплайн по порогу:

```bash
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "$IMAGE@$DIGEST"
grype "$IMAGE@$DIGEST" --fail-on high
```

`--ignore-unfixed` не блокирует сборку уязвимостями, для которых ещё нет патча: блокировка не даст ничего, кроме остановленных релизов. Для находок, неприменимых к вашему коду, существует VEX — машиночитаемое заявление «уязвимость есть, но не эксплуатируема», которое сканер учитывает.

Сканирование только при сборке недостаточно: CVE публикуются после релиза, и образ, чистый месяц назад, сегодня уже уязвим. Работающие образы пересканируют регулярно — Trivy Operator в кластере или сканер реестра — и по SBOM находят затронутые сервисы.

## Подпись и provenance

Подпись доказывает, что образ выпустил ваш пайплайн, а не кто-то с доступом на push в реестр. Подписывается **digest**, а не тег: тег можно перевесить на другой образ, digest — хеш содержимого.

```bash
docker buildx build --sbom=true --provenance=mode=max \
  -t registry.example.com/orders-api:$GIT_SHA --push .
cosign sign --yes registry.example.com/orders-api@$DIGEST
cosign attest --yes --type cyclonedx --predicate sbom.json registry.example.com/orders-api@$DIGEST
```

В keyless-режиме Sigstore у cosign нет долгоживущего ключа: CI получает OIDC-токен от GitHub Actions или GitLab, Fulcio выдаёт короткоживущий сертификат на identity конкретного workflow, а запись о подписи уходит в прозрачный журнал Rekor. Украсть нечего, а проверяющий сверяет не ключ, а кто подписал — репозиторий, workflow и ветку:

```bash
cosign verify registry.example.com/orders-api@$DIGEST \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity "https://github.com/acme/orders/.github/workflows/release.yml@refs/heads/main"
```

**Provenance** — подписанная аттестация о том, где, из какого коммита и каким процессом собран артефакт. Фреймворк **SLSA** задаёт уровни зрелости сборки: на первом provenance просто существует, на втором её подписывает хостируемая сборочная платформа, на третьем сборка изолирована так, что даже сам пайплайн проекта не может подделать аттестацию. Политика может требовать сборку из `main` конкретного репозитория — образ с ноутбука разработчика не пройдёт, даже при правах на push.

Сам CI — часть цепочки. Сторонние actions закрепляют по SHA коммита, а не по тегу, который автор может перевесить; доступ к облаку и реестру — через OIDC federation, а не через секреты в настройках CI; раннеры эфемерные, чтобы заражение не переживало сборку; подписывают только сборки из защищённой ветки после review.

## Политика допуска в кластере

Подпись бесполезна, если её никто не проверяет. Admission-контроллер проверяет образ при создании пода: Kyverno, Sigstore policy-controller или Gatekeeper с внешним провайдером данных.

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-images
spec:
  rules:
    - name: verify-signature
      match:
        any:
          - resources:
              kinds: [Pod]
      verifyImages:
        - imageReferences:
            - "registry.example.com/*"
          failureAction: Enforce
          mutateDigest: true
          attestors:
            - entries:
                - keyless:
                    issuer: https://token.actions.githubusercontent.com
                    subject: "https://github.com/acme/orders/.github/workflows/release.yml@refs/heads/main"
```

`failureAction: Enforce` задаётся на уровне правила начиная с Kyverno 1.13; в более старых версиях то же делало поле `spec.validationFailureAction`. `mutateDigest` переписывает тег в спецификации пода на проверенный digest — запустится ровно то, что проверили, а не то, на что тег укажет через минуту. Встроенная `ValidatingAdmissionPolicy` на CEL криптографию не проверяет; она подходит для простых правил вроде «только наш реестр» и «без тега `latest`».

Политику включают сначала в режиме `Audit`: системные образы — ingress, CNI, агенты мониторинга — подписаны чужими ключами или не подписаны вовсе, и `Enforce` без исключений для них ломает кластер. Второй камень — webhook допуска становится зависимостью control plane: при `failurePolicy: Fail` и упавшем контроллере не создаётся ни один под, включая поды самого контроллера. Его ставят в несколько реплик и исключают системные неймспейсы.

Если что-то всё же проскочило, ущерб ограничивают `runAsNonRoot`, `readOnlyRootFilesystem`, `capabilities.drop: [ALL]` и Pod Security Admission в профиле `restricted`.

## Реестр-прокси и обновления

Прямые обращения кластера и CI к Docker Hub и nuget.org — это и зависимость от чужой доступности (лимиты Docker Hub на pull), и неконтролируемый вход. Pull-through кеш вроде Harbor, Artifactory или Nexus даёт единую точку, где образы и пакеты сканируются, кешируются и переживают удаление из upstream. В связке с source mapping и политикой «только наш реестр» это сводит все входы к одному контролируемому.

Регулярное обновление — часть защиты, а не гигиена. Даже без изменений в коде образ пересобирают по расписанию, например еженедельно, чтобы подтянуть патчи базы, и при критической CVE в базе действуют по сценарию: SBOM показывает затронутые сервисы, бот поднимает digest, пайплайн пересобирает и раскатывает обычной стратегией (см. `CI/CD-пайплайн` и `Rolling, blue-green, canary`).

## Что стоит ответить на собеседовании

Цепочку защищают слоями. На входе — `packages.lock.json` с locked mode в CI, Package Source Mapping против dependency confusion, NuGetAudit и базовый образ, зафиксированный по digest и обновляемый ботом через PR. Дальше — минимальная chiseled или distroless база, SBOM и сканирование Trivy или Grype при сборке и регулярно для работающих образов. Затем подпись digest через cosign и provenance, и в конце admission-политика в кластере, которая не пускает неподписанное.

Сильный ответ объяснит, какую угрозу закрывает каждая мера и почему сканер не защищает от вредоносного пакета. Назовёт keyless-подпись с OIDC и Rekor, проверку identity workflow вместо ключа и `mutateDigest`, чтобы запускалось проверенное. Упомянет SLSA-уровни, защиту самого CI — pin actions по SHA, OIDC вместо секретов, эфемерные раннеры — и эксплуатационные ловушки: включение политики через `Audit`, webhook как зависимость control plane и бесполезность отчёта сканера без триажа.
