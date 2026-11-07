# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: students juggling coursework and deadlines, using the app between study sessions. The phone is the daily device (quick capture, quick tick-off). The desktop matters for first impressions and must be equally fully usable. Secondary: everyday people organizing personal responsibilities, with the same job at a lighter weight. Single user on a single device: no accounts, no sync.

## Product Purpose

Make organizing everyday responsibilities engaging. The user summons a task as a restless spirit and releases it by completing it, and a haunted manor visibly recovers as real progress accumulates. The supernatural theme is part of the function, not decoration.

Success, in order of importance:
1. The user watches the manor visibly recover.
2. The user finishes the daily goal of 3 released spirits.
3. The user comes back the next day.

## Positioning

Restoration is computed from the user's actual tasks, so the manor and the data are the same thing. The stage comes from the number of completed tasks that currently exist, not from lifetime events, so reopening or deleting a completed task can make the manor regress honestly. There are six named stages with fixed thresholds: Abandoned (0), Awakening (1-4), Stirring (5-9), Illuminated (10-19), Restored (20-34), Enchanted (35+). A fixed daily goal of 3 releases carries a once-per-day celebration. A generic task app cannot truthfully copy a metaphor in which the progress display is the data.

## Operating Context

Used in the browser, between study sessions, on phone and laptop. Everything runs on the client and persists in the browser's LocalStorage on that device; there is no sync between devices or tabs. "Today", "overdue" and the daily goal follow the user's local calendar and reset at local midnight. The product is an entry in the Kiroween 2026 Costume Contest, where integrating the supernatural theme into the functionality (not only the look) is a hard requirement.

## Capabilities and Constraints

Confirmed functionality:
- Tasks: create, edit, delete, complete, reopen. Title is required. Optional description, due date and estimated duration. Categories: Study, Work, Personal, Health, Other. Priorities: Low, Medium, High. Creation and completion timestamps.
- Views: Today (due today or overdue), Upcoming, All Tasks, Completed. Title search, category and priority filters. Overdue tasks are clearly distinguished.
- Dashboard: manor, active and completed counts, daily progress toward 3, a ghost companion that reacts to summoning, releasing and reaching the daily goal, a welcoming empty state, and optional demo data that can be removed without touching the user's own tasks.
- Persistence: LocalStorage with a schema version. Stored data is validated. Corrupted data is backed up and the app starts fresh. Data written by a newer version, or a failed backup, puts the app in a read-only mode that never overwrites it. When storage is unavailable the app keeps working in memory and says so.

Binding technical constraints:
- React, TypeScript, Vite and CSS only. Runtime dependencies are limited to React, React DOM and Lucide React. No new runtime dependencies.
- No backend, authentication, cloud database or paid API.

Terminology (binding): the app name "Spectral Tasks"; the verbs summon, release, banish; "restless spirits"; "spirits released"; the six stage names above.

Out of scope for the MVP: AI chatbot, multiplayer, accounts, cloud sync, social features, complex 3D, payments. Stretch only, not yet decided: achievements, focus mode, weekly statistics, optional AI assistance.

Undecided: the visual world of the manor and ghost is decided in the design phase. There is no logo yet.

## Brand Commitments

- The name and the vocabulary listed above are binding.
- Copy tone: gently haunting and warm, never grim.
- No logo for now.
- Owner-stated direction: distinctive gothic fantasy, atmospheric, restrained decoration. The manor and the ghost are core product elements. A dark gothic theme is the only MVP theme.
- Owner-named anti-references: a generic dark SaaS dashboard, purple gradients, glassmorphism, glowing bordered cards, particle overload.

## Evidence on Hand

Real material: the running application and its specification in `.kiro/specs/spectral-tasks/` (requirements, design, tasks), `docs/manual-qa.md` (an empty checklist for the owner), and `docs/performance.md` (measurement procedure with every result still "Not yet measured").

Absent, and not to be fabricated: users, testimonials, usage data, benchmarks, a logo or other brand assets, and any measured performance result.

## Product Principles

1. Progress is the product. What the manor shows must always be true to the task data; never show restoration the data does not support.
2. The metaphor must do work. Summon, release and restore each carry real function; theme with no function does not belong.
3. Warm, not grim. Regression is honest but never scolding; the haunting is gentle.
4. The core loop is fast on a phone. Summoning a spirit, seeing what is due, and releasing it take as few steps as possible at 320px, and the desktop is equally capable.
5. Calm and reliable. Data is never silently lost, failures are explained plainly, and motion never blocks an action.

## Accessibility & Inclusion

- Every feature is operable by keyboard, with visible focus.
- Touch targets are at least 44 by 44 CSS pixels on narrow viewports.
- Text contrast is at least 4.5:1; large text and component boundaries are at least 3:1.
- Reduced-motion preferences are honored, and reactions remain available as text.
- Meaning is never carried by color alone.
- Usable from 320px to 1920px wide and at 200% zoom; state changes are announced through polite live regions.
- Full WCAG conformance has not been verified; it needs manual testing with assistive technology (see `docs/manual-qa.md`).
