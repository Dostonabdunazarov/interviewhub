using InterviewHub.Application.Common;
using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Services;

public interface IQuestionService
{
    Task<PagedResult<QuestionListItemDto>> SearchAsync(QuestionQuery query, CancellationToken ct = default);
    Task<QuestionDetailDto?> GetBySlugAsync(string slug, bool publishedOnly, CancellationToken ct = default);
}

public sealed class QuestionService(AppDbContext db) : IQuestionService
{
    public async Task<PagedResult<QuestionListItemDto>> SearchAsync(
        QuestionQuery query, CancellationToken ct = default)
    {
        var q = db.Questions.AsNoTracking();

        // Status == null означает публичный запрос: гостям видно только опубликованное.
        // IncludeAllStatuses снимает фильтр целиком — это админский список.
        if (!query.IncludeAllStatuses)
            q = query.Status is null
                ? q.Where(x => x.Status == QuestionStatus.Published)
                : q.Where(x => x.Status == query.Status);

        if (!string.IsNullOrWhiteSpace(query.Category))
            q = q.Where(x => x.Category.Slug == query.Category);

        if (!string.IsNullOrWhiteSpace(query.Level))
            q = q.Where(x => x.Level.Slug == query.Level);

        if (!string.IsNullOrWhiteSpace(query.Company))
            q = q.Where(x => x.QuestionCompanies.Any(qc => qc.Company.Slug == query.Company));

        if (!string.IsNullOrWhiteSpace(query.Tag))
            q = q.Where(x => x.QuestionTags.Any(qt => qt.Tag.Slug == query.Tag));

        if (query.Difficulty is { } d)
            q = q.Where(x => x.Difficulty == d);

        if (query.IsFeatured is { } f)
            q = q.Where(x => x.IsFeatured == f);

        // Полнотекстовый поиск по генерируемой колонке tsvector (shadow property).
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            q = q.Where(x => EF.Property<NpgsqlTypes.NpgsqlTsVector>(x, "SearchVector")
                .Matches(EF.Functions.WebSearchToTsQuery("russian", term)));
        }

        var total = await q.CountAsync(ct);

        // Порядок по умолчанию — от простого к сложному: каталог открывают для
        // подготовки, и начинать логично с лёгких вопросов. Newest остаётся
        // доступным явно, но перестал быть значением по умолчанию.
        q = query.Sort switch
        {
            QuestionSort.Newest => q.OrderByDescending(x => x.CreatedAt),
            QuestionSort.Oldest => q.OrderBy(x => x.CreatedAt),
            QuestionSort.Popular => q.OrderByDescending(x => x.ViewCount).ThenByDescending(x => x.CreatedAt),
            QuestionSort.DifficultyDesc => q.OrderByDescending(x => x.Difficulty).ThenByDescending(x => x.CreatedAt),
            _ => q.OrderBy(x => x.Difficulty).ThenByDescending(x => x.CreatedAt)
        };

        var items = await q
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(x => new QuestionListItemDto(
                x.Id, x.Slug, x.Title, x.Difficulty, x.Status, x.ViewCount, x.IsFeatured,
                x.Answers.Count, x.CreatedAt,
                new RefDto(x.Category.Id, x.Category.Slug, x.Category.Name, x.Category.Color),
                new RefDto(x.Level.Id, x.Level.Slug, x.Level.Name, x.Level.Color),
                x.QuestionCompanies
                    .OrderBy(qc => qc.Company.SortOrder)
                    .Select(qc => new CompanyRefDto(
                        qc.Company.Id, qc.Company.Slug, qc.Company.Name,
                        qc.Company.LogoUrl, qc.Company.Color, qc.AskedYear, qc.Round))
                    .ToList(),
                x.QuestionTags
                    .Select(qt => new RefDto(qt.Tag.Id, qt.Tag.Slug, qt.Tag.Name, null))
                    .ToList()))
            .ToListAsync(ct);

        return new PagedResult<QuestionListItemDto>
        {
            Items = items,
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = total
        };
    }

    public async Task<QuestionDetailDto?> GetBySlugAsync(
        string slug, bool publishedOnly, CancellationToken ct = default)
    {
        var q = db.Questions.AsNoTracking().Where(x => x.Slug == slug);

        if (publishedOnly)
            q = q.Where(x => x.Status == QuestionStatus.Published);

        var dto = await q
            .Select(x => new QuestionDetailDto(
                x.Id, x.Slug, x.Title, x.Body, x.Difficulty, x.Status, x.ViewCount,
                x.IsFeatured, x.CreatedAt, x.UpdatedAt,
                new RefDto(x.Category.Id, x.Category.Slug, x.Category.Name, x.Category.Color),
                new RefDto(x.Level.Id, x.Level.Slug, x.Level.Name, x.Level.Color),
                x.QuestionCompanies
                    .OrderBy(qc => qc.Company.SortOrder)
                    .Select(qc => new CompanyRefDto(
                        qc.Company.Id, qc.Company.Slug, qc.Company.Name,
                        qc.Company.LogoUrl, qc.Company.Color, qc.AskedYear, qc.Round))
                    .ToList(),
                x.QuestionTags
                    .Select(qt => new RefDto(qt.Tag.Id, qt.Tag.Slug, qt.Tag.Name, null))
                    .ToList(),
                x.Answers
                    .OrderByDescending(a => a.IsPrimary)
                    .ThenBy(a => a.SortOrder)
                    .Select(a => new AnswerDto(
                        a.Id, a.Body, a.IsPrimary, a.SortOrder, a.CreatedAt, a.UpdatedAt))
                    .ToList()))
            .FirstOrDefaultAsync(ct);

        if (dto is null) return null;

        // Счётчик просмотров — прямой UPDATE, чтобы не тянуть сущность в трекинг.
        await db.Questions
            .Where(x => x.Id == dto.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ViewCount, x => x.ViewCount + 1), ct);

        return dto;
    }
}
