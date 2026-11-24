// The NSX built from the car kit (render/car/kit) and its assembly spec (render/car/cars/nsx.kit.ts): the same car
// as render/car/mesh_nsx.ts, made of the kit's shared panels and parts. Not registered in the game yet.
import type { Mesh } from './mesh';
import { assemble, type AssembleOpts } from './kit/assemble';
import { NSX_KIT } from './cars/nsx.kit';
import type { CarKit } from './kit/spec';

export interface NsxKitOpts { /** a change to the sheet's lines (wheelbase, width) */ tweak?: AssembleOpts['tweak']; /** a spec with some panels or parts swapped */ spec?: Partial<CarKit> }
/** `spin` turns the wheels; `lamps` 0..1 raises the head lamps */
export function nsxKitMesh(spin = 0, lamps = 0, opts: NsxKitOpts = {}): Mesh { return assemble({ ...NSX_KIT, ...opts.spec }, { spin, lamps, tweak: opts.tweak }).mesh; }
export const mesh = nsxKitMesh;
