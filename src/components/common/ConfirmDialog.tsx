import { Modal } from './Modal.tsx';

interface ConfirmDialogProps {
  title: string;
  /** Body message, e.g. naming the task to delete (AC-TASK-03.1). */
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Visual tone of the confirm button. */
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A confirmation modal (alertdialog) for destructive or significant actions
 * (AC-TASK-03.1, AC-A11Y-01.4 to .6). Focus starts on the heading; Escape and
 * Cancel both dismiss without acting.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  return (
    <Modal title={title} role="alertdialog" focusHeading onClose={onCancel}>
      <p>{message}</p>
      <div className="modal__actions">
        <button type="button" className="btn" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={tone === 'danger' ? 'btn btn--danger' : 'btn btn--primary'}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
