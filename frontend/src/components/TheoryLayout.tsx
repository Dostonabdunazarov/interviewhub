import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { List, X } from "lucide-react";
import { TheorySidebar } from "./TheorySidebar";

/**
 * Сетка раздела «Теория»: сайдбар слева, контент справа.
 *
 * Живёт отдельным layout-роутом, а не внутри страниц, чтобы дерево не
 * перемонтировалось при переходе между статьями — иначе на каждом клике
 * сбрасывалась бы прокрутка колонки.
 */
export function TheoryLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Как и мобильное меню в Layout: переход по ссылке закрывает панель,
  // иначе на новой странице поверх текста висит открытое содержание.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  return (
    <div className="mx-auto flex max-w-content gap-8 px-page-x py-8">
      {/*
        Десктоп: колонка 280px, прилипает под хедером и прокручивается сама.
        z-index ниже хедера (он z-50), иначе сайдбар перекроет его при прокрутке.
        Явная высота обязательна — без неё sticky с overflow не сработает.
      */}
      <aside
        className="sticky top-(--size-header) z-10 hidden h-[calc(100dvh-var(--size-header))]
                   w-70 shrink-0 overflow-y-auto py-2 pr-2 lg:block"
      >
        <TheorySidebar />
      </aside>

      {/*
        Контент ограничен по ширине: длинная строка не читается. `mx-auto`
        центрирует колонку в остатке после сайдбара.
      */}
      <div className="mx-auto min-w-0 flex-1 lg:max-w-5xl">
        {/* Кнопка содержания — только там, где колонки нет. */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="mb-6 inline-flex items-center gap-2 rounded-control border
                     border-border-subtle bg-surface px-3 py-2 text-sm text-fg-muted
                     transition-colors hover:border-border-strong hover:text-fg lg:hidden"
        >
          <List size={16} /> Содержание
        </button>

        <Outlet />
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Закрыть содержание"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-slate-950/60"
          />

          <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col
                          border-r border-border-subtle bg-canvas">
            <div className="flex items-center justify-between border-b border-border-subtle
                            px-4 py-3">
              <span className="text-sm font-medium">Содержание</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Закрыть содержание"
                className="grid size-8 place-items-center rounded-control text-fg-muted
                           hover:bg-surface-sunken hover:text-fg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {/* Клик по ссылке внутри дерева закрывает панель: на мобильном
                  содержание перекрывает текст, ради которого его и открыли. */}
              <TheorySidebar onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
