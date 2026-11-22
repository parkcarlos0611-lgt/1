// A car as a solid (review 73): its parts' outlines in the four views turned into one grid of small cells, each cell
// belonging to the part whose outline in every view it lies inside (each part's views set into its own common box, so
// the sheet's view-to-view disagreements do not eat holes in it). Two ways to draw it from above at a slant, for the
// track game's test of which keeps flowing bodies whole:
//   A  drawn whole from each heading (pre-rendered frames): every cell's face lit by the sun, nearest wins;
//   B  sprite stacking: the solid cut into level slices, each a plan picture lit once, stacked at the camera's slant
//      and turned at run time (here drawn the same way the game would).
import type { CarModel, CarPart } from './model';

export interface Solid { c: number; nx: number; ny: number; nz: number; x0: number; y0: number; owner: Int16Array; rgb: [number, number, number][]; mat: string[] }
const MAT_RGB: Record<string, string> = { chrome: '#c4c6c8', glass: '#7f909a', black: '#24232b', rubber: '#25232b', iron: '#4f525d', wood: '#9a6a3a', lens: '#d9d5b6', lensR: '#c22c2b', white: '#d4d7dc', canvas: '#8c8270' };
const hex = (h: string): [number, number, number] => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };

function inPoly(pts: number[][], u: number, v: number) { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [ui, vi] = pts[i]!, [uj, vj] = pts[j]!;
  if ((vi! > v) !== (vj! > v) && u < (uj! - ui!) * (v - vi!) / (vj! - vi! || 1e-9) + ui!) ins = !ins; } return ins; }

/** the car as cells of `c` mm (default 15): the body's parts and the wheels; the chassis layer left out */
export function solidOf(m: CarModel, c = 15, tyreW?: number): Solid {
  const L = m.length, W = m.width, H = m.height, x0 = -150, y0 = -W / 2 - 150, nx = Math.ceil((L + 300) / c), ny = Math.ceil((W + 300) / c), nz = Math.ceil((H + 150) / c);
  const owner = new Int16Array(nx * ny * nz).fill(-1), pri = new Float32Array(nx * ny * nz).fill(-1e9), rgb: [number, number, number][] = [], mat: string[] = [];
  const at = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const parts = m.parts.filter(p => p.layer !== 'chassis' && p.outlines);
  parts.forEach((p: CarPart) => {
    const r = p as unknown as { color?: string; lift?: number }, col = r.color ?? (p.material === 'paint' ? m.paint : p.material === 'paint2' ? m.paint2 : p.material === 'chrome' && (m as unknown as { chrome?: string }).chrome ? (m as unknown as { chrome: string }).chrome : MAT_RGB[p.material] ?? '#808080');
    const id = rgb.push(hex(col)) - 1; mat.push(p.material);
    const o = p.outlines, b = p.box, side = o.side, top = o.top, fr = o.front ?? o.rear, P = Math.max(Math.abs(b.y[0]), Math.abs(b.y[1])) + (r.lift ?? 0) * 3;
    for (const s of p.pair ? [1, -1] : [1]) {
      const ya = s > 0 ? b.y[0] : -b.y[1], yb = s > 0 ? b.y[1] : -b.y[0];
      const i0 = Math.max(0, Math.floor((b.x[0] - x0) / c)), i1 = Math.min(nx - 1, Math.ceil((b.x[1] - x0) / c)), j0 = Math.max(0, Math.floor((ya - y0) / c)), j1 = Math.min(ny - 1, Math.ceil((yb - y0) / c)), k0 = Math.max(0, Math.floor(b.z[0] / c)), k1 = Math.min(nz - 1, Math.ceil(b.z[1] / c));
      const U = (x: number) => (x - b.x[0]) / Math.max(1, b.x[1] - b.x[0]), Vz = (z: number) => (z - b.z[0]) / Math.max(1, b.z[1] - b.z[0]), Vy = (y: number) => ((s > 0 ? y : -y) - b.y[0]) / Math.max(1, b.y[1] - b.y[0]);
      // each view's outline as a mask over its two axes, then a cell is in when it is in every view the part has
      const sm = new Map<number, boolean>(), tm = new Map<number, boolean>(), fm = new Map<number, boolean>();
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = x0 + (i + 0.5) * c, y = y0 + (j + 0.5) * c, z = (k + 0.5) * c, u = U(x), vz = Vz(z), vy = Vy(y);
        if (u < 0 || u > 1 || vz < 0 || vz > 1 || vy < 0 || vy > 1) continue;
        if (side) { const key = k * nx + i; let v = sm.get(key); if (v === undefined) { v = inPoly(side, u, vz); sm.set(key, v); } if (!v) continue; }
        if (top) { const key = j * nx + i; let v = tm.get(key); if (v === undefined) { v = inPoly(top, u, vy); tm.set(key, v); } if (!v) continue; }
        if (fr) { const key = k * ny + j; let v = fm.get(key); if (v === undefined) { v = inPoly(fr, vy, vz); fm.set(key, v); } if (!v) continue; }
        const a = at(i, j, k); if (P >= pri[a]!) { pri[a] = P; owner[a] = id; } } } });
  // the wheels: a tyre round a rim and its cap, on each side, axis across the car
  const wi = m.wheel ?? {}, tw = tyreW ?? 175, tyre = rgb.push(hex('#25232b')) - 1; mat.push('rubber');
  const rimC = rgb.push(hex(wi.rimMaterial === 'paint' ? m.paint : wi.rimMaterial === 'paint2' ? m.paint2 : '#c4c6c8')) - 1; mat.push(wi.rimMaterial === 'chrome' ? 'chrome' : 'paint');
  for (const w of m.wheels) for (const s of [1, -1]) { const yc = s * w.y, rim = w.r * (wi.rim ?? 0.6);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + (i + 0.5) * c, y = y0 + (j + 0.5) * c, z = (k + 0.5) * c, d = Math.hypot(x - w.x, z - w.r);
      if (d > w.r || Math.abs(y - yc) > tw / 2) continue; const a = at(i, j, k), face = Math.abs(y - yc) > tw / 2 - c * 1.5;
      owner[a] = d > rim ? tyre : face ? rimC : tyre; pri[a] = 1e9; } }
  return { c, nx, ny, nz, x0, y0, owner, rgb, mat };
}

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
export function drawStack(sl: { z: number; pic: Pic }[], S: Solid, yaw: number, pitch: number, mmPx: number, size = 360): Pic {
  const w = size, h = Math.round(size * 0.75), rgba = new Uint8ClampedArray(w * h * 4), th = yaw * Math.PI / 180, ph = pitch * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th), sp = Math.sin(ph), cp = Math.cos(ph);
  for (const { z, pic } of sl) { const ox = pic.w / 2, oy = (-S.y0) / mmPx, lift = z * cp / mmPx;
    // each screen pixel looks back into the slice (turned the other way, unsquashed)
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) { const sx = (X - w / 2) * mmPx, syp = (Y - h * 0.62 + lift) * mmPx / sp * -1;
      const x = sx * ct + syp * st, y = -sx * st + syp * ct, i = Math.floor(x / mmPx + ox), j = Math.floor(y / mmPx + oy);
      if (i < 0 || j < 0 || i >= pic.w || j >= pic.h) continue; const a = (j * pic.w + i) * 4; if (!pic.rgba[a + 3]) continue; const b = (Y * w + X) * 4; rgba[b] = pic.rgba[a]!; rgba[b + 1] = pic.rgba[a + 1]!; rgba[b + 2] = pic.rgba[a + 2]!; rgba[b + 3] = 255; } }
  return { w, h, rgba }; }
