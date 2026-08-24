import { cn } from "../../lib/utils";

/**
 * Сложность 1–5 точками. Текстом дублируется для скринридеров:
 * пять кружков без подписи им ничего не говорят.
 */
export function DifficultyDots({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      title={`Сложность ${value} из 5`}
    >
      <span className="sr-only">Сложность {value} из 5</span>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-full",
            i < value ? "bg-accent" : "bg-border-strong",
          )}
        />
      ))}
    </span>
  );
}
