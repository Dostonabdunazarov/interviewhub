import { create } from "zustand";

export type ToastKind = "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const AUTO_DISMISS_MS = 4000;

let nextId = 1;

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

/**
 * Тосты об успехе и ошибке. Стор, а не контекст: показывать их нужно
 * из мутаций в hooks-слое, где до React-контекста не дотянуться.
 *
 * Ошибки не гасятся автоматически — их надо прочитать; успехи исчезают сами.
 */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (kind, message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));

    if (kind === "success") {
      setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
    }
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (message: string) => useToastStore.getState().push("success", message),
  error: (message: string) => useToastStore.getState().push("error", message),
};
