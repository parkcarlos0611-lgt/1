// The design -> physics generator (race/design.ts, docs/systems/98 B2, doc 99 C1): the two cars the kit was made from
// come out as their own specs (within 3 %), four more cars made as designs within 7 % (they did not set the rules), the
// rules run the right way, the class comes out of the figures, and any design inside the limits makes a car the driving
// game can run.
import { describe, it, expect } from 'vitest';
import { raceSpec, type RaceSpec } from '../race/cars';
import { designSpec, designFigures, dragArea, zeroTo100, perfClass, perfLabel } from '../race/design';
import { enginePackage } from '../race/designparts';
import { DESIGN_NSX, DESIGN_F355, DESIGN_DIABLO, DESIGN_EB110, DESIGN_XJ220, DESIGN_MCLAREN_F1, LIMITS, BASES, NOSES, FRONTS, TAILS, WHEELS, GRADES, INTAKES, COMPRESSIONS, SUMPS, BLOCKS,
  STRUCTURES, PANELS, INTERIORS, BODY_LIMITS, DIMS, LAYOUTS, QUALITY_PARTS, normalise, type BodyDims, type Design, type EngineQuality } from '../core/design';
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

describe('the second pass (doc 99 C1): the six cars fixed', () => {
  for (const [id, d] of [['nsx', DESIGN_NSX], ['f355', DESIGN_F355]] as const) it(`${id} within 3 %: mass, power, torque, drag, balance, the simulated top speed and 0-100`, () => {
    const real = raceSpec(id), s = designSpec(d);
    near(s.mass, real.mass, 0.03); near(s.hp, real.hp, 0.03); near(s.torquePeak!, real.torquePeak!, 0.03); near(dragArea(s), dragArea(real), 0.03);
    near(s.frontShare, real.frontShare, 0.03); near(s.cgH, real.cgH, 0.03);
    const a = run(real), b = run(s); near(b.vmax, a.vmax, 0.03); near(b.vmax, real.topKmh, 0.03); near(b.t100, a.t100, 0.03); near(zeroTo100(s), a.t100, 0.1);
  });
  // the check cars: real figures (race/cars.ts NEW.diablo, NEW.eb110, NEW.xj220; the McLaren F1's published ones in
  // core/design.ts), each as a design on the NSX's or the F355's base
  const CHECK: [Design, { hp: number; kerb: number; top: number }][] = [[DESIGN_DIABLO, { hp: 492, kerb: 1576, top: 325 }], [DESIGN_EB110, { hp: 553, kerb: 1620, top: 342 }],
    [DESIGN_XJ220, { hp: 542, kerb: 1470, top: 342 }], [DESIGN_MCLAREN_F1, { hp: 627, kerb: 1140, top: 386 }]];
  for (const [d, real] of CHECK) it(`${d.name} within 7 %: power, mass, top speed`, () => {
    const s = designSpec(d), f = designFigures(d);
    near(s.hp, real.hp, 0.07); near(s.mass, real.kerb + 75, 0.07); near(f.topKmh, real.top, 0.07);
    expect(normalise(d)).toEqual(d);   // inside the limits and what its grade allows
    expect(f.fit.every(r => r.verdict !== 'blocked'), f.fit.filter(r => r.verdict === 'blocked').map(r => r.reason).join('; ')).toBe(true);
    if (d.id !== 'mclarenf1') { const r = raceSpec(d.id); near(s.hp, r.hp, 0.07); near(s.mass, r.mass, 0.07); }
  });
  it('the class from the figures: the NSX mostly sports, the F355 and the Diablo mostly super, the McLaren F1 hyper', () => {
    const top = (d: Design) => { const p = designFigures(d).perf; return (Object.keys(p) as (keyof typeof p)[]).sort((a, b) => p[b] - p[a])[0]; };
    expect(top(DESIGN_NSX)).toBe('sports'); expect(designFigures(DESIGN_NSX).perf.sports).toBeGreaterThan(0.6);
    expect(top(DESIGN_F355)).toBe('super'); expect(top(DESIGN_DIABLO)).toBe('super'); expect(top(DESIGN_MCLAREN_F1)).toBe('hyper'); expect(designFigures(DESIGN_MCLAREN_F1).perf.hyper).toBeGreaterThan(0.9);
    expect(designFigures(DESIGN_NSX).perfLabel).toMatch(/^스포츠 \d+ % · 슈퍼 \d+ %$/); expect(designFigures(DESIGN_NSX).form).toBe('2도어 쿠페');
    expect(perfClass(60, 170).normal).toBeGreaterThan(0.9); expect(perfClass(125, 220).high).toBeGreaterThan(0.7); expect(perfLabel(perfClass(600, 400))).toBe('하이퍼 100 %');
    for (const [h, t] of [[50, 150], [187, 274], [246, 299], [516, 386]]) expect(Object.values(perfClass(h!, t!)).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
  it('cost and reliability (placeholders): the NSX 100 on both; a higher grade and dearer materials cost more and last less', () => {
    const n = designFigures(DESIGN_NSX); expect(n.cost).toBe(100); expect(n.reliability).toBe(100);
    const g4 = designFigures(tweak(DESIGN_NSX, d => { d.engine.grade = 4; })); expect(g4.cost).toBeGreaterThan(n.cost); expect(g4.reliability).toBeLessThan(n.reliability); expect(g4.serviceKm).toBeLessThan(n.serviceKm);
    expect(designFigures(tweak(DESIGN_NSX, d => { d.body.structure = 'cfrp'; })).cost).toBeGreaterThan(n.cost);
    expect(designFigures(DESIGN_MCLAREN_F1).cost).toBeGreaterThan(designFigures(DESIGN_F355).cost);
  });
});

describe('the rules run the right way', () => {
  const base = DESIGN_NSX, S = (f: (d: Design) => void) => designSpec(tweak(base, f));
  it('more cc, more power; a turbo, more torque; aluminium, lighter; a wing, more drag; wider, more drag', () => {
    for (let cc = LIMITS.cc[0]; cc < LIMITS.cc[1]; cc += 250) for (const layout of ['V6', 'V8', 'V12'] as const) for (const redline of [6000, 9000])
      expect(designSpec(tweak(base, d => { Object.assign(d.engine, { cc: cc + 250, layout, redline }); })).hp).toBeGreaterThan(designSpec(tweak(base, d => { Object.assign(d.engine, { cc, layout, redline }); })).hp);
    expect(S(d => { d.engine.turbo = 1; }).torquePeak!).toBeGreaterThan(S(() => {}).torquePeak!); expect(S(d => { d.engine.turbo = 2; }).hp).toBeGreaterThan(S(d => { d.engine.turbo = 1; }).hp);
    expect(S(d => { d.engine.vtec = false; d.engine.turbo = 1; }).torquePeak!).toBeGreaterThan(S(d => { d.engine.vtec = false; }).torquePeak!);
    expect(S(d => { d.body.structure = 'aluminium'; }).mass).toBeLessThan(S(d => { d.body.structure = 'steel'; }).mass);
    expect(dragArea(S(d => { d.kit.wing = true; }))).toBeGreaterThan(dragArea(S(() => {}))); expect(dragArea(S(d => { d.body.width = 40; }))).toBeGreaterThan(dragArea(S(() => {})));
    expect(S(d => { d.body.wheelbase = 200; }).mass).toBeGreaterThan(S(() => {}).mass); expect(S(d => { d.drive.awd = true; }).frontShare).toBeGreaterThan(S(() => {}).frontShare);
    expect(S(d => { d.engine.layout = 'V12'; }).frontShare).toBeLessThan(S(() => {}).frontShare);   /* a heavier engine behind the driver */
    expect(S(d => { d.engine.valves = 5; d.engine.vtec = false; }).hp).toBeGreaterThan(S(d => { d.engine.valves = 2; d.engine.vtec = false; }).hp);
    expect(designFigures(tweak(base, d => { d.engine.cc = 5000; })).zeroTo100).toBeLessThan(designFigures(base).zeroTo100);
  });
  it('the grade: more power, higher in the revs, the torque peak later; the details as they should go', () => {
    const E = (f: (d: Design) => void) => S(d => { d.engine.vtec = false; f(d); });
    for (const g of [1, 2, 3, 4] as const) { const a = E(d => { d.engine.grade = g; }), b = E(d => { d.engine.grade = (g + 1) as 2 | 3 | 4 | 5; });
      expect(b.hp).toBeGreaterThan(a.hp); expect(b.hpRpm).toBeGreaterThanOrEqual(a.hpRpm); expect(b.torqueRpm / b.hpRpm).toBeGreaterThan(a.torqueRpm / a.hpRpm);
      expect(b.torquePeak! / (b.hp / b.hpRpm)).toBeLessThanOrEqual(a.torquePeak! / (a.hp / a.hpRpm) * (1 + 1e-9)); }   // weaker low down for its power
    expect(E(d => { d.engine.compression = 'high'; }).hp).toBeGreaterThan(E(d => { d.engine.compression = 'low'; }).hp);
    expect(E(d => { d.engine.grade = 3; d.engine.intake = 'itb'; }).hp).toBeGreaterThan(E(d => { d.engine.grade = 3; d.engine.intake = 'single'; }).hp);
    expect(E(d => { d.engine.intake = 'variable'; }).torquePeak!).toBeGreaterThan(E(d => { d.engine.intake = 'single'; }).torquePeak!);
    // the boost: more is more, up to the knock limit; past it little more; a high compression knocks sooner; no intercooler, less
    const T = (f: (d: Design) => void) => E(d => { d.engine.turbo = 2; d.engine.grade = 4; f(d); });
    expect(T(d => { d.engine.boost = 1.2; d.engine.compression = 'low'; }).hp).toBeGreaterThan(T(d => { d.engine.boost = 0.6; d.engine.compression = 'low'; }).hp);
    expect(T(d => { d.engine.boost = 1.4; d.engine.compression = 'high'; }).hp).toBeLessThan(T(d => { d.engine.boost = 1.4; d.engine.compression = 'low'; }).hp);
    expect(T(d => { d.engine.intercooler = false; }).hp).toBeLessThan(T(() => {}).hp);
    // two valves make less torque than four (doc 99 1-8 F5)
    expect(E(d => { d.engine.valves = 2; }).torquePeak!).toBeLessThan(E(d => { d.engine.valves = 4; }).torquePeak!);
    expect(E(d => { d.engine.valves = 3; }).torquePeak!).toBeLessThan(E(d => { d.engine.valves = 4; }).torquePeak!);
  });
  it('the centre of gravity, the package, the frontal area, the materials', () => {
    expect(S(d => { d.engine.sump = 'dry'; }).cgH).toBeLessThan(S(() => {}).cgH); expect(S(d => { d.body.panels = 'cfrp'; }).cgH).toBeLessThan(S(() => {}).cgH);
    const P = (f: (d: Design) => void) => enginePackage(tweak(base, f)), p0 = P(() => {});
    expect(P(d => { d.engine.layout = 'V12'; }).length).toBeGreaterThan(P(d => { d.engine.layout = 'V8'; }).length); expect(P(d => { d.engine.layout = 'V8'; }).length).toBeGreaterThan(p0.length);
    expect(P(d => { d.engine.cc = 4000; }).length).toBeGreaterThan(p0.length); expect(P(d => { d.engine.turbo = 2; }).width).toBeGreaterThan(p0.width); expect(P(d => { d.engine.turbo = 4; }).width).toBeGreaterThan(P(d => { d.engine.turbo = 2; }).width);
    expect(P(d => { d.engine.sump = 'dry'; }).height).toBeLessThan(p0.height);
    for (const st of ['hss', 'aluminium', 'honeycomb', 'cfrp'] as const) expect(S(d => { d.body.structure = st; }).mass).toBeLessThan(S(d => { d.body.structure = 'steel'; }).mass);
    expect(S(d => { d.body.panels = 'cfrp'; }).mass).toBeLessThan(S(d => { d.body.panels = 'frp'; }).mass);
    expect(S(d => { d.kit.interior = 'light'; }).mass).toBeLessThan(S(() => {}).mass); expect(S(d => { d.kit.interior = 'luxury'; }).mass).toBeGreaterThan(S(() => {}).mass);
    expect(S(d => { d.engine.block = 'iron'; }).mass).toBeGreaterThan(S(() => {}).mass);
  });
});

describe('any design inside the limits', () => {
  const pick = <T>(r: Rng, a: readonly T[]) => a[Math.floor(r.float() * a.length)]!, span = (r: Rng, [a, b]: readonly [number, number]) => a + (b - a) * r.float();
  const random = (r: Rng, i: number): Design => { const base = pick(r, BASES), lim = BODY_LIMITS(base); return { v: 4, id: 'r' + i, name: 'random ' + i,
    body: { base, nose: pick(r, NOSES), front: pick(r, FRONTS), tail: pick(r, TAILS), wheel: pick(r, WHEELS), ...Object.fromEntries(DIMS.map(k => [k, span(r, lim[k])])) as unknown as BodyDims, paint: '#808080', gloss: 0.5, structure: pick(r, STRUCTURES), panels: pick(r, PANELS) },
    engine: { grade: pick(r, GRADES), layout: pick(r, LAYOUTS), cc: span(r, LIMITS.cc), valves: pick(r, [2, 3, 4, 5] as const), redline: span(r, LIMITS.redline), intake: pick(r, INTAKES), compression: pick(r, COMPRESSIONS),
      sump: pick(r, SUMPS), block: pick(r, BLOCKS), turbo: pick(r, [0, 1, 2, 3, 4] as const), boost: span(r, LIMITS.boost), intercooler: r.float() < 0.8, vtec: r.float() < 0.3,
      bs: span(r, LIMITS.bs), quality: Object.fromEntries(QUALITY_PARTS.map(k => [k, Math.round(span(r, LIMITS.quality))])) as EngineQuality },
    drive: { gears: pick(r, [5, 6] as const), gearbox: pick(r, ['manual', 'f1'] as const), final: r.float() < 0.5 ? 0 : span(r, LIMITS.final), lsd: r.float() < 0.5, awd: r.float() < 0.3 },
    kit: { abs: r.float() < 0.5, tcs: r.float() < 0.5, steering: pick(r, ['manual', 'hydraulic', 'electric'] as const), dampers: pick(r, ['fixed', 'adaptive'] as const), wing: r.float() < 0.3, diffuser: r.float() < 0.3,
      tyres: [span(r, LIMITS.tyre), span(r, LIMITS.tyre)], rim: pick(r, [16, 17, 18] as const), interior: pick(r, INTERIORS) } }; };
  it('makes a finite, sensible spec the driving game runs for a few seconds', () => {
    const r = new Rng(98); for (let i = 0; i < 40; i++) { const d = normalise(random(r, i)), s = designSpec(d), f = designFigures(d);
      for (const [k, v] of Object.entries(s)) if (typeof v === 'number') expect(Number.isFinite(v), `${d.id} ${k}`).toBe(true);
      expect(s.mass).toBeGreaterThan(1000); expect(s.mass).toBeLessThan(2300); expect(s.hp).toBeGreaterThan(30); expect(s.hp).toBeLessThan(2000); // no power cap at the design stage (docs/systems/98 section 9)
      expect(s.frontShare).toBeGreaterThan(0.3); expect(s.frontShare).toBeLessThan(0.55); expect(s.torqueRpm).toBeLessThan(s.hpRpm); expect(s.hpRpm).toBeLessThanOrEqual(s.redline);
      expect(s.final).toBeGreaterThanOrEqual(LIMITS.final[0]); expect(s.final).toBeLessThanOrEqual(LIMITS.final[1]);
      for (const v of Object.values(f)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      expect(Object.values(f.perf).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9); expect(f.topKmh, `${d.id} ${d.engine.grade} ${d.engine.cc} ${s.hp}`).toBeGreaterThan(120); expect(f.topKmh).toBeLessThan(450);   // a grade-1 litre engine is an economy car's
      const c = new Vehicle(s, flat).place(100, 0, 0); for (let t = 0; t < 3; t += dt) c.step(dt, go);
      expect(Number.isFinite(c.speed) && Number.isFinite(c.rpm), d.id).toBe(true); expect(c.speed * 3.6, d.id).toBeGreaterThan(15); } // a 1.0 L two-valve engine is slow, not broken
  });
});
