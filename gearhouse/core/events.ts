// Systems never call each other: they publish and subscribe here (plan 9: one arrow = one or more events).
// Event names and payloads are declared in one map so a typo is a compile error.
import type { DateStr } from './calendar';
import type { Incident } from './state';

export interface GameEvents {
  day_started: { date: DateStr; weekday: number; workday: boolean; holiday: string | null };
  phase_changed: { date: DateStr; phase: 'morning' | 'day' | 'evening' };
  day_ended: { date: DateStr };
  incident_raised: { incident: Incident };
  incident_resolved: { incident: Incident; choice: string };
  incident_expired: { incident: Incident };
  hours_spent: { date: DateStr; taskId: string; hours: number; who: string };
  task_done: { date: DateStr; taskId: string };
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
