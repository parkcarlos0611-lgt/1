// The founder's desk in pixels (roadmap step 5, first part): the day, the money, what waits for an answer, the designs
// and the orders. An inquiry can be talked through, drawn on the drawing board, quoted or turned down here; the rest of
// the work (suppliers, the week's plan, the books) is still on the HTML desk, which reads the same save.
import type { App, Scene } from '../shell/app';
import { split, rows, pad, COL, rnd, type Rect } from '../pixel/kit';
import { addDays, parts, weekday, type DateStr } from '../../core/calendar';
import { DATA, newWorld, openWorld } from '../../core/world';
import { load } from '../../core/state';
import { store } from '../shell/app';
import { fullName, type Person } from '../../core/people';
import type { Incident } from '../../core/state';
import { drawingScene, standardAsks, lightsName } from './drawing';
import type { Edit } from '../drawing/lines';
import type { Era } from '../drawing/rules';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const KIND: Record<string, string> = { inquiry: '문의', quote_answer: '견적 답장', supplier_quote: '공급사 견적', parts_delivered: '납품 도착', delivery_delayed: '납품 지연', stock_short: '자재 부족',
  design_finalized: '설계 완료', build_step_done: '공정 끝', car_built: '차 완성', paint_held: '도장 멈춤', customer_letter: '손님 편지', order_placed: '주문', loan_due: '대출 상환' };
const BODY: Record<string, string> = { sedan: '4인승 세단', coupe: '쿠페', limousine: '리무진', town_car: '타운카', pickup: '짐칸 트럭', delivery: '배달차', roadster: '2인승 로드스터', cabriolet: '카브리올레' };
const ORDER: Record<string, string> = { body_only: '차체만 (손님 섀시)', bought: '사 온 섀시에 차체', built: '섀시까지 직접' };
const MUST: Record<string, string> = { closed_roof: '닫힌 지붕', folding_top: '접이식 지붕', dark_colour: '짙은 색', two_tone: '투톤 도장', four_seats: '네 사람 자리', big_boot: '큰 짐칸', high_clearance: '높은 지상고', quiet: '조용한 차', fast: '빠른 차', sidemount_spare: '옆 스페어' };
const SKY: Record<string, string> = { clear: '맑음', rain: '비', snow: '눈' };
const STD = [['std_body', 'body_only', '표준 세단 차체'], ['std_bought', 'bought', '표준 세단 (사 온 섀시)'], ['std_built', 'built', '표준 세단 (자체 섀시)']] as const;
export const money = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const dateKo = (d: DateStr) => { const p = parts(d); return `${p.year}년 ${p.month}월 ${p.day}일 (${WD[weekday(d)]})`; };
const daysBetween = (a: DateStr, b: DateStr) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
/** the era the drawing board's table uses for a date */
const eraOf = (d: DateStr): Era => (d < '1934-01-01' ? '1920s' : d < '1938-01-01' ? '1930s' : 'late30s');

/** a new game the way the HTML desk starts one (the same standard designs, the first customer) */
export function startGame(app: App, background: string, age: number) {
  const W = newWorld(1 + Math.floor(Date.now() % 100000), { background, age, given: 'Walter', family: 'Hoffman' }); app.world = W;
  for (const [id, t, name] of STD) if (!W.sim.g.shop.designs[id]) W.shop.addDesign({ id, name, baseCar: 'sedan30', orderType: t, size: 1, effort: { proportion: 0, parts: 0, panels: 0 } });
  W.supply.directory(); W.sales.firstCustomer(); app.save();
}
export function ensureStd(app: App) { const W = app.world!; for (const [id, t, name] of STD) if (!W.sim.g.shop.designs[id]) W.shop.addDesign({ id, name, baseCar: 'sedan30', orderType: t, size: 1, effort: { proportion: 0, parts: 0, panels: 0 } }); }

export function deskScene(app: App, o: { htmlDesk: boolean }): Scene {
  const ui = app.ui, S = app.S; let tab: 'todo' | 'designs' | 'orders' = 'todo', sel = 0;
  const q = { price: 0, days: 0, dep: 1, design: '', for: -1 };                           // the quote being written
  const W = () => app.world!, g = () => W().sim.g;
  const waiting = () => g().incidents.filter(i => i.state === 'open' && i.grade === 'decision');
  const notices = () => g().incidents.filter(i => i.grade === 'notice' && !(i.payload as { seen?: boolean }).seen).slice(-12);
  const todo = (): Incident[] => [...waiting(), ...notices().reverse()];
  const attempt = (f: () => void) => { try { f(); app.save(); } catch (e) { app.toast(String((e as Error).message)); } };
  const settle = (it: Incident, choice = 'done') => { if (it.state === 'open') W().sim.resolve(it.id, choice); (it.payload as { seen?: boolean }).seen = true; };

  function wood() { for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const v = Math.sin(y * 0.55 + Math.sin(x * 0.02 + y * 0.05) * 3) + (rnd(y * 977 + (x >> 3)) - 0.5) * 0.6; S.px(x, y, v > 0.75 ? COL.wood3 : v < -0.7 ? COL.wood2 : COL.wood); } }
  function header() { const G = g(), r = { x: 4, y: 4, w: 472, h: 20 }; ui.panel(r, 'enamel'); const [a, b, c] = split(pad(r, 8, 6), [110, '*', 90], 4);
    ui.label(a!, '밀브룩 · 공방', COL.cream); ui.label(b!, `${dateKo(G.clock.date)} · ${SKY[G.weather?.today ?? 'clear'] ?? ''}`, COL.cream, 'c'); ui.label(c!, money(G.ledger.cash), hexCash(G.ledger.cash), 'r'); }
  const hexCash = (n: number) => (n < 0 ? COL.red2 : COL.cream);

  // ---- the left column: what waits, the designs, the orders ----
  function left(): { kind: 'inc'; it: Incident } | { kind: 'design'; id: string } | { kind: 'order'; id: number } | null {
    const t = split({ x: 6, y: 28, w: 164, h: 13 }, ['*', '*', '*'], 2), nWait = waiting().length;
    if (ui.tab('t-todo', t[0]!, nWait ? `할 일 ${nWait}` : '할 일', tab === 'todo', 43)) { tab = 'todo'; sel = 0; }
    if (ui.tab('t-designs', t[1]!, '설계', tab === 'designs', 43)) { tab = 'designs'; sel = 0; }
    if (ui.tab('t-orders', t[2]!, '주문', tab === 'orders', 43)) { tab = 'orders'; sel = 0; }
    const box: Rect = { x: 6, y: 44, w: 164, h: 198 }; ui.panel({ ...box, h: box.h }, 'card');
    if (tab === 'todo') { const list = todo(), i = ui.list('todo', box, list.map(it => ({ text: KIND[it.kind] ?? it.kind, sub: summary(it), mark: it.grade === 'decision' ? COL.red : COL.inkSoft })), sel, 20);
      if (i >= 0) sel = i; if (!list.length) ui.label({ x: 12, y: 50, w: 150, h: 10 }, '답할 일이 없다', COL.inkSoft); sel = Math.min(sel, Math.max(0, list.length - 1)); return list[sel] ? { kind: 'inc', it: list[sel]! } : null; }
    if (tab === 'designs') { const ds = Object.values(g().shop.designs).filter(d => !d.id.startsWith('std_') || true), i = ui.list('designs', box, ds.map(d => ({ text: d.name, sub: d.state === 'ready' ? '완성' : `설계 중 ${designHours(d.id)}` })), sel, 20);
      if (i >= 0) sel = i; return ds[sel] ? { kind: 'design', id: ds[sel]!.id } : null; }
    const os = g().market.orders, i = ui.list('orders', box, os.map(x => ({ text: `${custName(x.customerId)} · ${money(x.price)}`, sub: `${x.state === 'building' ? '만드는 중' : x.state === 'delivered' ? '넘겨줌' : '취소'} · ${x.due} 까지` })), sel, 20);
    if (i >= 0) sel = i; if (!os.length) ui.label({ x: 12, y: 50, w: 150, h: 10 }, '아직 주문이 없다', COL.inkSoft); return os[sel] ? { kind: 'order', id: os[sel]!.id } : null; }
  const custName = (id: number) => { const c = g().market.customers[id]; const p = c ? g().people[c.personId] : undefined; return p ? fullName(p as Person) : `손님 ${id}`; };
  const designHours = (id: string) => { const t = g().tasks['design:' + id]; return t ? `${Math.round(t.hoursDone)}/${Math.round(t.hoursNeeded)}시간` : ''; };
  function summary(it: Incident): string { const P = it.payload as Record<string, unknown>; return String(P.customer ?? P.supplier ?? (P.designId ? g().shop.designs[P.designId as string]?.name : '') ?? '').slice(0, 40); }

  // ---- the right card ----
  const CARD: Rect = { x: 176, y: 28, w: 298, h: 214 };
  function inquiryCard(it: Incident) { const W0 = W(), P = it.payload as { inquiryId: number }, qn = W0.sales.inquiry(P.inquiryId), v = W0.sales.view(qn.id), G = g(), x = CARD.x + 8, w = CARD.w - 16;
    ui.label({ x, y: CARD.y + 4, w, h: 10 }, `문의 · ${v.name} · ${BODY[v.body] ?? v.body}`, COL.ink); S.hline(x, x + w, CARD.y + 15, COL.card2);
    ui.paragraph({ x, y: CARD.y + 19, w, h: 50 }, v.letter, COL.inkSoft, 10);
    const facts: [string, string][] = [['원하는 차', `${BODY[v.body] ?? v.body} · ${ORDER[v.orderType]}`], ['받고 싶은 날', `${dateKo(v.wantBy)} (${daysBetween(G.clock.date, v.wantBy)}일 뒤)`],
      ['예산', v.budget ? `${money(v.budget[0])} ~ ${money(v.budget[1])}` : '아직 모른다'], ['꼭 원하는 것', v.mustHave ? (v.mustHave.map(m => MUST[m] ?? m).join(', ') || '없다') : '아직 모른다']];
    facts.forEach(([a, b], i) => { ui.label({ x, y: CARD.y + 72 + i * 10, w: 62, h: 9 }, a, COL.inkSoft); ui.label({ x: x + 64, y: CARD.y + 72 + i * 10, w: w - 64, h: 9 }, b, COL.ink); });
    if (qn.state !== 'open' || it.state !== 'open') { ui.label({ x, y: CARD.y + 116, w, h: 10 }, qn.state === 'quoted' ? '견적을 보냈다. 답을 기다린다.' : qn.state === 'ordered' ? '주문이 되었다.' : '끝난 문의다.', COL.ok);
      if (ui.button('seen', { x, y: CARD.y + CARD.h - 20, w: 70, h: 16 }, '치우기')) settle(it); return; }
    const left = DATA.sales.maxConsults + qn.rounds - (qn.consults ?? 0), noMore = !!(v.budget && v.mustHave) || left <= 0;
    const mine = Object.values(G.shop.designs).filter(d => d.drawing?.inquiryId === qn.id), [b1, b2] = split({ x, y: CARD.y + 114, w, h: 16 }, ['*', '*'], 4);
    if (ui.button('consult', b1!, noMore ? '더 물을 것 없음' : `상담 (1.5시간, ${left}번)`, { disabled: noMore })) attempt(() => { const before = W0.sales.view(qn.id), after = W0.sales.view(W0.sales.consult(qn.id).id); app.toast(after.budget && !before.budget || after.mustHave && !before.mustHave ? '이야기하다 보니 사정을 조금 더 알게 되었다.' : '이번에는 새로 알아낸 것이 없다.'); });
    if (ui.button('draw', b2!, mine.length ? '도면 다시 그리기' : '도면 그리기', { disabled: !['sedan', 'coupe'].includes(v.body) })) openDrawing(qn.id, mine[mine.length - 1]?.drawing?.edit as Edit | undefined);
    // the quote
    if (q.for !== qn.id) { const def = mine[mine.length - 1]?.id ?? STD.find(d => d[1] === v.orderType)![0], d = G.shop.designs[def]!, hours = W0.shop.buildHours(d);
      Object.assign(q, { for: qn.id, design: def, price: Math.round((v.budget ? v.budget[1] * 0.96 : 900) / 5) * 5, days: Math.ceil(hours / 10 * 7 / 6 * 1.3) + 16, dep: 1 }); }
    const designs = [...mine.map(d => d.id), STD.find(d => d[1] === v.orderType)![0]], rr = rows({ x, y: CARD.y + 136, w, h: 12 }, 4, 12, 2), DEP = [0.25, 0.4, 0.5];
    const line = (r: Rect, label: string) => { const [a, b] = split(r, [62, '*'], 2); ui.label(a!, label, COL.inkSoft); return b!; };
    let rr0 = line(rr[0]!, '설계'); if (ui.button('q-design', rr0, G.shop.designs[q.design]?.name ?? q.design)) q.design = designs[(designs.indexOf(q.design) + 1) % designs.length]!;
    rr0 = split(line(rr[1]!, '값'), [120, '*'], 4)[0]!; const pv = ui.stepper('q-price', rr0, q.price, { min: 50, max: 20000, step: 25 }, n => money(n)); if (pv !== null) q.price = pv;
    rr0 = split(line(rr[2]!, '넘겨줄 날'), [120, '*'], 4)[0]!; const dv = ui.stepper('q-days', rr0, q.days, { min: 7, max: 365, step: 1 }, n => `${n}일 뒤`); if (dv !== null) q.days = dv;
    ui.label({ x: rr0.x + 124, y: rr0.y, w: 100, h: 12 }, addDays(G.clock.date, q.days), COL.inkSoft);
    rr0 = split(line(rr[3]!, '계약금'), [60, '*'], 4)[0]!; if (ui.button('q-dep', rr0, `${Math.round(DEP[q.dep]! * 100)}%`)) q.dep = (q.dep + 1) % DEP.length;
    const [s1, s2] = split({ x, y: CARD.y + CARD.h - 20, w, h: 16 }, ['*', '*'], 4);
    if (ui.button('send', s1!, '견적 보내기')) attempt(() => { W0.sales.quote(qn.id, { designId: q.design, price: q.price, due: addDays(G.clock.date, q.days), depositRate: DEP[q.dep]!, meets: v.mustHave ?? [] }); settle(it, 'quote'); q.for = -1; app.toast('견적을 보냈다.'); });
    if (ui.button('drop', s2!, '정중히 거절')) attempt(() => { W0.sales.drop(qn.id); settle(it, 'drop'); q.for = -1; }); }
  function otherCard(it: Incident) { const x = CARD.x + 8, w = CARD.w - 16, P = it.payload as Record<string, unknown>;
    ui.label({ x, y: CARD.y + 4, w, h: 10 }, `${KIND[it.kind] ?? it.kind} · ${dateKo(it.date)}`, COL.ink); S.hline(x, x + w, CARD.y + 15, COL.card2);
    const lines = Object.entries(P).filter(([k, v]) => k !== 'seen' && (typeof v === 'string' || typeof v === 'number')).slice(0, 8).map(([k, v]) => `${k}: ${v}`);
    ui.paragraph({ x, y: CARD.y + 20, w, h: 100 }, (typeof P.text === 'string' ? P.text + '\n' : '') + lines.join('\n'), COL.inkSoft);
    if (it.grade === 'decision' && it.state === 'open') ui.paragraph({ x, y: CARD.y + 130, w, h: 40 }, o.htmlDesk ? '이 일은 아직 HTML 책상에서 처리한다 (같은 저장).' : '이 일의 픽셀 화면은 아직 없다. 넘기면 받아들이지 않은 것으로 친다.', COL.red);
    const [b1, b2] = split({ x, y: CARD.y + CARD.h - 20, w, h: 16 }, ['*', '*'], 4);
    if (ui.button('seen', b1!, it.state === 'open' && it.grade === 'decision' ? '넘기기' : '치우기')) attempt(() => settle(it, 'pass'));
    if (o.htmlDesk && ui.button('html', b2!, 'HTML 책상 열기')) { app.save(); location.href = 'desk.html'; } }
  function designCard(id: string) { const d = g().shop.designs[id]!, x = CARD.x + 8, w = CARD.w - 16;
    ui.label({ x, y: CARD.y + 4, w, h: 10 }, d.name, COL.ink); S.hline(x, x + w, CARD.y + 15, COL.card2);
    const e = d.drawing?.edit as Edit | undefined, info: [string, string][] = [['상태', d.state === 'ready' ? '완성' : `설계 중 ${designHours(id)}`], ['방식', ORDER[d.orderType] ?? d.orderType], ['만든 수', `${d.built}대`],
      ['도면', e ? `세단 ${lightsName(e.lights)} · 전장 ${d.drawing?.length} · 전고 ${d.drawing?.height}` : '표준 설계 (도면 없음)'], ['손댄 정도', `비례 ${Math.round(d.effort.proportion * 100)}% · 부품 ${d.effort.parts} · 판금 ${d.effort.panels}`]];
    info.forEach(([a, b], i) => { ui.label({ x, y: CARD.y + 20 + i * 11, w: 56, h: 10 }, a, COL.inkSoft); ui.label({ x: x + 58, y: CARD.y + 20 + i * 11, w: w - 58, h: 10 }, b, COL.ink); });
    if (e && ui.button('view', { x, y: CARD.y + CARD.h - 20, w: 90, h: 16 }, '도면 보기')) openDrawing(d.drawing?.inquiryId ?? -1, e, true); }
  function orderCard(id: number) { const G = g(), od = G.market.orders.find(x => x.id === id)!, x = CARD.x + 8, w = CARD.w - 16, b = G.shop.builds.find(x2 => x2.orderId === id);
    ui.label({ x, y: CARD.y + 4, w, h: 10 }, `주문 · ${custName(od.customerId)}`, COL.ink); S.hline(x, x + w, CARD.y + 15, COL.card2);
    const done = b ? b.steps.filter(s => s.quality != null).length : 0, info: [string, string][] = [['값', `${money(od.price)} (계약금 ${money(od.deposit)})`], ['넘겨줄 날', dateKo(od.due)], ['설계', G.shop.designs[od.designId]?.name ?? od.designId], ['제작', b ? `${done}/${b.steps.length} 공정` : '아직 시작 안 함']];
    info.forEach(([a, c], i) => { ui.label({ x, y: CARD.y + 20 + i * 11, w: 56, h: 10 }, a, COL.inkSoft); ui.label({ x: x + 58, y: CARD.y + 20 + i * 11, w: w - 58, h: 10 }, c, COL.ink); });
    if (o.htmlDesk && ui.button('html', { x, y: CARD.y + CARD.h - 20, w: 110, h: 16 }, 'HTML 책상 열기')) { app.save(); location.href = 'desk.html'; } }

  /** the drawing board for an inquiry; the finished drawing becomes a design in the shop */
  function openDrawing(inquiryId: number, start?: Edit, look = false) { const G = g(), W0 = W(), v = inquiryId >= 0 ? W0.sales.view(inquiryId) : null;
    const asks = v ? standardAsks({ body: v.body, mustHave: v.mustHave, budget: v.budget, daysLeft: daysBetween(G.clock.date, v.wantBy) }) : standardAsks({ body: 'sedan' });
    const size = Math.min(3, G.employees.length >= 12 ? 2 : G.employees.length >= 4 ? 1 : 0);   // the company's size picks the sheet
    app.push(drawingScene(app, { from: v ? `${v.name} 씨의 주문` : '도면 보기', asks, era: eraOf(G.clock.date), size, start, back: () => app.pop(),
      done: look ? undefined : ({ edit, fig }) => attempt(() => { const n = Object.keys(G.shop.designs).length + 1, id = `drw${n}`;
        const proportion = Math.min(1, (Math.abs(edit.wb) / 400 + Math.abs(edit.door) / 280 + Math.abs(edit.roof) / 200 + Math.abs(edit.lift) / 100) / 2);
        const partsN = +!edit.bumperF + +!edit.bumperR + +!edit.fenders + +edit.rack + +(edit.lights !== 6), panels = +!!edit.grille + +!!edit.fender + +!!(edit.lampX || edit.lampZ) + +(edit.lights !== 6) + +!!edit.grilleX;
        const d = W0.shop.startDesign({ id, name: `${v?.name ?? ''} 씨 세단 (${lightsName(edit.lights)})`, baseCar: 'sedan29', orderType: v?.orderType ?? 'body_only', size: Math.round(fig.length * fig.height / (3885 * 1818) * 100) / 100, effort: { proportion, parts: partsN, panels } });
        d.drawing = { edit: { ...edit }, inquiryId: inquiryId >= 0 ? inquiryId : undefined, length: fig.length, height: fig.height };
        q.for = -1; app.pop(); tab = 'todo'; app.toast(`설계를 시작했다: ${W0.shop.designHours(d)}시간`); }) })); }

  function bottom() { const [a, b, c, d] = split({ x: 6, y: 248, w: 468, h: 18 }, [90, 110, '*', o.htmlDesk ? 100 : 0], 4), wait = waiting().length;
    if (ui.button('day', a!, '하루 보내기', { disabled: wait > 0 })) attempt(() => { const r = W().sim.stepDay(); if (r.stops.length) { tab = 'todo'; sel = 0; app.toast(`${KIND[r.stops[0]!.kind] ?? r.stops[0]!.kind}: 답할 일이 생겼다`); } });
    if (ui.button('run', b!, '일이 생길 때까지', { disabled: wait > 0 })) attempt(() => { const r = W().sim.runUntilStop(60), last = r[r.length - 1]; tab = 'todo'; sel = 0; app.toast(last?.stops.length ? `${r.length}일 지났다. ${KIND[last.stops[0]!.kind] ?? ''}` : `${r.length}일 지났다`); });
    ui.label(c!, wait ? '답할 일이 있어 날이 가지 않는다' : '', COL.cream);
    if (o.htmlDesk && ui.button('html-desk', d!, 'HTML 책상')) { app.save(); location.href = 'desk.html'; } }

  return { id: 'desk', enter() { ensureStd(app); },
    frame() { wood(); header(); const s = left(); ui.panel(CARD, 'card');
      if (!s) ui.label({ x: CARD.x + 8, y: CARD.y + 8, w: CARD.w - 16, h: 10 }, '왼쪽에서 고른다', COL.inkSoft);
      else if (s.kind === 'inc') (s.it.kind === 'inquiry' ? inquiryCard : otherCard)(s.it); else if (s.kind === 'design') designCard(s.id); else orderCard(s.id);
      bottom(); } };
}

/** the opening: start a new shop or carry on */
export function titleScene(app: App, o: { htmlDesk: boolean }): Scene { const ui = app.ui, S = app.S, BGS = Object.keys(DATA.people.founderBackgrounds); let bg = Math.max(0, BGS.indexOf('coachbuilder')), age = 31;
  const NAMES: Record<string, string> = { coachbuilder: '차체 장인', mechanic: '정비공', racer: '경주 선수', merchant: '상인', engineer: '기술자' };
  return { id: 'title', frame() { for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const v = Math.sin(y * 0.55 + Math.sin(x * 0.02 + y * 0.05) * 3) + (rnd(y * 977 + (x >> 3)) - 0.5) * 0.6; S.px(x, y, v > 0.75 ? COL.wood3 : v < -0.7 ? COL.wood2 : COL.wood); }
    const plate = { x: 120, y: 40, w: 240, h: 44 }; ui.panel(plate, 'enamel'); ui.label({ x: 130, y: 50, w: 220, h: 12 }, 'G E A R H O U S E', COL.cream, 'c'); ui.label({ x: 130, y: 64, w: 220, h: 10 }, '1930년 1월, 밀브룩의 작은 공방', BRASS4(), 'c');
    const card = { x: 140, y: 100, w: 200, h: 120 }; ui.panel(card, 'card'); const r = rows(pad(card, 10, 8), 5, 16, 6);
    const [l0, c0] = split(r[0]!, [50, '*'], 4); ui.label(l0!, '출신', COL.inkSoft); if (ui.button('bg', c0!, `${NAMES[BGS[bg]!] ?? BGS[bg]} · ${money(DATA.people.founderBackgrounds[BGS[bg]!]!.cash)}`)) bg = (bg + 1) % BGS.length;
    const [l1, c1] = split(r[1]!, [50, 90], 4); ui.label(l1!, '나이', COL.inkSoft); const a = ui.stepper('age', c1!, age, { min: 22, max: 45, step: 1 }, n => `${n}세`); if (a !== null) age = a;
    if (ui.button('new', r[3]!, '새로 시작')) { startGame(app, BGS[bg]!, age); app.replace(deskScene(app, o)); }
    const has = (() => { try { return !!localStorage.getItem('gearhouse.slice.save'); } catch { return false; } })();
    if (has && ui.button('cont', r[4]!, '이어서 하기')) { try { app.world = openWorld(load(store.get()!)); app.replace(deskScene(app, o)); } catch (e) { app.toast('저장을 읽지 못했다: ' + (e as Error).message); } } } }; }
const BRASS4 = () => [228, 196, 122] as [number, number, number];
