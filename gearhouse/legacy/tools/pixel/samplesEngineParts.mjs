// node tools/pixel/samplesEngineParts.mjs -> samples/engine_parts.png : part-built engines, exterior + exploded
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { ptPalette } from './gen/engine40.mjs';
import { engineStats } from '../../sim/engine.mjs';
import { buildEngineParts, explodedOffsets, BUILD_ORDER } from './gen/engineParts.mjs';
const P = ptPalette(eraPalette());
const list = [
  ['1932 SV I4, UPDRAFT, THERMOSYPHON, SPLASH', { layout: 'I4', head: 'sv', bore: 98, stroke: 108, cr: 5, cam: 0.3, carbs: 1, carbType: 'std', cooling: 'thermo', lube: 'splash', year: 1932 }],
  ['1942 SV V8, DOWNDRAFT, DUAL EXHAUST', { layout: 'V8', head: 'sv', bore: 81, stroke: 95, cr: 6.5, cam: 0.35, carbs: 1, carbType: 'down', exhaust: 'dual', year: 1942 }],
  ['1941 OHV I6, 2 SIDE-DRAFT, SPLIT MANIFOLD', { layout: 'I6', head: 'ohv', bore: 89, stroke: 95, cr: 6.8, cam: 0.5, carbs: 2, carbType: 'side', exhManifold: 'split', cwt: 'yes', year: 1941 }],
  ['1946 SOHC I8, HEMI, 2 DOWNDRAFT', { layout: 'I8', head: 'sohc', chamber: 'hemi', bore: 80, stroke: 100, cr: 7, cam: 0.6, carbs: 2, carbType: 'down', pistons: 'alu', year: 1946 }]];
const ext = BUILD_ORDER.filter(k => k !== 'crank' && k !== 'pistons'), order = ['bell', 'block', 'sump', 'timing', 'head', 'cover', 'exhaust', 'intake', 'carbs', 'water', 'generator', 'distributor', 'filter', 'starter'];
const cw = 300, ch = 200, sh = new Sheet(cw * 2, ch * list.length, hex('#d9d3c7')), ink = hex('#3a3440');
list.forEach(([n, e], r) => { const es = engineStats(e), set = buildEngineParts(P, e, es, 7), by = Object.fromEntries(set.parts.map(p => [p.id, p])), off = explodedOffsets(set);
  text(sh, n, 6, r * ch + 4, ink, 1); text(sh, `${es.hp.toFixed(0)} HP  ${es.litres.toFixed(2)} L  ${es.mass} KG`, 6, r * ch + 12, ink, 1);
  for (const k of order) { const p = by[k]; if (p) drawPix(sh, p.px, P, 6 + p.x, r * ch + 24 + p.y, 1); }
  for (const k of ['crank', 'pistons', ...order]) { const p = by[k]; if (!p) continue; const [dx, dy] = off[k] || [0, 0]; drawPix(sh, p.px, P, cw + 30 + p.x + dx, r * ch + 70 + p.y + dy, 1); } });
writePNG(new URL('../../samples/engine_parts.png', import.meta.url).pathname, sh.w, sh.h, sh.d); console.log('ok');
