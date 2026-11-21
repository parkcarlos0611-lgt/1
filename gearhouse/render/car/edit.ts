// A player's car = a measured base car + three layers of change (plan: measured data with freedom):
//  1 proportions: sections of the car stretched (front overhang, hood, cabin, rear overhang, body height, greenhouse)
//  2 parts: grille, lamps, bumpers and wheels taken from other cars and re-fitted to this car's mounting points, then nudged
//  3 points: any panel outline point moved by hand; stored as offsets, so they survive later changes to 1 and 2
// With no changes the result is the measured car itself.
import type { CarDesign, Feature, Panel, Pt, Slot } from './types';

export interface CarEdit {
  base: string;
  paint?: string; paint2?: string;
  /** millimetres added to each section; body and green are scale factors for the body height and the greenhouse */
  prop: { frontOH: number; hood: number; cabin: number; rearOH: number; body: number; green: number };
  /** slot -> id of the car the part comes from */
  swaps: Partial<Record<Slot | 'wheel', string>>;
  /** slot -> offset in mm */
  nudge: Partial<Record<Slot, [number, number]>>;
  /** panel id -> point index -> offset in mm */
  moves: Record<string, Record<number, [number, number]>>;
}
export const newEdit = (base: string): CarEdit => ({ base, prop: { frontOH: 0, hood: 0, cabin: 0, rearOH: 0, body: 1, green: 1 }, swaps: {}, nudge: {}, moves: {} });
export const PROP_RANGE = { frontOH: [-200, 400], hood: [-400, 700], cabin: [-400, 900], rearOH: [-300, 700], body: [0.85, 1.2], green: [0.75, 1.25] } as const;
export const SLOTS: (Slot | 'wheel')[] = ['grille', 'lamp', 'tail', 'bumperF', 'bumperR', 'wheel'];

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
function box(panels: Panel[]) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of panels) for (const q of p.pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); } return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 }; }

export function buildCar(bases: Record<string, CarDesign>, e: CarEdit): CarDesign {
  const d = clone(bases[e.base]!), M = d.marks!;
  if (e.paint) d.paint = e.paint; if (e.paint2) d.paint2 = e.paint2;
  // ---- 2 parts from other cars, fitted to this car's own mounting point (the centre of the part it replaces) ----
  for (const slot of SLOTS) { const from = e.swaps[slot]; if (!from || from === e.base || !bases[from]) continue; const src = bases[from]!;
    if (slot === 'wheel') { const w = src.wheels.find(q => !q.spare)!; d.wheels = d.wheels.map(q => (q.spare ? q : { ...q, style: w.style, spokes: w.spokes, rim: w.rim, rimMaterial: w.rimMaterial, whitewall: w.whitewall })); continue; }
    const mine = d.panels.filter(p => p.slot === slot), theirs = clone(src.panels.filter(p => p.slot === slot)); if (!mine.length || !theirs.length) continue;
    const a = box(mine), b = box(theirs), front = slot === 'grille' || slot === 'lamp' || slot === 'bumperF';
    // bumpers and the grille keep their outer end on this car's; lamps keep their centre
    const dx = slot === 'lamp' || slot === 'tail' ? a.cx - b.cx : front ? a.x0 - b.x0 : a.x1 - b.x1, dz = slot === 'grille' ? a.z0 - b.z0 : a.cz - b.cz;
    for (const p of theirs) { for (const q of p.pts) { q[0] += dx; q[1] += dz; } p.id = slot + ':' + p.id; }
    d.panels = d.panels.filter(p => p.slot !== slot).concat(theirs); }
  for (const [slot, off] of Object.entries(e.nudge)) for (const p of d.panels) if (p.slot === slot) for (const q of p.pts) { q[0] += off![0]; q[1] += off![1]; }
  // ---- 1 proportions: stretch between the wheels and the body's stations; the wheel arches stay round ----
  const g = M.gap + 40, P = e.prop, zones: [number, number, number][] = [[0, M.fx - g, P.frontOH], [M.fx + g, M.cowl, P.hood], [M.cowl, Math.max(M.cowl + 60, Math.min(M.cab, M.rx - g)), P.cabin], [M.rx + g, d.length, P.rearOH]];
  const knots: [number, number][] = [[-1e5, -1e5]]; let shift = 0;
  for (const [a, b, add] of zones) { if (b - a < 60) continue; const dd = Math.max(-(b - a) * 0.6, add); knots.push([a, a + shift]); shift += dd; knots.push([b, b + shift]); }
  knots[0] = [-1e5, -1e5 + (knots[1] ? knots[1][1] - knots[1][0] : 0)]; knots.push([1e5, 1e5 + shift]);
  const X = (x: number) => { for (let i = 1; i < knots.length; i++) if (x <= knots[i]![0]) { const [a, A] = knots[i - 1]!, [b, B] = knots[i]!; return A + (x - a) * (B - A) / (b - a); } return x + shift; };
  const x00 = X(0), XX = (x: number) => X(x) - x00;                                       // the nose stays at 0
  const belt2 = M.r + (M.belt - M.r) * P.body, Z = (z: number) => (z <= M.r ? z : z <= M.belt ? M.r + (z - M.r) * P.body : belt2 + (z - M.belt) * P.green);
  const mapPt = (q: Pt) => { q[0] = Math.round(XX(q[0])); q[1] = Math.round(Z(q[1])); };
  for (const p of d.panels) { if (p.rigid) { const b = box([p]), dx = XX(b.cx) - b.cx, dz = Z(b.cz) - b.cz; for (const q of p.pts) { q[0] = Math.round(q[0] + dx); q[1] = Math.round(q[1] + dz); } } else p.pts.forEach(mapPt);
    for (const c of p.cut ?? []) c.x = Math.round(XX(c.x)); }
  for (const w of d.wheels) { w.x = Math.round(XX(w.x)); if (w.z) w.z = Math.round(Z(w.z)); }
  d.features = d.features.map((f): Feature => { const c = clone(f);
    if ('pts' in c) c.pts.forEach(mapPt); if ('at' in c) mapPt(c.at);
    if (c.kind === 'louvres') { c.x0 = XX(c.x0); c.x1 = XX(c.x1); c.z0 = Z(c.z0); c.z1 = Z(c.z1); c.n = Math.max(3, Math.round(c.n * (c.x1 - c.x0) / Math.max(1, f.kind === 'louvres' ? f.x1 - f.x0 : 1))); }
    return c; });
  d.length = Math.ceil(XX(d.length)); d.height = Math.ceil(Z(d.height));
  d.marks = { ...M, fx: XX(M.fx), rx: XX(M.rx), cowl: XX(M.cowl), cab: XX(M.cab), belt: Z(M.belt), roof: Z(M.roof) };
  // ---- 3 hand-moved points ----
  for (const p of d.panels) { const mv = e.moves[p.id]; if (!mv) continue; for (const [i, off] of Object.entries(mv)) { const q = p.pts[+i]; if (q) { q[0] += off[0]; q[1] += off[1]; } } }
  return d;
}
