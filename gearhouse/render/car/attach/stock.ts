// Where the free parts go first (docs/systems/115 P1): each lump's stock set (the real car's parts at the real car's
// places: "순정 세트") and the place a part takes when the library puts a new one on. A place is aimed as a ray at the
// skin (from a point on the stretched car along a direction), so it follows the lump's dimensions; the ray's hit gives
// the surface coordinates kept in the design (core/placed.ts).
import type { V } from '../mesh';
import type { Skin } from '../skin';
import { freshPart, placedOf, PART_KINDS, type FreeId, type Placed } from '../../../core/placed';
import { frameOf as p959Frame } from '../p959/frame';
import { frameOf as n33Frame } from '../n33/frame';
import type { FrameDims } from '../frame';

/** a part's place as a ray at the skin, and what its entry starts with (its size, depth, angles; one side only) */
export interface Aim { id: FreeId; o: V; d: V; scale?: number; depth?: number; rot?: number; tilt?: number; one?: true }
type Lump = 'p959' | 'bnr33';
/** the stock set of a lump on its stretched frame: the 599's mirrors on the doors' front corners, its two big tips in
 *  the rear bumper's slots and the crest on the front lid (its ring wing is the lump's own: P4's lump A' takes it off);
 *  the N33's door mirrors, the GT wing on the boot lid, the twin tips at the rear left and the amber side markers on the
 *  front wings behind the bumper */
export function stockAims(base: Lump, dims?: Partial<FrameDims>): Aim[] { if (base === 'p959') { const f = p959Frame(dims), at = f.at;
    const m = at([1680, 760, 850]), e = at([4258, 335, 256]), c = at([215, 0, 588]), n: V = [-0.4, 0, 0.92];
    return [{ id: 'mirror', o: [m[0], m[1] + 700, m[2]], d: [0, -1, 0], depth: 120 }, { id: 'exhaust1', o: [e[0] + 600, e[1], e[2]], d: [-1, 0, 0], scale: 0.95, depth: 14 },
      { id: 'badge', o: [c[0] + n[0] * 300, 0, c[2] + n[2] * 300], d: [-n[0], 0, -n[2]], scale: 1.16, depth: 1.2 }]; }
  const f = n33Frame(dims), at = f.at, m = at([1610, 860, 900]), w = at([4380, 0, 1000]), e = at([4560, 430, 300]), k = at([420, 860, 600]);
  return [{ id: 'mirror', o: [m[0], m[1] + 700, m[2]], d: [0, -1, 0], depth: 105, scale: 0.92 }, { id: 'wingGT', o: [w[0], 0, w[2] + 2000], d: [0, 0, -1], scale: 0.95, depth: 150, tilt: 6 },
    { id: 'exhaust2', o: [e[0] + 600, e[1], e[2]], d: [-1, 0, 0], scale: 1, depth: 18, one: true }, { id: 'marker', o: [k[0], k[1] + 700, k[2]], d: [0, -1, 0], scale: 0.9 }]; }
/** where a new part of a kind is put when the lump has no stock place for it (or that one is taken): aimed from the
 *  skin's bounds, so any lump has one */
export function defaultAim(id: FreeId, box: [V, V]): Aim { const [lo, hi] = box, L = hi[0] - lo[0], H = hi[2] - lo[2], W = hi[1] - lo[1], x = (f: number) => lo[0] + L * f, z = (f: number) => lo[2] + H * f;
  switch (PART_KINDS[id].group) {
    case 'mirror': return { id, o: [x(0.37), hi[1] + 600, z(0.66)], d: [0, -1, 0] };
    case 'wing': return { id, o: [x(0.93), 0, hi[2] + 1000], d: [0, 0, -1] };
    case 'exhaust': return { id, o: [hi[0] + 600, W * 0.18, z(0.2)], d: [-1, 0, 0] };
    case 'badge': return { id, o: [lo[0] - 600, 0, z(0.45)], d: [1, 0, 0] };
    case 'marker': return { id, o: [x(0.12), hi[1] + 600, z(0.42)], d: [0, -1, 0] };
    default: return id === 'vent' ? { id, o: [x(0.2), W * 0.16, hi[2] + 1000], d: [0, 0, -1] } : { id, o: [x(0.22), 0, hi[2] + 1000], d: [0, 0, -1] }; } }
/** an aim's entry on a skin (null: the ray finds no surface place) */
export function aimPart(skin: Skin, a: Aim, n = 0): Placed | null { const h = skin.hit(a.o, a.d, 1e5); if (!h?.at) return null; const p = freshPart(a.id, h.at, n);
  return { ...p, ...(a.scale !== undefined ? { scale: a.scale } : {}), ...(a.depth !== undefined ? { depth: a.depth } : {}), ...(a.rot !== undefined ? { rot: a.rot } : {}), ...(a.tilt !== undefined ? { tilt: a.tilt } : {}), ...(a.one ? { one: true as const } : {}) }; }
/** the stock set's entries on a lump's skin */
export const stockParts = (base: Lump, skin: Skin, dims?: Partial<FrameDims>): Placed[] => stockAims(base, dims).flatMap(a => { const p = aimPart(skin, a); return p ? [p] : []; });
/** a new part's entry: at the lump's stock place for its kind when the design has none of that kind yet, else at the default */
export function newPart(base: Lump, skin: Skin, id: FreeId, n: number, have: readonly Placed[] | undefined, dims?: Partial<FrameDims>): Placed | null {
  const st = !placedOf(have, id, 0) && n === 0 ? stockAims(base, dims).find(a => a.id === id) : undefined;
  return (st ? aimPart(skin, st, n) : null) ?? (skin.box ? aimPart(skin, defaultAim(id, skin.box), n) : null); }
