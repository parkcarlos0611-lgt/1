// Design-language demo: node tools/pixel/samplesGen.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildCar } from './gen/car.mjs';
import { clampParams, genBody } from './gen/bodygen.mjs';
const P = eraPalette();
P.auto('paint.niagara', '#4b6283'); P.auto('paint.copra', '#7d3a2c'); P.auto('paint.cream', '#d8c9a0', { sat: 0.9 }); P.auto('paint.green', '#3f5a40'); P.auto('paint.maroon', '#6e2433');
const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440'), sub = hex('#6a6070');
const mk = (label, p) => { const q = clampParams(p); return [label, q, buildCar(P, genBody(q))]; };
const base = { wb: 2900, type: 'sedan4d' };
const grid = [
  ['1931', [mk('BOX', { ...base, year: 1931, style: 'box', tire: '4.75-19', paint: 'paint.niagara' }), mk('STREAM REQUEST', { ...base, year: 1931, style: 'stream', tire: '4.75-19', paint: 'paint.niagara' })]],
  ['1935', [mk('BOX', { ...base, year: 1935, style: 'box', tire: '5.50-17', paint: 'paint.green', tail: 'trunk', fender: 'valanced' }), mk('STREAM', { ...base, year: 1935, style: 'stream', tire: '5.50-17', paint: 'paint.cream', tail: 'fastback', fender: 'pontoonF', grille: 'vee' })]],
  ['1939', [mk('BOX', { ...base, year: 1939, style: 'box', tire: '6.00-16', paint: 'paint.maroon', tail: 'trunk', fender: 'pontoonF', grille: 'vee' }), mk('STREAM', { ...base, year: 1939, style: 'stream', tire: '6.00-16', paint: 'paint.copra', tail: 'fastback', fender: 'skirted', grille: 'louvre' })]],
  ['1939 EXTREME SLIDERS (ALL 0 / ALL 1)', [mk('MIN', { ...base, year: 1939, style: 'stream', tire: '6.00-16', paint: 'paint.cream', rake: -5, roofR: -5, height: -5, hood: -5, nose: -5, belt: -5, fender: 'skirted', tail: 'fastback', grille: 'louvre' }),
    mk('MAX', { ...base, year: 1939, style: 'stream', tire: '6.00-16', paint: 'paint.cream', rake: 9, roofR: 9, height: 9, hood: 9, nose: 9, belt: 9, fender: 'skirted', tail: 'fastback', grille: 'louvre' })]],
  ['1935 FORBIDDEN CHOICES', [mk('BOX + SKIRTS + FASTBACK', { ...base, year: 1935, style: 'box', tire: '5.50-17', paint: 'paint.green', tail: 'fastback', fender: 'skirted' })]],
];
const z = 3; const colW = Math.max(...grid.flatMap(([, r]) => r.map(([, , c]) => c.w))) * z + 40;
let H = 20; for (const [, r] of grid) H += 34 + Math.max(...r.map(([, , c]) => c.h)) * z + 70;
const sh = new Sheet(colW * 2 + 20, H, hex('#d9d3c7')); let y = 14;
for (const [title, r] of grid) { text(sh, title, 16, y, ink, 3); y += 26; let x = 16; let rh = 0;
  for (const [label, q, c] of r) { text(sh, `${label}: ${q.style.toUpperCase()} RAKE ${q.rake.toFixed(0)} ROOF R${q.roofR.toFixed(0)} H/WB ${q.hWB.toFixed(2)} ${q.tail.toUpperCase()} ${q.fender.toUpperCase()}`, x, y, sub, 1);
    q.notes.slice(0, 3).forEach((n, i) => text(sh, '! ' + n.toUpperCase(), x, y + 10 + i * 8, hex('#b03030'), 1));
    drawPix(sh, c, P, x, y + 36, z); x += colW; rh = Math.max(rh, c.h * z + 36); }
  y += rh + 44; }
writePNG(out + 'e1_design_language_x3.png', sh.w, sh.h, sh.d); console.log('ok', sh.w, sh.h);
