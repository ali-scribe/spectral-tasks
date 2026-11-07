import { describe, it, expect } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
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

function renderApp(tasks: Task[]): void {
  const load: LoadResult = { tasks, lastGoalCelebrationDate: null, storageMode: 'normal', notices: [] };
  const initialState: AppState = createInitialState(load, TODAY);
  render(
    <AppProvider initialState={initialState} clock={clock}>
      <App storage={null} loadedSnapshot={{ tasks, date: null }} />
    </AppProvider>,
  );
}

function spiritsSection(): HTMLElement {
  // The task list and views live in the "Spirits" section.
  return screen.getByRole('region', { name: 'Spirits' });
}

const overdue = () => makeTask({ id: 'overdue', title: 'Overdue chore', dueDate: '2026-06-10' });
const dueToday = () => makeTask({ id: 'dueToday', title: 'Today chore', dueDate: TODAY });
const upcoming = () => makeTask({ id: 'upcoming', title: 'Future chore', dueDate: '2026-06-20' });
const undated = () => makeTask({ id: 'undated', title: 'Someday chore', dueDate: null });
const done = () => makeCompletedOn('2026-06-14', { id: 'done', title: 'Finished chore' });

describe('views (AC-ORG-01)', () => {
  it('Today lists overdue and due-today active tasks only', () => {
    renderApp([overdue(), dueToday(), upcoming(), undated(), done()]);
    const section = spiritsSection();
    expect(within(section).getByText('Overdue chore')).toBeInTheDocument();
    expect(within(section).getByText('Today chore')).toBeInTheDocument();
    expect(within(section).queryByText('Future chore')).not.toBeInTheDocument();
    expect(within(section).queryByText('Someday chore')).not.toBeInTheDocument();
    expect(within(section).queryByText('Finished chore')).not.toBeInTheDocument();
  });

  it('marks the current view with aria-current', async () => {
    const user = userEvent.setup();
    renderApp([undated()]);
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'All Tasks' }));
    expect(screen.getByRole('button', { name: 'All Tasks' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Today' })).not.toHaveAttribute('aria-current');
  });

  it('Upcoming lists future-dated active tasks', async () => {
    const user = userEvent.setup();
    renderApp([overdue(), upcoming()]);
    await user.click(screen.getByRole('button', { name: 'Upcoming' }));
    const section = spiritsSection();
    expect(within(section).getByText('Future chore')).toBeInTheDocument();
    expect(within(section).queryByText('Overdue chore')).not.toBeInTheDocument();
  });

  it('All Tasks lists every active task including undated', async () => {
    const user = userEvent.setup();
    renderApp([overdue(), upcoming(), undated(), done()]);
    await user.click(screen.getByRole('button', { name: 'All Tasks' }));
    const section = spiritsSection();
    expect(within(section).getByText('Overdue chore')).toBeInTheDocument();
    expect(within(section).getByText('Future chore')).toBeInTheDocument();
    expect(within(section).getByText('Someday chore')).toBeInTheDocument();
    expect(within(section).queryByText('Finished chore')).not.toBeInTheDocument();
  });

  it('Completed lists completed tasks most-recent first', async () => {
    const user = userEvent.setup();
    const d1 = makeCompletedOn('2026-06-10', { id: 'c1', title: 'First done' });
    const d2 = makeCompletedOn('2026-06-14', { id: 'c2', title: 'Last done' });
    renderApp([d1, d2]);
    await user.click(screen.getByRole('button', { name: 'Completed' }));
    const titles = screen
      .getAllByText(/done$/)
      .map((el) => el.textContent);
    expect(titles).toEqual(['Last done', 'First done']);
  });
});

describe('empty states (AC-ORG-01.7, AC-ORG-02.6)', () => {
  it('shows a view-specific empty message when the view is empty', () => {
    renderApp([upcoming()]); // nothing due today
    expect(screen.getByText(/No spirits haunt today/i)).toBeInTheDocument();
  });

  it('shows a distinct no-match message when filters hide everything', async () => {
    const user = userEvent.setup();
    renderApp([dueToday()]);
    await user.type(screen.getByLabelText(/search spirits/i), 'zzzz');
    expect(screen.getByText(/No spirits match your search/i)).toBeInTheDocument();
    expect(screen.queryByText(/No spirits haunt today/i)).not.toBeInTheDocument();
  });
});

describe('filters (AC-ORG-02)', () => {
  it('search, category and priority combine as a conjunction', async () => {
    const user = userEvent.setup();
    const a = makeTask({ id: 'a', title: 'Alpha', category: 'Study', priority: 'High', dueDate: TODAY });
    const b = makeTask({ id: 'b', title: 'Alphabet', category: 'Work', priority: 'High', dueDate: TODAY });
    const c = makeTask({ id: 'c', title: 'Beta', category: 'Study', priority: 'High', dueDate: TODAY });
    renderApp([a, b, c]);
    const section = spiritsSection();

    await user.type(screen.getByLabelText(/search spirits/i), 'alph');
    // Alpha and Alphabet match the search.
    expect(within(section).getByText('Alpha')).toBeInTheDocument();
    expect(within(section).getByText('Alphabet')).toBeInTheDocument();
    expect(within(section).queryByText('Beta')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filter by category'), 'Study');
    // Only Alpha matches search AND category Study.
    expect(within(section).getByText('Alpha')).toBeInTheDocument();
    expect(within(section).queryByText('Alphabet')).not.toBeInTheDocument();
  });

  it('clear filters resets search, category and priority', async () => {
    const user = userEvent.setup();
    renderApp([makeTask({ id: 'a', title: 'Visible', dueDate: TODAY })]);
    await user.type(screen.getByLabelText(/search spirits/i), 'zzz');
    expect(screen.getByText(/No spirits match/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(screen.getByText('Visible')).toBeInTheDocument();
    expect(screen.getByLabelText(/search spirits/i)).toHaveValue('');
  });

  it('keeps filters when switching views (AC-ORG-02.8)', async () => {
    const user = userEvent.setup();
    renderApp([makeTask({ id: 'a', title: 'Keep', dueDate: TODAY })]);
    await user.type(screen.getByLabelText(/search spirits/i), 'ke');
    await user.click(screen.getByRole('button', { name: 'All Tasks' }));
    expect(screen.getByLabelText(/search spirits/i)).toHaveValue('ke');
  });
});

describe('sorting (AC-ORG-02.7)', () => {
  it('orders active tasks by due date ascending with undated last', async () => {
    const user = userEvent.setup();
    const later = makeTask({ id: 'later', title: 'Later', dueDate: '2026-06-25' });
    const sooner = makeTask({ id: 'sooner', title: 'Sooner', dueDate: '2026-06-18' });
    const none = makeTask({ id: 'none', title: 'Noneset', dueDate: null });
    renderApp([later, none, sooner]);
    await user.click(screen.getByRole('button', { name: 'All Tasks' }));
    const titles = screen.getAllByText(/^(Later|Sooner|Noneset)$/).map((el) => el.textContent);
    expect(titles).toEqual(['Sooner', 'Later', 'Noneset']);
  });
});

describe('EC-18: editing a task while a filter is active', () => {
  it('keeps the filter and reflects the edit', async () => {
    const user = userEvent.setup();
    renderApp([makeTask({ id: 'x', title: 'Haunted', dueDate: TODAY })]);
    await user.type(screen.getByLabelText(/search spirits/i), 'haunt');
    await user.click(screen.getByRole('button', { name: /edit spirit: haunted/i }));
    const dialog = screen.getByRole('dialog');
    const title = within(dialog).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Haunted manor');
    await user.click(within(dialog).getByRole('button', { name: /save spirit/i }));
    // Filter "haunt" still active and the edited title still matches.
    expect(screen.getByLabelText(/search spirits/i)).toHaveValue('haunt');
    expect(screen.getByText('Haunted manor')).toBeInTheDocument();
  });
});

describe('Today view recomputes after a local-midnight change (AC-ORG-01.9)', () => {
  it('a task due "tomorrow" appears in Today once the date advances', async () => {
    // Use a mutable clock to simulate crossing midnight, and fire a focus event
    // to trigger the date-change check without a reload.
    let current = new Date(2026, 5, 15, 23, 59, 0);
    const movingClock: Clock = () => new Date(current.getTime());
    const task = makeTask({ id: 'tmr', title: 'Tomorrow task', dueDate: '2026-06-16' });
    const load: LoadResult = { tasks: [task], lastGoalCelebrationDate: null, storageMode: 'normal', notices: [] };
    const initialState = createInitialState(load, '2026-06-15');
    render(
      <AppProvider initialState={initialState} clock={movingClock}>
        <App storage={null} loadedSnapshot={{ tasks: [task], date: null }} />
      </AppProvider>,
    );
    const user = userEvent.setup();

    // Not in Today yet (due 2026-06-16, today is 2026-06-15).
    expect(within(spiritsSection()).queryByText('Tomorrow task')).not.toBeInTheDocument();

    // Advance past midnight and trigger a date-change check via window focus.
    // The focus dispatch causes a DATE_CHECK state update, so wrap it in act().
    current = new Date(2026, 5, 16, 0, 1, 0);
    await user.click(document.body); // ensure focus is in the document
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(await within(spiritsSection()).findByText('Tomorrow task')).toBeInTheDocument();
  });
});
