import { describe, it, expect } from 'vitest';
import { Ignition, IGN, SWEEP_T, sweepAt, sweepValue, crankTime, carStartsOff, type IgnitionFeed } from '../race/ignition';
import { Vehicle, STARTER_RPM } from '../race/vehicle';
import { raceSpec } from '../race/cars';
import { Track } from '../race/track';
import { DEFAULTS, asSettings } from '../ui/shell/settings';

const dt = 1 / 200;
const idleFeed = (o: Partial<IgnitionFeed> = {}): IgnitionFeed => ({ rpm: 700, idle: 700, manual: false, engaged: 0, shaftRpm: 0, water: 80, ...o });
/** held for `t` s with the feed, returns the phases seen */
const run = (g: Ignition, t: number, hold: boolean, f: (g: Ignition) => IgnitionFeed = () => idleFeed()) => { const seen = new Set<string>(); for (let k = 0; k < Math.round(t / dt); k++) { g.step(dt, hold, f(g)); seen.add(g.phase); } return seen; };
const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 8000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 8000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 });

describe('the ignition (docs/systems/110 G1)', () => {
  it('goes off, power, cranking, firing, idle, running while the start is held', () => {
    const g = new Ignition('off'); expect(g.fuelled).toBe(false); expect(g.ignition).toBe(false);
    const seen = run(g, 4, true, x => idleFeed({ rpm: x.starter ? STARTER_RPM : 700 }));
    expect([...seen]).toEqual(['power', 'cranking', 'firing', 'idle', 'running']); expect(g.fuelled).toBe(true);
    expect(g.take()).toEqual(['power', 'crank', 'catch', 'settled']);
  });
  it('waits for the power hold before cranking from off, then cranks at once from the ignition on', () => {
    const g = new Ignition('off'); run(g, IGN.powerHold * 0.8, true); expect(g.phase).toBe('power');
    run(g, 0.1, false); expect(g.phase).toBe('power'); run(g, dt, true); expect(g.phase).toBe('cranking');
  });
  it('stops the starter when let go while cranking, the ignition staying on', () => {
    const g = new Ignition('off'); run(g, 0.5, true, () => idleFeed({ rpm: STARTER_RPM })); expect(g.phase).toBe('cranking'); run(g, dt, false); expect(g.phase).toBe('power'); expect(g.ignition).toBe(true);
  });
  it('does not catch until the starter has turned it', () => {
    const g = new Ignition('off'); run(g, 3, true, () => idleFeed({ rpm: 0 })); expect(g.phase).toBe('cranking');
  });
  it('cranks 0.6 s warm, longer cold, never past 1.5 s', () => {
    expect(crankTime(90)).toBeCloseTo(0.6, 5); expect(crankTime(20)).toBeGreaterThan(1.0); expect(crankTime(-30, 1)).toBeLessThanOrEqual(1.5); expect(crankTime(90, 0)).toBeGreaterThanOrEqual(0.6);
    for (const w of [-20, 0, 20, 50, 90]) for (const j of [0, 0.5, 1]) { const c = crankTime(w, j); expect(c).toBeGreaterThanOrEqual(0.6); expect(c).toBeLessThanOrEqual(1.5); }
    const time = (water: number) => { const g = new Ignition('off'); let t = 0; run(g, IGN.powerHold + dt, true, () => idleFeed({ water })); while (g.phase === 'cranking' && t < 3) { g.step(dt, true, idleFeed({ rpm: STARTER_RPM, water })); t += dt; } return t; };
    expect(time(90)).toBeCloseTo(0.6, 1); expect(time(0)).toBeGreaterThan(time(90) + 0.5);
  });
  it('sweeps the needles to full and back within the sweep time, from the ignition coming on', () => {
    expect(sweepAt(0)).toBe(0); expect(sweepAt(IGN.sweepUp + IGN.sweepHold / 2)).toBe(1); expect(sweepAt(SWEEP_T)).toBe(0); expect(sweepAt(IGN.sweepUp / 2)).toBeCloseTo(0.5, 5);
    let prev = 0; for (let t = 0; t < IGN.sweepUp; t += 0.01) { const s = sweepAt(t); expect(s).toBeGreaterThanOrEqual(prev); prev = s; }
    const g = new Ignition('off'); let peak = 0, lampsAll = true; for (let t = 0; t < SWEEP_T; t += dt) { g.step(dt, t < 0.2, idleFeed()); peak = Math.max(peak, g.gaugeSweep); lampsAll &&= g.lamps; }
    expect(peak).toBe(1); expect(lampsAll).toBe(true); run(g, 0.1, false); expect(g.gaugeSweep).toBe(0);
    expect(sweepValue(1000, 0.5, 0, 8000)).toBe(4000); expect(sweepValue(6000, 0.5, 0, 8000)).toBe(6000);
  });
  it('puts its lamps out once running, and lights none when off', () => {
    const g = new Ignition('off'); expect(g.lamps).toBe(false); run(g, 4, true, x => idleFeed({ rpm: x.starter ? STARTER_RPM : 700 })); expect(g.lamps).toBe(false);
  });
  it('flares the idle aim after the catch and settles it to nothing', () => {
    const g = new Ignition('off'); let top = 0; run(g, 4, true, x => { top = Math.max(top, x.flare); return idleFeed({ rpm: x.starter ? STARTER_RPM : 700 }); }); expect(top).toBeCloseTo(IGN.flareK, 5); expect(g.flare).toBe(0);
  });
  it('switches off on a fresh press while running', () => {
    const g = new Ignition('running'); run(g, 0.1, false); g.step(dt, true, idleFeed()); expect(g.phase).toBe('off'); expect(g.take()).toEqual(['off']);
    const h = new Ignition('running'); h.switchOff(); expect(h.fuelled).toBe(false);
  });
  it('stalls a manual box on a clutch dump at a standstill, not with revs up, not when moving, not when not stallable', () => {
    const dump = (o: Partial<IgnitionFeed>, stallable = true) => { const g = new Ignition('running'); g.stallable = stallable; for (let k = 0; k < 40; k++) g.step(dt, false, idleFeed({ manual: true, clutch: 1, ...o }));
      for (let k = 0; k < 10; k++) g.step(dt, false, idleFeed({ manual: true, clutch: 1 - k / 9, ...o })); return g.phase; };
    expect(dump({})).toBe('stalled'); expect(dump({ rpm: 2500 })).toBe('running'); expect(dump({ shaftRpm: 600 })).toBe('running'); expect(dump({}, false)).toBe('running'); expect(dump({ manual: false })).toBe('running');
    // let in slowly (over a second) it does not stall
    const g = new Ignition('running'); g.stallable = true; for (let k = 0; k < 200; k++) g.step(dt, false, idleFeed({ manual: true, clutch: Math.max(0, 1 - k / 200) })); expect(g.phase).toBe('running');
  });
  it('stalls when the revs are dragged under the threshold with the clutch in, then cranks again from the stall', () => {
    const g = new Ignition('running'); g.stallable = true; run(g, 0.2, false, () => idleFeed({ manual: true, rpm: 380, engaged: 1 })); expect(g.phase).toBe('running');
    run(g, 0.1, false, () => idleFeed({ manual: true, rpm: 380, engaged: 1 })); expect(g.phase).toBe('stalled'); expect(g.lamps).toBe(true); expect(g.ignition).toBe(true);
    run(g, dt, true, () => idleFeed({ rpm: STARTER_RPM })); expect(g.phase).toBe('cranking');
  });
  it('the automatic start runs the whole sequence from one press and never stalls', () => {
    const g = new Ignition('off'); g.auto = true; g.stallable = true; g.step(dt, true, idleFeed()); run(g, 4, false, x => idleFeed({ rpm: x.starter ? STARTER_RPM : 700 })); expect(g.phase).toBe('running');
    run(g, 1, false, () => idleFeed({ manual: true, rpm: 300, engaged: 1 })); expect(g.phase).toBe('running');
  });
});

describe('the ignition in the car (race/vehicle.ts)', () => {
  const spec = raceSpec('dueSSJ35');
  it('makes no drive when off: full throttle and the car stays put, the engine still', () => {
    const car = new Vehicle(spec, flat).place(100, 0, 0); car.engine = new Ignition('off'); car.rpm = 0;
    for (let t = 0; t < 2; t += dt) car.step(dt, { throttle: 1, brake: 0, steer: 0 }); expect(car.speed).toBeLessThan(0.05); expect(car.rpm).toBeLessThan(1);
  });
  it('the starter spins it near its cranking revs, then it catches, flares over idle and settles', () => {
    const car = new Vehicle(spec, flat).place(100, 0, 0); car.engine = new Ignition('off'); car.rpm = 0; let crank = 0, top = 0;
    for (let t = 0; t < 5; t += dt) { car.step(dt, { throttle: 0, brake: 1, steer: 0, start: t < 3 }); if (car.engine.starter) crank = Math.max(crank, car.rpm); if (car.engine.phase === 'idle') top = Math.max(top, car.rpm); }
    expect(crank).toBeGreaterThan(STARTER_RPM * 0.6); expect(crank).toBeLessThan(STARTER_RPM * 1.3); expect(car.engine.phase).toBe('running');
    expect(top).toBeGreaterThan(spec.idle * 1.2); expect(Math.abs(car.rpm / spec.idle - 1)).toBeLessThan(0.15);
  });
  it('a rolling car in gear with the engine off is braked by it (the compression)', () => {
    const coast = (on: boolean) => { const car = new Vehicle(spec, flat).place(100, 0, 15); if (!on) car.engine.switchOff(); for (let t = 0; t < 3; t += dt) car.step(dt, { throttle: 0, brake: 0, steer: 0 }); return car.speed; };
    expect(coast(false)).toBeLessThan(15); expect(coast(false)).toBeGreaterThan(5);
  });
  it('a car made without a word about it runs as before (the AI cars, the old tests)', () => { expect(new Vehicle(spec, flat).engine.phase).toBe('running'); });
});

describe('the ignition settings', () => {
  it('default to the direct start with stalling on, and keep the automatic start when chosen', () => {
    expect(DEFAULTS.controls.ignition).toBe('direct'); expect(DEFAULTS.controls.stall).toBe(true);
    expect(asSettings({ controls: { ignition: 'auto', stall: false } }).controls).toMatchObject({ ignition: 'auto', stall: false }); expect(asSettings({ controls: { ignition: 'x' } }).controls.ignition).toBe('direct');
  });
  it('start the player off only on a practice run in the direct mode', () => {
    expect(carStartsOff('direct', false)).toBe(true); expect(carStartsOff('direct', true)).toBe(false); expect(carStartsOff('auto', false)).toBe(false); expect(carStartsOff('auto', true)).toBe(false);
  });
});
