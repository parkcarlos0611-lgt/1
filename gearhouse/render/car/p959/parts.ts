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
export function headLamp(b: Build, kind: LampKind, c: V, u: V, v: V, n: V, a: number, bb: number): void { const SEG = 12;
  const at = (r: number, t: number, h: number): V => add(add(add(c, u, Math.cos(t) * a * r), v, Math.sin(t) * bb * r), n, h), ring = (r: number, h: number, seg = SEG, rot = 0) => Array.from({ length: seg }, (_, i) => at(r, (i / seg) * Math.PI * 2 + rot, h));
  const band = (A: V[], B: V[]) => { for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length; b.quad(A[i]!, A[j]!, B[j]!, B[i]!); } }, cap = (A: V[], m: V) => { for (let i = 0; i < A.length; i++) b.tri(m, A[i]!, A[(i + 1) % A.length]!); };
  b.name('lampBezel').mat('#c2c5c9', 0.5, 'plain'); band(ring(1, 2), ring(0.9, 13)); band(ring(0.9, 13), ring(0.84, 11));
  if (kind === 'round') { b.name('headLamp').mat('#e3e8ec', 0.8, 'lens'); const R = [ring(0.84, 11), ring(0.5, 24)]; band(R[0]!, R[1]!); cap(R[1]!, at(0, 0, 30)); return; }
  b.name('lampReflector').mat('#9ea4aa', 0.6, 'plain'); cap(ring(0.84, 11), at(0, 0, 4));   // the reflector bowl behind the projectors: light, so the lamp reads lit
  if (kind === 'ellipsoid') { for (const [du, r] of [[-0.3, 0.36], [0.42, 0.24]] as const) { const o = add(c, u, du * a), rr = (q: number, h: number) => Array.from({ length: 8 }, (_, i) => { const t = (i / 8) * Math.PI * 2; return add(add(add(o, u, Math.cos(t) * a * r * q), v, Math.sin(t) * a * r * q), n, h); });
      b.name('lampRing').mat('#5d6166', 0.5, 'plain'); band(rr(1.18, 12), rr(1, 16)); b.name('headLamp').mat('#f2f5f7', 0.8, 'lens'); band(rr(1, 16), rr(0.6, 26)); cap(rr(0.6, 26), add(o, n, 30)); } return; }
  // square: two projector blocks side by side
  for (const du of [-0.36, 0.36]) { const o = add(c, u, du * a), q = (su: number, sv: number, h: number, k = 1): V => add(add(add(o, u, su * a * 0.27 * k), v, sv * bb * 0.3 * k), n, h), sq = (h: number, k = 1) => [q(-1, -1, h, k), q(1, -1, h, k), q(1, 1, h, k), q(-1, 1, h, k)];
    b.name('lampRing').mat('#5d6166', 0.5, 'plain'); band(sq(11, 1.15), sq(17)); b.name('headLamp').mat('#f2f5f7', 0.8, 'lens'); band(sq(17), sq(24, 0.8)); const t = sq(24, 0.8); b.quad(t[0]!, t[1]!, t[2]!, t[3]!); } }

/** a road wheel on its hub: tyre, rim, the wheel's face in one of three designs, and the brake seen through it */
export function wheel(b: Build, h: Hub, kind: WheelKind, brake = true): void { const s = h.o[1] > 0 ? 1 : -1, w = h.width, r = h.tyreR, rim = h.rimR, o: V = [h.o[0], h.o[1] - s * w / 2, h.o[2]], f = s * w / 2, SEG = 12;
  b.name(h.front ? 'tyreF' : 'tyreR').mat('#1c1c1e', 0.1, 'tyre').lathe('y', o, [[-f * 0.9, r - 12], [-f * 0.72, r], [f * 0.72, r], [f, r - 30], [f, rim]], SEG, false);
  const metal = '#c9ccd0', dish = kind === 'dish' ? 78 : 24, face = f - s * dish;
  b.name('rim').mat(metal, 0.5, 'plain').lathe('y', o, [[f, rim], [f - s * 8, rim - 12], [f - s * 130, rim - 22]], SEG, false);
  // the brake: a disc and a caliper behind the spokes
  if (brake) { b.name('brakeDisc').mat('#8d9094', 0.3, 'plain').lathe('y', o, [[f - s * 100, rim - 22], [f - s * 100, 0.5]], 12, false);   // (a car with its suspension drawn brings its own disc and caliper)
  b.name('brakeCaliper').mat('#b3261e', 0.3, 'plain').box(o[0] + 70, o[0] + 150, Math.min(h.o[1] - s * 112, h.o[1] - s * 84), Math.max(h.o[1] - s * 112, h.o[1] - s * 84), o[2] - 70, o[2] + 70); }
  const y = h.o[1] - s * (dish + 6), spoke = (a: number, r0: number, r1: number, t0: number, t1: number, lift = 0) => { const c = Math.cos(a), sn = Math.sin(a); b.bar([o[0] + c * r0, y + s * lift, o[2] + sn * r0], [o[0] + c * r1, y, o[2] + sn * r1], t0, t1); };
  b.name('wheel').mat(metal, 0.5, 'plain');
  if (kind === 'hollow5') for (let q = 0; q < 5; q++) spoke((q / 5 + 0.05) * Math.PI * 2, 46, rim - 20, 58, 84, 10);        // broad hollow spokes, widening to the rim
  else if (kind === 'dish') for (let q = 0; q < 8; q++) spoke((q / 8) * Math.PI * 2, 40, rim - 20, 22, 16);
  else { b.lathe('y', o, [[face, rim - 18], [face + s * 8, 70]], SEG, false); b.name('wheelHole').mat('#232426', 0.05, 'plain'); for (let q = 0; q < 5; q++) { const a = (q / 5) * Math.PI * 2; b.lathe('y', [o[0] + Math.cos(a) * 128, o[1], o[2] + Math.sin(a) * 128], [[face + s * 10, 34], [face + s * 10.5, 0.5]], 8, false); } }
  b.name('hub').mat(metal, 0.5, 'plain').lathe('y', o, [[face - s * 6, 66], [face + s * 16, 50], [face + s * 18, 0.5]], 8, false); }

export function mirror(b: Build, m: Mount, paint: string): void { const s = m.o[1] > 0 ? 1 : -1, c: V = [m.o[0] + 20, m.o[1] + s * 120, m.o[2] + 62];
  b.name('mirror').mat(paint, 0.6, 'paint').bar(m.o, [c[0], c[1] - s * 30, c[2] - 20], 26)
    .loft([[c[0] - 45, c[1], c[2]], [c[0] + 55, c[1] - s * 5, c[2]]].map(([x, y, z], q) => { const hw = q ? 62 : 40, hh = q ? 46 : 30; return [[x!, y! - s * hw, z! - hh], [x!, y! + s * hw, z! - hh * 0.8], [x!, y! + s * hw, z! + hh * 0.8], [x!, y! - s * hw, z! + hh]] as V[]; })); }

// ---- the number plate: the old Korean green plate (335 x 170 mm; docs/reference/plate_kr), white figures on green, a
//      silver frame, two green bolts. The figures are strokes in a unit box (x right, y up), drawn as flat bands.
const GLYPH: Record<string, number[][][]> = {
  '0': [[[.2, 0], [.8, 0], [1, .2], [1, .8], [.8, 1], [.2, 1], [0, .8], [0, .2], [.2, 0]]], '1': [[[.3, .78], [.55, .96]], [[.55, 1], [.55, 0]]], '2': [[[0, .8], [.2, 1], [.8, 1], [1, .8], [1, .6], [0, 0], [1, 0]]],
  '3': [[[0, .85], [.2, 1], [.8, 1], [1, .8], [1, .62], [.8, .5], [.4, .5]], [[.8, .5], [1, .38], [1, .2], [.8, 0], [.2, 0], [0, .15]]], '4': [[[.75, 0], [.75, 1], [0, .3], [1, .3]]],
  '5': [[[1, 1], [.1, 1], [0, .55], [.75, .6], [1, .42], [1, .2], [.8, 0], [.2, 0], [0, .15]]], '6': [[[.9, .9], [.7, 1], [.25, 1], [0, .75], [0, .2], [.2, 0], [.8, 0], [1, .2], [1, .4], [.8, .58], [.2, .58], [0, .4]]],
  '7': [[[0, 1], [1, 1], [.4, 0]]], '8': [[[.2, .52], [0, .68], [0, .84], [.2, 1], [.8, 1], [1, .84], [1, .68], [.8, .52], [.2, .52], [0, .36], [0, .18], [.2, 0], [.8, 0], [1, .18], [1, .36], [.8, .52]]],
  '9': [[[.1, .1], [.3, 0], [.75, 0], [1, .25], [1, .8], [.8, 1], [.2, 1], [0, .8], [0, .6], [.2, .42], [.8, .42], [1, .6]]],
 };
// Hangul for the plate's top line: a syllable without a final consonant, composed from its two jamo. Each jamo is
// strokes in its own unit box; the boxes are laid out by the vowel: a standing vowel (ㅏ ㅓ ㅐ) to the right of the
// consonant, a lying one (ㅗ ㅜ) under it.
const O8 = [[.3, 0], [.7, 0], [1, .3], [1, .7], [.7, 1], [.3, 1], [0, .7], [0, .3], [.3, 0]];
const CHO: Record<number, number[][][]> = { 0: [[[0, 1], [1, 1], [1, 0]]], 2: [[[0, 1], [0, 0], [1, 0]]], 3: [[[1, 1], [0, 1], [0, 0], [1, 0]]], 5: [[[0, 1], [1, 1], [1, .5], [0, .5], [0, 0], [1, 0]]],
  6: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]], 7: [[[0, 1], [0, 0], [1, 0], [1, 1]], [[0, .5], [1, .5]]], 9: [[[.5, 1], [.38, .5], [0, 0]], [[.5, 1], [.62, .5], [1, 0]]], 11: [O8],
  12: [[[0, 1], [1, 1]], [[.5, 1], [.38, .5], [0, 0]], [[.5, 1], [.62, .5], [1, 0]]], 18: [[[.3, 1], [.7, 1]], [[0, .72], [1, .72]], [O8.map(q => [q[0]!, q[1]! * 0.5])] .flat()] };
const JUNG: Record<number, { lying: boolean; strokes: number[][][] }> = { 0: { lying: false, strokes: [[[.25, 1], [.25, 0]], [[.25, .5], [1, .5]]] }, 1: { lying: false, strokes: [[[0, 1], [0, 0]], [[1, 1], [1, 0]], [[0, .5], [1, .5]]] },
  4: { lying: false, strokes: [[[1, 1], [1, 0]], [[0, .5], [1, .5]]] }, 8: { lying: true, strokes: [[[0, 0], [1, 0]], [[.5, 0], [.5, 1]]] }, 13: { lying: true, strokes: [[[0, 1], [1, 1]], [[.5, 1], [.5, 0]]] } };
/** a figure's strokes in the unit box: a digit, or a Hangul syllable of an initial consonant and a vowel this plate font has */
export function glyph(ch: string): number[][][] | null { if (GLYPH[ch]) return GLYPH[ch]!; const c = ch.charCodeAt(0) - 0xac00; if (c < 0 || c > 11171 || c % 28) return null; const cho = CHO[Math.floor(c / 588)], jung = JUNG[Math.floor(c / 28) % 21]; if (!cho || !jung) return null;
  const box = (st: number[][][], x0: number, x1: number, y0: number, y1: number) => st.map(l => l.map(q => [x0 + q[0]! * (x1 - x0), y0 + q[1]! * (y1 - y0)]));
  return jung.lying ? [...box(cho, 0.12, 0.88, 0.5, 1), ...box(jung.strokes, 0, 1, 0, 0.36)] : [...box(cho, 0, 0.56, 0.04, 0.96), ...box(jung.strokes, 0.7, 1, 0, 1)]; }
/** the syllables a private car's plate may carry (those this font composes) */
export const PLATE_SYLLABLES = '가나다라마바사아자거너더러머버서어저고노도로모보소오조구누두루무부수우주배하허호';
export interface PlateText { top: string; big: string }
/** a plate's text: from a string like "12가 3456", or made up from a seed (two digits, a syllable, four digits) */
export function plateText(src: string | number): PlateText { if (typeof src === 'string') { const m = src.replace(/\s+/g, '').match(/^(\d{2}.)(\d{4})$/); if (m && glyph(m[1]![2]!)) return { top: m[1]!, big: m[2]! }; throw new Error(`not a plate number: ${src}`); }
  let s = (src >>> 0) || 1; const r = (n: number) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return Math.floor(s / 4294967296 * n); }, d = () => String(r(10));
  return { top: d() + d() + [...PLATE_SYLLABLES][r(PLATE_SYLLABLES.length)]!, big: String(1 + r(9)) + d() + d() + d() }; }
export function plate(b: Build, m: Mark, text: PlateText = { top: '08루', big: '0599' }): void { const W = 335, H = 170, n = m.n, u: V = [0, -n[0], 0], up: V = [0, 0, 1];   // u: to the reader's right as the game draws the car: its +y on the left of the heading (render/live/gpu.ts placeMesh), so the text is laid mirrored in the file's own axes
  const at = (x: number, y: number, h: number): V => add(add(add(m.o, u, x), up, y), n, h), flip = n[0] * u[1] < 0;
  const quad = (p: V, q: V, r: V, t: V) => flip ? b.quad(t, r, q, p) : b.quad(p, q, r, t), rect = (x0: number, x1: number, y0: number, y1: number, h: number) => quad(at(x0, y0, h), at(x1, y0, h), at(x1, y1, h), at(x0, y1, h));
  b.name('platePlinth').mat('#1b1c1e', 0.05, 'plain'); rect(-W / 2 - 22, W / 2 + 22, -H / 2 - 16, H / 2 + 16, 1);   // its own flat ground: nothing of the bumper shows through or crosses it
  b.name('plateFrame').mat('#c2c5c9', 0.6, 'plain'); rect(-W / 2 - 9, W / 2 + 9, -H / 2 - 9, H / 2 + 9, 3);
  b.name('plate').mat('#12804c', 0.3, 'plain'); rect(-W / 2, W / 2, -H / 2, H / 2, 5);
  b.name('plateText').mat('#f1f3f2', 0.2, 'plain');
  const face: StrokeFace = { quad, tri: (p, q, r) => flip ? b.tri(p, r, q) : b.tri(p, q, r) }, band = (pts: number[][], t: number) => strokeBand(face, at, pts, t, 6);
  const word = (s: string, x0: number, y0: number, w: number, h: number, gap: number, t: number) => [...s].forEach((ch, k) => { for (const line of glyph(ch) ?? []) band(line.map(q => [x0 + k * (w + gap) + q[0]! * w, y0 + q[1]! * h]), t); });
  word(text.top, -58, 38, 30, 34, 13, 8); word(text.big, -138, -68, 50, 86, 24, 13);
  b.name('plateBolt').mat('#0f6b40', 0.3, 'plain'); for (const x of [-98, 98]) { const c = at(x, 52, 6), ring = Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2; return add(add(c, u, Math.cos(a) * 11), up, Math.sin(a) * 11); }), top = add(c, n, 5); for (let i = 0; i < 6; i++) flip ? b.tri(top, ring[(i + 1) % 6]!, ring[i]!) : b.tri(top, ring[i]!, ring[(i + 1) % 6]!); } }

/** what a stroke is laid with: a quad and a triangle, each wound to face out of the surface the figure is drawn on */
export interface StrokeFace { quad(p: V, q: V, r: V, t: V): void; tri(a: V, b: V, c: V): void }
/** a figure's stroke (the plate's figures, the tail's lettering): a band of one width `t` along the polyline `pts` (the
 *  figure's own x, y), `h` off the surface; `at(x, y, h)` is that point on the car. Gentle corners are mitred; at a sharp
 *  corner (a turn over about 75 degrees) the band ends at the corner, a new one starts there, and a round patch of the
 *  stroke's width covers the joint. A closed figure with no sharp corner is one band all round. */
export function strokeBand(face: StrokeFace, at: (x: number, y: number, h: number) => V, pts: number[][], t: number, h: number): void {
  // one band along the whole polyline, mitred at its corners (no notches), square at its ends
  const strip = (pts: number[][], closed: boolean, cap0 = true, cap1 = true) => { const n = pts.length, m = closed ? n - 1 : n, dir = (i: number, j: number) => { const dx = pts[j]![0]! - pts[i]![0]!, dy = pts[j]![1]! - pts[i]![1]!, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    const L: number[][] = [], R: number[][] = [];
    for (let i = 0; i < m; i++) { const d0 = i > 0 ? dir(i - 1, i) : closed ? dir(m - 1, 0) : dir(0, 1), d1 = i + 1 < n ? dir(i, i + 1) : closed ? dir(0, 1) : d0, bx = d0[0]! + d1[0]!, by = d0[1]! + d1[1]!, bl = Math.hypot(bx, by) || 1, nx = -by / bl, ny = bx / bl, k = t / 2 / Math.max(0.5, nx * -d0[1]! + ny * d0[0]!);
      const end = !closed && ((i === 0 && cap0) || (i === m - 1 && cap1)) ? (i === 0 ? -1 : 1) * t / 2 : 0, px = pts[i]![0]! + d0[0]! * end, py = pts[i]![1]! + d0[1]! * end; L.push([px + nx * k, py + ny * k]); R.push([px - nx * k, py - ny * k]); }
    for (let i = 0; i + 1 < m || (closed && i < m); i++) { const j = (i + 1) % m; face.quad(at(R[i]![0]!, R[i]![1]!, h), at(R[j]![0]!, R[j]![1]!, h), at(L[j]![0]!, L[j]![1]!, h), at(L[i]![0]!, L[i]![1]!, h)); } };
  const n = pts.length, closed = n > 3 && Math.hypot(pts[0]![0]! - pts[n - 1]![0]!, pts[0]![1]! - pts[n - 1]![1]!) < 1e-6, turn = (i: number) => { const a = pts[i - 1]!, c = pts[i]!, e = pts[i + 1]!, l0 = Math.hypot(c[0]! - a[0]!, c[1]! - a[1]!) || 1, l1 = Math.hypot(e[0]! - c[0]!, e[1]! - c[1]!) || 1; return ((c[0]! - a[0]!) * (e[0]! - c[0]!) + (c[1]! - a[1]!) * (e[1]! - c[1]!)) / l0 / l1; };
  const cuts = [0]; for (let i = 1; i + 1 < n; i++) if (turn(i) < 0.25) cuts.push(i); cuts.push(n - 1);
  if (closed && cuts.length === 2) { strip(pts, true); return; } for (let q = 0; q + 1 < cuts.length; q++) strip(pts.slice(cuts[q]!, cuts[q + 1]! + 1), false, q === 0, q + 2 === cuts.length);
  for (const i of cuts.slice(1, -1)) { const c = pts[i]!, o8 = Array.from({ length: 8 }, (_, k) => { const a2 = (k + 0.5) / 8 * Math.PI * 2; return at(c[0]! + Math.cos(a2) * t * 0.54, c[1]! + Math.sin(a2) * t * 0.54, h); }); for (let k = 1; k + 1 < 8; k++) face.tri(o8[0]!, o8[k]!, o8[k + 1]!); } }
