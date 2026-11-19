import { describe, expect, it } from 'vitest';
import holidays from '../data/calendar/us.json';
import names from '../data/names/us.json';
import peopleData from '../data/people/us_1930.json';
import finance from '../data/finance/us_1930.json';
import { Rng } from '../core/rng';
import { Simulation } from '../core/sim';
import { newGame, load, save } from '../core/state';
import { drawLifespan, firstImpression, fullName, makeFounder, makeName, makePerson, skillRate, type PeopleData } from '../core/people';
import { financeSystem, forecast, statement } from '../core/ledger';

const PD = peopleData as unknown as PeopleData;
function company(seed = 1) { const s = new Simulation(newGame(seed), holidays).use(financeSystem(finance));
  const f = makeFounder(s.rng, names, PD, 1930, { background: 'coachbuilder', age: 31, given: 'Walter', family: 'Hoffman' }); s.setFounder(f, PD.founderBackgrounds.coachbuilder!.cash); return { s, f }; }

describe('names and people', () => {
  it('gives varied names', () => { const r = new Rng(3), seen = new Set<string>(); for (let i = 0; i < 2000; i++) { const n = makeName(r, names, 'm'); seen.add(n.given + n.initial + n.family); } expect(seen.size).toBeGreaterThan(1950); });
  it('makes the same person from the same seed', () => { const a = makePerson(new Rng(9), names, PD, 1930), b = makePerson(new Rng(9), names, PD, 1930); expect(fullName(a)).toBe(fullName(b)); expect(a.skills).toEqual(b.skills); });
  it('keeps potential at or above skill', () => { const r = new Rng(4); for (let i = 0; i < 300; i++) { const p = makePerson(r, names, PD, 1930); for (const k of PD.skills) { expect(p.potential[k]!).toBeGreaterThanOrEqual(p.skills[k]!); expect(p.skills[k]!).toBeGreaterThanOrEqual(0); } } });
  it('draws lifespans as designed', () => { const r = new Rng(5), L = PD.lifespan, v = Array.from({ length: 20000 }, () => drawLifespan(r, L, 30)), mean = v.reduce((a, b) => a + b, 0) / v.length;
    expect(Math.min(...v)).toBeGreaterThanOrEqual(31); expect(Math.max(...v)).toBeLessThanOrEqual(99);
    const long = v.filter(x => x >= 70).length / v.length; expect(long).toBeGreaterThan(0.6); expect(mean).toBeGreaterThan(68); expect(mean).toBeLessThan(80); });
  it('founder follows the background', () => { const { f } = company(); expect(fullName(f)).toMatch(/^Walter .*Hoffman$/); expect(f.skills.wood!).toBeGreaterThan(f.skills.mech!); });
  it('skill sets the pace of work', () => { expect(skillRate(20)).toBeCloseTo(0.6); expect(skillRate(50)).toBeCloseTo(1); expect(skillRate(100)).toBeCloseTo(1.6); });
});
describe('work with people', () => {
  it('a skilled founder works faster and learns', () => { const { s, f } = company(); s.addTask({ id: 'frame', label: 'body frame', skill: 'wood', hoursNeeded: 60 }); const w0 = f.skills.wood!;
    s.stepDay(); s.stepDay(); expect(s.g.tasks.frame!.hoursDone).toBeCloseTo(10 * skillRate(w0), 1); for (let i = 0; i < 6; i++) s.stepDay(); expect(s.g.tasks.frame!.done).toBe(true); expect(f.skills.wood!).toBeGreaterThan(w0); });
  it('an employee takes the task that suits them and gets known', () => { const { s } = company(); const p = makePerson(s.rng, names, PD, 1930, { age: 19, level: 45, best: 'panel' });
    s.addTask({ id: 'a', label: 'frame', skill: 'wood', hoursNeeded: 400 }); s.addTask({ id: 'b', label: 'panels', skill: 'panel', hoursNeeded: 400 }); s.g.plan = [{ taskId: 'a' }];
    const known = firstImpression(s.rng, p, ['panel']), width0 = known.panel![1] - known.panel![0]; s.hire(p, 13, known);
    for (let i = 0; i < 40; i++) s.stepDay(); expect(s.g.tasks.b!.hoursDone).toBeGreaterThan(100); const k = s.g.employees[0]!.known.panel!; expect(k[1] - k[0]).toBeLessThan(width0); });
});
describe('ledger', () => {
  it('pays living costs, utilities and wages, and closes the month', () => { const { s } = company(); const p = makePerson(s.rng, names, PD, 1930, { age: 19 }); s.hire(p, 13, {}); let closed = 0;
    s.bus.on('month_closed', () => closed++); while (s.g.clock.date <= '1930-01-31') s.stepDay();
    const st = statement(s.g, '1930-01'); expect(closed).toBe(1); expect(st.byKind.living).toBe(-18 * 4); expect(st.byKind.wages).toBe(-13 * 4); expect(st.byKind.utilities).toBeUndefined();   // Jan 1 was a holiday: the bill comes on Feb 1
    expect(s.g.ledger.cash).toBe(PD.founderBackgrounds.coachbuilder!.cash - 72 - 52); });
  it('warns before the cash runs out, once a month', () => { const { s } = company(); s.g.ledger.cash = 120; const stops = [] as string[]; for (let i = 0; i < 20; i++) stops.push(...s.stepDay().stops.map(x => x.kind));
    expect(stops.filter(k => k === 'cash_warning').length).toBe(1); expect(forecast(s.g, finance).some(c => c < 0)).toBe(true); });
  it('raises a decision when wages cannot be paid', () => { const { s } = company(); s.g.ledger.cash = 20; s.hire(makePerson(s.rng, names, PD, 1930), 30, {}); const kinds: string[] = []; for (let i = 0; i < 5; i++) kinds.push(...s.stepDay().stops.map(x => x.kind)); expect(kinds).toContain('wage_missed'); });
  it('saves and continues with people and money', () => { const { s } = company(11); s.addTask({ id: 'a', label: 'a', skill: 'wood', hoursNeeded: 900 }); for (let i = 0; i < 50; i++) s.stepDay();
    const t = new Simulation(load(save(s.g)), holidays).use(financeSystem(finance)); for (let i = 0; i < 100; i++) { s.stepDay(); t.stepDay(); } expect(save(t.g)).toBe(save(s.g)); });
});
