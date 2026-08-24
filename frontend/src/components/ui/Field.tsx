import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";

/** Базовые классы полей ввода — держим в одном месте, а не копируем по формам. */
const controlClass =
  "w-full rounded-control border border-border-subtle bg-surface-sunken px-3 text-sm text-fg " +
  "placeholder:text-fg-subtle transition-colors focus:border-accent focus:outline-none " +
  "disabled:opacity-50";

interface FieldProps {
  label: string;
  /** Текст ошибки валидации; подсвечивает поле и объявляется скринридеру. */
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, error, hint, required, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : (
        hint && <span className="text-xs text-fg-subtle">{hint}</span>
      )}
    </label>
  );
}

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(controlClass, "h-10", invalid && "border-danger", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(controlClass, "resize-y py-2 font-mono", invalid && "border-danger", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cn(controlClass, "h-10", invalid && "border-danger", className)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

/** Чекбокс с подписью: выравнивание и hit-area в одном месте. */
export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className={cn("size-4 accent-[var(--ih-accent)]", className)}
        {...props}
      />
      {label}
    </label>
  );
}
