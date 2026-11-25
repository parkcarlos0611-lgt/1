// The 959's marks made real (docs/systems/116, steps B2 and B3): the Phorster crest on the front lid, a thin plate cut to
// the shield's outline and painted from the style atlas's crest cell, and the PHORSTER lettering across the tail, its
// letters drawn as strokes like the number plate's figures. Both sit on the skin itself: each corner is found on the
// shell by a ray along the mark's normal, so the plate stands just proud of the lid's curve and the letters follow the
// tail band's, with nothing floating and nothing sunk.
import type { Build, Mesh } from '../mesh';
import { ATLAS_CELLS } from '../../live/style';
import { CREST_BOX, CREST_OUTLINE, CREST_COLOURS } from '../../live/crest.gen';
import { cut } from './shell';
import { strokeBand, type StrokeFace } from './parts';
import type { Mark } from './sockets';
import type { V } from './subdiv';

const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k], sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const hex = (c: readonly number[]) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

/** the skin near a mark: its triangles within `reach` mm of the mark's centre, and a ray's distance to them */
export interface Skin { hit(o: V, d: V): number | null }
export function skinNear(P: V[], F: number[][], at: V, reach: number): Skin {
  const T: [V, V, V][] = [];
  for (const f of F) for (const t of cut(P, f)) { const a = P[t[0]]!, b = P[t[1]]!, c = P[t[2]]!; if ([a, b, c].some(p => Math.abs(p[0] - at[0]) < reach && Math.abs(p[1] - at[1]) < reach && Math.abs(p[2] - at[2]) < reach)) T.push([a, b, c]); }
  return { hit(o, d) { let best: number | null = null;   // the nearest crossing ahead (Moller-Trumbore)
    for (const [a, b, c] of T) { const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p); if (Math.abs(det) < 1e-9) continue;
      const s = sub(o, a), u = dot(s, p) / det; if (u < 0 || u > 1) continue; const q = cross(s, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) continue;
      const t = dot(e2, q) / det; if (t > 0 && (best === null || t < best)) best = t; }
    return best; } }; }

/** a triangle wound to face `out` */
const facing = (b: Build, p: V, q: V, r: V, out: V) => dot(cross(sub(q, p), sub(r, p)), out) >= 0 ? b.tri(p, q, r) : b.tri(p, r, q);

// ---- B2: the crest ----
/** where the crest lies: its centre on the plate's face, the face's normal, the reader's right and the shield's up, its size (mm) */
export interface CrestFrame { c: V; n: V; ex: V; ey: V; W: number; H: number }
/** the plate's height over the highest point of the skin under it, and how far its sides reach into the skin (mm) */
const RAISE = 1.2, SINK = 0.8;
/** the crest plate on its mark: the shield's outline (24 points) as a flat plate laid to the skin's plane there, its face
 *  painted from the atlas (crestUV), its sides the rim's dark gold. 72 triangles. */
export function crestPlate(b: Build, m: Mark, skin: Skin): CrestFrame {
  const H = m.h, W = H * CREST_BOX[2] / CREST_BOX[3], n0 = unit(m.n);
  // the reader's right: across the car (the file's +y is on the car's left as the game draws it, so the reader standing
  // before the nose has it on the right, as for the front plate); the shield's up: along the lid, toward the screen
  const across = (n: V): V => unit(sub([0, 1, 0], [n[0] * n[1], n[1] * n[1], n[2] * n[1]]));
  const down = (o: V, n: V) => { const h = skin.hit(add(o, n, 40), [-n[0], -n[1], -n[2]]); return h === null ? null : add(o, n, 40 - h); };
  // the skin's own plane under the mark: its centre and four points at the shield's edges
  let ex = across(n0), ey = cross(ex, n0); const c0 = down(m.o, n0) ?? m.o;
  const pR = down(add(c0, ex, W / 2), n0), pL = down(add(c0, ex, -W / 2), n0), pU = down(add(c0, ey, H / 2), n0), pD = down(add(c0, ey, -H / 2), n0);
  let n = n0; if (pR && pL && pU && pD) { n = unit(cross(sub(pR, pL), sub(pU, pD))); if (dot(n, n0) < 0) n = [-n[0], -n[1], -n[2]]; }
  ex = across(n); ey = cross(ex, n);
  const flat = (x: number, y: number): V => add(add(c0, ex, (x - 0.5) * W), ey, (0.5 - y) * H);
  // the skin under each corner of the outline and under the middle, as heights along the plate's normal
  const rim = CREST_OUTLINE.map(([x, y]) => flat(x, y)), under = [...rim, c0].map(p => { const q = down(p, n); return q ? dot(sub(q, c0), n) : 0; });
  const top = Math.max(...under) + RAISE, c = add(c0, n, top);
  b.name('badge').mat(hex(CREST_COLOURS.G), 0.4, 'plain');
  const T = rim.map(p => add(p, n, top));
  for (let i = 0; i < T.length; i++) facing(b, c, T[i]!, T[(i + 1) % T.length]!, n);
  b.name('badgeEdge').mat(hex(CREST_COLOURS.D), 0.4, 'plain');
  const B = rim.map((p, i) => add(p, n, under[i]! - SINK));
  for (let i = 0; i < T.length; i++) { const j = (i + 1) % T.length, out = sub(add(T[i]!, T[j]!), add(c, c)); facing(b, T[i]!, T[j]!, B[j]!, out); facing(b, T[i]!, B[j]!, B[i]!, out); }
  return { c, n, ex, ey, W, H }; }

/** the crest's atlas coordinates on a mesh: the plate's face (part 'badge') mapped flat from its frame into the crest
 *  cell's shield box; every other triangle none. `into` keeps coordinates a mesh already has. */
export function crestUV(M: Mesh, f0: CrestFrame | readonly CrestFrame[], into?: Float32Array): Float32Array {
  // several crests (docs/systems/115 P1: the badge placed freely, as many as its limit): each triangle mapped from the nearest one's frame
  const fs = Array.isArray(f0) ? f0 : [f0 as CrestFrame], near = (p: V) => fs.reduce((a, g) => { const d = sub(p, g.c), e = sub(p, a.c); return dot(d, d) < dot(e, e) ? g : a; }, fs[0]!);
  const uv = into ?? new Float32Array(M.n * 9), cell = ATLAS_CELLS.indexOf('badge') + 1, names = M.names ?? [];
  // the shader reads a cell at 0.004 + 0.992 u of its width (render/live/renderer.ts atlasAt): undone here, so the
  // shield's box falls exactly on its texels
  const toCell = (t: number) => (t - 0.004) / 0.992, [bx, by, bw, bh] = CREST_BOX;
  for (let t = 0; t < M.n; t++) { if (names[M.part[t]!] !== 'badge' || !fs.length) continue; const f = near([M.pos[t * 9]!, M.pos[t * 9 + 1]!, M.pos[t * 9 + 2]!]);
    for (let k = 0; k < 3; k++) { const o = t * 9 + k * 3, p: V = [M.pos[o]!, M.pos[o + 1]!, M.pos[o + 2]!], d = sub(p, f.c), x = dot(d, f.ex) / f.W + 0.5, y = 0.5 - dot(d, f.ey) / f.H;
      uv[o] = toCell((bx + bw * x) / 256); uv[o + 1] = toCell((by + bh * y) / 256); uv[o + 2] = cell; } }
  return uv; }

// ---- B3: the lettering ----
/** the lettering's capitals: strokes in a unit box (x right, y up), wide and square-shouldered like the crest's band.
 *  The crest's baked picture (tools/ref/crestbake.py) draws its band from the artwork itself, not from these. */
export const LETTERS: Record<string, number[][][]> = {
  P: [[[0, 0], [0, 1], [.82, 1], [1, .84], [1, .64], [.82, .48], [0, .48]]],
  H: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, .5], [1, .5]]],
  O: [[[.2, 0], [.8, 0], [1, .2], [1, .8], [.8, 1], [.2, 1], [0, .8], [0, .2], [.2, 0]]],
  R: [[[0, 0], [0, 1], [.82, 1], [1, .84], [1, .66], [.82, .5], [0, .5]], [[.5, .5], [1, 0]]],
  S: [[[1, .84], [.84, 1], [.16, 1], [0, .84], [0, .66], [.16, .52], [.84, .48], [1, .34], [1, .16], [.84, 0], [.16, 0], [0, .16]]],
  T: [[[0, 1], [1, 1]], [[.5, 1], [.5, 0]]],
  E: [[[1, 1], [0, 1], [0, 0], [1, 0]], [[0, .5], [.8, .5]]],
};
/** the lettering's look: its colour (silver on the red tail band: chrome, black and the body colour were the choices,
 *  silver reads best on the red by day and lit; doc 116 §6), its letters' height, width and stroke, and how far it
 *  stands off the band (mm) */
export const LETTERING = { colour: '#d3d6d9', capH: 46, letterW: 56, stroke: 7, lift: 1.5 } as const;
/** a word across a mark, centred, each corner set on the skin beneath it (a ray along the mark's normal) */
export function lettering(b: Build, m: Mark, skin: Skin, word = 'PHORSTER'): void {
  const n = unit(m.n), u: V = unit([0, -n[0], 0]), up: V = [0, 0, 1], flip = dot(cross(u, up), n) < 0, L = LETTERING;
  const onSkin = (x: number, y: number, h: number): V => { const p = add(add(m.o, u, x), up, y), d = skin.hit(add(p, n, 60), [-n[0], -n[1], -n[2]]); return add(p, n, (d === null ? 0 : 60 - d) + h); };
  const face: StrokeFace = { quad: (p, q, r, t) => flip ? b.quad(t, r, q, p) : b.quad(p, q, r, t), tri: (p, q, r) => flip ? b.tri(p, r, q) : b.tri(p, q, r) };
  const chars = [...word].filter(ch => LETTERS[ch]), gap = (m.w - 20 - chars.length * L.letterW) / Math.max(1, chars.length - 1), x0 = -m.w / 2 + 10;
  b.name('rearLettering').mat(L.colour, 0.5, 'plain');
  chars.forEach((ch, k) => { for (const line of LETTERS[ch]!) strokeBand(face, onSkin, line.map(q => [x0 + k * (L.letterW + gap) + q[0]! * L.letterW, (q[1]! - 0.5) * L.capH]), L.stroke, L.lift); }); }
