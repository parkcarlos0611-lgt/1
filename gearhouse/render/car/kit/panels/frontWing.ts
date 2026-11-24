// The front wing panel: the wings' tops beside the bonnet, the nose's corners above the shut line, the flank ahead
// of the door (the arch cut by the standard section), the side repeater on it.
import type { Ctx } from '../ctx';
import { FLANK, TOP } from '../section';
import { add, mir, type V } from '../geom';
import { zones } from './zones';

export function frontWing(x: Ctx): void {
  const { e, s, c } = x, z = zones(x);
  e.name('wingF').mat(c.paint, c.gloss, 'paint'); e.cells(s.TFG, (i, j) => j >= TOP.SHUT && !z.isCover(i, j) && !z.isCowl(i, j));
  e.cells(s.NSG, (i, q) => i >= TOP.SHUT && q < FLANK.H); e.cells(s.CH.slice(0, z.iD0 + 1), (i, q) => !z.isSill(i, q));
}
/** a flat lamp or marker laid just proud of the flank: x0..x1 along, z0..z1 up */
export function flankPatch(x: Ctx, name: string, colour: string, gloss: number, r: [number, number, number, number]): void {
  const { e, s, L } = x, [x0, x1, z0, z1] = [L.mx(r[0]), L.mx(r[1]), r[2], r[3]], P = (px: number, pz: number, sg: number): V => mir(add(s.F.surf(px, pz), [0, 3, 0]), sg);
  for (const sg of [1, -1]) { e.name(name).mat(colour, gloss); e.face(P(x0, z0, sg), P(x1, z0, sg), P(x1, z1, sg), P(x0, z1, sg), [0, sg, 0]); }
}
