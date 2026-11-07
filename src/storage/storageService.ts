// The only module that touches LocalStorage (REQ-PERS-01/02). It receives a
// StorageLike (or null) so tests inject a mock and the app injects
// window.localStorage. No function throws (AC-PERS-02.10).

import type { Task, Notice, StorageMode } from '../domain/types.ts';
import { STORAGE_KEY, BACKUP_KEY, SCHEMA_VERSION } from '../domain/constants.ts';
import {
  parseStoredValue,
  serializeEnvelope,
  type MigrationRegistry,
  MIGRATIONS,
} from './envelope.ts';

/** Minimal subset of the Web Storage API the service depends on. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Result of loading storage at startup. */
export interface LoadResult {
  tasks: Task[];
  lastGoalCelebrationDate: string | null;
  storageMode: StorageMode;
  notices: Notice[];
}

/** Result of a save attempt; dispatched to the reducer as PERSIST_RESULT. */
export type SaveResult =
  | { status: 'ok' }
  | { status: 'quota' }
  | { status: 'unavailable' }
  | { status: 'skipped' }; // read-only or memory-only: nothing attempted

function notice(
  id: Notice['id'],
  tone: Notice['tone'],
  text: string,
  persistent: boolean,
): Notice {
  return { id, tone, text, persistent };
}

const EMPTY_ENVELOPE = serializeEnvelope([], null);

/** A quota-exceeded failure can surface under a few browser-specific names. */
function isQuotaError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014
    );
  }
  return false;
}

/**
 * Loads and validates the stored data, performing corruption recovery exactly
 * as specified (AC-PERS-02.4). The sequence for corrupted data is:
 *   1. read the original primary value;
 *   2. detect corruption;
 *   3. write the raw corrupted value to BACKUP_KEY;
 *   4. confirm the backup write succeeded (read it back);
 *   5. only then replace the primary value with an empty valid envelope;
 *   6. continue normal operation.
 * A failed backup (step 3/4) leaves the primary untouched and enters
 * Read_Only_Mode (AC-PERS-02.15). A newer schema version is read-only with no
 * writes at all (AC-PERS-02.6, .18). A missing key writes nothing (AC-PERS-01.6).
 */
export function loadStorage(
  storage: StorageLike | null,
  migrations: MigrationRegistry = MIGRATIONS,
): LoadResult {
  if (storage === null) {
    return memoryOnly();
  }

  // Step 1: read the original primary value. If access itself throws, storage
  // is unavailable (AC-PERS-02.8).
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return memoryOnly();
  }

  // Missing key: first run. Start empty, write nothing (AC-PERS-01.6, AC-PERS-02.16).
  if (raw === null) {
    return { tasks: [], lastGoalCelebrationDate: null, storageMode: 'normal', notices: [] };
  }

  const outcome = parseStoredValue(raw, migrations);

  if (outcome.kind === 'ok') {
    const notices: Notice[] =
      outcome.discarded > 0
        ? [
            notice(
              'discarded',
              'warning',
              `${outcome.discarded} stored ${outcome.discarded === 1 ? 'spirit' : 'spirits'} could not be read and ${outcome.discarded === 1 ? 'was' : 'were'} discarded.`,
              false,
            ),
          ]
        : [];
    return {
      tasks: outcome.tasks,
      lastGoalCelebrationDate: outcome.lastGoalCelebrationDate,
      storageMode: 'normal',
      notices,
    };
  }

  if (outcome.kind === 'newer') {
    // Step: never overwrite newer-version data; read-only, no writes (AC-PERS-02.6, .18).
    return {
      tasks: [],
      lastGoalCelebrationDate: null,
      storageMode: 'readOnly',
      notices: [
        notice(
          'newer-version',
          'warning',
          'Your saved data was created by a newer version of Spectral Tasks. To avoid losing it, changes will not be saved.',
          true,
        ),
      ],
    };
  }

  // outcome.kind === 'corrupted'
  return recoverFromCorruption(storage, raw);
}

/** Steps 3 to 6 of the corruption recovery (AC-PERS-02.4, .15, .16). */
function recoverFromCorruption(storage: StorageLike, raw: string): LoadResult {
  // Step 3: write the exact raw corrupted value to the backup key.
  try {
    storage.setItem(BACKUP_KEY, raw);
  } catch {
    return backupFailed();
  }

  // Step 4: confirm the backup write succeeded by reading it back.
  let backupReadBack: string | null;
  try {
    backupReadBack = storage.getItem(BACKUP_KEY);
  } catch {
    return backupFailed();
  }
  if (backupReadBack !== raw) {
    return backupFailed();
  }

  // Step 5: only now replace the primary value with an empty valid envelope.
  try {
    storage.setItem(STORAGE_KEY, EMPTY_ENVELOPE);
  } catch {
    // The backup already exists, so switch to memory-only rather than risk more
    // writes (design: load/recovery notes).
    return {
      tasks: [],
      lastGoalCelebrationDate: null,
      storageMode: 'memoryOnly',
      notices: [
        notice(
          'storage-unavailable',
          'error',
          'Saved data could not be read and storage is unavailable. Changes will not be saved.',
          true,
        ),
      ],
    };
  }

  // Step 6: continue in normal mode with a dismissible corruption notice.
  return {
    tasks: [],
    lastGoalCelebrationDate: null,
    storageMode: 'normal',
    notices: [
      notice(
        'corrupted',
        'warning',
        'Your saved data could not be read, so Spectral Tasks started fresh. A copy of the unreadable data was kept.',
        false,
      ),
    ],
  };
}

/** Backup write failed: leave the primary untouched, read-only (AC-PERS-02.15). */
function backupFailed(): LoadResult {
  return {
    tasks: [],
    lastGoalCelebrationDate: null,
    storageMode: 'readOnly',
    notices: [
      notice(
        'backup-failed',
        'error',
        'Saved data could not be read or backed up, so it has been left untouched and changes will not be saved.',
        true,
      ),
    ],
  };
}

/** LocalStorage is unavailable: run in memory with a persistent notice (AC-PERS-02.8). */
function memoryOnly(): LoadResult {
  return {
    tasks: [],
    lastGoalCelebrationDate: null,
    storageMode: 'memoryOnly',
    notices: [
      notice(
        'storage-unavailable',
        'error',
        'Storage is unavailable in this browser, so changes will not be saved.',
        true,
      ),
    ],
  };
}

/**
 * Writes the current Tasks and celebration date to the primary key
 * (AC-PERS-01.1). Classifies failures: quota keeps the change in memory and
 * stays retryable (AC-PERS-02.9); any other failure means storage is
 * unavailable (AC-PERS-02.8). Never throws (AC-PERS-02.10).
 */
export function saveEnvelope(
  storage: StorageLike | null,
  tasks: Task[],
  lastGoalCelebrationDate: string | null,
): SaveResult {
  if (storage === null) {
    return { status: 'unavailable' };
  }
  const serialized = serializeEnvelope(tasks, lastGoalCelebrationDate);
  try {
    storage.setItem(STORAGE_KEY, serialized);
    return { status: 'ok' };
  } catch (error) {
    if (isQuotaError(error)) {
      return { status: 'quota' };
    }
    return { status: 'unavailable' };
  }
}

// Re-export for convenience so callers have one storage entry point.
export { STORAGE_KEY, BACKUP_KEY, SCHEMA_VERSION };
