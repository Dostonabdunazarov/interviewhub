import { useState, type FormEvent } from "react";
import { FilePlus2, Pencil, Trash2 } from "lucide-react";
import { useAdminFacts, useCreateFact, useDeleteFact, useUpdateFact } from "../../lib/adminHooks";
import { useCategories } from "../../lib/hooks";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Field, Input, Select, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../../components/ui/States";
import { formatCount } from "../../lib/utils";
import { QuestionStatus, type FactAdmin } from "../../types/api";
import type { FactInput } from "../../types/admin";
import { CONTENT_STATUS_LABEL } from "./AdminPuzzlesPage";

const EMPTY: FactInput = {
  title: "",
  slug: null,
  body: "",
  status: QuestionStatus.Published,
  categoryId: null,
};

function FactForm({ fact, onDone }: { fact: FactAdmin | null; onDone: () => void }) {
  const categories = useCategories();
  const create = useCreateFact();
  const update = useUpdateFact();
  const [form, setForm] = useState<FactInput>(
    fact
      ? {
          title: fact.title,
          slug: null,
          body: fact.body,
          status: fact.status,
          categoryId: fact.categoryId,
        }
      : EMPTY,
  );
  const [slug, setSlug] = useState(fact?.slug ?? "");

  const set = <K extends keyof FactInput>(key: K, value: FactInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const pending = create.isPending || update.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input: FactInput = {
      ...form,
      slug: slug.trim() && slug.trim() !== fact?.slug ? slug.trim() : null,
    };
    if (fact) update.mutate({ id: fact.id, input }, { onSuccess: onDone });
    else create.mutate(input, { onSuccess: onDone });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Заголовок" required>
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={512} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Slug" hint="Пусто — из заголовка">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={256} />
        </Field>
        <Field label="Категория">
          <Select
            value={form.categoryId ?? ""}
            onChange={(e) => set("categoryId", e.target.value || null)}
          >
            <option value="">Без категории</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Статус">
          <Select
            value={form.status}
            onChange={(e) => set("status", Number(e.target.value) as QuestionStatus)}
          >
            {Object.entries(CONTENT_STATUS_LABEL).map(([value, { text }]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Текст (markdown)" required>
        <Textarea rows={10} value={form.body} onChange={(e) => set("body", e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Отмена
        </Button>
        <Button type="submit" disabled={!form.title.trim() || !form.body.trim() || pending}>
          {pending ? "Сохраняем…" : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}

export default function AdminFactsPage() {
  const { data, isLoading, isError, refetch } = useAdminFacts();
  const deleteFact = useDeleteFact();
  const [editing, setEditing] = useState<FactAdmin | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<FactAdmin | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Факты «А вы знали?»</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {data ? `${formatCount(data.length)} всего` : "Загружаем…"}
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <FilePlus2 size={16} /> Новый факт
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-card" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="Фактов нет" description="Создайте первый или импортируйте из content/facts." />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((f) => {
            const st = CONTENT_STATUS_LABEL[f.status];
            return (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-3 rounded-card border border-border-subtle
                           bg-surface px-4 py-3"
              >
                <span className="min-w-0 flex-1 font-medium">{f.title}</span>
                {f.categoryName && <Badge>{f.categoryName}</Badge>}
                <Badge color={st.color}>{st.text}</Badge>
                <button
                  type="button"
                  onClick={() => setEditing(f)}
                  aria-label="Редактировать"
                  className="rounded p-1 text-fg-muted transition-colors hover:text-fg"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setToDelete(f)}
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

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? "Редактирование факта" : "Новый факт"}
        size="lg"
      >
        {editing !== undefined && (
          <FactForm key={editing?.id ?? "new"} fact={editing} onDone={() => setEditing(undefined)} />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Удалить факт?"
        description={`«${toDelete?.title ?? ""}» исчезнет с сайта.`}
        pending={deleteFact.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete && deleteFact.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
        }
      />
    </div>
  );
}
