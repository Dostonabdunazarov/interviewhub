using FluentValidation;

namespace InterviewHub.Api.Filters;

/// <summary>
/// Прогоняет тело запроса через зарегистрированный <see cref="IValidator{T}"/>
/// и возвращает 400 с ValidationProblemDetails — тем же форматом, что и биндер,
/// чтобы фронту не пришлось разбирать два вида ошибок.
/// </summary>
public sealed class ValidationFilter<T> : IEndpointFilter where T : class
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var validator = context.HttpContext.RequestServices.GetService<IValidator<T>>();
        if (validator is null) return await next(context);

        var input = context.Arguments.OfType<T>().FirstOrDefault();
        if (input is null) return await next(context);

        var result = await validator.ValidateAsync(input, context.HttpContext.RequestAborted);
        if (result.IsValid) return await next(context);

        var errors = result.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

        return Results.ValidationProblem(errors);
    }
}

public static class ValidationFilterExtensions
{
    /// <summary>Вешает валидацию тела запроса на эндпоинт.</summary>
    public static RouteHandlerBuilder Validate<T>(this RouteHandlerBuilder builder) where T : class =>
        builder.AddEndpointFilter<ValidationFilter<T>>()
            .ProducesValidationProblem();
}
