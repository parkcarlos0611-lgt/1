// The torque-converter automatic (docs/systems/119 K4): a fluid coupling with a stator between the engine and a planetary
// box of four to six speeds, its own control unit choosing the gear, a lock-up clutch across the converter in the upper
// gears. Kept apart from the vehicle so its rules can be tested on their own; race/vehicle.ts calls these only when
// spec.tech.gearbox is 'auto' (every other car's drive line is untouched).
//
// The converter: the impeller's torque Ti = C0 we^2 f(SR), SR = wt / we the turbine's speed over the engine's, f falling
// from 1 (stalled) to 0 at SR 1 (no slip, no torque: the fluid only carries torque by slipping). C0 is set so the engine
// at full throttle is held at the stall revs with the turbine stopped. Below the coupling point (SR 0.85) the stator
// multiplies the torque: the turbine gets TR Ti, TR falling from tr0 at stall to 1 at the coupling point. Run backwards
// (the wheels driving the engine, SR > 1) it couples at a little over half the capacity and does not multiply.
import { torqueAt, type RaceSpec } from './cars';

/** the converter's and the box's figures */
export interface AutoBox {
  /** the stall speed (rpm): the engine's revs at full throttle against a stopped turbine */ stall: number;
  /** the torque ratio at stall */ tr0: number;
  /** the lock-up clutch: engaged in this gear and above, over this road speed (km/h) */ lockGear: number; lockKmh: number;
  /** the shift's time (s): the torque phase, then the inertia phase */ shiftT: number;
}
/** the coupling point: above it the stator freewheels and the torque ratio is 1 */
export const COUPLE_SR = 0.85;
/** a box for a car: a stall a little over the torque peak's half (a passenger car's 2,000 - 2,600 rpm), ratio 2 */
export function autoBoxOf(s: Pick<RaceSpec, 'torqueRpm' | 'idle' | 'gears'>): AutoBox {
  return { stall: Math.round(Math.max(s.idle * 2.6, Math.min(2800, s.torqueRpm * 0.55)) / 50) * 50, tr0: 2.0, lockGear: 3, lockKmh: 60, shiftT: 0.4 };
}
/** the impeller's capacity C0 (Nm per (rad/s)^2): full throttle's torque at the stall revs over their square */
export const capacity = (s: RaceSpec, B: AutoBox) => torqueAt(s, B.stall) / (B.stall * Math.PI / 30) ** 2;
/** the torque ratio at speed ratio SR */
export const torqueRatio = (B: AutoBox, SR: number) => SR >= COUPLE_SR ? 1 : 1 + (B.tr0 - 1) * (1 - Math.max(0, SR) / COUPLE_SR);
/** the converter's torques (Nm): on the impeller (the engine's load) and on the turbine (into the box), the engine at we
 *  and the turbine at wt (rad/s, the turbine's speed signed as the engine's: forward drive positive) */
export function converter(C0: number, B: AutoBox, we: number, wt: number): { Ti: number; Tt: number; SR: number } {
  const e = Math.max(1e-3, we), SR = wt / e;
  if (SR <= 1) { const x = Math.max(0, SR), Ti = C0 * e * e * (1 - x ** 4); return { Ti, Tt: Ti * torqueRatio(B, x), SR }; }
  // overrun: the turbine drives the impeller; the same law with the roles swapped, at 0.6 of the capacity
  const r = e / wt, Ti = -0.6 * C0 * wt * wt * (1 - r ** 4); return { Ti, Tt: Ti, SR };
}

/** the control unit's shift points (engine revs at the box's output speed in the gear): up above U, down when the gear
 *  below would turn under 0.7 U (a 30 % gap after an upshift: no hunting); the pedal read smoothed */
export function upRpm(s: RaceSpec, thr: number): number {
  const top = Math.min(s.hpRpm * 1.04, s.redline * 0.92), lo = Math.max(s.idle * 2.2, top * 0.36);
  return lo + (top - lo) * Math.max(0, Math.min(1, thr)) ** 1.3; }
/** the gear the schedule wants from `gear` (1-based), the output's speed in engine revs per unit ratio `w` (rpm at ratio
 *  1: the road speed), the smoothed pedal; one gear at a time */
export function scheduled(s: RaceSpec, gear: number, w: number, thr: number): number {
  const g = s.gears, U = upRpm(s, thr), rpm = w * g[gear - 1]!;
  if (gear < g.length && rpm > U) return gear + 1;
  if (gear > 1) { const lower = w * g[gear - 2]!, floor = Math.max(s.idle * 1.4, 0.7 * U * g[gear - 2]! / g[gear - 1]!);
    if (rpm < floor && lower < s.redline * 0.9) return gear - 1; }
  return gear; }
/** the kick-down (the pedal pressed through to the floor): the lowest gear whose revs stay under 0.9 of the upshift
 *  point at full throttle, so it may drop two gears at once */
export function kickdown(s: RaceSpec, gear: number, w: number): number {
  const top = upRpm(s, 1); let to = gear; for (let k = gear - 1; k >= 1; k--) { if (w * s.gears[k - 1]! < top * 0.9) to = k; else break; } return to; }

/** the box's ratios: wider spread than the manuals' (a planetary box, a converter to start on), a tall overdrive top */
export const AUTO_GEARSETS: Record<4 | 5 | 6, number[]> = {
  4: [2.804, 1.531, 1.0, 0.705],                 // a period four-speed with overdrive
  5: [3.52, 2.042, 1.4, 1.0, 0.716],             // a period five-speed (the large saloon's own)
  6: [3.296, 1.958, 1.348, 1.0, 0.725, 0.582] }; // a period six-speed
