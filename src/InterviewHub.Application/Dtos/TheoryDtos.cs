using InterviewHub.Domain.Enums;

namespace InterviewHub.Application.Dtos;

// ── Дерево ────────────────────────────────────────────────────────────────
// Один запрос на весь сайдбар: он есть на каждой странице раздела, а
// подгружать разделы по клику значило бы ждать спиннер на каждом раскрытии.

/// <summary>Всё дерево теории: треки → разделы → статьи. Отдаётся одним запросом.</summary>
public record TheoryTreeDto(IReadOnlyList<TheoryTrackNodeDto> Tracks);

public record TheoryTrackNodeDto(
    string Slug,
    string Name,
    string? Description,
    string? Icon,
    string? Color,
    int ArticleCount,
    IReadOnlyList<TheorySectionNodeDto> Sections);

public record TheorySectionNodeDto(
    string Slug,
    string Name,
    string? Description,
    int ArticleCount,
    IReadOnlyList<TheoryArticleNodeDto> Articles);

/// <summary>
/// Статья в дереве — только то, что рисуется в сайдбаре и оглавлении.
/// Тела здесь нет намеренно: 190 статей с markdown в одном ответе — мегабайты.
/// </summary>
public record TheoryArticleNodeDto(
    string Slug,
    string Title,
    string? Summary,
    int ReadingMinutes,
    RefDto? Level);

// ── Статья ────────────────────────────────────────────────────────────────

/// <summary>Статья целиком: тело, хлебные крошки, соседи и связанные вопросы.</summary>
public record TheoryArticleDetailDto(
    Guid Id,
    string Slug,
    string Title,
    string? Summary,
    string Body,
    int ReadingMinutes,
    int ViewCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    TheoryStatus Status,
    RefDto? Level,
    TheoryBreadcrumbDto Breadcrumb,
    TheoryArticleLinkDto? Previous,
    TheoryArticleLinkDto? Next,
    IReadOnlyList<TheoryRelatedQuestionDto> RelatedQuestions);

/// <summary>Путь к статье: Теория → Трек → Раздел. Раздел не имеет своего URL.</summary>
public record TheoryBreadcrumbDto(
    string TrackSlug, string TrackName, string SectionSlug, string SectionName);

/// <summary>Соседняя статья внутри раздела — для prev/next под текстом.</summary>
public record TheoryArticleLinkDto(string Slug, string Title, int ReadingMinutes);

/// <summary>Вопрос каталога, привязанный к статье («Проверь себя»).</summary>
public record TheoryRelatedQuestionDto(
    Guid Id, string Slug, string Title, int Difficulty, RefDto Level);

// ── Обзор трека ───────────────────────────────────────────────────────────

/// <summary>Страница трека: разделы со статьями и сводка по объёму.</summary>
public record TheoryTrackDetailDto(
    string Slug,
    string Name,
    string? Description,
    string? Icon,
    string? Color,
    int ArticleCount,
    int ReadingMinutes,
    IReadOnlyList<TheorySectionNodeDto> Sections);

// ── Админка ───────────────────────────────────────────────────────────────

/// <summary>Трек в админском дереве: со скрытыми разделами и черновиками.</summary>
public record TheoryTrackAdminDto(
    Guid Id, string Slug, string Name, string? Description, string? Icon, string? Color,
    int SortOrder, bool IsPublished, int ArticleCount,
    IReadOnlyList<TheorySectionAdminDto> Sections);

public record TheorySectionAdminDto(
    Guid Id, string Slug, string Name, string? Description, int SortOrder, int ArticleCount);

/// <summary>Строка админского списка статей — без тела.</summary>
public record TheoryArticleListItemDto(
    Guid Id, string Slug, string Title, string? Summary, int SortOrder,
    TheoryStatus Status, int ReadingMinutes, int ViewCount,
    DateTime CreatedAt, DateTime? UpdatedAt,
    Guid SectionId, string SectionName, string TrackName,
    RefDto? Level, int RelatedQuestionCount);

/// <summary>Статья в редакторе: тело плюс привязанные вопросы.</summary>
public record TheoryArticleAdminDto(
    Guid Id, string Slug, string Title, string? Summary, string Body, int SortOrder,
    TheoryStatus Status, int ReadingMinutes, int ViewCount,
    DateTime CreatedAt, DateTime? UpdatedAt,
    Guid SectionId, Guid TrackId, Guid? LevelId,
    IReadOnlyList<TheoryRelatedQuestionDto> RelatedQuestions);

public record TheoryTrackInput(
    string Name, string? Slug, string? Description, string? Icon, string? Color,
    int SortOrder, bool IsPublished);

public record TheorySectionInput(
    string Name, string? Slug, string? Description, int SortOrder, Guid TrackId);

/// <summary>
/// Создание и правка статьи. ReadingMinutes здесь нет намеренно: он считается
/// на бэкенде из Body и руками не задаётся.
/// </summary>
public record TheoryArticleInput(
    string Title,
    string? Slug,
    string? Summary,
    string Body,
    int SortOrder,
    TheoryStatus Status,
    Guid SectionId,
    Guid? LevelId,
    IReadOnlyList<Guid>? QuestionIds);
