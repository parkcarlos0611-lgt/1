// The ground for the live renderer (review 99): the fields, the paddock's gravel and the mown strip, the railway's
// ballast, sleepers and rails, the river, the concrete in strips (lighter where it climbs, joints across, dark edges),
// the earth banks behind the bankings, the start line, and the fence (built again when a stretch of it is broken).
// World axes, metres. Every vertex: position, colour, and a flag (1: grass, given a fine speckle by the shader).
import type { Track } from '../../race/track';
import type { Scenery } from '../../race/scenery';

export interface GroundData { pos: Float32Array; col: Uint8Array; flag: Float32Array; n: number }
class Tris { P: number[] = []; C: number[] = []; F: number[] = [];
  tri(a: number[], b: number[], c: number[], col: number[], flag = 0) { this.P.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) { this.C.push(col[0]!, col[1]!, col[2]!); this.F.push(flag); } }
  quad(a: number[], b: number[], c: number[], d: number[], col: number[], flag = 0) { this.tri(a, b, c, col, flag); this.tri(a, c, d, col, flag); }
  done(): GroundData { return { pos: new Float32Array(this.P), col: new Uint8Array(this.C), flag: new Float32Array(this.F), n: this.P.length / 3 }; } }
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** a polygon cut into triangles (ear clipping; the scenery's areas are simple outlines) */
function earcut(pts: [number, number][]): [number, number, number][] { const idx = pts.map((_, i) => i), out: [number, number, number][] = [];
  let area = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i]!, [x1, y1] = pts[(i + 1) % pts.length]!; area += x0 * y1 - x1 * y0; } const sgn = Math.sign(area) || 1;
  const cross = (a: [number, number], b: [number, number], c: [number, number]) => ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) * sgn;
  const inside = (p: [number, number], a: [number, number], b: [number, number], c: [number, number]) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0; while (idx.length > 3 && guard++ < 10000) { let cut = false;
    for (let k = 0; k < idx.length; k++) { const i0 = idx[(k + idx.length - 1) % idx.length]!, i1 = idx[k]!, i2 = idx[(k + 1) % idx.length]!, a = pts[i0]!, b = pts[i1]!, c = pts[i2]!;
      if (cross(a, b, c) <= 0) continue; if (idx.some(j => j !== i0 && j !== i1 && j !== i2 && inside(pts[j]!, a, b, c))) continue; out.push([i0, i1, i2]); idx.splice(k, 1); cut = true; break; }
    if (!cut) break; }
  if (idx.length === 3) out.push([idx[0]!, idx[1]!, idx[2]!]); return out; }

export function groundData(T: Track, S: Scenery, start: number): GroundData { const g = new Tris(), W2 = T.spec.width / 2, L = Math.round(T.length);
  // the fields: one wide sheet a little below the concrete's foot
  { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const n of T.nodes) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); }
    const m = 1500, z = -0.03; g.quad([x0 - m, y0 - m, z], [x1 + m, y0 - m, z], [x1 + m, y1 + m, z], [x0 - m, y1 + m, z], hex('#5d7348'), 1); }
  for (const a of S.areas) { const col = hex(a.kind === 'apron' ? '#a49a83' : '#6a8452'), z = -0.02; for (const [i, j, k] of earcut(a.pts)) g.tri([...a.pts[i]!, z], [...a.pts[j]!, z], [...a.pts[k]!, z], col, a.kind === 'mown' ? 1 : 0); }
  const band = (pts: [number, number][], w: number, col: number[], z: number) => { for (let k = 0; k + 1 < pts.length; k++) { const [xa, ya] = pts[k]!, [xb, yb] = pts[k + 1]!, dx = xb - xa, dy = yb - ya, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
      g.quad([xa + nx, ya + ny, z], [xb + nx, yb + ny, z], [xb - nx, yb - ny, z], [xa - nx, ya - ny, z], col); } };
  for (const l of S.lines) {
    if (l.kind === 'river') { band(l.pts, l.width + 3, hex('#4b5c3b'), -0.015); band(l.pts, l.width, hex('#5b7a86'), -0.012); band(l.pts, l.width * 0.4, hex('#6c8c98'), -0.01); }
    else if (l.kind === 'rail') { band(l.pts, l.width, hex('#8a7f6e'), -0.015);
      for (let k = 0; k + 1 < l.pts.length; k++) { const [x0, y0] = l.pts[k]!, [x1, y1] = l.pts[k + 1]!, dx = x1 - x0, dy = y1 - y0, n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n;
        for (let d = 0; d < n; d += 0.9) { const cx = x0 + ux * d, cy = y0 + uy * d; g.quad([cx - uy * 1.3 - ux * 0.12, cy + ux * 1.3 - uy * 0.12, 0.02], [cx + uy * 1.3 - ux * 0.12, cy - ux * 1.3 - uy * 0.12, 0.02], [cx + uy * 1.3 + ux * 0.12, cy - ux * 1.3 + uy * 0.12, 0.02], [cx - uy * 1.3 + ux * 0.12, cy + ux * 1.3 + uy * 0.12, 0.02], hex('#5a4a3a')); }
        for (const o of [-0.72, 0.72]) { const ox = -uy * o, oy = ux * o, w = 0.05; g.quad([x0 + ox - uy * w, y0 + oy + ux * w, 0.15], [x1 + ox - uy * w, y1 + oy + ux * w, 0.15], [x1 + ox + uy * w, y1 + oy - ux * w, 0.15], [x0 + ox + uy * w, y0 + oy - ux * w, 0.15], hex('#3c3e42')); } } }
    else band(l.pts, l.width, hex('#9b9384'), -0.012); }
  // the concrete, a metre at a time, nine strips across; the joints, the dark edges; the earth bank behind a banking
  const P = (s: number, o: number, dz = 0) => { const p = T.point(s, o); return [p.x, p.y, p.z + dz]; };
  for (let s = 0; s < L; s++) { const s1 = s + 1;
    for (let k = 0; k < 9; k++) { const o0 = -W2 + k * 2 * W2 / 9, o1 = o0 + 2 * W2 / 9, z = (T.height(s, o0) + T.height(s, o1)) / 2, slope = Math.abs(T.slope(s, (o0 + o1) / 2).across), v = Math.round(156 + z * 5 - slope * 34);
      g.quad(P(s, o0), P(s, o1), P(s1, o1), P(s1, o0), [v, v - 2, v - 9]); }
    if (s % T.spec.joints === 0) g.quad(P(s - 0.04, -W2, 0.005), P(s - 0.04, W2, 0.005), P(s + 0.04, W2, 0.005), P(s + 0.04, -W2, 0.005), [92, 88, 80]);
    for (const o of [-W2, W2]) { const i = o < 0 ? 1 : -1; g.quad(P(s, o, 0.006), P(s, o + i * 0.18, 0.006), P(s1, o + i * 0.18, 0.006), P(s1, o, 0.006), hex('#3b3a35')); }
    const bk = T.bankAt(s).b, out = T.at(s).k >= 0 || bk ? (bk && T.at((bk.s0 + bk.s1) / 2).k < 0 ? 1 : -1) : -1, H = T.height(s, out * W2) - T.bump(s), H1 = T.height(s1, out * W2) - T.bump(s1);
    if (H > 0.3 || H1 > 0.3) { const a = T.point(s, out * W2), b = T.point(s1, out * W2), fa = T.point(s, out * (W2 + Math.max(H, 0.3) * 2.4)), fb = T.point(s1, out * (W2 + Math.max(H1, 0.3) * 2.4));
      g.quad([a.x, a.y, a.z], [b.x, b.y, b.z], [fb.x, fb.y, -0.025], [fa.x, fa.y, -0.025], hex('#4c6340'), 1); } }
  g.quad(P(start - 0.15, -W2, 0.008), P(start - 0.15, W2, 0.008), P(start + 0.15, W2, 0.008), P(start + 0.15, -W2, 0.008), hex('#f2efe6'));
  return g.done(); }

/** the fence along both edges: a rail at 0.9 m, a post every 3 m, the stretches not broken */
export function fenceData(T: Track, ok: (side: number, m: number) => boolean): GroundData { const g = new Tris(), W2 = T.spec.width / 2, L = Math.round(T.length), white = hex('#e8e3d6');
  for (const o of [-(W2 + 1.5), W2 + 1.5]) { const side = Math.sign(o);
    for (let s = 0; s < L; s++) { if (!ok(side, s)) continue; const a = T.point(s, o), b = T.point(s + 1, o), za = T.height(s, o), zb = T.height(s + 1, o);
      g.quad([a.x, a.y, za + 0.86], [b.x, b.y, zb + 0.86], [b.x, b.y, zb + 0.94], [a.x, a.y, za + 0.94], white);
      if (s % 3 === 0) { const n = T.at(s), ux = Math.cos(n.h) * 0.05, uy = Math.sin(n.h) * 0.05, vx = -uy, vy = ux;
        for (const [p, q] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]] as const) g.quad([a.x + ux * p[0] + vx * p[1], a.y + uy * p[0] + vy * p[1], za], [a.x + ux * q[0] + vx * q[1], a.y + uy * q[0] + vy * q[1], za], [a.x + ux * q[0] + vx * q[1], a.y + uy * q[0] + vy * q[1], za + 1], [a.x + ux * p[0] + vx * p[1], a.y + uy * p[0] + vy * p[1], za + 1], white); } } }
  return g.done(); }
