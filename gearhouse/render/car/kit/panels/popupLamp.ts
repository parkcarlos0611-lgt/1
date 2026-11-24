// The head lamps. Kind 'popup': the cover lies flush in the front top's slope (cells of the same grid, so its border
// is the well's), hinged about its back edge; `lamps` 0..1 raises it. Under it a dark well; on its front the pod's
// face with the lamps. Kind 'pocket': fixed lamps sunk in the front: the block's border carried down into a scooped pocket
// (shallow at its front edge, deep at its back), the units on a face leaning back under the back edge (flat lenses or
// round projectors), a dark finned ramp down its inner side, a flat glass cover flush with the top (a closure).
// Kind 'fixed': the block itself a lens flush in the skin.
import type { Ctx } from '../ctx';
import { UP } from '../ctx';
import { TOP } from '../section';
import { border } from '../emit';
import { centroid, clamp01, cross, len, lerp, mir, mix, sub, un, type V } from '../geom';
import { zones } from './zones';

export function popupLamp(x: Ctx): void {
  const { e, s, c, k, lamps } = x, P = k.popup, z = zones(x), T = s.TFG, [j0, jh, j1] = P.cols ? [P.cols[0], (P.cols[0] + P.cols[1]) >> 1, P.cols[1]] : TOP.COVER;
  if (P.kind === 'fixed') { e.name('headlamp').mat(c.lens, 0.7, 'lens'); e.cells(T, z.isCover); return; }
  if (P.kind === 'pocket') return pocket(x, j0, j1);
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
function pocket(x: Ctx, j0: number, j1: number): void {
  const { e, s, c, k } = x, P = k.popup, z = zones(x), T = s.TFG, ring = border(T, z.iC0, z.iC1, j0, j1), xa = Math.min(...ring.map(p => p[0])), xb = Math.max(...ring.map(p => p[0])), d0 = P.shallow ?? P.depth;
  const down = (p: V): V => [p[0], p[1], p[2] - lerp(d0, P.depth, clamp01((p[0] - xa) / (xb - xa)))], cen = centroid(ring);
  for (const sg of [1, -1]) { const m = (p: V) => mir(p, sg);
    e.name('lampHousing').mat(c.dark, 0.05); for (let i = 0; i < ring.length; i++) { const p = ring[i]!, q = ring[(i + 1) % ring.length]!; if (len(sub(q, p)) < 0.5) continue; e.face(m(p), m(q), m(down(q)), m(down(p)), mir(sub(cen, mix(p, q, 0.5)), sg)); }
    e.name('lampTray').mat(c.trim, 0.35); e.fan(ring.map(p => m(down(p))), UP);
    e.with('part', () => { const A = T[z.iC0]![j0]!, B = T[z.iC0]![j1]!, D = T[z.iC1]![j0]!, C = T[z.iC1]![j1]!, dep = (u: number) => lerp(d0, P.depth, u), W0 = P.faceFrom ?? 0.7, RV = P.ramp?.share ?? 0.02;
      /** the opening at (u, v), 0..1 from front to back and from the inner edge out, dz from the glass */
      const Q = (u: number, v: number, dz = 0): V => { const q = mix(mix(A, B, v), mix(D, C, v), u); return m([q[0], q[1], q[2] + dz]); };
      /** the units' face at (v across, w up it), set off it by d */
      const F = (v: number, w: number, d = 0): V => { const p = Q(lerp(W0, 0.98, w), v, lerp(-dep(W0) + 3, -7, w)); return [p[0] - d * 0.7, p[1], p[2] + d * 0.7]; }, NF: V = [-1, 0, 0.6];
      const quad = (v0: number, v1: number, w0: number, w1: number, d: number) => e.face(F(v0, w0, d), F(v1, w0, d), F(v1, w1, d), F(v0, w1, d), NF);
      if (P.ramp) { e.name('lampFin').mat(c.frame, 0.15); for (let q = 0; q < 3; q++) e.face(Q(q / 3, 0, -2), Q((q + 1) / 3, 0, -2), Q((q + 1) / 3, RV, -dep((q + 1) / 3) - 2), Q(q / 3, RV, -dep(q / 3) - 2), [0, sg, 1]);
        e.name('lampFin').mat(c.trim, 0.3); for (let q = 0; q < P.ramp.fins; q++) { const u = lerp(0.06, W0, q / Math.max(1, P.ramp.fins - 1)), d = dep(u); e.face(Q(u, 0.02, -3), Q(u + 0.035, 0.02, -3), Q(u + 0.035, RV - 0.02, -d + 4), Q(u, RV - 0.02, -d + 4), [0, sg, 1]); } }
      e.name('lampHousing').mat(c.dark, 0.05); quad(RV, 0.98, 0, 1, 0);
      const [w0, w1, lf] = P.lensV;
      P.lens.forEach(([v0, v1], n) => { if (P.round?.includes(n)) {   // a round projector: a chrome ring, a dark glass lens standing out of it
          const cp = F((v0 + v1) / 2, (w0 + w1) / 2, lf), e1 = un(sub(F(v1, 0.5, lf), F(v0, 0.5, lf))), e2v = sub(F((v0 + v1) / 2, w1, lf), F((v0 + v1) / 2, w0, lf)), e2 = un(e2v), cr = cross(e1, e2), nn: V = cr[0] > 0 ? [-cr[0], -cr[1], -cr[2]] : cr;
          const r0 = Math.min(len(sub(F(v1, 0.5, lf), F(v0, 0.5, lf))), len(e2v)) * 0.5, at = (r: number, t: number, d: number): V => [0, 1, 2].map(q => cp[q]! + e1[q]! * r * Math.cos(t) + e2[q]! * r * Math.sin(t) + nn[q]! * d) as V, N10 = 10;
          e.name('reflector').mat(c.chrome, 0.9, 'metal'); for (let i = 0; i < N10; i++) { const t0 = i / N10 * Math.PI * 2, t1 = (i + 1) / N10 * Math.PI * 2; e.face(at(r0, t0, 0), at(r0, t1, 0), at(r0 * 0.82, t1, 5), at(r0 * 0.82, t0, 5), nn); }
          e.name('headlamp').mat(c.smoke, 0.9, 'lens'); for (let i = 0; i < N10; i++) { const t0 = i / N10 * Math.PI * 2, t1 = (i + 1) / N10 * Math.PI * 2; e.tri(at(0, 0, 12), at(r0 * 0.82, t0, 5), at(r0 * 0.82, t1, 5), nn); } }
        else {   // a fluted unit: a bright reflector, the lens, thin flutes down it
          e.name('reflector').mat(c.silver, 0.75, 'metal'); quad(v0 - 0.02, v1 + 0.02, w0 - 0.08, w1 + 0.08, lf - 2); e.name('headlamp').mat(c.lens, 0.7, 'lens'); quad(v0, v1, w0, w1, lf);
          e.name('reflector').mat(c.metal, 0.6); for (let q = 1; q < 7; q++) { const v = lerp(v0, v1, q / 7); quad(v - 0.006, v + 0.006, w0, w1, lf + 1); } } }); }); }
  e.with('closure', () => { e.name('headCover').mat(c.glass, 0.5, 'glass'); e.cells(T, z.isCover); });
}
/** the covers' shut lines while they lie flush */
export function popupTrim(x: Ctx): void {
  const { e, s, c, lamps } = x, z = zones(x), pc = x.k.popup.cols ?? [TOP.COVER[0], TOP.COVER[2]]; if (lamps >= 0.02 || x.k.popup.kind !== 'popup') return;
  const r = border(s.TFG, z.iC0, z.iC1, pc[0], pc[1]); e.name('seam').mat(c.seam, 0.1); e.seam([...r, r[0]!], () => UP)([1, -1]);
}
