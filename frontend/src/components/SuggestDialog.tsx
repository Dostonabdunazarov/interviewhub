import { useState, type FormEvent } from "react";
import { CheckCircle2, MessageSquarePlus } from "lucide-react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Field, Input, Select, Textarea } from "./ui/Field";
import { useSubmitSuggestion } from "../lib/engagementHooks";
import { apiErrorMessage } from "../lib/api";
import { SuggestionKind, type SuggestionTargetType } from "../types/api";
import { cn } from "../lib/utils";

interface Target {
  type: SuggestionTargetType;
  slug: string;
  title: string;
}

interface FormState {
  text: string;
  answerDraft: string;
  category: string;
  level: string;
  company: string;
  round: string;
  contact: string;
  website: string;
}

const EMPTY: FormState = {
  text: "",
  answerDraft: "",
  category: "",
  level: "",
  company: "",
  round: "",
  contact: "",
  website: "",
};

const ROUNDS = ["Скрининг", "Техническая секция", "System Design", "Финал"];

const orNull = (v: string) => (v.trim() ? v.trim() : null);

function SuggestForm({
  kind,
  target,
  onDone,
}: {
  kind: SuggestionKind;
  target?: Target;
  onDone: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sent, setSent] = useState(false);
  const submit = useSubmitSuggestion();
  const isCorrection = kind === SuggestionKind.Correction;

  const set = (key: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit.mutate(
      {
        kind,
        text: form.text.trim(),
        answerDraft: orNull(form.answerDraft),
        category: isCorrection ? null : orNull(form.category),
        level: isCorrection ? null : orNull(form.level),
        company: isCorrection ? null : orNull(form.company),
        round: isCorrection ? null : orNull(form.round),
        contact: orNull(form.contact),
        targetType: target?.type ?? null,
        targetSlug: target?.slug ?? null,
        website: form.website,
      },
      { onSuccess: () => setSent(true) },
    );
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 size={36} className="text-success" />
        <p className="font-medium">Спасибо, получили!</p>
        <p className="max-w-sm text-sm text-fg-muted">
          {isCorrection
            ? "Проверим правку и обновим материал."
            : "Разберём вопрос и добавим его в базу."}
        </p>
        <Button variant="secondary" onClick={onDone}>
          Закрыть
        </Button>
      </div>
    );
  }

  const tooShort = form.text.trim().length < 10;
  const error = submit.isError
    ? submit.error && (submit.error as { response?: { status?: number } }).response?.status === 429
      ? "Слишком много отправок. Попробуйте через несколько минут."
      : apiErrorMessage(submit.error)
    : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {target && (
        <p className="rounded-control border border-border-subtle bg-surface-sunken px-3 py-2 text-sm">
          <span className="text-fg-muted">Правка к: </span>
          {target.title}
        </p>
      )}

      <Field
        label={isCorrection ? "Что не так" : "Вопрос"}
        hint={
          isCorrection
            ? "Что неточно или устарело и как правильно"
            : "В той формулировке, в которой его задали"
        }
        required
      >
        <Textarea
          rows={isCorrection ? 5 : 3}
          value={form.text}
          onChange={(e) => set("text")(e.target.value)}
          maxLength={5000}
          className="font-sans"
          required
        />
      </Field>

      {!isCorrection && (
        <>
          <Field label="Ответ или тезисы" hint="Необязательно — разберём и оформим сами">
            <Textarea
              rows={4}
              value={form.answerDraft}
              onChange={(e) => set("answerDraft")(e.target.value)}
              maxLength={20000}
              className="font-sans"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Направление">
              <Input
                value={form.category}
                onChange={(e) => set("category")(e.target.value)}
                placeholder="PostgreSQL, Kafka…"
                maxLength={128}
              />
            </Field>
            <Field label="Грейд">
              <Select value={form.level} onChange={(e) => set("level")(e.target.value)}>
                <option value="">Не знаю</option>
                <option>Intern</option>
                <option>Junior</option>
                <option>Middle</option>
                <option>Senior</option>
                <option>Lead</option>
              </Select>
            </Field>
            <Field label="Компания">
              <Input
                value={form.company}
                onChange={(e) => set("company")(e.target.value)}
                maxLength={128}
              />
            </Field>
            <Field label="Этап">
              <Select value={form.round} onChange={(e) => set("round")(e.target.value)}>
                <option value="">Не помню</option>
                {ROUNDS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
          </div>
        </>
      )}

      <Field label="Как с вами связаться" hint="Необязательно: email или Telegram, если хотите в благодарности">
        <Input
          value={form.contact}
          onChange={(e) => set("contact")(e.target.value)}
          maxLength={256}
        />
      </Field>

      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={form.website}
        onChange={(e) => set("website")(e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Отмена
        </Button>
        <Button type="submit" disabled={tooShort || submit.isPending}>
          {submit.isPending ? "Отправляем…" : "Отправить"}
        </Button>
      </div>
    </form>
  );
}

export function SuggestButton({
  kind = SuggestionKind.NewQuestion,
  target,
  label,
  variant = "secondary",
  className,
}: {
  kind?: SuggestionKind;
  target?: Target;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const isCorrection = kind === SuggestionKind.Correction;

  const close = () => setOpen(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={cn(className)}
        onClick={() => {
          setSession((s) => s + 1);
          setOpen(true);
        }}
      >
        <MessageSquarePlus size={15} />
        {label ?? (isCorrection ? "Предложить правку" : "Предложить вопрос")}
      </Button>

      <Modal
        open={open}
        onClose={close}
        title={isCorrection ? "Предложить правку" : "Предложить вопрос"}
        size="lg"
      >
        <SuggestForm key={session} kind={kind} target={target} onDone={close} />
      </Modal>
    </>
  );
}
