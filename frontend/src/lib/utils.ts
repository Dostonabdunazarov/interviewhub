import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Объединяет классы Tailwind, разрешая конфликты (последний побеждает). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Дата в человеческом виде: «24 авг. 2026». */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** Разделяет тысячи: 1234 → «1 234». Для счётчиков просмотров и статистики. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

/**
 * Буквенная заглушка вместо логотипа компании. Часть компаний в сидинге
 * намеренно без LogoUrl — фолбэк обязан работать с первого дня.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? "").join("");
}
