// node tools/pixel/samplesV3.mjs -> samples/bodygen_v3_views.png : parametric designer, side + front + rear from one record
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildCar } from './gen/car.mjs';
import { buildFront } from './gen/front.mjs';
import { ptPalette } from './gen/engine40.mjs';
import { newDesign, sideSpec, frontSpec, rearSpec } from './gen/v3/design.mjs';
const P = ptPalette(eraPalette()); P.auto('paint.a', '#2f3a4a'); P.auto('paint.b', '#5c1c27'); P.auto('paint.c', '#3f5a40'); P.auto('paint.d', '#6b6e70');
const designs = [['1930 SEDAN (DEFAULT)', newDesign(1930), 'paint.a'], ['1934 COUPE POD LAMPS', { ...newDesign(1934, 'coupe2d'), lamp: 'pod', tail: 'bustle', frontFender: 'valanced', grille: 'vee', guards: 2 }, 'paint.b'],
  ['1941 SEDAN', newDesign(1941), 'paint.c'], ['1949 PONTOON', { ...newDesign(1949), frontFender: 'integrated', rearFender: 'integrated', grille: 'spinner', lamp: 'fender', rake: 40, roof: 1600 }, 'paint.d']];
const rows = designs.map(([n, d, pt]) => { const out = { n }; try { out.side = buildCar(P, sideSpec(d, pt), 25); out.front = buildFront(P, frontSpec(d, pt), 25); out.rear = buildFront(P, rearSpec(d, pt), 25); } catch (e) { out.err = e.stack.split('\n').slice(0, 3).join(' '); } return out; });
const cw = 240, ch = 110, sh = new Sheet(cw + 200, rows.length * ch + 20, hex('#d9d3c7')), ink = hex('#3a3440');
rows.forEach((r, i) => { const y = 10 + i * ch; text(sh, r.n, 10, y, ink, 1); if (r.err) { text(sh, r.err.slice(0, 90), 10, y + 20, hex('#a8342a'), 1); console.log(r.err); return; }
  drawPix(sh, r.side, P, 10, y + ch - 8 - r.side.h, 1); drawPix(sh, r.front, P, cw + 10, y + ch - 8 - r.front.h, 1); drawPix(sh, r.rear, P, cw + 10 + r.front.w + 10, y + ch - 8 - r.rear.h, 1); });
writePNG(new URL('../../samples/bodygen_v3_views.png', import.meta.url).pathname, sh.w, sh.h, sh.d); console.log('ok');
