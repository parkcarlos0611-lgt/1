// Animated engine cut-away: pistons, connecting rods, crank, valves and spark follow the real firing order and valvetrain type.
// Inline / flat engines: side section of every cylinder. V engines: front section of one cylinder pair on a common crank pin.
import { hex } from '../tools/pixel/color.mjs';
import { lineTo } from './ui.mjs';
const K = { block: hex('#5d6066'), blockL: hex('#7d8188'), blockD: hex('#3a3c42'), bore: hex('#1d1f24'), piston: hex('#c9ccd1'), pistonD: hex('#8f939b'), rod: hex('#9aa0a8'),
  crank: hex('#45484f'), crankL: hex('#6c7078'), valve: hex('#c8b07a'), spring: hex('#7a8a6a'), flame: hex('#ffd36a'), flame2: hex('#fff6c8'), intake: hex('#5f86a8'), exhaust: hex('#7a6e66'), head: hex('#6b6f76'), oil: hex('#2c2a24') };
export const FIRING = { I3: [1, 3, 2], I4: [1, 3, 4, 2], I6: [1, 5, 3, 6, 2, 4], I8: [1, 6, 2, 5, 8, 3, 7, 4], F4: [1, 4, 3, 2], V6: [1, 4, 2, 5, 3, 6], V8: [1, 5, 4, 8, 6, 3, 7, 2], V12: [1, 12, 4, 9, 2, 11, 6, 7, 3, 10, 5, 8], V16: Array.from({ length: 16 }, (_, i) => i + 1) };
const CYL = { I3: 3, I4: 4, I6: 6, I8: 8, F4: 4, V6: 6, V8: 8, V12: 12, V16: 16 };
const box = (s, x, y, w, h, c) => s.fill(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), c);
const thick = (s, x0, y0, x1, y1, c, t = 2) => { for (let k = 0; k < t; k++) lineTo(s, Math.round(x0 + k * 0.5), Math.round(y0), Math.round(x1 + k * 0.5), Math.round(y1), c); };
// 720-degree cycle phase of a cylinder: 0 = TDC at the start of the power stroke
const phaseOf = (layout, cylNo, theta) => { const fo = FIRING[layout] || [1], n = fo.length, i = fo.indexOf(cylNo); return (((theta - i * 720 / n) % 720) + 720) % 720; };
// returns list of cylinders that fired this frame (for sound) - caller passes previous theta
export function fired(layout, th0, th1) { const n = CYL[layout] || 4, out = []; for (let c = 1; c <= n; c++) { const a = phaseOf(layout, c, th0), b = phaseOf(layout, c, th1); if (b < a) out.push(c); } return out; }

export function drawCutaway(s, x, y, w, h, e, theta) {
  const layout = e.layout, n = CYL[layout] || 4, V = layout.startsWith('V'), F = layout === 'F4';
  const head0 = e.head === 'sv' ? 8 : 18, avail = V ? h * 0.62 : h - 14 - head0 - 18, strokeR = Math.max(3, Math.min(10, avail / 4.2 * (e.stroke || 100) / 100)), rodL = strokeR * 2.6, boreW = Math.max(5, Math.min(13, (e.bore || 85) / 85 * 9));
  const stem = (vx, top, lift, c) => { box(s, vx - 1, top, 2, 9, c); box(s, vx - 3, top + 9 - 0 + lift * 0, 6, 2, c); };
  if (!V && !F) {                                                    // ---- inline: side section ----
    const pitch = Math.min(18, (w - 30) / n), x0 = x + (w - pitch * n) / 2, crankY = y + h - 12, deck = crankY - strokeR - rodL - 9;
    box(s, x0 - 6, deck - 2, pitch * n + 12, crankY - deck + 14, K.block); box(s, x0 - 6, deck - 2, pitch * n + 12, 1, K.blockL);
    box(s, x0 - 8, crankY + 6, pitch * n + 16, 8, K.oil);                                                                         // sump
    const head = e.head === 'sv' ? 8 : 18; box(s, x0 - 6, deck - 2 - head, pitch * n + 12, head, K.head); box(s, x0 - 6, deck - 2 - head, pitch * n + 12, 1, K.blockL);
    if (e.head === 'ohv') box(s, x0 - 2, deck - head - 8, pitch * n + 4, 6, K.blockD);                                            // rocker cover band
    if (e.head === 'sohc' || e.head === 'dohc') box(s, x0 - 4, deck - head - 10, pitch * n + 8, 8, K.blockD);
    box(s, x0 - 8, crankY - 1, pitch * n + 16, 3, K.crank);                                                                        // crank main line
    for (let c = 1; c <= n; c++) {
      const cx = x0 + (c - 0.5) * pitch, ph = phaseOf(layout, c, theta), ca = ph % 360 * Math.PI / 180;
      const pinY = crankY - Math.cos(ca) * strokeR, pinX = cx + Math.sin(ca) * strokeR * 0.25;                                    // crank throw (slight perspective)
      const pistY = crankY - (strokeR * Math.cos(ca) + Math.sqrt(rodL * rodL - (strokeR * Math.sin(ca)) ** 2));
      const borePx = boreW; box(s, cx - borePx / 2, deck, borePx, crankY - strokeR - deck - 4, K.bore);                          // bore
      // gas in the chamber by stroke: intake (blue), compression (dense), power (flame), exhaust (grey)
      const top = deck, gas = ph < 180 ? K.flame : ph < 360 ? K.exhaust : ph < 540 ? K.intake : K.intake;
      box(s, cx - borePx / 2 + 1, top, borePx - 2, Math.max(1, pistY - top - 1), gas);
      if (ph < 22 || ph > 712) { box(s, cx - 2, top - 2, 4, 4, K.flame2); box(s, cx - 1, top - 5, 2, 3, K.flame2); }             // spark
      box(s, cx - borePx / 2 + 1, pistY, borePx - 2, 6, K.piston); box(s, cx - borePx / 2 + 1, pistY + 5, borePx - 2, 1, K.pistonD);
      box(s, cx - borePx / 2 + 1, pistY + 1, borePx - 2, 1, K.pistonD);                                                            // ring groove
      thick(s, cx, pistY + 4, pinX, pinY, K.rod, 2);                                                                                // con rod
      box(s, pinX - 2, pinY - 2, 5, 5, K.crankL); box(s, cx - 3, crankY - 3, 7, 7, K.crank);                                        // pin + web
      // valves: intake open 360-540, exhaust open 180-360 (simple lift curve)
      const lift = (a, b) => (ph > a && ph < b ? Math.sin((ph - a) / (b - a) * Math.PI) * 3 : 0), li = lift(360, 540), le = lift(180, 360);
      if (e.head === 'sv') { for (const [dx, l, c2] of [[-pitch * 0.32, li, K.intake], [pitch * 0.32, le, K.exhaust]]) { const vx = cx + dx * 0.9;  // L-head: valves stand beside the bore, lift upward
          box(s, vx - 1, deck + 2 - l, 2, 14, K.valve); box(s, vx - 2, deck - 1 - l, 4, 2, K.valve); box(s, vx - 2, deck + 9, 4, 4, K.spring); if (l > 0.5) box(s, vx - 1, deck - 2, 2, 1, c2); } }
      else { for (const [dx, l] of [[-boreW * 0.28, li], [boreW * 0.28, le]]) { const vx = cx + dx; box(s, vx - 1, deck - head + 2 + l, 2, head - 3, K.valve); box(s, vx - 2, deck - 2 + l, 4, 2, K.valve); }
        if (e.head === 'ohv') { box(s, cx - pitch * 0.4, deck - head - 6 + (li > 0 ? 1 : 0), pitch * 0.8, 2, K.valve); thick(s, cx - pitch * 0.35, deck - head - 4, cx - pitch * 0.38, crankY - strokeR - 6, K.rod, 1); }   // rocker + pushrod
        else { const cam = (theta / 2 * Math.PI / 180); box(s, cx - 3 + Math.cos(cam + c) * 2, deck - head - 8 + Math.sin(cam + c) * 2, 5, 5, K.crankL); } }
    }
    const cr = theta * Math.PI / 180; box(s, x0 - 14 + Math.cos(cr) * 3, crankY - 1 + Math.sin(cr) * 3, 3, 3, K.crankL);          // timing gear mark
    return { crankY };
  }
  // ---- V / flat: front section of one pair on one crank pin ----
  const cx = x + w / 2, cy = y + h * (F ? 0.5 : 0.7), half = (F ? 180 : (layout === 'V8' || layout === 'V16' ? 90 : 60)) / 2 * Math.PI / 180;
  box(s, cx - 16, cy - 6, 32, 22, K.block); box(s, cx - 20, cy + 14, 40, 8, K.oil);
  const ca = theta * Math.PI / 180, pinX = cx + Math.sin(ca) * strokeR, pinY = cy - Math.cos(ca) * strokeR;
  [[-1, FIRING[layout]?.[0] || 1], [1, 2]].forEach(([sg, cyl]) => {
    const ax = Math.sin(half) * sg, ay = -Math.cos(half);                                                                         // bank axis
    // distance of piston pin along the axis from crank centre
    const proj = (pinX - cx) * ax + (pinY - cy) * ay, perp = (pinX - cx) * ay - (pinY - cy) * ax, d = proj + Math.sqrt(Math.max(0, rodL * rodL - perp * perp));
    const len = strokeR + rodL + 12, qx = -ay, qy = ax;                                                                            // bank axis + its perpendicular
    const seg = (t0, t1, hw, c) => { for (let t = t0; t <= t1; t += 0.5) for (let k = -hw; k <= hw; k += 0.5) box(s, cx + ax * t + qx * k, cy + ay * t + qy * k, 1, 1, c); };
    seg(strokeR + 4, len, boreW / 2 + 3, K.block); seg(strokeR + 4, len, boreW / 2, K.bore);                                        // barrel + bore
    const ph = phaseOf(layout, cyl, theta), pX = cx + ax * d, pY = cy + ay * d;
    seg(d + 5, len - 1, boreW / 2 - 1, ph < 180 ? K.flame : ph < 360 ? K.exhaust : K.intake);                                      // charge / flame / exhaust
    if (ph < 22 || ph > 712) seg(len - 4, len - 1, 2, K.flame2);
    seg(d - 1, d + 5, boreW / 2 - 1, K.piston); seg(d + 4, d + 5, boreW / 2 - 1, K.pistonD);
    thick(s, pX, pY, pinX, pinY, K.rod, 2); seg(len, len + 6, boreW / 2 + 4, K.head);
  });
  box(s, cx - 3, cy - 3, 7, 7, K.crank); box(s, pinX - 2, pinY - 2, 5, 5, K.crankL); thick(s, cx, cy, pinX, pinY, K.crankL, 2);
  return { crankY: cy };
}
