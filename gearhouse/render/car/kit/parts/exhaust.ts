// The exhaust tips: a turned pipe at each place given, open at its end (a dark disc set in it).
import type { Ctx } from '../ctx';
import type { V } from '../geom';
import type { ExhaustSpec } from '../spec';

export function exhaust(x: Ctx, X: ExhaustSpec): void {
  const { e, c, L } = x, [x0, x1, xin] = X.x.map(L.mx) as [number, number, number], [ro, ri] = X.r, ys = X.y.map(L.my);
  e.name('exhaust').mat(c.chrome, 0.8, 'metal'); for (const y of ys) e.b.lathe('x', [0, y, X.z], [[x0, ro], [x1, ro], [x1, ri], [xin, ri]], X.seg, false);
  e.name('exhaust').mat(c.dark, 0.05); for (const y of ys) e.fan(Array.from({ length: X.seg }, (_, k) => [xin + X.cap, y + ri * Math.cos(k * 2 * Math.PI / X.seg), X.z + ri * Math.sin(k * 2 * Math.PI / X.seg)] as V), [1, 0, 0]);
}
