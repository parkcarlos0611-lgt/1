// The engine: the shared engine module (render/car/enginemesh.ts) placed in the bay as the spec says.
import type { Ctx } from '../ctx';
import { addEngine, type EngineOpts, type EngineSpec } from '../../enginemesh';
import type { V } from '../geom';

export function engine(x: Ctx, spec: EngineSpec, at: V, opts: EngineOpts): void { addEngine(x.e.b, spec, [x.L.mx(at[0]), x.L.my(at[1]), at[2]], opts); }
