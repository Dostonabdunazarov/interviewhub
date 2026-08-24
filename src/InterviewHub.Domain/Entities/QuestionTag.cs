namespace InterviewHub.Domain.Entities;

/// <summary>Связь вопроса и свободной метки.</summary>
public class QuestionTag
{
    public Guid QuestionId { get; set; }
    public Question Question { get; set; } = null!;

    public Guid TagId { get; set; }
    public Tag Tag { get; set; } = null!;
}
