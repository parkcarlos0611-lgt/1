// node tools/pixel/samplesBase.mjs -> samples/bodygen_base_views.png : measured-base designer, side + front + rear of every base car
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildCar } from './gen/car.mjs';
import { buildFront } from './gen/front.mjs';
import { ptPalette } from './gen/engine40.mjs';
import { TEMPLATES } from './gen/v2/template.mjs';
import { measuredDesign, measuredSide, measuredView, baseName } from './gen/v3/base.mjs';
const P = ptPalette(eraPalette()); const cols = ['#2f3a4a', '#5c1c27', '#3f5a40', '#6b6e70', '#2c4a6b', '#7a5a2a']; cols.forEach((c, i) => P.auto('paint.c' + i, c)); P.auto('canvas', '#3b3631', { sat: 0.5 });
{ const seen = new Set(); const scan = o => { if (typeof o === 'string' && o.startsWith('paint.')) seen.add(o); else if (o && typeof o === 'object') Object.values(o).forEach(scan); }; TEMPLATES.forEach(t => scan(t.spec)); [...seen].forEach(n => { try { P.id(n); } catch { P.auto(n, '#3a4250'); } }); }
const extra = (process.argv[2] || '') === 'mods';
const list = TEMPLATES.map((t, i) => [baseName(t.id), measuredDesign(t.id, 1949), 'paint.c' + (i % 6)]);
if (extra) list.push(['1940 COUPE: WB+300 FO+150 ROOF-60 WIDE', { ...measuredDesign('coupe40', 1949), wb: 3250, frontOH: 950, roof: 1560, width: 1950 }, 'paint.c1'],
  ['1942 SEDAN + 1941 GRILLE/LAMPS/BUMPERS', { ...measuredDesign('sedan42', 1949), grilleFrom: 'lux41', lampFrom: 'lux41', bumperFrom: 'lux41', fog: true }, 'paint.c4'],
  ['1930 SEDAN + 1937 GRILLE, BLACK FENDERS', { ...measuredDesign('sedan30', 1949), grilleFrom: 'zephyr37', fenderBlack: true, wb: 2850 }, 'paint.c2']);
const rows = list.map(([n, d, pt]) => { const out = { n }; try { out.side = buildCar(P, measuredSide(d, pt), 25); out.front = buildFront(P, measuredView(d, pt), 25); out.rear = buildFront(P, measuredView(d, pt, true), 25); } catch (e) { out.err = e.stack.split('\n').slice(0, 3).join(' '); } return out; });
const cw = 290, ch = 112, per = Math.ceil(rows.length / 2), sh = new Sheet(2 * (cw + 200), per * ch + 20, hex('#d9d3c7')), ink = hex('#3a3440');
rows.forEach((r, i) => { const x0 = (i >= per ? cw + 200 : 0), y = 10 + (i % per) * ch; text(sh, r.n, x0 + 10, y, ink, 1); if (r.err) { text(sh, r.err.slice(0, 90), x0 + 10, y + 20, hex('#a8342a'), 1); console.log(r.n, r.err); return; }
  drawPix(sh, r.side, P, x0 + 6, y + ch - 8 - r.side.h, 1); drawPix(sh, r.front, P, x0 + cw - 10, y + ch - 8 - r.front.h, 1); drawPix(sh, r.rear, P, x0 + cw - 10 + r.front.w + 4, y + ch - 8 - r.rear.h, 1); });
writePNG(new URL('../../samples/bodygen_base_views' + (extra ? '_mods' : '') + '.png', import.meta.url).pathname, sh.w, sh.h, sh.d); console.log('ok');
