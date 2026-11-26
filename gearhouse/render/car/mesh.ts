// A car as a low-polygon mesh (review 80): the trial of modelling cars in true 3D, in the flat-shaded, outlined manner
// of low-poly drift games, drawn small and shown in whole pixels. The shapes come from stations along the car (a
// cross-section every so often, lofted into a skin), swept sections for wings, turned profiles for lamps and wheels,
// and bars and boxes for the fittings: numbers read off the sheet's views and the real car's sizes, not pixels.
// Units mm; x from the nose back, y from the centre line to the car's left, z up.
import { NEW, hash, fbm, ss, mix, rustAt, rgb2hsl, hsl2rgb, cells, type Wear } from './wear';
export type V = [number, number, number];
/** what each triangle is made of: it picks the texture and how age shows on it (glass is drawn see-through) */
import type { SuspRig } from './suspension';
import type { EngineRig } from './powertrain/internals';
import { isSuspPart } from './suspension/names';
import type { DialRig } from './interior/gauges';
export const KINDS = ['plain', 'paint', 'metal', 'glass', 'shine', 'tyre', 'wood', 'canvas', 'leather', 'lens', 'grille',
  /* the buildings' photographed materials (review 148), in the order of assets/textures/buildings: the live renderer lays each one's pictures on the faces by their own axes; elsewhere they are plain colour */
  'brick', 'boards', 'timber', 'corrugated', 'tile', 'slate', 'render', 'concrete', 'sheet'] as const;
export type Kind = typeof KINDS[number];
/** `kind` per triangle (KINDS index); `tex` per triangle: 1 or 2 on a tyre's tread, alternate blocks round the wheel */
/** a decal (review 95): a picture laid on the skin, not a part. It is projected along `n` (the way it faces, out of the
 *  surface) onto whatever painted face lies within its reach, round its centre `o` (file frame, mm): a disc of radius
 *  `r` in `col`, and `text` (digits and capitals) in `ink` across it, upright along `up`. The face keeps its own part,
 *  gloss and lighting, so the decal shades, ages and rusts with the panel under it, and has no outline of its own. */
export interface Decal { o: V; n: V; up: V; r: number; col: string; text?: string; ink?: string; /** this decal carries the car's race number (renumber() changes it) */ num?: boolean }
/** the kinds of drawn line (docs/systems/109 §5.2): the seams between panels (door, bonnet, boot lid, bumper split),
 *  the rims round lamps and openings, the creases of the body; `panel`, `trim` and `crease` are what the renderer finds
 *  itself where a mesh brings none (render/car/edges.ts) */
export type LineKind = 'door' | 'bonnet' | 'boot' | 'bumper' | 'lamp' | 'crease' | 'panel' | 'trim' | 'vent' | 'glass';
/** a line drawn on the car in the drift-game style (docs/systems/109 §5.2): a polyline in the mesh's own axes (mm), on
 *  the surface; drawn as a ribbon of even width on the screen, a hair toward the eye, hidden where the car hides it.
 *  `part`: the part it lies on, when that part moves on its own (a suspension part follows its bone); `w`: its width
 *  against the style's line width (default 1) */
export interface MeshLine { kind: LineKind; pts: V[]; closed?: boolean; part?: string; w?: number; /** the cabin's bone it rides on (render/car/interior: the driver's helmet) */ bone?: number }
/** where a car's speed effects start (render/live/trails.ts), in the mesh's axes (mm): the rear wing's two tips (or the
 *  tail's top corners), the two tail lamps; left first */
export interface CarAnchors { tips: [V, V]; lamps: [V, V] }
export interface Mesh { /** the speed effects' anchors (a hand-made body's own; a kit car's are found from its bounds) */ anchors?: CarAnchors; /** lines drawn on the machinery's parts (the powertrain's, the suspension's: docs/systems/109 section 10), drawn as well as the body's own or found lines */ partLines?: MeshLine[]; /** the drawn lines (docs/systems/109 §5.2); without them the renderer finds lines at the hard edges */ lines?: MeshLine[]; /** edges marked as creases (each its two ends, mm): the shading's normals are split along them, whatever their angle (doc 108 S7) */ creases?: [V, V][]; /** picture coordinates on the style's atlas, three numbers a corner (u, v, the atlas cell + 1; 0 none), nine a triangle (render/live/style.ts ATLAS_CELLS) */ uv?: Float32Array; decals?: Decal[]; n: number; pos: Float32Array; col: Uint8Array; gloss: Float32Array; part: Int16Array; kind: Uint8Array; tex: Uint8Array; length: number; /** the suspension's rig, when the mesh has one that moves (render/car/suspension) */ susp?: SuspRig; /** an engine's insides that move (the workshop's cutaway, render/car/powertrain/internals.ts): each triangle's bone (0: still) and the rig that poses them */ bone?: Uint8Array; inner?: EngineRig; /** a cabin's needles (render/car/interior): each triangle's bone (0: still) and the rig that poses them from the drive's state */ dial?: Uint8Array; dials?: DialRig; /** each part number's name (the parts' common names, as the 2D part models had: body, hood, fenderF, lamp, ...) */ names?: string[] }
const hex = (h: string): V => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = (a: V) => Math.hypot(a[0], a[1], a[2]), norm = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** the builder: every shape adds triangles in the colour, gloss and part number set at the time */
export class Build {
  private P: number[] = []; private C: number[] = []; private G: number[] = []; private T: number[] = []; private K: number[] = []; private X: number[] = [];
  private c: V = [128, 128, 128]; private g = 0.2; private part = 0; private k = 0; private x = 0; private nm = ''; private N: string[] = [];
  /** the name of the part what follows belongs to (stays until named again) */
  name(n: string): this { this.nm = n; return this; }
  /** the colour and gloss (0 flat .. 1 bright metal) of what follows; each call starts a new part (parts are outlined against each other) */
  mat(colour: string, gloss = 0.2, kind: Kind = 'plain'): this { this.c = hex(colour); this.g = gloss; this.k = KINDS.indexOf(kind); this.part++; this.N[this.part] = this.nm; return this; }
  tri(a: V, b: V, c: V): this { this.P.push(...a, ...b, ...c); this.C.push(...this.c); this.G.push(this.g); this.T.push(this.part); this.K.push(this.k); this.X.push(this.x); return this; }
  quad(a: V, b: V, c: V, d: V): this { return this.tri(a, b, c).tri(a, c, d); }
  /** picture coordinates for the triangle just added (Mesh.uv: u, v, the atlas cell + 1 for each of its corners, in their order) */
  art(uv: readonly number[]): this { this.U.set(this.G.length - 1, uv); return this; }
  private U = new Map<number, readonly number[]>();
  /** where the geometry has got to: pass it to tilt() to turn what is built after it */
  mark(): number { return this.P.length; }
  /** turn everything built since the mark about a line along y through o (degrees, +: the top goes forward, to -x) */
  tilt(from: number, o: V, deg: number): this { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    for (let i = from; i < this.P.length; i += 3) { const dx = this.P[i]! - o[0], dz = this.P[i + 2]! - o[2]; this.P[i] = o[0] + dx * c - dz * s; this.P[i + 2] = o[2] + dx * s + dz * c; } return this; }
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
  private D: Decal[] = []; private LN: MeshLine[] = [];
  /** a line drawn on a part of the machinery (Mesh.partLines) */
  line(l: MeshLine): this { this.LN.push(l); return this; }
  /** lay a decal on the paint (see Decal) */
  decal(d: Decal): this { this.D.push(d); return this; }
  mesh(length: number): Mesh { const uv = this.U.size ? new Float32Array(this.G.length * 9) : null; if (uv) for (const [t, q] of this.U) uv.set(q, t * 9);
    return { ...(this.LN.length ? { partLines: this.LN.slice() } : {}), ...(uv ? { uv } : {}), decals: this.D.slice(), n: this.G.length, pos: new Float32Array(this.P), col: new Uint8Array(this.C), gloss: new Float32Array(this.G), part: new Int16Array(this.T), kind: new Uint8Array(this.K), tex: new Uint8Array(this.X), length, names: this.N.slice() }; }
}
/** a body section at x: a closed ring, half-width w about y = 0, from zb up to zt; `top` and `bot` are how square the
 *  upper and lower halves are (2 a circle's roundness, 6 nearly a box); `k` points round */
export function section(x: number, w: number, zb: number, zt: number, top = 3, bot = 6, k = 20): V[] {
  const zc = (zb + zt) / 2, h = (zt - zb) / 2, out: V[] = [];
  for (let i = 0; i < k; i++) { const t = (i + 0.5) / k * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), n = s >= 0 ? top : bot; out.push([x, w * Math.sign(c) * Math.abs(c) ** (2 / n), zc + h * Math.sign(s) * Math.abs(s) ** (2 / n)]); }
  return out; }
/** a wing: a crowned strip swept along a path seen from the side. Each point [x, z, yIn, yOut] is the top of the wing
 *  there and how far across it reaches; `hub` the wheel's centre [x, z] it stands over; `t` its thickness, `crown` how much its middle stands above its edges */
export function wing(b: Build, path: [number, number, number, number][], hub: [number, number], t = 45, crown = 35, round = false): void {
  const rings: V[][] = path.map((p, i) => { const a = path[Math.max(0, i - 1)]!, c = path[Math.min(path.length - 1, i + 1)]!, tx = c[0] - a[0], tz = c[1] - a[1], l = Math.hypot(tx, tz) || 1; let nx = -tz / l, nz = tx / l; if (nx * (p[0] - hub[0]) + nz * (p[1] - hub[1]) < 0) { nx = -nx; nz = -nz; }   // outward: away from the wheel it covers
    const [x, z, yi, yo] = p, ym = (yi + yo) / 2, at = (y: number, k: number): V => [x + nx * k, y, z + nz * k];
    if (round) { const ring: V[] = [at(yi, -t)]; for (let k = 0; k <= 8; k++) { const u = k / 8, y = yi + (yo - yi) * u, c = Math.sin(Math.PI * (0.08 + 0.84 * u)); ring.push(at(y, crown * c - crown * 0.35 * u * u)); } ring.push(at(yo, -t - crown * 0.5)); return ring; }   // round: a full crown across, falling to the outer edge
    return [at(yi, -t), at(yi, -crown * 0.4), at(ym, crown * 0.6), at(yo, -crown * 0.6), at(yo, -t - crown * 0.6)]; });
  b.loft(rings); }

/** glints: pixels where the light catches hardest (a highlight's peak, metal mirroring the bright horizon), for sparkles laid on at run time */
export interface Pic { w: number; h: number; rgba: Uint8ClampedArray; glints?: number[]; /** the triangle each pixel shows (-1 none, glass not counted) */ tri?: Int32Array }
const SUN: V = norm([-0.45, 0.35, 0.82]);
/** The mesh drawn from heading `yaw` (0 = nose to the right) with the camera `pitch` degrees above the ground (0 = from
 *  the side), `mm` millimetres a pixel: flat tones in a few steps, a dark line round the car and between its parts,
 *  its shadow on the ground. `spin` turns the wheels' parts (see `wheels` in the car's own file). */
/** The car files keep the sheets' sides (+y = the car's right, as the part models have it); the projection below sees
 *  -y from a nose-left heading, so it draws the mirror image. Mirror once here so a car's left shows nose-left, as in 2D. */
const mirrored = new WeakMap<Mesh, Mesh>();
function asDrawn(M: Mesh): Mesh { let m = mirrored.get(M); if (!m) { const pos = Float32Array.from(M.pos); for (let i = 1; i < pos.length; i += 3) pos[i] = -pos[i]!; m = { ...M, pos }; mirrored.set(M, m); } return m; }
// ---- light (review 90): a warm sun, the sky's blue from above and the ground's warmth from below on every face; bright
//      metal and glass mirror a simple world (blue sky, a pale horizon, dark ground) by the way the eye's ray bounces off
//      them, stronger at a glancing angle on glass; glossy paint takes a highlight sized by its gloss and a touch of sky.
//      Steps kept coarse so the picture stays in the flat, few-toned manner ----
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const SUN_C: V = [1.0, 0.95, 0.84], SKY_C: V = [0.6, 0.68, 0.82], GROUND_C: V = [0.5, 0.45, 0.36];
const ENV_TOP: V = [150, 176, 214], ENV_HOR: V = [236, 233, 224], ENV_GROUND: V = [92, 88, 68];
/** what a mirror shows along the direction r (unit, z up) */
export function envAt(rz: number): V { if (rz < -0.06) return ENV_GROUND; if (rz < 0.22) return ENV_HOR; const t = Math.min(1, (rz - 0.22) / 0.6); return [ENV_HOR[0] + (ENV_TOP[0] - ENV_HOR[0]) * t, ENV_HOR[1] + (ENV_TOP[1] - ENV_HOR[1]) * t, ENV_HOR[2] + (ENV_TOP[2] - ENV_HOR[2]) * t]; }
/** a face's colour under the light: base colour, its normal (toward the eye), the sun and the eye in the same axes, its gloss */
function lit(base: V, n: V, sun: V, eye: V, g: number, dither = -1): { c: V; spec: number } {
  const d = Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]), dq = dither < 0 ? Math.round(d * 4) / 4 : Math.min(1, Math.floor(d * 6 + dither) / 6), up = 0.5 + 0.5 * n[2];   // smooth: finer steps, dithered between
  const diff: V = [0, 1, 2].map(i => SUN_C[i]! * dq * 0.78 + (SKY_C[i]! * up + GROUND_C[i]! * (1 - up)) * 0.6) as V;
  const ne = n[0] * eye[0] + n[1] * eye[1] + n[2] * eye[2], rz = 2 * ne * n[2] - eye[2];   // the eye's ray, bounced: its height decides what it sees
  if (g > 0.7) { const env = envAt(rz), tint = 0.55 + 0.45 * Math.max(base[0], base[1], base[2]) / 255;   // metal: the world, tinted a little by the metal's own colour
    return { c: [0, 1, 2].map(i => Math.min(255, env[i]! * 0.82 * (base[i]! / 255 * 0.5 + 0.5) * tint + base[i]! * diff[i]! * 0.15)) as V, spec: 0 }; }
  const h: V = [sun[0] + eye[0], sun[1] + eye[1], sun[2] + eye[2]], hl = Math.hypot(...h) || 1, nh = Math.max(0, (n[0] * h[0] + n[1] * h[1] + n[2] * h[2]) / hl);
  const sp = g > 0.2 ? nh ** (6 + g * 110) : 0, spec = sp > 0.65 ? 1 : sp > 0.3 ? 0.5 : 0;   // the highlight in two steps
  const env = envAt(rz), refl = g > 0.3 ? 0.1 * g * (0.4 + 0.6 * up) : 0;
  return { c: [0, 1, 2].map(i => Math.min(255, base[i]! * diff[i]! * (1 - refl) + env[i]! * refl)) as V, spec: spec * (40 + 80 * g) }; }
export interface DrawOpts { outline?: number; shadow?: boolean; cy?: number; /** the car tilted on its ground point: roll (rad, its left side up +), pitch (rad, nose up +) */ roll?: number; pitch?: number; /** front wheels turned (rad, to the car's left +), every wheel turned on its axle (rad) */ steer?: number; spin?: number; /** studio light: the key light from beside the camera and above (straight views for the builder), not the track's sun */ studio?: boolean; /** smooth shading: normals blended across a part's gently meeting faces and the light stepped with an ordered dither, as the 2D pictures shade a curve (for close views) */ smooth?: boolean; /** how much of what is behind glass it hides, 0..1 */ glass?: number; wear?: Wear }
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
  // a wing's skirt or a valance that dips into the wheel's round is the body's, not the wheel's: it must not turn with it (review 118)
  // review 146: a named part turns with the wheel only if it is a wheel's (tyre, rim, disc, spokes, hub, drum, brake, axle); any
  // other named panel (a quarter, a door, an arch's lip) stays with the body however close it dips. Unnamed parts (the
  // sheet-built cars) keep the old rule.
  const bodyPart = (t: number) => { const n = M.names?.[M.part[t]!] ?? ''; if (isSuspPart(n)) return true;   /* the suspension's parts move by their own bones, the caliper and the disc too */ return n ? !/^(tyre|tire|rim|wheel|spoke|hub|drum|brake|disc|caliper|axle|nut|spinner|knock)/i.test(n) : false; };
  for (let t = 0; t < M.n; t++) for (const w of out) { if (bodyPart(t)) break; let inside = true;
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
// ---- decals ----
/** race numbers as the period painted them (review 96): bold, round-shouldered strokes of even weight, a figure 0.6 as
 *  wide as it is tall, the stroke about a seventh of the height. Each figure is a few strokes (lines and arcs) in a box
 *  0..0.6 across, 0..1 up; a point is ink within half a stroke of one of them, so the shapes stay smooth at any size. */
type Pt = [number, number];
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 20): Pt[] => Array.from({ length: n + 1 }, (_, k) => { const a = (a0 + (a1 - a0) * k / n) * Math.PI / 180; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt; });
const cat = (...ps: Pt[][]): Pt[] => ps.flat();
const FIG: Record<string, Pt[][]> = {
  '0': [arc(0.3, 0.5, 0.215, 0.415, 0, 360, 32)],
  '1': [[[0.12, 0.72], [0.36, 0.925], [0.36, 0.0]]],
  '2': [cat(arc(0.3, 0.7, 0.21, 0.21, 170, -25), [[0.09, 0.088], [0.6, 0.088]])],
  '3': [arc(0.3, 0.725, 0.2, 0.19, 160, -105), arc(0.29, 0.29, 0.225, 0.215, 105, -160)],
  '4': [[[0.43, 0.0], [0.43, 0.925], [0.07, 0.31], [0.6, 0.31]]],
  '5': [cat([[0.58, 0.912], [0.14, 0.912], [0.115, 0.535]], arc(0.3, 0.3, 0.21, 0.21, 125, -160))],
  '6': [arc(0.3, 0.29, 0.215, 0.215, 0, 360, 28), arc(0.46, 0.29, 0.375, 0.635, 180, 95)],
  '7': [[[0.0, 0.912], [0.53, 0.912], [0.23, 0.0]]],
  '8': [arc(0.3, 0.725, 0.185, 0.19, 0, 360, 26), arc(0.3, 0.28, 0.225, 0.205, 0, 360, 28)],
  '9': [arc(0.3, 0.71, 0.215, 0.215, 0, 360, 28), arc(0.14, 0.71, 0.375, 0.635, 0, -85)] };
const STROKE = 0.088;   // half the stroke, in heights: about a sixth of the height, the painters' bold figure
/** ink at (x, y) in a figure's box? */
function inkAt(c: string, x: number, y: number): boolean { const f = FIG[c]; if (!f) return false;
  for (const line of f) for (let k = 0; k + 1 < line.length; k++) { const [ax, ay] = line[k]!, [bx, by] = line[k + 1]!, ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
    const t0 = l2 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0, open = Math.hypot(line[0]![0] - line[line.length - 1]![0], line[0]![1] - line[line.length - 1]![1]) > 1e-6;
    if (open && ((k === 0 && t0 < 0) || (k + 2 === line.length && t0 > 1))) continue;   // a stroke's ends cut square, as a brush or a stencil leaves them
    const t = Math.max(0, Math.min(1, t0)), dx = x - ax - ex * t, dy = y - ay - ey * t; if (dx * dx + dy * dy < STROKE * STROKE) return true; }
  return false; }
type Prepped = Decal & { rt: V; rgb: V; inkRgb: V; chars: string[] };
const hexV = (h: string): V => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function prepDecal(d: Decal): Prepped { const n = norm(d.n), up = norm(d.up); return { ...d, n, up, rt: norm(cross(n, up)), rgb: hexV(d.col), inkRgb: hexV(d.ink ?? '#111111'), chars: [...(d.text ?? '')] }; }
/** a mesh with its race number changed: every decal marked as the number carries `text` */
export function renumber(M: Mesh, text: string): Mesh { return M.decals?.some(d => d.num) ? { ...M, decals: M.decals.map(d => d.num ? { ...d, text } : d) } : M; }
/** the decal's colour at a point of the car as built, on triangle t; null where it does not lie */
function decalAt(d: Prepped, x: number, y: number, z: number, M0: Mesh, t: number): V | null {
  const dx = x - d.o[0], dy = y - d.o[1], dz = z - d.o[2], depth = dx * d.n[0] + dy * d.n[1] + dz * d.n[2]; if (Math.abs(depth) > d.r * 0.8) return null;
  const u = dx * d.rt[0] + dy * d.rt[1] + dz * d.rt[2], v = dx * d.up[0] + dy * d.up[1] + dz * d.up[2]; if (u * u + v * v > d.r * d.r) return null;
  const q = t * 9, P = M0.pos, e1: V = [P[q + 3]! - P[q]!, P[q + 4]! - P[q + 1]!, P[q + 5]! - P[q + 2]!], e2: V = [P[q + 6]! - P[q]!, P[q + 7]! - P[q + 1]!, P[q + 8]! - P[q + 2]!], fn = norm(cross(e1, e2));
  if (Math.abs(fn[0] * d.n[0] + fn[1] * d.n[1] + fn[2] * d.n[2]) < 0.45) return null;   // not round an edge onto a face that turns away
  return inkOn(d.chars, d.r, u, v) ? d.inkRgb : d.rgb; }
/** is (u, v) on the disc (mm from its centre, across and up) in the figures' ink? */
function inkOn(chars: string[], r: number, u: number, v: number): boolean { const n = chars.length; if (!n) return false;
  const H = r * (n === 1 ? 1.2 : n === 2 ? 1.0 : 0.72), gap = 0.1, W = n * 0.6 + (n - 1) * gap, gx = u / H + W / 2, gy = v / H + 0.5;   // the figures across the disc's middle
  if (gy < -STROKE || gy > 1 + STROKE || gx < -STROKE || gx > W + STROKE) return false; const k = Math.max(0, Math.min(n - 1, Math.floor(gx / (0.6 + gap))));
  for (const j of [k - 1, k, k + 1]) if (j >= 0 && j < n && inkAt(chars[j]!, gx - j * (0.6 + gap), gy)) return true; return false; }
/** a decal as a picture (for the live renderer's texture): size x size pixels across its disc, RGBA, clear outside it */
export function decalPicture(d: Decal, size: number): Uint8Array { const out = new Uint8Array(size * size * 4), col = hexV(d.col), ink = hexV(d.ink ?? '#111111'), chars = [...(d.text ?? '')];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { const u = ((i + 0.5) / size * 2 - 1) * d.r, v = ((j + 0.5) / size * 2 - 1) * d.r; if (u * u + v * v > d.r * d.r) continue;
    const c = inkOn(chars, d.r, u, v) ? ink : col, q = (j * size + i) * 4; out[q] = c[0]; out[q + 1] = c[1]; out[q + 2] = c[2]; out[q + 3] = 255; }
  return out; }
/** the mesh turned about its centre's ground point (x = half its length, y = 0, z = 0): roll about the length, then
 *  pitch about the width. In the drawn (mirrored) frame, so roll > 0 lifts the car's left side as seen */
function tilted(M: Mesh, roll: number, pitch: number): Mesh { if (!roll && !pitch) return M; const pos = Float32Array.from(M.pos), cx = M.length / 2, cr = Math.cos(roll), sr = Math.sin(roll), cp = Math.cos(pitch), sp = Math.sin(pitch);
  for (let i = 0; i < pos.length; i += 3) { let x = pos[i]! - cx, y = pos[i + 1]!, z = pos[i + 2]!; const y1 = y * cr + z * sr, z1 = -y * sr + z * cr; y = y1; z = z1; const x2 = x * cp - z * sp, z2 = x * sp + z * cp; pos[i] = x2 + cx; pos[i + 1] = y; pos[i + 2] = z2; }
  return { ...M, pos }; }
export function drawMesh(M0: Mesh, yaw: number, pitch: number, mm: number, w: number, h: number, o: DrawOpts = {}): Pic {
  const M = tilted(asDrawn(posed(M0, o.steer ?? 0, o.spin ?? 0)), o.roll ?? 0, o.pitch ?? 0), W = o.wear ?? NEW, ga = o.glass ?? 0.8;
  const th = yaw * Math.PI / 180, ph = pitch * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th), sp = Math.sin(ph), cp = Math.cos(ph), N = w * h, cx = M.length / 2, cy = h * (o.cy ?? 0.62);
  const zb = new Float32Array(N).fill(-1e9), tri = new Int32Array(N).fill(-1), rgba = new Uint8ClampedArray(N * 4), at = new Float32Array(N * 3);   // at: the point of the car each pixel shows
  const DEC = M0.decals?.length ? M0.decals.map(prepDecal) : null, rest = DEC ? new Float32Array(N * 3) : null;   // rest: that point on the car as built (the file's frame), where decals are laid
  const cam: V = [-cp * st, -cp * ct, sp], sun: V = o.studio ? norm([cam[0] * 0.8 + ct * 0.35, cam[1] * 0.8 - st * 0.35, cam[2] * 0.8 + 0.75]) : [SUN[0] * ct + SUN[1] * st, -SUN[0] * st + SUN[1] * ct, SUN[2]];
  const prj = (x: number, y: number, z: number): V => { const xr = (x - cx) * ct - y * st, yr = (x - cx) * st + y * ct; return [w / 2 + xr / mm, cy + (-yr * sp - z * cp) / mm, -yr * cp + z * sp]; };
  const fill = (a: V, b: V, c: V, f: (i: number, d: number, l0: number, l1: number, l2: number) => void) => { const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0]))), y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-9) return;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const px = X + 0.5, py = Y + 0.5, l0 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den, l1 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den, l2 = 1 - l0 - l1;
      if (l0 < 0 || l1 < 0 || l2 < 0) continue; f(Y * w + X, l0 * a[2] + l1 * b[2] + l2 * c[2], l0, l1, l2); } };
  const p = M.pos, vtx = (t: number, k: number): V => [p[t * 9 + k * 3]!, p[t * 9 + k * 3 + 1]!, p[t * 9 + k * 3 + 2]!];
  const normal = (t: number): V => { const a = vtx(t, 0); let n = norm(cross(sub(vtx(t, 1), a), sub(vtx(t, 2), a))); if (n[0] * cam[0] + n[1] * cam[1] + n[2] * cam[2] < 0) n = mul(n, -1); return n; };
  // ---- smooth shading: a normal at each corner, the faces of its part that meet it gently averaged ----
  const vn = o.smooth ? cornerNormals(M) : null, bary = o.smooth ? new Float32Array(N * 2) : null;
  // ---- pass 1: everything but glass, nearest wins; the shadow on the ground ----
  const shadow = new Uint8Array(N), glassTris: number[] = [];
  for (let t = 0; t < M.n; t++) { const A = prj(...vtx(t, 0)), B = prj(...vtx(t, 1)), C = prj(...vtx(t, 2)), kd = M.kind[t]!;
    if (kd === GLASS || kd === SHINE) glassTris.push(t);
    else fill(A, B, C, (i, d, l0, l1, l2) => { if (d > zb[i]!) { zb[i] = d; tri[i] = t; if (bary) { bary[i * 2] = l0; bary[i * 2 + 1] = l1; } const q = t * 9; at[i * 3] = l0 * p[q]! + l1 * p[q + 3]! + l2 * p[q + 6]!; at[i * 3 + 1] = l0 * p[q + 1]! + l1 * p[q + 4]! + l2 * p[q + 7]!; at[i * 3 + 2] = l0 * p[q + 2]! + l1 * p[q + 5]! + l2 * p[q + 8]!; if (rest) { const r0 = M0.pos; for (let k = 0; k < 3; k++) rest[i * 3 + k] = l0 * r0[q + k]! + l1 * r0[q + 3 + k]! + l2 * r0[q + 6 + k]!; } } });
    if (o.shadow !== false && pitch > 5) { const q = t * 9, g = (k: number): V => { const z = p[q + k + 2]!; return prj(p[q + k]! - sun[0] / sun[2] * z, p[q + k + 1]! - sun[1] / sun[2] * z, 0); }; fill(g(0), g(3), g(6), i => { shadow[i] = 1; }); } }
  // ---- pass 2: flat tones, then each material's texture, then age ----
  let ymax = 1; for (let i = 1; i < p.length; i += 3) ymax = Math.max(ymax, Math.abs(p[i]!));
  const names = M.names ?? [], wheelOfTri: (WheelGroup | undefined)[] = []; for (const wg of wheelsOf(M0)) for (const t of wg.tris) wheelOfTri[t] = { ...wg, hy: -wg.hy };   // the wheels, in the drawn (mirrored) frame
  const grain = new Float32Array(M.n * 3); for (let t = 0; t < M.n; t++) { let best = -1; for (let k = 0; k < 3; k++) { const e = sub(vtx(t, (k + 1) % 3), vtx(t, k)), l = len(e); if (l > best) { best = l; grain.set(norm(e), t * 3); } } }   // wood runs along a part's longest edge
  const glintAt: number[] = [];
  const rusty = new Float32Array(N), isPaint = (i: number) => tri[i]! >= 0 && M.kind[tri[i]!] === PAINT;
  const edgeMM = W.rust ? paintEdges(tri, M, w, h, mm) : null;
  for (let i = 0; i < N; i++) { const t = tri[i]!; if (t < 0) { if (shadow[i]) { rgba[i * 4] = 24; rgba[i * 4 + 1] = 22; rgba[i * 4 + 2] = 20; rgba[i * 4 + 3] = 110; } continue; }
    let n = normal(t); const kd = M.kind[t]!, X = at[i * 3]!, Y = at[i * 3 + 1]!, Z = at[i * 3 + 2]!;
    if (vn && bary) { const l0 = bary[i * 2]!, l1 = bary[i * 2 + 1]!, l2 = 1 - l0 - l1, q = t * 9; let m: V = [vn[q]! * l0 + vn[q + 3]! * l1 + vn[q + 6]! * l2, vn[q + 1]! * l0 + vn[q + 4]! * l1 + vn[q + 7]! * l2, vn[q + 2]! * l0 + vn[q + 5]! * l1 + vn[q + 8]! * l2]; m = norm(m);
      if (m[0] * n[0] + m[1] * n[1] + m[2] * n[2] < 0) m = mul(m, -1); n = m; }
    const d = Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]), g = M.gloss[t]!, k = Math.round((0.5 + 0.62 * d) * 5) / 5;   // k: the old plain tone, for age's flat lacquer and rust
    // the plane a pattern is laid in: the two axes across the face's main direction
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]), [U, V2] = ay >= ax && ay >= az ? [X, Z] : ax >= az ? [Y, Z] : [X, Y];
    let tone = 1, cr = M.col[t * 3]!, cg = M.col[t * 3 + 1]!, cb = M.col[t * 3 + 2]!;
    if (kd === TYRE) { const wg = wheelOfTri[t]; if (wg) { const dx = X - wg.hx, dz = Z - wg.hz, rr = Math.hypot(dx, dz), ang = Math.atan2(dz, dx), side = Math.abs(n[1]) > 0.6;   // a road wheel's tyre
        if (!side) { const blk = ((ang * wg.r / 38) % 1 + 1) % 1; tone = blk < 0.2 ? 0.62 : Math.abs(Y - wg.hy) < 9 ? 0.75 : 1.05; }   // tread: grooves across, one round the middle
        else { const f = rr / wg.r; tone = f > 0.83 && f < 0.865 ? 1.4 : f > 0.73 && f < 0.8 && ((ang * wg.r / 22) % 1 + 1) % 1 < 0.35 && hash(Math.floor(ang * 40), 3) < 0.7 ? 1.25 : 1; } }   // the wall: a rib, and the maker's lettering in a band
      else if (M.tex[t] === 2) tone = 0.72; }
    else if (kd === WOOD) { const gx = grain[t * 3]!, gy = grain[t * 3 + 1]!, gz = grain[t * 3 + 2]!, along = X * gx + Y * gy + Z * gz, across = (X * 0.37 + Y * 0.61 + Z * 0.7) - along * (gx * 0.37 + gy * 0.61 + gz * 0.7);
      const v = fbm(across / 7, along / 160); tone = v > 0.62 ? 0.78 : v < 0.38 ? 1.12 : 1; }       // grain: dark lines and light streaks along the wood
    else if (kd === CANVAS) { const v = fbm(U / 160, V2 / 160); tone = v > 0.66 ? 0.93 : v < 0.34 ? 1.05 : 1;   // the cloth's uneven weathering
      const sm = ((U % 160) + 160) % 160; if (sm < 5) tone *= 0.78; else if (sm < 11 && ((V2 % 14) + 14) % 14 < 6) tone *= 1.12;   // its seams, and the stitching beside them
      if ((((U + V2) % 5) + 5) % 5 < 1) tone *= 0.97; }   // the weave
    else if (kd === METAL && M.gloss[t]! > 0.7) { tone = 0.95 + 0.1 * fbm(U / 300, V2 / 9); }   // chrome's faint polishing streaks
    else if (names[M.part[t]!] === 'core' || names[M.part[t]!] === 'radiatorCore') { const [, gap] = cells(U / 8, V2 / 8); tone = gap < 0.12 ? 2.2 : 0.8; }   // the radiator's honeycomb
    else if (kd === LEATHER) { const v = fbm(U / 45, V2 / 45); tone = v > 0.62 ? 0.86 : v < 0.36 ? 1.1 : 1;   // creased and polished by wear
      const a = (((U + V2) % 110) + 110) % 110, b2 = (((U - V2) % 110) + 110) % 110; if ((a < 4 || b2 < 4)) tone *= 0.86; if (a < 9 && b2 < 9) tone *= 0.6; }   // buttoned, the pleats running between
    if (DEC && kd === PAINT) for (const d of DEC) { const c = decalAt(d, rest![i * 3]!, rest![i * 3 + 1]!, rest![i * 3 + 2]!, M0, t); if (c) { [cr, cg, cb] = c; tone = 1; } }
    if (kd === GRILLE) { const a = ((U + V2) / 26 % 1 + 1) % 1, b = ((U - V2) / 26 % 1 + 1) % 1; if (a < 0.28 || b < 0.28) { cr = 150; cg = 148; cb = 140; } }   // a diamond mesh of bright wire
    const L = lit([cr * tone, cg * tone, cb * tone], n, sun, cam, kd === TYRE || kd === CANVAS || kd === LEATHER ? Math.min(g, 0.25) : g, vn ? BAYER4[((i / w | 0) & 3) * 4 + (i % w & 3)]! : -1);
    let R = Math.min(255, L.c[0] + L.spec), G = Math.min(255, L.c[1] + L.spec * 0.97), B = Math.min(255, L.c[2] + L.spec * 0.9);
    if ((g > 0.7 && R + G + B > 640) || L.spec > 60) glintAt.push(i);   // where a sparkle may flash
    // ---- age: the sun takes the paint's gloss and colour, rust comes up low and at the seams and runs down ----
    if (kd === PAINT && W.fade) { const sky = 0.45 + 0.55 * Math.max(0, n[2]), blot = ss(0.3, 0.7, fbm(U / 150, V2 / 150) * 0.75 + fbm(U / 14, V2 / 260) * 0.25 + (W.fade - 0.5) * 0.8);
      const a = Math.min(1, W.fade * sky * (0.3 + 0.7 * blot) * 1.45);
      if (a > 0) { R = mix(R, L.c[0], a); G = mix(G, L.c[1], a); B = mix(B, L.c[2], a);   // the lacquer goes flat: no highlight, no sheen
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
    // (dents: none here; to come as node-based deformation, brief 74)
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
    const ne = Math.abs(n[0] * cam[0] + n[1] * cam[1] + n[2] * cam[2]), F = 0.06 + 0.94 * (1 - ne) ** 4, env = envAt(2 * ne * n[2] - cam[2]);   // glass mirrors more at a glancing angle
    const k = 0.62 + 0.45 * d + (n[2] > 0.3 ? 0.1 : 0), base: V = shine ? [M.col[t * 3]!, M.col[t * 3 + 1]!, M.col[t * 3 + 2]!] : GLASS_TINT, c: V = [0, 1, 2].map(i => base[i]! * (1 - 0.55 * (0.4 + F)) + env[i]! / k * 0.55 * (0.4 + F)) as V, a = Math.min(1, (shine ? ga + 0.15 : ga) + (1 - ga) * F * 0.7);
    const A = prj(...vtx(t, 0)), B = prj(...vtx(t, 1)), C = prj(...vtx(t, 2));
    fill(A, B, C, (i, dd) => { if (dd <= zb[i]!) return; const q = i * 4, da = rgba[q + 3]! / 255, oa = a + da * (1 - a);
      for (let ch = 0; ch < 3; ch++) rgba[q + ch] = (Math.min(255, c[ch]! * k) * a + rgba[q + ch]! * da * (1 - a)) / oa; rgba[q + 3] = oa * 255; }); }
  if (ol > 0) for (let i = 0; i < N; i++) if (e[i] === 2 && gHit[i]) { rgba[i * 4] = rgba[i * 4]! * 0.2; rgba[i * 4 + 1] = rgba[i * 4 + 1]! * 0.2; rgba[i * 4 + 2] = rgba[i * 4 + 2]! * 0.2; rgba[i * 4 + 3] = 255; }   // the outline over a window's edge
  // a few of the brightest spots, spread over the picture, are kept for sparkles
  const glints: number[] = []; for (let k = 0; k < glintAt.length && glints.length < 24; k += Math.max(1, Math.floor(glintAt.length / 24))) glints.push(glintAt[k]!);
  return { w, h, rgba, glints, tri }; }

/** for each painted pixel, how far (mm) it lies from its part's edge on screen: seams and edges rust first */
function paintEdges(tri: Int32Array, M: Mesh, w: number, h: number, mm: number): Float32Array {
  const N = w * h, d = new Float32Array(N).fill(1e6), paint = (i: number) => tri[i]! >= 0 && M.kind[tri[i]!] === PAINT;
  for (let i = 0; i < N; i++) { if (!paint(i)) continue; const X = i % w, pt = M.part[tri[i]!];
    if (X === 0 || X === w - 1 || i < w || i >= N - w || [i - 1, i + 1, i - w, i + w].some(j => !paint(j) || M.part[tri[j]!] !== pt)) d[i] = 0; }
  for (let Y = 1; Y < h; Y++) for (let X = 1; X < w - 1; X++) { const i = Y * w + X; if (d[i]) d[i] = Math.min(d[i]!, d[i - 1]! + 1, d[i - w]! + 1, d[i - w - 1]! + 1.41, d[i - w + 1]! + 1.41); }
  for (let Y = h - 2; Y >= 0; Y--) for (let X = w - 2; X >= 1; X--) { const i = Y * w + X; if (d[i]) d[i] = Math.min(d[i]!, d[i + 1]! + 1, d[i + w]! + 1, d[i + w + 1]! + 1.41, d[i + w - 1]! + 1.41); }
  for (let i = 0; i < N; i++) d[i] = d[i]! * mm; return d; }

// ---- the 3D model as the game's 2D pictures (review 92, the SSJ pilot): a straight view from a side, the front, the back or
//      above at the builder's scale, in the 2D renderer's picture format (each pixel's material and part, the ground row,
//      the length scale), so the wear marks, the builder and the garage scenes can take it as they take a drawn one ----
import type { CarImage } from './raster';
import type { Material } from './types';
export type MeshView = 'left' | 'right' | 'front' | 'rear' | 'top';
export function meshImage(M: Mesh, view: MeshView, mm: number, o: { outline?: number; wear?: Wear; glass?: number } = {}): CarImage { const t0 = performance.now();
  let Rh = 0, Z = 0; for (let i = 0; i < M.pos.length; i += 3) { Rh = Math.max(Rh, Math.abs(M.pos[i]! - M.length / 2), Math.abs(M.pos[i + 1]!)); Z = Math.max(Z, M.pos[i + 2]!); }
  const pad = 12, top = view === 'top', w = Math.ceil(2 * (view === 'front' || view === 'rear' ? Math.max(...Array.from({ length: M.n * 3 }, (_, k) => Math.abs(M.pos[k * 3 + 1]!))) : M.length / 2 + 120) / mm) + pad * 2;
  const h = Math.ceil((top ? 2 * Rh : Z + 80) / mm) + pad * 2, gy = top ? h / 2 : h - pad;
  const yaw = view === 'left' || view === 'top' ? 0 : view === 'right' ? 180 : view === 'front' ? 90 : 270;
  const p = drawMesh(M, yaw, top ? 89.9 : 0, mm, w, h, { outline: o.outline ?? 2, wear: o.wear, glass: o.glass ?? 0.75, shadow: false, cy: gy / h, studio: true, smooth: true });
  const names = M.names ?? [], ids: string[] = [], idOf = new Map<string, number>(), N = w * h, owner = new Int16Array(N).fill(-1), mat: (Material | null)[] = new Array(N).fill(null);
  const matOf = (t: number): Material => { const k = KINDS[M.kind[t]!], nm = names[M.part[t]!] ?? '', c = M.col[t * 3]! + M.col[t * 3 + 1]! + M.col[t * 3 + 2]!;
    return k === 'paint' ? (/^fender/.test(nm) ? 'paint2' : 'paint') : k === 'metal' ? 'chrome' : k === 'glass' || k === 'shine' ? 'glass' : k === 'tyre' ? 'rubber' : k === 'wood' ? 'wood' : k === 'canvas' || k === 'leather' ? 'canvas' : k === 'lens' ? (M.col[t * 3]! > 180 && M.col[t * 3 + 1]! < 90 ? 'lensR' : 'lens') : c > 600 ? 'white' : 'black'; };
  for (let i = 0; i < N; i++) { const t = p.tri?.[i] ?? -1; if (t < 0) continue; const nm = names[M.part[t]!] || `part${M.part[t]}`; let id = idOf.get(nm); if (id === undefined) { id = ids.length; ids.push(nm); idOf.set(nm, id); } owner[i] = id; mat[i] = matOf(t); }
  const cx = w / 2, X = (x: number) => cx + (x - M.length / 2) / mm * (view === 'right' ? -1 : 1), Y = (z: number) => gy - z / mm;
  return { w, h, rgba: p.rgba, owner, ms: performance.now() - t0, groundY: gy, X, Y, mat, ids }; }

/** each triangle corner's normal: the face normals of its part meeting at that point within 50 degrees, averaged */
const cornerCache = new WeakMap<Mesh, Float32Array>();
function cornerNormals(M: Mesh): Float32Array { const have = cornerCache.get(M); if (have) return have; const p = M.pos, fnm = new Float32Array(M.n * 3), at = new Map<string, number[]>();
  for (let t = 0; t < M.n; t++) { const q = t * 9, a: V = [p[q]!, p[q + 1]!, p[q + 2]!], c = cross(sub([p[q + 3]!, p[q + 4]!, p[q + 5]!], a), sub([p[q + 6]!, p[q + 7]!, p[q + 8]!], a)), l = len(c) || 1; fnm.set([c[0] / l, c[1] / l, c[2] / l], t * 3);
    for (let k = 0; k < 3; k++) { const key = `${M.part[t]}:${Math.round(p[q + k * 3]!)}:${Math.round(p[q + k * 3 + 1]!)}:${Math.round(p[q + k * 3 + 2]!)}`; let arr = at.get(key); if (!arr) { arr = []; at.set(key, arr); } arr.push(t); } }
  const out = new Float32Array(M.n * 9);
  for (let t = 0; t < M.n; t++) { const q = t * 9, f: V = [fnm[t * 3]!, fnm[t * 3 + 1]!, fnm[t * 3 + 2]!];
    for (let k = 0; k < 3; k++) { const key = `${M.part[t]}:${Math.round(p[q + k * 3]!)}:${Math.round(p[q + k * 3 + 1]!)}:${Math.round(p[q + k * 3 + 2]!)}`; let s: V = [0, 0, 0];
      for (const u of at.get(key)!) { let g: V = [fnm[u * 3]!, fnm[u * 3 + 1]!, fnm[u * 3 + 2]!], dt = g[0] * f[0] + g[1] * f[1] + g[2] * f[2]; if (dt < 0) { g = mul(g, -1); dt = -dt; } if (dt > 0.64) s = add(s, g); }
      const sn = norm(len(s) > 0 ? s : f); out.set(sn, q + k * 3); } }
  cornerCache.set(M, out); return out; }
