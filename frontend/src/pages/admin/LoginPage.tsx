import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { apiErrorMessage, login } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { TechBackdrop } from "../../components/TechBackdrop";

/**
 * Вход в админку. Публичной регистрации нет — аккаунты заводит админ,
 * поэтому здесь нет ни ссылки «зарегистрироваться», ни восстановления пароля.
 *
 * Форма на useState, без react-hook-form: два поля не окупают зависимость.
 * В шаге 9, где появятся большие формы редактора, её стоит подключить.
 */
export default function LoginPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Уже вошли — возвращаем туда, откуда пришли (ProtectedRoute кладёт это в state).
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? "/admin";
  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      // Бэкенд намеренно отвечает одинаково на неверный пароль и неактивный
      // аккаунт — не раскрываем, какой из случаев произошёл.
      setError(apiErrorMessage(err, "Неверный email или пароль."));
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "h-10 w-full rounded-control border border-border-subtle bg-surface-sunken px-3 " +
    "text-sm text-fg placeholder:text-fg-subtle transition-colors " +
    "focus:border-accent focus:outline-none";

  return (
    <div className="relative grid min-h-dvh place-items-center px-page-x">
      {/* Страница не обёрнута в Layout, поэтому фон подключаем напрямую. */}
      <TechBackdrop />

      {/* Свечение — как на главной: связывает вход с остальным сайтом. */}
      <div
        className="glow-brand pointer-events-none fixed inset-x-0 top-0 h-96"
        aria-hidden="true"
      />

      {/* z-10 поднимает карточку над фоном: у .tech-backdrop z-index 0. */}
      <Card className="relative z-10 w-full max-w-sm" glass>
        <h1 className="text-xl font-semibold tracking-tight">Вход в админку</h1>
        <p className="mt-1 text-sm text-fg-muted">Доступ только для редакторов и админов.</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              autoFocus
              placeholder="admin@interview.hypex.site"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="mt-1">
            {pending ? "Входим…" : "Войти"}
          </Button>
        </form>

        {/* Без этой ссылки страница логина — тупик: хедера здесь нет,
            а пароль знают не все, кто сюда попал. */}
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-1.5 text-sm text-fg-muted
                     transition-colors hover:text-fg"
        >
          <ArrowLeft size={15} /> На сайт
        </Link>
      </Card>
    </div>
  );
}
