// The N33's lump stretched by its frame's dimensions (docs/systems/115 §4-4, docs/systems/117 R1): the shared map
// (render/car/frame.ts) with the front-engined coupe's own measurements and zones:
//   front overhang  over the nose's face (x 0 .. 300): the bumper, the lamps' band and the bonnet's round front take it;
//                   laid further back, along the wings' rising crest, it bent the crest hollow behind the lamps
//   wheelbase       over the bonnet's back, the front wings behind the front arch and the screen's foot (x 1345 .. 1640):
//                   the engine bay is what grows, as on a long-nosed GT; the cabin, the screen's rake and the doors are kept
//   rear overhang   over the boot behind the rear arch (x 4085 .. the tail): the deck, the tail panel and the bumper
//   roof            the cabin above the belt (z over 918) raised, softly from the belt up, the roof (1364) the most
import { frameMaker, type Frame, type FrameDims } from '../frame';
export { NO_DIMS, stretchAt, type Frame, type FrameDims } from '../frame';

/** the car's own measurements (mm; the cage's: cage.ts; docs/systems/117 §3, data/cars/spec/bnr33.json): 245/45 R17
 *  tyres (radius 326), the arches' lips at 368 round the hubs (the blueprint's: about 370) */
export const DIM = { length: 4675, width: 1780, height: 1364, wheelbase: 2720, axleF: 950, axleR: 3670, trackF: 1480, trackR: 1490, hubZ: 326, tyreR: 326, rimR: 216, archR: 368 } as const;
const RZ = 395;   // an arch's rigid zone each side of its hub (its ring reaches 377)
export const ZONES = { overhangF: { x: [0, 300], rise: 0.3, fall: 0.6 }, wheelbase: { x: [DIM.axleF + RZ, 1640], rise: 0.35, fall: 0.35 }, overhangR: { x: [DIM.axleR + RZ, DIM.length + 1], rise: 0.4, fall: 0.6 } } as const;
export const frameOf: (d?: Partial<FrameDims>) => Frame = frameMaker({ dim: DIM, archZ: [DIM.hubZ, DIM.hubZ], zones: ZONES, belt: 918, top: 1364, knee: 0.15 });
export const STOCK_FRAME = frameOf();
