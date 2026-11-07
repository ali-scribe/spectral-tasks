// Before/after layout capture + metrics (dev tooling only).
// Usage: start `npm run preview`, then `node scripts/design/capture-layout.mjs before|after`.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const label = process.argv[2] ?? 'after';
const BASE = process.env.APP_URL ?? 'http://localhost:4173';
const OUT = join(process.cwd(), 'design-review', 'layout', label);
mkdirSync(OUT, { recursive: true });

const sizes = [
  ['1024x768', 1024, 768],
  ['1440x900', 1440, 900],
  ['390x844', 390, 844],
];
const metrics = {};
const browser = await chromium.launch();

async function open(w, h, demo) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForSelector('svg.manor');
  if (demo) {
    await page.getByRole('button', { name: 'Load demo data' }).click();
    await page.waitForTimeout(300);
  }
  return { ctx, page };
}

for (const [name, w, h] of sizes) {
  // First visit (empty).
  {
    const { ctx, page } = await open(w, h, false);
    await page.screenshot({ path: join(OUT, `empty-${name}-viewport.png`) });
    await page.screenshot({ path: join(OUT, `empty-${name}-full.png`), fullPage: true });
    metrics[`empty-${name}`] = await page.evaluate((vh) => {
      const top = (el) => (el ? Math.round(el.getBoundingClientRect().top + scrollY) : null);
      const bottom = (el) => (el ? Math.round(el.getBoundingClientRect().bottom + scrollY) : null);
      const form = document.querySelector('form[aria-label="Summon a spirit"]');
      const title = document.querySelector('#create-title');
      const submit = form?.querySelector('button[type=submit]');
      const header = document.querySelector('.app-header h1');
      const main = document.querySelector('.app-main');
      const es = document.querySelector('.empty-state');
      const fb = document.querySelector('.filter-bar');
      const clear = document.querySelector('.filter-bar__clear');
      const ghost = document.querySelector('.ghost');
      const msg = document.querySelector('.ghost__message');
      const before = ghost.getBoundingClientRect().height;
      const old = msg.textContent;
      msg.textContent = 'Daily goal reached. The manor grows brighter tonight.';
      const after = ghost.getBoundingClientRect().height;
      msg.textContent = old;
      return {
        viewportH: vh,
        titleBottom: bottom(title),
        submitBottom: bottom(submit),
        listTop: top(es),
        headerLeft: Math.round(header.getBoundingClientRect().left),
        mainLeft: Math.round(main.getBoundingClientRect().left),
        emptyW: es ? Math.round(es.getBoundingClientRect().width) : null,
        filterW: fb ? Math.round(fb.getBoundingClientRect().width) : null,
        clearH: clear ? Math.round(clear.getBoundingClientRect().height) : null,
        ghostIdleH: Math.round(before * 10) / 10,
        ghostGoalH: Math.round(after * 10) / 10,
        docH: document.documentElement.scrollHeight,
      };
    }, h);
    await ctx.close();
  }
  // With demo data.
  {
    const { ctx, page } = await open(w, h, true);
    await page.screenshot({ path: join(OUT, `demo-${name}-viewport.png`) });
    await page.screenshot({ path: join(OUT, `demo-${name}-full.png`), fullPage: true });
    metrics[`demo-${name}`] = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.task-list > li')].map((li) => Math.round(li.getBoundingClientRect().height));
      const list = document.querySelector('.task-list');
      const cb = document.querySelector('.task-item__toggle input');
      return {
        listTop: list ? Math.round(list.getBoundingClientRect().top + scrollY) : null,
        rowHeights: rows.slice(0, 8),
        clearH: Math.round(document.querySelector('.filter-bar__clear').getBoundingClientRect().height),
        checkboxAppearance: cb ? getComputedStyle(cb).appearance : null,
      };
    });
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify(metrics, null, 1));
