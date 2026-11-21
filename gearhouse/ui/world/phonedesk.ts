// The telephone desk (version one, step 5; reviews 47, 48). The planner's desk with a telephone made of the parts
// sheet's pieces (tools/places/phone.py), so its parts move, and the directory lying shut beside it (ui/world/
// directory.ts: click it and it opens close to the eye, printed fine):
// - the handset: pick it up (it rises out of the picture, to your ear; the cord follows it) and the dial tone comes;
//   put it back on the cradle to hang up
// - the dial: put a finger in a hole, turn the wheel clockwise to the finger stop, let go; it runs home at ten clicks
//   a second, one click for 1, ten for 0 (let go early and it sends fewer). The wheel is turned from a picture kept at
//   three times the screen's scale, so it turns smoothly.
// - the note pad: the numbers ringed in pencil in the directory, to dial without opening it again
// - the calls: the town's shops and the shop's suppliers answer (the supply system's own: their prices are a quote at
//   once, an order is placed like any other), the grocer sends tea and coffee next morning, 0 is the operator, who
//   puts long-distance calls through. A local call costs a nickel, long distance 75 cents. The voice down the line is a
//   murmur in the telephone's narrow band, one syllable at a time as the words come.
import type { App, Scene } from '../shell/app';
import { COL, type Rect } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import { tiny } from '../pixel/tiny';
import { pixels } from './pics';
import { directoryBook, DIR, type Entry } from './directory';
import { newHouse, type HouseState } from '../../core/house';
import { post } from '../../core/ledger';
import { addDays } from '../../core/calendar';
import { air } from '../../core/atmosphere';
import type { Quote } from '../../core/supply';
import cut from '../../data/places/phone_cut.json';
import imgDesk from '../../assets/places/phone/desk.png';
import imgBody from '../../assets/places/phone/body.png';
import imgStop from '../../assets/places/phone/stop.png';
import imgHandset from '../../assets/places/phone/handset.png';
import imgWheel from '../../assets/places/phone/wheel.png';

const W = 480, H = 270;
type Line = 'onhook' | 'tone' | 'dialing' | 'ringing' | 'talk';
interface GroceryItem { item: string; ko: string; price: number }
const C = cut as unknown as { body: { at: number[]; size: number[] }; stop: { at: number[] }; ring: number[]; wheel: { size: number[]; scale: number; holeR: number; hole: number; holes: number[]; stopAngle: number }; handset: { at: number[]; size: number[]; socket: number[] }; cord: { into: number[]; dark: number[]; mid: number[]; light: number[] } };
const RED: RGB = [138, 40, 30];

export function phoneDesk(app: App): Scene {
  const ui = app.ui, S = app.S, Wd = () => app.world!, g = () => Wd().sim.g;
  const house = (): HouseState => (g().house ??= newHouse()), bookState = () => (house().book ??= { marks: [], page: 0 });
  const book = directoryBook(app, bookState);
  let line: Line = 'onhook', digits = '', t = 0, lift = 0, liftWant = 0;
  let rot = 0, grab: { hole: number; max: number; last: number } | null = null, returning = false, ringT = 0;
  let who: Entry | null = null, operator = false, said = '', shown = 0, talkT = 0, voice = 1;
  let form: { qty: number[]; parts: string[]; grocer?: GroceryItem[] } | null = null, quote: Quote | null = null, done = false;
  /** someone speaks: the words appear as they are said, the voice murmurs with them */
  const say = (s: string) => { said = s; shown = 0; talkT = -0.15; };

  // ---------------- the telephone ----------------
  const [rcx, rcy] = C.ring as [number, number], STEP = 30, holeAt = (i: number, r: number) => ((C.wheel.holes[i]! + r) * Math.PI) / 180;
  const maxRot = (i: number) => (((C.wheel.stopAngle - C.wheel.holes[i]!) % 360) + 360) % 360;
  function liftUp() { if (line !== 'onhook') return; liftWant = 1; app.sound.once('pickup'); app.sound.dialTone(true); app.sound.ambient('line', 1); line = 'tone'; digits = ''; }
  function hangUp() { if (line === 'onhook') return; liftWant = 0; app.sound.once('hangup'); app.sound.ring(false); app.sound.dialTone(false); app.sound.ambient('line', 0); line = 'onhook'; digits = ''; who = null; operator = false; grab = null; form = null; quote = null; said = ''; }
  function dialled(n: number) { if (n <= 0) return; digits += n === 10 ? '0' : String(n); app.sound.dialTone(false); line = 'dialing';
    if (digits === '0') { setTimeout(() => { if (digits === '0' && line === 'dialing') { line = 'ringing'; ringT = 2.6; operator = true; app.sound.ring(true); } }, 700); return; }
    if (digits.length === 4) { line = 'ringing'; ringT = 0; app.sound.ring(true); who = DIR.entries.find(e => e.no === digits) ?? null; } }
  function answer() { app.sound.ring(false); app.sound.once('pickup'); line = 'talk'; done = false; form = null; quote = null;
    if (operator) { voice = 1.65; say('교환입니다. 몇 번을 대 드릴까요? (Number, please?)'); return; }
    if (!who) { voice = 1.65; say(digits === DIR.myNumber ? '(통화 중 신호다. 이 집 번호다.)' : '(교환원) 지금 거신 번호는 없는 번호입니다. 번호부를 다시 보십시오.'); return; }
    voice = 0.85 + ((who.id.length * 7 + who.id.charCodeAt(0)) % 9) / 18;   // each voice its own pitch
    post(Wd().sim.api(), 'phone', -(who.long ? DIR.longCost : DIR.localCost), who.long ? '장거리 전화 · ' + who.name : '시내 전화 · ' + who.name);
    if (who.supplier) { g().supply.phone = true; const sup = Wd().supply.supplier(who.supplier); if (!g().supply.suppliers[who.supplier]!.known) Wd().supply.discover(who.supplier, 'telephone');
      const parts = [...new Set(sup.catalog.map(c => c.part))]; form = { qty: parts.map(() => 0), parts }; }
    else if (who.grocer) form = { qty: who.grocer.map(() => 0), parts: [], grocer: who.grocer };
    say(who.hello ?? '여보세요?'); }

  // ---------------- drawing helpers ----------------
  const d = S.d, put = (x: number, y: number, c: RGB | number[], a = 1) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; d[i] = d[i]! + (c[0]! - d[i]!) * a; d[i + 1] = d[i + 1]! + (c[1]! - d[i + 1]!) * a; d[i + 2] = d[i + 2]! + (c[2]! - d[i + 2]!) * a; d[i + 3] = 255; };
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
  /** the note pad: the numbers ringed in the directory */
  function notePad(k: number) { const marks = bookState().marks, list = [...DIR.entries, ...DIR.longDistance].filter(e => marks.includes(e.id)), r: Rect = { x: 414, y: 150, w: 64, h: 84 };
    for (let y = r.y + 3; y < r.y + r.h + 3; y++) for (let x = r.x + 3; x < r.x + r.w + 3; x++) put(x, y, [16, 8, 4], 0.35);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) put(x, y, y < r.y + 6 ? [168 * k, 52 * k, 40 * k] : (y - r.y) % 9 === 8 ? [196 * k, 204 * k, 214 * k] : [236 * k, 230 * k, 212 * k]);
    S.text('메모', r.x + 4, r.y + 8, [90, 70, 56]);
    list.slice(0, 7).forEach((e, n) => { const nm = (e.short ?? e.ko.split(' (')[0]!).slice(0, 6); S.text(nm, r.x + 3, r.y + 18 + n * 9, [70, 70, 84], r.w - 22); tiny(e.no || '0', r.x + r.w - 17, r.y + 20 + n * 9, (x, y) => put(x, y, [150, 40, 34])); });
    if (!list.length) S.text('(번호부에서', r.x + 3, r.y + 20, [130, 120, 110]), S.text(' 동그라미)', r.x + 3, r.y + 29, [130, 120, 110]); }

  // for tests: the dial's state
  (globalThis as { __dial?: () => unknown }).__dial = () => ({ rot, grab, digits, line, returning, open: book.isOpen() });

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
      tiny('MILLBROOK', rcx - 17, rcy - 9, (x, y) => put(x, y, [70 * k, 56 * k, 44 * k])); tiny(DIR.myNumber, rcx - 15, rcy - 1, (x, y) => put(x, y, [RED[0] * k, RED[1] * k, RED[2] * k]), 2);
      sprite(stop, 17, 23, C.stop.at[0]!, C.stop.at[1]!, k);
      if (grab) { const a = holeAt(grab.hole, rot), fx = rcx + Math.cos(a) * C.wheel.holeR, fy = rcy + Math.sin(a) * C.wheel.holeR; for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const q = i * i + j * j; if (q < 26) put(fx + i, fy + j, q > 18 ? [150, 96, 72] : j < -2 ? [246, 214, 190] : [226, 176, 146]); } }
      const hy = C.handset.at[1]! - lift * 130, hx = C.handset.at[0]! - lift * 10;
      cord(C.handset.socket[0]! - C.handset.at[0]! + hx, C.handset.socket[1]! - C.handset.at[1]! + hy);
      if (lift < 0.3) shadow(hx + C.handset.size[0]! / 2 + 5, hy + C.handset.size[1]! - 6, C.handset.size[0]! / 2, 6, 0.35);
      sprite(hs, C.handset.size[0]!, C.handset.size[1]!, hx, hy, k);
      // the directory, shut; the note pad
      const p = ui.pointer(), inR = (r: Rect) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h, cb = book.closedRect;
      book.drawClosed(k, !book.isOpen() && inR(cb) && !(line === 'talk' && form)); notePad(k);

      // ---------------- the line ----------------
      if (line === 'ringing') { ringT += dt; if (ringT > (who || operator ? 3.2 : 6)) answer(); }
      if (shown < said.length) { talkT += dt; while (talkT > 0.034 && shown < said.length) { talkT -= 0.034; const ch = said[shown]!; shown++;
          if (/[.,?!…]/.test(ch)) talkT -= 0.16; else if (ch !== ' ' && shown % 3 === 0) app.sound.once('murmur', { pitch: voice }); } }
      const box: Rect = { x: 4, y: 236, w: 472, h: 31 };
      if (line === 'talk') { ui.panel(box, 'card'); const nm = operator ? '교환원' : who ? (who.ko.split(' (')[0] ?? '') : '';
        ui.label({ x: box.x + 6, y: box.y + 3, w: 200, h: 9 }, nm, RED); ui.paragraph({ x: box.x + 6, y: box.y + 12, w: 300, h: 20 }, said.slice(0, shown), COL.ink, 9);
        const ready = shown >= said.length, btn = (id: string, i: number, label: string) => ready && ui.button(id, { x: box.x + 312 + (i % 2) * 80, y: box.y + 2 + Math.floor(i / 2) * 14, w: 76, h: 13 }, label);
        if (operator) { DIR.longDistance.forEach((e, i) => { if (i < 3 && btn('op' + i, i, e.short ?? e.name)) { operator = false; who = { ...e, no: '', long: true }; digits = ''; line = 'ringing'; ringT = 0; app.sound.ring(true); say('연결해 드리지요. 잠시만요…'); } });
          if (btn('op-x', 3, '끊는다')) hangUp(); }
        else if (btn('bye', 3, '끊는다')) hangUp(); }
      else if (line !== 'onhook') { ui.panel(box, 'card'); ui.label({ x: box.x + 6, y: box.y + 4, w: 300, h: 9 }, { tone: '뚜― 발신음. 번호를 돌린다.', dialing: '번호를 돌리는 중…', ringing: '따르릉… 신호가 간다', onhook: '', talk: '' }[line], COL.ink);
        ui.label({ x: box.x + 6, y: box.y + 16, w: 300, h: 9 }, `돌린 번호  ${(digits + '____').slice(0, 4).split('').join(' ')}`, COL.inkSoft); }
      else ui.label({ x: 8, y: 254, w: 400, h: 9 }, '수화기를 들고, 번호부를 펴서 번호를 찾아 다이얼을 돌린다.', COL.cream);
      // the order slip, on the desk over the shut book, while talking to a shop
      if (line === 'talk' && form && shown >= said.length && who && !book.isOpen()) { const slip: Rect = { x: cb.x - 4, y: cb.y - 4, w: cb.w + 8, h: cb.h + 4 }; ui.panel(slip, 'card');
        ui.label({ x: slip.x + 6, y: slip.y + 5, w: slip.w - 12, h: 9 }, form.grocer ? '주문 쪽지 (배달: 내일 아침)' : `${who.ko.split(' (')[0]} · 물어볼 물건`, COL.ink);
        const rows = form.grocer ? form.grocer.map(gi => ({ label: gi.ko, sub: `$${gi.price.toFixed(2)}` })) : form.parts.map(pt => { const c = Wd().supply.catalog(who!.supplier!).filter(x => x.part === pt).sort((a, b) => a.price - b.price)[0]!; return { label: DIR.parts[pt] ?? pt, sub: `$${c.price.toFixed(0)}~ · 최소 ${c.minOrder}` }; });
        rows.forEach((rw, i) => { const y = slip.y + 20 + i * 24; ui.label({ x: slip.x + 6, y, w: slip.w - 12, h: 9 }, rw.label, COL.ink); ui.label({ x: slip.x + 6, y: y + 10, w: 90, h: 9 }, rw.sub, COL.inkSoft);
          const v = ui.stepper('q' + i, { x: slip.x + slip.w - 48, y: y + 8, w: 42, h: 12 }, form!.qty[i]!, { min: 0, max: 9, step: 1 }, n => `${n}`); if (v !== null) form!.qty[i] = v; });
        const any = form.qty.some(q => q > 0), b0 = { x: slip.x + 6, y: slip.y + slip.h - 34, w: slip.w - 12, h: 13 }, b1 = { ...b0, y: b0.y + 16 };
        if (done) ui.paragraph({ x: slip.x + 6, y: b0.y, w: slip.w - 12, h: 30 }, '주문했다.', COL.inkSoft);
        else if (form.grocer) { if (ui.button('order', b0, '보내 달라고 한다', { disabled: !any })) { const items = form.grocer.map((gi, i) => ({ item: gi.item, qty: form!.qty[i]!, price: gi.price })).filter(x => x.qty > 0);
            Wd().clock.schedule({ date: addDays(Wd().clock.today, 1), minute: 600, kind: 'delivery', payload: { from: who.ko.split(' (')[0], items } }); done = true; say('알겠습니다. 내일 아침 열 시쯤 배달해 드리지요. 값은 받으실 때 주십시오.'); } }
        else if (!quote) { if (ui.button('ask', b0, '값을 묻는다', { disabled: !any })) { const want = form.parts.map((pt, i) => ({ part: pt, qty: form!.qty[i]! })).filter(x => x.qty > 0); quote = Wd().supply.call(who.supplier!, want);
            if (!quote) say('그건 지금 없습니다.'); else { const tot = quote.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0); say(`${quote.lines.map(l => `${DIR.parts[l.part] ?? l.part} ${l.qty}벌, 벌당 $${l.unitPrice.toFixed(2)}`).join(', ')}. 모두 $${tot.toFixed(2)}, ${quote.leadDays}일이면 보냅니다.${quote.prepaid ? ' 첫 거래라 값은 먼저 주셔야 합니다.' : ''}`); } } }
        else { if (ui.button('take', b0, '주문한다')) { const o = Wd().supply.order(quote.id); done = true; say(`주문 받았습니다. ${o.due}에 도착하도록 보내지요.`); }
          if (ui.button('later', b1, '생각해 보겠다')) { done = true; say('네, 견적은 두 주 동안 그대로입니다.'); } } }

      // ---------------- the hand ----------------
      if (book.isOpen()) { book.frame(dt); return; }   // the open book takes the hand; the room waits
      let tip = '';
      // the wheel: grab a hole, turn to the stop, let go
      if (grab && p.down) { const a = (Math.atan2(p.y - rcy, p.x - rcx) * 180) / Math.PI; let dd = a - grab.last; while (dd > 180) dd -= 360; while (dd < -180) dd += 360; grab.last = a; const before = Math.floor(rot / STEP); rot = Math.max(0, Math.min(grab.max, rot + dd)); if (Math.floor(rot / STEP) > before) app.sound.once('tick'); }
      else if (grab && !p.down) { const dgt = grab.hole + 1, n = rot >= grab.max - 10 ? dgt : Math.max(0, dgt - Math.ceil((grab.max - rot) / STEP)); if (n > 0) app.sound.once('pulses', { n }); returning = true; grab = null; dialled(n); }
      else if (!grab && returning) { rot = Math.max(0, rot - dt * 300); if (rot === 0) returning = false; }
      else if (!grab && p.down && !returning && !ui.tookClick) { const q0 = p.at, dc = Math.hypot(q0.x - rcx, q0.y - rcy);   // the hole where the finger went in, not where it has got to
        if (dc > C.wheel.holeR - C.wheel.hole - 2 && dc < C.wheel.holeR + C.wheel.hole + 2) for (let i = 0; i < 10; i++) { const a = holeAt(i, 0); if (Math.hypot(q0.x - (rcx + Math.cos(a) * C.wheel.holeR), q0.y - (rcy + Math.sin(a) * C.wheel.holeR)) <= C.wheel.hole + 1.5) {
          if (line === 'tone' || line === 'dialing') grab = { hole: i, max: maxRot(i), last: C.wheel.holes[i]! }; else if (line === 'onhook') app.toast('먼저 수화기를 든다'); break; } } }
      // the handset, the cradle, the book
      const onHandset = p.x >= hx && p.x < hx + C.handset.size[0]! && p.y >= hy && p.y < hy + C.handset.size[1]!, onCradle = line !== 'onhook' && p.x >= C.body.at[0]! + 20 && p.x < C.body.at[0]! + C.body.size[0]! - 20 && p.y >= C.body.at[1]! - 6 && p.y < C.body.at[1]! + 26;
      const onBook = inR(cb) && !(line === 'talk' && form);
      if (line === 'onhook' && onHandset) tip = '수화기를 든다'; if (onCradle) tip = '수화기를 내려놓는다 (끊는다)'; if (onBook) tip = '전화번호부를 편다';
      if (ui.missed() && !grab) { if (line === 'onhook' && onHandset) liftUp(); else if (onCradle) hangUp(); else if (onBook) book.open(); }
      if (tip) { const tw = S.tw(tip) + 8, x = Math.min(W - tw - 2, Math.max(2, p.x - tw / 2)), y = Math.max(2, p.y - 16); S.fill(x, y, tw, 11, hex('#1a120b')); S.text(tip, x + 4, y + 2, COL.lit); }
      if (ui.button('leave', { x: 4, y: 4, w: 78, h: 13 }, '책상을 떠난다')) { hangUp(); app.pop(); } },
    key(_a, e) { const k = e.key;
      if (book.isOpen()) { if (k === 'Escape') { book.close(); return true; } if (k === 'ArrowRight' || k === 'ArrowLeft') { book.turn(k === 'ArrowRight' ? 1 : -1); return true; } return false; }
      if (k === 'Escape') { hangUp(); app.pop(); return true; } if (k === ' ') { if (line === 'onhook') liftUp(); else hangUp(); return true; }
      if (k === 'b' || k === 'B') { book.open(); return true; } return false; },
    leave() { hangUp(); } };
}
