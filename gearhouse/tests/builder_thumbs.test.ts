// The parts library's rendered thumbnails (docs/systems/110 §2-6): the parts taken out of the model, the view rule and
// the framing shared by a kind, the background keyed out.
import { describe, it, expect } from 'vitest';
import { buildModel, isolate, meshBox, union, fit, camera, keyDown, KIND_VIEW, VARIANTS, type ThumbKind } from '../ui/builder_thumbs';
import { DIM } from '../render/car/p959';

const models = [0, 1, 2].map(buildModel);
const names = (k: ThumbKind, i: number) => { const M = isolate(models[i]!, k); return new Set(Array.from(M.part, p => M.names![p]!)); };

describe('the parts alone', () => {
  it('each kind keeps its own triangles, the left front one of a pair, and the variants differ', () => {
    for (const k of ['bumperF', 'bumperR', 'lamp', 'wheel'] as ThumbKind[]) {
      const parts = models.map(m => isolate(m, k)); for (const M of parts) expect(M.n).toBeGreaterThan(20);
      expect(new Set(parts.map(M => `${M.n}|${meshBox(M).flat().map(Math.round).join(',')}|${M.col.reduce((a, c, i) => a + c * (i % 97), 0)}`)).size).toBe(3); }   // the clean bumper: the same shape, the vents in paint
    expect([...names('bumperF', 1)]).toEqual(expect.arrayContaining(['bumperF', 'lipF'])); expect(names('bumperF', 0).has('plate')).toBe(false);
    expect(names('bumperR', 1).has('diffuser')).toBe(true); expect(names('bumperR', 0).has('exhaust')).toBe(false);
    const lamp = meshBox(isolate(models[0]!, 'lamp')); expect(lamp[0][1]).toBeGreaterThan(0); expect(lamp[1][0] - lamp[0][0]).toBeLessThan(300);
    const wheel = meshBox(isolate(models[0]!, 'wheel')); expect(wheel[0][1]).toBeGreaterThan(0); expect(wheel[1][2] - wheel[0][2]).toBeCloseTo(2 * DIM.tyreR, -1); expect(wheel[1][0]).toBeLessThan(DIM.length / 2);
    expect(names('wheel', 0).has('brakeCaliper')).toBe(false);
    expect(isolate(models[0]!, 'base')).toBe(models[0]!.mesh); });
});

describe('the views and the framing', () => {
  it('front for what faces forward or back, side for the wheel and the body', () => {
    expect(KIND_VIEW).toEqual({ bumperF: 'front', bumperR: 'front', lamp: 'front', wheel: 'side', base: 'side' });
    expect(camera('bumperF', 'front').ang).toBeCloseTo(Math.PI); expect(camera('bumperR', 'front').ang).toBeCloseTo(0); expect(camera('wheel', 'top').pitch).toBe(90); });
  it('one box for all the variants of a kind fits the picture, the same scale for each', () => {
    for (const k of ['bumperF', 'bumperR', 'lamp', 'wheel'] as ThumbKind[]) { const box = VARIANTS[k].map((_, i) => meshBox(isolate(models[i]!, k))).reduce(union);
      for (const v of ['front', 'side', 'top'] as const) { const f = fit(box, DIM.length, camera(k, v), 640, 480); expect(f.mm).toBeGreaterThan(0.2); expect(f.mm).toBeLessThan(10);
        const sz = [box[1][0] - box[0][0], box[1][1] - box[0][1], box[1][2] - box[0][2]], w = v === 'side' ? sz[0]! : sz[1]!;   // the width on the screen
        expect(w / f.mm).toBeLessThanOrEqual(640 * 0.86 + 1); } }
    const bumper = VARIANTS.bumperF.map((_, i) => meshBox(isolate(models[i]!, 'bumperF'))).reduce(union), f = fit(bumper, DIM.length, camera('bumperF', 'front'), 640, 480);
    expect(f.x).toBeGreaterThan(1.5); expect(Math.abs(f.y)).toBeLessThan(0.05); });
});

describe('the background keyed out', () => {
  it('the corner colour goes transparent, two by two pixels to one, top row first', () => {
    const W = 4, H = 2, px = new Uint8Array(W * H * 4); for (let q = 0; q < W * H; q++) px.set([90, 110, 70, 255], q * 4);
    px.set([0, 0, 0, 255], (0 * W + 3) * 4);   // the bottom row's last pixel: ink
    const out = keyDown(px, W, H, 2); expect(out.length).toBe(2 * 1 * 4); expect(out[3]).toBe(0); expect(Array.from(out.subarray(4, 8))).toEqual([0, 0, 0, 64]); });
});
