using InterviewHub.Domain.Common;

namespace InterviewHub.Domain.Entities;

/// <summary>Грейд: intern / junior / middle / senior / lead.</summary>
public class Level : BaseEntity, ISluggable
{
    public string Slug { get; set; } = null!;
    public string Name { get; set; } = null!;

    /// <summary>Порядок сложности: чем больше, тем выше грейд. Используется для сортировки.</summary>
    public int Rank { get; set; }

    /// <summary>Акцентный цвет в HEX (junior — зелёный, middle — синий, senior — фиолетовый).</summary>
    public string? Color { get; set; }

    public ICollection<Question> Questions { get; set; } = [];
}
