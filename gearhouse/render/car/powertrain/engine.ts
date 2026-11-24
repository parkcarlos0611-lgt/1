// The engine (docs/systems/101, part 1-3), built from its specification in its own frame:
//   u  along the crank, from the bellhousing face (u = 0) to the accessory end (the pulleys)
//   v  across, the banks either side
//   w  up from the crank's centre
// Proportions by rule of thumb from the bore (render/car/enginemesh.ts, which this grew from: the same block, heads and
// belt drive, so the kit cars' engines keep their look): the bore from one cylinder's displacement, the pitch, the deck,
// the heads and covers from the bore. What the specification changes:
//   the block         a bank for an in-line engine, two for a V or a flat one; its metal's colour
//   the covers        two a bank over four or five valves a cylinder (two cams), one over two or three
//   the intake        one plenum over the vee with a throttle (a plenum a bank on eight cylinders and over); a variable
//                     intake's deep ribbed plenum with long runners and its actuator; a throttle and a trumpet a cylinder
//   the exhaust       a cast manifold a bank (grade 1) or tubular headers into a collector
//   the turbos        none to four, shared between the banks; each with its pod filter, its pipe to an intercooler
//                     standing beside the bank (when fitted) and on to the throttle; the turbines' pipes joined a bank
//   the lubrication   a wet sump's deep stepped pan, or a dry sump's shallow pan with its scavenge pump and its tank
// Every part has its own name. What the rest of the powertrain joins to is given back in the same frame: where the
// exhaust leaves each bank, the water's ports, the oil's, the places for the mounts.
import { Geo, add, circle, mul, norm, rsec, type V } from './geo';
import type { Detail, PowertrainSpec } from './spec';

export interface EngineOut {
  /** the bore (mm): the unit of the engine's proportions */ B: number;
  /** the block's end and the pulleys' (u) */ Lb: number; ue: number;
  /** where the exhaust leaves: a point and the way the gas goes, for each bank (or the one pipe of an in-line engine) */
  outlets: { p: V; d: V; r: number; side: number }[];
  /** the water's ports at the accessory end: out to the radiator, back from it */
  water: [V, V]; /** the oil's take-off (the filter's place), a dry sump's pump */ oil: V; pump: V | null;
  /** the mounts' places on the block, low at each side */ mounts: V[];
  /** half the width across the banks at the heads (without the exhaust), the cam covers' top, the sump's floor (w) */
  half: number; top: number; floor: number;
  /** the throttles' places (where the air comes in) */ throttles: V[];
}

const STEEL = '#b9bcc1', BELT = '#1a1a1a', HOSE = '#232326', SHIELD = '#c2c4c6', CAST = '#8b8780', HOT = '#6f5f53', ALU = '#c9cbcf', BLUED = '#6d6a80';

/** how far the crank sits under a wet-sump engine's when the sump is dry (in bores) */
export const DRY_DROP = 0.65;

export function buildEngine(g: Geo, S0: PowertrainSpec, det: Detail, transverse = false): EngineOut {
  const C = S0.colours, seg = det === 2 ? 10 : det === 1 ? 6 : 5, seg2 = det === 2 ? 8 : 5, pseg = det === 2 ? 5 : 4;   // round parts: large, small, pipes
  const banks = S0.layout === 'I' ? 1 : 2, nb = Math.ceil(S0.cylinders / banks);
  const half = (S0.layout === 'flat' ? 180 : S0.layout === 'V' ? S0.bankDeg : 0) / 2 * Math.PI / 180, cs = Math.cos(half), sn = Math.sin(half);
  // ---- proportions from the bore ----
  const B = 10.8 * Math.cbrt(S0.litres * 1000 / S0.cylinders);                       // a 500 cc cylinder: 86 mm
  const pitch = Math.min(118, Math.max(78, B * 1.12 + 4)), st = banks > 1 ? 0.3 * pitch : 0;
  const Hd = 2.5 * B, Hh = 1.25 * B, Hc = 0.42 * B, hw = 1.05 * B;                    // deck along the bank's axis, head and cover heights, head half width
  const u0 = 40, Lb = u0 + nb * pitch + st + 25;                                       // the first bore's start, the block's end (the timing case starts there)
  const cylU = (s: number, i: number) => u0 + (s < 0 ? st : 0) + (i + 0.5) * pitch;
  /** a point in bank s's frame: across (+ outward, falling) and along its axis (up from the crank) */
  const P = (s: number, u: number, across: number, along: number): V => [u, s * (across * cs + along * sn), -across * sn + along * cs];
  const ax = (s: number): V => [0, s * sn, cs], acr = (s: number): V => [0, s * cs, -sn];
  const S = banks > 1 ? [1, -1] : [1];
  const bankBox = (s: number, ua: number, ub: number, a0: number, a1: number, al0: number, al1: number, open = '') =>
    g.obox(P(s, (ua + ub) / 2, (a0 + a1) / 2, (al0 + al1) / 2), [1, 0, 0], (ub - ua) / 2, acr(s), (a1 - a0) / 2, ax(s), (al1 - al0) / 2, open);
  const bankU = (s: number): [number, number] => [u0 - 15 + (s < 0 ? st : 0), u0 + (s < 0 ? st : 0) + nb * pitch + 12];
  const topA = Hd + Hh + Hc;                                                           // the cam covers' top along the bank's axis
  const inner = (s: number, along: number) => P(s, 0, -hw, along);                     // the head's inner edge at that height
  const camTop = Math.max(...S.map(s => P(s, 0, -hw, topA)[2]), P(1, 0, hw, topA)[2]);
  const vee = banks > 1 && S0.layout === 'V', vin = vee ? Math.abs(inner(1, Hd + Hh)[1]) : 0;   // half the vee's opening at the heads' tops
  const crinkle = S0.crinkle ? 0.1 : 0.32, twin = S0.valves >= 4, turbos = S0.turbos, dry = S0.sump === 'dry';

  // ---- the block: crankcase, a block for each bank, the valley's floor, the flange the clutch housing bolts to ----
  g.part('engineBlock', C.block, 0.3);
  g.box(u0 - 20, Lb, -1.15 * B, 1.15 * B, -0.55 * B, 0.7 * B);
  for (const s of S) { const [ua, ub] = bankU(s); bankBox(s, ua, ub, -0.95 * B, 0.95 * B, 0.2 * B, Hd, '-3'); }
  if (vee) g.box(u0, Lb - 10, -vin * 0.55, vin * 0.55, 0.6 * B, inner(1, Hd)[2] - 0.1 * B, '-3');
  g.part('engineBlock', C.block, 0.25).prism([0, 0, 0.05 * B], [u0 - 20, 0, 0.05 * B], rsec(1.5 * B, 1.3 * B, det === 0 ? 6 : 8, 2.6), [0, 0, 1]);
  if (det === 2) { g.part('engineBlock', C.block, 0.2); for (const s of S) for (let i = 0; i + 1 < nb; i++) { const u = cylU(s, i) + pitch / 2; bankBox(s, u - 3, u + 3, 0.95 * B, 1.02 * B, 0.3 * B, Hd - 0.2 * B, '-2'); } }   // the block's ribs between the bores

  // ---- the sump: a wet sump's deep stepped pan, a dry sump's shallow pan (the crank sits lower over it), its pump and tank ----
  const floor = dry ? -(1.45 - DRY_DROP) * B : -1.45 * B;
  if (dry) { g.part('sump', C.block, 0.22).box(u0, Lb - 30, -0.95 * B, 0.95 * B, floor, -0.55 * B, '+3');
    if (det > 0) { g.part('oilPump', STEEL, 0.5, 'metal').cyl([Lb - 3.2 * B, -1.42 * B, -0.72 * B], [Lb - 0.2 * B, -1.42 * B, -0.72 * B], 0.3 * B, seg2); if (det === 2) for (let k = 0; k < 3; k++) g.cyl([Lb - (2.9 - k * 0.9) * B, -1.42 * B, -0.72 * B], [Lb - (2.7 - k * 0.9) * B, -1.42 * B, -0.72 * B], 0.36 * B, 6, false); }
  }
  else { const step = u0 + 0.42 * (Lb - 30 - u0);
    g.part('sump', C.block, 0.22).box(u0, step, -0.95 * B, 0.95 * B, floor, -0.55 * B, '+3').box(step, Lb - 30, -0.95 * B, 0.95 * B, -1.0 * B, -0.55 * B, '+3-1');
    if (det === 2) g.part('sump', '#2a2b2e', 0.4).cyl([u0 + 0.5 * (step - u0), -0.95 * B, floor + 0.2 * B], [u0 + 0.5 * (step - u0), -1.05 * B, floor + 0.2 * B], 0.12 * B, 6); }   // the drain plug
  // the filter: low on the timing case's corner
  const ue = Lb + 42, oil: V = [ue, 1.02 * B, -1.02 * B];
  if (det > 0) g.part('oilFilter', '#23427a', 0.45).lathe(oil, [1, 0, 0], [[0, 0.3 * B], [0.3 * B, 0.3 * B], [0.38 * B, 0.2 * B]], seg2, 'b');
  // the starter: against the flange, low on the side away from the pump
  if (det > 0) { g.part('starter', '#2b2c2f', 0.35).cyl([0.1 * B, 1.3 * B, -0.45 * B], [1.7 * B, 1.3 * B, -0.45 * B], 0.33 * B, seg2); if (det === 2) g.part('starter', STEEL, 0.5, 'metal').cyl([0.3 * B, 1.52 * B, -0.05 * B], [1.2 * B, 1.52 * B, -0.05 * B], 0.17 * B, 6); }

  // ---- heads, cam covers (two a bank over two cams, one over one), the coils over the plugs ----
  for (const s of S) { const [ua, ub] = bankU(s);
    g.part('cylinderHead', C.heads, 0.35); bankBox(s, ua, ub, -hw, hw, Hd, Hd + Hh, '-3');
    if (det === 0) { g.part('camCover', C.covers, crinkle); bankBox(s, ua + 8, ub - 8, -hw * 0.92, hw * 0.92, Hd + Hh, topA, '-3'); continue; }
    for (const k of twin ? [-1, 1] : [0]) { const off = k * 0.5 * B, wd = twin ? 0.36 * B : 0.7 * B, c0 = P(s, ua + 10, off, Hd + Hh + Hc / 2), c1 = P(s, ub - 10, off, Hd + Hh + Hc / 2);
      g.part('camCover', C.covers, crinkle).prism(c0, c1, rsec(wd, Hc / 2, twin ? 6 : 8, 3), ax(s));
      g.part('camCover', C.accent, 0.4).quad(P(s, ua + 40, off - 0.11 * B, topA + 1.5), P(s, ub - 40, off - 0.11 * B, topA + 1.5), P(s, ub - 40, off + 0.11 * B, topA + 1.5), P(s, ua + 40, off + 0.11 * B, topA + 1.5)); }
    // the plugs: between the two covers; under one cover on the exhaust side
    const pa = twin ? 0 : 0.86 * B;
    if (det === 2) { g.part('coilPack', '#121214', 0.2); for (let i = 0; i < nb; i++) { const u = cylU(s, i); bankBox(s, u - 0.22 * B, u + 0.22 * B, pa - 0.12 * B, pa + 0.12 * B, Hd + Hh - 4, twin ? topA + 6 : Hd + Hh + 0.3 * B, '-3'); } }
    else { g.part('coilPack', '#121214', 0.1).quad(P(s, ua + 15, pa - 0.12 * B, Hd + Hh + 1), P(s, ub - 15, pa - 0.12 * B, Hd + Hh + 1), P(s, ub - 15, pa + 0.12 * B, Hd + Hh + 1), P(s, ua + 15, pa + 0.12 * B, Hd + Hh + 1)); } }

  // ---- the accessory end: timing covers, pulleys, the belt, what the belt drives ----
  g.part('timingCover', C.covers === '#8e9195' || C.covers.toLowerCase() === '#a8191c' ? C.block : '#2a2b2e', 0.25);
  g.box(Lb, ue, -1.1 * B, 1.1 * B, dry ? floor : -1.3 * B, 0.7 * B, '-3');
  for (const s of S) { const [, ub] = bankU(s); bankBox(s, Lb - 2, Math.max(ue, ub + 30), -hw * 0.95, hw * 0.95, 0.2 * B, topA - 0.1 * B, '-3'); }
  const pul: { c: V; r: number }[] = [{ c: [0, 0, -0.35 * B], r: dry ? 0.7 * B : 0.85 * B }];
  if (det > 0) { pul.push({ c: P(1, 0, hw + 0.15 * B, 0.9 * Hd), r: 0.45 * B }); if (banks > 1 || det === 2) pul.push({ c: banks > 1 ? P(-1, 0, hw + 0.05 * B, 0.55 * Hd) : P(1, 0, -hw - 0.3 * B, 0.5 * Hd), r: 0.55 * B }); }
  if (det === 2) pul.push({ c: [0, 0, banks > 1 ? inner(1, Hd)[2] - 0.2 * B : 0.9 * Hd], r: 0.38 * B });
  const pu0 = ue, pu1 = ue + 0.38 * B;
  g.part('pulley', STEEL, 0.6, 'metal'); for (const p of pul) g.cyl([pu0, p.c[1], p.c[2]], [pu1, p.c[1], p.c[2]], p.r, p === pul[0] ? seg : seg2, true, [0, 0, 1]);
  if (pul.length > 1) { g.part('belt', BELT, 0.1);   // the belt round the pulleys' outsides, in the order round their middle
    const mv = pul.reduce((a, p) => a + p.c[1], 0) / pul.length, mw = pul.reduce((a, p) => a + p.c[2], 0) / pul.length, ring = [...pul].sort((a, c) => Math.atan2(a.c[2] - mw, a.c[1] - mv) - Math.atan2(c.c[2] - mw, c.c[1] - mv));
    for (let i = 0; i < ring.length; i++) { const a = ring[i]!, c = ring[(i + 1) % ring.length]!, dv = c.c[1] - a.c[1], dw = c.c[2] - a.c[2], l = Math.hypot(dv, dw) || 1;
      let nv = dw / l, nw = -dv / l; const mx = (a.c[1] + c.c[1]) / 2 - mv, mz = (a.c[2] + c.c[2]) / 2 - mw; if (nv * mx + nw * mz < 0) { nv = -nv; nw = -nw; }
      const um = (pu0 + pu1) / 2; g.bar([um, a.c[1] + nv * a.r, a.c[2] + nw * a.r], [um, c.c[1] + nv * c.r, c.c[2] + nw * c.r], 0.2 * B, 0.2 * B, false); } }
  if (det === 2 && pul.length > 2) { g.part('alternator', '#9c9fa4', 0.45, 'metal'); const p = pul[1]!; g.cyl([Lb - 1.6 * B, p.c[1], p.c[2]], [pu0 - 2, p.c[1], p.c[2]], p.r * 1.35, 8);
    if (S0.cylinders <= 8) { g.part('waterPump', '#8f9296', 0.4, 'metal'); const q = pul[2]!; g.cyl([Lb - 1.0 * B, q.c[1], q.c[2]], [pu0 - 2, q.c[1], q.c[2]], q.r * 1.25, 8); } }

  // ---- the exhaust: a cast manifold or a header from each port down and out to a collector along each bank, a heat shield over it ----
  const pipeR = 0.21 * B, colA = Hd * 0.45, colX = hw + 0.75 * B, colR = 0.33 * B, tubular = S0.grade >= 2;
  const perBank = S.map((_, k) => Math.ceil((turbos - k) / S.length));   // the turbos of each bank
  const outlets: EngineOut['outlets'] = [], comp: { top: V; s: number }[] = [];
  S.forEach((s, bi) => { const [ua, ub] = bankU(s), cu0 = ua + 10, cu1 = ub - 10, mid = (cu0 + cu1) / 2, nt = perBank[bi]!;
    g.part('exhaustManifold', tubular ? (S0.grade >= 3 ? BLUED : C.pipes) : '#4a4643', tubular ? 0.5 : 0.2, tubular ? 'metal' : 'plain');
    if (!tubular || det === 0 || (det === 1 && nb > 4)) g.obox(P(s, mid, hw + 0.35 * B, Hd * 0.75), [1, 0, 0], (cu1 - cu0) / 2, acr(s), 0.35 * B, ax(s), 0.3 * Hd);   // one casting
    else for (let i = 0; i < nb; i++) { const u = cylU(s, i), toward = mid - u, a = P(s, u, hw - 2, Hd + 0.4 * Hh), c = P(s, u + toward * 0.25, colX, colA);
      if (det === 2) g.tube(nb > 4 ? [a, P(s, u + toward * 0.06, hw + 0.62 * B, Hd + 0.2 * Hh), c] : [a, P(s, u, hw + 0.5 * B, Hd + 0.25 * Hh), P(s, u + toward * 0.12, colX + 0.05 * B, colA + 0.55 * B), c], pipeR, nb > 4 ? 4 : pseg); else g.tube([a, c], pipeR, 4); }
    if (det > 0) { g.part('exhaustManifold', tubular ? HOT : '#4a4643', 0.35, tubular ? 'metal' : 'plain').cyl(P(s, cu0, colX, colA), P(s, cu1, colX, colA), colR, 6, true);
      g.part('heatShield', SHIELD, 0.8, 'metal'); bankBox(s, cu0 + 15, cu1 - 15, colX - 0.45 * B, colX + 0.45 * B, colA + 0.4 * B, colA + 0.46 * B); }
    // where the gas leaves the bank: with no turbo, the collector's end by the flange (straight back), or under its middle on an engine set across the car
    const line = (u: number): V => P(s, u, colX + 0.6 * B, colA - 0.75 * B);
    if (nt === 0) { outlets.push(transverse ? { p: add(P(s, mid, colX, colA), [0, 0, -colR]), d: [0, 0, -1], r: colR * 0.95, side: s } : { p: P(s, cu0, colX, colA), d: [-1, 0, 0], r: colR * 0.95, side: s }); return; }
    // ---- the turbos beside the collector: the turbine (hot, toward the flange) and the compressor (bright, toward the pulleys) on one shaft along the crank ----
    const tr = 0.5 * B, cr = 0.56 * B; let far = Infinity;
    for (let k = 0; k < nt; k++) { const u = nt === 1 ? Math.max(mid, cu0 + 1.9 * B) : cu0 + 0.9 * B + (cu1 - cu0 - 1.4 * B) * (0.12 + 0.76 * k), c = P(s, u, colX + 0.62 * B, colA + 0.55 * B), X = (du: number, r = 0, a = 0): V => add(add(c, [du, 0, 0]), add(mul(acr(s), r * Math.cos(a)), mul(ax(s), r * Math.sin(a))));
      if (det === 0) { g.part('turbo', CAST, 0.5, 'metal').cyl(X(-0.5 * B), X(0.5 * B), 0.55 * B, 5); }
      else { const ts = det === 2 && turbos <= 2 ? 8 : 6;
        g.part('turbo', HOT, 0.35, 'metal').lathe(X(-0.6 * B), [1, 0, 0], [[0, tr * 0.55], [0.08 * B, tr], [0.5 * B, tr]], ts, true);        // the turbine's housing
        g.part('turbo', CAST, 0.4, 'metal').cyl(X(-0.06 * B), X(0.1 * B), 0.26 * B, 6, false);                                                                       // the bearings between
        g.part('turbo', ALU, 0.7, 'metal').lathe(X(0.08 * B), [1, 0, 0], [[0, cr], [0.36 * B, cr], [0.46 * B, cr * 0.48], [0.72 * B, cr * 0.46]], ts, true);   // the compressor's, its inlet's stub
        g.part('exhaustManifold', HOT, 0.35, 'metal').tube([P(s, u - 0.32 * B, colX, colA), X(-0.32 * B, tr * 0.8, -1.9)], colR * 0.8, 4);                           // the collector up into the turbine
        if (det === 2) { if (turbos <= 2) g.part('wastegate', STEEL, 0.6, 'metal').lathe(X(-0.35 * B, tr + 0.2 * B, 0.5), acr(s), [[0, 0.2 * B], [0.3 * B, 0.2 * B], [0.36 * B, 0.1 * B]], 6, true);
          g.part('airFilter', '#9b2a22', 0.25).lathe(X(0.8 * B), [1, 0, 0], [[0, cr * 0.5], [0.1 * B, cr * 0.72], [0.75 * B, cr * 0.55]], 6, 'b'); } }
      comp.push({ top: X(0.26 * B, cr * 0.85, Math.PI * 0.75), s });
      // the turbine's pipe: out along the shaft, then down to the bank's line under the turbos
      const e0 = X(-0.6 * B), e1 = line(u - 2.1 * B); far = Math.min(far, u - 2.1 * B);
      g.part('exhaustDownpipe', HOT, 0.35, 'metal'); if (det === 0) g.tube([e0, e1], colR, 4); else g.bend(e0, [-1, 0, 0], e1, [-1, 0, 0], colR * 0.95, pseg, 3, 0.5);
      if (k > 0) g.tube([line(u - 2.1 * B), line(far + 0.01)], colR * 0.95, pseg); }
    outlets.push({ p: line(far), d: [-1, 0, 0], r: colR, side: s }); });
  // a bank with no turbo of its own (one turbo, or three): its collector's pipe goes across behind the flange to the other bank's turbine
  if (turbos > 0 && S.length > 1) S.forEach((s, bi) => { if (perBank[bi]! > 0) return; const i = outlets.findIndex(o => o.side === s), o = outlets[i]!; outlets.splice(i, 1);
    const [ua] = bankU(-s), to = P(-s, ua + 10, colX, colA), from = P(s, bankU(s)[0] + 10, colX, colA); void o;
    g.part('exhaustManifold', HOT, 0.35, 'metal'); g.tube([from, [-0.45 * B, from[1], from[2]], [-0.75 * B, from[1] * 0.75, 1.75 * B], [-0.75 * B, to[1] * 0.75, 1.75 * B], [-0.45 * B, to[1], to[2]], to], colR * 0.85, pseg); });

  // ---- the intake ----
  const plTop = camTop + (S0.intake === 'itb' && turbos === 0 ? 0.85 * B : banks > 1 && S0.cylinders <= 6 && S0.intake !== 'variable' ? 0.75 * B : S0.intake === 'variable' ? 0.95 * B : 0.55 * B);
  const plenum = () => g.part('intakePlenum', C.plenum, S0.grade >= 4 ? 0.4 : crinkle), labels: [V, V, V, V][] = [];
  const pl0 = u0 + 0.15 * pitch, pl1 = Lb - 0.1 * pitch;
  const port = (s: number, i: number) => P(s, cylU(s, i), -hw + 2, Hd + 0.55 * Hh), sv = (s: number) => banks > 1 ? s : 1;
  const itb = S0.intake === 'itb', one = banks === 1 || S0.intake === 'variable' || S0.cylinders <= 6;
  let tbAt: V[] = [];
  if (itb && turbos === 0) {   // a throttle and a trumpet a cylinder, their linkage and the fuel rail along each row
    const lean = vee && S0.bankDeg >= 75 ? 0.16 : 0;
    for (const s of S) { const d = norm([0, banks > 1 ? -s * lean : 0, 1]), at = (i: number, k: number): V => add(port(s, i), mul(d, k * B));
      for (let i = 0; i < nb; i++) { if (det === 0) { g.part('intakeTrumpet', ALU, 0.75, 'metal').cyl(at(i, 0), at(i, 1.3), 0.32 * B, 5); continue; }
        g.part('throttleBody', STEEL, 0.55, 'metal').cyl(at(i, 0), at(i, 0.55), 0.3 * B, det === 2 ? 6 : 5, false);
        g.part('intakeTrumpet', ALU, 0.8, 'metal').lathe(at(i, 0.55), d, [[0, 0.27 * B], [0.55 * B, 0.28 * B], [0.8 * B, 0.36 * B], [0.9 * B, 0.45 * B]], det === 2 ? 7 : 5, false);
        if (det === 2) g.part('intakeTrumpet', '#0e0e10', 0.05).fan(g.ring(at(i, 1.0), d, circle(0.27 * B, 7))); }
      if (det > 0) { g.part('throttleLinkage', STEEL, 0.6, 'metal').bar(add(at(0, 0.3), [-0.3 * B, -sv(s) * 0.36 * B, 0]), add(at(nb - 1, 0.3), [0.3 * B, -sv(s) * 0.36 * B, 0]), 0.07 * B, 0.07 * B);
        g.part('fuelRail', '#a02a22', 0.5, 'metal').bar(add(at(0, 0.12), [-0.3 * B, sv(s) * 0.4 * B, 0]), add(at(nb - 1, 0.12), [0.3 * B, sv(s) * 0.4 * B, 0]), 0.14 * B, 0.14 * B); } }
    tbAt = []; }
  else if (one) {   // one plenum over the vee (beside an in-line engine's head): deep and ribbed, with long runners, when the intake's length varies
    const vari = S0.intake === 'variable', hwP = banks > 1 ? Math.max(1.3 * B, vin * 0.95) * (vari ? 1.08 : 1) : 0.9 * B, hh = (plTop - camTop) * 0.5 + 0.25 * B, wc = plTop - hh, vc = banks > 1 ? 0 : -(hw + 0.7 * B);
    plenum().prism([pl0, vc, wc], [pl1, vc, wc], rsec(hwP, hh, det === 0 ? 6 : det === 1 ? 10 : 16, vari ? 5.5 : 4.5), [0, 0, 1]);
    if (vari && det > 0) { for (const k of det === 2 ? [-0.6, -0.2, 0.2, 0.6] : [-0.4, 0.4]) g.box(pl0 + 0.12 * (pl1 - pl0), pl0 + 0.88 * (pl1 - pl0), vc + k * hwP - 0.06 * B, vc + k * hwP + 0.06 * B, plTop - 2, plTop + 0.09 * B, '-3');   // its ribs
      g.part('intakeActuator', '#b08a3c', 0.55, 'metal').lathe([pl0 - 0.05 * B, vc + hwP * 0.45, wc - hh * 0.2], [-1, 0, 0], [[0, 0.12 * B], [0.1 * B, 0.3 * B], [0.42 * B, 0.3 * B], [0.5 * B, 0.12 * B]], 6, true); }
    else labels.push([[pl0 + 0.25 * (pl1 - pl0), vc - hwP * 0.4, plTop + 1.5], [pl0 + 0.75 * (pl1 - pl0), vc - hwP * 0.4, plTop + 1.5], [pl0 + 0.75 * (pl1 - pl0), vc + hwP * 0.4, plTop + 1.5], [pl0 + 0.25 * (pl1 - pl0), vc + hwP * 0.4, plTop + 1.5]]);
    if (det > 0) for (const s of S) for (let i = 0; i < nb; i++) { const e = port(s, i), a: V = [e[0], vc + sv(s) * hwP * 0.72, wc - hh * 0.3], out = vari ? 0.3 * B : 0;
      g.part('intakeRunner', vari ? ALU : C.plenum, vari ? 0.6 : crinkle, vari ? 'metal' : 'plain');
      g.tube(det === 1 ? [a, e] : [a, [e[0], a[1] + (e[1] - a[1]) * 0.3 + sv(s) * out, a[2] - (a[2] - e[2]) * 0.5], [e[0], a[1] + (e[1] - a[1]) * 0.8 + sv(s) * out, e[2] + (a[2] - e[2]) * 0.14], e], 0.24 * B, S0.cylinders > 8 ? 4 : pseg);
      if (itb && det === 2) g.part('throttleBody', STEEL, 0.55, 'metal').cyl(add(e, [0, 0, 0.2 * B]), add(e, [0, 0, 0.5 * B]), 0.3 * B, 6, false); }
    tbAt = [[pl1, vc, wc]]; }
  else {   // a plenum along each bank, its runners down to the ports
    const sec = rsec(0.5 * B, 0.36 * B, det === 0 ? 6 : det === 1 ? 8 : 10, 3.5);
    for (const s of S) { const vc = s * Math.max(vin * 0.78, 0.7 * B), wc = plTop - 0.36 * B;
      plenum().prism([pl0, vc, wc], [pl1, vc, wc], sec, [0, 0, 1]);
      labels.push([[pl0 + 0.2 * (pl1 - pl0), vc - 0.2 * B, plTop + 1.5], [pl0 + 0.8 * (pl1 - pl0), vc - 0.2 * B, plTop + 1.5], [pl0 + 0.8 * (pl1 - pl0), vc + 0.2 * B, plTop + 1.5], [pl0 + 0.2 * (pl1 - pl0), vc + 0.2 * B, plTop + 1.5]]);
      if (det > 0) for (let i = 0; i < nb; i++) { const e = port(s, i), a: V = [e[0], vc - s * 0.3 * B, wc], arc: V = [e[0], (vc + e[1]) / 2 - s * 0.25 * B, (wc + e[2]) / 2];
        g.part('intakeRunner', C.plenum, crinkle).tube(det === 1 ? [a, e] : [a, arc, e], 0.22 * B, 4);
        if (itb && det === 2) g.part('throttleBody', STEEL, 0.55, 'metal').cyl(add(e, mul(norm([0, a[1] - e[1], a[2] - e[2]]), 0.15 * B)), add(e, mul(norm([0, a[1] - e[1], a[2] - e[2]]), 0.45 * B)), 0.28 * B, 5, false); }
      tbAt.push([pl1, vc, wc]); } }
  if (S0.label) { g.part('intakeLabel', C.label, 0.3); for (const q of labels) g.quad(...q); }
  // the throttle at the accessory end of each plenum; the air's way in with no turbo: a hose to an airbox beside one plenum, an airbox between two
  if (!(itb && turbos > 0)) { g.part('throttleBody', STEEL, 0.7, 'metal'); for (const t of det === 0 ? tbAt.slice(0, 1) : tbAt) g.cyl(t, [t[0] + 0.55 * B, t[1], t[2]], 0.38 * B, seg2, true); }
  if (det > 0 && turbos === 0 && tbAt.length === 2) { const ab0 = Lb - 1.4 * pitch, ab1 = ue + 0.2 * B;
    g.part('airbox', '#18181a', 0.15).box(ab0, ab1, -vin * 0.55, vin * 0.55, camTop - 0.1 * B, plTop + 0.2 * B, '-3');
    g.part('airbox', '#2b2b2e', 0.1).box(ab0 + 0.2 * B, ab1 - 0.2 * B, -vin * 0.42, vin * 0.42, plTop + 0.2 * B, plTop + 0.32 * B, '-3'); }
  if (det > 0 && turbos === 0 && tbAt.length === 1) { const t = tbAt[0]!, tip: V = [t[0] + 0.55 * B, t[1], t[2]], side = banks > 1 ? -1 : 1, bx: V = [ue + 0.1 * B, side * (vin + 0.2 * B), camTop + 0.15 * B];
    g.part('intakeHose', HOSE, 0.15); if (det === 2) g.bend(tip, [1, 0, 0], bx, [-0.2, side, -0.3], 0.36 * B, 8, 4, 0.55); else g.tube([tip, bx], 0.3 * B, 4);
    g.part('airbox', '#18181a', 0.15).box(bx[0] - 1.3 * B, bx[0] + 0.5 * B, bx[1] - side * 0.1 * B, bx[1] + side * 1.6 * B, bx[2] - 0.6 * B, bx[2] + 0.5 * B, '-3'); }

  // ---- the charge air: each compressor up to an intercooler standing beside its bank (when fitted), on to the throttle ----
  if (comp.length) { const into = (s: number): V => { const t = tbAt.find(q => Math.sign(q[1]) === s) ?? tbAt[0]!; return [t[0] + 0.55 * B, t[1], t[2]]; };
    const reach = Math.max(...comp.map(c => Math.abs(c.top[1]))) + 0.75 * B, sides = S.filter(s => comp.some(c => c.s === s));
    for (const s of sides) { const mine = comp.filter(c => c.s === s), end = into(s);
      if (S0.intercooler) { const i0 = Lb - 1.9 * B, i1 = Lb + 0.3 * B, ic: V = [(i0 + i1) / 2, s * reach, mine[0]!.top[2] + 0.5 * B], ih = 0.85 * B, it = 0.26 * B;
        g.part('intercooler', '#4b4f55', 0.3, 'metal').box(i0, i1, ic[1] - it, ic[1] + it, ic[2] - ih, ic[2] + ih);
        if (det > 0) { g.part('intercooler', ALU, 0.65, 'metal').box(i0 - 0.3 * B, i0, ic[1] - it * 1.15, ic[1] + it * 1.15, ic[2] - ih, ic[2] + ih).box(i1, i1 + 0.3 * B, ic[1] - it * 1.15, ic[1] + it * 1.15, ic[2] - ih, ic[2] + ih);
          if (det === 2) { g.part('intercooler', '#2c2f33', 0.3, 'metal'); for (let k = 1; k < 5; k++) { const w = ic[2] - ih + k * ih * 0.4, yo = ic[1] + s * (it + 1.5); g.quad([i0, yo, w - 3], [i1, yo, w - 3], [i1, yo, w + 3], [i0, yo, w + 3]); } } }
        g.part('boostPipe', ALU, 0.75, 'metal');
        for (const m of mine) { const tank: V = [i0 - 0.15 * B, ic[1], ic[2] - ih * 0.5]; if (det === 0) g.tube([m.top, tank], 0.18 * B, 4); else g.bend(m.top, add(mul(acr(s), -0.2), [0.2, 0, 1]), tank, [0.6, s * 0.8, 0.2], 0.18 * B, 4, 3, 0.45); }
        const out: V = [i1 + 0.15 * B, ic[1], ic[2] + ih * 0.6]; if (det === 0) g.tube([out, end], 0.2 * B, 4); else g.bend(out, [0.3, 0, 1], end, [-1, 0, 0], 0.2 * B, pseg, det === 2 ? 5 : 4, 0.6); }
      else { g.part('boostPipe', ALU, 0.75, 'metal'); for (const m of mine) { if (det === 0) g.tube([m.top, end], 0.18 * B, 4); else g.bend(m.top, [0.3, s * 0.3, 1], end, [-1, 0, 0], 0.19 * B, pseg + 1, det === 2 ? 6 : 4, 0.7); } } }
    // a throttle no intercooler feeds (one turbo under two plenums): a pipe across from the other
    if (tbAt.length === 2 && sides.length === 1 && det > 0) { const a = into(sides[0]!), c = into(-sides[0]!); g.part('boostPipe', ALU, 0.75, 'metal').tube([a, [a[0] + 0.35 * B, a[1] * 0.6, a[2]], [c[0] + 0.35 * B, c[1] * 0.6, c[2]], c], 0.19 * B, pseg + 1); }
    if (itb && det > 0) { g.part('throttleBody', STEEL, 0.7, 'metal'); for (const t of tbAt) g.cyl(t, [t[0] + 0.55 * B, t[1], t[2]], 0.34 * B, seg2, true); } }

  // ---- the water: the thermostat's housing over the valley's front, the pump's inlet low beside the crank's pulley ----
  const wOut: V = [ue + 0.1 * B, 0, (vee ? inner(1, Hd)[2] : 0.9 * Hd) + 0.55 * B], wIn: V = [ue + 0.1 * B, -1.0 * B, 0.15 * B];
  if (det > 0) { g.part('thermostat', '#9ea1a5', 0.4, 'metal').box(Lb - 0.5 * B, ue + 0.1 * B, -0.3 * B, 0.3 * B, wOut[2] - 0.28 * B, wOut[2] + 0.28 * B); }
  // ---- details: fuel rails, a water pipe across, the oil filler, the dipstick ----
  if (det === 2) {
    if (!(itb && turbos === 0)) { g.part('fuelRail', STEEL, 0.7, 'metal'); for (const s of S) { const [ua, ub] = bankU(s); g.bar(P(s, ua + 20, -hw - 0.15 * B, Hd + 0.85 * Hh), P(s, ub - 20, -hw - 0.15 * B, Hd + 0.85 * Hh), 0.16 * B, 0.16 * B); } }
    if (banks > 1) g.part('coolantHose', HOSE, 0.15).tube([[Lb - 0.2 * B, -vin * 0.6, camTop - 0.3 * B], [ue + 0.02 * B, -vin * 0.3, wOut[2]], [ue + 0.02 * B, vin * 0.3, wOut[2]], [Lb - 0.2 * B, vin * 0.6, camTop - 0.3 * B]], 0.13 * B, 5);
    g.part('oilFiller', '#d0c020', 0.4); { const c = P(1, cylU(1, nb - 1), twin ? 0.5 * B : 0, topA); g.cyl(c, add(c, mul(ax(1), 0.25 * B)), 0.28 * B, 6, true, [1, 0, 0]); }
    if (!dry) { g.part('dipstick', '#e2a21a', 0.4); const c = P(S[S.length - 1]!, cylU(S[S.length - 1]!, 0), hw + 0.2 * B, Hd * 0.9); g.bar(c, add(c, [0, 0, 0.35 * B]), 0.12 * B); } }
  const mounts: V[] = [1, -1].map(s => [u0 + 0.35 * (Lb - u0), s * 1.15 * B, -0.2 * B]);
  return { B, Lb, ue, outlets, water: [wOut, wIn], oil, pump: dry ? [Lb - 3.2 * B, -1.42 * B, -0.72 * B] : null, mounts, half: Math.max(...S.map(s => Math.abs(P(s, 0, hw, Hd + Hh)[1])), 1.15 * B), top: plTop, floor, throttles: tbAt };
}
