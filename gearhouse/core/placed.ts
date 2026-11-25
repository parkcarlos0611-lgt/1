// Parts placed freely on the body (docs/systems/115 §5, §7: format 6's `body.parts`), data only. Step P1a places the
// number plates, the first of the free parts: each a place on the skin in surface coordinates (a face of the body's
// control cage and a point (u, v) in it, 0..1 each), so the place follows the lump when its dimensions stretch the
// cage (render/car/skin.ts evaluates it on the shell made again), with its turn about the skin's normal, a small tilt
// and its size. A plate with no entry sits where the car's own plate sits (the stock place); so does every older design
// and every opponent. The render side reads these (render/car/p959 p959Model `placed`); the builder writes them.

/** the parts that may be placed so far: the front and the rear plate (one each, no mirror twin: they sit on the centre line or anywhere off it) */
export type PlacedId = 'plateF' | 'plateR';
export const PLACED_IDS: readonly PlacedId[] = ['plateF', 'plateR'];
/** a place on a body's skin: the cage face and the point in it (u along the face's first edge, v along its last) */
export interface SurfaceAt { f: number; u: number; v: number }
export interface Placed { id: PlacedId; at: SurfaceAt; /** degrees about the skin's normal (+: the reader's right side up) */ rot: number;
  /** degrees the plate leans back from the skin's plane about its own across axis (+: its top back) */ tilt: number; /** times the part's own size */ scale: number }
/** the plates' freedoms: the turn, the tilt, the size (a plate is 335 x 170 mm; the law's size, so only a little) */
export const PLACED_LIMITS = { rot: [-20, 20], tilt: [-15, 15], scale: [0.85, 1.15] } as const;
/** the most a cage's face number can be (the 959's cage has about 700; a later lump may have more) */
const MAX_FACE = 1 << 14;

const clamp = (v: number, [a, b]: readonly [number, number]) => Math.min(b, Math.max(a, v));
const num = (v: unknown, d: number) => typeof v === 'number' && Number.isFinite(v) ? v : d;
/** one entry from anything (a file, a link): null when it is not one; its numbers rounded (u, v to a thousandth: about a
 *  tenth of a millimetre on a cage face) and within the limits */
export function fitPlacedOne(v: unknown): Placed | null { if (!v || typeof v !== 'object') return null; const o = v as Record<string, unknown>, a = (o.at && typeof o.at === 'object' ? o.at : {}) as Record<string, unknown>;
  if (!(PLACED_IDS as unknown[]).includes(o.id)) return null; const f = Math.round(num(a.f, -1)); if (f < 0 || f >= MAX_FACE) return null;
  const r3 = (x: number) => Math.round(clamp(x, [0, 1]) * 1000) / 1000, r1 = (x: number, L: readonly [number, number]) => Math.round(clamp(x, L) * 10) / 10;
  return { id: o.id as PlacedId, at: { f, u: r3(num(a.u, 0.5)), v: r3(num(a.v, 0.5)) }, rot: r1(num(o.rot, 0), PLACED_LIMITS.rot), tilt: r1(num(o.tilt, 0), PLACED_LIMITS.tilt),
    scale: Math.round(clamp(num(o.scale, 1), PLACED_LIMITS.scale) * 100) / 100 }; }
/** the list from anything: each part once (the last entry for it wins), in the parts' order; undefined when none is left
 *  (the design then has no `parts` at all, as an older one) */
export function fitPlaced(v: unknown): Placed[] | undefined { if (!Array.isArray(v)) return undefined; const by = new Map<PlacedId, Placed>();
  for (const e of v) { const p = fitPlacedOne(e); if (p) by.set(p.id, p); }
  const out = PLACED_IDS.flatMap(id => by.has(id) ? [by.get(id)!] : []); return out.length ? out : undefined; }
/** a part's entry in a list (undefined: at its stock place) */
export const placedOf = (ps: readonly Placed[] | undefined, id: PlacedId): Placed | undefined => ps?.find(p => p.id === id);
/** the list with one part's entry put (or taken away with `null`: the part back at its stock place) */
export function withPlaced(ps: readonly Placed[] | undefined, id: PlacedId, p: Placed | null): Placed[] | undefined {
  const rest = (ps ?? []).filter(q => q.id !== id), out = p ? PLACED_IDS.flatMap(k => k === id ? [p] : rest.filter(q => q.id === k)) : rest; return out.length ? out : undefined; }
