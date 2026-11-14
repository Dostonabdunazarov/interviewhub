---
title: JOIN и NULL
slug: sql-join-i-null
track: dotnet-backend
section: postgresql
level: middle
sortOrder: 9
summary: Чем отличаются INNER, LEFT, RIGHT, FULL и CROSS JOIN, как они меняют кратность строк, почему условие в WHERE ломает LEFT JOIN и как трёхзначная логика NULL влияет на соединения, фильтры, COALESCE, NULLIF, CASE и параметры из .NET.
questions: postgresql-chem-inner-join-otlichaetsya-ot-left-join, postgresql-chem-left-join-otlichaetsya-ot-right-join, postgresql-chto-takoe-full-outer-join, postgresql-chto-takoe-cross-join, postgresql-kak-rabotaet-null, postgresql-pochemu-null-null-ne-daet-true, postgresql-chem-coalesce-otlichaetsya-ot-nullif, postgresql-chto-takoe-case, postgresql-chto-takoe-where
---

Соединения и `NULL` разбирают вместе не случайно: почти все неочевидные ошибки в `JOIN` — это ошибки с `NULL`. Внешнее соединение дополняет строки без пары `NULL`-ами, а дальше эти `NULL` попадают в `WHERE`, агрегаты и сравнения, где действует трёхзначная логика. Запрос выглядит правильно, не падает и молча теряет строки.

## INNER и LEFT JOIN

`INNER JOIN` возвращает только пары, для которых условие `ON` дало `true`. `LEFT JOIN` возвращает все строки левой таблицы: если справа пары нет, правые колонки заполняются `NULL`.

```sql
SELECT u.id, o.id AS order_id
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;
```

Диаграммы Венна здесь вводят в заблуждение: соединение — не пересечение множеств, а перебор пар. Пользователь с тремя заказами даст три строки и в `INNER`, и в `LEFT`; `LEFT JOIN` лишь гарантирует, что левая строка появится **хотя бы один раз**. Отсюда классическая ошибка в агрегатах: две независимые «многие» стороны в одном запросе (заказы и обращения пользователя) перемножаются, и `sum(o.amount)` считается по `заказы × обращения` строк. Лечится агрегацией каждой стороны в подзапросе до соединения — подробнее в статье `Группировка, DISTINCT и дубликаты`.

После `LEFT JOIN` важно, что именно считать. `count(*)` посчитает строку пользователя без заказов как 1, `count(o.id)` — как 0, потому что агрегаты пропускают `NULL`.

## Ловушка: условие в WHERE после LEFT JOIN

```sql
SELECT u.id, o.id
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.status = 'paid';
```

У пользователя без заказов `o.status` равно `NULL`, `NULL = 'paid'` даёт `unknown`, и `WHERE` строку отбрасывает. Результат совпадает с `INNER JOIN`. Если нужно «всех пользователей и только оплаченные заказы», условие на правую таблицу переносят в `ON`:

```sql
LEFT JOIN orders o ON o.user_id = u.id AND o.status = 'paid'
```

Правило: для `INNER JOIN` условие в `ON` и в `WHERE` эквивалентно, для внешних соединений — нет. `ON` решает, какие пары считать совпавшими; `WHERE` фильтрует уже готовый результат, включая строки, дополненные `NULL`. Планировщик PostgreSQL распознаёт этот случай — строгое условие по nullable-стороне — и сам понижает соединение до внутреннего: в `EXPLAIN` вместо `Hash Left Join` будет `Hash Join`.

## RIGHT, FULL и CROSS JOIN

`A RIGHT JOIN B` полностью эквивалентен `B LEFT JOIN A`, разница только в порядке колонок при `SELECT *`. На практике пишут `LEFT`: запрос читается от основной таблицы в `FROM`, а `RIGHT JOIN` в середине цепочки применяется к результату всех предыдущих соединений и выбрасывает их строки без пары — это легко пропустить. Для планировщика разницы нет: `Hash Right Join` в плане запроса с `LEFT JOIN` означает лишь, что хеш построен по сохраняемой стороне.

`FULL JOIN` сохраняет строки обеих сторон. Основной сценарий — сверка двух источников:

```sql
SELECT coalesce(a.sku, b.sku) AS sku, a.qty AS warehouse_qty, b.qty AS erp_qty
FROM warehouse_stock a
FULL JOIN erp_stock b ON b.sku = a.sku
WHERE a.sku IS NULL OR b.sku IS NULL OR a.qty <> b.qty;
```

Общий ключ берут через `coalesce`, потому что у строки без пары ключ одной стороны пуст; альтернатива — `USING (sku)`, тогда колонка уже объединённая. Ограничение PostgreSQL: `FULL JOIN` работает только с условиями, пригодными для hash или merge join, то есть по сути с равенствами; `ON a.x < b.y` даст ошибку `FULL JOIN is only supported with merge-joinable or hash-joinable join conditions`. Фильтр по одной стороне в `WHERE` превращает `FULL` в `LEFT` по той же логике, что и выше, поэтому такие фильтры ставят в подзапросы до соединения.

`CROSS JOIN` — декартово произведение, `m × n` строк; `FROM a, b` и `JOIN b ON true` означают то же самое. Полезен для генерации сетки, к которой потом `LEFT JOIN`-ом подтягивают факты, чтобы получить нули там, где данных не было, — например, все пары «день × магазин» из `generate_series`. Опасен случайно: забытое условие в старом синтаксисе `FROM a, b WHERE ...` на двух таблицах по миллиону строк даёт 10¹² строк, в плане это `Nested Loop` без условия соединения с огромной оценкой `rows`.

`LATERAL` позволяет подзапросу справа ссылаться на колонки строки слева — это «цикл по строкам» в декларативной форме. Типичные применения — top-N на группу и разворачивание `jsonb`:

```sql
SELECT u.id, last.id, last.created_at
FROM users u
LEFT JOIN LATERAL (
    SELECT id, created_at FROM orders o
    WHERE o.user_id = u.id
    ORDER BY created_at DESC LIMIT 3
) last ON true;
```

С индексом `(user_id, created_at)` каждый вызов — короткий спуск по индексу. `CROSS JOIN LATERAL` выкинет пользователей без заказов, `LEFT JOIN LATERAL ... ON true` сохранит их.

## Anti-join и NOT IN

Найти строки без пары можно через `LEFT JOIN ... WHERE o.id IS NULL` или через `NOT EXISTS`; оба PostgreSQL превращает в `Hash Anti Join` или `Merge Anti Join`. В варианте с `LEFT JOIN` проверять `IS NULL` нужно по колонке, гарантированно непустой у реальной пары, например по первичному ключу.

`NOT IN (подзапрос)` — третий вариант, и он опасен. Если подзапрос вернул хотя бы один `NULL`, выражение `x NOT IN (1, 2, NULL)` для любого `x`, не равного 1 или 2, даёт `unknown`, и запрос возвращает ноль строк. К тому же из-за этой семантики `NOT IN` не превращается в anti-join. Для «нет пары» по умолчанию пишут `NOT EXISTS`.

## Трёхзначная логика

`NULL` означает «значение неизвестно или отсутствует». Это не ноль и не пустая строка: почти любое выражение с `NULL` даёт `NULL` (`1 + NULL`, `'a' || NULL`; функция `concat` — исключение), а условия принимают три значения — `true`, `false`, `unknown`.

| Выражение | Результат |
| --- | --- |
| `true AND NULL` | `NULL` |
| `false AND NULL` | `false` |
| `true OR NULL` | `true` |
| `false OR NULL` | `NULL` |
| `NOT NULL` | `NULL` |

`NULL = NULL` даёт `NULL`, потому что про два неизвестных значения нельзя утверждать ни что они равны, ни что различаются. Два клиента с неизвестной датой рождения — не «клиенты с одинаковой датой». Отсюда `WHERE phone = NULL` не находит ничего, а правильная форма — `IS NULL`. Соединение `ON a.code = b.code` не сопоставит строки, где `code` пуст с обеих сторон.

Разные части SQL обращаются с `unknown` по-разному, и это стоит знать наизусть:

- `WHERE`, `ON`, `HAVING` пропускают только `true`, поэтому `WHERE status <> 'deleted'` не вернёт строки с `status IS NULL`;
- `CHECK` считает нарушением только `false`, `NULL` проходит;
- агрегаты пропускают `NULL`: `avg` делит на число непустых значений, а `sum` по пустому набору возвращает `NULL`, а не 0;
- `GROUP BY`, `DISTINCT`, `UNION`, `PARTITION BY` считают все `NULL` одинаковыми;
- `ORDER BY` ставит `NULL` после всех значений при `ASC` и перед ними при `DESC`, меняется через `NULLS FIRST/LAST`;
- уникальный индекс по умолчанию допускает несколько `NULL`; с PG 15 это меняется опцией `NULLS NOT DISTINCT`.

Когда `NULL` нужно считать равными, есть `IS DISTINCT FROM` и `IS NOT DISTINCT FROM` — сравнения, которые всегда дают `true` или `false`. Цена — оптимизация: для B-tree и hash join это не обычное равенство, поэтому `ON a.code IS NOT DISTINCT FROM b.code` может уйти в Nested Loop. Если есть заведомо невозможное значение, иногда выгоднее `coalesce(a.code, '') = coalesce(b.code, '')` с индексами по выражению.

## COALESCE, NULLIF и CASE

`COALESCE(a, b, ...)` возвращает первый непустой аргумент — заменяет `NULL` значением. `NULLIF(a, b)` возвращает `NULL`, если `a = b`, иначе `a` — превращает значение в `NULL`. Вместе они часто встречаются в одной формуле:

```sql
SELECT shop_id,
       coalesce(sum(clicks)::numeric / nullif(sum(views), 0), 0) AS ctr
FROM banner_stats
GROUP BY shop_id;
```

`nullif` защищает от `division by zero`, `coalesce` превращает `NULL` в 0. `COALESCE` вычисляет аргументы слева направо и останавливается на первом непустом, а все аргументы должны приводиться к общему типу: `coalesce(int_col, 'нет')` — ошибка.

Обе функции — частные случаи `CASE`, условного выражения, которое возвращает значение первой ветки с истинным условием или `ELSE`, а без `ELSE` — `NULL`. У простой формы `CASE x WHEN NULL THEN ...` есть ловушка: сравнение идёт через `=`, и ветка никогда не сработает; для `NULL` нужна форма `CASE WHEN x IS NULL`. Ветки проверяются по порядку, а все `THEN` должны приводиться к одному типу. Для условных агрегатов вместо `sum(CASE ...)` в PostgreSQL чище `count(*) FILTER (WHERE status = 'cancelled')`.

## Порядок выполнения и sargability

Логический порядок обработки запроса: `FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT`; физически планировщик может делать иначе. Отсюда следствия: в `WHERE` нельзя агрегат (для этого `HAVING`), нельзя алиас из `SELECT` и нельзя оконную функцию — её фильтруют во внешнем запросе, об этом в статье `Оконные функции`.

Условие в `WHERE` может использовать индекс, когда имеет вид «колонка, оператор, значение» — это называют sargability. Обёртка колонки в функцию или приведение типа это ломает:

```sql
WHERE created_at::date = '2025-01-15'
WHERE created_at >= '2025-01-15' AND created_at < '2025-01-16'

WHERE coalesce(status, 'new') = 'new'
WHERE status = 'new' OR status IS NULL
```

В каждой паре первая форма не использует обычный индекс по колонке, вторая — использует. Альтернатива — индекс по выражению, о нём в статье `Индексы: B-tree, GIN, BRIN`. `IS NULL` B-tree обслуживает: `NULL` в индексе хранятся.

## NULL в .NET: EF Core и Dapper

EF Core по умолчанию эмулирует семантику C#, где `null == null` истинно. Сравнение nullable-колонки с nullable-переменной он переводит не в голое `=`, а в выражение с дополнительными `IS NULL`-проверками, так что LINQ `o.ParentId == parentId` при `parentId = null` найдёт корневые записи. Опция `UseRelationalNulls()` отключает эмуляцию, и тогда тот же LINQ при `null` вернёт пусто.

В Dapper и сыром SQL эмуляции нет, и это частая ошибка:

```csharp
var rows = await conn.QueryAsync<Category>(
    "SELECT * FROM categories WHERE parent_id IS NOT DISTINCT FROM @parentId",
    new { parentId });
```

С `parent_id = @parentId` запрос при `parentId = null` не вернёт ничего: Dapper передаст `DBNull`, и сравнение даст `unknown`. Вариант с `IS NOT DISTINCT FROM` работает в обоих случаях, но индекс по `parent_id` для него может не использоваться; если важна скорость, честнее разветвить SQL на `= @parentId` и `IS NULL` в коде. И обратная сторона: `sum()` без `coalesce` по пустому набору возвращает `NULL`, а чтение его в `decimal` вместо `decimal?` падает с исключением.

## Что стоит ответить на собеседовании

`INNER JOIN` возвращает только совпавшие пары, `LEFT JOIN` — все строки левой таблицы с `NULL` справа при отсутствии пары; `RIGHT` — зеркальный `LEFT`, `FULL` сохраняет обе стороны, `CROSS` даёт декартово произведение. Соединение может размножать строки, а условие на правую таблицу в `WHERE` превращает `LEFT JOIN` во `INNER` — такие условия пишут в `ON`. `NULL` — неизвестное значение, сравнения с ним дают `unknown`, `WHERE` пропускает только `true`, поэтому проверяют через `IS NULL` и `IS DISTINCT FROM`; `COALESCE` заменяет `NULL` значением, `NULLIF` превращает значение в `NULL`.

Сильный ответ добавит, что планировщик сам понижает внешнее соединение до внутреннего при строгом условии в `WHERE`, объяснит, почему `NOT IN` с `NULL` в подзапросе возвращает пусто и почему для anti-join лучше `NOT EXISTS`, разницу `count(*)` и `count(col)` после `LEFT JOIN`, ограничение `FULL JOIN` на равенства и случаи `LATERAL`. Из .NET-практики — что EF Core по умолчанию эмулирует C#-сравнение с `null`, а в Dapper `= @param` с `null` молча ничего не находит, и что функция над колонкой в `WHERE` лишает запрос индекса.
