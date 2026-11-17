// Procedural side-view wheel: tyre + optional whitewall + rim style. Drawn per-pixel, no sprite rotation.
import { Pix, line } from '../pix.mjs';
const LX = -0.7071, LY = -0.7071; // light from top-left

export function wheel(P, { r, tireFrac = 0.30, style = 'hubcap', whitewall = 0, spokes = 5, paint = 'white', rot = 0, tread = null }) {
  const S = Math.ceil(r * 2) + 1, c = S / 2, px = new Pix(S, S);
  const ri = r * (1 - tireFrac);
  const T = 3; // tag: wheel
  const rub = P.id('rubber'), chr = P.id('chrome'), wht = P.id('white'), blk = P.id('black'), alu = P.id('alu');
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy); if (d > r) continue;
    const ux = dx / (d || 1), uy = dy / (d || 1), dot = ux * LX + uy * LY; // +1 = lit side
    if (d > ri) { // tyre
      const t = (d - ri) / (r - ri);
      let lv = 1;
      if (t > 0.25 && t < 0.7 && dot > 0.35) lv = 2;
      if (t > 0.35 && t < 0.6 && dot > 0.8) lv = 3;
      if (t < 0.18 || (t > 0.8 && dot < -0.3)) lv = 0;
      if (tread === 'ndt' && t > 0.78) { const a = Math.atan2(dy, dx); const blk = Math.floor((a + Math.PI) / (Math.PI * 2) * r * 0.9) % 2 === 0; if (!blk && t > 0.93) continue; px.set(x, y, rub, blk ? (dot > 0.2 ? 3 : 2) : 0, T); continue; }
      if (t > 0.86 && r > 20) { const a = Math.atan2(dy, dx); if (Math.floor((a + Math.PI) / (Math.PI * 2) * r * 1.6) % 2 === 0) lv = Math.max(0, lv - 1); }
      if (whitewall && t > 0.12 && t < 0.12 + whitewall) { px.set(x, y, wht, dot > 0.4 ? 4 : dot < -0.5 ? 1 : 3, T); continue; }
      px.set(x, y, rub, lv, T); continue;
    }
    const q = d / ri; // 0..1 across the wheel face
    if (style === 'hubcap') { // full chrome dish
      let lv;
      if (q > 0.9) lv = dot > 0 ? 3 : 1;           // rim lip
      else if (q > 0.78) lv = dot > 0 ? 1 : 3;      // dish edge, reversed (concave)
      else if (q > 0.45) lv = dot > 0.5 ? 4 : dot > -0.2 ? 2 : 1;
      else if (q > 0.32) lv = dot > 0 ? 1 : 2;
      else lv = dot > 0.3 ? 4 : dot > -0.4 ? 3 : 1;   // centre spinner
      if (q > 0.45 && q < 0.78) { const a = Math.atan2(dy, dx) + rot; if (Math.abs(Math.sin(a * 3)) < 0.12) lv = Math.max(0, lv - 2); }
      px.set(x, y, chr, lv, T);
    } else if (style === 'wire') {
      if (q > 0.9) px.set(x, y, chr, dot > 0.2 ? 3 : dot < -0.4 ? 1 : 2, T);
      else if (q > 0.84) px.set(x, y, blk, 1, T);                                    // rim well
      else if (q < 0.3) px.set(x, y, chr, q < 0.12 ? (dot > 0 ? 4 : 3) : q > 0.26 ? 1 : (dot > 0.3 ? 4 : dot > -0.3 ? 2 : 1), T);
      else if (q < 0.62) px.set(x, y, P.id('iron'), q > 0.58 ? 0 : (dot > 0.3 ? 2 : 1), T);  // brake drum behind spokes
      else px.set(x, y, blk, 0, T);
    } else if (style === 'alloy') {
      const a = Math.atan2(dy, dx) + rot; const seg = ((a / (Math.PI * 2)) * spokes % 1 + 1) % 1;
      const hole = q > 0.34 && q < 0.82 && seg > 0.18 && seg < 0.82;
      if (q > 0.88) px.set(x, y, alu, dot > 0.2 ? 4 : dot < -0.4 ? 1 : 2, T);
      else if (hole) px.set(x, y, blk, q > 0.78 || seg < 0.24 ? 1 : 0, T);
      else if (q < 0.18) px.set(x, y, blk, dot > 0 ? 3 : 2, T);
      else px.set(x, y, alu, dot > 0.45 ? 4 : dot > -0.3 ? 3 : 1, T);
    } else if (style === 'artillery' || style === 'steelspoke') { // tapered wooden / steel spokes
      const a = Math.atan2(dy, dx) + rot, seg = ((a / (Math.PI * 2)) * spokes % 1 + 1) % 1, wdt = 0.16 + 0.22 * (1 - q);
      const wood = P.id(style === 'artillery' ? 'wood' : paint);
      if (q > 0.86) px.set(x, y, P.id(paint), dot > 0.2 ? 3 : 1, T);
      else if (q < 0.26) px.set(x, y, chr, q < 0.14 ? (dot > 0 ? 4 : 2) : 1, T);
      else if (Math.abs(seg - 0.5) < wdt / 2) px.set(x, y, wood, Math.abs(seg - 0.5) < wdt / 5 ? 3 : dot > 0 ? 2 : 1, T);
      else px.set(x, y, P.id('iron'), q < 0.6 ? 1 : 0, T);
    } else if (style === 'disc' || style === 'discperf' || style === 'trimring' || style === 'truck') {
      const a = Math.atan2(dy, dx) + rot;
      if (q > 0.9) px.set(x, y, P.id(paint), dot > 0.2 ? 3 : 1, T);
      else if (style === 'trimring' && q > 0.72) px.set(x, y, chr, dot > 0.3 ? 4 : dot > -0.3 ? 3 : 1, T);
      else if (style === 'discperf' && q > 0.5 && q < 0.66 && Math.abs(Math.sin(a * 6)) < 0.45) px.set(x, y, blk, 0, T);
      else if (style === 'truck' && q > 0.45 && q < 0.7 && Math.abs(Math.sin(a * 3)) < 0.3) px.set(x, y, blk, 0, T);
      else if (q < (style === 'truck' ? 0.3 : 0.24)) px.set(x, y, style === 'truck' ? P.id(paint) : chr, q < 0.12 ? 4 : dot > 0 ? 3 : 1, T);
      else px.set(x, y, P.id(paint), q > 0.78 ? (dot > 0 ? 1 : 3) : (dot > 0.4 ? 3 : dot > -0.4 ? 2 : 1), T);
    } else if (style === 'combat') {
      const a = Math.atan2(dy, dx) + rot, pr = P.id(paint);
      if (q > 0.9) px.set(x, y, pr, dot > 0.2 ? 2 : 1, T);
      else if (q > 0.84) px.set(x, y, P.id('black'), 0, T);                                     // split-ring seam
      else if (q > 0.36 && q < 0.46 && Math.abs(Math.sin(a * 3)) < 0.2) px.set(x, y, pr, 3, T); // lug nuts
      else if (q < 0.24) px.set(x, y, pr, q < 0.12 ? 2 : (dot > 0 ? 2 : 1), T);
      else px.set(x, y, pr, dot > 0.4 ? 2 : dot > -0.4 ? 2 : 1, T);
    } else if (style === 'spinner') { // knock-off wire wheel
      if (q > 0.86) px.set(x, y, chr, dot > 0.2 ? 3 : 1, T); else if (q < 0.22) px.set(x, y, P.id('brass'), dot > 0 ? 4 : 2, T); else px.set(x, y, blk, 0, T);
    } else { // painted steel + small cap + lug ring
      if (q > 0.88) px.set(x, y, P.id(paint), dot > 0 ? 3 : 1, T);
      else if (q < 0.42) px.set(x, y, chr, q < 0.3 ? (dot > 0.2 ? 4 : 2) : 1, T);
      else { const a = Math.atan2(dy, dx) + rot; const vent = q > 0.6 && q < 0.75 && Math.abs(Math.sin(a * 4)) < 0.3; px.set(x, y, vent ? blk : P.id(paint), vent ? 0 : dot > 0.4 ? 3 : 2, T); }
    }
  }
  if (style === 'wire' || style === 'spinner') { // spokes rasterised per angle (laced: two offset sets)
    const n = spokes; const hubR = ri * (style === 'spinner' ? 0.2 : 0.26), rimR = ri * 0.86;
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * Math.PI * 2, b = a + (k % 2 ? 0.35 : -0.35);
      line(c - 0.5 + Math.cos(a) * hubR, c - 0.5 + Math.sin(a) * hubR, c - 0.5 + Math.cos(b) * rimR, c - 0.5 + Math.sin(b) * rimR,
        (x, y) => { const lit = (x - c) * LX + (y - c) * LY > 0; px.set(x, y, P.id('wire'), lit ? 3 : 2, T); });
    }
  }
  return px;
}
