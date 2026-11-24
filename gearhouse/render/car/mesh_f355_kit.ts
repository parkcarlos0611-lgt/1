// The Ferrari F355 built from the car kit (render/car/kit) and its assembly spec (render/car/cars/f355.kit.ts): the
// shared panels and parts (the pointed nose with its openings cut in, the flying buttresses, the louvred cover, the
// long scoop, the ducktail, the star wheels). Not registered in the game yet (render/car/mesh_f355.ts is).
import type { Mesh } from './mesh';
import { assemble, type AssembleOpts } from './kit/assemble';
import { F355_KIT } from './cars/f355.kit';
import type { CarKit } from './kit/spec';

export interface F355KitOpts { /** a change to the sheet's lines (wheelbase, width) */ tweak?: AssembleOpts['tweak']; /** a spec with some panels or parts swapped */ spec?: Partial<CarKit> }
/** `spin` turns the wheels; `lamps` 0..1 raises the head lamps */
export function f355KitMesh(spin = 0, lamps = 0, opts: F355KitOpts = {}): Mesh { return assemble({ ...F355_KIT, ...opts.spec }, { spin, lamps, tweak: opts.tweak }).mesh; }
export const mesh = f355KitMesh;
