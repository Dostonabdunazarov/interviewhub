using InterviewHub.Domain.Common;

namespace InterviewHub.Domain.Entities;

/// <summary>
/// Верхний уровень теории: что человек учит целиком (".NET Backend",
/// "Распределённые системы"). Треки НЕ дублируют категории вопросов:
/// категория отвечает «к чему относится вопрос», трек — «что я учу»,
/// поэтому одна статья трека может ссылаться на вопросы трёх категорий.
/// </summary>
public class TheoryTrack : BaseEntity, ISluggable
{
    public string Slug { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Description { get; set; }

    /// <summary>Имя иконки lucide-react — как у <see cref="Category"/>.</summary>
    public string? Icon { get; set; }

    /// <summary>Акцентный цвет в HEX.</summary>
    public string? Color { get; set; }

    public int SortOrder { get; set; }

    /// <summary>
    /// Трек виден гостям. Снят — трек целиком скрыт вместе со статьями,
    /// даже опубликованными: так можно готовить трек, не пряча каждую статью.
    /// </summary>
    public bool IsPublished { get; set; }

    public ICollection<TheorySection> Sections { get; set; } = [];
}
