using InterviewHub.Domain.Enums;

namespace InterviewHub.Application.Dtos;

public record QuestionCompanyInput(Guid CompanyId, int? AskedYear, InterviewRound? Round);

/// <summary>Создание/обновление вопроса из админки. Slug генерируется из Title, если не задан.</summary>
public record QuestionInput(
    string Title,
    string? Body,
    string? Slug,
    Guid CategoryId,
    Guid LevelId,
    int Difficulty,
    QuestionStatus Status,
    bool IsFeatured,
    IReadOnlyList<QuestionCompanyInput>? Companies,
    IReadOnlyList<Guid>? TagIds);

public record AnswerInput(string Body, bool IsPrimary, int SortOrder);

public record CategoryInput(
    string Name, string? Slug, string? Description,
    string? Icon, string? Color, int SortOrder);

public record LevelInput(string Name, string? Slug, int Rank, string? Color);

public record CompanyInput(
    string Name, string? Slug, string? LogoUrl, string? Color,
    string? Description, string? Country, int SortOrder);

public record TagInput(string Name, string? Slug);

public record UserInput(string Email, string DisplayName, UserRole Role, bool IsActive);

/// <summary>Создание пользователя админом. Публичной регистрации нет, пароль задаёт админ.</summary>
public record UserCreateInput(
    string Email, string DisplayName, string Password, UserRole Role, bool IsActive);

public record UserDto(
    Guid Id, string Email, string DisplayName, UserRole Role,
    bool IsActive, DateTime CreatedAt, DateTime? LastLoginAt);

public record ChangePasswordInput(string NewPassword);

// --- Аутентификация ---

public record LoginInput(string Email, string Password);

public record AuthResultDto(
    string AccessToken, string RefreshToken, DateTime ExpiresAt, UserDto User);

public record RefreshInput(string RefreshToken);
