// Screens, first round (plan 12, step 2): the desk. Calendar, clock and weather; the pile of newspapers; the tray of
// letters and papers that wait for an answer; the work plan. Placement and handling only - the pictures come later.
// Everything shown is read from the game state; everything done goes through the systems' own methods.
import { DATA, newWorld, openWorld, type World } from '../core/world';
import { load, save, type Incident, type Task } from '../core/state';
import { addDays, daysBetween, parts, weekday } from '../core/calendar';
import { fullName } from '../core/people';
import { statement } from '../core/ledger';

const KEY = 'gearhouse.slice.save';
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const PART: Record<string, string> = { body_steel_set: '차체 강판', chassis_steel_set: '섀시 철강', ash_frame_set: '물푸레나무', glass_set: '판유리', paint_set: '도료', trim_set: '가죽·내장재', wheels_tyres_set: '바퀴·타이어', fittings_set: '부속품', engine: '엔진', gearbox: '변속기', axles_set: '차축', rolling_chassis: '굴러가는 섀시' };
const STEP: Record<string, string> = { mockup: '목형', chassis: '섀시', power: '동력계', frame: '목골조', panels: '판금', joining: '접합', paint: '도장', trim: '내장', fittings: '부속', final: '마무리', consultation: '고객 상담', tender: '입찰 서류', show: '품평회 출품', auction: '경매 참석' };
const BG: Record<string, string> = { coachbuilder: '차체 장인', mechanic: '정비공', racer: '경주 선수', merchant: '상인', engineer: '기술자' };
const ORDER: Record<string, string> = { body_only: '차체만 (손님 섀시)', bought: '사 온 섀시에 차체', built: '섀시까지 직접' };
const BODY: Record<string, string> = { sedan: '4인승 세단', coupe: '쿠페', limousine: '리무진', town_car: '타운카', pickup: '짐칸 트럭', delivery: '배달차', roadster: '2인승 로드스터', cabriolet: '카브리올레' };
const MUST: Record<string, string> = { closed_roof: '닫힌 지붕', folding_top: '접이식 지붕', dark_colour: '짙은 색', two_tone: '투톤 도장', four_seats: '네 사람 자리', big_boot: '큰 짐칸', high_clearance: '높은 지상고', quiet: '조용한 실내', fast: '빠른 속도', sidemount_spare: '옆에 다는 예비 바퀴' };
const SKY: Record<string, string> = { clear: '맑음', rain: '비', snow: '눈' };
const SPELL: Record<string, string> = { cold_wave: '한파', blizzard: '폭설', long_rain: '긴 비', heat_wave: '폭염', drought: '가뭄', fine_autumn: '맑은 가을' };
const KIND: Record<string, string> = { inquiry: '문의', quote_answer: '견적 답장', supplier_quote: '공급사 견적', parts_delivered: '납품 도착', delivery_delayed: '납품 지연', stock_short: '자재 부족', build_step_done: '공정 끝', car_built: '차 완성', newspaper: '신문 도착',
  month_closed: '달 마감', cash_warning: '현금 경고', customer_cannot_pay: '잔금 미납', order_late: '납기 지남', car_broke_down: '판 차 고장', paint_held: '비로 도장 멈춤', tender_result: '입찰 결과', show_result: '품평회 결과', auction_result: '경매 결과', wage_missed: '급여 밀림', design_finalized: '설계 완료', supplier_no_stock: '물건 없음' };
const DESIGNS = [['std_body', 'body_only', '표준 세단 차체'], ['std_bought', 'bought', '표준 세단 (사 온 섀시)'], ['std_built', 'built', '표준 세단 (자체 섀시)']] as const;

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const money = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const dateKo = (d: string) => { const p = parts(d); return `${p.year}년 ${p.month}월 ${p.day}일 (${WD[weekday(d)]})`; };
const short = (d: string) => { const p = parts(d); return `${p.month}/${p.day}`; };

let w: World | null = null, tab: 'tray' | 'papers' | 'plan' | 'book' = 'tray', speed = 0, dayPart = 0, lastTick = 0, openIssue: number | null = null, openItem: number | null = null, toastT = 0;
const store = { get: () => { try { return localStorage.getItem(KEY); } catch { return null; } }, set: (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* private window */ } }, clear: () => { try { localStorage.removeItem(KEY); } catch { /* same */ } } };
const g = () => w!.sim.g;
const SAY: [RegExp, string][] = [[/nothing more to ask/, '더 물을 것이 없다.'], [/all they will say/, '손님이 더는 말을 아낀다. 견적을 보낼 때다.'], [/not open for talks/, '지금은 상담할 수 없다.'], [/already asked/, '이미 한 번 청했다.'], [/will not haggle/, '손님이 더는 흥정하지 않는다.'], [/no more haggling/, '더는 흥정할 수 없다.'],
  [/not known yet/, '아직 모르는 가게다.'], [/no telephone/, '전화가 없다.'], [/drawer is full/, '서랍이 가득 찼다.'], [/owner will not lend/, '주인이 차를 빌려주지 않는다.'], [/no record of working/, '납품 실적이 없어 서류를 받아 주지 않는다.'], [/too late/, '기한이 지났다.'], [/not read/, '그 신문을 읽지 않았다.'], [/design not ready/, '설계가 아직 끝나지 않았다.']];
function toast(text: string) { text = SAY.find(([re]) => re.test(text))?.[1] ?? text; const t = $('#toast'); t.textContent = text; t.classList.add('on'); clearTimeout(toastT); toastT = window.setTimeout(() => t.classList.remove('on'), 2600); }
/** thrown by an action that has already redrawn the screen itself */
class Skip extends Error {}
function attempt(f: () => void) { try { f(); } catch (e) { if (e instanceof Skip) return; toast(String((e as Error).message)); } render(); }

// ---------- start ----------
function startScreen() { const has = !!store.get();
  $('#app').innerHTML = `<div class="start"><h1>GEARHOUSE</h1><p class="sub">1930년 1월 1일, 미국 중서부의 작은 읍 밀브룩. 공방 하나로 시작한다.</p>
    <label>이름 <input id="given" value="Walter" maxlength="14"></label><label>성 <input id="family" value="Hoffman" maxlength="16"></label>
    <label>나이 <input id="age" type="number" min="22" max="45" value="31"></label>
    <label>출신 <select id="bg">${Object.keys(DATA.people.founderBackgrounds).map(k => `<option value="${k}">${BG[k] ?? k} · 밑천 ${money(DATA.people.founderBackgrounds[k]!.cash)}</option>`).join('')}</select></label>
    <div class="row"><button id="new" class="primary">새로 시작</button>${has ? '<button id="cont">이어서 하기</button>' : ''}</div></div>`;
  ($('#bg') as HTMLSelectElement).value = 'coachbuilder';
  $('#new').onclick = () => { const age = Math.max(22, Math.min(45, +($('#age') as HTMLInputElement).value || 31)); w = newWorld(1 + Math.floor(Date.now() % 100000), { background: ($('#bg') as HTMLSelectElement).value, age, given: ($('#given') as HTMLInputElement).value.trim() || 'Walter', family: ($('#family') as HTMLInputElement).value.trim() || 'Hoffman' }); begin(true); };
  if (has) $('#cont').onclick = () => { try { w = openWorld(load(store.get()!)); begin(false); } catch (e) { toast('저장을 읽지 못했다: ' + (e as Error).message); } }; }
function begin(fresh: boolean) { const W = w!; for (const [id, t, name] of DESIGNS) if (!g().shop.designs[id]) W.shop.addDesign({ id, name, baseCar: 'sedan30', orderType: t, size: 1, effort: { proportion: 0, parts: 0, panels: 0 } });
  if (fresh) { W.supply.directory(); W.sales.firstCustomer(); } speed = 0; frame(); render(); requestAnimationFrame(loop); }

// ---------- time ----------
function stepDay(): Incident[] { const r = w!.sim.stepDay(); store.set(save(g())); return r.stops; }
function loop(t: number) { if (!w) return; const dt = Math.min(200, t - (lastTick || t)); lastTick = t;
  if (speed > 0 && !waiting().length) { dayPart += dt / (speed === 9 ? 300 : 8000 / speed); if (dayPart >= 1) { dayPart = 0; const stops = stepDay(); if (stops.length) { speed = 0; tab = 'tray'; openItem = null; } render(); } }
  const bar = document.querySelector<HTMLElement>('#daybar i'); if (bar) bar.style.width = (dayPart * 100).toFixed(1) + '%';
  const clock = document.querySelector('#clock'); if (clock) { const h = 7 + dayPart * 12; clock.textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(h % 1 * 6) * 10).padStart(2, '0')}`; }
  requestAnimationFrame(loop); }
/** what must be answered before the day can go on */
const waiting = () => g().incidents.filter(i => i.state === 'open' && i.grade === 'decision');
const notices = () => g().incidents.filter(i => i.grade === 'notice' && !(i.payload as { seen?: boolean }).seen).slice(-12);

// ---------- frame ----------
function frame() { $('#app').innerHTML = `<header><div class="when"><b id="date"></b><span id="clock">07:00</span><span id="sky"></span></div><div class="cash" id="cash"></div>
    <div class="speed" id="speed"></div><div id="daybar"><i></i></div></header>
    <nav id="tabs"></nav><main id="main"></main><div id="toast" role="status"></div>`; }
function render() { if (!w) return; const G = g(), W = G.weather, wait = waiting();
  $('#date').textContent = dateKo(G.clock.date); $('#sky').textContent = `${SKY[W.today]}${W.event ? ' · ' + SPELL[W.event.kind] : ''}`; $('#sky').className = 'sky ' + W.today;
  $('#cash').textContent = money(G.ledger.cash);
  $('#speed').innerHTML = [[0, '멈춤'], [1, '1배'], [2, '2배'], [3, '3배'], [9, '다음 일까지']].map(([v, l]) => `<button data-v="${v}" class="${speed === v ? 'on' : ''}" ${v && wait.length ? 'disabled' : ''}>${l}</button>`).join('');
  $('#speed').querySelectorAll('button').forEach(b => { b.onclick = () => { speed = +b.dataset.v!; render(); }; });
  const unread = G.media.copies.filter(c => c.place === 'desk' && !c.read).length, nTray = wait.length + notices().length;
  $('#tabs').innerHTML = ([['tray', '서류함', nTray], ['papers', '신문', unread], ['plan', '작업표', 0], ['book', '장부·일지', 0]] as const).map(([id, l, n]) => `<button data-t="${id}" class="${tab === id ? 'on' : ''}">${l}${n ? `<em>${n}</em>` : ''}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b => { b.onclick = () => { tab = b.dataset.t as typeof tab; openIssue = null; openItem = null; render(); }; });
  const m = $('#main'); m.innerHTML = tab === 'tray' ? tray() : tab === 'papers' ? papers() : tab === 'plan' ? plan() : book(); wire(m); }
function wire(root: HTMLElement) { root.querySelectorAll<HTMLElement>('[data-do]').forEach(el => { el.onclick = () => attempt(() => act(el.dataset.do!, el.dataset, root)); }); }

// ---------- the tray: letters and papers that wait ----------
function tray(): string { const wait = waiting(), note = notices();
  if (openItem != null) { const it = g().incidents.find(i => i.id === openItem); if (it) return `<section class="sheet"><button class="back" data-do="closeItem">‹ 서류함</button>${detail(it)}</section>`; }
  const row = (i: Incident, cls: string) => `<li class="${cls}" data-do="openItem" data-id="${i.id}"><b>${KIND[i.kind] ?? i.kind}</b><span>${esc(summary(i))}</span><time>${short(i.date)}${i.deadline && i.state === 'open' ? ` · ${Math.max(0, daysBetween(g().clock.date, i.deadline))}일 남음` : ''}</time></li>`;
  return `<section><h2>답을 기다리는 것 <small>${wait.length}</small></h2>${wait.length ? `<ul class="list">${wait.map(i => row(i, 'need')).join('')}</ul>` : '<p class="empty">지금 답할 것은 없다. 시간을 흘려보내면 된다.</p>'}
    <h2>알림 <small>${note.length}</small>${note.length ? '<button class="mini" data-do="seenAll">모두 치우기</button>' : ''}</h2>${note.length ? `<ul class="list">${note.map(i => row(i, 'note')).join('')}</ul>` : '<p class="empty">새 알림이 없다.</p>'}</section>`; }
function summary(i: Incident): string { const P = i.payload as Record<string, any>;
  switch (i.kind) { case 'inquiry': return `${P.customer} — ${P.channel === 'visit' ? '찾아옴' : P.channel === 'phone' ? '전화' : '편지'}`; case 'quote_answer': return `${P.customer}: ${P.answer === 'accept' ? '주문하겠다' : P.answer === 'haggle' ? '값을 깎아 달라' : '거절'}`;
    case 'supplier_quote': return `${P.supplier}${P.haggled ? (P.agreed ? ' — 흥정을 받아들임' : ' — 흥정 거절') : ''}`; case 'parts_delivered': return `${P.supplier}에서 물건이 왔다`; case 'delivery_delayed': return `${P.supplier}: ${short(P.due)}로 늦어짐`;
    case 'stock_short': return `${STEP[P.step] ?? P.step} 공정에 ${PART[P.part] ?? P.part} 없음`; case 'build_step_done': return `${STEP[P.step] ?? P.step}${P.quality > 0 ? ` — 품질 ${P.quality}` : ''}`; case 'car_built': return `겉 품질 ${P.quality.visible}, 속 품질 ${P.quality.hidden}`;
    case 'newspaper': return String(P.lead ?? P.name); case 'month_closed': return `${P.month}: 들어온 돈 ${money(P.income)}, 나간 돈 ${money(P.spending)}`; case 'cash_warning': return `${P.weeks}주 안에 현금이 바닥난다`;
    case 'customer_cannot_pay': return `${P.customer} — 잔금 ${money(P.owed)}`; case 'order_late': return `주문 ${P.orderId}, 약속한 날 ${short(P.due)}`; case 'paint_held': return '비가 그칠 때까지 도장을 쉰다'; case 'car_broke_down': return `주문 ${P.orderId}의 차`;
    case 'tender_result': return P.won ? `낙찰! ${P.cars}대` : '다른 업체가 가져갔다'; case 'show_result': return P.prize ? '상을 받았다' : '출품을 마쳤다'; case 'auction_result': return P.won ? `낙찰 ${money(P.bid)}` : '다른 사람이 가져갔다'; default: return ''; } }
function matCost(designId: string): number { const d = g().shop.designs[designId]!; return Object.entries(w!.shop.bom(d)).reduce((t, [p, n]) => t + DATA.parts.parts[p]!.price * n, 0); }
function detail(i: Incident): string { const P = i.payload as Record<string, any>, G = g(), open = i.state === 'open', done = `<div class="row"><button data-do="seen" data-id="${i.id}">치우기</button></div>`;
  const head = `<h2>${KIND[i.kind] ?? i.kind}</h2><p class="meta">${dateKo(i.date)}${i.deadline && open ? ` · 답할 날 ${short(i.deadline)}까지` : ''}</p>`;
  switch (i.kind) {
    case 'inquiry': { const q = w!.sales.inquiry(P.inquiryId), v = w!.sales.view(q.id), def = DESIGNS.find(d => d[1] === v.orderType)![0], cost = matCost(def), hours = w!.shop.buildHours(G.shop.designs[def]!);
      const state = q.state === 'open' ? '' : `<p class="tag">${q.state === 'quoted' ? '견적을 보냈다. 답을 기다린다.' : q.state === 'ordered' ? '주문이 되었다.' : '끝난 문의다.'}</p>`;
      return `${head}<blockquote class="letter">${esc(v.letter)}</blockquote><dl><dt>손님</dt><dd>${esc(v.name)}</dd><dt>원하는 차</dt><dd>${BODY[v.body] ?? v.body} · ${ORDER[v.orderType]}</dd><dt>받고 싶은 날</dt><dd>${dateKo(v.wantBy)}</dd>
        <dt>예산</dt><dd>${v.budget ? `${money(v.budget[0])} ~ ${money(v.budget[1])}` : '아직 모른다'}</dd><dt>꼭 원하는 것</dt><dd>${v.mustHave ? (v.mustHave.map(m => MUST[m] ?? m).join(', ') || '없다') : '아직 모른다'}</dd></dl>${state}
        ${q.state === 'open' && open ? `<div class="row"><button data-do="consult" data-id="${q.id}" ${(v.budget && v.mustHave) || (q.consults ?? 0) >= DATA.sales.maxConsults + q.rounds ? 'disabled' : ''}>${v.budget && v.mustHave ? '더 물을 것이 없다' : (q.consults ?? 0) >= DATA.sales.maxConsults + q.rounds ? '손님이 더는 말을 아낀다' : `상담한다 (1.5시간, ${DATA.sales.maxConsults + q.rounds - (q.consults ?? 0)}번 남음)`}</button></div>
        <fieldset><legend>견적 보내기</legend><label>설계 <select id="q-design">${DESIGNS.map(d => `<option value="${d[0]}" ${d[0] === def ? 'selected' : ''}>${d[2]}</option>`).join('')}</select></label>
        <p class="hint">자재 값 약 ${money(cost)}, 작업 약 ${Math.round(hours)}시간. 설계 화면은 다음 차례에 나온다.</p>
        <label>값 ($) <input id="q-price" type="number" min="50" step="5" value="${Math.round((v.budget ? v.budget[1] * 0.96 : cost * 1.25 + hours * 0.85) / 5) * 5}"></label>
        <label>넘겨줄 날 <input id="q-due" type="date" value="${addDays(G.clock.date, Math.ceil(hours / 10 * 7 / 6 * 1.3) + 16)}" min="${G.clock.date}"></label>
        <label>계약금 <select id="q-dep"><option value="0.25">25%</option><option value="0.4" selected>40%</option><option value="0.5">50%</option></select></label>
        <div class="row"><button class="primary" data-do="quote" data-id="${q.id}" data-inc="${i.id}">견적을 보낸다</button><button data-do="dropInquiry" data-id="${q.id}" data-inc="${i.id}">정중히 거절한다</button></div></fieldset>` : done}`; }
    case 'quote_answer': { const q = w!.sales.inquiry(P.inquiryId);
      if (P.answer === 'haggle' && open && q.counter) return `${head}<p>${esc(P.customer)} 씨가 다른 조건을 말했다.</p><dl><dt>보낸 값</dt><dd>${money(q.quote!.price)}</dd><dt>손님이 부른 값</dt><dd>${money(q.counter.price)}</dd><dt>넘겨줄 날</dt><dd>${dateKo(q.counter.due)}</dd></dl>
        <div class="row"><button class="primary" data-do="acceptCounter" data-id="${q.id}" data-inc="${i.id}">그 값에 받는다</button><button data-do="dropInquiry" data-id="${q.id}" data-inc="${i.id}">그만둔다</button></div><p class="hint">다시 견적을 보내려면 서류함의 그 문의로 간다.</p>`;
      return `${head}<p>${esc(P.customer)} 씨: ${P.answer === 'accept' ? '주문하겠다고 했다. 계약금이 들어왔다.' : P.answer === 'reject' ? '거절했다.' : '답이 끝났다.'}</p>${P.answer === 'accept' && P.orderId ? orderBox(P.orderId) : ''}${done}`; }
    case 'supplier_quote': { const q = G.supply.quotes.find(x => x.id === P.quoteId); if (!q) return head + done; const total = q.lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
      return `${head}<p>${esc(P.supplier)}</p><table><tr><th>물건</th><th>수량</th><th>단가</th></tr>${q.lines.map(l => `<tr><td>${PART[l.part] ?? l.part} (${l.grade}등급)</td><td>${l.qty}</td><td>${money(l.unitPrice)}</td></tr>`).join('')}</table>
        <dl><dt>모두</dt><dd>${money(total)} ${q.prepaid ? '(선불)' : '(받을 때 치름)'}</dd><dt>오는 데</dt><dd>${q.leadDays}일</dd></dl>
        ${q.state === 'open' && open ? `<div class="row"><button class="primary" data-do="orderQuote" data-id="${q.id}" data-inc="${i.id}">주문한다</button>${q.round < 2 ? `<button data-do="haggle" data-id="${q.id}" data-inc="${i.id}" data-lever="patience">천천히 받고 깎는다</button><button data-do="haggle" data-id="${q.id}" data-inc="${i.id}" data-lever="prepay">선불로 깎는다</button>` : ''}<button data-do="resolve" data-id="${i.id}" data-choice="drop">그만둔다</button></div>` : done}`; }
    case 'customer_cannot_pay': return `${head}<p>${esc(P.customer)} 씨가 잔금 ${money(P.owed)}를 지금 낼 수 없다고 한다.</p>${open ? `<div class="row"><button data-do="settle" data-id="${P.orderId}" data-inc="${i.id}" data-choice="wait">한두 달 기다린다</button><button data-do="settle" data-id="${P.orderId}" data-inc="${i.id}" data-choice="discount">깎아서 받는다 (80%)</button><button data-do="settle" data-id="${P.orderId}" data-inc="${i.id}" data-choice="keep_deposit">계약금만 갖고 차를 둔다</button></div>` : done}`;
    case 'order_late': { const ord = G.market.orders.find(o => o.id === P.orderId), can = open && ord?.state === 'building' && !ord.askedDelay;
      return `${head}<p>주문 ${P.orderId}의 약속한 날(${dateKo(P.due)})이 지났다.${P.excusedDays ? ` 비로 쉰 ${P.excusedDays}일은 손님도 안다.` : ''}</p>${can ? `<label>며칠 더 <input id="d-days" type="number" min="1" max="60" value="14"></label><div class="row"><button class="primary" data-do="askDelay" data-id="${P.orderId}" data-inc="${i.id}">손님에게 말미를 청한다</button><button data-do="resolve" data-id="${i.id}" data-choice="work">그냥 서두른다</button></div>` : open ? `<div class="row"><button data-do="resolve" data-id="${i.id}" data-choice="work">알았다</button></div>` : done}`; }
    case 'car_built': { const b = G.shop.builds.find(x => G.shop.cars.find(c => c.id === P.carId)?.buildId === x.id), ord = G.market.orders.find(o => o.id === b?.orderId);
      return `${head}<dl><dt>겉 품질</dt><dd>${P.quality.visible}</dd><dt>속 품질</dt><dd>${P.quality.hidden}</dd><dt>든 돈</dt><dd>${money(P.cost)}</dd><dt>내 손이 간 시간</dt><dd>${P.ownHours}시간</dd></dl>${ord && ord.state === 'building' ? `<div class="row"><button class="primary" data-do="deliver" data-id="${ord.id}" data-car="${P.carId}" data-inc="${i.id}">손님에게 넘겨준다</button></div>` : done}`; }
    case 'newspaper': return `${head}<p>${esc(P.name)}가 왔다.</p><div class="row"><button class="primary" data-do="readIssue" data-id="${P.issueId}" data-inc="${i.id}">읽는다</button><button data-do="seen" data-id="${i.id}">나중에</button></div>`;
    case 'month_closed': return `${head}<dl><dt>들어온 돈</dt><dd>${money(P.income)}</dd><dt>나간 돈</dt><dd>${money(P.spending)}</dd><dt>남은 현금</dt><dd>${money(P.cash)}</dd></dl>${done}`;
    case 'stock_short': return `${head}<p>${STEP[P.step] ?? P.step} 공정을 시작하려는데 ${PART[P.part] ?? P.part}이(가) 창고에 없다. 작업 배정표에서 자재를 구한다.</p><div class="row"><button class="primary" data-do="goPlan" data-id="${i.id}">작업 배정표로</button></div>`;
    default: return `${head}<p>${esc(summary(i))}</p>${open ? `<div class="row"><button data-do="resolve" data-id="${i.id}" data-choice="ok">알았다</button></div>` : done}`; } }
function orderBox(orderId: number): string { const G = g(), ord = G.market.orders.find(o => o.id === orderId); if (!ord) return ''; const b = G.shop.builds.find(x => x.orderId === orderId);
  return `<dl><dt>값</dt><dd>${money(ord.price)} (계약금 ${money(ord.deposit)})</dd><dt>넘겨줄 날</dt><dd>${dateKo(ord.due)}</dd></dl>${b || ord.state !== 'building' ? '' : `<div class="row"><button class="primary" data-do="startBuild" data-id="${ord.id}">제작을 시작한다</button></div>`}`; }

// ---------- newspapers ----------
function papers(): string { const G = g(), M = G.media;
  if (openIssue != null) { const is = M.issues.find(x => x.id === openIssue)!, pub = DATA.media.publications.find(p => p.id === is.publication)!;
    const arts = is.articles.map((a, idx) => ({ a, idx })).sort((x, y) => x.a.page - y.a.page), ads = [...is.supplierAds.map(s => DATA.suppliers.suppliers.find(x => x.id === s)?.name ?? s)];
    return `<section class="sheet paper ${w!.media.look(is.id, G.clock.date)}"><button class="back" data-do="closeIssue">‹ 신문 더미</button><div class="mast"><b>${esc(pub.name)}</b><span>${dateKo(is.date)} · 제${is.id}호</span></div>
      ${arts.map(({ a, idx }, k) => { const body = w!.media.body(is.id, idx), text = body?.text ?? a.lead ?? ''; return `${k === 0 || arts[k - 1]!.a.page !== a.page ? `<h3 class="page">${a.page}면</h3>` : ''}<article class="${(a.importance ?? 0) >= 5 || a.level === 'historic' ? 'big' : (a.importance ?? 3) <= 2 ? 'small' : ''}">
        <h4>${esc(a.headline)}</h4>${text ? `<p>${esc(text)}</p>` : ''}<footer>${a.byline ? `<i>${esc(a.byline)}</i>` : a.origin === 'real' ? '<i>통신</i>' : ''}<button class="mini" data-do="writeAbout" data-issue="${is.id}" data-idx="${idx}">이 일로 편지를 쓴다</button></footer><div class="cf" id="cf-${idx}"></div></article>`; }).join('')}
      ${ads.length || is.playerAds.length ? `<h3 class="page">광고</h3><ul class="ads">${is.playerAds.map(() => `<li class="mine">${esc(G.people[G.founderId!]!.family)} 공방 — 주문 차체 제작</li>`).join('')}${ads.map(n => `<li>${esc(n)} — 자동차 자재 일체</li>`).join('')}</ul>` : ''}
      <div class="row"><button data-do="movePaper" data-id="${is.id}" data-place="drawer">서랍에 넣는다</button><button data-do="movePaper" data-id="${is.id}" data-place="gone">버린다</button></div></section>`; }
  const list = (place: string) => M.copies.filter(c => c.place === place).map(c => ({ c, is: M.issues.find(i => i.id === c.issueId)! })).reverse();
  const row = ({ c, is }: { c: typeof M.copies[number]; is: typeof M.issues[number] }) => `<li class="${c.read ? 'read' : 'need'}" data-do="openIssue" data-id="${is.id}"><b>${short(is.date)}</b><span>${esc(is.articles[0]?.headline ?? '')}</span><time>${c.read ? '읽음' : '새 신문'}${c.marked ? ' · 우리 이야기' : ''}</time></li>`;
  const desk = list('desk'), drawer = list('drawer'), ad = G.market.adverts.find(a => a.until > G.clock.date);
  return `<section><h2>책상 위 <small>${desk.length}</small></h2>${desk.length ? `<ul class="list">${desk.map(row).join('')}</ul>` : '<p class="empty">책상 위에 신문이 없다. 목요일마다 온다.</p>'}
    <h2>서랍 <small>${drawer.length}/${DATA.media.limits.drawer}</small></h2>${drawer.length ? `<ul class="list">${drawer.map(row).join('')}</ul>` : '<p class="empty">서랍은 비어 있다.</p>'}
    <h2>우리 광고</h2><p class="hint">${ad ? `${short(ad.until)}까지 실린다.` : '지금은 실리는 광고가 없다.'}</p><div class="row">${(['classified', 'eighth', 'quarter'] as const).map(s => `<button data-do="advert" data-size="${s}">${s === 'classified' ? '줄 광고' : s === 'eighth' ? '8분의 1면' : '4분의 1면'} 4주 · ${money(DATA.sales.adCost[s] * 4)}</button>`).join('')}</div></section>`; }
function chanceForm(issueId: number, idx: number): string { const G = g(), is = G.media.issues.find(x => x.id === issueId)!, a = is.articles[idx]!, c = w!.chances.open().find(x => x.issueId === issueId && x.headline === a.headline);
  if (!c) { const any = G.media.chances.find(x => x.issueId === issueId && x.headline === a.headline); return `<div class="note">${any && any.kind === 'tender' && any.state === 'open' ? '군청 서기가 서류를 돌려보냈다. 배달차나 짐차를 납품한 적이 없는 공방은 받지 않는다고 한다.' : any && any.state !== 'open' ? '이 일은 이미 지나갔거나 손을 썼다.' : '이 기사로는 따로 편지를 쓸 일이 없다.'}</div>`; }
  const left = `<p class="hint">${short(c.deadline)}까지다.</p>`;
  if (c.kind === 'clearance') return `<fieldset><legend>재고 떨이</legend>${left}<p>공급사에 사겠다고 편지를 쓴다. 그 뒤 견적을 물으면 싼 값으로 온다.</p><div class="row"><button class="primary" data-do="chClear" data-id="${c.id}">편지를 쓴다</button></div></fieldset>`;
  if (c.kind === 'auction') return `<fieldset><legend>공구 경매</legend>${left}<label>써낼 값 ($) <input id="c-bid" type="number" min="1" step="1" value="40"></label><p class="hint">경매 날 반나절(5시간)을 쓴다. 다른 사람보다 높아야 가져온다.</p><div class="row"><button class="primary" data-do="chAuction" data-id="${c.id}">경매에 나간다</button></div></fieldset>`;
  if (c.kind === 'show') { const cars = G.shop.cars.filter(x => (G.market.sold.find(s => s.carId === x.id)?.satisfaction ?? 99) >= 30); return `<fieldset><legend>출품</legend>${left}${cars.length ? `<label>내보낼 차 <select id="c-car">${cars.map(x => `<option value="${x.id}">차 ${x.id} — 겉 품질 ${x.quality.visible}${G.market.sold.some(s => s.carId === x.id) ? ' (주인에게 빌림)' : ''}</option>`).join('')}</select></label><p class="hint">참가비가 들고 하루(8시간)를 쓴다.</p><div class="row"><button class="primary" data-do="chShow" data-id="${c.id}">출품한다</button></div>` : '<p>내보낼 차가 없다. 지은 차가 있어야 하고, 판 차는 주인이 흡족해야 빌려준다.</p>'}</fieldset>`; }
  return `<fieldset><legend>입찰 (${c.cars}대)</legend>${left}<label>설계 <select id="c-design">${DESIGNS.map(d => `<option value="${d[0]}" ${d[0] === 'std_bought' ? 'selected' : ''}>${d[2]}</option>`).join('')}</select></label><label>대당 값 ($) <input id="c-price" type="number" min="100" step="10" value="1250"></label><p class="hint">서류에 3시간을 쓴다. 결과는 마감 뒤 열흘 안에 온다.</p><div class="row"><button class="primary" data-do="chBid" data-id="${c.id}">값을 써낸다</button></div></fieldset>`; }

// ---------- the work plan ----------
function plan(): string { const G = g(), tasks = Object.values(G.tasks).filter(t => !t.done), order = [...G.plan.map(s => G.tasks[s.taskId]).filter((t): t is Task => !!t && !t.done), ...tasks.filter(t => !G.plan.some(s => s.taskId === t.id))];
  const builds = G.shop.builds.filter(b => b.state === 'building'), need: Record<string, number> = {};
  for (const b of builds) { const d = G.shop.designs[b.designId]!; for (const st of DATA.build.steps) { const bs = b.steps.find(s => s.step === st.id), t = bs && G.tasks[bs.taskId]; if (!t || t.done || !t.blocked) continue; for (const [p, n] of Object.entries({ ...st.needs.all, ...st.needs[d.orderType] })) need[p] = (need[p] ?? 0) + n * (st.sized ? d.size : 1); } }
  const label = (t: Task) => { const m = /^build:(\d+):(\w+)/.exec(t.id); return m ? `차 ${m[1]} · ${STEP[m[2]!] ?? m[2]}` : STEP[t.label] ?? t.label; };
  const why = (t: Task) => (t.held ? '<em class="hold">비로 쉼</em>' : t.blocked ? '<em class="wait">앞 공정이나 자재를 기다림</em>' : '');
  const waitingOrders = G.market.orders.filter(o => o.state === 'building' && !G.shop.builds.some(b => b.orderId === o.id));
  return `<section><h2>오늘 할 일 <small>내 시간 하루 ${G.founder.hoursPerDay}시간${G.settings.daysOff.length ? ` · ${G.settings.daysOff.map(d => WD[d]).join('·')}요일 쉼` : ''}</small></h2>
    ${waitingOrders.map(o => `<div class="note">주문 ${o.id}의 제작을 아직 시작하지 않았다. <button class="mini" data-do="startBuild" data-id="${o.id}">시작한다</button></div>`).join('')}
    ${order.length ? `<ol class="tasks">${order.map((t, k) => `<li class="${t.blocked || t.held ? 'off' : ''}"><div><b>${esc(label(t))}</b>${why(t)}<span>${t.hoursDone.toFixed(0)} / ${t.hoursNeeded.toFixed(0)}시간</span></div><div class="bar"><i style="width:${Math.min(100, t.hoursDone / t.hoursNeeded * 100).toFixed(0)}%"></i></div>
      <div class="ord"><button class="mini" data-do="planUp" data-id="${esc(t.id)}" ${k === 0 ? 'disabled' : ''} aria-label="위로">▲</button><button class="mini" data-do="planDown" data-id="${esc(t.id)}" ${k === order.length - 1 ? 'disabled' : ''} aria-label="아래로">▼</button></div></li>`).join('')}</ol><p class="hint">위에 있는 일부터 내 시간을 쓴다. 직원은 자기가 잘하는 일을 맡는다.</p>` : '<p class="empty">진행 중인 일이 없다.</p>'}
    <h2>자재 <small>기다리는 공정에 드는 것</small></h2>${Object.keys(need).length ? `<table><tr><th>물건</th><th>필요</th><th>창고</th><th>오는 중</th><th></th></tr>${Object.entries(need).map(([p, n]) => { const have = w!.supply.stock(p), coming = w!.supply.coming(p), s = w!.supply.sellers(p)[0], asked = G.supply.pending.some(x => x.kind === 'reply' && x.lines?.some(l => l.part === p)) || G.supply.quotes.some(q => q.state === 'open' && q.lines.some(l => l.part === p));
      return `<tr><td>${PART[p] ?? p}</td><td>${n}</td><td>${have}</td><td>${coming}</td><td>${have + coming >= n ? '' : asked ? '<span class="tag">견적을 기다림</span>' : s ? `<button class="mini" data-do="askPart" data-part="${p}" data-qty="${Math.ceil(n - have - coming)}">${esc(DATA.suppliers.suppliers.find(x => x.id === s.id)!.name)}에 묻는다</button>` : '<span class="tag">파는 곳을 모른다</span>'}</td></tr>`; }).join('')}</table>` : '<p class="empty">지금 모자란 자재는 없다.</p>'}
    <h2>사람</h2><ul class="list plain">${[G.founderId!, ...G.employees.map(e => e.personId)].map(id => { const p = G.people[id]!; return `<li><b>${esc(fullName(p))}</b><span>${id === G.founderId ? '창업자' : `주급 ${money(G.employees.find(e => e.personId === id)!.wage)}`}</span></li>`; }).join('')}</ul></section>`; }

// ---------- the book ----------
function book(): string { const G = g(), month = G.clock.date.slice(0, 7), st = statement(G, month), R = G.market.reputation;
  return `<section><h2>이번 달 <small>${month}</small></h2><dl><dt>들어온 돈</dt><dd>${money(st.income)}</dd><dt>나간 돈</dt><dd>${money(st.spending)}</dd><dt>현금</dt><dd>${money(G.ledger.cash)}</dd></dl>
    <h2>읍내의 평</h2><dl><dt>읍에서 아는 정도</dt><dd>${Math.round(G.market.awareness.town)} / 100</dd>${(Object.entries({ quality: '품질', performance: '성능', style: '맵시', trust: '신뢰', value: '값어치' }) as [keyof typeof R, string][]).map(([k, l]) => `<dt>${l}</dt><dd>${Math.round(R[k])}</dd>`).join('')}</dl>
    <h2>주문</h2>${G.market.orders.length ? `<ul class="list plain">${G.market.orders.slice(-8).reverse().map(o => `<li><b>주문 ${o.id}</b><span>${money(o.price)} · ${short(o.due)}까지</span><time>${o.state === 'building' ? '제작 중' : o.state === 'delivered' ? '넘겨줌' : '취소'}</time></li>`).join('')}</ul>` : '<p class="empty">아직 주문이 없다.</p>'}
    <h2>일지</h2><ul class="journal">${G.journal.filter(j => !/^(holiday|expired|weather_|delay_)/.test(j.text) && !KIND[j.text]).slice(-12).reverse().map(j => `<li><time>${short(j.date)}</time>${esc(j.text)}</li>`).join('') || '<li>적힌 것이 없다.</li>'}</ul>
    <div class="row"><button data-do="restart">처음 화면으로</button></div></section>`; }

// ---------- what the buttons do ----------
function act(what: string, d: DOMStringMap, root: HTMLElement) { const W = w!, G = g(), id = +(d.id ?? 0), val = (s: string) => (root.querySelector<HTMLInputElement>(s)?.value ?? ''), settle = (inc?: string, choice = 'done') => { const it = G.incidents.find(i => i.id === +(inc ?? 0)); if (it?.state === 'open') W.sim.resolve(it.id, choice); if (it) (it.payload as { seen?: boolean }).seen = true; };
  switch (what) {
    case 'openItem': openItem = id; break; case 'closeItem': openItem = null; break; case 'goPlan': settle(d.id); tab = 'plan'; openItem = null; break;
    case 'seen': settle(d.id); openItem = null; break; case 'seenAll': for (const i of notices()) (i.payload as { seen?: boolean }).seen = true; break;
    case 'resolve': settle(d.id, d.choice); openItem = null; break;
    case 'consult': { const before = W.sales.view(id), after = W.sales.view(W.sales.consult(id).id); toast(after.budget && !before.budget || after.mustHave && !before.mustHave ? '이야기하다 보니 사정을 조금 더 알게 되었다.' : '이번에는 새로 알아낸 것이 없다.'); break; }
    case 'quote': { const v = W.sales.view(id), price = +val('#q-price'), due = val('#q-due'); if (!(price > 0) || !due) throw new Error('값과 날짜를 적어야 한다'); W.sales.quote(id, { designId: val('#q-design'), price, due, depositRate: +val('#q-dep'), meets: v.mustHave ?? [] }); settle(d.inc, 'quote'); openItem = null; toast('견적을 보냈다.'); break; }
    case 'dropInquiry': W.sales.drop(id); settle(d.inc, 'drop'); openItem = null; break;
    case 'acceptCounter': { const ord = W.sales.acceptCounter(id); settle(d.inc, 'accept'); W.shop.startBuild(ord.designId, ord.id); openItem = null; tab = 'plan'; toast('주문을 받았다. 제작을 시작한다.'); break; }
    case 'startBuild': { const ord = G.market.orders.find(o => o.id === id)!; W.shop.startBuild(ord.designId, ord.id); tab = 'plan'; openItem = null; toast('제작을 시작했다. 자재를 챙겨야 한다.'); break; }
    case 'orderQuote': W.supply.order(id); settle(d.inc, 'order'); openItem = null; toast('주문을 넣었다.'); break;
    case 'haggle': W.supply.haggle(id, d.lever as 'patience'); settle(d.inc, 'haggle'); openItem = null; toast('조건을 다시 물었다. 답을 기다린다.'); break;
    case 'settle': { const r = W.sales.settle(id, d.choice as 'wait'); settle(d.inc, d.choice); openItem = null; if (r) toast(`넘겨주었다. 손님의 마음: ${r.satisfaction}`); break; }
    case 'askDelay': { const ok = W.sales.askDelay(id, Math.max(1, +val('#d-days') || 14)); settle(d.inc, 'ask'); openItem = null; toast(ok ? '손님이 기다려 주기로 했다.' : '손님이 안 된다고 했다.'); break; }
    case 'deliver': { const r = W.sales.deliver(id, +d.car!); settle(d.inc, 'deliver'); if ('cannotPay' in r) { openItem = r.cannotPay.id; toast('손님이 잔금을 내지 못한다고 한다.'); } else { openItem = null; toast(`넘겨주었다. 손님의 마음: ${r.satisfaction}`); } break; }
    case 'readIssue': settle(d.inc); W.media.read(id); tab = 'papers'; openIssue = id; openItem = null; break;
    case 'openIssue': W.media.read(id); openIssue = id; break; case 'closeIssue': openIssue = null; break;
    case 'movePaper': W.media.move(id, d.place as 'gone'); openIssue = null; break;
    case 'advert': W.sales.placeAdvert(d.size as 'classified', 4); toast('광고를 맡겼다.'); break;
    case 'writeAbout': { root.querySelectorAll('.cf').forEach(x => { x.innerHTML = ''; }); const box = $(`#cf-${d.idx}`); box.innerHTML = chanceForm(+d.issue!, +d.idx!); wire(box); box.scrollIntoView({ block: 'nearest' }); throw new Skip(); }
    case 'chClear': W.chances.clear(id); toast('편지를 보냈다. 이제 그 가게에 견적을 물으면 된다.'); break;
    case 'chAuction': W.chances.auction(id, +val('#c-bid')); toast('경매 날을 달력에 적었다.'); break;
    case 'chShow': W.chances.enter(id, +val('#c-car')); toast('출품 신청을 했다.'); break;
    case 'chBid': W.chances.bid(id, val('#c-design'), +val('#c-price')); toast('봉투를 군청에 냈다.'); break;
    case 'askPart': { const s = W.supply.sellers(d.part!)[0]!; W.supply.inquire(s.id, [{ part: d.part!, qty: +d.qty!, grade: s.line.grade }], s.mailDays === 0 ? 'visit' : 'mail'); toast(s.mailDays === 0 ? '가게에 들러 물었다.' : '편지로 값을 물었다. 며칠 걸린다.'); break; }
    case 'planUp': case 'planDown': { const ids = Object.values(G.tasks).filter(t => !t.done).map(t => t.id), cur = [...G.plan.map(s => s.taskId).filter(x => ids.includes(x)), ...ids.filter(x => !G.plan.some(s => s.taskId === x))], k = cur.indexOf(d.id!), j = k + (what === 'planUp' ? -1 : 1);
      if (k >= 0 && j >= 0 && j < cur.length) { [cur[k], cur[j]] = [cur[j]!, cur[k]!]; G.plan = cur.map(taskId => ({ taskId })); } break; }
    case 'restart': speed = 0; w = null; startScreen(); throw new Skip(); }
  store.set(save(g())); }
(globalThis as { gearhouse?: unknown }).gearhouse = { world: () => w };          // for checks from the browser console and the screen tests
startScreen();
