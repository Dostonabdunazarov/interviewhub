using InterviewHub.Domain.Common;

namespace InterviewHub.Domain.Entities;

/// <summary>Свободная метка поверх категории и грейда: "hooks", "gc", "indexes".</summary>
public class Tag : BaseEntity, ISluggable
{
    public string Slug { get; set; } = null!;
    public string Name { get; set; } = null!;

    public ICollection<QuestionTag> QuestionTags { get; set; } = [];
}
