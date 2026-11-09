// Devpost gallery images (dev-only; not imported by app code).
// Usage: npm run build && npm run preview (port 4173), then
//        node scripts/gallery/make.mjs
// Writes 1500x1000 images to docs/images/gallery/ (PNG, or high-quality JPG
// when a PNG would exceed 1.5 MB). Uses only Playwright, already a dev dependency.

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.APP_URL ?? 'http://localhost:4173';
const OUT = join(process.cwd(), 'docs', 'images', 'gallery');
mkdirSync(OUT, { recursive: true });
const MAX_BYTES = 1.5 * 1024 * 1024;
const KEY = 'spectral-tasks:data';

// ---------- deterministic seed data ----------
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const NOW = new Date();
const TODAY = ymd(NOW);
const minutesAgo = (m) => new Date(NOW.getTime() - m * 60000).toISOString();
const daysAgo = (n) => minutesAgo(n * 1440 + 90);

const ACTIVE = [
  ['Return the overdue library tome', 'Personal', 'High', 'It was due two days ago and the librarian is a ghost.'],
  ['Finish the alchemy lab report', 'Study', 'High', 'Due today. Do not let it haunt you.'],
  ['Reply to the guild emails', 'Work', 'Medium', 'A short ritual of inbox cleansing.'],
  ['Water the moonflowers', 'Personal', 'Low', ''],
  ['Polish the lantern glass', 'Other', 'Low', ''],
  ['Evening walk around the grounds', 'Health', 'Medium', ''],
];
const DONE_TITLES = ['Mend the garden gate', 'Sweep the east hall', 'Light the tower candle', 'Oil the front door hinges', 'Read chapter nine', 'Pack the study notes'];
const CATS = ['Study', 'Work', 'Personal', 'Health', 'Other'];

const task = (id, over) => ({
  id, title: '', description: '', category: 'Study', priority: 'Medium', status: 'active',
  dueDate: null, estimatedMinutes: null, source: 'user', createdAt: daysAgo(30), completedAt: null, ...over,
});
const activeTasks = (n, due = TODAY) =>
  ACTIVE.slice(0, n).map(([title, category, priority, description], i) =>
    task(`g-active-${i + 1}`, { title, category, priority, description, dueDate: i === 0 ? ymd(new Date(NOW.getTime() - 2 * 86400000)) : due, estimatedMinutes: i === 1 ? 90 : i === 2 ? 30 : null }));
const doneTasks = (n, todayCount) =>
  Array.from({ length: n }, (_, i) =>
    task(`g-done-${i + 1}`, {
      title: `${DONE_TITLES[i % DONE_TITLES.length]}${i >= DONE_TITLES.length ? ` (${Math.floor(i / DONE_TITLES.length) + 1})` : ''}`,
      category: CATS[i % CATS.length], status: 'completed',
      completedAt: i < todayCount ? minutesAgo(20 + i * 35) : daysAgo(1 + (i % 9)),
    }));
const envelope = (tasks) => JSON.stringify({ schemaVersion: 1, tasks, lastGoalCelebrationDate: null });

// ---------- helpers ----------
const browser = await chromium.launch();
const report = [];

async function open(w, h, seed, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...extra });
  const page = await ctx.newPage();
  await page.goto(BASE);
  if (seed) {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, seed]);
    await page.reload();
  }
  await page.waitForSelector('svg.manor');
  await page.waitForTimeout(500);
  return { ctx, page };
}

function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Saves `shoot(type)` as PNG, or as a quality-92 JPG when the PNG exceeds 1.5 MB. */
async function save(name, shoot) {
  const png = await shoot({ type: 'png' });
  const dim = pngSize(png);
  if (dim.w !== 1500 || dim.h !== 1000) throw new Error(`${name}: ${dim.w}x${dim.h}, expected 1500x1000`);
  let file = `${name}.png`;
  let buf = png;
  if (png.length > MAX_BYTES) {
    buf = await shoot({ type: 'jpeg', quality: 92 });
    file = `${name}.jpg`;
    rmSync(join(OUT, `${name}.png`), { force: true });
  } else {
    rmSync(join(OUT, `${name}.jpg`), { force: true });
  }
  writeFileSync(join(OUT, file), buf);
  report.push(`${file} ${dim.w}x${dim.h} ${(buf.length / 1024).toFixed(0)} KB`);
}

// ============ 01 hero ============
{
  const tasks = [...doneTasks(36, 3), ...activeTasks(6)];
  const { ctx, page } = await open(1500, 1000, envelope(tasks));
  const facts = await page.evaluate(() => ({
    stage: document.querySelector('svg.manor').dataset.stage,
    name: document.querySelector('.manor-status__stage').textContent,
    goal: document.querySelector('.daily-progress__count').textContent.trim(),
    counts: [...document.querySelectorAll('.count__value')].map((e) => e.textContent).join('/'),
  }));
  console.log('hero:', JSON.stringify(facts));
  await save('01-hero', (o) => page.screenshot(o));
  await ctx.close();
}

// ============ 02 stages (3x2) ============
{
  const stageCounts = [0, 1, 5, 10, 20, 35];
  const cells = [];
  for (const n of stageCounts) {
    const { ctx, page } = await open(1500, 1000, envelope(doneTasks(n, 0)), { reducedMotion: 'reduce' });
    const data = await page.evaluate(() => ({
      svg: document.querySelector('svg.manor').outerHTML,
      name: document.querySelector('.manor-status__stage').textContent.replace(/^\s*Manor:\s*/, '').trim(),
      stage: document.querySelector('svg.manor').dataset.stage,
    }));
    cells.push(data);
    await ctx.close();
  }
  console.log('stages:', cells.map((c) => `${c.stage}=${c.name}`).join(', '));
  const { ctx, page } = await open(1500, 1000, null, { reducedMotion: 'reduce' });
  await page.evaluate((cells) => {
    // Unique gradient ids per cell so each scene keeps its own stage colors.
    const uniq = (html, i) => html.replace(/(id="|url\(#)(manor-[a-z-]+)/g, `$1$2-c${i}`);
    document.body.innerHTML = `
      <div style="box-sizing:border-box;width:1500px;height:1000px;padding:40px 44px;background:radial-gradient(1200px 700px at 50% -10%, rgba(196,168,255,0.07), rgba(18,14,26,0) 60%), var(--bg);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,auto);align-content:center;gap:40px 32px;font-family:var(--font-body);color:var(--text)">
        ${cells.map((c, i) => `
          <figure style="margin:0;display:flex;flex-direction:column;gap:14px;min-height:0">
            <div style="display:flex;align-items:flex-start">${uniq(c.svg, i).replace('<svg ', '<svg style="width:100%;height:auto;max-height:none;margin:0;-webkit-mask-image:none;mask-image:none;border:1px solid var(--border);border-radius:var(--radius-lg);" ')}</div>
            <figcaption style="font-family:var(--font-display);font-size:1.5rem;font-weight:600;letter-spacing:0.01em;text-align:center">${c.name}</figcaption>
          </figure>`).join('')}
      </div>`;
  }, cells);
  await page.waitForTimeout(400);
  const fit = await page.evaluate(() => {
    const g = document.body.firstElementChild.getBoundingClientRect();
    return { bottom: Math.round(Math.max(...[...document.querySelectorAll('figcaption')].map((e) => e.getBoundingClientRect().bottom))), h: Math.round(g.height), svgW: Math.round(document.querySelector('svg.manor').getBoundingClientRect().width), svgH: Math.round(document.querySelector('svg.manor').getBoundingClientRect().height) };
  });
  console.log('stages layout:', JSON.stringify(fit));
  await save('02-stages', (o) => page.screenshot({ ...o, clip: { x: 0, y: 0, width: 1500, height: 1000 } }));
  await ctx.close();
}

// ============ 03 release frame (~300 ms) ============
{
  // 4 completed + 5 active: completing one makes 5, which raises the stage to Stirring.
  const tasks = [...doneTasks(4, 0), ...activeTasks(5)];
  const { ctx, page } = await open(1500, 1000, envelope(tasks));
  const before = await page.evaluate(() => document.querySelector('svg.manor').dataset.stage);
  await page.getByRole('checkbox', { name: 'Release spirit: Finish the alchemy lab report' }).click();
  await page.waitForTimeout(70);
  // Freeze every animation at 260 ms (just after the first window flare peaks) so the frame is exact and repeatable.
  await page.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 260; }));
  await page.waitForTimeout(80);
  const state = await page.evaluate(() => ({
    stage: document.querySelector('svg.manor').dataset.stage,
    wisps: document.querySelectorAll('.release-fx__item').length,
    panes: document.querySelectorAll('.manor-beat__pane').length,
    paneOpacity: [...document.querySelectorAll('.manor-beat__pane')].map((p) => (+getComputedStyle(p).opacity).toFixed(2)).join(','),
  }));
  console.log('release:', `stage ${before} -> ${state.stage}`, JSON.stringify(state));
  await save('03-release', (o) => page.screenshot(o));
  await ctx.close();
}

// ============ 04 mobile pair ============
{
  const shots = [];
  {
    const { ctx, page } = await open(390, 844, null);
    await page.getByRole('button', { name: 'Load demo data' }).click();
    await page.waitForTimeout(500);
    shots.push(await page.screenshot());
    await ctx.close();
  }
  {
    const tasks = [...doneTasks(7, 2), ...activeTasks(6)];
    const { ctx, page } = await open(390, 844, envelope(tasks));
    await page.evaluate(() => {
      const nav = document.querySelector('.view-nav');
      window.scrollTo(0, nav.getBoundingClientRect().top + scrollY - 12);
    });
    await page.waitForTimeout(400);
    shots.push(await page.screenshot());
    await ctx.close();
  }
  const { ctx, page } = await open(1500, 1000, null);
  await page.evaluate((imgs) => {
    const frame = (src) => `
      <div style="padding:14px;border-radius:52px;background:linear-gradient(160deg, var(--surface-raised), var(--surface));border:2px solid var(--border);box-shadow:var(--shadow-soft), 0 30px 60px rgba(0,0,0,0.5)">
        <div style="position:relative;width:390px;height:844px;border-radius:38px;overflow:hidden;background:var(--bg)">
          <img src="data:image/png;base64,${src}" width="390" height="844" style="display:block">
        </div>
      </div>`;
    document.body.innerHTML = `
      <div style="box-sizing:border-box;width:1500px;height:1000px;display:flex;align-items:center;justify-content:center;gap:96px;background:radial-gradient(900px 600px at 50% 0%, rgba(196,168,255,0.09), rgba(18,14,26,0) 65%), var(--bg)">
        ${frame(imgs[0])}${frame(imgs[1])}
      </div>`;
  }, shots.map((b) => b.toString('base64')));
  await page.waitForTimeout(400);
  const fit = await page.evaluate(() => [...document.querySelectorAll('img')].map((i) => { const r = i.closest('div[style*=padding]').getBoundingClientRect(); return `${Math.round(r.left)}-${Math.round(r.right)} x ${Math.round(r.top)}-${Math.round(r.bottom)}`; }));
  console.log('phones:', fit.join(' | '));
  await save('04-mobile', (o) => page.screenshot({ ...o, clip: { x: 0, y: 0, width: 1500, height: 1000 } }));
  await ctx.close();
}

await browser.close();
console.log('\n' + report.join('\n'));
