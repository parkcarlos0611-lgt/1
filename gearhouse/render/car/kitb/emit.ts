// The kit's emitter: a Build that knows the car's two sides (every grid is given for the right half and laid on both,
// wound outward), the shapes the panels are made of (cells of a grid, strips between lines of different point counts,
// pockets, walls, fans, shut lines) and what each triangle is for (the body's closed shell, a closure such as a lamp
// lid, an attached part, the inside), so the seam check knows which faces must close.
import { Build, type Kind } from '../mesh';
import { add, centroid, cross, dot, len, mir, mix, shares, sub, un, type Grid, type V } from './geom';

/** shell: the body's skin and what closes it (pockets, wells, the floor), which must have no open edge;
 *  closure: a lid lying in an opening of the shell (a pop-up lamp's cover); part: fitted on (lamps, badges, wheels);
 *  inside: the cabin and the engine bay behind the glass */
export type Role = 'shell' | 'closure' | 'part' | 'inside';
export const ROLES: Role[] = ['shell', 'closure', 'part', 'inside'];
type Tri = [V, V, V];

export class Emit {
  readonly b = new Build();
  private marks: { t: number; role: Role; panel: string }[] = [];
  private cur: Role = 'shell'; private pan = '';
  /** the triangles so far */
  count(): number { return this.b.mark() / 9; }
  /** what follows is for `role`, built by `panel` (the kit's panel or part function) */
  role(role: Role, panel = this.pan): this { this.cur = role; this.pan = panel; this.marks.push({ t: this.count(), role, panel }); return this; }
  /** run f with the role set, then go back to the one before */
  with(role: Role, f: () => void): this { const r = this.cur, p = this.pan; this.role(role); f(); this.role(r, p); return this; }
  name(n: string): this { this.b.name(n); return this; }
  mat(colour: string, gloss = 0.2, kind: Kind = 'plain'): this { this.b.mat(colour, gloss, kind); return this; }
  /** each triangle's role and the panel that made it */
  roles(n: number): { role: Uint8Array; panel: string[]; panelOf: Int16Array } { const role = new Uint8Array(n), panelOf = new Int16Array(n), panel: string[] = [];
    for (let k = 0; k < this.marks.length; k++) { const m = this.marks[k]!, e = k + 1 < this.marks.length ? this.marks[k + 1]!.t : n; let pi = panel.indexOf(m.panel); if (pi < 0) { pi = panel.length; panel.push(m.panel); }
      for (let t = m.t; t < e; t++) { role[t] = ROLES.indexOf(m.role); panelOf[t] = pi; } }
    return { role, panel, panelOf }; }

  // ---- single faces ----
  /** a triangle wound so that it looks along n (skipped when it has no area) */
  tri(p: V, q: V, r: V, n: V): this { const c = cross(sub(q, p), sub(r, p)); if (len(c) < 0.5) return this; if (dot(c, n) >= 0) this.b.tri(p, q, r); else this.b.tri(p, r, q); return this; }
  /** a four-sided face wound so that it looks along n */
  face(p: V, q: V, r: V, t: V, n: V): this { if (dot(cross(sub(q, p), sub(t, p)), n) + dot(cross(sub(r, q), sub(p, q)), n) >= 0) this.b.quad(p, q, r, t); else this.b.quad(p, t, r, q); return this; }
  /** a flat many-sided face as a fan about its middle, looking along n */
  fan(pts: V[], n: V): this { const c = centroid(pts); for (let i = 0; i < pts.length; i++) this.tri(c, pts[i]!, pts[(i + 1) % pts.length]!, n); return this; }
  /** a flat many-sided face as a fan from its first point (no new point: its border is shared exactly), looking along n */
  fan0(pts: V[], n: V): this { for (let i = 1; i + 1 < pts.length; i++) this.tri(pts[0]!, pts[i]!, pts[i + 1]!, n); return this; }
  /** a flat disc across the axle (a plane of constant y) at o */
  disc(o: V, r: number, seg: number, a0 = 0): this { for (let i = 0; i < seg; i++) { const a = a0 + i / seg * Math.PI * 2, c = a0 + (i + 1) / seg * Math.PI * 2; this.b.tri(o, [o[0] + Math.cos(a) * r, o[1], o[2] + Math.sin(a) * r], [o[0] + Math.cos(c) * r, o[1], o[2] + Math.sin(c) * r]); } return this; }
  /** the walls of a pocket: from a ring of points, d deep, facing the ring's middle */
  tube(ring: V[], d: V): this { const c = centroid(ring); for (let i = 0; i < ring.length; i++) { const p = ring[i]!, q = ring[(i + 1) % ring.length]!; if (len(sub(q, p)) < 0.5) continue; this.face(p, q, add(q, d), add(p, d), sub(c, mix(p, q, 0.5))); } return this; }
  /** a pocket sunk from a ring by d: walls in `wall`, a back of the kind given (fanned from its first point, so it shares the walls' points) */
  pocket(ring: V[], d: V, n: V, wall: string, back: Kind = 'plain'): this { this.mat(wall, 0.05); this.tube(ring, d); this.mat(wall, 0.05, back); return this.fan(ring.map(p => add(p, d)), n); }

  /** the skin between a ring of border points and a hole's ring inside it (both going round the hole's middle, any number
   *  of points each, the border seen whole from the middle), looking along n: a port cut in a block of cells */
  porthole(outer: V[], inner: V[], n: V): this { const c = centroid(inner), nn = un(n), u = un(sub(inner[0]!, c)), v = cross(nn, u);
    const ang = (p: V) => { const d = sub(p, c); return Math.atan2(dot(d, v), dot(d, u)); }, turn = (R: V[]) => { const a = R.map(ang); let k = 0; for (let i = 1; i < R.length; i++) if (a[i]! < a[k]!) k = i;
      const rise = ((a[(k + 1) % R.length]! - a[k]! + 4 * Math.PI) % (2 * Math.PI)) < Math.PI, P = R.map((_, i) => R[(k + (rise ? i : R.length - i)) % R.length]!); return { P, a: P.map(ang) }; };
    const O = turn(outer), I = turn(inner), no = O.P.length, ni = I.P.length; let i = 0, j = 0;
    while (i < no || j < ni) { const ao = i < no ? (i + 1 < no ? O.a[i + 1]! : O.a[0]! + 2 * Math.PI) : Infinity, ai = j < ni ? (j + 1 < ni ? I.a[j + 1]! : I.a[0]! + 2 * Math.PI) : Infinity;
      if (ao <= ai) { this.tri(O.P[i % no]!, O.P[(i + 1) % no]!, I.P[j % ni]!, n); i++; } else { this.tri(O.P[i % no]!, I.P[(j + 1) % ni]!, I.P[j % ni]!, n); j++; } }
    return this; }

  // ---- both sides ----
  /** the cells of a grid laid on both sides, wound outward (rows going back, columns going out and down); each cell cut
   *  along the diagonal that folds it less; `pick` chooses the cells */
  cells(P: Grid, pick: (i: number, j: number) => boolean = () => true): this { for (let i = 0; i + 1 < P.length; i++) for (let j = 0; j + 1 < Math.min(P[i]!.length, P[i + 1]!.length); j++) { if (!pick(i, j)) continue;
    const q = [P[i]![j]!, P[i + 1]![j]!, P[i + 1]![j + 1]!, P[i]![j + 1]!] as [V, V, V, V], nn = (p: V, r: V, s: V) => un(cross(sub(r, p), sub(s, p))), alt = dot(nn(q[0], q[1], q[2]), nn(q[0], q[2], q[3])) < dot(nn(q[1], q[2], q[3]), nn(q[1], q[3], q[0])) - 1e-9;
    const ts: Tri[] = alt ? [[q[1], q[2], q[3]], [q[1], q[3], q[0]]] : [[q[0], q[1], q[2]], [q[0], q[2], q[3]]];
    for (const t of ts) this.both(t); } return this; }
  /** one triangle (wound as the right side's cells are) laid on both sides */
  both(t: Tri): this { const c = cross(sub(t[1], t[0]), sub(t[2], t[0])); if (len(c) < 0.5) return this; this.b.tri(t[0], t[1], t[2]); this.b.tri(mir(t[0], -1), mir(t[2], -1), mir(t[1], -1)); return this; }
  /** the strip between two lines of points with different numbers of points (A the inboard column, B the next one out,
   *  both going back), on both sides, wound as cells are: it joins a fine border to a coarse one without a gap */
  strip(A: V[], B: V[]): this { const ta = shares(A), tb = shares(B); let i = 0, j = 0;
    while (i + 1 < A.length || j + 1 < B.length) { const stepA = j + 1 >= B.length || (i + 1 < A.length && ta[i + 1]! <= tb[j + 1]!);
      this.both(stepA ? [A[i]!, A[i + 1]!, B[j]!] : [A[i]!, B[j + 1]!, B[j]!]); if (stepA) i++; else j++; } return this; }
  /** the strip between two lines of different point counts, on both sides, each triangle looking along n (as mirrored) */
  zip(A: V[], B: V[], n: V): this { const ta = shares(A), tb = shares(B); let i = 0, j = 0;
    while (i + 1 < A.length || j + 1 < B.length) { const stepA = j + 1 >= B.length || (i + 1 < A.length && ta[i + 1]! <= tb[j + 1]!), t: Tri = stepA ? [A[i]!, A[i + 1]!, B[j]!] : [A[i]!, B[j + 1]!, B[j]!];
      for (const sg of [1, -1]) this.tri(mir(t[0], sg), mir(t[1], sg), mir(t[2], sg), n); if (stepA) i++; else j++; } return this; }
  /** the faces between two lines of points, on both sides, looking along n (mirrored) */
  wall(A: V[], B: V[], n: V): this { for (const sg of [1, -1]) for (let i = 0; i + 1 < A.length; i++) this.face(mir(A[i]!, sg), mir(A[i + 1]!, sg), mir(B[i + 1]!, sg), mir(B[i]!, sg), mir(n, sg)); return this; }
  /** a triangle on both sides, looking along n (mirrored) */
  tri2(p: V, q: V, r: V, n: V): this { for (const sg of [1, -1]) this.tri(mir(p, sg), mir(q, sg), mir(r, sg), mir(n, sg)); return this; }
  /** a patch inside the cell (i, j) of a grid: u along the rows' direction, v along the columns', lifted along n, on side sg */
  inCell(P: Grid, i: number, j: number, u0: number, u1: number, v0: number, v1: number, lift: number, n: V, sg: number): this {
    const at = (u: number, v: number): V => { const p = mix(mix(P[i]![j]!, P[i + 1]![j]!, u), mix(P[i]![j + 1]!, P[i + 1]![j + 1]!, u), v); return mir([p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift], sg); };
    return this.face(at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1), mir(n, sg)); }
  /** a shut line: a thin dark ribbon laid on the skin along pts (nrm: the skin's normal at point i), on the sides given */
  seam(pts: V[], nrm: (i: number) => V, w = 8, lift = 2.5): (sgs: number[]) => void {
    const e = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)]!, c = pts[Math.min(pts.length - 1, i + 1)]!, n = un(nrm(i)), sd = un(cross(n, sub(c, a))), o = add(p, [n[0] * lift, n[1] * lift, n[2] * lift]); return [add(o, [sd[0] * w / 2, sd[1] * w / 2, sd[2] * w / 2]), sub(o, [sd[0] * w / 2, sd[1] * w / 2, sd[2] * w / 2]), n] as [V, V, V]; });
    return sgs => { for (const sg of sgs) for (let i = 0; i + 1 < e.length; i++) this.face(mir(e[i]![0], sg), mir(e[i + 1]![0], sg), mir(e[i + 1]![1], sg), mir(e[i]![1], sg), mir(e[i]![2], sg)); }; }
}
/** the border of a block of cells of a grid, going round */
export function border(P: Grid, i0: number, i1: number, j0: number, j1: number): V[] { const r: V[] = []; for (let j = j0; j <= j1; j++) r.push(P[i0]![j]!); for (let i = i0 + 1; i <= i1; i++) r.push(P[i]![j1]!); for (let j = j1 - 1; j >= j0; j--) r.push(P[i1]![j]!); for (let i = i1 - 1; i > i0; i--) r.push(P[i]![j0]!); return r; }
