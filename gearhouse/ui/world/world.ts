// Version one, step 3: the places of the shop and the clock that runs through them. One running game (core/world) and
// its minute clock; the player is in one place at a time (the front, the kitchen, the workshop room, the garage, the
// telephone desk) and goes between them by doors and objects, the screen fading between rooms. The clock's pace
// follows what the player is doing: free (a day a minute), an event (something arriving), work (in the garage), talk
// (a conversation; the clock stands). The day's news comes in as notes; things due at an hour (a customer's car) come
// as a card. The bed ends the day.
// Backgrounds are placeholders made from the planner's reference pictures (assets/placeholder, 480x270, 64 colours);
// the game's own are layered pictures that change with weather and hour (docs/version_list.md).
import type { App, Scene } from '../shell/app';
import { store } from '../shell/app';
import { split, COL, mix, rnd, type Rect } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import type { Pace, Passage } from '../../core/clock';
import type { Incident } from '../../core/state';
import { parts, weekday } from '../../core/calendar';
import { drawingScene, standardAsks } from '../scenes/drawing';
import { phoneScene } from '../scenes/phone';
import imgFront from '../../assets/places/front/front.png';
import { ambience } from './ambience';
import { parts as dateParts } from '../../core/calendar';
import imgKitchen from '../../assets/placeholder/kitchen.png';
import imgGarage from '../../assets/placeholder/garage.png';
import imgWorkshop from '../../assets/placeholder/workshop.png';
import imgPhone from '../../assets/placeholder/phone.png';
import { kitchenPlace, type KitchenSpot } from './kitchen';
import { settleKitchen } from '../../core/house';
import { air } from '../../core/atmosphere';

type Place = 'front' | 'kitchen' | 'workshop' | 'garage' | 'phone';
interface Spot { r: Rect; label: string; go?: Place; act?: string }
const PLACES: Record<Place, { name: string; img: string; pace: Pace; spots: Spot[]; outdoor?: boolean }> = {
  front: { name: '집 앞', img: imgFront, pace: 'free', outdoor: true, spots: [{ r: { x: 158, y: 98, w: 26, h: 68 }, label: '현관 (집 안으로)', go: 'kitchen' }, { r: { x: 302, y: 98, w: 162, h: 70 }, label: '차고', go: 'garage' }] },
  kitchen: { name: '주방', img: imgKitchen, pace: 'free', spots: [{ r: { x: 105, y: 182, w: 270, h: 70 }, label: '탁자 (상담하는 곳)', act: 'table' }, { r: { x: 460, y: 60, w: 20, h: 160 }, label: '공방 방으로', go: 'workshop' }] },
  workshop: { name: '공방 방', img: imgWorkshop, pace: 'free', spots: [{ r: { x: 36, y: 128, w: 184, h: 96 }, label: '설계도 (제도판)', act: 'drafting' }, { r: { x: 282, y: 98, w: 146, h: 104 }, label: '침대 (하루를 마친다)', act: 'sleep' }, { r: { x: 426, y: 50, w: 54, h: 166 }, label: '책장 (잡지 · 카탈로그)', act: 'books' }, { r: { x: 0, y: 20, w: 22, h: 220 }, label: '주방으로', go: 'kitchen' }] },
  garage: { name: '차고', img: imgGarage, pace: 'work', spots: [{ r: { x: 0, y: 62, w: 112, h: 152 }, label: '작업대 (공구)', act: 'bench' }, { r: { x: 130, y: 130, w: 280, h: 110 }, label: '작업 칸', act: 'bay' }] },
  phone: { name: '전화 책상', img: imgPhone, pace: 'talk', spots: [{ r: { x: 30, y: 10, w: 210, h: 230 }, label: '전화', act: 'call' }] } };
const NAV: Place[] = ['front', 'kitchen', 'workshop', 'garage', 'phone'];
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const SKY: Record<string, string> = { clear: '맑음', rain: '비', snow: '눈' };
const KIND: Record<string, string> = { auction_result: '경매 결과', bank_closed: '은행 폐쇄', bank_settled: '은행 정산', bankruptcy: '파산', build_step_done: '제작 공정 끝', car_broke_down: '차 고장', car_built: '차 완성', cash_warning: '현금 부족', customer_arrives: '손님 방문', customer_cannot_pay: '손님 지불 불능', customer_letter: '편지', delivery_delayed: '배달 늦음', design_finalized: '설계 확정', inquiry: '제작 문의', loan_answer: '대출 답장', loan_missed: '대출 연체', month_closed: '월말 결산', newspaper: '조간 신문', order_late: '주문 늦음', paint_held: '도장 보류', parts_delivered: '부품 납품', quote_answer: '견적 답', repair_complaint: '수리 불만', repair_inquiry: '수리 손님', repair_late: '수리 늦음', show_result: '전시회 결과', stock_short: '재고 부족', supplier_no_stock: '공급사 품절', supplier_quote: '공급사 견적', task_done: '일 끝', tax_notice: '세금 고지', tender_result: '입찰 결과', wage_missed: '임금 체불' };

/** a picture decoded once into RGBA pixels */
const pics = new Map<string, Uint8ClampedArray | null>();
function pic(url: string): Uint8ClampedArray | null { if (pics.has(url)) return pics.get(url)!; pics.set(url, null);
  const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = 480; c.height = 270; const x = c.getContext('2d')!; x.drawImage(im, 0, 0, 480, 270); pics.set(url, x.getImageData(0, 0, 480, 270).data); }; im.src = url; return null; }

export function worldScene(app: App): Scene {
  const ui = app.ui, S = app.S, W = () => app.world!, kitchen = kitchenPlace(app), quiet = ambience();
  let place: Place = 'front', fade = 0, going: Place | null = null, after: (() => void) | null = null, t = 0, eventLeft = 0, lastSave = -1;
  const notes: { at: string; text: string; inc?: Incident }[] = [], cards: { text: string; go?: Place; until: number }[] = [];
  const travel = (to: Place, then?: () => void) => { if (fade) return; if (place === 'kitchen' && to !== 'kitchen') kitchen.quiet(); going = to; after = then ?? null; fade = 0.001; app.sound.once('paper'); };
  const pace = (): Pace => (app.top?.id !== 'world' ? 'talk' : eventLeft > 0 ? 'event' : PLACES[place].pace);
  function take(p: Passage) {
    for (const s of p.stops) notes.unshift({ at: W().clock.hhmm(), text: `${KIND[s.kind] ?? s.kind}${s.payload.customer ? ' · ' + String(s.payload.customer) : ''}`, inc: s });
    for (const d of p.due) if (d.kind === 'repair_visit') { const j = W().repair.view(d.ref!); eventLeft = 25; cards.push({ text: `차 한 대가 집 앞에 섰다. ${j.name} 씨, ${j.car}.`, go: 'front', until: t + 20 }); app.sound.ambient('engine', 0.6, 0.9); setTimeout(() => app.sound.ambient('engine', 0), 2500); }
    if (notes.length > 30) notes.length = 30; }
  function act(a: string) { const w = W();
    if (a === 'sleep') { if (fade) return; travel('workshop', () => { const m0 = w.clock.minute; take(w.clock.sleep()); if (w.sim.g.house) settleKitchen(w.sim.g.house.kitchen, 1440 - m0 + w.clock.minute, 18); app.save(); app.toast(`잠에서 깼다. ${dateKo()}`); }); return; }
    if (a === 'drafting') { app.push(drawingScene(app, { from: '공방 설계 (자작)', asks: standardAsks({ body: 'sedan' }), era: '1920s', size: 0, back: () => app.pop() })); return; }
    if (a === 'call') { app.push(phoneScene(app)); return; }
    app.toast({ table: '손님과 마주 앉는 곳 (손님 흐름은 다음 단계)', books: '잡지와 부품 카탈로그 (부품 라이브러리는 뒤 단계)', bench: '공구 (수리 작업은 6단계)', bay: '차를 세우는 칸 (수리 차가 들어오면 여기에)' }[a] ?? a); }
  const dateKo = () => { const d = W().clock.today, p = parts(d); return `${p.year}년 ${p.month}월 ${p.day}일 (${WD[weekday(d)]})`; };

  /** the room's light by the hour: dark at night, warm at dusk; the outdoors also greys under rain */
  function draw() { const src = pic(PLACES[place].img), m = W().clock.minute, h = m / 60, L = Math.min(1, Math.max(0, (h - 5) / 2), Math.max(0, (20 - h) / 2)), dusk = Math.max(0, 1 - Math.abs(h - 18.7) / 1.5), sky = W().sim.g.weather.today, out = !!PLACES[place].outdoor;
    const dark = out ? 0.3 + 0.7 * L * (sky === 'clear' ? 1 : 0.8) : 0.55 + 0.45 * L, d = S.d;
    if (!src) { S.fill(0, 0, 480, 270, COL.wood2); ui.label({ x: 0, y: 130, w: 480, h: 10 }, '그림을 여는 중…', COL.cream, 'c'); return; }
    for (let i = 0; i < 480 * 270; i++) { let r = src[i * 4]!, g = src[i * 4 + 1]!, b = src[i * 4 + 2]!; const k = dark;
      r = r * k + 14 * (1 - k); g = g * k + 18 * (1 - k); b = b * k + 36 * (1 - k); if (dusk > 0 && out) { r = Math.min(255, r * (1 + dusk * 0.15)); b = b * (1 - dusk * 0.12); }
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
    if (out && sky === 'rain') for (let k = 0; k < 200; k++) { const x0 = (rnd(k * 31) * 480 + t * 40) % 480, y0 = (rnd(k * 17) * 270 + t * (260 + rnd(k) * 80)) % 270; for (let j = 0; j < 5; j++) S.px(x0 - j * 0.3, y0 - j, hex('#c8d4e0'), 0.32 - j * 0.05); }
    if (out && sky === 'snow') for (let k = 0; k < 150; k++) { const x0 = (rnd(k * 31) * 480 + Math.sin(t + k) * 8) % 480, y0 = (rnd(k * 17) * 270 + t * (24 + rnd(k) * 20)) % 270; S.px(x0, y0, hex('#ffffff'), 0.85); } }

  return { id: 'world', enter() { notes.unshift({ at: W().clock.hhmm(), text: `${dateKo()}, 밀브룩. 공방의 하루가 시작된다.` }); },
    frame(_a, dt) { t += dt;
      // time
      const p = W().clock.tick(dt, pace()); take(p); if (eventLeft > 0) eventLeft -= dt;
      const hour = Math.floor(W().clock.minute / 60); if (hour !== lastSave) { lastSave = hour; app.save(); }
      // objects you can use: the living kitchen lights what is under the pointer; the other places outline it
      const pt = ui.pointer(), inside = (r: Rect) => pt.x >= r.x && pt.x < r.x + r.w && pt.y >= r.y && pt.y < r.y + r.h && pt.y > 22 && pt.y < 246;
      let over: Spot | null = null, kOver: KitchenSpot | null = null;
      if (place === 'kitchen') { for (const s of kitchen.spots) if (inside(s.r)) kOver = s; } else for (const s of PLACES[place].spots) if (inside(s.r)) over = s;
      if (place !== 'kitchen' || !kitchen.draw(dt, fade ? null : kOver)) draw();
      { const A = air(W().clock.today, W().clock.minute, W().sim.g.weather.today ?? 'clear', W().sim.g.seed); if (place !== 'kitchen') { app.sound.ambient('rain', A.rain * (place === 'front' ? 1 : 0.3)); app.sound.ambient('wind', A.wind * (place === 'front' ? 0.8 : 0.15)); }
        quiet(app.sound, place, A, W().clock.minute, dateParts(W().clock.today).month, W().sim.g.house?.kitchen.window ?? 0, dt); }
      if (kOver && !fade) { const label = kOver.label(), tw = S.tw(label) + 8, lx = Math.min(480 - tw - 2, Math.max(2, pt.x - tw / 2)), ly = Math.max(24, pt.y - 16); S.fill(lx, ly, tw, 11, hex('#1a120b')); S.text(label, lx + 4, ly + 2, COL.lit);
        if (ui.missed()) { if (kOver.go) travel(kOver.go); else if (!kitchen.act(kOver.act)) act(kOver.act); } }
      if (over && !fade) { const r = over.r; for (let x = r.x; x < r.x + r.w; x++) { if (((x + Math.floor(t * 12)) >> 2) % 2) { S.px(x, r.y, COL.lit); S.px(x, r.y + r.h - 1, COL.lit); } } for (let y = r.y; y < r.y + r.h; y++) if (((y + Math.floor(t * 12)) >> 2) % 2) { S.px(r.x, y, COL.lit); S.px(r.x + r.w - 1, y, COL.lit); }
        const tw = S.tw(over.label) + 8, lx = Math.min(480 - tw - 2, Math.max(2, pt.x - tw / 2)), ly = Math.max(24, pt.y - 16); S.fill(lx, ly, tw, 11, hex('#1a120b')); S.text(over.label, lx + 4, ly + 2, COL.lit); }
      if (over && ui.missed() && !fade && pt.y > 22 && pt.y < 246) { if (over.go) travel(over.go); else if (over.act) act(over.act); }
      // the plate: the day, the hour, the weather, the money, the pace
      const g = W().sim.g, plate = { x: 4, y: 4, w: 472, h: 16 }; ui.panel(plate, 'enamel'); const [a, b, c, e] = split({ x: 10, y: 8, w: 460, h: 9 }, ['*', 52, 70, 80], 4);
      ui.label(a!, `${dateKo()} · ${PLACES[place].name}`, COL.cream); ui.label(b!, W().clock.hhmm(), COL.lit, 'r'); ui.label(c!, `${SKY[g.weather.today ?? 'clear'] ?? ''} · $${Math.round(g.ledger.cash)}`, COL.cream, 'r');
      ui.label(e!, { free: '하루 60초', event: '느리게', work: '작업 20배', talk: '멈춤' }[pace()], COL.card2, 'r');
      // where you can go
      const nav = split({ x: 4, y: 250, w: 330, h: 16 }, NAV.map(() => '*' as const), 2); NAV.forEach((n, k) => { if (ui.tab('go-' + n, nav[k]!, PLACES[n].name, place === n)) { if (n === 'phone') act('call'); else if (n !== place) travel(n); } });
      // the day's notes
      const open = pt.x >= 330 && pt.y >= 176 && pt.y < 248, nb = open ? { x: 330, y: 176, w: 146, h: 70 } : { x: 330, y: 224, w: 146, h: 22 }; ui.panel(nb, 'card'); let ny = nb.y + 4;
      for (const [k, n] of notes.slice(0, open ? 4 : 1).entries()) { if (ny > nb.y + nb.h - 12) break; ny += 10 * ui.paragraph({ x: nb.x + 5, y: ny, w: nb.w - 10, h: Math.min(20, nb.y + nb.h - 3 - ny) }, `${n.at} ${n.text}`, k ? COL.inkSoft : COL.ink) + 2; }
      // something happening now
      for (let k = cards.length - 1; k >= 0; k--) if (cards[k]!.until < t) cards.splice(k, 1);
      const card = cards[0]; if (card) { const r = { x: 276, y: 26, w: 200, h: 44 }; ui.panel(r, 'card'); ui.paragraph({ x: r.x + 6, y: r.y + 4, w: r.w - 12, h: 20 }, card.text, COL.ink);
        const [b1, b2] = split({ x: r.x + 6, y: r.y + 27, w: r.w - 12, h: 13 }, ['*', '*'], 6); if (card.go && ui.button('card-go', b1!, '나가 본다')) { travel(card.go); cards.shift(); } if (ui.button('card-x', b2!, '두고 본다')) cards.shift(); }
      // between rooms: a fade
      if (fade > 0) { fade += dt * 2.4; if (fade >= 1 && going) { place = going; going = null; after?.(); after = null; } const a2 = fade < 1 ? fade : Math.max(0, 2 - fade); if (fade >= 2) fade = 0; for (let i = 0; i < 480 * 270; i++) S.px(i % 480, (i / 480) | 0, [0, 0, 0], a2); }
      void mix; void store;
    },
    key(_a, e) { const k = '12345'.indexOf(e.key); if (k >= 0) { const n = NAV[k]!; if (n === 'phone') act('call'); else travel(n); return true; } return false; } };
}
