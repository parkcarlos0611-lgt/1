// A handicap race at Millbrook (review 86, step 5), as the track ran them: the slowest car (the limit) starts first,
// the fastest (scratch) last, each held back by the difference in the handicapper's estimate of their times, so that
// on the book they all reach the line together. The cars race by the same physics; the opponents are driven by the
// test driver (no help), they touch and push each other, and a car that stops off the concrete rejoins.
import book from './handicaps.json';
import { raceSpec } from './cars';
import { Vehicle, type Controls } from './vehicle';
import { Driver } from './driver';
import type { Track } from './track';

/** trail: [clock, dist] pairs every tenth of a second from its start, for the gaps in time between cars */
export interface Entrant { id: string; name: string; car: Vehicle; driver: Driver | null; start: number; laps: number; lapAt: number[]; finish: number; dist: number; prevS: number; stuck: number; wheelTurn: number; grid: number; trail: number[] }
type Book = Record<string, { standing: number; flying: number }>;
/** the handicapper's books, one per track (by the track's id; Millbrook's the first) */
const BOOKS = (book as unknown as { tracks: Record<string, { cars: Book }> }).tracks;
export const bookFor = (track = 'millbrook'): Book | null => BOOKS[track]?.cars ?? null;
/** a car's time for the race on the book: a standing lap, then flying ones */
export const bookTime = (id: string, laps: number, track = 'millbrook') => { const b = bookFor(track)?.[id] ?? { standing: 200, flying: 190 }; return b.standing + (laps - 1) * b.flying; };
/** the opponents' skill: the share of grip they dare use and how hard they press on (each a range, drawn per car);
 *  'normal' is the field as it always was; the book is timed at dare 0.7 and full pace, about 'hard' */
export type Skill = 'easy' | 'normal' | 'hard';
export const SKILL: Record<Skill, { dare: [number, number]; pace: [number, number] }> = {
  easy: { dare: [0.56, 0.62], pace: [0.8, 0.88] }, normal: { dare: [0.64, 0.72], pace: [0.9, 1] }, hard: { dare: [0.69, 0.73], pace: [0.98, 1] } };
/** an entrant's lap times: the first from its own start (a standing lap), then line to line */
export const lapTimes = (e: Pick<Entrant, 'lapAt' | 'start'>): number[] => e.lapAt.slice(1).map((t, i) => t - (i === 0 ? e.start : e.lapAt[i]!));
/** its best lap (0 before one is done) */
export const bestOf = (laps: number[]): number => laps.length ? Math.min(...laps) : 0;
/** when an entrant had run `d` metres (by its trail, interpolated); NaN if it has not run that far */
export function timeAt(e: Pick<Entrant, 'trail'>, d: number): number { const T = e.trail, n = T.length / 2; if (!n || d > T[T.length - 1]!) return NaN; if (d <= T[1]!) return T[0]!;
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m * 2 + 1]! < d) lo = m; else hi = m; }
  const t0 = T[lo * 2]!, d0 = T[lo * 2 + 1]!, t1 = T[hi * 2]!, d1 = T[hi * 2 + 1]!; return d1 > d0 ? t0 + (t1 - t0) * (d - d0) / (d1 - d0) : t1; }
/** how far `b` trails `a` (a ahead): in seconds (the time since a passed where b is now), or whole laps when a lap or more behind */
export function gapBetween(a: Pick<Entrant, 'trail' | 'dist' | 'finish'>, b: Pick<Entrant, 'trail' | 'dist' | 'finish'>, clock: number, L: number): { s: number; laps: number } {
  if (a.finish && b.finish) return { s: b.finish - a.finish, laps: 0 };
  const laps = Math.floor((a.dist - b.dist) / L); if (laps >= 1) return { s: NaN, laps };
  const t = timeAt(a, b.dist); return { s: Number.isFinite(t) ? Math.max(0, (b.finish || clock) - t) : 0, laps: 0 }; }

export class Race {
  readonly cars: Entrant[] = []; clock = -5; done = false; readonly startS: number; readonly limitTime: number;
  /** mode: 'handicap' (the limit first, scratch last, by the book) or 'scratch' (all at once from a grid in pairs, the slowest at the front);
   *  drivers: an opponent's own dare and pace (a one-make field's, race/onemake.ts), else drawn from the skill's range */
  constructor(readonly track: Track, ids: string[], readonly laps: number, player: string | null, seed = 1, readonly mode: 'handicap' | 'scratch' = 'handicap', skill: Skill = 'normal', drivers: Record<string, { dare: number; pace: number }> = {}) {
    this.startS = track.spec.landmarks.find(l => l.kind === 'line')!.s; const tk = track.spec.id ?? 'millbrook', bt = (id: string) => bookTime(id, laps, tk);
    this.limitTime = Math.max(...ids.map(bt));
    // across the line, each in its own place; the start each is given
    let r = seed; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    const order = mode === 'scratch' ? [...ids].sort((a, b) => bt(b) - bt(a)) : ids, K = SKILL[skill], pick = ([a, b]: [number, number]) => a + rnd() * (b - a);   // scratch: the slowest on the front row
    ids.forEach((id, k) => { const spec = raceSpec(id), car = new Vehicle(spec, track), at = order.indexOf(id);
      const grid = mode === 'scratch' ? (at % 2 ? 5 : -5) : -10 + k * (20 / Math.max(1, ids.length - 1)), back = mode === 'scratch' ? 6 + Math.floor(at / 2) * 9 : 6;
      car.place(this.startS - back, grid, 0);
      const driver = id === player ? null : (() => { const dare = pick(K.dare), pace = pick(K.pace), own = drivers[id]; return new Driver(track, own?.dare ?? dare, 3.0, own?.pace ?? pace); })();   // the draws in this order: 'normal' gives the field it always did
      this.cars.push({ id, name: spec.name, car, driver, start: mode === 'scratch' ? 0 : this.limitTime - bt(id), laps: 0, lapAt: [], finish: 0, dist: -back, prevS: car.s, stuck: 0, wheelTurn: 0, grid, trail: [] }); }); }   /* dist from the line: a back row starts behind it */
  get player(): Entrant | undefined { return this.cars.find(c => !c.driver); }
  /** the standings: each car in order, its lap (the one it is on, or done), its gap to the leader and to the car ahead */
  standings(): { e: Entrant; pos: number; lap: number; leader: { s: number; laps: number }; ahead: { s: number; laps: number } | null }[] {
    const ord = this.order(), L = this.track.length;
    return ord.map((e, i) => ({ e, pos: i + 1, lap: Math.max(1, Math.min(this.laps, e.lapAt.length)), leader: i ? gapBetween(ord[0]!, e, this.clock, L) : { s: 0, laps: 0 }, ahead: i ? gapBetween(ord[i - 1]!, e, this.clock, L) : null })); }
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
      e.prevS = c.s; if (!waiting && (!e.trail.length || this.clock - e.trail[e.trail.length - 2]! >= 0.1) && (!e.trail.length || e.dist > e.trail[e.trail.length - 1]!)) e.trail.push(this.clock, e.dist);
      // over the top, or stopped off the concrete: back on the track (an opponent after a moment, as its crew would push it)
      if (c.over || (c.upset && c.speed < 3)) { c.over = false; c.place(c.s, 0, 0); }   // over the top, or on its side or roof and stopped
      if (e.driver && !waiting) { e.stuck = (c.speed < 2 || Math.abs(c.off) > T.spec.width / 2 + 1) ? e.stuck + dt : 0; if (e.stuck > 3) { c.place(c.s, 0, 0); e.stuck = 0; } } }
    this.collide(); void L;
    this.done = this.cars.every(e => e.finish > 0) || (!!this.player?.finish && this.clock > this.player.finish + 45); }
  /** an opponent with a car close ahead on its line moves out to pass, higher up a banking */
  private avoid(e: Entrant): number { const c = e.car, T = this.track; let push = 0;
    for (const o of this.cars) { if (o === e) continue; const ahead = T.gap(c.s, o.car.s), side = o.car.off - c.off; if (ahead > 0 && ahead < 25 && Math.abs(side) < 3.2) push += (side > 0 ? -1 : 1) * 0.06 * (1 - ahead / 25); }
    return push; }
  /** cars touching (review 120): each car's body a box; a corner of one inside the other is pushed out along the face it
   *  went in by, and the two take an impulse there (bouncing a little, rubbing), which turns them about every axis */
  private collide(): void { for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) { const a = this.cars[i]!.car, b = this.cars[j]!.car; if (Math.hypot(a.x - b.x, a.y - b.y) < 8) touch(a, b); } }
}
/** two cars' bodies against each other (review 120): their footprints (boxes seen from above) tested on the four axes
 *  of the two cars; the least overlap gives the push's direction and depth; they are pushed apart by it and take an
 *  impulse at the corners that went in (bouncing a little, rubbing), which turns them about every axis */
export function touch(a: Vehicle, b: Vehicle): number {
  const ax = (c: Vehicle): [number, number][] => { const h = c.yaw; return [[Math.cos(h), Math.sin(h)], [-Math.sin(h), Math.cos(h)]]; };
  const A = ax(a), B = ax(b), dX = b.x - a.x, dY = b.y - a.y, ext = (c: Vehicle, C: [number, number][], u: [number, number]) => c.box.hl * Math.abs(C[0]![0] * u[0] + C[0]![1] * u[1]) + c.box.hw * Math.abs(C[1]![0] * u[0] + C[1]![1] * u[1]);
  let best = Infinity, n: [number, number] = [1, 0];
  for (const u of [...A, ...B]) { const d = dX * u[0] + dY * u[1], o = ext(a, A, u) + ext(b, B, u) - Math.abs(d); if (o <= 0) return 0; if (o < best) { best = o; n = d >= 0 ? [u[0], u[1]] : [-u[0], -u[1]]; } }   // n: from a toward b
  if (Math.abs(a.p[2] - b.p[2]) > 1.2) return 0;   // one far over the other
  const ma = a.spec.mass, mb = b.spec.mass, sh = Math.min(best, 0.4);
  a.p[0] -= n[0] * sh * mb / (ma + mb); a.p[1] -= n[1] * sh * mb / (ma + mb); b.p[0] += n[0] * sh * ma / (ma + mb); b.p[1] += n[1] * sh * ma / (ma + mb);
  // where they touch: a's corner deepest toward b and b's deepest toward a, met halfway, at bumper height
  const corner = (c: Vehicle, C: [number, number][], dir: [number, number]): [number, number] => { let bx = c.x, by = c.y, bd = -Infinity; for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const x = c.x + C[0]![0] * c.box.hl * sx + C[1]![0] * c.box.hw * sy, y = c.y + C[0]![1] * c.box.hl * sx + C[1]![1] * c.box.hw * sy, d = x * dir[0] + y * dir[1]; if (d > bd) { bd = d; bx = x; by = y; } } return [bx, by]; };
  const ca = corner(a, A, n), cb = corner(b, B, [-n[0], -n[1]]), w: [number, number, number] = [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, (a.base[2] + b.base[2]) / 2 + 0.5];
  const N: [number, number, number] = [n[0], n[1], 0], va = a.velAt(w), vb = b.velAt(w), rel: [number, number, number] = [vb[0] - va[0], vb[1] - va[1], vb[2] - va[2]], vn = rel[0] * N[0] + rel[1] * N[1]; if (vn >= 0) return 1;
  const k = a.invMassAt(w, N) + b.invMassAt(w, N), J = -(1 + 0.25) * vn / k, E = 0.5 * vn * vn / k * (1 - 0.25 * 0.25);   /* the energy the blow takes out of the pair: it goes into bending them (review 121) */
  a.blow(w, N, E / 2); b.blow(w, [-N[0], -N[1], -N[2]], E / 2);
  const vt: [number, number, number] = [rel[0] - N[0] * vn, rel[1] - N[1] * vn, rel[2]], vtl = Math.hypot(...vt), t: [number, number, number] = vtl > 1e-6 ? [vt[0] / vtl, vt[1] / vtl, vt[2] / vtl] : [0, 0, 0];
  const kt = vtl > 1e-6 ? a.invMassAt(w, t) + b.invMassAt(w, t) : 1, Jt = Math.min(0.4 * J, vtl / kt), imp: [number, number, number] = [N[0] * J - t[0] * Jt, N[1] * J - t[1] * Jt, -t[2] * Jt];   /* on b: pushed off, its sliding against a resisted */
  b.applyImpulse(w, imp); a.applyImpulse(w, [-imp[0], -imp[1], -imp[2]]); return 1; }
