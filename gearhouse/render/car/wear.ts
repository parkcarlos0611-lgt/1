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

const rgb2hsl = (r: number, g: number, b: number): [number, number, number] => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return [h, s, l]; };
const hsl2rgb = (h: number, s: number, l: number): [number, number, number] => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; };
/** a cell pattern: distance to the nearest point and the gap to the second (small gap: on a cell's edge), cells of size 1 */
const cells = (x: number, y: number): [number, number, number, number] => { const xi = Math.floor(x), yi = Math.floor(y); let d1 = 9, d2 = 9, cx = 0, cy = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const px = xi + i + hash(xi + i, yi + j), py = yi + j + hash(yi + j + 31, xi + i + 7), d = Math.hypot(x - px, y - py);
    if (d < d1) { d2 = d1; d1 = d; cx = xi + i; cy = yi + j; } else if (d < d2) d2 = d; } return [d1, d2 - d1, cx, cy]; };

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
  // how far below the top of its part each painted pixel is, down its column: the crown of a panel faces the sky
  const crown = new Float32Array(N); for (let x = 0; x < W; x++) { let run = 0, o = -2; for (let y = 0; y < H; y++) { const i = y * W + x; if (!painted(i)) { o = -2; continue; } if (im.owner[i] !== o) { o = im.owner[i]!; run = 0; } crown[i] = run++; } }

  // the front wing's dent: where on the wing, from its pixels
  let fx = 0, fy = 0, fn = 0; if (w.dent) for (let i = 0; i < N; i++) if (/^(x_)?fenderF/.test(idOf(i))) { fx += i % W; fy += (i / W) | 0; fn++; }
  if (fn) { fx /= fn; fy /= fn; }
  const r = Math.max(4, W * 0.03);
  const rusty = new Float32Array(N);                                                   // how deep the rust is, for the streaks

  for (let i = 0; i < N; i++) { if (src[i * 4 + 3]! < 10) continue; const m = mat[i], x = i % W, y = (i / W) | 0, j = i * 4, X = mmOf(x), Y = mmOf(y);
    if (painted(i)) { const o = im.owner[i]! + 1, n = Math.max(1, cnt[o]!), mr = sum[o * 3]! / n, mg = sum[o * 3 + 1]! / n, mb = sum[o * 3 + 2]! / n, ml = lum(mr, mg, mb);
      let R = rgba[j]!, G = rgba[j + 1]!, B = rgba[j + 2]!; const shade = Math.max(0.55, Math.min(1.35, (lum(R, G, B) + 8) / (ml + 8)));
      const dmm = mmOf(dist[i]!);
      if (w.fade) { const f = w.fade, keep = ss(5, 50, dmm), sky = 1 - ss(20, 260, mmOf(crown[i]!)), high = 1 - Math.min(1, y / top);
        const sun = 0.45 + 0.35 * sky + 0.2 * high, blot = ss(0.3, 0.7, fbm(X / 150, Y / 150) * 0.75 + fbm(X / 14, Y / 260) * 0.25 + (f - 0.5) * 0.8);   // blotches, and rain-washed runs down the panel
        const a = Math.min(1, f * keep * sun * (0.25 + 0.75 * blot) * 1.45);
        if (a > 0) { const l = lum(R, G, B), hi = l > ml;                            // the gloss: highlights sink to the panel's tone; the lacquer goes flat
          const k = a * (hi ? 0.95 : 0.4); R = mix(R, mr + (R - mr) * 0.2, k); G = mix(G, mg + (G - mg) * 0.2, k); B = mix(B, mb + (B - mb) * 0.2, k);
          // the pigment: lighter and weaker, as each colour goes in the sun (reds to pink and orange, blues and greens to a chalky
          // grey of themselves, black to a brown-grey), and a white powder on it, uneven
          let [h, sa, li] = rgb2hsl(R, G, B); const red = h < 25 || h > 330, dark = sa < 0.12 || li < 0.09;
          if (red) h = (h + (h > 330 ? 360 : 0) + 14 * a) % 360; else if (h > 70 && h < 170) h -= 18 * a;
          sa *= 1 - a * (red ? 0.35 : 0.62); li = li + (0.62 - li) * a * (dark ? 0.42 : 0.5);
          const powder = (fbm(X / 6, Y / 6) - 0.5) * 0.12 + (hash(x * 3 + 1, y * 7 + 2) - 0.5) * 0.05; li = Math.max(0, Math.min(1, li + powder * a));
          [R, G, B] = hsl2rgb(h, sa, li); if (dark) { R = mix(R, R + 14, a); G = mix(G, G + 8, a); }
          if (a > 0.45) { const [, gap] = cells(X / 16, Y / 11); if (gap < 0.06) { const c = 0.82 + gap * 2; R *= c; G *= c; B *= c; } } } }   // the lacquer crazes, in fine cracks
      if (w.rust && !rim(i)) { const q = w.rust, low = ss(0.5, 1, y / top), edge = 1 - ss(4, 70, dmm);
        const wx = X / 120 + (fbm(X / 70 + 3, Y / 70) - 0.5) * 1.4, wy = Y / 120 + (fbm(X / 70, Y / 70 + 5) - 0.5) * 1.4;   // warped, so the patches are ragged
        const field = fbm(wx, wy) * 0.8 + fbm(X / 22, Y / 22) * 0.2, broken = edge * ss(0.45, 0.7, fbm(X / 35 + 11, Y / 35));   // seams rust in places, not all along
        const score = field * 0.75 + low * 0.38 + broken * 0.16, t = 0.8 - q * 0.42;
        if (score > t - 0.11 * (0.5 + q)) { const depth = score >= t ? (score - t) / 0.16 : (score - t) / (0.11 * (0.5 + q)) * 0.6;
          if (depth < 0) { const near = 1 + depth / 0.6;                              // round the rust the paint lifts: blisters, lit above and shadowed below; nearer, it has flaked to the primer
            if (depth > -0.18 && hash(x * 7 + 3, y * 5 + 1) < 0.35 + near * 0.4) { const pr = hash(x + 5, y * 3) < 0.5; R = pr ? 118 * shade : 92 * shade; G = pr ? 84 * shade : 70 * shade; B = pr ? 70 * shade : 60 * shade; }
            else { const cs = Math.max(9, mmOf(2.4)), [d1, , cx, cy] = cells(X / cs, Y / cs), rad = 0.32 + hash(cx, cy) * 0.22;
              if (hash(cx + 13, cy) < near * 0.9 && d1 < rad) { const py = (Y / cs - (cy + hash(cy + 31, cx + 7))) / rad, lit = py < -0.15 ? 1.28 : py > 0.25 ? 0.62 : 0.95;
                R = R * lit + (lit > 1 ? 10 : 0); G = G * lit + (lit > 1 ? 8 : 0); B = B * lit + (lit > 1 ? 6 : 0); }
              else { const k = Math.max(0, 1 + depth / 0.06) * 0.6; R = mix(R, R * 0.7 + 30, k); G = mix(G, G * 0.7 + 12, k); B = mix(B, B * 0.7, k); } } }
          else { const tone = Math.min(1, 0.22 + depth * 0.7 + (fbm(X / 9, Y / 9) - 0.5) * 0.45 + (hash(x, y) - 0.5) * 0.12), c = rustAt(Math.max(0, tone));
            const pit = depth > 0.55 && hash(x * 5, y * 3) < 0.12, fleck = depth > 0.2 && hash(x * 2 + 9, y) < 0.05;
            const s = shade * (pit ? 0.6 : 1); R = (fleck ? 196 : c[0]) * s; G = (fleck ? 118 : c[1]) * s; B = (fleck ? 60 : c[2]) * s; rusty[i] = Math.min(1, 0.4 + depth); } } }
      rgba[j] = R; rgba[j + 1] = G; rgba[j + 2] = B; }
    if (m === 'chrome' && (w.fade || w.rust)) { let R = rgba[j]!, G = rgba[j + 1]!, B = rgba[j + 2]!;
      if (w.fade) { const a = w.fade * (0.6 + 0.4 * fbm(X / 40, Y / 40)), l = lum(R, G, B);   // a milky film: the shine sinks, the darks lift
        const t2 = 128 + (l - 128) * (1 - 0.55 * a); R = mix(R, t2 + 6, a * 0.8); G = mix(G, t2 + 4, a * 0.8); B = mix(B, t2, a * 0.8); }
      if (w.rust) { const q = w.rust, low = ss(0.4, 1, y / top), n = fbm(X / 30 + 7, Y / 30) * 0.8 + low * 0.25;
        if (n > 1.05 - q * 0.6) { const deep = n > 1.13 - q * 0.5; const c = deep ? rustAt(0.35 + hash(x, y) * 0.35) : [168, 136, 96]; R = c[0]!; G = c[1]!; B = c[2]!; if (deep) rusty[i] = 0.7; }   // the plate gone: the nickel under, then rust
        else if (hash(x * 3 + 11, y * 5) < q * 0.16) { const c = rustAt(0.45 + hash(y, x) * 0.4); R = c[0]; G = c[1]; B = c[2]; } }   // pitting
      rgba[j] = R; rgba[j + 1] = G; rgba[j + 2] = B; }
    if (fn && /^(x_)?fenderF/.test(idOf(i))) { const q = Math.hypot(x - fx, (y - fy) * 1.4) / r; if (q < 1) { const k = 0.62 + 0.38 * q; rgba[j] = rgba[j]! * k; rgba[j + 1] = rgba[j + 1]! * k; rgba[j + 2] = rgba[j + 2]! * k; } }
    if (w.lamp && (m === 'lens' || /lens/.test(idOf(i)))) { const sh = hash(x, y) < 0.3; rgba[j] = sh ? 196 : 62; rgba[j + 1] = sh ? 196 : 60; rgba[j + 2] = sh ? 186 : 56; } }

  // rust runs down: from each rusted pixel, a brown streak below it, dark at the source and thinning to orange, in many
  // columns; on paint and chrome
  if (w.rust) { const len = 150 * (0.5 + w.rust), fall = Math.pow(0.5, 1 / Math.max(2, len * pxmm));
    const runs = (i: number) => painted(i) || mat[i] === 'chrome';
    for (let x = 0; x < W; x++) { const col = hash(x, 77); if (col > 0.72) continue; let carry = 0, from = 0;
      for (let y = 0; y < H; y++) { const i = y * W + x; if (rusty[i]) { carry = Math.max(carry, Math.min(1, rusty[i]! * (0.75 + col))); from = y; continue; }
        if (carry < 0.04 || !runs(i) || rim(i)) { carry = runs(i) ? carry : 0; continue; }
        const j = i * 4, a = carry * 0.9, far = Math.min(1, mmOf(y - from) / len), c = [mix(96, 150, far), mix(44, 78, far), mix(20, 36, far)];
        rgba[j] = mix(rgba[j]!, c[0]!, a); rgba[j + 1] = mix(rgba[j + 1]!, c[1]!, a); rgba[j + 2] = mix(rgba[j + 2]!, c[2]!, a);
        if (x + 1 < W && col < 0.3 && runs(i + 1)) { const k = a * 0.45; rgba[j + 4] = mix(rgba[j + 4]!, c[0]!, k); rgba[j + 5] = mix(rgba[j + 5]!, c[1]!, k); rgba[j + 6] = mix(rgba[j + 6]!, c[2]!, k); }
        carry *= fall * (0.985 + hash(x, y) * 0.015); } } }
  return { ...im, rgba };
}
