// Money (system design 07, the slice's minimum): a cash book of dated entries, weekly and monthly outgoings,
// a month-end statement and an eight-week look ahead that warns before the cash runs out.
import type { DateStr } from './calendar';
import { parts, weekday, addDays } from './calendar';
import type { Api, System } from './sim';
import type { GameState } from './state';
import { mult } from './conditions';

export interface Entry { date: DateStr; kind: string; amount: number; note?: string }
export interface Ledger { cash: number; entries: Entry[]; warnedMonth?: string }
export interface FinanceData { livingPerWeek: number; utilitiesPerMonth: number; rentPerMonth: number; forecastWeeks: number }
export interface Statement { month: string; income: number; spending: number; byKind: Record<string, number>; cash: number }

/** positive amounts come in, negative go out */
export function post(a: Pick<Api, 'g' | 'bus' | 'date'>, kind: string, amount: number, note?: string): void {
  if (!amount) return; const L = a.g.ledger; L.cash = Math.round((L.cash + amount) * 100) / 100; L.entries.push({ date: a.date, kind, amount, note });
  a.bus.emit(amount > 0 ? 'money_in' : 'money_out', { date: a.date, kind, amount: Math.abs(amount) });
}
export function statement(g: GameState, month: string): Statement {
  const s: Statement = { month, income: 0, spending: 0, byKind: {}, cash: g.ledger.cash };
  for (const e of g.ledger.entries) if (e.date.startsWith(month)) { if (e.amount > 0) s.income += e.amount; else s.spending -= e.amount; s.byKind[e.kind] = (s.byKind[e.kind] ?? 0) + e.amount; }
  return s;
}
/** cash at the end of each coming week from the known regular outgoings (wages, living, utilities, rent) */
export function forecast(g: GameState, f: FinanceData): number[] {
  const wages = g.employees.reduce((t, e) => t + e.wage, 0), out: number[] = []; let cash = g.ledger.cash, d = g.clock.date;
  for (let w = 0; w < f.forecastWeeks; w++) { for (let i = 0; i < 7; i++) { d = addDays(d, 1); if (weekday(d) === 6) cash -= wages + f.livingPerWeek; if (parts(d).day === 1) cash -= f.utilitiesPerMonth * mult(g, 'utilities') + f.rentPerMonth; } out.push(Math.round(cash)); }
  return out;
}
export const financeSystem = (f: FinanceData): System => ({ id: 'finance',
  evening(a) { const g = a.g, { day } = parts(a.date), month = a.date.slice(0, 7);
    if (day === 1) { post(a, 'utilities', -Math.round(f.utilitiesPerMonth * mult(g, 'utilities') * 100) / 100); post(a, 'rent', -f.rentPerMonth); }
    if (weekday(a.date) === 6) { post(a, 'living', -f.livingPerWeek);
      for (const e of g.employees) { if (g.ledger.cash >= e.wage) { post(a, 'wages', -e.wage, e.personId); a.bus.emit('wage_paid', { date: a.date, personId: e.personId, amount: e.wage }); }
        else { a.bus.emit('wage_missed', { date: a.date, personId: e.personId, amount: e.wage }); a.raise('wage_missed', 'decision', { personId: e.personId, wage: e.wage }, 7); } } }
    if (parts(addDays(a.date, 1)).day === 1) { const st = statement(g, month); a.bus.emit('month_closed', { statement: st }); a.raise('month_closed', 'notice', { ...st }); }
    const fc = forecast(g, f), dry = fc.findIndex(c => c < 0);
    if (dry >= 0 && g.ledger.warnedMonth !== month) { g.ledger.warnedMonth = month; a.bus.emit('cash_warning', { date: a.date, weeks: dry + 1 }); a.raise('cash_warning', 'decision', { weeks: dry + 1, forecast: fc }, 14); } } });
