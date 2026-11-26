// Every scenery prop by name (review 88), for the track's placings (race/scenery.ts).
import type { Mesh } from '../car/mesh';
import * as stands from './stands';
import * as paddock from './paddock';
import * as aerodrome from './aerodrome';
import * as railway from './railway';
import * as enrich from './enrich';
import * as trackside from './trackside';
/** each prop's mesh; a few take a size (an abutment its height) from the placing's `arg` */
export const PROPS: Record<string, (arg?: number) => Mesh> = { ...(stands as unknown as Record<string, (arg?: number) => Mesh>), ...(paddock as unknown as Record<string, (arg?: number) => Mesh>), ...(aerodrome as unknown as Record<string, (arg?: number) => Mesh>), ...(railway as unknown as Record<string, (arg?: number) => Mesh>), ...(enrich as unknown as Record<string, (arg?: number) => Mesh>), ...(trackside as unknown as Record<string, (arg?: number) => Mesh>) };
