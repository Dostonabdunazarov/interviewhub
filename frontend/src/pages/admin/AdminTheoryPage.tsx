import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useAdminTheoryArticles,
  useAdminTheoryTree,
  useCreateTheorySection,
  useCreateTheoryTrack,
  useDeleteTheorySection,
  useDeleteTheoryTrack,
  useUpdateTheorySection,
  useUpdateTheoryTrack,
} from "../../lib/adminHooks";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Checkbox, Field, Input, Select } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import { CategoryIcon } from "../../components/ui/CategoryIcon";
import { cn } from "../../lib/utils";
import { TheoryStatus, type TheorySectionAdmin, type TheoryTrackAdmin } from "../../types/api";

/** Пустая строка из формы должна уехать как null, а не как "". */
const orNull = (v: string) => (v.trim() ? v.trim() : null);

const STATUS_LABELS: Record<number, string> = {
  [TheoryStatus.Draft]: "Черновик",
  [TheoryStatus.Published]: "Опубликована",
  [TheoryStatus.Archived]: "Архив",
};

interface TrackForm {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: string;
  isPublished: boolean;
}

interface SectionForm {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  trackId: string;
}

const EMPTY_TRACK: TrackForm = {
  name: "",
  slug: "",
  description: "",
  icon: "",
  color: "",
  sortOrder: "0",
  isPublished: false,
};

/**
 * Статьи раздела. Грузятся по клику на раздел, а не вместе с деревом:
 * при полном наполнении это ~190 строк, из которых нужен один раздел.
 */
function SectionArticles({ sectionId }: { sectionId: string }) {
  const { data, isLoading } = useAdminTheoryArticles({ sectionId });

  if (isLoading) return <Skeleton className="mx-3 my-2 h-8" />;

  if (!data || data.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-fg-subtle">
        Статей пока нет.{" "}
        <Link
          to={`/admin/theory/articles/new?sectionId=${sectionId}`}
          className="text-accent hover:underline"
        >
          Написать первую
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {data.map((a) => (
        <li key={a.id}>
          <Link
            to={`/admin/theory/articles/${a.id}`}
            className="group flex items-center gap-3 rounded-control px-3 py-2
                       transition-colors hover:bg-surface-sunken"
          >
            <span className="w-6 shrink-0 text-xs tabular-nums text-fg-subtle">
              {a.sortOrder}
            </span>

            <span className="min-w-0 flex-1 truncate text-sm transition-colors
                             group-hover:text-accent">
              {a.title}
            </span>

            {/* Сколько вопросов привязано — видно, где связь с каталогом ещё не сделана. */}
            {a.relatedQuestionCount > 0 && (
              <span className="shrink-0 text-xs text-fg-subtle">
                {a.relatedQuestionCount} вопр.
              </span>
            )}

            <span className="shrink-0 text-xs tabular-nums text-fg-subtle">
              {a.readingMinutes} мин
            </span>

            <Badge
              className={cn(
                "shrink-0",
                a.status === TheoryStatus.Published ? "text-success" : "text-fg-muted",
              )}
            >
              {STATUS_LABELS[a.status]}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TrackBranch({
  track,
  onEditTrack,
  onDeleteTrack,
  onAddSection,
  onEditSection,
  onDeleteSection,
}: {
  track: TheoryTrackAdmin;
  onEditTrack: () => void;
  onDeleteTrack: () => void;
  onAddSection: () => void;
  onEditSection: (section: TheorySectionAdmin) => void;
  onDeleteSection: (section: TheorySectionAdmin) => void;
}) {
  const [open, setOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  return (
    <div className="rounded-card border border-border-subtle bg-surface">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? `Свернуть ${track.name}` : `Развернуть ${track.name}`}
          className="grid size-7 shrink-0 place-items-center rounded-control
                     text-fg-subtle hover:bg-surface-sunken"
        >
          <ChevronRight size={15} className={cn("transition-transform", open && "rotate-90")} />
        </button>

        <span
          className="grid size-8 shrink-0 place-items-center rounded-control bg-surface-sunken"
          style={track.color ? { color: track.color } : undefined}
        >
          <CategoryIcon name={track.icon} size={16} />
        </span>

        <span className="w-8 shrink-0 text-xs tabular-nums text-fg-subtle">
          {track.sortOrder}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{track.name}</span>
          <span className="block truncate text-xs text-fg-subtle">{track.slug}</span>
        </span>

        {/*
          Скрытый трек не виден гостям целиком, даже с опубликованными статьями,
          — это главный переключатель раздела, поэтому он в строке, а не в форме.
        */}
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 text-xs",
            track.isPublished ? "text-success" : "text-fg-subtle",
          )}
          title={track.isPublished ? "Виден на сайте" : "Скрыт от гостей"}
        >
          {track.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
          {track.isPublished ? "виден" : "скрыт"}
        </span>

        <span className="shrink-0 text-xs text-fg-subtle">
          {track.sections.length} разд. · {track.articleCount} ст.
        </span>

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEditTrack}
            aria-label="Изменить трек"
            className="rounded p-1.5 text-fg-subtle transition-colors hover:text-fg"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={onDeleteTrack}
            aria-label="Удалить трек"
            className="rounded p-1.5 text-fg-subtle transition-colors hover:text-danger"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border-subtle p-3">
          {track.sections.length === 0 ? (
            <p className="px-2 py-1 text-sm text-fg-subtle">Разделов пока нет.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {track.sections.map((section) => {
                const expanded = openSection === section.id;

                return (
                  <div key={section.id} className="rounded-control border border-border-subtle">
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => setOpenSection(expanded ? null : section.id)}
                        aria-expanded={expanded}
                        className="grid size-6 shrink-0 place-items-center rounded text-fg-subtle
                                   hover:bg-surface-sunken"
                      >
                        <ChevronRight
                          size={14}
                          className={cn("transition-transform", expanded && "rotate-90")}
                        />
                      </button>

                      <span className="w-6 shrink-0 text-xs tabular-nums text-fg-subtle">
                        {section.sortOrder}
                      </span>

                      <span className="min-w-0 flex-1 truncate text-sm">{section.name}</span>

                      <span className="shrink-0 text-xs text-fg-subtle">
                        {section.articleCount} ст.
                      </span>

                      <Link
                        to={`/admin/theory/articles/new?sectionId=${section.id}`}
                        aria-label={`Новая статья в разделе ${section.name}`}
                        className="rounded p-1.5 text-fg-subtle transition-colors hover:text-accent"
                      >
                        <Plus size={15} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => onEditSection(section)}
                        aria-label="Изменить раздел"
                        className="rounded p-1.5 text-fg-subtle transition-colors hover:text-fg"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSection(section)}
                        aria-label="Удалить раздел"
                        className="rounded p-1.5 text-fg-subtle transition-colors hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {expanded && (
                      <div className="border-t border-border-subtle">
                        <SectionArticles sectionId={section.id} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={onAddSection}
          >
            <Plus size={14} /> Раздел
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminTheoryPage() {
  const { data, isLoading } = useAdminTheoryTree();

  const createTrack = useCreateTheoryTrack();
  const updateTrack = useUpdateTheoryTrack();
  const deleteTrack = useDeleteTheoryTrack();
  const createSection = useCreateTheorySection();
  const updateSection = useUpdateTheorySection();
  const deleteSection = useDeleteTheorySection();

  const [trackEditing, setTrackEditing] = useState<TheoryTrackAdmin | "new" | null>(null);
  const [trackForm, setTrackForm] = useState<TrackForm>(EMPTY_TRACK);
  const [trackToDelete, setTrackToDelete] = useState<TheoryTrackAdmin | null>(null);

  const [sectionEditing, setSectionEditing] = useState<TheorySectionAdmin | "new" | null>(null);
  const [sectionForm, setSectionForm] = useState<SectionForm>({
    name: "",
    slug: "",
    description: "",
    sortOrder: "0",
    trackId: "",
  });
  const [sectionToDelete, setSectionToDelete] = useState<TheorySectionAdmin | null>(null);

  function openTrack(track: TheoryTrackAdmin | "new") {
    setTrackEditing(track);
    setTrackForm(
      track === "new"
        ? { ...EMPTY_TRACK, sortOrder: String((data?.length ?? 0) + 1) }
        : {
            name: track.name,
            // Пустой slug при правке означает «оставить прежним»: slug трека
            // уже в ссылках, и менять его надо осознанно.
            slug: "",
            description: track.description ?? "",
            icon: track.icon ?? "",
            color: track.color ?? "",
            sortOrder: String(track.sortOrder),
            isPublished: track.isPublished,
          },
    );
  }

  function openSection(trackId: string, section: TheorySectionAdmin | "new", nextOrder = 0) {
    setSectionEditing(section);
    setSectionForm(
      section === "new"
        ? { name: "", slug: "", description: "", sortOrder: String(nextOrder), trackId }
        : {
            name: section.name,
            slug: "",
            description: section.description ?? "",
            sortOrder: String(section.sortOrder),
            trackId,
          },
    );
  }

  function submitTrack() {
    const input = {
      name: trackForm.name,
      slug: orNull(trackForm.slug),
      description: orNull(trackForm.description),
      icon: orNull(trackForm.icon),
      color: orNull(trackForm.color),
      sortOrder: Number(trackForm.sortOrder) || 0,
      isPublished: trackForm.isPublished,
    };

    const done = { onSuccess: () => setTrackEditing(null) };

    if (trackEditing === "new") createTrack.mutate(input, done);
    else if (trackEditing) updateTrack.mutate({ id: trackEditing.id, input }, done);
  }

  function submitSection() {
    const input = {
      name: sectionForm.name,
      slug: orNull(sectionForm.slug),
      description: orNull(sectionForm.description),
      sortOrder: Number(sectionForm.sortOrder) || 0,
      trackId: sectionForm.trackId,
    };

    const done = { onSuccess: () => setSectionEditing(null) };

    if (sectionEditing === "new") createSection.mutate(input, done);
    else if (sectionEditing) updateSection.mutate({ id: sectionEditing.id, input }, done);
  }

  const trackPending = createTrack.isPending || updateTrack.isPending;
  const sectionPending = createSection.isPending || updateSection.isPending;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Теория</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Треки и разделы — скелет навигации. Гостям виден только опубликованный
            трек, и только те разделы, где есть опубликованные статьи.
          </p>
        </div>

        <div className="flex gap-2">
          <Link to="/admin/theory/articles/new">
            <Button size="sm">
              <Plus size={15} /> Статья
            </Button>
          </Link>
          <Button size="sm" variant="secondary" onClick={() => openTrack("new")}>
            <Plus size={15} /> Трек
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-card" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-subtle p-8 text-center
                      text-sm text-fg-muted">
          Треков нет. Обычно их заводит сидер при старте — если список пуст,
          создайте трек вручную.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((track) => (
            <TrackBranch
              key={track.id}
              track={track}
              onEditTrack={() => openTrack(track)}
              onDeleteTrack={() => setTrackToDelete(track)}
              onAddSection={() =>
                openSection(track.id, "new", track.sections.length + 1)
              }
              onEditSection={(s) => openSection(track.id, s)}
              onDeleteSection={setSectionToDelete}
            />
          ))}
        </div>
      )}

      <Modal
        open={trackEditing !== null}
        title={trackEditing === "new" ? "Новый трек" : "Редактирование трека"}
        onClose={() => setTrackEditing(null)}
      >
        <div className="flex flex-col gap-4">
          <Field label="Название" required>
            <Input
              value={trackForm.name}
              onChange={(e) => setTrackForm({ ...trackForm, name: e.target.value })}
              placeholder=".NET Backend"
            />
          </Field>

          <Field
            label="Slug"
            hint={
              trackEditing === "new"
                ? "Пусто — сгенерируется из названия"
                : "Пусто — оставить прежним. Slug трека уже в ссылках"
            }
          >
            <Input
              value={trackForm.slug}
              onChange={(e) => setTrackForm({ ...trackForm, slug: e.target.value })}
              placeholder="dotnet-backend"
            />
          </Field>

          <Field label="Описание">
            <Input
              value={trackForm.description}
              onChange={(e) => setTrackForm({ ...trackForm, description: e.target.value })}
              placeholder="C#, CLR, асинхронность…"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Иконка" hint="lucide, kebab-case">
              <Input
                value={trackForm.icon}
                onChange={(e) => setTrackForm({ ...trackForm, icon: e.target.value })}
                placeholder="hexagon"
              />
            </Field>

            <Field label="Цвет">
              <Input
                value={trackForm.color}
                onChange={(e) => setTrackForm({ ...trackForm, color: e.target.value })}
                placeholder="#8b5cf6"
              />
            </Field>

            <Field label="Порядок">
              <Input
                type="number"
                value={trackForm.sortOrder}
                onChange={(e) => setTrackForm({ ...trackForm, sortOrder: e.target.value })}
                min={0}
              />
            </Field>
          </div>

          <Checkbox
            label="Виден гостям"
            checked={trackForm.isPublished}
            onChange={(e) => setTrackForm({ ...trackForm, isPublished: e.target.checked })}
          />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTrackEditing(null)}>
              Отмена
            </Button>
            <Button onClick={submitTrack} disabled={trackPending || !trackForm.name.trim()}>
              {trackPending ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={sectionEditing !== null}
        title={sectionEditing === "new" ? "Новый раздел" : "Редактирование раздела"}
        onClose={() => setSectionEditing(null)}
      >
        <div className="flex flex-col gap-4">
          <Field label="Название" required>
            <Input
              value={sectionForm.name}
              onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
              placeholder="CLR и память"
            />
          </Field>

          <Field
            label="Slug"
            hint={
              sectionEditing === "new"
                ? "Пусто — сгенерируется. Уникален внутри трека, не глобально"
                : "Пусто — оставить прежним"
            }
          >
            <Input
              value={sectionForm.slug}
              onChange={(e) => setSectionForm({ ...sectionForm, slug: e.target.value })}
              placeholder="clr-memory"
            />
          </Field>

          <Field label="Описание">
            <Input
              value={sectionForm.description}
              onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Смена трека переносит раздел целиком — вместе со статьями. */}
            <Field label="Трек" required>
              <Select
                value={sectionForm.trackId}
                onChange={(e) => setSectionForm({ ...sectionForm, trackId: e.target.value })}
              >
                {data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Порядок">
              <Input
                type="number"
                value={sectionForm.sortOrder}
                onChange={(e) => setSectionForm({ ...sectionForm, sortOrder: e.target.value })}
                min={0}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSectionEditing(null)}>
              Отмена
            </Button>
            <Button onClick={submitSection} disabled={sectionPending || !sectionForm.name.trim()}>
              {sectionPending ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={trackToDelete !== null}
        title="Удалить трек?"
        description={`«${trackToDelete?.name}» будет удалён. Треки с разделами удалить нельзя.`}
        pending={deleteTrack.isPending}
        onCancel={() => setTrackToDelete(null)}
        onConfirm={() =>
          deleteTrack.mutate(trackToDelete!.id, { onSettled: () => setTrackToDelete(null) })
        }
      />

      <ConfirmDialog
        open={sectionToDelete !== null}
        title="Удалить раздел?"
        description={`«${sectionToDelete?.name}» будет удалён. Разделы со статьями удалить нельзя.`}
        pending={deleteSection.isPending}
        onCancel={() => setSectionToDelete(null)}
        onConfirm={() =>
          deleteSection.mutate(sectionToDelete!.id, { onSettled: () => setSectionToDelete(null) })
        }
      />
    </div>
  );
}
