// Build sample sheets: node tools/pixel/samples.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildCar, buildCarRight } from './gen/car.mjs';
import * as S from './gen/specs.mjs';

const P = eraPalette();
P.auto('paint.coral', '#e2725b'); P.auto('paint.maroon', '#7a2230'); P.auto('paint.orange', '#e8862a'); P.auto('paint.teal', '#2a8c8c', { sat: 1.1 });
const out = new URL('../../samples/', import.meta.url).pathname;
const cars = [['1934 SEDAN', S.sedan34], ['1957 HARDTOP', S.sedan57], ['1974 WEDGE COUPE', S.wedge74], ['1996 HATCHBACK', S.hatch96]].map(([n, s]) => [n, buildCar(P, s)]);
const z = 4, sh = new Sheet(980, cars.reduce((a, [, c]) => a + c.h * z + 40, 20), hex('#d9d3c7'));
let y = 16; for (const [n, c] of cars) { text(sh, n + '  ' + c.w + 'x' + c.h + 'PX  S1 25MM/PX  x4', 16, y, hex('#3a3440')); drawPix(sh, c, P, 16, y + 16, z); y += c.h * z + 40; }
writePNG(out + 'cars_side_x4.png', sh.w, sh.h, sh.d);
console.log('ok', sh.w, sh.h);

// ---- 1957 multi-view sheet: left / right / front / rear ----
import { buildFront } from './gen/front.mjs';
{
  const L = buildCar(P, S.sedan57), R = buildCarRight(P, S.sedan57), F = buildFront(P, S.sedan57front), B = buildFront(P, S.sedan57rear);
  const z = 4, sh2 = new Sheet(32 + Math.max(L.w, F.w + B.w + 8) * z, 16 + (L.h * 2 + F.h) * z + 120, hex('#d9d3c7'));
  let y = 16; text(sh2, 'LEFT SIDE', 16, y, hex('#3a3440')); drawPix(sh2, L, P, 16, y + 14, z); y += L.h * z + 34;
  text(sh2, 'RIGHT SIDE (MIRROR + ASYMMETRIC LAYER - FUEL DOOR, MIRROR, EXHAUST)', 16, y, hex('#3a3440')); drawPix(sh2, R, P, 16, y + 14, z); y += L.h * z + 34;
  text(sh2, 'FRONT ' + F.w + 'x' + F.h, 16, y, hex('#3a3440')); drawPix(sh2, F, P, 16, y + 14, z);
  text(sh2, 'REAR ' + B.w + 'x' + B.h, 16 + F.w * z + 32, y, hex('#3a3440')); drawPix(sh2, B, P, 16 + F.w * z + 32, y + 14, z);
  writePNG(out + 'car57_views_x4.png', sh2.w, sh2.h, sh2.d);
}

// ---- props sheet (S2 = 5 mm/px, shown x2) ----
import * as G from './gen/props.mjs';
import { wheel } from './gen/wheel.mjs';
{
  P.auto('paint.enginered', '#b8322a'); P.auto('paint.engineblue', '#2f5fa8'); P.auto('paint.crinkle', '#2b2b30', { sat: 0 });
  const rows = [
    ['ENGINES - SAME CYLINDER MODULE REPEATED (SIDE VIEW)', [
      ['INLINE-4 OHV', G.engineSide(P, { layout: 'inline', cyl: 4, bore: 82, stroke: 86, head: 'ohv', cover: 'paint.engineblue' })],
      ['INLINE-6 DOHC', G.engineSide(P, { layout: 'inline', cyl: 6, bore: 80, stroke: 82, head: 'dohc', cover: 'paint.crinkle' })],
      ['V8 OHV', G.engineSide(P, { layout: 'V', cyl: 8, bore: 98, stroke: 89, head: 'ohv', cover: 'paint.enginered' })]]],
    ['ENGINES - SAME BANK SLICE ROTATED (END VIEW)', [
      ['V8 90 DEG', G.engineEnd(P, { layout: 'V', vAngle: 90, cover: 'paint.enginered' })],
      ['V6 60 DEG', G.engineEnd(P, { layout: 'V', vAngle: 60, bore: 90, cover: 'paint.engineblue' })],
      ['FLAT 180 DEG', G.engineEnd(P, { layout: 'flat', bore: 90, stroke: 70, cover: 'paint.crinkle' })]]],
    ['WHEELS - SPOKES DRAWN PER ANGLE, NOT ROTATED SPRITES', [
      ['WIRE 1934', wheel(P, { r: 78, style: 'wire', spokes: 32, tireFrac: 0.3 })],
      ['HUBCAP+WHITEWALL 1957', wheel(P, { r: 72, style: 'hubcap', whitewall: 0.28, tireFrac: 0.36 })],
      ['STEEL 1965', wheel(P, { r: 66, style: 'steel', paint: 'paint.enginered', tireFrac: 0.3 })],
      ['ALLOY 5 1974', wheel(P, { r: 62, style: 'alloy', spokes: 5, tireFrac: 0.33 })],
      ['ALLOY 7 1996', wheel(P, { r: 60, style: 'alloy', spokes: 7, tireFrac: 0.3 })]]],
    ['LAMPS', [['BULLET 1934', G.lamp(P, 'bullet34')], ['HOODED 1957', G.lamp(P, 'round57')], ['RECT 1974', G.lamp(P, 'rect74')], ['PROJECTOR 1996', G.lamp(P, 'proj96')],
      ['FIN TAIL 1957', G.lamp(P, 'tail57')], ['TAIL BAR 1974', G.lamp(P, 'tail74')]]],
    ['GRILLES - FRAME + PATTERN FILL', [['SHELL 1934', G.grille(P, 'shell34')], ['EGG-CRATE 1957', G.grille(P, 'egg57')], ['BAR 1974', G.grille(P, 'hbar74')]]],
    ['BODY PANEL BY STEEL GRADE (SAME PAINT)', [['GRADE 1', G.panelSwatch(P, 1)], ['GRADE 3', G.panelSwatch(P, 3)], ['GRADE 5', G.panelSwatch(P, 5)]]],
    ['CHASSIS - REPEAT / 3-SLICE', [['LEAF X3', G.leafSpring(P, 3)], ['LEAF X7', G.leafSpring(P, 7)], ['COIL 7 TURNS', G.coilSpring(P, 7)], ['TANK 40L', G.fuelTank(P, 40)], ['TANK 80L', G.fuelTank(P, 80)]]],
  ];
  const z = 2, SW = 1500; const ink = hex('#3a3440'), sub = hex('#6a6070');
  // measure
  let H = 16; const layout = [];
  for (const [title, items] of rows) { let x = 16, rowH = 0, y = H + 44; const pl = [];
    for (const [n, p] of items) { const w = p.w * z; if (x + w > SW - 16) { y += rowH + 40; x = 16; rowH = 0; } pl.push([n, p, x, y]); x += Math.max(w, (n.length + 9) * 8) + 28; rowH = Math.max(rowH, p.h * z); }
    layout.push([title, H, pl]); H = y + rowH + 36; }
  const sh3 = new Sheet(SW, H, hex('#d9d3c7'));
  for (const [title, ty, pl] of layout) { text(sh3, title, 16, ty, ink, 3); for (const [n, p, x, y] of pl) { text(sh3, n + '  ' + p.w + 'x' + p.h, x, y - 16, sub, 2); drawPix(sh3, p, P, x, y, z); } }
  writePNG(out + 'props_s2_x2.png', sh3.w, sh3.h, sh3.d);
  console.log('props', sh3.w, sh3.h);
}
