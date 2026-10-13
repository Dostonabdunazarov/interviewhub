using InterviewHub.Domain.Enums;

namespace InterviewHub.Application.Dtos;

public record PuzzleListItemDto(
    Guid Id,
    string Slug,
    string Title,
    PuzzleKind Kind,
    int Difficulty,
    QuestionStatus Status,
    int ViewCount,
    DateTime CreatedAt,
    RefDto Category,
    RefDto Level);

public record PuzzleOptionDto(Guid Id, string Text, bool IsCorrect);

public record PuzzleLinkDto(string Slug, string Title);

public record PuzzleDetailDto(
    Guid Id,
    string Slug,
    string Title,
    PuzzleKind Kind,
    string Body,
    string Explanation,
    int Difficulty,
    int ViewCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    RefDto Category,
    RefDto Level,
    IReadOnlyList<PuzzleOptionDto> Options,
    PuzzleLinkDto? Previous,
    PuzzleLinkDto? Next);

public record PuzzleAdminDto(
    Guid Id,
    string Slug,
    string Title,
    PuzzleKind Kind,
    string Body,
    string Explanation,
    int Difficulty,
    QuestionStatus Status,
    int ViewCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    Guid CategoryId,
    Guid LevelId,
    IReadOnlyList<PuzzleOptionDto> Options);

public record PuzzleOptionInput(string Text, bool IsCorrect);

public record PuzzleInput(
    string Title,
    string? Slug,
    PuzzleKind Kind,
    string Body,
    string Explanation,
    int Difficulty,
    QuestionStatus Status,
    Guid CategoryId,
    Guid LevelId,
    IReadOnlyList<PuzzleOptionInput> Options);

public record FactDto(
    Guid Id,
    string Slug,
    string Title,
    string Body,
    RefDto? Category,
    DateTime CreatedAt);

public record FactAdminDto(
    Guid Id,
    string Slug,
    string Title,
    string Body,
    QuestionStatus Status,
    Guid? CategoryId,
    string? CategoryName,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record FactInput(
    string Title,
    string? Slug,
    string Body,
    QuestionStatus Status,
    Guid? CategoryId);

public record SuggestionInput(
    SuggestionKind Kind,
    string Text,
    string? AnswerDraft,
    string? Category,
    string? Level,
    string? Company,
    string? Round,
    string? Contact,
    string? TargetType,
    string? TargetSlug,
    string? Website);

public record SuggestionDto(
    Guid Id,
    SuggestionKind Kind,
    string Text,
    string? AnswerDraft,
    string? Category,
    string? Level,
    string? Company,
    string? Round,
    string? Contact,
    string? TargetType,
    string? TargetSlug,
    SuggestionStatus Status,
    string? AdminNote,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record SuggestionUpdateInput(SuggestionStatus Status, string? AdminNote);

public record SuggestionCountsDto(int New, int Accepted, int Rejected);
