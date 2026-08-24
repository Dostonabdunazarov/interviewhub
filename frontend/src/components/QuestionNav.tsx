import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useQuestions } from "../lib/hooks";
import type { QuestionDetail } from "../types/api";

/**
 * Переход к предыдущему и следующему вопросу.
 *
 * Соседей API не отдаёт, поэтому берём список вопросов той же категории и
 * ищем в нём текущий. Категория — естественная единица обхода: человек
 * читает подряд «C#», а не вперемешку с System Design.
 *
 * Сортировка `Newest` совпадает с той, что стоит в каталоге по умолчанию,
 * так что «следующий» здесь — тот же, что следующая карточка в списке.
 *
 * Ограничение: соседи ищутся в пределах первых `WINDOW` вопросов категории.
 * Для вопроса за этой границей навигация просто не покажется — это лучше,
 * чем тянуть на страницу вопроса всю категорию целиком.
 */
const WINDOW = 200;

export function QuestionNav({ question }: { question: QuestionDetail }) {
  const { data } = useQuestions({
    category: question.category.slug,
    sort: "Newest",
    pageSize: WINDOW,
  });

  const items = data?.items;
  if (!items || items.length < 2) return null;

  const index = items.findIndex((q) => q.slug === question.slug);
  if (index === -1) return null;

  const prev = index > 0 ? items[index - 1] : null;
  const next = index < items.length - 1 ? items[index + 1] : null;
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Навигация по вопросам категории"
      className="mt-10 border-t border-border-subtle pt-6"
    >
      <p className="text-xs text-fg-subtle">
        {index + 1} из {items.length} в категории «{question.category.name}»
      </p>

      {/*
        На узком экране — одна колонка; на широком две равные, чтобы кнопки
        стояли по краям. Пустая ячейка нужна, чтобы одинокий «следующий»
        не съезжал влево.
      */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link
            to={`/questions/${prev.slug}`}
            className="group flex items-center gap-3 rounded-card border border-border-subtle
                       bg-surface p-4 transition-colors hover:border-border-strong"
          >
            <ArrowLeft
              size={18}
              className="shrink-0 text-fg-subtle transition-colors group-hover:text-accent"
            />
            <span className="min-w-0">
              <span className="block text-xs text-fg-subtle">Предыдущий</span>
              {/* line-clamp-2: заголовки бывают длинными, но карточки должны
                  оставаться одной высоты. */}
              <span className="mt-0.5 line-clamp-2 text-sm font-medium transition-colors
                               group-hover:text-accent">
                {prev.title}
              </span>
            </span>
          </Link>
        ) : (
          <span aria-hidden="true" className="hidden sm:block" />
        )}

        {next && (
          <Link
            to={`/questions/${next.slug}`}
            className="group flex items-center justify-end gap-3 rounded-card border
                       border-border-subtle bg-surface p-4 text-right transition-colors
                       hover:border-border-strong"
          >
            <span className="min-w-0">
              <span className="block text-xs text-fg-subtle">Следующий</span>
              <span className="mt-0.5 line-clamp-2 text-sm font-medium transition-colors
                               group-hover:text-accent">
                {next.title}
              </span>
            </span>
            <ArrowRight
              size={18}
              className="shrink-0 text-fg-subtle transition-colors group-hover:text-accent"
            />
          </Link>
        )}
      </div>
    </nav>
  );
}
