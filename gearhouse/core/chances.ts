// Chances the papers bring (review 09, chapter 3-3): a county tender, a motor show, a supplier's clearance sale,
// an auction of a closed workshop's tools. The article carries no mark; the reader has to act before the last day.
// A chance that was never read passes, and the journal says the paper had it.
import { addDays, type DateStr } from './calendar';
import { post } from './ledger';
import type { ChanceKind } from './news';
import type { Api, Simulation, System } from './sim';
import type { Sales } from './sales';
import type { Supply } from './supply';

export interface Chance { id: number; kind: ChanceKind; issueId: number; headline: string; importance: number; opened: DateStr; deadline: DateStr;
  state: 'open' | 'entered' | 'won' | 'lost' | 'done' | 'missed';
  supplierId?: string; /** cars asked for in a tender */ cars?: number;
  /** what the player put in: a price per car and a design, a car to show, a bid */ price?: number; designId?: string; carId?: number; bid?: number; fee?: number;
  /** the day the outcome is known */ resolves?: DateStr }
export interface ChanceData { tender: { refPrice: [number, number]; buildDaysPerCar: number; deposit: number; hours: number };
  show: { fee: number[]; awareness: number[]; prizeAt: number; hours: number }; clearance: { mult: number[]; graceDays: number }; auction: { value: number[]; tools: number[]; maxBonus: number; hours: number } }
const at = (a: number[], importance: number) => a[Math.min(a.length - 1, importance - 1)]!, clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class Chances {
  constructor(private sim: Simulation, private data: ChanceData, private sales: Sales, private supply: Supply, private note: (importance: number, headline: string, id: string) => void) {}
  private get S() { return this.sim.g.media; }
  private read(c: Chance): boolean { return !!this.S.copies.find(x => x.issueId === c.issueId)?.read; }
  /** the chances the player knows of: still open, and from a paper that was read */
  open(): Chance[] { return this.S.chances.filter(c => c.state === 'open' && this.read(c)); }
  get(id: number): Chance { const c = this.S.chances.find(x => x.id === id); if (!c) throw new Error('no chance ' + id); return c; }
  private take(id: number, kind: ChanceKind): Chance { const c = this.get(id), today = this.sim.g.clock.date; if (c.kind !== kind) throw new Error(`chance ${id} is a ${c.kind}`); if (c.state !== 'open') throw new Error('that chance is ' + c.state);
    if (!this.read(c)) throw new Error('the paper that had it was not read'); if (today > c.deadline) throw new Error('too late'); return c; }
  private work(c: Chance, hours: number) { this.sim.addTask({ id: `chance:${c.id}`, label: c.kind, skill: 'sales', hoursNeeded: hours, quiet: true }); }

  /** bid for a public tender: a price per car and the design to build */
  bid(id: number, designId: string, price: number): Chance { const c = this.take(id, 'tender'), a = this.sim.api(); if (!a.g.shop.designs[designId]) throw new Error('unknown design ' + designId);
    c.designId = designId; c.price = price; c.state = 'entered'; c.resolves = addDays(c.deadline, a.rng.int(3, 10)); this.work(c, this.data.tender.hours); return c; }
  /** enter a car in a show: one still in the shop, or one a pleased owner will lend */
  enter(id: number, carId: number): Chance { const c = this.take(id, 'show'), a = this.sim.api(), sold = a.g.market.sold.find(s => s.carId === carId); if (!a.g.shop.cars.some(x => x.id === carId)) throw new Error('no car ' + carId);
    if (sold && sold.satisfaction < 30) throw new Error('the owner will not lend it'); c.carId = carId; c.fee = at(this.data.show.fee, c.importance); post(a, 'show_fee', -c.fee, c.headline);
    c.state = 'entered'; c.resolves = addDays(c.deadline, a.rng.int(7, 21)); this.work(c, this.data.show.hours); return c; }
  /** write to the supplier about the clearance: their prices are cut until a few days after the last day */
  clear(id: number): Chance { const c = this.take(id, 'clearance'), a = this.sim.api(), st = c.supplierId ? a.g.supply.suppliers[c.supplierId] : undefined; if (!st || !c.supplierId) throw new Error('no supplier');
    this.supply.discover(c.supplierId, 'clearance'); st.priceMult = at(this.data.clearance.mult, c.importance); st.priceUntil = addDays(c.deadline, this.data.clearance.graceDays); c.state = 'done'; return c; }
  /** bid at an auction of tools; the hammer falls on the last day */
  auction(id: number, bid: number): Chance { const c = this.take(id, 'auction'); if (!(bid > 0)) throw new Error('a bid must be more than nothing'); c.bid = bid; c.state = 'entered'; c.resolves = c.deadline; this.work(c, this.data.auction.hours); return c; }

  system(): System { return { id: 'chances', morning: a => this.morning(a) }; }
  private morning(a: Api): void { const D = this.data, g = a.g, M = g.market;
    for (const c of this.S.chances) {
      if (c.state === 'open' && a.date > c.deadline) { c.state = 'missed'; a.log(this.read(c) ? `기회를 흘려보냈다: “${c.headline}”` : `그때 신문에 났었다: “${c.headline}”`); continue; }
      if (c.state !== 'entered' || !c.resolves || c.resolves > a.date) continue;
      if (c.kind === 'tender') { const ref = D.tender.refPrice[0] + (D.tender.refPrice[1] - D.tender.refPrice[0]) * a.rng.float(), name = (M.reputation.trust + M.reputation.quality) / 200;
        const p = clamp(0.55 - (c.price! / ref - 1) * 2.5 + name * 0.3 + M.awareness.town / 100 * 0.15, 0.02, 0.95), won = a.rng.float() < p;
        if (won) { const due = addDays(a.date, 45 + D.tender.buildDaysPerCar * c.cars!), orders = this.sales.bookFor({ type: 'county', standing: 70, body: 'sedan', mustHave: ['four_seats', 'closed_roof'] }, { designId: c.designId!, price: c.price!, due, depositRate: D.tender.deposit, meets: ['four_seats', 'closed_roof'] }, c.cars!);
          c.state = 'won'; this.note(4, '읍내 공방, 관청 자동차 납품 따내', 'tender:' + c.id); a.raise('tender_result', 'notice', { chanceId: c.id, won: true, cars: c.cars, price: c.price, due, orderIds: orders.map(o => o.id) }); }
        else { c.state = 'lost'; a.raise('tender_result', 'notice', { chanceId: c.id, won: false }); } }
      if (c.kind === 'show') { const car = g.shop.cars.find(x => x.id === c.carId), q = car?.quality.visible ?? 40, gain = at(D.show.awareness, c.importance) * clamp(q / 60, 0.4, 1.6), prize = q >= D.show.prizeAt + (a.rng.float() - 0.5) * 16;
        M.awareness.town = Math.min(100, M.awareness.town + gain); if (c.importance >= 4) M.awareness.city = Math.min(100, M.awareness.city + gain / 2);
        this.sales.exhibit(q, 0.03 * c.importance); if (prize) { this.sales.refer('박람회', 1 + (c.importance >= 5 ? 1 : 0)); this.note(Math.min(6, c.importance + 1), '읍내 공방 차, 박람회서 상 받아', 'prize:' + c.id); }
        c.state = prize ? 'won' : 'done'; a.raise('show_result', 'notice', { chanceId: c.id, prize, awareness: Math.round(gain * 10) / 10, quality: q }); }
      if (c.kind === 'auction') { const value = at(D.auction.value, c.importance) * (0.8 + a.rng.float() * 0.4), rival = value * (0.5 + a.rng.float() * 0.7), won = c.bid! >= rival && g.ledger.cash >= c.bid!;
        if (won) { post(a, 'tools', -c.bid!, c.headline); g.shop.toolBonus = Math.min(D.auction.maxBonus, (g.shop.toolBonus ?? 0) + at(D.auction.tools, c.importance)); }
        c.state = won ? 'won' : 'lost'; a.raise('auction_result', 'notice', { chanceId: c.id, won, bid: c.bid, tools: g.shop.toolBonus ?? 0 }); } } }
}
