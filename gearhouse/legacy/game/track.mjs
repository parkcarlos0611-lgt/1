// Stage D places: the mock-up room (turntable, lamps, the board looking on) and the proving ground you drive yourself.
// The drive uses the same physics as the engineering report (torque curve, gears, final drive, mass, drag, brakes),
// so what you feel on the track is what the figures said - and the measured results are written back to the project.
import { W, H, C, text, button, input, lineTo, bevel, N } from './ui.mjs';
import { hex } from '../tools/pixel/color.mjs';
import { GEARBOX } from '../sim/drive.mjs';

const colOf = (P, px, i) => { const ramp = P.ramps[px.r[i]], lv = px.l[i]; return lv < 0 ? ramp.o : ramp.c[Math.max(0, Math.min(ramp.c.length - 1, lv))]; };
// sprite drawn with its width scaled (turntable foreshortening), optional mirror, optional vertical offset per column (rough road)
function drawCols(S, P, px, x0, y0, k = 1, flip = false) { const w = Math.max(1, Math.round(px.w * k)), sh = P.byName.shadow;
  for (let sx = 0; sx < w; sx++) { let src = Math.min(px.w - 1, Math.floor(sx / k)); if (flip) src = px.w - 1 - src; for (let y = 0; y < px.h; y++) { const i = y * px.w + src; if (!px.r[i]) continue; if (px.r[i] === sh) S.blend(x0 + sx, y0 + y, colOf(P, px, i), 0.28); else S.fill(x0 + sx, y0 + y, 1, 1, colOf(P, px, i)); } } }
const figure = (S, x, y, hat = true, c = hex('#1d1a1c')) => { S.fill(x - 3, y - 26, 7, 7, c); if (hat) { S.fill(x - 5, y - 27, 11, 2, c); S.fill(x - 3, y - 31, 7, 4, c); } S.fill(x - 5, y - 19, 11, 13, c); S.fill(x - 4, y - 6, 4, 7, c); S.fill(x + 1, y - 6, 4, 7, c); };

// ---------- mock-up room ----------
export function drawMockRoom(S, P, R, sfx) {   // R = { get(view) -> Pix, wood, notes[], score, t }
  R.t++; const day = R.lights === 'day';
  S.fill(0, 0, W, H, hex(day ? '#b9b3a4' : '#2b2724')); for (let x = 20; x < W; x += 92) { S.fill(x, 14, 60, 96, hex(day ? '#dfe7e4' : '#3b3f44')); S.fill(x + 29, 14, 2, 96, hex(day ? '#8f8a7d' : '#2b2724')); S.fill(x, 60, 60, 2, hex(day ? '#8f8a7d' : '#2b2724')); }   // tall studio windows
  S.fill(0, 168, W, H - 168, hex(day ? '#8d8474' : '#3a332d')); for (let x = 0; x < W; x += 30) S.fill(x, 168, 1, H - 168, hex(day ? '#7f7667' : '#332c27'));
  S.fill(0, 8, W, 4, hex('#5a5550')); const cx = 250, cy = 196;
  if (!day) for (const lx of [150, 250, 350]) { S.fill(lx - 6, 12, 12, 6, hex('#8a8278')); for (let yy = 18; yy < cy; yy++) { const hw = (yy - 18) * 0.42; for (let xx = -hw; xx <= hw; xx++) S.blend(Math.round(lx + xx), yy, [255, 240, 200], 0.045); } }   // lamp cones
  for (let yy = -9; yy <= 9; yy++) { const hw = Math.round(Math.sqrt(1 - (yy / 9) ** 2) * 118); S.fill(cx - hw, cy + yy, hw * 2, 1, hex(yy < -6 ? '#9a8f7c' : '#6b5f50')); } S.fill(cx - 118, cy + 3, 236, 2, hex('#4a4136'));   // turntable
  const th = R.spin ? R.t * 0.012 : R.th || 0; R.th = th; const c = Math.cos(th), s = Math.sin(th), side = Math.abs(c) >= Math.abs(s);
  const px = R.get(side ? 'side' : s > 0 ? 'front' : 'rear'); if (px) { const k = Math.max(0.12, side ? Math.abs(c) : Math.abs(s)), sc = 1, w = Math.round(px.w * k); drawCols(S, P, px, Math.round(cx - w / 2), cy + 2 - px.h, k, side && c < 0); }
  [[40, 214], [62, 220], [86, 212]].forEach(([x, y], i) => figure(S, x, y, true)); figure(S, 430, 216, false, hex('#4a3f33')); S.fill(436, 198, 14, 2, hex('#c9a24a'));   // the board, a modeller with his rake
  bevel(S, 0, 0, W, 16, C.oxblood, C.oxL, C.oxD); text(S, R.wood ? 'MOCK-UP ROOM - FULL-SIZE WOODEN MOCK-UP' : 'MOCK-UP ROOM - FULL-SIZE CLAY MODEL', 8, 6, C.brassL);
  if (R.notes?.length) { const bx = 20, by = 120; S.fill(bx, by, 190, 12 + R.notes.length * 9, C.white); S.fill(bx + 20, by + 12 + R.notes.length * 9, 6, 5, C.white); text(S, `BOARD SCORE ${Math.round(R.score * 100)} / 100`, bx + 4, by + 3, R.score > 0.6 ? C.green : C.oxblood); R.notes.forEach((n, i) => text(S, '- ' + n, bx + 4, by + 12 + i * 9, C.ink, 1, 182)); }
  else text(S, 'THE BOARD WILL GIVE ITS VERDICT WHEN THE MODEL IS FINISHED.', 20, 150, day ? C.ink : C.paper, 1, 300);
  if (button(S, 300, 248, 54, 14, R.spin ? 'STOP' : 'TURN')) R.spin = !R.spin; if (!R.spin) { if (button(S, 358, 248, 16, 14, '<')) R.th = th - 0.35; if (button(S, 376, 248, 16, 14, '>')) R.th = th + 0.35; }
  if (button(S, 232, 248, 64, 14, day ? 'SPOTLIGHTS' : 'DAYLIGHT')) R.lights = day ? 'spot' : 'day';
  return button(S, W - 66, 248, 60, 14, 'BACK', { tone: 'ox' });
}

// ---------- proving ground: you drive ----------
const ZONES = [[0, 'STANDING START - FLAT OUT TO 60 MPH', 0], [650, 'HILL CLIMB 12 %', 0.12], [950, 'ROUGH ROAD', 0], [1350, 'HIGH-SPEED STRAIGHT', 0], [2450, 'BRAKE TEST - STOP BEFORE THE BOARD', 0], [2650, 'END', 0]];
export function makeRun({ es, engine, gearbox, final, mass, cda, hyd, stiff, year, name }) {
  return { es, engine, G: GEARBOX[gearbox.type], R: gearbox.ratios, fd: final, r: 0.36, m: mass, cda, hyd, stiff, year, name, v: 0, x: 0, gi: 0, pause: 0, t: 0, rpm: 700, heat: 0, bob: 0, done: false,
    log: { t60: null, top: 0, hillMin: null, stalled: false, rattle: 0, brakeFrom: null, brakeDist: null, stopX: null } }; }
const tq = (es, rpm) => { const c = es.curve; if (rpm <= c[0].rpm) return c[0].T * 0.85; if (rpm >= c.at(-1).rpm) return 0; const i = Math.floor((rpm - c[0].rpm) / 100); return c[i].T + (c[i + 1] ? (c[i + 1].T - c[i].T) * ((rpm - c[i].rpm) / 100) : 0); };
export function stepRun(T, gas, brake, dt = 1 / 60) {
  if (T.done) return; const zi = ZONES.findLastIndex(z => T.x >= z[0]), [zx, , grade] = ZONES[zi], g = 9.81, rpmAt = gi => T.v / T.r * T.R[gi] * T.fd * 60 / (2 * Math.PI);
  let rpm = Math.max(700, rpmAt(T.gi)), f = 0; const resist = (0.018 + (zi === 2 ? 0.02 : 0)) * T.m * g + 0.6 * T.cda * T.v * T.v + T.m * g * grade;
  if (T.pause > 0) T.pause -= dt; else { if (rpm > T.es.redline * 0.94 && T.gi + 1 < T.R.length) { T.gi++; T.pause = T.G.shift; } else if (rpm < 1100 && T.gi > 0 && T.v > 1) { T.gi--; T.pause = T.G.shift * 0.6; }
    if (gas && T.pause <= 0) f = Math.min(tq(T.es, Math.min(Math.max(rpm, 900), T.es.redline)) * T.R[T.gi] * T.fd * T.G.eff / T.r, 0.75 * T.m * g * 0.55); }
  let bf = 0; if (brake) { T.heat = Math.min(1, T.heat + dt * T.v / 60); bf = T.m * (T.hyd ? 6.4 : 4.6) * (1 - (T.hyd ? 0.15 : 0.4) * T.heat); } else T.heat = Math.max(0, T.heat - dt * 0.08);
  T.v = Math.max(0, T.v + (f - resist * (T.v > 0.05 || f > resist ? 1 : 0) - bf) / T.m * dt); T.x += T.v * dt; T.t += dt; T.rpm = T.pause > 0 ? Math.max(700, rpm * 0.8) : gas ? Math.min(Math.max(rpm, 900), T.es.redline) : Math.max(700, rpm); T.load = gas && T.pause <= 0 ? 1 : 0.1;
  const L = T.log, mph = T.v * 2.237; if (L.t60 == null && mph >= 60) L.t60 = T.t; L.top = Math.max(L.top, mph);
  if (zi === 1) { if (T.x > zx + 80) L.hillMin = Math.min(L.hillMin ?? 999, mph); if (T.v < 0.3 && gas && T.x > zx + 20) { L.stall = (L.stall || 0) + dt; if (L.stall > 2.5) L.stalled = true; } }
  if (zi === 2) { T.bob = Math.sin(T.x * 1.7) * Math.min(3, T.v / 6); L.rattle = Math.max(L.rattle, (1 - Math.min(1, T.stiff)) * Math.min(1, T.v / 15)); } else T.bob *= 0.8;
  if (zi === 4) { if (L.brakeFrom == null) L.brakeFrom = mph; if (T.v < 0.2 && L.brakeDist == null && T.t > 3) { L.brakeDist = T.x - zx; L.stopX = T.x; T.done = true; } }
  if (zi >= 5 || (L.stalled && T.v < 0.2) || T.t > 240) { if (L.brakeDist == null && zi >= 5) L.brakeDist = 999; T.done = true; }
}
const dial = (S, x, y, R, frac, label, val, redFrom = 2) => { for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) { const r = Math.hypot(xx, yy); if (r <= R) S.fill(x + xx, y + yy, 1, 1, r > R - 2 ? C.brass : hex('#f3ead2')); }
  for (let k = 0; k <= 8; k++) { const a = Math.PI * (0.8 + 1.4 * k / 8); S.fill(Math.round(x + Math.cos(a) * (R - 4)), Math.round(y + Math.sin(a) * (R - 4)), 1, 1, k / 8 >= redFrom ? C.red : C.ink); }
  const a = Math.PI * (0.8 + 1.4 * Math.max(0, Math.min(1, frac))); lineTo(S, x, y, x + Math.cos(a) * (R - 5), y + Math.sin(a) * (R - 5), C.red); S.fill(x - 1, y - 1, 3, 3, C.ink); text(S, label, x + R + 3, y - 7, C.paper); text(S, val, x + R + 3, y + 2, C.brassL); };
export function drawTrack(S, P, T, sprite, sfx) {   // sprite(rot) -> side Pix (nose to the left)
  const gas = (input.down && input.x >= W - 96 && input.y >= 200) || input.keys?.ArrowRight || input.keys?.ArrowUp || input.keys?.[' '], brake = (input.down && input.x < 96 && input.y >= 200) || input.keys?.ArrowLeft || input.keys?.ArrowDown;
  for (let k = 0; k < 2; k++) stepRun(T, gas, brake, 1 / 120);
  const zi = ZONES.findLastIndex(z => T.x >= z[0]), zone = ZONES[Math.min(zi, 4)], px0 = sprite(0), mm = px0?.mm || 25, ppm = 1000 / mm, dist = T.x * ppm, gy = 190, grade = zone[2];
  S.fill(0, 0, W, gy, hex('#cfd9d6')); for (let k = 0; k < 6; k++) { const hx = ((k * 130 + dist * 0.08) % (W + 160)) - 80; for (let yy = 0; yy < 26; yy++) S.fill(Math.round(hx - 60 + yy * 1.6), gy - 60 + yy, Math.round(120 - yy * 3.2), 1, hex('#a8b8aa')); }   // far hills
  for (let k = 0; k < 8; k++) { const tx = ((k * 77 + dist * 0.3) % (W + 60)) - 30; S.fill(tx, gy - 34, 3, 16, hex('#5d4b3a')); S.fill(tx - 7, gy - 46, 17, 14, hex('#6f8a5c')); }   // trees
  S.fill(0, gy - 18, W, 18, hex(zi === 1 ? '#7f8f62' : '#8d9a6a')); S.fill(0, gy, W, 40, hex(zi === 2 ? '#7d6e58' : '#8a7a62')); S.fill(0, gy, W, 1, hex('#5a4d3c'));
  for (let k = 0; k < 12; k++) { const x = ((k * 50 + dist) % (W + 40)) - 20; if (zi === 2) { S.fill(x, gy + 3 + (k % 3) * 4, 5, 2, hex('#5f5242')); S.fill(x + 20, gy + 9, 3, 2, hex('#9a8a70')); } else S.fill(x, gy + 18, 18, 1, hex('#b5a684')); }
  for (const [zx, nm] of ZONES) { const sx = 150 + (T.x - zx) * ppm; if (sx > -60 && sx < W + 60) { S.fill(Math.round(sx), gy - 44, 2, 44, hex('#efe6cf')); S.fill(Math.round(sx) - 30, gy - 58, 62, 15, C.white); S.fill(Math.round(sx) - 30, gy - 58, 62, 1, C.oxblood); text(S, nm.split(' - ')[0].slice(0, 15), Math.round(sx) - 28, gy - 53, C.oxblood, 1, 58); } }   // zone boards (car runs to the left)
  for (let d2 = Math.floor(T.x / 100) * 100 - 200; d2 < T.x + 500; d2 += 100) { const sx = 150 + (T.x - d2) * ppm; if (sx > 0 && sx < W) { S.fill(Math.round(sx), gy - 8, 1, 8, C.white); } }
  const rpx = 0.36 * ppm, rot = Math.round((((T.x * ppm) / rpx) % 6.2832) / 6.2832 * 16) % 16 * 6.2832 / 16, px = sprite(rot);
  if (px) { const cx = 150 - Math.round(px.w * 0.35), tilt = grade ? -3 : 0, cy = gy + 2 - px.h + Math.round(T.bob) + tilt; drawCols(S, P, px, cx, cy, 1, false);
    if (T.load > 0.5) for (let k = 0; k < 5; k++) { const f = ((T.t * 60 + k * 7) % 35) / 35; S.blend(Math.round(cx + px.w + f * 26), Math.round(gy - 6 - f * 7), [185, 180, 172], 0.6 * (1 - f)); }
    if (T.v > 2) for (let k = 0; k < 6; k++) { const f = ((T.t * 120 + k * 11) % 40) / 40; S.blend(Math.round(cx + px.w * 0.8 + f * 30), Math.round(gy - 2 - f * (zi === 2 ? 14 : 6)), [200, 184, 150], (zi === 2 ? 0.8 : 0.45) * (1 - f)); } }
  // dashboard
  S.fill(0, 230, W, 40, hex('#2a1d17')); S.fill(0, 230, W, 1, C.brassD); const mph = T.v * 2.237;
  dial(S, 150, 250, 14, mph / 100, 'MPH', mph.toFixed(0)); dial(S, 215, 250, 14, T.rpm / (T.es.redline * 1.1), 'RPM', String(Math.round(T.rpm / 50) * 50), 0.88);
  text(S, 'GEAR ' + (T.pause > 0 ? '-' : T.gi + 1), 290, 236, C.brassL); text(S, T.t.toFixed(1) + ' S', 290, 246, C.paper); text(S, Math.round(T.x) + ' M', 290, 256, C.paper);
  bevel(S, 0, 0, W, 16, C.oxblood, C.oxL, C.oxD); text(S, 'PROVING GROUND - ' + zone[1], 8, 6, C.brassL, 1, 330);
  button(S, 4, 234, 88, 30, 'BRAKE', { tone: 'ox', active: !!brake }); button(S, W - 92, 234, 88, 30, 'GAS', { tone: 'teal', active: !!gas });
  text(S, 'HOLD GAS / BRAKE  (ARROW KEYS)', 100, 222, C.ink, 1, 200);
  if (T.done) { const L = T.log; S.fill(110, 40, 260, 126, C.ink); S.fill(112, 42, 256, 122, C.paper); text(S, 'TEST REPORT - ' + N(T.name || ''), 118, 48, C.oxblood, 1, 244);
    const rows = [['0-60 MPH', L.t60 ? L.t60.toFixed(1) + ' S' : 'NOT REACHED'], ['TOP SPEED SEEN', L.top.toFixed(0) + ' MPH'], ['HILL 12 %', L.stalled ? 'STALLED' : L.hillMin != null ? 'CLIMBED, SLOWEST ' + L.hillMin.toFixed(0) + ' MPH' : '-'],
      ['ROUGH ROAD', L.rattle > 0.45 ? 'BODY SHAKES AND RATTLES' : L.rattle > 0.25 ? 'SOME SHAKE' : 'SOLID'], ['BRAKING', L.brakeDist == null ? '-' : L.brakeDist > 190 ? 'OVERSHOT THE BOARD' : `${Math.round(L.brakeDist)} M FROM ${Math.round(L.brakeFrom || 0)} MPH`]];
    rows.forEach(([a, b], i) => { text(S, a, 118, 62 + i * 12, C.inkSoft); text(S, b, 196, 62 + i * 12, C.ink, 1, 168); });
    if (button(S, 118, 142, 100, 16, 'DRIVE AGAIN')) return 'again'; if (button(S, 262, 142, 100, 16, 'BACK', { tone: 'ox' })) return 'back'; }
  else if (button(S, W - 66, 2, 60, 12, 'BACK', { tone: 'ox' })) return 'back';
  return null;
}
