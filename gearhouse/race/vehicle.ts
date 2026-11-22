// A car on the track (review 84; plan in docs/systems/69). Planar motion of the whole car on the track's surface
// (x, y, heading; velocity along and across the car; yaw rate), a sprung body that heaves, pitches and rolls on four
// springs over the bumps (so a hard bump can lift a wheel off), four wheels that spin up and slip, and the drive line:
// engine, a clutch that slips when it must, the gearbox, an open differential. Tyres: a simplified Pacejka curve with
// slip shared between driving or braking and cornering (a friction ellipse), grip falling a little as the load rises,
// as narrow cross-ply tyres of the period on concrete. Banking: the car runs on the surface's tilted plane; gravity
// pulls it down the slope and the turn presses it into the surface, so at the banking's own speed the tyres need
// hardly any side force. Units SI; body axes x forward, y left, z up.
import type { RaceSpec } from './cars';
import { torqueAt, steering } from './cars';
import type { Track } from './track';
import { Health, type Failure } from './health';

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

export class Vehicle {
  x = 0; y = 0; yaw = 0; vx = 0; vy = 0; r = 0; s = 0; off = 0;
  /** the body on its springs over the surface's plane: heave (m), pitch (rad, nose up +), roll (rad, left side up +) */
  zb = 0; vzb = 0; pitch = 0; vpitch = 0; roll = 0; vroll = 0;
  /** wheels FL FR RL RR */
  w = [0, 0, 0, 0]; load = [0, 0, 0, 0]; slipX = [0, 0, 0, 0]; slipA = [0, 0, 0, 0]; airborne = [false, false, false, false];
  /** each wheel off the concrete (on the grass); `over`: the car has gone over the top of a banking */
  onGrass = [false, false, false, false]; over = false;
  /** the engine's heat and wear; the last failure that happened (for the page to tell) */
  health: Health; lastFailure: Failure | null = null;
  rpm = 0; gear = 1; shift = 0; steer = 0; /** the steering wheel's angle (rad, left +): the road wheels' times the ratio */ sw = 0; ax = 0; ay = 0; tax = 0; tay = 0; brakeT = [20, 20, 20, 20]; /** each wheel's spin-up rate last step (rad/s²): the stiff tyre's half-implicit step leans on it so a wheel keeps pace with the car rather than dragging (review 97) */ dw = [0, 0, 0, 0]; auto = true; tilt = 0;
  private k: number; private c: number; private Ip: number; private Ir: number; private Iz: number; private Iw: number; private Ie: number;
  constructor(readonly spec: RaceSpec, readonly track: Track, readonly tyre: Tyre = TYRES[spec.tyreKind ?? 'crossply']) {
    const m = spec.mass, L = spec.wheelbase;
    this.k = m / 4 * (2 * Math.PI * 1.6) ** 2; this.c = 2 * 0.3 * Math.sqrt(this.k * m / 4);   // stiff leaves: about 1.6 Hz, a third of critical damping
    this.Iz = m * (L * L + spec.track * spec.track) / 12 * 1.15; this.Ip = m * L * L / 14; this.Ir = m * spec.track * spec.track / 10;
    this.Iw = spec.inertia?.wheel ?? 1.2 + spec.tyreR * spec.tyreR * 10; this.Ie = spec.inertia?.engine ?? 0.25 + spec.hp / 400; /* kg m²: a period engine's heavy flywheel by default */ this.rpm = spec.idle; this.health = new Health(spec.hp, spec.cooling, Math.floor(Math.random() * 1e9)); }
  /** set the car down at distance s, offset off, running at v (m/s) along the track */
  place(s: number, off: number, v = 0): this { const p = this.track.point(s, off), n = this.track.at(s), c = this.spec; this.x = p.x; this.y = p.y; this.yaw = n.h; this.vx = v; this.vy = 0; this.r = v * n.k; this.s = s; this.off = off;
    this.w = this.w.map(() => v / c.tyreR); this.dw = [0, 0, 0, 0]; this.sw = 0; this.steer = 0; this.gear = this.auto ? this.bestGear(v) : 1; this.rpm = Math.max(c.idle, v / c.tyreR * c.gears[this.gear - 1]! * c.final * 30 / Math.PI); return this; }
  private bestGear(v: number): number { const c = this.spec; for (let g = 1; g <= c.gears.length; g++) { const rpm = v / c.tyreR * c.gears[g - 1]! * c.final * 30 / Math.PI; if (rpm < c.hpRpm * 1.02) return g; } return c.gears.length; }
  get speed(): number { return Math.hypot(this.vx, this.vy); }
  /** wheel i's place in body axes [forward, left] from the centre of gravity */
  /** a front wheel's own angle (rad, left +): the linkage turns the inner wheel more (Ackermann), by the car's share of it */
  steerAt(i: number): number { if (i >= 2) return 0; const d = this.steer, a = Math.abs(d); if (a < 1e-5) return d; const c = this.spec, L = c.wheelbase, R = L / Math.tan(a), inner = (i === 0) === (d > 0);
    const ideal = Math.atan(L / (inner ? R - c.track / 2 : R + c.track / 2)); return Math.sign(d) * (a + steering(c).ackermann * (ideal - a)); }
  wheelAt(i: number): [number, number] { const c = this.spec; return [i < 2 ? c.wheelbase * (1 - c.frontShare) : -c.wheelbase * c.frontShare, (i % 2 === 0 ? 1 : -1) * c.track / 2]; }
  private share(i: number): number { return (i < 2 ? this.spec.frontShare : 1 - this.spec.frontShare) / 2; }
  step(dt: number, u: Controls): void {
    const c = this.spec, m = c.mass, T = this.track, R = c.tyreR, cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    // ---- where on the track, and the surface's tilt in the car's axes ----
    const loc = T.locate(this.x, this.y, this.s); this.s = loc.s; this.off = loc.off;
    { const bk = T.bankAt(this.s); if (bk.b && bk.f > 0.5 && Math.abs(this.off) > T.spec.width / 2 + 1 && Math.sign(this.off) === -Math.sign(T.at((bk.b.s0 + bk.b.s1) / 2).k)) this.over = true; }
    const sl = T.slope(this.s, this.off), rel = this.yaw - T.at(this.s).h, cr = Math.cos(rel), sr = Math.sin(rel);
    const tX = Math.atan(sl.along * cr + sl.across * sr), tY = Math.atan(sl.across * cr - sl.along * sr); this.tilt = tY;   // rise ahead, rise to the left
    // gravity into the surface, and what the turn adds (an acceleration toward the low side presses the car in)
    const gN = G * Math.cos(tX) * Math.cos(tY) - this.ax * Math.sin(tX) - this.ay * Math.sin(tY);
    // ---- steering (review 100): the driver's hands turn the steering wheel, the box or rack turns the road wheels by
    // its ratio. u.steer asks for a share of the lock the tyres can use at this speed (a driver does not wind on more);
    // the hands go round at up to two and a half turns a second, slower when the car is heavy on its front wheels and barely
    // rolling (no power steering: the tyres scrub round), and at speed the caster pulls the wheel back toward straight ----
    { const S = steering(c), N = S.ratio, lockR = c.steerLock * Math.PI / 180, want = Math.max(-lockR, Math.min(lockR, u.steer * usefulLock(c, this.speed, this.tyre.mu))) * N,   /* beyond 1: more than the grip uses (catching a slide), up to the lock */ toCentre = Math.abs(want) < Math.abs(this.sw) && Math.sign(want - this.sw) === -Math.sign(this.sw);
      const effort = (m * c.frontShare / 1000) / (1 + this.speed / 1.5) * 15 / N * (S.rack ? 1.0 : 1.4), hands = HANDS / (1 + effort), rate = hands + (toCentre ? this.speed * 0.25 : 0);
      this.sw += Math.max(-rate * dt, Math.min(rate * dt, want - this.sw)); this.steer = this.sw / N; }
    // ---- the body on its four springs over the ground under each wheel (bumps, and the banking's curve against the car's plane) ----
    const z0 = T.bank(this.s, this.off), F = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) { const [px, py] = this.wheelAt(i), q = T.locate(this.x + px * cy - py * sy, this.y + px * sy + py * cy, this.s);
      const ground = T.bump(q.s) + T.bank(q.s, q.off) - (z0 + sl.across * (q.off - this.off) + sl.along * T.gap(this.s, q.s));
      this.onGrass[i] = Math.abs(q.off) > T.spec.width / 2;
      const zc = this.zb + px * this.pitch + py * this.roll, vzc = this.vzb + px * this.vpitch + py * this.vroll;
      F[i] = Math.max(0, this.k * (ground - zc) - this.c * vzc + m * gN * this.share(i)); this.airborne[i] = F[i] === 0; }
    let sumF = 0, Mp = m * this.tax * c.cgH, Mr = m * this.tay * c.cgH;      // braking dips the nose; a left turn lifts the left side
    for (let i = 0; i < 4; i++) { const [px, py] = this.wheelAt(i), d = F[i]! - m * gN * this.share(i); sumF += F[i]!; Mp += px * d; Mr += py * d; }
    this.vzb += (sumF - m * gN) / m * dt; this.zb += this.vzb * dt; this.vpitch += Mp / this.Ip * dt; this.pitch += this.vpitch * dt; this.vroll += Mr / this.Ir * dt; this.roll += this.vroll * dt;
    this.load = F;
    // ---- drive line: gear changes, the engine, the clutch, the open differential ----
    this.shift -= dt;
    const wheelRpm = Math.max(0, this.vx) / c.tyreR * c.gears[this.gear - 1]! * c.final * 30 / Math.PI;   // the road speed in engine revs (the automatic does not count a wheel spinning)
    if (this.shift <= 0) { if (this.auto) { if (wheelRpm > Math.min(c.hpRpm * 1.04, c.redline * 0.92) && this.gear < c.gears.length) { this.gear++; this.shift = c.shiftT ?? 0.5; } else if (this.gear > 1 && wheelRpm * c.gears[this.gear - 2]! / c.gears[this.gear - 1]! < c.hpRpm * 0.8) { this.gear--; this.shift = c.shiftT ?? 0.5; } }   // down only when the lower gear has room
      else if (u.gear && u.gear !== this.gear) { this.gear = Math.max(1, Math.min(c.gears.length, u.gear)); this.shift = c.shiftT ?? 0.5; } }
    const Gr = c.gears[this.gear - 1]! * c.final, we = this.rpm * Math.PI / 30, wd = (this.w[2]! + this.w[3]!) / 2, idle = c.idle * Math.PI / 30;
    const thr = this.shift > 0 ? 0 : Math.max(0, Math.min(1, u.throttle)) * (this.auto && this.rpm > c.redline * 0.98 ? 0.25 : 1),   // off the throttle through a change; the automatic also eases off past the red line (a spinning wheel)
     fric = 0.06 * torqueAt(c, c.torqueRpm) * (0.3 + 0.7 * this.rpm / c.hpRpm);
    const hp = this.health.power, alive = this.health.running;
    const Te = alive ? (this.rpm < c.redline * 1.1 ? thr * torqueAt(c, this.rpm) * hp : 0) - fric * (1 - thr) + (this.rpm < c.idle ? fric * 2 : 0) : -fric * 3 - (this.rpm > 1 ? 30 : 0);   // below idle the hand throttle holds it; a dead engine only drags
    // the clutch: a driver's foot (or the automatic, which lets it in as the engine picks up from rest)
    const auto = this.shift > 0 ? 0 : Math.max(0, Math.min(1, wd * Gr > we * 0.97 ? 1 : (c.launchRpm ? (this.rpm - c.launchRpm * 0.8) / (c.launchRpm * 0.2) : (this.rpm - c.idle * 1.3) / (c.idle * 1.2))));   // a racing driver holds the revs up near launchRpm and slips the clutch away
    const engaged = u.clutch === undefined ? auto : Math.min(auto, 1 - u.clutch), cap = engaged * torqueAt(c, c.torqueRpm) * 2.2;
    const need = (we - wd * Gr) / (dt * (1 / this.Ie + Gr * Gr / (2 * this.Iw)));   // what would hold the clutch locked this step
    const Tc = Math.max(-cap, Math.min(cap, need));
    this.rpm = Math.max(alive ? idle * 0.5 : 0, we + (Te - Tc) / this.Ie * dt) * 30 / Math.PI;
    { const f = this.health.step(dt, this.rpm, c.redline, Math.max(0, Te) * this.rpm * Math.PI / 30, this.speed); if (f) this.lastFailure = f; }
    const Taxle = Tc * Gr * c.eff;
    // ---- tyres ----
    const Fx = [0, 0, 0, 0], Fy = [0, 0, 0, 0], brakeCap = c.brakeG * m * G * R, ty = this.tyre;
    for (let i = 0; i < 4; i++) { const [px, py] = this.wheelAt(i), st = this.steerAt(i);
      const vwx = this.vx - this.r * py, vwy = this.vy + this.r * px, cs = Math.cos(st), sn = Math.sin(st), lx = vwx * cs + vwy * sn, ly = -vwx * sn + vwy * cs;
      const v0 = Math.max(Math.abs(lx), 3), kappa = (this.w[i]! * R - lx) / v0, alpha = Math.atan2(ly, v0); this.slipX[i] = kappa; this.slipA[i] = alpha;
      const Fz = F[i]!, mu = ty.mu * (1 - ty.loadSens * (Fz / (m * G / 4) - 1)) * (this.onGrass[i] ? 0.55 : 1);   // grass: little grip
      const sx = kappa / ty.peakSlip, sa = Math.tan(alpha) / ty.peakAngle, sig = Math.hypot(sx, sa);
      let fx = 0, fy = 0; if (sig > 1e-9 && Fz > 0) { const Bs = ty.B * sig, f = Math.sin(ty.C * Math.atan(Bs - ty.E * (Bs - Math.atan(Bs)))); fx = mu * Fz * f * sx / sig; fy = -mu * Fz * f * sa / sig; }
      const rear = i >= 2, disc = c.brakes === 'disc', fade = 1 / (1 + Math.max(0, this.brakeT[i]! - (disc ? 550 : 250)) / (disc ? 400 : 200));   // drums fade from about 250 degrees; discs (open to the air, the pad's heat not swelling a drum away from its shoes) hold on far longer
      const bt = (u.brake * (c.brakes === 'rear' ? (rear ? 0.5 : 0) : rear ? 0.42 : 0.58) * brakeCap + (rear ? (u.handbrake ?? 0) * brakeCap * 0.35 : 0)) * fade;
      // the wheel's spin, stepped half-implicitly: the tyre pushes back harder the faster the wheel slips, too stiffly at
      // low speed for a plain step (it would ring), so its stiffness joins the wheel's inertia
      const K = mu * Fz * ty.C * ty.B / ty.peakSlip * R * R / v0;
      const w0 = this.w[i]!, wf = w0 + ((rear ? Taxle / 2 : 0) - fx * R - Fz * (this.onGrass[i] ? 0.07 : c.crr) * R * Math.tanh(w0) + K * this.dw[i]! * dt) / (this.Iw + K * dt) * dt, bs = bt / (this.Iw + K * dt) * dt;
      this.w[i] = Math.abs(wf) <= bs ? 0 : wf - Math.sign(wf) * bs; this.dw[i] = bs > 0 || this.airborne[i] ? 0 : (this.w[i]! - w0) / dt;                // brakes stop a wheel, never turn it back
      this.brakeT[i] = this.brakeT[i]! + (bt * Math.abs(this.w[i]!) / 9000 - (this.brakeT[i]! - 20) * (0.004 + this.speed * 0.0004) * (disc ? 2.2 : 1)) * dt;
      Fx[i] = fx * cs - fy * sn; Fy[i] = fx * sn + fy * cs; }
    // ---- the whole car: tyres, the air, gravity down the slope; turning ----
    const v = this.speed, drag = 0.5 * RHO * c.cdA * v * v;
    let sx = -drag * (v > 0 ? this.vx / v : 0) - G * m * Math.sin(tX), sy2 = -drag * (v > 0 ? this.vy / v : 0) - G * m * Math.sin(tY), Mz = 0;
    for (let i = 0; i < 4; i++) { const [px, py] = this.wheelAt(i); sx += Fx[i]!; sy2 += Fy[i]!; Mz += px * Fy[i]! - py * Fx[i]!; }
    this.ax = sx / m; this.ay = sy2 / m; this.tax = this.ax + G * Math.sin(tX); this.tay = this.ay + G * Math.sin(tY);   // tax, tay: what the tyres and air do (they pitch and roll the body)
    this.vx += (this.ax + this.r * this.vy) * dt; this.vy += (this.ay - this.r * this.vx) * dt; this.r += Mz / this.Iz * dt;
    if (v < 0.5 && thr < 0.05) { const k = Math.exp(-dt * 6); this.vx *= k; this.vy *= k; this.r *= k; }   // at a standstill it stays put
    this.yaw += this.r * dt; this.x += (this.vx * Math.cos(this.yaw) - this.vy * Math.sin(this.yaw)) * dt; this.y += (this.vx * Math.sin(this.yaw) + this.vy * Math.cos(this.yaw)) * dt; }
}
