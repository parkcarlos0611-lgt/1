// The road wheel: the tyre and the rim's lip (every kind), then the face by kind:
//   'fiveSpoke'  a cast face of broad spokes (the openings between them dark, laid on the face), a cap with nuts
//   'disc'       a dished plate with round vents, a cap with nuts
//   'star'       separate spokes over a deep dark well (a brake disc in it): broad where their roots meet round the hub,
//                waisted, running out to the rim; each has a top face and two flanks, so the wheel has real depth
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
  if (Wk.kind !== 'star') { e.name('wheel').mat(c.metal, Wk.faceGloss, 'metal'); e.b.lathe('y', o, [[yo, r1], [lerp(yi, yo, Wk.faceMid), rm], [yi, rc], [yi + s * 4, rh]], 15, false); }
  const n = Wk.spokes, a0 = (k: number) => spin + (k / n + Wk.phase) * Math.PI * 2;
  if (Wk.kind === 'fiveSpoke') { const O = Wk.openings; e.name('wheel').mat(c.dark, 0.05);
    for (let k = 0; k < n; k++) { const a = a0(k), P = (r: number, da: number): V => [w.x + Math.cos(a + da) * r, yAt(r) + s * O.lift, R + Math.sin(a + da) * r], ro = r1 - O.rim;
      e.fan([P(O.r[0], 0), P(O.r[1], -O.a[0]), P(ro - O.r[2], -O.a[1]), P(ro, -O.a[2]), P(ro, 0), P(ro, O.a[2]), P(ro - O.r[2], O.a[1]), P(O.r[1], O.a[0])], [0, s, 0]); } }
  else if (Wk.kind === 'disc') { const H = Wk.vents; e.name('wheel').mat(c.dark, 0.05);
    for (let k = 0; k < n; k++) { const a = a0(k), cx = w.x + Math.cos(a) * H.r, cz = R + Math.sin(a) * H.r, yy = yAt(H.r) + s * H.lift;
      e.fan(Array.from({ length: H.seg }, (_, q) => { const b = q / H.seg * Math.PI * 2; return [cx + Math.cos(b) * H.size, yy, cz + Math.sin(b) * H.size] as V; }), [0, s, 0]); } }
  else if (Wk.kind === 'star') { const S = Wk.star; if (!S) throw new Error('kit: the star wheel needs its spokes'); const yw = yo - s * S.well, cy = s * w.y, out: V = [0, s, 0];
    const pt = (r: number, a: number, y: number): V => [w.x + Math.cos(a) * r, cy + y, R + Math.sin(a) * r], ring = (r: number, y: number, m: number) => Array.from({ length: m }, (_, q) => pt(r, q / m * Math.PI * 2, y));
    // the well: the barrel from the lip in, its dark floor, the brake disc
    e.name('rim').mat(c.silver, 0.5, 'metal'); e.b.lathe('y', o, [[yo, r1], [yw, r1 - 6]], seg, false);
    e.name('wheel').mat(c.dark, 0.05); e.fan(ring(r1 - 6, yw, 12), out);
    if (S.brake > 0) { e.name('wheel').mat(c.silver, 0.6, 'metal'); e.fan(ring(S.brake, yw + s * 6, 12), out); }
    // the spokes: roots meeting round the hub, a waist, the run out to the rim; then the hub's boss over the roots
    const [r0, rw] = S.r, [aw, ar] = S.a, ah = Math.PI / n, yT = (r: number) => lerp(yi, yo, clamp01((r - rc) / (r1 - rc)) ** 1.5);
    for (let q = 0; q < n; q++) { const a = a0(q), top = (r: number, da: number) => pt(r, a + da, yT(r)), low = (r: number, da: number) => pt(r, a + da * 1.25, yT(r) - s * S.thick);
      const A = [top(r0, -ah), top(rw, -aw), top(r1, -ar)], B = [top(r0, ah), top(rw, aw), top(r1, ar)], LA = [low(r0, -ah), low(rw, -aw), low(r1, -ar)], LB = [low(r0, ah), low(rw, aw), low(r1, ar)];
      e.name('wheel').mat(c.metal, Wk.faceGloss, 'metal'); for (let t = 0; t < 2; t++) e.face(A[t]!, A[t + 1]!, B[t + 1]!, B[t]!, out);
      e.mat(c.silver, 0.3, 'metal'); for (let t = 0; t < 2; t++) { const m = pt((t ? rw + r1 : r0 + rw) / 2, a, 0); e.face(A[t]!, A[t + 1]!, LA[t + 1]!, LA[t]!, [A[t]![0] - m[0], 0, A[t]![2] - m[2]]); e.face(B[t]!, B[t + 1]!, LB[t + 1]!, LB[t]!, [B[t]![0] - m[0], 0, B[t]![2] - m[2]]); } }
    e.name('wheel').mat(c.metal, Wk.faceGloss, 'metal'); e.fan(Array.from({ length: n }, (_, q) => pt(r0, a0(q) + ah, yT(r0))), out); }
  else throw new Error(`kit: wheel kind ${Wk.kind} is not built yet`);
  const H = Wk.hub; e.name('hub').mat(c.silver, 0.7, 'metal'); e.disc([w.x, s * w.y + yi + s * H.cap[0], R], H.cap[1], H.cap[2]);
  e.name('hub').mat(c.frame, 0.4); for (let k = 0; k < H.nuts; k++) { const a = spin + (k / H.nuts + Wk.phase) * Math.PI * 2; e.disc([w.x + Math.cos(a) * H.nut[0], s * w.y + yi + s * H.nut[1], R + Math.sin(a) * H.nut[0]], H.nut[2], H.nut[3]); }
}
