// node tools/pixel/samplesEngView.mjs -> samples/engine_views.png : the new engine drawings (longitudinal section, cross-section, exterior)
import { hex } from './color.mjs';
import { Sheet } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { drawLong, drawCross, drawOutside } from '../../game/engview.mjs';
const list = [['1932 SIDE-VALVE FOUR', { layout: 'I4', head: 'sv', bore: 98, stroke: 108, carbs: 1, carbType: 'std', cooling: 'thermo', lube: 'splash', year: 1932 }],
  ['1941 OHV SIX, FULL BEARINGS, COUNTERWEIGHTS', { layout: 'I6', head: 'ohv', bore: 89, stroke: 95, carbs: 2, carbType: 'side', mains: 'full', cwt: 'yes', balancer: 'damper', year: 1941 }],
  ['1942 SIDE-VALVE V8, DUAL EXHAUST', { layout: 'V8', head: 'sv', bore: 81, stroke: 95, carbs: 1, carbType: 'down', exhaust: 'dual', year: 1942 }],
  ['1946 OHC EIGHT, HEMI CHAMBERS', { layout: 'I8', head: 'sohc', chamber: 'hemi', bore: 80, stroke: 100, carbs: 2, carbType: 'down', pistons: 'alu', rods: 'forged', year: 1946 }]];
const fill = Sheet.prototype.fill; Sheet.prototype.fill = function (x, y, w, h, c) { fill.call(this, Math.round(x), Math.round(y), Math.round(w), Math.round(h), c); };
const sh = new Sheet(760, list.length * 190, hex('#e9dfc8'));
list.forEach(([n, e], i) => { const y = i * 190; text(sh, n, 6, y + 4, hex('#3a3440'), 1); drawLong(sh, 4, y + 14, 320, 170, e, 100 + i * 77); drawCross(sh, 330, y + 14, 170, 170, e, 100 + i * 77); drawOutside(sh, 506, y + 14, 250, 170, e, 30); });
writePNG(new URL('../../samples/engine_views.png', import.meta.url).pathname, sh.w, sh.h, sh.d); console.log('ok');
