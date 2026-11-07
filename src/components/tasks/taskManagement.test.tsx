import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App.tsx';
import { AppProvider } from '../../state/AppContext.tsx';
import { createInitialState } from '../../state/initialState.ts';
import type { AppState, Task } from '../../domain/types.ts';
import type { Clock } from '../../domain/dates.ts';
import type { LoadResult } from '../../storage/storageService.ts';
import { makeTask } from '../../test/factories.ts';

const TODAY = '2026-06-15';
// Fixed clock at noon on TODAY so completion dates are deterministic.
const clock: Clock = () => new Date(2026, 5, 15, 12, 0, 0);

function renderApp(tasks: Task[] = []): void {
  const load: LoadResult = { tasks, lastGoalCelebrationDate: null, storageMode: 'normal', notices: [] };
  const initialState: AppState = createInitialState(load, TODAY);
  render(
    <AppProvider initialState={initialState} clock={clock}>
      {/* null storage keeps persistence a no-op path (memoryOnly), fine for UI tests */}
      <App storage={null} loadedSnapshot={{ tasks, date: null }} />
    </AppProvider>,
  );
}

function createForm() {
  return screen.getByRole('form', { name: /summon a spirit/i });
}

// Switch to the "All Tasks" view so undated test tasks are visible (the default
// view is Today, which lists only dated active tasks due today or earlier).
async function showAllTasks(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'All Tasks' }));
}

describe('TaskForm create (AC-TASK-01.1, .8)', () => {
  it('creates a task, clears fields and returns focus to the title', async () => {
    const user = userEvent.setup();
    renderApp();
    const form = createForm();
    const title = within(form).getByLabelText('Title');
    await user.type(title, 'Read the grimoire');
    await user.click(within(form).getByRole('button', { name: /summon spirit/i }));

    // Fields cleared and focus back on the title (checked before navigating).
    expect(title).toHaveValue('');
    expect(title).toHaveFocus();
    // Announced.
    expect(screen.getByText('Spirit summoned')).toBeInTheDocument();
    // The new task is undated, so it lives in the All Tasks view.
    await showAllTasks(user);
    expect(screen.getByText('Read the grimoire')).toBeInTheDocument();
  });

  it('rejects a whitespace-only title and focuses the title field (AC-VAL-01.10)', async () => {
    const user = userEvent.setup();
    renderApp();
    const form = createForm();
    const title = within(form).getByLabelText('Title');
    await user.type(title, '   ');
    await user.click(within(form).getByRole('button', { name: /summon spirit/i }));
    expect(within(form).getByText(/needs a title/i)).toBeInTheDocument();
    expect(title).toHaveFocus();
    expect(title).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears a field error as the user corrects it (AC-VAL-01.11)', async () => {
    const user = userEvent.setup();
    renderApp();
    const form = createForm();
    const title = within(form).getByLabelText('Title');
    await user.click(within(form).getByRole('button', { name: /summon spirit/i }));
    expect(within(form).getByText(/needs a title/i)).toBeInTheDocument();
    await user.type(title, 'A');
    expect(within(form).queryByText(/needs a title/i)).not.toBeInTheDocument();
  });
});

describe('complete and reopen (AC-TASK-04, AC-ORG-03)', () => {
  it('toggles completion and removes then restores the overdue label', async () => {
    const user = userEvent.setup();
    const overdue = makeTask({ id: 'o1', title: 'Overdue task', dueDate: '2026-06-10' });
    renderApp([overdue]);

    // Overdue label visible while active.
    expect(screen.getByText('Overdue')).toBeInTheDocument();

    // Complete it.
    await user.click(screen.getByRole('checkbox', { name: /release spirit: overdue task/i }));
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    expect(screen.getByText('Spirit released: Overdue task')).toBeInTheDocument();

    // It now lives in Completed, where it is not shown as overdue.
    await user.click(screen.getByRole('button', { name: 'Completed' }));
    expect(screen.getByText('Overdue task')).toBeInTheDocument();
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();

    // Reopen it: the announcement fires and the task leaves Completed.
    await user.click(screen.getByRole('checkbox', { name: /reopen spirit: overdue task/i }));
    expect(screen.getByText('Spirit reopened')).toBeInTheDocument();
    expect(screen.queryByText('Overdue task')).not.toBeInTheDocument();

    // Back in Today (its due date is still in the past), the label is restored.
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByText('Overdue task')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });
});

describe('edit (AC-TASK-02)', () => {
  it('opens prefilled, saves changes, and keeps a completed task completed', async () => {
    const user = userEvent.setup();
    const task = makeTask({ id: 'e1', title: 'Original', status: 'active' });
    renderApp([task]);

    await showAllTasks(user);
    await user.click(screen.getByRole('button', { name: /edit spirit: original/i }));
    const dialog = screen.getByRole('dialog');
    const title = within(dialog).getByLabelText('Title');
    expect(title).toHaveValue('Original');
    await user.clear(title);
    await user.type(title, 'Renamed');
    await user.click(within(dialog).getByRole('button', { name: /save spirit/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Renamed')).toBeInTheDocument();
    expect(screen.getByText('Spirit updated')).toBeInTheDocument();
  });

  it('cancel discards changes', async () => {
    const user = userEvent.setup();
    const task = makeTask({ id: 'e2', title: 'KeepMe' });
    renderApp([task]);
    await showAllTasks(user);
    await user.click(screen.getByRole('button', { name: /edit spirit: keepme/i }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Title'));
    await user.type(within(dialog).getByLabelText('Title'), 'Changed');
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(screen.getByText('KeepMe')).toBeInTheDocument();
    expect(screen.queryByText('Changed')).not.toBeInTheDocument();
  });

  it('a failed edit keeps the saved task unchanged (AC-TASK-02.3)', async () => {
    const user = userEvent.setup();
    const task = makeTask({ id: 'e3', title: 'Stable' });
    renderApp([task]);
    await showAllTasks(user);
    await user.click(screen.getByRole('button', { name: /edit spirit: stable/i }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Title'));
    await user.click(within(dialog).getByRole('button', { name: /save spirit/i }));
    // Dialog stays open with an error; original task unchanged in the list.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getByText(/needs a title/i)).toBeInTheDocument();
    expect(screen.getByText('Stable')).toBeInTheDocument();
  });
});

describe('delete (AC-TASK-03)', () => {
  it('confirms deletion', async () => {
    const user = userEvent.setup();
    const task = makeTask({ id: 'd1', title: 'Doomed' });
    renderApp([task]);
    await showAllTasks(user);
    await user.click(screen.getByRole('button', { name: /delete spirit: doomed/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Doomed/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Banish' }));
    expect(screen.queryByText('Doomed')).not.toBeInTheDocument();
    expect(screen.getByText('Spirit banished')).toBeInTheDocument();
  });

  it('cancel keeps the task', async () => {
    const user = userEvent.setup();
    const task = makeTask({ id: 'd2', title: 'Survivor' });
    renderApp([task]);
    await showAllTasks(user);
    await user.click(screen.getByRole('button', { name: /delete spirit: survivor/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByText('Survivor')).toBeInTheDocument();
  });
});
