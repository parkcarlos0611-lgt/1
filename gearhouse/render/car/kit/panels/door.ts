// The door panel: the flank between the screen's foot and the B pillar (its top to the glass's back corner, its lower
// part to the side intake), its shut lines, the flush pulls and the lock.
import type { Ctx } from '../ctx';
import { add, mir, type V } from '../geom';
import { zones } from './zones';

export function door(x: Ctx): void { const { e, s, c } = x, z = zones(x); e.name('door').mat(c.paint, c.gloss, 'paint'); e.cells(s.CH, z.isDoor); }
/** a shut line on the flank through [x, z] points (sheet frame) */
export function flankSeam(x: Ctx, pts: [number, number][], sgs: number[]): void { const { e, s, L } = x; e.seam(pts.map(([px, pz]) => s.F.surf(L.mx(px), pz)), () => [0, 1, 0.25])(sgs); }
export function doorTrim(x: Ctx): void {
  const { e, s, c, k, L } = x, d = k.door;
  e.name('seam').mat(c.seam, 0.1); flankSeam(x, d.frontSeam, [1, -1]); for (const p of d.rearSeam) flankSeam(x, p, [1, -1]);
  const h = d.handle; if (!d.noHandle) for (const sg of [1, -1]) { const P = (px: number, pz: number): V => mir(add(s.F.surf(L.mx(px), pz), [0, 3, 1]), sg), n: V = [0, sg, 0.4];
    e.name('handle').mat(c.frame, 0.3); e.face(P(h.pull[0], h.pull[2]), P(h.pull[1], h.pull[3]), P(h.pull[1], h.pull[4]), P(h.pull[0], h.pull[5]), n);
    e.name('handle').mat(c.chrome, 0.8, 'metal'); e.face(P(h.lock[0], h.lock[2]), P(h.lock[1], h.lock[3]), P(h.lock[1], h.lock[4]), P(h.lock[0], h.lock[5]), n); }
}
