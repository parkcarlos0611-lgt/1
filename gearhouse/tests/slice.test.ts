import { describe, expect, it } from 'vitest';
import { DATA, newWorld, openWorld } from '../core/world';
import { runBot } from '../core/bot';
import { load, save } from '../core/state';
import type { Incident } from '../core/state';

const FOUNDER = { background: 'coachbuilder', age: 31, given: 'Walter', family: 'Hoffman' };
function until(w: ReturnType<typeof newWorld>, kind: string, max = 300): Incident { for (let i = 0; i < max; i++) { const hit = w.sim.stepDay().stops.find(x => x.kind === kind); if (hit) return hit; } throw new Error('never saw ' + kind); }

describe('customers and orders', () => {
  it('the first customer writes, is consulted, quoted, and orders', () => { const w = newWorld(3, FOUNDER), { sim, sales, shop } = w; shop.addDesign({ id: 'body', name: 'body', baseCar: 'sedan30', orderType: 'body_only', size: 1, effort: { proportion: 0, parts: 0, panels: 0 } });
    const q = sales.firstCustomer(), v0 = sales.view(q.id); expect(v0.letter.length).toBeGreaterThan(20); expect(v0.budget).toBeUndefined(); expect(v0.type).toBe('doctor');
    for (let i = 0; i < 6 && !sales.view(q.id).budget; i++) sales.consult(q.id); const v = sales.view(q.id); expect(v.budget).toBeDefined();
    const cash0 = sim.g.ledger.cash; sales.quote(q.id, { designId: 'body', price: Math.round(v.budget![0] * 0.9), due: v.wantBy, depositRate: 0.3, meets: sales.customer(q.customerId).mustHave });
    const ans = until(w, 'quote_answer', 5); expect(['accept', 'haggle']).toContain(ans.payload.answer); if (ans.payload.answer === 'haggle') sales.acceptCounter(q.id);
    const ord = sim.g.market.orders[0]!; expect(ord.deposit).toBe(Math.round(ord.price * 0.3)); expect(sim.g.ledger.cash).toBeGreaterThan(cash0 + ord.deposit - 60); });
  it('an overpriced quote is refused or haggled down', () => { let refused = 0; for (let seed = 1; seed <= 20; seed++) { const w = newWorld(seed, FOUNDER); w.shop.addDesign({ id: 'body', name: 'b', baseCar: 'sedan30', orderType: 'body_only', size: 1, effort: { proportion: 0, parts: 0, panels: 0 } });
      const q = w.sales.firstCustomer(), c = w.sales.customer(q.customerId); w.sales.quote(q.id, { designId: 'body', price: c.budget[1] * 1.6, due: w.sales.view(q.id).wantBy, depositRate: 0.3, meets: c.mustHave }); if (until(w, 'quote_answer', 5).payload.answer !== 'accept') refused++; } expect(refused).toBeGreaterThanOrEqual(19); });
  it('a good car pleases, raises reputation and brings friends; a bad one does the opposite', () => { const play = (skill: number) => { for (let seed = 1; seed < 40; seed++) { const r = once(skill, seed); if (r) return r; } throw new Error('no order in 40 tries'); };
    const once = (skill: number, seed: number) => { const w = newWorld(seed, FOUNDER), { sim, sales, shop, supply } = w, f = sim.g.people[sim.g.founderId!]!; for (const k of Object.keys(f.skills)) f.skills[k] = skill;
      shop.addDesign({ id: 'body', name: 'b', baseCar: 'sedan30', orderType: 'body_only', size: 1, effort: { proportion: 0, parts: 0, panels: 0 } }); for (const part of Object.keys(shop.bom(sim.g.shop.designs.body!))) sim.g.supply.lots.push({ part, grade: 3, qty: 1, quality: skill, unitCost: 20, received: sim.g.clock.date });
      const q = sales.firstCustomer(), c = sales.customer(q.customerId); c.orderType = 'body_only'; sales.quote(q.id, { designId: 'body', price: c.budget[0] * 0.8, due: '1930-12-01', depositRate: 0.3, meets: c.mustHave });
      const ans = until(w, 'quote_answer', 5); if (ans.payload.answer === 'reject') return null; if (ans.payload.answer === 'haggle') sales.acceptCounter(q.id); const ord = sim.g.market.orders[0]!; shop.startBuild('body', ord.id); void supply;
      const car = until(w, 'car_built', 400); let r = sales.deliver(ord.id, car.payload.carId as number); if ('cannotPay' in r) r = sales.settle(ord.id, 'discount')!; return { s: (r as { satisfaction: number }).satisfaction, rep: sim.g.market.reputation.quality, friends: sim.g.market.pending.filter(p => p.kind === 'referral').length, town: sim.g.market.awareness.town }; };
    const good = play(92), bad = play(22); expect(good.s).toBeGreaterThan(60); expect(good.rep).toBeGreaterThan(0); expect(good.friends).toBeGreaterThan(0); expect(bad.s).toBeLessThan(0); expect(bad.rep).toBeLessThan(0); expect(bad.friends).toBe(0); expect(good.town).toBeGreaterThan(8); });
});
describe('newspaper', () => {
  it('comes every Thursday with history on its date, and adverts teach suppliers', () => { const w = newWorld(8, FOUNDER); const issues: Incident[] = []; for (let i = 0; i < 400; i++) issues.push(...w.sim.stepDay().stops.filter(x => x.kind === 'newspaper'));
    expect(issues[0]!.date).toBe('1930-01-02'); expect(issues.length).toBe(54); /* 57 Thursdays, three of them holidays (Thanksgiving, Christmas, New Year) with no paper */ const tariff = w.sim.g.media.issues.find(i => i.articles.some(a => a.id === 'smoot_hawley'))!; expect(tariff.date).toBe('1930-06-19'); expect(tariff.articles[0]!.id).toBe('smoot_hawley');
    const known0 = Object.values(w.sim.g.supply.suppliers).filter(s => s.known).length; for (const is of w.sim.g.media.issues) w.media.read(is.id); expect(Object.values(w.sim.g.supply.suppliers).filter(s => s.known).length).toBeGreaterThan(known0);
    expect(w.media.look(1, '1930-06-01')).toBe('new'); expect(w.media.look(1, '1934-01-01')).toBe('creased'); w.media.move(1, 'drawer'); expect(w.media.look(1, '1934-01-01')).toBe('yellowed'); /* a copy left on the desk ages faster than one kept in the drawer */ expect(w.media.look(1, '1960-01-01')).toBe('brittle'); });
});
describe('five years of ordinary play', () => {
  it('runs to the end, the same every time, and keeps the books straight', () => { const run = (seed: number) => { const w = newWorld(seed, FOUNDER), log = runBot(w, 1826); return { log, g: w.sim.g }; };
    const a = run(1930), b = run(1930); expect(save(a.g)).toBe(save(b.g)); expect(a.log.inquiries).toBeGreaterThan(20);
    const sum = a.g.ledger.entries.reduce((t, e) => t + e.amount, 0); expect(Math.abs(DATA.people.founderBackgrounds.coachbuilder!.cash + sum - a.g.ledger.cash)).toBeLessThan(0.01); });
  it('a save in the middle continues exactly', () => { const a = newWorld(77, FOUNDER); runBot(a, 400); const b = openWorld(load(save(a.sim.g))); for (let i = 0; i < 200; i++) { a.sim.stepDay(); b.sim.stepDay(); } expect(save(b.sim.g)).toBe(save(a.sim.g)); });
});
