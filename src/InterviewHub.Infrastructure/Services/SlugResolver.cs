using InterviewHub.Application.Common;
using InterviewHub.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace InterviewHub.Infrastructure.Services;

internal static class SlugResolver
{
    public static async Task<OperationResult<string>> ResolveAsync<T>(
        DbSet<T> set, string? explicitSlug, string title, Guid? exceptId,
        string? currentSlug, string fallback, CancellationToken ct)
        where T : class, ISluggable
    {
        Task<bool> IsTaken(string candidate, CancellationToken token) =>
            set.AnyAsync(x => x.Slug == candidate && (exceptId == null || x.Id != exceptId), token);

        if (string.IsNullOrWhiteSpace(explicitSlug) && currentSlug is not null)
            return OperationResult<string>.Success(currentSlug);

        if (!string.IsNullOrWhiteSpace(explicitSlug))
        {
            var slug = SlugGenerator.Generate(explicitSlug);
            if (slug.Length == 0)
                return OperationResult<string>.Conflict("Slug пуст после нормализации.");

            return await IsTaken(slug, ct)
                ? OperationResult<string>.Conflict($"Slug \"{slug}\" уже занят.")
                : OperationResult<string>.Success(slug);
        }

        return OperationResult<string>.Success(
            await SlugGenerator.GenerateUniqueAsync(title, IsTaken, fallback, ct));
    }

    public static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
