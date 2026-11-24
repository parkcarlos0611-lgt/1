// The nose's bumper panel: below the shut line, in the standard section going round from the centre line to the front
// arch; the lamp strip at its top corners (cells of the same grid), the centre intake and the two outer ones with the
// fog lamps, cut in as pockets.
import type { Ctx } from '../ctx';
import { FLANK } from '../section';
import { border } from '../emit';
import { mir, type V } from '../geom';

export function noseBumper(x: Ctx): void {
  const { e, s, c, k } = x, bl = k.bumperLamps, ic = k.intakes.centre, oc = k.intakes.outer;
  const lampCell = (i: number, q: number) => q === FLANK.H && i >= bl.from && i < bl.to;
  const mouthC = (i: number, q: number) => i < ic.rows && q >= ic.cols[0] && q < ic.cols[1], mouthO = (i: number, q: number) => i >= oc.rows[0] && i < oc.rows[1] && q >= oc.cols[0] && q < oc.cols[1];
  e.name('bumperF').mat(c.paint, c.gloss, 'paint'); e.cells(s.NSG, (i, q) => q >= FLANK.H && !lampCell(i, q) && !mouthC(i, q) && !mouthO(i, q));
  e.name('sidelightF').mat(c.lens, 0.7); e.cells(s.NSG, (i, q) => lampCell(i, q) && i < bl.split);
  e.name('indicatorF').mat(c.amber, 0.7); e.cells(s.NSG, (i, q) => lampCell(i, q) && i >= bl.split);
  // the centre intake: one pocket across the centre line
  const N = s.NSG, rows = N.slice(0, ic.rows + 1), r: V[] = [...rows.map(p => p[ic.cols[0]]!)];
  for (let q = ic.cols[0] + 1; q < ic.cols[1]; q++) r.push(N[ic.rows]![q]!);
  r.push(...rows.slice().reverse().map(p => p[ic.cols[1]]!));
  const full = [...r, ...r.slice(1, -1).reverse().map(p => mir(p, -1))];
  e.name('grille'); e.pocket(full, [ic.depth, 0, 0], [-1, 0, 0], c.dark, 'grille');
  e.with('part', () => { e.name('grille').mat(c.frame, 0.2); for (const y of ic.bars) e.b.bar([ic.barX, y, ic.barZ[0]], [ic.barX, y, ic.barZ[1]], 12, 16); });
  for (const sg of [1, -1]) { e.name('grille'); e.pocket(border(N, oc.rows[0], oc.rows[1], oc.cols[0], oc.cols[1]).map(p => mir(p, sg)), [oc.depth, 0, 0], [-1, 0, 0], c.dark, 'grille');
    e.with('part', () => { const f = oc.fog; e.name('fogF').mat(c.lens, 0.7); e.inCell(N, f[0], oc.cols[0], f[1], f[2], f[3], f[4], -f[5], [-1, 0, 0], sg); }); }
}
