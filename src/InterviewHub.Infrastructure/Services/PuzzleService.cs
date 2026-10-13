using InterviewHub.Application.Common;
using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Entities;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Services;

public interface IPuzzleService
{
    Task<PagedResult<PuzzleListItemDto>> SearchAsync(
        string? category, string? level, PuzzleKind? kind, QuestionStatus? status, bool publishedOnly,
        int page, int pageSize, CancellationToken ct = default);

    Task<PuzzleDetailDto?> GetBySlugAsync(string slug, CancellationToken ct = default);

    Task<PuzzleAdminDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<OperationResult<PuzzleAdminDto>> CreateAsync(PuzzleInput input, Guid? userId, CancellationToken ct = default);
    Task<OperationResult<PuzzleAdminDto>> UpdateAsync(Guid id, PuzzleInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class PuzzleService(AppDbContext db) : IPuzzleService
{
    private const int MaxPageSize = 100;

    public async Task<PagedResult<PuzzleListItemDto>> SearchAsync(
        string? category, string? level, PuzzleKind? kind, QuestionStatus? status, bool publishedOnly,
        int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = db.CodePuzzles.AsNoTracking();

        if (publishedOnly) query = query.Where(p => p.Status == QuestionStatus.Published);
        else if (status is { } st) query = query.Where(p => p.Status == st);

        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(p => p.Category.Slug == category);
        if (!string.IsNullOrWhiteSpace(level)) query = query.Where(p => p.Level.Slug == level);
        if (kind is { } k) query = query.Where(p => p.Kind == k);

        var total = await query.CountAsync(ct);

        var items = await Ordered(query)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PuzzleListItemDto(
                p.Id, p.Slug, p.Title, p.Kind, p.Difficulty, p.Status, p.ViewCount, p.CreatedAt,
                new RefDto(p.Category.Id, p.Category.Slug, p.Category.Name, p.Category.Color),
                new RefDto(p.Level.Id, p.Level.Slug, p.Level.Name, p.Level.Color)))
            .ToListAsync(ct);

        return new PagedResult<PuzzleListItemDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }

    public async Task<PuzzleDetailDto?> GetBySlugAsync(string slug, CancellationToken ct = default)
    {
        var puzzle = await db.CodePuzzles.AsNoTracking()
            .Where(p => p.Slug == slug && p.Status == QuestionStatus.Published)
            .Select(p => new PuzzleDetailDto(
                p.Id, p.Slug, p.Title, p.Kind, p.Body, p.Explanation, p.Difficulty, p.ViewCount,
                p.CreatedAt, p.UpdatedAt,
                new RefDto(p.Category.Id, p.Category.Slug, p.Category.Name, p.Category.Color),
                new RefDto(p.Level.Id, p.Level.Slug, p.Level.Name, p.Level.Color),
                p.Options.OrderBy(o => o.SortOrder)
                    .Select(o => new PuzzleOptionDto(o.Id, o.Text, o.IsCorrect))
                    .ToList(),
                null,
                null))
            .FirstOrDefaultAsync(ct);

        if (puzzle is null) return null;

        var siblings = await Ordered(db.CodePuzzles.AsNoTracking()
                .Where(p => p.Status == QuestionStatus.Published))
            .Select(p => new { p.Id, Link = new PuzzleLinkDto(p.Slug, p.Title) })
            .ToListAsync(ct);

        var index = siblings.FindIndex(x => x.Id == puzzle.Id);

        await db.CodePuzzles
            .Where(p => p.Id == puzzle.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.ViewCount, p => p.ViewCount + 1), ct);

        return puzzle with
        {
            Previous = index > 0 ? siblings[index - 1].Link : null,
            Next = index >= 0 && index < siblings.Count - 1 ? siblings[index + 1].Link : null
        };
    }

    public async Task<PuzzleAdminDto?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.CodePuzzles.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new PuzzleAdminDto(
                p.Id, p.Slug, p.Title, p.Kind, p.Body, p.Explanation, p.Difficulty, p.Status,
                p.ViewCount, p.CreatedAt, p.UpdatedAt, p.CategoryId, p.LevelId,
                p.Options.OrderBy(o => o.SortOrder)
                    .Select(o => new PuzzleOptionDto(o.Id, o.Text, o.IsCorrect))
                    .ToList()))
            .FirstOrDefaultAsync(ct);

    public async Task<OperationResult<PuzzleAdminDto>> CreateAsync(
        PuzzleInput input, Guid? userId, CancellationToken ct = default)
    {
        var refs = await CheckReferencesAsync(input, ct);
        if (!refs.IsSuccess) return OperationResult<PuzzleAdminDto>.Invalid(refs.Message!);

        var slug = await SlugResolver.ResolveAsync(
            db.CodePuzzles, input.Slug, input.Title, null, null, "puzzle", ct);
        if (!slug.IsSuccess) return OperationResult<PuzzleAdminDto>.Conflict(slug.Message!);

        var entity = new CodePuzzle { Slug = slug.Value!, CreatedByUserId = userId };
        Apply(entity, input);

        db.CodePuzzles.Add(entity);
        await db.SaveChangesAsync(ct);

        return OperationResult<PuzzleAdminDto>.Success((await GetByIdAsync(entity.Id, ct))!);
    }

    public async Task<OperationResult<PuzzleAdminDto>> UpdateAsync(
        Guid id, PuzzleInput input, CancellationToken ct = default)
    {
        var entity = await db.CodePuzzles
            .Include(p => p.Options)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (entity is null) return OperationResult<PuzzleAdminDto>.NotFound("Задача не найдена.");

        var refs = await CheckReferencesAsync(input, ct);
        if (!refs.IsSuccess) return OperationResult<PuzzleAdminDto>.Invalid(refs.Message!);

        var slug = await SlugResolver.ResolveAsync(
            db.CodePuzzles, input.Slug, input.Title, id, entity.Slug, "puzzle", ct);
        if (!slug.IsSuccess) return OperationResult<PuzzleAdminDto>.Conflict(slug.Message!);

        entity.Slug = slug.Value!;
        db.CodePuzzleOptions.RemoveRange(entity.Options);
        entity.Options.Clear();
        Apply(entity, input);
        entity.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return OperationResult<PuzzleAdminDto>.Success((await GetByIdAsync(id, ct))!);
    }

    public async Task<OperationResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var deleted = await db.CodePuzzles.Where(p => p.Id == id).ExecuteDeleteAsync(ct);
        return deleted == 0 ? OperationResult.NotFound("Задача не найдена.") : OperationResult.Success();
    }

    private static IQueryable<CodePuzzle> Ordered(IQueryable<CodePuzzle> query) =>
        query.OrderBy(p => p.Category.SortOrder)
            .ThenBy(p => p.Level.Rank)
            .ThenBy(p => p.Difficulty)
            .ThenBy(p => p.Title);

    private async Task<OperationResult> CheckReferencesAsync(PuzzleInput input, CancellationToken ct)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId, ct))
            return OperationResult.Invalid("Указанная категория не существует.");

        if (!await db.Levels.AnyAsync(l => l.Id == input.LevelId, ct))
            return OperationResult.Invalid("Указанный грейд не существует.");

        return OperationResult.Success();
    }

    private static void Apply(CodePuzzle e, PuzzleInput input)
    {
        e.Title = input.Title.Trim();
        e.Kind = input.Kind;
        e.Body = input.Body;
        e.Explanation = input.Explanation;
        e.Difficulty = input.Difficulty;
        e.Status = input.Status;
        e.CategoryId = input.CategoryId;
        e.LevelId = input.LevelId;

        for (var i = 0; i < input.Options.Count; i++)
            e.Options.Add(new CodePuzzleOption
            {
                Text = input.Options[i].Text.Trim(),
                IsCorrect = input.Options[i].IsCorrect,
                SortOrder = i
            });
    }
}
