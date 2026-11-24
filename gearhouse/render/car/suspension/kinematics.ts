// The suspension's kinematics (docs/systems/101, M3; the ground M4's physics will stand on): a corner's hardpoints in,
// and for a wheel's travel and steer the place of every joint out. Nothing here knows about meshes.
// A double wishbone corner is a real linkage of rigid bodies: the lower arm turns about its two chassis pivots; the
// upper arm about its own, to where its ball joint keeps the upright's length from the lower one; the tie rod (the toe
// link at the rear) keeps its length from the rack's end, which sets the upright's turn. So the wheel's camber, toe and
// path through its travel come out of the hardpoints, as they do on the car.
// The car's frame: x from the nose back, y across, z up, millimetres. A corner's `side` is the sign of its y.
import type { Hardpoints } from './hardpoints';

export type V = [number, number, number];
/** a rotation: three rows */
export type M3 = [V, V, V];
/** an affine map: three rows of four (the rotation and scale, then the shift) */
export type Aff = number[];

export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V) => Math.hypot(a[0], a[1], a[2]), norm = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const dist = (a: V, b: V) => len(sub(a, b)), mix = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const I3: M3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export const m3v = (m: M3, v: V): V => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
export const m3t = (m: M3): M3 => [[m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]];
export const m3m = (a: M3, b: M3): M3 => { const t = m3t(b); return [[dot(a[0], t[0]), dot(a[0], t[1]), dot(a[0], t[2])], [dot(a[1], t[0]), dot(a[1], t[1]), dot(a[1], t[2])], [dot(a[2], t[0]), dot(a[2], t[1]), dot(a[2], t[2])]]; };
/** a turn by `a` about the unit axis `k` (right-handed) */
export function rotAxis(k: V, a: number): M3 { const c = Math.cos(a), s = Math.sin(a), t = 1 - c, [x, y, z] = k;
  return [[c + x * x * t, x * y * t - z * s, x * z * t + y * s], [y * x * t + z * s, c + y * y * t, y * z * t - x * s], [z * x * t - y * s, z * y * t + x * s, c + z * z * t]]; }
/** the shortest turn that carries the unit vector a onto b */
export function rotBetween(a: V, b: V): M3 { const k = cross(a, b), s = len(k), c = dot(a, b); return s < 1e-9 ? I3 : rotAxis(mul(k, 1 / s), Math.atan2(s, c)); }
/** the rotation whose columns are a frame's axes times the transpose of another's: what carries frame E0 onto E */
const frames = (E: M3, E0: M3): M3 => m3m(m3t(E), E0);
/** a frame (three rows: its axes) from three points: along a to b, then toward c */
function frameOf(a: V, b: V, c: V): M3 { const e1 = norm(sub(b, a)), w = sub(c, a), e2 = norm(sub(w, mul(e1, dot(w, e1)))); return [e1, e2, cross(e1, e2)]; }

export const AFF_ID: Aff = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
/** the map p -> to + R (p - from) */
export function affAbout(R: M3, from: V, to: V): Aff { const t = sub(to, m3v(R, from)); return [...R[0], t[0], ...R[1], t[1], ...R[2], t[2]]; }
export const affPt = (m: Aff, p: V): V => [m[0]! * p[0] + m[1]! * p[1] + m[2]! * p[2] + m[3]!, m[4]! * p[0] + m[5]! * p[1] + m[6]! * p[2] + m[7]!, m[8]! * p[0] + m[9]! * p[1] + m[10]! * p[2] + m[11]!];
/** a then b's inverse order: the map p -> a(b(p)) */
export function affMul(a: Aff, b: Aff): Aff { const o = new Array<number>(12);
  for (let r = 0; r < 3; r++) { for (let c = 0; c < 4; c++) o[r * 4 + c] = a[r * 4]! * b[c]! + a[r * 4 + 1]! * b[4 + c]! + a[r * 4 + 2]! * b[8 + c]! + (c === 3 ? a[r * 4 + 3]! : 0); } return o; }
export function affInv(m: Aff): Aff { const a = m[0]!, b = m[1]!, c = m[2]!, d = m[4]!, e = m[5]!, f = m[6]!, g = m[8]!, h = m[9]!, i = m[10]!;
  const A = e * i - f * h, B = c * h - b * i, C = b * f - c * e, det = a * A + d * B + g * C, k = 1 / det;
  const R: M3 = [[A * k, B * k, C * k], [(f * g - d * i) * k, (a * i - c * g) * k, (c * d - a * f) * k], [(d * h - e * g) * k, (b * g - a * h) * k, (a * e - b * d) * k]];
  const t = m3v(R, [m[3]!, m[7]!, m[11]!]); return [...R[0], -t[0], ...R[1], -t[1], ...R[2], -t[2]]; }

/** where a circle (centre c, unit axis a, radius r) meets a sphere (centre s, radius d): the meeting nearer `hint`; null when they do not meet */
export function circleSphere(c: V, a: V, r: number, s: V, d: number, hint: V): V | null {
  const h = dot(sub(s, c), a), q = d * d - h * h; if (q < 0) return null;
  const p = sub(s, mul(a, h)), D = dist(p, c); if (D < 1e-6) return null;
  const x = (D * D + r * r - q) / (2 * D), y2 = r * r - x * x; if (y2 < -1e-6 * r * r) return null;
  const y = Math.sqrt(Math.max(0, y2)), e1 = mul(sub(p, c), 1 / D), e2 = cross(a, e1), m = add(c, mul(e1, x)), A = add(m, mul(e2, y)), B = sub(m, mul(e2, y));
  return dist(A, hint) <= dist(B, hint) ? A : B; }
/** the point at r1, r2, r3 from three points: of the two, the one on the `sign` side of their plane (by its own frame); null when there is none */
export function threeSpheres(p1: V, r1: number, p2: V, r2: number, p3: V, r3: number, sign: number): V | null {
  const d = dist(p1, p2), ex = mul(sub(p2, p1), 1 / d), w = sub(p3, p1), i = dot(ex, w), ey0 = sub(w, mul(ex, i)), j = len(ey0); if (j < 1e-6 || d < 1e-6) return null;
  const ey = mul(ey0, 1 / j), ez = cross(ex, ey), x = (r1 * r1 - r2 * r2 + d * d) / (2 * d), y = (r1 * r1 - r3 * r3 + i * i + j * j) / (2 * j) - i * x / j, z2 = r1 * r1 - x * x - y * y; if (z2 < -1e-6 * r1 * r1) return null;
  return add(add(add(p1, mul(ex, x)), mul(ey, y)), mul(ez, sign * Math.sqrt(Math.max(0, z2)))); }
/** the side of the plane through p1, p2, p3 (in threeSpheres' own frame) a point lies on */
function sideOf(p1: V, p2: V, p3: V, q: V): number { const ex = norm(sub(p2, p1)), w = sub(p3, p1), ey = norm(sub(w, mul(ex, dot(w, ex)))); return dot(sub(q, p1), cross(ex, ey)) >= 0 ? 1 : -1; }
/** the turn about the unit axis a that carries u onto v (both taken square to a) */
function angleAbout(a: V, u: V, v: V): number { const p = sub(u, mul(a, dot(u, a))), q = sub(v, mul(a, dot(v, a))); return Math.atan2(dot(cross(p, q), a), dot(p, q)); }

/** what a corner's hardpoints keep fixed: the arms' axes, the links' lengths, the upright's own frame */
interface Prep { aL: V; aU: V; cU: V; rU: number; dLU: number; dTL: number; dTU: number; dTI: number; sgn: number; E0: M3; lenL: number; up: number }
const preps = new WeakMap<Hardpoints, Prep>();
function prep(H: Hardpoints): Prep { let P = preps.get(H); if (P) return P;
  const aL = norm(sub(H.lower.r, H.lower.f)), aU = norm(sub(H.upper.r, H.upper.f)), cU = add(H.upper.f, mul(aU, dot(sub(H.upper.bj, H.upper.f), aU)));
  // which way the lower arm turns to lift its ball joint
  const out = sub(H.lower.bj, add(H.lower.f, mul(aL, dot(sub(H.lower.bj, H.lower.f), aL)))), up = cross(aL, out)[2] >= 0 ? 1 : -1;
  P = { aL, aU, cU, rU: dist(H.upper.bj, cU), dLU: dist(H.lower.bj, H.upper.bj), dTL: dist(H.steer.outer, H.lower.bj), dTU: dist(H.steer.outer, H.upper.bj), dTI: dist(H.steer.outer, H.steer.inner),
    sgn: sideOf(H.lower.bj, H.upper.bj, H.steer.inner, H.steer.outer), E0: frameOf(H.lower.bj, H.upper.bj, H.steer.outer), lenL: len(out), up };
  preps.set(H, P); return P; }

/** a corner posed: its joints, the upright's turn from the drawing's own pose, the wheel's centre */
export interface Pose {
  /** the lower arm's turn about its pivots, the upper arm's, the rack's shift across the car (mm) */ theta: number; phi: number; rack: number;
  lbj: V; ubj: V; /** the tie rod's ends: at the rack and at the upright */ inner: V; outer: V;
  /** the upright's rotation from the pose the hardpoints are given in; the wheel's centre */ R: M3; wc: V;
  /** whether the linkage could reach what was asked (else it stands at the nearest it can) */ ok: boolean }

/** the corner with its lower arm turned by theta and its rack shifted: null where the linkage cannot close */
export function forward(H: Hardpoints, theta: number, rack: number): Pose | null {
  const P = prep(H), RL = rotAxis(P.aL, theta), lbj = add(H.lower.f, m3v(RL, sub(H.lower.bj, H.lower.f)));
  const ubj = circleSphere(P.cU, P.aU, P.rU, lbj, P.dLU, add(H.upper.bj, sub(lbj, H.lower.bj))); if (!ubj) return null;
  const inner: V = [H.steer.inner[0], H.steer.inner[1] + rack, H.steer.inner[2]];
  const outer = threeSpheres(lbj, P.dTL, ubj, P.dTU, inner, P.dTI, P.sgn); if (!outer) return null;
  const R = frames(frameOf(lbj, ubj, outer), P.E0), wc = add(lbj, m3v(R, sub(H.wc, H.lower.bj)));
  return { theta, phi: angleAbout(P.aU, sub(H.upper.bj, P.cU), sub(ubj, P.cU)), rack, lbj, ubj, inner, outer, R, wc, ok: true }; }

/** the wheel's steer as the renderer turns it (rad: the wheel's front toward +y), its camber (rad: the top toward +y) */
export const steerOf = (R: M3): number => Math.atan2(R[0][1], R[1][1]);
export const camberOf = (R: M3): number => -Math.asin(Math.max(-1, Math.min(1, R[2][1])));

/** the corner with its wheel's centre `z` mm above the drawing's pose and steered by `steer` (a corner with no rack keeps
 *  its toe link's end where it is and takes the toe the linkage gives). Newton's method on the lower arm's turn and the
 *  rack's shift; a step that would open the linkage is halved. */
export function solve(H: Hardpoints, z: number, steer = 0, from?: { theta: number; rack: number }): Pose {
  const P = prep(H), steered = H.steer.rack, zT = H.wc[2] + z;
  let th = from?.theta ?? P.up * Math.asin(Math.max(-0.9, Math.min(0.9, z / P.lenL))), rk = steered ? from?.rack ?? 0 : 0;
  let cur = forward(H, th, rk); if (!cur) { th = 0; rk = 0; cur = forward(H, 0, 0)!; }
  let ok = false;
  for (let it = 0; it < 14; it++) {
    const f1 = cur.wc[2] - zT, f2 = steered ? steerOf(cur.R) - steer : 0; if (Math.abs(f1) < 0.02 && Math.abs(f2) < 5e-5) { ok = true; break; }
    const h = 1e-4, a = forward(H, th + h, rk) ?? forward(H, th - h, rk); if (!a) break; const sa = a.theta > th ? h : -h, j11 = (a.wc[2] - cur.wc[2]) / sa;
    let dth: number, drk = 0;
    if (steered) { const b = forward(H, th, rk + 0.05) ?? forward(H, th, rk - 0.05); if (!b) break; const sb = b.rack > rk ? 0.05 : -0.05;
      const j21 = (steerOf(a.R) - steerOf(cur.R)) / sa, j12 = (b.wc[2] - cur.wc[2]) / sb, j22 = (steerOf(b.R) - steerOf(cur.R)) / sb, det = j11 * j22 - j12 * j21; if (Math.abs(det) < 1e-12) break;
      dth = -(f1 * j22 - f2 * j12) / det; drk = -(j11 * f2 - j21 * f1) / det; }
    else { if (Math.abs(j11) < 1e-9) break; dth = -f1 / j11; }
    const k = Math.min(1, 0.3 / Math.max(1e-9, Math.abs(dth)), 40 / Math.max(1e-9, Math.abs(drk))); dth *= k; drk *= k;
    let next: Pose | null = null; for (let q = 0; q < 6 && !next; q++) { next = forward(H, th + dth, rk + drk); if (!next) { dth /= 2; drk /= 2; } }
    if (!next) break; th += dth; rk += drk; cur = next; }
  if (!ok) { const f1 = cur.wc[2] - zT, f2 = steered ? steerOf(cur.R) - steer : 0; ok = Math.abs(f1) < 0.05 && Math.abs(f2) < 1e-4; }
  return { ...cur, ok }; }

/** the bones a corner's parts hang on, in this order (the renderer's and the mesh's): the two arms, the upright (with
 *  the caliper and the hub), the brake disc (the upright's, turned with the wheel), the tie rod or toe link, the damper's
 *  body (on the lower arm), its rod and top mount (on the body), the spring (stretched between its seats), this side's
 *  half of the anti-roll bar, its drop link */
export const BONES = ['lower', 'upper', 'upright', 'disc', 'rod', 'damper', 'damperRod', 'spring', 'bar', 'link'] as const;
export const NB = BONES.length;

/** the bar's arm end where its drop link holds it, and the bar's turn (rad about +y) */
export function barAt(H: Hardpoints, P: Pose): { end: V; link: V; angle: number } | null { const B = H.bar; if (!B) return null;
  const c: V = [B.pivot[0], B.end[1], B.pivot[2]], lower = affAbout(rotAxis(prep(H).aL, P.theta), H.lower.f, H.lower.f), link = affPt(lower, B.link);
  const end = circleSphere(c, [0, 1, 0], dist(B.end, c), link, dist(B.end, B.link), add(B.end, sub(link, B.link))) ?? add(B.end, sub(link, B.link));
  return { end, link, angle: angleAbout([0, 1, 0], sub(B.end, c), sub(end, c)) }; }

/** each bone's map from the pose the hardpoints are given in to pose P (`spin`: the wheel's turn on its axle, as the
 *  renderer turns it); a damper's three bones are the first damper's (a second stands beside it and moves the same) */
export function bones(H: Hardpoints, P: Pose, spin = 0): Aff[] {
  const Q = prep(H), lower = affAbout(rotAxis(Q.aL, P.theta), H.lower.f, H.lower.f), upper = affAbout(rotAxis(Q.aU, P.phi), H.upper.f, H.upper.f), upright = affAbout(P.R, H.lower.bj, P.lbj);
  // the disc: turned about the axle as the wheel's shader turns it (about y through the hub), then carried by the upright
  const c = Math.cos(spin), s = Math.sin(spin), disc = affMul(upright, affAbout([[c, 0, -s], [0, 1, 0], [s, 0, c]], H.wc, H.wc));
  const rod = affAbout(rotBetween(norm(sub(H.steer.outer, H.steer.inner)), norm(sub(P.outer, P.inner))), H.steer.inner, P.inner);
  let damper = AFF_ID, damperRod = AFF_ID, spring = AFF_ID; const D = H.dampers[0];
  if (D) { const bot = affPt(lower, D.bot), u0 = norm(sub(D.top, D.bot)), u = norm(sub(D.top, bot)), Rm = rotBetween(u0, u), L0 = dist(D.top, D.bot), L = dist(D.top, bot);
    damper = affAbout(Rm, D.bot, bot); damperRod = affAbout(Rm, D.top, D.top);
    // the spring: from its seat on the body (which the arm carries) to the one under the top mount, its length what is left
    const l0 = L0 - D.seat[0] - D.seat[1], k = Math.max(0.2, (L - D.seat[0] - D.seat[1]) / l0), S: M3 = [0, 1, 2].map(r => [0, 1, 2].map(q => (r === q ? 1 : 0) + (k - 1) * u0[r]! * u0[q]!)) as M3;
    spring = affAbout(m3m(Rm, S), add(D.bot, mul(u0, D.seat[0])), add(bot, mul(u, D.seat[0]))); }
  let bar = AFF_ID, link = AFF_ID; const B = barAt(H, P);
  if (B && H.bar) { bar = affAbout(rotAxis([0, 1, 0], B.angle), H.bar.pivot, H.bar.pivot); link = affAbout(rotBetween(norm(sub(H.bar.end, H.bar.link)), norm(sub(B.end, B.link))), H.bar.link, B.link); }
  return [lower, upper, upright, disc, rod, damper, damperRod, spring, bar, link]; }
