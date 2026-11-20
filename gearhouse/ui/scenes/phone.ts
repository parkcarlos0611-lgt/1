// Prototype D (review 33): the telephone and the town's directory. A 1930s desk set seen close: lift the handset for
// the dial tone, put a finger in a hole, turn the wheel round to the stop and let go: the wheel runs home, sending one
// click per step (ten for 0). Letting go short of the stop sends fewer clicks, as on a real dial. After four digits the
// line rings; if the number is in the directory the shop answers and takes an order (paid on delivery). 0 alone is
// the operator, who also puts long-distance calls through. The directory's tabs sort the town by trade.
import type { App, Scene } from '../shell/app';
import { split, COL, rnd, mix, type Rect } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import { pantry } from './pantry';

interface Item { name: string; price: number; give?: 'tea' | 'coffee' }
interface Listing { name: string; line: string; no: string; tab: string; hello: string; items: Item[]; far?: boolean }
const BOOK: Listing[] = [
  { tab: '식료품', name: '해리스 식료품점', line: '메인 가 14 · 차, 커피, 설탕, 통조림', no: '2417', hello: '네, 해리스 식료품입니다. 무엇을 보내 드릴까요?', items: [{ name: '홍차 1봉', price: 0.25, give: 'tea' }, { name: '커피 1파운드', price: 0.33, give: 'coffee' }, { name: '설탕 5파운드', price: 0.27 }, { name: '연유 1통', price: 0.09 }] },
  { tab: '식료품', name: '밀브룩 약국 · 잡화', line: '역 앞 · 커피도 팝니다', no: '1650', hello: '밀브룩 약국입니다. 말씀하세요.', items: [{ name: '커피 1파운드', price: 0.36, give: 'coffee' }, { name: '홍차 1봉', price: 0.28, give: 'tea' }] },
  { tab: '철물', name: '브라운 철물 · 도료', line: '2번 가 · 래커, 납, 플럭스, 마스킹 테이프', no: '3375', hello: '브라운 철물점이오. 뭐가 필요하시오?', items: [{ name: '래커 1쿼트', price: 1.1 }, { name: '납 막대 1파운드', price: 0.4 }, { name: '플럭스 1통', price: 0.15 }, { name: '마스킹 테이프 1롤', price: 0.2 }, { name: '마스킹 종이 1롤', price: 0.35 }, { name: '철수세미 1다스', price: 0.25 }] },
  { tab: '부품', name: '켈러 공업사', line: '강변 길 · 범퍼, 펜더, 램프, 휠', no: '4021', hello: '켈러 공업사입니다. 어느 차 부품을 찾으십니까?', items: [{ name: 'A형 세단 앞 범퍼', price: 6.5 }, { name: 'A형 헤드램프 한 쌍', price: 9 }, { name: 'A형 뒤 펜더', price: 8.75 }, { name: '철사 휠 19인치', price: 7.2 }] },
  { tab: '부품', name: '오닐 폐차장', line: '읍 북쪽 · 중고 부품, 있는 대로', no: '4466', hello: '오닐이오. 뭐든 있을 수도 있고 없을 수도 있소.', items: [{ name: '중고 앞 범퍼', price: 2.5 }, { name: '중고 헤드램프 하나', price: 2 }] },
  { tab: '부품', name: '미드웨스트 엔진 상사 (시카고)', line: '장거리 · 0번 교환을 거쳐 · 엔진 카탈로그', no: 'CHI', hello: '미드웨스트 엔진 상사, 시카고입니다. 카탈로그를 보내 드릴까요?', items: [{ name: '엔진 카탈로그 (우편)', price: 0 }], far: true },
  { tab: '운송', name: '랜싱 운송', line: '견인차 · 평판 트럭 · 밤낮 출장', no: '2290', hello: '랜싱 운송입니다. 어디로 가면 됩니까?', items: [{ name: '견인 출장 (읍내)', price: 3 }, { name: '평판 트럭 하루', price: 5 }] },
  { tab: '기타', name: '밀브룩 쿠리어 (신문)', line: '광고 접수 · 한 줄 50센트', no: '1102', hello: '쿠리어 신문 광고부입니다.', items: [{ name: '광고 한 줄 (한 주)', price: 0.5 }] },
  { tab: '기타', name: '교환', line: '0을 돌리면 교환원 · 장거리 전화', no: '0', hello: '교환입니다. 어디로 연결해 드릴까요?', items: [] } ];
const TABS = ['식료품', '철물', '부품', '운송', '기타'];
const MY_NO = '3108';

export function phoneScene(app: App): Scene {
  const ui = app.ui, S = app.S, P = pantry();
  type Line = 'onhook' | 'tone' | 'dialing' | 'ringing' | 'talk';
  let line: Line = 'onhook', digits = '', tab = 0, noted = '', t = 0;
  let rot = 0, grab: { hole: number; a0: number; max: number; last: number } | null = null, returning = 0, ringT = 0, who: Listing | null = null, said = '', shown = 0, talkT = 0, qty: number[] = [], spent = 0, ordered = false;
  const D = { cx: 128, cy: 156, R: 70, holeR: 51, hole: 9 }, STOP = Math.PI / 3, STEP = Math.PI / 6;   // the finger stop at about four o'clock; holes 30° apart
  /** where hole k sits (k = 1..10, 10 for 0) with the wheel turned by `r` */
  const holeAng = (k: number, r: number) => STOP - (k + 1) * STEP + r;
  const say = (s: string) => { said = s; shown = 0; };
  const vn = (x: number, y: number, s: number) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), r = (a: number, b: number) => rnd(((a * 73856093) ^ (b * 19349663) ^ (s * 83492791)) >>> 0);
    return (r(xi, yi) * (1 - u) + r(xi + 1, yi) * u) * (1 - v) + (r(xi, yi + 1) * (1 - u) + r(xi + 1, yi + 1) * u) * v; };
  function hangUp() { if (line === 'onhook') return; app.sound.once('hangup'); app.sound.ring(false); app.sound.dialTone(false); app.sound.ambient('line', 0); line = 'onhook'; digits = ''; who = null; grab = null; returning = 0; said = ''; }
  function lift() { if (line !== 'onhook') return; app.sound.once('pickup'); app.sound.dialTone(true); app.sound.ambient('line', 1); line = 'tone'; digits = ''; ordered = false; }
  function dialled(n: number) { if (n <= 0) return; const d = n === 10 ? '0' : String(n); digits += d; app.sound.dialTone(false); line = 'dialing';
    if (digits === '0') { setTimeout(() => { if (digits === '0' && line === 'dialing') answer(BOOK.find(b => b.no === '0')!); }, 900); return; }
    if (digits.length === 4) { line = 'ringing'; ringT = 0; app.sound.ring(true); who = BOOK.find(b => b.no === digits) ?? null; } }
  function answer(b: Listing | null) { app.sound.ring(false); app.sound.once('pickup'); line = 'talk'; who = b; qty = b ? b.items.map(() => 0) : []; ordered = false;
    say(b ? b.hello : digits === MY_NO ? '(통화 중 신호. 자기 집 번호다.)' : '지금 거신 번호는 없는 번호입니다. 번호를 다시 확인해 주십시오.'); }

  // ---------------- drawing ----------------
  function desk() { for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) { const g = Math.sin(y * 0.5 + Math.sin(x * 0.02 + y * 0.05) * 3) + (rnd(y * 977 + (x >> 3)) - 0.5) * 0.6; S.px(x, y, g > 0.75 ? COL.wood3 : g < -0.7 ? COL.wood2 : COL.wood); }
    // a desk lamp's pool of light
    for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) { const l = Math.max(0, 1 - Math.hypot(x - 150, y - 120) / 260); if (l > 0) S.px(x, y, hex('#f0c880'), l * 0.18); } }
  function phone() { const { cx, cy, R } = D, black = hex('#16161a'), black2 = hex('#2a2a30'), hi = hex('#5a5a66');
    // the base: black bakelite, a low dome lit from the lamp up and to the left (a soft highlight, a dark rim)
    for (let y = cy - 92; y < cy + 92; y++) for (let x = cx - 96; x < cx + 96; x++) { const dx = (x - cx) / 96, dy = (y - cy - 6) / 86, e = dx * dx + dy * dy * dy * dy; if (e > 1) continue;
      const lit = Math.max(0, -dx * 0.45 - dy * 0.55) * (1 - e) + (e > 0.86 ? -0.25 : 0), k = Math.max(0, Math.min(3, Math.floor(lit * 5 + 1 + (rnd(((x * 31 + y * 17) >>> 0)) - 0.5) * 0.6)));
      S.px(x, y, [black, black2, hex('#3a3a44'), hi][k]!); }
    // the cradle: two prongs; the handset across them (or lifted off up and to the left, its cord coiling down)
    const up = line !== 'onhook', ox = up ? -44 : 0, oy = up ? -12 : 0;
    for (const px of [cx - 46, cx + 46]) for (let y = cy - 106; y < cy - 84; y++) for (let x = px - 4; x < px + 4; x++) S.px(x, y, x === px - 4 ? hi : x === px + 3 ? black : black2);
    const hcx = cx + ox, hcy = cy - 108 + oy, shade = (yy: number, top: number, bot: number) => (yy - top < 2 ? hi : bot - yy < 2 ? black : black2);
    for (let x = hcx - 58; x <= hcx + 58; x++) { const bow = Math.round(Math.sin((x - hcx + 58) / 116 * Math.PI) * -3), t0 = hcy - 4 + bow, b0 = hcy + 4 + bow; for (let y = t0; y <= b0; y++) S.px(x, y, shade(y, t0, b0)); }   // the grip
    for (const [ex, dir] of [[hcx - 58, -1], [hcx + 58, 1]] as const) for (let j = -9; j <= 12; j++) for (let i = -12; i <= 12; i++) { const d = (i / 12) ** 2 + ((j - 2) / 10) ** 2; if (d > 1) continue; S.px(ex + i + dir * 2, hcy + j, j < -6 ? hi : d > 0.75 ? black : j > 8 ? hex('#0e0e12') : black2); }   // earpiece and mouthpiece cups
    if (up) for (let k = 0; k < 70; k++) S.px(hcx - 56 + Math.sin(k * 0.9) * 3 - k * 0.2, hcy + 12 + k * 1.3, k % 2 ? black : black2);
    // the dial plate (nickel) with its numbers, then the finger wheel with its holes, then the finger stop
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) { const d = Math.hypot(x - cx, y - cy); if (d > R) continue; const a = Math.atan2(y - cy, x - cx); S.px(x, y, d > R - 2 ? hex('#6a6e74') : mix(hex('#c8ccd0'), hex('#8a8e94'), 0.5 + 0.5 * Math.sin(a * 2 + 1))); }
    for (let k = 1; k <= 10; k++) { const a = holeAng(k, 0), x = cx + Math.cos(a) * (D.holeR + 0) - 3, y = cy + Math.sin(a) * D.holeR - 4; S.text(k === 10 ? '0' : String(k), x, y, hex('#1a1a1e')); }
    for (let y = cy - R + 4; y <= cy + R - 4; y++) for (let x = cx - R + 4; x <= cx + R - 4; x++) { const d = Math.hypot(x - cx, y - cy); if (d > R - 4 || d < 30) continue; let hole = false; for (let k = 1; k <= 10; k++) { const a = holeAng(k, rot); if (Math.hypot(x - (cx + Math.cos(a) * D.holeR), y - (cy + Math.sin(a) * D.holeR)) < D.hole) hole = true; }
      if (!hole) { const a = Math.atan2(y - cy, x - cx); S.px(x, y, d > R - 6 ? hex('#3a3a40') : mix(hex('#28282e'), hex('#4a4a54'), 0.5 + 0.5 * Math.sin(a - 0.8))); } }
    for (let y = cy - 30; y <= cy + 30; y++) for (let x = cx - 30; x <= cx + 30; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= 30) S.px(x, y, d > 28 ? hex('#8a8e94') : hex('#efe8d4')); }   // the number card in the middle
    S.text('밀브룩', cx - 15, cy - 14, hex('#3a3430')); S.text(MY_NO, cx - 10, cy - 2, hex('#7a2a22')); S.text('교환 0', cx - 14, cy + 10, hex('#6a5e50'));
    const sa = STOP + 0.12; for (let k = 0; k < 14; k++) { const x = cx + Math.cos(sa) * (R - 12 + k), y = cy + Math.sin(sa) * (R - 12 + k); S.px(x, y, hex('#d8dce0')); S.px(x + 1, y, hex('#8a8e94')); }   // the finger stop
    // a finger in the hole while dialling
    if (grab) { const a = holeAng(grab.hole, rot), x = cx + Math.cos(a) * D.holeR, y = cy + Math.sin(a) * D.holeR; for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) if (i * i + j * j < 30) S.px(x + i, y + j, hex('#e2b48e')); for (let i = -4; i <= 4; i++) S.px(x + i, y - 5, hex('#f0d4c0')); } }
  function book(): Rect { const r: Rect = { x: 254, y: 30, w: 218, h: 200 };
    // the open directory: a cream page with a ruled header
    S.fill(r.x + 3, r.y + 3, r.w, r.h, COL.shadow); for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) S.px(x, y, vn(x / 20, y / 20, 5) > 0.7 ? hex('#e6dcc0') : hex('#efe6cc'));
    S.text('밀브룩 전화번호부 1930', r.x + 8, r.y + 4, COL.ink); S.hline(r.x + 6, r.x + r.w - 6, r.y + 14, COL.ink); S.hline(r.x + 6, r.x + r.w - 6, r.y + 16, COL.inkSoft);
    const list = BOOK.filter(b => b.tab === TABS[tab]); let y = r.y + 22;
    list.forEach((b, k) => { const row = { x: r.x + 4, y, w: r.w - 8, h: 26 };
      if (ui.button('l-' + k, { x: row.x + row.w - 46, y: row.y + 4, w: 42, h: 12 }, '적어 둠')) { noted = `${b.no} ${b.name}`; app.sound.once('paper'); }
      ui.label({ x: row.x + 4, y: row.y + 2, w: 120, h: 9 }, b.name, COL.ink); ui.label({ x: row.x + 124, y: row.y + 2, w: 40, h: 9 }, b.no, hex('#7a2a22'), 'r'); ui.label({ x: row.x + 4, y: row.y + 12, w: row.w - 56, h: 9 }, b.line, COL.inkSoft);
      for (let x = row.x + 4; x < row.x + row.w - 4; x += 2) S.px(x, row.y + row.h - 2, COL.card2); y += 28; });
    return r; }
  function talk(dt: number) { if (line !== 'talk') return; const r: Rect = { x: 254, y: 30, w: 218, h: 200 }; ui.panel(r, 'card');
    ui.label({ x: r.x + 8, y: r.y + 5, w: r.w - 16, h: 9 }, who ? `통화 중: ${who.name}` : '통화 중', COL.ink); S.hline(r.x + 6, r.x + r.w - 6, r.y + 16, COL.card2);
    if (shown < said.length) { talkT += dt; while (talkT > 0.035 && shown < said.length) { talkT -= 0.035; shown++; if (shown % 3 === 0) app.sound.once('blip', { pitch: who?.no === '0' ? 1.5 : 1.15 }); } }
    ui.paragraph({ x: r.x + 8, y: r.y + 20, w: r.w - 16, h: 30 }, said.slice(0, shown), COL.ink, 10);
    if (!who || shown < said.length) return;
    if (who.no === '0') { // the operator connects you, long distance too
      BOOK.filter(b => b.no !== '0').slice(0, 7).forEach((b, k) => { if (ui.button('op-' + k, { x: r.x + 8, y: r.y + 56 + k * 17, w: r.w - 16, h: 14 }, `${b.name}${b.far ? ' (장거리)' : ''}`)) { app.sound.once('tick'); digits = b.no; line = 'ringing'; ringT = 0; app.sound.ring(true); who = b; } }); return; }
    if (ordered) return;
    let total = 0; who.items.forEach((it, k) => { const y = r.y + 56 + k * 17, [a, b2, c] = split({ x: r.x + 8, y, w: r.w - 16, h: 14 }, ['*', 34, 52], 4); ui.label({ ...a!, y: y + 3, h: 9 }, it.name, COL.ink); ui.label({ ...b2!, y: y + 3, h: 9 }, `$${it.price.toFixed(2)}`, COL.inkSoft, 'r');
      const v = ui.stepper('qty' + k, c!, qty[k]!, { min: 0, max: 9, step: 1 }, n => `${n}`); if (v !== null) qty[k] = v; total += qty[k]! * it.price; });
    const [lt, ob] = split({ x: r.x + 8, y: r.y + r.h - 20, w: r.w - 16, h: 14 }, ['*', 70], 4); ui.label({ ...lt!, y: lt!.y + 3, h: 9 }, `합계 $${total.toFixed(2)} (받을 때 냄)`, COL.ink);
    if (ui.button('order', ob!, '주문한다', { disabled: total <= 0 && !who.items.some(i => i.price === 0) })) { who.items.forEach((it, k) => { const n = qty[k]! || (it.price === 0 ? 1 : 0); if (!n) return; P.orders.push({ item: it.name, qty: n, from: who!.name, price: it.price * n }); if (it.give) P[it.give] += n; }); spent += total; pantry(P); ordered = true;
      say(who.far ? '알겠습니다. 우편으로 사흘쯤 걸립니다.' : '알겠습니다. 내일 오전에 배달해 드리지요. 값은 받으실 때 주십시오.'); } }

  return { id: 'phone',
    frame(_a, dt) { t += dt; desk();
      // the wheel: grabbed by a hole and turned clockwise up to the stop; let go, it runs home at ten clicks a second
      const p = ui.pointer(), a = Math.atan2(p.y - D.cy, p.x - D.cx), dc = Math.hypot(p.x - D.cx, p.y - D.cy);
      if (grab && p.down) { let d = a - grab.last; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; grab.last = a; const before = Math.floor(rot / STEP); rot = Math.max(0, Math.min(grab.max, rot + d)); if (Math.floor(rot / STEP) > before) app.sound.once('tick'); }
      else if (grab && !p.down) { const n = Math.max(0, Math.round(rot / STEP) - 1); if (n > 0) app.sound.once('pulses', { n: Math.min(10, n) }); returning = rot; grab = null; dialled(Math.min(10, n)); }
      else if (!grab && returning > 0) { rot = Math.max(0, rot - dt * STEP * 10); if (rot === 0) returning = 0; }
      else if (!grab && p.down && returning === 0 && (line === 'tone' || line === 'dialing') && dc > D.holeR - D.hole && dc < D.holeR + D.hole && !ui.tookClick) {
        for (let k = 1; k <= 10; k++) { const ha = holeAng(k, 0); if (Math.hypot(p.x - (D.cx + Math.cos(ha) * D.holeR), p.y - (D.cy + Math.sin(ha) * D.holeR)) < D.hole) { grab = { hole: k, a0: a, max: (k + 1) * STEP, last: a }; break; } } }
      if (line === 'ringing') { ringT += dt; if (ringT > (who ? 4.5 : 8.5)) answer(who); }
      phone(); book(); talk(dt);
      // the handset: lift or hang up
      const hs: Rect = line === 'onhook' ? { x: D.cx - 70, y: D.cy - 108, w: 140, h: 20 } : { x: D.cx - 104, y: D.cy - 136, w: 140, h: 20 };
      if (ui.button('handset', { x: 8, y: 8, w: 96, h: 14 }, line === 'onhook' ? '수화기를 든다' : '수화기를 놓는다')) { if (line === 'onhook') lift(); else hangUp(); } void hs;
      // what you dialled, the number you noted, the tabs of the book
      const slip: Rect = { x: 112, y: 8, w: 134, h: 14 }; S.fill(slip.x, slip.y, slip.w, slip.h, hex('#efe6cc')); ui.label({ x: slip.x + 4, y: slip.y + 3, w: slip.w - 8, h: 9 }, `돌린 번호: ${(digits + '____').slice(0, 4).split('').join(' ')}`, COL.ink);
      const lineText = { onhook: '수화기가 걸려 있다', tone: '발신음 · 번호를 돌린다', dialing: '번호를 돌리는 중', ringing: '신호가 간다…', talk: '통화 중' }[line]; ui.label({ x: 8, y: 248, w: 230, h: 9 }, lineText, COL.cream);
      ui.label({ x: 8, y: 258, w: 240, h: 9 }, noted ? `적어 둔 번호: ${noted}` : '번호부에서 "적어 둠"을 누르면 여기 적힌다', COL.card2);
      const tb = split({ x: 254, y: 12, w: 218, h: 14 }, TABS.map(() => '*' as const), 2); TABS.forEach((tn, k) => { if (ui.tab('tab' + k, tb[k]!, tn, tab === k, 30)) { tab = k; app.sound.once('paper'); } });
      ui.label({ x: 254, y: 238, w: 218, h: 9 }, `차 ${P.tea} · 커피 ${P.coffee} · 주문 ${P.orders.length}건 (이번에 $${spent.toFixed(2)})`, COL.cream, 'r');
      ui.label({ x: 254, y: 252, w: 218, h: 9 }, '견본: 주문은 바로 들어온다 (게임에서는 배달차가 온다)', COL.card2, 'r');
    },
    leave() { hangUp(); } };
}
