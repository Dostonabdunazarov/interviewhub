import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Что именно исчезнет — без этого «Вы уверены?» не несёт информации. */
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Подтверждение удаления. Планом требуется перед каждым необратимым действием. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Удалить",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Отмена
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? "Удаляем…" : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-fg-muted">{description}</p>
    </Modal>
  );
}
