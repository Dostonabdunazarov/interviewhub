using InterviewHub.Domain.Common;

namespace InterviewHub.Domain.Entities;

/// <summary>Компания, в которой задавали вопрос: Google, Яндекс, Ozon и т.д.</summary>
public class Company : BaseEntity, ISluggable
{
    public string Slug { get; set; } = null!;
    public string Name { get; set; } = null!;

    /// <summary>Внешний URL логотипа. Файлы не храним — на фронте фолбэк на буквенную заглушку.</summary>
    public string? LogoUrl { get; set; }

    public string? Color { get; set; }
    public string? Description { get; set; }
    public string? Country { get; set; }
    public int SortOrder { get; set; }

    public ICollection<QuestionCompany> QuestionCompanies { get; set; } = [];
}
