// The parts library's rendered thumbnails (docs/systems/110 §2-6): the parts taken out of the model, the view rule and
// the framing shared by a kind, the background keyed out.
import { describe, it, expect } from 'vitest';
import { buildModel, buildSet, partAlone, PART_THUMB, isolate, meshBox, union, fit, camera, keyDown, INK_RGB, KIND_VIEW, VARIANTS, type ThumbKind } from '../ui/builder_thumbs';
import { DIM } from '../render/car/p959';
import { KINDS } from '../render/car/mesh';

const models = [0, 1, 2, 3].map(buildModel);   // the fourth: the lump's blank bumpers and steel wheel (with the stock lamp)
const names = (k: ThumbKind, i: number) => { const M = isolate(models[i]!, k); return new Set(Array.from(M.part, p => M.names![p]!)); };

describe('the parts alone', () => {
  it('each kind keeps its own triangles, the left front one of a pair, and the variants differ', () => {
    for (const k of ['bumperF', 'bumperR', 'lamp', 'wheel'] as ThumbKind[]) {
      const parts = models.map(m => isolate(m, k)); for (const M of parts) expect(M.n).toBeGreaterThan(20);
      expect(parts.slice(0, 3).length).toBe(3); expect(new Set(parts.slice(0, 3).map(M => `${M.n}|${meshBox(M).flat().map(Math.round).join(',')}|${M.col.reduce((a, c, i) => a + c * (i % 97), 0)}`)).size).toBe(3); }   // the clean bumper: the same shape, the vents in paint
    expect([...names('bumperF', 1)]).toEqual(expect.arrayContaining(['bumperF', 'lipF'])); expect(names('bumperF', 0).has('plate')).toBe(false);
    expect(names('bumperR', 1).has('diffuser')).toBe(true); expect(names('bumperR', 0).has('exhaust')).toBe(false);
    const lamp = meshBox(isolate(models[0]!, 'lamp')); expect(lamp[0][1]).toBeGreaterThan(0); expect(lamp[1][0] - lamp[0][0]).toBeLessThan(300);
    const wheel = meshBox(isolate(models[0]!, 'wheel')); expect(wheel[0][1]).toBeGreaterThan(0); expect(wheel[1][2] - wheel[0][2]).toBeCloseTo(2 * DIM.tyreR, -1); expect(wheel[1][0]).toBeLessThan(DIM.length / 2);
    expect(names('wheel', 0).has('brakeCaliper')).toBe(false);
    expect(isolate(models[0]!, 'base')).toBe(models[0]!.mesh);
    const half = isolate(models[0]!, 'bumperR', true), all = isolate(models[0]!, 'bumperR'); expect(half.n).toBeLessThan(all.n * 0.6); expect(meshBox(half)[0][1]).toBeGreaterThan(-5); });
});

describe('the first steps\' cards (docs/systems/115 F1)', () => {
  it('the lump, each glass set on it, each interior set alone', () => {
    const lump = buildSet('frame', 'A959'), glass = ['none', 'stock', 'noQuarter', 'louvre'].map(v => buildSet('glass', v)), cab = ['stock', 'drift'].map(v => buildSet('interior', v));
    expect(isolate(lump, 'frame')).toBe(lump.mesh); expect(new Set(lump.mesh.names)).not.toContain('mirror');
    for (const g of glass) expect(g.mesh.n).toBe(lump.mesh.n);   // the glass is tags only
    const G = KINDS.indexOf('glass'), glassTris = (m: typeof lump) => m.mesh.kind.filter(k => k === G).length; expect(glassTris(glass[0]!)).toBe(0); expect(glassTris(glass[1]!)).toBeGreaterThan(glassTris(glass[2]!));
    expect(cab[0]!.mesh.n).toBeGreaterThan(500); expect(cab[1]!.mesh.n).not.toBe(cab[0]!.mesh.n); expect((cab[1]!.mesh.names ?? []).some(n => /^cage/.test(n))).toBe(true);
    // the plates' cards (P1a): each plate alone at its own place, the front one at the nose, the rear one at the tail
    const pf = isolate(models[0]!, 'plateF'), pr = isolate(models[0]!, 'plateR'); expect(pf.n).toBeGreaterThan(20); expect(pr.n).toBe(pf.n);
    expect(meshBox(pf)[1][0]).toBeLessThan(100); expect(meshBox(pr)[0][0]).toBeGreaterThan(4100); expect([...new Set(Array.from(pf.part, p => pf.names![p]!))].every(n => /^plate/.test(n))).toBe(true);
    const blank = isolate(models[3]!, 'bumperF'); expect(new Set(Array.from(blank.part, p => blank.names![p]!))).toEqual(new Set(['bumperF'])); });
});

describe('the views and the framing', () => {
  it('front for what faces forward or back, side for the wheel and the body', () => {
    expect(KIND_VIEW).toEqual({ bumperF: 'front', bumperR: 'front', lamp: 'front', wheel: 'side', base: 'side', frame: 'side', glass: 'side', interior: 'top', plateF: 'front', plateR: 'front',
      pMirror: 'front', pWing: 'side', pExhaust: 'front', pBadge: 'front', pMarker: 'side', pVent: 'front', pLamp: 'front', pTail: 'front', pIntake: 'front', pVentCut: 'front' });
    expect(camera('bumperF', 'front').ang).toBeCloseTo(Math.PI); expect(camera('bumperR', 'front').ang).toBeCloseTo(0); expect(camera('plateR', 'front').ang).toBeCloseTo(0); expect(camera('wheel', 'top').pitch).toBe(90); });
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
  it('an outline is laid round a part that has none, not round ink already there', () => {
    const W = 12, H = 12, px = new Uint8Array(W * H * 4); for (let q = 0; q < W * H; q++) px.set([90, 110, 70, 255], q * 4);
    for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) px.set([200, 200, 200, 255], (y * W + x) * 4);   // a grey square, no outline
    const a = keyDown(px, W, H, 1, 2), at = (o: Uint8ClampedArray, x: number, y: number) => Array.from(o.subarray(((H - 1 - y) * W + x) * 4, ((H - 1 - y) * W + x) * 4 + 4));
    expect(at(a, 3, 5)).toEqual([...INK_RGB, 255]); expect(at(a, 2, 5)).toEqual([...INK_RGB, 255]); expect(at(a, 1, 5)[3]).toBe(0); expect(at(a, 5, 5)).toEqual([200, 200, 200, 255]);
    for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) if (x < 4 || x >= 8 || y < 4 || y >= 8) px.set([12, 12, 15, 255], (y * W + x) * 4);   // the same square with its own outline
    const b = keyDown(px, W, H, 1, 2); expect(at(b, 1, 5)[3]).toBe(0); expect(at(b, 2, 5)).toEqual([12, 12, 15, 255]); });
});

describe('the free surface parts\' cards (docs/systems/115 P1)', () => {
  it('each part alone on its flat skin: a few hundred triangles, no twin; the tips seen from behind; a kind\'s variants share one box', () => {
    for (const id of Object.keys(PART_THUMB) as (keyof typeof PART_THUMB)[]) { const M = partAlone(id); expect(M.n, id).toBeGreaterThan(40); expect(M.n, id).toBeLessThan(600); expect(isolate(buildSet(PART_THUMB[id], id), PART_THUMB[id]).n).toBe(M.n); }
    expect(camera('pExhaust', 'front').ang).toBeCloseTo(0); expect(VARIANTS.pWing).toEqual(['wingRing', 'wingGT']);
    const crest = partAlone('badge'); expect(crest.uv).toBeDefined(); expect(meshBox(partAlone('mirror'))[0][1]).toBeGreaterThan(800);   // on the left side, no twin across
  });
});
