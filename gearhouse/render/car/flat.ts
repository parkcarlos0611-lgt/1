// Car body rasteriser in the first build's manner: few flat tones per material (5 steps), a dark outline drawn
// only where a part meets the background or a part behind it, narrow dithering at tone steps, chunky window
// frames. Same design data as raster.ts; parts are drawn strictly in their layer order.
import type { CarDesign, Detail, ElementDecals, ElementSkin, Feature, Material, Panel, Pt, WheelSpec } from './types';
import { coverage, smoothClosed, smoothOpen } from './geom';
import type { CarImage } from './raster';
import { expandParts } from './parts';

export const MM_PER_PX = 10;
const PAD = 6;
type RGB = [number, number, number];
interface Ramp { c: RGB[]; o: RGB }

// ---- palette: OKLab ramps, darker steps drift to blue-violet, lighter to warm yellow (first build's color.mjs) ----
const hex = (h: string): RGB => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const s2l = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const l2s = (c: number) => Math.max(0, Math.min(255, Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055))));
function toLab([r, g, b]: RGB): RGB { const R = s2l(r), G = s2l(g), B = s2l(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; }
function fromLab([L, a, b]: RGB): RGB { const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [l2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), l2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), l2s(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)]; }
const lerpHue = (h: number, t: number, k: number) => { const d = ((t - h + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return h + d * k; };
export function autoRamp(base: string, { steps = 5, baseIdx = 2, dL = 0.1, shift = 0.12, sat = 1 } = {}): Ramp {
  const [L, a, b] = toLab(hex(base)), C = Math.hypot(a, b) * sat, H = Math.atan2(b, a), c: RGB[] = [];
  for (let i = 0; i < steps; i++) { const k = i - baseIdx, down = Math.min(dL, Math.max(0.02, (L - 0.09) / Math.max(1, baseIdx))), L2 = Math.max(0.08, Math.min(0.98, L + k * (k < 0 ? down : dL))), H2 = lerpHue(H, k < 0 ? 4.6 : 1.5, Math.min(1, Math.abs(k) * shift)), C2 = C * (k > 0 ? 1 - 0.18 * k : 1 - 0.08 * -k) + (C < 0.02 ? 0 : 0.004 * Math.abs(k));
    c.push(fromLab([L2, C2 * Math.cos(H2), C2 * Math.sin(H2)])); }
  const [L0, a0, b0] = toLab(c[0]!), C0 = Math.hypot(a0, b0), H0 = lerpHue(Math.atan2(b0, a0), 4.6, 0.3);
  return { c, o: fromLab([Math.max(0.06, L0 - 0.11), C0 * 0.9 * Math.cos(H0), C0 * 0.9 * Math.sin(H0)]) }; }
const fixed = (c: string[], o: string): Ramp => ({ c: c.map(hex), o: hex(o) });
/** a glossy paint gives back the sky: one more step above the ramp, pale and nearly grey, for reflection bands */
function glossy(r: Ramp): Ramp { const t = r.c.at(-1)!, sky: RGB = [196, 204, 200]; return { c: [...r.c, t.map((v, i) => Math.round(v * 0.62 + sky[i]! * 0.38)) as RGB], o: r.o }; }
/** the tone steps a paint colour is drawn with, darkest first (tools fit a reference view to these) */
export const paintRamp = (paint: string): string[] => glossy(autoRamp(paint, { steps: 7, baseIdx: 3, dL: 0.075, shift: 0.06 })).c.map(c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''));
/** every material's tone steps for a paint colour, darkest first, as the renderer draws them (tools fit views to these) */
export const gameRamps = (paint: string): Record<string, string[]> => Object.fromEntries(Object.entries(palette({ paint, paint2: paint } as CarDesign)).map(([k, r]) => [k, r.c.map(c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''))]));
function palette(d: CarDesign): Record<Material, Ramp> {
  return { paint: glossy(autoRamp(d.paint, { steps: 7, baseIdx: 3, dL: 0.075, shift: 0.06 })), paint2: glossy(autoRamp(d.paint2, { steps: 7, baseIdx: 3, dL: 0.075, shift: 0.06 })),
    rubber: fixed(['#16141b', '#24222b', '#36343f', '#4f4d59', '#6e6c78'], '#0b0a0f'), chrome: fixed(['#2a3047', '#56627e', '#93a3bb', '#cfd9e6', '#ffffff'], '#171b2a'),
    glass: fixed(['#2c343b', '#56616a', '#8e989f', '#b9c1c5', '#e0e5e6'], '#141a1f'), lens: fixed(['#5e5a48', '#9d9a80', '#d9d5b6', '#f5f2dc', '#ffffff'], '#2d2b24'),
    lensR: fixed(['#3d0a16', '#7a1522', '#c22c2b', '#f06a4a', '#ffc49a'], '#22050c'), iron: fixed(['#202128', '#34363f', '#4f525d', '#737783', '#a1a5ae'], '#121318'),
    black: fixed(['#0f0e14', '#1b1a22', '#2a2933', '#403f4b', '#5d5c69'], '#07060a'), white: fixed(['#7b7f8c', '#a9adb7', '#d4d7dc', '#eff0ef', '#ffffff'], '#3e404a'),
    shadow: fixed(['#07060a', '#0f0e14', '#16151c', '#1b1a22', '#22212a'], '#07060a'), wood: autoRamp('#9a6a3a', { sat: 0.9 }), canvas: autoRamp(d.canvas ?? '#8c8270', { sat: 0.8 }) }; }

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(n => (n + 0.5) / 16);
/** dither only a narrow band around each tone step: clean flats, soft seams */
const dith = (x: number, y: number, v: number, w = 0.22) => { const f = Math.floor(v), fr = Math.min(1, Math.max(0, (v - f - 0.5) / (2 * w) + 0.5)); return Math.max(0, Math.min(4, f + (fr > BAYER[(y & 3) * 4 + (x & 3)]! ? 1 : 0))); };
/** materials that get the dark outline where they meet the background or a part behind them */
const OUTLINED = new Set<Material>(['paint', 'paint2', 'chrome', 'black', 'rubber', 'iron', 'white', 'wood', 'canvas', 'lens', 'lensR']);
/** shading of a painted run, top to bottom, by kind of surface */
const GRAD: Record<string, [number, number]> = { side: [2.75, 1.45], hood: [3.0, 1.6], roof: [3.5, 2.1], fender: [3.25, 0.45], flat: [2.2, 1.6] };

export function rasterizeFlat(d0: CarDesign, opt: { frameW?: number; shadow?: boolean; mm?: number; outline?: number } = {}): CarImage {
  const d = expandParts(d0);
  const MM = opt.mm ?? MM_PER_PX, t0 = performance.now(), PAL = palette(d), frameW = opt.frameW ?? Math.max(2, Math.round(20 / MM));
  const span = (n: number) => Math.max(1, Math.round(n / MM)), w = Math.ceil(d.length / MM) + PAD * 2, h = Math.ceil(d.height / MM) + PAD * 2, gy = h - PAD;
  const X = (x: number) => PAD + x / MM, Y = (z: number) => gy - z / MM;
  const N = w * h, mat = new Array<Material | null>(N).fill(null), lv = new Int8Array(N), layer = new Int32Array(N).fill(-1), owner = new Int16Array(N).fill(-1), noOutline = new Uint8Array(N);
  const ids: string[] = [];
  // ---- method ZY: the reference view's own detail on each element, where the view shows it ----
  const SK = d.skin, skinRGB = new Int32Array(N).fill(-1), skRamp: Partial<Record<Material, RGB[]>> = {};
  if (SK && !SK.common) { for (const [k, v] of Object.entries(SK.tones ?? {})) skRamp[k as Material] = v!.map(hex); const n = skRamp.paint?.length ?? 8;
    if (d.paint.toLowerCase() !== SK.paint.toLowerCase()) skRamp.paint = autoRamp(d.paint, { steps: n, baseIdx: Math.floor(n * 0.45), dL: 0.52 / n, shift: 0.06 }).c;
    if (skRamp.paint) PAL.paint = { c: skRamp.paint, o: PAL.paint.o }; }
  function applySkin(S: ElementSkin, own: number, x0: number, x1: number, z0: number, z1: number) {
    const g = new Int16Array(S.w * S.h); let q = 0; for (let i = 0; i < S.d.length; i += 2) { g.fill(S.d[i]!, q, q + S.d[i + 1]!); q += S.d[i + 1]!; }
    const pi = SK!.materials.indexOf('paint'), cnt = new Int32Array(16); for (const v of g) if (v >= 0 && v >> 4 === pi) cnt[v & 15]!++; let plain = -1, best = 0; cnt.forEach((c, k) => { if (c > best) { best = c; plain = k; } });
    const kx = (S.b[1] - S.b[0]) / Math.max(1, x1 - x0), kz = (S.b[3] - S.b[2]) / Math.max(1, z1 - z0), cell = (sx: number, sy: number) => (sx < 0 || sy < 0 || sx >= S.w || sy >= S.h ? -1 : g[sy * S.w + sx]!);
    for (let y = Math.max(0, Math.floor(Y(z1)) - 1); y <= Math.min(h - 1, Math.ceil(Y(z0)) + 1); y++) for (let x = Math.max(0, Math.floor(X(x0)) - 1); x <= Math.min(w - 1, Math.ceil(X(x1)) + 1); x++) { const i = y * w + x; if (owner[i] !== own) continue;
      const sx = Math.floor((S.b[0] + ((x + 0.5 - PAD) * MM - x0) * kx - S.x0) / SK!.mm), sy = Math.floor((S.z1 - (S.b[2] + ((gy - y - 0.5) * MM - z0) * kz)) / SK!.mm);
      let v = cell(sx, sy); if (v < 0) for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) { v = cell(sx + dx, sy + dy); if (v >= 0) break; }
      if (v < 0) { if (plain >= 0 && (mat[i] === 'paint' || mat[i] === 'paint2')) lv[i] = plain; continue; }   // not in the view: the element's own usual tone, drawn by the rules
      const m = SK!.materials[v >> 4]!, r = skRamp[m] ?? PAL[m].c, c = r[Math.min(r.length - 1, v & 15)]!; mat[i] = m; skinRGB[i] = (c[0] << 16) | (c[1] << 8) | c[2]; } }
  /** method Z2: fill each region of an element (even-odd over its rings), mapped from the box it was read in to the element's box now */
  const DC = d.decals;
  function applyDecals(D: ElementDecals, own: number, x0: number, x1: number, z0: number, z1: number) {
    const kx = Math.max(1, x1 - x0) / Math.max(1, D.b[1] - D.b[0]), kz = Math.max(1, z1 - z0) / Math.max(1, D.b[3] - D.b[2]);
    for (const R of D.r) { const ramp = PAL[R.m].c, c = ramp[Math.min(ramp.length - 1, R.l)]!, rgb = (c[0] << 16) | (c[1] << 8) | c[2];
      const rings = R.rings.map(r => { const o: number[] = []; for (let i = 0; i < r.length; i += 2) o.push(X(x0 + (r[i]! - D.b[0]) * kx), Y(z0 + (r[i + 1]! - D.b[2]) * kz)); return o; });
      let ya = 1e9, yb = -1e9; for (const r of rings) for (let i = 1; i < r.length; i += 2) { ya = Math.min(ya, r[i]!); yb = Math.max(yb, r[i]!); }
      for (let y = Math.max(0, Math.floor(ya)); y <= Math.min(h - 1, Math.ceil(yb)); y++) { const cy = y + 0.5, xs: number[] = [];
        for (const r of rings) { const n = r.length / 2; for (let i = 0; i < n; i++) { const ax = r[i * 2]!, ay = r[i * 2 + 1]!, bx = r[((i + 1) % n) * 2]!, by = r[((i + 1) % n) * 2 + 1]!; if ((ay <= cy) !== (by <= cy)) xs.push(ax + (cy - ay) * (bx - ax) / (by - ay)); } }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k]! - 0.5)); x <= Math.min(w - 1, Math.floor(xs[k + 1]! - 0.5)); x++) { const i = y * w + x; if (owner[i] !== own) continue; mat[i] = R.m; skinRGB[i] = rgb; } } } }
  const boxMM = (pts: Pt[]) => { let a = 1e9, b = -1e9, c = 1e9, e = -1e9; for (const q of pts) { a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); e = Math.max(e, q[1]); } return [a, b, c, e] as const; };
  const shift = (m: Material) => (PAL[m].c.length - 5) >> 1;
  const set = (x: number, y: number, m: Material, l: number, ly: number, id = -1) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = y * w + x; if (ly >= 1e6 && skinRGB[i]! >= 0) return; skinRGB[i] = -1; mat[i] = m; lv[i] = Math.max(0, Math.min(PAL[m].c.length - 1, Math.max(0, Math.min(4, l)) + shift(m))); layer[i] = ly; if (id >= 0) owner[i] = id; };
  /** a level on the material's own ramp, top step included (reflections) */
  const setRaw = (i: number, l: number) => { const m = mat[i]; if (m) lv[i] = Math.max(0, Math.min(PAL[m].c.length - 1, l)); };
  const top = (i: number) => PAL[mat[i]!].c.length - 1;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x);

  const items: ({ k: 'p'; p: Panel } | { k: 'w'; s: WheelSpec })[] = [...d.panels.map(p => ({ k: 'p' as const, p })), ...d.wheels.map(s => ({ k: 'w' as const, s }))];
  const zOf = (it: (typeof items)[number]) => (it.k === 'p' ? it.p.z : it.s.zOrder ?? 5);
  items.sort((a, b) => zOf(a) - zOf(b));
  const glassMasks: { m: Uint8Array; bx: number; by: number; bw: number; bh: number; ly: number; id: number }[] = [];
  items.forEach((it, ly) => {
    if (it.k === 'w') { const wi = ids.push('wheel') - 1, s = it.s, S = SK?.elements['wheel' + d.wheels.indexOf(s)], zc = s.z ?? s.r; drawWheel(s, ly, wi); const sig = s.style + ':' + (s.whitewall ?? 0); if (S && S.sig === sig) applySkin(S, wi, s.x - s.r, s.x + s.r, zc - s.r, zc + s.r); const D = DC?.['wheel' + d.wheels.indexOf(s)]; if (D && D.sig === sig) applyDecals(D, wi, s.x - s.r, s.x + s.r, zc - s.r, zc + s.r); return; }
    const p = it.p, id = ids.push(p.id) - 1, poly = smoothClosed(p.pts).map(([x, z]) => [X(x), Y(z)] as [number, number]);
    let x0 = w, x1 = 0, y0 = h, y1 = 0; for (const [px, py] of poly) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const bx = Math.max(0, Math.floor(x0) - 1), by = Math.max(0, Math.floor(y0) - 1), bw = Math.min(w, Math.ceil(x1) + 2) - bx, bh = Math.min(h, Math.ceil(y1) + 2) - by; if (bw <= 0 || bh <= 0) return;
    const cov = coverage(poly.map(([px, py]) => [px - bx, py - by] as [number, number]), bw, bh), m = new Uint8Array(bw * bh);
    for (let i = 0; i < bw * bh; i++) m[i] = cov[i]! >= 0.5 ? 1 : 0;
    if (p.cut) for (const c of p.cut) { const cx = X(c.x) - bx, cy = Y(c.z) - by, rr = c.r / MM; for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < rr) m[y * bw + x] = 0; }
    if (p.clip) for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const o = owner[(by + y) * w + bx + x]!; if (o < 0 || !ids[o]!.startsWith(p.clip)) m[y * bw + x] = 0; }
    const M = (x: number, y: number) => x >= 0 && y >= 0 && x < bw && y < bh && m[y * bw + x] === 1;
    const mt = p.material, T = d.tones?.[p.id]; let tm: Int16Array | null = null;
    if (T) { tm = new Int16Array(T.w * T.h); let q = 0; for (let i = 0; i < T.d.length; i += 2) { tm.fill(T.d[i]!, q, q + T.d[i + 1]!); q += T.d[i + 1]!; } }
    /** the tone the reference shows at a pixel, as a step of this material's ramp */
    const toneAt = (gx: number, gyy: number): number => { const tx = Math.floor(((gx - PAD + 0.5) * MM - T!.x0) / T!.mm), ty = Math.floor((T!.z1 - (gy - gyy - 0.5) * MM) / T!.mm); if (tx < 0 || ty < 0 || tx >= T!.w || ty >= T!.h) return -1; return Math.round(tm![ty * T!.w + tx]! / Math.max(1, T!.steps - 1) * (PAL[mt].c.length - 1)); };
    for (let x = 0; x < bw; x++) { let y = 0; while (y < bh) { if (!M(x, y)) { y++; continue; } const ya = y; while (y < bh && M(x, y)) y++; const yb = y - 1, n = yb - ya;
      for (let yy = ya; yy <= yb; yy++) { const t = n > 0 ? (yy - ya) / n : 0.5, gx = bx + x, gyy = by + yy, k = yy - ya, kb = yb - yy; let l: number, shaded = -1;
        if (mt === 'chrome') { const bands = [4, 3, 1, 2, 2, 1]; l = n <= 1 ? [3, 1][k]! : bands[Math.min(5, Math.floor(k / (n + 1) * 6))]!; }
        else if (mt === 'glass') { let v = t < 0.18 ? 3.0 - t * 3 : t < 0.55 ? 2.15 - (t - 0.18) * 1.4 : 1.6 - (t - 0.55) * 3.2; if (((gx - bx) + (gyy - by) * 0.9) % 21 < 1.6 && t < 0.7) v = 3.2; v += d.glassLift ?? 0; l = dith(gx, gyy, v, 0.2); if (k === 0) l = Math.min(l, 1); }
        else if (mt === 'lens' || mt === 'lensR') l = t < 0.35 ? 3 : x - 0 < 2 ? 4 : 2;
        else if (mt === 'shadow') l = 0;
        else if (mt === 'paint' || mt === 'paint2' || mt === 'canvas' || mt === 'wood') { const g = GRAD[p.surface] ?? GRAD.side!; let v = g[0] + (g[1] - g[0]) * Math.pow(t, 1.15);
          if (n > 10 && p.surface === 'side') v += -0.75 * Math.exp(-(((t - 0.36) / 0.045) ** 2)) + 0.45 * Math.exp(-(((t - 0.47) / 0.07) ** 2));      // horizon line and ground bounce
          l = dith(gx, gyy, v, 0.13); if (kb === 0 && n > 2) l = Math.max(0, l - 1);
          if (k === 0) { const above = at(gx, gyy - 1); l = above >= 0 && mat[above] === 'glass' ? 3 : 4; } else if (k === 1 && n > 3) l = Math.max(l, 3); }
        else { const base = mt === 'black' ? 1 : mt === 'white' ? 3 : 2; l = k === 0 && n > 1 ? base + 1 : kb === 0 && n > 1 ? base - 1 : base; }
        if (p.shade && (mt === 'paint' || mt === 'paint2')) { const S = p.shade, fu = Math.min(S.nx - 1, Math.max(0, (gx + 0.5 - x0) / Math.max(1, x1 - x0) * S.nx - 0.5)), ft = t * (S.nt - 1), u0 = Math.floor(fu), t0 = Math.floor(ft), u1 = Math.min(S.nx - 1, u0 + 1), t1 = Math.min(S.nt - 1, t0 + 1), au = fu - u0, bt = ft - t0;
          const g = (a: number, b: number) => S.v[b * S.nx + a]!, v = (g(u0, t0) * (1 - au) + g(u1, t0) * au) * (1 - bt) + (g(u0, t1) * (1 - au) + g(u1, t1) * au) * bt, f = Math.floor(v), fr = Math.min(1, Math.max(0, (v - f - 0.5) / 0.3 + 0.5));
          shaded = f + (fr > BAYER[(gyy & 3) * 4 + (gx & 3)]! ? 1 : 0); }
        set(gx, gyy, mt, l, ly, id); if (shaded >= 0) setRaw(gyy * w + gx, shaded); if (tm && mt !== 'glass') { const tl = toneAt(gx, gyy); if (tl >= 0) setRaw(gyy * w + gx, tl); } if (p.clip) noOutline[gyy * w + gx] = 1; } } }
    if (mt === 'glass') glassMasks.push({ m, bx, by, bw, bh, ly, id });
    if (p.detail) detail(p.detail, M, bx, by, bw, bh, ly, mt);
    const S = SK?.elements[p.id], D = DC?.[p.id]; if (S || D) { const b = boxMM(p.pts); if (S) applySkin(S, id, b[0], b[1], b[2], b[3]); if (D) applyDecals(D, id, b[0], b[1], b[2], b[3]); }
  });
  // chunky window frames, built on the body around each opening so the glass keeps its measured size:
  // a bright bead or a shadowed reveal next to the glass, the body colour lit or shaded beyond it
  for (const g of glassMasks) { const isG = (x: number, y: number) => { const i = at(x, y); return i >= 0 && mat[i] === 'glass' && owner[i] === g.id; };
    const marks: [number, number, Material, number][] = [];
    for (let y = g.by - frameW; y < g.by + g.bh + frameW; y++) for (let x = g.bx - frameW; x < g.bx + g.bw + frameW; x++) { const i = at(x, y); if (i < 0 || skinRGB[i]! >= 0 || (mat[i] !== 'paint' && mat[i] !== 'paint2')) continue;
      let e: { r: number; dx: number; dy: number } | null = null; for (let r = 1; r <= frameW && !e; r++) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) if (isG(x + dx * r, y + dy * r)) { e = { r, dx, dy }; break; }
      if (!e) continue; const bodyM = mat[i]!, top = e.dy > 0, sill = e.dy < 0;                       // dy > 0: the glass is below, this is the frame's top
      if (e.r === 1 && d.frame === 'chrome') marks.push([x, y, 'chrome', top ? 2 : sill ? 4 : 3]);
      else if (e.r === 1) marks.push([x, y, bodyM, top ? 0 : sill ? 4 : e.dx > 0 ? 1 : 2]);
      else marks.push([x, y, bodyM, top ? 4 : sill ? 1 : 3]); }
    for (const [x, y, m, l] of marks) { set(x, y, m, l, layer[y * w + x]!); noOutline[y * w + x] = 1; } }

  // ---- details on the skin ----
  const FEAT = 1e6, onPaint = (x: number, y: number) => { const i = at(x, y); return i >= 0 && skinRGB[i]! < 0 && (mat[i] === 'paint' || mat[i] === 'paint2' || mat[i] === 'canvas'); };
  const line = (pts: [number, number][], plot: (x: number, y: number, k: number, n: number) => void) => { const cells: [number, number][] = [];
    for (let i = 0; i + 1 < pts.length; i++) { let [xa, ya] = pts[i]!.map(Math.round) as [number, number]; const [xb, yb] = pts[i + 1]!.map(Math.round) as [number, number], dx = Math.abs(xb - xa), dy = -Math.abs(yb - ya), sx = xa < xb ? 1 : -1, sy = ya < yb ? 1 : -1; let e = dx + dy;
      for (;;) { if (!cells.length || cells.at(-1)![0] !== xa || cells.at(-1)![1] !== ya) cells.push([xa, ya]); if (xa === xb && ya === yb) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; xa += sx; } if (e2 <= dx) { e += dx; ya += sy; } } }
    cells.forEach(([x, y], k) => plot(x, y, k, cells.length)); };
  const P2 = (pts: Pt[]) => smoothOpen(pts).map(([x, z]) => [X(x), Y(z)] as [number, number]);
  const darken = (x: number, y: number, by: number) => { const i = at(x, y); if (i >= 0 && mat[i] && skinRGB[i]! < 0) lv[i] = Math.max(0, lv[i]! - by); };
  for (const f of d.features as Feature[]) switch (f.kind) {
    case 'seam': line(P2(f.pts), (x, y) => { if (!onPaint(x, y)) return; lv[y * w + x] = 0; if (f.lit && onPaint(x, y + 1)) lv[(y + 1) * w + x] = 4; }); break;
    case 'trim': line(P2(f.pts), (x, y, k, n) => { if (!onPaint(x, y)) return; const end = k < 2 || k > n - 3, streak = (x % 11) < 2 || ((x + 5) % 23) < 1; set(x, y, 'chrome', end ? 2 : streak ? 4 : 3, FEAT); noOutline[y * w + x] = 1; if (onPaint(x, y - 1)) darken(x, y - 1, 1);
      let yy = y + 1; if ((f.width ?? 2) > 1 && onPaint(x, yy) && !end) { set(x, yy, 'chrome', 1, FEAT); noOutline[yy * w + x] = 1; yy++; } if (onPaint(x, yy)) darken(x, yy, 1); }); break;
    case 'louvres': { const n = f.n, sl = f.slant ?? 0.25; for (let k = 0; k < n; k++) { const xm = f.x0 + (f.x1 - f.x0) * (k + 0.5) / n; line([[X(xm), Y(f.z0)], [X(xm + (f.z1 - f.z0) * sl), Y(f.z1)]], (x, y) => { if (!onPaint(x, y)) return; lv[y * w + x] = 0; if (onPaint(x + 1, y)) lv[y * w + x + 1] = Math.min(4, lv[y * w + x + 1]! + 1); }); } break; }
    case 'handle': { const x = Math.round(X(f.at[0])), y = Math.round(Y(f.at[1])), n = Math.max(2, Math.round((f.len ?? 110) / MM)); for (let k = 0; k < n; k++) { set(x + k, y, 'chrome', k === 0 ? 4 : 3, FEAT); noOutline[y * w + x + k] = 1; darken(x + k, y + 1, 2); } break; }
    case 'hinge': { const x = Math.round(X(f.at[0])), y = Math.round(Y(f.at[1])); set(x, y, 'chrome', 3, FEAT); set(x, y + 1, 'chrome', 1, FEAT); noOutline[y * w + x] = noOutline[(y + 1) * w + x] = 1; break; }
    case 'bolt': { const x = Math.round(X(f.at[0])), y = Math.round(Y(f.at[1])); darken(x, y, 2); break; }
    case 'cap': { const x = Math.round(X(f.at[0])), y = Math.round(Y(f.at[1])), n = Math.round(f.h / MM); for (let k = 0; k < n; k++) set(x, y - k, 'chrome', k === n - 1 ? 4 : 2, FEAT); break; }
    case 'plate': { const x0 = Math.round(X(f.x0)), y0 = Math.round(Y(f.z0 + f.h)), ww = Math.round(f.w / MM), hh = Math.round(f.h / MM); for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) set(x0 + x, y0 + y, y === 0 || x === 0 ? 'chrome' : 'black', y === 0 ? 3 : 1, FEAT); break; }
    case 'highlight': { if (d.tones) break; const wd = f.width ?? 2, half = Math.floor((wd - 1) / 2); line(P2(f.pts), (x, y, k, n) => { if (!onPaint(x, y)) return; const i = y * w + x, fade = Math.min(k, n - 1 - k) < 3 ? 1 : 0;
      for (let o = -half; o <= wd - 1 - half; o++) { if (!onPaint(x, y + o)) continue; const j = i + w * o, lvl = top(j) - fade - Math.abs(o) - (o > 0 ? 1 : 0); if (lv[j]! < lvl) setRaw(j, lvl); } }); break; }
    case 'crease': if (d.tones) break; else line(P2(f.pts), (x, y) => { if (!onPaint(x, y)) return; const i = y * w + x; setRaw(i, top(i) - 1); if (onPaint(x, y + 1)) setRaw(i + w, 1); }); break;
    case 'bead': line(P2(f.pts), (x, y) => { if (!onPaint(x, y)) return; const i = y * w + x; setRaw(i, 0); if (onPaint(x, y + 1)) setRaw(i + w, Math.min(top(i), lv[i + w]! + 1)); }); break;
    case 'interior': { const isGlass = (x: number, y: number) => { const i = at(x, y); return i >= 0 && mat[i] === 'glass' && !noOutline[i]; }, sh = f.seatH ?? 260;
      for (const sx of f.seats) { const cx = X(sx), cy = Y(f.belt + sh - 80), rx = 150 / MM, ry = 95 / MM; for (let y = Math.floor(cy - ry); y <= Y(f.belt); y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { if (!isGlass(x, y)) continue;
          if (y < cy && ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 > 1) continue; const i = y * w + x; lv[i] = !isGlass(x, y - 1) || y <= Math.floor(cy - ry) + 1 ? 2 : 0; } }
      if (f.wheel != null) { const cx = X(f.wheel), cy = Y(f.belt + 110), rx = 30 / MM, ry = 190 / MM; for (let a = 0; a < 6.283; a += 0.04) { const x = Math.round(cx + Math.cos(a) * rx + Math.sin(a) * ry * 0.35), y = Math.round(cy + Math.sin(a) * ry * 0.55); if (isGlass(x, y)) lv[y * w + x] = 0; } }
      break; }
    case 'lamp': { const cx = X(f.at[0]), cy = Y(f.at[1]), r = f.r / MM; for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r * 0.6); x <= cx + r * 0.6; x++) if (((x + 0.5 - cx) / (r * 0.6)) ** 2 + ((y + 0.5 - cy) / r) ** 2 <= 1) set(x, y, f.facing === 'front' ? 'lens' : 'lensR', y < cy - r * 0.3 ? 3 : 2, FEAT); break; }
  }

  // ---- overlap shadows: a part in front casts one pixel of shadow down and to the right onto what lies behind it ----
  { const dark: number[] = []; for (let y = 1; y < h; y++) for (let x = 1; x < w; x++) { const i = y * w + x, m = mat[i]; if (!m || skinRGB[i]! >= 0 || m === 'glass' || m === 'shadow' || layer[i]! >= FEAT || noOutline[i]) continue;
      for (const j of [i - w, i - w - 1]) { const n = mat[j]; if (n && n !== 'glass' && n !== 'shadow' && layer[j]! > layer[i]! && layer[j]! < FEAT && !noOutline[j]) { dark.push(i); break; } } }
    for (const i of dark) lv[i] = Math.max(0, lv[i]! - 1); }

  // ---- outline: where an outlined part meets the background, or a part drawn before it ----
  const out: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, m = mat[i]; if (!m || skinRGB[i]! >= 0 || !OUTLINED.has(m) || noOutline[i] || layer[i]! >= FEAT) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const j = at(x + dx, y + dy); if (j < 0 || !mat[j] || mat[j] === 'shadow' || (layer[j]! < layer[i]! && !(noOutline[j] && layer[j]! >= layer[i]! - 0))) { out.push(i); break; } } }
  const OUTL = new Uint8Array(N); for (const i of out) OUTL[i] = 1;
  // the outline against the background is drawn two pixels thick all round, roof and bonnet top included (the first build's weight at this scale)
  const empty = (j: number) => j < 0 || !mat[j] || mat[j] === 'shadow', thick = opt.outline ?? 2;
  if (thick > 1) { const more: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, m = mat[i]; if (!m || skinRGB[i]! >= 0 || OUTL[i] || !OUTLINED.has(m) || noOutline[i] || layer[i]! >= FEAT) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const j = at(x + dx, y + dy), k = at(x + 2 * dx, y + 2 * dy); if (j >= 0 && OUTL[j] && empty(k)) { more.push(i); break; } } }
    for (const i of more) OUTL[i] = 1; }

  const rgba = new Uint8ClampedArray(N * 4);
  if (opt.shadow !== false) { const cx = X(d.length / 2), rx = d.length * 0.47 / MM; for (let y = gy - 1; y <= gy + 1; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const i = at(x, y); if (i < 0) continue; rgba[i * 4 + 3] = 70; } }
  for (let i = 0; i < N; i++) { const m = mat[i]; if (!m) continue; const R = PAL[m], k = skinRGB[i]!, c = OUTL[i] ? R.o : k >= 0 ? [(k >> 16) & 255, (k >> 8) & 255, k & 255] : R.c[lv[i]!]!; rgba[i * 4] = c[0]!; rgba[i * 4 + 1] = c[1]!; rgba[i * 4 + 2] = c[2]!; rgba[i * 4 + 3] = 255; }
  // where the view's own detail reaches the edge of the car, the outline goes outside it, so none of the detail is lost
  if ((SK || DC) && thick > 0) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (mat[i] && mat[i] !== 'shadow') continue; let near = false;
    for (let dy = -thick; dy <= thick && !near; dy++) for (let dx = -thick; dx <= thick; dx++) { if (Math.abs(dx) + Math.abs(dy) > thick) continue; const j = at(x + dx, y + dy); if (j >= 0 && skinRGB[j]! >= 0) { near = true; break; } }
    if (near) { rgba[i * 4] = 14; rgba[i * 4 + 1] = 13; rgba[i * 4 + 2] = 18; rgba[i * 4 + 3] = 255; } }
  return { w, h, rgba, owner, ms: performance.now() - t0, groundY: gy, X, Y };

  // ---- the part library's structure inside a panel ----
  function detail(dt: Detail, M: (x: number, y: number) => boolean, bx: number, by: number, bw: number, bh: number, ly: number, mt: Material) {
    if (dt.kind === 'grille') { const pitch = Math.max(2, dt.pitch / MM), shell = Math.max(1, Math.round((dt.shell ?? 25) / MM));
      for (let y = 0; y < bh; y++) { let lf = -1; for (let x = 0; x < bw; x++) if (M(x, y)) { lf = x; break; } if (lf < 0) continue;
        for (let x = lf; x < bw && M(x, y); x++) { const k = x - lf, gx = bx + x, gy = by + y; if (k < shell) { set(gx, gy, 'chrome', k === 0 ? 3 : 2, ly); continue; }
          const ph = (k - shell) % pitch; set(gx, gy, ph < 1 ? 'chrome' : 'black', ph < 1 ? (y % 5 === 0 ? 3 : 1) : 0, ly); } } }
    else if (dt.kind === 'flutes') { const pitch = Math.max(2, Math.round(dt.pitch / MM)); for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (M(x, y)) { const i = (by + y) * w + bx + x; if ((x % pitch) === pitch - 1) lv[i] = Math.max(0, lv[i]! - 1); if (x === 1 && y > 1 && y < 4) lv[i] = PAL[mt].c.length - 1; } }
    else if (dt.kind === 'bar') { for (let x = 0; x < bw; x++) { let y0 = -1; for (let y = 0; y < bh; y++) if (M(x, y)) { y0 = y; break; } if (y0 < 0) continue; const i = (by + y0 + 1) * w + bx + x; if ((x + 3) % 9 < 2 && mat[i]) lv[i] = PAL[mat[i]!].c.length - 1; } }
    else if (dt.kind === 'vbars') { const pitch = Math.max(2, Math.round(dt.pitch / MM)), ring = Math.max(1, Math.round((dt.ring ?? 20) / MM)); let cx = 0, n = 0; for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (M(x, y)) { cx += x; n++; } cx = Math.round(cx / Math.max(1, n));
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { if (!M(x, y)) continue; let edge = 99; for (let r = 1; r <= ring; r++) if (!M(x - r, y) || !M(x + r, y) || !M(x, y - r) || !M(x, y + r)) { edge = r; break; }
        const gx = bx + x, gy = by + y; if (edge <= ring) { set(gx, gy, 'chrome', !M(x, y - edge) ? 4 : !M(x, y + edge) ? 1 : !M(x - edge, y) ? 3 : 2, ly); continue; }
        const k = ((x - cx) % pitch + pitch) % pitch; set(gx, gy, k === 0 ? 'chrome' : 'black', k === 0 ? (x === cx ? 4 : 2) : k === 1 ? 1 : 0, ly); } }
    else if (dt.kind === 'mesh') { const pitch = Math.max(2, Math.round(dt.pitch / MM)); for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { if (!M(x, y)) continue; const gx = bx + x, gy = by + y, wx = x % pitch === 0, wy = y % pitch === 0;
        set(gx, gy, wx || wy ? 'chrome' : 'black', wx && wy ? 4 : wx || wy ? ((x + y) & 1 ? 2 : 3) : !M(x, y - 1) || y % pitch === 1 ? 0 : 1, ly); } }
    else if (dt.kind === 'planks' || dt.kind === 'ribs') { const pitch = Math.max(2, Math.round(dt.pitch / MM)); for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (M(x, y) && y % pitch === pitch - 1) { const i = (by + y) * w + bx + x; lv[i] = 0; if (M(x, y + 1)) lv[i + w] = Math.min(PAL[mt].c.length - 1, lv[i + w]! + 1); } }
  }

  // ---- a wheel drawn per pixel, light from the top left (first build's wheel.mjs) ----
  function drawWheel(s: WheelSpec, ly: number, id: number) {
    const r = s.r / MM, cx = X(s.x), cy = s.z != null ? Y(s.z) : Y(s.r), ri = Math.min(r * s.rim, r - 3), LX = -0.7071, LY = -0.7071, rimM: Material = s.rimMaterial === 'paint' || s.rimMaterial === 'paint2' ? s.rimMaterial : 'paint';
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dd = Math.hypot(dx, dy); if (dd > r) continue; const ux = dx / (dd || 1), uy = dy / (dd || 1), dot = ux * LX + uy * LY;
      if (dd > ri) { const t = (dd - ri) / (r - ri); let l = 1; if (t > 0.25 && t < 0.7 && dot > 0.35) l = 2; if (t > 0.35 && t < 0.6 && dot > 0.8) l = 3; if (t < 0.18 || (t > 0.8 && dot < -0.3)) l = 0;
        if (s.whitewall && t > 0.12 && t < 0.12 + s.whitewall) { set(x, y, 'white', dot > 0.4 ? 4 : dot < -0.5 ? 1 : 3, ly, id); continue; }
        if (Math.abs(t - 0.5) < 0.6 / Math.max(1, r - ri) && dot > -0.3) l = Math.min(4, l + 1);                     // the bead ring on the sidewall
        if (s.tread && t > 0.7) { const ang = Math.atan2(dy, dx), blk = Math.floor((ang / (Math.PI * 2) + 1) * Math.max(18, Math.round(r * 1.3))) & 1; if (!blk && t > 0.95) continue; l = blk ? (dot > 0.2 ? 3 : 2) : 0; }
        set(x, y, 'rubber', l, ly, id); continue; }
      const q = dd / ri, a = Math.atan2(dy, dx);
      if (s.style === 'wire') { if (q > 0.9) set(x, y, 'chrome', dot > 0.2 ? 3 : dot < -0.4 ? 1 : 2, ly, id); else if (q > 0.84) set(x, y, 'black', 1, ly, id);
        else if (q < 0.3) set(x, y, 'chrome', q < 0.12 ? (dot > 0 ? 4 : 3) : q > 0.26 ? 1 : dot > 0.3 ? 4 : dot > -0.3 ? 2 : 1, ly, id);
        else { const sp = s.spokes || 30, ang = ((a / (Math.PI * 2)) * sp % 1 + 1) % 1; set(x, y, ang < 0.28 ? 'chrome' : 'black', ang < 0.28 ? (dot > 0 ? 3 : 2) : 0, ly, id); } }
      else if (s.style === 'artillery') { const sp = s.spokes || 12, seg = ((a / (Math.PI * 2)) * sp % 1 + 1) % 1, wdt = 0.16 + 0.22 * (1 - q);
        if (q > 0.86) set(x, y, rimM, dot > 0.2 ? 3 : 1, ly, id); else if (q < 0.26) set(x, y, 'chrome', q < 0.14 ? (dot > 0 ? 4 : 2) : 1, ly, id);
        else if (Math.abs(seg - 0.5) < wdt / 2) set(x, y, rimM, Math.abs(seg - 0.5) < wdt / 5 ? 3 : dot > 0 ? 2 : 1, ly, id); else set(x, y, 'iron', q < 0.6 ? 1 : 0, ly, id); }
      else { // pressed-steel disc in the body colour with a domed chrome cap, its pressed rings, and a trim ring if fitted
        const cap = s.cap ?? 0.52, rings = s.capRings ?? 1, pxq = 1 / Math.max(1, ri);
        if (s.trim && q > 0.84) { set(x, y, 'chrome', q > 0.95 ? 1 : dot > 0.3 ? 4 : dot > -0.3 ? 3 : 1, ly, id); continue; }
        if (q > 0.9) set(x, y, rimM, dot > 0.2 ? 3 : 1, ly, id); else if (q > 0.82) set(x, y, rimM, dot > 0 ? 1 : 3, ly, id);
        else if (q < cap) { const u = q / cap; let l = u > 1 - 1.5 * pxq / cap ? 1 : u < 0.22 ? (dot > 0 ? 4 : 3) : dot > 0.35 ? 4 : dot > -0.3 ? 3 : 2;
          for (let k = 1; k <= rings; k++) if (Math.abs(u - (0.22 + 0.6 * k / (rings + 1))) < 0.7 * pxq / cap) l = dot > 0 ? 2 : 1;
          if (u < 0.12 && dx < 0 && dy < 0) l = 4; set(x, y, s.capMaterial ?? 'chrome', s.capMaterial === 'black' ? Math.max(0, l - 2) : l, ly, id); }
        else set(x, y, rimM, dot > 0.3 ? 3 : 2, ly, id); } } }
}
