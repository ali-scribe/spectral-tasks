import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDemoTasks, removeDemoTasks } from './demo.ts';
import { updateTask } from './tasks.ts';
import { addDays } from './dates.ts';
import type { ValidTaskInput } from './validation.ts';
import type { TaskSource } from './types.ts';
import { makeTask } from '../test/factories.ts';

let n = 0;
const newId = () => `demo-${(n += 1)}`;

describe('removeDemoTasks (AC-DASH-01.9, .11)', () => {
  it('keeps a user task whose title equals a demo title', () => {
    const demos = createDemoTasks('2026-06-15', '2026-06-15T00:00:00.000Z', newId);
    const sharedTitle = demos[0]!.title;
    const userLookalike = makeTask({ title: sharedTitle, source: 'user' });
    const remaining = removeDemoTasks([...demos, userLookalike]);
    expect(remaining).toEqual([userLookalike]);
  });

  it('removes an edited demo task because its source is unchanged', () => {
    const demos = createDemoTasks('2026-06-15', '2026-06-15T00:00:00.000Z', newId);
    const input: ValidTaskInput = {
      title: 'Renamed by the user',
      description: '',
      category: 'Work',
      priority: 'Low',
      dueDate: null,
      estimatedMinutes: null,
    };
    const editedDemo = updateTask(demos[0]!, input);
    expect(editedDemo.source).toBe('demo');
    const remaining = removeDemoTasks([editedDemo, ...demos.slice(1)]);
    expect(remaining).toEqual([]);
  });
});

// Property 20: Demo removal affects only source demo
// Validates: Requirements 10.9, 10.11, 2.6, 13.7
describe('Property 20: demo removal affects only source demo', () => {
  it('returns exactly the user tasks in original order', () => {
    const arbTask = fc
      .record({ source: fc.constantFrom<TaskSource>('user', 'demo') })
      .map((m) => makeTask(m));
    fc.assert(
      fc.property(fc.array(arbTask, { maxLength: 40 }), (tasks) => {
        const result = removeDemoTasks(tasks);
        const expected = tasks.filter((t) => t.source === 'user');
        return (
          result.length === expected.length &&
          result.every((t, i) => t.id === expected[i]!.id) &&
          result.every((t) => t.source === 'user')
        );
      }),
    );
  });
});

// Property 21: Demo dates are relative to today
// Validates: Requirements 10.7, 10.8
describe('Property 21: demo dates are relative to today', () => {
  it('every demo task is active, source demo, with null or addDays(today, k) due date', () => {
    const arbToday = fc
      .date({ min: new Date(2001, 0, 1), max: new Date(2098, 11, 31) })
      .map((d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);

    fc.assert(
      fc.property(arbToday, (today) => {
        const tasks = createDemoTasks(today, `${today}T00:00:00.000Z`, newId);
        return tasks.every((t) => {
          if (t.source !== 'demo' || t.status !== 'active') return false;
          if (t.dueDate === null) return true;
          // The due date must be some addDays(today, k) for an integer k.
          // Recover k and confirm it round-trips.
          for (let k = -10; k <= 10; k += 1) {
            if (addDays(today, k) === t.dueDate) return true;
          }
          return false;
        });
      }),
    );
  });

  it('produces six active demo tasks covering overdue, today, upcoming and undated', () => {
    const tasks = createDemoTasks('2026-06-15', '2026-06-15T00:00:00.000Z', newId);
    expect(tasks).toHaveLength(6);
    expect(tasks.every((t) => t.source === 'demo' && t.status === 'active')).toBe(true);
    expect(tasks.some((t) => t.dueDate !== null && t.dueDate < '2026-06-15')).toBe(true);
    expect(tasks.some((t) => t.dueDate === '2026-06-15')).toBe(true);
    expect(tasks.some((t) => t.dueDate !== null && t.dueDate > '2026-06-15')).toBe(true);
    expect(tasks.some((t) => t.dueDate === null)).toBe(true);
  });
});
