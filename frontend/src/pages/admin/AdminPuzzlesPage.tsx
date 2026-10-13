import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FilePlus2, Trash2 } from "lucide-react";
import { useAdminPuzzles, useDeletePuzzle } from "../../lib/adminHooks";
import { useCategories } from "../../lib/hooks";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Select } from "../../components/ui/Field";
import { Pagination } from "../../components/ui/Pagination";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../../components/ui/States";
import { DifficultyDots } from "../../components/ui/DifficultyDots";
import { formatCount } from "../../lib/utils";
import { QuestionStatus, type PuzzleListItem } from "../../types/api";
import { KIND_LABELS } from "../PuzzlesPage";

const PAGE_SIZE = 50;

export const CONTENT_STATUS_LABEL: Record<number, { text: string; color: string }> = {
  [QuestionStatus.Draft]: { text: "Черновик", color: "#f59e0b" },
  [QuestionStatus.Published]: { text: "Опубликован", color: "#22c55e" },
  [QuestionStatus.Archived]: { text: "Архив", color: "#64748b" },
};

export default function AdminPuzzlesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") ?? undefined;
  const statusParam = Number(searchParams.get("status"));
  const status = statusParam in CONTENT_STATUS_LABEL ? (statusParam as QuestionStatus) : undefined;
  const page = Number(searchParams.get("page")) || 1;

  const { data, isLoading, isError, refetch } = useAdminPuzzles({
    category,
    status,
    page,
    pageSize: PAGE_SIZE,
  });
  const categories = useCategories();
  const deletePuzzle = useDeletePuzzle();
  const [toDelete, setToDelete] = useState<PuzzleListItem | null>(null);

  const patch = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setSearchParams(next);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Задачи на код</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {data ? `${formatCount(data.totalCount)} найдено` : "Загружаем…"}
          </p>
        </div>
        <Link to="/admin/puzzles/new">
          <Button>
            <FilePlus2 size={16} /> Новая задача
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          value={category ?? ""}
          onChange={(e) => patch("category", e.target.value || undefined)}
          aria-label="Категория"
          className="w-auto"
        >
          <option value="">Все категории</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          value={status ? String(status) : ""}
          onChange={(e) => patch("status", e.target.value || undefined)}
          aria-label="Статус"
          className="w-auto"
        >
          <option value="">Все статусы</option>
          {Object.entries(CONTENT_STATUS_LABEL).map(([value, { text }]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-card" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="Задач нет" description="Создайте первую или импортируйте из content/puzzles." />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.items.map((p) => {
            const st = CONTENT_STATUS_LABEL[p.status];
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 rounded-card border border-border-subtle
                           bg-surface px-4 py-3"
              >
                <Link
                  to={`/admin/puzzles/${p.id}`}
                  className="min-w-0 flex-1 font-medium transition-colors hover:text-accent"
                >
                  {p.title}
                </Link>
                <Badge>{KIND_LABELS[p.kind]}</Badge>
                <Badge color={p.category.color}>{p.category.name}</Badge>
                <Badge color={p.level.color}>{p.level.name}</Badge>
                <DifficultyDots value={p.difficulty} />
                <Badge color={st.color}>{st.text}</Badge>
                <button
                  type="button"
                  onClick={() => setToDelete(p)}
                  aria-label="Удалить"
                  className="rounded p-1 text-fg-muted transition-colors hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onChange={(p) => patch("page", p > 1 ? String(p) : undefined)}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Удалить задачу?"
        description={`«${toDelete?.title ?? ""}» будет удалена вместе с вариантами ответа.`}
        pending={deletePuzzle.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete && deletePuzzle.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
        }
      />
    </div>
  );
}
