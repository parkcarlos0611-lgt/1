// A design's suspension as the physics needs it (docs/systems/102, M4): the corners' makings (render/car/suspension/
// setup.ts) about the wheels the car's mesh is built with (the kit's lines with the design's track, tyres and rims, the
// wheel's closed back), so the physics' tables (race/kin.ts) come from the very linkage the picture moves.
import type { BaseId, Design } from '../../core/design';
import { BASES, SUSP_OWN, DESIGN_NSX, DESIGN_F355, DESIGN_EB110, DESIGN_P959, isModelBase } from '../../core/design';
import { MODEL_BODIES } from './bodies';
import { designKit } from './design';
import { makeLines } from './kit/lines';
import { kitWheels } from './kit/parts/suspension';
import { suspFor, type DesignSusp } from './suspension/setup';

const cache = new Map<string, DesignSusp>();
/** a design's suspension: its base's axles with its settings, its wheels, its body's ride over them */
export function designSusp(d: Design): DesignSusp | null {
  const base = d.body.base, setup0 = d.susp ?? SUSP_OWN[base];
  // a model-built body: its own axles about its model's hubs (render/car/bodies.ts builds the drawn rig the same way)
  if (!(BASES as string[]).includes(base) && !isModelBase(base)) return null; const key = JSON.stringify([base, d.body.model ? 0 : d.body, d.kit.tyres, d.kit.rim, d.susp]), had = cache.get(key); if (had) return had;
  if (isModelBase(base)) { const out: DesignSusp = { spec: suspFor(base, setup0), wheels: MODEL_BODIES[base].wheels(d), ride: 0, setup: setup0, base }; cache.set(key, out); return out; }
  const { kit, tweak } = designKit(d), L = makeLines(kit.lines, tweak), setup = d.susp ?? SUSP_OWN[d.body.base];
  const out: DesignSusp = { spec: suspFor(d.body.base, setup), wheels: kitWheels(kit, L.wheels), ride: tweak.ride ?? 0, setup, base: d.body.base };
  if (cache.size > 200) cache.clear(); cache.set(key, out); return out; }
/** the kit's own cars' suspension (the registered cars built from a base: the NSX, the F355 and its F1, the EB110) */
const OWN: Record<string, Design> = { nsx: DESIGN_NSX, f355: DESIGN_F355, f355f1: DESIGN_F355, eb110: DESIGN_EB110, p959: DESIGN_P959 };
export const kitCarSusp = (id: string): DesignSusp | null => OWN[id] ? designSusp(OWN[id]!) : null;
export type { BaseId };
