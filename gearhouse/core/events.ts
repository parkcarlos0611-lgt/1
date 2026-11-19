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
  supplier_found: { supplierId: string; via: string };
  supplier_quote_received: { quoteId: number; supplierId: string };
  purchase_ordered: { orderId: number; supplierId: string; total: number };
  parts_delivered: { orderId: number; supplierId: string };
  delivery_delayed: { orderId: number; due: DateStr };
  stock_short: { buildId: number; step: string; part: string };
  design_finalized: { designId: string };
  build_step_done: { buildId: number; step: string; quality: number };
  defect_created: { buildId: number; step: string; kind: string; severity: number };
  car_built: { carId: number; buildId: number; designId: string };
  inquiry_received: { inquiryId: number; customerId: number; source: string };
  ad_placed: { medium: string; size: string; weeks: number };
  order_placed: { orderId: number; customerId: number; price: number };
  customer_cannot_pay: { orderId: number };
  car_delivered: { orderId: number; carId: number; satisfaction: number; standing: number };
  car_broke_down: { carId: number; kind: string; severity: number };
  reputation_changed: { field: string; value: number };
  newspaper_published: { issueId: number; publication: string; date: DateStr };
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
