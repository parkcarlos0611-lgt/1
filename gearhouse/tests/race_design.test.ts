// The design -> physics generator (race/design.ts, docs/systems/98 B2): the two cars the kit was made from come out as
// their own specs, the rules run the right way, and any design inside the limits makes a car the driving game can run.
import { describe, it, expect } from 'vitest';
import { raceSpec, type RaceSpec } from '../race/cars';
import { designSpec, designFigures, dragArea } from '../race/design';
import { DESIGN_NSX, DESIGN_F355, LIMITS, BASES, NOSES, FRONTS, TAILS, WHEELS, type Design } from '../core/design';
import { Vehicle } from '../race/vehicle';
import { Track } from '../race/track';
import { Rng } from '../core/rng';
const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 8000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 8000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 });
const dt = 1 / 200, go = { throttle: 1, brake: 0, steer: 0 };
/** full throttle from rest on the flat (as tools/ref/topspeed.ts): the top speed (km/h) and the time to 100 km/h */
const run = (s: RaceSpec, T = 80) => { const c = new Vehicle(s, flat).place(100, 0, 0); let vmax = 0, t100 = 0; for (let t = 0; t < T; t += dt) { c.step(dt, go); vmax = Math.max(vmax, c.speed * 3.6); if (!t100 && c.speed * 3.6 >= 100) t100 = t; } return { vmax, t100 }; };
const near = (a: number, b: number, tol: number) => { expect(a).toBeGreaterThan(b * (1 - tol)); expect(a).toBeLessThan(b * (1 + tol)); };
const tweak = (d: Design, f: (d: Design) => void): Design => { const e = structuredClone(d); f(e); return e; };

describe('the reference designs make the real cars', () => {
  for (const [id, d] of [['nsx', DESIGN_NSX], ['f355', DESIGN_F355]] as const) it(`${id}: mass, power, torque, drag within 5 %, the run within 5 and 10 %`, () => {
    const real = raceSpec(id), s = designSpec(d);
    near(s.mass, real.mass, 0.05); near(s.hp, real.hp, 0.05); near(s.torquePeak!, real.torquePeak!, 0.05); near(dragArea(s), dragArea(real), 0.05);
    near(s.frontShare, real.frontShare, 0.05); near(s.tyreR, real.tyreR, 0.03);
    const a = run(real), b = run(s); near(b.vmax, real.topKmh, 0.05); near(b.vmax, a.vmax, 0.05); near(b.t100, a.t100, 0.1);
    const f = designFigures(d); near(f.topKmh, real.topKmh, 0.05); near(f.zeroTo100, a.t100, 0.1);
    expect(s.id).toBe('design:' + id); expect(s.era).toBe('1990s'); expect(s.check).toBe(false);
  });
  it('carries the chosen technology', () => {
    const n = designSpec(DESIGN_NSX), f = designSpec(DESIGN_F355);
    expect(n.tech!.vtec).toBeTruthy(); expect(n.tech!.tcs).toBeTruthy(); expect(n.tech!.abs).toBe(true); expect(n.tech!.power).toBeFalsy(); expect(n.gears).toHaveLength(5);
    expect(f.tech!.vtec).toBeFalsy(); expect(f.tech!.tcs).toBeFalsy(); expect(f.tech!.power).toBe(true); expect(f.tech!.damp).toBeTruthy(); expect(f.tech!.underbody).toBeTruthy(); expect(f.gears).toHaveLength(6);
    const x = designSpec(tweak(DESIGN_NSX, d => { d.kit.steering = 'electric'; d.drive.awd = true; d.drive.gearbox = 'f1'; d.engine.turbo = 2; d.kit.wing = true; }));
    expect(x.tech!.eps).toBeTruthy(); expect(x.tech!.drive).toBeTruthy(); expect(x.tech!.gearbox).toBe('f1'); expect(x.shiftT).toBeLessThan(n.shiftT!); expect(x.tech!.turbo!.n).toBe(2); expect(x.tech!.wing).toBeTruthy();
    expect(new Vehicle(x, flat).gearboxType).toBe('f1');
  });
  it('a final drive of 0 is chosen for the top speed', () => {
    for (const d of [DESIGN_NSX, DESIGN_F355]) { const s = designSpec(tweak(d, e => { e.drive.final = 0; })), real = designSpec(d);
      expect(Math.abs(s.final - real.final) / real.final).toBeLessThan(0.05); near(run(s).vmax, run(real).vmax, 0.03); }
  });
});

describe('the rules run the right way', () => {
  const base = DESIGN_NSX, S = (f: (d: Design) => void) => designSpec(tweak(base, f));
  it('more cc, more power; a turbo, more torque; aluminium, lighter; a wing, more drag; wider, more drag', () => {
    for (let cc = LIMITS.cc[0]; cc < LIMITS.cc[1]; cc += 250) for (const layout of ['V6', 'V8', 'V12'] as const) for (const redline of [6000, 9000])
      expect(designSpec(tweak(base, d => { Object.assign(d.engine, { cc: cc + 250, layout, redline }); })).hp).toBeGreaterThan(designSpec(tweak(base, d => { Object.assign(d.engine, { cc, layout, redline }); })).hp);
    expect(S(d => { d.engine.turbo = 1; }).torquePeak!).toBeGreaterThan(S(() => {}).torquePeak!); expect(S(d => { d.engine.turbo = 2; }).hp).toBeGreaterThan(S(d => { d.engine.turbo = 1; }).hp);
    expect(S(d => { d.engine.vtec = false; d.engine.turbo = 1; }).torquePeak!).toBeGreaterThan(S(d => { d.engine.vtec = false; }).torquePeak!);
    expect(S(d => { d.body.material = 'aluminium'; }).mass).toBeLessThan(S(d => { d.body.material = 'steel'; }).mass);
    expect(dragArea(S(d => { d.kit.wing = true; }))).toBeGreaterThan(dragArea(S(() => {}))); expect(dragArea(S(d => { d.body.width = 40; }))).toBeGreaterThan(dragArea(S(() => {})));
    expect(S(d => { d.body.wheelbase = 200; }).mass).toBeGreaterThan(S(() => {}).mass); expect(S(d => { d.drive.awd = true; }).frontShare).toBeGreaterThan(S(() => {}).frontShare);
    expect(S(d => { d.engine.layout = 'V12'; }).frontShare).toBeLessThan(S(() => {}).frontShare);   /* a heavier engine behind the driver */
    expect(S(d => { d.engine.valves = 5; d.engine.vtec = false; }).hp).toBeGreaterThan(S(d => { d.engine.valves = 2; d.engine.vtec = false; }).hp);
    expect(designFigures(tweak(base, d => { d.engine.cc = 5000; })).zeroTo100).toBeLessThan(designFigures(base).zeroTo100);
  });
});

describe('any design inside the limits', () => {
  const pick = <T>(r: Rng, a: readonly T[]) => a[Math.floor(r.float() * a.length)]!, span = (r: Rng, [a, b]: readonly [number, number]) => a + (b - a) * r.float();
  const random = (r: Rng, i: number): Design => ({ v: 1, id: 'r' + i, name: 'random ' + i,
    body: { base: pick(r, BASES), nose: pick(r, NOSES), front: pick(r, FRONTS), tail: pick(r, TAILS), wheel: pick(r, WHEELS), wheelbase: span(r, LIMITS.wheelbase), width: span(r, LIMITS.width), paint: '#808080', gloss: 0.5, material: pick(r, ['steel', 'aluminium'] as const) },
    engine: { layout: pick(r, ['V6', 'V8', 'V12'] as const), cc: span(r, LIMITS.cc), valves: pick(r, [2, 3, 4, 5] as const), redline: span(r, LIMITS.redline), turbo: pick(r, [0, 1, 2] as const), vtec: r.float() < 0.3 },
    drive: { gears: pick(r, [5, 6] as const), gearbox: pick(r, ['manual', 'f1'] as const), final: r.float() < 0.5 ? 0 : span(r, LIMITS.final), lsd: r.float() < 0.5, awd: r.float() < 0.3 },
    kit: { abs: r.float() < 0.5, tcs: r.float() < 0.5, steering: pick(r, ['manual', 'hydraulic', 'electric'] as const), dampers: pick(r, ['fixed', 'adaptive'] as const), wing: r.float() < 0.3, diffuser: r.float() < 0.3,
      tyres: [span(r, LIMITS.tyre), span(r, LIMITS.tyre)], rim: pick(r, [16, 17, 18] as const) } });
  it('makes a finite, sensible spec the driving game runs for a few seconds', () => {
    const r = new Rng(98); for (let i = 0; i < 40; i++) { const d = random(r, i), s = designSpec(d), f = designFigures(d);
      for (const [k, v] of Object.entries(s)) if (typeof v === 'number') expect(Number.isFinite(v), `${d.id} ${k}`).toBe(true);
      expect(s.mass).toBeGreaterThan(1000); expect(s.mass).toBeLessThan(2100); expect(s.hp).toBeGreaterThan(100); expect(s.hp).toBeLessThan(1100);
      expect(s.frontShare).toBeGreaterThan(0.3); expect(s.frontShare).toBeLessThan(0.55); expect(s.torqueRpm).toBeLessThan(s.hpRpm); expect(s.hpRpm).toBeLessThanOrEqual(s.redline);
      expect(s.final).toBeGreaterThanOrEqual(LIMITS.final[0]); expect(s.final).toBeLessThanOrEqual(LIMITS.final[1]);
      for (const v of Object.values(f)) expect(Number.isFinite(v)).toBe(true); expect(f.topKmh).toBeGreaterThan(180); expect(f.topKmh).toBeLessThan(450);
      const c = new Vehicle(s, flat).place(100, 0, 0); for (let t = 0; t < 3; t += dt) c.step(dt, go);
      expect(Number.isFinite(c.speed) && Number.isFinite(c.rpm), d.id).toBe(true); expect(c.speed * 3.6, d.id).toBeGreaterThan(30); }
  });
});
