// node tools/pixel/samplesB2.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { writeFileSync } from 'node:fs';
import { CATALOG_B2 } from './gen/propsB2.mjs';
const P = eraPalette(); P.auto('paint.prop', '#4b6283'); P.auto('canvas', '#3c3833', { sat: 0.5 });
const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440'), sub = hex('#6a6070');
const order = ['windshield', 'visor', 'roof', 'hoodVent', 'cowlVent', 'trim', 'handle', 'mirror', 'horn', 'wiper', 'plate', 'step', 'emblem', 'sidePipe', 'panel', 'hubcap', 'tyre', 'guard'];
const SW = 1600; let H = 16; const blocks = [];
for (const cat of order) { const items = CATALOG_B2.filter(i => i.cat === cat).map(i => [i, i.make(P)]); let x = 16, y = H + 30, rh = 0; const pl = [];
  for (const [i, px] of items) { const w = Math.max(px.w, i.name.length * 4); if (x + w > SW - 16) { x = 16; y += rh + 22; rh = 0; } pl.push([i, px, x, y]); x += w + 18; rh = Math.max(rh, px.h); }
  blocks.push([cat.toUpperCase() + ' ' + items.length, H, pl]); H = y + rh + 30; }
const sh = new Sheet(SW, H, hex('#d9d3c7'));
for (const [title, ty, pl] of blocks) { text(sh, title, 16, ty, ink, 2); for (const [i, px, x, y] of pl) { text(sh, i.name, x, y - 10, sub, 1); drawPix(sh, px, P, x, y, 1); } }
writePNG(out + 'e1_props_batchB2.png', sh.w, sh.h, sh.d);
writeFileSync(new URL('../../data/props_e1_batchB2.json', import.meta.url).pathname, JSON.stringify(CATALOG_B2.map(({ make, ...m }) => ({ ...m, years: [1928, 1939] })), null, 1));
console.log('items', CATALOG_B2.length, sh.w, sh.h);
