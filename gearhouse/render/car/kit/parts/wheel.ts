// The road wheel: the tyre and the rim's lip (every kind), then the face by kind:
//   'fiveSpoke'  a cast face of broad spokes (the openings between them dark, laid on the face), a cap with nuts
//   'disc'       a dished plate with round vents, a cap with nuts
//   'star'       a deep dark dish with tapering spokes standing proud of it (each a ridged top and two side walls), wide
//                at the hub and flaring again at the rim, a cap with nuts
// Only tyre/rim/wheel/hub-named parts, so the renderer turns them with the wheel.
import type { Ctx } from '../ctx';
import { clamp01, lerp, type V } from '../geom';
import type { Wheel } from '../lines';
import type { WheelLook } from '../spec';

export function wheel(x: Ctx, w: Wheel, s: 1 | -1, front: boolean, look: WheelLook): void {
  const { e, c, spin } = x, Wk = look, R = w.r, o: V = [w.x, s * w.y, R], rim = w.rim, f = s * w.w / 2, T = Wk.tyre, seg = Wk.seg;
  e.name(front ? 'tyreF' : 'tyreR').mat(c.rubber, 0.05, 'tyre'); e.b.lathe('y', o, [[-f, R - T.shoulder], [-f * T.tread, R], [f * T.tread, R], [f * T.bulge, R - T.roll], [f, R - T.shoulder], [f, rim]], seg, false);
  e.name('rim').mat(c.silver, 0.8, 'metal'); e.b.lathe('y', o, [[f, rim + Wk.lip[0]], [f - s * Wk.lip[1], rim - Wk.lip[2]], [f - s * Wk.lip[3], rim - Wk.lip[4]]], seg, false);
  e.name('wheel').mat(c.dark, 0.05); e.disc([w.x, s * w.y - f * Wk.back[0], R], R - Wk.back[1], Wk.back[2]);
  const yo = f - s * Wk.lip[3], yi = f - s * (front ? Wk.dish.f : Wk.dish.r), r1 = rim - Wk.lip[4], [rc, rm, rh] = Wk.face, yAt = (r: number) => s * w.y + lerp(yi, yo, clamp01((r - rc) / (r1 - rc)));
  if (Wk.kind === 'star') e.name('wheel').mat(c.dark, 0.1); else e.name('wheel').mat(c.metal, Wk.faceGloss, 'metal'); e.b.lathe('y', o, [[yo, r1], [lerp(yi, yo, Wk.faceMid), rm], [yi, rc], [yi + s * 4, rh]], 15, false);
  const n = Wk.spokes, a0 = (k: number) => spin + (k / n + Wk.phase) * Math.PI * 2;
  if (Wk.kind === 'fiveSpoke') { const O = Wk.openings; e.name('wheel').mat(c.dark, 0.05);
    for (let k = 0; k < n; k++) { const a = a0(k), P = (r: number, da: number): V => [w.x + Math.cos(a + da) * r, yAt(r) + s * O.lift, R + Math.sin(a + da) * r], ro = r1 - O.rim;
      e.fan([P(O.r[0], 0), P(O.r[1], -O.a[0]), P(ro - O.r[2], -O.a[1]), P(ro, -O.a[2]), P(ro, 0), P(ro, O.a[2]), P(ro - O.r[2], O.a[1]), P(O.r[1], O.a[0])], [0, s, 0]); } }
  else if (Wk.kind === 'disc') { const H = Wk.vents; e.name('wheel').mat(c.dark, 0.05);
    for (let k = 0; k < n; k++) { const a = a0(k), cx = w.x + Math.cos(a) * H.r, cz = R + Math.sin(a) * H.r, yy = yAt(H.r) + s * H.lift;
      e.fan(Array.from({ length: H.seg }, (_, q) => { const b = q / H.seg * Math.PI * 2; return [cx + Math.cos(b) * H.size, yy, cz + Math.sin(b) * H.size] as V; }), [0, s, 0]); } }
  else if (Wk.kind === 'star') { const S = Wk.star; if (!S) throw new Error('kit: the star wheel needs its spokes'); e.name('wheel').mat(c.metal, Wk.faceGloss, 'metal');
    const r0 = Wk.hub.cap[1] - 6, r2 = r1 - 3, rr = [r0, S.mid, r2];
    for (let k = 0; k < n; k++) { const a = a0(k), P = (r: number, da: number, up: number): V => [w.x + Math.cos(a + da) * r, yAt(r) + s * up, R + Math.sin(a + da) * r];
      const C = rr.map((r, q) => P(r, 0, S.proud + S.ridge * (q < 2 ? 1 : 0.3)));
      for (const sd of [-1, 1]) { const E = rr.map((r, q) => P(r, sd * S.a[q]!, S.proud)), B = rr.map((r, q) => P(r, sd * S.a[q]!, 0)), out: V = [-Math.sin(a) * sd, 0, Math.cos(a) * sd];
        for (let q = 0; q < 2; q++) { e.face(E[q]!, E[q + 1]!, C[q + 1]!, C[q]!, [0, s, 0]); e.face(E[q]!, E[q + 1]!, B[q + 1]!, B[q]!, out); } } } }
  else throw new Error(`kit: wheel kind ${Wk.kind} is not built yet`);
  const H = Wk.hub; e.name('hub').mat(c.silver, 0.7, 'metal'); e.disc([w.x, s * w.y + yi + s * H.cap[0], R], H.cap[1], H.cap[2]);
  e.name('hub').mat(c.frame, 0.4); for (let k = 0; k < H.nuts; k++) { const a = spin + (k / H.nuts + Wk.phase) * Math.PI * 2; e.disc([w.x + Math.cos(a) * H.nut[0], s * w.y + yi + s * H.nut[1], R + Math.sin(a) * H.nut[0]], H.nut[2], H.nut[3]); }
}
