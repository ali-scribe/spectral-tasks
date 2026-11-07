// Pure view, filter, sorting and derived-count logic (REQ-ORG-01/02/03,
// REQ-DASH-01 derived values). No React, no clock: `today` is passed in.

import type { Task, ViewId, Filters, Priority } from './types.ts';
import { isoToLocalDate } from './dates.ts';

/** True when an active Task's due date is strictly before `today` (AC-ORG-03.*). */
export function isOverdue(task: Task, today: string): boolean {
  return task.status === 'active' && task.dueDate !== null && task.dueDate < today;
}

/**
 * Returns the Tasks belonging to a View (AC-ORG-01.2 to .5). Completed is
 * ordered by completion timestamp, most recent first. Active views are returned
 * unsorted here; `compareActive` is applied by the caller.
 */
export function getViewTasks(tasks: Task[], view: ViewId, today: string): Task[] {
  switch (view) {
    case 'today':
      return tasks.filter(
        (t) => t.status === 'active' && t.dueDate !== null && t.dueDate <= today,
      );
    case 'upcoming':
      return tasks.filter(
        (t) => t.status === 'active' && t.dueDate !== null && t.dueDate > today,
      );
    case 'all':
      return tasks.filter((t) => t.status === 'active');
    case 'completed':
      return tasks
        .filter((t) => t.status === 'completed')
        .sort((a, b) => compareCompletedDesc(a, b));
    default: {
      // Exhaustiveness guard.
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

/** Orders completed Tasks by completion timestamp descending (AC-ORG-01.5). */
function compareCompletedDesc(a: Task, b: Task): number {
  const aAt = a.completedAt ?? '';
  const bAt = b.completedAt ?? '';
  if (aAt !== bAt) {
    return aAt < bAt ? 1 : -1;
  }
  // Stable, deterministic tie-break.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Applies the active Filter_Controls as a conjunction (AC-ORG-02.1 to .4).
 * Title match is case-insensitive containment; category and priority match
 * exactly unless set to 'all'. Returns a new array; a subset of the input.
 */
export function applyFilters(tasks: Task[], f: Filters): Task[] {
  const needle = f.search.trim().toLowerCase();
  return tasks.filter((t) => {
    if (needle.length > 0 && !t.title.toLowerCase().includes(needle)) {
      return false;
    }
    if (f.category !== 'all' && t.category !== f.category) {
      return false;
    }
    if (f.priority !== 'all' && t.priority !== f.priority) {
      return false;
    }
    return true;
  });
}

const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };

/**
 * Orders active Tasks (AC-ORG-02.7): due date ascending with undated Tasks last,
 * then priority High > Medium > Low, then createdAt ascending, then id as a
 * final deterministic tie-break.
 */
export function compareActive(a: Task, b: Task): number {
  // Due date ascending, null (undated) last.
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  // Priority High first.
  if (a.priority !== b.priority) {
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  }
  // Creation ascending.
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }
  // Deterministic final tie-break.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Counts Tasks completed on a given local calendar date (AC-DASH-01.10,
 * AC-DATE-01.3, .4). Counts demo and user Tasks equally (AC-DASH-01.12).
 */
export function countCompletedOn(tasks: Task[], localDate: string): number {
  let count = 0;
  for (const t of tasks) {
    if (t.status === 'completed' && t.completedAt !== null && isoToLocalDate(t.completedAt) === localDate) {
      count += 1;
    }
  }
  return count;
}

/** Active and completed Task counts (AC-DASH-01.1). */
export function getCounts(tasks: Task[]): { active: number; completed: number } {
  let active = 0;
  let completed = 0;
  for (const t of tasks) {
    if (t.status === 'completed') {
      completed += 1;
    } else {
      active += 1;
    }
  }
  return { active, completed };
}
