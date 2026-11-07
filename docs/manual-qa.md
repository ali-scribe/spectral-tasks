# Manual QA checklist (Task 16.1)

**Status: nothing has been verified.** Every result below reads "Not yet verified", every Notes cell is empty and every sign-off is empty. This document records no outcomes. The owner fills it in by hand while testing.

The automated tests run in jsdom, which has no layout engine, no real browser focus handling, no real assistive technology and no real LocalStorage. This checklist covers what jsdom cannot verify, plus the manual items required by the spec (Requirements 16.1, 16.2, 16.6, 16.7, 17.1, 17.2, 18.1, 18.2, 18.3, 19.10 and 20.8).

## How to use this document

- Work through the sections in order. Each row is one check with a unique ID (for example `K4`).
- **Result:** replace "Not yet verified" with `Pass`, `Fail` or `N/A` once you have checked it. Leave it alone if you have not checked it.
- **Notes:** write what you saw, especially for every Fail and for every item marked "observe and record".
- A Fail is not fixed in this document. Open a separate task for it.
- Use a throwaway browser profile for the storage sections. They overwrite and fill LocalStorage for the site.

### Which build to test

| Use | Command | Notes |
|-----|---------|-------|
| Smoke test (section 1) | `npm run dev` | Vite prints the URL. If port 5173 is already taken it silently picks another port, so open the URL it prints, and stop any old dev server first. An old server can show an outdated, unstyled page. |
| Everything else | `npm run build`, then `npm run preview` | Tests the production build. Vite prints the URL (its default is `http://localhost:4173`). |

### Environment record (complete once per testing session)

| Field | Value |
|-------|-------|
| Date tested | Not yet verified |
| Git commit of the build | Not yet verified |
| Operating system | Not yet verified |
| Browser and exact version | Not yet verified |
| Screen reader and version (section 4) | Not yet verified |
| Display size and scaling | Not yet verified |
| Notes | |

## 1. Smoke test (dev server and production build)

Requirement links: persistence (8.1, 8.2), no network requests for app data (19.6).

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| S1 | Run `npm run dev` and open the URL it prints. | A dark, styled page: header "Spectral Tasks", a manor illustration, counts, a daily goal bar, a ghost, a "Summon a spirit" form and a task area. It is not a plain unstyled page. | Not yet verified | |
| S2 | In "Summon a spirit", enter the title `QA smoke task`, set the due date to today, and press "Summon spirit". | The task appears in the **Today** view. The ghost reacts. The form clears and focus returns to the Title field. | Not yet verified | |
| S3 | Press F5 to refresh. | `QA smoke task` is still listed in Today. The counts are unchanged. | Not yet verified | |
| S4 | Close the tab, then open the same URL again. | `QA smoke task` is still listed. | Not yet verified | |
| S5 | Open DevTools, then Application, then Local Storage. | A key `spectral-tasks:data` exists. Its JSON has exactly the fields `schemaVersion`, `tasks` and `lastGoalCelebrationDate`. | Not yet verified | |
| S6 | Open the Console while doing S1 to S4. | No errors or warnings from the app. | Not yet verified | |
| S7 | Open the Network panel and reload. | Only the page's own files are requested (HTML, JS, CSS). No requests to other hosts for app data. | Not yet verified | |
| S8 | Stop the dev server. Run `npm run build` and `npm run preview`. Repeat S2 to S7 on the printed URL. | Same results as the dev server. | Not yet verified | |

## 2. Keyboard-only use and visible focus

Requirement links: 17.1, 17.2 (AC-A11Y-01.1 to .6, .10). Use only the keyboard for this whole section. Put the mouse away.

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| K1 | Reload the page, then press Tab once. | The first focus lands on the "Skip to main content" link, and the link becomes visible when focused. | Not yet verified | |
| K2 | Press Enter on the skip link, then Tab once. | The page moves to the main content. The next Tab goes to the first control inside the main area (not back to the header). | Not yet verified | |
| K3 | Tab through the entire page, then Shift+Tab back. | Every interactive control is reached in a logical order (left column, then the task area). There is no keyboard trap outside dialogs. Nothing interactive is skipped. | Not yet verified | |
| K4 | While tabbing, look at every kind of control: links, buttons, checkboxes, text and search inputs, textarea, selects, the date input, the number input, view buttons, icon buttons and the notice dismiss button. | A clearly visible focus ring appears on each one: a thick light-yellow outline with a small gap. It is visible on both the page background and the card (surface) background. It is never missing or cut off. | Not yet verified | |
| K5 | Create a task: Tab to Title, type a title, press Enter. | The task is created. The form clears and focus returns to the Title field. | Not yet verified | |
| K6 | Move to a task's checkbox and press Space. Then find it in Completed and press Space on its checkbox. | The task is released and then reopened. The state is clear from the text ("Released" or "Active"). | Not yet verified | |
| K7 | Press Enter on a task's "Edit" button. | The edit dialog opens and focus moves into it, onto the first field, with the values filled in. | Not yet verified | |
| K8 | In the edit dialog, change the title, then press Escape. | The dialog closes without saving. Focus returns to the "Edit" button that opened it. | Not yet verified | |
| K9 | Open the edit dialog again, change the title, Tab to "Save spirit" and press Enter. | The change is saved and the dialog closes. | Not yet verified | |
| K10 | With a dialog open, press Tab repeatedly, then Shift+Tab repeatedly. | Focus stays inside the dialog and wraps from last to first and first to last. | Not yet verified | |
| K11 | Press Enter on a task's "Delete" button, then press Escape. | The task stays. Focus returns to the "Delete" button. | Not yet verified | |
| K12 | Press Enter on "Delete" again, move to "Banish" and press Enter or Space. | The task is removed. | Not yet verified | |
| K13 | **Focus after deleting a task (observe and record).** Right after K12, note exactly where keyboard focus is, then press Tab once and note where it goes. | The spec does not define where focus must land, because the control that opened the dialog no longer exists. Record what you observe. Mark Pass only if you can continue working by keyboard without losing your place badly; mark Fail if focus is lost (for example, the next Tab starts from the very top of the page). This is an owner judgment. | Not yet verified | |
| K14 | Use the view buttons (Today, Upcoming, All Tasks, Completed), type in the search box, change the two selects, and press "Clear filters". | All work by keyboard. The current view is shown as selected. | Not yet verified | |
| K15 | With no tasks stored, use "Load demo data", then "Remove demo data" and confirm in the dialog. | Both work by keyboard. Only demo tasks are removed. | Not yet verified | |
| K16 | Trigger any notice (see section 9) and press Enter on its "Dismiss notice" button. | The notice disappears. Persistent notices have no dismiss button. | Not yet verified | |

## 3. Reduced motion

Requirement links: 18.3 (AC-A11Y-02.3 to .6). Turn on the setting in the OS (for example "Show animations" off on Windows, "Reduce motion" on macOS) or in Chrome DevTools: Rendering panel, "Emulate CSS media feature prefers-reduced-motion: reduce". Reload after changing it.

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| M1 | With reduced motion **off**, watch the ghost at rest. | The ghost bobs gently. | Not yet verified | |
| M2 | With reduced motion **off**, create a task, complete a task, and complete the third task of the day. | Each reaction plays once, in about a second or less. No strobing or rapid flashing (no more than three flashes in any one second). | Not yet verified | |
| M3 | With reduced motion **off**, click other controls while a ghost reaction is playing. | Every control still responds immediately. Nothing is delayed or blocked. | Not yet verified | |
| M4 | Turn reduced motion **on** and reload. Watch the ghost at rest. | The ghost is still. | Not yet verified | |
| M5 | With reduced motion on, create a task and complete tasks, including the third task of the day. | There is no movement or animation. The reaction **message** still appears as text each time. | Not yet verified | |
| M6 | With reduced motion on, change the manor stage (see MV in section 11) and look at the fog in the manor. | The stage changes without any transition. The fog does not drift. | Not yet verified | |
| M7 | With reduced motion on, use dialogs, the skip link, buttons and the progress bar. | No decorative motion anywhere. | Not yet verified | |

## 4. Screen reader spot check (live regions and names)

Requirement links: 17.1 and the live-region criteria (AC-A11Y-01.8, AC-GHOST-01.9). Use any real screen reader (for example NVDA with Firefox or Chrome on Windows, VoiceOver with Safari on macOS) and write which one in the environment record.

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| SR1 | Open the landmarks and headings lists. | Landmarks: banner, navigation "Task views", main, complementary "Manor and progress", plus the named sections. One level-1 heading "Spectral Tasks", and level-2 headings for each section. | Not yet verified | |
| SR2 | Create a task. | "Spirit summoned" is announced politely, without stealing focus. | Not yet verified | |
| SR3 | Release a task. | "Spirit released: " followed by the task title is announced. | Not yet verified | |
| SR4 | Reopen a task, edit a task, delete a task. | "Spirit reopened", "Spirit updated" and "Spirit banished" are announced. | Not yet verified | |
| SR5 | Complete the third task of the day. | The completion is announced, and the ghost's daily-goal message is announced. | Not yet verified | |
| SR6 | Push the manor to a higher stage (see MV in section 11). | "The manor has risen to ..." with the stage name is announced. | Not yet verified | |
| SR7 | Trigger an error notice (section 9, quota) and a warning notice (corrupted data). | The error is announced assertively as an alert. The warning is announced politely. | Not yet verified | |
| SR8 | Move through a task row. | The checkbox is read as "Release spirit: <title>" (or "Reopen spirit: <title>") with its checked state. The edit and delete buttons are read as "Edit spirit: <title>" and "Delete spirit: <title>". "Overdue", the category, the priority and "Released" or "Active" are read as text. | Not yet verified | |
| SR9 | **Ghost message heard and seen (observe and record).** Complete several tasks in a row with the screen reader running. Compare what you hear after each action: the action announcement and then the ghost's message. | The ghost message is both visible on screen and announced. This is how the spec is built. Decide whether hearing both is acceptable. Mark Fail if it feels repetitive, noisy or unpleasant to use, and describe why in Notes. This is an owner judgment, not a spec violation by itself. | Not yet verified | |

## 5. Widths: 320, 768, 1024x768 and 1920

Requirement links: 16.1, 16.2, 16.7 (AC-RESP-01.1 to .5, .7, .8). Use the production build. In Chrome DevTools use the device toolbar in "Responsive" mode and type the exact width, or resize a real window. Start each width from a loaded page scrolled to the top. To get content on the page, click "Load demo data" first, or use data set A from `docs/performance.md`.

### 320 CSS pixels wide

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| W320-1 | Look for a horizontal scrollbar, and scroll sideways. | **No horizontal scrolling.** Everything fits the width. | Not yet verified | |
| W320-2 | Create a task whose title is one unbroken 100 character string (for example the letter `a` repeated 100 times). | The title wraps inside its row. It does not push the page wider. | Not yet verified | |
| W320-3 | Scroll from top to bottom. | One column in this order: header, notices (if any), dashboard with a compact manor (about 160 px tall), "Summon a spirit" form, view buttons, filters, task list. | Not yet verified | |
| W320-4 | Use the form, the view buttons, the filters, a task's checkbox, edit and delete, and both dialogs. | Everything is usable. Nothing is cut off or overlapping. Dialogs fit the screen and scroll if needed. | Not yet verified | |
| W320-5 | Inspect the size of buttons, selects, inputs and checkboxes. | Interactive controls are at least 44 by 44 CSS pixels (AC-RESP-01.5). Note any smaller control, including the task checkbox and its label area. | Not yet verified | |

### 768 CSS pixels wide (also check 767)

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| W768-1 | At exactly 767 px, then at 768 px. | At 767 px the layout is one column. At 768 px it switches to two columns. | Not yet verified | |
| W768-2 | At 768 px, look at the columns. | The left column (about 280 to 380 px) holds the dashboard and the create form. The right column holds the view buttons, filters and the task list. | Not yet verified | |
| W768-3 | At 768 px, look for horizontal scrolling and clipped controls, including the filter bar. | No horizontal scroll. The filter controls wrap neatly if they do not fit one row. | Not yet verified | |

### 1024 x 768 CSS pixels

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| W1024-1 | Set the viewport to exactly 1024 by 768, with the page scrolled to the top and **no tasks stored** (empty state). | Without scrolling you can see: the manor, the counts, the daily progress, the view buttons, and the empty-state message of the current view (AC-RESP-01.7). | Not yet verified | |
| W1024-2 | Same viewport, with demo data or data set A loaded. | Without scrolling you can see the manor, counts, daily progress, the view buttons and the first task item. | Not yet verified | |
| W1024-3 | Scroll the page down through a long list. | The task list extends below the viewport and is reached by vertical scrolling (AC-RESP-01.8). | Not yet verified | |
| W1024-4 | **Left column reachability (observe and record).** The left column is sticky and scrolls on its own if it is taller than the window. At 1024x768, and again with the window made shorter (about 500 px high), try to reach every control in the left column, including the create form's Submit button. | Every control in the left column can be reached by mouse wheel and by keyboard. Nothing is trapped below the fold. Note how the two scroll areas feel. | Not yet verified | |

### 1920 CSS pixels wide

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| W1920-1 | Open the app at 1920 pixels wide. | The layout is usable and balanced. Content stays within a centered maximum width (about 1200 px) instead of stretching across the whole screen. No overlap or odd gaps. | Not yet verified | |

## 6. 200% zoom

Requirement links: 16.6 (AC-RESP-01.6). Set browser zoom to 200% with the keyboard shortcut or the browser menu. A 1280 pixel wide window at 200% behaves like 640 CSS pixels. A 1920 pixel wide window at 200% behaves like 960 CSS pixels.

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| Z1 | At 200% zoom in a 1280 pixel wide window, look for horizontal scrolling. | No horizontal scroll. Text and controls reflow. | Not yet verified | |
| Z2 | At 200% zoom, create, release, reopen, edit and delete a task. | **All functionality is available.** Every control can be reached and used. | Not yet verified | |
| Z3 | At 200% zoom, use the view buttons and all three filters. | All are reachable and readable. Nothing is hidden or overlapping. | Not yet verified | |
| Z4 | At 200% zoom, open the edit dialog and the delete confirmation. | The dialog fits the window, can be scrolled if needed, and its buttons can be reached. | Not yet verified | |
| Z5 | At 200% zoom in a 1920 pixel wide window. | Same results as Z1 to Z4. | Not yet verified | |

## 7. Contrast spot check against the design tokens

Requirement links: 18.1, 18.2 (AC-A11Y-02.1, .2). The automated test checks the token values in `src/styles/tokens.css`. This section checks what actually appears on screen. Use the DevTools color picker (it shows a contrast ratio) or another contrast tool. Normal text needs at least 4.5:1. Large text and component boundaries need at least 3:1.

| Token | Value | Used for |
|-------|-------|----------|
| `--bg` | `#120e1a` | Page background |
| `--surface` | `#1d1729` | Cards and forms |
| `--text` | `#ece6f5` | Body text |
| `--text-muted` | `#b0a6c4` | Secondary text |
| `--accent` | `#c4a8ff` | Links and primary buttons |
| `--danger` | `#ff9a9a` | Overdue label and delete |
| `--focus` | `#ffd479` | Focus ring |
| `--border` | `#7a6c96` | Input and component boundaries |

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| C1 | Body text (task titles, headings, labels) on the page background and on cards. | At least 4.5:1. | Not yet verified | |
| C2 | Muted text (descriptions, task details, counts' labels, helper lines) on page and card backgrounds. | At least 4.5:1. | Not yet verified | |
| C3 | Links and accent text on page and card backgrounds. | At least 4.5:1. | Not yet verified | |
| C4 | Text on filled buttons (primary buttons, the selected view button). | At least 4.5:1 (dark text on the light accent). | Not yet verified | |
| C5 | The "Overdue" label and danger buttons ("Delete", "Remove demo data") on their backgrounds. | At least 4.5:1 for text. | Not yet verified | |
| C6 | The focus ring against the page background and against card backgrounds. | At least 3:1 on both. | Not yet verified | |
| C7 | Borders of inputs, selects, the search box, cards and checkboxes against what is next to them. | At least 3:1. | Not yet verified | |
| C8 | The placeholder text in the search box ("Search spirits..."). | At least 4.5:1. The placeholder color is a browser default, so check it in each browser you use. | Not yet verified | |
| C9 | Text near the top of the page, where the faint background glow is strongest. | Still at least 4.5:1. The glow does not reduce legibility. | Not yet verified | |
| C10 | Run an automated audit (for example Lighthouse accessibility, or the axe browser extension). | Reports no color-contrast failures. | Not yet verified | |

## 8. Date input behavior (real browsers)

Requirement links: due dates (AC-VAL-01.4, AC-DATE-01.6). The app uses the browser's native date input, whose behavior differs between browsers and cannot be tested in jsdom. Repeat this section in each browser you support.

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| D1 | Open the date picker from the Due date field with the mouse and choose a date. | The field shows the date in the browser's own format. After creating the task, the due date is shown in a readable local format in the list. | Not yet verified | |
| D2 | Operate the Due date field by keyboard only (type the segments, arrow keys, open the picker if the browser has one). | It can be filled in and cleared using the keyboard alone. | Not yet verified | |
| D3 | Leave the Due date empty and create a task. | The task has no due date. It appears only in All Tasks. | Not yet verified | |
| D4 | Enter a date in the past and create the task. | The task is accepted and shows "Overdue" in the Today view. | Not yet verified | |
| D5 | **Partly typed or impossible dates (observe and record).** Try to enter an incomplete date and an impossible date such as 30 February. | Browsers handle this differently (some do not allow it at all). The app must never save an invalid date. Acceptable outcomes: the browser prevents it, the field is treated as empty, or the app shows "Enter a real calendar date." Record which one happens in each browser. | Not yet verified | |
| D6 | Open the edit dialog for a task that has a due date. | The date is filled in correctly and can be changed. | Not yet verified | |
| D7 | The Due date field is announced with its label, and its focus ring is visible. | The label "Due date" is read. The focus ring is visible. | Not yet verified | |
| D8 | On a phone or a touch device (or its emulation), use the Due date field. | The native touch date picker opens and works. | Not yet verified | |

## 9. Storage failure scenarios (real browser storage)

Requirement links: Requirement 9 (AC-PERS-02.1 to .9, .15). The automated tests simulate these failures. Here you cause them in a real browser. Use a throwaway profile. Run the console snippets in DevTools on the app's own page. Reload the page after each setup step.

The storage keys are `spectral-tasks:data` (the data) and `spectral-tasks:data:corrupted-backup` (the backup).

### 9.1 Corrupted value

```js
localStorage.setItem('spectral-tasks:data', '{"schemaVersion":1,"tasks":[{"id":"t1","title":"Cut off mid-');
```

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| ST1 | Run the snippet, then reload. | The app opens empty with a dismissible warning that saved data could not be read. | Not yet verified | |
| ST2 | In Application, then Local Storage, compare the two keys. | The backup key holds the exact broken text from the snippet. The data key now holds a valid empty envelope. | Not yet verified | |
| ST3 | Dismiss the notice, create a task, reload. | The notice does not return. The new task is saved and still present. The backup key is unchanged. | Not yet verified | |

### 9.2 One invalid task among valid ones

```js
const now = new Date().toISOString();
const ok = (i) => ({ id: 'qa-' + i, title: 'QA task ' + i, description: '', category: 'Study', priority: 'Medium', status: 'active', dueDate: null, estimatedMinutes: null, source: 'user', createdAt: now, completedAt: null });
localStorage.setItem('spectral-tasks:data', JSON.stringify({ schemaVersion: 1, lastGoalCelebrationDate: null, tasks: [ok(1), { ...ok(2), category: 'Wizardry' }, ok(3)] }));
```

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| ST4 | Run the snippet, then reload and open All Tasks. | Two tasks are shown, and a notice says 1 stored spirit could not be read and was discarded. | Not yet verified | |

### 9.3 Newer schema version

```js
localStorage.setItem('spectral-tasks:data', JSON.stringify({ schemaVersion: 2, tasks: [], lastGoalCelebrationDate: null }));
```

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| ST5 | Run the snippet, then reload. | A persistent notice (no dismiss button) says the data was created by a newer version and changes will not be saved. | Not yet verified | |
| ST6 | Create a task, then reload. | The task is lost on reload. The stored value is exactly the snippet's text: `schemaVersion` is still 2 and nothing was written. No backup key exists. | Not yet verified | |

### 9.4 Blocked storage

Block all site data for the app's address in the browser settings. Menu names differ between browsers and versions. Examples: in Chrome, Settings, Privacy and security, block all cookies or add the site to "Not allowed to use cookies and site data"; in Safari, block all cookies. Write down what you used in Notes. Remove the block afterwards.

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| ST7 | With storage blocked, load the app. | The app opens normally and shows a persistent notice that storage is unavailable and changes will not be saved. | Not yet verified | |
| ST8 | Create, release, edit and delete tasks. | Everything works in memory. After a reload the tasks are gone. | Not yet verified | |

### 9.5 Quota exceeded

```js
const chunk = 'x'.repeat(100 * 1024);
let i = 0;
try { for (;;) { localStorage.setItem('qa-fill-' + i, chunk); i++; } } catch (e) { console.log('Filled', i, 'chunks; stopped with', e.name); }
```

Clean up afterwards:

```js
Object.keys(localStorage).filter((k) => k.startsWith('qa-fill-')).forEach((k) => localStorage.removeItem(k));
```

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| ST9 | Run the fill snippet, then create a task in the app. | A dismissible error notice says storage is full. The task still appears in the list. | Not yet verified | |
| ST10 | Create a second task. | The app does not break. The error notice is not duplicated. | Not yet verified | |
| ST11 | Run the cleanup snippet and create another task. | Saving works again. After a reload, the newest tasks are present. | Not yet verified | |

### 9.6 Backup failure

This needs the backup write to fail while the data key can still be read. Fill storage almost completely while a large broken value is stored, then reload. The exact sizes depend on the browser's quota. If the first line fails with a quota error, the quota is smaller than 2 million characters; record that and skip.

```js
localStorage.clear();
localStorage.setItem('spectral-tasks:data', '{' + 'x'.repeat(2 * 1024 * 1024));
const chunk = 'x'.repeat(100 * 1024);
let i = 0;
try { for (;;) { localStorage.setItem('qa-fill-' + i, chunk); i++; } } catch (e) { console.log('Filled', i, 'chunks; stopped with', e.name); }
```

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| ST12 | Run the snippet, then reload. | A persistent error notice says saved data could not be read or backed up and changes will not be saved. | Not yet verified | |
| ST13 | Run `localStorage.getItem('spectral-tasks:data').length` and `localStorage.getItem('spectral-tasks:data:corrupted-backup')` in the console. | The first is `2097153` (the original value, untouched). The second is `null` (no backup was written). | Not yet verified | |
| ST14 | Create a task. | It works in memory. After a reload it is gone. The data key is still the original value. | Not yet verified | |

After this section, run the cleanup snippet from 9.5 and clear the data key (`localStorage.removeItem('spectral-tasks:data')`) so later checks start clean.

## 10. Local midnight rollover

Requirement links: 15 (AC-DATE-01.8 to .11, .13) and AC-ORG-01.9. Changing the system clock affects other programs. Turn off "set time automatically" only for the test and turn it back on afterwards. A change of the system clock does not make the page's timer fire early, so the timer path and the focus/visibility path are checked separately.

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| MN1 | **Timer path.** Set the system clock to about 23:58. Reload the app. Create a task due **tomorrow**, a task due **today**, and release one task so the daily progress reads 1 of 3. Leave the page open and visible without touching it. Wait until after midnight (about two minutes). | Without any reload or interaction: Today and Upcoming update (the task due "tomorrow" moves into Today, the task due "today" now shows "Overdue"), and the daily progress resets to 0 of 3. | Not yet verified | |
| MN2 | At the moment of rollover in MN1, watch the ghost. | The date change itself does not play a celebration. | Not yet verified | |
| MN3 | **Focus path.** Set the system clock to 23:59. Reload. Switch to another window. Set the clock to just after midnight. Switch back to the app window. | On return, the date-derived values update immediately (as in MN1) without a reload. | Not yet verified | |
| MN4 | **Visibility path.** Same as MN3, but switch to another **browser tab** instead of another window, and return to the app tab. | The values update on return. | Not yet verified | |
| MN5 | Complete three tasks on the first day, then roll past midnight and complete three more. | The daily-goal celebration plays on day one, and plays again on day two (once per day). | Not yet verified | |
| MN6 | Restore the system clock (set time automatically back on). | The clock is correct again. | Not yet verified | |

## 11. Manor stages

Requirement links: AC-MANOR-01.4 and the Manor design decision. jsdom cannot show whether the six stages look different. Put the given number of **completed** tasks into storage with this snippet, change `n`, and reload. Use `n` = 0, 1, 5, 10, 20 and 35.

```js
const n = 5;
const now = new Date().toISOString();
const done = (i) => ({ id: 'qa-' + i, title: 'QA done ' + i, description: '', category: 'Other', priority: 'Medium', status: 'completed', dueDate: null, estimatedMinutes: null, source: 'user', createdAt: now, completedAt: now });
localStorage.setItem('spectral-tasks:data', JSON.stringify({ schemaVersion: 1, lastGoalCelebrationDate: null, tasks: Array.from({ length: n }, (_, i) => done(i)) }));
```

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| MV1 | Look at the manor at n = 0, 1, 5, 10, 20 and 35. | Six visibly different pictures. The first is a ruined, dark manor. The scene gets brighter and more restored with each stage. | Not yet verified | |
| MV2 | Read the stage name and the "more spirits released to reach ..." line at each n. | Names in order: Abandoned, Awakening, Stirring, Illuminated, Restored, Enchanted. At 35 the line says the manor is fully restored. | Not yet verified | |
| MV3 | Reopen a completed task so the count drops below a threshold. | The manor goes back to the lower stage. | Not yet verified | |
| MV4 | Complete a task so the count crosses a threshold. | The manor goes up one stage and the stage-increase message is announced (see SR6). It is not announced when the page loads. | Not yet verified | |
| MV5 | Check the manor picture at 320 px and at 1920 px wide. | It scales without distortion and is not cut off. | Not yet verified | |

## 12. Cross-browser smoke check

Requirement links: 19.10 (AC-NFR-01.10): the current stable versions of Chrome, Firefox, Safari and Edge. Use the production build in each browser. Write the exact version of each browser in Notes. Enter Pass, Fail or N/A in each cell as you go.

| ID | Check | Chrome | Firefox | Safari | Edge | Notes |
|----|-------|--------|---------|--------|------|-------|
| X1 | The page loads dark and styled, with no console errors. | Not yet verified | Not yet verified | Not yet verified | Not yet verified | |
| X2 | Create, release, reopen, edit and delete a task. | Not yet verified | Not yet verified | Not yet verified | Not yet verified | |
| X3 | Refresh: the data persists (S3). | Not yet verified | Not yet verified | Not yet verified | Not yet verified | |
| X4 | The Due date field works (section 8, D1 to D5). | Not yet verified | Not yet verified | Not yet verified | Not yet verified | |
| X5 | The manor illustration renders correctly at several stages (MV1). | Not yet verified | Not yet verified | Not yet verified | Not yet verified | |
| X6 | The ghost animates, and stops under reduced motion (M1, M4). | Not yet verified | Not yet verified | Not yet verified | Not yet verified | |
| X7 | The focus ring and the skip link are visible (K1, K4). | Not yet verified | Not yet verified | Not yet verified | Not yet verified | |
| X8 | Modal dialogs trap focus, close on Escape and return focus (K8, K10, K11). | Not yet verified | Not yet verified | Not yet verified | Not yet verified | |
| X9 | The layout works at 390 px and 1280 px wide with no horizontal scroll. | Not yet verified | Not yet verified | Not yet verified | Not yet verified | |
| X10 | The progress bar, selects and checkboxes look correct (their styling differs between browsers). | Not yet verified | Not yet verified | Not yet verified | Not yet verified | |
| X11 | Corrupted-data recovery works (ST1, ST2). | Not yet verified | Not yet verified | Not yet verified | Not yet verified | |

## 13. Recording the performance results

Requirement links: 20.8 (AC-PERF-01.8). The procedure and the empty result tables are in `docs/performance.md`. This section only tracks whether they have been completed. Do not copy numbers here.

| ID | Check | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| PF1 | Generate the data sets (`npm run perf:data`) and load data set A into the production build, as described in `docs/performance.md`. | The dashboard shows 500 restless spirits and 1 spirit released. | Not yet verified | |
| PF2 | Complete the interaction series (T1: complete, reopen, edit, delete; 10 runs each, 200 ms target) and enter the values in section 8.1 of `docs/performance.md`. | Section 8.1 is filled in, including the environment record. | Not yet verified | |
| PF3 | Complete the cold-load series (T2: 5 cold loads of data set B, 2 second target) and enter the values in section 8.2 of `docs/performance.md`. | Section 8.2 is filled in, including the environment record. | Not yet verified | |
| PF4 | Check that the environment record (section 7 of `docs/performance.md`) names the CPU model, cores, memory, operating system and exact Chrome version for each series. | Complete for each series. | Not yet verified | |
| PF5 | Before anyone states that the app meets a target (in a README, report or demo), check that the matching result is recorded in `docs/performance.md`. | No claim is made without a recorded result. | Not yet verified | |

## 14. Sign-off

Complete this only after the sections above are filled in. Leave it blank until then.

| Field | Value |
|-------|-------|
| Tester | |
| Date | |
| Sections completed | |
| Open Fail items (IDs) | |
| Overall outcome | Not yet verified |
