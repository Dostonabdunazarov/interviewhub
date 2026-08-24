using InterviewHub.Domain.Common;

namespace InterviewHub.Domain.Entities;

/// <summary>Refresh-токен для продления сессии админки без повторного ввода пароля.</summary>
public class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string Token { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public bool IsActive => RevokedAt is null && DateTime.UtcNow < ExpiresAt;
}
