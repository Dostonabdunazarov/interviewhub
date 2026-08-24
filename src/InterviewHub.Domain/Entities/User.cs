using InterviewHub.Domain.Common;
using InterviewHub.Domain.Enums;

namespace InterviewHub.Domain.Entities;

/// <summary>
/// Пользователь админки. Публичной регистрации нет — аккаунты создаёт админ,
/// а гости читают сайт вообще без входа.
/// </summary>
public class User : BaseEntity
{
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
    public UserRole Role { get; set; } = UserRole.Editor;
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }

    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
}
