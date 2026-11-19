// What the newspaper prints (system design 06, planner's scheme of 2026-11-19).
//  fictional news: importance 1..6, each in one of four relations to the game
//  real news:      important / very important / historic, each in one of the same four
//  relations:      essential (it changes the game), related (the motor trade and its customers),
//                  background (the times), unrelated (town life)
// Fictional items are assembled from topics with slots, so one topic gives hundreds of different lines;
// essential ones carry an effect that reaches the game some weeks after the paper warns of it.
import type { Rng } from './rng';
import type { DateStr } from './calendar';
import { josa } from './text';

export type Relation = 'essential' | 'related' | 'background' | 'unrelated';
export type RealLevel = 'important' | 'very_important' | 'historic';
export type Tier = 'low' | 'mid' | 'high';
export const RELATIONS: Relation[] = ['essential', 'related', 'background', 'unrelated'];
export const tierOf = (importance: number): Tier => (importance <= 2 ? 'low' : importance <= 4 ? 'mid' : 'high');

export type Effect =
  | { kind: 'demand'; mult: number[]; weeks: number }                 // callers and letters, for a while (one value per importance 1..6, or one for all)
  | { kind: 'supplier_price'; mult: number[]; weeks: number }        // one supplier's prices
  | { kind: 'supplier_found' }                                        // a supplier the player may not know yet
  | { kind: 'awareness'; add: number[] };                             // the town hears of the workshop's trade
export type Slant = 'good' | 'bad' | 'neutral';
export interface Topic { id: string; relation: Relation; slant: Slant; low?: string[]; mid?: string[]; high?: string[]; effect?: Effect; delayWeeks?: [number, number] }
export interface FictionData { topics: Topic[]; words: Record<string, string[]>;
  /** endings that may follow a headline: who said what, how the town took it, where and when */ tails: { t: string; w: number; noQuote?: boolean; minImportance?: number; notRelation?: Relation[] }[];
  /** articles of each importance per issue: [min, max] or a chance below 1 */
  perIssue: Record<string, [number, number] | number>; relationWeights: Record<Relation, number> }
export interface RealEvent { id: string; date?: DateStr; annual?: { month: number; day: number; from?: number; to?: number }; level: RealLevel; relation: Relation; headlines: string[]; effect?: Effect }
export interface RealData { events: RealEvent[]; angles: Record<Relation, string[]> }

export interface NewsItem { origin: 'fictional' | 'real'; id: string; slant?: Slant;
  /** what the headline said, so the body says the same; the seed the body is written from; the voice that writes it */ slots?: Record<string, string>; seed?: number; voice?: string; /** weeks from the paper to the effect */ delayWeeks?: number; relation: Relation; importance?: number; level?: RealLevel; headline: string; lead?: string;
  /** how prominently it is printed */ weight: number; effect?: { kind: Effect['kind']; value?: number; weeks?: number; supplierId?: string; due?: DateStr } }

/** fill a pattern: {=list} picks a word (a list named list@N is used for importance N when it exists); {fact} takes a fact;
 *  either may carry a Korean particle pair, {=list:을/를}. Picks are remembered in `bound`, so a headline and its body agree. */
export function fill(rng: Rng, pattern: string, words: Record<string, string[]>, facts: Record<string, string | number>, importance = 0, bound?: Record<string, string>): string {
  return pattern.replace(/\{=(\w+)(?::([^}]+))?\}/g, (_, k: string, j?: string) => { let v = bound?.[k]; if (v == null) { const w = words[`${k}@${importance}`] ?? words[k]; v = w?.length ? w[rng.int(0, w.length - 1)]! : ''; if (bound) bound[k] = v; } return j ? v + josa(v, j) : v; })
    .replace(/\{(\w+)(?::([^}]+))?\}/g, (m, k: string, j?: string) => { if (facts[k] == null) return m; const v = String(facts[k]); return j ? v + josa(v, j) : v; }); }
/** different lines a topic pattern gives once the endings are counted */
/** the endings that suit a headline: no second quotation, no official's word on small town items */
export function tailsFor(data: FictionData, pattern: string, importance: number, relation: Relation) { const quoted = /["“…]/.test(pattern); return data.tails.filter(x => !(x.noQuote && quoted) && !(pattern.includes('…') && x.t.startsWith('…')) && importance >= (x.minImportance ?? 1) && !(x.notRelation ?? []).includes(relation)); }
export function combosWithTails(pattern: string, data: FictionData, importance: number, relation: Relation): number { return tailsFor(data, pattern, importance, relation).reduce((n, x) => n + combos(pattern + x.t, data.words, importance), 0); }
export function combos(pattern: string, words: Record<string, string[]>, importance: number): number { let n = 1; for (const m of pattern.matchAll(/\{=(\w+)(?::[^}]+)?\}/g)) n *= (words[`${m[1]}@${importance}`] ?? words[m[1]!] ?? ['']).length; return n; }
const pickW = <T>(rng: Rng, items: T[], w: (x: T) => number): T => { let t = rng.float() * items.reduce((s, i) => s + w(i), 0); for (const i of items) { t -= w(i); if (t <= 0) return i; } return items[items.length - 1]!; };
const val = (a: number[], importance: number) => a[Math.min(a.length - 1, importance - 1)] ?? a[0]!;

/** the fictional items of one issue */
export interface VoiceInfo { id: string; beats: Relation[]; slants: Slant[]; importance?: [number, number] }
export function fictionalItems(rng: Rng, data: FictionData, facts: Record<string, string | number>, recent: string[], suppliers: { id: string; name: string; known: boolean }[], voices: VoiceInfo[] = []): NewsItem[] {
  const out: NewsItem[] = [];
  for (let importance = 6; importance >= 1; importance--) { const per = data.perIssue[String(importance)] ?? 0, n = typeof per === 'number' ? (rng.float() < per ? 1 : 0) : rng.int(per[0], per[1]), tier = tierOf(importance);
    for (let k = 0; k < n; k++) { const relation = pickW(rng, RELATIONS, r => data.relationWeights[r]), pool = data.topics.filter(t => t.relation === relation && t[tier]?.length); if (!pool.length) continue;
      const fresh = pool.filter(t => !recent.includes(t.id + ':' + tier)), topic = pickW(rng, fresh.length ? fresh : pool, () => 1), pats = topic[tier]!, f = { ...facts };
      let supplierId: string | undefined;
      if (topic.effect?.kind === 'supplier_price' || topic.effect?.kind === 'supplier_found') { const cand = suppliers.filter(s => (topic.effect!.kind === 'supplier_found' ? !s.known : true)); if (!cand.length) continue; const s = cand[rng.int(0, cand.length - 1)]!; supplierId = s.id; f.supplier = s.name; }
      const dw = topic.delayWeeks ?? [1, 3]; const item: NewsItem = { origin: 'fictional', id: topic.id, relation, importance, delayWeeks: topic.effect ? rng.int(dw[0], dw[1]) : undefined, headline: '', weight: importance };
      const pat = pats[rng.int(0, pats.length - 1)]!, tail = pickW(rng, tailsFor(data, pat, importance, relation), x => x.w);
      const bound: Record<string, string> = {}; item.headline = fill(rng, pat + tail.t, data.words, f, importance, bound); item.slant = topic.slant; item.seed = rng.next();
      item.slots = { ...bound, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, String(v)])) };
      const fit = voices.filter(v => v.beats.includes(relation) && v.slants.includes(topic.slant) && importance >= (v.importance?.[0] ?? 1) && importance <= (v.importance?.[1] ?? 6)); if (fit.length) item.voice = fit[rng.int(0, fit.length - 1)]!.id;
      const e = topic.effect; if (e) item.effect = e.kind === 'supplier_found' ? { kind: e.kind, supplierId } : e.kind === 'awareness' ? { kind: e.kind, value: val(e.add, importance) } : { kind: e.kind, value: val(e.mult, importance), weeks: e.weeks, supplierId };
      recent.push(topic.id + ':' + tier); if (recent.length > 40) recent.shift(); out.push(item); } }
  return out; }

const LEVEL_WEIGHT: Record<RealLevel, number> = { important: 5.5, very_important: 7.5, historic: 9.5 };
/** real events dated after `after` and up to `upTo`, each with one of its headlines and a local angle */
export function realItems(rng: Rng, data: RealData, after: DateStr, upTo: DateStr): NewsItem[] { const out: NewsItem[] = [], y0 = +after.slice(0, 4), y1 = +upTo.slice(0, 4);
  for (const ev of data.events) { const dates: DateStr[] = ev.date ? [ev.date] : []; if (ev.annual) for (let y = Math.max(y0, ev.annual.from ?? 0); y <= Math.min(y1, ev.annual.to ?? 9999); y++) dates.push(`${y}-${String(ev.annual.month).padStart(2, '0')}-${String(ev.annual.day).padStart(2, '0')}`);
    for (const d of dates) { if (!(d > after && d <= upTo)) continue; const angles = data.angles[ev.relation], e = ev.effect;
      out.push({ origin: 'real', id: ev.id, relation: ev.relation, level: ev.level, headline: ev.headlines[rng.int(0, ev.headlines.length - 1)]!, lead: angles.length ? angles[rng.int(0, angles.length - 1)] : undefined, weight: LEVEL_WEIGHT[ev.level],
        effect: e && (e.kind === 'demand' || e.kind === 'supplier_price') ? { kind: e.kind, value: e.mult[0], weeks: e.weeks } : undefined }); } }
  return out; }
