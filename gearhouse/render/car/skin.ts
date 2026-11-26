// The surface adapter `Skin` (docs/systems/115 §5-2): what a part placed freely on a body asks of the body's skin, the
// same for any closed shell. A ray is shot at the skin (a finger or the mouse on the picture, or a part's own probe), and
// the skin answers with the point, its smooth normal, the face's tag (its panel, region, material and socket: the
// rules read them) and the point's surface coordinates. The coordinates are the ones that survive the lump's
// dimensions: the shell is a control cage subdivided once (render/car/p959/subdiv.ts), each cage face of four corners
// made into four fine quads, so a place is a cage face and a point (u, v) in its square. The cage's faces are the same
// faces whatever its dimensions (render/car/p959/frame.ts only moves its points), so the coordinates are evaluated
// again on the shell made again from the stretched cage and the part lands on the same place of the new surface.
// Also here: the frame of a flat part on the skin (its normal, its across and its up, turned and tilted), the skin's
// heights under a part's footprint (what a bracket fills), a footprint's overlap with another, and the ray under a
// pixel of the builder's picture (the live renderer's orthographic camera, render/live/renderer.ts, the car placed as
// render/live/gpu.ts placeMesh places it).
import type { V } from './mesh';
import type { SurfaceAt } from '../../core/placed';
export type { SurfaceAt };

/** what the rules read of a face */
export interface SkinTag { panel: string; region?: string; mat?: string; socket?: string; was?: string }
/** a point on the skin: where, its smooth normal (out of the body), the fine face it is on and that face's tag, and its
 *  surface coordinates (null on a face that is not one of the subdivision's: an arch's lip, a wheel well, the floor) */
export interface SkinPoint { p: V; n: V; face: number; tag: SkinTag; at: SurfaceAt | null }
export interface Skin {
  /** the first face a ray meets (origin, direction, both in the body's axes, mm), and how far along it (in lengths of `d`) */
  hit(o: V, d: V, maxT?: number): (SkinPoint & { t: number }) | null;
  /** a place given by its surface coordinates on this skin (null: no such face here) */
  at(a: SurfaceAt): SkinPoint | null;
  /** the skin's bounds (its own axes, mm): where the parts' default places are aimed from */ box?: [V, V] }
/** a shell made by one subdivision of a cage: its points and faces, the shading normals per face corner, each face's tag,
 *  how many of the faces came from the subdivision (the first `nSub`), and the cage face each of those came from */
export interface SubdivShell { P: V[]; F: number[][]; N: V[][]; tag: SkinTag[]; nSub: number; parent: number[] }

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const madd = (a: V, b: V, k: number): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export { sub as vsub, dot as vdot, cross as vcross, unit as vunit, madd as vmadd };
/** a cage square's corners (u, v): the face's first corner, its second, third and fourth */
const C: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
/** a ray along a seam (the centre line, where the two halves' triangles meet) must not slip between them */
const EPS = 1e-7;
const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** the skin of a once-subdivided shell. A fine quad q of a cage face runs (its corners in order) from the cage face's
 *  corner q to the middle of the edge after it, the face's middle and the middle of the edge before it (subdiv.ts), so
 *  in the cage face's square it is the quarter at corner q, and the map between the two is affine */
export function subdivSkin(S: SubdivShell, accel = true): Skin {
  // each cage face's fine quads (consecutive, in corner order); a cage face of other than four corners has no coordinates
  const first = new Map<number, number>(), count = new Map<number, number>();
  for (let k = 0; k < S.nSub; k++) { const c = S.parent[k]!; if (!first.has(c)) first.set(c, k); count.set(c, (count.get(c) ?? 0) + 1); }
  /** the quarter's corners in the cage square: A at its local (0, 0), B at (1, 0), D at (0, 1) */
  const quarter = (q: number) => ({ A: C[q]!, B: mid(C[q]!, C[(q + 1) % 4]!), D: mid(C[(q + 3) % 4]!, C[q]!) });
  // the triangles for the rays: a fan of each face, each corner's local (s, t) on a quad (a triangle or a longer face: none)
  const T: { k: number; a: V; e1: V; e2: V; ci: [number, number, number]; st: [number, number][] | null }[] = [], LOC: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  S.F.forEach((f, k) => { for (let i = 1; i + 1 < f.length; i++) { const a = S.P[f[0]!]!, b = S.P[f[i]!]!, c = S.P[f[i + 1]!]!;
    T.push({ k, a, e1: sub(b, a), e2: sub(c, a), ci: [0, i, i + 1], st: f.length === 4 ? [LOC[0]!, LOC[i]!, LOC[i + 1]!] : null }); } });
  const atOf = (k: number, st: [number, number]): SurfaceAt | null => { if (k >= S.nSub) return null; const c = S.parent[k]!; if (count.get(c) !== 4) return null;
    const { A, B, D } = quarter(k - first.get(c)!), u = A[0] + st[0] * (B[0] - A[0]) + st[1] * (D[0] - A[0]), v = A[1] + st[0] * (B[1] - A[1]) + st[1] * (D[1] - A[1]); return { f: c, u, v }; };
  /** the point at a fine quad's local (s, t): bilinear in its corners, the normal bilinear in its shading normals */
  const onQuad = (k: number, s: number, t: number): { p: V; n: V } => { const f = S.F[k]!, w = [(1 - s) * (1 - t), s * (1 - t), s * t, (1 - s) * t];
    let p: V = [0, 0, 0], n: V = [0, 0, 0]; f.forEach((v, i) => { p = madd(p, S.P[v]!, w[i]!); n = madd(n, S.N[k]?.[i] ?? [0, 0, 1], w[i]!); }); return { p, n: unit(n) }; };
  const nAt = (k: number, bc: [number, number, number], tri: number): V => { const N = S.N[k], tr = T[tri]!; if (!N) return unit(cross(tr.e1, tr.e2));
    let n: V = [0, 0, 0]; for (let j = 0; j < 3; j++) n = madd(n, N[tr.ci[j]!] ?? N[0]!, bc[j]!); return unit(n); };
  const triHit = (i: number, o: V, d: V, bt: number): [number, number, number] | null => { const tr = T[i]!, p = cross(d, tr.e2), det = dot(tr.e1, p); if (Math.abs(det) < 1e-9) return null; const inv = 1 / det, s = sub(o, tr.a), u = dot(s, p) * inv; if (u < -EPS || u > 1 + EPS) return null;
    const q = cross(s, tr.e1), v = dot(d, q) * inv; if (v < -EPS || u + v > 1 + EPS) return null; const t = dot(tr.e2, q) * inv; return t <= 1e-6 || t >= bt ? null : [t, u, v]; };
  const bvh = accel ? buildBvh(T.map(tr => [tr.a, madd(tr.a, tr.e1, 1), madd(tr.a, tr.e2, 1)])) : null;
  return {
    hit(o, d, maxT = Infinity) { let best = -1, bt = maxT, bu = 0, bv = 0;
      const test = (i: number) => { const r = triHit(i, o, d, bt); if (r) { best = i; [bt, bu, bv] = r; } };
      if (bvh) bvh.walk(o, d, () => bt, test); else for (let i = 0; i < T.length; i++) test(i);
      if (best < 0) return null; const tr = T[best]!, bc: [number, number, number] = [1 - bu - bv, bu, bv], p = madd(madd(tr.a, tr.e1, bu), tr.e2, bv);
      const st: [number, number] | null = tr.st ? [bc[0] * tr.st[0]![0] + bc[1] * tr.st[1]![0] + bc[2] * tr.st[2]![0], bc[0] * tr.st[0]![1] + bc[1] * tr.st[1]![1] + bc[2] * tr.st[2]![1]] : null;
      return { p, n: nAt(tr.k, bc, best), face: tr.k, tag: S.tag[tr.k]!, at: st ? atOf(tr.k, st) : null, t: bt }; },
    box: bounds(S.P),
    at(a) { const k0 = first.get(a.f); if (k0 === undefined || count.get(a.f) !== 4) return null; const u = Math.min(1, Math.max(0, a.u)), v = Math.min(1, Math.max(0, a.v));
      const q = u < 0.5 ? (v < 0.5 ? 0 : 3) : (v < 0.5 ? 1 : 2), { A, B, D } = quarter(q), k = k0 + q;
      // (u, v) = A + s (B - A) + t (D - A): the quarter's edges are half a side long, along the square's axes
      const bx = B[0] - A[0], by = B[1] - A[1], dx = D[0] - A[0], dy = D[1] - A[1], det = bx * dy - by * dx, ru = u - A[0], rv = v - A[1];
      const s = Math.min(1, Math.max(0, (ru * dy - rv * dx) / det)), t = Math.min(1, Math.max(0, (bx * rv - by * ru) / det)), { p, n } = onQuad(k, s, t);
      return { p, n, face: k, tag: S.tag[k]!, at: { f: a.f, u, v } }; } }; }

/** a skin's bounds */
const bounds = (P: readonly V[]): [V, V] => { const lo: V = [Infinity, Infinity, Infinity], hi: V = [-Infinity, -Infinity, -Infinity]; for (const p of P) for (let k = 0; k < 3; k++) { if (p[k]! < lo[k]!) lo[k] = p[k]!; if (p[k]! > hi[k]!) hi[k] = p[k]!; } return [lo, hi]; };
/** a bounding volume hierarchy over triangles (docs/systems/115 P1: a ray meets about 7,000 triangles brute force; the
 *  builder's drag and a part's probes shoot hundreds of rays a move). Built once a skin, split at the middle of the
 *  longest side of the centroids' box, four triangles a leaf; a ray walks the boxes it crosses, nearer child first,
 *  skipping a box beyond the nearest hit so far. The answer is the brute force's (tests/skin.test.ts) */
export interface Bvh { walk(o: V, d: V, far: () => number, test: (tri: number) => void): void }
export function buildBvh(tris: readonly [V, V, V][]): Bvh {
  const n = tris.length, idx = new Int32Array(n), cen = new Float64Array(n * 3), lo = new Float64Array(n * 3), hi = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) { idx[i] = i; const t = tris[i]!; for (let k = 0; k < 3; k++) { const a = t[0][k]!, b = t[1][k]!, c = t[2][k]!; lo[i * 3 + k] = Math.min(a, b, c); hi[i * 3 + k] = Math.max(a, b, c); cen[i * 3 + k] = (a + b + c) / 3; } }
  // nodes: box (6), then either a leaf's first index and count (count > 0) or the two children (count 0)
  const box: number[] = [], kid: number[] = [], first: number[] = [], count: number[] = [];
  const make = (s: number, e: number): number => { const id = count.length; count.push(0); first.push(0); kid.push(0, 0); const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], cb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let j = s; j < e; j++) { const i = idx[j]!; for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k]!, lo[i * 3 + k]!); b[k + 3] = Math.max(b[k + 3]!, hi[i * 3 + k]!); cb[k] = Math.min(cb[k]!, cen[i * 3 + k]!); cb[k + 3] = Math.max(cb[k + 3]!, cen[i * 3 + k]!); } }
    box.push(...b); const ax = [0, 1, 2].reduce((a, k) => cb[k + 3]! - cb[k]! > cb[a + 3]! - cb[a]! ? k : a, 0), mid = (cb[ax]! + cb[ax + 3]!) / 2;
    if (e - s <= 4 || cb[ax + 3]! - cb[ax]! < 1e-6) { first[id] = s; count[id] = e - s; return id; }
    let m = s; for (let j = s; j < e; j++) if (cen[idx[j]! * 3 + ax]! < mid) { const t = idx[j]!; idx[j] = idx[m]!; idx[m] = t; m++; }
    if (m === s || m === e) m = (s + e) >> 1;
    const a = make(s, m), c = make(m, e); kid[id * 2] = a; kid[id * 2 + 1] = c; return id; };
  if (n) make(0, n);
  /** where a ray enters a node's box (Infinity: it misses it) */
  const enter = (nd: number, o: V, inv: V, far: number) => { let t0 = 0, t1 = far; for (let k = 0; k < 3; k++) { let a = (box[nd * 6 + k]! - o[k]!) * inv[k]!, b = (box[nd * 6 + k + 3]! - o[k]!) * inv[k]!; if (a > b) { const t = a; a = b; b = t; }
      if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1 * (1 + 1e-9) + 1e-9) return Infinity; } return t0; };
  return { walk(o, d, far, test) { if (!n) return; const iv = (x: number) => 1 / (Math.abs(x) < 1e-12 ? 1e-12 : x), inv: V = [iv(d[0]), iv(d[1]), iv(d[2])], stack: number[] = [0];
    while (stack.length) { const nd = stack.pop()!; if (enter(nd, o, inv, far()) === Infinity) continue;
      if (count[nd]) { for (let j = first[nd]!; j < first[nd]! + count[nd]!; j++) test(idx[j]!); continue; }
      const a = kid[nd * 2]!, c = kid[nd * 2 + 1]!, ta = enter(a, o, inv, far()), tc = enter(c, o, inv, far());
      // the nearer child walked first (pushed last)
      if (ta <= tc) { if (tc !== Infinity) stack.push(c); if (ta !== Infinity) stack.push(a); } else { if (ta !== Infinity) stack.push(a); if (tc !== Infinity) stack.push(c); } } } }; }

/** a flat skin (a plane through `o` facing `n`, a square of `half` mm round it): the parts' library pictures stand a part
 *  on it alone (ui/builder_thumbs.ts); no surface coordinates */
export function planeSkin(o: V, n0: V, half = 3000): Skin { const n = unit(n0), tag: SkinTag = { panel: 'flat', mat: 'paint' };
  return { hit(r, d, maxT = Infinity) { const den = dot(d, n); if (Math.abs(den) < 1e-9) return null; const t = dot(sub(o, r), n) / den; if (t <= 1e-6 || t >= maxT) return null;
      const p = madd(r, d, t), q = sub(p, o); if (Math.abs(q[0]) > half || Math.abs(q[1]) > half || Math.abs(q[2]) > half) return null; return { p, n, face: 0, tag, at: null, t }; },
    at: () => null, box: [madd(o, [1, 1, 1], -half), madd(o, [1, 1, 1], half)] }; }

/** a flat part's frame on the skin: its centre, its normal (out of the face), its across (the reader's right as the game
 *  draws the car: the files' +y on the left of the heading, so across = normal x up) and its up (the world's up laid in
 *  the face's plane; along the car where the face looks straight up), turned `rot` degrees about the normal (+: its
 *  right side up) and leant `tilt` degrees back about its across (+: its top away from the viewer) */
export interface PartFrame { o: V; n: V; u: V; up: V }
export function partFrame(o: V, n0: V, rot = 0, tilt = 0): PartFrame { const z: V = [0, 0, 1], n = unit(n0);
  let up = sub(z, [n[0] * n[2], n[1] * n[2], n[2] * n[2]]); if (Math.hypot(...up) < 0.15) up = sub([-1, 0, 0], madd([0, 0, 0], n, -n[0])); up = unit(up);
  let u = cross(n, up); const r = rot * Math.PI / 180, cr = Math.cos(r), sr = Math.sin(r); const u1 = unit(madd([u[0] * cr, u[1] * cr, u[2] * cr], up, sr)), up1 = unit(madd([up[0] * cr, up[1] * cr, up[2] * cr], u, -sr)); u = u1;
  const t = tilt * Math.PI / 180, ct = Math.cos(t), st = Math.sin(t), up2 = unit(madd([up1[0] * ct, up1[1] * ct, up1[2] * ct], n, -st)), n2 = unit(madd([n[0] * ct, n[1] * ct, n[2] * ct], up1, st));
  return { o, n: n2, u, up: up2 }; }
/** a point of a frame's plane: `x` across, `y` up, `h` out along its normal */
export const framePt = (F: PartFrame, x: number, y: number, h = 0): V => madd(madd(madd(F.o, F.u, x), F.up, y), F.n, h);
/** the skin under points of a frame's plane: each probed by a ray from `reach` out along the normal straight back in; the
 *  skin's height there over the plane (+: the skin stands out of it) and the face met; null where the ray finds no skin
 *  within twice the reach (the point hangs off the body) */
export function probe(skin: Skin, F: PartFrame, pts: readonly [number, number][], reach = 300): ({ h: number; tag: SkinTag; at: SurfaceAt | null } | null)[] {
  const back: V = [-F.n[0], -F.n[1], -F.n[2]];
  return pts.map(([x, y]) => { const r = skin.hit(framePt(F, x, y, reach), back, reach * 2); return r ? { h: reach - r.t, tag: r.tag, at: r.at } : null; }); }
/** a rectangle's outline and inside as probe points: corners and every `step` mm along its sides, and a grid inside */
export function rectPoints(hw: number, hh: number, step = 60): { rim: [number, number][]; inside: [number, number][] } {
  const nx = Math.max(1, Math.ceil(2 * hw / step)), ny = Math.max(1, Math.ceil(2 * hh / step)), rim: [number, number][] = [];
  for (let i = 0; i < nx; i++) rim.push([-hw + 2 * hw * i / nx, -hh]); for (let j = 0; j < ny; j++) rim.push([hw, -hh + 2 * hh * j / ny]);
  for (let i = nx; i > 0; i--) rim.push([-hw + 2 * hw * i / nx, hh]); for (let j = ny; j > 0; j--) rim.push([-hw, -hh + 2 * hh * j / ny]);
  const inside: [number, number][] = []; for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) inside.push([-hw + 2 * hw * i / nx, -hh + 2 * hh * j / ny]);
  return { rim, inside }; }
/** two flat parts' footprints (a frame and its half sizes each) meeting: a point of either's outline or middle inside the
 *  other's rectangle, near its plane (within `depth` mm) */
export function footprintsMeet(a: { F: PartFrame; hw: number; hh: number }, b: { F: PartFrame; hw: number; hh: number }, depth = 80): boolean {
  const inside = (P: typeof a, p: V) => { const d = sub(p, P.F.o); return Math.abs(dot(d, P.F.u)) <= P.hw && Math.abs(dot(d, P.F.up)) <= P.hh && Math.abs(dot(d, P.F.n)) <= depth; };
  const pts = (P: typeof a) => [...rectPoints(P.hw, P.hh, 40).rim, [0, 0] as [number, number]].map(([x, y]) => framePt(P.F, x, y));
  return pts(b).some(p => inside(a, p)) || pts(a).some(p => inside(b, p)); }

/** the ray under a pixel of a picture drawn by the live renderer's orthographic camera (its LiveView: the target, the
 *  heading up the screen, the tilt, mm a pixel, the picture's size and the target's height on it), in the axes of a car
 *  placed at (x, y, z) facing `yaw` (render/live/gpu.ts placeMesh: its middle on that point, nose toward the heading, its
 *  +y on the left, mm). `px`, `py`: device pixels from the picture's top left. The origin is far in front of the car */
export function viewRay(v: { x: number; y: number; z: number; ang: number; pitch: number; mm: number; W: number; H: number; cy: number }, car: { x: number; y: number; z: number; yaw: number; len: number }, px: number, py: number): { o: V; d: V } {
  const a = v.ang - Math.PI / 2, cA = Math.cos(a), sA = Math.sin(a), SP = Math.sin(v.pitch * Math.PI / 180), CP = Math.cos(v.pitch * Math.PI / 180), k = 1000 / v.mm;
  const rx: V = [cA, sA, 0], ry: V = [-sA, cA, 0], up: V = [ry[0] * SP, ry[1] * SP, CP], vd: V = [ry[0] * CP, ry[1] * CP, -SP], c: V = [v.x, v.y, v.z];
  const sx = dot(c, rx) + (px - v.W / 2) / k, sy = dot(c, up) + (v.H * v.cy - py) / k, w0 = madd(madd(madd([0, 0, 0], rx, sx), up, sy), vd, -60);
  // the world to the car's axes: the placing matrix's turn is its own inverse ([-c -s; -s c], a reflection), then mm
  const ch = Math.cos(car.yaw), sh = Math.sin(car.yaw), T: V = [car.x + ch * car.len / 2000, car.y + sh * car.len / 2000, car.z];
  const toCar = (w: V, pt: boolean): V => { const d = pt ? sub(w, T) : w; return [(-ch * d[0] - sh * d[1]) * (pt ? 1000 : 1), (-sh * d[0] + ch * d[1]) * (pt ? 1000 : 1), d[2] * (pt ? 1000 : 1)]; };
  return { o: toCar(w0, true), d: unit(toCar(vd, false)) }; }
