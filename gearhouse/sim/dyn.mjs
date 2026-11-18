// Real-time vehicle dynamics for the test drive (plan 23-2). Fixed 1 kHz step, semi-implicit Euler.
// A reduced multi-body car: a sprung body (planar u, v, r + heave, roll, pitch), four unsprung corners (beam axles as
// one rigid axle with heave and tilt; independent corners on their own), bias-ply tyres with load sensitivity,
// slip relaxation and a static -> sliding friction fall-off, and a powertrain chain
// engine -> clutch or fluid drive -> gearbox -> open differential -> wheels, with drum brakes that heat and fade.
// Structure follows what real-time car simulators do (fixed high-rate step, tyre slip curves, device chain);
// the equations, constants and calibration here are our own, checked against the design report (sim/chassis.mjs, sim/drive.mjs).
import { GEARBOX } from './drive.mjs';
import { SUSP_F, SUSP_R, DAMPERS, tyreDims } from './chassis.mjs';

const G = 9.81, RAD = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// bias-ply slip curve: peak near 9 deg slip angle / 15 % slip ratio, falling to ~85 % when sliding (Stribeck-like)
const slipCurve = x => { const a = Math.abs(x); return Math.sign(x) * (a <= 1 ? Math.sin(a * Math.PI / 2) : Math.max(0.87, 1 - (a - 1) * 0.07)); };
const torqueAt = (es, rpm) => { const c = es.curve; if (rpm <= c[0].rpm) return c[0].T * Math.max(0, rpm / c[0].rpm) ** 0.5; if (rpm >= c.at(-1).rpm) return Math.max(0, c.at(-1).T * (1 - (rpm - c.at(-1).rpm) / 600));
  const i = Math.floor((rpm - c[0].rpm) / 100); return c[i].T + (c[i + 1] ? (c[i + 1].T - c[i].T) * ((rpm - c[i].rpm) / 100) : 0); };

// p: { es, gearbox: {type, ratios}, final, mass, cda, crr, cfg (chassis design), ch (chassis stats), wb mm, track mm, cgH m, hyd, stiff (platform 0..1) }
export function makeCar(p) {
  const cfg = p.cfg, ch = p.ch, F = SUSP_F[cfg.fs], R = SUSP_R[cfg.rs], Dm = DAMPERS[cfg.damp], ty = tyreDims(cfg.tyre), Gb = GEARBOX[p.gearbox.type];
  const m = p.mass, wb = p.wb / 1000, tr = (p.track || 1420) / 1000, a = wb * (1 - ch.wf), b = wb * ch.wf, h = p.cgH ?? 0.58;    // a: CG to front axle, b: CG to rear axle
  const muF = ch.uF / 2, muR = ch.uR / 2, ms = m - ch.uF - ch.uR, kF = cfg.kF * 1000, kR = cfg.kR * 1000;
  const cc = (k, mc) => 2 * cfg.zeta * Math.sqrt(k * mc);                                       // damping for the chosen ratio of critical
  const corners = [[a, tr / 2, kF, muF, F, 'F'], [a, -tr / 2, kF, muF, F, 'F'], [-b, tr / 2, kR, muR, R, 'R'], [-b, -tr / 2, kR, muR, R, 'R']].map(([x, y, k, mu, S, ax], i) => ({
    i, x, y, k, mu, ax, front: ax === 'F', drive: ax === 'R', c: cc(k, ms / 4) * Dm.eff, fric: S.fric * 1000, sTrack: S.sTrack, rc: S.rc,
    st: m * G * (ax === 'F' ? ch.wf : 1 - ch.wf) / 2, zw: 0, vzw: 0, Fz: m * G / 4, fxw: 0, alpha: 0, kap: 0, w: 0, spin: 0, Fx: 0, Fy: 0, slip: 0, tb: 40, camber: 0, defl: 0 }));
  const beamF = !F.ifs, beamR = cfg.rs !== 'swing';
  return { p, cfg, ch, m, ms, wb, tr, a, b, h, Iz: m * (wb * wb + tr * tr) / 12 * 1.15, Ix: ms * (tr * tr + h * h) / 12 * 1.4, Iy: ms * (wb * wb + h * h) / 12 * 1.2, corners, beamF, beamR,
    R0: ty.r, Wt: ty.w * 25.4 / 1000, kt: 180000 * (cfg.psi / 28) ** 0.8, ct: 900, mu0: ch.mu0 / 0.66 * 0.7, relax: 0.55 + (28 - cfg.psi) * 0.01, Iw: 0.8 + ty.rim * 0.03,
    arb: cfg.arb ? kF * (tr * 0.8) ** 2 * 0.45 : 0, Dm, hyd: !!p.hyd, Fb: ch.cap * m * G, bias: cfg.bias, drumKg: ch.drumKg, steerMax: 34 * RAD, sRatio: cfg.sRatio,
    es: p.es, Gb, type: p.gearbox.type, ratios: p.gearbox.ratios, rev: -(p.gearbox.ratios[0] * 1.1), final: p.final, cda: p.cda, crr: p.crr, Ie: 0.08 + p.es.litres * 0.035,
    // state
    u: 0, v: 0, r: 0, z: 0, vz: 0, roll: 0, vroll: 0, pitch: 0, vpitch: 0, we: 700 * Math.PI / 30, gear: 1, shift: null, clutch: 0, tcSlip: 0, grind: 0, fluidT: 0,
    s: 0, n: 0, psi: 0, ax: 0, ay: 0, delta: 0, steerIn: 0, t: 0, odOn: false, stalled: false };
}
// gear 0 = neutral, -1 = reverse, 1.. = forward
export const gearRatio = (C, g) => (g > 0 ? C.ratios[g - 1] * (C.odOn ? 0.75 : 1) : g < 0 ? C.rev : 0);
const AUTO = t => t === 'hydra4' || t === 'tc2';
const FLUID = t => t === 'fluid' || t === 'hydra4' || t === 'tc2';

// driver requests: shift up / down (manual), the gearbox decides whether and when it goes in
export function requestShift(C, dir) { if (C.shift && C.shift.t < C.shift.need) return; const n = C.ratios.length, still = Math.abs(C.u) < 0.8; let tgt = clamp(C.gear + dir, -1, n);
  if (still && dir < 0 && C.gear === 1) tgt = -1; if (dir > 0 && C.gear === -1) tgt = 1; if (C.shift) C.shift = null; if (tgt === C.gear) return;   // standing still: first and reverse sit across the gate from each other
  if (tgt === -1 && Math.abs(C.u) > 0.8) { C.grind = 0.4; return; }                                          // reverse only at a standstill
  C.shift = { from: C.gear, to: tgt, t: 0, need: C.Gb.shift * (C.type === 'crash3' ? 0.7 : 0.6) }; }

function driveSpeed(C) { const [, , rl, rr] = C.corners; return (rl.w + rr.w) / 2; }

// road: (s, n) -> { k, grade, bank, h, mu, rough }
export function stepCar(C, inp, road, dt) {
  const { es } = C, n = Math.max(1, Math.ceil(dt / 0.001)), h = dt / n; for (let q = 0; q < n; q++) sub(C, inp, road, h); }

function sub(C, inp, road, dt) {
  const { corners, m, es } = C, rd = road(C.s, C.n), V = Math.hypot(C.u, C.v), absU = Math.abs(C.u);
  // ---- steering: the box ratio sets how fast the wheels follow; keyboard input is softened with speed ----
  const lock = C.steerMax * clamp(9 / Math.max(9, V), 0.2, 1), target = -inp.steer * lock, rate = (34 * RAD) / (C.sRatio / 18) * 2.2;
  C.delta += clamp(target - C.delta, -rate * dt, rate * dt);
  // ---- powertrain ----
  let thr = clamp(inp.gas, 0, 1); const brk = clamp(inp.brake, 0, 1), we = C.we, rpm = we * 30 / Math.PI;
  if (C.shift && (inp.autoShift || AUTO(C.type)) && C.shift.to > 0) { const tgt = driveSpeed(C) * C.final * gearRatio(C, C.shift.to); thr = tgt > we + 10 ? 1 : 0; }
  const idle = 560 * Math.PI / 30, idleThr = C.stalled ? 0 : clamp((idle - we) / (idle * 0.2), 0, 0.35), th = C.stalled ? 0 : Math.max(thr, idleThr);
  const Teng = torqueAt(es, rpm) * th - (1 - th) * (4 + we * 0.02 + es.litres * (2 + rpm / 1000 * 2.5));   // the curve is net brake torque; shut, friction and pumping drag
  let gr = gearRatio(C, C.gear); const sh = C.shift;
  if (sh) { sh.t += dt; gr = 0;                                                                                 // neutral while the lever moves
    const tgtIn = driveSpeed(C) * C.final * gearRatio(C, sh.to), dW = Math.abs(we - tgtIn), sync = C.type !== 'crash3' && !(sh.to === 1 && absU > 1);
    const ready = sh.t >= sh.need && (sh.to === 0 || sync ? sh.t >= sh.need + Math.min(0.5, dW * 0.0012) : dW < 340 * Math.PI / 30 || absU < 0.3);
    if (ready) { C.gear = sh.to; C.shift = null; gr = gearRatio(C, C.gear); } else if (!sync && sh.t > sh.need + 0.25 && dW > 340 * Math.PI / 30) C.grind = Math.min(1, C.grind + dt * 3); }
  C.grind = Math.max(0, C.grind - dt * 1.5);
  const wDrive = driveSpeed(C), wIn = wDrive * C.final * gr; let Tc = 0;                                      // gearbox input shaft speed from the wheels
  if (gr !== 0) {
    if (C.type === 'tc2') { const sr = clamp(wIn / Math.max(1, we), -1, 1), Kp = 0.0062 * (es.torque / 200), Tp = Kp * we * we * (1 - Math.max(0, sr) ** 3); Tc = Tp; C.tcMul = sr < 0.85 ? 2.3 - 1.53 * Math.max(0, sr) : 1; C.tcSlip = 1 - sr; }
    else if (FLUID(C.type)) { const d = we - wIn, K = 0.0058 * (es.torque / 200); Tc = K * d * Math.abs(d); C.tcMul = 1; C.tcSlip = d / Math.max(1, we); }
    else { // dry clutch: the auto-clutch lets it in as the revs rise from rest and lets it out before the engine stalls
      const want = Math.min(absU > 4 ? 1 : clamp((rpm - 900) / 1500, 0, 1), clamp((rpm - 430) / 250, 0, 1)); C.clutch += clamp(want - C.clutch, -dt * 14, dt * 1.6); const eng = C.clutch, cap = es.torque * 1.6 * eng;
      // viscous link solved implicitly against the engine and the driven wheels, so a near-locked clutch stays stable
      const Gr = gr * C.final, Iwd = 2 * C.Iw, Toth = (corners[2].fxw + corners[3].fxw) * C.R0, cv = 3000 * eng;
      Tc = clamp(cv * ((we - wIn) + dt * (Teng / C.Ie + Gr * Toth / Iwd)) / (1 + cv * dt * (1 / C.Ie + Gr * Gr / Iwd)), -cap, cap); C.tcMul = 1; C.tcSlip = (we - wIn) / Math.max(1, we); }
  } else C.tcMul = 1;
  C.we = Math.max(0, we + (Teng - Tc) / C.Ie * dt); if (C.we < 200 * Math.PI / 30) C.stalled = true;
  if (C.stalled && (inp.gas > 0.2 || C.shift) && (gr === 0 || C.clutch < 0.1)) { C.we = 800 * Math.PI / 30; C.stalled = false; }   // the starter: neutral or clutch out
  if (C.stalled) C.we = 0; if (C.we * 30 / Math.PI > es.redline * 1.18) C.we = es.redline * 1.18 * Math.PI / 30;
  const Taxle = Tc * (C.tcMul || 1) * gr * C.final * C.Gb.eff;                                               // to the differential: open, equal torque each side
  // automatic gearboxes choose their own gear; overdrive cuts in above ~30 mph on a lifted throttle
  if (AUTO(C.type) && !C.shift && C.gear > 0) { const mph = C.u * 2.237, n2 = C.ratios.length, up = 14 + C.gear * (n2 === 2 ? 22 : 12) * (0.6 + thr * 0.8), dn = up * 0.55;
    if (C.gear < n2 && mph > up) C.shift = { from: C.gear, to: C.gear + 1, t: 0, need: C.Gb.shift }; else if (C.gear > 1 && mph < dn) C.shift = { from: C.gear, to: C.gear - 1, t: 0, need: C.Gb.shift }; }
  if (C.type === 'od3') { if (!C.odOn && C.gear === C.ratios.length && C.u > 13.4 && thr < 0.2) C.odOn = true; if (C.odOn && (thr > 0.95 || C.u < 11)) C.odOn = false; }
  if (inp.autoShift && !AUTO(C.type) && !C.shift && C.gear > 0) { const r2 = rpm, upAt = es.redline * (C.type === 'crash3' ? 0.78 : 0.93); if (r2 > upAt && C.gear < C.ratios.length && Math.abs(C.corners[2].kap) < 0.3) requestShift(C, 1); else if (r2 < 1150 && C.gear > 1 && absU > 1) requestShift(C, -1); }
  // ---- vertical: road under each tyre, unsprung masses, springs, dampers, leaf friction, stops, anti-roll bar ----
  const cosR = Math.cos(C.roll), sinR = Math.sin(C.roll);
  for (const c of corners) { const sC = C.s + c.x, nC = C.n + c.y; c.road = road(sC, nC).h; }
  const bodyAt = c => C.z + c.y * C.roll - c.x * C.pitch;                                                      // body point above the corner (relative to static ride height)
  for (const c of corners) { const defl = bodyAt(c) - c.zw, vb = C.vz + c.y * C.vroll - c.x * C.vpitch, rel = vb - c.vzw; c.defl = defl;
    const Dk = C.Dm === DAMPERS.friction ? Math.sign(rel) * Math.min(Math.abs(rel) * 8000, 700) : C.Dm === DAMPERS.lever ? Math.sign(rel) * Math.min(Math.abs(rel) * c.c, c.c * 0.35 + Math.abs(rel) * c.c * 0.25) : rel * c.c * (rel > 0 ? 1.3 : 0.7);
    const stop = Math.abs(defl) > 0.075 ? Math.sign(defl) * (Math.abs(defl) - 0.075) ** 2 * 6e6 : 0, fr = Math.sign(rel) * Math.min(c.fric, Math.abs(rel) * 40000);
    c.Fs = -(c.k * defl + Dk + stop + fr); }                                                                    // force on the body (+ up), equal and opposite on the wheel
  if (C.arb) { const [fl, fr] = corners, d = (fl.defl - fr.defl), M = C.arb * d / (C.tr * 0.8) ** 2 * 0.8; fl.Fs -= M; fr.Fs += M; }
  // tyres: vertical spring and damper against the road; geometric load transfer through the roll centres
  const ayG = C.ay; for (const c of corners) { const pen = c.road - c.zw, Ft = C.kt * pen - C.ct * c.vzw;
    const sd = c.y > 0 ? 1 : -1, geo = -sd * (m * ayG * (c.front ? C.b : C.a) / C.wb) * c.rc / C.tr; c.Fz = Math.max(0, Ft + c.st + geo); }
  // unsprung motion: independent corners alone, beam axles as one body (heave + tilt)
  const moveWheel = (c, F) => { c.vzw += F / c.mu * dt; };
  const axle = (L, Rr) => { const Fh = (L.Fz - L.st) - L.Fs + (Rr.Fz - Rr.st) - Rr.Fs, Mt = ((L.Fz - L.st) - L.Fs - ((Rr.Fz - Rr.st) - Rr.Fs)) * C.tr / 2, mA = L.mu + Rr.mu, IA = mA * C.tr * C.tr / 8;
    const vh = (L.vzw + Rr.vzw) / 2 + Fh / mA * dt, vt = (L.vzw - Rr.vzw) / C.tr + Mt / IA * dt; L.vzw = vh + vt * C.tr / 2; Rr.vzw = vh - vt * C.tr / 2; L.camber = Rr.camber = Math.atan2(L.zw - Rr.zw, C.tr); };
  if (C.beamF) axle(corners[0], corners[1]); else for (const c of corners.slice(0, 2)) { moveWheel(c, (c.Fz - c.st) - c.Fs); c.camber = -C.roll * 0.4; }
  if (C.beamR) axle(corners[2], corners[3]); else for (const c of corners.slice(2)) { moveWheel(c, (c.Fz - c.st) - c.Fs); c.camber = (c.y > 0 ? 1 : -1) * (c.zw - C.z) / (C.tr / 2) * 0.9; }   // swing axles splay
  for (const c of corners) c.zw += c.vzw * dt;
  // ---- tyre forces: slip angle (relaxed) and slip ratio, combined on the friction ellipse ----
  let Fx = 0, Fy = 0, Mz = 0; const brakeT = C.Fb * brk * C.R0;
  for (const c of corners) { const d = c.front ? C.delta : 0, vx = C.u - C.r * c.y, vy = C.v + C.r * c.x, cd = Math.cos(d), sd = Math.sin(d);
    const vxw = vx * cd + vy * sd, vyw = -vx * sd + vy * cd, aim = Math.atan2(vyw, Math.abs(vxw) + 0.5); c.alpha += (aim - c.alpha) * clamp((Math.abs(vxw) + 0.5) / C.relax * dt, 0, 1);
    const kap = (c.w * C.R0 - vxw) / Math.max(Math.abs(vxw), 2.5); c.kap += (kap - c.kap) * clamp((Math.abs(vxw) + 1) / (C.relax * 0.6) * dt, 0, 1);
    const sx = c.kap / 0.15, sy = c.alpha / (9 * RAD), sl = Math.hypot(sx, sy), surf = rd.mu ?? 1, load = c.Fz, mu = C.mu0 * surf * (1.12 - 0.22 * load / c.st) * Math.cos(c.camber) ** 4;
    const Ftot = load * mu * slipCurve(Math.max(sl, 1e-6)), fx = sl > 1e-6 ? Ftot * sx / sl : 0, fy = sl > 1e-6 ? -Ftot * sy / sl : 0;
    c.Fx = fx * cd - fy * sd; c.Fy = fx * sd + fy * cd; c.slip = sl; c.fxw = fx;
    // wheel spin: drive torque (rear), brakes (all, by bias), tyre reaction
    const Td = c.drive ? Taxle / 2 : 0, share = (c.front ? C.bias : 1 - C.bias) / 2, fade = c.tb > 260 ? Math.max(0.45, 1 - (c.tb - 260) / 300) : 1, Tb = brakeT * share * 2 * fade / 2, Tbr = (inp.hand && !c.front ? C.Fb * 0.3 * C.R0 / 2 : 0) + Tb;
    let wn = c.w + (Td - fx * C.R0) / C.Iw * dt; const stopW = Tbr / C.Iw * dt; wn = Math.abs(wn) <= stopW ? 0 : wn - Math.sign(wn) * stopW; c.w = wn; c.spin += c.w * dt;
    c.tb += (Tbr * Math.abs(c.w) / (C.drumKg * 460) - (c.tb - 30) * (0.02 + V * 0.0012)) * dt;
    Fx += c.Fx; Fy += c.Fy; Mz += c.x * c.Fy - c.y * c.Fx; }
  // ---- body: planar motion, then heave / roll / pitch from the springs and the load transfer ----
  const drag = 0.6 * C.cda * C.u * Math.abs(C.u), roll0 = C.crr * m * G * Math.sign(C.u) * Math.min(1, absU), grav = m * G * (rd.grade || 0), bank = m * G * Math.sin((rd.bank || 0) * RAD) * Math.sign(rd.k || 0);
  const axB = (Fx - drag - roll0 - grav) / m, ayB = (Fy - bank) / m; C.u += (axB + C.v * C.r) * dt; C.v += (ayB - C.u * C.r) * dt; C.r += Mz / C.Iz * dt;
  if (absU < 0.05 && thr === 0 && Math.abs(Fx) < 50) { C.u *= 0.9; C.v *= 0.9; C.r *= 0.9; }
  C.ax = axB; C.ay = ayB; const ms = C.ms;
  let Fh = 0, Mr = 0, Mp = 0; for (const c of corners) { Fh += c.Fs; Mr += c.Fs * c.y; Mp += -c.Fs * c.x; }
  const hr = C.h - (corners[0].rc + corners[2].rc) / 2;                                                       // CG height above the roll axis
  C.vz += Fh / ms * dt; C.vroll += (Mr + ms * C.ay * hr) / C.Ix * dt; C.vpitch += (Mp - ms * C.ax * C.h) / C.Iy * dt;
  C.vroll *= 1 - 0.4 * dt; C.vpitch *= 1 - 0.4 * dt; C.z += C.vz * dt; C.roll += C.vroll * dt; C.pitch += C.vpitch * dt;
  // ---- position on the track ----
  const k = rd.k || 0, ds = (C.u * Math.cos(C.psi) - C.v * Math.sin(C.psi)) / Math.max(0.2, 1 + C.n * k); C.s += ds * dt; C.n += (C.u * Math.sin(C.psi) + C.v * Math.cos(C.psi)) * dt; C.psi += (C.r + k * ds) * dt; C.t += dt;
}
export const rpmOf = C => C.we * 30 / Math.PI;
