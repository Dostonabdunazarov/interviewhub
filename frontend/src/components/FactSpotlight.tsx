import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Lightbulb, Shuffle } from "lucide-react";
import { useFacts } from "../lib/engagementHooks";
import { Markdown } from "./Markdown";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";

function shuffled(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function FactSpotlight({ category }: { category?: string }) {
  const { data, isLoading, isError } = useFacts(category);
  const [step, setStep] = useState(0);

  const order = useMemo(() => shuffled(data?.length ?? 0), [data]);

  if (isError || (!isLoading && (!data || data.length === 0))) return null;

  const fact = data && order.length > 0 ? data[order[step % order.length]] : undefined;

  return (
    <section className="rounded-card border border-border-subtle bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-subtle">
          <Lightbulb size={16} className="text-warning" /> А вы знали?
        </h2>
        <div className="flex items-center gap-2">
          <Link
            to="/facts"
            className="text-sm text-accent transition-colors hover:text-accent-hover"
          >
            Все факты →
          </Link>
          {data && data.length > 1 && (
            <Button variant="secondary" size="sm" onClick={() => setStep((s) => s + 1)}>
              <Shuffle size={14} /> Ещё
            </Button>
          )}
        </div>
      </div>

      {isLoading || !fact ? (
        <div className="mt-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="mt-3 h-16 w-full" />
        </div>
      ) : (
        <div key={fact.id} className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold leading-snug">{fact.title}</h3>
            {fact.category && <Badge color={fact.category.color}>{fact.category.name}</Badge>}
          </div>
          <div className="mt-3">
            <Markdown>{fact.body}</Markdown>
          </div>
        </div>
      )}
    </section>
  );
}
