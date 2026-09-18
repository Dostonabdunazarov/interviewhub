namespace InterviewHub.Domain.Entities;

/// <summary>
/// Ручная привязка статьи к вопросам каталога: блок «Проверь себя» в статье
/// и «Теория по теме» на странице вопроса. Именно ручная — автоматическая
/// по тегам дала бы мусорные связи («GC» подтянул бы всё про память).
/// </summary>
public class TheoryArticleQuestion
{
    public Guid ArticleId { get; set; }
    public TheoryArticle Article { get; set; } = null!;

    public Guid QuestionId { get; set; }
    public Question Question { get; set; } = null!;

    public int SortOrder { get; set; }
}
