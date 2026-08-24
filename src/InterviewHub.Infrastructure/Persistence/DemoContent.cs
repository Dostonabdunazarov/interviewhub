using InterviewHub.Domain.Entities;
using InterviewHub.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Persistence;

/// <summary>
/// Демо-вопросы, чтобы каркас можно было смотреть до наполнения админом.
/// Идемпотентно: если вопросы уже есть, ничего не делает.
/// </summary>
public static class DemoContent
{
    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (await db.Questions.AnyAsync(ct)) return;

        var cats = await db.Categories.ToDictionaryAsync(x => x.Slug, ct);
        var levels = await db.Levels.ToDictionaryAsync(x => x.Slug, ct);
        var companies = await db.Companies.ToDictionaryAsync(x => x.Slug, ct);

        if (cats.Count == 0 || levels.Count == 0) return;

        var tags = new Dictionary<string, Tag>();

        Tag GetTag(string slug, string name)
        {
            if (tags.TryGetValue(slug, out var existing)) return existing;
            var created = new Tag { Slug = slug, Name = name };
            tags[slug] = created;
            db.Tags.Add(created);
            return created;
        }

        void Add(
            string catSlug, string levelSlug, string slug, string title,
            string answer, int difficulty = 3, bool featured = false,
            string[]? tagSpecs = null,
            (string company, int? year, InterviewRound? round)[]? asked = null)
        {
            var question = new Question
            {
                Slug = slug,
                Title = title,
                CategoryId = cats[catSlug].Id,
                LevelId = levels[levelSlug].Id,
                Difficulty = difficulty,
                Status = QuestionStatus.Published,
                IsFeatured = featured
            };

            question.Answers.Add(new Answer { Body = answer, IsPrimary = true, SortOrder = 0 });

            foreach (var spec in tagSpecs ?? [])
            {
                var parts = spec.Split('|');
                var tag = GetTag(parts[0], parts.Length > 1 ? parts[1] : parts[0]);
                question.QuestionTags.Add(new QuestionTag { Tag = tag });
            }

            foreach (var (companySlug, year, round) in asked ?? [])
            {
                if (!companies.TryGetValue(companySlug, out var company)) continue;
                question.QuestionCompanies.Add(new QuestionCompany
                {
                    CompanyId = company.Id,
                    AskedYear = year,
                    Round = round
                });
            }

            db.Questions.Add(question);
        }

        // --- React ---
        Add("react", "junior", "react-chto-takoe-virtualnyi-dom",
            "Что такое virtual DOM и зачем он нужен?",
            """
            Virtual DOM — это легковесное представление реального DOM в памяти
            в виде дерева обычных объектов.

            **Как работает:**
            1. При изменении состояния React строит новое дерево.
            2. Сравнивает его с предыдущим (reconciliation, diffing).
            3. Вычисляет минимальный набор изменений и применяет их к реальному DOM.

            **Зачем:** операции с реальным DOM дорогие. Пакетное применение только
            нужных изменений быстрее, чем перерисовывать всё поддерево.
            """,
            difficulty: 2, featured: true,
            tagSpecs: ["virtual-dom|Virtual DOM", "rendering|Рендеринг"],
            asked: [("yandex", 2025, InterviewRound.Technical), ("ozon", 2024, InterviewRound.Screening)]);

        Add("react", "middle", "react-useeffect-dependencies",
            "Как работает массив зависимостей useEffect?",
            """
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
            """,
            difficulty: 3, featured: true,
            tagSpecs: ["hooks|Хуки", "useeffect|useEffect"],
            asked: [("yandex", 2025, InterviewRound.Technical), ("avito", 2025, InterviewRound.Technical)]);

        Add("react", "senior", "react-reconciliation-keys",
            "Почему нельзя использовать индекс массива как key?",
            """
            `key` нужен reconciliation-алгоритму, чтобы сопоставить элементы
            между рендерами.

            При индексе как ключе вставка в начало списка сдвигает все индексы:
            React считает, что изменились все элементы, и переиспользует чужое
            состояние. Классический баг — введённый текст «переезжает» в другую
            строку списка.

            **Правильно:** стабильный идентификатор из данных (`item.id`).
            Индекс допустим только для статичного списка, который никогда
            не переупорядочивается и не фильтруется.
            """,
            difficulty: 4,
            tagSpecs: ["reconciliation|Reconciliation", "keys|Ключи"],
            asked: [("google", 2024, InterviewRound.Technical)]);

        // --- .NET ---
        Add("dotnet", "junior", "dotnet-value-vs-reference-types",
            "Чем value type отличается от reference type?",
            """
            **Value type** (`struct`, `int`, `bool`, `enum`) хранит само значение.
            Живёт в стеке или внутри содержащего объекта, копируется при присваивании.

            **Reference type** (`class`, `interface`, `delegate`, массивы) хранит
            ссылку на объект в управляемой куче. При присваивании копируется ссылка,
            а не объект — две переменные указывают на одни данные.

            Отсюда следствия: сравнение по умолчанию (значение против ссылки),
            поведение при передаче в метод и стоимость копирования больших структур.
            """,
            difficulty: 2,
            tagSpecs: ["types|Типы", "memory|Память"],
            asked: [("epam", 2025, InterviewRound.Screening)]);

        Add("dotnet", "middle", "dotnet-async-await-internals",
            "Что происходит под капотом async/await?",
            """
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
            """,
            difficulty: 4, featured: true,
            tagSpecs: ["async|Async", "tasks|Task"],
            asked: [("sber", 2025, InterviewRound.Technical), ("tinkoff", 2024, InterviewRound.Technical)]);

        Add("dotnet", "senior", "dotnet-gc-generations",
            "Как устроен GC в .NET и что такое поколения?",
            """
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
            """,
            difficulty: 5,
            tagSpecs: ["gc|GC", "memory|Память", "performance|Производительность"],
            asked: [("microsoft", 2024, InterviewRound.Technical), ("sber", 2025, InterviewRound.Final)]);

        // --- PostgreSQL ---
        Add("postgresql", "junior", "postgres-index-basics",
            "Что такое индекс и когда он не поможет?",
            """
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
            """,
            difficulty: 2, featured: true,
            tagSpecs: ["indexes|Индексы", "performance|Производительность"],
            asked: [("ozon", 2025, InterviewRound.Technical)]);

        Add("postgresql", "middle", "postgres-mvcc-vacuum",
            "Что такое MVCC и зачем нужен VACUUM?",
            """
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
            """,
            difficulty: 4,
            tagSpecs: ["mvcc|MVCC", "vacuum|VACUUM", "transactions|Транзакции"],
            asked: [("yandex", 2025, InterviewRound.Technical), ("avito", 2024, InterviewRound.Technical)]);

        // --- DevOps ---
        Add("devops", "junior", "docker-image-vs-container",
            "Чем образ отличается от контейнера?",
            """
            **Образ** — неизменяемый шаблон: слои файловой системы плюс метаданные
            (команда запуска, переменные окружения, порты). Артефакт сборки.

            **Контейнер** — запущенный экземпляр образа с writable-слоем поверх.
            Из одного образа поднимается сколько угодно контейнеров.

            Аналогия: образ — класс, контейнер — объект этого класса.
            """,
            difficulty: 1,
            tagSpecs: ["docker|Docker"],
            asked: [("epam", 2025, InterviewRound.Screening)]);

        Add("devops", "middle", "docker-multistage-build",
            "Зачем нужна multi-stage сборка в Docker?",
            """
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
            """,
            difficulty: 3, featured: true,
            tagSpecs: ["docker|Docker", "ci-cd|CI/CD"],
            asked: [("ozon", 2025, InterviewRound.Technical)]);

        // --- Алгоритмы ---
        Add("algorithms", "junior", "algo-big-o-basics",
            "Что означает O(n log n) и какие алгоритмы так работают?",
            """
            O-нотация описывает асимптотический рост числа операций
            относительно размера входа.

            **O(n log n)** — типичная сложность эффективных сортировок сравнением:
            merge sort, heap sort, быстрая сортировка в среднем случае. Это доказанная
            нижняя граница для сортировки, основанной на сравнениях.

            Ориентиры: O(1) — доступ по индексу, O(log n) — бинарный поиск,
            O(n) — один проход, O(n²) — вложенные циклы.
            """,
            difficulty: 2,
            tagSpecs: ["complexity|Сложность", "sorting|Сортировка"],
            asked: [("google", 2024, InterviewRound.Screening), ("yandex", 2025, InterviewRound.Screening)]);

        // --- System Design ---
        Add("system-design", "senior", "sd-cache-invalidation",
            "Какие стратегии инвалидации кэша вы знаете?",
            """
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
            """,
            difficulty: 5,
            tagSpecs: ["caching|Кэширование", "scalability|Масштабирование"],
            asked: [("google", 2025, InterviewRound.SystemDesign), ("amazon", 2024, InterviewRound.SystemDesign)]);

        // --- Soft skills ---
        Add("soft-skills", "middle", "soft-conflict-in-team",
            "Расскажите о конфликте в команде и как вы его разрешили",
            """
            Отвечайте по схеме **STAR**: Situation, Task, Action, Result.

            **Что хочет услышать интервьюер:**
            - Вы отделяете позицию от личности и не переходите в обвинения.
            - Вы искали факты и общую цель, а не «победу» в споре.
            - Вы можете признать свою ошибку.
            - Конфликт закончился решением, а не замалчиванием.

            **Чего избегать:** рассказа, где виноваты исключительно другие,
            и историй без результата. Даже неудачный опыт работает,
            если вы сформулировали вывод.
            """,
            difficulty: 2,
            tagSpecs: ["behavioral|Поведенческие", "teamwork|Работа в команде"],
            asked: [("amazon", 2025, InterviewRound.Final), ("sber", 2025, InterviewRound.Final)]);

        await db.SaveChangesAsync(ct);
    }
}
