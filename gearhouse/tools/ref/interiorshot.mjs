// The interior's pictures (docs/systems/109 section 4): the style check page (ui/stylecheck.ts) opened on the interiors
// of render/car/stylecars.ts in a headless browser, each view a still; several views in one run.
//   node tools/ref/buildsite.mjs ui/stylecheck.ts ui/stylecheck.page.html <dir> index.html
//   node tools/ref/interiorshot.mjs <dir> [w=1280] [h=800] [rpm=5200 kmh=140 boost=0.8] <out.png>:car=interior,yaw=250,pitch=20,zoom=2.4,tz=0.7 ...
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, ...rest] = process.argv.slice(2), views = rest.filter(a => a.includes(':')), q = Object.fromEntries(rest.filter(a => !a.includes(':')).map(a => a.split('='))), w = +(q.w ?? 1280), h = +(q.h ?? 800); delete q.w; delete q.h;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), page = await browser.newPage({ viewport: { width: w + 330, height: h + 120 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('page error', String(e)));
await page.route(/^https?:/, r => r.abort());   // the page's web fonts are not needed for a picture
await page.goto('file://' + resolve(dir, 'index.html') + '?still=1&' + new URLSearchParams(q), { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => globalThis.__style?.frames > 0, null, { timeout: 120000 });
for (const v of views) { const [out, spec] = v.split(':'), o = Object.fromEntries(spec.split(',').map(a => a.split('=')));
  const n = await page.evaluate(o => { const S = globalThis.__style; if (o.car) S.useCar(o.car); for (const k of ['yaw', 'pitch', 'zoom', 'tz']) if (o[k] !== undefined) S.st[k] = +o[k]; S.redraw(); return S.frames; }, o);
  await page.waitForFunction(n => globalThis.__style.frames > n, n, { timeout: 120000 }); await page.waitForTimeout(300);
  const box = await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await page.screenshot({ path: out, clip: box }); console.log(out, await page.evaluate(() => document.getElementById('stat').textContent)); }
await browser.close();
