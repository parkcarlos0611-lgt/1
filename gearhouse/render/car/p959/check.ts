// The 959 shell measured against the surface rules of docs/systems/108 (section 4.2), on the shell's own lines of
// points: every panel is a patch of the main grid (cage rows and columns), so its lines along the car and across it
// are known. The measures are those of tools/ref/surfacecheck.ts: a line's turning at each point (convex +), the
// changes of its sign (a wave), short dimples, a cell's twist, a flat panel's distance from its plane, the fold at
// every edge, and the shading error of the game's normals against the surface's own.
import { NC, NR, type Tag } from './cage';
import { cut, type Shell959 } from './shell';
import { ekey, faceNormal, type V } from './subdiv';

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, DEG = 180 / Math.PI, ang = (a: V, b: V) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * DEG;
const pct = (v: number[], p: number) => { const s = v.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))]! : 0; };

/** a panel: cage rows i0..i1 and columns j0..j1 of the main grid. `across`, `along`: the changes of curvature sign a
 *  line may have (declared: a pod's flank turns from hollow to round once); `flat`: it is meant flat (mm from its plane) */
export interface Panel { name: string; rows: [number, number]; cols: [number, number]; across?: number; along?: number; flat?: number; why?: string }
export const PANELS: Panel[] = [
  { name: 'bonnet', rows: [0, 10], cols: [0, 3] },
  { name: 'wingF top (pod)', rows: [3, 8], cols: [3, 6], across: 1, along: 2, why: 'the pod rises out of the bonnet\'s valley (hollow at its foot, round over its crest); along it, the hollow behind the lamp\'s rim and the sweep up to the screen pillar' },
  { name: 'wingF side', rows: [0, 4], cols: [7, 9] },
  { name: 'roof', rows: [14, 19], cols: [0, 3] },
  { name: 'door', rows: [10, 15], cols: [5, 9] },
  { name: 'door lower (flat)', rows: [11, 15], cols: [8, 9], flat: 2 },
  { name: 'sill', rows: [10, 16], cols: [10, 12] },
  { name: 'haunch', rows: [18, 19], cols: [5, 8] },
  { name: 'wingR top', rows: [23, 25], cols: [3, 6], across: 2, along: 1, why: 'the C pillar\'s foot is a hollow between the pillar and the wing top; along the car the deck sweeps from the glass\'s slope to the lid' },
  { name: 'wingR side', rows: [24, 30], cols: [7, 8], along: 1, why: 'the upper side sweeps up into the wing blade\'s leg' },
  { name: 'wing blade', rows: [28, 30], cols: [0, 5] },
];

/** the fine points of the main grid: [2 * row][2 * column] the cage points', between them the edges' and faces' (-1 none) */
export function fineGrid(S: Shell959): number[][] { const M = S.cage.M, f = S.fine, faceOf = new Map<string, number>(); S.cage.F.forEach((q, k) => faceOf.set(q.slice().sort((a, b) => a - b).join(','), k));
  const G: number[][] = Array.from({ length: 2 * NR - 1 }, () => new Array<number>(2 * NC - 1).fill(-1)), at = (i: number, j: number) => M[i]?.[j] ?? -1;
  for (let i = 0; i < NR; i++) for (let j = 0; j < NC; j++) { const a = at(i, j); if (a < 0) continue; G[2 * i]![2 * j] = f.vp[a]!;
    const b = at(i + 1, j), d = at(i, j + 1), c = at(i + 1, j + 1); if (b >= 0) G[2 * i + 1]![2 * j] = f.ep.get(ekey(a, b)) ?? -1; if (d >= 0) G[2 * i]![2 * j + 1] = f.ep.get(ekey(a, d)) ?? -1;
    if (b >= 0 && c >= 0 && d >= 0) { const k = faceOf.get([a, b, c, d].sort((x, y) => x - y).join(',')); if (k !== undefined) G[2 * i + 1]![2 * j + 1] = f.fp[k]!; } }
  return G; }

export interface LineStat { changes: number; dimples: number; deepest: number }
/** a line's turning (degrees at each inner point, convex +), given the way out of the surface at each point */
export function turning(pts: V[], out: V[]): number[] { const k = pts.map(() => 0);
  for (let i = 1; i + 1 < pts.length; i++) { const d1 = sub(pts[i]!, pts[i - 1]!), d2 = sub(pts[i + 1]!, pts[i]!); if (len(d1) < 0.5 || len(d2) < 0.5) continue; const a = ang(d1, d2), t = sub(unit(d2), unit(d1)); k[i] = dot(t, out[i]!) > 0 ? -a : a; } return k; }
const SIG = 0.4;
export function lineStat(pts: V[], out: V[]): LineStat { const k = turning(pts, out), sig = k.map((v, i) => ({ v, i })).filter(o => Math.abs(o.v) >= SIG); let changes = 0, dimples = 0, deepest = 0;
  for (let q = 1; q < sig.length; q++) if (Math.sign(sig[q]!.v) !== Math.sign(sig[q - 1]!.v)) changes++;
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + len(sub(pts[i]!, pts[i - 1]!)));
  for (let q = 1; q + 1 < sig.length; q++) { if (sig[q]!.v >= 0) continue; let r = q; while (r + 1 < sig.length && sig[r + 1]!.v < 0) r++; if (r + 1 >= sig.length) break; if (sig[q - 1]!.v <= 0) { q = r; continue; }
    const A = pts[sig[q - 1]!.i]!, B = pts[sig[r + 1]!.i]!, ab = sub(B, A); let depth = 0;
    for (let i = sig[q - 1]!.i + 1; i < sig[r + 1]!.i; i++) { const p = pts[i]!, t = Math.max(0, Math.min(1, dot(sub(p, A), ab) / (dot(ab, ab) || 1))), c: V = [A[0] + ab[0] * t, A[1] + ab[1] * t, A[2] + ab[2] * t]; depth = Math.max(depth, -dot(sub(p, c), out[i]!)); }
    if (cum[sig[r + 1]!.i]! - cum[sig[q - 1]!.i]! < 400 && depth >= 0.3) { dimples++; deepest = Math.max(deepest, depth); } q = r; }
  return { changes, dimples, deepest }; }

export interface PanelStat { panel: Panel; lines: number; /** the most sign changes on one line across the car and along it */ across: number; along: number; dimples: number; twistP95: number; twistMax: number; /** furthest point from the panel's plane (mm) */ off: number }
export interface Measure { panels: PanelStat[]; /** edges of the painted skin by fold: under 8, 8-20, 20-35 not at a crease (should be none on a panel), 35 and over not at a crease */ smooth: number; soft: number; mushy: { at: V; deg: number; panel: string }[]; unmarked: { at: V; deg: number; panel: string }[]; slivers: number }
export function measure(S: Shell959): Measure { const G = fineGrid(S), P = S.P;
  // the way out at each point: its faces' normals
  const vn: V[] = P.map(() => [0, 0, 0]); S.F.forEach(f => { const n = faceNormal(P, f); for (const v of f) { const o = vn[v]!; o[0] += n[0]; o[1] += n[1]; o[2] += n[2]; } }); const out = vn.map(unit);
  const panels: PanelStat[] = PANELS.map(p => { const [i0, i1] = [p.rows[0] * 2, p.rows[1] * 2], [j0, j1] = [p.cols[0] * 2, p.cols[1] * 2]; let across = 0, along = 0, dimples = 0, lines = 0; const twist: number[] = [];
    const run = (idx: number[], al: boolean) => { let cur: number[] = []; const flush = () => { if (cur.length >= 4) { const st = lineStat(cur.map(v => P[v]!), cur.map(v => out[v]!)); lines++; dimples += st.dimples; if (al) along = Math.max(along, st.changes); else across = Math.max(across, st.changes); } cur = []; }; for (const v of idx) { if (v >= 0) cur.push(v); else flush(); } flush(); };
    for (let j = j0; j <= j1; j++) run(Array.from({ length: i1 - i0 + 1 }, (_, k) => G[i0 + k]![j]!), true);
    for (let i = i0; i <= i1; i++) run(Array.from({ length: j1 - j0 + 1 }, (_, k) => G[i]![j0 + k]!), false);
    const pts: V[] = []; for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const v = G[i]![j]!; if (v >= 0) pts.push(P[v]!); }
    for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) { const q = [G[i]![j]!, G[i + 1]![j]!, G[i + 1]![j + 1]!, G[i]![j + 1]!]; if (q.some(v => v < 0)) continue; const nn = (a: number, b: number, c: number) => unit(faceNormal(P, [q[a]!, q[b]!, q[c]!]));
      twist.push(Math.acos(Math.min(1, Math.max(dot(nn(0, 1, 2), nn(0, 2, 3)), dot(nn(1, 2, 3), nn(1, 3, 0))))) * DEG); }
    // the plane through the panel's points (least squares, by the smallest of three candidate axes), and the furthest point from it
    let off = 0; if (pts.length >= 3) { const c: V = [0, 0, 0]; for (const q of pts) { c[0] += q[0] / pts.length; c[1] += q[1] / pts.length; c[2] += q[2] / pts.length; } let n: V = [0, 0, 0]; for (let a = 0; a + 1 < pts.length; a++) { const u = sub(pts[a]!, c), w = sub(pts[a + 1]!, c), x: V = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; if (dot(x, n) < 0) { n[0] -= x[0]; n[1] -= x[1]; n[2] -= x[2]; } else { n[0] += x[0]; n[1] += x[1]; n[2] += x[2]; } }
      n = unit(n); for (const q of pts) off = Math.max(off, Math.abs(dot(sub(q, c), n))); }
    return { panel: p, lines, across, along, dimples, twistP95: pct(twist, 0.95), twistMax: Math.max(0, ...twist), off }; });
  // the folds of the painted skin
  const paint = (t: Tag) => t.mat === 'paint', E = new Map<string, number[]>(); S.F.forEach((f, k) => { if (!paint(S.tag[k]!)) return; f.forEach((a, q) => { const key = ekey(a, f[(q + 1) % f.length]!); (E.get(key) ?? E.set(key, []).get(key)!).push(k); }); });
  let smooth = 0, soft = 0, slivers = 0; const mushy: Measure['mushy'] = [], unmarked: Measure['unmarked'] = [];
  for (const [key, fs] of E) { if (fs.length !== 2) continue; const d = ang(faceNormal(P, S.F[fs[0]!]!), faceNormal(P, S.F[fs[1]!]!)), [a] = key.split('|').map(Number) as [number, number];
    if (d < 8) smooth++; else if (d < 20) soft++; else if (!S.crease.has(key) && !/Rim$|archLip/.test(S.tag[fs[0]!]!.panel) && !/Rim$|archLip/.test(S.tag[fs[1]!]!.panel)) (d < 35 ? mushy : unmarked).push({ at: P[a]!, deg: d, panel: S.tag[fs[0]!]!.panel }); }
  S.F.forEach((f, k) => { if (!paint(S.tag[k]!) || /Rim$/.test(S.tag[k]!.panel)) return; for (const t of cut(P, f)) { const [a, b, c] = t.map(v => P[v]!) as [V, V, V]; if (Math.min(ang(sub(b, a), sub(c, a)), ang(sub(a, b), sub(c, b)), ang(sub(a, c), sub(b, c))) < 5) slivers++; } });
  return { panels, smooth, soft, mushy, unmarked, slivers }; }

/** The shading error (docs/systems/108 S7): the game's normals (render/car/edges.ts surfaceNormals: smoothed per
 *  surface, split at the mesh's creases, at folds over 35 degrees and where the material changes) against the shell's
 *  own (angle weighted over the whole skin, split only at the marked creases), at every corner of the painted
 *  triangles. `game` and `own`: nine numbers a triangle; `paint`: which triangles count. */
export function shadingError(game: ArrayLike<number>, own: ArrayLike<number>, n: number, paint: (t: number) => boolean): { corners: number; over3: number; p95: number; max: number } { const e: number[] = [];
  for (let t = 0; t < n; t++) { if (!paint(t)) continue; for (let q = 0; q < 3; q++) { const i = t * 9 + q * 3; e.push(ang([game[i]!, game[i + 1]!, game[i + 2]!], [own[i]!, own[i + 1]!, own[i + 2]!])); } }
  return { corners: e.length, over3: e.filter(v => v > 3).length, p95: pct(e, 0.95), max: Math.max(0, ...e) }; }
