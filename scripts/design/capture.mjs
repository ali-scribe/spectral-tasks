// Design-review screenshot capture (dev tooling only; not part of the app bundle).
// Usage: start `npm run preview` (port 4173), then `node scripts/design/capture.mjs`.
// Writes PNGs to design-review/ (git-ignored). Read-only with respect to the app:
// it only drives the page through a browser and seeds LocalStorage in throwaway
// browser contexts.

import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.APP_URL ?? 'http://localhost:4173';
const OUT = join(process.cwd(), 'design-review');
mkdirSync(OUT, { recursive: true });

const STORAGE_KEY = 'spectral-tasks:data';

function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const nowIso = new Date().toISOString();
function task(i, status, extra = {}) {
  return {
    id: `dr-${status}-${i}`,
    title: `Spirit ${i}`,
    description: '',
    category: 'Study',
    priority: 'Medium',
    status,
    dueDate: null,
    estimatedMinutes: null,
    source: 'user',
    createdAt: nowIso,
    completedAt: status === 'completed' ? nowIso : null,
    ...extra,
  };
}
const envelope = (tasks) => JSON.stringify({ schemaVersion: 1, tasks, lastGoalCelebrationDate: null });

const browser = await chromium.launch();

/** Opens a fresh context+page, optionally seeding storage, and loads the app. */
async function open({ width, height, seed, scale = 1, reducedMotion = 'no-preference' }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    reducedMotion,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(BASE);
  if (seed) {
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, seed]);
    await page.reload();
  }
  await page.waitForSelector('svg.manor');
  return { context, page, errors };
}

const shots = [];
async function snap(page, name, options = {}) {
  await page.screenshot({ path: join(OUT, `${name}.png`), ...options });
  shots.push(name);
}

// ---- 1. First-run empty state at three widths ----
for (const [label, w, h, full] of [
  ['desktop-1440', 1440, 900, true],
  ['laptop-1024x768-viewport', 1024, 768, false],
  ['mobile-390', 390, 844, true],
]) {
  const { context, page, errors } = await open({ width: w, height: h });
  await snap(page, `01-empty-${label}`, { fullPage: full });
  if (errors.length) console.log(`[${label}] console errors:`, errors);
  await context.close();
}

// ---- 2. Demo data loaded (the real first-run experience after the CTA) ----
for (const [label, w, h] of [
  ['desktop-1440', 1440, 900],
  ['mobile-390', 390, 844],
]) {
  const { context, page } = await open({ width: w, height: h });
  await page.getByRole('button', { name: 'Load demo data' }).click();
  await page.waitForTimeout(300);
  await snap(page, `02-demo-${label}`, { fullPage: true });
  await context.close();
}

// ---- 3. Manor stages 0..5 (element shots, then one contact sheet) ----
const stageCounts = [0, 1, 5, 10, 20, 35];
const stageFiles = [];
for (let s = 0; s < stageCounts.length; s += 1) {
  const n = stageCounts[s];
  const tasks = Array.from({ length: n }, (_, i) => task(i, 'completed'));
  const { context, page } = await open({ width: 1440, height: 900, seed: envelope(tasks), scale: 2 });
  const name = `03-manor-stage-${s}`;
  await page.locator('svg.manor').screenshot({ path: join(OUT, `${name}.png`) });
  stageFiles.push({ name, label: `Stage ${s} (${n} completed)` });
  shots.push(name);
  await context.close();
}
{
  const { context, page } = await open({ width: 1500, height: 700 });
  const cells = stageFiles
    .map((f) => {
      const b64 = readFileSync(join(OUT, `${f.name}.png`)).toString('base64');
      return `<figure style="margin:0"><img style="width:100%;display:block" src="data:image/png;base64,${b64}"><figcaption style="color:#ece6f5;font:14px system-ui;padding:6px 0">${f.label}</figcaption></figure>`;
    })
    .join('');
  await page.setContent(`<body style="margin:0;background:#120e1a"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:16px">${cells}</div></body>`);
  await snap(page, '03-manor-contact-sheet', { fullPage: true });
  await context.close();
}

// ---- 4. Completion feedback: ghost mid-reaction, then goal reaction ----
{
  const today = localDate(0);
  const tasks = [
    task(1, 'completed'),
    task(2, 'completed'),
    task(3, 'active', { title: 'Finish the lab report', dueDate: today, priority: 'High' }),
    task(4, 'active', { title: 'Reply to emails', dueDate: today }),
  ];
  const { context, page } = await open({ width: 1440, height: 900, seed: envelope(tasks) });
  await snap(page, '04a-before-completion', { fullPage: false });
  await page.getByRole('checkbox', { name: 'Release spirit: Reply to emails' }).click();
  await page.waitForTimeout(250);
  await snap(page, '04b-after-first-completion-250ms', { fullPage: false });
  await page.waitForTimeout(1400);
  await snap(page, '04c-after-first-completion-settled', { fullPage: false });
  await page.getByRole('checkbox', { name: 'Release spirit: Finish the lab report' }).click();
  await page.waitForTimeout(250);
  await snap(page, '04d-daily-goal-reached-250ms', { fullPage: false });
  await context.close();
}

// ---- 5. Overdue row, completed row, edit dialog, focus ring ----
{
  const tasks = [
    task(1, 'active', { title: 'Return the overdue library tome', dueDate: localDate(-2), priority: 'High', category: 'Personal', description: 'It was due two days ago.' }),
    task(2, 'active', { title: 'Evening walk around the grounds', dueDate: localDate(0), priority: 'Low', category: 'Health', estimatedMinutes: 45 }),
    task(3, 'completed', { title: 'Polish the lantern', category: 'Other' }),
  ];
  const { context, page } = await open({ width: 1440, height: 900, seed: envelope(tasks) });
  await snap(page, '05a-task-rows', { fullPage: false });
  await page.getByRole('button', { name: 'Edit spirit: Return the overdue library tome' }).click();
  await page.waitForTimeout(200);
  await snap(page, '05b-edit-dialog', { fullPage: false });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await snap(page, '05c-keyboard-focus', { fullPage: false });
  await context.close();
}

// ---- 6. Reduced motion (same view as 04b) ----
{
  const today = localDate(0);
  const tasks = [task(1, 'active', { title: 'Reply to emails', dueDate: today })];
  const { context, page } = await open({ width: 1440, height: 900, seed: envelope(tasks), reducedMotion: 'reduce' });
  await page.getByRole('checkbox', { name: 'Release spirit: Reply to emails' }).click();
  await page.waitForTimeout(250);
  await snap(page, '06-reduced-motion-after-completion', { fullPage: false });
  await context.close();
}

await browser.close();
writeFileSync(join(OUT, 'INDEX.txt'), shots.join('\n') + '\n');
console.log(`Wrote ${shots.length} screenshots to design-review/`);
shots.forEach((s) => console.log('  ' + s + '.png'));
