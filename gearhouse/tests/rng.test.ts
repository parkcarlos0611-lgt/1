import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
describe('Rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = new Rng(1930), b = new Rng(1930);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('restores from a saved state', () => {
    const a = new Rng(7); for (let i = 0; i < 10; i++) a.next();
    const b = new Rng(1); b.load(a.save()); expect(b.next()).toBe(a.next());
  });
  it('stays in range', () => {
    const r = new Rng(3); for (let i = 0; i < 1000; i++) { const f = r.float(); expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThan(1); }
  });
});
