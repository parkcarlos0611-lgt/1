// The car kit's small geometry: vector helpers and the curves every line table is read through.
// Shared by the line system, the standard section, the panels and the parts (no car keeps its own copy).
import type { V } from '../mesh';
export type { V };
/** a table of [x, value] pairs, x in order */
export type Tab = [number, number][];
/** a grid of points: rows going back along the car, columns going out and down (the car's right half, y >= 0) */
export type Grid = V[][];

export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scl = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
export const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
export const un = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** a smooth step from a to b */
export const sm = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** the point on the side sg (+1 the right as built, -1 its mirror image) */
export const mir = (p: V, sg: number): V => [p[0], p[1] * sg, p[2]];
/** the middle of some points */
export const centroid = (pts: V[]): V => { const c: V = [0, 0, 0]; for (const p of pts) { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; } return c; };
/** the super-ellipse's quarter: the share along at share f across (p the power; 2 a circle) and its inverse */
export const gp = (f: number, p: number) => 1 - (1 - clamp01(f) ** p) ** (1 / p);
export const ginv = (v: number, p: number) => (1 - (1 - clamp01(v)) ** p) ** (1 / p);
/** a cubic Bezier from a to d through the controls b and c */
export const bez = (a: V, b: V, c: V, d: V, t: number): V => { const v = 1 - t; return [0, 1, 2].map(k => v * v * v * a[k]! + 3 * v * v * t * b[k]! + 3 * v * t * t * c[k]! + t * t * t * d[k]!) as V; };

/** straight runs through a table whose x falls (heights going down; held flat beyond its ends) */
export function lin(tab: Tab): (x: number) => number { return x => { if (x >= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x >= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; }; }
/** a smooth curve through a table: a monotone cubic (it never overshoots a point), held flat beyond its ends */
export function curve(tab: Tab): (x: number) => number { const n = tab.length, h: number[] = [], d: number[] = [], m: number[] = [];
  for (let i = 0; i + 1 < n; i++) { h[i] = tab[i + 1]![0] - tab[i]![0]; d[i] = (tab[i + 1]![1] - tab[i]![1]) / h[i]!; }
  for (let i = 0; i < n; i++) { if (i === 0 || i === n - 1) { m[i] = d[i === 0 ? 0 : n - 2]!; continue; } const a = d[i - 1]!, c = d[i]!; if (a * c <= 0) { m[i] = 0; continue; } const w1 = 2 * h[i]! + h[i - 1]!, w2 = h[i]! + 2 * h[i - 1]!; m[i] = (w1 + w2) / (w1 / a + w2 / c); }
  return x => { if (x <= tab[0]![0]) return tab[0]![1]; if (x >= tab[n - 1]![0]) return tab[n - 1]![1]; let i = 0; while (x > tab[i + 1]![0]) i++; const t = (x - tab[i]![0]) / h[i]!, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * tab[i]![1] + (t3 - 2 * t2 + t) * h[i]! * m[i]! + (3 * t2 - 2 * t3) * tab[i + 1]![1] + (t3 - t2) * h[i]! * m[i + 1]!; }; }
/** the shares along a polyline (0 at its start, 1 at its end) */
export function shares(P: V[]): number[] { const s = [0]; for (let i = 1; i < P.length; i++) s.push(s[i - 1]! + len(sub(P[i]!, P[i - 1]!))); const T = s[s.length - 1]! || 1; return s.map(v => v / T); }
