using InterviewHub.Domain.Enums;

namespace InterviewHub.Application.Common;

/// <summary>Параметры фильтрации каталога вопросов. Все фильтры опциональны и комбинируются через AND.</summary>
public class QuestionQuery
{
    private const int MaxPageSize = 100;

    public string? Category { get; set; }
    public string? Level { get; set; }
    public string? Company { get; set; }
    public string? Tag { get; set; }

    /// <summary>Полнотекстовый поиск по заголовку и телу.</summary>
    public string? Q { get; set; }

    public int? Difficulty { get; set; }
    public bool? IsFeatured { get; set; }

    /// <summary>Только для админки: гостям отдаются лишь Published.</summary>
    public QuestionStatus? Status { get; set; }

    /// <summary>
    /// Nullable намеренно: при биндинге через [AsParameters] non-nullable enum
    /// становится обязательным query-параметром, и запрос без ?sort= падал бы с 400.
    /// </summary>
    public QuestionSort? Sort { get; set; }

    private int _page = 1;
    public int Page
    {
        get => _page;
        set => _page = value < 1 ? 1 : value;
    }

    private int _pageSize = 20;
    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value switch
        {
            < 1 => 20,
            > MaxPageSize => MaxPageSize,
            _ => value
        };
    }
}

public enum QuestionSort
{
    Newest = 0,
    Oldest = 1,
    Popular = 2,
    DifficultyAsc = 3,
    DifficultyDesc = 4
}
