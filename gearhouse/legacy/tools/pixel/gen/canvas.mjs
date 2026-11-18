// Shared mm-space sprite canvas for props. Origin at centre (cx) or left (ox); z up.
import { Pix, Mask, line } from '../pix.mjs';
import { fillet } from './geom.mjs';
import { dith } from './car.mjs';
export class Canvas {
  constructor(P, wMM, hMM, mm = 5, { centre = true } = {}) { this.P = P; this.mm = mm; this.w = Math.ceil(wMM / mm) + 6; this.h = Math.ceil(hMM / mm) + 6; this.px = new Pix(this.w, this.h); this.centre = centre; this.tag = 20; }
  X(x) { return this.centre ? this.w / 2 + x / this.mm : 3 + x / this.mm; } Y(z) { return this.centre ? this.h / 2 - z / this.mm : this.h - 3 - z / this.mm; }
  M() { return new Mask(this.w, this.h); }
  poly(pts, r = 0) { return this.M().poly(fillet(pts.map(p => [p[0], p[1], p[2] ?? r]), 3).map(([x, z]) => [this.X(x), this.Y(z)])); }
  rect(x0, z0, x1, z1, r = 0) { return this.poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], r); }
  circ(x, z, r) { return this.M().circle(this.X(x), this.Y(z), Math.max(0.7, r / this.mm)); }
  ell(x, z, rx, rz) { return this.M().ellipse(this.X(x), this.Y(z), Math.max(0.7, rx / this.mm), Math.max(0.7, rz / this.mm)); }
  band(pts, th) { const m = this.M(), rr = Math.max(0.6, th / this.mm / 2); for (let i = 0; i + 1 < pts.length; i++) line(this.X(pts[i][0]), this.Y(pts[i][1]), this.X(pts[i + 1][0]), this.Y(pts[i + 1][1]), (x, y) => m.circle(x + 0.5, y + 0.5, rr)); return m; }
  fill(m, ramp, fn) { const t = this.tag++, r = this.P.id(ramp), bb = m.bbox(); const cx = (bb.x0 + bb.x1 + 1) / 2, cy = (bb.y0 + bb.y1 + 1) / 2, R = Math.max(1, (bb.x1 - bb.x0 + 1) / 2), Rz = Math.max(1, (bb.y1 - bb.y0 + 1) / 2);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (m.get(x, y)) { const dx = (x + 0.5 - cx) / R, dy = (y + 0.5 - cy) / Rz, top = !m.get(x, y - 1), bot = !m.get(x, y + 1), side = !m.get(x - 1, y) || !m.get(x + 1, y);
      const lv = fn({ x, y, dx, dy, d: Math.hypot(dx, dy), top, bot, side, edge: top || bot || side, dot: -(dx + dy) * 0.707, ty: (y - bb.y0) / Math.max(1, bb.y1 - bb.y0), tx: (x - bb.x0) / Math.max(1, bb.x1 - bb.x0) }); if (lv != null) this.px.set(x, y, r, Math.max(0, Math.min(4, lv)), t); } return this; }
  chrome(m) { return this.fill(m, 'chrome', ({ x, y, dot, ty }) => dith(x, y, 3.3 + dot * 1.2 - (ty > 0.45 && ty < 0.62 ? 1.7 : 0))); }
  dome(m, ramp, b = 2.3, k = 1.4) { return this.fill(m, ramp, ({ x, y, dot, d }) => dith(x, y, b + dot * k - d * 0.5)); }
  vgrad(m, ramp, a = 3.2, b = 1.2) { return this.fill(m, ramp, ({ x, y, ty, top }) => top ? 4 : dith(x, y, a + (b - a) * ty)); }
  flat(m, ramp, lv) { return this.fill(m, ramp, ({ top }) => top ? lv + 1 : lv); }
  // outline only against empty space: thin parts lying on a panel keep their own shading
  done() { const px = this.px, mark = []; for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) { if (!px.ramp(x, y)) continue; if (!px.ramp(x - 1, y) || !px.ramp(x + 1, y) || !px.ramp(x, y - 1) || !px.ramp(x, y + 1)) mark.push(y * px.w + x); } for (const i of mark) px.l[i] = -1; return px; }
}
