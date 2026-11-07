import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  getViewTasks,
  applyFilters,
  compareActive,
  isOverdue,
  countCompletedOn,
  getCounts,
} from './selectors.ts';
import type { Task, Filters, Category, Priority } from './types.ts';
import { makeTask, makeCompletedOn } from '../test/factories.ts';

const TODAY = '2026-06-15';

describe('getViewTasks (AC-ORG-01.2 to .5)', () => {
  const overdue = makeTask({ dueDate: '2026-06-10' });
  const dueToday = makeTask({ dueDate: TODAY });
  const upcoming = makeTask({ dueDate: '2026-06-20' });
  const undated = makeTask({ dueDate: null });
  const done = makeCompletedOn('2026-06-14');
  const tasks = [overdue, dueToday, upcoming, undated, done];

  it('Today shows active tasks due today or earlier', () => {
    const ids = getViewTasks(tasks, 'today', TODAY).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([overdue.id, dueToday.id]));
    expect(ids).not.toContain(upcoming.id);
    expect(ids).not.toContain(undated.id);
    expect(ids).not.toContain(done.id);
  });

  it('Upcoming shows active tasks due after today', () => {
    const ids = getViewTasks(tasks, 'upcoming', TODAY).map((t) => t.id);
    expect(ids).toEqual([upcoming.id]);
  });

  it('All shows every active task including undated', () => {
    const ids = getViewTasks(tasks, 'all', TODAY).map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([overdue.id, dueToday.id, upcoming.id, undated.id]),
    );
    expect(ids).not.toContain(done.id);
  });

  it('Completed is ordered by completedAt descending', () => {
    const d1 = makeCompletedOn('2026-06-10');
    const d2 = makeCompletedOn('2026-06-14');
    const d3 = makeCompletedOn('2026-06-12');
    const result = getViewTasks([d1, d2, d3], 'completed', TODAY);
    expect(result.map((t) => t.id)).toEqual([d2.id, d3.id, d1.id]);
  });
});

describe('isOverdue (AC-ORG-03.*)', () => {
  it('is true for an active past-due task', () => {
    expect(isOverdue(makeTask({ dueDate: '2026-06-10' }), TODAY)).toBe(true);
  });
  it('is false for a task due today', () => {
    expect(isOverdue(makeTask({ dueDate: TODAY }), TODAY)).toBe(false);
  });
  it('is false for an undated task', () => {
    expect(isOverdue(makeTask({ dueDate: null }), TODAY)).toBe(false);
  });
  it('is false for a completed past-due task', () => {
    expect(isOverdue(makeCompletedOn('2026-06-14', { dueDate: '2026-06-10' }), TODAY)).toBe(false);
  });
});

describe('countCompletedOn and getCounts (AC-DASH-01.10, .12, AC-DATE-01.3, .4)', () => {
  it('counts demo and user completions equally on the local day', () => {
    const tasks = [
      makeCompletedOn(TODAY, { source: 'user' }),
      makeCompletedOn(TODAY, { source: 'demo' }),
      makeCompletedOn('2026-06-14'),
      makeTask(),
    ];
    expect(countCompletedOn(tasks, TODAY)).toBe(2);
  });

  it('counts a 00:30 local completion on its local day', () => {
    const iso = new Date(2026, 5, 15, 0, 30, 0).toISOString();
    const tasks = [makeTask({ status: 'completed', completedAt: iso })];
    expect(countCompletedOn(tasks, '2026-06-15')).toBe(1);
  });

  it('active + completed equals the list length', () => {
    const tasks = [makeTask(), makeCompletedOn(TODAY), makeTask()];
    const { active, completed } = getCounts(tasks);
    expect(active + completed).toBe(tasks.length);
  });
});

// Property 13: View partition correctness
// Validates: Requirements 5.2, 5.3, 5.4, 5.5
describe('Property 13: view partition correctness', () => {
  const arbTask: fc.Arbitrary<Task> = fc
    .record({
      status: fc.constantFrom('active', 'completed'),
      dueDate: fc.oneof(
        fc.constant(null),
        fc.constantFrom('2026-06-10', '2026-06-15', '2026-06-20'),
      ),
      completedAtDay: fc.constantFrom('2026-06-10', '2026-06-14', '2026-06-15'),
    })
    .map((m) =>
      m.status === 'completed' ? makeCompletedOn(m.completedAtDay, { dueDate: m.dueDate }) : makeTask({ dueDate: m.dueDate }),
    );

  it('partitions active tasks and keeps completed ordered', () => {
    fc.assert(
      fc.property(fc.array(arbTask, { maxLength: 30 }), (tasks) => {
        const today = getViewTasks(tasks, 'today', TODAY);
        const upcoming = getViewTasks(tasks, 'upcoming', TODAY);
        const all = getViewTasks(tasks, 'all', TODAY);
        const completed = getViewTasks(tasks, 'completed', TODAY);

        const todayIds = new Set(today.map((t) => t.id));
        const upcomingIds = new Set(upcoming.map((t) => t.id));
        // Today and Upcoming disjoint.
        for (const id of todayIds) if (upcomingIds.has(id)) return false;

        // Today = active with dueDate <= today; Upcoming = active with dueDate > today.
        const todayOk = today.every(
          (t) => t.status === 'active' && t.dueDate !== null && t.dueDate <= TODAY,
        );
        const upcomingOk = upcoming.every(
          (t) => t.status === 'active' && t.dueDate !== null && t.dueDate > TODAY,
        );

        // All = every active task.
        const activeCount = tasks.filter((t) => t.status === 'active').length;
        const allOk = all.length === activeCount && all.every((t) => t.status === 'active');

        // Completed ordered descending.
        let ordered = true;
        for (let i = 1; i < completed.length; i += 1) {
          if ((completed[i - 1]!.completedAt ?? '') < (completed[i]!.completedAt ?? '')) {
            ordered = false;
            break;
          }
        }
        const completedOk =
          completed.every((t) => t.status === 'completed') &&
          completed.length === tasks.filter((t) => t.status === 'completed').length;

        return todayOk && upcomingOk && allOk && completedOk && ordered;
      }),
    );
  });
});

// Property 14: Filters are a conjunction
// Validates: Requirements 6.1, 6.2, 6.3, 6.4
describe('Property 14: filters are a conjunction', () => {
  const arbTask: fc.Arbitrary<Task> = fc.record({
    title: fc.string(),
    category: fc.constantFrom<Category>('Study', 'Work', 'Personal', 'Health', 'Other'),
    priority: fc.constantFrom<Priority>('Low', 'Medium', 'High'),
  }).map((m) => makeTask(m));

  const arbFilters: fc.Arbitrary<Filters> = fc.record({
    search: fc.string({ maxLength: 4 }),
    category: fc.constantFrom<Filters['category']>('all', 'Study', 'Work', 'Personal', 'Health', 'Other'),
    priority: fc.constantFrom<Filters['priority']>('all', 'Low', 'Medium', 'High'),
  });

  it('returns a subset where every item satisfies all filters, idempotently', () => {
    fc.assert(
      fc.property(fc.array(arbTask, { maxLength: 30 }), arbFilters, (tasks, f) => {
        const once = applyFilters(tasks, f);
        const twice = applyFilters(once, f);
        const ids = new Set(tasks.map((t) => t.id));
        const subset = once.every((t) => ids.has(t.id));
        const needle = f.search.trim().toLowerCase();
        const satisfies = once.every(
          (t) =>
            (needle === '' || t.title.toLowerCase().includes(needle)) &&
            (f.category === 'all' || t.category === f.category) &&
            (f.priority === 'all' || t.priority === f.priority),
        );
        // No matching task omitted.
        const kept = new Set(once.map((t) => t.id));
        const noneOmitted = tasks.every((t) => {
          const matches =
            (needle === '' || t.title.toLowerCase().includes(needle)) &&
            (f.category === 'all' || t.category === f.category) &&
            (f.priority === 'all' || t.priority === f.priority);
          return matches ? kept.has(t.id) : true;
        });
        const idempotent = twice.map((t) => t.id).join(',') === once.map((t) => t.id).join(',');
        return subset && satisfies && noneOmitted && idempotent;
      }),
    );
  });
});

// Property 15: Active ordering
// Validates: Requirements 6.7
describe('Property 15: active ordering', () => {
  const arbActive: fc.Arbitrary<Task> = fc.record({
    dueDate: fc.oneof(fc.constant(null), fc.constantFrom('2026-06-10', '2026-06-15', '2026-06-20')),
    priority: fc.constantFrom<Priority>('Low', 'Medium', 'High'),
    createdAt: fc.constantFrom(
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      '2026-03-01T00:00:00.000Z',
    ),
  }).map((m) => makeTask(m));

  const rank = { High: 0, Medium: 1, Low: 2 } as const;

  it('orders by due date (null last), then priority, then createdAt', () => {
    fc.assert(
      fc.property(fc.array(arbActive, { maxLength: 25 }), (tasks) => {
        const sorted = [...tasks].sort(compareActive);
        for (let i = 1; i < sorted.length; i += 1) {
          const a = sorted[i - 1]!;
          const b = sorted[i]!;
          // Due date ascending, null last.
          if (a.dueDate !== b.dueDate) {
            if (a.dueDate === null) return false; // null must not precede a dated task
            if (b.dueDate === null) continue; // dated before null is correct
            if (a.dueDate > b.dueDate) return false;
            continue;
          }
          // Same due date -> priority.
          if (a.priority !== b.priority) {
            if (rank[a.priority] > rank[b.priority]) return false;
            continue;
          }
          // Same priority -> createdAt ascending.
          if (a.createdAt > b.createdAt) return false;
        }
        return true;
      }),
    );
  });
});

// Property 16: Overdue classification
// Validates: Requirements 7.3, 7.4, 7.5, 7.6
describe('Property 16: overdue classification', () => {
  const arbTask: fc.Arbitrary<Task> = fc.record({
    status: fc.constantFrom('active', 'completed'),
    dueDate: fc.oneof(fc.constant(null), fc.constantFrom('2026-06-10', '2026-06-15', '2026-06-20')),
  }).map((m) =>
    m.status === 'completed'
      ? makeCompletedOn('2026-06-14', { dueDate: m.dueDate })
      : makeTask({ dueDate: m.dueDate }),
  );

  it('is true iff active, dated and strictly before today', () => {
    fc.assert(
      fc.property(arbTask, (task) => {
        const expected = task.status === 'active' && task.dueDate !== null && task.dueDate < TODAY;
        return isOverdue(task, TODAY) === expected;
      }),
    );
  });
});

// Property 17: Derived counts and daily progress
// Validates: Requirements 10.3, 10.10, 10.12, 15.3, 15.4
describe('Property 17: derived counts and daily progress', () => {
  const arbTask: fc.Arbitrary<Task> = fc.oneof(
    fc.constant(null).map(() => makeTask()),
    fc.constantFrom('2026-06-14', '2026-06-15').map((day) =>
      makeCompletedOn(day, { source: Math.random() < 0.5 ? 'demo' : 'user' }),
    ),
  );

  it('counts sum to length and daily progress matches completedAt local date', () => {
    fc.assert(
      fc.property(fc.array(arbTask, { maxLength: 30 }), (tasks) => {
        const { active, completed } = getCounts(tasks);
        if (active + completed !== tasks.length) return false;
        const expected = tasks.filter(
          (t) =>
            t.status === 'completed' &&
            t.completedAt !== null &&
            new Date(t.completedAt).toISOString() === t.completedAt &&
            toLocal(t.completedAt) === TODAY,
        ).length;
        return countCompletedOn(tasks, TODAY) === expected;
      }),
    );
  });

  function toLocal(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  }
});
