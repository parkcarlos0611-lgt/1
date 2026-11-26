// The front of the house, lit by the game (review 45). The planner's picture (window-fixed, tools/places/front.py) with
// a map of what every pixel is; the sky is the game's own, every frame:
// - clouds drifting in real time with the wind, thicker the cloudier the hour, lit by the sun (white by day, gold and
//   rose at its rising and setting, grey under rain, dark at night)
// - the sun behind the house: the viewer looks south, so it crosses from left (east) to right (west); its height is
//   drawn a little squeezed so a high summer sun is still in the picture. The roofs and the tree hide it as they
//   would, the clouds veil it. One look tells the hour.
// - the moon in its phase, rising later each night; stars on a clear night
// and the scene under it: the light by the hour and the weather, the tree's leaves stirring (more in the wind), smoke
// from the chimney on a cold day, the street lamp lit at dusk with its pool on the pavement, the windows lit at night
// when a lamp burns in the house, the road dark and shining when wet (the lamp and the sky in it, broken by the rain),
// snow on the roofs and the lawn, rain and snow falling.
import type { Air } from '../../core/atmosphere';
import { W, H, clamp, lerp, mix3, hash2, noise, fbm, skyColours, type V3 } from './room';

const N = W * H;
export interface OutdoorData { regionId: Record<string, number>; horizon: number; lamp: { at: number[]; pool: number[] }; chimney: number[] }
export interface OutdoorEnv { t: number; dt: number; air: Air; moon: { alt: number; az: number; phase: number }; minute: number; houseLit: boolean; wet: number; snowCover: number }

export class Outdoor {
  private alb = new Float32Array(N * 3); private lit = new Float32Array(N * 3); private rid = new Uint8Array(N);
  private ids: Record<string, number>; private smoke: { x: number; y: number; age: number; life: number; s: number }[] = [];
  private fall: { x: number; y: number; v: number; snow: boolean }[] = []; private bird = { x: -1, y: 0, wait: 6, dir: 1 };
  private roadTop: number;
  constructor(private D: OutdoorData, base: Uint8ClampedArray, regions: Uint8ClampedArray) {
    this.ids = D.regionId; let top = H;
    for (let i = 0; i < N; i++) { this.alb[i * 3] = base[i * 4]!; this.alb[i * 3 + 1] = base[i * 4 + 1]!; this.alb[i * 3 + 2] = base[i * 4 + 2]!; this.rid[i] = regions[i * 4]!; if (this.rid[i] === D.regionId.road) top = Math.min(top, (i / W) | 0); }
    this.roadTop = top; }

  /** where a body at this height and bearing stands in the picture (looking south) */
  private onScreen(alt: number, az: number): [number, number] { const hz = this.D.horizon; return [240 + (az - 180) * 4.2, hz - (hz - 10) * clamp(alt / (alt + 14) * 1.3, -0.3, 1.02)]; }

  draw(out: Uint8ClampedArray, e: OutdoorEnv): void {
    const a = e.air, t = e.t, dt = e.dt, D = this.D, ID = this.ids, hz = D.horizon;
    const [top, hor] = skyColours(a.sunAlt, a.cloud), day = a.daylight, dusk = clamp(1 - Math.abs(a.sunAlt - 2) / 9) * (1 - a.cloud * 0.6);
    const [sx, sy] = this.onScreen(a.sunAlt, a.sunAz), [mx, my] = this.onScreen(e.moon.alt, e.moon.az), sunUp = a.sunAlt > -1, moonUp = e.moon.alt > 0 && day < 0.6;
    const sunCol: V3 = mix3([255, 170, 90], [255, 248, 225], clamp(a.sunAlt / 20)), drift = t * (2.5 + a.wind * 9);
    const cloudLit = mix3([34, 38, 54], mix3([238, 236, 230], [252, 186, 140], clamp(1 - Math.abs(a.sunAlt - 3) / 10)), clamp((a.sunAlt + 6) / 14));
    const moonLight = moonUp ? (1 - Math.abs(e.moon.phase - 0.5) * 2) * clamp(e.moon.alt / 20) * (1 - a.cloud) : 0;
    const level = 0.09 + 0.98 * day * (0.94 + 0.1 * (1 - a.cloud)) + moonLight * 0.08, ambC = mix3(mix3([1, 1, 1], [0.96, 0.97, 1], a.cloud), [1, 0.8, 0.66], dusk * 0.55);
    const night: V3 = [0.05, 0.06, 0.11], lampOn = day < 0.32 || (a.rain > 0 && day < 0.55), [lx, ly] = D.lamp.at as [number, number], [px, py] = D.lamp.pool as [number, number];
    const lampK = lampOn ? 0.92 + 0.08 * noise(t * 7, 1) : 0;
    for (let i = 0; i < N; i++) { const id = this.rid[i]!, x = i % W, y = (i / W) | 0;
      if (id === ID.sky) { // ---- the sky
        const v = clamp(y / hz); let c = mix3(top, hor, v ** 0.85);
        const ds = Math.hypot(x - sx, y - sy), dm = Math.hypot(x - mx, y - my);
        if (sunUp) { const g = Math.exp(-ds / 22) * 0.55 + Math.exp(-ds / 70) * 0.25; c = mix3(c, sunCol, g * (1 - a.cloud * 0.55)); }
        if (day < 0.25 && a.cloud < 0.6 && hash2(x, y) > 0.9965) { const tw = 0.6 + 0.4 * Math.sin(t * 3 + x * 7 + y); c = mix3(c, [230, 232, 245], (1 - day * 4) * tw * (1 - a.cloud)); }
        if (moonUp && dm < 18) c = mix3(c, [200, 206, 225], Math.exp(-dm / 7) * 0.35 * (1 - a.cloud * 0.7));
        // clouds: wider and flatter towards the horizon, drifting with the wind
        const sc = 1 + 2.2 * v * v, n = fbm((x + drift) * 0.011 * sc, y * 0.034 * (1 + v) + 5.3), cov = clamp((n - (1 - a.cloud) * 0.82 + 0.1) / 0.2);
        let sunDisc = 0, moonDisc = 0;
        if (sunUp && ds < 5.5) sunDisc = clamp(5.5 - ds);
        if (moonUp && dm < 4.5) { const u = (x - mx) / 4.5, k = Math.cos(e.moon.phase * 2 * Math.PI); moonDisc = clamp(4.5 - dm) * ((e.moon.phase < 0.5 ? u > k * Math.sqrt(Math.max(0, 1 - ((y - my) / 4.5) ** 2)) : u < -k * Math.sqrt(Math.max(0, 1 - ((y - my) / 4.5) ** 2))) ? 1 : 0.12); }
        if (sunDisc > 0) c = mix3(c, [255, 252, 238], sunDisc * (1 - cov * 0.9));
        if (moonDisc > 0) c = mix3(c, [238, 238, 226], moonDisc * (1 - cov * 0.9));
        if (cov > 0) { const under = clamp((n - 0.45) * 2.4), shade = mix3(cloudLit, [cloudLit[0] * 0.6, cloudLit[1] * 0.62, cloudLit[2] * 0.7], under * (0.4 + a.cloud * 0.6));
          const rim = sunUp ? Math.exp(-ds / 30) * 0.6 * (1 - under) : 0; c = mix3(c, mix3(shade, sunCol, rim), cov * (0.6 + 0.4 * a.cloud)); }
        this.lit[i * 3] = c[0]; this.lit[i * 3 + 1] = c[1]; this.lit[i * 3 + 2] = c[2]; continue; }
      // ---- the ground and the buildings
      let r = night[0] + level * ambC[0], g = night[1] + level * ambC[1], b = night[2] + level * ambC[2];
      if (lampK > 0) { const d2 = (x - lx) ** 2 + (y - ly) ** 2, ground = id === ID.lawn || id === ID.path || id === ID.road; let k = 0.5 / (1 + d2 / 700);
        if (ground) { const ex = (x - px) / 58, ey = (y - py) / 16; k += 1.1 * Math.exp(-(ex * ex + ey * ey) * 1.6); } k *= lampK; r += k; g += k * 0.78; b += k * 0.5; }
      let ar = this.alb[i * 3]!, ag = this.alb[i * 3 + 1]!, ab = this.alb[i * 3 + 2]!;
      if (id === ID.far) { const f = clamp(0.25 + a.rain * 0.4 + a.snow * 0.45 + (1 - day) * 0.1); ar = lerp(ar, hor[0] / Math.max(0.15, level), f); ag = lerp(ag, hor[1] / Math.max(0.15, level), f); ab = lerp(ab, hor[2] / Math.max(0.15, level), f); }
      if (e.snowCover > 0 && (id === ID.roof || id === ID.lawn || (id === ID.path && e.snowCover > 0.5))) { const s2 = clamp(e.snowCover * (0.7 + 0.45 * (noise(x * 0.08, y * 0.2) - 0.5)) * (id === ID.path ? 0.6 : 1)) * (id === ID.roof ? 0.85 : 1); ar = lerp(ar, 232, s2); ag = lerp(ag, 236, s2); ab = lerp(ab, 244, s2); }
      if (e.wet > 0 && (id === ID.road || id === ID.path)) { const k = 1 - 0.3 * e.wet; ar *= k; ag *= k; ab *= k; }
      let cr = ar * r, cg = ag * g, cb = ab * b;
      if (id === ID.glass) { // panes: the sky in them by day, the lamplight behind them at night (warmer low in the pane)
        const refl = clamp(0.28 * day); cr = lerp(cr, hor[0], refl); cg = lerp(cg, hor[1], refl); cb = lerp(cb, hor[2], refl);
        if (e.houseLit && day < 0.5 && x < 290) { const k = (1 - day * 2) * (0.84 + 0.04 * noise(t * 1.5, x * 0.05)) * (0.88 + 0.12 * clamp((y - 100) / 40)); cr = lerp(cr, 238, k); cg = lerp(cg, 176, k); cb = lerp(cb, 96, k); } }
      if (id === ID.lantern && lampK > 0) { cr = lerp(cr, 255, 0.85); cg = lerp(cg, 226, 0.85); cb = lerp(cb, 160, 0.85); }
      this.lit[i * 3] = cr; this.lit[i * 3 + 1] = cg; this.lit[i * 3 + 2] = cb; }
    this.tree(t, a.wind);
    if (e.wet > 0) this.puddles(e);
    if (lampK > 0) this.glow(lx, ly, lampK);
    this.chimney(e);
    this.birds(e);
    this.weather(e);
    for (let i = 0; i < N; i++) { out[i * 4] = Math.min(255, Math.max(0, this.lit[i * 3]!)); out[i * 4 + 1] = Math.min(255, Math.max(0, this.lit[i * 3 + 1]!)); out[i * 4 + 2] = Math.min(255, Math.max(0, this.lit[i * 3 + 2]!)); out[i * 4 + 3] = 255; }
  }

  /** the tree's leaves stir: each clump moves a little on its own, the crown more than the boughs, the trunk not at all */
  private tree(t: number, wind: number) { const id = this.ids.tree!, amp = 0.5 + 2 * wind, src = this.lit.slice(0, 200 * W * 3);
    for (let y = 0; y < 190; y++) for (let x = 0; x < 110; x++) { const i = y * W + x; if (this.rid[i] !== id) continue;
      const w = clamp((150 - y) / 90), dx = Math.round(amp * w * (noise(x * 0.09 + t * 0.7, y * 0.09) - 0.5) * 2.4 + amp * w * 0.4 * Math.sin(t * 0.8)), dy = Math.round(amp * w * 0.4 * (noise(x * 0.09, y * 0.09 + t * 0.6) - 0.5) * 2);
      if (!dx && !dy) continue; const sx = Math.min(W - 1, Math.max(0, x - dx)), sy = Math.min(H - 1, Math.max(0, y - dy)), j = sy * W + sx; if (this.rid[j] !== id) continue;
      this.lit[i * 3] = src[j * 3]!; this.lit[i * 3 + 1] = src[j * 3 + 1]!; this.lit[i * 3 + 2] = src[j * 3 + 2]!; } }

  /** a wet road shows what stands above it, broken by the rain */
  private puddles(e: OutdoorEnv) { const top = this.roadTop, road = this.ids.road!, path = this.ids.path!, t = e.t;
    for (let y = top; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, id = this.rid[i]; if (id !== road && id !== path) continue;
      const my = 2 * top - y - 2; if (my < 0) continue; const jit = e.air.rain > 0 ? Math.round(Math.sin(y * 1.7 + t * 9) * 1.2) : 0, j = my * W + Math.min(W - 1, Math.max(0, x + jit));
      const k = e.wet * (id === road ? 0.32 : 0.18) * clamp(1 - (y - top) / 60) * (0.6 + 0.4 * noise(x * 0.05, y * 0.3));
      this.lit[i * 3] = lerp(this.lit[i * 3]!, this.lit[j * 3]!, k); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, this.lit[j * 3 + 1]!, k); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, this.lit[j * 3 + 2]!, k); } }

  /** the street lamp's glow in the air */
  private glow(lx: number, ly: number, k: number) { for (let y = ly - 26; y < ly + 26; y++) for (let x = lx - 26; x < lx + 26; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const d2 = (x - lx) ** 2 + (y - ly) ** 2, w = k * 0.5 * Math.exp(-d2 / 90), i = y * W + x;
    this.lit[i * 3] = this.lit[i * 3]! + w * 255; this.lit[i * 3 + 1] = this.lit[i * 3 + 1]! + w * 210; this.lit[i * 3 + 2] = this.lit[i * 3 + 2]! + w * 140; } }

  /** a soft round spot of colour */
  private dab(cx: number, cy: number, r: number, c: V3, a: number) { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const w = a * clamp(1 - Math.hypot(x - cx, y - cy) / (r + 0.5)); if (w <= 0) continue; const i = y * W + x;
    this.lit[i * 3] = lerp(this.lit[i * 3]!, c[0], w); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, c[1], w); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, c[2], w); } }

  /** smoke from the chimney when it is cold enough for a fire */
  private chimney(e: OutdoorEnv) { const a = e.air, [cx, cy] = this.D.chimney as [number, number], lv = 0.15 + 0.85 * a.daylight;
    if (a.temp < 12 && Math.random() < e.dt * 5) this.smoke.push({ x: cx + (Math.random() - 0.5) * 3, y: cy, age: 0, life: 4 + Math.random() * 3, s: 1 });
    for (const p of this.smoke) { p.age += e.dt; p.y -= e.dt * (7 - p.age * 0.8); p.x += e.dt * (2 + a.wind * 14) * (0.4 + p.age * 0.3) + Math.sin(e.t + p.age) * e.dt * 1.5; p.s = 1 + p.age * 1.3; }
    this.smoke = this.smoke.filter(p => p.age < p.life);
    for (const p of this.smoke) this.dab(p.x, p.y, p.s, [168 * lv + 10, 166 * lv + 10, 170 * lv + 14], 0.32 * (1 - p.age / p.life) * Math.min(1, p.age * 2)); }

  /** a bird across the sky now and then */
  private birds(e: OutdoorEnv) { const B = this.bird, a = e.air; if (B.x < 0) { B.wait -= e.dt; if (B.wait <= 0 && a.daylight > 0.5 && a.rain === 0 && a.snow === 0) { B.dir = Math.random() < 0.5 ? 1 : -1; B.x = B.dir > 0 ? -4 : W + 4; B.y = 14 + Math.random() * 60; } return; }
    B.x += B.dir * e.dt * 34; B.y += Math.sin(e.t * 2) * e.dt * 3; if (B.x < -6 || B.x > W + 6) { B.x = -1; B.wait = 10 + Math.random() * 20; return; }
    const flap = Math.sin(e.t * 13) > 0, x = Math.round(B.x), y = Math.round(B.y); for (const [dx, dy] of [[0, 0], [-1, flap ? -1 : 0], [1, flap ? -1 : 0], [-2, flap ? -1 : 1], [2, flap ? -1 : 1]] as const) { const i = (y + dy) * W + x + dx; if (i >= 0 && i < N && this.rid[i] === this.ids.sky) { this.lit[i * 3] = 46; this.lit[i * 3 + 1] = 44; this.lit[i * 3 + 2] = 48; } } }

  /** rain and snow falling over everything */
  private weather(e: OutdoorEnv) { const a = e.air, lv = 0.3 + 0.7 * a.daylight;
    if (a.rain > 0) for (let k = 0; k < 4; k++) if (Math.random() < e.dt * 70 * a.rain) this.fall.push({ x: Math.random() * (W + 60), y: -6, v: 260 + Math.random() * 90, snow: false });
    if (a.snow > 0) for (let k = 0; k < 2; k++) if (Math.random() < e.dt * 40 * a.snow) this.fall.push({ x: Math.random() * (W + 40), y: -3, v: 16 + Math.random() * 14, snow: true });
    for (const q of this.fall) { q.y += q.v * e.dt; q.x += q.snow ? Math.sin(e.t * 1.3 + q.v) * e.dt * 6 - a.wind * e.dt * 14 : -q.v * e.dt * (0.12 + a.wind * 0.3); }
    this.fall = this.fall.filter(q => q.y < H && q.x > -40);
    for (const q of this.fall) { if (q.snow) this.dab(q.x, q.y, 0.6, [240 * lv, 242 * lv, 248 * lv], 0.9);
      else for (let j = 0; j < 6; j++) { const x = Math.round(q.x + j * (0.12 + a.wind * 0.3)), y = Math.round(q.y - j); if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = y * W + x, w = 0.2 - j * 0.025; this.lit[i * 3] = lerp(this.lit[i * 3]!, 200 * lv, w); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, 210 * lv, w); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, 226 * lv, w); } } }
}
