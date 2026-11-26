import { describe, it, expect } from 'vitest';
import { Health } from '../race/health';

describe('engine heat and failures', () => {
  it('settles below the warning at speed, and fails nothing there', () => {
    const h = new Health(60, { siphon: false, margin: 1.1 }, 3); for (let t = 0; t < 1200; t += 0.05) expect(h.step(0.05, 2800, 3360, 60 * 745.7 * 0.8, 27)).toBeNull();
    expect(h.water).toBeLessThan(95); expect(h.water).toBeGreaterThan(60);
  });
  it('boils at full power crawling uphill, loses water and in time fails', () => {
    const h = new Health(20, { siphon: true, margin: 1.0 }, 5); let failed = null as string | null, t = 0;
    for (; t < 3600 && !failed; t += 0.05) failed = h.step(0.05, 1700, 1800, 20 * 745.7, 4) ?? failed;
    expect(h.level).toBeLessThan(1); expect(failed).not.toBeNull();
  });
  it('floats its valves held past the red line, and not below it', () => {
    let fails = 0; for (let k = 0; k < 40; k++) { const h = new Health(40, { siphon: false, margin: 1 }, k + 1); for (let t = 0; t < 30; t += 0.05) if (h.step(0.05, 5300, 4800, 20000, 30) === 'valve') { fails++; break; } }
    expect(fails).toBeGreaterThan(10);
    const ok = new Health(40, { siphon: false, margin: 1 }, 9); for (let t = 0; t < 60; t += 0.05) expect(ok.step(0.05, 4700, 4800, 20000, 30)).toBeNull();
  });
});
