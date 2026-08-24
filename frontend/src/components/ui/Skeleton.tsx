import { cn } from "../../lib/utils";

/** Скелетон вместо спиннера — планом предписано именно так. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-control", className)} aria-hidden="true" />;
}

/** Готовый скелетон карточки вопроса — используется в каталоге и на главной. */
export function QuestionCardSkeleton() {
  return (
    <div className="rounded-card border border-border-subtle bg-surface p-5">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-16 rounded-pill" />
        <Skeleton className="h-5 w-20 rounded-pill" />
      </div>
    </div>
  );
}
