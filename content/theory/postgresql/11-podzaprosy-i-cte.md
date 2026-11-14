---
title: Подзапросы и CTE
slug: sql-podzaprosy-i-cte
track: dotnet-backend
section: postgresql
level: middle
sortOrder: 11
summary: Какие бывают подзапросы и как планировщик превращает их в semi- и anti-join, почему NOT IN ломается на NULL, как с PG 12 материализуются CTE, что умеют data-modifying и рекурсивные CTE и как защищаться от циклов.
questions: postgresql-chto-takoe-subquery, postgresql-chto-takoe-correlated-subquery, postgresql-exists-vs-in-chto-vybrat, postgresql-chto-takoe-cte, postgresql-chto-takoe-recursive-cte
---

Подзапрос — `SELECT` внутри другого запроса, CTE — тот же подзапрос, вынесенный в `WITH` и получивший имя. Для читателя SQL это вопрос структуры текста, для PostgreSQL — вопрос плана: один и тот же смысл, записанный через `IN`, `EXISTS`, `JOIN` или CTE, может дать одинаковый план, а может отличаться на порядки. На собеседовании проверяют именно это: что планировщик умеет переписать сам, где он бессилен и какие формы записи меняют результат, а не только скорость.

## Виды подзапросов

По тому, что подзапрос возвращает, различают три формы. **Скалярный** — ровно одна строка и одна колонка, используется как значение. Если строк ноль, результат `NULL`; если больше одной — ошибка `more than one row returned by a subquery used as an expression`, причём в рантайме, на тех данных, где дубль впервые появился. **Список** — одна колонка для `IN` и `= ANY`. **Табличный** (derived table) — подзапрос в `FROM`, который ведёт себя как временная выборка. Отдельно стоит `EXISTS`: ему важен только факт наличия строк, поэтому список колонок внутри (`SELECT 1` или `SELECT *`) не вычисляется и ни на что не влияет.

```sql
SELECT name, price - (SELECT avg(price) FROM products) AS diff
FROM products;

SELECT shop_id, avg(daily)
FROM (SELECT shop_id, created_at::date AS day, sum(amount) AS daily
      FROM orders GROUP BY shop_id, day) t
GROUP BY shop_id;
```

Второе деление важнее для производительности. **Некоррелированный** подзапрос не ссылается на внешний запрос и вычисляется один раз — в `EXPLAIN` это `InitPlan`. **Коррелированный** использует колонки внешней строки и логически выполняется для каждой из них — это `SubPlan`.

## Коррелированный подзапрос и SubPlan

Классический пример — дата последнего заказа каждого пользователя прямо в списке выборки:

```sql
SELECT u.id, u.name,
       (SELECT max(o.created_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at
FROM users u;
```

```text
Seq Scan on users u
  SubPlan 1
    ->  Result
          InitPlan 2
            ->  Limit
                  ->  Index Only Scan Backward using orders_user_created on orders o
                        Index Cond: ((user_id = u.id) AND (created_at IS NOT NULL))
```

Вывод иллюстративный. На 100 тысяч пользователей `SubPlan` выполнится 100 тысяч раз. С индексом `orders(user_id, created_at)` каждое выполнение — короткий спуск по индексу, и это приемлемо; без него — 100 тысяч проходов по `orders`. Как считать реальное время таких узлов через `loops`, разобрано в статье `EXPLAIN и план запроса`.

Скалярные подзапросы в `SELECT` и в сравнениях вроде `price > (SELECT avg(...) WHERE category_id = p.category_id)` планировщик в соединение не переписывает, они остаются `SubPlan`. Когда это тормозит, есть две альтернативы. Если данные нужны для всех внешних строк, выгоднее один раз посчитать агрегат и соединить его хешем. Если для немногих или нужна «первая строка по порядку» с несколькими колонками — `LATERAL` с индексом:

```sql
SELECT u.id, o.last_order_at
FROM users u
LEFT JOIN (SELECT user_id, max(created_at) AS last_order_at
           FROM orders GROUP BY user_id) o ON o.user_id = u.id;

SELECT u.id, o.id AS order_id, o.created_at, o.amount
FROM users u
LEFT JOIN LATERAL (
  SELECT id, created_at, amount FROM orders
  WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
) o ON true;
```

## Как планировщик разворачивает подзапросы

Часть подзапросов PostgreSQL переписывает до планирования. Простой подзапрос в `FROM` без агрегатов, `LIMIT` и подобного «поднимается» (pull up) и сливается с внешним запросом, так что фильтры и порядок соединений выбираются для всего запроса целиком. Подзапрос с `GROUP BY` поднять нельзя, но внешнее условие по колонкам группировки всё равно может быть протолкнуто внутрь.

`EXISTS` и `IN (SELECT ...)` превращаются в **semi-join** — соединение, которое возвращает внешнюю строку один раз, как только нашлась первая пара, и не размножает её при нескольких совпадениях. `NOT EXISTS` превращается в **anti-join** — внешняя строка возвращается, если пары нет. Метод (Hash, Merge, Nested Loop) выбирается по стоимости, как для обычного `JOIN`. Отсюда практический вывод: `IN (SELECT ...)` и `EXISTS` в PostgreSQL обычно дают один и тот же `Hash Semi Join`, и выбор между ними — вопрос читаемости. `JOIN` вместо них нужен, когда из второй таблицы требуются колонки; если нужен только факт наличия, обычный `JOIN` опасен дублями и лечится `DISTINCT`, который semi-join делает ненужным.

В EF Core `Where(u => db.Orders.Any(o => o.UserId == u.Id))` транслируется в `EXISTS`, а `ids.Contains(u.Id)` для массива в Npgsql — в `u.id = ANY(@ids)`. Второе важно: один prepared statement на любое число id вместо `IN (@p1, @p2, ...)` с разным текстом под каждую длину списка.

## NOT IN и NULL

Отрицание — место, где форма записи меняет результат. `x NOT IN (1, 2, NULL)` раскрывается в `x <> 1 AND x <> 2 AND x <> NULL`. Последнее сравнение даёт `NULL`, поэтому всё выражение никогда не равно `true`: строка не проходит фильтр ни при каком `x`.

```sql
SELECT * FROM users
WHERE id NOT IN (SELECT manager_id FROM users);
```

Достаточно одного сотрудника без руководителя (`manager_id IS NULL`) — и запрос «кто никем не руководит» вернёт ноль строк. `NOT EXISTS` проверяет наличие строки, а не сравнивает значения, поэтому от `NULL` не зависит:

```sql
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM users m WHERE m.manager_id = u.id);
```

Вторая проблема — план. Из-за этой семантики PostgreSQL не превращает `NOT IN (subquery)` в anti-join. Получается `hashed SubPlan`, если результат подзапроса помещается в `work_mem`, а если нет — обычный `SubPlan` с перебором для каждой внешней строки. `NOT EXISTS` даёт `Hash Anti Join` и масштабируется нормально.

| | `IN` / `EXISTS` | `NOT IN (subquery)` | `NOT EXISTS` |
| --- | --- | --- | --- |
| План | semi-join | hashed SubPlan или SubPlan | anti-join |
| С `NULL` в подзапросе | корректно | может вернуть пусто | корректно |

Для «нет пары» — всегда `NOT EXISTS`; `NOT IN` уместен только со списком констант.

## CTE и материализация

CTE даёт шагам вычисления имена и выстраивает их сверху вниз вместо вложенности:

```sql
WITH paid AS (
  SELECT user_id, sum(amount) AS total
  FROM orders WHERE status = 'paid'
  GROUP BY user_id
),
vip AS (
  SELECT user_id FROM paid WHERE total > 100000
)
SELECT u.id, u.email
FROM users u JOIN vip ON vip.user_id = u.id;
```

До PostgreSQL 12 каждый CTE вычислялся отдельно и целиком — был «optimization fence»: условия внешнего запроса внутрь не проталкивались, и `WITH t AS (SELECT * FROM orders) SELECT * FROM t WHERE id = 42` читал всю таблицу. С PG 12 нерекурсивный CTE без побочных эффектов (без изменения данных и volatile-функций), на который ссылаются один раз, встраивается в запрос как обычный подзапрос. Если ссылок несколько, CTE по умолчанию материализуется. Поведение задают явно:

```sql
WITH t AS MATERIALIZED (SELECT ...) SELECT ...;
WITH t AS NOT MATERIALIZED (SELECT ...) SELECT ...;
```

`MATERIALIZED` нужен, когда CTE дорогой и читается несколько раз или когда нужно намеренно зафиксировать порядок вычисления — старый приём «забора» теперь включается явно. `NOT MATERIALIZED` — когда внешний фильтр должен дойти до индекса внутри CTE, даже если ссылок несколько; цена — CTE вычисляется в каждом месте использования.

CTE — не временная таблица: у материализованного CTE нет индексов и полноценной статистики, и для большого результата планировщик может сильно ошибиться в оценке числа строк, а за ней — в выборе соединений выше. Если по большому промежуточному результату нужны индексы, честнее `CREATE TEMP TABLE` с `ANALYZE`.

## Data-modifying CTE

В `WITH` можно писать `INSERT`, `UPDATE` и `DELETE` с `RETURNING`. Перенос старых событий в архив одним атомарным запросом:

```sql
WITH moved AS (
  DELETE FROM events
  WHERE created_at < now() - interval '90 days'
  RETURNING *
)
INSERT INTO events_archive SELECT * FROM moved;
```

Правила стоит знать точно. Такой CTE выполняется ровно один раз и до конца, даже если основной запрос его не читает. Все части запроса работают с одним снимком данных: изменения одного CTE не видны другому CTE и основному запросу через таблицу, единственный канал передачи — `RETURNING`. Порядок применения изменений в разных частях не определён, поэтому обновлять одну и ту же строку из двух CTE одного запроса нельзя — результат непредсказуем.

## Рекурсивные CTE

`WITH RECURSIVE` состоит из нерекурсивной части (якорь, стартовые строки) и рекурсивной, которая ссылается на сам CTE, — через `UNION ALL` или `UNION`. Классическая задача — дерево категорий:

```sql
WITH RECURSIVE tree AS (
  SELECT id, parent_id, name, 1 AS depth, ARRAY[id] AS path
  FROM categories
  WHERE id = 10
  UNION ALL
  SELECT c.id, c.parent_id, c.name, t.depth + 1, t.path || c.id
  FROM categories c
  JOIN tree t ON c.parent_id = t.id
  WHERE NOT c.id = ANY(t.path) AND t.depth < 50
)
SELECT * FROM tree;
```

Выполняется это итеративно, а не рекурсивно. Якорь кладётся в рабочую таблицу и в результат. Рекурсивная часть видит в `tree` **только строки предыдущей итерации**, её новые строки становятся следующей рабочей таблицей и дописываются в результат. Цикл останавливается, когда шаг вернул ноль строк. В плане это `Recursive Union` с `WorkTable Scan`. Каждая итерация — отдельное соединение, поэтому индекс по колонке связи (`categories(parent_id)`) обязателен. Рекурсивный CTE всегда материализуется и не встраивается.

Если в данных есть цикл (A → B → A), `UNION ALL` будет крутиться бесконечно. Защиты, от простой к надёжной: `UNION` вместо `UNION ALL` отбрасывает уже виденные строки, но только полностью совпадающие — с колонкой `depth` или `path` строки на каждом круге разные, и это не спасает. Путь в массиве с проверкой `NOT c.id = ANY(t.path)`, как в примере, работает всегда. Ограничение глубины — страховка от ошибок в данных. С PG 14 есть стандартный синтаксис, который делает то же без ручного массива:

```sql
WITH RECURSIVE tree AS (
  SELECT id, parent_id, name FROM categories WHERE id = 10
  UNION ALL
  SELECT c.id, c.parent_id, c.name
  FROM categories c JOIN tree t ON c.parent_id = t.id
)
SEARCH DEPTH FIRST BY id SET ord
CYCLE id SET is_cycle USING cycle_path
SELECT * FROM tree WHERE NOT is_cycle ORDER BY ord;
```

`CYCLE` добавляет флаг и путь и прекращает обход на повторе, `SEARCH DEPTH FIRST` или `BREADTH FIRST` даёт колонку для сортировки в порядке обхода в глубину или в ширину — удобно для вывода дерева с отступами.

Из .NET такой запрос удобнее выполнять как готовый SQL — через Dapper или `Database.SqlQuery<T>` в EF Core 8+ — и материализовать результат без дополнительных LINQ-операторов поверх. Для больших иерархий, которые читают намного чаще, чем меняют, рассматривают альтернативы: материализованный путь через `ltree`, closure table или nested sets.

## Что стоит ответить на собеседовании

Подзапрос бывает скалярным, списком и табличным; некоррелированный вычисляется один раз (`InitPlan`), коррелированный — для каждой внешней строки (`SubPlan`). PostgreSQL сам поднимает простые подзапросы из `FROM` и превращает `IN` и `EXISTS` в semi-join, а `NOT EXISTS` — в anti-join, поэтому `IN (SELECT ...)` и `EXISTS` обычно равноценны. Для отрицания нужен `NOT EXISTS`: `NOT IN` с `NULL` в подзапросе возвращает пустой результат и не превращается в anti-join. CTE с PG 12 встраивается, если на него одна ссылка и нет побочных эффектов; `MATERIALIZED` и `NOT MATERIALIZED` задают поведение явно.

Сильный ответ объяснит, почему скалярный подзапрос в `SELECT` остаётся `SubPlan` и чем его заменить — агрегатом с `JOIN` или `LATERAL`, — напомнит, что CTE не временная таблица и без статистики может испортить оценки, и знает правила data-modifying CTE: выполнение ровно один раз, общий снимок, обмен только через `RETURNING`. Про рекурсивные CTE — итеративное выполнение с рабочей таблицей, индекс по колонке связи, защита от циклов массивом пути или `CYCLE` с PG 14 и почему `UNION` вместо `UNION ALL` не спасает, если в строке есть глубина или путь.
