import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { UserRole } from "../types/api";

/**
 * Защита админских роутов. Пока не завершилась стартовая попытка восстановить
 * сессию, редиректить нельзя — иначе после F5 админа выбрасывает на логин
 * ещё до того, как refresh успел отработать.
 */
export function ProtectedRoute({ requireAdmin = false }: { requireAdmin?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const location = useLocation();

  if (!initialized) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-fg-muted">
        Проверяем сессию…
      </div>
    );
  }

  if (!user) {
    // Запоминаем, куда шли, чтобы после входа вернуть на то же место.
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  // Раздел пользователей доступен только Admin — то же правило, что и на бэкенде.
  if (requireAdmin && user.role !== UserRole.Admin) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}
