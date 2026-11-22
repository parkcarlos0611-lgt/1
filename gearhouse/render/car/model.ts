// One car as a 3D part model (decision of 2026-11-20): every part has one box in the car's space (x from the front
// bumper back, y from the centre line outwards, z up; mm) and its outline from the side, front, rear and above, each
// stored in the unit box. A view is made by putting every outline into its part's box, so a part sits at the same
// place in every view, and by ordering parts by where they are: in the side view the part further out is in front,
// in the front view the part further forward, in the rear view the part further back, in the plan the higher part.
// Nobody writes a drawing order. Moving or resizing a box changes all views together.
import type { CarDesign, Detail, Feature, Material, Panel, Pt, Slot, Surface, WheelSpec } from './types';

export type ViewName = 'left' | 'right' | 'front' | 'rear' | 'top';
type OutlineKey = 'side' | 'front' | 'rear' | 'top';
export interface CarPart {
  id: string; element: string; material: Material; surface: Surface; slot?: Slot;
  box: { x: [number, number]; y: [number, number]; z: [number, number] };
  /** one each side of the centre line (y is then the left one's) */
  pair: boolean;
  outlines: Partial<Record<OutlineKey, [number, number, number][]>>;
  /** where the sheet draws the part in each view: [across0, across1, up0, up1] in that view's axes (side x,z; front and rear y,z; top x,y).
   *  Each view is drawn there, so it keeps the sheet's proportions; `box` is the common place used for order, exchange and physics. */
  sheet?: Partial<Record<OutlineKey, [number, number, number, number]>>;
  detail?: Detail; features?: Partial<Record<OutlineKey, any[]>>;
  /** parts this one runs into without a seam (render/car/types.ts Panel.join) */
  join?: string[];
  /** the wheel arch cut out of this part in the side view */
  cutWheel?: { i: number; r: number };
  /** drawn as a wheel when seen flat on (the spare, from behind) */
  wheel?: { r: number };
  /** a small step forward in the order, for a part lying on another's surface (a lens on its lamp) */
  lift?: number;
  /** 'chassis': under the body, drawn only in the chassis views */
  layer?: string;
  /** the part lies on this part's face (a lens in its lamp, glass in the body, a core in its shell): in every view it is
   *  drawn just above that part, whatever the boxes say */
  on?: string;
  /** the part's colour as the sheet shows it (tools/ref/tiles.py) */
  color?: string;
  /** how light falls on the part in each view, read off that view of the sheet (tools/ref/modelshade.py) */
  shade?: Partial<Record<OutlineKey, { nx: number; nt: number; v: number[] }>>;
}
export interface CarModel {
  id: string; name: string; year: number; length: number; width: number; height: number; paint: string; paint2: string;
  wheels: { x: number; r: number; y: number }[]; wheel: Partial<WheelSpec>; canvas?: string; chrome?: string; glassTint?: string;
  features?: Partial<Record<OutlineKey, Feature[]>>; parts: CarPart[];
}

const lerp = (r: [number, number], u: number) => r[0] + (r[1] - r[0]) * u;
/** the design of one view; `only` keeps the named parts (to look at parts one by one) */
export function viewDesign(m: CarModel, view: ViewName, only?: (p: CarPart) => boolean, opt: { chassis?: boolean } = {}): CarDesign {
  // the chassis views: the chassis parts with the frame, axles, springs, tyres and wheels; the body views leave the chassis out
  const RUNNING = new Set(['frame', 'axle', 'spring', 'wheel']);
  if (!only) only = opt.chassis ? (p => p.layer === 'chassis' || (RUNNING.has(p.element) && !p.id.startsWith('vis_'))) : (p => p.layer !== 'chassis');   // vis_: running gear drawn off the sheet for the body views only
  const key: OutlineKey = view === 'left' || view === 'right' ? 'side' : view, C = m.width / 2;
  const depth = (p: CarPart) => (key === 'side' ? Math.max(Math.abs(p.box.y[0]), Math.abs(p.box.y[1])) : key === 'front' ? -p.box.x[0] : key === 'rear' ? p.box.x[1] : p.box.z[1]) + (p.lift ?? 0) * 3;
  type Item = { d: number; n: number; p?: CarPart; sign?: 1 | -1; w?: number };
  const items: Item[] = []; let n = 0;
  for (const p of m.parts) { if (only && !only(p)) continue; if (!p.outlines[key] && !(p.wheel && key === 'rear')) continue;
    items.push({ d: depth(p), n: n++, p, sign: 1 }); if (p.pair && key !== 'side') items.push({ d: depth(p), n: n++, p, sign: -1 }); }
  if (key === 'side' && (!only || opt.chassis || only({ element: 'body' } as unknown as CarPart))) m.wheels.forEach((w, i) => items.push({ d: w.y + 57, n: n++, w: i }));
  const byId = new Map(m.parts.map(p => [p.id, p]));
  for (const it of items) { let q = it.p, k = 0; while (q?.on && byId.get(q.on) && k++ < 5) q = byId.get(q.on)!; if (q && q !== it.p) it.d = depth(q) + 0.01 * k + (it.p!.lift ?? 0) * 0.001; }
  items.sort((a, b) => a.d - b.d || a.n - b.n);
  const panels: Panel[] = [], wheels: WheelSpec[] = [], features: Feature[] = [];
  const W: WheelSpec = { x: 0, r: 0, rim: 0.6, style: 'disc', spokes: 0, rimMaterial: 'paint', ...m.wheel } as WheelSpec;
  items.forEach((it, z) => {
    if (it.w !== undefined) { const w = m.wheels[it.w]!; wheels.push({ ...W, x: w.x, r: w.r, zOrder: z }); return; }
    const p = it.p!, s = it.sign!, sb = p.sheet?.[key], b = { ...p.box };
    if (sb) { if (key === 'side') { b.x = [sb[0], sb[1]]; b.z = [sb[2], sb[3]]; } else if (key === 'top') { b.x = [sb[0], sb[1]]; b.y = [sb[2], sb[3]]; } else { b.y = [sb[0], sb[1]]; b.z = [sb[2], sb[3]]; } }
    const at = (u: number, v: number): [number, number] => key === 'side' ? [lerp(b.x, u), lerp(b.z, v)] : key === 'front' ? [C + s * lerp(b.y, u), lerp(b.z, v)] : key === 'rear' ? [C - s * lerp(b.y, u), lerp(b.z, v)] : [lerp(b.x, u), C + s * lerp(b.y, v)];
    if (p.wheel && key === 'rear') { wheels.push({ ...W, x: C, r: p.wheel.r, z: (b.z[0] + b.z[1]) / 2, zOrder: z, spare: true }); return; }
    const pts = p.outlines[key]!.map(([u, v, sharp]): Pt => { const [x, y] = at(u, v); return sharp ? [Math.round(x), Math.round(y), 1] : [Math.round(x), Math.round(y)]; });
    const panel: Panel = { id: p.id + (s < 0 ? '~' : ''), pts, material: p.material, surface: p.surface, z, element: p.element, ...(p.slot ? { slot: p.slot } : {}), ...(p.detail ? { detail: p.detail } : {}), ...(p.shade?.[key] ? { shade: p.shade[key] } : {}), ...(p.color ? { color: p.color } : {}), ...(p.join ? { join: p.join } : {}) };
    if (p.cutWheel && key === 'side') { const w = m.wheels[p.cutWheel.i]!; panel.cut = [{ x: w.x, z: w.r, r: p.cutWheel.r }]; }
    panels.push(panel);
    for (const f of p.features?.[key] ?? []) { const g = JSON.parse(JSON.stringify(f));
      if (g.pts) g.pts = g.pts.map((q: number[]) => [...at(q[0]!, q[1]!).map(Math.round), 1]); if (g.at) g.at = [...at(g.at[0], g.at[1]).map(Math.round), 1];
      if (g.kind === 'louvres') { const a = at(g.x0, g.z0), c = at(g.x1, g.z1); g.x0 = a[0]; g.z0 = a[1]; g.x1 = c[0]; g.z1 = c[1]; }
      if (g.kind === 'handle') g.len = g.len * (b.x[1] - b.x[0]);
      g.part = p.id; features.push(g as Feature); }
  });
  if (!opt.chassis) for (const f of m.features?.[key] ?? []) features.push(f);
  const top = key === 'top', across = key === 'front' || key === 'rear';
  return { id: `${m.id}_${view}`, name: `${m.name} (${view})`, year: m.year, length: across ? m.width : m.length, height: top ? m.width : m.height, paint: m.paint, paint2: m.paint2, ...(m.canvas ? { canvas: m.canvas } : {}), ...(m.chrome ? { chrome: m.chrome } : {}), ...(m.glassTint ? { glassTint: m.glassTint } : {}), panels, features, wheels, frame: 'reveal' };
}
