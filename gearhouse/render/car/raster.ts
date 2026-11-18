// Car body rasteriser (prototype 1): panel outlines in millimetres -> a side view about 400 px long at 12.5 mm/px.
// Per panel: coverage mask -> surface normal (curvature across the panel + rounded edges) -> light and the
// reflected sky / horizon / ground of a glossy body -> a material ramp, with ordered dithering on paint.
// Then shut lines, details, wheels and a selective outline. Pure code: runs in the browser and in node.
import type { CarDesign, Feature, Material, Panel, Pt, Surface, WheelSpec } from './types';
import { coverage, insideDistance, smoothClosed, smoothOpen } from './geom';
import { rampsFor, type RGB } from './palette';

export const MM_PER_PX = 12.5;
const PAD = 6;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - 0.5);

const SURF: Record<Surface, { cv: number; ch: number; bevel: number }> = {
  side: { cv: 0.55, ch: 0.06, bevel: 2.5 }, hood: { cv: 0.4, ch: 0.05, bevel: 2 }, roof: { cv: 1.25, ch: 0.18, bevel: 4 },
  fender: { cv: 0.5, ch: 0.35, bevel: 9 }, flat: { cv: 0.12, ch: 0, bevel: 1.5 } };
const LIGHT = norm([-0.45, -0.8, 0.55]);
function norm(v: number[]): [number, number, number] { const l = Math.hypot(v[0]!, v[1]!, v[2]!) || 1; return [v[0]! / l, v[1]! / l, v[2]! / l]; }

/** what the sky, the horizon line and the ground give back along a reflected ray (y down: negative = up) */
function env(ry: number): number {
  if (ry < -0.12) return 0.72 + 0.28 * Math.min(1, (-ry - 0.12) / 0.55);
  if (ry < 0.06) return 0.1 + 0.05 * (ry + 0.12) / 0.18;
  return 0.42 - 0.2 * Math.min(1, (ry - 0.06) / 0.6); }

export interface CarImage { w: number; h: number; rgba: Uint8ClampedArray; owner: Int16Array; ms: number; groundY: number; X: (x: number) => number; Y: (z: number) => number }

export function rasterize(d: CarDesign): CarImage {
  const t0 = performance.now(), R = rampsFor(d.paint, d.paint2);
  const w = Math.ceil(d.length / MM_PER_PX) + PAD * 2, h = Math.ceil(d.height / MM_PER_PX) + PAD * 2, gy = h - PAD;
  const X = (x: number) => PAD + x / MM_PER_PX, Y = (z: number) => gy - z / MM_PER_PX;
  const rgba = new Uint8ClampedArray(w * h * 4), owner = new Int16Array(w * h).fill(-1), mat: Material[] = [], level = new Uint8Array(w * h);
  const ids: string[] = [], groups: (string | undefined)[] = [];
  const put = (x: number, y: number, m: Material, lv: number, id: number) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = y * w + x, ramp = R[m], k = Math.max(0, Math.min(ramp.length - 1, lv)), c = ramp[k]!;
    rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = 255; owner[i] = id; mat[id] = m; level[i] = k; };
  const quant = (m: Material, v: number, x: number, y: number) => { const n = R[m].length, dz = m === 'paint' || m === 'paint2' || m === 'canvas' ? 0.32 : m === 'black' || m === 'rubber' ? 0.22 : 0.08;
    return Math.round(Math.max(0, Math.min(1, v)) * (n - 1) + BAYER[(y & 3) * 4 + (x & 3)]! * dz); };

  // ---- draw order: panels and wheels together ----
  const items: ({ k: 'p'; p: Panel } | { k: 'w'; s: WheelSpec })[] = [...d.panels.map(p => ({ k: 'p' as const, p })), ...d.wheels.map(s => ({ k: 'w' as const, s }))];
  const zOf = (it: (typeof items)[number]) => (it.k === 'p' ? it.p.z : it.s.zOrder ?? 5);
  items.sort((a, b) => zOf(a) - zOf(b));
  for (const it of items) {
    if (it.k === 'w') { const id = ids.push('wheel') - 1; groups.push(undefined); drawWheel(it.s, id); continue; }
    const p = it.p, id = ids.push(p.id) - 1; groups.push(p.group);
    const poly = smoothClosed(p.pts).map(([x, z]) => [X(x), Y(z)] as [number, number]);
    let x0 = w, x1 = 0, y0 = h, y1 = 0; for (const [px, py] of poly) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const bx = Math.max(0, Math.floor(x0) - 2), by = Math.max(0, Math.floor(y0) - 2), bw = Math.min(w, Math.ceil(x1) + 3) - bx, bh = Math.min(h, Math.ceil(y1) + 3) - by;
    if (bw <= 0 || bh <= 0) continue;
    const cov = coverage(poly.map(([px, py]) => [px - bx, py - by] as [number, number]), bw, bh), mask = new Uint8Array(bw * bh);
    for (let i = 0; i < bw * bh; i++) mask[i] = cov[i]! >= 0.5 ? 1 : 0;
    if (p.cut) for (const c of p.cut) { const cx = X(c.x) - bx, cy = Y(c.z) - by, rr = c.r / MM_PER_PX; for (let y = Math.max(0, Math.floor(cy - rr)); y < Math.min(bh, cy + rr + 1); y++) for (let x = Math.max(0, Math.floor(cx - rr)); x < Math.min(bw, cx + rr + 1); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < rr) mask[y * bw + x] = 0; }
    if (p.clip) for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const o = owner[(by + y) * w + bx + x]!; if (o < 0 || !ids[o]!.startsWith(p.clip)) mask[y * bw + x] = 0; }
    const dist = insideDistance(mask, bw, bh), S = SURF[p.surface], bev = p.bevel ?? S.bevel;
    // column and row spans for the curvature across the panel
    const top = new Int16Array(bw).fill(-1), bot = new Int16Array(bw).fill(-1), lft = new Int16Array(bh).fill(-1), rgt = new Int16Array(bh).fill(-1);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (mask[y * bw + x]) { if (top[x]! < 0) top[x] = y; bot[x] = y; if (lft[y]! < 0) lft[y] = x; rgt[y] = x; }
    const dAt = (x: number, y: number) => (x < 0 || y < 0 || x >= bw || y >= bh ? 0 : dist[y * bw + x]!);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = y * bw + x; if (!mask[i]) continue;
      const tv = (y - top[x]!) / Math.max(1, bot[x]! - top[x]!), th = (x - lft[y]!) / Math.max(1, rgt[y]! - lft[y]!);
      let nx = (th - 0.5) * 2 * S.ch, ny = (tv - 0.5) * 2 * S.cv; const dd = dist[i]!;
      if (dd < bev) { const gx = dAt(x + 1, y) - dAt(x - 1, y), gyy = dAt(x, y + 1) - dAt(x, y - 1), gl = Math.hypot(gx, gyy) || 1, k = (1 - dd / bev) ** 1.5 * 1.7; nx -= gx / gl * k; ny -= gyy / gl * k; }
      const n = norm([nx, ny, 1]), diff = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]), r = [2 * n[2] * n[0], 2 * n[2] * n[1], 2 * n[2] * n[2] - 1];
      const spec = Math.max(0, r[0]! * LIGHT[0] + r[1]! * LIGHT[1] + r[2]! * LIGHT[2]) ** 28, e = env(r[1]!), gx2 = bx + x, gy2 = by + y;
      let v: number;
      switch (p.material) {
        case 'chrome': v = 0.06 + 0.78 * e * (0.7 + 0.3 * diff) + 0.35 * spec; break;
        case 'glass': v = 0.16 + 0.42 * (1 - tv) * 0.8 + (((gx2 + gy2 * 0.7) % 31) < 2 && tv < 0.7 ? 0.22 : 0) + 0.15 * spec; break;
        case 'black': case 'rubber': v = 0.12 + 0.42 * diff + 0.3 * e + 0.5 * spec; break;
        case 'shadow': v = 0.3 + 0.5 * tv; break;
        case 'lens': case 'lensR': v = 0.35 + 0.5 * (1 - tv) + 0.3 * spec; break;
        case 'iron': case 'white': v = 0.15 + 0.6 * diff + 0.15 * e; break;
        case 'canvas': case 'wood': v = 0.12 + 0.75 * diff + 0.08 * e; break;
        default: v = 0.06 + 0.4 * diff + 0.42 * e + 0.55 * spec; }
      put(gx2, gy2, p.material, quant(p.material, v, gx2, gy2), id); }
  }

  // ---- wheels: tyre, rim, spokes or disc, hub, all drawn per pixel ----
  function drawWheel(s: WheelSpec, id: number) {
    const cx = X(s.x), cy = Y(s.z ?? s.r), Ro = s.r / MM_PER_PX, Ri = Ro * s.rim, Rh = Ro * 0.24;
    for (let y = Math.floor(cy - Ro - 1); y <= Math.ceil(cy + Ro + 1); y++) for (let x = Math.floor(cx - Ro - 1); x <= Math.ceil(cx + Ro + 1); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, rr = Math.hypot(dx, dy); if (rr > Ro) continue; const ux = dx / (rr || 1), uy = dy / (rr || 1);
      if (rr > Ri) {                                                                                       // tyre: a torus seen side-on
        const u = (rr - Ri) / (Ro - Ri), n = norm([ux * (u - 0.45) * 1.8, uy * (u - 0.45) * 1.8, 1]), diff = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
        if (s.whitewall && u > 0.18 && u < 0.18 + s.whitewall) { put(x, y, 'paint2', 3 + Math.round(diff * 5), id); mat[id] = 'rubber'; continue; }
        let v = 0.1 + 0.6 * diff; if (u > 0.9) v *= 0.6; if (Math.abs(u - 0.62) < 0.03) v += 0.08;
        put(x, y, 'rubber', quant('rubber', v, x, y), id); continue; }
      if (rr > Ri - 1.6) { const n = norm([ux * 0.9, uy * 0.9, 1]), diff = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2], rm = s.rimMaterial;   // rim lip
        put(x, y, rm, quant(rm, rm === 'chrome' ? 0.3 + 0.7 * env(2 * n[2] * n[1]) : 0.25 + 0.6 * diff, x, y), id); continue; }
      if (rr < Rh) { const n = norm([dx / Rh * 0.9, dy / Rh * 0.9, 1]), e = env(2 * n[2] * n[1]), diff = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);   // hub cap dome
        put(x, y, 'chrome', quant('chrome', 0.08 + 0.8 * e * (0.7 + 0.3 * diff) + (rr < Rh * 0.35 && dx < 0 && dy < 0 ? 0.25 : 0), x, y), id); continue; }
      const ang = Math.atan2(dy, dx);
      if (s.style === 'wire') {                                                                            // laced spokes: two crossing sets
        let on = false; for (let k = 0; k < s.spokes && !on; k++) { const a = (k / s.spokes) * Math.PI * 2, off = (k % 2 ? 1 : -1) * Rh * 0.85;
          const px = Math.cos(a), py = Math.sin(a), along = dx * px + dy * py, across = -dx * py + dy * px - off * (1 - along / Ri);
          if (along > 0 && Math.abs(across) < 0.42) on = true; }
        if (on) put(x, y, 'chrome', quant('chrome', 0.45 + 0.4 * Math.max(0, -(dx + dy) / (rr * 1.5)), x, y), id);
        else put(x, y, 'shadow', rr > Ri * 0.6 ? 1 : 0, id);
      } else if (s.style === 'artillery') {                                                                // wide spokes, wood or steel
        const a = ((ang / (Math.PI * 2)) * s.spokes % 1 + 1) % 1, wdt = 0.13 + 0.12 * (1 - rr / Ri);
        if (Math.abs(a - 0.5) < wdt) { const side = (a - 0.5) / wdt; put(x, y, s.rimMaterial, quant(s.rimMaterial, 0.5 - side * 0.35, x, y), id); }
        else put(x, y, 'shadow', 0, id);
      } else { const n = norm([ux * (rr / Ri - 0.55) * 0.9, uy * (rr / Ri - 0.55) * 0.9, 1]), diff = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);   // pressed disc
        put(x, y, s.rimMaterial, quant(s.rimMaterial, 0.15 + 0.7 * diff + (Math.abs(rr / Ri - 0.55) < 0.04 ? -0.15 : 0), x, y), id); }
    }
  }

  // ---- shut lines where panels of one group meet: a dark gap with a lit lip above it ----
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, o = owner[i]!; if (o < 0 || !groups[o]) continue;
    for (const j of [i + 1, i + w]) { const q = owner[j]!; if (q >= 0 && q !== o && groups[q] === groups[o]) { recolour(j, mat[q]!, 0); if (level[i]! < R[mat[o]!].length - 2) recolour(i, mat[o]!, level[i]! + 1); } } }
  function recolour(i: number, m: Material, lv: number) { const c = R[m][Math.max(0, Math.min(R[m].length - 1, lv))]!; rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; level[i] = lv; }

  // ---- window reveals: a shadowed recess along the top and front of each glass, a lit sill below it ----
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, o = owner[i]!; if (o < 0 || mat[o] !== 'glass' || ids[o] === 'detail') continue;
    const up = owner[i - w]!, lf = owner[i - 1]!, dn = owner[i + w]!;
    const rt = owner[i + 1]!, edge = (q: number) => q >= 0 && q !== o && mat[q] !== 'glass' && mat[q] !== 'shadow';
    if (d.frame === 'chrome') { if (edge(up)) recolour(i, 'chrome', 6); else if (edge(dn)) recolour(i, 'chrome', 3); else if (edge(lf) || edge(rt)) recolour(i, 'chrome', 5); }
    else if (edge(up) || edge(lf)) recolour(i, 'black', 0); else if (edge(dn)) recolour(i, 'chrome', 4); }

  // ---- details ----
  const px = (p: Pt): [number, number] => [X(p[0]), Y(p[1])];
  const fid = ids.push('detail') - 1;
  const at = (x: number, y: number) => { const o = x >= 0 && y >= 0 && x < w && y < h ? owner[y * w + x]! : -1; return o >= 0 && ids[o] === 'wheel' ? -1 : o; };   // details never land on a wheel
  for (const f of d.features) drawFeature(f);
  function line(pts: [number, number][], fn: (x: number, y: number) => void) { let last = ''; for (let k = 0; k + 1 < pts.length; k++) { const [ax, ay] = pts[k]!, [bx2, by2] = pts[k + 1]!, n = Math.ceil(Math.hypot(bx2 - ax, by2 - ay) * 2) + 1;
    for (let s = 0; s <= n; s++) { const x = Math.floor(ax + (bx2 - ax) * s / n), y = Math.floor(ay + (by2 - ay) * s / n), key = x + ',' + y; if (key !== last) { last = key; fn(x, y); } } } }
  function drawFeature(f: Feature) {
    switch (f.kind) {
      case 'seam': line(smoothOpen(f.pts).map(([x, z]) => [X(x), Y(z)]), (x, y) => { const o = at(x, y); if (o < 0) return; const m = mat[o]!; if (f.lit) { if (m === 'glass' || m === 'shadow') return; recolour(y * w + x, m, Math.min(R[m].length - 1, level[y * w + x]! + 2)); if (at(x, y + 1) === o) recolour((y + 1) * w + x, m, Math.max(0, level[(y + 1) * w + x]! - 2)); return; } recolour(y * w + x, m, 0); const up = (y - 1) * w + x; if (at(x, y - 1) === o) recolour(up, m, Math.min(R[m].length - 1, level[up]! + 1)); }); break;
      case 'trim': line(smoothOpen(f.pts).map(([x, z]) => [X(x), Y(z)]), (x, y) => { if (at(x, y) < 0) return; put(x, y, 'chrome', 6, fid); if ((f.width ?? 2) > 1 && at(x, y + 1) >= 0) put(x, y + 1, 'chrome', 2, fid); }); break;
      case 'handle': { const [x, y] = px(f.at).map(Math.round) as [number, number], n = Math.max(3, Math.round((f.len ?? 110) / MM_PER_PX));
        for (let k = 0; k < n; k++) { put(x + k, y, 'chrome', k === 0 ? 7 : k === n - 1 ? 3 : 5, fid); if (at(x + k, y + 1) >= 0) recolour((y + 1) * w + x + k, mat[at(x + k, y + 1)]!, 0); } put(x + 1, y - 1, 'chrome', 4, fid); break; }
      case 'hinge': { const [x, y] = px(f.at).map(Math.round) as [number, number]; put(x, y, 'chrome', 6, fid); put(x, y + 1, 'chrome', 4, fid); put(x, y + 2, 'chrome', 2, fid); put(x + 1, y + 1, 'chrome', 1, fid); break; }
      case 'bolt': { const [x, y] = px(f.at).map(Math.round) as [number, number]; const o = at(x, y); if (o < 0) break; recolour(y * w + x, mat[o]!, R[mat[o]!].length - 1); if (at(x + 1, y + 1) === o) recolour((y + 1) * w + x + 1, mat[o]!, 1); break; }
      case 'louvres': { const n = f.n, sl = f.slant ?? 0.25; for (let k = 0; k < n; k++) { const xm = f.x0 + (f.x1 - f.x0) * (k + 0.5) / n, a: [number, number] = [X(xm), Y(f.z1)], b: [number, number] = [X(xm - (f.z1 - f.z0) * sl), Y(f.z0)];
          line([a, b], (x, y) => { const o = at(x, y); if (o < 0) return; const m = mat[o]!; recolour(y * w + x, m, 0); if (at(x - 1, y) === o) recolour(y * w + x - 1, m, R[m].length - 2); }); } break; }
      case 'lamp': { const [cx, cy] = px(f.at), r = f.r / MM_PER_PX, dir = f.facing === 'front' ? -1 : 1;
        for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r * 1.3 - 1); x <= cx + r * 1.3 + 1; x++) {
          const dx = (x + 0.5 - cx) / (r * 1.25), dy = (y + 0.5 - cy) / r, q = dx * dx + dy * dy; if (q > 1) continue;
          const lens = dx * dir > 0.55, n = norm([dx, dy, Math.sqrt(Math.max(0, 1 - q)) + 0.2]);
          if (lens) { if (f.facing === 'front') put(x, y, 'glass', dy < -0.35 && dy > -0.75 ? 5 : dy < 0.2 ? 3 : 2, fid); else put(x, y, 'paint', 7, fid); }
          else put(x, y, 'chrome', quant('chrome', 0.05 + 0.9 * env(2 * n[2] * n[1]) + (dx < -0.3 && dy < -0.3 ? 0.2 : 0), x, y), fid); } break; }
      case 'cap': { const [x, y] = px(f.at).map(Math.round) as [number, number], n = Math.round(f.h / MM_PER_PX); for (let k = 0; k < n; k++) { put(x, y - k, 'chrome', k === n - 1 ? 7 : 4, fid); put(x + 1, y - k, 'chrome', 2, fid); } put(x - 1, y - n + 1, 'chrome', 6, fid); put(x + 2, y - n + 1, 'chrome', 3, fid); break; }
      case 'plate': { const [x0, y0] = px([f.x0, f.z0 + f.h]).map(Math.round) as [number, number], ww = Math.round(f.w / MM_PER_PX), hh = Math.round(f.h / MM_PER_PX);
        for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) put(x0 + x, y0 + y, x === 0 || y === 0 || x === ww - 1 || y === hh - 1 ? 'black' : 'canvas', x === 0 || y === 0 || x === ww - 1 || y === hh - 1 ? 1 : 5, fid); break; }
    }
  }

  // ---- selective outline: the silhouette takes the darkest shade, a touch lighter where the light falls ----
  const isBg = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || owner[y * w + x] === -1;
  const edge: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (isBg(x, y)) continue; if (isBg(x - 1, y) || isBg(x + 1, y) || isBg(x, y - 1) || isBg(x, y + 1)) edge.push(y * w + x); }
  for (const i of edge) { const x = i % w, y = (i - x) / w, m = mat[owner[i]!]!, lit = isBg(x, y - 1) || isBg(x - 1, y); recolour(i, m === 'chrome' ? 'chrome' : m, lit && m !== 'glass' ? 1 : 0); }

  return { w, h, rgba, owner, ms: performance.now() - t0, groundY: gy, X, Y };
}
