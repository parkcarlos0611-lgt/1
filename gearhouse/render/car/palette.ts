// Colour ramps for the car rasteriser. Each material gets a ramp of shades from deep shadow to highlight;
// shadows lean cool and darker in saturation, highlights lean warm, like hand-picked pixel-art ramps.
import type { Material } from './types';

export type RGB = [number, number, number];
export const hexRGB = (h: string): RGB => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };

function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h, s, l]; }
function fromHsl(h: number, s: number, l: number): RGB {
  const f = (p: number, q: number, t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  if (s === 0) return [l * 255, l * 255, l * 255].map(Math.round) as RGB;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)].map(v => Math.round(v * 255)) as RGB; }

/** move a hue a little toward a target hue along the short way round the wheel (amt in turns) */
function towardHue(h: number, target: number, amt: number): number { let d = target - h; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; return h + Math.sign(d) * Math.min(Math.abs(d), amt); }

/** n shades around a base colour: index 0 = deepest shadow, n-1 = brightest highlight */
export function ramp(base: string, n = 9, opt: { span?: number; hueShift?: number; satShift?: number } = {}): RGB[] {
  const [h, s, l] = toHsl(hexRGB(base)), span = opt.span ?? 0.62, hs = opt.hueShift ?? 0.045, ss = opt.satShift ?? 0.25, out: RGB[] = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1) - 0.5;                                  // -0.5 .. 0.5
    const L = Math.min(0.97, Math.max(0.03, l + t * span * (t < 0 ? Math.min(1, l * 2.2) : Math.min(1, (1 - l) * 2.2))));
    const H = towardHue(h, t < 0 ? 0.68 : 0.13, Math.abs(t) * 2 * hs * (s < 0.08 ? 0.3 : 1)),            // shadows toward blue-violet, highlights toward yellow
      S =Math.max(0, Math.min(1, s * (1 - Math.abs(t) * ss * 2) + (t < 0 ? 0.04 : 0)));
    out.push(fromHsl(((H % 1) + 1) % 1, S, L)); }
  return out; }

export interface Ramps { [m: string]: RGB[] }
export function rampsFor(paint: string, paint2: string): Record<Material, RGB[]> {
  return {
    paint: ramp(paint, 10), paint2: ramp(paint2, 10),
    black: ramp('#25221f', 8, { span: 0.5 }),
    chrome: [hexRGB('#1d2026'), hexRGB('#3a3f48'), hexRGB('#5d6470'), hexRGB('#868e99'), hexRGB('#b4bcc4'), hexRGB('#dde3e6'), hexRGB('#f7f6ee'), hexRGB('#fffdf2')],
    glass: [hexRGB('#0f1418'), hexRGB('#1c252c'), hexRGB('#2c3a43'), hexRGB('#45575f'), hexRGB('#6f8389'), hexRGB('#a7b6b7')],
    rubber: ramp('#2b2927', 7, { span: 0.38 }),
    wood: ramp('#8a5a32', 7),
    shadow: [hexRGB('#0d0b0a'), hexRGB('#17130f'), hexRGB('#221c17')],
    canvas: ramp('#8c8270', 7, { span: 0.5 }),
  };
}
