// The free body's skin (docs/systems/106): the control curves (curves.ts) lofted into one closed low-polygon shell
// with no base car under it. At every station a section of M + 1 points goes round the right half, from the top's
// centre down to the floor's centre, and its mirror image closes the ring:
//   j 0..6    the top: the bonnet's crown (no glasshouse) or the roof, the roof's edge, the side glass down to the crest
//             (where the top stands over the crest the glasshouse grows, so the screen and the rear glass come out of
//             the bonnet and the deck without a seam)
//   j 6..10   the crest K round the shoulder to the widest line (a super-ellipse quarter: `round` sets how square)
//   j 10..14  the widest line down and in to the sill (the tuck)
//   j 14..17  round a wheel: the arch's lip, in to the well's inner wall, down it, the floor; elsewhere the sill's
//             foot and the floor
// Round each wheel the stations fall every 15 degrees of the arch, and its lower points are lifted onto the lip, so
// the arch's edge is a true circle and the well closes the body there; at each end of an arch two stations 1 mm apart
// make its upright edge. The nose and the tail are closed by rings drawn in toward the end face's middle and a fan.
// Everything is indexed (each point made once), so the shell's closure is a fact of its index list, not of welding.
import { cross, dot, len, lerp, mix, sm, sub, un, type V } from '../kit/geom';
import { lengthOf, resolve, sOf, xOf, type Resolved, type Silhouette } from './curves';
import type { Kind } from '../mesh';

/** points in a half section (0 the top's centre, M the floor's centre); a ring has RING points */
export const M = 17, RING = 2 * M;
/** the section's landmarks: the crest, the arch's lip (the sill's foot elsewhere) */
export const JK = 6, JLIP = 14;
/** the end faces' rings: their stations (beyond 0 and 3), how far in the last one is drawn, how far the face bulges */
const FACE = [0.25, 0.5, 0.75, 1], KMIN = 0.2, BULGE = 30;

export interface Mat { name: string; colour: string; gloss: number; kind: Kind }
/** the body's colours by role */
export interface Colours { paint: string; glass: string; black: string; dark: string; under: string; trim: string; tyre: string; rim: string; seat: string }
export const COLOURS: Colours = { paint: '#c8281e', glass: '#2a3a44', black: '#1c1c1e', dark: '#262422', under: '#3a3836', trim: '#2b2b2d', tyre: '#232323', rim: '#b9bcc0', seat: '#3b302a' };

/** a section: its points (right half), how much glasshouse stands over the crest (0..1), whether it is round a wheel,
 *  which points were lifted onto the arch's lip, its station's x and the middle height the end faces close toward */
export interface Sect { pts: V[]; cap: number; arch: boolean; clamped: boolean[]; x: number; zc: number }
export interface Wheel { x: number; y: number; r: number; w: number; rim: number; front: boolean }
export interface Arch { x: number; hz: number; ra: number; yin: number }

/** the shell: points, triangles by index, each triangle's material */
export class Shell { pos: V[] = []; tri: number[] = []; tmat: number[] = []; mats: Mat[] = []; private keys = new Map<string, number>();
  mat(name: string, colour: string, gloss: number, kind: Kind = 'plain'): number { const k = `${name}|${colour}|${gloss}|${kind}`; let i = this.keys.get(k); if (i === undefined) { i = this.mats.length; this.mats.push({ name, colour, gloss, kind }); this.keys.set(k, i); } return i; }
  v(p: V): number { this.pos.push(p); return this.pos.length - 1; }
  t(a: number, b: number, c: number, m: number): void { this.tri.push(a, b, c); this.tmat.push(m); }
  /** a quad cut along its shorter diagonal */
  q(a: number, b: number, c: number, d: number, m: number): void { const P = this.pos; if (len(sub(P[a]!, P[c]!)) <= len(sub(P[b]!, P[d]!))) { this.t(a, b, c, m); this.t(a, c, d, m); } else { this.t(a, b, d, m); this.t(b, c, d, m); } }
}

export class Body {
  readonly R: Resolved; readonly L: number; readonly wheels: Wheel[]; readonly arches: Arch[];
  /** the rings' stations (the nose face's below 0, the tail face's above 3), each ring's section */
  readonly ringS: number[] = []; readonly sects: Sect[] = []; readonly shell = new Shell();
  /** the shell's cells taken out by cut-in fixtures (key i * RING + j) */
  readonly removed = new Set<number>();
  readonly noseC: number; readonly tailC: number;
  constructor(readonly sil: Silhouette, readonly col: Colours = COLOURS) {
    const ch = sil.chassis; this.R = resolve(sil); this.L = lengthOf(ch);
    const hwAt = (s: number) => Math.max(260, this.R.half(s));
    this.wheels = [1, 2].map(s => { const w = ch.tyreW, y = hwAt(s) - w / 2 - 12; return { x: xOf(ch, s), y, r: ch.r, w, rim: ch.rim, front: s === 1 }; });
    this.arches = this.wheels.map(w => ({ x: w.x, hz: w.r, ra: w.r + 48, yin: Math.max(150, w.y - w.w / 2 - 32) }));
    for (const f of [...FACE].reverse()) this.ringS.push(-f);
    for (const x of this.stationXs()) this.ringS.push(sOf(ch, x));
    for (const f of FACE) this.ringS.push(3 + f);
    for (const s of this.ringS) this.sects.push(this.ring(s));
    // the points: ring by ring, the right half then its mirror (the centre line's two points shared)
    for (const S of this.sects) for (let j = 0; j < RING; j++) { const p = S.pts[j <= M ? j : RING - j]!; this.shell.v(j <= M ? p : [p[0], -p[1], p[2]]); }
    const first = this.sects[0]!, last = this.sects[this.sects.length - 1]!;
    this.noseC = this.shell.v([first.pts[0]![0] - 4, 0, first.zc]); this.tailC = this.shell.v([last.pts[0]![0] + 4, 0, last.zc]);
  }
  get nRings(): number { return this.ringS.length; }
  vid(i: number, j: number): number { return i * RING + ((j % RING) + RING) % RING; }

  /** the stations along the car (mm): close at the nose and tail, every 15 degrees round each arch with the arch's
   *  ends doubled 1 mm apart, the landmarks, and no gap longer than 160 mm */
  private stationXs(): number[] { const L = this.L, a = this.arches, xs: number[] = [], m = this.sil.marks, ch = this.sil.chassis;
    const fill = (x0: number, x1: number, step = 160) => { const n = Math.max(1, Math.ceil((x1 - x0) / step)); for (let k = 0; k <= n; k++) xs.push(x0 + (x1 - x0) * k / n); };
    const n0 = a[0]!.x - a[0]!.ra - 0.5, t0 = a[1]!.x + a[1]!.ra + 0.5;
    let x0 = 0; for (const x of [0, 18, 50, 100, 170, 260]) if (x < n0 - 60) { xs.push(x); x0 = x; } fill(x0, n0);
    for (const A of a) { xs.push(A.x - A.ra - 0.5, A.x - A.ra + 0.5, A.x + A.ra - 0.5, A.x + A.ra + 0.5); for (let d = 15; d < 180; d += 15) xs.push(A.x - A.ra * Math.cos(d * Math.PI / 180)); }
    fill(a[0]!.x + a[0]!.ra + 0.5, a[1]!.x - a[1]!.ra - 0.5);
    let x1 = L; for (const x of [260, 170, 100, 50, 18, 0]) if (L - x > t0 + 60) { xs.push(L - x); x1 = Math.min(x1, L - x); } fill(t0, x1);
    xs.sort((p, q) => p - q); const o: number[] = []; for (const x of xs) if (!o.length || x - o[o.length - 1]! > 0.3) o.push(x);
    const inArch = (x: number) => a.some(A => Math.abs(x - A.x) < A.ra + 40);
    for (const s of [m.screen, m.roofF, m.roofB, m.glass, m.sideEnd, m.door[0], m.door[1]]) { const x = xOf(ch, s); if (x <= 30 || x >= L - 30 || inArch(x)) continue;
      const k = o.findIndex(v => v > x); if (k <= 0) continue; const lo = o[k - 1]!, hi = o[k]!; if (x - lo < 30 && hi - x < 30) continue;
      if (x - lo < 30) o[k - 1] = x; else if (hi - x < 30) o[k] = x; else o.splice(k, 0, x); }
    return o; }

  /** the section at station s in 0..3 (the curves kept to what a body can be: the floor under the crest, the top no
   *  lower than a little under the crest, widths and shares in range) */
  sect(s: number): Sect { const R = this.R, m = this.sil.marks, sc = Math.max(0, Math.min(3, s)), x = xOf(this.sil.chassis, sc);
    const zF = Math.max(60, R.floor(sc)), crest = Math.max(zF + 220, R.crest(sc)), hw = Math.max(260, R.half(sc)), top = Math.min(2200, Math.max(R.top(sc), zF + 160, crest - 220));
    const zEn = top > crest ? crest + (top - crest) * 0.92 : crest, zE = Math.max(zEn, Math.min(R.sail(sc), top + 450)), cap = sm(25, 150, Math.max(top, zE) - crest) * sm(m.screen - 0.2, m.screen, sc) * (1 - sm(m.glass + 0.12, m.glass + 0.4, sc));
    const p = Math.max(1.6, Math.min(9, R.round(sc))), tuck = Math.max(0, Math.min(0.22 * hw, R.tuck(sc)));
    const zS = Math.max(zF + 90, Math.min(crest - 40, zF + (crest - zF) * Math.max(0.12, Math.min(0.92, R.shoulder(sc)))));
    const wk = hw - Math.min(0.1 * hw, (crest - zS) * (0.12 + 0.5 / p)), wr = Math.max(0.3, Math.min(0.97, R.roof(sc))) * wk;
    // the top: the bonnet's crown and the glasshouse, mixed by how much glasshouse there is
    const ub = [0, 0.2, 0.4, 0.58, 0.74, 0.88], bon = ub.map(u => [x, u * wk, top + (crest - top) * u ** 1.7] as V), gl = (t: number): V => [x, lerp(wr, wk, t) + (wk - wr) * 0.1 * Math.sin(t * Math.PI), lerp(zE, crest, t)];
    const cabin: V[] = [[x, 0, top], [x, 0.36 * wr, top + (zE - top) * 0.12], [x, 0.7 * wr, top + (zE - top) * 0.45], [x, wr, zE], gl(0.36), gl(0.7)];
    const pts: V[] = bon.map((b, j) => mix(b, cabin[j]!, cap)); pts.push([x, wk, crest]);
    // the flank: round the shoulder to the widest line, down and in to the sill's foot
    const E: V = [x, hw - tuck, zF + 35], q = Math.max(2, p * 0.8), pw = (v: number, e: number) => Math.max(0, v) ** e;
    const shoulder = (t: number): V => { const th = t * Math.PI / 2; return [x, wk + (hw - wk) * pw(Math.sin(th), 2 / p), zS + (crest - zS) * pw(Math.cos(th), 2 / p)]; };
    const lower = (t: number): V => { const th = t * Math.PI / 2; return [x, E[1] + tuck * pw(Math.cos(th), 2 / q), zS - (zS - E[2]) * pw(Math.sin(th), 2 / q)]; };
    for (const t of [0.3, 0.6, 0.85]) pts.push(shoulder(t)); pts.push([x, hw, zS]); for (const t of [0.35, 0.65, 0.88]) pts.push(lower(t)); pts.push(E);
    const clamped = pts.map(() => false); let arch = false;
    const A = this.arches.reduce((b, c) => Math.abs(c.x - x) < Math.abs(b.x - x) ? c : b), dx = x - A.x;
    if (Math.abs(dx) < A.ra) { arch = true; const zLip = Math.min(A.hz + Math.sqrt(A.ra * A.ra - dx * dx), crest - 35);
      // the lip: where the flank's line crosses the arch's height (the flank falls all the way down, so it crosses once)
      const dense: V[] = []; for (let k = 0; k <= 16; k++) dense.push(shoulder(k / 16)); for (let k = 1; k <= 16; k++) dense.push(lower(k / 16));
      let lip: V = E; for (let k = 0; k + 1 < dense.length; k++) { const a = dense[k]!, b = dense[k + 1]!; if (a[2] >= zLip && b[2] <= zLip) { lip = mix(a, b, (a[2] - zLip) / Math.max(1e-6, a[2] - b[2])); break; } }
      for (let j = JK + 1; j <= JLIP; j++) if (pts[j]![2] < zLip || j === JLIP) { pts[j] = lip; clamped[j] = true; }
      const yin = Math.min(A.yin, lip[1] - 20); pts.push([x, yin, zLip], [x, yin, zF]);
    } else pts.push([x, E[1] - 35, zF], [x, Math.min(A.yin, 0.75 * E[1]), zF]);
    pts.push([x, 0, zF]); clamped.push(false, false, false);
    return { pts, cap, arch, clamped, x, zc: (zF + Math.max(top, crest)) / 2 }; }

  /** a ring's section at any station: the true section on the body, drawn in toward the end face's middle beyond it */
  ring(s: number): Sect { if (s >= 0 && s <= 3) return this.sect(s);
    const S = this.sect(s < 0 ? 0 : 3), f = s < 0 ? -s : s - 3, k = 1 - f * (1 - KMIN), dx = (s < 0 ? -1 : 1) * BULGE * Math.sqrt(1 - k) / Math.sqrt(1 - KMIN);
    return { ...S, arch: false, clamped: S.pts.map(() => false), pts: S.pts.map(p => [p[0] + dx, p[1] * k, S.zc + (p[2] - S.zc) * k] as V) }; }

  /** the skin's point at station s (-1..4) and share a round the right half (0 the top's centre, 1 the floor's) */
  point(s: number, a: number): V { const P = this.ring(Math.max(-1, Math.min(4, s))).pts, j = Math.max(0, Math.min(1, a)) * M, j0 = Math.min(M - 1, Math.floor(j)); return mix(P[j0]!, P[j0 + 1]!, j - j0); }
  /** the skin's outward normal there (the parameters run back and round, so their cross product points out everywhere) */
  normal(s: number, a: number): V { const h = 0.004, ha = 0.004, ds = sub(this.point(s + h, a), this.point(s - h, a)), da = sub(this.point(s, a + ha), this.point(s, a - ha)); return un(cross(ds, da)); }
  /** where the line through T along d meets the skin, from (s0, a0): Gauss-Newton on the miss across the line */
  project(T: V, d: V, s0: number, a0: number, lo = -1, hi = 4): { s: number; a: number; p: V } { let s = s0, a = a0; const dd = un(d);
    const miss = (s1: number, a1: number): V => { const r = sub(this.point(s1, a1), T); return sub(r, [dd[0] * dot(r, dd), dd[1] * dot(r, dd), dd[2] * dot(r, dd)]); };
    for (let it = 0; it < 10; it++) { const r = miss(s, a), h = 1e-3, Js = sub(miss(s + h, a), r).map(v => v / h) as V, Ja = sub(miss(s, a + h), r).map(v => v / h) as V;
      const A = dot(Js, Js) + 1e-3, B = dot(Js, Ja), C = dot(Ja, Ja) + 1e-3, g0 = dot(Js, r), g1 = dot(Ja, r), det = A * C - B * B; if (Math.abs(det) < 1e-12) break;
      const dS = -(C * g0 - B * g1) / det, dA = -(A * g1 - B * g0) / det, lim = 0.35; s = Math.max(lo, Math.min(hi, s + Math.max(-lim, Math.min(lim, dS)))); a = Math.max(0.01, Math.min(0.99, a + Math.max(-lim, Math.min(lim, dA))));
      if (Math.abs(dS) < 1e-6 && Math.abs(dA) < 1e-6) break; }
    return { s, a, p: this.point(s, a) }; }
  /** a station's x along the car */
  x(s: number): number { return xOf(this.sil.chassis, Math.max(0, Math.min(3, s))); }

  /** the cell (i, j) of the right half's material (the left's mirrors it) */
  cellMat(i: number, jr: number): number { const sh = this.shell, c = this.col, A = this.sects[i]!, B = this.sects[i + 1]!, s = (this.ringS[i]! + this.ringS[i + 1]!) / 2, m = this.sil.marks, cap = Math.min(A.cap, B.cap) > 0.5;
    const paint = sh.mat('paint', c.paint, 0.35, 'paint'), glass = sh.mat('glass', c.glass, 0.6, 'glass'), black = sh.mat('black', c.black, 0.3, 'paint'), dark = sh.mat('well', c.dark, 0.05), under = sh.mat('under', c.under, 0.05);
    const face = this.ringS[i]! < 0 || this.ringS[i + 1]! > 3;
    if (jr >= JLIP) return !face && (A.arch || B.arch) && jr < M - 1 ? dark : under;
    if (face) return paint;
    if (jr <= 2) return cap && s > m.screen && s < m.roofF ? glass : cap && s >= m.roofF && s <= m.roofB ? (this.sil.roofBlack ? black : paint) : cap && s > m.roofB && s < m.glass ? glass : paint;
    if (jr <= JK - 1) return cap && s > m.screen && s < m.sideEnd ? glass : cap && this.sil.roofBlack && s >= m.sideEnd && s < m.glass ? black : paint;
    // the arch's upright edge: the cells between its two close stations, below the lip, are the well's end wall
    if (A.arch !== B.arch) { const X = A.arch ? A : B; if (X.clamped[jr] || X.clamped[jr + 1]) return dark; }
    return paint; }

  /** the skin's cells and the end fans into the shell, but those a fixture took out */
  emitSkin(): void { const sh = this.shell, n = this.nRings;
    for (let i = 0; i + 1 < n; i++) for (let j = 0; j < RING; j++) { if (this.removed.has(i * RING + j)) continue; const jr = j < M ? j : RING - 1 - j;
      sh.q(this.vid(i, j), this.vid(i + 1, j), this.vid(i + 1, j + 1), this.vid(i, j + 1), this.cellMat(i, jr)); }
    const pf = sh.mat('paint', this.col.paint, 0.35, 'paint'), un0 = sh.mat('under', this.col.under, 0.05);
    for (let j = 0; j < RING; j++) { const jr = j < M ? j : RING - 1 - j, m = jr >= JLIP ? un0 : pf; sh.t(this.noseC, this.vid(0, j), this.vid(0, j + 1), m); sh.t(this.tailC, this.vid(n - 1, j), this.vid(n - 1, j + 1), m); } }
}

/** the shell's edges: those one triangle uses (open) and those more than two use (over-used) */
export function closure(sh: Shell): { tris: number; open: number; over: number; degenerate: number } { const E = new Map<number, number>(), N = sh.pos.length + 1; let degenerate = 0;
  for (let t = 0; t < sh.tri.length; t += 3) { const a = sh.tri[t]!, b = sh.tri[t + 1]!, c = sh.tri[t + 2]!; if (a === b || b === c || a === c) { degenerate++; continue; }
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) { const k = Math.min(u, v) * N + Math.max(u, v); E.set(k, (E.get(k) ?? 0) + 1); } }
  let open = 0, over = 0; for (const v of E.values()) { if (v === 1) open++; else if (v > 2) over++; } return { tris: sh.tri.length / 3, open, over, degenerate }; }

