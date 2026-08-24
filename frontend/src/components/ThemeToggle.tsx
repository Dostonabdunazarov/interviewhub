import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "../store/themeStore";

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const nextLabel = theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={nextLabel}
      title={nextLabel}
      className="inline-flex size-9 items-center justify-center rounded-control
                 text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
