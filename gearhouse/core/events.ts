// Systems never call each other: they publish and subscribe here (plan 9: one arrow = one or more events).
// Event names and payloads are declared in one map so a typo is a compile error.
import type { DateStr } from './calendar';
import type { Incident } from './state';
import type { Statement } from './ledger';

export interface GameEvents {
  day_started: { date: DateStr; weekday: number; workday: boolean; holiday: string | null };
  phase_changed: { date: DateStr; phase: 'morning' | 'day' | 'evening' };
  day_ended: { date: DateStr };
  incident_raised: { incident: Incident };
  incident_resolved: { incident: Incident; choice: string };
  incident_expired: { incident: Incident };
  hours_spent: { date: DateStr; taskId: string; hours: number; who: string };
  task_done: { date: DateStr; taskId: string };
  money_in: { date: DateStr; kind: string; amount: number };
  money_out: { date: DateStr; kind: string; amount: number };
  month_closed: { statement: Statement };
  cash_warning: { date: DateStr; weeks: number };
  wage_paid: { date: DateStr; personId: string; amount: number };
  wage_missed: { date: DateStr; personId: string; amount: number };
  founder_created: { personId: string };
  employee_hired: { date: DateStr; personId: string; wage: number };
  employee_left: { date: DateStr; personId: string; reason: string };
}
type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;
export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<never>>>();
  on<K extends keyof GameEvents>(name: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(name); if (!set) { set = new Set(); this.handlers.set(name, set); }
    set.add(fn as Handler<never>); return () => set!.delete(fn as Handler<never>);
  }
  emit<K extends keyof GameEvents>(name: K, payload: GameEvents[K]): void {
    for (const fn of this.handlers.get(name) ?? []) (fn as Handler<K>)(payload);
  }
}
