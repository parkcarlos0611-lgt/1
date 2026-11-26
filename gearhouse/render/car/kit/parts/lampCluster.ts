// The tail's lamp cluster, laid on the lamp panel's surface just proud of it. Kinds:
//   'band'   a round amber indicator at each end, rectangular lenses across (tail, stop, reversing), the badge's dark square
//   'round'  round lamps in a row each side (a rim and a red lens), the badge between
//   'sunk'   the badge only (the tail panel cuts the lamps' recesses itself)
import type { Ctx } from '../ctx';
import { curve, gridProbe, lerp, lin, type V } from '../geom';
import { TAILP } from '../section';

/** the lamp panel's surface at (y, z), lifted `lift` toward the back, on side sg */
export function lampSurface(x: Ctx): (y: number, z: number, lift: number, sg: number) => V {
  const { s, k, L } = x, T = k.tail, lv = k.section.tail.levels, rows = [TAILP.LAMP_TOP, TAILP.LAMP_MID, TAILP.LAMP_FOOT], XT1 = s.SF[s.SF.length - 1]!, p = T.pow[0];
  const CY = curve(rows.map(q => [-lv[q]!, s.CT[q]![1]] as [number, number])), TX = lin(rows.map(q => [lv[q]!, L.mx(T.reach[q]!)] as [number, number]));
  return (y, z, lift, sg) => { const f = Math.min(1, y / CY(-z)); return [XT1 + (TX(z) - XT1) * (1 - f ** p) ** (1 / p) - T.lampIn + lift, sg * y, z]; };
}
/** kind 'capsule': on a capsule tail's plain panel, a dark bezel with round ends each side and its lenses in a row along it
 *  (the end ones rounded), a block low in it; dark mesh slots; the dark bed strip across the panel's top */
function capsule(x: Ctx): void {
  const { e, s, c, k, L } = x, C = k.tailLamps.capsule, T = k.tail, Y = L.my, R1: V = [1, 0, 0]; if (!C) throw new Error('kit: the capsule tail lamps need their places');
  const at = (y: number, z: number, lift: number, sg: number): V => { const px = gridProbe(s.TLG, 1, 2, 0, Math.abs(y), z, true, (_, q) => q < T.split); return [(Number.isNaN(px) ? s.SF[s.SF.length - 1]! : px) + lift, sg * Math.abs(y), z]; };
  const patch = (y0: number, y1: number, z0: number, z1: number, lift: number, sg: number, n = 1) => { for (let q = 0; q < n; q++) { const a = lerp(y0, y1, q / n), b = lerp(y0, y1, (q + 1) / n); e.face(at(a, z0, lift, sg), at(b, z0, lift, sg), at(b, z1, lift, sg), at(a, z1, lift, sg), R1); } };
  const cap = (lift: number, grow: number, y0: number, y1: number, endIn: boolean, endOut: boolean) => { const r = C.h + grow; for (const sg of [1, -1]) { patch(y0, y1, C.z - r, C.z + r, lift, sg, 2);
    for (const [on, yc, dir] of [[endIn, y0, -1], [endOut, y1, 1]] as const) if (on) e.fan0(Array.from({ length: 6 }, (_, q) => { const t = -Math.PI / 2 + q / 5 * Math.PI; return at(yc + dir * r * 0.9 * Math.cos(t), C.z + r * Math.sin(t), lift, sg); }), R1); } };
  e.name('tailRim').mat(c.frame, 0.2); cap(C.lift[0], C.grow, Y(C.y[0]), Y(C.y[1]), true, true);
  C.lenses.forEach(([name, col, gloss, kd, y0, y1], n) => { e.name(name).mat(c[col] as string, gloss, kd); cap(C.lift[1], 0, Y(y0), Y(y1), n === 0, n === C.lenses.length - 1); });
  if (C.block) { const [col, y0, y1, z0, z1] = C.block; e.name('stopLamp').mat(c[col] as string, 0.5, 'lens'); for (const sg of [1, -1]) patch(Y(y0), Y(y1), z0, z1, C.lift[1] + 3, sg); }
  e.name('tailMesh').mat(c.dark, 0.05, 'grille'); for (const [y0, y1, z0, z1] of T.slots ?? []) for (const sg of [1, -1]) patch(Y(y0), Y(y1), z0, z1, 4, sg);
  if (T.bed) { const [h, z0, z1] = T.bed; e.name('wingBed').mat(c.frame, 0.1); for (const sg of [1, -1]) patch(0, Y(h), z0, z1, 4, sg, 3); }
}
export function lampCluster(x: Ctx, kind: 'band' | 'round' | 'sunk' | 'capsule'): void {
  if (kind === 'capsule') return capsule(x);
  const { e, c, k, L } = x, S = k.tailLamps, at = lampSurface(x), Y = L.my;
  const ring = (yc: number, zc: number, r: number, lift: number, sg: number, n: number) => Array.from({ length: n }, (_, t) => { const a = t / n * Math.PI * 2, z = zc + r * Math.sin(a); return [at(yc, z, lift, sg)[0], sg * (yc + r * Math.cos(a)), z] as V; });
  const patch = (y0: number, y1: number, z0: number, z1: number, lift: number, sg: number) => e.face(at(y0, z0, lift, sg), at(y1, z0, lift, sg), at(y1, z1, lift, sg), at(y0, z1, lift, sg), [1, 0, 0]);
  for (const sg of kind === 'sunk' ? [] : [1, -1]) {   // sunk lamps are cut in the panel by the tail itself
    if (kind === 'band') { const I = S.indicator; if (!I || !S.patches) throw new Error('kit: the lamp band needs its indicator and lenses');
      e.name('indicatorR').mat(c.dark, 0.3); e.fan(ring(Y(I.y), I.z, I.rim, I.lift[0], sg, I.seg), [1, 0, 0]); e.name('indicatorR').mat(c.amber, 0.75); e.fan(ring(Y(I.y), I.z, I.lens, I.lift[1], sg, I.seg), [1, 0, 0]);
      for (const [name, col, gloss, kd, y0, y1, z0, z1, lift] of S.patches) { e.name(name).mat(c[col] as string, gloss, kd); patch(Y(y0), Y(y1), z0, z1, lift, sg); } }
    else { const R = S.round; if (!R) throw new Error('kit: the round tail lamps need their places');
      R.y.forEach((yc, i) => { e.name(R.names[i]!).mat(c.dark, 0.3); e.fan(ring(Y(yc), R.z, R.r, R.lift[0], sg, R.seg), [1, 0, 0]); e.name(R.names[i]!).mat(c[R.colours[i]!] as string, 0.7, 'lens'); e.fan(ring(Y(yc), R.z, R.r - R.rim, R.lift[1], sg, R.seg), [1, 0, 0]); }); } }
  const b = S.badge, [dy, dz0, dz1, dl] = b.dark, [by, bz0, bz1, bl] = b.bright;
  if (dy > 0) e.name('badge').mat(c.dark, 0.3).face(at(Y(dy), dz0, dl, -1), at(Y(dy), dz0, dl, 1), at(Y(dy), dz1, dl, 1), at(Y(dy), dz1, dl, -1), [1, 0, 0]);
  e.name('badge').mat(c.chrome, 0.85, 'metal'); e.face(at(Y(by), bz0, bl, -1), at(Y(by), bz0, bl, 1), at(Y(by), bz1, bl, 1), at(Y(by), bz1, bl, -1), [1, 0, 0]);
}
