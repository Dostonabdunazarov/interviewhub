import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, ExternalLink, Trash2, X } from "lucide-react";
import {
  useAdminSuggestions,
  useDeleteSuggestion,
  useSuggestionCounts,
  useUpdateSuggestion,
} from "../../lib/adminHooks";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Textarea } from "../../components/ui/Field";
import { Pagination } from "../../components/ui/Pagination";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../../components/ui/States";
import { cn, formatDate } from "../../lib/utils";
import {
  SuggestionKind,
  SuggestionStatus,
  type Suggestion,
  type SuggestionTargetType,
} from "../../types/api";

const KIND_LABEL: Record<number, string> = {
  [SuggestionKind.NewQuestion]: "Новый вопрос",
  [SuggestionKind.Correction]: "Правка",
  [SuggestionKind.Other]: "Другое",
};

const STATUS_LABEL: Record<number, { text: string; color: string }> = {
  [SuggestionStatus.New]: { text: "Новое", color: "#3b82f6" },
  [SuggestionStatus.Accepted]: { text: "Принято", color: "#22c55e" },
  [SuggestionStatus.Rejected]: { text: "Отклонено", color: "#64748b" },
};

const TARGET_PATH: Record<SuggestionTargetType, string> = {
  question: "/questions/",
  article: "/theory/articles/",
  puzzle: "/puzzles/",
  fact: "/facts#",
};

function SuggestionCard({ item, onDelete }: { item: Suggestion; onDelete: () => void }) {
  const update = useUpdateSuggestion();
  const [note, setNote] = useState(item.adminNote ?? "");
  const st = STATUS_LABEL[item.status];

  const setStatus = (status: SuggestionStatus) =>
    update.mutate({ id: item.id, input: { status, adminNote: note.trim() || null } });

  const meta = [
    item.category && `Направление: ${item.category}`,
    item.level && `Грейд: ${item.level}`,
    item.company && `Компания: ${item.company}`,
    item.round && `Этап: ${item.round}`,
    item.contact && `Контакт: ${item.contact}`,
  ].filter(Boolean);

  return (
    <article className="rounded-card border border-border-subtle bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{KIND_LABEL[item.kind]}</Badge>
        <Badge color={st.color}>{st.text}</Badge>
        {item.targetType && item.targetSlug && (
          <Link
            to={`${TARGET_PATH[item.targetType]}${item.targetSlug}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
          >
            {item.targetSlug} <ExternalLink size={12} />
          </Link>
        )}
        <span className="ml-auto text-xs text-fg-subtle">{formatDate(item.createdAt)}</span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm">{item.text}</p>

      {item.answerDraft && (
        <details className="mt-3 rounded-control border border-border-subtle bg-surface-sunken px-3 py-2">
          <summary className="cursor-pointer text-sm text-fg-muted">Ответ / тезисы</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm">{item.answerDraft}</p>
        </details>
      )}

      {meta.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
          {meta.map((m) => (
            <span key={m as string}>{m}</span>
          ))}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Заметка для себя"
          maxLength={2000}
          className="font-sans sm:flex-1"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={update.isPending}
            onClick={() => setStatus(SuggestionStatus.Accepted)}
          >
            <Check size={14} /> Принять
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={update.isPending}
            onClick={() => setStatus(SuggestionStatus.Rejected)}
          >
            <X size={14} /> Отклонить
          </Button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Удалить"
            className="rounded p-1 text-fg-muted transition-colors hover:text-danger"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function AdminSuggestionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = Number(searchParams.get("status") ?? SuggestionStatus.New);
  const status = statusParam in STATUS_LABEL ? (statusParam as SuggestionStatus) : undefined;
  const page = Number(searchParams.get("page")) || 1;

  const { data, isLoading, isError, refetch } = useAdminSuggestions({ status, page, pageSize: 20 });
  const counts = useSuggestionCounts();
  const remove = useDeleteSuggestion();
  const [toDelete, setToDelete] = useState<Suggestion | null>(null);

  const tabs: { value: string; label: string; count?: number }[] = [
    { value: String(SuggestionStatus.New), label: "Новые", count: counts.data?.new },
    { value: String(SuggestionStatus.Accepted), label: "Принятые", count: counts.data?.accepted },
    { value: String(SuggestionStatus.Rejected), label: "Отклонённые", count: counts.data?.rejected },
    { value: "all", label: "Все" },
  ];
  const active = status ? String(status) : "all";

  const patch = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setSearchParams(next);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Предложения</h1>
        <p className="mt-1 text-sm text-fg-muted">Вопросы и правки, присланные гостями сайта.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => patch("status", t.value)}
            className={cn(
              "rounded-pill border px-3 py-1 text-sm transition-colors",
              active === t.value
                ? "border-accent text-fg"
                : "border-border-subtle text-fg-muted hover:border-border-strong hover:text-fg",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 tabular-nums text-fg-subtle">{t.count}</span>}
          </button>
        ))}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-card" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="Пусто" description="Здесь появятся предложения из формы на сайте." />
      ) : (
        <div className="flex flex-col gap-3">
          {data.items.map((item) => (
            <SuggestionCard key={item.id} item={item} onDelete={() => setToDelete(item)} />
          ))}
        </div>
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
        title="Удалить предложение?"
        description="Текст предложения будет удалён безвозвратно."
        pending={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
        }
      />
    </div>
  );
}
