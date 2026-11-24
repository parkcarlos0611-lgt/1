// The first fixtures harvested from our cars as parametric parts (docs/systems/105, docs/systems/106): each one is
// drawn in its own frame (fixture.ts), so it fits any body the way it fitted its own.
//   EB110_LAMP       the EB110's head lamp: a swept pocket in the nose's corner, two reflectors and an amber lamp at
//                    its back, a clear cover flush with the skin (cut-in)
//   F355_TAIL_LAMPS  the F355's round tail lamps: a shallow black pod sunk in the tail's face, two round wells in it,
//                    red lenses at their bottoms, bright rings round them (cut-in, its own plug)
//   NSX_DUCT         the NSX's side intake: a pocket in the flank that deepens rearward to a dark grille, fins across
//                    it (cut-in)
//   REAR_WING        a rear wing on two stands: the stands' feet laid on the deck, the blade straight across (surface)
import type { Build } from '../mesh';
import { sm, type V } from '../kit/geom';
import { circle, rounded, zip, type FixCtx, type FixtureDef } from './fixture';

type P2 = [number, number];
/** a disc of skin-laid points round (p, q) at height w (a fan), and a band between two circles */
function disc(b: Build, c: FixCtx, p: number, q: number, w: number, r: number, seg = 14): void { const o = c.at(p, q, w); for (let k = 0; k < seg; k++) { const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2; b.tri(o, c.at(p + Math.cos(a0) * r, q + Math.sin(a0) * r, w), c.at(p + Math.cos(a1) * r, q + Math.sin(a1) * r, w)); } }
function band(b: Build, c: FixCtx, p: number, q: number, r0: number, w0: number, r1: number, w1: number, seg = 14): void { for (let k = 0; k < seg; k++) { const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2;
  b.quad(c.at(p + Math.cos(a0) * r0, q + Math.sin(a0) * r0, w0), c.at(p + Math.cos(a1) * r0, q + Math.sin(a1) * r0, w0), c.at(p + Math.cos(a1) * r1, q + Math.sin(a1) * r1, w1), c.at(p + Math.cos(a0) * r1, q + Math.sin(a0) * r1, w1)); } }

// ---- the EB110's head lamp ----
const EB_FP = rounded([[-215, -80], [-240, 88], [205, 70], [190, -38]], 48, 4), ebDepth = (p: number) => 48 + 22 * sm(-200, 200, p);
export const EB110_LAMP: FixtureDef = { id: 'eb110Lamp', name: 'EB110 헤드램프 포켓', source: 'EB110', category: '헤드램프', kind: 'cut', defaults: { s: 0.46, a: 0.25, scale: 1.15, mirror: true },
  cuts: () => [{ footprint: EB_FP, depth: p => ebDepth(p), taper: 0.07, wall: ['#161616', 0.1], back: ['#232628', 0.2] }],
  parts: (c, b) => { const d = (p: number) => -ebDepth(p) * c.depth;
    for (const [p, r] of [[-115, 60], [55, 52]] as const) { b.name('lampF').mat('#cfd3d6', 0.85, 'metal'); band(b, c, p, 8, r + 10, d(p) + 2, r, d(p) + 16);
      b.name('lens').mat('#f4f3ea', 0.7, 'lens'); disc(b, c, p, 8, d(p) + 16, r); b.mat('#fffbe8', 0.9, 'lens'); disc(b, c, p, 8, d(p) + 19, r * 0.32, 10); }
    b.name('indicatorF').mat('#e2901e', 0.6, 'lens'); const q4: P2[] = [[150, 42], [188, 30], [180, -22], [146, -14]]; b.quad(...q4.map(([p, q]) => c.at(p, q, d(p) + 4)) as [V, V, V, V]);
    b.name('lampCover').mat('#d8e4ea', 0.9, 'glass'); const o = c.at(-10, 10, 1.5); for (let k = 0; k < EB_FP.length; k++) { const A = EB_FP[k]!, B = EB_FP[(k + 1) % EB_FP.length]!; b.tri(o, c.at(A[0], A[1], 1.5), c.at(B[0], B[1], 1.5)); } } };

// ---- the F355's round tail lamps ----
const TL = { cx: 95, r: 66, pod: 86, podDepth: 12, well: 42 };
/** the pod's outline: two half circles joined by straight runs, its top and bottom middles points of their own */
function stadium(cx: number, R: number): { fp: P2[]; top: number; bot: number } { const fp: P2[] = []; const arc = (x: number, a0: number, a1: number, n: number) => { for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; fp.push([x + Math.cos(a) * R, Math.sin(a) * R]); } };
  arc(cx, -Math.PI / 2, Math.PI / 2, 8); fp.push([cx / 2, R]); const top = fp.length; fp.push([0, R], [-cx / 2, R]); arc(-cx, Math.PI / 2, Math.PI * 1.5, 8); fp.push([-cx / 2, -R]); const bot = fp.length; fp.push([0, -R], [cx / 2, -R]); return { fp, top, bot }; }
const TL_FP = stadium(TL.cx, TL.pod);
export const F355_TAIL_LAMPS: FixtureDef = { id: 'f355TailLamps', name: 'F355 둥근 테일램프', source: 'F355', category: '테일램프', kind: 'cut', defaults: { face: 'tail', y: 0.6, z: 0.6, scale: 1.1, mirror: true },
  cuts: () => [{ footprint: TL_FP.fp, plug: (c, rim, fp) => { const k = 0.96, w0 = -TL.podDepth * c.depth, wall = c.mat('pod', '#141414', 0.15), back = c.mat('pod', '#141414', 0.15), dark = c.mat('well', '#0e0e0e', 0.1), lens = c.mat('lensR', '#b0161a', 0.65, 'lens');
    // the pod: its wall sunk from the rim, its back split down the middle into two halves, each zipped round its well
    const ring = fp.map(([p, q]) => c.vtx(p * k, q * k, w0)); for (let i = 0; i < rim.length; i++) { const j = (i + 1) % rim.length; c.tri(rim[i]!, rim[j]!, ring[j]!, wall); c.tri(rim[i]!, ring[j]!, ring[i]!, wall); }
    const split = [-0.5, 0, 0.5].map(t => ({ id: c.vtx(0, t * TL.pod * k, w0), p: [0, t * TL.pod * k] as P2 })), T = TL_FP.top, B = TL_FP.bot, n = fp.length, R2 = fp.map(([p, q]) => [p * k, q * k] as P2);
    const halves: { ids: number[]; P: P2[]; cx: number }[] = [];
    { const ids: number[] = [], P: P2[] = []; for (let i = B; ; i = (i + 1) % n) { ids.push(ring[i]!); P.push(R2[i]!); if (i === T) break; } for (const s of [...split].reverse()) { ids.push(s.id); P.push(s.p); } halves.push({ ids, P, cx: TL.cx }); }
    { const ids: number[] = [], P: P2[] = []; for (let i = T; ; i = (i + 1) % n) { ids.push(ring[i]!); P.push(R2[i]!); if (i === B) break; } for (const s of split) { ids.push(s.id); P.push(s.p); } halves.push({ ids, P, cx: -TL.cx }); }
    for (const h of halves) { const C = circle(h.cx, 0, TL.r, 16), top = C.map(([p, q]) => c.vtx(p, q, w0)); zip(h.ids, h.P, top, C, (a, b2, c2) => c.tri(a, b2, c2, back));
      const deep = C.map(([p, q]) => c.vtx(h.cx + (p - h.cx) * 0.94, q * 0.94, w0 - TL.well * c.depth)); for (let i = 0; i < C.length; i++) { const j = (i + 1) % C.length; c.tri(top[i]!, top[j]!, deep[j]!, dark); c.tri(top[i]!, deep[j]!, deep[i]!, dark); }
      const mid = c.vtx(h.cx, 0, w0 - TL.well * c.depth + 6); for (let i = 0; i < C.length; i++) c.tri(mid, deep[i]!, deep[(i + 1) % C.length]!, lens); } } }],
  parts: (c, b) => { const w0 = -TL.podDepth * c.depth;
    for (const cx of [TL.cx, -TL.cx]) { b.name('tailLampRim').mat('#cfd2d4', 0.85, 'metal'); band(b, c, cx, 0, TL.r + 9, w0 + 1.5, TL.r - 1, w0 + 1.5, 18);
      b.name('lensR').mat('#d22a26', 0.7, 'lens'); band(b, c, cx, 0, TL.r * 0.62, w0 - TL.well * c.depth + 9, TL.r * 0.5, w0 - TL.well * c.depth + 9, 14); }
    b.name('reverse').mat('#f2f2ee', 0.7, 'lens'); disc(b, c, -TL.cx, 0, w0 - TL.well * c.depth + 10, 20, 10); } };

// ---- the NSX's side intake ----
const DUCT_FP = rounded([[-255, 112], [-135, -112], [232, -112], [232, 112]], 46, 4), ductDepth = (p: number) => 22 + 150 * sm(-255, 232, p);
export const NSX_DUCT: FixtureDef = { id: 'nsxDuct', name: 'NSX 측면 흡기 덕트', source: 'NSX', category: '흡기·덕트', kind: 'cut', defaults: { s: 1.68, a: 0.5, mirror: true },
  cuts: () => [{ footprint: DUCT_FP, depth: p => ductDepth(p), taper: 0.12, wall: ['#2a2826', 0.05], back: ['#111111', 0.05, 'grille'] }],
  parts: (c, b) => { b.name('ductFin').mat('#191919', 0.1); for (const q of [-52, 0, 52]) { const a = c.at(-30, q, -ductDepth(-30) * c.depth * 0.55), e = c.at(215, q, -ductDepth(215) * c.depth * 0.5); b.bar(a, e, 12, 36); } } };

// ---- the rear wing on two stands ----
export const REAR_WING: FixtureDef = { id: 'rearWing', name: '스탠드 뒷윙', source: 'NSX·F355', category: '윙', kind: 'surface', defaults: { s: 2.78, a: 0.2, mirror: true },
  parts: (c, b) => { const H = 210 * c.scale, foot = [-75, -35, 35, 75].map(p => c.at(p, 0, -4)), top = foot.map((f, k) => [c.rigid(0, 0, 0)[0] + [-40, -15, 25, 45][k]! * c.scale + 35, f[1], c.frame.o[2] + H] as V);
    b.name('wingStand').mat('#1b1b1d', 0.3, 'paint'); const t = 9, sq = (p: V): V[] => [[p[0], p[1] - t, p[2]], [p[0], p[1] + t, p[2]]];
    const A = foot.flatMap(sq), Bt = top.flatMap(sq); const ringA: V[] = [A[0]!, A[2]!, A[4]!, A[6]!, A[7]!, A[5]!, A[3]!, A[1]!], ringB: V[] = [Bt[0]!, Bt[2]!, Bt[4]!, Bt[6]!, Bt[7]!, Bt[5]!, Bt[3]!, Bt[1]!]; b.loft([ringA, ringB]); },
  once: (c, b) => { const s = c.scale, o = c.frame.o, sect = c.body.sect(Math.min(3, c.frame.s)), half = Math.max(...sect.pts.map(p => p[1])), span = Math.min(half * 0.97, Math.abs(o[1]) + 240 * s);
    const ch = 330 * s, th = 40 * s, x0 = o[0] - 70 * s, z0 = o[2] + 210 * s + 6, aoa = 8 * Math.PI / 180;
    const sec: [number, number][] = [[0, 0], [0.06, 0.55], [0.3, 1], [0.65, 0.62], [1, 0.08], [1, -0.06], [0.65, -0.12], [0.3, -0.25], [0.06, -0.22]];
    const ring = (y: number): V[] => sec.map(([u, v]) => { const xl = u * ch, zl = v * th; return [x0 + xl * Math.cos(aoa) + zl * Math.sin(aoa), y, z0 - xl * Math.sin(aoa) + zl * Math.cos(aoa)] as V; });
    b.name('wingBlade').mat('#1b1b1d', 0.35, 'paint').loft([ring(-span), ring(0), ring(span)]);
    b.name('wingPlate').mat('#151516', 0.3, 'paint'); for (const y of [-span, span]) b.box(x0 - 20 * s, x0 + ch + 15 * s, y - 6, y + 6, z0 - 110 * s, z0 + 60 * s); } };

export const FIXTURE_SET: FixtureDef[] = [EB110_LAMP, F355_TAIL_LAMPS, NSX_DUCT, REAR_WING];

