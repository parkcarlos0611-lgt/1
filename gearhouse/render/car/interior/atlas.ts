// The interior's sheet (docs/systems/109 section 4): the pictures laid on the cabin's simple shapes, drawn by rule into
// one cell of the style's atlas (render/live/style.ts, the cell 'interior': the atlas's lower half, twice as wide as
// high). The dials' faces come from data (render/car/interior/gauges.ts), so each car has its own red line and its own
// speedometer; the rest is the flat detail the drift games paint instead of modelling: vent slats, the radio, switches,
// the seats' pleats and stitching, the door's pleats, pedal rubbers, belts, a visor, stickers. Everything on it is made
// up for this game: no maker's badge or wordmark is copied (a wordmark is a row of plain bars).
// A region with no ground of its own is clear (alpha 0) and lets the part's colour through, so pleats and stitching
// take whatever colour the interior is trimmed in.
import { dialAngle, gaugeSet, type DialScale, type GaugeCar, type GaugeFace } from './gauges';

/** the sheet's own measure: every region is given in these units, whatever size it is drawn at */
export const SHEET = { W: 1024, H: 512 } as const;
/** the regions: x, y, width, height on the sheet (y down) */
export const REGIONS = {
  tach: [0, 0, 224, 224], speedo: [224, 0, 192, 192], dialA: [416, 0, 192, 192], dialB: [608, 0, 192, 192], dialC: [800, 0, 192, 192], lampA: [992, 0, 32, 32], lampB: [992, 32, 32, 32], banner: [224, 192, 768, 32],
  vent: [0, 224, 128, 80], console: [0, 304, 128, 80], radio: [128, 224, 192, 72], switches: [128, 296, 192, 88], padStock: [320, 224, 192, 112], hornButton: [320, 336, 48, 48], pedal: [368, 336, 48, 48], plaque: [416, 336, 96, 48],
  spokePrint: [512, 224, 160, 160], seatPleat: [672, 224, 128, 160], seatBucket: [800, 224, 112, 160], suit: [912, 224, 112, 160],
  doorPleat: [0, 384, 224, 128], visor: [224, 384, 160, 64], stickerA: [224, 448, 160, 64], stickerB: [384, 384, 192, 64], stickerC: [384, 448, 192, 64], podA: [576, 384, 128, 128], podB: [704, 384, 128, 128], podC: [832, 384, 128, 128],
} as const satisfies Record<string, readonly [number, number, number, number]>;
export type Region = keyof typeof REGIONS;
/** a region's corners on the sheet, 0..1 (u0, v0, u1, v1), a hair inside its edge so a neighbour never bleeds in */
export function regionUV(r: Region): [number, number, number, number] { const [x, y, w, h] = REGIONS[r], e = 0.75; return [(x + e) / SHEET.W, (y + e) / SHEET.H, (x + w - e) / SHEET.W, (y + h - e) / SHEET.H]; }

type RGB = readonly [number, number, number];
const WHITE: RGB = [0.93, 0.92, 0.88], FACE: RGB = [0.045, 0.045, 0.05], NEEDLE: RGB = [0.96, 0.3, 0.08], AMBER: RGB = [0.95, 0.62, 0.1], STEEL: RGB = [0.62, 0.63, 0.65], INK: RGB = [0.03, 0.03, 0.035];
// ---- a stroke alphabet: figures and capitals as strokes on a grid 4 wide and 6 high, drawn with round ends ----
const GLYPHS: Record<string, string> = {
  '0': '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0', '1': '1,5 2,6 2,0|1,0 3,0', '2': '0,5 1,6 3,6 4,5 4,4 0,0 4,0', '3': '0,5 1,6 3,6 4,5 4,4 3,3 4,2 4,1 3,0 1,0 0,1|2,3 3,3', '4': '3,0 3,6 0,2 4,2',
  '5': '4,6 0,6 0,3.5 3,3.5 4,2.5 4,1 3,0 1,0 0,1', '6': '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,2.5 3,3.5 0,3.5', '7': '0,6 4,6 1.5,0', '8': '1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3 1,3 0,2 0,1 1,0 3,0 4,1 4,2 3,3',
  '9': '0,1 1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,3.5 1,2.5 4,2.5', A: '0,0 0,4 2,6 4,4 4,0|0,2.5 4,2.5', B: '0,0 0,6 3,6 4,5 4,4 3,3 0,3|3,3 4,2 4,1 3,0 0,0', C: '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1', D: '0,0 0,6 3,6 4,5 4,1 3,0 0,0',
  E: '4,6 0,6 0,0 4,0|0,3 3,3', F: '4,6 0,6 0,0|0,3 3,3', G: '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,3 2,3', H: '0,0 0,6|4,0 4,6|0,3 4,3', I: '2,0 2,6|1,0 3,0|1,6 3,6', J: '4,6 4,1 3,0 1,0 0,1', K: '0,0 0,6|4,6 0,3 4,0', L: '0,6 0,0 4,0',
  M: '0,0 0,6 2,3 4,6 4,0', N: '0,0 0,6 4,0 4,6', O: '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0', P: '0,0 0,6 3,6 4,5 4,4 3,3 0,3', Q: '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0|2.5,1.5 4,0', R: '0,0 0,6 3,6 4,5 4,4 3,3 0,3|2,3 4,0',
  S: '4,5 3,6 1,6 0,5 0,4 1,3 3,3 4,2 4,1 3,0 1,0 0,1', T: '0,6 4,6|2,6 2,0', U: '0,6 0,1 1,0 3,0 4,1 4,6', V: '0,6 2,0 4,6', W: '0,6 1,0 2,3 3,0 4,6', X: '0,0 4,6|0,6 4,0', Y: '0,6 2,3 4,6|2,3 2,0', Z: '0,6 4,6 0,0 4,0',
  '/': '0.5,0 3.5,6', '-': '1,3 3,3', '.': '2,0 2,0.2', ':': '2,1.5 2,1.7|2,4.3 2,4.5', '+': '1,3 3,3|2,2 2,4', '*': '2,1.5 2,4.5|0.7,2.2 3.3,3.8|0.7,3.8 3.3,2.2' };
const STROKES: Record<string, number[][]> = Object.fromEntries(Object.entries(GLYPHS).map(([c, s]) => [c, s.split('|').map(l => l.split(/[ ,]/).map(Number))]));

/** a picture being drawn: straight RGBA, 0..1; shapes are laid over what is there, their edges softened by a pixel.
 *  Coordinates in the sheet's units, y down, moved by the origin set (a region's corner) and cut to the clip set */
export class SheetPaint {
  readonly d: Float32Array; private k: number; private ox = 0; private oy = 0; private clip: [number, number, number, number];
  constructor(readonly W: number, readonly H: number) { this.d = new Float32Array(W * H * 4); this.k = W / SHEET.W; this.clip = [0, 0, W, H]; }
  /** draw inside a region: the origin its corner, nothing past its edge; returns its width and height */
  into(r: Region): [number, number] { const [x, y, w, h] = REGIONS[r]; this.ox = x; this.oy = y; this.clip = [Math.round(x * this.k), Math.round(y * this.k), Math.round((x + w) * this.k), Math.round((y + h) * this.k)]; return [w, h]; }
  /** a shape by its distance (sheet units, under 0 inside) within a box */
  shape(x0: number, y0: number, x1: number, y1: number, dist: (x: number, y: number) => number, c: RGB, a = 1): this { const k = this.k, [cx0, cy0, cx1, cy1] = this.clip;
    const i0 = Math.max(cx0, Math.floor((x0 + this.ox) * k - 1)), i1 = Math.min(cx1, Math.ceil((x1 + this.ox) * k + 1)), j0 = Math.max(cy0, Math.floor((y0 + this.oy) * k - 1)), j1 = Math.min(cy1, Math.ceil((y1 + this.oy) * k + 1));
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const cov = Math.max(0, Math.min(1, 0.5 - dist((i + 0.5) / k - this.ox, (j + 0.5) / k - this.oy) * k)) * a; if (cov <= 0) continue;
      const q = (j * this.W + i) * 4, A = this.d[q + 3]!, o = cov + A * (1 - cov); for (let n = 0; n < 3; n++) this.d[q + n] = (c[n]! * cov + this.d[q + n]! * A * (1 - cov)) / o; this.d[q + 3] = o; }
    return this; }
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 1, round = 0): this { const cx = x + w / 2, cy = y + h / 2; return this.shape(x, y, x + w, y + h, (px, py) => { const dx = Math.abs(px - cx) - w / 2 + round, dy = Math.abs(py - cy) - h / 2 + round; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - round; }, c, a); }
  /** a rounded frame's line (not filled) */
  frame(x: number, y: number, w: number, h: number, t: number, c: RGB, a = 1, round = 0): this { const cx = x + w / 2, cy = y + h / 2; return this.shape(x - t, y - t, x + w + t, y + h + t, (px, py) => { const dx = Math.abs(px - cx) - w / 2 + round, dy = Math.abs(py - cy) - h / 2 + round; return Math.abs(Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - round) - t / 2; }, c, a); }
  disc(cx: number, cy: number, r: number, c: RGB, a = 1): this { return this.shape(cx - r, cy - r, cx + r, cy + r, (x, y) => Math.hypot(x - cx, y - cy) - r, c, a); }
  circle(cx: number, cy: number, r: number, t: number, c: RGB, a = 1): this { return this.shape(cx - r - t, cy - r - t, cx + r + t, cy + r + t, (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - r) - t / 2, c, a); }
  line(ax: number, ay: number, bx: number, by: number, t: number, c: RGB, a = 1): this { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    return this.shape(Math.min(ax, bx) - t, Math.min(ay, by) - t, Math.max(ax, bx) + t, Math.max(ay, by) + t, (x, y) => { const s = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); return Math.hypot(x - ax - dx * s, y - ay - dy * s) - t / 2; }, c, a); }
  /** a dashed line: stitching */
  stitch(ax: number, ay: number, bx: number, by: number, t: number, c: RGB, a = 1, dash = 5, gap = 3): this { const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / (L || 1), uy = (by - ay) / (L || 1); for (let s = 0; s < L; s += dash + gap) { const e = Math.min(L, s + dash); this.line(ax + ux * s, ay + uy * s, ax + ux * e, ay + uy * e, t, c, a); } return this; }
  /** a band of a ring between two clock angles (degrees) about a centre */
  arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, c: RGB, a = 1): this { const lo = Math.min(a0, a1), hi = Math.max(a0, a1), mid = (lo + hi) / 2, half = (hi - lo) / 2;
    return this.shape(cx - r1, cy - r1, cx + r1, cy + r1, (x, y) => { const r = Math.hypot(x - cx, y - cy); let da = Math.atan2(x - cx, cy - y) * 180 / Math.PI - mid; da = ((da + 540) % 360) - 180; return Math.max(r0 - r, r - r1, (Math.abs(da) - half) * Math.PI / 180 * r); }, c, a); }
  /** words in the stroke alphabet: `h` high about (cx, cy), `align` -1 from the left, 0 centred, 1 to the right; `turn` degrees clockwise */
  text(s: string, cx: number, cy: number, h: number, c: RGB, o: { a?: number; w?: number; align?: number; turn?: number; wide?: number } = {}): this { const u = h / 6, adv = (4 + 1.4) * u * (o.wide ?? 1), W = s.length * adv - 1.4 * u * (o.wide ?? 1), t = o.w ?? h * 0.15;
    const x0 = o.align === -1 ? 0 : o.align === 1 ? -W : -W / 2, tr = (o.turn ?? 0) * Math.PI / 180, ct = Math.cos(tr), st = Math.sin(tr), P = (x: number, y: number): [number, number] => [cx + x * ct - y * st, cy + x * st + y * ct];
    [...s.toUpperCase()].forEach((ch, i) => { for (const l of STROKES[ch] ?? []) for (let k = 0; k + 3 < l.length; k += 2) { const [ax, ay] = P(x0 + i * adv + l[k]! * u * (o.wide ?? 1), h / 2 - l[k + 1]! * u), [bx, by] = P(x0 + i * adv + l[k + 2]! * u * (o.wide ?? 1), h / 2 - l[k + 3]! * u); this.line(ax, ay, bx, by, t, c, o.a ?? 1); } });
    return this; }
  bytes(): Uint8Array { const out = new Uint8Array(this.d.length); for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.max(0, Math.min(1, this.d[i]!)) * 255); return out; }
}

const fig = (v: number) => { const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
/** a dial's face in its region (no needle: that is a part of its own) */
export function drawGauge(p: SheetPaint, f: GaugeFace): void { const [w] = p.into(f.region), c0 = w / 2, R = w / 2 * 0.985, X = (u: number) => c0 + u * R, Y = (v: number) => c0 - v * R;
  const pol = (c: [number, number], r: number, deg: number): [number, number] => { const a = deg * Math.PI / 180; return [X(c[0] + Math.sin(a) * r), Y(c[1] + Math.cos(a) * r)]; };
  p.disc(c0, c0, R, FACE).circle(c0, c0, R * 0.985, R * 0.02, [0.2, 0.2, 0.21]);
  for (const s of f.scales) { const sub = s.r < 0.5, side = !sub && Math.abs(s.a1 - s.a0) < 120, maj = (sub ? 0.07 : 0.115) , min = maj * 0.55, tw = R * (sub ? 0.018 : 0.022), ang = (v: number) => dialAngle(s, v), eps = (s.max - s.min) * 1e-6;
    for (const [band, col] of [[s.amber, AMBER], [s.red, NEEDLE]] as const) if (band) p.arc(X(s.c[0]), Y(s.c[1]), R * (s.r - maj * (sub ? 0.9 : 0.62)), R * s.r, ang(band[0]), ang(band[1]), col);
    if (s.minor) for (let v = s.min; v <= s.max + eps; v += s.minor) { const [ax, ay] = pol(s.c, s.r - min, ang(v)), [bx, by] = pol(s.c, s.r, ang(v)); p.line(ax, ay, bx, by, tw * 0.7, WHITE); }
    for (let v = s.min; v <= s.max + eps; v += s.major) { const [ax, ay] = pol(s.c, s.r - maj, ang(v)), [bx, by] = pol(s.c, s.r, ang(v)); p.line(ax, ay, bx, by, tw * 1.5, WHITE); }
    if (s.num) { const from = s.numFrom ?? s.min, big = Math.max(...[from, s.max].map(v => fig(v / (s.div ?? 1)).length)), h = R * (sub ? 0.085 : side ? 0.1 : big >= 3 ? 0.105 : 0.2);
      for (let v = from; v <= s.max + eps; v += s.num) { const t = fig(v / (s.div ?? 1)), [x, y] = pol(s.c, sub ? s.r + 0.12 : s.r - maj - h / R * (big >= 3 ? 1.15 : 0.75), ang(v)); p.text(t, x, y, h, WHITE, { w: h * 0.17 }); } }
    if (s.ends) { const h = R * 0.13; [[s.min, s.ends[0]], [s.max, s.ends[1]]].forEach(([v, t]) => { const [x, y] = pol(s.c, s.r - maj - 0.13, ang(v as number)); p.text(t as string, x, y, h, WHITE, { w: h * 0.17 }); }); }
    if (s.inner) { const r2 = s.r - maj - 0.3, h = R * 0.07; for (let v = s.inner.num; v * 1 <= s.max * s.inner.k + eps; v += s.inner.num) { const a = ang(v / s.inner.k), [ax, ay] = pol(s.c, r2, a), [bx, by] = pol(s.c, r2 + 0.035, a), [x, y] = pol(s.c, r2 - 0.075, a);
        p.line(ax, ay, bx, by, tw * 0.8, WHITE); if (Math.round(v / s.inner.num) % 2 === 0) p.text(fig(v), x, y, h, WHITE, { w: h * 0.16 }); }
      p.text(s.inner.label, X(0), Y(-0.45), R * 0.06, WHITE, { a: 0.85 }); }
    // the captions: by the scale's kind (a small dial's above its pivot, a side arc's inside its middle, a full dial's above and below its hub)
    if (sub) { if (s.unit) p.text(s.unit, X(s.c[0]), Y(s.c[1] + 0.17), R * 0.07, WHITE); p.disc(X(s.c[0]), Y(s.c[1]), R * 0.05, INK); }
    else if (side) { const mid = (s.a0 + s.a1) / 2, [x, y] = pol(s.c, s.r * 0.42, mid); if (s.unit) p.text(s.unit, x, y + R * 0.12, R * 0.07, WHITE); if (s.label) p.text(s.label, x, y - R * 0.12, R * 0.07, WHITE); }
    else { const up = f.odo ? -0.62 : 0.36; if (s.label) p.text(s.label, X(s.c[0]), Y(s.c[1] + up), R * 0.085, WHITE); if (s.unit) p.text(s.unit, X(s.c[0]), Y(s.c[1] + (f.odo ? -0.62 : s.label ? 0.22 : -0.45)), R * (f.odo ? 0.1 : 0.075), WHITE); } }
  if (f.odo) { const cell = R * 0.095, ch = R * 0.15, row = (digits: string, v: number, last: boolean) => { const W = digits.length * cell * 1.12; [...digits].forEach((d, i) => { const x = X(0) - W / 2 + i * cell * 1.12, y = Y(v) - ch / 2, inv = last && i === digits.length - 1; if (!i) p.rect(x - cell * 0.5, y - ch * 0.25, W + cell * 0.9, ch * 1.5, FACE);
        p.rect(x, y, cell, ch, inv ? WHITE : [0.13, 0.13, 0.14], 1, cell * 0.12).text(d, x + cell / 2, y + ch / 2, ch * 0.62, inv ? INK : WHITE, { w: ch * 0.1 }); }); };
    row(String(Math.floor(f.odo.total) % 1000000).padStart(6, '0'), 0.25, false); row(String(Math.floor(f.odo.trip * 10) % 10000).padStart(4, '0'), -0.25, true); }
  if (f.lamps) { const L: [number, number, RGB, string][] = [[0, 0.5, [0.3, 0.42, 0.3], 'O-O'], [0, 0.12, [0.5, 0.1, 0.08], ''], [0, -0.22, [0.5, 0.1, 0.08], '*'], [0, -0.55, [0.5, 0.1, 0.08], '+-']];
    for (const [u, v, col, t] of L) { if (t) p.text(t, X(u), Y(v), R * 0.1, col, { w: R * 0.02 }); else p.disc(X(u), Y(v), R * 0.075, col).text('P', X(u), Y(v), R * 0.08, FACE); } }
  for (const s of f.scales) if (s.r >= 0.5) { p.disc(X(s.c[0]), Y(s.c[1]), R * 0.1, INK); break; } }
/** a pod gauge of the drift cars (a fixed face with its needle painted on: an extra, not one of the car's instruments) */
function drawPod(p: SheetPaint, r: Region, s: Omit<DialScale, 'id' | 'rest' | 'tau' | 'c' | 'r'>, at: number, title: string): void { const [w] = p.into(r), c0 = w / 2, R = w / 2 * 0.985;
  drawGauge(p, { region: r, R: 30, scales: [{ ...s, id: 'boost', c: [0, 0], r: 0.9, rest: 0, tau: 0 }] }); p.into(r); p.text(title, c0, c0 + R * 0.45, R * 0.1, WHITE);
  const a = dialAngle(s, at) * Math.PI / 180; p.line(c0 - Math.sin(a) * R * 0.15, c0 + Math.cos(a) * R * 0.15, c0 + Math.sin(a) * R * 0.8, c0 - Math.cos(a) * R * 0.8, R * 0.05, NEEDLE).disc(c0, c0, R * 0.11, INK); }

/** the trim's flat detail: everything on the sheet but the dials */
function drawTrim(p: SheetPaint): void {
  const dark: RGB = [0.07, 0.07, 0.075], mid: RGB = [0.16, 0.16, 0.17], lite: RGB = [0.3, 0.3, 0.31];
  { const [w, h] = p.into('vent'); p.rect(0, 0, w, h, dark).frame(3, 3, w - 6, h - 6, 2.5, lite, 1, 4);   // a vent: slats in a frame, a divider, a thumb wheel
    for (let i = 0; i < 6; i++) { const y = 11 + i * 10.5; p.rect(8, y, w - 16, 5.5, mid, 1, 1.5).rect(8, y, w - 16, 1.6, lite, 0.8); } p.rect(w / 2 - 2.5, 7, 5, h - 14, dark).rect(w / 2 - 6, h / 2 - 9, 12, 18, lite, 1, 3).rect(w / 2 - 3, h / 2 - 6, 6, 12, mid, 1, 2); }
  { const [w, h] = p.into('console'); p.rect(0, 0, w, h, dark).frame(2, 2, w - 4, h - 4, 2, lite, 1, 3);   // the heater's levers between the seats: slots, knobs, their marks
    [0, 1, 2].forEach(i => { const y = 18 + i * 23; p.rect(14, y - 2, w - 28, 4, INK, 1, 2).line(14, y + 8, w - 14, y + 8, 0.8, WHITE, 0.5); for (let k = 0; k <= 4; k++) p.line(14 + k * (w - 28) / 4, y + 6, 14 + k * (w - 28) / 4, y + 10, 0.8, WHITE, 0.6);
      const x = 24 + [0.2, 0.7, 0.45][i]! * (w - 48); p.rect(x - 7, y - 6, 14, 12, i === 0 ? [0.7, 0.12, 0.1] : i === 1 ? [0.15, 0.3, 0.65] : lite, 1, 2.5).line(x, y - 4, x, y + 4, 1.2, WHITE, 0.8); }); }
  { const [w, h] = p.into('radio'); p.rect(0, 0, w, h, dark).frame(2, 2, w - 4, h - 4, 2, lite, 1, 3);   // a cassette radio: its window, the slot, two knobs, the buttons
    p.rect(40, 9, w - 80, 20, [0.06, 0.13, 0.1], 1, 2).text('88.5', 84, 19, 10, [0.45, 0.9, 0.6], { w: 1.4 }).text('FM', 126, 19, 6, [0.45, 0.9, 0.6], { w: 0.9 }).rect(46, 35, w - 92, 9, INK, 1, 2).rect(46, 35, w - 92, 2, lite, 0.6);
    for (const x of [20, w - 20]) p.disc(x, 26, 13, mid).circle(x, 26, 13, 1.6, lite).line(x, 26, x + 5, 17, 2, WHITE); for (let i = 0; i < 6; i++) p.rect(44 + i * 18, 50, 14, 11, mid, 1, 2).text(String(i + 1), 51 + i * 18, 55.5, 5, WHITE, { w: 0.8, a: 0.8 }); }
  { const [w, h] = p.into('switches'); p.rect(0, 0, w, h, dark).frame(2, 2, w - 4, h - 4, 2, lite, 1, 3);   // the switch panel: rockers with their marks, two knobs, the lighter
    for (let i = 0; i < 4; i++) { const x = 12 + i * 30; p.rect(x, 14, 24, 34, mid, 1, 3).rect(x + 2, 16, 20, 14, lite, 1, 2).text(['*', '+', 'H', 'A'][i]!, x + 12, 38, 7, i === 2 ? NEEDLE : WHITE, { w: 1 }); p.text(['FOG', 'FAN', 'HAZ', 'AUX'][i]!, x + 12, 58, 5, WHITE, { w: 0.7, a: 0.75 }); }
    for (const x of [144, 172]) p.disc(x, 32, 12, mid).circle(x, 32, 12, 1.5, lite).line(x, 32, x - 4, 23, 2, WHITE); p.disc(158, 66, 9, INK).circle(158, 66, 9, 1.5, STEEL); p.text('LIGHTS', 144, 52, 4.5, WHITE, { w: 0.7, a: 0.75 }); p.rect(12, 68, 110, 10, INK, 1, 2).rect(14, 70, 30, 6, [0.5, 0.1, 0.08], 1, 1).rect(48, 70, 30, 6, [0.45, 0.33, 0.05], 1, 1).rect(82, 70, 30, 6, [0.1, 0.35, 0.15], 1, 1); }
  { const [w, h] = p.into('padStock'); p.frame(7, 7, w - 14, h - 14, 1.6, INK, 0.45, 12);   // the wheel's pad: a pressed border, stitching, a wordmark that is only bars
    for (const [ax, ay, bx, by] of [[18, 12, w - 18, 12], [18, h - 12, w - 18, h - 12]] as const) p.stitch(ax, ay, bx, by, 1.2, WHITE, 0.35, 5, 3.5);
    for (let i = 0; i < 7; i++) p.rect(w / 2 - 49 + i * 14.4, h / 2 - 6, [9, 11, 9, 10, 8, 11, 9][i]!, 12, INK, 0.5, 2).rect(w / 2 - 49 + i * 14.4, h / 2 - 6, [9, 11, 9, 10, 8, 11, 9][i]!, 2.2, WHITE, 0.14, 1); }
  { const [w] = p.into('hornButton'), c = w / 2; p.disc(c, c, c - 1, [0.92, 0.75, 0.08]).circle(c, c, c - 4, 2.4, INK).text('GH', c, c, 13, INK, { w: 2.6 }); }
  { const [w, h] = p.into('pedal'); p.rect(0, 0, w, h, [0.1, 0.1, 0.1]).frame(2, 2, w - 4, h - 4, 2.5, STEEL, 1, 5); for (let i = 0; i < 5; i++) p.rect(8, 8 + i * 7, w - 16, 3.6, [0.24, 0.24, 0.25], 1, 1.5); }
  { const [w, h] = p.into('plaque'); p.rect(0, 0, w, h, STEEL, 1, 4).frame(3, 3, w - 6, h - 6, 1, INK, 0.7, 3).text('GEARHOUSE', w / 2, 16, 8, INK, { w: 1.3 }).text('NO. 029 / 337', w / 2, 32, 6, INK, { w: 0.9 }); }
  for (const r of ['lampA', 'lampB'] as const) { const [w] = p.into(r), c = w / 2; p.disc(c, c, c - 1, [0.1, 0.1, 0.11]).circle(c, c, c - 3, 1.6, lite); if (r === 'lampA') p.line(c, c - 6, c, c + 6, 2, [0.35, 0.5, 0.35]).line(c - 3, c - 3, c + 3, c - 3, 2, [0.35, 0.5, 0.35]); else p.text('4X4', c, c, 6.5, [0.5, 0.42, 0.2], { w: 1.2 }); }
  { const [w, h] = p.into('spokePrint'), c = w / 2; void h;   // the drift wheel's spokes: drilled holes and a slot along each of its three (to 3, 6 and 9 o'clock), the maker's ring
    for (const a of [90, 180, 270]) { const s = Math.sin(a * Math.PI / 180), cs = -Math.cos(a * Math.PI / 180); for (const [r, d] of [[30, 4.2], [42, 5], [55, 5.6]] as const) p.disc(c + s * r, c + cs * r, d, INK, 0.92); p.line(c + s * 65, c + cs * 65, c + s * 71, c + cs * 71, 4, INK, 0.9); }
    p.circle(c, c, 21, 1.2, WHITE, 0.5); }
  { const [w, h] = p.into('seatPleat');   // a seat's middle panel: pleats across it, a stitched edge
    for (let i = 1; i < 8; i++) { const y = i * h / 8; p.line(3, y, w - 3, y, 2.2, INK, 0.42).line(3, y + 2.2, w - 3, y + 2.2, 1.4, WHITE, 0.13); }
    p.frame(2.5, 2.5, w - 5, h - 5, 1.8, INK, 0.4, 6); for (const [ax, ay, bx, by] of [[7, 6, 7, h - 6], [w - 7, 6, w - 7, h - 6], [7, 6, w - 7, 6], [7, h - 6, w - 7, h - 6]] as const) p.stitch(ax, ay, bx, by, 1.1, WHITE, 0.3, 4.5, 3); }
  { const [w, h] = p.into('seatBucket');   // a bucket seat's back: the belt slots, a maker's patch (made up), quilting
    for (let i = -6; i < 12; i++) { p.line(i * 16, h * 0.42, i * 16 + h * 0.5, h * 0.92, 1.2, INK, 0.28).line(i * 16 + h * 0.5, h * 0.42, i * 16, h * 0.92, 1.2, INK, 0.28); }
    for (const x of [22, w - 22]) p.rect(x - 13, 14, 26, 10, INK, 0.95, 4).frame(x - 13, 14, 26, 10, 1.4, STEEL, 0.6, 4);
    p.rect(w / 2 - 30, 34, 60, 20, [0.85, 0.12, 0.1], 1, 3).text('APEX', w / 2, 44, 10, WHITE, { w: 1.9 }); p.frame(4, 4, w - 8, h - 8, 1.5, INK, 0.35, 8); }
  { const [w, h] = p.into('suit');   // the driver's front: the two shoulder belts to the buckle, the suit's zip, a patch
    p.line(w / 2, 6, w / 2, h - 30, 1.4, INK, 0.5); p.rect(w / 2 - 34, 42, 24, 14, WHITE, 0.95, 2).text('GH', w / 2 - 22, 49, 7, INK, { w: 1.3 });
    const belt: RGB = [0.78, 0.1, 0.08]; for (const s of [-1, 1]) { const x0 = w / 2 + s * 30, x1 = w / 2 + s * 9; p.line(x0, -4, x1, h - 30, 15, belt).line(x0 - 5, -4, x1 - 5, h - 30, 0.9, WHITE, 0.45).line(x0 + 5, -4, x1 + 5, h - 30, 0.9, WHITE, 0.45); p.rect(x0 - 9 - s * 3, 30, 18, 8, STEEL, 1, 2); }
    p.rect(-4, h - 30, w + 8, 15, belt).disc(w / 2, h - 23, 12, STEEL).disc(w / 2, h - 23, 7, [0.25, 0.25, 0.27]); }
  { const [w, h] = p.into('doorPleat');   // the door's lower panel: slanted pleats, the pocket's lid, a speaker
    for (let i = 0; i < 9; i++) { const x = 14 + i * 16.5; p.line(x + 10, 10, x, h - 34, 2.2, INK, 0.4).line(x + 12.2, 10, x + 2.2, h - 34, 1.3, WHITE, 0.12); }
    p.frame(4, 4, w - 8, h - 8, 1.8, INK, 0.4, 7).line(8, h - 28, w - 8, h - 28, 2, INK, 0.5).stitch(10, h - 23, w - 10, h - 23, 1.1, WHITE, 0.3, 4.5, 3);
    const cx = w - 34, cy = 42; p.disc(cx, cy, 24, [0.09, 0.09, 0.1]).circle(cx, cy, 24, 2, lite); for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (Math.hypot(i, j) < 3.4) p.disc(cx + i * 5.6, cy + j * 5.6, 1.5, [0.02, 0.02, 0.02]); }
  { const [w, h] = p.into('visor');   // a helmet's visor: dark, a sun strip with a made-up name, the light across it
    p.rect(0, 0, w, h, [0.08, 0.09, 0.12]).rect(0, 0, w, 15, [0.85, 0.12, 0.1]).text('KUMA', w / 2, 7.5, 8, WHITE, { w: 1.5 }); p.line(w * 0.56, 22, w * 0.82, 30, 5, [0.75, 0.8, 0.9], 0.55).line(w * 0.6, 34, w * 0.72, 38, 2.4, [0.75, 0.8, 0.9], 0.4); p.line(0, h - 2, w, h - 2, 3, INK); }
  // ---- stickers and a banner: clubs and shops that do not exist ----
  { const [w, h] = p.into('stickerA'); p.rect(0, 0, w, h, [0.95, 0.93, 0.86], 1, 5).rect(4, 4, w - 8, 20, [0.12, 0.25, 0.6], 1, 3).text('TOUGE CLUB', w / 2, 14, 10, WHITE, { w: 1.8 }).text('SINCE 1987', w / 2, 34, 7, [0.12, 0.25, 0.6], { w: 1.2 }).text('NO GRIP NO GLORY', w / 2, 50, 6, INK, { w: 1 }); }
  { const [w, h] = p.into('stickerB'); p.rect(0, 0, w, h, [0.08, 0.08, 0.09], 1, 5).rect(0, h - 16, w, 16, [0.92, 0.75, 0.08]).text('NIGHT SHIFT', w / 2, 22, 17, [0.92, 0.75, 0.08], { w: 3.2 }).text('MOTOR WORKS', w / 2, h - 8, 8, INK, { w: 1.5 }); }
  { const [w, h] = p.into('stickerC'); p.rect(0, 0, w, h, [0.85, 0.12, 0.1], 1, 5).disc(34, h / 2, 24, WHITE).text('29', 34, h / 2, 22, INK, { w: 4 }).text('APEX ROLL', 120, 22, 12, WHITE, { w: 2.3 }).text('CAGE AND SEAT', 120, 44, 7, WHITE, { w: 1.2, a: 0.9 }); }
  { const [w, h] = p.into('banner'); p.rect(0, 0, w, h, [0.05, 0.05, 0.06]).text('GEARHOUSE DRIFT TEAM', w / 2, h / 2, 17, WHITE, { w: 3.2, wide: 1.5 }); }
  drawPod(p, 'podA', { min: -1, max: 2, a0: -130, a1: 130, major: 0.5, minor: 0.1, num: 1, unit: 'BAR' }, 0.6, 'BOOST');
  drawPod(p, 'podB', { min: 0, max: 10, a0: -130, a1: 130, major: 1, minor: 0.5, num: 2, unit: 'BAR' }, 4.2, 'OIL P');
  drawPod(p, 'podC', { min: 40, max: 140, a0: -130, a1: 130, major: 10, minor: 5, num: 20, unit: 'C', red: [120, 140] }, 92, 'WATER'); }

/** the interior's sheet, `W` pixels wide and half as high: straight RGBA bytes, clear where a part's colour shows */
export function interiorSheet(W: number, car?: GaugeCar): Uint8Array { const p = new SheetPaint(W, W / 2); drawTrim(p); for (const f of gaugeSet(car)) drawGauge(p, f); return p.bytes(); }
/** only the dials' faces redrawn on a sheet in hand (the distance counters turning over, another car's scales) */
export function redrawGauges(sheet: Uint8Array, W: number, car?: GaugeCar): Uint8Array { const p = new SheetPaint(W, W / 2), k = W / SHEET.W, faces = gaugeSet(car); for (const f of faces) drawGauge(p, f); const b = p.bytes();
  for (const f of faces) { const [x, y, w, h] = REGIONS[f.region]; for (let j = Math.round(y * k); j < Math.round((y + h) * k); j++) { const a = (j * W + Math.round(x * k)) * 4, e = (j * W + Math.round((x + w) * k)) * 4; sheet.set(b.subarray(a, e), a); } }
  return sheet; }
