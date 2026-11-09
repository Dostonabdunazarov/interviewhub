using System.Net;
using System.Net.Sockets;
using InterviewHub.Api.Filters;
using InterviewHub.Application.Common;
using InterviewHub.Application.Dtos;
using InterviewHub.Domain.Enums;
using InterviewHub.Infrastructure.Services;

namespace InterviewHub.Api.Endpoints;

/// <summary>Публичное API: доступно гостям без токена, отдаёт только опубликованное.</summary>
public static class PublicEndpoints
{
    public const string SuggestionsRateLimit = "suggestions";
    public const string AuthRateLimit = "auth";

    public static string ClientKey(HttpContext http)
    {
        var remote = http.Connection.RemoteIpAddress;
        if (remote is not null && IsInternalAddress(remote))
        {
            var headers = http.Request.Headers;
            var cf = headers["CF-Connecting-IP"].ToString().Trim();
            if (IPAddress.TryParse(cf, out var cfAddress)) return cfAddress.ToString();

            var forwarded = headers["X-Forwarded-For"].ToString().Split(',')[0].Trim();
            if (IPAddress.TryParse(forwarded, out var forwardedAddress)) return forwardedAddress.ToString();
        }

        return remote?.ToString() ?? "unknown";
    }

    private static bool IsInternalAddress(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (IPAddress.IsLoopback(address)) return true;

        var bytes = address.GetAddressBytes();
        return address.AddressFamily switch
        {
            AddressFamily.InterNetwork =>
                bytes[0] == 10
                || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31)
                || (bytes[0] == 192 && bytes[1] == 168),
            AddressFamily.InterNetworkV6 =>
                (bytes[0] & 0xFE) == 0xFC || address.IsIPv6LinkLocal,
            _ => false
        };
    }

    public static void MapPublicEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").WithTags("Public");

        // Параметры перечислены явно, а не через [AsParameters]: этот биндер требует
        // в query каждое value-type свойство, поэтому запрос без ?page= падал с 400.
        api.MapGet("/questions", async (
            IQuestionService service,
            CancellationToken ct,
            string? category = null,
            string? level = null,
            string? company = null,
            string? tag = null,
            string? q = null,
            int? difficulty = null,
            bool? isFeatured = null,
            QuestionSort? sort = null,
            int page = 1,
            int pageSize = 20) =>
        {
            var query = new QuestionQuery
            {
                Category = category,
                Level = level,
                Company = company,
                Tag = tag,
                Q = q,
                Difficulty = difficulty,
                IsFeatured = isFeatured,
                Sort = sort,
                Page = page,
                PageSize = pageSize,
                // Status не биндится из query: гостям всегда только Published.
                Status = null
            };

            return Results.Ok(await service.SearchAsync(query, ct));
        });

        api.MapGet("/questions/{slug}", async (
            string slug, IQuestionService service, CancellationToken ct) =>
        {
            var question = await service.GetBySlugAsync(slug, publishedOnly: true, ct);
            return question is null ? Results.NotFound() : Results.Ok(question);
        });

        api.MapGet("/categories", async (ICatalogService service, CancellationToken ct) =>
            Results.Ok(await service.GetCategoriesAsync(ct)));

        api.MapGet("/levels", async (ICatalogService service, CancellationToken ct) =>
            Results.Ok(await service.GetLevelsAsync(ct)));

        api.MapGet("/companies", async (ICatalogService service, CancellationToken ct) =>
            Results.Ok(await service.GetCompaniesAsync(ct)));

        api.MapGet("/companies/{slug}", async (
            string slug, ICatalogService service, CancellationToken ct) =>
        {
            var company = await service.GetCompanyBySlugAsync(slug, ct);
            return company is null ? Results.NotFound() : Results.Ok(company);
        });

        api.MapGet("/tags", async (ICatalogService service, CancellationToken ct) =>
            Results.Ok(await service.GetTagsAsync(ct)));

        api.MapGet("/stats", async (ICatalogService service, CancellationToken ct) =>
            Results.Ok(await service.GetStatsAsync(ct)));

        // Дерево теории — один запрос на весь сайдбар, который есть на каждой
        // странице раздела. Пустое дерево до наполнения — это { "tracks": [] },
        // а не 404: фронт рисует пустое состояние, а не страницу ошибки.
        api.MapGet("/theory/tree", async (ITheoryService service, CancellationToken ct) =>
            Results.Ok(await service.GetTreeAsync(ct)));

        api.MapGet("/theory/tracks/{slug}", async (
            string slug, ITheoryService service, CancellationToken ct) =>
        {
            var track = await service.GetTrackBySlugAsync(slug, ct);
            return track is null ? Results.NotFound() : Results.Ok(track);
        });

        // Плоский URL статьи: slug глобально уникален, чтобы перенос статьи
        // в другой раздел не ломал ссылку.
        api.MapGet("/theory/articles/{slug}", async (
            string slug, ITheoryService service, CancellationToken ct) =>
        {
            var article = await service.GetArticleBySlugAsync(slug, ct);
            return article is null ? Results.NotFound() : Results.Ok(article);
        });
    

        api.MapGet("/puzzles", async (
            IPuzzleService service,
            CancellationToken ct,
            string? category = null,
            string? level = null,
            PuzzleKind? kind = null,
            int page = 1,
            int pageSize = 20) =>
            Results.Ok(await service.SearchAsync(
                category, level, kind, status: null, publishedOnly: true, page, pageSize, ct)));

        api.MapGet("/puzzles/{slug}", async (
            string slug, IPuzzleService service, CancellationToken ct) =>
        {
            var puzzle = await service.GetBySlugAsync(slug, ct);
            return puzzle is null ? Results.NotFound() : Results.Ok(puzzle);
        });

        api.MapGet("/prep", async (IPrepService service, CancellationToken ct) =>
            Results.Ok(await service.GetPublishedAsync(ct)));

        api.MapGet("/prep/{slug}", async (
            string slug, IPrepService service, CancellationToken ct) =>
        {
            var guide = await service.GetBySlugAsync(slug, ct);
            return guide is null ? Results.NotFound() : Results.Ok(guide);
        });

        api.MapGet("/facts", async (
            IFactService service, CancellationToken ct, string? category = null) =>
            Results.Ok(await service.GetPublishedAsync(category, ct)));

        api.MapPost("/suggestions", async (
            SuggestionInput input, ISuggestionService service, CancellationToken ct) =>
        {
            if (!string.IsNullOrEmpty(input.Website)) return Results.NoContent();

            await service.SubmitAsync(input, ct);
            return Results.NoContent();
        })
        .Validate<SuggestionInput>()
        .RequireRateLimiting(SuggestionsRateLimit);
    }
}
