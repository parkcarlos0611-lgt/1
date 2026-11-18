// Detailed ladder-frame design and drawings (plan 18). The frame is designed on its own (wheelbase, track, rail section, taper,
// kick-up, double drop, cross-members, joints, mounts) and drawn large: rails with web and flanges, rivet rows or weld seams,
// gussets, spring hangers, engine and body mounts, bumper horns. The body is chosen later and has to fit this frame.
import { Pix, Mask, line } from '../../pix.mjs';
import { fillet } from '../geom.mjs';
import { tire } from '../tire.mjs';
import { FRAME_TYPES } from './platform.mjs';

export const isLadder = pl => ['ladderC', 'ladderX', 'boxX'].includes(pl.type);
export function frameDefaults(pl, year = 1935) { const d = { wb: 2800, width: 1750, railW: 65, taper: 0.78, drop: 0, join: year >= 1938 ? 'weld' : 'rivet', gusset: false, mounts: 8, sill: 1, brace: false };
  for (const k of Object.keys(d)) if (pl[k] == null) pl[k] = d[k]; return pl; }
export function clampFrame(pl, year) { frameDefaults(pl, year); const c = (k, a, b) => { pl[k] = Math.max(a, Math.min(b, pl[k])); };
  c('wb', 2000, 4430); c('width', 1400, 2215); c('railW', 40, 100); c('taper', 0.6, 0.95); c('drop', 0, year >= 1932 ? 120 : 0); c('mounts', 6, 14); c('sill', 0.8, 1.4); pl.mounts = Math.round(pl.mounts / 2) * 2;
  if (pl.join === 'weld' && year < 1936) pl.join = 'rivet'; return pl; }
// the frame's own geometry (mm): no body needed
export function frameGeo(pl, tireCode = '6.00-16') { const T = tire(tireCode), F = 640, R = F + pl.wb;
  return { noseX: 0, F, R, tailX: R + 980, cowlX: F + pl.wb * 0.4, r: T.r, gap: T.r + 70, track: pl.width - 300, width: pl.width, tire: tireCode }; }
// cross-member stations in order of importance
export function stations(pl, g) { const all = [[g.noseX + 110, 'FRONT'], [g.tailX - 110, 'REAR'], [g.cowlX + 260, 'GEARBOX'], [g.R - 640, 'SPRING HANGER'], [(g.cowlX + g.R) / 2 + 150, 'CENTRE'], [g.R + 300, 'KICK-UP'], [g.F + 520, 'ENGINE'], [g.R - 1100, 'SEAT']];
  return all.slice(0, pl.cross).sort((a, b) => a[0] - b[0]); }
export function railZ(pl, g) { const fz = g.r + 150, k = pl.kick, dr = pl.drop || 0;      // rail centre line in side view: front arch, dropped centre, rear kick-up
  return [[g.noseX + 40, fz + 60], [g.F - 250, fz + 50], [g.F + 320, fz + 30], [g.cowlX, fz - dr], [g.R - 620, fz - dr], [g.R - 240, fz + k], [g.R + 360, fz + k], [g.tailX - 60, fz + k - Math.min(50, k / 2)]]; }
const zAt = (ln, x) => { for (let i = 0; i + 1 < ln.length; i++) if (x >= ln[i][0] && x <= ln[i + 1][0]) return ln[i][1] + (ln[i + 1][1] - ln[i][1]) * (x - ln[i][0]) / Math.max(1, ln[i + 1][0] - ln[i][0]); return ln[x < ln[0][0] ? 0 : ln.length - 1][1]; };
// load test: where the frame is weakest (margins > 1 are safe)
export function frameZones(pl, g, base, { heavy = false } = {}) {
  const J = pl.join === 'weld' ? 1.05 : 1, st = stations(pl, g).map(s => s[1]);
  return [{ id: 'front', name: 'FRONT HORNS', x0: g.noseX, x1: g.F + 350, margin: base.margin0 * (0.78 + pl.taper * 0.34) * (st.includes('ENGINE') ? 1.08 : 1) },
    { id: 'mid', name: 'CENTRE SPAN', x0: g.cowlX, x1: g.R - 620, margin: base.margin0 * (1 - (pl.drop || 0) / 700) * (st.includes('CENTRE') ? 1.06 : 1) },
    { id: 'kick', name: 'REAR KICK-UP', x0: g.R - 620, x1: g.R + 400, margin: base.margin0 * (1 - pl.kick / 520) * (pl.gusset ? 1.35 : 1) * J * (st.includes('KICK-UP') ? 1.08 : 1) },
    { id: 'tors', name: 'TWIST', x0: g.noseX, x1: g.tailX, margin: base.stiff / (heavy ? 0.62 : 0.42) }]; }

// ---- drawing ----
const STEEL = 'bare';
function canvas(wMM, hMM, mm, pad = 3) { const w = Math.ceil(wMM / mm) + pad * 2, h = Math.ceil(hMM / mm) + pad * 2; return { px: new Pix(w, h), w, h, pad, M: () => new Mask(w, h) }; }
function paint(P, px, m, ramp, lvFn, tag = 40) { const r = P.id(ramp), bb = m.bbox(); if (bb.x1 < 0) return; for (let y = bb.y0; y <= bb.y1; y++) for (let x = bb.x0; x <= bb.x1; x++) if (m.get(x, y)) px.set(x, y, r, Math.max(0, Math.min(4, lvFn(x, y, m))), tag); }
const flat = lv => (x, y, m) => (!m.get(x, y - 1) ? lv + 1 : !m.get(x, y + 1) ? lv - 1 : lv);
const bandMask = (M, X, Y, pts, th, mm) => { const m = M(), rr = Math.max(0.8, th / mm / 2); for (let i = 0; i + 1 < pts.length; i++) line(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]), (x, y) => m.circle(x + 0.5, y + 0.5, rr)); return m; };
// plan view from above. stage: 1 rails, 2 + cross-members, 3 + hangers, mounts, axles
export function framePlan(P, pl, g, mm = 15, { stage = 3 } = {}) {
  const T = tire(g.tire), F = FRAME_TYPES[pl.type], wid = Math.max(g.width, g.track + T.section * 1.3) + 120, c = canvas(g.tailX - g.noseX + 120, wid, mm), { px, M } = c;
  const X = x => (x - g.noseX + 60) / mm + c.pad, Y = y => c.h / 2 + y / mm, rect = (x0, y0, x1, y1, r = 0) => M().poly(fillet([[x0, y0, r], [x1, y0, r], [x1, y1, r], [x0, y1, r]], 3).map(([x, y]) => [X(x), Y(y)]));
  const rY = Math.min(g.track / 2 - 170, 580), tp = pl.taper, W = pl.railW * (F.box ? 1.15 : 1), dot = (x, y, lv, ramp = STEEL) => { const xx = Math.round(X(x)), yy = Math.round(Y(y)); if (px.ramp(xx, yy)) px.set(xx, yy, P.id(ramp), lv, 41); };
  if (stage >= 3) { for (const ax of [g.F, g.R]) for (const sg of [1, -1]) paint(P, px, rect(ax - T.r, sg * g.track / 2 - T.section * 0.55, ax + T.r, sg * g.track / 2 + T.section * 0.55, 70), 'rubber', flat(1), 3);
    for (const ax of [g.F, g.R]) paint(P, px, bandMask(M, X, Y, [[ax, -g.track / 2 + T.section * 0.5], [ax, g.track / 2 - T.section * 0.5]], 70, mm), ax === g.R ? 'paint.tank' : 'iron', flat(2));
    paint(P, px, M().circle(X(g.R), Y(0), 150 / mm), 'paint.tank', flat(2));                                                                 // differential
    for (const sg of [1, -1]) for (const [a, b] of [[g.F - 430, g.F + 430], [g.R - 640, g.R + 560]]) paint(P, px, bandMask(M, X, Y, [[a, sg * (rY * (a < g.cowlX ? tp : 1) + W * 0.2)], [b, sg * (rY * (b < g.cowlX ? tp : 1) + W * 0.2)]], 45, mm), 'iron', flat(1)); }   // leaf springs under the rails
  const railPts = sg => [[g.noseX + 40, sg * rY * tp], [g.F + 380, sg * rY * tp], [g.cowlX + 80, sg * rY], [g.tailX - 60, sg * rY]], sts = stations(pl, g);
  if (stage >= 2) { for (const [x, nm] of sts) { const y = rY * (x < g.F + 380 ? tp : x < g.cowlX + 80 ? tp + (1 - tp) * (x - g.F - 380) / (g.cowlX - g.F - 300) : 1);
      paint(P, px, bandMask(M, X, Y, [[x, -y], [x, y]], pl.xType === 'tube' ? 55 : 75, mm), STEEL, flat(pl.xType === 'tube' ? 3 : 1));
      if (pl.xType !== 'tube' || pl.gusset) for (const sg of [1, -1]) for (const dx of [-1, 1]) paint(P, px, M().poly([[X(x), Y(sg * (y - W / 2))], [X(x + dx * 110), Y(sg * (y - W / 2))], [X(x), Y(sg * (y - W / 2 - 110))]]), STEEL, () => 3); }   // gussets
    if (F.x) { const a = g.cowlX + 160, b = g.R - 460; for (const s2 of [1, -1]) paint(P, px, bandMask(M, X, Y, [[a, -s2 * rY * 0.95], [b, s2 * rY * 0.95]], W * 0.95, mm), STEEL, flat(2));
      paint(P, px, M().poly([[X((a + b) / 2 - 170), Y(0)], [X((a + b) / 2), Y(-120)], [X((a + b) / 2 + 170), Y(0)], [X((a + b) / 2), Y(120)]]), STEEL, () => 3); } }   // X-member with its centre plate
  for (const sg of [1, -1]) { const m = bandMask(M, X, Y, railPts(sg), W, mm);                                                                    // rail: dark web on the outside, bright flange edge inside
    paint(P, px, m, STEEL, (x, y, mk) => { const out = !mk.get(x, y + sg) || !mk.get(x, y + 2 * sg), inn = !mk.get(x, y - sg); return F.box ? (out || inn ? 1 : 3) : out ? 0 : inn ? 4 : 2; });
    if (stage >= 2) for (const [x] of sts) for (const dx of [-70, -25, 25, 70]) { const y = rY * (x < g.F + 380 ? tp : x < g.cowlX + 80 ? tp + (1 - tp) * (x - g.F - 380) / (g.cowlX - g.F - 300) : 1); dot(x + dx, sg * y, pl.join === 'weld' ? 1 : 4); }   // rivets / weld beads at every joint
    if (stage >= 3) { const n = pl.mounts / 2; for (let k = 0; k < n; k++) { const x = g.cowlX - 250 + (g.tailX - 300 - g.cowlX + 250) * k / Math.max(1, n - 1); paint(P, px, rect(x - 40, sg * (rY + W / 2) - (sg > 0 ? 0 : 70), x + 40, sg * (rY + W / 2) + (sg > 0 ? 70 : 0), 10), STEEL, () => 4); dot(x, sg * (rY + W / 2 + 35), 0); }   // body mount pads
      for (const x of [g.F + 140, g.F + 620]) paint(P, px, rect(x - 50, sg * (rY * tp - W / 2) - (sg > 0 ? 110 : 0), x + 50, sg * (rY * tp - W / 2) + (sg > 0 ? 0 : 110), 10), 'iron', flat(3));   // engine mounts
      for (const x of [g.F - 430, g.F + 430, g.R - 640, g.R + 560]) paint(P, px, rect(x - 35, sg * (rY * (x < g.cowlX ? tp : 1)) - 45, x + 35, sg * (rY * (x < g.cowlX ? tp : 1)) + 45, 8), 'iron', flat(1)); } }   // spring hangers / shackles
  px.X = X; px.Y = Y; px.mm = mm; return px;
}
// side view: deep rail with flanges, front arch, dropped centre, kick-up, cross-member ends, hangers, springs, mounts
export function frameSide(P, pl, g, mm = 15, { stage = 3, into = null, X: X0 = null, Z: Z0 = null } = {}) {
  const T = tire(g.tire), F = FRAME_TYPES[pl.type], c = into ? { px: into, w: into.w, h: into.h, M: () => new Mask(into.w, into.h) } : canvas(g.tailX - g.noseX + 120, T.od + pl.kick + 380, mm), { px, M } = c;
  const X = X0 || (x => (x - g.noseX + 60) / mm + c.pad), Z = Z0 || (z => c.h - c.pad - z / mm), ln = railZ(pl, g), H = pl.railH;
  if (stage >= 3 && !into) for (const ax of [g.F, g.R]) { const m = M().circle(X(ax), Z(T.r), T.r / mm); m.sub(M().circle(X(ax), Z(T.r), T.r / mm - 1.2)); paint(P, px, m, 'rubber', () => 2, 3); paint(P, px, M().circle(X(ax), Z(T.r), 70 / mm + 0.5), 'iron', flat(2)); }
  if (stage >= 3) for (const [ax, L2] of [[g.F, 860], [g.R, 1200]]) { for (let k = 0; k < 4; k++) paint(P, px, bandMask(M, X, Z, [[ax - L2 / 2 + k * L2 * 0.1, T.r + 150 + k * 16], [ax, T.r + 95 + k * 16], [ax + L2 / 2 - k * L2 * 0.1, T.r + 150 + k * 16]], 18, mm), 'iron', () => (k ? 1 : 2));   // leaf springs
    for (const hx of [ax - L2 / 2, ax + L2 / 2]) paint(P, px, M().poly([[X(hx - 45), Z(zAt(ln, hx) - H / 2)], [X(hx + 45), Z(zAt(ln, hx) - H / 2)], [X(hx + 15), Z(T.r + 140)], [X(hx - 15), Z(T.r + 140)]]), 'iron', flat(2)); }   // hangers / shackles
  const rail = bandMask(M, X, Z, ln, H, mm);
  paint(P, px, rail, STEEL, (x, y, mk) => (!mk.get(x, y - 1) ? 4 : !mk.get(x, y - 2) ? 3 : !mk.get(x, y + 1) ? 0 : !mk.get(x, y + 2) ? 1 : F.box ? 3 : 2));                                           // top flange bright, bottom flange dark, web between
  if (pl.gusset) { const gm = M().poly([[X(g.R - 700), Z(zAt(ln, g.R - 700) - H * 0.4)], [X(g.R - 180), Z(zAt(ln, g.R - 180) - H * 0.4)], [X(g.R - 180), Z(zAt(ln, g.R - 180) + H * 0.4)], [X(g.R - 700), Z(zAt(ln, g.R - 700) + H * 0.4)]]); gm.and(rail); paint(P, px, gm, STEEL, () => 4);
    for (let x = g.R - 660; x < g.R - 200; x += 110) for (const dz of [-0.25, 0.25]) px.set(Math.round(X(x)), Math.round(Z(zAt(ln, x) + H * dz)), P.id(STEEL), 0, 41); }   // fish plate over the kick-up
  if (stage >= 2) for (const [x] of stations(pl, g)) { const z = zAt(ln, x); if (pl.xType === 'tube') paint(P, px, M().circle(X(x), Z(z), Math.max(1.2, 30 / mm)), STEEL, () => 0); else paint(P, px, M().poly([[X(x - 38), Z(z - H * 0.3)], [X(x + 38), Z(z - H * 0.3)], [X(x + 38), Z(z + H * 0.3)], [X(x - 38), Z(z + H * 0.3)]]), STEEL, () => 1);
    for (const dx of [-80, 80]) for (const dz of [-0.28, 0.28]) { const xx = Math.round(X(x + dx)), yy = Math.round(Z(zAt(ln, x + dx) + H * dz)); if (rail.get(xx, yy)) px.set(xx, yy, P.id(STEEL), pl.join === 'weld' ? 1 : 4, 41); } }   // rivets / weld beads
  if (stage >= 3) { const n = pl.mounts / 2; for (let k = 0; k < n; k++) { const x = g.cowlX - 250 + (g.tailX - 300 - g.cowlX + 250) * k / Math.max(1, n - 1), z = zAt(ln, x) + H / 2; paint(P, px, M().poly([[X(x - 45), Z(z)], [X(x + 45), Z(z)], [X(x + 35), Z(z + 45)], [X(x - 35), Z(z + 45)]]), 'rubber', () => 2); }   // body mount pads
    for (const x of [g.F + 140, g.F + 620]) { const z = zAt(ln, x) + H / 2; paint(P, px, M().poly([[X(x - 55), Z(z)], [X(x + 55), Z(z)], [X(x + 30), Z(z + 90)], [X(x - 30), Z(z + 90)]]), 'iron', flat(3)); }   // engine mounts
    for (const [x, d] of [[g.noseX + 40, -1], [g.tailX - 60, 1]]) { const z = zAt(ln, x); paint(P, px, M().poly([[X(x), Z(z - H * 0.35)], [X(x + d * 150), Z(z - H * 0.2)], [X(x + d * 150), Z(z + H * 0.2)], [X(x), Z(z + H * 0.35)]]), 'iron', flat(2)); } }   // bumper horns
  if (!into) { px.X = X; px.Y = Z; px.mm = mm; } return px;
}
// rail cross-section, drawn big: channel (web + two flanges), box, or the backbone tube
export function frameSection(P, pl, mm = 1.5) {
  const F = FRAME_TYPES[pl.type], H = pl.railH, W = pl.type === 'platform' ? pl.railH : pl.railW * (F.box ? 1.15 : 1), t = Math.max(mm * 1.5, pl.railT), c = canvas(W + 20, H + 20, mm), { px, M } = c, X = x => (x + 10) / mm + c.pad, Y = y => (y + 10) / mm + c.pad;
  const r = (x0, y0, x1, y1) => M().poly([[X(x0), Y(y0)], [X(x1), Y(y0)], [X(x1), Y(y1)], [X(x0), Y(y1)]]);
  if (pl.type === 'platform') { const m = M().circle(X(W / 2), Y(H / 2), H / 2 / mm); m.sub(M().circle(X(W / 2), Y(H / 2), (H / 2 - t) / mm)); paint(P, px, m, STEEL, flat(2)); }
  else { const m = r(0, 0, t, H); m.or(r(0, 0, W, t)); m.or(r(0, H - t, W, H)); if (F.box) m.or(r(W - t, 0, W, H)); paint(P, px, m, STEEL, flat(2)); }
  return px;
}
