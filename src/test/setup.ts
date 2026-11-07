// Vitest global setup.
//
// Fix the time zone for every test run so date-sensitive logic (Local_Today,
// overdue classification, DST next-midnight scheduling) is deterministic on any
// machine or CI. America/New_York observes daylight saving time, which lets the
// DST tests exercise 23-hour and 25-hour local days (design, AC-DATE-01.*).
process.env.TZ = 'America/New_York';

import '@testing-library/jest-dom/vitest';
