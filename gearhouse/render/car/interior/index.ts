// A car's interior in the drift-game style (docs/systems/109 section 4): assembled from parts by a cabin's anchors, so
// it goes into any car's cabin box; 4,000 to 5,000 triangles with the driver and the cage. What can be swapped is
// data: the wheel (the 911's four-spoke or a dished three-spoke), the seats (pleated sport seats or buckets), the
// lever, the handbrake, the cage, the trim's colours, the helmet's. The needles hang on bones (Mesh.dial, Mesh.dials)
// and are posed every frame from the drive's state (gauges.ts: stepDials, poseDials).
//   interiorMesh({ ...INTERIORS.stock })                     the 959's cabin as it left the works
//   interiorMesh({ ...INTERIORS.drift, trim: 'black' })      the same cabin stripped for drifting
import type { Mesh } from '../mesh';
import { InteriorBuild, leaning, type Frame } from './build';
import { P959_CABIN, TRIMS, type CabinAnchors, type Trim, type TrimName } from './anchors';
import { gaugeSet, P959_GAUGES, type DialRig, type GaugeCar } from './gauges';
import { seat, dash, steeringWheel, shifter, handbrake, pedals, tunnel, floorAndRear, doorCards, driver, cage, previewShell, type SeatStyle, type WheelStyle } from './parts';

export * from './anchors'; export * from './gauges'; export { REGIONS, SHEET, regionUV, interiorSheet, redrawGauges, type Region } from './atlas';
export interface InteriorOptions { /** the cabin it goes into (default the 959's) */ cabin?: CabinAnchors; trim?: TrimName | Trim; wheel?: WheelStyle; seats?: SeatStyle; shifter?: 'tall' | 'short'; handbrake?: 'lever' | 'hydro';
  cage?: boolean; driver?: boolean; /** the N33's dash (docs/systems/117 R2): four dials, the centre stack's gauges, the A pillar's pod */ binnacle?: 'five' | 'four'; consoleGauges?: boolean; pillarPod?: boolean; /** the passenger's seat (drift cars often run without) */ passengerSeat?: boolean; /** the door cards, floor and rear trim standing in for the body's own */ shellTrim?: boolean; /** pod gauges and stickers on the dash */ pods?: boolean; stickers?: boolean; /** which door cards are in (a picture through an open door leaves one out) */ doors?: 'both' | 'L' | 'R' | 'none';
  helmet?: string; suit?: string; gloves?: string; cageColour?: string; bucketColour?: string; /** whose dials (the red line, the top speed) */ gauges?: GaugeCar; /** a plain cabin shell with a windscreen round it, for pictures */ preview?: string | false; /** the mesh's length (the car's, so it sits where the car's cabin is) */ length?: number }
/** the two interiors of the first car: as built, and stripped for drifting */
export const INTERIORS = {
  stock: { trim: 'black', wheel: 'stock', seats: 'sport', shifter: 'tall', handbrake: 'lever', cage: false, driver: true, passengerSeat: true, shellTrim: true },
  drift: { trim: 'black', wheel: 'drift', seats: 'bucket', shifter: 'short', handbrake: 'hydro', cage: true, driver: true, passengerSeat: true, shellTrim: true, pods: true, stickers: true },
  /** the N33's (docs/systems/117 R2, right-hand drive by its cabin): as built, four dials and the four-spoke wheel, the
   *  three gauges in the centre stack; and the tuned one of the photographs, a dished wheel, buckets, a boost pod on the A pillar */
  n33Stock: { trim: 'black', wheel: 'four', seats: 'sport', shifter: 'tall', handbrake: 'lever', cage: false, driver: true, passengerSeat: true, shellTrim: true, binnacle: 'four', consoleGauges: true },
  n33Sport: { trim: 'black', wheel: 'drift', seats: 'bucket', shifter: 'short', handbrake: 'lever', cage: false, driver: true, passengerSeat: true, shellTrim: true, binnacle: 'four', consoleGauges: true, pillarPod: true },
} as const satisfies Record<string, InteriorOptions>;
/** the budget's groups (docs/systems/109 section 4): which group a part's name falls in */
export const GROUPS: [string, RegExp][] = [['dash', /^(dash|gauge)/], ['wheel', /^steerWheel/], ['seats', /^seat/], ['driver', /^driver/], ['controls', /^(shifter|handbrake|pedal|tunnel|doorCard)/], ['cage', /^cage/], ['floor', /^cabin/], ['preview', /^(bodyShell|windscreen)/]];
export const groupOf = (name: string): string => GROUPS.find(([, re]) => re.test(name))?.[0] ?? 'other';
/** triangles by group (the preview shell is not the interior's and is not counted in `total`) */
export function interiorBudget(M: Mesh): Record<string, number> { const out: Record<string, number> = { total: 0 }; for (let t = 0; t < M.n; t++) { const g = groupOf(M.names?.[M.part[t]!] ?? ''); out[g] = (out[g] ?? 0) + 1; if (g !== 'preview') out.total!++; } return out; }

export function interiorMesh(opt: InteriorOptions = INTERIORS.stock): Mesh { const o = { ...INTERIORS.stock, ...opt }, A = o.cabin ?? P959_CABIN, T: Trim = typeof o.trim === 'string' ? TRIMS[o.trim] : o.trim ?? TRIMS.black, b = new InteriorBuild();
  const faces = gaugeSet(o.gauges ?? P959_GAUGES), hipF = (side: number): Frame => leaning([A.hip[0], side * Math.abs(A.hip[1]), A.hip[2]], 0), floorDz = A.floorZ - A.hip[2], seatCol = o.seats === 'bucket' ? o.bucketColour ?? '#274a9a' : T.seat;
  if (o.shellTrim !== false) { floorAndRear(b, A, T); doorCards(b, A, T, o.doors ?? 'both'); }
  tunnel(b, A, T);
  const four = o.binnacle === 'four', D = dash(b, A, T, four ? [faces[4]!, faces[2]!, faces[3]!, faces[1]!] : faces, { pods: o.pods, stickers: o.stickers, binnacle: o.binnacle, consoleGauges: o.consoleGauges, pillarPod: o.pillarPod }), W = steeringWheel(b, A, T, o.wheel ?? 'stock', D.dials.length + 1);
  seat(b, hipF(A.side), o.seats ?? 'sport', A.side > 0 ? 'seatL' : 'seatR', seatCol, A.recline, floorDz, T.metal);
  if (o.passengerSeat !== false) seat(b, hipF(-A.side), o.seats ?? 'sport', A.side > 0 ? 'seatR' : 'seatL', seatCol, A.recline, floorDz, T.metal);
  shifter(b, [A.hip[0] - 395, 0, A.tunnelZ], T, o.shifter ?? 'tall');
  handbrake(b, o.handbrake === 'hydro' ? [A.hip[0] - 330, A.side * 62, A.tunnelZ - 60] : [A.hip[0] - 40, 0, A.tunnelZ], T, o.handbrake ?? 'lever');
  const feet = pedals(b, [A.dashX - 200, A.wheel[1], A.floorZ], T);
  if (o.driver !== false) driver(b, hipF(A.side), { recline: A.recline, wheel: W.f, rimR: W.rimR, feet, suit: o.suit ?? '#c9302c', helmet: o.helmet ?? '#ece9e2', gloves: o.gloves ?? '#1b1b1d' });
  if (o.cage) cage(b, A, o.cageColour ?? '#c4c8cd');
  if (o.preview) previewShell(b, A, o.preview);
  const dials: DialRig = { dials: [...D.dials, W.dial], bones: D.dials.length + 2 };
  return { ...b.mesh(o.length ?? 4260), dials }; }
