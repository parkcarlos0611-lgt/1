// Prop batch A sheet + catalogue JSON: node tools/pixel/samplesProps.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CATALOG } from './gen/propsA.mjs';
const P = eraPalette(); P.auto('paint.prop', '#5c2a30'); P.auto('wood', '#9a6a3a', { sat: 0.9 });
const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440'), sub = hex('#6a6070');
const cats = ['headlamp', 'auxlamp', 'taillamp', 'grille', 'mascot', 'bumper', 'wheel'];
const titles = { headlamp: 'HEADLAMPS 14', auxlamp: 'AUX LAMPS 8', taillamp: 'TAIL LAMPS 12', grille: 'GRILLES 16', mascot: 'MASCOTS 10 (GENERIC)', bumper: 'BUMPERS 10', wheel: 'WHEELS 14 (TYRE CODE SIZED)' };
const zoom = { headlamp: 2, auxlamp: 2, taillamp: 2, grille: 1, mascot: 2, bumper: 1, wheel: 1 };
const SW = 1500; const blocks = []; let H = 16;
for (const c of cats) { const items = CATALOG.filter(i => i.cat === c).map(i => [i, i.make(P)]); const z = zoom[c]; let x = 16, y = H + 30, rh = 0; const pl = [];
  for (const [i, px] of items) { const w = Math.max(px.w * z, i.name.length * 4 + 4); if (x + w > SW - 16) { x = 16; y += rh + 26; rh = 0; } pl.push([i, px, x, y]); x += w + 20; rh = Math.max(rh, px.h * z); }
  blocks.push([c, H, pl, z]); H = y + rh + 40; }
const sh = new Sheet(SW, H, hex('#d9d3c7'));
for (const [c, ty, pl, z] of blocks) { text(sh, titles[c], 16, ty, ink, 3); for (const [i, px, x, y] of pl) { text(sh, i.name, x, y - 10, sub, 1); drawPix(sh, px, P, x, y, z); } }
writePNG(out + 'e1_props_batchA.png', sh.w, sh.h, sh.d);
mkdirSync(new URL('../../data/', import.meta.url).pathname, { recursive: true });
writeFileSync(new URL('../../data/props_e1_batchA.json', import.meta.url).pathname, JSON.stringify(CATALOG.map(({ make, ...m }) => m), null, 1));
console.log('items', CATALOG.length, 'sheet', sh.w, sh.h);
