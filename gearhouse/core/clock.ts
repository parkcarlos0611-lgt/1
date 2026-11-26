// The minute clock (reviews 34, 35; version one, step 1). The day systems still play a whole date at once
// (Simulation.stepDay); the clock runs the hours in between, at a pace the screen chooses:
//   free  - a day in 60 s (24 game minutes a real second)
//   event - while something happens on screen (a car arrives, a delivery): a game minute a real second
//   work  - hand work in the garage: twenty times real time
//   talk  - a consultation, a telephone call: the clock stands still
// The date is played at 05:00 (its arrivals, the employees' work, the evening's news), so everything a day brings is
// known before the shop opens; things that happen at a time of day (a customer at the door, a delivery van) wait in
// the agenda and come due as the clock passes them. Sleeping skips to the morning.
import { addDays, type DateStr } from './calendar';
import type { Simulation } from './sim';
import type { Incident } from './state';

export type Pace = 'free' | 'event' | 'work' | 'talk';
/** game minutes per real second */
export const RATE: Record<Pace, number> = { free: 24, event: 1, work: 1 / 3, talk: 0 };
/** the minute of the day at which the date is played */
export const DAY_PLAYED = 5 * 60;
export interface AgendaItem { id: number; date: DateStr; minute: number; kind: string; ref?: number; payload?: Record<string, unknown> }
export interface TimeState { today: DateStr; minute: number; nextId: number }
export interface Passage { stops: Incident[]; due: AgendaItem[]; days: number }

export class Clock {
  constructor(private sim: Simulation) { const g = sim.g; g.time ??= { today: g.clock.date, minute: 7 * 60, nextId: 1 }; g.agenda ??= []; }
  private get t(): TimeState { return this.sim.g.time!; }
  get today(): DateStr { return this.t.today; }
  get minute(): number { return this.t.minute; }
  /** "07:30" */
  hhmm(): string { const m = Math.floor(this.t.minute); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
  /** something that will happen at a time of day */
  schedule(item: Omit<AgendaItem, 'id'>): AgendaItem { const it = { ...item, id: this.t.nextId++ }; this.sim.g.agenda!.push(it); return it; }
  /** real seconds at a pace */
  tick(realSeconds: number, pace: Pace): Passage { return this.advance(realSeconds * RATE[pace]); }
  /** move the clock on by game minutes, playing each date at 05:00 and handing back what came due */
  advance(minutes: number): Passage { const out: Passage = { stops: [], due: [], days: 0 }, g = this.sim.g, t = this.t; let left = minutes;
    for (let guard = 0; guard < 10000; guard++) {
      if (t.minute >= DAY_PLAYED) this.play(out);
      this.collect(out);
      if (left <= 0) break;
      const mine = g.agenda!.filter(a => a.date === t.today && a.minute > t.minute).map(a => a.minute - t.minute);
      const step = Math.min(left, 1440 - t.minute, t.minute < DAY_PLAYED ? DAY_PLAYED - t.minute : Infinity, ...mine);
      t.minute += step; left -= step;
      if (t.minute >= 1440) { t.minute -= 1440; t.today = addDays(t.today, 1); out.days++; }
    }
    return out; }
  /** to bed: the clock runs to the next morning */
  sleep(wake = 6 * 60): Passage { return this.advance(1440 - this.t.minute + wake); }
  /** play every date up to today (once each) */
  private play(out: Passage) { while (this.sim.g.clock.date <= this.t.today) out.stops.push(...this.sim.stepDay().stops); }
  private collect(out: Passage) { const g = this.sim.g, t = this.t, keep: AgendaItem[] = [];
    for (const a of g.agenda!) (a.date < t.today || (a.date === t.today && a.minute <= t.minute) ? out.due : keep).push(a);
    if (keep.length !== g.agenda!.length) { g.agenda = keep; out.due.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.minute - y.minute)); } }
}
