import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  toLocalDateString,
  isRealCalendarDate,
  addDays,
  msUntilNextLocalMidnight,
  isoToLocalDate,
  formatDueDate,
} from './dates.ts';

// The test runner fixes TZ to America/New_York (see src/test/setup.ts), which
// observes daylight saving time, so the DST cases below are deterministic.

describe('isRealCalendarDate', () => {
  it('accepts the leap day Feb 29 in a leap year', () => {
    expect(isRealCalendarDate('2024-02-29')).toBe(true);
  });

  it('rejects Feb 29 in a non-leap year', () => {
    expect(isRealCalendarDate('2026-02-29')).toBe(false);
  });

  it('rejects Feb 30', () => {
    expect(isRealCalendarDate('2026-02-30')).toBe(false);
  });

  it('rejects out-of-range months and days', () => {
    expect(isRealCalendarDate('2026-13-01')).toBe(false);
    expect(isRealCalendarDate('2026-00-10')).toBe(false);
    expect(isRealCalendarDate('2026-01-32')).toBe(false);
    expect(isRealCalendarDate('2026-04-31')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isRealCalendarDate('2026-1-1')).toBe(false);
    expect(isRealCalendarDate('26-01-01')).toBe(false);
    expect(isRealCalendarDate('')).toBe(false);
    expect(isRealCalendarDate('not-a-date')).toBe(false);
  });
});

describe('addDays', () => {
  it('crosses a month end', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('crosses a year end in both directions', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles the leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('isoToLocalDate', () => {
  it('counts a 00:30 local completion on its own local day', () => {
    // 00:30 on 2026-03-10 in America/New_York (EST, UTC-5) is 05:30 UTC.
    const iso = new Date(2026, 2, 10, 0, 30, 0).toISOString();
    expect(isoToLocalDate(iso)).toBe('2026-03-10');
  });

  it('agrees with toLocalDateString for the same instant', () => {
    const d = new Date(2026, 6, 4, 23, 59, 0);
    expect(isoToLocalDate(d.toISOString())).toBe(toLocalDateString(d));
  });
});

describe('msUntilNextLocalMidnight (DST-aware)', () => {
  it('is 23 hours on the spring-forward day', () => {
    // US DST begins 2026-03-08: the local day is 23 hours long.
    const now = new Date(2026, 2, 8, 0, 0, 0, 0);
    expect(msUntilNextLocalMidnight(now)).toBe(23 * 60 * 60 * 1000);
  });

  it('is 25 hours on the fall-back day', () => {
    // US DST ends 2026-11-01: the local day is 25 hours long.
    const now = new Date(2026, 10, 1, 0, 0, 0, 0);
    expect(msUntilNextLocalMidnight(now)).toBe(25 * 60 * 60 * 1000);
  });

  it('is 24 hours on an ordinary day', () => {
    const now = new Date(2026, 6, 4, 0, 0, 0, 0);
    expect(msUntilNextLocalMidnight(now)).toBe(24 * 60 * 60 * 1000);
  });
});

describe('formatDueDate', () => {
  it('produces a non-empty human-readable string', () => {
    expect(formatDueDate('2026-07-04')).toMatch(/2026/);
  });
});

// Property 11: Calendar date validity
// Validates: Requirements 14.4, 15.2
describe('Property 11: calendar date validity', () => {
  const pad = (n: number, len: number) => n.toString().padStart(len, '0');

  it('matches the real Gregorian calendar for arbitrary y/m/d triples', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1900, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 31 }),
        (y, m, d) => {
          const s = `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
          // Oracle: a real date is one where JS Date keeps the same parts.
          const probe = new Date(Date.UTC(y, m - 1, d));
          const real =
            probe.getUTCFullYear() === y &&
            probe.getUTCMonth() === m - 1 &&
            probe.getUTCDate() === d;
          return isRealCalendarDate(s) === real;
        },
      ),
    );
  });

  it('addDays is reversible: addDays(addDays(d, n), -n) === d', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1900, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: -1000, max: 1000 }),
        (y, m, d, n) => {
          const date = `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
          return addDays(addDays(date, n), -n) === date;
        },
      ),
    );
  });
});

// Property 12: Next midnight is a future local day start
// Validates: Requirements 15.10, 15.12
describe('Property 12: next midnight is a future local day start', () => {
  it('returns a positive duration at most 25 hours landing on the next local day at 00:00', () => {
    fc.assert(
      fc.property(
        // Arbitrary instant within a wide range.
        fc.date({ min: new Date(2000, 0, 1), max: new Date(2099, 11, 31) }),
        (now) => {
          const ms = msUntilNextLocalMidnight(now);
          if (!(ms > 0 && ms <= 25 * 60 * 60 * 1000)) {
            return false;
          }
          const landing = new Date(now.getTime() + ms);
          const expectedNextDay = addDays(toLocalDateString(now), 1);
          return (
            toLocalDateString(landing) === expectedNextDay &&
            landing.getHours() === 0 &&
            landing.getMinutes() === 0 &&
            landing.getSeconds() === 0
          );
        },
      ),
    );
  });
});
