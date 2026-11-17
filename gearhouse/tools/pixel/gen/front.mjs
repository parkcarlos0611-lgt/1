// Front / rear orthographic view: half-car spec (y >= 0, mm from centreline) mirrored + asymmetric extras.
import { Pix, Mask, smooth } from '../pix.mjs';
import { TAG, shadeChrome, shadeGlass, shadeGlassPeriod, outlineLayers, dith } from './car.mjs';
import { wheel } from './wheel.mjs';

class FView { constructor(wMM, hMM, mm, pad = 3) { this.mm = mm; this.pad = pad; this.w = Math.ceil(wMM / mm) + pad * 2; this.h = Math.ceil(hMM / mm) + pad * 2; this.cx = this.w / 2; }
  X(y) { return this.cx + y / this.mm; } Y(z) { return this.h - this.pad - z / this.mm; } R(v) { return v / this.mm; }
  P(pts) { return pts.map(([y, z, s]) => [this.X(y), this.Y(z), s]); }
  M(pts) { return pts.map(([y, z, s]) => [this.X(-y), this.Y(z), s]); } }

function sym(v, W, H, pts, sm = 2) { // mirrored full polygon from half outline (centre -> outer -> centre)
  const half = pts.map(p => [...p]); const full = half.concat(half.slice().reverse().map(([y, z, s]) => [-y, z, s]));
  return new Mask(W, H).poly(smooth(v.P(full), sm));
}
function shadeFront(px, m, ramp, v, { lowZ = -1, tag = TAG.body, base = 2 } = {}) {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!m.get(x, y)) continue;
    const z = (v.h - v.pad - y - 0.5) * v.mm; let lv = base;
    let l = 0; while (m.get(x - l - 1, y)) l++; let r = 0; while (m.get(x + r + 1, y)) r++;
    const e = Math.min(l, r); if (e <= 1) lv = base - 1; else if (e <= 3 && r < l) lv = base - 1;
    if (z < lowZ) lv = base - 1;
    if (!m.get(x, y - 1)) lv = base + 2; else if (!m.get(x, y - 2)) lv = base + 1;
    px.set(x, y, ramp, Math.max(0, lv), tag);
  }
}
const pattern = {
  eggcrate: (x, y) => (x % 3 === 0 || y % 3 === 0) ? (y % 3 === 0 ? 3 : 2) : -1,
  hbar: (x, y) => (y % 2 === 0) ? 3 : -1,
  vbar: (x, y) => (x % 2 === 0) ? 3 : -1,
  mesh: (x, y) => ((x + y) % 2 === 0) ? 1 : -1,
};

export function buildFront(P, s, mm = 25) {
  const v = new FView(s.width, s.height + 40, mm), W = v.w, H = v.h, px = new Pix(W, H), M = () => new Mask(W, H);
  px.paint(M().ellipse(v.cx, v.Y(0) + 0.5, v.R(s.width * 0.55), 2.2), () => [P.id('shadow'), 0, TAG.shadow]);
  // tyres
  for (const sg of [1, -1]) { const m = M().poly(smooth(v.P(s.tyre.map(([y, z]) => [sg * y, z])), 1));
    const bb = m.bbox(); px.paint(m, (x, y) => [P.id('rubber'), (x === Math.round((bb.x0 + bb.x1) / 2) ? 2 : 1), TAG.wheel]); }
  const body = sym(v, W, H, s.body, s.smooth ?? 2);
  const glass = M(); for (const g of s.glass) glass.or(sym(v, W, H, g, 1)); glass.and(body);
  const tone = s.tone ? sym(v, W, H, s.tone, 1) : null;
  const pm = body.copy().sub(glass);
  shadeFront(px, pm, P.id(s.paint), v, { lowZ: s.lowZ });
  if (tone) { const tm = pm.copy().and(tone); shadeFront(px, tm, P.id(s.tonePaint), v, { lowZ: s.lowZ }); }
  for (const p of s.under || []) { const m = p.half ? sym(v, W, H, p.pts, p.smooth ?? 1) : M().poly(smooth(v.P(p.pts), p.smooth ?? 1)); if (p.chrome) shadeChrome(px, m, P.id('chrome'), TAG.fender); else shadeFront(px, m, P.id(p.ramp), v, { tag: p.tag || TAG.fender, base: p.base ?? 2 }); }
  if (s.spare) { const wp = wheel(P, { ...s.spare, r: v.R(s.spare.r) }); px.blit(wp, Math.round(v.cx - wp.w / 2), Math.round(v.Y(s.spare.z) - wp.h / 2)); }
  if (s.glassStyle === 'period') shadeGlassPeriod(px, glass, P.id('glass')); else shadeGlass(px, glass, P.id('glass'), { period: 23 });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (glass.get(x, y) && (!glass.get(x, y - 1) || !glass.get(x, y + 1) || !glass.get(x - 1, y) || !glass.get(x + 1, y))) { if (s.frame === 'reveal') px.set(x, y, P.id(s.paint), glass.get(x, y + 1) ? 0 : 3, TAG.frame); else px.set(x, y, P.id(s.frame || 'chrome'), glass.get(x, y + 1) ? 3 : 4, TAG.frame); }
  for (const h of s.interior || []) { const m = M().ellipse(v.X(h[0]), v.Y(h[1]), v.R(h[2]), v.R(h[3])); m.and(glass); px.paint(m, () => [P.id('glass'), 0, TAG.glass]); }
  // grille: frame + pattern fill
  for (const g of s.grilles || []) {
    const m = g.half ? sym(v, W, H, g.pts, 1) : M().poly(v.P(g.pts)); const bb = m.bbox(); const f = pattern[g.pattern];
    px.paint(m, (x, y) => { const edge = !m.get(x - 1, y) || !m.get(x + 1, y) || !m.get(x, y - 1) || !m.get(x, y + 1);
      if (edge) return [P.id(g.surround || 'chrome'), y < (bb.y0 + bb.y1) / 2 ? 4 : 2, TAG.lamp];
      const lv = f(x - bb.x0, y - bb.y0); return lv < 0 ? [P.id('black'), 0, TAG.lamp] : [P.id(g.bars || 'chrome'), lv, TAG.lamp]; });
  }
  for (const b of s.bumpers || []) { const m = b.half ? sym(v, W, H, b.pts, b.smooth ?? 2) : M().poly(smooth(v.P(b.pts), 2)); if (b.ramp && b.ramp !== 'chrome') shadeFront(px, m, P.id(b.ramp), v, { tag: TAG.bumper, base: 1 }); else shadeChrome(px, m, P.id('chrome')); }
  const lamp = (l, sg) => {
    const m = M(); const X = v.X(sg * l.y), Y = v.Y(l.z);
    if (l.r) m.circle(X, Y, v.R(l.r)); else m.poly(smooth(v.P(l.pts.map(([y, z]) => [sg * y, z])), l.smooth ?? 1));
    const bb = m.bbox(), cx = (bb.x0 + bb.x1 + 1) / 2, cy = (bb.y0 + bb.y1 + 1) / 2, R = Math.max(1, (bb.x1 - bb.x0 + 1) / 2), ring = l.bezel ? Math.max(1, Math.round(R * 0.2)) : 0;
    px.paint(m, (x, y) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = l.r ? Math.hypot(dx, dy) / R : 0.5, dot = -(dx + dy) / (Math.hypot(dx, dy) || 1) * 0.707;
      let edge = 0; for (let k = 1; k <= ring; k++) if (!m.get(x - k, y) || !m.get(x + k, y) || !m.get(x, y - k) || !m.get(x, y + k)) edge = 1;
      if (edge) return [P.id(l.bezel), dot > 0.35 ? 4 : dot > -0.2 ? 3 : 1, TAG.lamp];
      if (Math.hypot(dx + R * 0.3, dy + R * 0.3) < Math.max(1, R * 0.16)) return [P.id(l.ramp), 4, TAG.lamp];
      return [P.id(l.ramp), l.r ? dith(x, y, 3.4 - 2.2 * d) : (dy < 0 ? 3 : 2), TAG.lamp]; });
  };
  for (const l of s.lamps || []) { lamp(l, 1); if (!l.single) lamp(l, -1); }
  for (const p of s.parts || []) { const m = p.half ? sym(v, W, H, p.pts, 1) : M().poly(smooth(v.P(p.pts), p.smooth ?? 1)); if (p.chrome) shadeChrome(px, m, P.id('chrome'), TAG.lamp); else shadeFront(px, m, P.id(p.ramp), v, { tag: TAG.lamp, base: p.base ?? 2 }); }
  outlineLayers(px);
  return px;
}
