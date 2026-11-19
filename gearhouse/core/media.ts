// The newspaper (system design 06, the slice's core): a weekly issue made up of dated history, news of the
// workshop from what happened in the game, local items, the player's own advert and suppliers' adverts.
// Copies pile up on the desk and can be kept or thrown away; they age by their date.
import { daysBetween, weekday, type DateStr } from './calendar';
import type { Api, Simulation, System } from './sim';
import type { Supply } from './supply';

export interface Article { kind: 'history' | 'company' | 'local' | 'trade'; id: string; importance: number; headline: string; page: number }
export interface Issue { id: number; publication: string; date: DateStr; articles: Article[]; playerAds: string[]; supplierAds: string[] }
export interface Copy { issueId: number; place: 'desk' | 'drawer' | 'shelf' | 'gone'; read: boolean; marked: boolean }
export interface MediaState { issues: Issue[]; copies: Copy[]; news: { importance: number; headline: string; id: string }[]; nextId: number }
export interface MediaData { publications: { id: string; kind: string; name: string; weekday?: number; pages: number; localArticles?: [number, number]; supplierAdChance?: number }[]; ageing: { years: number; look: string }[]; limits: { desk: number; drawer: number } }
export interface HistoryData { events: { date: DateStr; id: string; importance: number; headline: string }[] }
export const newMedia = (): MediaState => ({ issues: [], copies: [], news: [], nextId: 1 });

// placeholder local items until the local-article text sets are written (system design 06, chapter 11)
const LOCAL = ['감리교회 바자회, 토요일 열려', '읍내 제분소 화재, 인명 피해 없어', '군 품평회 일정 확정', '강가 다리 보수 공사 시작', '고등학교 농구부, 이웃 군에 승리', '우체국장 은퇴, 30년 근속', '철물점에 도둑, 금고는 무사', '첫눈에 마차 세 대 미끄러져', '읍 의회, 중심가 포장 논의', '젖소 품평회 우승은 서쪽 농장', '소방대 새 펌프차 도착', '봄 장터 날짜 정해져'];

export class Media {
  constructor(private sim: Simulation, private data: MediaData, private history: HistoryData, private supply: Supply, private supplierNames: Record<string, string>) {
    // what happens in the game becomes news for the next issue
    sim.bus.on('order_placed', e => { const c = sim.g.market.customers[e.customerId]; if (c && c.standing >= 60) this.note(4, `${sim.g.people[c.personId]!.family} 씨, 새 차 주문`, 'order:' + e.orderId); });
    sim.bus.on('car_delivered', e => { if (e.satisfaction >= 60) this.note(5, '읍내 공방의 새 차, 주인 "흡족하다"', 'delivered:' + e.orderId); else if (e.satisfaction <= -40) this.note(5, '새 차 받은 주민, 공방에 불만', 'unhappy:' + e.orderId); });
    sim.bus.on('employee_hired', e => this.note(2, '읍내 공방, 일손 한 명 들여', 'hired:' + e.personId));
  }
  private get S() { return this.sim.g.media; }
  private note(importance: number, headline: string, id: string) { this.S.news.push({ importance, headline, id }); }

  /** how a copy looks at a given date */
  look(issueId: number, today: DateStr): string { const is = this.S.issues.find(i => i.id === issueId)!, c = this.S.copies.find(x => x.issueId === issueId), years = daysBetween(is.date, today) / 365 * (c?.place === 'desk' ? 1.6 : 1); return this.data.ageing.find(a => years < a.years)!.look; }
  /** reading a supplier's advert puts the supplier in the address book */
  read(issueId: number): Issue { const is = this.S.issues.find(i => i.id === issueId)!, c = this.S.copies.find(x => x.issueId === issueId); if (c) c.read = true; for (const s of is.supplierAds) this.supply.discover(s, 'advert'); return is; }
  move(issueId: number, place: Copy['place']): void { const c = this.S.copies.find(x => x.issueId === issueId); if (!c) return; const L = this.data.limits;
    if (place === 'drawer' && this.S.copies.filter(x => x.place === 'drawer').length >= L.drawer) throw new Error('the drawer is full'); c.place = place; }

  system(): System { return { id: 'media', morning: a => this.morning(a) }; }
  private morning(a: Api): void { const S = this.S;
    for (const pub of this.data.publications) { if (pub.kind !== 'newspaper' || weekday(a.date) !== pub.weekday) continue;
      const last = S.issues.filter(i => i.publication === pub.id).at(-1)?.date ?? '0000-00-00', arts: Omit<Article, 'page'>[] = [];
      for (const h of this.history.events) if (h.date > last && h.date <= a.date) arts.push({ kind: 'history', id: h.id, importance: h.importance, headline: h.headline });
      for (const n of S.news.splice(0)) arts.push({ kind: 'company', id: n.id, importance: n.importance, headline: n.headline });
      const [lo, hi] = pub.localArticles ?? [4, 8]; for (let k = a.rng.int(lo, hi), used = new Set<number>(); k > 0; k--) { let i = a.rng.int(0, LOCAL.length - 1); while (used.has(i)) i = (i + 1) % LOCAL.length; used.add(i); arts.push({ kind: 'local', id: 'local:' + i, importance: a.rng.int(1, 3), headline: LOCAL[i]! }); }
      arts.sort((x, y) => y.importance - x.importance);
      const unknown = Object.entries(a.g.supply.suppliers).filter(([, s]) => !s.known && !s.closed).map(([id]) => id), ads: string[] = []; if (unknown.length && a.rng.float() < (pub.supplierAdChance ?? 0.3)) ads.push(unknown[a.rng.int(0, unknown.length - 1)]!);
      const issue: Issue = { id: S.nextId++, publication: pub.id, date: a.date, articles: arts.map((x, i) => ({ ...x, page: i < 3 ? 1 : x.kind === 'local' ? 2 : 3 })), playerAds: a.g.market.adverts.filter(ad => ad.medium === pub.id && ad.from <= a.date && a.date < ad.until).map(ad => ad.size), supplierAds: ads };
      S.issues.push(issue); S.copies.push({ issueId: issue.id, place: 'desk', read: false, marked: issue.articles.some(x => x.kind === 'company') || issue.playerAds.length > 0 });
      a.bus.emit('newspaper_published', { issueId: issue.id, publication: pub.id, date: a.date });
      a.raise('newspaper', 'notice', { issueId: issue.id, name: pub.name, lead: issue.articles[0]?.headline, ads: ads.map(s => this.supplierNames[s]) }); } }
}
