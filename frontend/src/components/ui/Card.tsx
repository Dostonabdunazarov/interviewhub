import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Стеклянная поверхность вместо плоской — для карточек поверх градиентов. */
  glass?: boolean;
  children?: ReactNode;
}

export function Card({ glass = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card p-5",
        glass
          ? "glass"
          : "bg-surface border border-border-subtle shadow-[var(--ih-shadow-card)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
