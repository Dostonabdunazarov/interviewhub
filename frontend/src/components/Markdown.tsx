import { lazy, Suspense } from "react";
import { cn } from "../lib/utils";

/**
 * Ленивая обёртка над рендером markdown. Сам рендер тянет react-markdown,
 * micromark и shiki — почти мегабайт, — а нужен только на странице вопроса.
 * Статический импорт затаскивал всё это в основной бандл, который грузит
 * и главная, и каталог.
 */
const MarkdownContent = lazy(() => import("./MarkdownContent"));

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <Suspense
      fallback={
        // Тот же текст без разметки: пока грузится рендерер, читать уже можно.
        <div className={cn("ih-prose whitespace-pre-wrap text-fg-muted", className)}>
          {children}
        </div>
      }
    >
      <MarkdownContent className={className}>{children}</MarkdownContent>
    </Suspense>
  );
}
