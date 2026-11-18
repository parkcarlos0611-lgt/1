// Stage E places: the city map, the works seen from outside (delivery yard filled with the real unsold stock), the factory
// floor, and the dealership. Stock that sits too long gathers dust and fades - on the yard and on the dealer's lot.
import { W, H, C, text, button, input, lineTo, bevel, N, tw } from './ui.mjs';
import { hex } from '../tools/pixel/color.mjs';

const colOf = (P, px, i) => { const ramp = P.ramps[px.r[i]], lv = px.l[i]; return lv < 0 ? ramp.o : ramp.c[Math.max(0, Math.min(ramp.c.length - 1, lv))]; };
// a car drawn 1/k size (yard, line, lot); dust 0..1 greys and fades it, tint = [rgb, alpha] for bare steel / primer on the line
export function smallCar(S, P, px, x, y, k = 4, dust = 0, tint = null) { const w = Math.floor(px.w / k), h = Math.floor(px.h / k), sh = P.byName.shadow;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const q = (j * k + (k >> 1)) * px.w + i * k + (k >> 1); if (!px.r[q] || px.r[q] === sh) continue; S.fill(x + i, y + j, 1, 1, colOf(P, px, q));
    if (tint) S.blend(x + i, y + j, tint[0], tint[1]); if (dust > 0) { S.blend(x + i, y + j, [176, 164, 138], 0.25 * dust + (j < h * 0.55 ? 0.3 * dust : 0)); if (dust > 0.5 && (i * 7 + j * 13) % 11 === 0) S.blend(x + i, y + j, [120, 110, 92], 0.5); } }
  return [w, h]; }
const man = (S, x, y, t = 0, c = hex('#2b2a30')) => { S.fill(x - 1, y - 9, 3, 3, hex('#d9b99a')); S.fill(x - 2, y - 6, 5, 5, c); S.fill(x - 2, y - 1, 2, 3, c); S.fill(x + 1, y - 1, 2, 3, c); if ((t >> 3) % 2) S.fill(x + 3, y - 6, 2, 1, c); else S.fill(x + 3, y - 4, 2, 1, c); };
const smoke = (S, x, y, t, n = 5, on = true) => { if (!on) return; for (let k = 0; k < n; k++) { const f = ((t * 0.6 + k * 20) % 100) / 100, r = 2 + f * 5; for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) S.blend(Math.round(x + f * 26 + xx), Math.round(y - f * 34 + yy), [205, 200, 192], 0.35 * (1 - f)); } };
const dustOf = m => Math.min(1, (m.stockAge || 0) / 6);
const topBar = (S, title) => { bevel(S, 0, 0, W, 16, C.oxblood, C.oxL, C.oxD); text(S, title, 8, 6, C.brassL, 1, 380); };

// ---------- city map (a tab) ----------
export function drawCity(S, g, x0, y0, w, h, t) {
  S.fill(x0, y0, w, h, hex('#c3b98f')); for (let k = 0; k < 40; k++) S.fill(x0 + (k * 53) % w, y0 + (k * 31) % h, 3, 2, hex('#b6ab82'));
  for (let x = 0; x < w; x++) { const ry = y0 + 150 + Math.round(Math.sin(x / 38) * 14 + x * 0.12); S.fill(x0 + x, ry, 1, 16, hex('#6f97a8')); S.fill(x0 + x, ry, 1, 2, hex('#8fb3c0')); }                     // river
  const road = hex('#e4dcc0'); S.fill(x0, y0 + 96, w, 4, road); S.fill(x0 + 190, y0, 4, h, road); S.fill(x0 + 60, y0 + 40, 4, 60, road); S.fill(x0 + 300, y0 + 96, 4, 110, road); S.fill(x0 + 60, y0 + 40, 134, 3, road);
  S.fill(x0, y0 + 126, w, 1, hex('#5a4d3c')); for (let x = 0; x < w; x += 6) S.fill(x0 + x, y0 + 125, 2, 3, hex('#5a4d3c')); const tx = x0 + ((t * 0.4) % (w + 60)) - 50; if (tx < x0 + w - 12) { if (tx >= x0) S.fill(tx, y0 + 121, 12, 5, hex('#2b2320')); for (let k = 1; k < 4; k++) if (tx - k * 11 >= x0) S.fill(tx - k * 11, y0 + 122, 9, 4, hex('#7a2a24')); }   // railway + train
  const dens = Math.min(1, 0.45 + (g.year - 1930) * 0.03); for (let k = 0; k < 90; k++) { const hx = x0 + 150 + (k * 37) % 190, hy = y0 + 58 + (k * 23) % 96; if ((k * 7 % 10) / 10 > dens || Math.abs(hy - y0 - 97) < 6 || Math.abs(hx - x0 - 191) < 6 || hy > y0 + 116) continue; S.fill(hx, hy, 6, 5, hex(k % 3 ? '#9a6a55' : '#b0a08a')); S.fill(hx, hy, 6, 1, hex('#5a4038')); }   // town blocks
  const spots = [{ k: 'works', x: 30, y: 20, w: 74, h: 34, name: 'THE WORKS' }, { k: 'dealer', x: 214, y: 78, w: 34, h: 16, name: 'MAIN STREET DEALER' }, { k: 'track', x: 300, y: 22, w: 80, h: 44, name: 'PROVING GROUND' }, { k: 'office', x: 122, y: 78, w: 22, h: 16, name: 'HEAD OFFICE' }];
  let hit = null;
  for (const s of spots) { const X = x0 + s.x, Y = y0 + s.y, hov = input.x >= X && input.x < X + s.w && input.y >= Y && input.y < Y + s.h;
    if (s.k === 'works') { S.fill(X, Y + 12, s.w, s.h - 12, hex('#8a4a3a')); for (let b = 0; b < 6; b++) for (let q = 0; q < 8; q++) S.fill(X + b * 12 + q, Y + 12 - q, 1, q + 1, hex('#6b6e70')); S.fill(X + 58, Y - 6, 4, 18, hex('#5a4038')); smoke(S, X + 60, Y - 6, t, 4, g.models.some(m => (m.plan || 0) > 0 && !m.dead));
      S.fill(X + 4, Y + 40, 66, 12, hex('#7d7a70')); for (let q = 0; q < Math.min(10, Math.ceil(g.models.reduce((a, m) => a + (m.stock || 0), 0) / 60)); q++) S.fill(X + 7 + q * 6, Y + 43 + (q % 2) * 4, 4, 2, hex('#2f3a4a')); }
    else if (s.k === 'track') { for (let a = 0; a < 6.3; a += 0.03) { const px = X + 40 + Math.cos(a) * 36, py = Y + 22 + Math.sin(a) * 17; S.fill(Math.round(px), Math.round(py), 2, 2, hex('#8a7a62')); } const a = t * 0.03; S.fill(Math.round(X + 40 + Math.cos(a) * 36), Math.round(Y + 22 + Math.sin(a) * 17), 3, 2, C.oxblood); }
    else { S.fill(X, Y, s.w, s.h, hex(s.k === 'dealer' ? '#d8c9a0' : '#7a6a58')); S.fill(X, Y, s.w, 2, hex('#4a3a30')); for (let q = 2; q < s.w - 3; q += 5) S.fill(X + q, Y + 6, 3, 5, hex(s.k === 'dealer' ? '#7fa7b5' : '#e0c890')); }
    if (hov) { for (const [a, b, c2, d] of [[X - 2, Y - 2, s.w + 4, 1], [X - 2, Y + s.h + 1, s.w + 4, 1], [X - 2, Y - 2, 1, s.h + 4], [X + s.w + 1, Y - 2, 1, s.h + 4]]) S.fill(a, b, c2, d, C.red); if (input.clicked) hit = s.k; }
    const lw = tw(s.name) + 6; S.fill(X + ((s.w - lw) >> 1), Y + s.h + 3, lw, 9, hov ? C.oxblood : C.ink); text(S, s.name, X + ((s.w - lw) >> 1) + 3, Y + s.h + 5, C.brassL); }
  text(S, 'CLICK A PLACE TO GO THERE', x0 + 6, y0 + h - 10, C.ink);
  return hit;
}
// ---------- the works from outside ----------
export function drawWorks(S, P, g, sprite, t) {
  const live = g.models.filter(m => !m.dead && (m.stock || 0) > 0), busy = g.models.some(m => (m.plan || 0) > 0 && !m.dead), bays = Math.min(10, 3 + Math.floor(g.factory / 500));
  S.fill(0, 0, W, 150, hex('#cfd9d6')); for (let k = 0; k < 5; k++) for (let yy = 0; yy < 20; yy++) S.fill(k * 110 - 30 + yy * 2, 116 + yy, 150 - yy * 4, 1, hex('#a8b8aa'));
  S.fill(0, 150, W, 120, hex('#8d8a7c')); S.fill(0, 150, W, 2, hex('#6b675c'));
  const fx = 110, fw = bays * 34; S.fill(fx, 96, fw, 56, hex('#8a4a3a')); for (let y = 100; y < 150; y += 6) S.fill(fx, y, fw, 1, hex('#7a3f31'));                                         // brick shop
  for (let b = 0; b < bays; b++) { for (let q = 0; q < 16; q++) S.fill(fx + b * 34 + q * 2, 96 - q, 2, q + 1, hex('#5f6468')); S.fill(fx + b * 34 + 32, 80, 2, 17, hex('#aebfc4')); for (let wy = 0; wy < 2; wy++) S.fill(fx + b * 34 + 6, 108 + wy * 18, 22, 10, hex(busy && (t >> 5) % 7 !== b % 7 ? '#e9d79a' : '#6f8088')); }   // sawtooth roof, lit windows
  for (let c = 0; c < 2 + (bays >> 2); c++) { const cx = fx + 24 + c * 90; S.fill(cx, 40, 8, 56, hex('#6b3a2e')); S.fill(cx - 1, 40, 10, 3, hex('#4a2820')); smoke(S, cx + 4, 40, t + c * 30, 6, busy); }                         // stacks
  S.fill(20, 84, 78, 68, hex('#9a8f7c')); S.fill(20, 84, 78, 3, hex('#5a5248')); for (let r = 0; r < 3; r++) for (let q = 0; q < 5; q++) S.fill(27 + q * 14, 94 + r * 18, 8, 10, hex('#5d7480')); S.fill(52, 136, 14, 16, hex('#4a3a30'));   // office block
  const nm = String(g.name).slice(0, 22); S.fill(18, 72, 82, 11, C.oxblood); text(S, N(nm), 21, 75, C.brassL, 1, 76);
  S.fill(fx + fw + 14, 60, 4, 92, hex('#5a5550')); S.fill(fx + fw + 4, 44, 24, 20, hex('#7a7f84')); S.fill(fx + fw + 4, 44, 24, 2, hex('#9aa0a6'));                                    // water tower
  for (let x = 0; x < W; x += 12) { S.fill(x, 168, 1, 8, hex('#4a4136')); } S.fill(0, 170, W, 1, hex('#4a4136'));                                                                                  // fence
  // delivery yard: one car drawn per 20 unsold, each model in its own rows, dusty when it has sat for months
  let n = 0, hover = null; const perRow = 13;
  for (const m of live) { const px = sprite(m); if (!px) continue; const cnt = Math.min(26, Math.ceil(m.stock / 20)), d = dustOf(m);
    for (let k = 0; k < cnt && n < 39; k++, n++) { const x = 8 + (n % perRow) * 36, y = 186 + Math.floor(n / perRow) * 24; const [w2, h2] = smallCar(S, P, px, x, y + 14 - Math.floor(px.h / 6), 6, d); if (input.x >= x && input.x < x + 34 && input.y >= y - 4 && input.y < y + 18) hover = m; } }
  if (!n) text(S, 'THE DELIVERY YARD IS EMPTY', 150, 205, hex('#3a352d'));
  if (busy) { const tx = W - ((t * 0.7) % (W + 120)); S.fill(tx, 158, 34, 9, hex('#3f5a40')); S.fill(tx - 10, 160, 10, 7, hex('#2b2a30')); S.fill(tx + 3, 167, 5, 3, C.black); S.fill(tx + 24, 167, 5, 3, C.black); }   // a lorry on the road
  topBar(S, 'THE WORKS - ' + g.factory + ' CARS / MONTH');
  if (hover) { const s = `${hover.stock} IN STOCK - ${hover.stockAge || 0} MONTHS UNSOLD${dustOf(hover) > 0.5 ? ' - GATHERING DUST' : ''}`; S.fill(input.x - 4, input.y - 22, Math.max(tw(s), 80) + 8, 20, C.ink); text(S, N(hover.name), input.x, input.y - 19, C.brassL); text(S, s, input.x, input.y - 10, C.paper); }
  if (button(S, 8, 252, 100, 14, 'FACTORY FLOOR', { tone: 'teal' })) return 'plant'; if (button(S, W - 70, 252, 62, 14, 'CITY MAP', { tone: 'ox' })) return 'map';
  return null;
}
// ---------- factory floor ----------
const STN = [['PRESS SHOP', 'PANELS ARE STAMPED FROM SHEET STEEL'], ['FRAME LINE', 'RAILS AND CROSS-MEMBERS ARE JOINED'], ['CHASSIS', 'AXLES, SPRINGS, ENGINE AND GEARBOX GO IN'], ['BODY DROP', 'THE BODY IS LOWERED ONTO THE CHASSIS'], ['PAINT BOOTH', 'PRIMER, COLOUR COATS, DRYING OVEN'], ['TRIM AND FINAL', 'GLASS, CHROME, SEATS, WHEELS'], ['INSPECTION', 'EVERY CAR IS CHECKED AND DRIVEN OFF']];
export function drawPlant(S, P, g, sprite, t, sfx) {
  const live = g.models.filter(m => !m.dead && m.readyAt <= g.year * 12 + g.month - 1), out = live.reduce((a, m) => a + (m.plan || 0), 0), util = Math.min(1, out / Math.max(1, g.factory)), y0 = 176;
  S.fill(0, 0, W, H, hex('#2c2622')); for (let x = 0; x < W; x += 60) { for (let k = 0; k < 18; k++) S.fill(x + k * 2, 34 - k, 2, k + 1, hex('#4a4a44')); S.fill(x + 36, 16, 24, 18, hex('#5b5f5e')); }
  for (let x = 30; x < W; x += 120) S.fill(x, 34, 6, y0 - 20, hex('#3e3a35')); S.fill(0, 46, W, 4, hex('#5a5550'));
  S.fill(0, y0 + 14, W, H - y0 - 14, hex('#3a332d')); S.fill(0, y0 + 12, W, 3, hex('#6b645b')); const sp = util > 0 ? 0.25 + util * 0.9 : 0; for (let x = (t * sp) % 16; x < W; x += 16) S.fill(x, y0 + 13, 6, 1, hex('#8a8278'));   // moving conveyor
  const sw = W / STN.length; let hov = -1;
  STN.forEach(([nm], i) => { const x = Math.round(i * sw); if (input.x >= x && input.x < x + sw && input.y > 50 && input.y < y0 + 40) hov = i; S.fill(x, 50, 1, y0 - 36, hex('#3a3632'));
    if (i === 0) { const dn = util > 0 && (t % 60) < 12; S.fill(x + 14, 96, 40, 12, hex('#5a5f66')); S.fill(x + 18, 108, 6, 60, hex('#4a4f55')); S.fill(x + 44, 108, 6, 60, hex('#4a4f55')); S.fill(x + 16, 118 + (dn ? 30 : 0), 36, 14, hex('#7a8088')); S.fill(x + 12, y0 - 2, 44, 10, hex('#3a3e44')); if (util > 0 && t % 60 === 11) sfx('stamp'); }   // press
    if (i === 3) { lineTo(S, x + 34, 48, x + 34, 96 + ((t >> 2) % 12), hex('#9a9690')); S.fill(x + 30, 46, 9, 5, hex('#b0341f')); }                                                         // hoist
    if (i === 4) { S.fill(x + 6, 100, sw - 12, 80, hex('#4a5a5c')); S.fill(x + 6, 100, sw - 12, 3, hex('#7a8a8c')); if (util > 0) for (let k = 0; k < 14; k++) S.blend(x + 12 + ((t * 3 + k * 9) % (sw - 24)), 120 + (k * 11) % 50, [230, 220, 200], 0.5); }   // paint booth mist
    const men = util > 0 ? 1 + Math.round(util * 2) : 0; for (let k = 0; k < men; k++) man(S, x + 12 + k * 16 + (i % 2) * 6, y0 + 30 + (k % 2) * 8, t + k * 5 + i * 3, hex(i === 4 ? '#c8c2b0' : '#39445a')); });
  // cars on the line: bare steel until the paint booth, primer inside it, colour after
  if (live.length && util > 0) { const gap = 96, n = Math.ceil(W / gap) + 1; for (let k = 0; k < n; k++) { const x = ((t * sp + k * gap) % (n * gap)) - 70, m = live[(Math.floor((t * sp + k * gap) / (n * gap)) + k) % live.length], px = sprite(m); if (!px) continue;
      const zone = x / sw, tint = zone < 3.8 ? [[150, 156, 162], 0.85] : zone < 4.9 ? [[138, 62, 44], 0.8] : null; if (zone < 0.9) continue; smallCar(S, P, px, Math.round(x), y0 + 12 - Math.floor(px.h / 3), 3, 0, tint); } }
  else text(S, 'THE LINE STANDS STILL - NO OUTPUT PLANNED', 130, 150, hex('#b9ae8e'));
  topBar(S, `FACTORY FLOOR - ${out} / ${g.factory} CARS / MONTH  (${Math.round(util * 100)}%)  ABOUT ${Math.round(out * 0.6 + 40)} WORKERS`);
  if (hov >= 0) { const [a, b] = STN[hov]; S.fill(Math.min(W - 250, Math.round(hov * sw)), 56, 246, 22, C.ink); text(S, a, Math.min(W - 250, Math.round(hov * sw)) + 4, 59, C.brassL); text(S, b, Math.min(W - 250, Math.round(hov * sw)) + 4, 68, C.paper, 1, 238); }
  if (button(S, 8, 252, 130, 14, 'EXPAND +500 ($40,000)', { disabled: g.cash < 40000 })) return 'expand'; if (button(S, W - 136, 252, 62, 14, 'THE WORKS', { tone: 'teal' })) return 'works'; if (button(S, W - 70, 252, 62, 14, 'CITY MAP', { tone: 'ox' })) return 'map';
  return null;
}
// ---------- dealership ----------
export function drawDealer(S, P, g, sprite, t, money) {
  const live = g.models.filter(m => !m.dead && m.readyAt <= g.year * 12 + g.month - 1), era = g.year < 1936 ? 0 : g.year < 1947 ? 1 : 2, sold = live.reduce((a, m) => a + (m.lastSold || 0), 0);
  S.fill(0, 0, W, 170, hex('#cfd9d6')); for (let k = 0; k < 6; k++) { S.fill(k * 90 - 20, 60 + (k % 3) * 12, 70, 110, hex(k % 2 ? '#a89a86' : '#9a8a7a')); for (let q = 0; q < 12; q++) S.fill(k * 90 - 12 + (q % 3) * 20, 72 + (k % 3) * 12 + Math.floor(q / 3) * 20, 10, 12, hex('#7d8f98')); }   // street behind
  S.fill(0, 170, W, 100, hex('#8d8a7c')); S.fill(0, 170, W, 3, hex('#b5b0a0')); S.fill(0, 214, W, 1, hex('#e4dcc0'));
  const bx = 40, bw = 250, by = era === 0 ? 86 : 78; S.fill(bx, by, bw, 170 - by, hex(era === 0 ? '#8a4a3a' : era === 1 ? '#d8cdb4' : '#e8e2d2'));                                                   // the showroom by era
  if (era === 2) for (let q = 0; q < 16; q++) S.fill(bx + bw + q, by + q * 2, 1, 170 - by - q * 2, hex('#e8e2d2')); S.fill(bx, by, bw, 4, hex(era === 2 ? '#2f6b6a' : '#4a3a30'));
  const gx = bx + 10, gw = era === 0 ? 150 : 228, gy = era === 0 ? 118 : 104; S.fill(gx, gy, gw, 168 - gy, hex('#31424a')); S.fill(gx, gy, gw, 2, hex('#aebfc4')); if (era === 0) { for (let q = 0; q < gw + 12; q += 8) S.fill(gx - 6 + q, gy - 10, 8, 8, hex(q % 16 ? '#7a2a24' : '#efe6cf')); S.fill(bx + 180, 124, 34, 46, hex('#4a3a30')); }   // window (awning / door in the 1930s)
  const sg = String(g.name).slice(0, 24); S.fill(bx + 20, by + 8, Math.min(bw - 40, tw(sg) + 12), 12, C.oxblood); text(S, N(sg), bx + 26, by + 11, C.brassL, 1, bw - 52);
  live.slice(0, era === 0 ? 1 : 2).forEach((m, i) => { const px = sprite(m); if (px) smallCar(S, P, px, gx + 8 + i * 112, 166 - Math.floor(px.h / 2), 2, 0); });                                   // show cars behind the glass
  for (let x = gx; x < gx + gw; x += 38) S.blend(x, gy + 4, [255, 255, 255], 0.0), lineTo(S, x + 6, gy + 6, x + 20, gy + 30, hex('#5d7480'));
  // the lot: unsold cars, dusty when stale
  let n = 0, hover = null; for (const m of live) { const px = sprite(m); if (!px) continue; const cnt = Math.min(8, Math.ceil((m.stock || 0) / 60)), d = dustOf(m); for (let k = 0; k < cnt && n < 8; k++, n++) { const x = 304 + (n % 4) * 44, y = 150 + Math.floor(n / 4) * 24; smallCar(S, P, px, x, y, 5, d); if (input.x >= x && input.x < x + 40 && input.y >= y && input.y < y + 20) hover = m; } }
  S.fill(300, 142, 176, 1, hex('#4a4136')); for (let x = 300; x < 476; x += 14) S.fill(x, 136, 1, 7, hex('#4a4136')); for (let x = 302; x < 474; x += 9) S.fill(x, 138 + ((x / 9) % 2), 5, 3, hex(x % 18 ? '#b0341f' : '#efe6cf'));   // bunting
  const ppl = Math.min(9, Math.round(sold / 60)); for (let k = 0; k < ppl; k++) { const x = ((t * (0.25 + (k % 3) * 0.1) + k * 67) % (W + 20)) - 10; man(S, Math.round(x), 196 + (k % 3) * 8, t + k * 9, hex(['#3a3f55', '#5a3a3a', '#3f5a40'][k % 3])); }   // passers-by and buyers
  topBar(S, `MAIN STREET DEALER - ${sold} CARS SOLD LAST MONTH`);
  let act = null; live.slice(0, 3).forEach((m, i) => { const y = 224 + i * 14; text(S, N(String(m.name).slice(0, 14)), 8, y + 3, C.ink); text(S, `${money(m.price)}  STOCK ${m.stock || 0}  ${m.stockAge || 0} MO${dustOf(m) > 0.5 ? '  DUSTY' : ''}`, 96, y + 3, dustOf(m) > 0.5 ? hex('#7a2a24') : C.ink, 1, 190);
    if (button(S, 292, y, 74, 12, 'CUT PRICE 5%', { tone: 'teal' })) act = { cut: m }; });
  if (!live.length) text(S, 'NOTHING TO SELL YET', 8, 230, C.ink);
  if (hover) { const s = `${hover.stock} IN STOCK - ${hover.stockAge || 0} MONTHS UNSOLD`; S.fill(input.x - 90, input.y - 22, tw(s) + 8, 20, C.ink); text(S, N(hover.name), input.x - 86, input.y - 19, C.brassL); text(S, s, input.x - 86, input.y - 10, C.paper); }
  if (button(S, W - 70, 252, 62, 14, 'CITY MAP', { tone: 'ox' })) return 'map';
  return act;
}
