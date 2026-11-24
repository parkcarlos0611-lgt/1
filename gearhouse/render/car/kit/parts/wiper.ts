// The wipers parked along the screen's foot: each arm two bars bent at its middle, laid on the screen's second row.
import type { Ctx } from '../ctx';
import { mix, type V } from '../geom';
import type { WiperSpec } from '../spec';

export function wiper(x: Ctx, W: WiperSpec): void {
  const { e, s, c, L } = x, row = s.SCR[W.row]!, n = row.length;
  const onScr = (y: number, lift: number): V => { const a = Math.abs(y); let j = 0; while (j + 2 < n && row[j + 1]![1] < a) j++; const p = mix(row[j]!, row[j + 1]!, (a - row[j]![1]) / (row[j + 1]![1] - row[j]![1])); return [p[0] - lift * 0.4, y, p[2] + lift * 0.92]; };
  e.name('wiper').mat(c.frame, 0.15); for (const [ya, yb] of W.arms.map(a => a.map(L.my) as [number, number])) { const m = (ya + yb) / 2; e.b.bar(onScr(ya, W.lift[0]), onScr(m, W.lift[1]), W.bar[0], W.bar[1]).bar(onScr(m, W.lift[1]), onScr(yb, W.lift[0]), W.bar[0], W.bar[1]); }
}
