# Implementation Plan: Spectral Tasks

## Overview

Spectral Tasks is built bottom-up in TypeScript (React + Vite, strict mode). The order is:

1. Project setup and shared types.
2. Pure domain logic (dates, validation, tasks, selectors, manor, ghost, demo), each with its tests.
3. Storage parsing, persistence, corruption recovery, read-only mode and newer-schema protection, fully tested before any UI depends on them.
4. Reducer, context, persistence hook and date-change hook.
5. UI foundation (shell, notices, live regions, modal), then task management, views and filters, then dashboard (counts, progress, manor, ghost, demo data).
6. Responsive layout, reduced motion, accessibility checks, integration tests.
7. Performance data generator and measurement procedure (results are recorded by the owner, never assumed).
8. Final manual QA checklist and checkpoint.

Numbering convention for references: requirement `N.M` means Requirement N, acceptance criterion M. Example: `8.5` is AC-PERS-01.5, `9.4` is AC-PERS-02.4, `11.3` is AC-GHOST-01.3. Mapping of AC prefixes to requirement numbers: TASK-01 = 1, TASK-02 = 2, TASK-03 = 3, TASK-04 = 4, ORG-01 = 5, ORG-02 = 6, ORG-03 = 7, PERS-01 = 8, PERS-02 = 9, DASH-01 = 10, GHOST-01 = 11, MANOR-01 = 12, DATA-01 = 13, VAL-01 = 14, DATE-01 = 15, RESP-01 = 16, A11Y-01 = 17, A11Y-02 = 18, NFR-01 = 19, PERF-01 = 20.

Runtime dependencies are limited to `react`, `react-dom` and `lucide-react`. Everything else is a dev dependency. No stretch features (achievements, focus mode, statistics, AI) are included.

## Tasks

- [x] 1. Project setup and shared foundations
  - [x] 1.1 Scaffold the Vite + React + TypeScript project and tooling
    - Create `package.json`, `index.html`, `tsconfig.json` (`"strict": true`), `vite.config.ts` (with Vitest config, `environment: 'jsdom'`, `setupFiles: ['src/test/setup.ts']`, fixed `TZ` via a global setup such as `America/New_York`).
    - Runtime dependencies (exact versions): `react`, `react-dom`, `lucide-react` only. Dev dependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `fast-check`, and the React type packages.
    - Add scripts: `dev`, `build` (`tsc --noEmit && vite build`), `test` (`vitest --run`), `typecheck`.
    - Create `src/test/setup.ts` (registers jest-dom), minimal `src/main.tsx` and `src/App.tsx` placeholder.
    - Done when: `npm run build` and `npm run test` run without errors (no tests yet is acceptable with `--passWithNoTests`).
    - _Requirements: 19.1, 19.5, 19.6, 19.10_

  - [x] 1.2 Define domain types, constants and id generation
    - Create `src/domain/types.ts` (`Task`, `Category`, `Priority`, `TaskStatus`, `TaskSource`, `ViewId`, `ManorStageId`, `Filters`, `StorageEnvelope`, `Notice`, `StorageMode`, `AppState`) as closed unions.
    - Create `src/domain/constants.ts` (`DAILY_GOAL = 3`, `SCHEMA_VERSION = 1`, `STORAGE_KEY`, `BACKUP_KEY`, `MANOR_STAGES` with names, thresholds and descriptions).
    - Create `src/domain/ids.ts` with `createId()` using `crypto.randomUUID` with a hand-written fallback (no runtime package).
    - Done when: `npm run typecheck` passes and no `any` is used.
    - _Requirements: 8.4, 13.1, 13.2, 13.5, 13.6, 12.2, 19.1, 19.5_

  - [x]* 1.3 Write property test for unique ids
    - Create `src/domain/ids.test.ts`.
    - **Property 25: Unique ids**
    - **Validates: Requirements 1.4, 13.2**

  - [x]* 1.4 Write build-constraint tests
    - Create `src/test/constraints.test.ts` that reads `package.json` and asserts `dependencies` contains exactly `react`, `react-dom` and `lucide-react`.
    - Add a test that scans `src/**/*.ts(x)` (excluding test files) for the `any` type annotation pattern (`: any`, `as any`, `<any>`) and for `fetch(` / `XMLHttpRequest` (no network requests for app data).
    - _Requirements: 19.1, 19.5, 19.6_

- [x] 2. Dates and form validation (pure logic)
  - [x] 2.1 Implement `src/domain/dates.ts`
    - Implement `Clock` type, `toLocalDateString`, `isRealCalendarDate`, `addDays` (via `Date.UTC`), `msUntilNextLocalMidnight` (built from local components, DST-safe), `isoToLocalDate`, `formatDueDate`.
    - No `Date.now()` or browser globals other than `Date` construction from parameters.
    - Done when: functions compile and are exported with the signatures in the design.
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.10, 15.12, 19.2_

  - [x]* 2.2 Write tests for dates
    - Unit tests: leap day accepted, Feb 30 rejected, 00:30 completion counted on its local day, `addDays` across month and year ends, DST next-midnight in a DST time zone (23-hour and 25-hour days).
    - **Property 11: Calendar date validity**
    - **Validates: Requirements 14.4, 15.2**
    - **Property 12: Next midnight is a future local day start**
    - **Validates: Requirements 15.10, 15.12**

  - [x] 2.3 Implement `src/domain/validation.ts`
    - Implement `validateTaskInput(raw)` returning `{ ok: true, value } | { ok: false, errors }` with the rules: trimmed title 1 to 100, description at most 1000, due date empty or real calendar date, duration empty or whole number 1 to 1440, defaults `Other` / `Medium`, empty optionals to `null`. Past due dates are accepted.
    - Export the `RawTaskInput`, `ValidTaskInput`, `ValidationResult` types.
    - _Requirements: 1.3, 1.5, 1.6, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

  - [x]* 2.4 Write tests for validation
    - Boundary unit tests: title 100/101 characters, whitespace-only title, description 1000/1001, minutes 0/1/1440/1441/non-integer, Feb 30, past due date accepted.
    - **Property 10: Form input validation and defaults**
    - **Validates: Requirements 1.1, 1.3, 1.5, 1.6, 1.7, 1.9, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8**

- [x] 3. Task operations, selectors, manor, ghost decision and demo data (pure logic)
  - [x] 3.1 Implement `src/domain/tasks.ts`
    - `createTask(input, id, nowIso)` (status active, `completedAt: null`, `source: 'user'`), `updateTask` (preserves id, createdAt, completedAt, status, source), `completeTask`, `reopenTask`.
    - All functions pure; id and time are parameters.
    - _Requirements: 1.1, 1.4, 1.7, 1.9, 2.2, 2.5, 2.6, 4.1, 4.2, 4.4, 13.3, 13.7_

  - [x]* 3.2 Write tests for task operations
    - Unit tests: create defaults, edit keeps a completed task completed, complete/reopen timestamps, re-completion records a new timestamp.
    - **Property 9: Edit preserves immutable fields**
    - **Validates: Requirements 2.2, 2.5, 2.6, 13.7**

  - [x] 3.3 Implement `src/domain/selectors.ts`
    - `getViewTasks` (today, upcoming, all, completed ordered by `completedAt` descending), `applyFilters` (case-insensitive title contains, category, priority, conjunction), `compareActive` (due date ascending with null last, priority High > Medium > Low, `createdAt` ascending, `id` tie-break), `isOverdue`, `countCompletedOn`, `getCounts`.
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.7, 7.3, 7.4, 7.5, 7.6, 10.3, 10.10, 10.12, 15.3, 15.4_

  - [x]* 3.4 Write tests for selectors
    - Unit tests for each view, undated tasks only in All, overdue edge cases (due today, no due date, completed, reopened past-due), ordering, `countCompletedOn` with demo and user tasks.
    - **Property 13: View partition correctness**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**
    - **Property 14: Filters are a conjunction**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - **Property 15: Active ordering**
    - **Validates: Requirements 6.7**
    - **Property 16: Overdue classification**
    - **Validates: Requirements 7.3, 7.4, 7.5, 7.6**
    - **Property 17: Derived counts and daily progress**
    - **Validates: Requirements 10.3, 10.10, 10.12, 15.3, 15.4**

  - [x] 3.5 Implement `src/domain/manor.ts`
    - `getManorStage(n)` (highest stage whose threshold is at most n, clamped at 0) and `getNextStageInfo(n)` (null at stage 5).
    - _Requirements: 12.1, 12.2, 12.5, 12.7, 12.8, 12.9, 12.12_

  - [x]* 3.6 Write tests for manor
    - Table test of boundaries 0, 1, 4, 5, 9, 10, 19, 20, 34, 35 and next-stage info.
    - **Property 18: Manor stage is a monotonic function of the completed count**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.5, 12.9, 12.12**
    - **Property 19: Next-stage remaining count**
    - **Validates: Requirements 12.7, 12.8**

  - [x] 3.7 Implement `src/domain/ghost.ts`
    - `decideCompletionReaction` returning `'goal'` only if progress goes from below the goal to at or above it and `lastGoalCelebrationDate !== today`.
    - Export the ghost message constants (summon, celebrate, goal celebration, idle).
    - _Requirements: 11.1, 11.2, 11.3, 11.8, 11.16_

  - [x] 3.8 Implement `src/domain/demo.ts`
    - `createDemoTasks(today, nowIso, newId)` returning about six active tasks with `source: 'demo'` and due dates from `addDays` offsets (including an overdue, two today, tomorrow, +3 and one undated).
    - `removeDemoTasks(tasks)` filtering on `source` only.
    - _Requirements: 10.6, 10.7, 10.8, 10.9, 10.11, 13.7_

  - [x]* 3.9 Write tests for demo data
    - Unit test: a user task whose title equals a demo title survives removal; an edited demo task keeps `source: 'demo'` and is removed.
    - **Property 20: Demo removal affects only source demo**
    - **Validates: Requirements 10.9, 10.11, 2.6, 13.7**
    - **Property 21: Demo dates are relative to today**
    - **Validates: Requirements 10.7, 10.8**

- [x] 4. Checkpoint - Pure domain logic complete
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm run typecheck` and `npm run test`.

- [x] 5. Storage parsing, persistence and recovery (before any dependent UI)
  - [x] 5.1 Implement `src/storage/envelope.ts`
    - `serializeEnvelope(tasks, date)` writing exactly `schemaVersion`, `tasks`, `lastGoalCelebrationDate`.
    - `parseStoredValue(raw, migrations?)` that never throws and returns `corrupted`, `newer` or `ok`, following the check order in the design: JSON parse, envelope shape, newer version, migration chain (empty registry, injectable), per-task `validateStoredTask` (copies only the eleven known fields, rejects missing or unknown `source`, bad enums, bad dates, non-integer minutes, bad timestamps, `completedAt`/`status` mismatch, empty or duplicate ids), `sanitizeDate` for the celebration date (invalid gives `null`, not counted as discarded). Unknown envelope properties are ignored.
    - _Requirements: 8.3, 8.5, 8.7, 9.1, 9.2, 9.5, 9.6, 9.7, 9.10, 9.11, 9.12, 9.13, 9.14, 9.17, 9.18, 9.19, 13.1, 13.3, 13.5_

  - [x]* 5.2 Write tests for the envelope
    - Unit tests: truncated JSON, wrong shape, `schemaVersion` 0 / 1.5 / string, newer version, injected migration chain proving migrations run in order, shipped registry is empty, invalid category task discarded (EC-10), duplicate ids (EC-31), celebration date `"2026-02-30"` or a number (EC-24).
    - **Property 1: Storage round trip**
    - **Validates: Requirements 8.5**
    - **Property 2: Parsing never throws and classifies safely**
    - **Validates: Requirements 9.1, 9.2, 9.6, 9.10, 9.11**
    - **Property 3: Stored task validation keeps valid and discards invalid**
    - **Validates: Requirements 9.5, 9.13, 9.14, 13.1, 13.3**
    - **Property 4: Unknown properties are ignored and dropped**
    - **Validates: Requirements 9.18, 9.19**
    - **Property 5: Celebration date sanitation**
    - **Validates: Requirements 9.12**

  - [x] 5.3 Implement `src/storage/storageService.ts`
    - `StorageLike` interface, `loadStorage(storage | null)` and `saveEnvelope(storage | null, tasks, date)`.
    - `loadStorage` implements the exact six-step recovery: read primary, detect corruption, write raw value to `BACKUP_KEY`, confirm by reading it back and comparing, only then replace the primary value with an empty valid envelope, continue. Backup failure leaves the primary untouched, returns `readOnly` with an empty store and a persistent backup-failed notice. Newer version returns `readOnly` and performs no writes. Missing key writes nothing. Inaccessible storage returns `memoryOnly`.
    - `saveEnvelope` classifies `QuotaExceededError` / `NS_ERROR_DOM_QUOTA_REACHED` as quota and other failures as unavailable. Never throws.
    - Return values include notices (corrupted, discarded count, newer-version, storage-unavailable, quota, backup-failed) with `persistent` flags.
    - _Requirements: 8.1, 8.2, 8.4, 8.6, 9.3, 9.4, 9.5, 9.6, 9.8, 9.9, 9.10, 9.15, 9.16, 9.18_

  - [x]* 5.4 Write tests for the storage service
    - Create `src/test/fakeStorage.ts` (call log; can throw on `setItem` globally, on `getItem`, or only for a given key).
    - Unit tests: first run writes nothing (AC 8.6), backup failure (EC-28), step ordering, quota, unavailable, EC-29 follow-up write after recovery, read-only mode writes nothing.
    - **Property 6: Corrupted-data recovery ordering**
    - **Validates: Requirements 9.4, 9.15, 9.16**
    - **Property 7: Newer schema is never written**
    - **Validates: Requirements 9.6, 9.18**

- [x] 6. Checkpoint - Storage layer complete
  - Ensure all tests pass, ask the user if questions arise.
  - Confirm the recovery, read-only and newer-schema tests pass before starting UI work.

- [x] 7. State container, persistence and date-change hooks
  - [x] 7.1 Implement the reducer, actions and initial state
    - Create `src/state/actions.ts`, `src/state/reducer.ts`, `src/state/initialState.ts`.
    - Reducer is pure: ids and times arrive in action payloads. Handle all actions in the design (`CREATE_TASK`, `UPDATE_TASK`, `DELETE_TASK`, `COMPLETE_TASK`, `REOPEN_TASK`, `LOAD_DEMO` (ignored when tasks exist), `REMOVE_DEMO`, `DATE_CHECK`, `PERSIST_RESULT`, `GHOST_IDLE` (only when `seq` matches), `DISMISS_NOTICE`, `SET_VIEW` (keeps filters), `SET_FILTERS`, `CLEAR_FILTERS`, `OPEN_EDIT`, `CLOSE_EDIT`).
    - `COMPLETE_TASK` uses `decideCompletionReaction`, sets `lastGoalCelebrationDate`, ghost kind `goal` or `celebrate`, and an announcement naming the task. `DATE_CHECK` and `createInitialState` perform the Silent_Goal_Record without touching the ghost. Manor stage increase sets `manorNotice` only on completion or update, never on load. Unknown ids return the same state. Notices are de-duplicated by id.
    - _Requirements: 1.1, 2.2, 3.2, 3.4, 4.1, 4.2, 4.3, 5.8, 5.9, 6.5, 6.8, 10.4, 11.1, 11.2, 11.3, 11.6, 11.7, 11.8, 11.10, 11.11, 11.12, 11.13, 11.15, 11.16, 11.17, 11.18, 12.6, 12.11, 15.11_

  - [x]* 7.2 Write reducer tests
    - Unit tests: create, edit, delete, complete, reopen, demo load ignored when tasks exist, ghost replacement via `seq`, stale `GHOST_IDLE` ignored, goal reached then reopen then complete again same day (EC-8), new day allows a new celebration (EC-26), load with 3 completed today records silently (EC-25), completion and `DATE_CHECK` in the same interaction (EC-32), precedence of goal message (EC-33), degraded persistence still celebrates once per day (EC-27), manor stage increase announcement and no announcement on load.
    - **Property 8: Completion timestamp matches status**
    - **Validates: Requirements 1.4, 4.1, 4.2, 4.4, 13.2, 13.3**
    - **Property 22: Daily goal celebration plays at most once per local day**
    - **Validates: Requirements 11.3, 11.8, 11.11, 11.13**
    - **Property 23: Only completions can celebrate**
    - **Validates: Requirements 11.7, 11.10, 11.15, 15.11**
    - **Property 24: Goal celebration replaces the ordinary completion reaction**
    - **Validates: Requirements 11.2, 11.16, 11.17**

  - [x] 7.3 Implement the context provider, startup load and persistence hook
    - Create `src/state/AppContext.tsx` (`AppProvider`, `useAppState`, `useAppDispatch`, Clock via context).
    - Update `src/main.tsx` to call `loadStorage(window.localStorage)` once before rendering (guarded with try/catch for access errors) and build the initial state with `createInitialState`.
    - Create `src/state/usePersistence.ts`: effect on `[tasks, lastGoalCelebrationDate]`, writes only when values differ from the last loaded or saved values, skips when `storageMode !== 'normal'`, dispatches `PERSIST_RESULT`.
    - _Requirements: 8.1, 8.2, 8.7, 9.8, 9.9, 9.15, 9.16, 11.18, 18.6_

  - [x]* 7.4 Write persistence hook tests
    - With `fakeStorage`: a change writes once; read-only mode never writes; quota keeps change in memory with an error notice and later changes retry; unavailable switches to memory-only with a persistent notice; a Silent_Goal_Record is persisted.
    - _Requirements: 8.1, 9.8, 9.9, 11.13_

  - [x] 7.5 Implement `src/state/useDateChangeCheck.ts`
    - Listen to `visibilitychange` (when visible) and window `focus`; keep exactly one `setTimeout` for the next local midnight computed with the Clock; every check dispatches `DATE_CHECK` and clears and re-arms the timer. No `setInterval`.
    - _Requirements: 5.9, 15.8, 15.9, 15.10, 15.11, 15.12, 15.13_

  - [x]* 7.6 Write date-change hook tests
    - Fake timers and a controllable Clock: midnight timer fires and updates `today` (EC-5), hidden tab shown next day (EC-30), early timer is a no-op and re-arms, listeners removed on unmount, a test asserting `setInterval` is never called.
    - _Requirements: 15.8, 15.9, 15.10, 15.12, 15.13_

- [x] 8. UI foundation
  - [x] 8.1 Build the app shell, styles tokens and global feedback components
    - Create `src/styles/tokens.css` (colors from the design table), `base.css`, `layout.css` (skeleton only), and import them.
    - Create `SkipLink`, `AppHeader` (h1), `ErrorBoundary` (themed fallback with a reload button that does not touch stored data), `NoticeBar` (dismissible and persistent notices; errors use `role="alert"`), `LiveRegions` (two polite regions: action announcement and ghost message), `VisuallyHidden`.
    - Update `src/App.tsx` with providers, landmarks (`header`, `nav`, `main#main` with `tabIndex={-1}`, `aside`), and call `usePersistence` and `useDateChangeCheck`.
    - Global `:focus-visible` outline using `--focus`, never removed.
    - _Requirements: 9.3, 17.2, 17.7, 17.8, 17.10, 11.9, 18.1, 18.2, 19.9_

  - [x]* 8.2 Write tests for the shell
    - Unit test that recomputes WCAG contrast ratios from the CSS tokens: at least 4.5:1 for text pairs, at least 3:1 for borders and focus ring.
    - RTL tests: `ErrorBoundary` shows the fallback when a child throws; `NoticeBar` shows dismissible versus persistent notices; skip link is the first focusable element; live regions are present.
    - _Requirements: 17.7, 17.8, 17.10, 18.1, 18.2, 19.9_

  - [x] 8.3 Implement `Modal` and `ConfirmDialog`
    - Custom focus-trapping modal: `role="dialog"` (`alertdialog` for confirm), `aria-modal`, `aria-labelledby`, stores the opener, focuses the first focusable element (or the heading for confirm), traps Tab and Shift+Tab, closes on Escape without saving, restores focus to the opener.
    - _Requirements: 17.4, 17.5, 17.6, 3.1_

  - [x]* 8.4 Write modal tests
    - `user-event` tests: focus moves into the dialog, Tab and Shift+Tab wrap, Escape closes, focus returns to the opener.
    - _Requirements: 17.4, 17.5, 17.6_

- [x] 9. Task management UI
  - [x] 9.1 Implement `TaskForm` (create and edit modes)
    - Fields: title, description, category, priority, due date (`type="date"`), estimated minutes, each with a visible label. Uses `validateTaskInput` on submit.
    - Errors are `<p id>` linked by `aria-describedby` with `aria-invalid`; focus moves to the first invalid field; editing a field clears its error. After a successful create, clear fields and focus the title via a ref. On create dispatch `CREATE_TASK` with `createId()` and the Clock time.
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 14.1, 14.9, 14.10, 14.11_

  - [x] 9.2 Implement `TaskList` and `TaskItem`
    - `TaskItem` (wrapped in `React.memo`) shows title, category and priority as text, formatted due date, "Overdue" label with an icon, and a single complete/reopen toggle (checked state plus the word "Released" when completed). Edit and delete icon buttons have `aria-label`s that include the title; icons use `aria-hidden`.
    - Complete dispatches `COMPLETE_TASK` with Clock time and `today`; reopen and delete-request dispatch accordingly. Demo tasks behave like user tasks.
    - _Requirements: 3.1, 4.5, 4.6, 7.1, 7.2, 7.3, 17.3, 17.9, 20.2_

  - [x] 9.3 Implement `TaskFormDialog` (edit) and delete confirmation
    - Edit opens `TaskForm` in a `Modal` prefilled from the task via `OPEN_EDIT`; Cancel and Escape discard changes; failed validation leaves the saved task unchanged; saving dispatches `UPDATE_TASK`.
    - Delete uses `ConfirmDialog` naming the task title; confirm dispatches `DELETE_TASK`, cancel changes nothing.
    - _Requirements: 2.1, 2.3, 2.4, 3.1, 3.2, 3.3, 17.5, 17.6_

  - [x] 9.4 Wire the task column into `App`
    - Place `TaskForm` in the side column and `TaskList` (default view `today`) in the work column; mount `TaskFormDialog` and the delete `ConfirmDialog`; announce create, edit, complete, reopen and delete through the live region.
    - _Requirements: 1.1, 2.1, 3.2, 4.5, 17.8_

  - [x]* 9.5 Write component tests for task management
    - RTL tests: create (and fields clear, focus returns to title), whitespace title error and focus on first invalid field, edit (prefilled, save, cancel, invalid keeps saved values, completed task stays completed), delete confirm and cancel, complete and reopen with overdue label removed and restored, announcements in the live region.
    - _Requirements: 1.1, 1.3, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 7.3, 7.6, 14.10, 14.11, 17.8_

- [x] 10. Views, search and filters
  - [x] 10.1 Implement `ViewNav`, `FilterBar` and `EmptyState`
    - `ViewNav` has four buttons with `aria-current="page"` on the selected view; `FilterBar` has a search input, category select, priority select and a clear button; `EmptyState` shows a view-specific themed message or the distinct "no matching spirits" message.
    - Default view is Today; switching views leaves filters unchanged.
    - _Requirements: 5.1, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8_

  - [x] 10.2 Wire views, filters and sorting into `TaskList`
    - Compute the displayed list with `useMemo` using `getViewTasks`, `applyFilters`, `compareActive`, keyed on `tasks`, `today`, `view` and `filters`. Show `EmptyState` when appropriate.
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.9, 6.7, 7.1_

  - [x]* 10.3 Write component tests for views and filters
    - RTL tests: each view's contents, current-view indication, empty-view message versus no-match message, combined filters, clear filters, filters kept across view changes, ordering, a task with an active filter being edited (EC-18), Today view recomputes after a midnight Clock change without reload.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.9, 6.1, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 11. Dashboard: counts, progress, manor, ghost and demo data
  - [x] 11.1 Implement `CountsPanel`, `DailyProgress` and `ManorStatus`
    - Counts and "N of 3" text with a `<progress>` element, all derived at render time (`getCounts`, `countCompletedOn`, `getManorStage`, `getNextStageInfo`).
    - `ManorStatus` shows the stage name, the remaining count to the next stage or the fully restored message at stage 5, and announces a stage increase from `manorNotice`.
    - _Requirements: 10.1, 10.3, 10.4, 10.12, 12.6, 12.7, 12.8, 8.7_

  - [x] 11.2 Implement `ManorView` as inline SVG with stage classes
    - One `<svg viewBox="0 0 400 260" role="img">` with `<title>` text from the stage description, root class `manor manor--stage-N`, layers shown by stage in `src/styles/manor.css`. Each stage looks visibly different; stage 0 is a ruined dark manor. Decorative only, not focusable.
    - _Requirements: 12.3, 12.4, 12.10, 12.11_

  - [x] 11.3 Implement `GhostCompanion` and `motion.css`
    - Renders idle, summon, celebrate and goal poses from `state.ghost` with visible message text; schedules `GHOST_IDLE` with the matching `seq` using a timer equal to the CSS animation length.
    - Create `src/styles/motion.css`: CSS-only animations of at most about 1.2 s, no more than three flashes per second, and a `prefers-reduced-motion: reduce` block that disables animations and transitions while the pose label and message stay visible. Task controls are never disabled during animation.
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.6, 11.9, 11.18, 18.3, 18.4, 18.5, 18.6_

  - [x] 11.4 Implement `EmptyWelcome` and demo data controls
    - Welcome state invites the user to summon the first spirit and shows "Load demo data" only when there are zero tasks; "Remove demo data" shows while any task has `source: 'demo'` and opens a `ConfirmDialog`. Loading dispatches `LOAD_DEMO` with `createDemoTasks`; removal dispatches `REMOVE_DEMO`.
    - _Requirements: 10.5, 10.6, 10.7, 10.9, 10.11_

  - [x] 11.5 Compose `Dashboard` and wire it into `App`
    - Compose manor, status, counts, progress, ghost, welcome state and demo controls at the top of the side column. Wire stage-increase and ghost messages to the live regions.
    - _Requirements: 10.1, 10.2, 10.4, 11.9, 12.6_

  - [x]* 11.6 Write component tests for the dashboard
    - RTL tests: counts and progress update in the same interaction; empty state and demo load; demo removal keeps a user task titled like a demo task (EC-21) and removes an edited demo task (EC-22); manor stage class and title text per stage; no stage announcement on load, announcement on increase, regression after reopen or delete; once-per-day celebration; celebration message replaces the ordinary message while the live region still announces the completion; completion plus date check in the same interaction; ghost never celebrates on reopen or delete; task controls usable during animation.
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7, 10.9, 10.11, 11.2, 11.3, 11.7, 11.8, 11.15, 11.16, 11.17, 12.3, 12.5, 12.6, 12.7, 12.8, 12.11_

- [x] 12. Checkpoint - Core app functional
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm run build` and `npm run test`.

- [x] 13. Responsive layout and motion safety
  - [x] 13.1 Finalize responsive layout styles
    - Complete `src/styles/layout.css` and component styles: mobile-first single column below 768 px (order: header, notices, dashboard with compact manor, create form, view nav, filters, list); at 768 px and above `grid-template-columns: minmax(280px, 380px) 1fr` with the dashboard and form on the left and view nav, one-row filters and list on the right.
    - Long titles use `overflow-wrap: anywhere`; no horizontal scroll at 320 px; sizes in `rem` and `%` so 200% zoom reflows; below 768 px `button, select, input` have a minimum 44 by 44 px target. At 1024 by 768 the dashboard (manor, counts, progress), view nav and first task or empty message fit without scrolling. The task list scrolls vertically.
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8_

  - [x]* 13.2 Write a reduced-motion style test
    - Test that reads `src/styles/motion.css` and asserts a `prefers-reduced-motion: reduce` block disables `animation` and `transition`, and that the ghost component still renders its message text when reduced motion is requested (EC-16).
    - _Requirements: 18.3, 18.4, 18.5_

- [x] 14. Integration and accessibility tests
  - [x] 14.1 Write integration tests for storage-failure scenarios through the full app
    - Render `App` with `fakeStorage` and check: corrupted data shows a dismissible notice and the backup exists (EC-9); one invalid task shows the discarded count (EC-10); newer version is read-only with a persistent notice and no writes (EC-11); unavailable storage works in memory with a notice (EC-12); quota failure keeps the change in memory with an error notice (EC-13); backup failure is read-only with a persistent notice (EC-28); persistence round trip across a remount.
    - _Requirements: 8.1, 8.2, 8.6, 9.3, 9.5, 9.6, 9.8, 9.9, 9.15, 19.4_

  - [x]* 14.2 Write accessibility integration tests
    - Keyboard-only flow with `user-event`: create, complete, edit, delete and filter using Tab, Enter, Space and Escape; every icon-only button has an accessible name; landmarks and heading levels present; overdue state conveyed by text; priority, category and completion shown with text.
    - _Requirements: 17.1, 17.3, 17.5, 17.6, 17.7, 17.9, 7.2_

- [x] 15. Performance verification assets (Requirement 20)
  - [x] 15.1 Create the deterministic data set generator
    - Create `scripts/perf/generate-dataset.ts` using a seeded PRNG (for example mulberry32 with a fixed seed). It writes two Storage_Envelope JSON files using `serializeEnvelope`: (a) 500 active tasks plus 1 completed task (for the reopen measurement) for the All Tasks interaction series; (b) 500 representative mixed active and completed tasks for the cold-load series.
    - Add an npm script `perf:data`. Add a unit test that two runs produce identical output.
    - _Requirements: 20.2, 20.3, 20.4_

  - [x] 15.2 Write `docs/performance.md` measurement procedure
    - Document: reference environment (production build from `vite build` served by `vite preview`, current stable Chrome, at least 4 cores and 8 GB, extensions disabled, no CPU throttling); how to load each data set; start and end points (click or Enter on complete/reopen; submit of the edit form; confirm in the delete dialog; end is the next completed paint); median of 10 runs for the 200 ms interaction target on the All Tasks view; median of 5 cold loads for the 2-second initial-load target from navigation start to the first input handled, with cleared HTTP cache, fresh profile and no extensions; each series labelled cold or warm; record CPU model, cores, memory, OS and exact Chrome version.
    - Include results tables that start empty with the text "Not yet measured". The document must not state that any target is met until a result is recorded by the owner.
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8_

- [ ] 16. Manual QA checklist
  - [x] 16.1 Write `docs/manual-qa.md`
    - Checklist for the owner covering: keyboard-only use of every feature and visible focus; skip link; screen-reader spot check of live regions; widths 320, 768, 1024x768 and 1920 and 200% zoom (no horizontal scroll at 320, all controls available at 200%); reduced motion enabled in the OS or DevTools; contrast spot check against tokens; storage failure scenarios (corrupted value, newer schema, blocked storage, quota, backup failure); local midnight rollover; cross-browser smoke check in Chrome, Firefox, Safari and Edge; and recording of the performance results from `docs/performance.md`.
    - Each item has an empty pass/fail and notes column.
    - _Requirements: 16.1, 16.2, 16.6, 16.7, 17.1, 17.2, 18.1, 18.2, 18.3, 19.10, 20.8_

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm run typecheck`, `npm run build` and `npm run test`; confirm the constraint tests pass (three runtime dependencies, no `any`, no network calls).
  - The owner completes `docs/manual-qa.md` and records measurements in `docs/performance.md`.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP. Property tests are tied to the numbered properties in the design and carry their Validates references. Tag each property test with `// Feature: spectral-tasks, Property N: <title>` and run at least 100 iterations.
- Pure logic and storage are implemented and tested before any React component that depends on them.
- Checkpoints (tasks 4, 6, 12 and 17) are the places to run the build and the full test suite.
- Performance and manual QA tasks only create the generator and documents. The owner runs the measurements; nothing in this plan states that a target is met.

## Requirements Coverage Check

| Requirement | Covered by tasks |
|-------------|------------------|
| 1 Create (REQ-TASK-01) | 3.1, 7.1, 9.1, 9.4, 9.5 |
| 2 Edit (REQ-TASK-02) | 3.1, 3.2, 9.3, 9.5 |
| 3 Delete (REQ-TASK-03) | 7.1, 9.2, 9.3, 9.5 |
| 4 Complete and reopen (REQ-TASK-04) | 3.1, 7.1, 9.2, 9.5 |
| 5 Views (REQ-ORG-01) | 3.3, 3.4, 7.5, 10.1, 10.2, 10.3 |
| 6 Sort, search, filter (REQ-ORG-02) | 3.3, 3.4, 10.1, 10.2, 10.3 |
| 7 Overdue (REQ-ORG-03) | 3.3, 3.4, 9.2, 9.5 |
| 8 Persistence (REQ-PERS-01) | 1.2, 5.1, 5.2, 5.3, 7.3, 7.4, 14.1 |
| 9 Validation and failure (REQ-PERS-02) | 5.1 to 5.4, 7.3, 7.4, 14.1, 8.1 |
| 10 Dashboard (REQ-DASH-01) | 3.8, 3.9, 11.1, 11.4, 11.5, 11.6 |
| 11 Ghost (REQ-GHOST-01) | 3.7, 7.1, 7.2, 11.3, 11.6 |
| 12 Manor (REQ-MANOR-01) | 3.5, 3.6, 11.1, 11.2, 11.6 |
| 13 Data model (REQ-DATA-01) | 1.2, 3.1, 5.1, 5.2 |
| 14 Validation rules (REQ-VAL-01) | 2.3, 2.4, 9.1, 9.5 |
| 15 Dates (REQ-DATE-01) | 2.1, 2.2, 7.5, 7.6 |
| 16 Responsive (REQ-RESP-01) | 13.1, 16.1 |
| 17 Keyboard and semantics (REQ-A11Y-01) | 8.1, 8.3, 8.4, 9.2, 14.2 |
| 18 Contrast and reduced motion (REQ-A11Y-02) | 8.1, 8.2, 11.3, 13.2 |
| 19 Quality (REQ-NFR-01) | 1.1, 1.2, 1.4, 8.2, 14.1, 17 |
| 20 Performance (REQ-PERF-01) | 9.2, 15.1, 15.2, 16.1 |

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.3", "3.5", "3.7", "5.1"] },
    { "id": 4, "tasks": ["2.4", "3.1", "3.4", "3.6", "5.2", "5.3", "15.1"] },
    { "id": 5, "tasks": ["3.2", "3.8", "5.4", "15.2"] },
    { "id": 6, "tasks": ["3.9", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.5"] },
    { "id": 8, "tasks": ["7.4", "7.6", "8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3"] },
    { "id": 10, "tasks": ["8.4", "9.1"] },
    { "id": 11, "tasks": ["9.2", "9.3", "10.1", "11.1", "11.2", "11.3", "11.4"] },
    { "id": 12, "tasks": ["9.4"] },
    { "id": 13, "tasks": ["9.5", "10.2"] },
    { "id": 14, "tasks": ["10.3", "11.5"] },
    { "id": 15, "tasks": ["11.6", "13.1", "13.2"] },
    { "id": 16, "tasks": ["14.1", "14.2"] },
    { "id": 17, "tasks": ["16.1"] }
  ]
}
```
