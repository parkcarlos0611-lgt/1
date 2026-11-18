// Detailed sidevalve inline engine, left side, S2 (5 mm/px) - from engine-bay photos (debadged, generic).
import { Pix, Mask, smooth, line } from '../pix.mjs';
import { outlineAll } from './props.mjs';
import { dith } from './car.mjs';
import { fillet } from './geom.mjs';

export function engineSV(P, { cyl = 4, bore = 98.4, stroke = 108, color = 'paint.enginegreen' } = {}, mm = 5) {
  const pitch = bore + 16, L = cyl * pitch + 20, deck = 300, head = 48;
  const W = L + 340, H = deck + head + 260 + 330, ox = 170, oz = 330;
  const w = Math.ceil(W / mm) + 4, h = Math.ceil(H / mm) + 4, px = new Pix(w, h);
  const X = x => (x + ox) / mm + 2, Y = z => h - 2 - (z + oz) / mm, M = () => new Mask(w, h);
  const poly = (pts, rr = 0) => M().poly(fillet(pts.map(p => [p[0], p[1], p[2] ?? rr]), 3).map(([x, z]) => [X(x), Y(z)]));
  const ell = (x, z, rx, rz) => M().ellipse(X(x), Y(z), rx / mm, rz / mm);
  let tag = 20;
  const solid = (m, ramp, { base = 2, grad = null, speck = 0, lvFn } = {}) => { const t = tag++, r = P.id(ramp); const bb = m.bbox();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!m.get(x, y)) continue; let lv = base;
      if (grad) lv = dith(x, y, grad[0] + (grad[1] - grad[0]) * (y - bb.y0) / Math.max(1, bb.y1 - bb.y0));
      if (!m.get(x, y - 1)) lv = Math.min(4, lv + 1); else if (!m.get(x, y + 1)) lv = Math.max(0, lv - 1);
      if (speck && ((x * 73 + y * 151) % speck === 0)) lv = Math.max(0, lv - 1);
      if (lvFn) { const o = lvFn(x, y, lv); if (o == null) continue; lv = o; }
      px.set(x, y, r, lv, t); } return t; };
  const band = (pts, th, ramp, base = 2) => { const m = M(), rr = Math.max(0.6, th / mm / 2); for (let i = 0; i + 1 < pts.length; i++) line(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]), (x, y) => m.circle(x + 0.5, y + 0.5, rr)); solid(m, ramp, { base }); return m; };
  const dot = (x, z, ramp, lv) => { const xx = Math.round(X(x)), yy = Math.round(Y(z)); px.set(xx, yy, P.id(ramp), lv, tag); };

  // exhaust down-pipe & fan belt behind everything
  band([[L * 0.68, 150], [L * 0.72, 40], [L * 0.8, -320]], 55, 'rust', 1);
  band([[-60, -30], [-80, deck + 40], [-30, 190]], 14, 'rubber', 1);
  // oil pan, block, bell housing, timing cover
  solid(poly([[0, -60], [L, -60], [L - 20, -200], [L * 0.45, -210], [L * 0.3, -150], [20, -140]], 30), color, { base: 1 });
  solid(poly([[0, -60], [L, -60], [L, deck], [0, deck]]), color, { grad: [2.6, 1.2], speck: 41 });
  for (let k = 1; k < cyl; k++) solid(poly([[k * pitch + 4, 40], [k * pitch + 12, 40], [k * pitch + 12, deck - 40], [k * pitch + 4, deck - 40]]), color, { base: 1 });  // cylinder bulge seams
  solid(poly([[L, -150], [L + 70, -130], [L + 70, deck - 20], [L, deck]], 25), color, { base: 1, grad: [2, 0.8] });
  solid(poly([[0, -50], [-50, -20], [-60, deck * 0.7], [-20, deck], [0, deck]], 25), color, { base: 2, grad: [2.4, 1.2] });
  // head: flat slab, two rows of bolt heads, 4 plugs on top
  solid(poly([[-12, deck], [L + 12, deck], [L + 12, deck + head], [-12, deck + head]]), color, { grad: [3, 1.8] });
  for (let i = 0; i < 9; i++) { const x = 18 + i * (L - 36) / 8; dot(x, deck + 14, 'iron', 4); dot(x, deck + 34, 'iron', 4); }
  for (let k = 0; k < cyl; k++) { const x = k * pitch + pitch / 2;
    solid(poly([[x - 12, deck + head], [x + 12, deck + head], [x + 10, deck + head + 22], [x - 10, deck + head + 22]]), 'iron', { base: 3 });
    solid(poly([[x - 9, deck + head + 22], [x + 9, deck + head + 22], [x + 7, deck + head + 70], [x - 7, deck + head + 70]]), 'white', { grad: [4, 2.4] });
    band([[x, deck + head + 72], [x - 20, deck + head + 110], [60, deck + head + 120]], 8, 'black', 1); }
  // distributor (front top), water outlet + upper hose, water pump, fan
  solid(poly([[40, deck + head], [85, deck + head], [85, deck + head + 80], [40, deck + head + 80]], 8), color, { base: 2 });
  solid(ell(62, deck + head + 95, 45, 22), 'black', { base: 2 });
  solid(poly([[-10, deck + head - 10], [40, deck + head - 10], [30, deck + head + 50], [-30, deck + head + 60]], 10), color, { base: 3 });
  band([[-20, deck + head + 45], [-55, deck + head + 120], [-60, deck + head + 190]], 50, 'rubber', 2);
  solid(poly([[-60, deck - 30], [-10, deck - 30], [-10, deck + 40], [-60, deck + 40]], 10), color, { base: 2 });
  solid(ell(-95, deck + 5, 12, 150), 'black', { base: 1 });
  // generator (front, mid height) with band
  solid(poly([[-45, 20], [105, 20], [105, 120], [-45, 120]], 40), 'black', { grad: [3.2, 0.8] });
  solid(poly([[40, 18], [56, 18], [56, 122], [40, 122]]), 'chrome', { grad: [4, 1.5] });
  // manifolds: rusty exhaust log + arched intake above, updraft carburettor and copper fuel line
  band([[40, 170], [L - 40, 175]], 70, 'rust', 2);
  for (let k = 0; k < 3; k++) solid(poly([[70 + k * (L - 140) / 2 - 20, 200], [70 + k * (L - 140) / 2 + 20, 200], [70 + k * (L - 140) / 2 + 20, 235], [70 + k * (L - 140) / 2 - 20, 235]]), 'rust', { base: 2 });
  band([[110, 240], [150, 290], [240, 300], [330, 290], [370, 240]], 46, color, 3);
  band([[240, 290], [240, 120]], 44, color, 2);
  solid(poly([[205, 120], [280, 120], [280, 40], [205, 40]], 10), 'brass', { grad: [3.4, 1.2] });
  solid(poly([[215, 40], [270, 40], [265, -30], [220, -30]], 8), 'iron', { base: 2 });
  band([[285, 90], [380, 100], [430, 300], [560, 420]], 9, 'brass', 3);
  // oil filler, starter
  solid(poly([[130, 0], [168, 0], [168, 90], [130, 90]], 10), 'chrome', { grad: [4, 1.6] });
  solid(poly([[L - 30, -50], [L + 110, -50], [L + 110, 30], [L - 30, 30]], 35), 'black', { grad: [2.8, 0.8] });
  outlineAll(px);
  return px;
}
