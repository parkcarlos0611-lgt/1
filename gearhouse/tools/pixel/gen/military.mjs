// Military vehicle builder - deliberately separate from the civilian body generator.
// Flat stamped panels (fixed level per face, bevelled top edge, dark lower edge, rivet rows), matte olive (no chrome,
// no horizon reflection), exposed frame/springs/axles, canvas with folds, NDT tyres on combat rims, stencils.
import { Pix, Mask, line } from '../pix.mjs';
import { fillet } from './geom.mjs';
import { wheel } from './wheel.mjs';
import { tire } from './tire.mjs';
import { anchorFloating } from './anchor.mjs';
import { shadeGlassV2, interiorHints } from './windows.mjs';
import { dith } from './car.mjs';
const TAG = { shadow: 1, back: 2, wheel: 3, body: 4, canvas: 5, detail: 12 };

export function buildMil(P, s, mm = 12.5) {
  const pad = 4, W = Math.ceil(s.len / mm) + pad * 2, H = Math.ceil(s.height / mm) + pad * 2, px = new Pix(W, H);
  const X = x => x / mm + pad + (s.ox || 0) / mm, Y = z => H - pad - z / mm, M = () => new Mask(W, H);
  const poly = (pts, r = 0) => M().poly(fillet(pts.map(p => [p[0], p[1], p[2] ?? r]), 2).map(([x, z]) => [X(x), Y(z)]));
  const band = (pts, th) => { const m = M(), rr = Math.max(0.6, th / mm / 2); for (let i = 0; i + 1 < pts.length; i++) line(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]), (x, y) => m.circle(x + 0.5, y + 0.5, rr)); return m; };
  const id = n => P.id(n === 'OD' ? s.paint : n);
  // stamped panel: one level per face, 1px bevel on top edge, dark bottom edge, optional rivet row
  // material shaders. steel: matte painted panel - soft vertical gradient per face, lit top bevel, dark lower edge, rivet row,
  // sparse paint wear (bare-metal chips) on exposed top/front edges. wood: grain streaks. rubber/black: flat with top highlight.
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 997;
  const panel = (m, ramp, { base = 2, tag = TAG.body, rivets = 0, bevel = true, mat = null, grad = true } = {}) => { const r = id(ramp);
    const kind = mat || (ramp === 'wood' || ramp === 'woodDark' || ramp === 'woodLight' ? 'wood' : ramp === 'OD' || ramp === s.paint ? 'steel' : 'plain');
    const bb = m.bbox(); if (bb.x1 < 0) return;
    for (let x = bb.x0; x <= bb.x1; x++) { let y = bb.y0; while (y <= bb.y1) { if (!m.get(x, y)) { y++; continue; } const y0 = y; while (y <= bb.y1 && m.get(x, y)) y++; const n = y - y0;
      for (let k = 0; k < n; k++) { const yy = y0 + k, t = n > 1 ? k / (n - 1) : 0.5; let lv = base;
        if (kind === 'steel' && grad && n > 5) lv = dith(x, yy, base + 0.45 - 0.9 * t, 0.18);
        if (bevel && !m.get(x, yy - 1)) lv = base + 1; else if (!m.get(x, yy + 1)) lv = base - 1;
        if (kind === 'wood' && k > 0 && k < n - 1 && ((Math.floor((x + yy * 5) / (3 + (yy % 3))) * 2654435761) >>> 0) % 9 < 2) lv = base - 1;
        if (rivets && !m.get(x, yy - rivets) && m.get(x, yy - rivets + 1) && x % 4 === 0) lv = base + 1;
        px.set(x, yy, r, Math.max(0, Math.min(kind === 'steel' ? 3 : 4, lv)), tag);
        if (kind === 'steel' && (!m.get(x, yy - 1) || !m.get(x - 1, yy)) && hash(x, yy) % 11 === 0) px.set(x, yy, id('iron'), 3, tag);   // chipped paint
      } } } };
  // ground shadow
  const sh = M().ellipse(X(s.len / 2), Y(0) + 0.5, s.len / mm * 0.48, 2.6); for (let i = 0; i < W * H; i++) if (sh.a[i]) { px.r[i] = id('shadow'); px.l[i] = 0; px.t[i] = TAG.shadow; }
  // exposed chassis behind everything: frame, springs, axles, diffs, transfer case, exhaust
  for (const f of s.chassis || []) { const m = f.band ? band(f.band, f.th || 60) : f.e ? M().ellipse(X(f.e[0]), Y(f.e[1]), f.e[2] / mm, f.e[3] / mm) : poly(f.pts, f.r || 0); panel(m, f.ramp || 'black', { base: f.base ?? 1, tag: TAG.back }); }
  // wheels (NDT tread, combat rims); duals drawn as an offset darker wheel behind
  for (const w of s.wheels) { const T = tire(w.tire), opt = { r: T.r / mm, tireFrac: T.frac, style: w.style || 'combat', paint: s.paint, tread: 'ndt' };
    const draw = (dx, dark) => { const wp = wheel(P, opt), x0 = Math.round(X(w.x + dx) - wp.w / 2), y0 = Math.round(Y(T.r) - wp.h / 2);
      for (let j = 0; j < wp.h; j++) for (let i = 0; i < wp.w; i++) { const k = j * wp.w + i; if (wp.r[k]) px.set(x0 + i, y0 + j, wp.r[k], dark ? Math.max(0, wp.l[k] - 1) : wp.l[k], TAG.wheel); } };
    if (w.dual) draw(60, true); draw(0, false); }
  // interior layer (seen over the tub edge / through the open cab): far-side wall, seats, dash, levers, folded top
  const shape = d => d.e ? M().ellipse(X(d.e[0]), Y(d.e[1]), Math.max(0.8, d.e[2] / mm), Math.max(0.8, d.e[3] / mm)) : d.band ? band(d.band, d.th || 30) : poly(d.pts, d.r || 0);
  for (const d of s.inner || []) panel(shape(d), d.ramp || 'black', { base: d.base ?? 1, tag: TAG.back, grad: d.grad !== false });
  // body panels (front to back order given by spec)
  for (const p of s.panels) { const m = p.e ? M().ellipse(X(p.e[0]), Y(p.e[1]), p.e[2] / mm, p.e[3] / mm) : poly(p.pts, p.r || 0); if (p.cut) for (const c of p.cut) m.sub(c.circle ? M().circle(X(c.circle[0]), Y(c.circle[1]), c.circle[2] / mm) : poly(c)); panel(m, p.ramp || 'OD', { base: p.base ?? 2, rivets: p.rivets || 0, tag: p.tag || TAG.body }); }
  // slatted / stake sides
  for (const sl of s.slats || []) { for (let k = 0; k < sl.n; k++) { const z0 = sl.z0 + k * (sl.z1 - sl.z0) / sl.n; panel(poly([[sl.x0, z0 + 20], [sl.x1, z0 + 20], [sl.x1, z0 + (sl.z1 - sl.z0) / sl.n - 20], [sl.x0, z0 + (sl.z1 - sl.z0) / sl.n - 20]]), sl.ramp || 'OD', { base: 2 }); }
    for (const x of sl.stakes || []) panel(poly([[x - 35, sl.z0 - 30], [x + 35, sl.z0 - 30], [x + 35, sl.z1 + 60], [x - 35, sl.z1 + 60]]), sl.ramp || 'OD', { base: 1 }); }
  // canvas: folds every ~250 mm, sagging lower edge, tie-down loops
  for (const cv of s.canvas || []) { const m = poly(cv.pts, cv.r || 60), r = id('canvasOD'), bb = m.bbox(), bow = Math.round((cv.bow || 450) / mm);
    for (let x = bb.x0; x <= bb.x1; x++) { const u = ((x - bb.x0) % bow) / bow, sag = Math.sin(u * Math.PI) > 0.55 ? 1 : 0;   // roof sags between bows
      let top = -1; for (let y = bb.y0; y <= bb.y1; y++) if (m.get(x, y)) { if (top < 0) top = y; const k = y - top, onBow = (x - bb.x0) % bow === 0;
        if (k < sag) continue; const fold = Math.sin(((x - bb.x0) / bow) * Math.PI * 2) * 0.6 + (((x * 7) % 13) < 2 ? -0.5 : 0);
        let lv = dith(x, y, 2.2 + 0.5 * fold - 0.6 * (y - bb.y0) / (bb.y1 - bb.y0), 0.25);
        if (k - sag < 2) lv = 3; if (onBow) lv = 3; if (!m.get(x, y + 1)) lv = 1;
        if (cv.seams && cv.seams.some(z => Math.abs(y - Y(z)) < 0.5)) lv = 1;
        px.set(x, y, r, lv, TAG.canvas); }
      if ((x - bb.x0) % bow === Math.round(bow / 2)) { const yb = (() => { for (let y = bb.y1; y >= bb.y0; y--) if (m.get(x, y)) return y; return -1; })(); if (yb > 0) { px.set(x, yb + 1, id('black'), 1, TAG.canvas); px.set(x, yb + 2, id('black'), 1, TAG.canvas); } } } }   // tie-downs
  // glass
  for (const g of s.glass || []) { const m = poly(g, 20); shadeGlassV2(px, m, id('glassP'), TAG.detail, { streak: 17 }); }
  for (const d of s.seen || []) { const m = shape(d); const gm = M(); for (const g of s.glass || []) gm.or(poly(g, 20)); m.and(gm); panel(m, d.ramp || 'black', { base: d.base ?? 0, tag: TAG.detail, bevel: false, grad: false }); }   // interior seen through the glass
  for (const g of s.celluloid || []) { const m = poly(g, 30); shadeGlassV2(px, m, id('celluloid'), TAG.canvas, { celluloid: true }); }
  // small hardware: lamps (blackout = tiny), hooks, tools, jerry cans, steering wheel, seats
  for (const d of s.details || []) { const m = d.e ? M().ellipse(X(d.e[0]), Y(d.e[1]), Math.max(0.8, d.e[2] / mm), Math.max(0.8, d.e[3] / mm)) : d.band ? band(d.band, d.th || 30) : poly(d.pts, d.r || 0); panel(m, d.ramp || 'black', { base: d.base ?? 1, tag: d.tag || TAG.detail, bevel: d.bevel !== false, grad: d.grad !== false }); }
  // stencils: generic star in ring, block-letter serial (meaningless)
  for (const st of s.stencils || []) {
    if (st.type === 'star') { const cx = X(st.x), cy = Y(st.z), R = st.r / mm; const star = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R * 0.42 : R * 0.86; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
      const ring = M().circle(cx, cy, R); ring.sub(M().circle(cx, cy, R - 1.2)); const sm = M().poly(star); for (const m of [ring, sm]) for (let i = 0; i < W * H; i++) if (m.a[i] && px.t[i] >= TAG.body) { px.r[i] = id('stencil'); px.l[i] = 3; } }
    if (st.type === 'text') for (let k = 0; k < st.n; k++) { const x0 = X(st.x) + k * 3; for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 2; xx++) if ((k * 7 + yy * 3 + xx) % 5 !== 0) { const i = Math.round(Y(st.z) + yy) * W + Math.round(x0 + xx); if (px.t[i] >= TAG.body) { px.r[i] = id('stencil'); px.l[i] = 2; } } }
  }
  // outline: everything except shadow, against empty only (matte panels keep their own edges)
  const mark = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!px.r[i] || px.t[i] === TAG.shadow) continue; const e = (xx, yy) => { if (xx < 0 || yy < 0 || xx >= W || yy >= H) return true; const j = yy * W + xx; return !px.r[j] || px.t[j] === TAG.shadow; }; if (e(x - 1, y) || e(x + 1, y) || e(x, y - 1) || e(x, y + 1)) mark.push(i); }
  for (const i of mark) px.l[i] = -1;
  if (s.anchor !== false) anchorFloating(px, P, { bodyTags: [TAG.body, TAG.canvas], wheelTags: [TAG.wheel, TAG.back] });
  px.X = X; px.Y = Y; px.mm = mm;
  return px;
}
