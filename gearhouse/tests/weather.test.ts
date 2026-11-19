import { describe, expect, it } from 'vitest';
import { DATA, newWorld, openWorld } from '../core/world';
import { addDays, daysBetween, parts } from '../core/calendar';
import { load, save } from '../core/state';
import { Rng } from '../core/rng';
import { weatherNote, weatherWords, type WeatherState } from '../core/weather';

const FOUNDER = { background: 'coachbuilder', age: 31, given: 'Walter', family: 'Hoffman' }, D = DATA.weather;
describe('weather', () => {
  it('follows the seasons; spells last a month at most, keep a grace between them, and a long rain comes once a year', () => { const kinds = new Set<string>(); let snowDays = 0, rainDays = 0, days = 0, spellDays = 0;
    for (let seed = 1; seed <= 4; seed++) { const w = newWorld(seed, FOUNDER), g = w.sim.g, spells: { kind: string; start: string; end: string }[] = [];
      for (let i = 0; i < 3650; i++) { const r = w.sim.stepDay(); if (r.holiday) continue; const W = g.weather, m = parts(r.date).month; days++; if (W.event) spellDays++;
        if (W.today === 'snow') { snowDays++; expect(m <= 4 || m >= 11, r.date).toBe(true); } if (W.today === 'rain') rainDays++; expect(W.visit).toBeGreaterThanOrEqual(D.visit.min); expect(W.visit).toBeLessThanOrEqual(D.visit.max);
        if (W.event && spells.at(-1)?.start !== W.event.start) spells.push({ ...W.event }); }
      const longRains: Record<number, number> = {};
      spells.forEach((s, i) => { kinds.add(s.kind); const ev = D.events.find(e => e.id === s.kind)!; expect(daysBetween(s.start, s.end) + 1).toBeLessThanOrEqual(30); expect(ev.months).toContain(parts(s.start).month);
        if (s.kind === 'long_rain') { const y = parts(s.start).year; longRains[y] = (longRains[y] ?? 0) + 1; }
        if (i > 0) expect(daysBetween(spells[i - 1]!.end, s.start), s.start).toBeGreaterThanOrEqual(D.graceWinter[0]); });
      expect(Math.max(0, ...Object.values(longRains))).toBe(1); }
    expect([...kinds].sort()).toEqual(D.events.map(e => e.id).sort()); expect(snowDays / days).toBeGreaterThan(0.04); expect(rainDays / days).toBeGreaterThan(0.12); expect(spellDays / days * 365).toBeGreaterThan(25); expect(spellDays / days * 365).toBeLessThan(110); });
  it('keeps callers in person at home, not letters, and half of those a spell kept away come afterwards', () => { const count = (spell: boolean) => { let visit = 0, mail = 0; for (let seed = 1; seed <= 8; seed++) { const w = newWorld(seed, FOUNDER), g = w.sim.g; g.market.awareness.town = 100; w.sales.placeAdvert('quarter', 40);
        for (let i = 0; i < 200; i++) { if (spell) { g.weather.event = { kind: 'blizzard', start: g.clock.date, end: addDays(g.clock.date, 5) }; g.weather.graceUntil = '1999-01-01'; } else { delete g.weather.event; g.weather.graceUntil = '1999-01-01'; } w.sim.stepDay(); g.market.awareness.town = 100; }
        for (const c of Object.values(g.market.customers)) if (c.channel === 'visit') visit++; else mail++; } return { visit, mail }; };
    const fine = count(false), snowed = count(true); expect(snowed.visit).toBeLessThan(fine.visit * 0.6); expect(snowed.mail).toBeGreaterThan(fine.mail * 0.7);
    const w = newWorld(1, FOUNDER), g = w.sim.g; g.weather.event = { kind: 'cold_wave', start: '1929-12-25', end: '1929-12-31' }; g.weather.lost = 9; w.sim.stepDay(); w.sim.stepDay(); w.sim.stepDay();
    expect(g.weather.event).toBeUndefined(); expect(g.weather.last?.kind).toBe('cold_wave'); expect(g.weather.lost).toBe(0); const n0 = Object.keys(g.market.customers).length; expect(g.market.pending.filter(p => p.kind === 'return').length + n0).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < 20; i++) w.sim.stepDay(); expect(Object.values(g.market.customers).filter(c => c.channel === 'visit').length).toBeGreaterThanOrEqual(4); });
  it('the paper prints short notes by its leaning, and speaks only of the weather there is', () => { const W: WeatherState = { today: 'snow', visit: 0.3, event: { kind: 'blizzard', start: '1931-01-05', end: '1931-01-09' }, lost: 0, returning: 0 }, r = new Rng(3);
    expect(weatherNote(W, D, '1931-01-01', '1931-01-08', r, 0)).toBeNull(); const n = weatherNote(W, D, '1931-01-01', '1931-01-08', r, 1)!; expect(n.headline).toContain('폭설'); expect(n.lead.length).toBeGreaterThan(8); expect(n.lead).not.toMatch(/[{}]/);
    let printed = 0; for (let k = 0; k < 400; k++) if (weatherNote({ ...W, event: { kind: 'fine_autumn', start: '1931-01-05', end: '1931-01-09' } }, D, '1931-01-01', '1931-01-08', r, 0.5)) printed++; expect(printed).toBeGreaterThan(80); expect(printed).toBeLessThan(220);   /* sometimes, not always */
    expect(weatherWords({ ...W, event: undefined, today: 'clear' }, D)).toEqual([]); expect(weatherWords(W, D)).toContain('폭설');
    let notes = 0, spellWeeks = 0; for (let seed = 1; seed <= 3; seed++) { const w = newWorld(seed, FOUNDER), g = w.sim.g; for (let i = 0; i < 1800; i++) w.sim.stepDay();
      for (const is of g.media.issues) { const m = parts(is.date).month; for (const a of is.articles) { if (a.id === 'weather_note') notes++; if (a.origin !== 'fictional' || a.id === 'weather_note') continue;
          if (m >= 5 && m <= 9) expect(a.headline, is.date).not.toMatch(/한파|폭설|눈보라|강추위|된서리/); if (m === 12 || m <= 2) expect(a.headline, is.date).not.toMatch(/폭염|무더위|가뭄/); } }
      spellWeeks += g.journal.filter(j => j.text.startsWith('weather_start:')).length; }
    expect(notes).toBeGreaterThan(15); expect(notes).toBeLessThan(spellWeeks * 4); });
  it('survives a save', () => { const w = newWorld(6, FOUNDER); for (let i = 0; i < 400; i++) w.sim.stepDay(); const again = openWorld(load(save(w.sim.g))); expect(again.sim.g.weather).toEqual(w.sim.g.weather);
    for (let i = 0; i < 60; i++) { w.sim.stepDay(); again.sim.stepDay(); } expect(again.sim.g.weather).toEqual(w.sim.g.weather); expect(again.sim.g.market.inquiries.length).toBe(w.sim.g.market.inquiries.length); });
});
