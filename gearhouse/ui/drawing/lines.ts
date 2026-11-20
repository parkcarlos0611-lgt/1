// Line drawings of a car's 3D part model for the drawing board (review 26): every view drawn as lines only, at a
// coarse scale, from the same parts as the finished pictures. A line pixel is where a part's visible area meets
// another part or the paper; shut lines and beads drawn on the parts are added.
import { viewDesign, type CarModel, type CarPart } from '../../render/car/model';
import { smoothClosed, smoothOpen } from '../../render/car/geom';
import type { Pt } from '../../render/car/types';

export interface LineMap { w: number; h: number; on: Uint8Array; owner: Int16Array; names: string[] }
export interface Edit { wb: number; roof: number; lift: number; rack: boolean; door: number; lights: 6 | 4 | 2; lampX: number; lampZ: number; grilleX: number; grille: number;
  bumperF: boolean; bumperR: boolean; bumper: number; fenders: boolean; fender: number }
export const NO_EDIT: Edit = { wb: 0, roof: 0, lift: 0, rack: false, door: 0, lights: 6, lampX: 0, lampZ: 0, grilleX: 0, grille: 0, bumperF: true, bumperR: true, bumper: 0, fenders: true, fender: 0 };
/** a car's hard points and groups (data/cars/<id>_frame.json) */
export interface Frame { A: number; B: number; C: number; Q: number; K: number; seamB: number; seamC: number;
  windows: { front: string[]; rear: string[]; quarter: string[] }; steps: { front: string; rear: string }; groups: Record<string, string[]> }
const UNSPRUNG = new Set(['wheel', 'axle', 'spring']);
type Key = 'side' | 'front' | 'rear' | 'top';
type Ax = { s: number; o: number; d: number };                                 // a' = o + (a - o) s + d
const ID: Ax = { s: 1, o: 0, d: 0 };
const ap = (q: Ax, v: number) => q.o + (v - q.o) * q.s + q.d;

/** where the doors and windows sit for an edit: the front door keeps its length, the rear door takes up what the
 *  wheelbase gives or takes; with no room for the rear door the quarter window goes (4-light), then the rear doors (2-door) */
export function doorPlan(f: Frame, e: Edit) {
  const B = f.B + e.door, C = f.C + e.wb, C4 = f.Q + e.wb, D2 = Math.round(B + 0.4 * (C4 - B));
  return { B, C, C4, D2, front: B - f.A, rear6: C - B, rear4: C4 - B, two: D2 - f.A, cabin: C4 - f.A };
}
/** the lights layouts this edit has room for, best first */
export function fits(f: Frame, e: Edit, rearDoorMin: number, cabinMin: number): (6 | 4 | 2)[] {
  const d = doorPlan(f, e), out: (6 | 4 | 2)[] = []; if (d.rear6 >= rearDoorMin) out.push(6); if (d.rear4 >= rearDoorMin) out.push(4); if (d.cabin >= cabinMin) out.push(2); return out;
}

/** the model with the drawing board's changes. Every part's outlines in every view go through the same warp (the
 *  wheelbase stretch ahead of the rear wheels, the roof stretch, the lift on the springs) and then its group's own move or
 *  scale; doors, windows, handles and steps are placed from the door plan; removed groups are left out */
export function edited(m0: CarModel, e: Edit, f?: Frame): CarModel {
  const m = JSON.parse(JSON.stringify(m0)) as CarModel;
  const A = f?.A ?? 1700, K = f?.K ?? 2600;
  const Fx = (x: number) => (x <= A ? x : x >= K ? x + e.wb : x + e.wb * (x - A) / (K - A));
  const G = (z: number) => (z <= 1250 ? z : z + e.roof * (z - 1250) / 570);
  const group = (id: string) => { if (!f) return ''; for (const [g, ids] of Object.entries(f.groups)) if (ids.includes(id)) return g; return ''; };
  const plan = f ? doorPlan(f, e) : null, L = e.lights;
  // groups left out
  const gone = new Set<string>();
  if (f) { if (!e.bumperF) for (const g of ['bumperF', 'bumperFmount']) f.groups[g]!.forEach(i => gone.add(i));
    if (!e.bumperR) for (const g of ['bumperR', 'bumperRmount']) f.groups[g]!.forEach(i => gone.add(i));
    if (!e.fenders) for (const g of ['fenderF', 'fenderR', 'fenderLinked']) f.groups[g]!.forEach(i => gone.add(i));
    if (L !== 6) f.windows.quarter.forEach(i => gone.add(i)); if (L === 2) gone.add(f.steps.rear); }
  m.parts = m.parts.filter(p => !gone.has(p.id));
  // each group's own move or scale
  const shell = m0.parts.find(p => p.id === 'shell'), gs = 1 + e.grille / 100, gz0 = shell?.box.z[0] ?? 0, dTop = shell ? (shell.box.z[1] - gz0) * (gs - 1) : 0;
  const stand = m0.parts.find(p => p.id === 'lampStand'), fs = 1 + e.fender / 100, bs = 1 + e.bumper / 100;
  const T = (p: CarPart): { x: Ax; y: Ax; z: Ax } => {
    const g = group(p.id);
    if (g === 'lamp') return { x: { ...ID, d: e.lampX }, y: ID, z: { ...ID, d: e.lampZ } };
    if (g === 'lampBar') return { x: { ...ID, d: e.lampX }, y: ID, z: { ...ID, d: e.lampZ } };
    if (g === 'lampStand' && stand) { const h = stand.box.z[1] - stand.box.z[0]; return { x: { ...ID, d: e.lampX }, y: ID, z: { s: Math.max(0.1, (h + e.lampZ) / h), o: G(stand.box.z[0]) + e.lift, d: 0 } }; }
    if (g === 'grille') return { x: { ...ID, d: e.grilleX }, y: { s: gs, o: 0, d: 0 }, z: { s: gs, o: gz0 + e.lift, d: 0 } };
    if (g === 'bumperF' || g === 'bumperR') { const zc = (p.box.z[0] + p.box.z[1]) / 2 + e.lift; return { x: ID, y: { s: bs, o: 0, d: 0 }, z: { s: bs, o: zc, d: 0 } }; }
    if (g === 'fenderF' || g === 'fenderR') { const w = m0.wheels[g === 'fenderF' ? 0 : 1]!; return { x: { s: fs, o: Fx(w.x), d: 0 }, y: { s: fs, o: w.y, d: 0 }, z: { s: fs, o: w.r + e.lift, d: 0 } }; }
    return { x: ID, y: ID, z: ID };
  };
  // the hood follows the grille: its front edge moves with it, fading out at the cowl
  const hood = m0.parts.find(p => p.id === 'hood');
  const hoodPt = (key: Key, a: number, b: number): [number, number] => {
    if (!hood) return [a, b]; const x0 = Fx(hood.box.x[0]), x1 = Fx(hood.box.x[1]), t = key === 'front' || key === 'rear' ? 0 : Math.max(0, Math.min(1, (a - x0) / (x1 - x0)));
    const z0 = hood.box.z[0] + e.lift, z1 = G(hood.box.z[1]) + e.lift;
    if (key === 'side') return [a + e.grilleX * (1 - t), b + dTop * (1 - t) * Math.max(0, (b - z0) / (z1 - z0))];
    if (key === 'top') return [a + e.grilleX * (1 - t), b];
    return [a, b + dTop * Math.max(0, (b - z0) / (z1 - z0))];
  };
  // doors: where a body feature drawn at x (before the edit) goes, or null when the layout has no such line
  const Bn = plan ? (L === 2 ? plan.D2 : plan.B) : 0, Cn = plan ? (L === 6 ? plan.C : plan.C4) : 0;
  const doorX = (x: number): number | null | undefined => {
    if (!f || !plan) return undefined;
    if (Math.abs(x - f.B) < 30) return Bn; if (Math.abs(x - f.C) < 30) return L === 2 ? null : Cn;
    if (Math.abs(x - (f.B + 36)) < 12) return L === 2 ? null : plan.B + 36;      // the rear door's handle
    if (Math.abs(x - f.B) < 200) return Bn + (x - f.B); if (Math.abs(x - f.C) < 140) return (L === 2 ? plan.C4 : Cn) + (x - f.C);
    return undefined; };
  const winX = (id: string): [number, number] | null => {
    if (!f || !plan) return null; const fr = f.windows.front.indexOf(id), rr = f.windows.rear.indexOf(id), q = f.windows.quarter.indexOf(id), inset = (k: number, a: number, b: number): [number, number] => (k === 0 ? [a, b] : [a + 50, b - 60]);
    const doorEnd = L === 2 ? plan.D2 : plan.B;
    if (fr >= 0) return inset(fr, f.A + 9, doorEnd - 42);
    if (rr >= 0) return inset(rr, doorEnd + 30, (L === 6 ? plan.C : plan.C4) - 44);
    if (q >= 0) return inset(q, plan.C + 8, plan.C + 406);
    if (id === f.steps.rear) return [plan.B + 78, plan.B + 311];
    return null; };
  for (const p of m.parts) {
    const lift = UNSPRUNG.has(p.element) ? 0 : e.lift, t = T(p), win = winX(p.id), isHood = p.id === 'hood';
    const fx = (x: number) => ap(t.x, win ? x : Fx(x)), fz = (z: number) => ap(t.z, G(z) + lift), fy = (y: number) => ap(t.y, y);
    const axes = (key: Key): [(a: number) => number, (b: number) => number] => key === 'side' ? [fx, fz] : key === 'top' ? [fx, fy] : [fy, fz];
    const sheets = (p.sheet ?? {}) as Record<Key, number[]>, keys = new Set<Key>([...Object.keys(p.outlines), ...Object.keys(sheets)] as Key[]);
    for (const key of keys) {
      const b = p.box, r0 = sheets[key] ?? (key === 'side' ? [b.x[0], b.x[1], b.z[0], b.z[1]] : key === 'top' ? [b.x[0], b.x[1], b.y[0], b.y[1]] : [b.y[0], b.y[1], b.z[0], b.z[1]]);
      const [fa, fb] = axes(key); let r1 = [fa(r0[0]!), fa(r0[1]!), fb(r0[2]!), fb(r0[3]!)];
      if (key === 'side' && win) r1 = [win[0], win[1], r1[2]!, r1[3]!];
      const abs = (u: number, v: number): [number, number] => [r0[0]! + (r0[1]! - r0[0]!) * u, r0[2]! + (r0[3]! - r0[2]!) * v];
      const unit = (a: number, c: number): [number, number] => [(a - r1[0]!) / (r1[1]! - r1[0]! || 1), (c - r1[2]!) / (r1[3]! - r1[2]! || 1)];
      const warp = (u: number, v: number, door = false): [number, number] | null => { const [a, c] = abs(u, v); let A2 = fa(a), C2 = fb(c);
        if (key === 'side' && win) A2 = r1[0]! + (r1[1]! - r1[0]!) * u;
        if (door && key === 'side') { const dx = doorX(a); if (dx === null) return null; if (dx !== undefined) A2 = dx; }
        if (isHood) [A2, C2] = hoodPt(key, A2, C2); return unit(A2, C2); };
      if (p.outlines[key]) p.outlines[key] = p.outlines[key]!.map(([u, v, sh]) => { const [a, c] = warp(u, v)!; return [a, c, sh]; });
      const feats = p.features?.[key];
      if (feats) p.features![key] = feats.flatMap((g: any) => { const body = p.element === 'body' && !win;
        if (g.pts) { const pts = g.pts.map((q: number[]) => warp(q[0]!, q[1]!, body)); if (pts.some((q: unknown) => !q)) return []; g.pts = pts; }
        if (g.at) { const q = warp(g.at[0], g.at[1], body); if (!q) return []; g.at = q; }
        if (g.kind === 'louvres') { const a = warp(g.x0, g.z0)!, c = warp(g.x1, g.z1)!; g.x0 = a[0]; g.z0 = a[1]; g.x1 = c[0]; g.z1 = c[1]; }
        return [g]; });
      if (sheets[key]) sheets[key] = r1.map(Math.round);
    }
    const bx = win ? [win[0], win[1]] : [fx(p.box.x[0]), fx(p.box.x[1])], bz = [fz(p.box.z[0]), fz(p.box.z[1])], by = [fy(p.box.y[0]), fy(p.box.y[1])];
    p.box = { x: [Math.round(Math.min(bx[0]!, bx[1]!)), Math.round(Math.max(bx[0]!, bx[1]!))], y: [Math.round(Math.min(by[0]!, by[1]!)), Math.round(Math.max(by[0]!, by[1]!))], z: [Math.round(Math.min(bz[0]!, bz[1]!)), Math.round(Math.max(bz[0]!, bz[1]!))] } as CarPart['box'];
    if (p.cutWheel && t.x.s !== 1) p.cutWheel = { ...p.cutWheel, r: Math.round(p.cutWheel.r * t.x.s) };
    if (gone.has(p.on ?? '')) delete p.on;
  }
  for (const w of m.wheels) w.x = Math.round(Fx(w.x));
  const body = m.parts.filter(p => p.layer !== 'chassis');
  m.length = Math.max(...body.map(p => (p.sheet?.side ?? [0, p.box.x[1]])[1]!)); m.height = Math.max(...body.map(p => p.box.z[1]));
  if (e.rack) { const z0 = Math.max(...m.parts.filter(p => p.element === 'roof').map(p => p.box.z[1])), x0 = Math.round(Fx(1900)), x1 = Math.round(Fx(3300));
    const rack: CarPart = { id: 'rack', element: 'rack', material: 'black', surface: 'flat', pair: false, box: { x: [x0, x1], y: [-520, 520], z: [z0, z0 + 70] },
      outlines: { side: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0.94, 1, 1], [0.94, 0.4, 1], [0.06, 0.4, 1], [0.06, 1, 1], [0, 1, 1]], front: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0.92, 1, 1], [0.92, 0.4, 1], [0.08, 0.4, 1], [0.08, 1, 1], [0, 1, 1]],
        rear: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0.92, 1, 1], [0.92, 0.4, 1], [0.08, 0.4, 1], [0.08, 1, 1], [0, 1, 1]], top: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] } };
    m.parts.push(rack); m.height = Math.max(m.height, z0 + 70); }
  (m as CarModel & { lights?: number }).lights = L;
  return m;
}

/** figures the order is judged by */
export function measure(m: CarModel) {
  const wb = m.wheels[1]!.x - m.wheels[0]!.x, low = Math.min(...m.parts.filter(p => !UNSPRUNG.has(p.element) && p.element !== 'house' && p.element !== 'wheel').map(p => p.box.z[0]));
  const body = m.parts.filter(p => p.layer !== 'chassis'), x0 = Math.min(...body.map(p => (p.sheet?.side ?? [p.box.x[0]])[0]!));
  return { length: Math.round(m.length - x0), x0, wb, height: m.height, clearance: low, width: m.width, rack: m.parts.some(p => p.id === 'rack'), lights: (m as CarModel & { lights?: number }).lights ?? 6 };
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
  for (const f of d.features) if (f.kind === 'seam' || f.kind === 'bead') { const own = (f as { part?: string }).part, pts = smoothOpen(f.pts as Pt[]).map(([x, z]) => [X(x), Y(z)]);
    for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i]!, [bx, by] = pts[i + 1]!, n = Math.ceil(Math.hypot(bx! - ax!, by! - ay!) * 2) + 1;
      for (let k = 0; k <= n; k++) { const x = Math.floor(ax! + (bx! - ax!) * k / n), y = Math.floor(ay! + (by! - ay!) * k / n), o = at(x, y); if (o >= 0 && (!own || names[o] === own)) on[y * w + x] = 1; } } }
  thin(on, w, h);
  return { w, h, on, owner, names };
}

/** two lines a pixel apart (a part's edge against its neighbour's) read as one thick smear in pencil: thin every line to one
 *  pixel (Zhang-Suen), so the drawing stays a drawing */
function thin(on: Uint8Array, w: number, h: number) {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : on[y * w + x]!);
  for (let changed = true, pass = 0; changed && pass < 20; pass++) { changed = false;
    for (const sub of [0, 1]) { const kill: number[] = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!on[y * w + x]) continue;
        const n = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)], b = n.reduce((a, v) => a + v, 0);
        if (b < 2 || b > 6) continue; let t = 0; for (let i = 0; i < 8; i++) if (!n[i] && n[(i + 1) % 8]) t++; if (t !== 1) continue;
        if (sub === 0 ? n[0]! * n[2]! * n[4]! || n[2]! * n[4]! * n[6]! : n[0]! * n[2]! * n[6]! || n[0]! * n[4]! * n[6]!) continue;
        kill.push(y * w + x); }
      for (const k of kill) on[k] = 0; if (kill.length) changed = true; } }
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
