import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  useAdminTags,
  useCreateCategory,
  useCreateCompany,
  useCreateLevel,
  useCreateTag,
  useDeleteCategory,
  useDeleteCompany,
  useDeleteLevel,
  useDeleteTag,
  useUpdateCategory,
  useUpdateCompany,
  useUpdateLevel,
  useUpdateTag,
} from "../../lib/adminHooks";
import { useCategories, useCompanies, useLevels } from "../../lib/hooks";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Field, Input } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import { CategoryIcon } from "../../components/ui/CategoryIcon";
import { CompanyLogo } from "../../components/ui/CompanyLogo";
import { cn } from "../../lib/utils";
import type { Category, Company, Level, Tag } from "../../types/api";

type TabKey = "categories" | "levels" | "companies" | "tags";

const TABS: { key: TabKey; label: string }[] = [
  { key: "categories", label: "Категории" },
  { key: "levels", label: "Грейды" },
  { key: "companies", label: "Компании" },
  { key: "tags", label: "Теги" },
];

/** Пустая строка из формы должна уехать как null, а не как "". */
const orNull = (v: string) => (v.trim() ? v.trim() : null);

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border-subtle">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="border-b border-border-subtle bg-surface-sunken">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 text-left font-medium">
                {h}
              </th>
            ))}
            <th className="w-20 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td className="px-3 py-2.5">
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Изменить"
          className="rounded p-1.5 text-fg-subtle transition-colors hover:text-fg"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Удалить"
          className="rounded p-1.5 text-fg-subtle transition-colors hover:text-danger"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </td>
  );
}

function ColorSwatch({ color }: { color: string | null }) {
  if (!color) return <span className="text-fg-subtle">—</span>;
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-4 shrink-0 rounded border border-border-subtle"
        style={{ backgroundColor: color }}
      />
      <code className="text-xs text-fg-muted">{color}</code>
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

// ── Категории ───────────────────────────────────────────────────────────────

function CategoriesTab() {
  const { data, isLoading } = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();

  const [editing, setEditing] = useState<Category | null | "new">(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    color: "",
    sortOrder: "0",
  });

  function open(item: Category | "new") {
    setEditing(item);
    setForm(
      item === "new"
        ? { name: "", slug: "", description: "", icon: "", color: "", sortOrder: "0" }
        : {
            name: item.name,
            slug: item.slug,
            description: item.description ?? "",
            icon: item.icon ?? "",
            color: item.color ?? "",
            sortOrder: String(item.sortOrder),
          },
    );
  }

  function submit() {
    const input = {
      name: form.name,
      slug: orNull(form.slug),
      description: orNull(form.description),
      icon: orNull(form.icon),
      color: orNull(form.color),
      sortOrder: Number(form.sortOrder) || 0,
    };

    const done = { onSuccess: () => setEditing(null) };
    if (editing === "new") create.mutate(input, done);
    else if (editing) update.mutate({ id: editing.id, input }, done);
  }

  if (isLoading) return <TableSkeleton />;

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => open("new")}>
          <Plus size={15} /> Категория
        </Button>
      </div>

      <Table headers={["Название", "Slug", "Цвет", "Вопросов"]}>
        {data?.map((c) => (
          <tr key={c.id} className="border-b border-border-subtle last:border-0">
            <td className="px-3 py-2.5">
              <span className="flex items-center gap-2 font-medium">
                <CategoryIcon name={c.icon} size={16} style={{ color: c.color ?? undefined }} />
                {c.name}
              </span>
            </td>
            <td className="px-3 py-2.5">
              <code className="text-xs text-fg-muted">{c.slug}</code>
            </td>
            <td className="px-3 py-2.5">
              <ColorSwatch color={c.color} />
            </td>
            <td className="px-3 py-2.5 tabular-nums text-fg-muted">{c.questionCount}</td>
            <RowActions onEdit={() => open(c)} onDelete={() => setToDelete(c)} />
          </tr>
        ))}
      </Table>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Новая категория" : "Категория"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button onClick={submit} disabled={!form.name.trim() || create.isPending || update.isPending}>
              Сохранить
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Название" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Slug" hint="Пусто — сгенерируется из названия">
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
          <Field label="Описание">
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Иконка" hint="Имя lucide в kebab-case: atom, database, network">
            <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          </Field>
          <Field label="Цвет" hint="HEX, например #61dafb">
            <Input
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              placeholder="#61dafb"
            />
          </Field>
          <Field label="Порядок сортировки">
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Удалить категорию?"
        description={
          toDelete && toDelete.questionCount > 0
            ? `«${toDelete.name}» используется в ${toDelete.questionCount} вопросах — сервер откажет. Сначала перенесите их.`
            : `«${toDelete?.name}» будет удалена.`
        }
        pending={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      />
    </>
  );
}

// ── Грейды ──────────────────────────────────────────────────────────────────

function LevelsTab() {
  const { data, isLoading } = useLevels();
  const create = useCreateLevel();
  const update = useUpdateLevel();
  const remove = useDeleteLevel();

  const [editing, setEditing] = useState<Level | null | "new">(null);
  const [toDelete, setToDelete] = useState<Level | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", rank: "1", color: "" });

  function open(item: Level | "new") {
    setEditing(item);
    setForm(
      item === "new"
        ? { name: "", slug: "", rank: "1", color: "" }
        : {
            name: item.name,
            slug: item.slug,
            rank: String(item.rank),
            color: item.color ?? "",
          },
    );
  }

  function submit() {
    const input = {
      name: form.name,
      slug: orNull(form.slug),
      rank: Number(form.rank) || 0,
      color: orNull(form.color),
    };
    const done = { onSuccess: () => setEditing(null) };
    if (editing === "new") create.mutate(input, done);
    else if (editing) update.mutate({ id: editing.id, input }, done);
  }

  if (isLoading) return <TableSkeleton />;

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => open("new")}>
          <Plus size={15} /> Грейд
        </Button>
      </div>

      <Table headers={["Название", "Slug", "Ранг", "Цвет", "Вопросов"]}>
        {data?.map((l) => (
          <tr key={l.id} className="border-b border-border-subtle last:border-0">
            <td className="px-3 py-2.5 font-medium">{l.name}</td>
            <td className="px-3 py-2.5">
              <code className="text-xs text-fg-muted">{l.slug}</code>
            </td>
            <td className="px-3 py-2.5 tabular-nums text-fg-muted">{l.rank}</td>
            <td className="px-3 py-2.5">
              <ColorSwatch color={l.color} />
            </td>
            <td className="px-3 py-2.5 tabular-nums text-fg-muted">{l.questionCount}</td>
            <RowActions onEdit={() => open(l)} onDelete={() => setToDelete(l)} />
          </tr>
        ))}
      </Table>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Новый грейд" : "Грейд"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button onClick={submit} disabled={!form.name.trim() || create.isPending || update.isPending}>
              Сохранить
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Название" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Slug" hint="Пусто — сгенерируется из названия">
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
          <Field label="Ранг" hint="Чем больше, тем выше грейд — по нему сортируются списки">
            <Input
              type="number"
              value={form.rank}
              onChange={(e) => setForm({ ...form, rank: e.target.value })}
            />
          </Field>
          <Field label="Цвет" hint="Используется в бейджах на сайте">
            <Input
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              placeholder="#22c55e"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Удалить грейд?"
        description={
          toDelete && toDelete.questionCount > 0
            ? `«${toDelete.name}» используется в ${toDelete.questionCount} вопросах — сервер откажет.`
            : `«${toDelete?.name}» будет удалён.`
        }
        pending={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      />
    </>
  );
}

// ── Компании ────────────────────────────────────────────────────────────────

function CompaniesTab() {
  const { data, isLoading } = useCompanies();
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const remove = useDeleteCompany();

  const [editing, setEditing] = useState<Company | null | "new">(null);
  const [toDelete, setToDelete] = useState<Company | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    logoUrl: "",
    color: "",
    description: "",
    country: "",
    sortOrder: "0",
  });

  function open(item: Company | "new") {
    setEditing(item);
    setForm(
      item === "new"
        ? { name: "", slug: "", logoUrl: "", color: "", description: "", country: "", sortOrder: "0" }
        : {
            name: item.name,
            slug: item.slug,
            logoUrl: item.logoUrl ?? "",
            color: item.color ?? "",
            description: item.description ?? "",
            country: item.country ?? "",
            sortOrder: String(item.sortOrder),
          },
    );
  }

  function submit() {
    const input = {
      name: form.name,
      slug: orNull(form.slug),
      logoUrl: orNull(form.logoUrl),
      color: orNull(form.color),
      description: orNull(form.description),
      country: orNull(form.country),
      sortOrder: Number(form.sortOrder) || 0,
    };
    const done = { onSuccess: () => setEditing(null) };
    if (editing === "new") create.mutate(input, done);
    else if (editing) update.mutate({ id: editing.id, input }, done);
  }

  if (isLoading) return <TableSkeleton />;

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => open("new")}>
          <Plus size={15} /> Компания
        </Button>
      </div>

      <Table headers={["Название", "Slug", "Страна", "Вопросов"]}>
        {data?.map((c) => (
          <tr key={c.id} className="border-b border-border-subtle last:border-0">
            <td className="px-3 py-2.5">
              <span className="flex items-center gap-2 font-medium">
                <CompanyLogo company={c} className="size-7 text-[10px]" />
                {c.name}
              </span>
            </td>
            <td className="px-3 py-2.5">
              <code className="text-xs text-fg-muted">{c.slug}</code>
            </td>
            <td className="px-3 py-2.5 text-fg-muted">{c.country ?? "—"}</td>
            <td className="px-3 py-2.5 tabular-nums text-fg-muted">{c.questionCount}</td>
            <RowActions onEdit={() => open(c)} onDelete={() => setToDelete(c)} />
          </tr>
        ))}
      </Table>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Новая компания" : "Компания"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button onClick={submit} disabled={!form.name.trim() || create.isPending || update.isPending}>
              Сохранить
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Название" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Slug" hint="Пусто — сгенерируется из названия">
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
          <Field label="URL логотипа" hint="Пусто — на сайте покажется буквенная заглушка">
            <Input
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://cdn.simpleicons.org/google"
            />
          </Field>
          <Field label="Цвет">
            <Input
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              placeholder="#4285f4"
            />
          </Field>
          <Field label="Описание">
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Страна">
            <Input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              placeholder="US"
            />
          </Field>
          <Field label="Порядок сортировки">
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Удалить компанию?"
        description={
          toDelete && toDelete.questionCount > 0
            ? `«${toDelete.name}» привязана к ${toDelete.questionCount} вопросам — сервер откажет. Сначала снимите привязки.`
            : `«${toDelete?.name}» будет удалена.`
        }
        pending={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      />
    </>
  );
}

// ── Теги ────────────────────────────────────────────────────────────────────

function TagsTab() {
  const { data, isLoading } = useAdminTags();
  const create = useCreateTag();
  const update = useUpdateTag();
  const remove = useDeleteTag();

  const [editing, setEditing] = useState<Tag | null | "new">(null);
  const [toDelete, setToDelete] = useState<Tag | null>(null);
  const [form, setForm] = useState({ name: "", slug: "" });

  function open(item: Tag | "new") {
    setEditing(item);
    setForm(item === "new" ? { name: "", slug: "" } : { name: item.name, slug: item.slug });
  }

  function submit() {
    const input = { name: form.name, slug: orNull(form.slug) };
    const done = { onSuccess: () => setEditing(null) };
    if (editing === "new") create.mutate(input, done);
    else if (editing) update.mutate({ id: editing.id, input }, done);
  }

  if (isLoading) return <TableSkeleton />;

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => open("new")}>
          <Plus size={15} /> Тег
        </Button>
      </div>

      <Table headers={["Название", "Slug", "Вопросов"]}>
        {data?.map((t) => (
          <tr key={t.id} className="border-b border-border-subtle last:border-0">
            <td className="px-3 py-2.5 font-medium">{t.name}</td>
            <td className="px-3 py-2.5">
              <code className="text-xs text-fg-muted">{t.slug}</code>
            </td>
            <td className="px-3 py-2.5 tabular-nums text-fg-muted">{t.questionCount}</td>
            <RowActions onEdit={() => open(t)} onDelete={() => setToDelete(t)} />
          </tr>
        ))}
      </Table>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Новый тег" : "Тег"}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button onClick={submit} disabled={!form.name.trim() || create.isPending || update.isPending}>
              Сохранить
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Название" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Slug" hint="Пусто — сгенерируется из названия">
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* Теги, в отличие от категорий, удаляются свободно: связи уходят
          каскадом, сами вопросы не страдают. */}
      <ConfirmDialog
        open={toDelete !== null}
        title="Удалить тег?"
        description={
          toDelete && toDelete.questionCount > 0
            ? `«${toDelete.name}» отвяжется от ${toDelete.questionCount} вопросов. Сами вопросы останутся.`
            : `«${toDelete?.name}» будет удалён.`
        }
        pending={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      />
    </>
  );
}

export default function ReferencesPage() {
  const [tab, setTab] = useState<TabKey>("categories");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Справочники</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Категории, грейды, компании и теги. Используемые справочники удалить нельзя.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border-subtle">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              tab === t.key
                ? "border-accent font-medium text-fg"
                : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "categories" && <CategoriesTab />}
        {tab === "levels" && <LevelsTab />}
        {tab === "companies" && <CompaniesTab />}
        {tab === "tags" && <TagsTab />}
      </div>
    </div>
  );
}
