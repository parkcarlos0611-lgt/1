import { describe, expect, it } from 'vitest';
import { signals } from '../tools/signals';

/** Signals no system listens to yet. Each waits for the system named beside it (plan 12); a signal that is new here, or one that is no longer unheard, makes the test fail so the list stays true. */
const WAITING: Record<string, string> = {
  ad_placed: 'screens', build_step_done: 'screens', car_built: 'screens', day_ended: 'screens', day_started: 'screens', design_finalized: 'screens', founder_created: 'screens', hours_spent: 'screens', incident_expired: 'screens', incident_raised: 'screens', incident_resolved: 'screens',
  inquiry_received: 'screens', newspaper_published: 'screens', parts_delivered: 'screens', phase_changed: 'screens', purchase_ordered: 'screens', supplier_found: 'screens', supplier_quote_received: 'screens', task_done: 'screens', weather_event_started: 'screens',
  cash_warning: 'banks and loans', customer_cannot_pay: 'banks and loans', loan_taken: 'screens', bank_failed: 'people (unpaid wages), papers', bankrupt: 'screens (the end of a game)', wage_missed: 'people', wage_paid: 'people', employee_left: 'people', reputation_changed: 'people, banks, rivals',
  defect_created: 'build (repairs)', delivery_delayed: 'build (excused days)', stock_short: 'build (excused days)' };
describe('signals between systems', () => {
  it('every signal is either heard or on the list of those that wait for a system', () => { const s = signals(['core']); expect(s.unheard).toEqual(Object.keys(WAITING).sort()); expect(Object.keys(s.sent).length).toBeGreaterThan(30); });
});
