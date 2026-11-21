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
import imgSetting from '../../assets/places/kitchen/setting.png';
import imgBase from '../../assets/places/kitchen/base.png';
import imgRegions from '../../assets/places/kitchen/regions.png';
import kd from '../../data/places/kitchen.json';

const W = 480, H = 270;
type F = { at: number[]; size: number[]; hand?: number[] };
const M = meta as unknown as { frames: Record<string, F> };
const URL: Record<string, string> = { sit: imgSit, drink0: imgD0, drink1: imgD1, drink2: imgD2, drink3: imgD3 };
/** the round of drinking: which frame for how long (seconds) */
const ROUND: [string, number][] = [['sit', 5.5], ['drink0', 0.35], ['drink1', 0.5], ['drink2', 1.4], ['drink1', 0.45], ['drink3', 0.35]];
const CUP = { x0: 184, y0: 180, x1: 209, y1: 199 }, SAUCER_ROWS = 5, PLACE = { x: 219, y: 186 };   // the cup and saucer as they stood in the picture; where his goes

export function visitor() {
  let t = Math.random() * 4;
  return function draw(out: Uint8ClampedArray, dt: number, steam: boolean) { t += dt;
    const base = pixels(imgBase), reg = pixels(imgRegions), set = pixels(imgSetting); if (!base || !reg || !set) return;
    let total = ROUND.reduce((s, r) => s + r[1], 0), u = t % total, frame = 'sit'; for (const [f, d] of ROUND) { if (u < d) { frame = f; break; } u -= d; }
    const fm = M.frames[frame]!, px = pixels(URL[frame]!, fm.size[0], fm.size[1]); if (!px) return;
    // the room's light where he sits: what the wall behind his shoulder shows against its own colour
    let lb = 0, lo = 0; for (const [x, y] of [[214, 140], [248, 140], [205, 120], [258, 120]] as const) { const i = (y * W + x) * 4; lb += base[i]! + base[i + 1]! + base[i + 2]!; lo += out[i]! + out[i + 1]! + out[i + 2]!; }
    const k = Math.min(1.4, lo / Math.max(1, lb)), warm = [1.02, 0.98, 0.92];
    const ids = (kd as unknown as { regionId: Record<string, number> }).regionId, cloth = ids.cloth!, top = ids.tableTop!;
    const keep = (x: number, y: number) => { const r = reg[(y * W + x) * 4]!; return !(r === cloth || (r === top && y >= 199)); };   // the table's front stands before him
    // a soft shadow where his hands rest, and under his shoes
    const shade = (cx: number, cy: number, rx: number, ry: number, a: number) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (q >= 1 || !keep(x, y) && y < 199) continue; const i = (y * W + x) * 4, f = 1 - a * (1 - q); out[i] = out[i]! * f; out[i + 1] = out[i + 1]! * f; out[i + 2] = out[i + 2]! * f; } };
    shade(231, 261, 20, 2.5, 0.45); if (frame === 'sit') shade(231, 197, 24, 2, 0.3);
    const [fx, fy] = fm.at as [number, number], [fw, fh] = fm.size as [number, number];
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const j = (y * fw + x) * 4; if (px[j + 3]! < 128) continue; const X = fx + x, Y = fy + y; if (X < 0 || Y < 0 || X >= W || Y >= H || !keep(X, Y)) continue;
      const i = (Y * W + X) * 4; out[i] = Math.min(255, px[j]! * k * warm[0]!); out[i + 1] = Math.min(255, px[j + 1]! * k * warm[1]!); out[i + 2] = Math.min(255, px[j + 2]! * k * warm[2]!); }
    // his cup: on its saucer in front of him, or in his hand while he drinks
    const cupW = CUP.x1 - CUP.x0, cupH = CUP.y1 - CUP.y0, held = fm.hand;
    for (let y = 0; y < cupH; y++) for (let x = 0; x < cupW; x++) { const j = ((CUP.y0 + y) * W + CUP.x0 + x) * 4; if (set[j + 3]! < 128) continue; const saucer = y >= cupH - SAUCER_ROWS;
      if (held && !saucer) { const X = Math.round(held[0]! - cupW / 2 + x), Y = Math.round(held[1]! - (cupH - SAUCER_ROWS) + 3 + y); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const i = (Y * W + X) * 4; out[i] = set[j]! * k; out[i + 1] = set[j + 1]! * k; out[i + 2] = set[j + 2]! * k; continue; }
      const X = PLACE.x + x, Y = PLACE.y + y, i = (Y * W + X) * 4; out[i] = set[j]! * k; out[i + 1] = set[j + 1]! * k; out[i + 2] = set[j + 2]! * k; }
    // steam off the hot tea
    if (steam) { const sx = held ? held[0]! : PLACE.x + cupW / 2, sy = held ? held[1]! - 9 : PLACE.y + 2; for (let n = 0; n < 9; n++) { const a = (t * 0.7 + n / 9) % 1, x = Math.round(sx + Math.sin(a * 6 + n) * 2 * a), y = Math.round(sy - a * 14); if (x < 0 || y < 0) continue; const i = (y * W + x) * 4, w = 0.22 * (1 - a); out[i] = out[i]! + (235 - out[i]!) * w; out[i + 1] = out[i + 1]! + (235 - out[i + 1]!) * w; out[i + 2] = out[i + 2]! + (235 - out[i + 2]!) * w; } } };
}
