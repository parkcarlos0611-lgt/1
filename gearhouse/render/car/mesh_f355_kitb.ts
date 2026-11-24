// The F355 built from the car kit's benchmark copy (render/car/kitb) and its assembly spec (render/car/cars/f355.kitb.ts,
// docs/systems/97_model_benchmark.md): the same car as render/car/mesh_f355.ts, made of the kit's shared panels and
// parts. Not registered in the game.
import type { Mesh } from './mesh';
import { assemble, type AssembleOpts } from './kitb/assemble';
import { F355_KIT } from './cars/f355.kitb';
import type { CarKit } from './kitb/spec';

export interface F355KitbOpts { /** a change to the sheet's lines (wheelbase, width) */ tweak?: AssembleOpts['tweak']; /** a spec with some panels or parts swapped */ spec?: Partial<CarKit> }
/** `spin` turns the wheels; `lamps` 0..1 raises the head lamps */
export function f355KitbMesh(spin = 0, lamps = 0, opts: F355KitbOpts = {}): Mesh { return assemble({ ...F355_KIT, ...opts.spec }, { spin, lamps, tweak: opts.tweak }).mesh; }
export const mesh = f355KitbMesh;
