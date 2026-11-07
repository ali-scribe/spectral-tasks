// Captures the six manor stages at 1280 and 390 wide, plus the ghost poses.
// Usage: start `npm run preview` (port 4173), then `node scripts/design/capture-manor.mjs`.
// Writes PNGs to design-review/manor/ (git-ignored).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.APP_URL ?? 'http://localhost:4173';
const OUT = join(process.cwd(), 'design-review', 'manor');
mkdirSync(OUT, { recursive: true });
const KEY = 'spectral-tasks:data';
const now = new Date().toISOString();
const done = (i) => ({
  id: `m-${i}`, title: `Spirit ${i}`, description: '', category: 'Study', priority: 'Medium',
  status: 'completed', dueDate: null, estimatedMinutes: null, source: 'user', createdAt: now, completedAt: now,
});
const seed = (n) => JSON.stringify({ schemaVersion: 1, tasks: Array.from({ length: n }, (_, i) => done(i)), lastGoalCelebrationDate: null });

const browser = await chromium.launch();
for (const [label, width, height] of [['1280', 1280, 800], ['390', 390, 844]]) {
  for (const [stage, n] of [0, 1, 5, 10, 20, 35].entries()) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, seed(n)]);
    await page.reload();
    await page.waitForSelector('svg.manor');
    await page.waitForTimeout(500);
    await page.locator('svg.manor').screenshot({ path: join(OUT, `stage-${stage}-${label}.png`) });
    if (stage === 0 || stage === 5) await page.screenshot({ path: join(OUT, `page-stage-${stage}-${label}.png`) });
    if (label === '1280' && stage === 3) {
      for (const pose of ['idle', 'summon', 'celebrate', 'goal']) {
        await page.evaluate((p) => {
          const g = document.querySelector('.ghost');
          g.className = `ghost ghost--${p}`;
          g.querySelectorAll('*').forEach((el) => (el.style.animation = 'none'));
        }, pose);
        await page.locator('.ghost__figure').screenshot({ path: join(OUT, `ghost-${pose}.png`) });
      }
    }
    await ctx.close();
  }
}
await browser.close();
console.log('done');
