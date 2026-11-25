// The 959's lump stretched by its frame's dimensions (docs/systems/115 §4-4): the shared map (render/car/frame.ts)
// with the 959's own measurements and zones. Each length is laid where the car's lines can take it without a wave:
//   front overhang  over the nose ahead of the front arch (x 0 .. 525): the nose's own strong curve takes the change of
//                   spacing (a stretch laid where a line is nearly straight would bend it hollow)
//   wheelbase       over the roof and the doors (x 1900 .. 2800): the roof is an arch over the cabin, so a longer middle
//                   only rounds it out; the screen and the back window keep their rake
//   rear overhang   over the engine lid, the wing's legs and the tail (x 3627 .. 4261)
//   the arches      not stretched at all: each arch's zone (its hub +- 415 mm) only moves, so the rings stay circles
//   roof            the cabin above the belt (z over 870) raised, softly from the belt up, the roof (1285) the most
import { frameMaker, type Frame, type FrameDims } from '../frame';
export { NO_DIMS, stretchAt, type Frame, type FrameDims } from '../frame';

/** the car's own measurements (mm; the cage's: cage.ts) */
export const DIM = { length: 4260, width: 1840, height: 1280, wheelbase: 2272, axleF: 940, axleR: 3212, trackF: 1504, trackR: 1550, hubZ: 320, tyreR: 320, archR: 355 } as const;
const RZ = 415;   // an arch's rigid zone each side of its hub
/** the zones the lengths are laid over: [start, end] in the car's own x, and the weight's shape (the nose's weight rises
 *  fast at its steep face and falls slowly along the bonnet to the arch) */
export const ZONES = { overhangF: { x: [0, DIM.axleF - RZ], rise: 0.12, fall: 0.88 }, wheelbase: { x: [1900, 2800], rise: 0.3, fall: 0.3 }, overhangR: { x: [DIM.axleR + RZ, DIM.length + 1], rise: 0.5, fall: 0.5 } } as const;
export const frameOf: (d?: Partial<FrameDims>) => Frame = frameMaker({ dim: DIM, archZ: [DIM.hubZ, DIM.hubZ - 2], zones: ZONES, belt: 870, top: 1285, knee: 0.15 });
export const STOCK_FRAME = frameOf();
