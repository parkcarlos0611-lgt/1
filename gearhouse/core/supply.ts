// Suppliers and stock (system design 03, the slice's core): suppliers are found, asked, haggled with and ordered
// from; replies take as long as the way of contact takes; deliveries can be late and vary in quality.
import { addDays, type DateStr } from './calendar';
import { post } from './ledger';
import type { Api, Simulation, System } from './sim';
import { mult, plus } from './conditions';

export interface CatalogLine { part: string; grade: number; price: number; minOrder: number; leadDays: number }
export interface SupplierData { id: string; name: string; size: string; mailDays: number; knownAtStart: boolean; phone: boolean; reliability: number; consistency: number; temper: number; catalog: CatalogLine[] }
export interface PartsData { gradeQuality: Record<string, number>; parts: Record<string, { price: number; unit: string; perSet: number }> }
export type Via = 'visit' | 'phone' | 'mail';
export type Lever = 'prepay' | 'quantity' | 'patience' | 'premium';
export interface QuoteLine { part: string; grade: number; qty: number; unitPrice: number }
export interface Quote { id: number; supplierId: string; via: Via; lines: QuoteLine[]; leadDays: number; prepaid: boolean; round: number; date: DateStr; state: 'open' | 'ordered' | 'dropped' }
export interface PurchaseOrder { id: number; supplierId: string; lines: QuoteLine[]; placed: DateStr; due: DateStr; paid: boolean; total: number; state: 'coming' | 'delivered'; late?: boolean }
/** a batch in the store: sets of one part and grade, with the quality it really has */
export interface Lot { part: string; grade: number; qty: number; quality: number; unitCost: number; received: DateStr }
interface Pending { due: DateStr; kind: 'reply' | 'haggle'; supplierId: string; via: Via; lines?: { part: string; qty: number; grade?: number }[]; quoteId?: number; lever?: Lever }
export interface SupplyState {
  suppliers: Record<string, { known: boolean; catalogKnown: boolean; relation: number; closed: boolean; /** a passing price change the papers warned of */ priceMult?: number; priceUntil?: DateStr }>;
  pending: Pending[]; quotes: Quote[]; orders: PurchaseOrder[]; lots: Lot[]; nextId: number;
  /** the workshop has a telephone */
  phone: boolean;
}
export interface SupplyData { suppliers: SupplierData[] }

export class Supply {
  constructor(private sim: Simulation, private data: SupplyData, private parts: PartsData) {
    const S = sim.g.supply; for (const d of data.suppliers) S.suppliers[d.id] ??= { known: d.knownAtStart, catalogKnown: false, relation: d.knownAtStart ? 40 : 20, closed: false };
  }
  private get S() { return this.sim.g.supply; }
  private sup(id: string): SupplierData { const d = this.data.suppliers.find(s => s.id === id); if (!d) throw new Error('unknown supplier ' + id); return d; }
  private delay(d: SupplierData, via: Via): number { if (via === 'mail') return Math.max(2, d.mailDays * 2 + 1); if (via === 'phone' && !(d.phone && this.S.phone)) throw new Error('no telephone line to ' + d.id); return via === 'visit' ? d.mailDays : 0; }

  /** the player learns of a supplier (directory, an advert, a tip) */
  discover(id: string, via: string): void { const s = this.S.suppliers[id]; if (s && !s.known) { s.known = true; this.sim.bus.emit('supplier_found', { supplierId: id, via }); } }
  /** the telephone directory: every shop and wholesaler within two days' post gets a name and an address */
  directory(): string[] { const found: string[] = []; for (const d of this.data.suppliers) if (d.size !== 'maker' && d.mailDays <= 2 && !this.S.suppliers[d.id]!.known) { this.discover(d.id, 'directory'); found.push(d.id); } return found; }
  /** known suppliers that sell a part, cheapest first */
  sellers(part: string): { id: string; line: CatalogLine; mailDays: number }[] { return this.data.suppliers.filter(d => this.S.suppliers[d.id]!.known && !this.S.suppliers[d.id]!.closed).flatMap(d => d.catalog.filter(c => c.part === part).map(line => ({ id: d.id, line, mailDays: d.mailDays }))).sort((x, y) => x.line.price * x.line.minOrder - y.line.price * y.line.minOrder); }
  /** the parts a supplier sells */
  sells(id: string): string[] { return [...new Set(this.sup(id).catalog.map(c => c.part))]; }
  /** sets of a part already ordered and on their way */
  coming(part: string): number { return this.S.orders.filter(o => o.state === 'coming').flatMap(o => o.lines).filter(l => l.part === part).reduce((t, l) => t + l.qty, 0); }
  /** ask for prices; the answer comes as a quote after the time the contact takes */
  inquire(id: string, lines: { part: string; qty: number; grade?: number }[], via: Via): void {
    const d = this.sup(id); if (!this.S.suppliers[id]!.known) throw new Error('supplier not known yet: ' + id);
    this.S.pending.push({ due: addDays(this.sim.g.clock.date, this.delay(d, via)), kind: 'reply', supplierId: id, via, lines });
  }
  /** give something to get something (design 03, chapter 5); at most two rounds */
  haggle(quoteId: number, lever: Lever): void { const q = this.quote(quoteId); if (q.round >= 2) throw new Error('no more haggling on quote ' + quoteId);
    this.S.pending.push({ due: addDays(this.sim.g.clock.date, this.delay(this.sup(q.supplierId), q.via)), kind: 'haggle', supplierId: q.supplierId, via: q.via, quoteId, lever }); }
  quote(id: number): Quote { const q = this.S.quotes.find(x => x.id === id); if (!q || q.state !== 'open') throw new Error('no open quote ' + id); return q; }
  /** place the order of a quote; prepaid orders are paid at once */
  order(quoteId: number): PurchaseOrder { const q = this.quote(quoteId), a = this.sim.api(), total = q.lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
    const o: PurchaseOrder = { id: this.S.nextId++, supplierId: q.supplierId, lines: q.lines, placed: a.date, due: addDays(a.date, q.leadDays), paid: q.prepaid, total, state: 'coming' };
    if (q.prepaid) post(a, 'materials', -total, this.sup(q.supplierId).name);
    q.state = 'ordered'; this.S.orders.push(o); this.S.suppliers[q.supplierId]!.relation += 2; this.sim.bus.emit('purchase_ordered', { orderId: o.id, supplierId: o.supplierId, total }); return o; }

  /** sets of a part in the store */
  stock(part: string): number { return this.S.lots.filter(l => l.part === part).reduce((t, l) => t + l.qty, 0); }
  /** take sets out of the store, oldest first; returns their average quality and what they cost */
  take(part: string, qty: number): { quality: number; cost: number } | null { if (this.stock(part) < qty - 1e-9) return null; let need = qty, q = 0, cost = 0;
    for (const l of this.S.lots) { if (l.part !== part || need <= 0) continue; const n = Math.min(l.qty, need); l.qty -= n; need -= n; q += n * l.quality; cost += n * l.unitCost; }
    this.S.lots = this.S.lots.filter(l => l.qty > 1e-9); return { quality: q / qty, cost }; }
  /** what the store holds, in sets and in real units (design 03, decision 2) */
  storeView(): { part: string; sets: number; units: number; unit: string }[] { const by = new Map<string, number>(); for (const l of this.S.lots) by.set(l.part, (by.get(l.part) ?? 0) + l.qty);
    return [...by].map(([part, sets]) => ({ part, sets, units: Math.round(sets * this.parts.parts[part]!.perSet * 10) / 10, unit: this.parts.parts[part]!.unit })); }

  system(): System { return { id: 'supply', morning: a => this.morning(a) }; }
  private morning(a: Api): void { const S = this.S;
    // deliveries due today or overdue
    for (const o of S.orders) { if (o.state !== 'coming' || o.due > a.date) continue; const d = this.sup(o.supplierId);
      if (!o.late && a.rng.float() > d.reliability * mult(a.g, 'supplier_reliability', d.id)) { o.late = true; o.due = addDays(a.date, a.rng.int(2, 7)); a.bus.emit('delivery_delayed', { orderId: o.id, due: o.due }); a.raise('delivery_delayed', 'notice', { orderId: o.id, supplier: d.name, due: o.due }); continue; }
      for (const l of o.lines) { const base = this.parts.gradeQuality[String(l.grade)] ?? 60, q = Math.max(15, Math.min(98, base + plus(a.g, 'material_quality', l.part) + (a.rng.float() - 0.5) * 2 * (1 - d.consistency) * 30));
        S.lots.push({ part: l.part, grade: l.grade, qty: l.qty, quality: Math.round(q), unitCost: l.unitPrice, received: a.date }); }
      if (!o.paid) { post(a, 'materials', -o.total, d.name); o.paid = true; }
      o.state = 'delivered'; S.suppliers[o.supplierId]!.relation += 1; a.bus.emit('parts_delivered', { orderId: o.id, supplierId: o.supplierId }); a.raise('parts_delivered', 'notice', { orderId: o.id, supplier: d.name, lines: o.lines }); }
    // answers to letters, calls and visits
    const due = S.pending.filter(p => p.due <= a.date); S.pending = S.pending.filter(p => p.due > a.date);
    for (const p of due) { const d = this.sup(p.supplierId), st = S.suppliers[p.supplierId]!;
      if (p.kind === 'reply') { const lines: QuoteLine[] = []; let lead = 0;
        for (const w of p.lines ?? []) { const c = d.catalog.filter(x => x.part === w.part && (w.grade == null || x.grade === w.grade)).sort((x, y) => x.price - y.price)[0]; if (!c) continue;
          lines.push({ part: c.part, grade: c.grade, qty: Math.max(w.qty, c.minOrder), unitPrice: Math.round(c.price * (st.priceMult && st.priceUntil && st.priceUntil > a.date ? st.priceMult : 1) * 100) / 100 }); lead = Math.max(lead, c.leadDays); }
        st.catalogKnown = true; if (!lines.length) { a.raise('supplier_no_stock', 'notice', { supplier: d.name }); continue; }
        const q: Quote = { id: S.nextId++, supplierId: d.id, via: p.via, lines, leadDays: Math.round(lead * mult(a.g, 'supplier_lead', d.id)), prepaid: st.relation < 60, round: 0, date: a.date, state: 'open' };
        S.quotes.push(q); a.bus.emit('supplier_quote_received', { quoteId: q.id, supplierId: d.id }); a.raise('supplier_quote', 'decision', { quoteId: q.id, supplier: d.name }, 14); }
      else { const q = S.quotes.find(x => x.id === p.quoteId); if (!q || q.state !== 'open') continue; q.round++;
        const founder = a.g.founderId ? a.g.people[a.g.founderId] : undefined, chance = d.temper * 0.6 + st.relation / 250 + (founder?.skills.sales ?? 30) / 300 + (p.lever === 'prepay' || p.lever === 'premium' ? 0.25 : 0.1), ok = a.rng.float() < chance;
        if (ok) { if (p.lever === 'prepay') { q.prepaid = true; q.lines.forEach(l => { l.unitPrice = Math.round(l.unitPrice * 0.93 * 100) / 100; }); }
          if (p.lever === 'quantity') q.lines.forEach(l => { l.qty *= 2; l.unitPrice = Math.round(l.unitPrice * 0.9 * 100) / 100; });
          if (p.lever === 'patience') { q.leadDays = Math.round(q.leadDays * 1.5); q.lines.forEach(l => { l.unitPrice = Math.round(l.unitPrice * 0.94 * 100) / 100; }); }
          if (p.lever === 'premium') { q.leadDays = Math.max(1, Math.round(q.leadDays * 0.6)); q.lines.forEach(l => { l.unitPrice = Math.round(l.unitPrice * 1.08 * 100) / 100; }); } }
        else st.relation -= 1;
        a.raise('supplier_quote', 'decision', { quoteId: q.id, supplier: d.name, haggled: p.lever, agreed: ok }, 14); } }
  }
}
