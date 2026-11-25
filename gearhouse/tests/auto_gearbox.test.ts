// The torque-converter automatic (docs/systems/119 K4): the same car with its manual and with the automatic; the
// converter's slip and torque multiplication, the lock-up, the kick-down, no hunting at a steady speed, the creep in D.
import { describe, it, expect } from 'vitest';
import { normalise, DESIGN_BNR33, type Design } from '../core/design';
import { designSpec, designFigures } from '../race/design';
import { Vehicle } from '../race/vehicle';
import { Track } from '../race/track';
import { converter, autoBoxOf, capacity, torqueRatio, scheduled, upRpm, kickdown } from '../race/autobox';
import { inputFromVehicle } from '../render/car/interior/gauges';
import { gearLabelAuto } from '../ui/hud/logic';

const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 8000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 8000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 });
const dt = 1 / 200;
const withBox = (gearbox: Design['drive']['gearbox'], gears: Design['drive']['gears'] = 5) => normalise({ ...DESIGN_BNR33, drive: { ...DESIGN_BNR33.drive, gearbox, gears } });
const MAN = designSpec(withBox('manual')), AUTO = designSpec(withBox('auto'));
function launch(s: typeof MAN, T: number) { const c = new Vehicle(s, flat).place(100, 0, 0); let t100 = 0, top = 0;
  for (let t = 0; t < T; t += dt) { c.step(dt, { throttle: 1, brake: 0, steer: 0 }); top = Math.max(top, c.speed * 3.6); if (!t100 && c.speed * 3.6 >= 100) t100 = t; } return { t100, top }; }

describe('the converter', () => {
  const B = autoBoxOf(AUTO), C0 = capacity(AUTO, B), k = Math.PI / 30;
  it('holds the engine at its stall revs with the turbine stopped, multiplies the torque below the coupling point, none at no slip', () => {
    const st = converter(C0, B, B.stall * k, 0); expect(st.Tt / st.Ti).toBeCloseTo(B.tr0, 5);
    expect(torqueRatio(B, 0.9)).toBe(1); expect(converter(C0, B, 3000 * k, 3000 * k).Ti).toBeCloseTo(0, 6);
    expect(converter(C0, B, 2000 * k, 2500 * k).Ti).toBeLessThan(0);   // overrun: the wheels drag the engine
    expect(B.stall).toBeGreaterThan(1900); expect(B.stall).toBeLessThan(2900);
  });
  it('is only on the automatic: the manual N33 keeps its five-speed, its efficiency and its figures', () => {
    expect(MAN.tech!.gearbox).toBe('manual'); expect(MAN.tech!.auto).toBeUndefined(); expect(AUTO.tech!.auto).toBeDefined();
    expect(designSpec(withBox('manual', 4)).gears.length).toBe(5);   // four speeds only with the automatic
    expect(designSpec(withBox('auto', 4)).gears.length).toBe(4); expect(designSpec(withBox('auto', 6)).gears.length).toBe(6);
    expect(AUTO.eff).toBeLessThan(MAN.eff);
  });
});

describe('the same car, manual against automatic', () => {
  const m = launch(MAN, 45), a = launch(AUTO, 45);
  it('is slower to 100 by a plausible margin (0.2 - 1.0 s) and a little slower at the top', () => {
    expect(a.t100 - m.t100).toBeGreaterThan(0.2); expect(a.t100 - m.t100).toBeLessThan(1.0);
    expect(a.top).toBeLessThan(m.top); expect(m.top - a.top).toBeLessThan(15);
    const F = designFigures(withBox('auto')), G = designFigures(withBox('manual')); expect(F.zeroTo100).toBeGreaterThan(G.zeroTo100);   // the builder's readout agrees
  });
});

describe('the control unit', () => {
  it('starts on the converter (slipping, the revs over the road\'s), locks up once in third over 60 km/h', () => {
    const c = new Vehicle(AUTO, flat).place(100, 0, 0); let slip0 = 1, locked = false, lockedSR = 1;
    for (let t = 0; t < 12; t += dt) { c.step(dt, { throttle: 0.5, brake: 0, steer: 0 }); if (t > 0.3 && t < 0.4) slip0 = Math.min(slip0, c.atSR);
      if (c.atLock > 0.99) { locked = true; lockedSR = Math.min(lockedSR, c.atSR); expect(c.gear).toBeGreaterThanOrEqual(3); expect(c.speed * 3.6).toBeGreaterThan(60); } }
    expect(slip0).toBeLessThan(0.8); expect(locked).toBe(true); expect(lockedSR).toBeGreaterThan(0.985);   // locked: no slip but the clutch model's one-step lag (as the manual's clutch)
  });
  it('holds one gear at a steady 100 km/h (no hunting), locked up', () => {
    const c = new Vehicle(AUTO, flat).place(100, 0, 100 / 3.6); let shifts = 0, last = c.gear, thr = 0.3;
    for (let t = 0; t < 30; t += dt) { thr = Math.max(0, Math.min(1, thr + (100 / 3.6 - c.speed) * 0.02 * dt * 20)); c.step(dt, { throttle: thr, brake: 0, steer: 0 });
      if (t > 5 && c.gear !== last) shifts++; last = c.gear; }
    expect(shifts).toBe(0); expect(Math.abs(c.speed * 3.6 - 100)).toBeLessThan(3); expect(c.atLock).toBeGreaterThan(0.99); expect(c.gear).toBeGreaterThanOrEqual(4);
  });
  it('kicks down when the pedal goes to the floor at a cruise, two gears if they fit, and pulls harder for it', () => {
    const c = new Vehicle(AUTO, flat).place(100, 0, 80 / 3.6);
    for (let t = 0; t < 6; t += dt) c.step(dt, { throttle: 0.22, brake: 0, steer: 0 });
    const g0 = c.gear, v0 = c.speed; for (let t = 0; t < 0.05; t += dt) c.step(dt, { throttle: 1, brake: 0, steer: 0 });
    expect(c.gear).toBeLessThanOrEqual(g0 - 1);
    for (let t = 0; t < 2.5; t += dt) c.step(dt, { throttle: 1, brake: 0, steer: 0 }); expect(c.speed - v0).toBeGreaterThan(4);   // over 14 km/h in two and a half seconds (the shift and the turbos' lag first)
    // the schedule's own rules: up later the more the pedal, the kick-down gear under the full-throttle up point
    expect(upRpm(AUTO, 1)).toBeGreaterThan(upRpm(AUTO, 0.3)); const w = 2000 / AUTO.gears[4]!; expect(kickdown(AUTO, 5, w)).toBeLessThan(5);
    expect(scheduled(AUTO, 3, upRpm(AUTO, 0.3) * 1.01 / AUTO.gears[2]!, 0.3)).toBe(4);
  });
  it('creeps off the brake in D at idle, never stalls, and stands on the brake with the engine running', () => {
    const c = new Vehicle(AUTO, flat).place(100, 0, 0);
    for (let t = 0; t < 2; t += dt) c.step(dt, { throttle: 0, brake: 1, steer: 0 }); expect(c.speed).toBeLessThan(0.05); expect(c.rpm).toBeGreaterThan(AUTO.idle * 0.8);
    for (let t = 0; t < 8; t += dt) c.step(dt, { throttle: 0, brake: 0, steer: 0 });
    expect(c.speed * 3.6).toBeGreaterThan(2); expect(c.speed * 3.6).toBeLessThan(15); expect(c.engine.fuelled).toBe(true);
    for (let t = 0; t < 3; t += dt) c.step(dt, { throttle: 0, brake: 1, steer: 0 }); expect(c.speed).toBeLessThan(0.05); expect(c.engine.fuelled).toBe(true);
  });
  it('shows D and its gear; the driver keeps his hands on the wheel (the selector, no clutch)', () => {
    expect(gearLabelAuto(3, false, true)).toBe('D3'); expect(gearLabelAuto(3, true, true)).toBe('R'); expect(gearLabelAuto(2, false, false)).toBe('M2');
    const c = new Vehicle(AUTO, flat).place(100, 0, 0); expect(c.gearboxType).toBe('auto'); expect(inputFromVehicle(c).selector).toBe(true);
    expect(inputFromVehicle(new Vehicle(MAN, flat).place(100, 0, 0)).selector).toBeUndefined();
  });
  it('stays finite under rough inputs', () => {
    const c = new Vehicle(AUTO, flat).place(100, 0, 0); let k = 7;
    for (let t = 0; t < 20; t += dt) { if (Math.round(t / dt) % 80 === 0) k = (k * 16807) % 2147483647; const r = (k % 1000) / 1000;
      c.step(dt, { throttle: r > 0.3 ? r : 0, brake: r < 0.1 ? 1 : 0, steer: r > 0.6 ? 0.6 : r > 0.4 ? -0.6 : 0 }); expect(Number.isFinite(c.speed) && Number.isFinite(c.rpm)).toBe(true); expect(c.rpm).toBeLessThan(AUTO.redline * 1.15); }
  });
});
