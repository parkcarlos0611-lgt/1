// The standard section (docs/systems/95_nsx_kit_breakdown.md): every station of every car carries the same chain of
// points, zone by zone, so neighbouring panels share their border points exactly and nothing gaps. Caps (the nose and
// the tail going round to the centre line) use the same chain, so their columns run on into the flank's.
//
//   flank chain (FLANK.N = 12 points, from the top edge down):
//     K                 1   the crest / belt / ridge (the flank's top edge)
//     shoulder          3   the shoulder's arc from K (level there) down to the widest line
//     H                 1   the widest line
//     door              2   the door's face down to the sill
//     sill              2   the sill's crease and the step under it
//     face              1   the sill's face
//     foot              2   the foot and the tuck under it (the floor's edge)
//   top section (TOP.N = 8 columns across the bonnet, the screen, the roof, the rear glass, from the centre line out):
//     centre..shut      4   the bonnet's panel up to its shut line (column TOP.SHUT)
//     cover             3   beside it (a lamp cover, the wings' tops), the last at TOP.EDGE
//     K                 1   the crest (the front top's last column; the glass's edge on the glasshouse)
import { bez, lerp, lin, sm, type Tab, type V } from './geom';
import type { At, Lines } from './lines';

export const FLANK = { K: 0, SHOULDER: [1, 2, 3] as const, H: 4, DOOR: [5, 6] as const, SILL: 7, STEP: 8, FACE: 9, FOOT: 10, TUCK: 11, N: 12 } as const;
/** the same chain read as the tail's lines (where the tail's levels take over behind the rear wheel): the blade's top,
 *  its trailing roll and under-edge, the lamp panel's top, middle and foot, the bumper's top edge, the plate's top and
 *  foot, the valance's top (its middle and foot the last two) */
export const TAILP = { BLADE: 0, ROLL: 1, UNDER: 2, LAMP_TOP: 3, LAMP_MID: 4, LAMP_FOOT: 5, BUMPER: 6, PLATE_TOP: 7, PLATE_FOOT: 8, VALANCE: 9 } as const;
export const TOP = { N: 8, SHUT: 3, COVER: [4, 5, 6] as const, EDGE: 6, K: 7 } as const;
/** the last index of the chain (its cells run 0..NK-1) */
export const NK = FLANK.N - 1;

export interface SectionSpec {
  /** the shoulder's arc from K to H: the first control `reach` of the way out and `drop` of the height down, the second `lift` of the height over H */
  shoulder: { reach: number; drop: number; lift: number };
  /** the door's two points, as shares of the way from H down to the sill's crease */
  door: [number, number];
  /** the door's two points on height lines of the sheet instead (a crisp edge that stays level along the car) */
  doorZ?: [string, string];
  /** the levels under the sill's crease (lines.sill) and over the foot (lines.foot): the step, the sill's face; the tuck under the foot */
  step: number; face: number; tuck: number;
  /** how far the flank stands in from the widest line by height, [z, inset], z falling from the sill's crease to the tuck */
  inset: Tab;
  /** behind the rear wheel the chain's levels move to the tail's (one per chain point) and its inset deepens toward the foot */
  tail: { from: At; to: At; levels: number[]; pow: number; /** the levels move in a run of this power, 1 straight (default: eased in and out) */ run?: number };
}

export interface BandSpec { reach: number; drop: number; lift: number }
/** the arc from a top edge K (level there) down to a widest line H (upright there), by its shape */
export const bandOf = (b: BandSpec) => (K: V, H: V, t: number): V => { const dz = K[2] - H[2], P1: V = [lerp(K[0], H[0], b.reach), lerp(K[1], H[1], b.reach), K[2] - b.drop * dz], P2: V = [H[0], H[1], H[2] + b.lift * dz]; return bez(K, P1, P2, H, t); };

export interface Flank {
  K(x: number): V; H(x: number): V;
  /** the shoulder's arc from K to H at t */
  band(K: V, H: V, t: number): V;
  /** the flank's skin at station x and height z */
  surf(x: number, z: number): V;
  /** the chain at x, FLANK.N points, cut by the arches (`raw`: not cut) */
  chain(x: number, raw?: boolean): V[];
  /** the share of the tail's levels at x */
  tailShare(x: number): number;
}

/** the flank from the lines: K the top edge (the panels' front top decides it ahead of the screen) */
export function flank(L: Lines, s: SectionSpec, K: (x: number) => V): Flank {
  if (s.tail.levels.length !== FLANK.N) throw new Error('section: the tail needs a level per chain point');
  const INS = lin(s.inset), sill = L.sill, foot = L.foot, insSill = INS(sill), insFoot = INS(foot), t0 = L.X(s.tail.from), t1 = L.X(s.tail.to);
  const H = (x: number): V => [x, L.half(x), L.z('shoulder')(x)];
  const tailShare = (x: number) => s.tail.run ? Math.max(0, Math.min(1, (x - t0) / (t1 - t0))) ** s.tail.run : sm(t0, t1, x);
  const dz = s.doorZ ? [L.z(s.doorZ[0]), L.z(s.doorZ[1])] : null;
  const band = bandOf(s.shoulder);
  const inset = (x: number, z: number, zH: number) => { const std = z >= sill ? insSill * (zH - z) / (zH - sill) : INS(z), u = tailShare(x); return u > 0 ? lerp(std, insFoot * Math.max(0, (zH - z) / (zH - foot)) ** s.tail.pow, u) : std; };
  const surf = (x: number, z: number): V => { const k = K(x), h = H(x); if (z >= k[2]) return k; if (z < h[2]) return [x, h[1] - inset(x, z, h[2]), z];
    let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (band(k, h, m)[2] > z) lo = m; else hi = m; } return band(k, h, (lo + hi) / 2); };
  const nS = FLANK.SHOULDER.length;
  const chain = (x: number, raw = false): V[] => { const k = K(x), h = H(x), zH = h[2], u = tailShare(x), az = raw ? 0 : L.archZ(x), out: V[] = [k];
    const zs = [dz ? Math.min(zH, dz[0]!(x)) : lerp(zH, sill, s.door[0]), dz ? Math.min(zH, dz[1]!(x)) : lerp(zH, sill, s.door[1]), sill, s.step, s.face, foot, s.tuck];
    for (let i = 1; i < FLANK.N; i++) { let p: V = i < FLANK.H ? band(k, h, i / (nS + 1)) : i === FLANK.H ? h : [x, h[1] - inset(x, zs[i - FLANK.H - 1]!, zH), zs[i - FLANK.H - 1]!];
      if (u > 0) p = surf(x, lerp(p[2], s.tail.levels[i]!, u)); if (az > 0 && p[2] < az) p = surf(x, az); out.push(p); }
    return out; };
  return { K, H, band, surf, chain, tailShare };
}
