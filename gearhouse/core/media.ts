// The newspaper (system design 06, the slice's core): a weekly issue made up of dated history, news of the
// workshop from what happened in the game, local items, the player's own advert and suppliers' adverts.
// Copies pile up on the desk and can be kept or thrown away; they age by their date.
import { daysBetween, weekday, type DateStr } from './calendar';
import type { Api, Simulation, System } from './sim';
import type { Supply } from './supply';
import { addDays } from './calendar';
import { fictionalItems, realItems, type FictionData, type NewsItem, type RealData } from './news';
import { makeName, type NameData } from './people';
import { writeBody, type Body, type BodyData } from './newsBody';

export interface Article extends NewsItem { page: number }
export interface Issue { id: number; publication: string; date: DateStr; articles: Article[]; playerAds: string[]; supplierAds: string[] }
export interface Copy { issueId: number; place: 'desk' | 'drawer' | 'shelf' | 'gone'; read: boolean; marked: boolean }
/** something a paper warned of, on its way to the game */
export interface Coming { due: DateStr; kind: 'demand' | 'supplier_price' | 'awareness'; value: number; weeks: number; supplierId?: string; from: string }
export interface MediaState { issues: Issue[]; copies: Copy[]; news: { importance: number; headline: string; id: string }[]; coming: Coming[]; recent: string[]; nextId: number }
export interface MediaData { publications: { id: string; kind: string; name: string; weekday?: number; pages: number; supplierAdChance?: number }[]; ageing: { years: number; look: string }[]; limits: { desk: number; drawer: number } }
export const newMedia = (): MediaState => ({ issues: [], copies: [], news: [], coming: [], recent: [], nextId: 1 });

export class Media {
  constructor(private sim: Simulation, private data: MediaData, private fiction: FictionData, private real: RealData, private names: NameData, private supply: Supply, private supplierNames: Record<string, string>, private town: string, private bodies?: BodyData) {
    // what happens in the game becomes news for the next issue
    sim.bus.on('order_placed', e => { const c = sim.g.market.customers[e.customerId]; if (c && c.standing >= 60) this.note(4, `${sim.g.people[c.personId]!.family} 씨, 새 차 주문`, 'order:' + e.orderId); });
    sim.bus.on('car_delivered', e => { if (e.satisfaction >= 60) this.note(5, '읍내 공방의 새 차, 주인 "흡족하다"', 'delivered:' + e.orderId); else if (e.satisfaction <= -40) this.note(5, '새 차 받은 주민, 공방에 불만', 'unhappy:' + e.orderId); });
    sim.bus.on('employee_hired', e => this.note(2, '읍내 공방, 일손 한 명 들여', 'hired:' + e.personId));
  }
  private get S() { return this.sim.g.media; }
  private note(importance: number, headline: string, id: string) { this.S.news.push({ importance, headline, id }); }

  /** the text of an article, written from its seed (null while its topic has no body sentences yet) */
  body(issueId: number, index: number): Body | null { const art = this.S.issues.find(i => i.id === issueId)?.articles[index]; return art && this.bodies ? writeBody(art, this.bodies, this.fiction, this.town) : null; }
  /** how a copy looks at a given date */
  look(issueId: number, today: DateStr): string { const is = this.S.issues.find(i => i.id === issueId)!, c = this.S.copies.find(x => x.issueId === issueId), years = daysBetween(is.date, today) / 365 * (c?.place === 'desk' ? 1.6 : 1); return this.data.ageing.find(a => years < a.years)!.look; }
  /** reading a supplier's advert puts the supplier in the address book */
  read(issueId: number): Issue { const is = this.S.issues.find(i => i.id === issueId)!, c = this.S.copies.find(x => x.issueId === issueId); if (c) c.read = true; for (const s of is.supplierAds) this.supply.discover(s, 'advert'); return is; }
  move(issueId: number, place: Copy['place']): void { const c = this.S.copies.find(x => x.issueId === issueId); if (!c) return; const L = this.data.limits;
    if (place === 'drawer' && this.S.copies.filter(x => x.place === 'drawer').length >= L.drawer) throw new Error('the drawer is full'); c.place = place; }

  system(): System { return { id: 'media', morning: a => this.morning(a) }; }
  private morning(a: Api): void { const S = this.S, g = a.g;
    // what earlier papers warned of now arrives
    for (const c of S.coming.filter(x => x.due <= a.date)) { if (c.kind === 'demand') g.market.boosts.push({ until: addDays(a.date, c.weeks * 7), mult: c.value, from: c.from });
      if (c.kind === 'awareness') g.market.awareness.town = Math.min(100, g.market.awareness.town + c.value);
      if (c.kind === 'supplier_price' && c.supplierId) { const s = g.supply.suppliers[c.supplierId]; if (s) { s.priceMult = c.value; s.priceUntil = addDays(a.date, c.weeks * 7); } } }
    S.coming = S.coming.filter(x => x.due > a.date);
    for (const pub of this.data.publications) { if (pub.kind !== 'newspaper' || weekday(a.date) !== pub.weekday) continue;
      const last = S.issues.filter(i => i.publication === pub.id).at(-1)?.date ?? addDays(a.date, -7), sup = Object.entries(g.supply.suppliers).filter(([, s]) => !s.closed).map(([id, s]) => ({ id, name: this.supplierNames[id] ?? id, known: s.known }));
      const person = makeName(a.rng, this.names, 'm'), facts = { town: this.town, person: `${person.given} ${person.family}` };
      const items: NewsItem[] = [...realItems(a.rng, this.real, last, a.date), ...S.news.splice(0).map((n): NewsItem => ({ origin: 'fictional', id: n.id, relation: 'related', importance: n.importance, headline: n.headline, weight: n.importance + 0.5 })), ...fictionalItems(a.rng, this.fiction, facts, S.recent, sup, this.bodies?.voices)];
      for (const it of items) { if (it.lead) it.lead = it.lead.replace('{town}', this.town); const e = it.effect; if (!e || e.kind === 'supplier_found') continue;
        const due = addDays(a.date, (it.delayWeeks ?? 0) * 7); e.due = due; S.coming.push({ due, kind: e.kind, value: e.value ?? 1, weeks: e.weeks ?? 0, supplierId: e.supplierId, from: it.id }); }
      items.sort((x, y) => y.weight - x.weight);
      const ads = items.filter(it => it.effect?.kind === 'supplier_found' && it.effect.supplierId).map(it => it.effect!.supplierId!), unknown = sup.filter(s => !s.known && !ads.includes(s.id)); if (unknown.length && a.rng.float() < (pub.supplierAdChance ?? 0.3)) ads.push(unknown[a.rng.int(0, unknown.length - 1)]!.id);
      const issue: Issue = { id: S.nextId++, publication: pub.id, date: a.date, articles: items.map((x, i) => ({ ...x, page: i < 3 ? 1 : x.relation === 'unrelated' ? 2 : x.relation === 'background' ? 3 : i < 7 ? 2 : 3 })), playerAds: g.market.adverts.filter(ad => ad.medium === pub.id && ad.from <= a.date && a.date < ad.until).map(ad => ad.size), supplierAds: ads };
      S.issues.push(issue); S.copies.push({ issueId: issue.id, place: 'desk', read: false, marked: issue.articles.some(x => x.id.startsWith('order:') || x.id.startsWith('delivered:') || x.id.startsWith('unhappy:')) || issue.playerAds.length > 0 });
      a.bus.emit('newspaper_published', { issueId: issue.id, publication: pub.id, date: a.date });
      a.raise('newspaper', 'notice', { issueId: issue.id, name: pub.name, lead: issue.articles[0]?.headline, ads: ads.map(s => this.supplierNames[s]) }); } }
}
