// Where the free parts go first (docs/systems/115 P1): each lump's stock set (the real car's parts at the real car's
// places: "순정 세트") and the place a part takes when the library puts a new one on. A place is aimed as a ray at the
// skin (from a point on the stretched car along a direction), so it follows the lump's dimensions; the ray's hit gives
// the surface coordinates kept in the design (core/placed.ts).
import type { V } from '../mesh';
import type { Skin } from '../skin';
import { freshPart, placedOf, isPlate, PART_KINDS, type FreeId, type Placed } from '../../../core/placed';
import { frameOf as p959Frame } from '../p959/frame';
import { frameOf as n33Frame } from '../n33/frame';
import type { FrameDims } from '../frame';

/** a part's place as a ray at the skin, and what its entry starts with (its size, depth, angles; one side only) */
export interface Aim { id: FreeId; o: V; d: V; scale?: number; depth?: number; rot?: number; tilt?: number; one?: true; sx?: number }
type Lump = 'p959' | 'bnr33';
/** the stock set of a lump on its stretched frame: the 599's mirrors on the doors' front corners, its two big tips in
 *  the rear bumper's slots and the crest on the front lid (its ring wing is the lump's own: P4's lump A' takes it off),
 *  and its openings as hole parts (P2): the round head lamps in their sockets, the tail lamp band across the tail and
 *  round its corners, the side intakes behind the doors and the engine lid's grille as a cut louvre; the N33's door
 *  mirrors, the GT wing on the boot lid, the twin tips at the rear left and the amber side markers on the front wings
 *  behind the bumper, and in its lump's sockets' places (placeholders until R3 harvests its own): square projector
 *  lamps in the lamp band, the grille between them and two round tail lamps a side. A hole part is aimed along the
 *  socket's own normal (measured on the lump's shell) */
export function stockAims(base: Lump, dims?: Partial<FrameDims>): Aim[] { const along = (id: FreeId, p: V, n: V, x: Partial<Aim> = {}): Aim => ({ id, o: [p[0] + n[0] * 400, p[1] + n[1] * 400, p[2] + n[2] * 400], d: [-n[0], -n[1], -n[2]], ...x });
  if (base === 'p959') { const f = p959Frame(dims), at = f.at;
    const m = at([1680, 760, 850]), e = at([4258, 335, 256]), c = at([215, 0, 588]), n: V = [-0.4, 0, 0.92];
    return [{ id: 'mirror', o: [m[0], m[1] + 700, m[2]], d: [0, -1, 0], depth: 120 }, { id: 'exhaust1', o: [e[0] + 600, e[1], e[2]], d: [-1, 0, 0], scale: 0.95, depth: 14 },
      { id: 'badge', o: [c[0] + n[0] * 300, 0, c[2] + n[2] * 300], d: [-n[0], 0, -n[2]], scale: 1.16, depth: 1.2 },
      along('lampRound', at([270, 615, 640]), [-0.624, 0, 0.781], { depth: 14 }), along('tailBand', at([4253, 0, 622]), [1, 0, 0], { depth: 9, scale: 0.95, sx: 1.07 }),
      along('sideIntake', at([2696, 852, 694]), [-0.298, 0.948, 0.114], { depth: 34, sx: 1.08 }), along('louvreCut', at([3706, 0, 870]), [0.418, 0, 0.908], { depth: 14, scale: 1.64, sx: 1.52 })]; }
  const f = n33Frame(dims), at = f.at, m = at([1610, 860, 900]), w = at([4380, 0, 1000]), e = at([4560, 430, 300]), k = at([420, 860, 600]), tn: V = [0.943, 0.316, 0.102];
  return [{ id: 'mirror', o: [m[0], m[1] + 700, m[2]], d: [0, -1, 0], depth: 105, scale: 0.92 }, { id: 'wingGT', o: [w[0], 0, w[2] + 2000], d: [0, 0, -1], scale: 0.95, depth: 150, tilt: 6 },
    { id: 'exhaust2', o: [e[0] + 600, e[1], e[2]], d: [-1, 0, 0], scale: 1, depth: 18, one: true }, { id: 'marker', o: [k[0], k[1] + 700, k[2]], d: [0, -1, 0], scale: 0.9 },
    along('lampSquare', at([200, 600, 636]), [-0.849, 0.49, 0.197], { scale: 0.55, sx: 2.4, depth: 12 }), along('grille', at([80, 0, 637]), [-0.86, 0, 0.51], { scale: 0.7, sx: 1.55, depth: 40 }),
    along('tailRound', at([4545, 494, 809]), tn, { scale: 1.2, depth: 10 }), along('tailRound', at([4485, 674, 809]), tn, { scale: 1.2, depth: 10 })]; }
/** where a new part of a kind is put when the lump has no stock place for it (or that one is taken): aimed from the
 *  skin's bounds, so any lump has one */
export function defaultAim(id: FreeId, box: [V, V]): Aim { const [lo, hi] = box, L = hi[0] - lo[0], H = hi[2] - lo[2], W = hi[1] - lo[1], x = (f: number) => lo[0] + L * f, z = (f: number) => lo[2] + H * f;
  switch (PART_KINDS[id].group) {
    case 'mirror': return { id, o: [x(0.37), hi[1] + 600, z(0.58)], d: [0, -1, 0] };
    case 'wing': return { id, o: [x(0.93), 0, hi[2] + 1000], d: [0, 0, -1] };
    case 'exhaust': return { id, o: [hi[0] + 600, W * 0.18, z(0.2)], d: [-1, 0, 0] };
    case 'badge': return { id, o: [lo[0] - 600, 0, z(0.45)], d: [1, 0, 0] };
    case 'marker': return { id, o: [x(0.12), hi[1] + 600, z(0.42)], d: [0, -1, 0] };
    case 'lamp': return { id, o: [lo[0] - 600, W * 0.3, z(0.45)], d: [1, 0, 0] };
    case 'tail': return id === 'tailBand' ? { id, o: [hi[0] + 600, 0, z(0.42)], d: [-1, 0, 0] } : { id, o: [hi[0] + 600, W * 0.3, z(0.42)], d: [-1, 0, 0] };
    case 'intake': return id === 'sideIntake' ? { id, o: [x(0.64), hi[1] + 600, z(0.55)], d: [0, -1, 0] } : { id, o: [lo[0] - 600, 0, z(0.3)], d: [1, 0, 0] };
    case 'ventCut': return id === 'ventCut' ? { id, o: [x(0.15), W * 0.18, hi[2] + 1000], d: [0, 0, -1] } : { id, o: [x(0.14), 0, hi[2] + 1000], d: [0, 0, -1] };
    default: return id === 'vent' ? { id, o: [x(0.2), W * 0.16, hi[2] + 1000], d: [0, 0, -1] } : { id, o: [x(0.22), 0, hi[2] + 1000], d: [0, 0, -1] }; } }
/** an aim's entry on a skin (null: the ray finds no surface place) */
export function aimPart(skin: Skin, a: Aim, n = 0): Placed | null { const h = skin.hit(a.o, a.d, 1e5); if (!h?.at) return null; const p = freshPart(a.id, h.at, n);
  return { ...p, ...(a.sx !== undefined ? { sx: a.sx } : {}), ...(a.scale !== undefined ? { scale: a.scale } : {}), ...(a.depth !== undefined ? { depth: a.depth } : {}), ...(a.rot !== undefined ? { rot: a.rot } : {}), ...(a.tilt !== undefined ? { tilt: a.tilt } : {}), ...(a.one ? { one: true as const } : {}) }; }
/** the stock set's entries on a lump's skin (a kind twice: its first and its second); `holes` false: the surface parts alone */
export const stockParts = (base: Lump, skin: Skin, dims?: Partial<FrameDims>, holes = true): Placed[] => { const seen = new Map<FreeId, number>();
  return stockAims(base, dims).filter(a => holes || !PART_KINDS[a.id].hole).flatMap(a => { const n = seen.get(a.id) ?? 0; seen.set(a.id, n + 1); const p = aimPart(skin, a, n); return p ? [p] : []; }); };
/** a new part's entry: at the lump's stock place for its kind (or, a hole part, for its group: any head lamp in the
 *  head lamps' place) when the design has none of that kind (group) yet, else at the default */
export function newPart(base: Lump, skin: Skin, id: FreeId, n: number, have: readonly Placed[] | undefined, dims?: Partial<FrameDims>): Placed | null {
  const K = PART_KINDS[id], free = n === 0 && !placedOf(have, id, 0) && !(K.hole && have?.some(p => !isPlate(p.id) && PART_KINDS[p.id].group === K.group)), aims = stockAims(base, dims);
  const st = free ? aims.find(a => a.id === id) ?? (K.hole ? (() => { const a = aims.find(a => PART_KINDS[a.id].group === K.group && PART_KINDS[a.id].hole); return a ? { ...a, id, sx: undefined, scale: undefined } : undefined; })() : undefined) : undefined;
  return (st ? aimPart(skin, st, n) : null) ?? (skin.box ? aimPart(skin, defaultAim(id, skin.box), n) : null); }
