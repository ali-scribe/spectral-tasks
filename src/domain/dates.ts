// Local-calendar date handling (REQ-DATE-01).
//
// All functions are pure. The current time is only ever obtained through an
// injected Clock, never Date.now(), so logic is testable with a fixed clock
// (AC-DATE-01.5, AC-DATE-01.12). Due dates are "YYYY-MM-DD" calendar strings
// with no time or time zone, compared as strings (AC-DATE-01.2, AC-DATE-01.7).

/** Replaceable source of the current date/time (AC-DATE-01.5). */
export type Clock = () => Date;

/** The default clock used in the running app. */
export const systemClock: Clock = () => new Date();

const DATE_STRING = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Converts a Date to a "YYYY-MM-DD" string using the local calendar date
 * (AC-DATE-01.1). Uses local getters, so no UTC conversion is applied.
 */
export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * True if the string is a real Gregorian calendar date in "YYYY-MM-DD" format,
 * accepting leap-day Feb 29 and rejecting impossible dates like Feb 30
 * (AC-VAL-01.4, AC-DATE-01.2).
 */
export function isRealCalendarDate(s: string): boolean {
  if (!DATE_STRING.test(s)) {
    return false;
  }
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(5, 7));
  const day = Number(s.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  // Rebuild the date in UTC and confirm the parts round-trip, which rejects
  // overflow such as 2026-02-30 (normalized by the Date constructor).
  const built = new Date(Date.UTC(year, month - 1, day));
  return (
    built.getUTCFullYear() === year &&
    built.getUTCMonth() === month - 1 &&
    built.getUTCDate() === day
  );
}

/**
 * Returns the calendar date n days from the given "YYYY-MM-DD" string. Uses
 * UTC arithmetic so it is unaffected by daylight-saving transitions
 * (design, Date Handling). The input is assumed to be a real calendar date.
 */
export function addDays(date: string, n: number): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const shifted = new Date(Date.UTC(year, month - 1, day + n));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(
    shifted.getUTCDate(),
  )}`;
}

/**
 * Milliseconds from `now` until the start of the next local day. Builds the
 * next local midnight from local date components rather than adding a fixed 24
 * hours, so 23-hour and 25-hour DST days are handled correctly
 * (AC-DATE-01.10, AC-DATE-01.12). The result is always positive.
 */
export function msUntilNextLocalMidnight(now: Date): number {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  const ms = nextMidnight.getTime() - now.getTime();
  // Guard against a non-positive result (should not happen with local parts).
  return ms > 0 ? ms : 1;
}

/**
 * Converts a UTC ISO completion timestamp to its local calendar date, so a
 * completion at 00:30 local time counts on the day it occurred
 * (AC-DATE-01.3, AC-DATE-01.4).
 */
export function isoToLocalDate(iso: string): string {
  return toLocalDateString(new Date(iso));
}

/**
 * Formats a "YYYY-MM-DD" due date in a human-readable local format
 * (AC-DATE-01.6). Builds a local Date from the parts only for formatting; no
 * comparison ever uses this.
 */
export function formatDueDate(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const local = new Date(year, month - 1, day);
  return local.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
