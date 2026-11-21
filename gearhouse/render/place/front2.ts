// The front of the house, second edition (reviews 46, 49): the planner's sprites and season pictures, put together by
// the game and lit by it.
// - the sky: the planner's painted skies (overcast in spring, autumn and winter; a clear one with fair-weather clouds),
//   chosen by the hour's cloud and blended between, drifting with the wind in real time; graded to the hour (dawn,
//   dusk, night); the sun behind the house (its real bearing and height), the moon in its phase, stars on clear nights
// - the ground: the season's picture (woods, lawn, paths, road), turning from one season to the next a patch at a time
//   over the weeks (the woods colour clump by clump), and the snow picture laid in patches as snow lies
// - the house, the garage, the mailbox, the street lamp; the tree of the season, its crown swaying smoothly in the wind
// - snow on the roofs, the chimney, the mailbox and the lamp when snow lies; heaps of leaves in autumn, of shovelled snow
//   when it is deep, puddles after rain (they mirror what is above them)
// - at night: the windows lamplit (curtains and lamps inside, from the planner's night picture) when a lamp burns in the
//   house, the street lamp and its pool of light, long shining streaks of both on the wet road
// - rain and snow falling (snow in three depths), smoke from the chimney in the cold, a bird now and then
import type { Air } from '../../core/atmosphere';
import { W, H, clamp, lerp, mix3, hash2, noise, skyColours, type V3 } from './room';

const N = W * H;
export interface Pic { px: Uint8ClampedArray; w: number; h: number }
/** the street lamp lit, laid over the finished picture from the lamp's own sprite (only its pixels: never the wall
 *  behind it): the frosted panes glow, brightest round the bulb and fading to their edges with the glass's own grain;
 *  the iron bars stay dark, lit a little from inside; a soft halo in the damp air around the head */
export function lantern(out: Uint8ClampedArray, lp: Pic, at: [number, number], on: number): void { if (on <= 0) return;
  const ox = Math.round(at[0]), oy = Math.round(at[1]), rows = Math.min(lp.h, 26); let cx = 0, cy = 0, n = 0;
  const glass = (j: number) => lp.px[j + 3]! >= 128 && (lp.px[j]! + lp.px[j + 1]! + lp.px[j + 2]!) / 3 >= 105;
  for (let y = 0; y < rows; y++) for (let x = 0; x < lp.w; x++) if (glass((y * lp.w + x) * 4)) { cx += x; cy += y; n++; } if (!n) return; cx /= n; cy /= n;
  // the halo first (the head is drawn over it)
  const R = 18; for (let y = Math.floor(oy + cy - R); y <= oy + cy + R; y++) for (let x = Math.floor(ox + cx - R); x <= ox + cx + R; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const d = Math.hypot(x - ox - cx, (y - oy - cy) * 1.1); if (d > R) continue;
    const k = on * (0.5 * Math.exp(-d / 4.5) + 0.16 * Math.exp(-d / 11)) * (1 - d / R), i = (y * W + x) * 4; out[i] = out[i]! + (255 - out[i]!) * k; out[i + 1] = out[i + 1]! + (214 - out[i + 1]!) * k * 0.95; out[i + 2] = out[i + 2]! + (150 - out[i + 2]!) * k * 0.8; }
  for (let y = 0; y < rows; y++) for (let x = 0; x < lp.w; x++) { const j = (y * lp.w + x) * 4; if (lp.px[j + 3]! < 128) continue; const X = ox + x, Y = oy + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const i = (Y * W + X) * 4;
    const d = Math.hypot(x - cx, (y - cy) * 0.9), grain = (lp.px[j]! + lp.px[j + 1]! + lp.px[j + 2]!) / 3 / 220;
    if (glass(j)) { const core = Math.exp(-(d * d) / 14), k = on * (0.72 + 0.28 * core) * (0.9 + 0.1 * grain);
      out[i] = Math.min(255, (236 + 19 * core) * k + out[i]! * (1 - on)); out[i + 1] = Math.min(255, (196 + 46 * core) * k + out[i + 1]! * (1 - on)); out[i + 2] = Math.min(255, (122 + 92 * core) * k + out[i + 2]! * (1 - on)); }
    else if (d < 9) { const k = on * 0.35 * Math.exp(-d / 5); out[i] = out[i]! + (150 - out[i]!) * k; out[i + 1] = out[i + 1]! + (110 - out[i + 1]!) * k; out[i + 2] = out[i + 2]! + (70 - out[i + 2]!) * k; } } }
export interface Front2Env { t: number; dt: number; air: Air; moon: { alt: number; az: number; phase: number }; minute: number; doy: number; houseLit: boolean; snow: number; wet: number;
  /** how far open: the front door (0..1, inward), the garage's four leaves (0..1, outward); the mailbox flag (0 down .. 1 up) */
  door: number; garage: number[]; flag: number }
type Cut = Record<string, { at: number[]; size: number[] }> & { windows: number[][]; doorGlass: number[]; nightwin: number[][] };
export const enum K { Sky, Ground, Wall, Glass, Lantern, Wet }

/** which ground picture, and how far into the next (by day of the year) */
export function seasonOf(doy: number): [string, string, number] {
  const S: [number, string][] = [[0, 'winter_bare'], [80, 'winter_bare'], [110, 'spring'], [152, 'spring'], [162, 'summer'], [253, 'summer'], [274, 'autumn'], [314, 'autumn'], [329, 'winter_bare'], [366, 'winter_bare']];
  for (let i = 0; i < S.length - 1; i++) { const [d0, a] = S[i]!, [d1, b] = S[i + 1]!; if (doy >= d0 && doy < d1) return [a, b, a === b ? 0 : (doy - d0) / (d1 - d0)]; } return ['winter_bare', 'winter_bare', 0]; }
/** which tree, and how far into the next */
export function treeOf(doy: number): [string, string, number] {
  const T: [number, string][] = [[0, 'tree_bare'], [84, 'tree_bare'], [100, 'tree_bud'], [110, 'tree_bud'], [118, 'tree_blossom'], [136, 'tree_blossom'], [148, 'tree_summer'], [258, 'tree_summer'], [270, 'tree_yellow'], [282, 'tree_yellow'], [290, 'tree_red'], [298, 'tree_red'], [306, 'tree_late'], [316, 'tree_late'], [326, 'tree_bare'], [366, 'tree_bare']];
  for (let i = 0; i < T.length - 1; i++) { const [d0, a] = T[i]!, [d1, b] = T[i + 1]!; if (doy >= d0 && doy < d1) return [a, b, a === b ? 0 : (doy - d0) / (d1 - d0)]; } return ['tree_bare', 'tree_bare', 0]; }
export const cell = (x: number, y: number, s = 3) => hash2(Math.floor(x / s) + 911, Math.floor(y / s) + 37);   // a patch's own threshold, for changing a patch at a time
/** where snow lies first (low) and last (high): the lawn before the paths, the pavement after, the road last and its
 *  wheel tracks never; drifts along the foot of the house; in clumps of all sizes */
function snowField(x: number, y: number): number { let bias = 0;
  if (y >= 222) bias = 0.3 + (Math.abs(y - 241) < 3 || Math.abs(y - 254) < 3 ? 0.6 : 0); else if (y >= 203) bias = 0.15; else if (y >= 166 && ((x >= 296 && x < 470) || (x >= 152 && x < 188))) bias = 0.08; else if (y >= 166) bias = -0.1 - (y < 172 ? 0.08 : 0);
  return clump(x * 1.3, y * 2) * 0.55 + 0.1 + bias; }
/** the same for leaves: round clumps of all sizes, not squares */
const clump = (x: number, y: number) => Math.min(1, Math.max(0, (noise(x / 9 + 3.1, y / 9 + 7.7) * 0.65 + noise(x / 3.5 + 11, y / 3.5) * 0.35 - 0.2) / 0.6));

export class Front2 {
  alb = new Float32Array(N * 3); lit = new Float32Array(N * 3); kind = new Uint8Array(N); private sky = new Float32Array(W * 180 * 3);
  glass = new Int8Array(N).fill(-1); cover = new Float32Array(N); snowy = new Uint8Array(N); inside = new Uint8Array(N); inLevel = new Float32Array(N); dShade = new Float32Array(N); dWarm = new Float32Array(N); treeM = new Uint8Array(N); private marking = 0;
  /** for the GPU path (render/place/front2gl.ts): puddle water's mirror row, the tree on its own layer, and the keys that say when the cached layers must be made again */
  pudRow = new Uint8Array(N); /** the screen row where what this pixel shows stands on the ground (for what hides the car) */ footY = new Uint8Array(N); tree = new Uint8ClampedArray(N * 4); treeRect = [0, 0, 1, 1]; private sKey = ''; private dKey = ''; private tKey = ''; private sAlb = new Float32Array(N * 3); private sKind = new Uint8Array(N); private sSnowy = new Uint8Array(N); private sCover = new Float32Array(N);
  private smoke: { x: number; y: number; age: number; life: number }[] = []; private fall: { x: number; y: number; v: number; snow: number }[] = []; private bird = { x: -1, y: 0, wait: 6, dir: 1 };
  constructor(readonly C: Cut, readonly P: Record<string, Pic>) {
    // the panes of the house's windows: the dark glass inside each window box (not the shutters, not the bars)
    const hs = P.house!, [hx, hy] = C.house!.at as [number, number];
    C.windows.forEach((b, wi) => { for (let y = Math.floor(b[1]!); y < Math.ceil(b[3]!); y++) for (let x = Math.floor(b[0]!); x < Math.ceil(b[2]!); x++) { const sx = x - Math.round(hx), sy = y - Math.round(hy); if (sx < 0 || sy < 0 || sx >= hs.w || sy >= hs.h) continue;
      const j = (sy * hs.w + sx) * 4, r = hs.px[j]!, g = hs.px[j + 1]!, bb = hs.px[j + 2]!; if (hs.px[j + 3]! < 128) continue; const l = (r + g + bb) / 3; if (l < 105 && !(r - bb > 22 && l > 60)) this.glass[y * W + x] = wi; } });
    const dg = C.doorGlass; for (let y = Math.floor(dg[1]!); y < dg[3]!; y++) for (let x = Math.floor(dg[0]!); x < dg[2]!; x++) { const sx = x - Math.round(hx), sy = y - Math.round(hy), j = (sy * hs.w + sx) * 4; if ((hs.px[j]! + hs.px[j + 1]! + hs.px[j + 2]!) / 3 < 95) this.glass[y * W + x] = 9; } }

  /** lay a sprite into the albedo (sub-pixel x shift per row for the swaying tree); its pixels get `k` */
  private lay(p: Pic, at: number[], k: K, keep?: (x: number, y: number) => boolean, sway?: (y: number) => number) { const x0 = at[0]!, y0 = Math.round(at[1]!);
    for (let sy = 0; sy < p.h; sy++) { const y = y0 + sy; if (y < 0 || y >= H) continue; const dx = sway ? sway(sy) : 0, fx = x0 + dx, ix = Math.floor(fx), f = fx - ix;
      for (let sx = -1; sx < p.w; sx++) { const x = ix + sx + 1; if (x < 0 || x >= W) continue; if (keep && !keep(x, y)) continue;
        const a0 = sx >= 0 ? p.px[(sy * p.w + sx) * 4 + 3]! : 0, a1 = sx + 1 < p.w ? p.px[(sy * p.w + sx + 1) * 4 + 3]! : 0, a = (a1 * (1 - f) + a0 * f) / 255; if (a < 0.5) continue;
        const j0 = (sy * p.w + Math.max(0, sx)) * 4, j1 = (sy * p.w + Math.min(p.w - 1, sx + 1)) * 4, i = y * W + x, w1 = a1 > 0 ? (a0 > 0 ? 1 - f : 1) : 0;
        this.alb[i * 3] = p.px[j1]! * w1 + p.px[j0]! * (1 - w1); this.alb[i * 3 + 1] = p.px[j1 + 1]! * w1 + p.px[j0 + 1]! * (1 - w1); this.alb[i * 3 + 2] = p.px[j1 + 2]! * w1 + p.px[j0 + 2]! * (1 - w1); this.kind[i] = k; this.treeM[i] = this.marking; this.footY[i] = Math.min(255, y0 + p.h); } } }

  draw(out: Uint8ClampedArray, e: Front2Env): void { const a = e.air, t = e.t, C = this.C, P = this.P;
    const day = a.daylight, dusk = clamp(1 - Math.abs(a.sunAlt - 2) / 10) * (1 - a.cloud * 0.5), night = 1 - day;
    // ---- the sky
    const season = e.doy < 80 || e.doy > 330 ? 'winter' : e.doy > 255 ? 'autumn' : 'spring', clearP = P.sky_summer!, overP = P['sky_' + season]!, mixO = clamp((a.cloud - 0.32) / 0.3);
    const off = t * (1.8 + a.wind * 8), [top, hor] = skyColours(a.sunAlt, a.cloud);
    const [sx, sy] = [240 + (a.sunAz - 180) * 4.2, 150 - 140 * clamp(a.sunAlt / (a.sunAlt + 14) * 1.3, -0.3, 1.02)], [mx, my] = [240 + (e.moon.az - 180) * 4.2, 150 - 140 * clamp(e.moon.alt / (e.moon.alt + 14) * 1.3, -0.3, 1.02)];
    const sunCol: V3 = mix3([255, 160, 80], [255, 246, 220], clamp(a.sunAlt / 20)), moonUp = e.moon.alt > 0 && day < 0.6;
    for (let y = 0; y < 180; y++) { const v = y / 150;
      for (let x = 0; x < W; x++) { const u = (x + off) % W, u0 = Math.floor(u), f = u - u0, u1 = (u0 + 1) % W, j0 = (y * W + u0) * 4, j1 = (y * W + u1) * 4;
        const cr = clearP.px[j0]! * (1 - f) + clearP.px[j1]! * f, cg = clearP.px[j0 + 1]! * (1 - f) + clearP.px[j1 + 1]! * f, cb = clearP.px[j0 + 2]! * (1 - f) + clearP.px[j1 + 2]! * f;
        const or = overP.px[j0]! * (1 - f) + overP.px[j1]! * f, og = overP.px[j0 + 1]! * (1 - f) + overP.px[j1 + 1]! * f, ob = overP.px[j0 + 2]! * (1 - f) + overP.px[j1 + 2]! * f;
        let r = lerp(cr, or, mixO), g = lerp(cg, og, mixO), b = lerp(cb, ob, mixO); const lum = (r + g + b) / 3;
        // the hour: the picture's light carried towards the sky's colour at this hour (dark blue at night, rose and gold at dusk)
        const gr = mix3(top, hor, Math.min(1, v) ** 0.8), keep = clamp(day * 1.1 - dusk * 0.35), lumN = lum / 160;
        r = lerp(gr[0] * lumN, r, keep); g = lerp(gr[1] * lumN, g, keep); b = lerp(gr[2] * lumN, b, keep);
        const thin = clamp((lum - 110) / 90) * mixO + (1 - mixO);   // light gets through the thin parts of cloud
        const ds = Math.hypot(x - sx, y - sy); if (a.sunAlt > -2) { const gl = (Math.exp(-ds / 20) * 0.5 + Math.exp(-ds / 70) * 0.22) * (0.35 + 0.65 * thin); r = lerp(r, sunCol[0], gl); g = lerp(g, sunCol[1], gl); b = lerp(b, sunCol[2], gl); if (ds < 5.5 && thin > 0.6 && a.cloud < 0.8) { const d2 = clamp(5.5 - ds) * thin * clamp((0.8 - a.cloud) / 0.25); r = lerp(r, 255, d2); g = lerp(g, 252, d2); b = lerp(b, 238, d2); } }
        if (moonUp) { const dm = Math.hypot(x - mx, y - my), lit = (1 - Math.abs(e.moon.phase - 0.5) * 2); if (dm < 16) { const gl = Math.exp(-dm / 6) * 0.3 * lit * thin; r = lerp(r, 210, gl); g = lerp(g, 214, gl); b = lerp(b, 230, gl); }
          if (dm < 4.2 && thin > 0.5) { const uu = (x - mx) / 4.2, kk = Math.cos(e.moon.phase * 2 * Math.PI), side = Math.sqrt(Math.max(0, 1 - ((y - my) / 4.2) ** 2)), on = e.moon.phase < 0.5 ? uu > kk * side : uu < -kk * side, d2 = clamp(4.2 - dm) * (on ? 1 : 0.12); r = lerp(r, 236, d2); g = lerp(g, 236, d2); b = lerp(b, 226, d2); } }
        if (day < 0.2 && mixO < 0.6 && hash2(x, y) > 0.9962) { const tw = (0.6 + 0.4 * Math.sin(t * 3 + x * 7 + y)) * (1 - day * 5) * (1 - mixO); r = lerp(r, 232, tw); g = lerp(g, 234, tw); b = lerp(b, 246, tw); }
        const k = (y * W + x) * 3; this.sky[k] = r; this.sky[k + 1] = g; this.sky[k + 2] = b; } }
    // ---- the ground of the season, changing a patch at a time; snow laid in patches
    const [ga, gb, gf] = seasonOf(e.doy), A = P['ground_' + ga]!, B = P['ground_' + gb]!, SN = P.ground_winter_snow!;
    this.kind.fill(K.Sky); this.cover.fill(1);
    this.snowy.fill(0); this.treeM.fill(0);
    for (let i = 0; i < N; i++) { const x = i % W, y = (i / W) | 0, c = cell(x, y, 4), sf = e.snow > 0 ? snowField(x, y) : 9, base = c < gf ? B : A, edge = Math.abs(sf - e.snow) < 0.035, dust = sf >= e.snow && sf - e.snow < 0.2 && hash2(x * 3 + 1, y * 5) < (1 - (sf - e.snow) / 0.2) * 0.55, src = sf < e.snow || dust ? SN : base, j = i * 4;   /* thin snow first dusts the ground in flakes */
      if (sf < e.snow && y >= 100) this.snowy[i] = 1;
      const cv = src.px[j + 3]! / 255; this.cover[i] = cv; if (cv < 0.04) continue; /* the woods' crowns are soft against the sky */ this.alb[i * 3] = src.px[j]!; this.alb[i * 3 + 1] = src.px[j + 1]!; this.alb[i * 3 + 2] = src.px[j + 2]!;
      if (edge && base.px[j + 3]! > 100) { this.alb[i * 3] = (this.alb[i * 3]! + base.px[j]!) / 2; this.alb[i * 3 + 1] = (this.alb[i * 3 + 1]! + base.px[j + 1]!) / 2; this.alb[i * 3 + 2] = (this.alb[i * 3 + 2]! + base.px[j + 2]!) / 2; }   /* slush at the edge of the snow */ this.kind[i] = y >= 168 && (y >= 203 || (x >= 296 && x < 470) || (x >= 152 && x < 188)) ? K.Wet : K.Ground; }
    // ---- the buildings and things
    this.lay(P.garage!, C.garage!.at, K.Wall); this.lay(P.house!, C.house!.at, K.Wall); this.lay(P.mailbox!, C.mailbox!.at, K.Wall); this.lay(P.lamp!, C.lamp!.at, K.Wall);
    this.inside.fill(0); this.dShade.fill(1); this.dWarm.fill(0); this.doors(e);
    const [ta, tb, tf] = treeOf(e.doy), amp = 0.35 + 1.4 * a.wind, sway = (p: Pic) => (sy: number) => { const up = clamp(1 - sy / (p.h * 0.62)); return amp * up * up * (Math.sin(t * 0.9 + sy * 0.015) * 0.75 + Math.sin(t * 2.1 + sy * 0.04) * 0.25); };
    this.marking = 1;
    if (tf > 0) { const pa = P[ta]!, pb = P[tb]!; this.lay(pa, C[ta]!.at, K.Wall, (x, y) => clump(x, y) >= tf, sway(pa)); this.lay(pb, C[tb]!.at, K.Wall, (x, y) => clump(x, y) < tf, sway(pb)); }
    else this.lay(P[ta]!, C[ta]!.at, K.Wall, undefined, sway(P[ta]!));
    this.marking = 0;
    // snow lying on the roofs, the chimney, the sills, the mailbox and the lamp: it gathers in drifts, thin first
    if (e.snow > 0.05) { const before = this.kind.slice(); this.lay(P.snowcaps!, [0, 0], K.Wall, (x, y) => { const f = clump(x * 1.6, y * 2.2) - (e.snow * 1.5 - 0.15); return f < 0 || (f < 0.25 && hash2(x * 5, y * 3 + 7) < (1 - f / 0.25) * 0.5); }); for (let i = 0; i < N; i++) if (this.kind[i] !== before[i] || (this.kind[i] === K.Wall && P.snowcaps!.px[i * 4 + 3]! > 128 && clump((i % W) * 1.6, ((i / W) | 0) * 2.2) < e.snow * 1.5 - 0.15)) this.snowy[i] = 1; }
    // and on the branches: along their upper edges, a pixel thick, two when it is deep
    if (e.snow > 0.12) for (let i = W * 2; i < N; i++) { if (!this.treeM[i] || this.treeM[i - W]) continue; const x = i % W, y = (i / W) | 0; if (clump(x * 3, y * 3) > e.snow * 1.4) continue;
      const put = (k: number, a: number) => { this.alb[k * 3] = lerp(this.alb[k * 3]!, 234, a); this.alb[k * 3 + 1] = lerp(this.alb[k * 3 + 1]!, 238, a); this.alb[k * 3 + 2] = lerp(this.alb[k * 3 + 2]!, 248, a); this.snowy[k] = 1; };
      put(i, 0.9); if (e.snow > 0.55 && this.treeM[i + W]) put(i + W, 0.55); if (e.snow > 0.8 && !this.treeM[i - W] && y > 2) { put(i - W, 0.8); this.kind[i - W] = K.Wall; } }
    if (ga === 'autumn' || (gb === 'autumn' && gf > 0.5) || ga === 'winter_bare' && e.doy > 300 && e.doy < 335) { const heaps: [string, number, number][] = [['leaves_1', 4, 166], ['leaves_0', 192, 190], ['leaves_2', 262, 196]]; for (const [n, x, y] of heaps) if (P[n]) this.lay(P[n]!, [x, y], K.Ground); }
    if (e.snow > 0.6) { const heaps: [string, number, number][] = [['snowpile_1', 268, 178], ['snowpile_0', 452, 180], ['snowpile_2', 0, 206]]; for (const [n, x, y] of heaps) if (P[n]) this.lay(P[n]!, [x, y], K.Ground); }
    // ---- the light
    const level = 0.1 + 0.95 * day * (0.92 + 0.1 * (1 - a.cloud)), ambC = mix3(mix3([1, 1, 1], [0.95, 0.97, 1.02], a.cloud), [1.06, 0.82, 0.68], dusk * 0.6), nb: V3 = [0.05, 0.06, 0.11];
    const lampOn = day < 0.32 || (a.rain > 0 && day < 0.55), lampP = C.lamp!.at as [number, number], lx = lampP[0] + 10.5, ly = lampP[1] + 8, pool: [number, number] = [453, 214];
    const winLit = e.houseLit && day < 0.5, wl = (1 - day * 2) * 0.95;
    const sparkle = clamp(a.sunAlt / 8) * (1 - a.cloud) + (lampOn ? 0.3 : 0);
    for (let i = 0; i < N; i++) { const kd = this.kind[i]!, x = i % W, y = (i / W) | 0;
      if (kd === K.Sky) { const k = y < 180 ? (y * W + x) * 3 : ((179) * W + x) * 3; this.lit[i * 3] = this.sky[k]!; this.lit[i * 3 + 1] = this.sky[k + 1]!; this.lit[i * 3 + 2] = this.sky[k + 2]!; continue; }
      let r = nb[0] + level * ambC[0], g = nb[1] + level * ambC[1], b = nb[2] + level * ambC[2];
      if (lampOn) { const d2 = (x - lx) ** 2 + (y - ly) ** 2; let kk = 0.45 / (1 + d2 / 900); if (kd === K.Wet || kd === K.Ground) { const ex = (x - pool[0]) / 60, ey = (y - pool[1]) / 15; kk += 1.05 * Math.exp(-(ex * ex + ey * ey) * 1.6); } r += kk; g += kk * 0.78; b += kk * 0.5; }
      if (winLit && (kd === K.Ground || kd === K.Wet)) for (const wb of C.windows) { const cx = (wb[0]! + wb[2]!) / 2, d = (x - cx) / 22, dy = (y - (wb[3]! + 26)) / 12; const kk = 0.22 * wl * Math.exp(-(d * d + dy * dy)); r += kk; g += kk * 0.72; b += kk * 0.42; }
      if (this.inside[i]) { const lv = this.inLevel[i]!; r *= lv; g *= lv; b *= lv * 0.97; if (this.inside[i] === 1 && e.houseLit) { const k = 0.7 * Math.max(wl, 0.25); r += k; g += k * 0.72; b += k * 0.42; } }   // indoors: as much daylight as the opening lets in; the hall lamplit
      r *= this.dShade[i]!; g *= this.dShade[i]!; b *= this.dShade[i]!;
      if (this.dWarm[i]! > 0 && e.houseLit) { const k = this.dWarm[i]! * Math.max(wl, 0.15); r += k; g += k * 0.72; b += k * 0.42; }   // the hall's light spilling out of the open door
      let ar = this.alb[i * 3]!, ag = this.alb[i * 3 + 1]!, ab = this.alb[i * 3 + 2]!; if (kd === K.Wet && e.wet > 0) { const w = 1 - 0.32 * e.wet; ar *= w; ag *= w; ab *= w; }
      this.lit[i * 3] = ar * r; this.lit[i * 3 + 1] = ag * g; this.lit[i * 3 + 2] = ab * b;
      if (this.snowy[i] && sparkle > 0 && hash2(x * 7 + Math.floor(t * 1.7 + hash2(x, y) * 9), y * 13) > 0.9975) { this.lit[i * 3] = 255; this.lit[i * 3 + 1] = 254; this.lit[i * 3 + 2] = 248; }   // the sun glinting on snow crystals
      if (kd === K.Ground && this.cover[i]! < 1) { const cv = this.cover[i]!, k = (Math.min(179, y) * W + x) * 3; this.lit[i * 3] = lerp(this.sky[k]!, this.lit[i * 3]!, cv); this.lit[i * 3 + 1] = lerp(this.sky[k + 1]!, this.lit[i * 3 + 1]!, cv); this.lit[i * 3 + 2] = lerp(this.sky[k + 2]!, this.lit[i * 3 + 2]!, cv); }
      // the windows at night: what is behind the glass, lamplit
      const gw = this.glass[i]!; if (gw >= 0 && winLit) { if (gw === 9) { const dg = C.doorGlass, u = (x - dg[0]!) / (dg[2]! - dg[0]!), v = (y - dg[1]!) / (dg[3]! - dg[1]!), fold = 0.82 + 0.18 * Math.sin(u * 22), glowk = Math.exp(-((u - 0.5) ** 2 * 6 + (v - 0.75) ** 2 * 4)), k = wl * (0.55 + 0.45 * glowk) * fold;   /* a sheer curtain on the door's glass, the hall lamp behind it */
          this.lit[i * 3] = lerp(this.lit[i * 3]!, 240, k); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, 176, k); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, 104, k * 0.9); }
        else { const nbx = C.windows[gw]!, nw = P['nightwin_' + gw]!, u = (x - nbx[0]!) / (nbx[2]! - nbx[0]!), v = (y - nbx[1]!) / (nbx[3]! - nbx[1]!), j = (Math.min(nw.h - 1, Math.max(0, Math.floor(v * nw.h))) * nw.w + Math.min(nw.w - 1, Math.max(0, Math.floor(u * nw.w)))) * 4;
          this.lit[i * 3] = lerp(this.lit[i * 3]!, nw.px[j]! * 1.05, wl); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, nw.px[j + 1]!, wl); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, nw.px[j + 2]! * 0.95, wl); } } }
    // ---- the street lamp lit: its lantern, its glow in the air
    /* the lantern and its glow in the air: lantern(), after the picture is made (both renderers) */
    // ---- wet: the road shines; lights draw long streaks down it, broken by the rain
    if (e.wet > 0.05) this.wetShine(e, lampOn ? [[lx, ly, 1]] : [], winLit ? C.windows.map(b => [(b[0]! + b[2]!) / 2, b[3]!, 0.55 * wl] as [number, number, number]) : []);
    if (e.wet > 0.35) this.puddles(e);
    this.chimney(e); this.birds(e); this.weather(e);
    for (let i = 0; i < N; i++) { out[i * 4] = Math.min(255, Math.max(0, this.lit[i * 3]!)); out[i * 4 + 1] = Math.min(255, Math.max(0, this.lit[i * 3 + 1]!)); out[i * 4 + 2] = Math.min(255, Math.max(0, this.lit[i * 3 + 2]!)); out[i * 4 + 3] = 255; }
  }

  /** the layers the GPU lights (review 54), made again only when what they show has changed: the ground, the buildings,
   *  the snow and the heaps (by day, snow, wet); the doors over a copy of that (by how far they are open and the light
   *  they let in); the tree on its own, unswayed (the GPU sways it). Returns which of them changed. */
  layers(e: Front2Env): { base: boolean; tree: boolean } { const P = this.P, C = this.C, q = (v: number, s: number) => Math.round(v / s);
    const sKey = `${e.doy}|${q(e.snow, 0.03)}|${q(e.wet, 0.05)}`, out = { base: false, tree: false };
    if (sKey !== this.sKey) { this.sKey = sKey; this.dKey = '';
      const [ga, gb, gf] = seasonOf(e.doy), A = P['ground_' + ga]!, B = P['ground_' + gb]!, SN = P.ground_winter_snow!;
      this.kind.fill(K.Sky); this.cover.fill(1); this.snowy.fill(0); this.treeM.fill(0); this.pudRow.fill(0); this.alb.fill(0);
      for (let i = 0; i < N; i++) { const x = i % W, y = (i / W) | 0, c = cell(x, y, 4), sf = e.snow > 0 ? snowField(x, y) : 9, base = c < gf ? B : A, edge = Math.abs(sf - e.snow) < 0.035, dust = sf >= e.snow && sf - e.snow < 0.2 && hash2(x * 3 + 1, y * 5) < (1 - (sf - e.snow) / 0.2) * 0.55, src = sf < e.snow || dust ? SN : base, j = i * 4;
        if (sf < e.snow && y >= 100) this.snowy[i] = 1;
        const cv = src.px[j + 3]! / 255; this.cover[i] = cv; if (cv < 0.04) continue; this.alb[i * 3] = src.px[j]!; this.alb[i * 3 + 1] = src.px[j + 1]!; this.alb[i * 3 + 2] = src.px[j + 2]!;
        if (edge && base.px[j + 3]! > 100) { this.alb[i * 3] = (this.alb[i * 3]! + base.px[j]!) / 2; this.alb[i * 3 + 1] = (this.alb[i * 3 + 1]! + base.px[j + 1]!) / 2; this.alb[i * 3 + 2] = (this.alb[i * 3 + 2]! + base.px[j + 2]!) / 2; }
        this.kind[i] = y >= 168 && (y >= 203 || (x >= 296 && x < 470) || (x >= 152 && x < 188)) ? K.Wet : K.Ground; }
      for (let i = 0; i < N; i++) this.footY[i] = (i / W) | 0;
      this.lay(P.garage!, C.garage!.at, K.Wall); this.lay(P.house!, C.house!.at, K.Wall); this.lay(P.mailbox!, C.mailbox!.at, K.Wall); this.lay(P.lamp!, C.lamp!.at, K.Wall);
      if (e.snow > 0.05) { const before = this.kind.slice(), fb = this.footY.slice(); this.lay(P.snowcaps!, [0, 0], K.Wall, (x, y) => { const f = clump(x * 1.6, y * 2.2) - (e.snow * 1.5 - 0.15); return f < 0 || (f < 0.25 && hash2(x * 5, y * 3 + 7) < (1 - f / 0.25) * 0.5); }); for (let i = 0; i < N; i++) if (this.kind[i] !== before[i] || (this.kind[i] === K.Wall && P.snowcaps!.px[i * 4 + 3]! > 128 && clump((i % W) * 1.6, ((i / W) | 0) * 2.2) < e.snow * 1.5 - 0.15)) this.snowy[i] = 1; this.footY.set(fb); }
      if (ga === 'autumn' || (gb === 'autumn' && gf > 0.5) || ga === 'winter_bare' && e.doy > 300 && e.doy < 335) { for (const [n, x, y] of [['leaves_1', 4, 166], ['leaves_0', 192, 190], ['leaves_2', 262, 196]] as [string, number, number][]) if (P[n]) this.lay(P[n]!, [x, y], K.Ground); }
      if (e.snow > 0.6) { for (const [n, x, y] of [['snowpile_1', 268, 178], ['snowpile_0', 452, 180], ['snowpile_2', 0, 206]] as [string, number, number][]) if (P[n]) this.lay(P[n]!, [x, y], K.Ground); }
      if (e.wet > 0.35) for (const [n, x0, y0] of [['puddle_1', 318, 186], ['puddle_0', 410, 192], ['puddle_2', 96, 236]] as [string, number, number][]) { const p = P[n]; if (!p) continue; const sc = Math.min(1, (e.wet - 0.35) / 0.4);   // puddles: their rims as drawn; their water mirrors the row the GPU looks up
        for (let sy = 0; sy < p.h; sy++) for (let sx = 0; sx < p.w; sx++) { const j = (sy * p.w + sx) * 4, al = p.px[j + 3]!; if (al === 0) continue; const x = x0 + sx, y = y0 + sy; if (x < 0 || x >= W || y >= H || cell(x, y, 2) > sc) continue; const i = y * W + x;
          if (al < 200) this.pudRow[i] = Math.max(1, y0 - (y - y0) - 10); else { this.alb[i * 3] = p.px[j]! * 0.85; this.alb[i * 3 + 1] = p.px[j + 1]! * 0.85; this.alb[i * 3 + 2] = p.px[j + 2]! * 0.85; } } }
      this.sAlb.set(this.alb); this.sKind.set(this.kind); this.sSnowy.set(this.snowy); this.sCover.set(this.cover); out.base = true; }
    const dKey = `${q(e.door, 0.01)}|${e.garage.map(v => q(v, 0.01)).join(',')}|${q(e.flag, 0.05)}|${e.houseLit}|${q(e.air.daylight, 0.02)}|${q(e.air.cloud, 0.05)}`;
    if (dKey !== this.dKey) { this.dKey = dKey; this.alb.set(this.sAlb); this.kind.set(this.sKind); this.snowy.set(this.sSnowy); this.cover.set(this.sCover);
      this.inside.fill(0); this.dShade.fill(1); this.dWarm.fill(0); this.doors(e); out.base = true; }
    const tKey = `${e.doy}|${q(e.snow, 0.05)}`;
    if (tKey !== this.tKey) { this.tKey = tKey; out.tree = true;   // the tree, on its own layer: drawn into spare buffers with the same routine, then lifted out
      const alb = this.alb, kind = this.kind, snowy = this.snowy, tA = new Float32Array(N * 3), tK = new Uint8Array(N).fill(K.Sky), tS = new Uint8Array(N);
      this.alb = tA; this.kind = tK; this.snowy = tS; this.treeM.fill(0); this.marking = 1;
      const [ta, tb, tf] = treeOf(e.doy); if (tf > 0) { this.lay(P[ta]!, C[ta]!.at, K.Wall, (x, y) => clump(x, y) >= tf); this.lay(P[tb]!, C[tb]!.at, K.Wall, (x, y) => clump(x, y) < tf); } else this.lay(P[ta]!, C[ta]!.at, K.Wall);
      this.marking = 0;
      if (e.snow > 0.12) for (let i = W * 2; i < N; i++) { if (!this.treeM[i] || this.treeM[i - W]) continue; const x = i % W, y = (i / W) | 0; if (clump(x * 3, y * 3) > e.snow * 1.4) continue;
        const put = (k: number, a: number) => { tA[k * 3] = lerp(tA[k * 3]!, 234, a); tA[k * 3 + 1] = lerp(tA[k * 3 + 1]!, 238, a); tA[k * 3 + 2] = lerp(tA[k * 3 + 2]!, 248, a); tS[k] = 1; };
        put(i, 0.9); if (e.snow > 0.55 && this.treeM[i + W]) put(i + W, 0.55); if (e.snow > 0.8 && !this.treeM[i - W] && y > 2) { put(i - W, 0.8); tK[i - W] = K.Wall; } }
      for (let i = 0; i < N; i++) { const on = tK[i] !== K.Sky; this.tree[i * 4] = tA[i * 3]!; this.tree[i * 4 + 1] = tA[i * 3 + 1]!; this.tree[i * 4 + 2] = tA[i * 3 + 2]!; this.tree[i * 4 + 3] = on ? (tS[i] ? 200 : 255) : 0; }
      this.alb = alb; this.kind = kind; this.snowy = snowy; const tp = P[ta]!; this.treeRect = [C[ta]!.at[0]!, Math.round(C[ta]!.at[1]!), tp.w, tp.h]; }
    return out; }

  /** the front door (hinged on its right, opening inward: the leaf narrows towards the hinge and its free edge goes
   *  away, a little shorter; the hall shows behind it), the garage's four leaves (each hinged at its outer edge, swinging
   *  out towards the street: they narrow towards the hinge and their free edges come nearer, taller and lower; the dark
   *  garage shows behind), the mailbox's red flag */
  private doors(e: Front2Env) { const al = this.alb, outdoor = clamp(e.air.daylight * (1.05 - 0.25 * e.air.cloud));
    /** one leaf. The room behind is painted first, lit by how much of the doorway is open (`aperture`); then the leaf,
     *  turned: narrower towards its hinge, its free edge nearer (outward) or further (inward); then its thickness, the
     *  edge of the board, seen at the free edge as it turns; the lintel's depth over the opening; the leaf's shadow */
    const leaf = (x0: number, x1: number, y0: number, y1: number, open: number, hinge: 'l' | 'r', inward: boolean, room: (x: number, y: number) => V3, kind: 1 | 2, aperture: number, light: (x: number, y: number, a: number) => number, thick: number) => {
      if (open <= 0.002) return; const w = x1 - x0, h = y1 - y0, src = new Float32Array(w * h * 3);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * W + x0 + x; src[(y * w + x) * 3] = al[i * 3]!; src[(y * w + x) * 3 + 1] = al[i * 3 + 1]!; src[(y * w + x) * 3 + 2] = al[i * 3 + 2]!; }
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * W + x, c = room(x - x0, y - y0); al[i * 3] = c[0]; al[i * 3 + 1] = c[1]; al[i * 3 + 2] = c[2]; this.inside[i] = kind; this.kind[i] = K.Wall;
        this.inLevel[i] = light(x - x0, y - y0, aperture) * (y - y0 < 3 ? 0.55 : 1); }                       // the lintel's underside in shadow
      const th = open * (inward ? 1.35 : 1.5), cos = Math.cos(th), sin = Math.sin(th), pw = Math.max(1, w * Math.abs(cos)), face = inward ? 0.66 + 0.34 * Math.abs(cos) : 0.82 + 0.18 * Math.abs(cos);
      let edgeCol = 0, edgeTop = y0, edgeH = h;
      for (let k = 0; k < Math.ceil(pw); k++) { const u = (k + 0.5) / pw /* 0 at the hinge .. 1 at the free edge */, sx = Math.min(w - 1, Math.floor(u * w)), col = hinge === 'l' ? x0 + k : x1 - 1 - k;
        const grow = inward ? 1 - 0.12 * sin * u : 1 + 0.2 * sin * u, hh = h * grow, top = inward ? y0 + (h - hh) * 0.5 : y0 - (hh - h) * 0.3;
        edgeCol = col; edgeTop = top; edgeH = hh;
        for (let y = Math.floor(top); y < top + hh; y++) { if (y < 0 || y >= H) continue; const sy = Math.min(h - 1, Math.max(0, Math.floor((y - top) / hh * h))), j = (sy * w + (hinge === 'l' ? sx : w - 1 - sx)) * 3, i = y * W + col;
          al[i * 3] = src[j]! * face; al[i * 3 + 1] = src[j + 1]! * face; al[i * 3 + 2] = src[j + 2]! * face; this.inside[i] = 0; this.kind[i] = K.Wall; } }
      // the board's edge: as the leaf turns, its thickness shows beside the free edge, lighter (it faces the opening)
      const ew = Math.round(thick * sin), dir = hinge === 'l' ? 1 : -1, avg: V3 = [0, 0, 0]; let n = 0;
      for (let q = 0; q < w * h; q += 7) { avg[0] += src[q * 3]!; avg[1] += src[q * 3 + 1]!; avg[2] += src[q * 3 + 2]!; n++; }
      for (let q = 1; q <= ew; q++) { const col = edgeCol + dir * q; if (col < x0 || col >= x1) continue; for (let y = Math.floor(edgeTop); y < edgeTop + edgeH; y++) { if (y < 0 || y >= H) continue; const i = y * W + col, k = q === ew ? 0.55 : inward ? 1.18 : 1.05;
        al[i * 3] = avg[0] / n * k; al[i * 3 + 1] = avg[1] / n * k; al[i * 3 + 2] = avg[2] / n * k; this.inside[i] = 0; this.kind[i] = K.Wall; } }
      // the open leaf's shadow on the ground in front (it stands out from the wall) and in the corner it makes
      if (!inward) for (let k = 0; k < Math.ceil(pw) + ew; k++) { const col = hinge === 'l' ? x0 + k : x1 - 1 - k; for (let d = 0; d < 6; d++) { const y = y1 + d; if (y >= H) continue; const i = y * W + col; this.dShade[i] = Math.min(this.dShade[i]!, 1 - 0.38 * sin * (1 - d / 6) * (0.4 + 0.6 * outdoor)); } }
      return { pw, sin }; };

    // the hall behind the front door: papered walls, the floor, the doorway to the kitchen beyond; daylight comes in as far
    // as the door is open; at night, if a lamp burns, its light spills out of the door onto the steps and the path
    const hall = (x: number, y: number): V3 => {   // a passage in perspective: the side walls closing in on the kitchen doorway at its end
      const cx = 10, far = { x0: 6, x1: 14, y0: 16, y1: 46 }, t = (y - far.y1) / (62 - far.y1);
      if (x >= far.x0 && x < far.x1 && y >= far.y0 && y < far.y1) return y > 38 ? [176, 136, 92] : [196, 156, 104];     // the kitchen's light beyond
      if (y >= far.y1) { const half = 4 + t * 6, run = Math.abs(x - cx) < half * 0.5; return run ? [118 - t * 10, 38, 34] : [112 - (y % 3 === 0 ? 12 : 0), 82, 58]; }   // the floor boards, a red runner down the middle
      if (y < far.y0) return [62 + (y % 4 === 0 ? -6 : 0), 50, 40];                                                       // the ceiling
      const side = x < far.x0 ? (far.x0 - x) / far.x0 : (x - far.x1 + 1) / (20 - far.x1), wall = 104 - side * 26 + ((x * 7 + y * 3) % 9 === 0 ? 8 : 0);
      return [wall, wall * 0.8, wall * 0.6]; };                                                                           // papered walls, darker as they come nearer
    const hallLight = (x: number, y: number, ap: number) => { const fl = y > 46 ? 1 : 0, far = x >= 6 && x < 14 && y >= 16 && y < 46 ? 0.5 : 0; return 0.14 + far + (0.34 + 0.18 * fl) * ap * outdoor; };
    leaf(161, 181, 100, 162, e.door, 'r', true, (x, y) => hall(x, y), 1, e.door, hallLight, 3);
    // the spill: the hall's light comes out only through the gap between the left jamb and the door's free edge, so the
    // patch it throws down the steps and along the path is that gap carried outwards and down: its left side fixed by
    // the jamb, its right side following the door as it swings; brightest where the gap is widest
    if (e.door > 0.01 && e.houseLit) { const th = e.door * 1.35, gapL = 161, gapR = 181 - 20 * Math.abs(Math.cos(th)), gw = Math.max(0, gapR - gapL), op = gw / 20;
      for (let y = 160; y < 214; y++) { const dy = y - 160, spread = dy * 0.42, x0 = gapL - spread * 0.55, x1 = gapR + spread * (0.55 + 0.6 * op), k = 0.9 * Math.min(1, op * 1.6) * Math.exp(-dy / 32);
        for (let x = Math.floor(x0 - 2); x <= x1 + 2; x++) { if (x < 0 || x >= W) continue; const edge = clamp(Math.min(x - x0 + 1, x1 - x + 1) / 1.6) * (0.85 + 0.15 * Math.sin(x * 0.9)); this.dWarm[y * W + x] = Math.max(this.dWarm[y * W + x]!, k * edge); } } }

    // the garage inside: board walls in shadow, a small window high on the back wall, a bench along it with a few tools,
    // the concrete floor brighter the nearer the door. How much daylight comes in follows how far each bay is open.
    const room = (x: number, y: number): V3 => { const gx = x % 71, fl = clamp((y - 46) / 20), board = gx % 7 === 0 ? -7 : (gx * 13) % 5;
      let c: V3 = [66 + board, 58 + board * 0.8, 50 + board * 0.6];
      if (y >= 10 && y < 20 && gx >= 26 && gx < 44) c = (gx - 26) % 6 === 0 || y === 14 ? [60, 50, 40] : [150, 160, 170];   // the window
      if (y >= 36 && y < 40 && gx > 4 && gx < 64) c = [104, 78, 54];                                                 // the bench top
      if (y >= 40 && y < 47 && (gx === 8 || gx === 60)) c = [64, 48, 34];                                             // its legs
      if (y >= 28 && y < 36 && gx > 10 && gx < 58 && (gx % 9 === 2 || (gx % 9 === 3 && y < 31))) c = [120, 118, 112]; // tools on the wall
      if (y >= 46) c = [lerp(80, 140, fl), lerp(76, 134, fl), lerp(70, 124, fl)];
      return c; };
    const garLight = (wide: number) => (x: number, y: number, ap: number) => { const fl = clamp((y - 46) / 20), mid = 1 - Math.abs(x / wide - 0.5) * 1.2, win = y >= 10 && y < 20 ? 0.25 : 0;
      return 0.08 + 0.12 * outdoor + win * outdoor + ap * outdoor * (0.22 + 0.5 * fl * fl * mid); };
    const G = e.garage, bay1 = (G[0]! + G[1]!) / 2, bay2 = (G[2]! + G[3]!) / 2;
    leaf(305, 341, 101, 167, G[0]!, 'l', false, (x, y) => room(x, y), 2, bay1, (x, y, ap) => garLight(72)(x, y, ap), 2); leaf(341, 377, 101, 167, G[1]!, 'r', false, (x, y) => room(x + 36, y), 2, bay1, (x, y, ap) => garLight(72)(x + 36, y, ap), 2);
    leaf(385, 420, 101, 167, G[2]!, 'l', false, (x, y) => room(x, y), 2, bay2, (x, y, ap) => garLight(71)(x, y, ap), 2); leaf(420, 456, 101, 167, G[3]!, 'r', false, (x, y) => room(x + 35, y), 2, bay2, (x, y, ap) => garLight(71)(x + 35, y, ap), 2);
    // the mailbox's flag: down along the box, up when there is a letter in it
    const ang = e.flag * Math.PI / 2, px = 152.5, py = 184;   // the flag: an arm and a blade, two pixels thick, its edge darker
    for (let k = 0; k < 8; k++) for (let th = 0; th < 2; th++) { const x = Math.round(px + Math.cos(ang) * k + Math.sin(ang) * th), y = Math.round(py - Math.sin(ang) * k + Math.cos(ang) * th), i = y * W + x; const blade = k > 3, edge = th === 1;
      al[i * 3] = blade ? (edge ? 120 : 186) : (edge ? 70 : 104); al[i * 3 + 1] = blade ? (edge ? 26 : 40) : (edge ? 60 : 92); al[i * 3 + 2] = blade ? (edge ? 20 : 30) : (edge ? 52 : 82); this.kind[i] = K.Wall;
      if (blade && k > 4) { const x2 = Math.round(x - Math.sin(ang) * 2), y2 = Math.round(y - Math.cos(ang) * 2), i2 = y2 * W + x2; al[i2 * 3] = 170; al[i2 * 3 + 1] = 36; al[i2 * 3 + 2] = 28; this.kind[i2] = K.Wall; } } }

  private add(i: number, c: V3, w: number) { this.lit[i * 3] = this.lit[i * 3]! + c[0] * w; this.lit[i * 3 + 1] = this.lit[i * 3 + 1]! + c[1] * w; this.lit[i * 3 + 2] = this.lit[i * 3 + 2]! + c[2] * w; }
  private glow(cx: number, cy: number, k: number, c: V3, r: number) { for (let y = Math.floor(cy - r * 3); y < cy + r * 3; y++) for (let x = Math.floor(cx - r * 3); x < cx + r * 3; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; this.add(y * W + x, c, k * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (r * r))); } }
  /** the wet surfaces mirror the scene above them faintly, and each light lays a long streak down them */
  private wetShine(e: Front2Env, lamps: [number, number, number][], wins: [number, number, number][]) { const t = e.t, w = e.wet, src = this.lit.slice(0, 180 * W * 3);
    for (let y = 168; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (this.kind[i] !== K.Wet) continue;
      const my = Math.max(0, Math.min(179, 2 * (y < 203 ? 168 : 203) - y - 2)), j = my * W + x, k = w * (y >= 222 ? 0.22 : 0.14); this.lit[i * 3] = lerp(this.lit[i * 3]!, src[j * 3]!, k); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, src[j * 3 + 1]!, k); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, src[j * 3 + 2]!, k);
      for (const [lx, ly, s] of [...lamps, ...wins]) { if (y < ly + 40 && lamps.length && lx === lamps[0]![0]) { /* the lamp's own pool covers near it */ }
        const dx = (x - lx + Math.sin(y * 1.3 + t * (e.air.rain > 0 ? 7 : 1.5)) * (e.air.rain > 0 ? 1.4 : 0.4)) / (s >= 1 ? 4.5 : 6), down = y - Math.max(ly, 200), fade = down > 0 ? Math.exp(-down / 46) : 0, kk = s * w * 0.75 * Math.exp(-dx * dx) * fade;
        if (kk > 0.003) this.add(i, [255, 206, 130], kk); } } }
  /** puddles after rain: their rims as drawn, their water mirroring what stands above */
  private puddles(e: Front2Env) { const spots: [string, number, number][] = [['puddle_1', 318, 186], ['puddle_0', 410, 192], ['puddle_2', 96, 236]], src = this.lit.slice(0, 200 * W * 3);
    for (const [n, x0, y0] of spots) { const p = this.P[n]; if (!p) continue; const sc = Math.min(1, (e.wet - 0.35) / 0.4);
      for (let sy = 0; sy < p.h; sy++) for (let sx = 0; sx < p.w; sx++) { const j = (sy * p.w + sx) * 4, al = p.px[j + 3]!; if (al === 0) continue; const x = x0 + sx, y = y0 + sy; if (x < 0 || x >= W || y >= H) continue; if (cell(x, y, 2) > sc) continue; const i = y * W + x;
        if (al < 200) { const my = Math.max(0, y0 - (y - y0) - 10), mi = my * W + x; this.lit[i * 3] = src[mi * 3]! * 0.8; this.lit[i * 3 + 1] = src[mi * 3 + 1]! * 0.82; this.lit[i * 3 + 2] = src[mi * 3 + 2]! * 0.88; }
        else { const lv = (this.lit[i * 3]! + this.lit[i * 3 + 1]! + this.lit[i * 3 + 2]!) / (3 * 128); this.lit[i * 3] = p.px[j]! * lv * 0.85; this.lit[i * 3 + 1] = p.px[j + 1]! * lv * 0.85; this.lit[i * 3 + 2] = p.px[j + 2]! * lv * 0.85; } } } }
  private dab(cx: number, cy: number, r: number, c: V3, a: number) { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const w = a * clamp(1 - Math.hypot(x - cx, y - cy) / (r + 0.5)); if (w <= 0) continue; const i = y * W + x;
    this.lit[i * 3] = lerp(this.lit[i * 3]!, c[0], w); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, c[1], w); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, c[2], w); } }
  chimney(e: Front2Env) { const a = e.air, cx = 236, cy = 34, lv = 0.15 + 0.85 * a.daylight;
    if (a.temp < 12 && Math.random() < e.dt * 5) this.smoke.push({ x: cx + (Math.random() - 0.5) * 3, y: cy, age: 0, life: 4 + Math.random() * 3 });
    for (const p of this.smoke) { p.age += e.dt; p.y -= e.dt * (7 - p.age * 0.8); p.x += e.dt * (2 + a.wind * 14) * (0.4 + p.age * 0.3) + Math.sin(e.t + p.age) * e.dt * 1.5; }
    this.smoke = this.smoke.filter(p => p.age < p.life); for (const p of this.smoke) this.dab(p.x, p.y, 1 + p.age * 1.3, [168 * lv + 10, 166 * lv + 10, 170 * lv + 14], 0.3 * (1 - p.age / p.life) * Math.min(1, p.age * 2)); }
  birds(e: Front2Env) { const B = this.bird, a = e.air; if (B.x < 0) { B.wait -= e.dt; if (B.wait <= 0 && a.daylight > 0.5 && a.rain === 0 && a.snow === 0) { B.dir = Math.random() < 0.5 ? 1 : -1; B.x = B.dir > 0 ? -4 : W + 4; B.y = 14 + Math.random() * 50; } return; }
    B.x += B.dir * e.dt * 34; B.y += Math.sin(e.t * 2) * e.dt * 3; if (B.x < -6 || B.x > W + 6) { B.x = -1; B.wait = 10 + Math.random() * 20; return; }
    const flap = Math.sin(e.t * 13) > 0, x = Math.round(B.x), y = Math.round(B.y); for (const [dx, dy] of [[0, 0], [-1, flap ? -1 : 0], [1, flap ? -1 : 0], [-2, flap ? -1 : 1], [2, flap ? -1 : 1]] as const) { const i = (y + dy) * W + x + dx; if (i >= 0 && i < N && this.kind[i] === K.Sky) { this.lit[i * 3] = 46; this.lit[i * 3 + 1] = 44; this.lit[i * 3 + 2] = 48; } } }
  /** rain; snow in three depths (far: small, faint, slow; near: big, soft, quick) */
  weather(e: Front2Env) { const a = e.air, lv = 0.3 + 0.7 * a.daylight;
    if (a.rain > 0) for (let k = 0; k < 4; k++) if (Math.random() < e.dt * 70 * a.rain) this.fall.push({ x: Math.random() * (W + 60), y: -6, v: 260 + Math.random() * 90, snow: 0 });
    if (a.snow > 0) for (const [depth, rate, v] of [[1, 34, 9], [2, 16, 16], [3, 4, 30]] as const) if (Math.random() < e.dt * rate * a.snow * 2) this.fall.push({ x: Math.random() * (W + 40), y: -3, v: v + Math.random() * v * 0.5, snow: depth });
    const gust = 0.5 + 0.9 * Math.max(0, Math.sin(e.t * 0.31) * Math.sin(e.t * 0.17 + 1));   // the wind comes in gusts
    for (const q of this.fall) { q.y += q.v * e.dt; q.x += q.snow ? Math.sin(e.t * (0.8 + q.snow * 0.3) + q.v) * e.dt * (3 + q.snow * 2) - a.wind * gust * e.dt * (8 + q.snow * 6) : -q.v * e.dt * (0.12 + a.wind * 0.3); }
    this.fall = this.fall.filter(q => q.y < H && q.x > -40);
    for (const q of this.fall) { if (q.snow) this.dab(q.x, q.y, [0, 0.35, 0.8, 1.3][q.snow]!, [236 * lv + 10, 238 * lv + 10, 246 * lv + 8], [0, 0.45, 0.75, 0.85][q.snow]!);
      else for (let j = 0; j < 6; j++) { const x = Math.round(q.x + j * (0.12 + a.wind * 0.3)), y = Math.round(q.y - j); if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = y * W + x, w = 0.2 - j * 0.025; this.lit[i * 3] = lerp(this.lit[i * 3]!, 200 * lv, w); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, 210 * lv, w); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, 226 * lv, w); } } }
}
