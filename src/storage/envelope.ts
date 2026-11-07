// Pure parsing and serialization of the Storage_Envelope (REQ-PERS-01/02,
// REQ-DATA-01). No browser globals: this module only turns strings into
// validated data and back. It never throws (AC-PERS-02.10).

import {
  CATEGORIES,
  PRIORITIES,
  type Task,
  type Category,
  type Priority,
  type TaskStatus,
  type TaskSource,
} from '../domain/types.ts';
import { SCHEMA_VERSION } from '../domain/constants.ts';
import { isRealCalendarDate } from '../domain/dates.ts';

/** A registry of migration functions keyed by the version they upgrade FROM. */
export type MigrationRegistry = Record<number, (env: unknown) => unknown>;

/** The empty migration registry for the MVP; no prior versions exist (AC-PERS-02.17). */
export const MIGRATIONS: MigrationRegistry = {};

/** The classified result of parsing a stored string. */
export type ParseOutcome =
  | { kind: 'corrupted' }
  | { kind: 'newer'; version: number }
  | {
      kind: 'ok';
      tasks: Task[];
      discarded: number;
      lastGoalCelebrationDate: string | null;
    };

/** Serializes exactly the three supported Storage_Envelope fields (AC-PERS-01.3, AC-DATA-01.5). */
export function serializeEnvelope(tasks: Task[], lastGoalCelebrationDate: string | null): string {
  // Rebuild tasks from known fields only, so no unknown property is ever written
  // back (AC-PERS-02.19).
  const cleanTasks = tasks.map(cleanTask);
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    tasks: cleanTasks,
    lastGoalCelebrationDate,
  });
}

/** Produces a Task containing only the eleven known fields in a fixed order. */
function cleanTask(t: Task): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate,
    estimatedMinutes: t.estimatedMinutes,
    source: t.source,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  // Round-trip check: a canonical ISO 8601 UTC string equals its own
  // Date.toISOString() (AC-DATA-01.1).
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.toISOString() === value;
}

/** Converts a stored celebration date to a real date string or null (AC-PERS-02.12). */
function sanitizeDate(value: unknown): string | null {
  return typeof value === 'string' && isRealCalendarDate(value) ? value : null;
}

/**
 * Validates one stored entry and returns a freshly built Task, or null if any
 * rule is violated (AC-PERS-02.13, .14, .19, AC-DATA-01.1, .3). `seenIds`
 * tracks ids already accepted in this load so a later duplicate is discarded
 * (EC-31).
 */
function validateStoredTask(entry: unknown, seenIds: Set<string>): Task | null {
  if (!isPlainObject(entry)) return null;

  const { id, title, description, category, priority, status, dueDate, estimatedMinutes, source, createdAt, completedAt } = entry;

  if (typeof id !== 'string' || id.length === 0 || seenIds.has(id)) return null;
  if (typeof title !== 'string') return null;
  if (typeof description !== 'string') return null;
  if (typeof category !== 'string' || !(CATEGORIES as readonly string[]).includes(category)) return null;
  if (typeof priority !== 'string' || !(PRIORITIES as readonly string[]).includes(priority)) return null;
  if (status !== 'active' && status !== 'completed') return null;
  if (dueDate !== null && !(typeof dueDate === 'string' && isRealCalendarDate(dueDate))) return null;
  if (estimatedMinutes !== null && !isInteger(estimatedMinutes)) return null;
  if (source !== 'user' && source !== 'demo') return null;
  if (!isValidTimestamp(createdAt)) return null;

  // completedAt is non-null iff status is completed (AC-DATA-01.3).
  if (status === 'completed') {
    if (!isValidTimestamp(completedAt)) return null;
  } else if (completedAt !== null) {
    return null;
  }

  seenIds.add(id);
  return {
    id,
    title,
    description,
    category: category as Category,
    priority: priority as Priority,
    status: status as TaskStatus,
    dueDate: dueDate as string | null,
    estimatedMinutes: estimatedMinutes as number | null,
    source: source as TaskSource,
    createdAt,
    completedAt: (status === 'completed' ? (completedAt as string) : null),
  };
}

/**
 * Parses a stored string into a ParseOutcome, never throwing (AC-PERS-02.10).
 * Check order follows the design:
 * 1. JSON parse (failure -> corrupted, AC-PERS-02.1).
 * 2. Envelope shape: object, integer schemaVersion >= 1, tasks array
 *    (else corrupted, AC-PERS-02.2, .11).
 * 3. schemaVersion > supported -> newer (AC-PERS-02.6).
 * 4. schemaVersion < supported -> run migration chain (AC-PERS-02.7, .17).
 * 5. Validate each task, discarding invalid entries (AC-PERS-02.5).
 * 6. Sanitize lastGoalCelebrationDate (AC-PERS-02.12).
 * 7. Unknown envelope properties are ignored (AC-PERS-02.18).
 */
export function parseStoredValue(raw: string, migrations: MigrationRegistry = MIGRATIONS): ParseOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'corrupted' };
  }

  let envelope = parsed;
  if (!isPlainObject(envelope)) return { kind: 'corrupted' };
  if (!isInteger(envelope.schemaVersion) || envelope.schemaVersion < 1) return { kind: 'corrupted' };
  if (!Array.isArray(envelope.tasks)) return { kind: 'corrupted' };

  const version = envelope.schemaVersion;
  if (version > SCHEMA_VERSION) {
    return { kind: 'newer', version };
  }

  // Run the migration chain for each version step below the supported version.
  if (version < SCHEMA_VERSION) {
    let current = version;
    while (current < SCHEMA_VERSION) {
      const migrate = migrations[current];
      if (!migrate) {
        // No migration available for this step: cannot safely upgrade.
        return { kind: 'corrupted' };
      }
      const next = migrate(envelope);
      if (!isPlainObject(next)) return { kind: 'corrupted' };
      envelope = next;
      current += 1;
    }
    // Re-validate the migrated shape before using it.
    if (!isPlainObject(envelope) || !Array.isArray(envelope.tasks)) return { kind: 'corrupted' };
  }

  const entries = envelope.tasks as unknown[];
  const seenIds = new Set<string>();
  const tasks: Task[] = [];
  let discarded = 0;
  for (const entry of entries) {
    const task = validateStoredTask(entry, seenIds);
    if (task) {
      tasks.push(task);
    } else {
      discarded += 1;
    }
  }

  return {
    kind: 'ok',
    tasks,
    discarded,
    lastGoalCelebrationDate: sanitizeDate(envelope.lastGoalCelebrationDate),
  };
}
