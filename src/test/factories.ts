// Test helpers for building Task records with sensible defaults.
// Used by domain unit and property tests.

import type { Task } from '../domain/types.ts';

let seq = 0;

/** Builds a Task, overriding any fields you pass. Ids are unique per call. */
export function makeTask(overrides: Partial<Task> = {}): Task {
  seq += 1;
  const base: Task = {
    id: `task-${seq}`,
    title: `Task ${seq}`,
    description: '',
    category: 'Other',
    priority: 'Medium',
    status: 'active',
    dueDate: null,
    estimatedMinutes: null,
    source: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
  };
  return { ...base, ...overrides };
}

/** Builds a completed Task completed at the given local date at noon. */
export function makeCompletedOn(localDate: string, overrides: Partial<Task> = {}): Task {
  const [y, m, d] = localDate.split('-').map(Number);
  const iso = new Date(y!, m! - 1, d!, 12, 0, 0).toISOString();
  return makeTask({ status: 'completed', completedAt: iso, ...overrides });
}
