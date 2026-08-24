using InterviewHub.Application.Common;
using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Common;
using InterviewHub.Domain.Entities;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Services;

public interface ICatalogAdminService
{
    Task<OperationResult<CategoryDto>> CreateCategoryAsync(CategoryInput input, CancellationToken ct = default);
    Task<OperationResult<CategoryDto>> UpdateCategoryAsync(Guid id, CategoryInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteCategoryAsync(Guid id, CancellationToken ct = default);

    Task<OperationResult<LevelDto>> CreateLevelAsync(LevelInput input, CancellationToken ct = default);
    Task<OperationResult<LevelDto>> UpdateLevelAsync(Guid id, LevelInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteLevelAsync(Guid id, CancellationToken ct = default);

    Task<OperationResult<CompanyDto>> CreateCompanyAsync(CompanyInput input, CancellationToken ct = default);
    Task<OperationResult<CompanyDto>> UpdateCompanyAsync(Guid id, CompanyInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteCompanyAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<TagDto>> GetAllTagsAsync(CancellationToken ct = default);
    Task<OperationResult<TagDto>> CreateTagAsync(TagInput input, CancellationToken ct = default);
    Task<OperationResult<TagDto>> UpdateTagAsync(Guid id, TagInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteTagAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// CRUD справочников. Категорию и грейд, на которые ссылаются вопросы, удалить нельзя —
/// в БД стоит Restrict, и без явной проверки Postgres вернул бы 500 вместо понятной 409.
/// Компании и теги связаны каскадно: их удаление рвёт связи, но не трогает сами вопросы,
/// поэтому предупреждаем только счётчиком в сообщении.
/// </summary>
public sealed class CatalogAdminService(AppDbContext db) : ICatalogAdminService
{
    // --- Категории ---

    public async Task<OperationResult<CategoryDto>> CreateCategoryAsync(
        CategoryInput input, CancellationToken ct = default)
    {
        var slug = await ResolveSlugAsync(db.Categories, input.Slug, input.Name, null, "category", ct);
        if (!slug.IsSuccess) return OperationResult<CategoryDto>.Conflict(slug.Message!);

        var entity = new Category { Slug = slug.Value! };
        Apply(entity, input);

        db.Categories.Add(entity);
        await db.SaveChangesAsync(ct);

        return OperationResult<CategoryDto>.Success(ToDto(entity, 0));
    }

    public async Task<OperationResult<CategoryDto>> UpdateCategoryAsync(
        Guid id, CategoryInput input, CancellationToken ct = default)
    {
        var entity = await db.Categories.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return OperationResult<CategoryDto>.NotFound("Категория не найдена.");

        var slug = await ResolveSlugAsync(db.Categories, input.Slug, input.Name, id, "category", ct);
        if (!slug.IsSuccess) return OperationResult<CategoryDto>.Conflict(slug.Message!);

        entity.Slug = slug.Value!;
        Apply(entity, input);
        await db.SaveChangesAsync(ct);

        var count = await db.Questions.CountAsync(q => q.CategoryId == id, ct);
        return OperationResult<CategoryDto>.Success(ToDto(entity, count));
    }

    public async Task<OperationResult> DeleteCategoryAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.Categories.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return OperationResult.NotFound("Категория не найдена.");

        var used = await db.Questions.CountAsync(q => q.CategoryId == id, ct);
        if (used > 0)
            return OperationResult.Conflict(
                $"Категория используется в {used} вопросах. Перенесите их в другую категорию.");

        db.Categories.Remove(entity);
        await db.SaveChangesAsync(ct);
        return OperationResult.Success();
    }

    // --- Грейды ---

    public async Task<OperationResult<LevelDto>> CreateLevelAsync(
        LevelInput input, CancellationToken ct = default)
    {
        var slug = await ResolveSlugAsync(db.Levels, input.Slug, input.Name, null, "level", ct);
        if (!slug.IsSuccess) return OperationResult<LevelDto>.Conflict(slug.Message!);

        var entity = new Level { Slug = slug.Value! };
        Apply(entity, input);

        db.Levels.Add(entity);
        await db.SaveChangesAsync(ct);

        return OperationResult<LevelDto>.Success(ToDto(entity, 0));
    }

    public async Task<OperationResult<LevelDto>> UpdateLevelAsync(
        Guid id, LevelInput input, CancellationToken ct = default)
    {
        var entity = await db.Levels.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return OperationResult<LevelDto>.NotFound("Грейд не найден.");

        var slug = await ResolveSlugAsync(db.Levels, input.Slug, input.Name, id, "level", ct);
        if (!slug.IsSuccess) return OperationResult<LevelDto>.Conflict(slug.Message!);

        entity.Slug = slug.Value!;
        Apply(entity, input);
        await db.SaveChangesAsync(ct);

        var count = await db.Questions.CountAsync(q => q.LevelId == id, ct);
        return OperationResult<LevelDto>.Success(ToDto(entity, count));
    }

    public async Task<OperationResult> DeleteLevelAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.Levels.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return OperationResult.NotFound("Грейд не найден.");

        var used = await db.Questions.CountAsync(q => q.LevelId == id, ct);
        if (used > 0)
            return OperationResult.Conflict(
                $"Грейд используется в {used} вопросах. Перенесите их на другой грейд.");

        db.Levels.Remove(entity);
        await db.SaveChangesAsync(ct);
        return OperationResult.Success();
    }

    // --- Компании ---

    public async Task<OperationResult<CompanyDto>> CreateCompanyAsync(
        CompanyInput input, CancellationToken ct = default)
    {
        var slug = await ResolveSlugAsync(db.Companies, input.Slug, input.Name, null, "company", ct);
        if (!slug.IsSuccess) return OperationResult<CompanyDto>.Conflict(slug.Message!);

        var entity = new Company { Slug = slug.Value! };
        Apply(entity, input);

        db.Companies.Add(entity);
        await db.SaveChangesAsync(ct);

        return OperationResult<CompanyDto>.Success(ToDto(entity, 0));
    }

    public async Task<OperationResult<CompanyDto>> UpdateCompanyAsync(
        Guid id, CompanyInput input, CancellationToken ct = default)
    {
        var entity = await db.Companies.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return OperationResult<CompanyDto>.NotFound("Компания не найдена.");

        var slug = await ResolveSlugAsync(db.Companies, input.Slug, input.Name, id, "company", ct);
        if (!slug.IsSuccess) return OperationResult<CompanyDto>.Conflict(slug.Message!);

        entity.Slug = slug.Value!;
        Apply(entity, input);
        await db.SaveChangesAsync(ct);

        var count = await db.QuestionCompanies.CountAsync(qc => qc.CompanyId == id, ct);
        return OperationResult<CompanyDto>.Success(ToDto(entity, count));
    }

    public async Task<OperationResult> DeleteCompanyAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.Companies.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return OperationResult.NotFound("Компания не найдена.");

        // Связи уйдут каскадом, сами вопросы останутся — но потерю привязок
        // стоит подтвердить осознанно, поэтому это тоже 409, а не молчаливое удаление.
        var used = await db.QuestionCompanies.CountAsync(qc => qc.CompanyId == id, ct);
        if (used > 0)
            return OperationResult.Conflict(
                $"Компания привязана к {used} вопросам. Сначала снимите привязки.");

        db.Companies.Remove(entity);
        await db.SaveChangesAsync(ct);
        return OperationResult.Success();
    }

    // --- Теги ---

    /// <summary>
    /// В отличие от публичного <see cref="CatalogService.GetTagsAsync"/> отдаёт и пустые теги:
    /// иначе только что созданный тег исчез бы из админки до первой привязки.
    /// </summary>
    public async Task<IReadOnlyList<TagDto>> GetAllTagsAsync(CancellationToken ct = default) =>
        await db.Tags.AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new TagDto(x.Id, x.Slug, x.Name, x.QuestionTags.Count))
            .ToListAsync(ct);

    public async Task<OperationResult<TagDto>> CreateTagAsync(
        TagInput input, CancellationToken ct = default)
    {
        var slug = await ResolveSlugAsync(db.Tags, input.Slug, input.Name, null, "tag", ct);
        if (!slug.IsSuccess) return OperationResult<TagDto>.Conflict(slug.Message!);

        var entity = new Tag { Slug = slug.Value!, Name = input.Name.Trim() };

        db.Tags.Add(entity);
        await db.SaveChangesAsync(ct);

        return OperationResult<TagDto>.Success(new TagDto(entity.Id, entity.Slug, entity.Name, 0));
    }

    public async Task<OperationResult<TagDto>> UpdateTagAsync(
        Guid id, TagInput input, CancellationToken ct = default)
    {
        var entity = await db.Tags.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return OperationResult<TagDto>.NotFound("Тег не найден.");

        var slug = await ResolveSlugAsync(db.Tags, input.Slug, input.Name, id, "tag", ct);
        if (!slug.IsSuccess) return OperationResult<TagDto>.Conflict(slug.Message!);

        entity.Slug = slug.Value!;
        entity.Name = input.Name.Trim();
        await db.SaveChangesAsync(ct);

        var count = await db.QuestionTags.CountAsync(qt => qt.TagId == id, ct);
        return OperationResult<TagDto>.Success(new TagDto(entity.Id, entity.Slug, entity.Name, count));
    }

    public async Task<OperationResult> DeleteTagAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.Tags.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return OperationResult.NotFound("Тег не найден.");

        // Теги — расходный материал: связи уходят каскадом, вопросы не страдают.
        db.Tags.Remove(entity);
        await db.SaveChangesAsync(ct);
        return OperationResult.Success();
    }

    // --- Общее ---

    private static void Apply(Category e, CategoryInput input)
    {
        e.Name = input.Name.Trim();
        e.Description = Normalize(input.Description);
        e.Icon = Normalize(input.Icon);
        e.Color = Normalize(input.Color);
        e.SortOrder = input.SortOrder;
    }

    private static void Apply(Level e, LevelInput input)
    {
        e.Name = input.Name.Trim();
        e.Rank = input.Rank;
        e.Color = Normalize(input.Color);
    }

    private static void Apply(Company e, CompanyInput input)
    {
        e.Name = input.Name.Trim();
        e.LogoUrl = Normalize(input.LogoUrl);
        e.Color = Normalize(input.Color);
        e.Description = Normalize(input.Description);
        e.Country = Normalize(input.Country);
        e.SortOrder = input.SortOrder;
    }

    private static CategoryDto ToDto(Category e, int count) =>
        new(e.Id, e.Slug, e.Name, e.Description, e.Icon, e.Color, e.SortOrder, count);

    private static LevelDto ToDto(Level e, int count) =>
        new(e.Id, e.Slug, e.Name, e.Rank, e.Color, count);

    private static CompanyDto ToDto(Company e, int count) =>
        new(e.Id, e.Slug, e.Name, e.LogoUrl, e.Color, e.Description, e.Country, e.SortOrder, count);

    /// <summary>
    /// Slug справочника: явный конфликтует при занятости, сгенерированный из имени
    /// получает суффикс. Ограничение в БД — 64 символа, поэтому подрезаем.
    /// </summary>
    private static async Task<OperationResult<string>> ResolveSlugAsync<T>(
        DbSet<T> set, string? explicitSlug, string name, Guid? exceptId,
        string fallback, CancellationToken ct)
        where T : class, ISluggable
    {
        Task<bool> IsTaken(string candidate, CancellationToken token) =>
            set.AnyAsync(x => x.Slug == candidate && (exceptId == null || x.Id != exceptId), token);

        if (!string.IsNullOrWhiteSpace(explicitSlug))
        {
            var slug = Trim64(SlugGenerator.Generate(explicitSlug));
            if (slug.Length == 0)
                return OperationResult<string>.Conflict("Slug пуст после нормализации.");

            if (await IsTaken(slug, ct))
                return OperationResult<string>.Conflict($"Slug \"{slug}\" уже занят.");

            return OperationResult<string>.Success(slug);
        }

        var generated = await SlugGenerator.GenerateUniqueAsync(
            Trim64(SlugGenerator.Generate(name)), IsTaken, fallback, ct);

        return OperationResult<string>.Success(generated);
    }

    /// <summary>Справочники объявлены как varchar(64) — режем до подбора суффикса.</summary>
    private static string Trim64(string slug) =>
        slug.Length <= 58 ? slug : slug[..58].TrimEnd('-');

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
