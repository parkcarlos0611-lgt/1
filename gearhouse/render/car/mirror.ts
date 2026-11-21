// The other side of a car: the same design turned end for end, so the car faces the other way while the light still
// comes from the top left. Parts are expanded first; shade grids are turned with their panels. Things that differ
// from side to side (a filler cap, a spare on one flank) are then added or removed by the caller.
import type { CarDesign, Feature, Pt } from './types';
import { expandParts } from './parts';

export function mirrorSide(d0: CarDesign): CarDesign {
  const d = expandParts(JSON.parse(JSON.stringify(d0)) as CarDesign), L = d.length, fx = (x: number) => L - x, fp = (q: Pt) => { q[0] = fx(q[0]); };
  delete d.parts;
  for (const p of d.panels) { p.pts.forEach(fp); p.pts.reverse(); for (const c of p.cut ?? []) c.x = fx(c.x);
    if (p.shade) { const S = p.shade, v = S.v.slice(); for (let t = 0; t < S.nt; t++) for (let u = 0; u < S.nx; u++) S.v[t * S.nx + u] = v[t * S.nx + (S.nx - 1 - u)]!; } }
  for (const w of d.wheels) w.x = fx(w.x);
  d.features = d.features.map((f): Feature => { const c = JSON.parse(JSON.stringify(f)) as Feature;
    if ('pts' in c) c.pts.forEach(fp); if ('at' in c) fp(c.at as Pt);
    if (c.kind === 'louvres') { const a = fx(c.x1), b = fx(c.x0); c.x0 = a; c.x1 = b; c.slant = -(c.slant ?? 0.25); }
    if (c.kind === 'handle') c.at[0] -= c.len ?? 110;
    if (c.kind === 'lamp') c.facing = c.facing === 'front' ? 'rear' : 'front';
    return c; });
  if (d.marks) { const m = d.marks; d.marks = { ...m, fx: fx(m.rx), rx: fx(m.fx), cowl: fx(m.cab), cab: fx(m.cowl) }; }
  d.id = (d.id ?? 'car') + '_right'; d.name = d.name.replace('left side', 'right side');
  return d;
}
