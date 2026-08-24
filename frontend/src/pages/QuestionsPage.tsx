import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useQuestions } from "../lib/hooks";
import { useDebounced } from "../lib/useDebounced";
import { QuestionCard } from "../components/QuestionCard";
import { QuestionFilters, type FilterValues } from "../components/QuestionFilters";
import { Button } from "../components/ui/Button";
import { Pagination } from "../components/ui/Pagination";
import { QuestionCardSkeleton } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { formatCount } from "../lib/utils";
import type { QuestionSort } from "../types/api";

// Первым идёт вариант по умолчанию — так селект не выглядит переключённым
// на старте.
const SORTS: { value: QuestionSort; label: string }[] = [
  { value: "DifficultyAsc", label: "Сначала лёгкие" },
  { value: "DifficultyDesc", label: "Сначала сложные" },
  { value: "Newest", label: "Сначала новые" },
  { value: "Oldest", label: "Сначала старые" },
  { value: "Popular", label: "Популярные" },
];

// 50 — верхняя граница читаемой страницы: серверный лимит 100, но столько
// карточек за один заход всё равно не просмотреть.
const PAGE_SIZE = 50;

export default function QuestionsPage() {
  /**
   * Единственный источник правды по фильтрам — URL. Так ссылка на выборку
   * шарится и переживает перезагрузку, а кнопка «назад» работает ожидаемо.
   */
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: FilterValues = {
    category: searchParams.get("category") ?? undefined,
    level: searchParams.get("level") ?? undefined,
    company: searchParams.get("company") ?? undefined,
    tag: searchParams.get("tag") ?? undefined,
    difficulty: searchParams.get("difficulty")
      ? Number(searchParams.get("difficulty"))
      : undefined,
  };

  const urlQuery = searchParams.get("q") ?? "";
  // По умолчанию — от простого к сложному: каталог читают для подготовки,
  // и начинать логично с лёгких вопросов, а не с самых свежих.
  const sort = (searchParams.get("sort") as QuestionSort | null) ?? "DifficultyAsc";
  const page = Number(searchParams.get("page")) || 1;

  // Поле ввода живёт локально, в URL уезжает уже отложенное значение —
  // иначе каждый символ плодил бы запись в истории браузера.
  const [searchInput, setSearchInput] = useState(urlQuery);
  const debouncedSearch = useDebounced(searchInput);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Поиск из хедера меняет ?q= извне — подхватываем в поле.
  useEffect(() => setSearchInput(urlQuery), [urlQuery]);

  useEffect(() => {
    if (debouncedSearch === urlQuery) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedSearch) next.set("q", debouncedSearch);
        else next.delete("q");
        next.delete("page"); // Новый запрос — всегда с первой страницы.
        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch, urlQuery, setSearchParams]);

  function patchParams(patch: Record<string, string | number | undefined>, resetPage = true) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (resetPage) next.delete("page");
      return next;
    });
  }

  const { data, isLoading, isError, refetch, isFetching } = useQuestions({
    ...filters,
    q: urlQuery || undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  const filtersNode = (
    <QuestionFilters
      values={filters}
      onChange={(patch) => {
        patchParams(patch);
        setDrawerOpen(false);
      }}
      onReset={() => {
        setSearchInput("");
        setSearchParams({});
        setDrawerOpen(false);
      }}
    />
  );

  const activeCount = Object.values(filters).filter((v) => v !== undefined).length;

  return (
    <div className="mx-auto max-w-content px-page-x py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Каталог вопросов</h1>
      <p className="mt-1 text-sm text-fg-muted">
        {data ? `${formatCount(data.totalCount)} вопросов` : "Загружаем…"}
      </p>

      <div className="mt-8 flex gap-8">
        {/* Сайдбар на десктопе; на мобильном тот же блок уезжает в drawer. */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-[calc(var(--size-header)+1.5rem)]">{filtersNode}</div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Поиск по вопросам и ответам…"
                aria-label="Поиск"
                className="h-10 w-full rounded-control border border-border-subtle bg-surface
                           pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle
                           transition-colors focus:border-accent focus:outline-none"
              />
            </div>

            <select
              value={sort}
              onChange={(e) => patchParams({ sort: e.target.value })}
              aria-label="Сортировка"
              className="h-10 rounded-control border border-border-subtle bg-surface px-3
                         text-sm text-fg transition-colors focus:border-accent focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <Button
              variant="secondary"
              className="lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Открыть фильтры"
            >
              <SlidersHorizontal size={16} />
              {activeCount > 0 && (
                <span className="grid size-5 place-items-center rounded-full gradient-brand text-xs text-white">
                  {activeCount}
                </span>
              )}
            </Button>
          </div>

          <div className="mt-6" aria-busy={isFetching}>
            {isError ? (
              <ErrorState onRetry={() => refetch()} />
            ) : isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <QuestionCardSkeleton key={i} />
                ))}
              </div>
            ) : data && data.items.length === 0 ? (
              <EmptyState
                title="Вопросы не найдены"
                description="Попробуйте изменить фильтры или поисковый запрос."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearchInput("");
                      setSearchParams({});
                    }}
                  >
                    Сбросить всё
                  </Button>
                }
              />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data?.items.map((question, i) => (
                    <QuestionCard key={question.id} question={question} index={i} />
                  ))}
                </div>

                {data && data.totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination
                      page={data.page}
                      totalPages={data.totalPages}
                      onChange={(p) => patchParams({ page: p }, false)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Мобильный drawer с фильтрами — планом предписан вместо сайдбара. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-60 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-xs overflow-y-auto bg-canvas p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold">Фильтры</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Закрыть фильтры"
                className="inline-flex size-8 items-center justify-center rounded-control
                           text-fg-muted hover:bg-surface-sunken hover:text-fg"
              >
                <X size={18} />
              </button>
            </div>
            {filtersNode}
          </div>
        </div>
      )}
    </div>
  );
}
