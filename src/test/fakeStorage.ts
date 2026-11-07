// A configurable in-memory StorageLike for tests, with a call log and the
// ability to throw on reads or writes (globally or for a specific key).

import type { StorageLike } from '../storage/storageService.ts';

export interface StorageCall {
  op: 'getItem' | 'setItem' | 'removeItem';
  key: string;
  value?: string;
}

export interface FakeStorageOptions {
  /** Initial contents. */
  initial?: Record<string, string>;
  /** Throw a quota DOMException on every setItem. */
  throwOnSet?: boolean;
  /** Throw on every getItem (storage unavailable). */
  throwOnGet?: boolean;
  /** Throw on setItem only for these keys. */
  throwOnSetKeys?: string[];
  /** Throw a generic (non-quota) error on set instead of a quota error. */
  setErrorKind?: 'quota' | 'generic';
}

export interface FakeStorage extends StorageLike {
  /** Ordered log of every operation. */
  readonly calls: StorageCall[];
  /** Direct read of the backing map, bypassing the log and any throw config. */
  peek(key: string): string | null;
  /** Writes made with setItem, in order (op === 'setItem'). */
  setCalls(): StorageCall[];
}

function makeError(kind: 'quota' | 'generic'): Error {
  if (kind === 'quota') {
    // jsdom provides DOMException.
    return new DOMException('Quota exceeded', 'QuotaExceededError');
  }
  return new DOMException('Access denied', 'SecurityError');
}

export function createFakeStorage(options: FakeStorageOptions = {}): FakeStorage {
  const map = new Map<string, string>(Object.entries(options.initial ?? {}));
  const calls: StorageCall[] = [];
  const errorKind = options.setErrorKind ?? 'quota';
  const throwKeys = new Set(options.throwOnSetKeys ?? []);

  return {
    calls,
    getItem(key: string): string | null {
      calls.push({ op: 'getItem', key });
      if (options.throwOnGet) {
        throw makeError('generic');
      }
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      calls.push({ op: 'setItem', key, value });
      if (options.throwOnSet || throwKeys.has(key)) {
        throw makeError(errorKind);
      }
      map.set(key, value);
    },
    removeItem(key: string): void {
      calls.push({ op: 'removeItem', key });
      map.delete(key);
    },
    peek(key: string): string | null {
      return map.has(key) ? map.get(key)! : null;
    },
    setCalls(): StorageCall[] {
      return calls.filter((c) => c.op === 'setItem');
    },
  };
}
