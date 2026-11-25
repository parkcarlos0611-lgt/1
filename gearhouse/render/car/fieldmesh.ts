// A one-make field's meshes (docs/systems/113 V0): every opponent a 959 of its own swaps, colour and plate. A 959's
// mesh takes about a fifth of a second to build (its subdivided shell), so they are kept by everything that shapes the
// car (its swaps, its plate, its machinery: not its colour), and each car is painted from the kept mesh: a field again
// (the race started over, the same cars in other colours) builds nothing.
import type { Design } from '../../core/design';
import { designMesh } from './design';
import { KINDS, type Mesh } from './mesh';

const hex = (h: string): [number, number, number] => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const kept = new Map<string, { m: Mesh; paint: [number, number, number] }>(), painted = new Map<string, Mesh>();
const LIMIT = 24;
/** what shapes the car (all but its colour, its id and its name) */
const shapeKey = (d: Design, detail: number) => JSON.stringify([{ ...d.body, paint: 0 }, d.engine, d.drive, d.kit, d.susp, detail]);
/** a mesh in another paint: the paint's triangles that wear the body colour (not a painted part of another colour) recoloured */
export function repaint(M: Mesh, from: [number, number, number], to: [number, number, number]): Mesh {
  const col = M.col.slice(), P = KINDS.indexOf('paint');
  for (let t = 0; t < M.n; t++) if (M.kind[t] === P && col[t * 3] === from[0] && col[t * 3 + 1] === from[1] && col[t * 3 + 2] === from[2]) { col[t * 3] = to[0]; col[t * 3 + 1] = to[1]; col[t * 3 + 2] = to[2]; }
  return { ...M, col }; }
/** a field car's mesh: built once per shape, painted once per shape and colour (at most LIMIT shapes kept) */
export function fieldMesh(d: Design, detail: 0 | 1 | 2 = 1): Mesh { const k = shapeKey(d, detail), pk = `${k}|${d.body.paint}`; const hit = painted.get(pk); if (hit) return hit;
  let e = kept.get(k); if (!e) { e = { m: designMesh(d, 0, 0, 0, detail), paint: hex(d.body.paint) }; kept.set(k, e);
    if (kept.size > LIMIT) { const old = kept.keys().next().value!; kept.delete(old); for (const p of [...painted.keys()]) if (p.startsWith(`${old}|`)) painted.delete(p); } }
  const to = hex(d.body.paint), m = to.every((v, i) => v === e!.paint[i]) ? e.m : repaint(e.m, e.paint, to); painted.set(pk, m); return m; }
/** how many shapes are kept (a test's look) */
export const fieldKept = () => kept.size;
