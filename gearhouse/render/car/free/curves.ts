// The free body's control curves (docs/systems/106_free_body_prototype.md): a car's visible shape as a few smooth
// curves along its length, with no base car under them. Every curve is a table of keypoints over the station s, which
// runs 0 at the nose, 1 at the front axle, 2 at the rear axle, 3 at the tail (so a curve keeps its meaning when the
// wheelbase or an overhang changes). Heights and widths are in mm (z up from the ground, y out from the centre line).
//   top       the centre line's height: nose, bonnet, screen, roof, rear glass, deck, tail (the side profile)
//   crest     the flank's top edge: the wings' crest, the belt under the side glass, the rear wings
//   floor     the underside's height (the ride, the chin, the tail's kick-up)
//   half      the plan's half-width at the widest line
//   shoulder  the widest line's height, as a share from the floor (0) to the crest (1)
//   roof      the glasshouse's top half-width as a share of the crest's (the tumblehome)
//   sail      a buttress line: the roof's edge held up at this height behind the roof (mm; below the top it does nothing)
//   round     the section's roundness (2 a soft ellipse, 8 nearly a box)
//   tuck      how far the flank tucks in from the widest line to the sill (mm)
// A silhouette is the whole set; a shape piece is a silhouette's contribution over a window of s (a nose, a cabin, a
// tail), and joining pieces weighs each one's curves by smooth windows that overlap at the joins, so pieces from
// different cars meet without a step. Blending two silhouettes mixes their curves at the union of their keypoints;
// dragging moves keypoints under a smooth bump (curves are monotone cubics, so a drag never overshoots).
import { curve, clamp01, lerp, sm, type Tab } from '../kit/geom';

export type CurveName = 'top' | 'crest' | 'floor' | 'half' | 'shoulder' | 'roof' | 'sail' | 'round' | 'tuck';
export const CURVES: CurveName[] = ['top', 'crest', 'floor', 'half', 'shoulder', 'roof', 'sail', 'round', 'tuck'];
/** the running gear the body is laid over (mm): the overhangs, the wheelbase, the tyre */
export interface Chassis { front: number; wheelbase: number; rear: number; r: number; tyreW: number; rim: number }
/** landmarks along the car (stations s): the screen's foot, the roof's front and back, the rear glass's foot, where the
 *  side glass ends, the door's front and back */
export interface Marks { screen: number; roofF: number; roofB: number; glass: number; sideEnd: number; door: [number, number] }
export interface Silhouette { name: string; chassis: Chassis; curves: Record<CurveName, Tab>; marks: Marks; /** a black roof panel (the NSX's) */ roofBlack?: boolean; /** whose wheels it wears */ wheel?: 'nsx' | 'f355' | 'eb110' }

export const lengthOf = (c: Chassis) => c.front + c.wheelbase + c.rear;
/** a station's place along the car (mm from the nose) */
export function xOf(c: Chassis, s: number): number { return s <= 1 ? s * c.front : s <= 2 ? c.front + (s - 1) * c.wheelbase : c.front + c.wheelbase + (s - 2) * c.rear; }
/** the station at x mm from the nose */
export function sOf(c: Chassis, x: number): number { const a = c.front, b = c.front + c.wheelbase; return x <= a ? x / a : x <= b ? 1 + (x - a) / c.wheelbase : 2 + (x - b) / c.rear; }
/** a table given in mm along the car turned into stations */
export const mmTab = (c: Chassis, t: [number, number][]): Tab => t.map(([x, v]) => [sOf(c, x), v]);

/** the curves as functions of s */
export type Resolved = Record<CurveName, (s: number) => number>;
export function resolve(sil: Silhouette): Resolved { const o = {} as Resolved; for (const n of CURVES) { const t = sil.curves[n]; o[n] = t.length > 1 ? curve(t) : () => t[0]![1]; } return o; }

/** keypoints at the union of the tables' stations (near ones merged) */
function union(tabs: Tab[], extra: number[] = []): number[] { const s = [...tabs.flatMap(t => t.map(p => p[0])), ...extra].sort((a, b) => a - b), o: number[] = [];
  for (const v of s) if (!o.length || v - o[o.length - 1]! > 0.012) o.push(v); return o; }
const lerpMarks = (a: Marks, b: Marks, t: number): Marks => ({ screen: lerp(a.screen, b.screen, t), roofF: lerp(a.roofF, b.roofF, t), roofB: lerp(a.roofB, b.roofB, t), glass: lerp(a.glass, b.glass, t),
  sideEnd: lerp(a.sideEnd, b.sideEnd, t), door: [lerp(a.door[0], b.door[0], t), lerp(a.door[1], b.door[1], t)] });
const lerpChassis = (a: Chassis, b: Chassis, t: number): Chassis => ({ front: lerp(a.front, b.front, t), wheelbase: lerp(a.wheelbase, b.wheelbase, t), rear: lerp(a.rear, b.rear, t), r: lerp(a.r, b.r, t), tyreW: lerp(a.tyreW, b.tyreW, t), rim: lerp(a.rim, b.rim, t) });

/** a silhouette between two: t 0 is a, 1 is b */
export function blend(a: Silhouette, b: Silhouette, t: number): Silhouette { const A = resolve(a), B = resolve(b), curves = {} as Record<CurveName, Tab>;
  for (const n of CURVES) curves[n] = union([a.curves[n], b.curves[n]]).map(s => [s, lerp(A[n](s), B[n](s), t)]);
  return { name: `${a.name} ${Math.round((1 - t) * 100)}% + ${b.name} ${Math.round(t * 100)}%`, chassis: lerpChassis(a.chassis, b.chassis, t), curves, marks: lerpMarks(a.marks, b.marks, t), roofBlack: t < 0.5 ? a.roofBlack : b.roofBlack, wheel: t < 0.5 ? a.wheel : b.wheel }; }

// ---- shape pieces ----
export type PieceKind = 'nose' | 'cabin' | 'tail';
/** a shape piece: a silhouette's curves over its window (kept a margin beyond it, so the blend at a join reads the
 *  piece's own shape), and, for a cabin, the glasshouse's landmarks */
export interface ShapePiece { id: string; name: string; source: string; kind: PieceKind; window: [number, number]; curves: Record<CurveName, Tab>; marks?: Marks; roofBlack?: boolean; wheel?: Silhouette['wheel']; chassis: Chassis }
/** where the pieces meet by default: the nose ends behind the front axle, the tail starts ahead of the rear axle */
export const JOINS: [number, number] = [1.2, 2.05];
const WINDOW: Record<PieceKind, (j: [number, number]) => [number, number]> = { nose: j => [0, j[0]], cabin: j => [j[0], j[1]], tail: j => [j[1], 3] };
const PIECE_NAMES: Record<PieceKind, string> = { nose: '앞코', cabin: '캐빈', tail: '꼬리' };
/** a silhouette's piece of the kind given */
export function pieceOf(sil: Silhouette, kind: PieceKind, joins = JOINS, margin = 0.45): ShapePiece { const R = resolve(sil), w = WINDOW[kind](joins), curves = {} as Record<CurveName, Tab>;
  for (const n of CURVES) { const lo = w[0] - margin, hi = w[1] + margin, inside = sil.curves[n].filter(p => p[0] >= lo && p[0] <= hi);
    curves[n] = union([inside], [Math.max(-0.01, lo), Math.min(3.01, hi)]).filter(s => s >= lo - 1e-9 && s <= hi + 1e-9).map(s => [s, R[n](s)]); }
  return { id: `${sil.name}:${kind}`, name: `${sil.name} ${PIECE_NAMES[kind]}`, source: sil.name, kind, window: w, curves, marks: kind === 'cabin' ? sil.marks : undefined, roofBlack: sil.roofBlack, wheel: sil.wheel, chassis: sil.chassis }; }
/** pieces joined into one silhouette: each curve the sum of the pieces' curves weighed by smooth windows that cross
 *  over `width` (in s) at each join; the landmarks from the cabin; the running gear given, or the cabin's */
export function joinPieces(nose: ShapePiece, cabin: ShapePiece, tail: ShapePiece, o: { chassis?: Chassis; width?: number } = {}): Silhouette { const bw = o.width ?? 0.3, j0 = cabin.window[0], j1 = cabin.window[1];
  const wN = (s: number) => 1 - sm(j0 - bw / 2, j0 + bw / 2, s), wT = (s: number) => sm(j1 - bw / 2, j1 + bw / 2, s), ps = [nose, cabin, tail], curves = {} as Record<CurveName, Tab>;
  const extra: number[] = []; for (const j of [j0, j1]) for (let k = 0; k <= 4; k++) extra.push(j - bw / 2 + bw * k / 4);
  for (const n of CURVES) { const f = ps.map(p => p.curves[n].length > 1 ? curve(p.curves[n]) : () => p.curves[n][0]![1]);
    curves[n] = union([nose.curves[n].filter(p => p[0] <= j0 + bw), cabin.curves[n].filter(p => p[0] >= j0 - bw && p[0] <= j1 + bw), tail.curves[n].filter(p => p[0] >= j1 - bw)], extra)
      .map(s => { const a = wN(s), c = wT(s), b = Math.max(0, 1 - a - c); return [s, a * f[0]!(s) + b * f[1]!(s) + c * f[2]!(s)]; }); }
  return { name: `${nose.name} + ${cabin.name} + ${tail.name}`, chassis: o.chassis ?? cabin.chassis, curves, marks: cabin.marks!, roofBlack: cabin.roofBlack, wheel: cabin.wheel }; }

// ---- dragging ----
/** the curve pushed by dv at station s under a smooth bump `width` wide (in s); a keypoint is added at s when none is near */
export function dragCurve(sil: Silhouette, name: CurveName, s: number, dv: number, width = 0.22): Silhouette { const f = resolve(sil)[name]; let t = sil.curves[name].map(p => [p[0], p[1]] as [number, number]);
  if (!t.some(p => Math.abs(p[0] - s) < width * 0.3)) { t.push([s, f(s)]); t.sort((a, b) => a[0] - b[0]); }
  t = t.map(([q, v]) => [q, v + dv * Math.exp(-(((q - s) / width) ** 2))]);
  return { ...sil, curves: { ...sil.curves, [name]: t } }; }
/** keypoint k of a curve moved by ds (kept between its neighbours) and dv */
export function moveKey(sil: Silhouette, name: CurveName, k: number, ds: number, dv: number): Silhouette { const t = sil.curves[name].map(p => [p[0], p[1]] as [number, number]); if (!t[k]) return sil;
  const lo = k > 0 ? t[k - 1]![0] + 0.02 : -0.05, hi = k + 1 < t.length ? t[k + 1]![0] - 0.02 : 3.05; t[k] = [Math.max(lo, Math.min(hi, t[k]![0] + ds)), t[k]![1] + dv];
  return { ...sil, curves: { ...sil.curves, [name]: t } }; }
/** a landmark moved (kept in order: screen < roof front < roof back < rear glass; side glass's end after the roof front) */
export function moveMark(sil: Silhouette, mark: Exclude<keyof Marks, 'door'>, ds: number): Silhouette { const m = { ...sil.marks, [mark]: sil.marks[mark] + ds };
  m.screen = Math.max(0.6, Math.min(m.screen, 2.2)); m.roofF = Math.max(m.screen + 0.05, m.roofF); m.roofB = Math.max(m.roofF + 0.05, m.roofB); m.glass = Math.max(m.roofB + 0.02, m.glass); m.sideEnd = Math.max(m.roofF + 0.05, m.sideEnd);
  return { ...sil, marks: m }; }

/** a share kept in 0..1 (for sliders that work in shares) */
export const share = clamp01;
