// The bonnet panel: the long lid between its two shut lines, the dark cowl under the screen's foot, the badge on its nose.
import type { Ctx } from '../ctx';
import { UP } from '../ctx';
import { FLANK, TOP } from '../section';
import type { V } from '../geom';
import { zones } from './zones';

export function bonnet(x: Ctx): void {
  const { e, s, c } = x, z = zones(x);
  e.name('hood').mat(c.paint, c.gloss, 'paint'); e.cells(s.TFG, (i, j) => j < TOP.SHUT && !z.isCowl(i, j)); e.cells(s.NSG, (i, q) => i < TOP.SHUT && q < FLANK.H);
  e.name('cowl').mat(c.frame, 0.15); e.cells(s.TFG, z.isCowl);
}
/** the bonnet's shut lines and the badge on its nose (laid on the skin) */
export function bonnetTrim(x: Ctx): void {
  const { e, s, c, k } = x, z = zones(x);
  e.name('seam').mat(c.seam, 0.1); e.seam(s.TFG.slice(0, z.iCW + 1).map(r => r[TOP.SHUT]!), () => UP)([1, -1]);
  const b = k.bonnetBadge, p = (px: number, y: number): V => [px, y, s.zTop(px, Math.abs(y)) + b.lift];
  e.name('badge').mat(c.chrome, 0.8, 'metal'); e.face(p(b.x[0], -b.y), p(b.x[0], b.y), p(b.x[1], b.y), p(b.x[1], -b.y), UP);
}
