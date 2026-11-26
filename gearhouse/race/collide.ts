// What a car strikes beside the track (docs/systems/111 T3), and what it runs on off the concrete. The edge's barriers
// (race/trackside.ts) as one-sided segments facing the road, the catch fence behind them, the woods' trunks as
// upright cylinders that never move or break; all in a grid of 20 m cells, so a car looks only at what is near it.
// The car is its body's box seen from above; the check runs each physics sub-step (1 ms: under 10 cm at 360 km/h, far
// less than any barrier's or trunk's depth, and a segment is one-sided, so a car cannot pass through between steps).
// A contact pushes the car out and takes an impulse (restitution and sliding friction by the material) and records a
// blow for the damage (race/damage.ts through Vehicle.blow). Off the road: painted run-off grips nearly as the
// concrete, grass much less, a gravel trap least of all, with a heavy drag that stops a car within its width.
import type { Track } from './track';
import type { Vehicle, V3 } from './vehicle';
import type { Scenery, Tree } from './scenery';
import { DENSITY_SHARE, sceneryDensity } from './scenery';
import { EDGE_H, TYRE_D, edgeAt, type EdgeLayout } from './trackside';

export type Material = 'wall' | 'rail' | 'tyres' | 'fence' | 'tree';
/** restitution, sliding friction, the share of the blow's energy that dents the car */
export const MATERIAL: Record<Material, { e: number; mu: number; dmg: number }> = {
  wall: { e: 0.3, mu: 0.3, dmg: 1 }, rail: { e: 0.35, mu: 0.25, dmg: 0.8 }, tyres: { e: 0.08, mu: 0.6, dmg: 0.25 }, fence: { e: 0.15, mu: 0.5, dmg: 0.6 }, tree: { e: 0.3, mu: 0.4, dmg: 1.2 } };
/** a barrier's face: from a to b, its normal toward the road, its foot and height */
export interface Seg { a: [number, number]; b: [number, number]; n: [number, number]; len: number; z: number; h: number; mat: Material }
export interface Trunk { x: number; y: number; z: number; r: number; rank: number }
/** a surface's grip (times the tyre's), rolling resistance, and its drag (N per N of load, at speed) */
export interface Surface { mu: number; crr: number; drag: number; kind: 'paint' | 'kerb' | 'grass' | 'gravel' }
export const SURFACE: Record<Surface['kind'], Surface> = { kerb: { mu: 0.95, crr: 0.02, drag: 0, kind: 'kerb' }, paint: { mu: 0.92, crr: 0.02, drag: 0, kind: 'paint' },
  grass: { mu: 0.55, crr: 0.07, drag: 0, kind: 'grass' }, gravel: { mu: 0.4, crr: 0.25, drag: 0.55, kind: 'gravel' } };

/** an impact as the page hears it (sound, shake) */
export interface Impact { E: number; mat: Material; at: V3 }
const CELL = 20;
export class Collider {
  private grid = new Map<string, (Seg | Trunk)[]>(); private cache = new WeakMap<Vehicle, { x: number; y: number; near: (Seg | Trunk)[] }>();
  /** told of each blow (the page's crash sound) */ onHit: ((v: Vehicle, h: Impact) => void) | null = null;
  readonly segs: Seg[] = []; readonly trunks: Trunk[] = [];
  constructor(readonly track: Track, readonly edge: EdgeLayout | null, trees: Tree[] = []) {
    if (edge) this.segsOf(edge);
    for (const t of trees) if (t.kind !== 3) this.trunks.push({ x: t.x, y: t.y, z: t.z, r: 0.28 * t.size, rank: t.rank });   // the bushes give way
    for (const o of [...this.segs, ...this.trunks]) { const [x0, y0, x1, y1] = 'a' in o ? [Math.min(o.a[0], o.b[0]), Math.min(o.a[1], o.b[1]), Math.max(o.a[0], o.b[0]), Math.max(o.a[1], o.b[1])] : [o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r];
      for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++) { const k = `${i},${j}`; (this.grid.get(k) ?? this.grid.set(k, []).get(k)!).push(o); } } }
  static of(T: Track, S: Scenery): Collider { return new Collider(T, S.edge ?? null, S.trees ?? []); }
  private segsOf(E: EdgeLayout) { const T = this.track, W2 = T.spec.width / 2;
    for (const [si, side] of [[0, 1], [1, -1]] as const) for (let i = 0; i < E.n; i++) { const e = E.sides[si][i]!, f = E.sides[si][(i + 1) % E.n]!, s0 = i * E.step, s1 = (i + 1) * E.step;
      const add = (o0: number, o1: number, h: number, mat: Material) => { const p = T.point(s0, side * o0), q = T.point(s1, side * o1), dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy); if (len < 1e-3) return;
        // the normal toward the road: the left of the run on the right side, its right on the left side
        const n: [number, number] = side > 0 ? [dy / len, -dx / len] : [-dy / len, dx / len], z = e.banked ? T.height(s0, side * W2) : T.ground(s0, side * o0);
        this.segs.push({ a: [p.x, p.y], b: [q.x, q.y], n, len, z, h, mat }); };
      const front = (x: typeof e) => x.barrierOff - (x.tyres ? TYRE_D : 0);
      add(front(e), front(f), e.tyres ? EDGE_H.tyres : EDGE_H[e.barrier], e.tyres ? 'tyres' : e.barrier);
      add(e.fenceOff, f.fenceOff, EDGE_H.fence, 'fence'); } }
  /** what is near the car: looked up again once it has moved 3 m from where it was looked up */
  private nearOf(v: Vehicle): (Seg | Trunk)[] { const c = this.cache.get(v); if (c && Math.hypot(v.p[0] - c.x, v.p[1] - c.y) < 3) return c.near;
    const R = v.box.hl + 4, set = new Set<Seg | Trunk>(); for (let i = Math.floor((v.p[0] - R) / CELL); i <= Math.floor((v.p[0] + R) / CELL); i++) for (let j = Math.floor((v.p[1] - R) / CELL); j <= Math.floor((v.p[1] + R) / CELL); j++) for (const o of this.grid.get(`${i},${j}`) ?? []) set.add(o);
    const near = [...set]; this.cache.set(v, { x: v.p[0], y: v.p[1], near }); return near; }
  /** one sub-step's contacts for a car (Vehicle.contact calls it) */
  step(v: Vehicle): void { const near = this.nearOf(v); if (!near.length) return; const share = DENSITY_SHARE[sceneryDensity()], b = v.box, yaw = v.yaw, c = Math.cos(yaw), s = Math.sin(yaw), bottom = v.p[2] - b.bottom;
    const corners: [number, number][] = [[b.hl, b.hw], [b.hl, -b.hw], [-b.hl, b.hw], [-b.hl, -b.hw], [b.hl, 0], [-b.hl, 0]].map(([x, y]) => [v.p[0] + c * x! - s * y!, v.p[1] + s * x! + c * y!]);
    for (const o of near) {
      if ('a' in o) { if (bottom > o.z + o.h) continue;   // flying over it
        const ux = (o.b[0] - o.a[0]) / o.len, uy = (o.b[1] - o.a[1]) / o.len, dc = (v.p[0] - o.a[0]) * o.n[0] + (v.p[1] - o.a[1]) * o.n[1]; if (dc < -0.3) continue;   // the car's middle behind it: not this face's
        let pen = 0, at: [number, number] | null = null;
        for (const p of corners) { const t = (p[0] - o.a[0]) * ux + (p[1] - o.a[1]) * uy; if (t < -0.05 || t > o.len + 0.05) continue; const d = (p[0] - o.a[0]) * o.n[0] + (p[1] - o.a[1]) * o.n[1]; if (-d > pen) { pen = -d; at = p; } }
        if (at) this.resolve(v, [at[0], at[1], v.p[2]], [o.n[0], o.n[1], 0], pen, o.mat); }
      else { if (o.rank >= share) continue;   // a tree the density setting leaves out is not there
        // the box's nearest point to the trunk's axis, in the body's frame
        const dx = o.x - v.p[0], dy = o.y - v.p[1], lx = c * dx + s * dy, ly = -s * dx + c * dy, qx = Math.max(-b.hl, Math.min(b.hl, lx)), qy = Math.max(-b.hw, Math.min(b.hw, ly));
        let nx = lx - qx, ny = ly - qy, d = Math.hypot(nx, ny), pen: number;
        if (d > o.r) continue;
        if (d < 1e-6) { const px = b.hl - Math.abs(lx), py = b.hw - Math.abs(ly); if (px < py) { nx = Math.sign(lx) || 1; ny = 0; pen = px + o.r; } else { nx = 0; ny = Math.sign(ly) || 1; pen = py + o.r; } }   // the trunk inside the box
        else { nx /= d; ny /= d; pen = o.r - d; }
        // the normal on the car, from the trunk toward the car (world)
        const wx = -(c * nx - s * ny), wy = -(s * nx + c * ny), ax = v.p[0] + c * qx - s * qy, ay = v.p[1] + s * qx + c * qy;
        this.resolve(v, [ax, ay, v.p[2]], [wx, wy, 0], pen, 'tree'); } } }
  /** a contact: out of it, an impulse against the closing speed (and friction along the face), a blow if hard */
  private resolve(v: Vehicle, at: V3, n: V3, pen: number, mat: Material): void { const M = MATERIAL[mat];
    v.p[0] += n[0] * pen; v.p[1] += n[1] * pen;
    const vp = v.velAt(at), vn = vp[0] * n[0] + vp[1] * n[1]; if (vn >= 0) return;
    const im = v.invMassAt(at, n), j = -(1 + M.e) * vn / im; v.applyImpulse(at, [n[0] * j, n[1] * j, 0]);
    const tx = vp[0] - n[0] * vn, ty = vp[1] - n[1] * vn, tl = Math.hypot(tx, ty);
    if (tl > 1e-3) { const t: V3 = [tx / tl, ty / tl, 0], jt = Math.min(M.mu * j, tl / v.invMassAt(at, t)); v.applyImpulse(at, [-t[0] * jt, -t[1] * jt, 0]); }
    const E = 0.5 * vn * vn / im * M.dmg; if (E > 150) { v.blow(at, [-n[0], -n[1], 0], E, mat === 'tree' ? 0.3 : mat === 'tyres' ? 0.8 : 0.5); this.onHit?.(v, { E, mat, at }); } }
  /** the surface off the concrete at (s, off) */
  surface(s: number, off: number): Surface { if (!this.edge) return SURFACE.grass; const e = edgeAt(this.edge, s, off), a = Math.abs(off);
    if (e.banked) return SURFACE.grass; if (a <= e.kerb) return SURFACE.kerb; if (a <= e.paint) return SURFACE.paint; return e.trap === 'gravel' && a <= e.trapOut + 0.3 ? SURFACE.gravel : SURFACE.grass; }
  /** the car given its contacts and its ground: the hooks Vehicle runs each sub-step */
  equip(v: Vehicle): Vehicle { v.contact = () => this.step(v); v.surface = (s, off) => this.surface(s, off); return v; }
}
