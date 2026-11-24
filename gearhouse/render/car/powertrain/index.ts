// The powertrain as parametric meshes (docs/systems/101, part 1; task M1): the engine, the drivetrain, the exhaust,
// the cooling, fuel and oil, and the chassis it hangs in, built from a specification (spec.ts: a design's, or a kit
// car's engine's) and set in a car (layout.ts: the site). Each part has its own name (engineBlock, camCover,
// intakePlenum, turbo, intercooler, clutchHousing, gearbox, differential, driveshaft, cvJoint, exhaustManifold,
// catalyst, muffler, tailpipe, radiator, coolantPipe, fuelTank, subframe, engineMount, ...), so the builder can label,
// light and lift out each one. None is named as a wheel's part, so nothing here turns with a wheel (mesh.ts wheelsOf).
//   detail 2   the builder: every part, round sections                (about 3,000 to 4,700 triangles)
//   detail 1   a lighter car for the drive: no small parts, fewer sides (about half)
//   detail 0   blocks and bare pipes                                   (about a quarter)
// The engine is built at its true size from its displacement; where it is larger than the room the site gives it, it is
// scaled down to fit (the fit check, race/fit.ts, is what tells the player) and `scale` says so.
import { Build, type Mesh } from '../mesh';
import { Geo, type Bounds, type V } from './geo';
import { buildEngine, DRY_DROP } from './engine';
import { drivetrain } from './drivetrain';
import { exhaust } from './exhaust';
import { chassis, cooling, fuelAndOil } from './ancillary';
import { dirs, type Ctx, type Placed, type Site } from './layout';
import type { Detail, PowertrainSpec } from './spec';
import { bayProps } from './bay';
import { resolveStyle, type DriftStyle, type StyleOpt } from './style';

export type { Site, Dir, SiteWheel } from './layout';
export type { PowertrainSpec, Detail } from './spec';
export { fromDesign, fromEngineSpec, gradeColours } from './spec';
export { partStyle, setPartStyle, styleForLook, driftStyle, type PartStyle, type StyleOpt } from './style';

export interface PowertrainOpts { detail?: Detail; /** only the engine (a pedestal's) */ engineOnly?: boolean;
  /** the look it is built in: the realistic one, the drift-game one or a customised drift look (default: the setting's, style.ts partStyle) */ style?: StyleOpt;
  /** the drift look only: the engine's bay drawn round it (the black tub's walls, the panel across its end with the
   *  radiator or the lamps' backs) and the bay's fittings set in its corners. For a bay seen on its own, or a car whose
   *  body brings no bay of its own; without it the fittings stand in the nose by the battery */ bay?: boolean }
export interface PowertrainBuilt {
  tris: number; /** the engine's scale to fit its room (1: its true size) */ scale: number;
  /** each part name's bounds and triangles */ parts: Map<string, Bounds>;
  /** the engine with its gearbox and differential: their bounds in the car (what the bay must hold) */ core: { min: V; max: V };
  /** the engine alone */ engine: { min: V; max: V };
  placed: Placed;
}
/** the parts that make the engine and its gearbox: what the engine bay holds (the fit check's footprint) */
export const CORE_PARTS = ['engineBlock', 'sump', 'cylinderHead', 'camCover', 'timingCover', 'clutchHousing', 'gearbox', 'differential'];

/** the powertrain built into a car's mesh at its site. In the drift look the same parts are laid out by the same rules
 *  and only drawn differently: the engine's scale, its bounds, the gearbox's and what the parts leave for the checks
 *  (`scale`, `engine`, `core`, `placed`) are the realistic build's */
export function addPowertrain(b: Build, S: PowertrainSpec, site: Site, opts: PowertrainOpts = {}): PowertrainBuilt {
  const st = resolveStyle(opts.style), R = lay(S, site, opts, null); if (!st) { const parts = R.g.emit(b); return { tris: R.g.count(), scale: R.scale, parts, core: coreOf(parts), engine: R.eb, placed: R.placed }; }
  const D = lay(S, site, opts, st), parts = D.g.emit(b);
  return { tris: D.g.count(), scale: R.scale, parts, core: coreOf(R.g.measure()), engine: R.eb, placed: R.placed };
}
const coreOf = (parts: Map<string, Bounds>) => { const core = { min: [Infinity, Infinity, Infinity] as V, max: [-Infinity, -Infinity, -Infinity] as V };
  for (const n of CORE_PARTS) { const p = parts.get(n); if (p) for (let k = 0; k < 3; k++) { core.min[k] = Math.min(core.min[k]!, p.min[k]!); core.max[k] = Math.max(core.max[k]!, p.max[k]!); } } return core; };
/** the powertrain laid out in a collector, in a look (null: the realistic one) */
function lay(S: PowertrainSpec, site: Site, opts: PowertrainOpts, st: DriftStyle | null): { g: Geo; scale: number; eb: { min: V; max: V }; placed: Placed } {
  const det = opts.detail ?? 2, { U, Vx } = dirs(site.engine.dir), long = Math.abs(U[0]) > 0.5, wr = site.wheels.r, at = site.engine.at;
  // the engine's true size, then its scale to the room
  const m = new Geo(), E0 = buildEngine(m, S, det, !long), nb = m.bounds(), nat = { len: nb.max[0] - Math.min(0, nb.min[0]), wid: 2 * Math.max(-nb.min[1], nb.max[1]), hgt: nb.max[2] - nb.min[2] };
  const bx = site.engine.box, scale = bx ? Math.min(1, bx.len / nat.len, bx.wid / nat.wid, bx.hgt / nat.hgt) : 1;
  // its place: an engine along the car has its clutch no further back than just behind the axle's line (the differential
  // sits right behind it, on that line); a dry sump lets the crank down
  const o: V = [long && U[0] < 0 ? Math.min(at[0], wr.x + 20) : at[0], at[1], at[2] - (S.sump === 'dry' ? DRY_DROP * E0.B * scale : 0)];
  const T = (p: V): V => [o[0] + (U[0] * p[0] + Vx[0] * p[1]) * scale, o[1] + (U[1] * p[0] + Vx[1] * p[1]) * scale, o[2] + p[2] * scale];
  const T1 = (p: V): V => [o[0] + U[0] * p[0] + Vx[0] * p[1], o[1] + U[1] * p[0] + Vx[1] * p[1], o[2] + p[2]];
  const g = new Geo(st); g.frame(T); const E = buildEngine(g, S, det, !long); g.frame(null);
  // the engine's bounds in the car: the realistic engine's in either look, so everything round it stands where it did
  let eb = g.bounds(); if (st) { const r = new Geo(); r.frame(T); buildEngine(r, S, det, !long); eb = r.bounds(); }
  const railZ = Math.max(site.foot + 78, (site.bay?.floor ?? 0) + 34);
  const placed: Placed = { gearboxEnd: o, gearboxTop: o[2], shafts: [], tails: [], railZ, railY: Math.min(long ? Math.max(E.half * scale + 40, 104 + 2 * 56 + 60) : (site.bay?.half ?? 600) - 90, wr.y - wr.w / 2 - 150) };
  const x: Ctx = { g, S, site, det, E, o, scale, U, Vx, long, T, T1, eb, out: placed };
  if (!opts.engineOnly) { drivetrain(x); exhaust(x); cooling(x); fuelAndOil(x); chassis(x); }
  if (st) bayProps(x, !!opts.bay, !!opts.engineOnly);
  return { g, scale, eb, placed };
}

/** the powertrain alone as a mesh (the engine designer's pedestal, the exploded view) */
export function powertrainMesh(S: PowertrainSpec, site: Site, opts: PowertrainOpts = {}): { mesh: Mesh; built: PowertrainBuilt } {
  const b = new Build(), built = addPowertrain(b, S, site, opts); return { mesh: b.mesh(site.length), built }; }
