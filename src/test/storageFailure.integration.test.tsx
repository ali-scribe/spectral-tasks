import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mountApp, fixedClock } from './mountApp.tsx';
import { createFakeStorage } from './fakeStorage.ts';
import { makeTask } from './factories.ts';
import { STORAGE_KEY, BACKUP_KEY, SCHEMA_VERSION } from '../domain/constants.ts';

// Task 14.1: storage-failure scenarios through the full app. Every test mounts
// App via the same bootstrap as main.tsx (mountApp), against a recording
// fakeStorage, and asserts on the call log and on what the UI shows.

type User = ReturnType<typeof userEvent.setup>;

/** The notice element (role status/alert) that contains the given text. */
function noticeWith(text: RegExp | string): HTMLElement {
  const el = screen.getByText(text).closest('[role="status"], [role="alert"]');
  if (!el) throw new Error(`No notice container found around text: ${String(text)}`);
  return el as HTMLElement;
}

async function summon(user: User, title: string): Promise<void> {
  const form = screen.getByRole('form', { name: /summon a spirit/i });
  await user.type(within(form).getByLabelText('Title'), title);
  await user.click(within(form).getByRole('button', { name: /summon spirit/i }));
}

async function showAllTasks(user: User): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'All Tasks' }));
}

describe('EC-9: truncated JSON (AC-PERS-02.1, .3, .4)', () => {
  it('backs up the raw value, replaces the primary with an empty envelope, and shows a dismissible notice', async () => {
    const user = userEvent.setup();
    const raw = '{"schemaVersion":1,"tasks":[{"id":"t1","title":"Cut off mid-';
    const storage = createFakeStorage({ initial: { [STORAGE_KEY]: raw } });

    mountApp(storage);

    // Backup holds the exact raw truncated string.
    expect(storage.peek(BACKUP_KEY)).toBe(raw);
    // Primary now holds a valid empty envelope.
    expect(JSON.parse(storage.peek(STORAGE_KEY)!)).toEqual({
      schemaVersion: SCHEMA_VERSION,
      tasks: [],
      lastGoalCelebrationDate: null,
    });
    // Six-step order: backup written first, then the primary.
    const writes = storage.setCalls();
    expect(writes.map((c) => c.key)).toEqual([BACKUP_KEY, STORAGE_KEY]);
    expect(writes[0]!.value).toBe(raw);

    // Empty store: the welcoming empty state is shown.
    expect(screen.getByText(/manor stands silent/i)).toBeInTheDocument();

    // The corruption notice is dismissible.
    const notice = noticeWith(/started fresh/i);
    await user.click(within(notice).getByRole('button', { name: /dismiss notice/i }));
    expect(screen.queryByText(/started fresh/i)).not.toBeInTheDocument();
    // Dismissing does not touch storage.
    expect(storage.setCalls()).toHaveLength(2);
  });
});

describe('EC-10: one of ten stored tasks is invalid (AC-PERS-02.5)', () => {
  it('loads nine tasks and reports exactly one discarded', () => {
    const tasks: unknown[] = Array.from({ length: 10 }, (_, i) => makeTask({ id: `ec10-${i}` }));
    tasks[4] = { ...makeTask({ id: 'ec10-bad' }), category: 'Wizardry' };
    const raw = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      tasks,
      lastGoalCelebrationDate: null,
    });
    const storage = createFakeStorage({ initial: { [STORAGE_KEY]: raw } });

    mountApp(storage);

    // Exact discarded count in the notice.
    expect(screen.getByText('1 stored spirit could not be read and was discarded.')).toBeInTheDocument();
    // Nine tasks loaded.
    expect(screen.getByText('9', { selector: '.count__value' })).toBeInTheDocument();
  });

  it('shows the nine valid tasks in the list', async () => {
    const user = userEvent.setup();
    const tasks: unknown[] = Array.from({ length: 10 }, (_, i) => makeTask({ id: `ec10b-${i}` }));
    tasks[0] = { ...makeTask({ id: 'ec10b-bad' }), priority: 'Urgent' };
    const storage = createFakeStorage({
      initial: {
        [STORAGE_KEY]: JSON.stringify({ schemaVersion: SCHEMA_VERSION, tasks, lastGoalCelebrationDate: null }),
      },
    });

    mountApp(storage);
    await showAllTasks(user);

    expect(screen.getAllByRole('checkbox', { name: /release spirit:/i })).toHaveLength(9);
  });
});

describe('EC-11: newer schema version (AC-PERS-02.6, .18)', () => {
  it('makes no write to any key, stays read-only, and shows a persistent notice', async () => {
    const user = userEvent.setup();
    const raw = JSON.stringify({
      schemaVersion: SCHEMA_VERSION + 1,
      tasks: [makeTask({ id: 'future-1', title: 'From the future' })],
      lastGoalCelebrationDate: null,
    });
    const storage = createFakeStorage({ initial: { [STORAGE_KEY]: raw } });

    mountApp(storage);

    // Persistent notice: no dismiss control.
    const notice = noticeWith(/newer version of Spectral Tasks/i);
    expect(within(notice).queryByRole('button')).not.toBeInTheDocument();

    // Zero setItem (and removeItem) calls on any key during load.
    const mutations = () => storage.calls.filter((c) => c.op !== 'getItem');
    expect(mutations()).toHaveLength(0);

    // Read-only mode still allows in-memory work, but nothing is ever written.
    await summon(user, 'Only in memory');
    await showAllTasks(user);
    expect(screen.getByText('Only in memory')).toBeInTheDocument();
    expect(mutations()).toHaveLength(0);
    expect(storage.peek(STORAGE_KEY)).toBe(raw);
    expect(storage.peek(BACKUP_KEY)).toBeNull();
    // The notice is still there after the change.
    expect(screen.getByText(/newer version of Spectral Tasks/i)).toBeInTheDocument();
  });
});

describe('EC-12: LocalStorage unavailable (AC-PERS-02.8, "reading or writing")', () => {
  it('works in memory with a persistent notice when getItem throws', async () => {
    const user = userEvent.setup();
    const storage = createFakeStorage({ throwOnGet: true });

    mountApp(storage);

    const notice = noticeWith(/changes will not be saved/i);
    expect(within(notice).queryByRole('button')).not.toBeInTheDocument();

    await summon(user, 'Unsaved spirit');
    await showAllTasks(user);
    expect(screen.getByText('Unsaved spirit')).toBeInTheDocument();
    // Nothing was ever written.
    expect(storage.setCalls()).toHaveLength(0);
  });

  it('works in memory with a persistent notice when setItem throws', async () => {
    const user = userEvent.setup();
    const storage = createFakeStorage({ throwOnSet: true, setErrorKind: 'generic' });

    mountApp(storage);
    // Reading succeeds (first run), so there is no notice yet.
    expect(screen.queryByText(/changes will not be saved/i)).not.toBeInTheDocument();

    await summon(user, 'First spirit');
    // The failed write switches the app to memory-only with a persistent notice.
    const notice = noticeWith(/changes will not be saved/i);
    expect(within(notice).queryByRole('button')).not.toBeInTheDocument();

    await showAllTasks(user);
    expect(screen.getByText('First spirit')).toBeInTheDocument();

    // Further changes keep working in memory and are not written again.
    await summon(user, 'Second spirit');
    expect(screen.getByText('Second spirit')).toBeInTheDocument();
    expect(storage.setCalls()).toHaveLength(1);
    expect(storage.peek(STORAGE_KEY)).toBeNull();
  });
});

describe('EC-13: quota exceeded on write (AC-PERS-02.9)', () => {
  it('keeps the change in memory and shows an error notice', async () => {
    const user = userEvent.setup();

    // The fake throws a DOMException named QuotaExceededError.
    const probe = createFakeStorage({ throwOnSet: true, setErrorKind: 'quota' });
    let thrown: unknown;
    try {
      probe.setItem('probe', 'x');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DOMException);
    expect((thrown as DOMException).name).toBe('QuotaExceededError');

    const storage = createFakeStorage({ throwOnSet: true, setErrorKind: 'quota' });
    mountApp(storage);

    await summon(user, 'Too big to save');

    // Error notice (role=alert), dismissible because quota is not persistent.
    const notice = noticeWith(/Storage is full/i);
    expect(notice).toHaveAttribute('role', 'alert');
    expect(within(notice).getByRole('button', { name: /dismiss notice/i })).toBeInTheDocument();

    // The change stays in memory.
    await showAllTasks(user);
    expect(screen.getByText('Too big to save')).toBeInTheDocument();
    // A write was attempted, none succeeded.
    expect(storage.setCalls()).toHaveLength(1);
    expect(storage.peek(STORAGE_KEY)).toBeNull();

    // Quota does not disable persistence: the next change retries the write,
    // and the notice is not duplicated.
    await summon(user, 'Second attempt');
    expect(storage.setCalls()).toHaveLength(2);
    expect(screen.getAllByText(/Storage is full/i)).toHaveLength(1);
  });
});

describe('EC-28: backup write fails (AC-PERS-02.4, .15)', () => {
  it('leaves the primary untouched, is read-only, and still allows in-memory work', async () => {
    const user = userEvent.setup();
    const raw = '{ this is corrupted';
    const storage = createFakeStorage({
      initial: { [STORAGE_KEY]: raw },
      throwOnSetKeys: [BACKUP_KEY],
    });

    mountApp(storage);

    // Persistent error notice: no dismiss control.
    const notice = noticeWith(/could not be read or backed up/i);
    expect(notice).toHaveAttribute('role', 'alert');
    expect(within(notice).queryByRole('button')).not.toBeInTheDocument();

    // No write succeeded: the backup slot is empty and the primary is intact.
    expect(storage.peek(BACKUP_KEY)).toBeNull();
    expect(storage.peek(STORAGE_KEY)).toBe(raw);
    // The only write attempt was the failed backup; the primary was never written.
    expect(storage.setCalls().every((c) => c.key === BACKUP_KEY)).toBe(true);

    // In-memory task creation still works.
    await summon(user, 'Made in memory');
    await showAllTasks(user);
    expect(screen.getByText('Made in memory')).toBeInTheDocument();

    // Still no successful write, and the primary is still the original value.
    expect(storage.peek(BACKUP_KEY)).toBeNull();
    expect(storage.peek(STORAGE_KEY)).toBe(raw);
    expect(storage.setCalls().some((c) => c.key === STORAGE_KEY)).toBe(false);
  });
});

describe('persistence round trip across a true remount (AC-PERS-01.1, .2)', () => {
  it('re-reads storage on remount and restores tasks, completion, category and priority', async () => {
    const user = userEvent.setup();
    const storage = createFakeStorage();

    // --- First mount: create two tasks, complete one. ---
    const first = mountApp(storage);

    const form = screen.getByRole('form', { name: /summon a spirit/i });
    await user.type(within(form).getByLabelText('Title'), 'Alpha spirit');
    await user.selectOptions(within(form).getByLabelText('Category'), 'Study');
    await user.selectOptions(within(form).getByLabelText('Priority'), 'High');
    await user.click(within(form).getByRole('button', { name: /summon spirit/i }));
    await summon(user, 'Beta spirit');

    await showAllTasks(user);
    await user.click(screen.getByRole('checkbox', { name: /release spirit: alpha spirit/i }));

    // What reached storage.
    const persisted = JSON.parse(storage.peek(STORAGE_KEY)!) as {
      schemaVersion: number;
      tasks: Array<{ title: string; status: string; completedAt: string | null; category: string; priority: string }>;
      lastGoalCelebrationDate: string | null;
    };
    expect(persisted.schemaVersion).toBe(SCHEMA_VERSION);
    expect(persisted.tasks.map((t) => t.title)).toEqual(['Alpha spirit', 'Beta spirit']);
    const alpha = persisted.tasks[0]!;
    expect(alpha).toMatchObject({ status: 'completed', category: 'Study', priority: 'High' });
    expect(alpha.completedAt).toBe(fixedClock().toISOString());

    // --- Unmount everything; nothing survives in memory. ---
    first.unmount();
    expect(screen.queryByText('Beta spirit')).not.toBeInTheDocument();
    const readsBefore = storage.calls.filter((c) => c.op === 'getItem' && c.key === STORAGE_KEY).length;
    const writesBefore = storage.setCalls().length;

    // --- Second mount: a fresh bootstrap must re-read storage. ---
    mountApp(storage);

    const readsAfter = storage.calls.filter((c) => c.op === 'getItem' && c.key === STORAGE_KEY).length;
    expect(readsAfter).toBeGreaterThan(readsBefore);
    // Loading what was just saved writes nothing new.
    expect(storage.setCalls()).toHaveLength(writesBefore);

    // Restored counts and daily progress (derived, not persisted).
    expect(screen.getByText(/1 of 3/)).toBeInTheDocument();
    const counts = Array.from(document.querySelectorAll('.count__value')).map((el) => el.textContent);
    expect(counts).toEqual(['1', '1']);

    // Active task came back.
    await showAllTasks(user);
    expect(screen.getByText('Beta spirit')).toBeInTheDocument();
    expect(screen.queryByText('Alpha spirit')).not.toBeInTheDocument();

    // Completed task came back as completed, with its category and priority.
    await user.click(screen.getByRole('button', { name: 'Completed' }));
    const row = screen.getByText('Alpha spirit').closest('li')!;
    expect(within(row).getByText('Released')).toBeInTheDocument();
    expect(row).toHaveTextContent('Category: Study');
    expect(row).toHaveTextContent('Priority: High');
  });
});
