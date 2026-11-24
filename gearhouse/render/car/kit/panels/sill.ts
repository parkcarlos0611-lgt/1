// The sill panel: the standard section's sill zone between the arches (a dark slot along one of its cells, if the spec gives one).
import type { Ctx } from '../ctx';
import { zones } from './zones';

export function sill(x: Ctx): void { const { e, s, c, k, L } = x, z = zones(x), S = k.sillSlot;
  if (!S) { e.name('sill').mat(c.paint, c.gloss, 'paint'); e.cells(s.CH, z.isSill); return; }
  // a dark slot along one of its cells
  const a = L.at(S[0]), b = L.at(S[1]), slot = (i: number, q: number) => q === S[2] && i >= a && i < b;
  e.name('sill').mat(c.paint, c.gloss, 'paint'); e.cells(s.CH, (i, q) => z.isSill(i, q) && !slot(i, q)); e.name('sillSlot').mat(c.dark, 0.06); e.cells(s.CH, (i, q) => z.isSill(i, q) && slot(i, q)); }
