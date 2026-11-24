// The free body's fixtures (docs/systems/106): a part in its own frame, placed anywhere on the skin.
// A placement is a point of the skin (station s and share a round the half section, or a point of the nose's or the
// tail's face by shares of its width and height), a scale, a turn in the surface, a depth and whether it is mirrored.
// The frame there: n the skin's outward normal, e1 along the car (across it on an end face), e2 up the surface (out
// across a top). The fixture is drawn in its frame's units (mm): (p, q) in the surface, w out of it.
//   surface-mounted  each point is laid on the skin: (p, q) projected along n onto the skin, then lifted w along the
//                    skin's normal there, so the part follows the body's curvature (rigid() places a point without
//                    bending, for what stands off the body: a wing's blade)
//   cut-in           its footprint (a closed outline in (p, q)) opens a hole: the skin's cells under it are taken out,
//                    the footprint is laid on the skin as a ring of new shell points, the band between the cells' border
//                    and the ring is zipped closed, and the fixture's plug (by default a pocket: walls sunk along the
//                    normal, a back) closes the ring, so the shell stays closed whatever the footprint or the body
// Cut-in fixtures that would reach the centre line, a wheel arch or another fixture's hole are refused (reported, not
// built): the body is never left open.
import { Build } from '../mesh';
import type { Kind } from '../mesh';
import { add, cross, dot, len, sub, un, type V } from '../kit/geom';
import { JK, JLIP, M, RING, type Body } from './body';

export interface Placement { face?: 'skin' | 'nose' | 'tail'; /** skin: station and share round the half section */ s?: number; a?: number;
  /** nose/tail face: shares of the face's half-width out from the centre and of its height up from the floor */ y?: number; z?: number;
  scale?: number; /** turn in the surface (degrees) */ rot?: number; /** a cut-in fixture's depth, as a share of its own */ depth?: number; mirror?: boolean }
export interface Frame { o: V; n: V; e1: V; e2: V; s: number; a: number }
export interface FixCtx { frame: Frame; sg: 1 | -1; scale: number; depth: number; body: Body;
  /** a point on the skin at (p, q), w out along the skin's normal there */ at(p: number, q: number, w?: number): V;
  /** a point in the frame, not bent to the skin */ rigid(p: number, q: number, w?: number): V;
  /** the skin's normal at (p, q) (this side's) */ nAt(p: number, q: number): V;
  /** a shell point at (p, q, w) and a shell triangle (for plugs) */ vtx(p: number, q: number, w?: number): number; tri(a: number, b: number, c: number, mat: number): void; mat(name: string, colour: string, gloss: number, kind?: Kind): number }
export interface CutSpec { /** the footprint (p, q), going round */ footprint: [number, number][];
  /** the plug that closes the rim (shell points of the footprint, in order); default a pocket */ plug?: (c: FixCtx, rim: number[], fp: [number, number][]) => void;
  depth?: (p: number, q: number) => number; taper?: number; wall?: [string, number, Kind?]; back?: [string, number, Kind?] }
export interface FixtureDef { id: string; name: string; source: string; category: string; kind: 'surface' | 'cut'; defaults: Placement;
  cuts?: () => CutSpec[]; parts?: (c: FixCtx, b: Build) => void; /** what spans both sides (a wing's blade): built once, from the right side's frame */ once?: (c: FixCtx, b: Build) => void }
export interface Placed extends Placement { fixture: FixtureDef }
export interface FixtureReport { id: string; ok: boolean; why?: string; frame?: Frame; cells?: number }

const X: V = [1, 0, 0], Y: V = [0, 1, 0], Z: V = [0, 0, 1];
const mirV = (p: V, sg: number): V => [p[0], p[1] * sg, p[2]];
const along = (v: V, n: V): V => { const d = dot(v, n); return un([v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d]); };

/** the frame at a skin point (right side) */
export function frameAt(body: Body, s: number, a: number, rot = 0): Frame { const o = body.point(s, a), n = body.normal(s, a);
  let e1 = Math.abs(n[0]) > 0.75 ? along(Y, n) : along(X, n), e2 = un(cross(n, e1)); if (dot(e2, [0, 0.3, 1]) < 0) e2 = [-e2[0], -e2[1], -e2[2]];
  const c = Math.cos(rot * Math.PI / 180), si = Math.sin(rot * Math.PI / 180); [e1, e2] = [add(e1.map(v => v * c) as V, e2.map(v => v * si) as V), add(e1.map(v => -v * si) as V, e2.map(v => v * c) as V)];
  return { o, n, e1, e2, s, a }; }
/** where a placement lands: a skin point directly, a face's point by projection onto the face */
export function locate(body: Body, pl: Placement): { s: number; a: number } { if ((pl.face ?? 'skin') === 'skin') return { s: pl.s ?? 1.5, a: pl.a ?? 0.4 };
  const tail = pl.face === 'tail', S = body.sect(tail ? 3 : 0), zF = S.pts[M]![2], zT = Math.max(S.pts[0]![2], S.pts[JK]![2]), hw = Math.max(...S.pts.map(p => p[1]));
  const T: V = [tail ? body.L + 200 : -200, (pl.y ?? 0.5) * hw, zF + (pl.z ?? 0.5) * (zT - zF)], d: V = [1, 0, 0], lo = tail ? 2.6 : -1, hi = tail ? 4 : 0.4;
  let best = { s: tail ? 3.3 : -0.3, a: 0.3, e: Infinity }; for (let s = lo; s <= hi + 1e-9; s += 0.1) for (let a = 0.02; a < 1; a += 0.04) { const p = body.point(s, a), n = body.normal(s, a);
    if (n[0] * (tail ? 1 : -1) < 0.3) continue; const e = Math.hypot(p[1] - T[1], p[2] - T[2]); if (e < best.e) best = { s, a, e }; }
  const r = body.project(T, d, best.s, best.a, lo, hi); return { s: r.s, a: r.a }; }

/** a fixture's context on side sg */
function context(body: Body, f: Frame, sg: 1 | -1, scale: number, depth: number, rot0: [number, number] = [0, 0]): FixCtx { const sh = body.shell, cache = new Map<string, { p: V; n: V }>();
  const surf = (P: number, Q: number) => { const k = `${P.toFixed(2)},${Q.toFixed(2)}`; let r = cache.get(k); if (r) return r;
    const T = add(add(f.o, f.e1.map(v => v * P) as V), add(f.e2.map(v => v * Q) as V, f.n.map(v => v * 300) as V)), j = body.project(T, f.n, f.s, f.a);
    r = { p: j.p, n: body.normal(j.s, j.a) }; cache.set(k, r); return r; };
  const at = (p: number, q: number, w = 0): V => { const r = surf(p * scale + rot0[0], q * scale + rot0[1]); return mirV(add(r.p, r.n.map(v => v * w * scale) as V), sg); };
  return { frame: f, sg, scale, depth, body, at, nAt: (p, q) => mirV(surf(p * scale + rot0[0], q * scale + rot0[1]).n, sg),
    rigid: (p, q, w = 0) => mirV(add(f.o, add(add(f.e1.map(v => v * (p * scale + rot0[0])) as V, f.e2.map(v => v * (q * scale + rot0[1])) as V), f.n.map(v => v * w * scale) as V)), sg),
    vtx: (p, q, w = 0) => sh.v(at(p, q, w)), tri: (a, b, c, m) => sh.t(a, b, c, m), mat: (n, c, g, k = 'plain') => sh.mat(n, c, g, k) }; }

// ---- 2D helpers (the frame's plane) ----
type P2 = [number, number];
const inPoly = (p: P2, poly: P2[]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const segDist = (p: P2, a: P2, b: P2) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0; return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t); };
const polyDist = (p: P2, poly: P2[]) => { let d = Infinity; for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i]!, poly[(i + 1) % poly.length]!)); return d; };
const inTri = (p: P2, a: P2, b: P2, c: P2) => { const s = (u: P2, v: P2, w: P2) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]), d1 = s(a, b, p), d2 = s(b, c, p), d3 = s(c, a, p); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };

/** the band between a border ring and a hole's ring inside it (both going round the hole's middle, any number of
 *  points), zipped: a step is allowed only if its new edge clears the hole; of two allowed steps the shorter wins
 *  (the kit's porthole, render/car/kit/emit.ts, in the frame's plane, by index) */
export function zip(outer: number[], O2: P2[], inner: number[], I2: P2[], tri: (a: number, b: number, c: number) => void): void {
  const c: P2 = [I2.reduce((s, p) => s + p[0], 0) / I2.length, I2.reduce((s, p) => s + p[1], 0) / I2.length], ang = (p: P2) => Math.atan2(p[1] - c[1], p[0] - c[0]);
  const turn = (ids: number[], R: P2[]) => { const a = R.map(ang); let k = 0; for (let i = 1; i < R.length; i++) if (a[i]! < a[k]!) k = i;
    const rise = ((a[(k + 1) % R.length]! - a[k]! + 4 * Math.PI) % (2 * Math.PI)) < Math.PI, ord = R.map((_, i) => (k + (rise ? i : R.length - i)) % R.length); return { id: ord.map(i => ids[i]!), P: ord.map(i => R[i]!) }; };
  const Oo = turn(outer, O2), Ii = turn(inner, I2), no = Oo.P.length, ni = Ii.P.length, d = (p: P2, q: P2) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const sees = (o: P2, h: P2) => (o[0] - h[0]) * (h[0] - c[0]) + (o[1] - h[1]) * (h[1] - c[1]) >= 0; let i = 0, j = 0;
  while (i < no || j < ni) { const o0 = Oo.P[i % no]!, o1 = Oo.P[(i + 1) % no]!, i0 = Ii.P[j % ni]!, i1 = Ii.P[(j + 1) % ni]!, okO = i < no && sees(o1, i0), okI = j < ni && sees(o0, i1);
    const stepO = j >= ni || (i < no && (okO && okI ? d(o1, i0) <= d(o0, i1) : okO || !okI));
    if (stepO) { tri(Oo.id[i % no]!, Oo.id[(i + 1) % no]!, Ii.id[j % ni]!); i++; } else { tri(Oo.id[i % no]!, Ii.id[(j + 1) % ni]!, Ii.id[j % ni]!); j++; } } }

/** the right half's cells a footprint (in the frame's plane, mm) takes, and their border in order; null if it would
 *  reach the centre line, the floor, a wheel arch or a hole already cut */
function cellsUnder(body: Body, f: Frame, fp: P2[], grow = 1): { cells: [number, number][]; loop: [number, number][]; chart: (i: number, j: number) => P2 } | { why: string } {
  const P = body.shell.pos, n = body.nRings, cen: P2 = [fp.reduce((s, p) => s + p[0], 0) / fp.length, fp.reduce((s, p) => s + p[1], 0) / fp.length], rmax = Math.max(...fp.map(p => Math.hypot(p[0] - cen[0], p[1] - cen[1])));
  const ch = new Map<number, { c: P2; h: number }>(), chart = (i: number, j: number): P2 => vc(i, j).c, vc = (i: number, j: number) => { const k = i * RING + j; let r = ch.get(k); if (!r) { const d = sub(P[body.vid(i, j)]!, f.o); r = { c: [dot(d, f.e1), dot(d, f.e2)], h: dot(d, f.n) }; ch.set(k, r); } return r; };
  const near = (i: number, j: number) => { const v = vc(i, j); return Math.abs(v.h) < rmax * 0.4 + 70 && Math.hypot(v.c[0] - cen[0], v.c[1] - cen[1]) < rmax * 2.5 + 300; };
  // the cells' size round the footprint, for the margin kept between the footprint and the cells' border
  let el = 0, ne = 0; for (let i = 0; i + 1 < n; i++) for (let j = 1; j < JLIP; j++) if (near(i, j) && near(i + 1, j)) { const a = vc(i, j).c, b = vc(i + 1, j).c, c = vc(i, j + 1).c; el += Math.hypot(a[0] - b[0], a[1] - b[1]) + Math.hypot(a[0] - c[0], a[1] - c[1]); ne += 2; }
  const margin = Math.max(14, 0.3 * (ne ? el / ne : 100)) * grow;
  const take = new Set<number>(), key = (i: number, j: number) => i * RING + j;
  for (let i = 0; i < n; i++) for (let j = 0; j <= M; j++) { if (!near(i, j)) continue; const v = vc(i, j).c; if (!(inPoly(v, fp) || polyDist(v, fp) < margin)) continue;
    for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1]] as const) { const ci = i + di, cj = j + dj; if (ci >= 0 && ci + 1 < n && cj >= 0 && cj < M) take.add(key(ci, cj)); } }
  const quad = (i: number, j: number): P2[] => [chart(i, j), chart(i + 1, j), chart(i + 1, j + 1), chart(i, j + 1)], inCell = (p: P2, i: number, j: number) => { const q = quad(i, j); return inTri(p, q[0]!, q[1]!, q[2]!) || inTri(p, q[0]!, q[2]!, q[3]!); };
  for (const p of [...fp, cen]) for (let i = 0; i + 1 < n; i++) for (let j = 0; j < M; j++) if (near(i, j) && near(i + 1, j + 1) && inCell(p, i, j)) take.add(key(i, j));
  if (!take.size) return { why: '발자국 아래에 차체 면이 없음' };
  // close islands: cells left inside the taken ones are taken too
  let i0 = n, i1 = 0, j0 = M, j1 = 0; for (const k of take) { const i = Math.floor(k / RING), j = k % RING; i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
  const seen = new Set<number>(), st: [number, number][] = []; for (let i = i0 - 1; i <= i1 + 1; i++) for (let j = j0 - 1; j <= j1 + 1; j++) if (i === i0 - 1 || i === i1 + 1 || j === j0 - 1 || j === j1 + 1) st.push([i, j]);
  while (st.length) { const [i, j] = st.pop()!; if (i < i0 - 1 || i > i1 + 1 || j < j0 - 1 || j > j1 + 1) continue; const k = key(i, j); if (seen.has(k) || take.has(k)) continue; seen.add(k); st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]); }
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (!seen.has(key(i, j))) take.add(key(i, j));
  const cells: [number, number][] = [...take].sort((a, b) => a - b).map(k => [Math.floor(k / RING), k % RING]);
  for (const [i, j] of cells) { if (j < 1 || j >= JLIP - 1) return { why: '가운데 선이나 바닥에 닿음' }; const A = body.sects[i]!, B = body.sects[i + 1]!;
    if (A.clamped[j] || A.clamped[j + 1] || B.clamped[j] || B.clamped[j + 1] || ((A.arch || B.arch) && j >= JLIP - 3)) return { why: '바퀴 아치에 닿음' };
    if (body.removed.has(key(i, j)) || body.removed.has(key(i, RING - 1 - j))) return { why: '다른 부품의 구멍과 겹침' }; }
  // the border: the taken cells' edges no other taken cell shares, chained round
  const vk = (i: number, j: number) => i * (RING + 1) + j, E = new Map<string, [[number, number], [number, number]]>();
  for (const [i, j] of cells) { const c: [number, number][] = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
    for (let e = 0; e < 4; e++) { const a = c[e]!, b = c[(e + 1) % 4]!, back = `${vk(...b)}>${vk(...a)}`; if (E.has(back)) E.delete(back); else E.set(`${vk(...a)}>${vk(...b)}`, [a, b]); } }
  const next = new Map<number, [number, number]>(); for (const [a, b] of E.values()) { if (next.has(vk(...a))) return { why: '구멍의 테두리가 갈라짐' }; next.set(vk(...a), b); }
  const start = next.keys().next().value as number, loop: [number, number][] = []; let k = start;
  for (let g = 0; g <= next.size; g++) { const b = next.get(k); if (!b) return { why: '구멍의 테두리가 닫히지 않음' }; loop.push(b); k = vk(...b); if (k === start) break; }
  if (loop.length !== next.size) return { why: '구멍이 여러 개로 갈라짐' };
  const L2 = loop.map(([i, j]) => chart(i, j)); for (const p of fp) if (!inPoly(p, L2) || polyDist(p, L2) < 1.5) return { why: '발자국이 테두리에 너무 가까움' };
  return { cells, loop, chart }; }

/** place a fixture on the body: cut its holes (before the skin is laid), keep its parts to build after */
export function placeFixture(body: Body, pl: Placed, parts: ((b: Build) => void)[]): FixtureReport { const d = pl.fixture, loc = locate(body, { ...d.defaults, ...pl }), rot = pl.rot ?? d.defaults.rot ?? 0;
  const f = frameAt(body, loc.s, loc.a, rot), scale = pl.scale ?? d.defaults.scale ?? 1, depth = pl.depth ?? d.defaults.depth ?? 1, sides: (1 | -1)[] = (pl.mirror ?? d.defaults.mirror ?? true) ? [1, -1] : [1];
  const rep: FixtureReport = { id: d.id, ok: true, frame: f, cells: 0 };
  if (d.kind === 'cut' && d.cuts) { const specs = d.cuts(), plans: { spec: CutSpec; fp: P2[]; under: Exclude<ReturnType<typeof cellsUnder>, { why: string }> }[] = [];
    for (const spec of specs) { const fp = spec.footprint.map(([p, q]) => [p * scale, q * scale] as P2); let u = cellsUnder(body, f, fp);
      // a footprint that ends up too near the cells' border takes a wider ring of cells
      for (const g of [1.8, 2.8]) if ('why' in u && u.why.includes('테두리')) u = cellsUnder(body, f, fp, g); if ('why' in u) return { ...rep, ok: false, why: u.why }; plans.push({ spec, fp, under: u }); }
    // a hole lies in one material (a cut across the glass's edge would leave the zipped band half glass)
    for (const pn of plans) if (new Set(pn.under.cells.map(([i, j]) => body.cellMat(i, j))).size > 1) return { ...rep, ok: false, why: '유리와 차체의 경계에 걸침' };
    // two cuts of one fixture must not share cells either
    const all = new Set<number>(); for (const pn of plans) for (const [i, j] of pn.under.cells) { const k = i * RING + j; if (all.has(k)) return { ...rep, ok: false, why: '부품의 구멍끼리 겹침' }; all.add(k); }
    for (const { spec, fp, under } of plans) for (const sg of sides) { const c = context(body, f, sg, scale, depth), mj = (j: number) => sg > 0 ? j : (RING - j) % RING;
      for (const [i, j] of under.cells) body.removed.add(i * RING + (sg > 0 ? j : RING - 1 - j));
      const rim = spec.footprint.map(([p, q]) => c.vtx(p, q)), mid = under.cells[Math.floor(under.cells.length / 2)]!, skinMat = body.cellMat(mid[0], mid[1]);
      zip(under.loop.map(([i, j]) => body.vid(i, mj(j))), under.loop.map(([i, j]) => under.chart(i, j)), rim, fp, (a, b2, c2) => body.shell.t(a, b2, c2, skinMat));
      (spec.plug ?? pocket(spec))(c, rim, spec.footprint); rep.cells! += under.cells.length; } }
  for (const sg of sides) { const c = context(body, f, sg, scale, depth); if (d.parts) parts.push(b => d.parts!(c, b)); }
  if (d.once) { const c = context(body, f, 1, scale, depth); parts.push(b => d.once!(c, b)); }
  return rep; }

/** the default plug: walls sunk from the rim along the skin's normal (drawn in by `taper`), a flat back */
export function pocket(spec: CutSpec): (c: FixCtx, rim: number[], fp: [number, number][]) => void { return (c, rim, fp) => {
  const dep = (p: number, q: number) => (spec.depth ? spec.depth(p, q) : 60) * c.depth, t = spec.taper ?? 0.06, cp = fp.reduce((s, p) => s + p[0], 0) / fp.length, cq = fp.reduce((s, p) => s + p[1], 0) / fp.length;
  const wm = c.mat('pocketWall', spec.wall?.[0] ?? '#161616', spec.wall?.[1] ?? 0.05, spec.wall?.[2] ?? 'plain'), bm = c.mat('pocketBack', spec.back?.[0] ?? '#222222', spec.back?.[1] ?? 0.05, spec.back?.[2] ?? 'plain');
  const inner = fp.map(([p, q]) => c.vtx(cp + (p - cp) * (1 - t), cq + (q - cq) * (1 - t), -dep(p, q)));
  for (let k = 0; k < rim.length; k++) { const k1 = (k + 1) % rim.length; c.tri(rim[k]!, rim[k1]!, inner[k1]!, wm); c.tri(rim[k]!, inner[k1]!, inner[k]!, wm); }
  const mid = c.vtx(cp, cq, -dep(cp, cq)); for (let k = 0; k < inner.length; k++) c.tri(mid, inner[k]!, inner[(k + 1) % inner.length]!, bm); }; }

/** a rounded outline through corners (p, q), r the corners' radius, n points per corner */
export function rounded(corners: P2[], r: number, n = 4): P2[] { const o: P2[] = [];
  for (let k = 0; k < corners.length; k++) { const a = corners[(k + corners.length - 1) % corners.length]!, b = corners[k]!, c = corners[(k + 1) % corners.length]!;
    const da = Math.hypot(a[0] - b[0], a[1] - b[1]), dc = Math.hypot(c[0] - b[0], c[1] - b[1]), rr = Math.min(r, da * 0.45, dc * 0.45), A: P2 = [b[0] + (a[0] - b[0]) * rr / da, b[1] + (a[1] - b[1]) * rr / da], C: P2 = [b[0] + (c[0] - b[0]) * rr / dc, b[1] + (c[1] - b[1]) * rr / dc];
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * A[0] + 2 * u * t * b[0] + t * t * C[0], u * u * A[1] + 2 * u * t * b[1] + t * t * C[1]]); } }
  return o; }
/** a circle's outline */
export const circle = (cx: number, cy: number, r: number, n = 18): P2[] => Array.from({ length: n }, (_, k) => [cx + Math.cos(k / n * Math.PI * 2) * r, cy + Math.sin(k / n * Math.PI * 2) * r]);

