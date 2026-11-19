import { describe, expect, it } from 'vitest';
import { DATA, newWorld, openWorld } from '../core/world';
import { runBot } from '../core/bot';
import { load, save } from '../core/state';
import type { Incident } from '../core/state';
import { RELATIONS, combosWithTails, tierOf } from '../core/news';

const FOUNDER = { background: 'coachbuilder', age: 31, given: 'Walter', family: 'Hoffman' };
function until(w: ReturnType<typeof newWorld>, kind: string, max = 300): Incident { for (let i = 0; i < max; i++) { const hit = w.sim.stepDay().stops.find(x => x.kind === kind); if (hit) return hit; } throw new Error('never saw ' + kind); }

describe('customers and orders', () => {
  it('the first customer writes, is consulted, quoted, and orders', () => { const w = newWorld(3, FOUNDER), { sim, sales, shop } = w; shop.addDesign({ id: 'body', name: 'body', baseCar: 'sedan30', orderType: 'body_only', size: 1, effort: { proportion: 0, parts: 0, panels: 0 } });
    const q = sales.firstCustomer(), v0 = sales.view(q.id); expect(v0.letter.length).toBeGreaterThan(20); expect(v0.budget).toBeUndefined(); expect(v0.type).toBe('doctor');
    sales.consult(q.id); if (!(sales.view(q.id).budget && sales.view(q.id).mustHave)) sales.consult(q.id); expect(() => sales.consult(q.id)).toThrow(/nothing more|all they will say/); /* a customer sits through two talks, no more */ expect(q.consults).toBeLessThanOrEqual(2);
    const v = sales.view(q.id), top = sales.customer(q.customerId).budget; expect(v.budget === undefined || v.budget[1] === top[1]).toBe(true);
    const cash0 = sim.g.ledger.cash; sales.quote(q.id, { designId: 'body', price: Math.round(top[0] * 0.9), due: v.wantBy, depositRate: 0.3, meets: sales.customer(q.customerId).mustHave });
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
    const good = play(92), bad = play(22); expect(good.s).toBeGreaterThan(60); expect(good.rep).toBeGreaterThan(0); expect(good.friends).toBeGreaterThan(0); expect(bad.s).toBeLessThan(good.s - 40); expect(bad.s).toBeLessThan(20); expect(bad.rep).toBeLessThan(good.rep); expect(bad.friends).toBe(0); expect(good.town).toBeGreaterThan(8); });
});
describe('newspaper', () => {
  it('comes every Thursday, prints real events on their date, and adverts teach suppliers', () => { const w = newWorld(8, FOUNDER); const issues: Incident[] = []; for (let i = 0; i < 400; i++) issues.push(...w.sim.stepDay().stops.filter(x => x.kind === 'newspaper'));
    expect(issues[0]!.date).toBe('1930-01-02'); expect(issues.length).toBe(54); /* 57 Thursdays, three of them holidays (Thanksgiving, Christmas, New Year) with no paper */
    const tariff = w.sim.g.media.issues.find(i => i.articles.some(a => a.id === 'smoot_hawley'))!; expect(tariff.date).toBe('1930-06-19'); expect(tariff.articles[0]!.id).toBe('smoot_hawley'); expect(tariff.articles[0]!.page).toBe(1); expect(tariff.articles[0]!.lead).toContain('밀브룩'.slice(0, 0));
    const known0 = Object.values(w.sim.g.supply.suppliers).filter(s => s.known).length; for (const is of w.sim.g.media.issues) w.media.read(is.id); expect(Object.values(w.sim.g.supply.suppliers).filter(s => s.known).length).toBeGreaterThan(known0);
    expect(w.media.look(1, '1930-06-01')).toBe('new'); expect(w.media.look(1, '1934-01-01')).toBe('creased'); w.media.move(1, 'drawer'); expect(w.media.look(1, '1934-01-01')).toBe('yellowed'); /* a copy left on the desk ages faster than one kept in the drawer */ });
  it('has news for every class: six importances and three real levels, each in four relations to the game', () => { const F = DATA.fiction, R = DATA.real;
    for (let imp = 1; imp <= 6; imp++) for (const rel of RELATIONS) { const n = F.topics.filter(t => t.relation === rel).reduce((m, t) => m + (t[tierOf(imp)] ?? []).reduce((k, p) => k + combosWithTails(p, F, imp, rel), 0), 0); expect(n, `importance ${imp} ${rel}`).toBeGreaterThanOrEqual(1000); }
    for (const lv of ['important', 'very_important', 'historic']) for (const rel of RELATIONS) expect(R.events.some(e => e.level === lv && e.relation === rel), `${lv} ${rel}`).toBe(true);
    expect(R.events.reduce((n, e) => n + e.headlines.length * R.angles[e.relation].length, 0)).toBeGreaterThanOrEqual(600); });
  it('leaves no slot unfilled and seldom prints a headline twice in a game', () => { const w = newWorld(12, FOUNDER); for (let i = 0; i < 1826; i++) w.sim.stepDay(); const all = w.sim.g.media.issues.flatMap(i => i.articles), fic = all.filter(a => a.origin === 'fictional');
    for (const a of all) { expect(a.headline).not.toMatch(/[{}]/); expect(a.headline.length).toBeGreaterThan(4); } expect(new Set(fic.map(a => a.headline)).size / fic.length).toBeGreaterThan(0.86);
    expect(new Set(fic.map(a => a.importance)).size).toBe(6); expect(new Set(all.map(a => a.relation)).size).toBe(4); expect(all.filter(a => a.origin === 'real').length).toBeGreaterThan(50); });
  it('what the paper warns of reaches the game later', () => { const w = newWorld(21, FOUNDER); let warned: { due: string; kind: string } | null = null;
    for (let i = 0; i < 900 && !warned; i++) { w.sim.stepDay(); const c = w.sim.g.media.coming.find(x => x.kind === 'demand'); if (c) warned = { due: c.due, kind: c.kind }; }
    expect(warned).not.toBeNull(); expect(warned!.due > w.sim.g.clock.date).toBe(true); expect(w.sim.g.market.boosts.length).toBe(0); while (w.sim.g.clock.date <= warned!.due) w.sim.stepDay(); expect(w.sim.g.market.boosts.length).toBeGreaterThan(0);
    const b = newWorld(5, FOUNDER); while (b.sim.g.clock.date <= '1933-03-12') b.sim.stepDay(); expect(b.sim.g.market.boosts.some(x => x.from === 'bank_holiday' && x.mult < 0.6)).toBe(true); });
});
describe('five years of ordinary play', () => {
  it('runs to the end, the same every time, and keeps the books straight', () => { const run = (seed: number) => { const w = newWorld(seed, FOUNDER), log = runBot(w, 1826); return { log, g: w.sim.g }; };
    const a = run(1930), b = run(1930); expect(save(a.g)).toBe(save(b.g)); expect(a.log.inquiries).toBeGreaterThan(15);
    const sum = a.g.ledger.entries.reduce((t, e) => t + e.amount, 0); expect(Math.abs(DATA.people.founderBackgrounds.coachbuilder!.cash + sum - a.g.ledger.cash)).toBeLessThan(0.01); });
  it('a save in the middle continues exactly', () => { const a = newWorld(77, FOUNDER); runBot(a, 400); const b = openWorld(load(save(a.sim.g))); for (let i = 0; i < 200; i++) { a.sim.stepDay(); b.sim.stepDay(); } expect(save(b.sim.g)).toBe(save(a.sim.g)); });
});
