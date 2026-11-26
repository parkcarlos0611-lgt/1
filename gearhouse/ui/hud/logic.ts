// The driving HUD's rules (docs/systems/110 G3), apart from its drawing so they can be tested: the gear lever's gate
// (a push past the gate shifts once, back toward the middle arms it again), the pedals' press (how far a plate sinks
// for how much pedal), the tachometer's face and needles taken from the car's own instruments
// (render/car/interior/gauges.ts: the same red line, top speed and boost scale as the cabin's dials), which wheel and
// which shifter the car shows, and which of the three layouts a screen gets.
import { gaugeSet, dialAngle, type GaugeCar, type GaugeFace, type DialScale } from '../../render/car/interior/gauges';
import { sweepValue } from '../../race/ignition';

// ---- the gear lever: dragged up or down in its gate ----
/** the gate, in shares of the lever's travel: past `gate` it shifts, back inside `rearm` it may shift again */
export const LEVER = { gate: 0.5, rearm: 0.2 } as const;
/** a finger on the lever: where it went down, whether a shift may happen now */
export interface LeverState { y0: number; armed: boolean }
export const leverDown = (y: number): LeverState => ({ y0: y, armed: true });
/** the finger moved to y (px, down the screen) on a lever of `travel` px each way: 'up' (a shift up: the lever pushed
 *  away), 'down' (pulled back), or null. One shift a push; the lever brought back near the middle arms the next */
export function leverMove(s: LeverState, y: number, travel: number): 'up' | 'down' | null {
  if (!(travel > 0)) return null; const t = (y - s.y0) / travel;
  if (!s.armed) { if (Math.abs(t) <= LEVER.rearm) s.armed = true; return null; }
  if (t <= -LEVER.gate) { s.armed = false; return 'up'; } if (t >= LEVER.gate) { s.armed = false; return 'down'; } return null; }
/** the knob's offset drawn (shares of travel, -1 up .. 1 down): it follows the finger to the ends of the slot */
export const leverKnob = (s: LeverState | null, y: number, travel: number): number => !s || !(travel > 0) ? 0 : Math.max(-1, Math.min(1, (y - s.y0) / travel));

// ---- the pedals ----
/** how a pedal plate is drawn for an amount (0..1): sunk `y` of its travel, its face foreshortened to `k` of its height
 *  as it tips away, and its bar filled `bar` (the amount itself) */
export function pedalPress(v: number): { y: number; k: number; bar: number } {
  const p = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0)), e = 1 - (1 - p) * (1 - p);   // eased: the first of the travel shows most
  return { y: e, k: 1 - 0.16 * e, bar: p }; }

// ---- the gauges ----
/** what the HUD's dials are drawn for, from a car's spec (race/vehicle.ts RaceSpec, read by shape) */
export function hudGaugeCar(spec: { redline: number; topKmh: number; tech?: { turbo?: { boost: number } } }): GaugeCar {
  const b = spec.tech?.turbo?.boost; return { redline: spec.redline, topKmh: spec.topKmh || 260, ...(b ? { boostBar: b } : {}) }; }
/** the tachometer's face (with the boost dial in its lower half when the car is blown): the cabin's own */
export const tachFace = (car: GaugeCar): GaugeFace => gaugeSet(car).find(f => f.region === 'tach')!;
/** the face's two scales, the tach first */
export function tachScales(f: GaugeFace): { tach: DialScale; boost?: DialScale } { const tach = f.scales.find(s => s.id === 'tach')!, boost = f.scales.find(s => s.id === 'boost'); return boost ? { tach, boost } : { tach }; }
/** a needle's clock angle (degrees clockwise from twelve) for a reading: the ignition's sweep laid over it while it
 *  comes on, its rest with the ignition off, pinned at the scale's ends */
export function needleDeg(s: { min: number; max: number; a0: number; a1: number; rest: number }, v: number, sweep: number, on: boolean): number {
  if (!on) return dialAngle(s, s.rest); return dialAngle(s, sweepValue(Number.isFinite(v) ? v : s.rest, sweep, s.min, s.max)); }
/** the speed as the big digits show it: whole km/h, blank dashes with the ignition off; the sweep runs them up too */
export function speedDigits(kmh: number, sweep: number, on: boolean, top: number): string {
  if (!on) return '---'; return String(Math.round(sweepValue(Math.abs(kmh), sweep, 0, top))); }
/** the gear as its badge shows it */
export const gearLabel = (gear: number, reverse: boolean): string => reverse ? 'R' : String(Math.max(1, Math.round(gear)));
/** the torque-converter automatic's badge (docs/systems/119 K4): the selector's D (M with the driver's own gears) and the gear it holds */
export const gearLabelAuto = (gear: number, reverse: boolean, auto: boolean): string => reverse ? 'R' : (auto ? 'D' : 'M') + Math.max(1, Math.round(gear));
/** the rev light: 0 below 85 % of the red line, 1 near it, 2 at or past it (the shift light blinks) */
export const revLight = (rpm: number, redline: number): 0 | 1 | 2 => rpm >= redline * 0.985 ? 2 : rpm >= redline * 0.85 ? 1 : 0;

// ---- which drawings ----
export type HudWheel = 'stock' | 'drift';
/** the interior's wheel (render/bodies cabinFor: the light interior is the drift car's dished three-spoke, the others
 *  the stock four-spoke); a car with no design of its own: the drift wheel, the game's own */
export const wheelStyleOf = (interior?: string): HudWheel => interior === undefined || interior === 'light' ? 'drift' : 'stock';
export type Shifter = 'lever' | 'paddles' | 'buttons';
/** the shifter drawn: the F1 box's paddles, else the lever; the buttons when the setting asks for them */
export const shifterOf = (gearbox: 'manual' | 'f1' | 'auto' | undefined, pref: 'lever' | 'buttons'): Shifter => pref === 'buttons' ? 'buttons' : gearbox === 'f1' ? 'paddles' : 'lever';

// ---- the layouts ----
export type HudLayout = 'portrait' | 'landscape' | 'pc';
/** a phone held upright, a phone on its side, or a computer (no touch, or a big screen with a fine pointer) */
export function hudLayout(w: number, h: number, touch: boolean): HudLayout { if (!touch) return 'pc'; return h > w ? 'portrait' : 'landscape'; }
/** the settings' size and opacity held to their ranges */
export const hudScale = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(0.7, Math.min(1.4, v)) : 1;
export const hudAlpha = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(0.35, Math.min(1, v)) : 0.92;
