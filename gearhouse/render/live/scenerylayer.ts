// The site plan's small things gathered for the live renderer (review 181): the benches, lamps, fences, boards,
// marquees and parked cars of a track's scenery (Scenery.detail) are many and still, so rather than one draw each they
// are laid into one mesh per patch of ground (`cell` m square), each in the world where its placing puts it, about the
// patch's corner (mm), to be drawn with translate(origin) x scale(1/1000) as the fence's chunks are.
import type { Mesh } from '../car/mesh';
import type { Placed } from '../../race/scenery';
import { PROPS } from '../props/index';

export interface Chunk { mesh: Mesh; origin: [number, number, number]; count: number }
const made = new Map<string, Mesh>();
/** a prop's mesh (made once per kind and size) */
function meshOf(p: Placed): Mesh | null { const key = p.arg !== undefined ? `${p.kind}@${p.arg}` : p.kind; let m = made.get(key); if (m) return m; const f = PROPS[p.kind]; if (!f) return null; m = f(p.arg); made.set(key, m); return m; }

/** the placings laid into meshes by patch: each prop as placeMesh puts it (its middle on its point, its nose toward its
 *  heading, its sides mirrored as the drawing has them, its faces' winding turned back so they keep facing out) */
export function staticChunks(detail: Placed[], cell = 160): Chunk[] { const by = new Map<string, Placed[]>();
  for (const p of detail) { const k = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`; (by.get(k) ?? by.set(k, []).get(k)!).push(p); }
  const out: Chunk[] = [];
  for (const [k, ps] of by) { const [i, j] = k.split(',').map(Number) as [number, number], ox = i * cell, oy = j * cell, meshes = ps.map(meshOf);
    let n = 0; for (const m of meshes) if (m) n += m.pos.length / 9;
    const pos = new Float32Array(n * 9), col = new Uint8Array(n * 3), gloss = new Float32Array(n), part = new Int16Array(n), kind = new Uint8Array(n), tex = new Uint8Array(n), names: string[] = [];
    let t0 = 0, part0 = 0;
    ps.forEach((p, q) => { const m = meshes[q]; if (!m) return; const c = Math.cos(p.heading), s = Math.sin(p.heading), half = m.length / 2, z = (p.z ?? 0) * 1000, X = (p.x - ox) * 1000, Y = (p.y - oy) * 1000, nt = m.pos.length / 9;
      for (let t = 0; t < nt; t++) { for (let v = 0; v < 3; v++) { const src = t * 9 + (v === 0 ? 0 : v === 1 ? 6 : 3), dst = (t0 + t) * 9 + v * 3, x = m.pos[src]! - half, y = m.pos[src + 1]!;   // corners 1 and 2 swapped: the mirror turns the winding
          pos[dst] = X - c * x - s * y; pos[dst + 1] = Y - s * x + c * y; pos[dst + 2] = m.pos[src + 2]! + z; }
        col[(t0 + t) * 3] = m.col[t * 3]!; col[(t0 + t) * 3 + 1] = m.col[t * 3 + 1]!; col[(t0 + t) * 3 + 2] = m.col[t * 3 + 2]!; gloss[t0 + t] = m.gloss[t]!; kind[t0 + t] = m.kind[t]!; tex[t0 + t] = m.tex[t]!;
        part[t0 + t] = Math.min(32767, part0 + m.part[t]!); }
      let pm = 0; for (let t = 0; t < nt; t++) pm = Math.max(pm, m.part[t]!); m.names?.forEach((nm, a) => { names[part0 + a] = nm; }); part0 += pm + 1; t0 += nt; });
    out.push({ mesh: { n: t0, pos, col, gloss, part, kind, tex, length: 0, names }, origin: [ox, oy, 0], count: ps.length }); }
  return out; }
