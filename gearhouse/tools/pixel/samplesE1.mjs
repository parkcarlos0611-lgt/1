// E1 phase-1 sheets: node tools/pixel/samplesE1.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildCar, buildCarRight } from './gen/car.mjs';
import { buildFront } from './gen/front.mjs';
import { buildXray } from './gen/xray.mjs';
import { E1, townSedan } from './gen/vehicles30.mjs';
import { tire } from './gen/tire.mjs';
const P = eraPalette();
P.auto('paint.niagara', '#4b6283'); P.auto('paint.copra', '#7d3a2c'); P.auto('paint.cream', '#d8c9a0', { sat: 0.9 }); P.auto('paint.ivory', '#e2dccb', { sat: 0.6 });
P.auto('canvas', '#3c3833', { sat: 0.5 }); P.auto('paint.engineblue', '#2f5fa8'); P.auto('paint.crinkle', '#2b2b30', { sat: 0 });
P.add('ghost', ['#1d3557', '#2f5486', '#5c86bd', '#9cc3ea', '#dceeff'], '#9cc3ea');
const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440'), z = 4;
const rows = E1.map(d => [d, buildCar(P, d.body), buildXray(P, d)]);
const W = Math.max(...rows.map(([, c]) => c.w)) * z + 32;
const sh = new Sheet(W, rows.reduce((a, [, c, x]) => a + (c.h + x.h) * z + 110, 20), hex('#d9d3c7'));
let y = 14;
for (const [d, c, x] of rows) {
  text(sh, d.name + '  WB ' + d.platform.wheelbase + ' TIRE ' + d.platform.tire + ' OD ' + Math.round(tire(d.platform.tire).od) + 'MM', 16, y, ink);
  text(sh, d.spec, 16, y + 14, hex('#6a6070'));
  drawPix(sh, c, P, 16, y + 32, z); y += c.h * z + 40;
  sh.fill(8, y - 4, x.w * z + 16, x.h * z + 8, hex('#16263f'));
  drawPix(sh, x, P, 16, y, z); y += x.h * z + 38;
}
writePNG(out + 'e1_vehicles_xray_x4.png', sh.w, sh.h, sh.d);
// town sedan 4 views
{
  const L = buildCar(P, townSedan.body), R = buildCarRight(P, townSedan.body), F = buildFront(P, townSedan.front), B = buildFront(P, townSedan.rear);
  const sw = 32 + Math.max(L.w, F.w + B.w + 8) * z, s2 = new Sheet(sw, 16 + (L.h * 2 + F.h) * z + 130, hex('#d9d3c7'));
  let yy = 16; text(s2, '1930 TOWN SEDAN - LEFT', 16, yy, ink); drawPix(s2, L, P, 16, yy + 16, z); yy += L.h * z + 38;
  text(s2, 'RIGHT', 16, yy, ink); drawPix(s2, R, P, 16, yy + 16, z); yy += L.h * z + 38;
  text(s2, 'FRONT', 16, yy, ink); drawPix(s2, F, P, 16, yy + 16, z); text(s2, 'REAR', 16 + F.w * z + 32, yy, ink); drawPix(s2, B, P, 16 + F.w * z + 32, yy + 16, z);
  writePNG(out + 'e1_town_sedan_views_x4.png', s2.w, s2.h, s2.d);
}
console.log('ok');
