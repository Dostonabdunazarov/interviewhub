using InterviewHub.Domain.Entities;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace InterviewHub.Infrastructure.Auth;

/// <summary>
/// Создаёт первого админа при старте, если в системе нет ни одного админа.
/// Учётные данные — из секции "Bootstrap:Admin", обычно через env.
/// Без этого некому администрировать: публичной саморегистрации нет.
/// </summary>
public sealed class AdminBootstrapper(
    AppDbContext db,
    IPasswordHasher passwordHasher,
    IConfiguration configuration,
    ILogger<AdminBootstrapper> logger)
{
    public async Task EnsureAdminAsync(CancellationToken ct = default)
    {
        if (await db.Users.AnyAsync(u => u.Role == UserRole.Admin, ct))
            return;

        var email = configuration["Bootstrap:Admin:Email"]?.Trim().ToLowerInvariant();
        var password = configuration["Bootstrap:Admin:Password"];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning(
                "Админов нет, но Bootstrap:Admin:Email/Password не заданы — первый админ не создан. " +
                "Задайте их (env) и перезапустите.");
            return;
        }

        db.Users.Add(new User
        {
            Email = email,
            PasswordHash = passwordHasher.Hash(password),
            DisplayName = configuration["Bootstrap:Admin:Name"] ?? "Администратор",
            Role = UserRole.Admin,
            IsActive = true
        });
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Создан первый админ: {Email}", email);
    }
}
