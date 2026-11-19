import { describe, expect, it } from 'vitest';
import { DATA, newWorld, openWorld } from '../core/world';
import { runBot } from '../core/bot';
import { load, save } from '../core/state';
import type { Incident } from '../core/state';
import { active, begin, mult, plus, type Condition } from '../core/conditions';
import type { Chance } from '../core/chances';
import type { ChanceKind } from '../core/news';

const FOUNDER = { background: 'coachbuilder', age: 31, given: 'Walter', family: 'Hoffman' }, FAR = '1939-01-01';
type W = ReturnType<typeof newWorld>;
function until(w: W, kind: string, max = 300): Incident { for (let i = 0; i < max; i++) { const hit = w.sim.stepDay().stops.find(x => x.kind === kind); if (hit) return hit; } throw new Error('never saw ' + kind); }
const cond = (w: W, c: Partial<Condition> & Pick<Condition, 'kind' | 'value'>) => begin(w.sim.g, { until: FAR, from: 'test', ...c });
const days = (w: W, n: number) => { for (let i = 0; i < n; i++) w.sim.stepDay(); };
/** a chance as a paper would have printed it, in a paper that was read (or not) */
function chance(w: W, kind: ChanceKind, o: Partial<Chance> = {}, read = true): Chance { const S = w.sim.g.media, today = w.sim.g.clock.date, issueId = 9000 + S.chances.length; S.copies.push({ issueId, place: 'desk', read, marked: false });
  const c: Chance = { id: 8000 + S.chances.length, kind, issueId, headline: '시험 기사', importance: 4, opened: today, deadline: '1930-01-20', state: 'open', ...o }; S.chances.push(c); return c; }

/** a car already delivered to a customer who wanted that kind of body */
function delivered(w: W, body: string): void { const g = w.sim.g, M = g.market, id = 7000 + M.sold.length; M.customers[id] = { ...w.sales.customer(w.sales.firstCustomer().customerId), id, body };
  g.shop.cars.push({ id, buildId: 0, designId: 'patrol', built: g.clock.date, quality: { visible: 60, hidden: 60 }, defects: [], cost: 0, ownHours: 0 }); M.sold.push({ carId: id, orderId: -1, customerId: id, delivered: g.clock.date, satisfaction: 50 }); }
describe('passing conditions', () => {
  it('multiply or add by key, end on their day, and hold two of a kind at most', () => { const w = newWorld(1, FOUNDER), g = w.sim.g;
    expect(mult(g, 'budget', 'farmer')).toBe(1); cond(w, { kind: 'budget', key: 'farmer', value: 1.2 }); cond(w, { kind: 'budget', value: 0.9 });
    expect(mult(g, 'budget', 'farmer')).toBeCloseTo(1.08); expect(mult(g, 'budget', 'doctor')).toBeCloseTo(0.9);
    expect(cond(w, { kind: 'budget', value: 0.95 })).toBe(false); /* weaker than both that hold */ expect(cond(w, { kind: 'budget', value: 0.6 })).toBe(true); /* stronger: the weakest gives way */
    expect(active(g, 'budget').map(c => c.value).sort()).toEqual([0.6, 1.2]);
    cond(w, { kind: 'cannot_pay', value: 0.05, until: '1930-01-05' }); expect(plus(g, 'cannot_pay')).toBeCloseTo(0.05); days(w, 6); expect(plus(g, 'cannot_pay')).toBe(0); });
  it('change who comes, what they can spend and what they ask for', () => { const w = newWorld(4, FOUNDER), g = w.sim.g; g.market.awareness.town = 100; w.sales.placeAdvert('quarter', 60);
    cond(w, { kind: 'demand_type', key: 'farmer', value: 60 }); cond(w, { kind: 'want', key: 'high_clearance', value: 1 }); cond(w, { kind: 'budget', key: 'farmer', value: 0.7 }); days(w, 250);
    const cs = Object.values(g.market.customers), farmers = cs.filter(c => c.type === 'farmer'); expect(cs.length).toBeGreaterThan(10); expect(farmers.length / cs.length).toBeGreaterThan(0.8);
    expect(cs.every(c => c.mustHave.includes('high_clearance'))).toBe(true);
    const plain = newWorld(4, FOUNDER); plain.sim.g.market.awareness.town = 100; plain.sales.placeAdvert('quarter', 60); cond(plain, { kind: 'demand_type', key: 'farmer', value: 60 }); days(plain, 250);
    const avg = (l: { budget: [number, number]; orderType: string }[]) => { const b = l.filter(c => c.orderType === 'body_only'); return b.reduce((t, c) => t + c.budget[1], 0) / b.length; };
    expect(avg(farmers)).toBeLessThan(avg(Object.values(plain.sim.g.market.customers).filter(c => c.type === 'farmer')) * 0.8); });
  it('all demand changes together stay within bounds', () => { const count = (boost: number | null) => { let n = 0; for (let seed = 1; seed <= 6; seed++) { const w = newWorld(seed, FOUNDER), g = w.sim.g; g.market.awareness.town = 100; w.sales.placeAdvert('quarter', 60);
        if (boost) for (let k = 0; k < 2; k++) g.market.boosts.push({ until: FAR, mult: boost, from: 'test' }); for (let i = 0; i < 200; i++) { w.sim.stepDay(); g.market.awareness.town = 100; g.market.reputation = { quality: 0, performance: 0, style: 0, trust: 0, value: 0 }; } n += g.market.inquiries.length; } return n; };
    const base = count(null), up = count(4), down = count(0.1); expect(up / base).toBeGreaterThan(1.25); expect(up / base).toBeLessThan(2); expect(down / base).toBeGreaterThan(0.33); expect(down / base).toBeLessThan(0.75); });
  it('slow the suppliers, spoil the materials, and raise what adverts and power cost', () => { const quote = (setup: (w: W) => void) => { const w = newWorld(2, FOUNDER); setup(w); w.supply.directory(); const s = w.supply.sellers('body_steel_set')[0]!; w.supply.inquire(s.id, [{ part: 'body_steel_set', qty: 1 }], 'mail');
      const id = until(w, 'supplier_quote', 30).payload.quoteId as number, q = w.sim.g.supply.quotes.find(x => x.id === id)!; w.supply.order(q.id); until(w, 'parts_delivered', 120); return { w, lead: q.leadDays, quality: w.sim.g.supply.lots[0]!.quality }; };
    const a = quote(() => {}), b = quote(w => { cond(w, { kind: 'supplier_lead', value: 2 }); cond(w, { kind: 'material_quality', key: 'body_steel_set', value: -40 }); });
    expect(b.lead).toBe(a.lead * 2); expect(b.quality).toBeLessThan(a.quality - 20);
    const late = newWorld(2, FOUNDER); cond(late, { kind: 'supplier_reliability', value: 0 }); late.supply.directory(); const s = late.supply.sellers('glass_set')[0]!; late.supply.inquire(s.id, [{ part: 'glass_set', qty: 1 }], 'mail');
    late.supply.order(until(late, 'supplier_quote', 30).payload.quoteId as number); until(late, 'delivery_delayed', 120);
    const w = newWorld(2, FOUNDER), g = w.sim.g, cost = (kind: string) => g.ledger.entries.filter(e => e.kind === kind).map(e => e.amount);
    w.sales.placeAdvert('eighth', 2); cond(w, { kind: 'ad_cost', value: 1.5 }); cond(w, { kind: 'utilities', value: 2 }); w.sales.placeAdvert('eighth', 2); days(w, 40);
    expect(cost('advertising')).toEqual([-DATA.sales.adCost.eighth * 2, -DATA.sales.adCost.eighth * 3]); expect(cost('utilities')[0]).toBe(-DATA.finance.utilitiesPerMonth * 2); });
  it('come from the papers some weeks later, leave their cause in the journal, and survive a save', () => { let landed = 0, kinds = new Set<string>();
    for (let seed = 1; seed <= 4; seed++) { const w = newWorld(seed, FOUNDER), g = w.sim.g; for (let i = 0; i < 1500; i++) { w.sim.stepDay(); for (const c of g.conditions) kinds.add(c.kind); expect(g.conditions.filter(c => c.kind === 'want' && c.until > g.clock.date).length).toBeLessThanOrEqual(2);
        if (i === 700) { const again = openWorld(load(save(g))); expect(again.sim.g.conditions).toEqual(g.conditions); expect(again.sim.g.media.chances).toEqual(g.media.chances); } }
      landed += g.journal.filter(j => j.text.startsWith('신문에 났던 일이 닥쳤다')).length; }
    expect(landed).toBeGreaterThan(40); expect(kinds.size).toBeGreaterThanOrEqual(7); });
});

describe('chances from the papers', () => {
  it('are printed with a last day, known only to a reader, and noted in the journal when they pass', () => { const seen = new Set<string>();
    for (let seed = 1; seed <= 5; seed++) { const w = newWorld(seed, FOUNDER); days(w, 1800); for (const c of w.sim.g.media.chances) { seen.add(c.kind); expect(c.deadline > c.opened).toBe(true); expect(c.state).toMatch(/missed|open/); if (c.kind === 'tender') expect(c.headline).toMatch(/(두|세|네|다섯|여섯) 대/); if (c.kind === 'clearance') expect(c.supplierId).toBeDefined(); }
      expect(w.chances.open()).toEqual([]); /* nothing was read */ expect(w.sim.g.journal.some(j => j.text.startsWith('그때 신문에 났었다'))).toBe(true); }
    expect([...seen].sort()).toEqual(['auction', 'clearance', 'show', 'tender']);
    const w = newWorld(1, FOUNDER), unread = chance(w, 'auction', {}, false), read = chance(w, 'auction'); expect(() => w.chances.auction(unread.id, 50)).toThrow(/not read/); expect(w.chances.open().map(c => c.id)).toEqual([read.id]);
    days(w, 25); expect(read.state).toBe('missed'); expect(w.sim.g.journal.some(j => j.text.startsWith('기회를 흘려보냈다'))).toBe(true); expect(() => w.chances.auction(read.id, 50)).toThrow(); });
  it('a tender is won on price and name, and brings an order for every car', () => { let won = 0, lost = 0;
    for (let seed = 1; seed <= 12; seed++) { const w = newWorld(seed, FOUNDER), g = w.sim.g; w.shop.addDesign({ id: 'patrol', name: 'patrol', baseCar: 'sedan30', orderType: 'bought', size: 1, effort: { proportion: 0, parts: 0, panels: 0 } });
      const cheap = chance(w, 'tender', { cars: 3 }), dear = chance(w, 'tender', { cars: 3 }), big = chance(w, 'tender', { cars: 5, importance: 5 });
      /* a shop that has only built private cars is not heard */ expect(() => w.chances.bid(cheap.id, 'patrol', 1000)).toThrow(/record/); expect(w.chances.open()).toEqual([]); delivered(w, 'delivery'); expect(w.chances.utilityRecord()).toBe(1);
      expect(w.chances.open().map(c => c.id)).toEqual([cheap.id, dear.id]); expect(() => w.chances.bid(big.id, 'patrol', 1000)).toThrow(/record/); /* a large tender asks for more */ w.chances.bid(cheap.id, 'patrol', 1000); w.chances.bid(dear.id, 'patrol', 2400); const cash = g.ledger.cash; days(w, 35);
      if (cheap.state === 'won') { won++; const mine = g.market.orders.filter(o => o.designId === 'patrol' && o.price === 1000); expect(mine.length).toBe(3); expect(g.ledger.cash).toBeGreaterThan(cash + 600); expect(g.incidents.some(i => i.kind === 'tender_result' && i.payload.won === true)).toBe(true); }
      if (dear.state === 'lost') lost++; }
    expect(won).toBeGreaterThanOrEqual(9); expect(lost).toBeGreaterThanOrEqual(11); });
  it('a show makes the workshop known by the car it sends', () => { const w = newWorld(3, FOUNDER), g = w.sim.g; runBot(w, 500); const car = g.shop.cars.reduce((x, y) => (x.quality.visible >= y.quality.visible ? x : y)); expect(car).toBeDefined();
    const sold = g.market.sold.find(s => s.carId === car.id); if (sold) sold.satisfaction = 80; const c = chance(w, 'show', { deadline: w.sim.g.clock.date, importance: 5 }), town = g.market.awareness.town, cash = g.ledger.cash; g.market.awareness.town = town - 30;
    w.chances.enter(c.id, car.id); expect(g.ledger.cash).toBe(cash - DATA.chances.show.fee[4]!); const res = until(w, 'show_result', 30); expect(g.market.awareness.town).toBeGreaterThan(town - 30 + 3); expect(res.payload.quality).toBe(car.quality.visible); expect(c.state).toMatch(/won|done/);
    if (sold) { sold.satisfaction = -10; const c2 = chance(w, 'show', { deadline: w.sim.g.clock.date }); expect(() => w.chances.enter(c2.id, car.id)).toThrow(/lend/); } });
  it('a clearance cuts one supplier\'s prices until just after the last day', () => { const price = (clear: boolean) => { const w = newWorld(2, FOUNDER); w.supply.directory(); const s = w.supply.sellers('paint_set')[0]!, c = chance(w, 'clearance', { supplierId: s.id, importance: 6, deadline: '1930-01-25' }); if (clear) w.chances.clear(c.id);
      w.supply.inquire(s.id, [{ part: 'paint_set', qty: 1 }], 'mail'); const id = until(w, 'supplier_quote', 30).payload.quoteId as number; return w.sim.g.supply.quotes.find(x => x.id === id)!.lines[0]!.unitPrice; };
    expect(price(true)).toBeCloseTo(price(false) * DATA.chances.clearance.mult[5]!, 1); });
  it('an auction gives better tools to the highest bid', () => { const w = newWorld(5, FOUNDER), g = w.sim.g, high = chance(w, 'auction'), low = chance(w, 'auction'), cash = g.ledger.cash; w.chances.auction(high.id, 300); w.chances.auction(low.id, 1); days(w, 25);
    expect(high.state).toBe('won'); expect(low.state).toBe('lost'); expect(g.shop.toolBonus).toBe(DATA.chances.auction.tools[3]); expect(g.ledger.entries.filter(e => e.kind === 'tools').map(e => e.amount)).toEqual([-300]); expect(cash - g.ledger.cash).toBeGreaterThanOrEqual(300); });
});
