// Every scenery prop by name (review 88), for the track's placings (race/scenery.ts).
import type { Mesh } from '../car/mesh';
import * as stands from './stands';
import * as paddock from './paddock';
import * as aerodrome from './aerodrome';
import * as railway from './railway';
export const PROPS: Record<string, () => Mesh> = { ...(stands as unknown as Record<string, () => Mesh>), ...(paddock as unknown as Record<string, () => Mesh>), ...(aerodrome as unknown as Record<string, () => Mesh>), ...(railway as unknown as Record<string, () => Mesh>) };
