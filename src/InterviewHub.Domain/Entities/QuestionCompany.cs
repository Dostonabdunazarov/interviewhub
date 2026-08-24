using InterviewHub.Domain.Enums;

namespace InterviewHub.Domain.Entities;

/// <summary>
/// Связь вопроса с компанией. Не чистый M2M: несёт год и этап собеседования —
/// именно это ищут, когда готовятся к конкретной компании.
/// </summary>
public class QuestionCompany
{
    public Guid QuestionId { get; set; }
    public Question Question { get; set; } = null!;

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = null!;

    public int? AskedYear { get; set; }
    public InterviewRound? Round { get; set; }
}
