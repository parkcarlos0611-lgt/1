import { describe, it, expect } from 'vitest';
import { fitSlot, assemble } from '../render/car/swap';
import type { CarModel } from '../render/car/model';
import chev from '../data/cars/sheet/chevAB28.json';
import pontiac from '../data/cars/sheet/pontiac29.json';
import fordT from '../data/cars/sheet/fordT23.json';
const C = chev as unknown as CarModel, P = pontiac as unknown as CarModel, T = fordT as unknown as CarModel;

describe('putting one car\'s parts on another', () => {
  it('a car\'s own part is its own', () => { expect(fitSlot(C, C, 'grille').fit.grade).toBe('own'); });
  it('wings from a car of near the same size fit with little or no work, and stand round the base car\'s wheel', () => {
    const r = fitSlot(C, P, 'fenderF'); expect(['fits', 'work']).toContain(r.fit.grade);
    const f = r.model.parts.find(p => p.id === 'x_fenderF')!, s = f.sheet!.side!, fx = C.wheels[0]!.x; expect(s[0]).toBeLessThan(fx); expect(s[1]).toBeGreaterThan(fx);
    expect(r.model.parts.some(p => p.id === 'fenderF')).toBe(false); });
  it('a car without the part gives none, and says so', () => { const r = fitSlot(C, T, 'bumperF'); expect(r.fit.grade).toBe('no'); });
  it('several slots at once, each from its own car', () => { const r = assemble(C, { grille: P, lamp: T, wheel: P }); expect(r.fits.grille!.grade).not.toBe('own'); expect(r.fits.fenderF!.grade).toBe('own'); expect(r.model.parts.some(p => p.id === 'x_shell')).toBe(true); });
});

describe('reshaping a part to fit', () => {
  it('a part can be made bigger or wider; the change is graded with the relaxed limits', async () => {
    const { fitSlot } = await import('../render/car/swap');
    const plain = fitSlot(C, C, 'bumperF'); expect(plain.fit.grade).toBe('own');
    const wide = fitSlot(C, C, 'bumperF', { size: 1, width: 1.2, length: 1 }); expect(wide.fit.grade).toBe('work');
    const w0 = C.parts.find(p => p.id === 'bumperF0')!.sheet!.front!, w1 = wide.model.parts.find(p => p.id === 'x_bumperF0')!.sheet!.front!;
    expect(w1[1] - w1[0]).toBeGreaterThan((w0[1] - w0[0]) * 1.15);
    expect(fitSlot(C, C, 'bumperF', { size: 1.5, width: 1.5, length: 1 }).fit.grade).toBe('no');
    expect(fitSlot(C, C, 'bumperF', { size: 1.3, width: 1, length: 1 }).fit.grade).toBe('work');   // under 40%
  });
});
