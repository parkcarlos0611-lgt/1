// Underside plan view (looking up from the ground), x = along car from front bumper, y = lateral (mm).
import { Pix, Mask, line } from '../pix.mjs';
import { fillet } from './geom.mjs';
import { outlineAll } from './props.mjs';
import { dith } from './car.mjs';
import { tire } from './tire.mjs';

export function buildUnderbody(P, u, mm = 12.5) {
  const pad = 4, w = Math.ceil(u.len / mm) + pad * 2, h = Math.ceil(u.width / mm) + pad * 2, px = new Pix(w, h);
  const X = x => x / mm + pad, Y = y => h / 2 + y / mm, M = () => new Mask(w, h);
  const poly = (pts, r = 0) => M().poly(fillet(pts.map(p => [p[0], p[1], p[2] ?? r]), 3).map(([x, y]) => [X(x), Y(y)]));
  const rect = (x0, y0, x1, y1, r = 0) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], r);
  const ell = (x, y, rx, ry) => M().ellipse(X(x), Y(y), rx / mm, ry / mm);
  let tag = 20;
  const solid = (m, ramp, { base = 2, axis = 'y', grad = null } = {}) => { const t = tag++, r = P.id(ramp), bb = m.bbox();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!m.get(x, y)) continue; let lv = base;
      if (grad) { const t2 = axis === 'y' ? (y - bb.y0) / Math.max(1, bb.y1 - bb.y0) : (x - bb.x0) / Math.max(1, bb.x1 - bb.x0); lv = dith(x, y, grad[0] + (grad[1] - grad[0]) * Math.abs(t2 - 0.5) * 2); }
      else { if (!m.get(x, y - 1) || !m.get(x - 1, y)) lv = Math.min(4, lv + 1); else if (!m.get(x, y + 1) || !m.get(x + 1, y)) lv = Math.max(0, lv - 1); }
      px.set(x, y, r, lv, t); } };
  const band = (pts, th, ramp, base = 2) => { const m = M(), rr = Math.max(0.6, th / mm / 2); for (let i = 0; i + 1 < pts.length; i++) line(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]), (x, y) => m.circle(x + 0.5, y + 0.5, rr)); solid(m, ramp, { base }); };
  const mir = f => { f(1); f(-1); };
  const T = tire(u.tire), tw = T.section * 1.2, tr = u.track / 2;
  // body floor & running boards & fenders (furthest from viewer, drawn first)
  solid(poly(u.floor, 60), 'floor', { grad: [2.2, 1.2] });
  for (let k = 3; k < 12; k++) { const x = u.floor[0][0] + k * 240; band([[x, -580], [x, 580]], 20, 'floor', 1); } // floor ribs / boards
  mir(sg => { for (const f of u.fenders) solid(poly(f.map(([x, y]) => [x, sg * y]), 120), 'black', { grad: [2.4, 0.8], axis: 'y' }); solid(rect(u.board[0], sg * u.board[1], u.board[2], sg * u.board[3]), 'rubber', { base: 1 }); });
  // exhaust + muffler
  band(u.exhaust, 45, 'rust', 1); solid(rect(...u.muffler, 40), 'rust', { grad: [2.6, 1.2] });
  // frame rails (tapered) + crossmembers
  mir(sg => band(u.rail.map(([x, y]) => [x, sg * y]), 75, 'black', 2));
  for (const [x, y] of u.cross) band([[x, -y], [x, y]], 70, 'black', 2);
  // brake rods along the frame
  mir(sg => { band([[u.brakeX, sg * 300], [u.front, sg * (tr - 120)]], 14, 'iron', 2); band([[u.brakeX, sg * 300], [u.rear - 60, sg * (tr - 140)]], 14, 'iron', 2); });
  // engine sump, flywheel housing, gearbox, torque tube
  solid(rect(...u.sump, 40), 'paint.enginegreen', { grad: [2.8, 1.2] });
  solid(rect(...u.bell, 60), 'paint.enginegreen', { grad: [2.4, 1] });
  solid(rect(...u.gearbox, 30), 'paint.enginegreen', { grad: [2.6, 1] });
  band([[u.gearbox[2], 0], [u.rear - 150, 0]], 90, 'black', 2);
  // axles, springs, diff, radius rods ("wishbones")
  band([[u.front, -tr + 60], [u.front, tr - 60]], 60, 'black', 2);
  band([[u.front - 70, -tr + 260], [u.front - 70, tr - 260]], 55, 'iron', 2);                 // transverse spring (ahead of axle)
  mir(sg => band([[u.front, sg * (tr - 140)], [u.gearbox[2] - 20, sg * 25]], 32, 'black', 2));
  band([[u.rear, -tr + 60], [u.rear, tr - 60]], 85, 'black', 2);
  solid(ell(u.rear, 0, 170, 150), 'black', { grad: [3, 1] });
  mir(sg => band([[u.rear, sg * (tr - 120)], [u.rear - 650, sg * 50]], 32, 'black', 2));
  band([[u.rear + 60, -tr + 280], [u.rear + 60, tr - 280]], 55, 'iron', 2);
  // drag link, tie rod
  band([[u.front + 80, -tr + 90], [u.front + 80, tr - 90]], 22, 'iron', 2);
  band([[u.front + 80, tr - 90], [u.front + 650, tr - 260]], 22, 'iron', 2);
  // wheels: tyre footprint seen from below + wheel face edge
  mir(sg => { for (const x of [u.front, u.rear]) { const m = rect(x - T.od / 2, sg * tr - tw / 2, x + T.od / 2, sg * tr + tw / 2, tw * 0.45); const t = tag; solid(m, 'rubber', { grad: [3.2, 1.2], axis: 'x' });
    const bb = m.bbox(); for (let yy = bb.y0; yy <= bb.y1; yy++) for (let xx = bb.x0; xx <= bb.x1; xx++) if (m.get(xx, yy) && (xx % 3 === 0 || yy === bb.y0 + 1 || yy === bb.y1 - 1)) px.set(xx, yy, P.id('rubber'), Math.max(0, px.lvl(xx, yy) - 2), t); } });
  // bumpers
  for (const b of u.bumpers) solid(rect(...b, 20), 'chrome', { grad: [4, 1.5] });
  outlineAll(px);
  return px;
}

export const smallPlatformUnder = {
  len: 4200, width: 1800, tire: '4.75-19', track: 1422, front: 610, rear: 3239, brakeX: 1800,
  floor: [[1700, -620], [3820, -660], [3820, 660], [1700, 620]],
  board: [1720, 640, 2790, 860],
  fenders: [[[130, 560], [300, 700], [600, 860], [1000, 880], [1740, 860], [1740, 640], [1000, 600], [300, 580]], [[2780, 640], [2780, 860], [3300, 880], [3780, 840], [3880, 700], [3700, 600], [3200, 600]]],
  rail: [[400, 320], [1700, 330], [2700, 470], [3760, 480]],
  cross: [[460, 330], [1700, 330], [2800, 470], [3760, 480]],
  sump: [650, -170, 1250, 170], bell: [1250, -230, 1420, 230], gearbox: [1420, -130, 1650, 130],
  exhaust: [[900, -230], [1300, -300], [2400, -360], [2950, -360], [3950, -380]], muffler: [2400, -420, 2950, -300],
  bumpers: [[20, -880, 90, 880], [4120, -880, 4190, -500], [4120, 500, 4190, 880]],
};
