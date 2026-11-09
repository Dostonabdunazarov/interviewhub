import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Eye, EyeOff, Trash2 } from "lucide-react";
import {
  useAdminPrep,
  useDeletePrep,
  usePublishPrep,
  useUnpublishPrep,
} from "../../lib/adminHooks";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../../components/ui/States";
import { formatCount, formatDate } from "../../lib/utils";
import { TheoryStatus } from "../../types/api";
import type { PrepGuideAdminItem } from "../../types/admin";

const STATUS_LABEL: Record<number, { text: string; color: string }> = {
  [TheoryStatus.Draft]: { text: "Черновик", color: "#f59e0b" },
  [TheoryStatus.Published]: { text: "Опубликован", color: "#22c55e" },
  [TheoryStatus.Archived]: { text: "Архив", color: "#64748b" },
};

export default function AdminPrepPage() {
  const { data, isLoading, isError, refetch } = useAdminPrep();
  const publish = usePublishPrep();
  const unpublish = useUnpublishPrep();
  const deleteGuide = useDeletePrep();
  const [toDelete, setToDelete] = useState<PrepGuideAdminItem | null>(null);

  const sorted = useMemo(
    () =>
      data
        ? [...data].sort(
            (a, b) =>
              a.roleName.localeCompare(b.roleName, "ru") ||
              a.levelName.localeCompare(b.levelName, "ru") ||
              a.title.localeCompare(b.title, "ru"),
          )
        : [],
    [data],
  );

  const busy = publish.isPending || unpublish.isPending;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Подготовка</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {data ? `${formatCount(data.length)} всего` : "Загружаем…"}
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          Гайды редактируются в <code>content/prep/*.md</code> и загружаются командой{" "}
          <code>node tools/import-prep.mjs</code>.
        </p>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-card" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState title="Гайдов нет" description="Импортируйте их из content/prep." />
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((g) => {
            const st = STATUS_LABEL[g.status];
            const published = g.status === TheoryStatus.Published;
            return (
              <li
                key={g.id}
                className="flex flex-wrap items-center gap-3 rounded-card border border-border-subtle
                           bg-surface px-4 py-3"
              >
                <span className="min-w-0 flex-1 font-medium">{g.title}</span>
                <Badge>{g.roleName}</Badge>
                <Badge>{g.levelName}</Badge>
                <span className="text-sm text-fg-muted">тем: {formatCount(g.topicCount)}</span>
                {st && <Badge color={st.color}>{st.text}</Badge>}
                <span className="text-sm text-fg-muted">{formatDate(g.updatedAt)}</span>
                {published && (
                  <Link
                    to={`/prep/${g.slug}`}
                    className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                  >
                    Открыть <ExternalLink size={14} />
                  </Link>
                )}
                {published ? (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => unpublish.mutate(g.id)}
                  >
                    <EyeOff size={16} /> Снять с публикации
                  </Button>
                ) : (
                  <Button variant="ghost" disabled={busy} onClick={() => publish.mutate(g.id)}>
                    <Eye size={16} /> Опубликовать
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setToDelete(g)}
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

      <ConfirmDialog
        open={toDelete !== null}
        title="Удалить гайд?"
        description={`«${toDelete?.title ?? ""}» исчезнет с сайта.`}
        pending={deleteGuide.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete && deleteGuide.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
        }
      />
    </div>
  );
}
