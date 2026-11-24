// A design's suspension (core/design.ts, format 5: docs/systems/102, M4) made into its corners: the base's axles
// (hardpoints.ts) with the kind, the arms' ratio, the roll centre's preset and the caster the design sets, and each
// corner's static camber and toe set by its shims and its toe link (kinematics.ts Hardpoints.adj). The car's mesh
// (kit/parts/suspension.ts) and the physics (race/kin.ts) both take their corners from here, so the wheel the
// picture leans is the one the physics leans.
import type { BaseId, Design, SuspAxle, SuspDesign } from '../../../core/design';
import { SUSP_OWN } from '../../../core/design';
import { axlePoints, SUSPENSION, type AxleSpec, type Hardpoints, type StrutSpec, type SuspSpec, type SuspWheel, type WishboneSpec } from './hardpoints';
import { camberOf, solve, steerOf } from './kinematics';

/** how far each roll-centre preset sets the arms' inner pivots against the base's own (mm: the lower arm's pivots up, the
 *  upper's down; a strut's lower pivots alone): low, the base's own, high */
export const RC_SHIFT = { low: -22, mid: 0, high: 24 } as const;

/** a strut made from a base's wishbone: its lower arm, bar, tie rod and brake; its top mount over the coil-over's */
export function strutOf(W: WishboneSpec, caster: number): StrutSpec {
  return { type: 'macpherson', lower: W.lower, top: [W.damper.top[0] - 35, W.damper.top[1] + 110], foot: W.upper.lift ?? 150, caster,
    damper: { spring: [W.damper.spring[0] + 22, W.damper.spring[1]], body: W.damper.body + 6 }, ...(W.bar ? { bar: W.bar } : {}), steer: W.steer, brake: W.brake }; }

/** a base's axle with the design's settings: its kind, the arms' ratio (against the base's own), the roll centre's
 *  preset, the caster (a front's; set where it differs from the base's own) */
export function axleFor(W: AxleSpec, a: SuspAxle & { caster?: number }, own: SuspAxle & { caster?: number }, front: boolean): AxleSpec {
  if (W.type !== 'doubleWishbone') return W;
  const rc = RC_SHIFT[a.rc] ?? 0, caster = a.caster !== undefined && own.caster !== undefined && Math.abs(a.caster - own.caster) > 1e-9 ? a.caster : undefined;
  if (a.type === 'macpherson') return strutOf({ ...W, lower: { ...W.lower, rise: W.lower.rise + rc * 1.6 } }, caster ?? own.caster ?? 4);
  if (a.type === 'beamLeaf') return { type: 'beamLeaf' };
  const k = Math.abs(a.arm - own.arm) > 1e-9 ? a.arm / own.arm : 1, multi = a.type === 'multilink' && !front;
  const upper = { ...W.upper, len: Math.round(W.upper.len * k * (multi ? 1.18 : 1)), fall: W.upper.fall + rc, ...(multi ? { span: [W.upper.span[0] - 30, W.upper.span[1]] as [number, number] } : {}) };
  return { ...W, lower: { ...W.lower, rise: W.lower.rise + rc }, upper, ...(caster !== undefined ? { caster } : {}), ...(multi ? { kind: 'multilink' as const } : {}) }; }

/** the base's suspension with a design's settings */
export function suspFor(base: BaseId, s: SuspDesign): SuspSpec { const S = SUSPENSION[base]!, own = SUSP_OWN[base];
  return { ...S, front: axleFor(S.front, s.front, own.front, true), rear: axleFor(S.rear, s.rear, own.rear, false) }; }

const DEG = Math.PI / 180;
/** a corner with its static camber and toe (degrees: - the top in; + in) set at its static ride z0: the upper pivots
 *  shimmed across for the camber, a rear's toe link's inner end moved for the toe (a front's toe is its steer: frontToe) */
export function setCorner(H: Hardpoints, z0: number, camber: number, toe: number): Hardpoints {
  const s = H.side, camOf = (c: number, t: number) => { const P = solve({ ...H, adj: { camber: c, toe: t } }, z0); return { cam: s * camberOf(P.R), toe: -s * steerOf(P.R) }; };
  let c = 0, t = 0;
  for (let it = 0; it < 6; it++) { const a = camOf(c, t), dc = 0.5, b = camOf(c + dc, t), j = (b.cam - a.cam) / dc; if (Math.abs(j) > 1e-9) c -= (a.cam - camber * DEG) / j;
    if (!H.steer.rack) { const e = camOf(c, t + 0.5), jt = (e.toe - a.toe) / 0.5; if (Math.abs(jt) > 1e-9) t -= (a.toe - toe * DEG) / jt; } }
  return { ...H, adj: { camber: c, toe: H.steer.rack ? 0 : t } }; }
/** a front corner's steer (rad, the renderer's way) that gives its static toe (degrees, + in) */
export const frontToe = (side: 1 | -1, toe: number): number => -side * toe * DEG;

/** the four corners (+y front, -y front, +y rear, -y rear) of a suspension about its wheels, set at the static ride
 *  (`ride`: the body raised that many mm over its wheels, which then hang as much lower on their arms) */
export function rigCorners(S: SuspSpec, wheels: { f: SuspWheel; r: SuspWheel }, setup?: SuspDesign, ride = 0): Hardpoints[] {
  const out: Hardpoints[] = [];
  for (const front of [true, false]) { const ax = front ? S.front : S.rear, a = setup ? (front ? setup.front : setup.rear) : null;
    for (const H of axlePoints(ax, front ? wheels.f : wheels.r, front)) out.push(a ? setCorner(H, -ride, a.camber, a.toe) : H); }
  return out; }

/** what a design's suspension is made of: its base's axles with its settings, its wheels (the kit's lines with the
 *  design's track, tyres and rims), the body's ride over them and the settings */
export interface DesignSusp { spec: SuspSpec; wheels: { f: SuspWheel; r: SuspWheel }; ride: number; setup: SuspDesign; base: BaseId }
export type { Design };
