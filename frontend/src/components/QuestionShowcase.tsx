import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuestions } from "../lib/hooks";
import { QuestionCard } from "./QuestionCard";
import { Button } from "./ui/Button";
import { Pagination } from "./ui/Pagination";
import { QuestionCardSkeleton } from "./ui/Skeleton";
import { EmptyState, ErrorState } from "./ui/States";
import { formatCount } from "../lib/utils";
import type { QuestionQueryParams } from "../types/api";

// 30 карточек — компромисс между числом переходов по страницам и объёмом,
// который реально просматривают за один заход (серверный лимит — 100).
const PAGE_SIZE = 30;

/**
 * Витрина: заголовок + сетка вопросов по одному фильтру.
 * Общая для /categories/:slug, /levels/:slug и /companies/:slug —
 * страницы отличаются только шапкой и тем, какой фильтр зафиксирован.
 */
export function QuestionShowcase({
  filter,
  header,
  emptyText = "Здесь пока нет вопросов.",
}: {
  filter: QuestionQueryParams;
  header: ReactNode;
  emptyText?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;

  const { data, isLoading, isError, refetch } = useQuestions({
    ...filter,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-content px-page-x py-10">
      <Link
        to="/questions"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft size={15} /> К каталогу
      </Link>

      <div className="mt-6">{header}</div>

      <div className="mt-8">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <QuestionCardSkeleton key={i} />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            description={emptyText}
            action={
              <Link to="/questions">
                <Button variant="secondary">Смотреть все вопросы</Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data?.items.map((question, i) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  index={i}
                  number={(page - 1) * PAGE_SIZE + i + 1}
                />
              ))}
            </div>

            {data && data.totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  page={data.page}
                  totalPages={data.totalPages}
                  onChange={(p) => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set("page", String(p));
                      return next;
                    });
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Счётчик найденного — одинаково выглядит на всех витринах. */
export function ShowcaseCount({ count }: { count: number | undefined }) {
  return (
    <p className="mt-2 text-sm text-fg-muted">
      {count === undefined ? "Загружаем…" : `${formatCount(count)} вопросов`}
    </p>
  );
}
