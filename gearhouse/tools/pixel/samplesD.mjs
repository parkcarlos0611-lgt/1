// Detail-scale comparison: node tools/pixel/samplesD.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildCar } from './gen/car.mjs';
import { coupeD, sedanD } from './gen/detail30.mjs';
import { coupe, townSedan } from './gen/vehicles30.mjs';
import { buildFront } from './gen/front.mjs';
export const P = eraPalette();
P.auto('paint.niagara', '#4b6283'); P.auto('paint.copra', '#7d3a2c'); P.add('ghost', ['#1d3557', '#2f5486', '#5c86bd', '#9cc3ea', '#dceeff'], '#9cc3ea');
const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440');
export const items = [['BEFORE (25MM/PX)', buildCar(P, coupe.body, 25), 4], ['AFTER - DETAIL 12.5MM/PX', buildCar(P, coupeD, 12.5), 2],
  ['BEFORE (25MM/PX)', buildCar(P, townSedan.body, 25), 4], ['AFTER - DETAIL 12.5MM/PX', buildCar(P, sedanD, 12.5), 2]];
const W = Math.max(...items.map(([, c, z]) => c.w * z)) + 32; const sh = new Sheet(W, items.reduce((a, [, c, z]) => a + c.h * z + 40, 20), hex('#d9d3c7'));
let y = 14; for (const [n, c, z] of items) { text(sh, n + '  ' + c.w + 'x' + c.h, 16, y, ink); drawPix(sh, c, P, 16, y + 16, z); y += c.h * z + 40; }
writePNG(out + 'e1_detail_before_after.png', sh.w, sh.h, sh.d); console.log('ok', sh.w, sh.h);

{ const F = buildFront(P, { ...townSedan.front, glassStyle: 'period' }, 12.5), B = buildFront(P, townSedan.rear, 12.5), z = 3;
  const sh2 = new Sheet((F.w + B.w) * z + 60, F.h * z + 50, hex('#d9d3c7'));
  text(sh2, 'FRONT 12.5MM/PX', 16, 12, ink); drawPix(sh2, F, P, 16, 30, z); text(sh2, 'REAR', 40 + F.w * z, 12, ink); drawPix(sh2, B, P, 40 + F.w * z, 30, z);
  writePNG(out + 'e1_detail_front_rear.png', sh2.w, sh2.h, sh2.d); }
