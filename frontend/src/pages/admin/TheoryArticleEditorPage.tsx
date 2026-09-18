import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  useAdminTheoryArticle,
  useAdminTheoryTree,
  useCreateTheoryArticle,
  useDeleteTheoryArticle,
  useUpdateTheoryArticle,
} from "../../lib/adminHooks";
import { useAdminQuestions } from "../../lib/adminHooks";
import { useLevels } from "../../lib/hooks";
import { useDebounced } from "../../lib/useDebounced";
import { Markdown } from "../../components/Markdown";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Field, Input, Select, Textarea } from "../../components/ui/Field";
import { Skeleton } from "../../components/ui/Skeleton";
import { DifficultyDots } from "../../components/ui/DifficultyDots";
import { TheoryStatus, type TheoryRelatedQuestion } from "../../types/api";

/** Пустая строка из формы должна уехать как null, а не как "". */
const orNull = (v: string) => (v.trim() ? v.trim() : null);

interface ArticleForm {
  title: string;
  slug: string;
  summary: string;
  body: string;
  sortOrder: string;
  status: number;
  sectionId: string;
  levelId: string;
}

const EMPTY: ArticleForm = {
  title: "",
  slug: "",
  summary: "",
  body: "",
  sortOrder: "0",
  status: TheoryStatus.Draft,
  sectionId: "",
  levelId: "",
};

/**
 * Привязка вопросов к статье — блок «Проверь себя» и обратная ссылка
 * со страницы вопроса.
 *
 * Только ручной поиск: автоматическая привязка по тегам дала бы мусорные
 * связи («GC» подтянул бы всё про память), а разгребать их дороже, чем
 * проставить десяток ссылок руками.
 */
function QuestionPicker({
  selected,
  onChange,
}: {
  selected: TheoryRelatedQuestion[];
  onChange: (next: TheoryRelatedQuestion[]) => void;
}) {
  const [input, setInput] = useState("");
  const debounced = useDebounced(input, 300);

  // Ищем только по непустому запросу: список всех 734 вопросов в выпадашке
  // бесполезен, выбирать в нём нечего. Пустой запрос до сервера не доходит —
  // pageSize здесь не поможет, QuestionQuery поднимает 0 обратно до 20.
  const term = debounced.trim();
  const { data, isFetching } = useAdminQuestions({ q: term, pageSize: 10 }, Boolean(term));

  const chosen = new Set(selected.map((q) => q.id));
  const results = term ? (data?.items ?? []) : [];

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-5">
      <h2 className="font-medium">Проверь себя</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Вопросы каталога, которые проверяют эту статью. Порядок в списке —
        порядок на странице.
      </p>

      {selected.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {selected.map((q, i) => (
            <li
              key={q.id}
              className="flex items-center gap-3 rounded-control border border-border-subtle
                         bg-surface-sunken px-3 py-2"
            >
              <span className="w-5 shrink-0 text-xs tabular-nums text-fg-subtle">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{q.title}</span>
              <DifficultyDots value={q.difficulty} />
              <Badge color={q.level.color}>{q.level.name}</Badge>
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x.id !== q.id))}
                aria-label={`Убрать «${q.title}»`}
                className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:text-danger"
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative mt-4">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
        />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Найти вопрос по заголовку или ответу…"
          className="pl-9"
        />
      </div>

      {debounced.trim() && (
        <div className="mt-2">
          {isFetching ? (
            <Skeleton className="h-10" />
          ) : results.length === 0 ? (
            <p className="px-1 py-2 text-sm text-fg-subtle">Ничего не найдено.</p>
          ) : (
            <ul className="flex flex-col">
              {results.map((q) => {
                const already = chosen.has(q.id);

                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() =>
                        onChange([
                          ...selected,
                          {
                            id: q.id,
                            slug: q.slug,
                            title: q.title,
                            difficulty: q.difficulty,
                            level: q.level,
                          },
                        ])
                      }
                      className="flex w-full items-center gap-3 rounded-control px-3 py-2
                                 text-left transition-colors hover:bg-surface-sunken
                                 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <Plus size={14} className="shrink-0 text-fg-subtle" />
                      <span className="min-w-0 flex-1 truncate text-sm">{q.title}</span>
                      <Badge color={q.level.color}>{q.level.name}</Badge>
                      {already && <span className="shrink-0 text-xs text-fg-subtle">добавлен</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function TheoryArticleEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const article = useAdminTheoryArticle(id);
  const tree = useAdminTheoryTree();
  const levels = useLevels();

  const createArticle = useCreateTheoryArticle();
  const updateArticle = useUpdateTheoryArticle();
  const deleteArticle = useDeleteTheoryArticle();

  const [form, setForm] = useState<ArticleForm>(EMPTY);
  const [questions, setQuestions] = useState<TheoryRelatedQuestion[]>([]);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Плоский список разделов для <select>: два уровня в выпадашке не выразить,
  // поэтому трек уходит в подпись через optgroup.
  const tracks = tree.data ?? [];

  // Раздел из query — переход «новая статья» прямо из дерева.
  const presetSection = searchParams.get("sectionId") ?? "";

  useEffect(() => {
    if (isNew) {
      setForm((f) => (f.sectionId ? f : { ...EMPTY, sectionId: presetSection }));
      return;
    }

    if (!article.data) return;
    const a = article.data;

    setForm({
      title: a.title,
      // Пустой slug на PUT означает «не менять»: он уже в ссылках.
      slug: "",
      summary: a.summary ?? "",
      body: a.body,
      sortOrder: String(a.sortOrder),
      status: a.status,
      sectionId: a.sectionId,
      levelId: a.levelId ?? "",
    });
    setQuestions(a.relatedQuestions);
  }, [isNew, article.data, presetSection]);

  // Оценка времени чтения, которую посчитает бэкенд: 200 слов/мин, минимум 1.
  // Показываем, чтобы редактор видел объём, не сохраняя статью.
  const estimatedMinutes = useMemo(() => {
    const words = form.body.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }, [form.body]);

  function submit() {
    const input = {
      title: form.title,
      slug: orNull(form.slug),
      summary: orNull(form.summary),
      body: form.body,
      sortOrder: Number(form.sortOrder) || 0,
      status: form.status as TheoryStatus,
      sectionId: form.sectionId,
      levelId: form.levelId || null,
      questionIds: questions.map((q) => q.id),
    };

    if (isNew) {
      createArticle.mutate(input, {
        onSuccess: (created) =>
          navigate(`/admin/theory/articles/${created.id}`, { replace: true }),
      });
    } else {
      updateArticle.mutate({ id: id!, input });
    }
  }

  const saving = createArticle.isPending || updateArticle.isPending;

  if (!isNew && article.isLoading) {
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
        to="/admin/theory"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted
                   transition-colors hover:text-fg"
      >
        <ArrowLeft size={15} /> К дереву теории
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isNew ? "Новая статья" : "Редактирование статьи"}
        </h1>

        <div className="flex gap-2">
          {!isNew && article.data && (
            <>
              {/* Черновик на сайте отдаёт 404 — ссылка осмысленна только
                  для опубликованной статьи. */}
              {article.data.status === TheoryStatus.Published && (
                <Link to={`/theory/articles/${article.data.slug}`} target="_blank">
                  <Button variant="ghost" size="sm">
                    Открыть на сайте
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-card border border-border-subtle bg-surface p-5">
        <div className="flex flex-col gap-4">
          <Field label="Заголовок" required>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Как работает сборщик мусора"
            />
          </Field>

          <Field
            label="Slug"
            hint={
              isNew
                ? "Пусто — сгенерируется из заголовка. Глобально уникален: он и есть URL"
                : "Пусто — оставить прежним. Менять осторожно: ссылка могла разойтись"
            }
          >
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="kak-rabotaet-sborshik-musora"
            />
          </Field>

          <Field label="Анонс" hint="Идёт в карточку оглавления и в meta description">
            <Textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              rows={2}
              placeholder="Поколения, корни и что на самом деле означает «объект живой»."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Раздел" required>
              <Select
                value={form.sectionId}
                onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
              >
                <option value="">— выберите —</option>
                {tracks.map((t) => (
                  <optgroup key={t.id} label={t.name}>
                    {t.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>

            <Field label="Грейд" hint="Необязателен: «это спросят с middle»">
              <Select
                value={form.levelId}
                onChange={(e) => setForm({ ...form, levelId: e.target.value })}
              >
                <option value="">— без грейда —</option>
                {levels.data?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Порядок в разделе" hint="Статьи раздела читают подряд">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                min={0}
              />
            </Field>

            <Field label="Статус">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: Number(e.target.value) })}
              >
                <option value={TheoryStatus.Draft}>Черновик</option>
                <option value={TheoryStatus.Published}>Опубликована</option>
                <option value={TheoryStatus.Archived}>Архив</option>
              </Select>
            </Field>
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border-subtle bg-surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Текст статьи (markdown)</h2>

          <div className="flex items-center gap-3">
            {/* Время чтения считает бэкенд, но видеть объём нужно до сохранения. */}
            <span className="text-xs text-fg-subtle">≈ {estimatedMinutes} мин чтения</span>
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
          </div>
        </div>

        {preview ? (
          <div className="min-h-80 rounded-control border border-border-subtle
                          bg-surface-sunken p-5">
            {form.body.trim() ? (
              <Markdown>{form.body}</Markdown>
            ) : (
              <p className="text-sm text-fg-subtle">Пусто</p>
            )}
          </div>
        ) : (
          <Textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={24}
            placeholder="## Заголовок раздела&#10;&#10;Текст статьи…"
            className="font-mono text-[13px]"
          />
        )}
      </div>

      <QuestionPicker selected={questions} onChange={setQuestions} />

      <div className="flex flex-wrap justify-end gap-2">
        <Link to="/admin/theory">
          <Button type="button" variant="secondary">
            Отмена
          </Button>
        </Link>
        <Button
          onClick={submit}
          disabled={saving || !form.title.trim() || !form.body.trim() || !form.sectionId}
        >
          {saving ? "Сохраняем…" : isNew ? "Создать статью" : "Сохранить"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить статью?"
        description={`«${article.data?.title}» будет удалена безвозвратно вместе с привязками к вопросам.`}
        pending={deleteArticle.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          deleteArticle.mutate(id!, {
            onSuccess: () => navigate("/admin/theory", { replace: true }),
            onSettled: () => setConfirmDelete(false),
          })
        }
      />
    </div>
  );
}
