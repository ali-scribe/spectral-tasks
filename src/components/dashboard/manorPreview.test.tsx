import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mountApp } from '../../test/mountApp.tsx';
import { createFakeStorage } from '../../test/fakeStorage.ts';
import { makeCompletedOn } from '../../test/factories.ts';
import { serializeEnvelope } from '../../storage/envelope.ts';
import { STORAGE_KEY } from '../../domain/constants.ts';

const TODAY = '2026-06-15';

/** n tasks completed today: 5 puts the real manor at stage 2 (Stirring). */
function storageWithCompleted(n: number) {
  const tasks = Array.from({ length: n }, (_, i) => makeCompletedOn(TODAY, { id: `c${i}`, title: `Done ${i}` }));
  return createFakeStorage({ initial: { [STORAGE_KEY]: serializeEnvelope(tasks, null) } });
}

const manor = () => screen.getByRole('img');

describe('Preview manor stages (read-only)', () => {
  it('shows the chosen stage without changing counts, progress, or storage', async () => {
    const user = userEvent.setup();
    const storage = storageWithCompleted(5);
    mountApp(storage);
    expect(manor()).toHaveClass('manor--stage-2');

    const countBefore = screen.getByText('spirits released').previousElementSibling?.textContent;
    const writesBefore = storage.setCalls().length;
    const callsBefore = storage.calls.length;
    const persistedBefore = storage.peek(STORAGE_KEY);

    await user.click(screen.getByRole('button', { name: 'Preview manor stages' }));
    const five = screen.getByRole('button', { name: 'Stage 5: Enchanted' });
    expect(five).toHaveAttribute('aria-pressed', 'false');
    await user.click(five);

    // The manor now shows stage 5, and the label names the real stage.
    expect(manor()).toHaveClass('manor--stage-5');
    expect(manor()).toHaveAttribute('data-stage', '5');
    expect(five).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Preview: your real progress is stage 2\./)).toBeInTheDocument();
    expect(screen.getByText('Previewing stage 5')).toBeInTheDocument();

    // Real progress is untouched: the stage name and counts still describe stage 2.
    expect(screen.getByText('Stirring')).toBeInTheDocument();
    expect(screen.getByText('spirits released').previousElementSibling?.textContent).toBe(countBefore);
    expect(screen.getByText('5', { selector: '.count__value' })).toBeInTheDocument();
    expect(screen.getByText(/of 3/)).toBeInTheDocument();

    // No stage-increase announcement, and nothing written (or even read) in storage.
    expect(screen.queryByText(/The manor has risen to/)).not.toBeInTheDocument();
    expect(storage.setCalls().length).toBe(writesBefore);
    expect(storage.calls.length).toBe(callsBefore);
    expect(storage.peek(STORAGE_KEY)).toBe(persistedBefore);
  });

  it('"Back to my manor" restores the real stage and removes the preview label', async () => {
    const user = userEvent.setup();
    mountApp(storageWithCompleted(5));

    await user.click(screen.getByRole('button', { name: 'Preview manor stages' }));
    await user.click(screen.getByRole('button', { name: 'Stage 0: Abandoned' }));
    expect(manor()).toHaveClass('manor--stage-0');

    await user.click(screen.getByRole('button', { name: 'Back to my manor' }));
    expect(manor()).toHaveClass('manor--stage-2');
    expect(screen.queryByText(/Preview: your real progress/)).not.toBeInTheDocument();
    expect(screen.getByText('Showing your real manor, stage 2')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Preview a manor stage' });
    for (const button of within(group).getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('is operable by keyboard', async () => {
    const user = userEvent.setup();
    mountApp(storageWithCompleted(0));
    const toggle = screen.getByRole('button', { name: 'Preview manor stages' });
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    await user.keyboard(' ');
    expect(manor()).toHaveClass('manor--stage-0');
    expect(screen.getByText(/Preview: your real progress is stage 0\./)).toBeInTheDocument();
  });
});
