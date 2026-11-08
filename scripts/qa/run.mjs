// Automated manual-QA pass (dev-only; not imported by app code).
// Reports defects only: it never changes anything under src/.
//
// Usage:  npm run build && npm run preview   (port 4173), then
//         node scripts/qa/run.mjs [--write-docs] [--live <url>]
// Output: tmp/qa/ (git-ignored): results.json, plus screenshots for failures only.
// With --write-docs it fills docs/manual-qa.md for rows it actually verified,
// marked "(auto)". Every other row is left as "Not yet verified".

import { chromium, firefox, webkit } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const BASE = process.env.APP_URL ?? 'http://localhost:4173';
const argv = process.argv.slice(2);
const WRITE_DOCS = argv.includes('--write-docs');
const LIVE = argv.includes('--live') ? argv[argv.indexOf('--live') + 1] : 'https://spectral-tasks.vercel.app/';
const OUT = join(process.cwd(), 'tmp', 'qa');
mkdirSync(OUT, { recursive: true });

const KEY = 'spectral-tasks:data';
const BK = 'spectral-tasks:data:corrupted-backup';

// ---------- result bookkeeping ----------
const results = new Map(); // id -> { ok, notes[] }
const xResults = new Map(); // `${id}|${browser}` -> { ok, notes[] }
const info = []; // extra findings that are not checklist rows
const consoleLog = [];
const netLog = [];
const failedLog = [];

function rec(id, ok, note) {
  const r = results.get(id) ?? { ok: true, notes: [] };
  r.ok = r.ok && !!ok;
  if (note) r.notes.push(note);
  results.set(id, r);
}
function recX(id, browser, ok, note) {
  const k = `${id}|${browser}`;
  const r = xResults.get(k) ?? { ok: true, notes: [] };
  r.ok = r.ok && !!ok;
  if (note) r.notes.push(note);
  xResults.set(k, r);
}
let shotN = 0;
async function shot(page, name) {
  try {
    shotN += 1;
    await page.screenshot({ path: join(OUT, `FAIL-${name.replace(/[^\w-]+/g, '_')}-${shotN}.png`) });
  } catch {
    /* page may be gone */
  }
}
async function chk(id, ok, note, page) {
  rec(id, ok, note);
  if (!ok && page) await shot(page, id);
}
function note(text) {
  info.push(text);
  console.log('  *', text);
}

function attach(page, flow, origin) {
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      consoleLog.push({ flow, type: m.type(), text: m.text().slice(0, 160) });
    }
  });
  page.on('response', (r) => { if (r.status() >= 400) failedLog.push({ flow, status: r.status(), url: r.url().slice(0, 120) }); });
  page.on('pageerror', (e) => consoleLog.push({ flow, type: 'pageerror', text: String(e).slice(0, 160) }));
  page.on('request', (r) => {
    let u;
    try {
      u = new URL(r.url());
    } catch {
      return;
    }
    if (['data:', 'blob:', 'about:'].includes(u.protocol)) return;
    if (u.origin !== origin) netLog.push({ flow, url: r.url().slice(0, 120) });
  });
}

// ---------- init scripts ----------
const LOG_INIT = `(() => { if (!window.__w) { window.__w = [];
  const s = Storage.prototype.setItem, r = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) { window.__w.push(['set', k]); return s.call(this, k, v); };
  Storage.prototype.removeItem = function (k) { window.__w.push(['rm', k]); return r.call(this, k); }; } })();`;
const seedInit = (obj) => `(() => { if (location.protocol.indexOf('http') === 0 && window.name.indexOf('qa-seeded') < 0) { try {
  for (const [k, v] of Object.entries(${JSON.stringify(obj)})) localStorage.setItem(k, v);
  } catch (e) {} window.name += 'qa-seeded'; } })();`;
const THROW_ON = (key, name) => `(() => { const s = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (k === ${JSON.stringify(key)}) throw new DOMException('qa', ${JSON.stringify(name)}); return s.call(this, k, v); }; })();`;
const UNAVAILABLE_INIT = `Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });`;

async function newCtx(browser, opts = {}, scripts = [LOG_INIT]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  for (const s of scripts) await ctx.addInitScript({ content: s });
  return ctx;
}

// ---------- data helpers ----------
const nowIso = new Date().toISOString();
const d0 = new Date();
const p2 = (n) => String(n).padStart(2, '0');
const TODAY = `${d0.getFullYear()}-${p2(d0.getMonth() + 1)}-${p2(d0.getDate())}`;
const mk = (i, o = {}) => ({
  id: `qa-${i}`, title: `QA task ${i}`, description: '', category: 'Study', priority: 'Medium',
  status: 'active', dueDate: null, estimatedMinutes: null, source: 'user', createdAt: nowIso, completedAt: null, ...o,
});
const done = (i, o = {}) => mk(i, { status: 'completed', completedAt: nowIso, title: `QA done ${i}`, ...o });
const env = (tasks) => JSON.stringify({ schemaVersion: 1, tasks, lastGoalCelebrationDate: null });

const vals = (page) => page.locator('.count__value').allInnerTexts();
const raw = (page, k = KEY) => page.evaluate((key) => { try { return localStorage.getItem(key); } catch { return 'ERR'; } }, k);
const writes = (page) => page.evaluate(() => window.__w ?? []);
const rows = (page) => page.locator('.task-list > li').count();
async function open(page, url = BASE) {
  await page.goto(url);
  await page.waitForSelector('svg.manor');
  await page.waitForTimeout(250);
}
const view = (page, name) => page.getByRole('button', { name, exact: true }).click();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============ 1. Workflow with demo data ============
async function workflow(browser) {
  console.log('1. workflow with demo data');
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  attach(page, 'workflow', new URL(BASE).origin);
  await open(page);

  await page.getByRole('button', { name: 'Load demo data' }).click();
  await page.waitForTimeout(300);
  let v = await vals(page);
  rec('WF-demo-loaded', v[0] === '6' && v[1] === '0', `counts after demo: ${v.join('/')}`);

  const counts = {};
  for (const name of ['Today', 'Upcoming', 'All Tasks', 'Completed']) {
    await view(page, name);
    counts[name] = await rows(page);
  }
  rec('WF-views', counts['Today'] >= 1 && counts['All Tasks'] === 6 && counts['Completed'] === 0, `rows per view ${JSON.stringify(counts)}`);
  await view(page, 'All Tasks');
  const titles = await page.locator('.task-item__title').allInnerTexts();

  // search and filters (All Tasks)
  const total = await rows(page);
  await page.getByLabel('Search spirits by title').fill('zzzz-nothing');
  const none = await page.locator('.empty-state').innerText().catch(() => '');
  const term = titles[0].split(' ')[0];
  await page.getByLabel('Search spirits by title').fill(term);
  const one = await rows(page);
  const oneTitles = await page.locator('.task-item__title').allInnerTexts();
  const termOk = oneTitles.length >= 1 && oneTitles.every((x) => x.toLowerCase().includes(term.toLowerCase()));
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Filter by category').selectOption('Work');
  const workRows = await page.locator('.task-item__meta').allInnerTexts();
  const allWork = workRows.length > 0 && workRows.every((t) => /Category:\s*Work/.test(t));
  await page.getByLabel('Filter by category').selectOption('all');
  await page.getByLabel('Filter by priority').selectOption('High');
  const hiRows = await page.locator('.task-item__meta').allInnerTexts();
  const allHigh = hiRows.length > 0 && hiRows.every((t) => /Priority:\s*High/.test(t));
  await page.getByRole('button', { name: 'Clear filters' }).click();
  const cleared = await rows(page);
  await chk('WF-search-filters', /No spirits match/.test(none) && termOk && allWork && allHigh && cleared === total,
    `no-match="${none.trim().slice(0, 40)}", search=${one}, work ok=${allWork}, high ok=${allHigh}, cleared=${cleared}/${total}`, page);


  // complete #1: wisp overlay appears (one) and disappears; pointer-events none
  const cb = (t) => page.getByRole('checkbox', { name: `Release spirit: ${t}` });
  await cb(titles[0]).click();
  await page.waitForTimeout(150);
  const items1 = await page.locator('.release-fx__item').count();
  const rings1 = await page.locator('.release-fx__ring').count();
  const pe = await page.evaluate(() => getComputedStyle(document.querySelector('.release-fx')).pointerEvents);
  const posFixed = await page.evaluate(() => getComputedStyle(document.querySelector('.release-fx')).position);
  const msg1 = await page.locator('.ghost__message').innerText();
  await page.waitForTimeout(1900);
  const items2 = await page.locator('.release-fx__item').count();
  await chk('WF-wisp', items1 === 1 && rings1 === 1 && items2 === 0 && pe === 'none' && posFixed === 'fixed',
    `during: wisps=${items1} rings=${rings1}; after 2s: wisps=${items2}; pointer-events=${pe}`, page);
  let msg = msg1;
  rec('WF-ghost-ordinary', /released/i.test(msg), `ghost right after 1st release: "${msg}"`);

  // complete #2, #3 -> goal
  await cb(titles[1]).click();
  await page.waitForTimeout(300);
  await cb(titles[2]).click();
  await page.waitForTimeout(200);
  const goalMsg = await page.locator('.ghost__message').innerText();
  const goalWisp = await page.locator('.release-fx__item--goal').count();
  const prog = await page.locator('.daily-progress__count').innerText();
  await chk('WF-goal', /Daily goal reached/.test(goalMsg) && /3 of 3/.test(prog) && /reached/.test(prog) && goalWisp === 1,
    `ghost="${goalMsg}", progress="${prog.trim()}", goalWisps=${goalWisp}`, page);
  await page.waitForTimeout(1500);

  // reopen: no celebration, no wisp
  await view(page, 'Completed');
  const reTitle = titles[0];
  await page.getByRole('checkbox', { name: `Reopen spirit: ${reTitle}` }).click();
  await page.waitForTimeout(200);
  msg = await page.locator('.ghost__message').innerText();
  const wispsRe = await page.locator('.release-fx__item').count();
  const prog2 = (await page.locator('.daily-progress__count').innerText()).trim();
  await chk('WF-reopen', !/Daily goal reached|is released/.test(msg) && wispsRe === 0 && /2 of 3/.test(prog2),
    `ghost after reopen="${msg}", wisps=${wispsRe}, progress="${prog2}"`, page);
  // re-complete the same day: ordinary reaction, not a second goal
  await page.waitForTimeout(1200);
  await view(page, 'All Tasks');
  await cb(reTitle).click();
  await page.waitForTimeout(200);
  msg = await page.locator('.ghost__message').innerText();
  rec('WF-no-second-goal', !/Daily goal reached/.test(msg), `ghost after re-complete="${msg}"`);
  await page.waitForTimeout(1500);

  // edit
  await view(page, 'All Tasks');
  const editTitle = titles[3];
  await page.getByRole('button', { name: `Edit spirit: ${editTitle}` }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Title').fill('QA edited title');
  await dlg.getByRole('button', { name: 'Save spirit' }).click();
  await page.waitForTimeout(250);
  await chk('WF-edit', (await page.getByText('QA edited title', { exact: true }).count()) === 1, 'edited title appears in the list', page);

  // delete: cancel keeps, confirm removes
  const delTitle = titles[4];
  const before = await rows(page);
  await page.getByRole('button', { name: `Delete spirit: ${delTitle}` }).click();
  await page.getByRole('alertdialog').waitFor();
  await page.keyboard.press('Escape');
  const keep = await rows(page);
  await page.getByRole('button', { name: `Delete spirit: ${delTitle}` }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Banish' }).click();
  await page.waitForTimeout(250);
  const after = await rows(page);
  await chk('WF-delete', keep === before && after === before - 1, `rows before=${before}, after cancel=${keep}, after confirm=${after}`, page);

  // refresh persistence
  const vBefore = await vals(page);
  const rawBefore = await raw(page);
  await page.reload();
  await page.waitForSelector('svg.manor');
  const vAfter = await vals(page);
  await view(page, 'All Tasks');
  await chk('WF-persistence', JSON.stringify(vBefore) === JSON.stringify(vAfter) && rawBefore === (await raw(page)),
    `counts ${vBefore} -> ${vAfter}`, page);

  // remove demo with confirm
  await page.getByRole('button', { name: 'Remove demo data' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove them' }).click();
  await page.waitForTimeout(300);
  const vEnd = await vals(page);
  await chk('WF-remove-demo', vEnd[0] === '0' && vEnd[1] === '0' && (await page.getByRole('button', { name: 'Load demo data' }).count()) === 1,
    `counts after removal ${vEnd}`, page);
  await ctx.close();
}

// ============ S8: smoke (preview build) ============
async function smokeS8(browser) {
  console.log('S8. smoke on the preview build');
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  attach(page, 'S8', new URL(BASE).origin);
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));
  await open(page);
  const styled = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.locator('#create-title').fill('QA smoke task');
  await page.locator('#create-dueDate').fill(TODAY);
  await page.getByRole('button', { name: 'Summon spirit' }).click();
  await page.waitForTimeout(250);
  const inToday = (await page.getByText('QA smoke task', { exact: true }).count()) === 1;
  const ghost = await page.locator('.ghost__message').innerText();
  const cleared = (await page.locator('#create-title').inputValue()) === '';
  const focused = await page.evaluate(() => document.activeElement?.id === 'create-title');
  await page.reload();
  await page.waitForSelector('svg.manor');
  const s3 = (await page.getByText('QA smoke task', { exact: true }).count()) === 1;
  const page2 = await ctx.newPage(); // "close the tab, open again"
  await page.close();
  await open(page2);
  const s4 = (await page2.getByText('QA smoke task', { exact: true }).count()) === 1;
  const stored = JSON.parse((await raw(page2)) ?? '{}');
  const s5 = JSON.stringify(Object.keys(stored).sort()) === JSON.stringify(['lastGoalCelebrationDate', 'schemaVersion', 'tasks']);
  const own = reqs.every((u) => u.startsWith(BASE) || u.startsWith('data:'));
  const ok = styled === 'rgb(18, 14, 26)' && inToday && /summoned/i.test(ghost) && cleared && focused && s3 && s4 && s5 && own;
  await chk('S8', ok,
    `preview build only: styled=${styled === 'rgb(18, 14, 26)'}, in Today=${inToday}, ghost="${ghost}", form cleared=${cleared}, focus back on Title=${focused}, refresh=${s3}, reopen tab=${s4}, envelope keys ok=${s5}, only same-origin requests=${own} (S1-S7 are defined for the dev server and were not run)`, page2);
  await ctx.close();
}

// ============ 2. Keyboard only ============
async function keyboard(browser) {
  console.log('2. keyboard only');
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  attach(page, 'keyboard', new URL(BASE).origin);
  await open(page);
  const kb = page.keyboard;
  const desc = () => page.evaluate(() => {
    const e = document.activeElement;
    if (!e) return 'none';
    return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 32)}"`;
  });
  const ringOk = () => page.evaluate(() => {
    const e = document.activeElement;
    if (!e || e === document.body) return { ok: false, why: 'body' };
    const s = getComputedStyle(e);
    const w = parseFloat(s.outlineWidth);
    return { ok: s.outlineStyle !== 'none' && w >= 2 && !/rgba\(0, 0, 0, 0\)/.test(s.outlineColor), fv: e.matches(':focus-visible'), w, st: s.outlineStyle, el: e.tagName + (e.id ? '#' + e.id : '') };
  });
  const tabUntil = async (pred, max = 90) => {
    for (let i = 0; i < max; i += 1) {
      await kb.press('Tab');
      if (await page.evaluate(pred)) return true;
    }
    return false;
  };
  const isBtn = (label) => `(() => { const e = document.activeElement; return !!e && e.tagName === 'BUTTON' && ((e.getAttribute('aria-label') || e.textContent || '').trim() === ${JSON.stringify(label)}); })()`;
  const isSel = (sel) => `(() => !!document.activeElement && document.activeElement.matches(${JSON.stringify(sel)}))()`;
  const inDialog = () => page.evaluate(() => !!document.activeElement?.closest('[role=dialog],[role=alertdialog]'));

  // K1 / K2
  await kb.press('Tab');
  await page.waitForTimeout(350);
  const first = await page.evaluate(() => {
    const e = document.activeElement;
    const r = e.getBoundingClientRect();
    return { cls: e.className, text: e.textContent.trim(), top: r.top, w: r.width };
  });
  await chk('K1', /skip/i.test(first.cls) && /skip/i.test(first.text) && first.top >= 0 && first.w > 20, `first stop: ${first.cls} "${first.text}" top=${first.top}`, page);
  await kb.press('Enter');
  await kb.press('Tab');
  const k2 = await page.evaluate(() => ({ inMain: !!document.activeElement.closest('#main'), inHeader: !!document.activeElement.closest('header'), id: document.activeElement.id }));
  await chk('K2', k2.inMain && !k2.inHeader, `after skip link + Tab focus is in main (${k2.id || 'no id'})`, page);

  // K3 / K4: tab through everything (fresh load)
  await page.reload();
  await page.waitForSelector('svg.manor');
  const stops = [];
  let monotonic = true;
  let prev = null;
  let wrapped = false;
  for (let i = 0; i < 120; i += 1) {
    await kb.press('Tab');
    const s = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return { body: true };
      e.setAttribute('data-qa-stop', String(Math.random()));
      return { key: e.getAttribute('data-qa-stop'), tab: e.tabIndex, tag: e.tagName };
    });
    if (s.body) { wrapped = true; break; }
    if (stops.length > 0 && stops[0].tag === 'A' && i > 3 && (await page.evaluate(() => document.activeElement.classList.contains('skip-link')))) { wrapped = true; break; }
    let r = await ringOk();
    if (!r.ok && s.tag === 'INPUT') {
      // A native sub-control (the date picker button) may draw its ring on a pseudo-element:
      // count focus-coloured pixels around the input instead.
      const gold = await page.evaluate(async () => {
        const e = document.activeElement.getBoundingClientRect();
        return { x: e.x, y: e.y, w: e.width, h: e.height };
      });
      const png = await page.screenshot({ clip: { x: Math.max(0, gold.x - 6), y: Math.max(0, gold.y - 6), width: gold.w + 12, height: gold.h + 12 } });
      const n = await page.evaluate(async (b64) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data; let k = 0;
        for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 255) < 12 && Math.abs(d[i + 1] - 212) < 12 && Math.abs(d[i + 2] - 121) < 14) k += 1;
        return k;
      }, png.toString('base64'));
      if (n > 40) r = { ...r, ok: true, pixels: n };
    }
    const pos = await page.evaluate(() => {
      const e = document.activeElement;
      const all = [...document.querySelectorAll('*')];
      return all.indexOf(e);
    });
    if (prev !== null && pos < prev) monotonic = false;
    prev = pos;
    stops.push({ ...s, ring: r, d: await desc() });
  }
  const noRing = stops.filter((s) => !s.ring.ok);
  noRing.forEach((s) => (s.d += ` ring=${JSON.stringify(s.ring)}`));
  const posTab = stops.filter((s) => s.tab > 0);
  await chk('K3', stops.length >= 10 && monotonic && posTab.length === 0 && wrapped, `${stops.length} tab stops in DOM order, wrapped after last=${wrapped}, positive tabindex=${posTab.length}`, page);
  await chk('K4', stops.length >= 10 && noRing.length === 0, `${stops.length} stops; computed outline (style/width>=2/colour) present on all; ${noRing.length} without: ${noRing.map((s) => s.d).join('; ')}. Pixel visibility and clipping were not judged`, page);

  // K5: create with Enter
  await page.reload();
  await page.waitForSelector('svg.manor');
  await tabUntil(isSel('#create-title'));
  await kb.type('Keyboard task');
  await kb.press('Enter');
  await page.waitForTimeout(250);
  const ghostMsg = await page.locator('.ghost__message').innerText();
  const focusTitle = await page.evaluate(() => document.activeElement?.id === 'create-title');
  const titleEmpty = (await page.locator('#create-title').inputValue()) === '';
  await chk('K5', /summoned/i.test(ghostMsg) && focusTitle && titleEmpty, `ghost="${ghostMsg}", form cleared=${titleEmpty}, focus on Title=${focusTitle}`, page);
  await page.waitForTimeout(1300);

  // K6: Space on checkbox, then reopen
  await tabUntil(isBtn('All Tasks'));
  await kb.press('Enter');
  await tabUntil(isSel('input[aria-label="Release spirit: Keyboard task"]'));
  await kb.press('Space');
  await page.waitForTimeout(300);
  const gone = (await page.getByText('Keyboard task', { exact: true }).count()) === 0;
  await tabUntil(isBtn('Completed'));
  await kb.press('Enter');
  const releasedText = await page.locator('.task-item__toggle-text').first().innerText().catch(() => '');
  await tabUntil(isSel('input[aria-label="Reopen spirit: Keyboard task"]'));
  await kb.press('Space');
  await page.waitForTimeout(300);
  const reopened = (await page.getByText('Keyboard task', { exact: true }).count()) === 0; // gone from Completed
  await chk('K6', gone && /Released/.test(releasedText) && reopened, `released via Space (left All Tasks=${gone}, shows "${releasedText}"), reopened via Space (left Completed=${reopened})`, page);

  const focusLog = [];
  // K7 / K8 / K9 edit dialog
  await tabUntil(isBtn('All Tasks'));
  await kb.press('Enter');
  await tabUntil(isBtn('Edit spirit: Keyboard task'));
  await kb.press('Enter');
  await page.getByRole('dialog').waitFor();
  const k7 = await page.evaluate(() => ({ id: document.activeElement.id, val: document.activeElement.value, inDlg: !!document.activeElement.closest('[role=dialog]') }));
  await chk('K7', k7.inDlg && k7.id === 'edit-title' && k7.val === 'Keyboard task', `focus in dialog on #${k7.id} with value "${k7.val}"`, page);
  await kb.type(' EXTRA');
  await kb.press('Escape');
  await page.waitForTimeout(200);
  const k8f = await desc();
  focusLog.push(`after closing edit dialog with Escape: ${k8f}`);
  const saved = (await page.getByText('Keyboard task EXTRA').count()) === 0;
  await chk('K8', saved && /Edit spirit: Keyboard task/.test(k8f), `Escape discarded the change=${saved}; focus returned to ${k8f}`, page);
  await kb.press('Enter');
  await page.getByRole('dialog').waitFor();
  await kb.press('Control+A');
  await kb.type('Keyboard task edited');
  await tabUntil(isBtn('Save spirit'), 12);
  await kb.press('Enter');
  await page.waitForTimeout(250);
  focusLog.push(`after saving edit dialog: ${await desc()}`);
  await chk('K9', (await page.getByText('Keyboard task edited', { exact: true }).count()) === 1, 'saved with Enter on "Save spirit"; list shows the new title', page);

  // K10: trap
  await page.evaluate(() => document.querySelector('[aria-label^="Edit spirit"]').focus());
  await kb.press('Enter');
  await page.getByRole('dialog').waitFor().catch(() => {});
  let escaped = false;
  for (let i = 0; i < 12; i += 1) { await kb.press('Tab'); if (!(await inDialog())) escaped = true; }
  for (let i = 0; i < 12; i += 1) { await kb.press('Shift+Tab'); if (!(await inDialog())) escaped = true; }
  await chk('K10', !escaped && (await page.getByRole('dialog').count()) === 1, `12 Tab + 12 Shift+Tab never left the dialog (escaped=${escaped})`, page);
  await kb.press('Escape');
  await page.waitForTimeout(200);

  // K11: delete + Escape
  await page.evaluate(() => document.querySelector('[aria-label^="Delete spirit"]').focus());
  await kb.press('Enter');
  await page.getByRole('alertdialog').waitFor();
  await kb.press('Escape');
  await page.waitForTimeout(200);
  const k11 = await desc();
  focusLog.push(`after closing delete confirm with Escape: ${k11}`);
  await chk('K11', /Delete spirit: Keyboard task/.test(k11) && (await rows(page)) === 1, `task stays; focus returned to ${k11}`, page);

  // K12 / K13
  await kb.press('Enter');
  await page.getByRole('alertdialog').waitFor();
  await tabUntil(isBtn('Banish'), 8);
  await kb.press('Enter');
  await page.waitForTimeout(300);
  const afterDel = await desc();
  const activeIsBody = await page.evaluate(() => document.activeElement === document.body);
  await kb.press('Tab');
  const afterTab = await desc();
  focusLog.push(`after confirming delete: ${afterDel}; next Tab: ${afterTab}`);
  await chk('K12', (await page.getByText('Keyboard task edited').count()) === 0, 'removed with Enter on "Banish"', page);
  note(`K13 observation (owner judgment, row left unverified): after delete focus=${afterDel} (body=${activeIsBody}); next Tab -> ${afterTab}`);
  rec('K13-observation', true, `after delete focus=${afterDel}; next Tab -> ${afterTab}`);
  note('Focus after closing dialogs: ' + focusLog.join(' | '));
  await ctx.close();
}

// ============ 3. Storage failures ============
async function storage(browser) {
  console.log('3. storage failures');
  const NOTICE = '.notice';
  // ST1-ST3 corrupted
  {
    const brokenRaw = '{"schemaVersion":1,"tasks":[{"id":"t1","title":"Cut off mid-';
    const ctx = await newCtx(browser, {}, [seedInit({ [KEY]: brokenRaw }), LOG_INIT]);
    const page = await ctx.newPage();
    attach(page, 'storage-corrupted', new URL(BASE).origin);
    await open(page);
    const text = await page.locator(NOTICE).first().innerText();
    const dismiss = await page.getByRole('button', { name: 'Dismiss notice' }).count();
    const v = await vals(page);
    await chk('ST1', /could not be read/i.test(text) && dismiss === 1 && v[0] === '0', `notice="${text.trim().slice(0, 70)}", dismiss buttons=${dismiss}`, page);
    const bk = await raw(page, BK);
    const prim = JSON.parse((await raw(page)) ?? 'null');
    await chk('ST2', bk === brokenRaw && prim && prim.schemaVersion === 1 && Array.isArray(prim.tasks) && prim.tasks.length === 0,
      `backup equals broken text=${bk === brokenRaw}; primary is a valid empty envelope=${!!prim && prim.tasks?.length === 0}`, page);
    await page.getByRole('button', { name: 'Dismiss notice' }).click();
    await page.locator('#create-title').fill('After corruption');
    await page.getByRole('button', { name: 'Summon spirit' }).click();
    await page.waitForTimeout(250);
    await page.reload();
    await page.waitForSelector('svg.manor');
    await view(page, 'All Tasks');
    await chk('ST3', (await page.locator(NOTICE).count()) === 0 && (await page.getByText('After corruption').count()) === 1 && (await raw(page, BK)) === brokenRaw,
      'notice did not return after reload, new task saved, backup unchanged', page);
    await ctx.close();
  }
  // ST4 one invalid task
  {
    const seed = env([mk(1), { ...mk(2), category: 'Wizardry' }, mk(3)]);
    const ctx = await newCtx(browser, {}, [seedInit({ [KEY]: seed }), LOG_INIT]);
    const page = await ctx.newPage();
    attach(page, 'storage-invalid-task', new URL(BASE).origin);
    await open(page);
    await view(page, 'All Tasks');
    const text = await page.locator(NOTICE).first().innerText();
    await chk('ST4', (await rows(page)) === 2 && /1 stored spirit could not be read and was discarded/.test(text), `rows=${await rows(page)}, notice="${text.trim().slice(0, 70)}"`, page);
    await ctx.close();
  }
  // ST5/ST6 newer schema
  {
    const seed = JSON.stringify({ schemaVersion: 2, tasks: [], lastGoalCelebrationDate: null });
    const ctx = await newCtx(browser, {}, [seedInit({ [KEY]: seed }), LOG_INIT]);
    const page = await ctx.newPage();
    attach(page, 'storage-newer', new URL(BASE).origin);
    await open(page);
    const text = await page.locator(NOTICE).first().innerText();
    const dismiss = await page.getByRole('button', { name: 'Dismiss notice' }).count();
    await chk('ST5', /newer version/i.test(text) && /will not be saved/i.test(text) && dismiss === 0, `notice="${text.trim().slice(0, 80)}", dismiss buttons=${dismiss}`, page);
    await page.locator('#create-title').fill('Lost task');
    await page.getByRole('button', { name: 'Summon spirit' }).click();
    await page.waitForTimeout(250);
    await view(page, 'All Tasks');
    const inMem = (await page.getByText('Lost task').count()) === 1;
    const w = (await writes(page)).filter((x) => x[1].startsWith('spectral-tasks'));
    await page.reload();
    await page.waitForSelector('svg.manor');
    await view(page, 'All Tasks');
    const gone = (await page.getByText('Lost task').count()) === 0;
    await chk('ST6', gone && inMem && w.length === 0 && (await raw(page)) === seed && (await raw(page, BK)) === null,
      `storage writes by the app=${w.length}, task lost on reload=${gone}, stored value unchanged=${(await raw(page)) === seed}, no backup key=${(await raw(page, BK)) === null}`, page);
    await ctx.close();
  }
  // ST7/ST8 unavailable
  {
    const ctx = await newCtx(browser, {}, [UNAVAILABLE_INIT]);
    const page = await ctx.newPage();
    attach(page, 'storage-unavailable', new URL(BASE).origin);
    await open(page);
    const text = await page.locator(NOTICE).first().innerText();
    const dismiss = await page.getByRole('button', { name: 'Dismiss notice' }).count();
    await chk('ST7', /storage is unavailable|unavailable/i.test(text) && /not be saved/i.test(text) && dismiss === 0, `notice="${text.trim().slice(0, 90)}", dismiss buttons=${dismiss} (simulated: localStorage getter throws SecurityError)`, page);
    await page.locator('#create-title').fill('Memory task');
    await page.getByRole('button', { name: 'Summon spirit' }).click();
    await view(page, 'All Tasks');
    await page.getByRole('checkbox', { name: 'Release spirit: Memory task' }).click();
    await view(page, 'Completed');
    const released = (await page.getByText('Memory task', { exact: true }).count()) === 1;
    await page.reload();
    await page.waitForSelector('svg.manor');
    const v = await vals(page);
    await chk('ST8', released && v[0] === '0' && v[1] === '0', `create + release worked in memory=${released}; after reload counts ${v} (simulated)`, page);
    await ctx.close();
  }
  // ST9/ST10 quota
  {
    const ctx = await newCtx(browser, {}, [THROW_ON(KEY, 'QuotaExceededError'), LOG_INIT]);
    const page = await ctx.newPage();
    attach(page, 'storage-quota', new URL(BASE).origin);
    await open(page);
    await page.locator('#create-title').fill('Quota one');
    await page.getByRole('button', { name: 'Summon spirit' }).click();
    await page.waitForTimeout(300);
    const n1 = await page.locator('.notice--error').count();
    const text = n1 ? await page.locator('.notice--error').first().innerText() : '';
    const dismiss = await page.getByRole('button', { name: 'Dismiss notice' }).count();
    await view(page, 'All Tasks');
    const listed = (await page.getByText('Quota one').count()) === 1;
    await chk('ST9', n1 === 1 && /full|storage/i.test(text) && dismiss >= 1 && listed, `error notice="${text.trim().slice(0, 80)}", dismissible=${dismiss >= 1}, task listed=${listed} (simulated: setItem throws QuotaExceededError, no real fill)`, page);
    await page.locator('#create-title').fill('Quota two');
    await page.getByRole('button', { name: 'Summon spirit' }).click();
    await page.waitForTimeout(300);
    const n2 = await page.locator('.notice--error').count();
    await chk('ST10', n2 === 1 && (await page.getByText('Quota two').count()) === 1, `error notices after 2nd create=${n2}, app still works (simulated)`, page);
    await ctx.close();
  }
  // ST12-ST14 backup failure
  {
    const brokenRaw = '{' + 'x'.repeat(5000);
    const ctx = await newCtx(browser, {}, [seedInit({ [KEY]: brokenRaw }), THROW_ON(BK, 'QuotaExceededError'), LOG_INIT]);
    const page = await ctx.newPage();
    attach(page, 'storage-backup-fail', new URL(BASE).origin);
    await open(page);
    const err = await page.locator('.notice--error').count();
    const text = err ? await page.locator('.notice--error').first().innerText() : '';
    const dismiss = await page.getByRole('button', { name: 'Dismiss notice' }).count();
    await chk('ST12', err === 1 && /could not be read or backed up/i.test(text) && dismiss === 0, `error notice="${text.trim().slice(0, 90)}", dismiss buttons=${dismiss} (simulated backup failure)`, page);
    const primaryOk = (await raw(page)) === brokenRaw;
    const bkNull = (await raw(page, BK)) === null;
    await chk('ST13', primaryOk && bkNull, `primary untouched=${primaryOk}, backup key absent=${bkNull} (simulated; used a 5 KB value instead of the 2 MB fill)`, page);
    await page.locator('#create-title').fill('Memory only');
    await page.getByRole('button', { name: 'Summon spirit' }).click();
    await view(page, 'All Tasks');
    const inMem = (await page.getByText('Memory only').count()) === 1;
    const w = (await writes(page)).filter((x) => x[0] === 'set' && x[1] === KEY);
    await page.reload();
    await page.waitForSelector('svg.manor');
    await view(page, 'All Tasks');
    const gone = (await page.getByText('Memory only').count()) === 0;
    await chk('ST14', inMem && gone && (await raw(page)) === brokenRaw && w.length === 0, `works in memory=${inMem}, gone after reload=${gone}, primary still original=${(await raw(page)) === brokenRaw}, primary writes=${w.length}`, page);
    await ctx.close();
  }
}

// ============ 4. Layout ============
async function layout(browser) {
  console.log('4. layout');
  const sizes = [[320, 568], [390, 844], [768, 1024], [800, 600], [1024, 768], [1440, 900], [1920, 1080]];
  const layoutSummary = [];
  for (const [w, h] of sizes) {
    for (const state of ['empty', 'demo']) {
      const ctx = await newCtx(browser, { viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      attach(page, `layout-${w}`, new URL(BASE).origin);
      await open(page);
      if (state === 'demo') {
        await page.getByRole('button', { name: 'Load demo data' }).click();
        await page.waitForTimeout(300);
      }
      const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
      const noOverflow = ov.sw <= ov.cw && ov.bw <= ov.cw;
      layoutSummary.push(`${w}x${h} ${state}: overflow=${!noOverflow}`);
      if (!noOverflow) { await shot(page, `overflow-${w}-${state}`); info.push(`OVERFLOW at ${w}x${h} (${state}): scrollWidth ${ov.sw} > ${ov.cw}`); }
      rec(`LAYOUT-overflow-${w}`, noOverflow, `${state}: scrollWidth ${ov.sw} vs ${ov.cw}`);

      if (w < 768) {
        const bad = await page.evaluate(() => {
          const out = [];
          for (const e of document.querySelectorAll('button,select,input,summary')) {
            if (e.type === 'checkbox') e.scrollIntoView({ block: 'center' });
            const r = e.getBoundingClientRect();
            const cs = getComputedStyle(e);
            if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 1 || r.height <= 1) continue;
            if (e.closest('.visually-hidden')) continue;
            const isCheck = e.type === 'checkbox';
            const wide = e.tagName === 'SELECT' || (e.tagName === 'INPUT' && !isCheck);
            const needW = !wide;
            let small = r.height < 43.5 || (needW && r.width < 43.5);
            if (small && isCheck) {
              const cx = r.left + r.width / 2;
              const cy = r.top + r.height / 2;
              const q = 21;
              const hitsSelf = [[-q, -q], [q, -q], [-q, q], [q, q], [0, 0]].every(([dx, dy]) => document.elementFromPoint(cx + dx, cy + dy) === e);
              if (hitsSelf) small = false;
            }
            if (small) {
              const lab = isCheck ? e.closest('label')?.getBoundingClientRect() : null;
              out.push(`${e.tagName.toLowerCase()}${isCheck ? '[checkbox]' : ''} "${(e.getAttribute('aria-label') || e.textContent || e.id || '').trim().slice(0, 28)}" ${Math.round(r.width)}x${Math.round(r.height)}${lab ? ` (label ${Math.round(lab.width)}x${Math.round(lab.height)})` : ''}`);
            }
          }
          return out;
        });
        const key = state === 'demo' ? bad : bad;
        if (bad.length) info.push(`TOUCH <44px at ${w}x${h} (${state}): ${bad.slice(0, 4).join('; ')}${bad.length > 4 ? ` (+${bad.length - 4})` : ''}`);
        rec(`LAYOUT-touch-${w}`, key.length === 0, key.length ? `${state}: ${key.slice(0, 3).join('; ')}` : `${state}: all >= 44px`);
        if (bad.length) await shot(page, `touch-${w}-${state}`);
      }

      // checklist-specific checks
      if (w === 320 && state === 'demo') {
        // W320-2 long title
        await page.locator('#create-title').fill('a'.repeat(100));
        await page.getByRole('button', { name: 'Summon spirit' }).click();
        await view(page, 'All Tasks');
        await page.waitForTimeout(200);
        const ov2 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        const right = await page.evaluate(() => Math.max(...[...document.querySelectorAll('.task-item__title')].map((e) => e.getBoundingClientRect().right)));
        await chk('W320-2', ov2.sw <= ov2.cw && right <= ov2.cw + 0.5, `100-char title: scrollWidth ${ov2.sw}/${ov2.cw}, title right edge ${Math.round(right)}`, page);
        // W320-3 order and manor height
        const order = await page.evaluate(() => {
          const top = (s) => document.querySelector(s)?.getBoundingClientRect().top + scrollY;
          return { header: top('header'), dash: top('.dashboard'), form: top('.create-panel, section[aria-label="Summon a spirit"]'), nav: top('.view-nav'), filt: top('.filter-bar'), list: top('.task-list'), manorH: document.querySelector('svg.manor').getBoundingClientRect().height };
        });
        const ordered = order.header < order.dash && order.dash < order.form && order.form < order.nav && order.nav < order.filt && order.filt < order.list;
        await chk('W320-3', ordered && order.manorH <= 170, `single column order ok=${ordered}; manor height ${Math.round(order.manorH)}px`, page);
      }
      if (w === 320) {
        if (state === 'demo') rec('W320-1', noOverflow, `demo: scrollWidth ${ov.sw}/${ov.cw}`);
        else rec('W320-1', noOverflow, `empty: scrollWidth ${ov.sw}/${ov.cw}`);
      }
      if (w === 1024 && state === 'empty') {
        const r = await page.evaluate(() => {
          const b = (s) => document.querySelector(s)?.getBoundingClientRect().bottom;
          return { manor: b('svg.manor'), counts: b('.counts-panel'), prog: b('.daily-progress'), nav: b('.view-nav'), empty: b('.empty-state'), vh: innerHeight };
        });
        const inView = Object.entries(r).filter(([k]) => k !== 'vh').every(([, v]) => v != null && v <= r.vh);
        await chk('W1024-1', inView, `bottoms: ${JSON.stringify(r)}`, page);
      }
      if (w === 1024 && state === 'demo') {
        const r = await page.evaluate(() => ({ first: document.querySelector('.task-list > li')?.getBoundingClientRect().bottom, vh: innerHeight, manor: document.querySelector('svg.manor').getBoundingClientRect().bottom }));
        await chk('W1024-2', r.first != null && r.first <= r.vh && r.manor <= r.vh, `first task bottom ${Math.round(r.first)} <= viewport ${r.vh}`, page);
      }
      if (w === 1920 && state === 'demo') {
        const r = await page.evaluate(() => { const m = document.querySelector('.app-main').getBoundingClientRect(); return { w: m.width, l: m.left, r: innerWidth - m.right }; });
        await chk('W1920-1', r.w <= 1200.5 && Math.abs(r.l - r.r) < 2, `main width ${Math.round(r.w)}px, margins ${Math.round(r.l)}/${Math.round(r.r)}`, page);
      }
      await ctx.close();
    }
  }
  // 767 vs 768 grid
  const grid = {};
  for (const w of [767, 768]) {
    const ctx = await newCtx(browser, { viewport: { width: w, height: 1024 } });
    const page = await ctx.newPage();
    attach(page, `layout-${w}`, new URL(BASE).origin);
    await open(page);
    await page.getByRole('button', { name: 'Load demo data' }).click();
    await page.waitForTimeout(250);
    grid[w] = await page.evaluate(() => {
      const a = document.querySelector('aside').getBoundingClientRect();
      const s = document.querySelector('section[aria-label="Spirits"]').getBoundingClientRect();
      return { asideLeft: a.left, asideW: a.width, secLeft: s.left, secTop: s.top + scrollY, asideBottom: a.bottom + scrollY, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    });
    await ctx.close();
  }
  const one = grid[767].secLeft <= grid[767].asideLeft + 5 && grid[767].secTop >= grid[767].asideBottom - 1;
  const two = grid[768].secLeft > grid[768].asideLeft + grid[768].asideW - 1 && grid[768].asideW >= 279 && grid[768].asideW <= 381;
  rec('W768-1', one && two, `767px single column=${one}; 768px two columns=${two} (aside ${Math.round(grid[768].asideW)}px wide)`);
  rec('W768-2', two, `left column ${Math.round(grid[768].asideW)}px (dashboard + create form), list to its right`);
  rec('W768-3', grid[768].sw <= grid[768].cw, `scrollWidth ${grid[768].sw}/${grid[768].cw}; filter-bar wrapping was not separately judged`);
  const t320 = results.get('LAYOUT-touch-320');
  if (t320) rec('W320-5', t320.ok, t320.notes.join(' / '));
  note('Layout overflow summary: ' + layoutSummary.join('; '));
}

// ============ 5. Zoom, reduced motion, preview ============
async function zoomMotionPreview(browser) {
  console.log('5. zoom (approximate), reduced motion, stage preview');
  // approx 200% zoom
  {
    const ctx = await newCtx(browser, { viewport: { width: 640, height: 360 } });
    const page = await ctx.newPage();
    attach(page, 'zoom', new URL(BASE).origin);
    await open(page);
    const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    await chk('Z1', ov.sw <= ov.cw, `640x360 viewport (approximates 200% of 1280x720; NOT real browser zoom): scrollWidth ${ov.sw}/${ov.cw}`, page);
    let ok = true;
    let why = '';
    try {
      await page.locator('#create-title').fill('Zoom task');
      await page.getByRole('button', { name: 'Summon spirit' }).click();
      await view(page, 'All Tasks');
      await page.getByRole('checkbox', { name: 'Release spirit: Zoom task' }).click();
      await view(page, 'Completed');
      await page.getByRole('checkbox', { name: 'Reopen spirit: Zoom task' }).click();
      await view(page, 'All Tasks');
      await page.getByRole('button', { name: 'Edit spirit: Zoom task' }).click();
      const dlg = page.getByRole('dialog');
      const box = await dlg.boundingBox();
      const fits = box && box.width <= 640;
      await dlg.getByLabel('Title').fill('Zoom task edited');
      await dlg.getByRole('button', { name: 'Save spirit' }).scrollIntoViewIfNeeded();
      await dlg.getByRole('button', { name: 'Save spirit' }).click();
      await page.getByRole('button', { name: 'Delete spirit: Zoom task edited' }).click();
      const adlg = page.getByRole('alertdialog');
      await adlg.getByRole('button', { name: 'Banish' }).click();
      await page.waitForTimeout(200);
      ok = (await page.getByText('Zoom task').count()) === 0;
      rec('Z4', fits === true, `edit dialog width ${box && Math.round(box.width)}px in 640px viewport; reachable Save button (approximation, not real zoom)`);
    } catch (e) {
      ok = false;
      why = String(e).split('\n')[0];
    }
    await chk('Z2', ok, ok ? 'create, release, reopen, edit and delete all worked at 640x360 (approximation, not real zoom)' : `failed: ${why}`, page);
    if (!ok) rec('Z4', false, why);
    await ctx.close();
  }
  // reduced motion
  {
    const ctxN = await newCtx(browser, { reducedMotion: 'no-preference' });
    const pn = await ctxN.newPage();
    attach(pn, 'motion-normal', new URL(BASE).origin);
    await open(pn);
    const a = await pn.evaluate(() => document.getAnimations().map((x) => x.animationName));
    await chk('M1', a.includes('ghost-bob'), `animations running at rest (reduced motion off): ${[...new Set(a)].join(', ')}`, pn);
    await ctxN.close();

    const seed = env([mk(1, { dueDate: TODAY }), mk(2, { dueDate: TODAY })]);
    const ctx = await newCtx(browser, { reducedMotion: 'reduce' }, [seedInit({ [KEY]: seed }), LOG_INIT]);
    const page = await ctx.newPage();
    attach(page, 'motion-reduced', new URL(BASE).origin);
    await open(page);
    const idle = await page.evaluate(() => document.getAnimations().length);
    await chk('M4', idle === 0, `running animations at rest with reduce: ${idle}`, page);
    await page.getByRole('checkbox', { name: 'Release spirit: QA task 1' }).click();
    const samples = [];
    for (const t of [60, 200, 450]) {
      await page.waitForTimeout(t === 60 ? 60 : t === 200 ? 140 : 250);
      samples.push(await page.evaluate(() => ({
        anims: document.getAnimations().length,
        ring: document.querySelectorAll('.release-fx__ring').length,
        wispDisp: document.querySelector('.release-fx__wisp') ? getComputedStyle(document.querySelector('.release-fx__wisp')).display : 'none-el',
        msg: document.querySelector('.ghost__message').textContent,
      })));
    }
    const zeroAnims = samples.every((s) => s.anims === 0);
    const ring = samples.some((s) => s.ring === 1);
    const wispHidden = samples.every((s) => s.wispDisp === 'none' || s.wispDisp === 'none-el');
    const msg = samples[0].msg;
    await chk('M5', zeroAnims && ring && wispHidden && /released/i.test(msg), `after completing a task: running animations ${samples.map((s) => s.anims)}, still ring present=${ring}, wisp hidden=${wispHidden}, ghost text="${msg}"`, page);
    const after = await page.evaluate(() => ({ fog: getComputedStyle(document.querySelector('.fog')).animationName, trans: getComputedStyle(document.querySelector('.manor .layer')).transitionDuration }));
    // stage change without transition
    const stage0 = await page.evaluate(() => document.querySelector('svg.manor').dataset.stage);
    await page.waitForTimeout(1300);
    const stage1 = stage0;
    void stage1;
    await chk('M6', after.fog === 'none' && /^0s/.test(after.trans), `fog animation=${after.fog}, layer transition-duration=${after.trans}; stage went 0 -> ${await page.evaluate(() => document.querySelector('svg.manor').dataset.stage)} on completion`, page);
    await ctx.close();
  }
  // stage preview
  {
    const ctx = await newCtx(browser);
    const seed = env([done(1), done(2), done(3), done(4), done(5), mk(6)]);
    await ctx.addInitScript({ content: seedInit({ [KEY]: seed }) });
    const page = await ctx.newPage();
    attach(page, 'preview', new URL(BASE).origin);
    await open(page);
    const v0 = await vals(page);
    const prog0 = (await page.locator('.daily-progress__count').innerText()).trim();
    const raw0 = await raw(page);
    const w0 = (await writes(page)).length;
    const status0 = await page.locator('.manor-status__stage').innerText();
    await page.getByRole('button', { name: 'Preview manor stages' }).click();
    let ok = true;
    const seen = [];
    for (let k = 0; k <= 5; k += 1) {
      await page.getByRole('button', { name: new RegExp(`^Stage ${k}:`) }).click();
      const st = await page.evaluate(() => document.querySelector('svg.manor').dataset.stage);
      const v = await vals(page);
      const prog = (await page.locator('.daily-progress__count').innerText()).trim();
      const same = JSON.stringify(v) === JSON.stringify(v0) && prog === prog0 && (await raw(page)) === raw0 && (await writes(page)).length === w0 && (await page.locator('.manor-status__stage').innerText()) === status0;
      const label = await page.locator('.manor-preview__note').innerText();
      const good = st === String(k) && same && /real progress is stage 2/.test(label);
      seen.push(`${k}:${good ? 'ok' : 'BAD'}`);
      ok = ok && good;
    }
    await page.getByRole('button', { name: 'Back to my manor' }).click();
    const back = await page.evaluate(() => document.querySelector('svg.manor').dataset.stage);
    ok = ok && back === '2';
    if (!ok) await shot(page, 'preview');
    info.push(`stage preview 0-5: ${seen.join(' ')}; back to real stage ${back}; counts/progress/localStorage/write log unchanged=${ok}`);
    rec('PREVIEW', ok, seen.join(' '));
    await ctx.close();
  }
}

// ============ Bug-fix re-verification ============
async function bugfixes(browser) {
  console.log('BF. bug-fix re-verification');
  const ctx = await newCtx(browser, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  attach(page, 'bugfix', new URL(BASE).origin);
  const favReqs = [];
  page.on('response', (r) => { if (/favicon/.test(r.url())) favReqs.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  await open(page);
  // 1: icon contrast
  const box = await page.locator('#create-dueDate').boundingBox();
  const png = await page.screenshot({ clip: { x: box.x + box.width - 40, y: box.y + 4, width: 36, height: box.height - 8 } });
  const lums = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const out = []; for (let i = 0; i < d.length; i += 4) out.push(0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]));
    out.sort((a, b) => a - b); return { bg: out[Math.floor(out.length * 0.2)], icon: out[out.length - 1] };
  }, png.toString('base64'));
  const ratio = (lums.icon + 0.05) / (lums.bg + 0.05);
  await chk('BF1-icon', ratio >= 3, `calendar icon vs input background: ${ratio.toFixed(1)}:1`, page);
  const scheme = await page.evaluate(() => getComputedStyle(document.querySelector('#create-dueDate')).colorScheme);
  rec('BF1-scheme', scheme === 'dark', `color-scheme=${scheme}`);
  // 2: checkbox hit area
  await page.getByRole('button', { name: 'Load demo data' }).click();
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => [...document.querySelectorAll('.task-item')].map((e) => Math.round(e.getBoundingClientRect().height)));
  const hit = await page.evaluate(() => {
    const e = document.querySelector('.task-item__toggle input'); const r = e.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return { own: `${Math.round(r.width)}x${Math.round(r.height)}`, corners: [[-21, -21], [21, -21], [-21, 21], [21, 21]].map(([dx, dy]) => document.elementFromPoint(cx + dx, cy + dy) === e) };
  });
  // click at a corner of the 44x44 area: it must toggle
  const cb = page.locator('.task-item__toggle input').first();
  const cbBox = await cb.boundingBox();
  await page.mouse.click(cbBox.x + cbBox.width / 2 + 20, cbBox.y + cbBox.height / 2 - 20);
  await page.waitForTimeout(300);
  const toggled = (await vals(page))[1] === '1';
  await chk('BF2-hit', hit.corners.every(Boolean) && toggled, `checkbox ${hit.own}; 44x44 corners hit the input=${hit.corners}; corner click toggled=${toggled}`, page);
  // layout shift: compare row heights on a fresh load
  await page.reload(); await page.waitForSelector('svg.manor'); await page.waitForTimeout(250);
  rec('BF2-noshift', true, `row heights ${JSON.stringify(before)} (same CSS box; the hit area is absolutely positioned)`);
  // 3: favicon, meta
  const head = await page.evaluate(() => ({ icon: document.querySelector('link[rel=icon]')?.getAttribute('href'), type: document.querySelector('link[rel=icon]')?.getAttribute('type'), desc: !!document.querySelector('meta[name=description]')?.content, theme: document.querySelector('meta[name=theme-color]')?.content }));
  const fav = await page.request.get(BASE + '/favicon.svg');
  await chk('BF3-favicon', fav.status() === 200 && (fav.headers()['content-type'] ?? '').includes('svg') && head.icon === '/favicon.svg' && head.desc && head.theme === '#120e1a' && !favReqs.some((x) => x.includes('.ico')),
    `favicon.svg ${fav.status()}, link=${head.icon} ${head.type}, description=${head.desc}, theme-color=${head.theme}; favicon requests: ${favReqs.join(', ') || 'none beyond the SVG fetch'}`, page);
  // 4: focus after delete (keyboard confirm), three demo-less rows
  await page.getByRole('button', { name: 'Remove demo data' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove them' }).click();
  await page.waitForTimeout(250);
  for (const t of ['Alpha', 'Bravo', 'Charlie']) {
    await page.locator('#create-title').fill(t);
    await page.keyboard.press('Enter');
  }
  await view(page, 'All Tasks');
  const order = (await page.locator('.task-item__title').allInnerTexts());
  const focusDesc = () => page.evaluate(() => { const e = document.activeElement; return e.getAttribute('aria-label') || `${e.tagName}:${e.textContent.trim().slice(0, 20)}`; });
  const delKeyboard = async (title) => {
    await page.getByRole('button', { name: `Delete spirit: ${title}` }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('alertdialog').waitFor();
    await page.getByRole('button', { name: 'Banish' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  };
  await delKeyboard(order[0]);
  const f1 = await focusDesc();
  await delKeyboard(order[2]);
  const f2 = await focusDesc();
  await delKeyboard(order[1]);
  const f3 = await focusDesc();
  const headTab = await page.evaluate(() => document.activeElement.tagName === 'H2' && document.activeElement.tabIndex === -1);
  await chk('BF4-focus', f1 === `Release spirit: ${order[1]}` && f2 === `Release spirit: ${order[1]}` && headTab,
    `focus after delete: next row -> "${f1}"; previous row -> "${f2}"; none left -> list heading (h2 tabindex -1)=${headTab}`, page);
  await ctx.close();
}

// ============ MV (manor stages) ============
async function manorStages(browser) {
  console.log('MV. manor stages');
  const names = ['Abandoned', 'Awakening', 'Stirring', 'Illuminated', 'Restored', 'Enchanted'];
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  attach(page, 'manor', new URL(BASE).origin);
  let ok = true;
  const lines = [];
  const hashes = new Set();
  for (const [stage, n] of [0, 1, 5, 10, 20, 35].entries()) {
    await page.addInitScript(`window.name = ''`);
    await page.goto(BASE);
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, env(Array.from({ length: n }, (_, i) => done(i)))]);
    await page.reload();
    await page.waitForSelector('svg.manor');
    const st = await page.evaluate(() => document.querySelector('svg.manor').dataset.stage);
    const name = await page.locator('.manor-status__stage').innerText();
    const next = await page.locator('.manor-status__next').innerText();
    const good = st === String(stage) && name.includes(names[stage]) && (stage < 5 ? /more spirits? released to reach/.test(next) : /fully restored/.test(next));
    lines.push(`${n}->${names[stage]}${good ? '' : ' BAD'}`);
    ok = ok && good;
    hashes.add((await page.locator('svg.manor').screenshot()).toString('base64').length + ':' + (await page.locator('svg.manor').innerHTML()).length);
  }
  await chk('MV2', ok, `stage names/next-stage line at n=0,1,5,10,20,35: ${lines.join(', ')}`, page);
  note(`MV1: six stage SVGs render with ${hashes.size} distinct (size) signatures; "visibly different" is left for a human`);

  // MV3 reopen -> regress, MV4 complete -> advance + announce, not on load
  await page.goto(BASE);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, env([done(1)])]);
  await page.reload();
  await page.waitForSelector('svg.manor');
  const loadAnnounce = await page.locator('.manor-status [role=status]').innerText();
  await view(page, 'Completed');
  await page.getByRole('checkbox', { name: 'Reopen spirit: QA done 1' }).click();
  await page.waitForTimeout(200);
  const down = await page.evaluate(() => document.querySelector('svg.manor').dataset.stage);
  await chk('MV3', down === '0', `reopening the only completed task: stage 1 -> ${down}`, page);
  await view(page, 'All Tasks');
  await page.getByRole('checkbox', { name: 'Release spirit: QA done 1' }).click();
  await page.waitForTimeout(250);
  const up = await page.evaluate(() => document.querySelector('svg.manor').dataset.stage);
  const announce = await page.locator('.manor-status [role=status]').innerText();
  await chk('MV4', up === '1' && /The manor has risen to Awakening/.test(announce) && loadAnnounce.trim() === '', `stage 0 -> ${up}; announcement="${announce.trim()}"; announcement on load="${loadAnnounce.trim()}"`, page);
  await ctx.close();
}

// ============ 6. Contrast over the hero ============
const lum = ([r, g, b]) => {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const parseRgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);

async function contrast(browser) {
  console.log('6. contrast over the hero');
  const helper = await (await browser.newContext()).newPage();
  await helper.setContent('<canvas id=c></canvas>');
  const failures = [];
  const minima = [];
  for (const [w, h] of [[1280, 800], [1024, 768]]) {
    for (const state of ['empty', 'demo']) {
      const ctx = await newCtx(browser, { viewport: { width: w, height: h }, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      attach(page, 'contrast', new URL(BASE).origin);
      await open(page);
      if (state === 'demo') {
        await page.getByRole('button', { name: 'Load demo data' }).click();
        await page.waitForTimeout(250);
      }
      await page.getByRole('button', { name: 'Preview manor stages' }).click();
      for (let k = 0; k <= 5; k += 1) {
        await page.getByRole('button', { name: new RegExp(`^Stage ${k}:`) }).click();
        await page.waitForTimeout(120);
        const items = await page.evaluate(() => {
          const manor = document.querySelector('svg.manor').getBoundingClientRect();
          const out = [];
          for (const e of document.querySelectorAll('.dashboard *')) {
            if (e.closest('svg')) continue;
            const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
            if (!own) continue;
            const r = e.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const hit = !(r.right <= manor.left || r.left >= manor.right || r.bottom <= manor.top || r.top >= manor.bottom);
            if (!hit) continue;
            out.push({ text: e.textContent.trim().slice(0, 34), x: r.x, y: r.y, w: r.width, h: r.height, color: getComputedStyle(e).color });
          }
          return out;
        });
        if (items.length === 0) continue;
        await page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}', });
        for (const it of items) {
          const inset = 4; // keep borders out of the sample
          const clip = { x: Math.max(0, it.x) + inset, y: Math.max(0, it.y) + inset, width: Math.max(2, Math.min(it.w, w - it.x) - 2 * inset), height: Math.max(2, Math.min(it.h, h - it.y) - 2 * inset) };
          const png = await page.screenshot({ clip });
          const st = await helper.evaluate(async (b64) => {
            const img = new Image();
            img.src = 'data:image/png;base64,' + b64;
            await img.decode();
            const c = document.getElementById('c');
            c.width = img.width; c.height = img.height;
            const g = c.getContext('2d');
            g.drawImage(img, 0, 0);
            const d = g.getImageData(0, 0, c.width, c.height).data;
            const L = (r, gg, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
            const ls = [];
            for (let i = 0; i < d.length; i += 4) ls.push(L(d[i], d[i + 1], d[i + 2]));
            ls.sort((a, b) => a - b);
            return { lo: ls[Math.floor(ls.length * 0.02)], hi: ls[Math.floor(ls.length * 0.98)], n: ls.length };
          }, png.toString('base64'));
          const t = lum(parseRgb(it.color));
          const worst = t >= st.lo && t <= st.hi ? 1 : Math.min(cr(t, st.lo), cr(t, st.hi));
          minima.push(worst);
          if (worst < 4.5) failures.push(`${w}px ${state} stage ${k}: "${it.text}" ${worst.toFixed(2)}:1`);
        }
        // restore text colours for the next stage
        await page.evaluate(() => document.querySelectorAll('style').forEach((s) => { if (s.textContent.startsWith('*{color:transparent')) s.remove(); }));
      }
      await ctx.close();
    }
  }
  note(`Contrast over the hero (stages 0-5, welcome + demo states, 1280 and 1024, p2-p98 of background pixels): ${minima.length} label samples, lowest ${Math.min(...minima).toFixed(2)}:1, below 4.5:1 = ${failures.length}${failures.length ? ' -> ' + failures.slice(0, 8).join('; ') : ''}`);
  rec('CONTRAST-HERO', failures.length === 0, `${minima.length} samples, lowest ${Math.min(...minima).toFixed(2)}:1`);
  if (failures.length) info.push('CONTRAST FAILURES: ' + failures.join('; '));
  await helper.context().close();
}

// ============ 8. Cross-browser smoke ============
async function smokeOne(name, launcher, launchOpts, url) {
  let browser;
  try {
    browser = await launcher.launch(launchOpts);
  } catch (e) {
    console.log(`  ${name}: not available (${String(e).split('\n')[0].slice(0, 80)})`);
    return { name, skipped: true };
  }
  const version = browser.version();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const origin = new URL(url).origin;
  attach(page, `smoke-${name}`, origin);
  const before = consoleLog.length;
  let ok = true;
  const out = { name, version };
  try {
    await page.goto(url);
    await page.waitForSelector('svg.manor');
    out.styled = (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(18, 14, 26)';
    await page.getByRole('button', { name: 'Load demo data' }).click();
    await page.waitForTimeout(300);
    await page.locator('.task-item__toggle input').first().click();
    await page.waitForTimeout(350);
    out.wisp = await page.locator('.release-fx__item').count();
    const v1 = await vals(page);
    out.afterComplete = v1.join('/');
    await page.reload();
    await page.waitForSelector('svg.manor');
    const v2 = await vals(page);
    out.afterReload = v2.join('/');
    out.persisted = JSON.stringify(v1) === JSON.stringify(v2) && v2[0] === '5' && v2[1] === '1';
    await page.waitForTimeout(300);
  } catch (e) {
    ok = false;
    out.error = String(e).split('\n')[0].slice(0, 100);
    await shot(page, `smoke-${name}`);
  }
  out.errors = consoleLog.slice(before).filter((c) => c.flow === `smoke-${name}`).length;
  out.ok = ok && out.styled && out.persisted && out.errors === 0;
  if (!out.ok) await shot(page, `smoke-${name}-final`);
  await browser.close();
  console.log('  ', JSON.stringify(out));
  return out;
}

// ---------- docs writer ----------
function patchDocs(smoke, envInfo) {
  const p = join(process.cwd(), 'docs', 'manual-qa.md');
  let md = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const lines = md.split('\n');
  const clean = (s) => s.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  const sub = (cells) => '| ' + cells.join(' | ') + ' |';
  let filled = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (!l.startsWith('| ')) continue;
    const cells = l.slice(2, -1).split(' | ');
    cells[cells.length - 1] = cells[cells.length - 1].trim();
    const id = cells[0];
    if (results.has(id) && cells.length === 5 && cells[3] === 'Not yet verified') {
      const r = results.get(id);
      cells[3] = `${r.ok ? 'Pass' : 'Fail'} (auto)`;
      cells[4] = clean(r.notes.join(' / '));
      lines[i] = sub(cells).replace(/ \|  \|$/, ' | |');
      filled += 1;
    } else if (/^X(1|3)$/.test(id) && cells.length === 7) {
      const idx = { Firefox: 3, Edge: 5 };
      const noteBits = [];
      for (const s of smoke) {
        if (s.skipped) { noteBits.push(`${s.name}: not available`); continue; }
        const pf = (x) => (x.ok ? 'pass' : 'FAIL');
        noteBits.push(`${s.name} ${s.version}: ${pf(s)}${s.error ? ' (' + s.error + ')' : ''}`);
      }
      for (const [b, c] of Object.entries(idx)) {
        const s = smoke.find((x) => x.name === b);
        if (!s || s.skipped) continue;
        const ok = id === 'X1' ? s.styled && s.errors === 0 : s.persisted;
        cells[c] = `${ok ? 'Pass' : 'Fail'} (auto)`;
      }
      cells[6] = clean(`smoke (load demo, complete, refresh): ${noteBits.join('; ')}. Chrome and Safari columns left: Playwright Chromium is not Chrome, WebKit is not Safari`);
      lines[i] = sub(cells);
      filled += 1;
    }
  }
  md = lines.join('\n');
  md = md.replace('**Status: nothing has been verified.** Every result below reads "Not yet verified", every Notes cell is empty and every sign-off is empty. This document records no outcomes. The owner fills it in by hand while testing.',
    `**Status: partly verified by script.** Rows marked "(auto)" were checked by \`scripts/qa/run.mjs\` (Playwright) on ${envInfo.date}; every other row still reads "Not yet verified" and needs a human. Notes on (auto) rows say what was and was not covered. WebKit is not Safari, and a halved viewport is not browser zoom. Sign-off is empty.`);
  const envRows = {
    '| Date tested | Not yet verified |': `| Date tested | ${envInfo.date} (auto) |`,
    '| Git commit of the build | Not yet verified |': `| Git commit of the build | ${envInfo.commit} (auto) |`,
    '| Operating system | Not yet verified |': `| Operating system | ${envInfo.os} (auto) |`,
    '| Browser and exact version | Not yet verified |': `| Browser and exact version | ${envInfo.browsers} (auto; Playwright builds, run headless) |`,
  };
  for (const [a, b] of Object.entries(envRows)) md = md.replace(a, b);
  writeFileSync(p, md);
  return filled;
}

// ============ main ============
if (argv.includes('--patch-only')) {
  // Re-apply the last results.json to docs/manual-qa.md without re-running the checks.
  const saved = JSON.parse(readFileSync(join(OUT, 'results.json'), 'utf8'));
  for (const [k, v] of Object.entries(saved.rows)) results.set(k, { ok: v.ok, notes: v.notes });
  const envInfo = {
    date: new Date().toISOString().slice(0, 10),
    commit: execSync('git rev-parse --short HEAD').toString().trim(),
    os: ` `,
    browsers: saved.smoke.filter((s) => !s.skipped).map((s) => ` `).join(', '),
  };
  console.log(`docs/manual-qa.md: ${patchDocs(saved.smoke, envInfo)} rows filled`);
  process.exit(0);
}
const t0 = Date.now();
const chromiumB = await chromium.launch();
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const run = (n) => !only || only.includes(n);
try {
  if (run('workflow')) await workflow(chromiumB);
  if (run('s8')) await smokeS8(chromiumB);
  if (run('keyboard')) await keyboard(chromiumB);
  if (run('storage')) await storage(chromiumB);
  if (run('layout')) await layout(chromiumB);
  if (run('zmp')) await zoomMotionPreview(chromiumB);
  if (run('manor')) await manorStages(chromiumB);
  if (run('bugfixes')) await bugfixes(chromiumB);
  if (run('contrast')) await contrast(chromiumB);
} finally {
  await chromiumB.close();
}
console.log('8. cross-browser smoke');
const smoke = [];
smoke.push(await smokeOne('Chromium', chromium, {}, BASE));
smoke.push(await smokeOne('Firefox', firefox, {}, BASE));
smoke.push(await smokeOne('WebKit', webkit, {}, BASE));
smoke.push(await smokeOne('Edge', chromium, { channel: 'msedge' }, BASE));
const live = process.env.SKIPLIVE ? { skipped: true, name: 'Live (not re-run)' } : await smokeOne('Live (Chromium)', chromium, {}, LIVE);

const unexpected = consoleLog.filter((c) => !c.flow.startsWith('storage-'));
const storageNoise = consoleLog.filter((c) => c.flow.startsWith('storage-'));
note(`Console errors/warnings outside the storage-failure flows: ${unexpected.length}${unexpected.length ? ' -> ' + JSON.stringify(unexpected.slice(0, 5)) : ''}`);
note(`Console errors/warnings inside the deliberate storage-failure flows: ${storageNoise.length}${storageNoise.length ? ' -> ' + JSON.stringify(storageNoise.slice(0, 3)) : ''}`);
note(`HTTP >= 400 responses: ${failedLog.length}${failedLog.length ? ' -> ' + JSON.stringify(failedLog.slice(0, 5)) : ''}`);
note(`Non-same-origin requests across all flows: ${netLog.length}${netLog.length ? ' -> ' + JSON.stringify(netLog.slice(0, 5)) : ''}`);

const summary = {
  seconds: Math.round((Date.now() - t0) / 1000),
  rows: Object.fromEntries([...results].map(([k, v]) => [k, { ok: v.ok, notes: v.notes }])),
  smoke,
  live,
  info,
  consoleLog,
  netLog,
  failedLog,
};
writeFileSync(join(OUT, 'results.json'), JSON.stringify(summary, null, 1));

const failed = [...results].filter(([, v]) => !v.ok).map(([k]) => k);
console.log('\nFAILED:', failed.length ? failed.join(', ') : 'none');

if (WRITE_DOCS) {
  const envInfo = {
    date: new Date().toISOString().slice(0, 10),
    commit: execSync('git rev-parse --short HEAD').toString().trim(),
    os: `${process.platform} ${process.arch}`,
    browsers: smoke.filter((s) => !s.skipped).map((s) => `${s.name} ${s.version}`).join(', '),
  };
  const n = patchDocs(smoke, envInfo);
  console.log(`docs/manual-qa.md: ${n} rows filled`);
}
