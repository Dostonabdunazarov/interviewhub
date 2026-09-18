import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronRight, Clock, Eye } from "lucide-react";
import { useTheoryArticle } from "../lib/theoryHooks";
import { extractHeadings } from "../lib/headings";
import { Markdown } from "../components/Markdown";
import { Meta, stripMarkdown, truncate } from "../components/Meta";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { DifficultyDots } from "../components/ui/DifficultyDots";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/States";
import { formatCount, formatDate } from "../lib/utils";
import { cn } from "../lib/utils";
import type { TheoryArticleDetail } from "../types/api";

/**
 * Оглавление статьи — только при заголовках сверх порога: на статье с двумя
 * подзаголовками это шум, который занимает колонку и ничего не даёт.
 */
const MIN_HEADINGS_FOR_TOC = 4;

function Breadcrumbs({ breadcrumb }: Pick<TheoryArticleDetail, "breadcrumb">) {
  // Раздел — не ссылка: своего URL у него нет, он живёт внутри трека.
  return (
    <nav aria-label="Хлебные крошки">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
        <li>
          <Link to="/theory" className="transition-colors hover:text-fg">
            Теория
          </Link>
        </li>
        <ChevronRight size={14} className="text-fg-subtle" aria-hidden="true" />
        <li>
          <Link
            to={`/theory/${breadcrumb.trackSlug}`}
            className="transition-colors hover:text-fg"
          >
            {breadcrumb.trackName}
          </Link>
        </li>
        <ChevronRight size={14} className="text-fg-subtle" aria-hidden="true" />
        <li className="text-fg-subtle">{breadcrumb.sectionName}</li>
      </ol>
    </nav>
  );
}

/** Соседи по разделу. Данные пришли вместе со статьёй — отдельный запрос не нужен. */
function ArticleNav({ previous, next }: Pick<TheoryArticleDetail, "previous" | "next">) {
  if (!previous && !next) return null;

  return (
    <nav
      aria-label="Навигация по разделу"
      className="mt-10 border-t border-border-subtle pt-6"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {previous ? (
          <Link
            to={`/theory/articles/${previous.slug}`}
            className="group flex items-center gap-3 rounded-card border border-border-subtle
                       bg-surface p-4 transition-colors hover:border-border-strong"
          >
            <ArrowLeft
              size={18}
              className="shrink-0 text-fg-subtle transition-colors group-hover:text-accent"
            />
            <span className="min-w-0">
              <span className="block text-xs text-fg-subtle">Предыдущая</span>
              <span className="mt-0.5 line-clamp-2 text-sm font-medium transition-colors
                               group-hover:text-accent">
                {previous.title}
              </span>
            </span>
          </Link>
        ) : (
          // Пустая ячейка, чтобы одинокая «следующая» не съезжала влево.
          <span aria-hidden="true" className="hidden sm:block" />
        )}

        {next && (
          <Link
            to={`/theory/articles/${next.slug}`}
            className="group flex items-center justify-end gap-3 rounded-card border
                       border-border-subtle bg-surface p-4 text-right transition-colors
                       hover:border-border-strong"
          >
            <span className="min-w-0">
              <span className="block text-xs text-fg-subtle">Следующая</span>
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

function ArticleSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-6 h-9 w-full" />
      <Skeleton className="mt-2 h-9 w-2/3" />
      <Skeleton className="mt-6 h-64 rounded-card" />
    </div>
  );
}

export default function TheoryArticlePage() {
  const { slug } = useParams();
  const { data, isLoading, isError, refetch } = useTheoryArticle(slug);

  // Разбор markdown не бесплатный, а тело не меняется между рендерами.
  const headings = useMemo(() => (data ? extractHeadings(data.body) : []), [data]);

  if (isLoading) return <ArticleSkeleton />;

  if (isError || !data) {
    return (
      <>
        <ErrorState
          title="Статья не найдена"
          description="Возможно, она ещё не опубликована или ссылка устарела."
          onRetry={() => refetch()}
        />
        <div className="mt-6 text-center">
          <Link to="/theory">
            <Button variant="secondary">Ко всему содержанию</Button>
          </Link>
        </div>
      </>
    );
  }

  const showToc = headings.length >= MIN_HEADINGS_FOR_TOC;

  return (
    <article>
      <Meta
        title={data.title}
        description={truncate(stripMarkdown(data.summary ?? data.body))}
        path={`/theory/articles/${data.slug}`}
        type="article"
      />

      <Breadcrumbs breadcrumb={data.breadcrumb} />

      <header className="mt-5">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">{data.title}</h1>

        {data.summary && (
          <p className="mt-3 text-base leading-relaxed text-fg-muted">{data.summary}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-muted">
          {data.level && (
            <Link to={`/levels/${data.level.slug}`}>
              <Badge color={data.level.color}>{data.level.name}</Badge>
            </Link>
          )}
          <span className="flex items-center gap-1">
            <Clock size={13} /> {data.readingMinutes} мин чтения
          </span>
          <span className="flex items-center gap-1">
            <Eye size={13} /> {formatCount(data.viewCount)}
          </span>
          <span>Обновлена {formatDate(data.updatedAt ?? data.createdAt)}</span>
        </div>
      </header>

      {/*
        Оглавление статьи. На широких экранах — справа от текста, но раздел
        и так занят сайдбаром, поэтому здесь это блок над текстом в рамке:
        две колонки навигации по бокам от узкой полосы текста читаются хуже,
        чем один компактный список.
      */}
      {showToc && (
        <nav
          aria-label="Содержание статьи"
          className="mt-6 rounded-card border border-border-subtle bg-surface-sunken p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            В этой статье
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {headings.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  className={cn(
                    "block text-sm text-fg-muted transition-colors hover:text-accent",
                    h.level === 3 && "pl-4",
                  )}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/*
        Тело на поверхности, а не прямо на канве: фоновый узор просвечивает
        сквозь длинный текст и мешает читать. У вопроса та же причина —
        там ответы тоже лежат в карточке.
      */}
      <div className="mt-8 rounded-card border border-border-subtle bg-surface p-6 sm:p-8">
        <Markdown>{data.body}</Markdown>
      </div>

      {/* «Проверь себя» — ради этого теория и стоит рядом с каталогом. */}
      {data.relatedQuestions.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">
            Проверь себя
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.relatedQuestions.map((q) => (
              <li key={q.id}>
                <Link
                  to={`/questions/${q.slug}`}
                  className="group flex items-center gap-3 rounded-card border
                             border-border-subtle bg-surface px-4 py-3 transition-colors
                             hover:border-border-strong"
                >
                  <span className="min-w-0 flex-1 text-sm transition-colors
                                   group-hover:text-accent">
                    {q.title}
                  </span>
                  <DifficultyDots value={q.difficulty} />
                  <Badge color={q.level.color}>{q.level.name}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ArticleNav previous={data.previous} next={data.next} />
    </article>
  );
}
