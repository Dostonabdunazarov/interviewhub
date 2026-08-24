namespace InterviewHub.Domain.Common;

/// <summary>
/// Справочник с уникальным slug. Нужен, чтобы проверка занятости slug
/// была написана один раз на все четыре справочника, а не скопирована четырежды.
/// </summary>
public interface ISluggable
{
    Guid Id { get; }
    string Slug { get; set; }
}
