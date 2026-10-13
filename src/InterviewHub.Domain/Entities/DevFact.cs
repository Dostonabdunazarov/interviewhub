using InterviewHub.Domain.Common;
using InterviewHub.Domain.Enums;

namespace InterviewHub.Domain.Entities;

public class DevFact : BaseEntity, ISluggable
{
    public string Slug { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;

    public QuestionStatus Status { get; set; } = QuestionStatus.Draft;

    public DateTime? UpdatedAt { get; set; }

    public Guid? CategoryId { get; set; }
    public Category? Category { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }
}
