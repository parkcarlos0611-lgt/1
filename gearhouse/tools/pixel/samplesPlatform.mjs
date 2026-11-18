// node tools/pixel/samplesPlatform.mjs -> samples/platform_types.png : every frame type under three base cars (plan + side), unit-body shell
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildCar } from './gen/car.mjs';
import { ptPalette } from './gen/engine40.mjs';
import { TEMPLATES } from './gen/v2/template.mjs';
import { measuredDesign, measuredSide } from './gen/v3/base.mjs';
import { FRAME_TYPES, platformDefault, platformPlan, platformSide, platformStats, unitShell, clampPlatform } from './gen/v3/platform.mjs';
import { stripBody } from '../../game/assembly.mjs';
const P = ptPalette(eraPalette()); P.auto('paint.c0', '#2f3a4a'); P.auto('bare', '#9aa0a6', { sat: 0.2 }); P.auto('canvas', '#3b3631', { sat: 0.5 });
{ const seen = new Set(); const scan = o => { if (typeof o === 'string' && o.startsWith('paint.')) seen.add(o); else if (o && typeof o === 'object') Object.values(o).forEach(scan); }; TEMPLATES.forEach(t => scan(t.spec)); [...seen].forEach(n => { try { P.id(n); } catch { P.auto(n, '#3a4250'); } }); }
const bases = ['sedan30', 'zephyr37', 'sedan42'], types = Object.keys(FRAME_TYPES), cw = 250, ch = 150, sh = new Sheet(cw * bases.length, ch * types.length + 10, hex('#d9d3c7')), ink = hex('#3a3440');
bases.forEach((id, c) => { const d = measuredDesign(id, 1949), s = measuredSide(d, 'paint.c0'), T = s.tire || '6.00-16';
  types.forEach((ty, r) => { const pl = clampPlatform({ ...platformDefault(id), type: ty }, 1949, () => true), st = platformStats(pl, s.geo), x = c * cw + 6, y = r * ch + 6;
    text(sh, `${id.toUpperCase()} - ${FRAME_TYPES[ty].name}`, x, y, ink, 1); text(sh, `${st.kg} KG  STIFF ${Math.round(st.stiff * 100)}  STRENGTH X${st.margin.toFixed(2)}`, x, y + 8, ink, 1);
    const plan = platformPlan(P, pl, s.geo, { track: d.width - 300, tireCode: T, width: d.width }, 32); drawPix(sh, plan, P, x, y + 18, 1);
    const side = ty === 'unibody' ? unitShell(P, buildCar(P, stripBody({ ...s, under: [], fenders: [], boards: [], anchor: false }, 'bare'), 32), s) : platformSide(P, pl, s.geo, T, 32);
    drawPix(sh, side, P, x, y + ch - 6 - side.h, 1); }); });
writePNG(new URL('../../samples/platform_types.png', import.meta.url).pathname, sh.w, sh.h, sh.d); console.log('ok');
