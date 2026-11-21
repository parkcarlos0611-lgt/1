import { describe, expect, test } from 'vitest';
import { newGround, stepGround } from '../core/ground';
import type { Air } from '../core/atmosphere';
const air = (o: Partial<Air>): Air => ({ sunAlt: 20, sunAz: 180, daylight: 1, cloud: 0.9, rain: 0, snow: 0, wind: 0.2, temp: -3, sky: 'clear', ...o });

describe('the ground', () => {
  test('snow builds up, lies in the cold, melts when it warms; the road dries after rain', () => {
    const g = newGround(); for (let i = 0; i < 4; i++) stepGround(g, 60, air({ snow: 1, sky: 'snow' })); expect(g.snow).toBe(1);
    for (let i = 0; i < 24; i++) stepGround(g, 60, air({ temp: -5 })); expect(g.snow).toBe(1);
    for (let i = 0; i < 48; i++) stepGround(g, 60, air({ temp: 8, cloud: 0.3 })); expect(g.snow).toBeLessThan(0.2);
    const r = newGround(); stepGround(r, 60, air({ rain: 0.6, temp: 10, sky: 'rain' })); expect(r.wet).toBeGreaterThan(0.8);
    for (let i = 0; i < 12; i++) stepGround(r, 60, air({ temp: 15, cloud: 0.2 })); expect(r.wet).toBe(0);
  });
});
