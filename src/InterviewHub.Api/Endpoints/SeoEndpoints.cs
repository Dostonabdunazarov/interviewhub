using System.Security;
using System.Text;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace InterviewHub.Api.Endpoints;

/// <summary>
/// Карта сайта для поисковых роботов. Генерируется из БД, а не при сборке
/// фронтенда: вопросы добавляются через админку и импорт, пересобирать
/// статику ради каждого нового вопроса незачем.
/// </summary>
public static class SeoEndpoints
{
    private const string CacheKey = "sitemap.xml";

    /// <summary>
    /// Свежесть карты некритична, а запрос собирает ~750 строк из четырёх
    /// таблиц. Краулер ходит часто — держим готовый XML в памяти.
    /// </summary>
    private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(15);

    public static void MapSeoEndpoints(this IEndpointRouteBuilder app)
    {
        // Вне группы /api: robots.txt ссылается на канонический /sitemap.xml,
        // и менять этот путь ради единообразия с API нельзя.
        // ВАЖНО: nginx отдаёт всё, что не начинается с /api/, SPA-фоллбэком,
        // поэтому в frontend/nginx.conf нужен явный proxy_pass на этот маршрут.
        app.MapGet("/sitemap.xml", async (
            AppDbContext db,
            IMemoryCache cache,
            IConfiguration config,
            CancellationToken ct) =>
        {
            if (!cache.TryGetValue(CacheKey, out string? xml))
            {
                xml = await BuildSitemapAsync(db, ResolveBaseUrl(config), ct);
                cache.Set(CacheKey, xml, CacheFor);
            }

            return Results.Text(xml!, "application/xml", Encoding.UTF8);
        }).ExcludeFromDescription();
    }

    /// <summary>
    /// Базовый URL из конфига: иначе локальный запуск сгенерировал бы карту
    /// со ссылками на прод. В docker-compose задаётся как Seo__BaseUrl.
    /// </summary>
    private static string ResolveBaseUrl(IConfiguration config)
    {
        var url = config["Seo:BaseUrl"] ?? "https://interview.hypex.site";
        return url.TrimEnd('/');
    }

    private static async Task<string> BuildSitemapAsync(
        AppDbContext db,
        string baseUrl,
        CancellationToken ct)
    {
        // Черновики и архив в карту не попадают: краулер получил бы 404,
        // потому что публичное API отдаёт только Published.
        var questions = await db.Questions
            .AsNoTracking()
            .Where(q => q.Status == QuestionStatus.Published)
            .OrderByDescending(q => q.UpdatedAt ?? q.CreatedAt)
            .Select(q => new { q.Slug, q.UpdatedAt, q.CreatedAt })
            .ToListAsync(ct);

        // Справочники без вопросов — пустые страницы, в индексе они мусор.
        // Считаем по Published, чтобы категория с одними черновиками не попала.
        var categories = await db.Categories
            .AsNoTracking()
            .Where(c => c.Questions.Any(q => q.Status == QuestionStatus.Published))
            .OrderBy(c => c.SortOrder)
            .Select(c => c.Slug)
            .ToListAsync(ct);

        var levels = await db.Levels
            .AsNoTracking()
            .Where(l => l.Questions.Any(q => q.Status == QuestionStatus.Published))
            .OrderBy(l => l.Rank)
            .Select(l => l.Slug)
            .ToListAsync(ct);

        var companies = await db.Companies
            .AsNoTracking()
            .Where(c => c.QuestionCompanies.Any(qc => qc.Question.Status == QuestionStatus.Published))
            .OrderBy(c => c.SortOrder)
            .Select(c => c.Slug)
            .ToListAsync(ct);

        var sb = new StringBuilder(64 * 1024);
        sb.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        sb.AppendLine("""<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">""");

        // Статические страницы. /theory включена намеренно: раздел пока
        // заглушка, но это осмысленная страница с текстом, а не пустышка.
        foreach (var path in new[] { "/", "/questions", "/levels", "/companies", "/theory", "/about" })
            Append(sb, baseUrl, path, null);

        foreach (var q in questions)
            Append(sb, baseUrl, $"/questions/{q.Slug}", q.UpdatedAt ?? q.CreatedAt);

        foreach (var slug in categories)
            Append(sb, baseUrl, $"/categories/{slug}", null);

        foreach (var slug in levels)
            Append(sb, baseUrl, $"/levels/{slug}", null);

        foreach (var slug in companies)
            Append(sb, baseUrl, $"/companies/{slug}", null);

        sb.AppendLine("</urlset>");

        // Лимит формата — 50 000 URL и 50 МБ. При 734 вопросах запас
        // огромный; когда упрёмся, понадобится sitemap index с разбивкой.
        return sb.ToString();
    }

    private static void Append(StringBuilder sb, string baseUrl, string path, DateTime? lastMod)
    {
        sb.Append("  <url><loc>")
          // Slug'и транслитерируются при импорте, но экранирование обязательно:
          // amp в слаге сломал бы весь документ, а не одну строку.
          .Append(SecurityElement.Escape(baseUrl + path))
          .Append("</loc>");

        if (lastMod.HasValue)
            sb.Append("<lastmod>")
              .Append(lastMod.Value.ToString("yyyy-MM-dd"))
              .Append("</lastmod>");

        sb.AppendLine("</url>");
    }
}
