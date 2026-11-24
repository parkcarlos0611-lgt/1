// The head lamps. Kind 'popup': the cover lies flush in the front top's slope (cells of the same grid, so its border
// is the well's), hinged about its back edge; `lamps` 0..1 raises it. Under it a dark well; on its front the pod's
// face with the lamps. ('pocket' and 'fixed' are for later cars.)
import type { Ctx } from '../ctx';
import { UP } from '../ctx';
import { TOP } from '../section';
import { border } from '../emit';
import { mir, mix, type V } from '../geom';
import { zones } from './zones';

export function popupLamp(x: Ctx): void {
  const { e, s, c, k, lamps } = x, P = k.popup, z = zones(x), T = s.TFG, [j0, jh, j1] = TOP.COVER;
  if (P.kind !== 'popup') throw new Error(`kit: head lamp kind ${P.kind} is not built yet`);
  const ang = lamps * P.open * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang), ox = T[z.iC1]![jh]![0], oz = T[z.iC1]![jh]![2];
  const up = (p: V): V => { const dx = p[0] - ox, dz = p[2] - oz; return [ox + dx * ca + dz * sa, p[1], oz - dx * sa + dz * ca]; };
  const CV = T.slice(z.iC0, z.iC1 + 1).map(r => r.slice(j0, j1 + 1).map(up));
  e.with('closure', () => { e.name('lampLid').mat(c.paint, c.gloss, 'paint'); e.cells(CV); });
  for (const sg of [1, -1]) { const m = (p: V) => mir(p, sg);
    e.name('lampWell'); e.pocket(border(T, z.iC0, z.iC1, j0, j1).map(m), [0, 0, -P.depth], UP, c.dark);
    if (lamps > 0.02) e.with('part', () => { const f0 = m(CV[0]![0]!), f1 = m(CV[0]![j1 - j0]!), g0 = m(T[z.iC0]![j0]!), g1 = m(T[z.iC0]![j1]!), h0 = m(T[z.iC1]![j0]!), h1 = m(T[z.iC1]![j1]!), fwd: V = [-1, 0, 0.2];
      e.name('lampPod').mat(c.paint, c.gloss, 'paint'); e.tri(f0, g0, h0, [0, -sg, 0]); e.tri(f1, g1, h1, [0, sg, 0]);
      e.name('lampPod').mat(c.frame, 0.2); e.face(f0, f1, g1, g0, fwd);
      const Q = (u: number, v: number, lift: number): V => { const p = mix(mix(f0, f1, u), mix(g0, g1, u), v); return [p[0] - lift, p[1], p[2]]; }, [v0, v1, lf] = P.lensV;
      e.name('headlamp').mat(c.lens, 0.7, 'lens'); for (const [u0, u1] of P.lens) e.face(Q(u0, v0, lf), Q(u1, v0, lf), Q(u1, v1, lf), Q(u0, v1, lf), fwd); }); }
}
/** the covers' shut lines while they lie flush */
export function popupTrim(x: Ctx): void {
  const { e, s, c, lamps } = x, z = zones(x); if (lamps >= 0.02) return;
  const r = border(s.TFG, z.iC0, z.iC1, TOP.COVER[0], TOP.COVER[2]); e.name('seam').mat(c.seam, 0.1); e.seam([...r, r[0]!], () => UP)([1, -1]);
}
