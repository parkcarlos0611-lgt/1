// node tools/pixel/samplesB1.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { writeFileSync } from 'node:fs';
import { CATALOG_B1 } from './gen/propsB1.mjs';
const P = eraPalette(); P.auto('paint.prop', '#4b6283'); P.add('ghost', ['#c9c3b6', '#bdb7aa', '#b1ab9f', '#a59f93', '#99938a'], '#a59f93');
const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440'), sub = hex('#6a6070');
const cats = [['fenderF', 'FRONT FENDERS 10 (FITTED TO 5.25-18 WHEEL)', 1], ['fenderR', 'REAR FENDERS 8', 1], ['board', 'RUNNING BOARDS 5 (PLAN VIEW)', 1], ['spare', 'SPARE MOUNTS 7', 1], ['trunk', 'TRUNKS 6 (BODY REAR = GREY)', 1], ['mascot', 'MASCOTS 10 - REWORK', 2]];
const SW = 1500; let H = 16; const blocks = [];
for (const [c, title, z] of cats) { const items = CATALOG_B1.filter(i => i.cat === c).map(i => [i, i.make(P)]); let x = 16, y = H + 34, rh = 0; const pl = [];
  for (const [i, px] of items) { const w = Math.max(px.w * z, i.name.length * 4); if (x + w > SW - 16) { x = 16; y += rh + 24; rh = 0; } pl.push([i, px, x, y]); x += w + 22; rh = Math.max(rh, px.h * z); }
  blocks.push([title, H, pl, z]); H = y + rh + 36; }
const sh = new Sheet(SW, H, hex('#d9d3c7'));
for (const [title, ty, pl, z] of blocks) { text(sh, title, 16, ty, ink, 3); for (const [i, px, x, y] of pl) { text(sh, i.name, x, y - 10, sub, 1); drawPix(sh, px, P, x, y, z); } }
writePNG(out + 'e1_props_batchB1.png', sh.w, sh.h, sh.d);
writeFileSync(new URL('../../data/props_e1_batchB1.json', import.meta.url).pathname, JSON.stringify(CATALOG_B1.map(({ make, ...m }) => ({ ...m, years: [1928, 1939] })), null, 1));
console.log('items', CATALOG_B1.length, sh.w, sh.h);
