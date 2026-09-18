import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock } from "lucide-react";
import { useTheoryTrack } from "../lib/theoryHooks";
import { Meta } from "../components/Meta";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { CategoryIcon } from "../components/ui/CategoryIcon";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/States";

/** Обзор трека: разделы со статьями и сводка по объёму чтения. */
export default function TheoryTrackPage() {
  const { trackSlug } = useParams();
  const { data, isLoading, isError, refetch } = useTheoryTrack(trackSlug);

  if (isLoading) {
    return (
      <div aria-hidden="true">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-4 h-5 w-full" />
        <Skeleton className="mt-8 h-48 rounded-card" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <>
        <ErrorState
          title="Трек не найден"
          description="Возможно, он ещё не опубликован или ссылка устарела."
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

  return (
    <div>
      <Meta
        title={data.name}
        description={
          data.description ??
          `Теория по треку «${data.name}»: ${data.articleCount} статей.`
        }
        path={`/theory/${data.slug}`}
      />

      <Link
        to="/theory"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted
                   transition-colors hover:text-fg"
      >
        <ArrowLeft size={15} /> Ко всему содержанию
      </Link>

      <header className="mt-6 flex items-start gap-4">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-card bg-surface-sunken"
          style={data.color ? { color: data.color } : undefined}
        >
          <CategoryIcon name={data.icon} size={24} />
        </span>

        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">{data.name}</h1>
          {data.description && (
            <p className="mt-2 text-base leading-relaxed text-fg-muted">{data.description}</p>
          )}
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted">
        <span>
          {data.articleCount} статей в {data.sections.length} разделах
        </span>
        <span className="flex items-center gap-1">
          <Clock size={14} /> около {data.readingMinutes} мин чтения
        </span>
      </div>

      {/* Разделы идут в порядке изучения, а не по алфавиту: трек читают подряд. */}
      <div className="mt-8 flex flex-col gap-4">
        {data.sections.map((section) => (
          <section
            key={section.slug}
            className="rounded-card border border-border-subtle bg-surface p-5"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-medium">{section.name}</h2>
              <Badge>{section.articleCount}</Badge>
            </div>

            {section.description && (
              <p className="mt-1.5 text-sm text-fg-muted">{section.description}</p>
            )}

            <ul className="mt-3 flex flex-col">
              {section.articles.map((article) => (
                <li key={article.slug}>
                  <Link
                    to={`/theory/articles/${article.slug}`}
                    className="group flex items-center gap-3 rounded-control px-2 py-2
                               transition-colors hover:bg-surface-sunken"
                  >
                    <span className="min-w-0 flex-1 text-sm transition-colors
                                     group-hover:text-accent">
                      {article.title}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-fg-subtle">
                      {article.readingMinutes} мин
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
