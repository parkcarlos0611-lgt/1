// The cabin panel behind the glass (inside): floor, door cards, the dash under the screen, the tunnel, the wheel
// (on the side the spec puts it), two seats, the bulkhead with its small window; and the engine bay under the rear
// glass, a dark tub for the engine part.
import type { Ctx } from '../ctx';
import { UP } from '../ctx';
import { TOP } from '../section';
import { mir, mix, type V } from '../geom';

export function cabin(x: Ctx): void {
  const { e, s, c, k, L } = x, C = k.cabin, FL = C.floor, xa = L.mx(C.x[0]), xb = L.mx(C.x[1]), yf = L.my(C.floorHalf), Y = L.my, X = L.mx;
  e.name('cockpit').mat(c.dark, 0.05); e.face([xa, -yf, FL], [xb, -yf, FL], [xb, yf, FL], [xa, yf, FL], UP);
  e.name('cockpit').mat(c.trim, 0.1); for (const sg of [1, -1]) { const xs = C.cards.x.map(L.X); for (let q = 0; q + 1 < xs.length; q++) { const p = (px: number): V => [px, s.yK(px) - C.cards.inset[0], s.zK(px) - C.cards.inset[1]], q0 = p(xs[q]!), q1 = p(xs[q + 1]!); e.face([q0[0], sg * q0[1], FL], [q1[0], sg * q1[1], FL], mir(q1, sg), mir(q0, sg), [0, -sg, 0]); } }
  const D = C.dash, yS = L.Y(k.top.screenHalf), crest = (p: V): V => [p[0] + D.reach - D.sweep * (p[1] / yS) ** 2, p[1] * D.narrow, D.z - D.drop * (p[1] / yS) ** 2], sFoot = s.TFG[s.TFG.length - 1]!;
  e.name('cockpit').mat(c.trim, 0.15); for (const sg of [1, -1]) for (let j = 0; j + 1 < TOP.N; j++) { const p = sFoot[j]!, q = sFoot[j + 1]!, lo = (v: V): V => [v[0] + D.foot[0], v[1] * D.foot[1], v[2] - D.foot[2]], c0 = crest(p), c1 = crest(q);
    e.face(mir(lo(p), sg), mir(lo(q), sg), mir(c1, sg), mir(c0, sg), UP); e.face(mir(c0, sg), mir(c1, sg), [c1[0] + D.face[0], sg * c1[1], D.face[1]], [c0[0] + D.face[0], sg * c0[1], D.face[1]], [1, 0, 0.3]); }
  const t = C.tunnel; e.name('cockpit').mat(c.trim, 0.15); e.b.box(X(t[0]), xb, -Y(t[1]), Y(t[1]), FL, t[2]);
  const w = C.wheel, wy = Y(w.y) * w.side; e.name('steering').mat(c.frame, 0.2); e.b.lathe('x', [0, wy, w.z], w.rim.map(([px, r]) => [X(px), r] as [number, number]), 10, false).bar([X(w.column[0][0]), wy, w.column[0][1]], [X(w.column[1][0]), wy, w.column[1][1]], w.column[2]);
  const S = C.seats; for (const sg of [1, -1]) { const y0 = sg * Y(S.y[0]), y1 = sg * Y(S.y[1]), i = sg * S.inset;
    e.name('seat').mat(c.seat, 0.25, 'leather'); e.b.box(X(S.x[0]), X(S.x[1]), Math.min(y0, y1), Math.max(y0, y1), FL, S.cushion).loft(S.back.map(([px, pz]) => [[X(px), y0 + i, FL], [X(px), y1 - i, FL], [X(px), y1 - i, pz], [X(px), y0 + i, pz]] as V[]));
    e.name('seat').mat(c.seat2, 0.1); for (const yy of S.piping.y) { const y = y0 + sg * Y(yy), pc = S.piping.cushion, pb = S.piping.back; e.b.bar([X(pc[0]), y, pc[2]], [X(pc[1]), y, pc[2]], S.piping.w).bar([X(pb[0][0]), y, pb[0][1]], [X(pb[1][0]), y, pb[1][1]], S.piping.w); } }
  // the bulkhead under the rear glass's front edge, a small upright window in it
  const B = C.bulkhead, xw = xb + B.dx, g0 = s.RGX[0]!, g1 = s.RGX[1]!, sec = [...[0, ...k.top.shares].slice(0, TOP.N - 1).map(sh => mix(s.glassPt(g0, sh), s.glassPt(g1, sh), B.at)), ...s.upper(xw)].map(p => [xw, p[1] * B.inset[0], p[2] - B.inset[1]] as V);
  const n5 = B.col, wyb = sec[n5]![1], [wz0, wz1] = B.window;
  e.name('bulkhead').mat(c.dark, 0.08); for (const sg of [1, -1]) { for (let j = 0; j < n5; j++) e.face(mir(sec[j]!, sg), mir(sec[j + 1]!, sg), [xw, sg * sec[j + 1]![1], wz1], [xw, sg * sec[j]![1], wz1], [1, 0, 0]);
    const out = [...sec.slice(n5), [xw, sec[sec.length - 1]![1], FL] as V, [xw, wyb, FL] as V]; for (let j = 0; j + 1 < out.length; j++) e.tri([xw, sg * wyb, B.hub], mir(out[j]!, sg), mir(out[j + 1]!, sg), [1, 0, 0]); }
  e.face([xw, -wyb, FL], [xw, wyb, FL], [xw, wyb, wz0], [xw, -wyb, wz0], [1, 0, 0]);
  if (B.shelf) { e.name('bulkhead').mat(c.trim, 0.1); e.face([xw, -wyb, wz0], [xw, wyb, wz0], [xw + B.shelf, wyb, wz0], [xw + B.shelf, -wyb, wz0], UP); }
  e.name('cabinPane').mat(c.glass, 0.5, 'glass'); e.face([xw, -wyb, wz0], [xw, wyb, wz0], [xw, wyb, wz1], [xw, -wyb, wz1], [1, 0, 0]);
}
/** the engine bay: a dark tub under the rear glass (floor, front wall, the sides stepping out to the deck's edge) */
export function engineBay(x: Ctx): void {
  const { e, c, k, L } = x, B = k.bay; if (!B) return; const x0 = L.mx(B.x[0]), x1 = L.mx(B.x[1]), yb = L.my(B.y[0]), yt = L.my(B.y[1]), [zf, zs, zt] = B.z;
  e.name('engineBay').mat(c.dark, 0.05); e.face([x0, -yb, zf], [x1, -yb, zf], [x1, yb, zf], [x0, yb, zf], UP); e.face([x1, -yb, zf], [x1, yb, zf], [x1, yb, zs], [x1, -yb, zs], [-1, 0, 0]); e.face([x1, -yb, zs], [x1, yb, zs], [x1, yt, zt], [x1, -yt, zt], [-1, 0, 0]);
  for (const sg of [1, -1]) { e.face([x0, sg * yb, zf], [x1, sg * yb, zf], [x1, sg * yb, zs], [x0, sg * yb, zs], [0, -sg, 0]); e.face([x0, sg * yb, zs], [x1, sg * yb, zs], [x1, sg * yt, zt], [x0, sg * yt, zt], [0, -sg, 0.5]); }
}
