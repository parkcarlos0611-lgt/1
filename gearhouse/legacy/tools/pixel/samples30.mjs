// 1930s sheet: node tools/pixel/samples30.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildCar } from './gen/car.mjs';
import * as S from './gen/specs30.mjs';
export const P = eraPalette();
P.auto('paint.niagara', '#4b6283'); P.auto('paint.ivory', '#d9cfae', { sat: 0.9 }); P.auto('paint.bottle', '#2c4a36'); P.auto('paint.burgundy', '#74263a');
P.auto('canvas', '#4a423b', { sat: 0.6 });
export const cars = [['1930 UPRIGHT SEDAN', S.sedan30], ['1933 LUXURY CABRIOLET', S.tourer33], ['1937 STREAMLINE SEDAN', S.stream37]].map(([n, s]) => [n, buildCar(P, s), s]);
const out = new URL('../../samples/', import.meta.url).pathname;
const z = 4, W = Math.max(...cars.map(([, c]) => c.w)) * z + 32, sh = new Sheet(W, cars.reduce((a, [, c]) => a + c.h * z + 44, 20), hex('#d9d3c7'));
let y = 16; for (const [n, c] of cars) { text(sh, n + '  ' + c.w + 'x' + c.h + 'PX  S1 25MM/PX', 16, y, hex('#3a3440')); drawPix(sh, c, P, 16, y + 18, z); y += c.h * z + 44; }
writePNG(out + 'cars_1930s_side_x4.png', sh.w, sh.h, sh.d);
console.log('ok', sh.w, sh.h);

// ---- 1930 sedan: 4 views ----
import { buildCarRight } from './gen/car.mjs';
import { buildFront } from './gen/front.mjs';
{
  const L = cars[0][1], R = buildCarRight(P, S.sedan30), F = buildFront(P, S.sedan30front), B = buildFront(P, S.sedan30rear);
  const z = 4, sw = 32 + Math.max(L.w, F.w + B.w + 8) * z, sh2 = new Sheet(sw, 16 + (L.h * 2 + F.h) * z + 130, hex('#d9d3c7'));
  let y = 16; text(sh2, '1930 UPRIGHT SEDAN - LEFT', 16, y, hex('#3a3440')); drawPix(sh2, L, P, 16, y + 16, z); y += L.h * z + 38;
  text(sh2, 'RIGHT (MIRRORED, RELIT WHEELS)', 16, y, hex('#3a3440')); drawPix(sh2, R, P, 16, y + 16, z); y += L.h * z + 38;
  text(sh2, 'FRONT ' + F.w + 'x' + F.h, 16, y, hex('#3a3440')); drawPix(sh2, F, P, 16, y + 16, z);
  text(sh2, 'REAR ' + B.w + 'x' + B.h, 16 + F.w * z + 32, y, hex('#3a3440')); drawPix(sh2, B, P, 16 + F.w * z + 32, y + 16, z);
  writePNG(out + 'car1930_views_x4.png', sh2.w, sh2.h, sh2.d);
}
