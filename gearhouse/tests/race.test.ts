import { describe, it, expect } from 'vitest';
import { Race, bookTime } from '../race/race';
import { millbrook } from '../race/millbrook';

describe('a handicap race at Millbrook', () => {
  const T = millbrook();
  it('starts the slowest first and the fastest last, by the book', () => {
    const r = new Race(T, ['fordT23', 'chevAB28', 'fnTT33', 'dueA21'], 2, null);
    const by = Object.fromEntries(r.cars.map(c => [c.id, c.start]));
    expect(by.fordT23).toBe(0); expect(by.chevAB28!).toBeGreaterThan(0); expect(by.fnTT33!).toBeGreaterThan(by.dueA21!);
    for (const c of r.cars) expect(c.start + bookTime(c.id, 2)).toBeCloseTo(r.limitTime, 6);
  });
  it('keeps cars from passing through each other', () => {
    const r = new Race(T, ['chevAB28', 'plymU29'], 1, null); const [a, b] = r.cars.map(c => c.car);
    a!.place(400, 0, 20); b!.place(403, 0.3, 5); r.clock = 1e4;
    let min = Infinity; for (let t = 0; t < 3; t += 1 / 200) { r.step(1 / 200, { throttle: 0, brake: 0, steer: 0 }); min = Math.min(min, Math.hypot(a!.x - b!.x, a!.y - b!.y)); }
    expect(min).toBeGreaterThan(1.2);
  });
});
