using InterviewHub.Domain.Common;
using InterviewHub.Domain.Enums;

namespace InterviewHub.Domain.Entities;

public class Suggestion : BaseEntity
{
    public SuggestionKind Kind { get; set; } = SuggestionKind.NewQuestion;

    public string Text { get; set; } = null!;
    public string? AnswerDraft { get; set; }

    public string? Category { get; set; }
    public string? Level { get; set; }
    public string? Company { get; set; }
    public string? Round { get; set; }
    public string? Contact { get; set; }

    public string? TargetType { get; set; }
    public string? TargetSlug { get; set; }

    public SuggestionStatus Status { get; set; } = SuggestionStatus.New;
    public string? AdminNote { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
