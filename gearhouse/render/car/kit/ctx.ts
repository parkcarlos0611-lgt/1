// What every panel and part function is handed: the emitter, the shared grids, the lines, the spec and the pose.
import type { Emit } from './emit';
import type { Lines } from './lines';
import type { Skin } from './skin';
import type { CarKit, Palette } from './spec';
import type { V } from './geom';

export interface Ctx {
  e: Emit; s: Skin; L: Lines; k: CarKit; c: Palette;
  /** the pop-up lamps raised 0..1; the wheels turned (radians) */
  lamps: number; spin: number;
  /** an active rear wing raised 0..1 */
  wing: number;
  /** the front top's row for a station (a landmark, mm, or one of the rows ahead of the arch) */
  topRow(x: number | string): number;
  /** the place of a sheet point in the car's frame */
  P(p: V): V;
}
export const UP: V = [0, 0, 1];
