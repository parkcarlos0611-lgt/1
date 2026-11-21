import { describe, it, expect } from 'vitest';
import { newCaller, stepCaller, TO_DOOR, AWAY } from '../ui/world/caller';

describe('the customer on foot', () => {
  it('walks from his car to the door at a walking pace and knocks there', () => {
    const c = newCaller(TO_DOOR); let t = 0, steps = 0, r: string | null = null;
    while (t < 20 && r !== 'arrived') { r = stepCaller(c, 1 / 30); t += 1 / 30; if (r === 'step') steps++; }
    expect(r).toBe('arrived'); expect(c.state).toBe('knock');
    // about 135 px of path at 32..37 px a metre, 1.25 m a second: three to four seconds, a footfall every 0.36 m
    expect(t).toBeGreaterThan(2.5); expect(t).toBeLessThan(5); expect(steps).toBeGreaterThan(8);
  });
  it('walking away, ends off the screen', () => { const c = newCaller(AWAY); for (let k = 0; k < 600 && c.state === 'walk'; k++) stepCaller(c, 1 / 30); expect(c.state).toBe('knock'); expect(AWAY[AWAY.length - 1]![0]).toBeLessThan(0); });
});
