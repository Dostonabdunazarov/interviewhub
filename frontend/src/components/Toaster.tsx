import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { useToastStore } from "../store/toastStore";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-100 flex w-[min(24rem,calc(100vw-2rem))]
                 flex-col gap-2"
      // Ошибки должны прочитываться скринридером сразу, успехи — не перебивая.
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.18 }}
            className="glass pointer-events-auto flex items-start gap-3 rounded-control p-3.5"
          >
            {t.kind === "success" ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
            ) : (
              <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />
            )}

            <p className="min-w-0 flex-1 text-sm">{t.message}</p>

            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Закрыть"
              className="-m-1 shrink-0 rounded p-1 text-fg-subtle transition-colors hover:text-fg"
            >
              <X size={15} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
