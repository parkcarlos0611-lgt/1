// The drivetrain (docs/systems/101, part 1-3): the clutch housing on the engine's flange, the gearbox, the
// differential, the driveshafts with their joints out to the wheels' hubs; with all-wheel drive a centre differential
// on the gearbox, a propeller shaft forward down the tunnel and a front differential with its own shafts.
//   an engine along the car   a transaxle behind it: clutch housing, the differential just behind it on the axle's
//                             line, the gears behind that (the F355's, the EB110's)
//   an engine across the car  the gearbox on the crank's end, the final drive behind it on the axle's line, one
//                             shaft short and one long (the NSX's); or, for an engine too long for that, the gearbox
//                             behind the engine under the crank with the differential in its middle (the Miura's)
// Built in the engine's frame at full size (u along the crank from the flange, v across, w up), carried into the car.
import { add, clamp, mix, mul, norm, rsec, sub, type V } from './geo';
import { floorAt, type Ctx } from './layout';

const CASE = '#a2a5a9', CASE2 = '#8e9195', STEEL = '#6e7176', DARK = '#2a2b2e', RUBBER = '#161618';

export function drivetrain(x: Ctx): void {
  const { g, S, site, det, E, o, U, Vx, long } = x, B = E.B, R = 1.5 * B * x.scale, seg = det === 2 ? 10 : det === 1 ? 8 : 6, wr = site.wheels.r, wf = site.wheels.f;
  g.frame(x.T1);
  const hubW = wr.z - o[2];                                           // the axle's height in the engine's frame
  const behind = !long && !!S.gearboxBehind, bell = long ? 140 : 100, Lg = (long ? 290 : 230) + (S.gears === 6 ? 40 : 0);
  // ---- the clutch housing: a bell from the flange down to the gearbox's face ----
  if (!behind) g.part('clutchHousing', CASE, 0.35, 'metal').lathe([0, 0, 0.05 * B * x.scale], [-1, 0, 0], [[0, R], [10, R], [12, R * 0.94], [bell * 0.75, 112], [bell, 104]], seg, false);
  // ---- the gearbox: a ribbed case, its end cover, the change on top ----
  // (the case is lifted over the crank's line where the underbody rises under its end: a tail's diffuser)
  const hh = 114, endX = o[0] + Math.abs(U[0]) * -U[0] * (bell + Lg + 34), gw = long ? clamp(floorAt(site, endX) + 14 + hh - o[2], -12, 45) : -12, sec = (k = 1) => rsec(104 * k, hh * k, det === 0 ? 6 : 8, 3.2);
  let g0: V, g1: V, dc: V;                                             // the case's ends, the differential's centre
  if (behind) { const vg = (1.15 * B + 118) * Math.sign((wr.x - o[0]) * Vx[0] || 1), len = Math.max(E.Lb, 420); g0 = [20, vg, -0.55 * B]; g1 = [len, vg, -0.55 * B]; dc = [(20 + len) / 2, vg * 1.55, clamp(hubW, -1.6 * B, 0)];
    g.part('clutchHousing', CASE, 0.35, 'metal').prism([-58, vg / 2, -0.3 * B], [2, vg / 2, -0.3 * B], rsec(Math.abs(vg) / 2 + 110, 1.45 * B, 8, 3), [0, 0, 1]); }
  else { g0 = [-bell, 0, gw]; g1 = [-bell - Lg, 0, gw];
    dc = long ? [-112, 0, clamp(hubW, -70, 10)] : [-66, clamp((wr.x - o[0]) * Vx[0], -360, 360), clamp(hubW, -150, 40)]; }
  const ga = norm(sub(g1, g0));
  g.part('gearbox', CASE, 0.35, 'metal').prism(g0, g1, sec(), [0, 0, 1]);
  if (det > 0) { g.part('gearbox', CASE2, 0.3, 'metal'); const n = det === 2 ? 3 : 2; for (let k = 0; k < n; k++) { const c = mix(g0, g1, (k + 0.6) / (n + 0.2)); g.prism(add(c, mul(ga, -5)), add(c, mul(ga, 5)), sec(1.07), [0, 0, 1], false); } }
  const cover = add(g1, mul(ga, det === 0 ? 20 : 34));
  g.part('gearbox', CASE2, 0.3, 'metal').prism(g1, cover, rsec(78, 88, det === 0 ? 6 : 8, 3), [0, 0, 1], 'b');
  x.out.gearboxEnd = x.T1(cover); x.out.gearboxTop = o[2] + gw + hh;
  if (det > 0) { const top = add(mix(g0, g1, 0.45), [0, 0, hh]);
    if (S.gearbox === 'f1') { g.part('shiftActuator', DARK, 0.4).obox(add(top, [0, 0, 22]), ga, 70, [0, 0, 1], 22, norm([ga[1], -ga[0], 0]), 45);
      g.part('shiftActuator', '#b08a3c', 0.6, 'metal').lathe(add(top, [0, 0, 44]), [0, 0, 1], [[0, 20], [10, 34], [50, 34], [60, 18]], 6, true, ga); }
    else { g.part('shiftLinkage', DARK, 0.3).obox(add(top, [0, 0, 10]), ga, 40, [0, 0, 1], 10, norm([ga[1], -ga[0], 0]), 30);
      // the rod: from the gearbox's top up over the engine and forward into the tunnel
      if (det === 2 && site.cabin) { g.frame(null); const a = x.T1(add(top, [0, 0, 20])), tun = site.cabin.tunnel, zt = tun ? tun[2] - 45 : site.cabin.floor + 120, end: V = [site.cabin.x[1] - 150, 0, zt];
        const side = Math.sign(a[1] - (x.eb.min[1] + x.eb.max[1]) / 2) || 1, by = long ? side * (Math.max(-x.eb.min[1], x.eb.max[1]) + 30) : a[1], hi = long ? a[2] : Math.max(a[2], zt);
        g.part('shiftLinkage', STEEL, 0.6, 'metal').tube(long ? [a, [a[0] - 60, by, hi], [x.eb.min[0] - 20, by, hi], [site.cabin.x[1] + 10, 0, zt], end] : [a, [x.eb.min[0] - 20, a[1], hi], [site.cabin.x[1] + 10, 0, zt], end], 9, 4); g.frame(x.T1); } } }
  // ---- the differential: a round housing across the car on the axle's line, its flanges; the final drive's case joining it to the gearbox ----
  const yAx: V = long ? [0, 1, 0] : [1, 0, 0];                         // the car's y in the engine's frame (either way round: the housing is the same both ways)
  if (!long) g.part('gearbox', CASE, 0.35, 'metal').prism(behind ? [dc[0], g0[1], g0[2]] : [dc[0], 0, gw - 20], dc, rsec(74, 86, det === 0 ? 6 : 8, 3), [1, 0, 0], false);
  const dr = S.lsd ? 100 : 90, dh = 105, dseg = det === 0 ? 6 : 8;
  g.part('differential', CASE2, 0.35, 'metal').lathe(sub(dc, mul(yAx, dh)), yAx, [[0, dr * 0.55], [22, dr], [2 * dh - 22, dr], [2 * dh, dr * 0.55]], dseg, true, [0, 0, 1]);
  if (S.lsd && det > 0) { g.part('differential', CASE, 0.3, 'metal'); for (const k of det === 2 ? [-0.45, 0, 0.45] : [0]) g.lathe(add(dc, mul(yAx, k * dh - 4)), yAx, [[0, dr + 9], [8, dr + 9]], dseg, false, [0, 0, 1]); }   // a limited-slip unit's finned housing
  g.frame(null);
  // ---- the driveshafts: from the differential's flanges to the hubs, a joint and its boot at each end ----
  const shaft = (from: V, to: V, front: boolean) => { const d = norm(sub(to, from)), L = Math.hypot(...sub(to, from)), at = (k: number) => add(from, mul(d, k)); x.out.shafts.push({ from, to, front });
    g.part('driveshaft', STEEL, 0.6, 'metal').cyl(at(40), at(L - 40), det === 0 ? 18 : 14, det === 2 ? 6 : 4, false);
    if (det === 0) return;
    for (const [a, b] of [[0, 62], [L, L - 62]] as const) { g.part('cvJoint', '#55585d', 0.5, 'metal').lathe(at(a), mul(d, Math.sign(b - a)), [[0, 46], [38, 44]], 6, 'a');
      if (det === 2) g.part('cvBoot', RUBBER, 0.12).lathe(at(a + Math.sign(b - a) * 40), mul(d, Math.sign(b - a)), det === 2 ? [[0, 40], [18, 28], [46, 16]] : [[0, 38], [46, 16]], 6, false); } };
  const dC = x.T1(dc), hub = (w: typeof wr, s: number): V => [w.x, s * (w.y - w.w / 2 - 12), w.z];
  for (const s of [1, -1]) shaft([dC[0], dC[1] + s * (dh + 4), dC[2]], hub(wr, s), false);
  // a long shaft's steady bearing on the block (the differential off the centre line)
  if (!long && det === 2 && Math.abs(dC[1]) > 120) { const s = -Math.sign(dC[1]), a: V = [dC[0], dC[1] + s * (dh + 4), dC[2]], h = hub(wr, s), m = mix(a, h, 0.42); g.part('shaftBearing', CASE2, 0.3, 'metal').lathe(add(m, [0, -16, 0]), [0, 1, 0], [[0, 30], [32, 30]], 8, false).bar(add(m, [0, 0, 30]), add(m, [-(wr.x - o[0]) * 0.35, 0, 70]), 26, 14); }
  if (!S.awd) return;
  // ---- all-wheel drive: the centre differential on the gearbox's side, the shaft forward beside (or under) the engine and down the tunnel, the front differential ----
  const tun = site.cabin?.tunnel, zt = site.cabin ? Math.min(tun ? tun[2] - 50 : site.cabin.floor + 110, wf.r + 20) : wf.r, xc = site.cabin ? site.cabin.x[1] - 40 : x.eb.min[0] - 200, fd: V = [wf.x, 0, wf.z];
  let p0: V, path: V[];
  if (long) { const v = 1.4 * B, w = -1.2 * B; p0 = x.T1([-bell - 60, v, w]);
    g.frame(x.T1).part('centreDiff', CASE2, 0.35, 'metal').lathe([-bell - 150, v * 0.92, w], [1, 0, 0], [[0, 40], [14, 74], [104, 74], [128, 46], [150, 30]], det === 2 ? 8 : 6, true); g.frame(null);
    const p1 = x.T1([(E.ue + 80) / 1, v, w]); path = [p0, p1, [Math.min(p1[0] - 120, xc), 0, zt]]; }
  else { const zl = Math.max(site.foot + 50, Math.min(dC[2] - 40, o[2] + E.floor * x.scale - 40)); p0 = [dC[0] - 150, dC[1], zl];
    g.part('centreDiff', CASE2, 0.35, 'metal').lathe([dC[0] - 40, dC[1], (dC[2] + zl) / 2], [-1, 0, 0], [[0, 60], [30, 76], [90, 70], [112, 34]], det === 2 ? 8 : 6, true, [0, 0, 1], 1.25);
    path = [p0, [x.eb.min[0] - 60, dC[1], zl], [Math.min(x.eb.min[0] - 220, xc), 0, zt]]; }
  path.push([fd[0] + 190, 0, fd[2] + (zt - fd[2]) * 0.15]);
  g.part('propShaft', STEEL, 0.6, 'metal').tube(path, det === 0 ? 20 : 17, det === 2 ? 6 : 4);
  if (det > 0) { g.part('propJoint', '#55585d', 0.5, 'metal'); for (let i = 0; i < path.length; i++) { const p = path[i]!, d = norm(i + 1 < path.length ? sub(path[i + 1]!, p) : sub(p, path[i - 1]!)); if (i === 0 || i === path.length - 1 || det === 2) g.lathe(sub(p, mul(d, 26)), d, [[0, 30], [52, 30]], 5, true); } }
  g.part('frontDifferential', CASE2, 0.35, 'metal').lathe([fd[0], -80, fd[2]], [0, 1, 0], [[0, 44], [20, 78], [140, 78], [160, 44]], det === 2 ? 8 : 6, true)
    .lathe([fd[0] + 60, 0, fd[2] + 4], [1, 0, 0], [[0, 60], [70, 48], [112, 34]], det === 2 ? 8 : 6, 'b');
  for (const s of [1, -1]) shaft([fd[0], s * 84, fd[2]], hub(wf, s), true);
}
