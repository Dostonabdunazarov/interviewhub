using InterviewHub.Domain.Common;
using InterviewHub.Domain.Enums;

namespace InterviewHub.Domain.Entities;

public class CodePuzzle : BaseEntity, ISluggable
{
    public string Slug { get; set; } = null!;
    public string Title { get; set; } = null!;

    public PuzzleKind Kind { get; set; } = PuzzleKind.Output;

    public string Body { get; set; } = null!;
    public string Explanation { get; set; } = null!;

    public int Difficulty { get; set; } = 3;

    public QuestionStatus Status { get; set; } = QuestionStatus.Draft;

    public int ViewCount { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    public Guid LevelId { get; set; }
    public Level Level { get; set; } = null!;

    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }

    public ICollection<CodePuzzleOption> Options { get; set; } = [];
}
