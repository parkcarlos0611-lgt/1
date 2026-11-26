// The EB110 built from the car kit (render/car/kit) and its assembly spec (render/car/cars/eb110.kit.ts,
// docs/systems/96_kit_conversion_plan.md): the same car as the panel-built render/car/mesh_eb110.ts (kept as the
// reference), made of the kit's shared panels and parts, its shell closed at every seam.
import type { Mesh } from './mesh';
import { assemble, type AssembleOpts } from './kit/assemble';
import { EB110_KIT } from './cars/eb110.kit';
import type { CarKit } from './kit/spec';

export interface Eb110KitOpts { /** a change to the sheet's lines (wheelbase, width) */ tweak?: AssembleOpts['tweak']; /** a spec with some panels or parts swapped */ spec?: Partial<CarKit> }
/** `spin` turns the wheels; `wing` 0..1 raises the rear wing (0: it lies in the tail) */
export function eb110KitMesh(spin = 0, wing = 0, opts: Eb110KitOpts = {}): Mesh { return assemble({ ...EB110_KIT, ...opts.spec }, { spin, wing, tweak: opts.tweak }).mesh; }
export const mesh = eb110KitMesh;
