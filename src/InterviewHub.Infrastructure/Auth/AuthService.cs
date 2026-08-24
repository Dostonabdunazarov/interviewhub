using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Entities;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace InterviewHub.Infrastructure.Auth;

public interface IAuthService
{
    Task<AuthResultDto?> LoginAsync(LoginInput input, CancellationToken ct = default);
    Task<AuthResultDto?> RefreshAsync(string refreshToken, CancellationToken ct = default);
    Task LogoutAsync(string refreshToken, CancellationToken ct = default);
}

public sealed class AuthService(
    AppDbContext db,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService,
    IOptions<JwtOptions> jwtOptions) : IAuthService
{
    private readonly JwtOptions _jwt = jwtOptions.Value;

    public async Task<AuthResultDto?> LoginAsync(LoginInput input, CancellationToken ct = default)
    {
        var email = input.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

        // Неактивный пользователь и неверный пароль отвечают одинаково —
        // чтобы по ответу нельзя было перебирать существующие аккаунты.
        if (user is null || !user.IsActive)
            return null;

        var (ok, needsRehash) = passwordHasher.Verify(user.PasswordHash, input.Password);
        if (!ok) return null;

        if (needsRehash)
            user.PasswordHash = passwordHasher.Hash(input.Password);

        user.LastLoginAt = DateTime.UtcNow;

        return await IssueTokensAsync(user, ct);
    }

    public async Task<AuthResultDto?> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        var token = await db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == refreshToken, ct);

        if (token is null || !token.IsActive || !token.User.IsActive)
            return null;

        // Ротация: старый токен гасим, выдаём новую пару.
        token.RevokedAt = DateTime.UtcNow;

        return await IssueTokensAsync(token.User, ct);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken ct = default)
    {
        var token = await db.RefreshTokens.FirstOrDefaultAsync(t => t.Token == refreshToken, ct);
        if (token is null || token.RevokedAt is not null) return;

        token.RevokedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private async Task<AuthResultDto> IssueTokensAsync(User user, CancellationToken ct)
    {
        var accessToken = jwtTokenService.CreateAccessToken(user);
        var expiresAt = DateTime.UtcNow.AddMinutes(_jwt.AccessTokenMinutes);

        var refresh = new RefreshToken
        {
            UserId = user.Id,
            Token = jwtTokenService.CreateRefreshToken(),
            ExpiresAt = DateTime.UtcNow.AddDays(_jwt.RefreshTokenDays)
        };
        db.RefreshTokens.Add(refresh);

        await db.SaveChangesAsync(ct);

        return new AuthResultDto(accessToken, refresh.Token, expiresAt, ToDto(user));
    }

    internal static UserDto ToDto(User u) =>
        new(u.Id, u.Email, u.DisplayName, u.Role, u.IsActive, u.CreatedAt, u.LastLoginAt);
}
