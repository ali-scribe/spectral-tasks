# Performance verification (Requirement 20)

**Status: automated measurements recorded on 2026-11-08 (see section 7 for the environment and deviations from the documented procedure). Rows that could not be measured faithfully read "Not yet measured".**

Spectral Tasks is not described as meeting any performance target until the measured result has been recorded in the tables below (AC-PERF-01.8). The owner runs the measurements; nothing in this repository claims a result.

## 1. Targets

These are verification targets, separate from the functional acceptance criteria. They are goals to verify, not results.

| ID | Target | Source |
|----|--------|--------|
| T1 | With the All Tasks view showing 500 active tasks, completing, reopening, editing or deleting one task finishes rendering the updated list within **200 ms**. Median of **10** runs. | AC-PERF-01.2 |
| T2 | With a stored envelope of 500 representative tasks (active and completed), the app shows an interactive dashboard within **2 seconds**. Median of **5** cold loads, from navigation start to the first user input being handled. | AC-PERF-01.3 |

## 2. Reference environment (AC-PERF-01.1, AC-PERF-01.7)

Measure in this environment only:

- **Build:** the production build, not the dev server. Run `npm run build`, then `npm run preview` to serve `dist/` locally. Vite prints the URL (its default is `http://localhost:4173`).
- **Browser:** the current stable Chrome.
- **Hardware:** a laptop with at least 4 CPU cores and 8 GB of memory.
- **Extensions:** disabled.
- **CPU throttling:** none (DevTools Performance panel, CPU set to "No throttling").
- **Recommended:** run on mains power with the OS power mode set to its default or high-performance setting, with other heavy applications closed. If you do not, note it in the record below.

For **every** recorded series, fill in the environment record (section 7) with the actual hardware, operating system and exact Chrome version (AC-PERF-01.7). The exact Chrome version is on `chrome://version`.

## 3. Data sets (AC-PERF-01.4)

Both data sets come from a seeded generator, so repeated runs produce identical data. The generator is dev tooling only: nothing in `src/` imports it and it is not part of the production bundle.

Generate them (from the repository root, after `npm install`):

```
npm run perf:data
```

This writes four files to `scripts/perf/out/`, which git ignores. They can be regenerated at any time and are byte-identical on every run.

| Data set | Files | Contents | Used for |
|----------|-------|----------|----------|
| **A** | `interaction-500-active-plus-1-completed.json`, `.console.js` | 500 active tasks plus 1 completed task (id `perf-a-reopen`) that is the one reopened | T1 |
| **B** | `coldload-500-mixed.json`, `.console.js` | 500 tasks: 350 active and 150 completed | T2 |

Notes on the data:

- The `.json` file is exactly the string the app stores in LocalStorage under the key `spectral-tasks:data`. The `.console.js` file is a one-line script that stores it, so you do not have to paste and escape the JSON by hand.
- Due dates are fixed calendar dates in 2026 and 2027, and about a quarter of tasks have none. How many tasks show "Overdue" therefore depends on the day you run the measurement. Note the date in the environment record.
- Seeds: data set A uses `20260101` and data set B uses `20260102` (see `scripts/perf/dataset.ts`).

## 4. Loading a data set into the app

The app reads LocalStorage once at startup, so you must reload after storing a data set.

1. Start the production build: `npm run build`, then `npm run preview`.
2. Open the printed URL in Chrome (see section 2 for the profile to use).
3. Open DevTools, go to **Sources > Snippets**, create a snippet, paste the contents of the data set's `.console.js` file and run it. (Pasting into the **Console** also works.)
4. Reload the page.
5. Check the dashboard counts to confirm the right data set loaded:
   - Data set A: 500 restless spirits and 1 spirit released.
   - Data set B: 350 restless spirits and 150 spirits released.

Running the snippet replaces whatever is stored under that key, so use a profile that has no data you want to keep.

## 5. Start and end points (AC-PERF-01.5)

The **start point** is the user input event on the control. The **end point** is the completed paint of the updated UI showing the new state.

| Interaction | Start point (input event) | End point |
|-------------|---------------------------|-----------|
| Complete | Click on the "Release spirit: ..." checkbox | Completed paint of the updated list |
| Reopen | Click on the "Reopen spirit: ..." checkbox | Completed paint of the updated list |
| Edit | Submit of the Task_Form save: click on "Save spirit" or Enter in a field of the edit dialog | Completed paint of the updated list |
| Delete | Click on the confirm button ("Banish") in the Confirmation_Dialog | Completed paint of the updated list |

How to read the value in Chrome DevTools:

1. Open the **Performance** panel with CPU throttling set to "No throttling".
2. Click **Record**, perform the one interaction, then stop the recording.
3. In the **Interactions** track, select the interaction. Its duration runs from the input event to the next paint, which matches the start and end points above. Record that duration in milliseconds.

## 6. Procedures

### 6.1 T1: interaction series (data set A, 200 ms target)

For each of the four interactions (complete, reopen, edit, delete):

1. Reset to a clean data set A: run the snippet, reload, and open the **All Tasks** view. This keeps 500 active tasks on screen for every run.
2. Start a Performance recording.
3. Perform the interaction on one task (any task near the middle of the list is fine; use the same position for every run):
   - **Complete:** click the checkbox on an active task.
   - **Reopen:** open the **Completed** view and click the checkbox on the one completed task.
   - **Edit:** click "Edit spirit", change the title, then submit.
   - **Delete:** click "Delete spirit", then confirm in the dialog.
4. Stop the recording and record the interaction duration (section 5).
5. Repeat steps 1 to 4 until you have **10** runs, then take the **median** of the 10 values.

This series is a warm series: it measures an interaction in an already loaded page and involves no page load. Label it "warm" in the record.

### 6.2 T2: cold-load series (data set B, 2 second target)

Each cold load uses a fresh browser profile, a cleared HTTP cache and no extensions (AC-PERF-01.6). For each of **5** runs:

1. Start Chrome with a new, empty profile and extensions disabled. On Windows (PowerShell):

   ```
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="$env:TEMP\perf-profile-<run number>" --disable-extensions http://localhost:4173
   ```

   Use a different `<run number>` folder each time. Adjust the path or URL for your machine and for macOS or Linux.
2. Open DevTools. Load data set B with its `.console.js` snippet (section 4, steps 3 and 4 first, but do not reload yet).
3. Clear the HTTP cache without clearing LocalStorage: in the **Network** panel, right-click the request list and choose **Clear browser cache**. (Do not use "Clear site data", which would remove the data set.)
4. In the **Performance** panel, choose **Start profiling and reload page**.
5. When the page has loaded, click once on any control, for example the "All Tasks" view button. This is the first user input.
6. Stop the recording. Read the time from navigation start to the point where that first input was handled, and record it in milliseconds.
7. Close Chrome and delete the temporary profile folder.

After 5 runs, take the **median**. Every run in this series is a **cold** load. If you also record warm loads (a reload that reuses the cache populated by an earlier load) for comparison, record them in a separate table and label them "warm". Never mix cold and warm values in one median.

## 7. Environment record (complete once per recorded series)

| Field | Value |
|-------|-------|
| Date measured | 2026-11-08 |
| Git commit of the build | ce08ac9 (working tree has uncommitted changes to .gitignore and docs/manual-qa.md and an untracked scripts/qa/; src/ unchanged) |
| CPU model | Intel Core i5-8350U @ 1.70 GHz |
| CPU cores | 4 physical / 8 logical |
| Memory | 7.9 GB |
| Operating system | Windows 11 (NT 10.0.26200) |
| Exact Chrome version (`chrome://version`) | Not Chrome: Playwright Chromium 158.0.8127.18, headless (chromium_headless_shell), not the stable Chrome channel |
| Extensions disabled | Yes (fresh Playwright profile, no extensions) |
| CPU throttling | None |
| Power mode | Windows "Balanced" scheme; mains/battery state not checked; other applications not closed |
| Notes | Production build (`npm run build` + `npm run preview`, http://localhost:4173), headless, 1440x900 viewport. Data sets A and B from `npm run perf:data`, loaded via the `.console.js` files. Dashboard counts (section 4 step 5) were NOT checked. Automated with Playwright, not by hand. |

Deviations from the documented procedure (not DevTools Performance panel readings):

- T1: each run used a fresh browser context, data set A reloaded, All Tasks view, middle task (Reopen: the single completed task). Durations are Event Timing API entries (the same input-to-next-paint measure the Interactions track shows), taking the longest entry of the interaction. Event Timing is rounded to 8 ms and only reports interactions of 16 ms or more. The value is not a DevTools timeline reading.
- T2: each run used a new browser instance. Data set B stored, HTTP cache cleared via CDP `Network.clearBrowserCache` (LocalStorage kept), then reload, with no profiling started. A click on "All Tasks" was issued immediately after the load event. The value is `performance.now()` at the end of the click event's window-level listener (after the app's handler), measured from navigation start. No DevTools trace was taken, and the value depends on when the automation clicks.

## 8. Results

### 8.1 T1: interaction series (warm), data set A, target 200 ms median of 10

Per-run values (ms):

| Run | Complete | Reopen | Edit | Delete |
|-----|----------|--------|------|--------|
| 1 | 144 | 88 | 88 | 96 |
| 2 | 168 | 88 | 88 | 104 |
| 3 | 104 | 72 | 88 | 96 |
| 4 | 120 | 64 | 88 | 96 |
| 5 | 112 | 64 | 96 | 168 |
| 6 | 112 | 80 | 96 | 112 |
| 7 | 136 | 64 | 88 | 104 |
| 8 | 120 | 56 | 88 | 104 |
| 9 | 120 | 56 | 88 | 112 |
| 10 | 112 | 64 | 80 | 104 |

Summary:

| Interaction | Load type | Median of 10 (ms) | Worst (ms) | Target (ms) | Target verified? |
|-------------|-----------|-------------------|------------|-------------|------------------|
| Complete | Warm | 120 | 168 | 200 | Met (median 120 ms), with the deviations in section 7 |
| Reopen | Warm | 64 | 88 | 200 | Met (median 64 ms), with the deviations in section 7 |
| Edit | Warm | 88 | 96 | 200 | Met (median 88 ms), with the deviations in section 7 |
| Delete | Warm | 104 | 168 | 200 | Met (median 104 ms), with the deviations in section 7 |

### 8.2 T2: initial load (cold), data set B, target 2 seconds median of 5

Per-run values (ms, navigation start to first input handled):

| Run | Load type | Value (ms) |
|-----|-----------|------------|
| 1 | Cold | 383 |
| 2 | Cold | 377 |
| 3 | Cold | 340 |
| 4 | Cold | 386 |
| 5 | Cold | 357 |

Summary:

| Series | Load type | Median of 5 (ms) | Worst (ms) | Target (ms) | Target verified? |
|--------|-----------|------------------|------------|-------------|------------------|
| Initial load to interactive dashboard | Cold | 377 | 386 | 2000 | Met (median 377 ms), with the deviations in section 7 |
## 9. After recording results

Only once a series has been measured and written into section 8 may the project describe the matching target as met or missed. Until then, no README, report or presentation should state that the app meets a performance target. If a target is missed, record the result as measured and open a separate task to address it. Do not edit the recorded values.

## 10. Assumptions to confirm

These points are not fully settled by Requirement 20. The procedure above uses the reading shown; tell the maintainer if you want it changed.

1. **Reopen is measured in the Completed view.** AC-PERF-01.2 describes the All Tasks view, but a completed task is not listed there, so the reopen control is only reachable from the Completed view. The data set still holds all 500 active tasks while you measure the reopen.
2. **Checkbox controls are activated by click.** AC-PERF-01.5 mentions "click or Enter keypress". A checkbox is toggled by click (or Space), not by Enter, so the procedure uses click for complete and reopen.
3. **"Fresh browser profile" applies to every cold load.** The procedure starts each of the 5 cold loads in a new profile. If you prefer one profile with the cache cleared before each load, record that in the Notes field.
4. **"First user input being handled"** is read from the Performance panel timeline as the point where the first click's handler finished, measured from navigation start. The app has no built-in timing instrumentation.
