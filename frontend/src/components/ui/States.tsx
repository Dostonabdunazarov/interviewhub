import type { ReactNode } from "react";
import { Inbox, WifiOff } from "lucide-react";
import { Button } from "./Button";

/** Пустой результат — не ошибка, поэтому тон нейтральный. */
export function EmptyState({
  title = "Ничего не найдено",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-card border border-dashed border-border-subtle
                    px-6 py-16 text-center">
      <Inbox size={28} className="text-fg-subtle" />
      <p className="mt-4 font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Ошибка загрузки. Причину не показываем — пользователю она ничего не даёт,
 * а вот кнопка «повторить» решает самый частый случай (пропала сеть).
 */
export function ErrorState({
  title = "Не удалось загрузить",
  description = "Проверьте соединение и попробуйте ещё раз.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="grid place-items-center rounded-card border border-dashed border-border-subtle
                    px-6 py-16 text-center">
      <WifiOff size={28} className="text-danger" />
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}
