import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useAdminPuzzle, useCreatePuzzle, useUpdatePuzzle } from "../../lib/adminHooks";
import { useCategories, useLevels } from "../../lib/hooks";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../components/ui/Field";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/States";
import { PuzzleKind, QuestionStatus } from "../../types/api";
import type { PuzzleInput } from "../../types/admin";
import { KIND_LABELS } from "../PuzzlesPage";
import { CONTENT_STATUS_LABEL } from "./AdminPuzzlesPage";

const LETTERS = ["A", "B", "C", "D"];

const EMPTY: PuzzleInput = {
  title: "",
  slug: null,
  kind: PuzzleKind.Output,
  body: "",
  explanation: "",
  difficulty: 3,
  status: QuestionStatus.Draft,
  categoryId: "",
  levelId: "",
  options: LETTERS.map((_, i) => ({ text: "", isCorrect: i === 0 })),
};

export default function PuzzleEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const existing = useAdminPuzzle(id);
  const categories = useCategories();
  const levels = useLevels();
  const create = useCreatePuzzle();
  const update = useUpdatePuzzle();

  const [form, setForm] = useState<PuzzleInput>(EMPTY);
  const [slug, setSlug] = useState("");

  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    setForm({
      title: p.title,
      slug: null,
      kind: p.kind,
      body: p.body,
      explanation: p.explanation,
      difficulty: p.difficulty,
      status: p.status,
      categoryId: p.categoryId,
      levelId: p.levelId,
      options: p.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
    });
    setSlug(p.slug);
  }, [existing.data]);

  const set = <K extends keyof PuzzleInput>(key: K, value: PuzzleInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setOptionText = (index: number, text: string) =>
    set(
      "options",
      form.options.map((o, i) => (i === index ? { ...o, text } : o)),
    );

  const setCorrect = (index: number) =>
    set(
      "options",
      form.options.map((o, i) => ({ ...o, isCorrect: i === index })),
    );

  const pending = create.isPending || update.isPending;
  const valid =
    form.title.trim() &&
    form.body.trim() &&
    form.explanation.trim() &&
    form.categoryId &&
    form.levelId &&
    form.options.every((o) => o.text.trim());

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input: PuzzleInput = {
      ...form,
      slug: slug.trim() && slug.trim() !== existing.data?.slug ? slug.trim() : null,
    };

    if (isNew) {
      create.mutate(input, {
        onSuccess: (created) => navigate(`/admin/puzzles/${created.id}`, { replace: true }),
      });
    } else {
      update.mutate({ id, input });
    }
  };

  if (!isNew && existing.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (!isNew && (existing.isError || !existing.data))
    return <ErrorState title="Задача не найдена" onRetry={() => existing.refetch()} />;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/admin/puzzles"
            className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={15} /> К задачам
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {isNew ? "Новая задача" : "Редактирование задачи"}
          </h1>
        </div>
        <div className="flex gap-2">
          {!isNew && existing.data?.status === QuestionStatus.Published && (
            <a href={`/puzzles/${existing.data.slug}`} target="_blank" rel="noreferrer">
              <Button type="button" variant="secondary">
                <ExternalLink size={15} /> На сайте
              </Button>
            </a>
          )}
          <Button type="submit" disabled={!valid || pending}>
            {pending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Заголовок" required>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={512} />
        </Field>
        <Field label="Slug" hint="Пусто — сгенерируется из заголовка">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={256} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Field label="Тип">
          <Select
            value={form.kind}
            onChange={(e) => set("kind", Number(e.target.value) as PuzzleKind)}
          >
            <option value={PuzzleKind.Output}>{KIND_LABELS[PuzzleKind.Output]}</option>
            <option value={PuzzleKind.Bug}>{KIND_LABELS[PuzzleKind.Bug]}</option>
          </Select>
        </Field>
        <Field label="Категория" required>
          <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">—</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Грейд" required>
          <Select value={form.levelId} onChange={(e) => set("levelId", e.target.value)}>
            <option value="">—</option>
            {levels.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Сложность">
          <Select
            value={form.difficulty}
            onChange={(e) => set("difficulty", Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d}
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

      <Field label="Условие (markdown)" required>
        <Textarea rows={12} value={form.body} onChange={(e) => set("body", e.target.value)} />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">
          Варианты ответа <span className="font-normal text-fg-subtle">— отметьте верный</span>
        </legend>
        {form.options.map((option, i) => (
          <div key={i} className="flex items-center gap-3">
            <input
              type="radio"
              name="correct"
              checked={option.isCorrect}
              onChange={() => setCorrect(i)}
              aria-label={`Вариант ${LETTERS[i]} верный`}
              className="size-4 accent-[var(--ih-accent)]"
            />
            <span className="w-4 text-sm font-semibold text-fg-muted">{LETTERS[i]}</span>
            <Input
              value={option.text}
              onChange={(e) => setOptionText(i, e.target.value)}
              maxLength={1024}
              className="font-mono"
            />
          </div>
        ))}
      </fieldset>

      <Field label="Разбор (markdown)" required>
        <Textarea
          rows={12}
          value={form.explanation}
          onChange={(e) => set("explanation", e.target.value)}
        />
      </Field>
    </form>
  );
}
