import { describe, expect, test } from 'vitest';
import { air, sun } from '../core/atmosphere';
import { newHouse, stepKitchen, settleKitchen, BOIL } from '../core/house';

describe('the air by the hour', () => {
  test('the sun: high at noon in June, low in December, under the horizon at midnight', () => {
    const june = sun('1930-06-21', 720), dec = sun('1930-12-21', 720), night = sun('1930-06-21', 0);
    expect(june.alt).toBeGreaterThan(68); expect(june.alt).toBeLessThan(73);
    expect(dec.alt).toBeGreaterThan(21); expect(dec.alt).toBeLessThan(26);
    expect(night.alt).toBeLessThan(-20);
    expect(Math.abs(june.az - 180)).toBeLessThan(3);
    expect(sun('1930-06-21', 6 * 60).az).toBeLessThan(90);    // a June morning: the sun is north of east
    expect(sun('1930-12-21', 9 * 60).az).toBeGreaterThan(120); // a December morning: south-east
  });
  test('the same hour gives the same weather; rain days are cloudy and wet', () => {
    expect(air('1930-03-02', 615, 'rain', 7)).toEqual(air('1930-03-02', 615, 'rain', 7));
    const r = air('1930-03-02', 615, 'rain', 7), c = air('1930-03-02', 615, 'clear', 7);
    expect(r.cloud).toBeGreaterThan(0.8); expect(r.rain).toBeGreaterThan(0); expect(c.rain).toBe(0); expect(c.cloud).toBeLessThan(0.5);
    expect(air('1930-07-10', 14 * 60, 'clear', 7).temp).toBeGreaterThan(air('1930-01-10', 14 * 60, 'clear', 7).temp + 15);
    expect(air('1930-07-10', 0, 'clear', 7).daylight).toBe(0); expect(air('1930-07-10', 12 * 60, 'clear', 7).daylight).toBe(1);
  });
  test('weather changes smoothly from minute to minute', () => {
    let last = air('1930-04-04', 0, 'rain', 3); for (let m = 1; m < 1440; m++) { const a = air('1930-04-04', m, 'rain', 3); expect(Math.abs(a.cloud - last.cloud)).toBeLessThan(0.02); last = a; }
  });
});

describe('the kitchen', () => {
  test('the kettle boils on the flame, cools off it; the window goes up by degrees; steam fogs a shut window', () => {
    const k = newHouse().kitchen; k.kettle = 20; k.burner = true;
    for (let i = 0; i < 20; i++) stepKitchen(k, 1, 18, 5); expect(k.kettle).toBe(BOIL); expect(k.fog).toBeGreaterThan(0);
    k.burner = false; for (let i = 0; i < 600; i++) stepKitchen(k, 1, 18, 5); expect(k.kettle).toBeLessThan(40);
    k.windowWanted = 1; stepKitchen(k, 0.5, 18, 5); expect(k.window).toBeGreaterThan(0.3); expect(k.window).toBeLessThan(1); stepKitchen(k, 2, 18, 5); expect(k.window).toBe(1);
    k.burner = true; settleKitchen(k, 600, 18); expect(k.burner).toBe(false); expect(k.kettle).toBeLessThan(19); expect(k.fog).toBe(0);
  });
});
