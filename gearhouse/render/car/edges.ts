// A mesh's edges and surfaces (docs/systems/109 §5, docs/systems/108 §3.4 items 1-3): the triangles welded where their
// corners meet, each edge with the faces on it and the angle between them. From that:
//   surfaceNormals  the shading's normals smoothed over a surface (one kind of material, whatever part a triangle is
//                   in), each corner's faces weighted by their angle there, split along the hard edges: a fold over the
//                   crease angle, an edge the mesh marks as a crease, a change of material, an edge of three faces
//   hullNormals     one normal per welded point over every face there (the outline's inverted hull is pushed along it,
//                   so its corners stay closed where the shading's normals split)
//   hardEdgeLines   the drift-game style's lines for a mesh that brings none: the seams between named panels, the
//                   rims where paint meets trim, lamp or grille, the folds of the paint over the crease angle, chained
//                   into polylines
// Corners are given as a triangle soup: nine numbers a triangle (mm), as the meshes hold them.
import { KINDS, type Mesh, type MeshLine, type LineKind, type V } from './mesh';

/** a point's weld key: corners within half a millimetre are the same point */
export const weldKey = (x: number, y: number, z: number): string => `${Math.round(x * 2)},${Math.round(y * 2)},${Math.round(z * 2)}`;
export interface Welded { /** each corner's point (triangle * 3 + k) */ vid: Int32Array; /** the points */ nv: number; /** each triangle's unit normal (by its winding; 0 for one with no area) */ fn: Float32Array; /** each corner's angle (rad) */ ang: Float32Array }
/** the triangles' corners welded into points, with each triangle's normal and each corner's angle */
export function weld(P: ArrayLike<number>, nt: number): Welded {
  const vid = new Int32Array(nt * 3), fn = new Float32Array(nt * 3), ang = new Float32Array(nt * 3), at = new Map<string, number>();
  for (let c = 0; c < nt * 3; c++) { const k = weldKey(P[c * 3]!, P[c * 3 + 1]!, P[c * 3 + 2]!); let v = at.get(k); if (v === undefined) { v = at.size; at.set(k, v); } vid[c] = v; }
  for (let t = 0; t < nt; t++) { const q = t * 9, ax = P[q + 3]! - P[q]!, ay = P[q + 4]! - P[q + 1]!, az = P[q + 5]! - P[q + 2]!, bx = P[q + 6]! - P[q]!, by = P[q + 7]! - P[q + 1]!, bz = P[q + 8]! - P[q + 2]!;
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, l = Math.hypot(nx, ny, nz); if (l > 1e-9) { fn[t * 3] = nx / l; fn[t * 3 + 1] = ny / l; fn[t * 3 + 2] = nz / l; }
    for (let k = 0; k < 3; k++) { const o = q + k * 3, a = q + ((k + 1) % 3) * 3, b = q + ((k + 2) % 3) * 3, ux = P[a]! - P[o]!, uy = P[a + 1]! - P[o + 1]!, uz = P[a + 2]! - P[o + 2]!, wx = P[b]! - P[o]!, wy = P[b + 1]! - P[o + 1]!, wz = P[b + 2]! - P[o + 2]!;
      const lu = Math.hypot(ux, uy, uz), lw = Math.hypot(wx, wy, wz); ang[t * 3 + k] = lu > 1e-9 && lw > 1e-9 ? Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy + uz * wz) / (lu * lw)))) : 0; } }
  return { vid, nv: at.size, fn, ang }; }
/** each edge (by its two points, the lower first) and the triangles on it, with the corner each starts at */
export function edgesOf(w: Welded, nt: number): Map<number, { a: number; b: number; tris: number[]; from: number[] }> {
  const E = new Map<number, { a: number; b: number; tris: number[]; from: number[] }>();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const p = w.vid[t * 3 + k]!, q = w.vid[t * 3 + (k + 1) % 3]!; if (p === q) continue; const a = Math.min(p, q), b = Math.max(p, q), key = a * w.nv + b;
    let e = E.get(key); if (!e) { e = { a, b, tris: [], from: [] }; E.set(key, e); } e.tris.push(t); e.from.push(p); }
  return E; }
/** the angle between two triangles' normals (degrees): 0 flat, 90 a square fold; two faces wound against each other read near 180 */
export function foldDeg(w: Welded, f: number, g: number): number { const d = w.fn[f * 3]! * w.fn[g * 3]! + w.fn[f * 3 + 1]! * w.fn[g * 3 + 1]! + w.fn[f * 3 + 2]! * w.fn[g * 3 + 2]!; return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI; }
/** the edges a mesh marks as creases, as weld-key pairs */
const creaseSet = (creases?: [V, V][]): Set<string> => { const S = new Set<string>(); for (const [a, b] of creases ?? []) { const p = weldKey(...a), q = weldKey(...b); S.add(p < q ? `${p}|${q}` : `${q}|${p}`); } return S; };

/** the shading's normals, three numbers a corner: smoothed over each surface (triangles of one `group`, whatever their
 *  part), each corner's faces weighted by their angle there, split along every hard edge (a fold over `crease`
 *  degrees, an edge in `creases`, a change of group, an edge with other than two faces). A corner of a triangle with
 *  no area takes +z. */
export function surfaceNormals(P: ArrayLike<number>, nt: number, group: ArrayLike<number>, opts: { crease?: number; creases?: [V, V][] } = {}): Float32Array {
  const w = weld(P, nt), E = edgesOf(w, nt), thr = opts.crease ?? 35, marked = creaseSet(opts.creases), N = new Float32Array(nt * 9);
  const up = Int32Array.from({ length: nt * 3 }, (_, i) => i), root = (i: number): number => { while (up[i] !== i) i = up[i] = up[up[i]!]!; return i; }, join = (i: number, j: number) => { const a = root(i), b = root(j); if (a !== b) up[a] = b; };
  const cornerAt = (t: number, v: number) => w.vid[t * 3] === v ? t * 3 : w.vid[t * 3 + 1] === v ? t * 3 + 1 : t * 3 + 2;
  const keyOf = (v: number, t: number) => { const c = cornerAt(t, v); return weldKey(P[c * 3]!, P[c * 3 + 1]!, P[c * 3 + 2]!); };
  for (const e of E.values()) { if (e.tris.length !== 2) continue; const [f, g] = e.tris as [number, number];
    if (group[f] !== group[g] || e.from[0] === e.from[1] || foldDeg(w, f, g) > thr) continue;   /* wound the same way along the edge: the faces turn against each other */
    if (marked.size) { const p = keyOf(e.a, f), q = keyOf(e.b, f); if (marked.has(p < q ? `${p}|${q}` : `${q}|${p}`)) continue; }
    join(cornerAt(f, e.a), cornerAt(g, e.a)); join(cornerAt(f, e.b), cornerAt(g, e.b)); }
  const S = new Float64Array(nt * 9);
  for (let c = 0; c < nt * 3; c++) { const t = Math.floor(c / 3), r = root(c), a = w.ang[c]!; S[r * 3]! += w.fn[t * 3]! * a; S[r * 3 + 1]! += w.fn[t * 3 + 1]! * a; S[r * 3 + 2]! += w.fn[t * 3 + 2]! * a; }
  for (let c = 0; c < nt * 3; c++) { const r = root(c), t = Math.floor(c / 3); let x = S[r * 3]!, y = S[r * 3 + 1]!, z = S[r * 3 + 2]!; let l = Math.hypot(x, y, z);
    if (!(l > 1e-9)) { x = w.fn[t * 3]!; y = w.fn[t * 3 + 1]!; z = w.fn[t * 3 + 2]!; l = Math.hypot(x, y, z); if (!(l > 1e-9)) { x = 0; y = 0; z = 1; l = 1; } }
    N[c * 3] = x / l; N[c * 3 + 1] = y / l; N[c * 3 + 2] = z / l; }
  return N; }

/** the inverted hull's normals, three numbers a corner: at each welded point the angle-weighted mean of every face
 *  there (a thin sheet whose two sides cancel takes its own face's normal) */
export function hullNormals(P: ArrayLike<number>, nt: number): Float32Array {
  const w = weld(P, nt), S = new Float64Array(w.nv * 3), N = new Float32Array(nt * 9);
  for (let c = 0; c < nt * 3; c++) { const t = Math.floor(c / 3), v = w.vid[c]!, a = w.ang[c]!; S[v * 3]! += w.fn[t * 3]! * a; S[v * 3 + 1]! += w.fn[t * 3 + 1]! * a; S[v * 3 + 2]! += w.fn[t * 3 + 2]! * a; }
  for (let c = 0; c < nt * 3; c++) { const t = Math.floor(c / 3), v = w.vid[c]!; let x = S[v * 3]!, y = S[v * 3 + 1]!, z = S[v * 3 + 2]!, l = Math.hypot(x, y, z);
    if (!(l > 0.2)) { x = w.fn[t * 3]!; y = w.fn[t * 3 + 1]!; z = w.fn[t * 3 + 2]!; l = Math.hypot(x, y, z) || 1; }
    N[c * 3] = x / l; N[c * 3 + 1] = y / l; N[c * 3 + 2] = z / l; }
  return N; }

/** segments joined end to end into polylines (a closed loop repeats its first point last); only segments of one kind join */
export function chain(segs: { a: number; b: number; kind: LineKind }[], at: (v: number) => V): MeshLine[] {
  const out: MeshLine[] = [], byKind = new Map<LineKind, { a: number; b: number }[]>(); for (const s of segs) { const l = byKind.get(s.kind); if (l) l.push(s); else byKind.set(s.kind, [s]); }
  for (const [kind, L] of byKind) { const adj = new Map<number, number[]>(), used = new Uint8Array(L.length); L.forEach((s, i) => { for (const v of [s.a, s.b]) { const l = adj.get(v); if (l) l.push(i); else adj.set(v, [i]); } });
    const walk = (start: number, from: number): number[] => { const path = [from]; let v = from, i = start; for (;;) { used[i] = 1; const s = L[i]!, nx = s.a === v ? s.b : s.a; path.push(nx); v = nx; const next = (adj.get(v) ?? []).filter(j => !used[j]); if ((adj.get(v)?.length ?? 0) !== 2 || !next.length) break; i = next[0]!; } return path; };
    for (const [v, l] of adj) if (l.length !== 2) for (const i of l) if (!used[i]) out.push({ kind, pts: walk(i, v).map(at) });   /* open chains start at an end or a branch */
    L.forEach((s, i) => { if (!used[i]) { const p = walk(i, s.a); out.push({ kind, pts: p.map(at), closed: true }); } }); }   /* what is left: loops */
  return out; }
const PAINT = KINDS.indexOf('paint'), PLAIN = KINDS.indexOf('plain'), GRILLE = KINDS.indexOf('grille'), LENS = KINDS.indexOf('lens');
/** the lines found at a mesh's hard edges (for a mesh with no lines of its own), over the triangles `tris` (default all):
 *  where two named panels of paint meet ('panel'), where paint meets trim, a lamp or a grille ('trim'), where paint
 *  folds over `crease` degrees (default 40; 'crease', those under twice `minLen` dropped); the raised seam strips of the kit cars and lines shorter than `minLen` mm left out */
export function hardEdgeLines(M: Mesh, opts: { tris?: number[]; crease?: number; minLen?: number } = {}): MeshLine[] {
  const T = opts.tris ?? Array.from({ length: M.n }, (_, i) => i), nt = T.length, P = new Float32Array(nt * 9); T.forEach((t, j) => P.set(M.pos.subarray(t * 9, t * 9 + 9), j * 9));
  const w = weld(P, nt), E = edgesOf(w, nt), thr = opts.crease ?? 40, name = (j: number) => M.names?.[M.part[T[j]!]!] ?? '', kind = (j: number) => M.kind[T[j]!]!;
  const pt = new Map<number, V>(); for (let c = 0; c < nt * 3; c++) if (!pt.has(w.vid[c]!)) pt.set(w.vid[c]!, [P[c * 3]!, P[c * 3 + 1]!, P[c * 3 + 2]!]);
  const lineable = (k: number) => k === PAINT || k === PLAIN || k === GRILLE || k === LENS, segs: { a: number; b: number; kind: LineKind }[] = [];
  for (const e of E.values()) { if (e.tris.length !== 2) continue; const [f, g] = e.tris as [number, number], kf = kind(f), kg = kind(g);
    if (!lineable(kf) || !lineable(kg) || (kf !== PAINT && kg !== PAINT) || name(f) === 'seam' || name(g) === 'seam') continue;
    const k: LineKind | null = kf !== kg ? 'trim' : name(f) !== name(g) ? 'panel' : foldDeg(w, f, g) > thr ? 'crease' : null; if (k) segs.push({ a: e.a, b: e.b, kind: k }); }
  const minLen = opts.minLen ?? 40, len = (l: MeshLine) => { let s = 0; for (let i = 1; i < l.pts.length; i++) s += Math.hypot(l.pts[i]![0] - l.pts[i - 1]![0], l.pts[i]![1] - l.pts[i - 1]![1], l.pts[i]![2] - l.pts[i - 1]![2]); return s; };
  return chain(segs, v => pt.get(v)!).filter(l => len(l) >= (l.kind === 'crease' ? minLen * 2 : minLen)); }   /* a short fold is noise on a curved panel; a short seam still marks a lamp or a vent */
