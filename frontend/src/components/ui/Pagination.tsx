import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Окно из номеров вокруг текущей страницы с многоточиями по краям.
 * Первая и последняя всегда видны — до конца каталога должно быть
 * один клик, а не десять.
 */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  for (const p of [current - 1, current + 1]) {
    if (p > 1 && p < total) pages.add(p);
  }

  // У краёв окно смещаем внутрь, иначе получается «1 … 2 3» — многоточие ни за чем.
  if (current <= 3) [2, 3, 4].forEach((p) => p < total && pages.add(p));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => p > 1 && pages.add(p));

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "gap")[] = [];

  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1] > 1) result.push("gap");
    result.push(page);
  });

  return result;
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const btn =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-control px-2 text-sm " +
    "transition-colors disabled:pointer-events-none disabled:opacity-40";

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Пагинация">
      <button
        type="button"
        className={cn(btn, "text-fg-muted hover:bg-surface-sunken hover:text-fg")}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Предыдущая страница"
      >
        <ChevronLeft size={16} />
      </button>

      {pageWindow(page, totalPages).map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-fg-subtle" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              btn,
              item === page
                ? "gradient-brand font-medium text-white"
                : "text-fg-muted hover:bg-surface-sunken hover:text-fg",
            )}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        className={cn(btn, "text-fg-muted hover:bg-surface-sunken hover:text-fg")}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Следующая страница"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
