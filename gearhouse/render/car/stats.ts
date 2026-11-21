// A car's figures from its parts (review 67): its weight, part by part (body panels by their area in sheet steel,
// glass and chrome by theirs, the running gear by what it is: the engine by its displacement, the frame by its rails'
// length), and the work of a part builder's changes (hours at the bench and dollars of material, from how much each
// slot's part was reshaped and how much inner panel had to be made). Estimates for the game, at 1929 prices.
import type { CarModel, CarPart } from './model';
import type { Fit, Slot } from './swap';

const area = (pts: number[][], b: number[]): number => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i]!, [x1, y1] = pts[(i + 1) % pts.length]!; a += x0! * y1! - x1! * y0!; } return Math.abs(a) / 2 * (b[1]! - b[0]!) * (b[3]! - b[2]!) / 1e6; };   // m2 (outline in the unit box)
/** the area a part shows in its broadest view, m2 */
function partArea(p: CarPart): number { let best = 0; for (const [v, o] of Object.entries(p.outlines)) { const b = p.sheet?.[v as 'side']; if (!o || !b) continue; best = Math.max(best, area(o as number[][], b as number[])); } return best; }
/** kilograms a square metre of each material shows (sheet thickness, flanges and bracing allowed for) */
const KG_M2: Record<string, number> = { paint: 13, paint2: 14, black: 12, canvas: 3, glass: 16, chrome: 18, wood: 9, rubber: 0, iron: 30, lens: 10, lensR: 10, white: 10 };
/** the running gear by what it is, kg */
function runningKg(p: CarPart, m: CarModel): number | null {
  const run = (m as unknown as { running?: { engine: { cc: number }; gearbox: { gears: number } } }).running;
  switch (p.id) { case 'engine': return run ? 90 + run.engine.cc * 0.055 : 220; case 'bell': return 18; case 'gearbox': return run && run.gearbox.gears > 3 ? 55 : 45;
    case 'rearDiff': return 70; case 'driveline': return 25; case 'tank': return 18; case 'muffler': return 9; case 'exhaust': case 'manifold': case 'tailpipe': return 7; case 'leafF': return 28; case 'leafR': return 40; case 'axleF': return 38; case 'axleR': return 20;
    case 'frame': return (p.box.x[1] - p.box.x[0]) / 1000 * 2 * 9; case 'tyreF': case 'tyreR': return 2 * 24; }
  if (p.element === 'frame') return (p.box.y[1] - p.box.y[0]) / 1000 * 8;
  if (p.layer === 'chassis') return 4;
  return null; }
export function weightOf(m: CarModel): number { let kg = 0;
  for (const p of m.parts) { const r = runningKg(p, m); if (r !== null) { kg += r; continue; } kg += partArea(p) * (KG_M2[p.material] ?? 8) * (p.pair ? 2 : 1); }
  return Math.round(kg + 60); }                                                      // seats, trim, wiring, the things not modelled
/** the bench work for one slot's change: hours and material dollars */
const FIT_HOURS: Record<Slot, number> = { grille: 2, lamp: 1, fenderF: 3, fenderR: 3, board: 2, bumperF: 1, bumperR: 1, tail: 0.5, wheel: 1.5 };
export function workOf(slot: Slot, fit: Fit, part?: { area: number }): { hours: number; dollars: number } {
  if (fit.grade === 'own') return { hours: 0, dollars: 0 };
  if (fit.grade === 'none') return { hours: FIT_HOURS[slot] * 0.5, dollars: 0 };
  const a = part?.area ?? 0.5, h = FIT_HOURS[slot] + fit.change * 24 * Math.min(1.5, 0.4 + a);
  return { hours: Math.round(h * 2) / 2, dollars: Math.round((2 + a * 6 * (1 + fit.change * 2)) * 4) / 4 }; }
/** the area of a slot's parts on a car (m2), for the work estimate */
export function slotArea(m: CarModel, slot: Slot): number { return m.parts.filter(p => p.slot === slot || p.id.startsWith('x_') && p.slot === slot).reduce((t, p) => t + partArea(p) * (p.pair ? 2 : 1), 0); }
