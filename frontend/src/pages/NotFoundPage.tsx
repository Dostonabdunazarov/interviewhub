import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Meta } from "../components/Meta";

export default function NotFoundPage() {
  return (
    <div className="mx-auto grid max-w-content place-items-center px-page-x py-section-y text-center">
      {/* noindex обязателен: SPA отдаёт на 404 код 200, и без него
          «Страница не найдена» индексируется как обычная страница. */}
      <Meta noIndex title="Страница не найдена" />

      <p className="gradient-text text-6xl font-bold">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Страница не найдена</h1>
      <p className="mt-3 max-w-sm text-sm text-fg-muted">
        Ссылка устарела или в адресе опечатка. Загляните в каталог — вопрос наверняка там.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/">
          <Button variant="secondary">На главную</Button>
        </Link>
        <Link to="/questions">
          <Button>В каталог</Button>
        </Link>
      </div>
    </div>
  );
}
