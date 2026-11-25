// A body lump stretched by its frame's dimensions (docs/systems/115 §4-4), for any cage-built body: one map of the
// car's space applied to the control cage's points before the subdivision, so the shell, its lines and its loops are
// made again from the stretched cage. Each body gives its own measurements and its own zones, the places along the car
// where its lines can take each length without a wave (a rear-engined body lays its wheelbase over the roof, its rear
// overhang over the engine lid; a front-engined one lays the wheelbase over the bonnet behind the front arch, so the
// engine bay grows with it, and the rear overhang over the boot behind the rear arch):
//   the arches      not stretched at all: each arch's zone (its hub +- `rz`) only moves, so the rings stay circles
//   width           a uniform scale across (an affine map changes no curvature's sign); the hubs move out with it
//   roof            the cabin above the belt raised, softly from the belt up (a C1 knee), the roof the most
//   ride            the whole body raised over its hubs (the wheels stay on the ground: the arches' gap grows)
// Every stretch is a weight over its zone (zero at the zone's ends with cosine ramps, so the map is C1 everywhere).
// The 959's (render/car/p959/frame.ts) and the N33's (render/car/n33/frame.ts) are this map with their own tables.
import type { V } from './p959/subdiv';
import type { FrameDims } from '../../core/frames';
export type { FrameDims };

export interface Frame { dims: FrameDims; /** the point's place on the stretched car */ at(p: V): V; /** x alone */ x(x: number): number;
  /** the stretched car's measurements (mm) */ length: number; axleF: number; axleR: number; wheelbase: number; trackF: number; trackR: number; width: number;
  /** the width's scale across */ kY: number; /** the body raised over the hubs */ ride: number; /** the arches' centres on the body (x, z) */ archF: [number, number]; archR: [number, number] }

/** a length's zone: [start, end] in the car's own x, and the weight's shape: a cosine rise over the first `rise` of the
 *  zone, flat, a cosine fall over the last `fall` (so the spacing changes most slowly where the line is straightest) */
export interface Zone { readonly x: readonly [number, number]; readonly rise: number; readonly fall: number }
export interface FrameSpec {
  /** the body's own measurements (mm): its length, width, axles, tracks and the arches' centres' heights on the body */
  dim: { readonly length: number; readonly width: number; readonly axleF: number; readonly axleR: number; readonly trackF: number; readonly trackR: number };
  archZ: readonly [number, number];
  /** the zones the three lengths are laid over */ zones: { readonly overhangF: Zone; readonly wheelbase: Zone; readonly overhangR: Zone };
  /** the roof's lift by height: 0 to the belt, 1 at the roof's top, C1 at the belt (a quadratic knee over the first `knee` of it) */
  belt: number; top: number; knee: number }

const weight = (z: Zone, t: number) => t < z.rise ? (1 - Math.cos(Math.PI * t / z.rise)) / 2 : t > 1 - z.fall ? (1 + Math.cos(Math.PI * (t - 1 + z.fall) / z.fall)) / 2 : 1;
/** the share of a zone's added length laid down by x (0 at its start, 1 at its end): the weight's integral, tabled */
const TABLES = new Map<Zone, Float64Array>(), N = 512;
const share = (x: number, z: Zone) => { let T = TABLES.get(z); if (!T) { T = new Float64Array(N + 1); for (let i = 1; i <= N; i++) T[i] = T[i - 1]! + (weight(z, (i - 0.5) / N)) / N; for (let i = 0; i <= N; i++) T[i] = T[i]! / T[N]!; TABLES.set(z, T); }
  const t = Math.max(0, Math.min(1, (x - z.x[0]) / (z.x[1] - z.x[0]))) * N, i = Math.min(N - 1, Math.floor(t)); return T[i]! + (T[i + 1]! - T[i]!) * (t - i); };

export const NO_DIMS: FrameDims = { overhangF: 0, wheelbase: 0, overhangR: 0, width: 0, roof: 0, ride: 0 };
/** a body's stretch: the map for each set of dimensions (the last few kept) */
export function frameMaker(S: FrameSpec): (d?: Partial<FrameDims>) => Frame {
  const D = S.dim, Z = S.zones, lift = (z: number) => { const t = Math.max(0, (z - S.belt) / (S.top - S.belt)), r = t < S.knee ? t * t / (2 * S.knee) : t - S.knee / 2; return r / (1 - S.knee / 2); };
  const frames = new Map<string, Frame>();
  return (d0 = {}) => { const d = { ...NO_DIMS, ...d0 }, key = [d.overhangF, d.wheelbase, d.overhangR, d.width, d.roof, d.ride].join(',');
    let f = frames.get(key); if (f) return f;
    const x = (x: number) => x + d.overhangF * share(x, Z.overhangF) + d.wheelbase * share(x, Z.wheelbase) + d.overhangR * share(x, Z.overhangR);
    const kY = (D.width + d.width) / D.width, at = (p: V): V => [x(p[0]), p[1] * kY, p[2] + d.roof * lift(p[2]) + d.ride];
    f = { dims: d, at, x, length: x(D.length), axleF: x(D.axleF), axleR: x(D.axleR), wheelbase: x(D.axleR) - x(D.axleF), trackF: D.trackF * kY, trackR: D.trackR * kY, width: D.width + d.width, kY, ride: d.ride,
      archF: [x(D.axleF), S.archZ[0] + d.ride], archR: [x(D.axleR), S.archZ[1] + d.ride] };
    if (frames.size > 64) frames.clear(); frames.set(key, f); return f; }; }
/** the stretch of the map along x at a place (dx'/dx), for a part that must follow it (a head lamp in its socket) */
export const stretchAt = (f: Frame, x: number) => (f.x(x + 5) - f.x(x - 5)) / 10;
