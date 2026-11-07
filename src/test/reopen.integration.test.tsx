import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mountApp, fixedClock } from './mountApp.tsx';
import { createFakeStorage, type FakeStorage } from './fakeStorage.ts';
import { makeCompletedOn } from './factories.ts';
import { serializeEnvelope } from '../storage/envelope.ts';
import { STORAGE_KEY } from '../domain/constants.ts';
import { GHOST_MESSAGES } from '../domain/ghost.ts';
import type { Task } from '../domain/types.ts';

// Closes the Requirement 19.4 gap "reopening" with a dedicated test of the whole
// path through the app (AC-TASK-04.2, .3, .4; AC-ORG-03.3, .6; AC-GHOST-01.7).

type PersistedTask = { id: string; status: string; completedAt: string | null };

function persistedTask(storage: FakeStorage, id: string): PersistedTask {
  const parsed = JSON.parse(storage.peek(STORAGE_KEY)!) as { tasks: PersistedTask[] };
  const task = parsed.tasks.find((t) => t.id === id);
  if (!task) throw new Error(`Task ${id} was not persisted`);
  return task;
}

function counts(): Array<string | null> {
  return Array.from(document.querySelectorAll('.count__value')).map((el) => el.textContent);
}

describe('reopening a completed task through the app', () => {
  it('returns it to active, restores Overdue, clears completedAt, updates counts, announces, and does not celebrate', async () => {
    const user = userEvent.setup();
    // Completed yesterday; its due date (2026-06-10) is before today (2026-06-15).
    const original: Task = makeCompletedOn('2026-06-14', {
      id: 'old',
      title: 'Old chore',
      dueDate: '2026-06-10',
      category: 'Work',
      priority: 'High',
    });
    const storage = createFakeStorage({
      initial: { [STORAGE_KEY]: serializeEnvelope([original], null) },
    });
    mountApp(storage);

    // Loaded as completed: counted as released, not overdue, no progress today.
    expect(counts()).toEqual(['0', '1']);
    expect(screen.getByText(/0 of 3/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Completed' }));
    let row = screen.getByText('Old chore').closest('li')!;
    expect(within(row).getByText('Released')).toBeInTheDocument();
    expect(within(row).queryByText('Overdue')).not.toBeInTheDocument();

    // Reopen it.
    await user.click(screen.getByRole('checkbox', { name: 'Reopen spirit: Old chore' }));
    expect(screen.getByText('Spirit reopened')).toBeInTheDocument();
    expect(screen.queryByText('Old chore')).not.toBeInTheDocument(); // left Completed
    expect(counts()).toEqual(['1', '0']);
    expect(screen.getByText(/0 of 3/)).toBeInTheDocument();

    // Reopening never celebrates.
    expect(screen.queryAllByText(GHOST_MESSAGES.celebrate)).toHaveLength(0);
    expect(screen.queryAllByText(GHOST_MESSAGES.goal)).toHaveLength(0);

    // Persisted: active again, completion timestamp cleared.
    expect(persistedTask(storage, 'old')).toMatchObject({ status: 'active', completedAt: null });

    // Back in Today, the overdue label is restored (AC-ORG-03.6).
    await user.click(screen.getByRole('button', { name: 'Today' }));
    row = screen.getByText('Old chore').closest('li')!;
    expect(within(row).getByText('Overdue')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(within(row).getByRole('checkbox', { name: 'Release spirit: Old chore' })).not.toBeChecked();

    // Completing it again records a new completion timestamp (AC-TASK-04.4).
    await user.click(within(row).getByRole('checkbox', { name: 'Release spirit: Old chore' }));
    const again = persistedTask(storage, 'old');
    expect(again.status).toBe('completed');
    expect(again.completedAt).toBe(fixedClock().toISOString());
    expect(again.completedAt).not.toBe(original.completedAt);
    expect(counts()).toEqual(['0', '1']);
    expect(screen.getByText(/1 of 3/)).toBeInTheDocument();
  });
});
