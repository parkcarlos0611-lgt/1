// node tools/pixel/samplesV2.mjs -> samples/bodygen_v2_templates.png
// Body generator v2 check sheet: each measured template (identity), short / long wheelbase, low / high greenhouse.
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildCar } from './gen/car.mjs';
import { ptPalette } from './gen/engine40.mjs';
import { TEMPLATES, warpSpec, landmarks, repaint } from './gen/v2/template.mjs';
const P = ptPalette(eraPalette()); const names = new Set(); const scan = o => { if (typeof o === 'string' && o.startsWith('paint.')) names.add(o); else if (o && typeof o === 'object') Object.values(o).forEach(scan); };
TEMPLATES.forEach(t => scan(t.spec)); const pal = ['#2f3a4a', '#5c1c27', '#3f5a40', '#7d3a2c', '#4b6283', '#6b5a3a', '#2c3a4e', '#6b6e70', '#1e2a3a', '#8c2a24', '#3d4a3a', '#4e5a4a', '#5a1e28'];
[...names].forEach((n, i) => { try { P.id(n); } catch { P.auto(n, pal[i % pal.length]); } }); P.auto('canvas', '#3b3631', { sat: 0.5 });
const rows = TEMPLATES.map(t => { const L = landmarks(t.spec), v = [['MEASURED', {}], ['WB -300', { dWB: -300 }], ['WB +500', { dWB: 500 }], ['ROOF -8%', { gh: 0.92 }], ['ROOF +8%', { gh: 1.08 }]];
  return { t, L, cars: v.map(([n, o]) => { let px = null, err = null; try { px = buildCar(P, warpSpec(t.spec, o), 25); } catch (e) { err = e.message; } return { n, px, err }; }) }; });
const cw = Math.max(...rows.flatMap(r => r.cars.map(c => c.px ? c.px.w : 0))) + 8, ch = Math.max(...rows.flatMap(r => r.cars.map(c => c.px ? c.px.h : 0))) + 14;
const sh = new Sheet(cw * 5 + 20, rows.length * ch + 20, hex('#d9d3c7')), ink = hex('#3a3440');
rows.forEach((r, i) => r.cars.forEach((c, j) => { const x = 10 + j * cw, y = 10 + i * ch; text(sh, (j ? '' : r.t.name + '  ') + c.n, x, y, ink, 1); if (c.px) drawPix(sh, c.px, P, x, y + ch - 6 - c.px.h, 1); else text(sh, 'ERR ' + (c.err || '').slice(0, 30), x, y + 20, hex('#a8342a'), 1); }));
writePNG(new URL('../../samples/bodygen_v2_templates.png', import.meta.url).pathname, sh.w, sh.h, sh.d);
console.log(rows.map(r => `${r.t.id} wb ${Math.round(r.L.wb)} hood ${Math.round(r.L.hood)} cabin ${Math.round(r.L.cabin)} quarter ${Math.round(r.L.quarter)} gh ${Math.round(r.L.greenhouse)} ${r.cars.filter(c => c.err).map(c => c.n + ':' + c.err).join(';')}`).join('\n'));
