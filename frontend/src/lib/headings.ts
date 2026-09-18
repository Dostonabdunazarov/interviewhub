/**
 * Якоря заголовков для оглавления статьи.
 *
 * Общий модуль, потому что id должны совпадать в двух местах: MarkdownContent
 * проставляет их на <h2>/<h3>, а TheoryArticlePage строит по тем же правилам
 * список ссылок. Разойдутся правила — оглавление будет вести в никуда.
 */

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Транслитерация не нужна: id живёт в URL-фрагменте, а браузеры и
 * `getElementById` с кириллицей работают. Достаточно убрать пробелы
 * и то, что ломает селектор.
 */
export function headingId(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "") || "section"
  );
}

/**
 * Достаёт h2 и h3 из markdown-исходника. Заголовки внутри блоков кода
 * пропускаем: `# comment` в bash — это комментарий, а не заголовок статьи.
 *
 * Глубже h3 не идём: в оглавлении из трёх уровней теряется сама структура.
 */
export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const seen = new Map<string, number>();
  let inCodeFence = false;

  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;

    const text = match[2].replace(/[*_`]/g, "").trim();
    if (!text) continue;

    // Два одинаковых заголовка в статье — редкость, но повторный id сделал бы
    // вторую ссылку неработающей: нумеруем дубли, как это делает GitHub.
    const base = headingId(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);

    headings.push({
      id: count === 0 ? base : `${base}-${count}`,
      text,
      level: match[1].length === 2 ? 2 : 3,
    });
  }

  return headings;
}
