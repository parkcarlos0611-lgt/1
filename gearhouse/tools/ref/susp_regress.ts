// The kinematic suspension's regression (docs/systems/102 2-3, M4): each check car driven on the old physics (the
// rules before alpha 0.13) and on its kinematic rig (race/kin.ts), measured alike: the top speed and the time to 100 km/h
// on the flat (as tests/race_design.test.ts), the steady-state skidpad's most lateral acceleration (a 60 m circle, the
// speed raised slowly until the car will not hold the line), and the handicapper's laps (tools/ref/handicaps.ts:
// Millbrook on the resurfaced, bump-free track, Ashcombe Park) with the test driver, standing and flying.
//   npx tsx tools/ref/susp_regress.ts [car ...] [--no-laps]   -> one JSON line a car and mode, then a table
// The cars: the six check designs (core/design.ts: the NSX's and the F355's, the Diablo's, the EB110's, the XJ220's, the
// McLaren F1's) and the kit's registered cars (race/cars.ts: nsx, f355, f355f1, eb110).
import { raceSpec, type RaceSpec } from '../../race/cars';
import { designSpec } from '../../race/design';
import { DESIGN_NSX, DESIGN_F355, DESIGN_DIABLO, DESIGN_EB110, DESIGN_XJ220, DESIGN_MCLAREN_F1 } from '../../core/design';
import { Vehicle, usefulLock } from '../../race/vehicle';
import { Driver } from '../../race/driver';
import { Track } from '../../race/track';
import { trackDef } from '../../race/tracks';
import { PHYSICS } from '../../race/kin';

const CARS: Record<string, () => RaceSpec> = { 'design:nsx': () => designSpec(DESIGN_NSX), 'design:f355': () => designSpec(DESIGN_F355), 'design:diablo': () => designSpec(DESIGN_DIABLO),
  'design:eb110': () => designSpec(DESIGN_EB110), 'design:xj220': () => designSpec(DESIGN_XJ220), 'design:mclarenf1': () => designSpec(DESIGN_MCLAREN_F1),
  nsx: () => raceSpec('nsx'), f355: () => raceSpec('f355'), f355f1: () => raceSpec('f355f1'), eb110: () => raceSpec('eb110') };
const dt = 1 / 200;
const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 8000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 8000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 });
const RAD = 60, pad = new Track({ name: 'pad', pieces: [{ kind: 'arc', radius: RAD, turn: 180, name: 'a' }, { kind: 'arc', radius: RAD, turn: 180, name: 'b' }], start: { x: 0, y: 0, heading: 0 }, width: 40, easing: 2, banking: [], bumps: [], landmarks: [], joints: 12 });

/** full throttle from rest on the flat: the top speed (km/h) and the time to 100 km/h (s). The driver holds the line
 *  with a light hand (the heading's error and the offset fed back): a car that spins its rear wheels in first gear (the
 *  McLaren F1's 627 hp, no traction control) is not stable on its own, and with the hands off it went where the last
 *  bit of rounding sent it (on either physics) */
export function straight(s: RaceSpec): { top: number; t100: number } { const c = new Vehicle(s, flat).place(100, 0, 0); let vmax = 0, t100 = 0;
  for (let t = 0; t < 80; t += dt) { const he = Math.atan2(Math.sin(c.yaw - flat.at(c.s).h), Math.cos(c.yaw - flat.at(c.s).h)), lock = usefulLock(s, c.speed, c.tyre.mu);
    c.step(dt, { throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, (-0.02 * c.off - 0.6 * he - 0.1 * c.r) / lock)) }); vmax = Math.max(vmax, c.speed * 3.6); if (!t100 && c.speed * 3.6 >= 100) t100 = t; } return { top: vmax, t100 }; }
/** the skidpad: round the circle, the speed raised 0.08 m/s each second; the most lateral acceleration (g, a second's mean)
 *  held while the car stays within 1.5 m of the line and its slip angle under 6 degrees */
export function skidpad(s: RaceSpec): number { const c = new Vehicle(s, pad).place(0, 0, 12); let vT = 12, best = 0, acc = 0, n = 0, I = 0;
  for (let t = 0; t < 400; t += dt) { const off = c.off, k = 1 / RAD;
    // steering: the path's own curvature, the offset and the heading's error fed back; the speed held by a PI on the throttle
    const he = Math.atan2(Math.sin(c.yaw - pad.at(c.s).h), Math.cos(c.yaw - pad.at(c.s).h)), want = Math.atan(s.wheelbase * k) - 0.03 * off - 0.8 * he - 0.15 * (c.r - c.vx * k);
    const lock = usefulLock(s, c.speed, c.tyre.mu), e = vT - c.vx; I = Math.max(-2, Math.min(2, I + e * dt));
    c.step(dt, { throttle: Math.max(0, Math.min(1, 0.25 + 0.4 * e + 0.2 * I)), brake: 0, steer: Math.max(-1.5, Math.min(1.5, want / lock)) });
    vT += 0.08 * dt; const slip = Math.abs(Math.atan2(c.vy, Math.max(1, c.vx)));
    if (Math.abs(off) > 1.5 || slip > 0.105) { if (t > 5) break; continue; }
    acc += c.vx * c.vx / (RAD - off) / 9.81; n++; if (n >= 200) { best = Math.max(best, acc / n); acc = 0; n = 0; } }
  return best; }
/** the handicapper's laps (as tools/ref/handicaps.ts): standing and flying (s), or null when no lap stayed on the concrete */
export function laps(s: RaceSpec, track: string, smooth: boolean): { standing: number; flying: number; dare: number; offLast?: boolean } | null {
  const T = trackDef(track).make(); if (smooth) T.bumpK = 0; const START = T.spec.landmarks.find(l => l.kind === 'line')!.s; let dare = 0.7;
  for (let tries = 0; tries < 5; tries++, dare *= 0.9) { const car = new Vehicle(s, T).place(START - 4, 0, 0), d = new Driver(T, dare); let t = 0, prev = car.s, bad = false, maxOff = 0; const crossings: number[] = [];
    while (t < 1200 && crossings.length < 3) { car.step(dt, d.drive(car)); t += dt; if (T.gap(prev, START) > 0 && T.gap(car.s, START) <= 0 && car.vx > 1) crossings.push(t); prev = car.s; maxOff = Math.max(maxOff, Math.abs(car.off) - T.spec.width / 2);
      if (car.over || Math.abs(car.off) > T.spec.width / 2 + 1) { bad = true; break; } }
    if (!bad && crossings.length === 3) return { standing: +crossings[1]!.toFixed(1), flying: +(crossings[2]! - crossings[1]!).toFixed(1), dare: +dare.toFixed(3) }; }
  return null; }

if (process.argv[1]?.endsWith('susp_regress.ts')) {
  const args = process.argv.slice(2), ids = args.filter(a => !a.startsWith('--')), noLaps = args.includes('--no-laps');
  for (const id of ids.length ? ids : Object.keys(CARS)) { const row: Record<string, unknown> = { id };
    for (const mode of ['old', 'new'] as const) { PHYSICS.kinematic = mode === 'new'; const s = CARS[id]!(), st = straight(s), g = skidpad(s);
      const r: Record<string, unknown> = { top: +st.top.toFixed(1), t100: +st.t100.toFixed(2), g: +g.toFixed(3) };
      if (!noLaps) { r.millbrook = laps(s, 'millbrook', true); r.road = laps(s, 'road', false); }
      row[mode] = r; }
    console.log(JSON.stringify(row)); }
}
