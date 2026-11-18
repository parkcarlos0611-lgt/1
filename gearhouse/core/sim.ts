// The daily tick (system design 01, chapter 9). A Simulation holds the state, the one random source and the event bus;
// systems plug in as plain objects with a hook per phase. stepDay plays the current date and moves to the next.
import { addDays, holidayOn, weekday, type DateStr, type HolidayData } from './calendar';
import { EventBus } from './events';
import { Rng } from './rng';
import type { GameState, Grade, Incident, Phase, Task } from './state';

export interface Api {
  g: GameState; rng: Rng; bus: EventBus; date: DateStr; workday: boolean;
  raise(kind: string, grade: Grade, payload?: Record<string, unknown>, deadlineDays?: number): Incident;
  log(text: string): void;
}
export interface System { id: string; morning?(a: Api): void; day?(a: Api): void; evening?(a: Api): void }
export interface DayResult { date: DateStr; holiday: string | null; workday: boolean; stops: Incident[] }

const FATIGUE_FREE_OVERTIME = 10;       // overtime hours a week before it starts to cost (data later)

export class Simulation {
  readonly bus = new EventBus();
  readonly rng: Rng;
  private systems: System[] = [];
  constructor(public g: GameState, private holidays: HolidayData) { this.rng = new Rng(g.seed); if (g.rng) this.rng.load(g.rng); }
  use(s: System): this { this.systems.push(s); return this; }

  addTask(t: Omit<Task, 'hoursDone' | 'done'>): void { this.g.tasks[t.id] = { ...t, hoursDone: 0, done: false }; }

  /** answer an open incident */
  resolve(id: number, choice: string): void { const it = this.g.incidents.find(i => i.id === id); if (!it || it.state !== 'open') throw new Error('no open incident ' + id);
    it.state = 'resolved'; it.choice = choice; this.bus.emit('incident_resolved', { incident: it, choice }); }

  stepDay(): DayResult {
    const g = this.g, date = g.clock.date, wd = weekday(date), holiday = holidayOn(date, this.holidays), workday = !holiday && !g.settings.daysOff.includes(wd), stops: Incident[] = [];
    let phase: Phase = 'morning';
    const api: Api = { g, rng: this.rng, bus: this.bus, date, workday,
      raise: (kind, grade, payload = {}, deadlineDays) => { const quiet = grade === 'notice' && g.settings.quietKinds.includes(kind);
        const it: Incident = { id: g.nextIncidentId++, kind, grade: quiet ? 'log' : grade, date, phase, payload, state: grade === 'decision' ? 'open' : 'resolved', deadline: deadlineDays != null ? addDays(date, deadlineDays) : undefined };
        g.incidents.push(it); this.bus.emit('incident_raised', { incident: it }); if (it.grade !== 'log') stops.push(it); else g.journal.push({ date, text: kind }); return it; },
      log: text => { g.journal.push({ date, text }); } };
    this.bus.emit('day_started', { date, weekday: wd, workday, holiday });
    if (wd === 1) g.founder.overtimeThisWeek = 0;
    if (holiday) api.log('holiday:' + holiday);                              // a skipped day: nothing arrives, nobody works
    else {
      for (phase of ['morning', 'day', 'evening'] as Phase[]) { this.bus.emit('phase_changed', { date, phase });
        if (phase === 'day' && workday) this.work(api);
        for (const s of this.systems) s[phase]?.(api); }
      // decisions left unanswered past their deadline are lost
      for (const it of g.incidents) if (it.state === 'open' && it.deadline && it.deadline < date) { it.state = 'expired'; this.bus.emit('incident_expired', { incident: it }); api.log('expired:' + it.kind); }
    }
    this.bus.emit('day_ended', { date }); g.clock.date = addDays(date, 1); g.rng = this.rng.save();
    return { date, holiday, workday, stops };
  }

  /** the founder's hours go down the plan in order; hours no slot takes go to the first unfinished task */
  private work(a: Api): void {
    const g = this.g, f = g.founder, tired = f.fatigue > 0 ? 0.9 : 1; let left = f.hoursPerDay + f.overtimePerDay;
    f.overtimeThisWeek += f.overtimePerDay;
    const spend = (t: Task, cap: number) => { const h = Math.min(left, cap, (t.hoursNeeded - t.hoursDone) / tired); if (h <= 0) return; left -= h; t.hoursDone += h * tired;
      this.bus.emit('hours_spent', { date: a.date, taskId: t.id, hours: h, who: 'founder' });
      if (t.hoursDone >= t.hoursNeeded - 1e-9) { t.hoursDone = t.hoursNeeded; t.done = true; this.bus.emit('task_done', { date: a.date, taskId: t.id }); a.raise('task_done', 'notice', { taskId: t.id }); } };
    for (const slot of g.plan) { const t = g.tasks[slot.taskId]; if (t && !t.done) spend(t, slot.maxHours ?? Infinity); }
    if (left > 0) for (const t of Object.values(g.tasks)) { if (!t.done) spend(t, Infinity); if (left <= 0) break; }
    if (weekday(a.date) === 6) f.fatigue = f.overtimeThisWeek > FATIGUE_FREE_OVERTIME ? f.fatigue + 1 : 0;   // Saturday night: a hard week tells next week
  }

  /** play days until something stops the game or the limit is reached (the skip buttons) */
  runUntilStop(maxDays: number): DayResult[] { const out: DayResult[] = []; for (let i = 0; i < maxDays; i++) { const r = this.stepDay(); out.push(r); if (r.stops.length) break; } return out; }
}
