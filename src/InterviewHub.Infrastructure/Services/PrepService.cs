using System.Linq.Expressions;
using InterviewHub.Application.Common;
using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Entities;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Services;

public interface IPrepService
{
    Task<IReadOnlyList<PrepListItemDto>> GetPublishedAsync(CancellationToken ct = default);
    Task<PrepGuideDetailDto?> GetBySlugAsync(string slug, CancellationToken ct = default);

    Task<IReadOnlyList<PrepGuideAdminDto>> GetAllAsync(CancellationToken ct = default);
    Task<PrepUpsertResult> UpsertAsync(PrepGuideInput input, CancellationToken ct = default);
    Task<OperationResult<PrepStatusDto>> SetStatusAsync(Guid id, TheoryStatus status, CancellationToken ct = default);
    Task<OperationResult> DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed record PrepUpsertResult(PrepUpsertDto? Value, IReadOnlyDictionary<string, string[]>? Errors)
{
    public bool IsSuccess => Value is not null;
}

public sealed class PrepService(AppDbContext db) : IPrepService
{
    private static readonly Expression<Func<PrepGuide, int>> RoleRank = g =>
        g.Role == "backend" ? 0
        : g.Role == "system-design" ? 1
        : g.Role == "databases" ? 2
        : g.Role == "algorithms" ? 3
        : g.Role == "tech-lead" ? 4
        : 5;

    public async Task<IReadOnlyList<PrepListItemDto>> GetPublishedAsync(CancellationToken ct = default) =>
        await db.PrepGuides.AsNoTracking()
            .Where(g => g.Status == TheoryStatus.Published)
            .OrderBy(RoleRank)
            .ThenBy(g => g.Role)
            .ThenBy(g => g.Level.Rank)
            .ThenBy(g => g.SortOrder)
            .Select(g => new PrepListItemDto(
                g.Slug, g.Title, g.Role, g.RoleName,
                new PrepLevelDto(g.Level.Slug, g.Level.Name, g.Level.Color, g.Level.Rank),
                g.Summary,
                g.Topics.Count,
                g.Topics.SelectMany(t => t.Questions)
                    .Where(tq => tq.Question.Status == QuestionStatus.Published)
                    .Select(tq => tq.QuestionId)
                    .Distinct()
                    .Count(),
                g.SortOrder))
            .ToListAsync(ct);

    public async Task<PrepGuideDetailDto?> GetBySlugAsync(string slug, CancellationToken ct = default) =>
        await db.PrepGuides.AsNoTracking()
            .Where(g => g.Slug == slug && g.Status == TheoryStatus.Published)
            .AsSplitQuery()
            .Select(g => new PrepGuideDetailDto(
                g.Slug, g.Title, g.Role, g.RoleName,
                new PrepLevelDto(g.Level.Slug, g.Level.Name, g.Level.Color, g.Level.Rank),
                g.Summary, g.Intro, g.InterviewFormat, g.UpdatedAt ?? g.CreatedAt,
                g.Topics.OrderBy(t => t.SortOrder)
                    .Select(t => new PrepTopicDto(
                        t.Slug, t.Title, t.Body, t.SortOrder,
                        t.Questions
                            .Where(q => q.Question.Status == QuestionStatus.Published)
                            .OrderBy(q => q.SortOrder)
                            .Select(q => new PrepQuestionDto(
                                q.Question.Slug, q.Question.Title, q.Question.Difficulty,
                                new PrepLevelRefDto(
                                    q.Question.Level.Slug, q.Question.Level.Name, q.Question.Level.Color)))
                            .ToList(),
                        t.Articles
                            .Where(a => a.TheoryArticle.Status == TheoryStatus.Published
                                        && a.TheoryArticle.Section.Track.IsPublished)
                            .OrderBy(a => a.SortOrder)
                            .Select(a => new PrepArticleDto(
                                a.TheoryArticle.Slug, a.TheoryArticle.Title, a.TheoryArticle.Summary))
                            .ToList(),
                        t.Puzzles
                            .Where(p => p.CodePuzzle.Status == QuestionStatus.Published)
                            .OrderBy(p => p.SortOrder)
                            .Select(p => new PrepPuzzleDto(
                                p.CodePuzzle.Slug, p.CodePuzzle.Title, p.CodePuzzle.Kind))
                            .ToList()))
                    .ToList()))
            .FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<PrepGuideAdminDto>> GetAllAsync(CancellationToken ct = default) =>
        await db.PrepGuides.AsNoTracking()
            .OrderBy(RoleRank)
            .ThenBy(g => g.Role)
            .ThenBy(g => g.Level.Rank)
            .ThenBy(g => g.SortOrder)
            .Select(g => new PrepGuideAdminDto(
                g.Id, g.Slug, g.Title, g.Role, g.RoleName, g.Level.Slug, g.Level.Name,
                g.Status, g.Topics.Count, g.UpdatedAt ?? g.CreatedAt))
            .ToListAsync(ct);

    public async Task<PrepUpsertResult> UpsertAsync(PrepGuideInput input, CancellationToken ct = default)
    {
        var errors = new Dictionary<string, string[]>();

        var levelSlug = input.Level.Trim();
        var levelId = await db.Levels.AsNoTracking()
            .Where(l => l.Slug == levelSlug)
            .Select(l => (Guid?)l.Id)
            .FirstOrDefaultAsync(ct);
        if (levelId is null) errors["level"] = [levelSlug];

        var questionIds = await ResolveAsync(
            input, t => t.Questions, "questions", errors,
            async slugs => (await db.Questions.AsNoTracking()
                .Where(q => slugs.Contains(q.Slug))
                .Select(q => new { q.Slug, q.Id })
                .ToListAsync(ct)).ToDictionary(x => x.Slug, x => x.Id));

        var articleIds = await ResolveAsync(
            input, t => t.Articles, "articles", errors,
            async slugs => (await db.TheoryArticles.AsNoTracking()
                .Where(a => slugs.Contains(a.Slug))
                .Select(a => new { a.Slug, a.Id })
                .ToListAsync(ct)).ToDictionary(x => x.Slug, x => x.Id));

        var puzzleIds = await ResolveAsync(
            input, t => t.Puzzles, "puzzles", errors,
            async slugs => (await db.CodePuzzles.AsNoTracking()
                .Where(p => slugs.Contains(p.Slug))
                .Select(p => new { p.Slug, p.Id })
                .ToListAsync(ct)).ToDictionary(x => x.Slug, x => x.Id));

        if (errors.Count > 0) return new PrepUpsertResult(null, errors);

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var slug = input.Slug.Trim();
        var guide = await db.PrepGuides.FirstOrDefaultAsync(g => g.Slug == slug, ct);
        var created = guide is null;

        if (guide is null)
        {
            guide = new PrepGuide { Slug = slug };
            db.PrepGuides.Add(guide);
        }
        else
        {
            await db.PrepTopics.Where(t => t.GuideId == guide.Id).ExecuteDeleteAsync(ct);
        }

        guide.Title = input.Title.Trim();
        guide.Role = input.Role.Trim();
        guide.RoleName = input.RoleName.Trim();
        guide.LevelId = levelId!.Value;
        guide.Summary = input.Summary.Trim();
        guide.Intro = input.Intro;
        guide.InterviewFormat = input.InterviewFormat;
        guide.SortOrder = input.SortOrder;
        guide.UpdatedAt = DateTime.UtcNow;
        if (input.Publish == true) guide.Status = TheoryStatus.Published;

        for (var i = 0; i < input.Topics.Count; i++)
        {
            var src = input.Topics[i];
            var topic = new PrepTopic
            {
                GuideId = guide.Id,
                Slug = src.Slug.Trim(),
                Title = src.Title.Trim(),
                Body = src.Body,
                SortOrder = i
            };

            AddLinks(src.Questions, questionIds, (id, order) =>
                topic.Questions.Add(new PrepTopicQuestion { QuestionId = id, SortOrder = order }));
            AddLinks(src.Articles, articleIds, (id, order) =>
                topic.Articles.Add(new PrepTopicArticle { TheoryArticleId = id, SortOrder = order }));
            AddLinks(src.Puzzles, puzzleIds, (id, order) =>
                topic.Puzzles.Add(new PrepTopicPuzzle { CodePuzzleId = id, SortOrder = order }));

            db.PrepTopics.Add(topic);
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new PrepUpsertResult(new PrepUpsertDto(guide.Id, guide.Slug, guide.Status, created), null);
    }

    public async Task<OperationResult<PrepStatusDto>> SetStatusAsync(
        Guid id, TheoryStatus status, CancellationToken ct = default)
    {
        var guide = await db.PrepGuides.FirstOrDefaultAsync(g => g.Id == id, ct);
        if (guide is null) return OperationResult<PrepStatusDto>.NotFound("Гайд не найден.");

        guide.Status = status;
        guide.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return OperationResult<PrepStatusDto>.Success(new PrepStatusDto(guide.Id, guide.Slug, guide.Status));
    }

    public async Task<OperationResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var deleted = await db.PrepGuides.Where(g => g.Id == id).ExecuteDeleteAsync(ct);
        return deleted == 0 ? OperationResult.NotFound("Гайд не найден.") : OperationResult.Success();
    }

    private static void AddLinks(List<string>? slugs, Dictionary<string, Guid> ids, Action<Guid, int> add)
    {
        if (slugs is null) return;

        var seen = new HashSet<Guid>();
        var order = 0;
        foreach (var slug in slugs)
        {
            var id = ids[slug.Trim()];
            if (seen.Add(id)) add(id, order++);
        }
    }

    private static async Task<Dictionary<string, Guid>> ResolveAsync(
        PrepGuideInput input,
        Func<PrepTopicInput, List<string>?> selector,
        string kind,
        Dictionary<string, string[]> errors,
        Func<List<string>, Task<Dictionary<string, Guid>>> load)
    {
        var wanted = input.Topics
            .SelectMany(t => selector(t) ?? [])
            .Select(s => s.Trim())
            .Distinct()
            .ToList();

        var map = wanted.Count > 0 ? await load(wanted) : [];

        for (var i = 0; i < input.Topics.Count; i++)
        {
            var unknown = (selector(input.Topics[i]) ?? [])
                .Select(s => s.Trim())
                .Where(s => !map.ContainsKey(s))
                .Distinct()
                .ToArray();
            if (unknown.Length > 0) errors[$"topics[{i}].{kind}"] = unknown;
        }

        return map;
    }
}
