import { describe, it, expect } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mountApp } from './mountApp.tsx';
import { createFakeStorage, type FakeStorage } from './fakeStorage.ts';
import { makeTask, makeCompletedOn } from './factories.ts';
import { serializeEnvelope } from '../storage/envelope.ts';
import { STORAGE_KEY } from '../domain/constants.ts';
import { GHOST_MESSAGES } from '../domain/ghost.ts';
import type { Clock } from '../domain/dates.ts';
import type { Task } from '../domain/types.ts';

// Closes the Requirement 19.4 gaps at component level (AC-NFR-01.4):
// - once-per-day Daily_Goal_Celebration (AC-GHOST-01.3, .8, .11; EC-8, EC-26)
// - a completion and a Date_Change_Check in the same interaction
//   (AC-GHOST-01.15; EC-32)
// - the ordinary completion message is replaced by the celebration while the
//   completion is still announced (AC-GHOST-01.16, .17; EC-33)

type User = ReturnType<typeof userEvent.setup>;

const TODAY = '2026-06-15';

/** n active, undated tasks titled "Spirit 1" .. "Spirit n". */
function spirits(n: number): Task[] {
  return Array.from({ length: n }, (_, i) => makeTask({ id: `spirit-${i + 1}`, title: `Spirit ${i + 1}` }));
}

/** Two tasks already completed today plus one more to reach the goal of 3. */
function twoDoneAndOneToGo(): Task[] {
  return [
    makeCompletedOn(TODAY, { id: 'done-1', title: 'Done 1' }),
    makeCompletedOn(TODAY, { id: 'done-2', title: 'Done 2' }),
    makeTask({ id: 'third', title: 'Third spirit' }),
  ];
}

function storageWith(tasks: Task[]): FakeStorage {
  return createFakeStorage({ initial: { [STORAGE_KEY]: serializeEnvelope(tasks, null) } });
}

function persistedGoalDate(storage: FakeStorage): string | null {
  const parsed = JSON.parse(storage.peek(STORAGE_KEY)!) as { lastGoalCelebrationDate: string | null };
  return parsed.lastGoalCelebrationDate;
}

async function openView(user: User, name: 'Today' | 'All Tasks' | 'Completed'): Promise<void> {
  await user.click(screen.getByRole('button', { name }));
}

async function release(user: User, title: string): Promise<void> {
  await user.click(screen.getByRole('checkbox', { name: `Release spirit: ${title}` }));
}

async function reopen(user: User, title: string): Promise<void> {
  await user.click(screen.getByRole('checkbox', { name: `Reopen spirit: ${title}` }));
}

// The ghost message is rendered as visible text and again in a polite live
// region, so these helpers look at every occurrence on the page.
const goalMessages = () => screen.queryAllByText(GHOST_MESSAGES.goal);
const ordinaryMessages = () => screen.queryAllByText(GHOST_MESSAGES.celebrate);

describe('once-per-day Daily_Goal_Celebration (AC-GHOST-01.3, .8, .11)', () => {
  it('EC-8: reopening and re-completing the same day plays the ordinary reaction, not a second celebration', async () => {
    const user = userEvent.setup();
    const storage = storageWith(twoDoneAndOneToGo());
    mountApp(storage);
    await openView(user, 'All Tasks');

    // Third completion today: the daily-goal celebration plays and is recorded.
    await release(user, 'Third spirit');
    expect(goalMessages().length).toBeGreaterThan(0);
    expect(persistedGoalDate(storage)).toBe(TODAY);

    // Reopen it: progress drops back below the goal.
    await openView(user, 'Completed');
    await reopen(user, 'Third spirit');
    expect(screen.getByText(/2 of 3/)).toBeInTheDocument();

    // Reach the goal again the same day: no second celebration.
    await openView(user, 'All Tasks');
    await release(user, 'Third spirit');
    expect(screen.getByText(/3 of 3/)).toBeInTheDocument();
    expect(goalMessages()).toHaveLength(0);
    expect(ordinaryMessages().length).toBeGreaterThan(0);
    expect(screen.getByText('Spirit released: Third spirit')).toBeInTheDocument();
  });

  it('EC-8: still no second celebration after a remount (the date was persisted)', async () => {
    const user = userEvent.setup();
    const storage = storageWith(twoDoneAndOneToGo());

    const first = mountApp(storage);
    await openView(user, 'All Tasks');
    await release(user, 'Third spirit');
    expect(goalMessages().length).toBeGreaterThan(0);
    expect(persistedGoalDate(storage)).toBe(TODAY);
    first.unmount();

    // Fresh bootstrap: the goal is already reached, so loading is silent.
    mountApp(storage);
    expect(goalMessages()).toHaveLength(0);
    expect(screen.getByText(GHOST_MESSAGES.idle, { selector: '.ghost__message' })).toBeInTheDocument();

    // Reopen and re-complete: ordinary reaction only.
    await openView(user, 'Completed');
    await reopen(user, 'Third spirit');
    await openView(user, 'All Tasks');
    await release(user, 'Third spirit');
    expect(goalMessages()).toHaveLength(0);
    expect(ordinaryMessages().length).toBeGreaterThan(0);
  });

  it('EC-26: a new local day starts a new celebration eligibility period', async () => {
    const user = userEvent.setup();
    let current = new Date(2026, 5, 15, 12, 0, 0);
    const clock: Clock = () => new Date(current.getTime());
    const storage = storageWith(spirits(6));
    mountApp(storage, clock);
    await openView(user, 'All Tasks');

    // Day 1: the third completion celebrates.
    await release(user, 'Spirit 1');
    await release(user, 'Spirit 2');
    expect(goalMessages()).toHaveLength(0);
    await release(user, 'Spirit 3');
    expect(goalMessages().length).toBeGreaterThan(0);
    expect(persistedGoalDate(storage)).toBe('2026-06-15');

    // Day 2: progress starts over, and reaching the goal celebrates again.
    current = new Date(2026, 5, 16, 12, 0, 0);
    await release(user, 'Spirit 4');
    expect(goalMessages()).toHaveLength(0); // replaced by the ordinary reaction
    expect(ordinaryMessages().length).toBeGreaterThan(0);
    await release(user, 'Spirit 5');
    expect(goalMessages()).toHaveLength(0);
    await release(user, 'Spirit 6');
    expect(goalMessages().length).toBeGreaterThan(0);
    expect(persistedGoalDate(storage)).toBe('2026-06-16');
  });
});

describe('completion and Date_Change_Check in the same interaction (AC-GHOST-01.15, EC-32)', () => {
  it('a date check right after the goal-reaching completion does not suppress the celebration', async () => {
    const user = userEvent.setup();
    const storage = storageWith(twoDoneAndOneToGo());
    mountApp(storage);
    await openView(user, 'All Tasks');

    const checkbox = screen.getByRole('checkbox', { name: 'Release spirit: Third spirit' });
    // One batch: the completion and a window focus (which runs a date check).
    act(() => {
      checkbox.click();
      window.dispatchEvent(new Event('focus'));
    });

    expect(goalMessages().length).toBeGreaterThan(0);
    expect(ordinaryMessages()).toHaveLength(0);
    expect(screen.getByText('Spirit released: Third spirit')).toBeInTheDocument();
    expect(persistedGoalDate(storage)).toBe(TODAY);
  });

  it('a date check right before the goal-reaching completion does not record or suppress anything', async () => {
    const user = userEvent.setup();
    const storage = storageWith(twoDoneAndOneToGo());
    mountApp(storage);
    await openView(user, 'All Tasks');

    const checkbox = screen.getByRole('checkbox', { name: 'Release spirit: Third spirit' });
    act(() => {
      window.dispatchEvent(new Event('focus'));
      checkbox.click();
    });

    expect(goalMessages().length).toBeGreaterThan(0);
    expect(ordinaryMessages()).toHaveLength(0);
    expect(persistedGoalDate(storage)).toBe(TODAY);
  });
});

describe('the celebration replaces the ordinary completion message (AC-GHOST-01.16, .17, EC-33)', () => {
  it('shows the ordinary message for the first two completions, then only the celebration, and always announces', async () => {
    const user = userEvent.setup();
    mountApp(storageWith(spirits(3)));
    await openView(user, 'All Tasks');

    await release(user, 'Spirit 1');
    expect(ordinaryMessages().length).toBeGreaterThan(0);
    expect(goalMessages()).toHaveLength(0);
    expect(screen.getByText('Spirit released: Spirit 1')).toBeInTheDocument();

    await release(user, 'Spirit 2');
    expect(ordinaryMessages().length).toBeGreaterThan(0);
    expect(goalMessages()).toHaveLength(0);

    // The completion that reaches the goal: celebration only.
    await release(user, 'Spirit 3');
    expect(goalMessages().length).toBeGreaterThan(0);
    expect(ordinaryMessages()).toHaveLength(0);
    // The completion itself is still announced in the live region.
    expect(screen.getByText('Spirit released: Spirit 3')).toBeInTheDocument();
  });
});
