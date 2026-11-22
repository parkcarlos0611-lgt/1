// A car as a low-polygon mesh (review 80): the trial of modelling cars in true 3D, in the flat-shaded, outlined manner
// of low-poly drift games, drawn small and shown in whole pixels. The shapes come from stations along the car (a
// cross-section every so often, lofted into a skin), swept sections for wings, turned profiles for lamps and wheels,
// and bars and boxes for the fittings: numbers read off the sheet's views and the real car's sizes, not pixels.
// Units mm; x from the nose back, y from the centre line to the car's left, z up.
export type V = [number, number, number];
export interface Mesh { n: number; pos: Float32Array; col: Uint8Array; gloss: Float32Array; part: Int16Array; length: number }
const hex = (h: string): V => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = (a: V) => Math.hypot(a[0], a[1], a[2]), norm = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** the builder: every shape adds triangles in the colour, gloss and part number set at the time */
export class Build {
  private P: number[] = []; private C: number[] = []; private G: number[] = []; private T: number[] = [];
  private c: V = [128, 128, 128]; private g = 0.2; private part = 0;
  /** the colour and gloss (0 flat .. 1 bright metal) of what follows; each call starts a new part (parts are outlined against each other) */
  mat(colour: string, gloss = 0.2): this { this.c = hex(colour); this.g = gloss; this.part++; return this; }
  tri(a: V, b: V, c: V): this { this.P.push(...a, ...b, ...c); this.C.push(...this.c); this.G.push(this.g); this.T.push(this.part); return this; }
  quad(a: V, b: V, c: V, d: V): this { return this.tri(a, b, c).tri(a, c, d); }
  /** rings of the same number of points joined into a skin; the ends closed */
  loft(rings: V[][], caps = true): this {
    for (let r = 0; r + 1 < rings.length; r++) { const A = rings[r]!, B = rings[r + 1]!, K = A.length; for (let i = 0; i < K; i++) this.quad(A[i]!, A[(i + 1) % K]!, B[(i + 1) % K]!, B[i]!); }
    if (caps) for (const R of [rings[0]!, rings[rings.length - 1]!]) { const m = mul(R.reduce((s, p) => add(s, p), [0, 0, 0] as V), 1 / R.length); for (let i = 0; i < R.length; i++) this.tri(m, R[i]!, R[(i + 1) % R.length]!); }
    return this; }
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): this {
    const r = (x: number): V[] => [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]; return this.loft([r(x0), r(x1)]); }
  /** a bar of square section from a to b (pipes, frames, straps, spokes) */
  bar(a: V, b: V, t: number, t2 = t): this { const d = norm(sub(b, a)), up: V = Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], u = mul(norm(cross(d, up)), t / 2), v = mul(norm(cross(d, u)), t2 / 2);
    const r = (p: V): V[] => [add(add(p, u), v), add(sub(p, u), v), sub(sub(p, u), v), sub(add(p, u), v)]; return this.loft([r(a), r(b)]); }
  /** a profile turned about an axis through `o` along x or y: [distance along the axis, radius] pairs */
  lathe(axis: 'x' | 'y', o: V, prof: [number, number][], seg = 16, caps = true): this {
    const ring = ([a, r]: [number, number]): V[] => Array.from({ length: seg }, (_, i) => { const t = i / seg * Math.PI * 2, c = Math.cos(t) * r, s = Math.sin(t) * r; return (axis === 'x' ? [o[0] + a, o[1] + c, o[2] + s] : [o[0] + c, o[1] + a, o[2] + s]) as V; });
    return this.loft(prof.map(ring), caps); }
  mesh(length: number): Mesh { return { n: this.G.length, pos: new Float32Array(this.P), col: new Uint8Array(this.C), gloss: new Float32Array(this.G), part: new Int16Array(this.T), length }; }
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
export function drawMesh(M0: Mesh, yaw: number, pitch: number, mm: number, w: number, h: number, o: { outline?: number; shadow?: boolean; cy?: number } = {}): Pic {
  const M = asDrawn(M0);
  const th = yaw * Math.PI / 180, ph = pitch * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th), sp = Math.sin(ph), cp = Math.cos(ph), N = w * h, cx = M.length / 2, cy = h * (o.cy ?? 0.62);
  const zb = new Float32Array(N).fill(-1e9), tri = new Int32Array(N).fill(-1), rgba = new Uint8ClampedArray(N * 4);
  const sun: V = [SUN[0] * ct + SUN[1] * st, -SUN[0] * st + SUN[1] * ct, SUN[2]], cam: V = [-cp * st, -cp * ct, sp];
  const prj = (x: number, y: number, z: number): V => { const xr = (x - cx) * ct - y * st, yr = (x - cx) * st + y * ct; return [w / 2 + xr / mm, cy + (-yr * sp - z * cp) / mm, -yr * cp + z * sp]; };
  const fill = (a: V, b: V, c: V, f: (i: number, d: number) => void) => { const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0]))), y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-9) return;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const px = X + 0.5, py = Y + 0.5, l0 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den, l1 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den, l2 = 1 - l0 - l1;
      if (l0 < 0 || l1 < 0 || l2 < 0) continue; f(Y * w + X, l0 * a[2] + l1 * b[2] + l2 * c[2]); } };
  const shadow = new Uint8Array(N);
  for (let t = 0; t < M.n; t++) { const p = M.pos, q = t * 9, A = prj(p[q]!, p[q + 1]!, p[q + 2]!), B = prj(p[q + 3]!, p[q + 4]!, p[q + 5]!), C = prj(p[q + 6]!, p[q + 7]!, p[q + 8]!);
    fill(A, B, C, (i, d) => { if (d > zb[i]!) { zb[i] = d; tri[i] = t; } });
    if (o.shadow !== false && pitch > 5) { const g = (k: number): V => { const z = p[q + k + 2]!; return prj(p[q + k]! - sun[0] / sun[2] * z, p[q + k + 1]! - sun[1] / sun[2] * z, 0); }; fill(g(0), g(3), g(6), i => { shadow[i] = 1; }); } }
  for (let i = 0; i < N; i++) { const t = tri[i]!; if (t < 0) { if (shadow[i]) { rgba[i * 4] = 24; rgba[i * 4 + 1] = 22; rgba[i * 4 + 2] = 20; rgba[i * 4 + 3] = 110; } continue; }
    const p = M.pos, q = t * 9, a: V = [p[q]!, p[q + 1]!, p[q + 2]!], b: V = [p[q + 3]!, p[q + 4]!, p[q + 5]!], c: V = [p[q + 6]!, p[q + 7]!, p[q + 8]!]; let n = norm(cross(sub(b, a), sub(c, a)));
    if (n[0] * cam[0] + n[1] * cam[1] + n[2] * cam[2] < 0) n = mul(n, -1);                 // the face seen is the one turned to the camera
    const d = Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]), g = M.gloss[t]!; let k = Math.round((0.5 + 0.62 * d) * 5) / 5, s = 0;
    if (g > 0.7) { k = n[2] > 0.5 ? 1.15 : n[2] > 0.1 ? 0.92 : n[2] > -0.2 ? 0.55 : 0.8; if (d > 0.88) s = 60; } else if (g > 0.3 && d > 0.95) s = 45;
    rgba[i * 4] = Math.min(255, M.col[t * 3]! * k + s); rgba[i * 4 + 1] = Math.min(255, M.col[t * 3 + 1]! * k + s); rgba[i * 4 + 2] = Math.min(255, M.col[t * 3 + 2]! * k + s); rgba[i * 4 + 3] = 255; }
  // lines: thin and dark where two parts meet or one surface stands well before another; thick and black round the car
  const ol = o.outline ?? 2; if (ol > 0) { const e = new Uint8Array(N);
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) { const i = Y * w + X, t = tri[i]!; if (t < 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const XX = X + dx, YY = Y + dy, j = YY * w + XX; if (XX < 0 || YY < 0 || XX >= w || YY >= h || tri[j]! < 0) { e[i] = 2; break; }
        if (zb[j]! - zb[i]! > 60 || (M.part[tri[j]!] !== M.part[t] && zb[j]! - zb[i]! > 4)) e[i] = Math.max(e[i]!, 1); } }
    for (let pass = 2; pass <= ol; pass++) { const e2 = new Uint8Array(e); for (let Y = 1; Y < h - 1; Y++) for (let X = 1; X < w - 1; X++) { const i = Y * w + X; if (e[i] !== 2) continue; for (const j of [i - 1, i + 1, i - w, i + w]) if (tri[j]! >= 0 && !e[j]) e2[j] = 2; } e.set(e2); }
    for (let i = 0; i < N; i++) if (e[i]) { const k = e[i] === 2 ? 0.2 : 0.5; rgba[i * 4] = rgba[i * 4]! * k; rgba[i * 4 + 1] = rgba[i * 4 + 1]! * k; rgba[i * 4 + 2] = rgba[i * 4 + 2]! * k; } }
  return { w, h, rgba }; }
