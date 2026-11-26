// The design system's few rules that are not drawing (docs/systems/110 G2), kept pure for the tests: how far a stat bar
// fills for a figure, what a change shows (the part gained or lost), and the figure counting to its new value.
import type { Role } from './tokens';

/** a stat the bars show: its name, unit, the span its bar covers, its colour, its icon; `low`: a lower figure is
 *  better (a 0-100 time), so the bar fills from the span's top down (G4) */
export interface StatDef { id: string; name: string; unit: string; min: number; max: number; role: Role; icon: string; digits: number; low?: boolean }
/** power, weight, grip, top speed: spans wide enough for the 1930s cars and the 1990s supercars alike */
export const STATS = {
  power: { id: 'power', name: '출력', unit: 'hp', min: 0, max: 700, role: 'yellow', icon: 'engine', digits: 0 },
  weight: { id: 'weight', name: '무게', unit: 'kg', min: 500, max: 2000, role: 'blue', icon: 'body', digits: 0 },
  grip: { id: 'grip', name: '그립', unit: 'g', min: 0.5, max: 1.5, role: 'green', icon: 'wheel', digits: 2 },
  top: { id: 'top', name: '최고 속도', unit: 'km/h', min: 0, max: 400, role: 'orange', icon: 'flag', digits: 0 },
} as const satisfies Record<string, StatDef>;
export type StatId = keyof typeof STATS;

/** the least a bar shows for any figure above its span's bottom: a sliver, so a small value never reads as none */
export const SLIVER = 0.03;
/** the share of its track a bar fills for a figure (0..1): its place in the span, held to the ends; a figure at or
 *  below the bottom (or not a number) is empty, one just above it a sliver (a `low` stat the other way round) */
export function statShare(v: number, s: { min: number; max: number; low?: boolean }): number {
  if (!Number.isFinite(v) || !(s.max > s.min)) return 0;
  const k = s.low ? (s.max - v) / (s.max - s.min) : (v - s.min) / (s.max - s.min);
  return k <= 0 ? 0 : Math.max(SLIVER, Math.min(1, k)); }
/** a change of a bar from one share to another: the part kept (`base`), and the part `gained` (grown into, drawn
 *  light ahead of the fill) or `lost` (cut away, drawn red behind it). One of gained and lost is 0 */
export function barDelta(from: number, to: number): { base: number; gained: number; lost: number } {
  const a = Math.max(0, Math.min(1, Number.isFinite(from) ? from : 0)), b = Math.max(0, Math.min(1, Number.isFinite(to) ? to : 0));
  return { base: Math.min(a, b), gained: Math.max(0, b - a), lost: Math.max(0, a - b) }; }
/** the figure on its way from a to b, t (0..1) of the way through the count: eased out, so it slows into the value */
export function tweenValue(a: number, b: number, t: number): number { const k = Math.max(0, Math.min(1, t)), e = 1 - Math.pow(1 - k, 3); return a + (b - a) * e; }
/** a figure written as its stat writes it */
export const statText = (v: number, s: { digits: number }): string => Number.isFinite(v) ? v.toFixed(s.digits) : '-';
/** money written for the top band: thousands grouped, the won sign */
export const moneyText = (v: number): string => `₩${Math.round(Number.isFinite(v) ? v : 0).toLocaleString('en-US')}`;
