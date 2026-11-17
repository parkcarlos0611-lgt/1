import { frameLine, crossAt } from '../tools/pixel/gen/v3/platform.mjs';
import { drawFit, FIT_LEN } from './fitfx.mjs';
// Assembly-line sequence: the car is built up in real factory order from the SAME geometry the designer produced.
// 1 frame on trestles -> 2 axles/springs/steering -> 3 engine lowered on a chain hoist + gearbox, shafts, tank, exhaust
// -> 4 wheels, chassis set down -> 5 body in white (ash-framed composite early 1930s, bare steel later) -> 6 body drop
// -> 7 primer -> 8 colour coats + chrome, lamps, glass -> 9 inspection and drive-off.  Era changes the equipment.
import { Pix, drawPix } from '../tools/pixel/pix.mjs';
import { hex } from '../tools/pixel/color.mjs';
import { buildCar } from '../tools/pixel/gen/car.mjs';
import { genBody } from '../tools/pixel/gen/bodygen.mjs';
import { landmarks } from '../tools/pixel/gen/v2/template.mjs';
import { drawMechSide, engineSprite } from '../tools/pixel/gen/mechview.mjs';
import { engineStats, LAYOUTS } from '../sim/engine.mjs';
import { C, W, H, text, tw, bevel, button, lineTo } from './ui.mjs';

export const STAGES_U = ['BODY SHELL IN JIG', 'SUSPENSION TO SHELL', 'POWERTRAIN', 'ROLLING SHELL', 'DOORS AND PANELS', 'SEALING', 'PRIMER', 'PAINT AND TRIM', 'INSPECTION'];   // unit body
export const STAGES = ['FRAME', 'CHASSIS', 'POWERTRAIN', 'ROLLING CHASSIS', 'BODY IN WHITE', 'BODY DROP', 'PRIMER', 'PAINT AND TRIM', 'INSPECTION'];
const FR = 110;                                                            // frames per stage
// mechanical layout derived from the generated body's own geometry (same mm frame)
function mechFromBody(spec, eng, year, plat) {
  const g = spec.geo, r = g.r, F = g.F, R = g.R, fz = r + 150, es = engineStats({ ...eng, year }), L = LAYOUTS[eng.layout];
  const ex = g.noseX + 300, eEnd = ex + es.len - 120;
  const kind = eng.head === 'sv' && L.banks === 1 ? 'sv_i4' : eng.head === 'sv' ? 'flathead_v8' : L.cyl === 6 && L.banks === 1 ? 'ohv_i6' : 'sv_i4';
  const opts = kind === 'sv_i4' ? { cyl: L.cyl, bore: eng.bore, stroke: eng.stroke, color: 'paint.enginegreen' } : kind === 'flathead_v8' ? { bore: eng.bore, stroke: eng.stroke, perBank: L.cyl / 2 } : { bore: eng.bore, stroke: eng.stroke, color: 'paint.engineGrey' };
  return { tire: spec.tire, frame: plat ? { line: frameLine(plat, g), depth: plat.type === 'unibody' ? 0 : plat.railH * 0.8, ramp: 'bare', cross: plat.type === 'unibody' ? [] : crossAt(plat, g) } : { line: [[g.noseX + 120, fz + 40], [F + 320, fz], [R - 520, fz], [R - 220, fz + 170], [R + 380, fz + 170], [g.tailX - 160, fz + 110]], depth: 110, cross: [g.noseX + 160, g.cowlX + 60, R + 360] },
    axles: [{ x: F, spring: 'leaf', springLen: 900 }, { x: R, drive: 1, spring: 'leaf', springLen: 1250, diffR: 150 }],
    engine: { kind, x: ex, z: r + 170, opts }, radiator: [g.noseX + 150, r + 60, g.noseX + 215, g.hoodZ - 90],
    gearbox: { x0: eEnd, x1: eEnd + 280, z: r + 140 }, shafts: [[[eEnd + 280, r + 130], [R - 150, r + 30]]],
    exhaust: [[ex + 200, r + 240], [ex + 330, r - 60], [R - 900, r - 120], [g.tailX - 120, r - 90]], muffler: [R - 1500, R - 950, r - 110],
    tank: [R + 420, fz - 50, Math.min(g.tailX - 220, R + 1100), fz + 180], steering: [[F + 180, r + 230], [g.cowlX + 380, g.beltZ + 60]] };
}
export const stripBody = (spec, ramp) => ({ ...spec, paint: ramp, tone: [], lamps: [], bumperSets: [], bumpers: [], trim: [], handles: [], decals: [],
  parts: (spec.parts || []).filter(p => !p.chrome), fenders: (spec.fenders || []).map(f => ({ ...f, paint: ramp })), boards: [], wheels: [], spares: [], anchor: false, grad: [2.6, 1.6] });

export function makeAssembly(P, model, eng, year, paintIdx) {
  const spec = model.spec ? { ...JSON.parse(JSON.stringify(model.spec)), under: [], anchor: false } : genBody(model.q); Object.assign(spec, { grad: spec.grad || [3.1, 1.4], glassStyle: spec.glassStyle || 'period' });
  if (!spec.geo) { const L = landmarks(spec); spec.geo = { r: L.r, F: L.F, R: L.R, gap: L.gap, noseX: L.noseX, cowlX: L.cowl, hoodZ: L.belt + 30, beltZ: L.belt, tailX: L.tailX }; }
  const mm = Math.max(25, Math.ceil(spec.len / 190)), full = buildCar(P, spec, mm);
  const blank = () => { const p = new Pix(full.w, full.h); p.X = full.X; p.Y = full.Y; p.mm = mm; return p; };
  const plat = model.plat || null, uni = plat?.type === 'unibody', mech = mechFromBody(spec, eng, year, plat);
  const frameOnly = blank(); drawMechSide(P, frameOnly, { ...mech, axles: [], engine: null, gearbox: null, shafts: [], exhaust: null, muffler: null, tank: null, radiator: null, steering: null });
  const chassis = blank(); drawMechSide(P, chassis, { ...mech, engine: null, gearbox: null, shafts: [], exhaust: null, muffler: null, tank: null });
  const driveline = blank(); drawMechSide(P, driveline, { ...mech, engine: null });
  const eSpr = engineSprite(P, mech.engine, mm);
  const wheelsOnly = buildCar(P, { ...spec, body: [[0, -500], [1, -500], [1, -499]], fenders: [], boards: [], aprons: [], tone: [], parts: [], lamps: [], bumperSets: [], trim: [], handles: [], glass: [], win: null, louvres: [], doors: [], anchor: false }, mm);
  const early = year < 1935, primer = year < 1940 ? 'primerRed' : 'primerGrey';
  const biw = buildCar(P, stripBody(spec, early ? 'woodLight' : 'bare'), mm), prim = buildCar(P, stripBody(spec, primer), mm);
  const painted = buildCar(P, { ...spec, wheels: [], spares: [], anchor: false }, mm);
  // trim fitted piece by piece after the colour coat: bare paint -> + bumpers -> + lamps -> + grille / brightwork / handles
  const pc = { ...spec, wheels: [], spares: [], anchor: false }, noTrim = { lamps: [], bumperSets: [], trim: [], handles: [], parts: (spec.parts || []).filter(p => !p.chrome) };
  const t0 = buildCar(P, { ...pc, ...noTrim }, mm), t1 = buildCar(P, { ...pc, ...noTrim, bumperSets: spec.bumperSets || [] }, mm), t2 = buildCar(P, { ...pc, ...noTrim, bumperSets: spec.bumperSets || [], lamps: spec.lamps || [] }, mm);
  const fits = [{ bare: t0, old: null, now: t1 }, { bare: t1, old: null, now: t2 }, { bare: t2, old: null, now: painted }];
  return { uni, trim0: t0, fits, full, frameOnly, chassis, driveline, eSpr, wheelsOnly, biw, prim, painted, mech, year, early, t: 0, mm, eng: mech.engine };
}

// scene drawing: factory backdrop by era + the staged layers. returns current stage index (9 = done)
export function drawAssembly(S, P, A, sfx) {
  const st = Math.min(9, Math.floor(A.t / FR)), u = (A.t % FR) / FR, y0 = 150, war = A.year >= 1942 && A.year <= 1945;
  // ---- factory hall: sawtooth roof light, columns, overhead I-beam, floor ----
  S.fill(0, 0, W, H, hex(war ? '#2b2c25' : '#2c2622'));
  for (let x = 0; x < W; x += 60) { for (let k = 0; k < 18; k++) S.fill(x + k * 2, 18 - k, 2, k + 1, hex('#4a4a44')); S.fill(x + 36, 0, 24, 18, hex('#5b5f5e')); }   // sawtooth roof
  for (let x = 30; x < W; x += 120) { S.fill(x, 18, 6, y0 + 40, hex('#3e3a35')); S.fill(x + 1, 18, 1, y0 + 40, hex('#57524a')); }   // columns
  S.fill(0, 30, W, 5, hex('#5a5550')); S.fill(0, 30, W, 1, hex('#7a746c'));                                                             // I-beam / conveyor rail
  S.fill(0, y0 + 58, W, H - y0 - 58, hex('#3a332d')); for (let x = 0; x < W; x += 24) S.fill(x, y0 + 58, 1, H - y0 - 58, hex('#332c27'));
  if (!A.early) { S.fill(0, y0 + 56, W, 3, hex('#6b645b')); for (let x = (A.t * 0.5) % 16; x < W; x += 16) S.fill(x, y0 + 57, 6, 1, hex('#8a8278')); }   // moving floor conveyor (1935+)
  const scale = A.full.w * 2 <= W - 40 && A.full.h * 2 <= 130 ? 2 : 1, ox = Math.round((W - A.full.w * scale) / 2), oy = y0 + 56 - A.full.h * scale + 2 * scale;
  const put = (pix, dx = 0, dy = 0) => drawPix(S, pix, P, ox + dx, oy + dy, scale, { shadowA: 0 });
  // trestles until the wheels go on
  if (st < 3 || (st === 3 && u < 0.5)) for (const f of [0.25, 0.7]) { const tx = ox + A.full.w * scale * f; S.fill(tx - 8, oy + A.full.h * scale - 70, 16, 4, hex(A.early ? '#7a5a36' : '#555a5e')); lineTo(S, tx - 6, oy + A.full.h * scale - 66, tx - 12, y0 + 57, hex(A.early ? '#6a4c2c' : '#45494d')); lineTo(S, tx + 6, oy + A.full.h * scale - 66, tx + 12, y0 + 57, hex(A.early ? '#6a4c2c' : '#45494d')); }
  const lift = st < 4 ? -14 : 0;                                       // chassis sits higher on trestles
  if (A.uni && st < 4) put(A.biw, 0, st === 3 ? Math.round((1 - Math.min(1, u * 2)) * lift) : lift);   // unit body: the shell is welded first, mechanicals bolt to it
  if (st === 0) { put(A.frameOnly, 0, lift); if (A.t % 14 === 0) sfx(A.uni ? 'weld' : 'rivet'); if (A.t % 9 === 0) S.fill(ox + 40 + (A.t * 7) % (A.full.w * scale - 80), oy + A.full.h * scale - 80, 2, 2, hex('#ffe08a')); }
  if (st === 1) { put(A.chassis, 0, lift); if (A.t % 24 === 0) sfx('wrench'); }
  if (st === 2) { put(A.driveline, 0, lift);                           // engine comes down on the chain hoist
    const e = A.eSpr, drop = Math.max(0, 1 - u * 1.6), ex = ox + Math.round(A.full.X(A.eng.x) * scale - e.ax * scale), ey = oy + Math.round(A.full.Y(A.eng.z) * scale - e.ay * scale) + lift - Math.round(drop * 90), sway = Math.round(Math.sin(A.t * 0.2) * 2 * drop);
    lineTo(S, ex + e.w + sway, 34, ex + e.w * 0.6 + sway, ey + 6, hex('#9a9690')); lineTo(S, ex + e.w + sway, 34, ex + e.w * 1.3 + sway, ey + 6, hex('#9a9690')); S.fill(ex + e.w - 3 + sway, 33, 7, 6, hex('#b0341f'));
    drawPix(S, e, P, ex + sway, ey, scale, { shadowA: 0 }); if (A.t % 6 === 0 && drop > 0) sfx('ratchet'); if (Math.abs(drop) < 0.01 && A.t % FR === Math.round(FR / 1.6)) sfx('thud'); }
  if (st >= 3 && st < 9) { const dl = st === 3 ? Math.round((1 - Math.min(1, u * 2)) * lift) : 0; put(A.wheelsOnly, 0, dl); put(A.full === null ? A.chassis : A.driveline, 0, dl); drawPix(S, A.eSpr, P, ox + Math.round(A.full.X(A.eng.x) * scale - A.eSpr.ax * scale), oy + dl + Math.round(A.full.Y(A.eng.z) * scale - A.eSpr.ay * scale), scale, { shadowA: 0 }); if (st === 3 && A.t % FR === 20) sfx('hiss'); }
  if (st === 4) { put(A.biw, 0, A.uni ? 0 : -80); if (A.t % 5 === 0) { sfx(A.early ? 'hammer' : 'weld'); for (let k = 0; k < 3; k++) S.fill(ox + 60 + ((A.t * 37 + k * 50) % (A.full.w * scale - 120)), oy - 40 + ((A.t * 13 + k * 20) % 60), 2, 2, hex(A.early ? '#c49a5c' : '#fff1a8')); } }
  if (st === 5 && A.uni) { put(A.biw); if (A.t % 20 === 0) sfx('hiss'); }
  else if (st === 5) { put(A.biw, 0, -80 + Math.round(Math.min(1, u * 1.4) * 80)); if (A.t % FR === 80) sfx('clunk'); lineTo(S, ox + 60, 34, ox + 60, oy - 80 + Math.round(Math.min(1, u * 1.4) * 80) + 30, hex('#7a746c')); lineTo(S, ox + A.full.w * scale - 60, 34, ox + A.full.w * scale - 60, oy - 80 + Math.round(Math.min(1, u * 1.4) * 80) + 30, hex('#7a746c')); }
  if (st === 6) { put(A.prim); if (A.t % 10 === 0) sfx('spray'); for (let k = 0; k < 20; k++) S.fill(ox + ((A.t * 3) % (A.full.w * scale)) + (k * 7) % 30 - 15, oy + 20 + (k * 11) % 60, 1, 1, hex('#b8aaa0')); }
  if (st === 7) { const p = Math.min(1, u * 1.3); put(A.prim); const cut = Math.round(A.full.w * scale * p);   // colour coat sweeps across, then chrome and glass
    const pb = A.trim0;
    if (u < 0.5) { const cut = Math.round(A.full.w * scale * Math.min(1, u * 2.2));
      for (let y = 0; y < pb.h; y++) for (let x = 0; x < Math.min(pb.w, Math.ceil(cut / scale)); x++) { const i = y * pb.w + x; if (!pb.r[i]) continue; const r = P.ramps[pb.r[i]], c = pb.l[i] < 0 ? r.o : r.c[pb.l[i]]; S.fill(ox + x * scale, oy + y * scale, scale, scale, c); }
      if (A.t % 10 === 0) sfx('spray'); }
    else { const q = (u - 0.5) / 0.5 * 3, k = Math.min(2, Math.floor(q)), F = Math.floor((q - k) * FIT_LEN);       // bumpers, lamps, brightwork fitted in turn
      if (!drawFit(S, P, A.fits[k], ox, oy, scale, F, sfx)) put(A.fits[k].now); } }
  if (st === 8) { put(A.full); if (A.t % FR === 10) sfx('stamp'); if (A.t % FR === 70) sfx('start'); }
  if (st >= 9) { const dx = -Math.round(Math.min(1, (A.t - 9 * FR) / 90) * (W + 40)); put(A.full, dx); }
  // caption + progress strip
  bevel(S, 8, 200 + 40, W - 16, 22, C.oxblood, C.oxL, C.oxD); STAGES.forEach((nm, i) => { const x = 14 + i * 51; S.fill(x, 246, 46, 3, i < st ? C.brassL : i === st ? C.brass : C.oxD); });
  text(S, `${Math.min(9, st + 1)}/9  ${(A.uni ? STAGES_U : STAGES)[Math.min(8, st)]}${st === 4 && A.early ? ' - ASH FRAME + PANELS' : ''}`, 14, 252, C.brassL);
  A.t++; return st;
}
