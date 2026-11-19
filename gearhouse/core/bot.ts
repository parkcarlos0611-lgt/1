// A plain player for long unattended runs (the five-year test and balance work): keeps an advert in the paper,
// answers inquiries it can supply, orders materials, builds, delivers. It makes no clever choices on purpose:
// the question it answers is whether an ordinary way of playing survives.
import { addDays } from './calendar';
import type { Incident } from './state';
import type { World } from './world';
import { makePerson, firstImpression } from './people';
import { DATA } from './world';

export interface BotLog { inquiries: number; quoted: number; orders: number; delivered: number; lost: number; cannotPay: number; satisfaction: number[]; bankruptDate?: string; minCash: number }

export function runBot(w: World, days: number, opt: { hire?: boolean; advert?: boolean } = {}): BotLog {
  const { sim, supply, shop, sales, media } = w, g = sim.g, log: BotLog = { inquiries: 0, quoted: 0, orders: 0, delivered: 0, lost: 0, cannotPay: 0, satisfaction: [], minCash: g.ledger.cash };
  const price = (part: string) => DATA.parts.parts[part]!.price, asked = new Set<string>();
  for (const [id, t] of [['std_body', 'body_only'], ['std_bought', 'bought'], ['std_built', 'built']] as const) if (!g.shop.designs[id]) shop.addDesign({ id, name: id, baseCar: 'sedan30', orderType: t, size: 1, effort: { proportion: 0, parts: 0, panels: 0 } });
  supply.directory(); if (!g.market.inquiries.length) sales.firstCustomer();
  const designFor = (ot: string) => (ot === 'body_only' ? 'std_body' : ot === 'bought' ? 'std_bought' : 'std_built');
  const canSupply = (designId: string) => Object.keys(shop.bom(g.shop.designs[designId]!)).every(p => supply.sellers(p).length > 0);
  const active = () => g.market.orders.filter(o => o.state === 'building').length;
  const workPerDay = () => 10 + 9 * g.employees.length;
  const stockUp = () => { const need: Record<string, number> = {}; for (const o of g.market.orders) if (o.state === 'building' && !g.shop.cars.some(c => g.shop.builds.find(b => b.id === c.buildId)?.orderId === o.id)) for (const [p, n] of Object.entries(shop.bom(g.shop.designs[o.designId]!))) need[p] = (need[p] ?? 0) + n;
    const bySupplier: Record<string, { part: string; qty: number; grade: number }[]> = {};
    for (const [p, n] of Object.entries(need)) { const have = supply.stock(p) + supply.coming(p), key = p + ':' + g.market.orders.length; if (have >= n - 1e-9 || asked.has(key)) continue; const s = supply.sellers(p)[0]; if (!s) continue; asked.add(key); (bySupplier[s.id] ??= []).push({ part: p, qty: Math.ceil(n - have), grade: s.line.grade }); }
    for (const [id, lines] of Object.entries(bySupplier)) supply.inquire(id, lines, supply.sellers(lines[0]!.part).find(x => x.id === id)!.mailDays === 0 ? 'visit' : 'mail'); };
  const handle = (it: Incident) => { const P = it.payload as Record<string, any>;
    switch (it.kind) {
      case 'newspaper': media.read(P.issueId); media.move(P.issueId, 'gone'); break;
      case 'inquiry': { log.inquiries++; const q = sales.inquiry(P.inquiryId), c = sales.customer(q.customerId), designId = designFor(c.orderType);
        if (active() >= 2 || !canSupply(designId)) { sales.drop(q.id); log.lost++; break; }
        sales.consult(q.id); const v = sales.view(q.id), d = g.shop.designs[designId]!, cost = Object.entries(shop.bom(d)).reduce((t, [p, n]) => t + price(p) * n, 0), hours = shop.buildHours(d);
        const ask = v.budget ? v.budget[1] * 0.96 : cost * 1.25 + hours * 0.85, due = addDays(g.clock.date, Math.ceil((active() + 1) * hours / workPerDay() * 7 / 6 * 1.25) + 16);
        sales.quote(q.id, { designId, price: Math.round(Math.max(ask, cost * 1.15 + hours * 0.5) / 5) * 5, due, depositRate: 0.3, meets: v.mustHave ?? [] }); log.quoted++; break; }
      case 'quote_answer': { const q = sales.inquiry(P.inquiryId);
        if (P.answer === 'haggle') { const d = g.shop.designs[q.quote!.designId]!, floor = Object.entries(shop.bom(d)).reduce((t, [p, n]) => t + price(p) * n, 0) * 1.1 + shop.buildHours(d) * 0.4; if (q.counter!.price >= floor) { sales.acceptCounter(q.id); sim.resolve(it.id, 'accept'); } else { sales.drop(q.id); log.lost++; sim.resolve(it.id, 'drop'); break; } }
        else if (P.answer === 'reject') { log.lost++; break; }
        const ord = g.market.orders.at(-1)!; log.orders++; shop.startBuild(ord.designId, ord.id); stockUp();
        if (opt.hire !== false && g.employees.length < 2 && g.ledger.cash > 450 + 300 * g.employees.length && active() >= 1) { const p = makePerson(sim.rng, DATA.names, DATA.people, +g.clock.date.slice(0, 4), { age: sim.rng.int(19, 40), level: sim.rng.int(40, 60) }); sim.hire(p, 18 + Math.round(Math.max(...Object.values(p.skills)) / 5), firstImpression(sim.rng, p, DATA.people.skills)); }
        break; }
      case 'supplier_quote': { const q = supply.quote(P.quoteId), total = q.lines.reduce((t, l) => t + l.qty * l.unitPrice, 0); if (g.ledger.cash >= total) { supply.order(q.id); sim.resolve(it.id, 'order'); } break; }
      case 'car_built': { const b = g.shop.builds.find(x => g.shop.cars.find(c => c.id === P.carId)!.buildId === x.id)!, ord = g.market.orders.find(o => o.id === b.orderId); if (!ord || ord.state !== 'building') break;
        let r = sales.deliver(ord.id, P.carId); if ('cannotPay' in r) { log.cannotPay++; sim.resolve(r.cannotPay.id, 'discount'); r = sales.settle(ord.id, 'discount')!; }
        log.delivered++; log.satisfaction.push((r as { satisfaction: number }).satisfaction); if (g.employees.length && active() === 0) sim.dismiss(g.employees[0]!.personId, 'no work'); break; }
      case 'stock_short': stockUp(); break;
    } };
  let adUntil = '';
  for (let i = 0; i < days; i++) {
    if (opt.advert !== false && g.clock.date >= adUntil && g.ledger.cash > 60) { sales.placeAdvert('classified', 4); adUntil = addDays(g.clock.date, 28); }
    for (const it of sim.stepDay().stops) handle(it);
    log.minCash = Math.min(log.minCash, g.ledger.cash); if (g.ledger.cash < -200 && !log.bankruptDate) { log.bankruptDate = g.clock.date; break; }
  }
  return log;
}
