using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Services;

public interface ICatalogService
{
    Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<LevelDto>> GetLevelsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<CompanyDto>> GetCompaniesAsync(CancellationToken ct = default);
    Task<CompanyDto?> GetCompanyBySlugAsync(string slug, CancellationToken ct = default);
    Task<IReadOnlyList<TagDto>> GetTagsAsync(CancellationToken ct = default);
    Task<StatsDto> GetStatsAsync(CancellationToken ct = default);
}

/// <summary>
/// Справочники для навигации. Счётчики считают только опубликованные вопросы —
/// иначе гость увидит категорию с нулём доступных материалов.
/// </summary>
public sealed class CatalogService(AppDbContext db) : ICatalogService
{
    private const QuestionStatus Visible = QuestionStatus.Published;

    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken ct = default) =>
        await db.Categories.AsNoTracking()
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Select(x => new CategoryDto(
                x.Id, x.Slug, x.Name, x.Description, x.Icon, x.Color, x.SortOrder,
                x.Questions.Count(q => q.Status == Visible)))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<LevelDto>> GetLevelsAsync(CancellationToken ct = default) =>
        await db.Levels.AsNoTracking()
            .OrderBy(x => x.Rank)
            .Select(x => new LevelDto(
                x.Id, x.Slug, x.Name, x.Rank, x.Color,
                x.Questions.Count(q => q.Status == Visible)))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<CompanyDto>> GetCompaniesAsync(CancellationToken ct = default) =>
        await db.Companies.AsNoTracking()
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Select(x => new CompanyDto(
                x.Id, x.Slug, x.Name, x.LogoUrl, x.Color, x.Description, x.Country, x.SortOrder,
                x.QuestionCompanies.Count(qc => qc.Question.Status == Visible)))
            .ToListAsync(ct);

    public async Task<CompanyDto?> GetCompanyBySlugAsync(string slug, CancellationToken ct = default) =>
        await db.Companies.AsNoTracking()
            .Where(x => x.Slug == slug)
            .Select(x => new CompanyDto(
                x.Id, x.Slug, x.Name, x.LogoUrl, x.Color, x.Description, x.Country, x.SortOrder,
                x.QuestionCompanies.Count(qc => qc.Question.Status == Visible)))
            .FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<TagDto>> GetTagsAsync(CancellationToken ct = default) =>
        // Фильтр и сортировка — по выражению над сущностью, а не по полю уже собранного DTO:
        // Where поверх спроецированного TagDto Npgsql перевести не может и падает с 500.
        await db.Tags.AsNoTracking()
            .Where(x => x.QuestionTags.Any(qt => qt.Question.Status == Visible))
            .OrderByDescending(x => x.QuestionTags.Count(qt => qt.Question.Status == Visible))
            .ThenBy(x => x.Name)
            .Select(x => new TagDto(
                x.Id, x.Slug, x.Name,
                x.QuestionTags.Count(qt => qt.Question.Status == Visible)))
            .ToListAsync(ct);

    public async Task<StatsDto> GetStatsAsync(CancellationToken ct = default)
    {
        var totalQuestions = await db.Questions.CountAsync(x => x.Status == Visible, ct);
        var totalCompanies = await db.Companies.CountAsync(ct);
        var categories = await GetCategoriesAsync(ct);
        var levels = await GetLevelsAsync(ct);

        return new StatsDto(totalQuestions, totalCompanies, categories.Count, levels, categories);
    }
}
