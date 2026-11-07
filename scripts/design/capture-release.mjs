import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const OUT = join(process.cwd(), 'design-review', 'release'); mkdirSync(OUT, { recursive: true });
const now = new Date().toISOString();
const d = new Date(); const p2 = (n) => String(n).padStart(2, '0');
const today = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const task = (i, status, extra = {}) => ({ id: `r-${status}-${i}`, title: `Spirit ${i}`, description: '', category: 'Study', priority: 'Medium', status, dueDate: today, estimatedMinutes: null, source: 'user', createdAt: now, completedAt: status === 'completed' ? now : null, ...extra });
const env = (tasks) => JSON.stringify({ schemaVersion: 1, tasks, lastGoalCelebrationDate: null });
const b = await chromium.launch();
async function run(name, tasks, times, reduced, clickName) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['spectral-tasks:data', env(tasks)]);
  await page.reload(); await page.waitForSelector('svg.manor');
  await page.waitForTimeout(400);
  const t0 = Date.now();
  await page.getByRole('checkbox', { name: clickName }).click({ noWaitAfter: true });
  const log = [];
  for (const t of times) {
    const wait = t - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: join(OUT, `${name}-${t}ms.png`) });
    log.push(`${t}->${Date.now() - t0}ms wisps=${await page.locator('.release-fx__item').count()} rings=${await page.locator('.release-fx__ring').count()} panes=${await page.locator('.manor-beat__pane').count()}`);
  }
  await page.waitForTimeout(1900);
  log.push(`after: wisps=${await page.locator('.release-fx__item').count()} rings=${await page.locator('.release-fx__ring').count()} panes=${await page.locator('.manor-beat__pane').count()} anims=${await page.evaluate(() => document.getAnimations().filter(a => a.animationName?.startsWith('release') || a.animationName?.startsWith('beat')).length)}`);
  console.log(name, log.join(' | '));
  await ctx.close();
}
const active = [1, 2, 3, 4].map((i) => task(i, 'active', { title: `Spirit ${i}` }));
await run('stageup', active, [60, 300, 600, 900], false, 'Release spirit: Spirit 2');
await run('goal', [task(1, 'completed'), task(2, 'completed'), task(3, 'active', { title: 'Third' }), task(4, 'active', { title: 'Fourth' })], [300, 600], false, 'Release spirit: Third');
await run('reduced', active, [300], true, 'Release spirit: Spirit 2');
await b.close();
