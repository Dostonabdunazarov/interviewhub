import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Archive, FilePlus2, Search, Send, Trash2 } from "lucide-react";
import {
  useAdminQuestions,
  useDeleteQuestion,
  useUpdateQuestion,
} from "../../lib/adminHooks";
import { useDebounced } from "../../lib/useDebounced";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Input, Select } from "../../components/ui/Field";
import { Pagination } from "../../components/ui/Pagination";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../../components/ui/States";
import { api } from "../../lib/api";
import { formatCount, formatDate } from "../../lib/utils";
import {
  QuestionStatus,
  type QuestionDetail,
  type QuestionListItem,
  type QuestionStatusFilter,
} from "../../types/api";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: QuestionStatusFilter; label: string }[] = [
  { value: "All", label: "Все статусы" },
  { value: "Draft", label: "Черновики" },
  { value: "Published", label: "Опубликованные" },
  { value: "Archived", label: "Архив" },
];

const STATUS_LABEL: Record<number, { text: string; color: string }> = {
  [QuestionStatus.Draft]: { text: "Черновик", color: "#f59e0b" },
  [QuestionStatus.Published]: { text: "Опубликован", color: "#22c55e" },
  [QuestionStatus.Archived]: { text: "Архив", color: "#64748b" },
};

export default function AdminQuestionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get("status") as QuestionStatusFilter | null) ?? "All";
  const urlQuery = searchParams.get("q") ?? "";
  const page = Number(searchParams.get("page")) || 1;

  const [searchInput, setSearchInput] = useState(urlQuery);
  const debouncedSearch = useDebounced(searchInput);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toDelete, setToDelete] = useState<QuestionListItem | null>(null);

  useEffect(() => setSearchInput(urlQuery), [urlQuery]);

  useEffect(() => {
    if (debouncedSearch === urlQuery) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedSearch) next.set("q", debouncedSearch);
        else next.delete("q");
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch, urlQuery, setSearchParams]);

  const { data, isLoading, isError, refetch } = useAdminQuestions({
    status,
    q: urlQuery || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();

  // Выбор сбрасываем при любой смене выборки: галочки на невидимых строках
  // привели бы к массовому действию над не тем, что видит пользователь.
  useEffect(() => setSelected(new Set()), [status, urlQuery, page]);

  function patchParams(patch: Record<string, string | number | undefined>, resetPage = true) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      if (resetPage) next.delete("page");
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = Boolean(data?.items.length) && selected.size === data?.items.length;

  /**
   * Массовая смена статуса. Отдельного bulk-эндпоинта нет, поэтому шлём
   * по PUT на каждый вопрос.
   *
   * PUT — это полное состояние, а не патч: бэкенд пишет `Body = input.Body`
   * как есть. Карточка списка тела не содержит, поэтому собрать запрос
   * из неё нельзя — `body: null` стёр бы постановку вопроса.
   * Отсюда GET детали перед каждым PUT: лишний запрос дешевле потери текста.
   */
  async function bulkSetStatus(newStatus: QuestionStatus) {
    const ids = (data?.items ?? []).filter((q) => selected.has(q.id)).map((q) => q.id);

    for (const id of ids) {
      const { data: full } = await api.get<QuestionDetail>(`/admin/questions/${id}`);

      await updateQuestion.mutateAsync({
        id,
        input: {
          title: full.title,
          body: full.body,
          slug: null, // не трогаем: ссылка на вопрос уже могла разойтись
          categoryId: full.category.id,
          levelId: full.level.id,
          difficulty: full.difficulty,
          status: newStatus,
          isFeatured: full.isFeatured,
          companies: full.companies.map((c) => ({
            companyId: c.id,
            askedYear: c.askedYear,
            round: c.round,
          })),
          tagIds: full.tags.map((t) => t.id),
        },
      });
    }

    setSelected(new Set());
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Вопросы</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {data ? `${formatCount(data.totalCount)} найдено` : "Загружаем…"}
          </p>
        </div>
        <Link to="/admin/questions/new">
          <Button>
            <FilePlus2 size={16} /> Новый вопрос
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск по вопросам…"
            aria-label="Поиск"
            className="pl-9"
          />
        </div>

        <Select
          value={status}
          onChange={(e) => patchParams({ status: e.target.value })}
          aria-label="Статус"
          className="w-auto"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-control border border-border-subtle
                        bg-surface-sunken px-4 py-3">
          <span className="text-sm font-medium">Выбрано: {selected.size}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={updateQuestion.isPending}
              onClick={() => void bulkSetStatus(QuestionStatus.Published)}
            >
              <Send size={14} /> Опубликовать
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={updateQuestion.isPending}
              onClick={() => void bulkSetStatus(QuestionStatus.Archived)}
            >
              <Archive size={14} /> В архив
            </Button>
          </div>
        </div>
      )}

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState
          title="Вопросы не найдены"
          description="Измените фильтр или создайте новый вопрос."
          action={
            <Link to="/admin/questions/new">
              <Button>Создать вопрос</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Таблица со скроллом по горизонтали — планом требуется для узких экранов. */}
          <div className="overflow-x-auto rounded-card border border-border-subtle">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-border-subtle bg-surface-sunken">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(
                          allSelected ? new Set() : new Set(data?.items.map((q) => q.id)),
                        )
                      }
                      aria-label="Выбрать все"
                      className="size-4 accent-[var(--ih-accent)]"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">Заголовок</th>
                  <th className="px-3 py-2.5 text-left font-medium">Статус</th>
                  <th className="px-3 py-2.5 text-left font-medium">Категория</th>
                  <th className="px-3 py-2.5 text-left font-medium">Грейд</th>
                  <th className="px-3 py-2.5 text-left font-medium">Создан</th>
                  <th className="w-12 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data?.items.map((q) => {
                  const badge = STATUS_LABEL[q.status];
                  return (
                    <tr key={q.id} className="border-b border-border-subtle last:border-0">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(q.id)}
                          onChange={() => toggleOne(q.id)}
                          aria-label={`Выбрать «${q.title}»`}
                          className="size-4 accent-[var(--ih-accent)]"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          to={`/admin/questions/${q.id}`}
                          className="font-medium transition-colors hover:text-accent"
                        >
                          {q.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge color={badge.color}>{badge.text}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-fg-muted">{q.category.name}</td>
                      <td className="px-3 py-2.5 text-fg-muted">{q.level.name}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-fg-subtle">
                        {formatDate(q.createdAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setToDelete(q)}
                          aria-label={`Удалить «${q.title}»`}
                          className="rounded p-1.5 text-fg-subtle transition-colors hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              onChange={(p) => patchParams({ page: p }, false)}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Удалить вопрос?"
        description={`«${toDelete?.title}» и все его ответы будут удалены безвозвратно.`}
        pending={deleteQuestion.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (!toDelete) return;
          deleteQuestion.mutate(toDelete.id, { onSettled: () => setToDelete(null) });
        }}
      />
    </div>
  );
}
