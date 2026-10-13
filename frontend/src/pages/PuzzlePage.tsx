import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Eye, RotateCcw, X } from "lucide-react";
import { usePuzzle, markSolved } from "../lib/engagementHooks";
import { Markdown } from "../components/Markdown";
import { InlineCode } from "../components/InlineCode";
import { Meta, stripMarkdown, truncate } from "../components/Meta";
import { SuggestButton } from "../components/SuggestDialog";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { DifficultyDots } from "../components/ui/DifficultyDots";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/States";
import { cn, formatCount } from "../lib/utils";
import { SuggestionKind, type PuzzleDetail } from "../types/api";
import { KindBadge } from "./PuzzlesPage";

const LETTERS = ["A", "B", "C", "D"];

function Options({ puzzle }: { puzzle: PuzzleDetail }) {
  const [picked, setPicked] = useState<string | null>(null);
  const answered = picked !== null;
  const correct = puzzle.options.find((o) => o.isCorrect);
  const isRight = answered && picked === correct?.id;

  const pick = (id: string) => {
    if (answered) return;
    setPicked(id);
    markSolved(puzzle.slug, id === correct?.id);
  };

  return (
    <>
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">
          Ваш ответ
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {puzzle.options.map((option, i) => {
            const isPicked = picked === option.id;
            const state = !answered
              ? "idle"
              : option.isCorrect
                ? "correct"
                : isPicked
                  ? "wrong"
                  : "dim";

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => pick(option.id)}
                disabled={answered}
                aria-pressed={isPicked}
                className={cn(
                  "flex items-start gap-3 rounded-card border bg-surface p-4 text-left text-sm",
                  "transition-colors disabled:cursor-default",
                  state === "idle" && "border-border-subtle hover:border-accent",
                  state === "correct" && "border-success bg-success/10",
                  state === "wrong" && "border-danger bg-danger/10",
                  state === "dim" && "border-border-subtle opacity-60",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                    state === "correct" && "border-success bg-success text-white",
                    state === "wrong" && "border-danger bg-danger text-white",
                    (state === "idle" || state === "dim") && "border-border-strong text-fg-muted",
                  )}
                >
                  {state === "correct" ? <Check size={13} /> : state === "wrong" ? <X size={13} /> : LETTERS[i]}
                </span>
                <span className="min-w-0 flex-1 pt-0.5 leading-relaxed">
                  <InlineCode text={option.text} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <AnimatePresence>
        {answered && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-8 rounded-card border border-border-subtle bg-surface"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
              <p className={cn("font-semibold", isRight ? "text-success" : "text-danger")}>
                {isRight ? "Верно!" : "Не совсем."}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                <RotateCcw size={14} /> Ещё раз
              </Button>
            </div>
            <div className="px-5 py-4">
              <Markdown>{puzzle.explanation}</Markdown>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-page-x py-10">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-6 h-9 w-2/3" />
      <Skeleton className="mt-8 h-48 rounded-card" />
      <div className="mt-8 grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-card" />
        ))}
      </div>
    </div>
  );
}

export default function PuzzlePage() {
  const { slug } = useParams();
  const { data, isLoading, isError, refetch } = usePuzzle(slug);

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl px-page-x py-16">
        <ErrorState
          title="Задача не найдена"
          description="Возможно, она снята с публикации или ссылка устарела."
          onRetry={() => refetch()}
        />
        <div className="mt-6 text-center">
          <Link to="/puzzles">
            <Button variant="secondary">Ко всем задачам</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-5xl px-page-x py-10">
      <Meta
        title={data.title}
        description={truncate(stripMarkdown(data.body))}
        path={`/puzzles/${data.slug}`}
        type="article"
      />

      <Link
        to="/puzzles"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft size={15} /> Ко всем задачам
      </Link>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">{data.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <KindBadge kind={data.kind} />
          <Link to={`/puzzles?category=${data.category.slug}`}>
            <Badge color={data.category.color}>{data.category.name}</Badge>
          </Link>
          <Link to={`/puzzles?level=${data.level.slug}`}>
            <Badge color={data.level.color}>{data.level.name}</Badge>
          </Link>
          <DifficultyDots value={data.difficulty} />
          <span className="ml-1 flex items-center gap-1 text-xs text-fg-muted">
            <Eye size={13} /> {formatCount(data.viewCount)}
          </span>
        </div>
      </header>

      <div className="mt-6 rounded-card border border-border-subtle bg-surface-sunken p-5">
        <Markdown>{data.body}</Markdown>
      </div>

      <Options key={data.id} puzzle={data} />

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-6">
        {data.previous ? (
          <Link
            to={`/puzzles/${data.previous.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={15} /> {data.previous.title}
          </Link>
        ) : (
          <span />
        )}
        {data.next && (
          <Link
            to={`/puzzles/${data.next.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
          >
            {data.next.title} <ArrowRight size={15} />
          </Link>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <SuggestButton
          kind={SuggestionKind.Correction}
          target={{ type: "puzzle", slug: data.slug, title: data.title }}
          variant="ghost"
          label="Нашли ошибку в задаче?"
        />
      </div>
    </article>
  );
}
