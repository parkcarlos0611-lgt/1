// The builder's class wall (docs/systems/115 C1): the rung a design chose (core/design.ts format 6's `tier`) as the
// ceiling its development stays under. What the builder asks of the ladder: the chosen rung (an older design: the rung
// its figures reach), the engine's power before any restrictor, whether a change would take the power past the cap
// (and so which rung it needs), each engine slider's values that stay under the cap, an engine brought under a cap (a
// new design's start, or a move down), and what a move down would hold. Pure (no page): the power is the engine's own
// figure (race/designparts.ts engineFigures, quick), never the whole car's.
// The wall is the power only: the top speed is not a slider's or an option's to pass, it is held by the rung's limiter
// in the physics (race/design.ts), as is any power past the cap that comes another way (a move down, an engine from the
// engine designer): the restrictor. Neither blocks the change (doc 115 §3, question 5 of §11: the doc's proposal).
import { engineFigures } from '../race/designparts';
import { designFigures } from '../race/design';
import { tierById, tierFor, tierIndex, tierLock, type Tier } from '../race/tiers';
import { normalise, LIMITS, gradeBoost, gradeRedline, GRADES, type Design, type Turbos } from '../core/design';

/** the engine's power (hp, rounded as the figures are) before any restrictor */
export const freeHp = (d: Design): number => Math.round(engineFigures(d).hp);
/** the rung a design develops under: its chosen one; a design with none (an older format's) the rung it reaches */
export const chosenTier = (d: Design): Tier => (d.tier && tierById(d.tier)) || tierFor(freeHp(d));
/** a design given its class where it has none: the rung it reaches (doc 115 §7: an older design is never held at once);
 *  a design that has one comes back as it is */
export const withTier = (d: Design): Design => d.tier ? d : { ...d, tier: tierFor(freeHp(d)).id };

/** what holds a change back (doc 115 §3): the rung its power would need, and whether that rung can be chosen now */
export interface Need { need: Tier; hp: number; /** why the needed rung cannot be chosen (null: it can) */ locked: string | null }
/** a change that takes the engine past the chosen cap, and past where it is now (a car already held by its restrictor
 *  may still be changed downwards): what it needs; null where the change is free */
export function needOf(d: Design, change: (e: Design['engine']) => void, eraOpen = false): Need | null {
  const t = chosenTier(d); if (!Number.isFinite(t.hpMax)) return null;
  const e = structuredClone(d.engine); change(e); const hp = freeHp(normalise({ ...d, engine: e }));
  if (hp <= t.hpMax || hp <= freeHp(d)) return null;
  const need = tierFor(hp); return { need, hp, locked: tierLock(need, eraOpen) }; }
/** a need as the option's short reason: "P2 필요" (with the era's lock where the rung is closed) */
export const needText = (n: Need): string => `${n.need.id} 필요${n.locked ? ` · ${n.locked}` : ''}`;

/** an engine slider: its field and its range (the grade's top for the red line and the boost) */
export type CapField = 'cc' | 'redline' | 'boost';
export const capRange = (d: Design, k: CapField): readonly [number, number] => k === 'cc' ? LIMITS.cc : k === 'redline' ? [LIMITS.redline[0], gradeRedline(d.engine.grade)] : [LIMITS.boost[0], gradeBoost(d.engine.grade)];
/** a slider's wall: each of its steps' power, the values a change may reach from where it is (walking from the present
 *  value, no further than the last step under the cap or under the present power), and the first step past the wall
 *  above the present value (null: none in its range) with the rung it would need */
export interface Wall { values: number[]; hp: number[]; cap: number; now: number; /** the first value past the wall above the present one */ at: number | null; need: Tier | null }
export function sliderWall(d: Design, k: CapField, step: number): Wall {
  const [a, b] = capRange(d, k), n = Math.round((b - a) / step), values = Array.from({ length: n + 1 }, (_, i) => +(a + i * step).toFixed(4));
  const hp = values.map(v => freeHp({ ...d, engine: { ...d.engine, [k]: v } })), t = chosenTier(d), now = freeHp(d), lim = Math.max(t.hpMax, now);
  const i0 = nearest(values, d.engine[k]); let at: number | null = null, need: Tier | null = null;
  for (let i = i0 + 1; i < values.length; i++) if (hp[i]! > lim) { at = values[i]!; need = tierFor(hp[i]!); break; }
  return { values, hp, cap: t.hpMax, now, at, need }; }
const nearest = (vs: number[], v: number): number => { let best = 0; for (let i = 1; i < vs.length; i++) if (Math.abs(vs[i]! - v) < Math.abs(vs[best]! - v)) best = i; return best; };
/** where a slider moved from `from` toward `to` may stop: the last step on the way whose power stays under the wall */
export function wallStop(w: Wall, from: number, to: number): number {
  const lim = Math.max(w.cap, w.now), i0 = nearest(w.values, from), i1 = nearest(w.values, to), dir = Math.sign(i1 - i0); let i = i0;
  while (i !== i1 && w.hp[i + dir]! <= lim) i += dir;
  return w.values[i]!; }

/** an engine brought under a power cap, the least taken off first (doc 115 C1: a new design on a lower rung starts with
 *  the 599's engine made to fit it): the boost down, then a turbo at a time, the displacement, the grade, the red line.
 *  An engine that cannot come under it (the smallest is still more) comes as near as it can: the restrictor holds the rest */
export function fitEngine(d0: Design, cap: number): Design {
  let d = normalise(d0); if (!Number.isFinite(cap) || freeHp(d) <= cap) return d;
  const over = () => freeHp(d) > cap, set = (f: (e: Design['engine']) => void) => { const e = structuredClone(d.engine); f(e); d = normalise({ ...d, engine: e }); };
  while (over() && d.engine.turbo && d.engine.boost > LIMITS.boost[0] + 1e-6) set(e => { e.boost = Math.max(LIMITS.boost[0], +(e.boost - 0.05).toFixed(2)); });
  while (over() && d.engine.turbo) set(e => { e.turbo = (e.turbo - 1) as Turbos; e.boost = gradeBoost(e.grade); if (e.turbo < 2) delete e.sequential; });
  // with the last turbo gone the boost does not count; the displacement down to where it fits (or the smallest)
  while (over() && d.engine.cc > LIMITS.cc[0]) set(e => { e.cc = Math.max(LIMITS.cc[0], e.cc - 50); });
  while (over() && d.engine.grade > GRADES[0]!) set(e => { e.grade = (e.grade - 1) as Design['engine']['grade']; });
  while (over() && d.engine.redline > LIMITS.redline[0]) set(e => { e.redline = Math.max(LIMITS.redline[0], e.redline - 100); });
  // the turbo cars' boost brought back up where the cap still allows it (the first loop may have taken off too much)
  return d; }

/** what moving to another rung would hold (doc 115 §3 차급 바꾸기): the restrictor's cut (hp) and the limiter where it
 *  would hold the car (km/h, with the top speed it would have without it); a move up holds nothing */
export interface Move { to: Tier; down: boolean; cut: number; hp: number; limiter: number; top: number }
export function moveTo(d: Design, to: Tier): Move {
  const from = chosenTier(d), f = designFigures({ ...d, tier: to.id });
  return { to, down: tierIndex(to) < tierIndex(from), cut: f.restrictor, hp: f.hpFree, limiter: f.limiter, top: f.topFree }; }
