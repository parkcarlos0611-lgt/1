// Age on a drawn car (reviews 67, 68), laid over a flat picture by what each pixel is (its material, its part, how far it
// lies from the part's edge):
// - faded paint: the gloss goes first (the highlights sink to the panel's own tone), then the colour chalks and greys, in
//   blotches across the open middle of a panel and more on the upper surfaces the sun reaches; the edges, the folds and
//   the places a neighbouring part shades keep the first colour, as they do on a real car left outdoors;
// - rust: it starts low, at seams and edges and where water stands, as a halo of lifted paint, then orange surface
//   rust in several shades, then dark scale with pits, and runs down the panel below it in streaks;
// - a dent in the front wing that catches no light, a broken lamp glass.
// For the part builder's preview of a car's condition; the customer's car uses the same marks (ui/world/car.ts).
import type { CarImage } from './raster';

export interface Wear { rust: number; dent: boolean; lamp: boolean; fade: number }
export const NEW: Wear = { rust: 0, dent: false, lamp: false, fade: 0 };
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vn = (x: number, y: number) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v; };
/** fractal noise, 0..1, four octaves */
const fbm = (x: number, y: number) => { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < 4; o++) { s += vn(x * f + o * 17.3, y * f - o * 9.1) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; };
const ss = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** rust's colours, light orange to dark scale */
const RUST: [number, number, number][] = [[184, 104, 46], [156, 80, 34], [126, 60, 26], [92, 42, 20], [60, 30, 16], [40, 21, 12]];
const rustAt = (t: number): [number, number, number] => { const k = Math.max(0, Math.min(RUST.length - 1.001, t * (RUST.length - 1))), i = Math.floor(k), f = k - i, a = RUST[i]!, b = RUST[i + 1]!;
  return [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)]; };

export function applyWear(im: CarImage, w: Wear): CarImage {
  if (!w.rust && !w.dent && !w.lamp && !w.fade) return im;
  const W = im.w, H = im.h, N = W * H, src = im.rgba, rgba = new Uint8ClampedArray(src), mat = im.mat ?? [], ids = im.ids ?? [], top = im.groundY;
  const pxmm = Math.max(0.02, (im.X(1000) - im.X(0)) / 1000), mmOf = (px: number) => px / pxmm;   // pixels per millimetre
  const idOf = (i: number) => ids[im.owner[i]!] ?? '';
  const painted = (i: number) => src[i * 4 + 3]! >= 10 && (mat[i] === 'paint' || mat[i] === 'paint2');
  const rim = (i: number) => /wheel|rim|hub|spoke/i.test(idOf(i));
  // how far each painted pixel lies from its part's edge (another part, a seam, the outline), in pixels: a chamfer pass
  const dist = new Float32Array(N).fill(1e6);
  for (let i = 0; i < N; i++) { if (!painted(i)) continue; const x = i % W, o = im.owner[i];
    if (x === 0 || x === W - 1 || i < W || i >= N - W || im.owner[i - 1] !== o || im.owner[i + 1] !== o || im.owner[i - W] !== o || im.owner[i + W] !== o || !painted(i - 1) || !painted(i + 1) || !painted(i - W) || !painted(i + W)) dist[i] = 0; }
  const D2 = Math.SQRT2;
  for (let y = 1; y < H; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!dist[i]) continue; dist[i] = Math.min(dist[i]!, dist[i - 1]! + 1, dist[i - W]! + 1, dist[i - W - 1]! + D2, dist[i - W + 1]! + D2); }
  for (let y = H - 2; y >= 0; y--) for (let x = W - 2; x >= 1; x--) { const i = y * W + x; if (!dist[i]) continue; dist[i] = Math.min(dist[i]!, dist[i + 1]! + 1, dist[i + W]! + 1, dist[i + W + 1]! + D2, dist[i + W - 1]! + D2); }
  // each part's own tone, the level its gloss sinks to
  const nO = Math.max(1, ids.length + 1), sum = new Float64Array(nO * 3), cnt = new Float64Array(nO);
  for (let i = 0; i < N; i++) { if (!painted(i)) continue; const o = im.owner[i]! + 1, j = i * 4; sum[o * 3] = sum[o * 3]! + src[j]!; sum[o * 3 + 1] = sum[o * 3 + 1]! + src[j + 1]!; sum[o * 3 + 2] = sum[o * 3 + 2]! + src[j + 2]!; cnt[o] = cnt[o]! + 1; }
  const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;

  // the front wing's dent: where on the wing, from its pixels
  let fx = 0, fy = 0, fn = 0; if (w.dent) for (let i = 0; i < N; i++) if (/^(x_)?fenderF/.test(idOf(i))) { fx += i % W; fy += (i / W) | 0; fn++; }
  if (fn) { fx /= fn; fy /= fn; }
  const r = Math.max(4, W * 0.03);
  const rusty = new Float32Array(N);                                                   // how deep the rust is, for the streaks

  for (let i = 0; i < N; i++) { if (src[i * 4 + 3]! < 10) continue; const m = mat[i], x = i % W, y = (i / W) | 0, j = i * 4, X = mmOf(x), Y = mmOf(y);
    if (painted(i)) { const o = im.owner[i]! + 1, n = Math.max(1, cnt[o]!), mr = sum[o * 3]! / n, mg = sum[o * 3 + 1]! / n, mb = sum[o * 3 + 2]! / n, ml = lum(mr, mg, mb);
      let R = rgba[j]!, G = rgba[j + 1]!, B = rgba[j + 2]!; const shade = Math.max(0.55, Math.min(1.35, (lum(R, G, B) + 8) / (ml + 8)));
      const dmm = mmOf(dist[i]!);
      if (w.fade) { const f = w.fade, keep = ss(6, 55, dmm), sun = 0.75 + 0.25 * (1 - Math.min(1, y / top)), blot = ss(0.32, 0.68, fbm(X / 160, Y / 160) + (f - 0.5) * 0.7);
        const a = Math.min(1, f * keep * sun * (0.3 + 0.7 * blot) * 1.25);
        if (a > 0) { const l = lum(R, G, B), hi = l > ml;                            // the gloss: highlights sink to the panel's tone, shadows a little
          const k = a * (hi ? 0.85 : 0.35); R = mix(R, mr + (R - mr) * 0.25, k); G = mix(G, mg + (G - mg) * 0.25, k); B = mix(B, mb + (B - mb) * 0.25, k);
          const g = lum(R, G, B), chalk = a * 0.55, lift = a * 0.38;                    // the colour chalks: greyer and paler, a little warm
          R = mix(R, g, chalk); G = mix(G, g, chalk); B = mix(B, g, chalk); R = mix(R, 176, lift); G = mix(G, 170, lift); B = mix(B, 158, lift);
          const grain = (hash(x * 3 + 1, y * 7 + 2) - 0.5) * 10 * a; R += grain; G += grain; B += grain; } }
      if (w.rust && !rim(i)) { const q = w.rust, low = ss(0.5, 1, y / top), edge = 1 - ss(4, 70, dmm);
        const wx = X / 120 + (fbm(X / 70 + 3, Y / 70) - 0.5) * 1.4, wy = Y / 120 + (fbm(X / 70, Y / 70 + 5) - 0.5) * 1.4;   // warped, so the patches are ragged
        const field = fbm(wx, wy) * 0.8 + fbm(X / 22, Y / 22) * 0.2, broken = edge * ss(0.45, 0.7, fbm(X / 35 + 11, Y / 35));   // seams rust in places, not all along
        const score = field * 0.75 + low * 0.38 + broken * 0.16, t = 0.8 - q * 0.42;
        if (score > t - 0.035) { const depth = (score - t) / 0.16;
          if (depth < 0) { const k = 1 + depth / 0.22;                                // the halo: paint lifting, brown under it, lit on its upper side
            const lit = hash(x, y - 1) < 0.5 && score < t - 0.015 ? 1.12 : 0.82; R = mix(R, R * lit * 0.85 + 22, k * 0.7); G = mix(G, G * lit * 0.85 + 8, k * 0.7); B = mix(B, B * lit * 0.85, k * 0.7); }
          else { const tone = Math.min(1, 0.22 + depth * 0.7 + (fbm(X / 9, Y / 9) - 0.5) * 0.45 + (hash(x, y) - 0.5) * 0.12), c = rustAt(Math.max(0, tone));
            const pit = depth > 0.55 && hash(x * 5, y * 3) < 0.12, fleck = depth > 0.2 && hash(x * 2 + 9, y) < 0.05;
            const s = shade * (pit ? 0.6 : 1); R = (fleck ? 196 : c[0]) * s; G = (fleck ? 118 : c[1]) * s; B = (fleck ? 60 : c[2]) * s; rusty[i] = Math.min(1, 0.4 + depth); } } }
      rgba[j] = R; rgba[j + 1] = G; rgba[j + 2] = B; }
    if (fn && /^(x_)?fenderF/.test(idOf(i))) { const q = Math.hypot(x - fx, (y - fy) * 1.4) / r; if (q < 1) { const k = 0.62 + 0.38 * q; rgba[j] = rgba[j]! * k; rgba[j + 1] = rgba[j + 1]! * k; rgba[j + 2] = rgba[j + 2]! * k; } }
    if (w.lamp && (m === 'lens' || /lens/.test(idOf(i)))) { const sh = hash(x, y) < 0.3; rgba[j] = sh ? 196 : 62; rgba[j + 1] = sh ? 196 : 60; rgba[j + 2] = sh ? 186 : 56; } }

  // rust runs down: from each rusted pixel, a thin brown streak below it on the painted panel, in some columns
  if (w.rust) { const fall = Math.pow(0.5, 1 / Math.max(2, 90 * pxmm * (0.6 + w.rust)));   // halves over about 45 mm
    for (let x = 0; x < W; x++) { const col = hash(x, 77); if (col > 0.5) continue; let carry = 0;
      for (let y = 0; y < H; y++) { const i = y * W + x; if (rusty[i]) { carry = Math.max(carry, rusty[i]! * (0.6 + col)); continue; }
        if (carry < 0.05 || !painted(i) || rim(i)) { carry = painted(i) ? carry : 0; continue; }
        const j = i * 4, a = carry * 0.65; rgba[j] = mix(rgba[j]!, 118, a); rgba[j + 1] = mix(rgba[j + 1]!, 62, a); rgba[j + 2] = mix(rgba[j + 2]!, 30, a); carry *= fall; } } }
  return { ...im, rgba };
}
