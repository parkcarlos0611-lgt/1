import { describe, expect, it } from 'vitest';
import { newWorld, openWorld } from '../core/world';
import { RATE } from '../core/clock';
import { load } from '../core/state';

const FOUNDER = { background: 'coachbuilder', age: 31, given: 'Walter', family: 'Hoffman' };

describe('minute clock', () => {
  it('runs a day in 60 s when free, a minute a second for events, a third of a minute at work, not at all in talk', () => {
    expect(RATE.free * 60).toBe(1440); expect(RATE.event).toBe(1); expect(RATE.work * 60).toBeCloseTo(20); expect(RATE.talk).toBe(0);
    const w = newWorld(5, FOUNDER), c = w.clock, m0 = c.minute; c.tick(1, 'free'); expect(c.minute - m0).toBeCloseTo(24); c.tick(10, 'talk'); expect(c.minute - m0).toBeCloseTo(24);
  });
  it('plays each date once, at five in the morning, and keeps the played date one ahead of the clock', () => {
    const w = newWorld(5, FOUNDER), c = w.clock, g = w.sim.g, start = c.today;
    c.advance(1); expect(g.clock.date > start).toBe(true);                                          // the first day is played as soon as the clock runs (it starts at 07:00)
    const played = g.clock.date; c.advance(60 * 10); expect(g.clock.date).toBe(played);              // the same day: nothing more is played
    c.advance(60 * 10); expect(c.today > start).toBe(true); expect(g.clock.date).toBe(played);       // past midnight (03:01), before five: not yet
    c.advance(60 * 5); expect(g.clock.date > played).toBe(true); expect(g.clock.date > c.today).toBe(true);
  });
  it('sleeping runs to the next morning; time of day items come due in order', () => {
    const w = newWorld(5, FOUNDER), c = w.clock; c.advance(1); const d0 = c.today;
    c.schedule({ date: d0, minute: 15 * 60, kind: 'b' }); c.schedule({ date: d0, minute: 10 * 60, kind: 'a' });
    const p = c.advance(60 * 9); expect(p.due.map(x => x.kind)).toEqual(['a', 'b']);
    c.sleep(); expect(c.today > d0).toBe(true); expect(c.hhmm()).toBe('06:00');
  });
  it('survives a save', () => { const w = newWorld(5, FOUNDER); w.clock.advance(200); const w2 = openWorld(load(w.sim.snapshot())); expect(w2.clock.minute).toBeCloseTo(w.clock.minute); expect(w2.clock.today).toBe(w.clock.today); });
});

describe('repair jobs', () => {
  const firstJob = (seed: number) => { const w = newWorld(seed, FOUNDER); for (let i = 0; i < 120 && !w.sim.g.repair!.jobs.length; i++) w.sim.stepDay(); return w; };
  it('customers come with damage on the parts of their car; the car pulls up at an hour of the day', () => {
    const w = firstJob(11), j = w.sim.g.repair!.jobs[0]!; expect(j).toBeDefined(); expect(j.damages.length).toBeGreaterThan(0);
    for (const d of j.damages) expect(['body', 'fenderF', 'fenderR', 'hood', 'cowl', 'apron', 'splash', 'lamp', 'roof']).toContain(d.part);
    expect(w.sim.g.agenda!.some(a => a.kind === 'repair_visit' && a.ref === j.id)).toBe(true);
    expect(w.sim.g.incidents.some(i => i.kind === 'repair_inquiry' && i.payload.jobId === j.id)).toBe(true);
  });
  it('hidden damage and the budget only show after talking', () => {
    let found = 0; for (let seed = 1; seed < 40 && !found; seed++) { const w = firstJob(seed), j = w.sim.g.repair!.jobs[0]; if (!j || !j.damages.some(d => d.hidden)) continue;
      const before = w.repair.view(j.id); expect(before.budget).toBeUndefined(); expect(before.damages.length).toBeLessThan(j.damages.length);
      for (let k = 0; k < 2; k++) { try { w.repair.consult(j.id); } catch { break; } } const after = w.repair.view(j.id); if (after.damages.length === j.damages.length) found++; }
    expect(found).toBe(1);
  });
  it('a cheap price is taken, a dear one mostly refused', () => { let cheap = 0, dear = 0;
    for (let seed = 1; seed <= 30; seed++) { const w = firstJob(seed), j = w.sim.g.repair!.jobs[0]; if (!j) continue; if (w.repair.offer(j.id, Math.round(j.budget[0] * 0.8), j.wantDays)) cheap++;
      const w2 = firstJob(seed), j2 = w2.sim.g.repair!.jobs[0]!; if (w2.repair.offer(j2.id, Math.round(j2.budget[1] * 1.7), j2.wantDays)) dear++; }
    expect(cheap).toBeGreaterThan(20); expect(dear).toBeLessThan(cheap / 3);
  });
  it('the customer pays on collecting; rust left under the paint comes back months later', () => {
    const w = firstJob(3), j = w.sim.g.repair!.jobs[0]!; let ok = false; for (let k = 0; k < 10 && !ok; k++) ok = w.repair.offer(j.id, Math.round(j.budget[0] * (0.7 - k * 0.05)), j.wantDays); expect(ok).toBe(true);
    w.repair.finish(j.id, { satisfaction: 40, backChance: 1, hours: 6 }); const cash = w.sim.g.ledger.cash, r = w.repair.collect(j.id);
    expect(w.sim.g.ledger.cash).toBeCloseTo(cash + r.paid); expect(w.sim.g.repair!.later.some(l => l.kind === 'complaint')).toBe(true);
    let complained = false; for (let i = 0; i < 200 && !complained; i++) complained = w.sim.stepDay().stops.some(s => s.kind === 'repair_complaint'); expect(complained).toBe(true);
  });
  it('work at the bench: worse damage takes longer and costs more in materials', () => {
    const w = newWorld(5, FOUNDER), R = w.repair, lo = R.work({ part: 'hood', kind: 'dent', severity: 0.2, hidden: false }), hi = R.work({ part: 'hood', kind: 'dent', severity: 0.9, hidden: false });
    expect(hi.hours).toBeGreaterThan(lo.hours); expect(hi.materials).toBeGreaterThan(lo.materials); expect(lo.hours % 0.5).toBe(0);
  });
});
