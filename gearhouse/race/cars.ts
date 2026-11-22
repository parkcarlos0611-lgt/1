// The cars' figures for the driving game (review 84). Mass, engine size and power, gearbox count, drive, wheelbase,
// track and tyres come from the game's data (data/cars/specs.json, the sheets' kerb weights). Checked against sources
// on 2026-11-22 (review 85), each line's notes below: [v] verified by a source, [~] a secondary or estimated figure,
// [?] none found, as remembered. Top speeds are what the physics is tuned against.
//   fordT23   20 hp @ 1600 [v], 113 Nm @ 900 [v], axle 3.63-3.64 [v], top 42 mph / 68 km/h [v]; brakes rear only [v]
//   chevAB28  35 hp @ 2200 [v], four-wheel mechanical [v], top 50-55 mph [~]
//   plymU29   45 hp @ 2800 [v], top [?] (about 60 mph assumed); brakes: hydraulic as Chrysler's Lockheed [?] (one
//             estimated source says mechanical)
//   pontiac29 60 hp @ 3000 [v], top 60 mph [~]
//   dodgeV28  58 hp @ 3000 [v], hydraulic brakes [v], top about 60 mph [~]
//   willys27  53 hp [v], revs [?], top 60-65 mph [~]
//   buick28   63 hp @ 2800 [v], four-wheel mechanical (contracting) [v], top [?]
//   fnTT33    four speeds, chain [v]; a period test: 57 hp, 85 mph flat out [~] (the game's data keeps 62 hp)
//   bmw315    40 PS [v], top 120 km/h [v], about 750 kg [~], revs [?]
//   dueSSJ35  SJ: 320 hp at 4200 rpm [v] (the game's data keeps the SSJ's claimed 400), three speeds [v], top 130-140
//             mph [~], axle [?]: a high one, as some 1935 SJ chassis had [~] (3.3 here)
//   dueA21    88 hp @ 3600 [v], 170 lb-ft @ 1500 [v], the first production four-wheel hydraulic brakes [v], top 71 mph
//             (Wikipedia) to 75 mph [v]
//   Gear ratios other than the Model T's, drag areas, centres of gravity: [?]. The tyres' grip on dry concrete (0.78)
//   [?]: period tests found about 0.4 sliding on wet concrete.
import specs from '../data/cars/specs.json';

export interface RaceSpec {
  id: string; name: string; mass: number; wheelbase: number; track: number; tyreR: number; tyreW: number;
  cgH: number; frontShare: number;                     // centre of gravity: height (m), share of weight on the front axle
  hp: number; hpRpm: number; torqueRpm: number; idle: number; redline: number;
  gears: number[]; final: number; eff: number;
  brakes: 'rear' | 'four'; hydraulic: boolean; brakeG: number;   // the deceleration the brakes manage when new and cold
  cdA: number; crr: number; steerLock: number;          // drag area m², rolling resistance, front wheels' lock (deg)
  topKmh: number; check: boolean;
  cooling: { siphon: boolean; margin: number } }   // the water's circulation (no pump on the Model T [v]), the radiator against the engine's heat [?]

/** tyre sizes: 30x3.5 (overall diameter x section, inches), 4.50-20 (section - rim), 33x5 */
export function tyre(size: string): { r: number; w: number } { const a = size.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/), b = size.match(/^(\d+(?:\.\d+)?)-(\d+)$/), inch = 0.0254;
  if (a) return { r: +a[1]! * inch / 2, w: +a[2]! * inch }; if (b) return { r: (+b[2]! + 2 * +b[1]!) * inch / 2, w: +b[1]! * inch }; return { r: 0.36, w: 0.12 }; }
// per car: [peak-power revs, gear ratios, axle ratio, brakes, hydraulic, drag area, cg height, front share, lock, top speed km/h]
const PERIOD: Record<string, [number, number[], number, 'rear' | 'four', boolean, number, number, number, number, number]> = {
  fordT23:   [1600, [2.75, 1.0], 3.64, 'rear', false, 1.95, 0.78, 0.44, 32, 68],
  chevAB28:  [2200, [3.32, 1.69, 1.0], 3.82, 'four', false, 1.9, 0.72, 0.46, 32, 85],
  plymU29:   [2800, [3.06, 1.68, 1.0], 4.3, 'four', true, 1.85, 0.7, 0.47, 32, 97],
  pontiac29: [3000, [3.0, 1.7, 1.0], 4.4, 'four', false, 1.9, 0.72, 0.47, 32, 97],
  dodgeV28:  [3000, [3.0, 1.73, 1.0], 4.3, 'four', true, 1.85, 0.7, 0.47, 32, 100],
  willys27:  [2600, [3.18, 1.73, 1.0], 4.73, 'four', false, 1.95, 0.73, 0.47, 32, 97],
  buick28:   [2800, [3.0, 1.75, 1.0], 4.27, 'four', false, 1.95, 0.72, 0.48, 32, 105],
  fnTT33:    [4500, [3.6, 2.13, 1.43, 1.0], 4.0, 'four', false, 0.95, 0.5, 0.45, 36, 137],
  bmw315:    [4300, [3.62, 2.1, 1.44, 1.0], 4.75, 'four', false, 1.0, 0.52, 0.48, 36, 120],
  dueSSJ35:  [4200, [2.48, 1.53, 1.0], 3.3, 'four', true, 1.35, 0.62, 0.53, 34, 217],
  dueA21:    [3600, [2.9, 1.66, 1.0], 3.8, 'four', true, 1.8, 0.7, 0.5, 33, 117] };
const KG: Record<string, number> = { fordT23: 990, chevAB28: 1160, plymU29: 1155, pontiac29: 1250, dodgeV28: 1300, willys27: 1225, buick28: 1590, fnTT33: 770, bmw315: 750, dueSSJ35: 2270, dueA21: 1750 };

// cooling: the Model T's thermosiphon boiled on long pulls; a supercharged eight runs hot; big luxury radiators had room
const COOL: Record<string, { siphon: boolean; margin: number }> = { fordT23: { siphon: true, margin: 1.0 }, dueSSJ35: { siphon: false, margin: 0.92 }, dueA21: { siphon: false, margin: 1.2 }, fnTT33: { siphon: false, margin: 1.0 }, bmw315: { siphon: false, margin: 1.0 }, buick28: { siphon: false, margin: 1.15 } };
export const RACE_CARS: string[] = Object.keys(PERIOD);
export function raceSpec(id: string): RaceSpec {
  const s = (specs as { cars: Record<string, { car: string; engine: { hp: number }; wheelbase: number; track: number; tyre: string }> }).cars[id]!, p = PERIOD[id]!, t = tyre(s.tyre), hpRpm = p[0];
  return { id, name: s.car, mass: KG[id]! + 75, wheelbase: s.wheelbase / 1000, track: s.track / 1000, tyreR: t.r, tyreW: t.w, cgH: p[6], frontShare: p[7],
    hp: s.engine.hp, hpRpm, torqueRpm: hpRpm * 0.55, idle: Math.max(350, hpRpm * 0.18), redline: hpRpm * 1.12, gears: p[1], final: p[2], eff: 0.88,
    brakes: p[3], hydraulic: p[4], brakeG: p[3] === 'rear' ? 0.32 : p[4] ? 0.62 : 0.5, cdA: p[5], crr: 0.018, steerLock: p[8], topKmh: p[9], check: true, cooling: COOL[id] ?? { siphon: false, margin: 1.1 } }; }

/** engine torque (Nm) at revs, full throttle: a hump peaking at torqueRpm, its power peaking at hpRpm, falling past it */
export function torqueAt(c: RaceSpec, rpm: number): number {
  const P = c.hp * 745.7, wP = c.hpRpm * Math.PI / 30, Tp = P / wP;          // torque at the power peak
  const Tmax = Tp * 1.22, x = rpm / c.torqueRpm;                            // the peak torque, a little above
  let T = rpm <= c.torqueRpm ? Tmax * (0.62 + 0.38 * (1 - (1 - x) ** 2)) : Tmax - (Tmax - Tp) * ((rpm - c.torqueRpm) / (c.hpRpm - c.torqueRpm)) ** 1.6;
  if (rpm > c.hpRpm) T = Tp * Math.max(0, 1 - ((rpm - c.hpRpm) / (c.redline * 1.15 - c.hpRpm)) ** 1.5 * 0.9);
  return Math.max(0, T); }
