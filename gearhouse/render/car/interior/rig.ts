// The driver's rig and motion (docs/systems/118 D2-D4): the cabin's bones generalised from the needles' single turns to
// one rigid placing (a 3 x 4 matrix) a piece, so the driver can be posed as rigid segments joined at balls, FR style:
// the pelvis fixed on the seat, the torso, the head, each arm's upper arm, forearm and hand, each leg's thigh, shin and
// foot (fifteen pieces), and the controls the driver moves (the gear lever, the handbrake, the three pedals).
//   DriverMotion.step(dt, input, rig)  the timing: the hands on the rim at nine and three, hand over hand past 120
//                                      degrees, the lever along its H-pattern path, the clutch foot, the right foot
//                                      between the throttle and the brake (heel and toe on a braking downshift), the
//                                      handbrake, the hand to the key while the starter turns, the head's sway
//   poseCabin(rig, readings, pose)     the geometry: every bone's matrix (two-bone IK for the arms and the legs, the
//                                      torso leaning and turning a little when a hand must reach further), and the eye
// Mirrored for a right-hand-drive cabin through its anchors: the hand nearer the tunnel shifts.
// The car's axes (x from the nose back, y to the car's left, z up), mm. A bone's matrix is three rows of four.
import type { V } from '../mesh';
import { poseDials, type DialRig, type InteriorInput } from './gauges';

export const SEGS = ['pelvis', 'torso', 'head', 'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'] as const;
export type Seg = typeof SEGS[number];
export const CONTROLS = ['lever', 'handbrake', 'clutch', 'brake', 'throttle'] as const;
export type Control = typeof CONTROLS[number];
type LR<T> = { L: T; R: T };

/** the driver as built (at rest), car mm */
export interface DriverRest { hip: V; /** the torso's up and the seat's forward (unit) */ up: V; fwd: V; neck: V; eye: V;
  shoulder: LR<V>; elbow: LR<V>; hand: LR<V>; /** the glove's axis at rest (it is turned about it) */ handAxis: LR<V>; hipJ: LR<V>; knee: LR<V>; ankle: LR<V>;
  arm: [number, number]; leg: [number, number]; elbowPole: LR<V>; kneePole: LR<V> }
/** the steering wheel's frame (unturned): its centre, its axis toward the driver, its plane's y and z; the rim's radius,
 *  where the hands hold it (along the axis), and the hands' home angles on it (radians from the left, toward the top) */
export interface WheelRest { centre: V; axis: V; y: V; z: V; rimR: number; grip: number; home: LR<number> }
/** a part turning about an axis through a pivot */
export interface Hinge { pivot: V; axis: V; /** the turn at full travel (rad) */ max: number }
export interface ControlRest { lever: { pivot: V; knob: V }; handbrake: Hinge & { grip: V }; pedals: Record<'clutch' | 'brake' | 'throttle', Hinge & { foot: V }>; key: V }
/** what the renderer's cabin rig carries beyond the needles: the driver's bones from `first`, the controls' from `ctl` */
export interface CabinRig { first: number; ctl: number; side: 1 | -1; driver: DriverRest; wheel: WheelRest; controls: ControlRest }
export const segBone = (r: CabinRig, s: Seg) => r.first + SEGS.indexOf(s);
export const ctlBone = (r: CabinRig, c: Control) => r.ctl + CONTROLS.indexOf(c);

// ---- small vector and matrix sums ----
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]), unit = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** a 3 x 3 turn, rows */
type R3 = [number, number, number, number, number, number, number, number, number];
const I3: R3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const app = (R: R3, p: V): V => [R[0] * p[0] + R[1] * p[1] + R[2] * p[2], R[3] * p[0] + R[4] * p[1] + R[5] * p[2], R[6] * p[0] + R[7] * p[1] + R[8] * p[2]];
const mm3 = (A: R3, B: R3): R3 => { const o = new Array(9).fill(0) as R3; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3]! * B[j]! + A[i * 3 + 1]! * B[3 + j]! + A[i * 3 + 2]! * B[6 + j]!; return o; };
/** a turn by `a` about the unit axis n (Rodrigues) */
export function rotAxis(n: V, a: number): R3 { const c = Math.cos(a), s = Math.sin(a), k = 1 - c, [x, y, z] = n;
  return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k]; }
/** the least turn taking the direction a to the direction b */
export function swing(a: V, b: V): R3 { const u = unit(a), v = unit(b), c = Math.max(-1, Math.min(1, dot(u, v))), n = cross(u, v), s = len(n);
  if (s < 1e-9) { if (c > 0) return I3; const p = Math.abs(u[0]) < 0.9 ? unit(cross(u, [1, 0, 0])) : unit(cross(u, [0, 1, 0])); return rotAxis(p, Math.PI); }
  return rotAxis(mul(n, 1 / s), Math.atan2(s, c)); }
/** a placing: p -> R (p - from) + to */
interface Place { R: R3; from: V; to: V }
const at = (P: Place, p: V): V => add(app(P.R, sub(p, P.from)), P.to);
/** placing b after placing a (a's result placed by b) */
const then = (a: Place, b: Place): Place => ({ R: mm3(b.R, a.R), from: a.from, to: at(b, a.to) });
const still = (p: V): Place => ({ R: I3, from: p, to: p });
function write(out: Float32Array, bone: number, P: Place): void { const R = P.R, t = sub(P.to, app(R, P.from)); out.set([R[0], R[1], R[2], t[0], R[3], R[4], R[5], t[1], R[6], R[7], R[8], t[2]], bone * 12); }

/** two-bone IK: the middle joint of a limb from a to c (lengths l1, l2), bent toward `pole`; a target out of reach
 *  stretches the limb straight toward it */
export function joint(a: V, c: V, l1: number, l2: number, pole: V): V { const d0 = len(sub(c, a)), d = Math.max(Math.abs(l1 - l2) + 1, Math.min(d0, l1 + l2 - 1)), u = unit(sub(c, a)), x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  return add(add(a, mul(u, x)), mul(unit(sub(pole, mul(u, dot(pole, u)))), h)); }

// ---- the H pattern ----
export type Gear = number | 'R';
/** a gear's place in the gate: [across, along] with across -1 the 1-2 plane (toward the car's left), 0 the 3-4 plane
 *  (the lever's sprung middle), +1 the 5-6; along +1 forward (toward the dash), -1 back. Reverse: beside the top gear
 *  where the box has an odd count, else in its own plane left of first, forward */
export function gate(g: Gear, gears = 5): [number, number] { if (g === 'R') return gears % 2 ? [(gears - 1) / 2 - 1, -1] : [-2, 1];
  const k = Math.max(1, Math.min(gears, Math.round(g))) - 1; return [Math.floor(k / 2) - 1, k % 2 ? -1 : 1]; }
/** the lever's path from one gear to another: back to the neutral line, across to the new plane, into the gear */
export function leverPath(from: Gear, to: Gear, gears = 5): [number, number][] { const a = gate(from, gears), b = gate(to, gears);
  return [a, [a[0], 0], [b[0], 0], b]; }
/** a point a share u (0..1) along a path, by its length */
export function along(path: [number, number][], u: number): [number, number] { const seg: number[] = []; let L = 0;
  for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]); seg.push(d); L += d; }
  if (L < 1e-9) return [...path[path.length - 1]!] as [number, number]; let s = Math.max(0, Math.min(1, u)) * L;
  for (let i = 0; i < seg.length; i++) { if (s <= seg[i]! || i === seg.length - 1) { const t = seg[i]! > 0 ? Math.min(1, s / seg[i]!) : 1, p = path[i]!, q = path[i + 1]!; return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; } s -= seg[i]!; }
  return [...path[path.length - 1]!] as [number, number]; }
/** the lever's lean at a gate place: degrees across a plane, degrees along */
export const LEVER_DEG = { across: 7, along: 11 } as const;

/** the hands' hold at rest: a little above nine and three (rad above the rim's level) */
export const HAND_HOME = 6 * Math.PI / 180;
// ---- the timing ----
export const MOTION = { reach: 0.12, move: 0.15, back: 0.15, regrip: 0.2, foot: 0.1, key: 0.25, /** past this a hand lets go and takes the rim again (rad) */ regripAt: 120 * Math.PI / 180, lead: 40 * Math.PI / 180 } as const;
/** a hand's state: its angle on the rim as the cabin sees it (rad from the left, toward the top), lifted off the rim
 *  (mm toward the driver), and a task it reaches for (weight 0 on the rim .. 1 at the task) */
export interface HandPose { alpha: number; lift: number; task: 'lever' | 'handbrake' | 'key' | null; w: number }
/** what the geometry is posed from */
export interface CabinPose { wheel: number; hands: LR<HandPose>; /** the lever's gate place */ lever: [number, number]; handbrake: number; pedals: { clutch: number; brake: number; throttle: number };
  /** the right foot: 0 on the throttle .. 1 on the brake; heel and toe (0..1) */ foot: number; heelToe: number; /** the head's turn (left +), nod (forward +), lean (to the car's left +), rad */ head: [number, number, number];
  /** leave the head out (the cockpit's own view) */ hideHead?: boolean; /** written by poseCabin: the eye as posed (car mm) */ eye?: V }
/** the pose at rest: as the driver was built */
export function restPose(rig: CabinRig): CabinPose { const h = rig.wheel.home; return { wheel: 0, hands: { L: { alpha: h.L, lift: 0, task: null, w: 0 }, R: { alpha: h.R, lift: 0, task: null, w: 0 } }, lever: gate(1), handbrake: 0, pedals: { clutch: 0, brake: 0, throttle: 0 }, foot: 0, heelToe: 0, head: [0, 0, 0] }; }

/** the head's sway settings: 끔, 아주 약하게 (the default), 약하게, 보통 */
export type HeadMove = 'off' | 'subtle' | 'weak' | 'normal';
export const HEAD_MOVE: Record<HeadMove, { sway: number; look: number }> = { off: { sway: 0, look: 0 }, subtle: { sway: 0.22, look: 0.55 }, weak: { sway: 0.5, look: 0.8 }, normal: { sway: 1, look: 1 } };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const toward = (x: number, to: number, rate: number, dt: number) => x < to ? Math.min(to, x + rate * dt) : Math.max(to, x - rate * dt);
const ease = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

interface Regrip { t: number; from: number; /** the new hold, on the wheel's own frame */ to: number }
interface HandState { g: number; regrip: Regrip | null; task: HandPose['task']; w: number; still: number }
/** one car's driver moving: fed the drive's state each frame (InteriorInput), gives the pose */
export class DriverMotion {
  private h: LR<HandState> | null = null; private gear: Gear = 1; private wheel = 0; private rate = 0;
  private shift: { phase: 'idle' | 'reach' | 'move' | 'back'; t: number; from: Gear; to: Gear; next: Gear } = { phase: 'idle', t: 0, from: 1, to: 1, next: 1 };
  private lever: [number, number] = gate(1); private clutch = 0; private foot = 0; private heelToe = 0; private hb = 0; private ped = { brake: 0, throttle: 0 };
  /** the head: angle and rate for each of turn, nod, lean */ private hd = [0, 0, 0, 0, 0, 0];
  /** the head's sway (HEAD_MOVE) */ move: HeadMove = 'subtle';
  /** the pose now */ pose!: CabinPose;
  step(dt: number, i: InteriorInput, rig: CabinRig): CabinPose { const W = rig.wheel, gears = i.gears ?? 5, inner: 'L' | 'R' = rig.side > 0 ? 'R' : 'L', outer: 'L' | 'R' = inner === 'L' ? 'R' : 'L';
    dt = Math.max(0, Math.min(0.1, dt));
    const wheel = i.steer ?? 0; this.rate += ((dt > 0 ? (wheel - this.wheel) / dt : 0) - this.rate) * Math.min(1, dt * 12); this.wheel = wheel;
    if (!this.h) { this.h = { L: { g: W.home.L, regrip: null, task: null, w: 0, still: 0 }, R: { g: W.home.R, regrip: null, task: null, w: 0, still: 0 } }; this.gear = i.reverse ? 'R' : i.gear ?? 1; this.lever = gate(this.gear, gears); }
    const H = this.h;
    // ---- the gear lever: a change of gear starts the hand's reach, the lever's move and the hand's return ----
    const gNow: Gear = i.reverse ? 'R' : Math.max(1, Math.round(i.gear ?? 1)), S = this.shift, f1 = !!i.paddles;
    if (gNow !== this.gear) { const was = this.gear; this.gear = gNow;
      if (f1) { this.lever = gate(gNow, gears); }
      else if (S.phase === 'idle' || S.phase === 'back') { S.phase = 'reach'; S.t = 0; S.from = was; S.to = gNow; S.next = gNow; }
      else S.next = gNow; }
    const down = (S.phase === 'reach' || S.phase === 'move') && typeof S.to === 'number' && typeof S.from === 'number' && S.to < S.from;
    if (S.phase !== 'idle') { S.t += dt;
      if (S.phase === 'reach') { if (S.t >= MOTION.reach && (H[inner].task !== 'lever' || H[inner].w >= 0.999 || S.t >= MOTION.reach * 2)) { S.phase = 'move'; S.t = 0; } }
      else if (S.phase === 'move') { const u = ease(S.t / MOTION.move); this.lever = along(leverPath(S.from, S.to, gears), u); if (S.t >= MOTION.move) { this.lever = gate(S.to, gears); if (S.next !== S.to) { S.from = S.to; S.to = S.next; S.t = 0; } else { S.phase = 'back'; S.t = 0; } } }
      else if (S.t >= MOTION.back) S.phase = 'idle'; }
    else this.lever = gate(this.gear, gears);
    // ---- the inner hand's task: the key while the starter turns, the handbrake while it is pulled, the lever while shifting ----
    const want: HandPose['task'] = i.cranking ? 'key' : (i.handbrake ?? 0) > 0.05 ? 'handbrake' : !f1 && (S.phase === 'reach' || S.phase === 'move') ? 'lever' : null, me = H[inner];
    if (want !== me.task) { if (me.w <= 0) { me.task = want; me.regrip = null; } else if (me.task && want && me.task !== 'key' && want !== 'key') me.task = want; }   /* lever and handbrake: straight across */
    const goal = me.task !== null && me.task === want ? 1 : 0; me.w = toward(me.w, goal, 1 / (me.task === 'key' ? MOTION.key : goal > me.w ? MOTION.reach : MOTION.back), dt);
    if (me.task && goal === 0 && me.w <= 0) me.task = null;
    if (me.task) me.g = W.home[inner] + wheel;   /* the hold it comes back to: its home on the rim */
    // ---- the rim: each hand holds where it took the wheel; past 120 degrees from its home it lets go and takes it again ----
    for (const k of [outer, inner] as const) { const s = H[k], o = H[k === 'L' ? 'R' : 'L'], home = W.home[k];
      if (s.task) { s.regrip = null; continue; }
      if (s.regrip) { s.regrip.t += dt; if (s.regrip.t >= MOTION.regrip) { s.g = s.regrip.to; s.regrip = null; } continue; }
      const a = wrap(s.g - wheel), off = wrap(a - home), otherBusy = !!o.regrip || (!!o.task && o.w > 0);
      s.still = Math.abs(this.rate) < 0.3 ? s.still + dt : 0;
      if (Math.abs(off) > MOTION.regripAt && (!o.regrip || Math.abs(off) > MOTION.regripAt + 0.7)) s.regrip = { t: 0, from: a, to: home - Math.sign(off) * MOTION.lead + wheel };
      else if (Math.abs(off) > 35 * Math.PI / 180 && s.still > 0.6 && !otherBusy) s.regrip = { t: 0, from: a, to: home + wheel }; }
    const hand = (k: 'L' | 'R'): HandPose => { const s = H[k]; if (s.regrip) { const u = ease(s.regrip.t / MOTION.regrip), to = wrap(s.regrip.to - wheel), d = wrap(to - s.regrip.from); return { alpha: s.regrip.from + d * u, lift: 55 * Math.sin(Math.PI * u), task: null, w: 0 }; }
      return { alpha: wrap(s.g - wheel), lift: 0, task: s.task, w: ease(s.w) }; };
    // ---- the feet: the clutch on a shift and moving off, the right foot between the pedals, heel and toe ----
    const kmh = Math.abs(i.kmh ?? 0), thr = Math.max(0, Math.min(1, i.throttle ?? 0)), brk = Math.max(0, Math.min(1, i.brake ?? 0));
    let cl = 0; if (!f1) { if (S.phase === 'reach') cl = Math.min(1, S.t / 0.08); else if (S.phase === 'move') cl = 1; else if (S.phase === 'back') cl = 1 - S.t / MOTION.back;
      if (i.on !== false && kmh < 6 && i.running !== false) cl = Math.max(cl, thr < 0.05 ? 1 : Math.max(0, 1 - kmh / 12)); }
    if (i.clutch !== undefined) cl = Math.max(cl, i.clutch); this.clutch = toward(this.clutch, cl, 14, dt);
    const onBrake = brk > 0.04 ? 1 : 0; this.foot = toward(this.foot, onBrake, 1 / MOTION.foot, dt);
    this.heelToe = toward(this.heelToe, down && brk > 0.04 ? 1 : 0, 12, dt);
    this.ped.brake = toward(this.ped.brake, this.foot > 0.5 ? brk : 0, 12, dt);
    this.ped.throttle = toward(this.ped.throttle, this.foot < 0.5 ? thr : 0.45 * this.heelToe, 12, dt);
    this.hb = toward(this.hb, H[inner].task === 'handbrake' && H[inner].w > 0.6 ? i.handbrake ?? 0 : Math.min(this.hb, i.handbrake ?? 0), 10, dt);
    // ---- the head: leaning against the cornering, nodding with the braking and the push, the road's knocks; looking into a slide ----
    const M = HEAD_MOVE[this.move], ay = i.ay ?? 0, ax = i.ax ?? 0, slide = kmh > 18 ? Math.atan2(i.vy ?? 0, Math.max(1, Math.abs(i.vx ?? 0))) : 0;
    const look = Math.max(-0.26, Math.min(0.26, (slide * 0.6 + (i.yawRate ?? 0) * 0.05) * M.look)), want3 = [look, Math.max(-0.12, Math.min(0.12, -ax * 0.005 * M.sway + (i.bump ?? 0) * 0.02 * M.sway)), Math.max(-0.12, Math.min(0.12, -ay * 0.006 * M.sway))];
    const w = [6, 9, 8], z = [1, 0.55, 0.6]; for (let n = 0, sub = Math.max(1, Math.ceil(dt / (1 / 120))); n < sub; n++) { const h = dt / sub;
      for (let k = 0; k < 3; k++) { const x = this.hd[k]!, v = this.hd[k + 3]!, a = w[k]! * w[k]! * (want3[k]! - x) - 2 * z[k]! * w[k]! * v; this.hd[k + 3] = v + a * h; this.hd[k] = x + this.hd[k + 3]! * h; } }
    return this.pose = { wheel, hands: { L: hand('L'), R: hand('R') }, lever: [...this.lever] as [number, number], handbrake: this.hb, pedals: { clutch: this.clutch, brake: this.ped.brake, throttle: this.ped.throttle }, foot: this.foot, heelToe: this.heelToe, head: [this.hd[0]!, this.hd[1]!, this.hd[2]!] }; }
}

// ---- the geometry ----
/** a point and axis on the rim at a cabin angle, lifted toward the driver */
export function rimAt(W: WheelRest, alpha: number, lift = 0): { p: V; t: V } { const c = Math.cos(alpha), s = Math.sin(alpha);
  return { p: add(add(W.centre, mul(W.axis, W.grip + lift)), add(mul(W.y, W.rimR * c), mul(W.z, W.rimR * s))), t: add(mul(W.y, -s), mul(W.z, c)) }; }
const leverPlace = (C: ControlRest, g: [number, number]): Place => ({ R: mm3(rotAxis([1, 0, 0], g[0] * LEVER_DEG.across * Math.PI / 180), rotAxis([0, -1, 0], g[1] * LEVER_DEG.along * Math.PI / 180)), from: C.lever.pivot, to: C.lever.pivot });
const hinge = (h: Hinge, k: number): Place => ({ R: rotAxis(h.axis, h.max * Math.max(0, Math.min(1, k))), from: h.pivot, to: h.pivot });
/** where a hand goes for a task (its centre and the glove's axis) */
function taskAt(rig: CabinRig, task: NonNullable<HandPose['task']>, P: CabinPose): { p: V; t: V } { const C = rig.controls;
  if (task === 'lever') return { p: add(at(leverPlace(C, P.lever), C.lever.knob), [6, 0, 22]), t: [0, 1, 0] };
  if (task === 'handbrake') return { p: add(at(hinge(C.handbrake, P.handbrake), C.handbrake.grip), [0, 0, 18]), t: [0, 1, 0] };
  return { p: C.key, t: rig.driver.fwd }; }
/** each hand's target: on the rim (turned with it), or blended toward its task over an arc clear of the rim */
export function handTargets(rig: CabinRig, P: CabinPose): LR<{ p: V; t: V }> { const W = rig.wheel, D = rig.driver;
  const one = (k: 'L' | 'R') => { const h = P.hands[k], r = rimAt(W, h.alpha, h.lift), sg = k === 'L' ? 1 : -1, rim = { p: r.p, t: mul(r.t, sg) };
    if (!h.task || h.w <= 0) return rim; const T = taskAt(rig, h.task, P), w = h.w, arc = Math.sin(Math.PI * w);
    let t = lerp(rim.t, dot(rim.t, T.t) < 0 ? mul(T.t, -1) : T.t, w); if (len(t) < 1e-6) t = T.t;
    return { p: add(lerp(rim.p, T.p, w), add(mul(D.up, 70 * arc), mul(D.fwd, -30 * arc))), t: unit(t) }; };
  return { L: one('L'), R: one('R') }; }

/** every bone of a cabin posed: the needles at their readings (v, in DialRig.dials' order), the steering wheel, and the
 *  driver and the controls by the pose (none: as built). Three rows of four a bone */
export function poseCabin(rig: DialRig, v?: ArrayLike<number> | null, P?: CabinPose | null, out = new Float32Array(Math.max(rig.bones, 1) * 12)): Float32Array {
  poseDials(rig, P ? rig.dials.map((d, k) => d.id === 'steer' ? P.wheel : v?.[k] ?? d.rest) : v, out);
  const C = rig.cabin; if (!C || !P) { if (P && C) P.eye = C.driver.eye; return out; }
  const S = solveDriver(C, P); for (const [s, pl] of S.segs) write(out, segBone(C, s), pl);
  const K = C.controls; write(out, ctlBone(C, 'lever'), leverPlace(K, P.lever)); write(out, ctlBone(C, 'handbrake'), hinge(K.handbrake, P.handbrake));
  for (const p of ['clutch', 'brake', 'throttle'] as const) write(out, ctlBone(C, p), hinge(K.pedals[p], P.pedals[p]));
  P.eye = S.eye; return out; }

/** the driver's pieces placed for a pose, the hands' reach (for the tests: how far each forearm's end is from its hand), the eye */
export function solveDriver(C: CabinRig, P: CabinPose): { segs: [Seg, Place][]; eye: V; gap: LR<number>; lean: number; twist: number } {
  const D = C.driver, T = handTargets(C, P), lat = unit(cross(D.up, D.fwd)), reach = D.arm[0] + D.arm[1];
  // the torso leans forward and turns a little when a hand must reach further than the arm does
  const torsoAt = (lean: number, twist: number): Place => ({ R: mm3(rotAxis(lat, lean), rotAxis(D.up, twist)), from: D.hip, to: D.hip });
  const short = (pl: Place, k: 'L' | 'R') => Math.max(0, len(sub(T[k].p, at(pl, D.shoulder[k]))) - 0.985 * reach);
  let lean = 0, twist = 0; for (let it = 0; it < 6; it++) { const pl = torsoAt(lean, twist), sL = short(pl, 'L'), sR = short(pl, 'R'); if (sL + sR < 0.5) break;
    const e = 0.01, dl = (short(torsoAt(lean + e, twist), 'L') + short(torsoAt(lean + e, twist), 'R') - sL - sR) / e, dtw = (short(torsoAt(lean, twist + e), 'L') + short(torsoAt(lean, twist + e), 'R') - sL - sR) / e, g2 = dl * dl + dtw * dtw;
    if (g2 < 1e-9) break; const k = (sL + sR) / g2; lean = Math.max(-0.05, Math.min(0.3, lean - dl * k)); twist = Math.max(-0.3, Math.min(0.3, twist - dtw * k)); }
  const torso = torsoAt(lean, twist), segs: [Seg, Place][] = [['pelvis', still(D.hip)], ['torso', torso]];
  // the head on the torso: turned, nodded, leaned about the neck
  const [hy, hp, hr] = P.head, Rh = mm3(rotAxis(D.up, hy), mm3(rotAxis(lat, hp), rotAxis(D.fwd, -hr))), head = then({ R: Rh, from: D.neck, to: D.neck }, torso);
  segs.push(['head', P.hideHead ? { R: [0, 0, 0, 0, 0, 0, 0, 0, 0], from: D.neck, to: at(torso, D.neck) } : head]);
  const gap = { L: 0, R: 0 };
  for (const k of ['L', 'R'] as const) { const sh = at(torso, D.shoulder[k]), h = T[k].p, pole = app(torso.R, D.elbowPole[k]), e = joint(sh, h, D.arm[0], D.arm[1], pole);
    const Ru = mm3(swing(app(torso.R, sub(D.elbow[k], D.shoulder[k])), sub(e, sh)), torso.R);
    segs.push([`upperArm${k}`, { R: Ru, from: D.shoulder[k], to: sh }]);
    const Rf = swing(sub(D.hand[k], D.elbow[k]), sub(h, e)); segs.push([`foreArm${k}`, { R: Rf, from: D.elbow[k], to: e }]);
    gap[k] = Math.abs(len(sub(h, e)) - D.arm[1]);
    segs.push([`hand${k}`, { R: swing(D.handAxis[k], T[k].t), from: D.hand[k], to: h }]); }
  // the feet with the pedals: the left on the clutch, the right between the throttle and the brake; the legs by IK from the hips
  const K = C.controls.pedals, s = Math.max(0, Math.min(1, P.foot)), ht = Math.max(0, Math.min(1, P.heelToe));
  const footL = hinge(K.clutch, P.pedals.clutch), rest = K.throttle.foot, onB = sub(K.brake.foot, rest), ang = (1 - s) * K.throttle.max * P.pedals.throttle + s * K.brake.max * P.pedals.brake;
  const shift = add(mul(onB, s), add(mul(sub(K.throttle.foot, K.brake.foot), 0.4 * ht * s), mul(add(mul(D.up, 0.85), mul(D.fwd, -0.5)), 35 * Math.sin(Math.PI * s))));
  const footR = then({ R: I3, from: rest, to: add(rest, shift) }, { R: rotAxis(K.brake.axis, ang), from: K.brake.pivot, to: K.brake.pivot });
  for (const [k, F] of [['L', footL], ['R', footR]] as const) { const hj = D.hipJ[k], an = at(F, D.ankle[k]), kn = joint(hj, an, D.leg[0], D.leg[1], D.kneePole[k]);
    segs.push([`thigh${k}`, { R: swing(sub(D.knee[k], hj), sub(kn, hj)), from: hj, to: hj }], [`shin${k}`, { R: swing(sub(D.ankle[k], D.knee[k]), sub(an, kn)), from: D.knee[k], to: kn }], [`foot${k}`, F]); }
  return { segs, eye: at(head, D.eye), gap, lean, twist }; }
