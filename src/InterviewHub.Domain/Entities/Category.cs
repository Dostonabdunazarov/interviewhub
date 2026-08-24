using InterviewHub.Domain.Common;

namespace InterviewHub.Domain.Entities;

/// <summary>Тематический раздел: React, .NET, PostgreSQL, DevOps и т.д.</summary>
public class Category : BaseEntity
{
    public string Slug { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Description { get; set; }

    /// <summary>Имя иконки lucide-react (например "atom", "database").</summary>
    public string? Icon { get; set; }

    /// <summary>Акцентный цвет в HEX для плиток на фронте.</summary>
    public string? Color { get; set; }

    public int SortOrder { get; set; }

    public ICollection<Question> Questions { get; set; } = [];
}
