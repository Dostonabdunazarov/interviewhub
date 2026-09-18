using InterviewHub.Domain.Common;

namespace InterviewHub.Domain.Entities;

/// <summary>
/// Средний уровень теории: связная группа статей внутри трека
/// («CLR и память», «Асинхронность»). Читается подряд, поэтому
/// порядок статей внутри раздела значим.
/// </summary>
public class TheorySection : BaseEntity, ISluggable
{
    /// <summary>
    /// Уникален в пределах трека, а не глобально: раздел `postgresql`
    /// может быть и в `dotnet-backend`, и в будущем `data-engineering`.
    /// В URL не участвует — там slug статьи.
    /// </summary>
    public string Slug { get; set; } = null!;

    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }

    public Guid TrackId { get; set; }
    public TheoryTrack Track { get; set; } = null!;

    public ICollection<TheoryArticle> Articles { get; set; } = [];
}
