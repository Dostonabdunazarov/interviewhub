using System.Linq.Expressions;
using InterviewHub.Application.Common;
using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Entities;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Services;

public interface IQuestionAdminService
{
    Task<QuestionDetailDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<OperationResult<QuestionDetailDto>> CreateAsync(QuestionInput input, Guid? authorId, CancellationToken ct = default);
    Task<OperationResult<QuestionDetailDto>> UpdateAsync(Guid id, QuestionInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteAsync(Guid id, CancellationToken ct = default);

    Task<OperationResult<AnswerDto>> AddAnswerAsync(Guid questionId, AnswerInput input, CancellationToken ct = default);
    Task<OperationResult<AnswerDto>> UpdateAnswerAsync(Guid answerId, AnswerInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteAnswerAsync(Guid answerId, CancellationToken ct = default);
}

/// <summary>
/// Запись контента из админки. Читающая часть живёт в <see cref="QuestionService"/>:
/// там же реализован фильтр по статусу, который админка передаёт явно.
/// </summary>
public sealed class QuestionAdminService(AppDbContext db) : IQuestionAdminService
{
    public Task<QuestionDetailDto?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Questions.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(ProjectDetail)
            .FirstOrDefaultAsync(ct);

    public async Task<OperationResult<QuestionDetailDto>> CreateAsync(
        QuestionInput input, Guid? authorId, CancellationToken ct = default)
    {
        var invalid = await ValidateReferencesAsync(input, ct);
        if (invalid is not null) return OperationResult<QuestionDetailDto>.Invalid(invalid);

        var slug = await ResolveSlugAsync(input.Slug, input.Title, questionId: null, ct);
        if (!slug.IsSuccess) return OperationResult<QuestionDetailDto>.Conflict(slug.Message!);

        var question = new Question
        {
            Slug = slug.Value!,
            Title = input.Title.Trim(),
            Body = Normalize(input.Body),
            CategoryId = input.CategoryId,
            LevelId = input.LevelId,
            Difficulty = input.Difficulty,
            Status = input.Status,
            IsFeatured = input.IsFeatured,
            CreatedByUserId = authorId
        };

        ApplyCompanies(question, input.Companies);
        ApplyTags(question, input.TagIds);

        db.Questions.Add(question);
        await db.SaveChangesAsync(ct);

        return OperationResult<QuestionDetailDto>.Success((await GetByIdAsync(question.Id, ct))!);
    }

    public async Task<OperationResult<QuestionDetailDto>> UpdateAsync(
        Guid id, QuestionInput input, CancellationToken ct = default)
    {
        var question = await db.Questions
            .Include(x => x.QuestionCompanies)
            .Include(x => x.QuestionTags)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (question is null)
            return OperationResult<QuestionDetailDto>.NotFound("Вопрос не найден.");

        var invalid = await ValidateReferencesAsync(input, ct);
        if (invalid is not null) return OperationResult<QuestionDetailDto>.Invalid(invalid);

        // Slug не перегенерируется из нового заголовка молча: ссылка на вопрос
        // уже могла разойтись. Меняем, только если админ прислал slug явно.
        if (!string.IsNullOrWhiteSpace(input.Slug))
        {
            var slug = await ResolveSlugAsync(input.Slug, input.Title, id, ct);
            if (!slug.IsSuccess) return OperationResult<QuestionDetailDto>.Conflict(slug.Message!);
            question.Slug = slug.Value!;
        }

        question.Title = input.Title.Trim();
        question.Body = Normalize(input.Body);
        question.CategoryId = input.CategoryId;
        question.LevelId = input.LevelId;
        question.Difficulty = input.Difficulty;
        question.Status = input.Status;
        question.IsFeatured = input.IsFeatured;
        question.UpdatedAt = DateTime.UtcNow;

        // Связи заменяем целиком: PUT — это полное состояние, а не патч.
        db.QuestionCompanies.RemoveRange(question.QuestionCompanies);
        db.QuestionTags.RemoveRange(question.QuestionTags);
        question.QuestionCompanies = [];
        question.QuestionTags = [];
        ApplyCompanies(question, input.Companies);
        ApplyTags(question, input.TagIds);

        await db.SaveChangesAsync(ct);

        return OperationResult<QuestionDetailDto>.Success((await GetByIdAsync(id, ct))!);
    }

    public async Task<OperationResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var question = await db.Questions.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (question is null) return OperationResult.NotFound("Вопрос не найден.");

        // Ответы, связи с компаниями и тегами уходят каскадом (см. EF-конфигурации).
        db.Questions.Remove(question);
        await db.SaveChangesAsync(ct);

        return OperationResult.Success();
    }

    public async Task<OperationResult<AnswerDto>> AddAnswerAsync(
        Guid questionId, AnswerInput input, CancellationToken ct = default)
    {
        // Вопрос грузим в трекинг, а не проверяем AnyAsync: SyncSearchText в SaveChanges
        // пересобирает SearchText только у отслеживаемых вопросов (грабли №2).
        var question = await db.Questions
            .Include(x => x.Answers)
            .FirstOrDefaultAsync(x => x.Id == questionId, ct);

        if (question is null) return OperationResult<AnswerDto>.NotFound("Вопрос не найден.");

        var answer = new Answer
        {
            QuestionId = questionId,
            Body = input.Body.Trim(),
            IsPrimary = input.IsPrimary,
            SortOrder = input.SortOrder
        };

        // Add, а не только question.Answers.Add: BaseEntity задаёт Id в конструкторе,
        // поэтому по непустому ключу EF принимает сущность за существующую и
        // SaveChanges падает с "expected to affect 1 row(s), but actually affected 0".
        // Явный Add ставит состояние Added независимо от значения ключа.
        db.Answers.Add(answer);
        question.Answers.Add(answer);
        if (answer.IsPrimary) DemoteOtherPrimaries(question, answer.Id);

        await db.SaveChangesAsync(ct);

        return OperationResult<AnswerDto>.Success(ToDto(answer));
    }

    public async Task<OperationResult<AnswerDto>> UpdateAnswerAsync(
        Guid answerId, AnswerInput input, CancellationToken ct = default)
    {
        var answer = await db.Answers
            .Include(x => x.Question).ThenInclude(q => q.Answers)
            .FirstOrDefaultAsync(x => x.Id == answerId, ct);

        if (answer is null) return OperationResult<AnswerDto>.NotFound("Ответ не найден.");

        answer.Body = input.Body.Trim();
        answer.IsPrimary = input.IsPrimary;
        answer.SortOrder = input.SortOrder;
        answer.UpdatedAt = DateTime.UtcNow;

        if (answer.IsPrimary) DemoteOtherPrimaries(answer.Question, answer.Id);

        await db.SaveChangesAsync(ct);

        return OperationResult<AnswerDto>.Success(ToDto(answer));
    }

    public async Task<OperationResult> DeleteAnswerAsync(Guid answerId, CancellationToken ct = default)
    {
        // Question с ответами тянем ради SyncSearchText: без него в SearchText
        // остался бы текст удалённого ответа и поиск находил бы вопрос по нему.
        var answer = await db.Answers
            .Include(x => x.Question).ThenInclude(q => q.Answers)
            .FirstOrDefaultAsync(x => x.Id == answerId, ct);

        if (answer is null) return OperationResult.NotFound("Ответ не найден.");

        db.Answers.Remove(answer);
        await db.SaveChangesAsync(ct);

        return OperationResult.Success();
    }

    /// <summary>Основной ответ ровно один: назначение нового снимает флаг с прежнего.</summary>
    private static void DemoteOtherPrimaries(Question question, Guid keepId)
    {
        foreach (var other in question.Answers.Where(a => a.Id != keepId && a.IsPrimary))
            other.IsPrimary = false;
    }

    private static void ApplyCompanies(Question question, IReadOnlyList<QuestionCompanyInput>? companies)
    {
        if (companies is null) return;

        // DistinctBy: составной PK (QuestionId, CompanyId) не переживёт дубль в теле запроса.
        foreach (var c in companies.DistinctBy(c => c.CompanyId))
            question.QuestionCompanies.Add(new QuestionCompany
            {
                QuestionId = question.Id,
                CompanyId = c.CompanyId,
                AskedYear = c.AskedYear,
                Round = c.Round
            });
    }

    private static void ApplyTags(Question question, IReadOnlyList<Guid>? tagIds)
    {
        if (tagIds is null) return;

        foreach (var tagId in tagIds.Distinct())
            question.QuestionTags.Add(new QuestionTag { QuestionId = question.Id, TagId = tagId });
    }

    /// <summary>Проверяет ссылки до записи, чтобы вместо 500 от нарушения FK вернуть внятную 400.</summary>
    private async Task<string?> ValidateReferencesAsync(QuestionInput input, CancellationToken ct)
    {
        if (!await db.Categories.AnyAsync(x => x.Id == input.CategoryId, ct))
            return "Категория не найдена.";

        if (!await db.Levels.AnyAsync(x => x.Id == input.LevelId, ct))
            return "Грейд не найден.";

        var companyIds = input.Companies?.Select(c => c.CompanyId).Distinct().ToList() ?? [];
        if (companyIds.Count > 0 &&
            await db.Companies.CountAsync(x => companyIds.Contains(x.Id), ct) != companyIds.Count)
            return "Одна из компаний не найдена.";

        var tagIds = input.TagIds?.Distinct().ToList() ?? [];
        if (tagIds.Count > 0 &&
            await db.Tags.CountAsync(x => tagIds.Contains(x.Id), ct) != tagIds.Count)
            return "Один из тегов не найден.";

        return null;
    }

    /// <summary>
    /// Явно присланный slug уважается как есть (после нормализации) и конфликтует при занятости;
    /// сгенерированный из заголовка автоматически получает суффикс -2, -3.
    /// </summary>
    private async Task<OperationResult<string>> ResolveSlugAsync(
        string? explicitSlug, string title, Guid? questionId, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(explicitSlug))
        {
            var slug = SlugGenerator.Generate(explicitSlug);
            if (slug.Length == 0)
                return OperationResult<string>.Conflict("Slug пуст после нормализации.");

            if (await IsSlugTakenAsync(slug, questionId, ct))
                return OperationResult<string>.Conflict($"Slug \"{slug}\" уже занят.");

            return OperationResult<string>.Success(slug);
        }

        var generated = await SlugGenerator.GenerateUniqueAsync(
            title,
            (candidate, token) => IsSlugTakenAsync(candidate, questionId, token),
            fallback: "question",
            ct);

        return OperationResult<string>.Success(generated);
    }

    private Task<bool> IsSlugTakenAsync(string slug, Guid? exceptId, CancellationToken ct) =>
        db.Questions.AnyAsync(x => x.Slug == slug && (exceptId == null || x.Id != exceptId), ct);

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static AnswerDto ToDto(Answer a) =>
        new(a.Id, a.Body, a.IsPrimary, a.SortOrder, a.CreatedAt, a.UpdatedAt);

    /// <summary>Проекция детали вопроса — та же форма, что отдаёт публичное API.</summary>
    private static readonly Expression<Func<Question, QuestionDetailDto>> ProjectDetail =
        x => new QuestionDetailDto(
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
                .ToList(),
            // Привязками к теории управляет редактор статьи, а не вопроса:
            // в админском ответе этот блок пустой намеренно.
            new List<TheoryArticleRefDto>());
}
