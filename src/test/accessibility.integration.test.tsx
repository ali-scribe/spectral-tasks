import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mountApp } from './mountApp.tsx';
import { createFakeStorage, type FakeStorage } from './fakeStorage.ts';
import { makeTask, makeCompletedOn } from './factories.ts';
import { serializeEnvelope } from '../storage/envelope.ts';
import { STORAGE_KEY } from '../domain/constants.ts';
import type { Task } from '../domain/types.ts';

// Task 14.2: accessibility behavior through the full app (fixed clock: today is
// 2026-06-15). Complements Modal.test.tsx and shell.test.tsx by exercising the
// real forms, lists and dialogs together, using keyboard input only.

type User = ReturnType<typeof userEvent.setup>;

const chapter = (): Task =>
  makeTask({
    id: 'chapter',
    title: 'Read chapter 4',
    category: 'Study',
    priority: 'High',
    dueDate: '2026-06-10', // before today: overdue, listed in Today
  });

const lamp = (): Task =>
  makeTask({ id: 'lamp', title: 'Buy lamp oil', category: 'Personal', priority: 'Low', dueDate: null });

function storageWith(tasks: Task[]): FakeStorage {
  return createFakeStorage({ initial: { [STORAGE_KEY]: serializeEnvelope(tasks, null) } });
}

/** Presses Tab until the target has focus; fails if it is never reached. */
async function tabTo(user: User, target: HTMLElement, maxSteps = 100): Promise<void> {
  for (let i = 0; i < maxSteps; i += 1) {
    if (document.activeElement === target) return;
    await user.tab();
  }
  if (document.activeElement !== target) {
    throw new Error(`Tab never reached the target element within ${maxSteps} steps`);
  }
}

describe('landmarks and heading levels (AC-A11Y-01.7)', () => {
  it('exposes banner, navigation, main and complementary landmarks', () => {
    mountApp(storageWith([chapter()]));
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Task views' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Manor and progress' })).toBeInTheDocument();
  });

  it('has a single h1 and heading levels that never skip', () => {
    mountApp(storageWith([chapter()]));
    const headings = screen.getAllByRole('heading');
    const levels = headings.map((h) => Number(h.tagName.slice(1)));

    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Spectral Tasks' })).toBeInTheDocument();
    // Document order starts at h1 and each heading is at most one level deeper
    // than the one before it.
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]!).toBeLessThanOrEqual(levels[i - 1]! + 1);
    }
    expect(screen.getByRole('heading', { level: 2, name: 'Summon a spirit' })).toBeInTheDocument();
  });

  it('gives every section a heading, starting at h2 (design: sections have h2 headings)', () => {
    mountApp(storageWith([chapter()]));

    // Every named section (region) and the complementary column.
    const sections = [...screen.getAllByRole('region'), screen.getByRole('complementary')];
    // Spirits, Summon a spirit, and the complementary column.
    expect(sections.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('region', { name: 'Spirits' })).toBeInTheDocument();

    for (const section of sections) {
      const headings = within(section).queryAllByRole('heading');
      const label = section.getAttribute('aria-label') ?? section.tagName;
      expect(headings.length, `section "${label}" has no heading`).toBeGreaterThan(0);
      // The first heading in a section is an h2 (the page's only h1 is the title).
      expect(headings[0]!.tagName, `section "${label}" should start with an h2`).toBe('H2');
    }
  });
});

describe('every control has an accessible name (AC-A11Y-01.3)', () => {
  const CONTROL_ROLES = ['button', 'checkbox', 'combobox', 'textbox', 'searchbox', 'spinbutton'] as const;

  function expectAllNamed(root: HTMLElement | Document = document): number {
    let total = 0;
    for (const role of CONTROL_ROLES) {
      const elements = within(root as HTMLElement).queryAllByRole(role);
      for (const el of elements) {
        expect(el, `${role} without an accessible name: ${el.outerHTML.slice(0, 120)}`).toHaveAccessibleName();
        total += 1;
      }
    }
    return total;
  }

  const scenarios: Array<[string, () => FakeStorage]> = [
    ['empty store (Load demo data)', () => createFakeStorage()],
    [
      'user and demo tasks (icon-only edit/delete, Remove demo data)',
      () => storageWith([chapter(), lamp(), makeTask({ id: 'demo-1', title: 'Demo spirit', source: 'demo' })]),
    ],
    ['corrupted data (Dismiss notice)', () => createFakeStorage({ initial: { [STORAGE_KEY]: '{ broken' } })],
  ];

  it.each(scenarios)('%s', (_name, makeStorage) => {
    mountApp(makeStorage());
    expect(expectAllNamed()).toBeGreaterThan(0);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('names the icon-only edit and delete buttons after the task', () => {
    mountApp(storageWith([chapter()]));
    expect(screen.getByRole('button', { name: 'Edit spirit: Read chapter 4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete spirit: Read chapter 4' })).toBeInTheDocument();
  });

  it('names every button inside an open dialog', async () => {
    const user = userEvent.setup();
    mountApp(storageWith([chapter()]));
    await user.click(screen.getByRole('button', { name: 'Edit spirit: Read chapter 4' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit spirit' });
    expect(expectAllNamed(dialog)).toBeGreaterThan(0);
    expect(within(dialog).getAllByRole('button').length).toBeGreaterThanOrEqual(2);
  });
});

describe('state is conveyed as text, not color alone (AC-A11Y-01.9, AC-ORG-03.2)', () => {
  it('shows overdue, category and priority as text', async () => {
    const user = userEvent.setup();
    mountApp(storageWith([chapter(), lamp()]));
    await user.click(screen.getByRole('button', { name: 'All Tasks' }));

    const overdueRow = screen.getByText('Read chapter 4').closest('li')!;
    expect(within(overdueRow).getByText('Overdue')).toBeInTheDocument();
    expect(overdueRow).toHaveTextContent('Category: Study');
    expect(overdueRow).toHaveTextContent('Priority: High');
    expect(within(overdueRow).getByText('Active')).toBeInTheDocument();

    const plainRow = screen.getByText('Buy lamp oil').closest('li')!;
    expect(within(plainRow).queryByText('Overdue')).not.toBeInTheDocument();
    expect(plainRow).toHaveTextContent('Category: Personal');
    expect(plainRow).toHaveTextContent('Priority: Low');
  });

  it('shows completion as the word "Released"', async () => {
    const user = userEvent.setup();
    const done = makeCompletedOn('2026-06-14', {
      id: 'done',
      title: 'Polish the lantern',
      category: 'Health',
      priority: 'Medium',
    });
    mountApp(storageWith([done]));
    await user.click(screen.getByRole('button', { name: 'Completed' }));

    const row = screen.getByText('Polish the lantern').closest('li')!;
    expect(within(row).getByText('Released')).toBeInTheDocument();
    expect(row).toHaveTextContent('Category: Health');
    expect(row).toHaveTextContent('Priority: Medium');
    expect(within(row).queryByText('Overdue')).not.toBeInTheDocument();
  });
});

describe('keyboard-only flows (AC-A11Y-01.1, .5, .6)', () => {
  it('creates a task with Enter, switches view with Enter and completes with Space', async () => {
    const user = userEvent.setup();
    mountApp(storageWith([chapter()]));

    // Create: Tab to the title, type, Enter submits the form.
    const form = screen.getByRole('form', { name: /summon a spirit/i });
    const title = within(form).getByLabelText('Title');
    await tabTo(user, title);
    await user.keyboard('Water the ghost plants');
    await user.keyboard('{Enter}');
    expect(screen.getByText('Spirit summoned')).toBeInTheDocument();
    expect(title).toHaveValue('');
    expect(title).toHaveFocus();

    // Switch to All Tasks with the keyboard (the new task is undated).
    const allTasks = screen.getByRole('button', { name: 'All Tasks' });
    await tabTo(user, allTasks);
    await user.keyboard('{Enter}');
    expect(allTasks).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Water the ghost plants')).toBeInTheDocument();

    // Complete with Space on the checkbox.
    const checkbox = screen.getByRole('checkbox', { name: 'Release spirit: Water the ghost plants' });
    await tabTo(user, checkbox);
    await user.keyboard(' ');
    expect(screen.getByText('Spirit released: Water the ghost plants')).toBeInTheDocument();
    expect(screen.queryByText('Water the ghost plants')).not.toBeInTheDocument();

    // Find it in Completed, again by keyboard, with the completion shown as text.
    const completed = screen.getByRole('button', { name: 'Completed' });
    await tabTo(user, completed);
    await user.keyboard('{Enter}');
    const row = screen.getByText('Water the ghost plants').closest('li')!;
    expect(within(row).getByText('Released')).toBeInTheDocument();
    expect(
      within(row).getByRole('checkbox', { name: 'Reopen spirit: Water the ghost plants' }),
    ).toBeChecked();
  });

  it('edit: Escape discards changes and returns focus to the opener; Enter on Save keeps them', async () => {
    const user = userEvent.setup();
    mountApp(storageWith([chapter()]));

    const editButton = screen.getByRole('button', { name: 'Edit spirit: Read chapter 4' });
    await tabTo(user, editButton);
    await user.keyboard('{Enter}');

    // The dialog opens with focus on its first field, prefilled.
    let dialog = screen.getByRole('dialog', { name: 'Edit spirit' });
    expect(within(dialog).getByLabelText('Title')).toHaveFocus();
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Read chapter 4');

    // Type a change, then Escape: closes without saving, focus returns to opener.
    await user.keyboard('{Control>}a{/Control}Scratch change');
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Scratch change');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Read chapter 4')).toBeInTheDocument();
    expect(screen.queryByText('Scratch change')).not.toBeInTheDocument();
    expect(editButton).toHaveFocus();

    // Reopen from the same focus position; the discarded text is gone.
    await user.keyboard('{Enter}');
    dialog = screen.getByRole('dialog', { name: 'Edit spirit' });
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Read chapter 4');

    // Change the title and save with Tab + Enter.
    await user.keyboard('{Control>}a{/Control}Reviewed chapter 4');
    await tabTo(user, within(dialog).getByRole('button', { name: 'Save spirit' }));
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Reviewed chapter 4')).toBeInTheDocument();
    expect(screen.getByText('Spirit updated')).toBeInTheDocument();
    // Focus returns to the same (renamed) edit button.
    expect(screen.getByRole('button', { name: 'Edit spirit: Reviewed chapter 4' })).toHaveFocus();
  });

  it('delete: Escape cancels and returns focus; Space on Banish confirms', async () => {
    const user = userEvent.setup();
    mountApp(storageWith([chapter()]));

    const deleteButton = screen.getByRole('button', { name: 'Delete spirit: Read chapter 4' });
    await tabTo(user, deleteButton);
    await user.keyboard('{Enter}');

    let dialog = screen.getByRole('alertdialog', { name: 'Banish this spirit?' });
    expect(dialog).toHaveTextContent('Read chapter 4');

    // Escape cancels: the task stays and focus returns to the Delete button.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Read chapter 4')).toBeInTheDocument();
    expect(deleteButton).toHaveFocus();

    // Open again and confirm using Tab + Space.
    await user.keyboard('{Enter}');
    dialog = screen.getByRole('alertdialog', { name: 'Banish this spirit?' });
    await tabTo(user, within(dialog).getByRole('button', { name: 'Banish' }));
    await user.keyboard(' ');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Read chapter 4')).not.toBeInTheDocument();
    expect(screen.getByText('Spirit banished')).toBeInTheDocument();
  });

  it('filter: typing narrows the list and Enter on Clear filters restores it', async () => {
    const user = userEvent.setup();
    mountApp(storageWith([chapter(), lamp()]));

    const allTasks = screen.getByRole('button', { name: 'All Tasks' });
    await tabTo(user, allTasks);
    await user.keyboard('{Enter}');
    expect(screen.getByText('Read chapter 4')).toBeInTheDocument();
    expect(screen.getByText('Buy lamp oil')).toBeInTheDocument();

    const search = screen.getByRole('searchbox', { name: 'Search spirits by title' });
    await tabTo(user, search);
    await user.keyboard('chapter');
    expect(screen.getByText('Read chapter 4')).toBeInTheDocument();
    expect(screen.queryByText('Buy lamp oil')).not.toBeInTheDocument();

    const clear = screen.getByRole('button', { name: /clear filters/i });
    expect(clear).toBeEnabled();
    await tabTo(user, clear);
    await user.keyboard('{Enter}');
    expect(search).toHaveValue('');
    expect(screen.getByText('Buy lamp oil')).toBeInTheDocument();
  });
});
