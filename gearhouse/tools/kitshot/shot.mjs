// The design system's style sheet as pictures (docs/systems/110 G2): bundles ui/uikit.ts into ui/uikit.page.html and
// shoots it at a phone's width and a computer's, the whole page. node tools/kitshot/shot.mjs [prefix=ui_g2] [outdir] [kit]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const prefix = process.argv[2] ?? 'ui_g2', out = resolve(process.argv[3] ?? resolve(root, 'docs/reference')), kit = process.argv[4] ?? '';
const { chromium } = createRequire(import.meta.url)('playwright');
const js = (await build({ entryPoints: [resolve(root, 'ui/uikit.ts')], bundle: true, write: false, format: 'iife', target: 'es2022' })).outputFiles[0].text;
const page = readFileSync(resolve(root, 'ui/uikit.page.html'), 'utf8').replace('<script>/*BUNDLE*/</script>', () => `<script>${js}</script>`);
const tmp = resolve(here, '.kit.html'); writeFileSync(tmp, '<meta charset="utf-8">\n' + page); mkdirSync(out, { recursive: true });
const SHOTS = (process.env.SHOTS ?? 'phone,pc').split(',').map(n => n === 'phone' ? ['phone', 390, 844, true] : ['pc', 1280, 800, false]);
const browser = await chromium.launch();
for (const [name, w, h, touch] of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + tmp + (kit ? `?kit=${kit}` : '')); await p.waitForSelector('body[data-ready="1"]'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  const file = resolve(out, `${prefix}_${name}${kit ? `_${kit}` : ''}.png`); await p.screenshot({ path: file, fullPage: true }); if (errs.length) console.log(name, errs); console.log('shot', file); await ctx.close(); }
await browser.close(); rmSync(tmp, { force: true });
