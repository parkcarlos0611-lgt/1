// The shelf panel: the strip between an edge line standing in from the crest (a plateau bonnet's edge, then a bubble
// cabin's belt) and the crest itself. Rows of four points (skin.ts SHF): the edge E, the foot F of a wall dropping from
// it, the floor's middle M (sagging where it is a scooped trough), the crest K. Ahead of its first row the strip is
// flat (a lamp at the trough's mouth, or the wing's top), its last cell fanned onto the shelf's four points.
// It is part of the wing, the door and the rear quarter in turn (so each panel smooths across its own piece of it).
import type { Ctx } from '../ctx';
import { UP } from '../ctx';
import { TOP } from '../section';
import { lerp, mir, mix, type V } from '../geom';
import { zones } from './zones';

export function shelf(x: Ctx): void {
  const { e, s, c, k, L } = x, S = k.shelf; if (!S) return; const z = zones(x), T = s.TFG, E = TOP.EDGE, G = s.SHF, nT = T.length - s.iSh;
  if (S.lamp) e.name('indicatorF').mat(c[S.lamp] as string, 0.7, 'lens'); else e.name('wingF').mat(c.paint, c.gloss, 'paint');
  e.cells(T.slice(0, s.iSh).map(r => [r[E]!, r[TOP.K]!]));
  if (s.iSh > 0) { const a = T[s.iSh - 1]!, g = G[0]!; for (const sg of [1, -1]) e.fan0([a[E]!, a[TOP.K]!, g[3]!, g[2]!, g[1]!, g[0]!].map(p => mir(p, sg)), UP); }
  // the station each of its rows stands at (rows ahead of the front arch count as the wing's)
  const st = (i: number) => i < nT ? s.iSh + i - s.iXJ : s.iA + i - nT + 1, zone = (i: number) => st(i) < z.iD0 ? 0 : st(i) < z.iD1 ? 1 : 2;
  ['wingF', 'door', 'quarter'].forEach((n, q) => { e.name(n).mat(c.paint, c.gloss, 'paint'); e.cells(G, i => zone(i) === q); });
  // a dark slot along its floor
  if (S.slot) e.with('part', () => { const [x0, x1] = S.slot!.x.map(L.mx) as [number, number], n = S.slot!.n, xs = G.map(r => r[0]![0]);
    const at = (px: number, v: number): V => { let i = 0; while (i + 2 < xs.length && xs[i + 1]! < px) i++; const u = (px - xs[i]!) / (xs[i + 1]! - xs[i]!), p = mix(mix(G[i]![1]!, G[i]![3]!, v), mix(G[i + 1]![1]!, G[i + 1]![3]!, v), u); return [p[0], p[1], p[2] + 4]; };
    e.name('grille').mat(c.dark, 0.05); for (const sg of [1, -1]) for (let q = 0; q < n; q++) { const a = lerp(x0, x1, q / n), b = lerp(x0, x1, (q + 1) / n), va = 0.5 + 0.35 * (1 - q / n), vb = 0.5 + 0.35 * (1 - (q + 1) / n);
      e.face(mir(at(a, 0.15), sg), mir(at(b, 0.15), sg), mir(at(b, vb), sg), mir(at(a, va), sg), UP); } });
}
