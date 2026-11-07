import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  /** Accessible title text; rendered as the dialog heading and aria-labelledby. */
  title: string;
  /** Called when the user requests close (Escape or overlay); does not save. */
  onClose: () => void;
  children: ReactNode;
  /** 'dialog' (default) or 'alertdialog' for confirmations. */
  role?: 'dialog' | 'alertdialog';
  /** When true, focus the heading first (used by confirm dialogs). */
  focusHeading?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog (AC-A11Y-01.4 to .6, AC-TASK-03.1):
 * - role="dialog" / "alertdialog", aria-modal, aria-labelledby
 * - stores the element that had focus, moves focus inside on open
 * - traps Tab and Shift+Tab within the dialog
 * - Escape closes without saving
 * - restores focus to the opener on close
 *
 * A custom component is used instead of <dialog>.showModal() because jsdom does
 * not fully support it, which would make focus tests unreliable (design D6).
 */
export function Modal({
  title,
  onClose,
  children,
  role = 'dialog',
  focusHeading = false,
}: ModalProps): JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    // Remember the opener so focus can be restored on close.
    openerRef.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    if (dialog) {
      if (focusHeading && headingRef.current) {
        headingRef.current.focus();
      } else {
        const first = dialog.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? headingRef.current ?? dialog).focus();
      }
    }

    return () => {
      // Restore focus to the opener when the dialog unmounts (AC-A11Y-01.5).
      openerRef.current?.focus?.();
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === first || active === dialog || active === headingRef.current) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
    // Close only when the overlay itself (not the dialog) is pressed.
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown}>
      <div
        className="modal"
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <h2 className="modal__title" id={titleId} ref={headingRef} tabIndex={-1}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
