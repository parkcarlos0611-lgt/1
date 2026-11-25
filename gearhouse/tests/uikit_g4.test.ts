// The design system's G4 additions (docs/systems/110 G4): a stat whose lower figure is better, the cartoon graph's axis
// and tag rules, the picking parts' style, and the builder's pictures.
import { describe, it, expect } from 'vitest';
import { statShare, STATS, SLIVER } from '../ui/kit/logic';
import { niceStep, niceAxis, placeTags } from '../ui/kit/chart';
import { PICK_CSS } from '../ui/kit/pick';
import { stepIcon, STEP_SHORT, bumperPic, lampPic, wheelPic } from '../ui/builder_pics';
import { STEPS } from '../ui/builder_steps';
import { INK } from '../ui/kit/tokens';

describe('stats', () => {
  it('a low stat fills more for a lower figure; the others as before', () => {
    const zero = { min: 2, max: 12, low: true };
    expect(statShare(2, zero)).toBe(1); expect(statShare(7, zero)).toBeCloseTo(0.5); expect(statShare(12, zero)).toBe(0); expect(statShare(30, zero)).toBe(0);
    expect(statShare(11.99, zero)).toBe(SLIVER); expect(statShare(NaN, zero)).toBe(0);
    expect(statShare(350, STATS.power)).toBeCloseTo(0.5); expect(statShare(0, STATS.power)).toBe(0); });
});

describe('the cartoon graph', () => {
  it('ticks on 1, 2, 2.5 or 5 times a power of ten, the axis on a whole tick above the peak', () => {
    expect(niceStep(400)).toBe(100); expect(niceStep(520)).toBe(200); expect(niceStep(9)).toBe(2.5); expect(niceStep(0)).toBe(1);
    const a = niceAxis(512); expect(a.max).toBeGreaterThanOrEqual(512 * 1.12); expect(a.max % a.step).toBe(0); expect(a.max / a.step).toBeLessThanOrEqual(5); });
  it('tags that would meet are moved apart, others stay', () => {
    expect(placeTags([{ x: 0, y: 10, w: 50, h: 20, below: 40 }, { x: 100, y: 10, w: 50, h: 20, below: 40 }])).toEqual([10, 10]);
    const [a, b] = placeTags([{ x: 0, y: 10, w: 50, h: 20, below: 40 }, { x: 30, y: 15, w: 50, h: 20, below: 40 }]);
    expect(a).toBe(10); expect(b).toBe(55); });
});

describe('the picking parts and the builder pictures', () => {
  it('cards, the rail, chosen green and locked grey', () => {
    for (const c of ['.gk-cards', '.gk-card', '.gk-railtab', '.gk-sm', '.gk-opt', '.gk-range', '.gk-big']) expect(PICK_CSS).toContain(c);
    expect(PICK_CSS).toMatch(/\.gk-card\[aria-pressed="true"\][^{]*\{--face:var\(--gk-g0\)/); expect(PICK_CSS).toMatch(/\.gk-card:disabled[^{]*\{--face:var\(--gk-grey1\)/); });
  it('every step has an icon and a short name; the parts their pictures', () => {
    for (const [id] of STEPS) { expect(stepIcon(id)).toMatch(/^<svg class="gk-ic"/); expect(STEP_SHORT[id].length).toBeLessThanOrEqual(2); }
    const pics = [...(['std', 'aero', 'clean'] as const).flatMap(k => [bumperPic(k), bumperPic(k, true)]), ...(['round', 'ellipsoid', 'square'] as const).map(lampPic), ...(['hollow5', 'dish', 'hole5'] as const).map(wheelPic)];
    for (const p of pics) { expect(p).toContain(INK); expect(p).not.toMatch(/NaN|undefined/); }
    expect(new Set(pics).size).toBe(pics.length); });
});
