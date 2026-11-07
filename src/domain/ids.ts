// Unique identifier generation for Tasks (AC-TASK-01.4, AC-DATA-01.2).
//
// Uses the platform crypto.randomUUID when available, with a hand-written
// fallback so no runtime dependency is required (AC-NFR-01.5).

type RandomUuidCapable = { randomUUID: () => string };

function hasRandomUuid(value: unknown): value is RandomUuidCapable {
  return (
    typeof value === 'object' &&
    value !== null &&
    'randomUUID' in value &&
    typeof (value as RandomUuidCapable).randomUUID === 'function'
  );
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const globalCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (globalCrypto && typeof globalCrypto.getRandomValues === 'function') {
    globalCrypto.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/** RFC 4122 version 4 UUID built from random bytes. */
function fallbackUuid(): string {
  const bytes = getRandomBytes(16);
  // Set the version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    hex.push(bytes[i]!.toString(16).padStart(2, '0'));
  }
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}

/** Returns a new unique, non-empty identifier for a Task. */
export function createId(): string {
  const globalCrypto = (globalThis as { crypto?: unknown }).crypto;
  if (hasRandomUuid(globalCrypto)) {
    return globalCrypto.randomUUID();
  }
  return fallbackUuid();
}
