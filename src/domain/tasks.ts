// Pure Task operations (REQ-TASK-01/02/04, REQ-DATA-01).
//
// Every function is pure: identifiers and timestamps are passed in as
// parameters, never generated here, so the reducer and tests stay deterministic
// (design D2, AC-DATE-01.5).

import type { Task } from './types.ts';
import type { ValidTaskInput } from './validation.ts';

/**
 * Builds a new active Task from validated input (AC-TASK-01.1, .4, .7, .9).
 * The Task starts active, uncompleted, and with source "user".
 */
export function createTask(input: ValidTaskInput, id: string, nowIso: string): Task {
  return {
    id,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    status: 'active',
    dueDate: input.dueDate,
    estimatedMinutes: input.estimatedMinutes,
    source: 'user',
    createdAt: nowIso,
    completedAt: null,
  };
}

/**
 * Applies edited field values to a Task, preserving the fields that an edit must
 * never change: id, createdAt, completedAt, status and source
 * (AC-TASK-02.2, .5, .6, AC-DATA-01.7). A Completed_Task stays completed.
 */
export function updateTask(task: Task, input: ValidTaskInput): Task {
  return {
    ...task,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    dueDate: input.dueDate,
    estimatedMinutes: input.estimatedMinutes,
  };
}

/**
 * Marks a Task completed and records the completion timestamp
 * (AC-TASK-04.1, .4, AC-DATA-01.3). Re-completing a reopened Task records a
 * fresh timestamp because the caller passes the current time.
 */
export function completeTask(task: Task, nowIso: string): Task {
  return { ...task, status: 'completed', completedAt: nowIso };
}

/**
 * Reopens a completed Task: status becomes active and the completion timestamp
 * is cleared (AC-TASK-04.2, AC-DATA-01.3).
 */
export function reopenTask(task: Task): Task {
  return { ...task, status: 'active', completedAt: null };
}
