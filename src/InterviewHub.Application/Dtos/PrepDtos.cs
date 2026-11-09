using InterviewHub.Domain.Enums;

namespace InterviewHub.Application.Dtos;

public record PrepLevelDto(string Slug, string Name, string? Color, int Rank);

public record PrepLevelRefDto(string Slug, string Name, string? Color);

public record PrepListItemDto(
    string Slug,
    string Title,
    string Role,
    string RoleName,
    PrepLevelDto Level,
    string Summary,
    int TopicCount,
    int QuestionCount,
    int SortOrder);

public record PrepQuestionDto(string Slug, string Title, int Difficulty, PrepLevelRefDto Level);

public record PrepArticleDto(string Slug, string Title, string? Summary);

public record PrepPuzzleDto(string Slug, string Title, PuzzleKind Kind);

public record PrepTopicDto(
    string Slug,
    string Title,
    string Body,
    int SortOrder,
    IReadOnlyList<PrepQuestionDto> Questions,
    IReadOnlyList<PrepArticleDto> Articles,
    IReadOnlyList<PrepPuzzleDto> Puzzles);

public record PrepGuideDetailDto(
    string Slug,
    string Title,
    string Role,
    string RoleName,
    PrepLevelDto Level,
    string Summary,
    string Intro,
    string InterviewFormat,
    DateTime UpdatedAt,
    IReadOnlyList<PrepTopicDto> Topics);

public record PrepGuideAdminDto(
    Guid Id,
    string Slug,
    string Title,
    string Role,
    string RoleName,
    string LevelSlug,
    string LevelName,
    TheoryStatus Status,
    int TopicCount,
    DateTime UpdatedAt);

public record PrepTopicInput(
    string Slug,
    string Title,
    string Body,
    List<string>? Questions,
    List<string>? Articles,
    List<string>? Puzzles);

public record PrepGuideInput(
    string Slug,
    string Title,
    string Role,
    string RoleName,
    string Level,
    string Summary,
    string Intro,
    string InterviewFormat,
    int SortOrder,
    bool? Publish,
    List<PrepTopicInput> Topics);

public record PrepUpsertDto(Guid Id, string Slug, TheoryStatus Status, bool Created);

public record PrepStatusDto(Guid Id, string Slug, TheoryStatus Status);
