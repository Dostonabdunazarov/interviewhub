namespace InterviewHub.Domain.Enums;

/// <summary>Роль пользователя. Гости не являются пользователями системы — они читают без входа.</summary>
public enum UserRole
{
    /// <summary>Может создавать и править контент, но не управлять пользователями.</summary>
    Editor = 1,

    /// <summary>Полный доступ, включая управление пользователями.</summary>
    Admin = 2
}

/// <summary>
/// Видимость вопроса. Модерации нет — админ правит сразу в прод,
/// Draft нужен лишь чтобы не публиковать недописанное.
/// </summary>
public enum QuestionStatus
{
    Draft = 1,
    Published = 2,
    Archived = 3
}

/// <summary>Этап собеседования, на котором вопрос был задан в компании.</summary>
public enum InterviewRound
{
    Screening = 1,
    Technical = 2,
    SystemDesign = 3,
    Final = 4
}
