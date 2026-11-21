// A room lit by the game, not by the painter (review 42). The reference picture is taken apart beforehand
// (tools/places/<room>.py): the room under even light (base), the lamp on its own, the far fields seen through the
// window, and a map of what every pixel is (regions). Each frame the room is lit again from what is true now:
// - the sky through the window (its light falls on the floor and the table near it; the wall beside it is brighter)
// - the sun: a ray from each floor or table pixel towards the sun, through the window's glass (the bars cast their
//   shadows, the table shades the floor under it), so the patch walks across the room through the day and is gone
//   under cloud
// - the hanging lamp: a point under its shade, the light falling downwards, weaker with distance, the table's shadow
//   on the floor; it swings a little, and the light moves with it
// - the gas ring's flame under the kettle
// and the room's own life is drawn over it: the view out (sky, clouds, birds, rain, the farmhouse's lamp at night), the
// glass (drops running down it, steam fogging it, the room reflected at night), the lower sash going up, the curtains
// stirring, steam from the kettle (its lid rattling at the boil), dust turning in the light, the tap dripping.
// The picture is put out in 15-bit colour (32 levels a channel, as the consoles of the 90s) with an ordered dither, so
// the light comes in pixel steps, not smears.
import type { Air } from '../../core/atmosphere';

export const W = 480, H = 270;
const N = W * H;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - 0.5);
type V3 = [number, number, number];
interface Plane { n: 'v' | 'h'; z?: number; Y?: number; ys?: number[]; zs?: number[] }
export interface RoomData {
  window: { glass: number[]; muntinX: number[]; railY: number[]; sill: number; horizon: number; curtains: number[][]; open: number; houseLight: number[] };
  regionId: Record<string, number>; planes: Record<string, Plane>;
  table: { x: number[]; Y: number[]; z: number[] };
  lamp: { pivot: number[]; Y: number; z: number; reach: number; colour: number[]; power: number };
  burner: { at: number[]; z: number; flame: number[] }; kettle: { spout: number[]; lid: number[] }; faucet: number[]; basin: number;
}
export interface Pics { base: Uint8ClampedArray; lamp: Uint8ClampedArray; far: Uint8ClampedArray; regions: Uint8ClampedArray }
export interface RoomEnv {
  /** real seconds (animation) */ t: number; dt: number;
  air: Air; minute: number;
  /** 0..1, the lamp's filament */ lamp: number;
  window: number; burner: boolean; kettle: number; fog: number;
  /** a thing under the pointer: region names, or 'lamp' */ highlight: string[] | null;
}
interface Puff { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; a: number }
interface Drop { x: number; y: number; v: number; wait: number; trail: number }

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function hash2(x: number, y: number): number { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x: number, y: number): number { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v); }
const tone = (v: number) => (v <= 0.9 ? v : 0.9 + (v - 0.9) / (1 + (v - 0.9) * 2));
const fbm = (x: number, y: number) => noise(x, y) * 0.55 + noise(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + noise(x * 4.3 + 1, y * 4.3 + 9) * 0.15;

/** the sky's colours by the sun's height: [top, horizon] */
function skyColours(alt: number, cloud: number): [V3, V3] {
  const keys: [number, V3, V3][] = [[-18, [8, 11, 24], [16, 20, 38]], [-8, [22, 30, 62], [60, 58, 92]], [-2, [52, 66, 120], [196, 120, 92]], [3, [92, 122, 186], [240, 168, 104]], [12, [104, 148, 214], [226, 206, 170]], [30, [96, 146, 222], [192, 212, 232]]];
  let top = keys[0]![1], hor = keys[0]![2];
  for (let k = 0; k < keys.length - 1; k++) { const [a0, t0, h0] = keys[k]!, [a1, t1, h1] = keys[k + 1]!; if (alt >= a0) { const f = clamp((alt - a0) / (a1 - a0)); top = mix3(t0, t1, f); hor = mix3(h0, h1, f); } }
  const grey = 0.08 + 0.92 * clamp((alt + 8) / 20), g: V3 = [150 * grey + 8, 154 * grey + 10, 160 * grey + 16];
  return [mix3(top, g, cloud * 0.85), mix3(hor, mix3(g, [g[0] * 1.08, g[1] * 1.05, g[2]], 0.5), cloud * 0.8)];
}

export class Room {
  private alb = new Float32Array(N * 3); private lit = new Float32Array(N * 3); private lum = new Float32Array(N);
  private X = new Float32Array(N); private Y = new Float32Array(N); private Z = new Float32Array(N); private hor = new Uint8Array(N); private rid = new Uint8Array(N);
  private prox = new Float32Array(N); private winSky = new Float32Array(N);
  private lampPx: { x: number; y: number; c: V3; glow: boolean }[] = [];
  private far = new Float32Array(N * 4);
  private ids: Record<string, number>;
  private puffs: Puff[] = []; private drops: Drop[] = []; private streaks: { x: number; y: number; v: number; snow: boolean }[] = [];
  private motes: { x: number; y: number; z: number; ph: number }[] = [];
  private drip = { y: -1, wait: 3, splash: 0 }; private bird = { x: -1, y: 0, wait: 8, dir: 1 };
  private rattle = 0; private sway = 0;
  /** what the room asks the sound to do this frame (the scene plays it) */
  sounds: string[] = [];

  constructor(private D: RoomData, p: Pics) {
    this.ids = D.regionId;
    const [gx0, gy0, gx1] = D.window.glass as [number, number, number, number], wc: V3 = [(gx0 + gx1) / 2, (gy0 + D.window.sill) / 2, -12];
    for (let i = 0; i < N; i++) { const x = i % W, y = (i / W) | 0, id = p.regions[i * 4]!, pl = D.planes[String(id)] ?? { n: 'v', z: 0 };
      this.rid[i] = id; this.alb[i * 3] = p.base[i * 4]!; this.alb[i * 3 + 1] = p.base[i * 4 + 1]!; this.alb[i * 3 + 2] = p.base[i * 4 + 2]!;
      const map = (r: number[] | undefined, v: number) => (r ? lerp(r[1]!, r[3]!, clamp((v - r[0]!) / (r[2]! - r[0]!))) : v);
      this.X[i] = x; if (pl.n === 'h') { this.hor[i] = 1; this.Y[i] = pl.Y!; this.Z[i] = map(pl.zs, y); } else { this.Y[i] = map(pl.ys, y); this.Z[i] = pl.z ?? 0; }
      this.prox[i] = Math.exp(-((x - wc[0]) ** 2 + (y - wc[1]) ** 2 * 1.4) / (2 * 110 * 110));
      const vx = wc[0] - x, vy = wc[1] - this.Y[i]!, vz = wc[2] - this.Z[i]!, d = Math.hypot(vx, vy, vz), ndl = this.hor[i] ? -vy / d : vz / d, cw = (this.Z[i]! - wc[2]) / d;
      this.winSky[i] = Math.max(0, ndl) * Math.max(0, cw) / (1 + (d / 120) ** 2);
      if (p.far[i * 4 + 3]! > 0) { this.far[i * 4] = p.far[i * 4]!; this.far[i * 4 + 1] = p.far[i * 4 + 1]!; this.far[i * 4 + 2] = p.far[i * 4 + 2]!; this.far[i * 4 + 3] = 1; }
      if (p.lamp[i * 4 + 3]! > 0) { const c: V3 = [p.lamp[i * 4]!, p.lamp[i * 4 + 1]!, p.lamp[i * 4 + 2]!]; this.lampPx.push({ x, y, c, glow: y > D.lamp.Y - 18 && (c[0] + c[1] + c[2]) / 3 > 150 }); } }
    for (let k = 0; k < 60; k++) this.motes.push({ x: 30 + Math.random() * 330, y: 40 + Math.random() * 210, z: Math.random() * 260, ph: Math.random() * 9 });
  }

  /** a region's id, for the scene's spots */
  id(name: string): number { return this.ids[name] ?? -1; }

  /** where the open sash is, in pixels */
  private open(e: RoomEnv) { return Math.round(clamp(e.window) * this.D.window.open); }

  /** is the point lit by the sun through the window? */
  private sunlit(x: number, y: number, z: number, s: V3, k: number): boolean {
    if (s[2] >= -0.02) return false; const D = this.D, [g0, gy0, g1] = D.window.glass as [number, number, number], sill = D.window.sill;
    const t = -z / s[2], hx = x + t * s[0], hy = y + t * s[1];
    if (hx < g0 || hx >= g1 || hy < gy0 || hy >= sill) return false;
    const [m0, m1] = D.window.muntinX as [number, number], [r0, r1] = D.window.railY as [number, number], gap = sill - k;
    if (hy < gap) { if (hx >= m0 && hx < m1) return false; if (hy >= r0 && hy < r1) return false; if (k > 0 && ((hy >= r0 - k && hy < r1 - k) || hy >= gap - 3)) return false; }
    const T = D.table; if (y > T.Y[1]! && s[1] < 0) { const tt = (T.Y[0]! - y) / s[1]; if (tt > 0 && tt < t) { const tx = x + tt * s[0], tz = z + tt * s[2]; if (tx >= T.x[0]! && tx <= T.x[1]! && tz >= T.z[0]! && tz <= T.z[1]!) return false; } }
    return true;
  }

  draw(out: Uint8ClampedArray, e: RoomEnv): void {
    const D = this.D, a = e.air, t = e.t, k = this.open(e); this.sounds = [];
    // ---- the light, worked out once a frame
    const altR = a.sunAlt * Math.PI / 180, azR = a.sunAz * Math.PI / 180;
    const s: V3 = [-Math.cos(altR) * Math.sin(azR), -Math.sin(altR), Math.cos(altR) * Math.cos(azR)];
    const sunI = clamp(Math.sin(altR) * 4) * (1 - a.cloud) ** 1.6 * 1.5, sunC = mix3([1, 0.55, 0.32], [1, 0.95, 0.86], clamp(a.sunAlt / 25));
    const day = a.daylight, dusk = clamp(1 - Math.abs(a.sunAlt - 2) / 9) * (1 - a.cloud * 0.7);
    const ambC = mix3(mix3([0.98, 0.98, 1.0], [0.9, 0.92, 0.96], a.cloud), [1, 0.82, 0.68], dusk * 0.6);
    const amb = day * (0.66 - 0.12 * a.cloud), night: V3 = [0.045, 0.055, 0.1];
    const L = D.lamp, ang = 0.011 * Math.sin(t * 1.9) + 0.006 * Math.sin(t * 0.53 + 1) + e.window * a.wind * 0.05 * Math.sin(t * 2.6) * (0.6 + 0.4 * Math.sin(t * 0.7));
    this.sway = ang; const len = L.Y - L.pivot[1]!, bx = L.pivot[0]! + Math.sin(ang) * len, by = L.pivot[1]! + Math.cos(ang) * len, bz = L.z;
    const flick = 1 + 0.018 * (noise(t * 9, 3) - 0.5) * 2, lampI = e.lamp * L.power * flick, lc = L.colour as V3;
    const B = D.burner, fl = e.burner ? 0.45 * (0.8 + 0.4 * noise(t * 14, 5)) : 0, T = D.table;
    const glassId = this.ids.glass!, wallId = this.ids.wall!, floorId = this.ids.floor!, legsId = this.ids.legs!;
    for (let i = 0; i < N; i++) { const id = this.rid[i]!; if (id === glassId) continue;
      const x = this.X[i]!, y = this.Y[i]!, z = this.Z[i]!, h = this.hor[i]!;
      let r = night[0] + ambC[0] * amb * (0.62 + 0.38 * this.prox[i]!), g = night[1] + ambC[1] * amb * (0.62 + 0.38 * this.prox[i]!), b = night[2] + ambC[2] * amb * (0.62 + 0.38 * this.prox[i]!);
      const ws = this.winSky[i]! * day * 1.5; r += ws * ambC[0]; g += ws * ambC[1]; b += ws * ambC[2];
      if (lampI > 0) { const vx = bx - x, vy = by - y, vz = bz - z, d = Math.sqrt(vx * vx + vy * vy + vz * vz), ndl = h ? -vy / d : id === wallId ? vz / d : (vz / d + 0.3) / 1.3, down = -vy / d;
        let e1 = Math.max(0, ndl) * clamp((down + 0.12) / 0.42) / (1 + (d / L.reach) ** 2) + (vy > 0 ? 0.05 / (1 + (d / 90) ** 2) : 0);
        if ((id === floorId || id === legsId) && y > T.Y[1]!) { const tt = (T.Y[0]! - y) / (by - y), tx = x + tt * (bx - x), tz = z + tt * (bz - z); if (tx >= T.x[0]! && tx <= T.x[1]! && tz >= T.z[0]! && tz <= T.z[1]!) e1 *= 0.16; }
        e1 = (e1 + 0.17 / (1 + (d / 210) ** 2)) * lampI; r += e1 * lc[0]; g += e1 * lc[1]; b += e1 * lc[2]; }   // and what comes back off the walls and the ceiling
      if (sunI > 0 && h && this.sunlit(x, y, z, s, k)) { const e2 = sunI * (0.45 + 0.9 * Math.max(0, -s[1])); r += e2 * sunC[0]; g += e2 * sunC[1]; b += e2 * sunC[2]; }
      if (fl > 0) { const vx = B.at[0]! - x, vy = B.at[1]! - y, vz = B.z - z, d2 = vx * vx + vy * vy * 2 + vz * vz; if (d2 < 2500) { const e3 = fl / (1 + d2 / 120); r += e3; g += e3 * 0.62; b += e3 * 0.5; } }
      const tr = tone(r), tg = tone(g), tb = tone(b);
      this.lit[i * 3] = this.alb[i * 3]! * tr; this.lit[i * 3 + 1] = this.alb[i * 3 + 1]! * tg; this.lit[i * 3 + 2] = this.alb[i * 3 + 2]! * tb; this.lum[i] = (tr + tg + tb) / 3; }
    this.window(e, k, s, sunI, ambC, lampI);
    this.curtains(e);
    this.kettle(e);
    this.lampSprite(e, ang, amb, ambC, lampI);
    this.dust(e, s, sunI, sunC, bx, by, bz, lampI, k);
    this.tap(e);
    if (e.highlight) this.highlight(e.highlight, ang);
    // ---- out, in 15-bit colour
    for (let i = 0; i < N; i++) { const x = i % W, y = (i / W) | 0, th = BAYER[(y & 3) * 4 + (x & 3)]! * 8;
      out[i * 4] = Math.min(255, Math.max(0, Math.round((this.lit[i * 3]! + th) / 8) * 8)); out[i * 4 + 1] = Math.min(255, Math.max(0, Math.round((this.lit[i * 3 + 1]! + th) / 8) * 8));
      out[i * 4 + 2] = Math.min(255, Math.max(0, Math.round((this.lit[i * 3 + 2]! + th) / 8) * 8)); out[i * 4 + 3] = 255; }
  }

  // ---- the window: the view out, the glass, the sash
  private window(e: RoomEnv, k: number, _s: V3, sunI: number, ambC: V3, lampI: number) {
    const D = this.D, a = e.air, t = e.t, dt = e.dt, [gx0, gy0, gx1] = D.window.glass as [number, number, number], sill = D.window.sill, hz = D.window.horizon;
    const [top, hor] = skyColours(a.sunAlt, a.cloud), outL = (0.07 + 0.93 * a.daylight) * (1 - 0.35 * a.cloud), haze = clamp(a.rain * 0.5 + a.snow * 0.55);
    const cloudLit = mix3([40, 44, 60], mix3([236, 234, 228], [250, 190, 140], clamp(1 - Math.abs(a.sunAlt - 3) / 10)), clamp((a.sunAlt + 6) / 14));
    const [m0, m1] = D.window.muntinX as [number, number], [r0, r1] = D.window.railY as [number, number], gap = sill - k, rail2 = gap - 3;
    // the bird, now and then, across the sky
    const B = this.bird; if (B.x < 0) { B.wait -= dt; if (B.wait <= 0 && a.daylight > 0.6 && a.rain === 0 && a.snow === 0) { B.dir = Math.random() < 0.5 ? 1 : -1; B.x = B.dir > 0 ? gx0 - 2 : gx1 + 2; B.y = gy0 + 6 + Math.random() * 26; } } else { B.x += B.dir * dt * 22; B.y += Math.sin(t * 3) * dt * 2; if (B.x < gx0 - 4 || B.x > gx1 + 4) { B.x = -1; B.wait = 12 + Math.random() * 25; } }
    // the rain beyond the glass
    if (a.rain > 0 && Math.random() < dt * 90 * a.rain) this.streaks.push({ x: gx0 + Math.random() * (gx1 - gx0 + 30), y: gy0 - 4, v: 130 + Math.random() * 70, snow: false });
    if (a.snow > 0 && Math.random() < dt * 30 * a.snow) this.streaks.push({ x: gx0 + Math.random() * (gx1 - gx0 + 20), y: gy0 - 2, v: 10 + Math.random() * 10, snow: true });
    for (const q of this.streaks) { q.y += q.v * dt; q.x += q.snow ? Math.sin(t * 1.3 + q.v) * dt * 4 - a.wind * dt * 6 : -q.v * dt * (0.15 + a.wind * 0.35); } this.streaks = this.streaks.filter(q => q.y < sill + 2 && q.x > gx0 - 30);
    const frameAt = (x: number, y: number): number => { // the base picture's pixel for a bar of the frame, or -1
      if (y < r0 && x >= m0 && x < m1) return y * W + x; if (y >= r0 && y < r1) return y * W + x;
      if (k === 0) return x >= m0 && x < m1 ? y * W + x : -1;
      if (y >= r0 - k && y < r1 - k) return (y + k) * W + x;                       // the lower sash's top rail, raised
      if (y >= rail2 && y < gap) return (r0 + (y - rail2)) * W + x;                 // its bottom rail
      if (x >= m0 && x < m1 && y < rail2) return Math.min(sill - 1, y + k) * W + x; // its bar
      return -1; };
    const refl = lampI * 0.13 * (1 - a.daylight * 0.9), fogL = this.lum[(sill + 8) * W + ((gx0 + gx1) >> 1)]!, fogC: V3 = [196 * fogL, 190 * fogL, 176 * fogL];
    for (let y = gy0; y < sill; y++) for (let x = gx0; x < gx1; x++) { const i = y * W + x, f = frameAt(x, y);
      if (f >= 0) { if (f !== i) { const l = this.lum[f]!; this.lit[i * 3] = this.alb[f * 3]! * l; this.lit[i * 3 + 1] = this.alb[f * 3 + 1]! * l; this.lit[i * 3 + 2] = this.alb[f * 3 + 2]! * l; } continue; }
      // the view
      const v = clamp((y - gy0) / (hz - gy0)); let c = mix3(top, hor, v ** 0.8);
      const n = fbm((x + t * (1.5 + a.wind * 5)) * 0.05, y * 0.13 + 3.1), cov = clamp((n - (1 - a.cloud) * 0.85 + 0.12) / 0.22);
      if (cov > 0) c = mix3(c, mix3(cloudLit, [cloudLit[0] * 0.62, cloudLit[1] * 0.64, cloudLit[2] * 0.7], clamp((n - 0.4) * 2.2) * a.cloud), cov * (0.55 + 0.45 * a.cloud));
      if (this.far[i * 4 + 3]) { const fc: V3 = [this.far[i * 4]! * outL * ambC[0], this.far[i * 4 + 1]! * outL * ambC[1], this.far[i * 4 + 2]! * outL * ambC[2]]; c = mix3(fc, hor, haze * 0.7 + (1 - a.daylight) * 0.15); }
      if (sunI > 0 && !this.far[i * 4 + 3]) c = mix3(c, [255, 250, 235], sunI * 0.04);
      // the bird
      if (B.x >= 0) { const bxp = Math.round(B.x), byp = Math.round(B.y), flap = Math.sin(t * 14) > 0; if ((x === bxp && y === byp) || (y === byp - (flap ? 1 : 0) && Math.abs(x - bxp) === 1)) c = [40, 38, 40]; }
      // inside the glass
      const lower = y >= r1 - k && y < rail2, upper = y < r0, inOpen = k > 0 && y >= gap;
      if (!inOpen) { const dbl = upper && lower ? 0.86 : 0.94; c = [c[0] * dbl + refl * 255, c[1] * dbl + refl * 190, c[2] * dbl + refl * 120];
        if (e.fog > 0) { const fogA = e.fog * (0.55 + 0.25 * noise(x * 0.3, y * 0.2)) * clamp((y - gy0) / 30 + 0.3); c = mix3(c, fogC, clamp(fogA)); } }
      this.lit[i * 3] = c[0]; this.lit[i * 3 + 1] = c[1]; this.lit[i * 3 + 2] = c[2]; this.lum[i] = outL; }
    // rain and snow beyond the glass (drawn on the view; the bars stand in front)
    const lit = 0.25 + 0.75 * a.daylight;
    for (const q of this.streaks) { if (!q.snow) for (let j = 0; j < 4; j++) this.paint(q.x + j * 0.3, q.y - j, [200 * lit, 210 * lit, 225 * lit], 0.22 - j * 0.04, (x, y) => frameAt(x, y) < 0); else this.paint(q.x, q.y, [245 * lit, 245 * lit, 250 * lit], 0.8, (x, y) => frameAt(x, y) < 0); }
    // drops on the glass: they gather, wait, then run down in jerks, leaving a wet line
    if (a.rain > 0 && this.drops.length < 110) for (let n2 = 0; n2 < 1 + a.rain * 3; n2++) if (Math.random() < dt * 10 * a.rain) this.drops.push({ x: gx0 + Math.floor(Math.random() * (gx1 - gx0)), y: gy0 + Math.random() * (sill - gy0), v: 0, wait: 0.5 + Math.random() * 6, trail: 0 });
    for (const d of this.drops) { if (d.wait > 0) { d.wait -= dt; if (d.wait <= 0) d.v = 6 + Math.random() * 22; } else { d.y += d.v * dt; d.trail = Math.min(14, d.trail + d.v * dt); if (Math.random() < dt * 1.5) { d.wait = 0.2 + Math.random() * 1.2; } } }
    this.drops = this.drops.filter(d => d.y < sill - 1 && !(k > 0 && d.y >= gap - 3) && (a.rain > 0 || Math.random() > dt * 0.05));
    for (const d of this.drops) { const x = d.x, y = Math.round(d.y), i = y * W + x; if (frameAt(x, y) >= 0) continue;
      const j = Math.max(gy0, y - 3) * W + x; this.lit[i * 3] = Math.min(255, this.lit[j * 3]! * 1.25 + 18); this.lit[i * 3 + 1] = Math.min(255, this.lit[j * 3 + 1]! * 1.25 + 18); this.lit[i * 3 + 2] = Math.min(255, this.lit[j * 3 + 2]! * 1.25 + 22);
      if (y + 1 < sill && frameAt(x, y + 1) < 0) { const i2 = i + W; this.lit[i2 * 3] = this.lit[i2 * 3]! * 0.72; this.lit[i2 * 3 + 1] = this.lit[i2 * 3 + 1]! * 0.72; this.lit[i2 * 3 + 2] = this.lit[i2 * 3 + 2]! * 0.75; }
      for (let q = 1; q < d.trail; q++) { const yy = y - q; if (yy < gy0) break; const ii = yy * W + x; if (frameAt(x, yy) >= 0) continue; const w = 0.1 * (1 - q / d.trail); this.lit[ii * 3] = this.lit[ii * 3]! + w * 40; this.lit[ii * 3 + 1] = this.lit[ii * 3 + 1]! + w * 40; this.lit[ii * 3 + 2] = this.lit[ii * 3 + 2]! + w * 46; } }
    // the farmhouse's lamp after dark
    const m = e.minute, hl = D.window.houseLight as [number, number];
    if (a.daylight < 0.35 && (m > 16 * 60 + 30 && m < 22 * 60 + 30 || m > 5 * 60 && m < 7 * 60)) for (const [dx, dy] of [[0, 0], [1, 0]] as const) { const i = (hl[1] + dy) * W + hl[0] + dx; this.lit[i * 3] = 250; this.lit[i * 3 + 1] = 196; this.lit[i * 3 + 2] = 112; }
  }

  /** a soft round spot of colour, dithered so it stays in pixels */
  private paint(cx: number, cy: number, c: V3, alpha: number, ok?: (x: number, y: number) => boolean, r = 0.6, soft = false) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const d = Math.hypot(x - cx, y - cy), w = alpha * clamp(1 - d / (r + 0.5)); if (w <= 0 || (ok && !ok(x, y))) continue; if (!soft && w < 0.5 && w + BAYER[(y & 3) * 4 + (x & 3)]! < 0.25) continue;
      const i = y * W + x, ww = soft ? w : Math.min(1, w * 1.4); this.lit[i * 3] = lerp(this.lit[i * 3]!, c[0], ww); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, c[1], ww); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, c[2], ww); } }

  // ---- the curtains stir: a breath when the window is shut, more in the wind through an open one
  private curtains(e: RoomEnv) { const t = e.t, amp = 0.55 + e.window * (0.9 + 3.2 * e.air.wind);
    for (const [cx0, cy0, cx1, cy1] of this.D.window.curtains as [number, number, number, number][]) { const h = cy1 - cy0, row = new Float32Array((cx1 - cx0 + 8) * 3);
      for (let y = cy0; y < cy1; y++) { const f = ((y - cy0) / h) ** 1.6, sh = Math.round(amp * f * (Math.sin(t * 1.3 + y * 0.07) * 0.7 + Math.sin(t * 2.9 + y * 0.13) * 0.3)); if (!sh) continue;
        for (let x = cx0 - 4; x < cx1 + 4; x++) { const i = y * W + x; row[(x - cx0 + 4) * 3] = this.lit[i * 3]!; row[(x - cx0 + 4) * 3 + 1] = this.lit[i * 3 + 1]!; row[(x - cx0 + 4) * 3 + 2] = this.lit[i * 3 + 2]!; }
        for (let x = cx0 - 4; x < cx1 + 4; x++) { const sx = Math.max(cx0 - 4, Math.min(cx1 + 3, x - sh)), i = y * W + x; this.lit[i * 3] = row[(sx - cx0 + 4) * 3]!; this.lit[i * 3 + 1] = row[(sx - cx0 + 4) * 3 + 1]!; this.lit[i * 3 + 2] = row[(sx - cx0 + 4) * 3 + 2]!; } } } }

  // ---- the kettle: the flame under it, steam from spout and lid, the lid rattling at the boil
  private kettle(e: RoomEnv) { const D = this.D, dt = e.dt, t = e.t, kt = e.kettle, boil = kt >= 99;
    if (e.burner) { const [f0, f1, fy] = D.burner.flame as [number, number, number]; for (let x = f0; x <= f1; x++) { const n = noise(x * 0.7, t * 12); if (n < 0.35) continue; const i = fy * W + x;
        this.lit[i * 3] = lerp(this.lit[i * 3]!, 90, 0.8); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, 150, 0.8); this.lit[i * 3 + 2] = 255; if (n > 0.75) { const i2 = i - W; this.lit[i2 * 3] = lerp(this.lit[i2 * 3]!, 140, 0.6); this.lit[i2 * 3 + 1] = lerp(this.lit[i2 * 3 + 1]!, 190, 0.6); this.lit[i2 * 3 + 2] = lerp(this.lit[i2 * 3 + 2]!, 255, 0.6); } } }
    const rate = kt < 38 ? 0 : kt < 96 ? ((kt - 38) / 58) ** 1.5 * 6 : boil ? 26 : 12;
    const emit = (x: number, y: number, n: number, sp: number) => { for (let q = 0; q < n; q++) this.puffs.push({ x: x + (Math.random() - 0.5) * 2, y, vx: -3 - Math.random() * 4 + (boil ? -6 : 0), vy: -(sp + Math.random() * sp), age: 0, life: 1.4 + Math.random() * 2.2, size: 0.8, a: 0.3 + 0.3 * Math.min(1, kt / 100) }); };
    const [sx, sy] = D.kettle.spout as [number, number], [lx, ly] = D.kettle.lid as [number, number];
    if (Math.random() < dt * rate) emit(sx, sy, boil ? 2 : 1, boil ? 16 : 7); if (Math.random() < dt * rate * 0.25) emit(lx, ly, 1, 5);
    for (const p of this.puffs) { p.age += dt; p.x += (p.vx + Math.sin(t * 1.7 + p.y * 0.2) * 3 + this.sway * 40) * dt; p.y += p.vy * dt; p.vy *= 1 - dt * 0.35; p.vx *= 1 - dt * 0.8; p.size = 0.8 + p.age * 1.8; }
    this.puffs = this.puffs.filter(p => p.age < p.life && p.y > 2);
    for (const p of this.puffs) { const i = Math.max(0, Math.min(N - 1, Math.round(p.y) * W + Math.round(p.x))), l = Math.min(1.3, this.lum[i]! + 0.15), f = (1 - p.age / p.life);
      this.paint(p.x, p.y, [232 * l, 230 * l, 226 * l], p.a * f * Math.min(1, p.age * 4), undefined, p.size, true); }
    if (boil) { this.rattle -= dt; if (this.rattle <= 0) { this.rattle = 0.08 + Math.random() * 0.2; this.sounds.push('rattle'); }
      if (this.rattle > 0.14) { for (let y = ly - 1; y < ly + 5; y++) for (let x = lx - 8; x <= lx + 8; x++) { const i = y * W + x, j = (y + 1) * W + x; this.lit[i * 3] = this.lit[j * 3]!; this.lit[i * 3 + 1] = this.lit[j * 3 + 1]!; this.lit[i * 3 + 2] = this.lit[j * 3 + 2]!; } } } }

  // ---- the lamp: its shade drawn swinging, the underside and bulb glowing when it is on
  private lampSprite(e: RoomEnv, ang: number, amb: number, ambC: V3, lampI: number) { const py = this.D.lamp.pivot[1]!, sin = Math.sin(ang);
    for (const p of this.lampPx) { const x = p.x + Math.round(sin * (p.y - py)), i = p.y * W + x; if (x < 0 || x >= W) continue;
      let c: V3; if (p.glow) { const on = Math.min(1, e.lamp); c = mix3([p.c[0] * 0.3 + 18, p.c[1] * 0.3 + 18, p.c[2] * 0.3 + 20], [Math.min(255, p.c[0] * 1.08), Math.min(255, p.c[1] * 1.04), p.c[2] * 0.95], on); c = [c[0] * (0.4 + 0.6 * Math.max(on, amb)), c[1] * (0.4 + 0.6 * Math.max(on, amb)), c[2] * (0.4 + 0.6 * Math.max(on, amb))]; }
      else { const l = 0.05 + amb * 0.85 + lampI * 0.22; c = [p.c[0] * l * ambC[0], p.c[1] * l * ambC[1], p.c[2] * l * ambC[2]]; }
      this.lit[i * 3] = c[0]; this.lit[i * 3 + 1] = c[1]; this.lit[i * 3 + 2] = c[2]; } }

  // ---- dust turning slowly: seen only where the sun's beam or the lamp's cone lights it
  private dust(e: RoomEnv, s: V3, sunI: number, sunC: V3, bx: number, by: number, bz: number, lampI: number, k: number) { const dt = e.dt, t = e.t;
    for (const m of this.motes) { m.x += Math.sin(t * 0.31 + m.ph) * dt * 1.6; m.y += (Math.sin(t * 0.23 + m.ph * 2) * 1.2 + 0.25) * dt; m.z += Math.cos(t * 0.27 + m.ph) * dt * 2;
      if (m.y > 255) m.y = 40; const wy = m.y - m.z * 0.17;
      let b = 0; if (sunI > 0.05 && this.sunlit(m.x, wy, m.z, s, k)) b = sunI * 0.8;
      if (lampI > 0) { const d = Math.hypot(bx - m.x, by - wy, bz - m.z), down = (wy - by) / d; if (d < 110 && down > 0.25) b += lampI * 0.5 * (1 - d / 110); }
      if (b < 0.12) continue; const tw = 0.5 + 0.5 * Math.sin(t * 3 + m.ph * 5); this.paint(m.x, m.y, [255 * sunC[0], 245 * sunC[1], 220 * sunC[2]], Math.min(0.7, b * tw), undefined, 0.3); } }

  // ---- the tap: a drop now and then into the basin
  private tap(e: RoomEnv) { const d = this.drip, [fx, fy] = this.D.faucet as [number, number];
    if (d.y < 0) { d.wait -= e.dt; if (d.wait <= 0) { d.y = fy; d.wait = 4 + Math.random() * 9; } }
    else { d.y += e.dt * (20 + (d.y - fy) * 9); if (d.y >= this.D.basin) { d.y = -1; d.splash = 0.12; this.sounds.push('drip'); } else this.paint(fx, d.y, [200, 214, 226], 0.8, undefined, 0.3); }
    if (d.splash > 0) { d.splash -= e.dt; this.paint(fx - 1, this.D.basin - 1, [210, 220, 230], 0.6, undefined, 0.3); this.paint(fx + 1, this.D.basin - 1, [210, 220, 230], 0.6, undefined, 0.3); } }

  // ---- the thing under the pointer: a little brighter, with a lit edge
  private highlight(names: string[], ang: number) { const mask = new Uint8Array(N);
    if (names.includes('lamp')) { const py = this.D.lamp.pivot[1]!; for (const p of this.lampPx) { const x = p.x + Math.round(Math.sin(ang) * (p.y - py)); if (x >= 0 && x < W) mask[p.y * W + x] = 1; } }
    const ids = names.map(n => this.ids[n]).filter((v): v is number => v !== undefined); if (ids.length) for (let i = 0; i < N; i++) if (ids.includes(this.rid[i]!)) mask[i] = 1;
    for (let i = W; i < N - W; i++) { if (!mask[i]) continue; const edge = !mask[i - 1] || !mask[i + 1] || !mask[i - W] || !mask[i + W];
      if (edge) { this.lit[i * 3] = lerp(this.lit[i * 3]!, 255, 0.55); this.lit[i * 3 + 1] = lerp(this.lit[i * 3 + 1]!, 226, 0.55); this.lit[i * 3 + 2] = lerp(this.lit[i * 3 + 2]!, 150, 0.55); }
      else { this.lit[i * 3] = this.lit[i * 3]! * 1.12; this.lit[i * 3 + 1] = this.lit[i * 3 + 1]! * 1.12; this.lit[i * 3 + 2] = this.lit[i * 3 + 2]! * 1.1; } } }
}
