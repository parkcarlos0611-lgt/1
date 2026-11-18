// Track driving seen from behind the car (plans 19-3 and 23). The car is the real-time model in sim/dyn.mjs:
// body heave / roll / pitch, wheels on their own springs, bias-ply tyres, clutch and gearbox, drums that fade.
// One camera for everything: 6.5 m behind and 1.7 m up, about 50 degrees across, so the car, the road width,
// trees and posts all keep their real sizes; the car sprite lands at exactly twice its 25 mm/px drawing.
import { W, H, C, text, button, input, held, bevel, lineTo, N, lang, tw } from './ui.mjs';
import { hex } from '../tools/pixel/color.mjs';
import { Sheet } from '../tools/pixel/pix.mjs';
import { makeCar, stepCar, requestShift, rpmOf } from '../sim/dyn.mjs';

// ---- tracks: straights and turns (right turns positive degrees), grade, banking (deg), rough surface; road width in metres ----
const S_ = (len, o = {}) => ({ len, ...o }), T_ = (R, deg, o = {}) => ({ len: Math.abs(R * deg * Math.PI / 180), k: Math.sign(deg) / R, ...o });
export const TRACKS = [
  { kind: 'TEST ROAD', surf: 'tar', laps: 2, width: 6.5, segs: [S_(500), T_(150, 90), S_(150, { grade: 0.10 }), S_(150, { grade: -0.10 }), T_(60, 90), S_(300, { rough: 1 }), T_(100, 60), T_(80, -30), S_(150), T_(120, 120), S_(200), T_(150, 30), S_(120)] },
  { kind: 'BANKED OVAL', surf: 'con', laps: 3, width: 15, segs: [S_(600), T_(250, 180, { bank: 22 }), S_(600), T_(250, 180, { bank: 22 })] },
  { kind: 'ROAD CIRCUIT', surf: 'tar', laps: 2, width: 10, segs: [S_(700), T_(40, 90), S_(250), T_(120, -45), T_(90, 90), S_(300, { grade: 0.05 }), T_(200, 60), S_(400, { grade: -0.05 }), T_(60, -60), T_(70, 150), S_(300), T_(150, 75), S_(100)] }];
export const trackName = (g, i) => (g.trackNames?.[i] ? N(g.trackNames[i]) : lang.ko ? `${i + 1}번 트랙` : `TRACK ${i + 1}`);
const DS = 2;
function build(tr) { if (tr.cells) return tr; const cells = []; let el = 0, th = 0;
  for (const s of tr.segs) { const n = Math.max(1, Math.round(s.len / DS)); for (let q = 0; q < n; q++) { el += (s.grade || 0) * DS; th += (s.k || 0) * DS; cells.push({ k: s.k || 0, el, th, bank: s.bank || 0, rough: s.rough || 0, grade: s.grade || 0 }); } }
  let x = 0, y = 0; const pts = cells.map(c => { x += Math.cos(c.th) * DS; y += Math.sin(c.th) * DS; return [x, y]; }), ex = x, ey = y, n = pts.length;
  tr.map = pts.map(([px, py], i) => [px - ex * (i + 1) / n, py - ey * (i + 1) / n]); tr.cells = cells; tr.L = cells.length * DS; return tr; }
const cellAt = (tr, s) => tr.cells[((Math.floor(s / DS) % tr.cells.length) + tr.cells.length) % tr.cells.length];
// road under a tyre: curvature, grade, banking, grip and the small height changes the springs have to soak up (m)
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
function roadFn(tr) { const hw = tr.width / 2;
  return (s, n) => { const c = cellAt(tr, s), off = Math.abs(n) > hw + 0.6, kerb = !off && Math.abs(n) > hw;
    let h = 0.0025 * Math.sin(s * 0.9 + n) + 0.0015 * Math.sin(s * 2.3 - n * 1.7);                                  // a sound road is never quite flat
    if (tr.surf === 'con' && !off) h += (s % 6 < 0.12 ? -0.006 : 0);                                              // concrete slab joints
    if (c.rough) h += 0.022 * Math.sin(s * 1.9 + n * 0.8) + 0.016 * Math.sin(s * 3.7 - n * 2.1) + (hash(Math.floor(s * 1.5), Math.floor(n * 1.5)) > 0.93 ? -0.035 : 0);   // potholed gravel
    if (off) h += 0.02 * Math.sin(s * 1.3 + n * 0.7) + 0.015 * hash(Math.floor(s * 2), Math.floor(n * 2));         // field and verge
    if (kerb) h += 0.012;
    return { k: c.k, grade: c.grade, bank: c.bank, h, mu: off ? 0.55 : c.rough ? 0.74 : tr.surf === 'con' ? 0.95 : 1 }; }; }

// ---- run state ----
// car: { name, es, engine, gearbox, final, mass, cda, crr, cfg (chassis design), ch (chassis stats), wb, track, cgH, hyd, year }
export function makeDrive(car, ti) { const tr = build(TRACKS[ti]), Cr = makeCar(car); Cr.n = -tr.width / 4;   // start in the right-hand half of the road (n is + to the left)
  return { car, C: Cr, ti, tr, road: roadFn(tr), lap: 0, lapT0: 0, t: 0, autoShift: true, autoGas: false, done: false, cam: { x: Cr.n, psi: 0, rev: 0, roll: 0 }, fx: [], skid: new Map(), spun: false, wasOff: false,
    log: { laps: [], top: 0, maxG: 0, maxTb: 40, fade: false, spins: 0, offs: 0, shake: 0, grinds: 0, minCorner: [999, 999, 999] } }; }

// ---- one frame of driving: controls, physics, what the run records ----
function stepDrive(D, ctl, dt) {
  const C = D.C, tr = D.tr; if (D.done) return;
  if (ctl.up) requestShift(C, 1); if (ctl.down) requestShift(C, -1);
  stepCar(C, { gas: ctl.gas, brake: ctl.brake, steer: ctl.steer, autoShift: D.autoShift && C.gear > 0, hand: ctl.hand }, D.road, dt); D.t += dt;
  const L = D.log, mph = Math.abs(C.u) * 2.237, slip = Math.atan2(C.v, Math.abs(C.u) + 0.5);
  L.top = Math.max(L.top, mph); L.maxG = Math.max(L.maxG, Math.abs(C.ay) / 9.81); for (const c of C.corners) { L.maxTb = Math.max(L.maxTb, c.tb); if (c.tb > 285) L.fade = true; }
  if (Math.abs(slip) > 1.0 && Math.abs(C.u) > 2 && !D.spun) { L.spins++; D.spun = true; } if (Math.abs(slip) < 0.3) D.spun = false;
  const off = Math.abs(C.n) > tr.width / 2 + 0.6; if (off && !D.wasOff) L.offs++; D.wasOff = off; if (Math.abs(C.n) > tr.width / 2 + 16) { C.n = Math.sign(C.n) * (tr.width / 2 + 16); C.v *= -0.3; C.u *= 0.7; }
  const c0 = cellAt(tr, C.s); if (c0.rough) L.shake = Math.max(L.shake, Math.abs(C.vz) * 4 + Math.abs(C.vroll) * 2);
  if (C.grind > 0.6 && !D.grinding) { L.grinds++; D.grinding = true; } if (C.grind < 0.1) D.grinding = false;
  if (Math.abs(c0.k) > 1 / 300) { const sec = Math.min(2, Math.floor(((C.s % tr.L) + tr.L) % tr.L / tr.L * 3)); L.minCorner[sec] = Math.min(L.minCorner[sec], mph); }
  if (C.s >= (D.lap + 1) * tr.L) { L.laps.push(D.t - D.lapT0); D.lapT0 = D.t; D.lap++; if (D.lap >= tr.laps) D.done = true; }
  if (D.t > 900) D.done = true;
  // tyre effects: smoke where a tyre slides or spins, dust and grass off the road, marks left on the road
  for (const c of C.corners) { const sliding = c.slip > 1.15 && Math.abs(C.u) > 3, spin = Math.abs(c.kap) > 0.35 && Math.abs(C.u) < 25, s = C.s + c.x, n = C.n + c.y, offR = Math.abs(n) > tr.width / 2 + 0.6;
    if ((sliding || spin) && Math.random() < 0.18) D.fx.push({ s, n, h: 0.15, vs: C.u * 0.25, vn: (Math.random() - 0.5) * 0.6, vh: 0.3 + Math.random() * 0.3, life: 1.2, size: 0.3, col: offR ? [176, 150, 108] : [232, 230, 224], a: offR ? 0.45 : 0.3, grow: 0.6 });
    if (offR && Math.abs(C.u) > 4 && Math.random() < 0.25) D.fx.push({ s, n, h: 0.1, vs: C.u * 0.5, vn: (Math.random() - 0.5) * 2, vh: 1.5 + Math.random() * 2, life: 0.7, size: 0.12, col: Math.random() < 0.5 ? [120, 102, 70] : [92, 120, 60], a: 0.9, grow: 0, grav: true });
    if ((sliding || spin) && !offR) { const k2 = Math.floor(s / DS); const arr = D.skid.get(k2) || []; if (arr.length < 12) { arr.push(n); D.skid.set(k2, arr); } } }
  for (const p of D.fx) { p.s += p.vs * dt; p.n += p.vn * dt; p.h += p.vh * dt; if (p.grav) p.vh -= 9.81 * dt; else p.vh *= 0.97; p.size += p.grow * dt; p.life -= dt; } D.fx = D.fx.filter(p => p.life > 0 && p.h > -0.1).slice(-120);
}

// ---- drawing helpers into an offscreen buffer (rotated onto the screen for the camera's lean on the banking) ----
const COL = { sky0: hex('#93afc0'), sky1: hex('#dbe3dc'), cloud: hex('#f3f1ea'), hill: hex('#8fa292'), hill2: hex('#748a76'), wood: hex('#5f7650'), g0: hex('#7f9a5c'), g1: hex('#768f54'), tar: hex('#6f6b66'), tar2: hex('#6a6661'), con: hex('#aaa59a'), con2: hex('#a49f93'),
  gravel: hex('#8a7a62'), gravel2: hex('#82735b'), edge: hex('#e9e2d0'), line: hex('#efe6cf'), skid: hex('#3b3835'), wall: hex('#c9c2b2'), wallD: hex('#9d9686'), trunk: hex('#5d4b3a'), leaf: hex('#56724a'), leaf2: hex('#6f8a5c'), post: hex('#efe6cf'), shadow: [40, 38, 36] };
const fillRow = (B, x0, y, w, c) => { if (y < 0 || y >= B.h) return; let a = Math.max(0, Math.round(x0)), b = Math.min(B.w, Math.round(x0 + w)); const d = B.d; for (let x = a, i = (y * B.w + a) * 4; x < b; x++, i += 4) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } };
const blendPx = (B, x, y, c, a) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= B.w || y >= B.h) return; const i = (y * B.w + x) * 4, d = B.d; d[i] += (c[0] - d[i]) * a; d[i + 1] += (c[1] - d[i + 1]) * a; d[i + 2] += (c[2] - d[i + 2]) * a; };
const colOf = (P, px, i) => { const ramp = P.ramps[px.r[i]], lv = px.l[i]; return lv < 0 ? ramp.o : ramp.c[Math.max(0, Math.min(ramp.c.length - 1, lv))]; };
const TAG_SHADOW = 1, TAG_WHEEL = 3;
// the rear (or front) view: body pixels follow body roll, pitch and heave; each wheel follows its own corner and camber
function drawCarView(B, P, px, cx, by, k, C, view) {
  const mPx = 1000 / 25 * k, half = px.w / 2, wheelY = px.h - 1, rev = view === 'front' ? -1 : 1, roll = C.roll * rev, pitchLift = (view === 'front' ? C.a : C.b) * C.pitch * (view === 'front' ? -1 : 1);
  const [fl, fr, rl, rr] = C.corners, wl = view === 'front' ? fr : rl, wr = view === 'front' ? fl : rr;     // seen from behind, the left wheel on screen is the car's left (rl)
  const bodyDy = (C.z + pitchLift) * mPx, cosR = Math.cos(roll), sinR = Math.sin(roll);
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) { const i = y * px.w + x, t = px.t[i]; if (!px.r[i] || t === TAG_SHADOW) continue; const col = colOf(P, px, i); if (!col) continue;
    let X = (x - half) * k, Y = (y - wheelY) * k;                                                              // screen pixels from the ground centre
    if (t === TAG_WHEEL) { const w = x < half ? wl : wr, cam = w.camber * (x < half ? 1 : -1) * rev; const wc = (px.h - 1 - 0.36 * px.h) * k; Y -= w.zw * mPx; X += (Y + wc) * Math.sin(cam) * 0.5; }
    else { const xr = X * cosR + Y * sinR * -1, yr = X * sinR + Y * cosR; X = xr; Y = yr - bodyDy; }
    for (let a = 0; a < k; a++) for (let b2 = 0; b2 < k; b2++) { const sx = Math.round(cx + X + a), sy = Math.round(by + Y + b2); if (sx >= 0 && sy >= 0 && sx < B.w && sy < B.h) { const j = (sy * B.w + sx) * 4; B.d[j] = col[0]; B.d[j + 1] = col[1]; B.d[j + 2] = col[2]; } } } }

const HZ = 82, F = 520, CAMH = 1.7, CAMD = 6.5, VIEW = 300;
let BUF = null, SPR = {};
export function drawDrive(S, P, D, sprites, sfx) {
  const k = input.keys || {}, key = input.key, C = D.C, tr = D.tr;
  const left = k.ArrowLeft || held(2, H - 44, 50, 40), right = k.ArrowRight || held(54, H - 44, 50, 40), brake = k.ArrowDown || held(W - 54, H - 44, 52, 40), gasK = k.ArrowUp || held(W - 108, H - 44, 52, 40);
  D.pedal = Math.max(0, Math.min(1, (D.pedal || 0) + ((gasK || (D.autoGas && !brake)) ? 1 / 36 : -1 / 12)));   // a foot, not a switch: about 0.6 s to the floor
  const ctl = { steer: (right ? 1 : 0) - (left ? 1 : 0), gas: D.pedal, brake: brake ? 1 : 0, up: key === 'a' || key === 'A' || key === 'Shift', down: key === 'z' || key === 'Z' || key === 'Control', hand: k[' '] };
  if (button(S, W - 160, H - 44, 50, 19, 'SHIFT +', { tone: 'teal' })) ctl.up = true; if (button(S, W - 160, H - 23, 50, 19, 'SHIFT -', { tone: 'teal' })) ctl.down = true;
  stepDrive(D, ctl, 1 / 60); for (const c of D.C.corners) c.tbMax = Math.max(c.tbMax || 0, c.tb);
  // camera: trails the car's heading and line, turns round to face the car when it is reversing
  const psiR = -C.psi, xR = -C.n, revWant = C.gear === -1 && C.u < -0.3 ? 1 : C.u > 0.3 || C.gear > 0 ? 0 : D.cam.rev; D.cam.rev += Math.sign(revWant - D.cam.rev) * Math.min(Math.abs(revWant - D.cam.rev), 1 / 36);
  const back = D.cam.rev > 0.5, dir = back ? -1 : 1; D.cam.psi += (psiR - D.cam.psi) * 0.15; D.cam.x = xR - Math.sin(D.cam.psi) * CAMD * dir;   // the camera hangs behind (or, reversing, in front of) the car along its heading const cb = cellAt(tr, C.s).bank * Math.sign(cellAt(tr, C.s).k || 0); D.cam.roll += ((cb * 0.55 * Math.PI / 180) * dir - D.cam.roll) * 0.05;
  const B = S;   // the road is drawn in the car's own frame: on the banking the car stays square to it
  const cells = tr.cells, nC = cells.length, sCam = C.s - dir * CAMD, i0 = Math.floor(sCam / DS), frac = sCam / DS - i0, at = i => cells[((i % nC) + nC) % nC], el0 = at(i0).el, swing = back ? Math.PI : 0;
  // sky, clouds and far hills turn with the heading
  let head = at(i0).th + D.cam.psi + swing + D.lap * 2 * Math.PI;
  for (let y = 0; y < HZ + 30; y++) { const t = Math.min(1, y / HZ); fillRow(B, 0, y, W, [0, 1, 2].map(q => Math.round(COL.sky0[q] + (COL.sky1[q] - COL.sky0[q]) * t))); }
  for (let q = 0; q < 7; q++) { const cx = ((q * 113 - head * 300 + D.t * 2) % (W + 160) + W + 160) % (W + 160) - 80, cy = 14 + (q * 37) % 40; for (let r2 = 0; r2 < 7; r2++) fillRow(B, cx - 20 - r2 * 3 + (q % 2) * 6, cy + r2, 40 + r2 * 6 - (r2 > 4 ? (r2 - 4) * 10 : 0), COL.cloud); }
  for (let x = 0; x < W; x++) { const a = head * 400 + x, h1 = 12 + Math.sin(a * 0.011) * 8 + Math.sin(a * 0.029) * 4, h2 = 5 + Math.sin(a * 0.019 + 2) * 4 + Math.sin(a * 0.07) * 1.5, h3 = 2 + (Math.sin(a * 0.23) > 0.2 ? 3 : 0) + Math.sin(a * 0.5);
    for (let y = HZ - Math.round(h1); y < HZ; y++) fillRow(B, x, y, 1, COL.hill); for (let y = HZ - Math.round(h2); y < HZ; y++) fillRow(B, x, y, 1, COL.hill2); for (let y = HZ - Math.round(h3); y < HZ; y++) fillRow(B, x, y, 1, COL.wood); }
  for (let y = HZ; y < H; y++) fillRow(B, 0, y, W, COL.g0);
  // road slices from the camera outwards
  // looking back along the road a right-hand bend reads as a left-hander, and the car's left is on the right of the picture
  const proj = []; let th = -D.cam.psi, lx = 0; const camX = back ? -D.cam.x : D.cam.x;
  for (let n = 0; n <= VIEW; n++) { const z = (n + 1 - frac) * DS, c = at(i0 + dir * n); if (n) { th += c.k * DS * dir; lx += Math.sin(th) * DS; }
    const sc = F / z, el = c.el - el0; proj.push({ z, sx: W / 2 + (lx - camX) * sc, sy: HZ + (CAMH - el) * sc, sc, c, idx: i0 + dir * n }); }
  const hw = tr.width / 2, surf = tr.surf === 'con' ? [COL.con, COL.con2] : [COL.tar, COL.tar2]; let clipY = H; const clipAt = [];
  for (let n = 1; n <= VIEW; n++) { const a = proj[n - 1], b = proj[n]; clipAt[n] = clipY; if (b.sy >= clipY) continue; const y0 = Math.max(HZ, Math.ceil(b.sy)), y1 = Math.min(clipY - 1, Math.floor(a.sy)); if (y1 < y0) { clipY = Math.min(clipY, y0); continue; }
    const id = ((b.idx % nC) + nC) % nC, m2 = v => ((v % 2) + 2) % 2, band = m2(Math.floor(b.idx / 5)), dash = m2(Math.floor(b.idx / 3)), rough = b.c.rough, marks = D.skid.get(b.idx), side = Math.sign(b.c.k) * (back ? -1 : 1);
    for (let y = y0; y <= y1; y++) { const t = a.sy === b.sy ? 0 : (y - a.sy) / (b.sy - a.sy), cx = a.sx + (b.sx - a.sx) * t, sc = a.sc + (b.sc - a.sc) * t, w2 = hw * sc, e = 0.15 * sc, kb = 0.6 * sc;
      fillRow(B, 0, y, W, band ? COL.g0 : COL.g1); if (b.c.bank) fillRow(B, side > 0 ? cx - w2 - kb - w2 * 0.8 : cx + w2 + kb, y, w2 * 0.8, band ? COL.con2 : COL.con);
      fillRow(B, cx - w2 - kb, y, w2 * 2 + kb * 2, m2(Math.floor(b.idx / 2)) ? COL.edge : hex('#b0341f'));
      const noise = ((y * 7 + id * 13) % 11 === 0) ? 4 : 0, base = rough ? (band ? COL.gravel : COL.gravel2) : surf[band]; fillRow(B, cx - w2, y, w2 * 2, [base[0] - noise, base[1] - noise, base[2] - noise]);
      if (!rough) { fillRow(B, cx - w2 + e, y, Math.max(1, e * 0.8), COL.line); fillRow(B, cx + w2 - e * 1.8, y, Math.max(1, e * 0.8), COL.line); if (dash) fillRow(B, cx - e * 0.4, y, Math.max(1, e * 0.8), COL.line); }
      if (marks) for (const mn of marks) { const mx = cx + (back ? mn : -mn) * sc; fillRow(B, mx - 0.1 * sc, y, Math.max(1, 0.2 * sc), COL.skid); } }
    clipY = Math.min(clipY, y0); }
  // roadside things, far to near: trees, posts, the oval's wall and stands, start line
  const put = (x, y, w2, h2, col, lim) => { const yy = Math.round(y), hh = Math.min(Math.round(h2), Math.round(lim - yy)); for (let r2 = 0; r2 < hh; r2++) fillRow(B, x, yy + r2, Math.max(1, w2), col); };
  for (let n = VIEW; n >= 2; n--) { const p = proj[n]; if (p.sy > clipAt[n] || p.z < 3) continue; const id = ((p.idx % nC) + nC) % nC, sc = p.sc, lim = clipAt[n];
    if (id === 0) for (let q = 0; q < 10; q++) put(p.sx - hw * sc + q * hw * sc / 5, p.sy - 0.2 * sc, hw * sc / 5, 0.2 * sc, q % 2 ? hex('#1d1a1c') : hex('#f3ead2'), lim);
    if (tr.surf !== 'con' && id % 7 === 0) for (const s2 of [-1, 1]) { const r0 = hash(id, s2); if (r0 < 0.55) { const tx = p.sx + s2 * (hw + 5 + r0 * 12) * sc, th2 = (7 + r0 * 6) * sc; put(tx - 0.25 * sc, p.sy - th2 * 0.45, 0.5 * sc, th2 * 0.45, COL.trunk, lim); put(tx - 2.2 * sc, p.sy - th2, 4.4 * sc, th2 * 0.62, id % 2 ? COL.leaf : COL.leaf2, lim); put(tx - 1.6 * sc, p.sy - th2 * 1.08, 3.2 * sc, th2 * 0.2, COL.leaf2, lim); }
      else if (r0 < 0.8) { const tx = p.sx + s2 * (hw + 1.6) * sc; put(tx, p.sy - 1 * sc, 0.12 * sc, 1 * sc, COL.post, lim); put(tx, p.sy - 1 * sc, 0.12 * sc, 0.18 * sc, hex('#b0341f'), lim); }
      else { const tx = p.sx + s2 * (hw + 2.5) * sc; put(tx - 0.6 * sc, p.sy - 0.5 * sc, 1.2 * sc, 0.5 * sc, hex('#c8b26a'), lim); put(tx - 0.6 * sc, p.sy - 0.5 * sc, 1.2 * sc, 0.08 * sc, hex('#e2d08a'), lim); } }    // straw bales
    if (tr.surf === 'con' && id % 5 === 0 && !p.c.bank) for (const s2 of [-1, 1]) put(p.sx + s2 * (hw + 2) * sc, p.sy - 1.1 * sc, 0.25 * sc, 1.1 * sc, COL.wallD, lim);
    if (tr.surf === 'con' && id < 40 && id % 4 === 0) { const gx = p.sx - (hw + 6) * sc; put(gx - 6 * sc, p.sy - 5 * sc, 6 * sc, 5 * sc, hex('#8a7e6a'), lim); put(gx - 6 * sc, p.sy - 5.4 * sc, 6 * sc, 0.5 * sc, hex('#6a5a48'), lim); } }
  // shadow under the car (sun high and a little behind-left), tyre contact shadows, then the car
  const onRoad = z => { const f = Math.max(0, z / DS - (1 - frac)), i = Math.min(VIEW - 1, Math.floor(f)), t = f - i, a = proj[i], b = proj[i + 1]; return { sx: a.sx + (b.sx - a.sx) * t, sy: a.sy + (b.sy - a.sy) * t, sc: a.sc + (b.sc - a.sc) * t }; };
  const kC = 2, mPx = 1000 / 25 * kC, spr = sprites(back ? 'front' : 'rear'), car0 = onRoad(CAMD), cy = car0.sy, cxCar = W / 2 + Math.sin(psiR - D.cam.psi) * CAMD * car0.sc * dir;
  if (spr) { const wpx = spr.w * kC, lift = Math.max(0, C.z) * mPx; for (let y = -4; y <= 4; y++) { const ww = wpx * 0.5 * Math.sqrt(1 - (y / 5) ** 2); for (let x = -ww; x <= ww; x++) blendPx(B, cxCar + 6 + x + C.roll * 40, cy + y - 2, COL.shadow, 0.35 - lift * 0.002); }
    drawCarView(B, P, spr, cxCar, cy, kC, C, back ? 'front' : 'rear'); }
  // smoke, dust and grass in the world
  for (const p of D.fx) { const z = (p.s - sCam) * dir; if (z < 3 || z > VIEW * DS - 4) continue; const o = onRoad(z), sc = o.sc, sx = o.sx + (back ? p.n : -p.n) * sc, sy = o.sy - p.h * sc, r = Math.min(9, Math.max(1, p.size * sc)), a = p.a * Math.min(1, p.life);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) blendPx(B, sx + x, sy + y, p.col, a * 0.5); }
  drawHud(S, D, ctl, left, right, gasK, brake);
  return D.done ? report(S, D) : button(S, W - 66, 2, 60, 12, 'BACK', { tone: 'ox' }) ? 'back' : null;
}
function gearLabel(C) { return C.shift ? '-' : C.gear === -1 ? 'R' : C.gear === 0 ? 'N' : String(C.gear) + (C.odOn ? ' OD' : ''); }
function drawHud(S, D, ctl, left, right, gas, brake) { const C = D.C;
  // map
  const mp = D.tr.map; let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9; for (const [x, y] of mp) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
  const ms = Math.min(70 / (mxx - mnx), 44 / (mxy - mny)), mx0 = W - 80, my0 = 20; S.fill(mx0 - 4, my0 - 4, 82, 54, C.ink ? hex('#2a1d17') : hex('#2a1d17'));
  for (let i = 0; i < mp.length; i += 3) S.fill(Math.round(mx0 + (mp[i][0] - mnx) * ms), Math.round(my0 + (mp[i][1] - mny) * ms), 1, 1, hex('#efe6cf'));
  { const i = Math.floor(((C.s % D.tr.L) + D.tr.L) % D.tr.L / DS) % mp.length; S.fill(Math.round(mx0 + (mp[i][0] - mnx) * ms) - 1, Math.round(my0 + (mp[i][1] - mny) * ms) - 1, 3, 3, hex('#b0341f')); }
  S.fill(0, H - 46, W, 46, hex('#2a1d17')); S.fill(0, H - 46, W, 1, hex('#7a5a2a')); const mph = Math.abs(C.u) * 2.237, rpm = rpmOf(C);
  dial(S, 128, H - 22, 15, mph / 110, 'MPH', mph.toFixed(0)); dial(S, 196, H - 22, 15, rpm / (C.es.redline * 1.15), 'RPM', String(Math.round(rpm / 50) * 50), 0.87);
  if (C.stalled) text(S, lang.ko ? '시동 꺼짐 - 가속으로 재시동' : 'STALLED - GAS TO RESTART', 254, H - 51, hex('#ff9a7a'));
  text(S, (lang.ko ? '기어 ' : 'GEAR ') + gearLabel(C), 254, H - 42, C.grind > 0.2 ? hex('#ff9a7a') : hex('#e2c47a')); if (C.grind > 0.2) text(S, lang.ko ? '기어 갈림!' : 'GRINDING!', 300, H - 42, hex('#ff9a7a'));
  const lapT = D.t - D.lapT0; text(S, `${lang.ko ? '랩' : 'LAP'} ${Math.min(D.lap + 1, D.tr.laps)}/${D.tr.laps}  ${lapT.toFixed(1)}`, 254, H - 33, hex('#efe6cf'));
  text(S, `${lang.ko ? '횡가속' : 'LAT'} ${(Math.abs(C.ay) / 9.81).toFixed(2)} G`, 254, H - 24, hex('#efe6cf'));
  const tb = Math.max(...C.corners.map(c => c.tb)), tf = Math.min(1, (tb - 30) / 330); text(S, lang.ko ? '브레이크' : 'BRAKES', 254, H - 15, hex('#efe6cf')); S.fill(290, H - 14, 26, 5, hex('#5a4a3a')); S.fill(290, H - 14, Math.round(26 * tf), 5, tb > 260 ? hex('#d04030') : tb > 180 ? hex('#d09030') : hex('#3f8f86'));
  button(S, 2, H - 44, 50, 40, '<', { tone: 'teal', active: !!left }); button(S, 54, H - 44, 50, 40, '>', { tone: 'teal', active: !!right });
  button(S, W - 108, H - 44, 52, 40, 'GAS', { tone: 'teal', active: !!gas }); button(S, W - 54, H - 44, 52, 40, 'BRAKE', { tone: 'ox', active: !!brake });
  if (button(S, 4, 20, 78, 12, D.autoShift ? 'AUTO SHIFT' : 'MANUAL SHIFT', { active: D.autoShift })) D.autoShift = !D.autoShift;
  if (button(S, 4, 34, 78, 12, D.autoGas ? 'AUTO GAS ON' : 'AUTO GAS OFF', { active: D.autoGas })) D.autoGas = !D.autoGas;
  bevel(S, 0, 0, W, 16, hex('#7a2a22'), hex('#9a3a30'), hex('#4a1a14')); text(S, `${D.name || ''}  -  ${N(D.car.name || '')}`, 8, 6, hex('#e2c47a'), 1, 320);
  text(S, lang.ko ? 'A/Z 변속  스페이스 핸드브레이크' : 'A/Z SHIFT  SPACE HANDBRAKE', 86, 22, hex('#2a1d17'), 1, 200); }
function report(S, D) { const L = D.log, best = L.laps.length ? Math.min(...L.laps) : null, fm = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`; S.fill(100, 26, 280, 160, hex('#2a1d17')); S.fill(102, 28, 276, 156, hex('#efe6cf'));
  text(S, (lang.ko ? '주행 보고 - ' : 'DRIVE REPORT - ') + (D.name || ''), 108, 34, hex('#7a2a22'), 1, 264);
  const rows = [['BEST LAP', best ? fm(best) : '-'], ['LAPS', L.laps.map(fm).join('  ')], ['TOP SPEED SEEN', L.top.toFixed(0) + ' MPH'], ['MOST CORNERING', L.maxG.toFixed(2) + ' G'], ['SLOWEST CORNER BY THIRD', L.minCorner.map(v => (v > 900 ? '-' : v.toFixed(0))).join(' / ') + ' MPH'],
    ['BRAKES', `${Math.round(L.maxTb)} C${L.fade ? (lang.ko ? ', 페이드 발생' : ', FADED') : ''}`], ['SPINS / OFFS', `${L.spins} / ${L.offs}`], ['MISSED SHIFTS', String(L.grinds)], ['ROUGH ROAD', L.shake > 0.9 ? 'BODY SHAKES AND RATTLES' : L.shake > 0.5 ? 'SOME SHAKE' : 'SOLID']];
  rows.forEach(([a, b], i) => text(S, a, 108, 48 + i * 11, hex('#5a4a40'), 1, 110) + text(S, b, 222, 48 + i * 11, hex('#2a1d17'), 1, 150));
  if (button(S, 108, 162, 100, 16, 'DRIVE AGAIN')) return 'again'; if (button(S, 270, 162, 100, 16, 'BACK', { tone: 'ox' })) return 'back'; return null; }
const dial = (S, x, y, R, frac, label, val, redFrom = 2) => { for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) { const r = Math.hypot(xx, yy); if (r <= R) S.fill(x + xx, y + yy, 1, 1, r > R - 2 ? C.brass : hex('#f3ead2')); }
  for (let q = 0; q <= 8; q++) { const a = Math.PI * (0.8 + 1.4 * q / 8); S.fill(Math.round(x + Math.cos(a) * (R - 4)), Math.round(y + Math.sin(a) * (R - 4)), 1, 1, q / 8 >= redFrom ? C.red : C.ink); }
  const a = Math.PI * (0.8 + 1.4 * Math.max(0, Math.min(1, frac))); lineTo(S, x, y, x + Math.cos(a) * (R - 5), y + Math.sin(a) * (R - 5), C.red); S.fill(x - 1, y - 1, 3, 3, C.ink); text(S, label, x + R + 3, y - 7, C.paper); text(S, val, x + R + 3, y + 2, C.brassL); };


export function drawTrackPick(S, g, nameField, best) {
  S.fill(0, 0, W, H, hex('#2a1d17')); bevel(S, 0, 0, W, 16, C.oxblood, C.oxL, C.oxD); text(S, lang.ko ? '시험 트랙 선택' : 'CHOOSE A TEST TRACK', 8, 6, C.brassL); let pick = null;
  TRACKS.forEach((t, i) => { const tr = build(t), x = 12 + i * 156, y = 30; S.fill(x, y, 148, 200, C.paper); S.fill(x, y, 148, 1, C.brass);
    g.trackNames = g.trackNames || []; const v = nameField('trk' + i, x + 6, y + 6, 136, 'TRACK NAME', g.trackNames[i] || '', 'track'); g.trackNames[i] = v; text(S, trackName(g, i), x + 6, y + 34, C.oxblood, 1, 136);
    text(S, t.kind, x + 6, y + 44, C.inkSoft, 1, 136); text(S, `${(tr.L / 1000).toFixed(2)} KM  ${t.laps} ${lang.ko ? '랩' : 'LAPS'}`, x + 6, y + 53, C.ink);
    const mp = tr.map; let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [px, py] of mp) { a = Math.min(a, px); b = Math.max(b, px); c = Math.min(c, py); d = Math.max(d, py); } const ms = Math.min(120 / (b - a), 90 / (d - c));
    for (let q = 0; q < mp.length; q++) S.fill(Math.round(x + 14 + (mp[q][0] - a) * ms), Math.round(y + 66 + (mp[q][1] - c) * ms), 2, 2, mp[q] && tr.cells[q].bank ? C.amber : C.ink);
    if (best?.[i]) text(S, `${lang.ko ? '최고 랩' : 'BEST LAP'} ${best[i].toFixed(1)} S`, x + 6, y + 164, C.teal);
    if (button(S, x + 6, y + 178, 136, 16, 'DRIVE', { tone: 'teal' })) pick = i; });
  text(S, lang.ko ? '방향키: 가속 위, 브레이크 아래, 조향 좌우' : 'ARROWS: UP GAS, DOWN BRAKE, LEFT / RIGHT STEER', 12, 240, C.paper, 1, 340);
  if (button(S, W - 66, 2, 60, 12, 'BACK', { tone: 'ox' })) return 'back'; return pick;
}
