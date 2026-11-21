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
export interface Front2Env { t: number; dt: number; air: Air; moon: { alt: number; az: number; phase: number }; minute: number; doy: number; houseLit: boolean; snow: number; wet: number }
type Cut = Record<string, { at: number[]; size: number[] }> & { windows: number[][]; doorGlass: number[]; nightwin: number[][] };
const enum K { Sky, Ground, Wall, Glass, Lantern, Wet }

/** which ground picture, and how far into the next (by day of the year) */
function seasonOf(doy: number): [string, string, number] {
  const S: [number, string][] = [[0, 'winter_bare'], [80, 'winter_bare'], [110, 'spring'], [152, 'spring'], [162, 'summer'], [253, 'summer'], [274, 'autumn'], [314, 'autumn'], [329, 'winter_bare'], [366, 'winter_bare']];
  for (let i = 0; i < S.length - 1; i++) { const [d0, a] = S[i]!, [d1, b] = S[i + 1]!; if (doy >= d0 && doy < d1) return [a, b, a === b ? 0 : (doy - d0) / (d1 - d0)]; } return ['winter_bare', 'winter_bare', 0]; }
/** which tree, and how far into the next */
function treeOf(doy: number): [string, string, number] {
  const T: [number, string][] = [[0, 'tree_bare'], [84, 'tree_bare'], [100, 'tree_bud'], [110, 'tree_bud'], [118, 'tree_blossom'], [136, 'tree_blossom'], [148, 'tree_summer'], [258, 'tree_summer'], [270, 'tree_yellow'], [282, 'tree_yellow'], [290, 'tree_red'], [298, 'tree_red'], [306, 'tree_late'], [316, 'tree_late'], [326, 'tree_bare'], [366, 'tree_bare']];
  for (let i = 0; i < T.length - 1; i++) { const [d0, a] = T[i]!, [d1, b] = T[i + 1]!; if (doy >= d0 && doy < d1) return [a, b, a === b ? 0 : (doy - d0) / (d1 - d0)]; } return ['tree_bare', 'tree_bare', 0]; }
const cell = (x: number, y: number, s = 3) => hash2(Math.floor(x / s) + 911, Math.floor(y / s) + 37);   // a patch's own threshold, for changing a patch at a time
/** where snow lies first (low) and last (high): the lawn before the paths, the pavement after, the road last and its
 *  wheel tracks never; drifts along the foot of the house; in clumps of all sizes */
function snowField(x: number, y: number): number { let bias = 0;
  if (y >= 222) bias = 0.3 + (Math.abs(y - 241) < 3 || Math.abs(y - 254) < 3 ? 0.6 : 0); else if (y >= 203) bias = 0.15; else if (y >= 166 && ((x >= 296 && x < 470) || (x >= 152 && x < 188))) bias = 0.08; else if (y >= 166) bias = -0.1 - (y < 172 ? 0.08 : 0);
  return clump(x * 1.3, y * 2) * 0.55 + 0.1 + bias; }
/** the same for leaves: round clumps of all sizes, not squares */
const clump = (x: number, y: number) => Math.min(1, Math.max(0, (noise(x / 9 + 3.1, y / 9 + 7.7) * 0.65 + noise(x / 3.5 + 11, y / 3.5) * 0.35 - 0.2) / 0.6));

export class Front2 {
  private alb = new Float32Array(N * 3); private lit = new Float32Array(N * 3); private kind = new Uint8Array(N); private sky = new Float32Array(W * 180 * 3);
  private glass = new Int8Array(N).fill(-1); private cover = new Float32Array(N); private snowy = new Uint8Array(N); private treeM = new Uint8Array(N); private marking = 0;
  private smoke: { x: number; y: number; age: number; life: number }[] = []; private fall: { x: number; y: number; v: number; snow: number }[] = []; private bird = { x: -1, y: 0, wait: 6, dir: 1 };
  constructor(private C: Cut, private P: Record<string, Pic>) {
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
        this.alb[i * 3] = p.px[j1]! * w1 + p.px[j0]! * (1 - w1); this.alb[i * 3 + 1] = p.px[j1 + 1]! * w1 + p.px[j0 + 1]! * (1 - w1); this.alb[i * 3 + 2] = p.px[j1 + 2]! * w1 + p.px[j0 + 2]! * (1 - w1); this.kind[i] = k; this.treeM[i] = this.marking; } } }

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
      let ar = this.alb[i * 3]!, ag = this.alb[i * 3 + 1]!, ab = this.alb[i * 3 + 2]!; if (kd === K.Wet && e.wet > 0) { const w = 1 - 0.32 * e.wet; ar *= w; ag *= w; ab *= w; }
      this.lit[i * 3] = ar * r; this.lit[i * 3 + 1] = ag * g; this.lit[i * 3 + 2] = ab * b;
      if (this.snowy[i] && sparkle > 0 && hash2(x * 7 + Math.floor(t * 1.7 + hash2(x, y) * 9), y * 13) > 0.9975) { this.lit[i * 3] = 255; this.lit[i * 3 + 1] = 254; this.lit[i * 3 + 2] = 248; }   // the sun glinting on snow crystals
      if (kd === K.Ground && this.cover[i]! < 1) { const cv = this.cover[i]!, k = (Math.min(179, y) * W + x) * 3; this.lit[i * 3] = lerp(this.sky[k]!, this.lit[i * 3]!, cv); this.lit[i * 3 + 1] = lerp(this.sky[k + 1]!, this.lit[i * 3 + 1]!, cv); this.lit[i * 3 + 2] = lerp(this.sky[k + 2]!, this.lit[i * 3 + 2]!, cv); }
      // the windows at night: what is behind the glass, lamplit
      const gw = this.glass[i]!; if (gw >= 0 && winLit) { if (gw === 9) { this.lit[i * 3] = lerp(this.lit[i * 3]!, 236, wl * 0.8); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, 170, wl * 0.8); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, 96, wl * 0.8); }
        else { const nbx = C.windows[gw]!, nw = P['nightwin_' + gw]!, u = (x - nbx[0]!) / (nbx[2]! - nbx[0]!), v = (y - nbx[1]!) / (nbx[3]! - nbx[1]!), j = (Math.min(nw.h - 1, Math.max(0, Math.floor(v * nw.h))) * nw.w + Math.min(nw.w - 1, Math.max(0, Math.floor(u * nw.w)))) * 4;
          this.lit[i * 3] = lerp(this.lit[i * 3]!, nw.px[j]! * 1.05, wl); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, nw.px[j + 1]!, wl); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, nw.px[j + 2]! * 0.95, wl); } } }
    // ---- the street lamp lit: its lantern, its glow in the air
    if (lampOn) { const lp = P.lamp!; for (let sy2 = 0; sy2 < 18; sy2++) for (let sx2 = 0; sx2 < lp.w; sx2++) { const j = (sy2 * lp.w + sx2) * 4; if (lp.px[j + 3]! < 128) continue; const l = (lp.px[j]! + lp.px[j + 1]! + lp.px[j + 2]!) / 3; if (l < 120) continue; const i = (Math.round(lampP[1]) + sy2) * W + Math.round(lampP[0]) + sx2; this.lit[i * 3] = 255; this.lit[i * 3 + 1] = 232; this.lit[i * 3 + 2] = 170; }
      this.glow(lx, ly, 0.55, [255, 214, 140], 9); }
    // ---- wet: the road shines; lights draw long streaks down it, broken by the rain
    if (e.wet > 0.05) this.wetShine(e, lampOn ? [[lx, ly, 1]] : [], winLit ? C.windows.map(b => [(b[0]! + b[2]!) / 2, b[3]!, 0.55 * wl] as [number, number, number]) : []);
    if (e.wet > 0.35) this.puddles(e);
    this.chimney(e); this.birds(e); this.weather(e);
    for (let i = 0; i < N; i++) { out[i * 4] = Math.min(255, Math.max(0, this.lit[i * 3]!)); out[i * 4 + 1] = Math.min(255, Math.max(0, this.lit[i * 3 + 1]!)); out[i * 4 + 2] = Math.min(255, Math.max(0, this.lit[i * 3 + 2]!)); out[i * 4 + 3] = 255; }
  }

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
  private chimney(e: Front2Env) { const a = e.air, cx = 236, cy = 34, lv = 0.15 + 0.85 * a.daylight;
    if (a.temp < 12 && Math.random() < e.dt * 5) this.smoke.push({ x: cx + (Math.random() - 0.5) * 3, y: cy, age: 0, life: 4 + Math.random() * 3 });
    for (const p of this.smoke) { p.age += e.dt; p.y -= e.dt * (7 - p.age * 0.8); p.x += e.dt * (2 + a.wind * 14) * (0.4 + p.age * 0.3) + Math.sin(e.t + p.age) * e.dt * 1.5; }
    this.smoke = this.smoke.filter(p => p.age < p.life); for (const p of this.smoke) this.dab(p.x, p.y, 1 + p.age * 1.3, [168 * lv + 10, 166 * lv + 10, 170 * lv + 14], 0.3 * (1 - p.age / p.life) * Math.min(1, p.age * 2)); }
  private birds(e: Front2Env) { const B = this.bird, a = e.air; if (B.x < 0) { B.wait -= e.dt; if (B.wait <= 0 && a.daylight > 0.5 && a.rain === 0 && a.snow === 0) { B.dir = Math.random() < 0.5 ? 1 : -1; B.x = B.dir > 0 ? -4 : W + 4; B.y = 14 + Math.random() * 50; } return; }
    B.x += B.dir * e.dt * 34; B.y += Math.sin(e.t * 2) * e.dt * 3; if (B.x < -6 || B.x > W + 6) { B.x = -1; B.wait = 10 + Math.random() * 20; return; }
    const flap = Math.sin(e.t * 13) > 0, x = Math.round(B.x), y = Math.round(B.y); for (const [dx, dy] of [[0, 0], [-1, flap ? -1 : 0], [1, flap ? -1 : 0], [-2, flap ? -1 : 1], [2, flap ? -1 : 1]] as const) { const i = (y + dy) * W + x + dx; if (i >= 0 && i < N && this.kind[i] === K.Sky) { this.lit[i * 3] = 46; this.lit[i * 3 + 1] = 44; this.lit[i * 3 + 2] = 48; } } }
  /** rain; snow in three depths (far: small, faint, slow; near: big, soft, quick) */
  private weather(e: Front2Env) { const a = e.air, lv = 0.3 + 0.7 * a.daylight;
    if (a.rain > 0) for (let k = 0; k < 4; k++) if (Math.random() < e.dt * 70 * a.rain) this.fall.push({ x: Math.random() * (W + 60), y: -6, v: 260 + Math.random() * 90, snow: 0 });
    if (a.snow > 0) for (const [depth, rate, v] of [[1, 34, 9], [2, 16, 16], [3, 4, 30]] as const) if (Math.random() < e.dt * rate * a.snow * 2) this.fall.push({ x: Math.random() * (W + 40), y: -3, v: v + Math.random() * v * 0.5, snow: depth });
    const gust = 0.5 + 0.9 * Math.max(0, Math.sin(e.t * 0.31) * Math.sin(e.t * 0.17 + 1));   // the wind comes in gusts
    for (const q of this.fall) { q.y += q.v * e.dt; q.x += q.snow ? Math.sin(e.t * (0.8 + q.snow * 0.3) + q.v) * e.dt * (3 + q.snow * 2) - a.wind * gust * e.dt * (8 + q.snow * 6) : -q.v * e.dt * (0.12 + a.wind * 0.3); }
    this.fall = this.fall.filter(q => q.y < H && q.x > -40);
    for (const q of this.fall) { if (q.snow) this.dab(q.x, q.y, [0, 0.35, 0.8, 1.3][q.snow]!, [236 * lv + 10, 238 * lv + 10, 246 * lv + 8], [0, 0.45, 0.75, 0.85][q.snow]!);
      else for (let j = 0; j < 6; j++) { const x = Math.round(q.x + j * (0.12 + a.wind * 0.3)), y = Math.round(q.y - j); if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = y * W + x, w = 0.2 - j * 0.025; this.lit[i * 3] = lerp(this.lit[i * 3]!, 200 * lv, w); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, 210 * lv, w); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, 226 * lv, w); } } }
}
