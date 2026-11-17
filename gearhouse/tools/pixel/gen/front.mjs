// Front / rear orthographic view: half-car spec (y >= 0, mm from centreline) mirrored + asymmetric extras.
import { Pix, Mask, smooth } from '../pix.mjs';
import { fillet } from './geom.mjs';
import { TAG, shadeChrome, shadeGlass, shadeGlassPeriod, outlineLayers, dith } from './car.mjs';
import { wheel } from './wheel.mjs';
import { tire as tireDims } from './tire.mjs';
import { anchorFloating } from './anchor.mjs';

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
  // tyres: if a tyre code is given, draw the real balloon section (stadium shape), tread crown, sidewall bulge, hub
  if (s.tire) {
    const T = tireDims(s.tire), tw = T.section * (s.tireBulge ?? 1.28), tc = s.track / 2;
    for (const sg of [1, -1]) {
      const yc = sg * tc, m = M().poly(fillet([[yc - tw / 2, 0, tw * 0.3], [yc - tw / 2, T.od, tw * 0.48], [yc + tw / 2, T.od, tw * 0.48], [yc + tw / 2, 0, tw * 0.3]]).map(([y, z]) => [v.X(y), v.Y(z)]));
      const bb = m.bbox(), cx = (bb.x0 + bb.x1 + 1) / 2, hw = (bb.x1 - bb.x0 + 1) / 2;
      px.paint(m, (x, y) => { const u = Math.abs(x + 0.5 - cx) / hw; let lv = u < 0.38 ? 2 : u < 0.72 ? 1 : 0;
        if (u < 0.38 && (y % 3 === 0)) lv = 1; if (u > 0.55 && u < 0.72 && x + 0.5 < cx) lv = 2; return [P.id('rubber'), lv, TAG.wheel]; });
      if (s.hub) { const hx = yc + sg * (tw / 2 + s.hub / 2 - 10); const hm = M().poly([[hx - s.hub / 2, T.r - 70], [hx + s.hub / 2, T.r - 70], [hx + s.hub / 2, T.r + 70], [hx - s.hub / 2, T.r + 70]].map(([y, z]) => [v.X(y), v.Y(z)])); shadeChrome(px, hm, P.id('chrome'), TAG.wheel); }
    }
  } else for (const sg of [1, -1]) { const m = M().poly(smooth(v.P(s.tyre.map(([y, z]) => [sg * y, z])), 1));
    const bb = m.bbox(); px.paint(m, (x, y) => [P.id('rubber'), (x === Math.round((bb.x0 + bb.x1) / 2) ? 2 : 1), TAG.wheel]); }
  const body = sym(v, W, H, s.body, s.smooth ?? 2);
  const glass = M(); for (const g of s.glass) glass.or(sym(v, W, H, g, 1)); glass.and(body);
  const tone = s.tone ? sym(v, W, H, s.tone, 1) : null;
  const pm = body.copy().sub(glass);
  shadeFront(px, pm, P.id(s.paint), v, { lowZ: s.lowZ });
  if (tone) { const tm = pm.copy().and(tone); shadeFront(px, tm, P.id(s.tonePaint), v, { lowZ: s.lowZ }); }
  for (const p of s.under || []) { const m = p.half ? sym(v, W, H, p.pts, p.smooth ?? 1) : M().poly(smooth(v.P(p.pts), p.smooth ?? 1)); if (p.chrome) shadeChrome(px, m, P.id('chrome'), TAG.fender); else shadeFront(px, m, P.id(p.ramp), v, { tag: p.tag || TAG.fender, base: p.base ?? 2 }); }
  if (s.hood || s.cowlZ) {
    const hz = s.hood, cowl = s.cowlZ ?? (hz ? hz.top + 50 : 0), bodyR = P.id(s.paint), toneR = s.tonePaint ? P.id(s.tonePaint) : -1;
    const isCab = (x, y) => { const r = px.ramp(x, y), t = px.tag(x, y); return t === TAG.body && (r === bodyR || r === toneR); };
    const hoodM = hz ? M().poly((hz.pts ? fillet(hz.pts.concat(hz.pts.slice().reverse().map(([yy, zz, r]) => [-yy, zz, r]))) : [[-hz.half, hz.bottom], [hz.half, hz.bottom], [hz.half, hz.top], [-hz.half, hz.top]]).map(([yy, zz]) => [v.X(yy), v.Y(zz)])) : null;
    const hoodX0 = hz ? Math.round(v.X(-hz.half)) : 0, hoodX1 = hz ? Math.round(v.X(hz.half)) - 1 : -1, yTop = hz ? Math.round(v.Y(hz.top)) : 0, yCowl = Math.round(v.Y(cowl));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!isCab(x, y)) continue; const z = (v.h - v.pad - y - 0.5) * v.mm;
      if (z > cowl) continue;
      const inHood = hz && hoodM.get(x, y);
      if (inHood) continue;
      let lv = px.lvl(x, y); if (lv < 0) continue;
      lv = Math.max(0, lv - 1);                                                                 // cabin face sits behind the hood
      if (hz && z < hz.top + 40 && (hoodM.get(x + 1, y) || hoodM.get(x - 1, y) || hoodM.get(x + 2, y) || hoodM.get(x - 2, y))) lv = 0;   // contact shadow at hood edges
      if (y === yCowl || y === yCowl - 1) lv = 0;                                                // windshield-base shadow line
      if (hz && y >= yCowl && y <= yTop && x >= hoodX0 - 3 && x <= hoodX1 + 3) lv = Math.min(lv, 1); // cowl band above the hood
      px.set(x, y, px.ramp(x, y), lv, TAG.body); }
    if (hz) { const m = hoodM; const bb = m.bbox(), cx = (bb.x0 + bb.x1 + 1) / 2, hw = Math.max(1, (bb.x1 - bb.x0 + 1) / 2);
      px.paint(m, (x, y) => { const d = !m.get(x, y - 1) ? 0 : !m.get(x, y - 2) ? 1 : 9; const u = Math.abs(x + 0.5 - cx) / hw;
        let lv = d === 0 ? 4 : d === 1 ? 3 : hz.round ? dith(x, y, 3.3 - 2.2 * u * u) : dith(x, y, 3 - 1.2 * (y - bb.y0) / Math.max(1, bb.y1 - bb.y0));
        if (!m.get(x - 1, y) || !m.get(x + 1, y)) lv = 1;
        if (!hz.round && Math.abs(x + 0.5 - cx) < 0.6) return [P.id('chrome'), d === 0 ? 4 : 3, TAG.fender]; return [P.id(hz.ramp || s.paint), lv, TAG.fender]; }); }
  }
  if (s.spare) { const wp = wheel(P, { ...s.spare, r: v.R(s.spare.r) }); px.blit(wp, Math.round(v.cx - wp.w / 2), Math.round(v.Y(s.spare.z) - wp.h / 2)); }
  if (s.glassStyle === 'period') shadeGlassPeriod(px, glass, P.id('glass')); else shadeGlass(px, glass, P.id('glass'), { period: 23 });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (glass.get(x, y) && (!glass.get(x, y - 1) || !glass.get(x, y + 1) || !glass.get(x - 1, y) || !glass.get(x + 1, y))) { if (s.frame === 'reveal') px.set(x, y, P.id(s.paint), glass.get(x, y + 1) ? 0 : 3, TAG.frame); else px.set(x, y, P.id(s.frame || 'chrome'), glass.get(x, y + 1) ? 3 : 4, TAG.frame); }
  if (s.wiper) { const [y0, z0, y1, z1] = s.wiper; const a = v.X(y0), b = v.Y(z0), c2 = v.X(y1), d = v.Y(z1); const n = Math.max(Math.abs(c2 - a), Math.abs(d - b)); for (let k = 0; k <= n; k++) { const xx = Math.round(a + (c2 - a) * k / n), yy = Math.round(b + (d - b) * k / n); if (glass.get(xx, yy)) px.set(xx, yy, P.id('black'), 1, TAG.frame); } }
  if (s.wheelIn) { const [yy, zz, rr] = s.wheelIn; const m = M().ellipse(v.X(yy), v.Y(zz), v.R(rr), v.R(rr * 0.35)); m.sub(M().ellipse(v.X(yy), v.Y(zz), Math.max(0, v.R(rr) - 1), Math.max(0, v.R(rr * 0.35) - 1))); m.and(glass); px.paint(m, () => [P.id('black'), 1, TAG.glass]); }
  if (s.mirrorIn) { const m = M().poly([[-60, s.mirrorIn], [60, s.mirrorIn], [60, s.mirrorIn + 40], [-60, s.mirrorIn + 40]].map(([yy, zz]) => [v.X(yy), v.Y(zz)])); px.paint(m, () => [P.id('chrome'), 2, TAG.frame]); }
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
  if (s.anchor !== false) anchorFloating(px, P);
  return px;
}
