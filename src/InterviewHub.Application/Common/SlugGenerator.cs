using System.Globalization;
using System.Text;

namespace InterviewHub.Application.Common;

/// <summary>
/// Превращает заголовок в slug для URL. Кириллица транслитерируется, а не выбрасывается:
/// иначе у вопроса «Что такое индексы?» slug получился бы пустым.
/// </summary>
public static class SlugGenerator
{
    private const int MaxLength = 200;

    /// <summary>Таблица транслитерации ru→lat. Регистр обрабатывается до подстановки.</summary>
    private static readonly Dictionary<char, string> Cyrillic = new()
    {
        ['а'] = "a", ['б'] = "b", ['в'] = "v", ['г'] = "g", ['д'] = "d", ['е'] = "e",
        ['ё'] = "e", ['ж'] = "zh", ['з'] = "z", ['и'] = "i", ['й'] = "y", ['к'] = "k",
        ['л'] = "l", ['м'] = "m", ['н'] = "n", ['о'] = "o", ['п'] = "p", ['р'] = "r",
        ['с'] = "s", ['т'] = "t", ['у'] = "u", ['ф'] = "f", ['х'] = "h", ['ц'] = "ts",
        ['ч'] = "ch", ['ш'] = "sh", ['щ'] = "sch", ['ъ'] = "", ['ы'] = "y", ['ь'] = "",
        ['э'] = "e", ['ю'] = "yu", ['я'] = "ya",
        // Украинские и белорусские буквы — на случай названий компаний.
        ['і'] = "i", ['ї'] = "yi", ['є'] = "e", ['ґ'] = "g", ['ў'] = "u"
    };

    /// <summary>
    /// Нормализует произвольный текст в slug: строчные латиница, цифры и дефисы.
    /// Возвращает пустую строку, если после чистки ничего не осталось —
    /// вызывающий код сам решает, чем это заменить.
    /// </summary>
    public static string Generate(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;

        // Разложение по Unicode снимает диакритику: "Café" → "cafe", а не "caf".
        var normalized = text.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);

        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
                continue;

            if (Cyrillic.TryGetValue(ch, out var latin))
                sb.Append(latin);
            else if (char.IsAsciiLetterOrDigit(ch))
                sb.Append(ch);
            else if (sb.Length > 0 && sb[^1] != '-')
                sb.Append('-');
        }

        var slug = sb.ToString().Trim('-');

        if (slug.Length > MaxLength)
            slug = slug[..MaxLength].TrimEnd('-');

        return slug;
    }

    /// <summary>
    /// Slug, уникальный среди <paramref name="isTaken"/>: при коллизии добавляет -2, -3 и т.д.
    /// Fallback на <paramref name="fallback"/> нужен для заголовков без букв и цифр («???»).
    /// </summary>
    public static async Task<string> GenerateUniqueAsync(
        string? text,
        Func<string, CancellationToken, Task<bool>> isTaken,
        string fallback = "item",
        CancellationToken ct = default)
    {
        var baseSlug = Generate(text);
        if (baseSlug.Length == 0) baseSlug = fallback;

        if (!await isTaken(baseSlug, ct)) return baseSlug;

        for (var i = 2; i < 1000; i++)
        {
            var candidate = $"{baseSlug}-{i}";
            if (!await isTaken(candidate, ct)) return candidate;
        }

        // Тысяча однотипных заголовков — вырожденный случай; хвост из Guid гарантирует запись.
        return $"{baseSlug}-{Guid.NewGuid():N}"[..Math.Min(MaxLength, baseSlug.Length + 33)];
    }
}
