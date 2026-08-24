namespace InterviewHub.Application.Dtos;

public record CategoryDto(
    Guid Id, string Slug, string Name, string? Description,
    string? Icon, string? Color, int SortOrder, int QuestionCount);

public record LevelDto(
    Guid Id, string Slug, string Name, int Rank, string? Color, int QuestionCount);

public record CompanyDto(
    Guid Id, string Slug, string Name, string? LogoUrl, string? Color,
    string? Description, string? Country, int SortOrder, int QuestionCount);

public record TagDto(Guid Id, string Slug, string Name, int QuestionCount);

/// <summary>Сводка для главной страницы.</summary>
public record StatsDto(
    int TotalQuestions,
    int TotalCompanies,
    int TotalCategories,
    IReadOnlyList<LevelDto> ByLevel,
    IReadOnlyList<CategoryDto> ByCategory);
