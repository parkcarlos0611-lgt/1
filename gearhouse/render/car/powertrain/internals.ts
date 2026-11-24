// The engine's insides for the workshop's cutaway (절단 보기, alpha 0.12 follow-up): the crankshaft with its throws, the
// connecting rods, the pistons with their rings, the bores, the camshafts with a lobe a valve, the valves and the spark
// plugs, built from the specification in the engine's own frame (engine.ts engineDims: u along the crank from the
// flange, v across, w up) and set in motion by the crank's angle alone.
//   the crank        each layout's own throws (crankPins): an in-line four's flat plane (0/180), an in-line six's 120,
//                    the boxers' opposed pairs (each piston its own pin, a pair's pins 180 apart), a V6's split pins
//                    (split 120 - the vee: 60 on a 60-degree vee, 30 on a 90-degree one, even firing) or common pins (a
//                    90-degree V6's odd firing, 90/150), a V8's flat plane (the F355's) or cross plane (0/90/270/180),
//                    a V10's five throws 72 apart, a V12's six like an in-line six; the two rods of a V share a pin
//   the firing       found from the throws (fireAngles): each cylinder reaches the top on its compression stroke at
//                    one of its two tops in the 720 degrees; of the 2^(n-1) ways the evenest is taken (the most even
//                    largest gap, then the banks taking turns most often), so the even engines fire every 720 / n and
//                    the odd ones as they really do
//   the motion       the slider-crank: the piston pin x(φ) = r cos φ + sqrt(l² - r² sin² φ) up the bank's axis from the
//                    crank (r half the stroke, l the rod: 1.7 strokes, shortened where the deck would not hold it), the rod
//                    from the crank pin to the piston pin; the cams turn at half the crank's speed
//   the valves       simple timing in crank degrees from the firing top (0 = compression top): the exhaust opens 50 before
//                    the bottom (130) and closes 15 after the top (375), the intake opens 15 before that top (345) and
//                    closes 50 after the bottom (590); the lift sin² over the opening (smooth at both ends), the lobe's
//                    radius drawn to the same profile (the lift follows the lobe's radius toward the tappet)
//   the spark        20 degrees before the firing top (plugGlint: the workshop's small flash)
// Proportions: the design's own bore and stroke from its displacement and bore/stroke ratio, the bore held under 0.86 of
// the block's pitch (an engine drawn by rule of thumb has no room for more), the stroke under what the deck holds with a
// rod of at least 1.38 strokes. Every moving part hangs on a bone (the suspension's way, render/car/suspension: one draw):
// the crank, each piston, each rod, each cylinder's intake valves, its exhaust valves, each camshaft; bone 0 stands still.
// The bones fit the shader's limit (ENGINE_BONES: a V12 with four cams and four valves a cylinder is the most).
import { Geo, add, mul, norm, sub, type V } from './geo';
import { engineDims } from './engine';
import type { Build } from '../mesh';
import type { Detail, PowertrainSpec } from './spec';

export type CrankKind = 'flat' | 'cross' | 'split' | 'common';
/** the most bones an engine's insides need (a V12, four valves a cylinder, two cams a bank): the still one, the crank,
 *  four a cylinder (piston, rod, intake valves, exhaust valves), four cams. The live renderer sizes its bones by this. */
export const ENGINE_BONES = 1 + 1 + 4 * 12 + 4;
/** the valves' timing (crank degrees from the firing top) and the spark's advance */
export const TIMING = { exOpen: 130, exClose: 375, inOpen: 345, inClose: 590, spark: 20 } as const;
/** the four strokes, by a cylinder's own angle from its firing top: 0..180 power, ..360 exhaust, ..540 intake, ..720 compression */
export const STROKES = ['폭발', '배기', '흡입', '압축'] as const;

const mod = (a: number, m: number) => ((a % m) + m) % m;
const RAD = Math.PI / 180;

// ---- the crank and the firing ----
/** each cylinder's bank (+1 the bank toward +v, -1 the other), its place along its bank (0 at the flange), its crank
 *  pin's angle (degrees about the crank, from straight up toward +v, at crank angle 0) */
export interface CylPin { s: number; i: number; pin: number }
/** the crank's throws as each layout has them (see the head of this file) */
export function crankPins(layout: PowertrainSpec['layout'], n: number, bankDeg: number, kind?: CrankKind): CylPin[] {
  const banks = layout === 'I' ? 1 : 2, nb = Math.ceil(n / banks), out: CylPin[] = [];
  const row = (k: number): number[] => k === 4 ? [0, 180, 180, 0] : k === 6 ? [0, 240, 120, 120, 240, 0] : k === 2 ? [0, 180] : k === 3 ? [0, 120, 240] : k === 5 ? [0, 144, 288, 72, 216] : Array.from({ length: k }, (_, i) => i * 360 / k);
  if (layout === 'I') { row(n).forEach((p, i) => out.push({ s: 1, i, pin: p })); return out; }
  if (layout === 'flat') { const r = nb === 2 ? [0, 180] : nb === 3 ? [0, 120, 240] : row(nb); r.forEach((p, i) => { out.push({ s: 1, i, pin: p }); out.push({ s: -1, i, pin: p + 180 }); }); return out; }
  // a V: the throws by the count, the second bank's pin split from the first's (0: shared)
  const A = nb === 3 ? [0, 120, 240] : nb === 4 ? (kind === 'flat' ? [0, 180, 180, 0] : [0, 90, 270, 180]) : row(nb);
  const split = nb === 3 && kind !== 'common' ? 120 - bankDeg : 0;
  A.forEach((p, i) => { out.push({ s: 1, i, pin: p }); out.push({ s: -1, i, pin: p + split }); }); return out; }

/** each cylinder's firing top (crank degrees 0..720) from its pin and its bank's axis: of the two tops a cylinder has in
 *  the cycle, the ones that space the firing most evenly (see the head). The crank is turned on itself by `shift` so the
 *  first firing falls at 0: add it to every pin. */
export function fireAngles(cyl: CylPin[], bankDeg: number, layout: PowertrainSpec['layout']): { fire: number[]; shift: number } {
  const half = layout === 'I' ? 0 : layout === 'flat' ? 90 : bankDeg / 2, n = cyl.length;
  const T = cyl.map(c => mod(c.s * half - c.pin, 360));
  let best: number[] = [], score = [Infinity, -Infinity];
  for (let m = 0; m < 1 << (n - 1); m++) { const F = T.map((t, k) => k > 0 && (m >> (k - 1)) & 1 ? t + 360 : t), ord = F.map((f, k) => [f, k] as const).sort((a, b) => a[0] - b[0]);
    let gap = 0, turns = 0; for (let j = 0; j < n; j++) { const a = ord[j]!, b = ord[(j + 1) % n]!; gap = Math.max(gap, mod(b[0] - a[0], 720) || 720); if (cyl[a[1]]!.s !== cyl[b[1]]!.s) turns++; }
    if (gap < score[0]! - 1e-6 || (Math.abs(gap - score[0]!) < 1e-6 && turns > score[1]!)) { score = [gap, turns]; best = F; } }
  const f0 = Math.min(...best); return { fire: best.map(f => mod(f - f0, 720)), shift: f0 }; }
/** the gaps between the firings in their order (degrees), the order (indices into the cylinders) */
export function firingGaps(F: number[]): { gaps: number[]; order: number[] } { const order = F.map((_, k) => k).sort((a, b) => F[a]! - F[b]!);
  return { order, gaps: order.map((k, j) => mod(F[order[(j + 1) % order.length]!]! - F[k]!, 720) || 720) }; }

// ---- the motion ----
/** the piston pin's distance from the crank up its bank's axis at the cylinder's crank angle φ (degrees from its top) */
export const pistonX = (r: number, l: number, phi: number) => { const a = phi * RAD, s = r * Math.sin(a); return r * Math.cos(a) + Math.sqrt(l * l - s * s); };
/** a valve's lift at a cylinder's own angle ψ from its firing top (degrees): sin² over its opening */
export function valveLift(psi: number, open: number, close: number, Lmax: number): number { const t = mod(psi - open, 720) / (close - open); return t >= 1 ? 0 : Lmax * Math.sin(Math.PI * t) ** 2; }

export interface InternalCyl { s: number; i: number; u: number; /** the bank's axis (degrees from up toward +v) */ beta: number; pin: number; fire: number; /** its number as shown (each bank from the pulleys' end, the +v bank first) */ no: number;
  bones: { piston: number; rod: number; inV: number; exV: number }; /** the intake's and the exhaust's opening direction (a unit vector, engine frame) */ inD: V; exD: V; /** the plug's tip (the mesh's frame) */ plug: V }
export interface EngineRig { /** the engine frame's origin in the mesh's */ off: V; r: number; l: number; bore: number; stroke: number; ch: number; deck: number; /** the valves' seats (along the bank's axis) and their tilt */ seat: number; tilt: number; lift: number;
  cyl: InternalCyl[]; cams: { c: V; bone: number; /** its bank, its side (-1 the intake's, 1 the exhaust's, 0 one cam for both) */ s: number; side: number }[]; bones: number; crank: CrankKind | null; order: string }

/** the design's bore and stroke (mm) from its displacement and bore/stroke ratio (as the designer's sheet has them) */
export function boreStroke(cc: number, n: number, bs: number): { bore: number; stroke: number } { const st = Math.cbrt(cc / n / (Math.PI / 4 * bs * bs)) * 10; return { bore: bs * st, stroke: st }; }

// ---- the parts, built at crank angle 0 (the valves shut) ----
const STEEL = '#8d9196', FORGED = '#6f7378', ALU = '#c6c8cb', RING = '#2f3134', VALVE = '#b5b2aa', CAM = '#7d8187', BUCKET = '#9a9ea3', PLUG = '#ece9df', HEX = '#a6a9ad';

/** the insides built into `b` (each bone's parts in turn: `boneOf` gets each triangle's bone), the still parts (bores, plugs)
 *  into `still`, and the rig that poses them; `off` the engine frame's origin in the mesh */
export function buildInternals(b: Build, still: Geo, S: PowertrainSpec, o: { cc: number; bs: number; crank?: CrankKind; det?: Detail; off: V }): { rig: EngineRig; bone: number[] } {
  const D = engineDims(S), { B, pitch, st, Hd, Hh, P, ax, acr, nb } = D, n = S.cylinders, det = o.det ?? 2;
  const seg = n >= 10 ? 8 : n >= 8 ? 10 : 12, sseg = n >= 10 ? 5 : 6, lseg = det === 2 ? (n >= 10 ? 14 : 18) : 12;
  const real = boreStroke(o.cc, n, o.bs), bore = Math.min(real.bore, 0.86 * pitch), R = bore / 2, ch = 0.3 * bore, gap = 0.035 * bore;
  const stroke = Math.min(real.stroke, (Hd - ch - gap) / (0.5 + 1.38)), r = stroke / 2, l = Math.min(1.7 * stroke, Hd - r - ch - gap), pistonH = 0.72 * bore;
  const kind: CrankKind | null = S.layout === 'V' && n === 8 ? (o.crank === 'flat' ? 'flat' : 'cross') : S.layout === 'V' && n === 6 ? (o.crank === 'common' ? 'common' : 'split') : null;
  const pins0 = crankPins(S.layout, n, S.bankDeg, kind ?? undefined), { fire, shift } = fireAngles(pins0, S.bankDeg, S.layout), pins = pins0.map(c => ({ ...c, pin: mod(c.pin + shift, 360) })), halfDeg = D.half / RAD;
  const twin = S.valves >= 4, tilt = (twin ? 20 : 12) * RAD, Lmax = 0.11 * bore, rc = 0.16 * bore, bh = 0.12 * bore, wRod = st > 0 ? Math.min(0.24 * pitch, st - 3) : 0.3 * pitch;
  const off = o.off; still.frame((p: V): V => [p[0] + off[0], p[1] + off[1], p[2] + off[2]]); const T = (p: V): V => [p[0] + off[0], p[1] + off[1], p[2] + off[2]], yz = (a: number, rr: number): V => [0, rr * Math.sin(a * RAD), rr * Math.cos(a * RAD)];
  const bone: number[] = []; let nb0 = 0;
  const emit = (g: Geo, k: number) => { g.emit(b); const t = b.mark() / 9; for (; nb0 < t; nb0++) bone.push(k); };
  const geo = () => new Geo().frame(T);
  const cyls: InternalCyl[] = pins.map((c, k) => ({ s: c.s, i: c.i, u: D.cylU(c.s, c.i), beta: c.s * halfDeg, pin: c.pin, fire: fire[k]!, no: (c.s > 0 ? 0 : nb) + (nb - c.i),
    bones: { piston: 0, rod: 0, inV: 0, exV: 0 }, inD: [0, 0, 0], exD: [0, 0, 0], plug: [0, 0, 0] }));
  let nextBone = 1;
  // ---- the crankshaft: the main journals, a web either side of each throw (its arm and its counterweight, a convex
  // outline), a thin web between a throw's two pins where they are split, the snout to the pulleys, the flange ----
  { const g = geo().part('crankshaft', FORGED, 0.55, 'metal'), rj = 0.27 * bore, rp = 0.2 * bore, tw = 0.1 * pitch, skirt = l - r + ch - pistonH, cw = Math.max(r + rp, Math.min(r + 0.3 * bore, skirt - 0.05 * bore));
    const hull = (pts: [number, number][]): [number, number][] => { const P2 = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o: [number, number], a: [number, number], c: [number, number]) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
      const lo: [number, number][] = [], up: [number, number][] = []; for (const p of P2) { while (lo.length >= 2 && cr(lo[lo.length - 2]!, lo[lo.length - 1]!, p) <= 0) lo.pop(); lo.push(p); }
      for (const p of P2.reverse()) { while (up.length >= 2 && cr(up[up.length - 2]!, up[up.length - 1]!, p) <= 0) up.pop(); up.push(p); } return [...lo.slice(0, -1), ...up.slice(0, -1)]; };
    const sec = (a: number, rr: number): [number, number] => [rr * Math.sin(a * RAD), rr * Math.cos(a * RAD)];
    const circ = (a: number, rr: number, k = 8): [number, number][] => { const c = sec(a, rr), out: [number, number][] = []; for (let j = 0; j < k; j++) { const t = j / k * Math.PI * 2; out.push([c[0] + 1.25 * rp * Math.cos(t), c[1] + 1.25 * rp * Math.sin(t)]); } return out; };
    const web = (u0: number, u1: number, angs: number[], counter: boolean) => { const pts: [number, number][] = []; for (const a of angs) pts.push(...circ(a, r));
      for (let j = 0; j < 8; j++) { const t = j / 8 * Math.PI * 2; pts.push([rj * 1.15 * Math.cos(t), rj * 1.15 * Math.sin(t)]); }
      if (counter) { const m = angs.reduce((s, a) => s + a, 0) / angs.length + 180; for (let k = -3; k <= 3; k++) pts.push(sec(m + k * 22, cw)); }
      g.prism([u0, 0, 0], [u1, 0, 0], hull(pts), [0, 0, 1]); };
    const throws = Array.from({ length: nb }, (_, i) => cyls.filter(c => c.i === i).sort((a, b) => a.u - b.u));
    let uPrev = D.u0 - 22; g.cyl([uPrev - 14, 0, 0], [uPrev, 0, 0], 0.45 * bore, seg);   // the flange the flywheel bolts to
    for (const th of throws) { const ua = th[0]!.u - wRod / 2, ub = th[th.length - 1]!.u + wRod / 2;
      g.cyl([uPrev, 0, 0], [ua - tw, 0, 0], rj, seg, false);                                                   // the main journal
      web(ua - tw, ua, [th[0]!.pin], true); web(ub, ub + tw, [th[th.length - 1]!.pin], true);
      for (let j = 0; j < th.length; j++) { const c = th[j]!; g.cyl(add([c.u - wRod / 2, 0, 0], yz(c.pin, r)), add([c.u + wRod / 2, 0, 0], yz(c.pin, r)), rp, seg, true);   // the crank pin
        const nx = th[j + 1]; if (nx && Math.abs(mod(nx.pin - c.pin + 180, 360) - 180) > 1) web(c.u + wRod / 2, nx.u - wRod / 2, [c.pin, nx.pin], false); }
      uPrev = ub + tw; }
    g.cyl([uPrev, 0, 0], [D.Lb + 30, 0, 0], rj * 0.85, seg, true);                                               // the snout to the pulleys
    emit(g, nextBone++); }
  // ---- each cylinder: its piston (rings, crown), its rod, its bore (still), its valves, its plug (still) ----
  const seatA = Hd + 0.04 * bore, camAlong = Hd + 0.98 * B, liner0 = Math.max(0.3 * B, l - r + ch - pistonH - 0.04 * bore);
  // the valves of a side: their places on the chamber's roof (along the crank, across), their head's radius
  const lay = (side: -1 | 1): { du: number; a: number; rv: number }[] => { const v = S.valves, ins = side < 0;
    const k = ins ? (v === 2 ? 1 : v === 5 ? 3 : 2) : (v <= 3 ? 1 : 2), a = side * (v === 2 ? 0.21 : v === 3 ? (ins ? 0.18 : 0.24) : v === 5 ? (ins ? 0.2 : 0.22) : 0.21) * bore;
    const rv = (ins ? (v === 2 ? 0.21 : v === 3 ? 0.16 : v === 4 ? 0.17 : 0.13) : (v === 2 ? 0.18 : v === 3 ? 0.19 : v === 4 ? 0.15 : 0.145)) * bore;
    const sp = k === 3 ? 0.29 : k === 2 ? (v === 5 && !ins ? 0.19 : 0.2) : 0; return Array.from({ length: k }, (_, j) => ({ du: (j - (k - 1) / 2) * sp * bore * (k === 3 ? 1 : 2), a, rv })); };
  // the cams: over each side's valves (two a bank), or one over the middle; where each sits across and up the bank
  const camAt = (side: -1 | 1): [number, number] => { const v = lay(side)[0]!, a0 = seatA + v.rv * Math.sin(tilt); return twin ? [v.a + side * Math.sin(tilt) * (camAlong - a0) / Math.cos(tilt), camAlong] : [0, camAlong]; };
  const dirOf = (s: number, across: number, along: number): V => norm(add(mul(acr(s), across), mul(ax(s), along)));
  const camBones = new Map<string, number>();
  for (const s of D.S) for (const side of (twin ? [-1, 1] : [0]) as number[]) camBones.set(`${s},${side}`, 0);
  for (const c of cyls) { const s = c.s, x0 = pistonX(r, l, c.pin - c.beta + 0);   // at crank angle 0
    // the piston (its own bone): skirt, crown, three rings; the pin through it
    { const g = geo(), base = P(s, c.u, 0, x0 + ch - pistonH), d = ax(s);
      g.part('piston', ALU, 0.6, 'metal').lathe(base, d, [[0, 0.97 * R], [pistonH, 0.97 * R]], lseg, true);
      g.part('pistonRing', RING, 0.5, 'metal'); for (const t of [0.07, 0.13, 0.19]) g.lathe(P(s, c.u, 0, x0 + ch - t * bore), d, [[0, 0.985 * R], [0.025 * bore, 0.985 * R]], lseg, false);
      c.bones.piston = nextBone; emit(g, nextBone++); }
    // the rod (its own bone): the big end round the pin, the beam, the small end round the piston's pin
    { const g = geo().part('conRod', STEEL, 0.5, 'metal'), pin = add([c.u, 0, 0], yz(c.pin, r)), wrist = P(s, c.u, 0, x0), d = norm(sub(wrist, pin)), rb = 0.27 * bore, rs = 0.16 * bore;
      g.cyl(add(pin, [-wRod / 2, 0, 0]), add(pin, [wRod / 2, 0, 0]), rb, seg, true);
      g.prism(add(pin, mul(d, rb * 0.8)), sub(wrist, mul(d, rs * 0.8)), [[-0.085 * bore, -wRod * 0.32], [0.085 * bore, -wRod * 0.32], [0.085 * bore, wRod * 0.32], [-0.085 * bore, wRod * 0.32]], [1, 0, 0]);
      g.cyl(add(wrist, [-wRod * 0.4, 0, 0]), add(wrist, [wRod * 0.4, 0, 0]), rs, sseg + 2, true);
      c.bones.rod = nextBone; emit(g, nextBone++); }
    // the bore (still): a liner, cut with the block
    still.part('cylinderBore', '#5d6166', 0.55, 'metal').lathe(P(s, c.u, 0, liner0), ax(s), [[0, R], [Hd - liner0, R]], lseg, false);
    // the valves (a bone for each side's): the head's tulip, the stem, the tappet under the cam
    for (const side of [-1, 1] as const) { const g = geo().part(side < 0 ? 'intakeValve' : 'exhaustValve', VALVE, 0.55, 'metal'), [ca, cl] = camAt(side);
      for (const v of lay(side)) { const seatC = P(s, c.u + v.du, v.a, seatA + v.rv * Math.sin(tilt)), camC = P(s, c.u + v.du, ca, cl);
        const d = twin ? dirOf(s, side * Math.sin(tilt), Math.cos(tilt)) : norm(sub(camC, seatC)), Ls = Math.hypot(...sub(camC, seatC)) - rc - bh;
        g.part(side < 0 ? 'intakeValve' : 'exhaustValve', VALVE, 0.55, 'metal').lathe(seatC, d, [[0, v.rv], [0.03 * bore, v.rv * 0.9], [0.1 * bore, 0.06 * bore], [Ls, 0.035 * bore]], sseg + 2, 'a');
        g.part(side < 0 ? 'intakeValve' : 'exhaustValve', BUCKET, 0.5, 'metal').lathe(add(seatC, mul(d, Ls)), d, [[0, 0.13 * bore], [bh, 0.13 * bore]], sseg + 2, true);
        if (side < 0) c.inD = mul(d, -1); else c.exD = mul(d, -1); }
      const k = nextBone++; if (side < 0) c.bones.inV = k; else c.bones.exV = k; emit(g, k); }
    // the plug: in the chamber's middle between two cams; beside the valves, short of the cam, under one
    { const tip = twin ? P(s, c.u, 0, Hd + 0.06 * bore) : P(s, c.u + 0.3 * bore, 0.05 * bore, Hd + 0.06 * bore), d = ax(s), top = twin ? Hh * 0.95 : camAlong - rc - 0.06 * bore - Hd; c.plug = T(tip);
      still.part('sparkPlug', '#5a5a5a', 0.5, 'metal').cyl(tip, add(tip, mul(d, 0.1 * bore)), 0.05 * bore, 5, true);
      still.part('sparkPlug', HEX, 0.55, 'metal').cyl(add(tip, mul(d, 0.1 * bore)), add(tip, mul(d, 0.3 * bore)), 0.13 * bore, 6, true);
      still.part('sparkPlug', PLUG, 0.45).cyl(add(tip, mul(d, 0.3 * bore)), add(tip, mul(d, top)), 0.075 * bore, 6, true); } }
  // ---- the camshafts (a bone each): the shaft, a lobe at each valve, its nose where that valve's lift peaks (the cam
  // turning at half the crank's speed) ----
  const cams: EngineRig['cams'] = [];
  for (const s of D.S) for (const side of (twin ? [-1, 1] : [0]) as (-1 | 0 | 1)[]) { const g = geo().part('camshaft', CAM, 0.6, 'metal'), [ca, cl] = side === 0 ? [0, camAlong] : camAt(side), cc = P(s, 0, ca, cl), mine = cyls.filter(c => c.s === s);
    const u0 = Math.min(...mine.map(c => c.u)) - 0.5 * pitch, u1 = Math.max(...mine.map(c => c.u)) + 0.5 * pitch + 30;
    g.cyl([u0, cc[1], cc[2]], [u1, cc[1], cc[2]], 0.1 * bore, sseg + 2, true);
    for (const c of mine) for (const sd of (side === 0 ? [-1, 1] : [side]) as (-1 | 1)[]) { const vs = lay(sd), d = sd < 0 ? c.inD : c.exD, delta = Math.atan2(d[1], d[2]) / RAD;
      const peak = c.fire + (sd < 0 ? (TIMING.inOpen + TIMING.inClose) / 2 : (TIMING.exOpen + TIMING.exClose) / 2), lam = delta - peak / 2, dur = sd < 0 ? TIMING.inClose - TIMING.inOpen : TIMING.exClose - TIMING.exOpen;
      const prof: [number, number][] = []; for (let j = 0; j < 20; j++) { const a = j / 20 * 360, eta = mod(a - lam + 180, 360) - 180, t = 0.5 + 2 * eta / dur, rr = rc + (t > 0 && t < 1 ? Lmax * Math.sin(Math.PI * t) ** 2 : 0); prof.push([rr * Math.sin(a * RAD), rr * Math.cos(a * RAD)]); }
      for (const v of vs) { const uc = c.u + v.du, wl = 0.2 * bore; g.prism([uc - wl / 2, cc[1], cc[2]], [uc + wl / 2, cc[1], cc[2]], prof, [0, 0, 1]); } }
    const k = nextBone++; cams.push({ c: [0, cc[1], cc[2]], bone: k, s, side }); emit(g, k); }
  const { order } = firingGaps(cyls.map(c => c.fire)), first = order.indexOf(cyls.findIndex(c => c.no === 1));
  const ord = [...order.slice(first), ...order.slice(0, first)].map(k => cyls[k]!.no).join('-');
  return { rig: { off, r, l, bore, stroke, ch, deck: Hd, seat: seatA, tilt, lift: Lmax, cyl: cyls, cams, bones: nextBone, crank: kind, order: ord }, bone }; }

// ---- the pose ----
/** a cylinder's own angle from its firing top at crank angle θ (degrees, 0..720) */
export const cycleAngle = (c: InternalCyl, theta: number) => mod(theta - c.fire, 720);
/** the stroke a cylinder is on (an index into STROKES) */
export const strokeOf = (c: InternalCyl, theta: number) => Math.floor(cycleAngle(c, theta) / 180) as 0 | 1 | 2 | 3;
/** how bright its plug's spark is at θ (0..1): a short flash from the spark's advance on */
export function plugGlint(c: InternalCyl, theta: number): number { const a = mod(cycleAngle(c, theta) + TIMING.spark, 720); return a < 40 ? 1 - a / 40 : 0; }
/** a cylinder at crank angle θ (degrees): the pin, the piston pin (engine frame), its crown along its axis, each side's lift */
export function cylAt(rig: EngineRig, c: InternalCyl, theta: number) { const ph = theta + c.pin - c.beta, x = pistonX(rig.r, rig.l, ph), psi = cycleAngle(c, theta), b = c.beta * RAD;
  const pin: V = [c.u, rig.r * Math.sin((theta + c.pin) * RAD), rig.r * Math.cos((theta + c.pin) * RAD)], wrist: V = [c.u, x * Math.sin(b), x * Math.cos(b)];
  return { pin, wrist, x, crown: x + rig.ch, inLift: valveLift(psi, TIMING.inOpen, TIMING.inClose, rig.lift), exLift: valveLift(psi, TIMING.exOpen, TIMING.exClose, rig.lift) }; }
/** every bone's map from the mesh as built (three rows of four each, the still bone first) at crank angle θ (degrees) */
export function poseInternals(rig: EngineRig, theta: number, out = new Float32Array(rig.bones * 12)): Float32Array {
  const o = rig.off, put = (k: number, g: number, t: V) => { const c = Math.cos(g * RAD), s = Math.sin(g * RAD);   // a turn by g about the u axis (+w toward +v), then t; in the mesh's frame
    // the map p -> R (p - off) + off + t
    const ty = o[1] - (c * o[1] + s * o[2]) + t[1], tz = o[2] - (-s * o[1] + c * o[2]) + t[2]; out.set([1, 0, 0, t[0], 0, c, s, ty, 0, -s, c, tz], k * 12); };
  out.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], 0);
  put(1, theta, [0, 0, 0]);
  for (const c of rig.cyl) { const a = cylAt(rig, c, 0), q = cylAt(rig, c, theta), b = c.beta * RAD, dx = q.x - a.x;
    put(c.bones.piston, 0, [0, dx * Math.sin(b), dx * Math.cos(b)]);
    // the rod: turned from its pose at 0 to now about the u axis, its big end carried from the pin at 0 to the pin now
    const g0 = Math.atan2(a.wrist[1] - a.pin[1], a.wrist[2] - a.pin[2]) / RAD, g1 = Math.atan2(q.wrist[1] - q.pin[1], q.wrist[2] - q.pin[2]) / RAD, dg = g1 - g0, cg = Math.cos(dg * RAD), sg = Math.sin(dg * RAD);
    const rp: V = [0, cg * a.pin[1] + sg * a.pin[2], -sg * a.pin[1] + cg * a.pin[2]]; put(c.bones.rod, dg, [0, q.pin[1] - rp[1], q.pin[2] - rp[2]]);
    put(c.bones.inV, 0, mul(c.inD, q.inLift)); put(c.bones.exV, 0, mul(c.exD, q.exLift)); }
  for (const k of rig.cams) { const g = theta / 2, c = Math.cos(g * RAD), s = Math.sin(g * RAD), y = k.c[1], z = k.c[2]; put(k.bone, g, [0, y - (c * y + s * z), z - (-s * y + c * z)]); }
  return out; }
