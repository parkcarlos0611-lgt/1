// Window system v2 (civil + military): side glass is DERIVED from the body outline instead of hand-drawn rounded boxes.
//  - top edge  = roof outline offset inward by the drip/roof-rail depth (follows fastback / notch roofs automatically)
//  - front edge of the first opening = A-pillar (body outline offset by pillar width, so it follows the screen rake)
//  - rear edge of the last opening = C-pillar / quarter (offset curve of the rear roof line, optional wider inset)
//  - openings are split by B/C pillars of era-typical widths; corners are rounded by a morphological open
//  - 1940s vent wing (fixed divider at the front of the front door glass)
// Glass shading: desaturated sky reflection on top, transparent zone that shows the far-side window, dark interior below,
// with seat backs / steering wheel silhouettes and one diagonal reflection streak.
import { Mask, line } from '../pix.mjs';
import { dith } from './car.mjs';

// distance (px) from each inside pixel to the nearest outside pixel, capped at R (brute force; R is small)
export function distIn(m, R) {
  const W = m.w, H = m.h, d = new Float32Array(W * H), off = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const r = Math.hypot(dx, dy); if (r <= R) off.push([dx, dy, r]); }
  off.sort((a, b) => a[2] - b[2]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!m.a[i]) continue; let best = R;
    for (const [dx, dy, r] of off) { if (r >= best) break; if (!m.get(x + dx, y + dy)) { best = r; break; } } d[i] = best; }
  return d;
}
export function erode(m, r) { const d = distIn(m, Math.ceil(r) + 1), o = new Mask(m.w, m.h); for (let i = 0; i < d.length; i++) if (m.a[i] && d[i] > r) o.a[i] = 1; return o; }
export function dilate(m, r) { const o = m.copy(), R = Math.ceil(r); for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.a[y * m.w + x])
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= r * r) o.put(x + dx, y + dy); return o; }
export const openM = (m, r) => (r > 0 ? dilate(erode(m, r), r).and(m) : m);

// win = { belt, drip=55, A=80, C, B=100, open:[[x0,x1,{d,c}]...], vent: x | null, round=1.6, interior:true, seats:[x...], wheel:x }
export function deriveGlass(body, v, win) {
  const mm = v.mm, R = Math.ceil(Math.max(win.A || 80, win.C || 0, win.drip || 55, 200) / mm) + 2, dist = distIn(body, R);
  const yBelt = v.Y(win.belt), glass = new Mask(body.w, body.h), panes = [];
  const halfB = (win.B ?? 100) / 2 / mm;
  // row extremes of the body above the belt: leftmost = screen / A-pillar line, rightmost = backlight / C-pillar line
  const xl = new Float32Array(body.h).fill(1e9), xr = new Float32Array(body.h).fill(-1e9);
  for (let y = 0; y <= Math.min(body.h - 1, yBelt); y++) for (let x = 0; x < body.w; x++) if (body.a[y * body.w + x]) { xl[y] = Math.min(xl[y], x); xr[y] = Math.max(xr[y], x); }
  win.open.forEach(([x0, x1, o = {}], k) => {
    const pane = new Mask(body.w, body.h), first = k === 0, last = k === win.open.length - 1;
    const dTop = (o.d ?? win.drip ?? 55) / mm, dA = (o.a ?? win.A ?? 80) / mm, dC = (o.c ?? win.C ?? 80) / mm;
    const X0 = x0 == null ? -1e9 : v.X(x0) + (first ? 0 : halfB), X1 = x1 == null ? 1e9 : v.X(x1) - (last ? 0 : halfB);
    for (let y = 0; y < body.h; y++) for (let x = 0; x < body.w; x++) { const i = y * body.w + x; if (!body.a[i] || y > yBelt || x < X0 || x > X1 || dist[i] < dTop) continue;
      if (o.cut) { const [a, b] = o.cut, xa = v.X(a[0]), ya = v.Y(a[1]), xb = v.X(b[0]), yb = v.Y(b[1]); if (x > xa + (y - ya) * (xb - xa) / (yb - ya)) continue; }
      if (first && x < xl[y] + dA) continue; if (last && x > xr[y] - dC) continue; pane.a[i] = 1; }
    const p = openM(pane, o.round ?? win.round ?? 1.6); panes.push({ m: p, x0, x1 }); glass.or(p);
  });
  return { glass, panes };
}

// period glass v2 shading (shared by civil + military)
export function shadeGlassV2(px, mask, ramp, tag, { streak = 0, celluloid = false } = {}) {
  const bb = mask.bbox(); if (bb.x1 < 0) return;
  for (let x = bb.x0; x <= bb.x1; x++) { let y = bb.y0; while (y <= bb.y1) { if (!mask.get(x, y)) { y++; continue; }
    const y0 = y; while (y <= bb.y1 && mask.get(x, y)) y++; const n = y - y0;
    for (let k = 0; k < n; k++) { const t = k / Math.max(1, n - 1);
      // sky reflection (top) -> far window seen through (mid) -> dark interior / door trim (bottom)
      let val = celluloid ? 2.4 - 0.9 * t : t < 0.18 ? 3.0 - t * 3 : t < 0.55 ? 2.15 - (t - 0.18) * 1.4 : 1.6 - (t - 0.55) * 3.2;
      if (!celluloid && streak && ((x - bb.x0) + (y0 + k - bb.y0) * 0.9) % streak < 1.6 && t < 0.7) val = 3.2;
      let lv = dith(x, y0 + k, val, 0.2); if (k === 0 && !celluloid) lv = Math.min(lv, 1);
      px.set(x, y0 + k, ramp, lv, tag); } } }
}

// interior silhouettes behind the glass (seat backs, steering wheel rim, B-pillar inner trim) - painted dark, only inside glass
export function interiorHints(px, glass, v, ramp, tag, { belt, seats = [], wheel = null, seatH = 230 }) {
  const M = () => new Mask(glass.w, glass.h);
  for (const sx of seats) { const m = M(); m.ellipse(v.X(sx), v.Y(belt + seatH - 70), v.R(140), v.R(90)); m.rect(v.X(sx - 140), v.Y(belt + seatH - 70), v.X(sx + 140), v.Y(belt - 50)); m.and(glass);
    px.paint(m, (x, y) => [ramp, !m.get(x, y - 1) ? 2 : m.get(x, y - 2) ? 0 : 1, tag]); }
  if (wheel != null) { const cx = v.X(wheel), cy = v.Y(belt + 110), rx = v.R(30), ry = v.R(190);       // rim seen almost edge-on, raked
    const m = M(); for (let a = 0; a < 6.283; a += 0.05) { const x = cx + Math.cos(a) * rx + Math.sin(a) * ry * 0.35, y = cy + Math.sin(a) * ry * 0.55; m.put(Math.round(x), Math.round(y)); } m.and(glass);
    px.paint(m, () => [ramp, 0, tag]); }
}

// frame around each pane: 'chrome' moulding, 'reveal' (body colour), 'rubber' gasket
export function paneFrames(px, glass, P, kind, bodyRamp, tag) {
  const g = (x, y) => glass.get(x, y), bb = glass.bbox(); if (bb.x1 < 0) return;
  for (let y = bb.y0 - 1; y <= bb.y1 + 1; y++) for (let x = bb.x0 - 1; x <= bb.x1 + 1; x++) { if (!g(x, y)) continue;
    const up = !g(x, y - 1), dn = !g(x, y + 1), fr = !g(x - 1, y), bk = !g(x + 1, y); if (!(up || dn || fr || bk)) continue;
    if (kind === 'chrome') px.set(x, y, P.id('chrome'), up ? 4 : dn ? 2 : fr ? 3 : 2, tag);
    else if (kind === 'rubber') px.set(x, y, P.id('rubber'), up ? 2 : 1, tag);
    else px.set(x, y, bodyRamp(x, y), up || fr ? 0 : dn ? 3 : 1, tag); }
}
// vent wing divider: slanted bar in the first pane
export function ventWing(px, pane, v, x, belt, top, P, kind, tag) {
  line(v.X(x), v.Y(belt), v.X(x + 70), v.Y(top), (X, Y) => { for (const dx of [0, 1]) if (pane.get(X + dx, Y)) px.set(X + dx, Y, kind === 'rubber' ? P.id('rubber') : P.id('chrome'), kind === 'rubber' ? 1 : dx ? 2 : 4, tag); });
}
