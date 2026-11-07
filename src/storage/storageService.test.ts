import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { loadStorage, saveEnvelope, STORAGE_KEY, BACKUP_KEY } from './storageService.ts';
import { serializeEnvelope } from './envelope.ts';
import { SCHEMA_VERSION } from '../domain/constants.ts';
import { makeTask } from '../test/factories.ts';
import { createFakeStorage } from '../test/fakeStorage.ts';

const EMPTY = serializeEnvelope([], null);

describe('loadStorage - first run and valid data (AC-PERS-01.6, .2)', () => {
  it('writes nothing when the key is missing', () => {
    const storage = createFakeStorage();
    const result = loadStorage(storage);
    expect(result.storageMode).toBe('normal');
    expect(result.tasks).toEqual([]);
    expect(storage.setCalls()).toHaveLength(0);
  });

  it('loads valid stored tasks and the celebration date', () => {
    const t = makeTask();
    const storage = createFakeStorage({
      initial: { [STORAGE_KEY]: serializeEnvelope([t], '2026-06-15') },
    });
    const result = loadStorage(storage);
    expect(result.storageMode).toBe('normal');
    expect(result.tasks).toHaveLength(1);
    expect(result.lastGoalCelebrationDate).toBe('2026-06-15');
    expect(storage.setCalls()).toHaveLength(0);
  });

  it('reports the discarded count when some tasks are invalid (EC-10)', () => {
    const good = makeTask();
    const raw = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      tasks: [good, { ...good, id: 'bad', category: 'Nope' }],
      lastGoalCelebrationDate: null,
    });
    const storage = createFakeStorage({ initial: { [STORAGE_KEY]: raw } });
    const result = loadStorage(storage);
    expect(result.tasks).toHaveLength(1);
    expect(result.notices.some((n) => n.id === 'discarded')).toBe(true);
  });
});

describe('loadStorage - corruption recovery ordering (AC-PERS-02.4, .16)', () => {
  it('backs up then replaces the primary, in that order', () => {
    const storage = createFakeStorage({ initial: { [STORAGE_KEY]: '{ broken json' } });
    const result = loadStorage(storage);

    expect(result.storageMode).toBe('normal');
    const sets = storage.setCalls();
    expect(sets).toHaveLength(2);
    // Step 3 first: backup gets the raw value.
    expect(sets[0]).toMatchObject({ key: BACKUP_KEY, value: '{ broken json' });
    // Step 5 next: primary gets an empty valid envelope.
    expect(sets[1]).toMatchObject({ key: STORAGE_KEY, value: EMPTY });
    // Backup now holds the original.
    expect(storage.peek(BACKUP_KEY)).toBe('{ broken json');
    expect(result.notices.some((n) => n.id === 'corrupted' && !n.persistent)).toBe(true);
  });

  it('confirms the backup by reading it back before replacing the primary', () => {
    const storage = createFakeStorage({ initial: { [STORAGE_KEY]: 'not json' } });
    loadStorage(storage);
    // The getItem for the backup read-back must occur before the primary setItem.
    const backupReadIdx = storage.calls.findIndex((c) => c.op === 'getItem' && c.key === BACKUP_KEY);
    const primarySetIdx = storage.calls.findIndex((c) => c.op === 'setItem' && c.key === STORAGE_KEY);
    expect(backupReadIdx).toBeGreaterThanOrEqual(0);
    expect(primarySetIdx).toBeGreaterThan(backupReadIdx);
  });
});

describe('loadStorage - backup failure (AC-PERS-02.15, EC-28)', () => {
  it('leaves the primary untouched and enters read-only mode', () => {
    const storage = createFakeStorage({
      initial: { [STORAGE_KEY]: 'broken' },
      throwOnSetKeys: [BACKUP_KEY],
    });
    const result = loadStorage(storage);
    expect(result.storageMode).toBe('readOnly');
    expect(result.notices.some((n) => n.id === 'backup-failed' && n.persistent)).toBe(true);
    // The primary value is unchanged and no primary write happened.
    expect(storage.peek(STORAGE_KEY)).toBe('broken');
    expect(storage.setCalls().some((c) => c.key === STORAGE_KEY)).toBe(false);
  });
});

describe('loadStorage - newer version is read-only (AC-PERS-02.6, .18, EC-11)', () => {
  it('never writes and warns persistently', () => {
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION + 5, tasks: [], lastGoalCelebrationDate: null });
    const storage = createFakeStorage({ initial: { [STORAGE_KEY]: raw } });
    const result = loadStorage(storage);
    expect(result.storageMode).toBe('readOnly');
    expect(storage.setCalls()).toHaveLength(0);
    expect(result.notices.some((n) => n.id === 'newer-version' && n.persistent)).toBe(true);
    // Original newer-version data is untouched.
    expect(storage.peek(STORAGE_KEY)).toBe(raw);
  });
});

describe('loadStorage - storage unavailable (AC-PERS-02.8)', () => {
  it('returns memory-only for a null storage', () => {
    const result = loadStorage(null);
    expect(result.storageMode).toBe('memoryOnly');
    expect(result.notices.some((n) => n.id === 'storage-unavailable' && n.persistent)).toBe(true);
  });

  it('returns memory-only when getItem throws', () => {
    const storage = createFakeStorage({ throwOnGet: true });
    const result = loadStorage(storage);
    expect(result.storageMode).toBe('memoryOnly');
  });
});

describe('saveEnvelope (AC-PERS-01.1, AC-PERS-02.8, .9)', () => {
  it('writes the three-field envelope to the one fixed key', () => {
    const storage = createFakeStorage();
    const t = makeTask();
    const result = saveEnvelope(storage, [t], '2026-06-15');
    expect(result.status).toBe('ok');
    const sets = storage.setCalls();
    expect(sets).toHaveLength(1);
    expect(sets[0]!.key).toBe(STORAGE_KEY);
    const written = JSON.parse(sets[0]!.value!);
    expect(Object.keys(written).sort()).toEqual(['lastGoalCelebrationDate', 'schemaVersion', 'tasks']);
  });

  it('classifies a quota failure and does not throw (AC-PERS-02.9)', () => {
    const storage = createFakeStorage({ throwOnSet: true, setErrorKind: 'quota' });
    const result = saveEnvelope(storage, [makeTask()], null);
    expect(result.status).toBe('quota');
  });

  it('classifies a non-quota failure as unavailable (AC-PERS-02.8)', () => {
    const storage = createFakeStorage({ throwOnSet: true, setErrorKind: 'generic' });
    const result = saveEnvelope(storage, [makeTask()], null);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable for a null storage', () => {
    expect(saveEnvelope(null, [], null).status).toBe('unavailable');
  });

  it('a follow-up save after recovery writes the new data (EC-29)', () => {
    const storage = createFakeStorage({ initial: { [STORAGE_KEY]: 'corrupt' } });
    loadStorage(storage);
    const before = storage.setCalls().length;
    const t = makeTask();
    const result = saveEnvelope(storage, [t], null);
    expect(result.status).toBe('ok');
    expect(storage.setCalls().length).toBe(before + 1);
    expect(storage.peek(STORAGE_KEY)).toBe(serializeEnvelope([t], null));
  });
});

// Property 6: Corrupted-data recovery ordering
// Validates: Requirements 9.4, 9.15, 9.16
describe('Property 6: corrupted-data recovery ordering', () => {
  // Raw values that are guaranteed to be corrupted (not a valid envelope).
  const arbCorrupt = fc.oneof(
    fc.constant('{ not json'),
    fc.constant('null'),
    fc.constant('[]'),
    fc.constant('42'),
    fc.constant('"a string"'),
    fc.constant(JSON.stringify({ schemaVersion: 0, tasks: [] })),
    fc.constant(JSON.stringify({ tasks: [] })),
  );

  it('on backup success writes backup then primary; on backup failure no primary write', () => {
    fc.assert(
      fc.property(arbCorrupt, fc.boolean(), (raw, failBackup) => {
        const storage = createFakeStorage({
          initial: { [STORAGE_KEY]: raw },
          throwOnSetKeys: failBackup ? [BACKUP_KEY] : [],
        });
        const result = loadStorage(storage);
        const sets = storage.setCalls();

        if (failBackup) {
          return (
            result.storageMode === 'readOnly' &&
            result.tasks.length === 0 &&
            sets.every((c) => c.key !== STORAGE_KEY) &&
            storage.peek(STORAGE_KEY) === raw
          );
        }
        // Success: exactly backup then primary, primary untouched until step 5.
        return (
          sets.length === 2 &&
          sets[0]!.key === BACKUP_KEY &&
          sets[0]!.value === raw &&
          sets[1]!.key === STORAGE_KEY &&
          sets[1]!.value === EMPTY &&
          result.storageMode === 'normal'
        );
      }),
    );
  });
});

// Property 7: Newer schema is never written
// Validates: Requirements 9.6, 9.18
describe('Property 7: newer schema is never written', () => {
  it('results in read-only mode with zero writes during load', () => {
    fc.assert(
      fc.property(fc.integer({ min: SCHEMA_VERSION + 1, max: 10_000 }), (version) => {
        const raw = JSON.stringify({ schemaVersion: version, tasks: [], lastGoalCelebrationDate: null });
        const storage = createFakeStorage({ initial: { [STORAGE_KEY]: raw } });
        const result = loadStorage(storage);
        const wrote = storage.calls.some((c) => c.op === 'setItem' || c.op === 'removeItem');
        return result.storageMode === 'readOnly' && !wrote && storage.peek(STORAGE_KEY) === raw;
      }),
    );
  });
});
