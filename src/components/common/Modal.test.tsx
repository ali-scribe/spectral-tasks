import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';

// A harness with an opener button that toggles the modal, so focus-return can be
// verified against the real opener element.
function ModalHarness(): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <Modal title="Edit spirit" onClose={() => setOpen(false)}>
          <button type="button">First</button>
          <button type="button">Second</button>
        </Modal>
      )}
    </>
  );
}

describe('Modal focus behavior (AC-A11Y-01.4 to .6)', () => {
  it('moves focus into the dialog on open', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // First focusable control receives focus.
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('traps Tab and Shift+Tab within the dialog', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });

    expect(first).toHaveFocus();
    await user.tab();
    expect(second).toHaveFocus();
    // Tab from the last wraps to the first.
    await user.tab();
    expect(first).toHaveFocus();
    // Shift+Tab from the first wraps to the last.
    await user.tab({ shift: true });
    expect(second).toHaveFocus();
  });

  it('Escape closes and returns focus to the opener', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

describe('ConfirmDialog (AC-TASK-03.1, AC-A11Y-01.4 to .6)', () => {
  it('is an alertdialog, confirms and cancels', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Banish this spirit?"
        message="Delete the task Read chapter 4."
        confirmLabel="Banish"
        tone="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/Read chapter 4/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Banish' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Escape triggers cancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Banish this spirit?"
        message="Delete the task."
        confirmLabel="Banish"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
