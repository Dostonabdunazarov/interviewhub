import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BookOpen,
  ExternalLink,
  FileQuestion,
  LayoutDashboard,
  LogOut,
  Tags,
  Users,
} from "lucide-react";
import { logout } from "../lib/api";
import { isAdmin, useAuthStore } from "../store/authStore";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "../lib/utils";

const NAV = [
  { to: "/admin", label: "Дашборд", icon: LayoutDashboard, end: true },
  { to: "/admin/questions", label: "Вопросы", icon: FileQuestion, end: false },
  { to: "/admin/theory", label: "Теория", icon: BookOpen, end: false },
  { to: "/admin/references", label: "Справочники", icon: Tags, end: false },
];

/** Раздел пользователей виден только Admin — Editor туда всё равно получит 403. */
const ADMIN_ONLY = { to: "/admin/users", label: "Пользователи", icon: Users, end: false };

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const items = isAdmin(user) ? [...NAV, ADMIN_ONLY] : NAV;

  async function onLogout() {
    await logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-(--size-header) max-w-content items-center gap-4 px-page-x">
          <Link to="/admin" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-control gradient-brand text-white">
              IH
            </span>
            <span className="text-base">Админка</span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-fg-muted sm:inline">{user?.displayName}</span>

            {/*
              Возврат на публичную часть. Обычный Link, а не <a>: сессия
              сохраняется, и вернуться в админку можно по /admin без
              повторного входа. Отдельная кнопка нужна потому, что логотип
              здесь ведёт на дашборд, а не на сайт.
            */}
            <Link
              to="/"
              title="Открыть сайт"
              className="inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5
                         text-sm text-fg-muted transition-colors
                         hover:bg-surface-sunken hover:text-fg"
            >
              <ExternalLink size={16} />
              <span className="hidden sm:inline">На сайт</span>
            </Link>

            <ThemeToggle />
            <button
              type="button"
              onClick={onLogout}
              aria-label="Выйти"
              title="Выйти"
              className="inline-flex size-9 items-center justify-center rounded-control
                         text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-content flex-1 gap-6 px-page-x py-6">
        {/* На мобильном сайдбар превращается в горизонтальную ленту вкладок:
            drawer ради четырёх ссылок избыточен. */}
        <nav
          className="flex shrink-0 gap-1 max-md:w-full max-md:overflow-x-auto
                     md:w-52 md:flex-col"
        >
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-control px-3 py-2",
                  "text-sm transition-colors",
                  isActive
                    ? "bg-surface-sunken font-medium text-fg"
                    : "text-fg-muted hover:text-fg",
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
