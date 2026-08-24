import { create } from "zustand";

const THEME_KEY = "ih-theme";

export type Theme = "light" | "dark";

/**
 * Тёмная тема по умолчанию — так задумано планом, поэтому системная
 * настройка не читается: пользователь либо принимает тёмную, либо
 * переключается сам, и его выбор запоминается.
 *
 * Ключ и значения совпадают с инлайн-скриптом в index.html, который
 * применяет тему до первой отрисовки. При переименовании — править оба места.
 */
function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* тема продержится до перезагрузки */
  }
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readTheme(),

  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ theme: next });
  },

  set: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
