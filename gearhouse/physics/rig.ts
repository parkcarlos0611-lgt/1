// A side-view running-gear simulation for a car of the 1920s-40s (review 24, a technology check).
// Built after two references: the sister project Desert Steel (2D rigid hull on sprung stations, wheel circles on a
// heightfield, fixed small time step) and BeamNG.drive (tyres as rings of mass points held to the hub by springs and
// air pressure, so they squash and bounce on their own). Units are SI; x forward, y up.
//
//   sprung body        x, y, pitch and roll (rigid; its picture is squashed a little by a visual spring, see jiggle)
//   two beam axles     heave and roll each, located fore and aft by the body (leaf springs locate a beam axle)
//   four leaf springs  spring rate, interleaf friction, rebound strap, bump rubber; a telescopic damper beside each
//   four tyres         a ring of N mass points: radial, ring and cross springs, internal pressure, ground contact
//                      with friction; drive torque goes in as forces round the ring
//   ground             two height profiles, near and far track, so one wheel can climb a bump the other misses
//
// Two planes (near, far) are what makes four wheels show in a side view: the far wheels ride their own profile and
// roll the body and axles.

export interface RigSpec {
  bodyMass: number; pitchInertia: number; rollInertia: number;
  axleMass: number; axleRollInertia: number;
  /** axle positions from the body's centre of mass along the car (front positive) and the CoM height at rest */
  axleX: [number, number]; comH: number;
  wheelR: number; halfTrack: number; halfSpringTrack: number;
  spring: { k: [number, number]; c: [number, number]; friction: number; bump: number; rebound: number };
  tyre: { nodes: number; mass: number; radialK: number; radialC: number; ringK: number; crossK: number; pressure: number; groundK: number; groundC: number; mu: number };
  maxTorque: number;
}
/** a 1948 four-wheel-drive utility: 80 in wheelbase, 6.00-16 tyres, about 1.3 t */
export const UTILITY48: RigSpec = {
  bodyMass: 1050, pitchInertia: 1350, rollInertia: 380, axleMass: 85, axleRollInertia: 34,
  axleX: [1.02, -1.012], comH: 0.78, wheelR: 0.365, halfTrack: 0.64, halfSpringTrack: 0.44,
  spring: { k: [42000, 48000], c: [2600, 2900], friction: 260, bump: 0.085, rebound: 0.09 },
  tyre: { nodes: 18, mass: 0.75, radialK: 22000, radialC: 25, ringK: 2.5e6, crossK: 30000, pressure: 1.8e5 * 0.16, groundK: 160000, groundC: 260, mu: 0.95 },
  maxTorque: 1600,
};

type V2 = { x: number; y: number };
export interface Tyre { side: 1 | -1; axle: 0 | 1; p: V2[]; v: V2[]; hub: V2; angle: number; contact: number }
export interface Ground { near: (x: number) => number; far: (x: number) => number }

export class Rig {
  s: RigSpec; g: Ground; t = 0;
  // body
  x: number; y: number; vx = 0; vy = 0; th = 0; w = 0; ph = 0; wph = 0;
  // axles: heave (world y of the axle centre) and roll
  ay: [number, number]; avy: [number, number] = [0, 0]; aph: [number, number] = [0, 0]; awph: [number, number] = [0, 0];
  tyres: Tyre[] = [];
  throttle = 0; brake = 0;
  /** spring deflection from rest per corner [axle][near, far] (m, + compressed), for the drawing */
  defl: number[][] = [[0, 0], [0, 0]];
  /** a visual squash of the body picture driven by its vertical acceleration (see review 24: elastic, not rotated) */
  jig = 0; jv = 0; private lastVy = 0;
  private F0: number[];

  constructor(spec: RigSpec, ground: Ground, x: number) {
    this.s = spec; this.g = ground; this.x = x;
    const h0 = Math.max(ground.near(x), ground.far(x));
    this.y = h0 + spec.comH; this.ay = [h0 + spec.wheelR, h0 + spec.wheelR];
    const share = [-spec.axleX[1] / (spec.axleX[0] - spec.axleX[1]), spec.axleX[0] / (spec.axleX[0] - spec.axleX[1])];
    this.F0 = share.map(f => spec.bodyMass * 9.81 * f / 2);                      // static load per spring
    for (const axle of [0, 1] as const) for (const side of [1, -1] as const) {
      const N = spec.tyre.nodes, p: V2[] = [], v: V2[] = [], hub = this.hub(axle, side);
      for (let k = 0; k < N; k++) { const a = Math.PI / 2 - k / N * Math.PI * 2; p.push({ x: hub.x + Math.cos(a) * spec.wheelR, y: hub.y + Math.sin(a) * spec.wheelR }); v.push({ x: 0, y: 0 }); }
      this.tyres.push({ side, axle, p, v, hub, angle: 0, contact: 0 });
    }
  }
  /** world position of an axle's hub on one side */
  hub(axle: 0 | 1, side: 1 | -1): V2 { const s = this.s; return { x: this.x + s.axleX[axle] * Math.cos(this.th), y: this.ay[axle] + side * s.halfTrack * this.aph[axle] }; }
  /** world height of the body at a point along it and across it (pitch and roll, small angles) */
  bodyY(lx: number, side: number, ly = 0) { return this.y + lx * Math.sin(this.th) + ly * Math.cos(this.th) + side * this.s.halfSpringTrack * this.ph; }

  step(dt: number) {
    const s = this.s, T = s.tyre, N = T.nodes;
    let Fbx = 0, Fby = -s.bodyMass * 9.81, Mb = 0, Mbr = 0;
    const Fa = [-s.axleMass * 9.81, -s.axleMass * 9.81], Ma = [0, 0];
    // ---- leaf springs and dampers, one per corner ----
    for (const axle of [0, 1] as const) for (const side of [1, -1] as const) {
      const lx = s.axleX[axle], yb = this.bodyY(lx, side) - this.y, ya = this.ay[axle] + side * s.halfSpringTrack * this.aph[axle];
      const restGap = s.comH - s.wheelR, d = restGap - ((this.y + yb) - ya);                 // compression from rest (+)
      const vb = this.vy + lx * this.w * Math.cos(this.th) + side * s.halfSpringTrack * this.wph, va = this.avy[axle] + side * s.halfSpringTrack * this.awph[axle], vd = va - vb;
      let F = this.F0[axle]! + s.spring.k[axle] * d + s.spring.c[axle] * vd + s.spring.friction * Math.tanh(vd / 0.01);
      if (d > s.spring.bump) F += 6e5 * (d - s.spring.bump) + 4e3 * Math.max(0, vd);           // bump rubber
      if (d < -s.spring.rebound) F -= 8e5 * (-s.spring.rebound - d);                         // rebound strap
      this.defl[axle]![side > 0 ? 0 : 1] = d;
      Fby += F; Mb += F * lx * Math.cos(this.th); Mbr += F * side * s.halfSpringTrack;
      Fa[axle] = Fa[axle]! - F; Ma[axle] = Ma[axle]! - F * side * s.halfSpringTrack;
    }
    // ---- tyres: rings of mass points ----
    const drive = this.throttle * s.maxTorque / 4;
    for (const ty of this.tyres) {
      const h = this.hub(ty.axle, ty.side); ty.hub = h;
      const hv = { x: this.vx, y: this.avy[ty.axle] + ty.side * s.halfTrack * this.awph[ty.axle] };
      const f: V2[] = ty.p.map(() => ({ x: 0, y: -T.mass * 9.81 }));
      let hx = 0, hy = 0, area = 0;
      for (let k = 0; k < N; k++) { const a = ty.p[k]!, b = ty.p[(k + 1) % N]!; area += (a.x - h.x) * (b.y - h.y) - (b.x - h.x) * (a.y - h.y); }
      area = Math.abs(area) / 2; const A0 = Math.PI * s.wheelR * s.wheelR * Math.sin(Math.PI * 2 / N) / (Math.PI * 2 / N), P = T.pressure * (A0 / Math.max(area, A0 * 0.5));
      ty.contact = 0;
      for (let k = 0; k < N; k++) {
        const p = ty.p[k]!, v = ty.v[k]!, dx = p.x - h.x, dy = p.y - h.y, L = Math.hypot(dx, dy) || 1e-6, ux = dx / L, uy = dy / L;
        // radial spring to the hub, damped along the spoke
        const vr = (v.x - hv.x) * ux + (v.y - hv.y) * uy, Fr = -T.radialK * (L - s.wheelR) - T.radialC * vr;
        f[k]!.x += ux * Fr; f[k]!.y += uy * Fr; hx -= ux * Fr; hy -= uy * Fr;
        // ring and cross springs keep the tread's shape
        for (const [j, K] of [[(k + 1) % N, T.ringK], [(k + 2) % N, T.crossK]] as const) {
          const q = ty.p[j]!, ex = q.x - p.x, ey = q.y - p.y, l = Math.hypot(ex, ey) || 1e-6, r0 = 2 * s.wheelR * Math.sin(Math.PI * (j === (k + 1) % N ? 1 : 2) / N);
          const rv = ((ty.v[j]!.x - v.x) * ex + (ty.v[j]!.y - v.y) * ey) / l, Fs = K * (l - r0) + (K > 1e5 ? 60 : 8) * rv;
          f[k]!.x += ex / l * Fs; f[k]!.y += ey / l * Fs; f[j]!.x -= ex / l * Fs; f[j]!.y -= ey / l * Fs;
        }
        // air pressure pushes each piece of the ring outward
        const q = ty.p[(k + 1) % N]!, sx = q.x - p.x, sy = q.y - p.y, nx = -sy, ny = sx, Fp = P;            // normal of the segment, outward for a clockwise ring
        f[k]!.x += nx * Fp / 2; f[k]!.y += ny * Fp / 2; f[(k + 1) % N]!.x += nx * Fp / 2; f[(k + 1) % N]!.y += ny * Fp / 2; hx -= nx * Fp; hy -= ny * Fp;
        // drive: a turning force round the ring (clockwise drives the car forward), its reaction on the axle housing
        const tx = uy, tyy = -ux, Fd = drive / (N * s.wheelR); f[k]!.x += tx * Fd; f[k]!.y += tyy * Fd;
        // the ground
        const gy = ty.side > 0 ? this.g.near(p.x) : this.g.far(p.x);
        if (p.y < gy) {
          const pen = gy - p.y, sl = ((ty.side > 0 ? this.g.near(p.x + 0.02) : this.g.far(p.x + 0.02)) - gy) / 0.02, nl = Math.hypot(1, sl), gnx = -sl / nl, gny = 1 / nl;
          const vn = v.x * gnx + v.y * gny, Fn = Math.max(0, T.groundK * pen - T.groundC * vn), vt = v.x * gny - v.y * gnx;
          const Ft = -Math.min(T.mu * Fn, Math.abs(vt) * 4000) * Math.sign(vt) - this.brake * T.mu * Fn * Math.tanh(vt / 0.05);
          f[k]!.x += gnx * Fn + gny * Ft; f[k]!.y += gny * Fn - gnx * Ft; ty.contact++;
        }
      }
      for (let k = 0; k < N; k++) { const v = ty.v[k]!, p = ty.p[k]!; v.x += f[k]!.x / T.mass * dt; v.y += f[k]!.y / T.mass * dt; p.x += v.x * dt; p.y += v.y * dt; }
      // the tyre's reaction on its hub: vertical goes to the axle, along the car to the body
      Fbx += hx; Fa[ty.axle] = Fa[ty.axle]! + hy; Ma[ty.axle] = Ma[ty.axle]! + hy * ty.side * s.halfTrack;
      Mb += drive * 0.15;                                                                     // axle wind-up felt through the springs: the nose lifts
      // the wheel's turn, for its drawing: the mean speed of the ring round the hub
      let om = 0; for (let k = 0; k < N; k++) { const p = ty.p[k]!, v = ty.v[k]!, dx = p.x - h.x, dy = p.y - h.y; om += (dx * (v.y - hv.y) - dy * (v.x - hv.x)) / (dx * dx + dy * dy); }
      ty.angle += om / N * dt;
    }
    // ---- integrate the rigid parts ----
    this.vx += Fbx / (s.bodyMass + 2 * s.axleMass) * dt; this.x += this.vx * dt;
    this.vy += Fby / s.bodyMass * dt; this.y += this.vy * dt;
    this.w += Mb / s.pitchInertia * dt; this.th += this.w * dt;
    this.wph += Mbr / s.rollInertia * dt; this.ph += this.wph * dt;
    for (const i of [0, 1] as const) { this.avy[i] += Fa[i]! / s.axleMass * dt; this.ay[i] += this.avy[i] * dt; this.awph[i] += Ma[i]! / s.axleRollInertia * dt; this.aph[i] += this.awph[i] * dt; }
    // ---- the picture's squash: a stiff visual spring pushed by the body's vertical acceleration ----
    const acc = (this.vy - this.lastVy) / dt; this.lastVy = this.vy;
    this.jv += (-900 * this.jig - 28 * this.jv - acc * 1.6) * dt; this.jig += this.jv * dt;
    this.t += dt;
  }
  run(seconds: number, dt = 1 / 4000) { const n = Math.round(seconds / dt); for (let i = 0; i < n; i++) this.step(dt); }
}
