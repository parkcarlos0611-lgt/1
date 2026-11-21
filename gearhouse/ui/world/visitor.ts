// A customer at the kitchen table (review 53): sat in the chair across the table, his hands on the cloth, his shins and
// shoes under the table on the floor; now and then he lifts his cup, drinks, and puts it back on its saucer. Lit by the
// room's own light (measured on the wall behind him), hidden behind the table's front where it is in front of him.
import { pixels } from './pics';
import meta from '../../data/people/customer.json';
import imgSit from '../../assets/people/customer_sit.png';
import imgD0 from '../../assets/people/customer_drink0.png';
import imgD1 from '../../assets/people/customer_drink1.png';
import imgD2 from '../../assets/people/customer_drink2.png';
import imgD3 from '../../assets/people/customer_drink3.png';
import imgCup from '../../assets/people/teacup.png';
import imgBase from '../../assets/places/kitchen/base.png';
import imgRegions from '../../assets/places/kitchen/regions.png';
import kd from '../../data/places/kitchen.json';

const W = 480, H = 270;
type F = { at: number[]; size: number[]; hand?: number[] };
const M = meta as unknown as { frames: Record<string, F> };
const URL: Record<string, string> = { sit: imgSit, drink0: imgD0, drink1: imgD1, drink2: imgD2, drink3: imgD3 };
/** the round of drinking: which frame for how long (seconds) */
const ROUND: [string, number][] = [['sit', 5.5], ['drink0', 0.35], ['drink1', 0.5], ['drink2', 1.4], ['drink1', 0.45], ['drink3', 0.35]];
const CUP_W = 24, CUP_H = 14, SAUCER_ROWS = 5, PLACE = { x: 212, y: 183 };   // the cup and saucer (tools/people/teacup.py); where his stands, well on the table top (rows 189..200)

export function visitor() {
  let t = Math.random() * 4;
  return function draw(out: Uint8ClampedArray, dt: number, steam: boolean) { t += dt;
    const base = pixels(imgBase), reg = pixels(imgRegions), set = pixels(imgCup, CUP_W, CUP_H); if (!base || !reg || !set) return;
    let total = ROUND.reduce((s, r) => s + r[1], 0), u = t % total, frame = 'sit'; for (const [f, d] of ROUND) { if (u < d) { frame = f; break; } u -= d; }
    const fm = M.frames[frame]!, px = pixels(URL[frame]!, fm.size[0], fm.size[1]); if (!px) return;
    // the room's light where he sits: what the wall behind his shoulder shows against its own colour
    let lb = 0, lo = 0; for (const [x, y] of [[214, 140], [248, 140], [205, 120], [258, 120]] as const) { const i = (y * W + x) * 4; lb += base[i]! + base[i + 1]! + base[i + 2]!; lo += out[i]! + out[i + 1]! + out[i + 2]!; }
    const k = Math.min(1.4, lo / Math.max(1, lb)), warm = [1.02, 0.98, 0.92];
    const ids = (kd as unknown as { regionId: Record<string, number> }).regionId, cloth = ids.cloth!, top = ids.tableTop!;
    const keep = (x: number, y: number) => { const r = reg[(y * W + x) * 4]!; return r !== cloth && r !== top; };   // the table stands before him: its front, and its top from the far edge on
    /** what of him lies on the table top: his hands and cuffs (his forearms come towards us over it), nothing else */
    const onTable = (p: Uint8ClampedArray, w: number, h: number, x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = (yy * w + xx) * 4; if (p[j + 3]! < 128) continue;
        const r = p[j]!, g = p[j + 1]!, b = p[j + 2]!; if ((r > 140 && g > 85 && b < 160 && r - b > 35) || (r > 175 && g > 170 && b > 160)) return true; } return false; };
    // a soft shadow where his hands rest, and under his shoes
    const shade = (cx: number, cy: number, rx: number, ry: number, a: number) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (q >= 1) continue; const i = (y * W + x) * 4, f = 1 - a * (1 - q); out[i] = out[i]! * f; out[i + 1] = out[i + 1]! * f; out[i + 2] = out[i + 2]! * f; } };
    shade(231, 261, 20, 2.5, 0.45); if (frame === 'sit') shade(231, 197, 24, 2, 0.3);
    const [fx, fy] = fm.at as [number, number], [fw, fh] = fm.size as [number, number];
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const j = (y * fw + x) * 4; if (px[j + 3]! < 128) continue; const X = fx + x, Y = fy + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; if (!keep(X, Y) && !(reg[(Y * W + X) * 4] === top && onTable(px, fw, fh, x, y))) continue;
      const i = (Y * W + X) * 4; out[i] = Math.min(255, px[j]! * k * warm[0]!); out[i + 1] = Math.min(255, px[j + 1]! * k * warm[1]!); out[i + 2] = Math.min(255, px[j + 2]! * k * warm[2]!); }
    // his cup: on its saucer in front of him, or in his hand while he drinks; the saucer's soft shadow on the cloth
    const held = fm.hand; shade(PLACE.x + CUP_W / 2, PLACE.y + CUP_H, 11, 1.6, 0.35);
    for (let y = 0; y < CUP_H; y++) for (let x = 0; x < CUP_W; x++) { const j = (y * CUP_W + x) * 4; if (set[j + 3]! < 128) continue; const saucer = y >= CUP_H - SAUCER_ROWS;
      const X = held && !saucer ? Math.round(held[0]! - CUP_W / 2 + x) : PLACE.x + x, Y = held && !saucer ? Math.round(held[1]! - (CUP_H - SAUCER_ROWS) + 3 + y) : PLACE.y + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const i = (Y * W + X) * 4; out[i] = Math.min(255, set[j]! * k); out[i + 1] = Math.min(255, set[j + 1]! * k); out[i + 2] = Math.min(255, set[j + 2]! * k * 0.97); }
    // steam off the hot tea while the cup stands: two faint wisps that sway as they rise and thin out (none while it is at his lips)
    if (steam && !held) for (let n = 0; n < 2; n++) { const sx = PLACE.x + 9 + n * 5; for (let h = 0; h < 16; h++) { const a = h / 16, x = sx + Math.sin(t * 1.3 + h * 0.35 + n * 2) * (0.6 + a * 2.2), y = PLACE.y + 1 - h;
        for (const dx of [0, 1]) { const X = Math.floor(x) + dx, f = dx ? x - Math.floor(x) : 1 - (x - Math.floor(x)); if (X < 0 || y < 0) continue; const i = (y * W + X) * 4, w = 0.13 * (1 - a) * Math.min(1, h / 3) * f * (0.7 + 0.3 * Math.sin(t * 2 + h * 0.5 + n)); out[i] = out[i]! + (240 - out[i]!) * w; out[i + 1] = out[i + 1]! + (240 - out[i + 1]!) * w; out[i + 2] = out[i + 2]! + (238 - out[i + 2]!) * w; } } } };
}
