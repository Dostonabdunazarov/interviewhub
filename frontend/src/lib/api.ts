import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "../store/authStore";
import type { AuthResult } from "../types/api";

/**
 * HTTP-клиент. baseURL относительный: в dev запросы к /api проксируются
 * на бэкенд (см. vite.config.ts), в проде их проксирует nginx —
 * и в обоих случаях фронт не знает адреса API.
 *
 * VITE_API_URL — только для дымового рендера в Node (`smoke/render.tsx`):
 * вне браузера относительный путь разрешать не от чего.
 */
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

export const api = axios.create({ baseURL });

/** Отдельный клиент для refresh — без интерцепторов, иначе 401 зациклится. */
const plain = axios.create({ baseURL });

// ── Запрос: подставляем access-токен ─────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Ответ: авто-refresh при 401 ──────────────────────────────────────────────
type RetriableConfig = AxiosRequestConfig & { _retry?: boolean };

/** Общий промис: несколько параллельных 401 не должны слать несколько refresh. */
let refreshPromise: Promise<string | null> | null = null;

/**
 * Меняет refresh-токен на новую пару. Бэкенд ротирует токены: старый гасится,
 * поэтому ответ нужно сохранить целиком, иначе следующий refresh получит 401.
 */
async function doRefresh(): Promise<string | null> {
  const store = useAuthStore.getState();
  const refreshToken = store.refreshToken;
  if (!refreshToken) {
    store.clear();
    return null;
  }

  try {
    const { data } = await plain.post<AuthResult>("/auth/refresh", { refreshToken });
    store.setAuth(data.user, data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    store.clear();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (RetriableConfig & InternalAxiosRequestConfig) | undefined;
    const url = original?.url ?? "";

    // Сами auth-эндпоинты не рефрешим: их 401 означает «неверные данные»,
    // а не «истёк токен». Повторные попытки тоже отсекаем по _retry.
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/refresh");

    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshPromise ??= doRefresh().finally(() => {
        refreshPromise = null;
      });

      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }

    return Promise.reject(error);
  },
);

/**
 * Восстановление сессии при старте по сохранённому refresh-токену.
 * Всегда помечает стор как initialized — иначе ProtectedRoute
 * будет вечно показывать загрузку.
 */
export async function bootstrapAuth(): Promise<void> {
  const store = useAuthStore.getState();
  try {
    if (store.refreshToken) await doRefresh();
  } finally {
    useAuthStore.getState().setInitialized();
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const { data } = await plain.post<AuthResult>("/auth/login", { email, password });
  useAuthStore.getState().setAuth(data.user, data.accessToken, data.refreshToken);
  return data;
}

export async function logout(): Promise<void> {
  const { refreshToken } = useAuthStore.getState();
  try {
    if (refreshToken) await plain.post("/auth/logout", { refreshToken });
  } catch {
    /* сервер мог уже погасить токен — локально выходим в любом случае */
  } finally {
    useAuthStore.getState().clear();
  }
}

/**
 * Человекочитаемое сообщение об ошибке. Бэкенд отвечает ProblemDetails
 * (`detail`/`title`) либо ValidationProblemDetails (`errors`) —
 * разбираем оба формата, чтобы фронту не пришлось знать разницу.
 */
export function apiErrorMessage(error: unknown, fallback = "Что-то пошло не так"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: string; title?: string; errors?: Record<string, string[]> }
      | undefined;

    const firstFieldError = data?.errors && Object.values(data.errors)[0]?.[0];
    if (firstFieldError) return firstFieldError;

    return data?.detail || data?.title || error.message || fallback;
  }
  return fallback;
}
