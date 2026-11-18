// Systems never call each other: they publish and subscribe here (plan 9: one arrow = one or more events).
// Event names and payloads are declared in one map so a typo is a compile error.
export interface GameEvents {
  day_passed: { date: string };
  game_paused: { reason: string };
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
