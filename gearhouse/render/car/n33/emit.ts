// A shell laid into a builder with its narrow bands cut finer (docs/systems/117 §17, docs/systems/108 S9: no thin
// triangles). The third cage keeps its curvature in bands a few millimetres wide (render/car/n33/v3.ts); a band's
// cell is then a long thin quad, and cut corner to corner it makes two triangles with an angle under 5 degrees. Here
// such a quad's long edges are divided (the more the thinner it is), the quad laid as a ladder of short ones, and
// every face that shares a divided edge is laid as a fan round its middle through the same points, so the surface
// stays closed. The new points lie on the edges' own straight lines with normals between their ends', so the shape
// and the shading are the shell's own: only the triangles differ. The shell itself (its faces, the skin's
// coordinates, the holes cut in it) is not changed.
import { Build, type V } from '../mesh';
import { MAT } from '../p959';
import { cut, type Shell959 } from '../p959/shell';
import { cornerNormals, ekey } from '../p959/subdiv';

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (a: V) => Math.hypot(a[0], a[1], a[2]), mix = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const unit = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const ang = (u: V, v: V) => Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / ((len(u) * len(v)) || 1)))) * 180 / Math.PI;
/** a triangle's smallest angle (degrees) */
export const minAngle = (a: V, b: V, c: V) => Math.min(ang(sub(b, a), sub(c, a)), ang(sub(a, b), sub(c, b)), ang(sub(a, c), sub(b, c)));
/** a quad is thin when its long sides are more than this many times its short ones; its long sides are then divided
 *  into pieces at most this many times the short ones (a piece cut corner to corner keeps an angle well over 5 degrees) */
const THIN = 8, PIECE = 6, MOST = 64;
interface Pt { p: V; n: V }

export interface FineStat { triangles: number; /** painted triangles with an angle under 5 degrees */ slivers: number; /** edges divided */ divided: number }
export function emitShellFine(b: Build, S: Shell959, paint: string, normals?: number[]): FineStat { const P = S.P, F = S.F, N = cornerNormals(P, F, S.crease), div = new Map<string, number>();
  const painted = (k: number) => { const t = S.tag[k]!; return t.mat === 'paint' && !/Rim$|wheelWell|floor/.test(t.panel); };
  const sides = (f: number[]) => f.map((v, i) => len(sub(P[f[(i + 1) % f.length]!]!, P[v]!)));
  // the thin painted quads: which pair of sides is long, and into how many pieces
  const thin = new Map<number, 0 | 1>();
  F.forEach((f, k) => { if (f.length !== 4 || !painted(k)) return; const l = sides(f), a = Math.max(l[0]!, l[2]!), c = Math.max(l[1]!, l[3]!), wa = Math.max(0.05, Math.min(l[1]!, l[3]!)), wc = Math.max(0.05, Math.min(l[0]!, l[2]!));
    const pair = a / wa > THIN ? 0 : c / wc > THIN ? 1 : -1; if (pair < 0) return; thin.set(k, pair as 0 | 1); const n = Math.min(MOST, Math.ceil((pair ? c : a) / ((pair ? wc : wa) * PIECE)));
    for (const i of [pair, pair + 2]) { const key = ekey(f[i]!, f[(i + 1) % 4]!); div.set(key, Math.max(div.get(key) ?? 1, n)); } });
  // a quad with a divided side that is shallow against that side takes pieces on the opposite side too, no longer than
  // 1.1 times its depth (a thin quad: the same number on both), so that no triangle reaches far along a rail; the
  // demand runs on from face to face, fewer pieces each time, until nothing changes
  const quads = F.map((f, k) => f.length === 4 ? k : -1).filter(k => k >= 0), get = (f: number[], i: number) => div.get(ekey(f[i]!, f[(i + 1) % 4]!)) ?? 1;
  for (let it = 0, moved = true; moved && it < 60; it++) { moved = false; for (const k of quads) { const f = F[k]!, l = sides(f);
    for (const pair of [0, 1]) { const n0 = get(f, pair), n1 = get(f, pair + 2), big = Math.max(n0, n1); if (big === 1) continue; const L = Math.max(l[pair]!, l[pair + 2]!), w = Math.max(0.05, (l[pair + 1]! + l[(pair + 3) % 4]!) / 2);
      const want = Math.min(big, Math.ceil(L / (1.5 * w))); for (const i of [pair, pair + 2]) if (get(f, i) < want) { div.set(ekey(f[i]!, f[(i + 1) % 4]!), want); moved = true; } } } }
  const groups = new Map<string, number[]>(); S.tag.forEach((t, k) => { const key = `${t.panel}|${t.mat}`; (groups.get(key) ?? groups.set(key, []).get(key)!).push(k); });
  const st: FineStat = { triangles: 0, slivers: 0, divided: [...div.values()].filter(n => n > 1).length };
  const tri = (a: Pt, c: Pt, d: Pt, k: number) => { b.tri(a.p, c.p, d.p); if (normals) normals.push(...a.n, ...c.n, ...d.n); st.triangles++; if (painted(k) && minAngle(a.p, c.p, d.p) < 5) st.slivers++; };
  for (const [key, fs] of groups) { const [panel, mat] = key.split('|') as [string, string], m = MAT[mat]; b.name(panel); if (m) b.mat(m[0], m[1], m[2]); else b.mat(paint, 0.6, 'paint');
    for (const k of fs) { const f = F[k]!, nc = f.length, cnt = f.map((v, i) => div.get(ekey(v, f[(i + 1) % nc]!)) ?? 1), corner = (i: number): Pt => ({ p: P[f[i % nc]!]!, n: N[k]![i % nc]! });
      /** the points along side i, from its first corner to its second (both included) */
      const along = (i: number): Pt[] => { const a = corner(i), c = corner(i + 1), n = cnt[i]!; return Array.from({ length: n + 1 }, (_, j) => j === 0 ? a : j === n ? c : { p: mix(a.p, c.p, j / n), n: unit(mix(a.n, c.n, j / n)) }); };
      if (cnt.every(n => n === 1)) { for (const t of cut(P, f)) { const [x, y, z] = t.map(v => corner(f.indexOf(v))) as [Pt, Pt, Pt]; tri(x, y, z, k); } continue; }
      // candidates: two rails side by side where the other two sides are whole (the triangles step along whichever
      // rail is behind), and a fan round the middle; the one whose worst angle is the larger is laid
      const cands: [Pt, Pt, Pt][][] = [], rails = nc === 4 ? (cnt[1] === 1 && cnt[3] === 1 ? 0 : cnt[0] === 1 && cnt[2] === 1 ? 1 : -1) : -1;
      if (rails >= 0) { const A = along(rails), D = along(rails + 2).reverse(), nA = A.length - 1, nD = D.length - 1, T: [Pt, Pt, Pt][] = [];
        for (let i = 0, j = 0; i < nA || j < nD;) { if (j >= nD || (i < nA && (i + 1) / nA <= (j + 1) / nD)) { T.push([A[i]!, A[i + 1]!, D[j]!]); i++; } else { T.push([A[i]!, D[j + 1]!, D[j]!]); j++; } } cands.push(T); }
      { const rim: Pt[] = []; for (let i = 0; i < nc; i++) rim.push(...along(i).slice(0, -1));
        const mid: Pt = { p: f.reduce((s, v) => [s[0] + P[v]![0] / nc, s[1] + P[v]![1] / nc, s[2] + P[v]![2] / nc] as V, [0, 0, 0] as V), n: unit(f.reduce((s, _, i) => { const q = corner(i).n; return [s[0] + q[0], s[1] + q[1], s[2] + q[2]] as V; }, [0, 0, 0] as V)) };
        cands.push(rim.map((q, j) => [mid, q, rim[(j + 1) % rim.length]!] as [Pt, Pt, Pt])); }
      const worst = (T: [Pt, Pt, Pt][]) => Math.min(...T.map(t => minAngle(t[0].p, t[1].p, t[2].p))), best = cands.reduce((a, c) => worst(c) > worst(a) ? c : a);
      for (const t of best) tri(t[0], t[1], t[2], k); } }
  return st; }
