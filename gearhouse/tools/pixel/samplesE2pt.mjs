// node tools/pixel/samplesE2pt.mjs -> samples/e2_powertrain.png : 1940s engines / transmissions (S2 5 mm/px)
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { flatheadV8, ohvI6, fluidAuto, gearbox, ptPalette } from './gen/engine40.mjs';
import { engineSV } from './gen/engineSV.mjs';
const P = ptPalette(eraPalette()), out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440');
const items = [
  ['L-HEAD V8 239CI (PASSENGER)', flatheadV8(P, { bore: 81, stroke: 95 })], ['L-HEAD V8 337CI (TRUCK / LUXURY)', flatheadV8(P, { bore: 89, stroke: 111, color: 'paint.enginered', head: 'paint.enginered' })],
  ['OHV I6 270CI + 5-SPD (6X6 TRUCK)', ohvI6(P, { bore: 95, stroke: 103, box: 'gear4' })], ['OHV I6 216CI (PASSENGER)', ohvI6(P, { bore: 89, stroke: 95, color: 'paint.engineOrange', box: 'none' })],
  ['L-HEAD I4 134CI (4X4)', engineSV(P, { cyl: 4, bore: 79.4, stroke: 111, color: 'paint.enginegreen' })], ['FLUID-COUPLING 4-SPD AUTOMATIC - CUTAWAY', fluidAuto(P)],
  ['3-SPD MANUAL', gearbox(P, { speeds: 3 })], ['3-SPD + 2-SPD TRANSFER (4X4)', gearbox(P, { speeds: 3, transfer: true, color: 'paint.enginegreen' })]];
const z = 2, colW = Math.max(...items.map(([, p]) => p.w)) * z + 40, rowH = Math.max(...items.map(([, p]) => p.h)) * z + 40;
const sh = new Sheet(colW * 2 + 20, rowH * 4 + 20, hex('#d9d3c7'));
items.forEach(([n, p], i) => { const x = 16 + (i % 2) * colW, y = 12 + Math.floor(i / 2) * rowH; text(sh, n, x, y, ink); drawPix(sh, p, P, x, y + 14 + rowH - 40 - p.h * z, z); });
writePNG(out + 'e2_powertrain.png', sh.w, sh.h, sh.d); console.log('ok', sh.w, sh.h);
