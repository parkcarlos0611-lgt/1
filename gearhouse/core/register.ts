// The town register (review 10): a small database kept in the save.
//  entities: what exists (banks, factories, rival makers, roads, public offices) and the state each is in now
//  records:  what happened, appended and never changed
// The newspaper reads it, so a closed bank is not reported open again, and writes it, so the town remembers.
import { addDays, daysBetween, parts, type DateStr } from './calendar';
import type { Rng } from './rng';
import { fill, tierOf, tailsFor, type FictionData, type NewsItem, type VoiceInfo } from './news';
import { makeName, type NameData } from './people';

export interface Entity { id: string; kind: string; name: string; status: string; since: DateStr; attrs: Record<string, string | number> }
export interface Rec { id: number; date: DateStr; entityId: string; type: string; from?: string; to?: string; importance: number; headline?: string; issueId?: number }
export interface RegisterState { entities: Record<string, Entity>; records: Rec[]; nextId: number }
export interface Move { from: string; to: string; chance: number; mood: 'good' | 'bad' | 'any'; topic: string; importance: [number, number]; type?: string }
export interface RegisterData { kinds: Record<string, { start: string; names: string[]; moves?: Move[]; gone?: string[]; termYears?: [number, number]; topic?: string }>; anniversary: { minImportance: number; years: number[] } }
export const newRegister = (): RegisterState => ({ entities: {}, records: [], nextId: 1 });

export class Register {
  constructor(private S: RegisterState, private data: RegisterData) {}
  /** the town as it stands when the game begins */
  found(rng: Rng, names: NameData, date: DateStr): void { if (Object.keys(this.S.entities).length) return;
    for (const [kind, K] of Object.entries(this.data.kinds)) K.names.forEach((name, i) => { const e: Entity = { id: `${kind}:${i}`, kind, name, status: K.start, since: date, attrs: {} };
      if (K.termYears) { const n = makeName(rng, names, 'm'); e.attrs.holder = `${n.given} ${n.family}`; e.attrs.termEnd = addDays(date, rng.int(60, K.termYears[1] * 365)); }
      this.S.entities[e.id] = e; }); }
  get(id: string): Entity | undefined { return this.S.entities[id]; }
  byKind(kind: string, status?: string): Entity[] { return Object.values(this.S.entities).filter(e => e.kind === kind && (status == null || e.status === status)); }
  /** entities of a kind that still exist (not closed, bankrupt...) */
  alive(kind: string): Entity[] { const gone = this.data.kinds[kind]?.gone ?? []; return this.byKind(kind).filter(e => !gone.includes(e.status)); }
  history(id: string): Rec[] { return this.S.records.filter(r => r.entityId === id); }
  recent(kind: string, days: number, today: DateStr): Rec[] { return this.S.records.filter(r => r.entityId.startsWith(kind + ':') && daysBetween(r.date, today) <= days); }
  /** records of note made on this day of an earlier year */
  anniversaries(today: DateStr, withinDays = 6): { rec: Rec; years: number }[] { const A = this.data.anniversary, y = parts(today).year, out: { rec: Rec; years: number }[] = [];
    for (const r of this.S.records) { if (r.importance < A.minImportance) continue; const years = y - parts(r.date).year; if (!A.years.includes(years)) continue; const d = daysBetween(`${y}${r.date.slice(4)}`, today); if (d >= 0 && d <= withinDays) out.push({ rec: r, years }); }
    return out; }
  record(date: DateStr, e: Entity, type: string, importance: number, to?: string, headline?: string): Rec { const r: Rec = { id: this.S.nextId++, date, entityId: e.id, type, from: e.status, to, importance, headline }; if (to && to !== e.status) { e.status = to; e.since = date; } this.S.records.push(r); return r; }

  /** A week passes: some subjects change state, and each change is news. times: below 1 in bad years, 1 in good ones. */
  weeklyNews(rng: Rng, names: NameData, fiction: FictionData, date: DateStr, times: number, facts: Record<string, string | number>, voices: VoiceInfo[]): NewsItem[] { const out: NewsItem[] = [];
    for (const [kind, K] of Object.entries(this.data.kinds)) {
      if (K.termYears && K.topic) { for (const e of this.byKind(kind)) { if (String(e.attrs.termEnd) > date) continue;                         // an office comes up for election
          const stays = rng.float() < 0.5, n = makeName(rng, names, 'm'), winner = stays ? String(e.attrs.holder) : `${n.given} ${n.family}`; e.attrs.holder = winner; e.attrs.termEnd = addDays(date, rng.int(K.termYears[0], K.termYears[1]) * 365);
          const it = this.item(rng, fiction, K.topic, rng.int(3, 4), e, { ...facts, person: winner }, voices); if (it) { this.record(date, e, stays ? 're-elected' : 'elected', it.importance!, undefined, it.headline); out.push(it); } } continue; }
      for (const e of this.alive(kind)) { for (const m of K.moves ?? []) { if (m.from !== e.status) continue; const k = m.mood === 'bad' ? 1 + (1 - times) * 2 : m.mood === 'good' ? times : 1; if (rng.float() >= m.chance * k) continue;
          if (this.history(e.id).some(r => daysBetween(r.date, date) < 21)) break;                                                              // one subject is not in the paper every week
          const imp = rng.int(m.importance[0], m.importance[1]), it = this.item(rng, fiction, m.topic, imp, e, facts, voices); if (!it) break;
          const prev = this.history(e.id).at(-1); if (prev && imp >= 3 && it.slots) { const months = Math.max(1, Math.round(daysBetween(prev.date, date) / 30)); it.slots.before = months >= 12 ? `${Math.round(months / 12)}년 전` : `${months}달 전`; it.slots.beforeHeadline = prev.headline ?? ''; }
          this.record(date, e, m.type ?? 'status', imp, m.to, it.headline); out.push(it); break; } } }
    for (const { rec, years } of this.anniversaries(date)) { const e = this.get(rec.entityId); if (!e || !rec.headline) continue;
      out.push({ origin: 'fictional', id: 'anniversary', relation: 'background', slant: 'neutral', importance: 2, weight: 2, headline: `그날로부터 ${years}년: "${rec.headline.split(/[…—(\[]/)[0]!.trim()}"` }); }
    return out; }
  private item(rng: Rng, fiction: FictionData, topicId: string, importance: number, e: Entity, facts: Record<string, string | number>, voices: VoiceInfo[]): NewsItem | null {
    const t = fiction.topics.find(x => x.id === topicId), pats = t?.[tierOf(importance)] ?? t?.mid ?? t?.low; if (!t || !pats?.length) return null;
    const pat = pats[rng.int(0, pats.length - 1)]!, tails = tailsFor(fiction, pat, importance, t.relation), tail = tails[rng.int(0, tails.length - 1)] ?? { t: '' }, f = { ...facts, entity: e.name }, bound: Record<string, string> = {};
    const item: NewsItem = { origin: 'fictional', id: t.id, relation: t.relation, slant: t.slant, importance, weight: importance, headline: fill(rng, pat + tail.t, t.officials ? { ...fiction.words, official: t.officials } : fiction.words, f, importance, bound, t.slant), seed: rng.next(), entityId: e.id };
    item.slots = { ...bound, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, String(v)])) };
    const fit = voices.filter(v => v.beats.includes(t.relation) && v.slants.includes(t.slant) && importance >= (v.importance?.[0] ?? 1) && importance <= (v.importance?.[1] ?? 6)); if (fit.length) item.voice = fit[rng.int(0, fit.length - 1)]!.id;
    const ef = t.effect, dw = t.delayWeeks ?? [1, 3]; if (ef && (ef.kind === 'demand' || ef.kind === 'supplier_price')) { item.effect = { kind: ef.kind, value: ef.mult[Math.min(ef.mult.length - 1, importance - 1)], weeks: ef.weeks }; item.delayWeeks = rng.int(dw[0], dw[1]); }
    return item; }
}
