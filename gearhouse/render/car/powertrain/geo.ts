// The powertrain's shapes (docs/systems/101, part 1-3): a collector of triangles by named part, and the few shapes every
// part of the powertrain is made of: boxes on any three axes, sections swept straight (prisms, cylinders), profiles
// turned about any axis (housings, cones, bellows), round tubes through points with mitred joints and smooth bends
// between two ends (pipes, hoses, shafts). Everything is collected in the car's frame: a part built in a frame of its
// own (the engine: along the crank, across, up) sets `frame` and its points are carried into the car's as they come.
// Each part is named, so the builder can label it, light it and lift it out (the exploded view).
// A collector given the drift-game look (style.ts) draws the same shapes in that look: each part painted from the
// palette by its role, its round sections thickened to its kind's rule, its boxes' edges chamfered, every closed shape
// wound outward (the look's outline is an inverted hull), and it takes the lines a builder draws on its parts.
import type { Build, Kind, LineKind, MeshLine, V } from '../mesh';
import type { DriftStyle, KindRule, PartKind } from './style';
export type { V };

export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
export const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: V) => Math.hypot(a[0], a[1], a[2]), norm = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const mix = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const REF = 2.5;   // style.ts REF_MM_PER_PX (kept here so the shapes import no values from the style)
const area = (a: V, b: V, c: V) => len(cross(sub(b, a), sub(c, a))) / 2;
/** two unit vectors square to d (the first as near `up` as can be) */
export function square(d: V, up: V = [0, 0, 1]): [V, V] { let p = cross(up, d); if (len(p) < 1e-3) p = cross([1, 0, 0], d); if (len(p) < 1e-3) p = cross([0, 1, 0], d); p = norm(p); return [p, cross(d, p)]; }

/** a section: points [across, up] about a line */
export type Sec = [number, number][];
export const circle = (r: number, seg: number, r2 = r): Sec => Array.from({ length: seg }, (_, i) => { const a = (i + 0.5) / seg * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r2] as [number, number]; });
/** a rounded box section: half width hw, half height hh, k points, `sq` how square (2 an ellipse, 6 near a box) */
export const rsec = (hw: number, hh: number, k: number, sq = 4): Sec => Array.from({ length: k }, (_, i) => { const t = (i + 0.5) / k * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); return [hw * Math.sign(c) * Math.abs(c) ** (2 / sq), hh * Math.sign(s) * Math.abs(s) ** (2 / sq)] as [number, number]; });

export interface Bounds { min: V; max: V; tris: number; /** the thinnest round section or bar drawn in the part (mm across, in the car; absent: none drawn) */ thin?: number }
type G = { name: string; col: string; gloss: number; kind: Kind; t: V[] };

export class Geo {
  private g: G[] = []; private c!: G;
  /** carries a point of the frame being built in into the car's (null: the car's own) */
  private xf: ((p: V) => V) | null = null;
  /** the frame's scale (a millimetre of it in the car) */ private k = 1;
  /** the drift look's: the part's rule, the colours each part has been given so far, the point a closed shape's faces turn away from */
  private rule: KindRule | null = null; private seen = new Map<string, string[]>(); private ref: V | null = null;
  private thin = new Map<string, number>(); private L: MeshLine[] = [];
  /** `style`: the drift-game look (null: the realistic one) */
  constructor(private readonly st: DriftStyle | null = null) {}
  /** built in the drift-game look */
  get drift(): boolean { return !!this.st; }
  /** what follows is this part, in this material (`as`: drawn by another kind's rule than the part's own) */
  part(name: string, col: string, gloss = 0.2, kind: Kind = 'plain', as?: PartKind): this {
    if (this.st) { let S = this.seen.get(name); if (!S) this.seen.set(name, S = []); let i = S.indexOf(col); if (i < 0) i = S.push(col) - 1;
      const role = this.st.paint[name]?.[i], p = role ? this.st.palette[role] : null; if (p) { col = p.col; gloss = p.gloss; kind = p.kind; }
      this.rule = this.st.rules[as ?? this.st.kinds[name] ?? 'casting']; }
    this.c = { name, col, gloss, kind, t: [] }; this.g.push(this.c); return this; }
  frame(f: ((p: V) => V) | null): this { this.xf = f; this.k = f ? len(sub(f([1, 0, 0]), f([0, 0, 0]))) || 1 : 1; return this; }
  /** a round section's radius by the part's rule (and the part's thinnest noted) */
  private rr(r: number): number { const u = this.rule; if (u) r = Math.max(r * u.scale, u.minPx * REF / 2 / this.k); const d = 2 * r * this.k, n = this.c.name; if (d < (this.thin.get(n) ?? Infinity)) this.thin.set(n, d); return r; }
  private sg(seg: number): number { return this.rule?.seg || seg; }
  /** a line drawn on the part being built (the drift look's: a rib, a seam, a core's rows), in the frame being built in */
  line(kind: LineKind, pts: V[], closed = false, w?: number): this { if (!this.st) return this; const f = this.xf;
    this.L.push({ kind, pts: f ? pts.map(f) : pts, part: this.c.name, ...(closed ? { closed } : {}), ...(w ? { w } : {}) }); return this; }
  /** the lines drawn so far */
  get lines(): MeshLine[] { return this.L; }
  tri(a: V, b: V, c: V): this { const o = this.ref; if (o && dot(cross(sub(b, a), sub(c, a)), [(a[0] + b[0] + c[0]) / 3 - o[0], (a[1] + b[1] + c[1]) / 3 - o[1], (a[2] + b[2] + c[2]) / 3 - o[2]]) < 0) { const q = b; b = c; c = q; }
    if (this.xf) { a = this.xf(a); b = this.xf(b); c = this.xf(c); } if (area(a, b, c) > 0.6) this.c.t.push(a, b, c); return this; }
  quad(a: V, b: V, c: V, d: V): this { return this.tri(a, b, c).tri(a, c, d); }
  /** a flat many-sided face */
  fan(R: V[]): this { for (let i = 1; i + 1 < R.length; i++) this.tri(R[0]!, R[i]!, R[i + 1]!); return this; }
  /** rings of the same number of points joined into a skin; `caps`: both ends, or 'a' / 'b' for one */
  loft(rings: V[][], caps: boolean | 'a' | 'b' = true): this {
    const out = this.st && !this.ref, mid = out ? rings.map(R => mul(R.reduce((s, p) => add(s, p), [0, 0, 0] as V), 1 / R.length)) : [];   // the drift look: each band's faces away from its middle, each end's from the ring before it
    for (let r = 0; r + 1 < rings.length; r++) { const A = rings[r]!, B = rings[r + 1]!, n = A.length; if (out) this.ref = mix(mid[r]!, mid[r + 1]!, 0.5); for (let i = 0; i < n; i++) this.quad(A[i]!, A[(i + 1) % n]!, B[(i + 1) % n]!, B[i]!); }
    if (caps === true || caps === 'a') { if (out) this.ref = mid[1] ?? null; this.fan(rings[0]!); } if (caps === true || caps === 'b') { if (out) this.ref = mid[mid.length - 2] ?? null; this.fan(rings[rings.length - 1]!); }
    if (out) this.ref = null; return this; }
  /** a box on three axes about its centre: half sizes along e1, e2, e3; `open` leaves faces off ('-3' the bottom) */
  obox(c: V, e1: V, h1: number, e2: V, h2: number, e3: V, h3: number, open = ''): this {
    if (h1 < 0.5 || h2 < 0.5 || h3 < 0.5) return this;
    if (this.st) { const u = this.rule!, lo = u.seg ? 0 : u.minPx * REF / 2 / this.k;   /* a plate's least thickness (kinds drawn as tubes keep their boxes) */ h1 = Math.max(h1, lo); h2 = Math.max(h2, lo); h3 = Math.max(h3, lo);
      const ch = Math.min(u.bevel / this.k, 0.3 * Math.min(h1, h2, h3)); this.ref = c; if (ch * this.k >= 2) this.cbox(c, [e1, e2, e3], [h1, h2, h3], ch, open); else this.faces(c, e1, h1, e2, h2, e3, h3, open); this.ref = null; return this; }
    return this.faces(c, e1, h1, e2, h2, e3, h3, open); }
  private faces(c: V, e1: V, h1: number, e2: V, h2: number, e3: V, h3: number, open: string): this {
    const P = (i: number, j: number, k: number) => add(add(add(c, mul(e1, i * h1)), mul(e2, j * h2)), mul(e3, k * h3));
    const F: [string, V, V, V, V][] = [['-1', P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1), P(-1, -1, 1)], ['+1', P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)],
      ['-2', P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)], ['+2', P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1)],
      ['-3', P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1)], ['+3', P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)]];
    for (const [id, a, b, cc, d] of F) if (!open.includes(id)) this.quad(a, b, cc, d); return this; }
  /** a box with its edges cut by `ch` (the drift look's bevel): a face a side, a strip an edge, a triangle a corner; an
   *  open side's neighbours run whole to its rim */
  private cbox(c: V, e: [V, V, V], h: [number, number, number], ch: number, open: string): void {
    const isOpen = (a: number, s: number) => open.includes(`${s < 0 ? '-' : '+'}${a + 1}`);
    /** the corner s's point on side a: full along a, cut back along the other two (not toward an open side) */
    const v = (s: number[], a: number): V => { let p = c; for (let b = 0; b < 3; b++) p = add(p, mul(e[b]!, s[b]! * (b === a || isOpen(b, s[b]!) ? h[b]! : h[b]! - ch))); return p; };
    for (let a = 0; a < 3; a++) { const b = (a + 1) % 3, d = (a + 2) % 3, S = (sa: number, sb: number, sd: number) => { const s = [0, 0, 0]; s[a] = sa; s[b] = sb; s[d] = sd; return s; };
      for (const sa of [-1, 1]) { if (!isOpen(a, sa)) this.quad(v(S(sa, -1, -1), a), v(S(sa, 1, -1), a), v(S(sa, 1, 1), a), v(S(sa, -1, 1), a));
        for (const sb of [-1, 1]) if (!isOpen(a, sa) && !isOpen(b, sb)) this.quad(v(S(sa, sb, -1), a), v(S(sa, sb, 1), a), v(S(sa, sb, 1), b), v(S(sa, sb, -1), b)); } }
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) for (const s3 of [-1, 1]) { const s = [s1, s2, s3]; if (!isOpen(0, s1) && !isOpen(1, s2) && !isOpen(2, s3)) this.tri(v(s, 0), v(s, 1), v(s, 2)); } }
  /** a box along the frame's own axes */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, open = ''): this {
    return this.obox([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [1, 0, 0], Math.abs(x1 - x0) / 2, [0, 1, 0], Math.abs(y1 - y0) / 2, [0, 0, 1], Math.abs(z1 - z0) / 2, open); }
  /** the ring of a section about o, square to d */
  ring(o: V, d: V, sec: Sec, up: V = [0, 0, 1]): V[] { const [p, q] = square(norm(d), up); return sec.map(([x, y]) => add(add(o, mul(p, x)), mul(q, y))); }
  /** a section swept straight from a to b; `up` the section's up */
  prism(a: V, b: V, sec: Sec, up: V = [0, 0, 1], caps: boolean | 'a' | 'b' = true): this { const d = sub(b, a); if (len(d) < 1) return this; return this.loft([this.ring(a, d, sec, up), this.ring(b, d, sec, up)], caps); }
  cyl(a: V, b: V, r: number, seg: number, caps: boolean | 'a' | 'b' = true, up: V = [0, 0, 1]): this { return this.prism(a, b, circle(this.rr(r), this.sg(seg)), up, caps); }
  /** a bar of square section (t across, t2 up) */
  bar(a: V, b: V, t: number, t2 = t, caps = true): this { const m = Math.min(t, t2), f = 2 * this.rr(m / 2) / m; t *= f; t2 *= f; return this.prism(a, b, [[-t / 2, -t2 / 2], [t / 2, -t2 / 2], [t / 2, t2 / 2], [-t / 2, t2 / 2]], [0, 0, 1], caps); }
  /** a profile turned about the line from o along d: [distance along, radius] pairs (`flat`: the radius up is this share of the radius across) */
  lathe(o: V, d: V, prof: [number, number][], seg: number, caps: boolean | 'a' | 'b' = true, up: V = [0, 0, 1], flat = 1): this {
    const dn = norm(d); return this.loft(prof.map(([t, r]) => this.ring(add(o, mul(dn, t)), dn, circle(Math.max(r, 0.01), seg, Math.max(r, 0.01) * flat), up)), caps); }
  /** a section carried through points, its joints mitred (the section kept square to the path's turn at each) */
  sweep(pts: V[], sec: Sec, caps: boolean | 'a' | 'b' = false, up: V = [0, 0, 1]): this {
    const P = pts.filter((p, i) => i === 0 || len(sub(p, pts[i - 1]!)) > 0.5); if (P.length < 2) return this;
    const dirs = P.slice(1).map((p, i) => norm(sub(p, P[i]!))), rings: V[][] = []; let n = square(dirs[0]!, up)[0];
    for (let i = 0; i < P.length; i++) { const din = dirs[Math.max(0, i - 1)]!, dout = dirs[Math.min(dirs.length - 1, i)]!, t = norm(add(din, dout)), k = 1 / Math.max(0.6, dot(t, din));
      n = norm(sub(n, mul(t, dot(n, t)))); const q = cross(t, n);
      // the joint's ring lies in the plane halving the turn: stretched along the turn's own direction so the pipe keeps its bore
      const turn = sub(dout, din), tl = len(turn), tn: V = tl > 1e-6 ? mul(turn, 1 / tl) : [0, 0, 0];
      rings.push(sec.map(([x, y]) => { const v = add(mul(n, x), mul(q, y)), s = dot(v, tn) * (k - 1); return add(add(P[i]!, v), mul(tn, s)); })); }
    return this.loft(rings, caps); }
  /** a round tube through points */
  tube(pts: V[], r: number, seg: number, caps: boolean | 'a' | 'b' = false): this { return this.sweep(pts, circle(this.rr(r), this.sg(seg)), caps); }
  /** a round tube bent smoothly from a (leaving along ta) to b (arriving along tb), in n lengths; `k` how far the ends hold their direction */
  bend(a: V, ta: V, b: V, tb: V, r: number, seg: number, n = 5, k = 0.4, caps: boolean | 'a' | 'b' = false): this { return this.tube(bendPath(a, ta, b, tb, this.st ? Math.max(n, 4) : n, k), r, seg, caps); }

  /** the bounds of everything collected so far */
  bounds(): { min: V; max: V } { const min: V = [Infinity, Infinity, Infinity], max: V = [-Infinity, -Infinity, -Infinity];
    for (const q of this.g) for (const p of q.t) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, p[k]!); max[k] = Math.max(max[k]!, p[k]!); } return { min, max }; }
  /** the triangles collected so far */
  count(): number { return this.g.reduce((s, q) => s + q.t.length / 3, 0); }
  /** everything into the car's mesh, part by part; the bounds and the triangles of each part's name */
  emit(b: Build): Map<string, Bounds> {
    const out = this.measure(); for (const l of this.L) b.line(l);
    for (const q of this.g) { if (!q.t.length) continue; b.name(q.name).mat(q.col, q.gloss, q.kind); for (let i = 0; i < q.t.length; i += 3) b.tri(q.t[i]!, q.t[i + 1]!, q.t[i + 2]!); }
    return out; }
  /** each part name's bounds and triangles, without building anything */
  measure(): Map<string, Bounds> {
    const out = new Map<string, Bounds>();
    for (const q of this.g) { if (!q.t.length) continue;
      let B = out.get(q.name); if (!B) { B = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], tris: 0 }; out.set(q.name, B); }
      for (let i = 0; i < q.t.length; i += 3) { B.tris++;
        for (let j = 0; j < 3; j++) { const p = q.t[i + j]!; for (let k = 0; k < 3; k++) { B.min[k] = Math.min(B.min[k]!, p[k]!); B.max[k] = Math.max(B.max[k]!, p[k]!); } } } }
    for (const [n, d] of this.thin) { const B = out.get(n); if (B) B.thin = d; }
    return out; }
}
/** the points of a smooth bend from a (along ta) to b (along tb): a cubic's n lengths */
export function bendPath(a: V, ta: V, b: V, tb: V, n = 5, k = 0.4): V[] {
  const L = len(sub(b, a)), c1 = add(a, mul(norm(ta), L * k)), c2 = sub(b, mul(norm(tb), L * k)), out: V[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, v = 1 - t; out.push([0, 1, 2].map(q => v * v * v * a[q]! + 3 * v * v * t * c1[q]! + 3 * v * t * t * c2[q]! + t * t * t * b[q]!) as V); }
  return out; }
