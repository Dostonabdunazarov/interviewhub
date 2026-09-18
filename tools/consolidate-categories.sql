-- Консолидация категорий вопросов: 26 -> 17.
-- (План обещал «~15» на глазок; удаляется 9 категорий, значит 26 - 9 = 17.)
-- Выполнено 2026-09-18. Скрипт оставлен в репозитории как запись о том,
-- что произошло с данными (SEO_AND_CATEGORIES_PLAN.md, этап 2).
--
-- ЗАЧЕМ. Половина категорий кодировала не тему, а сложность: `kafka` и
-- `kafka-advanced` — это один Kafka, просто во второй лежат senior-вопросы.
-- Для сложности в базе уже есть ось `Level`, так что информация была
-- задублирована: в «Kafka» не видно senior-вопросов, в «Kafka — Advanced» —
-- базовых, и читатель вынужден ходить по двум разделам.
--
-- ПРОВЕРЕНО ПЕРЕД ЗАПУСКОМ (план требовал прочитать по 3-5 вопросов из каждой
-- `*-advanced`; прочитаны все заголовки): все 8 сливаемых категорий — та же
-- тема на senior-глубине, и все их вопросы уже имеют Level = senior. Поэтому
-- шаг «проставить senior» из плана не нужен — проверка в разделе 1 это
-- подтверждает и роняет транзакцию, если это перестало быть правдой.
--
-- ЧТО НЕ СЛИВАЕТСЯ И ПОЧЕМУ:
--   distributed-systems (20)   — про отказы и консенсус, а не про дизайн под
--                                нагрузкой; в теории это отдельный трек.
--   performance-profiling (18) — инструменты (dotnet-trace, дампы), не тема.
--   architecture-patterns (16) — чистый код: SOLID, Factory, Decorator.
--   react (3)                  — единственный фронтенд, сливать не с чем.
--
-- ЗАПУСК (весь файл — одна транзакция, при любой ошибке откатывается целиком):
--   cd /root/interviewhub && set -a && . ./.env && set +a
--   docker compose -f docker-compose.hypex.yml exec -T postgres \
--     pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz
--   docker compose -f docker-compose.hypex.yml exec -T postgres \
--     psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
--     < tools/consolidate-categories.sql
--
-- ОТКАТ — только восстановлением из бэкапа (DEPLOY.md, «Бэкап и восстановление»).

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Снимок «до». Печатается в вывод, чтобы результат можно было сверить.
-- ---------------------------------------------------------------------------
\echo '=== ДО: категории и число вопросов ==='
SELECT c."Slug", c."Name", count(q."Id") AS questions
FROM "Categories" c
LEFT JOIN "Questions" q ON q."CategoryId" = c."Id"
GROUP BY c."Id", c."Slug", c."Name", c."SortOrder"
ORDER BY c."SortOrder";

-- Общее число вопросов запоминаем: в конце оно обязано совпасть.
CREATE TEMP TABLE _before_total ON COMMIT DROP AS
SELECT count(*) AS n FROM "Questions";

-- ---------------------------------------------------------------------------
-- 1. Страховка: сливаем только то, что действительно senior.
--    Если в исходной категории найдётся не-senior вопрос, слияние потеряет
--    разделение по сложности, ради которого всё и делается, — падаем.
-- ---------------------------------------------------------------------------
DO $check_senior$
DECLARE
    bad int;
BEGIN
    SELECT count(*) INTO bad
    FROM "Questions" q
    JOIN "Categories" c ON c."Id" = q."CategoryId"
    JOIN "Levels" l ON l."Id" = q."LevelId"
    WHERE c."Slug" IN ('advanced-csharp', 'advanced-concurrency', 'advanced-aspnet',
                       'advanced-postgresql', 'kafka-advanced', 'microservices-advanced',
                       'system-design-senior', 'devops-senior')
      AND l."Slug" <> 'senior';

    IF bad > 0 THEN
        RAISE EXCEPTION 'В сливаемых категориях % не-senior вопросов — проверьте вручную', bad;
    END IF;
END
$check_senior$;

-- ---------------------------------------------------------------------------
-- 2. Семь пар «база + advanced» -> база. Тема одна, различие остаётся в Level.
-- ---------------------------------------------------------------------------
UPDATE "Questions" q
SET "CategoryId" = dst."Id"
FROM "Categories" src, "Categories" dst
WHERE q."CategoryId" = src."Id"
  AND (src."Slug", dst."Slug") IN (
      ('advanced-concurrency',   'multithreading'),
      ('advanced-aspnet',        'aspnet-core'),
      ('advanced-postgresql',    'postgresql'),
      ('kafka-advanced',         'kafka'),
      ('microservices-advanced', 'microservices'),
      ('system-design-senior',   'system-design'),
      ('devops-senior',          'devops')
  );

-- ---------------------------------------------------------------------------
-- 3. `advanced-csharp` — особый случай: категория называлась «C# / CLR»,
--    но по заголовкам это в основном рантайм, а не язык. Разносим по смыслу,
--    иначе вопросы про GC осели бы в категории про синтаксис.
--      19 -> clr-gc          (GC, JIT, Span/ArrayPool, NativeAOT, unsafe)
--       4 -> csharp          (делегаты, expression trees, reflection, source generators)
--       2 -> multithreading  (модель памяти, volatile/Interlocked)
--    Отбор по точным "Slug", а не по LIKE и не по тексту заголовка: slug
--    стабилен, виден в дампе, и точное сравнение не может задеть лишнее.
--    Шесть слугов ниже сверены с живой базой — каждый существует ровно один.
-- ---------------------------------------------------------------------------
UPDATE "Questions" q
SET "CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'csharp')
WHERE q."CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'advanced-csharp')
  AND q."Slug" IN (
      'advanced-csharp-kak-ustroen-vyzov-delegata-i-pochemu-mnogoadresnyi-delegat-dorozhe-odi',
      'advanced-csharp-kogda-expression-trees-predpochtitelnee-skompilirovannyh-delegatov-i-n',
      'advanced-csharp-kak-source-generators-reshayut-problemy-reflection-i-kakie-ogranicheni',
      'advanced-csharp-pochemu-reflection-dorog-i-kakie-sposoby-ego-uskorit-suschestvuyut'
  );

UPDATE "Questions" q
SET "CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'multithreading')
WHERE q."CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'advanced-csharp')
  AND q."Slug" IN (
      'advanced-csharp-chem-otlichayutsya-garantii-volatile-interlocked-i-volatile-read-write',
      'advanced-csharp-chto-garantiruet-model-pamyati-net-i-pochemu-bez-volatile-ili-barera-c'
  );

-- Проверка до раздачи остатка: если слуг выше опечатан или вопрос
-- переименовали, в остатке окажется не 19 вопросов — и опечатка уехала бы
-- в clr-gc незамеченной, потому что «остаток» забирает всё подряд.
DO $check_split$
DECLARE
    rest int;
BEGIN
    SELECT count(*) INTO rest
    FROM "Questions" q
    WHERE q."CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'advanced-csharp');

    IF rest <> 19 THEN
        RAISE EXCEPTION 'В остатке advanced-csharp ожидали 19 вопросов, а там % — проверьте слуги выше', rest;
    END IF;
END
$check_split$;

-- Остаток — рантайм.
UPDATE "Questions" q
SET "CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'clr-gc')
WHERE q."CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'advanced-csharp');

-- ---------------------------------------------------------------------------
-- 4. `dotnet` (3 вопроса) — зонтичная категория-дубль: value type, async/await
--    и GC уже есть темами в csharp / async / clr-gc. Разносим и удаляем.
--    Слуги здесь точные, а не LIKE: их всего три, и один из них
--    (`dotnet-value-vs-reference-types`) не содержит подстроки «value-type» —
--    на шаблоне '%value-type%' он молча уехал бы в clr-gc.
-- ---------------------------------------------------------------------------
UPDATE "Questions" q
SET "CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'csharp')
WHERE q."CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'dotnet')
  AND q."Slug" = 'dotnet-value-vs-reference-types';

UPDATE "Questions" q
SET "CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'async')
WHERE q."CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'dotnet')
  AND q."Slug" = 'dotnet-async-await-internals';

-- Остаток `dotnet` — единственный вопрос про GC. Та же страховка, что и выше.
DO $check_dotnet$
DECLARE
    rest int;
BEGIN
    SELECT count(*) INTO rest
    FROM "Questions" q
    WHERE q."CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'dotnet');

    IF rest <> 1 THEN
        RAISE EXCEPTION 'В остатке dotnet ожидали 1 вопрос, а там % — проверьте слуги выше', rest;
    END IF;
END
$check_dotnet$;

UPDATE "Questions" q
SET "CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'clr-gc')
WHERE q."CategoryId" = (SELECT "Id" FROM "Categories" WHERE "Slug" = 'dotnet');

-- ---------------------------------------------------------------------------
-- 5. Удаляем опустевшие категории. Question -> Category стоит на Restrict,
--    поэтому непустую база удалить не даст — это защита, а не помеха:
--    если выше что-то не переназначилось, DELETE упадёт и вся транзакция
--    откатится, вместо того чтобы тихо потерять вопросы.
-- ---------------------------------------------------------------------------
DELETE FROM "Categories"
WHERE "Slug" IN ('advanced-csharp', 'advanced-concurrency', 'advanced-aspnet',
                 'advanced-postgresql', 'kafka-advanced', 'microservices-advanced',
                 'system-design-senior', 'devops-senior', 'dotnet');

-- ---------------------------------------------------------------------------
-- 6. Пересчитываем SortOrder: после удаления в нумерации остались дыры
--    (1-7, затем 10-17, затем 30-40). Порядок — по числу вопросов убыванием:
--    крупные темы выше, мелкие внизу. Это заодно чинит исходный перекос,
--    где порядок отражал историю наполнения, а не значимость.
-- ---------------------------------------------------------------------------
WITH ranked AS (
    SELECT c."Id",
           row_number() OVER (ORDER BY count(q."Id") DESC, c."Name") AS rn
    FROM "Categories" c
    LEFT JOIN "Questions" q ON q."CategoryId" = c."Id"
    GROUP BY c."Id", c."Name"
)
UPDATE "Categories" c
SET "SortOrder" = ranked.rn
FROM ranked
WHERE c."Id" = ranked."Id";

-- ---------------------------------------------------------------------------
-- 7. Проверки. Любая непройденная роняет транзакцию целиком.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
    cats int;
    total_before int;
    total_after int;
    orphans int;
BEGIN
    SELECT n INTO total_before FROM _before_total;
    SELECT count(*) INTO total_after FROM "Questions";
    IF total_before <> total_after THEN
        RAISE EXCEPTION 'Число вопросов изменилось: было %, стало %', total_before, total_after;
    END IF;

    SELECT count(*) INTO orphans
    FROM "Questions" q
    LEFT JOIN "Categories" c ON c."Id" = q."CategoryId"
    WHERE c."Id" IS NULL;
    IF orphans > 0 THEN
        RAISE EXCEPTION 'У % вопросов категория не существует', orphans;
    END IF;

    SELECT count(*) INTO cats FROM "Categories";
    IF cats <> 17 THEN
        RAISE EXCEPTION 'Ожидали 17 категорий, получили %', cats;
    END IF;
END
$verify$;

\echo '=== ПОСЛЕ: категории и число вопросов ==='
SELECT c."SortOrder", c."Slug", c."Name", count(q."Id") AS questions
FROM "Categories" c
LEFT JOIN "Questions" q ON q."CategoryId" = c."Id"
GROUP BY c."Id", c."Slug", c."Name", c."SortOrder"
ORDER BY c."SortOrder";

COMMIT;

-- После COMMIT не забыть:
--   1. Редиректы 301 со старых URL — frontend/nginx.conf, блок `map $uri`.
--      Без них /categories/kafka-advanced отдаст SPA-заглушку с кодом 200.
--   2. Пересобрать фронт: docker compose -f docker-compose.hypex.yml up -d --build web
--   3. Проверить /sitemap.xml — удалённых категорий в нём быть не должно
--      (карта строится из БД, так что это происходит само).
