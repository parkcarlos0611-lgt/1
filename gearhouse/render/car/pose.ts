// A car tilted on its springs, drawn again from its own outlines rather than by turning a picture (review 24):
// every outline point is turned about the centre of mass and the renderer draws the result with the light still
// from the top left, the outline still two pixels and every line still on the pixel grid. Poses are made once per
// car at whole degrees; what is left between two poses (under half a degree) is taken up by moving pixel columns.
import type { CarDesign, Feature, Pt } from './types';
import { expandParts } from './parts';

/** the design turned by `deg` (nose up positive, for a car facing +x) about (cx, cz) mm, moved by `pad` mm so nothing is cut */
export function turnDesign(d0: CarDesign, deg: number, cx: number, cz: number, pad = 250): CarDesign {
  const d = expandParts(JSON.parse(JSON.stringify(d0)) as CarDesign), a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  delete d.parts;
  const T = (q: Pt | number[]) => { const dx = q[0]! - cx, dz = q[1]! - cz; q[0] = Math.round(cx + dx * c - dz * s + pad); q[1] = Math.round(cz + dx * s + dz * c + pad); };
  for (const p of d.panels) { p.pts.forEach(T); for (const k of p.cut ?? []) { const q = [k.x, k.z]; T(q); k.x = q[0]!; k.z = q[1]!; } }
  for (const w of d.wheels) { const q = [w.x, w.z ?? w.r]; T(q); w.x = q[0]!; w.z = q[1]!; }
  d.features = d.features.map((f): Feature => { const g = JSON.parse(JSON.stringify(f)) as Feature; if ('pts' in g) g.pts.forEach(T); if ('at' in g) T(g.at as Pt);
    if (g.kind === 'louvres') { const q0 = [g.x0, g.z0], q1 = [g.x1, g.z1]; T(q0); T(q1); g.x0 = q0[0]!; g.z0 = q0[1]!; g.x1 = q1[0]!; g.z1 = q1[1]!; } return g; });
  d.length += pad * 2; d.height += pad * 2; return d;
}
