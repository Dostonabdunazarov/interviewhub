import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { usePrepGuides, readPrepProgress } from "../lib/prepHooks";
import { Meta } from "../components/Meta";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import type { PrepGuideListItem } from "../types/api";

function GuideCard({
  guide,
  index,
  done,
}: {
  guide: PrepGuideListItem;
  index: number;
  done: number | null;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04 }}
      className="group relative flex flex-col rounded-card border border-border-subtle
                 bg-surface p-5 transition-colors hover:border-border-strong"
    >
      <div className="flex items-center gap-2 text-xs font-medium text-fg-muted">
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: guide.level.color ?? "var(--ih-fg-subtle)" }}
        />
        {guide.level.name}
      </div>

      <h3 className="mt-3 text-base font-medium leading-snug">
        <Link
          to={`/prep/${guide.slug}`}
          className="transition-colors after:absolute after:inset-0 group-hover:text-accent"
        >
          {guide.title}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-3 text-sm text-fg-muted">{guide.summary}</p>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs text-fg-subtle">
        <span>
          {guide.topicCount} тем · {guide.questionCount} вопросов
        </span>
        {done !== null && done > 0 && (
          <span className="font-medium text-success">
            изучено {done} из {guide.topicCount}
          </span>
        )}
      </div>
    </motion.article>
  );
}

function GuidesSkeleton() {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-40 rounded-card" />
      ))}
    </div>
  );
}

export default function PrepPage() {
  const { data, isLoading, isError, refetch } = usePrepGuides();
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!data) return;
    const next: Record<string, number> = {};
    for (const g of data) next[g.slug] = Math.min(readPrepProgress(g.slug).length, g.topicCount);
    setProgress(next);
  }, [data]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: PrepGuideListItem[] }>();
    for (const g of data ?? []) {
      const group = map.get(g.role) ?? { name: g.roleName, items: [] };
      group.items.push(g);
      map.set(g.role, group);
    }
    return [...map.entries()];
  }, [data]);

  return (
    <div className="mx-auto max-w-content px-page-x py-10">
      <Meta
        title="Подготовка к собеседованию"
        description="Пошаговые программы подготовки к собеседованию по ролям и грейдам: темы, теория, вопросы и задачи на код."
        path="/prep"
      />

      <h1 className="text-3xl font-semibold tracking-tight">Подготовка к собеседованию</h1>
      <p className="mt-2 max-w-3xl text-sm text-fg-muted">
        Программы по ролям и грейдам: что повторить, в каком порядке и на какие вопросы
        обратить внимание. Отмечайте изученные темы — прогресс хранится в вашем браузере.
      </p>

      {isError ? (
        <div className="mt-8">
          <ErrorState onRetry={() => refetch()} />
        </div>
      ) : isLoading ? (
        <GuidesSkeleton />
      ) : groups.length === 0 ? (
        <div className="mt-8">
          <EmptyState description="Программы подготовки скоро появятся." />
        </div>
      ) : (
        groups.map(([role, group]) => (
          <section key={role} className="mt-10">
            <h2 className="text-xl font-semibold tracking-tight">{group.name}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((guide, i) => (
                <GuideCard
                  key={guide.slug}
                  guide={guide}
                  index={i}
                  done={progress[guide.slug] ?? null}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
