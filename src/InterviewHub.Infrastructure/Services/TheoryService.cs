using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace InterviewHub.Infrastructure.Services;

public interface ITheoryService
{
    Task<TheoryTreeDto> GetTreeAsync(CancellationToken ct = default);
    Task<TheoryArticleDetailDto?> GetArticleBySlugAsync(string slug, CancellationToken ct = default);
    Task<TheoryTrackDetailDto?> GetTrackBySlugAsync(string slug, CancellationToken ct = default);

    /// <summary>Сбросить кэш дерева. Зовётся из админки после любой записи в теорию.</summary>
    void InvalidateTree();
}

/// <summary>
/// Публичное чтение теории. Гостям видно только Published — и статья, и её трек:
/// опубликованная статья в неопубликованном треке недоступна, иначе трек
/// нельзя было бы готовить целиком.
/// </summary>
public sealed class TheoryService(AppDbContext db, IMemoryCache cache) : ITheoryService
{
    private const string TreeCacheKey = "theory.tree";

    /// <summary>
    /// Дерево запрашивается на каждой странице раздела, а меняется раз в неделю.
    /// 15 минут — потолок задержки для правок мимо админки (SQL, импорт);
    /// правки через админку сбрасывают кэш сразу.
    /// </summary>
    private static readonly TimeSpan TreeCacheFor = TimeSpan.FromMinutes(15);

    public async Task<TheoryTreeDto> GetTreeAsync(CancellationToken ct = default)
    {
        if (cache.TryGetValue(TreeCacheKey, out TheoryTreeDto? cached) && cached is not null)
            return cached;

        var tree = new TheoryTreeDto(await LoadTrackNodesAsync(trackSlug: null, ct));

        cache.Set(TreeCacheKey, tree, TreeCacheFor);
        return tree;
    }

    public void InvalidateTree() => cache.Remove(TreeCacheKey);

    public async Task<TheoryTrackDetailDto?> GetTrackBySlugAsync(
        string slug, CancellationToken ct = default)
    {
        var track = await db.TheoryTracks.AsNoTracking()
            .Where(t => t.Slug == slug && t.IsPublished)
            .Select(t => new { t.Slug, t.Name, t.Description, t.Icon, t.Color })
            .FirstOrDefaultAsync(ct);

        if (track is null) return null;

        // Разделы берём тем же загрузчиком, что и дерево: пустые отсеются так же.
        var sections = (await LoadTrackNodesAsync(slug, ct))
            .FirstOrDefault()?.Sections ?? [];

        // Суммарное время чтения считаем в памяти: статьи уже загружены,
        // второй round-trip ради Sum() не нужен.
        var articles = sections.SelectMany(s => s.Articles).ToList();

        return new TheoryTrackDetailDto(
            track.Slug, track.Name, track.Description, track.Icon, track.Color,
            articles.Count, articles.Sum(a => a.ReadingMinutes), sections);
    }

    public async Task<TheoryArticleDetailDto?> GetArticleBySlugAsync(
        string slug, CancellationToken ct = default)
    {
        var article = await db.TheoryArticles.AsNoTracking()
            .Where(a => a.Slug == slug
                        && a.Status == TheoryStatus.Published
                        && a.Section.Track.IsPublished)
            .Select(a => new TheoryArticleDetailDto(
                a.Id, a.Slug, a.Title, a.Summary, a.Body, a.ReadingMinutes, a.ViewCount,
                a.CreatedAt, a.UpdatedAt, a.Status,
                a.Level == null
                    ? null
                    : new RefDto(a.Level.Id, a.Level.Slug, a.Level.Name, a.Level.Color),
                new TheoryBreadcrumbDto(
                    a.Section.Track.Slug, a.Section.Track.Name, a.Section.Slug, a.Section.Name),
                // Соседи проставляются ниже: оконный запрос EF сюда не переведёт.
                null,
                null,
                a.ArticleQuestions
                    .Where(aq => aq.Question.Status == QuestionStatus.Published)
                    .OrderBy(aq => aq.SortOrder)
                    .Select(aq => new TheoryRelatedQuestionDto(
                        aq.Question.Id, aq.Question.Slug, aq.Question.Title, aq.Question.Difficulty,
                        new RefDto(aq.Question.Level.Id, aq.Question.Level.Slug,
                                   aq.Question.Level.Name, aq.Question.Level.Color)))
                    .ToList()))
            .FirstOrDefaultAsync(ct);

        if (article is null) return null;

        var (previous, next) = await LoadNeighboursAsync(article.Id, ct);

        // Счётчик просмотров — прямой UPDATE без загрузки сущности, как у вопроса.
        await db.TheoryArticles
            .Where(a => a.Id == article.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.ViewCount, a => a.ViewCount + 1), ct);

        return article with { Previous = previous, Next = next };
    }

    /// <summary>
    /// Соседи по разделу. Отдельным запросом, потому что «предыдущая» — это не
    /// SortOrder − 1: порядок бывает разрежен, а часть статей скрыта. Берём
    /// весь раздел (единицы статей) и ищем позицию в памяти.
    /// </summary>
    private async Task<(TheoryArticleLinkDto? Previous, TheoryArticleLinkDto? Next)>
        LoadNeighboursAsync(Guid articleId, CancellationToken ct)
    {
        var sectionId = await db.TheoryArticles.AsNoTracking()
            .Where(a => a.Id == articleId)
            .Select(a => a.SectionId)
            .FirstOrDefaultAsync(ct);

        var siblings = await db.TheoryArticles.AsNoTracking()
            .Where(a => a.SectionId == sectionId && a.Status == TheoryStatus.Published)
            .OrderBy(a => a.SortOrder).ThenBy(a => a.Title)
            .Select(a => new
            {
                a.Id,
                Link = new TheoryArticleLinkDto(a.Slug, a.Title, a.ReadingMinutes)
            })
            .ToListAsync(ct);

        var index = siblings.FindIndex(x => x.Id == articleId);
        if (index < 0) return (null, null);

        return (
            index > 0 ? siblings[index - 1].Link : null,
            index < siblings.Count - 1 ? siblings[index + 1].Link : null);
    }

    /// <summary>
    /// Общий загрузчик дерева для /tree и /tracks/{slug}: разница только в
    /// фильтре по треку. Пустые разделы и треки отбрасываются здесь же —
    /// пустой пункт в сайдбаре хуже, чем его отсутствие.
    /// </summary>
    private async Task<IReadOnlyList<TheoryTrackNodeDto>> LoadTrackNodesAsync(
        string? trackSlug, CancellationToken ct)
    {
        var tracks = db.TheoryTracks.AsNoTracking().Where(t => t.IsPublished);

        if (trackSlug is not null)
            tracks = tracks.Where(t => t.Slug == trackSlug);

        // Один запрос на всё дерево: 32 раздела и ~190 статей без тел —
        // это меньше, чем отдаёт один экран каталога вопросов.
        var nodes = await tracks
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Name)
            .Select(t => new TheoryTrackNodeDto(
                t.Slug, t.Name, t.Description, t.Icon, t.Color,
                t.Sections.SelectMany(s => s.Articles)
                    .Count(a => a.Status == TheoryStatus.Published),
                t.Sections
                    .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
                    .Select(s => new TheorySectionNodeDto(
                        s.Slug, s.Name, s.Description,
                        s.Articles.Count(a => a.Status == TheoryStatus.Published),
                        s.Articles
                            .Where(a => a.Status == TheoryStatus.Published)
                            .OrderBy(a => a.SortOrder).ThenBy(a => a.Title)
                            .Select(a => new TheoryArticleNodeDto(
                                a.Slug, a.Title, a.Summary, a.ReadingMinutes,
                                a.Level == null
                                    ? null
                                    : new RefDto(a.Level.Id, a.Level.Slug,
                                                 a.Level.Name, a.Level.Color)))
                            .ToList()))
                    .ToList()))
            .ToListAsync(ct);

        return nodes
            .Select(t => t with { Sections = t.Sections.Where(s => s.ArticleCount > 0).ToList() })
            .Where(t => t.ArticleCount > 0)
            .ToList();
    }
}
