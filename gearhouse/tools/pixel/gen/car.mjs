// Side-view car assembler: silhouette (mm splines) -> masks -> layered, shaded, outlined pixel sprite.
import { Pix, Mask, View, smooth, line, polyline } from '../pix.mjs';
import { wheel } from './wheel.mjs';
import { tire } from './tire.mjs';

export const TAG = { shadow: 1, well: 2, wheel: 3, body: 4, fender: 6, board: 7, glass: 8, frame: 9, trim: 10, bumper: 11, lamp: 12, deco: 13 };
const OUTLINED = new Set([TAG.wheel, TAG.body, TAG.fender, TAG.board, TAG.bumper, TAG.lamp]);

// Column-run shading for painted volumes seen from the side.
export function shadeVolume(pix, mask, rampOf, v, { lowZ = -1, topLv = 4, base = 2, tag = TAG.body, spec = [] } = {}) {
  for (let x = 0; x < mask.w; x++) {
    let y = 0;
    while (y < mask.h) {
      if (!mask.get(x, y)) { y++; continue; }
      const y0 = y; while (y < mask.h && mask.get(x, y)) y++; const y1 = y - 1;
      for (let yy = y0; yy <= y1; yy++) {
        const d = yy - y0, bd = y1 - yy, z = (v.h - v.pad - yy - 0.5) * v.mm;
        let lv = base;
        if (z < lowZ) lv = base - 1;
        if (bd === 0 && z < lowZ + 200) lv = Math.max(0, base - 2);
        if (d === 0) lv = pix.tag(x, yy - 1) === TAG.glass ? topLv - 1 : topLv;
        else if (d === 1 && y1 - y0 > 3) lv = Math.max(lv, topLv - 1);
        for (const s of spec) if (Math.abs(z - s.z(x * v.mm)) < v.mm * 0.5 && x * v.mm > s.x0 && x * v.mm < s.x1 && ((x + (s.dash || 99)) % (s.dash || 99)) !== 0) lv = s.lv ?? topLv;
        const r = rampOf(x, yy); if (r) pix.set(x, yy, r, lv, tag);
      }
    }
  }
}
// Chrome: sky / horizon / ground reflection bands per column run.
export function shadeChrome(pix, mask, ramp, tag = TAG.bumper, bands = [4, 3, 1, 2, 2, 1]) {
  for (let x = 0; x < mask.w; x++) {
    let y = 0;
    while (y < mask.h) {
      if (!mask.get(x, y)) { y++; continue; }
      const y0 = y; while (y < mask.h && mask.get(x, y)) y++; const n = y - y0;
      for (let k = 0; k < n; k++) pix.set(x, y0 + k, ramp, n <= 2 ? [3, 1][k] : bands[Math.min(bands.length - 1, Math.floor(k / n * bands.length))], tag);
    }
  }
}
export function shadeGlass(pix, mask, ramp, { period = 19, tag = TAG.glass } = {}) {
  for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
    if (!mask.get(x, y)) continue;
    const s = ((x + y) % period + period) % period;
    let lv = 1; if (!mask.get(x, y - 1) || !mask.get(x, y - 2)) lv = 0;
    if (s === 0 || s === 1) lv = 3; else if (s === 3) lv = 2;
    pix.set(x, y, ramp, lv, tag);
  }
}
// Selective outline: border against empty, or against a lower layer.
export function outlineLayers(pix) {
  const W = pix.w, H = pix.h, mark = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = pix.tag(x, y); if (!OUTLINED.has(t)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tn = pix.tag(x + dx, y + dy), rn = pix.ramp(x + dx, y + dy);
      if (!rn || tn === TAG.shadow || tn < t) { mark.push(y * W + x); break; }
    }
  }
  for (const i of mark) pix.l[i] = -1;
}

export function buildCar(P, s, mm = 25, opt = {}) {
  const v = new View(s.len, s.height + 40, mm, 3), px = new Pix(v.w, v.h);
  const W = v.w, H = v.h, M = () => new Mask(W, H);
  const poly = pts => v.P(pts);
  // shadow
  const sh = M().ellipse(v.X(s.len / 2), v.Y(0) + 0.5, v.R(s.len * 0.47), 2.6); px.paint(sh, () => [P.id('shadow'), 0, TAG.shadow]);
  // body mask
  const body = M().poly(smooth(poly(s.body), s.smooth ?? 3)); body.clean(1);
  const arches = M(); for (const a of s.arches) arches.circle(v.X(a.x), v.Y(a.z), v.R(a.r));
  // wheel wells (dark) inside body
  const well = arches.copy().and(body); px.paint(well, () => [P.id('black'), 0, TAG.well]);
  for (const f of s.fenders || []) { /* wells under separate fenders */ const fm = M().poly(smooth(poly(f.pts), f.smooth ?? 3)); fm.clean(1); f._m = fm; }
  // wheels
  px.wheels = []; const T = s.tire ? tire(s.tire) : null;
  for (const w0 of s.wheels) { const w = T ? { ...w0, r: T.r, tireFrac: T.frac } : w0; const wp = wheel(P, { ...s.wheel, ...w, r: v.R(w.r) }); const wx = Math.round(v.X(w.x) - wp.w / 2), wy = Math.round(v.Y(w.r) - wp.h / 2); px.blit(wp, wx, wy); px.wheels.push({ wp, wx, wy }); }
  // body paint (+ two-tone regions)
  const bodyM = body.copy().sub(arches); for (const g of s.cut || []) bodyM.sub(M().poly(poly(g)));
  bodyM.clean(1);
  const p1 = P.id(s.paint), tones = (s.tone || []).map(t => ({ r: P.id(t.paint), m: M().poly(smooth(poly(t.pts), t.smooth ?? 2)) }));
  const rampOf = (x, y) => { for (const t of tones) if (t.m.get(x, y)) return t.r; return p1; };
  // glass first-mask so shading can know what's above
  const glass = M(); for (const g of s.glass) glass.poly(smooth(poly(g), s.glassSmooth ?? 1)); glass.and(bodyM);
  px.paint(glass, () => [P.id('glass'), 1, TAG.glass]);
  const paintM = bodyM.copy().sub(glass);
  shadeVolume(px, paintM, rampOf, v, { lowZ: s.lowZ ?? -1, spec: (s.spec || []).map(q => ({ ...q, z: typeof q.z === 'function' ? q.z : () => q.z })) });
  shadeGlass(px, glass, P.id('glass'), { period: s.glassPeriod || 19 });
  // interior hints through glass
  for (const h of s.interior || []) { const m = M(); if (h.e) m.ellipse(v.X(h.e[0]), v.Y(h.e[1]), v.R(h.e[2]), v.R(h.e[3])); else m.poly(poly(h.pts)); m.and(glass); px.paint(m, (x, y) => [P.id('glass'), 0, TAG.glass]); }
  // window frames
  if (s.frame === 'reveal') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (glass.get(x, y)) {
      const up = !glass.get(x, y - 1), dn = !glass.get(x, y + 1), fr = !glass.get(x - 1, y), bk = !glass.get(x + 1, y);
      const r = rampOf(x, y - 3) === P.id('black') ? rampOf(x, y + 3) : rampOf(x, y);
      if (up || fr) px.set(x, y, r, 0, TAG.frame); else if (dn) px.set(x, y, r, 3, TAG.frame); else if (bk) px.set(x, y, P.id('glass'), 0, TAG.glass);
    }
  } else if (s.frame) {
    const fr = P.id(s.frame === 'paint' ? s.paint : s.frame);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (glass.get(x, y)) {
      const up = !glass.get(x, y - 1), dn = !glass.get(x, y + 1), sd = !glass.get(x - 1, y) || !glass.get(x + 1, y);
      if (up || dn || sd) px.set(x, y, fr, s.frame === 'black' ? 1 : dn ? 4 : up ? 3 : 2, TAG.frame);
    }
  }
  for (const a of s.aprons || []) { const m = M().poly(poly(a)); px.paint(m, (x, y) => [P.id('black'), m.get(x, y - 1) ? 0 : 1, TAG.well]); }
  // separate fenders + running boards (pre-war)
  for (const f of s.fenders || []) { const m = f._m; m.sub(M().circle(v.X(f.wx), v.Y(f.wz), v.R(f.wr))); shadeVolume(px, m, () => P.id(f.paint), v, { tag: TAG.fender, lowZ: -1 }); }
  for (const sp0 of s.spares || []) { const sp = T ? { ...sp0, r: T.r, tireFrac: T.frac } : sp0; const wp = wheel(P, { ...s.wheel, ...sp, r: v.R(sp.r) }); const wx = Math.round(v.X(sp.x) - wp.w / 2), wy = Math.round(v.Y(sp.z) - wp.h / 2); for (let y = 0; y < wp.h; y++) for (let x = 0; x < wp.w; x++) { const i = y * wp.w + x; if (wp.r[i]) px.set(wx + x, wy + y, wp.r[i], wp.l[i], TAG.board); } }
  for (const b of s.boards || []) { const m = M().poly(poly(b.pts)); px.paint(m, (x, y) => [P.id(b.paint), !m.get(x, y - 1) ? 3 : !m.get(x, y + 1) ? 0 : ((x % 2) ? 1 : 2), TAG.board]); }
  // shut lines, louvres, trim
  const onBody = (x, y) => paintM.get(x, y) || (s.fenders && px.tag(x, y) === TAG.fender);
  for (const d of s.doors || []) polyline(poly(smooth(d, 2, false)), (x, y) => { if (paintM.get(x, y) && px.tag(x, y) === TAG.body) px.set(x, y, px.ramp(x, y), 0, TAG.body); });
  for (const L of s.louvres || []) for (let x = L.x0; x <= L.x1; x += L.step) line(v.X(x), v.Y(L.z0), v.X(x + (L.lean || 0)), v.Y(L.z1), (X, Y) => { if (onBody(X, Y)) { px.set(X, Y, px.ramp(X, Y), 0, TAG.body); px.set(X + 1, Y, px.ramp(X + 1, Y), 3, TAG.body); } });
  for (const t of s.trim || []) {
    const pts = poly(smooth(t.pts, 2, false)), r = P.id(t.ramp || 'chrome');
    polyline(pts, (x, y) => { if (!t.free && !onBody(x, y)) return; px.set(x, y, r, t.lv ?? 3, TAG.trim); if (t.w > 1 && (t.free || onBody(x, y + 1))) px.set(x, y + 1, r, t.lv2 ?? 1, TAG.trim); });
  }
  for (const d of s.decals || []) { const m = M().poly(poly(d.pts)).and(paintM); px.paint(m, (x, y) => [P.id(d.paint), (paintM.get(x, y - 1) ? 2 : 3), TAG.body]); }
  // bumpers, lamps, misc solid parts
  for (const b of s.bumpers || []) { const m = M().poly(smooth(poly(b.pts), b.smooth ?? 2)); if (b.ramp === 'chrome' || !b.ramp) shadeChrome(px, m, P.id('chrome')); else shadeVolume(px, m, () => P.id(b.ramp), v, { tag: TAG.bumper, topLv: 3, base: 1 }); }
  for (const l of s.lamps || []) {
    const m = M(); if (l.e) m.ellipse(v.X(l.e[0]), v.Y(l.e[1]), v.R(l.e[2]), v.R(l.e[3])); else m.poly(smooth(poly(l.pts), l.smooth ?? 1));
    const r = P.id(l.ramp); const bb = m.bbox();
    px.paint(m, (x, y) => [r, (y - bb.y0) < (bb.y1 - bb.y0) * 0.35 ? 3 : (x - bb.x0 < 2 ? 4 : 2), TAG.lamp]);
    if (l.bezel) for (let y = bb.y0; y <= bb.y1; y++) for (let x = bb.x0; x <= bb.x1; x++) if (m.get(x, y) && (!m.get(x - 1, y) || !m.get(x + 1, y) || !m.get(x, y - 1) || !m.get(x, y + 1))) px.set(x, y, P.id(l.bezel), y < (bb.y0 + bb.y1) / 2 ? 4 : 2, TAG.lamp);
  }
  const asym = s['asym' + (opt.side || 'L')] || {}; const extra = Object.values(asym).flat();
  for (const p of [...(s.parts || []), ...extra]) { const m = M(); if (p.e) m.ellipse(v.X(p.e[0]), v.Y(p.e[1]), v.R(p.e[2]), v.R(p.e[3])); else m.poly(smooth(poly(p.pts), p.smooth ?? 1)); if (p.chrome) shadeChrome(px, m, P.id('chrome'), TAG.lamp); else shadeVolume(px, m, () => P.id(p.ramp), v, { tag: p.tag || TAG.lamp, base: p.base ?? 2 }); }
  for (const h of s.handles || []) { const x = Math.round(v.X(h[0])), y = Math.round(v.Y(h[1])); px.set(x, y, P.id('chrome'), 4, TAG.trim); px.set(x + 1, y, P.id('chrome'), 3, TAG.trim); px.set(x, y + 1, px.ramp(x, y + 1) ? px.ramp(x, y + 1) : P.id('chrome'), 0, TAG.body); px.set(x + 1, y + 1, px.ramp(x + 1, y + 1), 0, TAG.body); }
  outlineLayers(px);
  return px;
}

// Right-side view: geometry mirrored, but lighting kept top-left (wheels re-drawn unmirrored) and side-specific parts swapped.
export function buildCarRight(P, s, mm = 25) {
  const L = buildCar(P, s, mm, { side: 'R' }); const R = L.flipped();
  for (const { wp, wx } of L.wheels) { const nx = R.w - wx - wp.w; const wy = L.wheels.find(q => q.wp === wp).wy;
    for (let y = 0; y < wp.h; y++) for (let x = 0; x < wp.w; x++) { const i = y * wp.w + x; if (wp.r[i] && R.tag(nx + x, wy + y) === TAG.wheel && R.l[(wy + y) * R.w + nx + x] >= 0) R.set(nx + x, wy + y, wp.r[i], wp.l[i], TAG.wheel); } }
  return R;
}
