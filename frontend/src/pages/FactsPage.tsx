import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Lightbulb } from "lucide-react";
import { useFacts } from "../lib/engagementHooks";
import { Markdown } from "../components/Markdown";
import { Meta } from "../components/Meta";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { cn } from "../lib/utils";
import type { Ref } from "../types/api";

export default function FactsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") ?? undefined;
  const { data, isLoading, isError, refetch } = useFacts();

  const categories = useMemo(() => {
    const map = new Map<string, Ref>();
    for (const f of data ?? []) if (f.category) map.set(f.category.slug, f.category);
    return [...map.values()];
  }, [data]);

  const facts = category ? data?.filter((f) => f.category?.slug === category) : data;

  const select = (slug?: string) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set("category", slug);
    else next.delete("category");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl px-page-x py-10">
      <Meta
        title="А вы знали?"
        description="Короткие факты и подводные камни .NET, PostgreSQL, Kafka и микросервисов, которые кусают в проде и всплывают на собеседованиях."
        path="/facts"
      />

      <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
        <Lightbulb size={28} className="text-warning" /> А вы знали?
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-fg-muted">
        Неочевидное поведение, которое кусает в проде и которое любят спрашивать на
        собеседованиях. Коротко: что происходит, почему и что с этим делать.
      </p>

      {categories.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => select(undefined)}
            className={cn(
              "rounded-pill border px-3 py-1 text-xs transition-colors",
              !category
                ? "border-accent text-fg"
                : "border-border-subtle text-fg-muted hover:border-border-strong hover:text-fg",
            )}
          >
            Все · {data?.length ?? 0}
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => select(c.slug)}
              className={cn(
                "rounded-pill border px-3 py-1 text-xs transition-colors",
                category === c.slug
                  ? "border-accent text-fg"
                  : "border-border-subtle text-fg-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {isError ? (
        <div className="mt-8">
          <ErrorState onRetry={() => refetch()} />
        </div>
      ) : isLoading ? (
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
      ) : !facts || facts.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Фактов пока нет" />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {facts.map((fact) => (
            <article
              key={fact.id}
              id={fact.slug}
              className="scroll-mt-24 rounded-card border border-border-subtle bg-surface p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold leading-snug">{fact.title}</h2>
                {fact.category && <Badge color={fact.category.color}>{fact.category.name}</Badge>}
              </div>
              <div className="mt-3">
                <Markdown>{fact.body}</Markdown>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
