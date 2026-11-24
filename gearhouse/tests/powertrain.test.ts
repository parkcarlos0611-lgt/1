// The powertrain's meshes (docs/systems/101, M1; render/car/powertrain): every layout, turbo count, intake, sump and
// drive builds on both kinds of bay (the NSX's across the car, the F355's along it) with every part there by name and no
// bad number; the engine and its gearbox lie in the base's bay (or the build says it was scaled, where the fit check
// says the engine does not go in as it is); the exhaust ends in the body's own tips; the driveshafts run from the
// differential to the wheels' hubs; nothing hangs under the floor; the triangles stay in budget at each detail.
import { describe, it, expect } from 'vitest';
import { wheelsOf, type Mesh } from '../render/car/mesh';
import { DESIGN_NSX, DESIGN_F355, applyPatch, INTAKES, SUMPS, type Design, type DesignPatch, type Layout, type Turbos } from '../core/design';
import { designKit, designMesh, designPowertrain } from '../render/car/design';
import { assemble } from '../render/car/kit/assemble';
import { kitSite } from '../render/car/kit/parts/engine';
import { powertrainMesh, fromEngineSpec, type PowertrainBuilt, type Site } from '../render/car/powertrain';
import { floorAt } from '../render/car/powertrain/layout';
import { ENGINES } from '../render/car/enginemesh';
import { NSX_KIT } from '../render/car/cars/nsx.kit';
import { F355_KIT } from '../render/car/cars/f355.kit';
import { EB110_KIT } from '../render/car/cars/eb110.kit';
import { fit } from '../race/fit';
import nsxSheet from '../data/cars/spec/nsx.json';
import f355Sheet from '../data/cars/spec/f355.json';

const BASES = { nsx: DESIGN_NSX, f355: DESIGN_F355 } as const, SHEET = { nsx: nsxSheet, f355: f355Sheet } as const;
const LAYOUTS: Layout[] = ['V6', 'V8', 'V12'], CC: Record<Layout, number> = { V6: 3000, V8: 3500, V12: 5000 };
const ALWAYS = ['engineBlock', 'cylinderHead', 'camCover', 'sump', 'timingCover', 'pulley', 'belt', 'coilPack', 'exhaustManifold', 'clutchHousing', 'gearbox', 'differential', 'driveshaft', 'cvJoint',
  'exhaustPipe', 'catalyst', 'muffler', 'tailpipe', 'radiator', 'coolantPipe', 'coolantHose', 'fuelTank', 'battery', 'subframe', 'subframeFront', 'engineMount', 'cvBoot'];
const WHEELISH = /^(tyre|tire|rim|wheel|spoke|hub|drum|brake|disc|caliper|axle|nut|spinner|knock)/i;
/** the budgets: the powertrain alone at each detail, the whole car at the builder's */
const BUDGET = { 2: 4900, 1: 2800, 0: 1250 } as const, CAR = 14200;

const build = (d: Design, detail: 0 | 1 | 2 = 2): { M: Mesh; R: PowertrainBuilt; site: Site } => { const { kit, tweak } = designKit(d), site = kitSite(kit, tweak), r = powertrainMesh(designPowertrain(d), site, { detail }); return { M: r.mesh, R: r.built, site }; };
const finite = (M: Mesh) => { for (let i = 0; i < M.pos.length; i++) if (!Number.isFinite(M.pos[i]!)) return false; return true; };
const noSliver = (M: Mesh) => { const p = M.pos; for (let t = 0; t < M.n; t++) { const q = t * 9, ux = p[q + 3]! - p[q]!, uy = p[q + 4]! - p[q + 1]!, uz = p[q + 5]! - p[q + 2]!, vx = p[q + 6]! - p[q]!, vy = p[q + 7]! - p[q + 1]!, vz = p[q + 8]! - p[q + 2]!;
  if (!(Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) > 0.5)) return false; } return true; };

describe('the powertrain builds for every design', () => {
  for (const base of ['nsx', 'f355'] as const) for (const layout of LAYOUTS) it(`${layout} on the ${base}'s bay: turbos 0..4 x intake x sump x drive`, () => {
    let worstOver = 0;
    for (const turbo of [0, 1, 2, 3, 4] as Turbos[]) for (const intake of INTAKES) for (const sump of SUMPS) for (const awd of [false, true]) {
      const p: DesignPatch = { engine: { grade: 4, layout, cc: CC[layout], turbo, intake, sump, compression: turbo ? 'low' : 'high', intercooler: turbo !== 3 }, drive: { awd, gears: awd ? 6 : 5, gearbox: awd ? 'f1' : 'manual', lsd: !awd } };
      const d = applyPatch(BASES[base], p), { M, R, site } = build(d), tag = `${base} ${layout} t${turbo} ${intake} ${sump} awd${awd}`, has = (n: string) => R.parts.has(n);
      expect(d.engine.turbo, tag).toBe(turbo); expect(d.engine.intake).toBe(intake); expect(d.engine.sump).toBe(sump);
      expect(finite(M), tag).toBe(true); expect(noSliver(M), tag).toBe(true); expect(R.tris, tag).toBe(M.n);
      // the parts, by name
      for (const n of ALWAYS) expect(has(n), `${tag}: ${n}`).toBe(true);
      expect(has('turbo'), tag).toBe(turbo > 0); expect(has('boostPipe')).toBe(turbo > 0); expect(has('intercooler')).toBe(turbo > 0 && d.engine.intercooler); expect(has('exhaustDownpipe')).toBe(turbo > 0);
      expect(has('intakeTrumpet'), tag).toBe(intake === 'itb' && turbo === 0); expect(has('intakePlenum')).toBe(!(intake === 'itb' && turbo === 0)); expect(has('intakeActuator')).toBe(intake === 'variable');
      expect(has('throttleBody'), tag).toBe(true);
      expect(has('oilTank'), tag).toBe(sump === 'dry'); expect(has('oilPump')).toBe(sump === 'dry'); expect(has('dipstick')).toBe(sump === 'wet');
      for (const n of ['propShaft', 'centreDiff', 'frontDifferential', 'shiftActuator']) expect(has(n), `${tag}: ${n}`).toBe(awd); expect(has('shiftLinkage')).toBe(!awd);
      for (const n of R.parts.keys()) expect(WHEELISH.test(n), n).toBe(false);
      // the driveshafts: from the differential out to each driven wheel's hub
      expect(R.placed.shafts.length, tag).toBe(awd ? 4 : 2);
      const diff = R.parts.get('differential')!, shaft = R.parts.get('driveshaft')!;
      for (const s of R.placed.shafts) { const w = s.front ? site.wheels.f : site.wheels.r, side = Math.sign(s.to[1]);
        expect(s.to[0]).toBeCloseTo(w.x, 3); expect(s.to[2]).toBeCloseTo(w.z, 3); expect(Math.abs(s.to[1])).toBeGreaterThan(w.y - w.w / 2 - 40); expect(Math.abs(s.to[1])).toBeLessThan(w.y);   // at the wheel's inner face, on its axle
        if (!s.front) for (const k of [0, 2]) { expect(s.from[k]!).toBeGreaterThan(diff.min[k]! - 1); expect(s.from[k]!).toBeLessThan(diff.max[k]! + 1); }
        expect(Math.hypot(s.to[0] - s.from[0], s.to[2] - s.from[2]) / Math.abs(s.to[1] - s.from[1]), `${tag}: a joint's angle`).toBeLessThan(0.45);
        expect(side > 0 ? shaft.max[1] : -shaft.min[1], tag).toBeGreaterThan(w.y - w.w / 2 - 100); }
      // the exhaust: a tail pipe into every one of the body's tips
      const T = site.tips!, tp = R.parts.get('tailpipe')!; expect(R.placed.tails.length, tag).toBe(T.y.length);
      for (const y of T.y) expect(R.placed.tails.some(e => Math.abs(e[1] - y) < 0.01 && Math.abs(e[2] - T.z) < 0.01 && e[0] >= T.x && e[0] <= T.x + 40), tag).toBe(true);
      expect(tp.max[0], tag).toBeGreaterThan(T.x); expect(tp.max[0]).toBeLessThan(T.x + 60); expect(tp.max[1]).toBeLessThan(Math.max(...T.y) + T.r + 1); expect(tp.min[1]).toBeGreaterThan(Math.min(...T.y) - T.r - 1);
      // nothing under the floor, nothing past the car's ends or outside its wheels
      for (const [n, b] of R.parts) { expect(b.min[2], `${tag}: ${n} under the floor`).toBeGreaterThan(site.foot - 2); expect(b.min[0], `${tag}: ${n}`).toBeGreaterThan(60); expect(b.max[0], `${tag}: ${n}`).toBeLessThan(site.length);
        expect(Math.max(-b.min[1], b.max[1]), `${tag}: ${n}`).toBeLessThan(site.wheels.r.y + 5); }
      for (const n of ['muffler', 'catalyst', 'gearbox', 'subframe']) { const b = R.parts.get(n)!; expect(b.min[2], `${tag}: ${n} over the tail's floor`).toBeGreaterThan(floorAt(site, b.max[0]) - 30); }
      // the bay: where the fit check passes the engine as it is, the engine and its gearbox lie in the sheet's box
      const bays = fit(d).filter(c => c.part.startsWith('bay') || c.part === 'gearboxPlace'), ok = bays.every(c => c.verdict === 'ok'), bx = SHEET[base].engineBay.box, wb = d.body.wheelbase, wd = d.body.width;
      const over = Math.max(bx.x[0]! - R.core.min[0], R.core.max[0] - (bx.x[1]! + wb), bx.y[0]! - wd - R.core.min[1], R.core.max[1] - (bx.y[1]! + wd), bx.z[0]! - R.core.min[2], R.core.max[2] - bx.z[1]!);
      if (ok) worstOver = Math.max(worstOver, over); else expect(R.scale <= 1, tag).toBe(true);
      expect(R.scale, tag).toBeGreaterThan(0.55); expect(R.tris, tag).toBeLessThanOrEqual(BUDGET[2]);
    }
    expect(worstOver, 'outside the bay box').toBeLessThan(60);
  });
  it('a dry sump sets the crank lower; a longer wheelbase leaves the engine at the rear axle', () => {
    const wet = build(applyPatch(DESIGN_NSX, { engine: { sump: 'wet' } })).R, dry = build(applyPatch(DESIGN_NSX, { engine: { sump: 'dry' } })).R;
    expect(wet.parts.get('camCover')!.max[2] - dry.parts.get('camCover')!.max[2]).toBeGreaterThan(40); expect(Math.abs(wet.parts.get('sump')!.min[2] - dry.parts.get('sump')!.min[2])).toBeLessThan(2);
    const a = build(DESIGN_F355), b = build(applyPatch(DESIGN_F355, { body: { wheelbase: 200 } }));
    expect(b.R.parts.get('differential')!.min[0] - a.R.parts.get('differential')!.min[0]).toBeCloseTo(200, 0); expect(b.R.parts.get('radiator')!.min[0]).toBeCloseTo(a.R.parts.get('radiator')!.min[0], 0);
    expect(b.R.parts.get('coolantPipe')!.max[0] - b.R.parts.get('coolantPipe')!.min[0]).toBeGreaterThan(a.R.parts.get('coolantPipe')!.max[0] - a.R.parts.get('coolantPipe')!.min[0] + 100);
  });
  it('an engine too long for a gearbox on its end across the car has it behind (the fit check\'s own rule)', () => {
    const d = applyPatch(DESIGN_NSX, { body: { width: 80 }, engine: { grade: 4, layout: 'V12', cc: 6000 } }), miura = fit(d).find(c => c.part === 'gearboxPlace')!.verdict !== 'ok';
    expect(!!designPowertrain(d).gearboxBehind).toBe(miura); const { M, R } = build(d); expect(finite(M)).toBe(true); expect(R.placed.shafts.length).toBe(2);
  });
  it('the other layouts build too: an in-line six, a flat six', () => {
    const site = kitSite(F355_KIT);
    for (const s of [{ layout: 'I', cylinders: 6, litres: 3.0 }, { layout: 'flat', cylinders: 6, litres: 3.6, turbos: 2 }, { layout: 'I', cylinders: 4, litres: 2.0, turbos: 1, intake: 'itb' }] as const) {
      const { mesh, built } = powertrainMesh(fromEngineSpec(s), site); expect(finite(mesh)).toBe(true); expect(built.parts.has('engineBlock')).toBe(true); expect(built.parts.has('tailpipe')).toBe(true); expect(built.tris).toBeLessThanOrEqual(BUDGET[2]); }
  });
});

describe('the powertrain in the cars', () => {
  const pt = (A: ReturnType<typeof assemble>) => { const e = A.panels.indexOf('engine'); let n = 0; for (let t = 0; t < A.mesh.n; t++) if (A.panelOf[t] === e) n++; return n; };
  it('the kit cars carry theirs within the whole car\'s budget, their wheels still four', () => {
    for (const k of [NSX_KIT, F355_KIT, EB110_KIT]) { const A = assemble(k), names = new Set(A.mesh.names);
      expect(A.mesh.n).toBeLessThanOrEqual(CAR); expect(pt(A)).toBeGreaterThan(2500); expect(pt(A)).toBeLessThanOrEqual(BUDGET[2]);
      for (const n of ['engineBlock', 'gearbox', 'driveshaft', 'exhaustPipe', 'muffler', 'radiator', 'subframe']) expect(names.has(n), n).toBe(true);
      expect(wheelsOf(A.mesh).length).toBe(4); }
    expect(new Set(assemble(EB110_KIT).mesh.names).has('propShaft')).toBe(true);   // the EB110 drives all four
  });
  it('the heaviest design (a V12 with four turbos, all-wheel drive) stays in the car\'s budget; a design\'s own machinery keeps the base\'s engine', () => {
    for (const base of [DESIGN_NSX, DESIGN_F355]) { const d = applyPatch(base, { body: { wheelbase: 250 }, engine: { grade: 4, layout: 'V12', cc: 5000, turbo: 4, intake: 'itb' }, drive: { awd: true, gearbox: 'f1' } });
      expect(designMesh(d).n).toBeLessThanOrEqual(CAR); }
    expect(designPowertrain(DESIGN_NSX)).toEqual(fromEngineSpec(ENGINES.nsx!)); expect(designPowertrain(DESIGN_F355)).toEqual(fromEngineSpec(ENGINES.f355!));
    expect(designPowertrain(applyPatch(DESIGN_F355, { engine: { grade: 3 } })).colours.covers).not.toBe(designPowertrain(applyPatch(DESIGN_F355, { engine: { grade: 1, valves: 4, sump: 'wet' } })).colours.covers);
  });
  it('a lighter powertrain at each lower detail (the drive page\'s)', () => {
    for (const base of [DESIGN_NSX, DESIGN_F355]) { const d = applyPatch(base, { engine: { grade: 4, layout: 'V12', cc: 5000, turbo: 4 }, drive: { awd: true } });
      const n = ([2, 1, 0] as const).map(det => { const { M, R } = build(d, det); expect(finite(M)).toBe(true); expect(R.tris).toBeLessThanOrEqual(BUDGET[det]); for (const p of ['engineBlock', 'gearbox', 'driveshaft', 'muffler', 'tailpipe', 'radiator', 'subframe']) expect(R.parts.has(p)).toBe(true); return R.tris; });
      expect(n[1]!).toBeLessThan(n[0]! * 0.62); expect(n[2]!).toBeLessThan(n[1]! * 0.62);
      expect(designMesh(d, 0, 0, 0, 1).n).toBeLessThan(designMesh(d).n - 1500); }
  });
});
