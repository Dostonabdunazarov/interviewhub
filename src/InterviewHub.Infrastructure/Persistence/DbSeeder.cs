using InterviewHub.Domain.Entities;
using InterviewHub.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Persistence;

/// <summary>
/// Наполняет пустую БД справочниками и демо-контентом.
/// Идемпотентен: каждый блок проверяет, есть ли уже данные.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        await SeedLevelsAsync(db, ct);
        await SeedCategoriesAsync(db, ct);
        await SeedCompaniesAsync(db, ct);
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedLevelsAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.Levels.AnyAsync(ct)) return;

        db.Levels.AddRange(
            new Level { Slug = "intern", Name = "Intern", Rank = 1, Color = "#64748b" },
            new Level { Slug = "junior", Name = "Junior", Rank = 2, Color = "#22c55e" },
            new Level { Slug = "middle", Name = "Middle", Rank = 3, Color = "#3b82f6" },
            new Level { Slug = "senior", Name = "Senior", Rank = 4, Color = "#a855f7" },
            new Level { Slug = "lead", Name = "Lead", Rank = 5, Color = "#f59e0b" });
    }

    private static async Task SeedCategoriesAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.Categories.AnyAsync(ct)) return;

        db.Categories.AddRange(
            new Category { Slug = "react", Name = "React", Icon = "atom", Color = "#61dafb", SortOrder = 1,
                Description = "Хуки, рендеринг, состояние, производительность" },
            new Category { Slug = "dotnet", Name = ".NET", Icon = "hexagon", Color = "#8b5cf6", SortOrder = 2,
                Description = "C#, CLR, async/await, сборка мусора, EF Core" },
            new Category { Slug = "postgresql", Name = "PostgreSQL", Icon = "database", Color = "#336791", SortOrder = 3,
                Description = "Индексы, планы запросов, транзакции, блокировки" },
            new Category { Slug = "devops", Name = "DevOps", Icon = "container", Color = "#0ea5e9", SortOrder = 4,
                Description = "Docker, CI/CD, Kubernetes, мониторинг" },
            new Category { Slug = "algorithms", Name = "Алгоритмы", Icon = "binary", Color = "#f97316", SortOrder = 5,
                Description = "Структуры данных, сложность, типовые задачи" },
            new Category { Slug = "system-design", Name = "System Design", Icon = "network", Color = "#14b8a6", SortOrder = 6,
                Description = "Масштабирование, кэши, очереди, отказоустойчивость" },
            new Category { Slug = "soft-skills", Name = "Soft Skills", Icon = "users", Color = "#ec4899", SortOrder = 7,
                Description = "Поведенческие вопросы, работа в команде, конфликты" });
    }

    private static async Task SeedCompaniesAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.Companies.AnyAsync(ct)) return;

        // LogoUrl — внешние ссылки; на фронте есть фолбэк на буквенную заглушку.
        db.Companies.AddRange(
            new Company { Slug = "google", Name = "Google", Country = "US", Color = "#4285f4", SortOrder = 1,
                LogoUrl = "https://cdn.simpleicons.org/google" },
            new Company { Slug = "yandex", Name = "Яндекс", Country = "RU", Color = "#fc3f1d", SortOrder = 2,
                LogoUrl = "https://cdn.simpleicons.org/yandex" },
            new Company { Slug = "ozon", Name = "Ozon", Country = "RU", Color = "#005bff", SortOrder = 3,
                LogoUrl = "https://cdn.simpleicons.org/ozon" },
            new Company { Slug = "vk", Name = "VK", Country = "RU", Color = "#0077ff", SortOrder = 4,
                LogoUrl = "https://cdn.simpleicons.org/vk" },
            new Company { Slug = "sber", Name = "Сбер", Country = "RU", Color = "#21a038", SortOrder = 5 },
            new Company { Slug = "tinkoff", Name = "Т-Банк", Country = "RU", Color = "#ffdd2d", SortOrder = 6 },
            new Company { Slug = "avito", Name = "Avito", Country = "RU", Color = "#00aaff", SortOrder = 7 },
            new Company { Slug = "amazon", Name = "Amazon", Country = "US", Color = "#ff9900", SortOrder = 8,
                LogoUrl = "https://cdn.simpleicons.org/amazon" },
            new Company { Slug = "microsoft", Name = "Microsoft", Country = "US", Color = "#5e5e5e", SortOrder = 9,
                LogoUrl = "https://cdn.simpleicons.org/microsoft" },
            new Company { Slug = "epam", Name = "EPAM", Country = "BY", Color = "#4dbd33", SortOrder = 10 });
    }
}
