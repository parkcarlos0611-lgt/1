// The instruments (docs/systems/109 section 4): each dial is a face drawn into the interior's sheet from data (its
// range, ticks, figures, the red band from the engine's red line, the speedometer's scale from the car's top speed),
// and a needle apart: a thin wedge on its own bone, turned about its pivot every frame as the wheels and the
// suspension are (render/live/renderer.ts). The layout is the 959's cluster (docs/reference/interior/gauges959): five
// round dials under one hood, left to right the oil's temperature, the oil's level and pressure with the warning
// lamps, the big rev counter in the middle with the boost gauge in its lower half, the speedometer with two scales
// and the distance counters, and the fuel and the water at the right.
// Angles on a face are a clock's: degrees clockwise from twelve, as the driver sees it.
import type { V } from '../mesh';
import type { Region } from './atlas';

export const DIAL_IDS = ['oilTemp', 'oilLevel', 'oilPress', 'tach', 'boost', 'speedo', 'fuel', 'water'] as const;
export type DialId = typeof DIAL_IDS[number];
/** one scale on a face and its needle */
export interface DialScale { id: DialId; min: number; max: number; /** the needle's clock angle (degrees) at min and at max */ a0: number; a1: number; /** a tick every `major` units, a small one every `minor` */ major: number; minor?: number;
  /** a figure every `num` units from `numFrom` (default min), shown divided by `div` */ num?: number; numFrom?: number; div?: number; /** the red band [from, to], an amber one */ red?: [number, number]; amber?: [number, number];
  /** the pivot on the face (-1..1 across and up) and the scale's radius (the face's is 1) */ c: [number, number]; r: number; /** what is written at the two ends in place of figures, and the scale's caption */ ends?: [string, string]; label?: string; unit?: string;
  /** the needle's reading with the engine off, and its lag (s) */ rest: number; tau: number;
  /** a second, inner scale of figures only (the speedometer's other unit): the reading times `k`, a figure every `num` */ inner?: { k: number; num: number; label: string } }
export interface GaugeFace { region: Region; /** the bezel's radius (mm) */ R: number; scales: DialScale[]; /** distance counters: digits in windows (km), the total and the trip */ odo?: { total: number; trip: number }; /** warning lamps drawn on the face (unlit) */ lamps?: boolean }
/** what the dials are drawn for: the engine's red line (rpm), the car's top speed (km/h), its boost if it is blown (bar) */
export interface GaugeCar { redline: number; topKmh: number; boostBar?: number; mph?: boolean; odoKm?: number; tripKm?: number }
export const P959_GAUGES: GaugeCar = { redline: 7300, topKmh: 317, boostBar: 1.0, odoKm: 1197, tripKm: 124.3 };
const nice = (v: number, steps: number[]) => steps.find(s => v / s <= 9) ?? steps[steps.length - 1]!;
/** the five faces for a car, left to right */
export function gaugeSet(car: GaugeCar = P959_GAUGES): GaugeFace[] {
  const tachMax = Math.max(6000, Math.ceil((car.redline + 400) / 1000) * 1000), k = car.mph ? 0.621371 : 1, top = car.topKmh * k, step = nice(top * 1.08, [10, 20, 30, 40, 50]), vMax = Math.ceil(top * 1.06 / step) * step;
  const boostMax = car.boostBar ? Math.max(1, Math.ceil(car.boostBar * 1.6 * 2) / 2) : 0;
  const tach: DialScale = { id: 'tach', min: 0, max: tachMax, a0: -140, a1: 125, major: 1000, minor: 250, num: 1000, numFrom: 1000, div: 1000, red: [car.redline, tachMax], c: [0, 0], r: 0.9, label: '1/MIN', unit: 'X1000', rest: 0, tau: 0.06 };
  const boost: DialScale = { id: 'boost', min: 0, max: boostMax, a0: 240, a1: 90, major: 0.5, minor: 0.25, num: 0.5, c: [0, -0.36], r: 0.3, unit: 'BAR', rest: 0, tau: 0.12 };
  return [
    { region: 'dialA', R: 50, scales: [{ id: 'oilTemp', min: 60, max: 170, a0: -125, a1: 125, major: 30, minor: 10, num: 30, red: [150, 170], c: [0, 0], r: 0.9, label: 'OIL', unit: 'C', rest: 60, tau: 1.5 }] },
    { region: 'dialB', R: 50, lamps: true, scales: [
      { id: 'oilLevel', min: 0, max: 1, a0: -128, a1: -52, major: 0.5, minor: 0.25, c: [0, 0], r: 0.88, ends: ['L', 'H'], amber: [0, 0.2], label: 'OIL', rest: 0, tau: 2 },
      { id: 'oilPress', min: 0, max: 5, a0: 128, a1: 52, major: 1, num: 1, c: [0, 0], r: 0.88, unit: 'BAR', rest: 0, tau: 0.25 }] },
    { region: 'tach', R: 64, scales: car.boostBar ? [tach, boost] : [tach] },
    { region: 'speedo', R: 58, odo: { total: car.odoKm ?? 0, trip: car.tripKm ?? 0 }, scales: [{ id: 'speedo', min: 0, max: vMax / k, a0: -128, a1: 128, major: step / k, minor: step / k / 2, num: step / k, numFrom: step / k, div: 1 / k, c: [0, 0], r: 0.9,
      unit: car.mph ? 'MPH' : 'KM/H', rest: 0, tau: 0.18, inner: car.mph ? { k: 1, num: 40, label: 'KM/H' } : { k: 0.621371, num: 20, label: 'MPH' } }] },
    { region: 'dialC', R: 50, scales: [
      { id: 'fuel', min: 0, max: 1, a0: -128, a1: -52, major: 0.5, minor: 0.25, c: [0, 0], r: 0.88, ends: ['0', '1'], red: [0, 0.12], label: 'FUEL', rest: 0, tau: 2.5 },
      { id: 'water', min: 50, max: 130, a0: 128, a1: 52, major: 40, minor: 20, c: [0, 0], r: 0.88, ends: ['C', 'H'], red: [112, 130], label: 'WATER', rest: 50, tau: 1.5 }] },
  ]; }
/** a scale's clock angle (degrees) for a reading */
export const dialAngle = (s: { min: number; max: number; a0: number; a1: number }, v: number): number => s.a0 + (s.a1 - s.a0) * Math.max(0, Math.min(1, (v - s.min) / (s.max - s.min)));

// ---- the rig: what the renderer needs to pose the needles (and the steering wheel) ----
/** a part turning in a plane: about `pivot`, `right` and `up` the plane's own as the eye sees it (unit vectors, the
 *  car's axes, mm). Bone 0 is the cabin itself. A needle is built pointing at its scale's `min` */
export interface DialBone { id: DialId | 'steer'; bone: number; pivot: V; right: V; up: V; min: number; max: number; /** clock angles (degrees) at min and max */ a0: number; a1: number; rest: number; tau: number }
export interface DialRig { dials: DialBone[]; bones: number }
/** the most bones a cabin has: itself, the eight needles, the steering wheel */
export const DIAL_BONES = 2 + DIAL_IDS.length;
/** what the instruments read: the drive's state, in the dials' own units. Anything left out rests */
export interface InteriorInput { /** the engine running (off: every needle falls to its rest) */ on?: boolean; rpm?: number; /** km/h */ kmh?: number; /** bar over the air's */ boost?: number; /** deg C */ oilTemp?: number; water?: number; /** bar */ oilPress?: number; /** 0..1 */ oilLevel?: number; fuel?: number; /** the steering wheel's angle (rad, to the left +) */ steer?: number }
/** the readings as the needles show them now, in DialRig.dials' order: stepDials moves them toward the input with each needle's lag */
export interface DialState { v: Float32Array; started: boolean }
export const dialState = (rig: DialRig): DialState => ({ v: Float32Array.from(rig.dials.map(d => d.rest)), started: false });
/** the reading a dial is driven toward */
export function dialTarget(d: DialBone, i: InteriorInput): number { if (d.id === 'steer') return i.steer ?? 0; if (i.on === false) return d.rest;
  switch (d.id) { case 'tach': return i.rpm ?? d.rest; case 'speedo': return Math.abs(i.kmh ?? d.rest); case 'boost': return i.boost ?? d.rest; case 'oilTemp': return i.oilTemp ?? 90; case 'water': return i.water ?? 85;
    // oil pressure where the drive has none: by the revs, as a pump's does (about 1 bar at idle, 4 and a little by 5000), thinner when the oil is hot
    case 'oilPress': return i.oilPress ?? (i.rpm ? Math.min(5, (0.8 + 3.6 * Math.min(1, i.rpm / 5000)) * (1 - Math.max(0, (i.oilTemp ?? 90) - 110) * 0.006)) : d.rest);
    case 'oilLevel': return i.oilLevel ?? 0.75; case 'fuel': return i.fuel ?? 0.6; } }
/** one step of the needles (dt seconds): each follows its target with its lag, and stops at its scale's ends (the pins) */
export function stepDials(st: DialState, rig: DialRig, input: InteriorInput, dt: number): Float32Array {
  rig.dials.forEach((d, k) => { const t = d.id === 'steer' ? dialTarget(d, input) : Math.max(d.min, Math.min(d.max, dialTarget(d, input))), a = st.started && d.tau > 0 && d.id !== 'steer' ? 1 - Math.exp(-Math.max(0, dt) / d.tau) : 1; st.v[k] = st.v[k]! + (t - st.v[k]!) * a; });
  st.started = true; return st.v; }
/** the bones for the readings (in DialRig.dials' order; none: at rest): three rows a bone, as the renderer's shaders
 *  take them. A needle turns in its face's plane from where it was built (its scale's min) to its reading */
export function poseDials(rig: DialRig, v?: ArrayLike<number> | null, out = new Float32Array(Math.max(rig.bones, 1) * 12)): Float32Array {
  out.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], 0);
  rig.dials.forEach((d, k) => { const val = v?.[k] ?? d.rest, deg = d.id === 'steer' ? -val * 180 / Math.PI : dialAngle(d, val) - d.a0, a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), R = d.right, U = d.up;
    // in the face's plane a turn by `a` clockwise sends right to (cos, -sin) and up to (sin, cos); the axis stays
    const N: V = [R[1] * U[2] - R[2] * U[1], R[2] * U[0] - R[0] * U[2], R[0] * U[1] - R[1] * U[0]], R2: V = [c * R[0] - s * U[0], c * R[1] - s * U[1], c * R[2] - s * U[2]], U2: V = [s * R[0] + c * U[0], s * R[1] + c * U[1], s * R[2] + c * U[2]];
    for (let i = 0; i < 3; i++) { const m = [R2[i]! * R[0] + U2[i]! * U[0] + N[i]! * N[0], R2[i]! * R[1] + U2[i]! * U[1] + N[i]! * N[1], R2[i]! * R[2] + U2[i]! * U[2] + N[i]! * N[2]];
      out.set([m[0]!, m[1]!, m[2]!, d.pivot[i]! - (m[0]! * d.pivot[0] + m[1]! * d.pivot[1] + m[2]! * d.pivot[2])], d.bone * 12 + i * 4); } });
  return out; }
/** the instruments' input from a car being driven (race/vehicle.ts and its health), read by shape so the cabin does not
 *  depend on the drive: speed in m/s, the boost as a share of the engine's full boost, the health's temperatures */
export function inputFromVehicle(v: { rpm: number; speed: number; boost?: number; sw?: number; health?: { water: number; oil: number; failed?: unknown } }, car: { boostBar?: number; idle?: number } = {}, o: { fuel?: number; steer?: boolean } = {}): InteriorInput {
  return { on: v.rpm > (car.idle ?? 600) * 0.4, rpm: v.rpm, kmh: v.speed * 3.6, boost: (v.boost ?? 0) * (car.boostBar ?? 0), ...(v.health ? { water: v.health.water, oilTemp: v.health.oil } : {}), ...(o.fuel !== undefined ? { fuel: o.fuel } : {}), ...(o.steer ? { steer: v.sw ?? 0 } : {}) }; }
