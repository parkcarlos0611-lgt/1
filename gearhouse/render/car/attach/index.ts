// The free surface parts (docs/systems/115 P1, §5): a part placed anywhere on a body's skin, Automation's way: its place
// (core/placed.ts: surface coordinates, a turn, a tilt, a size, a depth off the skin), evaluated on any skin
// (render/car/skin.ts: the 599's shell, the N33's, a flat plane for the library's pictures), checked against its kind's
// rules and drawn there. A part that comes in pairs is drawn twice: once where it was placed and once mirrored across
// the centre line (the lumps are symmetric, so the twin's skin is the mirror of the first one's). These parts cut no
// holes (that is P2): each sits on the surface, following its curve.
//   mirror     a stalk from a foot on the door or the A pillar to a housing whose glass looks back; size, arm, turn, tilt
//   wingRing   the 599's ring wing as a part: one hoop, its blade's section carried round the corners and down two fins
//              whose feet stand on the skin (refused on a lump whose skin has its own hoop: the 599's lump A)
//   wingGT     a blade on two upright stands with end plates; both on the centre line only, the blade kept level
//   wingStay   the N33's wing: a blade between two raked end stays (their tops its end plates), turned at their pivots
//   lip        a front lip: a blade under a front-facing face, following the face across the car and round its corners
//   garnish    a tail's band: a dark strip across it, clear lamp strips at its ends, an emblem's blank place over its middle
//   handle     a flap door handle: a body-coloured flap in a dark recess; fuelLid: the lid's outline as a thin dark groove
//   exhaust1/2 one or two round tips, pointing back out of a rear-facing face
//   badge      the crest (docs/systems/116 B4): the shield plate laid flat just proud of the skin, its shape fixed
//   marker     a small side marker lamp: an amber lens in a dark bezel, every point laid on the skin
//   vent       a stick-on vent: a raised rim in body colour round a dark floor with bars, every point on the skin
//   louvre     a stick-on louvre panel: a dark frame and slats raised toward its top edge (on a bonnet: the rear)
// Each fit also keeps what P3 will read (the kind, the place, the frontal and plan areas, a wing's span and chord and
// angle, a mass): the figures are not in the physics yet.
import { Build, KINDS, type Kind, type Mesh, type V } from '../mesh';
import { partFrame, framePt, probe, rectPoints, footprintsMeet, vdot, vsub, vmadd, vunit, vcross, type Skin, type PartFrame, type SkinPoint, type SkinTag } from '../skin';
import { PART_KINDS, placedKey, isPlate, isHole, type Placed, type FreeId, type SurfId, type HoleId, type PartKind } from '../../../core/placed';
import { CREST_BOX, CREST_OUTLINE, CREST_COLOURS } from '../../live/crest.gen';
import type { CrestFrame } from '../p959/badge';
import { fitHoleAt, type HoleFit } from './holes';

/** what P3 will read of a fitted part (docs/systems/115 §5-7): its kind, its centre (the car's axes, mm; a pair's on the
 *  centre line), how many (a pair 2), the area it shows to the air ahead and from above (m², both together), a wing's
 *  blade, and a mass estimate (kg, both together) */
export interface PartFigures { id: FreeId; at: V; count: number; frontal: number; plan: number; mass: number; wing?: { span: number; chord: number; aoa: number; height: number };
  /** a hole part (P2): the opening the air can pass (m², both together; a lamp none) and how square it faces forward (0..1) */ open?: number; facing?: number }
/** a part fitted at its place: its frame and size, whether it has a twin, its footprint (half sizes in the frame's
 *  plane), the rules' verdict (`why` the first rule it breaks; `warn` an overlap, shown but allowed), its drawn mesh (the
 *  first of a pair; paint parts in a placeholder colour) and its figures */
export interface PartFit { p: Placed; key: string; kind: PartKind; F: PartFrame; size: number; depth: number; twin: boolean; hw: number; hh: number;
  ok: boolean; why: string | null; warn: string | null; mesh: Mesh; crest?: CrestFrame; fig: PartFigures;
  /** a hole part (P2, ./holes.ts): its cut (and its twin's), its drag preview; `mesh` is then its insides, drawn in the pocket */ hole?: HoleFit }
/** a footprint another part's overlap is measured against (a plate, a part, a twin); a hole's (P2) with its own test */
export interface Footprint { F: PartFrame; hw: number; hh: number; hole?: true; pts?: V[]; inside?: (p: V) => boolean }

const neg = (a: V): V => [-a[0], -a[1], -a[2]], add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const hexOf = (c: ArrayLike<number>) => '#' + Array.from(c, v => Math.round(v).toString(16).padStart(2, "0")).join("");
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** a triangle (and a quad) wound to face `out` */
const tri = (b: Build, p: V, q: V, r: V, out: V) => vdot(vcross(vsub(q, p), vsub(r, p)), out) >= 0 ? b.tri(p, q, r) : b.tri(p, r, q);
const quad = (b: Build, p: V, q: V, r: V, s: V, out: V) => { tri(b, p, q, r, out); tri(b, p, r, s, out); };
const centroid = (R: readonly V[]) => mul(R.reduce((s, p) => add(s, p), [0, 0, 0] as V), 1 / R.length);
/** rings of the same count joined, each quad facing away from its rings' middle line; the ends closed facing out along it */
function loftOut(b: Build, rings: V[][], caps = true): void { const C = rings.map(centroid);
  for (let r = 0; r + 1 < rings.length; r++) { const A = rings[r]!, B = rings[r + 1]!, m = mul(add(C[r]!, C[r + 1]!), 0.5);
    for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length, mid = mul(add(add(A[i]!, A[j]!), add(B[i]!, B[j]!)), 0.25); quad(b, A[i]!, A[j]!, B[j]!, B[i]!, vsub(mid, m)); } }
  if (!caps) return; const ax = vsub(C[C.length - 1]!, C[0]!);
  for (const [R, s] of [[rings[0]!, -1], [rings[rings.length - 1]!, 1]] as const) { const c = centroid(R); for (let i = 0; i < R.length; i++) tri(b, c, R[i]!, R[(i + 1) % R.length]!, mul(ax, s)); } }
/** a rounded rectangle's outline in a plane (x across, y up), `per` points on each corner's quarter, starting at its right */
export function rrect(hw: number, hh: number, r: number, per = 3): [number, number][] { r = Math.min(r, hw, hh); const out: [number, number][] = [];
  const C: [number, number, number][] = [[hw - r, hh - r, 0], [-hw + r, hh - r, 0.5], [-hw + r, -hh + r, 1], [hw - r, -hh + r, 1.5]];
  for (const [cx, cy, a0] of C) for (let i = 0; i <= per; i++) { const a = (a0 + i / per * 0.5) * Math.PI; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; }

/** the skin under a frame's plane, every point probed once: a point `h` off the skin along its own normal there (off the
 *  body: the plane's point), and the skin's height over the plane */
function surface(skin: Skin, F: PartFrame, reach = 260) { const cache = new Map<string, { p: V; n: V; h: number; tag: SkinTag } | null>(), back = neg(F.n); let miss = 0;
  const under = (x: number, y: number) => { const k = `${x.toFixed(2)},${y.toFixed(2)}`; if (cache.has(k)) return cache.get(k)!;
    const r = skin.hit(framePt(F, x, y, reach), back, reach * 2), v = r ? { p: r.p, n: r.n, h: reach - r.t, tag: r.tag } : null; if (!v) miss++; cache.set(k, v); return v; };
  return { under, get miss() { return miss; }, at: (x: number, y: number, h: number): V => { const u = under(x, y); return u ? vmadd(u.p, u.n, h) : framePt(F, x, y, h); } }; }

/** what a face is made of that no part may sit on */
const BAD_MAT = new Set(['glass', 'lens', 'lamp', 'amber']), BAD_PANEL = /^(archLip|wheelWell|floor|wingSlot)$/, GLASS_PANEL = /Glass$|^windscreen$|^rearWindow$/;
const badTag = (t: SkinTag, dark: boolean): string | null => BAD_MAT.has(t.mat ?? '') ? '램프나 유리와 겹칩니다' : BAD_PANEL.test(t.panel) || (!dark && t.mat === 'dark') ? '바퀴 아치·바닥에는 붙일 수 없습니다'
  : GLASS_PANEL.test(t.panel) ? '창문 자리에는 붙일 수 없습니다' : null;
/** the faces a kind may sit on, by the way the skin looks there (the car's axes: -x forward, +z up) */
function faceRule(id: FreeId, n: V): string | null {
  switch (PART_KINDS[id].group) {
    case 'mirror': return Math.abs(n[1]) < 0.45 ? '옆을 보는 면(문·A필러)에만 붙일 수 있습니다' : null;
    case 'wing': return n[2] < 0.5 ? '위를 보는 면(트렁크·덮개·지붕)에만 붙일 수 있습니다' : null;
    case 'lip': return n[0] > -0.35 ? '앞을 보는 면(앞 범퍼)에만 붙일 수 있습니다' : null;
    case 'trim': return id !== 'garnish' && Math.abs(n[2]) > 0.75 ? '옆·앞·뒤를 보는 면에만 붙일 수 있습니다' : null;
    case 'exhaust': return n[0] < 0.35 ? '뒤를 보는 면에만 붙일 수 있습니다' : null;
    case 'marker': return Math.abs(n[2]) > 0.75 ? '옆·앞·뒤를 보는 면에만 붙일 수 있습니다' : null;
    default: return null; } }
/** a frame mirrored across the centre line */
const mirrorV = (a: V): V => [a[0], -a[1], a[2]];
export const mirrorFrame = (F: PartFrame): PartFrame => ({ o: mirrorV(F.o), n: mirrorV(F.n), u: mirrorV(F.u), up: mirrorV(F.up) });
/** a fit's footprints: its own and its twin's */
export const footprints = (f: { F: PartFrame; hw: number; hh: number; twin: boolean; hole?: HoleFit }): Footprint[] => f.hole ? f.hole.prints : [{ F: f.F, hw: f.hw, hh: f.hh }, ...(f.twin ? [{ F: mirrorFrame(f.F), hw: f.hw, hh: f.hh }] : [])];
const PAINT = '#b8bcc2';

/** a part at its place on this skin (null: the place is not on this skin) */
export function fitPart(skin: Skin, p: Placed, others: readonly Footprint[] = []): PartFit | null { const pt = skin.at(p.at); return pt ? fitAt(skin, pt, p, others) : null; }
/** a part at a point of the skin (the library's pictures stand one on a plane, where there are no surface coordinates) */
export function fitAt(skin: Skin, pt: SkinPoint, p: Placed, others: readonly Footprint[] = []): PartFit {
  if (isPlate(p.id)) throw new Error('a plate is fitted by render/car/p959/plates.ts');
  if (isHole(p.id)) return fitHoleAt(skin, pt, p as Placed & { id: HoleId }, others);
  const id = p.id, K = PART_KINDS[id], size = K.size * p.scale, depth = p.depth ?? K.depth0, b = new Build();
  const F = partFrame(pt.p, pt.n, K.group === 'wing' ? 0 : p.rot, K.group === 'wing' || K.group === 'exhaust' || K.group === 'mirror' ? 0 : p.tilt);
  const twin = K.pair && !p.one && Math.abs(pt.p[1]) > 2;
  let why = faceRule(id, pt.n), crest: CrestFrame | undefined, hw = size / 2, hh = size / 2, extra: string | null = null, wing: PartFigures['wing'];
  const S = surface(skin, F), dark = K.group === 'exhaust';
  switch (K.group) {
    case 'marker': { hh = size * 0.21; extra = marker(b, S, hw, hh, depth); break; }
    case 'vent': { if (id === 'vent') { hh = size * 0.18; vent(b, S, hw, hh, depth); } else { hh = size * 0.35; louvre(b, S, hw, hh, depth); } break; }
    case 'badge': { hh = size / 2; hw = hh * CREST_BOX[2] / CREST_BOX[3]; const r = crestOn(b, S, F, size, depth); crest = r.frame; if (r.gap > 10) extra = `면이 너무 굽었습니다 (틈 ${Math.round(r.gap)} mm, 최대 10 mm)`; break; }
    case 'exhaust': { const r = size / 2, two = id === 'exhaust2'; hw = two ? r * 2.2 : r; hh = r; extra = exhaust(b, skin, F, r, two, depth, p.rot, p.tilt); break; }
    case 'mirror': { const k = p.scale; hw = 30 * k; hh = 22 * k; extra = mirror(b, skin, S, F, k, depth, p.rot, p.tilt); break; }
    case 'lip': { hh = 20; extra = lip(b, skin, pt, size, depth, p.tilt); break; }
    case 'trim': { if (id === 'garnish') { hh = size * 0.016; garnish(b, S, hw, hh, depth); } else if (id === 'handle') { hh = size * 0.18; handle(b, S, hw, hh, depth); } else { hh = size * 0.45; fuelLid(b, S, hw, hh, depth); } break; }
    case 'wing': { const r = wingOn(b, skin, pt, id === 'wingRing' ? 'ring' : id === 'wingStay' ? 'stay' : 'gt', size, depth, p.tilt); hw = size / 2; hh = r.chord / 2; extra = r.why; wing = { span: size, chord: r.chord, aoa: p.tilt, height: depth }; break; } }
  // the rules: the face's way, on the body, not on glass, a lamp or an arch, its own rule; not across the line from its twin
  const pts = rectPoints(hw * 0.92, hh * 0.92, Math.max(15, Math.min(hw, hh) / 2)), own = K.group === 'wing' || K.group === 'exhaust' || K.group === 'mirror' || K.group === 'lip', R = own ? [] : probe(skin, F, [...pts.rim, ...pts.inside]);
  why ??= R.some(r => !r) || S.miss > 0 && K.group !== 'wing' && K.group !== 'mirror' && K.group !== 'lip' ? '부품이 차체 밖으로 나갑니다' : null;
  why ??= [pt.tag, ...R.map(r => r!.tag)].map(t => badTag(t, dark)).find(Boolean) ?? null;
  why ??= extra;
  if (!why && twin) { const ys = [...pts.rim].map(([x, y]) => framePt(F, x / 0.92, y / 0.92)[1]); if (ys.some(y => Math.sign(y) !== Math.sign(pt.p[1]) || Math.abs(y) < 3)) why = '가운데 선을 넘습니다 (한쪽만으로 하거나 옆으로 옮기세요)'; }
  if (!why && K.centreOnly && Math.abs(pt.p[1]) > 5) why = '가운데 선 위에만 붙일 수 있습니다';
  const mine = footprints({ F, hw, hh, twin }), warn = others.some(o => o.inside ? mine.some(m => [...rectPoints(m.hw, m.hh, 40).rim, [0, 0] as [number, number]].some(([x, y]) => o.inside!(framePt(m.F, x, y)))) : mine.some(m => footprintsMeet(m, o, 60))) ? '다른 부품과 겹칩니다 (붙일 수는 있습니다)' : null;
  const mesh = b.mesh(0);
  return { p, key: placedKey(p), kind: K, F, size, depth, twin, hw, hh, ok: !why, why, warn, mesh, ...(crest ? { crest } : {}), fig: figures(mesh, id as SurfId, twin, pt.p, wing) }; }

/** fit every free part of a list, in order, each measured for overlap against the ones before it and `fixed` (the plates) */
export function fitAll(skin: Skin, ps: readonly Placed[], fixed: readonly Footprint[] = []): PartFit[] { const out: PartFit[] = [], seen: Footprint[] = [...fixed];
  for (const p of ps) { if (isPlate(p.id)) continue; const f = fitPart(skin, p, seen); if (!f) continue; out.push(f); seen.push(...footprints(f)); } return out; }

/** a fitted part drawn into a car's builder: its mesh (the body's paint for its painted parts) and, for a pair, its twin
 *  mirrored across the centre line; the crests' frames for their atlas coordinates (render/car/p959/badge.ts crestUV) */
export function drawFit(b: Build, f: PartFit, paint: string, tint?: ArrayLike<number>): CrestFrame[] { const M = f.mesh, P = KINDS.indexOf('paint');
  for (const mir of f.twin ? [false, true] : [false]) { let part = -1;
    for (let t = 0; t < M.n; t++) { if (M.part[t] !== part) { part = M.part[t]!; const k = M.kind[t]!, c = tint ?? (k === P ? null : M.col.subarray(t * 3, t * 3 + 3)); b.name(M.names?.[part] ?? 'part').mat(c ? hexOf(c) : paint, M.gloss[t]!, KINDS[k] as Kind); }
      const v = (i: number): V => [M.pos[t * 9 + i * 3]!, (mir ? -1 : 1) * M.pos[t * 9 + i * 3 + 1]!, M.pos[t * 9 + i * 3 + 2]!];
      if (mir) b.tri(v(0), v(2), v(1)); else b.tri(v(0), v(1), v(2)); } }
  return f.crest ? [f.crest, ...(f.twin ? [{ ...f.crest, c: mirrorV(f.crest.c), n: mirrorV(f.crest.n), ex: mirrorV(f.crest.ex), ey: mirrorV(f.crest.ey) }] : [])] : []; }
/** every free part of a design drawn on a car (each at its place; one whose place has left the skin is left out; a hole
 *  part only when its hole was cut: `cut`, the keys ./holes.ts cutShell cut), or the fits given */
export function drawPlaced(b: Build, skin: Skin, ps: readonly Placed[] | undefined, paint: string, fixed: readonly Footprint[] = [], given?: { fits: PartFit[]; cut: ReadonlySet<string> }): { fits: PartFit[]; crests: CrestFrame[] } {
  const fits = given?.fits ?? (ps?.some(p => !isPlate(p.id)) ? fitAll(skin, ps!, fixed) : []), cut = given?.cut;
  return { fits, crests: fits.filter(f => !f.hole || cut?.has(f.key)).flatMap(f => drawFit(b, f, paint)) }; }
/** a design's free parts' figures for P3 (docs/systems/115 §5-7) */
export const partFigures = (fits: readonly PartFit[]): PartFigures[] => fits.map(f => f.fig);

// ---- the figures ----
const MASS: Record<SurfId, number> = { lip: 2.5, garnish: 0.8, handle: 0.2, fuelLid: 0.05, wingStay: 8, mirror: 1.1, wingRing: 9, wingGT: 7, exhaust1: 0.5, exhaust2: 0.9, badge: 0.03, marker: 0.06, vent: 0.35, louvre: 0.9 };
/** a closed mesh's shadow on a plane is half the sum of its faces' areas times how square they stand to it */
function figures(M: Mesh, id: SurfId, twin: boolean, at: V, wing?: PartFigures['wing']): PartFigures { let fx = 0, fz = 0; const P = M.pos;
  for (let t = 0; t < M.n; t++) { const a: V = [P[t * 9]!, P[t * 9 + 1]!, P[t * 9 + 2]!], n = vcross(vsub([P[t * 9 + 3]!, P[t * 9 + 4]!, P[t * 9 + 5]!], a), vsub([P[t * 9 + 6]!, P[t * 9 + 7]!, P[t * 9 + 8]!], a)); fx += Math.abs(n[0]) / 2; fz += Math.abs(n[2]) / 2; }
  const k = twin ? 2 : 1, s = PART_KINDS[id];
  return { id, at: twin ? [at[0], 0, at[2]] : at, count: k, frontal: fx / 2 * k / 1e6, plan: fz / 2 * k / 1e6, mass: Math.round(MASS[id] * (s.group === 'badge' ? 1 : 1) * k * 100) / 100, ...(wing ? { wing } : {}) }; }

// ---- the parts' shapes ----
type Surf = ReturnType<typeof surface>;
/** a closed outline laid on the skin as a band from `h0` up to `h1` (its sides facing out of the outline), and rings */
function wall(b: Build, S: Surf, O: [number, number][], h0: number, h1: number, inward = false): void { const lo = O.map(([x, y]) => S.at(x, y, h0)), hi = O.map(([x, y]) => S.at(x, y, h1));
  for (let i = 0; i < O.length; i++) { const j = (i + 1) % O.length, out = vsub(mul(add(hi[i]!, hi[j]!), 0.5), S.at(0, 0, h1)); quad(b, lo[i]!, lo[j]!, hi[j]!, hi[i]!, inward ? neg(out) : out); } }
/** the face between two outlines (the outer at `ha`, the inner at `hb`), facing out of the skin */
function band(b: Build, S: Surf, A: [number, number][], ha: number, B: [number, number][], hb: number): void {
  for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length, p = S.at(A[i]![0], A[i]![1], ha), q = S.at(A[j]![0], A[j]![1], ha), r = S.at(B[j]![0], B[j]![1], hb), s = S.at(B[i]![0], B[i]![1], hb), u = S.under(A[i]![0], A[i]![1]);
    quad(b, p, q, r, s, u ? u.n : [0, 0, 1]); } }
/** an outline's inside on the skin at `h`: rings shrinking to its middle, so the face bends with the skin */
function cover(b: Build, S: Surf, O: [number, number][], h: number, rings = 3): void { let A = O;
  for (let k = 1; k < rings; k++) { const B = O.map(([x, y]) => [x * (1 - k / rings), y * (1 - k / rings)] as [number, number]); band(b, S, A, h, B, h); A = B; }
  const c = S.at(0, 0, h), u = S.under(0, 0); for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length; tri(b, c, S.at(A[i]![0], A[i]![1], h), S.at(A[j]![0], A[j]![1], h), u ? u.n : [0, 0, 1]); } }
const shrink = (O: [number, number][], d: number, hw: number, hh: number) => O.map(([x, y]) => [x * (hw - d) / hw, y * (hh - d) / hh] as [number, number]);

/** a side marker lamp: a stadium of amber lens in a dark bezel, `d` mm proud */
function marker(b: Build, S: Surf, hw: number, hh: number, d: number): null { const O = rrect(hw, hh, hh, 4), I = shrink(O, Math.min(3, hh * 0.25), hw, hh);
  b.name('markerBezel').mat('#1b1c1e', 0.3, 'plain'); wall(b, S, O, -1.5, d); band(b, S, O, d, I, d + 0.3);
  b.name('markerLamp').mat('#d9861c', 0.6, 'lens'); band(b, S, I, d + 0.3, shrink(I, hh * 0.3, hw, hh), d + 1.2); cover(b, S, shrink(I, hh * 0.3, hw, hh), d + 1.5, 1); return null; }

/** a stick-on vent: a raised rim (body colour) round a dark floor and a few bars across */
function vent(b: Build, S: Surf, hw: number, hh: number, d: number): void { const O = rrect(hw, hh, hh * 0.45, 3), rw = clamp(hh * 0.16, 4, 18), I = shrink(O, rw, hw, hh);
  b.name('ventRim').mat(PAINT, 0.6, 'paint'); wall(b, S, O, -1.5, d); band(b, S, O, d, I, d); wall(b, S, I, 0.8, d, true);
  b.name('ventFloor').mat('#17181a', 0.1, 'grille'); cover(b, S, I, 0.8, 2);
  const n = clamp(Math.round((hh - rw) * 2 / 26), 1, 6), ih = hh - rw, iw = hw - rw, t = clamp(ih / (n + 1) * 0.35, 2, 9); b.name('ventBar').mat('#2a2b2d', 0.3, 'plain');
  for (let k = 1; k <= n; k++) { const y = -ih + 2 * ih * k / (n + 1), m = Math.max(2, Math.ceil(iw * 2 / 60));
    for (let i = 0; i < m; i++) { const x0 = -iw + 2 * iw * i / m, x1 = -iw + 2 * iw * (i + 1) / m, u = S.under((x0 + x1) / 2, y);
      quad(b, S.at(x0, y - t, d * 0.6), S.at(x1, y - t, d * 0.6), S.at(x1, y + t, d * 0.6), S.at(x0, y + t, d * 0.6), u ? u.n : [0, 0, 1]);
      const fr = vsub(S.at((x0 + x1) / 2, y - t, d * 0.6), S.at((x0 + x1) / 2, y + t, d * 0.6)); quad(b, S.at(x0, y - t, d * 0.6), S.at(x1, y - t, d * 0.6), S.at(x1, y - t, 0.8), S.at(x0, y - t, 0.8), fr); } } }

/** a stick-on louvre panel: a dark frame, a dark floor, slats rising toward the panel's top edge (on a bonnet its up is
 *  toward the screen, so the slats open backward) */
function louvre(b: Build, S: Surf, hw: number, hh: number, d: number): void { const O = rrect(hw, hh, 6, 1), fw = clamp(hh * 0.06, 5, 12), I = shrink(O, fw, hw, hh), iw = hw - fw, ih = hh - fw;
  b.name('louvreFrame').mat('#1f2022', 0.3, 'plain'); wall(b, S, O, -1.5, 3); band(b, S, O, 3, I, 3); wall(b, S, I, 0.6, 3, true);
  b.name('louvreFloor').mat('#121314', 0.05, 'plain'); cover(b, S, I, 0.6, 2);
  const k = clamp(Math.round(ih * 2 / 30), 3, 14), m = clamp(Math.ceil(iw * 2 / 70), 2, 10), step = 2 * ih / k; b.name('louvreSlat').mat('#26272a', 0.35, 'plain');
  for (let j = 0; j < k; j++) { const y0 = -ih + j * step + step * 0.08, y1 = -ih + (j + 1) * step - step * 0.12;
    for (let i = 0; i < m; i++) { const x0 = -iw + 2 * iw * i / m, x1 = -iw + 2 * iw * (i + 1) / m, u = S.under((x0 + x1) / 2, (y0 + y1) / 2), n = u ? u.n : [0, 0, 1] as V;
      quad(b, S.at(x0, y0, 0.9), S.at(x1, y0, 0.9), S.at(x1, y1, d), S.at(x0, y1, d), n);
      quad(b, S.at(x0, y1, d), S.at(x1, y1, d), S.at(x1, y1, 0.6), S.at(x0, y1, 0.6), vsub(S.at(x0, y1, d), S.at(x0, y0, d))); }
    for (const [x, s] of [[-iw, -1], [iw, 1]] as const) tri(b, S.at(x, y0, 0.9), S.at(x, y1, d), S.at(x, y1, 0.6), vsub(S.at(x + s, y1, d), S.at(x, y1, d))); } }

/** the crest (docs/systems/116 B4): the shield's outline as a flat plate in the frame's plane, `lift` over the highest
 *  skin under it, its sides running into the skin; its face named 'badge' for the atlas's crest cell. Its gap: how far
 *  the skin under it falls away (a plate on a curved place stands off it at the edges) */
function crestOn(b: Build, S: Surf, F: PartFrame, H: number, lift: number): { frame: CrestFrame; gap: number } {
  const W = H * CREST_BOX[2] / CREST_BOX[3], flat = (x: number, y: number): [number, number] => [(x - 0.5) * W, (0.5 - y) * H];
  const rim = CREST_OUTLINE.map(([x, y]) => flat(x, y)), under = [...rim, [0, 0] as [number, number]].map(([x, y]) => S.under(x, y)?.h ?? 0);
  const top = Math.max(...under) + lift, c = framePt(F, 0, 0, top), T = rim.map(([x, y]) => framePt(F, x, y, top)), B = rim.map(([x, y], i) => framePt(F, x, y, under[i]! - 0.8));
  b.name('badge').mat(hexOf(CREST_COLOURS.G), 0.4, 'plain'); for (let i = 0; i < T.length; i++) tri(b, c, T[i]!, T[(i + 1) % T.length]!, F.n);
  b.name('badgeEdge').mat(hexOf(CREST_COLOURS.D), 0.4, 'plain');
  for (let i = 0; i < T.length; i++) { const j = (i + 1) % T.length, out = vsub(add(T[i]!, T[j]!), add(c, c)); quad(b, T[i]!, T[j]!, B[j]!, B[i]!, out); }
  return { frame: { c, n: F.n, ex: F.u, ey: F.up, W, H }, gap: top - Math.min(...under) }; }

/** a round tube along `a` from `p0` to `p1` (radii r0 at the start, r1 at the end), 14 sides, facing out */
function tube(b: Build, p0: V, p1: V, r0: number, r1: number, a: V, inward = false): void { const e1 = vunit(Math.abs(a[2]) > 0.9 ? vcross(a, [1, 0, 0]) : vcross(a, [0, 0, 1])), e2 = vcross(a, e1), N = 14;
  const ring = (c: V, r: number) => Array.from({ length: N }, (_, i) => { const t = i / N * Math.PI * 2; return vmadd(vmadd(c, e1, Math.cos(t) * r), e2, Math.sin(t) * r); });
  const A = ring(p0, r0), B = ring(p1, r1); for (let i = 0; i < N; i++) { const j = (i + 1) % N, out = vsub(mul(add(A[i]!, A[j]!), 0.5), p0), o2 = vsub(out, mul(a, vdot(out, a))); quad(b, A[i]!, A[j]!, B[j]!, B[i]!, inward ? neg(o2) : o2); } }
const disc = (b: Build, c: V, r: number, a: V, out: V) => { const e1 = vunit(Math.abs(a[2]) > 0.9 ? vcross(a, [1, 0, 0]) : vcross(a, [0, 0, 1])), e2 = vcross(a, e1), N = 14;
  for (let i = 0; i < N; i++) { const t0 = i / N * Math.PI * 2, t1 = (i + 1) / N * Math.PI * 2; tri(b, c, vmadd(vmadd(c, e1, Math.cos(t0) * r), e2, Math.sin(t0) * r), vmadd(vmadd(c, e1, Math.cos(t1) * r), e2, Math.sin(t1) * r), out); } };
/** the car's back (+x) turned `rot` degrees about the vertical and `tilt` up */
const aim = (rot: number, tilt: number): V => { const r = rot * Math.PI / 180, t = tilt * Math.PI / 180; return [Math.cos(t) * Math.cos(r), Math.cos(t) * Math.sin(r), Math.sin(t)]; };
/** exhaust tips: one (or two side by side across the face) round chrome tips coming out of the skin, rolled at the lip,
 *  dark inside, pointing back */
function exhaust(b: Build, skin: Skin, F: PartFrame, r: number, two: boolean, reach: number, rot: number, tilt: number): string | null { const a = aim(rot, tilt), across = vunit([F.u[0], F.u[1], 0]);
  for (const off of two ? [-r * 1.1, r * 1.1] : [0]) { const c = vmadd(F.o, across, off), h = skin.hit(vmadd(c, a, 300), neg(a), 700); if (!h) return '배기구가 차체 밖으로 나갑니다';
    const s = h.p, p0 = vmadd(s, a, -45), p1 = vmadd(s, a, reach), lip = vmadd(p1, a, 1.5), inner = vmadd(p1, a, -70);
    b.name('exhaustTip').mat('#c4c7cb', 0.8, 'metal'); tube(b, p0, p1, r, r, a); tube(b, p1, lip, r, r - 3, a); tube(b, lip, p1, r - 3, r - 5.5, a);
    b.name('exhaustInner').mat('#141516', 0.05, 'plain'); tube(b, p1, inner, r - 5.5, r - 5.5, a, true); disc(b, inner, r - 5.5, a, a); }
  return null; }

/** an oval ring about `c` in the plane of two axes */
const oval = (c: V, e1: V, e2: V, r1: number, r2: number, N = 8): V[] => Array.from({ length: N }, (_, i) => { const t = i / N * Math.PI * 2; return vmadd(vmadd(c, e1, Math.cos(t) * r1), e2, Math.sin(t) * r2); });
/** a mirror: a foot laid on the skin, an arm out and up to the housing's inner lower side, a housing rounded to its nose
 *  whose glass looks back (the 599's flag mirror, docs/systems/109; its sections rounded rectangles of twelve points, so
 *  no flat sides show) */
function mirror(b: Build, skin: Skin, S: Surf, F: PartFrame, k: number, reach: number, rot: number, tilt: number): string | null {
  const s = F.n[1] >= 0 ? 1 : -1, L: V = [0, s, 0], X0: V = [1, 0, 0], Z0: V = [0, 0, 1], c = add(add(F.o, mul(L, reach)), [20 * k, 0, reach * 0.52]);
  // the housing's axes turned (rot about the vertical, its outer end toward the back for +) and tilted (tilt about the car's across)
  const r = rot * Math.PI / 180 * s, t = tilt * Math.PI / 180, turn = (v: V): V => { const x1 = v[0] * Math.cos(r) - v[1] * Math.sin(r), y1 = v[0] * Math.sin(r) + v[1] * Math.cos(r); return [x1 * Math.cos(t) - v[2] * Math.sin(t), y1, x1 * Math.sin(t) + v[2] * Math.cos(t)]; };
  const X = turn(X0), Lr = turn(L), Z = turn(Z0), at = (x: number, l: number, z: number): V => add(add(add(c, mul(X, x)), mul(Lr, l)), mul(Z, z));
  const N = 12, E = 2 / 2.7, O: [number, number][] = Array.from({ length: N }, (_, i) => { const a = (i + 0.5) / N * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); return [Math.sign(ca) * Math.abs(ca) ** E, Math.sign(sa) * Math.abs(sa) ** E]; });
  const ringAt = (x: number, hw: number, hh: number, dl = 0, dz = 0) => O.map(([l, z]) => at(x, dl + l * hw, dz + z * hh));
  const R = [ringAt(-52 * k, 19 * k, 13 * k, -9 * k, -4 * k), ringAt(-45 * k, 37 * k, 26 * k, -6 * k, -2.5 * k), ringAt(-27 * k, 53 * k, 38 * k, -2.5 * k, -1 * k), ringAt(6 * k, 60.5 * k, 44 * k), ringAt(42 * k, 62 * k, 45.5 * k)];
  const R3 = ringAt(42 * k, 55 * k, 39 * k), G = ringAt(36 * k, 55 * k, 39 * k);
  b.name('mirror').mat(PAINT, 0.6, 'paint'); loftOut(b, R, false);
  { const c0 = at(-55 * k, -9 * k, -4 * k); for (let i = 0; i < N; i++) tri(b, c0, R[0]![i]!, R[0]![(i + 1) % N]!, neg(X)); }
  for (let i = 0; i < N; i++) { const j = (i + 1) % N; quad(b, R[4]![i]!, R[4]![j]!, R3[j]!, R3[i]!, X); quad(b, R3[i]!, R3[j]!, G[j]!, G[i]!, vsub(centroid(G), R3[i]!)); }
  b.name('mirrorGlass').mat('#5e6a75', 0.9, 'plain'); { const cg = centroid(G); for (let i = 0; i < N; i++) tri(b, cg, G[i]!, G[(i + 1) % N]!, X); }
  // the arm: an oval stalk from the foot to the housing's inner lower side; the foot a rounded pad on the skin
  b.name('mirror').mat(PAINT, 0.6, 'paint'); const foot = vmadd(F.o, F.n, -4), end = at(-12 * k, -34 * k, -24 * k), dA = vunit(vsub(end, foot)), e1 = vunit(vsub(X0, mul(dA, vdot(X0, dA)))), e2 = vcross(dA, e1);
  loftOut(b, [oval(foot, e1, e2, 19 * k, 12 * k), oval(vmadd(foot, vsub(end, foot), 0.5), e1, e2, 15 * k, 9.5 * k), oval(vmadd(end, dA, 12 * k), e1, e2, 14 * k, 9 * k)], true);
  const FO = rrect(34 * k, 24 * k, 14 * k, 2); wall(b, S, FO, -3, 5); cover(b, S, FO, 5, 1);
  // the housing must stand clear of the body: its middle outside the skin (a ray out of it meets no skin) and the skin
  // not within its reach
  if (skin.hit(c, L, 3000)) return '미러가 차체에 묻힙니다';
  const g = skin.hit(c, neg(L), reach + 200); if (g && g.t < 30 * k) return '미러가 차체에 너무 붙었습니다';
  return null; }

/** an inverted aerofoil's section (u along the chord 0..1, w its thickness against the chord), from its nose round its top */
const FOIL: [number, number][] = [[0, 0], [0.04, 0.03], [0.2, 0.045], [0.5, 0.04], [0.85, 0.02], [1, 0.008], [1, -0.006], [0.85, -0.032], [0.5, -0.075], [0.2, -0.07], [0.04, -0.035]];
/** a wing on the centre line, `height` over the skin under its middle, its blade level across the car and turned `aoa`
 *  degrees (its trailing edge up): the ring wing (one hoop), the GT wing (two uprights under the blade, end plates), the
 *  stay wing (two raked end stays). Its feet are laid on the skin under each of their corners */
function wingOn(b: Build, skin: Skin, pt: SkinPoint, kind: 'ring' | 'gt' | 'stay', span: number, height: number, aoa: number): { chord: number; why: string | null } {
  const zb = pt.p[2] + height, A = aoa * Math.PI / 180, ca = Math.cos(A), sa = Math.sin(A), half = span / 2, down = (x: number, y: number) => skin.hit([x, y, zb + 1500], [0, 0, -1], 4000);
  let why: string | null = null;
  /** the blade clear of the body: the skin under its leading edge, middle and trailing edge, across `yEnd`, well below it */
  const clear = (yEnd: number, at: (u: number) => [number, number]) => { if (!why) for (const u of [0, 0.5, 1]) for (let i = 0; i <= 8; i++) { const y = -yEnd * 0.98 + yEnd * 1.96 * i / 8, [x, z] = at(u), h = down(x, y); if (h && h.p[2] > z - 20) { why = '날개가 차체에 닿습니다 (높이를 올리세요)'; return; } } };
  if (kind === 'ring') { // one hoop: the section carried along a path up one fin, round a corner, across and down the other
    const C = span * 0.17, x0 = pt.p[0] - C * 0.45, rc = clamp(height * 0.8, 40, span * 0.13), lean = span * 0.02, yc = half - rc, zc = zb - rc;
    const PR: [number, number][] = [[0, 0], [0.05, 0.034], [0.25, 0.052], [0.6, 0.044], [0.9, 0.02], [1, 0], [0.9, -0.022], [0.6, -0.052], [0.25, -0.062], [0.05, -0.036]];
    /** a station of the right half's path: its place, the way out of the hoop there, how much of the blade's angle it keeps, the chord's growth */
    type St = { y: number; z: number; ny: number; nz: number; wt: number; g: number; foot?: true };
    const H: St[] = []; for (let i = 0; i <= 4; i++) H.push({ y: yc * i / 4, z: zb, ny: 0, nz: 1, wt: 1, g: 1 });
    for (let i = 1; i <= 4; i++) { const f = i / 4 * Math.PI / 2; H.push({ y: yc + rc * Math.sin(f), z: zc + rc * Math.cos(f), ny: Math.sin(f), nz: Math.cos(f), wt: Math.cos(f), g: 1 + 0.06 * i / 4 }); }
    const zf = down(pt.p[0], half + lean)?.p[2] ?? down(pt.p[0], half)?.p[2] ?? pt.p[2] - 60;
    H.push({ y: half + lean * 0.3, z: zc + (zf - zc) * 0.5, ny: 1, nz: 0, wt: 0, g: 1.2 }, { y: half + lean, z: zf, ny: 1, nz: 0, wt: 0, g: 1.42, foot: true });
    const ringOf = (h: St, sgn: number): V[] => PR.map(([u, w]) => { const x = x0 + u * C * h.g - (h.g - 1) * C * 0.7 - w * C * sa * h.wt, y = sgn * (h.y + h.ny * w * C), z = h.z + h.nz * w * C + (u - 0.45) * C * sa * h.wt;
      if (!h.foot) return [x, y, z] as V; const d = down(x, y); if (!d) { why ??= '윙 다리가 차체 밖에 닿습니다'; return [x, y, z - 40] as V; }
      if (/^wing(Slot)?$/.test(d.tag.panel)) why ??= '이 차체는 고리 윙이 차체의 일부입니다 (겹쳐 달 수 없습니다)'; return [x, y, d.p[2] - 8] as V; });
    if (/^wing(Slot)?$/.test(pt.tag.panel)) why = '이 차체는 고리 윙이 차체의 일부입니다 (겹쳐 달 수 없습니다)';
    b.name('wing').mat(PAINT, 0.6, 'paint'); loftOut(b, [...H.slice(1).reverse().map(h => ringOf(h, -1)), ...H.map(h => ringOf(h, 1))], true);
    clear(yc, u => [x0 + u * C, zb - 0.07 * C + (u - 0.45) * C * sa]); return { chord: C, why }; }
  if (kind === 'stay') { // a blade between two end stays: each a fin raked back from a long foot on the deck's corner to the
    // blade, its top standing over the blade as an end plate; the blade turned about its mid chord at the stays' pivots
    const C = span * 0.14, t0 = Math.max(24, span * 0.018), xb = pt.p[0] - 0.3 * C + height * 0.85, yIn = half - t0;
    const sec = (u: number, w: number): [number, number] => [xb + ((u - 0.5) * ca - w * sa + 0.5) * C, zb + ((u - 0.5) * sa + w * ca) * C];
    const rings: V[][] = []; for (let i = 0; i <= 8; i++) { const y = -yIn + 2 * yIn * i / 8; rings.push(FOIL.map(([u, w]) => { const [x, z] = sec(u, w); return [x, y, z]; })); }
    b.name('wing').mat(PAINT, 0.6, 'paint'); loftOut(b, rings, true);
    const zt = zb + 0.06 * C + 24, footF = pt.p[0] - 0.85 * C, footR = pt.p[0] + 0.5 * C, lean = span * 0.012;
    for (const s of [-1, 1]) { const R: V[][] = []; let lastZ = pt.p[2] - 40, hits = 0;
      const lv: [number, number, number, number][] = [[0, xb + 0.2 * C, xb + 0.92 * C, 0.3], [0.04, xb - 0.04 * C, xb + 1.08 * C, 0.5]];   // the rounded top: a level's fall, its front, its back, its half thickness
      for (const f of [0.12, 0.3, 0.52, 0.76, 1]) lv.push([f, xb - 0.1 * C + (footF - xb + 0.1 * C) * f ** 0.85, xb + 1.12 * C + (footR - xb - 1.12 * C) * f ** 1.7, 0.5 * (1 + 0.9 * f * f)]);
      for (const [f, xf, xr, th] of lv) { const Lx = xr - xf, y0 = s * (half - t0 / 2 + lean * f * f), h = th * t0, P: [number, number][] = [[xf, y0], [xf + 0.14 * Lx, y0 + h], [xr - 0.16 * Lx, y0 + h], [xr, y0], [xr - 0.16 * Lx, y0 - h], [xf + 0.14 * Lx, y0 - h]];
        R.push(P.map(([x, y]) => { const d = f > 0.1 ? down(x, y) : null; if (d) { lastZ = d.p[2] - 8; if (f === 1) hits++; } const top = zt - (f > 0 ? 9 : 0); return [x, y, f <= 0.04 ? top : top + (lastZ - top) * f] as V; })); }
      if (!hits) why ??= '윙 다리가 차체 밖에 닿습니다';
      b.name('wing').mat(PAINT, 0.6, 'paint'); loftOut(b, R, true);
      // the pivot's bolt and the angle's lock bolt on the stay's outer face
      b.name('wingBolt').mat('#1f2022', 0.4, 'plain'); for (const [u, r] of [[0.5, 8], [0.74, 5]] as const) { const [x, z] = sec(u, -0.02); disc(b, [x, s * (half + 1.2), z], r, [0, s, 0], [0, s, 0]); } }
    clear(yIn, u => sec(u, -0.07)); return { chord: C, why }; }
  // the GT wing: two uprights under the blade, end plates
  const C = span * 0.18, x0 = pt.p[0] - C * 0.45;
  const sec = (u: number, w: number): [number, number] => [x0 + (u * ca - w * sa) * C, zb + (u * sa + w * ca) * C];
  const lowZ = (u: number) => sec(u, -0.07)[1], ny = 10;
  const rings: V[][] = []; for (let i = 0; i <= ny; i++) { const y = -half + span * i / ny; rings.push(FOIL.map(([u, w]) => { const [x, z] = sec(u, w); return [x, y, z]; })); }
  b.name('wing').mat(PAINT, 0.6, 'paint'); loftOut(b, rings, true);
  /** an upright from the blade's underside to the skin: its section (x0..x1 along, y0..y1 across) laid on the skin at each corner */
  const upright = (xa: number, xb: number, ya: number, yb: number, top: number) => { const st = 4, R: V[][] = [];
    for (let k = 0; k <= st; k++) { const f = k / st, cs: [number, number][] = [[xa, ya], [xb, ya], [xb, yb], [xa, yb]];
      R.push(cs.map(([x, y]) => { const h = down(x, y); if (!h) { why ??= '윙 다리가 차체 밖에 닿습니다'; return [x, y, top - 200] as V; } const zf = h.p[2] - 8; return [x, y, top + (zf - top) * f] as V; })); }
    loftOut(b, R, true); };
  for (const s of [-1, 1]) upright(x0 + 0.3 * C, x0 + 0.8 * C, s * (span * 0.3 - 6), s * (span * 0.3 + 6), lowZ(0.55) + 4);
  b.name('wingPlate').mat('#1f2022', 0.4, 'plain');
  for (const s of [-1, 1]) { const out: [number, number][] = [[-0.08, -0.34], [1.08, -0.2], [1.14, 0.24], [0.1, 0.22], [-0.08, 0.05]], P = (y: number) => out.map(([u, w]) => { const [x, z] = [x0 + u * C, zb + w * C]; return [x, y, z] as V; });
    loftOut(b, [P(s * half), P(s * (half + 8))], true); }
  clear(half, u => [sec(u, 0)[0], lowZ(u)]);
  return { chord: C, why }; }

/** a strip of the skin from x0 to x1 and y0 to y1 raised from `h0` to `h1`, in `m` pieces along x (each corner laid on the skin): its face and its four sides */
function slab(b: Build, S: Surf, x0: number, x1: number, y0: number, y1: number, h0: number, h1: number, m: number): void {
  for (let i = 0; i < m; i++) { const xa = x0 + (x1 - x0) * i / m, xb = x0 + (x1 - x0) * (i + 1) / m, u = S.under((xa + xb) / 2, (y0 + y1) / 2), n = u ? u.n : [0, 0, 1] as V, up = vsub(S.at(xa, y1, h1), S.at(xa, y0, h1));
    quad(b, S.at(xa, y0, h1), S.at(xb, y0, h1), S.at(xb, y1, h1), S.at(xa, y1, h1), n);
    quad(b, S.at(xa, y1, h0), S.at(xb, y1, h0), S.at(xb, y1, h1), S.at(xa, y1, h1), up); quad(b, S.at(xa, y0, h0), S.at(xb, y0, h0), S.at(xb, y0, h1), S.at(xa, y0, h1), neg(up)); }
  for (const [x, g] of [[x0, -1], [x1, 1]] as const) quad(b, S.at(x, y0, h0), S.at(x, y1, h0), S.at(x, y1, h1), S.at(x, y0, h1), mul(vsub(S.at(x1, 0, h1), S.at(x0, 0, h1)), g)); }
/** an outline with a point every `step` along its sides (so a long side follows the skin) */
const dense = (O: [number, number][], step: number): [number, number][] => O.flatMap((a, i) => { const c = O[(i + 1) % O.length]!, k = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / step)); return Array.from({ length: k }, (_, j) => [a[0] + (c[0] - a[0]) * j / k, a[1] + (c[1] - a[1]) * j / k] as [number, number]); });

/** a front lip: at stations across the car the face is found by a ray from ahead at the part's height; a blade's section
 *  stands out of it along the face's own level way out (so it turns the corners with the face), `reach` deep, its edge
 *  drooped `droop` degrees; it ends where the face ends, its last stations drawn in */
function lip(b: Build, skin: Skin, pt: SkinPoint, span: number, reach: number, droop: number): string | null {
  const z0 = pt.p[2], n = 24, half = span / 2, td = Math.tan(droop * Math.PI / 180), T: ({ y: number; p: V; d: V } | null)[] = [];
  for (let i = 0; i <= n; i++) { const y = -half + span * i / n, h = skin.hit([pt.p[0] - 900, y, z0], [1, 0, 0], 1800);
    T.push(h && h.n[0] < -0.12 && h.p[0] < pt.p[0] + 700 && !badTag(h.tag, false) ? { y, p: h.p, d: vunit([h.n[0], h.n[1], 0]) } : null); }
  let a = n / 2, c = n / 2; if (!T[a]) return '립이 차체 밖으로 나갑니다'; while (a > 0 && T[a - 1]) a--; while (c < n && T[c + 1]) c++;
  if (c - a < 6) return '립이 차체 밖으로 나갑니다';
  const rings: V[][] = []; for (let j = a; j <= c; j++) { const t = T[j]!, e = Math.min(j - a, c - j), d = reach * (e === 0 ? 0.2 : e === 1 ? 0.7 : 1), P = (o: number, dz: number): V => [t.p[0] + t.d[0] * o, t.y + t.d[1] * o, z0 + dz];
    rings.push([P(-10, 15), P(d * 0.45, 8), P(d, -d * td + 3), P(d + 3, -d * td - 3), P(d, -d * td - 9), P(-10, -20)]); }
  b.name('lip').mat(PAINT, 0.6, 'paint'); loftOut(b, rings, true); return null; }

/** a tail's garnish band: a dark strip across the face, a painted panel on its middle, clear lamp strips (two cells a
 *  side) at its ends, and over its middle a blank round boss: an emblem's place */
function garnish(b: Build, S: Surf, hw: number, hh: number, d: number): void { const m = Math.max(8, Math.ceil(hw * 2 / 60));
  b.name('garnish').mat('#1f2022', 0.3, 'plain'); slab(b, S, -hw, hw, -hh, hh, -1.5, d, m);
  b.name('garnishPanel').mat(PAINT, 0.6, 'paint'); slab(b, S, -hw * 0.47, hw * 0.47, -hh * 0.7, hh * 0.7, d, d + 0.8, Math.ceil(m / 2));
  b.name('garnishLamp').mat('#d5d9dd', 0.7, 'lens'); for (const g of [-1, 1]) for (const [x0, x1, h] of [[0.5, 0.735, 1.4], [0.75, 0.97, 1]] as const) slab(b, S, g * hw * x0, g * hw * x1, -hh * 0.7, hh * 0.7, d, d + h, 3);
  const r = hh * 1.15, cy = hh + r * 2.6, N = 14, ring = (k: number, h: number) => Array.from({ length: N }, (_, i) => { const t = i / N * Math.PI * 2; return S.at(Math.cos(t) * r * k, cy + Math.sin(t) * r * k, h); }), nn = S.under(0, cy)?.n ?? [1, 0, 0] as V;
  b.name('emblemRim').mat('#c4c7cb', 0.7, 'metal'); { const A = ring(1, -1), B = ring(0.86, 2.2); for (let i = 0; i < N; i++) { const j = (i + 1) % N; quad(b, A[i]!, A[j]!, B[j]!, B[i]!, nn); } }
  b.name('emblemPlace').mat('#34363a', 0.3, 'plain'); { const B = ring(0.86, 2.2), c = S.at(0, cy, 2.2); for (let i = 0; i < N; i++) tri(b, c, B[i]!, B[(i + 1) % N]!, nn); } }

/** a flap door handle: a dark recess plate and, over its upper part, the body-coloured flap `d` proud */
function handle(b: Build, S: Surf, hw: number, hh: number, d: number): void { const O = dense(rrect(hw, hh, hh * 0.55, 3), 40);
  b.name('handleRecess').mat('#1b1c1e', 0.2, 'plain'); wall(b, S, O, -1.5, 1); cover(b, S, O, 1, 2);
  b.name('handle').mat(PAINT, 0.6, 'paint'); slab(b, S, -hw * 0.86, hw * 0.86, -hh * 0.12, hh * 0.72, 1, d, 3); }
/** a fuel lid: its outline as a thin dark groove on the skin (a rounded square), and a finger notch at its rear edge */
function fuelLid(b: Build, S: Surf, hw: number, hh: number, d: number): void { const O = dense(rrect(hw, hh, Math.min(hw, hh) * 0.24, 3), 36), I = shrink(O, 3, hw, hh);
  b.name('fuelLidLine').mat('#232426', 0.2, 'plain'); band(b, S, O, d, I, d); }
