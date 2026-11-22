// A driver for the track (review 84): the opponents' hands, and the physics tests' test driver. It keeps to a line
// across the track worked out once for its car (up the banking to where the slope holds the car at the speed it will
// carry there, eased in and out over a long stretch), looks ahead for the speed each stretch allows and brakes in
// time, and steers by pure pursuit. It drives by the same controls as the player: no help from the physics.
import type { Track } from './track';
import type { Vehicle, Controls } from './vehicle';
const G = 9.81, OFFS = Array.from({ length: 49 }, (_, i) => -12 + i * 0.5);   // heights across the bank it may choose from
export class Driver {
  private line: Float32Array | null = null; private vlim: Float32Array | null = null; private tilt: Float32Array[] = []; private off = 0; private lift = 0;
  /** dare: the share of the tyres' grip it will use; plannedBrake: the deceleration it plans its braking with (m/s²) */
  constructor(readonly track: Track, public dare = 0.7, public plannedBrake = 3.0) {}
  private prepare(car: Vehicle): void { const T = this.track, L = T.length, W = T.spec.width, vTop = car.spec.topKmh / 3.6, mu = car.tyre.mu * this.dare;
    const raw = new Float32Array(L), lim = new Float32Array(L);
    for (let s = 0; s < L; s++) { const n = T.at(s), k = Math.abs(n.k), side = n.k >= 0 ? 1 : -1;   // side: the inside of this bend (+1 left); a bank rising the other way is adverse camber   // side: +1 the inside is to the left
      // the fastest through here at each height on the bank, and where the bank itself carries the car at that speed
      // the fastest it can go at each height on the bank; then it runs where the bank alone would carry it at that speed
      const at = (o: number) => { const th = Math.atan(-side * T.slope(s, o).across), den = k * (Math.cos(th) - mu * Math.sin(th)); return { th, v: Math.min(vTop, k < 1e-5 || den <= 0 ? vTop : Math.sqrt(G * (Math.sin(th) + mu * Math.cos(th)) / den)) }; };
      let vMax = 0; for (let o = -W / 2 + 3; o <= W / 2 - 3; o += 0.5) vMax = Math.max(vMax, at(o).v);
      let best = 0, bd = Infinity; if (k > 1e-5) for (let o = -W / 2 + 3; o <= W / 2 - 3; o += 0.5) { const d = Math.abs(vMax * vMax * k - G * Math.tan(at(o).th)) + (at(o).v < vMax * 0.98 ? 1e3 : 0); if (d < bd) { bd = d; best = o; } }
      lim[s] = vMax; raw[s] = T.bankAt(s).b ? best : 0;
      if (s % 5 === 0) { const row = new Float32Array(OFFS.length); OFFS.forEach((o, j) => { row[j] = Math.max(0, -side * T.slope(s, o).across); }); this.tilt[s / 5] = row; } }
    const sm = new Float32Array(L), h = 120; for (let s = 0; s < L; s++) { let a = 0; for (let j = -h; j <= h; j += 4) a += raw[(s + j + L) % L]!; sm[s] = a / (2 * h / 4 + 1); }
    this.line = sm; this.vlim = lim; }
  lineAt(s: number): number { const L = this.track.length; return this.line ? this.line[Math.floor(((s % L) + L) % L)]! : 0; }
  drive(car: Vehicle): Controls {
    if (!this.line) this.prepare(car); const T = this.track, L = T.length, v = car.speed, lim = this.vlim!;
    let target = 200; for (let d = 0; d <= 400; d += 8) { const vl = lim[Math.floor(((car.s + d) % L + L) % L)]!; target = Math.min(target, Math.sqrt(vl * vl + 2 * this.plannedBrake * d)); }
    // how high on the bank: where the slope carries the speed it will have there, moved toward gently
    const Ld = 8 + v * 0.45, s2 = car.s + Ld, vp = Math.min(v, target);
    // the height it wants here and over the next stretch: it climbs before the banking, not on it
    const wantAt = (sq: number) => { const i = Math.floor((((sq % L) + L) % L) / 5) % this.tilt.length, row = this.tilt[i]!, kk = Math.abs(T.at(sq).k), bk = T.bankAt(sq); if (!bk.b || kk < 1e-5) return 0;
      let w = 0, bd = Infinity; OFFS.forEach((o, j) => { const d = Math.abs(vp * vp * kk - G * row[j]!); if (d < bd) { bd = d; w = o; } }); return w * bk.f; };
    let want = 0; for (let d = 0; d <= v * 5 + 60; d += 10) { const w = wantAt(car.s + d); if (Math.abs(w) > Math.abs(want)) want = w; }
    const step = 2.5 / 240; this.off += Math.max(-step, Math.min(step, want - this.off));   // across at 2.5 m/s at most (a call a physics step)
    const p = T.point(s2, this.off);
    const dx = p.x - car.x, dy = p.y - car.y, a = Math.atan2(dy, dx) - car.yaw, al = Math.atan2(Math.sin(a), Math.cos(a));
    // pure pursuit; and when the tail swings out faster than the line turns, it steers into the slide
    const over = car.r - v * T.at(car.s).k, catchSlide = Math.abs(over) > 0.12 && Math.sign(over) === Math.sign(-car.vy) ? Math.atan2(car.vy, Math.max(5, car.vx)) * 0.9 : 0;
    const delta = Math.atan(2 * car.spec.wheelbase * Math.sin(al) / Math.hypot(dx, dy)) + catchSlide, lock = car.spec.steerLock * Math.PI / 180 / (1 + v / 25);   // and it steers into a slide
    // a feel for the rear wheels: when they spin it eases off, and builds up again
    const spin = Math.max(car.slipX[2]!, car.slipX[3]!); const slide = Math.abs(Math.atan2(car.vy, Math.max(3, car.vx)));
    this.lift = Math.max(0, Math.min(0.95, this.lift + (spin > 0.14 || slide > 0.12 ? 0.3 : -0.015)));
    const e = target - v; return { steer: Math.max(-1, Math.min(1, delta / lock)), throttle: e > 0 ? Math.min(1, e / 3) * (1 - this.lift) : 0, brake: e < -0.5 ? Math.min(1, -e / 3) : 0 }; }
}
