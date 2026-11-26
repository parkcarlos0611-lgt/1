// The parts that cut their hole (docs/systems/115 P2, §5-3): a head lamp, a tail lamp, an intake or a grille, a cut vent
// or louvre placed anywhere on a lump's skin, the skin opened to its footprint and a pocket closed behind it. Nothing of
// the hole is stored: the design keeps the part (core/placed.ts), and the body's mesh is cut again from the lump's own
// shell every time it is built, part by part in the list's order, so a part moved, resized or taken off leaves the shell
// as it was and the old hole closes by itself.
//   - the footprint: an ellipse or a rounded rectangle in the part's frame (its kind's shape, its size, its width ratio),
//     laid on the skin by rays along the frame's normal; a band that wraps round a corner (the 599's tail lamp band) is
//     laid by rays fanned round an axis inside the body: straight in its middle, turning about the axis's ends beyond
//   - the cut (cutShell): every face of the shell under the footprint taken out (the islands it would leave filled, the
//     pinches it would make widened), the ring of edges left round it zipped to the footprint's own ring (the rim) with
//     triangles that each keep the panel they stand in, and the pocket closed behind the rim: a wall `depth` deep along
//     the rays and a floor that follows the skin (a lamp band's floor is its lens). The rim and the wall's foot are
//     creases, and the rim is a drawn line (kind lamp or vent), so the drift style's outline and lines draw it clean
//   - the part's own insides (a lamp's bezel and lens, a grille's mesh, an intake's bars, a louvre's slats) are drawn in
//     the pocket; while the builder drags a part it is not cut: a preview lays the footprint dark on the skin with the
//     insides lifted to it (the builder's phones stay smooth: the shell is cut once, on release)
//   - refused: a footprint off the body, over glass, a lamp, a grille, a wheel arch or the floor, across a door's gap,
//     across the centre line (a pair), or within 40 mm of another hole (merging holes is P4)
import { Build, KINDS, type Kind, type Mesh, type MeshLine, type V } from '../mesh';
import { partFrame, vdot, vsub, vmadd, vunit, vcross, type Skin, type PartFrame, type SkinPoint, type SkinTag } from '../skin';
import { PART_KINDS, placedKey, type HoleId, type Placed, type PartKind } from '../../../core/placed';
import type { Shell959 } from '../p959/shell';
import type { Tag, Mat } from '../p959/cage';
import { cornerNormals, ekey, faceNormal } from '../p959/subdiv';
import { headLamp } from '../p959/parts';
import { lampUV, type LampArt } from '../lampart';
import type { PartFit, PartFigures, Footprint } from './index';

const neg = (a: V): V => [-a[0], -a[1], -a[2]], add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const mirV = (a: V): V => [a[0], -a[1], a[2]];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
type P2 = [number, number];

// ---- the footprint ----
/** how a footprint is laid on the skin: its frame, and for a wrapped band the half length laid straight (`L0`) and the
 *  radius it turns about beyond it (`R`); a flat part: L0 infinite */
export interface Proj { F: PartFrame; L0: number; R: number }
const axisOf = (P: Proj) => vmadd(P.F.o, P.F.n, -P.R);
/** the way out of the skin at a footprint's s (a flat part: its normal) */
export function dirAt(P: Proj, s: number): V { if (Math.abs(s) <= P.L0) return P.F.n; const f = (Math.abs(s) - P.L0) / P.R, g = Math.sign(s); return vunit(add(mul(P.F.n, Math.cos(f)), mul(P.F.u, g * Math.sin(f)))); }
/** the ray that lays a footprint's point (s, y) on the skin: from outside, inward */
export function rayAt(P: Proj, s: number, y: number, reach = 300): { o: V; d: V; max: number } {
  const d = dirAt(P, s); if (!Number.isFinite(P.L0)) { const base = vmadd(vmadd(P.F.o, P.F.u, s), P.F.up, y); return { o: vmadd(base, d, reach), d: neg(d), max: reach * 2 }; }
  const base = vmadd(vmadd(axisOf(P), P.F.u, Math.sign(s) * Math.min(Math.abs(s), P.L0)), P.F.up, y); return { o: vmadd(base, d, P.R + reach), d: neg(d), max: P.R + reach * 2 }; }
/** a point's footprint coordinates: (s, y) and its height over the frame's plane (a band: over its wrapped surface) */
export function coordOf(P: Proj, p: V): [number, number, number] { const F = P.F;
  if (!Number.isFinite(P.L0)) { const d = vsub(p, F.o); return [vdot(d, F.u), vdot(d, F.up), vdot(d, F.n)]; }
  const q = vsub(p, axisOf(P)), a = vdot(q, F.u), b = vdot(q, F.n), y = vdot(q, F.up); if (Math.abs(a) <= P.L0) return [a, y, b - P.R];
  const g = Math.sign(a), a2 = Math.abs(a) - P.L0, f = Math.atan2(a2, b); return [g * (P.L0 + f * P.R), y, Math.hypot(a2, b) - P.R]; }
/** a kind's footprint for an entry: its half sizes and its outline (s, y), counter-clockwise, a point every 25..40 mm */
export function outlineOf(K: PartKind, p: Placed): { hw: number; hh: number; O: P2[]; r: number } { const H = K.hole!, w = K.size * p.scale * (p.sx ?? 1), h = K.size * H.aspect * p.scale, hw = w / 2, hh = h / 2;
  if (H.shape === 'ellipse') { const per = Math.PI * (3 * (hw + hh) - Math.sqrt((3 * hw + hh) * (hw + 3 * hh))), n = clamp(Math.ceil(per / 26), 16, 64);
    return { hw, hh, r: Math.min(hw, hh), O: Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2; return [Math.cos(t) * hw, Math.sin(t) * hh] as P2; }) }; }
  // its own convex outline (a slanted lamp's): each side a point every 45 mm at most
  if (H.shape === 'poly') { const Q = H.poly!.map(([x, y]) => [x * hw, y * hh] as P2), O: P2[] = [];
    Q.forEach((a, i) => { const b = Q[(i + 1) % Q.length]!, k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 45)); for (let j = 0; j < k; j++) O.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); });
    return { hw, hh, r: Math.min(hw, hh) * 0.2, O }; }
  // a straight side a point every 60 mm (a fine cell of the shell is about 70); a band's sides where they wrap round its corners every 35
  const r = Math.min(hw, hh) * (H.r ?? 0.2), O: P2[] = [], L0 = H.wrap ? hw * H.wrap.flat : Infinity, line = (a: P2, b: P2) => { const len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(len / 60));
    if (a[1] !== b[1] || !Number.isFinite(L0)) { for (let i = 0; i < k; i++) O.push([a[0] + (b[0] - a[0]) * i / k, a[1] + (b[1] - a[1]) * i / k]); return; }
    // along a wrapped band: 60 mm apart in its straight middle, 35 round the corners
    const xs: number[] = [], g = Math.sign(b[0] - a[0]); for (let x = a[0]; g * (b[0] - x) > 1e-6;) { xs.push(x); const step = Math.abs(x) < L0 - 1 && Math.abs(x + g * 60) <= L0 ? 60 : 35; x = g > 0 ? Math.min(b[0], x + step) : Math.max(b[0], x - step); }
    for (const x of xs) O.push([x, a[1]]); };
  const arc = (cx: number, cy: number, a0: number) => { const k = r > 30 ? 4 : r > 8 ? 3 : 1; for (let i = 0; i < k; i++) { const a = (a0 + i / k * 0.5) * Math.PI; O.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  // counter-clockwise from the right side's foot
  line([hw, -hh + r], [hw, hh - r]); arc(hw - r, hh - r, 0); line([hw - r, hh], [-hw + r, hh]); arc(-hw + r, hh - r, 0.5); line([-hw, hh - r], [-hw, -hh + r]); arc(-hw + r, -hh + r, 1); line([-hw + r, -hh], [hw - r, -hh]); arc(hw - r, -hh + r, 1.5);
  return { hw, hh, r, O }; }
/** a point inside a convex outline (counter-clockwise), `m` mm in from it (negative: out) */
function insideO(O: readonly P2[], x: number, y: number, m = 0): boolean { for (let i = 0; i < O.length; i++) { const a = O[i]!, b = O[(i + 1) % O.length]!, ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1;
    if ((ex * (y - a[1]) - ey * (x - a[0])) / l < m) return false; } return true; }
const area2 = (Q: readonly P2[]) => { let s = 0; for (let i = 0; i < Q.length; i++) { const a = Q[i]!, b = Q[(i + 1) % Q.length]!; s += a[0] * b[1] - a[1] * b[0]; } return s / 2; };

/** a hole as the cut takes it: its kind and key, its projection, its outline and the outline's points on the skin with
 *  the way out there, the pocket's depth, the materials of its rim's wall and of its floor (by the floor's s) */
export interface HoleCut { key: string; id: HoleId; proj: Proj; O: P2[]; ring: V[]; dirs: V[]; depth: number; /** the heights of its skin over its frame (min, max) */ h: [number, number]; wall: Mat; floor: (s: number) => Mat; line: MeshLine['kind'] }
/** what a hole part's fit carries: the cut (and its twin's, mirrored), the drag preview */
export interface HoleFit { cuts: HoleCut[]; preview(): Mesh; open: number; /** its footprints for the overlap rules (its twin's too) */ prints: Footprint[] }
const MATC: Record<Mat, [string, number, Kind]> = { paint: ['#b8bcc2', 0.6, 'paint'], glass: ['#20262c', 0.9, 'glass'], grille: ['#17181a', 0.1, 'grille'], dark: ['#1b1c1e', 0.05, 'plain'], lamp: ['#b3261e', 0.5, 'lens'], amber: ['#d9861c', 0.5, 'lens'], lens: ['#17181a', 0.1, 'plain'] };
/** what a hole may not be cut through */
const HOLE_BAD_MAT = new Set(['glass', 'lens', 'lamp', 'amber', 'grille', 'dark']), HOLE_BAD_PANEL = /^(archLip|wheelWell|floor|wingSlot)$|Rim$|^hole/, GLASS_PANEL = /Glass$|^windscreen$|^rearWindow$/;
function holeTag(t: SkinTag): string | null { if (HOLE_BAD_PANEL.test(t.panel)) return /Rim$|^hole/.test(t.panel) ? '다른 구멍과 겹칩니다' : '바퀴 아치·바닥에는 구멍을 낼 수 없습니다';
  if (GLASS_PANEL.test(t.panel) || t.mat === 'glass') return '창문 자리에는 구멍을 낼 수 없습니다';
  return HOLE_BAD_MAT.has(t.mat ?? '') ? '램프·흡기구·그릴 자리와 겹칩니다' : null; }
/** the kinds' pockets: the wall's material (the 599's sockets' rims are painted), the floor's (a lamp band's floor is its
 *  lens, amber at its ends), the rim's line */
function pocketOf(id: HoleId, hw: number): Pick<HoleCut, 'wall' | 'floor' | 'line'> { switch (id) {
  case 'lampRound': case 'lampEllipsoid': case 'lampSquare': case 'lampSlant': return { wall: 'paint', floor: () => 'dark', line: 'lamp' };
  case 'fogLamp': return { wall: 'dark', floor: () => 'dark', line: 'lamp' };
  case 'tailBand': { const amber = hw * 0.743; return { wall: 'paint', floor: s => Math.abs(s) > amber ? 'amber' : 'lamp', line: 'lamp' }; }
  case 'tailRound': return { wall: 'dark', floor: () => 'dark', line: 'lamp' };
  case 'sideIntake': return { wall: 'paint', floor: () => 'grille', line: 'vent' };
  default: return { wall: 'dark', floor: () => 'grille', line: 'vent' }; } }

/** a footprint's points laid on the skin (null: one misses the body) */
function lay(skin: Skin, P: Proj, pts: readonly P2[]): ({ p: V; n: V; d: V; tag: SkinTag } | null)[] { return pts.map(([s, y]) => { const r = rayAt(P, s, y), h = skin.hit(r.o, r.d, r.max); return h ? { p: h.p, n: h.n, d: neg(r.d), tag: h.tag } : null; }); }

/** a hole part fitted at a point of the skin: the rules, its pocket's ring, its insides (`mesh`, drawn in the pocket) and
 *  its preview; `others`: the footprints already on the body (a hole's: refused within 40 mm; another part's: a warning) */
export function fitHoleAt(skin: Skin, pt: SkinPoint, p: Placed & { id: HoleId }, others: readonly Footprint[]): PartFit {
  const id = p.id, K = PART_KINDS[id], H = K.hole!, depth = p.depth ?? K.depth0, F = partFrame(pt.p, pt.n, p.rot, 0), { hw, hh, O } = outlineOf(K, p);
  const P: Proj = H.wrap ? { F, L0: hw * H.wrap.flat, R: H.wrap.r * p.scale } : { F, L0: Infinity, R: 0 };
  const twin = K.pair && !p.one && Math.abs(pt.p[1]) > 2; let why: string | null = null;
  // the rim on the skin, and probes inside it and just outside it (the rules read every face the cut will take)
  const rim = lay(skin, P, O), grid: P2[] = [], st = clamp(Math.min(hw, hh) / 2, 15, 60);
  for (let s = -hw; s <= hw + 1e-6; s += Math.max(st, 2 * hw / 40)) for (let y = -hh; y <= hh + 1e-6; y += st) if (insideO(O, s, y, 1)) grid.push([s, y]);
  const outO = O.map(([s, y]) => { const l = Math.hypot(s / hw, y / hh) || 1; return [s + s / hw / l * 2.5, y + y / hh / l * 2.5] as P2; });
  const probes = [...rim, ...lay(skin, P, grid), ...lay(skin, P, outO)];
  if (probes.some(r => !r)) why = '부품이 차체 밖으로 나갑니다';
  why ??= probes.map(r => holeTag(r!.tag)).find(Boolean) ?? null;
  if (!why) { const doors = probes.map(r => r!.tag.panel === 'door'); if (doors.some(Boolean) && !doors.every(Boolean)) why = '문 틈을 넘습니다'; }
  if (!why && rim.some(r => vdot(r!.n, r!.d) < 0.3)) why = '면이 너무 비스듬합니다 (굽은 곳에서는 작게 하세요)';
  // the rim on one sheet: no step between its points (a wing or a lip standing over the footprint hides part of it)
  //  (the skin under the rim may slope up to about 72 degrees to the frame: the facing rule; a steeper rise between two points is a step)
  if (!why && rim.some((r, i) => { const q = rim[(i + 1) % rim.length]!, a = O[i]!, c = O[(i + 1) % O.length]!; return Math.abs(coordOf(P, r!.p)[2] - coordOf(P, q.p)[2]) > Math.hypot(a[0] - c[0], a[1] - c[1]) * 3.5 + 8; })) why = '다른 면에 가려집니다 (윙·립 아래)';
  if (!why && K.centreOnly && Math.abs(pt.p[1]) > 5) why = '가운데 선 위에만 낼 수 있습니다';
  if (!why && twin && rim.some(r => Math.sign(r!.p[1]) !== Math.sign(pt.p[1]) || Math.abs(r!.p[1]) < 25)) why = '가운데 선을 넘습니다 (한쪽만으로 하거나 옆으로 옮기세요)';
  const pocket = pocketOf(id, hw), ring = rim.map(r => r?.p ?? framePtOf(F, 0, 0)), dirs = rim.map(r => r?.d ?? F.n);
  const hs = probes.filter(r => r).map(r => coordOf(P, r!.p)[2]), cut: HoleCut = { key: placedKey(p), id, proj: P, O, ring, dirs, depth, h: [Math.min(...hs, 0), Math.max(...hs, 0)], ...pocket };
  const cuts = [cut, ...(twin ? [mirrorCut(cut)] : [])];
  // within 40 mm of another hole: refused; touching another part: shown
  const mine: Footprint[] = cuts.map(c => holePrint(c, hw, hh));
  if (!why && others.some(o => o.hole && mine.some(m => holesMeet(m, o)))) why = '다른 구멍 부품과 겹칩니다 (40 mm 띄우세요)';
  const warn = !why && others.some(o => !o.hole && mine.some(m => holesMeet(m, o))) ? '다른 부품과 겹칩니다 (붙일 수는 있습니다)' : null;
  // the insides, on the skin under the footprint (a point's height along the way out: negative into the pocket)
  const cache = new Map<string, { p: V; d: V } | null>(), under = (s: number, y: number) => { const k = `${s.toFixed(1)},${y.toFixed(1)}`; if (!cache.has(k)) { const r = rayAt(P, s, y), h = skin.hit(r.o, r.d, r.max); cache.set(k, h ? { p: h.p, d: neg(r.d) } : null); } return cache.get(k)!; };
  const at = (s: number, y: number, h: number): V => { const u = under(s, y); return u ? vmadd(u.p, u.d, h) : vmadd(framePtOf(F, s, y), F.n, h); };
  const b = new Build(); if (!why) insides(b, id, F, at, hw, hh, depth, pt);
  const mesh = b.mesh(0), area = Math.PI * hw * hh * (H.shape === 'ellipse' ? 1 : 4 / Math.PI) / 1e6, open = /^lamp|^tail|^fog/.test(id) ? 0 : area * (id === 'grille' || id === 'grilleSlot' ? 0.7 : id === 'intakeOpen' ? 0.85 : id === 'louvreCut' ? 0.5 : 0.6) * (twin ? 2 : 1);
  const fig: PartFigures = { id, at: twin ? [pt.p[0], 0, pt.p[2]] : pt.p, count: twin ? 2 : 1, frontal: 0, plan: 0, mass: Math.round(MASS[id] * (twin ? 2 : 1) * p.scale * 100) / 100, open, facing: Math.abs(pt.n[0]) };
  const hole: HoleFit = { cuts, open, prints: mine, preview: () => previewOf(cut, mesh, depth) };
  return { p, key: placedKey(p), kind: K, F, size: K.size * p.scale, depth, twin, hw, hh, ok: !why, why, warn, mesh, fig, hole }; }
const framePtOf = (F: PartFrame, x: number, y: number): V => vmadd(vmadd(F.o, F.u, x), F.up, y);
const MASS: Record<HoleId, number> = { lampRound: 2.2, lampEllipsoid: 2.4, lampSquare: 2.4, lampSlant: 2.8, fogLamp: 0.5, grilleSlot: 0.5, intakeOpen: 0.9, tailBand: 1.6, tailRound: 0.4, grille: 0.8, sideIntake: 0.3, ventCut: 0.3, louvreCut: 0.6 };
/** a cut mirrored across the centre line (a pair's twin) */
export function mirrorCut(c: HoleCut): HoleCut { const F = c.proj.F; return { ...c, key: c.key + '~', proj: { ...c.proj, F: { o: mirV(F.o), n: mirV(F.n), u: mirV(F.u), up: mirV(F.up) } }, ring: c.ring.map(mirV), dirs: c.dirs.map(mirV) }; }
/** a hole's footprint for the overlap rules: its frame's rectangle, and its own test (inside its outline 40 mm wide, near its skin) */
function holePrint(c: HoleCut, hw: number, hh: number): Footprint { return { F: c.proj.F, hw, hh, hole: true, pts: c.ring, inside: (q: V) => { const [s, y, h] = coordOf(c.proj, q); return Math.abs(h) < 90 && insideO(c.O, s, y, -40); } }; }
/** two footprints meeting: either's rim points inside the other (a rectangle's own test for the surface parts) */
function holesMeet(a: Footprint, b: Footprint): boolean { const inRect = (P: Footprint, q: V) => { const d = vsub(q, P.F.o); return Math.abs(vdot(d, P.F.u)) <= P.hw + 40 && Math.abs(vdot(d, P.F.up)) <= P.hh + 40 && Math.abs(vdot(d, P.F.n)) <= 90; };
  const pts = (P: Footprint) => P.pts ?? [-1, 0, 1].flatMap(i => [-1, 0, 1].map(j => framePtOf(P.F, i * P.hw, j * P.hh))), test = (P: Footprint, q: V) => P.inside ? P.inside(q) : inRect(P, q);
  return pts(b).some(q => test(a, q)) || pts(a).some(q => test(b, q)) || test(a, b.F.o) || test(b, a.F.o); }

// ---- the insides ----
type At = (s: number, y: number, h: number) => V;
const quadOut = (b: Build, p: V, q: V, r: V, s: V, out: V) => { const t = (a: V, c: V, d: V) => vdot(vcross(vsub(c, a), vsub(d, a)), out) >= 0 ? b.tri(a, c, d) : b.tri(a, d, c); t(p, q, r); t(p, r, s); };
/** rings of the same count joined (facing out of the skin), and a ring closed to a point */
const band = (b: Build, F: PartFrame, A: V[], B: V[]) => { for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length; quadOut(b, A[i]!, A[j]!, B[j]!, B[i]!, F.n); } };
const cap = (b: Build, F: PartFrame, A: V[], c: V) => { for (let i = 0; i < A.length; i++) { const t = [c, A[i]!, A[(i + 1) % A.length]!] as const; vdot(vcross(vsub(t[1], t[0]), vsub(t[2], t[0])), F.n) >= 0 ? b.tri(t[0], t[1], t[2]) : b.tri(t[0], t[2], t[1]); } };
/** a lens's triangle carrying its picture (render/car/lampart.ts): each corner its place and its picture's (x, y) 0..1, facing out */
type Pic = [V, number, number];
const artTri = (b: Build, k: LampArt, out: V, p: Pic, q: Pic, r: Pic) => { const f = vdot(vcross(vsub(q[0], p[0]), vsub(r[0], p[0])), out) >= 0, [A, B, C] = f ? [p, q, r] : [p, r, q]; b.tri(A[0], B[0], C[0]).art([...lampUV(k, A[1], A[2]), ...lampUV(k, B[1], B[2]), ...lampUV(k, C[1], C[2])]); };
/** a round lens domed a little over (cx, cy), its picture's circle `k` of its radius: rings at radii `rs` (each with its height), closed at its middle */
function artDome(b: Build, art: LampArt, F: PartFrame, at: At, cx: number, cy: number, rx: number, ry: number, rs: readonly (readonly [number, number])[], top: number, N = 16): void {
  const P = (q: number, h: number, i: number): Pic => { const t = i / N * Math.PI * 2, c = Math.cos(t) * q, s = Math.sin(t) * q; return [at(cx + c * rx, cy + s * ry, h), 0.5 + c / 2, 0.5 - s / 2]; };
  for (let j = 0; j + 1 < rs.length; j++) for (let i = 0; i < N; i++) { const [q0, h0] = rs[j]!, [q1, h1] = rs[j + 1]!, a = P(q0, h0, i), c = P(q0, h0, i + 1), d = P(q1, h1, i + 1), e = P(q1, h1, i); artTri(b, art, F.n, a, c, d); artTri(b, art, F.n, a, d, e); }
  const [ql, hl] = rs[rs.length - 1]!, m: Pic = [at(cx, cy, top), 0.5, 0.5]; for (let i = 0; i < N; i++) artTri(b, art, F.n, m, P(ql, hl, i), P(ql, hl, i + 1)); }
/** a bar across the pocket from (s0, y) to (s1, y) (or along y when `vert`), `t` wide, its face at `h`, its side down to `h0`, in pieces along the skin */
function bar(b: Build, at: At, F: PartFrame, a0: number, a1: number, c: number, t: number, h: number, h0: number, vert = false) { const k = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 70)), P = (a: number, o: number, hh: number) => vert ? at(c + o, a, hh) : at(a, c + o, hh);
  for (let i = 0; i < k; i++) { const x0 = a0 + (a1 - a0) * i / k, x1 = a0 + (a1 - a0) * (i + 1) / k;
    quadOut(b, P(x0, -t / 2, h), P(x1, -t / 2, h), P(x1, t / 2, h), P(x0, t / 2, h), F.n); quadOut(b, P(x0, -t / 2, h), P(x1, -t / 2, h), P(x1, -t / 2, h0), P(x0, -t / 2, h0), vert ? neg(F.u) : neg(F.up)); } }
/** the half width of the outline at a height (an ellipse's or a rounded rectangle's, drawn a little inside it) */
const spanAt = (round: boolean, hw: number, hh: number, r: number, y: number) => round ? hw * Math.sqrt(Math.max(0, 1 - (y / hh) ** 2)) : Math.abs(y) <= hh - r ? hw : hw - r + Math.sqrt(Math.max(0, r * r - (Math.abs(y) - hh + r) ** 2));
function insides(b: Build, id: HoleId, F: PartFrame, at: At, hw: number, hh: number, depth: number, pt: SkinPoint): void {
  const K = PART_KINDS[id], r = Math.min(hw, hh) * (K.hole!.r ?? 0.2);
  switch (id) {
    case 'lampRound': case 'lampEllipsoid': case 'lampSquare': { const inset = Math.min(12, Math.min(hw, hh) * 0.1), c = vmadd(pt.p, F.n, -depth);
      headLamp(b, id === 'lampRound' ? 'round' : id === 'lampEllipsoid' ? 'ellipsoid' : 'square', c, F.u, F.up, F.n, hw - inset, hh - inset); return; }
    case 'tailRound': case 'fogLamp': { const N = 16, ring = (k: number, h: number) => Array.from({ length: N }, (_, i) => { const t = i / N * Math.PI * 2; return at(Math.cos(t) * hw * k, Math.sin(t) * hh * k, h); });
      // the rim is a part (crisp against the body); the lens a shallow dome whose rings and grooves are its picture (render/car/lampart.ts)
      if (id === 'fogLamp') { b.name('fogBezel').mat('#2a2b2d', 0.4, 'plain'); band(b, F, ring(0.98, -Math.min(depth, 3)), ring(0.8, -depth * 0.45));
        b.name('fogLamp').mat('#e0961d', 0.6, 'lens'); artDome(b, 'fogAmber', F, at, 0, 0, hw * 0.8, hh * 0.8, [[1, -depth * 0.45], [0.55, -depth * 0.45 + 5]], -depth * 0.45 + 7); return; }
      b.name('tailLampBezel').mat('#c4c7cb', 0.7, 'metal'); band(b, F, ring(0.985, -Math.min(depth, 4)), ring(0.9, -1.5));
      b.name('tailLamp').mat('#b3261e', 0.5, 'lens'); artDome(b, 'tailRings', F, at, 0, 0, hw * 0.9, hh * 0.9, [[1, -1.5], [0.62, 1.2], [0.3, 2.6]], 3.2); return; }
    case 'lampSlant': { // the clear cover a few mm under the rim, following the wrapped skin, inside the outline; the units behind it
      // (a small inner lamp, the projector, the big reflector, the corner lamp) are its picture (render/car/lampart.ts)
      const Q = PART_KINDS.lampSlant.hole!.poly!, cut = (x: number): [number, number] => { let lo = Infinity, hi = -Infinity; Q.forEach((a, i) => { const c = Q[(i + 1) % Q.length]!; if ((a[0] - x) * (c[0] - x) > 0 || a[0] === c[0]) return; const y = a[1] + (c[1] - a[1]) * (x - a[0]) / (c[0] - a[0]); lo = Math.min(lo, y); hi = Math.max(hi, y); }); return [lo, hi]; };
      const m = 16, x0 = -0.985, x1 = 0.985, h = -Math.min(depth, 4), P = (i: number): [Pic, Pic] => { const x = x0 + (x1 - x0) * i / m, [lo, hi] = cut(x), a = lo + 0.03, c = hi - 0.03; return [[at(x * hw, a * hh, h), (x + 1) / 2, (1 - a) / 2], [at(x * hw, c * hh, h), (x + 1) / 2, (1 - c) / 2]]; };
      b.name('headLamp').mat('#dfe4e8', 0.8, 'lens'); for (let i = 0; i < m; i++) { const A = P(i), B = P(i + 1); artTri(b, 'n33Head', F.n, A[0], B[0], B[1]); artTri(b, 'n33Head', F.n, A[0], B[1], A[1]); }
      return; }
    case 'grilleSlot': { // fine bars across and uprights, and in its middle a blank plinth: an emblem's place
      const hf = -depth * 0.4, eh = hh * 0.82, ew = Math.min(hw * 0.3, eh * 1.9); b.name('grilleMesh').mat('#2a2b2d', 0.3, 'plain');
      for (const y of [-hh * 0.36, hh * 0.36]) { const w = spanAt(false, hw, hh, r, y) - 2; bar(b, at, F, -w, -ew - 4, y, 4, hf, -depth + 2); bar(b, at, F, ew + 4, w, y, 4, hf, -depth + 2); }
      const nv = clamp(Math.round(2 * hw / 46), 4, 24); for (let k = 1; k <= nv; k++) { const x = -hw + 2 * hw * k / (nv + 1); if (Math.abs(x) < ew + 6) continue; const hy = spanAt(false, hh, hw, r, x) - 2; bar(b, at, F, -hy, hy, x, 3, hf - 1.5, -depth + 2, true); }
      const N = 14, ring = (k: number, h: number) => Array.from({ length: N }, (_, i) => { const t = i / N * Math.PI * 2; return at(Math.cos(t) * ew * k, Math.sin(t) * eh * k, h); });
      b.name('emblemRim').mat('#c4c7cb', 0.7, 'metal'); { const A = ring(1, -depth + 2), B = ring(1, -1.5), c0 = at(0, 0, -1.5); for (let i = 0; i < N; i++) { const j = (i + 1) % N; quadOut(b, A[i]!, A[j]!, B[j]!, B[i]!, vsub(B[i]!, c0)); } band(b, F, B, ring(0.86, -0.5)); }
      b.name('emblemPlace').mat('#34363a', 0.3, 'plain'); cap(b, F, ring(0.86, -0.5), at(0, 0, -0.5));
      return; }
    case 'intakeOpen': { // a core set deep in the opening (a lighter panel with fins across it) behind two uprights
      if (hw < 110) return;   // a small one is a duct: its dark tunnel alone (a brake duct)
      const iw = hw - Math.min(14, hw * 0.12), ih = hh - Math.min(10, hh * 0.14), hc = -depth + 3, m = Math.max(1, Math.ceil(2 * iw / 150));
      b.name('intakeCore').mat('#3a3d42', 0.3, 'plain'); for (let i = 0; i < m; i++) { const x0 = -iw + 2 * iw * i / m, x1 = -iw + 2 * iw * (i + 1) / m; quadOut(b, at(x0, -ih, hc), at(x1, -ih, hc), at(x1, ih, hc), at(x0, ih, hc), F.n); }
      b.name('intakeFin').mat('#5a5e64', 0.4, 'plain'); const nf = clamp(Math.round(2 * ih / 22), 2, 9); for (let k = 1; k <= nf; k++) { const y = -ih + 2 * ih * k / (nf + 1); bar(b, at, F, -iw, iw, y, clamp(ih / nf * 0.5, 2.5, 6), hc + 3, hc); }
      b.name('intakeBar').mat('#1f2022', 0.3, 'plain'); const nb = hw > 160 ? 2 : 0; for (let k = 1; k <= nb; k++) { const x = -hw + 2 * hw * k / (nb + 1), hy = spanAt(false, hh, hw, r, x) - 1; bar(b, at, F, -hy, hy, x, 10, -depth * 0.35, hc, true); }
      return; }
    case 'grille': { b.name('grilleMesh').mat('#2a2b2d', 0.3, 'plain'); const hf = -depth * 0.35, nh = clamp(Math.round(2 * hh / 42), 1, 7), nv = clamp(Math.round(2 * hw / 58), 2, 16);
      for (let k = 1; k <= nh; k++) { const y = -hh + 2 * hh * k / (nh + 1), w = spanAt(false, hw, hh, r, y) - 2; bar(b, at, F, -w, w, y, 5, hf, -depth + 2); }
      for (let k = 1; k <= nv; k++) { const x = -hw + 2 * hw * k / (nv + 1), hy = spanAt(false, hh, hw, r, x) - 2; bar(b, at, F, -hy, hy, x, 4, hf - 1.5, -depth + 2, true); } return; }
    case 'sideIntake': { b.name('intakeBar').mat('#2a2b2d', 0.3, 'plain'); for (let k = 1; k <= 3; k++) { const y = -hh + 2 * hh * k / 4, w = spanAt(false, hw, hh, r, y) - 1; bar(b, at, F, -w, w, y, 8, -depth * 0.3, -depth + 2); } return; }
    case 'ventCut': { b.name('ventBar').mat('#2a2b2d', 0.3, 'plain'); const n = clamp(Math.round(2 * hh / 26), 1, 6); for (let k = 1; k <= n; k++) { const y = -hh + 2 * hh * k / (n + 1), w = spanAt(false, hw, hh, r, y) - 1; bar(b, at, F, -w, w, y, clamp(hh / (n + 1) * 0.5, 3, 9), -depth * 0.25, -depth + 2); } return; }
    case 'louvreCut': { b.name('louvreSlat').mat('#26272a', 0.35, 'plain'); const k = clamp(Math.round(2 * hh / 30), 3, 14), step = 2 * hh / k;
      for (let j = 0; j < k; j++) { const y0 = -hh + j * step + step * 0.1, y1 = -hh + (j + 1) * step - step * 0.05, w = Math.min(spanAt(false, hw, hh, r, y0), spanAt(false, hw, hh, r, y1)) - 1, m = Math.max(1, Math.ceil(2 * w / 150));
        for (let i = 0; i < m; i++) { const x0 = -w + 2 * w * i / m, x1 = -w + 2 * w * (i + 1) / m; quadOut(b, at(x0, y0, -depth + 2), at(x1, y0, -depth + 2), at(x1, y1, -1.5), at(x0, y1, -1.5), F.n); } } return; }
    default: return; } }

/** the drag's preview (no cut): the footprint laid on the skin in its floor's colours, the insides lifted to the skin */
function previewOf(c: HoleCut, inside: Mesh, depth: number): Mesh { const b = new Build(), top = c.ring.map((p, i) => vmadd(p, c.dirs[i]!, 1.2)), out = c.proj.F.n;
  for (const [i, j, k] of floorTris(c.O)) { const C = MATC[c.floor((c.O[i]![0] + c.O[j]![0] + c.O[k]![0]) / 3)]; b.name('holeFloor').mat(C[0], C[1], C[2]);
    const t = [top[i]!, top[j]!, top[k]!] as const, o = add(add(c.dirs[i]!, c.dirs[j]!), c.dirs[k]!); vdot(vcross(vsub(t[1], t[0]), vsub(t[2], t[0])), o) >= 0 ? b.tri(t[0], t[1], t[2]) : b.tri(t[0], t[2], t[1]); }
  const M = b.mesh(0); if (!inside.n) return M;
  // the insides moved out by the pocket's depth (a flat part: along its normal)
  const lift = mul(out, depth + 1.2), pos = inside.pos.slice(); for (let i = 0; i < pos.length; i += 3) { pos[i] = pos[i]! + lift[0]; pos[i + 1] = pos[i + 1]! + lift[1]; pos[i + 2] = pos[i + 2]! + lift[2]; }
  return joinTwo(M, { ...inside, pos }); }
function joinTwo(a: Mesh, b: Mesh): Mesh { const n = a.n + b.n, off = Math.max(-1, ...Array.from(a.part)) + 1, part = new Int16Array(n); part.set(a.part); for (let t = 0; t < b.n; t++) part[a.n + t] = b.part[t]! + off;
  const cat = <T extends Float32Array | Uint8Array>(x: T, y: T, k: number, C: new (n: number) => T) => { const r = new C(n * k); r.set(x); r.set(y, a.n * k); return r; };
  const names: string[] = [...(a.names ?? []).slice(0, off)]; while (names.length < off) names.push(''); (b.names ?? []).forEach((nm, i) => { names[off + i] = nm; });
  return { n, pos: cat(a.pos, b.pos, 9, Float32Array), col: cat(a.col, b.col, 3, Uint8Array), gloss: cat(a.gloss, b.gloss, 1, Float32Array), part, kind: cat(a.kind, b.kind, 1, Uint8Array), tex: cat(a.tex, b.tex, 1, Uint8Array), length: a.length, names,
    ...(a.uv || b.uv ? { uv: cat(a.uv ?? new Float32Array(a.n * 9), b.uv ?? new Float32Array(b.n * 9), 9, Float32Array) } : {}) }; }

/** a convex outline's inside as triangles (indices of its points, each in the outline's order): strips across it between
 *  its two chains from its leftmost point to its rightmost, so a long band is cut into short pieces along its length */
export function floorTris(O: readonly P2[]): [number, number, number][] { const n = O.length; let a = 0, c = 0; for (let i = 1; i < n; i++) { if (O[i]![0] < O[a]![0]) a = i; if (O[i]![0] > O[c]![0]) c = i; }
  const up: number[] = [], dn: number[] = []; for (let i = a; ; i = (i + 1) % n) { up.push(i); if (i === c) break; } for (let i = a; ; i = (i - 1 + n) % n) { dn.push(i); if (i === c) break; }
  const out: [number, number, number][] = [], ord = (i: number) => (i - a + n) % n, put = (x: number, y: number, z: number) => { const t = [x, y, z].sort((p, q) => ord(p) - ord(q)) as [number, number, number]; out.push(t); };
  let i = 0, j = 0; while (i < up.length - 1 || j < dn.length - 1) { const goUp = j >= dn.length - 1 || (i < up.length - 1 && O[up[i + 1]!]![0] <= O[dn[j + 1]!]![0]);
    if (goUp) { put(up[i]!, up[i + 1]!, dn[j]!); i++; } else { put(dn[j]!, dn[j + 1]!, up[i]!); j++; } }
  return out.filter(t => t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]); }

// ---- the cut ----
/** what the cut gives: the shell with its holes (no surface coordinates: its parts are fitted on the uncut shell), the
 *  holes cut (their keys), the rims' drawn lines, and per hole the triangles it added to the shell */
export interface CutResult { S: Shell959; done: Set<string>; rims: MeshLine[]; added: Map<string, number>; /** why a hole was not cut */ failed: Map<string, string> }
const HELPER = /Rim$|^archLip$|^wheelWell$|^floor$|^wingSlot$|^hole/;
/** the shell `S` cut for each hole in order (a hole whose cut cannot be made is left out: its key is not in `done`);
 *  `skin`: the uncut shell's skin (where each face's place under a footprint is checked) */
export function cutShell(S: Shell959, skin: Skin, cuts: readonly HoleCut[]): CutResult {
  const P = S.P.slice(), F: number[][] = S.F.slice(), tag: Tag[] = S.tag.slice(), alive: boolean[] = F.map(() => true), crease = new Set(S.crease), locked = new Set<number>(), fresh = new Set<number>();
  const done = new Set<string>(), rims: MeshLine[] = [], added = new Map<string, number>(), failed = new Map<string, string>(); let fail = '';
  const pt = (p: V) => { vf.push([]); return P.push(p) - 1; };
  // each point's faces, kept as faces are added (a taken face stays listed, marked dead); an edge's faces are its two
  // points' faces in common
  const vf: number[][] = P.map(() => []), link = (k: number) => { for (const a of F[k]!) vf[a]!.push(k); };
  for (let k = 0; k < F.length; k++) link(k);
  const edges = { get: (key: string): number[] => { const i = key.indexOf('|'), a = +key.slice(0, i), b = +key.slice(i + 1), out: number[] = []; for (const k of vf[a]!) if (alive[k] && vf[b]!.includes(k) && hasEdge(F[k]!, a, b)) out.push(k); return out; } };
  for (const c of cuts) { fail = ''; const r = cutOne(c); if (r === null) { failed.set(c.key, fail || 'cut'); continue; } done.add(c.key); added.set(c.key, r);
    rims.push({ kind: c.line, pts: c.ring.map((p, i) => vmadd(p, c.dirs[i]!, 0.3)), closed: true }); }
  // the shading splits where the material changes at the new faces (as the shell's own: shellFrom)
  const cls = (t: Tag) => { const m = t.was === 'glass' ? 'glass' : t.mat; return m === 'paint' || m === 'dark' ? 'body' : m; };
  for (const k of fresh) { if (!alive[k]) continue; const f = F[k]!; f.forEach((a, q) => { const key = ekey(a, f[(q + 1) % f.length]!); for (const o2 of edges.get(key)) if (o2 !== k && cls(tag[o2]!) !== cls(tag[k]!)) crease.add(key); }); }
  const keep = F.map((_, k) => k).filter(k => alive[k]), F2 = keep.map(k => F[k]!), T2 = keep.map(k => tag[k]!);
  if (!done.size) return { S, done, rims, added, failed };
  // the shading normals per corner only when asked for (the mesh's own are made from its triangles: render/car/p959 emitShell)
  const S2 = { ...S, P, F: F2, tag: T2, crease, nSub: 0 } as Shell959; let N: V[][] | null = null;
  Object.defineProperty(S2, 'N', { get: () => (N ??= cornerNormals(P, F2, crease)), enumerable: true });
  return { S: S2, done, rims, added, failed };

  /** one hole: the triangles it added (net), or null when it cannot be cut */
  function cutOne(c: HoleCut): number | null {
    const lo: V = [Infinity, Infinity, Infinity], hi: V = [-Infinity, -Infinity, -Infinity]; for (const p of c.ring) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k]!, p[k]! - 150); hi[k] = Math.max(hi[k]!, p[k]! + 150); }
    const inBox = (p: V) => p[0] >= lo[0] && p[0] <= hi[0] && p[1] >= lo[1] && p[1] <= hi[1] && p[2] >= lo[2] && p[2] <= hi[2];
    const xy = new Map<number, P2>(), co = (v: number) => { let q = xy.get(v); if (!q) { const s = coordOf(c.proj, P[v]!); q = [s[0], s[1]]; xy.set(v, q); } return q; };
    const O = c.O, removable = (k: number) => alive[k] && !HELPER.test(tag[k]!.panel) && !holeTag(tag[k]! as SkinTag) && !F[k]!.some(v => locked.has(v));
    // the faces under the footprint: on the sheet the rays meet (facing them, the skin met at their middle) and overlapping it
    const R = new Set<number>(), onSheet = (k: number) => { const f = F[k]!, m = mul(f.reduce((s, v) => add(s, P[v]!), [0, 0, 0] as V), 1 / f.length), [sm, , hm] = coordOf(c.proj, m), fn = faceNormal(P, f);
      return hm >= c.h[0] - 25 && hm <= c.h[1] + 25 && vdot(fn, dirAt(c.proj, sm)) > 0.3 * Math.hypot(...fn); };
    const cand = new Set<number>(); for (let v = 0; v < P.length; v++) if (inBox(P[v]!)) for (const k of vf[v]!) if (alive[k]) cand.add(k);
    for (const k of [...cand].sort((a, b) => a - b)) { const f = F[k]!, Q = f.map(co);
      const near = overlaps(O, Q, -2); if (!near) continue;
      // on the footprint's own sheet: within its skin's heights (not a wing's slot standing over it, not the far side) and facing out
      if (!onSheet(k)) continue;
      // a face that only comes within 2 mm of the rim is taken when it may be (no sliver is left), kept when it may not
      if (!removable(k)) { if (!overlaps(O, Q, 0.5)) continue; fail = `face ${k} ${tag[k]!.panel}/${tag[k]!.mat}`; return null; } R.add(k); }
    if (!R.size) { fail = 'no faces'; return null; }
    // the taken faces made a disc: a point the boundary passes twice widened, the faces it encloses taken too
    // and no boundary point or edge within a few mm of the rim (a sliver between them would spoil the shading): the faces
    // past them taken too, where they may be
    let B: number[] | null = null;
    for (let it = 0; it < 16 && !B; it++) { const out = new Map<number, number[]>(); for (const k of R) { const f = F[k]!; f.forEach((a, q) => { const b2 = f[(q + 1) % f.length]!, across = (edges.get(ekey(a, b2)) ?? []).filter(x => x !== k && alive[x]); if (!across.some(x => R.has(x))) (out.get(a) ?? out.set(a, []).get(a)!).push(b2); }); }
      const pinch = [...out].find(([, l]) => l.length > 1); if (pinch) { for (const k of facesAt(pinch[0])) { if (!R.has(k) && !removable(k)) { fail = 'pinch'; return null; } R.add(k); } continue; }
      const loops: number[][] = [], seen = new Set<number>(); for (const s of out.keys()) { if (seen.has(s)) continue; const L: number[] = []; let v = s; while (!seen.has(v)) { seen.add(v); L.push(v); v = out.get(v)![0]!; } loops.push(L); }
      if (loops.length === 1) { const L = loops[0]!; let more = false;
        for (let i = 0; i < L.length; i++) { const a = L[i]!, b2 = L[(i + 1) % L.length]!, [sa, ya] = co(a), [sb, yb] = co(b2);
          if (outBy(O, sa, ya) < 12) for (const k of facesAt(a)) if (!R.has(k) && removable(k) && onSheet(k)) { R.add(k); more = true; }
          if (O.some(([x, y]) => segDist(x, y, sa, ya, sb, yb) < 9)) for (const k of edges.get(ekey(a, b2))) if (!R.has(k) && removable(k) && onSheet(k)) { R.add(k); more = true; } }
        if (!more) { B = L; break; } continue; }
      const areas = loops.map(L => Math.abs(area2(L.map(co)))), outer = areas.indexOf(Math.max(...areas));
      for (let q = 0; q < loops.length; q++) { if (q === outer) continue; const L = loops[q]!, start: number[] = []; L.forEach((a, i) => { const b2 = L[(i + 1) % L.length]!; for (const x of edges.get(ekey(a, b2)) ?? []) if (alive[x] && !R.has(x)) start.push(x); });
        const fill = new Set<number>(start), stack = [...start]; while (stack.length) { const k = stack.pop()!; if (fill.size > 300) { fail = 'apart'; return null; } const f = F[k]!; f.forEach((a, i) => { for (const x of edges.get(ekey(a, f[(i + 1) % f.length]!)) ?? []) if (alive[x] && !R.has(x) && !fill.has(x)) { fill.add(x); stack.push(x); } }); }
        for (const k of fill) { if (!removable(k)) { fail = 'island'; return null; } R.add(k); } } }
    if (!B) { fail = 'loops'; return null; }
    const Bxy = B.map(co); if (Bxy.some(([s, y]) => insideO(O, s, y, 0.5))) { fail = 'boundary inside'; return null; }
    // the rim in the boundary's turning sense
    const sB = Math.sign(area2(Bxy)); let ring = c.ring, dirs = c.dirs, Oc = O.slice();
    if (Math.sign(area2(O)) !== sB) { ring = ring.slice().reverse(); dirs = dirs.slice().reverse(); Oc = Oc.reverse(); }
    const nr = ring.length, nb = B.length, Ri = ring.map(p => pt(p)), Fi = ring.map((p, i) => pt(vmadd(p, dirs[i]!, -c.depth)));
    let removed = 0; for (const k of R) { alive[k] = false; removed += F[k]!.length - 2; }
    const before = F.length, put = (f: number[], t: Tag) => { F.push(f); tag.push(t); alive.push(true); fresh.add(F.length - 1); link(F.length - 1); };
    // the zip: both rings walked round together, each boundary point at the place along the rim nearest to it (so a long
    // band's sides are walked side by side, whatever their spacing); a step that would make a folded or needle-thin
    // triangle takes the other ring's step instead
    const along = (q: P2) => { let bj = 0, bt = 0, bd = Infinity; for (let j = 0; j < Oc.length; j++) { const a = Oc[j]!, b2 = Oc[(j + 1) % Oc.length]!, dx = b2[0] - a[0], dy = b2[1] - a[1], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))), d = Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dy * t); if (d < bd) { bd = d; bj = j; bt = t; } } return bj + bt; };
    const p0 = along(Bxy[0]!), j0 = Math.floor(p0) % nr, tb: number[] = [p0 - j0]; { let prev = p0; for (let k = 1; k <= nb; k++) { const p = along(Bxy[k % nb]!); let d = p - prev; while (d < -nr / 2) d += nr; while (d > nr / 2) d -= nr; tb.push(tb[k - 1]! + d); prev = p; } }
    const across = (a: number, b2: number) => { for (const x of edges.get(ekey(a, b2)) ?? []) if (alive[x]) return tag[x]!; return null; };
    const clean = (t: Tag | null): Tag => t ? { region: t.region, mat: t.mat, panel: t.panel, ...(t.right ? { right: true } : {}), ...(t.was ? { was: t.was } : {}) } : { region: 'shell', mat: 'paint', panel: 'wingF' };
    const turn = (a: P2, b2: P2, d: P2) => ((b2[0] - a[0]) * (d[1] - a[1]) - (b2[1] - a[1]) * (d[0] - a[0])) * sB;
    /** a triangle's shape: twice its area over its longest side squared (folded: negative; a needle: near 0) */
    const shape = (a: P2, b2: P2, d: P2) => turn(a, b2, d) / Math.max(1e-9, (b2[0] - a[0]) ** 2 + (b2[1] - a[1]) ** 2, (d[0] - b2[0]) ** 2 + (d[1] - b2[1]) ** 2, (a[0] - d[0]) ** 2 + (a[1] - d[1]) ** 2);
    // each zip triangle takes the panel of the face it replaces (the taken face that had its boundary edge)
    const owner = new Map<string, number>(); for (const k of R) { const f = F[k]!; f.forEach((a, q) => owner.set(`${a}>${f[(q + 1) % f.length]!}`, k)); }
    const was = (a: number, b2: number) => { const k = owner.get(`${a}>${b2}`); return k === undefined ? null : tag[k]!; };
    let i = 0, j = 0, last: Tag = clean(was(B[0]!, B[1 % nb]!) ?? across(B[1 % nb]!, B[0]!));
    while (i < nb || j < nr) { const bi = B[i % nb]!, bn = B[(i + 1) % nb]!, rj = (j0 + j) % nr, rn = (j0 + j + 1) % nr;
      const okB = i < nb && shape(Bxy[i % nb]!, Bxy[(i + 1) % nb]!, Oc[rj]!) > 0.02, okR = j < nr && shape(Bxy[i % nb]!, Oc[rn]!, Oc[rj]!) > 0.02;
      let goB: boolean; if (i >= nb) goB = false; else if (j >= nr) goB = true; else if (okB !== okR) goB = okB;
      else goB = tb[i + 1]! <= j + 1;
      if (goB) { last = clean(was(bi, bn) ?? across(bn, bi)); put([bi, bn, Ri[rj]!], last); i++; } else { put([bi, Ri[rn]!, Ri[rj]!], last); j++; } }
    // the pocket: the wall along the rays, the floor following the skin
    const right = c.proj.F.o[1] < 0;
    for (let q = 0; q < nr; q++) { const n2 = (q + 1) % nr; put([Ri[q]!, Ri[n2]!, Fi[n2]!, Fi[q]!], { region: 'shell', mat: c.wall, panel: 'holeRim', right }); crease.add(ekey(Ri[q]!, Ri[n2]!)); crease.add(ekey(Fi[q]!, Fi[n2]!)); }
    for (const [a, b2, d] of floorTris(Oc)) put([Fi[a]!, Fi[b2]!, Fi[d]!], { region: 'shell', mat: c.floor((Oc[a]![0] + Oc[b2]![0] + Oc[d]![0]) / 3), panel: 'holeFloor', right });
    for (const v of Ri) locked.add(v);
    let tris = 0; for (let k = before; k < F.length; k++) tris += F[k]!.length - 2; return tris - removed;
    function facesAt(v: number): number[] { return vf[v]!.filter(k => alive[k]); } } }

/** how far a point lies outside a convex outline (its nearest side's line; negative inside) */
const outBy = (O: readonly P2[], x: number, y: number) => { let m = Infinity; for (let i = 0; i < O.length; i++) { const a = O[i]!, b = O[(i + 1) % O.length]!, ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1; m = Math.min(m, (ex * (y - a[1]) - ey * (x - a[0])) / l); } return -m; };
/** a point's distance to a segment */
const segDist = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - ax - dx * t, y - ay - dy * t); };
/** a face has the edge a-b (either way round) */
const hasEdge = (f: readonly number[], a: number, b: number) => { const i = f.indexOf(a); return i >= 0 && (f[(i + 1) % f.length] === b || f[(i - 1 + f.length) % f.length] === b); };
/** a face's outline (s, y) and a convex outline meeting: a corner of either inside the other, or their edges crossing */
function overlaps(O: readonly P2[], Q: readonly P2[], m: number): boolean { if (Q.some(([s, y]) => insideO(O, s, y, m))) return true; if (m > 0) O = O.map(([s, y]) => { const l = Math.hypot(s, y) || 1; return [s - s / l * m, y - y / l * m] as P2; });
  const inQ = (x: number, y: number) => { let w = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { const a = Q[i]!, b = Q[j]!; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) w = !w; } return w; };
  if (O.some(([x, y]) => inQ(x, y))) return true;
  const cross = (a: P2, b: P2, c: P2, d: P2) => { const o = (p: P2, q: P2, r: P2) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
  for (let i = 0; i < O.length; i++) for (let j = 0; j < Q.length; j++) if (cross(O[i]!, O[(i + 1) % O.length]!, Q[j]!, Q[(j + 1) % Q.length]!)) return true; return false; }

/** the drawn lines with the stretches inside the holes taken out (a line crossing a hole: its ends found on the rim) */
export function clipLines(lines: readonly MeshLine[], skin: Skin, cuts: readonly HoleCut[]): MeshLine[] { if (!cuts.length) return lines.slice();
  const boxes = cuts.map(c => { const lo: V = [Infinity, Infinity, Infinity], hi: V = [-Infinity, -Infinity, -Infinity]; for (const p of c.ring) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k]!, p[k]! - 60); hi[k] = Math.max(hi[k]!, p[k]! + 60); } return [lo, hi] as const; });
  const inside = (p: V) => cuts.some((c, i) => { const [lo, hi] = boxes[i]!; if (p.some((x, k) => x < lo[k]! || x > hi[k]!)) return false; const [s, y, h] = coordOf(c.proj, p); if (!insideO(c.O, s, y, 0)) return false;
    const r = rayAt(c.proj, s, y), hit = skin.hit(r.o, r.d, r.max); return !!hit && Math.hypot(...vsub(hit.p, p)) < 30 && Math.abs(h) < 400; });
  const edge = (a: V, b: V, aIn: boolean) => { let t0 = 0, t1 = 1; for (let k = 0; k < 14; k++) { const t = (t0 + t1) / 2, q = vmadd(a, vsub(b, a), t); if (inside(q) === aIn) t0 = t; else t1 = t; } return vmadd(a, vsub(b, a), (t0 + t1) / 2); };
  const out: MeshLine[] = [];
  for (const l of lines) { const n = l.pts.length, ins = l.pts.map(p => inside(p as V)); if (!ins.some(Boolean)) { out.push(l); continue; }
    if (ins.every(Boolean)) continue; const segs = n + (l.closed ? 0 : -1); let cur: V[] = [];
    // walk from an outside point when closed, so each piece is whole
    const s0 = l.closed ? ins.indexOf(false) : 0, pieces: V[][] = [];
    for (let q = 0; q <= segs; q++) { const ia = (s0 + q) % n, a = l.pts[ia] as V; if (q === segs) { if (!ins[ia] && cur.length) cur.push(a); break; }
      const ib = (s0 + q + 1) % n, b = l.pts[ib] as V;
      if (!ins[ia]) { cur.push(a); if (ins[ib]) { cur.push(edge(a, b, false)); pieces.push(cur); cur = []; } }
      else if (!ins[ib]) cur = [edge(a, b, true)]; }
    if (cur.length > 1) pieces.push(cur);
    for (const p of pieces) if (p.length > 1) out.push({ ...l, pts: p, closed: false }); }
  return out; }
