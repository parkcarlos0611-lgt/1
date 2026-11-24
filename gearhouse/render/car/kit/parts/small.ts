// Small fittings: the number plate (a thin box), placed by the spec.
import type { Ctx } from '../ctx';

export function plate(x: Ctx, box: [number, number, number, number, number, number]): void {
  const { e, c, L } = x; e.name('plate').mat(c.white, 0.3); e.b.box(L.mx(box[0]), L.mx(box[1]), L.my(box[2]), L.my(box[3]), box[4], box[5]);
}
