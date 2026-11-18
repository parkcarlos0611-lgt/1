// Track driving (plans 19-3, 23 and 24). The car is the real-time model in sim/dyn.mjs: body heave / roll / pitch,
// wheels on their own springs, bias-ply tyres, clutch and gearbox, drums that fade. Seen side-on (game/sideview.mjs):
// the line assist holds the car on its line through the bends while the player works the pedals and the gears.
import { W, H, C, text, button, input, held, bevel, lineTo, N, lang, tw } from './ui.mjs';
import { hex } from '../tools/pixel/color.mjs';
import { makeCar, stepCar, requestShift, rpmOf, settle } from '../sim/dyn.mjs';
import { drawSide, elAt, riseAt, bankAt } from './sideview.mjs';

// ---- tracks: straights and turns (right turns positive degrees), grade, banking (deg), rough surface; road width in metres ----
const S_ = (len, o = {}) => ({ len, ...o }), T_ = (R, deg, o = {}) => ({ len: Math.abs(R * deg * Math.PI / 180), k: Math.sign(deg) / R, ...o });
export const TRACKS = [
  { kind: 'TEST ROAD', surf: 'tar', laps: 2, width: 6.5, segs: [S_(500), T_(150, 90), S_(150, { grade: 0.10 }), S_(150, { grade: -0.10 }), T_(60, 90), S_(300, { rough: 1 }), T_(100, 60), T_(80, -30), S_(150), T_(120, 120), S_(200), T_(150, 30), S_(120)] },
  { kind: 'BANKED OVAL', surf: 'con', laps: 3, width: 15, segs: [S_(300), T_(250, 180, { bank: 22 }), S_(600), T_(250, 180, { bank: 22 }), S_(300)] },
  { kind: 'ROAD CIRCUIT', surf: 'tar', laps: 2, width: 10, segs: [S_(700), T_(40, 90), S_(250), T_(120, -45), T_(90, 90), S_(300, { grade: 0.05 }), T_(200, 60), S_(400, { grade: -0.05 }), T_(60, -60), T_(70, 150), S_(300), T_(150, 75), S_(100)] }];
export const trackName = (g, i) => (g.trackNames?.[i] ? N(g.trackNames[i]) : lang.ko ? `${i + 1}번 트랙` : `TRACK ${i + 1}`);
const DS = 2;
function build(tr) { if (tr.cells) return tr; const cells = []; let el = 0, th = 0;
  for (const s of tr.segs) { const n = Math.max(1, Math.round(s.len / DS)); for (let q = 0; q < n; q++) { el += (s.grade || 0) * DS; th += (s.k || 0) * DS; cells.push({ k: s.k || 0, el, th, bank: s.bank || 0, rough: s.rough || 0, grade: s.grade || 0 }); } }
  let x = 0, y = 0; const pts = cells.map(c => { x += Math.cos(c.th) * DS; y += Math.sin(c.th) * DS; return [x, y]; }), ex = x, ey = y, n = pts.length;
  tr.map = pts.map(([px, py], i) => [px - ex * (i + 1) / n, py - ey * (i + 1) / n]); const ez = el; cells.forEach((c, i) => { c.el -= ez * (i + 1) / n; });
  // crests and dips are rounded like a real road's (a 40 m running mean, about a 200 m vertical curve on a 10 % change);
  // the climb the physics feels is the slope of the rounded road
  { const RW = Math.round(20 / DS), src = cells.map(c => c.el); cells.forEach((c, i) => { let a = 0; for (let j = -RW; j <= RW; j++) a += src[((i + j) % n + n) % n]; c.el = a / (2 * RW + 1); });
    cells.forEach((c, i) => { c.grade = (cells[(i + 1) % n].el - cells[(i - 1 + n) % n].el) / (2 * DS); }); }
  // banking eases in and out over 60 m either side of a banked turn (a real bowl does; a step would launch the car)
  const RB = Math.round(60 / DS); cells.forEach((c, i) => { let b = 0, sd = 0; for (let j = -RB; j <= RB; j++) { const q = cells[((i + j) % n + n) % n]; if (!q.bank) continue; const v = q.bank * (1 - Math.abs(j) / (RB + 1)); if (v > b) { b = v; sd = Math.sign(q.k); } } c.bankE = b; c.bankS = sd; }); tr.cells = cells; tr.L = cells.length * DS;
  for (let i = 0; i < n; i++) { const a = cells[i], b = cells[(i + 1) % n]; if (!a.k && b.k && Math.abs(b.k) > 1 / 180) for (const [d, m] of [[75, 3], [50, 2], [25, 1]]) { const j = ((i - d) % n + n) % n; cells[j].board = m; cells[j].bside = Math.sign(b.k); } }   // 150 / 100 / 50 m
  return tr; }
const cellAt = (tr, s) => tr.cells[((Math.floor(s / DS) % tr.cells.length) + tr.cells.length) % tr.cells.length];
// road under a tyre: curvature, grade, banking, grip and the small height changes the springs have to soak up (m)
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
function roadFn(tr) { const hw = tr.width / 2;
  // absolute height under a tyre: the road's elevation, the rise of a banked turn, and the small bumps the springs soak up
  const hf = (s, n) => { const c = cellAt(tr, s), off = Math.abs(n) > hw + 0.6, kerb = !off && Math.abs(n) > hw;
    let h = elAt(tr, s) + riseAt(tr, s, Math.max(0, Math.min(tr.width, n + hw))) + 0.0025 * Math.sin(s * 0.9 + n) + 0.0015 * Math.sin(s * 2.3 - n * 1.7);   // a sound road is never quite flat
    if (tr.surf === 'con' && !off) h += (s % 6 < 0.12 ? -0.006 : 0);                                              // concrete slab joints
    if (c.rough) h += 0.010 * Math.sin(s * 1.9 + n * 0.8) + 0.007 * Math.sin(s * 3.7 - n * 2.1) + (hash(Math.floor(s * 1.5), Math.floor(n * 1.5)) > 0.97 ? -0.025 : 0);   // potholed gravel (a real one: +-1-2 cm, the odd hole)
    if (off) h += 0.02 * Math.sin(s * 1.3 + n * 0.7) + 0.015 * hash(Math.floor(s * 2), Math.floor(n * 2));         // field and verge
    if (kerb) h += 0.012; return h; };
  const f = (s, n) => { const c = cellAt(tr, s), off = Math.abs(n) > hw + 0.6; const B = bankAt(tr, s); return { k: c.k, grade: c.grade, bank: B.b, bside: B.side, h: hf(s, n), mu: off ? 0.55 : c.rough ? 0.74 : tr.surf === 'con' ? 0.95 : 1 }; };
  f.hf = hf; return f; }

// ---- run state ----
// car: { name, es, engine, gearbox, final, mass, cda, crr, cfg (chassis design), ch (chassis stats), wb, track, cgH, hyd, year }
export function makeDrive(car, ti) { const tr = build(TRACKS[ti]), Cr = makeCar(car); Cr.n = tr.kind === 'TEST ROAD' ? -tr.width / 4 : 0;   // on the line: the right-hand lane on the road, the middle on a track (n is + to the left)
  const road = roadFn(tr); settle(Cr, road);
  return { car, C: Cr, ti, tr, road, lap: 0, lapT0: 0, t: 0, autoShift: true, autoGas: false, assist: true, iSteer: 0, done: false, fx: [], skid: new Map(), spun: false, wasOff: false,
    log: { laps: [], top: 0, maxG: 0, maxTb: 40, fade: false, spins: 0, offs: 0, shake: 0, grinds: 0, bottoms: 0, scrapes: 0, air: 0, minCorner: [999, 999, 999] } }; }

// ---- line assist (plan 24-2 A): the driver holds a line through the bends; the player has the pedals and the gears.
// It steers like a person, not a rail: it looks ahead, cannot add grip, and a car taken in too fast runs wide or spins ----
function lineAssist(D, dt) { const C = D.C, tr = D.tr, hw = tr.width / 2, kAt = s => cellAt(tr, s).k, u = Math.abs(C.u), V = Math.hypot(C.u, C.v);
  let kA = 0; for (let q = 0; q < 8; q++) kA += kAt(C.s + 6 + q * 6) / 8;                                    // the bend coming up
  const base = tr.kind === 'TEST ROAD' ? -hw / 2 : 0, swing = tr.kind === 'TEST ROAD' ? hw * 0.15 : hw * 0.4;
  const nT = base - Math.sign(kA) * swing * Math.min(1, Math.abs(kA) * 90);                                 // towards the inside of the bend
  if (C.u < -0.3) return Math.max(-1, Math.min(1, C.psi * 2));                                               // backing up: keep it straight
  // Stanley-type lane keeping: heading error, plus the lateral error seen at speed, plus the road's own curvature,
  // plus a yaw-rate check that catches a tail stepping out (countersteer); it cannot add grip
  const e = Math.max(-2.5, Math.min(2.5, nT - C.n)), kR = -kAt(C.s + 3 + u * 0.3);
  D.iSteer = Math.max(-0.01, Math.min(0.01, D.iSteer + e * dt * 0.0008));
  const rWant = (kR + D.iSteer) * C.u, delta = Math.atan(C.wb * (kR + D.iSteer)) - C.psi + Math.atan(1.2 * e / (u + 4)) + 0.6 * C.wb * (rWant - C.r) / Math.max(5, u);
  const lock = C.steerMax * Math.max(0.2, Math.min(1, 9 / Math.max(9, V)));
  return Math.max(-1, Math.min(1, -delta / lock)); }

// ---- one frame of driving: controls, physics, what the run records ----
export function stepDrive(D, ctl, dt) {
  const C = D.C, tr = D.tr; if (D.done) return;
  if (ctl.up) requestShift(C, 1); if (ctl.down) requestShift(C, -1);
  const steer = D.assist && !ctl.steer ? lineAssist(D, dt) : ctl.steer;
  stepCar(C, { gas: ctl.gas, brake: ctl.brake, steer, autoShift: D.autoShift && C.gear > 0, hand: ctl.hand }, D.road, dt); D.t += dt;
  const L = D.log, mph = Math.abs(C.u) * 2.237, slip = Math.atan2(C.v, Math.abs(C.u) + 0.5);
  L.top = Math.max(L.top, mph); L.maxG = Math.max(L.maxG, Math.abs(C.ay) / 9.81); for (const c of C.corners) { L.maxTb = Math.max(L.maxTb, c.tb); if (c.tb > 285) L.fade = true; }
  if (Math.abs(slip) > 1.0 && Math.abs(C.u) > 2 && !D.spun) { L.spins++; D.spun = true; } if (Math.abs(slip) < 0.3) D.spun = false;
  const off = Math.abs(C.n) > tr.width / 2 + 0.6; if (off && !D.wasOff) L.offs++; D.wasOff = off; if (Math.abs(C.n) > tr.width / 2 + 16) { C.n = Math.sign(C.n) * (tr.width / 2 + 16); C.v *= -0.3; C.u *= 0.7; }
  const c0 = cellAt(tr, C.s); if (c0.rough) L.shake = Math.max(L.shake, Math.abs(C.vz) * 4 + Math.abs(C.vroll) * 2);
  if (C.grind > 0.6 && !D.grinding) { L.grinds++; D.grinding = true; } if (C.grind < 0.1) D.grinding = false;
  // landings and the underside: a hard hit on the bump stops, the frame or a bumper on the road, time in the air
  if (C.bumpHit > 15000 && !D.bott) { L.bottoms++; D.bott = true; } if (C.bumpHit < 3000) D.bott = false; C.bumpHit = 0;
  if (C.scrape > 0 && !D.scr) { L.scrapes++; D.scr = true; } if (!C.scrape) D.scr = false; L.air = Math.max(L.air, C.air);
  if (C.scrape > 0 && Math.abs(C.u) > 2) for (let q = 0; q < 2; q++) D.fx.push({ s: C.s + (Math.random() - 0.3) * C.wb, n: C.n + (Math.random() - 0.5) * 0.8, h: 0.05, vs: C.u * 0.6 - Math.sign(C.u) * Math.random() * 4, vn: (Math.random() - 0.5) * 2, vh: 1 + Math.random() * 2, life: 0.25 + Math.random() * 0.2, size: 0.03, col: Math.random() < 0.5 ? [255, 214, 120] : [255, 160, 60], a: 1, grow: 0, grav: true });
  if (D.wasAir && !C.air) for (let q = 0; q < 10; q++) D.fx.push({ s: C.s + (Math.random() - 0.5) * C.wb * 1.4, n: C.n + (Math.random() - 0.5) * 1.6, h: 0.1, vs: C.u * 0.2, vn: (Math.random() - 0.5) * 2, vh: 0.4 + Math.random() * 0.6, life: 1.2, size: 0.35, col: [196, 182, 150], a: 0.5, grow: 0.8 });
  D.wasAir = C.air > 0.05;
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

// ---- one frame on screen: controls, physics, the side-on picture (game/sideview.mjs), the instruments ----
export function drawDrive(S, P, D, sprites, sfx, side) {
  S.d.fill(0);                                                                                   // the pixel UI is see-through over the scene
  const k = input.keys || {}, key = input.key, manual = !D.assist;
  const left = k.ArrowLeft || (manual && held(2, H - 44, 50, 40)), right = k.ArrowRight || (manual && held(54, H - 44, 50, 40)), brake = k.ArrowDown || held(W - 54, H - 44, 52, 40), gasK = k.ArrowUp || held(W - 108, H - 44, 52, 40);
  D.pedal = Math.max(0, Math.min(1, (D.pedal || 0) + ((gasK || (D.autoGas && !brake)) ? 1 / 36 : -1 / 12)));   // a foot, not a switch: about 0.6 s to the floor
  const ctl = { steer: (right ? 1 : 0) - (left ? 1 : 0), gas: D.pedal, brake: brake ? 1 : 0, up: key === 'a' || key === 'A' || key === 'Shift' || D.pend === 1, down: key === 'z' || key === 'Z' || key === 'Control' || D.pend === -1, hand: k[' '] };
  D.pend = 0; D.ctl = ctl; stepDrive(D, ctl, 1 / 60); for (const c of D.C.corners) c.tbMax = Math.max(c.tbMax || 0, c.tb);
  const t0 = performance.now(); drawSide(P, D, side); D.drawMs = (D.drawMs ?? 8) * 0.95 + (performance.now() - t0) * 0.05;   // the picture's cost, for the quality step
  drawHud(S, D, ctl, left, right, gasK, brake);
  if (button(S, W - 160, H - 44, 50, 19, 'SHIFT +', { tone: 'teal' })) D.pend = 1; if (button(S, W - 160, H - 23, 50, 19, 'SHIFT -', { tone: 'teal' })) D.pend = -1;
  return D.done ? report(S, D) : button(S, W - 66, 2, 60, 12, 'BACK', { tone: 'ox' }) ? 'back' : null;
}
// what the car sounds like this frame
export function soundState(D) { const C = D.C, tr = D.tr, c0 = cellAt(tr, C.s), off = Math.abs(C.n) > tr.width / 2 + 0.6, wd = (C.corners[2].w + C.corners[3].w) / 2;
  return { v: C.u, slip: Math.max(...C.corners.map(c => c.slip)), surf: off ? 'grass' : c0.rough ? 'gravel' : tr.surf === 'con' ? 'con' : 'tar', gear: C.gear, top: C.ratios.length, gearSpeed: wd * C.final * (C.gear > 0 ? C.ratios[C.gear - 1] : C.gear < 0 ? -C.ratios[0] : 0),
    load: D.pedal || 0, grind: C.grind, scrape: C.scrape, defl: C.corners.reduce((a, c) => a + c.defl, 0) / 4, brake: D.ctl?.brake || 0, hot: Math.min(1, (Math.max(...C.corners.map(c => c.tb)) - 60) / 240),
    rpm: Math.max(0, C.we * 30 / Math.PI), engLoad: C.shift ? 0.1 : Math.max(0.08, D.pedal || 0), stalled: C.stalled }; }
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
  text(S, (lang.ko ? '기어 ' : 'GEAR ') + gearLabel(C), 254, H - 42, C.grind > 0.2 ? hex('#ff9a7a') : hex('#e2c47a')); if (C.grind > 0.2) text(S, lang.ko ? '기어 갈림!' : 'GRINDING!', 254, H - 60, hex('#ff9a7a'));
  const lapT = D.t - D.lapT0; text(S, `${lang.ko ? '랩' : 'LAP'} ${Math.min(D.lap + 1, D.tr.laps)}/${D.tr.laps}  ${lapT.toFixed(1)}`, 254, H - 33, hex('#efe6cf'));
  text(S, `${lang.ko ? '횡가속' : 'LAT'} ${(Math.abs(C.ay) / 9.81).toFixed(2)} G`, 254, H - 24, hex('#efe6cf'));
  const tb = Math.max(...C.corners.map(c => c.tb)), tf = Math.min(1, (tb - 30) / 330); text(S, lang.ko ? '브레이크' : 'BRAKES', 254, H - 15, hex('#efe6cf')); S.fill(290, H - 14, 26, 5, hex('#5a4a3a')); S.fill(290, H - 14, Math.round(26 * tf), 5, tb > 260 ? hex('#d04030') : tb > 180 ? hex('#d09030') : hex('#3f8f86'));
  if (!D.assist) { button(S, 2, H - 44, 50, 40, '<', { tone: 'teal', active: !!left }); button(S, 54, H - 44, 50, 40, '>', { tone: 'teal', active: !!right }); }
  button(S, W - 108, H - 44, 52, 40, 'GAS', { tone: 'teal', active: !!gas }); button(S, W - 54, H - 44, 52, 40, 'BRAKE', { tone: 'ox', active: !!brake });
  if (button(S, 4, 20, 78, 12, D.autoShift ? 'AUTO SHIFT' : 'MANUAL SHIFT', { active: D.autoShift })) D.autoShift = !D.autoShift;
  if (button(S, 4, 34, 78, 12, D.autoGas ? 'AUTO GAS ON' : 'AUTO GAS OFF', { active: D.autoGas })) D.autoGas = !D.autoGas;
  if (button(S, 4, 48, 78, 12, D.assist ? 'LINE ASSIST' : 'MANUAL STEER', { active: D.assist })) { D.assist = !D.assist; D.iSteer = 0; }
  bevel(S, 0, 0, W, 16, hex('#7a2a22'), hex('#9a3a30'), hex('#4a1a14')); text(S, `${D.name || ''}  -  ${N(D.car.name || '')}`, 8, 6, hex('#e2c47a'), 1, 320);
  text(S, lang.ko ? 'A/Z 변속  스페이스 핸드브레이크' : 'A/Z SHIFT  SPACE HANDBRAKE', 86, 22, hex('#2a1d17'), 1, 200); }
function report(S, D) { const L = D.log, best = L.laps.length ? Math.min(...L.laps) : null, fm = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`; S.fill(100, 26, 280, 160, hex('#2a1d17')); S.fill(102, 28, 276, 156, hex('#efe6cf'));
  text(S, (lang.ko ? '주행 보고 - ' : 'DRIVE REPORT - ') + (D.name || ''), 108, 34, hex('#7a2a22'), 1, 264);
  const rows = [['BEST LAP', best ? fm(best) : '-'], ['LAPS', L.laps.map(fm).join('  ')], ['TOP SPEED SEEN', L.top.toFixed(0) + ' MPH'], ['MOST CORNERING', L.maxG.toFixed(2) + ' G'], ['SLOWEST CORNER BY THIRD', L.minCorner.map(v => (v > 900 ? '-' : v.toFixed(0))).join(' / ') + ' MPH'],
    ['BRAKES', `${Math.round(L.maxTb)} C${L.fade ? (lang.ko ? ', 페이드 발생' : ', FADED') : ''}`], ['SPINS / OFFS', `${L.spins} / ${L.offs}`], ['MISSED SHIFTS', String(L.grinds)], ['BOTTOMED / SCRAPED', `${L.bottoms} / ${L.scrapes}${L.air > 0.15 ? (lang.ko ? `, 공중 ${L.air.toFixed(1)}초` : `, AIRBORNE ${L.air.toFixed(1)} S`) : ''}`], ['ROUGH ROAD', L.shake > 0.9 ? 'BODY SHAKES AND RATTLES' : L.shake > 0.5 ? 'SOME SHAKE' : 'SOLID']];
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
