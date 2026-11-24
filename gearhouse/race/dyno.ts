// The engine designer's dyno and its sheet (docs/systems/101 1-1 and 1-2 ②, task M2): the engine's torque and power
// against its revs from the very torque the driving physics uses (race/cars.ts torqueAt on race/design.ts designSpec:
// what the dyno shows is what the car pulls with), and the engine's figures as the designer's table shows them: its
// peaks, its specific output, its mass and its size (race/designparts.ts: what the fit check sets against a bay), its
// fuel use and emissions class, its reliability, cost and development time (placeholders until 0.20). Pure.
import type { Design } from '../core/design';
import { DESIGN_NSX } from '../core/design';
import { torqueAt } from './cars';
import { designSpec, dragArea } from './design';
import { HP, boreStroke, cruiseFuel, emissionsClass, engineCost, engineDevMonths, engineMass, enginePackage, engineReliability } from './designparts';

export interface DynoCurve { rpm: number[]; torque: number[]; hp: number[]; idle: number; redline: number;
  peakHp: { rpm: number; hp: number }; peakTorque: { rpm: number; torque: number } }
/** the full-throttle curve from idle to the red line, every `step` rpm (and at the red line itself) */
export function dynoCurve(d: Design, step = 100): DynoCurve {
  const s = designSpec(d), rpm: number[] = [], torque: number[] = [], hp: number[] = [];
  for (let r = Math.ceil(s.idle / step) * step; r <= s.redline; r += step) rpm.push(r);
  if (rpm[rpm.length - 1] !== s.redline) rpm.push(s.redline);
  for (const r of rpm) { const T = torqueAt(s, r); torque.push(T); hp.push(T * r * Math.PI / 30 / HP); }
  let ih = 0, it = 0; for (let i = 1; i < rpm.length; i++) { if (hp[i]! > hp[ih]!) ih = i; if (torque[i]! > torque[it]!) it = i; }
  return { rpm, torque, hp, idle: s.idle, redline: s.redline, peakHp: { rpm: rpm[ih]!, hp: hp[ih]! }, peakTorque: { rpm: rpm[it]!, torque: torque[it]! } }; }

export interface EngineSheet { hp: number; hpRpm: number; torque: number; torqueRpm: number; /** hp a litre */ specific: number;
  /** kg, dressed (its exhaust, its ancillaries, its cooling's share) */ mass: number; /** mm, with the gearbox's length apart */ length: number; width: number; height: number; box: number;
  bore: number; stroke: number; /** L/100 km at 90 and 120 km/h in top gear, in the car it is in */ fuel90: number; fuel120: number; emissions: string;
  reliability: number; serviceKm: number; /** the engine's cost index: the NSX's C30A 100 */ cost: number; devMonths: number }
const COST_C30A = engineCost(DESIGN_NSX);
export function engineSheet(d: Design, curve = dynoCurve(d)): EngineSheet {
  const s = designSpec(d), p = enginePackage(d), bs = boreStroke(d), r = engineReliability(d), car = { ...s, cdA: dragArea(s) };
  const fuel90 = cruiseFuel(d, car, 90), fuel120 = cruiseFuel(d, car, 120), m = (x: number) => Math.round(x * 1000);
  return { hp: Math.round(curve.peakHp.hp), hpRpm: curve.peakHp.rpm, torque: Math.round(curve.peakTorque.torque), torqueRpm: curve.peakTorque.rpm, specific: Math.round(curve.peakHp.hp / (d.engine.cc / 1000) * 10) / 10,
    mass: Math.round(engineMass(d)), length: m(p.length), width: m(p.width), height: m(p.height), box: m(p.box), bore: Math.round(bs.bore * 10) / 10, stroke: Math.round(bs.stroke * 10) / 10,
    fuel90: Math.round(fuel90 * 10) / 10, fuel120: Math.round(fuel120 * 10) / 10, emissions: emissionsClass(d, (fuel90 + fuel120) / 2),
    reliability: Math.round(r.reliability), serviceKm: r.serviceKm, cost: Math.round(engineCost(d) / COST_C30A * 100), devMonths: engineDevMonths(d) }; }
