// The title's set (docs/systems/110 §2-5, continued): the stock car standing on a circuit, as a drift game's title shows
// it, in place of the studio turntable. A small piece of track built for the picture only (not a real circuit's ground:
// light on a phone): flat grey asphalt in the drift look's plain colours, the white edge line, a red and white kerb,
// a few drift marks, the grass; beyond it a wall of tyres (render/props/trackside.ts), cones, a floodlight mast, firs
// and round trees (render/props/aerodrome.ts) up to the sky. The camera: low, at the car's front three
// quarters, a little perspective, drifting slowly round; the car's front wheels turned toward it so the tyre's side and
// the wheel's face show. World axes as the drive's: x along the track, the car's nose toward +x, z up (m).
import type { GroundData } from '../../render/live/ground';
import type { LiveProp, LiveRenderer, LiveView } from '../../render/live/renderer';
import { Build, type Mesh, type V } from '../../render/car/mesh';
import { edgeTyres } from '../../render/props/trackside';
import { treeRound, treePoplar } from '../../render/props/aerodrome';
import type { Design } from '../../core/design';
import { stockP959 } from '../../core/bodies';

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** a fixed scatter (the same set every time) */
const rnd = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** the track's lines across (m, y): the asphalt from the near side to the far edge line, the line, the kerb */
export const EDGE = { asphalt0: -40, line0: 7.45, line1: 7.6, kerb0: 7.75, kerb1: 8.9, kerbBlock: 1.6 };

/** the ground: grass to the horizon, the asphalt, its edge line, the kerb in red and white blocks, two drift marks */
export function titleGround(): GroundData {
  const P: number[] = [], C: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], col: number[]) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); for (let k = 0; k < 6; k++) C.push(...col); };
  const rect = (x0: number, x1: number, y0: number, y1: number, z: number, col: number[]) => quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], col);
  const G = 2500, X = 700;
  rect(-G, G, -G, G, -0.05, hex('#7fa653'));   // the grass
  rect(-X, X, EDGE.asphalt0, EDGE.kerb0, -0.012, hex('#83868b'));   // the asphalt, light and plain as the drift look has it
  rect(-X, X, EDGE.line0, EDGE.line1, -0.008, hex('#f1f0ea'));   // the edge line
  for (let x = -X, k = 0; x < X; x += EDGE.kerbBlock, k++) {   // the kerb, its outer edge a little raised
    const col = hex(k % 2 ? '#d23a30' : '#f2f1ec'), x1 = x + EDGE.kerbBlock;
    quad([x, EDGE.kerb0, -0.006], [x1, EDGE.kerb0, -0.006], [x1, EDGE.kerb1, 0.045], [x, EDGE.kerb1, 0.045], col);
    quad([x, EDGE.kerb1, 0.045], [x1, EDGE.kerb1, 0.045], [x1, EDGE.kerb1 + 0.12, -0.04], [x, EDGE.kerb1 + 0.12, -0.04], col); }
  // the drift marks: two arcs a track's width apart, curving in from the far side to under the car
  const mark = hex('#64676c');
  for (const r of [15.2, 16.7]) { const cx = 2.4, cy = -15.6, w = 0.24, N = 40;
    for (let i = 0; i < N; i++) { const a0 = 1.42 + i / N * 0.95, a1 = 1.42 + (i + 1) / N * 0.95, p = (a: number, rr: number) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, -0.01];
      quad(p(a0, r - w / 2), p(a1, r - w / 2), p(a1, r + w / 2), p(a0, r + w / 2), mark); } }
  // laid out on the +y side, then turned over to the -y side: each y negated, each triangle's corners reversed (its winding kept)
  for (let t = 0; t < P.length; t += 9) { for (let k = 1; k < 9; k += 3) P[t + k] = -P[t + k]!; for (let k = 0; k < 3; k++) { const a = P[t + 3 + k]!; P[t + 3 + k] = P[t + 6 + k]!; P[t + 6 + k] = a; } }
  const n = P.length / 3; return { pos: new Float32Array(P), col: new Uint8Array(C), flag: new Float32Array(n), n, trk: new Float32Array(n * 3) }; }

// ---- the set's own small things (each mesh x from 0 to its length, its middle at the prop's place) ----
/** a traffic cone, 0.7 m: orange, a white band, a square foot */
export function cone(): Mesh { const b = new Build(), L = 420, X = L / 2, ring = (r: number, z: number): V[] => Array.from({ length: 10 }, (_, i) => [X + Math.cos(i / 10 * Math.PI * 2) * r, Math.sin(i / 10 * Math.PI * 2) * r, z]);
  b.mat('#d8551f', 0.25, 'paint').box(0, L, -210, 210, 0, 45);
  const r = (z: number) => 165 - (z - 45) * 0.21;
  b.mat('#f06a22', 0.3, 'paint').loft([ring(r(45), 45), ring(r(300), 300)]);
  b.mat('#f4f3ee', 0.3, 'paint').loft([ring(r(300), 300), ring(r(430), 430)]);
  b.mat('#f06a22', 0.3, 'paint').loft([ring(r(430), 430), ring(r(700), 700)]);
  return b.mesh(L); }
/** a fir, `arg` tenths of its 9 m: a short trunk, three stacked cones of bright green */
export function fir(arg = 10): Mesh { const b = new Build(), k = Math.max(5, arg) / 10, L = 4400 * k, X = L / 2, N = 7;
  const ring = (r: number, z: number, t = 0): V[] => Array.from({ length: N }, (_, i) => [X + Math.cos((i + t) / N * Math.PI * 2) * r * k, Math.sin((i + t) / N * Math.PI * 2) * r * k, z * k]);
  b.mat('#6b4a33', 0.15, 'timber').bar([X, 0, 0], [X, 0, 1600 * k], 380 * k);
  ([[1100, 2200, 4400, '#3f8a3c'], [3000, 1750, 6600, '#46963f'], [5000, 1250, 9000, '#4fa245']] as [number, number, number, string][])
    .forEach(([z0, r, z1, c], j) => { b.mat(c, 0.15, 'canvas').loft([ring(r, z0, j * 0.5), ring(r * 0.45, (z0 + z1) / 2, j * 0.5), ring(18, z1, j * 0.5)]); });
  return b.mesh(L); }
/** a floodlight mast, 14 m: a grey pole, a frame of lamps on top */
export function mast(): Mesh { const b = new Build(), L = 2600, X = L / 2;
  b.mat('#8c9297', 0.4, 'metal').bar([X, 0, 0], [X, 0, 14000], 260);
  b.mat('#5c6166', 0.3, 'metal').box(X - 1300, X + 1300, -150, 150, 13600, 14700);
  b.mat('#f4f1df', 0.6, 'paint'); for (let i = 0; i < 4; i++) { const x = X - 1050 + i * 700; b.box(x - 260, x + 260, -230, -150, 13700, 14600); }
  return b.mesh(L); }

/** the set's things and where they stand (x, y, heading; a tree's kind and size) */
export function titleProps(L: LiveRenderer): LiveProp[] {
  const P = (kind: string, make: () => Mesh) => L.prop(`title:${kind}`, make), out: LiveProp[] = [];
  // laid out on the +y side as the ground is, then put on the -y side (y negated, the headings turned over)
  const at = (kind: string, make: () => Mesh, x: number, y: number, h = 0, z = 0) => out.push({ g: P(kind, make), x, y: -y, z, h: -h });
  // the tyre wall behind the kerb's grass, its face toward the road, in 6 m lengths
  for (let x = -66; x < 30; x += 6) at('tyres', () => edgeTyres(6000), x + 3, 13.2, Math.PI);
  for (const [x, y] of [[-7.5, -4.2], [-12.5, 4.6], [5.8, 5.4], [-21, 5.8]] as [number, number][]) at('cone', cone, x, y, rnd(x) * 3);
  at('mast', mast, -9, 23, 0.2);
  // the trees: a belt of firs with round trees and poplars among them, thinning out toward the horizon
  for (let i = 0; i < 46; i++) { const x = -150 + rnd(i) * 190, y = 19 + Math.pow(rnd(i + 50), 1.6) * 70, s = 8 + Math.round(rnd(i + 99) * 6), pick = rnd(i + 7);
    if (pick < 0.62) at(`fir${s}`, () => fir(s), x, y, rnd(i + 3) * 6); else if (pick < 0.85) at('round', treeRound, x, y, rnd(i + 3) * 6); else at('poplar', treePoplar, x, y, rnd(i + 3) * 6); }
  return out; }

/** the title's car: the stock one, without its plates */
export function titleCar(): Design { const d = stockP959(); if (d.body.model) d.body.model = { ...d.body.model, plateF: false, plateR: false }; return d; }

/** the car's front wheels turned away from the camera (rad, left +; the inner one more): the near front tyre's side
 *  and its wheel's face toward the camera */
export const STEER = { L: -0.39, R: -0.46 };
/** the camera round the car (rad from the nose; the nose then toward the screen's left, at the menu, as a title shows
 *  it), its height (m), the car's middle's height */
const AZ = 0.64, EYE_Z = 0.95, MID_Z = 0.6;

/** the camera for a W x H picture at time t (s): wide (the car right of the menu, lower) or narrow (a phone: the car
 *  across the picture between the logo and the menu); `len` the car's length (mm). The drift: a few degrees round the car
 *  and back, slowly */
export function titleView(W: number, H: number, t: number, len: number): LiveView {
  const wide = W > H * 1.05, aspect = W / H;
  // the field of view: wide 30 degrees high; narrow 44 degrees across (then tall)
  const tanV = wide ? Math.tan(15 * Math.PI / 180) : Math.tan(22 * Math.PI / 180) / aspect, tanH = tanV * aspect;
  const az = AZ + 0.06 * Math.sin(t * 0.11), car = len / 1000, across = car * Math.abs(Math.cos(az)) + 1.85 * Math.abs(Math.sin(az));
  const frac = wide ? 0.5 : 0.9, cx = wide ? 0.69 : 0.53, cy = wide ? 0.64 : 0.5, D = across / (frac * 2 * tanH);
  const eye: [number, number, number] = [Math.cos(az) * D, Math.sin(az) * D, EYE_Z + 0.05 * Math.sin(t * 0.07)];
  const toward = (tx: number, ty: number) => Math.atan2(ty - eye[1], tx - eye[0]);
  const a0 = toward(0, 0), right = [Math.sin(a0), -Math.cos(a0)], off = (2 * cx - 1) * D * tanH;
  const tx = -right[0]! * off, ty = -right[1]! * off, tz = MID_Z - (1 - 2 * cy) * D * tanV, ang = toward(tx, ty);
  const pitch = Math.atan2(eye[2] - tz, Math.hypot(tx - eye[0], ty - eye[1])) * 180 / Math.PI;
  return { x: tx, y: ty, z: tz, ang, pitch, mm: 10, W, H, cy: 0.5, eye, fov: 2 * Math.atan(tanV) * 180 / Math.PI, near: 0.3 }; }
/** the light: from above the viewer's left shoulder (toward the sun, world axes), so the side the camera sees is lit */
export function titleSun(v: LiveView): [number, number, number] { const f = [Math.cos(v.ang), Math.sin(v.ang)], left = [-f[1]!, f[0]!], s = [-f[0]! * 0.55 + left[0]! * 0.5, -f[1]! * 0.55 + left[1]! * 0.5, 0.95], l = Math.hypot(...s);
  return s.map(c => c / l) as [number, number, number]; }
