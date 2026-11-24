// The underbody panel: it closes the shell from below. A floor from the centre line out to the flank's tuck at every
// station (its columns: the centre, the wells' inner wall, the tuck); round each arch the wheel well instead (a dark
// roof from the arch's lip in to the inner wall, the wall down to the floor); under the nose and the tail a fan out
// to their caps' tucks. Every point it uses is the flank's, the nose's or the tail's own, so the shell is closed.
import type { Ctx } from '../ctx';
import { NK } from '../section';
import { lerp, clamp01, mir, type V } from '../geom';

export function underbody(x: Ctx): void {
  const { e, s, c, L } = x, SF = s.SF, { f: AF, r: AR } = L.arches, iF0 = L.atX(AF.x - AF.r), iF1 = L.atX(AF.x + AF.r), iR0 = L.atX(AR.x - AR.r), iR1 = L.atX(AR.x + AR.r);
  const yin = (px: number) => px <= AF.x + AF.r ? AF.yin : px >= AR.x - AR.r ? AR.yin : lerp(AF.yin, AR.yin, clamp01((px - AF.x - AF.r) / (AR.x - AR.r - AF.x - AF.r)));
  const zf = SF.map(px => s.F.chain(px, true)[NK]![2]);   // the floor's height: the tuck's, as if no arch cut it
  // its columns go in from the tuck (so the cells face down): the tuck, the wells' inner wall, the centre line
  const FG = SF.map((px, i): V[] => [s.CH[i]![NK]!, [px, yin(px), zf[i]!], [px, 0, zf[i]!]]);
  const inArch = (i: number) => (i >= iF0 && i < iF1) || (i >= iR0 && i < iR1);
  e.name('chassis').mat(c.dark, 0.05);
  e.cells(FG, (i, j) => j === 1 || !inArch(i));
  // the wells: the roof from the lip to the inner wall, the wall down to the floor
  for (const [i0, i1] of [[iF0, iF1], [iR0, iR1]] as const) { const W: V[][] = []; for (let i = i0; i <= i1; i++) { const foot = s.CH[i]![NK]!; W.push([foot, [SF[i]!, yin(SF[i]!), foot[2]], FG[i]![1]!]); }
    e.cells(W); }
  // under the nose: a fan from the floor's first inner point out round the nose's tuck
  const nose = s.NSG.map(r => r[NK]!), m0 = FG[0]![1]!;
  for (const sg of [1, -1]) { const t = (p: V, q: V, r: V) => e.tri(mir(p, sg), mir(q, sg), mir(r, sg), [0, 0, -1]); t(m0, FG[0]![2]!, nose[0]!); for (let i = 0; i + 1 < nose.length; i++) t(m0, nose[i]!, nose[i + 1]!); }
  // under the tail: from the last station's inner point round the tail's tuck (the frame's rows, then the valance's)
  const FR = x.k.tail.frameRows, foot = [...s.TLG.slice(0, FR + 1).map(r => r[NK]!), ...s.VG.slice(FR).map(r => r[NK]!)], last = FG[FG.length - 1]!, mt = last[1]!;
  for (const sg of [1, -1]) { const t = (p: V, q: V, r: V) => e.tri(mir(p, sg), mir(q, sg), mir(r, sg), [0, 0, -1]); for (let i = 0; i + 1 < foot.length; i++) t(mt, foot[i]!, foot[i + 1]!); t(mt, foot[foot.length - 1]!, last[2]!); }
  e.with('part', () => { e.name('chassis').mat(c.dark, 0.05); for (const w of [L.wheels.f, L.wheels.r]) e.b.bar([w.x, -w.y, w.r], [w.x, w.y, w.r], x.k.under.axle[w === L.wheels.f ? 0 : 1]); });
}
