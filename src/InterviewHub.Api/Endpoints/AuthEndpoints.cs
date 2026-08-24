using InterviewHub.Application.Dtos;
using InterviewHub.Infrastructure.Auth;

namespace InterviewHub.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/api/auth").WithTags("Auth");

        auth.MapPost("/login", async (
            LoginInput input, IAuthService service, CancellationToken ct) =>
        {
            var result = await service.LoginAsync(input, ct);
            return result is null
                ? Results.Problem("Неверный email или пароль.", statusCode: StatusCodes.Status401Unauthorized)
                : Results.Ok(result);
        });

        auth.MapPost("/refresh", async (
            RefreshInput input, IAuthService service, CancellationToken ct) =>
        {
            var result = await service.RefreshAsync(input.RefreshToken, ct);
            return result is null
                ? Results.Problem("Refresh-токен недействителен.", statusCode: StatusCodes.Status401Unauthorized)
                : Results.Ok(result);
        });

        auth.MapPost("/logout", async (
            RefreshInput input, IAuthService service, CancellationToken ct) =>
        {
            await service.LogoutAsync(input.RefreshToken, ct);
            return Results.NoContent();
        });
    }
}
