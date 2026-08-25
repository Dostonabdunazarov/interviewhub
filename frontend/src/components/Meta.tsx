const SITE = "InterviewHub";
const ORIGIN = "https://interview.hypex.site";

/** Ограничение сниппета в выдаче — примерно столько символов Google и показывает. */
const MAX_DESCRIPTION = 160;

/**
 * Убирает markdown-разметку, чтобы в сниппет не уехали `**`, бэктики и
 * ссылки: описание страницы читает человек в выдаче, а не рендерер.
 * Порядок правил важен — блоки кода вырезаются до инлайновых.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")           // блоки кода целиком
    .replace(/`([^`]*)`/g, "$1")               // инлайновый код
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")     // картинки — до ссылок
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")   // ссылки: оставить текст
    .replace(/^#{1,6}\s+/gm, "")               // заголовки
    .replace(/^\s*[-*+]\s+/gm, "")             // маркеры списков
    .replace(/^\s*>\s?/gm, "")                 // цитаты
    .replace(/\*\*|__|\*|_|~~/g, "")           // жирный, курсив, зачёркнутый
    .replace(/\|/g, " ")                       // таблицы
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Обрезает по границе слова: обрубленное посередине слово в выдаче
 * выглядит как ошибка. Многоточие добавляется только если реально резали.
 */
export function truncate(text: string, max = MAX_DESCRIPTION): string {
  if (text.length <= max) return text;

  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // Если пробела нет вовсе (одно длинное слово) — режем как есть.
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Мета-теги страницы. React 19 сам поднимает <title>, <meta> и <link>
 * в <head>, поэтому внешняя зависимость вроде react-helmet не нужна —
 * достаточно отрендерить их где угодно в дереве.
 *
 * Компонент рендерить только с готовыми данными: пока идёт загрузка,
 * лучше оставить дефолт из index.html, чем показать краулеру пустой
 * заголовок. Поэтому вызывающий код делает `{data && <Meta … />}`.
 */
export function Meta({
  title,
  description,
  path,
  type = "website",
  bare = false,
  noIndex = false,
}: {
  /** Без суффикса с названием сайта — он добавляется здесь. */
  title: string;
  description?: string;
  /** Абсолютный путь от корня, например "/questions/foo". Идёт в canonical и og:url. */
  path?: string;
  type?: "website" | "article";
  /**
   * Не приписывать «— InterviewHub». Нужно главной, где заголовок
   * и так начинается с названия: иначе выйдет «InterviewHub — InterviewHub».
   */
  bare?: boolean;
  /**
   * Закрыть страницу от индексации. Нужно 404: SPA отдаёт на них HTTP 200,
   * поэтому без явного noindex «Страница не найдена» попадёт в выдачу.
   */
  noIndex?: boolean;
}) {
  const fullTitle = bare ? title : `${title} — ${SITE}`;
  const url = path ? ORIGIN + path : undefined;

  return (
    <>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {noIndex && <meta name="robots" content="noindex" />}

      {/* canonical: каталог отдаёт те же вопросы под фильтрами,
          дубли схлопываем на канонический адрес страницы. */}
      {url && <link rel="canonical" href={url} />}

      {/* OG — превью ссылок в Telegram и соцсетях. Без них в чате
          показывается голый URL, а вопросами делятся именно так. */}
      <meta property="og:site_name" content={SITE} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      {url && <meta property="og:url" content={url} />}
    </>
  );
}
