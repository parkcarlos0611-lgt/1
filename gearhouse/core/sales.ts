// Customers, orders and reputation (system design 02, the slice's core). An inquiry is a person with a budget and
// wants that are only partly shown; the player consults, quotes, haggles, builds and delivers; how pleased the
// customer is moves reputation in five fields and brings the next inquiries.
import { addDays, daysBetween, parts as dateParts, type DateStr } from './calendar';
import { post } from './ledger';
import { fullName, makePerson, type NameData, type PeopleData } from './people';
import type { Api, Simulation, System } from './sim';
import type { OrderType, Shop } from './build';
import type { Incident } from './state';
import { compose, type TextMemory, type TextSet } from './text';

export type Field = 'quality' | 'performance' | 'style' | 'trust' | 'value';
export interface CustomerType { id: string; weight: number; age: [number, number]; standing: [number, number]; budget: Record<OrderType, [number, number]>; orderTypes: Record<OrderType, number>; bodies: string[]; priorities: Field[]; temper: [number, number]; patience: [number, number] }
export interface SalesData { customerTypes: CustomerType[]; mustHaves: string[]; rates: { adClassified: number; adEighth: number; adQuarter: number; walkInPerAwareness: number; phoneBonus: number }; adCost: { classified: number; eighth: number; quarter: number };
  mailDays: number; depositRate: [number, number]; maxRounds: number; satisfaction: Record<'spec' | 'quality' | 'performance' | 'delivery' | 'value' | 'qualityMid', number>; breakdownPerDayPerDefect: number; warrantyDays: number;
  /** satisfaction from which a customer sends friends */ pleasedAt: number;
  /** how much the average reputation moves the number of inquiries: at +100 they are multiplied by 1 + this */ reputationPull: number }
export interface EconomyData { demand: Record<string, number>; cannotPay: Record<string, number> }
export type Source = 'ad' | 'referral' | 'walk_in' | 'first';
export type Channel = 'visit' | 'mail' | 'phone';
export interface Customer { id: number; personId: string; type: string; standing: number; budget: [number, number]; orderType: OrderType; body: string; priorities: Field[]; mustHave: string[];
  /** days from the inquiry by which the car is wanted */
  wantDays: number; patience: number; temper: number; channel: Channel; source: Source; referredBy?: string;
  /** the bank this customer keeps their money in (town register) */ bankId?: string }
export interface Inquiry { id: number; customerId: number; received: DateStr; letter: string; revealed: { budget: boolean; mustHave: boolean }; rounds: number; state: 'open' | 'quoted' | 'ordered' | 'lost'; quote?: QuoteOffer; counter?: { price: number; due: DateStr } }
export interface QuoteOffer { designId: string; price: number; due: DateStr; depositRate: number; rough?: boolean; meets: string[] }
export interface Order { id: number; customerId: number; inquiryId: number; designId: string; price: number; deposit: number; placed: DateStr; due: DateStr; meets: string[]; state: 'building' | 'delivered' | 'cancelled'; lateTold?: boolean; payDelayUntil?: DateStr; carId?: number }
export interface SoldCar { carId: number; orderId: number; customerId: number; delivered: DateStr; satisfaction: number }
export interface Advert { medium: string; size: 'classified' | 'eighth' | 'quarter'; from: DateStr; until: DateStr }
export interface MarketState { awareness: { town: number; city: number; state: number; nation: number }; reputation: Record<Field, number>; customers: Record<number, Customer>; inquiries: Inquiry[]; orders: Order[]; sold: SoldCar[]; adverts: Advert[];
  /** passing changes in demand that the papers warned of */ boosts: { until: DateStr; mult: number; from: string }[];
  pending: { due: DateStr; kind: 'answer' | 'referral'; inquiryId?: number; by?: string }[]; nextId: number; text: TextMemory }
export const newMarket = (): MarketState => ({ awareness: { town: 8, city: 0, state: 0, nation: 0 }, reputation: { quality: 0, performance: 0, style: 0, trust: 0, value: 0 }, customers: {}, inquiries: [], orders: [], sold: [], adverts: [], boosts: [], pending: [], nextId: 1, text: {} });

const BODY_KO: Record<string, string> = { sedan: '4인승 세단', coupe: '쿠페', limousine: '리무진', town_car: '타운카', pickup: '짐칸 트럭', delivery: '배달차', roadster: '2인승 로드스터', cabriolet: '카브리올레' };
const MUST_KO: Record<string, string> = { closed_roof: '닫힌 지붕', folding_top: '접이식 지붕', dark_colour: '짙은 색', two_tone: '투톤 도장', four_seats: '네 사람 자리', big_boot: '큰 짐칸', high_clearance: '높은 지상고', quiet: '조용한 실내', fast: '빠른 속도', sidemount_spare: '옆에 다는 예비 바퀴' };
const SEASON_KO = ['겨울', '겨울', '봄', '봄', '봄', '여름', '여름', '여름', '가을', '가을', '가을', '겨울'];
const lerp = (r: [number, number], t: number) => r[0] + (r[1] - r[0]) * t, clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Sales {
  constructor(private sim: Simulation, private data: SalesData, private eco: EconomyData, private names: NameData, private people: PeopleData, private shop: Shop, private letters: TextSet, private where: { town: string; paper: string }) {}
  /** the town's banks, once the register is there: where a customer banks, and whether that bank has closed */
  banks?: { pick(rng: Api['rng']): string | undefined; closed(id: string): boolean };
  private get M() { return this.sim.g.market; }
  private year(d: DateStr) { return String(dateParts(d).year); }
  customer(id: number): Customer { return this.M.customers[id]!; }
  inquiry(id: number): Inquiry { const q = this.M.inquiries.find(i => i.id === id); if (!q) throw new Error('no inquiry ' + id); return q; }

  /** a new customer walks into the story: who they are, what they want, and the letter (or talk) that says part of it */
  private arrive(a: Api, source: Source, o: { type?: string; orderType?: OrderType; referredBy?: string; channel?: Channel } = {}): Inquiry { const M = this.M, r = a.rng, year = dateParts(a.date).year;
    const types = this.data.customerTypes, T = o.type ? types.find(t => t.id === o.type)! : (() => { let x = r.float() * types.reduce((s, t) => s + t.weight, 0); for (const t of types) { x -= t.weight; if (x <= 0) return t; } return types[0]!; })();
    const ot = o.orderType ?? (() => { const e = Object.entries(T.orderTypes) as [OrderType, number][]; let x = r.float() * e.reduce((s, v) => s + v[1], 0); for (const [k, w] of e) { x -= w; if (x <= 0) return k; } return e[0]![0]; })();
    const p = makePerson(r, this.names, this.people, year, { age: r.int(T.age[0], T.age[1]), sex: r.float() < 0.9 ? 'm' : 'f' }); a.g.people[p.id] = p;
    const wealth = r.float(), mid = lerp(T.budget[ot], wealth) * (0.85 + 0.15 * (this.eco.demand[this.year(a.date)] ?? 1)), must: string[] = []; for (let i = r.int(0, 2); i > 0; i--) { const m = this.data.mustHaves[r.int(0, this.data.mustHaves.length - 1)]!; if (!must.includes(m)) must.push(m); }
    const c: Customer = { id: M.nextId++, personId: p.id, type: T.id, standing: Math.round(lerp(T.standing, r.float())), budget: [Math.round(mid * 0.85), Math.round(mid * 1.1)], orderType: ot, body: T.bodies[r.int(0, T.bodies.length - 1)]!, priorities: T.priorities, mustHave: must,
      wantDays: r.int(45, 120), patience: r.int(T.patience[0], T.patience[1]), temper: lerp(T.temper, r.float()), channel: o.channel ?? (source === 'walk_in' || source === 'first' ? 'visit' : a.g.supply.phone && r.float() < 0.4 ? 'phone' : r.float() < 0.3 ? 'visit' : 'mail'), source, referredBy: o.referredBy };
    c.bankId = this.banks?.pick(r); if (!c.bankId) delete c.bankId;
    M.customers[c.id] = c;
    const founder = a.g.founderId ? a.g.people[a.g.founderId] : undefined, formal = c.standing > 70 ? 'high' : c.standing < 42 ? 'low' : 'mid';
    const letter = compose(r, 'inquiry_letter', this.letters, { founder: founder?.family ?? '', shop: (founder?.family ?? '') + ' 공방', town: this.where.town, customer: fullName(p), paper: this.where.paper, friend: o.referredBy ?? '', body: BODY_KO[c.body] ?? c.body, must: MUST_KO[must[0] ?? 'quiet'] ?? '', season: SEASON_KO[(dateParts(addDays(a.date, c.wantDays)).month - 1)]! },
      { formal, job: T.id }, M.text, { ctx: { source: source === 'first' ? 'walk_in' : source } }).text;
    const q: Inquiry = { id: M.nextId++, customerId: c.id, received: a.date, letter, revealed: { budget: false, mustHave: false }, rounds: 0, state: 'open' }; M.inquiries.push(q);
    a.bus.emit('inquiry_received', { inquiryId: q.id, customerId: c.id, source }); a.raise('inquiry', 'decision', { inquiryId: q.id, customer: fullName(p), channel: c.channel, letter }, c.patience); return q; }
  /** the customer every game starts with (walkthrough finding 1) */
  firstCustomer(type = 'doctor', orderType: OrderType = 'body_only'): Inquiry { return this.arrive(this.sim.api(), 'first', { type, orderType }); }

  placeAdvert(size: Advert['size'], weeks: number, medium = 'town_weekly'): void { const a = this.sim.api(); post(a, 'advertising', -this.data.adCost[size] * weeks, medium); this.M.adverts.push({ medium, size, from: a.date, until: addDays(a.date, weeks * 7) }); a.bus.emit('ad_placed', { medium, size, weeks }); }

  /** talk it through: an hour or two of the founder's time may bring out the budget and the must-haves */
  consult(inquiryId: number): Inquiry { const q = this.inquiry(inquiryId), g = this.sim.g, sales = g.founderId ? g.people[g.founderId]!.skills.sales ?? 30 : 30, r = this.sim.rng;
    this.sim.addTask({ id: `consult:${q.id}:${q.rounds}:${g.clock.date}`, label: 'consultation', skill: 'sales', hoursNeeded: 1.5, quiet: true });
    if (r.float() < 0.45 + sales / 180) q.revealed.mustHave = true; if (r.float() < 0.25 + sales / 160) q.revealed.budget = true; return q; }
  /** what the player may see of a customer */
  view(inquiryId: number): { name: string; type: string; body: string; orderType: OrderType; letter: string; budget?: [number, number]; mustHave?: string[]; wantBy: DateStr } { const q = this.inquiry(inquiryId), c = this.customer(q.customerId);
    return { name: fullName(this.sim.g.people[c.personId]!), type: c.type, body: c.body, orderType: c.orderType, letter: q.letter, budget: q.revealed.budget ? c.budget : undefined, mustHave: q.revealed.mustHave ? c.mustHave : undefined, wantBy: addDays(q.received, c.wantDays) }; }

  /** send a quote; the answer comes back by the way the customer wrote */
  quote(inquiryId: number, offer: QuoteOffer): void { const q = this.inquiry(inquiryId), c = this.customer(q.customerId); if (q.state === 'ordered' || q.state === 'lost') throw new Error('inquiry is closed');
    if (q.rounds > this.data.maxRounds) throw new Error('the customer will not haggle further'); q.quote = offer; q.state = 'quoted'; q.counter = undefined;
    this.M.pending.push({ due: addDays(this.sim.g.clock.date, c.channel === 'mail' ? this.data.mailDays * 2 : 0), kind: 'answer', inquiryId }); }
  /** take the customer's counter-offer as it stands */
  acceptCounter(inquiryId: number): Order { const q = this.inquiry(inquiryId); if (!q.counter || !q.quote) throw new Error('no counter-offer'); return this.book(this.sim.api(), q, { ...q.quote, price: q.counter.price, due: q.counter.due }); }
  drop(inquiryId: number): void { this.inquiry(inquiryId).state = 'lost'; }

  private chance(c: Customer, o: QuoteOffer, received: DateStr): number { const M = this.M, g = this.sim.g, over = o.price / c.budget[1], late = (daysBetween(received, o.due) - c.wantDays) / 30, missed = c.mustHave.filter(m => !o.meets.includes(m)).length;
    const rep = c.priorities.reduce((s, f, i) => s + M.reputation[f] * [0.5, 0.3, 0.2][i]!, 0) / 100, sales = g.founderId ? (g.people[g.founderId]!.skills.sales ?? 30) / 100 : 0.3;
    let p = 0.78 - Math.max(0, over - 0.92) * 3.2 - Math.max(0, late) * 0.22 - missed * 0.3 + rep * 0.25 + (sales - 0.3) * 0.2 - (o.rough ? 0.05 : 0); if (over > 1.25) p -= 0.5; return clamp(p, 0.01, 0.97); }
  private book(a: Api, q: Inquiry, o: QuoteOffer): Order { const deposit = Math.round(o.price * o.depositRate), ord: Order = { id: this.M.nextId++, customerId: q.customerId, inquiryId: q.id, designId: o.designId, price: o.price, deposit, placed: a.date, due: o.due, meets: o.meets, state: 'building' };
    q.state = 'ordered'; this.M.orders.push(ord); post(a, 'deposit', deposit, 'order ' + ord.id); a.bus.emit('order_placed', { orderId: ord.id, customerId: ord.customerId, price: ord.price }); return ord; }

  /** hand the car over: the balance is paid (or not), and the customer makes up their mind about it */
  deliver(orderId: number, carId: number): { satisfaction: number } | { cannotPay: Incident } { const a = this.sim.api(), M = this.M, ord = M.orders.find(o => o.id === orderId), car = a.g.shop.cars.find(c => c.id === carId); if (!ord || ord.state !== 'building' || !car) throw new Error('nothing to deliver');
    const c = this.customer(ord.customerId); ord.carId = carId;
    const lostBank = !!c.bankId && !!this.banks?.closed(c.bankId);                                  // their bank has shut: the money is locked up
    if (!ord.payDelayUntil && a.rng.float() < (this.eco.cannotPay[this.year(a.date)] ?? 0.05) * (c.type === 'banker' || c.type === 'heir' ? 1.4 : 1) + (lostBank ? 0.5 : 0)) {       // the Depression reaches the customer
      ord.payDelayUntil = a.date; a.bus.emit('customer_cannot_pay', { orderId }); return { cannotPay: a.raise('customer_cannot_pay', 'decision', { orderId, customer: fullName(a.g.people[c.personId]!), owed: ord.price - ord.deposit }, 21) }; }
    return this.handOver(a, ord, 1); }
  /** the player's answer when a customer cannot pay: wait a month or two, take less, or keep the deposit and the car */
  settle(orderId: number, choice: 'wait' | 'discount' | 'keep_deposit'): { satisfaction: number } | null { const a = this.sim.api(), ord = this.M.orders.find(o => o.id === orderId)!;
    if (choice === 'keep_deposit') { ord.state = 'cancelled'; this.bump('trust', -3, a); return null; }
    if (choice === 'wait') { ord.payDelayUntil = addDays(a.date, a.rng.int(30, 60)); ord.due = ord.payDelayUntil; this.bump('trust', 2, a); return null; }
    return this.handOver(a, ord, 0.8); }
  private handOver(a: Api, ord: Order, share: number): { satisfaction: number } { const M = this.M, c = this.customer(ord.customerId), car = a.g.shop.cars.find(x => x.id === ord.carId)!, W = this.data.satisfaction;
    const balance = Math.round((ord.price - ord.deposit) * share * 100) / 100; post(a, 'balance', balance, 'order ' + ord.id);
    const d = a.g.shop.designs[ord.designId]!, missed = c.mustHave.filter(m => !ord.meets.includes(m)).length, lateDays = Math.max(0, daysBetween(ord.due, a.date)), seen = car.defects.filter(x => !x.fixed && (x.step === 'paint' || x.step === 'joining' || x.step === 'trim')).length;
    const spec = clamp(1 - missed * 0.6 - (d.orderType === c.orderType ? 0 : 0.4), -1, 1), qual = clamp((car.quality.visible - W.qualityMid) / 30 - seen * 0.25, -1, 1), perf = clamp((car.quality.hidden - W.qualityMid) / 35, -1, 1), del = clamp(1 - lateDays / 20, -1, 1),
      val = clamp((c.budget[1] - ord.price * share) / (c.budget[1] * 0.25) * 0.5 + qual * 0.5, -1, 1);
    const poor = qual < -0.3 ? 0.4 : 1;                                       // a badly made car on time and to order still pleases nobody
    let s = (spec > 0 ? spec * poor : spec) * W.spec + qual * W.quality + perf * W.performance + (del > 0 ? del * poor : del) * W.delivery + val * W.value; if (s < 0) s *= 1 + c.temper * 0.6; s = Math.round(clamp(s, -100, 100));
    ord.state = 'delivered'; M.sold.push({ carId: car.id, orderId: ord.id, customerId: c.id, delivered: a.date, satisfaction: s });
    // what people say afterwards: reputation in the fields this customer cares about, the town knows us a little better
    // Reputation is what people have lately seen of us: each delivery pulls every field part of the way toward what this car showed.
    this.pull('quality', qual * 100, 0.14, a); this.pull('performance', perf * 100, 0.1, a); this.pull('style', qual * 100 * (c.priorities.includes('style') ? 1 : 0.7), 0.1, a);
    this.pull('trust', clamp(del * 60 + (spec < 0 ? -50 : 25), -100, 100), 0.12, a); this.pull('value', val * 100, 0.12, a);
    M.awareness.town = clamp(M.awareness.town + 2 + c.standing / 25, 0, 100); if (M.awareness.town > 60) M.awareness.city = clamp(M.awareness.city + c.standing / 40, 0, 100);
    if (s >= this.data.pleasedAt) for (let n = Math.round(1 + c.standing / 45 * a.rng.float()); n > 0; n--) M.pending.push({ due: addDays(a.date, a.rng.int(10, 70)), kind: 'referral', by: a.g.people[c.personId]!.family });
    a.bus.emit('car_delivered', { orderId: ord.id, carId: car.id, satisfaction: s, standing: c.standing }); return { satisfaction: s }; }
  private pull(f: Field, toward: number, share: number, a: Api): void { this.bump(f, (toward - this.M.reputation[f]) * share, a); }
  private bump(f: Field, by: number, a: Api): void { const M = this.M, v = clamp(M.reputation[f] + by, -100, 100); if (Math.round(v) !== Math.round(M.reputation[f])) a.bus.emit('reputation_changed', { field: f, value: Math.round(v) }); M.reputation[f] = v; }

  system(): System { return { id: 'sales', day: a => this.day(a), evening: a => this.evening(a) }; }
  private day(a: Api): void { const M = this.M, R = this.data.rates, demand = this.eco.demand[this.year(a.date)] ?? 1;
    // answers to quotes, and friends of pleased customers
    const due = M.pending.filter(p => p.due <= a.date); M.pending = M.pending.filter(p => p.due > a.date);
    for (const p of due) { if (p.kind === 'referral') { if (a.workday && a.rng.float() < demand) this.arrive(a, 'referral', { referredBy: p.by }); continue; }
      const q = this.inquiry(p.inquiryId!), c = this.customer(q.customerId), o = q.quote!; if (q.state !== 'quoted') continue; const ch = this.chance(c, o, q.received), roll = a.rng.float(), name = fullName(a.g.people[c.personId]!);
      if (roll < ch) { const ord = this.book(a, q, o); a.raise('quote_answer', 'notice', { inquiryId: q.id, customer: name, answer: 'accept', orderId: ord.id }); }
      else if (roll < ch + (1 - ch) * 0.6 && q.rounds < this.data.maxRounds) { q.rounds++; q.state = 'open';               // haggles: a lower price, or an earlier day
        q.counter = { price: Math.round(Math.min(o.price * (0.9 + a.rng.float() * 0.06), c.budget[1]) / 5) * 5, due: daysBetween(q.received, o.due) > c.wantDays ? addDays(q.received, c.wantDays + 7) : o.due };
        a.raise('quote_answer', 'decision', { inquiryId: q.id, customer: name, answer: 'haggle', counter: q.counter }, c.patience); }
      else { q.state = 'lost'; a.raise('quote_answer', 'notice', { inquiryId: q.id, customer: name, answer: 'reject' }); } }
    if (!a.workday) return;                                                                 // no post and no callers on a day off
    // new inquiries: adverts running in the paper, and people who know of us in town
    const phone = a.g.supply.phone ? R.phoneBonus : 1; let perWeek = M.awareness.town * R.walkInPerAwareness;
    for (const ad of M.adverts) if (ad.from <= a.date && a.date < ad.until) perWeek += (ad.size === 'classified' ? R.adClassified : ad.size === 'eighth' ? R.adEighth : R.adQuarter) * phone;
    M.boosts = M.boosts.filter(b => b.until > a.date); for (const b of M.boosts) perWeek *= b.mult;
    const rep = Object.values(M.reputation).reduce((t, v) => t + v, 0) / 500; perWeek *= clamp(1 + rep * this.data.reputationPull, 0.25, 3);     // a good name brings callers, a bad one keeps them away
    if (a.rng.float() < perWeek * demand / 6) this.arrive(a, a.rng.float() < 0.25 ? 'walk_in' : M.adverts.some(ad => ad.from <= a.date && a.date < ad.until) ? 'ad' : 'walk_in');
    // inquiries left unanswered are lost when the customer's patience runs out
    for (const q of M.inquiries) if ((q.state === 'open') && daysBetween(q.received, a.date) > this.customer(q.customerId).patience + q.rounds * 10) { q.state = 'lost'; this.bump('trust', -1, a); } }
  private evening(a: Api): void { const M = this.M;
    for (const ord of M.orders) if (ord.state === 'building' && !ord.lateTold && a.date > ord.due) { ord.lateTold = true; a.raise('order_late', 'decision', { orderId: ord.id, due: ord.due }, 30); }
    // cars sold in the last year can break down where a fault was left in
    for (const sc of M.sold) { if (daysBetween(sc.delivered, a.date) > this.data.warrantyDays) continue; const car = a.g.shop.cars.find(c => c.id === sc.carId)!;
      for (const df of car.defects) if (!df.found && !df.fixed && a.rng.float() < this.data.breakdownPerDayPerDefect) { df.found = true; sc.satisfaction = clamp(sc.satisfaction - 12 * df.severity, -100, 100); this.pull('trust', -60, 0.04 * df.severity, a); this.pull('quality', -50, 0.03 * df.severity, a);
        a.bus.emit('car_broke_down', { carId: car.id, kind: df.kind, severity: df.severity }); a.raise('car_broke_down', 'decision', { carId: car.id, orderId: sc.orderId, kind: df.kind, severity: df.severity, step: df.step }, 14); } }
    if (dateParts(addDays(a.date, 1)).day === 1) { M.awareness.town = Math.max(0, M.awareness.town - 0.6); M.awareness.city = Math.max(0, M.awareness.city - 0.4); }   // people forget
  }
}
