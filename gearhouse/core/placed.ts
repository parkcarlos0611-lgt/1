// Parts placed freely on the body (docs/systems/115 §5, §7: format 6's `body.parts`), data only. Each entry is a place on
// the skin in surface coordinates (a face of the body's control cage and a point (u, v) in it, 0..1 each), so the place
// follows the lump when its dimensions stretch the cage (render/car/skin.ts evaluates it on the shell made again), with
// its turn about the skin's normal, a tilt, its size and (the free parts) its depth off the skin.
//   - P1a: the number plates, one each, no mirror twin. A plate with no entry sits where the car's own plate sits.
//   - P1: the surface parts (mirrors, rear wings, exhaust tips, the crest badge, side marker lamps, stick-on vents and
//     louvres), as many of a kind as its limit; a kind that comes in pairs is mirrored across the centre line unless the
//     entry says "one side only"; one that may sit on the line is single there. They cut no holes.
//   - P2: the hole-cutting parts (head lamps, tail lamps, intakes and grilles, cut vents and louvres): the same entries,
//     with a width ratio (`sx`); the body's skin is cut to each one's footprint (render/car/attach/holes.ts), never stored.
// The render side reads these (render/car/attach for the free parts, render/car/p959/plates.ts for the plates); the
// builder writes them (ui/builder_place.ts).

export type PlateId = 'plateF' | 'plateR';
/** the free surface parts' kinds (docs/systems/115 P1, §5-4's first column) */
export type SurfId = 'mirror' | 'wingRing' | 'wingGT' | 'wingStay' | 'exhaust1' | 'exhaust2' | 'badge' | 'marker' | 'vent' | 'louvre' | 'lip' | 'garnish' | 'handle' | 'fuelLid';
/** the hole-cutting parts (docs/systems/115 P2, §5-4's second column) */
export type HoleId = 'lampRound' | 'lampEllipsoid' | 'lampSquare' | 'lampSlant' | 'fogLamp' | 'tailBand' | 'tailRound' | 'grille' | 'grilleSlot' | 'intakeOpen' | 'sideIntake' | 'ventCut' | 'louvreCut';
export type FreeId = SurfId | HoleId;
export type PlacedId = PlateId | FreeId;
export const PLATE_IDS: readonly PlateId[] = ['plateF', 'plateR'];
export const HOLE_IDS: readonly HoleId[] = ['lampRound', 'lampEllipsoid', 'lampSquare', 'lampSlant', 'fogLamp', 'tailBand', 'tailRound', 'grille', 'grilleSlot', 'intakeOpen', 'sideIntake', 'ventCut', 'louvreCut'];
export const FREE_IDS: readonly FreeId[] = ['mirror', 'wingRing', 'wingGT', 'wingStay', 'exhaust1', 'exhaust2', 'badge', 'marker', 'vent', 'louvre', 'lip', 'garnish', 'handle', 'fuelLid', ...HOLE_IDS];
export const isHole = (id: PlacedId): id is HoleId => (HOLE_IDS as readonly string[]).includes(id);
export const PLACED_IDS: readonly PlacedId[] = [...PLATE_IDS, ...FREE_IDS];
export const isPlate = (id: PlacedId): id is PlateId => id === 'plateF' || id === 'plateR';
/** a place on a body's skin: the cage face and the point in it (u along the face's first edge, v along its last) */
export interface SurfaceAt { f: number; u: number; v: number }
export interface Placed { id: PlacedId; /** the free parts: which one of its kind (absent: the first) */ n?: number; at: SurfaceAt;
  /** degrees about the skin's normal (+: the reader's right side up) */ rot: number;
  /** degrees the part leans back from the skin's plane about its own across axis (+: its top back); a wing: its blade's angle */ tilt: number;
  /** times the part's own size (a plate: 335 x 170 mm; a free part: its kind's `size`) */ scale: number;
  /** the free parts: how far it stands off the skin (mm: a mirror's arm, a wing's height, a tip's reach, a stick-on's thickness) */ depth?: number;
  /** the free parts that come in pairs: this one alone, no mirror twin ("한쪽만") */ one?: true;
  /** the hole parts: the width against the kind's own shape (1: as made; the height is the size's) */ sx?: number }
/** the plates' freedoms: the turn, the tilt, the size (the law's size, so only a little) */
export const PLACED_LIMITS = { rot: [-20, 20], tilt: [-15, 15], scale: [0.85, 1.15] } as const;

/** a free part's kind: its group in the library, its name, its own size (mm at scale 1: what `sizeOf` names), the ranges
 *  of its freedoms and its defaults, whether it comes in pairs (mirrored across the centre line), whether it may sit
 *  on the line (a single part there; `centreOnly`: only there), and how many of it a design may have */
export interface PartKind { group: PartGroup; name: string; size: number; sizeOf: string; scale: readonly [number, number];
  depth: readonly [number, number]; depth0: number; depthName: string; rot: readonly [number, number]; tilt: readonly [number, number]; tilt0: number; tiltName: string;
  pair: boolean; centre: boolean; centreOnly?: boolean; max: number;
  /** a hole part (P2): its footprint's height against its width (`size` the width), the width ratio's range, the
   *  outline's shape (an ellipse or a rounded rectangle, its corner radius against the smaller half side), and for a
   *  band that wraps round a corner the radius it is laid round (mm at scale 1; its middle `flat` of the width laid
   *  straight); 'poly': its own convex outline, counter-clockwise, in half sizes (x, y each -1..1) */
  hole?: { aspect: number; sx: readonly [number, number]; shape: 'ellipse' | 'rrect' | 'poly'; r?: number; wrap?: { r: number; flat: number }; poly?: readonly (readonly [number, number])[] } }
export type PartGroup = 'mirror' | 'wing' | 'exhaust' | 'badge' | 'marker' | 'vent' | 'lamp' | 'tail' | 'intake' | 'ventCut' | 'lip' | 'trim';
export const PART_GROUPS: readonly [PartGroup, string][] = [['lamp', '헤드램프 (구멍)'], ['tail', '테일램프 (구멍)'], ['intake', '흡기구·그릴 (구멍)'], ['ventCut', '벤트·루버 (구멍)'],
  ['mirror', '미러'], ['wing', '뒤 윙'], ['lip', '앞 립'], ['exhaust', '배기구 끝'], ['badge', '배지'], ['marker', '옆 표시등'], ['trim', '손잡이·주유구·가니시'], ['vent', '벤트·루버 (붙임)']];
export const PART_KINDS: Record<FreeId, PartKind> = {
  mirror: { group: 'mirror', name: '미러', size: 124, sizeOf: '폭', scale: [0.6, 1.6], depth: [40, 220], depth0: 120, depthName: '팔 길이', rot: [-30, 30], tilt: [-20, 20], tilt0: 0, tiltName: '기울기', pair: true, centre: false, max: 4 },
  wingRing: { group: 'wing', name: '링 윙 (599형)', size: 1500, sizeOf: '폭', scale: [0.6, 1.25], depth: [60, 400], depth0: 130, depthName: '높이', rot: [0, 0], tilt: [-5, 20], tilt0: 4, tiltName: '날개 각', pair: false, centre: true, centreOnly: true, max: 2 },
  wingGT: { group: 'wing', name: 'GT 윙', size: 1500, sizeOf: '폭', scale: [0.6, 1.25], depth: [80, 450], depth0: 200, depthName: '높이', rot: [0, 0], tilt: [-5, 25], tilt0: 8, tiltName: '날개 각', pair: false, centre: true, centreOnly: true, max: 2 },
  /** the N33's wing (docs/systems/117 R3): a blade between two end stays that stand on the deck's corners, its angle set at their pivots */
  wingStay: { group: 'wing', name: '각도 조절 윙 (끝 지주)', size: 1340, sizeOf: '폭', scale: [0.7, 1.4], depth: [80, 400], depth0: 190, depthName: '높이', rot: [0, 0], tilt: [-4, 20], tilt0: 6, tiltName: '날개 각', pair: false, centre: true, centreOnly: true, max: 2 },
  exhaust1: { group: 'exhaust', name: '배기구 끝 1개', size: 84, sizeOf: '지름', scale: [0.6, 1.7], depth: [0, 120], depth0: 25, depthName: '돌출', rot: [-15, 15], tilt: [-15, 15], tilt0: 0, tiltName: '위아래', pair: true, centre: true, max: 4 },
  exhaust2: { group: 'exhaust', name: '배기구 끝 2개', size: 76, sizeOf: '지름', scale: [0.6, 1.7], depth: [0, 120], depth0: 25, depthName: '돌출', rot: [-15, 15], tilt: [-15, 15], tilt0: 0, tiltName: '위아래', pair: true, centre: true, max: 4 },
  /** the crest (docs/systems/116 B4): one, no twin, on the line or off it; its shape fixed (no stretching), 25..120 mm high, +-30 degrees */
  badge: { group: 'badge', name: '문장 배지', size: 50, sizeOf: '높이', scale: [0.5, 2.4], depth: [0.5, 6], depth0: 1.2, depthName: '두께', rot: [-30, 30], tilt: [0, 0], tilt0: 0, tiltName: '', pair: false, centre: true, max: 4 },
  marker: { group: 'marker', name: '옆 표시등', size: 70, sizeOf: '폭', scale: [0.5, 2.2], depth: [1, 8], depth0: 2.5, depthName: '두께', rot: [-45, 45], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: false, max: 6 },
  vent: { group: 'vent', name: '벤트 (붙임)', size: 220, sizeOf: '폭', scale: [0.35, 2.7], depth: [2, 20], depth0: 6, depthName: '높이', rot: [-90, 90], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: true, max: 8 },
  louvre: { group: 'vent', name: '루버 (붙임)', size: 360, sizeOf: '폭', scale: [0.3, 1.7], depth: [4, 25], depth0: 10, depthName: '날개 높이', rot: [-90, 90], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: true, max: 6 },
  /** a front lip: a blade under a front-facing face, following it across the car and round its corners */
  lip: { group: 'lip', name: '앞 립', size: 1500, sizeOf: '폭', scale: [0.6, 1.25], depth: [15, 120], depth0: 45, depthName: '돌출', rot: [0, 0], tilt: [-10, 20], tilt0: 6, tiltName: '숙임', pair: false, centre: true, centreOnly: true, max: 2 },
  /** a tail's garnish band: a strip across a rear face with clear lamp strips at its ends and an emblem's place in its middle */
  garnish: { group: 'trim', name: '테일 가니시 띠', size: 1380, sizeOf: '폭', scale: [0.5, 1.3], depth: [1, 10], depth0: 3, depthName: '두께', rot: [0, 0], tilt: [0, 0], tilt0: 0, tiltName: '', pair: false, centre: true, centreOnly: true, max: 2 },
  handle: { group: 'trim', name: '문 손잡이', size: 150, sizeOf: '폭', scale: [0.6, 1.6], depth: [1, 10], depth0: 4, depthName: '두께', rot: [-30, 30], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: false, max: 4 },
  fuelLid: { group: 'trim', name: '주유구 덮개 (선)', size: 150, sizeOf: '폭', scale: [0.6, 1.8], depth: [0.3, 3], depth0: 0.6, depthName: '두께', rot: [-30, 30], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: false, max: 2 },
  // ---- P2: the parts that cut their hole (render/car/attach/holes.ts); `depth` is how deep the pocket behind goes.
  //      The sizes are the 599's own openings (docs/systems/109 S3): its lamp sockets 234 x 278 mm, the tail lamp band
  //      across the tail and round its corners, the side intake 109 x 190, the engine lid's grille 936 x 345
  lampRound: { group: 'lamp', name: '헤드램프 (둥근 렌즈)', size: 224, sizeOf: '폭', scale: [0.6, 1.6], depth: [8, 40], depth0: 14, depthName: '깊이', rot: [-45, 45], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: false, max: 4, hole: { aspect: 1.2, sx: [0.7, 1.6], shape: 'ellipse' } },
  lampEllipsoid: { group: 'lamp', name: '헤드램프 (프로젝터 2개)', size: 224, sizeOf: '폭', scale: [0.6, 1.6], depth: [8, 40], depth0: 14, depthName: '깊이', rot: [-45, 45], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: false, max: 4, hole: { aspect: 1.2, sx: [0.7, 2], shape: 'ellipse' } },
  lampSquare: { group: 'lamp', name: '헤드램프 (사각 프로젝터)', size: 224, sizeOf: '폭', scale: [0.5, 1.6], depth: [8, 40], depth0: 14, depthName: '깊이', rot: [-45, 45], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: false, max: 4, hole: { aspect: 1.2, sx: [0.7, 2.6], shape: 'rrect', r: 0.3 } },
  /** the N33's slanted lamp (docs/systems/117 R3): a low band that wraps round the nose's corner, its inner end cut
   *  aslant and its outer end drawn to a point; 600 x 96 mm for a 110 mm lamp band; a projector, a reflector, a corner lamp */
  lampSlant: { group: 'lamp', name: '헤드램프 (경사, 모서리 감쌈)', size: 600, sizeOf: '폭', scale: [0.6, 1.5], depth: [6, 30], depth0: 12, depthName: '깊이', rot: [-20, 20], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: false, max: 4,
    hole: { aspect: 0.16, sx: [0.7, 1.3], shape: 'poly', wrap: { r: 560, flat: 0.12 }, poly: [[1, -0.25], [0.985, 0.2], [0.9, 0.62], [0.74, 0.9], [0.55, 1], [-0.74, 1], [-0.86, 0.9], [-1, -0.62], [-0.985, -0.88], [-0.93, -1], [0.8, -1], [0.93, -0.8]] } },
  /** a round lamp in a bumper: amber (a fog or turn lamp) in a dark pocket */
  fogLamp: { group: 'lamp', name: '범퍼 등 (둥근 주황)', size: 84, sizeOf: '지름', scale: [0.6, 2], depth: [6, 40], depth0: 16, depthName: '깊이', rot: [0, 0], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: false, max: 4, hole: { aspect: 1, sx: [1, 1.6], shape: 'ellipse' } },
  tailBand: { group: 'tail', name: '테일램프 띠 (599형)', size: 1964, sizeOf: '폭', scale: [0.6, 1.15], depth: [4, 30], depth0: 9, depthName: '깊이', rot: [0, 0], tilt: [0, 0], tilt0: 0, tiltName: '', pair: false, centre: true, centreOnly: true, max: 2, hole: { aspect: 120 / 1964, sx: [0.8, 1.1], shape: 'rrect', r: 0.2, wrap: { r: 200, flat: 650 / 982 } } },
  tailRound: { group: 'tail', name: '둥근 테일램프', size: 120, sizeOf: '지름', scale: [0.6, 2], depth: [4, 30], depth0: 10, depthName: '깊이', rot: [0, 0], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: false, max: 6, hole: { aspect: 1, sx: [1, 1.8], shape: 'ellipse' } },
  grille: { group: 'intake', name: '흡기구·그릴 (망)', size: 600, sizeOf: '폭', scale: [0.3, 2], depth: [10, 80], depth0: 40, depthName: '깊이', rot: [-30, 30], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: true, max: 6, hole: { aspect: 0.375, sx: [0.4, 3], shape: 'rrect', r: 0.25 } },
  /** a slim grille between the lamps with a blank place for an emblem in its middle; a bumper's open intake (a core behind bars) */
  grilleSlot: { group: 'intake', name: '그릴 (엠블럼 자리)', size: 500, sizeOf: '폭', scale: [0.5, 1.8], depth: [8, 60], depth0: 22, depthName: '깊이', rot: [-15, 15], tilt: [0, 0], tilt0: 0, tiltName: '', pair: false, centre: true, centreOnly: true, max: 2, hole: { aspect: 0.14, sx: [0.6, 1.6], shape: 'rrect', r: 0.45 } },
  intakeOpen: { group: 'intake', name: '범퍼 흡기구 (코어)', size: 760, sizeOf: '폭', scale: [0.15, 1.5], depth: [15, 120], depth0: 70, depthName: '깊이', rot: [-30, 30], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: true, max: 6, hole: { aspect: 0.21, sx: [0.4, 3], shape: 'rrect', r: 0.22 } },
  sideIntake: { group: 'intake', name: '옆 흡기구 (599형)', size: 109, sizeOf: '폭', scale: [0.5, 2.2], depth: [10, 60], depth0: 34, depthName: '깊이', rot: [-45, 45], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: false, max: 4, hole: { aspect: 190 / 109, sx: [0.6, 2.5], shape: 'rrect', r: 0.35 } },
  ventCut: { group: 'ventCut', name: '벤트 (구멍)', size: 220, sizeOf: '폭', scale: [0.35, 2.7], depth: [8, 50], depth0: 20, depthName: '깊이', rot: [-90, 90], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: true, max: 8, hole: { aspect: 0.36, sx: [0.5, 2], shape: 'rrect', r: 0.6 } },
  louvreCut: { group: 'ventCut', name: '루버 (구멍)', size: 360, sizeOf: '폭', scale: [0.3, 2.2], depth: [8, 50], depth0: 18, depthName: '깊이', rot: [-90, 90], tilt: [0, 0], tilt0: 0, tiltName: '', pair: true, centre: true, max: 6, hole: { aspect: 0.5, sx: [0.5, 2], shape: 'rrect', r: 0.12 } } };
/** the most entries a design keeps (docs/systems/115 §5-3: about 40 parts; a pair is one entry) */
export const MAX_PLACED = 32;
/** the most a cage's face number can be (the 959's cage has about 700; a later lump may have more) */
const MAX_FACE = 1 << 14;

const clamp = (v: number, [a, b]: readonly [number, number]) => Math.min(b, Math.max(a, v));
const num = (v: unknown, d: number) => typeof v === 'number' && Number.isFinite(v) ? v : d;
/** an entry's key in its list: the kind, and its number when not the first */
export const placedKey = (p: { id: PlacedId; n?: number }) => p.n ? `${p.id}#${p.n}` : p.id;
/** a free part's entry as the library first puts it on: the kind's defaults at a place */
export const freshPart = (id: FreeId, at: SurfaceAt, n = 0): Placed => ({ id, ...(n ? { n } : {}), at, rot: 0, tilt: PART_KINDS[id].tilt0, scale: 1, depth: PART_KINDS[id].depth0 });
/** one entry from anything (a file, a link): null when it is not one; its numbers rounded (u, v to a thousandth: about a
 *  tenth of a millimetre on a cage face) and within its kind's limits */
export function fitPlacedOne(v: unknown): Placed | null { if (!v || typeof v !== 'object') return null; const o = v as Record<string, unknown>, a = (o.at && typeof o.at === 'object' ? o.at : {}) as Record<string, unknown>;
  if (!(PLACED_IDS as unknown[]).includes(o.id)) return null; const f = Math.round(num(a.f, -1)); if (f < 0 || f >= MAX_FACE) return null;
  const id = o.id as PlacedId, r3 = (x: number) => Math.round(clamp(x, [0, 1]) * 1000) / 1000, r1 = (x: number, L: readonly [number, number]) => Math.round(clamp(x, L) * 10) / 10, at = { f, u: r3(num(a.u, 0.5)), v: r3(num(a.v, 0.5)) };
  if (isPlate(id)) return { id, at, rot: r1(num(o.rot, 0), PLACED_LIMITS.rot), tilt: r1(num(o.tilt, 0), PLACED_LIMITS.tilt), scale: Math.round(clamp(num(o.scale, 1), PLACED_LIMITS.scale) * 100) / 100 };
  const K = PART_KINDS[id], n = Math.round(clamp(num(o.n, 0), [0, K.max - 1]));
  return { id, ...(n ? { n } : {}), at, rot: r1(num(o.rot, 0), K.rot), tilt: r1(num(o.tilt, K.tilt0), K.tilt), scale: Math.round(clamp(num(o.scale, 1), K.scale) * 100) / 100,
    depth: r1(num(o.depth, K.depth0), K.depth), ...(o.one === true && K.pair ? { one: true as const } : {}),
    ...(K.hole && typeof o.sx === 'number' && Number.isFinite(o.sx) && Math.abs(o.sx - 1) > 0.004 ? { sx: Math.round(clamp(o.sx, K.hole.sx) * 100) / 100 } : {}) }; }
const order = (p: Placed) => PLACED_IDS.indexOf(p.id) * 64 + (p.n ?? 0);
/** the list from anything: each part once (the last entry for a key wins), in the kinds' order; undefined when none is
 *  left (the design then has no `parts` at all, as an older one) */
export function fitPlaced(v: unknown): Placed[] | undefined { if (!Array.isArray(v)) return undefined; const by = new Map<string, Placed>();
  for (const e of v) { const p = fitPlacedOne(e); if (p) by.set(placedKey(p), p); }
  const out = [...by.values()].sort((a, b) => order(a) - order(b)).slice(0, MAX_PLACED); return out.length ? out : undefined; }
/** a part's entry in a list (undefined: a plate at its stock place, a free part not fitted) */
export const placedOf = (ps: readonly Placed[] | undefined, id: PlacedId, n = 0): Placed | undefined => ps?.find(p => p.id === id && (p.n ?? 0) === n);
/** the list with one part's entry put (or taken away with `null`: a plate back at its stock place, a free part off) */
export function withPlaced(ps: readonly Placed[] | undefined, id: PlacedId, p: Placed | null, n = 0): Placed[] | undefined {
  const rest = (ps ?? []).filter(q => !(q.id === id && (q.n ?? 0) === n)), out = (p ? [...rest, p] : rest).sort((a, b) => order(a) - order(b)); return out.length ? out : undefined; }
/** the free parts alone, and the plates alone */
export const freeParts = (ps: readonly Placed[] | undefined): Placed[] => (ps ?? []).filter(p => !isPlate(p.id));
/** the next number free for a kind (null: the kind's limit reached, or the design's) */
export function nextN(ps: readonly Placed[] | undefined, id: FreeId): number | null { if ((ps?.length ?? 0) >= MAX_PLACED) return null;
  for (let n = 0; n < PART_KINDS[id].max; n++) if (!placedOf(ps, id, n)) return n; return null; }
/** a free part's size as the builder writes it (mm) */
export const sizeMm = (p: Placed) => isPlate(p.id) ? 335 * p.scale : PART_KINDS[p.id].size * p.scale * (p.sx ?? 1);
