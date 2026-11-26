// The interior's builder (docs/systems/109 section 4): shapes for a cabin's parts, each built in its own frame (a seat
// about its hip point, a wheel about its centre) and placed by the frame set at the time. It keeps what the car
// builder (render/car/mesh.ts Build) has no room for: a picture's coordinates on the interior's sheet for each corner
// (Mesh.uv), the bone a gauge's needle hangs on (Mesh.dial), and the drawn lines (Mesh.lines).
// Every solid is wound by its own volume, so a part may be mirrored or turned freely; a flat sheet is wound toward the
// side it is told to face. Units mm; the car's axes (x from the nose back, y to the car's left, z up).
import { Build, type Kind, type LineKind, type Mesh, type MeshLine, type V } from '../mesh';
import { ATLAS_CELLS } from '../../live/style';
import { regionUV, type Region } from './atlas';

export const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V) => Math.hypot(a[0], a[1], a[2]), unit = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** a point of a frame: o + a x + b y + c z */
export interface Frame { o: V; x: V; y: V; z: V }
export const WORLD: Frame = { o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
/** a frame at `o` leaning about the y axis: `deg` > 0 turns its z axis toward +x (a seat back reclined, a column raked) */
export function leaning(o: V, deg: number): Frame { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return { o, x: [c, 0, -s], y: [0, 1, 0], z: [s, 0, c] }; }
export const at = (f: Frame, p: V): V => [f.o[0] + f.x[0] * p[0] + f.y[0] * p[1] + f.z[0] * p[2], f.o[1] + f.x[1] * p[0] + f.y[1] * p[1] + f.z[1] * p[2], f.o[2] + f.x[2] * p[0] + f.y[2] * p[1] + f.z[2] * p[2]];
export const dir = (f: Frame, p: V): V => sub(at(f, p), f.o);
/** frame `g` given in frame `f`'s terms, as a frame of the car */
export const within = (f: Frame, g: Frame): Frame => ({ o: at(f, g.o), x: dir(f, g.x), y: dir(f, g.y), z: dir(f, g.z) });
/** a frame mirrored across the car's centre plane */
export const mirrored = (f: Frame): Frame => ({ o: [f.o[0], -f.o[1], f.o[2]], x: [f.x[0], -f.x[1], f.x[2]], y: [f.y[0], -f.y[1], f.y[2]], z: [f.z[0], -f.z[1], f.z[2]] });

interface Tri { p: [V, V, V]; uv: number[] | null }
/** a ring of `n` points round an axis: `r` from the centre `c`, in the plane of the unit vectors u and v */
export const ring = (c: V, u: V, v: V, r: number, n: number, r2 = r, turn = 0): V[] => Array.from({ length: n }, (_, i) => { const t = (i + turn) / n * Math.PI * 2; return add(c, add(mul(u, Math.cos(t) * r), mul(v, Math.sin(t) * r2))); });
/** two unit vectors square to `d` */
export function square(d: V, hint: V = [0, 0, 1]): [V, V] { const h = Math.abs(dot(d, hint)) > 0.95 ? [1, 0, 0] as V : hint, u = unit(cross(d, h)), v = unit(cross(d, u)); return [u, v]; }

export class InteriorBuild {
  private b = new Build(); private uv: number[] = []; private dial: number[] = []; private lines: MeshLine[] = []; private n = 0;
  private f: Frame = WORLD; private pend: Tri[] = []; private bone = 0; private nm = ''; readonly count: Record<string, number> = {};
  private cell = ATLAS_CELLS.indexOf('interior') + 1;
  /** the frame what follows is built in */
  frame(f: Frame): this { this.flush(); this.f = f; return this; }
  get frameNow(): Frame { return this.f; }
  /** a new part: its name (the outline's share goes by it, render/live/style.ts), colour, gloss and kind */
  part(name: string, colour: string, gloss = 0.15, kind: Kind = 'plain'): this { this.flush(); this.nm = name; this.b.name(name).mat(colour, gloss, kind); return this; }
  /** the bone what follows hangs on (0: none; a needle's, render/car/interior/gauges.ts) */
  onBone(k: number): this { this.flush(); this.bone = k; return this; }
  private flush(): void { if (!this.pend.length) return; const f = this.f, flip = dot(cross(f.x, f.y), f.z) < 0;
    for (const t of this.pend) { const [a, b, c] = t.p, A = at(f, a), B = at(f, flip ? c : b), C = at(f, flip ? b : c); this.b.tri(A, B, C); this.n++; this.count[this.nm] = (this.count[this.nm] ?? 0) + 1; this.dial.push(this.bone);
      const u = t.uv; if (u) this.uv.push(u[0]!, u[1]!, this.cell, ...(flip ? [u[4]!, u[5]!, this.cell, u[2]!, u[3]!, this.cell] : [u[2]!, u[3]!, this.cell, u[4]!, u[5]!, this.cell])); else this.uv.push(0, 0, 0, 0, 0, 0, 0, 0, 0); }
    this.pend = []; }
  /** triangles as one closed solid: wound outward by their volume */
  private solid(ts: [V, V, V][]): this { this.flush(); let vol = 0; for (const [a, b, c] of ts) vol += dot(a, cross(b, c)); this.pend = ts.map(([a, b, c]) => ({ p: vol >= 0 ? [a, b, c] : [a, c, b], uv: null })); return this; }
  /** triangles as an open sheet: each wound to face `toward` */
  private sheet(ts: [V, V, V][], toward: V): this { this.flush(); this.pend = ts.map(([a, b, c]) => ({ p: dot(cross(sub(b, a), sub(c, a)), toward) >= 0 ? [a, b, c] : [a, c, b], uv: null })); return this; }
  private static skin(rings: V[][], o: { caps?: boolean; loop?: boolean; open?: boolean }): [V, V, V][] { const ts: [V, V, V][] = [], R = o.loop ? [...rings, rings[0]!] : rings;
    const quad = (a: V, b: V, c: V, d: V) => { if (len(sub(a, b)) > 1e-6) ts.push([a, b, c]); if (len(sub(c, d)) > 1e-6) ts.push([a, c, d]); };
    for (let r = 0; r + 1 < R.length; r++) { const A = R[r]!, B = R[r + 1]!, K = Math.max(A.length, B.length), m = o.open ? K - 1 : K; for (let i = 0; i < m; i++) quad(A[i % A.length]!, A[(i + 1) % A.length]!, B[(i + 1) % B.length]!, B[i % B.length]!); }
    if (o.caps !== false && !o.loop && !o.open) for (const [k, C] of [[0, R[0]!], [1, R[R.length - 1]!]] as const) { if (C.length < 3) continue; const m = mul(C.reduce((s, p) => add(s, p), [0, 0, 0] as V), 1 / C.length); for (let i = 0; i < C.length; i++) ts.push(k ? [m, C[i]!, C[(i + 1) % C.length]!] : [m, C[(i + 1) % C.length]!, C[i]!]); }
    return ts; }
  /** rings of points joined into a closed skin: its ends capped, or the last ring joined to the first (`loop`: a rim, a
   *  bezel). A ring of one point is a tip */
  loft(rings: V[][], o: { caps?: boolean; loop?: boolean } = {}): this { return this.solid(InteriorBuild.skin(rings, o)); }
  /** rows of points joined into an open sheet (a panel, a carpet), facing `toward` */
  panel(rows: V[][], toward: V): this { return this.sheet(InteriorBuild.skin(rows, { open: true }), toward); }
  /** a fan round a centre (a dial's face), facing `toward` */
  fan(c: V, rim: V[], toward: V): this { return this.sheet(rim.map((p, i) => [c, p, rim[(i + 1) % rim.length]!] as [V, V, V]), toward); }
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): this { const r = (x: number): V[] => [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]; return this.loft([r(x0), r(x1)]); }
  /** a slab from a to b: `w` wide along `side`, `t` thick (a spoke, a pedal's arm, a lever) */
  slab(a: V, b: V, side: V, w: number, t: number, w2 = w): this { const d = unit(sub(b, a)), s = unit(sub(side, mul(d, dot(side, d)))), n = unit(cross(d, s));
    const r = (p: V, ww: number): V[] => [add(add(p, mul(s, ww / 2)), mul(n, t / 2)), add(sub(p, mul(s, ww / 2)), mul(n, t / 2)), sub(sub(p, mul(s, ww / 2)), mul(n, t / 2)), sub(add(p, mul(s, ww / 2)), mul(n, t / 2))]; return this.loft([r(a, w), r(b, w2)]); }
  /** a round tube along a path, `sides` round (a cage's tube, a column, an arm): its radius one number or one a point;
   *  `loop` closes it into a ring (a wheel's rim) */
  tube(path: V[], r: number | number[], sides = 8, o: { loop?: boolean; caps?: boolean; hint?: V } = {}): this { const n = path.length, rings: V[][] = []; let u: V | null = null;
    for (let i = 0; i < n; i++) { const a = path[o.loop ? (i + n - 1) % n : Math.max(0, i - 1)]!, c = path[o.loop ? (i + 1) % n : Math.min(n - 1, i + 1)]!, d = unit(sub(c, a));
      // the ring's frame carried along the path, so the tube does not twist
      u = u ? unit(sub(u, mul(d, dot(u, d)))) : square(d, o.hint)[0]; const v = unit(cross(d, u)), rr = typeof r === 'number' ? r : r[i]!;
      // at a bend the ring lies on the bisecting plane, widened so the tube keeps its width
      const din = unit(sub(path[i]!, a)), k = i > 0 && i < n - 1 || o.loop ? 1 / Math.max(0.5, dot(d, din)) : 1;
      rings.push(ring(path[i]!, u, v, rr * (1 + (k - 1) * 0.5), sides)); }
    return this.loft(rings, { loop: o.loop, caps: o.caps }); }
  /** a profile turned about an axis from `o` along the unit vector `ax`: [distance along, radius] pairs; a radius of 0 is a tip */
  turn(o: V, ax: V, prof: [number, number][], seg = 8, opt: { loop?: boolean; caps?: boolean; hint?: V; turn?: number } = {}): this { const [u, v] = square(ax, opt.hint);
    return this.loft(prof.map(([a, r]) => r <= 0 ? [add(o, mul(ax, a))] : ring(add(o, mul(ax, a)), u, v, r, seg, r, opt.turn ?? 0)), opt); }
  /** a picture's plate: a thin box `w` by `h` standing `depth` proud at `c`, its face (toward `n`) carrying the region.
   *  `right` and `up` are the picture's own, as the eye looking at the face sees them */
  plate(c: V, right: V, up: V, n: V, w: number, h: number, depth: number, region: Region): this { const R = unit(right), U = unit(up), N = unit(n), p = (a: number, b: number, d: number): V => add(c, add(add(mul(R, a * w / 2), mul(U, b * h / 2)), mul(N, d)));
    this.loft([[p(-1, -1, -depth), p(1, -1, -depth), p(1, 1, -depth), p(-1, 1, -depth)], [p(-1, -1, 0), p(1, -1, 0), p(1, 1, 0), p(-1, 1, 0)]]); return this.paint(region, c, R, U, w, h, N); }
  /** a flat picture (no thickness) on a surface: corners by its middle, right, up; facing n */
  picture(c: V, right: V, up: V, n: V, w: number, h: number, region: Region): this { const R = unit(right), U = unit(up), p = (a: number, b: number): V => add(c, add(mul(R, a * w / 2), mul(U, b * h / 2)));
    this.sheet([[p(-1, 1), p(1, 1), p(1, -1)], [p(-1, 1), p(1, -1), p(-1, -1)]], n); return this.paint(region, c, R, U, w, h); }
  /** lay a region of the sheet on the shape just built (in its own frame): the picture `w` by `h` about `c`, its right
   *  and up as the eye sees them. Only faces wholly inside it take it, and only those turned toward `facing` if given */
  paint(region: Region, c: V, right: V, up: V, w: number, h: number, facing?: V, min = 0.25): this { const [u0, v0, u1, v1] = regionUV(region), e = 0.02;
    for (const t of this.pend) { if (t.uv) continue; if (facing) { const nn = unit(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]))); if (dot(nn, facing) < min) continue; }
      const q = t.p.map(p => { const d = sub(p, c); return [dot(d, right) / w + 0.5, 0.5 - dot(d, up) / h]; }); if (q.some(([a, b]) => a! < -e || a! > 1 + e || b! < -e || b! > 1 + e)) continue;
      t.uv = q.flatMap(([a, b]) => [u0 + (u1 - u0) * Math.max(0, Math.min(1, a!)), v0 + (v1 - v0) * Math.max(0, Math.min(1, b!))]); }
    return this; }
  /** a drawn line (Mesh.lines), in the frame set */
  line(kind: LineKind, pts: V[], o: { closed?: boolean; w?: number } = {}): this { this.lines.push({ kind, pts: pts.map(p => at(this.f, p)), ...o, ...(this.bone ? { bone: this.bone } : {}) }); return this; }
  get tris(): number { this.flush(); return this.n; }
  mesh(length: number): Mesh { this.flush(); const M = this.b.mesh(length); return { ...M, uv: new Float32Array(this.uv), dial: new Uint8Array(this.dial), lines: this.lines.slice() }; }
}
