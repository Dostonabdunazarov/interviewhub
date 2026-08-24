using InterviewHub.Application.Common;
using InterviewHub.Infrastructure.Services;

namespace InterviewHub.Api.Endpoints;

/// <summary>Публичное API: доступно гостям без токена, отдаёт только опубликованное.</summary>
public static class PublicEndpoints
{
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
    }
}
