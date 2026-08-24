using InterviewHub.Domain.Common;

namespace InterviewHub.Domain.Entities;

/// <summary>
/// Ответ на вопрос в markdown. Ответов может быть несколько:
/// короткий "что сказать за 30 секунд" и развёрнутый разбор.
/// </summary>
public class Answer : BaseEntity
{
    public Guid QuestionId { get; set; }
    public Question Question { get; set; } = null!;

    public string Body { get; set; } = null!;

    /// <summary>Основной ответ, раскрытый по умолчанию. На вопрос ожидается один такой.</summary>
    public bool IsPrimary { get; set; }

    public int SortOrder { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
