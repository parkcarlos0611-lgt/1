// Weather and seasonal events (review 11): each day is clear, rainy or snowy; now and then a spell of some days
// or weeks holds (a cold wave, a blizzard, a long rain, a heat wave, a drought, a fine autumn). A spell lasts a
// month at most, a long rain comes once a year at most, and after a spell there is a grace before the next may begin.
// Weather keeps people from calling in person; half of those kept away by a spell come when it is over.
import { addDays, daysBetween, parts, type DateStr } from './calendar';
import type { Api, System } from './sim';

export type Sky = 'clear' | 'rain' | 'snow';
export interface WeatherEvent { id: string; months: number[]; days: [number, number]; rain: number; snow: number; visit: number; strength: number; oncePerYear?: boolean; words: string[] }
export interface WeatherData { months: Record<string, [number, number]>; persistence: number; visit: { rain: number; snow: number; min: number; max: number }; startChance: { winter: number; summer: number; other: number };
  grace: [number, number]; graceWinter: [number, number]; maxDays: number; returnShare: number; returnDays: number; events: WeatherEvent[]; dayWords: Record<Sky, string[]>;
  notes: Record<string, { title: string; start: string[]; ongoing: string[]; end: string[] }> }
export interface WeatherState { today: Sky; /** how callers in person are multiplied today */ visit: number; event?: { kind: string; start: DateStr; end: DateStr }; /** the spell that ended last */ last?: { kind: string; start: DateStr; end: DateStr };
  graceUntil?: DateStr; longRainYear?: number; /** callers a spell kept away, and those of them now due to come */ lost: number; returning: number }
export const newWeather = (): WeatherState => ({ today: 'clear', visit: 1, lost: 0, returning: 0 });
const season = (month: number) => (month === 12 || month <= 2 ? 'winter' : month >= 6 && month <= 8 ? 'summer' : 'other');

export function weatherSystem(D: WeatherData): System { return { id: 'weather', morning(a: Api) { const W = (a.g.weather ??= newWeather()), r = a.rng, { year, month } = parts(a.date);
  if (W.event && a.date > W.event.end) { const g = season(month) === 'winter' ? D.graceWinter : D.grace; W.last = W.event; delete W.event; W.graceUntil = addDays(a.date, r.int(g[0], g[1]));
    W.returning += Math.floor(W.lost * D.returnShare); W.lost = 0; a.bus.emit('weather_event_ended', { kind: W.last.kind, date: a.date }); a.log('weather_end:' + W.last.kind); }
  if (!W.event && (!W.graceUntil || a.date >= W.graceUntil)) { const can = D.events.filter(e => e.months.includes(month) && !(e.oncePerYear && W.longRainYear === year));
    if (can.length && r.float() < D.startChance[season(month)]) { const e = can[r.int(0, can.length - 1)]!, days = Math.min(D.maxDays, r.int(e.days[0], e.days[1]));
      W.event = { kind: e.id, start: a.date, end: addDays(a.date, days - 1) }; if (e.oncePerYear) W.longRainYear = year; a.bus.emit('weather_event_started', { kind: e.id, date: a.date, days }); a.log('weather_start:' + e.id); } }
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
