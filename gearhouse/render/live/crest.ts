// The Phorster crest's atlas cell and its mip levels (docs/systems/116, B1), from the data tools/ref/crestbake.py bakes:
// level 0 the artwork, level 1 its half, levels 2-4 (64, 32, 16 texels) the flat drawings, and the halves of the 16 below
// it. Each level a whole cell, RGBA, opaque (the rim's dark gold round the shield).
import { CREST_FLAT, CREST_FLATS, CREST_L0, CREST_PAL, CREST_BOX } from './crest.gen';

const bytes = (b64: string): Uint8Array => { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
/** a level halved: each texel the mean of the four under it */
function half(src: Uint8Array, C: number): Uint8Array { const h = C >> 1, out = new Uint8Array(h * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) for (let k = 0; k < 4; k++) { const o = (2 * y * C + 2 * x) * 4 + k; out[(y * h + x) * 4 + k] = (src[o]! + src[o + 4]! + src[o + C * 4]! + src[o + C * 4 + 4]! + 2) >> 2; }
  return out; }
let levels: Uint8Array[] | null = null;
/** the crest cell's levels, 256 texels square down to 1 (nine of them), RGBA */
export function crestLevels(): Uint8Array[] { if (levels) return levels;
  const pal = bytes(CREST_PAL), rgba = (idx: Uint8Array, out: Uint8Array, at: (i: number) => number) => { for (let i = 0; i < idx.length; i++) { const o = at(i), p = idx[i]! * 3; out[o] = pal[p]!; out[o + 1] = pal[p + 1]!; out[o + 2] = pal[p + 2]!; out[o + 3] = 255; } };
  const L0 = new Uint8Array(256 * 256 * 4), [bx, by, bw] = CREST_BOX;
  for (let i = 0; i < 256 * 256; i++) { L0[i * 4] = pal[3]!; L0[i * 4 + 1] = pal[4]!; L0[i * 4 + 2] = pal[5]!; L0[i * 4 + 3] = 255; }   // the rim's gold (the palette's second colour)
  rgba(bytes(CREST_L0), L0, i => ((by + Math.floor(i / bw)) * 256 + bx + i % bw) * 4);
  const out = [L0, half(L0, 256)];
  for (let C = 64; C >= 1; C >>= 1) { const k = CREST_FLAT.indexOf(C as never); if (k >= 0) { const L = new Uint8Array(C * C * 4); rgba(bytes(CREST_FLATS[k]!), L, i => i * 4); out.push(L); } else out.push(half(out[out.length - 1]!, C * 2)); }
  return (levels = out); }
