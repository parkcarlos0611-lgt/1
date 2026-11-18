// Side-on test drive picture (plan 24-1): one pinhole camera beside the road, so the car, the road's width, trees,
// poles and hills all keep their real sizes and the horizon never moves (no motion sickness). The ground below the
// horizon is drawn pixel by pixel (land, far verge, the road band seen slightly from above, near verge); props and the
// car are sprites on top. The structure follows the side-scrolling layering of the sister tank project: sky, far
// ranges, rows of props hazed by distance, the drive line, a near foreground.
import { hex } from '../tools/pixel/color.mjs';

export const SW = 960, SH = 540;
const Hc = 3.2, Dc = 22, YREF = 404;          // camera 3.2 m up, 22 m out from the road's near edge; the car's road line sits at y 404
const DS = 2, hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
const ih = (a, b) => { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1); h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };

// ---- the scene canvas sits under the pixel UI; the UI is cleared to transparent while driving ----
let cv = null, ctx = null, img = null, u32 = null;
function ensure() { if (cv || typeof document === 'undefined') return; const scr = document.getElementById('screen'); if (!scr) return;
  cv = document.createElement('canvas'); cv.width = SW; cv.height = SH; cv.id = 'scene';
  cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;image-rendering:pixelated;display:none;pointer-events:none';
  scr.parentNode.insertBefore(cv, scr); scr.style.position = 'relative'; scr.style.zIndex = '1'; const sc = document.getElementById('scan'); if (sc) sc.style.zIndex = '2';
  ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; img = ctx.createImageData(SW, SH); u32 = new Uint32Array(img.data.buffer); }
export function showScene(on) { ensure(); if (cv) cv.style.display = on ? 'block' : 'none'; }

const rgb = h => { const c = hex(h); return [c[0], c[1], c[2]]; };
const pack = (r, g, b) => (255 << 24) | (Math.max(0, Math.min(255, b | 0)) << 16) | (Math.max(0, Math.min(255, g | 0)) << 8) | Math.max(0, Math.min(255, r | 0));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const K = { skyT: rgb('#6f93b2'), skyH: rgb('#d6dfd8'), haze: rgb('#c9d3cc'), far: rgb('#8ea2ae'), mid: rgb('#7f9682'), wood: rgb('#5d7653'),
  grass: rgb('#7d9a58'), grass2: rgb('#738f50'), verge: rgb('#89a55f'), wheat: rgb('#b8a86a'), plough: rgb('#8a7457'), hedge: rgb('#566f45'),
  tar: rgb('#68645f'), con: rgb('#a9a397'), brick: rgb('#8e5a44'), gravel: rgb('#8f7f66'), line: rgb('#e9e2cc'), skid: rgb('#34312e'), kerbR: rgb('#b0341f'), kerbW: rgb('#ece6d4'),
  soil: rgb('#6e5a42'), cloud: rgb('#f2f0ea') };

let PK = null;
function packs() { if (PK) return PK; const P1 = c => pack(c[0], c[1], c[2]), land = [K.grass, K.grass2, K.wheat, K.plough, K.hedge, mix(K.plough, K.soil, 0.4)].map(c => Array.from({ length: 16 }, (_, q) => P1(mix(c, K.haze, q / 16))));
  const road = b => [P1(b), P1(mix(b, [0, 0, 0], 0.07)), P1(mix(b, [255, 255, 255], 0.06)), P1(mix(b, [40, 30, 20], 0.3))];
  PK = { land, tar: road(K.tar), con: road(K.con), gravel: road(K.gravel), grass: P1(K.grass), grass2: P1(K.grass2), verge: P1(K.verge), soilG: P1(mix(K.grass, K.soil, 0.3)), kerbR: P1(K.kerbR), kerbW: P1(K.kerbW), line: P1(K.line), skid: P1(K.skid), ink: P1([20, 18, 20]), paper: P1([240, 234, 214]) };
  PK.con[3] = P1(mix(K.con, [0, 0, 0], 0.18)); return PK; }

// ---- track geometry along the drive line ----
const cellAt = (tr, s) => tr.cells[((Math.floor(s / DS) % tr.cells.length) + tr.cells.length) % tr.cells.length];
function elAt(tr, s) { const n = tr.cells.length, f = s / DS, i = Math.floor(f), t = f - i, a = tr.cells[(((i - 1) % n) + n) % n].el, b = tr.cells[((i % n) + n) % n].el; return a + (b - a) * t; }
// the outside of a banked turn rises: right-hand turns rise on the far side (n > 0 is the car's left, away from the camera)
const bankRise = (tr, c, d) => { if (!c.bank) return 0; const w = tr.width, t = c.k > 0 ? d / w : 1 - d / w; return Math.max(0, t - 0.25) / 0.75 * w * Math.tan(c.bank * Math.PI / 180); };

// ---- props: placed once per track along the line, at depths behind the road (or a few in front) ----
function placeProps(tr) { if (tr.props) return tr.props; const P = [], w = tr.width, L = tr.L, kind = tr.kind;
  for (let x = 0; x < L; x += 4) { const i = Math.floor(x / 4), r = ih(i, 7), r2 = ih(i, 11), r3 = ih(i, 23), c = cellAt(tr, x);
    if (r < 0.32) P.push({ x: x + r2 * 4, d: w + 9 + r3 * 70, k: r2 < 0.45 ? 'oak' : r2 < 0.7 ? 'poplar' : r2 < 0.85 ? 'pine' : 'bush', s: r3 });
    if (r > 0.92 && kind !== 'BANKED OVAL') P.push({ x: x + r2 * 4, d: w + 3 + r3 * 4, k: 'bush', s: r3 });
    if (kind === 'TEST ROAD' && i % 10 === 0) P.push({ x, d: w + 4.5, k: 'pole', s: 0 });
    if (kind === 'ROAD CIRCUIT' && i % 1 === 0 && x % 3 < 4) P.push({ x, d: w + 2, k: 'fence', s: 0 });
    if (kind !== 'BANKED OVAL' && Math.abs(c.k) > 1 / 200 && i % 2 === 0) P.push({ x, d: -2.2, k: 'bale', s: r3 });
    if (kind === 'TEST ROAD' && r3 > 0.985) P.push({ x, d: w + 22 + r * 30, k: r2 < 0.5 ? 'barn' : 'house', s: r2 });
    if (r3 < 0.06 && kind !== 'BANKED OVAL') P.push({ x: x + 1, d: -6 - r * 6, k: 'tuft', s: r2 }); }
  if (kind !== 'TEST ROAD') { P.push({ x: L - 60, d: w + 7, k: 'stand', s: 0 }); P.push({ x: L - 25, d: w + 7, k: 'stand', s: 1 }); P.push({ x: 40, d: w + 6, k: 'pits', s: 0 }); P.push({ x: 64, d: w + 6, k: 'pits', s: 1 }); }
  if (kind === 'BANKED OVAL') for (let x = 0; x < L; x += 12) P.push({ x, d: w + 1.2, k: 'wall', s: 0 });
  P.sort((a, b) => b.d - a.d); tr.props = P; return P; }

// prop pictures, drawn by code at 40 px per metre (to be replaced by the generated images of docs/DRIVE_IMAGES.md)
const PPM = 40, SPR = new Map();
function canvasOf(w, h, fn) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); const g = c.getContext('2d'); const id = g.createImageData(c.width, c.height), u = new Uint32Array(id.data.buffer);
  const put = (x, y, col) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < c.width && y < c.height) u[y * c.width + x] = pack(col[0], col[1], col[2]); }; fn(put, c.width, c.height); g.putImageData(id, 0, 0); return c; }
function blob(put, cx, cy, rx, ry, cols, seed) { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const q = (x / rx) ** 2 + (y / ry) ** 2, n = ih(x + seed * 97, y + 31) * 0.35; if (q > 1 - n * 0.6) continue;
  const lit = (-x / rx - y / ry) * 0.5 + (ih(Math.floor(x / 3) + seed, Math.floor(y / 3)) - 0.5) * 0.9; put(cx + x, cy + y, cols[lit > 0.35 ? 2 : lit > -0.3 ? 1 : 0]); } }
const LEAF = [rgb('#3f5a35'), rgb('#56724a'), rgb('#74905c')], LEAF2 = [rgb('#3a5232'), rgb('#4d6a42'), rgb('#66835a')], PINE = [rgb('#2f4630'), rgb('#3f5a3c'), rgb('#56724f')], BARK = rgb('#5d4b3a'), BARKD = rgb('#463729');
function makeSprite(k, s) {
  const M = v => v * PPM;
  if (k === 'oak') { const w = M(9), h = M(11); return { c: canvasOf(w, h, (put) => { for (let y = M(4); y < h; y++) for (let x = -M(0.3); x < M(0.3); x++) put(w / 2 + x, y, x < 0 ? BARK : BARKD);
      for (let q = 0; q < 7; q++) blob(put, w / 2 + (ih(q, s * 9) - 0.5) * M(5), M(3.6) + (ih(q, 3) - 0.5) * M(3), M(2.2 + ih(q, 5) * 1.4), M(1.8 + ih(q, 6)), s > 0.5 ? LEAF : LEAF2, q * 13 + s * 50); }), ax: 0.5, h: 11 }; }
  if (k === 'poplar') { const w = M(3), h = M(15); return { c: canvasOf(w, h, (put) => { for (let y = M(12); y < h; y++) for (let x = -M(0.15); x < M(0.15); x++) put(w / 2 + x, y, BARK);
      for (let q = 0; q < 6; q++) blob(put, w / 2 + (ih(q, 4) - 0.5) * M(0.6), M(2 + q * 1.8), M(1.2 - Math.abs(q - 2.5) * 0.08), M(1.7), LEAF2, q * 7 + s * 30); }), ax: 0.5, h: 15 }; }
  if (k === 'pine') { const w = M(5), h = M(12); return { c: canvasOf(w, h, (put) => { for (let y = M(2); y < h; y++) for (let x = -M(0.2); x < M(0.2); x++) put(w / 2 + x, y, BARKD);
      for (let q = 0; q < 6; q++) blob(put, w / 2 + (ih(q, 8) - 0.5) * M(1.4), M(1.5 + q * 1.4), M(1.3 + q * 0.25), M(0.8), PINE, q * 5 + s * 70); }), ax: 0.5, h: 12 }; }
  if (k === 'bush') { const w = M(3), h = M(1.6); return { c: canvasOf(w, h, (put) => { for (let q = 0; q < 3; q++) blob(put, M(0.8 + q * 0.7), M(0.95), M(0.75), M(0.62), LEAF, q * 3 + s * 20); }), ax: 0.5, h: 1.6 }; }
  if (k === 'pole') { const w = M(1.8), h = M(8); return { c: canvasOf(w, h, (put) => { for (let y = 0; y < h; y++) for (let x = -4; x < 4; x++) put(w / 2 + x, y, x < -1 ? BARK : BARKD);
      for (const ya of [M(0.5), M(1.2)]) { for (let x = 2; x < w - 2; x++) for (let y = 0; y < 4; y++) put(x, ya + y, BARKD); for (const xi of [6, w / 2 - 14, w / 2 + 14, w - 8]) for (let y = -6; y < 0; y++) for (let x = -2; x < 2; x++) put(xi + x, ya + y, rgb('#a9c4c0')); } }), ax: 0.5, h: 8 }; }
  if (k === 'fence') { const w = M(0.16), h = M(1.1); return { c: canvasOf(w, h, (put, W2, H2) => { for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) put(x, y, x < W2 / 2 ? rgb('#f1ebdc') : rgb('#cfc8b6')); }), ax: 0.5, h: 1.1, rail: rgb('#ece6d6') }; }
  if (k === 'bale') { const w = M(1.3), h = M(0.62); return { c: canvasOf(w, h, (put, W2, H2) => { for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const n = ih(x, y + s * 99); put(x, y, y < 3 ? rgb('#e2d08a') : n > 0.8 ? rgb('#a89458') : rgb('#c8b26a')); } }), ax: 0.5, h: 0.62 }; }
  if (k === 'tuft') { const w = M(0.9), h = M(0.7); return { c: canvasOf(w, h, (put, W2, H2) => { for (let q = 0; q < 14; q++) { const x0 = ih(q, s * 50) * W2, hh = H2 * (0.4 + ih(q, 9) * 0.6), lean = (ih(q, 4) - 0.5) * 8; for (let y = 0; y < hh; y++) put(x0 + lean * y / hh, H2 - 1 - y, y > hh * 0.7 ? rgb('#9ab56c') : rgb('#6f8c4c')); } }), ax: 0.5, h: 0.7 }; }
  if (k === 'barn' || k === 'house') { const barn = k === 'barn', w = M(barn ? 14 : 11), h = M(barn ? 9 : 8); return { c: canvasOf(w, h, (put, W2, H2) => { const wall = barn ? rgb('#8e3b2c') : rgb('#d9cfb6'), wallD = barn ? rgb('#74301f') : rgb('#bfb49a'), roof = barn ? rgb('#5a4f4a') : rgb('#6e4a3a'), ry = H2 * 0.42;
      for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const inRoof = y < ry && Math.abs(x - W2 / 2) < (y / ry) * W2 * 0.52; if (inRoof) put(x, y, (y + x) % 9 < 1 ? wallD : roof); else if (y >= ry) put(x, y, x % (barn ? 10 : 40) < 1 ? wallD : wall); }
      const win = barn ? [[W2 * 0.4, H2 * 0.55, W2 * 0.2, H2 * 0.45]] : [[W2 * 0.15, H2 * 0.56, M(1.2), M(1.4)], [W2 * 0.7, H2 * 0.56, M(1.2), M(1.4)], [W2 * 0.45, H2 * 0.62, M(1.1), H2 * 0.38]];
      for (const [x0, y0, ww, hh] of win) for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) put(x0 + x, y0 + y, barn ? (x % 14 < 1 ? wallD : rgb('#6a2a20')) : rgb('#3a4048')); }), ax: 0.5, h: barn ? 9 : 8 }; }
  if (k === 'stand') { const w = M(24), h = M(8); return { c: canvasOf(w, h, (put, W2, H2) => { for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const tier = Math.floor((y - M(1.6)) / M(0.9));
      if (y < M(1.2)) put(x, y, y < 6 ? rgb('#5a4a38') : rgb('#7a2a22')); else if (y < M(1.6)) put(x, y, rgb('#3a3028')); else { const person = tier >= 0 && tier < 6 && (y - M(1.6)) % M(0.9) < M(0.55) && ih(Math.floor(x / 9), tier + s * 10) > 0.35; put(x, y, person ? [rgb('#3a3440'), rgb('#7a2a22'), rgb('#d8cfb8'), rgb('#55606a')][Math.floor(ih(Math.floor(x / 9), tier) * 4)] : tier % 2 ? rgb('#8a7e6a') : rgb('#9e927c')); } }
      for (let x = 0; x < W2; x += M(4)) for (let y = M(1.2); y < H2; y++) for (let q = 0; q < 6; q++) put(x + q, y, rgb('#4a3c2e')); }), ax: 0.5, h: 8 }; }
  if (k === 'pits') { const w = M(20), h = M(4.4); return { c: canvasOf(w, h, (put, W2, H2) => { for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const roof = y < M(0.5), door = y > M(1.6) && (x % M(5)) > M(0.8) && (x % M(5)) < M(4.2);
      put(x, y, roof ? rgb('#7a2a22') : door ? (y % 8 < 1 ? rgb('#2c2c30') : rgb('#3a3a40')) : rgb('#d8cfb8')); } }), ax: 0.5, h: 4.4 }; }
  if (k === 'wall') { const w = M(12), h = M(1.4); return { c: canvasOf(w, h, (put, W2, H2) => { for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) put(x, y, y < 5 ? rgb('#d9d2c2') : x % M(3) < 2 ? rgb('#9d9686') : rgb('#c9c2b2')); }), ax: 0, h: 1.4 }; }
  return null; }
// a hazed copy for distant rows (blended toward the horizon colour), cached per step
function sprite(k, s, haze) { const step = Math.min(4, Math.round(haze * 8)), seed = Math.floor(s * 4) / 4, key = k + seed + ':' + step; if (SPR.has(key)) return SPR.get(key);
  let o; if (step === 0) o = makeSprite(k, seed); else { const b = sprite(k, s, 0); if (!b) return null; const c = document.createElement('canvas'); c.width = b.c.width; c.height = b.c.height; const g = c.getContext('2d'); g.drawImage(b.c, 0, 0);
    const id = g.getImageData(0, 0, c.width, c.height), d = id.data, t = step / 8; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] += (K.haze[0] - d[i]) * t; d[i + 1] += (K.haze[1] - d[i + 1]) * t; d[i + 2] += (K.haze[2] - d[i + 2]) * t; } g.putImageData(id, 0, 0); o = { ...b, c }; }
  SPR.set(key, o); return o; }

// ---- the car: body, wheel well and wheels as separate pictures (right-hand side view: nose to the right) ----
// side(): { px (left-view Pix at 25 mm/px, nose left), wheels: [{ x, y, r }] centres in px, front first, frames(n) -> [[Pix per wheel] per frame] }
function pixCanvas(P, px, keep, mirror, dim = 1) { const c = document.createElement('canvas'); c.width = px.w; c.height = px.h; const g = c.getContext('2d'), id = g.createImageData(px.w, px.h), u = new Uint32Array(id.data.buffer);
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) { const i = y * px.w + x; if (!px.r[i]) continue; const col = keep(i, x, y); if (!col) continue; const X = mirror ? px.w - 1 - x : x; u[y * px.w + X] = pack(col[0] * dim, col[1] * dim, col[2] * dim); }
  g.putImageData(id, 0, 0); return c; }
const colOf = (P, px, i) => { const ramp = P.ramps[px.r[i]], lv = px.l[i]; if (!ramp) return null; return lv < 0 ? ramp.o : ramp.c[Math.max(0, Math.min(ramp.c.length - 1, lv))]; };
function carParts(P, src) { const { px, wheels } = src, W2 = px.w, gnd = px.h - 3, TAG_SHADOW = 1, TAG_WHEEL = 3;
  const body = pixCanvas(P, px, i => (px.t[i] === TAG_SHADOW || px.t[i] === TAG_WHEEL ? null : colOf(P, px, i)), true);
  // the arch behind the wheel: where the wheel was drawn above its centre, dark (seen when the wheel drops)
  const wellC = [22, 19, 17]; const well = pixCanvas(P, px, (i, x, y) => { if (px.t[i] !== TAG_WHEEL) return null; const w = wheels.reduce((a, q) => (Math.abs(q.x - x) < Math.abs(a.x - x) ? q : a)); return y < w.y ? wellC : null; }, true);
  const ws = wheels.map(w => ({ x: W2 - w.x, y: w.y, r: w.r }));                  // mirrored: front wheel now on the right
  const NF = 16, frames = src.frames(NF).map(set => set.map(wp => ({ near: pixCanvas(P, wp, i => colOf(P, wp, i), false), far: pixCanvas(P, wp, i => colOf(P, wp, i), false, 0.5) })));
  // fast wheels blur into a disc: the average of all frames
  const blur = ws.map((_, j) => { const f0 = frames[0][j].near, c = document.createElement('canvas'); c.width = f0.width; c.height = f0.height; const g = c.getContext('2d'); g.globalAlpha = 1 / NF * 1.6; for (const fr of frames) g.drawImage(fr[j].near, 0, 0); return c; });
  return { body, well, ws, frames, blur, NF, gnd, W: W2, H: px.h, ppm: 1000 / (px.mm || 25) }; }

// ---- one frame ----
export function drawSide(P, D, side) {
  ensure(); if (!ctx) return; const C = D.C, tr = D.tr, w = tr.width, hw = w / 2, L = tr.L; placeProps(tr);
  if (!D.parts && side) D.parts = carParts(P, side());
  const V = D.sv || (D.sv = { camX: C.s, camEl: elAt(tr, C.s), ppm: 40, lead: 0 }), u = C.u;
  // zoom: 40 px per metre at the car, easing out to 26 at speed; the camera leads the car in the direction it moves
  const ppmT = 40 - 14 * Math.min(1, Math.max(0, (Math.abs(u) - 6) / 30)); V.ppm += (ppmT - V.ppm) * 0.02;
  const dCar = Math.max(-1, Math.min(w + 1, C.n + hw)), d0 = hw / 2, f = V.ppm * (Dc + d0);
  const leadT = Math.max(-1, Math.min(1, u / 25)) * 0.24 * SW / V.ppm; V.lead += (leadT - V.lead) * 0.03; V.camX = C.s + V.lead;
  V.camEl += (elAt(tr, C.s) - V.camEl) * 0.04;
  const camX = V.camX, camEl = V.camEl, yH = YREF - Hc * f / (Dc + d0);
  const PX = (x, d) => SW / 2 + (x - camX) * f / (Dc + d), PY = (e, d) => yH + (camEl + Hc - e) * f / (Dc + d);
  // ---- sky and far ranges (rows above the horizon) ----
  const yh = Math.floor(yH);
  for (let y = 0; y < SH; y++) { const t = Math.min(1, Math.max(0, y / Math.max(1, yH))), c = mix(K.skyT, K.skyH, t * t); u32.fill(pack(c[0], c[1], c[2]), y * SW, (y + 1) * SW); }
  for (let q = 0; q < 9; q++) { const cx0 = ((q * 311 - camX * 0.6 - D.t * 3) % (SW + 400) + SW + 400) % (SW + 400) - 200, cy0 = 30 + (q * 53) % 120, rw = 50 + (q * 37) % 70;
    for (let r = 0; r < 14; r++) { const ww = rw * Math.sqrt(1 - ((r - 7) / 8) ** 2), y = Math.round(cy0 + r); if (y < 0 || y >= yh) continue; const a = Math.max(0, Math.round(cx0 - ww)), b = Math.min(SW, Math.round(cx0 + ww)); if (b > a) u32.fill(pack(...(r < 9 ? K.cloud : mix(K.cloud, K.skyH, 0.35))), y * SW + a, y * SW + b); } }
  const RANGES = [{ D: 3200, h: x => 160 + 120 * Math.sin(x * 0.0021) + 60 * Math.sin(x * 0.0057 + 1), col: mix(K.far, K.skyH, 0.35) }, { D: 1100, h: x => 45 + 30 * Math.sin(x * 0.006 + 2) + 14 * Math.sin(x * 0.019), col: K.mid },
    { D: 320, h: x => 14 + 4 * Math.sin(x * 0.05) + 3 * (ih(Math.floor(x / 6), 3) - 0.5) + 2.5 * Math.sin(x * 0.4), col: mix(K.wood, K.haze, 0.3) }];
  for (const R of RANGES) { const sc = f / (Dc + R.D), cP = pack(...R.col), cL = pack(...mix(R.col, [255, 255, 240], 0.12));
    for (let X = 0; X < SW; X++) { const xw = camX + (X - SW / 2) / sc, top = Math.max(0, Math.round(yH - R.h(xw) * sc)), bot = Math.min(SH - 1, Math.ceil(PY(camEl, R.D)));
      for (let y = top; y <= bot; y++) u32[y * SW + X] = y - top < 2 ? cL : cP; } }
  // ---- ground: land, far verge, road band, near verge, column by column (packed colours, no allocation per pixel) ----
  const surf = tr.surf, skid = D.skid, Q = packs(), step = D.drawMs > 11 ? 2 : 1, y0 = Math.max(0, yh + 1), kerbTrack = tr.kind !== 'TEST ROAD';
  const invT = D._invT || (D._invT = new Float32Array(SH)); for (let y = 0; y < SH; y++) invT[y] = f / (y - yH || 1e-3);
  const roadPk = surf === 'con' ? Q.con : Q.tar, topY = D._topY || (D._topY = new Float32Array(SW));
  for (let X = 0; X < SW; X += step) {
    const x0 = camX + (X - SW / 2) * (Dc + d0) / f, c = cellAt(tr, x0), e = elAt(tr, x0), eL = Math.min(e, camEl + Hc - 0.4), k2 = Math.floor(x0 / DS), xs = (X - SW / 2) / f;
    const eN = e + bankRise(tr, c, 0), eF = e + bankRise(tr, c, w), yN = PY(eN, 0), yF = PY(eF, w), yV = Math.min(PY(eL, w + 2.5), c.bank ? yF : 1e9);
    topY[X] = yF; if (step === 2 && X + 1 < SW) topY[X + 1] = yF;
    const rough = c.rough, rp = rough ? Q.gravel : roadPk, kerb = kerbTrack && Math.abs(c.k) > 1 / 400, hL = camEl + Hc - eL, hF = camEl + Hc - eF, hN = camEl + Hc - eN;
    for (let y = Math.max(0, Math.min(y0, Math.floor(yF))); y < SH; y++) { let pk;   // a banked wall can rise above the horizon
      if (y < yV) {                                                                                       // land behind the road, hazed with distance
        let dd = hL * invT[y] - Dc; if (dd < w) dd = w + 2.5; const xw = camX + xs * (Dc + dd), patch = ih(Math.floor(xw / 38), Math.floor(dd / 26));
        const ci = (dd % 52) < 1.6 + dd * 0.01 ? 4 : patch < 0.45 ? (ih(Math.floor(xw * 2), Math.floor(dd)) > 0.5 ? 0 : 1) : patch < 0.75 ? 2 : (Math.floor(dd * 1.5) % 2 ? 5 : 3);
        pk = Q.land[ci][Math.min(15, Math.floor((1 - Math.exp(-dd / 380)) * 16))]; }
      else if (y < yF) { const dd = Math.max(w, hF * invT[y] - Dc), xw = camX + xs * (Dc + dd);
        pk = kerb && dd < w + 0.5 ? (Math.floor(xw / 1.2) % 2 ? Q.kerbR : Q.kerbW) : ih(Math.floor(xw * 3), Math.floor(dd * 3)) > 0.6 ? Q.grass2 : Q.verge; }
      else if (y <= yN) {                                                                                 // the road band
        const dd = yN === yF ? 0 : w * (yN - y) / (yN - yF), xw = camX + xs * (Dc + dd), n = ih(Math.floor(xw * 5), Math.floor(dd * 5));
        pk = n > 0.86 ? rp[1] : n < 0.08 ? rp[2] : rp[0]; if (rough && n > 0.93) pk = rp[3];
        if (surf === 'con' && !rough && ((xw % 6) + 6) % 6 < 0.12) pk = rp[3]; }
      else { let dd = hN * invT[y] - Dc; if (dd > 0) dd = 0; const xw = camX + xs * (Dc + Math.max(-Dc + 1, dd)), n = ih(Math.floor(xw * 4), Math.floor(dd * 4));   // near verge and field
        pk = dd > -0.5 && kerb ? (Math.floor(xw / 1.2) % 2 ? Q.kerbR : Q.kerbW) : surf === 'con' && dd > -0.6 ? Q.con[0] : dd > -1.4 ? (n > 0.7 ? Q.grass2 : Q.verge) : n > 0.82 ? Q.grass2 : n < 0.12 ? Q.soilG : Q.grass; }
      const i = y * SW + X; u32[i] = pk; if (step === 2 && X + 1 < SW) u32[i + 1] = pk; }
    // painted lines, start line and tyre marks: one row each, at the row of their depth
    const rowAt = dd => Math.round(yN + (yF - yN) * dd / w), paint = (dd, pk) => { const y = rowAt(dd); if (y >= 0 && y < SH) { u32[y * SW + X] = pk; if (step === 2 && X + 1 < SW) u32[y * SW + X + 1] = pk; } };
    if (!rough && surf !== 'con') { paint(0.3, Q.line); paint(w - 0.3, Q.line); if (Math.floor(x0 / 3) % 2 === 0) paint(w / 2, Q.line); }
    if (((x0 % L) + L) % L < 1.2) for (let q = 0; q <= w * 2; q++) paint(q / 2, (Math.floor(x0 * 2) + q) % 2 ? Q.ink : Q.paper);
    const mk = skid.get(k2); if (mk) for (const mn of mk) paint(mn + hw, Q.skid);
  }
  ctx.putImageData(img, 0, 0);
  // ---- props behind the road, far to near (fences joined by rails, poles by wires) ----
  const props = tr.props, span = (SW / 2 + 200) * (Dc + 120) / f, lapB = Math.floor(camX / L) * L, near = [];
  let lastFence = null, lastPole = null;
  const drawProp = (p, x) => { const sc = f / (Dc + p.d) / PPM, e = elAt(tr, x), haze = p.d > w ? Math.min(0.5, (p.d - w) / 160) : 0, S2 = sprite(p.k, p.s, haze); if (!S2) return;
    const X = PX(x, p.d), Y = PY(e + (p.k === 'wall' ? bankRise(tr, cellAt(tr, x), w) : 0), p.d), dw = S2.c.width * sc, dh = S2.c.height * sc; if (X + dw < 0 || X - dw > SW) return;
    ctx.drawImage(S2.c, Math.round(X - dw * S2.ax), Math.round(Y - dh), Math.max(1, Math.round(dw)), Math.max(1, Math.round(dh)));
    if (p.k === 'fence') { if (lastFence && Math.abs(lastFence[0] - X) < 60 * sc * PPM / 10) { ctx.fillStyle = '#ece6d6'; for (const hgt of [0.95, 0.55]) ctx.fillRect(Math.round(Math.min(lastFence[0], X)), Math.round(Y - hgt * sc * PPM), Math.round(Math.abs(X - lastFence[0])), Math.max(1, Math.round(0.08 * sc * PPM))); } lastFence = [X, Y]; }
    if (p.k === 'pole') { if (lastPole) { ctx.strokeStyle = 'rgba(40,36,32,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); for (const off of [-0.6, 0.6]) { ctx.moveTo(lastPole[0] + off * sc * PPM, lastPole[1] - 7.6 * sc * PPM); ctx.quadraticCurveTo((lastPole[0] + X) / 2, (lastPole[1] + Y) / 2 - 7.2 * sc * PPM, X + off * sc * PPM, Y - 7.6 * sc * PPM); } ctx.stroke(); } lastPole = [X, Y]; } };
  // things behind the road are hidden below its far edge (on the banking, by the wall of concrete)
  ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); for (let X = 0; X <= SW; X += 4) ctx.lineTo(X, topY[Math.min(SW - 1, X)] + 1); ctx.lineTo(SW, 0); ctx.closePath(); ctx.clip();
  for (const p of props) { if (p.d < 0) { near.push(p); continue; } for (const lap of [-L, 0, L]) { const x = p.x + lapB + lap; if (Math.abs(x - camX) < span) drawProp(p, x); } }
  ctx.restore();
  // ---- the car ----
  if (D.parts) drawCar(D, D.parts, PX, PY, f, dCar);
  // ---- smoke, dust and grass in the world ----
  for (const p of D.fx) { const dd = p.n + hw, sc = f / (Dc + dd), X = PX(p.s, dd), Y = PY(elAt(tr, p.s) + p.h, dd), r = Math.min(18, Math.max(1, p.size * sc)), a = p.a * Math.min(1, p.life);
    ctx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${(a * 0.55).toFixed(3)})`; ctx.beginPath(); ctx.arc(Math.round(X), Math.round(Y), r, 0, Math.PI * 2); ctx.fill(); }
  // ---- near side props: bales on the bends, tufts in the foreground ----
  for (const p of near) for (const lap of [-L, 0, L]) { const x = p.x + lapB + lap; if (Math.abs(x - camX) < span) drawProp(p, x); }
}

// body follows the road under its axles plus its own heave and pitch; each wheel sits on its own corner
function drawCar(D, Pt, PX, PY, f, dCar) {
  const C = D.C, tr = D.tr, wb = C.wb, sc = f / (Dc + dCar) / Pt.ppm, scFar = f / (Dc + dCar + C.tr) / Pt.ppm, ppmS = f / (Dc + dCar);
  const [fw, rw] = Pt.ws, pxWb = fw.x - rw.x, xCGpx = rw.x + pxWb * (C.b / wb), dir = Math.cos(C.psi) >= 0 ? 1 : -1, squeeze = Math.max(0.3, Math.abs(Math.cos(C.psi))) * dir;
  const eRoad = s => elAt(tr, s) + bankRise(tr, cellAt(tr, s), Math.max(0, Math.min(tr.width, dCar))), sF = C.s + C.a * dir, sR = C.s - C.b * dir, eF = eRoad(sF), eR = eRoad(sR);
  const theta = Math.atan2(eF - eR, wb) * dir, eCG = eR + (eF - eR) * C.b / wb, zNear = C.z - (C.tr / 2) * C.roll, ang = theta - C.pitch * dir;
  // shadow: the sun high and a little behind on the left, the car's plan laid on the road
  const sx0 = PX(C.s - (Pt.W - xCGpx) / Pt.ppm * 1.0, dCar - 0.2), sx1 = PX(C.s + xCGpx / Pt.ppm, dCar + C.tr + 0.4), sy0 = PY(eCG, dCar - 0.2), sy1 = PY(eCG, dCar + C.tr + 0.4);
  const g = (D._ctx = ctx); g.fillStyle = 'rgba(28,22,16,0.34)'; g.beginPath(); g.moveTo(Math.min(sx0, sx1) + 8, sy0); g.lineTo(Math.max(sx0, sx1) - 4, sy0); g.lineTo(Math.max(sx0, sx1) + 6, sy1); g.lineTo(Math.min(sx0, sx1) + 14, sy1); g.closePath(); g.fill();
  const corner = (i) => C.corners[i];
  const wheelAt = (wpos, ci, far) => { const c = corner(ci), sW = C.s + (wpos.x - xCGpx) / Pt.ppm * squeeze, dd = dCar + (far ? C.tr : 0), e = elAt(tr, sW) + bankRise(tr, cellAt(tr, sW), Math.max(0, Math.min(tr.width, dd))), rM = (Pt.gnd - wpos.y) / Pt.ppm;
    const X = PX(sW, dd), Y = PY(e + rM + (c.zw || 0), dd); const fast = Math.abs(c.w) > 28, fr = ((Math.floor(-c.spin / (2 * Math.PI) * Pt.NF) % Pt.NF) + Pt.NF) % Pt.NF;
    const j = Pt.ws.indexOf(wpos), cvs = fast && !far ? Pt.blur[j] : Pt.frames[fr][j][far ? 'far' : 'near'], s2 = far ? scFar : sc, ww = cvs.width * s2, hh = cvs.height * s2;
    ctx.drawImage(cvs, Math.round(X - ww / 2), Math.round(Y - hh / 2), Math.round(ww), Math.round(hh)); };
  // far wheels behind everything, then the arch, the near wheels, the body over their tops
  wheelAt(fw, 0, true); wheelAt(rw, 2, true);
  const X0 = PX(C.s, dCar), Y0 = PY(eCG + zNear, dCar);
  const body = (cvs) => { ctx.save(); ctx.translate(Math.round(X0), Math.round(Y0)); ctx.rotate(-ang); ctx.scale(sc * squeeze, sc); ctx.drawImage(cvs, -Math.round(xCGpx), -Pt.gnd); ctx.restore(); };
  body(Pt.well); wheelAt(fw, 1, false); wheelAt(rw, 3, false); body(Pt.body);
  void ppmS; }
