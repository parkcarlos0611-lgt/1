// Track driving seen from behind the car (plan 19-3): the road is projected in segments towards the horizon,
// the car's rear view sits at the bottom, leaning with roll and pitch and riding the bumps.
// Physics: engine torque curve, gears and final drive, drag, rolling resistance, grades (as the engineering report);
// cornering limited by the chassis grip, balance and banking; brakes by the chassis deceleration with drum heating and fade.
import { W, H, C, text, button, input, held, bevel, lineTo, N, lang, tw } from './ui.mjs';
import { hex } from '../tools/pixel/color.mjs';
import { GEARBOX } from '../sim/drive.mjs';

// ---- tracks: straights and turns (right turns positive degrees), grade, banking (deg), rough surface ----
const S_ = (len, o = {}) => ({ len, ...o }), T_ = (R, deg, o = {}) => ({ len: Math.abs(R * deg * Math.PI / 180), k: Math.sign(deg) / R, ...o });
export const TRACKS = [
  { kind: 'TEST ROAD', surf: 'tar', laps: 2, segs: [S_(500), T_(150, 90), S_(150, { grade: 0.10 }), S_(150, { grade: -0.10 }), T_(60, 90), S_(300, { rough: 1 }), T_(100, 60), T_(80, -30), S_(150), T_(120, 120), S_(200), T_(150, 30), S_(120)] },
  { kind: 'BANKED OVAL', surf: 'con', laps: 3, segs: [S_(600), T_(250, 180, { bank: 22 }), S_(600), T_(250, 180, { bank: 22 })] },
  { kind: 'ROAD CIRCUIT', surf: 'tar', laps: 2, segs: [S_(700), T_(40, 90), S_(250), T_(120, -45), T_(90, 90), S_(300, { grade: 0.05 }), T_(200, 60), S_(400, { grade: -0.05 }), T_(60, -60), T_(70, 150), S_(300), T_(150, 75), S_(100)] }];
export const trackName = (g, i) => (g.trackNames?.[i] ? N(g.trackNames[i]) : lang.ko ? `${i + 1}번 트랙` : `TRACK ${i + 1}`);
const DS = 2;                                                                                        // metres per road slice
function build(tr) { if (tr.cells) return tr; const cells = []; let el = 0;
  for (const s of tr.segs) { const n = Math.max(1, Math.round(s.len / DS)); for (let q = 0; q < n; q++) { el += (s.grade || 0) * DS; cells.push({ k: s.k || 0, el, bank: s.bank || 0, rough: s.rough || 0, grade: s.grade || 0 }); } }
  // map outline, closure error spread along the lap
  let x = 0, y = 0, th = 0; const pts = cells.map(c => { th += c.k * DS; x += Math.cos(th) * DS; y += Math.sin(th) * DS; return [x, y]; }), ex = x, ey = y, n = pts.length;
  tr.map = pts.map(([px, py], i) => [px - ex * (i + 1) / n, py - ey * (i + 1) / n]); tr.cells = cells; tr.L = cells.length * DS; return tr; }

// ---- run state ----
// car: { name, es, engine, gearbox, final, mass, cda, crr, tyreR, ch, hyd, stiff, year }
export function makeDrive(car, ti) { const tr = build(TRACKS[ti]);
  return { car, ti, tr, G: GEARBOX[car.gearbox.type], R: car.gearbox.ratios, s: 0, x: 0, psi: 0, v: 0, gi: 0, pause: 0, rpm: 700, t: 0, lap: 0, lapT0: 0, steer: 0, aLat: 0, aLon: 0, tb: 40, bob: 0, autoGas: input.touch ?? false, done: false,
    log: { laps: [], top: 0, maxG: 0, maxTb: 40, fade: false, spins: 0, offs: 0, shake: 0, minCorner: [999, 999, 999] } }; }
const tq = (es, rpm) => { const c = es.curve; if (rpm <= c[0].rpm) return c[0].T * 0.85; if (rpm >= c.at(-1).rpm) return 0; const i = Math.floor((rpm - c[0].rpm) / 100); return c[i].T + (c[i + 1] ? (c[i + 1].T - c[i].T) * ((rpm - c[i].rpm) / 100) : 0); };
const cellAt = (D, s) => D.tr.cells[((Math.floor(s / DS) % D.tr.cells.length) + D.tr.cells.length) % D.tr.cells.length];

export function stepDrive(D, gas, brake, steerIn, dt) {
  if (D.done) return; const { car } = D, ch = car.ch, g = 9.81, c = cellAt(D, D.s), m = car.mass, r = car.tyreR;
  D.steer += Math.max(-dt * 2.2, Math.min(dt * 2.2, steerIn - D.steer));                                  // steering wheel takes a moment to wind on
  const off = Math.abs(D.x) > 4.2, mu = ch.latG * (off ? 0.55 : 1) * (c.rough ? 0.92 : 1), tb = Math.tan((c.bank || 0) * Math.PI / 180), aMax = g * (mu + tb) / (1 - mu * tb);   // banking leans the load into the tyres
  // longitudinal: engine through the gears, rolling resistance, drag, grade, brakes
  const rpmAt = gi => D.v / r * D.R[gi] * car.final * 60 / (2 * Math.PI); let rpm = Math.max(700, rpmAt(D.gi)), f = 0;
  if (D.pause > 0) D.pause -= dt; else { if (rpm > car.es.redline * 0.95 && D.gi + 1 < D.R.length) { D.gi++; D.pause = D.G.shift; } else if (rpm < 1150 && D.gi > 0) { D.gi--; D.pause = D.G.shift * 0.6; }
    if (gas && D.pause <= 0) f = Math.min(tq(car.es, Math.min(Math.max(rpm, 900), car.es.redline)) * D.R[D.gi] * car.final * D.G.eff / r, mu * m * g * 0.55); }
  const resist = (car.crr + (off ? 0.06 : 0) + (c.rough ? 0.015 : 0)) * m * g + 0.6 * car.cda * D.v * D.v + m * g * c.grade;
  const fade = D.tb > 260 ? Math.max(0.45, 1 - (D.tb - 260) / 300) : 1, dec = brake ? Math.min(ch.decel, mu * 1.02) * g * fade : 0; if (fade < 0.9) D.log.fade = true;
  const P = m * dec * D.v * ch.bias / 2; D.tb += (P / (ch.drumKg * 460) - (D.tb - 30) * (0.02 + D.v * 0.0012)) * dt; D.log.maxTb = Math.max(D.log.maxTb, D.tb);
  const v0 = D.v; D.v = Math.max(0, D.v + ((f - resist * (D.v > 0.05 || f > resist ? 1 : 0)) / m - dec) * dt); D.aLon = (D.v - v0) / dt;
  // lateral: the wheel asks for a curvature; grip and balance decide what the car does
  const vv = Math.max(D.v, 1), kLock = 1 / 6, want = D.steer * Math.abs(D.steer) * Math.min(kLock, 1.3 * aMax / (vv * vv)); let k = want; const need = vv * vv * Math.abs(want);
  if (need > aMax) { const over = need / aMax - 1;
    if (ch.balance >= 0) { k = Math.sign(want) * aMax / (vv * vv); D.v = Math.max(0, D.v - over * 4 * dt); }          // understeer: the nose runs wide and scrubs speed
    else D.psi += Math.sign(want) * over * 2.4 * dt; }                                                                 // oversteer: the tail comes round
  D.psi += D.v * (k - c.k) * dt; D.x += D.v * Math.sin(D.psi) * dt; D.aLat = D.v * D.v * k;
  if (Math.abs(D.psi) > 0.7) { D.log.spins++; D.psi = 0; D.v *= 0.25; }                                             // spun: gather it up
  if (Math.abs(D.x) > 4.2 && !D.wasOff) D.log.offs++; D.wasOff = Math.abs(D.x) > 4.2; if (Math.abs(D.x) > 11) { D.x = Math.sign(D.x) * 11; D.v *= 0.9; D.psi *= 0.5; }
  // ride: bumps through springs and dampers
  const rough = c.rough || off ? 1 : 0.15, A = rough * (1.2 + (ch.fF - 1.1) * 1.5 + (1 - ch.control) * 3) * Math.min(1, D.v / 12);
  D.bob = Math.sin(D.s * 1.9) * A + Math.sin(D.s * 3.7) * A * 0.4; if (c.rough) D.log.shake = Math.max(D.log.shake, A / 3);
  D.s += D.v * Math.cos(D.psi) * dt; D.t += dt; D.rpm = D.pause > 0 ? Math.max(700, rpm * 0.8) : gas ? Math.min(Math.max(rpm, 900), car.es.redline) : Math.max(700, rpm); D.load = gas && D.pause <= 0 ? 1 : 0.1;
  const L = D.log, mph = D.v * 2.237; L.top = Math.max(L.top, mph); L.maxG = Math.max(L.maxG, Math.abs(D.aLat) / g);
  if (Math.abs(c.k) > 1 / 300) { const sec = Math.min(2, Math.floor((D.s % D.tr.L) / D.tr.L * 3)); L.minCorner[sec] = Math.min(L.minCorner[sec], mph); }
  if (D.s >= (D.lap + 1) * D.tr.L) { L.laps.push(D.t - D.lapT0); D.lapT0 = D.t; D.lap++; if (D.lap >= D.tr.laps) D.done = true; }
  if (D.t > 900) D.done = true;
}

// ---- drawing ----
const colOf = (P, px, i) => { const ramp = P.ramps[px.r[i]], lv = px.l[i]; return lv < 0 ? ramp.o : ramp.c[Math.max(0, Math.min(ramp.c.length - 1, lv))]; };
// the rear view, its body (above the wheel line) sheared by roll and lifted by pitch, the wheels staying on the road
function drawCar(S, P, px, x0, y0, rollDeg, pitchPx, wheelRows) { const sh = Math.tan(rollDeg * Math.PI / 180), sd = P.byName.shadow;
  for (let y = 0; y < px.h; y++) { const body = y < px.h - wheelRows, dx = body ? Math.round((px.h - wheelRows - y) * sh) : 0, dy = body ? Math.round(pitchPx) : 0;
    for (let x = 0; x < px.w; x++) { const i = y * px.w + x; if (!px.r[i]) continue; const col = colOf(P, px, i); if (!col) continue; if (px.r[i] === sd) S.blend(x0 + x + dx, y0 + y + dy, col, 0.28); else S.fill(x0 + x + dx, y0 + y + dy, 1, 1, col); } } }
const HZ = 92, F = 230, CAMH = 1.35, AHEAD = 5, VIEW = 260;
const COL = { sky0: hex('#9fb8c4'), sky1: hex('#d9e2dc'), hill: hex('#8fa292'), hill2: hex('#7a8f7c'), g0: hex('#7f9a5c'), g1: hex('#748f53'), tar: hex('#6f6b66'), tar2: hex('#67635e'), con: hex('#aaa59a'), con2: hex('#a19c90'), gravel: hex('#8a7a62'), gravel2: hex('#807058'),
  rum0: hex('#e9e2d0'), rum1: hex('#b0341f'), line: hex('#efe6cf'), wall: hex('#c9c2b2'), wallD: hex('#9d9686'), trunk: hex('#5d4b3a'), leaf: hex('#56724a'), leaf2: hex('#6f8a5c'), post: hex('#efe6cf') };
export function drawDrive(S, P, D, sprite, sfx) {
  const k = input.keys || {}, left = k.ArrowLeft || held(2, H - 44, 56, 40), right = k.ArrowRight || held(62, H - 44, 56, 40);   // every finger counts: steer and pedal together
  const brake = k.ArrowDown || held(W - 58, H - 44, 56, 40), gas = !brake && (k.ArrowUp || k[' '] || held(W - 120, H - 44, 56, 40) || D.autoGas);
  for (let q = 0; q < 3; q++) stepDrive(D, gas, brake, (right ? 1 : 0) - (left ? 1 : 0), 1 / 180);
  const tr = D.tr, cells = tr.cells, nC = cells.length, sCam = D.s - AHEAD, i0 = Math.floor(sCam / DS), frac = (sCam / DS) - i0, at = i => cells[((i % nC) + nC) % nC], elev0 = at(i0).el;
  // sky and far hills turn with the car's heading round the lap
  let head = D.psi; for (let i = 0; i < ((i0 % nC) + nC) % nC; i++) head += cells[i].k * DS; head += D.lap * 2 * Math.PI;
  for (let y = 0; y < HZ; y++) { const t = y / HZ; S.fill(0, y, W, 1, [COL.sky0[0] + (COL.sky1[0] - COL.sky0[0]) * t, COL.sky0[1] + (COL.sky1[1] - COL.sky0[1]) * t, COL.sky0[2] + (COL.sky1[2] - COL.sky0[2]) * t].map(Math.round)); }
  for (let x = 0; x < W; x++) { const a = head * 120 + x; const h1 = 10 + Math.sin(a * 0.013) * 7 + Math.sin(a * 0.031) * 4, h2 = 4 + Math.sin(a * 0.021 + 2) * 4; S.fill(x, HZ - Math.round(h1), 1, Math.round(h1), COL.hill); S.fill(x, HZ - Math.round(h2), 1, Math.round(h2), COL.hill2); }
  S.fill(0, HZ, W, H - HZ, COL.g0);
  // project the road slices: lateral position from the curvature summed from the car's heading
  const proj = []; let th = -D.psi, lx = -D.x;
  for (let n = 0; n <= VIEW; n++) { const z = (n + 1 - frac) * DS, c = at(i0 + n); if (n) { th += c.k * DS; lx += Math.sin(th) * DS; }
    const sc = F / z; proj.push({ z, sx: W / 2 + lx * sc, sy: HZ - (c.el - elev0 - CAMH) * sc + D.bob * 0.15, hw: 4.2 * sc, c, idx: i0 + n, sc }); }
  const surf = tr.surf === 'con' ? [COL.con, COL.con2] : [COL.tar, COL.tar2]; let clipY = H; const clipAt = [];
  for (let n = 1; n <= VIEW; n++) { const a = proj[n - 1], b = proj[n]; clipAt[n] = clipY; if (b.sy >= clipY) continue; const y0 = Math.max(HZ, Math.ceil(b.sy)), y1 = Math.min(clipY - 1, Math.floor(a.sy));
    const m2 = v => ((v % 2) + 2) % 2, band = m2(Math.floor(b.idx / 5)), rum = m2(Math.floor(b.idx / 2)), dash = m2(Math.floor(b.idx / 4)), rough = b.c.rough, ban = b.c.bank, side = Math.sign(b.c.k);
    for (let y = y0; y <= y1; y++) { const t = a.sy === b.sy ? 0 : (y - a.sy) / (b.sy - a.sy), cx = a.sx + (b.sx - a.sx) * t, hw = a.hw + (b.hw - a.hw) * t, rw = hw * 0.12;
      S.fill(0, y, W, 1, band ? COL.g0 : COL.g1); S.fill(Math.round(cx - hw - rw), y, Math.round(2 * (hw + rw)), 1, rum ? COL.rum0 : COL.rum1);
      S.fill(Math.round(cx - hw), y, Math.round(2 * hw), 1, rough ? (band ? COL.gravel : COL.gravel2) : surf[band]); if (dash && !rough) S.fill(Math.round(cx - hw * 0.02), y, Math.max(1, Math.round(hw * 0.04)), 1, COL.line);
      if (ban) { const wx = side > 0 ? cx - hw - rw : cx + hw + rw, ww = hw * 0.9; S.fill(Math.round(side > 0 ? wx - ww : wx), y, Math.round(ww), 1, band ? COL.con : COL.con2); } }
    clipY = Math.min(clipY, y0); }
  // roadside: trees and marker posts on the road tracks, the outer wall on the bowl; start line and boards
  for (let n = VIEW; n >= 2; n--) { const p = proj[n]; if (p.sy > clipAt[n] || p.z < 3) continue; const id = ((p.idx % nC) + nC) % nC, sc = p.sc, lim = clipAt[n];
    const put = (x, y, w2, h2, col) => { const yy = Math.round(y), hh = Math.min(Math.round(h2), Math.round(lim - yy)); if (hh > 0 && w2 >= 1) S.fill(Math.round(x), yy, Math.max(1, Math.round(w2)), hh, col); };
    if (id === 0) for (let q = 0; q < 8; q++) put(p.sx - p.hw + q * p.hw / 4, p.sy - 0.15 * sc, p.hw / 4, 0.15 * sc, q % 2 ? C.ink : C.white);
    if (tr.surf !== 'con' && id % 6 === 0) for (const s of [-1, 1]) { if ((id * 7 + (s > 0 ? 3 : 0)) % 3) { const tx = p.sx + s * (p.hw + 3.5 * sc); put(tx - 0.25 * sc, p.sy - 3 * sc, 0.5 * sc, 3 * sc, COL.trunk); put(tx - 1.6 * sc, p.sy - 6.5 * sc, 3.2 * sc, 3.8 * sc, id % 2 ? COL.leaf : COL.leaf2); }
      else { const tx = p.sx + s * (p.hw + 1.5 * sc); put(tx, p.sy - 1 * sc, 0.15 * sc, 1 * sc, COL.post); put(tx, p.sy - 1 * sc, 0.15 * sc, 0.2 * sc, C.red); } }
    if (tr.surf === 'con' && id % 6 === 0 && !p.c.bank) for (const s of [-1, 1]) put(p.sx + s * (p.hw + 1 * sc) - 0.1 * sc, p.sy - 1.2 * sc, 0.2 * sc, 1.2 * sc, COL.post); }
  // the car
  const spx = sprite(); if (spx) { const ch = D.car.ch, roll = Math.max(-12, Math.min(12, -ch.roll * D.aLat / 9.81 * 2)), pitch = D.aLon < 0 ? Math.min(3, -D.aLon / 9.81 * ch.dive * 2.5) * -1 : Math.min(2, D.aLon / 9.81 * ch.squat * 3);
    const x0 = Math.round(W / 2 - spx.w / 2 + D.steer * 4), y0 = Math.round(H - 50 - spx.h + D.bob); S.fill(x0 + 2, y0 + spx.h - 2, spx.w - 4, 3, hex('#3a3632'));
    drawCar(S, P, spx, x0, y0, roll, pitch, Math.round(spx.h * 0.24));
    if (D.load > 0.5) for (let q = 0; q < 5; q++) { const f = ((D.t * 60 + q * 7) % 35) / 35; S.blend(Math.round(x0 + spx.w * 0.25 - f * 8), Math.round(y0 + spx.h - 4 + f * 4), [185, 180, 172], 0.55 * (1 - f)); }
    if (Math.abs(D.x) > 4.2 || cellAt(D, D.s).rough) for (let q = 0; q < 6; q++) { const f = ((D.t * 90 + q * 11) % 30) / 30; for (const s of [0.1, 0.9]) S.blend(Math.round(x0 + spx.w * s + (s < 0.5 ? -1 : 1) * f * 10), Math.round(y0 + spx.h - f * 10), [200, 184, 150], 0.6 * (1 - f)); } }
  // map
  const mp = tr.map; let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9; for (const [x, y] of mp) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
  const ms = Math.min(70 / (mxx - mnx), 46 / (mxy - mny)), mx0 = W - 80, my0 = 22; S.fill(mx0 - 4, my0 - 4, 82, 56, C.ink);
  for (let i = 0; i < mp.length; i += 3) S.fill(Math.round(mx0 + (mp[i][0] - mnx) * ms), Math.round(my0 + (mp[i][1] - mny) * ms), 1, 1, C.paper);
  { const i = Math.floor(((D.s % tr.L) + tr.L) % tr.L / DS) % mp.length; S.fill(Math.round(mx0 + (mp[i][0] - mnx) * ms) - 1, Math.round(my0 + (mp[i][1] - mny) * ms) - 1, 3, 3, C.red); }
  // dashboard
  S.fill(0, H - 46, W, 46, hex('#2a1d17')); S.fill(0, H - 46, W, 1, C.brassD); const mph = D.v * 2.237;
  dial(S, 160, H - 22, 15, mph / 110, 'MPH', mph.toFixed(0)); dial(S, 232, H - 22, 15, D.rpm / (D.car.es.redline * 1.1), 'RPM', String(Math.round(D.rpm / 50) * 50), 0.88);
  const lapT = D.t - D.lapT0; text(S, (lang.ko ? '기어 ' : 'GEAR ') + (D.pause > 0 ? '-' : D.gi + 1), 300, H - 42, C.brassL); text(S, `${lang.ko ? '랩' : 'LAP'} ${Math.min(D.lap + 1, D.tr.laps)}/${D.tr.laps}  ${lapT.toFixed(1)}`, 300, H - 33, C.paper);
  text(S, `${lang.ko ? '횡가속' : 'LAT'} ${(Math.abs(D.aLat) / 9.81).toFixed(2)} G`, 300, H - 24, C.paper); text(S, lang.ko ? '브레이크 온도' : 'BRAKE TEMP', 300, H - 15, C.paper);
  const tf = Math.min(1, (D.tb - 30) / 330); S.fill(370, H - 14, 40, 5, C.paperDark); S.fill(370, H - 14, Math.round(40 * tf), 5, D.tb > 260 ? C.red : D.tb > 180 ? C.amber : C.teal);
  bevel(S, 0, 0, W, 16, C.oxblood, C.oxL, C.oxD); text(S, `${D.name || ''}  -  ${N(D.car.name || '')}`, 8, 6, C.brassL, 1, 320);
  button(S, 2, H - 44, 56, 40, '<', { tone: 'teal', active: !!left }); button(S, 62, H - 44, 56, 40, '>', { tone: 'teal', active: !!right });
  button(S, W - 120, H - 44, 56, 40, 'GAS', { tone: 'teal', active: !!gas }); button(S, W - 58, H - 44, 56, 40, 'BRAKE', { tone: 'ox', active: !!brake });
  if (button(S, W - 160, 2, 64, 12, D.autoGas ? 'AUTO GAS ON' : 'AUTO GAS OFF', { active: D.autoGas })) D.autoGas = !D.autoGas;
  if (D.done) { const L = D.log, best = L.laps.length ? Math.min(...L.laps) : null, fm = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`; S.fill(100, 30, 280, 150, C.ink); S.fill(102, 32, 276, 146, C.paper);
    text(S, (lang.ko ? '주행 보고 - ' : 'DRIVE REPORT - ') + (D.name || ''), 108, 38, C.oxblood, 1, 264);
    const rows = [['BEST LAP', best ? fm(best) : '-'], ['LAPS', L.laps.map(fm).join('  ')], ['TOP SPEED SEEN', L.top.toFixed(0) + ' MPH'], ['MOST CORNERING', L.maxG.toFixed(2) + ' G'], ['SLOWEST CORNER BY THIRD', L.minCorner.map(v => (v > 900 ? '-' : v.toFixed(0))).join(' / ') + ' MPH'],
      ['BRAKES', `${Math.round(L.maxTb)} C${L.fade ? (lang.ko ? ', 페이드 발생' : ', FADED') : ''}`], ['SPINS / OFFS', `${L.spins} / ${L.offs}`], ['ROUGH ROAD', L.shake > 0.8 ? 'BODY SHAKES AND RATTLES' : L.shake > 0.5 ? 'SOME SHAKE' : 'SOLID']];
    rows.forEach(([a, b], i) => { text(S, a, 108, 52 + i * 11, C.inkSoft, 1, 110); text(S, b, 222, 52 + i * 11, C.ink, 1, 150); });
    if (button(S, 108, 156, 100, 16, 'DRIVE AGAIN')) return 'again'; if (button(S, 270, 156, 100, 16, 'BACK', { tone: 'ox' })) return 'back'; }
  else if (button(S, W - 66, 2, 60, 12, 'BACK', { tone: 'ox' })) return 'back';
  return null;
}
const dial = (S, x, y, R, frac, label, val, redFrom = 2) => { for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) { const r = Math.hypot(xx, yy); if (r <= R) S.fill(x + xx, y + yy, 1, 1, r > R - 2 ? C.brass : hex('#f3ead2')); }
  for (let q = 0; q <= 8; q++) { const a = Math.PI * (0.8 + 1.4 * q / 8); S.fill(Math.round(x + Math.cos(a) * (R - 4)), Math.round(y + Math.sin(a) * (R - 4)), 1, 1, q / 8 >= redFrom ? C.red : C.ink); }
  const a = Math.PI * (0.8 + 1.4 * Math.max(0, Math.min(1, frac))); lineTo(S, x, y, x + Math.cos(a) * (R - 5), y + Math.sin(a) * (R - 5), C.red); S.fill(x - 1, y - 1, 3, 3, C.ink); text(S, label, x + R + 3, y - 7, C.paper); text(S, val, x + R + 3, y + 2, C.brassL); };

// track list: pick a track, give it a name
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
