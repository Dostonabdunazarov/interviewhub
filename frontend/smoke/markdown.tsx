/**
 * Проверка рендера markdown: разметка, экранирование и отсутствие
 * невалидной вложенности. Запуск: `npx vite-node smoke/markdown.tsx`.
 */
import { renderToString } from "react-dom/server";
import MarkdownContent from "../src/components/MarkdownContent";

let failures = 0;
function check(name: string, ok: boolean) {
  if (ok) console.log(`  OK   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}`);
  }
}

const md = [
  "# Заголовок",
  "",
  "Абзац с **жирным**, `инлайн-кодом` и [ссылкой](https://example.com).",
  "",
  "1. Первый",
  "2. Второй",
  "",
  "- Пункт",
  "",
  "> Цитата",
  "",
  "| a | b |",
  "|---|---|",
  "| 1 | 2 |",
  "",
  "```jsx",
  "const a = <div />;",
  "```",
  "",
  "<img src=x onerror=alert(1)>",
].join("\n");

const html = renderToString(<MarkdownContent>{md}</MarkdownContent>);

check("заголовок <h1>", html.includes("<h1"));
check("жирный <strong>", html.includes("<strong"));
check("нумерованный <ol>", html.includes("<ol"));
check("маркированный <ul>", html.includes("<ul"));
check("цитата <blockquote>", html.includes("<blockquote"));
check("GFM-таблица <table>", html.includes("<table"));
check("таблица в скролл-контейнере", html.includes('class="my-4 overflow-x-auto"'));
check("блок кода <pre><code>", /<pre><code>/.test(html));
check("инлайн-код со своим классом", html.includes('<code class="rounded bg-surface-sunken'));
check("внешняя ссылка target=_blank", html.includes('target="_blank"'));
check("внешняя ссылка rel=noopener", html.includes("noopener"));

// Ключевое для безопасности и валидности разметки.
check("сырой HTML экранирован", html.includes("&lt;img") && !/<img[^>]*onerror/.test(html));
check("нет вложенных <pre><pre>", !/<pre[^>]*>\s*<pre/.test(html));
check("нет утечки node= в DOM", !html.includes("node=") && !html.includes("[object Object]"));

console.log(failures === 0 ? "\nMarkdown отрисован корректно" : `\nПадений: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
