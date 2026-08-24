import { memo, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../lib/utils";

/**
 * Языки, которые реально встречаются в контенте, плюс те, что админ
 * напишет с наибольшей вероятностью. Грузить все ~200 языков shiki
 * незачем: это десятки мегабайт.
 */
const LANGS = [
  "csharp",
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "sql",
  "bash",
  "json",
  "yaml",
  "dockerfile",
  "html",
  "css",
] as const;

const ALIASES: Record<string, string> = {
  cs: "csharp",
  "c#": "csharp",
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  postgres: "sql",
  postgresql: "sql",
  docker: "dockerfile",
};

type Highlighter = Awaited<ReturnType<typeof createHighlighter>>;

/**
 * Shiki грузится динамически и один раз на всё приложение: highlighter
 * весит немало, а в основном бандле он не нужен — подсветка есть только
 * на странице вопроса.
 */
let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Импортируем `shiki/core` и грамматики поштучно, а не `shiki`.
 * Точка входа `shiki` тянет bundle-full — все ~200 языков, включая Wolfram
 * и Emacs Lisp, это лишние ~4 МБ в сборке. Список langs в конфиге highlighter
 * от этого не спасает: он влияет на регистрацию, а не на то, что попадёт в бандл.
 */
async function createHighlighter() {
  const [{ createHighlighterCore }, { createOnigurumaEngine }] = await Promise.all([
    import("shiki/core"),
    import("shiki/engine/oniguruma"),
  ]);

  return createHighlighterCore({
    // Обе темы сразу: переключение светлой/тёмной не должно перезагружать shiki.
    themes: [import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark.mjs")],
    langs: [
      import("shiki/langs/csharp.mjs"),
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/jsx.mjs"),
      import("shiki/langs/tsx.mjs"),
      import("shiki/langs/sql.mjs"),
      import("shiki/langs/bash.mjs"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/yaml.mjs"),
      import("shiki/langs/dockerfile.mjs"),
      import("shiki/langs/html.mjs"),
      import("shiki/langs/css.mjs"),
    ],
    engine: createOnigurumaEngine(import("shiki/wasm")),
  });
}

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter();
  return highlighterPromise;
}

function normalizeLang(lang: string | undefined): string | null {
  if (!lang) return null;
  const key = lang.toLowerCase();
  const resolved = ALIASES[key] ?? key;
  return (LANGS as readonly string[]).includes(resolved) ? resolved : null;
}

/**
 * Блок кода с подсветкой. До загрузки shiki показывает тот же код
 * без раскраски — верстка не прыгает, и текст читаем сразу.
 */
function CodeBlock({ code, lang }: { code: string; lang: string | undefined }) {
  const [html, setHtml] = useState<string | null>(null);
  const resolved = normalizeLang(lang);

  useEffect(() => {
    if (!resolved) return;
    let cancelled = false;

    getHighlighter()
      .then((hl) => {
        if (cancelled) return;
        setHtml(
          hl.codeToHtml(code, {
            lang: resolved,
            // Обе темы в одном HTML: shiki кладёт цвета светлой в CSS-переменные,
            // а тёмной — в --shiki-dark, которые подхватываются в index.css.
            themes: { light: "github-light", dark: "github-dark" },
            defaultColor: false,
          }),
        );
      })
      .catch(() => {
        /* без подсветки код всё равно читается — молча остаёмся на fallback */
      });

    return () => {
      cancelled = true;
    };
  }, [code, resolved]);

  if (html) {
    return (
      <div
        className="ih-code my-4 overflow-x-auto rounded-control border border-border-subtle text-sm"
        // Источник — shiki, а не пользователь: он экранирует входной код.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div
      className="my-4 overflow-x-auto rounded-control border border-border-subtle
                 bg-surface-sunken p-4 text-sm"
    >
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Рендер markdown из ответов и постановок вопросов.
 * HTML внутри markdown не включаем: контент пишет админ, но лишний вектор
 * XSS в публичной выдаче не нужен — react-markdown по умолчанию его и не парсит.
 */
const MarkdownContent = memo(function MarkdownContent({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("ih-prose", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // node из props вынимается и отбрасывается: react-markdown передаёт
          // в нём своё AST, и спред в DOM давал бы node="[object Object]".
          code({ className: cls, children: content, node: _node, ...props }) {
            const text = String(content).replace(/\n$/, "");
            const match = /language-(\w+)/.exec(cls ?? "");

            // react-markdown зовёт этот компонент и для инлайнового кода:
            // отличаем по наличию переноса строки или языка.
            if (!match && !text.includes("\n")) {
              return (
                <code
                  className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.875em]"
                  {...props}
                >
                  {content}
                </code>
              );
            }

            return <CodeBlock code={text} lang={match?.[1]} />;
          },

          a({ href, children: content, node: _node, ...props }) {
            const external = href?.startsWith("http");
            return (
              <a
                href={href}
                // Внешние ссылки — в новой вкладке; noreferrer обязателен вместе с _blank.
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                {...props}
              >
                {content}
              </a>
            );
          },

          // react-markdown оборачивает блок кода в собственный <pre>, а CodeBlock
          // рисует свой контейнер — без этого получалось вложенное <pre><pre>,
          // невалидное для HTML и падающее при гидратации.
          pre({ children: content }) {
            return <>{content}</>;
          },

          // Таблицы в markdown легко переполняют колонку — оборачиваем в скролл.
          table({ children: content, node: _node, ...props }) {
            return (
              <div className="my-4 overflow-x-auto">
                <table {...props}>{content}</table>
              </div>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownContent;
