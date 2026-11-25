// The HUD's pictures (docs/systems/110 G3): bundles tools/hudshot/entry.ts into the drive page's markup and shoots it
// in three window shapes (a phone upright, on its side, a computer). node tools/hudshot/shot.mjs [outdir]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..'), out = resolve(process.argv[2] ?? resolve(root, 'docs/reference'));
const { chromium } = createRequire(import.meta.url)('playwright');
const js = (await build({ entryPoints: [resolve(here, 'entry.ts')], bundle: true, write: false, format: 'iife', target: 'es2022', loader: { '.html': 'text' } })).outputFiles[0].text;
const page = readFileSync(resolve(root, 'ui/drive.page.html'), 'utf8').replace('<script>/*BUNDLE*/</script>', () => `<script>${js}</script>`);
const tmp = resolve(here, '.hud.html'); writeFileSync(tmp, page); mkdirSync(out, { recursive: true });
const SHOTS = [['phone_portrait', 390, 844, true, 'touch=1'], ['phone_landscape', 844, 390, true, 'touch=1'], ['pc', 1366, 768, false, ''],
  ['phone_landscape_left_f1', 844, 390, true, 'touch=1&left=1&f1=1&stock=1&na=1&off=1&pull=1'], ['phone_portrait_buttons', 390, 844, true, 'touch=1&shifter=buttons&off=1']];
const only = process.env.SHOTS?.split(','); const browser = await chromium.launch();
for (const [name, w, h, touch, query] of SHOTS) { if (only && !only.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + tmp + (query ? `?${query}` : '')); await p.waitForSelector('body[data-ready="1"]'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: resolve(out, `hud_g3_${name}.png`) }); if (errs.length) console.log(name, errs); console.log('shot', name); await ctx.close(); }
await browser.close();
