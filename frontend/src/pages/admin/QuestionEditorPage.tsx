import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useAdminQuestion,
  useAddAnswer,
  useCreateQuestion,
  useDeleteAnswer,
  useDeleteQuestion,
  useUpdateAnswer,
  useUpdateQuestion,
  useAdminTags,
} from "../../lib/adminHooks";
import { useCategories, useCompanies, useLevels } from "../../lib/hooks";
import { Markdown } from "../../components/Markdown";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Checkbox, Field, Input, Select, Textarea } from "../../components/ui/Field";
import { Skeleton } from "../../components/ui/Skeleton";
import { CompanyLogo } from "../../components/ui/CompanyLogo";
import { cn } from "../../lib/utils";
import { InterviewRound, QuestionStatus, type Answer } from "../../types/api";

const ROUND_OPTIONS = [
  { value: "", label: "— этап —" },
  { value: String(InterviewRound.Screening), label: "Скрининг" },
  { value: String(InterviewRound.Technical), label: "Техническая" },
  { value: String(InterviewRound.SystemDesign), label: "System Design" },
  { value: String(InterviewRound.Final), label: "Финал" },
];

/**
 * Схема формы вопроса. Ограничения повторяют серверные (`AdminValidators.cs`):
 * форма должна отсекать очевидно неверное до запроса, но источник правды —
 * бэкенд, поэтому его 400 всё равно показываем тостом.
 */
const questionSchema = z.object({
  title: z.string().trim().min(1, "Заголовок обязателен").max(512, "Не длиннее 512 символов"),
  body: z.string().max(20000).optional(),
  slug: z.string().trim().max(256).optional(),
  categoryId: z.string().min(1, "Выберите категорию"),
  levelId: z.string().min(1, "Выберите грейд"),
  // <select> отдаёт строку, а API ждёт число. z.coerce тут не годится:
  // он делает входной тип схемы unknown, и resolver перестаёт совпадать
  // по типам с useForm<QuestionForm>.
  difficulty: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().int().min(1).max(5)),
  status: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().int()),
  isFeatured: z.boolean(),
});

type QuestionForm = z.input<typeof questionSchema>;
type QuestionFormOut = z.output<typeof questionSchema>;

interface CompanyLink {
  companyId: string;
  askedYear: string;
  round: string;
}

/** Редактор одного ответа: markdown с превью и флагом «основной». */
function AnswerEditor({
  answer,
  onDeleted,
}: {
  answer: Answer;
  onDeleted: () => void;
}) {
  const [body, setBody] = useState(answer.body);
  const [isPrimary, setIsPrimary] = useState(answer.isPrimary);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateAnswer = useUpdateAnswer();
  const deleteAnswer = useDeleteAnswer();

  const dirty = body !== answer.body || isPrimary !== answer.isPrimary;

  // Сервер мог поменять IsPrimary у соседних ответов (он держит его единственным),
  // поэтому синхронизируемся с пришедшими данными.
  useEffect(() => {
    setBody(answer.body);
    setIsPrimary(answer.isPrimary);
  }, [answer.body, answer.isPrimary]);

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Checkbox
          label="Основной ответ"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
        />
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPreview((v) => !v)}
            aria-pressed={preview}
          >
            {preview ? <Pencil size={14} /> : <Eye size={14} />}
            {preview ? "Править" : "Превью"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            aria-label="Удалить ответ"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="min-h-40 rounded-control border border-border-subtle bg-surface-sunken p-4">
          {body.trim() ? (
            <Markdown>{body}</Markdown>
          ) : (
            <p className="text-sm text-fg-subtle">Пусто</p>
          )}
        </div>
      ) : (
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder="Ответ в markdown…"
        />
      )}

      {dirty && (
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setBody(answer.body);
              setIsPrimary(answer.isPrimary);
            }}
          >
            Отменить
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={updateAnswer.isPending || !body.trim()}
            onClick={() =>
              updateAnswer.mutate({
                id: answer.id,
                input: { body, isPrimary, sortOrder: answer.sortOrder },
              })
            }
          >
            Сохранить ответ
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить ответ?"
        description="Текст ответа будет удалён безвозвратно."
        pending={deleteAnswer.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          deleteAnswer.mutate(answer.id, {
            onSuccess: onDeleted,
            onSettled: () => setConfirmDelete(false),
          })
        }
      />
    </div>
  );
}

export default function QuestionEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const question = useAdminQuestion(id);
  const categories = useCategories();
  const levels = useLevels();
  const companies = useCompanies();
  const tags = useAdminTags();

  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();
  const addAnswer = useAddAnswer();

  const [companyLinks, setCompanyLinks] = useState<CompanyLink[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [bodyPreview, setBodyPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
    // Три параметра: вход схемы (строки из <select>), контекст, выход после
    // transform (числа). Без третьего handleSubmit отдал бы входной тип.
  } = useForm<QuestionForm, unknown, QuestionFormOut>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      title: "",
      body: "",
      slug: "",
      categoryId: "",
      levelId: "",
      difficulty: 3,
      status: QuestionStatus.Draft,
      isFeatured: false,
    },
  });

  // Заполняем форму, когда данные вопроса приехали.
  useEffect(() => {
    if (!question.data) return;
    const q = question.data;

    reset({
      title: q.title,
      body: q.body ?? "",
      slug: "", // намеренно пустой: пустой slug на PUT означает «не менять»
      categoryId: q.category.id,
      levelId: q.level.id,
      difficulty: q.difficulty,
      status: q.status,
      isFeatured: q.isFeatured,
    });

    setCompanyLinks(
      q.companies.map((c) => ({
        companyId: c.id,
        askedYear: c.askedYear ? String(c.askedYear) : "",
        round: c.round ? String(c.round) : "",
      })),
    );
    setTagIds(q.tags.map((t) => t.id));
  }, [question.data, reset]);

  const bodyValue = watch("body") ?? "";

  function buildInput(form: QuestionFormOut) {
    return {
      title: form.title,
      body: form.body?.trim() ? form.body : null,
      slug: form.slug?.trim() ? form.slug : null,
      categoryId: form.categoryId,
      levelId: form.levelId,
      difficulty: form.difficulty,
      status: form.status as QuestionStatus,
      isFeatured: form.isFeatured,
      companies: companyLinks
        .filter((c) => c.companyId)
        .map((c) => ({
          companyId: c.companyId,
          askedYear: c.askedYear ? Number(c.askedYear) : null,
          round: c.round ? (Number(c.round) as InterviewRound) : null,
        })),
      tagIds,
    };
  }

  const onSubmit = handleSubmit((form) => {
    const input = buildInput(form);

    if (isNew) {
      createQuestion.mutate(input, {
        // После создания уходим в режим правки: там доступны ответы,
        // которых у несозданного вопроса быть не может.
        onSuccess: (created) => navigate(`/admin/questions/${created.id}`, { replace: true }),
      });
    } else {
      updateQuestion.mutate({ id: id!, input });
    }
  });

  const saving = createQuestion.isPending || updateQuestion.isPending;
  const loading = !isNew && question.isLoading;

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/admin/questions"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft size={15} /> К списку
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isNew ? "Новый вопрос" : "Редактирование вопроса"}
        </h1>
        <div className="flex gap-2">
          {!isNew && question.data && (
            <>
              <Link to={`/questions/${question.data.slug}`} target="_blank">
                <Button variant="ghost" size="sm">
                  Открыть на сайте
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} />
              </Button>
            </>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="rounded-card border border-border-subtle bg-surface p-5">
          <div className="flex flex-col gap-4">
            <Field label="Заголовок" required error={errors.title?.message}>
              <Input {...register("title")} invalid={!!errors.title} placeholder="Текст вопроса" />
            </Field>

            <Field
              label="Slug"
              hint={
                isNew
                  ? "Пусто — сгенерируется из заголовка (кириллица транслитерируется)"
                  : "Пусто — оставить прежним. Менять стоит с осторожностью: ссылка уже могла разойтись"
              }
              error={errors.slug?.message}
            >
              <Input {...register("slug")} placeholder="chto-takoe-indeksy" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Категория" required error={errors.categoryId?.message}>
                <Select {...register("categoryId")} invalid={!!errors.categoryId}>
                  <option value="">— выберите —</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Грейд" required error={errors.levelId?.message}>
                <Select {...register("levelId")} invalid={!!errors.levelId}>
                  <option value="">— выберите —</option>
                  {levels.data?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Сложность" error={errors.difficulty?.message}>
                <Select {...register("difficulty")}>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Статус">
                <Select {...register("status")}>
                  <option value={QuestionStatus.Draft}>Черновик</option>
                  <option value={QuestionStatus.Published}>Опубликован</option>
                  <option value={QuestionStatus.Archived}>Архив</option>
                </Select>
              </Field>
            </div>

            <Controller
              control={control}
              name="isFeatured"
              render={({ field }) => (
                <Checkbox
                  label="Показывать в избранном"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              )}
            />
          </div>
        </div>

        {/* Постановка вопроса — необязательна, часто хватает заголовка. */}
        <div className="rounded-card border border-border-subtle bg-surface p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-medium">Постановка (markdown)</h2>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setBodyPreview((v) => !v)}
              aria-pressed={bodyPreview}
            >
              {bodyPreview ? <Pencil size={14} /> : <Eye size={14} />}
              {bodyPreview ? "Править" : "Превью"}
            </Button>
          </div>

          {bodyPreview ? (
            <div className="min-h-32 rounded-control border border-border-subtle bg-surface-sunken p-4">
              {bodyValue.trim() ? (
                <Markdown>{bodyValue}</Markdown>
              ) : (
                <p className="text-sm text-fg-subtle">Пусто</p>
              )}
            </div>
          ) : (
            <Textarea {...register("body")} rows={8} placeholder="Развёрнутая постановка…" />
          )}
        </div>

        <CompanyLinksEditor
          links={companyLinks}
          companies={companies.data ?? []}
          onChange={setCompanyLinks}
        />

        <TagsEditor tags={tags.data ?? []} selected={tagIds} onChange={setTagIds} />

        <div className="flex flex-wrap justify-end gap-2">
          <Link to="/admin/questions">
            <Button type="button" variant="secondary">
              Отмена
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Сохраняем…" : isNew ? "Создать вопрос" : "Сохранить"}
          </Button>
        </div>
      </form>

      {/* Ответы живут отдельно от формы вопроса: у них свои эндпоинты,
          и добавить их можно только к уже созданному вопросу. */}
      {!isNew && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Ответы {question.data ? `(${question.data.answers.length})` : ""}
            </h2>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={addAnswer.isPending}
              onClick={() =>
                addAnswer.mutate({
                  questionId: id!,
                  input: {
                    body: "Новый ответ",
                    // Первый ответ сразу основной — иначе вопрос откроется
                    // без раскрытого разбора.
                    isPrimary: (question.data?.answers.length ?? 0) === 0,
                    sortOrder: question.data?.answers.length ?? 0,
                  },
                })
              }
            >
              <Plus size={14} /> Добавить ответ
            </Button>
          </div>

          {question.data?.answers.length === 0 ? (
            <p className="rounded-card border border-dashed border-border-subtle p-6 text-center
                          text-sm text-fg-muted">
              Ответов пока нет. Вопрос без ответа публиковать рано.
            </p>
          ) : (
            question.data?.answers.map((a) => (
              <AnswerEditor key={a.id} answer={a} onDeleted={() => void question.refetch()} />
            ))
          )}
        </section>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить вопрос?"
        description={`«${question.data?.title}» и все его ответы будут удалены безвозвратно.`}
        pending={deleteQuestion.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          deleteQuestion.mutate(id!, {
            onSuccess: () => navigate("/admin/questions", { replace: true }),
            onSettled: () => setConfirmDelete(false),
          })
        }
      />
    </div>
  );
}

/** Привязки к компаниям: год и этап — то, ради чего ищут вопросы по компании. */
function CompanyLinksEditor({
  links,
  companies,
  onChange,
}: {
  links: CompanyLink[];
  companies: { id: string; name: string; logoUrl: string | null; color: string | null }[];
  onChange: (links: CompanyLink[]) => void;
}) {
  const used = new Set(links.map((l) => l.companyId));

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-medium">Компании</h2>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onChange([...links, { companyId: "", askedYear: "", round: "" }])}
        >
          <Plus size={14} /> Добавить
        </Button>
      </div>

      {links.length === 0 ? (
        <p className="text-sm text-fg-subtle">Не привязан ни к одной компании.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {links.map((link, i) => {
            const company = companies.find((c) => c.id === link.companyId);
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                {company && <CompanyLogo company={company} className="size-8" />}

                <Select
                  value={link.companyId}
                  onChange={(e) => {
                    const next = [...links];
                    next[i] = { ...link, companyId: e.target.value };
                    onChange(next);
                  }}
                  aria-label="Компания"
                  className="min-w-40 flex-1"
                >
                  <option value="">— компания —</option>
                  {companies.map((c) => (
                    // Уже привязанные прячем: составной ключ не переживёт дубля.
                    <option key={c.id} value={c.id} disabled={used.has(c.id) && c.id !== link.companyId}>
                      {c.name}
                    </option>
                  ))}
                </Select>

                <Input
                  type="number"
                  value={link.askedYear}
                  onChange={(e) => {
                    const next = [...links];
                    next[i] = { ...link, askedYear: e.target.value };
                    onChange(next);
                  }}
                  placeholder="Год"
                  aria-label="Год"
                  min={1990}
                  max={2100}
                  className="w-24"
                />

                <Select
                  value={link.round}
                  onChange={(e) => {
                    const next = [...links];
                    next[i] = { ...link, round: e.target.value };
                    onChange(next);
                  }}
                  aria-label="Этап"
                  className="w-40"
                >
                  {ROUND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>

                <button
                  type="button"
                  onClick={() => onChange(links.filter((_, j) => j !== i))}
                  aria-label="Убрать компанию"
                  className="rounded p-2 text-fg-subtle transition-colors hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TagsEditor({
  tags,
  selected,
  onChange,
}: {
  tags: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="rounded-card border border-border-subtle bg-surface p-5">
      <h2 className="mb-3 font-medium">Теги</h2>

      {tags.length === 0 ? (
        <p className="text-sm text-fg-subtle">
          Тегов нет — создайте их в{" "}
          <Link to="/admin/references" className="text-accent hover:underline">
            справочниках
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const active = selected.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  onChange(active ? selected.filter((x) => x !== t.id) : [...selected, t.id])
                }
                aria-pressed={active}
                className={cn(
                  "rounded-pill border px-3 py-1 text-xs transition-colors",
                  active
                    ? "border-transparent gradient-brand font-medium text-white"
                    : "border-border-subtle text-fg-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
