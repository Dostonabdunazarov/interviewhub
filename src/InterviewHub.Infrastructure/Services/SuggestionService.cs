using InterviewHub.Application.Common;
using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Entities;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Services;

public interface ISuggestionService
{
    Task SubmitAsync(SuggestionInput input, CancellationToken ct = default);

    Task<PagedResult<SuggestionDto>> SearchAsync(
        SuggestionStatus? status, int page, int pageSize, CancellationToken ct = default);
    Task<SuggestionCountsDto> GetCountsAsync(CancellationToken ct = default);
    Task<OperationResult<SuggestionDto>> UpdateAsync(Guid id, SuggestionUpdateInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class SuggestionService(AppDbContext db) : ISuggestionService
{
    private const int MaxPageSize = 100;

    public async Task SubmitAsync(SuggestionInput input, CancellationToken ct = default)
    {
        db.Suggestions.Add(new Suggestion
        {
            Kind = input.Kind,
            Text = input.Text.Trim(),
            AnswerDraft = SlugResolver.Normalize(input.AnswerDraft),
            Category = SlugResolver.Normalize(input.Category),
            Level = SlugResolver.Normalize(input.Level),
            Company = SlugResolver.Normalize(input.Company),
            Round = SlugResolver.Normalize(input.Round),
            Contact = SlugResolver.Normalize(input.Contact),
            TargetType = SlugResolver.Normalize(input.TargetType),
            TargetSlug = SlugResolver.Normalize(input.TargetSlug)
        });

        await db.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<SuggestionDto>> SearchAsync(
        SuggestionStatus? status, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = db.Suggestions.AsNoTracking();
        if (status is { } st) query = query.Where(s => s.Status == st);

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => ToDto(s))
            .ToListAsync(ct);

        return new PagedResult<SuggestionDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }

    public async Task<SuggestionCountsDto> GetCountsAsync(CancellationToken ct = default)
    {
        var counts = await db.Suggestions.AsNoTracking()
            .GroupBy(s => s.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, ct);

        return new SuggestionCountsDto(
            counts.GetValueOrDefault(SuggestionStatus.New),
            counts.GetValueOrDefault(SuggestionStatus.Accepted),
            counts.GetValueOrDefault(SuggestionStatus.Rejected));
    }

    public async Task<OperationResult<SuggestionDto>> UpdateAsync(
        Guid id, SuggestionUpdateInput input, CancellationToken ct = default)
    {
        var entity = await db.Suggestions.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (entity is null) return OperationResult<SuggestionDto>.NotFound("Предложение не найдено.");

        entity.Status = input.Status;
        entity.AdminNote = SlugResolver.Normalize(input.AdminNote);
        entity.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return OperationResult<SuggestionDto>.Success(ToDto(entity));
    }

    public async Task<OperationResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var deleted = await db.Suggestions.Where(s => s.Id == id).ExecuteDeleteAsync(ct);
        return deleted == 0 ? OperationResult.NotFound("Предложение не найдено.") : OperationResult.Success();
    }

    private static SuggestionDto ToDto(Suggestion s) =>
        new(s.Id, s.Kind, s.Text, s.AnswerDraft, s.Category, s.Level, s.Company, s.Round,
            s.Contact, s.TargetType, s.TargetSlug, s.Status, s.AdminNote, s.CreatedAt, s.UpdatedAt);
}
