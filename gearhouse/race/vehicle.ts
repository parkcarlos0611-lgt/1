// A car on the track (review 84, in 3D from review 120; plan in docs/systems/76). The body is a rigid body free in all
// six ways (position, and turning about every axis): it can leave the ground over a crest, land, go over the top of a
// banking and down its earth bank, roll over and slide on its side. Under it the axles: a beam axle (most cars of the
// period) is a body of its own that rises and rolls against its leaf springs (which rub, leaf on leaf) and winds up
// under the drive and the brakes (the rear axle's tramp); independent wheels (wishbones, a swing axle) rise each on
// its own, a swing axle's wheel leaning with its travel and jacking the car up in a hard turn. Each tyre is a stiff
// spring under its hub, pressed onto the ground's surface along its normal (the concrete, the banking, the earth banks),
// its side force building over a short roll of the tyre (the relaxation length) rather than at once, its camber
// leaning it into a turn, its grip read from how much of its tread the ring of nodes (race/tyre.ts) lays on the road.
// The drive line as before: engine, a clutch that slips when it must, the gearbox, an open differential; tyres a
// simplified Pacejka curve with a friction ellipse. Stepped at a millisecond inside each call (stiff springs).
// Units SI; world axes x east, y north, z up; body axes x forward, y left, z up.
import type { RaceSpec } from './cars';
import { torqueAt, steering, suspension, type AxleKind } from './cars';
import type { Track } from './track';
import { Health, type Failure } from './health';
import { TyreRing } from './tyre';

export interface Controls { throttle: number; brake: number; /** a share of the useful lock (usefulLock): 1 full for the grip; more (to catch a slide) up to the lock */ steer: number; clutch?: number; gear?: number; handbrake?: number }   // steer -1 (right) .. 1 (left)
const G = 9.81, RHO = 1.2, HANDS = 5 * Math.PI;   // a driver's hands: two and a half turns of the wheel a second at most (a quick catch, hand over hand)
/** the road-wheel angle (rad) a driver winds on for full steer at speed v: the lock, or what the tyres can use there
 *  (the turn the grip holds, a / v², plus the slip angle they work at), whichever is less */
export function usefulLock(c: RaceSpec, v: number, mu: number): number { const lock = c.steerLock * Math.PI / 180; return Math.min(lock, Math.atan(c.wheelbase * 1.15 * mu * G / Math.max(1, v * v)) + 0.1); }
export interface Tyre { mu: number; B: number; C: number; E: number; loadSens: number; peakSlip: number; peakAngle: number }
/** a 1920s-30s cross-ply on dry concrete: modest grip, a soft gradual peak, holding on well past it */
export const CROSSPLY: Tyre = { mu: 0.9, B: 1.6, C: 1.45, E: 0.7, loadSens: 0.08, peakSlip: 0.12, peakAngle: 0.13 };   // review 89: grippier, and holding on past the peak rather than letting go
/** the tyres by era (review 94, the experimental cars): what a car's `tyreKind` picks. A racing cross-ply of the 1930s
 *  (a softer tread, narrower peak), one of the 1950s (Dunlop's racing tyres on the disc-braked cars: wider, softer, more
 *  grip and a sharper peak), and a radial (the Michelin X's construction, 1946 on the road, in racing from the late
 *  1960s: a stiff belt, a short peak at small slip angles, then letting go sooner). Figures [~]: shaped from the
 *  period's road tests (about 0.8-0.9 g on cross-plies, about 1 g on 1950s racing tyres), not measured curves. */
export const TYRES: Record<'crossply' | 'racing30' | 'racing50' | 'radial', Tyre> = {
  crossply: CROSSPLY,
  racing30: { mu: 0.98, B: 1.7, C: 1.45, E: 0.6, loadSens: 0.09, peakSlip: 0.11, peakAngle: 0.12 },
  racing50: { mu: 1.08, B: 1.9, C: 1.45, E: 0.5, loadSens: 0.1, peakSlip: 0.1, peakAngle: 0.1 },
  radial:   { mu: 1.12, B: 2.4, C: 1.4, E: 0.3, loadSens: 0.1, peakSlip: 0.08, peakAngle: 0.08 } };


type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** a unit quaternion [w, x, y, z] turning body axes into the world's */
type Q = [number, number, number, number];
const rotQ = (q: Q, v: V3): V3 => { const [w, x, y, z] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx]; };
const invRotQ = (q: Q, v: V3): V3 => rotQ([q[0], -q[1], -q[2], -q[3]], v);
/** the turn taking body axes to a frame whose x lies along heading h and whose z is the normal n */
function frameQ(h: number, n: V3): Q { const f0: V3 = [Math.cos(h), Math.sin(h), 0], z = norm(n), x = norm([f0[0] - z[0] * dot(f0, z), f0[1] - z[1] * dot(f0, z), f0[2] - z[2] * dot(f0, z)]), y = cross(z, x);
  const m00 = x[0], m11 = y[1], m22 = z[2], tr = m00 + m11 + m22; let q: Q;
  if (tr > 0) { const S = Math.sqrt(tr + 1) * 2; q = [0.25 * S, (y[2] - z[1]) / S, (z[0] - x[2]) / S, (x[1] - y[0]) / S]; }
  else if (m00 > m11 && m00 > m22) { const S = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [(y[2] - z[1]) / S, 0.25 * S, (y[0] + x[1]) / S, (z[0] + x[2]) / S]; }
  else if (m11 > m22) { const S = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(z[0] - x[2]) / S, (y[0] + x[1]) / S, 0.25 * S, (z[1] + y[2]) / S]; }
  else { const S = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(x[1] - y[0]) / S, (z[0] + x[2]) / S, (z[1] + y[2]) / S, 0.25 * S]; }
  return q; }
const SUB = 0.001;   // the inner step (s)

/** one axle's running gear: its kind, where it is, its masses and springs */
interface Axle { /** an anti-roll bar's stiffness (N/m of the two sides' difference) */ arb: number; kind: AxleKind; x: number; tw: number; ts: number; mu: number; Ia: number; k: number; c: number; fric: number; F0: number; rc: number; drive: boolean;
  /** beam: heave (m, up) and roll (rad, left up); independent: each wheel's rise (m) */ d: [number, number]; dv: [number, number]; da: [number, number];
  /** a driven beam axle's wind-up (rad, its housing turned as the wheels roll forward) */ wu: number; wv: number; Iw: number; kw: number; cw: number }

export class Vehicle {
  /** the body's centre of gravity (world), its velocity (world), its turn (body to world), its turning rate (body axes) */
  readonly p: V3 = [0, 0, 0]; readonly v: V3 = [0, 0, 0]; q: Q = [1, 0, 0, 0]; readonly om: V3 = [0, 0, 0];
  s = 0; off = 0;
  /** for the pictures and the old readers: the body's height over the surface (0 standing), pitch (nose up +) and roll (left up +) against the surface */
  zb = 0; pitch = 0; roll = 0;
  /** wheels FL FR RL RR */
  w = [0, 0, 0, 0]; load = [0, 0, 0, 0]; slipX = [0, 0, 0, 0]; slipA = [0, 0, 0, 0]; airborne = [false, false, false, false];
  /** each wheel's rise against the body (m) and its lean against the road (rad, top to the left +), for the pictures */
  travel = [0, 0, 0, 0]; camber = [0, 0, 0, 0];
  /** each wheel off the concrete (on the grass); `over`: the car has gone over the top of a banking; `upset`: on its side or roof */
  onGrass = [false, false, false, false]; over = false; upset = false;
  /** the engine's heat and wear; the last failure that happened (for the page to tell) */
  health: Health; lastFailure: Failure | null = null;
  /** each tyre as a ring of nodes (FL FR RL RR): how it gives under its load, the road and its forces (review 101) */ rings: TyreRing[]; tfx = [0, 0, 0, 0]; tfy = [0, 0, 0, 0];
  rpm = 0; gear = 1; shift = 0; steer = 0; /** the steering wheel's angle (rad, left +): the road wheels' times the ratio */ sw = 0; ax = 0; ay = 0; tax = 0; tay = 0; brakeT = [20, 20, 20, 20]; /** each wheel's spin-up rate last step (rad/s²) */ dw = [0, 0, 0, 0]; auto = true; tilt = 0;
  /** blows the body has taken, for its structure to be bent by (review 121): where (body axes from the centre of
   *  gravity, m), which way into the car, and the energy (J); taken away by whoever bends it */
  readonly hits: { at: V3; dir: V3; E: number; r: number }[] = [];
  /** each wheel knocked askew by damage (rad): toe (front of the wheel to the left +) and camber (top to the left +) */
  toeDmg = [0, 0, 0, 0]; camDmg = [0, 0, 0, 0]; private bodyHitT = 0;
  /** record a blow at a world point along a world direction into the car, of E joules (r: the size of what struck, m) */
  blow(at: V3, dir: V3, E: number, r = 0.32): void { if (E < 150) return; const b = this.toBody(at), d = invRotQ(this.q, dir); this.hits.push({ at: b, dir: norm(d), E, r }); if (this.hits.length > 12) this.hits.shift(); }
  /** later technology's state (review 125): the turbos' boost (0..1 of full), each wheel's anti-lock pressure (1 full),
   *  ABS working now, the rear wing's rise (0..1), each wheel's drive torque (Nm) */
  boost = 0; absP = [1, 1, 1, 1]; absOn = false; wing = 0; Tw = [0, 0, 0, 0];
  /** review 149: the traction control's switch (the driver's button; on at the start), working now, and how far its
   *  throttle actuator has closed (0..1 of the driver's opening); VTEC on the high cam; the steering's effort as the
   *  driver's hands feel it (0 none; the hands' rate is HANDS / (1 + effort)) and the assistance's share of it (1 none) */
  tcsEnabled = true; tcsOn = false; tcsCut = 0; vtecHigh = false; steerEffort = 0; steerAssist = 1;
  /** review 158: the dampers' setting (the driver's switch, sport for racing) and the multiplier on the damping it gives
   *  now; the automated manual's state: the clutch's engagement (0..1, the control unit's own), the throttle it blips on a
   *  downshift (0..1); the air pressing each axle down (N: front, rear) from every aerodynamic source */
  damperMode: 'comfort' | 'sport' = 'sport'; dampK = 1; clutchF1 = 0; blip = 0; downF = 0; downR = 0;
  /** the gear the current shift came from, and the shift's whole time (s) */ private gearFrom = 1; private shiftDur = 0.5;
  /** a gear change under way (for the HUD) */ get shifting(): boolean { return this.shift > 0; }
  /** how the gearbox is worked (for the HUD) */ get gearboxType(): 'manual' | 'f1' { return this.spec.tech?.gearbox ?? 'manual'; }
  /** each tyre's side deflection (m): the side force builds as the tyre rolls (the relaxation length) */ private yd = [0, 0, 0, 0];
  readonly axles: [Axle, Axle];
  private ms: number; private Ix: number; private Iy: number; private Iz: number; private Iw: number; private Ie: number; private kt: number[];
  private aPrev: V3 = [0, 0, 0]; private hl: number; private hwd: number; private hh: number; private upsetT = 0;
  constructor(readonly spec: RaceSpec, readonly track: Track, readonly tyre: Tyre = TYRES[spec.tyreKind ?? 'crossply']) {
    const m = spec.mass, L = spec.wheelbase, S = suspension(spec), sag = spec.id === 'fordT23' ? 0.035 : spec.tyreKind === 'racing50' ? 0.045 : 0.05;
    this.rings = [0, 1, 2, 3].map(i => new TyreRing(spec.tyreR, m * G * this.share(i), sag));
    this.kt = this.rings.map(r => r.F0 / (sag * spec.tyreR));
    const mk = (front: boolean): Axle => { const kind = front ? S.front : S.rear, leaf = front ? S.leafF : S.leafR, share = front ? spec.frontShare : 1 - spec.frontShare;
      const mu = m * (kind === 'beam' ? (front ? 0.06 : 0.085) : kind === 'swing' ? 0.05 : 0.04), msc = (m * share - mu) / 2, kt = m * G * share / 2 / (sag * spec.tyreR);
      const f = front ? 1.35 : 1.5, keq = msc * (2 * Math.PI * f) ** 2, k = 1 / Math.max(1e-9, 1 / keq - 1 / kt);   // the spring, with the tyre in series, sets the body's ride at f Hz
      const tw = spec.track, ts = kind === 'beam' ? tw * 0.8 : tw, Ia = mu * tw * tw / 8;
      return { kind, x: front ? L * (1 - spec.frontShare) : -L * spec.frontShare, tw, ts, mu, Ia, k, c: 2 * 0.28 * Math.sqrt(k * msc), fric: leaf ? 0.05 * msc * G : 0, F0: msc * G,
        rc: kind === 'beam' ? spec.tyreR + 0.06 : kind === 'swing' ? spec.tyreR + 0.02 : 0.1, drive: !front, d: [0, 0], dv: [0, 0], da: [0, 0],
        wu: 0, wv: 0, Iw: 6 + mu * 0.05, kw: 0, cw: 0, arb: 0 }; };
    this.axles = [mk(true), mk(false)]; { const Tmax = torqueAt(spec, spec.torqueRpm) * spec.gears[0]! * spec.final * spec.eff; for (const a of this.axles) { a.kw = Math.max(a.Iw * (2 * Math.PI * 20) ** 2, Tmax / 0.02); a.cw = 2 * 0.25 * Math.sqrt(a.kw * a.Iw); } }   /* the leaves twist about a fortieth of a radian under first gear's full torque */
    { // review 147: the roll stiffness shared as the car's makers set it, by an anti-roll bar at the front (mid-engined cars
      // carry a stiff front bar so the heavier, wider-tyred rear does not let go first). A spring's roll stiffness k ts^2 / 2, a bar's arb ts^2.
      const rf = spec.tech?.rollF, F = this.axles[0], Rr = this.axles[1]; if (rf && F.kind !== 'beam') { const kF = F.k * F.ts * F.ts / 2, kR = Rr.k * Rr.ts * Rr.ts / 2; F.arb = Math.max(0, (rf * (kF + kR) - kF) / (F.ts * F.ts * (1 - rf))); } }
    this.ms = m - this.axles[0].mu - this.axles[1].mu;
    this.Iz = m * (L * L + spec.track * spec.track) / 12 * 1.15; this.Iy = this.ms * L * L / 14; this.Ix = this.ms * spec.track * spec.track / 10;
    this.Iw = spec.inertia?.wheel ?? 1.2 + spec.tyreR * spec.tyreR * 10; this.Ie = spec.inertia?.engine ?? 0.25 + spec.hp / 400; this.rpm = spec.idle; this.health = new Health(spec.hp, spec.cooling, Math.floor(Math.random() * 1e9));
    this.hl = L / 2 + 0.6; this.hwd = spec.track / 2 + 0.12; this.hh = 1.25 - spec.cgH; }
  // ---- the old readers' view: position and velocity in the plane, the heading and its rate ----
  get x(): number { return this.p[0]; } set x(v: number) { this.p[0] = v; }
  get y(): number { return this.p[1]; } set y(v: number) { this.p[1] = v; }
  get yaw(): number { const f = rotQ(this.q, [1, 0, 0]); return Math.atan2(f[1], f[0]); }
  /** velocity along and across the heading (m/s), and the turning rate about the vertical (rad/s); set to change them */
  get vx(): number { const h = this.yaw; return this.v[0] * Math.cos(h) + this.v[1] * Math.sin(h); }
  set vx(a: number) { const h = this.yaw, c = Math.cos(h), s = Math.sin(h), b = this.vy; this.v[0] = a * c - b * s; this.v[1] = a * s + b * c; }
  get vy(): number { const h = this.yaw; return -this.v[0] * Math.sin(h) + this.v[1] * Math.cos(h); }
  set vy(b: number) { const h = this.yaw, c = Math.cos(h), s = Math.sin(h), a = this.vx; this.v[0] = a * c - b * s; this.v[1] = a * s + b * c; }
  get r(): number { return rotQ(this.q, this.om)[2]; }
  set r(v: number) { const w = rotQ(this.q, this.om); w[2] = v; const b = invRotQ(this.q, w); this.om[0] = b[0]; this.om[1] = b[1]; this.om[2] = b[2]; }
  /** set the car down at distance s, offset off, running at v (m/s) along the track */
  place(s: number, off: number, v = 0): this { const T = this.track, n = T.at(s), c = this.spec, g = T.groundAt(s, off), pt = T.point(s, off);
    this.q = frameQ(n.h, g.n); const up = rotQ(this.q, [0, 0, 1]);
    this.p[0] = pt.x + up[0] * c.cgH; this.p[1] = pt.y + up[1] * c.cgH; this.p[2] = g.z + up[2] * c.cgH;
    this.v[0] = Math.cos(n.h) * v; this.v[1] = Math.sin(n.h) * v; this.v[2] = 0; this.om[0] = 0; this.om[1] = 0; this.om[2] = v * n.k;
    this.s = s; this.off = off; this.over = false; this.upset = false; this.upsetT = 0;
    for (const a of this.axles) { a.d = [0, 0]; a.dv = [0, 0]; a.da = [0, 0]; a.wu = 0; a.wv = 0; } this.yd = [0, 0, 0, 0]; this.aPrev = [0, 0, 0];
    this.w = this.w.map(() => v / c.tyreR); this.dw = [0, 0, 0, 0]; this.sw = 0; this.steer = 0; this.gear = this.auto ? this.bestGear(v) : 1; this.rpm = Math.max(c.idle, v / c.tyreR * c.gears[this.gear - 1]! * c.final * 30 / Math.PI); return this; }
  private bestGear(v: number): number { const c = this.spec; for (let g = 1; g <= c.gears.length; g++) { const rpm = v / c.tyreR * c.gears[g - 1]! * c.final * 30 / Math.PI; if (rpm < c.hpRpm * 1.02) return g; } return c.gears.length; }
  /** for drawing the body as it is in the world (review 120): the point on the ground under its centre of gravity (where
   *  the model's origin goes), its roll (left up +, all the way round when on its roof) and pitch (nose up +) */
  get base(): V3 { return this.toWorld([0, 0, -this.spec.cgH]); }
  get rollW(): number { const ey = rotQ(this.q, [0, 1, 0]), ez = rotQ(this.q, [0, 0, 1]); return Math.atan2(ey[2], ez[2]); }
  get pitchW(): number { const ex = rotQ(this.q, [1, 0, 0]); return Math.asin(Math.max(-1, Math.min(1, ex[2]))); }
  /** the body's rate of rise (m/s) */
  get vzb(): number { return this.v[2]; }
  get speed(): number { return Math.hypot(this.v[0], this.v[1], this.v[2]); }
  /** a front wheel's own angle (rad, left +): the linkage turns the inner wheel more (Ackermann), by the car's share of it */
  steerAt(i: number): number { if (i >= 2) return this.toeDmg[i]!; const d = this.steer, a = Math.abs(d); if (a < 1e-5) return d + this.toeDmg[i]!; const c = this.spec, L = c.wheelbase, R = L / Math.tan(a), inner = (i === 0) === (d > 0);
    const ideal = Math.atan(L / (inner ? R - c.track / 2 : R + c.track / 2)); return Math.sign(d) * (a + steering(c).ackermann * (ideal - a)) + this.toeDmg[i]!; }
  /** wheel i's place in body axes [forward, left] from the centre of gravity */
  wheelAt(i: number): [number, number] { const c = this.spec; return [i < 2 ? c.wheelbase * (1 - c.frontShare) : -c.wheelbase * c.frontShare, (i % 2 === 0 ? 1 : -1) * c.track / 2]; }
  private share(i: number): number { return (i < 2 ? this.spec.frontShare : 1 - this.spec.frontShare) / 2; }
  /** a blow at a point (world): the impulse J (N s, world) changes the body's motion and turn */
  applyImpulse(at: V3, J: V3): void { const m = this.spec.mass; for (let k = 0; k < 3; k++) this.v[k] = this.v[k]! + J[k]! / m;
    const r = invRotQ(this.q, [at[0] - this.p[0], at[1] - this.p[1], at[2] - this.p[2]]), Jb = invRotQ(this.q, J), t = cross(r, Jb);
    this.om[0] = this.om[0]! + t[0] / this.Ix; this.om[1] = this.om[1]! + t[1] / this.Iy; this.om[2] = this.om[2]! + t[2] / this.Iz; }
  /** how hard the body resists a blow at a point along a direction (its effective mass's inverse) */
  invMassAt(at: V3, n: V3): number { const r = invRotQ(this.q, [at[0] - this.p[0], at[1] - this.p[1], at[2] - this.p[2]]), nb = invRotQ(this.q, n), c = cross(r, nb);
    return 1 / this.spec.mass + c[0] * c[0] / this.Ix + c[1] * c[1] / this.Iy + c[2] * c[2] / this.Iz; }
  /** the body's box (half length, half width, top over the centre of gravity, bottom under it) for knocks and the ground */
  get box(): { hl: number; hw: number; top: number; bottom: number } { return { hl: this.hl, hw: this.hwd, top: this.hh, bottom: this.spec.cgH - 0.2 }; }
  /** a point of the body (body axes from the centre of gravity) in the world */
  toWorld(b: V3): V3 { const r = rotQ(this.q, b); return [this.p[0] + r[0], this.p[1] + r[1], this.p[2] + r[2]]; }
  toBody(wp: V3): V3 { return invRotQ(this.q, [wp[0] - this.p[0], wp[1] - this.p[1], wp[2] - this.p[2]]); }
  /** a world point's velocity as part of the body */
  velAt(wp: V3): V3 { const r: V3 = [wp[0] - this.p[0], wp[1] - this.p[1], wp[2] - this.p[2]], w = rotQ(this.q, this.om), c = cross(w, r); return [this.v[0] + c[0], this.v[1] + c[1], this.v[2] + c[2]]; }
  /** where a point of the world lies on the track: near the car, from its own place along the track */
  private near(x: number, y: number): { s: number; off: number } { const T = this.track, n = T.at(this.s), dx = x - n.x, dy = y - n.y, c = Math.cos(n.h), sn = Math.sin(n.h), a = dx * c + dy * sn, l = -dx * sn + dy * c;
    return { s: this.s + a / Math.max(0.2, 1 - n.k * l), off: l }; }
  /** the ground's height and normal from three looks (forward differences), cheaper than the track's own */
  private groundFast(s: number, off: number): { z: number; n: V3 } { const T = this.track, e = 0.3, z = T.ground(s, off), dA = (T.ground(s + e, off) - z) / e, dL = (T.ground(s, off + e) - z) / e, h = T.at(s).h, c = Math.cos(h), sn = Math.sin(h);
    const gx = c * dA - sn * dL, gy = sn * dA + c * dL, l = Math.hypot(gx, gy, 1); return { z, n: [-gx / l, -gy / l, 1 / l] }; }
  step(dt: number, u: Controls): void { const n = Math.max(1, Math.round(dt / SUB)), h = dt / n; let thr = 0, Fz: number[] = [0, 0, 0, 0];
    for (let k = 0; k < n; k++) { const o = this.sub(h, u); thr = o.thr; Fz = o.Fz; }
    // the tyres' rings: their give under the load, over the road's profile along the car (a bump rolls through the tread)
    const T = this.track, cr = Math.cos(this.yaw - T.at(this.s).h);
    for (let i = 0; i < 4; i++) { const sW = this.s + this.wheelAt(i)[0] * cr, b0 = T.bump(sW); this.rings[i]!.step(dt, Fz[i]!, this.tfx[i]!, this.tfy[i]!, x => T.bump(sW + x * cr) - b0); }
    // at a standstill it stays put
    if (this.speed < 0.5 && thr < 0.05 && !this.airborne.some(Boolean)) { const kk = Math.exp(-dt * 6); this.v[0] *= kk; this.v[1] *= kk; this.om[2] *= kk; }
    // the pictures' view of the body against the surface under it
    const g = T.groundAt(this.s, this.off), up = rotQ(this.q, [0, 0, 1]), fw = rotQ(this.q, [1, 0, 0]), lf = rotQ(this.q, [0, 1, 0]), hd = this.yaw, rel = hd - T.at(this.s).h, sl = T.slope(this.s, this.off);
    this.tilt = Math.atan(sl.across * Math.cos(rel) - sl.along * Math.sin(rel));
    const tX = Math.atan(sl.along * Math.cos(rel) + sl.across * Math.sin(rel));
    this.pitch = Math.asin(Math.max(-1, Math.min(1, dot(fw, g.n)))) - 0 * tX; this.roll = Math.asin(Math.max(-1, Math.min(1, dot(lf, g.n))));
    const R0 = this.rings[0]!.rest, base = this.toWorld([0, 0, -(this.spec.cgH)]); this.zb = base[2] - T.ground(this.s, this.off) + 0 * R0;
    this.upsetT = dot(up, g.n) < 0.35 ? this.upsetT + dt : 0; this.upset = this.upsetT > 1.5; }
  private sub(dt: number, u: Controls): { thr: number; Fz: number[] } {
    const c = this.spec, m = c.mass, T = this.track, R = c.tyreR, ty = this.tyre;
    // ---- where on the track ----
    { const loc = T.locate(this.p[0], this.p[1], this.s, 4); this.s = loc.s; this.off = loc.off; }   /* a millisecond moves it well under a metre */
    { const bk = T.bankAt(this.s); if (bk.b && bk.f > 0.3 && Math.abs(this.off) > T.spec.width / 2 + 1.5 && Math.sign(this.off) === T.outerSide(this.s) && this.p[2] < T.height(this.s, Math.sign(this.off) * T.spec.width / 2) - 1) this.over = true; }
    const ex: V3 = rotQ(this.q, [1, 0, 0]), ey: V3 = rotQ(this.q, [0, 1, 0]), ez: V3 = rotQ(this.q, [0, 0, 1]);
    // ---- steering (review 100): the driver's hands turn the steering wheel, the box or rack turns the road wheels ----
    { const S = steering(c), N = S.ratio, lockR = c.steerLock * Math.PI / 180, want = Math.max(-lockR, Math.min(lockR, u.steer * usefulLock(c, this.speed, ty.mu))) * N, toCentre = Math.abs(want) < Math.abs(this.sw) && Math.sign(want - this.sw) === -Math.sign(this.sw);
      // the assistance (review 149): a hydraulic pump's fixed share; an electric motor's, speed-sensitive (most help
      // parking, the effort, and with it the feel, coming back as the speed rises): low + (high - low) (v/fade)^2 / (1 + (v/fade)^2)
      const P = c.tech, kmh = this.speed * 3.6, assist = P?.eps ? P.eps.high + (P.eps.low - P.eps.high) / (1 + (kmh / P.eps.fade) ** 2) : P?.power ? 0.3 : 1;
      const effort = (m * c.frontShare / 1000) / (1 + this.speed / 1.5) * 15 / N * (S.rack ? 1.0 : 1.4) * assist, hands = HANDS / (1 + effort), rate = hands + (toCentre ? this.speed * 0.25 : 0);
      this.steerEffort = effort; this.steerAssist = assist;
      this.sw += Math.max(-rate * dt, Math.min(rate * dt, want - this.sw)); this.steer = this.sw / N; }
    // ---- drive line: gear changes, the engine, the clutch, the open differential ----
    this.shift -= dt; const vxh = this.vx, F1 = c.tech?.gearbox === 'f1';
    const wheelRpm = Math.max(0, vxh) / R * c.gears[this.gear - 1]! * c.final * 30 / Math.PI;
    if (this.shift <= 0) { let to = this.gear;
      if (this.auto) { if (wheelRpm > Math.min(c.hpRpm * 1.04, c.redline * 0.92) && this.gear < c.gears.length) to = this.gear + 1; else if (this.gear > 1 && wheelRpm * c.gears[this.gear - 2]! / c.gears[this.gear - 1]! < c.hpRpm * 0.8) to = this.gear - 1; }
      else if (u.gear && u.gear !== this.gear) to = F1 ? this.gear + Math.sign(u.gear - this.gear) : Math.max(1, Math.min(c.gears.length, u.gear));   /* the paddles step one gear a pull */
      if (F1 && to < this.gear && wheelRpm * c.gears[to - 1]! / c.gears[this.gear - 1]! > c.redline) to = this.gear;   /* the control unit refuses a downshift that would over-rev */
      if (to !== this.gear) { this.gearFrom = this.gear; this.gear = to; this.shift = this.shiftDur = c.shiftT ?? 0.5; } }
    // the automated manual's shift (review 158), by its progress p (0..1): the clutch opens as the torque is cut (to 0.25),
    // stays open while the gear is swapped (at 0.45), closes as the torque refills (from 0.65); `env` the clutch's and the
    // torque's share through it. A manual shift is one dead time: no drive, no clutch
    const p = this.shift > 0 ? 1 - this.shift / this.shiftDur : 1, env = p < 0.25 ? 1 - p / 0.25 : p < 0.65 ? 0 : (p - 0.65) / 0.35, down = this.gear < this.gearFrom;
    const gi = F1 && this.shift > 0 && p < 0.45 ? this.gearFrom : this.gear;   /* the old gear until the clutch is open */
    const X = c.tech, fF = X?.drive ? X.drive.front : 0, wFa = (this.w[0]! + this.w[1]!) / 2, wRa = (this.w[2]! + this.w[3]!) / 2;   /* the centre differential: the shaft turns at the axles' speeds weighted by their torque shares */
    const Gr = c.gears[gi - 1]! * c.final, we = this.rpm * Math.PI / 30, wd = fF * wFa + (1 - fF) * wRa, idle = c.idle * Math.PI / 30;
    const thrD = Math.max(0, Math.min(1, u.throttle)) * (this.auto && this.rpm > c.redline * 0.98 ? 0.25 : 1);
    // the blip: on a downshift, with the clutch opening and open, the control unit opens the throttle to bring the revs to
    // what the lower gear will turn them at (a proportional opening, full 1,500 rpm short), and lets it close as it nears them
    this.blip = F1 && this.shift > 0 && down && p < 0.8 ? Math.max(0, Math.min(1, (wd * c.gears[this.gear - 1]! * c.final * 30 / Math.PI - this.rpm) / 1500)) : 0;
    const thr = this.shift <= 0 ? thrD : F1 ? Math.max(thrD * env, this.blip) : 0, fric = 0.06 * torqueAt(c, c.torqueRpm) * (0.3 + 0.7 * this.rpm / c.hpRpm);
    const hp = this.health.power, alive = this.health.running;
    // VTEC (review 149): the high cam's oil passage opens above the switch-over revs and closes a little below them
    if (X?.vtec) { if (!this.vtecHigh && this.rpm > X.vtec.rpm) this.vtecHigh = true; else if (this.vtecHigh && this.rpm < X.vtec.rpm - X.vtec.hyst) this.vtecHigh = false; }
    const cam = X?.vtec ? (this.vtecHigh ? 'high' : 'low') : undefined;
    // traction control (review 149, a period system): the faster rear wheel's speed against the undriven fronts' (the car's
    // speed over the road), slip = (w_rear R - v_ref) / max(v_ref, 2 m/s). Past the threshold the throttle actuator closes
    // toward cut x min(1, (slip - slip0) / slip0) of the driver's opening with a lag of tau (the sensors, the ECU, the
    // actuator's travel), and opens again over 1.5 tau, so it overshoots and hunts a little as the real ones did.
    let thrE = thr; if (X?.tcs && this.tcsEnabled && !fF) { const S = X.tcs, vref = Math.max(0, (this.w[0]! + this.w[1]!) / 2 * R), slip = (Math.max(this.w[2]!, this.w[3]!) * R - vref) / Math.max(vref, 2);
      const want = thr > 0.02 ? S.cut * Math.max(0, Math.min(1, (slip - S.slip) / S.slip)) : 0, tau = want > this.tcsCut ? S.tau : S.tau * 1.5;
      this.tcsCut += (want - this.tcsCut) * Math.min(1, dt / tau); thrE = thr * (1 - this.tcsCut); } else this.tcsCut = 0;
    this.tcsOn = this.tcsCut > 0.03;
    // the turbos (review 125): boost builds with the exhaust's flow (revs and throttle) over the spool time, falls fast when the throttle shuts (the blow-off); off boost the engine makes what it would unblown
    let blow = 1; if (X?.turbo) { const T = X.turbo, want = thr * Math.min(1, Math.max(0, (this.rpm - T.full * 0.45) / (T.full * 0.55))), tau = want > this.boost ? T.spool * (1.6 - this.rpm / c.redline) * (this.boost > 0.4 ? 0.5 : 1) : 0.6;   /* the turbines keep turning through a short lift: the boost falls slowly and comes back quickly */
      this.boost += (want - this.boost) * Math.min(1, dt / Math.max(0.02, tau)); const base = 1 / (1 + T.boost * 0.95); blow = base + (1 - base) * this.boost; }
    const Te = alive ? (this.rpm < c.redline * 1.1 ? thrE * torqueAt(c, this.rpm, cam) * hp * blow : 0) - fric * (1 - thrE) + (this.rpm < c.idle ? fric * 2 : 0) : -fric * 3 - (this.rpm > 1 ? 30 : 0);
    let engaged: number;
    if (!F1) { const autoC = this.shift > 0 ? 0 : Math.max(0, Math.min(1, wd * Gr > we * 0.97 ? 1 : (c.launchRpm ? (this.rpm - c.launchRpm * 0.8) / (c.launchRpm * 0.2) : (this.rpm - c.idle * 1.3) / (c.idle * 1.2))));
      engaged = u.clutch === undefined ? autoC : Math.min(autoC, 1 - u.clutch); }
    else { // the automated manual (review 158): no clutch pedal. Moving off, the control unit's launch curve: the clutch's
      // aim rises with the revs over idle (squared: a soft first bite, firm by the launch revs at full throttle, sooner at part) and with how near the
      // shaft has come to the engine's speed at part throttle (it closes the slip rather than hold it), the clutch following it over a
      // quarter second; it lets go at once near idle (it never stalls) and is locked once the shaft has caught the engine.
      // In a shift: the shift's envelope
      const L = c.launchRpm ?? c.hpRpm * 0.6, ratio = wd * Gr / Math.max(1, we), i0 = c.idle * 1.15, x = Math.max(0, Math.min(1, (this.rpm - i0) / ((L - i0) * Math.max(0.25, thrD))));   /* the revs it bites at scale with the pedal */
      const aim = this.rpm < c.idle * 1.1 ? 0 : ratio > 0.97 ? 1 : thrD < 0.03 ? 0 : Math.min(1, Math.max(x * x, (ratio - 0.4) / 0.57 * (1 - 0.7 * thrD)));   /* at full throttle the revs govern (no dumped clutch) */
      this.clutchF1 = aim < this.clutchF1 ? aim : this.clutchF1 + Math.min(aim - this.clutchF1, dt / 0.25);
      engaged = this.shift > 0 ? env : this.clutchF1; if (this.shift > 0) this.clutchF1 = 1; }
    const cap = engaged * torqueAt(c, c.torqueRpm) * 2.2;
    const need = (we - wd * Gr) / (dt * (1 / this.Ie + Gr * Gr * (fF * fF + (1 - fF) * (1 - fF)) / (2 * this.Iw))), Tc = Math.max(-cap, Math.min(cap, need));
    this.rpm = Math.max(alive ? idle * 0.5 : 0, we + (Te - Tc) / this.Ie * dt) * 30 / Math.PI;
    { const f = this.health.step(dt, this.rpm, c.redline, Math.max(0, Te) * this.rpm * Math.PI / 30, this.speed); if (f) this.lastFailure = f; }
    const Taxle = Tc * Gr * c.eff;
    { // to the wheels: the centre differential's shares and the viscous coupling across it (it passes torque from the faster
      // axle to the slower as they slip apart); each axle's own differential, the rear torque-sensing (up to its bias ratio)
      const Tv = X?.drive ? X.drive.visc * (wRa - wFa) : 0, TF = fF * Taxle + Tv, TR = (1 - fF) * Taxle - Tv, w = this.w;
      const split = (T: number, a: number, b: number, bias?: number): [number, number] => { let x = 0; if (bias) { const lim = Math.abs(T) / 2 * (bias - 1) / (bias + 1); x = Math.max(-lim, Math.min(lim, 300 * (w[b]! - w[a]!))); } return [T / 2 + x, T / 2 - x]; };
      const [f0, f1] = split(TF, 0, 1); let [r0, r1] = split(TR, 2, 3, X?.rearLsd);
      if (X?.rearVisc) { const v = X.rearVisc * (w[3]! - w[2]!); r0 += v; r1 -= v; }   /* a viscous rear differential: the faster wheel's spin passes torque to the slower */
      this.Tw = [f0, f1, r0, r1]; }
    // ---- forces and turns on the body (world), gathered ----
    const F: V3 = [0, 0, -this.ms * G], Tb: V3 = [0, 0, 0];   // Tb: turning moment, body axes
    // the variable dampers (review 158): sport a fixed firmer setting; comfort soft in town, firming with the speed
    { const D = X?.damp, kmh = this.speed * 3.6; this.dampK = !D ? 1 : this.damperMode === 'sport' ? D.sport : Math.min(D.sport, D.comfort * (1 + (D.speedK ?? 0) * kmh / 100)); }
    const addAt = (bp: V3, f: V3) => { F[0] += f[0]; F[1] += f[1]; F[2] += f[2]; const fb = invRotQ(this.q, f), t = cross(bp, fb); Tb[0] += t[0]; Tb[1] += t[1]; Tb[2] += t[2]; };
    // the unsprung masses' weight and inertia along the body's up (their own up and down is their own); across it the whole car's
    const gz = -G * ez[2], az = dot(this.aPrev, ez);
    const Fz = [0, 0, 0, 0], fxs = [0, 0, 0, 0], fys = [0, 0, 0, 0], brakeCap = c.brakeG * m * G * R; let absNow = false;
    let tyreH: V3 = [0, 0, 0];
    for (let ai = 0; ai < 2; ai++) { const A = this.axles[ai]!, beam = A.kind === 'beam', Q: [number, number] = [0, 0]; let tbAx = 0; const zh0 = R - this.rings[ai * 2]!.rest - c.cgH;
      const wind = A.drive && beam ? A.wu * 0.12 : 0;   // a beam axle wound up lifts (or drops) a little on its springs' twist
      for (let side = 0; side < 2; side++) { const i = ai * 2 + side, sy = side === 0 ? 1 : -1, yW = sy * A.tw / 2;
        const t = beam ? A.d[0] + sy * A.d[1] * A.tw / 2 + wind : A.d[side]!, tv = beam ? A.dv[0] + sy * A.dv[1] * A.tw / 2 : A.dv[side]!;
        this.travel[i] = t;
        // the wheel's lean against the body: a beam axle's roll; a swing axle's arm; a wishbone's small gain
        const lean = (beam ? A.d[1] : A.kind === 'swing' ? -sy * t / (A.tw / 2) : -sy * t * 0.5) + this.camDmg[i]!;
        const st = this.steerAt(i), hubB: V3 = [A.x, yW, zh0 + t], hub = this.toWorld(hubB);
        const axB: V3 = [-Math.sin(st) * Math.cos(lean), Math.cos(st) * Math.cos(lean), Math.sin(lean)], axW = rotQ(this.q, axB);   // the spin axis, pointing left
        const q = this.near(hub[0], hub[1]), gr = this.groundFast(q.s, q.off), gn = gr.n; this.onGrass[i] = Math.abs(q.off) > T.spec.width / 2;
        const dist = (hub[2] - gr.z) * gn[2], dlt = R - dist;   // the tyre pressed in (m)
        this.camber[i] = -Math.asin(Math.max(-1, Math.min(1, dot(axW, gn))));
        const fwd = norm(cross(axW, gn)), lat = cross(gn, fwd);
        const cp: V3 = [hub[0] - gn[0] * dist, hub[1] - gn[1] * dist, hub[2] - gn[2] * dist], vc0 = this.velAt(cp), vcu = rotQ(this.q, [0, 0, tv]), vc: V3 = [vc0[0] + vcu[0], vc0[1] + vcu[1], vc0[2] + vcu[2]];
        const lx = dot(vc, fwd), ly = dot(vc, lat), vn = dot(vc, gn);
        let fz = 0; if (dlt > 0) fz = Math.max(0, this.kt[i]! * dlt - 2 * 0.06 * Math.sqrt(this.kt[i]! * A.mu / 2) * vn);
        Fz[i] = fz; this.airborne[i] = fz === 0;
        // the side force builds over the relaxation length as the tyre rolls
        const sig = 0.55 * R, v0 = Math.max(Math.abs(lx), 3); this.yd[i] = fz > 0 ? this.yd[i]! + (ly - Math.max(Math.abs(lx), 0.6) * this.yd[i]! / sig) * dt : this.yd[i]! * Math.exp(-dt * 30);
        this.yd[i] = Math.max(-sig, Math.min(sig, this.yd[i]!));
        const kappa = (this.w[i]! * R - lx) / v0, tanA = this.yd[i]! / sig; this.slipX[i] = kappa; this.slipA[i] = Math.atan(tanA);
        const patch = Math.min(1.15, this.rings[i]!.patch);
        const wr = X?.tyreWF && X.tyreWR ? (i < 2 ? X.tyreWF : X.tyreWR) / ((X.tyreWF + X.tyreWR) / 2) : 1, wide = wr ** 0.3;   /* a wider tyre more grip, and (review 147) it bears a heavier load before its grip falls off: its load sensitivity is against its own rated load */
        const mu = ty.mu * wide * (1 - ty.loadSens * (fz / (m * G / 4 * wr) - 1)) * (this.onGrass[i] ? 0.55 : 1) * (0.85 + 0.15 * patch);
        const sx = kappa / ty.peakSlip, sa = tanA / ty.peakAngle, sg = Math.hypot(sx, sa);
        let fx = 0, fy = 0; if (sg > 1e-9 && fz > 0) { const Bs = ty.B * sg, f = Math.sin(ty.C * Math.atan(Bs - ty.E * (Bs - Math.atan(Bs)))); fx = mu * fz * f * sx / sg; fy = -mu * fz * f * sa / sg; }
        fy += 0.35 * this.camber[i]! * fz; { const l = Math.hypot(fx, fy), cap2 = mu * fz * 1.02; if (l > cap2) { fx *= cap2 / l; fy *= cap2 / l; } }   // camber thrust, within the grip
        const rear = i >= 2, disc = c.brakes === 'disc', fade = 1 / (1 + Math.max(0, this.brakeT[i]! - (disc ? 550 : 250)) / (disc ? 400 : 200));
        let bt = (u.brake * (c.brakes === 'rear' ? (rear ? 0.5 : 0) : rear ? 0.42 : 0.58) * brakeCap + (rear ? (u.handbrake ?? 0) * brakeCap * 0.35 : 0)) * fade;
        if (X?.abs && u.brake > 0.05 && this.speed > 2) {   /* anti-lock (review 125): a wheel slipping toward locking has its pressure let off, then built again, about a dozen times a second */
          const k = this.slipX[i]!; this.absP[i] = Math.max(0.15, Math.min(1, this.absP[i]! + (k < -0.13 ? -28 : k > -0.07 ? 14 : 0) * dt)); bt *= this.absP[i]!; if (this.absP[i]! < 0.97) absNow = true; } else this.absP[i] = 1;
        const K = mu * Math.max(fz, 1) * ty.C * ty.B / ty.peakSlip * R * R / v0;
        const w0 = this.w[i]!, drv = this.Tw[i]!, wf = w0 + (drv - fx * R - fz * (this.onGrass[i] ? 0.07 : c.crr) * R * Math.tanh(w0) + K * this.dw[i]! * dt) / (this.Iw + K * dt) * dt, bs = bt / (this.Iw + K * dt) * dt;
        this.w[i] = Math.abs(wf) <= bs ? 0 : wf - Math.sign(wf) * bs; this.dw[i] = bs > 0 || fz === 0 ? 0 : (this.w[i]! - w0) / dt; tbAx += (wf - this.w[i]!) * (this.Iw + K * dt) / dt;   /* the brake's torque, felt by the axle's housing */
        this.brakeT[i] = this.brakeT[i]! + (bt * Math.abs(this.w[i]!) / 9000 - (this.brakeT[i]! - 20) * (0.004 + this.speed * 0.0004) * (disc ? 2.2 : 1)) * dt;
        this.tfx[i] = fx; this.tfy[i] = fy; fxs[i] = fx; fys[i] = fy;
        if (A.drive && beam) A.wu += 0; // (the wind-up is stepped below, from the axle's torques)
        // the tyre's force on the running gear (world), split: along the body's up into the springs, the rest straight to the body at the roll centre
        const ft: V3 = [gn[0] * fz + fwd[0] * fx + lat[0] * fy, gn[1] * fz + fwd[1] * fx + lat[1] * fy, gn[2] * fz + fwd[2] * fx + lat[2] * fy];
        const fb = invRotQ(this.q, ft), fUp = fb[2]; tyreH = [tyreH[0] + fb[0], tyreH[1] + fb[1], tyreH[2]];
        addAt([A.x, beam ? 0 : yW * 0.5, A.rc - c.cgH], rotQ(this.q, [0, fb[1], 0]));   /* across: at the roll centre */
        addAt([A.x, yW, A.drive && beam ? zh0 + t : -c.cgH], rotQ(this.q, [fb[0], 0, 0]));   /* along: at the road, or at the hub of a driven beam axle (whose housing passes the rest through its springs' wind-up) */
        // the side force at the road, under the roll centre: it rolls a beam axle, jacks independent wheels
        const below = A.rc - (zh0 + t - (R - Math.max(0, dlt)) + c.cgH);
        if (beam) { Q[0] += fUp; Q[1] += fUp * yW + fb[1] * (A.rc - 0); }
        else { const jack = fb[1] * sy * A.rc / (A.tw / 2) * (A.kind === 'swing' ? 1 : 0.4); Q[side as 0 | 1] += fUp + jack; addAt([A.x, yW, 0], rotQ(this.q, [0, 0, -jack])); }
        void below;
        // the wheel's own weight and the body's heave felt by it
        const mw = beam ? A.mu / 2 : A.mu / 2; if (beam) { Q[0] += mw * (gz - az); } else Q[side as 0 | 1] += mw * (gz - az);
        if (A.drive && beam) { A.wv += 0; } }
      // the springs (with the leaves' rubbing) and dampers between the running gear and the body
      for (let side = 0; side < 2; side++) { const sy = side === 0 ? 1 : -1, yS = sy * A.ts / 2;
        const t = beam ? A.d[0] + sy * A.d[1] * A.ts / 2 + (A.drive ? A.wu * 0.12 : 0) : A.d[side]!, tv = beam ? A.dv[0] + sy * A.dv[1] * A.ts / 2 : A.dv[side]!;
        const bar = !beam && A.arb ? A.arb * (A.d[side]! - A.d[1 - side]!) : 0;   /* the anti-roll bar: each side pushed by the difference */
        const fs = -(A.F0 + A.k * t + bar + A.c * this.dampK * tv + A.fric * Math.tanh(tv / 0.01));   // on the running gear (pushing it down); the bump stop past 9 cm
        const stop = t > 0.09 ? -(t - 0.09) * A.k * 12 : t < -0.12 ? -(t + 0.12) * A.k * 12 : 0, f = fs + stop;
        if (beam) { Q[0] += f; Q[1] += f * yS; } else Q[side as 0 | 1] += f;
        addAt([A.x, yS, 0], rotQ(this.q, [0, 0, -f])); }
      // the running gear moved by what acts on it
      if (beam) { A.da = [Q[0] / A.mu, Q[1] / A.Ia]; } else { A.da = [Q[0] / (A.mu / 2), Q[1] / (A.mu / 2)]; }
      A.dv = [A.dv[0] + A.da[0] * dt, A.dv[1] + A.da[1] * dt]; A.d = [A.d[0] + A.dv[0] * dt, A.d[1] + A.dv[1] * dt];
      // a driven beam axle's wind-up: the drive's reaction (and the brakes') against the springs' twist
      if (beam && A.drive) { const Tw = -(this.Tw[ai * 2]! + this.Tw[ai * 2 + 1]!) + tbAx, ta = (Tw - A.kw * A.wu - A.cw * A.wv) / A.Iw; A.wv += ta * dt; A.wu += A.wv * dt; Tb[1] += A.kw * A.wu + A.cw * A.wv; } }
    // ---- the body's own corners on the ground (on its side, on its roof, bellying over a crest): upright, only the bottom ones ----
    { const bx = this.box, upright = ez[2] > 0.75, pts: V3[] = []; for (const xx of [-bx.hl, 0, bx.hl]) for (const yy of [-bx.hw, bx.hw]) for (const zz of upright ? [-bx.bottom] : [-bx.bottom, bx.top]) pts.push([xx, yy, zz]);
      for (const bp of pts) { const wp = this.toWorld(bp), q = this.near(wp[0], wp[1]), gz0 = T.ground(q.s, q.off); if (wp[2] > gz0 + 0.02) continue; const gr = this.groundFast(q.s, q.off), pen = (gr.z - wp[2]) * gr.n[2]; if (pen <= 0) continue;
        const vp = this.velAt(wp), vn = dot(vp, gr.n); if (vn < -4 && this.bodyHitT <= 0) { this.blow(wp, [-gr.n[0], -gr.n[1], -gr.n[2]], 0.5 * this.spec.mass * vn * vn * 0.35, 0.45); this.bodyHitT = 0.3; }   /* landing on it, rolling onto it: a blow */
        const fn = Math.max(0, 1.5e5 * pen - 6e3 * vn), vt: V3 = [vp[0] - gr.n[0] * vn, vp[1] - gr.n[1] * vn, vp[2] - gr.n[2] * vn], vtl = Math.hypot(vt[0], vt[1], vt[2]), fr = 0.55 * fn * Math.tanh(vtl / 0.3) / Math.max(vtl, 1e-6);
        addAt(bp, [gr.n[0] * fn - vt[0] * fr, gr.n[1] * fn - vt[1] * fr, gr.n[2] * fn - vt[2] * fr]); } }
    this.bodyHitT -= dt;
    // ---- the air ----
    this.absOn = absNow;
    const Wg = X?.wing; if (Wg) { const kmh = this.speed * 3.6, to = kmh > Wg.up ? 1 : kmh < Wg.down ? 0 : this.wing > 0.5 ? 1 : 0; this.wing += Math.max(-dt / 1.2, Math.min(dt / 1.2, to - this.wing)); }   /* the wing rises and stows over a second or so */
    { const sp = this.speed, U = X?.underbody, d = 0.5 * RHO * (c.cdA + (Wg ? Wg.cdA * this.wing : 0) + (U?.cdA ?? 0)) * sp; F[0] -= d * this.v[0]; F[1] -= d * this.v[1]; F[2] -= d * this.v[2];
      let dF = 0, dR = 0; const q = 0.5 * RHO * sp * sp;
      if (X?.ground) { const low = Math.max(0.6, Math.min(1.5, 1 - this.zb * 6)), Fg = q * X.ground.clA * low;   /* the venturis: more downforce the lower the car rides (review 126) */
        dF += Fg * X.ground.front; dR += Fg * (1 - X.ground.front); }
      if (U) { const low = Math.max(0.85, Math.min(1.15, 1 - this.zb * 2)), Fu = q * U.clA * low;   /* the flat floor and diffuser (review 158): mildly ride-height sensitive */
        dF += Fu * U.front; dR += Fu * (1 - U.front); }
      if (Wg) { const body = q * Wg.body, wingF = q * Wg.clA * this.wing;   /* downforce: the body's (shared by the axles) and the wing's (on the rear) */
        dF += body * 0.42; dR += body * 0.58 + wingF; }
      if (dF || dR) { addAt([this.axles[0].x, 0, 0], rotQ(this.q, [0, 0, -dF])); addAt([this.axles[1].x, 0, 0], rotQ(this.q, [0, 0, -dR])); }
      this.downF = dF; this.downR = dR; }
    // the whole car's weight across the body's up (the running gear goes where the body goes, sideways and along)
    { const g: V3 = [0, 0, -(m - this.ms) * G], gu = dot(g, ez); F[0] += g[0] - ez[0] * gu; F[1] += g[1] - ez[1] * gu; F[2] += g[2] - ez[2] * gu; }
    // what the tyres and the air do, in the heading's frame (the old readers' tax, tay)
    { const hd = this.yaw, ch = Math.cos(hd), sh = Math.sin(hd), fh = rotQ(this.q, [tyreH[0], tyreH[1], 0]), sp = this.speed, d = 0.5 * RHO * c.cdA * sp;
      this.tax = (fh[0] * ch + fh[1] * sh - d * (this.v[0] * ch + this.v[1] * sh)) / m; this.tay = (-fh[0] * sh + fh[1] * ch - d * (-this.v[0] * sh + this.v[1] * ch)) / m; }
    // ---- move the body: along its up its own mass, across it the whole car's ----
    const Fu = dot(F, ez), aw: V3 = [(F[0] - ez[0] * Fu) / m + ez[0] * Fu / this.ms, (F[1] - ez[1] * Fu) / m + ez[1] * Fu / this.ms, (F[2] - ez[2] * Fu) / m + ez[2] * Fu / this.ms];
    { const hd = this.yaw, ch = Math.cos(hd), sh = Math.sin(hd); this.ax = aw[0] * ch + aw[1] * sh; this.ay = -aw[0] * sh + aw[1] * ch; }
    this.aPrev = [aw[0], aw[1], aw[2]];
    for (let k = 0; k < 3; k++) { this.v[k] = this.v[k]! + aw[k]! * dt; this.p[k] = this.p[k]! + this.v[k]! * dt; }
    { const [wx, wy, wz] = this.om, Ix = this.Ix, Iy = this.Iy, Iz = this.Iz;
      this.om[0] = wx + (Tb[0] - (Iz - Iy) * wy * wz) / Ix * dt; this.om[1] = wy + (Tb[1] - (Ix - Iz) * wz * wx) / Iy * dt; this.om[2] = wz + (Tb[2] - (Iy - Ix) * wx * wy) / Iz * dt;
      const [a, b, cc] = this.om, [qw, qx, qy, qz] = this.q, hq = dt / 2, nq: Q = [qw + hq * (-qx * a - qy * b - qz * cc), qx + hq * (qw * a + qy * cc - qz * b), qy + hq * (qw * b + qz * a - qx * cc), qz + hq * (qw * cc + qx * b - qy * a)], l = Math.hypot(...nq); this.q = [nq[0] / l, nq[1] / l, nq[2] / l, nq[3] / l]; }
    this.load = Fz; void ex; void ey;
    return { thr, Fz }; }
}
