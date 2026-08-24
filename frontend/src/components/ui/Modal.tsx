import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Кнопки внизу; отделены рамкой и прилипают к низу при длинной форме. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-3xl",
};

export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  // Escape закрывает, фон не скроллится под модалкой.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  // Портал строим только когда есть куда: вне браузера (дымовой рендер
  // через react-dom/server) document отсутствует, и обращение к нему
  // роняло бы любую страницу с модалкой.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-90 grid place-items-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/55"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative flex max-h-[90dvh] w-full ${sizes[size]} flex-col
                        overflow-hidden rounded-card border border-border-subtle bg-surface shadow-xl`}
          >
            <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-4">
              <h2 className="font-semibold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="-m-1 rounded p-1 text-fg-muted transition-colors hover:text-fg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {footer && (
              <div className="flex justify-end gap-2 border-t border-border-subtle px-5 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
