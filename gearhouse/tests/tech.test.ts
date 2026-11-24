// Later technology (review 125), on the Bugatti EB110 GT: four-wheel drive through a viscous centre differential, a
// torque-sensing rear differential, ABS, four turbos, a speed-sensitive wing, and its period figures.
import { describe, it, expect } from 'vitest';
import { raceSpec, torqueAt, EPS_SPEED_SENSITIVE, type RaceSpec } from '../race/cars';
import { Vehicle, TYRES } from '../race/vehicle';
import { Track } from '../race/track';
const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 8000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 8000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 });
/** the engine's revs set to the wheels' (the shaft turning with them, the clutch locked) */
const sync = (c: Vehicle) => { const f = c.spec.tech?.drive?.front ?? 0, wd = f * (c.w[0]! + c.w[1]!) / 2 + (1 - f) * (c.w[2]! + c.w[3]!) / 2; c.rpm = wd * c.spec.gears[c.gear - 1]! * c.spec.final * 30 / Math.PI; };
const G = 9.81, dt = 1 / 200, eb = raceSpec('eb110'), go = { throttle: 1, brake: 0, steer: 0 };
const launch = (s: RaceSpec) => { const c = new Vehicle(s, flat).place(100, 0, 0); let t = 0, spin = 0; for (; t < 10 && c.speed * 3.6 < 100; t += dt) { c.step(dt, go); if (c.speed > 5) spin = Math.max(spin, c.slipX[2]!); }   /* once rolling (from rest any slip reads large) */ return { t, spin }; };
describe('the EB110 GT', () => {
  it('meets its period figures: about 340 km/h, 0-100 km/h near four seconds', () => {
    const c = new Vehicle(eb, flat).place(100, 0, 0); let vmax = 0; for (let t = 0; t < 70; t += dt) { c.step(dt, go); vmax = Math.max(vmax, c.speed * 3.6); }
    expect(vmax).toBeGreaterThan(325); expect(vmax).toBeLessThan(355); const l = launch(eb); expect(l.t).toBeGreaterThan(3.3); expect(l.t).toBeLessThan(4.4);
  });
  it('puts its power down on four wheels where the rears alone spin', () => {
    const awd = launch(eb), rwd = launch({ ...eb, tech: { ...eb.tech!, drive: undefined } });
    expect(awd.spin).toBeLessThan(rwd.spin / 5);   /* a brief slip as the clutch bites after a change, against the rears alone spinning up */ expect(rwd.spin).toBeGreaterThan(0.5); expect(awd.t).toBeLessThan(rwd.t);
  });
  it('the viscous coupling sends torque forward when the rears slip ahead', () => {
    const mk = (visc: number) => { const c = new Vehicle({ ...eb, tech: { ...eb.tech!, drive: { front: 0.27, visc } } }, flat).place(100, 0, 10); c.w[2] = c.w[3] = c.w[2]! * 1.3; sync(c); c.step(1 / 1000, go); return c; };
    const a = mk(60), b = mk(0); expect(a.Tw[0]! - b.Tw[0]!).toBeGreaterThan(100); expect(a.Tw[2]! - b.Tw[2]!).toBeLessThan(-100);   // what it takes from the rear it gives the front
  });
  it('the rear differential sends torque to the slower wheel, up to its bias', () => {
    const c = new Vehicle(eb, flat).place(100, 0, 10); c.w[2] = c.w[2]! * 1.2; sync(c); c.step(1 / 1000, go); expect(c.Tw[3]!).toBeGreaterThan(c.Tw[2]!); expect(c.Tw[3]! / c.Tw[2]!).toBeLessThanOrEqual(2.5 + 1e-6);
  });
  it('stops shorter with ABS, which keeps the wheels turning', () => {
    const stop = (s: RaceSpec) => { const c = new Vehicle(s, flat).place(100, 0, 100 / 3.6); let d = 0, locked = 0; for (let k = 0; k < 4000 && c.speed > 0.3; k++) { c.step(dt, { throttle: 0, brake: 1, steer: 0 }); d += c.speed * dt; if (c.w[0] === 0 && c.speed > 3) locked++; } return { d, locked }; };
    const a = stop(eb), b = stop({ ...eb, tech: { ...eb.tech!, abs: false } }); expect(a.d).toBeLessThan(b.d * 0.95); expect(a.locked).toBeLessThan(b.locked);
  });
  it('the turbos take time to blow (the lag) and fall back when the throttle shuts', () => {
    const c = new Vehicle(eb, flat).place(100, 0, 30); for (let t = 0; t < 1; t += dt) c.step(dt, { throttle: 0.05, brake: 0, steer: 0 }); const b0 = c.boost;
    for (let t = 0; t < 0.15; t += dt) c.step(dt, go); const b1 = c.boost; for (let t = 0; t < 2; t += dt) c.step(dt, go); const b2 = c.boost; for (let t = 0; t < 1.5; t += dt) c.step(dt, { throttle: 0, brake: 0, steer: 0 });
    expect(b0).toBeLessThan(0.15); expect(b1).toBeLessThan(0.6); expect(b2).toBeGreaterThan(0.9); expect(c.boost).toBeLessThan(0.3);
  });
  it('raises its wing at speed and stows it when slow, pressing the rear down', () => {
    const c = new Vehicle(eb, flat).place(100, 0, 150 / 3.6); for (let t = 0; t < 2; t += dt) c.step(dt, { throttle: 0.4, brake: 0, steer: 0 }); expect(c.wing).toBeGreaterThan(0.9); const rear = c.load[2]! + c.load[3]!;
    const d = new Vehicle({ ...eb, tech: { ...eb.tech!, wing: { ...eb.tech!.wing!, clA: 0 } } }, flat).place(100, 0, 150 / 3.6); for (let t = 0; t < 2; t += dt) d.step(dt, { throttle: 0.4, brake: 0, steer: 0 }); expect(rear).toBeGreaterThan(d.load[2]! + d.load[3]!);
    for (let t = 0; t < 8; t += dt) c.step(dt, { throttle: 0, brake: 0.6, steer: 0 }); expect(c.wing).toBeLessThan(0.1);
  });
});
describe('the XJ220', () => {
  const xj = raceSpec('xj220');
  it('meets its figures: about 342 km/h; no ABS (its wheels lock), no power steering, a viscous rear differential', () => {
    const c = new Vehicle(xj, flat).place(100, 0, 0); let vmax = 0; for (let t = 0; t < 80; t += dt) { c.step(dt, go); vmax = Math.max(vmax, c.speed * 3.6); } expect(vmax).toBeGreaterThan(330); expect(vmax).toBeLessThan(355);
    expect(xj.tech!.abs).toBeFalsy(); expect(xj.tech!.power).toBeFalsy();
    const s = new Vehicle(xj, flat).place(100, 0, 100 / 3.6); let locked = 0; for (let k = 0; k < 4000 && s.speed > 0.3; k++) { s.step(dt, { throttle: 0, brake: 1, steer: 0 }); if (s.w[0] === 0 && s.speed > 3) locked++; } expect(locked).toBeGreaterThan(0);
    const v = new Vehicle(xj, flat).place(100, 0, 10); v.w[2] = v.w[2]! * 1.2; sync(v); v.step(1 / 1000, go); expect(v.Tw[3]!).toBeGreaterThan(v.Tw[2]!);
  });
  it('is pressed down by its venturis: some 300 kg at 200 mph, more the lower it rides', () => {
    const c = new Vehicle(xj, flat).place(100, 0, 322 / 3.6); for (let t = 0; t < 1.5; t += dt) c.step(dt, { throttle: 0.9, brake: 0, steer: 0 }); const df = c.load.reduce((a, b) => a + b, 0) / 9.81 - xj.mass;
    expect(df).toBeGreaterThan(220); expect(df).toBeLessThan(420);
  });
});
describe('the Diablo (1990)', () => {
  const db = raceSpec('diablo');
  it('meets its figures: about 325 km/h, rear drive, 0-100 in about 4.5 s; no ABS, no power steering', () => {
    const c = new Vehicle(db, flat).place(100, 0, 0); let vmax = 0, t100 = 0; for (let t = 0; t < 90; t += dt) { c.step(dt, go); vmax = Math.max(vmax, c.speed * 3.6); if (!t100 && c.speed * 3.6 >= 100) t100 = t; }
    expect(vmax).toBeGreaterThan(312); expect(vmax).toBeLessThan(338); expect(t100).toBeGreaterThan(3.6); expect(t100).toBeLessThan(5.8);
    expect(db.tech!.drive).toBeFalsy(); expect(db.tech!.abs).toBeFalsy(); expect(db.tech!.power).toBeFalsy();
  });
});
describe('the NSX (1990): traction control, VTEC, (electric power steering)', () => {
  const nx = raceSpec('nsx'), PS = (rpm: number, cam?: 'low' | 'high') => torqueAt(nx, rpm, cam) * rpm * Math.PI / 30 / 735.5;
  it('meets its figures: about 270 km/h, 0-100 km/h near six seconds; ABS and TCS, manual steering on the five-speed', () => {
    const c = new Vehicle(nx, flat).place(100, 0, 0); let vmax = 0, t100 = 0; for (let t = 0; t < 80; t += dt) { c.step(dt, go); vmax = Math.max(vmax, c.speed * 3.6); if (!t100 && c.speed * 3.6 >= 100) t100 = t; }
    expect(vmax).toBeGreaterThan(270 * 0.96); expect(vmax).toBeLessThan(270 * 1.04); expect(t100).toBeGreaterThan(5.3); expect(t100).toBeLessThan(6.5);
    expect(nx.tech!.abs).toBe(true); expect(nx.tech!.tcs).toBeTruthy(); expect(nx.tech!.eps).toBeFalsy(); expect(nx.tech!.power).toBeFalsy(); expect(nx.tech!.drive).toBeFalsy();
  });
  it('its VTEC curve: 274 PS at 7,100 and 284 Nm at 5,300 overall, the low cam stronger low down, the high cam above the switch', () => {
    let pk = 0, pr = 0, tk = 0, tr = 0; for (let r = 800; r <= 8000; r += 10) { const T = torqueAt(nx, r), P = PS(r); if (P > pk) { pk = P; pr = r; } if (T > tk) { tk = T; tr = r; } }
    expect(pk).toBeCloseTo(274, 0); expect(Math.abs(pr - 7100)).toBeLessThanOrEqual(20); expect(tk).toBeCloseTo(284, 0); expect(Math.abs(tr - 5300)).toBeLessThanOrEqual(20);
    expect(torqueAt(nx, 3500, 'low') - torqueAt(nx, 3500, 'high')).toBeGreaterThan(40); expect(torqueAt(nx, 7000, 'high') - torqueAt(nx, 7000, 'low')).toBeGreaterThan(40);
    expect(torqueAt(nx, 5700)).toBe(torqueAt(nx, 5700, 'low')); expect(torqueAt(nx, 5900)).toBe(torqueAt(nx, 5900, 'high'));
    // the switch: the slope turns from the low cam's fall to the high cam's rise
    const slope = (a: number, b: number) => (torqueAt(nx, b) - torqueAt(nx, a)) / (b - a); expect(slope(5600, 5790)).toBeLessThan(0); expect(slope(5810, 6000)).toBeGreaterThan(0);
    // the car's own cams change over at the switch revs going up, and a little below them coming back down
    const c = new Vehicle(nx, flat).place(100, 0, 50 / 3.6); c.auto = false; c.gear = 2; sync(c); let up = 0; for (let t = 0; t < 6 && !up; t += dt) { c.step(dt, { ...go, gear: 2 }); if (c.vtecHigh) up = c.rpm; }
    expect(up).toBeGreaterThan(5800); expect(up).toBeLessThan(5900); let down = 0; for (let t = 0; t < 8 && !down; t += dt) { c.step(dt, { throttle: 0, brake: 0.3, steer: 0, gear: 2 }); if (!c.vtecHigh) down = c.rpm; }
    expect(down).toBeLessThan(5600 + 1); expect(down).toBeGreaterThan(5500);
  });
  it('its traction control cuts the rears\' spin on a full-throttle standing start, and can be switched off', () => {
    // on a damp road (the tyres at 0.8 of their dry grip), where the rears spin up from the start and in the low gears;
    // on a dry one the NSX hardly spins (its first gear is torque-bound), and the system costs little
    const run = (tcs: boolean, mu: number) => { const c = new Vehicle(nx, flat, { ...TYRES.radial, mu }).place(100, 0, 0); c.tcsEnabled = tcs; let s = 0, on = false, t100 = 0;
      for (let t = 0; t < 10; t += dt) { c.step(dt, go); if (c.speed > 3 && Math.max(c.slipX[2]!, c.slipX[3]!) > 0.15) s += dt; on ||= c.tcsOn; if (!t100 && c.speed * 3.6 >= 100) t100 = t; } return { s, on, t100 }; };
    const a = run(true, 0.8 * TYRES.radial.mu), b = run(false, 0.8 * TYRES.radial.mu); expect(b.s).toBeGreaterThan(2); expect(a.s).toBeLessThan(b.s / 3); expect(a.on).toBe(true); expect(b.on).toBe(false); expect(a.t100).toBeLessThan(b.t100);
    const dry = run(true, TYRES.radial.mu), dryOff = run(false, TYRES.radial.mu); expect(dry.t100 - dryOff.t100).toBeLessThan(0.3);
  });
  it('an electric power steering (as on the automatic): lightest parking, its assistance falling away with speed', () => {
    const eps = { ...nx, tech: { ...nx.tech!, eps: EPS_SPEED_SENSITIVE } }, at = (s: RaceSpec, kmh: number) => { const c = new Vehicle(s, flat).place(100, 0, kmh / 3.6); c.step(dt, { throttle: 0.1, brake: 0, steer: 0.5 }); return c; };
    const park = at(eps, 3), fast = at(eps, 100); expect(park.steerAssist).toBeLessThan(0.35); expect(fast.steerAssist).toBeGreaterThan(0.6); expect(park.steerAssist).toBeLessThan(fast.steerAssist);
    expect(at(nx, 3).steerAssist).toBe(1); expect(park.steerEffort).toBeLessThan(at(nx, 3).steerEffort * 0.4);   /* the manual car: no assistance */
    // what the driver's hands manage parking: a full turn of the lock wound on quicker with the assistance
    const wind = (s: RaceSpec) => { const c = new Vehicle(s, flat).place(100, 0, 1); for (let t = 0; t < 0.3; t += dt) c.step(dt, { throttle: 0, brake: 0, steer: 1 }); return Math.abs(c.sw); };
    expect(wind(eps)).toBeGreaterThan(wind(nx) * 1.15);
  });
});
describe('the F355 (1994) and the F355 F1 (1997): the automated manual, variable dampers, the underbody', () => {
  const f = raceSpec('f355'), f1 = raceSpec('f355f1');
  const run = (s: RaceSpec) => { const c = new Vehicle(s, flat).place(100, 0, 0); let vmax = 0, t100 = 0, shifting = 0; for (let t = 0; t < 80; t += dt) { c.step(dt, go); if (c.shifting) shifting += dt; vmax = Math.max(vmax, c.speed * 3.6); if (!t100 && c.speed * 3.6 >= 100) t100 = t; } return { vmax, t100, shifting }; };
  it('meets its figures: about 295 km/h, 0-100 km/h near 4.7 s; ABS, power steering, no traction control; the F1 the same car', () => {
    const a = run(f), b = run(f1); expect(a.vmax).toBeGreaterThan(295 * 0.96); expect(a.vmax).toBeLessThan(295 * 1.04); expect(a.t100).toBeGreaterThan(4.3); expect(a.t100).toBeLessThan(5.3);
    expect(Math.abs(b.vmax - a.vmax)).toBeLessThan(3); expect(b.t100).toBeLessThan(a.t100);   /* shorter shifts: quicker through the gears */
    expect(f.tech!.abs).toBe(true); expect(f.tech!.power).toBe(true); expect(f.tech!.tcs).toBeFalsy(); expect(f.tech!.drive).toBeFalsy();
    expect(f.tech!.gearbox).toBe('manual'); expect(f1.tech!.gearbox).toBe('f1'); expect(f1.body).toBe('f355'); expect(f1.gears).toEqual(f.gears);
    expect(new Vehicle(f, flat).gearboxType).toBe('manual'); expect(new Vehicle(f1, flat).gearboxType).toBe('f1');
    expect(a.shifting / 5).toBeCloseTo(f.shiftT!, 2); expect(b.shifting / 5).toBeCloseTo(f1.shiftT!, 2);   /* five upshifts each */
  });
  it('its curve: 375 hp at 8,250 and 363 Nm at 6,000', () => {
    let pk = 0, pr = 0, tk = 0, tr = 0; for (let r = 1000; r <= 8500; r += 10) { const T = torqueAt(f, r), P = T * r * Math.PI / 30 / 745.7; if (P > pk) { pk = P; pr = r; } if (T > tk) { tk = T; tr = r; } }
    expect(pk).toBeCloseTo(375, 0); expect(Math.abs(pr - 8250)).toBeLessThanOrEqual(40); expect(tk).toBeCloseTo(363, 0); expect(Math.abs(tr - 6000)).toBeLessThanOrEqual(20);
  });
  it('the F1 gearbox shifts quicker, keeps some drive through the shift, and blips the throttle on a downshift to the new gear\'s revs', () => {
    const down = (s: RaceSpec) => { const c = new Vehicle(s, flat).place(100, 0, 90 / 3.6); c.auto = false; c.gear = 3; sync(c); for (let t = 0; t < 0.5; t += dt) c.step(dt, { throttle: 0.1, brake: 0, steer: 0, gear: 3 });
      const r0 = c.rpm; let rmax = 0, blip = 0, dur = 0; for (let t = 0; t < 0.6; t += dt) { c.step(dt, { throttle: 0, brake: 0, steer: 0, gear: 2 }); if (c.shifting) { dur += dt; rmax = Math.max(rmax, c.rpm); blip = Math.max(blip, c.blip); } }
      const target = (c.w[2]! + c.w[3]!) / 2 * s.gears[1]! * s.final * 30 / Math.PI; return { r0, rmax, blip, dur, target, gear: c.gear }; };
    const m = down(f), a = down(f1); expect(m.gear).toBe(2); expect(a.gear).toBe(2); expect(a.dur).toBeLessThan(m.dur * 0.8);
    expect(m.blip).toBe(0); expect(m.rmax).toBeLessThan(m.r0 + 50);   /* the manual: no blip (the driver's heel and toe is not modelled), the revs fall */
    expect(a.blip).toBeGreaterThan(0.5); expect(a.rmax).toBeGreaterThan(a.r0 + 0.7 * (a.target - a.r0)); expect(a.rmax).toBeLessThan(a.target * 1.06);   /* matched, not over-revved */
    // an upshift: the drive at the wheels dips and comes back in the F1's shift, it is wholly cut in the manual's
    const up = (s: RaceSpec) => { const c = new Vehicle(s, flat).place(100, 0, 60 / 3.6); c.auto = false; c.gear = 2; sync(c); let minA = Infinity, sumA = 0, n = 0;
      for (let t = 0; t < 0.5; t += dt) c.step(dt, { ...go, gear: 2 }); for (let t = 0; t < 0.6; t += dt) { c.step(dt, { ...go, gear: 3 }); if (c.shifting) { minA = Math.min(minA, c.tax); sumA += c.tax; n++; } } return { mean: sumA / n, minA }; };
    const um = up(f), ua = up(f1); expect(ua.mean).toBeGreaterThan(um.mean);
  });
  it('the F1 control unit steps one gear a pull, refuses an over-revving downshift, and makes a standing start without stalling at any throttle', () => {
    const c = new Vehicle(f1, flat).place(100, 0, 80 / 3.6); c.auto = false; c.gear = 4; sync(c); c.step(dt, { throttle: 0.2, brake: 0, steer: 0, gear: 1 }); expect(c.gear).toBe(3);
    const h = new Vehicle(f1, flat).place(100, 0, 160 / 3.6); h.auto = false; h.gear = 3; sync(h); for (let t = 0; t < 0.5; t += dt) h.step(dt, { throttle: 0.2, brake: 0, steer: 0, gear: 2 }); expect(h.gear).toBe(3);   /* 2nd at 160 km/h is past the red line */
    // a feathered pedal creeps on a slipping clutch (it lets go near idle rather than stall); more and it closes the slip
    for (const thr of [0.15, 0.3, 0.6, 1]) { const g = new Vehicle(f1, flat).place(100, 0, 0); let minR = Infinity; for (let t = 0; t < 4; t += dt) { g.step(dt, { throttle: thr, brake: 0, steer: 0 }); if (t > 0.2) minR = Math.min(minR, g.rpm); }
      expect(minR).toBeGreaterThan(f1.idle * 0.95); expect(g.speed * 3.6).toBeGreaterThan(5 + 20 * thr); if (thr >= 0.3) expect(g.clutchF1).toBe(1); }
  });
  it('its dampers: sport is firmer than comfort (less pitch and roll overshoot), and comfort firms with speed', () => {
    const dive = (mode: 'comfort' | 'sport', kmh: number) => { const c = new Vehicle(f, flat).place(100, 0, kmh / 3.6); c.damperMode = mode; for (let t = 0; t < 1; t += dt) c.step(dt, { throttle: 0.3, brake: 0, steer: 0 });
      const p0 = c.pitchW; let rate = 0, d = 0; for (let t = 0; t < 1.2; t += dt) { c.step(dt, { throttle: 0, brake: 0.8, steer: 0 }); rate = Math.max(rate, Math.abs(c.om[1]!)); d = Math.min(d, c.pitchW - p0); } return { rate, d: -d, k: c.dampK }; };
    const roll = (mode: 'comfort' | 'sport') => { const c = new Vehicle(f, flat).place(100, 0, 60 / 3.6); c.damperMode = mode; for (let t = 0; t < 1; t += dt) c.step(dt, { throttle: 0.3, brake: 0, steer: 0 });
      let rate = 0; for (let t = 0; t < 1; t += dt) { c.step(dt, { throttle: 0.3, brake: 0, steer: 0.5 }); rate = Math.max(rate, Math.abs(c.om[0]!)); } return rate; };
    const s = dive('sport', 60), cm = dive('comfort', 60), cf = dive('comfort', 200);
    expect(new Vehicle(f, flat).damperMode).toBe('sport'); expect(s.k).toBe(f.tech!.damp!.sport); expect(cm.k).toBeLessThan(0.8); expect(cf.k).toBeGreaterThan(cm.k + 0.15); expect(cf.k).toBeLessThanOrEqual(s.k);
    expect(cm.rate).toBeGreaterThan(s.rate * 1.08); expect(cm.d).toBeGreaterThan(s.d * 1.1); expect(roll('comfort')).toBeGreaterThan(roll('sport') * 1.1);
    expect(new Vehicle(raceSpec('nsx'), flat).place(100, 0, 20).dampK).toBe(1);   /* a car without them: as before */
  });
  it('its flat floor and diffuser press it down some 25-70 kg at 250 km/h, shared about equally by the axles', () => {
    const at = (s: RaceSpec) => { const c = new Vehicle(s, flat).place(100, 0, 250 / 3.6); for (let t = 0; t < 1.5; t += dt) c.step(dt, { throttle: 0.75, brake: 0, steer: 0 }); return c; };
    const c = at(f), n = at({ ...f, tech: { ...f.tech!, underbody: undefined } }), kmh = c.speed * 3.6, k = (250 / kmh) ** 2;
    const df = (c.downF + c.downR) / G * k; expect(df).toBeGreaterThan(25); expect(df).toBeLessThan(70); expect(c.downF / (c.downF + c.downR)).toBeCloseTo(f.tech!.underbody!.front, 1);
    const sum = (v: Vehicle) => v.load.reduce((a, b) => a + b, 0) / G; expect(sum(c) - sum(n)).toBeGreaterThan(df * 0.6 / k);   /* the tyres feel it */
    expect(c.load[0]! + c.load[1]! - n.load[0]! - n.load[1]!).toBeGreaterThan(0); expect(c.load[2]! + c.load[3]! - n.load[2]! - n.load[3]!).toBeGreaterThan(0);
    expect(n.downF + n.downR).toBe(0);
  });
});
