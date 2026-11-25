// docs/systems/115 P3: the placed parts in the car's figures (race/partsfig.ts). The stock sets land on the old figures,
// a wing adds downforce and drag and takes top speed off, the intakes feed the cooling (none: a warning, a hotter
// engine), and every design that does not read its parts (the older ones, the race's opponents, the stock cars) keeps
// its figures exactly.
import { describe, it, expect } from 'vitest';
import { DESIGN_P959, DESIGN_BNR33, DESIGN_NSX, DESIGN_F355, DESIGN_EB110, LUMP_SWAPS, normalise, type Design } from '../core/design';
import { designSpec, designFigures, dragArea } from '../race/design';
import { partsEffect, readsParts, partLine, wingAero } from '../race/partsfig';
import { oneMakeField } from '../race/onemake';
import { stockP959 } from '../core/bodies';
import { modelSkin } from '../render/car/bodies';
import { stockParts, newPart } from '../render/car/attach/stock';
import { fitPart } from '../render/car/attach';
import type { Placed } from '../core/placed';

const P959 = normalise(structuredClone(DESIGN_P959)), N33 = normalise(structuredClone(DESIGN_BNR33));
/** a design with its body's stock set as placed parts (the builder's "599 순정 세트" / "순정 부착 부품") */
function stockSet(d0: Design): Design { const d = structuredClone(d0); if (d.body.base === 'p959') { d.body.model = { ...d.body.model!, lamp: 'none', smalls: false, openings: false }; d.body.glass = 'stock'; }
  const s = modelSkin({ ...d, body: { ...d.body, parts: undefined } })!; d.body.parts = stockParts(d.body.base as 'p959' | 'bnr33', s.skin); return d; }
const withParts = (d: Design, ps: Placed[]): Design => ({ ...d, body: { ...d.body, parts: ps } });
const S599 = stockSet(P959), SN33 = stockSet(N33);

describe('the designs that do not read their parts keep their figures', () => {
  it('the older designs, the stock cars and the one-make field: no parts read, the same numbers', () => {
    for (const d of [P959, N33, normalise(DESIGN_NSX), normalise(DESIGN_F355), normalise(DESIGN_EB110), stockP959(), ...oneMakeField(7, 12345).map(f => f.design)]) {
      expect(readsParts(d)).toBe(false); expect(partsEffect(d)).toBeNull(); const s = designSpec(d); expect(s.tech?.aero).toBeUndefined();
      expect(designFigures(d).fit.some(x => x.part === 'cooling')).toBe(false); }
    // the two model bodies' figures as they were before P3
    const a = designSpec(P959), b = designSpec(N33);
    expect(a.mass).toBe(1525); expect(a.frontShare).toBeCloseTo(0.41, 6); expect(a.cgH).toBeCloseTo(0.47, 6); expect(a.cdA).toBeCloseTo(0.59, 6); expect(a.topKmh).toBe(326); expect(a.cooling.margin).toBe(1.1);
    expect(b.mass).toBe(1605); expect(b.frontShare).toBeCloseTo(0.59, 6); expect(b.cdA).toBeCloseTo(0.68, 6); expect(b.topKmh).toBe(267); expect(b.cooling.margin).toBe(1.1); });
});

describe('the stock sets land on the old figures', () => {
  it('the 599 and the N33 with their stock sets as placed parts: the same mass, balance, drag, top speed, 0-100 and cooling', () => {
    for (const [d, old] of [[S599, P959], [SN33, N33]] as const) { expect(readsParts(d)).toBe(true); const f = designFigures(d), o = designFigures(old), s = designSpec(d);
      expect(Math.abs(f.mass - o.mass)).toBeLessThan(0.5); expect(f.front).toBeCloseTo(o.front, 3); expect(f.cgH).toBeCloseTo(o.cgH, 3); expect(f.cdA).toBeCloseTo(o.cdA, 3);
      expect(f.topKmh).toBe(o.topKmh); expect(f.zeroTo100).toBe(o.zeroTo100); expect(s.cooling.margin).toBeCloseTo(1.1, 6); expect(f.cooling).toBe(1); expect(f.down200).toBe(0);
      expect(f.fit.find(x => x.part === 'cooling')!.verdict).toBe('ok'); } });
});

describe('a wing', () => {
  const skin = modelSkin(S599)!.skin, w = newPart('p959', skin, 'wingGT', 0, S599.body.parts)!, W = withParts(S599, [...S599.body.parts!, w]);
  it('on the 599: downforce on the rear (a little off the front, it stands behind the axle), more drag, a lower top speed, a few kg', () => {
    const f = designFigures(W), o = designFigures(S599), s = designSpec(W);
    expect(fitPart(skin, w)!.ok).toBe(true);
    expect(f.down200).toBeGreaterThan(40); expect(f.down200).toBeLessThan(110); expect(s.tech!.aero!.clR).toBeGreaterThan(0.3); expect(s.tech!.aero!.clF).toBeLessThan(0);
    expect(f.cdA).toBeGreaterThan(o.cdA + 0.02); expect(f.cdA).toBeLessThan(o.cdA + 0.07); expect(f.topKmh).toBeLessThan(o.topKmh - 3);
    expect(f.mass - o.mass).toBeGreaterThan(4); expect(f.mass - o.mass).toBeLessThan(10); expect(dragArea(s)).toBeCloseTo(s.cdA, 6); });
  it('more angle: more downforce and more drag; a taller stand works in cleaner air; end plates help a little; past the stall only drag', () => {
    const at = (aoa: number, height = 200, id: 'wingGT' | 'wingStay' = 'wingGT') => wingAero(id, { span: 1500, chord: 270, aoa, height });
    expect(at(14).clA).toBeGreaterThan(at(4).clA); expect(at(14).cdA).toBeGreaterThan(at(4).cdA); expect(at(8, 350).clA).toBeGreaterThan(at(8, 80).clA);
    expect(wingAero('wingGT', { span: 1500, chord: 270, aoa: 8, height: 200 }).clA).toBeGreaterThan(wingAero('lip', { span: 1500, chord: 270, aoa: 8, height: 200 }).clA);
    expect(at(25).clA).toBeCloseTo(at(22).clA, 6); expect(at(25).cdA).toBeGreaterThan(at(22).cdA); });
  it('the N33 without its stock wing: lighter, less drag, the rear lifts a little', () => {
    const d = withParts(SN33, SN33.body.parts!.filter(p => p.id !== 'wingStay')), f = designFigures(d), o = designFigures(SN33);
    expect(f.mass).toBeLessThan(o.mass - 5); expect(f.cdA).toBeLessThan(o.cdA - 0.01); expect(f.topKmh).toBeGreaterThanOrEqual(o.topKmh); expect(designSpec(d).tech!.aero!.clR).toBeLessThan(0); });
  it('the place bar\'s line: its mass, its downforce at 200 km/h, its drag against the car\'s', () => {
    const l = partLine(fitPart(skin, w)!.fig, 0.6); expect(l).toMatch(/^\+7 kg · 다운포스 \+\d+ kg @200 km\/h · 항력 \+\d+ %$/); });
});

describe('the cooling', () => {
  const isIntake = (p: Placed) => /intake|Intake|louvreCut|grille|ventCut/.test(p.id);
  it('no intakes, grilles or vents: no cooling, a warning, a hotter engine in the drive; the bare lump too', () => {
    const blank = withParts(S599, S599.body.parts!.filter(p => !isIntake(p))), lump: Design = { ...P959, body: { ...P959.body, model: LUMP_SWAPS('08루 0599') } };
    for (const d of [blank, lump, withParts(SN33, SN33.body.parts!.filter(p => !isIntake(p)))]) { const f = designFigures(d), c = f.fit.find(x => x.part === 'cooling')!;
      expect(f.cooling).toBe(0); expect(c.verdict).toBe('modified'); expect(c.reason).toMatch(/흡기구/); expect(designSpec(d).cooling.margin).toBeLessThan(0.8); } });
  it('a bigger intake opens more; a bigger engine needs more', () => {
    const big = withParts(S599, S599.body.parts!.map(p => p.id === 'sideIntake' ? { ...p, scale: 1.5 } : p)), f = designFigures(big);
    expect(f.cooling).toBeGreaterThan(1.02); expect(designSpec(big).cooling.margin).toBeGreaterThan(1.1);
    const strong = structuredClone(S599); strong.engine.boost = 1.6; strong.engine.cc = 3400; strong.tier = undefined;
    expect(designFigures(strong).hp).toBeGreaterThan(designFigures(S599).hp * 1.2); expect(designFigures(strong).cooling).toBeLessThan(0.85); });
});
