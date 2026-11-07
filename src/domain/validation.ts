// Task form validation (REQ-VAL-01, AC-TASK-01.3/.5/.6).
//
// Pure logic only: validates and normalizes raw form input into a ValidTaskInput
// that the task operations can consume. No React, no DOM, no clock.

import {
  CATEGORIES,
  PRIORITIES,
  type Category,
  type Priority,
} from './types.ts';
import {
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MIN_ESTIMATED_MINUTES,
  MAX_ESTIMATED_MINUTES,
} from './constants.ts';
import { isRealCalendarDate } from './dates.ts';

/** Names of the Task_Form fields that can carry a validation error. */
export type FieldName =
  | 'title'
  | 'description'
  | 'dueDate'
  | 'estimatedMinutes';

/**
 * Raw, unvalidated input straight from the form. Optional category and priority
 * allow "not selected" to fall back to defaults (AC-TASK-01.5, AC-TASK-01.6).
 */
export interface RawTaskInput {
  title: string;
  description: string;
  category?: Category | '';
  priority?: Priority | '';
  /** Raw due date string ("" when empty), typically "YYYY-MM-DD" from an input. */
  dueDate: string;
  /** Raw estimated minutes string ("" when empty). */
  estimatedMinutes: string;
}

/** Validated, normalized input ready to build or update a Task. */
export interface ValidTaskInput {
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  dueDate: string | null;
  estimatedMinutes: number | null;
}

export type ValidationErrors = Partial<Record<FieldName, string>>;

export type ValidationResult =
  | { ok: true; value: ValidTaskInput }
  | { ok: false; errors: ValidationErrors };

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

/**
 * Validates and normalizes raw task input (AC-VAL-01.1 to .8).
 *
 * Rules:
 * - title: trimmed; must be 1 to 100 characters (AC-VAL-01.1, .2, AC-TASK-01.3).
 * - description: at most 1000 characters (AC-VAL-01.3).
 * - dueDate: empty -> null; otherwise must be a real calendar date; past dates
 *   are accepted (AC-VAL-01.4, .7, .8).
 * - estimatedMinutes: empty -> null; otherwise a whole number 1 to 1440
 *   (AC-VAL-01.5, .6).
 * - missing category/priority default to "Other"/"Medium" (AC-TASK-01.5, .6).
 */
export function validateTaskInput(raw: RawTaskInput): ValidationResult {
  const errors: ValidationErrors = {};

  const title = raw.title.trim();
  if (title.length === 0) {
    errors.title = 'A spirit needs a title.';
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  }

  const description = raw.description;
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  let dueDate: string | null = null;
  const rawDue = raw.dueDate.trim();
  if (rawDue.length > 0) {
    if (isRealCalendarDate(rawDue)) {
      dueDate = rawDue;
    } else {
      errors.dueDate = 'Enter a real calendar date.';
    }
  }

  let estimatedMinutes: number | null = null;
  const rawMinutes = raw.estimatedMinutes.trim();
  if (rawMinutes.length > 0) {
    // Accept only a plain whole number; reject decimals, signs and junk.
    if (!/^\d+$/.test(rawMinutes)) {
      errors.estimatedMinutes = `Enter a whole number of minutes from ${MIN_ESTIMATED_MINUTES} to ${MAX_ESTIMATED_MINUTES}.`;
    } else {
      const minutes = Number(rawMinutes);
      if (minutes < MIN_ESTIMATED_MINUTES || minutes > MAX_ESTIMATED_MINUTES) {
        errors.estimatedMinutes = `Enter a whole number of minutes from ${MIN_ESTIMATED_MINUTES} to ${MAX_ESTIMATED_MINUTES}.`;
      } else {
        estimatedMinutes = minutes;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const category: Category =
    raw.category && isCategory(raw.category) ? raw.category : 'Other';
  const priority: Priority =
    raw.priority && isPriority(raw.priority) ? raw.priority : 'Medium';

  return {
    ok: true,
    value: {
      title,
      description,
      category,
      priority,
      dueDate,
      estimatedMinutes,
    },
  };
}
