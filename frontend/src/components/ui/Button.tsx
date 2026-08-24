import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "gradient-brand text-white shadow-sm hover:brightness-110 active:brightness-95",
  secondary:
    "bg-surface-raised text-fg border border-border-subtle hover:border-border-strong hover:bg-surface-sunken",
  ghost: "text-fg-muted hover:bg-surface-sunken hover:text-fg",
  danger: "bg-danger text-white hover:brightness-110 active:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-control font-medium",
        "transition-[filter,background-color,border-color,color] duration-150",
        // disabled на кнопке-ссылке легко забыть — курсор подсказывает состояние.
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
