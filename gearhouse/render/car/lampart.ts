// Lamp pictures (docs/decisions 2026-11-25, in the crest's manner: docs/systems/116 option C): a lamp's rim and lens are
// geometry, so its outline is crisp; what is seen through the lens (the housing, reflectors, projector rings, a tail
// lamp's rings) is a picture on the style's atlas, laid on the lens's face. Each picture is drawn by rule in its region
// of the atlas's 'lamps' cell (render/live/style.ts), twice: in detail for the near levels, and in a few flat colours
// for the far mip levels (a lamp a dozen pixels wide reads as plain shapes, not as grey noise). Any lamp can use it: a
// part's lens faces carry atlas coordinates from `lampUV` (Build.art), nothing else is needed.
import { ATLAS_CELLS } from '../live/style';

/** the sheet's own units (the cell is two atlas cells wide and one high) and each picture's region in it (x, y, w, h) */
export const LAMP_SHEET = [512, 256] as const;
export const LAMP_ART = {
  /** the N33's slanted head lamp (600 x 96 mm; x: its inner end .. the corner's point): a small inner lamp, the projector, the big reflector, the clear corner lamp */
  n33Head: [0, 0, 512, 96],
  /** a round tail lamp: a dark red outer ring of fine grooves, a groove, the brighter lens in its middle */
  tailRings: [0, 96, 128, 128],
  /** a round amber lamp (a bumper's): fluted amber glass over a bulb */
  fogAmber: [128, 96, 64, 64],
} as const satisfies Record<string, readonly [number, number, number, number]>;
export type LampArt = keyof typeof LAMP_ART;
type RGBA = [number, number, number, number];
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const grey = (k: number, a = 1): RGBA => [k * 0.97, k, k * 1.04, a], over = (c: RGBA, d: RGBA, t: number): RGBA => [c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t, c[2] + (d[2] - c[2]) * t, 1];

/** a picture at (x, y), each -1..1 across its region (y up): in detail, or `flat` in a few plain colours */
export function lampPaint(k: LampArt, x: number, y: number, flat: boolean): RGBA { const r = Math.hypot(x, y);
  switch (k) {
    case 'n33Head': { const X = x * 300, Y = y * 48, e = flat ? 4 : 1.2, d = (cx: number, cy: number) => Math.hypot(X - cx, Y - cy), ring = (q: number, r0: number, r1: number) => sm(r0 - e, r0, q) * (1 - sm(r1, r1 + e, q));
      // the housing: silver, darker under the bonnet's edge; the corner lamp's clear ribbed glass beyond the reflector
      let c = grey(flat ? 0.5 : 0.5 + 0.07 * y - 0.22 * sm(30, 46, Y));
      const corner = sm(84, 84 + e * 2, X) * (1 - sm(34 - 30 * sm(190, 290, X) - e, 34 - 30 * sm(190, 290, X), Math.abs(Y + 2)));
      if (corner > 0) { const rib = flat ? 0 : 0.07 * Math.sign(Math.sin(X / 14 * Math.PI * 2)); c = over(c, grey(0.8 + rib), corner); if (!flat) c = over(c, [0.92, 0.6, 0.16, 1], 1 - sm(10, 13, d(196, -2))); }
      if (!flat) c = over(c, grey(0.2), ring(Math.abs(X - 80), -1, 1.6) * (1 - sm(36, 40, Math.abs(Y))));
      // the big reflector: a chrome rim, a fluted bowl, the bulb
      { const q = d(20, 0), a = Math.atan2(Y, X - 20); if (q < 44 + e) { const bowl = flat ? 0.84 : 0.7 + 0.2 * (1 - (q / 39) ** 2) + 0.06 * Math.sign(Math.sin(a * 9)) * sm(10, 16, q);
        c = over(c, grey(bowl), 1 - sm(39, 39 + e, q)); c = over(c, grey(flat ? 0.84 : 0.93), ring(q, 39, 43)); c = over(c, [0.99, 0.97, 0.9, 1], 1 - sm(8, 8 + e, q)); } }
      // the projector: a dark shroud, a chrome ring, the lens with a glint
      { const q = d(-98, -1); if (q < 41 + e) { c = over(c, [0.76, 0.86, 0.96, 1], 1 - sm(28, 28 + e, q)); if (!flat) { c = over(c, [0.55, 0.68, 0.82, 1], sm(8, 28, q) * (1 - sm(28, 28 + e, q)) * 0.6); c = over(c, [1, 1, 1, 1], 1 - sm(5, 7, d(-108, 9))); c = over(c, grey(0.86), ring(q, 28, 31)); }
        c = over(c, grey(0.17), ring(q, flat ? 28 : 31, 40)); } }
      // the small inner lamp
      { const q = d(-192, -4); if (q < 26 + e) { c = over(c, grey(0.95), 1 - sm(21, 21 + e, q)); if (!flat) { c = over(c, grey(0.74), 1 - sm(6, 8, q)); c = over(c, grey(0.88), ring(q, 21, 25)); } else c = over(c, grey(0.8), ring(q, 21, 25)); } }
      return c; }
    case 'tailRings': { if (flat) return r < 0.6 ? [0.8, 0.16, 0.11, 1] : [0.54, 0.09, 0.07, 1];
      const groove = 0.05 * Math.sign(Math.sin(r * Math.PI * 26)); let c: RGBA = r > 0.64 ? [0.55 + groove, 0.09 + groove * 0.3, 0.07 + groove * 0.3, 1] : [0.79 + groove * 0.6, 0.15, 0.11, 1];
      c = over(c, [0.22, 0.03, 0.03, 1], sm(0.585, 0.6, r) * (1 - sm(0.635, 0.65, r))); c = over(c, [0.93, 0.33, 0.24, 1], 1 - sm(0.16, 0.24, r)); c = over(c, [0.3, 0.04, 0.04, 1], sm(0.95, 0.985, r));
      return over(c, [1, 0.85, 0.8, 1], (1 - sm(0.05, 0.085, Math.hypot(x + 0.3, y - 0.36))) * 0.85); }
    case 'fogAmber': { if (flat) return [0.88, 0.58, 0.11, 1]; const fl = 0.05 * Math.sign(Math.sin(y * Math.PI * 7)); let c: RGBA = [0.86 + fl, 0.56 + fl, 0.1, 1];
      c = over(c, [0.97, 0.78, 0.32, 1], 1 - sm(0.2, 0.36, r)); return over(c, [0.5, 0.3, 0.04, 1], sm(0.9, 0.98, r)); }
  } }

/** the sheet at `W` pixels wide and half as high (straight RGBA, clear outside the regions), each pixel the mean of `ss` x `ss` samples */
export function lampSheet(W: number, flat = false, ss = 2): Uint8Array { const H = W / 2, out = new Uint8Array(W * H * 4), k = LAMP_SHEET[0] / W;
  for (const [name, [rx, ry, rw, rh]] of Object.entries(LAMP_ART) as [LampArt, readonly [number, number, number, number]][]) {
    for (let py = Math.floor(ry / k); py < Math.ceil((ry + rh) / k); py++) for (let px = Math.floor(rx / k); px < Math.ceil((rx + rw) / k); px++) { if (px >= W || py >= H) continue; const acc = [0, 0, 0, 0];
      for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) { const u = ((px + (i + 0.5) / ss) * k - rx) / rw, v = ((py + (j + 0.5) / ss) * k - ry) / rh, c = lampPaint(name, Math.max(-1, Math.min(1, u * 2 - 1)), Math.max(-1, Math.min(1, 1 - v * 2)), flat); for (let q = 0; q < 4; q++) acc[q]! += c[q]!; }
      const o = (py * W + px) * 4; for (let q = 0; q < 4; q++) out[o + q] = Math.round(Math.max(0, Math.min(1, acc[q]! / (ss * ss))) * 255); } }
  return out; }

/** a lens corner's atlas coordinates (u, v, the cell + 1: Mesh.uv) at (x, y), each 0..1 across the picture (y down from
 *  its top); a unit and a half inside the region's edge so a neighbour never bleeds in. The shader reads a cell at
 *  0.004 + 0.992 u of its width (render/live/renderer.ts atlasAt): undone here */
export function lampUV(k: LampArt, x: number, y: number): [number, number, number] { const [rx, ry, rw, rh] = LAMP_ART[k], c = (t: number) => Math.max(0, Math.min(1, t)), toCell = (t: number) => (t - 0.004) / 0.992;
  return [toCell((rx + 1.5 + (rw - 3) * c(x)) / LAMP_SHEET[0]), toCell((ry + 1.5 + (rh - 3) * c(y)) / LAMP_SHEET[1]), ATLAS_CELLS.indexOf('lamps') + 1]; }
