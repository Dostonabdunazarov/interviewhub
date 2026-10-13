namespace InterviewHub.Domain.Entities;

public class CodePuzzleOption
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PuzzleId { get; set; }
    public CodePuzzle Puzzle { get; set; } = null!;

    public string Text { get; set; } = null!;
    public bool IsCorrect { get; set; }
    public int SortOrder { get; set; }
}
