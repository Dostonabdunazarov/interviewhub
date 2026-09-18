using InterviewHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Persistence;

/// <summary>
/// Заводит скелет теории: 6 треков и 32 раздела из THEORY_PLAN.md. Статьи
/// пишутся отдельно — заранее заведённое дерево ничего не ломает, потому что
/// разделы без опубликованных статей в сайдбар не попадают.
///
/// Идемпотентен по slug, а не блоком «есть хоть что-то»: дерево уточняется по
/// ходу, и новый раздел должен доехать до уже наполненной базы. Существующие
/// записи не трогаются — правки из админки важнее того, что здесь написано.
/// </summary>
public static class TheorySeeder
{
    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        var existingTracks = await db.TheoryTracks
            .Include(t => t.Sections)
            .ToDictionaryAsync(t => t.Slug, ct);

        var order = 0;

        foreach (var (slug, name, icon, color, description, sections) in Tree)
        {
            order++;

            if (!existingTracks.TryGetValue(slug, out var track))
            {
                track = new TheoryTrack
                {
                    Slug = slug,
                    Name = name,
                    Icon = icon,
                    Color = color,
                    Description = description,
                    SortOrder = order,
                    // Трек публикуется руками, когда в нём есть что читать:
                    // иначе после первой же статьи в сайдбаре появится трек
                    // с одним пунктом из тридцати.
                    IsPublished = false
                };

                db.TheoryTracks.Add(track);
                existingTracks[slug] = track;
            }

            var existingSections = track.Sections.ToDictionary(s => s.Slug);
            var sectionOrder = 0;

            foreach (var (sectionSlug, sectionName, sectionDescription) in sections)
            {
                sectionOrder++;

                if (existingSections.ContainsKey(sectionSlug)) continue;

                track.Sections.Add(new TheorySection
                {
                    Slug = sectionSlug,
                    Name = sectionName,
                    Description = sectionDescription,
                    SortOrder = sectionOrder
                });
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private record SectionSeed(string Slug, string Name, string? Description);

    private record TrackSeed(
        string Slug, string Name, string? Icon, string? Color, string? Description,
        SectionSeed[] Sections);

    /// <summary>
    /// Дерево из THEORY_PLAN.md. Порядок треков — по плотности материала в базе
    /// вопросов, порядок разделов внутри трека — по порядку изучения, а не по
    /// алфавиту: раздел читают подряд.
    /// </summary>
    private static readonly TrackSeed[] Tree =
    [
        new("dotnet-backend", ".NET Backend", "hexagon", "#8b5cf6",
            "C#, CLR, асинхронность, ASP.NET Core, EF Core и PostgreSQL",
            [
                new("csharp-lang", "Язык C#",
                    "Типы, строки, делегаты, LINQ и отложенное выполнение"),
                new("collections", "Коллекции",
                    "Как устроены List, Dictionary и HashSet и что выбрать под задачу"),
                new("clr-memory", "CLR и память",
                    "IL и JIT, стек и куча, сборка мусора, утечки и Span<T>"),
                new("async-await", "Асинхронность",
                    "State machine, SynchronizationContext, дедлоки и отмена"),
                new("concurrency", "Многопоточность",
                    "Примитивы синхронизации, гонки, deadlock и конкурентные коллекции"),
                new("aspnet-core", "ASP.NET Core",
                    "Pipeline, DI, конфигурация, аутентификация и дизайн API"),
                new("ef-core", "EF Core и данные",
                    "ChangeTracker, N+1, транзакции, миграции и границы ORM"),
                new("postgresql", "PostgreSQL",
                    "Индексы, планы запросов, MVCC, блокировки и репликация"),
                new("performance", "Производительность",
                    "Как мерить, профилировать и что делать с p99")
            ]),

        new("distributed", "Распределённые системы", "network", "#14b8a6",
            "Поведение системы при отказах: масштабирование, согласованность, очереди",
            [
                new("system-design-basics", "Основы System Design",
                    "Как проходить дизайн-секцию, оценка нагрузки, масштабирование"),
                new("data-at-scale", "Данные под нагрузкой",
                    "Шардирование, репликация, кэширование и его отказы"),
                new("reliability", "Надёжность",
                    "Retry, timeout budget, circuit breaker, идемпотентность"),
                new("consistency", "Согласованность",
                    "CAP и PACELC, модели согласованности, часы, консенсус и Raft"),
                new("microservices", "Микросервисы",
                    "Границы сервисов, Saga, Outbox, версионирование контрактов"),
                new("messaging", "Kafka и очереди",
                    "Партиции и порядок, consumer groups, гарантии доставки, DLQ"),
                new("design-drills", "Разбор задач",
                    "URL shortener, notification service, платежи, 100 000 RPS")
            ]),

        new("algorithms", "Алгоритмы", "binary", "#f97316",
            "Сложность, структуры данных и типовые приёмы для секции с кодом",
            [
                new("complexity", "Сложность",
                    "Big O на примерах и оценка памяти"),
                new("data-structures", "Структуры данных",
                    "Массивы, списки, хеш-таблицы, деревья и графы"),
                new("techniques", "Приёмы",
                    "Два указателя, скользящее окно, бинарный поиск, DFS и BFS, ДП"),
                new("drills", "Типовые задачи",
                    "Разборы задач, которые дают на секции чаще остальных")
            ]),

        new("infrastructure", "Инфраструктура", "container", "#0ea5e9",
            "Контейнеры, Kubernetes, доставка и наблюдаемость глазами разработчика",
            [
                new("containers", "Контейнеры и Kubernetes",
                    "Образ .NET, лимиты CPU и памяти, пробы, graceful shutdown"),
                new("delivery", "Доставка",
                    "CI/CD, rolling и canary, миграции БД при нескольких репликах"),
                new("observability", "Наблюдаемость",
                    "Логи, метрики, трассировки, OpenTelemetry, SLI и SLO")
            ]),

        new("interview", "Собеседование", "users", "#ec4899",
            "Процесс найма и поведенческая секция",
            [
                new("process", "Процесс",
                    "Этапы найма, подготовка по грейдам, вопросы работодателю"),
                new("soft-skills", "Soft skills",
                    "STAR, рассказ о себе, конфликты, ошибка в проде, приоритизация")
            ]),

        new("code-design", "Код и архитектура", "boxes", "#f59e0b",
            "ООП, SOLID, паттерны и архитектура приложения вне привязки к стеку",
            [
                new("oop-solid", "ООП и SOLID",
                    "Принципы, нарушения на реальном коде и где они вредят"),
                new("patterns", "Паттерны",
                    "Factory, Strategy, Decorator, Proxy, Mediator и их цена"),
                new("app-architecture", "Архитектура приложения",
                    "Слои, гексагональная, Clean Architecture, CQRS, ADR, техдолг")
            ])
    ];
}
