// The telephone directory as a thing in the hand (review 48). Closed, it lies on the desk (drawn in the game's pixels);
// clicked, it opens close to the eye in the middle of the screen. The close view is not pixel art: like a catalogue or
// a newspaper in the hand, it is printed fine, on the planner's paper at its full size (assets/places/phone/
// book_open.jpg), in a typeface of the period (Old Standard, a Didone of the kind the directories were set in, and
// Oswald for the trade headings), on a sharper layer under the pixel screen (App.fine), the pixel interface staying on
// top of it. The book has depth: the pages run down into the gutter (the print bends and narrows towards the spine,
// the gutter darkens, the middle of each page catches the light), and a page turned lifts and swings over the spine,
// its back showing past halfway, its shadow on the page beneath.
// Rest the pointer on an entry for a Korean gloss; click it to ring it in pencil (the ringed numbers are kept on the
// note pad by the telephone); turn at the lower corners (hold to riffle), or open at a thumb-index tab.
import type { App } from '../shell/app';
import { COL, type Rect } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import { printText, GOTHIC } from '../pixel/printed';
import type { BookState } from '../../core/house';
import cut from '../../data/places/phone_cut.json';
import dir from '../../data/directory/millbrook_1930.json';
import imgOpen from '../../assets/places/phone/book_open.jpg';

export interface Entry { id: string; trade?: string; name: string; ko: string; addr: string; no: string; supplier?: string; hello?: string; grocer?: { item: string; ko: string; price: number }[]; long?: boolean; short?: string }
interface Ad { after: string; head: string[]; lines: string[]; phone: string; ko: string }
type Block = { kind: 'title' } | { kind: 'trade'; en: string; ko: string } | { kind: 'entry'; e: Entry } | { kind: 'ad'; ad: Ad } | { kind: 'long' };
interface Placed { b: Block; y: number }
interface Hit { r: Rect; tip: string; id?: string }
export const DIR = dir as unknown as { title: string[]; year: number; myNumber: string; localCost: number; longCost: number; howTo: string[]; trades: { id: string; en: string; ko: string }[]; entries: Entry[]; longDistance: Entry[]; ads: Ad[]; parts: Record<string, string> };
const O = (cut as unknown as { open: { size: number[]; left: number[]; right: number[]; spine: number } }).open;
const SERIF = "'Old Standard TT', Georgia, 'Times New Roman', serif", COND = "Oswald, 'Arial Narrow', 'Franklin Gothic Medium', sans-serif";
const INK = 'rgba(38,26,20,0.93)', INK2 = 'rgba(92,72,56,0.92)', RED = 'rgba(140,34,24,0.92)';
const H_ = { title: 0, trade: 36, entry: 40, ad: 116, long: 36 }, TOP = 42, ROOM = 673 - 42 - 52;
const TABS: [string, string, (b: Block) => boolean][] = [
  ['A', 'A–C', b => b.kind === 'trade' && b.en < 'D'], ['D', 'D–G', b => b.kind === 'trade' && b.en >= 'D' && b.en < 'H'], ['H', 'H–N', b => b.kind === 'trade' && b.en >= 'H' && b.en < 'P'],
  ['P', 'P–T', b => b.kind === 'trade' && b.en >= 'P'], ['L', '장거리', b => b.kind === 'long'] ];
const W = 480, H = 270, CLOSED: Rect = { x: 258, y: 40, w: 150, h: 190 };

function layout(): Placed[][] {
  const blocks: Block[] = [];
  for (const t of DIR.trades) { blocks.push({ kind: 'trade', en: t.en, ko: t.ko }); for (const e of DIR.entries.filter(x => x.trade === t.id)) blocks.push({ kind: 'entry', e }); for (const ad of DIR.ads.filter(a => a.after === t.id)) blocks.push({ kind: 'ad', ad }); }
  blocks.push({ kind: 'long' }); for (const e of DIR.longDistance) blocks.push({ kind: 'entry', e: { ...e, no: '', long: true } });
  const pages: Placed[][] = [[{ b: { kind: 'title' }, y: 0 }]]; let cur: Placed[] = [], y = 0;
  for (const b of blocks) { const h = H_[b.kind]; if (y + h > ROOM || (b.kind === 'trade' && y + h + H_.entry > ROOM)) { pages.push(cur); cur = []; y = 0; } cur.push({ b, y }); y += h; }
  pages.push(cur); if (pages.length % 2) pages.push([]); return pages; }

export function directoryBook(app: App, state: () => BookState) {
  const pages = layout(), ui = app.ui, S = app.S;
  let open = false, anim = 0, turn: { dir: 1 | -1; t: number } | null = null, hold = 0, img: HTMLImageElement | null = null, ready = false, fontsReady = false;
  const cache = new Map<string, HTMLCanvasElement>();
  const im = new Image(); im.onload = () => { img = im; ready = true; }; im.src = imgOpen;
  try { void document.fonts.load(`700 16px 'Old Standard TT'`).then(() => document.fonts.load(`500 16px Oswald`)).then(() => { fontsReady = true; cache.clear(); }); } catch { fontsReady = true; }
  const spread = () => { const p = state().page; return p - (p % 2); };
  const pageBox = (side: 0 | 1) => (side ? O.right : O.left) as [number, number, number, number];

  // ---------------- printing a page ----------------
  /** a page's print (and pencil) on a clear sheet the size of the page in the picture; and where its entries lie */
  function print(idx: number, side: 0 | 1): { cv: HTMLCanvasElement; hits: Hit[] } {
    const [x0, y0, x1, y1] = pageBox(side), pw = x1 - x0, ph = y1 - y0, marks = state().marks, key = `${idx}|${side}|${marks.join(',')}|${fontsReady}`;
    const hits: Hit[] = [], outer = 46, inner = 30, mL = side ? inner : outer, mR = side ? outer : inner, cw = pw - mL - mR;
    let cv = cache.get(key); const fresh = !cv; if (!cv) { cv = document.createElement('canvas'); cv.width = pw; cv.height = ph; cache.set(key, cv); }
    const c = cv.getContext('2d')!, centre = (s: string, y: number, font: string, colour = INK, sp = 0) => { c.font = font; c.fillStyle = colour; setSpacing(c, sp); c.textAlign = 'center'; c.fillText(s, mL + cw / 2, y); c.textAlign = 'left'; setSpacing(c, 0); };
    const rule = (y: number, w = 1, colour = INK2) => { c.fillStyle = colour; c.fillRect(mL, y, cw, w); };
    for (const { b, y: by } of pages[idx] ?? []) { const y = TOP + by;
      if (b.kind === 'title') { if (fresh) { centre('MILLBROOK', 150, `700 46px ${SERIF}`, INK, 3); centre('TELEPHONE', 198, `400 30px ${SERIF}`, INK, 6); centre('DIRECTORY', 236, `400 30px ${SERIF}`, INK, 6);
          rule(262, 2, INK); rule(266, 1); centre(String(DIR.year), 316, `500 44px ${COND}`, RED, 4); rule(340, 1); rule(344, 2, INK);
          DIR.howTo.forEach((s, k) => centre(s.charAt(0) + s.slice(1).toLowerCase(), 388 + k * 22, `italic 400 15px ${SERIF}`, INK2)); centre('CLASSIFIED SECTION', 530, `500 17px ${COND}`, INK, 3); centre('Trades in alphabetical order', 554, `italic 400 13px ${SERIF}`, INK2);
          centre('MILLBROOK & TRI-COUNTY TELEPHONE CO.', 628, `400 12px ${SERIF}`, INK2, 2); } continue; }
      if (b.kind === 'trade' || b.kind === 'long') { if (fresh) { rule(y + 4, 2, INK); rule(y + 8, 1); centre(b.kind === 'long' ? 'LONG DISTANCE — CALL THE OPERATOR' : b.en, y + 26, `500 15px ${COND}`, INK, 2); rule(y + 31, 1); }
        hits.push({ r: { x: x0 + mL, y: y0 + y, w: cw, h: 34 }, tip: b.kind === 'long' ? '장거리 — 0번 교환원에게' : b.ko }); continue; }
      if (b.kind === 'entry') { const e = b.e, no = e.long ? 'Call 0' : e.no || 'no tel.';
        if (fresh) { c.font = `700 16px ${SERIF}`; let nm = e.name; const nw = () => c.measureText(no).width; c.font = `700 16px ${SERIF}`; const room = cw - nw() - 14; while (c.measureText(nm).width > room && nm.length > 4) nm = nm.slice(0, -1);
          if (nm !== e.name) nm = nm.replace(/[ .,-]+$/, '') + '.'; c.fillStyle = INK; c.fillText(nm, mL, y + 17); const ex = mL + c.measureText(nm).width + 5;
          c.font = `700 16px ${SERIF}`; const nx = mL + cw - c.measureText(no).width; c.fillStyle = e.no ? INK : INK2; c.fillText(no, nx, y + 17);
          c.fillStyle = INK2; for (let x = ex; x < nx - 6; x += 5) c.fillRect(Math.round(x), y + 14, 1.4, 1.4);
          c.font = `italic 400 13px ${SERIF}`; c.fillStyle = INK2; c.fillText(e.addr.charAt(0) + e.addr.slice(1).toLowerCase(), mL + 12, y + 33); }
        hits.push({ r: { x: x0 + mL - 4, y: y0 + y, w: cw + 8, h: 38 }, tip: `${e.ko}${e.no ? ' · ' + e.no : e.long ? ' · 장거리: 0번 교환원에게' : ''}`, id: e.id }); continue; }
      if (b.kind === 'ad') { const ad = b.ad, h = 104; if (fresh) { c.strokeStyle = INK; c.lineWidth = 2.2; c.strokeRect(mL + 2, y + 6, cw - 4, h); c.lineWidth = 0.8; c.strokeRect(mL + 7, y + 11, cw - 14, h - 10);
          ad.head.forEach((s, k) => centre(s, y + 48 + k * 30, `500 34px ${COND}`, RED, 2)); ad.lines.forEach((s, k) => centre(s, y + 70 + k * 17, `400 14px ${SERIF}`, INK, 1)); if (ad.phone) centre('Telephone ' + ad.phone, y + 103, `700 12px ${SERIF}`, INK2, 1); }
        hits.push({ r: { x: x0 + mL, y: y0 + y + 6, w: cw, h }, tip: ad.ko }); } }
    if (fresh && idx > 0 && !(pages[idx] ?? []).length) { centre('MEMORANDA', TOP + 30, `500 17px ${COND}`, INK, 4); rule(TOP + 40, 1); for (let y = TOP + 76; y < ph - 60; y += 30) { c.fillStyle = 'rgba(120,140,170,0.35)'; c.fillRect(mL, y, cw, 1); } }   // a blank leaf ruled for notes, as the directories had
    if (fresh && idx > 0) { centre('MILLBROOK DIRECTORY · CLASSIFIED', 24, `400 11px ${SERIF}`, INK2, 2); centre(String(idx), ph - 18, `400 13px ${SERIF}`, INK2); }
    // the pencil: a quick ring round each marked entry
    if (fresh) for (const h of hits) if (h.id && marks.includes(h.id)) { const r = h.r, cx = r.x - x0 + r.w / 2, cy = r.y - y0 + r.h / 2, ax = r.w / 2 + 6, ay = r.h / 2 + 3; c.strokeStyle = 'rgba(78,78,88,0.75)'; c.lineWidth = 1.7; c.beginPath();
      for (let n = 0; n <= 64; n++) { const a = (n / 56) * Math.PI * 2 - 0.4, w = 1 + 0.05 * Math.sin(a * 3 + h.id.length); n ? c.lineTo(cx + Math.cos(a) * ax * w, cy + Math.sin(a) * ay * w) : c.moveTo(cx + Math.cos(a) * ax * w, cy + Math.sin(a) * ay * w); } c.stroke(); }
    return { cv, hits }; }
  function setSpacing(c: CanvasRenderingContext2D, px: number) { const cc = c as CanvasRenderingContext2D & { letterSpacing?: string }; if ('letterSpacing' in cc) cc.letterSpacing = px + 'px'; }

  /** a page with its paper (for the page that is being turned) */
  function sheet(idx: number, side: 0 | 1): HTMLCanvasElement { const key = `sheet|${idx}|${side}|${state().marks.join(',')}|${fontsReady}`; let cv = cache.get(key); if (cv) return cv;
    const [x0, y0, x1, y1] = pageBox(side); cv = document.createElement('canvas'); cv.width = x1 - x0; cv.height = y1 - y0; const c = cv.getContext('2d')!;
    if (img) c.drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0); c.drawImage(print(idx, side).cv, 0, 0); cache.set(key, cv); return cv; }

  // ---------------- the book on the page ----------------
  /** where the open book lies on the screen (game pixels); growing from the closed book while it opens */
  function dest(): Rect { const h = 258, w = (h * O.size[0]!) / O.size[1]!, full = { x: (W - w) / 2, y: (H - h) / 2, w, h }, e = 1 - (1 - anim) ** 3;
    return { x: CLOSED.x + (full.x - CLOSED.x) * e, y: CLOSED.y + (full.y - CLOSED.y) * e, w: CLOSED.w + (full.w - CLOSED.w) * e, h: CLOSED.h + (full.h - CLOSED.h) * e }; }
  /** draw a page's print onto the book, bent down into the gutter: narrower and shorter towards the spine */
  function bend(c: CanvasRenderingContext2D, src: HTMLCanvasElement, side: 0 | 1, d: Rect, sc: number) { const [x0, y0, x1, y1] = pageBox(side), pw = x1 - x0, ph = y1 - y0, step = 3;
    for (let sx = 0; sx < pw; sx += step) { const s = side ? sx / pw : 1 - sx / pw /* 0 at the spine .. 1 at the outer edge */, s2 = side ? (sx + step) / pw : 1 - (sx + step) / pw;
      const g = (v: number) => v + 0.05 * (1 - v) ** 4, xa = side ? x0 + g(s) * pw : x1 - g(s) * pw, xb = side ? x0 + g(s2) * pw : x1 - g(s2) * pw, vs = 1 - 0.04 * (1 - s) ** 5, hh = ph * vs, yy = y0 + (ph - hh) / 2;
      c.drawImage(src, sx, 0, step, ph, d.x + Math.min(xa, xb) * sc, d.y + yy * sc, Math.abs(xb - xa) * sc + 0.4, hh * sc); } }

  function draw(c: CanvasRenderingContext2D) { const d = dest(), sc = d.w / O.size[0]!, sp = spread(), spine = O.spine;
    c.clearRect(0, 0, W, H); if (!img) return; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.save(); c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 14; c.shadowOffsetY = 5; c.drawImage(img, d.x, d.y, d.w, d.h); c.restore();
    const showL = turn && turn.dir < 0 ? sp - 2 : sp, showR = turn && turn.dir > 0 ? sp + 3 : sp + 1;
    bend(c, print(showL, 0).cv, 0, d, sc); bend(c, print(showR, 1).cv, 1, d, sc);
    // the gutter: the pages fall away into it; the middle of each page rises into the light
    const gx = d.x + spine * sc, gw = 46 * sc, gr = c.createLinearGradient(gx - gw, 0, gx + gw, 0); gr.addColorStop(0, 'rgba(70,40,20,0)'); gr.addColorStop(0.42, 'rgba(70,40,20,0.22)'); gr.addColorStop(0.5, 'rgba(50,28,14,0.5)'); gr.addColorStop(0.58, 'rgba(70,40,20,0.22)'); gr.addColorStop(1, 'rgba(70,40,20,0)');
    c.fillStyle = gr; c.fillRect(gx - gw, d.y + O.left[1]! * sc, gw * 2, (O.left[3]! - O.left[1]!) * sc);
    for (const side of [0, 1] as const) { const [x0, y0, x1, y1] = pageBox(side), lg = c.createLinearGradient(d.x + x0 * sc, 0, d.x + x1 * sc, 0), a = side ? 0.65 : 0.35;
      lg.addColorStop(0, 'rgba(255,248,230,0)'); lg.addColorStop(a, 'rgba(255,248,230,0.07)'); lg.addColorStop(1, 'rgba(255,248,230,0)'); c.fillStyle = lg; c.fillRect(d.x + x0 * sc, d.y + y0 * sc, (x1 - x0) * sc, (y1 - y0) * sc); }
    // the page in the air
    if (turn) { const u = Math.min(1, turn.t), ang = u * Math.PI, cos = Math.cos(ang), front = u < 0.5, side: 0 | 1 = (turn.dir > 0) === front ? 1 : 0;
      const idx = turn.dir > 0 ? (front ? sp + 1 : sp + 2) : (front ? sp : sp - 1), src = sheet(idx, side), [x0, y0, x1, y1] = pageBox(side), pw = x1 - x0, ph = y1 - y0, wv = Math.abs(cos), lift = Math.sin(ang);
      // its shadow on the page under it
      const shx = side ? gx + pw * wv * sc : gx - pw * wv * sc, sg = c.createLinearGradient(shx, 0, shx + (side ? 1 : -1) * 30 * sc * (0.3 + lift), 0); sg.addColorStop(0, `rgba(30,16,8,${0.35 * lift})`); sg.addColorStop(1, 'rgba(30,16,8,0)');
      c.fillStyle = sg; c.fillRect(Math.min(shx, shx + (side ? 1 : -1) * 30 * sc), d.y + y0 * sc, 30 * sc * (0.3 + lift), ph * sc);
      for (let sx = 0; sx < pw; sx += 3) { const s = side ? sx / pw : 1 - sx / pw, xa = s * pw * wv, grow = 1 + 0.07 * lift * s, hh = ph * grow, yy = y0 + (ph - hh) / 2 - 6 * lift * Math.sin(s * Math.PI);
        const X = side ? gx + xa * sc : gx - xa * sc - 3 * wv * sc; c.drawImage(src, sx, 0, 3, ph, X, d.y + yy * sc, 3 * wv * sc + 0.5, hh * sc); }
      const shade = (1 - wv) * 0.45, x2 = side ? gx : gx - pw * wv * sc; c.fillStyle = `rgba(40,24,12,${shade})`; c.fillRect(x2, d.y + (y0 - 8 * lift) * sc, pw * wv * sc, (ph + 16 * lift) * sc); }
    // the thumb index: tabs cut into the edge of the right-hand pages
    TABS.forEach(([letter], n) => { const tx = d.x + (O.right[2]! - 12) * sc, ty = d.y + (110 + n * 96) * sc, tw = 18 * sc, th = 52 * sc; c.fillStyle = 'rgba(58,34,22,0.92)'; c.fillRect(tx, ty, tw, th);
      c.fillStyle = 'rgba(236,222,190,0.95)'; c.font = `700 ${Math.round(15 * sc * 10) / 10}px ${SERIF}`; c.textAlign = 'center'; c.fillText(letter, tx + tw / 2 - sc, ty + th / 2 + 5 * sc); c.textAlign = 'left'; }); }

  // ---------------- the book shut, on the desk (pixels) ----------------
  function drawClosed(k: number, hover: boolean) { const r = CLOSED, d = S.d, put = (x: number, y: number, c: RGB, a = 1) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; d[i] = d[i]! + (c[0] * k - d[i]!) * a; d[i + 1] = d[i + 1]! + (c[1] * k - d[i + 1]!) * a; d[i + 2] = d[i + 2]! + (c[2] * k - d[i + 2]!) * a; d[i + 3] = 255; };
    const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    for (let y = r.y + 4; y < r.y + r.h + 6; y++) for (let x = r.x + 4; x < r.x + r.w + 7; x++) { const e = Math.min(x - r.x - 4, y - r.y - 4, r.x + r.w + 7 - x, r.y + r.h + 6 - y); put(x, y, [16, 8, 4], Math.min(0.5, e / 8)); }   // its shadow
    for (let y = r.y + 2; y < r.y + r.h + 2; y++) for (let x = r.x + r.w - 2; x < r.x + r.w + 3; x++) put(x, y, (y + x) % 3 ? [222, 204, 164] : [176, 156, 118]);   // the page block's edge
    for (let x = r.x + 2; x < r.x + r.w + 2; x++) for (let y = r.y + r.h - 2; y < r.y + r.h + 2; y++) put(x, y, (x + y) % 3 ? [214, 196, 156] : [170, 150, 112]);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const n = hash(x >> 1, y >> 1) * 0.5 + hash(x, y) * 0.5, edge = Math.min(x - r.x, y - r.y, r.x + r.w - 1 - x, r.y + r.h - 1 - y), spineBand = x - r.x < 14;
      let c: RGB = [128 + n * 22, 64 + n * 12, 32 + n * 8]; if (spineBand) c = [96 + n * 18, 46 + n * 10, 24 + n * 6]; if (spineBand && [38, 40, 150, 152].includes(y - r.y)) c = [150, 92, 52];
      if (edge < 2) c = [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7]; if (edge === 2) c = [c[0] * 1.12, c[1] * 1.12, c[2] * 1.12];
      const inset = Math.min(x - r.x - 20, y - r.y - 10, r.x + r.w - 11 - x, r.y + r.h - 11 - y); if (inset === 0) c = [c[0] * 0.72, c[1] * 0.72, c[2] * 0.72]; if (inset === -1) c = [c[0] * 1.15, c[1] * 1.15, c[2] * 1.15];
      put(x, y, c); }
    const gold: RGB = [218, 182, 104], goldD: RGB = [92, 60, 28], cx = r.x + 14 + (r.w - 14) / 2, stamp = (txt: string, y: number, font: string, sp = 0) => {   // gold leaf pressed into the leather: a dark edge under, the gold on top
      printText(txt, cx + 0.6, y + 0.8, { font, align: 'center', spacing: sp }, (px, py, a) => put(px, py, goldD, a * 0.8)); printText(txt, cx, y, { font, align: 'center', spacing: sp }, (px, py, a) => put(px, py, gold, a)); };
    stamp('MILLBROOK', r.y + 48, `700 9px ${SERIF}`, 1.5); stamp('TELEPHONE', r.y + 72, `400 14px ${SERIF}`, 1.2); stamp('DIRECTORY', r.y + 90, `400 14px ${SERIF}`, 1.2);
    for (let x = cx - 30; x <= cx + 30; x++) { put(x, r.y + 100, gold, 0.8); put(x, r.y + 103, gold, 0.5); } stamp('1930', r.y + 122, `500 15px ${GOTHIC}`, 2);
    for (let a = 0; a < Math.PI * 2; a += 0.05) { put(Math.round(cx + Math.cos(a) * 10), Math.round(r.y + 140 + Math.sin(a) * 10), gold); }   // a bell in a ring
    for (let y = -6; y <= 5; y++) for (let x = -5; x <= 5; x++) { const w = 1.5 + (y + 6) * 0.35; if (Math.abs(x) <= w && y < 5) put(cx + x, r.y + 140 + y, y === -6 ? goldD : gold); }
    if (hover) for (let x = r.x; x < r.x + r.w; x++) { put(x, r.y, [255, 226, 150]); put(x, r.y + r.h - 1, [255, 226, 150]); } }

  // ---------------- the hand on the book ----------------
  function frame(dt: number): { closed: boolean } { const f = app.fine(), d = dest(), sc = d.w / O.size[0]!, p = ui.pointer();
    anim = Math.min(1, anim + dt / 0.28); if (turn) { turn.t += dt / 0.5; if (turn.t >= 1) { state().page = Math.max(0, Math.min(pages.length - 2, spread() + turn.dir * 2)); turn = null; } }
    // the room behind darkens; where the book lies the pixel screen is left clear so the fine print shows
    for (let i = 0; i < W * H * 4; i += 4) { S.d[i] = S.d[i]! * 0.42; S.d[i + 1] = S.d[i + 1]! * 0.4; S.d[i + 2] = S.d[i + 2]! * 0.38; }
    for (let y = Math.max(0, Math.floor(d.y)); y < Math.min(H, Math.ceil(d.y + d.h)); y++) for (let x = Math.max(0, Math.floor(d.x)); x < Math.min(W, Math.ceil(d.x + d.w)); x++) S.d[(y * W + x) * 4 + 3] = 0;
    if (ready) draw(f.ctx);
    if (anim < 1) return { closed: false };
    // the pointer, in the picture's own pixels
    const bx = (p.x - d.x) / sc, by = (p.y - d.y) / sc, inBook = bx >= 0 && by >= 0 && bx < O.size[0]! && by < O.size[1]!; let tip = '';
    const sp = spread(), canF = sp + 2 < pages.length, canB = sp > 0, turnTo = (dir: 1 | -1) => { if (turn || (dir > 0 ? !canF : !canB)) return; turn = { dir, t: 0 }; app.sound.once('paper'); };
    if (!turn) { for (const side of [0, 1] as const) for (const h of print(side ? sp + 1 : sp, side).hits) if (bx >= h.r.x && bx < h.r.x + h.r.w && by >= h.r.y && by < h.r.y + h.r.h) { tip = h.tip;
        if (h.id && ui.missed()) { const B = state(), i = B.marks.indexOf(h.id); if (i >= 0) B.marks.splice(i, 1); else B.marks.push(h.id); app.sound.once('peel'); } }
      const cR = bx > O.right[2]! - 70 && bx < O.right[2]! + 6 && by > O.right[3]! - 70 && by < O.right[3]! + 10, cL = bx > O.left[0]! - 6 && bx < O.left[0]! + 70 && by > O.left[3]! - 70 && by < O.left[3]! + 10;
      if (cR && canF) { tip = '다음 장 (누르고 있으면 훑어 넘긴다)'; f.ctx.fillStyle = 'rgba(255,250,235,0.55)'; f.ctx.beginPath(); f.ctx.moveTo(d.x + O.right[2]! * sc, d.y + (O.right[3]! - 36) * sc); f.ctx.lineTo(d.x + (O.right[2]! - 36) * sc, d.y + O.right[3]! * sc); f.ctx.lineTo(d.x + O.right[2]! * sc, d.y + O.right[3]! * sc); f.ctx.fill(); }
      if (cL && canB) tip = '앞 장';
      if (ui.missed()) { if (cR) turnTo(1); else if (cL) turnTo(-1); }
      if (p.down && (cR || cL)) { hold += dt; if (hold > 0.5) turnTo(cR ? 1 : -1); } else hold = 0;
      TABS.forEach(([, ko, test], n) => { const tx = O.right[2]! - 12, ty = 110 + n * 96; if (bx >= tx && bx < tx + 18 && by >= ty && by < ty + 52) { tip = `색인: ${ko}`; if (ui.missed()) { const idx = pages.findIndex(pg => pg.some(q => test(q.b))); if (idx >= 0) { state().page = idx - (idx % 2); app.sound.once('paper'); } } } }); }
    let closed = false; if (ui.button('book-close', { x: 4, y: 4, w: 66, h: 13 }, '책을 덮는다') || (!inBook && ui.missed())) { open = false; closed = true; app.sound.once('paper'); }
    if (tip) { const tw = S.tw(tip) + 8, x = Math.min(W - tw - 2, Math.max(2, p.x - tw / 2)), y = Math.max(2, p.y - 18); S.fill(x, y, tw, 11, hex('#1a120b')); S.text(tip, x + 4, y + 2, COL.lit); }
    return { closed }; }

  return { closedRect: CLOSED, drawClosed, frame, isOpen: () => open, open: () => { open = true; anim = 0; app.sound.once('paper'); }, close: () => { open = false; },
    turn: (dir: 1 | -1) => { const sp = spread(); if (!turn && (dir > 0 ? sp + 2 < pages.length : sp > 0)) { turn = { dir, t: 0 }; app.sound.once('paper'); } } };
}
