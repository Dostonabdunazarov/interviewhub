import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

// Omit<'color'>: у span есть собственный устаревший HTML-атрибут color (string),
// а из API цвет приходит nullable — без Omit типы конфликтуют.
interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "color"> {
  /**
   * Цвет из БД (Levels.Color, Categories.Color) — планом запрещено хардкодить
   * цвета грейдов. Заливка и рамка выводятся из него через color-mix,
   * поэтому достаточно передать один HEX.
   */
  color?: string | null;
  children?: ReactNode;
}

export function Badge({ color, className, children, style, ...props }: BadgeProps) {
  const colored = color
    ? {
        color,
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        borderColor: `color-mix(in oklab, ${color} 32%, transparent)`,
      }
    : undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5",
        "text-xs font-medium whitespace-nowrap",
        !color && "border-border-subtle bg-surface-sunken text-fg-muted",
        className,
      )}
      style={{ ...colored, ...style }}
      {...props}
    >
      {children}
    </span>
  );
}
