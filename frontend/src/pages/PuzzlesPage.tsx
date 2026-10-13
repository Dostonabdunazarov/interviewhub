import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Bug, CheckCircle2, Terminal, XCircle } from "lucide-react";
import { usePuzzles, readSolved, type SolvedMap } from "../lib/engagementHooks";
import { useCategories, useLevels } from "../lib/hooks";
import { Meta } from "../components/Meta";
import { Badge } from "../components/ui/Badge";
import { DifficultyDots } from "../components/ui/DifficultyDots";
import { Select } from "../components/ui/Field";
import { Pagination } from "../components/ui/Pagination";
import { QuestionCardSkeleton } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { PuzzleKind, type PuzzleListItem } from "../types/api";

const PAGE_SIZE = 24;

export const KIND_LABELS: Record<number, string> = {
  [PuzzleKind.Output]: "Что выведет",
  [PuzzleKind.Bug]: "Найди баг",
};

export function KindBadge({ kind }: { kind: PuzzleKind }) {
  const Icon = kind === PuzzleKind.Bug ? Bug : Terminal;
  return (
    <Badge className={kind === PuzzleKind.Bug ? "text-danger" : "text-accent"}>
      <Icon size={11} /> {KIND_LABELS[kind]}
    </Badge>
  );
}

function PuzzleCard({
  puzzle,
  index,
  number,
  solved,
}: {
  puzzle: PuzzleListItem;
  index: number;
  number: number;
  solved: boolean | undefined;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04 }}
      className="group relative rounded-card border border-border-subtle bg-surface p-5
                 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-medium leading-snug">
          <span className="mr-2 font-mono text-sm tabular-nums text-fg-muted">{number}.</span>
          <Link
            to={`/puzzles/${puzzle.slug}`}
            className="transition-colors after:absolute after:inset-0 group-hover:text-accent"
          >
            {puzzle.title}
          </Link>
        </h3>
        {solved === true && (
          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" aria-label="Решена" />
        )}
        {solved === false && (
          <XCircle size={17} className="mt-0.5 shrink-0 text-danger" aria-label="Решена с ошибкой" />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <KindBadge kind={puzzle.kind} />
        <Badge color={puzzle.category.color}>{puzzle.category.name}</Badge>
        <Badge color={puzzle.level.color}>{puzzle.level.name}</Badge>
        <DifficultyDots value={puzzle.difficulty} />
      </div>
    </motion.article>
  );
}

export default function PuzzlesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [solved, setSolved] = useState<SolvedMap>({});

  useEffect(() => setSolved(readSolved()), []);

  const category = searchParams.get("category") ?? undefined;
  const level = searchParams.get("level") ?? undefined;
  const kindParam = Number(searchParams.get("kind"));
  const kind = kindParam === PuzzleKind.Output || kindParam === PuzzleKind.Bug ? kindParam : undefined;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const { data, isLoading, isError, refetch } = usePuzzles({
    category,
    level,
    kind,
    page,
    pageSize: PAGE_SIZE,
  });
  const categories = useCategories();
  const levels = useLevels();

  const update = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setSearchParams(next);
  };

  const solvedCount = Object.values(solved).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-content px-page-x py-10">
      <Meta
        title="Задачи на код"
        description="Задачи с собеседований .NET: что выведет программа и найди баг. Четыре варианта ответа и подробный разбор."
        path="/puzzles"
      />

      <h1 className="text-3xl font-semibold tracking-tight">Задачи на код</h1>
      <p className="mt-2 max-w-3xl text-sm text-fg-muted">
        «Что выведет программа» и «найди баг» — как на живом собеседовании. Выберите вариант,
        и откроется разбор: почему так, что происходит под капотом и как исправить.
        {solvedCount > 0 && <> Решено верно: {solvedCount}.</>}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Select
          value={category ?? ""}
          onChange={(e) => update("category", e.target.value || undefined)}
          aria-label="Категория"
        >
          <option value="">Все категории</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          value={level ?? ""}
          onChange={(e) => update("level", e.target.value || undefined)}
          aria-label="Грейд"
        >
          <option value="">Все грейды</option>
          {levels.data?.map((l) => (
            <option key={l.id} value={l.slug}>
              {l.name}
            </option>
          ))}
        </Select>
        <Select
          value={kind ? String(kind) : ""}
          onChange={(e) => update("kind", e.target.value || undefined)}
          aria-label="Тип задачи"
        >
          <option value="">Все типы</option>
          <option value={PuzzleKind.Output}>{KIND_LABELS[PuzzleKind.Output]}</option>
          <option value={PuzzleKind.Bug}>{KIND_LABELS[PuzzleKind.Bug]}</option>
        </Select>
      </div>

      {isError ? (
        <div className="mt-8">
          <ErrorState onRetry={() => refetch()} />
        </div>
      ) : !isLoading && data?.items.length === 0 ? (
        <div className="mt-8">
          <EmptyState description="Попробуйте сбросить фильтры." />
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }, (_, i) => <QuestionCardSkeleton key={i} />)
            : data?.items.map((puzzle, i) => (
                <PuzzleCard
                  key={puzzle.id}
                  puzzle={puzzle}
                  index={i}
                  number={(page - 1) * PAGE_SIZE + i + 1}
                  solved={solved[puzzle.slug]}
                />
              ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(p) => update("page", p > 1 ? String(p) : undefined)}
          />
        </div>
      )}
    </div>
  );
}
