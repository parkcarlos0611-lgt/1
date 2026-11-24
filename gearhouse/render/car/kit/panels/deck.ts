// The deck panel: the boot lid between the rear wings behind the glass (kind 'lid': a painted plate), the tail slot's
// floor under the spoiler's blade, the lid's shut lines.
import type { Ctx } from '../ctx';
import { UP } from '../ctx';

export function deck(x: Ctx): void {
  const { e, s, c, k } = x, D = k.deck; if (D.kind !== 'lid') throw new Error(`kit: deck kind ${D.kind} is not built yet`);
  e.name('bootLid').mat(c.paint, c.gloss, 'paint'); e.cells(s.DKG, (i, j) => j < D.lidCols && i < s.iBl);
  e.name('tailSlot').mat(c.shade, 0.3, 'paint'); e.cells(s.DKG, (i, j) => j <= D.lidCols && i >= s.iBl);
}
export function deckTrim(x: Ctx): void {
  const { e, s, c, k, L } = x, iS = L.at(k.deck.shut) - s.iDk;
  e.name('seam').mat(c.seam, 0.1); e.seam(s.DKG.slice(0, iS + 1).map(r => r[k.deck.lidCols]!), () => UP)([1, -1]); e.seam(s.DKG[iS]!.slice(0, k.deck.lidCols + 1), () => UP)([1, -1]);
}
