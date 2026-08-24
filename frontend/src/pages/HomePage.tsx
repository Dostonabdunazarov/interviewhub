import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Building2, FolderTree, ListChecks } from "lucide-react";
import { useCategories, useLevels, useQuestions, useStats } from "../lib/hooks";
import { QuestionCard } from "../components/QuestionCard";
import { Button } from "../components/ui/Button";
import { CategoryIcon } from "../components/ui/CategoryIcon";
import { QuestionCardSkeleton, Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/States";
import { formatCount } from "../lib/utils";

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Свечение под hero — чисто декоративное. */}
      <div className="glow-brand pointer-events-none absolute inset-x-0 top-0 h-96" aria-hidden="true" />

      <div className="relative mx-auto max-w-content px-page-x pb-12 pt-16 text-center sm:pt-24">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl"
        >
          Готовьтесь к собеседованию <span className="gradient-text">по существу</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="mx-auto mt-5 max-w-xl text-base text-fg-muted"
        >
          Реальные вопросы с собеседований в React, .NET, PostgreSQL и системном дизайне —
          с разобранными ответами, по грейдам и компаниям.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link to="/questions">
            <Button size="lg">
              Смотреть вопросы <ArrowRight size={18} />
            </Button>
          </Link>
          <Link to="/companies">
            <Button size="lg" variant="secondary">
              По компаниям
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function StatsRow() {
  const { data, isLoading, isError } = useStats();

  if (isError) return null; // Статистика — украшение: без неё страница живёт.

  const items = [
    { icon: ListChecks, label: "вопросов", value: data?.totalQuestions },
    { icon: FolderTree, label: "категорий", value: data?.totalCategories },
    { icon: Building2, label: "компаний", value: data?.totalCompanies },
  ];

  return (
    <section className="mx-auto max-w-content px-page-x">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass rounded-card p-4 text-center sm:p-5">
            <Icon size={18} className="mx-auto text-accent" />
            {isLoading ? (
              <Skeleton className="mx-auto mt-2 h-7 w-14" />
            ) : (
              <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCount(value ?? 0)}</p>
            )}
            <p className="mt-0.5 text-xs text-fg-muted">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Categories() {
  const { data, isLoading, isError, refetch } = useCategories();

  return (
    <section className="mx-auto max-w-content px-page-x pt-section-y">
      <h2 className="text-2xl font-semibold tracking-tight">Категории</h2>
      <p className="mt-1 text-sm text-fg-muted">Выберите направление подготовки</p>

      {isError ? (
        <div className="mt-6">
          <ErrorState onRetry={() => refetch()} />
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[104px] rounded-card" />)
            : data?.map((category, i) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}
                >
                  <Link
                    to={`/categories/${category.slug}`}
                    className="group flex h-full items-start gap-3 rounded-card border
                               border-border-subtle bg-surface p-5 transition-colors
                               hover:border-border-strong"
                  >
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-control"
                      style={{
                        color: category.color ?? undefined,
                        backgroundColor: category.color
                          ? `color-mix(in oklab, ${category.color} 14%, transparent)`
                          : undefined,
                      }}
                    >
                      <CategoryIcon name={category.icon} size={20} />
                    </span>

                    <span className="min-w-0">
                      <span className="block font-medium transition-colors group-hover:text-accent">
                        {category.name}
                      </span>
                      {category.description && (
                        <span className="mt-0.5 block text-sm text-fg-muted">
                          {category.description}
                        </span>
                      )}
                      <span className="mt-1.5 block text-xs text-fg-subtle">
                        {formatCount(category.questionCount)} вопросов
                      </span>
                    </span>
                  </Link>
                </motion.div>
              ))}
        </div>
      )}
    </section>
  );
}

function Levels() {
  const { data, isLoading, isError } = useLevels();

  // Грейды — навигационная подсказка, а не контент: если справочник не
  // отдался, страница спокойно живёт без этого блока.
  if (isError) return null;

  const levels = data ? [...data].sort((a, b) => a.rank - b.rank) : undefined;

  return (
    <section className="mx-auto max-w-content px-page-x pt-section-y">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Грейды</h2>
          <p className="mt-1 text-sm text-fg-muted">Выберите уровень позиции</p>
        </div>
        <Link
          to="/levels"
          className="shrink-0 text-sm text-accent transition-colors hover:text-accent-hover"
        >
          Все грейды →
        </Link>
      </div>

      {/* Пять грейдов в ряд на широком экране, по два на узком: карточки
          мелкие, дробить их на три колонки незачем. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[88px] rounded-card" />)
          : levels?.map((level, i) => (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}
              >
                <Link
                  to={`/levels/${level.slug}`}
                  className="group flex h-full flex-col items-center justify-center gap-1.5
                             rounded-card border border-border-subtle bg-surface p-4
                             text-center transition-colors hover:border-border-strong"
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: level.color ?? "var(--ih-fg-subtle)" }}
                  />
                  <span className="font-medium transition-colors group-hover:text-accent">
                    {level.name}
                  </span>
                  <span className="text-xs text-fg-muted">
                    {formatCount(level.questionCount)} вопросов
                  </span>
                </Link>
              </motion.div>
            ))}
      </div>
    </section>
  );
}

function PopularQuestions() {
  const { data, isLoading, isError, refetch } = useQuestions({ sort: "Popular", pageSize: 6 });

  return (
    <section className="mx-auto max-w-content px-page-x py-section-y">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Популярные вопросы</h2>
          <p className="mt-1 text-sm text-fg-muted">Что читают чаще всего</p>
        </div>
        <Link
          to="/questions?sort=Popular"
          className="shrink-0 text-sm text-accent transition-colors hover:text-accent-hover"
        >
          Все вопросы →
        </Link>
      </div>

      {isError ? (
        <div className="mt-6">
          <ErrorState onRetry={() => refetch()} />
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }, (_, i) => <QuestionCardSkeleton key={i} />)
            : data?.items.map((question, i) => (
                <QuestionCard key={question.id} question={question} index={i} />
              ))}
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsRow />
      <Categories />
      <Levels />
      <PopularQuestions />
    </>
  );
}
