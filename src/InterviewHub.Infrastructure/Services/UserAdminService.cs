using InterviewHub.Application.Common;
using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Entities;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Auth;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Services;

public interface IUserAdminService
{
    Task<IReadOnlyList<UserDto>> GetAllAsync(CancellationToken ct = default);
    Task<UserDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<OperationResult<UserDto>> CreateAsync(UserCreateInput input, CancellationToken ct = default);
    Task<OperationResult<UserDto>> UpdateAsync(Guid id, UserInput input, CancellationToken ct = default);
    Task<OperationResult> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<OperationResult> ChangePasswordAsync(Guid id, string newPassword, CancellationToken ct = default);
}

/// <summary>
/// Управление аккаунтами админки. Публичной регистрации нет — пользователей заводит Admin.
/// Ключевой инвариант: в системе всегда остаётся хотя бы один активный админ,
/// иначе панель запирается изнутри и починить её можно только через БД.
/// </summary>
public sealed class UserAdminService(AppDbContext db, IPasswordHasher passwordHasher) : IUserAdminService
{
    public async Task<IReadOnlyList<UserDto>> GetAllAsync(CancellationToken ct = default) =>
        await db.Users.AsNoTracking()
            .OrderByDescending(x => x.Role).ThenBy(x => x.Email)
            .Select(x => new UserDto(
                x.Id, x.Email, x.DisplayName, x.Role, x.IsActive, x.CreatedAt, x.LastLoginAt))
            .ToListAsync(ct);

    public async Task<UserDto?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.Users.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new UserDto(
                x.Id, x.Email, x.DisplayName, x.Role, x.IsActive, x.CreatedAt, x.LastLoginAt))
            .FirstOrDefaultAsync(ct);

    public async Task<OperationResult<UserDto>> CreateAsync(
        UserCreateInput input, CancellationToken ct = default)
    {
        var email = NormalizeEmail(input.Email);

        if (await db.Users.AnyAsync(x => x.Email == email, ct))
            return OperationResult<UserDto>.Conflict($"Пользователь {email} уже существует.");

        var user = new User
        {
            Email = email,
            PasswordHash = passwordHasher.Hash(input.Password),
            DisplayName = input.DisplayName.Trim(),
            Role = input.Role,
            IsActive = input.IsActive
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        return OperationResult<UserDto>.Success(ToDto(user));
    }

    public async Task<OperationResult<UserDto>> UpdateAsync(
        Guid id, UserInput input, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null) return OperationResult<UserDto>.NotFound("Пользователь не найден.");

        var email = NormalizeEmail(input.Email);
        if (email != user.Email && await db.Users.AnyAsync(x => x.Email == email, ct))
            return OperationResult<UserDto>.Conflict($"Пользователь {email} уже существует.");

        // Понижение роли и деактивация одинаково опасны: и то и другое может
        // оставить систему без действующего админа.
        var losesAdmin = user.Role == UserRole.Admin &&
                         (input.Role != UserRole.Admin || !input.IsActive);

        if (losesAdmin && !await HasOtherActiveAdminAsync(id, ct))
            return OperationResult<UserDto>.Conflict(
                "Это последний активный админ — сначала назначьте другого.");

        user.Email = email;
        user.DisplayName = input.DisplayName.Trim();
        user.Role = input.Role;
        user.IsActive = input.IsActive;

        // Деактивированный пользователь не должен дожить сессию на старом refresh-токене.
        if (!user.IsActive)
            await RevokeTokensAsync(id, ct);

        await db.SaveChangesAsync(ct);

        return OperationResult<UserDto>.Success(ToDto(user));
    }

    public async Task<OperationResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null) return OperationResult.NotFound("Пользователь не найден.");

        if (user.Role == UserRole.Admin && !await HasOtherActiveAdminAsync(id, ct))
            return OperationResult.Conflict(
                "Это последний активный админ — сначала назначьте другого.");

        // Refresh-токены уходят каскадом; созданные вопросы остаются с CreatedByUserId = null.
        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);

        return OperationResult.Success();
    }

    public async Task<OperationResult> ChangePasswordAsync(
        Guid id, string newPassword, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null) return OperationResult.NotFound("Пользователь не найден.");

        user.PasswordHash = passwordHasher.Hash(newPassword);

        // Смена пароля обрывает старые сессии — иначе украденный refresh переживёт её.
        await RevokeTokensAsync(id, ct);
        await db.SaveChangesAsync(ct);

        return OperationResult.Success();
    }

    private Task<bool> HasOtherActiveAdminAsync(Guid exceptId, CancellationToken ct) =>
        db.Users.AnyAsync(x => x.Id != exceptId && x.Role == UserRole.Admin && x.IsActive, ct);

    private async Task RevokeTokensAsync(Guid userId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static UserDto ToDto(User u) =>
        new(u.Id, u.Email, u.DisplayName, u.Role, u.IsActive, u.CreatedAt, u.LastLoginAt);
}
