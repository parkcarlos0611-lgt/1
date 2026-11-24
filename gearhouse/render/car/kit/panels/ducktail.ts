// The tail kind 'ducktail', seen from behind: the deck rises into a lip across the tail (its top the deck's last row),
// a sharp trailing edge with the face under it running forward (the undercut), then the tail panel set in under it:
// a black slot across its top, the round lamps each sunk in its own recess (parts/lampCluster 'sunk' lays the lenses),
// the bumper standing out below with its ledge, its face with the plate's recess and a black line, the dark lower
// grille and the valance. Its rows go round from the last chain to the centre line; its columns are the chain's points
// read as the tail's lines (section.tail.levels); each band of cells between two of them is named by the spec.
import type { Ctx } from '../ctx';
import type { HoleSpec } from '../spec';
import { NK } from '../section';
import type { V } from '../geom';
import { cutHoles, inHoles } from './holes';

/** the tail's openings: a recess for each round lamp, then the spec's own (the plate) */
export function duckHoles(x: Ctx): HoleSpec[] {
  const R = x.k.tailLamps.round, D = x.k.tail.duck!; if (!R?.rows || !R.pts || R.depth === undefined) throw new Error('kit: the ducktail needs its sunk lamps\' blocks');
  return [...R.y.map((y, i): HoleSpec => ({ name: 'tailPanel', rows: R.rows![i]!, pts: R.pts!, at: [x.L.my(y), R.z], size: [R.r, R.r], pow: 2, seg: R.seg, depth: R.depth!, wall: 'dark', back: 'plain' })), ...D.holes];
}
export function duckTail(x: Ctx): void {
  const { e, s, c, k } = x, D = k.tail.duck; if (!D) throw new Error('kit: the ducktail needs its bands');
  const G = s.TLG, iC = G.length - 1, n: V = [1, 0, 0], hs = duckHoles(x), skip = inHoles(hs, iC);
  const within = (i: number, q: number, half: number) => G[i]![q]![1] <= x.L.my(half) + 1;   // the cell's outer edge inside the half-width
  for (let q = 0; q < NK; q++) {
    const dark = (i: number) => (q === D.slot[0] && within(i, q, D.slot[1])) || (q === D.grille[0] && within(i, q, D.grille[1])) || q >= D.valance;
    e.name(D.bands[q] ?? 'bumperR').mat(c.paint, c.gloss, 'paint'); e.cells(G, (i, qq) => qq === q && !dark(i) && !skip(i, qq));
    if (q === D.slot[0]) { e.name('tailSlot').mat(c.black, 0.4); e.cells(G, (i, qq) => qq === q && dark(i) && !skip(i, qq)); }
    else if (q === D.grille[0]) { e.name('lowerGrille').mat(c.dark, 0.05, 'grille'); e.cells(G, (i, qq) => qq === q && dark(i) && !skip(i, qq)); }
    else if (q >= D.valance) { e.name('valance').mat(c.dark, 0.08); e.cells(G, (i, qq) => qq === q && !skip(i, qq)); }
  }
  cutHoles(x, G, hs, n, iC, -1);
  // the black line along the bumper's face
  const [lq, lh] = D.line, pts = G.filter(r => r[lq]![1] <= x.L.my(lh) + 1).map(r => r[lq]!);
  if (pts.length > 1) e.with('part', () => { e.name('bumperLine').mat(c.black, 0.3); e.seam(pts, () => n, 9, 1.5)([1, -1]); });
}
