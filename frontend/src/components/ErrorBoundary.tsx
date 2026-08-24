import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Ловит ошибки рендера, чтобы упавший компонент не оставлял белый экран.
 * Классовый компонент — хуковой альтернативы для componentDidCatch нет.
 *
 * Ошибки запросов сюда не попадают: их обрабатывает TanStack Query
 * на уровне страницы.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Ошибка рендера:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-dvh place-items-center px-page-x">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium text-danger">Что-то сломалось</p>
          <h1 className="mt-2 text-2xl font-semibold">Страница не отрисовалась</h1>
          <p className="mt-3 text-sm text-fg-muted">
            Мы записали ошибку в консоль. Попробуйте перезагрузить страницу.
          </p>

          {import.meta.env.DEV && (
            <pre
              className="mt-4 overflow-x-auto rounded-control bg-surface-sunken p-3
                         text-left text-xs text-fg-muted"
            >
              {error.message}
            </pre>
          )}

          <Button className="mt-6" onClick={() => window.location.reload()}>
            Перезагрузить
          </Button>
        </div>
      </div>
    );
  }
}
