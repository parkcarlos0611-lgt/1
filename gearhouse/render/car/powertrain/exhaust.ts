// The exhaust (docs/systems/101, 1-2 item 3 and part 1-3): from where the gas leaves each bank (or its turbos) through a
// catalyst and a middle pipe to one silencer across the tail, and from it a tail pipe into each of the body's own
// tips, so the pipes end where the body's exhausts are.
//   an engine along the car   a pipe each side back beside the gearbox, a catalyst in each
//   an engine across the car  the front bank's pipe down and back under the sump, the rear bank's down behind it, the
//                             two catalysts side by side behind the axle
// The silencer lies across the tail when there is room behind the gearbox before the tips; where the gearbox reaches
// the tail there is a can each side of it instead, each with its side's tail pipes.
import { add, bendPath, clamp, rsec, type V } from './geo';
import { floorOver, type Ctx } from './layout';

const PIPE = '#9a9da1', CAT = '#b9b2a0', MUFF = '#8f9296', HOT = '#6f5f53';

export function exhaust(x: Ctx): void {
  const { g, site, det, E, o, long } = x, wr = site.wheels.r, ps = det === 2 ? 6 : det === 1 ? 5 : 4, n = det === 2 ? 4 : det === 1 ? 3 : 1;
  const T = site.tips ?? { x: site.length - 110, z: site.foot + 150, y: [-300, 300], r: 34 }, tipY = Math.max(...T.y.map(Math.abs));
  const outs = E.outlets.map(q => { const p = x.T(q.p), e = x.T(add(q.p, q.d)); return { p, d: [e[0] - p[0], e[1] - p[1], e[2] - p[2]] as V, r: clamp(q.r * x.scale, 20, 32) }; });
  if (!outs.length) return;
  // ---- the silencer's place: across the tail behind everything when there is room before the tips; else (a gearbox
  //      reaching the tail) a can each side of the gearbox ----
  const gbEnd = x.out.gearboxEnd[0], catR = 56, zUnder = clamp(o[2] + E.floor * x.scale - 42, site.foot + 48, wr.z - 60);
  const catX = long ? o[0] + 150 : wr.x + 120, across = T.x - 30 - (long ? gbEnd : catX + 190) >= 150, catL = across || !long ? 190 : clamp(T.x - catX - 420, 110, 190);
  const tr = Math.max(14, T.r - 3), tail = (from: V, y: number, ta: V = [1, 0, 0]) => { const end: V = [T.x + 10, y, T.z];
    g.part('tailpipe', PIPE, 0.6, 'metal').bend(from, ta, end, [1, 0, 0], tr, ps, ta[1] ? n + 1 : Math.abs(from[1] - y) + Math.abs(from[2] - T.z) < 12 ? 1 : Math.max(2, n - 1), 0.5); x.out.tails.push(end); };
  const can = (c: V, ax: V, half: number, ha: number, hz: number) => { const side: V = [ax[1], ax[0], 0], ring = (t: number, k: number): V[] => rsec(ha * k, hz * k, det === 0 ? 6 : half > 190 ? 10 : 8, 2.8).map(([a, b]) => [c[0] + ax[0] * t + side[0] * a, c[1] + ax[1] * t + side[1] * a, c[2] + b] as V);
    g.part('muffler', MUFF, 0.55, 'metal').loft(det === 0 ? [ring(-half, 1), ring(half, 1)] : [ring(-half, 0.72), ring(-half + 30, 1), ring(half - 30, 1), ring(half, 0.72)], true);
    if (det === 2) { g.part('muffler', '#7c7f84', 0.45, 'metal'); if (half > 190) for (const k of [-0.5, 0.5]) g.loft([ring(k * half - 5, 1.03), ring(k * half + 5, 1.03)], false); } };
  let into: (sy: number, y: number) => { p: V; d: V };
  if (across) { const room = T.x - 30 - (long ? gbEnd : catX + catL), hx = clamp(room / 2 - 15, 55, 78), fl = floorOver(site, T.x - 60 - 2 * hx, T.x - 60), hz = clamp(T.z + 20 - fl - 12, 50, 66), mc: V = [T.x - 60 - hx, 0, Math.max(T.z + 20, fl + hz + 12)];
    // a can of a real silencer's size (to 640 mm long); tips further out than its ends are reached by pipes out of its ends, turned back to the tail
    const Ym = clamp(tipY - 70, 200, 320);
    can(mc, [0, 1, 0], Ym, hx, hz); for (const y of T.y) { if (Math.abs(y) <= Ym - 40) tail([mc[0] + hx * 0.7, y, mc[2]], y); else tail([mc[0], Math.sign(y) * (Ym - 8), mc[2]], y, [0.15, Math.sign(y), 0]); }
    into = (sy, y) => ({ p: [mc[0] - hx * 0.9, sy * Math.min(Math.abs(y), Ym - 70), mc[2]], d: [1, 0, 0] }); }
  else { const x0 = catX + catL + 100, x1 = T.x - 35, cy = (s: number) => { const ys = T.y.filter(y => (y >= 0 ? 1 : -1) === s).map(Math.abs); return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : tipY; };
    for (const s of [1, -1]) { const yc = Math.max(cy(s), 104 + 80 + 14), ha = Math.min(88, yc - 104 - 12), fl = floorOver(site, x0, x1), hz = clamp(T.z - fl - 12, 50, 70), c: V = [(x0 + x1) / 2, s * yc, Math.max(T.z, fl + hz + 12)];
      can(c, [1, 0, 0], (x1 - x0) / 2, ha, hz); for (const y of T.y) if ((y >= 0 ? 1 : -1) === s) tail([x1 - 14, y, c[2]], y); }
    into = (sy) => { const s = sy >= 0 ? 1 : -1; return { p: [x0 + 12, s * Math.max(cy(s), 104 + 80 + 14), Math.max(T.z, floorOver(site, x0, x1) + clamp(T.z - floorOver(site, x0, x1) - 12, 50, 70) + 12)], d: [1, 0, 0] }; }; }
  // ---- each stream: the pipe from the engine, the catalyst, the middle pipe into the silencer ----
  outs.forEach((q, k) => { const sy = outs.length === 1 ? (across ? 0 : 1) : long && Math.abs(q.p[1]) > 40 ? Math.sign(q.p[1]) : k === 0 ? 1 : -1;
    let a: V, pre: V[];
    if (long) { const y = sy * Math.max(Math.abs(q.p[1]), 104 + catR + 24); a = [catX, y, clamp(q.p[2], floorOver(site, catX, catX + catL) + catR + 14, Math.max(floorOver(site, catX, catX + catL) + catR + 14, x.out.gearboxTop - 40))]; pre = bendPath(q.p, q.d, a, [1, 0, 0], n, 0.45); }
    else { const y = (x.eb.min[1] + x.eb.max[1]) / 2 * 0.3 + sy * (catR + 22); a = [catX, y, zUnder];
      pre = q.p[0] < o[0] ? [...bendPath(q.p, q.d, [o[0] - 150, y, zUnder], [1, 0, 0], n, 0.5), a] : bendPath(q.p, q.d, a, [1, 0, 0], n, 0.5); }
    g.part('exhaustPipe', HOT, 0.4, 'metal').tube(pre, q.r, ps);
    g.part('catalyst', CAT, 0.45, 'metal').lathe(a, [1, 0, 0], [[0, q.r], [26, catR], [catL - 26, catR], [catL, q.r]], det === 2 ? 8 : 6, false, [0, 0, 1], 0.86);
    if (det === 2) g.part('catalyst', '#8a8474', 0.3, 'metal').lathe(add(a, [catL * 0.3, 0, 0]), [1, 0, 0], [[0, catR + 3], [catL * 0.4, catR + 3]], 8, false, [0, 0, 1], 0.86);   // its heat shield's band
    const m = into(sy, a[1]); g.part('exhaustPipe', PIPE, 0.55, 'metal').bend([a[0] + catL, a[1], a[2]], [1, 0, 0], m.p, m.d, q.r, ps, n, 0.45); });
}
