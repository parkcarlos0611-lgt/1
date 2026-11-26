import { describe, expect, it } from 'vitest';
import { newWorld } from '../core/world';
import { addDays, daysBetween, weekday } from '../core/calendar';
import { startSpell } from '../core/weather';
import { DATA } from '../core/world';
import type { Incident } from '../core/state';

const FOUNDER = { background: 'coachbuilder', age: 31, given: 'Walter', family: 'Hoffman' };
type W = ReturnType<typeof newWorld>;
function until(w: W, kind: string, max = 400): Incident { for (let i = 0; i < max; i++) { const hit = w.sim.stepDay().stops.find(x => x.kind === kind); if (hit) return hit; } throw new Error('never saw ' + kind); }
/** a finished car for an order due on a given day (no spells of weather on the way) */
function built(seed: number, due: string, skill = 80, channel: 'visit' | 'mail' = 'visit') { const w = newWorld(seed, FOUNDER), { sim, sales, shop } = w, g = sim.g, f = g.people[g.founderId!]!; for (const k of Object.keys(f.skills)) f.skills[k] = skill; g.weather.graceUntil = '1999-01-01';
  shop.addDesign({ id: 'body', name: 'b', baseCar: 'sedan30', orderType: 'body_only', size: 1, effort: { proportion: 0, parts: 0, panels: 0 } }); for (const part of Object.keys(shop.bom(g.shop.designs.body!))) g.supply.lots.push({ part, grade: 3, qty: 1, quality: skill, unitCost: 20, received: g.clock.date });
  const ord = sales.bookFor({ type: 'doctor', standing: 60, body: 'sedan', mustHave: [] }, { designId: 'body', price: 700, due, depositRate: 0.3, meets: [] }, 1)[0]!; sales.customer(ord.customerId).channel = channel; sales.customer(ord.customerId).budget = [650, 800]; shop.startBuild('body', ord.id);
  const car = until(w, 'car_built').payload.carId as number; return { w, g, ord, car, sales }; }

describe('handing a car over', () => {
  it('a customer told early comes sooner or on the promised day, and says how it went', () => { let sooner = 0, onDay = 0;
    for (let seed = 1; seed <= 12; seed++) { const { w, g, ord, car, sales } = built(seed, '1930-09-01'), today = g.clock.date, comes = sales.tellReady(ord.id, car); expect(() => sales.tellReady(ord.id, car)).toThrow(/told already/); expect(comes > today).toBe(true); expect(comes <= '1930-09-01').toBe(true);
      if (comes === '1930-09-01') onDay++; else { sooner++; expect(daysBetween(today, comes)).toBeLessThanOrEqual(5); } const it = until(w, 'customer_arrives'); expect(it.date >= comes).toBe(true); expect(weekday(it.date)).not.toBe(0); expect(g.incidents.some(i => i.kind === 'order_late')).toBe(false);
      const cash = g.ledger.cash, r = sales.deliver(ord.id, car); if ('cannotPay' in r) continue; expect(r.scene!.lines.length).toBe(5); for (const l of r.scene!.lines) expect(l).not.toMatch(/[{}]/); expect(r.scene!.lines[3]).toContain('$490'); expect(r.scene!.summary).toContain(String(r.satisfaction)); expect(g.ledger.cash).toBe(cash + 490); expect(r.satisfaction).toBeGreaterThan(40); }
    expect(sooner).toBeGreaterThan(3); expect(onDay).toBeGreaterThan(0); });
  it('a car that stood ready in time is not late because the customer came later; by post it takes longer', () => { const { w, g, ord, car, sales } = built(2, '1930-09-01', 80, 'mail'); while (g.clock.date < '1930-08-31') w.sim.stepDay(); const comes = sales.tellReady(ord.id, car); expect(daysBetween(g.clock.date, comes)).toBeGreaterThanOrEqual(DATA.sales.mailDays + 1); expect(comes > ord.due).toBe(true);
    until(w, 'customer_arrives'); const r = sales.deliver(ord.id, car); if (!('cannotPay' in r)) expect(r.scene!.lines[2]).toMatch(/약속한 날을 지켜|괜한 걱정/); expect(g.incidents.some(i => i.kind === 'order_late')).toBe(false); });
  it('a blizzard keeps the customer at home until it is over', () => { const { w, g, ord, car, sales } = built(3, '1930-03-01'); while (g.clock.date < '1930-03-03') w.sim.stepDay(); delete g.weather.graceUntil; startSpell(w.sim.api(), DATA.weather, 'blizzard', 6); g.weather.graceUntil = '1999-01-01'; const end = g.weather.event!.end; sales.tellReady(ord.id, car);
    expect(() => sales.driveOver(ord.id, car)).toThrow(/roads/); const it = until(w, 'customer_arrives'); expect(it.date > end).toBe(true); });
  it('driving it over takes hours and a fare, is remembered, and a fault left in may show at the door', () => { let ok = 0, fault = 0;
    for (let seed = 1; seed <= 16; seed++) { const { w, g, ord, car, sales } = built(seed, '1930-12-01', seed % 2 ? 85 : 30, seed % 4 < 2 ? 'visit' : 'mail'); while (weekday(g.clock.date) === 0 || g.weather.today === 'snow') w.sim.stepDay(); const c = g.shop.cars.find(x => x.id === car)!; if (seed % 2 === 0 && !c.defects.length) c.defects.push({ step: 'chassis', kind: 'brake_pull', severity: 3, found: false, fixed: false });
      const trust = g.market.reputation.trust, town = g.market.awareness.town, hours = sales.driveHours(ord.id); expect(hours).toBe(seed % 4 < 2 ? 3 : 8); const r = sales.driveOver(ord.id, car); if ('cannotPay' in r) continue;
      expect(g.ledger.entries.some(e => e.kind === 'delivery' && e.amount < 0)).toBe(true); expect(Object.values(g.tasks).some(t => t.label === 'delivery' && t.hoursNeeded === hours)).toBe(true); expect(r.scene!.lines.length).toBe(6); expect(g.market.awareness.town).toBeGreaterThan(town);
      if (ord.handover!.fault) { fault++; expect(r.scene!.lines[0]).toMatch(/탈이 났다|낯선 소리/); expect(c.defects.some(d => d.found)).toBe(true); } else { ok++; expect(r.scene!.lines[0]).toContain(`${hours}시간`); if (seed % 2) expect(g.market.reputation.trust).toBeGreaterThan(trust); } }
    expect(ok).toBeGreaterThan(5); expect(fault).toBeGreaterThan(0); });
  it('a letter comes some weeks after from those who were pleased or put out', () => { let thanks = 0, complaints = 0; for (let seed = 1; seed <= 14; seed++) { const { w, g, ord, car, sales } = built(seed, '1930-12-01', seed % 2 ? 90 : 18); const r = sales.deliver(ord.id, car); if ('cannotPay' in r) continue;
      for (let i = 0; i < 40; i++) w.sim.stepDay(); const l = g.incidents.find(i => i.kind === 'customer_letter'); if (l) { expect(String(l.payload.text)).not.toMatch(/[{}]/); if (r.satisfaction >= 50) thanks++; else { expect(r.satisfaction).toBeLessThanOrEqual(0); complaints++; } } }
    expect(thanks).toBeGreaterThan(1); expect(complaints).toBeGreaterThan(0); });
});
