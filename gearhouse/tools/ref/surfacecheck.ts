// Surface quality check (docs/systems/108_style_standard.md): how clean the painted skin of a car is, measured on the
// mesh and on the generator's own grids, with a heat map per car.
//   npx tsx tools/ref/surfacecheck.ts [out dir=docs/reference] [mm=6] [only=<car id>]
// Cars: the kit cars (nsx, f355, eb110), the NSX with a tweak (the body warp), the four free-body presets.
// What it measures on the painted shell (kit: role 'shell', kind 'paint'; free body: kind 'paint'):
//   (a) folds      the signed dihedral angle across every edge (convex +, concave -). Bands: < 2 deg flat, 2-8 smooth,
//                  8-20 soft, 20-35 "mushy" (too sharp to read as a curve, too soft to read as a crease), >= 35 crease.
//                  An isolated fold: an edge of 6-35 deg standing more than 5 deg over the median of its 4 neighbours.
//   (b) curvature  the discrete mean curvature at every point (convex blue, concave red), isolated dimples (a concave
//                  point whose ring is all convex) and bumps; along the generator's grid lines (the kit's flank chains,
//                  front top, nose, deck, roof, tail; the free body's rings and their columns) the turning angle's sign
//                  changes, dimples (a concave run between convex ones) and their depth below the chord (mm)
//   (c) normals    the game's smooth normals (render/live/gpu.ts smoothNormals: per part and kind, faces within 40 deg,
//                  unweighted) against a reference (all the painted shell, angle weighted, within 40 deg): the shading
//                  error at each corner; seams where the normals split although the surface is smooth (dihedral < 30 deg)
// Also: the line tables' inflections (each height or width line's curvature changing sign), station spacing, sliver
// triangles. Picture per car: docs/reference/surface_<id>.png, rows (a), (b), (c); columns side, front 3/4, rear 3/4.
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePNG } from '../png';
import { KINDS, type Mesh } from '../../render/car/mesh';
import { assemble, type AssembleOpts } from '../../render/car/kit/assemble';
import { ROLES } from '../../render/car/kit/emit';
import { curve, type Grid, type Tab } from '../../render/car/kit/geom';
import { FLANK } from '../../render/car/kit/section';
import type { CarKit } from '../../render/car/kit/spec';
import { NSX_KIT } from '../../render/car/cars/nsx.kit';
import { F355_KIT } from '../../render/car/cars/f355.kit';
import { EB110_KIT } from '../../render/car/cars/eb110.kit';
import { buildFree } from '../../render/car/free/build';
import { JK, JLIP, M as FM, type Body } from '../../render/car/free/body';
import { CURVES } from '../../render/car/free/curves';
import { PRESETS } from '../../render/car/free/presets';

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const un = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const DEG = 180 / Math.PI, ang = (a: V, b: V) => Math.acos(Math.max(-1, Math.min(1, dot(un(a), un(b))))) * DEG;
const median = (v: number[]) => { const s = v.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0; };
const pct = (v: number[], p: number) => { const s = v.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))]! : 0; };
const f1 = (v: number) => v.toFixed(1), f0 = (v: number) => v.toFixed(0);

const args = process.argv.slice(2), out = args.find(a => !a.includes('=')) ?? 'docs/reference', mm = +(args.find(a => a.startsWith('mm='))?.slice(3) ?? 6), only = args.find(a => a.startsWith('only='))?.slice(5);
mkdirSync(out, { recursive: true });
const PAINT = KINDS.indexOf('paint'), GLASS = KINDS.indexOf('glass'), SHELL = ROLES.indexOf('shell');

// ---------------------------------------------------------------- the painted skin, welded
interface Skin { P: V[]; T: [number, number, number][]; tri: number[]; part: number[]; name: string[]; fn: V[]; area: number[] }
function weld(M: Mesh, pick: (t: number) => boolean): Skin { const ids = new Map<string, number>(), P: V[] = [], T: [number, number, number][] = [], tri: number[] = [], part: number[] = [], name: string[] = [], fn: V[] = [], area: number[] = [];
  const id = (i: number) => { const p: V = [M.pos[i]!, M.pos[i + 1]!, M.pos[i + 2]!], k = p.map(v => Math.round(v * 100)).join(','); let r = ids.get(k); if (r === undefined) { r = P.length; P.push(p); ids.set(k, r); } return r; };
  for (let t = 0; t < M.n; t++) { if (!pick(t)) continue; const a = id(t * 9), b = id(t * 9 + 3), c = id(t * 9 + 6); if (a === b || b === c || a === c) continue;
    const n = cross(sub(P[b]!, P[a]!), sub(P[c]!, P[a]!)), l = len(n); if (l < 1) continue;   // under 0.5 mm^2: the game drops these too
    T.push([a, b, c]); tri.push(t); part.push(M.part[t]!); name.push(M.names?.[M.part[t]!] ?? ''); fn.push([n[0] / l, n[1] / l, n[2] / l]); area.push(l / 2); }
  return { P, T, tri, part, name, fn, area }; }

interface Edge { a: number; b: number; t: number[]; th: number; anom: number; fold: boolean; split: boolean; jump: number; bad: boolean }
interface Analysis { S: Skin; E: Edge[]; vH: number[]; vRing: number[][]; cornerErr: number[]; dimples: number[]; bumps: number[]; slivers: number; inconsistent: number; soft: number }
function analyse(S: Skin): Analysis {
  const { P, T, fn } = S, map = new Map<string, number>(), E: Edge[] = [], triE: number[][] = T.map(() => []), vT: number[][] = P.map(() => []);
  T.forEach((tr, k) => { for (let q = 0; q < 3; q++) { const a = tr[q]!, b = tr[(q + 1) % 3]!, key = a < b ? `${a}|${b}` : `${b}|${a}`; let ei = map.get(key);
    if (ei === undefined) { ei = E.length; E.push({ a, b, t: [], th: 0, anom: 0, fold: false, split: false, jump: 0, bad: false }); map.set(key, ei); } E[ei]!.t.push(k); triE[k]!.push(ei); vT[a]!.push(k); } });
  let inconsistent = 0;
  for (const e of E) { if (e.t.length !== 2) continue; const [t1, t2] = e.t as [number, number], n1 = fn[t1]!, n2 = fn[t2]!, th = ang(n1, n2);
    const opp = T[t2]!.find(v => v !== e.a && v !== e.b)!, d = dot(n1, sub(P[opp]!, P[e.a]!)); e.th = d > 0 ? -th : th;
    // the same edge run the same way in both faces: their windings disagree (the sign is unreliable there)
    const dir = (t: number) => { const tr = T[t]!, i = tr.indexOf(e.a); return tr[(i + 1) % 3] === e.b; }; if (dir(t1) === dir(t2)) { e.bad = true; inconsistent++; } }
  for (const e of E) { if (e.t.length !== 2) continue; const nb: number[] = []; for (const t of e.t) for (const k of triE[t]!) { const o = E[k]!; if (o !== e && o.t.length === 2) nb.push(Math.abs(o.th)); }
    const m = median(nb); e.anom = Math.abs(e.th) - m; e.fold = Math.abs(e.th) >= 6 && Math.abs(e.th) < 35 && e.anom > 5; }
  // the discrete mean curvature at each point (1/m): the edges' signed angles times their lengths over the point's area
  const vA = P.map(() => 0), vS = P.map(() => 0), vRing: number[][] = P.map(() => []);
  T.forEach((tr, k) => { for (const v of tr) vA[v]! += S.area[k]! / 3; });
  for (const e of E) { if (e.t.length !== 2) continue; const l = len(sub(P[e.a]!, P[e.b]!)), w = e.th / DEG * l; vS[e.a]! += w; vS[e.b]! += w; vRing[e.a]!.push(e.b); vRing[e.b]!.push(e.a); }
  const open = new Set<number>(); for (const e of E) if (e.t.length !== 2) { open.add(e.a); open.add(e.b); }
  const vH = P.map((_, v) => open.has(v) || !vA[v] ? NaN : vS[v]! / (4 * vA[v]!) * 1000);
  const TH = 0.15, dimples: number[] = [], bumps: number[] = []; let soft = 0;
  P.forEach((_, v) => { const h = vH[v]!, R = vRing[v]!; if (!(Math.abs(h) > TH) || R.length < 3 || R.some(u => !Number.isFinite(vH[u]!))) return; if (h < 0 && R.every(u => vH[u]! > TH)) dimples.push(v); else if (h < -0.3 && R.filter(u => vH[u]! > TH).length >= R.length * 2 / 3) soft++; if (h > 0 && R.every(u => vH[u]! < -TH)) bumps.push(v); });
  // (c) the game's normals against the reference
  const cornerErr: number[] = new Array(T.length * 3).fill(0), gN: V[] = new Array(T.length * 3);
  const corner = (k: number, q: number, samePart: boolean, weighted: boolean): V => { const v = T[k]![q]!, f = fn[k]!; let s: V = [0, 0, 0];
    for (const u of vT[v]!) { if (samePart && S.part[u] !== S.part[k]) continue; const g = fn[u]!; if (dot(g, f) <= 0.766) continue; let w = 1;
      if (weighted) { const tr = T[u]!, i = tr.indexOf(v), a = sub(P[tr[(i + 1) % 3]!]!, P[v]!), b = sub(P[tr[(i + 2) % 3]!]!, P[v]!); w = ang(a, b) / DEG; }
      s = add(s, [g[0] * w, g[1] * w, g[2] * w]); } return len(s) > 0 ? un(s) : f; };
  T.forEach((_, k) => { for (let q = 0; q < 3; q++) { const g = corner(k, q, true, false), r = corner(k, q, false, true); gN[k * 3 + q] = g; cornerErr[k * 3 + q] = ang(g, r); } });
  for (const e of E) { if (e.t.length !== 2) continue; const [t1, t2] = e.t as [number, number]; let j = 0;
    for (const v of [e.a, e.b]) j = Math.max(j, ang(gN[t1 * 3 + T[t1]!.indexOf(v)]!, gN[t2 * 3 + T[t2]!.indexOf(v)]!));
    e.jump = j; e.split = Math.abs(e.th) < 30 && j > 2; }
  let slivers = 0; T.forEach(tr => { const a = P[tr[0]]!, b = P[tr[1]]!, c = P[tr[2]]!; if (Math.min(ang(sub(b, a), sub(c, a)), ang(sub(a, b), sub(c, b)), ang(sub(a, c), sub(b, c))) < 5) slivers++; });
  return { S, E, vH, vRing, cornerErr, dimples, bumps, slivers, inconsistent, soft };
}

// ---------------------------------------------------------------- grid lines (the generator's own sections)
interface LineHit { grid: string; line: string; at: V; depth: number; run: number }
interface GridStat { grid: string; lines: number; changes: number; dimples: LineHit[]; waves: number; /** folds: a point turning 4-30 deg, over three times either neighbour's turn (depth: the angle) */ folds: LineHit[];
  /** cells: how many, their twist (deg between the two triangles of the better cut), how often the cut's diagonal flips between neighbouring cells */ cells: number; twist: number[]; flips: number }
/** the signed turning (deg) at each interior point of a line (convex +), given an outward direction at each point */
function turning(pts: V[], out: (p: V, i: number) => V): number[] { const k: number[] = pts.map(() => 0);
  for (let i = 1; i + 1 < pts.length; i++) { const d1 = sub(pts[i]!, pts[i - 1]!), d2 = sub(pts[i + 1]!, pts[i]!); if (len(d1) < 0.5 || len(d2) < 0.5) continue; const a = ang(d1, d2), t = sub(un(d2), un(d1)); k[i] = dot(t, out(pts[i]!, i)) > 0 ? -a : a; }
  return k; }
const SIG = 0.4;
/** a line's sign changes and dimples: a concave run (turning < -SIG) between convex ones, its depth under their chord */
function lineCheck(grid: string, line: string, pts: V[], out: (p: V, i: number) => V, st: GridStat): void {
  if (pts.length < 4) return; st.lines++; const k = turning(pts, out), sig = k.map((v, i) => ({ v, i })).filter(o => Math.abs(o.v) >= SIG);
  for (let i = 1; i + 1 < pts.length; i++) { const a = Math.abs(k[i]!); if (a >= 4 && a < 30 && a > 3 * Math.max(Math.abs(k[i - 1]!), Math.abs(k[i + 1]!), 0.5)) st.folds.push({ grid, line, at: pts[i]!, depth: k[i]!, run: 0 }); }
  let changes = 0; for (let q = 1; q < sig.length; q++) if (Math.sign(sig[q]!.v) !== Math.sign(sig[q - 1]!.v)) changes++; st.changes += changes;
  // waves: two sign changes within 800 mm of the line
  const chg: number[] = []; for (let q = 1; q < sig.length; q++) if (Math.sign(sig[q]!.v) !== Math.sign(sig[q - 1]!.v)) chg.push(sig[q]!.i); const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + len(sub(pts[i]!, pts[i - 1]!)));
  for (let q = 1; q < chg.length; q++) if (cum[chg[q]!]! - cum[chg[q - 1]!]! < 800) { st.waves++; break; }
  for (let q = 1; q + 1 < sig.length; q++) { if (sig[q]!.v >= 0) continue; let r = q; while (r + 1 < sig.length && sig[r + 1]!.v < 0) r++; if (r + 1 >= sig.length) break; if (sig[q - 1]!.v <= 0) { q = r; continue; }
    const A = pts[sig[q - 1]!.i]!, B = pts[sig[r + 1]!.i]!, ab = sub(B, A); let depth = 0, at = pts[sig[q]!.i]!;
    for (let i = sig[q - 1]!.i + 1; i < sig[r + 1]!.i; i++) { const p = pts[i]!, t = Math.max(0, Math.min(1, dot(sub(p, A), ab) / (dot(ab, ab) || 1))), c = add(A, [ab[0] * t, ab[1] * t, ab[2] * t]), d = -dot(sub(p, c), out(p, i)); if (d > depth) { depth = d; at = p; } }
    const run = cum[sig[r + 1]!.i]! - cum[sig[q - 1]!.i]!; if (run < 400 && depth >= 0.3) st.dimples.push({ grid, line, at, depth, run }); q = r; } }
/** an outward direction for a grid point: square to the grid there, away from the car's middle line */
function gridOut(G: Grid, zc: number) { return (i: number, j: number): V => { const r0 = G[Math.max(0, i - 1)]![j] ?? G[i]![j]!, r1 = G[Math.min(G.length - 1, i + 1)]![j] ?? G[i]![j]!, row = G[i]!, c0 = row[Math.max(0, j - 1)]!, c1 = row[Math.min(row.length - 1, j + 1)]!;
  let n = un(cross(sub(r1, r0), sub(c1, c0))); const p = G[i]![j]!, o = un([0, p[1], p[2] - zc]); if (!Number.isFinite(n[0]) || len(n) < 0.5) n = o; return dot(n, o) < 0 ? [-n[0], -n[1], -n[2]] : n; }; }
function gridCheck(grid: string, G: Grid, zc: number, keep: (i: number, j: number, along: boolean) => boolean = () => true): GridStat { const st: GridStat = { grid, lines: 0, changes: 0, dimples: [], waves: 0, folds: [], cells: 0, twist: [], flips: 0 }, o = gridOut(G, zc);
  const runs = (idx: [number, number][], name: string, along: boolean) => { let cur: [number, number][] = []; const flush = () => { if (cur.length >= 4) { const pts = cur.map(([i, j]) => G[i]![j]!); lineCheck(grid, name, pts, (_, q) => o(cur[q]![0], cur[q]![1]), st); } cur = []; };
    for (const ij of idx) { if (G[ij[0]]?.[ij[1]] && keep(ij[0], ij[1], along)) cur.push(ij); else flush(); } flush(); };
  const nc = Math.min(...G.map(r => r.length)), diag: number[][] = G.map(() => []), nn = (p: V, r: V, t: V) => un(cross(sub(r, p), sub(t, p)));
  for (let i = 0; i + 1 < G.length; i++) for (let j = 0; j + 1 < nc; j++) { if (!keep(i, j, true) || !keep(i + 1, j + 1, true) || !keep(i, j + 1, true) || !keep(i + 1, j, true)) continue; const q = [G[i]![j]!, G[i + 1]![j]!, G[i + 1]![j + 1]!, G[i]![j + 1]!] as V[];
    if (q.some((a, k) => len(sub(a, q[(k + 1) % 4]!)) < 0.5)) continue; const a = dot(nn(q[0]!, q[1]!, q[2]!), nn(q[0]!, q[2]!, q[3]!)), b = dot(nn(q[1]!, q[2]!, q[3]!), nn(q[1]!, q[3]!, q[0]!)), alt = a < b - 1e-9;
    st.cells++; st.twist.push(Math.acos(Math.min(1, Math.max(a, b))) * DEG); diag[i]![j] = alt ? 1 : 0; const l = diag[i]![j - 1], u = diag[i - 1]?.[j]; if (l !== undefined && l !== diag[i]![j]) st.flips++; if (u !== undefined && u !== diag[i]![j]) st.flips++; }
  for (let j = 0; j < nc; j++) runs(G.map((_, i) => [i, j] as [number, number]), `col ${j}`, true);   // along the car (or round the cap)
  for (let i = 0; i < G.length; i++) runs(G[i]!.map((_, j) => [i, j] as [number, number]), `row ${i}`, false);   // across
  return st; }
/** a grid with repeated neighbouring points dropped is not needed: turning() skips segments under 0.5 mm */

// ---------------------------------------------------------------- line tables
/** a table's inflections: where its interpolated curve's second difference changes sign (sampled every 2 mm, ignoring tiny ones) */
function inflections(tab: Tab, step: number): { n: number; at: number[] } { if (tab.length < 3) return { n: 0, at: [] }; const f = curve(tab), x0 = tab[0]![0], x1 = tab[tab.length - 1]![0], at: number[] = [];
  let prev = 0; const amp = Math.max(1e-9, Math.max(...tab.map(p => p[1])) - Math.min(...tab.map(p => p[1]))), eps = amp * 1e-6;
  for (let x = x0 + step; x + step < x1; x += step) { const c = f(x - step) - 2 * f(x) + f(x + step); if (Math.abs(c) < eps) continue; const s = Math.sign(c); if (prev && s !== prev) at.push(x); prev = s; }
  return { n: at.length, at }; }

// ---------------------------------------------------------------- the picture
interface View { yaw: number; pitch: number }
const VIEWS: View[] = [{ yaw: 0, pitch: 0 }, { yaw: 35, pitch: 28 }, { yaw: 215, pitch: 28 }];
const TW = Math.round(5000 / mm), THt = Math.round(2300 / mm);
type Col = [number, number, number];
const mixc = (a: Col, b: Col, t: number): Col => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function draw(M: Mesh, triCol: (t: number) => Col[] | null, v: View, img: Uint8Array, W: number, ox: number, oy: number, cx: number, cz: number): { zb: Float32Array; proj: (p: V) => V } {
  const y = v.yaw / DEG, p = v.pitch / DEG, fwd: V = [Math.sin(y) * Math.cos(p), -Math.cos(y) * Math.cos(p), -Math.sin(p)], right: V = un(cross(fwd, [0, 0, 1])), up = cross(right, fwd);
  const zb = new Float32Array(TW * THt).fill(Infinity), light = un(add(add([-fwd[0], -fwd[1], -fwd[2]], [up[0] * 0.7, up[1] * 0.7, up[2] * 0.7]), [right[0] * -0.4, right[1] * -0.4, right[2] * -0.4]));
  const proj = (a0: V): V => { const a: V = [a0[0] - cx, a0[1], a0[2] - cz]; return [TW / 2 + dot(a, right) / mm, THt / 2 - dot(a, up) / mm, dot(a, fwd)]; };
  for (let t = 0; t < M.n; t++) { const q = [0, 1, 2].map(k => [M.pos[t * 9 + k * 3]! - cx, M.pos[t * 9 + k * 3 + 1]!, M.pos[t * 9 + k * 3 + 2]! - cz] as V);
    const n = un(cross(sub(q[1]!, q[0]!), sub(q[2]!, q[0]!))), sc = q.map(a => [TW / 2 + dot(a, right) / mm, THt / 2 - dot(a, up) / mm, dot(a, fwd)] as V);
    const cols = triCol(t); const nn = dot(n, fwd) > 0 ? [-n[0], -n[1], -n[2]] as V : n, sh = 0.62 + 0.38 * Math.max(0, dot(nn, light));
    const x0 = Math.max(0, Math.floor(Math.min(sc[0]![0], sc[1]![0], sc[2]![0]))), x1 = Math.min(TW - 1, Math.ceil(Math.max(sc[0]![0], sc[1]![0], sc[2]![0]))), y0 = Math.max(0, Math.floor(Math.min(sc[0]![1], sc[1]![1], sc[2]![1]))), y1 = Math.min(THt - 1, Math.ceil(Math.max(sc[0]![1], sc[1]![1], sc[2]![1])));
    const [A, B, C] = sc as [V, V, V], den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) continue;
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) { const X = px + 0.5, Y = py + 0.5, l0 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l1 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den, l2 = 1 - l0 - l1;
      if (l0 < -1e-4 || l1 < -1e-4 || l2 < -1e-4) continue; const d = l0 * A[2] + l1 * B[2] + l2 * C[2], zi = py * TW + px; if (d >= zb[zi]!) continue; zb[zi] = d;
      let c: Col; if (!cols) { const g = M.kind[t] === GLASS ? [70, 84, 96] as Col : [128, 128, 128] as Col; c = g; } else if (cols.length === 1) c = cols[0]!; else c = [0, 1, 2].map(k => cols[0]![k]! * l0 + cols[1]![k]! * l1 + cols[2]![k]! * l2) as Col;
      const o = ((oy + py) * W + ox + px) * 3; img[o] = Math.min(255, c[0] * sh); img[o + 1] = Math.min(255, c[1] * sh); img[o + 2] = Math.min(255, c[2] * sh); } }
  // a thin outline where the depth jumps (the silhouette), to read the shape
  for (let py = 1; py < THt - 1; py++) for (let px = 1; px < TW - 1; px++) { const z = zb[py * TW + px]!, nb = [zb[py * TW + px - 1]!, zb[py * TW + px + 1]!, zb[(py - 1) * TW + px]!, zb[(py + 1) * TW + px]!];
    if (Number.isFinite(z) && nb.some(w => !Number.isFinite(w) || w - z > 120)) { const o = ((oy + py) * W + ox + px) * 3; img[o] = img[o + 1] = img[o + 2] = 25; } }
  return { zb, proj };
}
/** an edge drawn over the picture where nothing nearer hides it */
function edgeLine(a: V, b: V, c: Col, wpx: number, D: { zb: Float32Array; proj: (p: V) => V }, img: Uint8Array, W: number, ox: number, oy: number): void {
  const A = D.proj(a), B = D.proj(b), n = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) * 2));
  for (let i = 0; i <= n; i++) { const t = i / n, x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t, d = A[2] + (B[2] - A[2]) * t;
    for (let dy = 0; dy < wpx; dy++) for (let dx = 0; dx < wpx; dx++) { const px = Math.floor(x) + dx, py = Math.floor(y) + dy; if (px < 0 || py < 0 || px >= TW || py >= THt) continue; if (d > D.zb[py * TW + px]! + 25) continue;
      img.set(c, ((oy + py) * W + ox + px) * 3); } } }
function edgeCol(th: number): Col | null { const a = Math.abs(th); if (a < 2) return null; if (th < 0) return a >= 35 ? [40, 40, 140] : mixc([240, 120, 110], [200, 10, 10], Math.min(1, (a - 2) / 10));
  if (a < 8) return [120, 190, 120]; if (a < 20) return [225, 180, 30]; if (a < 35) return [240, 110, 20]; return [60, 100, 225]; }
// colour scales
const WHITE: Col = [236, 234, 228];
function curvCol(h: number): Col { if (!Number.isFinite(h)) return [150, 150, 150]; const a = Math.min(1, Math.log10(1 + Math.abs(h) / 0.15) / Math.log10(1 + 6 / 0.15));
  if (Math.abs(h) < 0.15) return WHITE; return h > 0 ? mixc([200, 215, 245], [30, 70, 200], a) : mixc([250, 200, 190], [210, 20, 20], a); }
function normCol(err: number): Col { if (err < 1) return WHITE; if (err < 3) return mixc([235, 215, 240], [210, 150, 225], (err - 1) / 2); if (err < 8) return mixc([210, 120, 220], [170, 30, 190], (err - 3) / 5); return [90, 10, 110]; }
const LEGEND: Col[][] = [[[120, 190, 120], [225, 180, 30], [240, 110, 20], [60, 100, 225], [240, 120, 110], [200, 10, 10], [40, 40, 140]], [[30, 70, 200], [150, 175, 235], WHITE, [245, 170, 160], [210, 20, 20]], [WHITE, [220, 180, 230], [190, 80, 205], [90, 10, 110], [20, 20, 20]]];

// ---------------------------------------------------------------- the cars
interface Car { id: string; label: string; mesh: Mesh; pick: (t: number) => boolean; grids: GridStat[]; tables: { name: string; n: number; at: number[] }[]; stations: number[]; note?: string }
const kitCar = (id: string, k: CarKit, opts?: AssembleOpts): Car => { const tweak = opts?.tweak, A = assemble(k, opts), s = A.skin, L = A.lines, zc = 450;
  const inArch = (x: number) => [L.arches.f, L.arches.r].some(a => Math.abs(x - a.x) < a.r + 1);
  const grids: GridStat[] = tweak ? [] : [gridCheck('flank (CH)', s.CH, zc, (i, j, al) => (al || j <= FLANK.SILL) && (j < FLANK.H || !inArch(s.SF[i]!))), gridCheck('front top (TFG)', s.TFG, zc), gridCheck('nose (NSG)', s.NSG, zc, (_, j, al) => al || j <= FLANK.H), gridCheck('deck (DKG)', s.DKG.slice(0, -1), zc), gridCheck('roof (RFG)', s.RFG, zc)];
  const tables = tweak ? [] : [...Object.entries(k.lines.z).map(([n, t]) => ({ name: `z.${n}`, ...inflections(t, 2) })), ...Object.entries(k.lines.w).map(([n, t]) => ({ name: `w.${n}`, ...inflections(t, 2) }))];
  return { id, label: id, mesh: A.mesh, pick: t => A.role[t] === SHELL && A.mesh.kind[t] === PAINT, grids, tables, stations: L.stations }; };
const freeCar = (id: string, i: number): Car => { const sil = PRESETS[i]!, c = buildFree(sil, { seams: false }), b: Body = c.body, zc = 450;
  // the rings as a grid (the end faces' rings included); the points lifted onto an arch's lip left out
  const G: Grid = b.sects.map(S => S.pts.slice(0, FM + 1)), keep = (r: number, j: number, al: boolean) => !(b.sects[r]!.clamped[j]) && j < JLIP && (al || b.sects[r]!.cap < 0.05 || j >= JK);
  const tables = CURVES.map(n => ({ name: n, ...inflections(sil.curves[n], 0.002) }));
  return { id, label: `${id} (${sil.name})`, mesh: c.mesh, pick: t => c.mesh.kind[t] === PAINT, grids: [gridCheck('rings', G, zc, keep)], tables, stations: b.sects.map(S => S.x) }; };

const CARS: (() => Car)[] = [() => kitCar('nsx', NSX_KIT), () => kitCar('f355', F355_KIT), () => kitCar('eb110', EB110_KIT),
  () => ({ ...kitCar('nsx_tweak', NSX_KIT, { tweak: { cabin: 120, roof: -50, rake: 6, ride: -20 } }), note: 'NSX, tweak cabin +120, roof -50, rake +6, ride -20' }),
  () => freeCar('free_wedge', 0), () => freeCar('free_canopy', 1), () => freeCar('free_coke', 2), () => freeCar('free_longtail', 3)];

const where = (p: V, L: number) => `x ${f0(p[0])} (${f0(p[0] / L * 100)}%) y ${f0(Math.abs(p[1]))} z ${f0(p[2])}`;
const summary: string[] = [];
for (const make of CARS) { const car = make(); if (only && !car.id.startsWith(only)) continue; const M = car.mesh, S = weld(M, car.pick), R = analyse(S), L = M.length;
  const E2 = R.E.filter(e => e.t.length === 2), abs = E2.map(e => Math.abs(e.th));
  const band = (a: number, b: number) => abs.filter(v => v >= a && v < b).length, folds = E2.filter(e => e.fold), splits = E2.filter(e => e.split), concave = E2.filter(e => e.th < -2 && !e.bad);
  const errs = R.cornerErr, bad3 = errs.filter(v => v > 3).length;
  const lines: string[] = [];
  lines.push(`## ${car.label}${car.note ? ` - ${car.note}` : ''}`);
  lines.push(`painted shell: ${S.T.length} tris, ${S.P.length} points, ${E2.length} inner edges, open ${R.E.length - E2.length}, winding disagreements ${R.inconsistent}, slivers (<5 deg) ${R.slivers}`);
  lines.push(`(a) dihedral: median ${f1(median(abs))}, p95 ${f1(pct(abs, 0.95))}; edges 2-8: ${band(2, 8)}, 8-20: ${band(8, 20)}, mushy 20-35: ${band(20, 35)}, crease >=35: ${band(35, 181)}; concave edges (< -2) ${concave.length}`);
  const byName = new Map<string, { folds: number; mushy: number; split: number; err: number; n: number }>(); const nm = (k: number) => S.name[k] || '?';
  S.T.forEach((_, k) => { const r = byName.get(nm(k)) ?? { folds: 0, mushy: 0, split: 0, err: 0, n: 0 }; r.n++; r.err = Math.max(r.err, errs[k * 3]!, errs[k * 3 + 1]!, errs[k * 3 + 2]!); byName.set(nm(k), r); });
  for (const e of E2) { const r = byName.get(nm(e.t[0]!))!; if (e.th < -2) r.folds++; if (Math.abs(e.th) >= 20 && Math.abs(e.th) < 35) r.mushy++; if (e.split) r.split++; }
  lines.push(`   by panel: ${[...byName].sort((a, b) => b[1].n - a[1].n).map(([n, r]) => `${n} ${r.n}t concave ${r.folds} mushy ${r.mushy} splits ${r.split} maxErr ${f0(r.err)}`).join(' | ')}`);
  const mushy = E2.filter(e => Math.abs(e.th) >= 20 && Math.abs(e.th) < 35).sort((a, b) => Math.abs(b.th) - Math.abs(a.th)).slice(0, 4).map(e => `${nm(e.t[0]!)} ${f1(e.th)} deg at ${where(S.P[e.a]!, L)}`);
  if (mushy.length) lines.push(`   mushiest: ${mushy.join('; ')}`);
  const vh = R.vH.filter(Number.isFinite); lines.push(`(b) mean curvature: points convex ${vh.filter(h => h > 0.15).length}, concave ${vh.filter(h => h < -0.15).length}, flat ${vh.filter(h => Math.abs(h) <= 0.15).length}; isolated dimples ${R.dimples.length} (mostly-ring ${R.soft}), isolated bumps ${R.bumps.length}`);
  if (R.dimples.length) lines.push(`   dimples: ${R.dimples.slice().sort((a, b) => R.vH[a]! - R.vH[b]!).slice(0, 6).map(v => `${where(S.P[v]!, L)} H ${f1(R.vH[v]!)}/m`).join('; ')}`);
  for (const g of car.grids) { const d = g.dimples.slice().sort((a, b) => b.depth - a.depth);
    lines.push(`   grid ${g.grid}: ${g.cells} cells, twist p50 ${f1(median(g.twist))} p95 ${f1(pct(g.twist, 0.95))} max ${f1(Math.max(0, ...g.twist))} deg, diagonal flips ${g.flips} (${f0(g.flips / Math.max(1, 2 * g.cells) * 100)}% of neighbour pairs); ${g.lines} lines, sign changes ${g.changes} (${f1(g.changes / Math.max(1, g.lines))}/line), wavy lines ${g.waves}, folds ${g.folds.length}${g.folds.length ? ` (worst ${g.folds.slice().sort((a, b) => Math.abs(b.depth) - Math.abs(a.depth)).slice(0, 3).map(h => `${f1(h.depth)} deg ${h.line} ${where(h.at, L)}`).join('; ')})` : ''}, short dimples ${g.dimples.length}${d.length ? `, deepest ${d.slice(0, 4).map(h => `${f1(h.depth)} mm over ${f0(h.run)} mm (${h.line}, ${where(h.at, L)})`).join('; ')}` : ''}`); }
  lines.push(`(c) normals: corner error median ${f1(median(errs))}, p95 ${f1(pct(errs, 0.95))}, max ${f1(Math.max(...errs))}; corners > 3 deg ${bad3} (${f1(bad3 / errs.length * 100)}%); split seams on smooth surface ${splits.length} (median jump ${f1(median(splits.map(e => e.jump)))} deg)`);
  if (car.tables.length) { const w = car.tables.filter(t => t.n >= 2).sort((a, b) => b.n - a.n); lines.push(`tables: ${car.tables.length}, with >= 2 inflections: ${w.map(t => `${t.name} ${t.n}`).join(', ') || 'none'}`); }
  const st = car.stations, gaps = st.slice(1).map((v, i) => v - st[i]!).filter(g => g > 2); let ratio = 1; for (let i = 1; i < gaps.length; i++) ratio = Math.max(ratio, gaps[i]! / gaps[i - 1]!, gaps[i - 1]! / gaps[i]!);
  lines.push(`stations: ${st.length}, spacing ${f0(Math.min(...gaps))}-${f0(Math.max(...gaps))} mm (ignoring the <2 mm doubled arch ends), worst neighbour ratio ${f1(ratio)}`);
  summary.push(lines.join('\n')); console.log(lines.join('\n') + '\n');

  // the picture: three rows (a) folds, (b) curvature, (c) normals; three views
  const W = TW * 3, H = THt * 3 + 34, img = new Uint8Array(W * H * 3); for (let i = 0; i < W * H; i++) img.set([206, 202, 192], i * 3);
  const local = new Map<number, number>(); S.tri.forEach((t, k) => local.set(t, k));
  const xs = Array.from(M.pos.filter((_, i) => i % 3 === 0)), zs = Array.from(M.pos.filter((_, i) => i % 3 === 2)), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const rows: ((t: number) => Col[] | null)[] = [
    t => local.get(t) === undefined ? null : [WHITE],
    t => { const k = local.get(t); return k === undefined ? null : S.T[k]!.map(v => curvCol(R.vH[v]!)); },
    t => { const k = local.get(t); return k === undefined ? null : [0, 1, 2].map(q => normCol(errs[k * 3 + q]!)); }];
  rows.forEach((f, r) => VIEWS.forEach((v, c) => { const D = draw(M, f, v, img, W, c * TW, r * THt, cx, cz);
    if (r === 0) for (const e of E2.slice().sort((p, q) => Math.abs(p.th) - Math.abs(q.th))) { const col = edgeCol(e.th); if (col) edgeLine(S.P[e.a]!, S.P[e.b]!, col, Math.abs(e.th) >= 8 ? 2 : 1, D, img, W, c * TW, r * THt); } }));
  // the legend: a row of swatches per map, under the pictures
  LEGEND.forEach((sw, r) => sw.forEach((c, i) => { const x0 = 10 + r * Math.round(W / 3) + i * 34; for (let y = THt * 3 + 8; y < THt * 3 + 26; y++) for (let x = x0; x < x0 + 28; x++) img.set(c, (y * W + x) * 3); }));
  const rgba = new Uint8Array(W * H * 4); for (let i = 0; i < W * H; i++) { rgba[i * 4] = img[i * 3]!; rgba[i * 4 + 1] = img[i * 3 + 1]!; rgba[i * 4 + 2] = img[i * 3 + 2]!; rgba[i * 4 + 3] = 255; }
  writeFileSync(`${out}/surface_${car.id}.png`, encodePNG(W, H, rgba)); }
if (args.includes('report')) writeFileSync(`${out}/surface_report.txt`, summary.join('\n\n') + '\n');
