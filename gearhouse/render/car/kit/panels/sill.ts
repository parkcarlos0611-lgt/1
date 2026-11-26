// The sill panel: the standard section's sill zone between the arches.
import type { Ctx } from '../ctx';
import { zones } from './zones';

export function sill(x: Ctx): void { const { e, s, c } = x, z = zones(x); e.name('sill').mat(c.paint, c.gloss, 'paint'); e.cells(s.CH, z.isSill); }
