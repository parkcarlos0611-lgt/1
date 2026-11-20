// Line drawings of a car's 3D part model for the drawing board (review 26): every view drawn as lines only, at a
// coarse scale, from the same parts as the finished pictures. A line pixel is where a part's visible area meets
// another part or the paper; shut lines and beads drawn on the parts are added.
import { viewDesign, type CarModel, type CarPart } from '../../render/car/model';
import { smoothClosed, smoothOpen } from '../../render/car/geom';
import type { Pt } from '../../render/car/types';

export interface LineMap { w: number; h: number; on: Uint8Array; owner: Int16Array; names: string[] }
export interface Edit { wb: number; roof: number; lift: number; rack: boolean }
export const NO_EDIT: Edit = { wb: 0, roof: 0, lift: 0, rack: false };
const UNSPRUNG = new Set(['wheel', 'axle', 'spring']);

/** the model with the drawing board's changes: a longer wheelbase stretches the car behind the front doors, a taller
 *  roof stretches the glasshouse, a lift raises everything on the springs, a roof rack is a part of its own */
export function edited(m0: CarModel, e: Edit): CarModel {
  const m = JSON.parse(JSON.stringify(m0)) as CarModel;
  const f = (x: number) => (x <= 1700 ? x : x >= 2600 ? x + e.wb : x + e.wb * (x - 1700) / 900);
  const g = (z: number) => (z <= 1250 ? z : z + e.roof * (z - 1250) / 570);
  const fx = (r: number[]) => { r[0] = Math.round(f(r[0]!)); r[1] = Math.round(f(r[1]!)); };
  const gz = (r: number[], i: number, up: boolean) => { r[i] = Math.round(g(r[i]!) + (up ? e.lift : 0)); r[i + 1] = Math.round(g(r[i + 1]!) + (up ? e.lift : 0)); };
  for (const p of m.parts) { const up = !UNSPRUNG.has(p.element);
    fx(p.box.x as number[]); gz(p.box.z as number[], 0, up);
    const sh = p.sheet as Record<string, number[]> | undefined;
    if (sh?.side) { const s = sh.side; const a = [s[0]!, s[1]!]; fx(a); s[0] = a[0]!; s[1] = a[1]!; gz(s, 2, up); }
    if (sh?.top) { const s = sh.top; const a = [s[0]!, s[1]!]; fx(a); s[0] = a[0]!; s[1] = a[1]!; }
    for (const k of ['front', 'rear']) if (sh?.[k]) gz(sh[k]!, 2, up); }
  for (const w of m.wheels) w.x = Math.round(f(w.x));
  m.length = Math.round(f(m.length)); m.height = Math.max(...m.parts.map(p => p.box.z[1]));
  if (e.rack) { const z0 = Math.max(...m.parts.filter(p => p.element === 'roof').map(p => p.box.z[1])), x0 = Math.round(f(1900)), x1 = Math.round(f(3300));
    const rack: CarPart = { id: 'rack', element: 'rack', material: 'black', surface: 'flat', pair: false, box: { x: [x0, x1], y: [-520, 520], z: [z0, z0 + 70] },
      outlines: { side: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0.94, 1, 1], [0.94, 0.4, 1], [0.06, 0.4, 1], [0.06, 1, 1], [0, 1, 1]], front: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0.92, 1, 1], [0.92, 0.4, 1], [0.08, 0.4, 1], [0.08, 1, 1], [0, 1, 1]],
        rear: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0.92, 1, 1], [0.92, 0.4, 1], [0.08, 0.4, 1], [0.08, 1, 1], [0, 1, 1]], top: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] } };
    m.parts.push(rack); m.height = Math.max(m.height, z0 + 70); }
  return m;
}

/** figures the order is judged by */
export function measure(m: CarModel) {
  const wb = m.wheels[1]!.x - m.wheels[0]!.x, low = Math.min(...m.parts.filter(p => !UNSPRUNG.has(p.element) && p.element !== 'house' && p.element !== 'wheel').map(p => p.box.z[0]));
  return { length: m.length, wb, height: m.height, clearance: low, width: m.width, rack: m.parts.some(p => p.id === 'rack') };
}

/** the line drawing of one view at `mm` per pixel; x0, y0 place the drawing's ground-front corner on the paper */
export function lineMap(m: CarModel, view: 'left' | 'top' | 'front' | 'rear', mm: number): LineMap {
  const d = viewDesign(m, view), L = d.length, H = d.height, w = Math.ceil(L / mm) + 4, h = Math.ceil(H / mm) + 4, X = (x: number) => 2 + x / mm, Y = (z: number) => h - 2 - z / mm;
  const owner = new Int16Array(w * h).fill(-1), names: string[] = [];
  const fillPoly = (poly: [number, number][], id: number, cut?: { x: number; z: number; r: number }[]) => {
    let y0 = 1e9, y1 = -1e9; for (const [, y] of poly) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++) { const cy = y + 0.5, xs: number[] = [];
      for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i]!, [bx, by] = poly[(i + 1) % poly.length]!; if ((ay <= cy) !== (by <= cy)) xs.push(ax + (cy - ay) * (bx - ax) / (by - ay)); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k]! - 0.5)); x <= Math.min(w - 1, Math.floor(xs[k + 1]! - 0.5)); x++) {
        if (cut?.some(c => Math.hypot(x + 0.5 - X(c.x), y + 0.5 - Y(c.z)) < c.r / mm)) continue; owner[y * w + x] = id; } } };
  // drawing order as the renderer's: panels and wheels by their z
  const items: { z: number; draw: () => void }[] = [];
  for (const p of d.panels) items.push({ z: p.z, draw: () => { const id = names.push(p.id.replace('~', '')) - 1; fillPoly(smoothClosed(p.pts as Pt[]).map(([x, z]) => [X(x), Y(z)] as [number, number]), id, p.cut); } });
  for (const wsp of d.wheels) items.push({ z: wsp.zOrder ?? 5, draw: () => { const id = names.push('wheel') - 1, cx = X(wsp.x), cy = Y(wsp.z ?? wsp.r), r = wsp.r / mm;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) if (x >= 0 && y >= 0 && x < w && y < h && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r) owner[y * w + x] = id; } });
  items.sort((a, b) => a.z - b.z).forEach(i => i.draw());
  const on = new Uint8Array(w * h), at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : owner[y * w + x]!);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = owner[y * w + x]!; if (o < 0) continue;
    if (at(x + 1, y) !== o || at(x - 1, y) !== o || at(x, y + 1) !== o || at(x, y - 1) !== o) { // a boundary: the line belongs to the part in front
      if ([at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].some(n => n > o) && ![at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].some(n => n < 0)) continue;
      on[y * w + x] = 1; } }
  // wheels: the rim and the hub as circles
  for (const wsp of d.wheels) { const cx = X(wsp.x), cy = Y(wsp.z ?? wsp.r), id = names.indexOf('wheel');
    for (const rr of [wsp.r * (wsp.rim ?? 0.6), wsp.r * 0.15]) for (let a = 0; a < 6.283; a += 0.02) { const x = Math.floor(cx + Math.cos(a) * rr / mm), y = Math.floor(cy + Math.sin(a) * rr / mm); if (at(x, y) === id) on[y * w + x] = 1; } }
  // shut lines, beads and seams drawn on the parts
  for (const f of d.features) if (f.kind === 'seam' || f.kind === 'bead') { const pts = smoothOpen(f.pts as Pt[]).map(([x, z]) => [X(x), Y(z)]);
    for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i]!, [bx, by] = pts[i + 1]!, n = Math.ceil(Math.hypot(bx! - ax!, by! - ay!) * 2) + 1;
      for (let k = 0; k <= n; k++) { const x = Math.floor(ax! + (bx! - ax!) * k / n), y = Math.floor(ay! + (by! - ay!) * k / n); if (at(x, y) >= 0) on[y * w + x] = 1; } } }
  return { w, h, on, owner, names };
}

/** the pixels of a set in drawing order: walks from pixel to touching pixel, lifting the pencil only when it must */
export function strokeOrder(pix: number[], w: number): number[] {
  const left = new Set(pix), out: number[] = []; let cur = -1;
  const nearest = () => { let best = -1, bd = 1e9; const cx = cur % w, cy = (cur / w) | 0; for (const p of left) { const d = cur < 0 ? (p % w) * 1000 + ((p / w) | 0) : Math.abs(p % w - cx) + Math.abs(((p / w) | 0) - cy); if (d < bd) { bd = d; best = p; } } return best; };
  while (left.size) { let nxt = -1;
    if (cur >= 0) for (const dd of [1, -1, w, -w, w + 1, w - 1, -w + 1, -w - 1]) if (left.has(cur + dd)) { nxt = cur + dd; break; }
    if (nxt < 0) nxt = nearest(); left.delete(nxt); out.push(nxt); cur = nxt; }
  return out;
}
