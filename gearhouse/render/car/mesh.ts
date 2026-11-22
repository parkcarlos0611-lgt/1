// A car as a low-polygon mesh (review 80): the trial of modelling cars in true 3D, in the flat-shaded, outlined manner
// of low-poly drift games, drawn small and shown in whole pixels. The shapes come from stations along the car (a
// cross-section every so often, lofted into a skin), swept sections for wings, turned profiles for lamps and wheels,
// and bars and boxes for the fittings: numbers read off the sheet's views and the real car's sizes, not pixels.
// Units mm; x from the nose back, y from the centre line to the car's left, z up.
import { NEW, hash, fbm, ss, mix, rustAt, rgb2hsl, hsl2rgb, cells, type Wear } from './wear';
export type V = [number, number, number];
/** what each triangle is made of: it picks the texture and how age shows on it (glass is drawn see-through) */
export const KINDS = ['plain', 'paint', 'metal', 'glass', 'shine', 'tyre', 'wood', 'canvas', 'leather', 'lens', 'grille'] as const;
export type Kind = typeof KINDS[number];
/** `kind` per triangle (KINDS index); `tex` per triangle: 1 or 2 on a tyre's tread, alternate blocks round the wheel */
export interface Mesh { n: number; pos: Float32Array; col: Uint8Array; gloss: Float32Array; part: Int16Array; kind: Uint8Array; tex: Uint8Array; length: number }
const hex = (h: string): V => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = (a: V) => Math.hypot(a[0], a[1], a[2]), norm = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** the builder: every shape adds triangles in the colour, gloss and part number set at the time */
export class Build {
  private P: number[] = []; private C: number[] = []; private G: number[] = []; private T: number[] = []; private K: number[] = []; private X: number[] = [];
  private c: V = [128, 128, 128]; private g = 0.2; private part = 0; private k = 0; private x = 0;
  /** the colour and gloss (0 flat .. 1 bright metal) of what follows; each call starts a new part (parts are outlined against each other) */
  mat(colour: string, gloss = 0.2, kind: Kind = 'plain'): this { this.c = hex(colour); this.g = gloss; this.k = KINDS.indexOf(kind); this.part++; return this; }
  tri(a: V, b: V, c: V): this { this.P.push(...a, ...b, ...c); this.C.push(...this.c); this.G.push(this.g); this.T.push(this.part); this.K.push(this.k); this.X.push(this.x); return this; }
  quad(a: V, b: V, c: V, d: V): this { return this.tri(a, b, c).tri(a, c, d); }
  /** rings of the same number of points joined into a skin; the ends closed */
  loft(rings: V[][], caps = true, tex?: (band: number, i: number) => number): this {
    for (let r = 0; r + 1 < rings.length; r++) { const A = rings[r]!, B = rings[r + 1]!, K = A.length; for (let i = 0; i < K; i++) { this.x = tex ? tex(r, i) : 0; this.quad(A[i]!, A[(i + 1) % K]!, B[(i + 1) % K]!, B[i]!); } }
    this.x = 0; if (caps) for (const R of [rings[0]!, rings[rings.length - 1]!]) { const m = mul(R.reduce((s, p) => add(s, p), [0, 0, 0] as V), 1 / R.length); for (let i = 0; i < R.length; i++) this.tri(m, R[i]!, R[(i + 1) % R.length]!); }
    return this; }
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): this {
    const r = (x: number): V[] => [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]; return this.loft([r(x0), r(x1)]); }
  /** a bar of square section from a to b (pipes, frames, straps, spokes) */
  bar(a: V, b: V, t: number, t2 = t): this { const d = norm(sub(b, a)), up: V = Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], u = mul(norm(cross(d, up)), t / 2), v = mul(norm(cross(d, u)), t2 / 2);
    const r = (p: V): V[] => [add(add(p, u), v), add(sub(p, u), v), sub(sub(p, u), v), sub(add(p, u), v)]; return this.loft([r(a), r(b)]); }
  /** a profile turned about an axis through `o` along x or y: [distance along the axis, radius] pairs */
  lathe(axis: 'x' | 'y', o: V, prof: [number, number][], seg = 16, caps = true): this {
    const ring = ([a, r]: [number, number]): V[] => Array.from({ length: seg }, (_, i) => { const t = i / seg * Math.PI * 2, c = Math.cos(t) * r, s = Math.sin(t) * r; return (axis === 'x' ? [o[0] + a, o[1] + c, o[2] + s] : [o[0] + c, o[1] + a, o[2] + s]) as V; });
    const top = Math.max(...prof.map(p => p[1]));   // the outermost band (a tyre's tread) is marked in alternate blocks
    return this.loft(prof.map(ring), caps, (b, i) => prof[b]![1] === top && prof[b + 1]![1] === top ? 1 + (i & 1) : 0); }
  mesh(length: number): Mesh { return { n: this.G.length, pos: new Float32Array(this.P), col: new Uint8Array(this.C), gloss: new Float32Array(this.G), part: new Int16Array(this.T), kind: new Uint8Array(this.K), tex: new Uint8Array(this.X), length }; }
}
/** a body section at x: a closed ring, half-width w about y = 0, from zb up to zt; `top` and `bot` are how square the
 *  upper and lower halves are (2 a circle's roundness, 6 nearly a box); `k` points round */
export function section(x: number, w: number, zb: number, zt: number, top = 3, bot = 6, k = 20): V[] {
  const zc = (zb + zt) / 2, h = (zt - zb) / 2, out: V[] = [];
  for (let i = 0; i < k; i++) { const t = (i + 0.5) / k * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), n = s >= 0 ? top : bot; out.push([x, w * Math.sign(c) * Math.abs(c) ** (2 / n), zc + h * Math.sign(s) * Math.abs(s) ** (2 / n)]); }
  return out; }
/** a wing: a crowned strip swept along a path seen from the side. Each point [x, z, yIn, yOut] is the top of the wing
 *  there and how far across it reaches; `hub` the wheel's centre [x, z] it stands over; `t` its thickness, `crown` how much its middle stands above its edges */
export function wing(b: Build, path: [number, number, number, number][], hub: [number, number], t = 45, crown = 35): void {
  const rings: V[][] = path.map((p, i) => { const a = path[Math.max(0, i - 1)]!, c = path[Math.min(path.length - 1, i + 1)]!, tx = c[0] - a[0], tz = c[1] - a[1], l = Math.hypot(tx, tz) || 1; let nx = -tz / l, nz = tx / l; if (nx * (p[0] - hub[0]) + nz * (p[1] - hub[1]) < 0) { nx = -nx; nz = -nz; }   // outward: away from the wheel it covers
    const [x, z, yi, yo] = p, ym = (yi + yo) / 2, at = (y: number, k: number): V => [x + nx * k, y, z + nz * k];
    return [at(yi, -t), at(yi, -crown * 0.4), at(ym, crown * 0.6), at(yo, -crown * 0.6), at(yo, -t - crown * 0.6)]; });
  b.loft(rings); }

export interface Pic { w: number; h: number; rgba: Uint8ClampedArray }
const SUN: V = norm([-0.45, 0.35, 0.82]);
/** The mesh drawn from heading `yaw` (0 = nose to the right) with the camera `pitch` degrees above the ground (0 = from
 *  the side), `mm` millimetres a pixel: flat tones in a few steps, a dark line round the car and between its parts,
 *  its shadow on the ground. `spin` turns the wheels' parts (see `wheels` in the car's own file). */
/** The car files keep the sheets' sides (+y = the car's right, as the part models have it); the projection below sees
 *  -y from a nose-left heading, so it draws the mirror image. Mirror once here so a car's left shows nose-left, as in 2D. */
const mirrored = new WeakMap<Mesh, Mesh>();
function asDrawn(M: Mesh): Mesh { let m = mirrored.get(M); if (!m) { const pos = Float32Array.from(M.pos); for (let i = 1; i < pos.length; i += 3) pos[i] = -pos[i]!; m = { ...M, pos }; mirrored.set(M, m); } return m; }
export interface DrawOpts { outline?: number; shadow?: boolean; cy?: number; /** the car tilted on its ground point: roll (rad, its left side up +), pitch (rad, nose up +) */ roll?: number; pitch?: number; /** front wheels turned (rad, to the car's left +), every wheel turned on its axle (rad) */ steer?: number; spin?: number; /** how much of what is behind glass it hides, 0..1 */ glass?: number; wear?: Wear }
const PAINT = 1, METAL = 2, GLASS = 3, SHINE = 4, TYRE = 5, WOOD = 6, CANVAS = 7, LEATHER = 8, LENS = 9, GRILLE = 10;
const GLASS_TINT: V = [150, 172, 182];
const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;
/** a road wheel found in a mesh: its hub (car-file axes: x back, y to the right, z up), radius, half-width, and its triangles */
export interface WheelGroup { hx: number; hy: number; hz: number; r: number; hw: number; front: boolean; tris: number[] }
const wheelCache = new WeakMap<Mesh, WheelGroup[]>();
/** the road wheels, found from the tyres (no list kept in the car files): the tyre triangles gathered into rings, the
 *  rings that touch the ground kept (a spare stands clear of it), and every triangle lying wholly inside a ring's
 *  cylinder taken as that wheel's (rim, spokes, hub) */
export function wheelsOf(M: Mesh): WheelGroup[] { const have = wheelCache.get(M); if (have) return have; const p = M.pos, T = KINDS.indexOf('tyre');
  const rings: { tris: number[]; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; cx: number; cy: number }[] = [];
  for (let t = 0; t < M.n; t++) { if (M.kind[t] !== T) continue; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) { const x = p[t * 9 + k * 3]!, y = p[t * 9 + k * 3 + 1]!, z = p[t * 9 + k * 3 + 2]!; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; let g = rings.find(r => Math.abs(r.cx - cx) < 700 && Math.abs(r.cy - cy) < 250);
    if (!g) { g = { tris: [], x0, x1, y0, y1, z0, z1, cx, cy }; rings.push(g); } g.tris.push(t); g.x0 = Math.min(g.x0, x0); g.x1 = Math.max(g.x1, x1); g.y0 = Math.min(g.y0, y0); g.y1 = Math.max(g.y1, y1); g.z0 = Math.min(g.z0, z0); g.z1 = Math.max(g.z1, z1); g.cx = (g.x0 + g.x1) / 2; g.cy = (g.y0 + g.y1) / 2; }
  const road = rings.filter(g => g.z0 < 40 && g.tris.length > 8), mid = road.reduce((a, g) => a + g.cx, 0) / Math.max(1, road.length);
  const out: WheelGroup[] = road.map(g => ({ hx: g.cx, hy: g.cy, hz: (g.z0 + g.z1) / 2, r: (g.z1 - g.z0) / 2, hw: (g.y1 - g.y0) / 2, front: g.cx < mid, tris: [] }));
  for (let t = 0; t < M.n; t++) for (const w of out) { let inside = true;
    for (let k = 0; k < 3 && inside; k++) { const x = p[t * 9 + k * 3]! - w.hx, y = p[t * 9 + k * 3 + 1]! - w.hy, z = p[t * 9 + k * 3 + 2]! - w.hz; if (x * x + z * z > (w.r * 1.03) ** 2 || Math.abs(y) > w.hw + 90) inside = false; }
    if (inside) { w.tris.push(t); break; } }
  wheelCache.set(M, out); return out; }
/** the mesh with its front wheels steered and every wheel turned on its axle */
function posed(M: Mesh, steer: number, spin: number): Mesh { if (!steer && !spin) return M; const W = wheelsOf(M); if (!W.length) return M; const pos = Float32Array.from(M.pos);
  const cs = Math.cos(spin), ss2 = Math.sin(spin), cd = Math.cos(steer), sd = Math.sin(steer);
  for (const w of W) for (const t of w.tris) for (let k = 0; k < 3; k++) { const i = t * 9 + k * 3; let x = pos[i]! - w.hx, y = pos[i + 1]! - w.hy, z = pos[i + 2]! - w.hz;
    if (spin) { const x1 = x * cs - z * ss2, z1 = x * ss2 + z * cs; x = x1; z = z1; }
    if (w.front && steer) { const x2 = x * cd + y * sd, y2 = -x * sd + y * cd; x = x2; y = y2; }   // about the upright: the wheel's front (x < 0) goes to the car's left (+y in the drawn, mirrored frame)
    pos[i] = x + w.hx; pos[i + 1] = y + w.hy; pos[i + 2] = z + w.hz; }
  return { ...M, pos }; }
/** the mesh turned about its centre's ground point (x = half its length, y = 0, z = 0): roll about the length, then
 *  pitch about the width. In the drawn (mirrored) frame, so roll > 0 lifts the car's left side as seen */
function tilted(M: Mesh, roll: number, pitch: number): Mesh { if (!roll && !pitch) return M; const pos = Float32Array.from(M.pos), cx = M.length / 2, cr = Math.cos(roll), sr = Math.sin(roll), cp = Math.cos(pitch), sp = Math.sin(pitch);
  for (let i = 0; i < pos.length; i += 3) { let x = pos[i]! - cx, y = pos[i + 1]!, z = pos[i + 2]!; const y1 = y * cr + z * sr, z1 = -y * sr + z * cr; y = y1; z = z1; const x2 = x * cp - z * sp, z2 = x * sp + z * cp; pos[i] = x2 + cx; pos[i + 1] = y; pos[i + 2] = z2; }
  return { ...M, pos }; }
export function drawMesh(M0: Mesh, yaw: number, pitch: number, mm: number, w: number, h: number, o: DrawOpts = {}): Pic {
  const M = tilted(asDrawn(posed(M0, o.steer ?? 0, o.spin ?? 0)), o.roll ?? 0, o.pitch ?? 0), W = o.wear ?? NEW, ga = o.glass ?? 0.8;
  const th = yaw * Math.PI / 180, ph = pitch * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th), sp = Math.sin(ph), cp = Math.cos(ph), N = w * h, cx = M.length / 2, cy = h * (o.cy ?? 0.62);
  const zb = new Float32Array(N).fill(-1e9), tri = new Int32Array(N).fill(-1), rgba = new Uint8ClampedArray(N * 4), at = new Float32Array(N * 3);   // at: the point of the car each pixel shows
  const sun: V = [SUN[0] * ct + SUN[1] * st, -SUN[0] * st + SUN[1] * ct, SUN[2]], cam: V = [-cp * st, -cp * ct, sp];
  const prj = (x: number, y: number, z: number): V => { const xr = (x - cx) * ct - y * st, yr = (x - cx) * st + y * ct; return [w / 2 + xr / mm, cy + (-yr * sp - z * cp) / mm, -yr * cp + z * sp]; };
  const fill = (a: V, b: V, c: V, f: (i: number, d: number, l0: number, l1: number, l2: number) => void) => { const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0]))), y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-9) return;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const px = X + 0.5, py = Y + 0.5, l0 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den, l1 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den, l2 = 1 - l0 - l1;
      if (l0 < 0 || l1 < 0 || l2 < 0) continue; f(Y * w + X, l0 * a[2] + l1 * b[2] + l2 * c[2], l0, l1, l2); } };
  const p = M.pos, vtx = (t: number, k: number): V => [p[t * 9 + k * 3]!, p[t * 9 + k * 3 + 1]!, p[t * 9 + k * 3 + 2]!];
  const normal = (t: number): V => { const a = vtx(t, 0); let n = norm(cross(sub(vtx(t, 1), a), sub(vtx(t, 2), a))); if (n[0] * cam[0] + n[1] * cam[1] + n[2] * cam[2] < 0) n = mul(n, -1); return n; };
  // ---- pass 1: everything but glass, nearest wins; the shadow on the ground ----
  const shadow = new Uint8Array(N), glassTris: number[] = [];
  for (let t = 0; t < M.n; t++) { const A = prj(...vtx(t, 0)), B = prj(...vtx(t, 1)), C = prj(...vtx(t, 2)), kd = M.kind[t]!;
    if (kd === GLASS || kd === SHINE) glassTris.push(t);
    else fill(A, B, C, (i, d, l0, l1, l2) => { if (d > zb[i]!) { zb[i] = d; tri[i] = t; const q = t * 9; at[i * 3] = l0 * p[q]! + l1 * p[q + 3]! + l2 * p[q + 6]!; at[i * 3 + 1] = l0 * p[q + 1]! + l1 * p[q + 4]! + l2 * p[q + 7]!; at[i * 3 + 2] = l0 * p[q + 2]! + l1 * p[q + 5]! + l2 * p[q + 8]!; } });
    if (o.shadow !== false && pitch > 5) { const q = t * 9, g = (k: number): V => { const z = p[q + k + 2]!; return prj(p[q + k]! - sun[0] / sun[2] * z, p[q + k + 1]! - sun[1] / sun[2] * z, 0); }; fill(g(0), g(3), g(6), i => { shadow[i] = 1; }); } }
  // ---- pass 2: flat tones, then each material's texture, then age ----
  let ymax = 1; for (let i = 1; i < p.length; i += 3) ymax = Math.max(ymax, Math.abs(p[i]!));
  const grain = new Float32Array(M.n * 3); for (let t = 0; t < M.n; t++) { let best = -1; for (let k = 0; k < 3; k++) { const e = sub(vtx(t, (k + 1) % 3), vtx(t, k)), l = len(e); if (l > best) { best = l; grain.set(norm(e), t * 3); } } }   // wood runs along a part's longest edge
  const rusty = new Float32Array(N), isPaint = (i: number) => tri[i]! >= 0 && M.kind[tri[i]!] === PAINT;
  const edgeMM = W.rust ? paintEdges(tri, M, w, h, mm) : null;
  for (let i = 0; i < N; i++) { const t = tri[i]!; if (t < 0) { if (shadow[i]) { rgba[i * 4] = 24; rgba[i * 4 + 1] = 22; rgba[i * 4 + 2] = 20; rgba[i * 4 + 3] = 110; } continue; }
    const n = normal(t), kd = M.kind[t]!, X = at[i * 3]!, Y = at[i * 3 + 1]!, Z = at[i * 3 + 2]!;
    const d = Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]), g = M.gloss[t]!; let k = Math.round((0.5 + 0.62 * d) * 5) / 5, s = 0;
    if (g > 0.7) { k = n[2] > 0.5 ? 1.15 : n[2] > 0.1 ? 0.92 : n[2] > -0.2 ? 0.55 : 0.8; if (d > 0.88) s = 60; } else if (g > 0.3 && d > 0.95) s = 45;
    // the plane a pattern is laid in: the two axes across the face's main direction
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]), [U, V2] = ay >= ax && ay >= az ? [X, Z] : ax >= az ? [Y, Z] : [X, Y];
    let tone = 1, cr = M.col[t * 3]!, cg = M.col[t * 3 + 1]!, cb = M.col[t * 3 + 2]!;
    if (kd === TYRE && M.tex[t] === 2) tone = 0.72;                                                   // tread blocks
    else if (kd === WOOD) { const gx = grain[t * 3]!, gy = grain[t * 3 + 1]!, gz = grain[t * 3 + 2]!, along = X * gx + Y * gy + Z * gz, across = (X * 0.37 + Y * 0.61 + Z * 0.7) - along * (gx * 0.37 + gy * 0.61 + gz * 0.7);
      const v = fbm(across / 7, along / 160); tone = v > 0.62 ? 0.78 : v < 0.38 ? 1.12 : 1; }       // grain: dark lines and light streaks along the wood
    else if (kd === CANVAS) { const v = fbm(U / 160, V2 / 160); tone = v > 0.66 ? 0.93 : v < 0.34 ? 1.05 : 1; }   // the cloth's uneven weathering
    else if (kd === LEATHER) { const v = fbm(U / 45, V2 / 45); tone = v > 0.62 ? 0.86 : v < 0.36 ? 1.1 : 1; }  // creased and polished by wear
    else if (kd === GRILLE) { const a = ((U + V2) / 26 % 1 + 1) % 1, b = ((U - V2) / 26 % 1 + 1) % 1; if (a < 0.28 || b < 0.28) { cr = 150; cg = 148; cb = 140; } }   // a diamond mesh of bright wire
    let R = Math.min(255, cr * k * tone + s), G = Math.min(255, cg * k * tone + s), B = Math.min(255, cb * k * tone + s);
    // ---- age: the sun takes the paint's gloss and colour, rust comes up low and at the seams and runs down ----
    if (kd === PAINT && W.fade) { const sky = 0.45 + 0.55 * Math.max(0, n[2]), blot = ss(0.3, 0.7, fbm(U / 150, V2 / 150) * 0.75 + fbm(U / 14, V2 / 260) * 0.25 + (W.fade - 0.5) * 0.8);
      const a = Math.min(1, W.fade * sky * (0.3 + 0.7 * blot) * 1.45);
      if (a > 0) { R = mix(R, Math.min(255, cr * k * tone), a); G = mix(G, Math.min(255, cg * k * tone), a); B = mix(B, Math.min(255, cb * k * tone), a);   // the lacquer goes flat: no highlight
        let [hh, sa, li] = rgb2hsl(R, G, B); const red = hh < 25 || hh > 330, dark = sa < 0.12 || li < 0.09;
        if (red) hh = (hh + (hh > 330 ? 360 : 0) + 14 * a) % 360; else if (hh > 70 && hh < 170) hh -= 18 * a;
        sa *= 1 - a * (red ? 0.35 : 0.62); li = li + (0.62 - li) * a * (dark ? 0.42 : 0.5); li = Math.max(0, Math.min(1, li + (fbm(U / 20, V2 / 20) - 0.5) * 0.1 * a));
        [R, G, B] = hsl2rgb(hh, sa, li); if (dark) { R = mix(R, R + 14, a); G = mix(G, G + 8, a); }
        if (a > 0.45) { const [, gap] = cells(U / 40, V2 / 28); if (gap < 0.06) { R *= 0.85; G *= 0.85; B *= 0.85; } } } }   // the lacquer crazes
    if (kd === PAINT && W.rust) { const q = W.rust, low = 1 - ss(250, 950, Z), edge = 1 - ss(15, 120, edgeMM![i]!);
      const wx = U / 120 + (fbm(U / 70 + 3, V2 / 70) - 0.5) * 1.4, wy = V2 / 120 + (fbm(U / 70, V2 / 70 + 5) - 0.5) * 1.4;
      const field = fbm(wx, wy) * 0.8 + fbm(U / 22, V2 / 22) * 0.2, broken = edge * ss(0.45, 0.7, fbm(U / 35 + 11, V2 / 35));
      const score = field * 0.75 + low * 0.38 + broken * 0.16, t0 = 0.8 - q * 0.42;
      if (score >= t0) { const depth = (score - t0) / 0.16, c = rustAt(Math.max(0, Math.min(1, 0.22 + depth * 0.7 + (fbm(U / 9, V2 / 9) - 0.5) * 0.45))), sh = k * (depth > 0.55 && hash(i, 3) < 0.12 ? 0.6 : 1);
        R = c[0] * sh; G = c[1] * sh; B = c[2] * sh; if (az < 0.6) rusty[i] = Math.min(1, 0.4 + depth); }
      else if (score > t0 - 0.06 * (0.5 + q)) { const pr = hash(i, 7) < 0.5; R = (pr ? 118 : 92) * k; G = (pr ? 84 : 70) * k; B = (pr ? 70 : 60) * k; } }   // round it the paint has lifted to the primer
    if (kd === METAL && (W.fade || W.rust)) {
      if (W.fade) { const a = W.fade * (0.6 + 0.4 * fbm(U / 40, V2 / 40)), l = lum(R, G, B), t2 = 128 + (l - 128) * (1 - 0.55 * a); R = mix(R, t2 + 6, a * 0.8); G = mix(G, t2 + 4, a * 0.8); B = mix(B, t2, a * 0.8); }   // a milky film
      if (W.rust) { const nn = fbm(U / 30 + 7, V2 / 30) * 0.8 + (1 - ss(250, 950, Z)) * 0.25;
        if (nn > 1.05 - W.rust * 0.6) { const c = nn > 1.13 - W.rust * 0.5 ? rustAt(0.35 + hash(i, 1) * 0.35) : [168, 136, 96]; R = c[0]! * k; G = c[1]! * k; B = c[2]! * k; }   // the plate gone: the nickel under, then rust
        else if (hash(i, 5) < W.rust * 0.16) { const c = rustAt(0.45 + hash(i, 9) * 0.4); R = c[0] * k; G = c[1] * k; B = c[2] * k; } } }   // pitting
    if (kd === PAINT && W.dent) { const dx = (X - M.length * 0.12) / 220, dy = (Y - ymax * 0.78) / 160, dz = (Z - 820) / 130, r = Math.hypot(dx, dy, dz);   // a dent in the right front wing
      if (r < 1 && n[2] > 0.2) { const f = 0.6 + 0.4 * r; R *= f; G *= f; B *= f; } }
    if (kd === LENS && W.lamp && Y > 0) { const shard = hash(i, 11) < 0.3; R = shard ? 196 : 62; G = shard ? 196 : 60; B = shard ? 186 : 56; }   // the right lamp's glass broken
    rgba[i * 4] = R; rgba[i * 4 + 1] = G; rgba[i * 4 + 2] = B; rgba[i * 4 + 3] = 255; }
  // rust runs down the panel below it, on the upright faces, in streaks
  if (W.rust) { const len0 = 150 * (0.5 + W.rust) / mm, fall = Math.pow(0.5, 1 / Math.max(2, len0));
    for (let X = 0; X < w; X++) { const col = hash(X, 77); if (col > 0.72) continue; let carry = 0, from = 0;
      for (let Y = 0; Y < h; Y++) { const i = Y * w + X; if (rusty[i]) { carry = Math.max(carry, Math.min(1, rusty[i]! * (0.75 + col))); from = Y; continue; }
        if (carry < 0.04 || !isPaint(i)) { carry = isPaint(i) ? carry : 0; continue; }
        const j = i * 4, a = carry * 0.85, far = Math.min(1, (Y - from) / len0); rgba[j] = mix(rgba[j]!, mix(96, 150, far), a); rgba[j + 1] = mix(rgba[j + 1]!, mix(44, 78, far), a); rgba[j + 2] = mix(rgba[j + 2]!, mix(20, 36, far), a);
        carry *= fall * (0.985 + hash(X, Y) * 0.015); } } }
  // which pixels some glass lies in front of (for the lines below: glass counts as the car)
  const gHit = new Uint8Array(N);
  for (const t of glassTris) fill(prj(...vtx(t, 0)), prj(...vtx(t, 1)), prj(...vtx(t, 2)), (i, dd) => { if (dd > zb[i]!) gHit[i] = 1; });
  // ---- lines: thin and dark where two parts meet or one surface stands well before another; thick and black round the car
  //      (glass counts as the car: no thick line round what is seen through a window; the parts behind glass keep their
  //      thin lines, drawn before the glass so it dims them) ----
  // a surface's own slope from one pixel to the next is not an edge: at a coarse scale a level top falls more than 60 mm a pixel
  const step = 60 + 2 * mm / Math.tan(Math.max(0.35, ph));
  const ol = o.outline ?? 2, e = new Uint8Array(N); if (ol > 0) { const solid = (j: number) => tri[j]! >= 0 || gHit[j] === 1;
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) { const i = Y * w + X; if (!solid(i)) continue; const t = tri[i]!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const XX = X + dx, YY = Y + dy, j = YY * w + XX; if (XX < 0 || YY < 0 || XX >= w || YY >= h || !solid(j)) { e[i] = 2; break; }
        if (t >= 0 && tri[j]! >= 0 && (zb[j]! - zb[i]! > step || (M.part[tri[j]!] !== M.part[t] && zb[j]! - zb[i]! > 4))) e[i] = Math.max(e[i]!, 1); } }
    for (let pass = 2; pass <= ol; pass++) { const e2 = new Uint8Array(e); for (let Y = 1; Y < h - 1; Y++) for (let X = 1; X < w - 1; X++) { const i = Y * w + X; if (e[i] !== 2) continue; for (const j of [i - 1, i + 1, i - w, i + w]) if (solid(j) && !e[j]) e2[j] = 2; } e.set(e2); }
    for (let i = 0; i < N; i++) if (e[i]) { const k = e[i] === 2 ? 0.2 : 0.5; rgba[i * 4] = rgba[i * 4]! * k; rgba[i * 4 + 1] = rgba[i * 4 + 1]! * k; rgba[i * 4 + 2] = rgba[i * 4 + 2]! * k; if (e[i] === 2) rgba[i * 4 + 3] = 255; } }
  // ---- glass: where it lies before what is drawn, back panes first, laid over at its own strength ----
  const gz = new Float32Array(glassTris.length);
  glassTris.forEach((t, j) => { gz[j] = (prj(...vtx(t, 0))[2] + prj(...vtx(t, 1))[2] + prj(...vtx(t, 2))[2]) / 3; });
  const order = glassTris.map((t, j) => j).sort((a, b) => gz[a]! - gz[b]!);
  for (const j of order) { const t = glassTris[j]!, n = normal(t), d = Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]), shine = M.kind[t] === SHINE;
    const k = 0.62 + 0.45 * d + (n[2] > 0.3 ? 0.1 : 0), c: V = shine ? [M.col[t * 3]!, M.col[t * 3 + 1]!, M.col[t * 3 + 2]!] : GLASS_TINT, a = shine ? Math.min(1, ga + 0.15) : ga;
    const A = prj(...vtx(t, 0)), B = prj(...vtx(t, 1)), C = prj(...vtx(t, 2));
    fill(A, B, C, (i, dd) => { if (dd <= zb[i]!) return; const q = i * 4, da = rgba[q + 3]! / 255, oa = a + da * (1 - a);
      for (let ch = 0; ch < 3; ch++) rgba[q + ch] = (Math.min(255, c[ch]! * k) * a + rgba[q + ch]! * da * (1 - a)) / oa; rgba[q + 3] = oa * 255; }); }
  if (ol > 0) for (let i = 0; i < N; i++) if (e[i] === 2 && gHit[i]) { rgba[i * 4] = rgba[i * 4]! * 0.2; rgba[i * 4 + 1] = rgba[i * 4 + 1]! * 0.2; rgba[i * 4 + 2] = rgba[i * 4 + 2]! * 0.2; rgba[i * 4 + 3] = 255; }   // the outline over a window's edge
  return { w, h, rgba }; }

/** for each painted pixel, how far (mm) it lies from its part's edge on screen: seams and edges rust first */
function paintEdges(tri: Int32Array, M: Mesh, w: number, h: number, mm: number): Float32Array {
  const N = w * h, d = new Float32Array(N).fill(1e6), paint = (i: number) => tri[i]! >= 0 && M.kind[tri[i]!] === PAINT;
  for (let i = 0; i < N; i++) { if (!paint(i)) continue; const X = i % w, pt = M.part[tri[i]!];
    if (X === 0 || X === w - 1 || i < w || i >= N - w || [i - 1, i + 1, i - w, i + w].some(j => !paint(j) || M.part[tri[j]!] !== pt)) d[i] = 0; }
  for (let Y = 1; Y < h; Y++) for (let X = 1; X < w - 1; X++) { const i = Y * w + X; if (d[i]) d[i] = Math.min(d[i]!, d[i - 1]! + 1, d[i - w]! + 1, d[i - w - 1]! + 1.41, d[i - w + 1]! + 1.41); }
  for (let Y = h - 2; Y >= 0; Y--) for (let X = w - 2; X >= 1; X--) { const i = Y * w + X; if (d[i]) d[i] = Math.min(d[i]!, d[i + 1]! + 1, d[i + w]! + 1, d[i + w + 1]! + 1.41, d[i + w - 1]! + 1.41); }
  for (let i = 0; i < N; i++) d[i] = d[i]! * mm; return d; }
