import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { reducer } from './reducer.ts';
import type { Action } from './actions.ts';
import { createInitialState } from './initialState.ts';
import type { AppState, Task } from '../domain/types.ts';
import type { ValidTaskInput } from '../domain/validation.ts';
import type { LoadResult } from '../storage/storageService.ts';
import { makeTask, makeCompletedOn } from '../test/factories.ts';

const TODAY = '2026-06-15';

function stateWith(tasks: Task[] = [], lastGoalCelebrationDate: string | null = null): AppState {
  const load: LoadResult = { tasks, lastGoalCelebrationDate, storageMode: 'normal', notices: [] };
  return createInitialState(load, TODAY);
}

const validInput: ValidTaskInput = {
  title: 'New spirit',
  description: '',
  category: 'Study',
  priority: 'High',
  dueDate: null,
  estimatedMinutes: null,
};

function completedTodayIso(): string {
  // Noon local on TODAY.
  return new Date(2026, 5, 15, 12, 0, 0).toISOString();
}

describe('reducer - basic task actions', () => {
  it('CREATE_TASK adds a task, summons the ghost and announces', () => {
    const next = reducer(stateWith(), { type: 'CREATE_TASK', input: validInput, id: 'a', nowIso: completedTodayIso() });
    expect(next.tasks).toHaveLength(1);
    expect(next.ghost.kind).toBe('summon');
    expect(next.announcement?.text).toBe('Spirit summoned');
  });

  it('UPDATE_TASK edits and preserves immutable fields; unknown id is a no-op', () => {
    const t = makeTask({ id: 't1', status: 'completed', completedAt: completedTodayIso() });
    const s = stateWith([t]);
    const next = reducer(s, { type: 'UPDATE_TASK', id: 't1', input: { ...validInput, title: 'Edited' } });
    expect(next.tasks[0]!.title).toBe('Edited');
    expect(next.tasks[0]!.status).toBe('completed');
    expect(reducer(s, { type: 'UPDATE_TASK', id: 'nope', input: validInput })).toBe(s);
  });

  it('DELETE_TASK removes a task; unknown id is a no-op', () => {
    const t = makeTask({ id: 't1' });
    const s = stateWith([t]);
    expect(reducer(s, { type: 'DELETE_TASK', id: 't1' }).tasks).toHaveLength(0);
    expect(reducer(s, { type: 'DELETE_TASK', id: 'nope' })).toBe(s);
  });

  it('REOPEN_TASK clears completion and does not celebrate', () => {
    const t = makeTask({ id: 't1', status: 'completed', completedAt: completedTodayIso() });
    const s = stateWith([t]);
    const next = reducer(s, { type: 'REOPEN_TASK', id: 't1' });
    expect(next.tasks[0]!.status).toBe('active');
    expect(next.tasks[0]!.completedAt).toBeNull();
    expect(next.ghost.kind).toBe('idle');
  });
});

describe('reducer - demo data', () => {
  it('LOAD_DEMO is ignored when tasks already exist (EC-19)', () => {
    const s = stateWith([makeTask()]);
    const demo = makeTask({ id: 'd', source: 'demo' });
    expect(reducer(s, { type: 'LOAD_DEMO', tasks: [demo] })).toBe(s);
  });

  it('LOAD_DEMO loads when empty; REMOVE_DEMO removes demo tasks only', () => {
    const demo = makeTask({ id: 'd', source: 'demo' });
    const loaded = reducer(stateWith(), { type: 'LOAD_DEMO', tasks: [demo] });
    expect(loaded.tasks).toHaveLength(1);
    const user = makeTask({ id: 'u', source: 'user' });
    const mixed = stateWith([demo, user]);
    const removed = reducer(mixed, { type: 'REMOVE_DEMO' });
    expect(removed.tasks.map((t) => t.id)).toEqual(['u']);
  });
});

describe('reducer - ghost sequence (AC-GHOST-01.6)', () => {
  it('a new reaction replaces the old; a stale GHOST_IDLE is ignored', () => {
    let s = stateWith();
    s = reducer(s, { type: 'CREATE_TASK', input: validInput, id: 'a', nowIso: completedTodayIso() });
    const staleSeq = s.ghost.seq;
    s = reducer(s, { type: 'CREATE_TASK', input: validInput, id: 'b', nowIso: completedTodayIso() });
    // Stale idle (old seq) does nothing.
    const afterStale = reducer(s, { type: 'GHOST_IDLE', seq: staleSeq });
    expect(afterStale.ghost.kind).toBe('summon');
    // Matching idle resets.
    const afterIdle = reducer(s, { type: 'GHOST_IDLE', seq: s.ghost.seq });
    expect(afterIdle.ghost.kind).toBe('idle');
  });
});

describe('reducer - daily goal celebration', () => {
  function completeThree(fromState: AppState): AppState {
    let s = fromState;
    for (let i = 0; i < 3; i += 1) {
      s = reducer(s, { type: 'CREATE_TASK', input: validInput, id: `t${i}`, nowIso: completedTodayIso() });
    }
    for (let i = 0; i < 3; i += 1) {
      s = reducer(s, { type: 'COMPLETE_TASK', id: `t${i}`, nowIso: completedTodayIso(), today: TODAY });
    }
    return s;
  }

  it('plays the goal celebration on the third completion (AC-GHOST-01.3)', () => {
    const s = completeThree(stateWith());
    expect(s.ghost.kind).toBe('goal');
    expect(s.lastGoalCelebrationDate).toBe(TODAY);
  });

  it('does not celebrate twice the same day after reopen and re-complete (EC-8)', () => {
    let s = completeThree(stateWith());
    expect(s.ghost.kind).toBe('goal');
    s = reducer(s, { type: 'REOPEN_TASK', id: 't2' });
    s = reducer(s, { type: 'COMPLETE_TASK', id: 't2', nowIso: completedTodayIso(), today: TODAY });
    // Ordinary celebrate, not a second goal.
    expect(s.ghost.kind).toBe('celebrate');
  });

  it('allows a new celebration on a new local day (EC-26)', () => {
    let s = completeThree(stateWith());
    const tomorrow = '2026-06-16';
    const tomorrowNoon = new Date(2026, 5, 16, 12, 0, 0).toISOString();
    // Three completions tomorrow (create then complete with tomorrow's date).
    for (let i = 0; i < 3; i += 1) {
      s = reducer(s, { type: 'CREATE_TASK', input: validInput, id: `n${i}`, nowIso: tomorrowNoon });
    }
    for (let i = 0; i < 3; i += 1) {
      s = reducer(s, { type: 'COMPLETE_TASK', id: `n${i}`, nowIso: tomorrowNoon, today: tomorrow });
    }
    expect(s.ghost.kind).toBe('goal');
    expect(s.lastGoalCelebrationDate).toBe(tomorrow);
  });

  it('EC-33: goal celebration message replaces the ordinary one and still announces', () => {
    const s = completeThree(stateWith());
    expect(s.ghost.kind).toBe('goal');
    expect(s.announcement?.text).toMatch(/^Spirit released: /);
  });
});

describe('reducer - load and date check (AC-GHOST-01.10, .15, EC-25, EC-32)', () => {
  it('EC-25: loading with three completed today records silently, no celebration', () => {
    const three = [
      makeCompletedOn(TODAY),
      makeCompletedOn(TODAY),
      makeCompletedOn(TODAY),
    ];
    const s = stateWith(three);
    expect(s.ghost.kind).toBe('idle');
    expect(s.lastGoalCelebrationDate).toBe(TODAY);
  });

  it('EC-32: a DATE_CHECK after a goal completion in the same interaction does not undo the celebration', () => {
    let s = stateWith();
    for (let i = 0; i < 3; i += 1) {
      s = reducer(s, { type: 'CREATE_TASK', input: validInput, id: `t${i}`, nowIso: completedTodayIso() });
    }
    for (let i = 0; i < 2; i += 1) {
      s = reducer(s, { type: 'COMPLETE_TASK', id: `t${i}`, nowIso: completedTodayIso(), today: TODAY });
    }
    // Third completion triggers goal.
    s = reducer(s, { type: 'COMPLETE_TASK', id: 't2', nowIso: completedTodayIso(), today: TODAY });
    expect(s.ghost.kind).toBe('goal');
    // A same-interaction DATE_CHECK sees the date already recorded: no change.
    const after = reducer(s, { type: 'DATE_CHECK', today: TODAY });
    expect(after.ghost.kind).toBe('goal');
    expect(after.lastGoalCelebrationDate).toBe(TODAY);
  });

  it('DATE_CHECK updates today without a reload', () => {
    const s = stateWith();
    const next = reducer(s, { type: 'DATE_CHECK', today: '2026-06-16' });
    expect(next.today).toBe('2026-06-16');
  });
});

describe('reducer - manor notice (AC-MANOR-01.6, .11)', () => {
  it('announces a stage increase on completion but not on load', () => {
    // Four active tasks; completing the first reaches stage 1 (1 completed).
    const tasks = [0, 1, 2, 3].map((i) => makeTask({ id: `m${i}` }));
    const s = stateWith(tasks);
    expect(s.manorNotice).toBeNull(); // no notice on load
    const next = reducer(s, { type: 'COMPLETE_TASK', id: 'm0', nowIso: completedTodayIso(), today: TODAY });
    expect(next.manorNotice).not.toBeNull();
    expect(next.manorNotice?.stage).toBe(1);
  });

  it('does not announce on regression (reopen)', () => {
    const t = makeCompletedOn(TODAY, { id: 'c0' });
    const s = stateWith([t]);
    const next = reducer(s, { type: 'REOPEN_TASK', id: 'c0' });
    expect(next.manorNotice).toBe(s.manorNotice);
  });
});

describe('reducer - PERSIST_RESULT (AC-PERS-02.8, .9)', () => {
  it('quota adds a dismissible error notice and keeps changes', () => {
    const s = stateWith([makeTask()]);
    const next = reducer(s, { type: 'PERSIST_RESULT', result: { status: 'quota' } });
    expect(next.notices.some((n) => n.id === 'quota')).toBe(true);
    expect(next.tasks).toEqual(s.tasks);
  });

  it('unavailable switches to memory-only with a persistent notice', () => {
    const s = stateWith();
    const next = reducer(s, { type: 'PERSIST_RESULT', result: { status: 'unavailable' } });
    expect(next.storageMode).toBe('memoryOnly');
    expect(next.notices.some((n) => n.id === 'storage-unavailable' && n.persistent)).toBe(true);
  });

  it('ok and skipped leave state unchanged', () => {
    const s = stateWith();
    expect(reducer(s, { type: 'PERSIST_RESULT', result: { status: 'ok' } })).toBe(s);
    expect(reducer(s, { type: 'PERSIST_RESULT', result: { status: 'skipped' } })).toBe(s);
  });

  it('de-duplicates notices by id', () => {
    let s = stateWith();
    s = reducer(s, { type: 'PERSIST_RESULT', result: { status: 'quota' } });
    s = reducer(s, { type: 'PERSIST_RESULT', result: { status: 'quota' } });
    expect(s.notices.filter((n) => n.id === 'quota')).toHaveLength(1);
  });
});

describe('reducer - view and filter actions', () => {
  it('SET_VIEW keeps filters (AC-ORG-02.8)', () => {
    let s = stateWith();
    s = reducer(s, { type: 'SET_FILTERS', filters: { search: 'ghost' } });
    const next = reducer(s, { type: 'SET_VIEW', view: 'completed' });
    expect(next.ui.view).toBe('completed');
    expect(next.ui.filters.search).toBe('ghost');
  });

  it('CLEAR_FILTERS resets all three', () => {
    let s = stateWith();
    s = reducer(s, { type: 'SET_FILTERS', filters: { search: 'x', category: 'Work', priority: 'High' } });
    const next = reducer(s, { type: 'CLEAR_FILTERS' });
    expect(next.ui.filters).toEqual({ search: '', category: 'all', priority: 'all' });
  });

  it('OPEN_EDIT / CLOSE_EDIT track the editing id', () => {
    const t = makeTask({ id: 'e1' });
    let s = stateWith([t]);
    s = reducer(s, { type: 'OPEN_EDIT', id: 'e1' });
    expect(s.ui.editingId).toBe('e1');
    s = reducer(s, { type: 'CLOSE_EDIT' });
    expect(s.ui.editingId).toBeNull();
  });
});

// ---- Property-based reducer tests ----

type SeqAction =
  | { kind: 'create' }
  | { kind: 'complete'; index: number }
  | { kind: 'reopen'; index: number }
  | { kind: 'delete'; index: number }
  | { kind: 'dateCheck'; dayOffset: number };

function applySequence(actions: SeqAction[]): { states: AppState[]; days: string[] } {
  let s = stateWith();
  let created = 0;
  let day = 0;
  const states: AppState[] = [s];
  const days: string[] = [];
  const dayString = (offset: number) => {
    const d = new Date(2026, 5, 15 + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const nowIso = (offset: number) => new Date(2026, 5, 15 + offset, 12, 0, 0).toISOString();

  for (const a of actions) {
    const today = dayString(day);
    let action: Action | null = null;
    if (a.kind === 'create') {
      action = { type: 'CREATE_TASK', input: validInput, id: `t${created++}`, nowIso: nowIso(day) };
    } else if (a.kind === 'dateCheck') {
      day = Math.max(day, a.dayOffset);
      action = { type: 'DATE_CHECK', today: dayString(day) };
    } else {
      const ids = s.tasks.map((t) => t.id);
      if (ids.length === 0) continue;
      const id = ids[a.index % ids.length]!;
      if (a.kind === 'complete') action = { type: 'COMPLETE_TASK', id, nowIso: nowIso(day), today };
      else if (a.kind === 'reopen') action = { type: 'REOPEN_TASK', id };
      else action = { type: 'DELETE_TASK', id };
    }
    if (action) {
      s = reducer(s, action);
      states.push(s);
      days.push(s.today);
    }
  }
  return { states, days };
}

const arbSeqAction: fc.Arbitrary<SeqAction> = fc.oneof(
  fc.constant<SeqAction>({ kind: 'create' }),
  fc.record({ index: fc.nat(10) }).map((m) => ({ kind: 'complete', ...m } as SeqAction)),
  fc.record({ index: fc.nat(10) }).map((m) => ({ kind: 'reopen', ...m } as SeqAction)),
  fc.record({ index: fc.nat(10) }).map((m) => ({ kind: 'delete', ...m } as SeqAction)),
  fc.record({ dayOffset: fc.integer({ min: 0, max: 3 }) }).map((m) => ({ kind: 'dateCheck', ...m } as SeqAction)),
);

// Property 8: Completion timestamp matches status
// Validates: Requirements 1.4, 4.1, 4.2, 4.4, 13.2, 13.3
describe('Property 8: completion timestamp matches status', () => {
  it('completedAt is non-null iff completed, and ids stay unique', () => {
    fc.assert(
      fc.property(fc.array(arbSeqAction, { maxLength: 40 }), (actions) => {
        const { states } = applySequence(actions);
        return states.every((s) => {
          const ids = new Set(s.tasks.map((t) => t.id));
          if (ids.size !== s.tasks.length) return false;
          return s.tasks.every((t) =>
            t.status === 'completed' ? t.completedAt !== null : t.completedAt === null,
          );
        });
      }),
    );
  });
});

// Property 22: Daily goal celebration plays at most once per local day
// Validates: Requirements 11.3, 11.8, 11.11, 11.13
describe('Property 22: daily goal celebration at most once per local day', () => {
  it('counts at most one goal transition per distinct day', () => {
    fc.assert(
      fc.property(fc.array(arbSeqAction, { maxLength: 60 }), (actions) => {
        let s = stateWith();
        let created = 0;
        let day = 0;
        const goalDays: string[] = [];
        const dayString = (offset: number) => {
          const d = new Date(2026, 5, 15 + offset);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const nowIso = (offset: number) => new Date(2026, 5, 15 + offset, 12, 0, 0).toISOString();

        for (const a of actions) {
          const today = dayString(day);
          const prevKind = s.ghost.kind;
          let action: Action | null = null;
          if (a.kind === 'create') {
            action = { type: 'CREATE_TASK', input: validInput, id: `t${created++}`, nowIso: nowIso(day) };
          } else if (a.kind === 'dateCheck') {
            day = Math.max(day, a.dayOffset);
            action = { type: 'DATE_CHECK', today: dayString(day) };
          } else {
            const ids = s.tasks.map((t) => t.id);
            if (ids.length === 0) continue;
            const id = ids[a.index % ids.length]!;
            if (a.kind === 'complete') action = { type: 'COMPLETE_TASK', id, nowIso: nowIso(day), today };
            else if (a.kind === 'reopen') action = { type: 'REOPEN_TASK', id };
            else action = { type: 'DELETE_TASK', id };
          }
          if (!action) continue;
          const nowToday = action.type === 'COMPLETE_TASK' ? action.today : today;
          s = reducer(s, action);
          // A new goal transition happened on this completion.
          if (action.type === 'COMPLETE_TASK' && s.ghost.kind === 'goal' && prevKind !== 'goal') {
            goalDays.push(nowToday);
          } else if (action.type === 'COMPLETE_TASK' && s.ghost.kind === 'goal' && prevKind === 'goal') {
            // Replaced a goal with another goal: only valid if the day changed.
            goalDays.push(nowToday);
          }
        }
        // At most one goal per distinct day.
        const counts = new Map<string, number>();
        for (const d of goalDays) counts.set(d, (counts.get(d) ?? 0) + 1);
        return [...counts.values()].every((c) => c <= 1);
      }),
    );
  });
});

// Property 23: Only completions can celebrate
// Validates: Requirements 11.7, 11.10, 11.15, 15.11
describe('Property 23: only completions can celebrate', () => {
  it('non-completion actions never set the ghost to goal or celebrate', () => {
    fc.assert(
      fc.property(fc.array(arbSeqAction, { maxLength: 50 }), (actions) => {
        let s = stateWith();
        let created = 0;
        let day = 0;
        const dayString = (offset: number) => {
          const d = new Date(2026, 5, 15 + offset);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const nowIso = (offset: number) => new Date(2026, 5, 15 + offset, 12, 0, 0).toISOString();

        for (const a of actions) {
          const today = dayString(day);
          const before = s.ghost;
          let action: Action | null = null;
          if (a.kind === 'create') {
            action = { type: 'CREATE_TASK', input: validInput, id: `t${created++}`, nowIso: nowIso(day) };
          } else if (a.kind === 'dateCheck') {
            day = Math.max(day, a.dayOffset);
            action = { type: 'DATE_CHECK', today: dayString(day) };
          } else {
            const ids = s.tasks.map((t) => t.id);
            if (ids.length === 0) continue;
            const id = ids[a.index % ids.length]!;
            if (a.kind === 'complete') action = { type: 'COMPLETE_TASK', id, nowIso: nowIso(day), today };
            else if (a.kind === 'reopen') action = { type: 'REOPEN_TASK', id };
            else action = { type: 'DELETE_TASK', id };
          }
          if (!action) continue;
          s = reducer(s, action);
          if (action.type !== 'COMPLETE_TASK') {
            // The ghost kind must not newly become goal/celebrate from a non-completion.
            if ((s.ghost.kind === 'goal' || s.ghost.kind === 'celebrate') && s.ghost.seq !== before.seq) {
              // create legitimately sets summon, not goal/celebrate; so any goal/celebrate here is a failure.
              return false;
            }
          }
        }
        return true;
      }),
    );
  });

  it('a date check or load at/above the goal records silently without celebrating', () => {
    const three = [makeCompletedOn(TODAY), makeCompletedOn(TODAY), makeCompletedOn(TODAY)];
    const loaded = stateWith(three);
    expect(loaded.ghost.kind).toBe('idle');
    expect(loaded.lastGoalCelebrationDate).toBe(TODAY);
    const afterCheck = reducer(stateWith(three, null), { type: 'DATE_CHECK', today: TODAY });
    expect(afterCheck.ghost.kind).toBe('idle');
  });
});

// Property 24: Goal celebration replaces the ordinary completion reaction
// Validates: Requirements 11.2, 11.16, 11.17
describe('Property 24: goal celebration replaces the ordinary reaction', () => {
  it('each completion yields exactly one reaction and always announces the task', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(5), { minLength: 1, maxLength: 12 }), (indices) => {
        // Build some active tasks then complete them in sequence.
        let s = stateWith();
        const count = 8;
        for (let i = 0; i < count; i += 1) {
          s = reducer(s, { type: 'CREATE_TASK', input: { ...validInput, title: `T${i}` }, id: `t${i}`, nowIso: completedTodayIso() });
        }
        for (const idx of indices) {
          const active = s.tasks.filter((t) => t.status === 'active');
          if (active.length === 0) break;
          const target = active[idx % active.length]!;
          const before = s.lastGoalCelebrationDate;
          const progressBefore = s.tasks.filter(
            (t) => t.status === 'completed' && t.completedAt !== null,
          ).length;
          s = reducer(s, { type: 'COMPLETE_TASK', id: target.id, nowIso: completedTodayIso(), today: TODAY });
          const isGoal = s.ghost.kind === 'goal';
          const expectedGoal = progressBefore < 3 && progressBefore + 1 >= 3 && before !== TODAY;
          // Exactly one reaction: kind is goal or celebrate.
          if (s.ghost.kind !== 'goal' && s.ghost.kind !== 'celebrate') return false;
          if (isGoal !== expectedGoal) return false;
          // Always announces the completed task.
          if (s.announcement?.text !== `Spirit released: ${target.title}`) return false;
        }
        return true;
      }),
    );
  });
});
