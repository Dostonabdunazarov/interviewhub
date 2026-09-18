using InterviewHub.Domain.Common;
using InterviewHub.Domain.Enums;

namespace InterviewHub.Domain.Entities;

/// <summary>
/// Статья теории — связный текст, который читают подряд. Сознательно не
/// <see cref="Question"/> с флагом: у вопроса есть Difficulty и Company,
/// у статьи — порядок в разделе, время чтения и соседи. Связь между ними —
/// двусторонние ссылки через <see cref="TheoryArticleQuestion"/>.
/// </summary>
public class TheoryArticle : BaseEntity, ISluggable
{
    /// <summary>
    /// Глобально уникален — он и есть URL (`/theory/articles/{slug}`).
    /// Плоский путь вместо `/theory/{track}/{section}/{article}`, чтобы
    /// перенос статьи в другой раздел не ломал ссылку и не требовал редиректа.
    /// </summary>
    public string Slug { get; set; } = null!;

    public string Title { get; set; } = null!;

    /// <summary>Короткий анонс для карточки и meta description.</summary>
    public string? Summary { get; set; }

    /// <summary>Тело в markdown. Рендерится тем же Markdown-компонентом, что ответы.</summary>
    public string Body { get; set; } = null!;

    public int SortOrder { get; set; }

    public TheoryStatus Status { get; set; } = TheoryStatus.Draft;

    /// <summary>
    /// Минуты чтения. Считается на бэкенде при сохранении (как SearchText
    /// у вопроса), руками не редактируется: клиент не должен пересчитывать
    /// это на каждый рендер.
    /// </summary>
    public int ReadingMinutes { get; set; }

    public int ViewCount { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public Guid SectionId { get; set; }
    public TheorySection Section { get; set; } = null!;

    /// <summary>Необязательная привязка к грейду: «это спросят с middle».</summary>
    public Guid? LevelId { get; set; }
    public Level? Level { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }

    public ICollection<TheoryArticleQuestion> ArticleQuestions { get; set; } = [];
}
