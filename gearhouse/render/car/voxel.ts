// A car as a solid (review 73): its parts' outlines in the four views turned into one grid of small cells, each cell
// belonging to the part whose outline in every view it lies inside (each part's views set into its own common box, so
// the sheet's view-to-view disagreements do not eat holes in it). Two ways to draw it from above at a slant, for the
// track game's test of which keeps flowing bodies whole:
//   A  drawn whole from each heading (pre-rendered frames): every cell's face lit by the sun, nearest wins;
//   B  sprite stacking: the solid cut into level slices, each a plan picture lit once, stacked at the camera's slant
//      and turned at run time (here drawn the same way the game would).
import { viewDesign, type CarModel, type CarPart, type ViewName } from './model';
import { rasterizeFlat } from './flat';
import type { CarImage } from './raster';

export interface Solid { c: number; nx: number; ny: number; nz: number; x0: number; y0: number; owner: Int16Array; rgb: [number, number, number][]; mat: string[]; ids: string[]; cx0: number;
  /** how solid the neighbourhood of each cell is (0..1, a blur of the cells): smooth outward directions and crevice shading come from it */
  den: Float32Array }
const MAT_RGB: Record<string, string> = { chrome: '#c4c6c8', glass: '#7f909a', black: '#24232b', rubber: '#25232b', iron: '#4f525d', wood: '#9a6a3a', lens: '#d9d5b6', lensR: '#c22c2b', white: '#d4d7dc', canvas: '#8c8270' };
const hex = (h: string): [number, number, number] => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };

function inPoly(pts: number[][], u: number, v: number) { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [ui, vi] = pts[i]!, [uj, vj] = pts[j]!;
  if ((vi! > v) !== (vj! > v) && u < (uj! - ui!) * (v - vi!) / (vj! - vi! || 1e-9) + ui!) ins = !ins; } return ins; }

/** The car as cells of `c` mm: the body's parts and the wheels; the chassis layer left out. The rules (docs/systems/68):
 *  - the drawings' stand-ins stay out (tyres drawn as parts, wheel-well backs, dark backdrops drawn across the car);
 *  - a part lying on another (`on`) is held inside that part's box, so glass and lenses sit flush, not proud;
 *  - a screen's panes drawn only from in front follow the rake its side outline gives;
 *  - an open car's cockpit is a hollow with a floor, its seats standing in it;
 *  - corners are rounded for every part thick enough to have them, whatever it is made of. */
export function solidOf(m: CarModel, c = 15, tyreW?: number): Solid {
  const L = m.length, W = m.width, H = m.height, x0 = -150, y0 = -W / 2 - 150, nx = Math.ceil((L + 300) / c), ny = Math.ceil((W + 300) / c), nz = Math.ceil((H + 150) / c);
  const N = nx * ny * nz, owner = new Int16Array(N).fill(-1), pri = new Float32Array(N).fill(-1e9), rgb: [number, number, number][] = [], mat: string[] = [], ids: string[] = [], elem: string[] = [], thick: boolean[] = [];
  const at = (i: number, j: number, k: number) => (k * ny + j) * nx + i, byId = new Map(m.parts.map(p => [p.id, p]));
  const dark = (p: CarPart) => p.material === 'black' || p.material === 'iron' || p.material === 'rubber', vol = (p: CarPart) => (p.box.x[1] - p.box.x[0]) * (p.box.y[1] - p.box.y[0]) * (p.box.z[1] - p.box.z[0]) / 1e9;
  const one = (p: CarPart) => Object.keys(p.outlines).length === 1 ? Object.keys(p.outlines)[0]! : '';
  const parts = m.parts.filter(p => p.layer !== 'chassis' && p.outlines && p.element !== 'wheel' && p.element !== 'house' && p.element !== 'seat'
    && !(dark(p) && (one(p) === 'front' || one(p) === 'rear') && vol(p) > 0.015));   // a dark backdrop drawn across the car from in front or behind; the frame and pans seen from above stay
  // the rake of each element's parts that have a side outline (screens): parts of that element drawn only from in front follow it
  const rake = new Map<string, CarPart[]>(); for (const p of parts) if (p.element === 'screen' && p.outlines.side) rake.set(p.element, [...(rake.get(p.element) ?? []), p]);
  const newId = (p: CarPart) => { const r = p as unknown as { color?: string }, col = r.color ?? (p.material === 'paint' ? m.paint : p.material === 'paint2' ? m.paint2 : p.material === 'chrome' && (m as unknown as { chrome?: string }).chrome ? (m as unknown as { chrome: string }).chrome : MAT_RGB[p.material] ?? '#808080');
    const id = rgb.push(hex(col)) - 1; mat.push(p.material); ids.push(p.id); elem.push(p.element); const b = p.box; thick.push(Math.min(b.x[1] - b.x[0], Math.abs(b.y[1] - b.y[0]) * (p.pair ? 1 : 1), b.z[1] - b.z[0]) >= 150); return id; };
  // a part drawn in one view only (a sill strip, a handle, a badge, a lamp bar) has no depth of its own: it is laid on
  // whatever solid lies just behind it along that view's line (within 250 mm), a few cells thick; else it stands where its box says
  const later: CarPart[] = [];
  const thinIds = new Set<number>();
  const lay = (p: CarPart) => { const inset = p.material === 'glass' ? 'glass' : /frame|reveal/i.test(p.id) && p.element !== 'screen' ? 'frame' : '';
    const id = newId(p); thinIds.add(id); const v = one(p) as 'side' | 'front' | 'rear' | 'top', o = p.outlines[v]!, b = p.box, t = Math.max(1, Math.min(3, Math.round(45 / c))), far = Math.ceil(250 / c);
    const centred = !p.pair && v === 'side' && b.y[0] >= -1 && b.y[1] > 100;   // drawn from the centre line out: it lies on both sides
    for (const s of p.pair || centred ? [1, -1] : [1]) { const ya = centred ? (s > 0 ? b.y[1] - 1 : -b.y[1]) : s > 0 ? b.y[0] : -b.y[1], yb = centred ? (s > 0 ? b.y[1] : -b.y[1] + 1) : s > 0 ? b.y[1] : -b.y[0];
      const U = (x: number) => (x - b.x[0]) / Math.max(1, b.x[1] - b.x[0]), Vz = (z: number) => (z - b.z[0]) / Math.max(1, b.z[1] - b.z[0]), Vy = (y: number) => ((s > 0 ? y : -y) - b.y[0]) / Math.max(1, b.y[1] - b.y[0]);
      const I = (x: number) => Math.max(0, Math.min(nx - 1, Math.floor((x - x0) / c))), J = (y: number) => Math.max(0, Math.min(ny - 1, Math.floor((y - y0) / c))), K = (z: number) => Math.max(0, Math.min(nz - 1, Math.floor(z / c)));
      // along the view's line: n0 the outer end of the box, dir the way out, len the box's own depth in cells
      const run = (get: (n: number) => number, n0: number, n1: number, dir: number, lim: number, put: (n: number) => void) => { let hit = -1;
        for (let n = n0 + dir * far, q = 0; q <= 2 * far + Math.abs(n1 - n0); q++, n -= dir) { if (n < 0 || n >= lim) continue; const a = get(n); if (owner[a]! >= 0 && owner[a] !== id) { hit = n; break; } }
        if (hit >= 0 && Math.abs(hit - n0) <= far + Math.abs(n1 - n0)) {
          // review 76: glass and the frames round it are set into the surface, not laid on it: a frame takes the surface's
          // own cells, glass the cells one further in (the outer one cleared), so a window sits back in its frame
          if (inset === 'glass') { const s0 = hit; if (s0 >= 0 && s0 < lim) { const a0 = get(s0); if (owner[a0] !== id && mat[owner[a0]!] !== 'glass') owner[a0] = -1; } for (let q = 1; q <= t; q++) { const n = hit - dir * q; if (n >= 0 && n < lim) put(n); } }
          else if (inset === 'frame') { for (let q = 0; q < t; q++) { const n = hit - dir * q; if (n >= 0 && n < lim) put(n); } }
          else for (let q = 1; q <= t; q++) { const n = hit + dir * q; if (n >= 0 && n < lim) put(n); } } else for (let n = Math.min(n0, n1); n <= Math.max(n0, n1); n++) put(n); };
      const set = (a: number) => { owner[a] = id; pri[a] = 1e7; };
      void inset;
      if (v === 'side') { const mid = (ya + yb) / 2, dir = mid >= 0 ? 1 : -1, n0 = J(dir > 0 ? yb : ya), n1 = J(dir > 0 ? ya : yb);
        for (let k = K(b.z[0]); k <= K(b.z[1]); k++) for (let i = I(b.x[0]); i <= I(b.x[1]); i++) { if (!inPoly(o, U(x0 + (i + 0.5) * c), Vz((k + 0.5) * c))) continue;
          if (Math.abs(mid) < 30) { for (let j = n1; j <= n0; j++) set(at(i, j, k)); continue; } run(n => at(i, n, k), n0, n1, dir, ny, n => set(at(i, n, k))); } }
      else if (v === 'top') { for (let j = J(ya); j <= J(yb); j++) for (let i = I(b.x[0]); i <= I(b.x[1]); i++) { if (!inPoly(o, U(x0 + (i + 0.5) * c), Vy(y0 + (j + 0.5) * c))) continue; run(n => at(i, j, n), K(b.z[1]), K(b.z[0]), 1, nz, n => set(at(i, j, n))); } }
      else { const dir = v === 'front' ? -1 : 1, n0 = I(dir < 0 ? b.x[0] : b.x[1]), n1 = I(dir < 0 ? b.x[1] : b.x[0]);
        for (let k = K(b.z[0]); k <= K(b.z[1]); k++) for (let j = J(ya); j <= J(yb); j++) { if (!inPoly(o, Vy(y0 + (j + 0.5) * c), Vz((k + 0.5) * c))) continue; run(n => at(n, j, k), n0, n1, dir, nx, n => set(at(n, j, k))); } } } };
  parts.forEach((p: CarPart) => {
    if (one(p) !== '' && !(dark(p) && vol(p) > 0.015) && !(p.element === 'screen' && rake.has('screen')) && p.element !== 'cockpit') { later.push(p); return; }
    const r = p as unknown as { lift?: number; on?: string }, id = newId(p);
    const o = p.outlines, b = p.box, side = o.side, top = o.top, fr = o.front ?? o.rear, P = Math.max(Math.abs(b.y[0]), Math.abs(b.y[1])) + (r.lift ?? 0) * 3;
    const par = r.on ? byId.get(r.on) : undefined, rk = !side && fr ? rake.get(p.element) : undefined;
    const inset = dark(p) && one(p) === 'side' && vol(p) > 0.015 ? 0.03 : 0;   // a dark mass drawn from the side only: kept inside the body's sides
    for (const s of p.pair ? [1, -1] : [1]) {
      let ya = s > 0 ? b.y[0] : -b.y[1], yb = s > 0 ? b.y[1] : -b.y[0], xa = b.x[0], xb = b.x[1], za = b.z[0], zb = b.z[1];
      const half = !p.pair && b.y[0] >= -1 && b.y[1] > 100 && !!side && !top && !fr; if (half) ya = -yb;   // drawn from the side as a slab from the centre line out: it is the same on both sides
      if (inset) { const d = (yb - ya) * inset; ya += d; yb -= d; }
      if (par) { const q = par.box, t = c * 1.2, pa = par.pair ? (s > 0 ? q.y[0] : -q.y[1]) : q.y[0], pb = par.pair ? (s > 0 ? q.y[1] : -q.y[0]) : q.y[1];   // held inside what it lies on (where that leaves anything of it)
        if (Math.min(xb, q.x[1] + t) > Math.max(xa, q.x[0] - t)) { xa = Math.max(xa, q.x[0] - t); xb = Math.min(xb, q.x[1] + t); }
        if (Math.min(yb, pb + t) > Math.max(ya, pa - t)) { ya = Math.max(ya, pa - t); yb = Math.min(yb, pb + t); }
        if (Math.min(zb, q.z[1] + t) > Math.max(za, q.z[0] - t)) { za = Math.max(za, q.z[0] - t); zb = Math.min(zb, q.z[1] + t); } }
      const i0 = Math.max(0, Math.floor((xa - x0) / c)), i1 = Math.min(nx - 1, Math.ceil((xb - x0) / c)), j0 = Math.max(0, Math.floor((ya - y0) / c)), j1 = Math.min(ny - 1, Math.ceil((yb - y0) / c)), k0 = Math.max(0, Math.floor(za / c)), k1 = Math.min(nz - 1, Math.ceil(zb / c));
      const U = (x: number) => (x - b.x[0]) / Math.max(1, b.x[1] - b.x[0]), Vz = (z: number) => (z - b.z[0]) / Math.max(1, b.z[1] - b.z[0]), Vy = (y: number) => half ? 0.5 : ((s > 0 ? y : -y) - b.y[0]) / Math.max(1, b.y[1] - b.y[0]);
      const sm = new Map<number, boolean>(), tm = new Map<number, boolean>(), fm = new Map<number, boolean>();
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = x0 + (i + 0.5) * c, y = y0 + (j + 0.5) * c, z = (k + 0.5) * c, u = U(x), vz = Vz(z), vy = Vy(y);
        if (u < 0 || u > 1 || vz < 0 || vz > 1 || vy < 0 || vy > 1 || x < xa || x > xb || y < ya || y > yb || z < za || z > zb) continue;
        if (side) { const key = k * nx + i; let v = sm.get(key); if (v === undefined) { v = inPoly(side, u, vz); sm.set(key, v); } if (!v) continue; }
        else if (rk) { const key = k * nx + i; let v = sm.get(key); if (v === undefined) { v = rk.some(q => { const qb = q.box, uu = (x - qb.x[0]) / Math.max(1, qb.x[1] - qb.x[0]), vv = (z - qb.z[0]) / Math.max(1, qb.z[1] - qb.z[0]); return uu >= 0 && uu <= 1 && vv >= 0 && vv <= 1 && inPoly(q.outlines.side!, uu, vv); }); sm.set(key, v); } if (!v) continue; }
        if (top) { const key = j * nx + i; let v = tm.get(key); if (v === undefined) { v = inPoly(top, u, vy); tm.set(key, v); } if (!v) continue; }
        if (fr) { const key = k * ny + j; let v = fm.get(key); if (v === undefined) { v = inPoly(fr, vy, vz); fm.set(key, v); } if (!v) continue; }
        const a = at(i, j, k); if (P >= pri[a]!) { pri[a] = P; owner[a] = id; } } } });
  // corners rounded first (review 75): cells of parts thick enough to have corners go where a blur of the solid thins
  // out. Done before the thin parts are laid on, so glass, lamps and strips sit on the rounded surface, not on the
  // square one it was cut from (they stood proud of it by a cell or two: floating windows)
  // review 76: the gaps between parts closed from the whole car's silhouettes. The sheets draw the car whole in each
  // view far more surely than any one part's box across the car; a cell inside the side, the front (or rear) and the
  // plan silhouettes, within 120 mm of a part and clear of the wheels, takes the nearest part's ownership
  { const sil = (v: ViewName) => rasterizeFlat(viewDesign(m, v), { mm: c, shadow: false });
    const sd = sil('left'), fr = sil('front'), re = sil('rear'), tp = sil('top'), C = W / 2;
    const inn = (im: CarImage, u: number, h: number) => { const px = Math.floor(im.X(u)), py = Math.floor(im.Y(h)); return px >= 0 && py >= 0 && px < im.w && py < im.h && im.rgba[(py * im.w + px) * 4 + 3]! > 128; };
    const wheelZone = (x: number, y: number, z: number) => m.wheels.some(w => Math.hypot(x - w.x, z - w.r) < w.r + 40 && Math.abs(Math.abs(y) - w.y) < (tyreW ?? 175) / 2 + 60);
    const hull = new Uint8Array(N);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + (i + 0.5) * c, y = y0 + (j + 0.5) * c, z = (k + 0.5) * c;
      if (inn(sd, x, z) && (inn(fr, C + y, z) || inn(re, C - y, z)) && inn(tp, x, C + y) && !wheelZone(x, y, z)) hull[at(i, j, k)] = 1; }
    let front: number[] = []; for (let a = 0; a < N; a++) if (owner[a]! >= 0 && !thinIds.has(owner[a]!)) front.push(a);
    const N6 = [1, -1, nx, -nx, nx * ny, -nx * ny];
    for (let step = 0; step < Math.ceil(120 / c) && front.length; step++) { const next: number[] = [];
      for (const a of front) for (const d of N6) { const b = a + d; if (b < 0 || b >= N || owner[b]! >= 0 || !hull[b]) continue; const o = owner[a]!; if (mat[o] === 'glass' || mat[o] === 'chrome' || mat[o] === 'lens' || mat[o] === 'lensR') continue; owner[b] = o; pri[b] = -1; next.push(b); }
      front = next; } }
  const S: Solid = { c, nx, ny, nz, x0, y0, owner, rgb, mat, ids, cx0: x0 + nx * c / 2, den: new Float32Array(0) };
  { const d0 = density(S, 2); for (let i = 0; i < N; i++) { const o = owner[i]!; if (o >= 0 && thick[o] && d0[i]! < 0.42) owner[i] = -1; } }
  later.forEach(lay);
  // a part left standing free beside the car (the sheet's plan drawn wider than its front view: a running board, a sill
  // strip) is carried in towards the centre line until it meets the car, up to 300 mm
  { const touch = new Uint8Array(rgb.length), has = new Uint8Array(rgb.length), step = [1, nx, nx * ny];
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const a = at(i, j, k), o = owner[a]!; if (o < 0) continue; has[o] = 1; if (touch[o]) continue;
      for (const d of step) { const u = owner[a + d]!, v = owner[a - d]!; if ((u >= 0 && u !== o) || (v >= 0 && v !== o)) { touch[o] = 1; break; } } }
    const reach = Math.ceil(300 / c), jc = Math.round((0 - y0) / c), thin = new Set(later.map(p => p.id));
    for (let o = 0; o < rgb.length; o++) { const gaps: number[] = []; if (!has[o] || (touch[o] && !(elem[o] === 'board' || /sill|strip/i.test(ids[o]!)))) continue; const add: number[] = [];   // boards and sill strips always (they touch the wings at their ends and still stand off the body)
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { if (owner[at(i, j, k)] !== o) continue; const dir = j > jc ? -1 : 1; if (Math.abs(j - jc) < 4 || owner[at(i, j + dir, k)] === o) continue;
        scan: for (let q = 1; q <= reach; q++) { const jj = j + dir * q; if (jj < 0 || jj >= ny) break;   // the car at this height, or a little above (a strip under the body's edge)
          for (let dz = 0; dz <= Math.ceil(150 / c) && k + dz < nz; dz++) { const u = owner[at(i, jj, k + dz)]!; if (u >= 0 && u !== o) { gaps.push(q - 1 + (dz ? 2 : 0)); for (let t = 1; t < q + (dz ? 2 : 0); t++) add.push(at(i, j + dir * t, k)); break scan; } } } }
      if (thin.has(ids[o]!) && gaps.length) { gaps.sort((p, q) => p - q); const g = gaps[gaps.length >> 1]!, cells: [number, number, number][] = [];   // a thin strip is carried in whole, not widened
        for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (owner[at(i, j, k)] === o) cells.push([i, j, k]);
        for (const [i, j, k] of cells) owner[at(i, j, k)] = -1; for (const [i, j, k] of cells) { const jj = j + (j > jc ? -g : g); if (jj >= 0 && jj < ny) { owner[at(i, jj, k)] = o; pri[at(i, jj, k)] = 1e7; } } continue; }
      for (const a of add) { owner[a] = o; pri[a] = 1e7; } } }
  // an open car's cockpit: hollowed to a floor some way below its rim, the seats standing in the hollow
  const HULL = new Set(['body', 'cowl', 'deck', 'cockpit', 'hood', 'apron']);
  for (const ck of m.parts.filter(p => p.element === 'cockpit' && p.outlines.top)) { const b = ck.box, top = ck.outlines.top!, zTop = b.z[1], zf = Math.max(b.z[0] - 60, zTop - 330), cid = ids.indexOf(ck.id);
    const i0 = Math.max(0, Math.floor((b.x[0] - x0) / c)), i1 = Math.min(nx - 1, Math.ceil((b.x[1] - x0) / c)), j0 = Math.max(0, Math.floor((b.y[0] - y0) / c)), j1 = Math.min(ny - 1, Math.ceil((b.y[1] - y0) / c));
    const cell = (i: number, j: number) => { const x = x0 + (i + 0.5) * c, y = y0 + (j + 0.5) * c; return [(x - b.x[0]) / Math.max(1, b.x[1] - b.x[0]), (y - b.y[0]) / Math.max(1, b.y[1] - b.y[0])] as const; };
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const [u, v] = cell(i, j); if (!inPoly(top, u, v)) continue;
      for (let k = 0; k < nz; k++) { const z = (k + 0.5) * c, a = at(i, j, k), o = owner[a]!; if (z > zf) { if (o >= 0 && HULL.has(elem[o]!)) owner[a] = -1; } else if (z > zf - 2.5 * c && cid >= 0) { owner[a] = cid; pri[a] = 1e8; } } }
    for (const sp of m.parts.filter(p => p.element === 'seat' && p.outlines.top && (p as unknown as { clip?: string }).clip !== undefined)) { const id = newId(sp), back = /Back$/.test(sp.id), z1 = back ? zTop - 20 : zf + 150, st = sp.outlines.top!;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const [u, v] = cell(i, j); if (!inPoly(st, u, v) || !inPoly(top, u, v)) continue;
        for (let k = 0; k < nz; k++) { const z = (k + 0.5) * c; if (z > zf - c && z <= z1) { const a = at(i, j, k); owner[a] = id; pri[a] = 1e8 + (back ? 1 : 0); } } } } }
  // the wheels: a tyre round a rim and its cap, on each side, axis across the car
  const wi = m.wheel ?? {}, tw = tyreW ?? 175, tyre = rgb.push(hex('#25232b')) - 1; mat.push('rubber'); ids.push('wheel'); elem.push('wheel'); thick.push(false);
  const rimC = rgb.push(hex(wi.rimMaterial === 'paint' ? m.paint : wi.rimMaterial === 'paint2' ? m.paint2 : '#c4c6c8')) - 1; mat.push(wi.rimMaterial === 'chrome' ? 'chrome' : 'paint'); ids.push('wheel'); elem.push('wheel'); thick.push(false);
  for (const w of m.wheels) for (const s of [1, -1]) { const yc = s * w.y, rim = w.r * (wi.rim ?? 0.6);
    const i0 = Math.max(0, Math.floor((w.x - w.r - x0) / c)), i1 = Math.min(nx - 1, Math.ceil((w.x + w.r - x0) / c)), j0 = Math.max(0, Math.floor((yc - tw / 2 - y0) / c)), j1 = Math.min(ny - 1, Math.ceil((yc + tw / 2 - y0) / c)), k1 = Math.min(nz - 1, Math.ceil(2 * w.r / c));
    for (let k = 0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = x0 + (i + 0.5) * c, y = y0 + (j + 0.5) * c, z = (k + 0.5) * c, d = Math.hypot(x - w.x, z - w.r);
      const e = Math.abs(y - yc) / (tw / 2);   // across the tread: its shoulders round off as a tyre's do
      if (e > 1 || d > w.r - w.r * 0.2 * (1 - Math.sqrt(Math.max(0, 1 - e * e)))) continue; const a = at(i, j, k), face = Math.abs(y - yc) > tw / 2 - c * 1.5;
      owner[a] = d > rim ? tyre : face ? rimC : tyre; pri[a] = 1e9; } }
  // a car is the same on both sides, but for the things it carries on one side only (an outside exhaust, a spare on one
  // flank, a single mirror): every cell of a part that is paired or centred gets its mirror image (review 74)
  { const oneSided = new Set<number>(); ids.forEach((id, o) => { const p = byId.get(id); if (p && !p.pair && Math.abs(p.box.y[0] + p.box.y[1]) > 80 && !(Math.abs(p.box.y[0]) <= 1)) oneSided.add(o); });
    const jm = (j: number) => Math.round((-2 * y0) / c - 1 - j);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = at(i, j, k), o = owner[a]!; if (o < 0 || oneSided.has(o)) continue; const jj = jm(j); if (jj < 0 || jj >= ny) continue; const b = at(i, jj, k); if (owner[b]! < 0) { owner[b] = o; pri[b] = pri[a]!; } } }
  // nothing floats (review 75): a part that touches no other part (a tail lamp drawn behind a wing that ends short of
  // it, a lamp on a stalk the model left out) is moved the shortest way, along one axis and up to 300 mm, until it touches
  { const N6 = [1, -1, nx, -nx, nx * ny, -nx * ny], cellsOf = new Map<number, number[]>();
    for (let a = 0; a < N; a++) { const o = owner[a]!; if (o >= 0) { let l = cellsOf.get(o); if (!l) cellsOf.set(o, l = []); l.push(a); } }
    const touches = (o: number, cs: number[], off: number) => cs.some(a => N6.some(d => { const b = a + off + d; if (b < 0 || b >= N) return false; const u = owner[b]!; return u >= 0 && u !== o; }));
    for (const [o, cs] of cellsOf) { if (ids[o] === 'wheel' || touches(o, cs, 0)) continue; let best: number | null = null;
      for (let q = 1; q <= Math.ceil(300 / c) && best === null; q++) for (const d of N6) { const off = d * q; if (cs.every(a => { const b = a + off; return b >= 0 && b < N && (owner[b]! < 0 || owner[b] === o); }) && touches(o, cs, off)) { best = off; break; } }
      if (best === null) continue; for (const a of cs) owner[a] = -1; for (const a of cs) { owner[a + best] = o; pri[a + best] = 1e7; } } }
  // the blur of what is left is kept for outward directions and crevice shading
  S.den = density(S, 2); return S;
}
/** a box blur of the solid along each axis in turn (radius r cells) */
function density(S: Solid, r: number): Float32Array {
  const { nx, ny, nz, owner } = S, N = nx * ny * nz, a = new Float32Array(N), b = new Float32Array(N), w = 2 * r + 1;
  for (let i = 0; i < N; i++) a[i] = owner[i]! >= 0 ? 1 : 0;
  const pass = (src: Float32Array, dst: Float32Array, len: number, step: number) => { for (let i = 0; i < N; i++) { const p = Math.floor(i / step) % len; let sum = 0;
      for (let d = -r; d <= r; d++) { const q = p + d; if (q < 0 || q >= len) continue; sum += src[i + d * step]!; } dst[i] = sum / w; } };
  pass(a, b, nx, 1); pass(b, a, ny, nx); pass(a, b, nz, nx * ny); return b; }

export type Tex = Partial<Record<ViewName, CarImage>> & { reach?: Map<string, { x: [number, number]; y: number; z: number }>; wheel?: CarImage; on?: Map<string, string> };
/** the car's own drawings (review 73: "2D pictures laid over it"), at `mm` a pixel: the five views the flat renderer
 *  makes, drawn plain (no gloss, no light read off the sheet): the solid gives the light, the drawings give the marks */
export function texOf(m0: CarModel, mm = 6, tyreW = 175): Tex { const m = { ...m0, gloss: 0 } as CarModel, t: Tex = {};
  for (const v of ['left', 'right', 'front', 'rear', 'top'] as ViewName[]) t[v] = rasterizeFlat(viewDesign(m, v), { mm, shadow: false, plain: true });
  // how far out each part reaches (across, up, along), to tell whether the part a drawing shows stands in front of a cell
  const reach = new Map<string, { x: [number, number]; y: number; z: number }>();
  for (const p of m.parts) reach.set(p.id, { x: [p.box.x[0], p.box.x[1]], y: Math.max(Math.abs(p.box.y[0]), Math.abs(p.box.y[1])), z: p.box.z[1] });
  const ws = m.wheels; reach.set('wheel', { x: [Math.min(...ws.map(w => w.x - w.r)), Math.max(...ws.map(w => w.x + w.r))], y: Math.max(...ws.map(w => w.y)) + tyreW / 2, z: Math.max(...ws.map(w => w.r * 2)) });
  // the wheels' faces as they read at game size (review 74): wire wheels with fewer, bolder spokes, drawn at the scale
  // they are seen (a fine wheel drawn small turns to grey); the side drawing keeps its own wheels for close views
  const wf = { ...m, wheel: { ...m.wheel, spokes: m.wheel?.style === 'wire' ? Math.max(20, Math.round((m.wheel?.spokes ?? 32) * 0.66)) : m.wheel?.spokes } } as CarModel;
  t.wheel = rasterizeFlat(viewDesign(wf, 'left'), { mm: 9, shadow: false, plain: true });   // review 76: the wheel's own pattern kept (two thirds of its spokes, drawn a little bolder), not a stock 16-spoke face
  t.on = new Map(m.parts.filter(p => (p as unknown as { on?: string }).on).map(p => [p.id, (p as unknown as { on: string }).on]));
  t.reach = reach; return t; }
const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;
/** the colour the drawings give a cell's face: from the view that looks straight at it, where that view shows the cell's
 *  own part or one lying on the same face, never one standing in front. A broad painted face takes only the drawing's
 *  marks (how much lighter or darker than its surroundings, within a hand's breadth) on the part's own colour; anything
 *  else takes the drawing's colour, averaged over the cell. null when no view shows it. */
function texel(T: Tex, W: number, part: string, x: number, y: number, z: number, n: [number, number, number], flat: [number, number, number], broad: boolean): [number, number, number] | null {
  const C = W / 2, order: [ViewName, number, number][] = [];
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  const side: [ViewName, number, number] = [n[1] >= 0 ? 'left' : 'right', x, z], end: [ViewName, number, number] = n[0] < 0 ? ['front', C + y, z] : ['rear', C - y, z], top: [ViewName, number, number] = ['top', x, C + y];
  for (const [v, w] of ([[side, ay], [end, ax], [top, az]] as const).slice().sort((p, q) => q[1] - p[1])) if (w > 0.15) order.push(v);
  for (const [v, u, h] of order) { const im = part === 'wheel' && (v === 'left' || v === 'right') && T.wheel ? T.wheel : T[v]; if (!im) continue; const px = Math.floor(im.X(u)), py = Math.floor(im.Y(h)); if (px < 0 || py < 0 || px >= im.w || py >= im.h) continue;
    const i = py * im.w + px; if (im.rgba[i * 4 + 3]! < 128) continue; const id = (im.ids?.[im.owner[i]!] ?? '').replace(/~$/, '');
    // review 75: another part's colour only when it lies on this one (glass in its body, a lens in its lamp, a badge on
    // its shell), never a neighbour drawn behind or beside it (colours bled from part to part)
    if (id !== part && !(id === 'wheel' && /^spare/.test(part))) { let q = T.on?.get(id), k2 = 0; while (q && q !== part && k2++ < 6) q = T.on?.get(q); if (q !== part) continue; }
    if (id !== part && !(id === 'wheel' && /^spare/.test(part))) { const r = T.reach?.get(id), tol = 45; if (!r) continue;
      const before = v === 'left' || v === 'right' ? r.y > Math.abs(y) + tol : v === 'top' ? r.z > z + tol : v === 'front' ? r.x[0] < x - tol : r.x[1] > x + tol; if (before) continue; }
    const o = im.owner[i], mean = (rad: number, step: number) => { let a = 0, b = 0, c = 0, k = 0;
      for (let dy = -rad; dy <= rad; dy += step) for (let dx = -rad; dx <= rad; dx += step) { const xx = px + dx, yy = py + dy; if (xx < 0 || yy < 0 || xx >= im.w || yy >= im.h) continue; const j = yy * im.w + xx;
        if (im.rgba[j * 4 + 3]! < 128 || im.owner[j] !== o) continue; a += im.rgba[j * 4]!; b += im.rgba[j * 4 + 1]!; c += im.rgba[j * 4 + 2]!; k++; } return k ? [a / k, b / k, c / k] as const : null; };
    const near = mean(1, 1) ?? [im.rgba[i * 4]!, im.rgba[i * 4 + 1]!, im.rgba[i * 4 + 2]!];
    if (broad && id === part) { const far = mean(8, 2) ?? near, k = Math.max(0.5, Math.min(1.3, (lum(near[0], near[1], near[2]) + 6) / (lum(far[0], far[1], far[2]) + 6))); return [flat[0] * k, flat[1] * k, flat[2] * k]; }
    return [near[0], near[1], near[2]]; }
  return null; }

const SUN = (() => { const v = [-0.45, 0.35, 0.82], n = Math.hypot(...v); return v.map(q => q / n) as [number, number, number]; })();
/** a cell's outward direction, from which of its neighbours are empty */
function normal(S: Solid, i: number, j: number, k: number): [number, number, number] { const { nx, ny, nz, owner } = S, f = (a: number, b: number, c: number) => (a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= nz) ? 0 : owner[(c * ny + b) * nx + a]! >= 0 ? 1 : 0;
  // over a wider neighbourhood (radius 2), weighted by nearness, so a curved wing shades smoothly instead of in terraces
  let gx = 0, gy = 0, gz = 0; for (let dk = -2; dk <= 2; dk++) for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const v = f(i + di, j + dj, k + dk); if (!v) continue; const wgt = 1 / (1 + di * di + dj * dj + dk * dk); gx -= di * v * wgt; gy -= dj * v * wgt; gz -= dk * v * wgt; }
  const n = Math.hypot(gx, gy, gz) || 1; return [gx / n, gy / n, gz / n]; }
function shade(S: Solid, id: number, n: [number, number, number], sun: [number, number, number]): [number, number, number] {
  const b = S.rgb[id]!, m = S.mat[id]!, d = Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]), up = Math.max(0, n[2]);
  const gloss = m === 'paint' || m === 'paint2' ? 0.35 : m === 'chrome' ? 0.8 : m === 'glass' ? 0.5 : 0.05, k = 0.42 + 0.62 * d + 0.12 * up;
  const sp = gloss * Math.pow(Math.max(0, d), m === 'chrome' ? 6 : 14) * 255;
  return [Math.min(255, b[0] * k + sp), Math.min(255, b[1] * k + sp), Math.min(255, b[2] * k + sp)]; }
const surf = (S: Solid, i: number, j: number, k: number) => { const { nx, ny, nz, owner } = S; for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) { const ii = i + a, jj = j + b, kk = k + c; if (ii < 0 || jj < 0 || kk < 0 || ii >= nx || jj >= ny || kk >= nz || owner[(kk * ny + jj) * nx + ii]! < 0) return true; } return false; };

export interface Pic { w: number; h: number; rgba: Uint8ClampedArray }
/** A: the solid drawn whole from heading `yaw` (degrees; 0 = nose to the right), the camera `pitch` degrees above the ground */
export function drawWhole(S: Solid, yaw: number, pitch: number, mmPx: number, size = 360): Pic {
  const w = size, h = Math.round(size * 0.75), rgba = new Uint8ClampedArray(w * h * 4), zb = new Float32Array(w * h).fill(-1e9), th = yaw * Math.PI / 180, ph = pitch * Math.PI / 180;
  const cx = S.x0 + S.nx * S.c / 2, ct = Math.cos(th), st = Math.sin(th), sp = Math.sin(ph), cp = Math.cos(ph), q = Math.max(1, Math.ceil(S.c / mmPx));
  // the sun stays put in the world while the car turns: turn it the other way into the car's frame
  const sun: [number, number, number] = [SUN[0] * ct + SUN[1] * st, -SUN[0] * st + SUN[1] * ct, SUN[2]];
  for (let k = 0; k < S.nz; k++) for (let j = 0; j < S.ny; j++) for (let i = 0; i < S.nx; i++) { const id = S.owner[(k * S.ny + j) * S.nx + i]!; if (id < 0 || !surf(S, i, j, k)) continue;
    const x = S.x0 + (i + 0.5) * S.c - cx, y = S.y0 + (j + 0.5) * S.c, z = (k + 0.5) * S.c, xr = x * ct - y * st, yr = x * st + y * ct;
    const px = Math.round(w / 2 + xr / mmPx), py = Math.round(h * 0.62 + (-yr * sp - z * cp) / mmPx), depth = -yr * cp + z * sp;
    const c = shade(S, id, normal(S, i, j, k), sun);
    for (let dy = 0; dy < q; dy++) for (let dx = 0; dx < q; dx++) { const X = px + dx - (q >> 1), Y = py + dy - (q >> 1); if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const a = Y * w + X; if (depth < zb[a]!) continue; zb[a] = depth; rgba[a * 4] = c[0]; rgba[a * 4 + 1] = c[1]; rgba[a * 4 + 2] = c[2]; rgba[a * 4 + 3] = 255; } }
  return { w, h, rgba }; }

/** B's slices: the solid cut every `every` cells up, each slice a plan picture (x across, y down) lit once from above */
export function slicesOf(S: Solid, mmPx: number, every = 1): { z: number; pic: Pic }[] {
  const out: { z: number; pic: Pic }[] = [], w = Math.ceil(S.nx * S.c / mmPx), h = Math.ceil(S.ny * S.c / mmPx);
  for (let k = 0; k < S.nz; k += every) { const rgba = new Uint8ClampedArray(w * h * 4); let any = false;
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) { const i = Math.floor(X * mmPx / S.c), j = Math.floor(Y * mmPx / S.c); if (i >= S.nx || j >= S.ny) continue;
      // a slice shows what stands in its band of `every` cells (so coarse slices are solid, as stacked sprites are)
      let id = -1, kk = k; for (let t = Math.min(S.nz - 1, k + every - 1); t >= k; t--) { const v = S.owner[(t * S.ny + j) * S.nx + i]!; if (v >= 0) { id = v; kk = t; break; } }
      if (id < 0) continue; const c = shade(S, id, normal(S, i, j, kk), SUN), a = Y * w + X; rgba[a * 4] = c[0]; rgba[a * 4 + 1] = c[1]; rgba[a * 4 + 2] = c[2]; rgba[a * 4 + 3] = 255; any = true; }
    if (any) out.push({ z: (k + every / 2) * S.c, pic: { w, h, rgba } }); }
  return out; }
/** B: the slices stacked as the game would draw them, each turned to `yaw` and squashed by the camera's slant, lifted by its height */
export function drawStack(sl: { z: number; pic: Pic }[], S: Solid, yaw: number, pitch: number, mmPx: number, size = 360, hh?: number): Pic {
  const w = size, h = hh ?? Math.round(size * 0.75), rgba = new Uint8ClampedArray(w * h * 4), th = yaw * Math.PI / 180, ph = pitch * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th), sp = Math.sin(ph), cp = Math.cos(ph);
  for (const { z, pic } of sl) { const ox = pic.w / 2, oy = (-S.y0) / mmPx, lift = z * cp / mmPx;
    // each screen pixel looks back into the slice (turned the other way, unsquashed)
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) { const sx = (X - w / 2) * mmPx, syp = (Y - h * (hh ? 0.6 : 0.62) + lift) * mmPx / sp * -1;
      const x = sx * ct + syp * st, y = -sx * st + syp * ct, i = Math.floor(x / mmPx + ox), j = Math.floor(y / mmPx + oy);
      if (i < 0 || j < 0 || i >= pic.w || j >= pic.h) continue; const a = (j * pic.w + i) * 4; if (!pic.rgba[a + 3]) continue; const b = (Y * w + X) * 4; rgba[b] = pic.rgba[a]!; rgba[b + 1] = pic.rgba[a + 1]!; rgba[b + 2] = pic.rgba[a + 2]!; rgba[b + 3] = 255; } }
  return { w, h, rgba }; }

/** the solid's outer cells, ready to draw again and again (positions about the car's middle, outward directions, colours) */
export interface Surface { n: number; pos: Float32Array; nrm: Float32Array; col: Uint8ClampedArray; gloss: Float32Array; c: number; tex: Uint8Array; part: Int16Array }
export function surfaceOf(S: Solid, T?: Tex, W = 0): Surface {
  const cx = S.x0 + S.nx * S.c / 2, pos: number[] = [], nrm: number[] = [], col: number[] = [], gl: number[] = [], tx: number[] = [], pt: number[] = [], { nx, ny, nz, den } = S, sx = 1, sy = nx, sz = nx * ny;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = (k * ny + j) * nx + i, id = S.owner[a]!; if (id < 0 || !surf(S, i, j, k)) continue;
    const X = S.x0 + (i + 0.5) * S.c, Y = S.y0 + (j + 0.5) * S.c, Z = (k + 0.5) * S.c;
    // outward: down the slope of the blurred solid (smooth over the cells' steps); the cells' own count where that is flat
    let gx = (i > 0 ? den[a - sx]! : 0) - (i < nx - 1 ? den[a + sx]! : 0), gy = (j > 0 ? den[a - sy]! : 0) - (j < ny - 1 ? den[a + sy]! : 0), gz = (k > 0 ? den[a - sz]! : 0) - (k < nz - 1 ? den[a + sz]! : 0); const gn = Math.hypot(gx, gy, gz);
    const nn: [number, number, number] = gn > 0.02 ? [gx / gn, gy / gn, gz / gn] : normal(S, i, j, k); pos.push(X - cx, Y, Z); nrm.push(...nn);
    const m = S.mat[id]!, broad = m === 'paint' || m === 'paint2' || m === 'canvas', tc = T ? texel(T, W, S.ids[id]!, X, Y, Z, nn, S.rgb[id]!, broad) : null;
    const ao = 1 - 0.6 * Math.max(0, Math.min(1, (den[a]! - 0.6) / 0.32)), c0 = tc ?? S.rgb[id]!;   // crevices get less of the sky
    col.push(c0[0] * ao, c0[1] * ao, c0[2] * ao); tx.push(tc && !broad ? 1 : 0); pt.push(id);
    gl.push(m === 'paint' || m === 'paint2' ? 0.35 : m === 'chrome' ? 0.8 : m === 'glass' ? 0.5 : 0.05); }
  return { n: gl.length, pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Uint8ClampedArray(col), gloss: new Float32Array(gl), c: S.c, tex: new Uint8Array(tx), part: new Int16Array(pt) }; }
/** A from a Surface. Drawn in two steps: which cell shows at each pixel; then each pixel lit, its outward direction
 *  first averaged with its neighbours on the same surface (the cells' steps go, the form's own edges stay), the light
 *  in a few steps (flat tones, as pixel art has them), bright metal giving back sky, horizon and ground. */
export function drawSurface(F: Surface, yaw: number, pitch: number, mmPx: number, w: number, h: number, outline: boolean | number = true): Pic {
  const rgba = new Uint8ClampedArray(w * h * 4), zb = new Float32Array(w * h).fill(-1e9), ix = new Int32Array(w * h).fill(-1), th = yaw * Math.PI / 180, ph = pitch * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th), sp = Math.sin(ph), cp = Math.cos(ph);
  const sun: [number, number, number] = [SUN[0] * ct + SUN[1] * st, -SUN[0] * st + SUN[1] * ct, SUN[2]], q = Math.max(2, Math.ceil(F.c * 1.45 / mmPx)), half = q >> 1;   // big enough that no cell behind shows between
  for (let t = 0; t < F.n; t++) { const x = F.pos[t * 3]!, y = F.pos[t * 3 + 1]!, z = F.pos[t * 3 + 2]!, xr = x * ct - y * st, yr = x * st + y * ct;
    const px = Math.round(w / 2 + xr / mmPx), py = Math.round(h * 0.6 + (-yr * sp - z * cp) / mmPx), depth = -yr * cp + z * sp;
    if (px < -q || py < -q || px > w + q || py > h + q) continue;
    for (let dy = 0; dy < q; dy++) for (let dx = 0; dx < q; dx++) { const X = px + dx - half, Y = py + dy - half; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const a = Y * w + X; if (depth < zb[a]!) continue; zb[a] = depth; ix[a] = t; } }
  // the car's shadow on the ground: each cell dropped along the sun's ray to the ground, a soft dark under it (review 74)
  const shadow = new Uint8Array(w * h); { const sx = -sun[0] / sun[2], sy = -sun[1] / sun[2];
    for (let t = 0; t < F.n; t++) { const z = F.pos[t * 3 + 2]!, x = F.pos[t * 3]! + sx * z, y = F.pos[t * 3 + 1]! + sy * z, xr = x * ct - y * st, yr = x * st + y * ct;
      const px = Math.round(w / 2 + xr / mmPx), py = Math.round(h * 0.6 + (-yr * sp) / mmPx); for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) { const X = px + dx, Y = py + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) shadow[Y * w + X] = 1; } } }
  const R = Math.max(1, Math.min(3, Math.round(F.c * 1.6 / mmPx))), tol = 2.2 * F.c, STEPS = 9;
  for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) { const a = Y * w + X, t = ix[a]!; if (t < 0) continue;
    let nx = 0, ny = 0, nz = 0; const d0 = zb[a]!;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const XX = X + dx, YY = Y + dy; if (XX < 0 || YY < 0 || XX >= w || YY >= h) continue; const b = YY * w + XX, u = ix[b]!; if (u < 0 || Math.abs(zb[b]! - d0) > tol) continue;
      if (F.nrm[u * 3]! * F.nrm[t * 3]! + F.nrm[u * 3 + 1]! * F.nrm[t * 3 + 1]! + F.nrm[u * 3 + 2]! * F.nrm[t * 3 + 2]! < 0.35) continue;   // across a real edge: not averaged away
      nx += F.nrm[u * 3]!; ny += F.nrm[u * 3 + 1]!; nz += F.nrm[u * 3 + 2]!; }
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const d = Math.max(0, nx * sun[0] + ny * sun[1] + nz * sun[2]), g = F.gloss[t]!, own = F.tex[t] === 1;
    let k = own ? Math.round((0.74 + 0.34 * d + 0.05 * Math.max(0, nz)) * 6) / 6 : 0.46 + 0.6 * d + 0.1 * Math.max(0, nz), s = 0;   // drawn colours in six light steps (a fixed set of tones per colour)
    if (g > 0.6 && !own) { k = nz > 0.55 ? 1.18 : nz > 0.15 ? 0.95 : nz > -0.15 ? 0.5 : 0.78; if (d > 0.9) s = 70; }          // bright metal: sky above, the dark horizon round its middle, the ground below
    else { k = Math.round(k * STEPS) / STEPS; if (g > 0.2 && d > (g > 0.4 ? 0.93 : 0.965)) s = g > 0.4 ? 90 : 55; }               // paint and glass: a small hard highlight where they face the sun
    if (g > 0.2 && g <= 0.6 && !own) s += 34 * Math.max(0, k - 0.5);   // a dark paint still shows its form: the sky's light lies on it, not only in it
    rgba[a * 4] = Math.min(255, F.col[t * 3]! * k + s); rgba[a * 4 + 1] = Math.min(255, F.col[t * 3 + 1]! * k + s); rgba[a * 4 + 2] = Math.min(255, F.col[t * 3 + 2]! * k + s * 1.05); rgba[a * 4 + 3] = 255; }
  // a pixel-art line round the car and where one surface stands well in front of another
  // lone pixels (a colour none of its four neighbours shares, all of them alike) take their neighbours' colour
  { const c2 = new Uint8ClampedArray(rgba); const same = (a: number, b: number) => Math.abs(c2[a * 4]! - c2[b * 4]!) + Math.abs(c2[a * 4 + 1]! - c2[b * 4 + 1]!) + Math.abs(c2[a * 4 + 2]! - c2[b * 4 + 2]!) < 18;
    for (let Y = 1; Y < h - 1; Y++) for (let X = 1; X < w - 1; X++) { const a = Y * w + X; if (!c2[a * 4 + 3]) continue; const nb = [a - 1, a + 1, a - w, a + w]; if (nb.some(b => !c2[b * 4 + 3])) continue;
      if (nb.every(b => !same(a, b)) && same(nb[0]!, nb[1]!) && same(nb[0]!, nb[2]!) && same(nb[0]!, nb[3]!)) for (let q = 0; q < 3; q++) rgba[a * 4 + q] = c2[nb[0]! * 4 + q]!; } }
  if (outline) { const o = new Uint8Array(w * h), jump = 3 * F.c;
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) { const a = Y * w + X; if (!rgba[a * 4 + 3]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const XX = X + dx, YY = Y + dy, b = YY * w + XX;
        if (XX < 0 || YY < 0 || XX >= w || YY >= h || !rgba[b * 4 + 3]) { o[a] = 2; break; } if (zb[b]! - zb[a]! > jump) o[a] = Math.max(o[a]!, 1);
        // where a bright part meets another part in front of it: a thin dark seam, so small fittings stand apart
        else if (ix[b]! >= 0 && ix[a]! >= 0 && F.part[ix[a]!] !== F.part[ix[b]!] && zb[b]! - zb[a]! > 0.6 * F.c && (F.gloss[ix[a]!]! > 0.6 || F.gloss[ix[b]!]! > 0.6)) o[a] = Math.max(o[a]!, 1); } }
    if (outline === 2) { const o2 = new Uint8Array(o); for (let Y = 1; Y < h - 1; Y++) for (let X = 1; X < w - 1; X++) { const a = Y * w + X; if (o[a] !== 2) continue; for (const b of [a - 1, a + 1, a - w, a + w]) if (rgba[b * 4 + 3] && !o[b]) o2[b] = 2; } o.set(o2); }   // a thicker outline: two pixels round the car
    for (let a = 0; a < w * h; a++) if (o[a]) { const k = o[a] === 2 ? 0.28 : 0.6; rgba[a * 4] = rgba[a * 4]! * k; rgba[a * 4 + 1] = rgba[a * 4 + 1]! * k; rgba[a * 4 + 2] = rgba[a * 4 + 2]! * k; } }
  for (let a = 0; a < w * h; a++) if (shadow[a] && !rgba[a * 4 + 3]) { rgba[a * 4] = 24; rgba[a * 4 + 1] = 22; rgba[a * 4 + 2] = 20; rgba[a * 4 + 3] = 110; }
  return { w, h, rgba }; }
