// The telephone desk (version one, step 5; review 47). The planner's desk and open directory, with a telephone made of
// the parts sheet's pieces (tools/places/phone.py), so its parts move:
// - the handset: pick it up (it rises out of the picture, to your ear; the cord follows it) and the dial tone comes;
//   put it back on the cradle to hang up
// - the dial: put a finger in a hole, turn the wheel clockwise to the finger stop, let go; it runs home at ten clicks
//   a second, one click for 1, ten for 0 (let go early and it sends fewer). The wheel is turned from a picture kept at
//   three times the screen's scale, so it turns smoothly.
// - the directory: a 1930 classified directory printed in English (data/directory), its trades in order, display
//   advertisements between; rest the pointer on an entry for a Korean gloss, click it to ring it in pencil; turn the
//   pages at their corners (or the arrow keys), or open it at a thumb-index tab
// - the calls: the town's shops and the shop's suppliers answer (the supply system's own: their prices are a quote at
//   once, an order is placed like any other), the grocer sends tea and coffee next morning, 0 is the operator, who
//   puts long-distance calls through. A local call costs a nickel, long distance 75 cents.
import type { App, Scene } from '../shell/app';
import { split, COL, type Rect } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import { tiny, tinyWidth } from '../pixel/tiny';
import { pixels } from './pics';
import { newHouse, type HouseState } from '../../core/house';
import { post } from '../../core/ledger';
import { addDays } from '../../core/calendar';
import { air } from '../../core/atmosphere';
import type { Quote } from '../../core/supply';
import cut from '../../data/places/phone_cut.json';
import dir from '../../data/directory/millbrook_1930.json';
import imgDesk from '../../assets/places/phone/desk.png';
import imgBody from '../../assets/places/phone/body.png';
import imgStop from '../../assets/places/phone/stop.png';
import imgHandset from '../../assets/places/phone/handset.png';
import imgWheel from '../../assets/places/phone/wheel.png';

const W = 480, H = 270;
type Line = 'onhook' | 'tone' | 'dialing' | 'ringing' | 'talk';
interface GroceryItem { item: string; ko: string; price: number }
interface Entry { id: string; trade?: string; name: string; ko: string; addr: string; no: string; supplier?: string; hello?: string; grocer?: GroceryItem[]; long?: boolean }
interface Ad { after: string; head: string[]; lines: string[]; phone: string; ko: string }
type Block = { kind: 'title' } | { kind: 'trade'; en: string; ko: string } | { kind: 'entry'; e: Entry } | { kind: 'ad'; ad: Ad } | { kind: 'long' };
interface Placed { b: Block; y: number; h: number }
const D = dir as unknown as { title: string[]; year: number; myNumber: string; localCost: number; longCost: number; howTo: string[]; trades: { id: string; en: string; ko: string }[]; entries: Entry[]; longDistance: Entry[]; ads: Ad[]; parts: Record<string, string> };
const C = cut as unknown as { body: { at: number[]; size: number[] }; stop: { at: number[] }; ring: number[]; wheel: { size: number[]; scale: number; holeR: number; hole: number; holes: number[]; stopAngle: number }; handset: { at: number[]; size: number[]; socket: number[] }; cord: { into: number[]; dark: number[]; mid: number[]; light: number[] }; book: { left: number[]; right: number[]; spine: number } };
const INK: RGB = [46, 34, 28], INK2: RGB = [112, 92, 72], PENCIL: RGB = [96, 96, 104], RED: RGB = [138, 40, 30];
const BLOCK_H = { title: 186, trade: 13, entry: 14, ad: 42, long: 13 };
const TABS: [string, string, (b: Block) => boolean][] = [
  ['A', 'A-C', b => b.kind === 'trade' && b.en < 'D'], ['D', 'D-G', b => b.kind === 'trade' && b.en >= 'D' && b.en < 'H'], ['H', 'H-N', b => b.kind === 'trade' && b.en >= 'H' && b.en < 'P'],
  ['P', 'P-T', b => b.kind === 'trade' && b.en >= 'P'], ['L', '장거리', b => b.kind === 'long'] ];

/** the directory flowed into pages: page 0 the title page, then the trades with their entries and advertisements */
function layout(): Placed[][] {
  const blocks: Block[] = [];
  for (const t of D.trades) { blocks.push({ kind: 'trade', en: t.en, ko: t.ko }); for (const e of D.entries.filter(x => x.trade === t.id)) blocks.push({ kind: 'entry', e }); for (const ad of D.ads.filter(a => a.after === t.id)) blocks.push({ kind: 'ad', ad }); }
  blocks.push({ kind: 'long' }); for (const e of D.longDistance) blocks.push({ kind: 'entry', e: { ...e, no: '', long: true } });
  const pages: Placed[][] = [[{ b: { kind: 'title' }, y: 0, h: BLOCK_H.title }]], room = 178; let cur: Placed[] = [], y = 0;
  for (const b of blocks) { const h = BLOCK_H[b.kind]; if (y + h > room || (b.kind === 'trade' && y + h + BLOCK_H.entry > room)) { pages.push(cur); cur = []; y = 0; } cur.push({ b, y, h }); y += h; }
  pages.push(cur); if (pages.length % 2) pages.push([]); return pages; }

export function phoneDesk(app: App): Scene {
  const ui = app.ui, S = app.S, Wd = () => app.world!, g = () => Wd().sim.g;
  const house = (): HouseState => (g().house ??= newHouse()), book = () => (house().book ??= { marks: [], page: 0 }), pantry = () => (house().pantry ??= { tea: 1, coffee: 1 });
  const pages = layout();
  let line: Line = 'onhook', digits = '', t = 0, lift = 0, liftWant = 0;
  let rot = 0, grab: { hole: number; max: number; last: number } | null = null, returning = false, ringT = 0;
  let who: Entry | null = null, operator = false, said = '', shown = 0, talkT = 0, say2: string[] = [];
  let form: { qty: number[]; parts: string[]; grocer?: GroceryItem[] } | null = null, quote: Quote | null = null, done = false;
  let turn: { from: number; dir: 1 | -1; t: number } | null = null, holdCorner = 0, tip = '';
  const say = (s: string) => { said = s; shown = 0; };

  // ---------------- the telephone ----------------
  const [rcx, rcy] = C.ring as [number, number], STEP = 30, holeAt = (i: number, r: number) => ((C.wheel.holes[i]! + r) * Math.PI) / 180;
  const maxRot = (i: number) => (((C.wheel.stopAngle - C.wheel.holes[i]!) % 360) + 360) % 360;
  function liftUp() { if (line !== 'onhook') return; liftWant = 1; app.sound.once('pickup'); app.sound.dialTone(true); app.sound.ambient('line', 1); line = 'tone'; digits = ''; }
  function hangUp() { if (line === 'onhook') return; liftWant = 0; app.sound.once('hangup'); app.sound.ring(false); app.sound.dialTone(false); app.sound.ambient('line', 0); line = 'onhook'; digits = ''; who = null; operator = false; grab = null; form = null; quote = null; said = ''; say2 = []; }
  function dialled(n: number) { if (n <= 0) return; digits += n === 10 ? '0' : String(n); app.sound.dialTone(false); line = 'dialing';
    if (digits === '0') { setTimeout(() => { if (digits === '0' && line === 'dialing') { line = 'ringing'; ringT = 2.6; operator = true; app.sound.ring(true); } }, 700); return; }
    if (digits.length === 4) { line = 'ringing'; ringT = 0; app.sound.ring(true); who = D.entries.find(e => e.no === digits) ?? null; } }
  function answer() { app.sound.ring(false); app.sound.once('pickup'); line = 'talk'; done = false; form = null; quote = null; say2 = [];
    if (operator) { say('교환입니다. 몇 번을 대 드릴까요? (Number, please?)'); return; }
    if (!who) { say(digits === D.myNumber ? '(통화 중 신호다. 이 집 번호다.)' : '(교환원) 지금 거신 번호는 없는 번호입니다. 번호부를 다시 보십시오.'); return; }
    const a = Wd().sim.api(); post(a, 'phone', -(who.long ? D.longCost : D.localCost), who.long ? '장거리 전화' : '시내 전화');
    if (who.supplier) { g().supply.phone = true; const sup = Wd().supply.supplier(who.supplier); if (!g().supply.suppliers[who.supplier]!.known) Wd().supply.discover(who.supplier, 'telephone');
      const parts = [...new Set(sup.catalog.map(c => c.part))]; form = { qty: parts.map(() => 0), parts }; }
    else if (who.grocer) form = { qty: who.grocer.map(() => 0), parts: [], grocer: who.grocer };
    say(who.hello ?? '여보세요?'); }

  // ---------------- drawing helpers ----------------
  const d = S.d, put = (x: number, y: number, c: RGB | number[], a = 1) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; d[i] = d[i]! + (c[0]! - d[i]!) * a; d[i + 1] = d[i + 1]! + (c[1]! - d[i + 1]!) * a; d[i + 2] = d[i + 2]! + (c[2]! - d[i + 2]!) * a; };
  function sprite(src: Uint8ClampedArray, sw: number, sh: number, ox: number, oy: number, k = 1) { const x0 = Math.round(ox), y0 = Math.round(oy);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const j = (y * sw + x) * 4; if (src[j + 3]! < 128) continue; put(x0 + x, y0 + y, [src[j]! * k, src[j + 1]! * k, src[j + 2]! * k]); } }
  function shadow(cx: number, cy: number, rx: number, ry: number, a: number) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (q < 1) put(x, y, [20, 8, 4], a * (1 - q) ** 1.5); } }

  /** the finger wheel, turned by `rot` degrees, sampled from the picture at three times the scale */
  function wheel(src: Uint8ClampedArray, k: number) { const Z = C.wheel.scale, sw = C.wheel.size[0]!, half = sw / 2, rr = half / Z, cos = Math.cos((-rot * Math.PI) / 180), sin = Math.sin((-rot * Math.PI) / 180);
    for (let y = Math.floor(rcy - rr); y <= rcy + rr; y++) for (let x = Math.floor(rcx - rr); x <= rcx + rr; x++) { let r = 0, gg = 0, b = 0, a = 0;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const dx = x + (i + 0.5) / 3 - 0.5 - rcx, dy = y + (j + 0.5) / 3 - 0.5 - rcy, sx = Math.round(half + (dx * cos - dy * sin) * Z), sy = Math.round(half + (dx * sin + dy * cos) * Z);
        if (sx < 0 || sy < 0 || sx >= sw || sy >= sw) continue; const q = (sy * sw + sx) * 4; if (src[q + 3]! < 128) continue; r += src[q]!; gg += src[q + 1]!; b += src[q + 2]!; a++; }
      if (a >= 5) put(x, y, [(r / a) * k, (gg / a) * k, (b / a) * k], Math.min(1, a / 7)); } }

  /** the braided cord from the body to the handset's cup, sagging when it is slack */
  function cord(sx: number, sy: number) { const [ix, iy] = C.cord.into as [number, number], slack = lift < 0.5 ? 1 : 0;
    const p = [[sx, sy], [sx - 16 - 8 * slack, sy + 30 * (1 - lift)], [ix - 20, iy - 40 + lift * 20], [ix, iy]] as [number, number][];
    const cols = [C.cord.dark, C.cord.mid, C.cord.light, C.cord.mid] as RGB[]; let s = 0, px = sx, py = sy;
    for (let n = 0; n <= 120; n++) { const u = n / 120, v = 1 - u, x = v ** 3 * p[0]![0] + 3 * v * v * u * p[1]![0] + 3 * v * u * u * p[2]![0] + u ** 3 * p[3]![0], y = v ** 3 * p[0]![1] + 3 * v * v * u * p[1]![1] + 3 * v * u * u * p[2]![1] + u ** 3 * p[3]![1];
      s += Math.hypot(x - px, y - py); const len = Math.hypot(x - px, y - py) || 1, nx = -(y - py) / len, ny = (x - px) / len; px = x; py = y;
      for (let o = -1.5; o <= 1.5; o += 0.5) { const c = cols[Math.floor(s * 0.9 + o * 1.1 + 8) % 4]!; put(x + nx * o, y + ny * o, o === -1.5 || o === 1.5 ? C.cord.dark as RGB : c); } } }

  // ---------------- the directory ----------------
  const [lx0, ly0, lx1, ly1] = C.book.left as [number, number, number, number], [rx0, , rx1] = C.book.right as [number, number, number, number];
  const pageRect = (side: 0 | 1): Rect => (side ? { x: rx0, y: ly0, w: rx1 - rx0, h: ly1 - ly0 } : { x: lx0, y: ly0, w: lx1 - lx0, h: ly1 - ly0 });
  /** print one page with `ink(x, y, colour)` in the page's own coordinates; returns the entries' hit boxes */
  function printPage(idx: number, ink: (x: number, y: number, c: RGB, a?: number) => void, pw: number): { r: Rect; e?: Entry; ad?: Ad }[] {
    const hits: { r: Rect; e?: Entry; ad?: Ad }[] = [], list = pages[idx] ?? [], m = 6, top = 8, cw = pw - m * 2;
    const text = (s: string, x: number, y: number, c: RGB, sc = 1, a = 0.92) => tiny(s, x, y, (px, py) => ink(px, py, c, a), sc);
    const centre = (s: string, y: number, c: RGB, sc = 1) => text(s, Math.round((pw - tinyWidth(s, sc)) / 2), y, c, sc);
    const rule = (y: number, c: RGB = INK2) => { for (let x = m; x < pw - m; x++) ink(x, y, c, 0.7); };
    if (idx > 0) { text('MILLBROOK - CLASSIFIED', m, 2, INK2); const pn = String(idx); text(pn, Math.round((pw - tinyWidth(pn)) / 2), 186, INK2); }
    for (const { b, y: by } of list) { const y = top + by;
      if (b.kind === 'title') { D.title.forEach((s, k) => centre(s, 14 + k * 14, INK, 2)); centre(String(D.year), 60, RED, 2); rule(76); rule(78);
        D.howTo.forEach((s, k) => centre(s, 86 + k * 8, INK2)); rule(130); centre('CLASSIFIED SECTION', 136, INK); centre('TRADES IN ORDER', 144, INK2);
        centre('NEW YORK TELEPHONE CO.', 168, INK2); continue; }
      if (b.kind === 'trade' || b.kind === 'long') { const s = b.kind === 'long' ? 'LONG DISTANCE - OPERATOR' : b.en; rule(y); centre(s, y + 3, INK); rule(y + 10); if (b.kind === 'trade') hits.push({ r: { x: m, y, w: cw, h: 11 }, e: { id: '', name: b.en, ko: b.ko, addr: '', no: '' } }); continue; }
      if (b.kind === 'entry') { const e = b.e, no = e.long ? 'CALL 0' : e.no || 'NO TEL.', nameMax = Math.floor((cw - tinyWidth(no) - 6) / 4), nm = e.name.length > nameMax ? e.name.slice(0, nameMax) : e.name;
        const ex = text(nm, m, y + 1, INK, 1, 0.95); text(nm, m + 0.5, y + 1, INK, 1, 0.35); const nx = pw - m - tinyWidth(no); for (let x = ex + 1; x < nx - 2; x += 2) ink(x, y + 5, INK2, 0.6);
        text(no, nx, y + 1, e.no ? INK : INK2); text(e.addr, m + 4, y + 8, INK2, 1, 0.8);
        hits.push({ r: { x: m - 2, y: y - 1, w: cw + 4, h: 14 }, e }); continue; }
      if (b.kind === 'ad') { const ad = b.ad, h = BLOCK_H.ad - 4; for (let x = m; x < pw - m; x++) { ink(x, y, INK); ink(x, y + h, INK); ink(x, y + 2, INK2, 0.6); ink(x, y + h - 2, INK2, 0.6); } for (let yy = y; yy <= y + h; yy++) { ink(m, yy, INK); ink(pw - m - 1, yy, INK); }
        ad.head.forEach((s, k) => centre(s, y + 5 + k * 12, RED, 2)); ad.lines.forEach((s, k) => centre(s, y + 17 + k * 7, INK)); if (ad.phone) centre('TEL. ' + ad.phone, y + 31, INK2);
        hits.push({ r: { x: m, y, w: cw, h }, ad }); } }
    return hits; }

  /** the pencil's ring round a marked entry, a little wobbly as a hand draws it */
  function ring(r: Rect, ink: (x: number, y: number, c: RGB, a?: number) => void, seed: number) { const cx = r.x + r.w / 2, cy = r.y + r.h / 2, ax = r.w / 2 + 2, ay = r.h / 2 + 1.5;
    for (let n = 0; n < 220; n++) { const a = (n / 200) * Math.PI * 2 + seed, w = 1 + 0.06 * Math.sin(a * 3 + seed * 5); ink(cx + Math.cos(a) * ax * w, cy + Math.sin(a) * ay * w, PENCIL, 0.75); } }

  /** a page drawn into its own picture (for the page being turned): its paper from the desk picture, then its print */
  function pageImage(idx: number, side: 0 | 1, desk: Uint8ClampedArray): { px: Float32Array; w: number; h: number } { const r = pageRect(side), px = new Float32Array(r.w * r.h * 3);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const i = ((r.y + y) * W + r.x + x) * 4, j = (y * r.w + x) * 3; px[j] = desk[i]!; px[j + 1] = desk[i + 1]!; px[j + 2] = desk[i + 2]!; }
    printPage(idx, (x, y, c, a = 1) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= r.w || y >= r.h) return; const j = (y * r.w + x) * 3; px[j] = px[j]! + (c[0] - px[j]!) * a; px[j + 1] = px[j + 1]! + (c[1] - px[j + 1]!) * a; px[j + 2] = px[j + 2]! + (c[2] - px[j + 2]!) * a; }, r.w);
    return { px, w: r.w, h: r.h }; }

  function drawBook(desk: Uint8ClampedArray, k: number) { const B = book(), spread = B.page - (B.page % 2), marks = new Set(B.marks); let hits: { r: Rect; e?: Entry; ad?: Ad; side: 0 | 1 }[] = [];
    const show = (idx: number, side: 0 | 1) => { const r = pageRect(side), ink = (x: number, y: number, c: RGB, a = 1) => put(r.x + x, r.y + y, [c[0] * k, c[1] * k, c[2] * k], a);
      for (const h of printPage(idx, ink, r.w)) { hits.push({ ...h, side }); if (h.e?.id && marks.has(h.e.id)) ring(h.r, ink, h.e.id.length); } };
    if (!turn) { show(spread, 0); show(spread + 1, 1); }
    else { // the page lifts at its edge and swings over the spine, its back showing past halfway
      const u = Math.min(1, turn.t), ang = u * Math.PI, nextSpread = spread + turn.dir * 2, spine = C.book.spine;
      if (turn.dir > 0) { show(spread, 0); show(nextSpread + 1, 1); } else { show(nextSpread, 0); show(spread + 1, 1); }
      hits = [];
      const front = turn.dir > 0 ? pageImage(spread + 1, 1, desk) : pageImage(spread, 0, desk), back = turn.dir > 0 ? pageImage(nextSpread, 0, desk) : pageImage(nextSpread + 1, 1, desk);
      const img = u < 0.5 ? front : back, wv = Math.abs(Math.cos(ang)), lift2 = Math.sin(ang) * 5, sideRight = (turn.dir > 0) === (u < 0.5);
      const shade = 0.55 + 0.45 * wv, pw = img.w;
      for (let y = 0; y < img.h; y++) for (let xx = 0; xx < Math.round(pw * wv); xx++) { const sxp = Math.floor(xx / Math.max(0.01, wv)), sx = sideRight ? sxp : pw - 1 - sxp, j = (y * pw + Math.min(pw - 1, sx)) * 3, bend = Math.sin((xx / Math.max(1, pw * wv)) * Math.PI) * lift2;
        const X = sideRight ? spine + 1 + xx : spine - 1 - xx; put(X, ly0 + y - bend, [img.px[j]! * shade * k, img.px[j + 1]! * shade * k, img.px[j + 2]! * shade * k]); } }
    // the thumb index: tabs cut into the right-hand pages' edge
    TABS.forEach(([letter], n) => { const y = ly0 + 18 + n * 30; for (let yy = y; yy < y + 20; yy++) for (let x = rx1 + 1; x < rx1 + 9; x++) put(x, yy, [60 * k, 36 * k, 24 * k]); tiny(letter, rx1 + 3, y + 8, (x, yy) => put(x, yy, [230 * k, 214 * k, 180 * k])); });
    return hits; }

  // for tests: the dial's state
  (globalThis as { __dial?: () => unknown }).__dial = () => ({ rot, grab, digits, line, returning });

  // ---------------- the scene ----------------
  return { id: 'phone',
    enter() { g().supply.phone = true; },
    frame(_a, dt) { t += dt; const desk = pixels(imgDesk), body = pixels(imgBody, C.body.size[0], C.body.size[1]), stop = pixels(imgStop, 17, 23), hs = pixels(imgHandset, C.handset.size[0], C.handset.size[1]), wh = pixels(imgWheel, C.wheel.size[0], C.wheel.size[0]);
      if (!desk || !body || !stop || !hs || !wh) { S.fill(0, 0, W, H, COL.wood2); ui.label({ x: 0, y: 130, w: W, h: 10 }, '책상을 펴는 중…', COL.cream, 'c'); return; }
      const A = air(Wd().clock.today, Wd().clock.minute, g().weather.today ?? 'clear', g().seed), k = 0.62 + 0.38 * Math.max(A.daylight, 0.55);   // the desk lamp keeps it readable at night
      for (let i = 0; i < W * H * 4; i += 4) { d[i] = desk[i]! * k; d[i + 1] = desk[i + 1]! * k; d[i + 2] = desk[i + 2]! * k * (A.daylight < 0.4 ? 0.9 : 1); d[i + 3] = 255; }
      lift += (liftWant - lift) * Math.min(1, dt * 9);
      // the telephone: its shadow, the body, the number card's figures, the wheel, the stop, the cord, the handset
      shadow(C.body.at[0]! + C.body.size[0]! / 2 + 6, C.body.at[1]! + C.body.size[1]! - 4, C.body.size[0]! / 2 + 6, 9, 0.55);
      sprite(body, C.body.size[0]!, C.body.size[1]!, C.body.at[0]!, C.body.at[1]!, k);
      C.wheel.holes.forEach((_, i) => { const a = holeAt(i, 0), s = i === 9 ? '0' : String(i + 1); tiny(s, rcx + Math.cos(a) * C.wheel.holeR - 1, rcy + Math.sin(a) * C.wheel.holeR - 2, (x, y) => put(x, y, [40 * k, 30 * k, 26 * k])); });
      wheel(wh, k);
      tiny('MILLBROOK', rcx - 17, rcy - 9, (x, y) => put(x, y, [70 * k, 56 * k, 44 * k])); tiny(D.myNumber, rcx - 15, rcy - 1, (x, y) => put(x, y, [RED[0] * k, RED[1] * k, RED[2] * k]), 2);
      sprite(stop, 17, 23, C.stop.at[0]!, C.stop.at[1]!, k);
      if (grab) { const a = holeAt(grab.hole, rot), fx = rcx + Math.cos(a) * C.wheel.holeR, fy = rcy + Math.sin(a) * C.wheel.holeR; for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const q = i * i + j * j; if (q < 26) put(fx + i, fy + j, q > 18 ? [150, 96, 72] : j < -2 ? [246, 214, 190] : [226, 176, 146]); } }
      const hy = C.handset.at[1]! - lift * 130, hx = C.handset.at[0]! - lift * 10;
      cord(C.handset.socket[0]! - C.handset.at[0]! + hx, C.handset.socket[1]! - C.handset.at[1]! + hy);
      if (lift < 0.3) shadow(hx + C.handset.size[0]! / 2 + 5, hy + C.handset.size[1]! - 6, C.handset.size[0]! / 2, 6, 0.35);
      sprite(hs, C.handset.size[0]!, C.handset.size[1]!, hx, hy, k);
      // the book
      const hits = drawBook(desk, k);
      if (turn) { turn.t += dt / 0.42; if (turn.t >= 1) { book().page = Math.max(0, Math.min(pages.length - 2, book().page - (book().page % 2) + turn.dir * 2)); turn = null; } }

      // ---------------- the pointer ----------------
      const p = ui.pointer(); tip = '';
      // the wheel: grab a hole, turn to the stop, let go
      if (grab && p.down) { const a = (Math.atan2(p.y - rcy, p.x - rcx) * 180) / Math.PI; let dd = a - grab.last; while (dd > 180) dd -= 360; while (dd < -180) dd += 360; grab.last = a; const before = Math.floor(rot / STEP); rot = Math.max(0, Math.min(grab.max, rot + dd)); if (Math.floor(rot / STEP) > before) app.sound.once('tick'); }
      else if (grab && !p.down) { const dgt = grab.hole + 1, n = rot >= grab.max - 10 ? dgt : Math.max(0, dgt - Math.ceil((grab.max - rot) / STEP)); if (n > 0) app.sound.once('pulses', { n }); returning = true; grab = null; dialled(n); }
      else if (!grab && returning) { rot = Math.max(0, rot - dt * 300); if (rot === 0) returning = false; }
      else if (!grab && p.down && !returning && !ui.tookClick) { const q0 = p.at, dc = Math.hypot(q0.x - rcx, q0.y - rcy);   // the hole where the finger went in, not where it has got to
        if (dc > C.wheel.holeR - C.wheel.hole - 2 && dc < C.wheel.holeR + C.wheel.hole + 2) for (let i = 0; i < 10; i++) { const a = holeAt(i, 0); if (Math.hypot(q0.x - (rcx + Math.cos(a) * C.wheel.holeR), q0.y - (rcy + Math.sin(a) * C.wheel.holeR)) <= C.wheel.hole + 1.5) {
          if (line === 'tone' || line === 'dialing') grab = { hole: i, max: maxRot(i), last: C.wheel.holes[i]! /* from the hole itself: a quick finger's first move is not lost */ }; else if (line === 'onhook') app.toast('먼저 수화기를 든다'); break; } } }
      // the handset and the cradle
      const onHandset = p.x >= hx && p.x < hx + C.handset.size[0]! && p.y >= hy && p.y < hy + C.handset.size[1]!, onCradle = line !== 'onhook' && p.x >= C.body.at[0]! + 20 && p.x < C.body.at[0]! + C.body.size[0]! - 20 && p.y >= C.body.at[1]! - 6 && p.y < C.body.at[1]! + 26;
      if (line === 'onhook' && onHandset) tip = '수화기를 든다'; if (onCradle) tip = '수화기를 내려놓는다 (끊는다)';
      if (ui.missed() && !grab) { if (line === 'onhook' && onHandset) liftUp(); else if (onCradle) hangUp(); }
      // the book: entries, corners, tabs
      if (!turn && !form) for (const h of hits) { const r = pageRect(h.side), ax = r.x + h.r.x, ay = r.y + h.r.y; if (p.x >= ax && p.x < ax + h.r.w && p.y >= ay && p.y < ay + h.r.h) {
        tip = h.ad ? h.ad.ko : h.e ? (h.e.id ? `${h.e.ko}${h.e.no ? ' · ' + h.e.no : h.e.long ? ' · 장거리: 0번 교환원에게' : ''}` : h.e.ko) : '';
        if (h.e?.id && ui.missed()) { const B = book(), i = B.marks.indexOf(h.e.id); if (i >= 0) B.marks.splice(i, 1); else B.marks.push(h.e.id); app.sound.once('peel'); } } }
      const spread = book().page - (book().page % 2), canFwd = spread + 2 < pages.length, canBack = spread > 0;
      const cornerR = { x: rx1 - 16, y: ly1 - 16, w: 18, h: 18 }, cornerL = { x: lx0 - 2, y: ly1 - 16, w: 18, h: 18 }, inR = (r: Rect) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
      if (!turn && canFwd && inR(cornerR)) { tip = '다음 장 (누르고 있으면 훑어 넘긴다)'; for (let n = 0; n < 7; n++) put(rx1 - 2 - n, ly1 - 2 - (6 - n), [150 * k, 120 * k, 80 * k]); }
      if (!turn && canBack && inR(cornerL)) tip = '앞 장';
      const turnTo = (dir: 1 | -1) => { if (turn || (dir > 0 ? !canFwd : !canBack)) return; turn = { from: spread, dir, t: 0 }; app.sound.once('paper'); };
      if (ui.missed()) { if (inR(cornerR)) turnTo(1); else if (inR(cornerL)) turnTo(-1); }
      if (p.down && (inR(cornerR) || inR(cornerL))) { holdCorner += dt; if (holdCorner > 0.45 && !turn) turnTo(inR(cornerR) ? 1 : -1); } else holdCorner = 0;
      TABS.forEach(([, ko, test], n) => { const r = { x: rx1 + 1, y: ly0 + 18 + n * 30, w: 9, h: 20 }; if (!inR(r)) return; tip = `색인: ${ko}`; if (ui.missed()) { const idx = pages.findIndex(pg => pg.some(q => test(q.b))); if (idx >= 0) { book().page = idx - (idx % 2); app.sound.once('paper'); } } });

      // ---------------- the line ----------------
      if (line === 'ringing') { ringT += dt; if (ringT > (who || operator ? 3.2 : 6)) answer(); }
      if (shown < said.length) { talkT += dt; while (talkT > 0.03 && shown < said.length) { talkT -= 0.03; shown++; if (shown % 3 === 0) app.sound.once('blip', { pitch: operator ? 1.5 : 1.1 }); } }
      const box: Rect = { x: 4, y: 230, w: 472, h: 37 };
      if (line === 'talk') { ui.panel(box, 'card'); const nm = operator ? '교환원' : who ? who.ko.split(' (')[0]! : '';
        ui.label({ x: box.x + 6, y: box.y + 3, w: 200, h: 9 }, nm, RED); ui.paragraph({ x: box.x + 6, y: box.y + 13, w: 300, h: 22 }, said.slice(0, shown), COL.ink, 10);
        const ready = shown >= said.length, btn = (id: string, i: number, label: string) => ready && ui.button(id, { x: box.x + 312 + (i % 2) * 80, y: box.y + 4 + Math.floor(i / 2) * 16, w: 76, h: 14 }, label);
        if (operator) { D.longDistance.forEach((e, i) => { if (i < 3 && btn('op' + i, i, (e as Entry & { short?: string }).short ?? e.name)) { operator = false;   /* charged when they answer */ who = { ...e, no: '', long: true }; digits = ''; line = 'ringing'; ringT = 0; app.sound.ring(true); say('연결해 드리지요. 잠시만요…'); } });
          if (btn('op-x', 3, '끊는다')) hangUp(); }
        else { if (btn('bye', 3, '끊는다')) hangUp(); } }
      else if (line !== 'onhook') { ui.panel(box, 'card'); ui.label({ x: box.x + 6, y: box.y + 4, w: 300, h: 9 }, { tone: '뚜― 발신음. 번호를 돌린다.', dialing: '번호를 돌리는 중…', ringing: '따르릉… 신호가 간다', onhook: '', talk: '' }[line], COL.ink);
        ui.label({ x: box.x + 6, y: box.y + 16, w: 300, h: 9 }, `돌린 번호  ${(digits + '____').slice(0, 4).split('').join(' ')}`, COL.inkSoft); }
      else { ui.label({ x: 8, y: 254, w: 300, h: 9 }, '수화기를 들고, 번호부에서 번호를 찾아 다이얼을 돌린다.', COL.cream); }
      // the order slip over the left page while talking to a shop
      if (line === 'talk' && form && shown >= said.length && who) { const slip: Rect = { x: lx0 + 2, y: ly0 + 4, w: lx1 - lx0 - 4, h: ly1 - ly0 - 8 }; ui.panel(slip, 'card');
        ui.label({ x: slip.x + 5, y: slip.y + 4, w: slip.w - 10, h: 9 }, form.grocer ? '주문 쪽지 (배달: 내일 아침)' : '물어볼 물건', COL.ink);
        const rows = form.grocer ? form.grocer.map(gi => ({ label: gi.ko, sub: `$${gi.price.toFixed(2)}` })) : form.parts.map(pt => { const c = Wd().supply.catalog(who!.supplier!).filter(x => x.part === pt).sort((a, b) => a.price - b.price)[0]!; return { label: D.parts[pt] ?? pt, sub: `$${c.price.toFixed(0)}~ · 최소 ${c.minOrder}` }; });
        rows.forEach((rw, i) => { const y = slip.y + 18 + i * 24; ui.label({ x: slip.x + 5, y, w: slip.w - 10, h: 9 }, rw.label, COL.ink); ui.label({ x: slip.x + 5, y: y + 10, w: 60, h: 9 }, rw.sub, COL.inkSoft);
          const v = ui.stepper('q' + i, { x: slip.x + slip.w - 46, y: y + 8, w: 42, h: 12 }, form!.qty[i]!, { min: 0, max: 9, step: 1 }, n => `${n}`); if (v !== null) form!.qty[i] = v; });
        const any = form.qty.some(q => q > 0), b0 = { x: slip.x + 5, y: slip.y + slip.h - 34, w: slip.w - 10, h: 13 }, b1 = { ...b0, y: b0.y + 16 };
        if (done) ui.paragraph({ x: slip.x + 5, y: b0.y - 2, w: slip.w - 10, h: 30 }, '주문했다.', COL.inkSoft);
        else if (form.grocer) { if (ui.button('order', b0, '보내 달라고 한다', { disabled: !any })) { const items = form.grocer.map((gi, i) => ({ item: gi.item, qty: form!.qty[i]!, price: gi.price })).filter(x => x.qty > 0);
            Wd().clock.schedule({ date: addDays(Wd().clock.today, 1), minute: 600, kind: 'delivery', payload: { from: who.ko.split(' (')[0], items } }); done = true; say('알겠습니다. 내일 아침 열 시쯤 배달해 드리지요. 값은 받으실 때 주십시오.'); } }
        else if (!quote) { if (ui.button('ask', b0, '값을 묻는다', { disabled: !any })) { const want = form.parts.map((pt, i) => ({ part: pt, qty: form!.qty[i]! })).filter(x => x.qty > 0); quote = Wd().supply.call(who.supplier!, want);
            if (!quote) say('그건 지금 없습니다.'); else { const tot = quote.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0); say(`${quote.lines.map(l => `${D.parts[l.part] ?? l.part} ${l.qty}벌, 벌당 $${l.unitPrice.toFixed(2)}`).join(', ')}. 모두 $${tot.toFixed(2)}이고, ${quote.leadDays}일이면 보냅니다.${quote.prepaid ? ' 처음 거래라 값은 먼저 주셔야 합니다.' : ''}`); } } }
        else { if (ui.button('take', b0, '주문한다')) { const o = Wd().supply.order(quote.id); done = true; say(`주문 받았습니다. ${o.due}에 도착하도록 보내지요.`); }
          if (ui.button('later', b1, '생각해 보겠다')) { done = true; say('네, 견적은 두 주 동안 그대로입니다.'); } } }
      // the pointer's note, and the way out
      if (tip) { const tw = S.tw(tip) + 8, x = Math.min(W - tw - 2, Math.max(2, p.x - tw / 2)), y = Math.max(2, p.y - 16); S.fill(x, y, tw, 11, hex('#1a120b')); S.text(tip, x + 4, y + 2, COL.lit); }
      if (ui.button('leave', { x: 4, y: 4, w: 78, h: 13 }, '책상을 떠난다')) { hangUp(); app.pop(); }
      void split; void say2; },
    key(_a, e) { const k = e.key; if (k === 'Escape') { hangUp(); app.pop(); return true; } if (k === ' ') { if (line === 'onhook') liftUp(); else hangUp(); return true; }
      if (k === 'ArrowRight' || k === 'ArrowLeft') { const B = book(), spread = B.page - (B.page % 2), dir = k === 'ArrowRight' ? 1 : -1; if (!turn && ((dir > 0 && spread + 2 < pages.length) || (dir < 0 && spread > 0))) { turn = { from: spread, dir, t: 0 }; app.sound.once('paper'); } return true; } return false; },
    leave() { hangUp(); } };
}
