// Drawing a car that moves on its springs, in the first build's pixel manner, without turning any picture
// (review 24). What is sprung (body, frame, engine) is drawn once by the renderer and placed column by column:
// each column of pixels moves up or down by the body's pitch at that point, and the rows are squeezed a little by a
// visual spring when the car lands (squash, not rotation). What moves on its own (tyres, wheels, leaf springs,
// dampers, shafts) is drawn fresh every frame from the physics, as lines and filled outlines on the pixel grid.
import { autoRamp } from './flat';
import type { CarImage } from './raster';

export type RGB = [number, number, number];
const hex = (h: string): RGB => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
export const IRON = ['#202128', '#34363f', '#4f525d', '#737783', '#a1a5ae'].map(hex), RUBBER = ['#121117', '#1d1c23', '#2c2a33', '#43414d', '#625f6c'].map(hex);
export const CHROME = ['#2a3047', '#56627e', '#93a3bb', '#cfd9e6', '#ffffff'].map(hex), OUT: RGB = [14, 13, 18];
export const paintSteps = (paint: string) => autoRamp(paint, { steps: 5, baseIdx: 2, dL: 0.09, shift: 0.08 }).c;

export class Canvas {
  rgba: Uint8ClampedArray; dim = 0; dimTo: RGB = [0, 0, 0];
  constructor(public w: number, public h: number) { this.rgba = new Uint8ClampedArray(w * h * 4); }
  /** everything drawn while dim > 0 is mixed toward dimTo: the far side of the car */
  px(x: number, y: number, c: RGB) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const o = (y * this.w + x) * 4, k = this.dim;
    this.rgba[o] = c[0] + (this.dimTo[0] - c[0]) * k; this.rgba[o + 1] = c[1] + (this.dimTo[1] - c[1]) * k; this.rgba[o + 2] = c[2] + (this.dimTo[2] - c[2]) * k; this.rgba[o + 3] = 255; }
  fill(c: RGB) { for (let i = 0; i < this.w * this.h; i++) { this.rgba[i * 4] = c[0]; this.rgba[i * 4 + 1] = c[1]; this.rgba[i * 4 + 2] = c[2]; this.rgba[i * 4 + 3] = 255; } }
  /** a line `wd` pixels thick, its top pixel row lit */
  line(x0: number, y0: number, x1: number, y1: number, wd: number, ramp: RGB[], out = true) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.max(1, Math.hypot(dx, dy)), nx = -dy / L, ny = dx / L, n = Math.ceil(L * 1.5);
    const half = (wd - 1) / 2, rows = out ? [-half - 1, ...Array.from({ length: wd }, (_, k) => k - half), half + 1] : Array.from({ length: wd }, (_, k) => k - half);
    for (const r of rows) { const edge = out && Math.abs(r) > half, top = r === -half, c = edge ? OUT : top ? ramp[ramp.length - 2]! : r > half - 1 ? ramp[1]! : ramp[2]!;
      for (let i = 0; i <= n; i++) { const t = i / n; this.px(x0 + dx * t + nx * r * Math.sign(ny || 1), y0 + dy * t + ny * r * Math.sign(ny || 1), c); } } }
  disc(cx: number, cy: number, r: number, shade: (dx: number, dy: number, q: number) => RGB | null) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, q = Math.hypot(dx, dy) / r; if (q > 1) continue; const c = shade(dx, dy, q); if (c) this.px(x, y, c); } }
  /** an outline filled pixel by pixel (even-odd), with a shading function and a dark edge */
  poly(P: [number, number][], shade: (x: number, y: number) => RGB, edge = true) {
    let y0 = 1e9, y1 = -1e9; for (const [, y] of P) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const inside = new Map<number, [number, number][]>();
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) { const cy = y + 0.5, xs: number[] = [];
      for (let i = 0; i < P.length; i++) { const [ax, ay] = P[i]!, [bx, by] = P[(i + 1) % P.length]!; if ((ay <= cy) !== (by <= cy)) xs.push(ax + (cy - ay) * (bx - ax) / (by - ay)); }
      xs.sort((a, b) => a - b); const spans: [number, number][] = []; for (let k = 0; k + 1 < xs.length; k += 2) spans.push([Math.ceil(xs[k]! - 0.5), Math.floor(xs[k + 1]! - 0.5)]); inside.set(y, spans); }
    const isIn = (x: number, y: number) => (inside.get(y) ?? []).some(([a, b]) => x >= a && x <= b);
    for (const [y, spans] of inside) for (const [a, b] of spans) for (let x = a; x <= b; x++) this.px(x, y, edge && (!isIn(x - 1, y) || !isIn(x + 1, y) || !isIn(x, y - 1) || !isIn(x, y + 1)) ? OUT : shade(x, y)); }
  /** a picture drawn by the renderer, placed through a mapping from screen pixels to picture pixels (nearest: no blending) */
  blit(img: CarImage, map: (x: number, y: number) => [number, number] | null, box: [number, number, number, number], only?: (r: number, g: number, b: number, a: number, sx: number, sy: number) => boolean) {
    for (let y = Math.max(0, box[1]); y < Math.min(this.h, box[3]); y++) for (let x = Math.max(0, box[0]); x < Math.min(this.w, box[2]); x++) { const m = map(x, y); if (!m) continue;
      const [sx, sy] = m; if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue; const o = (sy * img.w + sx) * 4; if (img.rgba[o + 3]! < 128) continue;
      if (only && !only(img.rgba[o]!, img.rgba[o + 1]!, img.rgba[o + 2]!, img.rgba[o + 3]!, sx, sy)) continue; this.px(x, y, [img.rgba[o]!, img.rgba[o + 1]!, img.rgba[o + 2]!]); } }
}

/** a tyre from the ring of points the physics gives (screen pixels), its wheel drawn at the hub, nuts turned by `angle` */
export function tyre(cv: Canvas, ring0: [number, number][], hub: [number, number], rimR: number, angle: number, paint: RGB[], opt: { tread?: boolean; capR?: number; round?: number } = {}) {
  // with `round`: the tyre keeps its round shape about the hub and only gives where it is pressed in (the ground under
  // it), so it never wobbles like jelly; its weight shows (review 26)
  const ring: [number, number][] = opt.round ? ring0.map(([x, y]) => { const dx = x - hub[0], dy = y - hub[1], d = Math.hypot(dx, dy) || 1, R = opt.round!, keep = dy > 0 ? Math.min(R, d) : R; return [hub[0] + dx / d * keep, hub[1] + dy / d * keep]; }) : ring0;
  // a smooth outline through the ring's points
  const n = ring.length, P: [number, number][] = [];
  for (let i = 0; i < n; i++) { const p0 = ring[(i - 1 + n) % n]!, p1 = ring[i]!, p2 = ring[(i + 1) % n]!, p3 = ring[(i + 2) % n]!;
    for (let s = 0; s < 4; s++) { const t = s / 4, t2 = t * t, t3 = t2 * t, f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      P.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); } }
  let R = 0; for (const [x, y] of ring) R += Math.hypot(x - hub[0], y - hub[1]); R /= n;
  cv.poly(P, (x, y) => { const dx = x + 0.5 - hub[0], dy = y + 0.5 - hub[1], d = Math.hypot(dx, dy), u = (d - rimR) / Math.max(1, R - rimR), dot = (-dx - dy) / (d || 1) * 0.7071;
    let l = u < 0.18 ? 0 : 1; if (u > 0.3 && u < 0.75 && dot > 0.3) l = 2; if (u > 0.4 && u < 0.62 && dot > 0.75) l = 3;
    if (opt.tread && u > 0.72) { const a = Math.atan2(dy, dx) - angle, blk = Math.floor((a / (Math.PI * 2) + 10) * Math.max(18, Math.round(R * 1.3))) & 1; l = blk ? (dot > 0.1 ? 3 : 2) : 0; }
    return RUBBER[l]!; });
  // the wheel: a pressed steel disc in the body colour, a ring pressed in it, a hub, five nuts that turn with it
  const capR = opt.capR ?? rimR * 0.3;
  cv.disc(hub[0], hub[1], rimR, (dx, dy, q) => { const d = (-dx - dy) / (Math.hypot(dx, dy) || 1) * 0.7071;
    if (q > 0.9) return paint[d > 0.2 ? 3 : 1]!; if (q > 0.84) return paint[d > 0 ? 1 : 3]!; if (Math.abs(q - 0.62) < 0.06) return paint[d > 0 ? 3 : 1]!;
    if (q * rimR < capR) return q * rimR < capR - 1 ? (d > 0.3 && q < 0.5 ? IRON[3]! : IRON[1]!) : OUT; return paint[d > 0.3 ? 3 : 2]!; });
  for (let k = 0; k < 5; k++) { const a = angle + k / 5 * Math.PI * 2; cv.px(hub[0] + Math.cos(a) * (capR + 2), hub[1] - Math.sin(a) * (capR + 2), IRON[4]!); }
}

/** a semi-elliptic leaf spring: fixed eye A, the axle seat S, the shackle eye E (screen pixels), `leaves` leaves */
export function leafSpring(cv: Canvas, A: [number, number], S: [number, number], E: [number, number], shackleTop: [number, number], leaves = 5) {
  // a parabola through the three points, x along the spring
  const [x0, y0] = A, [x1, y1] = S, [x2, y2] = E, den = (x0 - x1) * (x0 - x2) * (x1 - x2) || 1e-6;
  const a = (x2 * (y1 - y0) + x1 * (y0 - y2) + x0 * (y2 - y1)) / den, b = (x2 * x2 * (y0 - y1) + x1 * x1 * (y2 - y0) + x0 * x0 * (y1 - y2)) / den, c = (x1 * x2 * (x1 - x2) * y0 + x2 * x0 * (x2 - x0) * y1 + x0 * x1 * (x0 - x1) * y2) / den;
  const Y = (x: number) => a * x * x + b * x + c, lo = Math.min(x0, x2), hi = Math.max(x0, x2);
  for (let k = leaves - 1; k >= 0; k--) { const half = (hi - lo) / 2 * (1 - k * 0.17), m0 = x1 - half, m1 = x1 + half;
    for (let x = Math.round(m0); x <= Math.round(m1); x++) { const y = Math.round(Y(x)) + k; cv.px(x, y, k === 0 ? IRON[3]! : IRON[k % 2 ? 1 : 2]!); if (k === leaves - 1 || x === Math.round(m0) || x === Math.round(m1)) cv.px(x, y + 1, OUT); }
    cv.px(Math.round(m0), Math.round(Y(m0)) + k, OUT); cv.px(Math.round(m1), Math.round(Y(m1)) + k, OUT); }
  for (let x = Math.round(lo); x <= Math.round(hi); x++) cv.px(x, Math.round(Y(x)) - 1, OUT);
  for (const [ex, ey] of [A, E]) cv.disc(ex, ey, 2.2, (_dx, _dy, q) => (q > 0.7 ? OUT : IRON[3]!));
  cv.line(shackleTop[0], shackleTop[1], E[0], E[1], 2, IRON);                                   // the shackle link
  for (const d of [-3, 3]) cv.line(x1 + d, y1 - 1, x1 + d, y1 + 6, 1, IRON, false);            // U-bolts round the axle
}

/** a telescopic damper between a frame mount T and an axle mount B */
export function damper(cv: Canvas, T: [number, number], B: [number, number]) {
  const dx = B[0] - T[0], dy = B[1] - T[1], L = Math.hypot(dx, dy) || 1, body = Math.min(L - 4, 22), M: [number, number] = [T[0] + dx / L * body, T[1] + dy / L * body];
  cv.line(M[0], M[1], B[0], B[1], 1, CHROME); cv.line(T[0], T[1], M[0], M[1], 4, IRON);
  for (const [ex, ey] of [T, B]) cv.disc(ex, ey, 1.8, (_dx, _dy, q) => (q > 0.6 ? OUT : IRON[2]!));
}

/** a propeller shaft with a joint at each end */
export function shaft(cv: Canvas, P: [number, number], Q: [number, number]) {
  cv.line(P[0], P[1], Q[0], Q[1], 3, IRON); for (const [x, y] of [P, Q]) cv.disc(x, y, 2.6, (_dx, _dy, q) => (q > 0.7 ? OUT : IRON[2]!));
}
