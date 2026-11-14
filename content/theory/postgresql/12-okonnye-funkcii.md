---
title: Оконные функции
slug: sql-okonnye-funkcii
track: dotnet-backend
section: postgresql
level: middle
sortOrder: 12
summary: Как работают оконные функции — OVER, PARTITION BY, ORDER BY и рамка окна, — чем отличаются ROW_NUMBER, RANK и DENSE_RANK, как считать накопительные суммы и разницу с предыдущей строкой и как быстро получить top-N записей на группу.
questions: postgresql-chto-takoe-window-functions, postgresql-chem-row-number-rank-i-dense-rank-otlichayutsya, postgresql-kak-poluchit-n-poslednih-zapisei-dlya-kazhdogo-polzovatelya
---

`GROUP BY` отвечает на вопрос «сколько всего», но схлопывает строки: после него деталей уже нет. Оконная функция считает значение по набору связанных строк — окну — и пишет его в **каждую** строку, ничего не схлопывая. Сумма заказов клиента рядом с каждым заказом, номер заказа по порядку, разница с предыдущим платежом, скользящее среднее — всё это одна оконная функция вместо самосоединения или коррелированного подзапроса.

На собеседовании спрашивают, что такое окно и рамка, чем отличаются функции ранжирования и как получить «последние N записей каждого пользователя» — а в последней задаче лучший ответ часто вовсе не оконная функция.

## OVER, PARTITION BY и ORDER BY

Синтаксис — функция плюс `OVER (...)`. Внутри три части: `PARTITION BY` делит строки на группы (как `GROUP BY`, но строки остаются), `ORDER BY` задаёт порядок внутри раздела, рамка уточняет, какие строки раздела входят в окно текущей строки.

```sql
SELECT id, user_id, amount, created_at,
       sum(amount)  OVER (PARTITION BY user_id)                     AS user_total,
       row_number() OVER (PARTITION BY user_id ORDER BY created_at) AS n,
       sum(amount)  OVER (PARTITION BY user_id ORDER BY created_at) AS running_total,
       lag(amount)  OVER (PARTITION BY user_id ORDER BY created_at) AS prev_amount
FROM orders;
```

Пустой `OVER ()` означает одно окно на весь результат: `amount / sum(amount) OVER ()` даёт долю строки в общей сумме. Функции делятся на три группы:

| Группа | Примеры |
| --- | --- |
| Ранжирование | `row_number`, `rank`, `dense_rank`, `percent_rank`, `cume_dist`, `ntile` |
| Смещение | `lag`, `lead`, `first_value`, `last_value`, `nth_value` |
| Агрегаты в роли оконных | `sum`, `avg`, `count`, `min`, `max` и любые другие |

К агрегату в окне применим `FILTER`: `count(*) FILTER (WHERE status = 'paid') OVER (PARTITION BY user_id)`. Повторяющееся окно выносят в именованное: `OVER w ... WINDOW w AS (PARTITION BY user_id ORDER BY created_at)`.

Важно, где оконные функции стоят в логическом порядке выполнения: после `FROM`, `WHERE`, `GROUP BY` и `HAVING`, но до `DISTINCT`, `ORDER BY` и `LIMIT`. Из этого следуют два правила. Окно видит только строки, пережившие `WHERE`, — `row_number()` пронумерует отфильтрованный набор. И фильтровать по результату оконной функции в том же `WHERE` нельзя: на этом этапе её ещё не посчитали.
`ORDER BY` внутри `OVER` упорядочивает только вычисление окна, а не результат запроса. Нужен порядок строк на выходе — пишут отдельный `ORDER BY` в конце.

## Рамка окна и ловушка рамки по умолчанию

Рамка (frame) — подмножество раздела, по которому считается агрегат или `first_value`/`last_value` для текущей строки. Режимов три: `ROWS` считает физические строки, `RANGE` — значения ключа сортировки, `GROUPS` — группы одинаковых значений (peers). Рамка задаётся границами `UNBOUNDED PRECEDING`, `n PRECEDING`, `CURRENT ROW`, `n FOLLOWING`, `UNBOUNDED FOLLOWING`.

Рамка по умолчанию зависит от наличия `ORDER BY`:

- без `ORDER BY` — весь раздел, поэтому `sum(amount) OVER (PARTITION BY user_id)` — итог по пользователю;
- с `ORDER BY` — `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, то есть от начала раздела до текущей строки **и всех её peers**.

Отсюда два классических сюрприза. Первый: добавив `ORDER BY` в окно «для красоты», вы превращаете общую сумму в накопительную. Второй: `last_value(x) OVER (ORDER BY ...)` возвращает значение текущей строки (точнее, последнего её peer), а не последней в разделе, потому что рамка заканчивается на текущей строке. Лечится явной рамкой:

```sql
SELECT user_id, created_at,
       last_value(status) OVER (
           PARTITION BY user_id ORDER BY created_at
           ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
       ) AS last_status
FROM orders;
```

Проще бывает взять `first_value` с обратной сортировкой.

Разница `ROWS` и `RANGE` видна на дублях ключа: два заказа с одинаковым `created_at` в режиме `RANGE` войдут в накопительную сумму одновременно и получат одинаковый итог, в режиме `ROWS` — по очереди, но в произвольном порядке. Для бухгалтерски детерминированного нарастающего итога нужен уникальный порядок: `ORDER BY created_at, id` и `ROWS`.

`RANGE` со смещением работает по значению, а не по количеству строк, и подходит для временных окон с пропусками:

```sql
SELECT day, revenue,
       avg(revenue) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS avg_7_rows,
       sum(revenue) OVER (ORDER BY day RANGE BETWEEN interval '6 days' PRECEDING AND CURRENT ROW) AS sum_7_days
FROM daily_revenue;
```

Если в данных нет некоторых дней, `ROWS` захватит семь последних строк, растянувшись на больший период, а `RANGE` — ровно семь календарных дней. `RANGE` со смещением требует единственного ключа в `ORDER BY`.

## ROW_NUMBER, RANK и DENSE_RANK

Все три нумеруют строки по `ORDER BY` окна и расходятся только на равных значениях:

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

`row_number` всегда даёт уникальные номера — подходит для дедупликации («оставить одну строку из дублей») и top-N строго по N строк. Порядок среди равных при этом произволен и может меняться между запусками, поэтому без tie-breaker (`ORDER BY score DESC, id`) результат недетерминирован. `rank` — спортивный рейтинг: два вторых места, следующее четвёртое; фильтр `rank <= 3` может вернуть больше трёх строк. `dense_rank` нумерует без пропусков и отвечает на вопрос «N-е по величине значение»:

```sql
SELECT *
FROM (
    SELECT e.*, dense_rank() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS dr
    FROM employees e
) t
WHERE dr = 2;
```

Это вторая по величине зарплата в каждом отделе, даже если максимальную получают несколько человек. Родственные функции: `percent_rank()` равна `(rank - 1) / (строк в разделе - 1)`, `cume_dist()` — доля строк со значением не больше текущего, `ntile(n)` раскладывает раздел на n примерно равных корзин.

## LAG, LEAD и накопительные итоги

`lag(x, offset, default)` и `lead(...)` берут значение из строки на `offset` позиций назад или вперёд в пределах раздела; рамка на них не влияет. Типичные задачи — разница с предыдущим замером, интервал между событиями, поиск «дыр» в последовательности:

```sql
SELECT user_id, created_at,
       created_at - lag(created_at) OVER w AS since_prev,
       amount - lag(amount, 1, 0) OVER w   AS delta
FROM orders
WINDOW w AS (PARTITION BY user_id ORDER BY created_at, id);
```

Для первой строки раздела `lag` вернёт `NULL` или указанное значение по умолчанию. Накопительный итог — это `sum(...) OVER (PARTITION BY ... ORDER BY ... ROWS UNBOUNDED PRECEDING)`; краткая форма `ROWS UNBOUNDED PRECEDING` означает рамку от начала раздела до текущей строки. Так считают остаток на счёте после каждой операции без квадратичного самосоединения.

## Фильтрация по оконной функции

Раз окно считается после `WHERE`, условие на его результат пишут во внешнем запросе — в подзапросе или CTE:

```sql
WITH ranked AS (
    SELECT o.*,
           row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
    FROM orders o
    WHERE created_at >= now() - interval '90 days'
)
SELECT * FROM ranked WHERE rn <= 3;
```

Условия на исходные данные стоит оставлять внутри, до окна, — это меньше строк на сортировку. С PostgreSQL 15 планировщик понимает условия вида `rn <= N` для монотонных функций (`row_number`, `rank`, `dense_rank`, `count`) и превращает их в run condition узла `WindowAgg`: досчитав раздел до N, он перестаёт вычислять функцию для оставшихся строк. В плане это видно как `Run Condition`. Но строки раздела всё равно читаются и сортируются — от полного прохода таблицы это не спасает. Как CTE встраиваются в запрос и когда материализуются — в статье `Подзапросы и CTE`.

## Top-N на группу: три подхода

Задача «три последних заказа каждого пользователя» решается тремя способами, и выбор зависит от распределения данных.

**`row_number` в подзапросе** — пример выше. Он нумерует все строки таблицы: полный проход плюс сортировка по `user_id, created_at`. Хорош, когда нужны все пользователи и записей у каждого немного.

**`LATERAL` + индекс** — для каждого пользователя короткий спуск по индексу с `LIMIT`:

```sql
CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC, id DESC);

SELECT u.id AS user_id, o.*
FROM users u
CROSS JOIN LATERAL (
    SELECT id, amount, created_at
    FROM orders
    WHERE user_id = u.id
    ORDER BY created_at DESC, id DESC
    LIMIT 3
) o
WHERE u.id = ANY(@ids);
```

```text
Nested Loop
  ->  Index Scan using users_pkey on users u
        Index Cond: (id = ANY ('{...}'::bigint[]))
  ->  Limit
        ->  Index Scan using orders_user_created_idx on orders
              Index Cond: (user_id = u.id)
```

План иллюстративный. Если у пользователя 10 000 заказов, `row_number` прочитает все, а `LATERAL` — три записи индекса. Пользователи без заказов потеряются; чтобы их сохранить, пишут `LEFT JOIN LATERAL (...) o ON true`. Правило ведущего префикса здесь ключевое: индекс `(user_id, created_at)` подходит, `(created_at)` — нет; подробнее в статье `Индексы: B-tree, GIN, BRIN`.

**`DISTINCT ON`** — лаконичный вариант для N = 1:

```sql
SELECT DISTINCT ON (user_id) *
FROM orders
ORDER BY user_id, created_at DESC, id DESC;
```

`ORDER BY` обязан начинаться с выражений `DISTINCT ON`, остальное определяет, какая строка останется. Индекс с тем же порядком избавит от сортировки, но таблицу запрос всё равно пройдёт целиком, как и `row_number`.

| Ситуация | Подход |
| --- | --- |
| Нужны все пользователи, записей на каждого немного | `row_number` или `DISTINCT ON` |
| Записей на пользователя много, есть индекс | `LATERAL` + `LIMIT` |
| Список пользователей ограничен (`id = ANY(@ids)`) | `LATERAL` |

В EF Core выражение вида `users.Select(u => u.Orders.OrderByDescending(o => o.CreatedAt).Take(3))` обычно транслируется в подзапрос с `ROW_NUMBER() OVER (PARTITION BY ...)`, то есть в первый вариант. Когда нужен именно `LATERAL`, его пишут через `FromSql` или Dapper и проверяют сгенерированный SQL через `ToQueryString()`.

## Производительность

Каждое окно требует, чтобы строки пришли отсортированными по `PARTITION BY` + `ORDER BY`. В плане это узел `WindowAgg` над `Sort`; несколько окон с разным порядком дают цепочку из нескольких пар `Sort` → `WindowAgg`, а окна с одинаковым определением считаются за один проход. Отсюда практические выводы:

- индекс с порядком окна, например `(user_id, created_at)`, позволяет получить строки из Index Scan без `Sort`, а частично подходящий — воспользоваться Incremental Sort;
- сортировка большого набора упирается в `work_mem` и сбрасывается на диск (`Sort Method: external merge`), как описано в статье `EXPLAIN и план запроса`;
- фильтры по исходным колонкам нужно ставить внутрь подзапроса, до окна, а не после него;
- для top-N по большим разделам `LATERAL` с индексом выигрывает на порядки, и run condition из PG 15 этого не меняет.

## Что стоит ответить на собеседовании

Оконная функция считает значение по набору связанных строк, не схлопывая их, в отличие от `GROUP BY`. `OVER` состоит из `PARTITION BY` (группы), `ORDER BY` (порядок внутри группы) и рамки `ROWS`/`RANGE`/`GROUPS`; при наличии `ORDER BY` рамка по умолчанию — от начала раздела до текущей строки с её peers, поэтому `sum` становится накопительной, а `last_value` без явной рамки возвращает текущую строку. `row_number` даёт уникальные номера, `rank` — одинаковые для равных с пропуском, `dense_rank` — без пропуска. Оконные функции вычисляются после `WHERE`, так что фильтровать по ним можно только во внешнем запросе.

Сильный ответ добавит tie-breaker в сортировку ради детерминированности, разницу `ROWS` и `RANGE` на дублях ключа, стоимость `Sort` под `WindowAgg` и индекс как способ её убрать. В задаче top-N на группу он сравнит `row_number`, `DISTINCT ON` и `LATERAL` с `LIMIT` по индексу `(user_id, created_at DESC)`: первые два проходят всю таблицу, последний читает ровно N записей на пользователя. И упомянет run condition в PG 15, который останавливает вычисление после `rn <= N`, но не избавляет от чтения строк.
