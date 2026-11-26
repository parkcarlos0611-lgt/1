// Passing conditions (review 09, chapter 3): what the papers warned of and now holds for some weeks — who comes
// asking, what they can spend and want, how suppliers deliver, what adverts and power cost. Other systems only
// ask for the multiplier or the addition that holds today.
import type { DateStr } from './calendar';
import type { GameState } from './state';

export type CondKind = 'demand_type' | 'budget' | 'cannot_pay' | 'want' | 'supplier_lead' | 'supplier_reliability' | 'material_quality' | 'ad_cost' | 'utilities';
/** `key` narrows it to one customer type, must-have, supplier or part; without a key it holds for all */
export interface Condition { kind: CondKind; key?: string; value: number; until: DateStr; from: string }
/** kinds whose values add up; the others multiply */
const ADDS: CondKind[] = ['cannot_pay', 'want', 'material_quality'];
export const MAX_AT_ONCE = 2;
/** all demand multipliers together stay within these */
export const DEMAND_RANGE: [number, number] = [0.5, 1.6];

const strength = (c: Condition) => (ADDS.includes(c.kind) ? Math.abs(c.value) : Math.abs(Math.log(c.value)));
export function active(g: GameState, kind: CondKind, key?: string): Condition[] { const d = g.clock.date; return (g.conditions ?? []).filter(c => c.kind === kind && c.until > d && (c.key === undefined || key === undefined || c.key === key)); }
export const mult = (g: GameState, kind: CondKind, key?: string): number => active(g, kind, key).reduce((t, c) => t * c.value, 1);
export const plus = (g: GameState, kind: CondKind, key?: string): number => active(g, kind, key).reduce((t, c) => t + c.value, 0);
/** a new condition begins; at most two of a kind hold at once, and a weaker one gives way to a stronger */
export function begin(g: GameState, c: Condition): boolean { const d = g.clock.date; g.conditions = (g.conditions ?? []).filter(x => x.until > d);
  const same = g.conditions.filter(x => x.kind === c.kind);
  if (same.length >= MAX_AT_ONCE) { const weakest = same.reduce((x, y) => (strength(x) <= strength(y) ? x : y)); if (strength(weakest) >= strength(c)) return false; g.conditions.splice(g.conditions.indexOf(weakest), 1); }
  g.conditions.push(c); return true; }
/** the same rule for the plain demand multipliers kept by the market */
export function beginBoost(list: { until: DateStr; mult: number; from: string }[], b: { until: DateStr; mult: number; from: string }): boolean { const s = (x: { mult: number }) => Math.abs(Math.log(x.mult));
  if (list.length >= MAX_AT_ONCE) { const weakest = list.reduce((x, y) => (s(x) <= s(y) ? x : y)); if (s(weakest) >= s(b)) return false; list.splice(list.indexOf(weakest), 1); }
  list.push(b); return true; }
