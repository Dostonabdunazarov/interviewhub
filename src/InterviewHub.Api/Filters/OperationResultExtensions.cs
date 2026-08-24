using InterviewHub.Application.Common;

namespace InterviewHub.Api.Filters;

/// <summary>
/// Переводит результат сервиса в HTTP-код. Сервисы в Infrastructure не знают про HTTP,
/// а эндпоинту нужно отличать «нет такого» от «занято» — это единственное место,
/// где решается соответствие.
/// </summary>
public static class OperationResultExtensions
{
    public static IResult ToHttpResult<T>(this OperationResult<T> result, Func<T, IResult> onSuccess) =>
        result.IsSuccess ? onSuccess(result.Value!) : Fail(result.Error, result.Message);

    public static IResult ToHttpResult(this OperationResult result) =>
        result.IsSuccess ? Results.NoContent() : Fail(result.Error, result.Message);

    private static IResult Fail(OperationError error, string? message) => error switch
    {
        OperationError.NotFound => Results.Problem(message, statusCode: StatusCodes.Status404NotFound),
        OperationError.Conflict => Results.Problem(message, statusCode: StatusCodes.Status409Conflict),
        _ => Results.Problem(message, statusCode: StatusCodes.Status400BadRequest)
    };
}
