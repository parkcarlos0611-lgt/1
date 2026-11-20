// The pixel-art interface (review 27): everything is drawn into one small pixel buffer (480 x 270) and scaled up
// without smoothing. Text is the Galmuri7 pixel font (SIL OFL 1.1, (c) quiple; docs/licenses/Galmuri-OFL.md),
// its Hangul set decoded once on first use.
import { FONT } from './galmuri_small.mjs';
import { decode } from './galmuri_full.mjs';

export type RGB = [number, number, number];
export const hex = (h: string): RGB => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
let FULL: Record<number, number[]> | null = null;
const glyph = (cp: number) => FONT.g[cp] ?? (FULL ??= decode())[cp] ?? FONT.g[63]!;

export class Screen {
  d: Uint8ClampedArray;
  constructor(public w = 480, public h = 270) { this.d = new Uint8ClampedArray(w * h * 4); }
  px(x: number, y: number, c: RGB, a = 1) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const o = (y * this.w + x) * 4;
    if (a >= 1) { this.d[o] = c[0]; this.d[o + 1] = c[1]; this.d[o + 2] = c[2]; } else { this.d[o] = this.d[o]! + (c[0] - this.d[o]!) * a; this.d[o + 1] = this.d[o + 1]! + (c[1] - this.d[o + 1]!) * a; this.d[o + 2] = this.d[o + 2]! + (c[2] - this.d[o + 2]!) * a; }
    this.d[o + 3] = 255; }
  get(x: number, y: number): RGB { const o = ((y | 0) * this.w + (x | 0)) * 4; return [this.d[o]!, this.d[o + 1]!, this.d[o + 2]!]; }
  fill(x: number, y: number, w: number, h: number, c: RGB) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); }
  hline(x0: number, x1: number, y: number, c: RGB) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.px(x, y, c); }
  vline(x: number, y0: number, y1: number, c: RGB) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.px(x, y, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, dash = 0) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy, k = 0;
    for (;;) { if (!dash || (k++ % (dash * 2)) < dash) this.px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
  /** text in Galmuri7, top at y (the glyphs stand on y + 7); returns the x after it */
  text(s: string, x: number, y: number, c: RGB, maxW = 0): number { let cx = x | 0; const yb = (y | 0) + 7;
    for (const ch of s) { const g = glyph(ch.codePointAt(0)!), [dw, bw, bh, xo, yo] = g as [number, number, number, number, number]; if (maxW && cx + dw - x > maxW) break;
      for (let j = 0; j < bh; j++) { const row = g[5 + j]!; for (let i = 0; i < bw; i++) if ((row >> (bw - 1 - i)) & 1) this.px(cx + xo + i, yb - (bh + yo) + j, c); } cx += dw; }
    return cx; }
  tw(s: string) { let w = 0; for (const ch of s) w += glyph(ch.codePointAt(0)!)[0]!; return Math.max(0, w - 1); }
  /** copy to a canvas whose size is the buffer's; the page scales it up with crisp pixels */
  blit(ctx: CanvasRenderingContext2D, img: ImageData) { img.data.set(this.d); ctx.putImageData(img, 0, 0); }
}
