// The 959's attached parts (docs/systems/109, step S3): the modules that sit in the shell's sockets and on its mounts.
// Head lamps (the car's round lamp and two others), wheels (the hollow five-spoke and two others) with a brake behind,
// mirrors, exhausts, and the old Korean green number plate with its figures drawn by rule (strokes, no picture).
// The bumpers and the wing are regions of the cage itself (cage.ts: their boundary loops and variants).
import type { Build } from '../mesh';
import type { Hub, Mount, Mark } from './sockets';
import type { V } from './subdiv';

export type LampKind = 'round' | 'ellipsoid' | 'square';
export type WheelKind = 'hollow5' | 'dish' | 'hole5';
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** a head lamp in its socket: `c` the socket floor's centre, `u` across, `v` up the lamp's slope, `n` out of it; `a`, `b` the half-axes inside the rim */
export function headLamp(b: Build, kind: LampKind, c: V, u: V, v: V, n: V, a: number, bb: number): void { const SEG = 16;
  const at = (r: number, t: number, h: number): V => add(add(add(c, u, Math.cos(t) * a * r), v, Math.sin(t) * bb * r), n, h), ring = (r: number, h: number, seg = SEG, rot = 0) => Array.from({ length: seg }, (_, i) => at(r, (i / seg) * Math.PI * 2 + rot, h));
  const band = (A: V[], B: V[]) => { for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length; b.quad(A[i]!, A[j]!, B[j]!, B[i]!); } }, cap = (A: V[], m: V) => { for (let i = 0; i < A.length; i++) b.tri(m, A[i]!, A[(i + 1) % A.length]!); };
  b.name('lampBezel').mat('#2a2c2f', 0.3, 'plain'); band(ring(1, 2), ring(0.9, 13)); band(ring(0.9, 13), ring(0.84, 11));
  if (kind === 'round') { b.name('headLamp').mat('#e3e8ec', 0.8, 'lens'); const R = [ring(0.84, 11), ring(0.6, 22), ring(0.3, 28)]; band(R[0]!, R[1]!); band(R[1]!, R[2]!); cap(R[2]!, at(0, 0, 30)); return; }
  b.name('lampHousing').mat('#17181a', 0.1, 'plain'); cap(ring(0.84, 11), at(0, 0, 9));
  if (kind === 'ellipsoid') { for (const [du, r] of [[-0.3, 0.36], [0.42, 0.24]] as const) { const o = add(c, u, du * a), rr = (q: number, h: number) => Array.from({ length: 10 }, (_, i) => { const t = (i / 10) * Math.PI * 2; return add(add(add(o, u, Math.cos(t) * a * r * q), v, Math.sin(t) * a * r * q), n, h); });
      b.name('lampRing').mat('#c9ccd0', 0.6, 'plain'); band(rr(1.18, 12), rr(1, 16)); b.name('headLamp').mat('#e3e8ec', 0.8, 'lens'); band(rr(1, 16), rr(0.6, 26)); cap(rr(0.6, 26), add(o, n, 30)); } return; }
  // square: two projector blocks side by side
  for (const du of [-0.36, 0.36]) { const o = add(c, u, du * a), q = (su: number, sv: number, h: number, k = 1): V => add(add(add(o, u, su * a * 0.27 * k), v, sv * bb * 0.3 * k), n, h), sq = (h: number, k = 1) => [q(-1, -1, h, k), q(1, -1, h, k), q(1, 1, h, k), q(-1, 1, h, k)];
    b.name('lampRing').mat('#c9ccd0', 0.6, 'plain'); band(sq(11, 1.15), sq(17)); b.name('headLamp').mat('#e3e8ec', 0.8, 'lens'); band(sq(17), sq(24, 0.8)); const t = sq(24, 0.8); b.quad(t[0]!, t[1]!, t[2]!, t[3]!); } }

/** a road wheel on its hub: tyre, rim, the wheel's face in one of three designs, and the brake seen through it */
export function wheel(b: Build, h: Hub, kind: WheelKind): void { const s = h.o[1] > 0 ? 1 : -1, w = h.width, r = h.tyreR, rim = h.rimR, o: V = [h.o[0], h.o[1] - s * w / 2, h.o[2]], f = s * w / 2, SEG = 16;
  b.name(h.front ? 'tyreF' : 'tyreR').mat('#1c1c1e', 0.1, 'tyre').lathe('y', o, [[-f, r - 30], [-f * 0.72, r], [f * 0.72, r], [f, r - 30], [f, rim]], SEG, false);
  const metal = '#c9ccd0', dish = kind === 'dish' ? 78 : 24, face = f - s * dish;
  b.name('rim').mat(metal, 0.5, 'plain').lathe('y', o, [[f, rim], [f - s * 8, rim - 12], [f - s * 130, rim - 22]], SEG, false);
  // the brake: a disc and a caliper behind the spokes
  b.name('brakeDisc').mat('#8d9094', 0.3, 'plain').lathe('y', o, [[f - s * 100, 165], [f - s * 100, 70]], 12, false);
  b.name('brakeCaliper').mat('#b3261e', 0.3, 'plain').box(o[0] + 70, o[0] + 150, Math.min(h.o[1] - s * 112, h.o[1] - s * 84), Math.max(h.o[1] - s * 112, h.o[1] - s * 84), o[2] - 70, o[2] + 70);
  b.name('wheel').mat('#232426', 0.05, 'plain').lathe('y', o, [[f - s * 132, rim - 22], [f - s * 134, 0.5]], 12, false);
  const y = h.o[1] - s * (dish + 6), spoke = (a: number, r0: number, r1: number, t0: number, t1: number, lift = 0) => { const c = Math.cos(a), sn = Math.sin(a); b.bar([o[0] + c * r0, y + s * lift, o[2] + sn * r0], [o[0] + c * r1, y, o[2] + sn * r1], t0, t1); };
  b.name('wheel').mat(metal, 0.5, 'plain');
  if (kind === 'hollow5') for (let q = 0; q < 5; q++) spoke((q / 5 + 0.05) * Math.PI * 2, 46, rim - 20, 58, 84, 10);        // broad hollow spokes, widening to the rim
  else if (kind === 'dish') for (let q = 0; q < 10; q++) spoke((q / 10) * Math.PI * 2, 40, rim - 20, 20, 16);
  else { b.lathe('y', o, [[face, rim - 18], [face + s * 8, 70]], SEG, false); b.name('wheelHole').mat('#232426', 0.05, 'plain'); for (let q = 0; q < 5; q++) { const a = (q / 5) * Math.PI * 2; b.lathe('y', [o[0] + Math.cos(a) * 128, o[1], o[2] + Math.sin(a) * 128], [[face + s * 10, 34], [face + s * 10.5, 0.5]], 8, false); } }
  b.name('hub').mat(metal, 0.5, 'plain').lathe('y', o, [[face - s * 6, 66], [face + s * 14, 54], [face + s * 18, 0.5]], 10, false); }

export function mirror(b: Build, m: Mount, paint: string): void { const s = m.o[1] > 0 ? 1 : -1, c: V = [m.o[0] + 20, m.o[1] + s * 120, m.o[2] + 62];
  b.name('mirror').mat(paint, 0.6, 'paint').bar(m.o, [c[0], c[1] - s * 30, c[2] - 20], 26)
    .loft([[c[0] - 45, c[1], c[2]], [c[0] + 55, c[1] - s * 5, c[2]]].map(([x, y, z], q) => { const hw = q ? 62 : 40, hh = q ? 46 : 30; return [[x!, y! - s * hw, z! - hh], [x!, y! + s * hw, z! - hh * 0.8], [x!, y! + s * hw, z! + hh * 0.8], [x!, y! - s * hw, z! + hh]] as V[]; })); }

// ---- the number plate: the old Korean green plate (335 x 170 mm; docs/reference/plate_kr), white figures on green, a
//      silver frame, two green bolts. The figures are strokes in a unit box (x right, y up), drawn as flat bands.
const GLYPH: Record<string, number[][][]> = {
  '0': [[[.2, 0], [.8, 0], [1, .2], [1, .8], [.8, 1], [.2, 1], [0, .8], [0, .2], [.2, 0]]], '1': [[[.3, .8], [.55, 1], [.55, 0]]], '2': [[[0, .8], [.2, 1], [.8, 1], [1, .8], [1, .6], [0, 0], [1, 0]]],
  '3': [[[0, .85], [.2, 1], [.8, 1], [1, .8], [1, .62], [.8, .5], [.4, .5]], [[.8, .5], [1, .38], [1, .2], [.8, 0], [.2, 0], [0, .15]]], '4': [[[.75, 0], [.75, 1], [0, .3], [1, .3]]],
  '5': [[[1, 1], [.1, 1], [0, .55], [.75, .6], [1, .42], [1, .2], [.8, 0], [.2, 0], [0, .15]]], '6': [[[.9, .9], [.7, 1], [.25, 1], [0, .75], [0, .2], [.2, 0], [.8, 0], [1, .2], [1, .4], [.8, .58], [.2, .58], [0, .4]]],
  '7': [[[0, 1], [1, 1], [.4, 0]]], '8': [[[.2, .52], [0, .68], [0, .84], [.2, 1], [.8, 1], [1, .84], [1, .68], [.8, .52], [.2, .52], [0, .36], [0, .18], [.2, 0], [.8, 0], [1, .18], [1, .36], [.8, .52]]],
  '9': [[[.1, .1], [.3, 0], [.75, 0], [1, .25], [1, .8], [.8, 1], [.2, 1], [0, .8], [0, .6], [.2, .42], [.8, .42], [1, .6]]],
  '루': [[[.15, 1], [.85, 1], [.85, .8], [.15, .8], [.15, .6], [.85, .6]], [[0, .38], [1, .38]], [[.5, .38], [.5, 0]]] };
export interface PlateText { top: string; big: string }
export function plate(b: Build, m: Mark, text: PlateText = { top: '08루', big: '0959' }): void { const W = 335, H = 170, n = m.n, u: V = [0, n[0], 0], up: V = [0, 0, 1];   // u: to the reader's right
  const at = (x: number, y: number, h: number): V => add(add(add(m.o, u, x), up, y), n, h), flip = n[0] * u[1] < 0;
  const quad = (p: V, q: V, r: V, t: V) => flip ? b.quad(t, r, q, p) : b.quad(p, q, r, t), rect = (x0: number, x1: number, y0: number, y1: number, h: number) => quad(at(x0, y0, h), at(x1, y0, h), at(x1, y1, h), at(x0, y1, h));
  b.name('plateFrame').mat('#c2c5c9', 0.6, 'plain'); rect(-W / 2 - 9, W / 2 + 9, -H / 2 - 9, H / 2 + 9, 3);
  b.name('plate').mat('#12804c', 0.3, 'plain'); rect(-W / 2, W / 2, -H / 2, H / 2, 5);
  b.name('plateText').mat('#f1f3f2', 0.2, 'plain');
  const stroke = (p: number[], q: number[], t: number) => { const dx = q[0]! - p[0]!, dy = q[1]! - p[1]!, l = Math.hypot(dx, dy) || 1, ox = -dy / l * t / 2, oy = dx / l * t / 2, ex = dx / l * t / 2, ey = dy / l * t / 2;
    quad(at(p[0]! - ex - ox, p[1]! - ey - oy, 6), at(q[0]! + ex - ox, q[1]! + ey - oy, 6), at(q[0]! + ex + ox, q[1]! + ey + oy, 6), at(p[0]! - ex + ox, p[1]! - ey + oy, 6)); };
  const word = (s: string, x0: number, y0: number, w: number, h: number, gap: number, t: number) => [...s].forEach((ch, k) => { for (const line of GLYPH[ch] ?? []) for (let q = 0; q + 1 < line.length; q++) stroke([x0 + k * (w + gap) + line[q]![0]! * w, y0 + line[q]![1]! * h], [x0 + k * (w + gap) + line[q + 1]![0]! * w, y0 + line[q + 1]![1]! * h], t); });
  word(text.top, -58, 38, 30, 34, 13, 6); word(text.big, -138, -68, 50, 86, 24, 13);
  for (const k of [[-W / 2 + 6, W / 2 - 6, H / 2 - 8, H / 2 - 5], [-W / 2 + 6, W / 2 - 6, -H / 2 + 5, -H / 2 + 8], [-W / 2 + 5, -W / 2 + 8, -H / 2 + 5, H / 2 - 5], [W / 2 - 8, W / 2 - 5, -H / 2 + 5, H / 2 - 5]]) rect(k[0]!, k[1]!, k[2]!, k[3]!, 6);   // the white line inside the edge
  b.name('plateBolt').mat('#0f6b40', 0.3, 'plain'); for (const x of [-98, 98]) { const c = at(x, 52, 6), ring = Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2; return add(add(c, u, Math.cos(a) * 11), up, Math.sin(a) * 11); }), top = add(c, n, 5); for (let i = 0; i < 6; i++) flip ? b.tri(top, ring[(i + 1) % 6]!, ring[i]!) : b.tri(top, ring[i]!, ring[(i + 1) % 6]!); } }
