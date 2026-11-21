// E2 (1940s) generator preview: node tools/pixel/samplesE2.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildCar } from './gen/car.mjs';
import { clampParams, genBody } from './gen/bodygen.mjs';
const P = eraPalette(); const PAL = ['#2c3e50', '#6b2d2d', '#3f5a40', '#8a8f86', '#1d1d22', '#4b6283', '#b7a77a', '#5a4a6a'];
PAL.forEach((h, i) => P.auto('paint.e2' + i, h));
const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440'), sub = hex('#6a6070');
const rows = [[1940, 'box', 'sedan4d', '6.00-16', 0], [1940, 'stream', 'sedan4d', '6.00-16', 1], [1941, 'stream', 'coupe2d', '6.50-16', 2], [1942, 'stream', 'sedan4d', '6.50-16', 3],
  [1946, 'stream', 'sedan4d', '6.00-16', 4], [1946, 'pontoon', 'sedan4d', '6.00-16', 5], [1947, 'box', 'coupe2d', '6.00-16', 6], [1948, 'pontoon', 'coupe2d', '6.70-15', 7],
  [1949, 'pontoon', 'sedan4d', '6.70-15', 0], [1949, 'stream', 'coupe2d', '6.70-15', 1], [1945, 'pontoon', 'sedan4d', '6.00-16', 2], [1949, 'pontoon', 'coupe2d', '6.70-15', 3]];
const cars = rows.map(([year, style, type, t, pi], k) => { const paint = 'paint.e2' + pi;
  const q = clampParams({ year, style, type, wb: 2900, tire: t, paint, rake: 0.5, roofR: 0.6, noseR: 0.5, bodyR: 0.5, height: 0.4, hood: 0.5, nose: 0.5, belt: 0.5, fenderPaint: paint });
  const s = genBody(q); Object.assign(s, { grad: [3.1, 1.4], glassStyle: 'period', wheel: style === 'box' ? { style: 'disc', paint } : { style: 'trimring', paint, whitewall: year >= 1946 ? 0.35 : 0.2 } });
  return [q, buildCar(P, s, 12.5)]; });
const colW = Math.max(...cars.map(([, c]) => c.w)) + 30, rowH = Math.max(...cars.map(([, c]) => c.h)) + 40;
const sh = new Sheet(colW * 2 + 20, rowH * 6 + 20, hex('#d9d3c7'));
cars.forEach(([q, c], i) => { const x = 16 + (i % 2) * colW, y = 12 + Math.floor(i / 2) * rowH;
  text(sh, `${q.year} ${q.style.toUpperCase()} ${q.type.toUpperCase()} ${q.fender.toUpperCase()} ${q.tail.toUpperCase()} RAKE ${q.rake.toFixed(0)}`, x, y, ink, 1);
  if (q.notes.length) text(sh, '! ' + q.notes[0].toUpperCase(), x, y + 9, hex('#b03030'), 1); drawPix(sh, c, P, x, y + 20, 1); });
writePNG(out + 'e2_generator_preview.png', sh.w, sh.h, sh.d); console.log('ok');
