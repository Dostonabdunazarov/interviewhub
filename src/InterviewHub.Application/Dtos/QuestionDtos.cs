using InterviewHub.Domain.Enums;

namespace InterviewHub.Application.Dtos;

/// <summary>Краткая карточка вопроса для списков — без тела и ответов.</summary>
public record QuestionListItemDto(
    Guid Id,
    string Slug,
    string Title,
    int Difficulty,
    QuestionStatus Status,
    int ViewCount,
    bool IsFeatured,
    int AnswerCount,
    DateTime CreatedAt,
    RefDto Category,
    RefDto Level,
    IReadOnlyList<CompanyRefDto> Companies,
    IReadOnlyList<RefDto> Tags);

/// <summary>Полный вопрос со всеми ответами.</summary>
public record QuestionDetailDto(
    Guid Id,
    string Slug,
    string Title,
    string? Body,
    int Difficulty,
    QuestionStatus Status,
    int ViewCount,
    bool IsFeatured,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    RefDto Category,
    RefDto Level,
    IReadOnlyList<CompanyRefDto> Companies,
    IReadOnlyList<RefDto> Tags,
    IReadOnlyList<AnswerDto> Answers,
    /// <summary>Статьи теории, к которым привязан вопрос — блок «Теория по теме».</summary>
    IReadOnlyList<TheoryArticleRefDto> TheoryArticles);

/// <summary>Ссылка на статью теории со страницы вопроса.</summary>
public record TheoryArticleRefDto(string Slug, string Title, int ReadingMinutes);

public record AnswerDto(
    Guid Id, string Body, bool IsPrimary, int SortOrder,
    DateTime CreatedAt, DateTime? UpdatedAt);

/// <summary>Минимальная ссылка на справочник — чтобы не раздувать ответы API.</summary>
public record RefDto(Guid Id, string Slug, string Name, string? Color = null);

/// <summary>Компания в контексте вопроса: с годом и этапом собеседования.</summary>
public record CompanyRefDto(
    Guid Id, string Slug, string Name, string? LogoUrl, string? Color,
    int? AskedYear, InterviewRound? Round);
