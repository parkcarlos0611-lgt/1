// The 959's lump stretched by its frame's dimensions (docs/systems/115 §4-4): one map of the car's space applied to the
// control cage's points before the subdivision, so the shell, its lines and its loops are made again from the
// stretched cage. Each length is laid where the car's lines can take it without a wave:
//   front overhang  over the nose ahead of the front arch (x 0 .. 525): the nose's own strong curve takes the change of
//                   spacing (a stretch laid where a line is nearly straight would bend it hollow)
//   wheelbase       over the roof and the doors (x 1900 .. 2800): the roof is an arch over the cabin, so a longer middle
//                   only rounds it out; the screen and the back window keep their rake
//   rear overhang   over the engine lid, the wing's legs and the tail (x 3627 .. 4261)
//   the arches      not stretched at all: each arch's zone (its hub +- 415 mm) only moves, so the rings stay circles
//   width           a uniform scale across (an affine map changes no curvature's sign); the hubs move out with it
//   roof            the cabin above the belt (z over 870) raised, softly from the belt up (a C1 knee), the roof the most
//   ride            the whole body raised over its hubs (the wheels stay on the ground: the arches' gap grows)
// Every stretch is a weight over its zone (zero at the zone's ends with cosine ramps, so the map is C1 everywhere).
import type { V } from './subdiv';
import type { FrameDims } from '../../../core/frames';
export type { FrameDims };

export interface Frame { dims: FrameDims; /** the point's place on the stretched car */ at(p: V): V; /** x alone */ x(x: number): number;
  /** the stretched car's measurements (mm) */ length: number; axleF: number; axleR: number; wheelbase: number; trackF: number; trackR: number; width: number;
  /** the width's scale across */ kY: number; /** the body raised over the hubs */ ride: number; /** the arches' centres on the body (x, z) */ archF: [number, number]; archR: [number, number] }

/** the car's own measurements (mm; the cage's: cage.ts) */
export const DIM = { length: 4260, width: 1840, height: 1280, wheelbase: 2272, axleF: 940, axleR: 3212, trackF: 1504, trackR: 1550, hubZ: 320, tyreR: 320, archR: 355 } as const;
const RZ = 415;   // an arch's rigid zone each side of its hub
/** the zones the lengths are laid over: [start, end] in the car's own x */
/** the zones the lengths are laid over: [start, end] in the car's own x, and the weight's shape: a cosine rise over the
 *  first `rise` of the zone, flat, a cosine fall over the last `fall` (so the spacing changes most slowly where the
 *  line is straightest: the nose's weight rises fast at its steep face and falls slowly along the bonnet to the arch) */
export const ZONES = { overhangF: { x: [0, DIM.axleF - RZ], rise: 0.12, fall: 0.88 }, wheelbase: { x: [1900, 2800], rise: 0.3, fall: 0.3 }, overhangR: { x: [DIM.axleR + RZ, DIM.length + 1], rise: 0.5, fall: 0.5 } } as const;
type Zone = (typeof ZONES)[keyof typeof ZONES];
const weight = (z: Zone, t: number) => t < z.rise ? (1 - Math.cos(Math.PI * t / z.rise)) / 2 : t > 1 - z.fall ? (1 + Math.cos(Math.PI * (t - 1 + z.fall) / z.fall)) / 2 : 1;
/** the share of a zone's added length laid down by x (0 at its start, 1 at its end): the weight's integral, tabled */
const TABLES = new Map<Zone, Float64Array>(), N = 512;
const share = (x: number, z: Zone) => { let T = TABLES.get(z); if (!T) { T = new Float64Array(N + 1); for (let i = 1; i <= N; i++) T[i] = T[i - 1]! + (weight(z, (i - 0.5) / N)) / N; for (let i = 0; i <= N; i++) T[i] = T[i]! / T[N]!; TABLES.set(z, T); }
  const t = Math.max(0, Math.min(1, (x - z.x[0]) / (z.x[1] - z.x[0]))) * N, i = Math.min(N - 1, Math.floor(t)); return T[i]! + (T[i + 1]! - T[i]!) * (t - i); };
/** the roof's lift by height: 0 to the belt (870), 1 at the roof (1285), C1 at the belt (a quadratic knee over the first 15 %) */
const BELT = 870, TOP = 1285, KNEE = 0.15;
const lift = (z: number) => { const t = Math.max(0, (z - BELT) / (TOP - BELT)), r = t < KNEE ? t * t / (2 * KNEE) : t - KNEE / 2; return r / (1 - KNEE / 2); };

export const NO_DIMS: FrameDims = { overhangF: 0, wheelbase: 0, overhangR: 0, width: 0, roof: 0, ride: 0 };
const frames = new Map<string, Frame>();
export function frameOf(d0: Partial<FrameDims> = {}): Frame { const d = { ...NO_DIMS, ...d0 }, key = [d.overhangF, d.wheelbase, d.overhangR, d.width, d.roof, d.ride].join(',');
  let f = frames.get(key); if (f) return f;
  const Z = ZONES, x = (x: number) => x + d.overhangF * share(x, Z.overhangF) + d.wheelbase * share(x, Z.wheelbase) + d.overhangR * share(x, Z.overhangR);
  const kY = (DIM.width + d.width) / DIM.width, at = (p: V): V => [x(p[0]), p[1] * kY, p[2] + d.roof * lift(p[2]) + d.ride];
  f = { dims: d, at, x, length: x(DIM.length), axleF: x(DIM.axleF), axleR: x(DIM.axleR), wheelbase: x(DIM.axleR) - x(DIM.axleF), trackF: DIM.trackF * kY, trackR: DIM.trackR * kY, width: DIM.width + d.width, kY, ride: d.ride,
    archF: [x(DIM.axleF), DIM.hubZ + d.ride], archR: [x(DIM.axleR), DIM.hubZ - 2 + d.ride] };
  if (frames.size > 64) frames.clear(); frames.set(key, f); return f; }
export const STOCK_FRAME = frameOf();
/** the stretch of the map along x at a place (dx'/dx), for a part that must follow it (a head lamp in its socket) */
export const stretchAt = (f: Frame, x: number) => (f.x(x + 5) - f.x(x - 5)) / 10;
