---
title: Базы данных и PostgreSQL
slug: databases-postgresql
role: databases
roleName: Базы данных и PostgreSQL
level: middle
sortOrder: 1
summary: Программа подготовки к этапу по базам данных на собеседовании .NET-бэкендера: SQL-задачи, индексы и планы, транзакции и блокировки в PostgreSQL, работа с БД из EF Core, а в конце продвинутые темы для Senior.
---

# Вступление

Гайд для бэкенд-разработчика на .NET, у которого на собеседовании есть отдельный этап или большой блок по базам данных. Основная часть рассчитана на Middle, последние пять тем помечены «Senior» и нужны тем, кто идёт на Senior или хочет закрыть вопросы «а что будет под нагрузкой».

На этапе БД проверяют три вещи. Первое: умеете ли вы писать SQL руками, без ORM и подсказок IDE, и думать множествами, а не циклами. Второе: понимаете ли, как PostgreSQL выполняет запрос: индексы, план, статистика, MVCC, блокировки. Третье: умеете ли вы работать с базой из приложения так, чтобы не уронить прод: без N+1, с правильными транзакциями, без исчерпания пула соединений.

От Middle ждут:

- написать запрос с джойнами, группировкой, оконной функцией и подзапросом по незнакомой схеме за 5–10 минут;
- прочитать `EXPLAIN (ANALYZE, BUFFERS)` и сказать, почему запрос медленный и какой индекс поможет;
- объяснить уровни изоляции, MVCC и то, откуда берутся deadlock и раздувание таблиц;
- спроектировать небольшую схему: ключи, ограничения, связи, индексы под реальные запросы;
- показать, какой SQL генерирует EF Core, и найти в коде N+1.

От Senior дополнительно ждут понимания WAL и надёжности записи, поведения планировщика на реальных данных, пулинга через PgBouncer, репликации, партиционирования и шардирования, а также опыта эксплуатации: как менять схему большой таблицы и как разбирать инцидент.

**Как пользоваться гайдом**

- Темы идут в порядке изучения: сначала SQL, потом устройство PostgreSQL, потом доступ из .NET, в конце продвинутые темы. SQL-темы не пропускайте даже при большом опыте: на собеседовании ломаются именно на `NULL`, `NOT IN` и `HAVING`.
- В каждой теме сначала пройдите чек-лист «Что нужно знать» и честно отметьте, что можете объяснить вслух. Затем вопросы от простых к сложным, статьи по пробелам, задачи на код.
- Бюджет времени: 2–3 недели при 1–2 часах в день для Middle с живой практикой SQL; 4–5 недель, если вы годами писали только LINQ. Senior-блок добавляет ещё неделю.
- Распределение: примерно 40% времени на написание запросов, 30% на индексы и планы, 20% на транзакции и блокировки, 10% на EF Core.

**Как тренировать написание запросов**

- Поставьте локально PostgreSQL в Docker и заведите учебную схему: `users`, `orders`, `order_items`, `products`, `payments`. Нагенерируйте миллион строк через `generate_series`, чтобы планы были похожи на настоящие.
- Решайте задачи без ORM, в `psql` или любом клиенте. Каждый запрос проверяйте на граничных случаях: пользователь без заказов, `NULL` в колонке, одинаковые значения при сортировке.
- Для каждого написанного запроса смотрите `EXPLAIN ANALYZE`, добавляйте индекс и смотрите снова. Так связь «запрос, индекс, план» запоминается лучше любого конспекта.
- Отрабатывайте шаблоны, которые встречаются почти на каждом интервью: top-N на группу, поиск и удаление дубликатов, накопительная сумма, «клиенты без заказов», вторая по величине зарплата, рекурсивное дерево категорий, keyset-пагинация.
- Проговаривайте решение вслух: «сначала соберу заказы по пользователю, потом отфильтрую через `HAVING`». На этапе SQL интервьюер оценивает рассуждение не меньше, чем результат.

**Какой глубины достаточно**

Для Middle достаточно уровня «объясню механизм и покажу на примере»: почему `UPDATE` в PostgreSQL создаёт новую версию строки, почему индекс не используется при `lower(email) = ...`, почему два встречных обновления дают deadlock. Не нужно помнить формулы стоимости планировщика или формат страниц на диске. Если вопрос уходит глубже, скажите, как бы проверили: «посмотрел бы `pg_stat_user_tables` и время последнего autovacuum».

# Формат собеседования

Этап по базам данных занимает 30–60 минут. Иногда это отдельное интервью, чаще блок внутри технического интервью или часть системного дизайна. Обычно он складывается из нескольких частей.

**1. Задачи на написание SQL, 15–25 минут.** Дают схему из 2–4 таблиц (часто текстом или в общем документе, без возможности запустить) и просят 2–3 запроса возрастающей сложности: джойн с фильтром, агрегат с `HAVING`, затем оконная функция или top-N на группу. Проверяют корректность на граничных случаях, а не синтаксис до запятой. Уточняйте условия до начала: может ли быть `NULL`, нужны ли пользователи без заказов, что делать при равенстве значений.

**2. Вопросы по индексам, планам и транзакциям, 10–20 минут.** «Какой индекс нужен под этот запрос», «почему индекс не используется», «чем отличается Read Committed от Repeatable Read», «что такое MVCC и зачем VACUUM». Идут от простого к сложному до границы ваших знаний.

**3. Разбор медленного запроса, 10–15 минут.** Показывают запрос и план (или просто запрос и размеры таблиц) и спрашивают, что происходит и как ускорить. Хороший ответ идёт по алгоритму: где тратится время, где оценка расходится с фактом, какой индекс или переписывание поможет, как проверить результат.

**4. Проектирование схемы, 10–15 минут.** Спроектировать таблицы под небольшую предметную область: заказы, бронирования, комментарии с вложенностью, учёт остатков. Смотрят на ключи, ограничения, типы данных, связи многие-ко-многим, индексы под заявленные запросы и защиту от гонок (уникальные ограничения, блокировки).

**5. Работа с БД из .NET, 5–15 минут.** EF Core: N+1, `AsNoTracking`, `IQueryable` против `IEnumerable`, транзакции, оптимистичная конкуренция, пул соединений. Часто дают кусок кода и просят найти проблему.

**Пример задачи первой части**

Схема: `users(id, name, created_at)`, `orders(id, user_id, amount, status, created_at)`. Запросы по возрастанию сложности:

```sql
SELECT u.id, u.name, count(o.id) AS orders_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id AND o.status = 'paid'
GROUP BY u.id, u.name;

SELECT user_id, sum(amount) AS total
FROM orders
WHERE created_at >= now() - interval '30 days'
GROUP BY user_id
HAVING sum(amount) > 10000;

SELECT *
FROM (
  SELECT o.*, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
  FROM orders o
) t
WHERE rn <= 3;
```

Ловушки здесь типовые: условие на `status` в `WHERE` превратит `LEFT JOIN` во внутренний, `count(*)` вместо `count(o.id)` даст единицу для пользователя без заказов, сортировка без `id` сделает результат недетерминированным.

**Типичные ошибки**

- Пишут запрос сразу, не уточнив, может ли быть `NULL` и нужны ли строки без пары.
- Решают top-N на группу коррелированными подзапросами и самоджойнами вместо оконной функции.
- Советуют «добавить индекс» без указания колонок, порядка и причины.
- Путают оценку и факт в плане, не смотрят на `rows` и `loops`.
- Называют уровни изоляции по стандарту SQL и не знают, как они реально устроены в PostgreSQL.
- Отвечают про EF Core «как в документации», но не могут сказать, какой SQL уйдёт в базу.

**Как отвечать**

- На SQL-задаче: повторите условие своими словами, назовите граничные случаи, напишите запрос, прогоните его вслух на маленьком примере из 3–4 строк.
- На вопросе про производительность: «сначала измерю, потом гипотеза, потом проверка». Не начинайте с «добавлю индекс».
- На вопросе «что лучше»: называйте критерии (объём данных, соотношение чтения и записи, требования к согласованности) и цену каждого решения.
- Ссылайтесь на практику: «у нас был отчёт на 40 секунд, в плане был Nested Loop с ошибкой оценки в 1000 раз, помог `ANALYZE` и расширенная статистика».

## JOIN и NULL

```yaml
slug: joins-and-null
questions: postgresql-chto-takoe-where, postgresql-chem-inner-join-otlichaetsya-ot-left-join, postgresql-chem-left-join-otlichaetsya-ot-right-join, postgresql-chto-takoe-full-outer-join, postgresql-chto-takoe-cross-join, postgresql-kak-rabotaet-null, postgresql-pochemu-null-null-ne-daet-true, postgresql-chem-coalesce-otlichaetsya-ot-nullif
articles: sql-join-i-null
puzzles:
```

**Что нужно знать**

- Виды соединений: `INNER`, `LEFT`, `RIGHT`, `FULL`, `CROSS`; что попадает в результат при отсутствии пары; почему `RIGHT JOIN` на практике переписывают в `LEFT`.
- Разница условия в `ON` и в `WHERE` для внешнего соединения: фильтр по правой таблице в `WHERE` отбрасывает строки с `NULL` и превращает `LEFT JOIN` в `INNER`.
- Размножение строк: джойн «один ко многим» умножает строки левой таблицы, и `sum` по ней после джойна считается неверно. Лечится агрегацией до соединения или подзапросом.
- Anti-join: «пользователи без заказов» через `LEFT JOIN ... WHERE o.id IS NULL` или `NOT EXISTS`.
- `CROSS JOIN` и `LATERAL`: декартово произведение, генерация сеток дат, «для каждой строки выполнить подзапрос».
- Трёхзначная логика: `TRUE`, `FALSE`, `UNKNOWN`; почему `NULL = NULL` даёт `NULL`, а `WHERE` пропускает только `TRUE`.
- `IS NULL`, `IS DISTINCT FROM`, `COALESCE`, `NULLIF` (классический приём `x / NULLIF(y, 0)`).
- `NULL` в агрегатах (`count(col)` пропускает, `count(*)` нет; `sum` по пустому набору даёт `NULL`), в `ORDER BY` (`NULLS FIRST/LAST`), в уникальных индексах (несколько `NULL` допустимы, с PostgreSQL 15 есть `NULLS NOT DISTINCT`).
- Порядок выполнения запроса: `FROM` и `JOIN`, `WHERE`, `GROUP BY`, `HAVING`, `SELECT`, `ORDER BY`, `LIMIT`.

**На чём валятся**

- Пишут `LEFT JOIN orders o ... WHERE o.status = 'paid'` и теряют пользователей без заказов.
- Сравнивают с `NULL` через `=` и удивляются пустому результату.
- Суммируют по таблице после джойна с позициями заказа и получают завышенную сумму.
- Не могут объяснить, чем `count(*)` отличается от `count(o.id)` после `LEFT JOIN`.

**Потренируйтесь**

- Пользователи, у которых нет ни одного оплаченного заказа (включая пользователей вообще без заказов).
- Список всех дней месяца с выручкой, включая дни без продаж (через `generate_series` и `LEFT JOIN`).

## Группировка, агрегаты и DISTINCT

```yaml
slug: grouping-and-aggregates
questions: postgresql-chto-takoe-group-by, postgresql-chem-where-otlichaetsya-ot-having, postgresql-chto-takoe-distinct, postgresql-chem-union-otlichaetsya-ot-union-all, postgresql-chto-takoe-case
articles: sql-gruppirovka-i-dublikaty
puzzles: postgresql-count-i-null
```

**Что нужно знать**

- `GROUP BY`: каждая колонка в `SELECT` либо в группировке, либо под агрегатом; исключение, когда группируют по первичному ключу (функциональная зависимость).
- `WHERE` фильтрует строки до группировки, `HAVING` группы после неё. Условие без агрегата лучше ставить в `WHERE`: меньше строк уходит в группировку.
- Агрегаты: `count`, `sum`, `avg`, `min`, `max`, `string_agg`, `array_agg`, `bool_or`; поведение на пустом наборе и с `NULL`.
- Условная агрегация: `count(*) FILTER (WHERE status = 'paid')` или `sum(CASE WHEN ... THEN amount END)`; один проход вместо нескольких подзапросов, классический «pivot».
- `DISTINCT` и `DISTINCT ON (...)` в PostgreSQL: «первая строка в каждой группе» по заданной сортировке; цена дедупликации (сортировка или хеш).
- `UNION` против `UNION ALL`: первый убирает дубликаты и стоит сортировки или хеширования, второй просто склеивает. По умолчанию нужен `UNION ALL`.
- `GROUPING SETS`, `ROLLUP`, `CUBE` для итогов и подытогов: знать, что они есть, и уметь написать `ROLLUP`.
- Группировка по выражению: `date_trunc('day', created_at)`, часовые пояса и `timestamptz`.

**На чём валятся**

- Пишут `HAVING status = 'paid'` вместо `WHERE` или пытаются фильтровать агрегат в `WHERE`.
- Лечат размножение строк после джойна через `DISTINCT`, не понимая причины.
- Используют `UNION` там, где дубликатов быть не может, и платят за лишнюю сортировку.
- Считают `avg` по колонке с `NULL` и не понимают, почему знаменатель меньше числа строк.

**Потренируйтесь**

- Для каждого месяца: число заказов, число оплаченных, доля оплаченных в процентах, одним запросом.
- Категории, в которых больше 10 товаров и средняя цена выше 1000.

## Подзапросы и CTE

```yaml
slug: subqueries-and-cte
questions: postgresql-chto-takoe-subquery, postgresql-chto-takoe-correlated-subquery, postgresql-exists-vs-in-chto-vybrat, postgresql-chto-takoe-cte, postgresql-chto-takoe-recursive-cte
articles: sql-podzaprosy-i-cte
puzzles: postgresql-not-in-s-null
```

**Что нужно знать**

- Виды подзапросов: скалярный (одно значение), табличный в `FROM`, в `WHERE` с `IN`, `EXISTS`, `ANY`/`ALL`.
- Коррелированный подзапрос ссылается на внешнюю строку; логически выполняется для каждой строки, но планировщик часто превращает `EXISTS` и `IN` в semi-join.
- `EXISTS` против `IN`: в современном PostgreSQL для положительных условий разницы обычно нет, важна семантика. Для отрицания всегда `NOT EXISTS`: `NOT IN` при хотя бы одном `NULL` в подзапросе возвращает пустой результат.
- `LATERAL`: подзапрос, который видит колонки предыдущих таблиц; удобен для top-N на группу с `LIMIT` и индексом.
- CTE (`WITH`): читаемость, повторное использование, модифицирующие CTE (`WITH deleted AS (DELETE ... RETURNING ...)`).
- Материализация CTE: до PostgreSQL 12 CTE всегда был барьером оптимизации, с 12 нематериализуемый CTE встраивается в запрос; `MATERIALIZED` и `NOT MATERIALIZED` управляют этим явно.
- Рекурсивные CTE: якорная часть, рекурсивная часть, условие остановки; деревья категорий, иерархия сотрудников, защита от циклов (массив пройденного пути или `CYCLE` в PostgreSQL 14+).

**На чём валятся**

- Пишут `WHERE id NOT IN (SELECT user_id FROM bans)`, где `user_id` может быть `NULL`.
- Не могут написать рекурсивный CTE для дерева без подсказки.
- Считают, что CTE всегда материализуется, или наоборот, что всегда встраивается.
- Используют скалярный подзапрос в `SELECT` для каждой строки там, где хватило бы одного джойна с группировкой.

**Потренируйтесь**

- Все подкатегории категории с id = 1 на любую глубину, с уровнем вложенности и путём.
- Товары, которые ни разу не заказывали, тремя способами: `NOT EXISTS`, `LEFT JOIN ... IS NULL`, `EXCEPT`; сравните планы.

## Оконные функции, top-N на группу и дубликаты

```yaml
slug: window-functions
questions: postgresql-chto-takoe-window-functions, postgresql-chem-row-number-rank-i-dense-rank-otlichayutsya, postgresql-kak-poluchit-n-poslednih-zapisei-dlya-kazhdogo-polzovatelya, postgresql-kak-naiti-dublikaty, postgresql-kak-udalit-dublikaty
articles: sql-okonnye-funkcii
puzzles:
```

**Что нужно знать**

- Чем окно отличается от `GROUP BY`: строки не схлопываются, к каждой добавляется вычисленное значение.
- `OVER (PARTITION BY ... ORDER BY ...)`, рамка окна: `ROWS` против `RANGE`, рамка по умолчанию при наличии `ORDER BY` (от начала раздела до текущей строки), отсюда сюрпризы с `last_value`.
- Ранжирование: `ROW_NUMBER` (уникальный номер), `RANK` (с пропусками), `DENSE_RANK` (без пропусков); что выбрать для «топ-3 зарплаты в отделе» при равных значениях.
- Смещения: `LAG`, `LEAD`, `FIRST_VALUE`; разница с предыдущим значением, поиск разрывов и серий.
- Агрегаты в окне: накопительная сумма, скользящее среднее, доля от итога по группе (`amount / sum(amount) OVER (PARTITION BY ...)`).
- Оконную функцию нельзя использовать в `WHERE`: фильтр по номеру строки делается во внешнем запросе или CTE.
- Top-N на группу: `ROW_NUMBER` в подзапросе, `DISTINCT ON` для N = 1, `LATERAL ... LIMIT N` при индексе `(user_id, created_at DESC)`; когда какой вариант быстрее.
- Дубликаты: найти через `GROUP BY ... HAVING count(*) > 1` или `count(*) OVER (PARTITION BY ...)`; удалить, оставив одну строку, через `ROW_NUMBER` и `DELETE ... WHERE id IN (...)` или `ctid`; затем добавить уникальное ограничение, чтобы дубликаты не появились снова.

**На чём валятся**

- Пытаются написать `WHERE row_number() OVER (...) <= 3`.
- Сортируют окно по неуникальному ключу и получают недетерминированный результат.
- Удаляют дубликаты, не определив, какую именно строку оставить, и не закрывают причину ограничением.
- Не знают про рамку окна и получают неверный `last_value`.

**Потренируйтесь**

- Три последних заказа каждого пользователя двумя способами: `ROW_NUMBER` и `LATERAL`.
- Вторая по величине зарплата в каждом отделе с учётом равных зарплат.
- Для каждого дня выручка, выручка предыдущего дня и накопительный итог с начала месяца.

## Пагинация

```yaml
slug: pagination
questions: postgresql-kak-rabotaet-order-by, postgresql-kak-realizovat-pagination, postgresql-offset-limit-vs-keyset-pagination, postgresql-v-kakom-poryadke-vybirat-kolonki-dlya-composite-index
articles: pg-paginaciya
puzzles: postgresql-paginaciya-bez-order-by
```

**Что нужно знать**

- Без `ORDER BY` порядок строк не гарантирован: он может меняться между запросами, после `VACUUM`, при параллельном плане.
- Сортировка должна быть детерминированной: при неуникальном ключе (`created_at`) добавляйте уникальный тай-брейкер (`id`), иначе строки дублируются и теряются между страницами.
- `OFFSET/LIMIT`: просто и позволяет прыгать на любую страницу, но база читает и отбрасывает все `OFFSET` строк, а вставки между запросами сдвигают страницы.
- Keyset (seek) пагинация: `WHERE (created_at, id) < (@lastCreatedAt, @lastId) ORDER BY created_at DESC, id DESC LIMIT 20`; стабильна и одинаково быстра на любой глубине, но не умеет «перейти на страницу 50».
- Индекс под keyset: составной индекс в том же порядке и направлении, что и `ORDER BY`; сравнение кортежей `(a, b) < (x, y)` использует его целиком.
- Общее число строк: `count(*)` по большой таблице дорог; варианты: не показывать, показывать оценку, считать отдельно и кешировать.
- Курсор для API: непрозрачный токен с последними значениями ключа, а не номер страницы.
- В EF Core: `Skip/Take` превращается в `OFFSET/LIMIT`, keyset пишется через `Where` по ключу и `OrderBy(...).ThenBy(...)`.

**На чём валятся**

- Пагинируют без `ORDER BY` или с сортировкой только по неуникальной колонке.
- Не объясняют, почему страница 10 000 через `OFFSET` медленная, хотя на ней те же 20 строк.
- Строят keyset по `created_at` без тай-брейкера.
- Создают индекс `(id, created_at)` под сортировку `created_at, id`.

## Проектирование схемы и изменения в продакшене

```yaml
slug: schema-design
questions: postgresql-chto-takoe-postgresql, system-design-sql-vs-nosql, ef-core-chto-takoe-migrations, ef-core-kak-rabotayut-ef-core-migrations, ef-core-kakie-podvodnye-kamni-u-global-query-filters-pri-soft-delete-i-multi-tenancy, advanced-postgresql-kak-bezopasno-sozdat-indeks-na-bolshoi-tablice-v-prodakshene, advanced-postgresql-kak-menyat-shemu-bolshoi-tablicy-ne-blokiruya-zapis-nadolgo
articles: ef-migracii
puzzles:
```

**Что нужно знать**

- Нормальные формы на практическом уровне: 1НФ (атомарные значения, без списков в строке), 2НФ и 3НФ (нет зависимостей от части ключа и транзитивных зависимостей). Главное: каждый факт хранится в одном месте.
- Осознанная денормализация: счётчики, снимок цены в позиции заказа, материализованные агрегаты. Цена: нужно поддерживать согласованность триггером, кодом или пересчётом.
- Ключи: суррогатный (`bigint GENERATED ALWAYS AS IDENTITY`, UUID) против естественного; UUID v4 против UUID v7 для B-tree (локальность вставки); `serial` устарел в пользу identity.
- Ограничения: `PRIMARY KEY`, `FOREIGN KEY` (и индекс на ссылающейся колонке, который PostgreSQL сам не создаёт), `UNIQUE`, `CHECK`, `NOT NULL`, `EXCLUDE` для непересекающихся интервалов. Ограничение в базе надёжнее проверки в коде при конкурентных запросах.
- Связи: один ко многим, многие ко многим через таблицу связей с составным ключом, иерархии (список смежности, materialized path, `ltree`).
- Типы данных: `timestamptz` вместо `timestamp`, `numeric` для денег, `text` вместо `varchar(n)` без причины, `jsonb` для действительно динамических атрибутов.
- Мягкое удаление и мультиарендность: колонки `deleted_at` и `tenant_id`, частичные уникальные индексы `WHERE deleted_at IS NULL`, global query filters в EF Core.
- Миграции: EF Core migrations, SQL-скрипты на деплое, а не `Migrate()` при старте нескольких инстансов; обратная совместимость схемы со старой версией кода (expand and contract).
- Опасные операции: `ALTER TABLE` берёт `ACCESS EXCLUSIVE`, и очередь за ним блокирует даже чтение; `CREATE INDEX CONCURRENTLY`, `ADD CONSTRAINT ... NOT VALID` и отдельный `VALIDATE`, короткий `lock_timeout`, добавление колонки с константным default без перезаписи таблицы (с PostgreSQL 11).
- Когда PostgreSQL, а когда другое хранилище: транзакции и связи против гибкой схемы и горизонтального масштабирования.

**На чём валятся**

- Забывают индекс на внешнем ключе и получают медленные джойны и блокировки при удалении родителя.
- Хранят деньги во `float` и время без часового пояса.
- Защищают уникальность проверкой `if (!exists) insert` в коде вместо уникального индекса.
- Предлагают `ALTER TABLE` на таблице в 500 млн строк в рабочее время без понимания блокировок.

## Индексы

```yaml
slug: indexes
questions: postgresql-kakie-tipy-indeksov-est-v-postgresql, postgresql-chto-takoe-b-tree-index, postgresql-chto-takoe-composite-index, postgresql-kogda-b-tree-indeks-ne-pomogaet, postgresql-chto-takoe-partial-index, postgresql-chto-takoe-expression-index, postgresql-chto-takoe-brin
articles: indeksy-btree-gin-brin
puzzles: postgresql-like-s-vedushchim-procentom
```

**Что нужно знать**

- B-tree: равенство, диапазоны, сортировка, префиксный `LIKE`; сложность поиска, почему индекс ускоряет `ORDER BY ... LIMIT`.
- Составной индекс: правило левого префикса, порядок колонок (сначала равенство, потом диапазон, потом сортировка), направление сортировки в индексе.
- Покрывающий индекс и Index Only Scan: `INCLUDE`, зависимость от visibility map и, значит, от VACUUM.
- Частичный индекс: `WHERE status = 'pending'` для маленького горячего подмножества, частичный уникальный индекс.
- Индекс по выражению: `lower(email)`, `date_trunc`; запрос должен содержать ровно то же выражение.
- Когда B-tree не помогает: функция над колонкой, неявное приведение типов, `LIKE '%x'`, низкая селективность, `OR` по разным колонкам, маленькая таблица.
- Другие типы: GIN (JSONB, массивы, полнотекстовый поиск, триграммы), GiST (геоданные, диапазоны, исключающие ограничения), BRIN (огромные таблицы, физически упорядоченные по времени), Hash.
- Цена индекса: замедление `INSERT/UPDATE/DELETE`, место на диске, потеря HOT-обновлений при индексировании изменяемой колонки, лишняя нагрузка на WAL и VACUUM.
- Поиск лишних и недостающих индексов: `pg_stat_user_indexes` (`idx_scan = 0`), `pg_stat_user_tables` (`seq_scan` на большой таблице).

**На чём валятся**

- Создают по индексу на каждую колонку вместо одного составного под реальный запрос.
- Ставят в составном индексе диапазонную колонку первой.
- Не понимают, почему индекс по `email` не работает для `WHERE lower(email) = ...`.
- Не называют цену индекса для записи.

## EXPLAIN и разбор медленного запроса

```yaml
slug: explain-and-slow-queries
questions: postgresql-chto-takoe-explain, postgresql-chto-takoe-explain-analyze, postgresql-chto-takoe-sequential-scan, postgresql-chto-takoe-index-scan, postgresql-chto-takoe-bitmap-index-scan, postgresql-chto-takoe-selectivity-cardinality, postgresql-chto-takoe-analyze, postgresql-pochemu-postgresql-inogda-ne-ispolzuet-indeks, postgresql-kak-naiti-dolgie-zaprosy, postgresql-kak-optimizirovat-medlennyi-sql-zapros
articles: explain-i-plan-zaprosa
puzzles:
```

**Что нужно знать**

- `EXPLAIN` показывает план и оценки, `EXPLAIN ANALYZE` выполняет запрос и добавляет фактическое время и строки; `BUFFERS` показывает чтения из кэша и с диска. `ANALYZE` на `UPDATE` или `DELETE` реально меняет данные, оборачивайте в транзакцию с откатом.
- Как читать план: дерево снизу вверх и изнутри наружу; `cost=startup..total`, `rows` (оценка) против `actual rows`, `loops` (фактические строки и время указаны на одну итерацию).
- Сканирования: Seq Scan, Index Scan, Index Only Scan, Bitmap Index Scan с Bitmap Heap Scan; когда планировщик предпочитает каждый.
- Соединения: Nested Loop (мало строк снаружи и индекс внутри), Hash Join (большие наборы, равенство), Merge Join (оба входа отсортированы).
- Признаки проблем: расхождение оценки и факта на порядки, Nested Loop с тысячами `loops`, `Sort Method: external merge` (не хватило `work_mem`), `Rows Removed by Filter` в миллионы, большие `shared read`.
- Селективность и статистика: почему планировщик выбирает Seq Scan при выборке 30% таблицы, роль `ANALYZE` и устаревшей статистики после массовой загрузки.
- Поиск медленных запросов: `pg_stat_statements` (суммарное время, среднее, число вызовов), `log_min_duration_statement`, `auto_explain`, `pg_stat_activity` для того, что выполняется сейчас.
- Алгоритм оптимизации: найти запрос по суммарному времени, снять план с `ANALYZE, BUFFERS`, найти узел, где тратится время, проверить гипотезу (индекс, переписывание, статистика, меньше колонок), перемерить на реальных объёмах.

**На чём валятся**

- Смотрят только на `cost` и не сравнивают оценку с фактом.
- Забывают умножать время узла на `loops`.
- Оптимизируют запрос, который выполняется раз в сутки, вместо того, что вызывается 10 000 раз в минуту.
- Проверяют план на пустой локальной базе и делают выводы для прода.

## Транзакции и уровни изоляции

```yaml
slug: transactions-and-isolation
questions: postgresql-chto-takoe-transaction, postgresql-kakie-urovni-izolyacii-tranzakcii-suschestvuyut, postgresql-chto-takoe-dirty-read, postgresql-chto-takoe-non-repeatable-read, postgresql-chto-takoe-phantom-read, postgresql-chto-takoe-read-committed, postgresql-chto-takoe-repeatable-read, postgresql-chto-takoe-serializable, ef-core-chto-takoe-transaction-v-ef-core, ef-core-kak-vruchnuyu-otkryt-transaction, advanced-postgresql-chem-otlichayutsya-urovni-izolyacii-na-praktike-i-kakie-anomalii-ostay
articles: pg-urovni-izolyacii, ef-tranzakcii-i-urovni-izolyacii
puzzles:
```

**Что нужно знать**

- ACID: что даёт каждая буква и какой механизм PostgreSQL за ней стоит (WAL для durability, MVCC и блокировки для isolation).
- Аномалии: dirty read, non-repeatable read, phantom read, lost update, write skew; на примере из двух транзакций.
- Уровни в PostgreSQL: `Read Committed` по умолчанию (снимок на каждый оператор), `Repeatable Read` (снимок на всю транзакцию, это snapshot isolation), `Serializable` (SSI, отслеживает опасные зависимости). `Read Uncommitted` ведёт себя как `Read Committed`, dirty read невозможен.
- Lost update на Read Committed: «прочитал, посчитал в коде, записал». Защита: атомарный `UPDATE ... SET balance = balance - 100`, `SELECT ... FOR UPDATE`, оптимистичная блокировка, более строгий уровень.
- Write skew на Repeatable Read: два врача снимаются с дежурства одновременно. Защищает только `Serializable` или явная блокировка.
- На `Repeatable Read` и `Serializable` транзакция может упасть с `40001 serialization_failure`, и приложение обязано её повторить целиком.
- Транзакции в EF Core: `SaveChanges` атомарен сам по себе, `BeginTransaction` для нескольких вызовов, `TransactionScope` и его ограничения, execution strategy и ретраи вместе с ручной транзакцией.
- Короткие транзакции: внешние HTTP-вызовы и ожидание пользователя внутри транзакции держат блокировки и мешают VACUUM.

**На чём валятся**

- Пересказывают таблицу аномалий из стандарта SQL и утверждают, что на Repeatable Read в PostgreSQL возможен phantom read.
- Не знают, какой уровень стоит по умолчанию.
- Включают `Serializable` и не пишут ретраи.
- Открывают транзакцию и внутри ходят во внешний сервис.

## MVCC и VACUUM

```yaml
slug: mvcc-and-vacuum
questions: postgresql-chto-takoe-mvcc, postgresql-chto-takoe-vacuum, postgresql-chto-takoe-autovacuum, advanced-postgresql-kak-ustroen-mvcc-v-postgresql-i-pochemu-update-sozdaet-novuyu-versiyu, advanced-postgresql-chto-takoe-bloat-tablic-i-indeksov-kak-ego-obnaruzhit-i-ubrat, advanced-postgresql-pochemu-autovacuum-ne-uspevaet-i-kak-ego-nastraivat-pod-vysokuyu-nagru, advanced-postgresql-chto-takoe-transaction-id-wraparound-i-chem-on-ugrozhaet-prodakshenu
articles: mvcc-i-vacuum
puzzles:
```

**Что нужно знать**

- MVCC: каждая версия строки хранит `xmin` и `xmax`; транзакция видит версии согласно своему снимку. Поэтому читатели не блокируют писателей и наоборот.
- `UPDATE` в PostgreSQL это вставка новой версии и пометка старой как удалённой; `DELETE` только помечает. Мёртвые версии остаются на месте до очистки.
- HOT-обновление: если не меняются индексированные колонки и на странице есть место, индексы не трогаются; `fillfactor` помогает.
- `VACUUM` освобождает место от мёртвых версий для повторного использования, обновляет visibility map и замораживает старые `xid`. Файл таблицы он не уменьшает, это делает `VACUUM FULL` (с полной блокировкой) или `pg_repack`.
- `autovacuum`: пороги срабатывания (`autovacuum_vacuum_scale_factor` по умолчанию 20% таблицы), почему для больших таблиц их уменьшают точечно.
- Bloat: признаки (рост размера при постоянном числе строк, медленные сканирования), диагностика через `pg_stat_user_tables` (`n_dead_tup`, `last_autovacuum`) и `pgstattuple`.
- Главный враг VACUUM: долгие транзакции и `idle in transaction`, в том числе на реплике с `hot_standby_feedback`. Пока они открыты, мёртвые версии нельзя удалить.
- Transaction ID wraparound: 32-битный счётчик транзакций, заморозка, аварийный режим при приближении к пределу.
- `ANALYZE` отдельно от `VACUUM`: обновляет статистику для планировщика.

**На чём валятся**

- Считают, что `VACUUM` возвращает место операционной системе.
- Не связывают раздувание таблицы с висящей транзакцией в соседнем сервисе.
- Отключают autovacuum «потому что мешает» на нагруженной таблице.
- Не могут объяснить, почему частый `UPDATE` одной строки-счётчика плохо сказывается на таблице.

## Блокировки, deadlock и конкурентные обновления

```yaml
slug: locks-and-deadlocks
questions: postgresql-chto-takoe-row-level-lock, postgresql-chto-takoe-table-level-lock, postgresql-kak-voznikaet-deadlock-v-postgresql, postgresql-kak-diagnostirovat-deadlock, postgresql-chto-takoe-pg-stat-activity, postgresql-chto-takoe-pg-locks, ef-core-kak-rabotaet-optimistic-concurrency, ef-core-chto-takoe-concurrency-token, ef-core-kak-obrabatyvat-dbupdateconcurrencyexception, advanced-postgresql-kogda-stoit-vybrat-select-for-update-a-kogda-optimistichnuyu-blokirovk, advanced-postgresql-pochemu-deadlock-voznikaet-pri-obnovlenii-v-raznom-poryadke-i-kak-etog, advanced-postgresql-kak-diagnostirovat-blokirovki-i-naiti-zapros-derzhaschii-ih
articles: pg-blokirovki-i-deadlock, ef-optimistichnaya-blokirovka
puzzles:
```

**Что нужно знать**

- Блокировки строк: `UPDATE` и `DELETE` блокируют изменяемые строки до конца транзакции; явные `SELECT ... FOR UPDATE`, `FOR NO KEY UPDATE`, `FOR SHARE`. Обычный `SELECT` строки не блокирует.
- `NOWAIT` и `SKIP LOCKED`: очередь задач в таблице, когда несколько обработчиков разбирают строки без конкуренции.
- Табличные блокировки: режимы от `ACCESS SHARE` до `ACCESS EXCLUSIVE`, какие команды что берут; почему `ALTER TABLE` в очереди блокирует все последующие запросы.
- Deadlock: две транзакции ждут друг друга; PostgreSQL обнаруживает цикл через `deadlock_timeout` и откатывает одну из них. Профилактика: единый порядок обновления (например, по возрастанию id), короткие транзакции, меньше строк в одной транзакции.
- Диагностика: `pg_stat_activity` (`wait_event`, `state`, `xact_start`), `pg_locks`, функция `pg_blocking_pids()`, сообщение о deadlock в логе сервера с текстами запросов.
- Advisory locks: `pg_advisory_xact_lock` для синхронизации по произвольному ключу, например чтобы фоновую задачу выполнял один инстанс.
- Пессимистичная блокировка против оптимистичной: `FOR UPDATE` при высокой конкуренции за строку и коротких операциях, версия строки при редких конфликтах и длинных пользовательских сценариях.
- Оптимистичная конкуренция в EF Core: concurrency token, в PostgreSQL обычно системная колонка `xmin` через Npgsql; `UPDATE ... WHERE id = @id AND xmin = @old`, ноль затронутых строк превращается в `DbUpdateConcurrencyException`; стратегии обработки (повтор, слияние, ошибка пользователю).

**На чём валятся**

- Считают, что `SELECT` в транзакции защищает прочитанную строку от изменения.
- Не могут объяснить, почему два параллельных перевода денег между одними и теми же счетами дают deadlock.
- Ловят `DbUpdateConcurrencyException` и молча перезаписывают чужие изменения.
- Не знают, как найти, кто держит блокировку, кроме перезапуска сервиса.

## JSONB и полнотекстовый поиск

```yaml
slug: jsonb-and-full-text
questions: postgresql-chto-takoe-jsonb, postgresql-json-vs-jsonb, postgresql-chto-takoe-gin, postgresql-kak-indeksirovat-jsonb, postgresql-chto-takoe-gist
articles: pg-jsonb, polnotekstovyy-poisk
puzzles: postgresql-like-s-vedushchim-procentom
```

**Что нужно знать**

- `json` хранит текст как есть, `jsonb` хранит разобранное бинарное представление: быстрее запросы, есть индексы, но теряются порядок ключей и дубликаты.
- Операторы: `->` и `->>`, `#>`, `@>` (содержит), `?` (есть ключ), `jsonb_path_query`; функции `jsonb_set`, `jsonb_agg`, `jsonb_build_object`.
- Индексы: GIN с `jsonb_ops` (все операторы) и `jsonb_path_ops` (только `@>`, компактнее); B-tree по выражению `(data->>'status')` для одного частого поля.
- Когда JSONB уместен: динамические атрибуты, внешние payload, настройки. Когда нет: поля, по которым фильтруют, джойнят и которые нужно ограничивать; тогда это колонки.
- Цена: обновление одного ключа переписывает весь документ, большие документы уходят в TOAST, статистика по полям внутри JSONB слабая.
- Полнотекстовый поиск: `tsvector`, `tsquery`, `to_tsvector('russian', ...)`, словари и стемминг, ранжирование `ts_rank`, генерируемая колонка `tsvector` с GIN-индексом.
- Подстрочный поиск: `LIKE '%x%'` и `ILIKE` ускоряются триграммным индексом `pg_trgm` (GIN или GiST), а не B-tree.
- GIN против GiST: GIN быстрее на чтение и медленнее на запись (`fastupdate`, pending list), GiST компактнее и универсальнее (геоданные, диапазоны).
- Маппинг в EF Core через Npgsql: `jsonb`-колонки в owned-типы или `JsonDocument`, трансляция запросов к полям.

**На чём валятся**

- Складывают в JSONB всё подряд и потом фильтруют по полям без индекса.
- Ждут, что индекс GIN поможет запросу `data->>'status' = 'x'` (для него нужен `@>` или индекс по выражению).
- Делают поиск по названию товара через `ILIKE '%...%'` по миллионам строк без триграмм.
- Не знают разницы `json` и `jsonb`.

## Функции, процедуры и представления

```yaml
slug: functions-procedures-views
questions: postgresql-chto-takoe-postgresql-function, postgresql-chto-takoe-stored-procedure, postgresql-function-vs-procedure, postgresql-kogda-stoit-ispolzovat-pl-pgsql, postgresql-view-vs-materialized-view, postgresql-chto-takoe-materialized-view
articles: pg-funkcii-procedury-view
puzzles:
```

**Что нужно знать**

- Функция (`CREATE FUNCTION`) возвращает значение или набор и вызывается в `SELECT`; процедура (`CREATE PROCEDURE`, PostgreSQL 11+) вызывается через `CALL` и может управлять транзакцией (`COMMIT` внутри).
- Языки: SQL-функции (могут встраиваться планировщиком), PL/pgSQL (переменные, циклы, исключения), категории изменчивости `IMMUTABLE`, `STABLE`, `VOLATILE` и их влияние на индексы по выражению и оптимизацию.
- `SECURITY DEFINER` и риски, `search_path`.
- Когда логику держать в базе: атомарные операции над данными рядом с ними, массовые преобразования, триггеры аудита. Когда нет: бизнес-правила, которые часто меняются, сложно тестировать и версионировать.
- Триггеры: `BEFORE` и `AFTER`, на строку и на оператор; скрытая цена на каждой записи и неочевидность для команды.
- Представление (`VIEW`) это сохранённый запрос без данных, раскрывается в запрос при выполнении. Материализованное представление хранит результат, обновляется через `REFRESH MATERIALIZED VIEW`, вариант `CONCURRENTLY` требует уникального индекса.
- Вызов из .NET: `FromSql` и `SqlQuery` в EF Core, Dapper; маппинг представлений как keyless-сущностей.
- Версионирование: функции и представления живут в миграциях, как и таблицы.

**На чём валятся**

- Не отличают функцию от процедуры и не знают про управление транзакцией.
- Помечают функцию `IMMUTABLE`, хотя она читает таблицу или зависит от часового пояса.
- Считают, что обычное представление ускоряет запрос.
- Не знают, что `REFRESH` без `CONCURRENTLY` блокирует чтение представления.

## EF Core: загрузка данных и N+1

```yaml
slug: ef-core-loading
questions: ef-core-kak-rabotaet-dbcontext, ef-core-kak-rabotaet-change-tracking, ef-core-kogda-ispolzovat-asnotracking, ef-core-chem-ienumerable-otlichaetsya-ot-iqueryable-v-ef-core, ef-core-chem-eager-lazy-i-explicit-loading-otlichayutsya, ef-core-chto-takoe-problema-n-1, ef-core-kak-obnaruzhit-i-ispravit-n-1, ef-core-chto-takoe-projection-cherez-select, ef-core-pochemu-projection-chasto-luchshe-include, ef-core-kak-posmotret-sql-kotoryi-generiruet-ef-core, ef-core-kak-vybrat-mezhdu-single-query-i-split-query-pri-zagruzke-neskolkih-kollekcii-i, ef-core-kak-optimizirovat-medlennyi-ef-core-zapros
articles: ef-changetracker, zagruzka-svyazey-i-n-plus-1, translyaciya-iqueryable-v-sql
puzzles: ef-core-n-plus-1-lazy-loading, ef-core-ienumerable-vmesto-iqueryable, ef-core-trekking-povtornyj-zapros, ef-core-dbcontext-singleton
```

**Что нужно знать**

- `DbContext`: Unit of Work, identity map и change tracker; короткоживущий, не потокобезопасный, `Scoped` в DI. Повторный запрос всё равно идёт в базу, но вернёт уже отслеживаемые экземпляры.
- Change tracking: состояния сущностей, снимки исходных значений, цена при тысячах сущностей; `AsNoTracking` для чтения, `AsNoTrackingWithIdentityResolution`.
- `IQueryable` против `IEnumerable`: где выполняется фильтр. `ToList()` или `AsEnumerable()` до `Where` переносит фильтрацию в память приложения.
- Загрузка связей: `Include` и `ThenInclude`, explicit loading, lazy loading и почему его лучше не включать в веб-приложении.
- N+1: как возникает (lazy loading или обращение к навигации в цикле), как найти (логи SQL, счётчик команд на запрос, APM), как исправить (`Include`, проекция, один запрос с группировкой).
- Проекция через `Select` в DTO: только нужные колонки, нет трекинга, часто эффективнее `Include`.
- Декартов взрыв при нескольких `Include` коллекций: `AsSplitQuery` решает его ценой нескольких запросов и возможной несогласованности между ними. Это лечение взрыва строк, а не N+1.
- Как посмотреть SQL: `ToQueryString()`, `LogTo`, категория логов `Microsoft.EntityFrameworkCore.Database.Command`; `EnableSensitiveDataLogging` только для разработки.
- Связь с прошлыми темами: каждый LINQ-запрос это SQL, у которого есть план и который должен попадать в индекс.

**На чём валятся**

- Не видят N+1 в цикле по `order.Customer.Name` и не могут доказать его числом запросов.
- Лечат N+1 пятью `Include` и получают миллион строк из-за декартова произведения.
- Возвращают `IEnumerable<T>` из репозитория и фильтруют в памяти.
- Регистрируют `DbContext` как `Singleton` или используют его из нескольких потоков.

## EF Core: производительность, массовые операции и сырой SQL

```yaml
slug: ef-core-performance
questions: ef-core-chto-takoe-connection-pooling, ef-core-kak-ustroen-pul-dbcontext-i-chto-lomaetsya-pri-perehode-na-adddbcontextpool, ef-core-chto-takoe-compiled-query, ef-core-kogda-compiled-queries-polezny, ef-core-kak-ef-core-keshiruet-translyaciyu-linq-zaprosov-i-pochemu-konstanty-i-contains, ef-core-chto-obhodyat-executeupdate-i-executedelete-i-kak-sovmeschat-ih-s-otslezhivaemym, ef-core-chto-takoe-raw-sql-v-ef-core, ef-core-kogda-ispolzovat-dapper-vmesto-ef-core, ef-core-kak-izbezhat-sql-injection-pri-ispolzovanii-dapper
articles: ef-proizvoditelnost-zaprosov, ef-dbcontext-pooling-i-query-filters, kogda-orm-meshaet
puzzles:
```

**Что нужно знать**

- Два разных пула: пул соединений Npgsql (физические соединения с базой, по умолчанию `Maximum Pool Size=100`) и пул экземпляров `DbContext` (`AddDbContextPool`, экономит аллокации). Что ломается при пуле контекстов: состояние в полях контекста, внедрённые scoped-зависимости.
- Исчерпание пула соединений: долгие транзакции, синхронные вызовы, забытые `Dispose`, слишком много инстансов на один сервер БД. Симптом: таймаут получения соединения, а не медленный SQL.
- Кеш трансляции запросов: одинаковая форма LINQ переиспользует план; константы в выражении и `Contains` по меняющемуся списку плодили новые SQL до EF Core 8, с EF Core 8 список передаётся одним параметром-массивом (`= ANY(@p)` в Npgsql).
- Скомпилированные запросы (`EF.CompileAsyncQuery`): когда дают выигрыш (горячий путь, частые простые запросы), а когда нет.
- Массовые операции: `ExecuteUpdate` и `ExecuteDelete` одним SQL без загрузки сущностей; они обходят change tracker и интерцепторы `SaveChanges`. Массовая вставка: батчинг `SaveChanges`, `COPY` через Npgsql (`BeginBinaryImport`).
- Сырой SQL: `FromSql` с интерполяцией параметризуется, `FromSqlRaw` с конкатенацией это SQL-инъекция; `SqlQuery<T>` для DTO.
- Dapper: тяжёлые отчёты, сложный SQL с оконными функциями и CTE, критичная латентность. Параметры только через объект параметров, никогда через строковую конкатенацию.
- Совмещение подходов в одном сервисе: EF Core для команд и бизнес-логики, Dapper или сырой SQL для отчётов и чтения.

**На чём валятся**

- Путают пул соединений и пул `DbContext`.
- Подставляют значения в `FromSqlRaw` через `$"..."` или конкатенацию.
- Загружают 100 000 сущностей, чтобы поменять одно поле, вместо `ExecuteUpdate`.
- Не могут объяснить, почему после деплоя второго инстанса появились таймауты получения соединения.

## Senior: WAL, checkpoint и надёжность записи

```yaml
slug: senior-wal-and-checkpoint
questions: advanced-postgresql-kak-rabotaet-wal-i-kak-on-vliyaet-na-skorost-zapisi, advanced-postgresql-chto-proishodit-vo-vremya-checkpoint-i-pochemu-latency-periodicheski-p, advanced-postgresql-kak-nastroiki-synchronous-commit-vliyayut-na-nadezhnost-i-proizvoditel, advanced-postgresql-kak-udalit-milliony-strok-ne-zablokirovav-tablicu-i-ne-razduv-wal
articles: pg-wal-i-checkpoint
puzzles:
```

**Что нужно знать**

- WAL (write-ahead log): любое изменение сначала пишется в журнал, коммит считается надёжным после `fsync` журнала, а страницы данных записываются на диск позже. Отсюда durability и основа репликации.
- Checkpoint: сброс грязных страниц на диск и точка, с которой начнётся восстановление после сбоя; `checkpoint_timeout`, `max_wal_size`, `checkpoint_completion_target`.
- Full page writes: после checkpoint первое изменение страницы пишет её целиком в WAL; поэтому частые checkpoint раздувают WAL, а редкие удлиняют восстановление.
- Периодические всплески латентности: агрессивные checkpoint, мало `max_wal_size`, медленный диск; диагностика через `pg_stat_bgwriter` или `pg_stat_checkpointer` (PostgreSQL 17) и логи `log_checkpoints`.
- `synchronous_commit`: `on`, `off` (риск потерять последние транзакции, но не повредить базу), `remote_write`, `remote_apply` для синхронной репликации; можно менять на уровне транзакции для некритичных записей.
- Групповой коммит и почему много мелких транзакций дороже одной пачки.
- Массовые изменения: удаление и обновление батчами по первичному ключу, пауза между батчами, наблюдение за лагом реплик; `DROP` или `DETACH` партиции вместо `DELETE`.
- Нежурналируемые таблицы (`UNLOGGED`) для временных данных и их цена при сбое.

**На чём валятся**

- Считают, что коммит означает запись страницы таблицы на диск.
- Выключают `synchronous_commit` глобально ради скорости, не оценив риск потери данных.
- Удаляют миллионы строк одной командой и кладут реплики.
- Не связывают пилообразную латентность записи с checkpoint.

## Senior: статистика планировщика и запросы под нагрузкой

```yaml
slug: senior-planner-statistics
questions: advanced-postgresql-pochemu-indeks-mozhet-ne-ispolzovatsya-hotya-on-podhodit-pod-uslovie-z, advanced-postgresql-kak-planirovschik-ocenivaet-stoimost-plana-i-pochemu-oshibaetsya-na-ko, advanced-postgresql-kak-rasshirennaya-statistika-pomogaet-planirovschiku-i-kogda-ee-stoit, advanced-postgresql-chto-delat-esli-postgresql-vnezapno-pereshel-s-index-scan-na-seq-scan, advanced-postgresql-kak-naiti-i-optimizirovat-zapros-kotoryi-stal-medlennym-tolko-pod-nagr
articles: pg-statistika-i-zaprosy-pod-nagruzkoy
puzzles:
```

**Что нужно знать**

- Модель стоимости: `seq_page_cost`, `random_page_cost` (на SSD его снижают), `cpu_tuple_cost`, `effective_cache_size`; стоимость это условные единицы, а не миллисекунды.
- Статистика по колонкам: `pg_stats` (`n_distinct`, most common values, гистограмма, `correlation`), `default_statistics_target` и его увеличение для конкретной колонки.
- Почему оценки ошибаются: коррелированные условия (город и страна) перемножаются как независимые, функции и выражения, JSONB, параметры с перекошенным распределением.
- Расширенная статистика: `CREATE STATISTICS` с `dependencies`, `ndistinct`, `mcv` для связанных колонок.
- Prepared statements и generic plan: после пяти выполнений PostgreSQL может перейти на общий план, плохой для редкого значения; `plan_cache_mode`. Актуально для Npgsql, который готовит запросы.
- Резкий переход с Index Scan на Seq Scan: рост таблицы, устаревшая статистика после массовой загрузки, изменение распределения данных, bloat, изменение параметров.
- Запросы, медленные только под нагрузкой: ожидание блокировок, конкуренция за `LWLock` и буферы, исчерпание соединений, вытеснение из кэша, `work_mem` на множестве параллельных сессий. Смотреть `wait_event` в `pg_stat_activity`, а не только план.
- Инструменты: `pg_stat_statements` (включая `shared_blks_read`), `auto_explain` с `log_min_duration`, сравнение планов до и после.

**На чём валятся**

- Лечат плохой план ручными настройками `enable_seqscan = off` в проде.
- Не знают, что планировщик считает условия независимыми.
- Ищут причину деградации только в плане, игнорируя ожидания и блокировки.
- Не связывают проблему «медленно только у одного клиента» с generic plan и перекосом данных.

## Senior: пул соединений и PgBouncer

```yaml
slug: senior-connection-pooling
questions: postgresql-chto-takoe-connection-pool, postgresql-kak-rabotaet-connection-pooling-v-postgresql-npgsql, ef-core-kak-ef-core-rabotaet-s-connection-pool, advanced-postgresql-zachem-nuzhen-pgbouncer-i-kakie-vozmozhnosti-postgresql-lomaet-transac
articles: pg-pul-soedineniy-i-pgbouncer
puzzles:
```

**Что нужно знать**

- Каждое соединение PostgreSQL это отдельный процесс с собственной памятью; сотни активных соединений означают конкуренцию за CPU и блокировки, а не рост пропускной способности. Оптимальное число активных запросов близко к числу ядер, умноженному на небольшой коэффициент.
- Пул на стороне клиента (Npgsql) работает в рамках одного процесса приложения: десять подов по 100 соединений это до 1000 соединений к базе.
- PgBouncer: режимы `session`, `transaction`, `statement`; transaction mode даёт максимальное мультиплексирование.
- Что ломает transaction mode: session-level `SET`, advisory locks уровня сессии, `LISTEN/NOTIFY`, временные таблицы между транзакциями, серверные prepared statements (в Npgsql это auto-prepare и `Max Auto Prepare`; PgBouncer 1.21+ умеет отслеживать протокольные prepared statements).
- Настройки Npgsql: `Maximum Pool Size`, `Minimum Pool Size`, `Connection Idle Lifetime`, `No Reset On Close`, multiplexing; расчёт пула от числа инстансов и лимита `max_connections`.
- Симптомы проблем: таймаут получения соединения в приложении, очередь клиентов в `SHOW POOLS`, много `idle in transaction` в `pg_stat_activity`.
- Альтернативы и дополнения: Odyssey, PgCat, встроенный пулинг управляемых облачных баз; отдельные пулы для OLTP и отчётов.

**На чём валятся**

- Увеличивают `max_connections` до тысяч вместо пулера.
- Включают transaction mode и ловят странные ошибки prepared statements и потерянные `SET`.
- Не учитывают число инстансов приложения при расчёте пула.
- Не отличают нехватку соединений от медленных запросов.

## Senior: репликация и партиционирование

```yaml
slug: senior-replication-and-partitioning
questions: system-design-chto-takoe-replication, advanced-postgresql-chem-fizicheskaya-replikaciya-otlichaetsya-ot-logicheskoi-i-kogda-nuzh, advanced-postgresql-chto-takoe-replication-lag-kak-ego-izmeryat-i-kakie-posledstviya-u-cht, advanced-postgresql-kak-vypolnit-pereklyuchenie-na-repliku-bez-poteri-dannyh-i-kakoi-cenoi, system-design-chto-takoe-partitioning, postgresql-chto-takoe-partitioning, postgresql-kogda-ispolzovat-partitioning, postgresql-kak-rabotat-s-bolshimi-tablicami, advanced-postgresql-kak-vybrat-klyuch-particionirovaniya-i-chto-proizoidet-pri-neudachnom, advanced-postgresql-kak-perevesti-bolshuyu-rabotayuschuyu-tablicu-na-particionirovanie-bez
articles: pg-replikaciya, replikaciya-i-failover, pg-particionirovanie, partitsionirovanie-dannyh
puzzles:
```

**Что нужно знать**

- Физическая (потоковая) репликация: передача WAL, побайтовая копия всего кластера, реплики только на чтение. Логическая: публикации и подписки на уровне таблиц, разные версии PostgreSQL, миграции и CDC.
- Синхронная и асинхронная репликация: `synchronous_standby_names`, кворум, цена в латентности записи и риск остановки записи при потере синхронной реплики.
- Replication lag: измерение через `pg_stat_replication` (`write_lag`, `flush_lag`, `replay_lag`) и `pg_last_xact_replay_timestamp()`; чтение своих записей (read-your-writes) при чтении с реплики, маршрутизация в Npgsql (`Target Session Attributes`).
- Конфликты на реплике: долгие запросы против применения WAL, `max_standby_streaming_delay`, `hot_standby_feedback` и его влияние на bloat мастера.
- Failover: Patroni и аналоги, split brain, fencing, потеря последних транзакций при асинхронной репликации, переподключение приложения.
- Декларативное партиционирование: `RANGE`, `LIST`, `HASH`; partition pruning, уникальные ограничения обязаны включать ключ партиционирования, индексы создаются на каждой секции.
- Когда партиционировать: архивирование и удаление старых данных через `DETACH`/`DROP`, очень большие таблицы с запросами по ключу партиции. Когда нет: запросы не фильтруют по ключу, слишком много мелких секций.
- Перевод живой таблицы на партиции: старая таблица как секция, фоновая переливка с двойной записью, автоматическое создание будущих секций (`pg_partman` или задача по расписанию).

**На чём валятся**

- Читают с асинхронной реплики сразу после записи и удивляются «пропавшим» данным.
- Не знают, что автоматический failover на асинхронную реплику может потерять подтверждённые транзакции.
- Партиционируют по колонке, которой нет в большинстве запросов, и получают сканирование всех секций.
- Путают партиционирование внутри одной базы и шардирование между серверами.

## Senior: шардирование и масштабирование базы

```yaml
slug: senior-sharding
questions: system-design-kak-masshtabirovat-database, system-design-chto-takoe-sharding, system-design-sproektirovat-sistemu-s-postgresql-redis-kafka, system-design-chto-proizoidet-esli-postgresql-stanet-nedostupen, system-design-senior-kak-vybrat-shemu-shardirovaniya-i-chto-delat-pri-neobhodimosti-reshard, system-design-senior-kak-pereshardirovat-dannye-bez-prostoya, system-design-senior-kak-postroit-sistemu-perezhivayuschuyu-nedostupnost-postgresql-v-teche, system-design-senior-kak-obespechit-konsistentnost-dannyh-v-multi-region-arhitekture
articles: shardirovanie-i-vybor-klyucha, reshardirovanie-bez-prostoya, keshirovanie
puzzles:
```

**Что нужно знать**

- Порядок масштабирования: оптимизация запросов и индексов, вертикальный рост, реплики для чтения, кэш, партиционирование, вынос данных в отдельные базы по доменам, и только потом шардирование. Шардирование это последний шаг из-за цены в сложности.
- Выбор ключа шардирования: равномерность нагрузки, локальность запросов (все данные клиента на одном шарде), отсутствие горячих ключей; `tenant_id` и `user_id` как типичные кандидаты.
- Стратегии: диапазоны, хеш, справочник (directory), consistent hashing и виртуальные узлы; как каждая ведёт себя при добавлении шарда.
- Что теряется: джойны и транзакции между шардами, глобальные уникальные ограничения, глобальная сортировка и пагинация, генерация идентификаторов (UUID v7, snowflake).
- Решардинг без простоя: двойная запись, фоновая переливка, сверка, переключение чтения, затем записи; логическая репликация как транспорт.
- Готовые решения: Citus, шардирование на уровне приложения, управляемые распределённые базы; когда их цена оправдана.
- Отказоустойчивость на уровне системы: что происходит с сервисом при недоступности PostgreSQL, деградация через кэш и очередь, outbox, идемпотентные повторы.
- Мульти-регион: задержки синхронной записи между регионами, выбор между согласованностью и доступностью, разделение данных по регионам.

**На чём валятся**

- Предлагают шардирование как первый шаг при росте нагрузки.
- Выбирают ключ шардирования, при котором самый крупный клиент целиком перегружает один шард.
- Не могут объяснить, как будет работать запрос «все заказы по всем клиентам за день» после шардирования.
- Не продумывают миграцию существующих данных и откат.
