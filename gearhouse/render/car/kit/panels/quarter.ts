// The quarter panel (the rear wing): the flank behind the door round the side intake, the ridge beside the rear glass
// (a strip joining the glass's edge to the crest), the ridge's top beside the deck; the fuel flap and the side marker.
import type { Ctx } from '../ctx';
import { UP } from '../ctx';
import { TOP } from '../section';
import type { V } from '../geom';
import { zones } from './zones';
import { flankSeam } from './door';
import { flankPatch } from './frontWing';

export function quarter(x: Ctx): void {
  const { e, s, c, k, L } = x, z = zones(x), slant = s.RGX.indexOf(L.X(k.canopy.slantFoot));
  e.name('quarter').mat(c.paint, c.gloss, 'paint'); e.cells(s.CH, (i, q) => i >= z.iD0 && !z.isDoor(i, q) && !z.isSill(i, q) && !z.isIntake(i, q));
  // a buttress car: the wing's top behind the buttress's tip, the gutter beside the lid (the canopy panel builds the buttress on the rail)
  if (k.canopy.kind === 'buttress') { const col = k.deck.rail!.col, iT = L.at(k.canopy.slantFoot) - s.iDk; e.cells(s.DKG, (i, j) => j >= k.deck.lidCols && (j < col || i >= iT) && !(j === k.deck.lidCols && i >= s.iBl)); return; }
  // the ridge between the rear glass's edge (from the slant's foot round the tongue to the centre line) and the crest (to the deck's first row)
  const A: V[] = [...s.RGL.slice(slant).map(r => r[TOP.N - 1]!), ...s.RGL[s.RGL.length - 1]!.slice(0, TOP.N - 1).reverse()];
  const B: V[] = [...s.CH.slice(L.at(k.canopy.slantFoot), s.iDk).map(r => r[0]!), ...s.DKG[0]!.slice().reverse()];
  e.zip(A, B, UP);
  e.cells(s.DKG, (i, j) => j > k.deck.lidCols || (j === k.deck.lidCols && i < s.iBl));
}
export function quarterTrim(x: Ctx): void {
  const { e, c, k } = x;
  if (k.fuelFlap) { e.name('seam').mat(c.seam, 0.1); flankSeam(x, k.fuelFlap.pts, [k.fuelFlap.side]); }
  const m = k.marker; if (m) flankPatch(x, 'markerR', c.red, 0.6, m);
  for (const [name, col, gloss, ...r] of k.flankPatches ?? []) flankPatch(x, name, c[col] as string, gloss, r as [number, number, number, number]);
}
