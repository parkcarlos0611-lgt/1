// The fit of a design's parts (race/fit.ts, docs/systems/99 part 2, C2): the kit's own cars and the four check cars
// build; each verdict where it should be (the engine against the bay, the torque against the mounts and the gearbox,
// the tyres under the arches); every fix offered does what it says; a 'modified' part's work goes into the figures.
import { describe, it, expect } from 'vitest';
import { fit, fitVerdict, fitPenalty, BAYS, ARCHES, OWN_TYRES, type FitResult } from '../race/fit';
import { designSpec, designFigures, dragArea } from '../race/design';
import { DESIGN_NSX, DESIGN_F355, DESIGN_DIABLO, DESIGN_EB110, DESIGN_XJ220, DESIGN_MCLAREN_F1, applyPatch, normalise, BASES, type Design } from '../core/design';
import { NSX_KIT } from '../render/car/cars/nsx.kit';
import { F355_KIT } from '../render/car/cars/f355.kit';

const tweak = (d: Design, f: (d: Design) => void): Design => { const e = structuredClone(d); f(e); return normalise(e); };
const part = (d: Design, p: FitResult['part']) => fit(d).find(r => r.part === p)!;
const rank = { ok: 0, modified: 1, blocked: 2 } as const;

describe('the fit: the data', () => {
  it('the arches and the own tyres are the kit\'s; the bays are the sheets\' (the NSX\'s across the car, the F355\'s along it)', () => {
    for (const [b, K] of [['nsx', NSX_KIT], ['f355', F355_KIT]] as const) {
      expect(OWN_TYRES[b]).toEqual([K.lines.wheels.f.w, K.lines.wheels.r.w]); expect(ARCHES[b].map(r => r * 1000)).toEqual([K.lines.arches.f.r, K.lines.arches.r.r]); }
    expect(BAYS.nsx.orient).toBe('mid-transverse'); expect(BAYS.f355.orient).toBe('mid-longitudinal');
    expect(BAYS.nsx.length).toBeCloseTo(0.82, 3); expect(BAYS.f355.length).toBeCloseTo(1.15, 3);
  });
});

describe('the fit: the verdicts', () => {
  it('the kit\'s own cars fit as they are, with nothing to add; the check cars build (some parts with work)', () => {
    for (const d of [DESIGN_NSX, DESIGN_F355]) { const r = fit(d); expect(fitVerdict(r)).toBe('ok'); expect(r.every(x => x.fixes.length === 0)).toBe(true); expect(fitPenalty(d)).toEqual({ mass: [], cost: 0, reliability: 0, cdA: 0 }); }
    for (const d of [DESIGN_DIABLO, DESIGN_EB110, DESIGN_XJ220, DESIGN_MCLAREN_F1]) expect(fitVerdict(fit(d)), d.name).not.toBe('blocked');
  });
  it('an engine against the bay: a long V12 along the F355\'s bay is blocked, a little over is modified, the wheelbase that makes it fit is offered', () => {
    const v12 = tweak(DESIGN_F355, d => { d.engine.layout = 'V12'; d.engine.cc = 5700; d.engine.valves = 4; d.drive.gears = 5; });
    const b = part(v12, 'bayLength'); expect(b.verdict).toBe('blocked'); expect(b.reason).toContain('mm 깁니다');
    const wb = b.fixes.find(f => f.patch.body?.wheelbase !== undefined && !f.label.includes('개조'))!; expect(wb.label).toMatch(/^휠베이스 \+\d+ mm$/);
    expect(part(applyPatch(v12, wb.patch), 'bayLength').verdict).toBe('ok');
    const mod = b.fixes.find(f => f.label.includes('개조 장착'))!, m = applyPatch(v12, mod.patch); expect(part(m, 'bayLength').verdict).toBe('modified');
    expect(mod.patch.body!.wheelbase!).toBeLessThan(wb.patch.body!.wheelbase!); expect(part(m, 'bayLength').mass).toBeGreaterThan(0);
    // the same engine across the NSX's bay: its crank fits across, its gearbox cannot sit at its end (the Miura's arrangement)
    const across = tweak(DESIGN_NSX, d => { d.engine.layout = 'V12'; d.engine.cc = 5700; d.engine.vtec = false; });
    expect(part(across, 'gearboxPlace').verdict).toBe('modified'); expect(part(across, 'gearboxPlace').reason).toContain('가로 V12 미드십');
    expect(part(DESIGN_NSX, 'gearboxPlace').verdict).toBe('ok'); expect(part(tweak(DESIGN_NSX, d => { d.engine.layout = 'V8'; d.engine.cc = 3500; }), 'gearboxPlace').verdict).toBe('ok');
    expect(part(DESIGN_F355, 'gearboxPlace')).toBeUndefined();
    // a wide engine (four turbos) across the bay of a narrowed body; a tall one under the lid
    const tall = tweak(DESIGN_NSX, d => { d.engine.layout = 'V12'; d.engine.cc = 8000; d.engine.grade = 3; d.engine.intake = 'itb'; d.engine.vtec = false; });
    expect(rank[part(tall, 'bayHeight').verdict]).toBeGreaterThan(0); expect(part(tall, 'bayHeight').fixes.some(f => f.patch.engine?.sump === 'dry')).toBe(true);
  });
  it('the torque against the mounts and the gearbox: reinforced past the limit, blocked past twice it, the boost that brings it back offered', () => {
    const t = tweak(DESIGN_NSX, d => { d.engine.turbo = 2; d.engine.boost = 1.0; });
    expect(part(t, 'gearbox').verdict).toBe('modified'); expect(part(t, 'gearbox').reason).toContain('강화 변속기');
    const huge = tweak(DESIGN_F355, d => { Object.assign(d.engine, { grade: 4, layout: 'V12', cc: 8000, turbo: 4, boost: 1.5, compression: 'low' }); d.body.wheelbase = 300; });
    const g = part(huge, 'gearbox'); expect(g.verdict).toBe('blocked');
    const less = g.fixes.find(f => f.patch.engine?.boost !== undefined || f.patch.engine?.cc !== undefined)!; expect(less).toBeTruthy(); expect(rank[part(applyPatch(huge, less.patch), 'gearbox').verdict]).toBeLessThanOrEqual(less.label.includes('개조') ? 1 : 0);
    const over = tweak(DESIGN_F355, d => { Object.assign(d.engine, { grade: 4, layout: 'V8', cc: 5000, turbo: 4, boost: 1.5, compression: 'low' }); d.body.wheelbase = 300; }), m = part(over, 'gearbox');
    expect(m.verdict).toBe('blocked'); const lower = m.fixes.find(f => /^부스트 \d\.\d\d bar로 낮춤 \(개조 장착\)$/.test(f.label))!; expect(lower).toBeTruthy();
    expect(part(applyPatch(over, lower.patch), 'gearbox').verdict).toBe('modified');
  });
  it('the tyres under the arches: a little wide is flared, far too wide blocked; the body widened or a narrower tyre fits', () => {
    expect(part(tweak(DESIGN_NSX, d => { d.kit.tyres = [245, 225]; }), 'archF').verdict).toBe('ok');
    const flare = tweak(DESIGN_NSX, d => { d.kit.tyres = [250, 225]; }), f = part(flare, 'archF'); expect(f.verdict).toBe('modified'); expect(f.reason).toContain('오버펜더');
    expect(part(tweak(flare, d => { d.body.width = 5; }), 'archF').verdict).toBe('ok');
    const wide = tweak(DESIGN_NSX, d => { d.kit.tyres = [205, 300]; }), w = part(wide, 'archR'); expect(w.verdict).toBe('blocked');
    expect(w.fixes.map(x => x.label)).toContain('뒤 타이어 265 mm로'); expect(w.fixes.some(x => x.patch.body?.width !== undefined)).toBe(true);
    // the tyre's radius: a wide rear on the F355's 18-inch rims runs out of travel under its arch
    expect(part(tweak(DESIGN_F355, d => { d.kit.tyres = [225, 300]; d.body.width = 40; }), 'archR').reason).toContain('반지름');
  });
});

describe('the fit: the fixes and the figures', () => {
  it('every fix offered brings its part to what it says (ok, or modified where it says 개조 장착)', () => {
    const designs = [DESIGN_DIABLO, DESIGN_EB110, DESIGN_XJ220, DESIGN_MCLAREN_F1,
      tweak(DESIGN_F355, d => { d.engine.layout = 'V12'; d.engine.cc = 6500; }), tweak(DESIGN_NSX, d => { d.kit.tyres = [300, 335]; d.engine.turbo = 2; d.engine.boost = 1; }),
      tweak(DESIGN_NSX, d => { Object.assign(d.engine, { grade: 4, layout: 'V12', cc: 8000, turbo: 4, boost: 1.5, vtec: false }); d.body.width = -40; })];
    let n = 0;
    for (const d of designs) for (const r of fit(d)) { if (r.verdict !== 'ok') expect(r.fixes.length, `${d.name} ${r.part}`).toBeGreaterThan(0);
      for (const f of r.fixes) { const want = f.label.includes('개조 장착') ? 1 : 0, after = applyPatch(d, f.patch), got = part(after, r.part)?.verdict ?? 'ok';
        expect(rank[got], `${d.name} ${r.part}: ${f.label}`).toBeLessThanOrEqual(want); expect(f.cost).toBeGreaterThanOrEqual(0); n++; } }
    expect(n).toBeGreaterThan(15);
  });
  it('a base swap offered for an engine the bay will not take', () => {
    const d = tweak(DESIGN_NSX, e => { e.engine.layout = 'V12'; e.engine.cc = 8000; e.engine.turbo = 4; e.engine.grade = 3; e.engine.vtec = false; e.body.width = -40; });
    expect(fitVerdict(fit(d))).toBe('blocked'); const swap = fit(d).flatMap(r => r.fixes).find(f => f.patch.body?.base === 'f355')!; expect(BASES).toContain('f355');
    expect(swap.label).toMatch(/^옛 바탕 B \(세로 엔진룸\)/); expect(fit(applyPatch(d, swap.patch)).filter(r => r.part.startsWith('bay')).every(r => r.verdict === 'ok')).toBe(true);
  });
  it('a modified part\'s work adds its mass, its cost and its drag to the figures, and takes from the reliability', () => {
    const ok = tweak(DESIGN_NSX, d => { d.kit.tyres = [245, 225]; }), mod = tweak(DESIGN_NSX, d => { d.kit.tyres = [250, 225]; });
    const wheel = 2 * 5 * 16 * 0.0055;   // the wider tyres' own mass (race/design.ts)
    expect(designSpec(mod).mass - designSpec(ok).mass).toBeCloseTo(wheel + 3, 6);
    expect(dragArea(designSpec(mod)) - dragArea(designSpec(ok))).toBeCloseTo(0.004 * designSpec(ok).cdA / designSpec(ok).cdA, 6);
    const a = designFigures(ok), b = designFigures(mod); expect(b.cost).toBeGreaterThan(a.cost);
    const t = tweak(DESIGN_NSX, d => { d.engine.turbo = 2; d.engine.boost = 1.0; }), F = fitPenalty(t);
    expect(F.mass.reduce((s, x) => s + x.m, 0)).toBeGreaterThan(0); expect(designFigures(t).reliability).toBeLessThan(100 - 8 + 1e-9);
  });
});

describe('the EB110 base and the body\'s dimensions (alpha 0.11: K1, E1)', () => {
  it('the EB110 builds on its own base: its quad-turbo V12 in its lengthwise bay, its tyres under its arches', () => {
    expect(fit(DESIGN_EB110).every(r => r.verdict === 'ok'), fit(DESIGN_EB110).filter(r => r.verdict !== 'ok').map(r => r.reason).join('; ')).toBe(true);
    expect(BAYS.eb110.orient).toBe('mid-longitudinal');
  });
  it('the cabin moved forward lengthens the bay behind it: a long V12 that does not fit the F355 fits a cab-forward F355', () => {
    const v12 = tweak(DESIGN_F355, d => { d.engine.layout = 'V12'; d.engine.cc = 6000; }), fwd = tweak(v12, d => { d.body.cabin = 150; });
    expect(rank[part(fwd, 'bayLength').verdict]).toBeLessThan(rank[part(v12, 'bayLength').verdict]);
    const fx = part(v12, 'bayLength').fixes.find(f => f.patch.body?.cabin !== undefined); expect(fx).toBeTruthy();
    expect(rank[part(applyPatch(v12, fx!.patch), 'bayLength').verdict]).toBeLessThan(rank[part(v12, 'bayLength').verdict]);
  });
  it('the ground clearance: a body let down warns of grounding (its fix raises it), every base\'s own clears', () => {
    for (const d of [DESIGN_NSX, DESIGN_F355, DESIGN_EB110]) expect(part(d, 'clearance').verdict).toBe('ok');
    const low = tweak(DESIGN_EB110, d => { d.body.ride = -20; }); expect(part(low, 'clearance').verdict).toBe('modified');
    expect(part(applyPatch(low, part(low, 'clearance').fixes[0]!.patch), 'clearance').verdict).toBe('ok');
    expect(designSpec(low).mass).toBeGreaterThan(designSpec(DESIGN_EB110).mass);
  });
  it('a wider track and a lower body crowd the arches', () => {
    expect(rank[part(tweak(DESIGN_F355, d => { d.body.track = 80; }), 'archR').verdict]).toBeGreaterThan(rank[part(DESIGN_F355, 'archR').verdict]);
    expect(rank[part(tweak(DESIGN_F355, d => { d.body.ride = -30; }), 'archR').verdict]).toBeGreaterThan(rank[part(DESIGN_F355, 'archR').verdict]);
  });
});

describe('the body\'s dimensions in the physics (E1)', () => {
  const S = (f: (d: Design) => void, d0 = DESIGN_NSX) => designSpec(tweak(d0, f)), n = designSpec(DESIGN_NSX);
  it('a lower roof less drag and a lower centre of gravity; a higher ride more of both; a raked screen and a long tail less drag', () => {
    expect(dragArea(S(d => { d.body.roof = -60; }))).toBeLessThan(dragArea(n)); expect(S(d => { d.body.roof = -60; }).cgH).toBeLessThan(n.cgH);
    expect(dragArea(S(d => { d.body.ride = 40; }))).toBeGreaterThan(dragArea(n)); expect(S(d => { d.body.ride = 40; }).cgH).toBeGreaterThan(n.cgH + 0.03);
    expect(dragArea(S(d => { d.body.rake = 6; }))).toBeLessThan(dragArea(n)); expect(dragArea(S(d => { d.body.overhangR = 200; }))).toBeLessThan(dragArea(n));
  });
  it('a bigger body is heavier; the track goes into the physics; the cabin forward moves the weight forward', () => {
    expect(S(d => { d.body.overhangF = 150; d.body.overhangR = 150; }).mass).toBeGreaterThan(n.mass); expect(S(d => { d.body.roof = 60; }).mass).toBeGreaterThan(n.mass);
    expect(S(d => { d.body.track = 60; }).track).toBeCloseTo(n.track + 0.06, 6); expect(S(d => { d.body.cabin = 120; }).frontShare).toBeGreaterThan(n.frontShare);
  });
});
