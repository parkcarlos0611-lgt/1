// node tools/pixel/samplesE2mil.mjs  -> samples/e2_military.png (v2: re-measured 4x4, 6x6 cab/equipment variants, material shading)
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildMil } from './gen/military.mjs';
import * as M from './gen/e2military.mjs';
const P = eraPalette(); const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440');
const rows = [
  [['1941 1/4-TON 4X4 - SIDE', M.jeepSide], ['CANVAS TOP UP', M.jeepTop], ['FRONT', M.jeepFront]],
  [['2-1/2-TON 6X6 - CLOSED CAB / CARGO', M.cckwCargo], ['FRONT', M.cckwFront]],
  [['6X6 - OPEN CAB / CANVAS COVER', M.cckwCanvas]],
  [['6X6 - CLOSED CAB / ROCKET RAIL LAUNCHER', M.cckw({ cab: 'closed', module: 'launcher' })]],
  [['6X6 - OPEN CAB / TANKER', M.cckw({ cab: 'open', module: 'tanker' })]]].map(r => r.map(([n, s]) => [n, buildMil(P, s)]));
const z = 2, W = 40 + Math.max(...rows.map(r => r.reduce((a, [, c]) => a + c.w * z + 30, 0))), H = rows.reduce((a, r) => a + Math.max(...r.map(([, c]) => c.h)) * z + 40, 20);
const sh = new Sheet(W, H, hex('#d9d3c7')); let y = 14;
for (const r of rows) { const rh = Math.max(...r.map(([, c]) => c.h)) * z; let x = 16; for (const [n, c] of r) { text(sh, n, x, y, ink); drawPix(sh, c, P, x, y + 16 + rh - c.h * z, z); x += c.w * z + 30; } y += rh + 40; }
writePNG(out + 'e2_military.png', sh.w, sh.h, sh.d);
console.log('ok', rows.flat().map(([n, c]) => c.anchorLog.brackets.length + '/' + c.anchorLog.unresolved.length).join(' '));
