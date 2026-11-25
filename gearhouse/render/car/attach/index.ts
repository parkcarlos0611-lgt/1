// The free surface parts (docs/systems/115 P1, §5): a part placed anywhere on a body's skin, Automation's way: its place
// (core/placed.ts: surface coordinates, a turn, a tilt, a size, a depth off the skin), evaluated on any skin
// (render/car/skin.ts: the 599's shell, the N33's, a flat plane for the library's pictures), checked against its kind's
// rules and drawn there. A part that comes in pairs is drawn twice: once where it was placed and once mirrored across
// the centre line (the lumps are symmetric, so the twin's skin is the mirror of the first one's). These parts cut no
// holes (that is P2): each sits on the surface, following its curve.
//   mirror     a stalk from a foot on the door or the A pillar to a housing whose glass looks back; size, arm, turn, tilt
//   wingRing   the 599's ring wing as a part: a blade whose ends turn down into two broad legs standing on the skin
//   wingGT     a blade on two upright stands with end plates; both on the centre line only, the blade kept level
//   exhaust1/2 one or two round tips, pointing back out of a rear-facing face
//   badge      the crest (docs/systems/116 B4): the shield plate laid flat just proud of the skin, its shape fixed
//   marker     a small side marker lamp: an amber lens in a dark bezel, every point laid on the skin
//   vent       a stick-on vent: a raised rim in body colour round a dark floor with bars, every point on the skin
//   louvre     a stick-on louvre panel: a dark frame and slats raised toward its top edge (on a bonnet: the rear)
//   wingN33    (docs/systems/117 R3) a GT wing on two swept stays at its ends with end plates, its blade's angle set
//   lipF       a front lip: a dark wedge laid along the bumper's foot round its corners (the tail lamp band's fan of rays)
//   garnish    the rear garnish band: a thin plate laid across the tail round its corners, smoked at its ends
//   exhaustBig1/2  a big oval tip, or a big body holding two round tips
// Each fit also keeps what P3 will read (the kind, the place, the frontal and plan areas, a wing's span and chord and
// angle, a mass): the figures are not in the physics yet.
import { Build, KINDS, type Kind, type Mesh, type V } from '../mesh';
import { partFrame, framePt, probe, rectPoints, footprintsMeet, vdot, vsub, vmadd, vunit, vcross, type Skin, type PartFrame, type SkinPoint, type SkinTag } from '../skin';
import { PART_KINDS, placedKey, isPlate, isHole, type Placed, type FreeId, type SurfId, type HoleId, type PartKind } from '../../../core/placed';
import { CREST_BOX, CREST_OUTLINE, CREST_COLOURS } from '../../live/crest.gen';
import type { CrestFrame } from '../p959/badge';
import { fitHoleAt, rayAt, dirAt, type HoleFit, type Proj } from './holes';

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
    case 'exhaust': return n[0] < 0.35 ? '뒤를 보는 면에만 붙일 수 있습니다' : null;
    case 'marker': return Math.abs(n[2]) > 0.75 ? '옆·앞·뒤를 보는 면에만 붙일 수 있습니다' : null;
    case 'trim': return id === 'lipF' ? (n[0] > -0.35 ? '앞을 보는 면(앞 범퍼)에만 붙일 수 있습니다' : null) : n[0] < 0.35 ? '뒤를 보는 면에만 붙일 수 있습니다' : null;
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
  const S = surface(skin, F), dark = K.group === 'exhaust', tags: SkinTag[] = [];
  switch (K.group) {
    case 'marker': { hh = size * 0.21; extra = marker(b, S, hw, hh, depth); break; }
    case 'vent': { if (id === 'vent') { hh = size * 0.18; vent(b, S, hw, hh, depth); } else { hh = size * 0.35; louvre(b, S, hw, hh, depth); } break; }
    case 'badge': { hh = size / 2; hw = hh * CREST_BOX[2] / CREST_BOX[3]; const r = crestOn(b, S, F, size, depth); crest = r.frame; if (r.gap > 10) extra = `면이 너무 굽었습니다 (틈 ${Math.round(r.gap)} mm, 최대 10 mm)`; break; }
    case 'exhaust': { const r = size / 2, two = id === 'exhaust2' || id === 'exhaustBig2', big = id === 'exhaustBig1' || id === 'exhaustBig2'; hw = two ? r * 2.2 : big ? r * 1.15 : r; hh = r; extra = big ? bigTip(b, skin, F, r, two, depth, p.rot, p.tilt) : exhaust(b, skin, F, r, two, depth, p.rot, p.tilt); break; }
    case 'mirror': { const k = p.scale; hw = 30 * k; hh = 22 * k; extra = mirror(b, skin, S, F, k, depth, p.rot, p.tilt); break; }
    case 'trim': { const r = bandOn(b, skin, F, K, p.scale, depth, id === 'lipF'); hw = r.hw; hh = r.hh; extra = r.why; tags.push(...r.tags); break; }
    case 'wing': { const r = id === 'wingRing' ? ringWing(b, skin, pt, size, depth, p.tilt) : wingOn(b, skin, pt, id === 'wingN33', size, depth, p.tilt); hw = size / 2; hh = r.chord / 2; extra = r.why; wing = { span: size, chord: r.chord, aoa: p.tilt, height: depth }; break; } }
  // the rules: the face's way, on the body, not on glass, a lamp or an arch, its own rule; not across the line from its twin
  const own = K.group === 'wing' || K.group === 'exhaust' || K.group === 'mirror' || K.group === 'trim', pts = rectPoints(hw * 0.92, hh * 0.92, Math.max(15, Math.min(hw, hh) / 2)), R = own ? [] : probe(skin, F, [...pts.rim, ...pts.inside]);
  why ??= R.some(r => !r) || S.miss > 0 && !own ? '부품이 차체 밖으로 나갑니다' : null;
  why ??= [pt.tag, ...R.map(r => r!.tag), ...tags].map(t => badTag(t, dark)).find(Boolean) ?? null;
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
const MASS: Record<SurfId, number> = { mirror: 1.1, wingRing: 9, wingGT: 7, exhaust1: 0.5, exhaust2: 0.9, badge: 0.03, marker: 0.06, vent: 0.35, louvre: 0.9, wingN33: 6.5, lipF: 1.8, garnish: 0.6, exhaustBig1: 0.8, exhaustBig2: 1.3 };
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

/** a round tube along `a` from `p0` to `p1` (radii r0 at the start, r1 at the end; `sx` times as wide across as high),
 *  10 sides (14 before docs/systems/117 R3: the tips' triangles), facing out */
function tube(b: Build, p0: V, p1: V, r0: number, r1: number, a: V, inward = false, sx = 1): void { const e1 = vunit(Math.abs(a[2]) > 0.9 ? vcross(a, [1, 0, 0]) : vcross(a, [0, 0, 1])), e2 = vcross(a, e1), N = 10;
  const ring = (c: V, r: number) => Array.from({ length: N }, (_, i) => { const t = i / N * Math.PI * 2; return vmadd(vmadd(c, e1, Math.cos(t) * r * sx), e2, Math.sin(t) * r); });
  const A = ring(p0, r0), B = ring(p1, r1); for (let i = 0; i < N; i++) { const j = (i + 1) % N, out = vsub(mul(add(A[i]!, A[j]!), 0.5), p0), o2 = vsub(out, mul(a, vdot(out, a))); quad(b, A[i]!, A[j]!, B[j]!, B[i]!, inward ? neg(o2) : o2); } }
const disc = (b: Build, c: V, r: number, a: V, out: V, sx = 1) => { const e1 = vunit(Math.abs(a[2]) > 0.9 ? vcross(a, [1, 0, 0]) : vcross(a, [0, 0, 1])), e2 = vcross(a, e1), N = 10;
  for (let i = 0; i < N; i++) { const t0 = i / N * Math.PI * 2, t1 = (i + 1) / N * Math.PI * 2; tri(b, c, vmadd(vmadd(c, e1, Math.cos(t0) * r * sx), e2, Math.sin(t0) * r), vmadd(vmadd(c, e1, Math.cos(t1) * r * sx), e2, Math.sin(t1) * r), out); } };
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

/** a big tip (docs/systems/117 R3): one oval tip, or one oval body holding two round tips side by side; chrome, rolled
 *  at the lip, dark inside, pointing back */
function bigTip(b: Build, skin: Skin, F: PartFrame, r: number, two: boolean, reach: number, rot: number, tilt: number): string | null { const a = aim(rot, tilt), h = skin.hit(vmadd(F.o, a, 300), neg(a), 700); if (!h) return '배기구가 차체 밖으로 나갑니다';
  const s = h.p, p0 = vmadd(s, a, -45), p1 = vmadd(s, a, reach), lip = vmadd(p1, a, 2), sx = two ? 2.05 : 1.18;
  b.name('exhaustTip').mat('#c4c7cb', 0.8, 'metal'); tube(b, p0, p1, r, r, a, false, sx); tube(b, p1, lip, r, r - 4, a, false, sx); tube(b, lip, p1, r - 4, r - 7, a, false, sx);
  b.name('exhaustInner').mat('#141516', 0.05, 'plain');
  if (!two) { const inner = vmadd(p1, a, -60); tube(b, p1, inner, r - 7, r - 7, a, true, sx); disc(b, inner, r - 7, a, a, sx); return null; }
  // the body's mouth dark a little in, two round chrome tips in it
  const back = vmadd(p1, a, -24); tube(b, p1, back, r - 7, r - 7, a, true, sx); disc(b, back, r - 7, a, a, sx);
  const across = vunit(Math.abs(a[2]) > 0.9 ? vcross(a, [1, 0, 0]) : vcross(a, [0, 0, 1])), rt = r * 0.78;
  for (const off of [-r * 0.98, r * 0.98]) { const c0 = vmadd(back, across, off), c1 = vmadd(c0, a, 20); b.name('exhaustTip').mat('#c4c7cb', 0.8, 'metal'); tube(b, c0, c1, rt, rt, a); tube(b, c1, c0, rt - 3, rt - 3, a, true);
    b.name('exhaustInner').mat('#141516', 0.05, 'plain'); disc(b, vmadd(c1, a, -16), rt - 3, a, a); }
  return null; }

/** a band laid on the skin by the fan of rays a wrapped tail lamp band is cut by (docs/systems/117 R3): the front lip, a
 *  dark wedge whose top lies on the bumper and whose foot stands `reach` out of it with a short drop under; or the rear
 *  garnish, a thin plate `reach` thick, smoked at its ends and in body colour in its middle (the lettering's place) */
function bandOn(b: Build, skin: Skin, F: PartFrame, K: PartKind, scale: number, reach: number, lip: boolean): { hw: number; hh: number; why: string | null; tags: SkinTag[] } {
  const B = K.band!, hw = K.size * scale / 2, hh = K.size * B.aspect * scale / 2, P: Proj = { F, L0: hw * B.wrap.flat, R: B.wrap.r * scale }, tags: SkinTag[] = []; let why: string | null = null;
  const ss: number[] = [], marks = [-hw, ...(P.L0 < hw ? [-P.L0, P.L0] : []), hw];
  for (let k = 0; k + 1 < marks.length; k++) { const a = marks[k]!, c = marks[k + 1]!, n = Math.max(1, Math.ceil((c - a) / (Math.abs((a + c) / 2) > P.L0 ? 35 : 60))); for (let i = 0; i < n; i++) ss.push(a + (c - a) * i / n); } ss.push(hw);
  const hitAt = (sv: number, y: number) => { const r = rayAt(P, sv, y), h = skin.hit(r.o, r.d, r.max); if (!h) { why ??= '부품이 차체 밖으로 나갑니다'; return { p: vmadd(r.o, r.d, r.max / 2), d: neg(r.d) }; } tags.push(h.tag); return { p: h.p, d: neg(r.d) }; };
  const col = ss.map(sv => ({ t: hitAt(sv, hh), m: hitAt(sv, 0), f: hitAt(sv, -hh), d: dirAt(P, sv) }));
  const up = F.up, at = (q: { p: V; d: V }, h: number): V => vmadd(q.p, q.d, h);
  if (lip) { // the wedge: top on the skin, its face out to the foot, a drop under it, the underside back to the skin
    b.name('lip').mat('#1d1e20', 0.25, 'plain'); const prof = (c: typeof col[number]): V[] => [at(c.t, -1), at(c.m, reach * 0.32), vmadd(at(c.f, reach), up, -14), vmadd(at(c.f, reach * 0.55), up, -16), at(c.f, -1)];
    const R = col.map(prof); for (let i = 0; i + 1 < R.length; i++) for (let k = 0; k + 1 < 5; k++) { const A = R[i]!, C = R[i + 1]!, out = k < 2 ? col[i]!.d : vmadd(neg(up), col[i]!.d, k === 2 ? 0.6 : -0.6); quad(b, A[k]!, C[k]!, C[k + 1]!, A[k + 1]!, out); }
    for (const [A, N] of [[R[0]!, R[1]!], [R[R.length - 1]!, R[R.length - 2]!]] as const) { const c = centroid(A), o = vsub(c, centroid(N)); for (let k = 0; k < 5; k++) tri(b, c, A[k]!, A[(k + 1) % 5]!, o); } }
  else { // the plate: its face, its top and foot edges down to the skin, its ends; smoked at the ends, body colour in the middle
    const mid = hw * 0.38;
    for (let i = 0; i + 1 < col.length; i++) { const A = col[i]!, C = col[i + 1]!, xm = (ss[i]! + ss[i + 1]!) / 2; if (Math.abs(xm) < mid) b.name('garnishMid').mat(PAINT, 0.6, 'paint'); else b.name('garnish').mat('#4a4e55', 0.85, 'plain');
      quad(b, at(A.t, reach), at(C.t, reach), at(C.f, reach), at(A.f, reach), A.d); quad(b, at(A.t, reach), at(C.t, reach), at(C.t, -1), at(A.t, -1), up); quad(b, at(A.f, reach), at(C.f, reach), at(C.f, -1), at(A.f, -1), neg(up)); }
    for (const [c, n] of [[col[0]!, col[1]!], [col[col.length - 1]!, col[col.length - 2]!]] as const) quad(b, at(c.t, reach), at(c.f, reach), at(c.f, -1), at(c.t, -1), vsub(c.m.p, n.m.p)); }
  return { hw, hh, why, tags }; }

/** a mirror: a sail-shaped foot laid on the skin, a short arm out from it to the housing's inner front foot, a rounded
 *  housing (its outer end the fullest, its nose tapering forward) whose glass looks back (docs/systems/117 R3: ten points a
 *  section in place of the octagon, one ring less, the arm in sight in front of the housing) */
function mirror(b: Build, skin: Skin, S: Surf, F: PartFrame, k: number, reach: number, rot: number, tilt: number): string | null {
  const s = F.n[1] >= 0 ? 1 : -1, L: V = [0, s, 0], X0: V = [1, 0, 0], Z0: V = [0, 0, 1], c = add(add(F.o, mul(L, reach)), [20 * k, 0, reach * 0.52]);
  // the housing's axes turned (rot about the vertical, its outer end toward the back for +) and tilted (tilt about the car's across)
  const r = rot * Math.PI / 180 * s, t = tilt * Math.PI / 180, turn = (v: V): V => { const x1 = v[0] * Math.cos(r) - v[1] * Math.sin(r), y1 = v[0] * Math.sin(r) + v[1] * Math.cos(r); return [x1 * Math.cos(t) - v[2] * Math.sin(t), y1, x1 * Math.sin(t) + v[2] * Math.cos(t)]; };
  const X = turn(X0), Lr = turn(L), Z = turn(Z0), at = (x: number, l: number, z: number): V => add(add(add(c, mul(X, x)), mul(Lr, l)), mul(Z, z));
  // the section (l out, z up): the outer end round and full, the inner side flatter, the top a little flatter than the foot
  const O: [number, number][] = [[1, 0.25], [0.8, 0.82], [0.15, 1], [-0.62, 0.92], [-1, 0.45], [-1, -0.4], [-0.62, -0.88], [0.15, -0.96], [0.8, -0.78], [1, -0.22]];
  const ringAt = (x: number, hw: number, hh: number, dl = 0, dz = 0) => O.map(([l, z]) => at(x, dl + l * hw, dz + z * hh));
  const R0 = ringAt(-52 * k, 30 * k, 20 * k, -10 * k, -4 * k), R1 = ringAt(-22 * k, 54 * k, 38 * k, -2 * k), R2 = ringAt(36 * k, 60 * k, 44 * k), G = ringAt(30 * k, 53 * k, 37 * k);
  b.name('mirror').mat(PAINT, 0.6, 'paint'); loftOut(b, [R0, R1, R2], false);
  { const c0 = centroid(R0); for (let i = 0; i < O.length; i++) tri(b, c0, R0[i]!, R0[(i + 1) % O.length]!, neg(X)); }
  for (let i = 0; i < O.length; i++) { const j = (i + 1) % O.length; quad(b, R2[i]!, R2[j]!, G[j]!, G[i]!, vsub(centroid(G), R2[i]!)); }
  b.name('mirrorGlass').mat('#5e6a75', 0.9, 'plain'); { const cg = centroid(G); for (let i = 0; i < O.length; i++) tri(b, cg, G[i]!, G[(i + 1) % O.length]!, X); }
  // the arm: from the foot out to the housing's inner front foot, flat (wide along the car, thin up and down), in front of the housing's inner end
  b.name('mirror').mat(PAINT, 0.6, 'paint'); const foot = vmadd(vmadd(F.o, F.n, -4), [1, 0, 0], -6 * k), end = at(-26 * k, -44 * k, -14 * k);
  const arm = (p: V, w: number, h: number) => [vmadd(vmadd(p, X, -w), Z, -h), vmadd(vmadd(p, X, w), Z, -h), vmadd(vmadd(p, X, w), Z, h), vmadd(vmadd(p, X, -w), Z, h)];
  loftOut(b, [arm(foot, 26 * k, 9 * k), arm(end, 18 * k, 7 * k)], false);
  // the foot: a sail laid on the door's corner
  const FO = rrect(36 * k, 26 * k, 14 * k, 1); wall(b, S, FO, -3, 6); cover(b, S, FO, 6, 1);
  // the housing must stand clear of the body: its middle outside the skin (a ray out of it meets no skin) and the skin
  // not within its reach
  if (skin.hit(c, L, 3000)) return '미러가 차체에 묻힙니다';
  const g = skin.hit(c, neg(L), reach + 200); if (g && g.t < 30 * k) return '미러가 차체에 너무 붙었습니다';
  return null; }

/** the blade's section: an inverted aerofoil (u along the chord from its leading edge, w up), as the 599's */
const PR: [number, number][] = [[0, 0], [0.04, 0.03], [0.2, 0.045], [0.5, 0.04], [0.85, 0.02], [1, 0.008], [1, -0.006], [0.85, -0.032], [0.5, -0.075], [0.2, -0.07], [0.04, -0.035]];
/** a wing on the centre line: a blade level across the car `height` over the skin under its middle, its section turned
 *  `aoa` degrees (its trailing edge up). The GT wing stands on two uprights with end plates; the N33's (docs/systems/117
 *  R3) on two broad stays at its ends, swept back as they rise from the deck's corners, small dark end plates outside them.
 *  The feet are laid on the skin under each corner */
function wingOn(b: Build, skin: Skin, pt: SkinPoint, n33: boolean, span: number, height: number, aoa: number): { chord: number; why: string | null } {
  const C = span * (n33 ? 0.165 : 0.18), x0 = pt.p[0] - C * 0.45, zb = pt.p[2] + height, A = aoa * Math.PI / 180, ca = Math.cos(A), sa = Math.sin(A);
  const sec = (u: number, w: number): [number, number] => [x0 + (u * ca - w * sa) * C, zb + (u * sa + w * ca) * C];
  const lowZ = (u: number) => sec(u, -0.07)[1];
  const half = span / 2, yEnd = half, ny = 10;
  const rings: V[][] = []; for (let i = 0; i <= ny; i++) { const y = -yEnd + 2 * yEnd * i / ny; rings.push(PR.map(([u, w]) => { const [x, z] = sec(u, w); return [x, y, z]; })); }
  b.name('wing').mat(PAINT, 0.6, 'paint'); loftOut(b, rings, true);
  let why: string | null = null; const down = (x: number, y: number) => skin.hit([x, y, zb + 1500], [0, 0, -1], 4000);
  /** an upright from the blade's underside to the skin: its section (x0..x1 along, y0..y1 across) laid on the skin at each
   *  corner; toward its foot its chord `grow`s, it moves `out` across and `fwd` along */
  const upright = (xa: number, xb: number, ya: number, yb: number, top: number, out = 0, grow = 1, fwd = 0) => { const st = 4, R: V[][] = [];
    for (let k = 0; k <= st; k++) { const f = k / st, xm = (xa + xb) / 2 + fwd * f, hl = (xb - xa) / 2 * (1 + (grow - 1) * f * f), dy = out * f * f;
      const cs: [number, number][] = [[xm - hl, ya + dy], [xm + hl, ya + dy], [xm + hl, yb + dy], [xm - hl, yb + dy]];
      R.push(cs.map(([x, y]) => { const h = down(x, y); if (!h) { why ??= '윙 다리가 차체 밖에 닿습니다'; return [x, y, top - 200] as V; } const zf = h.p[2] - 8; return [x, y, top + (zf - top) * f] as V; })); }
    loftOut(b, R, true); };
  if (n33) { // the stays at the ends: as long as the blade's chord at the top, longer and further forward at the deck
    for (const s of [-1, 1]) upright(x0 + 0.08 * C, x0 + 0.9 * C, s * (half - 64), s * (half - 22), lowZ(0.5) + 6, 0, 1.25, -0.45 * C);
    b.name('wingPlate').mat('#1f2022', 0.4, 'plain');
    for (const s of [-1, 1]) { const out: [number, number][] = [[-0.04, -0.2], [1.04, -0.12], [1.06, 0.16], [0.08, 0.12]], P = (y: number) => out.map(([u, w]) => { const [x, z] = sec(u, w); return [x, y, z] as V; });
      loftOut(b, [P(s * half), P(s * (half + 6))], true); } }
  else { for (const s of [-1, 1]) upright(x0 + 0.3 * C, x0 + 0.8 * C, s * (span * 0.3 - 6), s * (span * 0.3 + 6), lowZ(0.55) + 4);
    b.name('wingPlate').mat('#1f2022', 0.4, 'plain');
    for (const s of [-1, 1]) { const out: [number, number][] = [[-0.08, -0.34], [1.08, -0.2], [1.14, 0.24], [0.1, 0.22], [-0.08, 0.05]], P = (y: number) => out.map(([u, w]) => { const [x, z] = [x0 + u * C, zb + w * C]; return [x, y, z] as V; });
      loftOut(b, [P(s * half), P(s * (half + 8))], true); } }
  // the blade clear of the body: the skin under its leading edge, middle and trailing edge, across its span, well below it
  if (!why) for (const u of [0, 0.5, 1]) for (let i = 0; i <= 8; i++) { const y = -yEnd * 0.98 + yEnd * 1.96 * i / 8, h = down(sec(u, 0)[0], y); if (h && h.p[2] > lowZ(u) - 20) { why = '날개가 차체에 닿습니다 (높이를 올리세요)'; break; } }
  return { chord: C, why }; }

/** the 599's ring wing as a part (docs/systems/117 R3, in place of P1's blade on flat legs): one hoop, the blade's section
 *  carried along it: straight across the car `height` over the skin, turning down round both ends and running down as
 *  legs whose chord grows and which lean out toward their feet on the skin. The blade's angle fades out down the legs */
function ringWing(b: Build, skin: Skin, pt: SkinPoint, span: number, height: number, aoa: number): { chord: number; why: string | null } {
  const C = span * 0.2, half = span / 2, zb = pt.p[2] + height, xm = pt.p[0] - C * 0.45; let why: string | null = null;
  const down = (x: number, y: number) => skin.hit([x, y, zb + 1500], [0, 0, -1], 4000);
  // the feet: the skin under each leg's middle (a leg leans out a little toward it)
  const yF = half + span * 0.02, feet = [-1, 1].map(s => { const h = down(xm + C * 0.5, s * yF); if (!h) why ??= '윙 다리가 차체 밖에 닿습니다'; return h ? h.p[2] - 10 : zb - height; });
  const Rc = Math.min(height * 0.55, span * 0.1, 150), top = zb + 0.03 * C;
  // the hoop's path in (y, z) and its outward normal, with how far down the leg (0 on the blade .. 1 at the foot)
  const path: { y: number; z: number; ny: number; nz: number; f: number }[] = [];
  for (const s of [-1, 1]) { const pts: typeof path = [], zf = feet[s < 0 ? 0 : 1]!, legTop = top - Rc;
    for (let k = 2; k >= 1; k--) { const f = k / 2, z = legTop + (zf - legTop) * f; pts.push({ y: s * (half - Rc + Rc + (yF - half) * f * f), z, ny: s, nz: 0, f: 0.4 + 0.6 * f }); }
    for (let k = 0; k <= 3; k++) { const a = (k / 3) * Math.PI / 2; pts.push({ y: s * (half - Rc + Rc * Math.cos(a)), z: legTop + Rc * Math.sin(a), ny: s * Math.cos(a), nz: Math.sin(a), f: 0.4 * (1 - k / 3) }); }
    if (s < 0) path.push(...pts); else path.push(...pts.reverse()); }
  // the straight blade between the arcs' ends
  const iR = path.findIndex((q, i) => i > 0 && q.y > 0); const mid: typeof path = []; for (let k = 1; k < 5; k++) { const y = -(half - Rc) + 2 * (half - Rc) * k / 5; mid.push({ y, z: top, ny: 0, nz: 1, f: 0 }); }
  path.splice(iR, 0, ...mid);
  const rings = path.map(q => { const Cl = C * (1 + 0.4 * q.f * q.f), A = aoa * Math.PI / 180 * (1 - Math.min(1, q.f * 2)), ca = Math.cos(A), sa = Math.sin(A), x0 = xm - (Cl - C) * 0.4;
    return PR.map(([u, w]) => { const x = x0 + (u * ca - w * sa) * Cl, o = (u * sa + w * ca) * Cl * (q.nz > 0.5 ? 1 : 0.85) - 0.03 * C; return [x, q.y + q.ny * o, q.z + q.nz * o] as V; }); });
  b.name('wing').mat(PAINT, 0.6, 'paint'); loftOut(b, rings, true);
  // the blade clear of the body
  if (!why) for (const u of [0, 0.5, 1]) for (let i = 0; i <= 6; i++) { const y = -(half - Rc) + 2 * (half - Rc) * i / 6, h = down(xm + u * C, y); if (h && h.p[2] > top - 0.08 * C - 20) { why = '날개가 차체에 닿습니다 (높이를 올리세요)'; break; } }
  return { chord: C, why }; }
