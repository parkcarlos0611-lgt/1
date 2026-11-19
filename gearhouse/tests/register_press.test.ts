import { describe, expect, it } from 'vitest';
import { newWorld, openWorld, DATA } from '../core/world';
import { load, save } from '../core/state';

const FOUNDER = { background: 'coachbuilder', age: 31 };
const play = (seed: number, days: number) => { const w = newWorld(seed, FOUNDER); for (let i = 0; i < days; i++) w.sim.stepDay(); return w; };

describe('town register', () => {
  it('founds the town once and remembers what happens to it', () => { const w = play(3, 1826), R = w.sim.g.media.register;
    expect(Object.values(R.entities).filter(e => e.kind === 'bank').length).toBe(6); expect(Object.values(R.entities).filter(e => e.kind === 'office').every(e => typeof e.attrs.holder === 'string')).toBe(true);
    expect(R.records.length).toBeGreaterThan(30); for (let i = 1; i < R.records.length; i++) expect(R.records[i]!.date >= R.records[i - 1]!.date).toBe(true);
    const e = Object.values(R.entities).find(x => w.media.register.history(x.id).length >= 2)!, h = w.media.register.history(e.id); expect(h.at(-1)!.to ?? e.status).toBeDefined(); expect(w.media.register.recent(e.kind, 4000, w.sim.g.clock.date).length).toBeGreaterThanOrEqual(h.length); });
  it('never reports on a bank, factory or maker that is gone', () => { let closures = 0; for (let seed = 1; seed <= 12; seed++) { const w = play(seed, 1826), R = w.sim.g.media.register, goneAt = new Map<string, string>();
      for (const r of R.records) if (r.to === 'closed' || r.to === 'bankrupt') { goneAt.set(r.entityId, r.date); closures++; }
      for (const r of R.records) { const g = goneAt.get(r.entityId); if (g && r.type !== 'anniversary') expect(r.date <= g, `${r.entityId} reported on ${r.date} after it went on ${g}`).toBe(true); }
      const names = new Map([...goneAt].map(([id, d]) => [R.entities[id]!.name, d]));
      for (const is of w.sim.g.media.issues) for (const a of is.articles) { if (a.id === 'anniversary' || a.origin === 'real') continue; for (const [name, d] of names) if (is.date > d && a.headline.includes(name)) throw new Error(`${is.date} "${a.headline}" names ${name}, gone since ${d}`); } }
    expect(closures).toBeGreaterThan(3); });
  it('a subject is not in the paper two weeks running, and the paper recalls its last report', () => { const w = play(5, 1826), R = w.sim.g.media.register; const by = new Map<string, string[]>(); for (const r of R.records) by.set(r.entityId, [...(by.get(r.entityId) ?? []), r.date]);
    for (const ds of by.values()) for (let i = 1; i < ds.length; i++) expect((Date.parse(ds[i]!) - Date.parse(ds[i - 1]!)) / 864e5).toBeGreaterThanOrEqual(21);
    const recalled = w.sim.g.media.issues.flatMap(i => i.articles).filter(a => a.slots?.before); expect(recalled.length).toBeGreaterThan(3); });
  it('a closed bank locks up its customers\' money', () => { const w = newWorld(9, FOUNDER); for (let i = 0; i < 10; i++) w.sim.stepDay(); const q = w.sales.firstCustomer(), c = w.sales.customer(q.customerId); expect(c.bankId).toMatch(/^bank:/);
    expect(w.sales.banks!.closed(c.bankId!)).toBe(false); w.media.register.get(c.bankId!)!.status = 'closed'; expect(w.sales.banks!.closed(c.bankId!)).toBe(true); });
});
describe('reporters', () => {
  it('staffs each paper with ten named seats, one per voice, and four unnamed', () => { const w = play(2, 30), seats = w.media.press.seats('town_weekly'); expect(seats.filter(s => s.named).length).toBe(10); expect(seats.filter(s => !s.named).length).toBe(4);
    expect(new Set(seats.filter(s => s.named).map(s => s.voice)).size).toBe(10); expect(new Set(seats.filter(s => s.named).map(s => s.name)).size).toBe(10); expect(play(2, 30).media.press.seats('town_weekly').map(s => s.name)).toEqual(seats.map(s => s.name)); expect(play(3, 30).media.press.seats('town_weekly').map(s => s.name)).not.toEqual(seats.map(s => s.name)); });
  it('a retiring reporter is followed by a new name in the same seat and voice, with a notice in the paper', () => { const w0 = play(4, 30), before = w0.media.press.seats('town_weekly').filter(s => s.named).map(s => ({ id: s.id, voice: s.voice, name: s.name })); const w = play(4, 2600), P = w.sim.g.media.press;
    expect(P.past.length).toBeGreaterThanOrEqual(1); for (const gone of P.past) { const seat = P.seats.find(s => s.id === gone.seat)!, was = before.find(b => b.id === gone.seat)!; expect(seat.voice).toBe(was.voice); expect(seat.name).not.toBe(was.name); expect(seat.quirk).toBeDefined(); }
    const notices = w.sim.g.media.issues.flatMap(i => i.articles).filter(a => a.id === 'press_retire'); expect(notices.length).toBe(P.past.length); expect(notices[0]!.headline).toContain(P.past[0]!.name);
    const after = w.sim.g.media.issues.filter(i => i.date > P.past[0]!.to).flatMap(i => i.articles); expect(after.some(a => a.byline === P.past[0]!.name)).toBe(false); });
  it('names the reporter under items of importance 3 and up, in a voice that suits', () => { const w = play(6, 900), arts = w.sim.g.media.issues.flatMap(i => i.articles).filter(a => a.origin === 'fictional' && a.importance != null && a.seed != null);
    expect(arts.filter(a => a.importance! >= 3).every(a => !!a.byline)).toBe(true); expect(arts.filter(a => a.importance! <= 2).every(a => !a.byline)).toBe(true);
    for (const a of arts) { const v = DATA.bodies.voices.find(x => x.id === a.voice)!; if (a.importance! >= 3) expect(v.slants.includes(a.slant!) || v.id === 'wire').toBe(true); } expect(arts.some(a => a.voice === 'booster' && a.slant === 'bad')).toBe(false); });
  it('unnamed staff change voice as they come and go, and all of it survives a save', () => { const w = play(7, 200), v0 = w.media.press.seats('town_weekly').filter(s => !s.named).map(s => s.voice + s.since); for (let i = 0; i < 1400; i++) w.sim.stepDay();
    expect(w.media.press.seats('town_weekly').filter(s => !s.named).map(s => s.voice + s.since)).not.toEqual(v0);
    const b = openWorld(load(save(w.sim.g))); for (let i = 0; i < 200; i++) { w.sim.stepDay(); b.sim.stepDay(); } expect(save(b.sim.g)).toBe(save(w.sim.g)); });
});
