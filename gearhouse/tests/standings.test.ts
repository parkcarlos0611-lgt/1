import { describe, it, expect } from 'vitest';
import { Race, lapTimes, bestOf, timeAt, gapBetween, bookTime, bookFor, SKILL } from '../race/race';
import { millbrook } from '../race/millbrook';

describe('the race standings and lap times (review 162)', () => {
  it('reads lap times from the line crossings: the first from the start, then line to line', () => {
    const e = { start: 10, lapAt: [10.5, 110, 205.5, 300] };
    expect(lapTimes(e)).toEqual([100, 95.5, 94.5]); expect(bestOf(lapTimes(e))).toBe(94.5); expect(bestOf([])).toBe(0);
  });
  it('gives the gap in time from where the leader passed, or in laps', () => {
    const lead = { trail: [0, 0, 10, 100, 20, 200, 30, 300], dist: 300, finish: 0 }, b = { trail: [0, 0, 30, 150], dist: 150, finish: 0 };
    expect(timeAt(lead, 150)).toBeCloseTo(15); expect(Number.isNaN(timeAt(lead, 400))).toBe(true);
    expect(gapBetween(lead, b, 30, 1000)).toEqual({ s: 15, laps: 0 });
    expect(gapBetween({ ...lead, dist: 2300 }, b, 30, 1000).laps).toBe(2);
    expect(gapBetween({ ...lead, finish: 300 }, { ...b, finish: 312.5 }, 400, 1000)).toEqual({ s: 12.5, laps: 0 });
  });
  it('orders a running race and keeps a trail for every car that has started', () => {
    const T = millbrook(), r = new Race(T, ['fnTT33', 'fordT23'], 1, null, 3, 'scratch'); r.clock = 0;
    for (let t = 0; t < 20; t += 1 / 200) r.step(1 / 200, { throttle: 0, brake: 0, steer: 0 });
    const st = r.standings(); expect(st.map(q => q.pos)).toEqual([1, 2]); expect(st[0]!.e.id).toBe('fnTT33');
    expect(st[1]!.leader.s).toBeGreaterThan(0.2); expect(st[1]!.leader.s).toBeLessThan(10); expect(st[1]!.ahead).toEqual(st[1]!.leader);
    for (const e of r.cars) expect(e.trail.length).toBeGreaterThan(300);
  });
  it('keeps Millbrook\'s book as it was and draws the opponents by skill', () => {
    expect(bookTime('fordT23', 2)).toBeCloseTo(257 + 245.6, 6); expect(bookFor('millbrook')).not.toBeNull(); expect(bookFor('nowhere')).toBeNull();
    const T = millbrook(), ids = ['fordT23', 'chevAB28', 'fnTT33', 'dueA21', 'bmw315'];
    for (const k of ['easy', 'normal', 'hard'] as const) { const r = new Race(T, ids, 1, null, 5, 'handicap', k);
      for (const e of r.cars) { expect(e.driver!.dare).toBeGreaterThanOrEqual(SKILL[k].dare[0]); expect(e.driver!.dare).toBeLessThanOrEqual(SKILL[k].dare[1]); expect(e.driver!.pace).toBeGreaterThanOrEqual(SKILL[k].pace[0]); } }
    // 'normal' draws the field it always did (the default)
    const a = new Race(T, ids, 1, null, 5), b = new Race(T, ids, 1, null, 5, 'handicap', 'normal'); expect(a.cars.map(e => e.driver!.dare)).toEqual(b.cars.map(e => e.driver!.dare));
  });
});
