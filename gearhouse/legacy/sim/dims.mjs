// Real dimensions (mm) and per-type limits for 1930-1949, from researched extreme production cars:
// cap = largest real car + 3 %, floor = smallest real car - 2 %. Sources in docs/STAGE4_PLAN.md section 9.
//  wheelbase max 4,300 (1930 super-luxury tourer) -> 4,430; width max ~2,150 -> 2,215; height max 1,900 (1938 armoured limousine) -> 1,957
//  wheelbase min ~1,905 (1930s British 7 hp economy car) -> 1,867; width min ~1,170 -> 1,146
export const LIMITS = {
  sedan4d: { wb: [1867, 4430], w: [1146, 2215], h: [1400, 1957] },
  coupe2d: { wb: [1867, 4430], w: [1146, 2215], h: [1300, 1885] },          // tallest closed coupe ~1,830 (+3 %)
  pickup:  { wb: [2400, 3520], w: [1600, 2060], h: [1700, 2060] },          // 1-ton pickups (estimate, to verify)
  truck:   { wb: [3000, 5150], w: [1900, 2510], h: [2100, 2680] },          // legal width ~2,440 (estimate, to verify)
  mil6x6:  { wb: [3600, 4290], w: [2100, 2307], h: [2300, 2874] } };
const clamp = (v, [a, b]) => Math.max(a, Math.min(b, v));
// width follows the size class (reference wheelbase), NOT the player's stretched wheelbase (measured 1930s cars: ~1,450 at 2,300 WB, ~2,070 at 3,900 WB); player trims +-6 %
export const baseWidth = wb => 1450 + (wb - 2300) * 0.39;
export function dimsFor(type, q, len, widthAdj = 0.5) {
  const L = LIMITS[type] || LIMITS.sedan4d, wb = clamp(q.wb, L.wb), ref = q.wbRef || wb, width = Math.round(clamp(baseWidth(ref) * (0.94 + 0.12 * widthAdj), L.w));
  return { wb, len: Math.round(len), width, height: Math.round(clamp(q.hWB * ref, L.h)), track: Math.round(width - 290), clearance: Math.round(q.year < 1936 ? 230 : 205) };
}
export const SIZE = { small: 2350, medium: 2800, large: 3250, limousine: 3700 };
