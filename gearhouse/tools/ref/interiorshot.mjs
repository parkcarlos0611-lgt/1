// The interior's pictures (docs/systems/109 section 4): the style check page (ui/stylecheck.ts) opened on an interior
// of render/car/stylecars.ts in a headless browser, each view a still.
//   node tools/ref/buildsite.mjs ui/stylecheck.ts ui/stylecheck.page.html <dir> index.html
//   node tools/ref/interiorshot.mjs <dir> <out.png> car=interior yaw=250 pitch=20 zoom=2.4 tz=0.7 [w=1280] [h=800] [rpm=5200 kmh=140 boost=0.8]
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, out, ...rest] = process.argv.slice(2), q = Object.fromEntries(rest.map(a => a.split('='))), w = +(q.w ?? 1280), h = +(q.h ?? 800); delete q.w; delete q.h;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), page = await browser.newPage({ viewport: { width: w + 330, height: h + 120 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('page error', String(e))); page.on('console', m => { if (m.type() === 'error') console.error(m.text()); });
await page.route(/^https?:/, r => r.abort());   // the page's web fonts are not needed for a picture
await page.goto('file://' + resolve(dir, 'index.html') + '?still=1&' + new URLSearchParams(q), { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => globalThis.__style?.frames > 0, null, { timeout: 60000 }); await page.waitForTimeout(1500);
await page.evaluate(() => globalThis.__style.redraw()); await page.waitForTimeout(700);
await page.locator('#cv').screenshot({ path: out }); console.log(out, await page.locator('#stat').textContent()); await browser.close();
