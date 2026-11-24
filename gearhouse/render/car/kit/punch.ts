// Openings cut into a face of the shell along an outline that does not follow the grid (an oval grille, a round lamp
// recess, a plate's recess): a block of the grid's cells is left out, and the ring between the block's border and the
// outline is filled again (each border point joined to the outline in turn round the opening's middle); the outline is
// sunk into a pocket. The block's border is made of the grid's own points, so the neighbours' cells close on it, and
// the pocket shares the outline's points, so the opening closes too.
import type { Emit } from './emit';
import { add, centroid, cross, dot, mir, sub, un, type Grid, type V } from './geom';

/** a frame across the face: two directions in it and its normal (looking out of the face) */
interface Frame { u: V; v: V; n: V }
const frameOf = (n: V): Frame => { const nn = un(n), up: V = Math.abs(nn[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], u = un(cross(up, nn)); return { u, v: cross(nn, u), n: nn }; };

/** the border of a block of a grid's cells (rows i0..i1, points q0..q1), going round */
export function blockLoop(G: Grid, i0: number, i1: number, q0: number, q1: number): V[] {
  const r: V[] = []; for (let q = q0; q <= q1; q++) r.push(G[i0]![q]!); for (let i = i0 + 1; i <= i1; i++) r.push(G[i]![q1]!);
  for (let q = q1 - 1; q >= q0; q--) r.push(G[i1]![q]!); for (let i = i1 - 1; i > i0; i--) r.push(G[i]![q0]!); return r; }
/** the border of a block across the centre line: rows from the centre line's row iC out to iO (either way), points
 *  q0..q1, and its mirror image; the centre line's own edge inside the block left out */
export function centreLoop(G: Grid, iC: number, iO: number, q0: number, q1: number): V[] {
  const st = iO > iC ? 1 : -1, r: V[] = [];
  for (let i = iC; i !== iO; i += st) r.push(G[i]![q1]!);                    // along the lower edge out
  for (let q = q1; q >= q0; q--) r.push(G[iO]![q]!);                          // up the outer end
  for (let i = iO - st; i !== iC - st; i -= st) r.push(G[i]![q0]!);          // back along the upper edge to the centre line
  const half = r.slice(), back = half.slice(1, -1).reverse().map(p => mir(p, -1)); return [...half, ...back]; }

/** the point on a block of a grid at (a, b) on the face (a along the frame's u, b along v), by inverse bilinear
 *  interpolation in the block's cells; across the centre line (`centre`) a point with y < 0 is read on the mirror image */
export function onBlock(G: Grid, i0: number, i1: number, q0: number, q1: number, n: V, centre = false): (a: number, b: number) => V {
  const F = frameOf(n), pr = (p: V): [number, number] => [dot(p, F.u), dot(p, F.v)], lo = Math.min(i0, i1), hi = Math.max(i0, i1);
  const look = (a: number, b: number): V => { let best: V | null = null, bd = Infinity;
    for (let i = lo; i < hi; i++) for (let q = q0; q < q1; q++) { const P = [G[i]![q]!, G[i + 1]![q]!, G[i + 1]![q + 1]!, G[i]![q + 1]!] as const, Q = P.map(pr);
      // Newton on the bilinear map from (s, t) to the face
      let s = 0.5, t = 0.5; for (let k = 0; k < 12; k++) { const f0 = (1 - s) * (1 - t), f1 = s * (1 - t), f2 = s * t, f3 = (1 - s) * t;
        const x = f0 * Q[0]![0] + f1 * Q[1]![0] + f2 * Q[2]![0] + f3 * Q[3]![0] - a, y = f0 * Q[0]![1] + f1 * Q[1]![1] + f2 * Q[2]![1] + f3 * Q[3]![1] - b;
        const xs = (1 - t) * (Q[1]![0] - Q[0]![0]) + t * (Q[2]![0] - Q[3]![0]), ys = (1 - t) * (Q[1]![1] - Q[0]![1]) + t * (Q[2]![1] - Q[3]![1]);
        const xt = (1 - s) * (Q[3]![0] - Q[0]![0]) + s * (Q[2]![0] - Q[1]![0]), yt = (1 - s) * (Q[3]![1] - Q[0]![1]) + s * (Q[2]![1] - Q[1]![1]), det = xs * yt - xt * ys;
        if (Math.abs(det) < 1e-9) break; s -= (x * yt - y * xt) / det; t -= (xs * y - ys * x) / det; }
      const out = Math.max(0, -s, s - 1, -t, t - 1); if (out < bd) { bd = out; const sc = Math.max(0, Math.min(1, s)), tc = Math.max(0, Math.min(1, t));
        best = add(add(add([0, 0, 0], P[0].map(c => c * (1 - sc) * (1 - tc)) as V), P[1].map(c => c * sc * (1 - tc)) as V), add(P[2].map(c => c * sc * tc) as V, P[3].map(c => c * (1 - sc) * tc) as V)); }
      if (bd === 0) return best!; }
    return best!; };
  return (a, b) => { const mirrored = centre && a * F.u[1] + b * F.v[1] < 0;
    if (!mirrored) return look(a, b); const p = look(...reflect(F, a, b)); return mir(p, -1); };
}
/** (a, b) of the face reflected across the centre line (y -> -y) */
function reflect(F: Frame, a: number, b: number): [number, number] { const p: V = add(F.u.map(c => c * a) as V, F.v.map(c => c * b) as V), q: V = [p[0], -p[1], p[2]]; return [dot(q, F.u), dot(q, F.v)]; }
/** the face's coordinates of a point given as (y, z) on a face looking along ±x (the nose's, the tail's) */
export function yzOf(n: V, y: number, z: number): [number, number] { const F = frameOf(n), p: V = [0, y, z]; return [dot(p, F.u), dot(p, F.v)]; }

/** an outline on the face: a super-ellipse about (y, z) with half-sizes (ry, rz) and power p, seg points round */
export function outline(at: (a: number, b: number) => V, n: V, y: number, z: number, ry: number, rz: number, p: number, seg: number): V[] {
  return Array.from({ length: seg }, (_, k) => { const t = k / seg * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    return at(...yzOf(n, y + ry * Math.sign(c) * Math.abs(c) ** (2 / p), z + rz * Math.sign(s) * Math.abs(s) ** (2 / p))); }); }

/** fill the ring between a loop (the block's border) and an outline inside it, each triangle looking along n */
export function annulus(e: Emit, loop: V[], ring: V[], n: V): void {
  const F = frameOf(n), c = centroid(ring), ang = (p: V) => { const d = sub(p, c); return Math.atan2(dot(d, F.v), dot(d, F.u)); };
  const order = (L: V[]) => { // going round the same way, starting at the smallest angle
    let A = L.slice(); const tw = A.reduce((s, p, i) => { const q = A[(i + 1) % A.length]!; let d = ang(q) - ang(p); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return s + d; }, 0);
    if (tw < 0) A = A.reverse(); let k0 = 0, m = Infinity; A.forEach((p, i) => { const a = (ang(p) + 2 * Math.PI) % (2 * Math.PI); if (a < m) { m = a; k0 = i; } });
    A = [...A.slice(k0), ...A.slice(0, k0)]; const t: number[] = []; let prev = (ang(A[0]!) + 2 * Math.PI) % (2 * Math.PI);
    A.forEach((p, i) => { if (!i) { t.push(prev); return; } let a = (ang(p) + 2 * Math.PI) % (2 * Math.PI); while (a < prev - 1e-9) a += 2 * Math.PI; t.push(a); prev = a; });
    return { P: [...A, A[0]!], t: [...t, t[0]! + 2 * Math.PI] }; };
  // walk round both, each step taking the next point of one of them: the step that keeps the new triangle the right way
  // round on the face (when both do, or neither, the one next by angle round the opening's middle)
  const A = order(loop), B = order(ring), nA = A.P.length - 1, nB = B.P.length - 1, pr = (p: V): [number, number] => [dot(p, F.u), dot(p, F.v)];
  const ar = (p: V, q: V, r: V) => { const [a0, a1] = pr(p), [b0, b1] = pr(q), [c0, c1] = pr(r); return (b0 - a0) * (c1 - a1) - (b1 - a1) * (c0 - a0); };
  let i = 0, j = 0;
  while (i < nA || j < nB) { const okA = i < nA && ar(A.P[i]!, A.P[i + 1]!, B.P[j]!) > 0, okB = j < nB && ar(A.P[i]!, B.P[j + 1]!, B.P[j]!) > 0;
    const byAngle = j >= nB || (i < nA && A.t[i + 1]! <= B.t[j + 1]!), stepA = okA && okB ? byAngle : okA ? true : okB ? false : byAngle;
    if (stepA) { e.tri(A.P[i]!, A.P[i + 1]!, B.P[j]!, n); i++; } else { e.tri(A.P[i]!, B.P[j + 1]!, B.P[j]!, n); j++; } }
}
/** a hole: the ring round the outline in the skin's current material, the outline sunk by d into a pocket (walls in `wall`, the back of kind `back`) */
export function punch(e: Emit, loop: V[], ring: V[], d: V, n: V, wall: string, back: Parameters<Emit['mat']>[2] = 'plain'): void {
  annulus(e, loop, ring, n); e.pocket(ring, d, n, wall, back);
}
