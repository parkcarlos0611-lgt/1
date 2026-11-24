// Where a powertrain goes in a car: the site (the car's own measurements: wheels, floor, engine bay, cabin tunnel,
// exhaust tips) and what every part of the powertrain is handed while it is built (the collector, the specification,
// the engine as built and its place in the car's frame).
// The car's frame: x from the nose back, y across (+ the car's right), z up from the ground, millimetres.
import type { Geo, V } from './geo';
import type { EngineOut } from './engine';
import type { Detail, PowertrainSpec } from './spec';

export type Dir = 'x' | '+x' | '-x' | 'y' | '+y' | '-y';
export interface SiteWheel { x: number; /** half the track */ y: number; /** the tyre's radius and width */ r: number; w: number; /** the hub's height (the radius, unless the body rides higher or lower over it) */ z: number }
export interface Site {
  length: number; /** the underbody's height off the ground */ foot: number;
  wheels: { f: SiteWheel; r: SiteWheel };
  /** the engine: the crank's end at the clutch (a wet-sump engine's height), the way the crank runs from there to the pulleys, the room it must fit */
  engine: { at: V; dir: Dir; box?: { len: number; wid: number; hgt: number } };
  /** the body's exhaust tips: where each pipe starts (x), its place across and up, its bore's radius */
  tips?: { x: number; z: number; y: number[]; r: number };
  /** the underbody's height along the car where it leaves `foot` (it rises under the nose and the tail): [x, z] by x */
  floor?: [number, number][];
  /** the engine bay: its ends, half its width, its floor */
  bay?: { x: [number, number]; half: number; floor: number };
  /** the cabin: its floor, its ends, the tunnel down its middle (from x, half-width, top) */
  cabin?: { floor: number; x: [number, number]; tunnel?: [number, number, number] };
}
export interface Ctx {
  g: Geo; S: PowertrainSpec; site: Site; det: Detail; E: EngineOut;
  /** the crank's end at the clutch in the car, the engine's scale, the car's directions of the crank (to the pulleys) and across it */
  o: V; scale: number; U: V; Vx: V; /** the crank lies along the car */ long: boolean;
  /** a point of the engine's frame in the car: at the engine's scale, and at full size (the gearbox and what hangs on it) */
  T(p: V): V; T1(p: V): V;
  /** the engine's bounds in the car */ eb: { min: V; max: V };
  /** what the parts leave for each other and for the checks */
  out: Placed;
}
export interface Placed {
  /** the gearbox's far end and top (car frame) */ gearboxEnd: V; gearboxTop: number;
  /** each driveshaft: its inner end (the differential's flange) and its outer (the wheel's hub) */ shafts: { from: V; to: V; front: boolean }[];
  /** the tail pipes' ends */ tails: V[];
  /** the rear rails' height and half-spacing */ railZ: number; railY: number;
}
export const dirs = (d: Dir): { U: V; Vx: V } => d === '-x' ? { U: [-1, 0, 0], Vx: [0, -1, 0] } : d === 'y' || d === '+y' ? { U: [0, 1, 0], Vx: [-1, 0, 0] } : d === '-y' ? { U: [0, -1, 0], Vx: [1, 0, 0] } : { U: [1, 0, 0], Vx: [0, 1, 0] };
/** the underbody's height at x, and the highest it stands between two stations */
export function floorAt(site: Site, x: number): number { const F = site.floor; if (!F || !F.length) return site.foot; if (x <= F[0]![0]) return F[0]![1];
  for (let i = 1; i < F.length; i++) if (x <= F[i]![0]) { const a = F[i - 1]!, b = F[i]!; return a[1] + (b[1] - a[1]) * (x - a[0]) / Math.max(1e-6, b[0] - a[0]); } return F[F.length - 1]![1]; }
export const floorOver = (site: Site, x0: number, x1: number): number => { let z = Math.max(floorAt(site, x0), floorAt(site, x1)); for (const [x, h] of site.floor ?? []) if (x > x0 && x < x1) z = Math.max(z, h); return z; };
