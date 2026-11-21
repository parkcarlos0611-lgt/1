// node tools/pixel/checkGrille.mjs -> samples/check_grille_1930s.png + overlap count
// Regression check: the radiator shell must never cover a fender or a wheel (1930s generated box / stream bodies).
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { buildCar } from './gen/car.mjs';
import { genBody, clampParams } from './gen/bodygen.mjs';
const P = eraPalette(); P.auto('paint.t', '#5c1c27');
let rnd = 7; const R = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
const cars = [], bad = [];
for (let i = 0; i < 40; i++) { const year = 1930 + (i % 10), style = i % 3 === 2 && year >= 1933 ? 'stream' : 'box';
  const q = clampParams({ year, style, type: 'sedan4d', wb: 2600 + Math.round(R() * 8) * 100, tire: year < 1933 ? '4.75-19' : year < 1936 ? '5.50-17' : '6.00-16', paint: 'paint.t', fenderPaint: R() < 0.5 ? 'black' : 'paint.t', rake: R(), roofR: R(), noseR: R(), bodyR: R(), height: R(), hood: R(), nose: R(), belt: R() });
  const s = genBody(q); Object.assign(s, { grad: [3.1, 1.4], glassStyle: 'period' }); const px = buildCar(P, s, 25); cars.push(px);
  // a chrome shell pixel directly above-and-below fender/wheel pixels in the same column = shell crossing the fender line
  let n = 0; const chrome = P.id('chrome'); for (let x = 0; x < px.w; x++) for (let y = 1; y < px.h - 1; y++) if (px.r[y * px.w + x] === chrome && px.t[y * px.w + x] === 12 && [3, 6].includes(px.t[(y + 1) * px.w + x]) && [3, 6].includes(px.t[(y - 1) * px.w + x])) n++;
  if (n) bad.push(i); }
const cw = Math.max(...cars.map(c => c.w)) + 8, ch = Math.max(...cars.map(c => c.h)) + 8, sh = new Sheet(cw * 8, ch * 5, hex('#d9d3c7'));
cars.forEach((c, i) => drawPix(sh, c, P, (i % 8) * cw + 4, Math.floor(i / 8) * ch + ch - c.h - 4, 1));
writePNG(new URL('../../samples/check_grille_1930s.png', import.meta.url).pathname, sh.w, sh.h, sh.d); console.log('cars', cars.length, 'shell-over-fender failures', bad.length, bad.join(','));
