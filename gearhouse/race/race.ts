// A handicap race at Millbrook (review 86, step 5), as the track ran them: the slowest car (the limit) starts first,
// the fastest (scratch) last, each held back by the difference in the handicapper's estimate of their times, so that
// on the book they all reach the line together. The cars race by the same physics; the opponents are driven by the
// test driver (no help), they touch and push each other, and a car that stops off the concrete rejoins.
import book from './handicaps.json';
import { raceSpec } from './cars';
import { Vehicle, type Controls } from './vehicle';
import { Driver } from './driver';
import type { Track } from './track';

export interface Entrant { id: string; name: string; car: Vehicle; driver: Driver | null; start: number; laps: number; lapAt: number[]; finish: number; dist: number; prevS: number; stuck: number; wheelTurn: number; grid: number }
const BOOK = (book as { cars: Record<string, { standing: number; flying: number }> }).cars;
/** a car's time for the race on the book: a standing lap, then flying ones */
export const bookTime = (id: string, laps: number) => { const b = BOOK[id] ?? { standing: 200, flying: 190 }; return b.standing + (laps - 1) * b.flying; };

export class Race {
  readonly cars: Entrant[] = []; clock = -5; done = false; readonly startS: number; readonly limitTime: number;
  /** mode: 'handicap' (the limit first, scratch last, by the book) or 'scratch' (all at once from a grid in pairs, the slowest at the front) */
  constructor(readonly track: Track, ids: string[], readonly laps: number, player: string | null, seed = 1, readonly mode: 'handicap' | 'scratch' = 'handicap') {
    this.startS = track.spec.landmarks.find(l => l.kind === 'line')!.s;
    this.limitTime = Math.max(...ids.map(id => bookTime(id, laps)));
    // across the line, each in its own place; the start each is given
    let r = seed; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    const order = mode === 'scratch' ? [...ids].sort((a, b) => bookTime(b, laps) - bookTime(a, laps)) : ids;   // scratch: the slowest on the front row
    ids.forEach((id, k) => { const spec = raceSpec(id), car = new Vehicle(spec, track), at = order.indexOf(id);
      const grid = mode === 'scratch' ? (at % 2 ? 5 : -5) : -10 + k * (20 / Math.max(1, ids.length - 1)), back = mode === 'scratch' ? 6 + Math.floor(at / 2) * 9 : 6;
      car.place(this.startS - back, grid, 0);
      this.cars.push({ id, name: spec.name, car, driver: id === player ? null : new Driver(track, 0.64 + rnd() * 0.08, 3.0, 0.9 + rnd() * 0.1), start: mode === 'scratch' ? 0 : this.limitTime - bookTime(id, laps), laps: 0, lapAt: [], finish: 0, dist: 0, prevS: car.s, stuck: 0, wheelTurn: 0, grid }); }); }
  get player(): Entrant | undefined { return this.cars.find(c => !c.driver); }
  /** the order: finished by time, then by distance run */
  order(): Entrant[] { return [...this.cars].sort((a, b) => (a.finish && b.finish ? a.finish - b.finish : a.finish ? -1 : b.finish ? 1 : b.dist - a.dist)); }
  step(dt: number, playerControls: Controls): void {
    const T = this.track, L = T.length; this.clock += dt;
    for (const e of this.cars) { const c = e.car, waiting = this.clock < e.start, finished = e.finish > 0;
      let u: Controls = waiting ? { throttle: 0, brake: 1, steer: 0 } : e.driver ? e.driver.drive(c) : playerControls;
      if (finished && e.driver) u = { ...u, throttle: Math.min(u.throttle, 0.3) };   // a slowing-down lap
      if (e.driver && !waiting) u = { ...u, steer: Math.max(-1, Math.min(1, u.steer + this.avoid(e))) };
      c.step(dt, u); e.wheelTurn += (c.w[0]! + c.w[1]!) / 2 * dt;
      // distance and laps: forward over the line
      const d = T.gap(e.prevS, c.s); e.dist += d; if (!waiting && T.gap(e.prevS, this.startS) > 0 && T.gap(c.s, this.startS) <= 0 && c.vx > 1) { e.lapAt.push(this.clock); if (e.lapAt.length > this.laps && !e.finish) e.finish = this.clock; }
      e.prevS = c.s;
      // over the top, or stopped off the concrete: back on the track (an opponent after a moment, as its crew would push it)
      if (c.over) { c.over = false; c.place(c.s, 0, 0); }
      if (e.driver && !waiting) { e.stuck = (c.speed < 2 || Math.abs(c.off) > T.spec.width / 2 + 1) ? e.stuck + dt : 0; if (e.stuck > 3) { c.place(c.s, 0, 0); e.stuck = 0; } } }
    this.collide(); void L;
    this.done = this.cars.every(e => e.finish > 0) || (!!this.player?.finish && this.clock > this.player.finish + 45); }
  /** an opponent with a car close ahead on its line moves out to pass, higher up a banking */
  private avoid(e: Entrant): number { const c = e.car, T = this.track; let push = 0;
    for (const o of this.cars) { if (o === e) continue; const ahead = T.gap(c.s, o.car.s), side = o.car.off - c.off; if (ahead > 0 && ahead < 25 && Math.abs(side) < 3.2) push += (side > 0 ? -1 : 1) * 0.06 * (1 - ahead / 25); }
    return push; }
  /** cars touching: each car two circles along its length; overlapping pairs are pushed apart and their speeds traded along the push */
  private collide(): void { const R = 0.9;
    for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) { const a = this.cars[i]!.car, b = this.cars[j]!.car;
      if (Math.hypot(a.x - b.x, a.y - b.y) > 8) continue;
      const pts = (c: Vehicle) => { const h = c.spec.wheelbase / 2; return [-h, h].map(k => [c.x + Math.cos(c.yaw) * k, c.y + Math.sin(c.yaw) * k] as const); };
      for (const pa of pts(a)) for (const pb of pts(b)) { const dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy); if (d >= 2 * R || d < 1e-6) continue;
        const nx = dx / d, ny = dy / d, over = 2 * R - d, ma = a.spec.mass, mb = b.spec.mass;
        a.x -= nx * over * mb / (ma + mb); a.y -= ny * over * mb / (ma + mb); b.x += nx * over * ma / (ma + mb); b.y += ny * over * ma / (ma + mb);
        const va = world(a), vb = world(b), rel = (vb[0] - va[0]) * nx + (vb[1] - va[1]) * ny; if (rel >= 0) continue;
        const J = -(1 + 0.25) * rel / (1 / ma + 1 / mb); setWorld(a, va[0] - J / ma * nx, va[1] - J / ma * ny); setWorld(b, vb[0] + J / mb * nx, vb[1] + J / mb * ny);
        a.r += (Math.random() - 0.5) * J / ma * 0.3; b.r += (Math.random() - 0.5) * J / mb * 0.3; } } }   // a knock turns a car a little
}
const world = (c: Vehicle): [number, number] => [c.vx * Math.cos(c.yaw) - c.vy * Math.sin(c.yaw), c.vx * Math.sin(c.yaw) + c.vy * Math.cos(c.yaw)];
const setWorld = (c: Vehicle, wx: number, wy: number) => { c.vx = wx * Math.cos(c.yaw) + wy * Math.sin(c.yaw); c.vy = -wx * Math.sin(c.yaw) + wy * Math.cos(c.yaw); };
