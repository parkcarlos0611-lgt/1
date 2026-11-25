// The 959 in the game (docs/systems/109 S5): its design on its model-built body (core/design.ts MODEL_BASES,
// render/car/bodies.ts), its physics, its swaps saved with the design, its mesh with the suspension rigged at its hubs
// and the cabin's needles, the drift look as a setting.
import { describe, expect, it } from 'vitest';
import { DESIGN_P959, normalise, isModelBase, PLATE_SYLLABLES, plateOk, BODY_LIMITS, DIMS } from '../core/design';
import { asDesign, fromPreset, designJson, parseDesign } from '../core/designstore';
import { designFigures, designSpec } from '../race/design';
import { kinRig } from '../race/kin';
import { designMesh } from '../render/car/design';
import { wheelsOf } from '../render/car/mesh';
import { PLATE_SYLLABLES as DRAWN } from '../render/car/p959';
import { asSettings } from '../ui/shell/settings';

describe('the 959 in the game (S5)', () => {
  it('drives as the real car: about 450 PS, 1,450 kg with a driver aboard, 41 % on the front, four-wheel drive, sequential turbos', () => {
    const f = designFigures(DESIGN_P959), s = designSpec(DESIGN_P959);
    expect(f.hp).toBeGreaterThan(444 * 0.97); expect(f.hp).toBeLessThan(444 * 1.03);
    expect(f.mass).toBeCloseTo(1450 + 75, -1); expect(f.front).toBeCloseTo(0.41, 2);
    expect(s.tech?.drive).toEqual({ front: 0.3, visc: 140 }); expect(s.tech?.turbo?.full).toBeLessThan(s.hpRpm * 0.45);
    expect(f.topKmh).toBeGreaterThan(300); expect(f.topKmh).toBeLessThan(340);
    expect(f.fit.every(x => x.verdict === 'ok')).toBe(true);
    const R = kinRig(s.kin!, s.cgH, s.wheelbase); expect(R.front.tables?.[0].ok && R.rear.tables?.[0].ok).toBe(true);
  });
  it('keeps its swaps and plate with the design; nothing of its shape stretches', () => {
    expect(PLATE_SYLLABLES).toBe(DRAWN);
    const d = fromPreset('p959'); expect(isModelBase(d.body.base)).toBe(true); expect(plateOk(d.body.model!.plate)).toBe(true);
    d.body.model = { bumperF: 'aero', bumperR: 'clean', lamp: 'square', wheel: 'dish', plate: '12가 3456' }; d.body.wheelbase = 120; d.body.ride = 30;
    const back = parseDesign(designJson(normalise(d)))!; expect(back.body.model).toEqual({ bumperF: 'aero', bumperR: 'clean', lamp: 'square', wheel: 'dish', plate: '12가 3456' });
    for (const k of DIMS) { expect(back.body[k]).toBe(0); expect(BODY_LIMITS('p959')[k]).toEqual([0, 0]); }
    const bad = asDesign({ ...back, body: { ...back.body, model: { lamp: 'neon', plate: '12뷁 34' } } })!; expect(bad.body.model!.lamp).toBe('round'); expect(bad.body.model!.plate).toBe('08루 0959');
    expect(asSettings({ graphics: { look: 'drift' } }).graphics.look).toBe('drift');
  });
  it('is drawn with its wheels on the suspension rig at its hubs, its cabin with the needles rigged, its swaps in place', () => {
    const M = designMesh(DESIGN_P959, 0, 0, 0, 1), W = wheelsOf(M);
    expect(W).toHaveLength(4); expect(M.susp?.corners).toHaveLength(4); expect(M.dials?.dials.length).toBeGreaterThanOrEqual(8); expect(M.n).toBeLessThan(20000);
    for (const w of W) { const k = (w.front ? 0 : 2) + (w.hy > 0 ? 0 : 1), c = M.susp!.corners[k]!.wc; expect(Math.abs(c[0] - w.hx)).toBeLessThan(5); expect(Math.abs(c[1] - w.hy)).toBeLessThan(12); expect(Math.abs(c[2] - w.hz)).toBeLessThan(5); }
    const N = new Set(M.names); for (const n of ['wishboneLower', 'damper', 'brakeDisc', 'seatL', 'dash', 'doorCardL', 'plateText']) expect(N.has(n)).toBe(true);
    expect(N.has('brakeCaliper')).toBe(false);   // the wheel's own brake left out: the suspension brings its disc and caliper
    const sq = designMesh({ ...DESIGN_P959, body: { ...DESIGN_P959.body, model: { ...DESIGN_P959.body.model!, lamp: 'square' } } }, 0, 0, 0, 1);
    expect(sq.n).not.toBe(M.n); expect(new Set(sq.names).has('lampReflector')).toBe(true);
  });
});
