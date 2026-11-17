// node tools/pixel/samplesE2civ.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildCar } from './gen/car.mjs';
import { CIVIL } from './gen/e2civil.mjs';
const P = eraPalette(); [['w46', '#2e3d2c'], ['p40', '#8c2a24'], ['s42', '#2c3a4e'], ['c40', '#6b6e70'], ['sm46', '#4e5a4a'], ['l41', '#5a1e28'], ['ct40', '#1e2a3a'], ['t40', '#3d4a3a']].forEach(([k, h]) => P.auto('paint.' + k, h));
const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440');
const cars = CIVIL.map(([n, s]) => [n, buildCar(P, s, 12.5)]);
const colW = Math.max(...cars.map(([, c]) => c.w)) + 30, rowH = Math.max(...cars.map(([, c]) => c.h)) + 30;
const sh = new Sheet(colW * 2 + 20, rowH * 4 + 20, hex('#d9d3c7'));
cars.forEach(([n, c], i) => { const x = 16 + (i % 2) * colW, y = 12 + Math.floor(i / 2) * rowH; text(sh, n + '  ' + c.w + 'X' + c.h, x, y, ink, 1); drawPix(sh, c, P, x, y + 12 + (rowH - 30 - c.h), 1); });
writePNG(out + 'e2_civil.png', sh.w, sh.h, sh.d); console.log('ok', cars.map(([n, c]) => c.anchorLog.brackets.length).join(','));
