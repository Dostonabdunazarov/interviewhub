namespace InterviewHub.Application.Common;

/// <summary>Почему операция не удалась. Определяет HTTP-код в слое эндпоинтов.</summary>
public enum OperationError
{
    None = 0,

    /// <summary>Сущности с таким Id нет — 404.</summary>
    NotFound = 1,

    /// <summary>Нарушено ограничение: занятый slug, удаление используемого справочника — 409.</summary>
    Conflict = 2,

    /// <summary>Входные данные ссылаются на несуществующую связь — 400.</summary>
    Invalid = 3
}

/// <summary>
/// Результат админской операции без исключений: сервисы в Infrastructure
/// не должны знать про HTTP, а эндпоинту нужно отличать 404 от 409.
/// </summary>
public readonly record struct OperationResult<T>(T? Value, OperationError Error, string? Message)
{
    public bool IsSuccess => Error == OperationError.None;

    public static OperationResult<T> Success(T value) => new(value, OperationError.None, null);
    public static OperationResult<T> NotFound(string message) => new(default, OperationError.NotFound, message);
    public static OperationResult<T> Conflict(string message) => new(default, OperationError.Conflict, message);
    public static OperationResult<T> Invalid(string message) => new(default, OperationError.Invalid, message);
}

/// <summary>Операция без возвращаемого значения (удаление, смена пароля).</summary>
public readonly record struct OperationResult(OperationError Error, string? Message)
{
    public bool IsSuccess => Error == OperationError.None;

    public static OperationResult Success() => new(OperationError.None, null);
    public static OperationResult NotFound(string message) => new(OperationError.NotFound, message);
    public static OperationResult Conflict(string message) => new(OperationError.Conflict, message);
    public static OperationResult Invalid(string message) => new(OperationError.Invalid, message);
}
