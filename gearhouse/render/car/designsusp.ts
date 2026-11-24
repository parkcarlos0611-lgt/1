// A design's suspension as the physics needs it (docs/systems/102, M4): the corners' makings (render/car/suspension/
// setup.ts) about the wheels the car's mesh is built with (the kit's lines with the design's track, tyres and rims, the
// wheel's closed back), so the physics' tables (race/kin.ts) come from the very linkage the picture moves.
import type { BaseId, Design } from '../../core/design';
import { BASES, SUSP_OWN, DESIGN_NSX, DESIGN_F355, DESIGN_EB110 } from '../../core/design';
import { designKit } from './design';
import { makeLines } from './kit/lines';
import { kitWheels } from './kit/parts/suspension';
import { suspFor, type DesignSusp } from './suspension/setup';

const cache = new Map<string, DesignSusp>();
/** a design's suspension: its base's axles with its settings, its wheels, its body's ride over them */
export function designSusp(d: Design): DesignSusp | null {
  if (!BASES.includes(d.body.base)) return null; const key = JSON.stringify([d.body, d.kit.tyres, d.kit.rim, d.susp]), had = cache.get(key); if (had) return had;
  const { kit, tweak } = designKit(d), L = makeLines(kit.lines, tweak), setup = d.susp ?? SUSP_OWN[d.body.base];
  const out: DesignSusp = { spec: suspFor(d.body.base, setup), wheels: kitWheels(kit, L.wheels), ride: tweak.ride ?? 0, setup, base: d.body.base };
  if (cache.size > 200) cache.clear(); cache.set(key, out); return out; }
/** the kit's own cars' suspension (the registered cars built from a base: the NSX, the F355 and its F1, the EB110) */
const OWN: Record<string, Design> = { nsx: DESIGN_NSX, f355: DESIGN_F355, f355f1: DESIGN_F355, eb110: DESIGN_EB110 };
export const kitCarSusp = (id: string): DesignSusp | null => OWN[id] ? designSusp(OWN[id]!) : null;
export type { BaseId };
