import { describe, expect, it } from 'vitest';
import holidays from '../data/calendar/us.json';
import names from '../data/names/us.json';
import peopleData from '../data/people/us_1930.json';
import finance from '../data/finance/us_1930.json';
import partsData from '../data/parts/us_1930.json';
import suppliers from '../data/suppliers/us_slice.json';
import buildData from '../data/build/steps.json';
import { Simulation } from '../core/sim';
import { load, newGame, save } from '../core/state';
import { makeFounder, makePerson, firstImpression, type PeopleData } from '../core/people';
import { financeSystem } from '../core/ledger';
import { Supply, type SupplyData } from '../core/supply';
import { Shop, type BuildData } from '../core/build';

const PD = peopleData as unknown as PeopleData;
function world(seed = 1, g = newGame(seed)) { const s = new Simulation(g, holidays).use(financeSystem(finance)), supply = new Supply(s, suppliers as SupplyData, partsData), shop = new Shop(s, buildData as unknown as BuildData, supply);
  s.use(supply.system()).use(shop.system());
  if (!g.founderId) s.setFounder(makeFounder(s.rng, names, PD, 1930, { background: 'coachbuilder', age: 31, given: 'Walter', family: 'Hoffman' }), 900);
  return { s, supply, shop }; }
/** play until an incident of that kind stops the game */
function until(s: Simulation, kind: string, max = 200) { for (let i = 0; i < max; i++) { const hit = s.stepDay().stops.find(x => x.kind === kind); if (hit) return hit; } throw new Error('never saw ' + kind); }
const BODY = { id: 'doctor_body', name: 'closed body', baseCar: 'sedan30', orderType: 'body_only' as const, size: 0.95, effort: { proportion: 0.3, parts: 0, panels: 0 } };

describe('suppliers', () => {
  it('answers a visit the same day and a letter after the post', () => { const { s, supply } = world(); supply.inquire('kessler_hardware', [{ part: 'paint_set', qty: 1 }], 'visit');
    s.stepDay(); const q1 = until(s, 'supplier_quote', 3); expect(q1.date).toBe('1930-01-02');
    supply.discover('tri_county_supply', 'advert'); supply.inquire('tri_county_supply', [{ part: 'body_steel_set', qty: 1 }, { part: 'ash_frame_set', qty: 1 }], 'mail');
    const q2 = until(s, 'supplier_quote', 12); expect(q2.date).toBe('1930-01-08'); expect(supply.quote(q2.payload.quoteId as number).lines.length).toBe(2); });   // sent on the 3rd, five days there and back
  it('needs to know a supplier and needs a telephone to call', () => { const { supply } = world(); expect(() => supply.inquire('marlowe_motor', [{ part: 'engine', qty: 1 }], 'mail')).toThrow(); expect(() => supply.inquire('kessler_hardware', [{ part: 'paint_set', qty: 1 }], 'phone')).toThrow(); });
  it('orders, pays, delivers into the store and shows real units', () => { const { s, supply } = world(); supply.inquire('kessler_hardware', [{ part: 'paint_set', qty: 2 }], 'visit'); s.stepDay();
    const q = until(s, 'supplier_quote', 3), cash0 = s.g.ledger.cash, o = supply.order(q.payload.quoteId as number); expect(s.g.ledger.cash).toBe(cash0 - o.total);
    until(s, 'parts_delivered', 20); expect(supply.stock('paint_set')).toBe(2); expect(supply.storeView()[0]).toMatchObject({ part: 'paint_set', sets: 2, units: 12, unit: 'cans' });
    expect(supply.take('paint_set', 1)!.cost).toBe(o.total / 2); expect(supply.take('paint_set', 5)).toBeNull(); });
  it('haggling changes the quote at most twice', () => { const { s, supply } = world(4); supply.inquire('kessler_hardware', [{ part: 'fittings_set', qty: 1 }], 'visit'); s.stepDay(); const q = until(s, 'supplier_quote', 3), id = q.payload.quoteId as number, p0 = supply.quote(id).lines[0]!.unitPrice;
    supply.haggle(id, 'patience'); const r1 = until(s, 'supplier_quote', 5); supply.haggle(id, 'prepay'); const r2 = until(s, 'supplier_quote', 5);
    expect(supply.quote(id).round).toBe(2); expect(() => supply.haggle(id, 'premium')).toThrow(); if (r1.payload.agreed || r2.payload.agreed) expect(supply.quote(id).lines[0]!.unitPrice).toBeLessThan(p0); });
});

describe('design and build', () => {
  it('counts design hours by how far the body departs from its base car', () => { const { shop } = world(); const base = { orderType: 'bought' as const, effort: { proportion: 0, parts: 0, panels: 0 } };
    expect(shop.designHours(base)).toBe(80); expect(shop.designHours({ ...base, effort: { proportion: 1, parts: 2, panels: 3 } })).toBe(Math.round(80 * (1 + 0.3 + 0.14 + 0.54))); expect(shop.designHours({ ...base, orderType: 'built' })).toBe(150); });
  it('totals about 450 hours on a bought chassis and 560 on a built one', () => { const { shop } = world(); const d = (orderType: 'bought' | 'built') => shop.addDesign({ ...BODY, id: orderType, orderType, size: 1 });
    expect(shop.buildHours(d('bought'))).toBe(445); expect(shop.buildHours(d('built'))).toBe(555); expect(shop.bom(d('built'))).toMatchObject({ chassis_steel_set: 1, engine: 1, body_steel_set: 1 }); });
  it('builds a body on a customer chassis from design to car', () => { const { s, supply, shop } = world(2); const stops: string[] = []; s.bus.on('incident_raised', e => stops.push(e.incident.kind));
    shop.startDesign(BODY); const fin = until(s, 'design_finalized', 40); expect(fin.date <= '1930-01-12').toBe(true);
    supply.discover('tri_county_supply', 'advert'); supply.inquire('tri_county_supply', Object.keys(shop.bom(s.g.shop.designs.doctor_body!)).map(part => ({ part, qty: 1 })), 'mail');
    const q = until(s, 'supplier_quote', 12); supply.order(q.payload.quoteId as number); const b = shop.startBuild('doctor_body');
    const car = until(s, 'car_built', 200), c = s.g.shop.cars[0]!;
    expect(stops).toContain('stock_short'); expect(stops.filter(k => k === 'build_step_done').length).toBe(9);          // the mock-up and eight steps (no engine work on a customer's chassis)
    expect(c.buildId).toBe(b.id); expect(c.quality.visible).toBeGreaterThan(45); expect(c.quality.visible).toBeLessThan(85); expect(c.cost).toBeGreaterThan(200); expect(c.ownHours).toBeGreaterThan(300);
    expect(car.date > '1930-02-20' && car.date < '1930-04-15').toBe(true); expect(s.g.shop.designs.doctor_body!.built).toBe(1); expect(Object.keys(s.g.tasks).some(k => k.startsWith('build:'))).toBe(false); });
  it('a helper shortens the build and the second car is quicker', () => { const run = (helper: boolean) => { const { s, supply, shop } = world(3); shop.addDesign(BODY); const d = s.g.shop.designs.doctor_body!;
      for (const part of Object.keys(shop.bom(d))) s.g.supply.lots.push({ part, grade: 2, qty: 2, quality: 65, unitCost: 10, received: s.g.clock.date });
      if (helper) { const p = makePerson(s.rng, names, PD, 1930, { age: 24, level: 55, best: 'panel' }); s.hire(p, 22, firstImpression(s.rng, p, ['panel'])); }
      shop.startBuild('doctor_body'); const first = until(s, 'car_built', 300).date, h1 = shop.buildHours(d); void supply; return { first, h1 }; };
    const alone = run(false), helped = run(true); expect(helped.first < alone.first).toBe(true); expect(alone.h1).toBeLessThan(410 * 0.95 + 1); });
  it('poor hands leave defects', () => { let defects = 0, cars = 0; for (let seed = 1; seed <= 12; seed++) { const { s, shop } = world(seed); const f = s.g.people[s.g.founderId!]!; for (const k of Object.keys(f.skills)) f.skills[k] = 25;
      shop.addDesign(BODY); for (const part of Object.keys(shop.bom(s.g.shop.designs.doctor_body!))) s.g.supply.lots.push({ part, grade: 1, qty: 1, quality: 45, unitCost: 10, received: s.g.clock.date });
      shop.startBuild('doctor_body'); until(s, 'car_built', 500); defects += s.g.shop.cars[0]!.defects.length; cars++; expect(s.g.shop.cars[0]!.quality.visible).toBeLessThan(50); }
    expect(defects / cars).toBeGreaterThan(2); });
  it('saves mid-build and continues exactly', () => { const a = world(6); a.shop.addDesign(BODY); for (const part of Object.keys(a.shop.bom(a.s.g.shop.designs.doctor_body!))) a.s.g.supply.lots.push({ part, grade: 2, qty: 1, quality: 65, unitCost: 10, received: a.s.g.clock.date });
    a.shop.startBuild('doctor_body'); for (let i = 0; i < 30; i++) a.s.stepDay(); const b = world(6, load(save(a.s.g))); for (let i = 0; i < 80; i++) { a.s.stepDay(); b.s.stepDay(); } expect(save(b.s.g)).toBe(save(a.s.g)); expect(a.s.g.shop.cars.length).toBe(1); });
});
