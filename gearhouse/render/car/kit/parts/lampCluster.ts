// The tail's lamp cluster, laid on the lamp panel's surface just proud of it. Kinds:
//   'band'   a round amber indicator at each end, rectangular lenses across (tail, stop, reversing), the badge's dark square
//   'round'  round lamps in a row each side (a rim and a red lens), the badge between
//   'sunk'   round lamps each at the back of its own recess (the ducktail cuts the recesses), the badge and a script between
import type { Ctx } from '../ctx';
import { curve, lin, type V } from '../geom';
import { TAILP } from '../section';
import { onBlock, yzOf } from '../punch';

/** the lamp panel's surface at (y, z), lifted `lift` toward the back, on side sg */
export function lampSurface(x: Ctx): (y: number, z: number, lift: number, sg: number) => V {
  const { s, k, L } = x, T = k.tail;
  if (T.kind === 'ducktail') { const q = k.tailLamps.round?.pts ?? [TAILP.LAMP_TOP, TAILP.LAMP_FOOT], n: V = [1, 0, 0], at = onBlock(s.TLG, 0, s.TLG.length - 1, q[0], q[1], n, true);
    return (y, z, lift, sg) => { const p = at(...yzOf(n, Math.abs(y), z)); return [p[0] + lift, sg * Math.abs(y), z]; }; }
  const lv = k.section.tail.levels, rows = [TAILP.LAMP_TOP, TAILP.LAMP_MID, TAILP.LAMP_FOOT], XT1 = s.SF[s.SF.length - 1]!, p = T.pow[0];
  const CY = curve(rows.map(q => [-lv[q]!, s.CT[q]![1]] as [number, number])), TX = lin(rows.map(q => [lv[q]!, L.mx(T.reach[q]!)] as [number, number]));
  return (y, z, lift, sg) => { const f = Math.min(1, y / CY(-z)); return [XT1 + (TX(z) - XT1) * (1 - f ** p) ** (1 / p) - T.lampIn! + lift, sg * y, z]; };
}
export function lampCluster(x: Ctx, kind: 'band' | 'round' | 'sunk'): void {
  const { e, c, k, L } = x, S = k.tailLamps, at = lampSurface(x), Y = L.my;
  const ring = (yc: number, zc: number, r: number, lift: number, sg: number, n: number) => Array.from({ length: n }, (_, t) => { const a = t / n * Math.PI * 2, z = zc + r * Math.sin(a); return [at(yc, z, lift, sg)[0], sg * (yc + r * Math.cos(a)), z] as V; });
  const patch = (y0: number, y1: number, z0: number, z1: number, lift: number, sg: number) => e.face(at(y0, z0, lift, sg), at(y1, z0, lift, sg), at(y1, z1, lift, sg), at(y0, z1, lift, sg), [1, 0, 0]);
  for (const sg of [1, -1]) {
    if (kind === 'band') { const I = S.indicator, P = S.patches; if (!I || !P) throw new Error('kit: the lamp band needs its indicators and lenses');
      e.name('indicatorR').mat(c.dark, 0.3); e.fan(ring(Y(I.y), I.z, I.rim, I.lift[0], sg, I.seg), [1, 0, 0]); e.name('indicatorR').mat(c.amber, 0.75); e.fan(ring(Y(I.y), I.z, I.lens, I.lift[1], sg, I.seg), [1, 0, 0]);
      for (const [name, col, gloss, kd, y0, y1, z0, z1, lift] of P) { e.name(name).mat(c[col] as string, gloss, kd); patch(Y(y0), Y(y1), z0, z1, lift, sg); } }
    else { const R = S.round; if (!R) throw new Error('kit: the round tail lamps need their places'); const dp = kind === 'sunk' ? -(R.depth ?? 0) : 0;
      if (kind === 'sunk') R.y.forEach((yc, i) => { const ring = (yc: number, zc: number, r: number, lift: number, sg: number, n: number) => Array.from({ length: n }, (_, t) => { const a = t / n * Math.PI * 2; return at(yc + r * Math.cos(a), zc + r * Math.sin(a), lift, sg); }); e.name(R.names[i]!).mat(c.chrome, 0.7, 'metal'); e.fan(ring(Y(yc), R.z, R.r - 2, dp + R.lift[0], sg, R.seg), [1, 0, 0]); e.name(R.names[i]!).mat(c[R.colours[i]!] as string, 0.7, 'lens'); e.fan(ring(Y(yc), R.z, R.r - R.rim, dp + R.lift[1], sg, R.seg), [1, 0, 0]); });
      else R.y.forEach((yc, i) => { e.name(R.names[i]!).mat(c.dark, 0.3); e.fan(ring(Y(yc), R.z, R.r, R.lift[0], sg, R.seg), [1, 0, 0]); e.name(R.names[i]!).mat(c[R.colours[i]!] as string, 0.7, 'lens'); e.fan(ring(Y(yc), R.z, R.r - R.rim, R.lift[1], sg, R.seg), [1, 0, 0]); }); } }
  const b = S.badge, [by, bz0, bz1, bl] = b.bright;
  if (b.dark) { const [dy, dz0, dz1, dl] = b.dark; e.name('badge').mat(c.dark, 0.3); e.face(at(Y(dy), dz0, dl, -1), at(Y(dy), dz0, dl, 1), at(Y(dy), dz1, dl, 1), at(Y(dy), dz1, dl, -1), [1, 0, 0]); }
  e.name('badge').mat(c.chrome, 0.85, 'metal'); e.face(at(Y(by), bz0, bl, -1), at(Y(by), bz0, bl, 1), at(Y(by), bz1, bl, 1), at(Y(by), bz1, bl, -1), [1, 0, 0]);
  if (S.script) { const [y0, y1, z0, z1, lift] = S.script; e.name('script').mat(c.silver, 0.6, 'metal'); e.face(at(Y(y0), z0, lift, 1), at(Y(y1), z0, lift, 1), at(Y(y1), z1, lift, 1), at(Y(y0), z1, lift, 1), [1, 0, 0]); }
}
