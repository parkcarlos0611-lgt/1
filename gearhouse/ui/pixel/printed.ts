// Print in a real typeface, at the screen's own size, into the pixel buffer (review 50): for things printed or stamped
// in the world (the dial's figures, the number card, a book's cover) where the 3x5 pixel face looks too casual. The
// text is drawn by the browser into a small canvas (with its soft edges, as ink on paper at that size) and laid into
// the pixels with those edges as coverage. Cached per text, font and colour; drawn again once the web fonts arrive.
const cache = new Map<string, { w: number; h: number; a: Float32Array; ox: number }>();
let fontsIn = false;
try { void document.fonts.ready.then(() => { fontsIn = true; cache.clear(); }); } catch { fontsIn = true; }

export interface PrintOpts { font: string; align?: 'left' | 'center' | 'right'; spacing?: number }
/** lay `text` into a 480-wide RGBA buffer with its baseline at y; `put(x, y, coverage)` does the colouring */
export function printText(text: string, x: number, y: number, o: PrintOpts, put: (x: number, y: number, a: number) => void): number {
  const key = `${text}|${o.font}|${o.spacing ?? 0}|${fontsIn}`; let g = cache.get(key);
  if (!g) { const c = document.createElement('canvas'), cx = c.getContext('2d')!; cx.font = o.font; setSp(cx, o.spacing ?? 0); const m = cx.measureText(text), w = Math.ceil(m.width) + 4, asc = Math.ceil(m.actualBoundingBoxAscent || 10) + 2, desc = Math.ceil(m.actualBoundingBoxDescent || 3) + 2;
    c.width = w; c.height = asc + desc; cx.font = o.font; setSp(cx, o.spacing ?? 0); cx.fillStyle = '#fff'; cx.fillText(text, 2, asc);
    const d = cx.getImageData(0, 0, w, asc + desc).data, a = new Float32Array(w * (asc + desc)); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]! / 255;
    g = { w, h: asc + desc, a, ox: asc }; cache.set(key, g); }
  const tw = g.w - 4, x0 = Math.round(o.align === 'center' ? x - tw / 2 : o.align === 'right' ? x - tw : x) - 2, y0 = Math.round(y) - g.ox;
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) { const a = g.a[j * g.w + i]!; if (a > 0.04) put(x0 + i, y0 + j, Math.min(1, a * 1.15)); }
  return tw; }
function setSp(c: CanvasRenderingContext2D, px: number) { const cc = c as CanvasRenderingContext2D & { letterSpacing?: string }; if ('letterSpacing' in cc) cc.letterSpacing = px + 'px'; }
export const SERIF = "'Old Standard TT', Georgia, 'Times New Roman', serif", GOTHIC = "Oswald, 'Arial Narrow', sans-serif";
