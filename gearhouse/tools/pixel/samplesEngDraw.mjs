// node tools/pixel/samplesEngDraw.mjs -> samples/engine_draw2.png : second-generation engine drawings (shaded, outlined), all stages
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { ptPalette } from './gen/engine40.mjs';
import { drawLongPix, drawCrossPix, drawOutsidePix, engPalette } from '../../game/engdraw.mjs';
const P = engPalette(ptPalette(eraPalette()));
const list = [['1932 SIDE-VALVE FOUR', { layout: 'I4', head: 'sv', bore: 98, stroke: 108, carbs: 1, carbType: 'std', cooling: 'thermo', lube: 'splash', year: 1932 }],
  ['1941 OHV SIX, FULL BEARINGS, COUNTERWEIGHTS', { layout: 'I6', head: 'ohv', bore: 89, stroke: 95, carbs: 2, carbType: 'side', mains: 'full', cwt: 'yes', balancer: 'damper', year: 1941 }],
  ['1942 SIDE-VALVE V8, DUAL EXHAUST', { layout: 'V8', head: 'sv', bore: 81, stroke: 95, carbs: 1, carbType: 'down', exhaust: 'dual', year: 1942 }],
  ['1946 OHC EIGHT, HEMI CHAMBERS', { layout: 'I8', head: 'sohc', chamber: 'hemi', bore: 80, stroke: 100, carbs: 2, carbType: 'down', pistons: 'alu', rods: 'forged', year: 1946 }]];
const sh = new Sheet(1000, list.length * 200 + 210, hex('#e9dfc8')), ink = hex('#3a3440');
list.forEach(([n, e], i) => { const y = i * 200; text(sh, n, 6, y + 4, ink, 1); const th = 100 + i * 77;
  drawPix(sh, drawLongPix(P, e, th, 400, 180).px, P, 4, y + 16, 1); drawPix(sh, drawCrossPix(P, e, th, 200, 180).px, P, 408, y + 16, 1); drawPix(sh, drawOutsidePix(P, e, th, 380, 180).px, P, 614, y + 16, 1); });
const e = list[1][1], y0 = list.length * 200; text(sh, 'STAGES 1-8 (LONGITUDINAL SECTION)', 6, y0 + 4, ink, 1);
for (let s = 1; s <= 8; s++) drawPix(sh, drawLongPix(P, e, 200, 240, 90, s).px, P, 4 + ((s - 1) % 4) * 248, y0 + 16 + Math.floor((s - 1) / 4) * 96, 1);
writePNG(new URL('../../samples/engine_draw2.png', import.meta.url).pathname, sh.w, sh.h, sh.d); console.log('ok');
