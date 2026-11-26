import { describe, expect, it } from 'vitest';
import holidays from '../data/calendar/us.json';
import { holidayOn, weekday } from '../core/calendar';
import { Simulation, type System } from '../core/sim';
import { load, newGame, save } from '../core/state';

const sim = (seed = 1930) => new Simulation(newGame(seed), holidays);
// a stand-in system: a visitor on some days (random), a letter that needs an answer within 3 days
const visitors: System = { id: 'visitors', day: a => { if (a.workday && a.rng.float() < 0.3) a.raise('visitor', 'decision', { n: a.rng.int(1, 100) }, 3); } };

describe('calendar', () => {
  it('knows 1930', () => { expect(weekday('1930-01-01')).toBe(3); expect(holidayOn('1930-01-01', holidays)).toBe('new_year');
    expect(holidayOn('1930-11-27', holidays)).toBe('thanksgiving'); expect(holidayOn('1930-11-20', holidays)).toBeNull(); expect(holidayOn('1932-02-29', holidays)).toBeNull(); });
});
describe('daily tick', () => {
  it('skips the holiday and rests on Sunday', () => { const s = sim(); s.addTask({ id: 'design', label: 'design', skill: 'design', hoursNeeded: 90 });
    const d1 = s.stepDay(); expect(d1.holiday).toBe('new_year'); expect(s.g.tasks.design!.hoursDone).toBe(0);
    s.stepDay(); s.stepDay(); s.stepDay(); expect(s.g.tasks.design!.hoursDone).toBe(30);            // Thu, Fri, Sat
    const sun = s.stepDay(); expect(sun.workday).toBe(false); expect(s.g.tasks.design!.hoursDone).toBe(30); });
  it('lets the player work Sundays', () => { const s = sim(); s.g.settings.daysOff = []; s.addTask({ id: 't', label: 't', skill: 'x', hoursNeeded: 500 }); for (let i = 0; i < 5; i++) s.stepDay(); expect(s.g.tasks.t!.hoursDone).toBe(40); });
  it('follows the plan in order with caps, then spills over', () => { const s = sim(); s.addTask({ id: 'a', label: 'a', skill: 'x', hoursNeeded: 100 }); s.addTask({ id: 'b', label: 'b', skill: 'x', hoursNeeded: 100 });
    s.g.plan = [{ taskId: 'b', maxHours: 3 }]; s.stepDay(); s.stepDay(); expect(s.g.tasks.b!.hoursDone).toBe(3); expect(s.g.tasks.a!.hoursDone).toBe(7); });
  it('finishes a task and tells the player', () => { const s = sim(); s.addTask({ id: 'a', label: 'a', skill: 'x', hoursNeeded: 15 }); s.stepDay(); s.stepDay(); const r = s.stepDay();
    expect(s.g.tasks.a!.done).toBe(true); expect(r.stops.map(i => i.kind)).toContain('task_done'); });
  it('switched-off notices go to the journal', () => { const s = sim(); s.g.settings.quietKinds = ['task_done']; s.addTask({ id: 'a', label: 'a', skill: 'x', hoursNeeded: 5 }); s.stepDay(); const r = s.stepDay();
    expect(r.stops.length).toBe(0); expect(s.g.journal.some(j => j.text === 'task_done')).toBe(true); });
  it('overtime tires the founder the week after', () => { const s = sim(); s.g.founder.overtimePerDay = 4; s.addTask({ id: 'a', label: 'a', skill: 'x', hoursNeeded: 9999 });
    while (s.g.clock.date <= '1930-01-11') s.stepDay(); expect(s.g.founder.fatigue).toBe(2);                 // two hard weeks in a row (12 h, then 24 h of overtime)
    const before = s.g.tasks.a!.hoursDone; s.stepDay(); s.stepDay(); expect(s.g.tasks.a!.hoursDone - before).toBeCloseTo(14 * 0.9); });   // Sunday off, Monday at 90 %
});
describe('incidents', () => {
  it('stops on a decision and expires it after the deadline', () => { const s = sim().use(visitors); const run = s.runUntilStop(60), last = run.at(-1)!; expect(last.stops[0]!.kind).toBe('visitor');
    const id = last.stops[0]!.id; for (let i = 0; i < 5; i++) s.stepDay(); expect(s.g.incidents.find(i => i.id === id)!.state).toBe('expired'); });
  it('can be answered', () => { const s = sim().use(visitors); const it0 = s.runUntilStop(60).at(-1)!.stops[0]!; s.resolve(it0.id, 'accept'); expect(s.g.incidents.find(i => i.id === it0.id)!.choice).toBe('accept'); expect(() => s.resolve(it0.id, 'again')).toThrow(); });
});
describe('determinism and saves', () => {
  const play = (s: Simulation, days: number) => { for (let i = 0; i < days; i++) s.stepDay(); return JSON.stringify(s.g.incidents.map(i => [i.date, i.kind, i.payload])); };
  it('same seed, same five years', () => { expect(play(sim(7).use(visitors), 1826)).toBe(play(sim(7).use(visitors), 1826)); expect(play(sim(7).use(visitors), 200)).not.toBe(play(sim(8).use(visitors), 200)); });
  it('a loaded save continues exactly', () => { const a = sim(5).use(visitors); play(a, 100); const b = new Simulation(load(save(a.g)), holidays).use(visitors); expect(play(a, 300)).toBe(play(b, 300)); });
  it('five years run fast', () => { const t0 = performance.now(); const s = sim().use(visitors); for (let i = 0; i < 1826; i++) s.stepDay(); expect(performance.now() - t0).toBeLessThan(2000); expect(s.g.clock.date).toBe('1935-01-01'); });
});
