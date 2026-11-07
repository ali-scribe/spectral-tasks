import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  parseStoredValue,
  serializeEnvelope,
  type MigrationRegistry,
  MIGRATIONS,
} from './envelope.ts';
import { SCHEMA_VERSION } from '../domain/constants.ts';
import type { Task } from '../domain/types.ts';
import { makeTask, makeCompletedOn } from '../test/factories.ts';

function envelope(partial: Record<string, unknown>): string {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, tasks: [], lastGoalCelebrationDate: null, ...partial });
}

describe('parseStoredValue - shape and version (AC-PERS-02.1, .2, .6, .11)', () => {
  it('treats truncated JSON as corrupted', () => {
    expect(parseStoredValue('{ "schemaVersion": 1, "tasks":').kind).toBe('corrupted');
  });

  it('treats a non-object as corrupted', () => {
    expect(parseStoredValue('42').kind).toBe('corrupted');
    expect(parseStoredValue('[]').kind).toBe('corrupted');
    expect(parseStoredValue('null').kind).toBe('corrupted');
  });

  it('rejects a non-integer or sub-1 schemaVersion', () => {
    expect(parseStoredValue(envelope({ schemaVersion: 0 })).kind).toBe('corrupted');
    expect(parseStoredValue(envelope({ schemaVersion: 1.5 })).kind).toBe('corrupted');
    expect(parseStoredValue(envelope({ schemaVersion: '1' })).kind).toBe('corrupted');
  });

  it('requires tasks to be an array', () => {
    expect(parseStoredValue(envelope({ tasks: {} })).kind).toBe('corrupted');
  });

  it('classifies a greater schemaVersion as newer', () => {
    const outcome = parseStoredValue(envelope({ schemaVersion: SCHEMA_VERSION + 1 }));
    expect(outcome.kind).toBe('newer');
    if (outcome.kind === 'newer') expect(outcome.version).toBe(SCHEMA_VERSION + 1);
  });
});

describe('parseStoredValue - migrations (AC-PERS-02.7, .17)', () => {
  it('ships an empty registry', () => {
    expect(Object.keys(MIGRATIONS)).toHaveLength(0);
  });

  it('does not run any migration at the current supported version', () => {
    let called = false;
    const migrations: MigrationRegistry = {
      1: (env) => {
        called = true;
        return env;
      },
    };
    const outcome = parseStoredValue(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, tasks: [], lastGoalCelebrationDate: null }),
      migrations,
    );
    expect(outcome.kind).toBe('ok');
    expect(called).toBe(false); // version equals SCHEMA_VERSION, so no migration
  });

  it('rejects a sub-integer schemaVersion before any migration (AC-PERS-02.11)', () => {
    // A schemaVersion below 1 fails the shape check and is corrupted; it never
    // reaches the migration chain.
    const raw = JSON.stringify({ schemaVersion: 0.5, tasks: [], lastGoalCelebrationDate: null });
    expect(parseStoredValue(raw).kind).toBe('corrupted');
  });
});

describe('parseStoredValue - task validation (AC-PERS-02.5, .13, .14)', () => {
  function taskObj(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
    return {
      id: `id-${Math.random()}`,
      title: 'A spirit',
      description: '',
      category: 'Study',
      priority: 'High',
      status: 'active',
      dueDate: null,
      estimatedMinutes: null,
      source: 'user',
      createdAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
      ...over,
    };
  }

  it('discards a task with an invalid category (EC-10) and keeps the valid one', () => {
    const raw = envelope({ tasks: [taskObj(), taskObj({ category: 'Wizardry' })] });
    const outcome = parseStoredValue(raw);
    expect(outcome.kind).toBe('ok');
    if (outcome.kind === 'ok') {
      expect(outcome.tasks).toHaveLength(1);
      expect(outcome.discarded).toBe(1);
    }
  });

  it('discards tasks with missing or unknown source', () => {
    const noSource = taskObj();
    delete (noSource as Record<string, unknown>).source;
    const raw = envelope({ tasks: [noSource, taskObj({ source: 'imported' })] });
    const outcome = parseStoredValue(raw);
    if (outcome.kind === 'ok') expect(outcome.discarded).toBe(2);
  });

  it('keeps the first of duplicate ids and discards the rest (EC-31)', () => {
    const raw = envelope({ tasks: [taskObj({ id: 'dup', title: 'first' }), taskObj({ id: 'dup', title: 'second' })] });
    const outcome = parseStoredValue(raw);
    if (outcome.kind === 'ok') {
      expect(outcome.tasks).toHaveLength(1);
      expect(outcome.tasks[0]!.title).toBe('first');
      expect(outcome.discarded).toBe(1);
    }
  });

  it('discards a completed task without completedAt and an active task with one', () => {
    const raw = envelope({
      tasks: [
        taskObj({ status: 'completed', completedAt: null }),
        taskObj({ status: 'active', completedAt: '2026-01-02T00:00:00.000Z' }),
      ],
    });
    const outcome = parseStoredValue(raw);
    if (outcome.kind === 'ok') expect(outcome.discarded).toBe(2);
  });

  it('discards a non-integer estimatedMinutes and a non-canonical timestamp', () => {
    const raw = envelope({
      tasks: [taskObj({ estimatedMinutes: 12.5 }), taskObj({ createdAt: '2026-1-1' })],
    });
    const outcome = parseStoredValue(raw);
    if (outcome.kind === 'ok') expect(outcome.discarded).toBe(2);
  });
});

describe('parseStoredValue - celebration date (AC-PERS-02.12)', () => {
  it('nulls an impossible date without discarding tasks (EC-24)', () => {
    const t = makeTask();
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, tasks: [t], lastGoalCelebrationDate: '2026-02-30' });
    const outcome = parseStoredValue(raw);
    if (outcome.kind === 'ok') {
      expect(outcome.lastGoalCelebrationDate).toBeNull();
      expect(outcome.discarded).toBe(0);
      expect(outcome.tasks).toHaveLength(1);
    }
  });

  it('nulls a numeric celebration date', () => {
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, tasks: [], lastGoalCelebrationDate: 20260101 });
    const outcome = parseStoredValue(raw);
    if (outcome.kind === 'ok') expect(outcome.lastGoalCelebrationDate).toBeNull();
  });

  it('keeps a real date', () => {
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, tasks: [], lastGoalCelebrationDate: '2026-06-15' });
    const outcome = parseStoredValue(raw);
    if (outcome.kind === 'ok') expect(outcome.lastGoalCelebrationDate).toBe('2026-06-15');
  });
});

// ---- Property-based tests ----

const arbTask: fc.Arbitrary<Task> = fc
  .record({
    kind: fc.constantFrom('active' as const, 'completed' as const),
    dueDate: fc.oneof(fc.constant(null), fc.constant('2026-07-04')),
    estimatedMinutes: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 1440 })),
    source: fc.constantFrom('user' as const, 'demo' as const),
  })
  .map((m, ) =>
    m.kind === 'completed'
      ? makeCompletedOn('2026-06-15', { dueDate: m.dueDate, estimatedMinutes: m.estimatedMinutes, source: m.source })
      : makeTask({ dueDate: m.dueDate, estimatedMinutes: m.estimatedMinutes, source: m.source }),
  );

// Deduplicate ids so a valid list stays fully valid.
function uniqueById(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  const out: Task[] = [];
  for (const t of tasks) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

// Property 1: Storage round trip
// Validates: Requirements 8.5
describe('Property 1: storage round trip', () => {
  it('serialize then parse yields an equivalent task store and date', () => {
    const arbDate = fc.oneof(fc.constant(null), fc.constant('2026-06-15'));
    fc.assert(
      fc.property(fc.array(arbTask, { maxLength: 30 }), arbDate, (rawTasks, date) => {
        const tasks = uniqueById(rawTasks);
        const outcome = parseStoredValue(serializeEnvelope(tasks, date));
        if (outcome.kind !== 'ok') return false;
        return (
          outcome.discarded === 0 &&
          outcome.lastGoalCelebrationDate === date &&
          JSON.stringify(outcome.tasks) === JSON.stringify(tasks)
        );
      }),
    );
  });
});

// Property 2: Parsing never throws and classifies safely
// Validates: Requirements 9.1, 9.2, 9.6, 9.10, 9.11
describe('Property 2: parsing never throws and classifies safely', () => {
  it('returns a valid outcome kind for arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const outcome = parseStoredValue(raw);
        return outcome.kind === 'ok' || outcome.kind === 'newer' || outcome.kind === 'corrupted';
      }),
    );
  });

  it('never throws for arbitrary JSON values', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const outcome = parseStoredValue(JSON.stringify(value));
        return outcome.kind === 'ok' || outcome.kind === 'newer' || outcome.kind === 'corrupted';
      }),
    );
  });
});

// Property 3: Stored task validation keeps valid and discards invalid
// Validates: Requirements 9.5, 9.13, 9.14, 13.1, 13.3
describe('Property 3: stored task validation', () => {
  it('loads exactly the valid entries in order and counts the invalid ones', () => {
    const validEntry = () =>
      makeTask({ id: `v-${Math.random()}` }) as unknown as Record<string, unknown>;
    const invalidEntry = fc.constantFrom<Record<string, unknown>>(
      { ...(makeTask() as unknown as Record<string, unknown>), category: 'Nope' },
      { ...(makeTask() as unknown as Record<string, unknown>), source: 'ghost' },
      { ...(makeTask() as unknown as Record<string, unknown>), createdAt: 'not-iso' },
      { ...(makeTask() as unknown as Record<string, unknown>), status: 'completed', completedAt: null },
      { ...(makeTask() as unknown as Record<string, unknown>), id: '' },
      { ...(makeTask() as unknown as Record<string, unknown>), estimatedMinutes: 3.3 },
    );

    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.constant('valid' as const), invalidEntry.map((e) => ({ e }))), { maxLength: 30 }),
        (items) => {
          const entries = items.map((it) => (it === 'valid' ? validEntry() : it.e));
          const expectedValid = items.filter((it) => it === 'valid').length;
          const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, tasks: entries, lastGoalCelebrationDate: null });
          const outcome = parseStoredValue(raw);
          if (outcome.kind !== 'ok') return false;
          return outcome.tasks.length === expectedValid && outcome.discarded === entries.length - expectedValid;
        },
      ),
    );
  });
});

// Property 4: Unknown properties are ignored and dropped
// Validates: Requirements 9.18, 9.19
describe('Property 4: unknown properties ignored and dropped', () => {
  it('loads the same tasks with or without extras and strips them on re-serialize', () => {
    fc.assert(
      fc.property(fc.array(arbTask, { maxLength: 15 }), (rawTasks) => {
        const tasks = uniqueById(rawTasks);
        const withExtras = {
          schemaVersion: SCHEMA_VERSION,
          surpriseEnvelopeField: 'boo',
          lastGoalCelebrationDate: null,
          tasks: tasks.map((t) => ({ ...t, hauntLevel: 9 })),
        };
        const clean = parseStoredValue(serializeEnvelope(tasks, null));
        const extra = parseStoredValue(JSON.stringify(withExtras));
        if (clean.kind !== 'ok' || extra.kind !== 'ok') return false;
        // Same tasks.
        const sameTasks = JSON.stringify(extra.tasks) === JSON.stringify(clean.tasks);
        // Re-serialized form has no extra property anywhere.
        const reSerialized = serializeEnvelope(extra.tasks, null);
        const noExtra = !reSerialized.includes('hauntLevel') && !reSerialized.includes('surpriseEnvelopeField');
        return sameTasks && noExtra;
      }),
    );
  });
});

// Property 5: Celebration date sanitation
// Validates: Requirements 9.12
describe('Property 5: celebration date sanitation', () => {
  it('keeps real dates, nulls everything else, never affecting discarded', () => {
    const arbStored = fc.oneof(
      fc.constant(undefined),
      fc.integer(),
      fc.constant('2026-13-40'),
      fc.constant('2026-02-30'),
      fc.constant('garbage'),
      fc.constant('2026-06-15'),
      fc.constant('2024-02-29'),
    );
    fc.assert(
      fc.property(arbStored, (value) => {
        const obj: Record<string, unknown> = { schemaVersion: SCHEMA_VERSION, tasks: [] };
        if (value !== undefined) obj.lastGoalCelebrationDate = value;
        const outcome = parseStoredValue(JSON.stringify(obj));
        if (outcome.kind !== 'ok') return false;
        const isReal =
          typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
          (value === '2026-06-15' || value === '2024-02-29');
        const expected = isReal ? value : null;
        return outcome.lastGoalCelebrationDate === expected && outcome.discarded === 0;
      }),
    );
  });
});
