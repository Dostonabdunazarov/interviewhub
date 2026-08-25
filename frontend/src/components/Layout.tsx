import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogIn, Menu, Search, Settings, X } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { TechBackdrop } from "./TechBackdrop";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "../lib/utils";

const NAV = [
  { to: "/questions", label: "Вопросы" },
  { to: "/theory", label: "Теория" },
  { to: "/levels", label: "Грейды" },
  { to: "/companies", label: "Компании" },
  { to: "/about", label: "О проекте" },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-8 place-items-center rounded-control gradient-brand text-white">
        IH
      </span>
      <span className="text-base">InterviewHub</span>
    </Link>
  );
}

/** Поиск ведёт в каталог: результаты живут там, отдельной страницы поиска нет. */
function SearchBox({ onSubmitted }: { onSubmitted?: () => void }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        navigate(q ? `/questions?q=${encodeURIComponent(q)}` : "/questions");
        onSubmitted?.();
      }}
      className="relative w-full"
      role="search"
    >
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Поиск по вопросам…"
        aria-label="Поиск по вопросам"
        className="h-9 w-full rounded-control border border-border-subtle bg-surface-sunken
                   pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle
                   transition-colors focus:border-accent focus:outline-none"
      />
    </form>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  // Переход по ссылке в мобильном меню должен его закрывать —
  // иначе на новой странице поверх контента висит открытая панель.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-(--size-header) max-w-content items-center gap-4 px-page-x">
        <Logo />

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-control px-3 py-1.5 text-sm transition-colors",
                  isActive ? "bg-surface-sunken text-fg" : "text-fg-muted hover:text-fg",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden w-64 lg:block">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          {/*
            Одно место, две роли: вошедшему — возврат в админку, гостю — вход.
            Кнопки взаимоисключающие, поэтому занимают одну позицию и не
            двигают остальные элементы хедера при входе и выходе.
          */}
          <Link
            to={user ? "/admin" : "/admin/login"}
            title={user ? "Админка" : "Войти"}
            className="inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5
                       text-sm text-fg-muted transition-colors
                       hover:bg-surface-sunken hover:text-fg"
          >
            {user ? <Settings size={16} /> : <LogIn size={16} />}
            <span className="hidden sm:inline">{user ? "Админка" : "Войти"}</span>
          </Link>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={menuOpen}
            className="inline-flex size-9 items-center justify-center rounded-control
                       text-fg-muted hover:bg-surface-sunken hover:text-fg md:hidden"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-border-subtle bg-canvas px-page-x py-4 md:hidden">
          <SearchBox onSubmitted={() => setMenuOpen(false)} />
          <nav className="mt-3 flex flex-col">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-control px-3 py-2.5 text-sm transition-colors",
                    isActive ? "bg-surface-sunken text-fg" : "text-fg-muted hover:text-fg",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-border-subtle">
      <div
        className="mx-auto flex max-w-content flex-col gap-2 px-page-x py-8
                   text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between"
      >
        <p>© {new Date().getFullYear()} InterviewHub — подготовка к собеседованиям</p>
        <Link to="/about" className="transition-colors hover:text-fg">
          О проекте
        </Link>
      </div>
    </footer>
  );
}

export function Layout() {
  return (
    <>
      {/* Фон живёт вне потока (position:fixed) и потому вынесен из колонки. */}
      <TechBackdrop />

      {/*
        Контент поднят над фоном: у .tech-backdrop z-index 0, а `relative`
        здесь нужен, чтобы z-10 вообще применился — без позиционирования
        z-index игнорируется.
      */}
      <div className="relative z-10 flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </>
  );
}
