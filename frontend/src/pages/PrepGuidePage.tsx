import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { Check, RotateCcw } from "lucide-react";
import { usePrepGuide, readPrepProgress, writePrepProgress } from "../lib/prepHooks";
import { Markdown } from "../components/Markdown";
import { Meta, stripMarkdown, truncate } from "../components/Meta";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { DifficultyDots } from "../components/ui/DifficultyDots";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/States";
import { KindBadge } from "./PuzzlesPage";
import NotFoundPage from "./NotFoundPage";
import { cn, formatDate } from "../lib/utils";
import type { PrepGuideDetail, PrepTopic } from "../types/api";

const LINK_CLASS =
  "group flex items-center gap-3 rounded-card border border-border-subtle bg-surface px-4 py-3 transition-colors hover:border-border-strong";

function GuideSkeleton() {
  return (
    <div className="mx-auto max-w-content px-page-x py-10" aria-hidden="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-6 h-9 w-2/3" />
      <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      <Skeleton className="mt-8 h-64 rounded-card" />
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h4 className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">{children}</h4>
  );
}

function TopicLinks({ topic }: { topic: PrepTopic }) {
  return (
    <>
      {topic.articles.length > 0 && (
        <div className="mt-6">
          <SectionTitle>Теория</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2">
            {topic.articles.map((a) => (
              <li key={a.slug}>
                <Link to={`/theory/articles/${a.slug}`} className={LINK_CLASS}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm transition-colors group-hover:text-accent">
                      {a.title}
                    </span>
                    {a.summary && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-fg-muted">
                        {a.summary}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topic.questions.length > 0 && (
        <div className="mt-6">
          <SectionTitle>Вопросы</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2">
            {topic.questions.map((q) => (
              <li key={q.slug}>
                <Link to={`/questions/${q.slug}`} className={LINK_CLASS}>
                  <span className="min-w-0 flex-1 text-sm transition-colors group-hover:text-accent">
                    {q.title}
                  </span>
                  <DifficultyDots value={q.difficulty} className="shrink-0" />
                  <Badge color={q.level.color} className="hidden shrink-0 sm:inline-flex">
                    {q.level.name}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topic.puzzles.length > 0 && (
        <div className="mt-6">
          <SectionTitle>Задачи на код</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2">
            {topic.puzzles.map((p) => (
              <li key={p.slug}>
                <Link to={`/puzzles/${p.slug}`} className={LINK_CLASS}>
                  <span className="min-w-0 flex-1 text-sm transition-colors group-hover:text-accent">
                    {p.title}
                  </span>
                  <KindBadge kind={p.kind} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function GuideView({ data }: { data: PrepGuideDetail }) {
  const slug = data.slug;
  const topicSlugs = useMemo(() => new Set(data.topics.map((t) => t.slug)), [data]);
  const [doneSlugs, setDoneSlugs] = useState<string[]>(() =>
    readPrepProgress(slug).filter((s) => topicSlugs.has(s)),
  );

  useEffect(() => {
    const stored = readPrepProgress(slug);
    const pruned = stored.filter((s) => topicSlugs.has(s));
    if (pruned.length !== stored.length) writePrepProgress(slug, pruned);
  }, [slug, topicSlugs]);

  const done = useMemo(
    () => new Set(doneSlugs.filter((s) => topicSlugs.has(s))),
    [doneSlugs, topicSlugs],
  );

  const toggle = (topicSlug: string) => {
    const next = doneSlugs.includes(topicSlug)
      ? doneSlugs.filter((s) => s !== topicSlug)
      : [...doneSlugs, topicSlug];
    setDoneSlugs(next);
    writePrepProgress(slug, next);
  };

  const reset = () => {
    setDoneSlugs([]);
    writePrepProgress(slug, []);
  };

  const total = data.topics.length;
  const percent = total > 0 ? Math.round((done.size / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-content px-page-x py-10">
      <Meta
        title={data.title}
        description={truncate(stripMarkdown(data.summary || data.intro))}
        path={`/prep/${data.slug}`}
        type="article"
      />

      <nav aria-label="Хлебные крошки" className="text-sm text-fg-muted">
        <Link to="/prep" className="transition-colors hover:text-fg">
          Подготовка
        </Link>
      </nav>

      <div className="mt-5 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-x-10">
        <div className="min-w-0 lg:max-w-4xl">
          <header>
            <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              <span>{data.roleName}</span>
              <Badge color={data.level.color}>{data.level.name}</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
              {data.title}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-fg-muted">{data.summary}</p>
            <p className="mt-3 text-xs text-fg-muted">Обновлено {formatDate(data.updatedAt)}</p>
          </header>

          {total > 0 && (
            <div className="mt-6 rounded-card border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Изучено {done.size} из {total} тем
                </p>
                {done.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <RotateCcw size={14} /> Сбросить
                  </Button>
                )}
              </div>
              <div
                role="progressbar"
                aria-label="Прогресс изучения"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done.size}
                className="mt-3 h-2 overflow-hidden rounded-pill bg-surface-sunken"
              >
                <div
                  className="h-full rounded-pill bg-success transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {total > 0 && (
          <aside className="mt-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
            <nav
              aria-label="Темы программы"
              className="rounded-card border border-border-subtle bg-surface-sunken p-4
                         lg:sticky lg:top-[calc(var(--size-header)+1rem)]
                         lg:max-h-[calc(100dvh-var(--size-header)-2rem)] lg:overflow-y-auto"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                Темы
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {data.topics.map((topic) => {
                  const isDone = done.has(topic.slug);
                  return (
                    <li key={topic.slug}>
                      <a
                        href={`#${topic.slug}`}
                        className={cn(
                          "flex items-start gap-2 text-sm transition-colors hover:text-accent",
                          isDone ? "text-fg" : "text-fg-muted",
                        )}
                      >
                        <Check
                          size={14}
                          aria-label={isDone ? "Изучено" : undefined}
                          aria-hidden={isDone ? undefined : true}
                          className={cn(
                            "mt-0.5 shrink-0",
                            isDone ? "text-success" : "text-transparent",
                          )}
                        />
                        <span className="min-w-0">{topic.title}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>
        )}

        <div className="min-w-0 lg:max-w-4xl">
          {data.intro && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold tracking-tight">Вступление</h2>
              <div className="mt-4 rounded-card border border-border-subtle bg-surface p-5 sm:p-8">
                <Markdown>{data.intro}</Markdown>
              </div>
            </section>
          )}

          {data.interviewFormat && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold tracking-tight">Формат собеседования</h2>
              <div className="mt-4 rounded-card border border-border-subtle bg-surface p-5 sm:p-8">
                <Markdown>{data.interviewFormat}</Markdown>
              </div>
            </section>
          )}

          {total > 0 && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold tracking-tight">Программа</h2>
              <ol className="mt-4 flex flex-col gap-6">
                {data.topics.map((topic, i) => (
                  <li
                    key={topic.slug}
                    id={topic.slug}
                    className="scroll-mt-(--size-header) rounded-card border border-border-subtle
                               bg-surface p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                      <h3 className="min-w-0 flex-1 text-lg font-semibold leading-snug">
                        <span className="mr-2 font-mono text-sm tabular-nums text-fg-muted">
                          {i + 1}.
                        </span>
                        <a href={`#${topic.slug}`} className="transition-colors hover:text-accent">
                          {topic.title}
                        </a>
                      </h3>
                      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-fg-muted">
                        <input
                          type="checkbox"
                          aria-label={`Тема «${topic.title}» изучена`}
                          checked={done.has(topic.slug)}
                          onChange={() => toggle(topic.slug)}
                          className="size-4 accent-(--ih-accent)"
                        />
                        изучено
                      </label>
                    </div>

                    {topic.body && (
                      <div className="mt-4 min-w-0">
                        <Markdown>{topic.body}</Markdown>
                      </div>
                    )}

                    <TopicLinks topic={topic} />
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PrepGuidePage() {
  const { slug } = useParams();
  const { data, isLoading, isError, error, refetch } = usePrepGuide(slug);

  if (isLoading) return <GuideSkeleton />;

  if (isError && axios.isAxiosError(error) && error.response?.status === 404) {
    return <NotFoundPage />;
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-content px-page-x py-10">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return <GuideView key={data.slug} data={data} />;
}
