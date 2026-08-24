using System.Security.Claims;
using InterviewHub.Api.Filters;
using InterviewHub.Application.Common;
using InterviewHub.Application.Dtos;
using InterviewHub.Infrastructure.Services;

namespace InterviewHub.Api.Endpoints;

/// <summary>
/// Админское API. Вся группа под аутентификацией: контент правит Editor,
/// пользователей — только Admin (политики заданы в Program.cs).
/// </summary>
public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/admin")
            .RequireAuthorization(AuthPolicies.Editor)
            .WithTags("Admin");

        MapQuestions(admin);
        MapAnswers(admin);
        MapCategories(admin);
        MapLevels(admin);
        MapCompanies(admin);
        MapTags(admin);
        MapUsers(admin);
    }

    private static void MapQuestions(RouteGroupBuilder admin)
    {
        var questions = admin.MapGroup("/questions");

        // Параметры перечислены явно, а не через [AsParameters]: тот биндер требует
        // в query каждое value-type свойство, и запрос без ?page= падал бы с 400.
        questions.MapGet("/", async (
            IQuestionService service,
            CancellationToken ct,
            string? category = null,
            string? level = null,
            string? company = null,
            string? tag = null,
            string? q = null,
            int? difficulty = null,
            bool? isFeatured = null,
            QuestionStatusFilter status = QuestionStatusFilter.All,
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
                Status = status == QuestionStatusFilter.All ? null : (Domain.Enums.QuestionStatus)status,
                // В отличие от публичного API админка видит и черновики.
                IncludeAllStatuses = status == QuestionStatusFilter.All
            };

            return Results.Ok(await service.SearchAsync(query, ct));
        });

        questions.MapGet("/{id:guid}", async (
            Guid id, IQuestionAdminService service, CancellationToken ct) =>
        {
            var question = await service.GetByIdAsync(id, ct);
            return question is null ? Results.NotFound() : Results.Ok(question);
        });

        questions.MapPost("/", async (
            QuestionInput input, IQuestionAdminService service,
            ClaimsPrincipal user, CancellationToken ct) =>
        {
            var result = await service.CreateAsync(input, user.GetUserId(), ct);
            return result.ToHttpResult(v => Results.Created($"/api/admin/questions/{v.Id}", v));
        }).Validate<QuestionInput>();

        questions.MapPut("/{id:guid}", async (
            Guid id, QuestionInput input, IQuestionAdminService service, CancellationToken ct) =>
            (await service.UpdateAsync(id, input, ct)).ToHttpResult(Results.Ok))
            .Validate<QuestionInput>();

        questions.MapDelete("/{id:guid}", async (
            Guid id, IQuestionAdminService service, CancellationToken ct) =>
            (await service.DeleteAsync(id, ct)).ToHttpResult());

        questions.MapPost("/{id:guid}/answers", async (
            Guid id, AnswerInput input, IQuestionAdminService service, CancellationToken ct) =>
            (await service.AddAnswerAsync(id, input, ct))
                .ToHttpResult(v => Results.Created($"/api/admin/answers/{v.Id}", v)))
            .Validate<AnswerInput>();
    }

    private static void MapAnswers(RouteGroupBuilder admin)
    {
        var answers = admin.MapGroup("/answers");

        answers.MapPut("/{id:guid}", async (
            Guid id, AnswerInput input, IQuestionAdminService service, CancellationToken ct) =>
            (await service.UpdateAnswerAsync(id, input, ct)).ToHttpResult(Results.Ok))
            .Validate<AnswerInput>();

        answers.MapDelete("/{id:guid}", async (
            Guid id, IQuestionAdminService service, CancellationToken ct) =>
            (await service.DeleteAnswerAsync(id, ct)).ToHttpResult());
    }

    private static void MapCategories(RouteGroupBuilder admin)
    {
        var categories = admin.MapGroup("/categories");

        categories.MapGet("/", async (ICatalogService service, CancellationToken ct) =>
            Results.Ok(await service.GetCategoriesAsync(ct)));

        categories.MapPost("/", async (
            CategoryInput input, ICatalogAdminService service, CancellationToken ct) =>
            (await service.CreateCategoryAsync(input, ct))
                .ToHttpResult(v => Results.Created($"/api/admin/categories/{v.Id}", v)))
            .Validate<CategoryInput>();

        categories.MapPut("/{id:guid}", async (
            Guid id, CategoryInput input, ICatalogAdminService service, CancellationToken ct) =>
            (await service.UpdateCategoryAsync(id, input, ct)).ToHttpResult(Results.Ok))
            .Validate<CategoryInput>();

        categories.MapDelete("/{id:guid}", async (
            Guid id, ICatalogAdminService service, CancellationToken ct) =>
            (await service.DeleteCategoryAsync(id, ct)).ToHttpResult());
    }

    private static void MapLevels(RouteGroupBuilder admin)
    {
        var levels = admin.MapGroup("/levels");

        levels.MapGet("/", async (ICatalogService service, CancellationToken ct) =>
            Results.Ok(await service.GetLevelsAsync(ct)));

        levels.MapPost("/", async (
            LevelInput input, ICatalogAdminService service, CancellationToken ct) =>
            (await service.CreateLevelAsync(input, ct))
                .ToHttpResult(v => Results.Created($"/api/admin/levels/{v.Id}", v)))
            .Validate<LevelInput>();

        levels.MapPut("/{id:guid}", async (
            Guid id, LevelInput input, ICatalogAdminService service, CancellationToken ct) =>
            (await service.UpdateLevelAsync(id, input, ct)).ToHttpResult(Results.Ok))
            .Validate<LevelInput>();

        levels.MapDelete("/{id:guid}", async (
            Guid id, ICatalogAdminService service, CancellationToken ct) =>
            (await service.DeleteLevelAsync(id, ct)).ToHttpResult());
    }

    private static void MapCompanies(RouteGroupBuilder admin)
    {
        var companies = admin.MapGroup("/companies");

        companies.MapGet("/", async (ICatalogService service, CancellationToken ct) =>
            Results.Ok(await service.GetCompaniesAsync(ct)));

        companies.MapPost("/", async (
            CompanyInput input, ICatalogAdminService service, CancellationToken ct) =>
            (await service.CreateCompanyAsync(input, ct))
                .ToHttpResult(v => Results.Created($"/api/admin/companies/{v.Id}", v)))
            .Validate<CompanyInput>();

        companies.MapPut("/{id:guid}", async (
            Guid id, CompanyInput input, ICatalogAdminService service, CancellationToken ct) =>
            (await service.UpdateCompanyAsync(id, input, ct)).ToHttpResult(Results.Ok))
            .Validate<CompanyInput>();

        companies.MapDelete("/{id:guid}", async (
            Guid id, ICatalogAdminService service, CancellationToken ct) =>
            (await service.DeleteCompanyAsync(id, ct)).ToHttpResult());
    }

    private static void MapTags(RouteGroupBuilder admin)
    {
        var tags = admin.MapGroup("/tags");

        // Публичный /api/tags скрывает пустые теги; админке нужны все,
        // иначе только что созданный тег не выбрать в редакторе вопроса.
        tags.MapGet("/", async (ICatalogAdminService service, CancellationToken ct) =>
            Results.Ok(await service.GetAllTagsAsync(ct)));

        tags.MapPost("/", async (
            TagInput input, ICatalogAdminService service, CancellationToken ct) =>
            (await service.CreateTagAsync(input, ct))
                .ToHttpResult(v => Results.Created($"/api/admin/tags/{v.Id}", v)))
            .Validate<TagInput>();

        tags.MapPut("/{id:guid}", async (
            Guid id, TagInput input, ICatalogAdminService service, CancellationToken ct) =>
            (await service.UpdateTagAsync(id, input, ct)).ToHttpResult(Results.Ok))
            .Validate<TagInput>();

        tags.MapDelete("/{id:guid}", async (
            Guid id, ICatalogAdminService service, CancellationToken ct) =>
            (await service.DeleteTagAsync(id, ct)).ToHttpResult());
    }

    private static void MapUsers(RouteGroupBuilder admin)
    {
        // Отдельная политика поверх групповой: Editor правит контент,
        // но управление аккаунтами — только для Admin.
        var users = admin.MapGroup("/users").RequireAuthorization(AuthPolicies.Admin);

        users.MapGet("/", async (IUserAdminService service, CancellationToken ct) =>
            Results.Ok(await service.GetAllAsync(ct)));

        users.MapGet("/{id:guid}", async (
            Guid id, IUserAdminService service, CancellationToken ct) =>
        {
            var user = await service.GetByIdAsync(id, ct);
            return user is null ? Results.NotFound() : Results.Ok(user);
        });

        users.MapPost("/", async (
            UserCreateInput input, IUserAdminService service, CancellationToken ct) =>
            (await service.CreateAsync(input, ct))
                .ToHttpResult(v => Results.Created($"/api/admin/users/{v.Id}", v)))
            .Validate<UserCreateInput>();

        users.MapPut("/{id:guid}", async (
            Guid id, UserInput input, IUserAdminService service, CancellationToken ct) =>
            (await service.UpdateAsync(id, input, ct)).ToHttpResult(Results.Ok))
            .Validate<UserInput>();

        users.MapDelete("/{id:guid}", async (
            Guid id, IUserAdminService service, CancellationToken ct) =>
            (await service.DeleteAsync(id, ct)).ToHttpResult());

        users.MapPost("/{id:guid}/password", async (
            Guid id, ChangePasswordInput input, IUserAdminService service, CancellationToken ct) =>
            (await service.ChangePasswordAsync(id, input.NewPassword, ct)).ToHttpResult())
            .Validate<ChangePasswordInput>();
    }

    /// <summary>Id текущего пользователя из токена — проставляется автором вопроса.</summary>
    private static Guid? GetUserId(this ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
}

/// <summary>
/// Фильтр статуса для админского списка. Отдельный от <see cref="Domain.Enums.QuestionStatus"/>,
/// потому что «все статусы» — не состояние вопроса, а значение фильтра по умолчанию.
/// </summary>
public enum QuestionStatusFilter
{
    Draft = 1,
    Published = 2,
    Archived = 3,
    All = 0
}
