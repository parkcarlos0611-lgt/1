// UI check (roadmap step 3): opens a built pixel page in four window shapes, walks through its screens by clicking
// widgets by id, and reads the widget registry the pixel kit leaves in window.__ui every frame. It reports text that
// runs over its box, touch widgets that overlap, widgets off the 480 x 270 screen (errors) and touch targets smaller
// than 44 CSS px at that window size (warnings: the plan's phone rule).
// node tools/uicheck.mjs <page.html> <game|board> [out.json]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');   // the machine's Playwright (require finds it where import does not)

const [page, kind = 'game', out] = process.argv.slice(2);
const SIZES = [['desktop 1920x1080', 1920, 1080], ['laptop 1366x768', 1366, 768], ['tablet 1024x768', 1024, 768], ['phone 844x390', 844, 390]];
const FLOWS = {
  game: [['title', []], ['desk', ['new']], ['desk-designs', ['t-designs']], ['desk-orders', ['t-orders']], ['inquiry', ['t-todo', 'todo:0']],
    ['drawing', ['draw']], ['drawing-estimate', ['tab-est', 'page1']], ['drawing-exterior', ['tab-ext', 'page2']], ['desk-after', ['done']]],
  board: [['order', []], ['estimate', ['tab-est']], ['front', ['page1']], ['fenders', ['page2']], ['exterior', ['tab-ext']], ['blueprint', ['tab-order', 'sheet', 'sheet']], ['screen', ['sheet']]],
};
const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

const browser = await chromium.launch(); const report = []; let errors = 0;
for (const [name, vw, vh] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh } }), p = await ctx.newPage(), pageErr = [];
  p.on('pageerror', e => pageErr.push(String(e)));
  await p.goto('file://' + resolve(page)); await p.evaluate(() => { try { localStorage.clear(); } catch { /* */ } }); await p.reload(); await p.waitForTimeout(400);
  const box = async () => p.locator('#board').boundingBox();
  for (const [screen, clicks] of FLOWS[kind]) {
    for (const id of clicks) { const r = await p.evaluate(i => (globalThis.__ui ?? []).find(q => q.id === i), id);
      if (!r) { report.push({ size: name, screen, error: `no widget '${id}' to click` }); errors++; continue; }
      const b = await box(); await p.mouse.click(b.x + (r.x + r.w / 2) / 480 * b.width, b.y + (r.y + r.h / 2) / 270 * b.height); await p.waitForTimeout(350); }
    await p.waitForTimeout(250);
    const recs = await p.evaluate(() => globalThis.__ui ?? []), b = await box(), k = b.width / 480;
    const taps = recs.filter(r => r.tap), over = recs.filter(r => r.over).map(r => `${r.kind} ${r.id || ''} "${(r.text ?? '').slice(0, 24)}" ${r.textW}>${r.w}`);
    const overlaps = []; for (let i = 0; i < taps.length; i++) for (let j = i + 1; j < taps.length; j++) if (inter(taps[i], taps[j]) > 0) overlaps.push(`${taps[i].id} × ${taps[j].id}`);
    const off = recs.filter(r => r.x < 0 || r.y < 0 || r.x + r.w > 480 || r.y + r.h > 270).map(r => `${r.kind} ${r.id}`);
    const small = taps.filter(r => Math.min(r.w, r.h) * k < 44).map(r => r.id), min = taps.length ? Math.min(...taps.map(r => Math.min(r.w, r.h))) * k : 0;
    errors += over.length + overlaps.length + off.length + pageErr.length;
    report.push({ size: name, screen, scale: +k.toFixed(2), widgets: recs.length, taps: taps.length, overflow: over, overlaps, offscreen: off, pageErrors: pageErr.splice(0), smallTaps: small.length, smallestTapPx: +min.toFixed(1) });
  }
  await ctx.close();
}
await browser.close();
if (out) writeFileSync(out, JSON.stringify(report, null, 1));
for (const r of report) console.log(`${r.size.padEnd(18)} ${String(r.screen).padEnd(17)} ${r.error ?? `scale ${r.scale}  widgets ${r.widgets}  overflow ${r.overflow.length}  overlaps ${r.overlaps.length}  off ${r.offscreen.length}  small taps ${r.smallTaps}/${r.taps} (smallest ${r.smallestTapPx}px)${r.pageErrors.length ? '  ERR ' + r.pageErrors[0] : ''}`}`);
for (const r of report) for (const k of ['overflow', 'overlaps', 'offscreen']) for (const x of r[k] ?? []) console.log(`  ${r.size} / ${r.screen} ${k}: ${x}`);
console.log(errors ? `UI check: ${errors} error(s)` : 'UI check: no errors (small touch targets are warnings)');
process.exit(errors ? 1 : 0);
