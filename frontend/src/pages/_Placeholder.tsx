import type { ReactNode } from "react";

/**
 * Общая заглушка страницы. Каркас шага 7 проверяет роутинг и layout;
 * содержимое приходит в шагах 8 (публичные) и 9 (админка).
 */
export function Placeholder({
  title,
  step,
  children,
}: {
  title: string;
  step: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-content px-page-x py-section-y">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-fg-muted">Наполняется в {step}.</p>
      {children}
    </div>
  );
}
