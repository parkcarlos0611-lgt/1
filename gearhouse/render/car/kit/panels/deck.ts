// The deck panel behind the glass. Kinds:
//   'lid'     a painted boot lid between the rear wings, the tail slot's floor under the spoiler's blade, its shut lines
//   'louvre'  on the buttress grid (canopy.buttress): the shelf at the rear glass's foot, the engine cover with a raised
//             centre panel and a row of slots each side, each slot a deep pocket down into the bay (the engine shows in
//             it); beside the cover the gutters, the buttresses' inner faces and tops, then the deck running into the
//             tail's lip. The slots' rows are finer than the stations: the slots' two columns are re-cut at every slot
//             edge and the cells either side of them joined to the finer lines by strips, so nothing gaps.
import type { Ctx } from '../ctx';
import { UP } from '../ctx';
import { lerp, mir, type Grid, type V } from '../geom';

export function deck(x: Ctx): void {
  const { e, s, c, k } = x, D = k.deck;
  if (D.kind === 'louvre') { louvre(x); return; }
  if (D.kind !== 'lid') throw new Error(`kit: deck kind ${D.kind} is not built yet`);
  e.name('bootLid').mat(c.paint, c.gloss, 'paint'); e.cells(s.DKG, (i, j) => j < D.lidCols && i < s.iBl);
  e.name('tailSlot').mat(c.shade, 0.3, 'paint'); e.cells(s.DKG, (i, j) => j < D.lidCols && i >= s.iBl);   // the gutter under the blade lies inside the wing (tail.ts closes it)
}
export function deckTrim(x: Ctx): void {
  const { e, s, c, k, L } = x; if (k.deck.kind !== 'lid') return; const iS = L.at(k.deck.shut) - s.iDk;
  e.name('seam').mat(c.seam, 0.1); e.seam(s.DKG.slice(0, iS + 1).map(r => r[k.deck.lidCols]!), () => UP)([1, -1]); e.seam(s.DKG[iS]!.slice(0, k.deck.lidCols + 1), () => UP)([1, -1]);
}

/** a polyline (going back along x) with points added at the stations xs that fall inside it (on its straight runs) */
function recut(P: V[], xs: number[]): V[] { const out: V[] = [P[0]!];
  for (let i = 0; i + 1 < P.length; i++) { const a = P[i]!, b = P[i + 1]!; for (const xv of xs) if (xv > a[0] + 0.5 && xv < b[0] - 0.5) { const t = (xv - a[0]) / (b[0] - a[0]); out.push([xv, lerp(a[1], b[1], t), lerp(a[2], b[2], t)]); } out.push(b); }
  return out; }

function louvre(x: Ctx): void {
  const { e, s, c, k, L } = x, LV = k.deck.louvre, Bu = k.canopy.buttress; if (!LV || !Bu) throw new Error('kit: the louvred deck needs its slots and the buttress grid');
  const G = s.DKG, nD = G.length, [j2, j3] = LV.cols, CC = LV.coverCols, xQ = L.X(k.canopy.slantFoot), xs = (i: number) => G[i]![0]![0];
  const sh0 = L.X(LV.shelf[0]), sh1 = L.X(LV.shelf[1]);
  // the slots' edges along x, and the block of rows they lie in
  const edges = Array.from({ length: LV.count }, (_, q) => { const a = L.mx(LV.x + q * LV.pitch); return [a, a + L.mx(LV.x + q * LV.pitch + LV.width) - L.mx(LV.x + q * LV.pitch)] as [number, number]; });
  const first = edges[0]![0], last = edges[edges.length - 1]![1];
  let ia = 0; while (ia + 1 < nD - 1 && xs(ia + 1) <= first) ia++; let ib = ia; while (ib < nD - 2 && xs(ib) < last) ib++;
  if (xs(ia) >= first || xs(ib) <= last) throw new Error('kit: the louvre\'s slots must lie inside the deck\'s stations');
  if (j3 !== j2 + 1) throw new Error('kit: the louvre\'s slots lie between two neighbouring columns');
  const inBlock = (i: number, j: number) => i >= ia && i < ib && j >= j2 - 1 && j <= j3;
  // the cover, the shelf, the gutters and buttresses, the deck, the lip
  const shelf = (i: number) => xs(i) >= sh0 - 0.5 && xs(i + 1) <= sh1 + 0.5;
  e.name('shelf').mat(c.dark, 0.08); e.cells(G, (i, j) => j < CC && shelf(i) && !inBlock(i, j));
  e.name('engineCover').mat(c.paint, c.gloss, 'paint'); e.cells(G, (i, j) => j < CC && !shelf(i) && i < nD - 2 && !inBlock(i, j));
  e.name('buttress').mat(c.paint, c.gloss, 'paint'); e.cells(G, (i, j) => j >= CC && xs(i + 1) <= xQ + 0.5 && i < nD - 2 && !inBlock(i, j));
  e.name('deck').mat(c.paint, c.gloss, 'paint'); e.cells(G, (i, j) => (i === nD - 2 || (j >= CC && xs(i + 1) > xQ + 0.5)) && !inBlock(i, j));
  // the slots' block: the two columns re-cut at every slot edge; the cells beside them joined by strips
  const cut = edges.flat(), col = (j: number) => G.slice(ia, ib + 1).map(r => r[j]!), A = recut(col(j2), cut), B = recut(col(j3), cut);
  const FG: Grid = A.map((p, r) => [p, B[r]!]), rowAt = (xv: number) => FG.findIndex(r => Math.abs(r[0]![0] - xv) < 0.5), spans = edges.map(([a, b]) => [rowAt(a), rowAt(b)] as [number, number]);
  const isSlot = (r: number) => spans.some(([a, b]) => r >= a && r < b);
  e.name('engineCover').mat(c.paint, c.gloss, 'paint'); e.strip(col(j2 - 1), A); e.strip(B, col(j3 + 1)); e.cells(FG, r => !isSlot(r));
  // each slot one pocket round its whole outline (a station falling inside a slot adds a point to its sides)
  e.name('louvre'); for (const [a, b] of spans) { const ring = [...FG.slice(a, b + 1).map(r => r[0]!), ...FG.slice(a, b + 1).reverse().map(r => r[1]!)]; for (const sg of [1, -1]) e.pocket(ring.map(p => mir(p, sg)), [0, 0, -LV.depth], UP, c.dark); }
}
