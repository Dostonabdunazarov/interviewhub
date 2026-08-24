import { create } from "zustand";
import type { AuthUser } from "../types/api";
import { UserRole } from "../types/api";

const REFRESH_KEY = "ih-refresh";

/**
 * Refresh-токен переживает перезагрузку, поэтому лежит в localStorage:
 * API отдаёт его в теле ответа, httpOnly cookie бэкенд не ставит.
 * Access-токен держим только в памяти — он живёт 15 минут и восстанавливается
 * по refresh, так что писать его на диск незачем.
 *
 * Приватный режим и заблокированные куки роняют доступ к localStorage
 * исключением, поэтому все обращения обёрнуты.
 */
function readRefresh(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function writeRefresh(token: string | null): void {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* сессия проживёт до перезагрузки — это лучше, чем падение приложения */
  }
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** false, пока не завершилась стартовая попытка восстановить сессию. */
  initialized: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setInitialized: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: readRefresh(),
  initialized: false,

  setAuth: (user, accessToken, refreshToken) => {
    writeRefresh(refreshToken);
    set({ user, accessToken, refreshToken });
  },

  setInitialized: () => set({ initialized: true }),

  clear: () => {
    writeRefresh(null);
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));

export const isAdmin = (user: AuthUser | null) => user?.role === UserRole.Admin;

/** Editor тоже правит контент, поэтому проверка «может ли редактировать» — не про Admin. */
export const canEditContent = (user: AuthUser | null) =>
  user?.role === UserRole.Admin || user?.role === UserRole.Editor;
