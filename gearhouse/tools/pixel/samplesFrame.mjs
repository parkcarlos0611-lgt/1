// node tools/pixel/samplesFrame.mjs -> samples/frame_detail.png : detailed frames (plan, side, section) for three designs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { ptPalette } from './gen/engine40.mjs';
import { platformStats } from './gen/v3/platform.mjs';
import { frameDefaults, frameGeo, framePlan, frameSide, frameSection, frameZones } from './gen/v3/frame.mjs';
const P = ptPalette(eraPalette()); P.auto('bare', '#9aa0a6', { sat: 0.2 });
const list = [['1930 CHANNEL LADDER, RIVETED, 5 CROSS-MEMBERS', { type: 'ladderC', railH: 130, railT: 4, cross: 5, kick: 140, grade: 'mild', wb: 2630, width: 1710 }, 1930],
  ['1936 LADDER + X-MEMBER, DOUBLE DROP, FISH PLATES, TUBE CROSS-MEMBERS', { type: 'ladderX', railH: 160, railT: 4.5, cross: 6, kick: 170, grade: 'mild', wb: 3100, width: 1850, drop: 90, gusset: true, xType: 'tube', mounts: 10 }, 1936],
  ['1941 BOX RAILS + X-MEMBER, WELDED', { type: 'boxX', railH: 150, railT: 3.4, cross: 5, kick: 150, grade: 'mild', wb: 3050, width: 1950, join: 'weld', railW: 75, mounts: 12 }, 1941]];
const sh = new Sheet(430, list.length * 240 + 10, hex('#d9d3c7')), ink = hex('#3a3440');
list.forEach(([n, pl, y], i) => { frameDefaults(pl, y); const g = frameGeo(pl), st = platformStats(pl, g), z = frameZones(pl, g, st), y0 = i * 240 + 6;
  text(sh, n, 6, y0, ink, 1); text(sh, `${st.kg} KG  STIFF ${Math.round(st.stiff * 100)}  ` + z.map(q => q.name + ' X' + q.margin.toFixed(2)).join('  '), 6, y0 + 8, ink, 1);
  const a = framePlan(P, pl, g, 12), b = frameSide(P, pl, g, 12), c = frameSection(P, pl, 1.5); drawPix(sh, a, P, 6, y0 + 18, 1); drawPix(sh, b, P, 6, y0 + 22 + a.h, 1); drawPix(sh, c, P, 6 + b.w + 8, y0 + 22 + a.h, 1); });
writePNG(new URL('../../samples/frame_detail.png', import.meta.url).pathname, sh.w, sh.h, sh.d); console.log('ok');
