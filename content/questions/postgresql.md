# PostgreSQL / SQL

Вопросы категории `postgresql` в формате импорта (`tools/questions.md`): 103 шт.

```bash
node tools/import-questions.mjs --file content/questions/postgresql.md --dry-run
node tools/import-questions.mjs --file content/questions/postgresql.md --url … --email … --update
```

---

## Чем `INNER JOIN` отличается от `LEFT JOIN`?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-chem-inner-join-otlichaetsya-ot-left-join
tags: sql
```

`INNER JOIN` возвращает только пары строк, для которых условие соединения выполнилось. `LEFT JOIN` возвращает **все** строки левой таблицы; если справа пары не нашлось, правые колонки заполняются `NULL`.

```sql
-- только пользователи, у которых есть заказы
SELECT u.id, o.id AS order_id
FROM users u
JOIN orders o ON o.user_id = u.id;

-- все пользователи; у кого заказов нет — order_id = NULL
SELECT u.id, o.id AS order_id
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;
```

**Кратность.** Оба варианта могут размножать строки: пользователь с тремя заказами даст три строки. `LEFT JOIN` лишь гарантирует, что левая строка появится хотя бы один раз.

**Классическая ловушка — условие на правую таблицу в `WHERE`:**

```sql
SELECT u.id, o.id
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.status = 'paid';     -- превратило LEFT JOIN в INNER
```

Для «пустых» пользователей `o.status` равно `NULL`, `NULL = 'paid'` не true, и строка отбрасывается. Если нужно «всех пользователей и только оплаченные заказы», условие переносят в `ON`:

```sql
LEFT JOIN orders o ON o.user_id = u.id AND o.status = 'paid'
```

Планировщик PostgreSQL сам замечает такой случай (strict-условие по nullable-стороне) и понижает `LEFT JOIN` до `INNER`, что видно в `EXPLAIN` как `Hash Join` вместо `Hash Left Join`.

**Anti-join.** `LEFT JOIN ... WHERE right.id IS NULL` — способ найти строки без пары («пользователи без заказов»). Аналог — `NOT EXISTS`, в плане оба дают `Hash Anti Join`.

**Что спрашивают дальше:** порядок соединения для `INNER JOIN` планировщик выбирает свободно, для `LEFT JOIN` свобода ограничена; как агрегаты (`COUNT(o.id)` против `COUNT(*)`) ведут себя после `LEFT JOIN` — `COUNT(*)` посчитает строку с `NULL` как 1, `COUNT(o.id)` — как 0.

## Чем `LEFT JOIN` отличается от `RIGHT JOIN`?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-chem-left-join-otlichaetsya-ot-right-join
tags: sql
```

Это зеркальные операции: `LEFT JOIN` сохраняет все строки левой таблицы, `RIGHT JOIN` — все строки правой. `A RIGHT JOIN B` полностью эквивалентен `B LEFT JOIN A` (с точностью до порядка колонок в `SELECT *`).

```sql
SELECT o.id, u.name
FROM orders o
RIGHT JOIN users u ON u.id = o.user_id;

-- то же самое
SELECT o.id, u.name
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;
```

**Почему на практике почти всегда пишут `LEFT`.** Запрос читают слева направо: «основная» таблица в `FROM`, остальные прицепляются к ней. С `RIGHT JOIN` приходится мысленно разворачивать запрос, особенно когда соединений несколько:

```sql
FROM a
JOIN b ON ...
RIGHT JOIN c ON ...   -- сохраняются все строки c, а не a
```

Здесь `RIGHT JOIN` применяется к результату `a JOIN b`, и строки `a` без пары в `c` пропадут — это часто неожиданно. Многие style guide прямо запрещают `RIGHT JOIN`.

**Для планировщика разницы нет.** PostgreSQL сам решает, какую сторону хешировать, и может превратить `Hash Left Join` в `Hash Right Join` — в `EXPLAIN` вы увидите `Hash Right Join`, даже если писали `LEFT JOIN`. Это означает лишь, что хеш-таблица построена по сохраняемой стороне, а не то, что семантика изменилась.

**Итог для собеседования:** семантически одно и то же с переставленными таблицами, выбор — вопрос читаемости; `RIGHT JOIN` уместен редко, например когда к длинной цепочке соединений нужно в конце «докинуть» полный справочник.

## Что такое `FULL OUTER JOIN`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-full-outer-join
tags: sql
```

`FULL OUTER JOIN` возвращает все строки обеих таблиц: совпавшие пары соединяются, а строки без пары с любой стороны попадают в результат с `NULL` в колонках другой стороны. По сути это объединение `LEFT JOIN` и `RIGHT JOIN`.

```sql
SELECT coalesce(a.sku, b.sku) AS sku,
       a.qty AS warehouse_qty,
       b.qty AS erp_qty
FROM warehouse_stock a
FULL JOIN erp_stock b ON b.sku = a.sku
WHERE a.sku IS NULL          -- есть только в ERP
   OR b.sku IS NULL          -- есть только на складе
   OR a.qty <> b.qty;        -- расхождение
```

**Типичные задачи:**

- сверка двух источников (выгрузка против БД, склад против ERP);
- слияние двух временных рядов по дате, когда в каждом есть пропуски;
- сравнение «было/стало» между снапшотами.

**Ключ через `COALESCE`.** Для строк без пары ключ одной из сторон равен `NULL`, поэтому общий ключ берут как `coalesce(a.key, b.key)`. Альтернатива — `USING (sku)`: тогда колонка `sku` в результате уже объединённая.

**Ограничения в PostgreSQL.** `FULL JOIN` поддерживается только с условием, пригодным для merge join или hash join, — то есть по сути с равенствами (`=`). Условие вроде `ON a.x < b.y` даст ошибку `FULL JOIN is only supported with merge-joinable or hash-joinable join conditions`. Nested Loop для `FULL JOIN` не используется.

**Производительность.** Индексы тут помогают слабо: всё равно нужно прочитать обе таблицы целиком, план — `Hash Full Join` или `Merge Full Join`. На больших таблицах это полный проход по обеим.

**Ловушка с `WHERE`:** условие по колонке одной стороны (`WHERE a.region = 'EU'`) выкинет строки, где эта сторона `NULL`, и `FULL JOIN` фактически станет `LEFT`. Фильтры по отдельным таблицам лучше делать в подзапросах до соединения.

## Что такое `CROSS JOIN`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-cross-join
tags: sql
```

`CROSS JOIN` — декартово произведение: каждая строка первой таблицы соединяется с каждой строкой второй, без условия. Из `m` и `n` строк получается `m × n`.

```sql
SELECT s.size, c.color
FROM sizes s
CROSS JOIN colors c;       -- все комбинации размер × цвет

-- эквивалентные записи
SELECT * FROM sizes, colors;
SELECT * FROM sizes JOIN colors ON true;
```

**Где это действительно нужно:**

- **Генерация комбинаций** — матрица вариантов товара, все пары «день × магазин» для отчёта, чтобы потом `LEFT JOIN`-ом подтянуть факты и получить нули там, где продаж не было:

```sql
SELECT d::date, s.id, coalesce(sum(o.amount), 0)
FROM generate_series('2025-01-01'::date, '2025-01-31', '1 day') d
CROSS JOIN shops s
LEFT JOIN orders o ON o.shop_id = s.id AND o.created_at::date = d
GROUP BY 1, 2;
```

- **Присоединение одной строки** с параметрами или агрегатом ко всем строкам: `CROSS JOIN (SELECT avg(price) AS avg_price FROM products) x`.
- **`CROSS JOIN LATERAL`** — для каждой строки слева вызывается подзапрос или функция, зависящие от неё (`jsonb_array_elements`, top-N на группу).

**Опасность.** Случайный `CROSS JOIN` — частая причина «запрос висит и съел диск»: забыли условие соединения в старом синтаксисе `FROM a, b WHERE ...`, и две таблицы по миллиону строк дали 10¹² строк. В `EXPLAIN` это видно как `Nested Loop` без `Join Filter` и огромная оценка `rows`.

**Для планировщика** `FROM a, b` и `CROSS JOIN` одинаковы — это просто соединение без условия; реализуется через Nested Loop, часто с `Materialize` на внутренней стороне.

## Что такое `WHERE`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-where
```

`WHERE` — условие фильтрации строк: в результат попадают только строки, для которых выражение вернуло `true`. Строки, где оно дало `false` **или `NULL`**, отбрасываются.

```sql
SELECT id, email
FROM users
WHERE status = 'active'
  AND created_at >= now() - interval '30 days';
```

**Где стоит в логическом порядке выполнения:** `FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT`. Отсюда следствия:

- в `WHERE` нельзя использовать агрегаты (`WHERE count(*) > 1` — ошибка, для этого `HAVING`);
- нельзя сослаться на алиас из `SELECT` (`WHERE total > 100`, где `total` — алиас, не сработает);
- нельзя использовать оконные функции — их фильтруют во внешнем запросе.

**Трёхзначная логика.** `WHERE price <> 100` не вернёт строки с `price IS NULL`. `WHERE NOT (a = b)` тоже не вернёт строки, где одно из значений `NULL`. Для сравнения с учётом `NULL` — `IS DISTINCT FROM`.

**`WHERE` и индексы (sargability).** Индекс используется, когда условие имеет вид «колонка оператор константа». Обёртка колонки в функцию ломает это:

```sql
WHERE created_at::date = '2025-01-15'           -- индекс по created_at не поможет
WHERE created_at >= '2025-01-15'
  AND created_at <  '2025-01-16'                -- поможет

WHERE lower(email) = 'a@b.c'                    -- нужен индекс по lower(email)
```

**`WHERE` в `UPDATE`/`DELETE`.** Та же семантика, но цена ошибки выше: забытый `WHERE` обновит всю таблицу. Хорошая привычка — сначала выполнить `SELECT` с тем же условием или работать внутри транзакции.

**Пересечение с `ON`.** Для `INNER JOIN` условие в `ON` и в `WHERE` эквивалентно, для `LEFT JOIN` — нет: условие по правой таблице в `WHERE` отбрасывает строки без пары.

## Чем `WHERE` отличается от `HAVING`?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-chem-where-otlichaetsya-ot-having
tags: sql
```

`WHERE` фильтрует **строки до группировки**, `HAVING` — **группы после** `GROUP BY` и вычисления агрегатов. Поэтому агрегаты допустимы в `HAVING` и запрещены в `WHERE`.

```sql
SELECT user_id, count(*) AS orders, sum(amount) AS total
FROM orders
WHERE status = 'paid'                 -- отсекаем строки
  AND created_at >= '2025-01-01'
GROUP BY user_id
HAVING count(*) >= 5                  -- отсекаем группы
   AND sum(amount) > 10000;
```

| | `WHERE` | `HAVING` |
| --- | --- | --- |
| Когда применяется | до `GROUP BY` | после `GROUP BY` |
| Что фильтрует | строки | группы |
| Агрегаты | нельзя | можно |
| Использует индексы | да | нет, работает с результатом агрегации |

**Правило производительности:** всё, что можно отфильтровать до группировки, пишите в `WHERE`. Условие `HAVING user_id > 1000` формально корректно, но заставляет сначала агрегировать всё. На практике PostgreSQL сам переносит в `WHERE` условия `HAVING`, не содержащие агрегатов, но полагаться на это как на стиль не стоит — читающему запрос неочевидно.

**`HAVING` без `GROUP BY`.** Допустим: вся таблица считается одной группой.

```sql
SELECT count(*) FROM orders HAVING count(*) > 0;   -- 0 или 1 строка
```

**Алиасы.** В PostgreSQL в `HAVING` нельзя ссылаться на алиас из `SELECT` (`HAVING total > 100` — ошибка «column does not exist»), нужно повторить выражение `sum(amount)`. В `GROUP BY` и `ORDER BY` алиасы можно.

**`FILTER` вместо лишних подзапросов.** Если нужно посчитать разные подмножества в одной группе, используют агрегат с фильтром, а не `HAVING`:

```sql
SELECT user_id,
       count(*) FILTER (WHERE status = 'paid')      AS paid,
       count(*) FILTER (WHERE status = 'cancelled') AS cancelled
FROM orders
GROUP BY user_id
HAVING count(*) FILTER (WHERE status = 'cancelled') > 3;
```

## Что такое `GROUP BY`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-group-by
tags: sql
```

`GROUP BY` разбивает строки на группы с одинаковыми значениями указанных выражений и превращает каждую группу в одну строку результата. Для остальных колонок нужны агрегатные функции: `count`, `sum`, `avg`, `min`, `max`, `array_agg`, `string_agg`.

```sql
SELECT shop_id, date_trunc('month', created_at) AS month,
       count(*) AS orders, sum(amount) AS revenue
FROM orders
GROUP BY shop_id, month
ORDER BY shop_id, month;
```

**Правило колонок.** Каждая колонка в `SELECT` должна быть либо в `GROUP BY`, либо внутри агрегата. Исключение PostgreSQL: если сгруппировали по первичному ключу таблицы, остальные её колонки можно выбирать без агрегата — они функционально зависят от ключа.

```sql
SELECT u.id, u.name, u.email, count(o.id)
FROM users u LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id;          -- ok, u.id — PK
```

**`NULL` образуют одну группу** — в отличие от сравнения `NULL = NULL`, для группировки они считаются одинаковыми.

**Как выполняется:**

- `HashAggregate` — строит хеш-таблицу по ключам группировки; быстро, но требует памяти (`work_mem × hash_mem_multiplier`, по умолчанию множитель 2.0). С PostgreSQL 13 при нехватке памяти умеет сбрасывать данные на диск.
- `GroupAggregate` — работает по отсортированному потоку, группа за группой; подходит, если данные уже упорядочены индексом.

**Продвинутые варианты:** `GROUPING SETS`, `ROLLUP`, `CUBE` — несколько уровней агрегации за один проход (итоги по магазину, по месяцу и общий итог). Функция `GROUPING()` отличает строку-итог от обычного `NULL`.

**Частые ошибки:** `count(column)` не считает `NULL`, `count(*)` считает все строки; после `LEFT JOIN` это даёт разные результаты. Группировка по `created_at` вместо `date_trunc(...)` даёт по группе на каждое значение времени.

## Как работает `ORDER BY`?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-rabotaet-order-by
```

`ORDER BY` задаёт порядок строк в результате. Без него порядок **не гарантирован** — даже если сейчас строки приходят «по id», после `VACUUM`, параллельного плана или synchronized seqscan он может измениться.

```sql
SELECT id, name, price
FROM products
ORDER BY price DESC NULLS LAST, id;
```

**Что можно указать:**

- `ASC` (по умолчанию) / `DESC`;
- `NULLS FIRST` / `NULLS LAST` — в PostgreSQL `NULL` считается больше любого значения, поэтому по умолчанию при `ASC` они в конце, при `DESC` — в начале;
- выражение, алиас из `SELECT` или номер колонки (`ORDER BY 2`, но это хрупко);
- `COLLATE` — правила сравнения строк; от collation зависят и порядок, и скорость (`"C"` быстрее локалезависимых).

**Как выполняется:**

| Способ | Когда |
| --- | --- |
| Чтение индекса по порядку | есть B-tree с подходящим порядком колонок; можно остановиться после `LIMIT` |
| `Sort` в памяти (quicksort) | данные помещаются в `work_mem` |
| `top-N heapsort` | есть `LIMIT`, держит в памяти только N строк |
| External merge на диске | данные больше `work_mem`, в `EXPLAIN ANALYZE` — `Sort Method: external merge Disk: ...` |
| `Incremental Sort` (PG 13+) | данные уже отсортированы по префиксу ключа |

```text
Sort  (actual time=812.4..950.1 rows=1000000)
  Sort Key: created_at DESC
  Sort Method: external merge  Disk: 48216kB
```

Увидели `external merge` — либо поднимите `work_mem` для этого запроса, либо создайте индекс, отдающий нужный порядок.

**Индекс и направление.** B-tree читается в обе стороны, поэтому индекс `(created_at)` обслуживает и `ASC`, и `DESC`. Но для смешанного порядка `ORDER BY a ASC, b DESC` нужен индекс `(a, b DESC)`.

**Детерминизм.** Сортировка по неуникальной колонке (`ORDER BY created_at`) не определяет порядок одинаковых значений — при пагинации строки будут прыгать между страницами. Добавляйте уникальный tie-breaker: `ORDER BY created_at, id`.

## Что такое `DISTINCT`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-distinct
tags: sql
```

`DISTINCT` убирает из результата полностью совпадающие строки (по всем выбранным колонкам). `NULL` при этом считаются равными друг другу.

```sql
SELECT DISTINCT country FROM users;
SELECT DISTINCT country, city FROM users;       -- уникальные пары
SELECT count(DISTINCT user_id) FROM orders;     -- число уникальных покупателей
```

**`DISTINCT ON` — расширение PostgreSQL.** Оставляет по одной строке на каждое значение выражения, причём какую именно — определяет `ORDER BY`. Удобный способ взять «последнюю запись на группу»:

```sql
SELECT DISTINCT ON (user_id) user_id, id, created_at, amount
FROM orders
ORDER BY user_id, created_at DESC;   -- последний заказ каждого пользователя
```

`ORDER BY` обязан начинаться с тех же выражений, что в `DISTINCT ON`, иначе ошибка. Без дополнительной сортировки выбранная строка в группе произвольна.

**Как выполняется.** Через `HashAggregate` (хеш уникальных значений) или через `Sort` + `Unique`. Обе операции требуют обработать весь набор, поэтому `DISTINCT` на миллионах строк — это дорого.

**`DISTINCT` как пластырь.** Частый антипаттерн — `JOIN` размножил строки, и вместо исправления условия добавили `DISTINCT`. Это скрывает ошибку и тратит ресурсы на сортировку. Если нужно «пользователи, у которых есть заказ», правильнее `EXISTS`:

```sql
-- плохо
SELECT DISTINCT u.* FROM users u JOIN orders o ON o.user_id = u.id;
-- лучше
SELECT u.* FROM users u WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);
```

**`count(DISTINCT ...)`** не параллелится и не использует HashAggregate — всегда сортирует внутри агрегата. На больших объёмах бывает быстрее подзапрос `SELECT count(*) FROM (SELECT DISTINCT user_id ...)`.

**Ограничение:** `DISTINCT` не работает с типами без оператора равенства — например, `json` (а `jsonb` работает).

## Чем `UNION` отличается от `UNION ALL`?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-chem-union-otlichaetsya-ot-union-all
tags: sql
```

`UNION` объединяет результаты двух запросов и **удаляет дубликаты**, `UNION ALL` просто склеивает их, сохраняя все строки. `UNION ALL` дешевле: ему не нужны сортировка или хеширование для устранения повторов.

```sql
SELECT email FROM customers
UNION
SELECT email FROM subscribers;      -- уникальные email

SELECT 'order' AS kind, id, created_at FROM orders
UNION ALL
SELECT 'refund', id, created_at FROM refunds;   -- общая лента событий
```

| | `UNION` | `UNION ALL` |
| --- | --- | --- |
| Дубликаты | удаляются (в т.ч. внутри одного запроса) | сохраняются |
| План | `Append` + `HashAggregate` или `Sort` + `Unique` | только `Append` |
| Потоковость | нужно обработать всё до выдачи | строки отдаются сразу, `LIMIT` останавливает ранний |
| Порядок | не гарантирован | не гарантирован |

**Правило:** по умолчанию пишите `UNION ALL`. `UNION` — только когда дубликаты реально возможны и не нужны. Если ветки заведомо не пересекаются (в примере выше колонка `kind` различает источники), `UNION` тратит ресурсы впустую.

**Требования к веткам:** одинаковое число колонок, совместимые типы; имена колонок берутся из первого запроса. `ORDER BY` и `LIMIT` в конце применяются ко всему результату; для сортировки отдельной ветки её берут в скобки.

```sql
(SELECT id FROM a ORDER BY created_at DESC LIMIT 10)
UNION ALL
(SELECT id FROM b ORDER BY created_at DESC LIMIT 10);
```

**Родственные операции:** `INTERSECT` (пересечение) и `EXCEPT` (разность), у них тоже есть варианты `ALL`.

**Практика:** замена `OR` по разным колонкам на `UNION ALL` двух запросов иногда позволяет использовать два разных индекса — хотя PostgreSQL часто справляется сам через `BitmapOr`.

## Что такое subquery?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-subquery
tags: sql
```

Subquery (подзапрос) — `SELECT`, вложенный в другой запрос. Он может стоять в `WHERE`, `FROM`, `SELECT` и возвращать одно значение, список или целую таблицу.

**Виды по результату:**

```sql
-- скалярный: ровно одна строка и одна колонка
SELECT name, price, price - (SELECT avg(price) FROM products) AS diff
FROM products;

-- список для IN / ANY
SELECT * FROM orders
WHERE user_id IN (SELECT id FROM users WHERE country = 'DE');

-- табличный (derived table) в FROM
SELECT shop_id, avg(daily)
FROM (SELECT shop_id, created_at::date, sum(amount) AS daily
      FROM orders GROUP BY 1, 2) t
GROUP BY shop_id;

-- EXISTS: только факт наличия строк
SELECT * FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);
```

Скалярный подзапрос, вернувший больше одной строки, падает с ошибкой `more than one row returned by a subquery used as an expression`; вернувший ноль строк даёт `NULL`.

**Коррелированный и некоррелированный.** Некоррелированный не ссылается на внешний запрос и вычисляется один раз (`InitPlan` в `EXPLAIN`). Коррелированный использует колонки внешней строки и логически выполняется для каждой из них (`SubPlan`).

**Что делает планировщик.** PostgreSQL умеет «поднимать» (pull up) подзапросы в `FROM` и превращать `IN`/`EXISTS` в semi-join, `NOT EXISTS` — в anti-join. Поэтому `IN (SELECT ...)` и эквивалентный `JOIN` часто дают одинаковый план. Хуже оптимизируются скалярные подзапросы в `SELECT` — они остаются `SubPlan`.

**Подзапрос или CTE или JOIN.** Для одноразового использования разницы в производительности обычно нет — с PostgreSQL 12 CTE тоже встраиваются. Выбор — читаемость. Выберите `JOIN`, если нужны колонки из обеих таблиц, `EXISTS` — если нужен только факт наличия.

**Ловушка:** `NOT IN (subquery)`, в котором встречается `NULL`, возвращает пустой результат — используйте `NOT EXISTS`.

## Что такое correlated subquery?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-correlated-subquery
tags: sql
```

Коррелированный подзапрос ссылается на колонки внешнего запроса, поэтому логически вычисляется заново для каждой строки внешнего запроса. В `EXPLAIN` он виден как `SubPlan`.

```sql
-- последний заказ каждого пользователя
SELECT u.id, u.name,
       (SELECT max(o.created_at)
        FROM orders o
        WHERE o.user_id = u.id) AS last_order_at     -- u.id — ссылка наружу
FROM users u;
```

**Почему это может быть медленно.** Для 100 000 пользователей подзапрос выполнится 100 000 раз. Если есть индекс `orders(user_id, created_at)`, каждое выполнение — быстрый Index Only Scan, и итог приемлем. Без индекса — 100 000 проходов по `orders`, то есть катастрофа.

```text
Seq Scan on users u
  SubPlan 1
    ->  Result
          InitPlan 2 (returns $1)
            ->  Limit
                  ->  Index Only Scan Backward using orders_user_created on orders o
                        Index Cond: ((user_id = u.id) AND (created_at IS NOT NULL))
```

**Какие коррелированные подзапросы PostgreSQL переписывает сам:**

- `EXISTS` / `NOT EXISTS` → semi-join / anti-join (Hash, Merge или Nested Loop — на выбор планировщика);
- `IN (SELECT ...)` → semi-join.

Скалярные подзапросы в `SELECT` и в сравнениях (`WHERE price > (SELECT avg(...) WHERE ... = outer.x)`) обычно остаются `SubPlan`.

**Альтернативы, когда `SubPlan` тормозит:**

```sql
-- агрегат один раз + JOIN
SELECT u.id, u.name, o.last_order_at
FROM users u
LEFT JOIN (SELECT user_id, max(created_at) AS last_order_at
           FROM orders GROUP BY user_id) o ON o.user_id = u.id;

-- LATERAL — явная корреляция, но может вернуть несколько колонок
SELECT u.id, o.*
FROM users u
LEFT JOIN LATERAL (
  SELECT id, created_at, amount FROM orders
  WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
) o ON true;
```

Выбор зависит от соотношения: если нужны данные для немногих внешних строк — подзапрос/`LATERAL` с индексом; если для всех — агрегат с hash join обычно выигрывает.

## `EXISTS` vs `IN` — что выбрать?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-exists-vs-in-chto-vybrat
```

Для положительной проверки (`EXISTS` против `IN (SELECT ...)`) в PostgreSQL разница обычно нулевая: оба превращаются в semi-join. Выбор важен для **отрицания**: `NOT IN` ломается на `NULL` и хуже оптимизируется, поэтому для «нет пары» используйте `NOT EXISTS`.

```sql
-- эквивалентны, план обычно одинаковый (Hash Semi Join / Nested Loop Semi Join)
SELECT * FROM users u WHERE u.id IN (SELECT o.user_id FROM orders o);
SELECT * FROM users u WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);
```

**Проблема `NOT IN` и `NULL`.** `x NOT IN (1, 2, NULL)` раскрывается в `x <> 1 AND x <> 2 AND x <> NULL`. Последнее — `NULL`, значит всё выражение никогда не бывает `true`:

```sql
SELECT * FROM users
WHERE id NOT IN (SELECT manager_id FROM users);  -- если есть хоть один manager_id = NULL → 0 строк
```

`NOT EXISTS` проверяет только наличие строк и `NULL` не боится.

**Проблема `NOT IN` и производительности.** Из-за семантики `NULL` PostgreSQL не может превратить `NOT IN (subquery)` в anti-join. Вместо этого получается `hashed SubPlan` (если результат подзапроса помещается в `work_mem`) или, хуже, обычный `SubPlan` — линейный перебор для каждой строки. `NOT EXISTS` даёт `Hash Anti Join`.

| | `IN` / `EXISTS` | `NOT IN` | `NOT EXISTS` |
| --- | --- | --- | --- |
| План | semi-join | hashed SubPlan / SubPlan | anti-join |
| Поведение с `NULL` | корректное | может вернуть пусто | корректное |

**Когда `IN` уместен и удобен:**

- список констант: `WHERE status IN ('new', 'paid')`;
- параметр-массив из приложения: `WHERE id = ANY(@ids)` — в Npgsql так передают `int[]`, один prepared statement на любое количество id вместо генерации `IN (@p1, @p2, ...)`.

**Что ещё спрашивают:** в `EXISTS` неважно, что написано в `SELECT` (`SELECT 1`, `SELECT *`) — колонки не вычисляются. Для очень длинных списков констант `IN (...)` на тысячи значений разбирается и планируется медленно; лучше массив или `JOIN` к `VALUES`/временной таблице.

## Что такое CTE?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-cte
tags: sql
```

CTE (Common Table Expression) — именованный подзапрос, объявленный через `WITH` перед основным запросом. Он делает сложный запрос читаемым: шаги вычислений получают имена и идут сверху вниз, а не вкладываются друг в друга.

```sql
WITH paid AS (
  SELECT user_id, sum(amount) AS total
  FROM orders
  WHERE status = 'paid'
  GROUP BY user_id
),
vip AS (
  SELECT user_id FROM paid WHERE total > 100000
)
SELECT u.id, u.email
FROM users u
JOIN vip ON vip.user_id = u.id;
```

**Материализация: до и после PostgreSQL 12.** До 12-й версии CTE всегда вычислялся отдельно и целиком («optimization fence»): условия из внешнего запроса внутрь не проталкивались. С 12-й версии нерекурсивный CTE без побочных эффектов, на который ссылаются один раз, **встраивается** в запрос как обычный подзапрос. Поведение можно задать явно:

```sql
WITH t AS MATERIALIZED (SELECT ...)      -- вычислить один раз, как раньше
WITH t AS NOT MATERIALIZED (SELECT ...)  -- встроить, даже если ссылок несколько
```

`MATERIALIZED` полезен, когда CTE дорогой и используется несколько раз, или когда нужно запретить планировщику «умничать». `NOT MATERIALIZED` — когда внешний фильтр должен дойти до индекса внутри CTE.

**Data-modifying CTE.** В `WITH` можно писать `INSERT/UPDATE/DELETE ... RETURNING` — например, перенос строк в архив одним запросом:

```sql
WITH moved AS (
  DELETE FROM events WHERE created_at < now() - interval '90 days'
  RETURNING *
)
INSERT INTO events_archive SELECT * FROM moved;
```

Такие CTE выполняются ровно один раз и до конца, даже если основной запрос их не читает. Все подзапросы видят один снимок данных, поэтому изменения одного CTE не видны другому в том же запросе.

**Рекурсивные CTE** (`WITH RECURSIVE`) — отдельная тема: обход деревьев и графов.

**Что уточняют на собеседовании:** CTE — не временная таблица, у него нет индексов и статистики; при материализации большого CTE планировщик плохо оценивает число его строк.

## Что такое recursive CTE?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-recursive-cte
tags: sql
```

Recursive CTE — `WITH RECURSIVE`, в котором запрос ссылается сам на себя. Состоит из двух частей: **нерекурсивной** (стартовые строки) и **рекурсивной** (как из текущих строк получить следующие), соединённых `UNION ALL` или `UNION`. Используется для деревьев, графов и генерации последовательностей.

```sql
-- все подчинённые руководителя 42 на любой глубине
WITH RECURSIVE subordinates AS (
  SELECT id, manager_id, name, 1 AS depth
  FROM employees
  WHERE id = 42                                   -- якорь
  UNION ALL
  SELECT e.id, e.manager_id, e.name, s.depth + 1
  FROM employees e
  JOIN subordinates s ON e.manager_id = s.id      -- шаг
)
SELECT * FROM subordinates;
```

**Как выполняется (итеративно, а не рекурсивно):**

1. Выполняется якорь, результат кладётся в рабочую таблицу и в итог.
2. Рекурсивная часть выполняется, где `subordinates` — это **только строки предыдущей итерации**.
3. Новые строки становятся рабочей таблицей и добавляются в итог.
4. Повтор, пока шаг не вернёт ноль строк.

В `EXPLAIN` это `Recursive Union` с `WorkTable Scan`.

**Циклы.** Если в данных есть цикл (A → B → A), `UNION ALL` будет крутиться бесконечно. Варианты защиты:

- `UNION` вместо `UNION ALL` — отбрасывает уже виденные строки (работает, только если строки полностью совпадают, т.е. без `depth`);
- путь в массиве и проверка `WHERE NOT e.id = ANY(s.path)`;
- с PostgreSQL 14 — стандартные `CYCLE` и `SEARCH`:

```sql
WITH RECURSIVE g AS (
  SELECT id, parent_id FROM nodes WHERE id = 1
  UNION ALL
  SELECT n.id, n.parent_id FROM nodes n JOIN g ON n.parent_id = g.id
) CYCLE id SET is_cycle USING path
SELECT * FROM g WHERE NOT is_cycle;
```

- страховка на глубину: `WHERE s.depth < 100`.

**Производительность.** Каждая итерация — отдельное соединение, поэтому нужен индекс по колонке связи (`employees(manager_id)`). Для очень больших иерархий, которые часто читают, рассматривают альтернативы: `ltree` (материализованный путь), closure table, nested sets.

**Другие применения:** генерация рядов (хотя для чисел и дат проще `generate_series`), «loose index scan» — быстрый `DISTINCT` по индексированной колонке с малым числом значений через рекурсивный поиск следующего значения.

## Что такое window functions?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-window-functions
tags: sql
```

Оконные функции вычисляют значение для каждой строки на основе набора связанных с ней строк («окна»), **не схлопывая** строки, как это делает `GROUP BY`. Синтаксис — функция плюс `OVER (...)`.

```sql
SELECT id, user_id, amount, created_at,
       sum(amount)  OVER (PARTITION BY user_id)                        AS user_total,
       row_number() OVER (PARTITION BY user_id ORDER BY created_at)    AS n,
       sum(amount)  OVER (PARTITION BY user_id ORDER BY created_at)    AS running_total,
       lag(amount)  OVER (PARTITION BY user_id ORDER BY created_at)    AS prev_amount
FROM orders;
```

**Составляющие `OVER`:**

- `PARTITION BY` — на какие группы делить (как `GROUP BY`, но строки остаются);
- `ORDER BY` — порядок внутри раздела;
- frame (`ROWS` / `RANGE` / `GROUPS BETWEEN ...`) — какие строки раздела входят в окно для текущей строки.

**Типы функций:**

| Группа | Примеры |
| --- | --- |
| Ранжирование | `row_number`, `rank`, `dense_rank`, `percent_rank`, `ntile` |
| Смещение | `lag`, `lead`, `first_value`, `last_value`, `nth_value` |
| Агрегаты как оконные | `sum`, `avg`, `count`, `min`, `max` |

**Ловушка с рамкой по умолчанию.** Если в окне есть `ORDER BY`, рамка по умолчанию — `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. Отсюда два сюрприза:

- `sum(...) OVER (ORDER BY created_at)` — это накопительная сумма, а не общая; причём строки с одинаковым `created_at` (peers) попадут в неё одновременно;
- `last_value(x) OVER (ORDER BY ...)` возвращает текущую строку, а не последнюю в разделе. Нужно явно `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.

**Скользящее среднее за 7 строк:**

```sql
avg(amount) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
```

**Где стоят в порядке выполнения:** после `WHERE`, `GROUP BY` и `HAVING`, до `DISTINCT`, `ORDER BY` и `LIMIT`. Поэтому фильтровать по результату оконной функции можно только во внешнем запросе (`SELECT * FROM (...) t WHERE n <= 3`).

**Именованные окна** уменьшают дублирование: `... OVER w ... WINDOW w AS (PARTITION BY user_id ORDER BY created_at)`.

**Производительность:** оконная функция требует сортировки по `PARTITION BY` + `ORDER BY` (узел `WindowAgg` над `Sort`); индекс с тем же порядком позволяет избежать сортировки.

## Чем `ROW_NUMBER`, `RANK` и `DENSE_RANK` отличаются?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-chem-row-number-rank-i-dense-rank-otlichayutsya
```

Все три нумеруют строки внутри окна по `ORDER BY`, но по-разному обрабатывают одинаковые значения (ties): `ROW_NUMBER` всегда даёт уникальные номера, `RANK` даёт равным строкам одинаковый номер и пропускает следующие, `DENSE_RANK` даёт одинаковый номер без пропусков.

```sql
SELECT name, score,
       row_number() OVER (ORDER BY score DESC) AS rn,
       rank()       OVER (ORDER BY score DESC) AS rnk,
       dense_rank() OVER (ORDER BY score DESC) AS drnk
FROM results;
```

| name | score | row_number | rank | dense_rank |
| --- | --- | --- | --- | --- |
| Анна | 95 | 1 | 1 | 1 |
| Борис | 90 | 2 | 2 | 2 |
| Вера | 90 | 3 | 2 | 2 |
| Глеб | 85 | 4 | 4 | 3 |

**Когда что использовать:**

- **`ROW_NUMBER`** — нужна ровно одна строка на позицию: пагинация, дедупликация («оставить одну из дублей»), top-N на группу строго по N строк. Порядок среди равных произволен и может меняться между запусками, поэтому добавляйте tie-breaker: `ORDER BY score DESC, id`.
- **`RANK`** — спортивный рейтинг: «два вторых места, следующее — четвёртое». Top-3 по `rank <= 3` может вернуть больше трёх строк.
- **`DENSE_RANK`** — «N-е по величине значение»: вторая по величине зарплата — `dense_rank = 2`, даже если первую получают несколько человек.

**Классическая задача — вторая максимальная зарплата в каждом отделе:**

```sql
SELECT * FROM (
  SELECT e.*, dense_rank() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS dr
  FROM employees e
) t
WHERE dr = 2;
```

**Родственные функции:** `percent_rank()` = `(rank - 1) / (строк в разделе - 1)`, `cume_dist()` — доля строк с значением не больше текущего, `ntile(n)` — разбиение на n примерно равных корзин.

**Ограничение:** в `WHERE` того же уровня оконную функцию использовать нельзя — нужен подзапрос или CTE. С PostgreSQL 15 планировщик умеет прекращать вычисление `row_number/rank/dense_rank` раньше при фильтре `rn <= N` во внешнем запросе (run condition в `WindowAgg`), что ускоряет top-N.

## Как получить N последних записей для каждого пользователя?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-poluchit-n-poslednih-zapisei-dlya-kazhdogo-polzovatelya
```

Два рабочих подхода: `row_number()` в подзапросе с фильтром `rn <= N`, или `LATERAL`-подзапрос с `ORDER BY ... LIMIT N` для каждого пользователя. Первый проще и хорош, когда обрабатываете большую часть таблицы; второй с индексом `(user_id, created_at DESC)` значительно быстрее, когда пользователей мало относительно числа записей.

**Вариант 1 — оконная функция:**

```sql
SELECT *
FROM (
  SELECT o.*,
         row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
  FROM orders o
) t
WHERE rn <= 3;
```

Минус: нужно пронумеровать **все** строки таблицы — полное чтение плюс сортировка (или проход по индексу). С PostgreSQL 15 `WindowAgg` перестаёт считать номера в разделе после `rn > 3`, но строки всё равно читаются.

**Вариант 2 — `LATERAL` + индекс:**

```sql
CREATE INDEX ON orders (user_id, created_at DESC, id DESC);

SELECT u.id AS user_id, o.*
FROM users u
CROSS JOIN LATERAL (
  SELECT id, amount, created_at
  FROM orders
  WHERE user_id = u.id
  ORDER BY created_at DESC, id DESC
  LIMIT 3
) o;
```

Для каждого пользователя это короткий Index Scan, который читает ровно 3 записи индекса. Если у пользователя 10 000 заказов, вариант 1 прочитает их все, вариант 2 — три.

```text
Nested Loop
  ->  Seq Scan on users u
  ->  Limit
        ->  Index Scan using orders_user_id_created_at_id_idx on orders
              Index Cond: (user_id = u.id)
```

Используйте `LEFT JOIN LATERAL (...) o ON true`, если пользователи без заказов тоже нужны.

**Вариант для N = 1 — `DISTINCT ON`:**

```sql
SELECT DISTINCT ON (user_id) *
FROM orders
ORDER BY user_id, created_at DESC, id DESC;
```

Лаконично, но так же, как `row_number`, обрабатывает всю таблицу.

**Как выбрать:**

| Ситуация | Подход |
| --- | --- |
| Нужны все пользователи, записей на пользователя немного | `row_number` / `DISTINCT ON` |
| Записей на пользователя много, есть индекс | `LATERAL` + `LIMIT` |
| Список пользователей ограничен (`WHERE u.id = ANY(@ids)`) | `LATERAL` |

**Детали, которые проверяют:** tie-breaker (`id`) в сортировке — иначе при одинаковом `created_at` результат недетерминирован; `rank` вместо `row_number` может вернуть больше N строк.

## Как найти дубликаты?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-naiti-dublikaty
tags: sql
```

Дубликаты ищут группировкой по колонкам, которые должны быть уникальными, с фильтром `HAVING count(*) > 1`. Если нужны сами строки (а не только значения) — оконная функция `count(*) OVER (PARTITION BY ...)` или `row_number()`.

**Какие значения повторяются:**

```sql
SELECT lower(email) AS email, count(*) AS cnt
FROM users
GROUP BY lower(email)
HAVING count(*) > 1
ORDER BY cnt DESC;
```

**Все строки-дубликаты целиком:**

```sql
SELECT *
FROM (
  SELECT u.*, count(*) OVER (PARTITION BY lower(email)) AS cnt
  FROM users u
) t
WHERE cnt > 1
ORDER BY lower(email), id;
```

**Только «лишние» копии** (все, кроме первой по `id`) — именно их потом удаляют:

```sql
SELECT id
FROM (
  SELECT id, row_number() OVER (PARTITION BY lower(email) ORDER BY id) AS rn
  FROM users
) t
WHERE rn > 1;
```

**Список id одной группой** — удобно для ручного разбора:

```sql
SELECT lower(email), array_agg(id ORDER BY id) AS ids
FROM users
GROUP BY 1
HAVING count(*) > 1;
```

**Что считать дубликатом — главный вопрос.** Технически разные строки могут быть логическими дублями: регистр (`A@b.com` и `a@b.com`), пробелы по краям, `NULL`. Нормализуйте ключ в выражении: `lower(trim(email))`.

**Про `NULL`:** `GROUP BY` и `PARTITION BY` считают `NULL` одинаковыми и сгруппируют их вместе. А уникальный индекс по умолчанию `NULL` дубликатами **не** считает — несколько строк с `NULL` в уникальной колонке допустимы. С PostgreSQL 15 это можно изменить: `UNIQUE NULLS NOT DISTINCT`.

**Дубли всей строки** (без ключа): `GROUP BY` по всем колонкам или сравнение `t.*`:

```sql
SELECT t, count(*) FROM events t GROUP BY t HAVING count(*) > 1;
```

**Профилактика** важнее поиска: после чистки добавьте `UNIQUE`-ограничение или уникальный индекс по выражению (`CREATE UNIQUE INDEX ON users (lower(email))`), а в коде используйте `INSERT ... ON CONFLICT`.

## Как удалить дубликаты?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-udalit-dublikaty
tags: sql
```

Обычный способ — пронумеровать строки внутри группы дублей через `row_number()` и удалить все, кроме одной (`rn > 1`). Какая строка останется, задаёт `ORDER BY` в окне: самая старая, самая новая, самая полная.

```sql
DELETE FROM users
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (PARTITION BY lower(email) ORDER BY created_at, id) AS rn
    FROM users
  ) t
  WHERE rn > 1
);
```

**Альтернатива через self-join (`USING`):**

```sql
DELETE FROM users a
USING users b
WHERE lower(a.email) = lower(b.email)
  AND a.id > b.id;          -- оставить строку с минимальным id
```

Лаконично, но на больших группах дублей соединение растёт квадратично; вариант с `row_number` предсказуемее.

**Если нет первичного ключа** — строки различает системная колонка `ctid` (физический адрес версии строки):

```sql
DELETE FROM raw_events
WHERE ctid IN (
  SELECT ctid FROM (
    SELECT ctid, row_number() OVER (PARTITION BY event_id ORDER BY ctid) AS rn
    FROM raw_events
  ) t WHERE rn > 1
);
```

`ctid` меняется при `UPDATE` и `VACUUM FULL`, поэтому использовать его можно только внутри одного запроса.

**Практические моменты:**

- **Сначала посмотреть, потом удалить.** Выполните `SELECT` с тем же условием, проверьте количество, делайте в транзакции.
- **Ссылки из других таблиц.** Если на дубли ссылаются внешние ключи, сначала переназначьте ссылки на «выживающую» строку (`UPDATE orders SET user_id = keep_id ...`), иначе `DELETE` упадёт или каскадно удалит лишнее.
- **Объём.** Удаление миллионов строк одним запросом — долгая транзакция, много WAL и блокировок строк. Удаляйте батчами по несколько тысяч.
- **Альтернатива для таблицы, где дублей большинство:** `CREATE TABLE new AS SELECT DISTINCT ON (...) ...`, затем переименование — быстрее, чем удалять.
- **Закрыть дыру.** После чистки создайте уникальный индекс (`CREATE UNIQUE INDEX CONCURRENTLY`), иначе дубли вернутся. Создание упадёт, если хоть один дубль остался, — это и хорошая финальная проверка.

## Как работает NULL?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-rabotaet-null
tags: sql
```

`NULL` в SQL означает «значение неизвестно или отсутствует». Это не ноль и не пустая строка, а отдельный маркер, который меняет логику: почти любое выражение с `NULL` даёт `NULL`, а условия работают в **трёхзначной логике** — `true`, `false`, `unknown`.

```sql
SELECT 1 + NULL;          -- NULL
SELECT 'a' || NULL;       -- NULL (concat('a', NULL) вернёт 'a')
SELECT NULL = NULL;       -- NULL
SELECT NULL <> 1;         -- NULL
```

**Логические операции:**

| | `AND` | `OR` |
| --- | --- | --- |
| `true`, `NULL` | `NULL` | `true` |
| `false`, `NULL` | `false` | `NULL` |

`NOT NULL` — тоже `NULL`.

**Как себя ведут разные части SQL:**

- **`WHERE`, `ON`, `HAVING`** пропускают только `true` — строки с `unknown` отбрасываются. Поэтому `WHERE status <> 'deleted'` не вернёт строки с `status IS NULL`.
- **`CHECK`** — наоборот, нарушением считается только `false`, `NULL` проходит.
- **Агрегаты** игнорируют `NULL`: `avg(x)` делит на число не-`NULL` значений, `count(x)` их не считает, `sum` по пустому набору или одним `NULL` даёт `NULL`, а не 0.
- **`GROUP BY`, `DISTINCT`, `UNION`** считают все `NULL` одинаковыми.
- **`ORDER BY`** — `NULL` больше любых значений: в конце при `ASC`, в начале при `DESC`; меняется через `NULLS FIRST/LAST`.
- **Уникальный индекс** по умолчанию допускает несколько `NULL` (с PG 15 — опция `NULLS NOT DISTINCT`).

**Инструменты:**

```sql
WHERE deleted_at IS NULL
WHERE a IS DISTINCT FROM b        -- NULL-безопасное сравнение
SELECT coalesce(discount, 0)      -- подстановка значения
SELECT nullif(qty, 0)             -- превратить 0 в NULL (защита от деления на 0)
```

**Частые баги:**

- `NOT IN` по подзапросу, где есть `NULL`, возвращает пусто;
- `count(column)` после `LEFT JOIN` отличается от `count(*)`;
- `sum()` без `coalesce` отдаёт в приложение `NULL` вместо 0 — в C# это `DBNull` или исключение при чтении в `decimal`.

**Индексы:** B-tree в PostgreSQL хранит `NULL`, поэтому `WHERE x IS NULL` может использовать индекс. Для редких не-`NULL` значений выгоден частичный индекс `WHERE x IS NOT NULL`.

**Проектирование:** делайте колонки `NOT NULL` по умолчанию, `NULL` — только там, где «нет значения» — осмысленное состояние.

## Почему `NULL = NULL` не даёт true?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-pochemu-null-null-ne-daet-true
tags: sql
```

Потому что `NULL` означает «неизвестное значение», а сравнение двух неизвестных тоже неизвестно: нельзя утверждать, что они равны, и нельзя — что различаются. Результат `NULL = NULL` — `NULL` (логическое `unknown`), и `WHERE` такую строку отбрасывает.

```sql
SELECT NULL = NULL;               -- NULL
SELECT NULL <> NULL;              -- NULL
SELECT NULL IS NULL;              -- true
SELECT NULL IS NOT DISTINCT FROM NULL;  -- true
```

**Практические последствия:**

```sql
-- не найдёт строки без телефона
SELECT * FROM users WHERE phone = NULL;
-- правильно
SELECT * FROM users WHERE phone IS NULL;
```

Соединение по nullable-колонке не соединит строки, где обе стороны `NULL`:

```sql
SELECT * FROM a JOIN b ON a.code = b.code;   -- пары NULL/NULL не попадут
```

Если нужно считать `NULL` равными, используйте `IS NOT DISTINCT FROM`:

```sql
SELECT * FROM a JOIN b ON a.code IS NOT DISTINCT FROM b.code;
```

Но такое условие хуже оптимизируется: для B-tree индекса и hash join оно не является обычным равенством, поэтому возможен Nested Loop. Иногда лучше `coalesce(a.code, '') = coalesce(b.code, '')` с индексом по выражению, если есть «невозможное» значение.

**Параметры из приложения.** Частая ошибка в .NET-коде:

```sql
WHERE parent_id = @parentId        -- при @parentId = null ничего не найдёт
WHERE parent_id IS NOT DISTINCT FROM @parentId   -- работает для обоих случаев
```

EF Core по умолчанию эмулирует C#-семантику null и при сравнении с nullable-переменной сам генерирует `IS NULL`-проверки (если не включён `UseRelationalNulls()`), а в Dapper и сыром SQL это ответственность разработчика.

**Где `NULL` всё же считаются одинаковыми:** `GROUP BY`, `DISTINCT`, `UNION`, `INTERSECT`, `EXCEPT`, `PARTITION BY` — там сравнение идёт по принципу «не различимы». А в уникальных ограничениях по умолчанию — наоборот, `NULL` разные, и допускается несколько строк с `NULL` (в PG 15+ меняется опцией `NULLS NOT DISTINCT`).

**Почему так сделано:** это следствие трёхзначной логики стандарта SQL. Альтернатива (`NULL = NULL` → true) приводила бы к ложным совпадениям: два клиента с неизвестной датой рождения — не «клиенты с одной датой рождения».

## Чем `COALESCE` отличается от `NULLIF`?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-chem-coalesce-otlichaetsya-ot-nullif
tags: sql
```

Они делают противоположное: `COALESCE(a, b, ...)` возвращает первый аргумент, не равный `NULL`, — то есть **заменяет `NULL` значением**. `NULLIF(a, b)` возвращает `NULL`, если `a = b`, иначе `a` — то есть **превращает значение в `NULL`**.

```sql
SELECT coalesce(NULL, NULL, 5, 7);   -- 5
SELECT coalesce(phone, email, 'n/a') FROM users;

SELECT nullif(10, 10);               -- NULL
SELECT nullif(10, 3);                -- 10
SELECT nullif(trim(name), '');       -- пустая строка → NULL
```

| | `COALESCE` | `NULLIF` |
| --- | --- | --- |
| Аргументов | 1 и больше | ровно 2 |
| Смысл | значение по умолчанию | «это значение считать отсутствующим» |
| Эквивалент через `CASE` | `CASE WHEN a IS NOT NULL THEN a ELSE b END` | `CASE WHEN a = b THEN NULL ELSE a END` |

**Классические применения `COALESCE`:**

- ноль вместо `NULL` у агрегатов после `LEFT JOIN`: `coalesce(sum(o.amount), 0)`;
- выбор первого заполненного поля: `coalesce(nickname, first_name, 'Аноним')`;
- общий ключ после `FULL JOIN`: `coalesce(a.id, b.id)`.

**Классические применения `NULLIF`:**

- защита от деления на ноль: `clicks / nullif(views, 0)` вернёт `NULL` вместо ошибки `division by zero`;
- нормализация «пустых» значений из импорта: `nullif(col, '')`, `nullif(col, 'N/A')`.

**Вместе:** `coalesce(clicks::numeric / nullif(views, 0), 0)` — CTR с нулём при отсутствии просмотров.

**Детали:**

- `COALESCE` вычисляет аргументы лениво — слева направо, пока не найдёт не-`NULL`; тяжёлые выражения справа не выполнятся без нужды.
- Типы всех аргументов `COALESCE` должны приводиться к общему: `coalesce(int_col, 'нет')` — ошибка, нужно `coalesce(int_col::text, 'нет')`.
- `COALESCE` по колонке в `WHERE` ломает использование обычного индекса: `WHERE coalesce(status, 'new') = 'new'` лучше переписать как `WHERE status = 'new' OR status IS NULL`.

## Что такое CASE?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-case
tags: sql
```

`CASE` — условное выражение SQL, аналог `if/else` или `switch`. Возвращает значение первой ветки, условие которой истинно, или значение `ELSE` (если `ELSE` нет — `NULL`). Это выражение, поэтому его можно использовать везде: в `SELECT`, `WHERE`, `ORDER BY`, `GROUP BY`, `UPDATE ... SET`, внутри агрегатов.

**Две формы:**

```sql
-- searched CASE: произвольные условия
SELECT id,
       CASE
         WHEN amount >= 10000 THEN 'large'
         WHEN amount >= 1000  THEN 'medium'
         ELSE 'small'
       END AS bucket
FROM orders;

-- simple CASE: сравнение одного выражения на равенство
SELECT CASE status
         WHEN 'new'  THEN 'Новый'
         WHEN 'paid' THEN 'Оплачен'
         ELSE status
       END
FROM orders;
```

Ветки проверяются по порядку, срабатывает первая подходящая — порядок важен (в примере `>= 1000` стоит после `>= 10000`).

**Simple `CASE` и `NULL`:** `CASE x WHEN NULL THEN ...` никогда не сработает, потому что сравнение идёт через `=`. Для `NULL` — searched-форма с `WHEN x IS NULL`.

**Полезные приёмы:**

```sql
-- условные агрегаты (pivot)
SELECT shop_id,
       sum(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid,
       count(CASE WHEN status = 'cancelled' THEN 1 END)      AS cancelled
FROM orders GROUP BY shop_id;

-- кастомная сортировка
ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END;

-- массовое обновление разными значениями
UPDATE products
SET price = CASE WHEN category = 'food' THEN price * 1.05 ELSE price * 1.10 END;
```

Для условных агрегатов в PostgreSQL чище синтаксис `FILTER`: `count(*) FILTER (WHERE status = 'cancelled')`.

**Типы:** все ветки `THEN`/`ELSE` должны приводиться к одному типу, иначе ошибка (`CASE WHEN ... THEN 1 ELSE 'x' END` не сработает).

**Ленивость — с оговоркой.** `CASE` вычисляет только нужную ветку, поэтому им защищаются от ошибок (`CASE WHEN y <> 0 THEN x / y END`). Но константные подвыражения планировщик может свернуть заранее, а агрегаты внутри `CASE` вычисляются до него — `CASE WHEN count(*) > 0 THEN sum(x)/count(*) END` защищает от деления, но `sum` всё равно посчитается.

## Как реализовать pagination?

```yaml
category: postgresql
level: middle
difficulty: 4
slug: postgresql-kak-realizovat-pagination
tags: indexes, sql
```

Есть два основных способа: **`LIMIT/OFFSET`** («страница номер N») и **keyset / cursor pagination** («строки после последней показанной»). Первый прост и позволяет прыгнуть на любую страницу, но деградирует на глубоких страницах; второй работает за одинаковое время на любой глубине, но умеет только «вперёд/назад».

**Offset-пагинация:**

```sql
SELECT id, title, created_at
FROM posts
WHERE status = 'published'
ORDER BY created_at DESC, id DESC
LIMIT 20 OFFSET 40;          -- третья страница
```

`OFFSET 100000` означает: найти, отсортировать и **выбросить** 100 000 строк, прежде чем отдать 20. Время растёт линейно с номером страницы. Кроме того, если между запросами добавилась новая запись, строки сдвигаются — пользователь увидит дубль или пропустит запись.

**Keyset-пагинация:**

```sql
CREATE INDEX ON posts (created_at DESC, id DESC) WHERE status = 'published';

SELECT id, title, created_at
FROM posts
WHERE status = 'published'
  AND (created_at, id) < (@lastCreatedAt, @lastId)   -- row comparison
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

Клиент передаёт курсор — значения ключа сортировки последней строки (часто в виде непрозрачного base64-токена). Запрос спускается по индексу сразу в нужное место и читает 20 записей:

```text
Limit  (actual rows=20)
  ->  Index Scan using posts_created_at_id_idx on posts
        Index Cond: (ROW(created_at, id) < ROW('2025-03-01 10:00', 81234))
```

**Обязательные условия для keyset:**

- порядок сортировки **детерминированный** — последний столбец уникален (`id`);
- индекс совпадает с `ORDER BY` по колонкам и направлениям;
- сравнение кортежей `(a, b) < (x, y)` работает, только когда все колонки сортируются в одну сторону; для смешанного порядка (`a ASC, b DESC`) пишут развёрнутое условие `a > x OR (a = x AND b < y)`, и индекс используется хуже.

**Общее количество страниц.** `count(*)` по большой выборке сам по себе дорог (MVCC требует проверить видимость строк). Варианты: не показывать точное число («ещё есть» — запросить `LIMIT 21`), оценка из `EXPLAIN` / `pg_class.reltuples`, кэш счётчика.

**Выбор:**

| Сценарий | Подход |
| --- | --- |
| Админка, небольшие таблицы, нужны номера страниц | `OFFSET` |
| Лента, бесконечный скролл, API, экспорт больших объёмов | keyset |
| Выгрузка всей таблицы батчами | keyset по `id` |

В EF Core keyset делают вручную (`Where(x => x.CreatedAt < last || ...)` + `OrderBy` + `Take`) или через библиотеки вроде `MR.EntityFrameworkCore.KeysetPagination`.

## `OFFSET/LIMIT` vs keyset pagination?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-offset-limit-vs-keyset-pagination
tags: indexes, sql, kafka
```

`OFFSET/LIMIT` пропускает первые N строк результата, keyset-пагинация продолжает с места, где остановилась предыдущая страница (`WHERE key > last_key`). Keyset быстрее на глубоких страницах и стабилен при вставках, но не позволяет перейти сразу на произвольную страницу.

```sql
-- OFFSET
SELECT * FROM events ORDER BY id LIMIT 50 OFFSET 500000;

-- keyset
SELECT * FROM events WHERE id > 500123 ORDER BY id LIMIT 50;
```

**Почему `OFFSET` медленный.** PostgreSQL не умеет «перепрыгнуть» N строк в индексе: он читает и отбрасывает все 500 000 строк, проверяя видимость каждой. В `EXPLAIN ANALYZE` это видно по `rows` у узла под `Limit`:

```text
Limit  (actual time=180.3..180.4 rows=50)
  ->  Index Scan using events_pkey on events  (actual rows=500050)
```

Keyset на той же глубине:

```text
Limit  (actual time=0.03..0.09 rows=50)
  ->  Index Scan using events_pkey on events  (actual rows=50)
        Index Cond: (id > 500123)
```

| | `OFFSET/LIMIT` | Keyset |
| --- | --- | --- |
| Время страницы | растёт с номером страницы | постоянное (log N на спуск в индексе) |
| Переход на страницу 37 | да | нет, только соседние |
| Вставки/удаления между запросами | дубли и пропуски строк | стабильно |
| Требования | любой `ORDER BY` | уникальный детерминированный ключ + индекс |
| Сложность в коде | минимальная | курсор, составные условия |

**Типичные ошибки keyset:**

- сортировка по неуникальной колонке (`created_at`) без tie-breaker — строки с одинаковым временем потеряются на границе страниц; нужен `(created_at, id)`;
- сортировка по nullable-колонке — `NULL` не сравниваются через `<`, их нужно обрабатывать отдельно или запретить `NULL`;
- «назад» делается обратным условием и обратной сортировкой, после чего результат переворачивают в приложении.

**Батчевая обработка.** Для фоновых задач — обхода таблицы, реиндексации в поиск, отправки событий в брокер (например, в Kafka при бэкфилле) — `OFFSET` особенно вреден: каждый следующий батч дороже предыдущего, а параллельные вставки сдвигают окно. Правильный паттерн — цикл по `WHERE id > @last ORDER BY id LIMIT 1000`, сохраняя последний обработанный `id` как чекпоинт, чтобы при падении продолжить с него.

**Компромисс для UI:** keyset для «следующая/предыдущая» и ограничение на глубину для номеров страниц (многие сервисы не дают уйти дальше 100-й страницы).

## Что такое PostgreSQL?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-postgresql
```

PostgreSQL — объектно-реляционная СУБД с открытым исходным кодом (лицензия PostgreSQL, похожа на BSD/MIT). Это транзакционная база с полной поддержкой ACID, развитым SQL и расширяемой архитектурой: свои типы, операторы, индексы и языки функций можно добавлять без форка ядра.

**Чем она отличается от «просто SQL-базы»:**

- **MVCC** — конкурентный доступ через версии строк: читатели не блокируют писателей и наоборот.
- **Богатая система типов** — `jsonb`, массивы, диапазоны (`tstzrange`), `uuid`, `inet`, перечисления, составные типы.
- **Много видов индексов** — B-tree, Hash, GiST, SP-GiST, GIN, BRIN, плюс индексы по выражениям, частичные и покрывающие (`INCLUDE`).
- **Расширения** — `pg_stat_statements`, `pg_trgm`, `PostGIS`, `pgvector`, `TimescaleDB`, `pg_partman` подключаются через `CREATE EXTENSION`.
- **Транзакционный DDL** — `CREATE TABLE`, `ALTER TABLE` можно откатить вместе с остальной транзакцией. Удобно для миграций: упавшая миграция не оставляет схему в промежуточном состоянии.
- **Репликация** — физическая потоковая и логическая (publication/subscription).

**Архитектура в двух словах.** Модель «процесс на соединение»: postmaster принимает подключение и форкает отдельный backend-процесс. Поэтому соединения дорогие (несколько МБ памяти каждое, плюс накладные расходы на snapshot), и в продакшене почти всегда нужен пул — на стороне приложения (Npgsql) или внешний (PgBouncer). Данные лежат в страницах по 8 КБ, общий кэш — `shared_buffers`, надёжность обеспечивает журнал WAL.

```sql
SELECT version();
SHOW server_version;
```

**Где в .NET-стеке:** драйвер Npgsql, провайдер EF Core `Npgsql.EntityFrameworkCore.PostgreSQL`, Dapper поверх Npgsql. Major-версии выходят раз в год, каждая поддерживается пять лет.

**Что спрашивают дальше:** чем отличается от MySQL/SQL Server (MVCC без undo-лога — старые версии лежат прямо в таблице, отсюда VACUUM; модель процессов вместо потоков; нет кластерных индексов в смысле SQL Server — таблица всегда heap), какой уровень изоляции по умолчанию (Read Committed).

## Какие типы индексов есть в PostgreSQL?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-kakie-tipy-indeksov-est-v-postgresql
tags: indexes
```

Встроенных методов доступа шесть: **B-tree** (по умолчанию), **Hash**, **GiST**, **SP-GiST**, **GIN** и **BRIN**. Ещё несколько приходят расширениями: `bloom`, `pgvector` (HNSW, IVFFlat), `rum`.

| Тип | Для чего | Операторы / примеры |
| --- | --- | --- |
| B-tree | равенство, диапазоны, сортировка, уникальность | `=`, `<`, `>`, `BETWEEN`, `IN`, `LIKE 'abc%'`, `ORDER BY` |
| Hash | только равенство | `=` |
| GiST | «перекрытие», близость, геометрия, диапазоны | `&&`, `@>`, `<->` (KNN), exclusion constraints |
| SP-GiST | несбалансированные разбиения: префиксные деревья, quadtree | IP-адреса, точки, текстовые префиксы |
| GIN | «составные» значения: много ключей на строку | `jsonb @>`, массивы `@>`/`&&`, full-text `@@`, триграммы |
| BRIN | огромные таблицы с естественным порядком данных | диапазоны по `created_at` в append-only логах |

```sql
CREATE INDEX ON orders (customer_id);
CREATE INDEX ON sessions USING hash (token);
CREATE INDEX ON docs USING gin (payload jsonb_path_ops);
CREATE INDEX ON bookings USING gist (during);
CREATE INDEX ON events USING brin (created_at);
```

**Модификаторы, которые работают поверх метода:**

- **составной индекс** — несколько колонок (`(tenant_id, created_at)`);
- **частичный** — `WHERE status = 'active'`;
- **по выражению** — `(lower(email))`;
- **покрывающий** — `INCLUDE (amount)` для Index Only Scan (B-tree с PG 11, GiST с PG 12, SP-GiST с PG 14);
- **уникальный** — `UNIQUE` поддерживает только B-tree.

**Как выбирать.** В 90% случаев нужен B-tree. GIN — когда в одной колонке «много значений» (JSON-документ, массив тегов, текст для поиска). GiST — геометрия, диапазоны, «не пересекаются по времени». BRIN — терабайтные таблицы событий, где важен размер индекса, а не точность. Hash после PG 10 стал WAL-логируемым и безопасным, но выигрывает у B-tree редко — разве что на длинных ключах, где хранит только 4-байтовый хеш.

**Что спрашивают дальше:** почему GIN медленнее на запись (одна строка порождает много ключей; частично сглаживается `fastupdate`), чем GiST отличается от GIN для full-text (GiST lossy и меньше, GIN точнее и быстрее на чтение), что такое operator class (`text_pattern_ops`, `jsonb_path_ops`) и зачем он нужен.

## Что такое B-tree index?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-b-tree-index
tags: indexes
```

B-tree — сбалансированное дерево поиска, индекс по умолчанию в PostgreSQL. Ключи в нём хранятся отсортированными, поэтому он поддерживает равенство, диапазоны, сортировку, `MIN/MAX` и уникальность — поиск занимает O(log N) чтений страниц.

**Устройство.** Корневая страница → внутренние страницы → листовые страницы. Каждая страница — 8 КБ. В листьях лежат пары «ключ → TID» (`ctid`, адрес строки в heap: номер страницы + позиция). Листья связаны в двусвязный список, поэтому диапазон читается последовательно, без повторного спуска от корня. Реализация основана на алгоритме Lehman–Yao, который позволяет конкурентные вставки без блокировки всего дерева.

Из-за большого ветвления (сотни ключей на странице) дерево неглубокое: таблица в сотни миллионов строк обычно укладывается в 3–4 уровня, а верхние уровни почти всегда в кэше.

```sql
CREATE INDEX orders_created_at_idx ON orders (created_at);

EXPLAIN SELECT * FROM orders
WHERE created_at >= now() - interval '1 day'
ORDER BY created_at;
```

```text
Index Scan using orders_created_at_idx on orders
  Index Cond: (created_at >= (now() - '1 day'::interval))
```

Узла `Sort` нет — данные уже пришли из индекса в нужном порядке. Индекс читается и в обратную сторону (`Index Scan Backward`), поэтому для `ORDER BY created_at DESC` отдельный `DESC`-индекс не нужен; он нужен только при смешанных направлениях в составном индексе.

**Что важно знать:**

- **Индекс не хранит видимость.** Найдя TID, PostgreSQL всё равно идёт в heap проверять, видна ли версия строки текущей транзакции. Исключение — Index Only Scan по страницам, помеченным all-visible в visibility map.
- **Дедупликация (PG 13+).** Одинаковые ключи хранятся один раз со списком TID — индексы по низкокардинальным колонкам стали заметно меньше.
- **Лимит размера ключа** — около трети страницы (~2,7 КБ). Индексировать длинный текст целиком нельзя, используют хеш или выражение.
- **Распухание.** Удалённые записи убирает VACUUM; при частых обновлениях индекс разрастается, лечится `REINDEX CONCURRENTLY`.
- **Collation.** Для `LIKE 'abc%'` при не-`C` collation нужен operator class `text_pattern_ops`, иначе префиксный поиск индекс не использует.

**Что спрашивают дальше:** почему B-tree, а не бинарное дерево (минимизация дисковых чтений за счёт широких узлов), чем отличается от B+-tree (в PostgreSQL по факту B+-подобная структура: данные — только TID в листьях), когда индекс не помогает.

## Когда B-tree индекс не помогает?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kogda-b-tree-indeks-ne-pomogaet
tags: indexes
```

B-tree бесполезен, когда условие нельзя свести к поиску по **отсортированному префиксу** ключа или когда условию соответствует слишком большая доля таблицы. Тогда планировщик честно выбирает Seq Scan.

**1. Оператор не поддерживается B-tree.**

```sql
WHERE name LIKE '%son'
WHERE name ILIKE 'ivan%'
WHERE tags @> ARRAY['sql']
WHERE payload->>'type' = 'x'
WHERE status <> 'deleted'
```

Поиск по суффиксу/подстроке, регистронезависимый поиск, вхождение в массив и JSON, `<>` — всё это не «точка или диапазон в отсортированном списке». Решения: триграммный GIN (`pg_trgm`) для `LIKE '%..%'`, индекс по выражению `lower(name)`, GIN для массивов и `jsonb`, частичный индекс вместо `<>`.

**2. Функция или приведение типа над колонкой.**

```sql
WHERE date(created_at) = '2025-01-10'
WHERE id::text = '42'
```

Индекс построен по `created_at`, а не по `date(created_at)`. Переписать на диапазон (`created_at >= '2025-01-10' AND created_at < '2025-01-11'`) или создать expression index.

**3. Условие не на ведущую колонку составного индекса.** Индекс `(tenant_id, created_at)` не годится для `WHERE created_at > ...` без `tenant_id` — данные отсортированы сначала по `tenant_id`. (В PG 18 появился skip scan, частично снимающий это ограничение при малом числе различных значений ведущей колонки, но на 15–17 его нет.)

**4. Низкая селективность.** `WHERE is_active = true`, когда активных 95%: прочитать индекс и потом случайно прыгать по heap дороже, чем пройти таблицу последовательно. Помогает частичный индекс по редкому значению: `WHERE is_active = false`.

**5. Префиксный `LIKE` при не-C collation.** `LIKE 'abc%'` использует обычный B-tree только с collation `C` или с opclass `text_pattern_ops`.

**6. Маленькая таблица.** Несколько страниц быстрее прочитать целиком.

**7. Тяжёлые выражения сортировки и `OR` по разным колонкам** — `WHERE a = 1 OR b = 2` одним B-tree не обслужить; планировщик может склеить два индекса через `BitmapOr`, но только если индекс есть на каждую колонку.

**Как проверить:** `EXPLAIN (ANALYZE, BUFFERS)` и сравнить с `SET enable_seqscan = off` в сессии — если с индексом медленнее, планировщик был прав.

## Что такое composite index?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-composite-index
tags: indexes
```

Составной (composite, multicolumn) индекс — индекс по нескольким колонкам сразу: `CREATE INDEX ON orders (customer_id, created_at)`. Ключи упорядочены лексикографически: сначала по первой колонке, внутри равных значений — по второй, и так далее.

```sql
CREATE INDEX orders_cust_created_idx ON orders (customer_id, created_at DESC);

SELECT id, total
FROM orders
WHERE customer_id = 42
ORDER BY created_at DESC
LIMIT 20;
```

```text
Limit
  ->  Index Scan using orders_cust_created_idx on orders
        Index Cond: (customer_id = 42)
```

Один спуск по дереву к первому `customer_id = 42`, дальше 20 записей по листьям — уже в нужном порядке, без `Sort`.

**Какие запросы обслуживает индекс `(a, b, c)` эффективно:**

| Условие | Работает? |
| --- | --- |
| `a = ?` | да |
| `a = ? AND b = ?` | да |
| `a = ? AND b > ?` | да, диапазон внутри `a` |
| `a = ? ORDER BY b` | да, без сортировки |
| `b = ?` | плохо: нужен полный проход по индексу |
| `a > ? AND b = ?` | `b` проверяется как фильтр внутри индекса, а не сужает диапазон |

Это правило ведущего префикса (leftmost prefix). Колонки после первого диапазонного условия уже не сужают поиск, а только фильтруют найденные записи.

**Составной против нескольких одиночных.** PostgreSQL умеет объединять одиночные индексы через `BitmapAnd`, но это дороже: два прохода, построение битовых карт, потеря порядка (сортировать придётся отдельно). Для частых запросов с одной и той же комбинацией условий составной индекс почти всегда выигрывает.

**Ограничения и нюансы:**

- до 32 колонок (вместе с `INCLUDE`), но больше 3–4 колонок — обычно признак ошибки проектирования индекса;
- лишние колонки увеличивают размер и замедляют запись, а также ломают HOT-обновления: если колонка проиндексирована, её изменение больше не HOT;
- для Index Only Scan неключевые колонки лучше добавлять через `INCLUDE (...)` — они хранятся только в листьях и не участвуют в сортировке;
- направления сортировки (`ASC/DESC`) важны только при смешанном `ORDER BY a ASC, b DESC`.

**Что спрашивают дальше:** в каком порядке ставить колонки; заменяет ли индекс `(a, b)` индекс `(a)` (да, отдельный `(a)` обычно лишний, хотя он меньше).

## В каком порядке выбирать колонки для composite index?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-v-kakom-poryadke-vybirat-kolonki-dlya-composite-index
tags: indexes
```

Короткое правило: **сначала колонки с равенством, потом колонка с диапазоном или сортировкой**. Среди колонок с равенством порядок определяет то, какие ещё запросы сможет обслужить индекс, а не «селективность прежде всего».

**Почему равенство — вперёд.** Индекс `(status, created_at)` для `WHERE status = 'paid' AND created_at > now() - '7 days'` даёт один непрерывный диапазон в листьях: все `paid`, отсортированные по дате, — берём хвост. Индекс `(created_at, status)` вынужден пройти все записи за 7 дней всех статусов и отфильтровать `status` внутри индекса.

```sql
CREATE INDEX ON orders (status, created_at);

EXPLAIN SELECT * FROM orders
WHERE status = 'paid' AND created_at > now() - interval '7 days';
```

```text
Index Scan using orders_status_created_at_idx on orders
  Index Cond: ((status = 'paid') AND (created_at > ...))
```

**Сортировка — тоже «диапазон».** Для `WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20` индекс `(customer_id, created_at)` отдаёт строки уже упорядоченными. Если поставить `created_at` первым, `LIMIT` перестанет помогать.

**Порядок между колонками равенства.** Если обе колонки всегда в условии через `=`, их порядок почти не влияет на скорость конкретного запроса. Решают другие соображения:

1. **Переиспользование.** Колонку, которая встречается в запросах и без второй, ставят первой — тогда индекс `(tenant_id, user_id)` обслужит и `WHERE tenant_id = ?`.
2. **Мультитенантность.** `tenant_id` почти всегда первым — все запросы фильтруют по нему.
3. **Селективность** — вторичный фактор. Миф «самую селективную колонку — первой» пришёл из времён, когда индекс без равенства по первой колонке был бесполезен. Для B-tree с равенствами по всем колонкам это не важно; важно, если первая колонка иногда участвует в диапазоне.

**Что ломает индекс:**

- диапазон на первой колонке и равенство на второй — вторая станет только фильтром;
- `ORDER BY a, b` при индексе `(b, a)`;
- смешанные направления: `ORDER BY a ASC, b DESC` требует индекса `(a ASC, b DESC)` (или полностью обратного).

**Практический подход:** выписать 3–5 самых частых/тяжёлых запросов к таблице из `pg_stat_statements`, для каждого — колонки равенства, диапазона и сортировки, и спроектировать минимальный набор индексов, где один индекс покрывает несколько запросов через общий префикс. Проверять `EXPLAIN (ANALYZE, BUFFERS)`: хороший индекс даёт `Index Cond` на все нужные колонки и небольшое `Rows Removed by Filter`.

## Что такое partial index?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-partial-index
tags: indexes
```

Частичный (partial) индекс строится не по всем строкам таблицы, а только по тем, что удовлетворяют условию `WHERE` в определении индекса. Он меньше, быстрее обновляется и точнее попадает в «горячие» запросы.

```sql
CREATE INDEX orders_pending_idx
ON orders (created_at)
WHERE status = 'pending';
```

Если из 100 млн заказов в статусе `pending` 50 тысяч, индекс будет крошечным, а очередь обработки — быстрой:

```sql
SELECT id FROM orders
WHERE status = 'pending'
ORDER BY created_at
LIMIT 100;
```

**Когда планировщик использует частичный индекс.** Только если может **доказать**, что условие запроса влечёт предикат индекса. Совпадение текстовое или логически очевидное: `status = 'pending'` подходит, `status IN ('pending', 'new')` — нет. Поэтому частичные индексы плохо дружат с параметрами:

```sql
WHERE status = $1
```

На custom-плане (первые выполнения prepared statement) значение подставлено и индекс подходит; на generic-плане значение неизвестно — индекс не используется. Решение: держать значение предиката литералом в SQL, а не параметром.

**Типичные применения:**

- **Soft delete:** `WHERE deleted_at IS NULL` — индексируются только живые строки.
- **Уникальность с условием:**

```sql
CREATE UNIQUE INDEX users_email_active_uq
ON users (lower(email))
WHERE deleted_at IS NULL;
```

Один активный пользователь на email, при этом удалённые дубликаты допустимы. Обычным `UNIQUE`-ограничением это не выразить.

- **Очереди и статусы:** индекс по редкому «необработанному» состоянию.
- **Исключение мусора:** `WHERE external_id IS NOT NULL`, когда большинство значений `NULL`.

**Подводные камни:**

- запрос должен содержать условие, совместимое с предикатом, иначе индекс невидим для планировщика;
- если строка переходит из `pending` в `done`, это обновление проиндексированного состояния — HOT невозможен, запись удаляется из индекса через VACUUM;
- частичный уникальный индекс нельзя использовать как цель `ON CONFLICT` без повторения предиката: `ON CONFLICT (lower(email)) WHERE deleted_at IS NULL DO NOTHING`;
- нельзя на него сослаться внешним ключом.

**Что спрашивают дальше:** чем частичный индекс лучше составного `(status, created_at)` (меньше в разы, не хранит ненужные статусы), как сделать «одна активная подписка на пользователя».

## Что такое expression index?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-expression-index
tags: indexes
```

Индекс по выражению (expression index) хранит не значение колонки, а результат выражения над ней: `lower(email)`, `date_trunc('day', created_at)`, `(payload->>'type')`. Он нужен, когда запрос фильтрует или сортирует по вычисляемому значению — обычный индекс по колонке в таком случае не используется.

```sql
CREATE INDEX users_lower_email_idx ON users (lower(email));

SELECT * FROM users WHERE lower(email) = lower('Ivan@Example.com');
```

```text
Index Scan using users_lower_email_idx on users
  Index Cond: (lower(email) = 'ivan@example.com'::text)
```

**Главное правило: выражение в запросе должно совпадать с выражением индекса.** `lower(email)` подходит, `upper(email)` или `lower(trim(email))` — нет. Планировщик сравнивает выражения структурно, а не «по смыслу».

**Функция должна быть `IMMUTABLE`.** Результат обязан зависеть только от аргументов, иначе индекс станет некорректным. Поэтому нельзя:

```sql
CREATE INDEX ON events ((created_at::date));
```

если `created_at` — `timestamptz`: приведение к `date` зависит от `TimeZone` сессии, функция `STABLE`. Варианты: `((created_at AT TIME ZONE 'UTC')::date)` — это уже immutable — или хранить отдельную колонку.

**Частые применения:**

- регистронезависимый поиск и уникальность: `CREATE UNIQUE INDEX ON users (lower(email))`;
- извлечение поля из JSON: `CREATE INDEX ON events ((payload->>'order_id'))` — B-tree по одному ключу дешевле и точнее GIN по всему документу;
- составные выражения: `(tenant_id, lower(name))`.

**Подводные камни:**

- **Стоимость записи.** Выражение вычисляется при каждой вставке и при обновлении проиндексированных колонок.
- **Статистика.** После создания индекса нужен `ANALYZE`: PostgreSQL собирает статистику по самому выражению, без неё оценка строк будет дефолтной и неточной.
- **ORM.** EF Core генерирует `lower(u.email)` из `ToLower()` в Npgsql — индекс подойдёт. Но `EF.Functions.ILike` даст `ILIKE`, который этим индексом не обслуживается.
- **Альтернатива** — generated column (`GENERATED ALWAYS AS (lower(email)) STORED`) плюс обычный индекс: выражение видно в схеме, его можно использовать в ORM как обычное свойство, но колонка занимает место в таблице.

Для регистронезависимости есть ещё тип `citext` и недетерминированные collation, но у них свои ограничения (например, `LIKE` с недетерминированными collation поддерживается только с PG 18).

## Что такое GIN?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-gin
tags: indexes
```

GIN (Generalized Inverted Index) — инвертированный индекс: для каждого **элемента** составного значения он хранит список строк, где этот элемент встречается. Как предметный указатель в книге: «слово → страницы». Подходит для `jsonb`, массивов, полнотекстового поиска и триграмм.

```sql
CREATE INDEX docs_payload_gin ON docs USING gin (payload);
SELECT * FROM docs WHERE payload @> '{"status": "active"}';

CREATE INDEX posts_tags_gin ON posts USING gin (tags);
SELECT * FROM posts WHERE tags @> ARRAY['postgres', 'index'];

CREATE INDEX articles_fts_gin ON articles USING gin (to_tsvector('russian', body));
SELECT * FROM articles WHERE to_tsvector('russian', body) @@ to_tsquery('russian', 'индекс & вакуум');

CREATE EXTENSION pg_trgm;
CREATE INDEX users_name_trgm ON users USING gin (name gin_trgm_ops);
SELECT * FROM users WHERE name ILIKE '%петров%';
```

**Устройство.** Внутри — B-tree по ключам (элементам), а у каждого ключа — posting list или posting tree с TID строк. Запрос «содержит A и B» превращается в пересечение списков. В плане GIN всегда выглядит как `Bitmap Index Scan` → `Bitmap Heap Scan`: обычного Index Scan у него нет.

**Operator class решает, какие операторы работают.** Для `jsonb`:

| Opclass | Операторы | Размер |
| --- | --- | --- |
| `jsonb_ops` (по умолчанию) | `@>`, `?`, `?\|`, `?&`, `@?`, `@@` | больше: индексирует ключи и значения отдельно |
| `jsonb_path_ops` | `@>`, `@?`, `@@` | заметно меньше и быстрее для `@>`, но нет проверки наличия ключа `?` |

**Цена — запись.** Одна строка с массивом из 50 тегов порождает 50 записей в индексе. Чтобы не обновлять дерево на каждую вставку, GIN по умолчанию использует `fastupdate`: новые записи копятся в pending list (до `gin_pending_list_limit`, по умолчанию 4 МБ) и сливаются в основное дерево при VACUUM/autovacuum или переполнении списка. Побочный эффект — поиск обязан просматривать и pending list, а случайная вставка, на которой список переполнился, получает всплеск latency. Если это критично, `WITH (fastupdate = off)`.

**Ограничения:**

- не поддерживает сортировку и диапазоны (`<`, `>`) — только «содержит/пересекается/совпадает»;
- не умеет Index Only Scan;
- для `payload->>'status' = 'x'` GIN по всему документу не используется: нужен `@>` или отдельный B-tree по выражению;
- на очень частых элементах (тег, который есть у 80% строк) индекс бесполезен — селективность низкая.

**Что спрашивают дальше:** GIN или GiST для full-text (GIN — быстрее поиск, медленнее обновление, точный; GiST — компактнее, lossy, нужен recheck), как индексировать `LIKE '%x%'` (триграммы).

## Что такое GiST?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-gist
tags: indexes
```

GiST (Generalized Search Tree) — сбалансированное дерево, в котором внутренние узлы хранят не отсортированные ключи, а **«ограничивающие» предикаты** (например, прямоугольник, который покрывает все объекты поддерева). Это каркас для индексов по данным, у которых нет линейного порядка: геометрия, диапазоны, сети, полнотекстовые векторы.

**Чем отличается от B-tree.** B-tree отвечает на вопросы «равно/больше/меньше». GiST — на вопросы «пересекается», «содержит», «находится внутри», «ближайший к». Поддеревья могут перекрываться, поэтому поиск иногда спускается в несколько ветвей.

```sql
CREATE INDEX bookings_during_gist ON bookings USING gist (during);

SELECT * FROM bookings
WHERE during && tstzrange('2025-05-01 10:00', '2025-05-01 12:00');
```

**Главные применения:**

1. **Диапазоны** (`tstzrange`, `int4range`, `daterange`) — операторы `&&` (перекрытие), `@>`, `<@`.
2. **Exclusion constraints** — «никакие две брони одной комнаты не пересекаются по времени»:

```sql
CREATE EXTENSION btree_gist;

ALTER TABLE bookings
ADD CONSTRAINT no_overlap
EXCLUDE USING gist (room_id WITH =, during WITH &&);
```

`btree_gist` нужен, чтобы в GiST-индекс можно было включить обычную скалярную колонку `room_id` с оператором `=`. Это ограничение проверяется атомарно, даже при конкурентных вставках, — на уровне приложения так надёжно не сделать.

3. **KNN-поиск** — «10 ближайших точек»:

```sql
SELECT id FROM places
ORDER BY location <-> point(55.75, 37.62)
LIMIT 10;
```

Индекс отдаёт строки сразу в порядке расстояния, без сортировки всей таблицы.

4. **PostGIS** — геометрия и география, основа всего геопоиска.
5. **Полнотекстовый поиск и триграммы** — `gist_trgm_ops`, `tsvector`. GiST тут меньше GIN, но lossy: найденные строки перепроверяются (`Recheck Cond`), поиск медленнее.

**Особенности:**

- может быть lossy — индекс отвечает «возможно», финальную проверку делает heap;
- поддерживает `INCLUDE` (PG 12+) и Index Only Scan для части opclass;
- построение и вставка медленнее, чем у B-tree: при вставке приходится выбирать поддерево с минимальным «расширением» ограничивающего предиката.

**SP-GiST** — родственник для неперекрывающихся разбиений (quadtree, radix tree): хорош для точек, IP-адресов (`inet`), текстовых префиксов.

**Что спрашивают дальше:** как гарантировать отсутствие пересечений бронирований без гонок (exclusion constraint), чем GiST отличается от GIN на full-text.

## Что такое BRIN?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-brin
tags: indexes
```

BRIN (Block Range Index) хранит не ссылку на каждую строку, а **сводку по диапазону блоков таблицы**: например, минимум и максимум `created_at` на каждые 128 страниц. Индекс получается в сотни-тысячи раз меньше B-tree и работает, когда значения колонки физически коррелируют с порядком строк на диске.

```sql
CREATE INDEX events_created_brin ON events USING brin (created_at)
WITH (pages_per_range = 64);
```

**Как работает поиск.** Для `WHERE created_at BETWEEN '2025-05-01' AND '2025-05-02'` PostgreSQL проходит по сводкам и отбирает только те диапазоны блоков, чьи `[min, max]` пересекаются с условием. Эти блоки читаются целиком, строки перепроверяются:

```text
Bitmap Heap Scan on events
  Recheck Cond: (created_at >= ... AND created_at <= ...)
  Rows Removed by Index Recheck: 18430
  Heap Blocks: lossy=1280
  ->  Bitmap Index Scan on events_created_brin
```

`lossy` — нормально для BRIN: индекс указывает на блоки, а не на строки.

**Когда BRIN идеален:**

- append-only таблицы: логи, события, метрики, телеметрия — строки вставляются в порядке времени;
- колонка монотонно растёт вместе с физическим положением: `created_at`, автоинкрементный `id`;
- таблица на сотни ГБ, и B-tree занимал бы десятки ГБ.

Проверить корреляцию можно по статистике:

```sql
SELECT attname, correlation FROM pg_stats
WHERE tablename = 'events' AND attname = 'created_at';
```

Значение близко к 1 или -1 — BRIN подойдёт; около 0 — бесполезен: у каждого диапазона блоков `min/max` охватят почти весь интервал.

**Что ломает BRIN:**

- `UPDATE` и вставки в освободившееся место после `DELETE` — старые даты «перемешиваются» с новыми;
- `CLUSTER` или массовые загрузки не по порядку.

**Обслуживание.** Новые диапазоны блоков не суммаризируются при вставке сразу — это делает VACUUM, либо `brin_summarize_new_values()`, либо параметр индекса `autosummarize = on` (по умолчанию выключен). Несуммаризованные диапазоны всегда попадают в выборку, поэтому индекс не врёт, но становится менее эффективным.

**Operator classes.** Классический — `minmax`. С PG 14 есть `minmax_multi` (несколько интервалов на диапазон — устойчивее к выбросам) и `bloom` (для равенства по неупорядоченным значениям).

**Ограничения:** только Bitmap Scan, нет уникальности и сортировки, бесполезен для точечного поиска одной строки. Типичная связка — BRIN по времени плюс партиционирование по месяцам.

## Что такое `EXPLAIN`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-explain
tags: query-planning
```

`EXPLAIN` показывает план выполнения запроса, который выбрал планировщик: какие узлы (сканы, соединения, сортировки) будут выполнены, в каком порядке и сколько это, по его оценке, стоит. Сам запрос при этом **не выполняется**.

```sql
EXPLAIN
SELECT o.id, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.created_at > now() - interval '1 day';
```

```text
Hash Join  (cost=31.50..1250.40 rows=480 width=40)
  Hash Cond: (o.customer_id = c.id)
  ->  Index Scan using orders_created_at_idx on orders o  (cost=0.43..1200.10 rows=480 width=16)
        Index Cond: (created_at > (now() - '1 day'::interval))
  ->  Hash  (cost=19.00..19.00 rows=1000 width=36)
        ->  Seq Scan on customers c  (cost=0.00..19.00 rows=1000 width=36)
```

**Как читать:**

- план — дерево; выполняется снизу вверх и изнутри наружу, каждый узел отдаёт строки родителю;
- `cost=0.43..1200.10` — стоимость до первой строки и до последней, в условных единицах (за 1 принято последовательное чтение страницы, `seq_page_cost = 1`). Это не миллисекунды;
- `rows` — **оценка** числа строк на выходе узла;
- `width` — средний размер строки в байтах;
- `Index Cond` — условие, применённое через индекс; `Filter` — условие, проверенное после чтения строки.

**Полезные опции:**

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, FORMAT TEXT) ...
```

- `ANALYZE` — реально выполнить и показать фактические времена и строки;
- `BUFFERS` — сколько страниц прочитано из кэша (`shared hit`) и с диска (`read`);
- `VERBOSE` — выходные колонки, имена схем;
- `SETTINGS` (PG 12+) — какие нестандартные параметры планировщика повлияли;
- `GENERIC_PLAN` (PG 16+) — план для запроса с `$1`-параметрами без значений;
- `FORMAT JSON` — для визуализаторов (explain.dalibo.com, explain.depesz.com).

**Зачем на практике:**

- убедиться, что используется ожидаемый индекс;
- найти Seq Scan по большой таблице, неожиданный `Sort` или `Nested Loop` с огромным внешним циклом;
- сравнить оценку `rows` с реальностью (через `EXPLAIN ANALYZE`) — расхождения на порядки почти всегда объясняют плохой план.

**Подвох.** План зависит от статистики, параметров и даже значений: `WHERE status = 'pending'` и `WHERE status = 'done'` могут получить разные планы. Проверять нужно на продакшен-подобных данных — план на пустой dev-базе почти всегда Seq Scan и ничего не говорит.

## Что такое `EXPLAIN ANALYZE`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-explain-analyze
tags: query-planning, transactions
```

`EXPLAIN ANALYZE` **выполняет** запрос и показывает план вместе с фактическими данными: реальное время каждого узла, число строк и число повторений (`loops`). Это главный инструмент разбора медленного запроса — он показывает, где планировщик ошибся в оценках и где на самом деле тратится время.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE customer_id = 42 AND status = 'paid';
```

```text
Index Scan using orders_customer_id_idx on orders
    (cost=0.43..8.45 rows=1 width=64) (actual time=0.031..12.840 rows=5120 loops=1)
  Index Cond: (customer_id = 42)
  Filter: (status = 'paid')
  Rows Removed by Filter: 3010
  Buffers: shared hit=420 read=7310
Planning Time: 0.210 ms
Execution Time: 13.402 ms
```

**Что смотреть:**

- **`rows` оценка против `actual rows`.** Здесь 1 против 5120 — планировщик сильно ошибся. Ошибка на порядки внизу дерева — источник неверного выбора join-а выше.
- **`loops`.** Время и строки в `actual` — средние **на один проход**. У внутреннего узла `Nested Loop` с `loops=50000` реальное время — `actual time × loops`.
- **`Rows Removed by Filter`** — сколько строк прочитали зря; повод для индекса или другого порядка колонок.
- **`Buffers`** — `shared hit` (из `shared_buffers`), `read` (из ОС/диска), `dirtied`/`written`. Сравнивать по буферам надёжнее, чем по миллисекундам: время зависит от прогретости кэша.
- **Узлы сортировки и хеша:** `Sort Method: external merge Disk: 120MB` или `Batches: 8` у `Hash` означают, что не хватило `work_mem`.

**Важные предостережения:**

- **Запрос реально выполняется.** `EXPLAIN ANALYZE DELETE ...` удалит строки. Для DML оборачивать в транзакцию:

```sql
BEGIN;
EXPLAIN ANALYZE UPDATE orders SET status = 'x' WHERE id < 1000;
ROLLBACK;
```

- **Накладные расходы на тайминг.** На запросах с миллионами строк вызовы часов заметно замедляют выполнение; `TIMING OFF` оставляет только строки.
- **Время передачи клиенту не учтено.** Результат не отправляется по сети и не сериализуется; в PG 17 для этого добавили опцию `SERIALIZE`.
- **Холодный и тёплый кэш.** Первый запуск читает с диска, второй — из памяти. Смотреть на `read` в `Buffers`.
- **Триггеры и FK** показываются отдельными строками `Trigger ...: time=...` — частая скрытая причина медленного `DELETE` (нет индекса на ссылающейся колонке).

**Для продакшена** — модуль `auto_explain` с `auto_explain.log_min_duration`, который сам пишет в лог планы медленных запросов, включая фактические цифры при `log_analyze = on`.

## Что такое Sequential Scan?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-sequential-scan
tags: indexes
```

Sequential Scan (Seq Scan) — последовательное чтение всех страниц таблицы от начала до конца с проверкой условия для каждой строки. Это базовый способ доступа, который не требует индексов и выгоден, когда нужно прочитать заметную долю таблицы.

```text
Seq Scan on orders  (cost=0.00..18334.00 rows=5000 width=64)
  Filter: (status = 'cancelled')
  Rows Removed by Filter: 995000
```

**Почему Seq Scan — не всегда плохо.** Последовательное чтение дешевле случайного: ОС и диск читают большими блоками, работает read-ahead. В модели стоимости это отражено напрямую: `seq_page_cost = 1`, `random_page_cost = 4` по умолчанию. Index Scan прыгает по heap случайно, и при выборке, скажем, 20–30% строк уже выгоднее прочитать всё подряд. Точный порог зависит от корреляции данных, размера строки и параметров.

**Когда Seq Scan уместен:**

- маленькие таблицы (справочники в несколько страниц);
- выборки большой доли строк, агрегации по всей таблице;
- нет подходящего индекса — тогда это сигнал, а не норма.

**Когда это проблема:**

- в плане `Seq Scan` по таблице в миллионы строк и `Rows Removed by Filter` почти равен числу строк в таблице — ищется иголка в стоге без индекса;
- Seq Scan во внутренней части `Nested Loop` — таблица читается заново на каждую строку внешнего цикла.

**Механика, о которой спрашивают:**

- **Parallel Seq Scan.** На больших таблицах планировщик может запустить несколько воркеров (`max_parallel_workers_per_gather`, по умолчанию 2); в плане появляется `Gather` над `Parallel Seq Scan`.
- **Ring buffer.** Большие Seq Scan читают таблицу через маленький кольцевой буфер, а не через весь `shared_buffers`, чтобы не вытеснить из кэша «горячие» данные.
- **Synchronized scans.** Если два процесса сканируют одну большую таблицу одновременно, второй подхватывает чтение с текущей позиции первого (`synchronize_seqscans = on`). Поэтому порядок строк без `ORDER BY` не гарантирован даже у одной и той же таблицы.
- **Мёртвые строки.** Seq Scan читает все страницы, включая занятые мёртвыми версиями. Раздутая (bloated) таблица сканируется дольше, хотя живых строк столько же.

**Как понять, что индекс помог бы.** Посмотреть `pg_stat_user_tables`: большое `seq_tup_read` при большом `seq_scan` по крупной таблице — кандидат на индекс. Затем проверить запросы через `EXPLAIN (ANALYZE, BUFFERS)`.

## Что такое Index Scan?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-index-scan
tags: indexes
```

Index Scan — способ доступа, при котором PostgreSQL спускается по индексу, находит TID подходящих записей и для каждой сразу читает строку из heap. Он эффективен, когда строк немного или когда нужен порядок, который даёт индекс.

```text
Index Scan using orders_customer_id_idx on orders  (cost=0.43..52.10 rows=48 width=64)
  Index Cond: (customer_id = 42)
  Filter: (status = 'paid')
```

**Как идёт чтение:** найти в индексе первую запись → взять TID → прочитать страницу heap → проверить видимость строки (MVCC) и `Filter` → следующая запись индекса. Для каждой строки — потенциально случайное чтение страницы. Если строк тысячи и они разбросаны по таблице, это тысячи случайных чтений.

**Index Cond против Filter.** `Index Cond` сужает диапазон в индексе, `Filter` проверяется после чтения строки из heap. Большое `Rows Removed by Filter` — признак, что индекс неполный (не хватает колонки).

**Index Scan отдаёт строки в порядке индекса** — поэтому его выбирают для `ORDER BY ... LIMIT`: можно остановиться после N строк. Именно так работает «последние 20 заказов клиента» без сортировки.

**Index Only Scan** — вариант, когда все нужные колонки есть в индексе:

```sql
CREATE INDEX ON orders (customer_id) INCLUDE (total);
SELECT customer_id, sum(total) FROM orders WHERE customer_id = 42 GROUP BY 1;
```

```text
Index Only Scan using orders_customer_id_total_idx on orders
  Index Cond: (customer_id = 42)
  Heap Fetches: 12
```

В heap заходить не нужно — **но только для страниц, отмеченных all-visible в visibility map**. Для остальных PostgreSQL всё равно проверяет видимость в heap — это `Heap Fetches`. Если таблица часто обновляется, а VACUUM не успевает, Index Only Scan вырождается в обычный. Поэтому для таблиц с ставкой на IOS важен регулярный vacuum.

**Корреляция.** Если физический порядок строк совпадает с порядком индекса (`pg_stats.correlation` около 1), соседние записи индекса указывают на одни и те же страницы heap, и Index Scan дешёвый даже на больших выборках. Планировщик учитывает это в стоимости.

**Сравнение способов доступа:**

| Способ | Когда выгоден |
| --- | --- |
| Index Scan | мало строк, нужен порядок, `LIMIT` |
| Index Only Scan | все колонки в индексе, таблица хорошо провакуумирована |
| Bitmap Index Scan | средняя выборка, несколько условий/индексов |
| Seq Scan | большая доля таблицы, маленькая таблица |

## Что такое Bitmap Index Scan?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-bitmap-index-scan
tags: indexes
```

Bitmap Index Scan — двухфазный способ доступа: сначала по индексу строится **битовая карта** подходящих строк (или страниц), затем `Bitmap Heap Scan` читает эти страницы heap **в физическом порядке**, каждую — один раз. Это компромисс между Index Scan (много случайных чтений) и Seq Scan (читаем всё).

```text
Bitmap Heap Scan on orders  (cost=95.30..6120.44 rows=5100 width=64)
  Recheck Cond: (customer_id = 42)
  Heap Blocks: exact=3870
  ->  Bitmap Index Scan on orders_customer_id_idx  (cost=0.00..94.03 rows=5100 width=0)
        Index Cond: (customer_id = 42)
```

**Почему это быстрее Index Scan на средних выборках.** Index Scan для 5000 строк, разбросанных по 3870 страницам, может читать одну страницу много раз и в случайном порядке. Bitmap собирает все TID, сортирует их по номеру страницы и читает страницы подряд — почти последовательный доступ, каждая страница ровно один раз.

**Объединение индексов.** Битовые карты легко пересекать и объединять:

```sql
SELECT * FROM orders WHERE customer_id = 42 OR seller_id = 7;
```

```text
Bitmap Heap Scan on orders
  Recheck Cond: ((customer_id = 42) OR (seller_id = 7))
  ->  BitmapOr
        ->  Bitmap Index Scan on orders_customer_id_idx
        ->  Bitmap Index Scan on orders_seller_id_idx
```

Аналогично `BitmapAnd` для `AND` по двум одиночным индексам. Это единственный способ эффективно обработать `OR` по разным колонкам.

**Lossy-страницы и `Recheck Cond`.** Карта хранится в памяти размером до `work_mem`. Если не помещается, PostgreSQL переходит от «точных» битов на строки к битам на целые страницы:

```text
Heap Blocks: exact=1200 lossy=48000
Rows Removed by Index Recheck: 2400000
```

Для lossy-страниц приходится перепроверять условие на каждой строке страницы — это и есть `Recheck`. Много `lossy` — повод увеличить `work_mem` для этого запроса.

**Особенности:**

- порядок индекса теряется — для `ORDER BY` нужен отдельный `Sort`, поэтому с `LIMIT` Bitmap обычно проигрывает Index Scan;
- GIN и BRIN работают **только** через Bitmap Scan;
- предвыборка страниц регулируется `effective_io_concurrency` (по умолчанию 1 в PG 15–17, 16 — с PG 18; на SSD имеет смысл больше).

**Типичный сценарий выбора планировщиком:** Index Scan для единиц строк, Bitmap — от сотен до десятков тысяч, Seq Scan — когда выбирается значительная доля таблицы.

## Почему PostgreSQL иногда не использует индекс?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-pochemu-postgresql-inogda-ne-ispolzuet-indeks
tags: indexes
```

Потому что планировщик стоимостной: он не обязан использовать индекс, а выбирает план с наименьшей **оценённой** стоимостью. Индекс игнорируется либо потому, что Seq Scan действительно дешевле, либо потому, что индекс не подходит к запросу, либо потому, что оценки неверны.

**1. Seq Scan действительно дешевле.** Условию соответствует большая доля строк, или таблица маленькая. Каждая строка через индекс — это случайное чтение страницы heap (`random_page_cost = 4` против `seq_page_cost = 1`). Пример: `WHERE country = 'RU'` при 70% российских пользователей.

**2. Индекс не подходит к выражению в запросе.**

```sql
WHERE lower(email) = 'a@b.c'
WHERE created_at::date = '2025-01-01'
WHERE phone = 79001234567
```

Функция над колонкой, приведение типа, сравнение `varchar`-колонки с числом — индекс по «голой» колонке не применим. Сюда же — условие не на ведущую колонку составного индекса.

**3. Неверная статистика.** После массовой загрузки или удаления `ANALYZE` ещё не прошёл, и планировщик считает, что строк 1000, а их 10 млн (или наоборот). Проверка: сравнить `rows` и `actual rows` в `EXPLAIN ANALYZE`.

```sql
SELECT relname, last_analyze, last_autoanalyze, n_mod_since_analyze
FROM pg_stat_user_tables WHERE relname = 'orders';
```

**4. Неудачные параметры стоимости.** `random_page_cost = 4` рассчитан на HDD. На SSD/NVMe с данными в памяти разумно 1.1–1.5 — иначе планировщик переоценивает стоимость индексного доступа. `effective_cache_size` (по умолчанию 4 ГБ) подсказывает, сколько данных, вероятно, закэшировано: заниженное значение тоже толкает к Seq Scan.

**5. Плохая корреляция.** Строки, которые ищем, разбросаны по всей таблице — даже 5% строк могут лежать на 100% страниц. Тогда Seq Scan или Bitmap Scan честно выигрывают.

**6. `LIMIT` и сортировка.** Иногда наоборот: планировщик выбирает индекс по `ORDER BY` и надеется быстро набрать `LIMIT` строк, а нужные строки оказываются в конце — запрос сканирует почти весь индекс. Классика: `WHERE status = 'rare' ORDER BY id LIMIT 10`.

**Как разбираться:**

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;

SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
RESET enable_seqscan;
```

Если с принудительным индексом запрос быстрее — проблема в оценках или параметрах стоимости: обновить статистику (`ANALYZE`), поднять `default_statistics_target` для колонки, создать расширенную статистику, поправить `random_page_cost`. Если медленнее — планировщик прав, и нужен другой индекс (частичный, составной, покрывающий) или другой запрос.

`enable_*`-параметры — только для диагностики. В PostgreSQL нет хинтов в ядре (есть расширение `pg_hint_plan`), и правильная реакция — исправить причину, а не форсировать план.

## Что такое selectivity/cardinality?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-selectivity-cardinality
tags: query-planning
```

**Selectivity** (селективность) — доля строк, которая проходит условие: от 0 до 1. **Cardinality** в контексте планов — ожидаемое число строк на выходе узла (`rows` в `EXPLAIN`), то есть `строк в таблице × селективность`. Отдельно «cardinality колонки» означает число различных значений (`n_distinct`).

Пример: в `orders` 10 млн строк, `status = 'pending'` у 0,1%. Селективность 0.001, кардинальность результата ~10 000. Высокая селективность в разговорной речи означает «условие отсекает почти всё» — тогда индекс выгоден.

**Откуда планировщик это знает.** Из статистики, которую собирает `ANALYZE` по выборке строк и хранит в `pg_statistic` (читаемый вид — `pg_stats`):

```sql
SELECT attname, n_distinct, null_frac, most_common_vals, most_common_freqs, correlation
FROM pg_stats
WHERE tablename = 'orders' AND attname = 'status';
```

- `most_common_vals` / `most_common_freqs` (MCV) — частые значения и их доли;
- `histogram_bounds` — гистограмма для остальных значений, используется для диапазонов;
- `n_distinct` — число различных значений (отрицательное — доля от числа строк);
- `null_frac` — доля `NULL`;
- `correlation` — насколько физический порядок совпадает с логическим.

Для `status = 'pending'` планировщик берёт частоту из MCV. Для значения не из MCV — оставшаяся доля делится на оставшиеся различные значения. Для `created_at > X` — доля корзин гистограммы.

**Почему это так важно.** Ошибка в оценке кардинальности — причина большинства плохих планов. Если планировщик ждёт 10 строк, а приходит 1 млн, он выберет `Nested Loop` с Index Scan вместо `Hash Join`, и запрос будет работать минуты. Ошибка внизу дерева умножается на каждом соединении выше.

**Типичные источники ошибок:**

- **Корреляция условий.** `WHERE city = 'Москва' AND region = 'Московская обл.'` — планировщик по умолчанию перемножает селективности, считая колонки независимыми, и сильно недооценивает результат. Лечится `CREATE STATISTICS`.
- **Устаревшая статистика** после массовой загрузки.
- **Перекос данных** (skew), когда частое значение не попало в MCV — увеличить `ALTER TABLE ... ALTER COLUMN ... SET STATISTICS 1000` (по умолчанию `default_statistics_target = 100`).
- **Выражения и функции** без статистики — используются захардкоженные дефолтные селективности.

**Как увидеть:** `EXPLAIN ANALYZE` и сравнить `rows=` (оценка) с `actual ... rows=` (факт). Расхождение в 10 раз и больше — повод разбираться.

## Что такое VACUUM?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-vacuum
tags: transactions
```

VACUUM — операция обслуживания, которая очищает таблицу от **мёртвых версий строк**, оставшихся после `UPDATE` и `DELETE` из-за MVCC, и делает это место доступным для новых строк. Попутно она обновляет visibility map и замораживает старые XID, защищая от transaction ID wraparound.

**Почему он нужен.** В PostgreSQL `UPDATE` не перезаписывает строку, а создаёт новую версию; старая остаётся в таблице, пока может быть видна какой-то транзакции. `DELETE` только помечает строку удалённой. Без очистки таблица и индексы бесконечно растут.

**Что делает обычный `VACUUM`:**

1. Находит версии строк, которые мертвы для **всех** транзакций (старее горизонта `xmin` самой старой активной транзакции).
2. Удаляет ссылки на них из всех индексов.
3. Освобождает место на страницах и записывает его в free space map — новые строки займут это место.
4. Обновляет visibility map (страницы all-visible позволяют Index Only Scan и пропуск страниц при следующем vacuum).
5. Замораживает (freeze) достаточно старые строки.
6. Может отрезать пустые страницы в конце файла и вернуть их ОС.

Обычный `VACUUM` работает параллельно с чтением и записью (берёт `SHARE UPDATE EXCLUSIVE`, конфликтующий только с DDL и другим vacuum). Но он **не уменьшает файл** таблицы, если свободное место не в конце: оно переиспользуется, а не возвращается.

**Варианты:**

| Команда | Что делает | Блокировка |
| --- | --- | --- |
| `VACUUM` | очистка, место переиспользуется | не мешает DML |
| `VACUUM ANALYZE` | плюс обновление статистики | не мешает DML |
| `VACUUM FREEZE` | агрессивная заморозка всех строк | не мешает DML |
| `VACUUM FULL` | полная перезапись таблицы и индексов, файл сжимается | `ACCESS EXCLUSIVE`: таблица недоступна даже на чтение |

```sql
VACUUM (VERBOSE, ANALYZE) orders;
```

**Что мешает VACUUM чистить:** долгие транзакции и `idle in transaction`-сессии, забытые prepared transactions, неактивные слоты репликации, `hot_standby_feedback` с долгими запросами на реплике. Всё это держит горизонт `xmin` — мёртвые строки считаются ещё нужными. В `VACUUM VERBOSE` это видно как `dead but not yet removable`.

**На практике** VACUUM вручную запускают редко — этим занимается autovacuum. Ручной нужен после массовых операций (большой `DELETE`, загрузка данных) и при борьбе с bloat. `VACUUM FULL` в продакшене под нагрузкой не запускают — для сжатия таблицы без долгой блокировки используют `pg_repack`.

## Что такое ANALYZE?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-analyze
tags: transactions
```

`ANALYZE` собирает статистику о распределении данных в таблице и сохраняет её в `pg_statistic`. Планировщик использует эту статистику, чтобы оценить, сколько строк вернёт каждое условие, и выбрать план. Без актуальной статистики планы становятся случайными.

```sql
ANALYZE orders;
ANALYZE orders (status, created_at);
ANALYZE VERBOSE;
```

**Как работает.** `ANALYZE` не читает всю таблицу, а берёт случайную выборку: `300 × default_statistics_target` строк (при значении по умолчанию 100 — 30 000 строк), независимо от размера таблицы. По выборке он считает для каждой колонки:

- долю `NULL` (`null_frac`), средний размер (`avg_width`);
- число различных значений (`n_distinct`);
- самые частые значения и их частоты (MCV);
- гистограмму для остальных значений (`histogram_bounds`);
- корреляцию физического и логического порядка (`correlation`).

Плюс обновляет `pg_class.reltuples` и `relpages` — оценку числа строк и страниц.

**Чем `ANALYZE` отличается от `EXPLAIN ANALYZE`.** Ничем, кроме слова: первое — сбор статистики, второе — выполнение запроса с замером. На собеседовании их путают.

**Когда статистика устаревает:**

- после массовой загрузки (`COPY`, большой `INSERT ... SELECT`) — autoanalyze сработает, но не мгновенно;
- новая таблица или временная таблица — **autovacuum не обрабатывает временные таблицы**, `ANALYZE` для них нужно вызывать явно;
- после `CREATE INDEX` по выражению — статистика по выражению появится только после `ANALYZE`;
- после `pg_upgrade` статистика не переносилась до PG 18 — сразу после апгрейда нужен `vacuumdb --all --analyze-in-stages`.

**Тонкая настройка:**

```sql
ALTER TABLE orders ALTER COLUMN customer_id SET STATISTICS 1000;
ANALYZE orders;
```

Увеличивает размер выборки, MCV-списка и гистограммы для колонки с перекосом. Цена — чуть более долгое планирование и `ANALYZE`.

Для коррелированных колонок есть расширенная статистика (`CREATE STATISTICS`), которая тоже наполняется командой `ANALYZE`.

**Автоматически** статистику обновляет autovacuum (autoanalyze), когда число изменённых строк превышает `autovacuum_analyze_threshold + autovacuum_analyze_scale_factor × reltuples` (по умолчанию 50 + 10% таблицы). Для таблицы в 100 млн строк это 10 млн изменений — на больших таблицах порог часто снижают.

**Блокировки:** `ANALYZE` берёт `SHARE UPDATE EXCLUSIVE` и не мешает чтению и записи, его безопасно запускать в продакшене.

## Что такое autovacuum?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-autovacuum
tags: transactions
```

Autovacuum — фоновый механизм PostgreSQL, который сам запускает `VACUUM` и `ANALYZE` для таблиц, где накопилось достаточно изменений. Он включён по умолчанию, и отключать его почти никогда нельзя: без него таблицы распухают, статистика устаревает, а в пределе база останавливается из-за wraparound.

**Как устроен.** Процесс `autovacuum launcher` раз в `autovacuum_naptime` (по умолчанию 1 мин) обходит базы и запускает `autovacuum worker`-ы — не более `autovacuum_max_workers` (по умолчанию 3) одновременно на весь кластер. Каждый воркер обрабатывает таблицы, которым это нужно.

**Когда таблица попадает в работу:**

| Действие | Порог (по умолчанию) |
| --- | --- |
| VACUUM по мёртвым строкам | `n_dead_tup > 50 + 0.2 × reltuples` |
| VACUUM по вставкам (PG 13+) | `вставлено > 1000 + 0.2 × reltuples` |
| ANALYZE | `изменено > 50 + 0.1 × reltuples` |
| Anti-wraparound VACUUM | возраст `relfrozenxid` > `autovacuum_freeze_max_age` (200 млн) |

Параметры: `autovacuum_vacuum_threshold`, `autovacuum_vacuum_scale_factor`, `autovacuum_vacuum_insert_threshold`, `autovacuum_vacuum_insert_scale_factor`, `autovacuum_analyze_threshold`, `autovacuum_analyze_scale_factor`.

Порог «20% таблицы» означает, что в таблице на 500 млн строк vacuum придёт только после 100 млн мёртвых строк — поэтому для больших таблиц scale factor уменьшают на уровне таблицы:

```sql
ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.02
);
```

**Throttling.** Чтобы не мешать основной нагрузке, autovacuum работает с задержками: набрав «стоимость» `autovacuum_vacuum_cost_limit` (по умолчанию -1, то есть берётся `vacuum_cost_limit = 200`, общий лимит делится между воркерами), он спит `autovacuum_vacuum_cost_delay` (2 мс с PG 12). На больших и нагруженных базах эти значения слишком консервативны.

**Как следить:**

```sql
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze, autovacuum_count
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 20;

SELECT pid, relid::regclass, phase, heap_blks_scanned, heap_blks_total
FROM pg_stat_progress_vacuum;
```

Плюс `log_autovacuum_min_duration` (с PG 15 по умолчанию 10 минут) — логирует долгие прогоны.

**Типичные проблемы:**

- autovacuum запущен, но не может удалить строки из-за долгой транзакции — нужно искать её, а не тюнить vacuum;
- воркеров мало, и они застревают на огромных таблицах, пока маленькие горячие таблицы раздуваются;
- autovacuum автоматически отменяется, если кто-то ждёт конфликтующую блокировку (DDL) — **кроме** anti-wraparound vacuum, который не уступает;
- ручное «отключение autovacuum на время загрузки» потом забывают включить.

## Что такое MVCC?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-mvcc
tags: transactions
```

MVCC (Multi-Version Concurrency Control) — способ конкурентного доступа, при котором каждая транзакция видит **согласованный снимок** данных, а изменения создают новые версии строк вместо перезаписи старых. Главное следствие: чтение не блокирует запись, а запись не блокирует чтение.

**Как это выглядит снаружи:**

```sql
BEGIN;
SELECT balance FROM accounts WHERE id = 1;

BEGIN;
UPDATE accounts SET balance = 50 WHERE id = 1;
COMMIT;
```

Первая сессия не ждала вторую, вторая не ждала первую. Пока вторая транзакция не закоммитилась, первая видит старое значение; после коммита — зависит от уровня изоляции: в Read Committed следующий запрос увидит 50, в Repeatable Read — по-прежнему старое значение до конца транзакции.

**Как это реализовано в PostgreSQL (кратко).** У каждой версии строки есть служебные поля `xmin` (какая транзакция создала версию) и `xmax` (какая удалила или заблокировала). Транзакция при старте запроса или транзакции берёт **snapshot** — список транзакций, которые на этот момент ещё не завершены. Версия видна, если её `xmin` закоммичен и попадает в снимок, а `xmax` — нет.

```sql
SELECT xmin, xmax, ctid, * FROM accounts WHERE id = 1;
```

`UPDATE` = пометить старую версию `xmax` + вставить новую версию с новым `xmin`. `DELETE` = только пометить `xmax`.

**Чем MVCC не является:**

- он не отменяет блокировки между **писателями**: два `UPDATE` одной строки всё равно выстроятся в очередь — второй ждёт коммита или отката первого;
- он не даёт сериализуемость сам по себе — аномалии вроде write skew возможны на Repeatable Read.

**Цена MVCC в PostgreSQL:**

- **Мёртвые версии** остаются прямо в таблице (в отличие от Oracle/MySQL InnoDB, где старые версии лежат в undo-логе). Их убирает VACUUM; если он не успевает — bloat.
- **Долгие транзакции** держат горизонт видимости: пока открыта транзакция, начатая час назад, ни одна версия строки, изменённая за этот час, не может быть удалена.
- **UPDATE дороже**, чем в базах с обновлением на месте: новая версия + потенциально новые записи во всех индексах (если не сработал HOT).
- **`count(*)` нельзя взять из метаданных**: видимость каждой строки зависит от снимка конкретной транзакции.
- **32-битный XID** требует периодической заморозки, иначе — wraparound.

**Что спрашивают дальше:** что такое HOT-update, почему `UPDATE` всех строк таблицы удваивает её размер, как долгая транзакция на реплике (`hot_standby_feedback`) влияет на bloat мастера.

## Что такое transaction?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-transaction
tags: transactions
```

Транзакция — группа операций, которая выполняется как одно целое: либо все изменения фиксируются (`COMMIT`), либо ни одно (`ROLLBACK`). Свойства транзакций описывает аббревиатура **ACID**.

| Свойство | Смысл | Чем обеспечивается в PostgreSQL |
| --- | --- | --- |
| Atomicity | всё или ничего | статус транзакции в `pg_xact` (CLOG): версии строк невидимы, пока транзакция не закоммичена |
| Consistency | данные переходят из одного корректного состояния в другое | ограничения: `PK`, `FK`, `CHECK`, `UNIQUE`, `EXCLUDE` |
| Isolation | параллельные транзакции не мешают друг другу | MVCC, snapshot, уровни изоляции, блокировки |
| Durability | после `COMMIT` данные не потеряются | WAL сбрасывается на диск до подтверждения коммита |

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

**Autocommit.** Если не открыть транзакцию явно, каждый оператор выполняется в своей транзакции. В Npgsql это поведение по умолчанию; `BeginTransaction()` отправляет `BEGIN`. EF Core оборачивает каждый `SaveChanges` в транзакцию сам.

**Ошибка внутри транзакции.** После любой ошибки транзакция переходит в состояние aborted: все следующие команды получают `current transaction is aborted, commands ignored until end of transaction block`, пока не будет `ROLLBACK`. Частичный откат делается через `SAVEPOINT`:

```sql
BEGIN;
INSERT INTO log VALUES (1);
SAVEPOINT s1;
INSERT INTO log VALUES (1);
ROLLBACK TO SAVEPOINT s1;
COMMIT;
```

Савепоинты не бесплатны: каждый создаёт subtransaction, а при большом их числе (больше 64 в одной транзакции) производительность заметно проседает из-за переполнения кэша subtransaction-ов.

**Транзакционный DDL.** В PostgreSQL `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX` откатываются вместе с транзакцией. Исключения — команды, которые нельзя выполнять внутри блока транзакции: `CREATE INDEX CONCURRENTLY`, `VACUUM`, `CREATE DATABASE`, `ALTER SYSTEM`.

**Практические правила:**

- транзакции должны быть **короткими**: долгая транзакция держит блокировки и мешает VACUUM;
- не делать внутри транзакции HTTP-вызовы и ожидание пользователя;
- `idle in transaction` — опасное состояние: приложение открыло транзакцию и не закрывает её. Защита — `idle_in_transaction_session_timeout`;
- `COMMIT` не происходит, пока WAL не записан на диск (при `synchronous_commit = on`), — именно поэтому много мелких транзакций медленнее одной пачки.

## Какие уровни изоляции транзакций существуют?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-kakie-urovni-izolyacii-tranzakcii-suschestvuyut
tags: transactions
```

Стандарт SQL определяет четыре уровня: **Read Uncommitted**, **Read Committed**, **Repeatable Read**, **Serializable**. Они различаются тем, какие аномалии параллельного выполнения допускаются. В PostgreSQL по умолчанию — **Read Committed**, а реально различных уровня три: Read Uncommitted ведёт себя как Read Committed.

**Аномалии и уровни по стандарту и в PostgreSQL:**

| Уровень | Dirty read | Non-repeatable read | Phantom read | Serialization anomaly |
| --- | --- | --- | --- | --- |
| Read Uncommitted | стандарт допускает, **в PG нет** | возможно | возможно | возможно |
| Read Committed | нет | возможно | возможно | возможно |
| Repeatable Read | нет | нет | стандарт допускает, **в PG нет** | возможно |
| Serializable | нет | нет | нет | нет |

**Как это реализовано в PostgreSQL:**

- **Read Committed** — снимок берётся на **каждый оператор**. Каждый `SELECT` видит всё, что закоммичено до его начала.
- **Repeatable Read** — снимок берётся один раз на **первый оператор** транзакции (не на `BEGIN`). Это snapshot isolation: фантомов нет, но возможны аномалии вроде write skew. При попытке изменить строку, которую уже изменила параллельная закоммиченная транзакция, — ошибка `could not serialize access due to concurrent update` (SQLSTATE `40001`).
- **Serializable** — Serializable Snapshot Isolation (SSI): тот же снимок плюс отслеживание зависимостей чтения-записи между транзакциями. Если набор транзакций не мог бы выполниться последовательно, одна из них получает `40001`.

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
ALTER DATABASE app SET default_transaction_isolation = 'repeatable read';
SHOW transaction_isolation;
```

В Npgsql: `connection.BeginTransaction(IsolationLevel.RepeatableRead)`; в EF Core — `Database.BeginTransaction(IsolationLevel.Serializable)`.

**Главное практическое следствие.** На уровнях выше Read Committed приложение **обязано** уметь повторять транзакцию при ошибке `40001` — это не баг, а штатное поведение. Повтор должен включать перечитывание данных, то есть повторять всю транзакцию целиком, а не только последний оператор.

**Как выбирать:**

- **Read Committed** — дефолт для большинства OLTP-операций; гонки решаются атомарными `UPDATE ... SET x = x + 1`, `SELECT ... FOR UPDATE`, уникальными ограничениями.
- **Repeatable Read** — отчёты и выгрузки, которым нужна согласованная картина из нескольких запросов (так работает `pg_dump`).
- **Serializable** — сложные инварианты между строками, которые трудно выразить блокировками, при готовности к ретраям.

**Что спрашивают дальше:** какие аномалии остаются на Repeatable Read (write skew, read-only anomaly), чем Repeatable Read в PostgreSQL отличается от MySQL.

## Что такое Read Committed?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-read-committed
tags: transactions
```

Read Committed — уровень изоляции по умолчанию в PostgreSQL. Каждый **оператор** внутри транзакции видит данные, закоммиченные до начала этого оператора. Незакоммиченные изменения других транзакций не видны никогда, но два одинаковых `SELECT` в одной транзакции могут вернуть разное.

```sql
BEGIN;
SELECT balance FROM accounts WHERE id = 1;
SELECT balance FROM accounts WHERE id = 1;
COMMIT;
```

Если между двумя `SELECT` другая транзакция закоммитила `UPDATE`, второй запрос увидит новое значение. Это non-repeatable read, и на Read Committed он разрешён.

**Как ведут себя `UPDATE` и `DELETE` при конфликте.** Это самое интересное место уровня:

```sql
UPDATE accounts SET balance = balance - 100
WHERE id = 1 AND balance >= 100;
```

1. Оператор находит строку по своему снимку.
2. Если строку уже изменяет другая транзакция — ждёт её завершения.
3. Если та откатилась — работает со старой версией.
4. Если закоммитилась — PostgreSQL берёт **новую версию** строки, заново проверяет `WHERE` (механизм EvalPlanQual) и, если условие всё ещё выполняется, обновляет её.

Поэтому атомарные операции вида `SET balance = balance - 100 WHERE balance >= 100` на Read Committed безопасны: списания не потеряются и баланс не уйдёт в минус.

**Где Read Committed подводит — read-modify-write в приложении:**

```csharp
var balance = await db.QuerySingleAsync<decimal>("SELECT balance FROM accounts WHERE id = 1");
await db.ExecuteAsync("UPDATE accounts SET balance = @b WHERE id = 1", new { b = balance - 100 });
```

Две параллельные операции прочитают одно и то же значение и запишут одно и то же — классический **lost update**. Решения на Read Committed:

- атомарный `UPDATE` с выражением вместо чтения в приложение;
- `SELECT ... FOR UPDATE` перед изменением;
- оптимистичная блокировка по версии (`WHERE id = 1 AND version = @v`, в EF Core — concurrency token, в PostgreSQL удобно `xmin`);
- поднять уровень до Repeatable Read и ретраить при `40001`.

**Странности повторной проверки.** Повторная проверка `WHERE` касается только обновляемой строки. Подзапросы и соединения не перевычисляются по новому снимку, поэтому сложные `UPDATE ... FROM` с конкурентными изменениями могут дать неочевидный результат. Для таких случаев — явные блокировки или более строгий уровень.

**Почему это дефолт:** нет ошибок сериализации, которые нужно ретраить, минимум ожиданий, и для большинства CRUD-операций гарантий хватает при правильно написанных запросах.

## Что такое Repeatable Read?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-repeatable-read
tags: transactions
```

Repeatable Read гарантирует, что все запросы транзакции видят **один и тот же снимок** данных — тот, что был на момент первого оператора транзакции. Изменения, закоммиченные другими после этого, не видны. В PostgreSQL этот уровень реализован как snapshot isolation и строже стандарта: фантомные чтения тоже исключены.

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT count(*) FROM orders WHERE status = 'new';
SELECT count(*) FROM orders WHERE status = 'new';
COMMIT;
```

Оба запроса вернут одно и то же число, даже если параллельно вставляются и закоммичиваются новые заказы.

**Важная деталь: снимок берётся не на `BEGIN`, а на первом запросе.** `BEGIN; ... долгая пауза ...; SELECT` — снимок будет «свежим» на момент `SELECT`.

**Конфликт записи.** Если транзакция пытается изменить или заблокировать строку, которую после начала её снимка изменила другая, уже закоммиченная транзакция, она получает ошибку:

```text
ERROR:  could not serialize access due to concurrent update
SQLSTATE: 40001
```

В отличие от Read Committed, PostgreSQL не «переключается» на новую версию строки: это нарушило бы снимок. Отсюда главное следствие: **lost update невозможен**, но приложение обязано повторять транзакцию целиком при `40001`.

**Что Repeatable Read не защищает — write skew.** Две транзакции читают пересекающиеся данные, принимают решение и меняют **разные** строки:

```sql
SELECT count(*) FROM doctors WHERE on_call;
UPDATE doctors SET on_call = false WHERE id = 1;
```

Две транзакции одновременно видят «дежурных двое», каждая снимает с дежурства своего врача — в итоге ноль дежурных. Конфликта записи нет: изменены разные строки. Защита — `SELECT ... FOR UPDATE` по проверяемым строкам, ограничение в схеме или уровень Serializable.

**Когда использовать:**

- отчёты и выгрузки из нескольких запросов, которым нужна согласованная картина (так работает `pg_dump`);
- read-modify-write операции, где lost update недопустим, а ретраи реализованы;
- длинные read-only транзакции на реплике для аналитики — с оглядкой на то, что они держат горизонт VACUUM.

**Цена:** долгие Repeatable Read-транзакции держат старый снимок, и VACUUM не может удалить версии строк, изменённые с момента его создания. Под нагрузкой записи — рост bloat.

**Отличие от MySQL InnoDB:** там Repeatable Read — дефолт, а `UPDATE` работает с последней закоммиченной версией (current read) без ошибки сериализации, поэтому lost update возможен и защищаются через `SELECT ... FOR UPDATE`.

## Что такое Serializable?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-serializable
tags: transactions
```

Serializable — самый строгий уровень изоляции: результат параллельного выполнения транзакций гарантированно такой же, как при **каком-то последовательном** их выполнении. В PostgreSQL он реализован как Serializable Snapshot Isolation (SSI): транзакции не блокируют друг друга сильнее, чем на Repeatable Read, но база отслеживает опасные зависимости и откатывает одну из транзакций ошибкой `40001`.

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT count(*) FROM doctors WHERE on_call;
UPDATE doctors SET on_call = false WHERE id = 1;
COMMIT;
```

Write skew из примера с дежурными врачами здесь невозможен: одна из двух транзакций получит

```text
ERROR:  could not serialize access due to read/write dependencies among transactions
```

**Как работает SSI.** Поверх снимка Repeatable Read PostgreSQL ставит **предикатные блокировки** (`SIReadLock`) на прочитанное — на строки, страницы индекса или целые таблицы. Они ничего не блокируют, а только фиксируют «эта транзакция это читала». Если транзакция A прочитала то, что потом изменила B, — это rw-зависимость. Опасная структура — две такие зависимости подряд (A → B → C) с определёнными условиями коммита; тогда одна транзакция откатывается.

```sql
SELECT locktype, relation::regclass, page, tuple, mode
FROM pg_locks WHERE mode = 'SIReadLock';
```

**Ложные срабатывания.** SSI консервативен: он может откатить транзакцию, которая на деле не нарушила бы сериализуемость. Их доля растёт, когда:

- запрос читает через Seq Scan — блокировка ставится на всю таблицу, и любая запись в неё создаёт зависимость; с индексами блокировки точнее;
- предикатных блокировок слишком много — они укрупняются до страницы и отношения (лимиты `max_pred_locks_per_transaction`, по умолчанию 64, и `max_pred_locks_per_relation`, `max_pred_locks_per_page`).

**Практические правила:**

- **Ретраи обязательны** — оборачивать транзакцию в цикл повтора по SQLSTATE `40001` (в Npgsql — `PostgresException.SqlState == "40001"`, `IsTransient` для таких ошибок true). Ретрай — это повторное выполнение всей бизнес-операции.
- **Короткие транзакции** — чем дольше транзакция, тем больше шанс конфликта.
- **Все участники должны быть Serializable.** Гарантия распространяется только на транзакции этого уровня; транзакция на Read Committed может «проскользнуть» мимо проверки.
- `READ ONLY` транзакции объявлять явно: для них возможны оптимизации, а `SERIALIZABLE READ ONLY DEFERRABLE` ждёт безопасного снимка и потом выполняется без риска отката — удобно для долгих отчётов.

**Когда выбирать:** сложные инварианты между строками и таблицами («не больше N активных записей», «сумма лимитов не превышает»), которые трудно и хрупко закрывать явными `FOR UPDATE`. Цена — накладные расходы на отслеживание и процент откатов под конкурентной нагрузкой. В высоконагруженных горячих точках иногда проще и предсказуемее явные блокировки на Read Committed.

## Что такое dirty read?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-dirty-read
tags: transactions
```

Dirty read («грязное чтение») — ситуация, когда транзакция видит изменения другой транзакции, которая ещё **не закоммичена**. Если та потом откатится, первая транзакция успеет принять решение на основе данных, которых никогда не существовало.

```text
T1: UPDATE accounts SET balance = 0 WHERE id = 1;
T2: SELECT balance FROM accounts WHERE id = 1;
T1: ROLLBACK;
```

При dirty read T2 увидит 0, хотя реально баланс не менялся.

**В PostgreSQL dirty read невозможен ни на одном уровне.** Даже если указать `READ UNCOMMITTED`, PostgreSQL выполнит транзакцию как `READ COMMITTED`:

```sql
BEGIN ISOLATION LEVEL READ UNCOMMITTED;
SHOW transaction_isolation;
```

Команда покажет `read uncommitted` — уровень формально принят, но поведение будет как у Read Committed.

**Почему так получается само собой — из-за MVCC.** Видимость версии строки определяется по её `xmin`: версия видна, только если транзакция-создатель закоммичена и попадает в снимок читателя. Незакоммиченная версия физически лежит в таблице, но для всех остальных она невидима — им отдаётся предыдущая закоммиченная версия. Чтобы показывать «грязные» данные, PostgreSQL пришлось бы специально нарушать собственную модель видимости, и выигрыша в скорости это не дало бы: читатели и так не ждут писателей.

**Где dirty read встречается.** В СУБД с блокировочной моделью, например SQL Server без `READ_COMMITTED_SNAPSHOT`: там `READ UNCOMMITTED` или хинт `WITH (NOLOCK)` позволяет читать, не дожидаясь снятия блокировок писателя. Ценой этого могут быть не только незакоммиченные значения, но и пропущенные или повторно прочитанные строки при расщеплении страниц.

**Что спрашивают дальше:** чем dirty read отличается от non-repeatable read (во втором случае чужие изменения закоммичены — данные реальные, просто изменились между запросами), есть ли в PostgreSQL аналог `NOLOCK` (нет и не нужен — чтение не блокируется писателями).

## Что такое non-repeatable read?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-non-repeatable-read
tags: transactions
```

Non-repeatable read (неповторяющееся чтение) — ситуация, когда транзакция дважды читает **одну и ту же строку** и получает разные значения, потому что между чтениями другая транзакция изменила или удалила эту строку и закоммитилась.

```text
T1: BEGIN;
T1: SELECT price FROM products WHERE id = 7;
T2: UPDATE products SET price = 120 WHERE id = 7; COMMIT;
T1: SELECT price FROM products WHERE id = 7;
T1: COMMIT;
```

На Read Committed (дефолт PostgreSQL) первый запрос вернёт старую цену, второй — 120. Каждый оператор берёт свежий снимок, поэтому это ожидаемое поведение уровня.

**Отличие от соседних аномалий:**

- **dirty read** — видны незакоммиченные изменения (в PostgreSQL невозможно);
- **non-repeatable read** — меняется значение уже прочитанной строки;
- **phantom read** — меняется **набор** строк по условию (появились новые строки).

**Чем опасно на практике.** Сама по себе аномалия не ломает данные, проблемы возникают, когда решение принимается по нескольким чтениям:

- отчёт, который считает итог одним запросом, а детализацию другим — суммы не сходятся;
- проверка «цена не изменилась» в одном запросе и расчёт заказа по цене из другого;
- read-modify-write в коде приложения: прочитали, посчитали, записали поверх чужого изменения (lost update).

**Как защититься:**

1. **Repeatable Read** — снимок фиксируется на первом запросе транзакции, повторное чтение вернёт то же значение:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT price FROM products WHERE id = 7;
SELECT price FROM products WHERE id = 7;
COMMIT;
```

2. **Блокировка строки** — `SELECT ... FOR SHARE` или `FOR UPDATE` не даст другим изменить строку до конца транзакции. На Read Committed этого достаточно для конкретных строк.
3. **Один запрос вместо нескольких** — всё, что должно быть согласовано, читать одним оператором (CTE, соединение): внутри одного оператора снимок всегда один.
4. **Перенести логику в атомарный `UPDATE`**, если цель — изменить значение на основе текущего.

**Что спрашивают дальше:** почему в PostgreSQL на Repeatable Read при попытке обновить строку, изменённую другой транзакцией, возникает ошибка, а не ожидание (snapshot нельзя «сдвинуть», поэтому `40001` и ретрай).

## Что такое phantom read?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-phantom-read
tags: transactions
```

Phantom read (фантомное чтение) — транзакция дважды выполняет запрос с **одним и тем же условием** и получает разный набор строк, потому что другая транзакция вставила (или удалила) строки, подходящие под условие, и закоммитилась.

```text
T1: BEGIN;
T1: SELECT count(*) FROM orders WHERE customer_id = 5 AND status = 'new';
T2: INSERT INTO orders (customer_id, status) VALUES (5, 'new'); COMMIT;
T1: SELECT count(*) FROM orders WHERE customer_id = 5 AND status = 'new';
```

На Read Committed второй запрос увидит новую строку — «фантом».

**Отличие от non-repeatable read.** Там меняется уже прочитанная строка, и её можно защитить блокировкой строки. Фантом — это строка, которой **ещё не было** в момент первого чтения, поэтому заблокировать её через `FOR UPDATE` нельзя: блокировать нечего.

**Что даёт PostgreSQL:**

| Уровень | Фантомы |
| --- | --- |
| Read Committed | возможны |
| Repeatable Read | **невозможны** (по стандарту допускаются, но snapshot isolation их исключает) |
| Serializable | невозможны |

На Repeatable Read оба запроса работают с одним снимком, и новая строка невидима.

**Но «не видеть фантом» и «защититься от него» — разные вещи.** Классическая задача: «у клиента может быть не больше 3 активных заказов».

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT count(*) FROM orders WHERE customer_id = 5 AND status = 'new';
INSERT INTO orders (customer_id, status) VALUES (5, 'new');
COMMIT;
```

Две такие транзакции параллельно видят по 2 заказа, каждая вставляет свой — заказов 4. Конфликта записи нет: вставлены разные строки. Это write skew на фантоме, и Repeatable Read его не ловит.

**Способы защиты:**

- **Serializable** — SSI заметит, что каждая транзакция читала диапазон, в который другая вставила строку, и откатит одну из них с `40001`;
- **блокировка «родителя»** — `SELECT ... FROM customers WHERE id = 5 FOR UPDATE` сериализует все операции по клиенту;
- **ограничение в схеме** — уникальный частичный индекс (если лимит 1), exclusion constraint для непересекающихся интервалов;
- **advisory lock** по ключу (`pg_advisory_xact_lock(5)`);
- счётчик в родительской строке, который обновляется атомарно с проверкой.

**Что спрашивают дальше:** как MySQL InnoDB борется с фантомами (next-key / gap locks на Repeatable Read), почему в PostgreSQL нет gap locks (вместо них — предикатные блокировки SSI, которые не блокируют, а только детектируют конфликт).

## Что такое row-level lock?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-row-level-lock
tags: synchronization, locking
```

Row-level lock — блокировка отдельной строки, которую берут `UPDATE`, `DELETE`, `SELECT ... FOR UPDATE` и родственные конструкции. Она защищает строку от конкурентного изменения, но **не мешает чтению**: обычный `SELECT` блокировки строк не берёт и не ждёт их.

**Четыре режима, от сильного к слабому:**

| Режим | Кто берёт | Конфликтует с |
| --- | --- | --- |
| `FOR UPDATE` | `DELETE`, `UPDATE` ключевых колонок, явный `SELECT ... FOR UPDATE` | со всеми |
| `FOR NO KEY UPDATE` | обычный `UPDATE` (не меняющий колонки уникальных индексов) | `FOR SHARE`, `FOR NO KEY UPDATE`, `FOR UPDATE` |
| `FOR SHARE` | явный `SELECT ... FOR SHARE` | `FOR NO KEY UPDATE`, `FOR UPDATE` |
| `FOR KEY SHARE` | проверки внешних ключей на родительской строке | только `FOR UPDATE` |

Разделение на «key» и «no key» нужно, чтобы вставка дочерней строки (берёт `FOR KEY SHARE` на родителя) не блокировала обычные обновления родителя, не трогающие ключ.

```sql
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;
```

Блокировка держится **до конца транзакции**, снять её раньше нельзя.

**Модификаторы ожидания:**

- `NOWAIT` — сразу ошибка `55P03`, если строка занята;
- `SKIP LOCKED` — пропустить занятые строки. Основа очередей задач в PostgreSQL:

```sql
UPDATE jobs SET status = 'running', worker = 'w1'
WHERE id IN (
  SELECT id FROM jobs
  WHERE status = 'queued'
  ORDER BY id
  LIMIT 10
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

**Как это хранится.** Блокировки строк не держатся в общей таблице блокировок в памяти — иначе блокировка миллиона строк исчерпала бы её. Информация пишется прямо в заголовок версии строки: `xmax` и флаги. Если строку держат несколько транзакций (например, несколько `FOR KEY SHARE`), создаётся MultiXact. Следствия:

- количество заблокированных строк не ограничено;
- `SELECT ... FOR UPDATE` **пишет** на страницу и порождает WAL;
- в `pg_locks` блокировки строк не видны, пока кто-то их не ждёт: ожидающий процесс виден как ждущий `transactionid` держателя (и, возможно, `tuple`).

**Подводные камни:**

- `FOR UPDATE` с `JOIN` блокирует строки всех таблиц запроса; ограничить можно через `FOR UPDATE OF orders`;
- блокировки в разном порядке ведут к deadlock — сортировать по ключу;
- `FOR UPDATE` с `LIMIT` на Read Committed может вернуть меньше строк, чем `LIMIT`, если заблокированная строка после ожидания перестала подходить под условие.

## Что такое table-level lock?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-table-level-lock
tags: synchronization, locking
```

Table-level lock — блокировка всего отношения (таблицы, индекса, последовательности). Её берёт **каждая** команда, обращающаяся к таблице, даже обычный `SELECT`. Режимов восемь, и большинство из них совместимы друг с другом — проблемы создают в основном DDL-операции.

**Режимы и кто их берёт:**

| Режим | Типичные команды |
| --- | --- |
| `ACCESS SHARE` | `SELECT` |
| `ROW SHARE` | `SELECT ... FOR UPDATE / FOR SHARE` |
| `ROW EXCLUSIVE` | `INSERT`, `UPDATE`, `DELETE`, `MERGE` |
| `SHARE UPDATE EXCLUSIVE` | `VACUUM`, `ANALYZE`, `CREATE INDEX CONCURRENTLY`, `ALTER TABLE ... VALIDATE CONSTRAINT` |
| `SHARE` | `CREATE INDEX` (без `CONCURRENTLY`) |
| `SHARE ROW EXCLUSIVE` | `CREATE TRIGGER`, `ALTER TABLE ... ADD FOREIGN KEY` |
| `EXCLUSIVE` | `REFRESH MATERIALIZED VIEW CONCURRENTLY` |
| `ACCESS EXCLUSIVE` | `DROP`, `TRUNCATE`, большинство `ALTER TABLE`, `VACUUM FULL`, `CLUSTER`, `LOCK TABLE` |

**Ключевые конфликты:**

- `ACCESS SHARE` (чтение) конфликтует **только** с `ACCESS EXCLUSIVE`;
- `ROW EXCLUSIVE` (запись) не конфликтует сам с собой — параллельные `INSERT/UPDATE` в одну таблицу не мешают друг другу на уровне таблицы;
- `SHARE` (обычный `CREATE INDEX`) блокирует запись, но не чтение;
- `ACCESS EXCLUSIVE` блокирует всё, включая `SELECT`.

**Главная ловушка — очередь блокировок.** Запросы встают в очередь, и новый запрос не может «обогнать» ждущий конфликтующий:

```text
T1: BEGIN; SELECT ... FROM orders;           ACCESS SHARE, транзакция висит
T2: ALTER TABLE orders ADD COLUMN x int;     ждёт ACCESS EXCLUSIVE за T1
T3..Tn: SELECT ... FROM orders;               ждут за T2
```

`ALTER TABLE`, который сам выполнился бы за миллисекунды, повесил всю таблицу, потому что ждёт долгую транзакцию, а все остальные ждут его. Защита для миграций:

```sql
SET lock_timeout = '3s';
ALTER TABLE orders ADD COLUMN x int;
```

При таймауте — ошибка и повтор миграции позже, а не остановка продакшена.

**Как смотреть:**

```sql
SELECT l.pid, l.mode, l.granted, a.query
FROM pg_locks l JOIN pg_stat_activity a USING (pid)
WHERE l.relation = 'orders'::regclass;
```

**Явная блокировка** — `LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE;` — нужна редко: например, чтобы сериализовать пакетную операцию над таблицей. Снимается только в конце транзакции.

**Что спрашивают дальше:** какую блокировку берёт `ALTER TABLE ADD COLUMN` (`ACCESS EXCLUSIVE`, но быстро, если нет перезаписи), почему `CREATE INDEX CONCURRENTLY` не блокирует запись.

## Как возникает deadlock в PostgreSQL?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-voznikaet-deadlock-v-postgresql
tags: deadlock, synchronization
```

Deadlock (взаимоблокировка) возникает, когда две или больше транзакций ждут друг друга по кругу: T1 держит ресурс A и ждёт B, T2 держит B и ждёт A. Ни одна не может продолжить. PostgreSQL обнаруживает такой цикл и принудительно откатывает одну из транзакций.

**Классический сценарий — обновление строк в разном порядке:**

```text
T1: BEGIN; UPDATE accounts SET balance = balance - 10 WHERE id = 1;
T2: BEGIN; UPDATE accounts SET balance = balance - 10 WHERE id = 2;
T1: UPDATE accounts SET balance = balance + 10 WHERE id = 2;   ждёт T2
T2: UPDATE accounts SET balance = balance + 10 WHERE id = 1;   ждёт T1 — цикл
```

Через `deadlock_timeout` одна из транзакций получает:

```text
ERROR:  deadlock detected
DETAIL:  Process 4120 waits for ShareLock on transaction 9081; blocked by process 4133.
         Process 4133 waits for ShareLock on transaction 9080; blocked by process 4120.
HINT:  See server log for query details.
SQLSTATE: 40P01
```

`ShareLock on transaction` — так выглядит ожидание строки: процесс ждёт завершения транзакции, которая держит блокировку строки.

**Как PostgreSQL ищет deadlock.** Проверка не выполняется на каждое ожидание — это дорого. Процесс, который ждёт блокировку дольше `deadlock_timeout` (по умолчанию 1 с), запускает поиск цикла в графе ожиданий. Если цикл найден, откатывается транзакция того процесса, который выполнил проверку. Какая именно из участниц пострадает, заранее не известно.

**Другие частые источники:**

- **Массовые `UPDATE` без порядка.** `UPDATE ... WHERE status = 'x'` в двух сессиях проходит строки в порядке плана — он может отличаться, и пересекающиеся наборы блокируются вразнобой.
- **Внешние ключи.** Вставка дочерней строки берёт `FOR KEY SHARE` на родителя; обновление родителя в другой транзакции и вставки детей в разном порядке могут сцепиться.
- **Повышение блокировки.** Две транзакции взяли `FOR SHARE` на одну строку, затем обе пытаются её обновить — каждая ждёт, пока другая отпустит shared-блокировку.
- **Блокировки таблиц.** Две транзакции читают таблицу (`ACCESS SHARE`), затем обе пытаются сделать `LOCK TABLE ... EXCLUSIVE` или DDL.
- **Триггеры**, которые обновляют связанные таблицы (агрегаты, счётчики) в порядке, отличном от основной операции.
- **Advisory locks**, взятые в разном порядке.

**Как предотвратить:**

- блокировать строки в **одном детерминированном порядке** — например, по возрастанию `id`: `SELECT ... WHERE id IN (1, 2) ORDER BY id FOR UPDATE`;
- держать транзакции короткими;
- брать самую сильную нужную блокировку сразу (`FOR UPDATE`, а не `FOR SHARE` с последующим обновлением);
- для «горячих» счётчиков — атомарный `UPDATE` одной строки или вынести агрегацию в асинхронную обработку.

**Что делать в приложении.** Deadlock — штатная ситуация конкурентной системы, а не авария. Транзакцию с `40P01` нужно повторить целиком, как и при `40001`. Но частые deadlock-и — признак ошибки в порядке блокировок, который нужно исправить, а не прятать за ретраями.

## Как диагностировать deadlock?

```yaml
category: postgresql
level: middle
difficulty: 4
slug: postgresql-kak-diagnostirovat-deadlock
tags: deadlock, synchronization
```

Сам deadlock PostgreSQL разрешает автоматически, поэтому диагностика — это **разбор постфактум**: какие запросы участвовали, на каких объектах сцепились и почему порядок блокировок оказался разным. Главный источник — лог сервера, плюс счётчики и мониторинг ожиданий.

**1. Лог сервера.** При deadlock в лог пишется полная картина, включая тексты запросов **всех** участников (в отличие от ошибки на клиенте):

```text
ERROR:  deadlock detected
DETAIL:  Process 4120 waits for ShareLock on transaction 9081; blocked by process 4133.
        Process 4133 waits for ShareLock on transaction 9080; blocked by process 4120.
        Process 4120: UPDATE accounts SET balance = balance + 10 WHERE id = 2
        Process 4133: UPDATE accounts SET balance = balance + 10 WHERE id = 1
CONTEXT:  while updating tuple (0,7) in relation "accounts"
```

Видны только **текущие** запросы — те, что ждали. Запросы, которые ранее в той же транзакции взяли блокировки, в лог не попадут; их нужно восстанавливать по коду приложения или по логу всех запросов сессии.

Чтобы связать с приложением, полезен `log_line_prefix` с pid, приложением и id транзакции:

```text
log_line_prefix = '%m [%p] %q%u@%d app=%a xid=%x '
```

И `Application Name` в строке подключения Npgsql — тогда в логе видно, какой сервис участвовал.

**2. Ожидания до deadlock: `log_lock_waits`.** Параметр (по умолчанию выключен) пишет в лог каждое ожидание блокировки дольше `deadlock_timeout`. Это показывает и те конфликты, которые не дошли до цикла, но давали задержки:

```text
LOG:  process 4120 still waiting for ShareLock on transaction 9081 after 1000.123 ms
DETAIL:  Process holding the lock: 4133. Wait queue: 4120.
```

**3. Счётчик.** Растёт ли проблема:

```sql
SELECT datname, deadlocks FROM pg_stat_database;
```

Счётчик накопительный — смотреть производную в мониторинге (Prometheus `postgres_exporter`, Grafana).

**4. Живые ожидания.** Если блокировки висят прямо сейчас (deadlock-а ещё нет, но всё стоит):

```sql
SELECT pid, pg_blocking_pids(pid) AS blocked_by, wait_event_type, wait_event,
       now() - xact_start AS xact_age, left(query, 80)
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;
```

**5. Разбор причины.** По логу понять, какие строки/таблицы и в каком порядке блокирует каждый код-путь:

- найти в коде все места, где одна транзакция меняет обе сущности;
- проверить порядок операций (сначала `orders`, потом `accounts` в одном месте и наоборот в другом);
- проверить массовые `UPDATE` без `ORDER BY` в подзапросе с `FOR UPDATE`;
- проверить FK и триггеры: `CONTEXT` в логе часто указывает на триггер или проверку внешнего ключа (`SQL statement "SELECT 1 FROM ONLY ... FOR KEY SHARE OF x"`).

**6. Воспроизведение.** Два `psql` и ручной пошаговый прогон операций — самый надёжный способ подтвердить гипотезу.

**Что не помогает:** увеличивать `deadlock_timeout`, чтобы deadlock-ов «стало меньше», — они просто будут обнаруживаться позже, а транзакции дольше висеть. Его поднимают только чтобы реже запускать дорогую проверку на системах с большим числом обычных ожиданий.

## Что такое connection pool?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-connection-pool
tags: orm
```

Connection pool — набор заранее открытых соединений с базой, которые приложение берёт на время запроса и возвращает, вместо того чтобы открывать и закрывать соединение каждый раз. Для PostgreSQL это особенно важно: каждое соединение — отдельный процесс на сервере, и открывать его дорого.

**Почему соединение с PostgreSQL дорогое:**

- TCP-рукопожатие, TLS, аутентификация (SCRAM — несколько round trip-ов);
- `fork` нового backend-процесса, инициализация его кэшей каталога;
- память на процесс — от нескольких МБ, плюс `work_mem` на каждую операцию сортировки/хеша в запросе;
- `max_connections` по умолчанию 100; много соединений замедляют сервер даже в простое — растёт стоимость построения снимков и конкуренция за блокировки.

Открытие соединения занимает миллисекунды, а простой запрос — доли миллисекунды. Без пула накладные расходы доминируют.

**Как работает пул:**

1. Приложение запрашивает соединение — пул отдаёт свободное, если есть.
2. Если свободных нет и лимит не достигнут — открывает новое.
3. Если лимит достигнут — запрос ждёт освобождения до таймаута, затем ошибка.
4. После `Close`/`Dispose` соединение возвращается в пул, его сессионное состояние сбрасывается.
5. Простаивающие соединения сверх минимума через какое-то время закрываются.

**Где бывает пул:**

| Уровень | Примеры | Особенности |
| --- | --- | --- |
| В драйвере приложения | Npgsql, HikariCP | пул на процесс; 20 подов × 100 соединений = 2000 соединений к базе |
| Внешний прокси | PgBouncer, Odyssey, PgCat, RDS Proxy | общий пул для всех экземпляров приложения, мультиплексирование |
| Встроенного серверного пула в PostgreSQL нет | — | |

**Размер пула — не «чем больше, тем лучше».** База реально выполняет параллельно столько запросов, сколько у неё ядер и дисковых очередей. Сотни активных соединений дают конкуренцию за CPU, блокировки и память, и пропускная способность падает. Типичный ориентир для активных соединений — порядка «число ядер × 2–4», дальше — очередь в пуле.

**Типичные проблемы:**

- **Утечка соединений** — не вызван `Dispose`, пул исчерпывается, запросы падают по таймауту. В .NET — всегда `await using`.
- **Долгие транзакции** держат соединение и не дают его переиспользовать.
- **Сумма пулов всех экземпляров** превышает `max_connections` при автоскейлинге.
- **Сессионное состояние** (`SET`, временные таблицы, prepared statements) «протекает» между пользователями пула, если не сбрасывается.

**Что спрашивают дальше:** как устроен пул в Npgsql, зачем нужен PgBouncer, если в драйвере уже есть пул (общий лимит на все экземпляры и transaction pooling).

## Как работает connection pooling в PostgreSQL/Npgsql?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-rabotaet-connection-pooling-v-postgresql-npgsql
tags: orm
```

В Npgsql пул встроен и включён по умолчанию. `NpgsqlConnection.Open()` берёт физическое соединение из пула, `Close()`/`Dispose()` возвращает его обратно. Пул один на каждую уникальную строку подключения (или на один `NpgsqlDataSource`), а сам PostgreSQL ничего о пуле не знает: для него это обычные долгоживущие сессии.

```csharp
var dataSource = NpgsqlDataSource.Create(
    "Host=db;Database=app;Username=app;Password=...;" +
    "Maximum Pool Size=50;Minimum Pool Size=5;Timeout=15;" +
    "Connection Idle Lifetime=300;Application Name=orders-api");

await using var conn = await dataSource.OpenConnectionAsync();
await using var cmd = new NpgsqlCommand("SELECT 1", conn);
await cmd.ExecuteScalarAsync();
```

**Основные параметры строки подключения:**

| Параметр | По умолчанию | Смысл |
| --- | --- | --- |
| `Pooling` | `true` | включение пула |
| `Maximum Pool Size` | 100 | предел соединений в пуле |
| `Minimum Pool Size` | 0 | сколько держать открытыми всегда |
| `Timeout` | 15 с | сколько ждать соединения (и его установления) |
| `Connection Idle Lifetime` | 300 с | через сколько закрывать простаивающие сверх минимума |
| `Connection Pruning Interval` | 10 с | как часто проверять простаивающие |
| `Command Timeout` | 30 с | таймаут команды (не связан с пулом, но рядом) |

При исчерпании пула через `Timeout` секунд будет исключение `The connection pool has been exhausted, either raise 'Max Pool Size' ... or 'Timeout' ...`. Это почти всегда симптом, а не причина: утечка (нет `Dispose`), долгие транзакции или медленные запросы под нагрузкой.

**Сброс состояния.** Перед повторной выдачей соединения Npgsql сбрасывает сессионное состояние (по умолчанию через `DISCARD ALL`): параметры `SET`, временные таблицы, advisory locks уровня сессии. Если состояние не используется, сброс можно отключить `No Reset On Close=true` — немного быстрее, но всё, что вы «устанавливали» в сессии, переживёт возврат в пул.

**`NpgsqlDataSource` (Npgsql 7+)** — рекомендуемый способ: один объект на приложение, регистрируется в DI (`AddNpgsqlDataSource`), владеет пулом, настройками маппинга типов и логированием. EF Core и Dapper могут использовать его же.

**Связь с EF Core.** `DbContext` открывает соединение на время операции и сразу возвращает. `AddDbContextPool` — это пул **объектов DbContext**, а не соединений; к пулу соединений он отношения не имеет.

**Несколько экземпляров приложения.** У каждого пода свой пул: 10 подов × `Maximum Pool Size=100` = до 1000 соединений, тогда как `max_connections` по умолчанию 100. Решения: уменьшить размер пула на под, поставить PgBouncer перед базой.

**Npgsql + PgBouncer.** В режиме transaction pooling держат в голове: сессионные `SET`, advisory locks и `LISTEN` не работают. Включённый в Npgsql пул поверх PgBouncer — нормальная практика: Npgsql экономит соединения к PgBouncer, PgBouncer — к базе. Prepared statements в transaction-режиме поддерживаются PgBouncer с версии 1.21 (`max_prepared_statements`).

**Дополнительно:** `Multiplexing=true` позволяет нескольким командам разделять одно соединение (без транзакций), а несколько хостов в `Host=a,b` вместе с `Target Session Attributes=primary` дают простой failover на стороне драйвера.

## Как оптимизировать медленный SQL-запрос?

```yaml
category: postgresql
level: middle
difficulty: 4
slug: postgresql-kak-optimizirovat-medlennyi-sql-zapros
tags: query-planning
```

Оптимизация начинается с измерения, а не с догадок: найти, **какой** запрос медленный, получить его реальный план через `EXPLAIN (ANALYZE, BUFFERS)`, найти узел, где тратится время или где оценка строк расходится с фактом, и исправить причину — индекс, статистику, формулировку запроса или модель данных.

**1. Найти запрос.** `pg_stat_statements` по `total_exec_time` (суммарная нагрузка) и `mean_exec_time` (самые медленные единичные). Иногда важнее запрос на 5 мс, вызываемый 10 000 раз в секунду, чем отчёт на 30 секунд раз в день.

**2. Получить план на реальных данных и параметрах:**

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
```

**3. Прочитать план, ища типовые проблемы:**

| Признак в плане | Вероятная причина | Что делать |
| --- | --- | --- |
| `Seq Scan` по большой таблице + `Rows Removed by Filter` почти всё | нет индекса | индекс по колонкам фильтра |
| `Index Scan` + большой `Filter` | индекс неполный | составной/частичный индекс |
| `rows=10` против `actual rows=500000` | неверная статистика | `ANALYZE`, `SET STATISTICS`, `CREATE STATISTICS` |
| `Nested Loop` с `loops=100000` | недооценка строк | исправить оценку, проверить индекс на внутренней стороне |
| `Sort Method: external merge Disk` | не хватает `work_mem` | индекс под `ORDER BY` или больше `work_mem` |
| `Heap Fetches` большие у Index Only Scan | visibility map устарела | vacuum |
| `Buffers: read` огромные | данных читается много | сузить выборку, покрывающий индекс |

**4. Переписать запрос, если он мешает индексам:**

- функции над колонками в `WHERE` (`date(created_at) = ...` → диапазон);
- `OR` по разным колонкам → `UNION ALL` или проверить `BitmapOr`;
- `OFFSET` на глубоких страницах → keyset;
- `NOT IN (подзапрос)` → `NOT EXISTS` (и корректнее с `NULL`);
- `SELECT *` → только нужные колонки, чтобы сработал Index Only Scan;
- `count(*)` ради проверки существования → `EXISTS`.

**5. Проверить уровень приложения.** Часто «медленный запрос» — это N+1 из ORM: сотня быстрых запросов вместо одного. В EF Core — `Include`, проекции через `Select`, `AsSplitQuery` для декартова взрыва, `AsNoTracking` для чтения.

**6. Если запрос оптимален, а данных просто много:** предагрегация (materialized view, таблица-счётчик), партиционирование, денормализация, кэш, перенос аналитики на реплику или в колоночное хранилище.

**Чего избегать:**

- создавать индексы «на всякий случай» — каждый замедляет запись и мешает HOT-обновлениям;
- глобально менять параметры (`work_mem`, `enable_nestloop = off`) ради одного запроса; `work_mem` можно поднять локально через `SET LOCAL` в транзакции;
- оценивать по одному прогону: первый запуск может читать с диска, второй — из кэша.

**Финал — проверка:** сравнить `Execution Time` и `Buffers` до и после, убедиться на продакшен-подобных объёмах и посмотреть, не ухудшились ли соседние запросы и скорость записи.

## Как найти долгие запросы?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-naiti-dolgie-zaprosy
tags: query-planning
```

Есть три источника, отвечающие на разные вопросы: `pg_stat_activity` — что выполняется **прямо сейчас**, `pg_stat_statements` — какие запросы суммарно и в среднем самые тяжёлые **за период**, лог с `log_min_duration_statement` и `auto_explain` — **конкретные** медленные выполнения с параметрами и планами.

**1. Прямо сейчас — `pg_stat_activity`:**

```sql
SELECT pid, usename, application_name, state,
       now() - query_start AS running_for,
       now() - xact_start  AS xact_age,
       wait_event_type, wait_event,
       left(query, 120) AS query
FROM pg_stat_activity
WHERE state <> 'idle' AND backend_type = 'client backend'
ORDER BY query_start
LIMIT 20;
```

Отдельно стоит искать `idle in transaction` с большим `xact_age` — они ничего не выполняют, но держат блокировки и горизонт VACUUM.

Остановить запрос: `SELECT pg_cancel_backend(pid);` (отменить текущий запрос) или `pg_terminate_backend(pid)` (закрыть всё соединение).

**2. За период — `pg_stat_statements`.** Расширение нормализует запросы (литералы заменяет на `$1`) и копит статистику по каждой форме запроса:

```sql
CREATE EXTENSION pg_stat_statements;

SELECT calls,
       round(total_exec_time) AS total_ms,
       round(mean_exec_time::numeric, 2) AS mean_ms,
       rows,
       shared_blks_read,
       left(query, 100) AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

Требует `shared_preload_libraries = 'pg_stat_statements'` и рестарта. Сортировка по `total_exec_time` показывает, что нагружает сервер сильнее всего, по `mean_exec_time` — самые медленные единичные запросы. Сброс статистики — `pg_stat_statements_reset()`; сравнивать срезы во времени удобнее в мониторинге (pgwatch, PMM, okmeter, Datadog).

**3. Конкретные выполнения — лог:**

```text
log_min_duration_statement = 500ms
```

Пишет в лог каждый запрос дольше порога с длительностью и значениями параметров. По умолчанию выключено (`-1`). Вместе с `auto_explain` можно получить и план:

```text
shared_preload_libraries = 'pg_stat_statements,auto_explain'
auto_explain.log_min_duration = '1s'
auto_explain.log_analyze = on
auto_explain.log_buffers = on
```

`log_analyze` добавляет накладные расходы на все запросы (замер времени узлов), поэтому на нагруженных системах включают `auto_explain.log_timing = off` или `auto_explain.sample_rate`.

**4. Со стороны приложения.** Логи EF Core (`Microsoft.EntityFrameworkCore.Database.Command` с длительностью), OpenTelemetry-трейсы Npgsql — связывают медленный SQL с эндпоинтом. `query_id` (PG 14+, `compute_query_id`) позволяет сопоставить запрос из `pg_stat_activity` с записью в `pg_stat_statements`.

**Защита от бесконечных запросов:** `statement_timeout` на роль или базу для OLTP-пользователя, `idle_in_transaction_session_timeout`, а с PG 17 — `transaction_timeout`.

## Что такое `pg_stat_activity`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-pg-stat-activity
```

`pg_stat_activity` — системное представление, в котором одна строка соответствует одному серверному процессу: клиентскому соединению или фоновому процессу (autovacuum, WAL writer, репликация). Это первый инструмент, когда «база тормозит»: кто подключён, что выполняет, сколько времени и чего ждёт.

**Ключевые колонки:**

| Колонка | Что показывает |
| --- | --- |
| `pid` | id процесса — нужен для `pg_cancel_backend` / `pg_terminate_backend` |
| `datname`, `usename`, `application_name`, `client_addr` | кто и откуда |
| `backend_type` | `client backend`, `autovacuum worker`, `walsender` и т. д. |
| `state` | `active`, `idle`, `idle in transaction`, `idle in transaction (aborted)` |
| `backend_start` / `xact_start` / `query_start` / `state_change` | время начала соединения, транзакции, запроса, смены состояния |
| `wait_event_type`, `wait_event` | чего ждёт процесс: `Lock`, `LWLock`, `IO`, `Client`, `IPC` … |
| `backend_xid`, `backend_xmin` | XID транзакции и её горизонт видимости |
| `query` | текущий или **последний** выполненный запрос |
| `query_id` | идентификатор, совпадающий с `pg_stat_statements` (PG 14+) |

**Типовые запросы:**

```sql
SELECT state, count(*) FROM pg_stat_activity
WHERE backend_type = 'client backend'
GROUP BY state;

SELECT pid, now() - xact_start AS xact_age, state, left(query, 80)
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start
LIMIT 10;

SELECT pid, pg_blocking_pids(pid) AS blocked_by, wait_event, left(query, 80)
FROM pg_stat_activity
WHERE wait_event_type = 'Lock';
```

**Как интерпретировать состояния:**

- `active` — выполняет запрос. Если при этом `wait_event_type = 'Lock'` — стоит на блокировке, а не работает.
- `idle` — соединение в пуле, ничего не делает. Много `idle` — нормально для пулов.
- `idle in transaction` — транзакция открыта, но клиент ничего не присылает. Держит блокировки и мешает VACUUM. Защита — `idle_in_transaction_session_timeout`.
- `idle in transaction (aborted)` — в транзакции была ошибка, а клиент не сделал `ROLLBACK`.

**Нюансы:**

- `query` у `idle`-сессии — это **предыдущий** запрос, а не текущий;
- длина `query` ограничена `track_activity_query_size` (по умолчанию 1024 байта), длинные запросы обрезаются;
- обычный пользователь видит детали только своих сессий; для мониторинга нужна роль `pg_read_all_stats` (или `pg_monitor`);
- данные — моментальный снимок; для истории нужен мониторинг, периодически сохраняющий выборки.

**Действия:** `pg_cancel_backend(pid)` отменяет текущий запрос (соединение остаётся), `pg_terminate_backend(pid)` завершает процесс целиком (транзакция откатывается).

## Что такое `pg_locks`?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-pg-locks
tags: locking
```

`pg_locks` — системное представление, показывающее блокировки в общей таблице блокировок сервера: кто какую блокировку держит (`granted = true`) и кто её ждёт (`granted = false`). Используется для поиска причин зависаний и конфликтов, обычно в связке с `pg_stat_activity`.

**Основные колонки:**

| Колонка | Смысл |
| --- | --- |
| `locktype` | тип объекта: `relation`, `tuple`, `transactionid`, `virtualxid`, `advisory`, `object`, `page`, `extend` … |
| `relation` | OID таблицы/индекса (для `relation`, `tuple`, `page`) |
| `transactionid` / `virtualxid` | транзакция, завершения которой ждут или которую «держат» |
| `pid` | процесс-владелец или ожидающий |
| `mode` | режим: `AccessShareLock`, `RowExclusiveLock`, `AccessExclusiveLock`, `ShareLock` … |
| `granted` | получена или ожидается |
| `fastpath` | взята через fast path (слабые блокировки таблиц без записи в общую таблицу) |
| `waitstart` | когда процесс начал ждать (PG 14+) |

**Пример: кто держит блокировки на таблице:**

```sql
SELECT l.pid, l.mode, l.granted, a.state, now() - a.xact_start AS xact_age, left(a.query, 80)
FROM pg_locks l
JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.relation = 'orders'::regclass
ORDER BY l.granted DESC, a.xact_start;
```

**Как в `pg_locks` выглядят блокировки строк.** Сами блокировки строк хранятся в заголовках версий строк на диске, а не в общей таблице, поэтому в `pg_locks` их **не видно**, пока никто не ждёт. Когда процесс ждёт строку, появляется:

- `locktype = 'transactionid'`, `granted = false` — ожидание завершения транзакции, которая держит строку (в логах это `ShareLock on transaction`);
- иногда `locktype = 'tuple'` — очередь на конкретную версию строки.

Каждая транзакция держит `ExclusiveLock` на свой `transactionid` и `virtualxid` — именно на них и «встают в очередь» ожидающие.

**Удобнее, чем ручное соединение:**

```sql
SELECT pid, pg_blocking_pids(pid) AS blocked_by, left(query, 80)
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;
```

`pg_blocking_pids()` сам разбирает `pg_locks` с учётом совместимости режимов и очереди. Но вызывать его очень часто на нагруженной системе не стоит — он берёт кратковременные блокировки на структуры менеджера блокировок.

**Другое полезное:**

- `locktype = 'advisory'` — пользовательские блокировки `pg_advisory_lock`; `objid` содержит ключ;
- `mode = 'SIReadLock'` — предикатные блокировки Serializable;
- число записей в общей таблице ограничено `max_locks_per_transaction × (max_connections + max_prepared_transactions)` — транзакция, затрагивающая тысячи партиций, может получить `out of shared memory` с подсказкой увеличить `max_locks_per_transaction`.

## Что такое stored procedure?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-stored-procedure
```

Stored procedure (хранимая процедура) — именованный блок кода, который хранится в базе и выполняется на сервере командой `CALL`. В PostgreSQL процедуры появились в версии 11 (`CREATE PROCEDURE`); их главное отличие от функций — возможность **управлять транзакциями внутри**: делать `COMMIT` и `ROLLBACK` по ходу выполнения.

```sql
CREATE PROCEDURE archive_old_orders(batch_size int DEFAULT 10000)
LANGUAGE plpgsql
AS $$
DECLARE
    moved int;
BEGIN
    LOOP
        WITH moved_rows AS (
            DELETE FROM orders
            WHERE id IN (
                SELECT id FROM orders
                WHERE created_at < now() - interval '2 years'
                LIMIT batch_size
            )
            RETURNING *
        )
        INSERT INTO orders_archive SELECT * FROM moved_rows;

        GET DIAGNOSTICS moved = ROW_COUNT;
        EXIT WHEN moved = 0;
        COMMIT;
    END LOOP;
END;
$$;

CALL archive_old_orders(5000);
```

Каждая пачка фиксируется отдельно: блокировки отпускаются, VACUUM может чистить уже обработанное, а при сбое сделанное не теряется. Функцией так не сделать — она всегда выполняется внутри одной транзакции вызывающего.

**Ограничения управления транзакциями:**

- `COMMIT`/`ROLLBACK` внутри процедуры работают, только если `CALL` выполнен **не** внутри явного блока `BEGIN ... COMMIT` (или из другой процедуры, вызванной так же). Если клиент открыл транзакцию сам — ошибка `invalid transaction termination`;
- нельзя делать `COMMIT` внутри блока с `EXCEPTION`;
- процедура с `SECURITY DEFINER` или с `SET`-параметрами в определении не может управлять транзакциями.

**Что умеет процедура:**

- параметры `IN`, `INOUT`, а с PG 14 и `OUT`; результат возвращается через них, как одна строка;
- не возвращает набор строк и не используется в `SELECT`;
- пишется на PL/pgSQL, SQL или других процедурных языках.

**Вызов из .NET:**

```csharp
await using var cmd = new NpgsqlCommand("CALL archive_old_orders($1)", conn);
cmd.Parameters.AddWithValue(5000);
await cmd.ExecuteNonQueryAsync();
```

В EF Core — `Database.ExecuteSqlAsync($"CALL archive_old_orders({batch})")`. Важно, чтобы вокруг не было `BeginTransaction`, если процедура коммитит сама.

**Когда процедуры уместны:** пакетная обработка с промежуточными коммитами, обслуживающие задачи, которые запускаются через `pg_cron`, операции, где важно минимизировать round trip-ы. Для бизнес-логики в .NET-проектах их обычно избегают: код в базе сложнее версионировать, тестировать и деплоить, чем код приложения.

**Терминологическая ловушка.** До PG 11 «хранимыми процедурами» в PostgreSQL называли функции — многие статьи и легаси-код используют это слово именно в таком смысле.

## Что такое PostgreSQL function?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-postgresql-function
```

Функция в PostgreSQL — именованный серверный объект, который принимает аргументы, выполняет код и **возвращает значение**: скаляр, строку составного типа, набор строк (`SETOF`, `TABLE`) или `void`. Её можно вызывать в любом месте SQL-выражения: в `SELECT`, `WHERE`, индексах, ограничениях, триггерах.

```sql
CREATE FUNCTION order_total(p_order_id bigint)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
    SELECT coalesce(sum(price * qty), 0)
    FROM order_items
    WHERE order_id = p_order_id
$$;

SELECT id, order_total(id) FROM orders WHERE customer_id = 42;
```

Функция, возвращающая таблицу:

```sql
CREATE FUNCTION recent_orders(p_customer bigint, p_limit int)
RETURNS TABLE (id bigint, created_at timestamptz, total numeric)
LANGUAGE sql STABLE
AS $$
    SELECT id, created_at, total FROM orders
    WHERE customer_id = p_customer
    ORDER BY created_at DESC
    LIMIT p_limit
$$;

SELECT * FROM recent_orders(42, 10);
```

**Языки:** `sql`, `plpgsql`, а также `plpython3u`, `plperl`, `plv8` и C (через расширения). Чистые SQL-функции планировщик может **инлайнить** — подставить тело в запрос, будто функции не было, и использовать индексы и оценки.

**Категория изменчивости (volatility) — важная часть определения:**

| Категория | Гарантия | Последствия |
| --- | --- | --- |
| `VOLATILE` (по умолчанию) | может менять данные, результат может отличаться при каждом вызове | вызывается для каждой строки, не оптимизируется |
| `STABLE` | не меняет данные, результат постоянен в рамках одного запроса | можно использовать в условии индексного поиска |
| `IMMUTABLE` | результат зависит только от аргументов, всегда | можно использовать в индексах по выражению, вычисляется на этапе планирования |

Неверная маркировка опасна: `IMMUTABLE`-функция, которая на деле читает таблицу или зависит от `TimeZone`, даст некорректный индекс или неверный закэшированный результат.

**Другие атрибуты:**

- `PARALLEL SAFE` — разрешает использовать функцию в параллельных планах (по умолчанию `PARALLEL UNSAFE`, что отключает параллелизм для всего запроса);
- `SECURITY DEFINER` — выполнять с правами владельца; обязательно задавать `SET search_path`, иначе это дыра в безопасности;
- `STRICT` — вернуть `NULL`, не вызывая функцию, если любой аргумент `NULL`;
- `COST` и `ROWS` — подсказки планировщику.

**Транзакции.** Функция всегда работает внутри транзакции вызывающего оператора и не может делать `COMMIT`. Ошибка в функции откатывает весь оператор.

**Типичные применения:** триггерные функции (`RETURNS trigger`), вычисляемые выражения для индексов, обёртки над сложными запросами, проверки в `CHECK`-ограничениях (только immutable-логика), RLS-политики.

## Function vs procedure?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-function-vs-procedure
```

Главная разница: **функция возвращает значение и вызывается внутри SQL-выражения, процедура вызывается отдельной командой `CALL` и может управлять транзакциями** (`COMMIT`/`ROLLBACK` внутри). Процедуры появились в PostgreSQL 11; до этого всё делали функциями.

| | Function | Procedure |
| --- | --- | --- |
| Создание | `CREATE FUNCTION` | `CREATE PROCEDURE` (PG 11+) |
| Вызов | в любом выражении: `SELECT f(x)`, `WHERE`, `INSERT ... VALUES (f())` | только `CALL p(x)` |
| Возврат | `RETURNS` скаляр, составной тип, `SETOF`, `TABLE`, `void` | нет `RETURNS`; результат через `INOUT`/`OUT` (`OUT` — с PG 14) |
| Набор строк | да | нет |
| `COMMIT`/`ROLLBACK` внутри | нет, всегда в транзакции вызывающего | да, если `CALL` не внутри явной транзакции |
| Volatility, `PARALLEL`, inlining | да | не применимо |
| В индексах, `CHECK`, `DEFAULT`, триггерах | да | нет |

**Пример, где нужна именно процедура** — обработка большой таблицы пачками с коммитом после каждой:

```sql
CREATE PROCEDURE backfill_status()
LANGUAGE plpgsql AS $$
DECLARE last_id bigint := 0; max_id bigint;
BEGIN
    SELECT max(id) INTO max_id FROM orders;
    WHILE last_id < max_id LOOP
        UPDATE orders SET status_v2 = status
        WHERE id > last_id AND id <= last_id + 10000;
        last_id := last_id + 10000;
        COMMIT;
    END LOOP;
END $$;
```

В функции такой цикл стал бы одной гигантской транзакцией: все блокировки до конца, мёртвые строки не убираются, при ошибке на 99% откатывается всё.

**Пример, где нужна функция** — значение для запроса, индекса или триггера:

```sql
CREATE FUNCTION normalize_phone(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT regexp_replace($1, '\D', '', 'g') $$;

CREATE INDEX ON customers (normalize_phone(phone));
```

**Нюансы, о которых спрашивают:**

- Процедура, вызванная внутри открытой клиентом транзакции (например, EF Core обернул вызов в `BeginTransaction`), не сможет сделать `COMMIT` — будет ошибка `invalid transaction termination`.
- Процедуру можно вызвать из другой процедуры через `CALL`, а функцию из процедуры — обычным выражением. Функция не может вызвать процедуру, управляющую транзакциями, с эффектом коммита.
- Триггеры всегда используют **функции** (`RETURNS trigger`); `EXECUTE PROCEDURE` в синтаксисе `CREATE TRIGGER` — исторический синоним `EXECUTE FUNCTION`.
- Перегрузка (одно имя, разные аргументы) работает и для функций, и для процедур; удалять нужно с указанием сигнатуры.

**Отличие от SQL Server.** Там процедура — основной инструмент, умеет возвращать result set-ы и широко используется в приложениях. В PostgreSQL для «вернуть выборку» используют функции, возвращающие `TABLE`, а процедуры — для пакетных операций.

## Когда стоит использовать PL/pgSQL?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kogda-stoit-ispolzovat-pl-pgsql
```

PL/pgSQL оправдан, когда логике нужны **процедурные конструкции рядом с данными**: переменные, циклы, условия, обработка исключений — и при этом важно не гонять данные между приложением и базой. Если задачу решает один SQL-запрос, PL/pgSQL не нужен: обычный SQL почти всегда быстрее и проще.

**Хорошие сценарии:**

- **Триггерные функции** — аудит, `updated_at`, денормализованные счётчики, проверки, которые нельзя выразить `CHECK`:

```sql
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

CREATE TRIGGER orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- **Пакетная обработка с коммитами** — процедуры с циклом по пачкам, запускаемые из `pg_cron` или миграцией.
- **Операции с множеством round trip-ов** — если приложение делает 10 зависимых запросов подряд, перенос в функцию убирает 9 сетевых задержек и держит транзакцию короче.
- **Атомарная логика с ветвлением** — «попробовать вставить, при конфликте обновить, при условии X записать в журнал» в одной транзакции.
- **Динамический SQL для обслуживания** — создание партиций, массовые `ALTER` по списку таблиц (`EXECUTE format('... %I ...', name)`).
- **RLS и проверки доступа**, которым нужна логика сложнее одного выражения.

**Когда не стоит:**

- **Бизнес-логика приложения.** Код в базе сложнее тестировать, отлаживать, ревьюить и деплоить; его не видно в обычном стеке трассировки; версионирование — через миграции. В .NET-проектах логику принято держать в сервисах.
- **Построчная обработка вместо множественной.** `FOR r IN SELECT ... LOOP UPDATE ... WHERE id = r.id` — тот же N+1, только внутри базы. Один `UPDATE ... FROM` быстрее в разы.
- **Простые вычисления** — `LANGUAGE sql` функции инлайнятся планировщиком, PL/pgSQL — нет: это «чёрный ящик» для оптимизатора, оценка строк для него берётся из `ROWS` (по умолчанию 1000 для set-returning функций).

**Особенности, которые стоит знать:**

- **Кэш планов.** Запросы внутри PL/pgSQL подготавливаются при первом вызове в сессии и могут перейти на generic-план — тот же эффект, что у prepared statements. Динамический `EXECUTE` планируется каждый раз.
- **Исключения дорогие.** Блок `BEGIN ... EXCEPTION` создаёт subtransaction. Обработчик исключений внутри цикла по миллиону строк заметно замедляет выполнение и расходует XID.
- **SQL-инъекции через `EXECUTE`.** Подставлять идентификаторы через `format('%I')`, значения — через `%L` или `USING`, а не конкатенацией.
- **Отладка** — `RAISE NOTICE`, расширение `plpgsql_check` для статического анализа.

**Практичный компромисс:** триггеры и инфраструктурные процедуры — в PL/pgSQL; запросы, возвращающие данные, — `LANGUAGE sql`; бизнес-правила — в приложении.

## Что такое JSONB?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-jsonb
tags: jsonb
```

`jsonb` — тип данных PostgreSQL для хранения JSON в **бинарном разобранном виде**. В отличие от `json`, который хранит исходный текст, `jsonb` при записи парсится в дерево: ключи дедуплицируются и сортируются, пробелы отбрасываются. Чтение и поиск быстрее, и его можно индексировать.

```sql
CREATE TABLE events (
    id bigserial PRIMARY KEY,
    type text NOT NULL,
    payload jsonb NOT NULL
);

INSERT INTO events (type, payload)
VALUES ('order_created', '{"order_id": 42, "items": [{"sku": "A1", "qty": 2}], "promo": null}');
```

**Основные операторы:**

| Оператор | Смысл | Пример |
| --- | --- | --- |
| `->` | значение по ключу/индексу как `jsonb` | `payload -> 'items' -> 0` |
| `->>` | значение как `text` | `payload ->> 'order_id'` |
| `#>` / `#>>` | по пути | `payload #>> '{items,0,sku}'` |
| `@>` | содержит | `payload @> '{"order_id": 42}'` |
| `?` | есть ключ верхнего уровня | `payload ? 'promo'` |
| `@?`, `@@` | SQL/JSON path | `payload @? '$.items[*] ? (@.qty > 1)'` |
| `\|\|`, `-` | слияние, удаление ключа | `payload \|\| '{"status": "paid"}'` |

```sql
SELECT id, (payload ->> 'order_id')::bigint AS order_id
FROM events
WHERE payload @> '{"items": [{"sku": "A1"}]}';

UPDATE events SET payload = jsonb_set(payload, '{status}', '"paid"') WHERE id = 1;
```

С PG 14 работает подписка: `payload['status']`, в том числе в `UPDATE ... SET payload['status'] = '"paid"'`. С PG 17 есть `JSON_TABLE`, `JSON_VALUE`, `JSON_QUERY`, `JSON_EXISTS` из стандарта SQL/JSON.

**Когда `jsonb` уместен:**

- атрибуты с переменной структурой (характеристики товаров разных категорий);
- сырые payload-ы внешних систем и событий;
- настройки, метаданные, редко фильтруемые поля;
- в EF Core — owned-типы и коллекции через `ToJson()` или маппинг POCO в `jsonb` в Npgsql.

**Когда нет:**

- поля, по которым часто фильтруют, соединяют и сортируют, — им место в обычных колонках: у них есть статистика, типы, `NOT NULL`, внешние ключи;
- данные, требующие ссылочной целостности — FK внутрь JSON не поставить;
- часто обновляемые большие документы — см. ниже.

**Подводные камни:**

- **Обновление переписывает весь документ.** Изменение одного ключа создаёт новую версию строки с новым значением целиком. Документы больше ~2 КБ уходят в TOAST — каждое обновление переписывает их и порождает WAL.
- **Нет статистики по ключам.** Планировщик плохо оценивает селективность `payload ->> 'status' = 'x'` — использует дефолтные оценки. Помогает индекс по выражению (и `ANALYZE` после него).
- **Типы внутри JSON** — числа, строки, `true/false`, `null`. Даты хранятся строками, сравнение `->>` даёт `text`, приводить нужно явно.
- **`null` в JSON ≠ SQL `NULL`.** `'{"a": null}'::jsonb -> 'a'` — это JSON `null`, а `->>` вернёт SQL `NULL`.

## JSON vs JSONB?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-json-vs-jsonb
tags: jsonb
```

`json` хранит документ **как текст**, ровно в том виде, в каком он пришёл, и разбирает его при каждом обращении. `jsonb` при записи разбирает документ в **бинарную структуру**. Почти всегда нужен `jsonb`; `json` оправдан, только если важно сохранить исходный текст байт в байт.

| | `json` | `jsonb` |
| --- | --- | --- |
| Хранение | исходный текст | разобранное бинарное дерево |
| Запись | быстрее (только проверка синтаксиса) | медленнее (парсинг и преобразование) |
| Чтение и операторы | медленнее (парсинг на каждый доступ) | быстрее |
| Пробелы, форматирование | сохраняются | отбрасываются |
| Порядок ключей | сохраняется | не сохраняется (ключи сортируются) |
| Дубли ключей | сохраняются все | остаётся последний |
| Индексы GIN | нет | да (`jsonb_ops`, `jsonb_path_ops`) |
| Операторы `@>`, `?`, `?\|`, `?&` | нет | да |
| Сравнение на равенство, `DISTINCT`, `GROUP BY` | нет оператора `=` | да |
| Размер | обычно меньше или сравним | иногда больше из-за служебных заголовков |

```sql
SELECT '{"b": 1, "a": 2, "a": 3}'::json;
SELECT '{"b": 1, "a": 2, "a": 3}'::jsonb;
```

Первый вернёт строку как есть, второй — `{"a": 3, "b": 1}`.

**Числа.** `jsonb` хранит числа как `numeric`: точные и очень большие значения сохраняются без потерь, хвостовые нули тоже остаются (`1.00` не превращается в `1`), но при сравнении `1.0` и `1.00` равны. Значения вроде `1e400`, которые не помещаются в double, в `jsonb` допустимы.

**Когда всё же `json`:**

- аудит/логирование, где нужно хранить запрос ровно как его прислали (например, для проверки подписи payload-а — переставленные ключи сломали бы подпись);
- данные только пишутся и целиком отдаются наружу, никогда не фильтруются;
- важен порядок ключей для потребителя.

Но даже в этих случаях часто выбирают `text` или `jsonb` + отдельную колонку с сырым телом.

**Функции.** Большинство функций существует в двух вариантах: `json_build_object` / `jsonb_build_object`, `json_agg` / `jsonb_agg`, `json_each` / `jsonb_each`. Для построения ответа API прямо в SQL удобен `json_agg` — он дешевле, так как не строит бинарное дерево, а сразу формирует текст.

**Что спрашивают дальше:** как индексировать `jsonb`, почему обновление одного ключа в большом `jsonb` дорогое (переписывается весь документ и TOAST), можно ли сделать ограничение на структуру (`CHECK (payload ? 'id')`, `CHECK (jsonb_typeof(payload -> 'items') = 'array')`, с PG 16 — `IS JSON OBJECT`).

## Как индексировать JSONB?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-indeksirovat-jsonb
tags: indexes, jsonb
```

Есть два подхода: **GIN по всему документу** — для произвольных запросов на «содержит»/«есть ключ», и **B-tree по выражению** — для конкретного поля, по которому фильтруют на равенство, диапазон или сортируют. Выбор определяется формой запросов, а не типом колонки.

**1. GIN с `jsonb_ops` (по умолчанию):**

```sql
CREATE INDEX events_payload_gin ON events USING gin (payload);

SELECT * FROM events WHERE payload @> '{"type": "order_created", "source": "web"}';
SELECT * FROM events WHERE payload ? 'refund_id';
SELECT * FROM events WHERE payload ?| array['promo', 'coupon'];
```

Индексирует каждый ключ и каждое значение отдельно. Поддерживает `@>`, `?`, `?|`, `?&`, `@?`, `@@`.

**2. GIN с `jsonb_path_ops`:**

```sql
CREATE INDEX events_payload_path_gin ON events USING gin (payload jsonb_path_ops);
```

Хранит хеш пути «ключ → … → значение». Индекс заметно меньше и быстрее для `@>`, но **не поддерживает** операторы существования ключа `?`, `?|`, `?&`. Хороший выбор, если запросы — только `@>` и jsonpath.

**3. B-tree по выражению — для конкретного поля:**

```sql
CREATE INDEX events_order_id_idx ON events (((payload ->> 'order_id')::bigint));

SELECT * FROM events WHERE (payload ->> 'order_id')::bigint = 42;
SELECT * FROM events
WHERE (payload ->> 'created')::timestamptz > now() - interval '1 day';
```

Второй запрос с таким индексом работать не будет: приведение `text → timestamptz` не `IMMUTABLE` (зависит от настроек сессии), индекс по нему создать нельзя. Даты для индексации лучше выносить в обычную колонку.

**Главная ловушка: GIN не помогает `->>` с `=`.**

```sql
SELECT * FROM events WHERE payload ->> 'type' = 'order_created';
```

Индекс `USING gin (payload)` здесь **не используется** — оператор `->>` с `=` не входит в его opclass. Нужно либо переписать на `payload @> '{"type": "order_created"}'`, либо создать B-tree по `(payload ->> 'type')`. В EF Core важно проверять, какой SQL генерирует LINQ над `jsonb`-свойствами.

**Как выбирать:**

| Запросы | Индекс |
| --- | --- |
| Одно-два известных поля, равенство/диапазон/сортировка | B-tree по выражению (или generated column + индекс) |
| Произвольные фильтры по разным ключам, `@>` | GIN `jsonb_path_ops` |
| Нужна проверка наличия ключа `?` | GIN `jsonb_ops` |
| Поиск подстроки в значении | вынести поле, триграммный GIN |

**Стоимость и нюансы:**

- GIN по большим документам большой и замедляет запись: каждая вставка добавляет много ключей. Сглаживается `fastupdate` и pending list.
- `@>` по значению, которое есть почти во всех документах, через индекс неэффективен — выбор Seq Scan тут будет правильным.
- Частичный GIN помогает сузить индекс: `WHERE type = 'order_created'`.
- После создания индекса по выражению нужен `ANALYZE`, чтобы появилась статистика по выражению — без неё оценки по JSON-полям дефолтные и часто ошибочные.
- Если поле стало важным для запросов, надёжнее вынести его в обычную колонку (можно через `GENERATED ALWAYS AS (...) STORED`).

## Что такое partitioning?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-partitioning
tags: partitioning
```

Партиционирование — разбиение одной большой логической таблицы на несколько физических таблиц-секций (partitions) по значению ключа. Приложение работает с родительской таблицей как с обычной, а PostgreSQL сам направляет строки в нужную секцию и при запросах читает только подходящие секции (partition pruning).

**Декларативное партиционирование** (PG 10+) поддерживает три способа:

```sql
CREATE TABLE events (
    id bigint GENERATED ALWAYS AS IDENTITY,
    created_at timestamptz NOT NULL,
    tenant_id int NOT NULL,
    payload jsonb,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2025_05 PARTITION OF events
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE events_2025_06 PARTITION OF events
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE events_default PARTITION OF events DEFAULT;
```

| Тип | Пример | Где полезен |
| --- | --- | --- |
| `RANGE` | по месяцам `created_at` | логи, события, история — удаление старых данных |
| `LIST` | по `region` или `status` | явные группы значений |
| `HASH` (PG 11+) | `MODULUS 8, REMAINDER n` по `tenant_id` | равномерное распределение без естественного диапазона |

Секции можно разбивать дальше (sub-partitioning): например, по месяцам, а внутри — по хешу.

**Partition pruning:**

```sql
EXPLAIN SELECT * FROM events WHERE created_at >= '2025-06-10';
```

```text
Append
  ->  Seq Scan on events_2025_06
        Filter: (created_at >= '2025-06-10')
  ->  Seq Scan on events_default
```

Секции за май вообще не читаются. Pruning работает на этапе планирования и, с PG 11, во время выполнения — для параметров и значений из подзапросов.

**Что даёт:**

- быстрое удаление старых данных: `DROP TABLE events_2024_01` или `DETACH PARTITION` вместо многочасового `DELETE`;
- меньшие индексы и таблицы — VACUUM и обслуживание идут по секциям;
- запросы с условием по ключу читают меньше данных.

**Ограничения:**

- первичный ключ и уникальные ограничения **обязаны включать ключ партиционирования** — глобальной уникальности по `id` нет;
- запросы без условия по ключу проходят по всем секциям — с сотнями секций растёт время планирования;
- `UPDATE`, меняющий ключ, переносит строку в другую секцию (с PG 11), это `DELETE + INSERT`;
- секции нужно создавать заранее — вручную, через `pg_partman` или фоновую задачу; иначе строки попадут в `DEFAULT` или вставка упадёт.

**Не путать с шардированием:** все секции живут на одном сервере. Распределение по серверам — Citus или шардирование на уровне приложения.

## Когда использовать partitioning?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kogda-ispolzovat-partitioning
tags: partitioning
```

Партиционирование оправдано, когда таблица большая (десятки–сотни ГБ и больше) **и** у данных есть ключ, по которому запросы и жизненный цикл естественно делятся: чаще всего время. Главный выигрыш — дешёвое удаление старых данных и обслуживание по частям; ускорение запросов — вторично и не гарантировано.

**Сильные сигналы «пора»:**

- **Retention.** Данные хранятся N месяцев, старое регулярно удаляется. `DELETE` миллионов строк — это часы работы, WAL, bloat и нагрузка на VACUUM; `DROP TABLE events_2024_01` (или `DETACH PARTITION ... CONCURRENTLY`, PG 14+) — миллисекунды.
- **Почти все запросы фильтруют по ключу.** «События за последние 7 дней», «данные тенанта X» — pruning отрезает ненужные секции.
- **Горячие и холодные данные.** Пишут и читают только последние секции; старые неизменны, их можно провакуумировать один раз (`VACUUM FREEZE`) и больше не трогать, вынести на дешёвое хранилище через tablespace.
- **Обслуживание не помещается в окно.** VACUUM, `REINDEX`, создание индекса по таблице в терабайт идут сутками; по секциям — параллельно и порциями.
- **Массовая загрузка.** Загрузить данные в отдельную таблицу, построить индексы и подключить через `ATTACH PARTITION`.

**Когда партиционирование не нужно или вредно:**

- таблица на единицы–десятки ГБ — хороших индексов обычно достаточно;
- запросы в основном **без** ключа партиционирования — каждый пойдёт по всем секциям, план станет сложнее и дольше;
- нужна глобальная уникальность по колонке вне ключа (`UNIQUE (email)` при партиционировании по дате невозможен);
- много точечных запросов по `id` при ключе `created_at` — они будут проверять индекс каждой секции;
- ORM генерирует запросы, в которых ключ передаётся так, что pruning срабатывает только во время выполнения или не срабатывает вовсе.

**Сколько секций.** Десятки–сотни — нормально, тысячи — уже риск: растёт время планирования, потребление памяти на соединение (кэш метаданных), число блокировок на запрос без pruning (возможна ошибка `out of shared memory` из-за `max_locks_per_transaction`). Размер секции — ориентир от единиц до десятков ГБ.

**Выбор ключа на практике:**

| Нагрузка | Ключ |
| --- | --- |
| Логи, события, метрики, история заказов | `RANGE` по времени (день/неделя/месяц) |
| Мультитенантная система с крупными тенантами | `LIST` или `HASH` по `tenant_id` |
| Нужно равномерно размазать запись без естественного диапазона | `HASH` |

**Что учесть заранее:**

- PK должен включать ключ: `PRIMARY KEY (id, created_at)`; внешние ключи **на** такую таблицу ссылаются по составному ключу;
- автоматическое создание будущих секций — `pg_partman` с фоновым воркером или `pg_cron`; иначе в новый месяц вставки упадут или уйдут в `DEFAULT`;
- `DEFAULT`-секция удобна как страховка, но мешает: при `ATTACH` новой секции PostgreSQL проверяет, нет ли в `DEFAULT` подходящих строк, сканируя её.

**Альтернативы, которые стоит рассмотреть до партиционирования:** частичные индексы под горячие данные, BRIN по времени, архивирование в отдельную таблицу, вынос аналитики в колоночное хранилище (ClickHouse) или TimescaleDB.

## Что такое materialized view?

```yaml
category: postgresql
level: middle
difficulty: 2
slug: postgresql-chto-takoe-materialized-view
```

Materialized view — представление, результат которого **сохранён на диск** как таблица. В отличие от обычного view, запрос не выполняется при каждом обращении: данные берутся из сохранённого снимка, а обновляются явной командой `REFRESH MATERIALIZED VIEW`.

```sql
CREATE MATERIALIZED VIEW daily_sales AS
SELECT date_trunc('day', created_at) AS day,
       product_id,
       sum(qty)   AS qty,
       sum(total) AS revenue
FROM orders
WHERE status = 'paid'
GROUP BY 1, 2
WITH DATA;

CREATE UNIQUE INDEX ON daily_sales (day, product_id);

SELECT * FROM daily_sales WHERE day >= now() - interval '30 days';
```

Тяжёлая агрегация по миллионам заказов выполняется один раз при обновлении, а дашборд читает готовые строки по индексу.

**Обновление:**

```sql
REFRESH MATERIALIZED VIEW daily_sales;
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales;
```

| | Обычный `REFRESH` | `REFRESH ... CONCURRENTLY` |
| --- | --- | --- |
| Блокировка | `ACCESS EXCLUSIVE` — чтение блокируется на время пересчёта | `EXCLUSIVE` — чтение работает, параллельный refresh ждёт |
| Как работает | пересчитывает и подменяет содержимое целиком | пересчитывает во временную таблицу, сравнивает и применяет разницу |
| Требования | нет | уникальный индекс только по колонкам, без `WHERE`; view уже заполнен |
| Скорость | быстрее, если меняется много | медленнее при больших изменениях, генерирует больше мёртвых строк |

**Чего нет в PostgreSQL:**

- **автоматического обновления** при изменении исходных таблиц — refresh запускают по расписанию (`pg_cron`, фоновая задача приложения) или из триггеров/событий;
- **инкрементального обновления** — пересчитывается всё целиком (есть сторонние расширения вроде `pg_ivm`).

**Где использовать:**

- отчёты, дашборды, агрегаты, где допустима задержка данных в минуты–часы;
- денормализованные «витрины» для поиска или API;
- дорогие соединения с внешними таблицами (`postgres_fdw`) — материализовать локально.

**Подводные камни:**

- **Устаревание данных** — нужно явно определить, какая задержка допустима, и отслеживать время последнего обновления (в PostgreSQL его нет в системных каталогах — пишут в отдельную таблицу).
- **Стоимость refresh** растёт вместе с исходными данными: пересчёт агрегата за всю историю каждые 5 минут однажды начнёт занимать больше 5 минут.
- **Bloat** при `CONCURRENTLY` — изменённые строки удаляются и вставляются, нужен vacuum.
- **Зависимости:** `ALTER` исходной таблицы может потребовать пересоздания view.
- **Права:** refresh выполняет владелец view.

**В EF Core** materialized view мапят как keyless entity (`ToView("daily_sales")`), создают и обновляют через сырые SQL-миграции.

## View vs materialized view?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-view-vs-materialized-view
```

Обычный **view** — это сохранённый **запрос**: при каждом обращении он подставляется в запрос пользователя и выполняется заново, данные всегда актуальны. **Materialized view** — сохранённый **результат**: читается быстро, как таблица, но показывает данные на момент последнего `REFRESH`.

| | View | Materialized view |
| --- | --- | --- |
| Что хранится | только текст запроса | результат запроса на диске |
| Актуальность | всегда актуальные данные | на момент последнего `REFRESH` |
| Стоимость чтения | как у исходного запроса | как чтение таблицы |
| Индексы | нельзя (используются индексы базовых таблиц) | можно создавать свои |
| Обновление | не требуется | `REFRESH MATERIALIZED VIEW [CONCURRENTLY]` |
| Запись через него | простые view автоматически обновляемые (`INSERT/UPDATE/DELETE`) | нельзя |
| Место на диске | нет | да |

**Как работает обычный view.** Планировщик раскрывает view как подзапрос и оптимизирует всё вместе. Условия из внешнего запроса проталкиваются внутрь:

```sql
CREATE VIEW active_customers AS
SELECT id, name, email FROM customers WHERE deleted_at IS NULL;

SELECT * FROM active_customers WHERE id = 42;
```

Это выполнится как `SELECT ... FROM customers WHERE deleted_at IS NULL AND id = 42` с использованием индекса по `id`. Поэтому сам по себе view **не делает запрос ни быстрее, ни медленнее**. Исключения — view с агрегатами, `DISTINCT`, оконными функциями или `LIMIT`: не всякое условие можно протолкнуть внутрь, и view может оказаться дороже, чем ожидалось.

**Зачем обычные view:**

- инкапсуляция сложных соединений и логики фильтрации;
- стабильный контракт для отчётных инструментов при изменении схемы;
- безопасность: дать доступ к view вместо таблицы (`security_barrier`, с PG 15 — `security_invoker` для проверки прав вызывающего);
- обновляемые view для обратной совместимости при рефакторинге схемы.

**Зачем materialized view:**

- тяжёлые агрегации, которые нельзя считать на каждый запрос;
- допустима задержка данных;
- нужны свои индексы по результату.

**Как выбрать:**

- данные должны быть строго актуальными — обычный view (и, если медленно, — индексы на базовых таблицах или денормализация с триггерами);
- допустимо отставание и запрос тяжёлый — materialized view с регулярным refresh;
- нужна актуальность **и** скорость на больших объёмах — таблица-агрегат, обновляемая инкрементально (триггеры, outbox, обработчик событий), так как инкрементальных materialized view в ядре нет.

**Частый вопрос:** «Ускорит ли перенос запроса во view?» — нет, если view обычный. Ускорит только материализация или изменение самого запроса/индексов.

## Как работать с большими таблицами?

```yaml
category: postgresql
level: middle
difficulty: 3
slug: postgresql-kak-rabotat-s-bolshimi-tablicami
```

С большой таблицей (сотни миллионов строк, сотни ГБ) работают по принципу «никаких операций на всю таблицу разом»: запросы — только по индексам, изменения и миграции — батчами и без долгих блокировок, обслуживание — с настроенным под размер autovacuum, а данные по возможности делятся на части (партиции, архив).

**1. Запросы.**

- Каждый частый запрос должен попадать в индекс; Seq Scan по такой таблице — инцидент. Проверять через `pg_stat_statements` и `EXPLAIN (ANALYZE, BUFFERS)`.
- Пагинация — keyset (`WHERE id > @last`), а не `OFFSET`.
- `count(*)` по всей таблице дорог — использовать оценку (`pg_class.reltuples`) или счётчики.
- Ограничивать выборки: `LIMIT`, только нужные колонки.
- Индексов не больше, чем нужно: каждый замедляет вставку и обновление, мешает HOT.

**2. Изменения данных батчами.**

```sql
UPDATE orders SET status_v2 = status
WHERE id IN (
  SELECT id FROM orders
  WHERE status_v2 IS NULL
  LIMIT 5000
);
```

Повторять в цикле с коммитом после каждой пачки (из приложения или процедурой). Так блокировки короткие, VACUUM успевает чистить, реплики не отстают, а прерванную операцию можно продолжить.

**3. Изменения схемы.**

- `ADD COLUMN` с константным `DEFAULT` мгновенный (PG 11+), без перезаписи;
- индексы — только `CREATE INDEX CONCURRENTLY`;
- ограничения — `NOT VALID`, затем `VALIDATE CONSTRAINT`;
- смена типа колонки, которая перезаписывает таблицу, — через новую колонку, бэкфилл и переключение;
- в миграциях всегда `SET lock_timeout`.

**4. Обслуживание.**

- Пороги autovacuum по умолчанию (20% мёртвых строк) для большой таблицы слишком велики — ставить `autovacuum_vacuum_scale_factor` порядка 0.01–0.05 или фиксированный `threshold` на уровне таблицы.
- Следить за `n_dead_tup`, bloat, возрастом `relfrozenxid`.
- `VACUUM FULL` не использовать — блокирует таблицу; для сжатия есть `pg_repack`.
- Поднять `statistics` для колонок с перекосом: выборка `ANALYZE` фиксирована, и на миллиардах строк редкие значения не попадают в статистику.

**5. Структура данных.**

- **Партиционирование** по времени или тенанту — если есть естественный ключ и retention.
- **Архивирование** — переносить старые данные в архивную таблицу или хранилище.
- **Вертикальное разделение** — тяжёлые редко читаемые колонки (`jsonb`, тексты) в отдельную таблицу 1:1.
- **Типы данных** — `bigint` для идентификаторов с запасом (переход с `int` на живой таблице болезненный), `timestamptz`, без лишних `text` там, где хватает `smallint`-кода.

**6. Эксплуатация.**

- `statement_timeout` для OLTP-ролей, чтобы случайный тяжёлый запрос не жил часами;
- тяжёлую аналитику — на реплику или в отдельное хранилище;
- бэкапы и восстановление — проверять время восстановления, для больших баз — физические бэкапы (pgBackRest, WAL-G), а не `pg_dump`.

**Что спрашивают дальше:** как удалить миллионы строк без блокировок, как добавить индекс без простоя, как перевести таблицу на партиционирование на лету.

## Как устроен MVCC в PostgreSQL и почему UPDATE создаёт новую версию строки?

```yaml
category: postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-kak-ustroen-mvcc-v-postgresql-i-pochemu-update-sozdaet-novuyu-versiyu
tags: mvcc, internals
```

В PostgreSQL каждая строка таблицы (tuple) — это **версия**, помеченная идентификаторами транзакций, которые её создали и удалили. `UPDATE` не меняет строку на месте: он помечает старую версию удалённой и вставляет новую. Так разные транзакции могут одновременно видеть разные версии одной логической строки без блокировок чтения, а откат транзакции не требует undo — её версии просто остаются невидимыми.

**Заголовок версии строки (heap tuple header):**

| Поле | Смысл |
| --- | --- |
| `xmin` | XID транзакции, создавшей версию |
| `xmax` | XID транзакции, удалившей или заблокировавшей версию (0, если нет) |
| `cmin`/`cmax` | номер команды внутри транзакции — для видимости своих же изменений |
| `ctid` | физический адрес (страница, позиция); у старой версии указывает на новую |
| `t_infomask` | флаги, в том числе hint bits: «xmin закоммичен», «xmax откатился» и т. п. |

```sql
SELECT ctid, xmin, xmax, * FROM accounts WHERE id = 1;
UPDATE accounts SET balance = balance + 1 WHERE id = 1;
SELECT ctid, xmin, xmax, * FROM accounts WHERE id = 1;
```

`ctid` сменится, например, с `(0,1)` на `(0,7)`, `xmin` станет XID текущей транзакции.

**Видимость.** Транзакция получает **snapshot**: `xmin` (все XID меньше — завершены), `xmax` (все XID начиная с него — ещё не начались к моменту снимка) и список XID, активных в момент снимка. Версия видна, если:

- её `xmin` закоммичен и не «в будущем» относительно снимка;
- её `xmax` пуст, откатился или ещё не закоммичен с точки зрения снимка.

Статус транзакций (in progress / committed / aborted) хранится в `pg_xact` (CLOG). Чтобы не ходить туда при каждой проверке, первая транзакция, узнавшая статус, ставит **hint bits** в заголовок строки. Поэтому даже `SELECT` по только что загруженным данным может «пачкать» страницы и писать на диск.

**Почему выбран такой дизайн (а не undo-лог, как в Oracle/InnoDB):**

- откат мгновенный — ничего не нужно возвращать;
- чтение старой версии не требует реконструкции из undo;
- простая реализация видимости для любого числа параллельных снимков.

**Цена:**

- мёртвые версии лежат в самой таблице, нужен VACUUM;
- каждое `UPDATE` пишет новую строку целиком, даже если изменилась одна колонка (большие значения в TOAST переиспользуются, если не менялись);
- новая версия может требовать новых записей **во всех индексах** — индекс указывает на `ctid`, а он изменился. Это write amplification.

**HOT (Heap-Only Tuple) — главная оптимизация.** Если `UPDATE` не меняет ни одной проиндексированной колонки **и** на той же странице есть место, новая версия пишется на ту же страницу, а индексы не трогаются: из старой версии строится цепочка к новой. Мёртвые версии в HOT-цепочке могут быть вычищены прямо при чтении страницы (page pruning), без VACUUM.

```sql
SELECT relname, n_tup_upd, n_tup_hot_upd
FROM pg_stat_user_tables ORDER BY n_tup_upd DESC LIMIT 10;
```

Как повысить долю HOT: не индексировать часто обновляемые колонки (`updated_at`, счётчики), оставлять место на страницах через `fillfactor` (например, `ALTER TABLE t SET (fillfactor = 80)` для таблиц с частыми обновлениями).

**Следствия для приложения:**

- массовый `UPDATE` всей таблицы удваивает её физический размер до прохода VACUUM;
- «счётчик в одной строке», обновляемый тысячи раз в секунду, порождает тысячи мёртвых версий и конкуренцию за блокировку строки;
- долгая транзакция держит горизонт: версии, удалённые после её снимка, не могут быть очищены ни в одной таблице базы;
- XID — 32-битный, поэтому старые версии нужно «замораживать» (freeze), иначе — wraparound.

## Что такое bloat таблиц и индексов, как его обнаружить и убрать?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-chto-takoe-bloat-tablic-i-indeksov-kak-ego-obnaruzhit-i-ubrat
tags: vacuum, maintenance
```

Bloat — пространство в файлах таблиц и индексов, занятое мёртвыми версиями строк или пустотами, которые не используются полезными данными. Таблица с 10 ГБ живых данных может занимать 40 ГБ. Это замедляет Seq Scan, ухудшает попадание в кэш, раздувает бэкапы и реплики. Источник — MVCC плюс VACUUM, который не успевает или не может чистить.

**Откуда берётся:**

- **VACUUM не может удалить версии** из-за удерживаемого горизонта: долгие транзакции, `idle in transaction`, забытые prepared transactions, неактивные слоты репликации, долгие запросы на реплике с `hot_standby_feedback = on`.
- **VACUUM не успевает** — пороги autovacuum слишком высоки для большой таблицы, мало воркеров, слишком сильный throttling.
- **Массовые `UPDATE`/`DELETE`** — даже после очистки место остаётся внутри файла: обычный VACUUM переиспользует его, но не возвращает ОС (кроме пустых страниц в самом конце файла).
- **Индексы** распухают сильнее таблиц: страница индекса освобождается, только когда пуста целиком; паттерны вроде «вставка в конец, удаление старого» оставляют полупустые страницы. С PG 13 дедупликация, а с PG 14 bottom-up deletion заметно снизили bloat B-tree от неHOT-обновлений.

**Как обнаружить:**

1. Быстрые признаки:

```sql
SELECT relname, n_live_tup, n_dead_tup,
       round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
       last_autovacuum, pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC LIMIT 20;
```

`n_dead_tup` показывает не вычищенные строки, но не «пустоты», уже освобождённые VACUUM.

2. Точная оценка — расширение `pgstattuple`:

```sql
CREATE EXTENSION pgstattuple;
SELECT * FROM pgstattuple_approx('orders');
SELECT * FROM pgstatindex('orders_pkey');
```

`pgstattuple_approx` использует visibility map и читает только не all-visible страницы; полный `pgstattuple` читает всю таблицу — на больших таблицах осторожно. Для индекса смотрят `avg_leaf_density` (для B-tree с дефолтным fillfactor 90 — норма около 90%, 50% и ниже — сильно распух).

3. Оценочные запросы по статистике (популярные скрипты ioguix/pgsql-bloat-estimation) — без чтения данных, но приблизительно.

**Как убрать:**

| Способ | Блокировки | Когда |
| --- | --- | --- |
| `VACUUM` | не мешает DML | освобождает место для переиспользования; размер файла почти не меняется |
| `VACUUM FULL` / `CLUSTER` | `ACCESS EXCLUSIVE` на всё время | только в окно обслуживания; нужно место под полную копию |
| `pg_repack` | короткие эксклюзивные блокировки в начале и конце | основной инструмент для таблиц под нагрузкой; нужен PK/уникальный ключ и двойное место |
| `pg_squeeze` | аналогично, через логическое декодирование | альтернатива `pg_repack` |
| `REINDEX INDEX CONCURRENTLY` (PG 12+) | не блокирует запись | для распухших индексов |

Для индексов чаще всего достаточно `REINDEX CONCURRENTLY` — дешевле, чем перестраивать таблицу.

**Главное — устранить причину, иначе bloat вернётся:**

- найти и убрать удерживающих горизонт:

```sql
SELECT pid, state, now() - xact_start AS age, backend_xmin
FROM pg_stat_activity WHERE backend_xmin IS NOT NULL
ORDER BY age(backend_xmin) DESC LIMIT 5;

SELECT slot_name, active, xmin, catalog_xmin FROM pg_replication_slots;
SELECT gid, prepared FROM pg_prepared_xacts;
```

- настроить `idle_in_transaction_session_timeout`;
- снизить `autovacuum_vacuum_scale_factor` для больших и горячих таблиц, поднять `autovacuum_vacuum_cost_limit`;
- для часто обновляемых таблиц — `fillfactor` 70–90 и меньше индексов на изменяемых колонках, чтобы обновления были HOT;
- вместо массового `DELETE` старых данных — партиции и `DROP`.

**Что спрашивают дальше:** почему VACUUM не уменьшает размер файла; почему bloat на мастере растёт из-за аналитического запроса на реплике (`hot_standby_feedback`).

## Почему autovacuum не успевает и как его настраивать под высокую нагрузку записи?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-pochemu-autovacuum-ne-uspevaet-i-kak-ego-nastraivat-pod-vysokuyu-nagru
tags: vacuum, maintenance
```

Настройки autovacuum по умолчанию рассчитаны на небольшую базу на скромном железе: три воркера на весь кластер, пороги в 20% таблицы и сильный throttling. Под нагрузкой записи это приводит к тому, что мёртвые строки копятся быстрее, чем их чистят. Но прежде чем тюнить скорость, нужно убедиться, что vacuum **может** чистить: самая частая причина «не успевает» — удерживаемый горизонт, а не медленный vacuum.

**Шаг 1. Проверить, не держит ли что-то горизонт.** Если в `VACUUM VERBOSE` или в логе autovacuum много `dead but not yet removable` — тюнинг бесполезен. Виновники:

```sql
SELECT pid, state, now() - xact_start AS xact_age, age(backend_xmin) AS xmin_age, left(query, 60)
FROM pg_stat_activity WHERE backend_xmin IS NOT NULL
ORDER BY age(backend_xmin) DESC LIMIT 5;

SELECT slot_name, active, age(xmin) AS xmin_age, age(catalog_xmin) AS catalog_xmin_age
FROM pg_replication_slots;
```

Плюс `pg_prepared_xacts` и долгие запросы на репликах с `hot_standby_feedback = on`.

**Шаг 2. Понять, где узкое место:**

| Симптом | Причина |
| --- | --- |
| большие таблицы обрабатываются редко, `n_dead_tup` огромный | порог `scale_factor = 0.2` слишком высок |
| воркеры постоянно заняты, очередь таблиц не уменьшается | мало воркеров или они упираются в cost limit |
| один прогон по таблице длится часами | throttling, много индексов, мало памяти под список мёртвых TID |
| vacuum постоянно прерывается | конфликт с DDL/`LOCK` (обычный autovacuum уступает блокировкам) |

`pg_stat_progress_vacuum` показывает фазу и прогресс; `log_autovacuum_min_duration` (с PG 15 по умолчанию 10 мин; на нагруженных системах ставят 0 или несколько секунд) — длительность, число удалённых и оставшихся строк, I/O.

**Шаг 3. Настройка.**

*Пороги — на уровне горячих таблиц:*

```sql
ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_vacuum_threshold = 10000,
  autovacuum_vacuum_insert_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.02
);
```

*Скорость — глобально:*

- `autovacuum_vacuum_cost_limit` — поднять с дефолтных 200 (берутся из `vacuum_cost_limit`) до 1000–3000 на SSD. Лимит **делится между всеми активными воркерами**, поэтому увеличение числа воркеров без увеличения лимита не ускоряет общую работу;
- `autovacuum_vacuum_cost_delay` — 2 мс по умолчанию (с PG 12); можно уменьшить до 0–1 мс на быстрых дисках;
- `autovacuum_max_workers` — 5–10 при большом числе таблиц; до PG 18 изменение требует рестарта;
- `autovacuum_naptime` — уменьшить, если таблиц много и они обходятся слишком редко.

*Память:* `autovacuum_work_mem` (по умолчанию -1, то есть `maintenance_work_mem`, 64 МБ) — сколько TID мёртвых строк vacuum держит за раз. Если не хватает, индексы сканируются несколько раз за один прогон — для таблицы с десятком индексов это кратно дольше. До PG 17 эффективный предел был 1 ГБ; в PG 17 хранилище TID переписано (TidStore), оно компактнее и без этого ограничения.

**Шаг 4. Снизить объём работы для vacuum:**

- HOT-обновления: убрать индексы с часто меняющихся колонок, `fillfactor` 70–90;
- партиционирование: vacuum по маленьким секциям, удаление через `DROP`, а не `DELETE`;
- меньше лишних индексов — каждый индекс проходится целиком в фазе очистки индексов (с PG 14 vacuum может пропускать её, если мёртвых строк очень мало).

**Шаг 5. Ручной vacuum в окно низкой нагрузки** для самых больших таблиц: `VACUUM (PARALLEL 4, VERBOSE) big_table` — параллельная очистка индексов есть только в ручном `VACUUM`, autovacuum её не использует.

**Чего не делать:** отключать autovacuum на таблице (`autovacuum_enabled = off`) «чтобы не мешал» — anti-wraparound vacuum всё равно придёт, но позже, в виде длинного агрессивного прогона в неудобный момент.

## Что такое transaction ID wraparound и чем он угрожает продакшену?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-chto-takoe-transaction-id-wraparound-i-chem-on-ugrozhaet-prodakshenu
tags: vacuum, mvcc
```

XID в PostgreSQL — 32-битный счётчик (около 4,2 млрд значений), а сравнение XID идёт по модулю 2³²: для каждой транзакции примерно 2,1 млрд XID считаются «в прошлом», а остальные — «в будущем». Если строку с очень старым `xmin` не «заморозить», после прохода счётчика по кругу её `xmin` окажется «в будущем», и строка исчезнет для всех. Чтобы этого не случилось, PostgreSQL **останавливает выдачу новых XID** — база перестаёт принимать запись. Это и есть угроза: внезапная авария на продакшене, лечение которой может занять часы.

**Заморозка (freeze).** VACUUM помечает достаточно старые версии строк как frozen (флаг в `t_infomask`): такие строки считаются видимыми всем, независимо от значения `xmin`. Самый старый незамороженный XID таблицы хранится в `pg_class.relfrozenxid`, для базы — в `pg_database.datfrozenxid`.

**Ключевые параметры:**

| Параметр | По умолчанию | Смысл |
| --- | --- | --- |
| `vacuum_freeze_min_age` | 50 млн | строки старше этого возраста замораживаются при vacuum |
| `vacuum_freeze_table_age` | 150 млн | при таком возрасте `relfrozenxid` vacuum становится агрессивным — проверяет все не all-frozen страницы |
| `autovacuum_freeze_max_age` | 200 млн | принудительный anti-wraparound autovacuum, **даже если autovacuum выключен** |
| `vacuum_failsafe_age` (PG 14+) | 1,6 млрд | vacuum отключает throttling и очистку индексов, чтобы успеть заморозить |
| `autovacuum_multixact_freeze_max_age` | 400 млн | то же для MultiXact ID |

**Хронология катастрофы:**

1. Возраст таблицы достигает 200 млн — запускается anti-wraparound autovacuum (`to prevent wraparound` в `pg_stat_activity`). Он не уступает блокировкам: DDL на этой таблице будет ждать его.
2. Если он не может завершиться (горизонт держит долгая транзакция или слот репликации) или не успевает — возраст растёт.
3. За 40 млн XID до предела — предупреждения в логе: `database "app" must be vacuumed within N transactions`.
4. За 3 млн XID до предела — ошибка на любую операцию, требующую нового XID: `database is not accepting commands that assign new transaction IDs to avoid wraparound data loss`. Чтение работает, запись — нет.

**Почему это реально случается:** высокая скорость записи (сотни миллионов XID в сутки — не редкость), огромные таблицы, где агрессивный vacuum идёт сутками, забытый неактивный слот репликации или prepared transaction, отключённый autovacuum, или его постоянные отмены.

**Мониторинг — обязателен:**

```sql
SELECT datname, age(datfrozenxid) AS xid_age,
       round(100.0 * age(datfrozenxid) / 2147483648, 1) AS pct_to_wraparound
FROM pg_database ORDER BY 2 DESC;

SELECT c.oid::regclass, age(c.relfrozenxid) AS xid_age,
       pg_size_pretty(pg_total_relation_size(c.oid))
FROM pg_class c
WHERE c.relkind IN ('r', 'm', 't')
ORDER BY age(c.relfrozenxid) DESC LIMIT 10;
```

Алерт обычно ставят на возраст 500 млн – 1 млрд (25–50% от предела) и отдельно — на таблицы, которые давно перешагнули `autovacuum_freeze_max_age`, но так и не были заморожены.

**Как лечить, если уже близко:**

- найти и устранить удерживающих горизонт (долгие транзакции, `pg_replication_slots`, `pg_prepared_xacts`);
- запустить `VACUUM (FREEZE, VERBOSE)` по самым старым таблицам вручную, без throttling (`SET vacuum_cost_delay = 0`), при необходимости параллельно по разным таблицам;
- если база уже остановилась — в современных версиях не нужен single-user mode: достаточно подключиться и выполнить `VACUUM` по самым старым таблицам (команды, не требующие нового XID, работают).

**Профилактика:**

- не поднимать `autovacuum_freeze_max_age` выше дефолта без мониторинга: это лишь откладывает и удлиняет агрессивные прогоны;
- для append-only таблиц помогает insert-триггер autovacuum (PG 13+) — он замораживает страницы до того, как они станут старыми;
- экономить XID: не открывать транзакции без нужды, избегать массовых subtransactions (`EXCEPTION`-блоки в цикле), батчить мелкие записи.

## Как работает WAL и как он влияет на скорость записи?

```yaml
category: postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-kak-rabotaet-wal-i-kak-on-vliyaet-na-skorost-zapisi
tags: wal, internals
```

WAL (Write-Ahead Log) — журнал изменений, который PostgreSQL записывает **до** того, как изменённые страницы данных попадут на диск. Коммит считается надёжным, когда его WAL-записи сброшены на диск (`fsync`), а сами страницы таблиц и индексов пишутся позже, в фоне. После сбоя база восстанавливается, проигрывая WAL с последней контрольной точки. Тот же WAL — основа физической репликации, PITR и логического декодирования.

**Путь изменения:**

1. Backend меняет страницу в `shared_buffers` и формирует WAL-запись в `wal_buffers`.
2. На `COMMIT` WAL до записи коммита сбрасывается в сегмент `pg_wal/` и выполняется `fsync` (при `synchronous_commit = on`).
3. Клиент получает подтверждение.
4. Грязные страницы данных позже записывают checkpointer и background writer.

**Почему это быстро.** Вместо случайной записи многих страниц таблиц и индексов при каждом коммите — **последовательная** дозапись в журнал. Несколько параллельных коммитов объединяются одним `fsync` (group commit).

**Что определяет стоимость записи:**

- **Задержка `fsync` на диске WAL.** На каждый коммит — как минимум один сброс. На дешёвых SSD без защиты от потери питания или на сетевых дисках это миллисекунды, и они напрямую ограничивают TPS маленьких транзакций. Поэтому WAL выносят на быстрый отдельный диск, а мелкие записи батчат в одну транзакцию.
- **Объём WAL.** Каждая вставка пишет запись для heap и для **каждого индекса**. `UPDATE` без HOT — новая версия плюс записи во все индексы.
- **Full page writes** (`full_page_writes = on`, нельзя выключать без гарантий атомарной записи страницы ФС/диском). При первом изменении страницы после checkpoint в WAL пишется **вся страница** (8 КБ), чтобы восстановиться после «рваной» записи. Сразу после checkpoint объём WAL резко растёт — особенно при случайных обновлениях по большой таблице и UUIDv4-ключах.
- **`wal_level`.** `replica` (по умолчанию) — достаточно для физической реплики и PITR; `logical` добавляет информацию для логического декодирования и увеличивает объём; `minimal` позволяет не журналировать массовые загрузки в созданную в этой же транзакции таблицу, но исключает реплики и PITR.

**Как измерять:**

```sql
SELECT wal_records, wal_fpi, pg_size_pretty(wal_bytes) AS wal, wal_buffers_full
FROM pg_stat_wal;

EXPLAIN (ANALYZE, WAL) UPDATE orders SET status = 'x' WHERE id < 10000;
```

`wal_fpi` — число full page images; высокая доля — признак частых checkpoint-ов или случайных обновлений. `wal_buffers_full` > 0 — `wal_buffers` маловат. Генерацию WAL во времени — через разницу `pg_current_wal_lsn()`.

**Рычаги оптимизации:**

- `wal_compression` — сжатие full page images (`lz4`/`zstd` с PG 15): меньше объём WAL ценой CPU;
- реже checkpoint-ы (`max_wal_size`, `checkpoint_timeout`) — меньше FPI;
- меньше индексов, больше HOT-обновлений;
- последовательные ключи (bigint identity, UUIDv7) вместо случайных — меньше затронутых страниц индекса;
- батчинг: одна транзакция на 1000 вставок вместо 1000 транзакций; `COPY` вместо отдельных `INSERT`;
- `synchronous_commit = off` для некритичных данных — коммит не ждёт `fsync`;
- `UNLOGGED`-таблицы для временных и восстановимых данных — WAL не пишется вовсе, но таблица очищается после сбоя и не реплицируется.

**Побочные эффекты большого WAL:** отставание реплик, рост архива WAL и времени восстановления, переполнение диска `pg_wal`, если архивирование или слот репликации не успевают.

## Что происходит во время checkpoint и почему latency периодически подскакивает?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-chto-proishodit-vo-vremya-checkpoint-i-pochemu-latency-periodicheski-p
tags: wal, performance
```

Checkpoint — момент, когда PostgreSQL записывает на диск **все грязные страницы** из `shared_buffers`, делает `fsync` файлов данных и пишет в WAL запись контрольной точки. После этого WAL до этой точки больше не нужен для восстановления после сбоя. Периодические всплески latency связаны с тем, что checkpoint резко увеличивает и запись данных на диск, и объём WAL сразу после себя.

**Когда запускается:**

- по времени — `checkpoint_timeout` (по умолчанию 5 мин);
- по объёму WAL — при приближении к `max_wal_size` (по умолчанию 1 ГБ);
- вручную (`CHECKPOINT`), при остановке сервера, перед `CREATE DATABASE`, в начале базового бэкапа.

**Как он размазывается.** Checkpointer пишет грязные страницы не разом, а растягивает запись на долю интервала до следующего checkpoint — `checkpoint_completion_target` (0.9 по умолчанию с PG 14). В конце — `fsync` всех затронутых файлов.

**Откуда берутся всплески:**

1. **Full page writes после checkpoint.** Первое изменение каждой страницы после контрольной точки пишет в WAL всю страницу (8 КБ) вместо небольшой записи. Сразу после начала checkpoint объём WAL подскакивает в разы, коммиты ждут дольше, `wal_buffers` переполняются, реплики начинают отставать. Затем объём постепенно снижается — характерная «пила» на графике WAL.
2. **Шторм `fsync` в конце.** Если ОС накопила много грязных страниц в page cache, финальный `fsync` сбрасывает их разом и забивает очередь диска — страдают чтения и `fsync` WAL у всех коммитов. В Linux сглаживается настройкой `vm.dirty_background_bytes` и параметром `checkpoint_flush_after` (по умолчанию 256 КБ — просит ОС сбрасывать порциями).
3. **Слишком частые checkpoint-ы по объёму.** Если `max_wal_size` мал для нагрузки, checkpoint-ы идут один за другим, FPI почти постоянны, и сглаживание не работает. В логе:

```text
LOG:  checkpoints are occurring too frequently (24 seconds apart)
HINT:  Consider increasing the configuration parameter "max_wal_size".
```

4. **Бэкенды пишут сами.** Если чистых буферов не хватает, backend вынужден записать грязную страницу перед чтением новой — это прямой вклад в latency запроса.

**Как диагностировать:**

- `log_checkpoints` (включён по умолчанию с PG 15) — в логе время записи, синхронизации, число буферов, причина (`time` или `wal`);
- PG 17+: `pg_stat_checkpointer` (`num_timed`, `num_requested`, `buffers_written`, `write_time`, `sync_time`); до PG 17 те же данные в `pg_stat_bgwriter` (`checkpoints_timed`, `checkpoints_req`);
- `pg_stat_io` (PG 16+) — кто пишет: checkpointer, bgwriter или client backend;
- корреляция графиков latency с моментами checkpoint и с `wal_fpi` в `pg_stat_wal`.

**Как настраивать:**

- поднять `max_wal_size` (несколько–десятки ГБ на нагруженной системе), чтобы checkpoint-ы шли по времени, а не по объёму: `num_requested` должен быть мал относительно `num_timed`;
- увеличить `checkpoint_timeout` до 15–30 мин — меньше FPI и записи одних и тех же страниц;
- оставить `checkpoint_completion_target = 0.9`;
- `wal_compression` — уменьшает удар от FPI;
- настроить bgwriter (`bgwriter_lru_maxpages`, `bgwriter_delay`), чтобы бэкенды реже писали сами;
- быстрые диски, WAL на отдельном томе.

**Компромисс.** Редкие checkpoint-ы = больше WAL нужно проиграть после сбоя, то есть дольше восстановление (crash recovery) и больше места под `pg_wal`. Длинный `checkpoint_timeout` — это осознанный обмен времени восстановления на ровную latency.

## Как настройки synchronous_commit влияют на надёжность и производительность?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-nastroiki-synchronous-commit-vliyayut-na-nadezhnost-i-proizvoditel
tags: wal, durability
```

`synchronous_commit` определяет, **чего ждёт `COMMIT`**, прежде чем вернуть клиенту успех: записи WAL на локальный диск, подтверждения от синхронной реплики, применения изменений на реплике — или ничего. Чем больше ждём, тем выше гарантия сохранности и тем дольше коммит. Параметр можно менять на уровне сессии и даже отдельной транзакции, поэтому разные данные в одной базе могут иметь разную надёжность.

**Значения:**

| Значение | Коммит ждёт | Риск при сбое |
| --- | --- | --- |
| `off` | ничего: WAL запишется фоном | потеря последних транзакций при падении сервера |
| `local` | `fsync` WAL на мастере | при потере мастера — потеря того, что не дошло до реплик |
| `remote_write` | локальный `fsync` + реплика получила WAL и записала его в ОС (без `fsync`) | потеря при одновременном падении мастера и ОС реплики |
| `on` (по умолчанию) | локальный `fsync` + реплика сделала `fsync` WAL | нет потерь при падении одного узла |
| `remote_apply` | плюс реплика **применила** изменения | как `on`, плюс изменения сразу видны в запросах на реплике |

Важно: значения `remote_*` и `on` в смысле ожидания реплики работают, только если задан `synchronous_standby_names`. Без синхронных реплик `on`, `remote_write`, `remote_apply` ведут себя как `local`.

**`synchronous_commit = off` — что именно теряем.** Коммит возвращается сразу, WAL сбрасывает WAL writer (каждые `wal_writer_delay`, 200 мс по умолчанию). При падении сервера может пропасть окно транзакций — до примерно трёхкратного `wal_writer_delay`. Но **база не повреждается**: потерянные транзакции просто исчезают целиком, согласованность сохраняется. Это принципиальное отличие от `fsync = off`, который может привести к повреждению данных и в продакшене недопустим.

```sql
BEGIN;
SET LOCAL synchronous_commit = off;
INSERT INTO page_views (...) VALUES (...);
COMMIT;
```

Так пишут метрики, логи, кликстрим, кэши — данные, потеря которых за доли секунды допустима, а пропускная способность важна. Платёж в той же базе остаётся с `on`.

**Выигрыш.** Для маленьких транзакций время коммита определяется `fsync` WAL. На диске с fsync в 1–2 мс один поток упирается в сотни–тысячу коммитов в секунду; с `off` — ограничение уходит, TPS может вырасти в разы. На больших транзакциях эффект незаметен.

**Синхронная репликация:**

```text
synchronous_standby_names = 'ANY 1 (replica_a, replica_b)'
```

- `FIRST n (...)` — ждать n первых по приоритету; `ANY n (...)` — кворум из любых n.
- Каждый коммит добавляет сетевой round trip до реплики — в соседнем дата-центре это 1–5 мс, между регионами — десятки мс.
- **Если синхронная реплика недоступна, коммиты на мастере зависают** (не падают — ждут). Поэтому синхронных кандидатов делают минимум два при `ANY 1`, а оркестратор (Patroni) умеет переключать режим.
- Отмена ожидания (`pg_cancel_backend`) возвращает клиенту предупреждение, но транзакция **уже закоммичена локально** — клиент не должен считать её откатившейся.

**`remote_apply`** решает проблему read-your-writes при чтении с реплики: после коммита данные гарантированно видны на синхронной реплике. Цена — коммит ждёт ещё и применение, а долгие запросы на реплике, конфликтующие с применением, задерживают коммиты мастера.

**Как выбирать:**

- финансовые и критичные данные — `on` с синхронной репликой (RPO = 0);
- обычный OLTP без синхронных реплик — `on` (фактически `local`), асинхронные реплики;
- телеметрия, логи, временные данные — `off` на уровне транзакции или роли;
- нужна согласованность чтения с реплик — `remote_apply` для конкретных операций.

## Чем физическая репликация отличается от логической и когда нужна каждая?

```yaml
category: postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-chem-fizicheskaya-replikaciya-otlichaetsya-ot-logicheskoi-i-kogda-nuzh
tags: replication, architecture
```

**Физическая (streaming) репликация** передаёт на реплику поток WAL — изменения на уровне байтов страниц, — и реплика становится побайтовой копией **всего кластера**. **Логическая репликация** декодирует WAL в логические изменения строк (`INSERT`/`UPDATE`/`DELETE`) для выбранных таблиц и применяет их на подписчике как обычные SQL-операции. Первая — для отказоустойчивости и масштабирования чтения, вторая — для выборочной передачи данных, миграций и интеграций.

| | Физическая | Логическая |
| --- | --- | --- |
| Единица | весь кластер (все базы) | отдельные таблицы (publication) |
| Версии PostgreSQL | одинаковая major-версия, та же архитектура | разные major-версии допустимы |
| Реплика | read-only (hot standby) | полноценная база с записью, своими индексами и таблицами |
| DDL | реплицируется (это просто WAL) | **не реплицируется** — схему синхронизируют вручную |
| Последовательности | реплицируются | не реплицируются (в PG 15–17) — нужно выставлять при переключении |
| Large objects, `TRUNCATE` | да | `TRUNCATE` да (PG 11+), large objects нет |
| Начальная синхронизация | `pg_basebackup` | копирование таблиц при создании подписки |
| Требования к таблицам | нет | для `UPDATE`/`DELETE` нужен `REPLICA IDENTITY` (обычно PK) |
| Накладные расходы | минимальные | декодирование на источнике, применение строк через SQL |
| Failover | основной сценарий | возможен, но сложнее; синхронизация слотов на реплику — с PG 17 |

**Физическая — когда:**

- **HA и failover** — горячая реплика, готовая стать мастером (Patroni, repmgr, облачные managed-сервисы);
- **масштабирование чтения** — отчёты и read-only запросы на репликах;
- **бэкапы и PITR** — те же механизмы WAL-архива;
- **отложенная реплика** (`recovery_min_apply_delay`) — защита от ошибочного `DROP TABLE`.

```text
primary_conninfo = 'host=primary user=replicator'
primary_slot_name = 'replica_1'
```

**Логическая — когда:**

- **Миграция между major-версиями с минимальным простоем** — поднять новую версию, подписаться, дождаться синхронизации, переключить приложение;
- **частичная репликация** — только нужные таблицы, в том числе с фильтром строк (`WHERE`, PG 15+) и списком колонок (PG 15+);
- **консолидация** — несколько баз в одну аналитическую;
- **CDC** — поток изменений во внешние системы (Debezium → Kafka) через логическое декодирование и `pgoutput`;
- **разные индексы и дополнительные таблицы на приёмнике.**

```sql
CREATE PUBLICATION orders_pub FOR TABLE orders, order_items;
CREATE SUBSCRIPTION orders_sub
  CONNECTION 'host=src dbname=app user=repl'
  PUBLICATION orders_pub;
```

**Подводные камни:**

- **Слоты репликации** обоих типов удерживают WAL до подтверждения: отключившаяся реплика или упавший Debezium могут заполнить диск мастера. С PG 13 есть ограничитель `max_slot_wal_keep_size`.
- **Логическая: конфликты на подписчике** — если строку на приёмнике изменили или нарушено ограничение, применение останавливается, и слот на источнике копит WAL. С PG 15 можно задать `disable_on_error` и пропускать транзакцию через `ALTER SUBSCRIPTION ... SKIP`.
- **Логическая: таблицы без PK** — `UPDATE`/`DELETE` с `REPLICA IDENTITY FULL` применяются на подписчике медленно (с PG 16 могут использовать индекс).
- **Физическая: конфликты с запросами на реплике** — применение WAL отменяет долгие запросы (`max_standby_streaming_delay`, 30 с по умолчанию); `hot_standby_feedback = on` предотвращает отмены, но переносит bloat на мастер.
- **Логическая не годится как единственный механизм HA**: DDL и последовательности требуют отдельной синхронизации, а при failover источника слоты надо переносить (в PG 17 — `failover = true` у слотов и `sync_replication_slots` на реплике).

## Что такое replication lag, как его измерять и какие последствия у чтения с реплики?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-chto-takoe-replication-lag-kak-ego-izmeryat-i-kakie-posledstviya-u-cht
tags: replication, consistency
```

Replication lag — отставание реплики от мастера: сколько WAL (в байтах) или сколько времени отделяет состояние реплики от текущего состояния мастера. При асинхронной репликации лаг есть всегда — обычно миллисекунды, но под нагрузкой он может вырасти до минут. Главное последствие для приложения: **чтение с реплики может вернуть устаревшие данные**, в том числе не увидеть только что записанное этим же пользователем.

**Этапы, на которых возникает задержка:**

1. мастер сгенерировал WAL → отправил (`sent_lsn`);
2. реплика получила и записала в ОС (`write_lsn`);
3. сбросила на диск (`flush_lsn`);
4. **применила** (`replay_lsn`) — только теперь изменения видны запросам на реплике.

**Как измерять на мастере:**

```sql
SELECT application_name, client_addr, state, sync_state,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS replay_lag_bytes,
       write_lag, flush_lag, replay_lag
FROM pg_stat_replication;
```

`write_lag`/`flush_lag`/`replay_lag` — время между локальным сбросом WAL на мастере и подтверждением соответствующего этапа от реплики.

**На реплике:**

```sql
SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn(),
       now() - pg_last_xact_replay_timestamp() AS replay_delay;
```

Подвох: `now() - pg_last_xact_replay_timestamp()` растёт, когда на мастере просто нет записи, — лаг «появляется» на простаивающей системе. Для алертов надёжнее байтовый лаг или heartbeat-таблица, в которую мастер пишет время раз в секунду.

Лаг слотов (в том числе отключённых реплик и CDC-потребителей) — `pg_replication_slots` и `pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)`.

**Почему лаг растёт:**

- **конфликты восстановления** — долгий запрос на реплике читает версии строк, которые WAL хочет удалить (после VACUUM на мастере). Применение WAL ждёт до `max_standby_streaming_delay` (30 с по умолчанию), затем запрос отменяется: `canceling statement due to conflict with recovery`;
- **однопоточное применение WAL** — мастер пишет параллельно десятками процессов, реплика применяет в один поток; массовые операции (`UPDATE` всей таблицы, `CREATE INDEX`, `VACUUM FULL`) создают всплеск;
- медленный диск или CPU реплики, сеть между дата-центрами;
- блокировки: `ACCESS EXCLUSIVE` с мастера (DDL, усечение таблицы vacuum-ом) применяется на реплике и ждёт запросы к этой таблице.

**Компромиссы настройки конфликтов:**

| Настройка | Эффект |
| --- | --- |
| `max_standby_streaming_delay` больше | меньше отмен запросов, но лаг растёт |
| `hot_standby_feedback = on` | реплика сообщает свой `xmin`, мастер не удаляет нужные ей версии — отмен меньше, но **bloat на мастере** |
| отдельная реплика для аналитики с большой задержкой | изоляция OLTP-реплик от долгих отчётов |

**Последствия для приложения и паттерны:**

- **Read-your-writes.** Пользователь сохранил профиль, следующий запрос ушёл на реплику — изменений нет. Решения: читать с мастера в течение N секунд после записи этого пользователя; запоминать LSN коммита (`pg_current_wal_lsn()`) и читать с реплики, только если её `pg_last_wal_replay_lsn()` его догнал; `synchronous_commit = remote_apply` для критичных операций.
- **Нарушение порядка.** Два запроса подряд на разные реплики с разным лагом — данные «откатываются назад» во времени. Решение — привязка сессии к одной реплике.
- **Проверки инвариантов** («есть ли уже такой заказ») только на мастере, иначе дубли.
- **Фоновые задачи**, читающие с реплики и пишущие на мастер, должны учитывать, что видят прошлое.

В Npgsql маршрутизация на реплики делается несколькими хостами и `Target Session Attributes=prefer-standby` (или `NpgsqlMultiHostDataSource.WithTargetSession`), но решение «можно ли этот запрос читать с реплики» остаётся за приложением.

## Как выполнить переключение на реплику без потери данных и какой ценой?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-vypolnit-pereklyuchenie-na-repliku-bez-poteri-dannyh-i-kakoi-cenoi
tags: replication, resilience
```

Нужно различать **плановое переключение** (switchover) и **аварийное** (failover). Switchover без потери данных возможен всегда: остановить запись на мастере, дождаться, пока реплика применит весь WAL, и только тогда её повысить. Failover без потерь возможен, **только если коммит не подтверждался клиенту раньше, чем WAL оказался на реплике**, — то есть при синхронной репликации. Её цена — латентность каждой записи и риск остановки записи при проблемах с репликой.

**Плановый switchover:**

1. Убедиться, что реплика в синхроне: `pg_stat_replication` на мастере, лаг около нуля.
2. Остановить запись: перевести приложение в read-only или отключить пулы (PgBouncer `PAUSE`).
3. Корректно остановить мастер (`pg_ctl stop -m fast`). При чистой остановке walsender-ы перед выходом отправляют подключённым репликам весь WAL, включая shutdown checkpoint.
4. На реплике проверить, что она получила и применила последнюю запись: сравнить `Latest checkpoint location` из `pg_controldata` старого мастера с `pg_last_wal_replay_lsn()` реплики.
5. Повысить реплику: `SELECT pg_promote();` (PG 12+) или `pg_ctl promote`. Она переходит на новый timeline и начинает принимать запись.
6. Переключить приложение (DNS, VIP, HAProxy, конфиг PgBouncer, строка подключения с несколькими хостами и `Target Session Attributes=read-write`).
7. Старый мастер подключить как реплику нового (`standby.signal` + `primary_conninfo`). Если он успел записать что-то, чего нет на новом мастере, — `pg_rewind`.

На практике это делает оркестратор: `patronictl switchover` выполняет все шаги и проверки, простой записи — секунды.

**Аварийный failover и потеря данных.** При асинхронной репликации мастер подтверждает коммит после локального `fsync`, а WAL уходит на реплику позже. Если мастер умер, транзакции, которые клиенты считают закоммиченными, но не дошедшие до реплики, **потеряны**. Объём потери (RPO) — текущий лаг.

**RPO = 0 — синхронная репликация:**

```text
synchronous_standby_names = 'ANY 1 (replica_a, replica_b)'
synchronous_commit = on
```

Коммит ждёт подтверждения `fsync` WAL хотя бы одной реплики. При failover выбирают реплику, которая была синхронной (Patroni делает это сам при `synchronous_mode`).

**Цена синхронности:**

- **латентность записи** = локальный `fsync` + сетевой round trip + `fsync` на реплике. В одной зоне — +1–2 мс, между регионами — десятки мс на каждый коммит;
- **доступность записи**: если синхронных реплик меньше требуемого, коммиты висят. Поэтому `ANY 1` из двух-трёх реплик, а не одна;
- **пропускная способность** маленьких транзакций падает — батчинг становится важнее.

**Другие риски переключения:**

- **Split-brain** — старый мастер «ожил» и принимает запись параллельно с новым. Защита: консенсус (etcd/Consul в Patroni), fencing старого узла, watchdog, лидер-лок с TTL. Скрипт «если мастер не пингуется — promote» без этого опасен.
- **Ложные срабатывания** — короткий сетевой сбой вызывает лишний failover; таймауты подбирают так, чтобы переключение было реже, чем реальные аварии.
- **Логические слоты** до PG 17 не переносились на реплику — CDC-потребители (Debezium) после failover теряли позицию. В PG 17 — слоты с `failover = true` и `sync_replication_slots`.
- **Прогрев кэша** — новый мастер мог обслуживать другие запросы, первые минуты медленнее (`pg_prewarm`).
- **Приложение** должно переподключаться и повторять транзакции: в момент переключения соединения рвутся, часть операций получит ошибки. Идемпотентность операций и ретраи — обязательная часть плана.

**Итог для собеседования:** «без потери данных» = синхронная репликация с кворумом + автоматический оркестратор с защитой от split-brain + клиенты с ретраями. Платим латентностью записи и сложностью эксплуатации.

## Как выбрать ключ партиционирования и что произойдёт при неудачном выборе?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-vybrat-klyuch-particionirovaniya-i-chto-proizoidet-pri-neudachnom
tags: partitioning, architecture
```

Ключ партиционирования выбирают по двум вопросам: **по какому полю фильтруют почти все критичные запросы** и **по какому полю данные живут и удаляются**. Идеальный ключ отвечает на оба вопроса — чаще всего это время для событийных данных или тенант для мультитенантных. При неудачном ключе партиционирование не даёт pruning, усложняет каждый запрос и не помогает обслуживанию, а исправить его можно только полной перезаписью таблицы.

**Критерии хорошего ключа:**

1. **Есть в `WHERE` горячих запросов** — иначе pruning не работает и каждый запрос проходит по всем секциям.
2. **Совпадает с жизненным циклом** — retention по времени даёт `DROP PARTITION` вместо `DELETE`.
3. **Неизменяем** — `UPDATE` ключа переносит строку между секциями (`DELETE` + `INSERT`), это дорого и ломает часть сценариев (`ON CONFLICT`, триггеры).
4. **Даёт сбалансированные секции** — без одной гигантской и сотни пустых.
5. **Подходит для уникальности** — PK и уникальные ограничения обязаны включать ключ; если бизнесу нужна глобальная уникальность по другому полю, это будет сложно.

**Типовые решения:**

| Данные | Ключ | Комментарий |
| --- | --- | --- |
| События, логи, метрики, история | `RANGE (created_at)` | секция = день/неделя/месяц, retention через `DROP` |
| SaaS с крупными тенантами | `LIST (tenant_id)` или `HASH (tenant_id)` | запросы всегда с `tenant_id`; можно отделить крупных клиентов |
| Заказы: OLTP по клиенту + архив по времени | `RANGE (created_at)`, внутри при необходимости `HASH (customer_id)` | главное — чтобы запросы содержали `created_at` |

**Что происходит при неудачном выборе:**

- **Нет pruning.** Таблица партиционирована по `created_at`, а основной запрос — `WHERE user_id = ?`. Каждый запрос идёт в индекс каждой секции: при 100 секциях — 100 спусков по индексам вместо одного. Запросы становятся **медленнее**, чем до партиционирования.
- **Рост времени планирования и блокировок.** Без pruning на этапе планирования планировщик рассматривает все секции и берёт блокировку `AccessShareLock` на каждую секцию и её индексы. При тысячах секций — миллисекунды планирования на простой запрос, исчерпание fast-path блокировок, конкуренция за lock manager под нагрузкой.
- **Перекос (skew).** `LIST (country)`, где 80% строк — одна страна: одна секция огромна, и все проблемы большой таблицы остались. `HASH (tenant_id)` при одном гигантском тенанте — то же самое.
- **Горячая секция.** При `RANGE` по времени вся запись идёт в одну последнюю секцию — это нормально и даже хорошо для кэша; но при `HASH` по ключу с горячими значениями нагрузка концентрируется на одной секции без пользы.
- **Слишком мелкие секции** — дневные секции при объёме 10 МБ в день дают тысячи таблиц без выигрыша.
- **Pruning только во время выполнения.** Если ключ приходит параметром generic-плана или из подзапроса, секции отсекаются на этапе выполнения (`Subplans Removed: N` в плане). Это работает, но план всё равно строится по всем секциям, и время планирования не экономится.

```text
Append
  Subplans Removed: 46
  ->  Index Scan using events_2025_06_user_id_idx on events_2025_06
```

**Как проверить выбор до миграции:**

- выписать из `pg_stat_statements` топ запросов по `total_exec_time` и проверить, содержит ли каждый условие по кандидату в ключ, причём в форме, пригодной для pruning (прямое сравнение колонки, без функций над ней);
- оценить распределение данных по будущим секциям (`GROUP BY date_trunc('month', created_at)` или `tenant_id`);
- прогнать нагрузку на копии с партиционированной схемой.

**Исправить ключ** можно только созданием новой партиционированной таблицы и переливкой данных — та же процедура, что и первоначальная миграция. Поэтому ключ выбирают по реальным запросам, а не «по created_at, потому что так принято».

## Как перевести большую работающую таблицу на партиционирование без простоя?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-perevesti-bolshuyu-rabotayuschuyu-tablicu-na-particionirovanie-bez
tags: partitioning, migration
```

Превратить существующую таблицу в партиционированную командой `ALTER TABLE` нельзя — нужна новая партиционированная таблица. Без простоя это делают одним из двух способов: **подключить старую таблицу целиком как одну секцию** новой (быстро, без копирования данных) или **переливать данные в фоне** с двойной записью и затем переключиться. В обоих случаях единственный момент эксклюзивной блокировки — короткая транзакция переименования.

### Способ 1. Старая таблица становится секцией

Подходит для партиционирования по времени: исторические данные остаются в одной большой «legacy»-секции и со временем удаляются целиком, новые данные идут в нормальные секции.

1. Подготовить ограничения на старой таблице, не блокируя запись:

```sql
CREATE UNIQUE INDEX CONCURRENTLY orders_id_created_uq ON orders (id, created_at);

ALTER TABLE orders ADD CONSTRAINT orders_legacy_range
  CHECK (created_at IS NOT NULL AND created_at < '2025-07-01') NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT orders_legacy_range;
ALTER TABLE orders ALTER COLUMN created_at SET NOT NULL;
```

`VALIDATE` сканирует таблицу, но под `SHARE UPDATE EXCLUSIVE` — запись не блокируется. Уникальный индекс нужен, потому что PK партиционированной таблицы должен включать ключ. `SET NOT NULL` при валидном `CHECK`, из которого следует `created_at IS NOT NULL`, выполняется без сканирования таблицы (PG 12+).

Нюанс: `LIKE ... INCLUDING CONSTRAINTS` здесь использовать нельзя — на новую таблицу скопировался бы `CHECK` с границей legacy-секции. Ещё нюанс: пока ограничение действует, вставка строки с `created_at` после границы упадёт. Границу выбирают чуть в будущем и выполняют переключение до её наступления.

2. Переключение в одной короткой транзакции:

```sql
SET lock_timeout = '3s';
BEGIN;
ALTER TABLE orders RENAME TO orders_legacy;
CREATE TABLE orders (LIKE orders_legacy INCLUDING DEFAULTS)
  PARTITION BY RANGE (created_at);
ALTER TABLE orders ADD PRIMARY KEY (id, created_at);
ALTER TABLE orders ATTACH PARTITION orders_legacy
  FOR VALUES FROM (MINVALUE) TO ('2025-07-01');
CREATE TABLE orders_2025_07 PARTITION OF orders
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
COMMIT;
```

Благодаря валидному `CHECK`, который доказывает границу секции, `ATTACH PARTITION` не сканирует таблицу. Создание PK на родителе использует уже существующий уникальный индекс секции (индекс подключается, а не строится заново). Нагрузку держат только операции с метаданными — миллисекунды, а `lock_timeout` не даёт повесить очередь запросов, если транзакцию не удаётся взять быстро.

3. Позже старые данные можно разнести из legacy-секции по нормальным секциям батчами или просто дождаться, пока они уйдут по retention.

### Способ 2. Фоновая переливка с двойной записью

Подходит, если нужен другой ключ (не время), другая структура или если legacy-секция неприемлема.

1. Создать новую партиционированную таблицу `orders_new` со всеми секциями и индексами.
2. Включить синхронизацию новых изменений: триггер на `orders`, дублирующий `INSERT/UPDATE/DELETE` в `orders_new`. Логическая репликация внутри одной базы неудобна: имена таблиц у публикации и подписки должны совпадать, поэтому её используют, только если переносят таблицу заодно в другую базу.
3. Бэкфилл старых данных батчами по `id` с `INSERT ... ON CONFLICT DO NOTHING`, контролируя лаг реплик и нагрузку.
4. Сверка: количество строк и контрольные суммы по диапазонам.
5. Короткая транзакция: снять триггер, переименовать `orders` → `orders_old`, `orders_new` → `orders`.
6. Держать `orders_old` до уверенности в результате, затем удалить.

### Что ломается чаще всего

- **Внешние ключи, ссылающиеся на таблицу**, — их нужно пересоздать на новую (составной ключ, если PK стал составным), через `NOT VALID` + `VALIDATE`.
- **Последовательности и identity** — новая таблица должна продолжить ту же последовательность (`ALTER SEQUENCE ... OWNED BY`, либо `DEFAULT nextval` старой).
- **Зависимые объекты** — view, функции, права, publication для CDC: переименование таблицы переносит их на старую.
- **ORM и запросы по `id` без ключа** — работают, но идут по всем секциям; стоит заранее добавить ключ в горячие запросы.
- **Будущие секции** — автоматизировать создание (`pg_partman`, `pg_cron`) до переключения.

Каждый шаг репетируется на копии продакшена с реальным объёмом и нагрузкой.

## Как планировщик оценивает стоимость плана и почему ошибается на коррелированных условиях?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-planirovschik-ocenivaet-stoimost-plana-i-pochemu-oshibaetsya-na-ko
tags: query-planning, statistics
```

Планировщик перебирает варианты плана (способы доступа, порядок и методы соединений) и для каждого считает **стоимость** — взвешенную сумму ожидаемых чтений страниц и CPU-операций. Входные данные для стоимости — оценки числа строк на каждом узле, а они строятся из статистики **по каждой колонке отдельно** с допущением, что колонки независимы. Когда условия коррелированы, оценки умножают селективности и ошибаются на порядки, а неверная оценка строк ведёт к неверному выбору соединения.

**Из чего складывается стоимость:**

| Параметр | По умолчанию | Смысл |
| --- | --- | --- |
| `seq_page_cost` | 1.0 | последовательное чтение страницы |
| `random_page_cost` | 4.0 | случайное чтение страницы |
| `cpu_tuple_cost` | 0.01 | обработка строки |
| `cpu_index_tuple_cost` | 0.005 | обработка записи индекса |
| `cpu_operator_cost` | 0.0025 | вычисление оператора или функции |
| `effective_cache_size` | 4 ГБ | ожидаемый объём кэша (влияет на оценку повторных чтений индекса) |

Seq Scan ≈ `relpages × seq_page_cost + reltuples × (cpu_tuple_cost + cpu_operator_cost × число условий)`. Index Scan учитывает высоту дерева, число записей индекса, случайные чтения heap и `correlation` колонки. Соединения: Nested Loop — произведение, Hash Join — построение хеша плюс проход, Merge Join — сортировки плюс слияние.

**Оценка строк.** `rows = reltuples × селективность`. Селективность условия берётся из `pg_stats`: MCV, гистограммы, `n_distinct`, `null_frac`. Для нескольких условий по умолчанию:

- `A AND B` → `sel(A) × sel(B)`;
- `A OR B` → `sel(A) + sel(B) − sel(A) × sel(B)`;
- `GROUP BY a, b` → число групп ≈ `n_distinct(a) × n_distinct(b)` (с ограничением сверху числом строк).

**Пример ошибки на корреляции:**

```sql
SELECT * FROM addresses WHERE city = 'Казань' AND region = 'Татарстан';
```

Пусть 2% строк — Казань, 3% — Татарстан. Планировщик ожидает `0.02 × 0.03 = 0.06%` строк. Реально Казань всегда в Татарстане — это 2%, ошибка в 33 раза.

```text
Index Scan ... (cost=... rows=60 ...) (actual ... rows=2000 ...)
```

Ошибка внизу дерева каскадирует: ожидая 60 строк, планировщик выберет Nested Loop с Index Scan по большой таблице на внутренней стороне — для 2000 строк это 2000 спусков по индексу вместо одного Hash Join. В многотабличных запросах ошибки перемножаются на каждом уровне.

**Другие источники неверных оценок:**

- **Функции и выражения** без статистики — используются захардкоженные дефолтные селективности (порядка 0.5% для равенства, 33% для неравенства);
- **Условия между колонками** (`a > b`) и **между таблицами** — статистики по корреляции колонок разных таблиц нет совсем;
- **Параметры generic-плана** — значение неизвестно, используется средняя селективность, которая для перекошенных данных неверна;
- **Устаревшая статистика** и большие таблицы, где фиксированная выборка `ANALYZE` не замечает редких значений;
- **`LIMIT` с фильтром** — планировщик предполагает, что подходящие строки распределены равномерно.

**Как исправлять:**

```sql
CREATE STATISTICS addr_city_region (dependencies, mcv) ON city, region FROM addresses;
ANALYZE addresses;
```

- расширенная статистика (`dependencies`, `ndistinct`, `mcv`) для коррелированных колонок одной таблицы;
- `ALTER COLUMN ... SET STATISTICS` для перекошенных распределений;
- индекс по выражению — даёт статистику по самому выражению;
- переписать запрос: убрать избыточное условие, которое ничего не фильтрует, но портит оценку;
- для межтабличных корреляций — денормализация или материализация промежуточного результата во временную таблицу с `ANALYZE`.

**Что спрашивают дальше:** как увидеть ошибку оценки (`rows` против `actual rows` в `EXPLAIN ANALYZE`, ищут самый нижний узел с расхождением), почему `join_collapse_limit` (8) и GEQO (с 12 таблиц) влияют на качество планов больших запросов.

## Что делать, если PostgreSQL внезапно перешёл с Index Scan на Seq Scan?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-chto-delat-esli-postgresql-vnezapno-pereshel-s-index-scan-na-seq-scan
tags: query-planning, indexes
```

Сначала понять, **что изменилось**: план меняется не сам по себе, а из-за новой статистики, роста данных, перехода на generic-план, изменения параметров, индекса или текста запроса. Дальше — подтвердить причину сравнением планов и исправить её, а не форсировать индекс глобальными настройками.

**1. Зафиксировать симптом и план.**

- `pg_stat_statements`: какой `queryid` вырос по `mean_exec_time`, с какого момента (по мониторингу);
- реальный план с теми же параметрами: `EXPLAIN (ANALYZE, BUFFERS)`, а для продакшена — `auto_explain` с `log_min_duration`, чтобы получить план именно проблемных выполнений;
- для prepared statements — `EXPLAIN (GENERIC_PLAN)` (PG 16+), чтобы увидеть generic-план.

**2. Перебрать типовые причины:**

| Причина | Как проверить |
| --- | --- |
| Прошёл autoanalyze, статистика сильно изменилась | `last_autoanalyze` в `pg_stat_user_tables`, `pg_stats` по колонке |
| Данные выросли или распределение сместилось (значение стало частым) | `most_common_vals/freqs`, сравнение `rows` и `actual rows` |
| Prepared statement перешёл на generic-план | первые 5 выполнений — custom-планы, затем generic, если его стоимость не хуже; проверить с `SET plan_cache_mode = force_custom_plan` |
| Индекс стал `INVALID` (упал `CREATE INDEX CONCURRENTLY`/`REINDEX`) или был удалён миграцией | `\d table`, `pg_index.indisvalid` |
| Поменялся тип параметра из приложения (`text` против `varchar`, `numeric` против `bigint`) | лог запросов с параметрами, `EXPLAIN` с явным приведением |
| Изменились настройки (`random_page_cost`, `work_mem`, `effective_cache_size`) или версия PostgreSQL | `EXPLAIN (SETTINGS)`, история конфигурации |
| Раздулась таблица или индекс | размеры, `pgstattuple`, `relpages` |
| Таблица маленькая на стейджинге, большая в проде (или наоборот) | `reltuples` |

**3. Проверить, прав ли планировщик.**

```sql
BEGIN;
SET LOCAL enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
ROLLBACK;
```

Если с индексом действительно быстрее — оценки неверны. Если медленнее — запрос теперь выбирает большую долю таблицы, и нужен другой индекс или другой запрос.

**4. Исправить причину:**

- **Статистика:** `ANALYZE table`; для колонки с перекосом — `ALTER TABLE ... ALTER COLUMN ... SET STATISTICS 500..1000`; для коррелированных условий — `CREATE STATISTICS`; для больших таблиц — более частый autoanalyze через `autovacuum_analyze_scale_factor` на уровне таблицы.
- **Generic-план:** для конкретной роли или сессии `plan_cache_mode = force_custom_plan`; либо перестать передавать значение, определяющее план, параметром (например, литералом статус в частичном индексе).
- **Параметры стоимости:** на SSD с данными в памяти — `random_page_cost` около 1.1–1.5, адекватный `effective_cache_size`.
- **Индекс:** пересоздать `INVALID` через `REINDEX INDEX CONCURRENTLY`; добавить колонку или сделать частичный/покрывающий индекс, если выборка выросла.
- **Тип параметра:** привести в приложении тип к типу колонки (в Npgsql — `NpgsqlDbType`, в EF Core — корректный маппинг свойства).
- **Запрос:** переписать условие так, чтобы индекс был очевидно выгоден (диапазон вместо функции, `UNION ALL` вместо `OR`).

**5. Временная мера, пока исправление готовится:**

- `SET enable_seqscan = off` **только** локально для проблемной транзакции/роли — не глобально;
- расширение `pg_hint_plan` для фиксации плана конкретного запроса — как крайняя мера, с задачей убрать хинт.

**6. Предотвращение.** В PostgreSQL нет встроенного механизма фиксации планов (как SQL Plan Baselines в Oracle), поэтому стабильность обеспечивают процессом: мониторинг `mean_exec_time` по `queryid` с алертом на скачок, `auto_explain` на продакшене, регресс-тесты планов для критичных запросов на продакшен-подобном объёме данных, аккуратная работа со статистикой после массовых загрузок.

## Как расширенная статистика помогает планировщику и когда её стоит создавать?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-rasshirennaya-statistika-pomogaet-planirovschiku-i-kogda-ee-stoit
tags: statistics, query-planning
```

Обычная статистика собирается по каждой колонке отдельно, и планировщик считает колонки независимыми. Расширенная статистика (`CREATE STATISTICS`, PG 10+) описывает **связи между колонками одной таблицы**: функциональные зависимости, число различных комбинаций и частые комбинации значений. С ней оценки строк для условий по нескольким колонкам и для `GROUP BY` перестают ошибаться на порядки.

**Виды:**

| Вид | Что хранит | Чему помогает |
| --- | --- | --- |
| `dependencies` (PG 10) | степень функциональной зависимости: «`zip` определяет `city`» | условиям равенства по зависимым колонкам |
| `ndistinct` (PG 10) | число различных комбинаций значений | `GROUP BY a, b`, `DISTINCT`, оценке групп для Hash Aggregate |
| `mcv` (PG 12) | список самых частых **комбинаций** и их доли | любым условиям, включая неравенства и смешанные `AND/OR` по колонкам |
| выражения (PG 14) | статистика по выражениям, как у колонки | условиям по `lower(email)`, `date_trunc(...)` без создания индекса |

```sql
CREATE STATISTICS addr_stats (dependencies, ndistinct, mcv)
  ON city, region, zip FROM addresses;
ANALYZE addresses;

SELECT statistics_name, attnames, dependencies, n_distinct
FROM pg_stats_ext WHERE tablename = 'addresses';
```

Статистика появляется только после `ANALYZE` (вручную или autoanalyze). Без указания видов создаются все поддерживаемые.

**Пример эффекта:**

```sql
EXPLAIN ANALYZE
SELECT * FROM addresses WHERE city = 'Казань' AND region = 'Татарстан';
```

До: `rows=60 ... actual rows=2000` — независимость дала произведение селективностей.
После: `rows=1980 ... actual rows=2000` — планировщик знает, что `city` определяет `region`.

Для `GROUP BY city, region` без `ndistinct` планировщик ожидает `n_distinct(city) × n_distinct(region)` групп — может выбрать сортировку вместо Hash Aggregate или зарезервировать неверный объём памяти.

**Когда создавать:**

- в `EXPLAIN ANALYZE` оценка `rows` на скане с несколькими условиями по одной таблице расходится с фактом в разы и больше — и это приводит к плохому выбору соединения или метода доступа;
- в данных есть иерархия или избыточность: страна → регион → город → индекс, товар → категория, `tenant_id` + `user_id` (пользователь принадлежит одному тенанту), `status` + `closed_at IS NOT NULL`;
- `GROUP BY` по нескольким колонкам даёт сильно неверную оценку числа групп;
- фильтрация по выражению, для которого не хочется заводить индекс (PG 14+).

**Когда не поможет:**

- корреляция между колонками **разных таблиц** (условие на `orders.status` и `customers.segment`) — межтабличной статистики в PostgreSQL нет;
- условия вида `a < b` между колонками;
- ошибка вызвана устаревшей статистикой, параметрами generic-плана или функциями без статистики — это другие проблемы.

**Практика и ограничения:**

- не больше 8 колонок/выражений в одном объекте; лучше несколько узких объектов под конкретные запросы, чем один на всё;
- `dependencies` и `mcv` работают на уровне одной таблицы и применяются к условиям в `WHERE` её скана;
- стоимость — чуть более долгий `ANALYZE` и планирование; места занимает мало;
- размер MCV-списка управляется `ALTER STATISTICS addr_stats SET STATISTICS 1000`;
- объекты статистики переносятся `pg_dump`, но после восстановления или `pg_upgrade` их нужно заново наполнить `ANALYZE`.

**На собеседовании** хороший ответ связывает три вещи: допущение независимости → ошибка кардинальности → неверный join/scan, и показывает, как подтвердить проблему (`rows` против `actual rows`) до создания статистики.

## Как безопасно создать индекс на большой таблице в продакшене?

```yaml
category: postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-kak-bezopasno-sozdat-indeks-na-bolshoi-tablice-v-prodakshene
tags: indexes, maintenance
```

Использовать `CREATE INDEX CONCURRENTLY`: он строит индекс, не блокируя `INSERT/UPDATE/DELETE`. Обычный `CREATE INDEX` берёт `SHARE`-блокировку и на всё время построения (минуты–часы на большой таблице) останавливает запись. Но у `CONCURRENTLY` свои правила, и «безопасно» — это ещё и про таймауты, ресурсы, реплики и обработку сбоев.

```sql
SET lock_timeout = '5s';
SET statement_timeout = 0;
SET maintenance_work_mem = '2GB';
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_customer_created_idx
    ON orders (customer_id, created_at);
```

**Как работает `CONCURRENTLY`:**

1. Создаёт запись об индексе в каталоге как невалидный и ждёт завершения всех транзакций, которые могли бы изменять таблицу, не зная об индексе.
2. Первый проход: строит индекс по снимку данных; параллельные изменения начинают поддерживать индекс.
3. Ждёт завершения транзакций, затем второй проход — добавляет строки, изменённые во время первого.
4. Снова ждёт старые снимки и помечает индекс валидным.

Берётся `SHARE UPDATE EXCLUSIVE` — совместим с DML, но не с другим `CREATE INDEX CONCURRENTLY`, `VACUUM` и DDL на этой таблице.

**Подводные камни:**

- **Долгие транзакции.** Каждая фаза ожидания ждёт **все** транзакции этой базы со старыми снимками — в том числе работающие с другими таблицами. Висящая `idle in transaction` сессия или многочасовой отчёт блокируют завершение. Индекс при этом строится, запись не стоит, но команда «висит». Проверять `pg_stat_activity` перед запуском.
- **Нельзя внутри транзакции.** Миграционные инструменты обычно оборачивают миграцию в транзакцию. В EF Core: `migrationBuilder.Sql("CREATE INDEX CONCURRENTLY ...", suppressTransaction: true)`, отдельной миграцией.
- **Сбой оставляет `INVALID`-индекс.** Отмена, таймаут или нарушение уникальности — и в таблице остаётся невалидный индекс, который **не используется для чтения, но обновляется при каждой записи**. После сбоя: `DROP INDEX CONCURRENTLY ...` и повторить.

```sql
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
```

- **Уникальные индексы** при дубликатах падают в конце, после часов работы. Проверить дубликаты заранее.
- **Дольше обычного** — два прохода по таблице и ожидания; больше нагрузка на CPU и I/O.
- **WAL и реплики.** Построение генерирует WAL объёмом примерно с размер индекса; реплики могут отстать. Следить за лагом, запускать в часы низкой нагрузки.
- **Партиционированные таблицы** (PG 15–17): `CREATE INDEX CONCURRENTLY` на родителе не поддерживается. Порядок: `CREATE INDEX ... ON ONLY parent` (создаётся невалидным, без построения), затем `CREATE INDEX CONCURRENTLY` на каждой секции, затем `ALTER INDEX parent_idx ATTACH PARTITION partition_idx` — когда подключены все, родительский индекс становится валидным.

**Ресурсы:**

- `maintenance_work_mem` — память для сортировки; больше — быстрее (задаётся на сессию);
- `max_parallel_maintenance_workers` (по умолчанию 2) — параллельное построение B-tree;
- место на диске — размер индекса плюс временные файлы сортировки.

**Мониторинг прогресса:**

```sql
SELECT pid, phase, blocks_done, blocks_total, tuples_done, tuples_total
FROM pg_stat_progress_create_index;
```

**Чек-лист перед запуском:**

1. Индекс действительно нужен (`EXPLAIN` на копии, нет ли уже подходящего).
2. Нет долгих транзакций; есть место на диске.
3. `lock_timeout`, чтобы не встать в очередь за DDL; `statement_timeout = 0` для этой сессии, чтобы не прервать на середине.
4. Отдельная миграция без транзакции, `IF NOT EXISTS`.
5. После — проверить `indisvalid`, `ANALYZE` (для индексов по выражению), что запросы используют индекс; удалить ставшие лишними индексы через `DROP INDEX CONCURRENTLY`.

Перестроить распухший индекс без блокировок — `REINDEX INDEX CONCURRENTLY` (PG 12+), с теми же оговорками.

## Почему индекс может не использоваться, хотя он подходит под условие запроса?

```yaml
category: postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-pochemu-indeks-mozhet-ne-ispolzovatsya-hotya-on-podhodit-pod-uslovie-z
tags: indexes, query-planning
```

Чаще всего индекс «подходит» только на взгляд человека: для планировщика выражение в запросе не совпадает с индексом из-за типа, collation, opclass или параметра. Остальные случаи — индекс применим, но по оценкам планировщика другой план дешевле, и оценки могут быть как верными, так и ошибочными.

**1. Неявное приведение типа колонки.**

```sql
CREATE INDEX ON payments (account_id);
SELECT * FROM payments WHERE account_id = 42.0;
```

Если `account_id bigint`, а параметр пришёл как `numeric`, PostgreSQL приводит **колонку** к `numeric` — индекс по `bigint` не применим. Типичный источник — драйвер или ORM, передающий `decimal` или строку. Сравнение `int` с `bigint` безопасно: для целых есть межтиповые операторы в одном семействе opclass.

**2. Collation и opclass.**

```sql
CREATE INDEX ON users (name);
SELECT * FROM users WHERE name LIKE 'Ив%';
```

При collation базы `ru_RU.UTF-8` обычный B-tree не используется для `LIKE` по префиксу: порядок сортировки локали не совпадает с побайтовым. Нужен `CREATE INDEX ON users (name text_pattern_ops)` или collation `"C"`. Аналогично, запрос с `COLLATE "C"` не использует индекс, построенный с другой collation.

**3. Выражение не совпадает с выражением индекса.** Индекс по `lower(email)`, запрос `lower(trim(email))`; индекс по `(payload->>'id')`, запрос `(payload->>'id')::bigint`; GIN по `jsonb`, запрос `payload->>'type' = 'x'` (GIN не поддерживает `->>`).

**4. Частичный индекс и параметры.** Индекс `WHERE status = 'pending'`, запрос `WHERE status = $1`. В generic-плане значение неизвестно, планировщик не может доказать предикат, и индекс не используется. С custom-планом тот же запрос использует индекс — отсюда «индекс работает в psql, но не из приложения».

**5. Generic-план prepared statement.** После пяти выполнений PostgreSQL может перейти на generic-план, если его оценочная стоимость не хуже средней custom. Для перекошенных данных generic-план усреднён и может предпочесть Seq Scan. Проверить: `SET plan_cache_mode = force_custom_plan` или `EXPLAIN (GENERIC_PLAN)` (PG 16+).

**6. `OR`, `NOT`, `<>` и функции.** `WHERE a = 1 OR b = 2` требует индексов на обе колонки (`BitmapOr`); `col <> x`, `NOT IN` и `IS DISTINCT FROM` B-tree не обслуживает; сравнение с `VOLATILE`-функцией (`col > random()`) не может быть ключом индекса — её нужно вычислять на каждую строку, а `STABLE` (`now()`) — может.

**7. Индекс невалиден.** Упавший `CREATE INDEX CONCURRENTLY` оставил `INVALID`-индекс: он виден в `\d`, но не используется.

**8. Оценки стоимости.** Индекс применим, но:

- низкая селективность — выбирается большая доля таблицы;
- плохая корреляция физического порядка — Index Scan превращается в случайные чтения;
- `random_page_cost = 4` на SSD завышает стоимость индекса;
- устаревшая статистика или корреляция условий занижает/завышает `rows`;
- `ORDER BY ... LIMIT` — планировщик предпочитает индекс по сортировке, а не по фильтру, рассчитывая быстро набрать `LIMIT` строк (или наоборот).

**9. Index Only Scan без выигрыша.** Индекс покрывает запрос, но visibility map устарела, и `Heap Fetches` близко к числу строк — планировщик знает это из `pg_class.relallvisible` и может предпочесть другой план.

**Как разбираться:**

1. Проверить, **может** ли индекс быть использован: `SET enable_seqscan = off; SET enable_bitmapscan = off;` в транзакции. Если план всё равно без индекса — проблема в применимости (типы, collation, выражение, предикат). Если с индексом — проблема в оценках.
2. `EXPLAIN (VERBOSE)` показывает реальные выражения с приведениями: `((account_id)::numeric = 42.0)` сразу выдаёт проблему типа.
3. Повторить с теми же параметрами, что передаёт приложение, включая prepared statement (`PREPARE` / `EXECUTE` шесть раз).
4. Сравнить `rows` и `actual rows`, проверить `pg_stats` по колонкам условия.

**Исправления** — по причине: привести тип параметра в приложении, нужный opclass или collation, выражение в запросе ровно как в индексе, литерал вместо параметра для предиката частичного индекса, `plan_cache_mode` для конкретной роли, `random_page_cost` для SSD, свежая или расширенная статистика.

## Как диагностировать блокировки и найти запрос, держащий их?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-diagnostirovat-blokirovki-i-naiti-zapros-derzhaschii-ih
tags: locking, observability
```

Найти **корень цепочки ожиданий**: процесс, который сам ничего не ждёт, но блокирует других. Для этого нужны `pg_stat_activity` (кто ждёт и чего), `pg_blocking_pids()` (кто именно блокирует) и понимание очереди блокировок: блокирующий процесс часто не выполняет ничего — это `idle in transaction`, а «виноватый» запрос в его колонке `query` — лишь последний выполненный.

**1. Есть ли ожидания на блокировках:**

```sql
SELECT wait_event_type, wait_event, count(*)
FROM pg_stat_activity
WHERE state <> 'idle'
GROUP BY 1, 2 ORDER BY 3 DESC;
```

`wait_event_type = 'Lock'` с событиями `relation`, `transactionid`, `tuple`, `advisory` — тяжеловесные блокировки (это наш случай). `LWLock` (`LockManager`, `BufferMapping`, `WALWrite`) — внутренняя конкуренция, это другая история.

**2. Кто кого блокирует:**

```sql
SELECT a.pid,
       pg_blocking_pids(a.pid) AS blocked_by,
       a.state,
       now() - a.xact_start  AS xact_age,
       now() - a.query_start AS query_age,
       a.wait_event_type, a.wait_event,
       left(a.query, 100) AS query
FROM pg_stat_activity a
WHERE cardinality(pg_blocking_pids(a.pid)) > 0
   OR a.pid IN (SELECT unnest(pg_blocking_pids(pid)) FROM pg_stat_activity)
ORDER BY a.xact_start;
```

**3. Найти корень дерева** — блокирующих, которых никто не блокирует:

```sql
WITH RECURSIVE tree AS (
  SELECT pid, pg_blocking_pids(pid) AS blockers, 1 AS depth
  FROM pg_stat_activity
  WHERE cardinality(pg_blocking_pids(pid)) > 0
  UNION ALL
  SELECT a.pid, pg_blocking_pids(a.pid), t.depth + 1
  FROM tree t
  JOIN pg_stat_activity a ON a.pid = ANY (t.blockers)
  WHERE t.depth < 10
)
SELECT DISTINCT a.pid, a.state, now() - a.xact_start AS xact_age, left(a.query, 100)
FROM tree t
JOIN pg_stat_activity a ON a.pid = t.pid
WHERE cardinality(t.blockers) = 0;
```

**4. На каком объекте:**

```sql
SELECT l.pid, l.locktype, l.relation::regclass, l.mode, l.granted, l.waitstart
FROM pg_locks l
WHERE l.pid IN (...)
ORDER BY l.granted, l.waitstart;
```

**Как интерпретировать типичные картины:**

- **Корень — `idle in transaction`** с большим `xact_age`. Приложение открыло транзакцию и не завершило (забыли `Commit`, исключение без `Dispose`, HTTP-вызов внутри транзакции). Колонка `query` показывает последний запрос, а блокировку мог взять любой из предыдущих. Связать с кодом помогают `application_name`, `client_addr`, `backend_start`.
- **Корень — долгий `SELECT`, за ним `ALTER TABLE`, за ним сотни запросов.** Это очередь блокировок: DDL ждёт `ACCESS EXCLUSIVE`, все новые запросы ждут за DDL. Отменить DDL — очередь мгновенно рассосётся. Профилактика — `lock_timeout` в миграциях.
- **Ожидание `transactionid`** — ждут строку, изменённую незавершённой транзакцией (`UPDATE` одной горячей строки, счётчик, очередь без `SKIP LOCKED`).
- **Autovacuum в корне** — обычный autovacuum сам уступает конфликтующим блокировкам; если не уступает, это anti-wraparound vacuum (`to prevent wraparound` в `query`), и прерывать его не стоит.
- **Подготовленные транзакции** (`pg_prepared_xacts`) держат блокировки без процесса — `pg_stat_activity` их не покажет.

**5. Действовать:**

```sql
SELECT pg_cancel_backend(12345);
SELECT pg_terminate_backend(12345);
```

`cancel` прерывает текущий запрос (для `idle in transaction` не поможет — там нечего отменять), `terminate` закрывает соединение и откатывает транзакцию.

**Чтобы видеть историю, а не только текущий момент:**

- `log_lock_waits = on` — в лог попадает каждое ожидание дольше `deadlock_timeout` с указанием держателя и очереди;
- `log_min_duration_statement` и `auto_explain` — длинные запросы-держатели;
- периодический сэмплинг `pg_stat_activity` в мониторинге или расширение `pg_wait_sampling`;
- защитные таймауты: `lock_timeout`, `statement_timeout`, `idle_in_transaction_session_timeout`, `transaction_timeout` (PG 17).

## Как менять схему большой таблицы, не блокируя запись надолго?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-menyat-shemu-bolshoi-tablicy-ne-blokiruya-zapis-nadolgo
tags: locking, migration
```

Почти любой `ALTER TABLE` берёт `ACCESS EXCLUSIVE`, но опасна не сама блокировка, а её **длительность** и **очередь**. Поэтому правило двойное: выбирать операции, которые меняют только метаданные (миллисекунды), а то, что требует перезаписи или сканирования таблицы, разбивать на шаги с более слабыми блокировками; и всегда ставить `lock_timeout`, чтобы миграция не выстроила за собой очередь из всех запросов к таблице.

**Защита от очереди блокировок — в каждой миграции:**

```sql
SET lock_timeout = '3s';
ALTER TABLE orders ADD COLUMN note text;
```

Если таблицу держит долгая транзакция, миграция упадёт через 3 секунды, а не повесит продакшен. Дальше — ретрай с паузой (в инструментах миграций или в скрипте).

**Что быстро (только метаданные):**

| Операция | Условие |
| --- | --- |
| `ADD COLUMN` без `DEFAULT` или с не-volatile `DEFAULT` | PG 11+: значение хранится в каталоге, таблица не переписывается |
| `DROP COLUMN` | колонка помечается удалённой, место освобождается позже |
| `ALTER COLUMN ... SET DEFAULT` / `DROP DEFAULT` | влияет только на новые строки |
| `RENAME` колонки/таблицы | мгновенно, но ломает приложение — нужна совместимость кода |
| увеличение `varchar(n)`, `varchar(n)` → `text`, снятие ограничения длины | бинарно совместимые типы, без перезаписи |
| `DROP NOT NULL`, `DROP CONSTRAINT` | мгновенно |

**Что опасно и как обойти:**

1. **`ADD COLUMN ... DEFAULT volatile_func()`** (например, `gen_random_uuid()`, `clock_timestamp()`) — перезапись таблицы. Добавить колонку без default, задать default для новых строк, заполнить старые батчами.

2. **`SET NOT NULL`** — полное сканирование под `ACCESS EXCLUSIVE`. Обход (PG 12+):

```sql
ALTER TABLE orders ADD CONSTRAINT orders_status_nn CHECK (status IS NOT NULL) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT orders_status_nn;
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;
ALTER TABLE orders DROP CONSTRAINT orders_status_nn;
```

`VALIDATE` сканирует под `SHARE UPDATE EXCLUSIVE` (запись идёт), а `SET NOT NULL` при валидном `CHECK` пропускает сканирование.

3. **`CHECK` и `FOREIGN KEY`** — сначала `NOT VALID` (проверяются только новые строки, блокировка короткая), затем `VALIDATE CONSTRAINT` с более слабой блокировкой. `ADD FOREIGN KEY` берёт `SHARE ROW EXCLUSIVE` на обе таблицы — с `NOT VALID` лишь на мгновение.

4. **`UNIQUE` / `PRIMARY KEY`** — сначала `CREATE UNIQUE INDEX CONCURRENTLY`, затем `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE USING INDEX idx` (или `PRIMARY KEY USING INDEX`) — мгновенно. Для PK колонки должны быть `NOT NULL` (см. пункт 2).

5. **Смена типа колонки** с перезаписью (`int` → `bigint`, `text` → `jsonb`, `timestamp` → `timestamptz`) — полная перезапись таблицы и всех индексов под `ACCESS EXCLUSIVE`. Обход — паттерн expand/contract:
   - добавить новую колонку `id_new bigint`;
   - триггер или код приложения пишет в обе колонки;
   - бэкфилл старых строк батчами;
   - индексы и ограничения на новую колонку — `CONCURRENTLY` / `NOT VALID`;
   - в короткой транзакции переименовать колонки и переключить default/sequence;
   - удалить старую колонку позже.

6. **Индексы** — только `CREATE/DROP INDEX CONCURRENTLY`, отдельной миграцией вне транзакции.

7. **`VACUUM FULL`, `CLUSTER`** для сжатия — заменить на `pg_repack`.

**Совместимость с приложением.** Схему меняют так, чтобы и старая, и новая версии кода работали одновременно (rolling deploy): сначала расширить схему, задеплоить код, потом сузить. Переименование колонки «в лоб» ломает работающие экземпляры — вместо этого новая колонка, двойная запись, переключение, удаление старой.

**Процесс:**

- каждую миграцию проверять на копии с продакшен-объёмом: сколько длится, какую блокировку берёт (`pg_locks` во время выполнения);
- одна опасная операция — одна миграция; в EF Core для `CONCURRENTLY` — `suppressTransaction: true`;
- бэкфиллы — отдельным процессом с батчами и контролем лага реплик, а не внутри миграции;
- проверять, не идёт ли в момент миграции долгая транзакция или anti-wraparound vacuum по таблице.

## Почему deadlock возникает при обновлении в разном порядке и как этого избежать?

```yaml
category: postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-pochemu-deadlock-voznikaet-pri-obnovlenii-v-raznom-poryadke-i-kak-etog
tags: locking, transactions
```

Блокировка строки держится до конца транзакции, а следующая берётся, пока предыдущие ещё удерживаются. Если две транзакции захватывают одни и те же строки в **разном порядке**, каждая успевает взять «свою первую» и ждёт «свою вторую», которую держит другая, — цикл ожиданий. Детерминированный глобальный порядок захвата делает цикл невозможным: все ждут в одном направлении, и кто-то всегда может продвинуться.

**Где разный порядок появляется неявно** — это главное, о чём спрашивают на senior-уровне:

1. **Бизнес-операции с двумя сущностями.** Перевод A → B блокирует сначала A, потом B; встречный перевод B → A — наоборот.

2. **Массовый `UPDATE` без явного порядка.** `UPDATE items SET ... WHERE order_id IN (...)` проходит строки в порядке плана: одна сессия — через Seq Scan в физическом порядке, другая — через индекс в порядке ключа. Пересекающиеся наборы строк блокируются вразнобой. `UPDATE` не поддерживает `ORDER BY`, поэтому порядок задают отдельной блокировкой:

```sql
WITH locked AS (
  SELECT id FROM items
  WHERE order_id = ANY (@ids)
  ORDER BY id
  FOR UPDATE
)
UPDATE items i SET reserved = true
FROM locked WHERE i.id = locked.id;
```

3. **Вставки с уникальными ключами.** Две транзакции вставляют одинаковые значения уникального ключа в разном порядке: вторая вставка ждёт решения первой транзакции по тому же ключу — `INSERT` тоже может участвовать в deadlock. Сортировать батч по ключу перед вставкой, в том числе для `INSERT ... ON CONFLICT`.

4. **Внешние ключи.** Вставка/обновление дочерней строки берёт `FOR KEY SHARE` на родителя. Транзакция, которая сначала вставляет детей (блокирует родителя в shared-режиме), а затем обновляет родителя, сталкивается со встречной такой же транзакцией: обе держат shared на родителя и ждут друг друга для эксклюзивного `UPDATE`. Решение — сначала блокировать родителя (`SELECT ... FOR UPDATE` или `FOR NO KEY UPDATE`), потом работать с детьми.

5. **Триггеры и каскады.** Триггер обновляет счётчик в родительской таблице, `ON DELETE CASCADE` удаляет детей — фактический порядок блокировок отличается от того, что видно в коде приложения.

6. **ORM.** `SaveChanges` отправляет команды в порядке, который определяет ORM (зависимости между сущностями, порядок отслеживания); две операции над одними и теми же сущностями могут сформировать разный порядок. Для горячих путей — явный `SELECT ... FOR UPDATE ... ORDER BY id` в начале транзакции или атомарный SQL.

**Стратегии предотвращения:**

| Стратегия | Как |
| --- | --- |
| Глобальный порядок | сортировать по первичному ключу (`ORDER BY id FOR UPDATE`), для разных таблиц — фиксированный порядок таблиц (сначала родитель, потом дети) |
| Блокировать всё заранее | в начале транзакции одним запросом взять все нужные строки в порядке ключа |
| Сразу сильная блокировка | `FOR UPDATE` вместо `FOR SHARE` + последующего `UPDATE` (апгрейд блокировки — частая причина deadlock) |
| Грубая сериализация | `pg_advisory_xact_lock(hashtext('account:' \|\| id))` по агрегату или «блокировка родителя» |
| Меньше блокировок | атомарные `UPDATE ... SET x = x + 1`, короткие транзакции, батчи меньшего размера |
| Не ждать | `NOWAIT` / `SKIP LOCKED` в очередях и фоновых обработчиках |

**Пример — перевод между счетами:**

```sql
BEGIN;
SELECT id FROM accounts
WHERE id IN (@from, @to)
ORDER BY id
FOR UPDATE;
UPDATE accounts SET balance = balance - @amount WHERE id = @from;
UPDATE accounts SET balance = balance + @amount WHERE id = @to;
COMMIT;
```

Оба счёта блокируются в порядке `id`, независимо от направления перевода.

**Что остаётся всегда:** даже при аккуратном порядке deadlock возможен в редких сочетаниях (каскады, триггеры, сторонний код), поэтому приложение повторяет транзакцию при `40P01`, как и при `40001`. Мониторинг: `pg_stat_database.deadlocks` и лог с текстами запросов участников — рост показывает, что где-то появился новый путь с другим порядком.

## Чем отличаются уровни изоляции на практике и какие аномалии остаются на Repeatable Read?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-chem-otlichayutsya-urovni-izolyacii-na-praktike-i-kakie-anomalii-ostay
tags: transactions, consistency
```

На практике в PostgreSQL выбирают из трёх режимов: **Read Committed** (снимок на каждый оператор, конфликты записи разрешаются переоценкой строки), **Repeatable Read** (снимок на всю транзакцию, конфликт записи — ошибка `40001`) и **Serializable** (Repeatable Read плюс обнаружение опасных зависимостей чтения-записи). На Repeatable Read невозможны грязное, неповторяющееся и фантомное чтение и lost update, но остаются **write skew** и **read-only anomaly** — аномалии, где каждая транзакция по отдельности корректна, но их комбинация не эквивалентна никакому последовательному порядку.

**Как ведут себя уровни в одних и тех же ситуациях:**

| Ситуация | Read Committed | Repeatable Read | Serializable |
| --- | --- | --- | --- |
| Повторный `SELECT` видит чужой коммит | да | нет | нет |
| Два параллельных `UPDATE` одной строки | второй ждёт и применяется к новой версии | второй ждёт и получает `40001`, если первый закоммитил | так же |
| read-modify-write в приложении (lost update) | возможен | невозможен (`40001`) | невозможен |
| Проверка инварианта по набору строк + запись в другие строки | гонка | гонка (write skew) | одна транзакция получает `40001` |
| Нужны ретраи | только на deadlock | на `40001` и deadlock | на `40001` и deadlock, чаще |
| Влияние на VACUUM | снимок короткий | снимок держится всю транзакцию | то же плюс предикатные блокировки |

**Write skew — шаблон, который нужно узнавать.** Транзакция читает набор строк, проверяет условие и пишет **в другую** строку, которую параллельная транзакция не трогает:

- «на дежурстве должен остаться хотя бы один врач»;
- «логин свободен» → вставка пользователя (без уникального индекса);
- «у переговорки нет брони на это время» → вставка брони;
- «суммарный лимит по всем картам клиента не превышен» → увеличение лимита одной карты.

Конфликта записи нет, оба снимка «правильные», обе транзакции коммитятся — инвариант нарушен.

**Read-only anomaly** — более тонкая аномалия snapshot isolation: даже транзакция, которая **только читает**, может увидеть состояние, невозможное ни при каком последовательном порядке. Классический пример — две пишущие транзакции T1 (снять деньги с учётом баланса) и T2 (зачислить депозит) и читающая T3 (отчёт), которая берёт снимок после коммита депозита, но до коммита списания, и видит депозит, но не видит списания, тогда как «итоговое» решение T1 было принято без учёта депозита. Отчёт показывает итог, который противоречит итоговому состоянию. На Serializable PostgreSQL обнаруживает и это; режим `SERIALIZABLE READ ONLY DEFERRABLE` дожидается «безопасного» снимка, в котором аномалия невозможна.

**Как закрывать write skew без Serializable:**

- **ограничения в схеме** — уникальный (в том числе частичный) индекс, exclusion constraint для интервалов: самый надёжный вариант;
- **материализовать конфликт** — заставить транзакции писать в одну и ту же строку: `SELECT ... FOR UPDATE` по «родителю» (клиент, переговорка, смена), счётчик в родительской строке;
- **advisory lock** по ключу инварианта;
- блокировать прочитанные строки `FOR UPDATE` / `FOR SHARE` — работает для существующих строк, но не для вставок (фантомов).

**Практический выбор:**

- **Read Committed** — дефолт для OLTP: атомарные `UPDATE`, ограничения, явные блокировки в критичных местах. Минимум ретраев.
- **Repeatable Read** — согласованные многозапросные чтения (отчёты, экспорт, `pg_dump`), защита от lost update без явных блокировок — при наличии ретраев.
- **Serializable** — когда инвариантов много, они пересекают строки и таблицы, а «материализовать» каждый конфликт вручную дорого и рискованно. Цена — откаты под конкуренцией и необходимость всем участникам работать на этом уровне.

**Отличия от других СУБД, о которых спрашивают:** в MySQL InnoDB Repeatable Read — дефолт, но `UPDATE` читает последнюю закоммиченную версию (lost update возможен без `FOR UPDATE`), а фантомы закрываются gap-блокировками. В SQL Server Snapshot — аналог Repeatable Read PostgreSQL, а Repeatable Read — блокировочный, с фантомами.

## Когда стоит выбрать SELECT FOR UPDATE, а когда оптимистичную блокировку?

```yaml
category: postgresql
level: senior
difficulty: 4
slug: advanced-postgresql-kogda-stoit-vybrat-select-for-update-a-kogda-optimistichnuyu-blokirovk
tags: locking, transactions
```

`SELECT ... FOR UPDATE` (пессимистичная блокировка) — когда конфликты **частые**, а операция короткая и целиком внутри одной транзакции: конкуренты ждут в очереди вместо того, чтобы падать и повторять работу. Оптимистичная блокировка (проверка версии при записи) — когда конфликты **редкие** или когда между чтением и записью проходит время вне транзакции, например пользователь редактирует форму. Есть и третий вариант, который часто лучше обоих: атомарный `UPDATE` с условием.

**Пессимистичная — `FOR UPDATE`:**

```sql
BEGIN;
SELECT qty FROM stock WHERE sku = 'A1' FOR UPDATE;
UPDATE stock SET qty = qty - 2 WHERE sku = 'A1';
INSERT INTO reservations (...) VALUES (...);
COMMIT;
```

- конкурирующие транзакции ждут, ретраи не нужны (кроме deadlock);
- держит строку до конца транзакции — транзакция обязана быть короткой: никаких HTTP-вызовов и ожидания пользователя внутри;
- на горячей строке (популярный товар) — очередь, пропускная способность ограничена временем транзакции;
- `NOWAIT` — сразу ошибка вместо ожидания; `SKIP LOCKED` — взять другую строку (очереди задач);
- риск deadlock при блокировке нескольких строк — блокировать в порядке ключа.

**Оптимистичная — версия строки:**

```sql
UPDATE documents
SET body = @body, version = version + 1
WHERE id = @id AND version = @expectedVersion;
```

0 затронутых строк — кто-то изменил документ раньше: сообщить пользователю или перечитать и повторить.

- никаких блокировок между чтением и записью — подходит для сценариев «загрузили форму, через 10 минут сохранили»;
- при частых конфликтах — много ретраев и потраченной впустую работы, а под высокой конкуренцией возможно «голодание» отдельных клиентов;
- конфликт обнаруживается только на записи.

В EF Core это concurrency token: свойство с `[ConcurrencyCheck]` или `[Timestamp]`. В Npgsql удобно использовать системную колонку `xmin` — она меняется при каждом обновлении строки и не требует отдельной колонки: свойство `uint Version` с `[Timestamp]` маппится на `xmin`. Конфликт выбрасывает `DbUpdateConcurrencyException`.

**Атомарный условный `UPDATE` — часто лучший выбор:**

```sql
UPDATE stock SET qty = qty - 2
WHERE sku = 'A1' AND qty >= 2
RETURNING qty;
```

Нет ни отдельного чтения, ни ретраев: на Read Committed конкурирующий `UPDATE` подождёт и перепроверит условие на новой версии строки. Подходит, когда решение выражается одним условием в SQL.

**Как выбирать:**

| Сценарий | Подход |
| --- | --- |
| Пользователь редактирует сущность в UI, сохраняет позже | оптимистичная (версия / `xmin`) |
| Конфликты редки, операция в одной транзакции | оптимистичная или атомарный `UPDATE` |
| Горячая строка, высокая конкуренция, сложная логика между чтением и записью | `FOR UPDATE`, короткая транзакция |
| Инвариант выражается условием | атомарный `UPDATE ... WHERE` |
| Очередь задач, несколько воркеров | `FOR UPDATE SKIP LOCKED` |
| Инвариант по набору строк (write skew) | `FOR UPDATE` по родительской строке, ограничение в схеме или Serializable |

**Сочетания на практике:** оптимистичная проверка версии для пользовательского редактирования и `FOR UPDATE` внутри короткой серверной транзакции, которая применяет изменение; атомарные `UPDATE` для счётчиков и остатков.

**Чего избегать:**

- `FOR UPDATE` в длинной транзакции «на всякий случай» — очередь, блокировки, мешает VACUUM;
- «оптимистичная» проверка через отдельный `SELECT version` и затем `UPDATE` без условия по версии — гонка остаётся;
- оптимистичная блокировка на счётчике, который обновляют сотни раз в секунду, — шторм ретраев.

**Что спрашивают дальше:** как оптимистичная блокировка связана с уровнями изоляции (Repeatable Read даёт её «бесплатно» через `40001`), как реализовать бронирование без двойной продажи (атомарный `UPDATE` или exclusion constraint).

## Зачем нужен pgbouncer и какие возможности PostgreSQL ломает transaction pooling?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-zachem-nuzhen-pgbouncer-i-kakie-vozmozhnosti-postgresql-lomaet-transac
tags: connections, architecture
```

PgBouncer — лёгкий внешний пулер соединений. Он держит небольшое число серверных соединений к PostgreSQL и раздаёт их тысячам клиентских. Это нужно, потому что в PostgreSQL каждое соединение — отдельный процесс с собственной памятью, и сотни–тысячи активных соединений деградируют сервер. В режиме **transaction pooling** серверное соединение отдаётся клиенту только на время транзакции — это даёт максимальную экономию, но ломает всё, что опирается на **состояние сессии**.

**Зачем, если в Npgsql уже есть пул.** Пул драйвера — на процесс. 30 подов × `Maximum Pool Size=50` = 1500 соединений, а большую часть времени они простаивают. PgBouncer агрегирует их в, скажем, 100 серверных соединений, и база работает в комфортном режиме. Плюс: защита от штормов подключений при рестарте приложений, `PAUSE`/`RESUME` для переключений и обслуживания, единая точка маршрутизации.

**Режимы:**

| Режим | Серверное соединение закреплено за клиентом | Что работает |
| --- | --- | --- |
| `session` (по умолчанию) | на всю сессию клиента | всё, но экономия только на установке соединения |
| `transaction` | на одну транзакцию | основная экономия, сессионное состояние не гарантировано |
| `statement` | на один оператор | многооператорные транзакции запрещены |

Основные параметры: `pool_mode`, `default_pool_size` (по умолчанию 20 на пару «база/пользователь»), `max_client_conn` (по умолчанию 100 — обычно сильно увеличивают), `max_db_connections`, `reserve_pool_size`, `server_reset_query` (по умолчанию `DISCARD ALL`, применяется только в session-режиме).

**Что ломает transaction pooling.** Следующая транзакция клиента может попасть в другое серверное соединение, а в текущее — чужая транзакция:

- **`SET` на уровне сессии** (`search_path`, `TimeZone`, `statement_timeout`, `application_name`) — применится к случайному соединению и «протечёт» к чужим клиентам. Использовать `SET LOCAL` внутри транзакции или задавать параметры на роль/базу (`ALTER ROLE ... SET`).
- **Сессионные advisory locks** (`pg_advisory_lock`) — блокировка останется в серверном соединении, а снять её «тем же» клиентом нельзя. Использовать `pg_advisory_xact_lock`.
- **`LISTEN`/`NOTIFY`** — `LISTEN` не работает (уведомления придут в соединение, которое уже отдано другому). Для подписки — отдельное прямое соединение в обход PgBouncer.
- **Временные таблицы**, живущие дольше транзакции, и `WITH HOLD`-курсоры.
- **Prepared statements.** SQL-команда `PREPARE` не работает. Протокольные prepared statements поддерживаются начиная с PgBouncer 1.21 при `max_prepared_statements > 0` — PgBouncer отслеживает их и подготавливает на нужном серверном соединении сам. В более старых версиях auto-prepare драйвера надо было выключать.
- **Логика на `pg_backend_pid()`**, сессионные переменные (`set_config(..., false)`), `pg_stat_activity.application_name` как идентификатор клиента — неустойчивы.
- **Долгие транзакции** сводят выигрыш на нет: соединение занято всё время транзакции. `idle in transaction` в transaction-режиме особенно вреден — держит серверное соединение из маленького пула.

**Что работает без изменений:** обычные транзакции, `SET LOCAL`, `pg_advisory_xact_lock`, временные таблицы `ON COMMIT DROP`, prepared statements протокола (с 1.21).

**Npgsql + PgBouncer (transaction mode):**

- пул Npgsql оставить включённым — он экономит соединения до PgBouncer;
- не полагаться на сессионные `SET` и сессионные advisory locks;
- отдельная строка подключения напрямую к PostgreSQL для миграций, `LISTEN`, долгих сессионных операций;
- если используются `Max Auto Prepare` или явный `Prepare()` — PgBouncer 1.21+ с `max_prepared_statements`.

**Эксплуатационные нюансы:**

- PgBouncer однопоточный: на высоких нагрузках запускают несколько процессов (`so_reuseport`) или используют многопоточные альтернативы (Odyssey, PgCat);
- ожидание соединения в PgBouncer растёт незаметно для базы — мониторить `SHOW POOLS` (`cl_waiting`, `maxwait`);
- размер серверного пула подбирают по ресурсам базы (ядра, диски), а не по числу клиентов.

## Как найти и оптимизировать запрос, который стал медленным только под нагрузкой?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-naiti-i-optimizirovat-zapros-kotoryi-stal-medlennym-tolko-pod-nagr
tags: query-planning, performance
```

Если запрос быстрый в изоляции и медленный под нагрузкой, проблема почти никогда не в его плане как таковом, а в **конкуренции за общие ресурсы**: блокировки строк и таблиц, внутренние LWLock-и, CPU, диск, WAL, память, пул соединений. Поэтому диагностика строится не вокруг `EXPLAIN`, а вокруг **wait events** — чего процессы ждут, когда запрос тормозит.

**1. Подтвердить, что разница — в ожидании, а не в работе.** Сравнить `pg_stat_statements` в спокойный и пиковый период: `mean_exec_time` вырос, а `shared_blks_hit + shared_blks_read` на вызов почти тот же — значит, запрос делает ту же работу, но дольше ждёт. С `track_io_timing = on` видно и время чтения/записи блоков (`shared_blk_read_time` в PG 17, `blk_read_time` в более ранних версиях).

**2. Посмотреть, чего ждут процессы в пике.** Сэмплировать `pg_stat_activity` (раз в секунду в мониторинге или расширением `pg_wait_sampling`):

```sql
SELECT wait_event_type, wait_event, count(*)
FROM pg_stat_activity
WHERE state = 'active' AND backend_type = 'client backend'
GROUP BY 1, 2 ORDER BY 3 DESC;
```

| Ожидание | Что означает | Куда смотреть |
| --- | --- | --- |
| `Lock: transactionid` / `tuple` | очередь на одни и те же строки | горячие строки: счётчики, остатки, очереди без `SKIP LOCKED` |
| `Lock: relation` | DDL, `LOCK TABLE`, очередь за `ACCESS EXCLUSIVE` | миграции, `TRUNCATE`, `REFRESH MATERIALIZED VIEW` |
| `LWLock: LockManager` | много блокировок на запрос (сотни партиций и индексов) | pruning, число индексов, fast-path |
| `LWLock: BufferMapping`, `BufferContent` | конкуренция за одни и те же страницы | горячая страница: правый край индекса, маленькая таблица-счётчик |
| `LWLock: WALWrite`, `IO: WALSync` | запись WAL — узкое место | диск WAL, группировка коммитов, объём WAL |
| `IO: DataFileRead` | рабочий набор не помещается в память | `shared_buffers`, индексы, лишние чтения |
| `LWLock: SubtransSLRU`, `MultiXact*` | переполнение кэша subtransactions, много `FOR SHARE` / FK | `EXCEPTION`-блоки, savepoint-ы ORM |
| `Client: ClientRead` при `idle in transaction` | приложение медленно ведёт транзакцию | код приложения, пул |
| нет ожиданий, CPU 100% | конкуренция за CPU | число активных соединений, тяжёлые запросы-соседи |

**3. Проверить ресурсы, общие для всех запросов:**

- **Активные соединения больше, чем ядер** — переключения контекста и конкуренция; лечится ограничением пула (PgBouncer, меньший `Maximum Pool Size`), а не увеличением.
- **`work_mem` × параллельные операции** — под нагрузкой не хватает памяти, сортировки уходят на диск (`temp_blks_written` в `pg_stat_statements`, `log_temp_files`).
- **Checkpoint и autovacuum** совпадают с пиками — всплески I/O и WAL.
- **Вытеснение кэша** — тяжёлый отчёт в пике выдавливает рабочий набор OLTP из `shared_buffers`.
- **Ожидание в пуле приложения** — запрос быстрый в базе, но долго ждёт соединения: это видно по метрикам Npgsql (`db.client.connections.*`), а не в PostgreSQL.

**4. Проверить план под реальными параметрами.** Под нагрузкой приложение использует prepared statements: generic-план может отличаться от того, что вы видите в psql. `auto_explain` с `log_min_duration` покажет план именно медленных выполнений, а разброс `min/max_exec_time` в `pg_stat_statements` — нестабильность.

**5. Оптимизировать по найденной причине:**

- **горячие строки** — атомарные `UPDATE`, шардирование счётчика (N строк вместо одной, суммирование при чтении), асинхронная агрегация, `SKIP LOCKED` для очередей;
- **короткие транзакции** — убрать из транзакции всё, что не требует атомарности, особенно внешние вызовы;
- **меньше блокировок на запрос** — pruning по партициям, меньше лишних индексов;
- **WAL** — батчинг коммитов, `synchronous_commit = off` для некритичных данных, быстрый диск под WAL;
- **ограничить параллелизм** — пул меньше, очередь в приложении, а не в базе;
- **разделить нагрузки** — отчёты на реплику, тяжёлые задачи в окно низкой нагрузки;
- **subtransactions** — убрать savepoint-ы в циклах и `EXCEPTION`-блоки в горячих функциях.

**6. Воспроизвести.** Нагрузочный тест (`pgbench` со своим скриптом, k6/NBomber против API) с продакшен-подобными данными и конкуренцией: проблема конкуренции не воспроизводится одиночным запуском.

## Как удалить миллионы строк, не заблокировав таблицу и не раздув WAL?

```yaml
category: postgresql
level: senior
difficulty: 5
slug: advanced-postgresql-kak-udalit-milliony-strok-ne-zablokirovav-tablicu-i-ne-razduv-wal
tags: maintenance, performance
```

Не одним `DELETE`. Если данные можно отделить структурно, лучше вообще не удалять построчно: `DROP`/`DETACH` партиции или `TRUNCATE` почти не пишут WAL и не оставляют мёртвых строк. Если нельзя — удалять **батчами** по индексу с коммитом после каждой пачки, контролируя нагрузку, лаг реплик и работу VACUUM. Объём WAL от построчного удаления уменьшить можно лишь частично; главное — растянуть его во времени.

**Почему один большой `DELETE` плох:**

- одна многочасовая транзакция держит блокировки всех удаляемых строк — конкурирующие `UPDATE` этих строк ждут;
- держит горизонт: VACUUM не может чистить мёртвые строки **во всей базе**, пока она не завершится;
- сразу генерирует огромный WAL — реплики отстают, архив и `pg_wal` растут, возможна нехватка места;
- при ошибке или отмене откатывается всё, работа потеряна;
- после коммита — миллионы мёртвых строк разом, огромный прогон autovacuum и bloat.

**Вариант 1. Структурно — без построчного удаления.**

```sql
ALTER TABLE events DETACH PARTITION events_2024_01 CONCURRENTLY;
DROP TABLE events_2024_01;
```

`DROP` и `TRUNCATE` удаляют файлы целиком: WAL — несколько записей, bloat нет. Поэтому таблицы с retention сразу проектируют партиционированными. `TRUNCATE` требует `ACCESS EXCLUSIVE`, но на миллисекунды.

Если удалить нужно **большую часть** таблицы, иногда быстрее обратный подход: скопировать оставшиеся строки в новую таблицу, построить индексы и в короткой транзакции поменять таблицы местами (с теми же оговорками про FK, последовательности и изменения, пришедшие во время копирования).

**Вариант 2. Батчи по индексу:**

```sql
DELETE FROM events
WHERE id IN (
  SELECT id FROM events
  WHERE created_at < '2024-01-01'
  ORDER BY id
  LIMIT 5000
);
```

Цикл в приложении, скрипте или процедуре с `COMMIT` после каждой пачки:

- **размер батча** — такой, чтобы пачка занимала 100–500 мс; для начала 1–10 тыс. строк;
- **индекс под условие отбора** — иначе каждый батч сканирует таблицу; ещё эффективнее идти по диапазонам первичного ключа (`WHERE id >= @from AND id < @to AND created_at < ...`), запоминая позицию, чтобы не перечитывать уже вычищенное начало индекса, заполненное мёртвыми записями;
- **паузы и троттлинг** — проверять лаг реплик (`pg_stat_replication.replay_lag`) и при росте притормаживать;
- **возобновляемость** — сохранять последний обработанный `id`, чтобы продолжить после сбоя;
- **`lock_timeout`/`statement_timeout`** на сессию, чтобы батч не завис за чужой блокировкой.

**Про WAL.** Построчное удаление пишет запись WAL на каждую строку (небольшую — помечается `xmax`), но после каждого checkpoint первое изменение каждой страницы добавляет full page image, а потом VACUUM ещё раз пишет WAL при очистке страниц и индексов. Уменьшить объём:

- удалять в порядке физического расположения (по `id`/`created_at`, если они коррелируют с порядком вставки) — каждая страница затрагивается один раз, меньше FPI;
- `wal_compression` для FPI;
- не удалять больше, чем нужно, а для постоянного retention перейти на партиции.

Растягивание во времени не уменьшает общий объём WAL, но не даёт ему превратиться во всплеск, который убивает реплики и диск.

**Скрытые затраты:**

- **Внешние ключи.** Если на таблицу ссылаются другие с `ON DELETE CASCADE` / `RESTRICT`, каждая удалённая строка проверяет ссылающиеся таблицы. Без индекса на ссылающейся колонке это Seq Scan **на каждую строку**. В `EXPLAIN ANALYZE DELETE` это видно как `Trigger for constraint ...: time=...`.
- **Триггеры** на `DELETE` — аудит, outbox — умножают работу.
- **Логическая репликация/CDC** — каждая строка становится событием для потребителей (Debezium получит миллионы `DELETE`).

**После удаления:**

- `VACUUM (VERBOSE) events` или позволить autovacuum с более агрессивными настройками для таблицы — место станет переиспользуемым;
- размер файла не уменьшится; если нужно вернуть место ОС — `pg_repack`, а не `VACUUM FULL`;
- `ANALYZE` — распределение данных сильно изменилось;
- `REINDEX INDEX CONCURRENTLY` для распухших индексов.
