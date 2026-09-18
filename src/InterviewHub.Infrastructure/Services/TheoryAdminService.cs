using InterviewHub.Application.Common;
using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Common;
using InterviewHub.Domain.Entities;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Services;

public interface ITheoryAdminService
{
    Task<IReadOnlyList<TheoryTrackAdminDto>> GetTreeAsync(CancellationToken ct = default);

    Task<OperationResult<TheoryTrackAdminDto>> CreateTrackAsync(TheoryTrackInput input, CancellationToken ct = default);
    Task<OperationResult<TheoryTrackAdminDto>> UpdateTrackAsync(Guid id, TheoryTrackInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteTrackAsync(Guid id, CancellationToken ct = default);

    Task<OperationResult<TheorySectionAdminDto>> CreateSectionAsync(TheorySectionInput input, CancellationToken ct = default);
    Task<OperationResult<TheorySectionAdminDto>> UpdateSectionAsync(Guid id, TheorySectionInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteSectionAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<TheoryArticleListItemDto>> GetArticlesAsync(
        Guid? sectionId, Guid? trackId, TheoryStatus? status, string? q, CancellationToken ct = default);
    Task<TheoryArticleAdminDto?> GetArticleByIdAsync(Guid id, CancellationToken ct = default);
    Task<OperationResult<TheoryArticleAdminDto>> CreateArticleAsync(TheoryArticleInput input, Guid? userId, CancellationToken ct = default);
    Task<OperationResult<TheoryArticleAdminDto>> UpdateArticleAsync(Guid id, TheoryArticleInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteArticleAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// CRUD теории. Каждая запись сбрасывает кэш публичного дерева — иначе правка
/// из админки доезжала бы до сайта только через 15 минут, и редактор решил бы,
/// что она не сохранилась.
/// </summary>
public sealed class TheoryAdminService(AppDbContext db, ITheoryService theory) : ITheoryAdminService
{
    // --- Дерево ---

    /// <summary>
    /// Дерево для админки: в отличие от публичного показывает неопубликованные
    /// треки и пустые разделы — иначе только что созданный раздел исчез бы
    /// до первой статьи, и в него нельзя было бы её положить.
    /// </summary>
    public async Task<IReadOnlyList<TheoryTrackAdminDto>> GetTreeAsync(CancellationToken ct = default) =>
        await db.TheoryTracks.AsNoTracking()
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Name)
            .Select(t => new TheoryTrackAdminDto(
                t.Id, t.Slug, t.Name, t.Description, t.Icon, t.Color,
                t.SortOrder, t.IsPublished,
                t.Sections.SelectMany(s => s.Articles).Count(),
                t.Sections
                    .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
                    .Select(s => new TheorySectionAdminDto(
                        s.Id, s.Slug, s.Name, s.Description, s.SortOrder, s.Articles.Count))
                    .ToList()))
            .ToListAsync(ct);

    // --- Треки ---

    public async Task<OperationResult<TheoryTrackAdminDto>> CreateTrackAsync(
        TheoryTrackInput input, CancellationToken ct = default)
    {
        var slug = await ResolveSlugAsync(db.TheoryTracks, input.Slug, input.Name, null, "track", null, ct);
        if (!slug.IsSuccess) return OperationResult<TheoryTrackAdminDto>.Conflict(slug.Message!);

        var entity = new TheoryTrack { Slug = slug.Value! };
        Apply(entity, input);

        db.TheoryTracks.Add(entity);
        await SaveAsync(ct);

        return OperationResult<TheoryTrackAdminDto>.Success(ToDto(entity, 0, []));
    }

    public async Task<OperationResult<TheoryTrackAdminDto>> UpdateTrackAsync(
        Guid id, TheoryTrackInput input, CancellationToken ct = default)
    {
        var entity = await db.TheoryTracks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return OperationResult<TheoryTrackAdminDto>.NotFound("Трек не найден.");

        var slug = await ResolveSlugAsync(db.TheoryTracks, input.Slug, input.Name, id, "track", entity.Slug, ct);
        if (!slug.IsSuccess) return OperationResult<TheoryTrackAdminDto>.Conflict(slug.Message!);

        entity.Slug = slug.Value!;
        Apply(entity, input);
        await SaveAsync(ct);

        var sections = await db.TheorySections.AsNoTracking()
            .Where(s => s.TrackId == id)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(s => new TheorySectionAdminDto(
                s.Id, s.Slug, s.Name, s.Description, s.SortOrder, s.Articles.Count))
            .ToListAsync(ct);

        var articles = sections.Sum(s => s.ArticleCount);
        return OperationResult<TheoryTrackAdminDto>.Success(ToDto(entity, articles, sections));
    }

    public async Task<OperationResult> DeleteTrackAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.TheoryTracks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return OperationResult.NotFound("Трек не найден.");

        // В БД стоит Restrict: без этой проверки Postgres вернул бы 500
        // вместо понятного объяснения, что именно мешает.
        var sections = await db.TheorySections.CountAsync(s => s.TrackId == id, ct);
        if (sections > 0)
            return OperationResult.Conflict(
                $"В треке {sections} разделов. Сначала удалите или перенесите их.");

        db.TheoryTracks.Remove(entity);
        await SaveAsync(ct);
        return OperationResult.Success();
    }

    // --- Разделы ---

    public async Task<OperationResult<TheorySectionAdminDto>> CreateSectionAsync(
        TheorySectionInput input, CancellationToken ct = default)
    {
        if (!await db.TheoryTracks.AnyAsync(t => t.Id == input.TrackId, ct))
            return OperationResult<TheorySectionAdminDto>.Invalid("Указанный трек не существует.");

        var slug = await ResolveSectionSlugAsync(input.TrackId, input.Slug, input.Name, null, null, ct);
        if (!slug.IsSuccess) return OperationResult<TheorySectionAdminDto>.Conflict(slug.Message!);

        var entity = new TheorySection { Slug = slug.Value!, TrackId = input.TrackId };
        Apply(entity, input);

        db.TheorySections.Add(entity);
        await SaveAsync(ct);

        return OperationResult<TheorySectionAdminDto>.Success(ToDto(entity, 0));
    }

    public async Task<OperationResult<TheorySectionAdminDto>> UpdateSectionAsync(
        Guid id, TheorySectionInput input, CancellationToken ct = default)
    {
        var entity = await db.TheorySections.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return OperationResult<TheorySectionAdminDto>.NotFound("Раздел не найден.");

        if (!await db.TheoryTracks.AnyAsync(t => t.Id == input.TrackId, ct))
            return OperationResult<TheorySectionAdminDto>.Invalid("Указанный трек не существует.");

        // Slug проверяем против нового трека: раздел можно переносить, и там
        // его slug может оказаться занят.
        var slug = await ResolveSectionSlugAsync(input.TrackId, input.Slug, input.Name, id, entity.Slug, ct);
        if (!slug.IsSuccess) return OperationResult<TheorySectionAdminDto>.Conflict(slug.Message!);

        entity.Slug = slug.Value!;
        entity.TrackId = input.TrackId;
        Apply(entity, input);
        await SaveAsync(ct);

        var count = await db.TheoryArticles.CountAsync(a => a.SectionId == id, ct);
        return OperationResult<TheorySectionAdminDto>.Success(ToDto(entity, count));
    }

    public async Task<OperationResult> DeleteSectionAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.TheorySections.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return OperationResult.NotFound("Раздел не найден.");

        var used = await db.TheoryArticles.CountAsync(a => a.SectionId == id, ct);
        if (used > 0)
            return OperationResult.Conflict(
                $"В разделе {used} статей. Перенесите их в другой раздел или удалите.");

        db.TheorySections.Remove(entity);
        await SaveAsync(ct);
        return OperationResult.Success();
    }

    // --- Статьи ---

    public async Task<IReadOnlyList<TheoryArticleListItemDto>> GetArticlesAsync(
        Guid? sectionId, Guid? trackId, TheoryStatus? status, string? q,
        CancellationToken ct = default)
    {
        var query = db.TheoryArticles.AsNoTracking();

        if (sectionId is { } s) query = query.Where(a => a.SectionId == s);
        if (trackId is { } t) query = query.Where(a => a.Section.TrackId == t);
        if (status is { } st) query = query.Where(a => a.Status == st);

        // Тот же tsvector, что и у публичного поиска: колонка уже есть,
        // а LIKE по Body на длинных статьях читал бы всю таблицу.
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(a => EF.Property<NpgsqlTypes.NpgsqlTsVector>(a, "SearchVector")
                .Matches(EF.Functions.WebSearchToTsQuery("russian", term)));
        }

        return await query
            .OrderBy(a => a.Section.Track.SortOrder)
            .ThenBy(a => a.Section.SortOrder)
            .ThenBy(a => a.SortOrder)
            .Select(a => new TheoryArticleListItemDto(
                a.Id, a.Slug, a.Title, a.Summary, a.SortOrder, a.Status,
                a.ReadingMinutes, a.ViewCount, a.CreatedAt, a.UpdatedAt,
                a.SectionId, a.Section.Name, a.Section.Track.Name,
                a.Level == null
                    ? null
                    : new RefDto(a.Level.Id, a.Level.Slug, a.Level.Name, a.Level.Color),
                a.ArticleQuestions.Count))
            .ToListAsync(ct);
    }

    public async Task<TheoryArticleAdminDto?> GetArticleByIdAsync(
        Guid id, CancellationToken ct = default) =>
        await db.TheoryArticles.AsNoTracking()
            .Where(a => a.Id == id)
            .Select(a => new TheoryArticleAdminDto(
                a.Id, a.Slug, a.Title, a.Summary, a.Body, a.SortOrder, a.Status,
                a.ReadingMinutes, a.ViewCount, a.CreatedAt, a.UpdatedAt,
                a.SectionId, a.Section.TrackId, a.LevelId,
                // В админке показываем и привязанные черновики: иначе редактор
                // не поймёт, почему вопрос «не привязывается» второй раз.
                a.ArticleQuestions
                    .OrderBy(aq => aq.SortOrder)
                    .Select(aq => new TheoryRelatedQuestionDto(
                        aq.Question.Id, aq.Question.Slug, aq.Question.Title, aq.Question.Difficulty,
                        new RefDto(aq.Question.Level.Id, aq.Question.Level.Slug,
                                   aq.Question.Level.Name, aq.Question.Level.Color)))
                    .ToList()))
            .FirstOrDefaultAsync(ct);

    public async Task<OperationResult<TheoryArticleAdminDto>> CreateArticleAsync(
        TheoryArticleInput input, Guid? userId, CancellationToken ct = default)
    {
        if (!await db.TheorySections.AnyAsync(s => s.Id == input.SectionId, ct))
            return OperationResult<TheoryArticleAdminDto>.Invalid("Указанный раздел не существует.");

        if (input.LevelId is { } levelId && !await db.Levels.AnyAsync(l => l.Id == levelId, ct))
            return OperationResult<TheoryArticleAdminDto>.Invalid("Указанный грейд не существует.");

        var slug = await ResolveSlugAsync(db.TheoryArticles, input.Slug, input.Title, null, "article", null, ct);
        if (!slug.IsSuccess) return OperationResult<TheoryArticleAdminDto>.Conflict(slug.Message!);

        var entity = new TheoryArticle { Slug = slug.Value!, CreatedByUserId = userId };
        Apply(entity, input);

        db.TheoryArticles.Add(entity);

        var links = await SyncQuestionsAsync(entity, input.QuestionIds, ct);
        if (!links.IsSuccess) return OperationResult<TheoryArticleAdminDto>.Invalid(links.Message!);

        await SaveAsync(ct);

        return OperationResult<TheoryArticleAdminDto>.Success(
            (await GetArticleByIdAsync(entity.Id, ct))!);
    }

    public async Task<OperationResult<TheoryArticleAdminDto>> UpdateArticleAsync(
        Guid id, TheoryArticleInput input, CancellationToken ct = default)
    {
        var entity = await db.TheoryArticles
            .Include(a => a.ArticleQuestions)
            .FirstOrDefaultAsync(a => a.Id == id, ct);

        if (entity is null) return OperationResult<TheoryArticleAdminDto>.NotFound("Статья не найдена.");

        if (!await db.TheorySections.AnyAsync(s => s.Id == input.SectionId, ct))
            return OperationResult<TheoryArticleAdminDto>.Invalid("Указанный раздел не существует.");

        if (input.LevelId is { } levelId && !await db.Levels.AnyAsync(l => l.Id == levelId, ct))
            return OperationResult<TheoryArticleAdminDto>.Invalid("Указанный грейд не существует.");

        var slug = await ResolveSlugAsync(db.TheoryArticles, input.Slug, input.Title, id, "article", entity.Slug, ct);
        if (!slug.IsSuccess) return OperationResult<TheoryArticleAdminDto>.Conflict(slug.Message!);

        entity.Slug = slug.Value!;
        Apply(entity, input);
        entity.UpdatedAt = DateTime.UtcNow;

        var links = await SyncQuestionsAsync(entity, input.QuestionIds, ct);
        if (!links.IsSuccess) return OperationResult<TheoryArticleAdminDto>.Invalid(links.Message!);

        await SaveAsync(ct);

        return OperationResult<TheoryArticleAdminDto>.Success((await GetArticleByIdAsync(id, ct))!);
    }

    public async Task<OperationResult> DeleteArticleAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.TheoryArticles.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (entity is null) return OperationResult.NotFound("Статья не найдена.");

        // Связи с вопросами уйдут каскадом — сами вопросы не пострадают.
        db.TheoryArticles.Remove(entity);
        await SaveAsync(ct);
        return OperationResult.Success();
    }

    // --- Общее ---

    /// <summary>
    /// Сохранение с инвалидацией публичного дерева. Отдельный метод, чтобы
    /// сброс кэша нельзя было забыть в одной из десяти операций записи.
    /// </summary>
    private async Task SaveAsync(CancellationToken ct)
    {
        await db.SaveChangesAsync(ct);
        theory.InvalidateTree();
    }

    /// <summary>
    /// Приводит набор привязанных вопросов к переданному списку. Порядок — как
    /// в списке: редактор расставляет вопросы осмысленно, от простого к сложному.
    /// </summary>
    private async Task<OperationResult> SyncQuestionsAsync(
        TheoryArticle article, IReadOnlyList<Guid>? questionIds, CancellationToken ct)
    {
        if (questionIds is null) return OperationResult.Success();

        // Дубли в запросе уронили бы вставку по составному ключу.
        var wanted = questionIds.Distinct().ToList();

        if (wanted.Count > 0)
        {
            var existing = await db.Questions.CountAsync(q => wanted.Contains(q.Id), ct);
            if (existing != wanted.Count)
                return OperationResult.Invalid("Часть указанных вопросов не существует.");
        }

        article.ArticleQuestions.Clear();

        for (var i = 0; i < wanted.Count; i++)
            article.ArticleQuestions.Add(new TheoryArticleQuestion
            {
                ArticleId = article.Id,
                QuestionId = wanted[i],
                SortOrder = i
            });

        return OperationResult.Success();
    }

    private static void Apply(TheoryTrack e, TheoryTrackInput input)
    {
        e.Name = input.Name.Trim();
        e.Description = Normalize(input.Description);
        e.Icon = Normalize(input.Icon);
        e.Color = Normalize(input.Color);
        e.SortOrder = input.SortOrder;
        e.IsPublished = input.IsPublished;
    }

    private static void Apply(TheorySection e, TheorySectionInput input)
    {
        e.Name = input.Name.Trim();
        e.Description = Normalize(input.Description);
        e.SortOrder = input.SortOrder;
    }

    private static void Apply(TheoryArticle e, TheoryArticleInput input)
    {
        e.Title = input.Title.Trim();
        e.Summary = Normalize(input.Summary);
        e.Body = input.Body;
        e.SortOrder = input.SortOrder;
        e.Status = input.Status;
        e.SectionId = input.SectionId;
        e.LevelId = input.LevelId;
        // ReadingMinutes не трогаем — его считает AppDbContext.SaveChangesAsync.
    }

    private static TheoryTrackAdminDto ToDto(
        TheoryTrack e, int articles, IReadOnlyList<TheorySectionAdminDto> sections) =>
        new(e.Id, e.Slug, e.Name, e.Description, e.Icon, e.Color,
            e.SortOrder, e.IsPublished, articles, sections);

    private static TheorySectionAdminDto ToDto(TheorySection e, int articles) =>
        new(e.Id, e.Slug, e.Name, e.Description, e.SortOrder, articles);

    /// <summary>
    /// Slug раздела уникален в пределах трека, а не глобально, поэтому у него
    /// свой резолвер: общий проверял бы занятость по всей таблице и запрещал бы
    /// `postgresql` во втором треке.
    /// </summary>
    private async Task<OperationResult<string>> ResolveSectionSlugAsync(
        Guid trackId, string? explicitSlug, string name, Guid? exceptId,
        string? currentSlug, CancellationToken ct)
    {
        Task<bool> IsTaken(string candidate, CancellationToken token) =>
            db.TheorySections.AnyAsync(
                x => x.TrackId == trackId && x.Slug == candidate
                     && (exceptId == null || x.Id != exceptId),
                token);

        return await ResolveWithAsync(IsTaken, explicitSlug, name, "section", 120, currentSlug, ct);
    }

    private static async Task<OperationResult<string>> ResolveSlugAsync<T>(
        DbSet<T> set, string? explicitSlug, string name, Guid? exceptId,
        string fallback, string? currentSlug, CancellationToken ct)
        where T : class, ISluggable
    {
        Task<bool> IsTaken(string candidate, CancellationToken token) =>
            set.AnyAsync(x => x.Slug == candidate && (exceptId == null || x.Id != exceptId), token);

        // Трек и раздел — varchar(128), статья — varchar(256).
        var maxLength = typeof(T) == typeof(TheoryArticle) ? 240 : 120;
        return await ResolveWithAsync(IsTaken, explicitSlug, name, fallback, maxLength, currentSlug, ct);
    }

    private static async Task<OperationResult<string>> ResolveWithAsync(
        Func<string, CancellationToken, Task<bool>> isTaken,
        string? explicitSlug, string name, string fallback, int maxLength,
        string? currentSlug, CancellationToken ct)
    {
        string Trim(string slug) => slug.Length <= maxLength ? slug : slug[..maxLength].TrimEnd('-');

        // При правке пустой slug означает «оставить прежним», а не «перегенерировать
        // из названия»: иначе правка описания трека «.NET Backend» переписала бы
        // dotnet-backend в net-backend и молча сломала бы ссылки и карту сайта.
        //
        // Занятость всё равно проверяем: при переносе раздела в другой трек
        // прежний slug там может быть занят, и без проверки это упало бы
        // нарушением уникального индекса, то есть 500 вместо внятной 409.
        if (string.IsNullOrWhiteSpace(explicitSlug) && currentSlug is not null)
            return await isTaken(currentSlug, ct)
                ? OperationResult<string>.Conflict(
                    $"Slug \"{currentSlug}\" уже занят в целевом треке. Задайте другой.")
                : OperationResult<string>.Success(currentSlug);

        if (!string.IsNullOrWhiteSpace(explicitSlug))
        {
            var slug = Trim(SlugGenerator.Generate(explicitSlug));
            if (slug.Length == 0)
                return OperationResult<string>.Conflict("Slug пуст после нормализации.");

            if (await isTaken(slug, ct))
                return OperationResult<string>.Conflict($"Slug \"{slug}\" уже занят.");

            return OperationResult<string>.Success(slug);
        }

        var generated = await SlugGenerator.GenerateUniqueAsync(
            Trim(SlugGenerator.Generate(name)), isTaken, fallback, ct);

        return OperationResult<string>.Success(generated);
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
