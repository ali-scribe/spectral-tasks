# Spectral Tasks

Your tasks are restless spirits haunting an abandoned manor. Release them by completing them, and the manor slowly comes back to life.

**Live:** https://spectral-tasks.vercel.app/

![Spectral Tasks on desktop: the manor hero band above the task list](docs/images/desktop-hero.png)

<img src="docs/images/mobile.png" alt="Spectral Tasks on a phone: compact dashboard, then the summon form" width="260">

## Features

- **Tasks:** create, edit, delete, complete and reopen. Title is required; description, due date and estimated minutes are optional, plus category and priority.
- **Four views:** Today, Upcoming, All Tasks and Completed, with title search and category and priority filters. Overdue tasks are clearly marked.
- **Daily goal:** release 3 spirits a day, with a once-per-day celebration.
- **Six manor stages:** Abandoned, Awakening, Stirring, Illuminated, Restored, Enchanted. The stage comes from the completed tasks that exist right now, so reopening or deleting one can make the manor regress honestly.
- **Ghost companion:** reacts when you summon, release, and reach the daily goal.
- **Spirit-released moment:** a wisp rises from the finished task toward the manor, and the windows light up when a stage is gained.
- **Demo data:** load sample spirits, and remove them later without touching your own.
- **Preview manor stages:** look at any stage without changing your real progress. Nothing is saved.
- **Local storage:** everything lives in your browser's LocalStorage.
  - Corrupted data is backed up, then the app starts fresh.
  - Data written by a newer version puts the app in read-only mode, so it is never overwritten.
  - If storage is unavailable, the app keeps working in memory and says so.

## How it was built with Kiro

The project follows spec-driven development. The full spec lives in [`.kiro/specs/spectral-tasks/`](.kiro/specs/spectral-tasks/):

- [`requirements.md`](.kiro/specs/spectral-tasks/requirements.md): numbered acceptance criteria and edge cases.
- [`design.md`](.kiro/specs/spectral-tasks/design.md): architecture, data model, accessibility and responsive layout.
- [`tasks.md`](.kiro/specs/spectral-tasks/tasks.md): the implementation plan, worked through one task at a time.

Other choices that shaped the code:

- **Pure domain layer.** Task rules, dates, manor stages, ghost decisions and the reducer are plain functions, separate from React.
- **Property-based tests** with [fast-check](https://github.com/dubzzz/fast-check) for the domain logic, alongside example and integration tests.
- **Design-review loop.** Playwright screenshots at phone and desktop sizes, reviewed with the Impeccable design skill, drove the manor and ghost redesign and the layout passes. [`DESIGN.md`](DESIGN.md) records the resulting design system.

## Tech stack

React, TypeScript, Vite and plain CSS, with design tokens in `src/styles/tokens.css`. Runtime dependencies are only `react`, `react-dom` and `lucide-react`. The manor and ghost are hand-written inline SVG. Tests use Vitest and Testing Library; Playwright is a dev-only tool for design screenshots.

## Run locally

```bash
npm install
npm run dev        # start the dev server
npm test           # run the tests once
npm run typecheck  # TypeScript check
npm run build      # typecheck and production build
```

## Accessibility

- Every feature works from the keyboard, with a visible focus ring and a skip link.
- Touch targets are at least 44 by 44 px on narrow screens.
- Changes are announced through polite live regions (spirit summoned, released, manor stage, preview).
- Reduced-motion preferences are honored: animations stop, and reactions stay available as text.
- Meaning never relies on color alone: overdue, completed and current states also carry text or an icon.
- Text contrast targets are checked by a unit test that reads the color tokens.

Full WCAG conformance has not been verified. It needs manual testing with assistive technology.

## Known limitations

- Single device: data stays in one browser's LocalStorage. There are no accounts and no sync between devices or tabs.
- Manual QA and performance measurements are tracked in [`docs/manual-qa.md`](docs/manual-qa.md) and [`docs/performance.md`](docs/performance.md); see those files for what has and has not been measured.

## License

See [`LICENSE`](LICENSE).
