// The suspension (render/car/suspension: the arms, the uprights, the coil-overs, the anti-roll bars, the tie rods, the
// brakes), set in the car from its base's hardpoints about the car's own wheels (the tyres a design fits, the track it
// sets). It is built in the chassis' place before the body's warp: a body raised over its wheels (the tweak's ride)
// leaves the wheels that much lower on their arms, and the warp then lifts the chassis' points with the engine.
// A design's suspension settings (the kit's `susp`: format 5) choose the kind, the arms and the static camber and toe
// (render/car/suspension/setup.ts), as the physics does from the same corners; a kit's own car takes its base's own
// settings (core/design.ts SUSP_OWN), as the physics does for it.
import type { Ctx } from '../ctx';
import type { Wheel } from '../lines';
import { SUSPENSION, addSuspension, type Detail, type SuspBuilt, type SuspWheel } from '../../suspension';
import { suspFor } from '../../suspension/setup';
import { BASES, SUSP_OWN, type BaseId } from '../../../../core/design';

/** a base with no suspension of its own drawn yet has none */
export function suspension(x: Ctx, detail: Detail = 2): SuspBuilt | null {
  const S0 = SUSPENSION[x.k.id]; if (!S0) return null; const base0 = x.k.id as BaseId, set = x.k.susp ?? (BASES.includes(base0) ? SUSP_OWN[base0] : undefined), base = x.k.id as BaseId, S = set && BASES.includes(base) ? suspFor(base, set) : S0;
  return addSuspension(x.e.b, S, kitWheels(x.k, x.L.wheels), { detail, ride: x.L.tweak.ride ?? 0, ...(set ? { setup: set } : {}) });
}
/** the wheels the suspension is built about: the lines' wheels with the kit's wheel's closed back */
export function kitWheels(k: { wheel: { back: number[] } }, W: { f: Wheel; r: Wheel }): { f: SuspWheel; r: SuspWheel } {
  const wheel = (w: Wheel): SuspWheel => ({ x: w.x, y: w.y, r: w.r, w: w.w, rim: w.rim, back: k.wheel.back[0]! * w.w / 2 }); return { f: wheel(W.f), r: wheel(W.r) }; }
