// Demo data generation and removal (REQ-DASH-01).
//
// Demo Tasks are ordinary Tasks tagged with source "demo". They are identified
// only by that field, never by title (AC-DASH-01.11). Due dates are generated
// relative to Local_Today (AC-DASH-01.8).

import type { Task, Category, Priority } from './types.ts';
import { addDays } from './dates.ts';

interface DemoSpec {
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  /** Day offset from today, or null for an undated Task. */
  offset: number | null;
  estimatedMinutes: number | null;
}

// Fixed demo definitions. Offsets cover overdue (-2), due today (0, 0),
// upcoming (1, 3) and an undated Task (null), so every View has sample content.
const DEMO_SPECS: readonly DemoSpec[] = [
  {
    title: 'Return the overdue library tome',
    description: 'It was due two days ago and the librarian is a ghost.',
    category: 'Personal',
    priority: 'High',
    offset: -2,
    estimatedMinutes: 20,
  },
  {
    title: 'Finish the alchemy lab report',
    description: 'Due today. Do not let it haunt you.',
    category: 'Study',
    priority: 'High',
    offset: 0,
    estimatedMinutes: 90,
  },
  {
    title: 'Reply to the guild emails',
    description: 'A short ritual of inbox cleansing.',
    category: 'Work',
    priority: 'Medium',
    offset: 0,
    estimatedMinutes: 30,
  },
  {
    title: 'Evening walk around the grounds',
    description: 'Tomorrow, before dusk.',
    category: 'Health',
    priority: 'Low',
    offset: 1,
    estimatedMinutes: 45,
  },
  {
    title: 'Plan the weekend study session',
    description: 'In a few days. Gather the tomes.',
    category: 'Study',
    priority: 'Medium',
    offset: 3,
    estimatedMinutes: 60,
  },
  {
    title: 'Someday: tidy the spectral attic',
    description: 'No deadline. It can wait for a quiet night.',
    category: 'Other',
    priority: 'Low',
    offset: null,
    estimatedMinutes: null,
  },
];

/**
 * Builds the demo Tasks for the given Local_Today (AC-DASH-01.7, .8). Each Task
 * is active, has source "demo", and a due date of null or addDays(today, k).
 */
export function createDemoTasks(today: string, nowIso: string, newId: () => string): Task[] {
  return DEMO_SPECS.map((spec) => ({
    id: newId(),
    title: spec.title,
    description: spec.description,
    category: spec.category,
    priority: spec.priority,
    status: 'active',
    dueDate: spec.offset === null ? null : addDays(today, spec.offset),
    estimatedMinutes: spec.estimatedMinutes,
    source: 'demo',
    createdAt: nowIso,
    completedAt: null,
  }));
}

/**
 * Removes every demo Task, keeping all user Tasks in their original order
 * (AC-DASH-01.9, .11). Identification is by source only, never by title.
 */
export function removeDemoTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.source !== 'demo');
}
