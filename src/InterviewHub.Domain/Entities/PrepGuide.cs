using InterviewHub.Domain.Common;
using InterviewHub.Domain.Enums;

namespace InterviewHub.Domain.Entities;

public class PrepGuide : BaseEntity, ISluggable
{
    public string Slug { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Role { get; set; } = null!;
    public string RoleName { get; set; } = null!;

    public Guid LevelId { get; set; }
    public Level Level { get; set; } = null!;

    public string Summary { get; set; } = null!;
    public string Intro { get; set; } = null!;
    public string InterviewFormat { get; set; } = null!;

    public int SortOrder { get; set; }

    public TheoryStatus Status { get; set; } = TheoryStatus.Draft;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<PrepTopic> Topics { get; set; } = [];
}
