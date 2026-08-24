using InterviewHub.Domain.Common;
using InterviewHub.Domain.Enums;

namespace InterviewHub.Domain.Entities;

/// <summary>
/// Вопрос с собеседования. Категория и грейд — обязательные оси,
/// компании и теги — гибкие связи many-to-many, поэтому один вопрос
/// может одновременно жить в "React/junior" и в "Google", "Ozon".
/// </summary>
public class Question : BaseEntity
{
    public string Slug { get; set; } = null!;
    public string Title { get; set; } = null!;

    /// <summary>Развёрнутая постановка в markdown. Необязательна — часто хватает заголовка.</summary>
    public string? Body { get; set; }

    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    public Guid LevelId { get; set; }
    public Level Level { get; set; } = null!;

    /// <summary>Субъективная сложность 1–5 внутри грейда.</summary>
    public int Difficulty { get; set; } = 3;

    public QuestionStatus Status { get; set; } = QuestionStatus.Draft;

    public int ViewCount { get; set; }
    public bool IsFeatured { get; set; }

    public DateTime? UpdatedAt { get; set; }

    /// <summary>
    /// Склеенный текст ответов — только для полнотекстового поиска.
    /// Денормализация: generated-колонка не может читать другую таблицу,
    /// а искать нужно и по тексту ответов ("ConfigureAwait", "Gen 2").
    /// Пересобирается при изменении ответов, вручную не редактируется.
    /// </summary>
    public string? SearchText { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }

    public ICollection<Answer> Answers { get; set; } = [];
    public ICollection<QuestionCompany> QuestionCompanies { get; set; } = [];
    public ICollection<QuestionTag> QuestionTags { get; set; } = [];
}
