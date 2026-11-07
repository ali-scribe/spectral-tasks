import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App.tsx';
import { AppProvider } from '../../state/AppContext.tsx';
import { createInitialState } from '../../state/initialState.ts';
import type { AppState, Task } from '../../domain/types.ts';
import type { Clock } from '../../domain/dates.ts';
import type { LoadResult } from '../../storage/storageService.ts';
import { makeTask, makeCompletedOn } from '../../test/factories.ts';

const TODAY = '2026-06-15';
const clock: Clock = () => new Date(2026, 5, 15, 12, 0, 0);

function renderApp(tasks: Task[] = []): void {
  const load: LoadResult = { tasks, lastGoalCelebrationDate: null, storageMode: 'normal', notices: [] };
  const initialState: AppState = createInitialState(load, TODAY);
  render(
    <AppProvider initialState={initialState} clock={clock}>
      <App storage={null} loadedSnapshot={{ tasks, date: null }} />
    </AppProvider>,
  );
}

function manor(): HTMLElement {
  return screen.getByRole('img');
}

// Many tasks for a given completed count, all completed today, plus some active
// so there is something to toggle.
function completedToday(n: number): Task[] {
  return Array.from({ length: n }, (_, i) =>
    makeCompletedOn(TODAY, { id: `c${i}`, title: `Done ${i}` }),
  );
}

describe('counts and progress (AC-DASH-01.1, .3, .4)', () => {
  it('updates counts and daily progress within the same interaction', async () => {
    const user = userEvent.setup();
    const active = makeTask({ id: 'a', title: 'Active task', dueDate: TODAY });
    renderApp([active]);
    expect(screen.getByText('1', { selector: '.count__value' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /release spirit: active task/i }));
    // Daily progress reflects one completion.
    expect(screen.getByText(/1 of 3/)).toBeInTheDocument();
  });
});

describe('empty state and demo data (AC-DASH-01.5 to .11)', () => {
  it('shows the welcome and loads demo data', async () => {
    const user = userEvent.setup();
    renderApp([]);
    expect(screen.getByText(/manor stands silent/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /load demo data/i }));
    // Demo tasks now exist; the remove control appears.
    expect(screen.getByRole('button', { name: /remove demo data/i })).toBeInTheDocument();
    // Load demo control is gone (tasks now exist).
    expect(screen.queryByRole('button', { name: /load demo data/i })).not.toBeInTheDocument();
  });

  it('EC-21: removing demo keeps a user task with the same title as a demo task', async () => {
    const user = userEvent.setup();
    // A demo task and a user task sharing a title.
    const demo = makeTask({ id: 'demo1', title: 'Shared title', source: 'demo' });
    const userTask = makeTask({ id: 'user1', title: 'Shared title', source: 'user' });
    renderApp([demo, userTask]);
    await user.click(screen.getByRole('button', { name: /remove demo data/i }));
    await user.click(screen.getByRole('button', { name: 'Remove them' })); // confirm in dialog
    // Switch to All Tasks and confirm one "Shared title" remains (the user one).
    await user.click(screen.getByRole('button', { name: 'All Tasks' }));
    expect(screen.getAllByText('Shared title')).toHaveLength(1);
  });

  it('EC-22: removing demo removes an edited demo task', async () => {
    const user = userEvent.setup();
    const demo = makeTask({ id: 'demo1', title: 'Renamed demo', source: 'demo' });
    renderApp([demo]);
    await user.click(screen.getByRole('button', { name: /remove demo data/i }));
    await user.click(screen.getByRole('button', { name: 'Remove them' }));
    await user.click(screen.getByRole('button', { name: 'All Tasks' }));
    expect(screen.queryByText('Renamed demo')).not.toBeInTheDocument();
  });
});

describe('manor (AC-MANOR-01.3, .4, .6, .11, .12)', () => {
  it('shows stage 0 ruined manor with a text alternative on load', () => {
    renderApp([]);
    expect(manor()).toHaveClass('manor--stage-0');
    expect(manor()).toHaveAttribute('aria-label', expect.stringMatching(/ruined/i));
    expect(screen.getByText(/Abandoned/)).toBeInTheDocument();
  });

  it('reflects a higher stage from loaded completions without announcing on load', () => {
    renderApp(completedToday(5)); // stage 2
    expect(manor()).toHaveClass('manor--stage-2');
    expect(screen.getByText(/Stirring/)).toBeInTheDocument();
    // No stage-increase announcement text on load.
    expect(screen.queryByText(/The manor has risen/i)).not.toBeInTheDocument();
  });

  it('announces a stage increase when a completion crosses a threshold', async () => {
    const user = userEvent.setup();
    // Zero completed, one active due today: completing it reaches stage 1.
    renderApp([makeTask({ id: 'a', title: 'First', dueDate: TODAY })]);
    expect(manor()).toHaveClass('manor--stage-0');
    await user.click(screen.getByRole('checkbox', { name: /release spirit: first/i }));
    expect(manor()).toHaveClass('manor--stage-1');
    expect(screen.getByText(/The manor has risen to Awakening/i)).toBeInTheDocument();
  });

  it('regresses when a completed task is reopened', async () => {
    const user = userEvent.setup();
    // One completed today -> stage 1. Reopen it -> stage 0.
    renderApp([makeCompletedOn(TODAY, { id: 'c0', title: 'Done one' })]);
    expect(manor()).toHaveClass('manor--stage-1');
    await user.click(screen.getByRole('button', { name: 'Completed' }));
    await user.click(screen.getByRole('checkbox', { name: /reopen spirit: done one/i }));
    expect(manor()).toHaveClass('manor--stage-0');
  });
});

describe('ghost celebration (AC-GHOST-01.2, .3, .7, .16, .17)', () => {
  async function completeThird(user: ReturnType<typeof userEvent.setup>) {
    // Two already completed today + one active due today; completing the active
    // one reaches the daily goal of 3.
    await user.click(screen.getByRole('checkbox', { name: /release spirit: third/i }));
  }

  it('plays the daily-goal celebration and still announces the completion (EC-33)', async () => {
    const user = userEvent.setup();
    const tasks = [
      makeCompletedOn(TODAY, { id: 'c1', title: 'Done 1' }),
      makeCompletedOn(TODAY, { id: 'c2', title: 'Done 2' }),
      makeTask({ id: 'a3', title: 'Third', dueDate: TODAY }),
    ];
    renderApp(tasks);
    await completeThird(user);
    // Ghost shows the goal message (visible text + the polite live region).
    expect(screen.getAllByText(/manor grows brighter/i).length).toBeGreaterThanOrEqual(1);
    // The completion is still announced in the action live region.
    expect(screen.getByText('Spirit released: Third')).toBeInTheDocument();
  });

  it('does not celebrate on reopen or delete (AC-GHOST-01.7)', async () => {
    const user = userEvent.setup();
    renderApp([makeCompletedOn(TODAY, { id: 'c0', title: 'Done one' })]);
    await user.click(screen.getByRole('button', { name: 'Completed' }));
    await user.click(screen.getByRole('checkbox', { name: /reopen spirit: done one/i }));
    // Ghost returns to idle message, not a celebration.
    expect(screen.queryByText(/manor grows brighter/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/is released\. Well done/i)).not.toBeInTheDocument();
  });

  it('task controls remain enabled during a ghost reaction (AC-GHOST-01.5)', async () => {
    const user = userEvent.setup();
    renderApp([makeTask({ id: 'a', title: 'Busy', dueDate: null })]);
    await user.click(screen.getByRole('button', { name: 'All Tasks' }));
    await user.click(screen.getByRole('checkbox', { name: /release spirit: busy/i }));
    // A reaction is now playing (the ghost shows a celebration message).
    expect(screen.getAllByText(/released\. Well done|manor grows brighter/i).length).toBeGreaterThanOrEqual(1);
    // The completed task moved to the Completed view; its reopen control is
    // reachable and enabled while the reaction plays (controls never blocked).
    await user.click(screen.getByRole('button', { name: 'Completed' }));
    const toggle = screen.getByRole('checkbox', { name: /reopen spirit: busy/i });
    expect(toggle).toBeEnabled();
  });
});
