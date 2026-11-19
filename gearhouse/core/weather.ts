// Weather and seasonal events (review 11): each day is clear, rainy or snowy; now and then a spell of some days
// or weeks holds (a cold wave, a blizzard, a long rain, a heat wave, a drought, a fine autumn). A spell lasts a
// month at most, a long rain comes once a year at most, and after a spell there is a grace before the next may begin.
// Weather keeps people from calling in person; half of those kept away by a spell come when it is over.
import { addDays, daysBetween, parts, type DateStr } from './calendar';
import type { Api, Simulation, System } from './sim';
import { begin, type CondKind } from './conditions';

export type Sky = 'clear' | 'rain' | 'snow';
export interface SpellCond { cond: CondKind; key?: string; value: number; /** holds until the next monthly bill after the spell */ bill?: boolean; /** days it holds beyond the spell */ extraDays?: number; /** days it holds, counted from the end (for what follows a spell) */ days?: number }
export interface WeatherEvent { id: string; months: number[]; days: [number, number]; rain: number; snow: number; visit: number; strength: number; oncePerYear?: boolean; words: string[];
  /** what it brings to other systems while it lasts */ conds?: SpellCond[]; /** news topics it keeps out of the paper, and for how long after it */ blocksTopics?: string[]; blockDays?: number;
  /** what follows when it ends */ after?: { conds?: SpellCond[]; news?: { importance: number; headlines: string[] } } }
export interface WeatherData { months: Record<string, [number, number]>; persistence: number; visit: { rain: number; snow: number; min: number; max: number }; startChance: { winter: number; summer: number; other: number };
  grace: [number, number]; graceWinter: [number, number]; maxDays: number; returnShare: number; returnDays: number; events: WeatherEvent[]; dayWords: Record<Sky, string[]>;
  notes: Record<string, { title: string; start: string[]; ongoing: string[]; end: string[] }> }
export interface WeatherState { today: Sky; /** how callers in person are multiplied today */ visit: number; event?: { kind: string; start: DateStr; end: DateStr }; /** the spell that ended last */ last?: { kind: string; start: DateStr; end: DateStr };
  graceUntil?: DateStr; longRainYear?: number; /** callers the present spell has kept away */ lost: number }
export const newWeather = (): WeatherState => ({ today: 'clear', visit: 1, lost: 0 });
const season = (month: number) => (month === 12 || month <= 2 ? 'winter' : month >= 6 && month <= 8 ? 'summer' : 'other');

const nextBill = (d: DateStr): DateStr => { let x = addDays(d, 1); while (parts(x).day !== 1) x = addDays(x, 1); return addDays(x, 1); };
/** a spell begins: its days, and what it brings to the suppliers, the bills and what customers ask for */
export function startSpell(a: Api, D: WeatherData, kind: string, days: number): void { const W = a.g.weather, e = D.events.find(x => x.id === kind); if (!e) throw new Error('unknown spell ' + kind); const end = addDays(a.date, Math.min(D.maxDays, days) - 1);
  W.event = { kind, start: a.date, end }; if (e.oncePerYear) W.longRainYear = parts(a.date).year;
  for (const c of e.conds ?? []) begin(a.g, { kind: c.cond, key: c.key, value: c.value, until: c.bill ? nextBill(end) : addDays(end, 1 + (c.extraDays ?? 0)), from: 'weather:' + kind });
  a.bus.emit('weather_event_started', { kind, date: a.date, days }); a.log('weather_start:' + kind); }
/** a spell ends: the grace before the next, the callers who waited, and what it leaves behind */
export function endSpell(a: Api, D: WeatherData): void { const W = a.g.weather; if (!W.event) return; const e = D.events.find(x => x.id === W.event!.kind), g = season(parts(a.date).month) === 'winter' ? D.graceWinter : D.grace;
  W.last = W.event; delete W.event; W.graceUntil = addDays(a.date, a.rng.int(g[0], g[1])); const returning = Math.floor(W.lost * D.returnShare); W.lost = 0;
  for (const c of e?.after?.conds ?? []) begin(a.g, { kind: c.cond, key: c.key, value: c.value, until: addDays(a.date, c.days ?? 14), from: 'after:' + W.last.kind });
  a.bus.emit('weather_event_ended', { kind: W.last.kind, date: a.date, returning }); a.log('weather_end:' + W.last.kind); }
/** news topics the weather of these months rules out (no good harvest in a drought) */
export function blockedTopics(W: WeatherState | undefined, D: WeatherData, today: DateStr): string[] { if (!W) return []; const out: string[] = [];
  for (const e of D.events) { if (!e.blocksTopics) continue; if (W.event?.kind === e.id || (W.last?.kind === e.id && daysBetween(W.last.end, today) <= (e.blockDays ?? 0))) out.push(...e.blocksTopics); } return out; }

/** the weather counts the callers a spell keeps at home */
export function weatherLinks(sim: Simulation): void { sim.bus.on('caller_kept_away', () => { const W = sim.g.weather; if (W.event) W.lost++; }); }

export function weatherSystem(D: WeatherData): System { return { id: 'weather', morning(a: Api) { const W = (a.g.weather ??= newWeather()), r = a.rng, { year, month } = parts(a.date);
  if (W.event && a.date > W.event.end) endSpell(a, D);
  if (!W.event && (!W.graceUntil || a.date >= W.graceUntil)) { const can = D.events.filter(e => e.months.includes(month) && !(e.oncePerYear && W.longRainYear === year));
    if (can.length && r.float() < D.startChance[season(month)]) { const e = can[r.int(0, can.length - 1)]!; startSpell(a, D, e.id, r.int(e.days[0], e.days[1])); } }
  const ev = W.event ? D.events.find(e => e.id === W.event!.kind) : undefined; let [rain, snow] = ev ? [ev.rain, ev.snow] : D.months[String(month)] ?? [0.2, 0];
  if (!ev) { if (W.today === 'rain' && rain > 0) rain += D.persistence; if (W.today === 'snow' && snow > 0) snow += D.persistence; }
  const x = r.float(); W.today = x < snow ? 'snow' : x < snow + rain ? 'rain' : 'clear';
  W.visit = Math.max(D.visit.min, Math.min(D.visit.max, (W.today === 'rain' ? D.visit.rain : W.today === 'snow' ? D.visit.snow : 1) * (ev?.visit ?? 1))); } }; }

/** the words the papers may use for the weather of these days: none in plain fine weather */
export function weatherWords(W: WeatherState | undefined, D: WeatherData): string[] { if (!W) return []; const ev = W.event && D.events.find(e => e.id === W.event!.kind); return ev ? ev.words : D.dayWords[W.today] ?? []; }
/** a short note for a paper with a weather desk: a spell began, goes on, or ended since the last issue */
export function weatherNote(W: WeatherState | undefined, D: WeatherData, since: DateStr, today: DateStr, rng: Api['rng'], desk: number): { headline: string; lead: string; importance: number } | null { if (!W || desk <= 0) return null;
  const ended = !W.event && W.last && W.last.end >= since ? W.last : undefined, sp = W.event ?? ended; if (!sp) return null; const ev = D.events.find(e => e.id === sp.kind), N = D.notes[sp.kind]; if (!ev || !N) return null;
  if (rng.float() >= desk * (0.5 + ev.strength * 0.5)) return null;
  const phase = ended ? 'end' : sp.start > since ? 'start' : 'ongoing', list = N[phase].length ? N[phase] : N.start, text = list[rng.int(0, list.length - 1)]!.replace('{days}', String(daysBetween(sp.start, today) + 1));
  return { headline: `날씨 — ${N.title}${phase === 'end' ? ' 물러가' : phase === 'start' ? '' : ' 이어져'}`, lead: text, importance: ev.strength >= 0.9 && phase !== 'end' ? 2 : 1 }; }
