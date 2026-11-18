// node tools/pixel/samplesE2mech.mjs -> samples/e2_chassis_integration.png
// Body + chassis + powertrain from one MechDef: X-ray, exploded (body lifted off the rolling chassis), plan from below.
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildMil } from './gen/military.mjs';
import { buildCar } from './gen/car.mjs';
import * as MIL from './gen/e2military.mjs';
import { sedan42 } from './gen/e2civil.mjs';
import { mech4x4, mech6x6, mechSedan42 } from './gen/mech40.mjs';
import { xray, drawMechSide, underPlan } from './gen/mechview.mjs';
import { ptPalette } from './gen/engine40.mjs';
import { writeFileSync } from 'node:fs';
const P = ptPalette(eraPalette()); P.add('ghost', ['#1d3557', '#2f5486', '#5c86bd', '#9cc3ea', '#dceeff'], '#5c86bd'); P.auto('floor', '#6a6658', { sat: 0.3 }); P.auto('paint.s42', '#2c3a4e');
const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440');
const bare = s => ({ ...s, chassis: [], anchor: false });
const exploded = (spec, mech, lift = 900) => {                        // body without chassis + rolling chassis alone (same frame)
  const body = buildMil(P, { ...bare(spec), wheels: [] });
  const ch = buildMil(P, { ...spec, chassis: [], panels: [], details: [], inner: [], canvas: [], slats: [], glass: [], celluloid: [], stencils: [], anchor: false }); drawMechSide(P, ch, mech);
  return { body, ch, dy: Math.round(lift / body.mm), mounts: mech.mounts.map(x => Math.round(ch.X(x))), zF: Math.round(ch.Y(mech.frame.line[0][1] + mech.frame.depth / 2)) }; };
const z = 2, rows = [];
const x44 = xray(P, buildMil(P, bare(MIL.jeepSide)), mech4x4), e44 = exploded(MIL.jeepSide, mech4x4), u44 = underPlan(P, mech4x4);
const x66 = xray(P, buildMil(P, bare(MIL.cckwCargo)), mech6x6), e66 = exploded(MIL.cckwCargo, mech6x6, 1100), u66 = underPlan(P, mech6x6);
const xs = xray(P, buildCar(P, { ...sedan42, under: [] }, 12.5), mechSedan42), us = underPlan(P, mechSedan42);
const W = 40 + (e66.ch.w + 40 + x66.w) * z, sh = new Sheet(W, 2600, hex('#d9d3c7')); let y = 14;
const put = (n, p, x, yy) => { text(sh, n, x, yy, ink); drawPix(sh, p, P, x, yy + 14, z); };
const putEx = (n, e, x, yy) => { text(sh, n, x, yy, ink); const top = yy + 14; drawPix(sh, e.body, P, x, top, z); const cy = top + e.dy * z; drawPix(sh, e.ch, P, x, cy, z);
  for (const mx of e.mounts) for (let k = top + e.body.h * z * 0.55; k < cy + e.zF * z; k += 6) sh.fill(x + mx * z, Math.round(k), 2, 3, hex('#b0423a')); return cy + e.ch.h * z; };
put('1/4-TON 4X4 - X-RAY (L-HEAD I4, 3-SPD + 2-SPD TRANSFER, LIVE AXLES, LEAF)', x44, 16, y); put('PLAN FROM BELOW', u44, 56 + x44.w * z, y);
y += Math.max(x44.h, u44.h) * z + 36; const yE = putEx('4X4 - EXPLODED: BODY / ROLLING CHASSIS (RED = BODY MOUNTS)', e44, 16, y);
const yE2 = putEx('2-1/2-TON 6X6 - EXPLODED', e66, 56 + e44.ch.w * z, y); y = Math.max(yE, yE2) + 30;
put('6X6 - X-RAY (OHV I6, 5-SPD, 2-SPD TRANSFER, 3 SHAFTS, WALKING-BEAM BOGIE)', x66, 16, y); put('PLAN FROM BELOW', u66, 56 + x66.w * z, y); y += Math.max(x66.h, u66.h) * z + 36;
put('1942 FOUR-DOOR SEDAN - X-RAY (L-HEAD V8, TORQUE TUBE, TRANSVERSE LEAF, X-MEMBER FRAME)', xs, 16, y); put('PLAN FROM BELOW', us, 56 + xs.w * z, y); y += Math.max(xs.h, us.h) * z + 20;
const fin = new Sheet(W, y, hex('#d9d3c7')); for (let i = 0; i < fin.d.length; i++) fin.d[i] = sh.d[i];
writePNG(out + 'e2_chassis_integration.png', fin.w, fin.h, fin.d); console.log('ok', fin.w, fin.h);
writeFileSync(new URL('../../data/e2_vehicledefs_mech.json', import.meta.url), JSON.stringify([mech4x4, mech6x6, mechSedan42].map(m => ({ id: m.id, wheels: m.axles.filter(a => !a.virtual).map(a => ({ x: a.x, drive: !!a.drive, steer: !!a.steer, dual: !!a.dual })), track: m.track, tire: m.tire, frameGeom: m.frame, engineAt: { x: m.engine.x, z: m.engine.z }, ...m.spec })), null, 1));
