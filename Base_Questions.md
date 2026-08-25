# Базовые вопросы с разобранными ответами

Вопросы по основным направлениям — React, .NET, PostgreSQL, DevOps, алгоритмы,
System Design и soft skills. **Ответы написаны**, файл можно импортировать сразу:

```bash
node tools/import-questions.mjs --file Base_Questions.md --url … --email …
```

Раньше эти вопросы жили в `DemoContent.cs` и засеивались только в Development,
поэтому в проде категории React, .NET и DevOps оставались пустыми. Теперь они
в общем формате и попадают в любую среду через скрипт импорта.

Формат описан в `tools/questions.md`.

| Раздел | Категория | Вопросов |
| --- | --- | --- |
| React | `react` | 3 |
| .NET | `dotnet` | 3 |
| PostgreSQL | `postgresql` | 2 |
| DevOps | `devops` | 2 |
| Алгоритмы | `algorithms` | 1 |
| System Design | `system-design` | 1 |
| Soft Skills | `soft-skills` | 1 |
| **Итого** | | **13** |

---

# React

## Что такое virtual DOM и зачем он нужен?

```yaml
category: react
level: junior
difficulty: 2
slug: react-chto-takoe-virtualnyi-dom
featured: true
tags: virtual-dom, rendering
companies: yandex:2025:technical, ozon:2024:screening
```

Virtual DOM — это легковесное представление реального DOM в памяти
в виде дерева обычных объектов.

**Как работает:**
1. При изменении состояния React строит новое дерево.
2. Сравнивает его с предыдущим (reconciliation, diffing).
3. Вычисляет минимальный набор изменений и применяет их к реальному DOM.

**Зачем:** операции с реальным DOM дорогие. Пакетное применение только
нужных изменений быстрее, чем перерисовывать всё поддерево.

## Как работает массив зависимостей useEffect?

```yaml
category: react
level: middle
difficulty: 3
slug: react-useeffect-dependencies
featured: true
tags: hooks, useeffect
companies: yandex:2025:technical, avito:2025:technical
```

Массив зависимостей определяет, когда эффект будет перезапущен.

```jsx
useEffect(() => { /* ... */ });            // после каждого рендера
useEffect(() => { /* ... */ }, []);        // один раз при монтировании
useEffect(() => { /* ... */ }, [userId]);  // при изменении userId
```

Сравнение зависимостей поверхностное (`Object.is`). Поэтому объекты
и функции, создаваемые заново на каждом рендере, ломают мемоизацию —
их оборачивают в `useMemo` или `useCallback`.

**Важно:** функция очистки вызывается перед следующим запуском эффекта
и при размонтировании — там отписываются от подписок и отменяют запросы.

## Почему нельзя использовать индекс массива как key?

```yaml
category: react
level: senior
difficulty: 4
slug: react-reconciliation-keys
tags: reconciliation, keys
companies: google:2024:technical
```

`key` нужен reconciliation-алгоритму, чтобы сопоставить элементы
между рендерами.

При индексе как ключе вставка в начало списка сдвигает все индексы:
React считает, что изменились все элементы, и переиспользует чужое
состояние. Классический баг — введённый текст «переезжает» в другую
строку списка.

**Правильно:** стабильный идентификатор из данных (`item.id`).
Индекс допустим только для статичного списка, который никогда
не переупорядочивается и не фильтруется.

---

# .NET

## Чем value type отличается от reference type?

```yaml
category: dotnet
level: junior
difficulty: 2
slug: dotnet-value-vs-reference-types
tags: types, memory
companies: epam:2025:screening
```

**Value type** (`struct`, `int`, `bool`, `enum`) хранит само значение.
Живёт в стеке или внутри содержащего объекта, копируется при присваивании.

**Reference type** (`class`, `interface`, `delegate`, массивы) хранит
ссылку на объект в управляемой куче. При присваивании копируется ссылка,
а не объект — две переменные указывают на одни данные.

Отсюда следствия: сравнение по умолчанию (значение против ссылки),
поведение при передаче в метод и стоимость копирования больших структур.

## Что происходит под капотом async/await?

```yaml
category: dotnet
level: middle
difficulty: 4
slug: dotnet-async-await-internals
featured: true
tags: async, tasks
companies: sber:2025:technical, tinkoff:2024:technical
```

Компилятор превращает async-метод в конечный автомат (state machine).

1. Тело метода разбивается на состояния по точкам `await`.
2. Создаётся структура, реализующая `IAsyncStateMachine`.
3. При `await` незавершённой задачи метод возвращает управление
   вызывающему, а продолжение регистрируется как callback.
4. По завершении задачи автомат возобновляется — по умолчанию
   в захваченном `SynchronizationContext`.

**Ключевое:** `async` не создаёт поток. Для I/O ожидание вообще
не занимает поток — это главная причина роста пропускной способности.

`ConfigureAwait(false)` отключает возврат в исходный контекст —
в библиотеках это и производительность, и защита от дедлоков.

## Как устроен GC в .NET и что такое поколения?

```yaml
category: dotnet
level: senior
difficulty: 5
slug: dotnet-gc-generations
tags: gc, memory, performance
companies: microsoft:2024:technical, sber:2025:final
```

Сборщик мусора делит объекты на три поколения:

- **Gen 0** — новые объекты. Собирается часто и очень быстро.
- **Gen 1** — буфер между Gen 0 и Gen 2.
- **Gen 2** — долгоживущие объекты. Собирается редко и дорого.

Плюс **LOH** (Large Object Heap) для объектов больше 85 000 байт —
по умолчанию не компактится, отсюда фрагментация.

Гипотеза поколений: большинство объектов умирает молодыми, поэтому
дешевле часто проверять только Gen 0.

**Обычно копают в:** Server GC против Workstation, почему
`GC.Collect()` в проде — плохая идея, и как подписка на событие
без отписки приводит к утечкам.

---

# PostgreSQL

## Что такое индекс и когда он не поможет?

```yaml
category: postgresql
level: junior
difficulty: 2
slug: postgres-index-basics
featured: true
tags: indexes, performance
companies: ozon:2025:technical
```

Индекс — отдельная структура (обычно B-tree), дающая быстрый доступ
к строкам по значению колонки, без полного сканирования таблицы.

**Индекс не поможет, если:**
- Выборка возвращает значительную часть таблицы — seq scan дешевле.
- Колонка обёрнута функцией: `WHERE lower(email) = ...` не использует
  обычный индекс по `email` (нужен функциональный индекс).
- Условие с `LIKE '%text'` — ведущий wildcard.
- Низкая селективность: индекс по колонке с двумя значениями бесполезен.

Каждый индекс замедляет `INSERT` и `UPDATE` и занимает место — поэтому
их добавляют по фактическим планам запросов, а не «на всякий случай».

## Что такое MVCC и зачем нужен VACUUM?

```yaml
category: postgresql
level: middle
difficulty: 4
slug: postgres-mvcc-vacuum
tags: mvcc, vacuum, transactions
companies: yandex:2025:technical, avito:2024:technical
```

**MVCC** (Multi-Version Concurrency Control): `UPDATE` не меняет строку
на месте, а создаёт новую версию, помечая старую как устаревшую.
Читатели не блокируют писателей, а писатели — читателей.

Побочный эффект — «мёртвые» версии строк. Их убирает **VACUUM**:

- `VACUUM` — помечает место как переиспользуемое, работает под нагрузкой.
- `VACUUM FULL` — физически перестраивает таблицу, берёт эксклюзивную
  блокировку.
- `autovacuum` — делает это автоматически.

**Чем чревато отставание autovacuum:** table bloat, деградация планов
и в пределе wraparound по transaction id.

---

# DevOps

## Чем образ отличается от контейнера?

```yaml
category: devops
level: junior
difficulty: 1
slug: docker-image-vs-container
tags: docker
companies: epam:2025:screening
```

**Образ** — неизменяемый шаблон: слои файловой системы плюс метаданные
(команда запуска, переменные окружения, порты). Артефакт сборки.

**Контейнер** — запущенный экземпляр образа с writable-слоем поверх.
Из одного образа поднимается сколько угодно контейнеров.

Аналогия: образ — класс, контейнер — объект этого класса.

## Зачем нужна multi-stage сборка в Docker?

```yaml
category: devops
level: middle
difficulty: 3
slug: docker-multistage-build
featured: true
tags: docker, ci-cd
companies: ozon:2025:technical
```

Multi-stage разделяет сборку и рантайм, оставляя в финальном образе
только артефакт без инструментов сборки.

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "InterviewHub.Api.dll"]
```

**Выигрыш:** размер образа падает в разы, поверхность атаки меньше
(нет компилятора и исходников), а слои кэшируются эффективнее.

---

# Алгоритмы

## Что означает O(n log n) и какие алгоритмы так работают?

```yaml
category: algorithms
level: junior
difficulty: 2
slug: algo-big-o-basics
tags: complexity, sorting
companies: google:2024:screening, yandex:2025:screening
```

O-нотация описывает асимптотический рост числа операций
относительно размера входа.

**O(n log n)** — типичная сложность эффективных сортировок сравнением:
merge sort, heap sort, быстрая сортировка в среднем случае. Это доказанная
нижняя граница для сортировки, основанной на сравнениях.

Ориентиры: O(1) — доступ по индексу, O(log n) — бинарный поиск,
O(n) — один проход, O(n²) — вложенные циклы.

---

# System Design

## Какие стратегии инвалидации кэша вы знаете?

```yaml
category: system-design
level: senior
difficulty: 5
slug: sd-cache-invalidation
tags: caching, scalability
companies: google:2025:system-design, amazon:2024:system-design
```

**Основные подходы:**

- **TTL** — запись живёт фиксированное время. Просто, но данные устаревают.
- **Write-through** — пишем одновременно в кэш и в БД. Кэш всегда свежий,
  запись медленнее.
- **Write-behind** — пишем в кэш, в БД асинхронно. Быстро, но есть риск
  потери данных при падении.
- **Cache-aside** — приложение само читает и заполняет кэш. Самый частый
  вариант; требует аккуратной инвалидации при записи.
- **Event-based** — инвалидация по событию изменения данных.

**Что стоит упомянуть:** cache stampede (много промахов одновременно
по одному ключу) и защита от него — блокировка на пересчёт или
вероятностное раннее обновление.

---

# Soft Skills

## Расскажите о конфликте в команде и как вы его разрешили

```yaml
category: soft-skills
level: middle
difficulty: 2
slug: soft-conflict-in-team
tags: behavioral, teamwork
companies: amazon:2025:final, sber:2025:final
```

Отвечайте по схеме **STAR**: Situation, Task, Action, Result.

**Что хочет услышать интервьюер:**
- Вы отделяете позицию от личности и не переходите в обвинения.
- Вы искали факты и общую цель, а не «победу» в споре.
- Вы можете признать свою ошибку.
- Конфликт закончился решением, а не замалчиванием.

**Чего избегать:** рассказа, где виноваты исключительно другие,
и историй без результата. Даже неудачный опыт работает,
если вы сформулировали вывод.
