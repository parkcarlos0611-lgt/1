// The track's edge as a real circuit lays it (docs/systems/111 section 8): beyond the concrete, in order, the kerbs
// (corners only), a painted band of run-off, a strip of grass or, on a corner's outside, a sand and gravel trap (wider
// the faster the corner is met), the barrier (a concrete wall or a steel guardrail), a wall of stacked tyres before it
// where a car would strike it at an angle (a corner's outside, a trap's far end), the tall catch fence, then the woods.
// On a banking's outer top only a low wall and the fence (the earth bank falls away behind); its run-off is inside.
// Worked out from the track's curvature and a rough speed profile; each side sampled every `step` m. Everything else
// round the track is gone (T1): cleanScenery keeps the woods and drops the rest from the data (the old plans' code stays).
import type { Track } from './track';
import type { Placed, Scenery, Tree } from './scenery';

export type Barrier = 'wall' | 'rail';
/** one side at one sample: offsets are distances from the centre line (m, always positive) */
export interface EdgeSample { kerb: number; paint: number; trap: 'grass' | 'gravel'; trapOut: number; barrier: Barrier; barrierOff: number; tyres: boolean; fenceOff: number; banked: boolean }
export interface EdgeLayout { step: number; n: number; /** [left (+off), right (-off)] */ sides: [EdgeSample[], EdgeSample[]] }
/** the heights of the edge's things (m) */
export const EDGE_H = { wall: 1.0, rail: 0.75, tyres: 0.9, fence: 3.6 } as const;
/** a stack of tyres's depth before the barrier (m) */
export const TYRE_D = 0.7;

/** a rough speed profile (m/s) of a quick car: the corners' grip, braking and pulling away (the run-off's width needs only the order of it) */
export function speedProfile(T: Track, vTop = 80, muG = 1.1 * 9.81, brake = 9, accel = 4): Float32Array { const L = Math.round(T.length), v = new Float32Array(L);
  for (let s = 0; s < L; s++) { const k = Math.abs(T.at(s).k); v[s] = k > 1e-6 ? Math.min(vTop, Math.sqrt(muG / k)) : vTop; }
  for (let pass = 0; pass < 2; pass++) { for (let s = 1; s < 2 * L; s++) { const a = (s - 1) % L, b = s % L; v[b] = Math.min(v[b]!, Math.sqrt(v[a]! ** 2 + 2 * accel)); }
    for (let s = 2 * L - 2; s >= 0; s--) { const a = (s + 1) % L, b = s % L; v[b] = Math.min(v[b]!, Math.sqrt(v[a]! ** 2 + 2 * brake)); } }
  return v; }

/** the centre line's points in a grid, for "how near is any stretch of the road" (every 3 m) */
export function roadGrid(T: Track, cell = 30) { const g = new Map<string, number[]>(), L = Math.round(T.length);
  for (let s = 0; s < L; s += 3) { const n = T.nodes[s]!, k = `${Math.floor(n.x / cell)},${Math.floor(n.y / cell)}`; (g.get(k) ?? g.set(k, []).get(k)!).push(s); }
  /** the nearest centre-line point to (x, y) within a cell and a half: its distance and distance along */
  return (x: number, y: number): { d: number; s: number } => { let d = Infinity, best = 0; const i = Math.floor(x / cell), j = Math.floor(y / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const s of g.get(`${i + a},${j + b}`) ?? []) { const n = T.nodes[s]!, q = (n.x - x) ** 2 + (n.y - y) ** 2; if (q < d) { d = q; best = s; } }
    return { d: Math.sqrt(d), s: best }; }; }

export function edgeLayout(T: Track, step = 2): EdgeLayout { const W2 = T.spec.width / 2, L = Math.round(T.length), n = Math.ceil(L / step), v = speedProfile(T), near = roadGrid(T);
  const at = (s: number) => ((Math.round(s) % L) + L) % L;
  // the speed a car may leave the road at here: the most over the last 150 m (a car braking late runs off at its approach speed)
  const lead = (s: number) => { let m = 0; for (let d = 0; d <= 150; d += 5) m = Math.max(m, v[at(s - d)]!); return m; };
  const sides: [EdgeSample[], EdgeSample[]] = [[], []];
  for (const [si, side] of [[0, 1], [1, -1]] as const) { const raw: number[] = [], ext: boolean[] = [], room: number[] = [];
    for (let i = 0; i < n; i++) { const s = i * step, k = T.at(s).k, corner = Math.abs(k) > 1 / 700, outside = corner && Math.sign(k) !== side;
      ext.push(outside); const vl = lead(s); raw.push(outside ? Math.max(6, Math.min(40, vl * vl * 0.007)) : 3);
      // the room on this side before another stretch of the road (or the bend's own middle) comes nearer than this one
      let r = W2 + 60; for (let o = W2 + 2; o <= W2 + 60; o += 3) { const p = T.point(s, side * o), q = near(p.x, p.y); if (q.d < o - 1.5) { r = o - 3; break; } } room.push(r); }
    // the traps' width held over a corner and eased in and out (a widest-over-40 m, then averaged over 30 m)
    const wide = raw.map((_, i) => { let m = 0; for (let d = -Math.round(40 / step); d <= Math.round(40 / step); d++) m = Math.max(m, ext[(i + d + n) % n] ? raw[(i + d + n) % n]! : 0); return m; });
    const smooth = wide.map((_, i) => { let a = 0, c = 0; for (let d = -Math.round(15 / step); d <= Math.round(15 / step); d++) { a += wide[(i + d + n) % n]!; c++; } return a / c; });
    for (let i = 0; i < n; i++) { const s = i * step, bk = T.bankAt(s), banked = !!bk.b && bk.f > 0.05 && side === T.outerSide(s);
      if (banked) { sides[si].push({ kerb: W2, paint: W2, trap: 'grass', trapOut: W2, barrier: 'wall', barrierOff: W2 + 0.4, tyres: false, fenceOff: W2 + 0.9, banked }); continue; }
      const k = T.at(s).k, kerb = Math.abs(k) > 1 / 400 ? W2 + 1 : W2, paint = kerb + (Math.abs(k) > 1 / 700 ? 2 : 2.5), gravel = smooth[i]! > 5.5, trapW = gravel ? smooth[i]! : 3;
      const tyres = gravel && smooth[i]! > 8, fenceGap = tyres ? 1.2 : 1.0, maxBar = room[i]! - fenceGap - 1, barrierOff = Math.max(paint + 1, Math.min(paint + trapW, maxBar));
      sides[si].push({ kerb, paint, trap: gravel ? 'gravel' : 'grass', trapOut: barrierOff - (tyres ? TYRE_D : 0) - 0.3, barrier: gravel || Math.abs(k) > 1 / 700 ? 'wall' : 'rail', barrierOff, tyres, fenceOff: barrierOff + fenceGap, banked }); } }
  return { step, n, sides }; }

/** the edge sample on a side at s (side: the sign of the offset) */
export function edgeAt(E: EdgeLayout, s: number, side: number): EdgeSample { const L = E.n * E.step, i = Math.floor((((s % L) + L) % L) / E.step) % E.n; return E.sides[side >= 0 ? 0 : 1][i]!; }

/** the placings of the edge's things (the live renderer's still meshes, render/props/trackside.ts): each a piece of
 *  barrier, tyres or fence along a side, `arg` its length (mm), at most ~12 m (less in a tight bend) */
export function edgePieces(T: Track, E: EdgeLayout): Placed[] { const out: Placed[] = [], L = E.n * E.step, W2 = T.spec.width / 2;
  const zOf = (s: number, o: number, banked: boolean) => banked ? T.height(s, o > 0 ? W2 : -W2) : T.ground(s, o);
  for (const [si, side] of [[0, 1], [1, -1]] as const) { const S = E.sides[si];
    const run = (kind: string, off: (e: EdgeSample) => number | null) => { let i = 0;
      while (i < E.n) { const e = S[i]!, o0 = off(e); if (o0 === null) { i++; continue; }
        // a piece: as long as the kind holds and the offset stays near, up to 12 m (a bend's chord within ~5 cm)
        const k = Math.abs(T.at(i * E.step).k), maxLen = Math.max(E.step, Math.min(12, Math.sqrt(0.4 / Math.max(1e-6, k / Math.max(0.2, 1 - k * o0))))); let j = i + 1;
        while (j < E.n && (j - i) * E.step < maxLen) { const oj = off(S[j]!); if (oj === null || Math.abs(oj - o0) > 0.3) break; j++; }
        const s0 = i * E.step, s1 = Math.min(L, j * E.step), o1 = off(S[Math.min(j, E.n - 1)]!) ?? o0, a = T.point(s0, side * o0), b = T.point(s1, side * (j < E.n ? o1 : o0));
        const len = Math.hypot(b.x - a.x, b.y - a.y); if (len > 0.2) out.push({ kind, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: zOf((s0 + s1) / 2, side * o0, e.banked), heading: Math.atan2(a.y - b.y, a.x - b.x), arg: Math.round(len * 1000) });
        i = j; } };
    run('edgeWall', e => e.barrier === 'wall' ? e.barrierOff + 0.2 : null); run('edgeRail', e => e.barrier === 'rail' ? e.barrierOff + 0.1 : null);
    run('edgeTyres', e => e.tyres ? e.barrierOff - TYRE_D / 2 : null); run('edgeFence', e => e.fenceOff); }
  return out; }

/** the tree kinds of the old props (the woods' kinds: 0 round-headed, 1 pine, 2 poplar, 3 bush) */
const TREE_KIND: Record<string, number> = { treeRound: 0, treePine: 1, treePoplar: 2, bush: 3 };
/** T1: a track's surroundings cleared to the woods alone, and the real circuit's edge laid round it. The props, the
 *  site plan's small things, the lines (railway, river, roads) and the ground's patches are left out; the old props'
 *  trees join the woods; every tree standing where the edge is (up to 2.5 m behind the fence) is taken out */
export function cleanScenery(T: Track, old: Scenery, step = 2): Scenery { const E = edgeLayout(T, step), near = roadGrid(T), W2 = T.spec.width / 2;
  let r = 777; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const trees: Tree[] = [...(old.trees ?? []), ...old.props.filter(p => p.kind in TREE_KIND).map(p => ({ x: p.x, y: p.y, z: p.z ?? -0.03, kind: TREE_KIND[p.kind]!, size: 1, heading: p.heading, rank: rnd() * 0.6 }))];
  const keep = trees.filter(t => { const q = near(t.x, t.y); if (q.d > W2 + 80) return true; const n = T.nodes[q.s]!, side = Math.sign(-(t.x - n.x) * Math.sin(n.h) + (t.y - n.y) * Math.cos(n.h)) || 1;
    return q.d > edgeAt(E, q.s, side).fenceOff + 2.5; });
  return { props: [], lines: [], areas: [], railway: [], trees: keep, detail: edgePieces(T, E), edge: E }; }
