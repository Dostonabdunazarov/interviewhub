import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Eye, Star } from "lucide-react";
import { useQuestion } from "../lib/hooks";
import { Markdown } from "../components/Markdown";
import { QuestionNav } from "../components/QuestionNav";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { CompanyLogo } from "../components/ui/CompanyLogo";
import { DifficultyDots } from "../components/ui/DifficultyDots";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/States";
import { formatCount, formatDate } from "../lib/utils";
import { InterviewRound, type Answer } from "../types/api";

const ROUND_LABELS: Record<number, string> = {
  [InterviewRound.Screening]: "Скрининг",
  [InterviewRound.Technical]: "Техническая секция",
  [InterviewRound.SystemDesign]: "System Design",
  [InterviewRound.Final]: "Финал",
};

/**
 * Ответ под спойлером: смысл сайта — сначала попытаться ответить самому.
 * Основной ответ (IsPrimary) раскрыт сразу — он же и самый короткий,
 * а прятать вообще всё было бы кликом ради клика.
 */
function AnswerBlock({ answer, index }: { answer: Answer; index: number }) {
  const [open, setOpen] = useState(answer.isPrimary);

  return (
    <div className="rounded-card border border-border-subtle bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <span className="flex items-center gap-2 font-medium">
          {answer.isPrimary ? "Основной ответ" : `Ответ ${index + 1}`}
          {answer.isPrimary && <Badge>основной</Badge>}
        </span>
        <span className="shrink-0 text-sm text-accent">{open ? "Скрыть" : "Показать ответ"}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border-subtle px-5 py-4">
              <Markdown>{answer.body}</Markdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-page-x py-10">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-6 h-9 w-full" />
      <Skeleton className="mt-2 h-9 w-2/3" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-6 w-20 rounded-pill" />
        <Skeleton className="h-6 w-24 rounded-pill" />
      </div>
      <Skeleton className="mt-8 h-40 rounded-card" />
    </div>
  );
}

export default function QuestionPage() {
  const { slug } = useParams();
  const { data, isLoading, isError, refetch } = useQuestion(slug);

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-page-x py-16">
        <ErrorState
          title="Вопрос не найден"
          description="Возможно, он снят с публикации или ссылка устарела."
          onRetry={() => refetch()}
        />
        <div className="mt-6 text-center">
          <Link to="/questions">
            <Button variant="secondary">В каталог</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-page-x py-10">
      <Link
        to="/questions"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft size={15} /> К каталогу
      </Link>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">{data.title}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link to={`/categories/${data.category.slug}`}>
            <Badge color={data.category.color}>{data.category.name}</Badge>
          </Link>
          <Link to={`/levels/${data.level.slug}`}>
            <Badge color={data.level.color}>{data.level.name}</Badge>
          </Link>
          <DifficultyDots value={data.difficulty} />
          {data.isFeatured && (
            <Badge className="text-warning">
              <Star size={11} className="fill-current" /> избранное
            </Badge>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          <span className="flex items-center gap-1">
            <Eye size={13} /> {formatCount(data.viewCount)}
          </span>
          <span>Добавлен {formatDate(data.createdAt)}</span>
          {data.updatedAt && <span>Обновлён {formatDate(data.updatedAt)}</span>}
        </div>
      </header>

      {data.body && (
        <div className="mt-6 rounded-card border border-border-subtle bg-surface-sunken p-5">
          <Markdown>{data.body}</Markdown>
        </div>
      )}

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="sr-only">Ответы</h2>
        {data.answers.length === 0 ? (
          <p className="rounded-card border border-dashed border-border-subtle p-6 text-center
                        text-sm text-fg-muted">
            Ответ пока не написан.
          </p>
        ) : (
          data.answers.map((answer, i) => (
            <AnswerBlock key={answer.id} answer={answer} index={i} />
          ))
        )}
      </section>

      {data.companies.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">
            Спрашивали в компаниях
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.companies.map((c) => (
              <Link
                key={c.id}
                to={`/companies/${c.slug}`}
                className="flex items-center gap-2 rounded-control border border-border-subtle
                           bg-surface px-3 py-2 text-sm transition-colors hover:border-border-strong"
              >
                <CompanyLogo company={c} className="size-6 text-[10px]" />
                <span className="font-medium">{c.name}</span>
                {/* Год и этап — то, ради чего вопрос вообще ищут по компании. */}
                {(c.askedYear || c.round) && (
                  <span className="text-xs text-fg-muted">
                    {[c.askedYear, c.round ? ROUND_LABELS[c.round] : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.tags.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">Теги</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.tags.map((t) => (
              <Link
                key={t.id}
                to={`/questions?tag=${t.slug}`}
                className="rounded-pill border border-border-subtle px-3 py-1 text-xs
                           text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              >
                {t.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <QuestionNav question={data} />
    </article>
  );
}
