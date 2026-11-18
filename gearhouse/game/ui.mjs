// Pixel UI kit: everything is drawn into a 480x270 indexed-style RGBA buffer and scaled by an integer factor.
// Look: 1930s works office - walnut desk, cream drafting paper, brass bevels, oxblood enamel title plates, rivets.
import { Sheet, drawPix } from '../tools/pixel/pix.mjs';
import { hex } from '../tools/pixel/color.mjs';
import { tr } from './i18n.mjs';
import { FONT } from './font_ko.mjs';
export const lang = { ko: false };

export const W = 480, H = 270;
// integer-snap every fill (fractional coordinates would write into the wrong RGBA byte offsets)
export const clip = { on: false, x0: 0, y0: 0, x1: 0, y1: 0 };
const _fill = Sheet.prototype.fill; Sheet.prototype.fill = function (x, y, w, h, c) { x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (clip.on) { const x1 = Math.min(x + w, clip.x1), y1 = Math.min(y + h, clip.y1); x = Math.max(x, clip.x0); y = Math.max(y, clip.y0); w = x1 - x; h = y1 - y; if (w <= 0 || h <= 0) return; } _fill.call(this, x, y, w, h, c); };
const _blend = Sheet.prototype.blend; Sheet.prototype.blend = function (x, y, c, a) { if (clip.on && (x < clip.x0 || y < clip.y0 || x >= clip.x1 || y >= clip.y1)) return; _blend.call(this, x, y, c, a); };
export const C = {
  desk: hex('#2a1d17'), desk2: hex('#33241c'), ink: hex('#2b2320'), inkSoft: hex('#6d5e52'), paper: hex('#e9dfc8'), paper2: hex('#ddd0b3'), paperDark: hex('#c7b792'),
  brass: hex('#c9a24a'), brassL: hex('#f0d68a'), brassD: hex('#7a5a22'), oxblood: hex('#7a2a24'), oxL: hex('#a8453a'), oxD: hex('#4a1814'), teal: hex('#2f6b6a'), tealL: hex('#5fa3a0'),
  green: hex('#3f6b3a'), red: hex('#a8342a'), black: hex('#120d0b'), white: hex('#fbf6e8'), grid: hex('#cfc2a2'), amber: hex('#e0a53a'), sky: hex('#7fa7b5') };

// ---- 3x5 font (extended: punctuation, $, %, arrows) ----
const G = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110', '-': '000000111000000', '/': '001001010100100', '.': '000000000000010', ':': '000010000010000',
  '(': '010100100100010', ')': '010001001001010', '+': '000010111010000', '=': '000111000111000', ',': '000000000010100', '$': '011110010011110', '%': '101001010100101', '!': '010010010000010', '?': '110001010000010',
  '<': '001010100010001', '>': '100010001010100', "'": '010010000000000', '#': '101111101111101', '&': '010101010101011', '[': '110100100100110', ']': '011001001001011', '_': '000000000000111', '*': '000101010101000', '"': '101101000000000', '^': '010101000000000', '~': '000011110000000', '|': '010010010010010' };
// Korean mode: phrase-translate, then draw Galmuri7 bitmap glyphs (7px Hangul) - baseline 7px below y
// full Hangul set for player-typed names, loaded the first time it is needed
let FULLG = null, fullLoading = false;
export function ensureFullFont() { if (FULLG || fullLoading) return; fullLoading = true; import('./font_ko_full.mjs').then(m => { FULLG = m.decode(); }).catch(() => { fullLoading = false; }); }
const glyph = cp => FONT.g[cp] || (FULLG && FULLG[cp]) || ((cp > 0x2fff && ensureFullFont()), FONT.g[63]);
export const N = name => '\u0001' + String(name ?? '') + '\u0002';     // mark a player name: drawn as typed, never translated
const MARK = ch => ch === '\u0001' || ch === '\u0002';
function glyphText(s, str, x, y, c, maxW) { let cx = x; const yb = y + 7;
  for (const ch of str) { if (MARK(ch)) continue; const g = glyph(ch.codePointAt(0)); const [dw, bw, bh, xo, yo] = g; if (maxW && cx + dw - x > maxW) break;
    for (let j = 0; j < bh; j++) { const row = g[5 + j]; for (let i = 0; i < bw; i++) if ((row >> (bw - 1 - i)) & 1) s.fill(cx + xo + i, yb - (bh + yo) + j, 1, 1, c); } cx += dw; } return cx; }
export function text(s, str, x, y, c = C.ink, sc = 1, maxW = 0) { str = String(str).toUpperCase(); x = Math.round(x); y = Math.round(y);
  if (lang.ko && sc === 1) return glyphText(s, tr(str), x, y - 1, c, maxW);
  let cx = x;
  for (const ch of str) { if (MARK(ch)) continue; const cp = ch.codePointAt(0);
    if (cp > 127 && sc === 1) { const gg = glyph(cp); if (maxW && cx + gg[0] - x > maxW) break; cx = glyphText(s, ch, cx, y - 1, c, 0); continue; }   // Korean letters inside an English screen
    if (maxW && cx + 4 * sc - x > maxW) break; const g = G[ch]; if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') s.fill(cx + (i % 3) * sc, y + Math.floor(i / 3) * sc, sc, sc, c); cx += 4 * sc; } return cx; }
export const tw = (str, sc = 1) => { str = String(str).toUpperCase(); if (lang.ko && sc === 1) { let w = 0; for (const ch of tr(str)) if (!MARK(ch)) w += glyph(ch.codePointAt(0))[0]; return w - 1; } let w = 0; for (const ch of str) { if (MARK(ch)) continue; const cp = ch.codePointAt(0); w += cp > 127 && sc === 1 ? glyph(cp)[0] : 4 * sc; } return w - sc; };

// ---- input / immediate-mode widgets ----
export const hooks = { click: null };
export const input = { x: -1, y: -1, down: false, clicked: false, released: false, wheel: 0, key: null, hot: null, drag: null };
const inside = (x, y, w, h) => input.x >= x && input.x < x + w && input.y >= y && input.y < y + h && (!clip.on || (input.x >= clip.x0 && input.x < clip.x1 && input.y >= clip.y0 && input.y < clip.y1));
export function bevel(s, x, y, w, h, face, light, dark, inset = false) {
  s.fill(x, y, w, h, C.black); s.fill(x + 1, y + 1, w - 2, h - 2, face);
  s.fill(x + 1, y + 1, w - 2, 1, inset ? dark : light); s.fill(x + 1, y + 1, 1, h - 2, inset ? dark : light);
  s.fill(x + 1, y + h - 2, w - 2, 1, inset ? light : dark); s.fill(x + w - 2, y + 1, 1, h - 2, inset ? light : dark); }
const dither = (s, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = (j & 1); i < w; i += 2) if (((x + i) * 7 + (y + j) * 3) % 5 === 0) s.fill(x + i, y + j, 1, 1, c); };
export function rivet(s, x, y) { s.fill(x, y, 2, 2, C.brassD); s.fill(x, y, 1, 1, C.brassL); }
// window: brass frame, oxblood enamel title plate with rivets, cream paper body
export function windowBox(s, x, y, w, h, title, { close = false } = {}) {
  s.fill(x + 3, y + 3, w, h, [0, 0, 0]);                                   // drop shadow
  bevel(s, x, y, w, h, C.brass, C.brassL, C.brassD);
  s.fill(x + 3, y + 3, w - 6, 12, C.oxblood); s.fill(x + 3, y + 3, w - 6, 1, C.oxL); s.fill(x + 3, y + 14, w - 6, 1, C.oxD);
  rivet(s, x + 5, y + 8); rivet(s, x + w - 7, y + 8);
  text(s, title, x + 11, y + 7, C.brassL);
  s.fill(x + 3, y + 16, w - 6, h - 19, C.paper); dither(s, x + 3, y + 16, w - 6, h - 19, C.paper2);
  s.fill(x + 3, y + 16, w - 6, 1, C.paperDark);
  if (close) return button(s, x + w - 17, y + 4, 11, 10, 'X', { tone: 'ox' });
  return false; }
export function panel(s, x, y, w, h, title) { s.fill(x, y, w, h, C.paperDark); s.fill(x + 1, y + 1, w - 2, h - 2, C.paper); if (title) { s.fill(x + 1, y + 1, w - 2, 7, C.paper2); text(s, title, x + 3, y + 2, C.inkSoft); } }
export function button(s, x, y, w, h, label, { tone = 'brass', disabled = false, active = false } = {}) {
  const hov = !disabled && inside(x, y, w, h), press = hov && input.down;
  const T = tone === 'ox' ? [C.oxblood, C.oxL, C.oxD, C.brassL] : tone === 'teal' ? [C.teal, C.tealL, hex('#1b3f3e'), C.white] : [C.brass, C.brassL, C.brassD, C.ink];
  bevel(s, x, y, w, h, disabled ? C.paperDark : active ? T[2] : hov ? T[1] : T[0], disabled ? C.paper : T[1], disabled ? C.inkSoft : T[2], press || active);
  const lc = disabled ? C.inkSoft : active ? C.white : T[3]; text(s, label, x + Math.floor((w - tw(label)) / 2) + (press ? 1 : 0), y + Math.floor((h - 5) / 2) + (press ? 1 : 0), lc);
  const hit = hov && input.clicked && !disabled; if (hit && hooks.click) hooks.click(); return hit; }
// horizontal slider; returns new value
export function slider(s, x, y, w, label, v, lo, hi, { step = 0, fmt = n => n.toFixed(2), id } = {}) {
  const vs = fmt(v); text(s, label, x, y, C.ink, 1, Math.max(10, w - tw(vs) - 4)); text(s, vs, x + w - tw(vs), y, C.oxblood);
  const gy = y + 8; s.fill(x, gy + 2, w, 3, C.paperDark); s.fill(x, gy + 2, w, 1, C.inkSoft);
  const key = id || label; if (input.clicked && inside(x - 2, gy - 2, w + 4, 10)) input.drag = key;
  if (input.drag === key) { if (!input.down) input.drag = null; else { let t = Math.max(0, Math.min(1, (input.x - x) / w)); v = lo + (hi - lo) * t; if (step) v = Math.round(v / step) * step; } }
  if (inside(x - 2, gy - 2, w + 4, 10) && input.wheel) { v -= Math.sign(input.wheel) * (step || (hi - lo) / 50); v = Math.max(lo, Math.min(hi, v)); }
  const kx = x + Math.round((v - lo) / (hi - lo) * w) - 2; bevel(s, kx, gy, 5, 7, C.brass, C.brassL, C.brassD);
  return v; }
// cycle selector  < value >
export function cycler(s, x, y, w, label, opts, cur, { names = o => o, lock = () => false } = {}) {
  text(s, label, x, y, C.ink); const i = Math.max(0, opts.indexOf(cur)); let ni = i;
  if (button(s, x, y + 7, 9, 9, '<')) ni = (i - 1 + opts.length) % opts.length;
  if (button(s, x + w - 9, y + 7, 9, 9, '>')) ni = (i + 1) % opts.length;
  s.fill(x + 10, y + 7, w - 20, 9, C.white); s.fill(x + 10, y + 7, w - 20, 1, C.paperDark);
  const nm = String(names(opts[ni])); text(s, nm, x + 12, y + 9, lock(opts[ni]) ? C.red : C.ink, 1, w - 24);
  return opts[ni]; }
export function bar(s, x, y, w, h, t, col = C.teal) { s.fill(x, y, w, h, C.paperDark); s.fill(x + 1, y + 1, Math.max(0, Math.round((w - 2) * Math.max(0, Math.min(1, t)))), h - 2, col); }
export function stat(s, x, y, label, val, col = C.ink, off = 56) { text(s, label, x, y, C.inkSoft, 1, off - 3); text(s, val, x + off, y, col); }
// line graph on graph paper
export function graph(s, x, y, w, h, series, { min = 0, max = null, labels = [] } = {}) {
  s.fill(x, y, w, h, C.white); for (let gx = x; gx < x + w; gx += 8) s.fill(gx, y, 1, h, C.grid); for (let gy = y; gy < y + h; gy += 8) s.fill(x, gy, w, 1, C.grid);
  s.fill(x, y + h - 1, w, 1, C.inkSoft); s.fill(x, y, 1, h, C.inkSoft);
  const mx = max ?? Math.max(1e-9, ...series.flatMap(sr => sr.pts)); series.forEach((sr, k) => { let px = null, py = null;
    sr.pts.forEach((v, i) => { if (Number.isNaN(v)) { px = null; return; } const gx = x + 1 + Math.round(i / Math.max(1, sr.pts.length - 1) * (w - 3)), gy = y + h - 2 - Math.round((v - min) / (mx - min) * (h - 4));
      if (px != null) lineTo(s, px, py, gx, gy, sr.c); px = gx; py = gy; }); });
  labels.forEach((l, i) => text(s, l.t, x + 3, y + 3 + i * 7, l.c)); }
export function lineTo(s, x0, y0, x1, y1, c) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); if (![x0, y0, x1, y1].every(Number.isFinite)) return; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { s.fill(x0, y0, 1, 1, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
export function desk(s, t) { s.fill(0, 0, W, H, C.desk); for (let y = 0; y < H; y += 3) for (let x = (y * 5) % 11; x < W; x += 11) s.fill(x, y, 6, 1, C.desk2); }
export { Sheet, drawPix };

// ---- swipe / wheel scroll area: draw(dy) renders content shifted by -scroll; content outside the box is clipped ----
const SCR = {};
export function scrollArea(s, id, x, y, w, h, contentH, draw) {
  const st = SCR[id] || (SCR[id] = { off: 0, vel: 0, drag: false, ly: 0 }), max = Math.max(0, contentH - h), over = input.x >= x && input.x < x + w && input.y >= y && input.y < y + h;
  if (over && input.clicked) { st.drag = true; st.ly = input.y; st.start = input.y; st.moved = false; }
  if (st.drag) { if (!input.down) st.drag = false; else { const dy = input.y - st.ly; if (Math.abs(input.y - st.start) > 6) st.moved = true; st.vel = -dy; st.off -= dy; st.ly = input.y; } }
  else { st.off += st.vel; st.vel *= 0.86; if (Math.abs(st.vel) < 0.1) st.vel = 0; }
  if (over && input.wheel) st.off += Math.sign(input.wheel) * 18;
  st.off = Math.max(0, Math.min(max, st.off));
  const prev = { ...clip }; Object.assign(clip, { on: true, x0: x, y0: y, x1: x + w, y1: y + h });
  const swallow = st.moved; if (swallow) input.clicked = false;                       // a swipe is not a click
  draw(Math.round(st.off)); Object.assign(clip, prev);
  if (max > 0) { const th = Math.max(10, Math.round(h * h / contentH)), ty = y + Math.round((h - th) * st.off / max); s.fill(x + w - 3, y, 3, h, C.paperDark); s.fill(x + w - 3, ty, 3, th, C.brass); s.fill(x + w - 3, ty, 1, th, C.brassL); }
  return st; }

// ---- text field: a hidden HTML input takes the keystrokes (IME composition, phone keyboards); the pixel field shows them ----
const TF = { id: null, orig: '', val: '', done: false, cancel: false }; let EL = null;
export const editing = () => !!TF.id;
function tfEl() { if (EL || typeof document === 'undefined') return EL; EL = document.createElement('input'); EL.type = 'text'; EL.autocomplete = 'off'; EL.spellcheck = false;
  Object.assign(EL.style, { position: 'fixed', opacity: '0.01', fontSize: '16px', width: '160px', height: '22px', border: '0', padding: '0', zIndex: '20', pointerEvents: 'none', background: 'transparent', color: 'transparent', caretColor: 'transparent' });
  document.body.appendChild(EL); EL.addEventListener('input', () => { TF.val = EL.value; });
  EL.addEventListener('keydown', e => { e.stopPropagation(); if (e.isComposing) return; if (e.key === 'Enter') { TF.done = true; EL.blur(); } if (e.key === 'Escape') { TF.cancel = true; TF.done = true; EL.blur(); } });
  EL.addEventListener('blur', () => { if (TF.id) TF.done = true; EL.style.left = '-9999px'; }); return EL; }
export function textField(s, id, x, y, w, label, value, { max = 16, placeholder = '' } = {}) {
  text(s, label, x, y, C.inkSoft, 1, w); const by = y + 7, on = TF.id === id, v = on ? TF.val : String(value ?? '');
  s.fill(x, by, w, 11, on ? C.ink : C.brassD); s.fill(x + 1, by + 1, w - 2, 9, on ? C.white : C.paper2);
  const ex = text(s, N(v || (on ? '' : placeholder)), x + 3, by + 2, v ? C.ink : C.inkSoft, 1, w - 8); if (on && (Math.floor(Date.now() / 400) % 2)) s.fill(Math.min(ex + 1, x + w - 3), by + 2, 1, 7, C.oxblood);
  if (!on && input.clicked && inside(x, by, w, 11)) { const el = tfEl(); ensureFullFont(); if (el) { const cv = document.getElementById('screen'), r = cv ? cv.getBoundingClientRect() : { left: 0, top: 0, width: W }, k = r.width / W;
      Object.assign(el.style, { left: (r.left + x * k) + 'px', top: (r.top + by * k) + 'px', width: Math.max(60, w * k) + 'px' }); el.maxLength = max; el.value = String(value ?? ''); TF.id = id; TF.orig = el.value; TF.val = el.value; TF.done = TF.cancel = false; setTimeout(() => el.focus(), 0); el.focus(); } }
  if (on && TF.done) { const out = TF.cancel ? TF.orig : TF.val.trim().slice(0, max); TF.id = null; TF.done = TF.cancel = false; return out || String(value ?? ''); }
  return value; }
