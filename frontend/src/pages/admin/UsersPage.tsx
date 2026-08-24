import { useState } from "react";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useChangePassword,
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsers,
} from "../../lib/adminHooks";
import { useAuthStore } from "../../store/authStore";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Checkbox, Field, Input, Select } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/States";
import { formatDate } from "../../lib/utils";
import { UserRole, type AuthUser } from "../../types/api";

const ROLE_LABEL: Record<number, { text: string; color: string }> = {
  [UserRole.Editor]: { text: "Редактор", color: "#3b82f6" },
  [UserRole.Admin]: { text: "Админ", color: "#a855f7" },
};

/**
 * Требования к паролю совпадают с серверными (`PasswordValidator`):
 * 8–128 символов, буквы и цифры.
 */
function passwordError(password: string): string | null {
  if (password.length < 8) return "Не короче 8 символов";
  if (password.length > 128) return "Не длиннее 128 символов";
  if (!/[a-zA-Zа-яА-Я]/.test(password) || !/\d/.test(password))
    return "Должен содержать буквы и цифры";
  return null;
}

export default function UsersPage() {
  const { data, isLoading, isError, refetch } = useUsers();
  const currentUser = useAuthStore((s) => s.user);

  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = useDeleteUser();
  const changePassword = useChangePassword();

  const [editing, setEditing] = useState<AuthUser | null | "new">(null);
  const [toDelete, setToDelete] = useState<AuthUser | null>(null);
  const [passwordFor, setPasswordFor] = useState<AuthUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [form, setForm] = useState({
    email: "",
    displayName: "",
    password: "",
    role: String(UserRole.Editor),
    isActive: true,
  });

  function open(item: AuthUser | "new") {
    setEditing(item);
    setForm(
      item === "new"
        ? { email: "", displayName: "", password: "", role: String(UserRole.Editor), isActive: true }
        : {
            email: item.email,
            displayName: item.displayName,
            password: "",
            role: String(item.role),
            isActive: item.isActive,
          },
    );
  }

  function submit() {
    const base = {
      email: form.email.trim(),
      displayName: form.displayName.trim(),
      role: Number(form.role) as UserRole,
      isActive: form.isActive,
    };
    const done = { onSuccess: () => setEditing(null) };

    if (editing === "new") create.mutate({ ...base, password: form.password }, done);
    else if (editing) update.mutate({ id: editing.id, input: base }, done);
  }

  const formPasswordError = editing === "new" ? passwordError(form.password) : null;
  const formValid =
    form.email.trim() && form.displayName.trim() && (editing !== "new" || !formPasswordError);

  const modalPasswordError = newPassword ? passwordError(newPassword) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Пользователи</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Публичной регистрации нет — аккаунты заводятся здесь.
          </p>
        </div>
        <Button onClick={() => open("new")}>
          <Plus size={16} /> Пользователь
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border-subtle">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="border-b border-border-subtle bg-surface-sunken">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">Имя</th>
                <th className="px-3 py-2.5 text-left font-medium">Email</th>
                <th className="px-3 py-2.5 text-left font-medium">Роль</th>
                <th className="px-3 py-2.5 text-left font-medium">Статус</th>
                <th className="px-3 py-2.5 text-left font-medium">Последний вход</th>
                <th className="w-28 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data?.map((u) => {
                const role = ROLE_LABEL[u.role];
                const isSelf = u.id === currentUser?.id;

                return (
                  <tr key={u.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-3 py-2.5 font-medium">
                      {u.displayName}
                      {isSelf && <span className="ml-2 text-xs text-fg-subtle">(это вы)</span>}
                    </td>
                    <td className="px-3 py-2.5 text-fg-muted">{u.email}</td>
                    <td className="px-3 py-2.5">
                      <Badge color={role.color}>{role.text}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {u.isActive ? (
                        <Badge color="#22c55e">активен</Badge>
                      ) : (
                        <Badge>отключён</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-fg-subtle">
                      {u.lastLoginAt ? formatDate(u.lastLoginAt) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordFor(u);
                            setNewPassword("");
                          }}
                          aria-label={`Сменить пароль ${u.displayName}`}
                          title="Сменить пароль"
                          className="rounded p-1.5 text-fg-subtle transition-colors hover:text-fg"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => open(u)}
                          aria-label={`Изменить ${u.displayName}`}
                          className="rounded p-1.5 text-fg-subtle transition-colors hover:text-fg"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setToDelete(u)}
                          aria-label={`Удалить ${u.displayName}`}
                          className="rounded p-1.5 text-fg-subtle transition-colors hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Новый пользователь" : "Пользователь"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button
              onClick={submit}
              disabled={!formValid || create.isPending || update.isPending}
            >
              Сохранить
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="off"
            />
          </Field>

          <Field label="Отображаемое имя" required>
            <Input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </Field>

          {editing === "new" && (
            <Field
              label="Пароль"
              required
              error={form.password ? (formPasswordError ?? undefined) : undefined}
              hint="Минимум 8 символов, буквы и цифры"
            >
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
                invalid={Boolean(form.password && formPasswordError)}
              />
            </Field>
          )}

          <Field
            label="Роль"
            hint="Редактор правит контент, админ — ещё и пользователей"
          >
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value={UserRole.Editor}>Редактор</option>
              <option value={UserRole.Admin}>Админ</option>
            </Select>
          </Field>

          <Checkbox
            label="Активен"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />

          {/* Сервер не даст снять последнего активного админа — предупреждаем заранее,
              чтобы 409 не выглядел неожиданностью. */}
          {editing !== "new" &&
            editing?.role === UserRole.Admin &&
            (Number(form.role) !== UserRole.Admin || !form.isActive) && (
              <p className="rounded-control border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
                Если это последний активный админ, сервер отклонит изменение.
              </p>
            )}
        </div>
      </Modal>

      <Modal
        open={passwordFor !== null}
        onClose={() => setPasswordFor(null)}
        title={`Пароль: ${passwordFor?.displayName ?? ""}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPasswordFor(null)}>
              Отмена
            </Button>
            <Button
              disabled={!newPassword || Boolean(modalPasswordError) || changePassword.isPending}
              onClick={() =>
                passwordFor &&
                changePassword.mutate(
                  { id: passwordFor.id, newPassword },
                  { onSuccess: () => setPasswordFor(null) },
                )
              }
            >
              Сменить
            </Button>
          </>
        }
      >
        <Field
          label="Новый пароль"
          required
          error={modalPasswordError ?? undefined}
          hint="Активные сессии пользователя будут завершены"
        >
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            invalid={Boolean(modalPasswordError)}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Удалить пользователя?"
        description={
          toDelete?.id === currentUser?.id
            ? "Это ваш собственный аккаунт. После удаления вы потеряете доступ."
            : `«${toDelete?.displayName}» потеряет доступ. Созданные им вопросы останутся.`
        }
        pending={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      />
    </div>
  );
}
