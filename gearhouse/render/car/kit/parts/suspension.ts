// The suspension (render/car/suspension: the arms, the uprights, the coil-overs, the anti-roll bars, the tie rods, the
// brakes), set in the car from its base's hardpoints about the car's own wheels (the tyres a design fits, the track it
// sets). It is built in the chassis' place before the body's warp: a body raised over its wheels (the tweak's ride)
// leaves the wheels that much lower on their arms, and the warp then lifts the chassis' points with the engine.
import type { Ctx } from '../ctx';
import type { Wheel } from '../lines';
import { SUSPENSION, addSuspension, type Detail, type SuspBuilt, type SuspWheel } from '../../suspension';

/** a base with no suspension of its own drawn yet has none */
export function suspension(x: Ctx, detail: Detail = 2): SuspBuilt | null {
  const S = SUSPENSION[x.k.id]; if (!S) return null;
  const wheel = (w: Wheel): SuspWheel => ({ x: w.x, y: w.y, r: w.r, w: w.w, rim: w.rim, back: x.k.wheel.back[0] * w.w / 2 });
  return addSuspension(x.e.b, S, { f: wheel(x.L.wheels.f), r: wheel(x.L.wheels.r) }, { detail, ride: x.L.tweak.ride ?? 0 });
}
