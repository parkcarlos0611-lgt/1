// X-ray side view: ghosted body outline + frame, suspension, engine, drivetrain, tank, exhaust in colour.
import { Mask, View, smooth, line, polyline } from '../pix.mjs';
import { buildCar, TAG } from './car.mjs';
import { engineSide, leafSpring } from './props.mjs';
import { tire } from './tire.mjs';

class Sk {  // mm-space solids on the car view
  constructor(P, px, v) { this.P = P; this.px = px; this.v = v; this.tag = 20; }
  M() { return new Mask(this.px.w, this.px.h); }
  poly(pts, sm = 0) { return this.M().poly(smooth(this.v.P(pts), sm)); }
  rect(x0, z0, x1, z1) { return this.poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]); }
  ell(x, z, rx, rz) { const v = this.v; return this.M().ellipse(v.X(x), v.Y(z), Math.max(0.8, v.R(rx)), Math.max(0.8, v.R(rz))); }
  band(pts, th) { // thick polyline in mm
    const m = this.M(); const v = this.v; const rr = Math.max(0.6, v.R(th) / 2);
    for (let i = 0; i + 1 < pts.length; i++) line(v.X(pts[i][0]), v.Y(pts[i][1]), v.X(pts[i + 1][0]), v.Y(pts[i + 1][1]), (x, y) => m.circle(x + 0.5, y + 0.5, rr));
    return m;
  }
  solid(m, ramp, base = 2, flat = false) {
    const t = this.tag++, P = this.P, px = this.px, r = typeof ramp === 'string' ? P.id(ramp) : ramp;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { if (!m.get(x, y)) continue; let lv = base;
      if (!flat) { if (!m.get(x, y - 1)) lv = base + 2; else if (!m.get(x, y + 1)) lv = base - 1; }
      px.set(x, y, r, Math.max(0, Math.min(4, lv)), t); }
  }
  blit(src, x, y, flip) { const s = flip ? src.flipped() : src; for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) { const k = j * s.w + i; if (s.r[k]) this.px.set(x + i, y + j, s.r[k], s.l[k], 20 + (s.t[k] % 200) + 30); } }
}

export function buildXray(P, def, mm = 25) {
  const car = buildCar(P, def.body, mm), px = car; const v = new View(def.body.len, def.body.height + 40, mm, 3);
  const ghost = P.id('ghost');
  // 1) ghost body: keep wheels, turn outlines & shut lines into blueprint lines, clear the rest
  for (let i = 0; i < px.r.length; i++) {
    if (!px.r[i] || px.t[i] === TAG.shadow) { px.r[i] = 0; continue; }
    if (px.t[i] === TAG.wheel) continue;
    if (px.l[i] < 0 || px.t[i] === TAG.frame || (px.t[i] === TAG.body && px.l[i] === 0)) { px.r[i] = ghost; px.l[i] = px.l[i] < 0 ? 3 : 1; px.t[i] = 5; }
    else px.r[i] = 0;
  }
  const s = new Sk(P, px, v), pf = def.platform, e = def.engine, d = def.drivetrain;
  const T = tire(pf.tire);
  // exhaust + muffler (lowest)
  if (def.exhaust && def.exhaust.length) s.solid(s.band(def.exhaust, 45), 'iron', 1);
  if (def.muffler) s.solid(s.poly([[def.muffler[0], 330], [def.muffler[1], 330], [def.muffler[1], 470], [def.muffler[0], 470]], 1), 'iron', 2);
  // frame rails (+ unit-body sills), crossmember ends
  s.solid(s.band(pf.frame.line, pf.frame.depth), 'black', 2);
  if (pf.frame.sill) s.solid(s.band(pf.frame.sill, 70), 'black', 1);
  for (const x of pf.frame.cross || []) { const z = zAt(pf.frame.line, x); if (z != null) s.solid(s.rect(x - 35, z - 45, x + 35, z + 45), 'iron', 3, true); }
  // suspension per axle
  for (const ax of [pf.front, pf.rear]) {
    const x = ax.x, zc = T.r, t = ax.type;
    s.solid(s.ell(x, zc, 70, 70), 'iron', 3);                                                      // hub / axle end
    if (t.includes('transverse_leaf')) { const zt = zc + 230; for (let k = 0; k < 5; k++) s.solid(s.rect(x - 45 + k * 4, zt + k * 22, x + 45 - k * 4, zt + k * 22 + 16), 'iron', 2, true);
      s.solid(s.band([[x, zc], [x + (ax === pf.front ? 900 : -800), zc + 120]], 40), 'iron', 2); }   // radius rod / wishbone
    if (t.includes('semi_elliptic')) { const ls = leafSpring(P, 5, 1250, mm); s.blit(ls, Math.round(v.X(x) - ls.w / 2), Math.round(v.Y(zc + 230) - ls.h / 2)); }
    if (t.startsWith('trailing_arm')) { s.solid(s.band([[x, zc], [x - 380, zc + 80]], 50), 'iron', 2); for (let k = 0; k < 4; k++) s.solid(s.rect(x - 420, zc + 120 + k * 20, x - 330, zc + 134 + k * 20), 'iron', 2, true); }
    if (t.startsWith('beam') || t.startsWith('dead')) { if (ax === pf.rear && d.layout === 'FR') s.solid(s.ell(x, zc, 150, 140), 'iron', 2); }
  }
  // radiator core
  if (def.radiator) { const [x0, z0, x1, z1] = def.radiator; const m = s.rect(x0, z0, x1, z1); s.solid(m, 'iron', 1, true); for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) && y % 2 === 0) px.set(x, y, P.id('iron'), 3, s.tag - 1); }
  // gearbox + drive
  const [g0, g1] = d.gbX; s.solid(s.poly([[g0, e.z - 160], [g1, e.z - 110], [g1, e.z + 90], [g0, e.z + 150]], 1), 'alu', 2);
  if (d.layout === 'FR') s.solid(s.band([[g1, e.z - 30], [pf.rear.x - 140, T.r + 20]], d.drive === 'torque_tube' ? 80 : 55), d.drive === 'torque_tube' ? 'black' : 'iron', 2);
  if (d.layout === 'FF') s.solid(s.ell(pf.front.x, T.r + 40, 120, 110), 'alu', 2);           // final drive at axle line
  // engine (module-assembled at vehicle scale)
  const eng = engineSide(P, { ...e }, mm);
  const ex = e.flip ? Math.round(v.X(e.x) - (eng.w - eng.ax)) : Math.round(v.X(e.x) - eng.ax);
  s.blit(eng, ex, Math.round(v.Y(e.z) - eng.ay), e.flip);
  // fuel tank, battery, steering
  if (def.fuel) { const [x0, z0, x1, z1] = def.fuel.box; s.solid(s.poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 1), 'paint.tank', 2); }
  if (def.battery) { const [x0, z0, x1, z1] = def.battery; s.solid(s.rect(x0, z0, x1, z1), 'black', 2); }
  if (def.steering) { const [a, b] = def.steering; s.solid(s.band([a, b], 40), 'black', 2); s.solid(s.ell(b[0], b[1], 30, 200), 'black', 3); }
  // outline mech parts (tags >= 20) against empty / ghost / lower parts
  const W = px.w, H = px.h, mark = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = px.tag(x, y); if (!px.ramp(x, y) || t < 20) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rn = px.ramp(x + dx, y + dy), tn = px.tag(x + dx, y + dy); if (!rn || rn === ghost || (tn >= 20 && tn < t - 30 && false)) { mark.push(y * W + x); break; } } }
  for (const i of mark) px.l[i] = -1;
  return px;
}
function zAt(line, x) { for (let i = 0; i + 1 < line.length; i++) { const [x0, z0] = line[i], [x1, z1] = line[i + 1]; if (x >= x0 && x <= x1) return z0 + (z1 - z0) * (x - x0) / (x1 - x0); } return null; }
