# Задачи: PostgreSQL

## Пользователи вне бан-листа

```yaml
slug: postgresql-not-in-s-null
category: postgresql
level: middle
kind: output
difficulty: 3
```

Что вернёт последний запрос?

```sql
CREATE TABLE users  (id int PRIMARY KEY);
CREATE TABLE banned (user_id int);

INSERT INTO users  VALUES (1), (2), (3);
INSERT INTO banned VALUES (2), (NULL);

SELECT count(*)
FROM users
WHERE id NOT IN (SELECT user_id FROM banned);
```

### Варианты

- [ ] `2`
- [ ] `3`
- [x] `0`
- [ ] Ошибку: подзапрос в `NOT IN` вернул `NULL`

### Разбор

`id NOT IN (2, NULL)` раскрывается в `id <> 2 AND id <> NULL`. Сравнение с `NULL` в SQL даёт не `true` и не `false`, а `NULL` (неизвестно). Для `id = 2` выражение равно `false AND NULL = false`, для `id = 1` и `id = 3` — `true AND NULL = NULL`. `WHERE` пропускает только строки, где условие строго `true`, поэтому не проходит ни одна строка, и `count(*)` равен `0`.

Это частый источник «пропавших» данных: достаточно одной строки с `NULL` в подзапросе, и `NOT IN` перестаёт возвращать что-либо. С `IN` такой проблемы нет: `id IN (2, NULL)` для `id = 2` даёт `true`.

Надёжная замена — `NOT EXISTS`, у него нет трёхзначной ловушки: `WHERE NOT EXISTS (SELECT 1 FROM banned b WHERE b.user_id = u.id)` вернёт `2`. Альтернатива — `LEFT JOIN banned b ON b.user_id = u.id WHERE b.user_id IS NULL`. Планировщик PostgreSQL превращает `NOT EXISTS` в anti-join, а `NOT IN` с подзапросом из-за той же семантики `NULL` в общем случае так оптимизировать не может, так что `NOT EXISTS` часто ещё и быстрее.

## Агрегаты и NULL

```yaml
slug: postgresql-count-i-null
category: postgresql
level: junior
kind: output
difficulty: 2
```

Что вернёт последний запрос?

```sql
CREATE TABLE t (v int);
INSERT INTO t VALUES (1), (NULL), (1), (NULL), (2);

SELECT count(*),
       count(v),
       count(DISTINCT v),
       count(*) FILTER (WHERE v = NULL)
FROM t;
```

### Варианты

- [ ] `5, 5, 3, 2`
- [x] `5, 3, 2, 0`
- [ ] `5, 3, 3, 2`
- [ ] `5, 3, 2, 2`

### Разбор

`count(*)` считает строки — их пять, независимо от содержимого. `count(v)` считает только строки, где `v` не `NULL`: `1, 1, 2` — три. `count(DISTINCT v)` тоже игнорирует `NULL` и считает уникальные значения: `1` и `2` — два. Этим же правилом пользуются `sum`, `avg`, `min`, `max`: `NULL` просто пропускается (а `avg` по колонке с `NULL` делит на число непустых значений, а не на число строк).

`v = NULL` для любой строки даёт `NULL`, а не `true`: `NULL` означает «неизвестно», и два неизвестных значения нельзя считать равными. Поэтому фильтр не пропускает ни одной строки, и последний столбец равен `0`. Проверять нужно через `v IS NULL`, а для сравнения с учётом `NULL` есть `IS NOT DISTINCT FROM` (`NULL IS NOT DISTINCT FROM NULL` — `true`).

В EF Core эта разница тоже видна: LINQ-выражение `x.Value == null` транслируется в `IS NULL`, а при сравнении двух nullable-колонок EF добавляет дополнительные проверки, чтобы сохранить семантику C#, где `null == null`.

## Поиск по домену почты

```yaml
slug: postgresql-like-s-vedushchim-procentom
category: postgresql
level: middle
kind: bug
difficulty: 3
```

В чём проблема? Таблица `users` — несколько миллионов строк, запрос выполняется на каждой загрузке админки.

```sql
CREATE INDEX ix_users_email ON users (email);

SELECT id, email
FROM users
WHERE email LIKE '%@gmail.com';
```

### Варианты

- [ ] `LIKE` в PostgreSQL регистронезависимый, поэтому найдутся и адреса `@GMAIL.COM`
- [ ] Символ `@` нужно экранировать в шаблоне `LIKE`, иначе он трактуется как подстановочный
- [x] Шаблон начинается с `%`: B-tree индекс по `email` для такого условия не используется, и выполняется последовательное сканирование всей таблицы
- [ ] Индекс будет использован, но только после `ANALYZE users`

### Разбор

B-tree хранит значения отсортированными и умеет быстро находить диапазон по **префиксу**: `email LIKE 'ivan%'` можно превратить в условие `email >= 'ivan' AND email < 'ivao'`. Когда шаблон начинается с `%`, префикса нет, и индекс бесполезен — PostgreSQL читает всю таблицу (`Seq Scan`) и проверяет шаблон для каждой строки. Это легко увидеть в `EXPLAIN ANALYZE`.

Есть и вторая тонкость: даже префиксный `LIKE 'ivan%'` использует обычный B-tree индекс только при collation `C`. В базе с локалью вроде `en_US.UTF-8` для этого нужен индекс с классом операторов `text_pattern_ops`: `CREATE INDEX ... ON users (email text_pattern_ops)`.

Варианты исправления для поиска по суффиксу или подстроке: триграммный индекс из расширения `pg_trgm` (`CREATE INDEX ... USING gin (email gin_trgm_ops)`) — поддерживает `LIKE`/`ILIKE` с `%` в любом месте; функциональный индекс по `reverse(email)` (с тем же `text_pattern_ops`) и запрос `reverse(email) LIKE reverse('@gmail.com') || '%'`; либо отдельная колонка с доменом и обычный индекс по ней — самый быстрый вариант, если такой поиск частый. Кстати, регистронезависимый поиск в PostgreSQL — это `ILIKE`, обычный `LIKE` чувствителен к регистру.

## Постраничный вывод статей

```yaml
slug: postgresql-paginaciya-bez-order-by
category: postgresql
level: junior
kind: bug
difficulty: 2
```

В чём проблема? Клиент листает статьи по 20 штук, третья страница запрашивается так:

```sql
SELECT id, title
FROM articles
WHERE published
LIMIT 20 OFFSET 40;
```

### Варианты

- [ ] `OFFSET` нельзя использовать без `ORDER BY` — запрос завершится ошибкой
- [x] Без `ORDER BY` порядок строк не определён: страницы могут пересекаться и пропускать статьи
- [ ] PostgreSQL по умолчанию сортирует по первичному ключу, поэтому проблем нет, просто порядок не по дате
- [ ] `LIMIT` и `OFFSET` в таком порядке не работают, нужно `OFFSET 40 LIMIT 20`

### Разбор

Таблица в SQL — это множество строк без порядка. Если в запросе нет `ORDER BY`, PostgreSQL возвращает строки в том порядке, в котором их удобно достать по выбранному плану: по порядку в файле таблицы, по индексу, после hash-агрегации. Этот порядок может меняться после `UPDATE` (новая версия строки ложится в другое место), `VACUUM`, роста таблицы и смены плана, а при synchronized seqscans — даже между двумя одинаковыми запросами подряд. Отдельные запросы `OFFSET 20` и `OFFSET 40` не обязаны видеть одинаковую последовательность, и пользователь увидит одну статью дважды, а другую не увидит никогда. Документация прямо предупреждает: при использовании `LIMIT` нужен `ORDER BY`, задающий однозначный порядок.

«Однозначный» — важное слово: `ORDER BY published_at DESC` тоже недостаточен, если у нескольких статей одинаковое время публикации, — их взаимный порядок не определён. Добавляйте уникальный хвост: `ORDER BY published_at DESC, id DESC`.

Для глубокой пагинации `OFFSET` ещё и медленный — базе приходится прочитать и отбросить все пропущенные строки. Альтернатива — keyset-пагинация: `WHERE (published_at, id) < ($1, $2) ORDER BY published_at DESC, id DESC LIMIT 20` с составным индексом по `(published_at, id)`.
