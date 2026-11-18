// Body + chassis + powertrain integration views, all driven by ONE mechanical definition (MechDef) in the vehicle's mm frame
// (x from the front tip, z up, y lateral). The same MechDef is the game's VehicleDef mechanical half.
//   xray(P, built, mech)      side X-ray: body ghosted to blueprint lines, wheels kept, mechanics in colour (engine sprite at vehicle scale)
//   chassisSide(P, spec, mech, builder)  rolling chassis alone (exploded view lower half)
//   underPlan(P, mech)        plan view from below: rails, cross-members, axles, springs, engine, boxes, shafts, exhaust, tank, wheels
import { Pix, Mask, line } from '../pix.mjs';
import { dith } from './car.mjs';
import { fillet } from './geom.mjs';
import { tire } from './tire.mjs';
import { engineSV } from './engineSV.mjs';
import { flatheadV8, ohvI6, gearbox } from './engine40.mjs';

function drawer(P, px, X, Y, mm) {
  let tag = 40; const M = () => new Mask(px.w, px.h);
  const poly = (pts, r = 0) => M().poly(fillet(pts.map(p => [p[0], p[1], p[2] ?? r]), 3).map(([x, z]) => [X(x), Y(z)]));
  const rect = (x0, z0, x1, z1, r = 0) => poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], r);
  const ell = (x, z, rx, rz) => M().ellipse(X(x), Y(z), Math.max(0.8, rx / mm), Math.max(0.8, rz / mm));
  const solid = (m, ramp, base = 2, grad = null) => { const t = tag++, r = P.id(ramp), bb = m.bbox(); if (bb.x1 < 0) return m;
    for (let y = bb.y0; y <= bb.y1; y++) for (let x = bb.x0; x <= bb.x1; x++) { if (!m.get(x, y)) continue; let lv = base;
      if (grad) lv = dith(x, y, grad[0] + (grad[1] - grad[0]) * (y - bb.y0) / Math.max(1, bb.y1 - bb.y0));
      if (!m.get(x, y - 1)) lv = Math.min(4, lv + 1); else if (!m.get(x, y + 1)) lv = Math.max(0, lv - 1);
      px.set(x, y, r, lv, t); } return m; };
  const band = (pts, th, ramp, base = 2) => { const m = M(), rr = Math.max(0.6, th / mm / 2); for (let i = 0; i + 1 < pts.length; i++) line(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]), (x, y) => m.circle(x + 0.5, y + 0.5, rr)); return solid(m, ramp, base); };
  const blit = (src, x, y) => { for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) { const k = j * src.w + i; if (src.r[k]) px.set(x + i, y + j, src.r[k], src.l[k], 200); } };
  return { poly, rect, ell, solid, band, blit, M };
}
export function engineSprite(P, e, mm) {
  if (e.kind === 'flathead_v8') return flatheadV8(P, e.opts, mm);
  if (e.kind === 'ohv_i6') return ohvI6(P, { ...e.opts, box: 'none' }, mm);
  const s = engineSV(P, e.opts, mm); s.ax = 170 / mm + 2; s.ay = s.h - 2 - 330 / mm; return s;     // side-valve inline (crank ~ z 0)
}
// mechanics in side view (shared by X-ray and exploded chassis)
export function drawMechSide(P, px, mech, { X = px.X, Y = px.Y, mm = px.mm } = {}) {
  const d = drawer(P, px, X, Y, mm), m = mech, f = m.frame;
  if (m.exhaust) d.band(m.exhaust, 45, 'iron', 1); if (m.muffler) d.solid(d.rect(m.muffler[0], m.muffler[2] - 70, m.muffler[1], m.muffler[2] + 70, 40), 'iron', 2);
  if (m.tank) d.solid(d.rect(...m.tank, 40), 'paint.tank', 2, [3, 1.2]);
  if (f.depth) d.band(f.line, f.depth, f.ramp || 'black', 2);   // unit body: no separate frame
  for (const x of f.cross || []) { const z = zAt(f.line, x); if (z != null) d.solid(d.rect(x - 40, z - f.depth / 2, x + 40, z + f.depth / 2), 'iron', 3); }
  for (const ax of m.axles) { const T = tire(m.tire), z = T.r;
    if (ax.spring === 'transverse') { for (let k = 0; k < 5; k++) d.solid(d.rect(ax.x - 60 - (4 - k) * 70, z + 200 + k * 22, ax.x + 60 + (4 - k) * 70, z + 216 + k * 22), 'iron', 2); d.band([[ax.x, z], [ax.x + (ax.radius || 900), z + 120]], 40, 'iron', 2); }
    if (ax.spring === 'leaf') { const L = ax.springLen || 1000, zs = z + (ax.springUp ?? 110); for (let k = 0; k < 4; k++) d.band([[ax.x - L / 2 + k * L * 0.1, zs + 30 + k * 18], [ax.x, zs - 25 + k * 18], [ax.x + L / 2 - k * L * 0.1, zs + 30 + k * 18]], 18, 'iron', k ? 1 : 2);
      d.band([[ax.x - L / 2, zs + 30], [ax.x - L / 2 - 20, zAt(f.line, ax.x - L / 2) ?? zs + 120]], 22, 'iron', 2); }
    if (ax.spring === 'inverted') { const L = ax.springLen || 1300, zs = z + 260; for (let k = 0; k < 4; k++) d.band([[ax.x - L / 2 + k * L * 0.08, zs - 20 - k * 18], [ax.x, zs + 30 - k * 18], [ax.x + L / 2 - k * L * 0.08, zs - 20 - k * 18]], 20, 'iron', k ? 1 : 2);
      d.solid(d.rect(ax.x - 90, zs - 40, ax.x + 90, zs + 120, 30), 'iron', 2); }
    if (ax.drive) d.solid(d.ell(ax.x + (ax.diffDx || 0), z, ax.diffR || 140, (ax.diffR || 140) * 0.85), 'paint.tank', 2, [3, 1.2]);
    if (!ax.virtual) d.solid(d.ell(ax.x, z, 60, 60), 'iron', 3); }
  if (m.radiator) { const r = d.rect(...m.radiator); d.solid(r, 'iron', 1); for (let y = 0; y < r.h; y += 2) for (let x = 0; x < r.w; x++) if (r.get(x, y)) px.set(x, y, P.id('iron'), 3, 41); }
  for (const s of m.shafts || []) d.band(s, s.th || 50, 'chrome', 2);
  const g = m.gearbox; if (g) d.solid(d.poly([[g.x0, g.z - 150], [g.x1, g.z - 110], [g.x1, g.z + 110], [g.x0, g.z + 150]], 30), 'alu', 2, [3.2, 1.2]);
  if (g && g.lever) { d.band([[ (g.x0 + g.x1) / 2, g.z + 120], g.lever], 22, 'black', 2); d.solid(d.ell(...g.lever, 28, 28), 'black', 3); }
  if (m.transfer) { const t = m.transfer; d.solid(d.rect(t.x0, t.z - 170, t.x1, t.z + 130, 30), 'alu', 2, [3.2, 1]); for (const lv of t.levers || []) { d.band([[lv[0], t.z + 120], lv], 18, 'black', 2); d.solid(d.ell(...lv, 22, 22), 'black', 3); } }
  if (m.engine) { const e = m.engine, spr = engineSprite(P, e, mm); d.blit(spr, Math.round(X(e.x) - spr.ax), Math.round(Y(e.z) - spr.ay)); }
  if (m.steering) { d.band(m.steering, 26, 'iron', 1); d.solid(d.rect(m.steering[0][0] - 50, m.steering[0][1] - 50, m.steering[0][0] + 50, m.steering[0][1] + 60), 'iron', 2); }
  if (m.battery) d.solid(d.rect(...m.battery), 'black', 2);
  return px;
}
// X-ray over an already built side sprite (civil buildCar or military buildMil): ghost body, keep wheels (tag 3)
export function xray(P, built, mech) {
  const px = built, ghost = P.id('ghost');
  for (let i = 0; i < px.r.length; i++) { if (!px.r[i] || px.t[i] === 1) { px.r[i] = 0; continue; } if (px.t[i] === 3) continue;
    if (px.l[i] < 0) { px.r[i] = ghost; px.l[i] = 3; px.t[i] = 5; } else px.r[i] = 0; }
  drawMechSide(P, px, mech);
  const W = px.w, mark = []; for (let y = 0; y < px.h; y++) for (let x = 0; x < W; x++) { const t = px.tag(x, y); if (!px.ramp(x, y) || t < 40) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rn = px.ramp(x + dx, y + dy); if (!rn || rn === ghost) { mark.push(y * W + x); break; } } }
  for (const i of mark) px.l[i] = -1;
  return px;
}
// plan view from below (y lateral). Kept deliberately schematic but to scale.
export function underPlan(P, mech, mm = 12.5) {
  const m = mech, len = m.len, wid = m.width, pad = 4, w = Math.ceil(len / mm) + pad * 2, h = Math.ceil(wid / mm) + pad * 2, px = new Pix(w, h);
  const X = x => x / mm + pad, Y = y => h / 2 + y / mm, d = drawer(P, px, X, Y, mm), T = tire(m.tire), tr = m.track / 2;
  const rect = (x0, y0, x1, y1, r = 0) => d.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], r);
  if (m.floor) d.solid(rect(m.floor[0], -wid / 2 + 60, m.floor[1], wid / 2 - 60, 80), 'floor', 2);
  for (const ax of m.axles.filter(a => !a.virtual)) for (const sg of [1, -1]) { const dual = ax.dual ? [0, 1] : [0];
    for (const k of dual) d.solid(rect(ax.x - T.r, sg * (tr + k * T.section * 1.15) - T.section * 0.55, ax.x + T.r, sg * (tr + k * T.section * 1.15) + T.section * 0.55, 60), 'rubber', 2); }
  if (m.exhaust) d.band(m.exhaust.map(([x]) => [x, m.exhaustY || 250]), 45, 'iron', 1);
  if (m.tank) d.solid(rect(m.tank[0], m.tankY ? m.tankY[0] : 150, m.tank[2], m.tankY ? m.tankY[1] : 600, 40), 'paint.tank', 2);
  const fw = m.frame.width / 2; for (const sg of [1, -1]) d.band([[m.frame.line[0][0], sg * fw * (m.frame.taper || 0.8)], [m.frame.line[0][0] + 600, sg * fw], [m.frame.line.at(-1)[0], sg * fw]], 80, 'black', 2);
  if (m.frame.type === 'x_member') { const xm = (m.axles[0].x + m.axles.at(-1).x) / 2; d.band([[xm - 900, -fw], [xm + 900, fw]], 90, 'black', 2); d.band([[xm - 900, fw], [xm + 900, -fw]], 90, 'black', 2); }
  for (const x of m.frame.cross || []) d.band([[x, -fw], [x, fw]], 70, 'iron', 2);
  for (const ax of m.axles) { if (ax.virtual) { for (const sg of [1, -1]) d.solid(rect(ax.x - 110, sg * (m.springY || fw) - 70, ax.x + 110, sg * (m.springY || fw) + 70, 30), 'iron', 3); } else d.band([[ax.x, -tr], [ax.x, tr]], 90, ax.drive ? 'paint.tank' : 'iron', 2); if (ax.drive && !ax.virtual) d.solid(d.ell(ax.x, ax.diffDy || 0, 150, 170), 'paint.tank', 3);
    if (ax.spring) for (const sg of [1, -1]) d.band([[ax.x - (ax.springLen || 1000) / 2, sg * (m.springY || fw)], [ax.x + (ax.springLen || 1000) / 2, sg * (m.springY || fw)]], 60, 'iron', 3); }
  for (const s of m.shafts || []) d.band(s.map(([x]) => [x, s.y || 0]), 50, 'chrome', 3);
  const e = m.engine; d.solid(rect(e.x, -e.w / 2, e.x + e.len, e.w / 2, 40), e.color || 'iron', 2, [2.8, 1.2]); d.solid(rect(e.x + 60, -e.w / 2 + 50, e.x + e.len - 40, e.w / 2 - 50, 60), e.color || 'iron', 1);   // block + sump
  const g = m.gearbox; d.solid(rect(g.x0, -120, g.x1, 120, 40), 'alu', 2); if (m.transfer) d.solid(rect(m.transfer.x0, -60, m.transfer.x1, 260, 30), 'alu', 3);
  if (m.radiator) d.solid(rect(m.radiator[0], -m.width * 0.32, m.radiator[2], m.width * 0.32), 'iron', 1);
  const W = px.w, mark = []; for (let y = 0; y < px.h; y++) for (let x = 0; x < W; x++) { if (!px.ramp(x, y)) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !px.ramp(x + dx, y + dy))) mark.push(y * W + x); }
  for (const i of mark) px.l[i] = -1;
  return px;
}
function zAt(line, x) { for (let i = 0; i + 1 < line.length; i++) { const [x0, z0] = line[i], [x1, z1] = line[i + 1]; if (x >= x0 && x <= x1) return z0 + (z1 - z0) * (x - x0) / (x1 - x0); } return null; }
