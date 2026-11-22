// The fence as solid things for the live renderer (review 112): white-painted posts every 3 m and a rail at 0.9 m,
// in 30 m chunks along each edge (a chunk built again when a stretch of it breaks), and the loose pieces' shapes.
// Meshes in mm about a chunk's origin (world metres x 1000), to be drawn with translate(origin) x scale(1/1000).
import { Build, type Mesh } from '../car/mesh';
import type { Track } from '../../race/track';
export const CHUNK = 30;
const PAINT = '#e8e3d6';
export function fenceChunk(T: Track, side: number, c: number, ok: (side: number, m: number) => boolean): { mesh: Mesh; origin: [number, number, number] } | null {
  const W2 = T.spec.width / 2 + 1.5, o = side * W2, s0 = c * CHUNK, s1 = Math.min(Math.round(T.length), s0 + CHUNK), p0 = T.point(s0, o), O: [number, number, number] = [p0.x, p0.y, 0];
  const at = (s: number, dz: number): [number, number, number] => { const p = T.point(s, o); return [(p.x - O[0]) * 1000, (p.y - O[1]) * 1000, (T.height(s, o) + dz) * 1000]; };
  const b = new Build(); b.name('fence').mat(PAINT, 0.3, 'paint'); let any = false;
  for (let s = s0; s < s1; s++) { if (!ok(side, s)) continue; any = true; b.bar(at(s, 0.9), at(s + 1, 0.9), 40, 90);   // the rail, a metre at a time
    if (s % 3 === 0) b.bar(at(s, 0), at(s, 1.0), 80, 80); }   // a post
  return any ? { mesh: b.mesh(1), origin: O } : null; }
/** a loose piece's shape, centred: a post 1 m long, or a rail 1 m long (stretched to its own length when drawn) */
export function pieceMesh(kind: 'post' | 'rail'): Mesh { const b = new Build(); b.name('fence').mat(PAINT, 0.3, 'paint');
  if (kind === 'post') b.bar([0, 0, -500], [0, 0, 500], 80, 80); else b.bar([-500, 0, 0], [500, 0, 0], 40, 90); return b.mesh(1); }
