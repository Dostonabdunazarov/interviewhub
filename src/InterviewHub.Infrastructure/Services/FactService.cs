using InterviewHub.Application.Common;
using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Entities;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace InterviewHub.Infrastructure.Services;

public interface IFactService
{
    Task<IReadOnlyList<FactDto>> GetPublishedAsync(string? category, CancellationToken ct = default);

    Task<IReadOnlyList<FactAdminDto>> GetAllAsync(CancellationToken ct = default);
    Task<FactAdminDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<OperationResult<FactAdminDto>> CreateAsync(FactInput input, Guid? userId, CancellationToken ct = default);
    Task<OperationResult<FactAdminDto>> UpdateAsync(Guid id, FactInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class FactService(AppDbContext db, IMemoryCache cache) : IFactService
{
    private const string CacheKey = "facts.published";
    private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(15);

    public async Task<IReadOnlyList<FactDto>> GetPublishedAsync(
        string? category, CancellationToken ct = default)
    {
        if (!cache.TryGetValue(CacheKey, out IReadOnlyList<FactDto>? facts) || facts is null)
        {
            facts = await db.DevFacts.AsNoTracking()
                .Where(f => f.Status == QuestionStatus.Published)
                .OrderBy(f => f.Category == null ? int.MaxValue : f.Category.SortOrder)
                .ThenBy(f => f.Title)
                .Select(f => new FactDto(
                    f.Id, f.Slug, f.Title, f.Body,
                    f.Category == null
                        ? null
                        : new RefDto(f.Category.Id, f.Category.Slug, f.Category.Name, f.Category.Color),
                    f.CreatedAt))
                .ToListAsync(ct);

            cache.Set(CacheKey, facts, CacheFor);
        }

        return string.IsNullOrWhiteSpace(category)
            ? facts
            : facts.Where(f => f.Category?.Slug == category).ToList();
    }

    public async Task<IReadOnlyList<FactAdminDto>> GetAllAsync(CancellationToken ct = default) =>
        await db.DevFacts.AsNoTracking()
            .OrderByDescending(f => f.CreatedAt)
            .Select(ToAdminDto())
            .ToListAsync(ct);

    public async Task<FactAdminDto?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.DevFacts.AsNoTracking()
            .Where(f => f.Id == id)
            .Select(ToAdminDto())
            .FirstOrDefaultAsync(ct);

    public async Task<OperationResult<FactAdminDto>> CreateAsync(
        FactInput input, Guid? userId, CancellationToken ct = default)
    {
        if (!await CategoryExistsAsync(input.CategoryId, ct))
            return OperationResult<FactAdminDto>.Invalid("Указанная категория не существует.");

        var slug = await SlugResolver.ResolveAsync(
            db.DevFacts, input.Slug, input.Title, null, null, "fact", ct);
        if (!slug.IsSuccess) return OperationResult<FactAdminDto>.Conflict(slug.Message!);

        var entity = new DevFact { Slug = slug.Value!, CreatedByUserId = userId };
        Apply(entity, input);

        db.DevFacts.Add(entity);
        await SaveAsync(ct);

        return OperationResult<FactAdminDto>.Success((await GetByIdAsync(entity.Id, ct))!);
    }

    public async Task<OperationResult<FactAdminDto>> UpdateAsync(
        Guid id, FactInput input, CancellationToken ct = default)
    {
        var entity = await db.DevFacts.FirstOrDefaultAsync(f => f.Id == id, ct);
        if (entity is null) return OperationResult<FactAdminDto>.NotFound("Факт не найден.");

        if (!await CategoryExistsAsync(input.CategoryId, ct))
            return OperationResult<FactAdminDto>.Invalid("Указанная категория не существует.");

        var slug = await SlugResolver.ResolveAsync(
            db.DevFacts, input.Slug, input.Title, id, entity.Slug, "fact", ct);
        if (!slug.IsSuccess) return OperationResult<FactAdminDto>.Conflict(slug.Message!);

        entity.Slug = slug.Value!;
        Apply(entity, input);
        entity.UpdatedAt = DateTime.UtcNow;

        await SaveAsync(ct);

        return OperationResult<FactAdminDto>.Success((await GetByIdAsync(id, ct))!);
    }

    public async Task<OperationResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var deleted = await db.DevFacts.Where(f => f.Id == id).ExecuteDeleteAsync(ct);
        if (deleted == 0) return OperationResult.NotFound("Факт не найден.");

        cache.Remove(CacheKey);
        return OperationResult.Success();
    }

    private async Task SaveAsync(CancellationToken ct)
    {
        await db.SaveChangesAsync(ct);
        cache.Remove(CacheKey);
    }

    private async Task<bool> CategoryExistsAsync(Guid? categoryId, CancellationToken ct) =>
        categoryId is not { } id || await db.Categories.AnyAsync(c => c.Id == id, ct);

    private static System.Linq.Expressions.Expression<Func<DevFact, FactAdminDto>> ToAdminDto() =>
        f => new FactAdminDto(
            f.Id, f.Slug, f.Title, f.Body, f.Status, f.CategoryId,
            f.Category == null ? null : f.Category.Name,
            f.CreatedAt, f.UpdatedAt);

    private static void Apply(DevFact e, FactInput input)
    {
        e.Title = input.Title.Trim();
        e.Body = input.Body;
        e.Status = input.Status;
        e.CategoryId = input.CategoryId;
    }
}
