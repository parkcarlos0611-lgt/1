// The suspension's kinematic tables (docs/systems/102, M4): each corner's linkage (kinematics.ts) solved once through
// its travel, so the physics reads its wheel's camber, toe, path and spring from the hardpoints instead of from rules
// of thumb, and the picture and the physics lean the wheel by the same linkage. Pure numbers; millimetres and radians.
//   camber      the wheel's lean against the body (- the top in), with the static setting's shims
//   toe         its toe against the body (+ in): a rear wheel's from its toe link, a front one's with its rack held
//               where the static toe puts it (the bump steer)
//   dx, dy      the wheel's centre moved along the car (+ back) and outward (the track's change)
//   spring, mr  the first coil-over's compression from the static ride and its motion ratio (the spring's travel a
//               millimetre of the wheel's)
//   jy, jx      how far the tyre's contact point (jxW: the wheel's centre) moves outward and back for each millimetre
//               the wheel rises: a force at the road along the car or across it does that much work on the spring per
//               newton, so the rest goes into the body through the links (the roll centre's and the anti-dive's share)
//   rc          the corner's own roll centre: where the line from its contact point square to that point's path
//               crosses the car's middle (mm over the ground)
// An axle's roll centre is where its two corners' lines meet; the anti-dive, anti-lift and anti-squat are the side
// view's same lines against the car's centre of gravity.
import type { Hardpoints } from './hardpoints';
import { forward, solve, camberOf, steerOf, dist, add, mul, norm, sub, dot, affAbout, affPt, rotAxis, type Pose, type V } from './kinematics';

/** the travel the tables run through (mm from the static ride) and their step */
export const TABLE_TRAVEL = { from: -80, to: 80, step: 5 } as const;
/** the steer a front corner's camber is tabled through (rad) */
export const TABLE_STEER = { from: -0.5, to: 0.5, step: 0.05 } as const;

export interface CornerTable {
  /** the static ride (mm over the hardpoints' own pose) the travel is counted from; the rack's shift there (a front corner's) */
  z0: number; rack: number; /** the static steer the rack is held at (rad, the renderer's way) */ steer: number; side: 1 | -1; front: boolean;
  /** the travel of the first sample and the step (mm) */ t0: number; dt: number;
  camber: number[]; toe: number[]; dx: number[]; dy: number[]; /** the contact point moved outward (mm) */ cy: number[]; spring: number[]; mr: number[]; jy: number[]; jx: number[]; jxW: number[]; rc: number[];
  /** a steered corner's camber change with its steer at the static ride (rad, from TABLE_STEER.from by its step) */ steerCam?: number[];
  /** the contact point's height under the wheel's centre and its distance out from the car's middle at the static ride (mm) */ cpY: number; r: number;
  /** every sample solved */ ok: boolean }

/** the wheel's centre, its rotation and the contact point (the tyre's lowest point, in the wheel's own plane) */
function contact(H: Hardpoints, P: Pose): V { const a = norm([P.R[0][1], P.R[1][1], P.R[2][1]]), down = norm(sub([0, 0, -1], mul(a, -a[2]))); return add(P.wc, mul(down, H.wheel.r)); }
/** the corner with its lower arm turned so its wheel's centre stands z mm over the hardpoints' pose, its rack held at `rack` */
function heldAt(H: Hardpoints, z: number, rack: number, from: number): Pose | null {
  let th = from, P = forward(H, th, rack); if (!P) return null; const zT = H.wc[2] + z;
  for (let it = 0; it < 30; it++) { const f = P.wc[2] - zT; if (Math.abs(f) < 1e-4) break; const h = 1e-5, Q = forward(H, th + h, rack); if (!Q) return null; const j = (Q.wc[2] - P.wc[2]) / h; if (Math.abs(j) < 1e-9) return null;
    let d = -f / j; d = Math.max(-0.2, Math.min(0.2, d)); let N: Pose | null = null; for (let q = 0; q < 8 && !N; q++) { N = forward(H, th + d, rack); if (!N) d /= 2; } if (!N) return null; th += d; P = N; }
  return Math.abs(P.wc[2] - zT) < 0.01 ? P : null; }
/** the first coil-over's length in a pose */
function springLen(H: Hardpoints, P: Pose): number { const D = H.dampers[0]; if (!D) return 0;
  const foot = H.type === 'macpherson' ? affPt(affAbout(P.R, H.lower.bj, P.lbj), D.bot) : affPt(affAbout(rotAxis(norm(sub(H.lower.r, H.lower.f)), P.theta), H.lower.f, H.lower.f), D.bot); return dist(D.top, foot); }

/** a corner's table about its static ride z0 (mm over the hardpoints' pose: the rig's ride), its front wheel's rack
 *  where `steer` (rad, the renderer's way: the front of the wheel toward +y) puts it there */
export function cornerTable(H: Hardpoints, z0: number, steer = 0): CornerTable {
  const S = solve(H, z0, H.steer.rack ? steer : 0), rack = H.steer.rack ? S.rack : 0, { from, to, step } = TABLE_TRAVEL, n = Math.round((to - from) / step) + 1, s = H.side;
  const out: CornerTable = { z0, rack, steer: H.steer.rack ? steer : 0, side: s, front: H.front, t0: from, dt: step, camber: [], toe: [], dx: [], dy: [], cy: [], spring: [], mr: [], jy: [], jx: [], jxW: [], rc: [], cpY: 0, r: H.wheel.r, ok: S.ok };
  const L0 = springLen(H, S), wc0 = S.wc, cp0 = contact(H, S), h = 0.5;
  let th = S.theta;
  const at = (z: number): Pose | null => { const P = heldAt(H, z, rack, th); if (P) th = P.theta; return P; };
  // from the static ride down to full droop, then up from it: each solve starts from its neighbour's arm angle
  const poses: (Pose | null)[] = new Array(n).fill(null), i0 = Math.round(-from / step);
  for (let i = i0; i >= 0; i--) poses[i] = at(z0 + from + i * step); th = S.theta; for (let i = i0 + 1; i < n; i++) poses[i] = at(z0 + from + i * step);
  for (let i = 0; i < n; i++) { const z = z0 + from + i * step, P = poses[i] ?? S; if (!poses[i]) out.ok = false;
    const lo = heldAt(H, z - h, rack, P.theta) ?? P, hi = heldAt(H, z + h, rack, P.theta) ?? P, dz = hi.wc[2] - lo.wc[2] || 1;
    const cp = contact(H, P), cpL = contact(H, lo), cpH = contact(H, hi);
    out.camber.push(s * camberOf(P.R)); out.toe.push(-s * steerOf(P.R)); out.dx.push(P.wc[0] - wc0[0]); out.dy.push(s * (P.wc[1] - wc0[1])); out.cy.push(s * (cp[1] - cp0[1]));
    out.spring.push(L0 - springLen(H, P)); out.mr.push((springLen(H, lo) - springLen(H, hi)) / dz);
    const jy = s * (cpH[1] - cpL[1]) / dz; out.jy.push(jy); out.jx.push((cpH[0] - cpL[0]) / dz); out.jxW.push((hi.wc[0] - lo.wc[0]) / dz);
    // the roll centre's height: the line square to the contact point's path, from that point to the car's middle, over the ground under it
    out.rc.push(jy * Math.abs(cp[1])); if (i === i0) out.cpY = Math.abs(cp[1]); }
  if (H.steer.rack) { const { from: a, to: b, step: d } = TABLE_STEER, c0 = camberOf(solve(H, z0, steer).R); out.steerCam = [];
    for (let k = 0; k <= Math.round((b - a) / d); k++) { const P = solve(H, z0, steer + a + k * d); out.steerCam.push(s * (camberOf(P.R) - c0)); } }
  return out; }

/** a table's value at travel t (mm from its static ride): straight between the samples, carried on along the end's slope past them */
export function lookup(T: CornerTable, col: number[], t: number): number { const x = (t - T.t0) / T.dt, n = col.length, i = Math.max(0, Math.min(n - 2, Math.floor(x))), f = x - i; return col[i]! + (col[i + 1]! - col[i]!) * f; }
/** a steered corner's camber change at steer `st` (rad, the wheel's front toward +y) */
export function steerCamber(T: CornerTable, st: number): number { const C = T.steerCam; if (!C) return 0; const { from, step } = TABLE_STEER, x = (Math.max(from, Math.min(TABLE_STEER.to, st)) - from) / step, i = Math.min(C.length - 2, Math.floor(x)); return C[i]! + (C[i + 1]! - C[i]!) * (x - i); }

/** an axle's roll centre with its wheels at travels tL, tR (mm: the +y corner's, the -y one's): where the two corners'
 *  lines meet, its height over the ground's mean under the contact points and its place across (mm, + toward +y) */
export function rollCentre(L: CornerTable, R: CornerTable, tL: number, tR: number): { z: number; y: number } {
  // each line: from the contact point (across y, over the ground g) inboard, rising jy for each millimetre in
  const yL = L.cpY + lookup(L, L.cy, tL), yR = R.cpY + lookup(R, R.cy, tR), jL = lookup(L, L.jy, tL), jR = lookup(R, R.jy, tR), gL = tL, gR = tR;   // the body still: a wheel risen t over it has the ground t higher under it
  // left line: (yL - s, gL + jL s); right line: (-yR + u, gR + jR u); meet: yL - s = -yR + u, gL + jL s = gR + jR u
  const W = yL + yR, den = jL + jR; if (Math.abs(den) < 1e-6) return { z: (gL + gR) / 2, y: 0 };
  const s = (gR - gL + jR * W) / den, y = yL - s, z = gL + jL * s; return { z: z - (gL + gR) / 2, y }; }

/** the side view's shares (%): front anti-dive, rear anti-lift (braking: the contact point's path, the brakes on the
 *  uprights), rear anti-squat (the drive: the wheel's centre's, the differential on the body), front anti-lift under a
 *  front drive's pull; `bf` the front brakes' share, `h` the centre of gravity's height and `L` the wheelbase (mm), `fDrive`
 *  the front's share of the drive */
export function antiGeometry(F: CornerTable, R: CornerTable, h: number, L: number, bf = 0.58, fDrive = 0): { dive: number; lift: number; squat: number; frontLift: number } {
  const i = Math.round(-F.t0 / F.dt), k = L / h * 100;
  // braking pulls each tyre back at the road (+x in the car's frame): a front contact point that comes forward as it rises (jx < 0) holds the nose up
  return { dive: -F.jx[i]! * bf * k, lift: R.jx[i]! * (1 - bf) * k, squat: R.jxW[i]! * (1 - fDrive) * k, frontLift: -F.jxW[i]! * fDrive * k }; }
void dot;
