// Player company: R&D (platforms, engines, cars), factories (line balancing, shifts,
// learning curves, make-or-buy, unions), sales (trims, fleet, rebates, residuals),
// regulation (CAFE / CO2 fleet fines), press (reviews, comparison tests, awards,
// surveys), finance (P&L, balance sheet, loans, IPO, share price, dividends, M&A).
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim;
  D.ENG_SALARY = 280; D.DEALER_SIGN = 3000; D.DEALER_MONTH = 60; D.DEALER_MARGIN = .17;
  D.LINE_BASE = 1500; D.BUILDING = 350000; D.TAX = .3;
  const regionOf = id => D.REGIONS.find(r => r.id === id);

  S.newGame = (opt = {}) => {
    const G = {
      v: 2, seed: opt.seed || (Math.random() * 1e9) | 0, t: D.START_YEAR, month: 0, name: opt.name || 'Meridian Motor Works',
      cash: 5e6, equityIn: 5e6, loans: [], rep: 45, aware: { na: 8, eu: 3, ea: 1, em: 1 }, marketing: { na: 0, eu: 0, ea: 0, em: 0 },
      eng: 45, platforms: [], engines: [], cars: [], factories: [], dealers: { na: { count: 0 }, eu: { count: 0 }, ea: { count: 0 }, em: { count: 0 } },
      inventory: {}, hist: [], log: [], over: null, taxCarry: 0, ytd: { profit: 0, fleet: {} }, notices: {},
      shares: { out: 10e6, public: false, price: .5, payout: 0 }, awards: [], surveys: []
    };
    const pf = S.defaultPlatform(G.t, { name: 'A46 래더 프레임 FR', wbMin: 2700, wbMax: 3100, wMin: 1750, wMax: 1950, bayLen: 1100 });
    pf.status = 'ready'; pf.readyT = G.t; pf.inherited = true; // pre-war chassis the company starts with
    G.platforms.push(pf);
    const e = S.defaultEngine(G.t); e.name = '직렬 6기통 3.7 플랫헤드'; S.fixEngine(e, G.t); G.engines.push(e);
    const c = S.defaultCar(G.t, e.id); c.name = '시티 세단'; c.segment = 'family'; c.price = 0; c.regions = ['na']; c.platformId = pf.id; G.cars.push(c);
    S.initRivals(G);
    S.log(G, `${G.t}년 1월 — ${G.name} 설립. 자본금 ${U.money(G.cash)}.`, 'good');
    return G;
  };
  S.log = (G, msg, kind = '') => { G.log.unshift({ t: G.t, msg, kind }); if (G.log.length > 400) G.log.length = 400; };
  S.ym = t => `${Math.floor(t + 1e-6)}.${String(Math.round((t - Math.floor(t + 1e-6)) * 12) + 1).padStart(2, '0')}`;
  S.nominal = (G, v1946) => v1946 * D.cpi(G.t);
  S.engineOf = (G, id) => G.engines.find(e => e.id === id);
  S.carOf = (G, id) => G.cars.find(c => c.id === id);
  S.platformOf = (G, id) => G.platforms.find(p => p.id === id);
  S.eraDefect = y => U.table([[1946, .07], [1960, .05], [1975, .035], [1990, .015], [2005, .007], [2020, .004]], y);

  // ── evaluation (cached for frozen designs) ──
  const evCache = new Map();
  S.evalPair = (G, car, year = G.t, trim) => {
    const frozen = car.status && car.status !== 'draft';
    const key = frozen ? car.id + '|' + Math.floor(year) + '|' + (trim ? JSON.stringify(trim) : '') + '|' + (car._rev || 0) : null;
    if (key && evCache.has(key)) return evCache.get(key);
    const e = S.engineOf(G, car.engineId);
    if (car.powertrain !== 'bev' && !e) return null;
    const er = e ? S.evalEngine(e, year) : null; if (er) er.catId = e.cat;
    const pf = S.platformOf(G, car.platformId);
    const c2 = trim ? { ...car, interior: trim.interior || car.interior, features: { ...car.features, ...(trim.features || {}) } } : car;
    const ev = S.evalCar(c2, e, er, year, { platform: pf, noHot: !G.factories.some(f => f.proc.stamping === 'servo') });
    const out = { e, er, ev, pf };
    if (key) { evCache.set(key, out); if (evCache.size > 400) evCache.delete(evCache.keys().next().value); }
    return out;
  };
  S.trimsOf = car => car.trims && car.trims.length ? car.trims : [{ id: 'std', name: '표준', price: car.price, interior: car.interior, features: {} }];

  // ── R&D ──
  const projectNeed = (kind, cx) => kind === 'pf' ? 16 + Math.round(cx * 6) : kind === 'eng' ? 10 + Math.round(cx * 4) : 24 + Math.round(cx * 10);
  S.startPlatformDev = (G, pf) => {
    const E = S.evalPlatform(pf, G.t);
    if (E.issues.length) return E.issues[0];
    const cost = S.nominal(G, E.devCost);
    if (G.cash < cost * .15) return '초기 개발비(15%)가 부족합니다';
    pf.status = 'dev'; pf.year = Math.floor(G.t); pf.dev = { months: E.devMonths, done: 0, cost, need: projectNeed('pf', E.complexity) };
    S.log(G, `플랫폼 개발 착수: ${pf.name} (${E.devMonths}개월, ${U.money(cost)})`); return null;
  };
  S.startEngineDev = (G, e) => {
    const er = S.evalEngine(e, G.t), cost = S.nominal(G, er.devCost);
    if (G.cash < cost * .15) return '초기 개발비(15%)가 부족합니다';
    e.status = 'dev'; e.dev = { months: er.devMonths, done: 0, cost, need: projectNeed('eng', er.complexity) }; e.year = Math.floor(G.t);
    S.log(G, `엔진 개발 착수: ${e.name} (${er.devMonths}개월, ${U.money(cost)})`); return null;
  };
  S.startCarDev = (G, car) => {
    const pf = S.platformOf(G, car.platformId);
    if (!pf) return '플랫폼을 선택하세요';
    if (!pf.status) return '플랫폼 개발을 먼저 시작하세요';
    if (car.powertrain !== 'bev') { const e = S.engineOf(G, car.engineId); if (!e) return '엔진을 선택하세요'; if (!e.status) return '엔진 개발을 먼저 시작하세요'; }
    const p = S.evalPair(G, car); if (!p) return '설계를 평가할 수 없습니다';
    const pt = D.byId(D.PT.types, car.powertrain || 'ice'); if (!D.avail(pt, G.t)) return pt.name + ': ' + pt.intro + '년부터';
    if (p.ev.warn.length) return '설계 문제: ' + p.ev.warn[0];
    const cost = S.nominal(G, p.ev.devCost);
    car.status = 'dev'; car.dev = { months: p.ev.devMonths, done: 0, cost, need: projectNeed('car', p.ev.A.complexity) }; car.year = Math.floor(G.t);
    S.log(G, `차량 개발 착수: ${car.name} (${p.ev.devMonths}개월, ${U.money(cost)})`); return null;
  };

  // ── factories ──
  S.stageThru = (proc) => D.P.stages.map(([k, nm]) => ({ k, nm, v: D.P.thru[k][proc[k]] ?? 1 }));
  S.bottleneck = (proc) => S.stageThru(proc).reduce((a, b) => b.v < a.v ? b : a);
  S.lineCap = (fOrProc) => {
    const proc = fOrProc.proc || fOrProc, shifts = fOrProc.shifts || 1;
    return Math.round(D.LINE_BASE * S.bottleneck(proc).v * D.SHIFTS[shifts - 1].cap);
  };
  S.processCapex = (G, proc) => D.P.stages.reduce((s, [k]) => s + (D.byId(D.P[k], proc[k]).capex || 0), 0);
  S.factoryQuote = (G, region, lines, proc) => {
    const perLine = S.processCapex(G, proc) * D.LINE_BASE * S.bottleneck(proc).v * 12;
    return S.nominal(G, D.BUILDING * (1 + (lines - 1) * .25) + perLine * lines) * (region === 'na' ? 1 : region === 'eu' ? .95 : .7);
  };
  S.newFactory = (G, region, lines, proc, name, ready) => ({
    id: U.uid('fac'), name: name || (regionOf(region).name + ' 공장 ' + (G.factories.length + 1)), region, proc: { ...proc }, shifts: 1,
    lines: Array.from({ length: lines }, () => ({ modelId: null, rate: 100, tooled: null })), platformsTooled: [], make: {},
    labor: { premium: 0, relations: 60, contractT: G.t + 3, strike: 0 }, built: G.t, ready: ready ?? G.t + 1, capex: 0, bookValue: 0, workers: 0, util: 0
  });
  S.buildFactory = (G, region, lines, proc, name) => {
    const cost = S.factoryQuote(G, region, lines, proc);
    if (G.cash < cost) return '자금 부족 (' + U.money(cost) + ' 필요)';
    G.cash -= cost;
    const f = S.newFactory(G, region, lines, proc, name); f.capex = f.bookValue = cost; G.factories.push(f);
    S.log(G, `공장 건설 착공: ${regionOf(region).name}, ${lines}라인 (${U.money(cost)}). 12개월 후 가동.`); return null;
  };
  S.retool = (G, f, stage, id) => {
    const old = D.byId(D.P[stage], f.proc[stage]), nw = D.byId(D.P[stage], id);
    const cost = S.nominal(G, Math.max(0, nw.capex - old.capex * .3) * D.LINE_BASE * 12 * f.lines.length);
    if (G.cash < cost) return '자금 부족 (' + U.money(cost) + ')';
    G.cash -= cost; f.capex += cost; f.bookValue += cost; f.proc[stage] = id; f.downtime = 1;
    f.labor.relations -= ['robot', 'laser', 'giga', 'auto', 'transfer', 'servo'].includes(id) ? 6 : 0;
    S.log(G, `${f.name}: ${D.P.stages.find(s => s[0] === stage)[1]} → '${nw.name}' (${U.money(cost)}, 1개월 가동 중단)`); return null;
  };
  S.addLine = (G, f) => {
    const cost = S.nominal(G, S.processCapex(G, f.proc) * D.LINE_BASE * S.bottleneck(f.proc).v * 12 + D.BUILDING * .2);
    if (G.cash < cost) return '자금 부족 (' + U.money(cost) + ')';
    G.cash -= cost; f.capex += cost; f.bookValue += cost; f.lines.push({ modelId: null, rate: 100, tooled: null });
    S.log(G, `${f.name}: 라인 증설 (${U.money(cost)})`); return null;
  };
  S.setShifts = (G, f, n) => { if (n < f.shifts) f.labor.relations -= 8; f.shifts = n; S.log(G, `${f.name}: ${n}교대 운영`); return null; };
  S.setMake = (G, f, comp, make) => {
    const C = D.COMPONENTS.find(c => c.id === comp);
    if (make && !f.make[comp]) {
      const cost = S.nominal(G, C.capex * S.lineCap(f) * 12 * f.lines.length);
      if (G.cash < cost) return '자금 부족 (' + U.money(cost) + ')';
      G.cash -= cost; f.capex += cost; f.bookValue += cost; S.log(G, `${f.name}: ${C.name} 내재화 설비 투자 ${U.money(cost)}`);
    }
    f.make[comp] = !!make; return null;
  };
  S.assignLine = (G, f, li, modelId) => {
    const line = f.lines[li]; line.modelId = modelId || null;
    if (!modelId) return null;
    const car = S.carOf(G, modelId), p = S.evalPair(G, car, car.year);
    const st = D.byId(D.P.stamping, f.proc.stamping);
    if (p.ev.panels.some(x => x.SH.needProc === 'hot') && !st.hot) { line.modelId = null; return '핫스탬핑 패널은 서보 프레스(핫스탬핑 셀)가 필요합니다'; }
    let cost = 0;
    if (line.tooled !== modelId) cost += S.nominal(G, p.ev.tooling * st.tool);
    const pf = p.pf;
    if (pf && !f.platformsTooled.includes(pf.id)) cost += S.nominal(G, S.evalPlatform(pf, car.year).tooling);
    if (G.cash < cost) { line.modelId = null; return '금형·지그 비용 부족 (' + U.money(cost) + ')'; }
    if (cost) {
      G.cash -= cost; G.ledgerTooling = (G.ledgerTooling || 0) + cost;
      if (pf && !f.platformsTooled.includes(pf.id)) f.platformsTooled.push(pf.id);
      line.tooled = modelId;
      S.log(G, `${f.name} 라인 ${li + 1}: ${car.name} 금형·지그${pf ? '(플랫폼 공유)' : ''} ${U.money(cost)}`);
    }
    return null;
  };
  // production economics of a model on a factory
  S.unitEconomics = (G, f, car, p) => {
    const P = f.proc, st = D.byId(D.P.stamping, P.stamping), we = D.byId(D.P.welding, P.welding), pa = D.byId(D.P.paint, P.paint), as = D.byId(D.P.assembly, P.assembly), qa = D.byId(D.P.qa, P.qa);
    const ev = p.ev, er = ev.er, size = (car.body.L * car.body.W) / (4.7e6 * 1.78);
    const learnH = U.clamp(Math.pow(1 + (car.built || 0) / 5000, -.152), .6, 1);
    const make = f.make || {};
    let hours = (st.hours * ev.laborBody * size + we.hours * ev.laborBody * (ev.chassis.labor / 20) * size + pa.hours * size + as.hours * ev.laborAsm + qa.hours) * learnH;
    hours += make.engine === false ? 0 : (er.hours || 6);
    const region = regionOf(f.region);
    const wage = D.wage(G.t, region) * D.SHIFTS[(f.shifts || 1) - 1].wage * (1 + (f.labor?.premium || 0) / 100);
    const steel = D.eventsAt(G.t).reduce((m, e) => m * (e.steel || 1), 1);
    const chip = D.eventsAt(G.t).some(e => e.chip) && G.t > 1990 ? 1.06 : 1;
    let parts = 0;
    for (const k in ev.parts) {
      let v = ev.parts[k];
      const comp = D.COMPONENTS.find(c => c.share === k);
      if (comp) v *= make[comp.id] ? 1 - comp.save : 1.08;
      parts += v;
    }
    parts *= D.cpi(G.t) * (1 + (steel - 1) * .35) * chip * (f.region === 'ea' || f.region === 'em' ? .92 : 1) * (p.pf ? S.platformLearning(p.pf) : 1);
    const defect = 1 - [st, we, pa, as].reduce((m, x) => m * (1 - x.defect * (1 - (car.quality || 0) * .05) * (f.labor?.relations < 40 ? 1.3 : 1)), 1);
    const escaped = defect * (1 - qa.catch);
    const rework = defect * qa.catch * hours * .15;
    const labor = (hours + rework) * wage;
    const corrosion = U.clamp(ev.corr * .55 + pa.corr * .45, 0, 1);
    return { hours: hours + rework, wage, labor, parts, unit: parts + labor + parts * .04, defect, escaped, corrosion, gloss: pa.gloss, fit: st.fit, weldStiff: we.stiff, learnH };
  };

  // ── dealers, marketing, finance actions ──
  S.recruitDealers = (G, rid, n) => {
    const cost = S.nominal(G, D.DEALER_SIGN) * n;
    if (n > 0 && G.cash < cost) return '자금 부족';
    if (n > 0) G.cash -= cost;
    G.dealers[rid].count = Math.max(0, G.dealers[rid].count + n);
    S.log(G, `${regionOf(rid).name} 딜러 ${n > 0 ? '+' : ''}${n} (총 ${G.dealers[rid].count})`); return null;
  };
  S.balance = G => {
    const inv = Object.values(G.inventory).reduce((s, v) => s + v.units * (v.cost || 0), 0);
    const ppe = G.factories.reduce((s, f) => s + f.bookValue, 0);
    const debt = G.loans.reduce((s, l) => s + l.principal, 0);
    const assets = G.cash + inv + ppe;
    return { cash: G.cash, inv, ppe, assets, debt, equity: assets - debt };
  };
  S.creditLimit = G => { const bs = S.balance(G); return Math.max(0, bs.equity * .7 + bs.ppe * .3 - bs.debt) * (D.eventsAt(G.t).some(e => e.credit) ? .4 : 1); };
  S.loanRate = G => { const bs = S.balance(G); const lev = bs.debt / Math.max(1, bs.equity); return U.table(D.PRIME, G.t) + 1.2 + U.clamp(lev * 2.5, 0, 8); };
  S.borrow = (G, amt) => {
    if (!(amt > 0)) return '금액을 입력하세요';
    if (amt > S.creditLimit(G) + 1) return '신용 한도 초과';
    const r = S.loanRate(G) / 1200, n = 120, pay = amt * r / (1 - Math.pow(1 + r, -n));
    G.loans.push({ id: U.uid('ln'), principal: amt, rate: r * 1200, pay, left: n, t: G.t });
    G.cash += amt; S.log(G, `대출 ${U.money(amt)} @ ${(r * 1200).toFixed(2)}% (10년)`); return null;
  };
  S.repay = (G, ln) => { if (G.cash < ln.principal) return '현금 부족'; G.cash -= ln.principal; G.loans = G.loans.filter(x => x !== ln); S.log(G, `대출 조기상환 ${U.money(ln.principal)}`); return null; };
  S.profitTTM = G => U.sum(G.hist.slice(-12).map(h => h.L.net || 0));
  S.fundamental = G => { const bs = S.balance(G); return Math.max(bs.equity * .6, bs.equity * .3 + Math.max(0, S.profitTTM(G)) * U.table(D.PE, G.t)) / G.shares.out; };
  S.ipoCheck = G => {
    const years = [1, 2, 3].map(k => U.sum(G.hist.filter(h => Math.floor(h.t) === Math.floor(G.t) - k).map(h => h.L.net || 0)));
    const eq = S.balance(G).equity, need = S.nominal(G, 15e6);
    if (G.shares.public) return '이미 상장됨';
    if (years.some(v => v <= 0)) return '최근 3년 연속 흑자가 필요합니다';
    if (eq < need) return `자기자본 ${U.money(need)} 이상 필요`;
    return null;
  };
  S.ipo = G => {
    const why = S.ipoCheck(G); if (why) return why;
    const px = S.fundamental(G) * .92, newShares = G.shares.out * .35, raise = newShares * px;
    G.shares.out += newShares; G.shares.public = true; G.shares.price = px; G.shares.ipoT = G.t; G.cash += raise * .94; G.equityIn += raise * .94;
    S.log(G, `기업공개(IPO): 주당 $${px.toFixed(2)}, ${U.money(raise)} 조달`, 'good'); return null;
  };
  S.issueShares = (G, frac) => { if (!G.shares.public) return '상장 후 가능'; const n = G.shares.out * frac, px = G.shares.price * .95; G.shares.out += n; G.cash += n * px; G.equityIn += n * px; G.shares.price *= .97; S.log(G, `유상증자 ${U.money(n * px)}`); return null; };
  S.buyback = (G, amt) => { if (!G.shares.public) return '상장 후 가능'; if (G.cash < amt) return '현금 부족'; const n = amt / G.shares.price; G.shares.out -= n; G.cash -= amt; G.shares.price *= 1.02; S.log(G, `자사주 매입 ${U.money(amt)}`); return null; };
  S.acquireRival = (G, r) => {
    const price = r.forSale ? r.forSale.price : r.value * 1.35;
    if (G.cash < price) return `인수 자금 부족 (${U.money(price)})`;
    G.cash -= price;
    const proc = {}; for (const [k] of D.P.stages) { const av = D.list(D.P[k], G.t); proc[k] = (av.filter(o => D.maturity(o, G.t) > .6).pop() || av[0]).id; }
    const f = S.newFactory(G, r.home, Math.max(1, r.models.length), proc, `${r.name} 공장`, G.t); f.shifts = 2; f.capex = f.bookValue = price * .6;
    r.models.forEach((m, i) => {
      const car = m.car; car.status = 'production'; car.year = Math.floor(m.launchT); car.price = m.price; car.segment = m.seg; car.launchT = m.launchT;
      car.regions = D.REGIONS.filter(R => S.rivalPresence(G, r, R.id) > .15).map(R => R.id); car.acquiredFrom = r.name;
      if (m.engine) { m.engine.status = 'ready'; G.engines.push(m.engine); }
      G.cars.push(car); f.lines[i].modelId = car.id; f.lines[i].tooled = car.id;
    });
    G.factories.push(f);
    G.dealers[r.home].count += Math.max(20, r.dealers || 0);
    for (const k in r.aware) G.aware[k] = Math.max(G.aware[k], r.aware[k] * .7);
    G.cash += Math.max(0, r.cash) * .5;
    r.alive = false; r.mergedInto = G.name;
    S.log(G, `${r.name} 인수 완료 (${U.money(price)}) — 모델 ${r.models.length}종과 공장을 넘겨받음`, 'good'); return null;
  };

  // ── trims, launch, pricing ──
  S.launch = (G, car) => {
    const p = S.evalPair(G, car, car.year);
    const rng = U.rng((G.seed + car.id.length * 31 + Math.round(G.t * 12)) | 0);
    if (!G.firstLaunch) G.firstLaunch = G.t;
    const rivals = G.rivals.filter(r => r.alive).flatMap(r => r.models).filter(m => m.seg === car.segment).sort((a, b) => (b.last || 0) - (a.last || 0)).slice(0, 2);
    car.reviews = S.reviewCar(G, car, p.ev.r, car.price, rng, rivals);
    car.reviewAvg = U.sum(car.reviews.map(r => r.score)) / car.reviews.length;
    car.stars = p.ev.stars; car.launchT = G.t;
    const cmp = car.reviews.find(r => r.comparison);
    S.log(G, `${car.name} 출시 — 평균 평점 ${car.reviewAvg.toFixed(1)}/10${cmp ? `, 비교 테스트 ${cmp.comparison.of}대 중 ${cmp.comparison.rank}위` : ''}`, car.reviewAvg >= 6 ? 'good' : 'warn');
    for (const R of D.REGIONS) G.aware[R.id] = U.clamp(G.aware[R.id] + (car.regions.includes(R.id) ? 3 : 0), 0, 100);
  };
  S.suggestPrice = (G, car) => {
    const p = S.evalPair(G, car); if (!p) return 0;
    const unit = p.ev.partsCost * D.cpi(G.t) * 1.04 + (120 * p.ev.laborBody + (p.ev.er.hours || 6)) * D.wage(G.t, D.REGIONS[0]) * .6;
    return Math.round(unit * 1.3 / (1 - D.DEALER_MARGIN) / 10) * 10;
  };

  // ── monthly step ──
  S.step = (G) => {
    if (G.over) return;
    const L = { rev: 0, cogs: 0, mkt: 0, rd: 0, staff: 0, fac: 0, dep: 0, int: 0, tooling: G.ledgerTooling || 0, recall: 0, hold: 0, tariff: 0, fines: 0, units: 0, prod: 0, fleet: 0 };
    G.ledgerTooling = 0;
    const cpi = D.cpi(G.t), y = G.t;
    const rng = U.rng((G.seed + Math.round(y * 12)) | 0);
    for (const e of D.EVENTS) if (y >= e.y && y < e.y + 1 / 12 && !G.notices[e.name]) { G.notices[e.name] = 1; S.log(G, e.name, 'bad'); }
    for (const m of D.MANDATES) for (const rid in m.at) if (Math.abs(y - (m.at[rid] - 1)) < 1 / 24 && !G.notices[m.name + rid]) { G.notices[m.name + rid] = 1; S.log(G, `규제 예고: ${regionOf(rid).name} ${m.at[rid]}년부터 ${m.name}`, 'warn'); }
    // R&D
    const projects = [...G.platforms.filter(p => p.status === 'dev'), ...G.engines.filter(e => e.status === 'dev'), ...G.cars.filter(c => c.status === 'dev')];
    const need = U.sum(projects.map(p => p.dev.need));
    const speed = need > 0 ? Math.min(1, G.eng / need) : 1;
    for (const p of projects) {
      p.dev.done += speed; const c = p.dev.cost / p.dev.months * speed; G.cash -= c; L.rd += c;
      if (p.dev.done >= p.dev.months) { p.status = 'ready'; p.readyT = G.t; S.log(G, `개발 완료: ${p.name}${p.body ? ' — 공장 라인에 배정하면 생산 시작' : ''}`, 'good'); }
    }
    L.staff = G.eng * D.ENG_SALARY * cpi + (60000 + G.factories.length * 25000 + U.sum(Object.values(G.dealers).map(d => d.count)) * 40) * cpi / 12;
    G.cash -= L.staff;
    // production
    const chipEvt = D.eventsAt(G.t).some(e => e.chip) && G.t > 1990;
    const made = {};
    for (const f of G.factories) {
      if (G.t < f.ready - 1e-6) continue;
      if (Math.abs(G.t - f.ready) < 1e-6) S.log(G, `${f.name} 가동 개시`, 'good');
      f.shifts = f.shifts || 1; f.make = f.make || {}; f.labor = f.labor || { premium: 0, relations: 60, contractT: G.t + 3, strike: 0 }; f.platformsTooled = f.platformsTooled || [];
      // labour relations & contracts
      const unionF = f.region === 'na' || f.region === 'eu' ? 1 : f.region === 'ea' ? .6 : .3;
      f.labor.relations = U.clamp(f.labor.relations + (f.labor.premium - 3) * .05 * unionF + (f.util < .6 ? -.8 : .1), 0, 100);
      if (G.t >= f.labor.contractT) {
        f.labor.contractT = G.t + 3;
        if (f.labor.relations < 45 && rng() < (45 - f.labor.relations) / 45 * unionF) { f.labor.strike = 1 + Math.floor(rng() * 3); S.log(G, `${f.name}: 노조 파업 (${f.labor.strike}개월) — 단체협약 결렬`, 'bad'); }
        else S.log(G, `${f.name}: 단체협약 타결 (임금 프리미엄 ${f.labor.premium}%)`);
      }
      let disrupt = 1;
      for (const C of D.COMPONENTS) if (!f.make[C.id] && rng() < .003) { disrupt *= .5; S.log(G, `${f.name}: 협력사 공급 차질 — ${C.name}`, 'warn'); }
      if (chipEvt) disrupt *= f.make.electronics ? .9 : .75;
      const strike = f.labor.strike > 0; if (strike) f.labor.strike--;
      let hrs = 0, hrsCap = 0;
      const cap = S.lineCap(f);
      for (const line of f.lines) {
        if (!line.modelId) continue;
        const car = S.carOf(G, line.modelId); if (!car || car.status === 'retired') { line.modelId = null; continue; }
        if (car.status === 'ready') { car.status = 'production'; S.launch(G, car); }
        const p = S.evalPair(G, car, car.year), ue = S.unitEconomics(G, f, car, p);
        const inv = G.inventory[car.id] || (G.inventory[car.id] = { units: 0, cost: ue.unit });
        const stockMonths = inv.units / Math.max(50, car.lastSales || cap * .3);
        let units = cap * line.rate / 100 * (f.downtime ? .2 : 1) * (stockMonths > 3 && car.autoThrottle !== false ? .4 : 1) * disrupt * (strike ? 0 : 1);
        units = Math.floor(units);
        hrs += units * ue.hours; hrsCap += cap * ue.hours;
        const c = units * ue.parts * 1.04; G.cash -= c; L.cogs += c;
        inv.cost = (inv.cost * inv.units + ue.unit * units) / Math.max(1, inv.units + units);
        inv.units += units; L.prod += units; car.built = (car.built || 0) + units; if (p.pf) p.pf.units = (p.pf.units || 0) + units;
        const m = made[car.id] || (made[car.id] = { local: {}, escaped: 0, corrosion: 0, n: 0 });
        m.local[f.region] = 1; m.escaped = ue.escaped; m.corrosion = ue.corrosion; m.ue = ue; car.unitCost = ue.unit; car.escaped = ue.escaped; car.corrosion = ue.corrosion;
      }
      const paidH = strike ? hrsCap * .1 : Math.max(hrs, hrsCap * .6);
      const lab = paidH * D.wage(G.t, regionOf(f.region)) * D.SHIFTS[f.shifts - 1].wage * (1 + f.labor.premium / 100);
      G.cash -= lab; L.cogs += lab;
      f.workers = Math.round(paidH / 168); f.util = hrsCap ? hrs / hrsCap : 0;
      const upkeep = f.capex * .003; G.cash -= upkeep; L.fac += upkeep;
      const dep = f.bookValue / 240; f.bookValue -= dep; L.dep += dep;
      f.downtime = 0;
    }
    // player offers
    const offers = [];
    for (const car of G.cars) {
      if (car.status !== 'production' && !(G.inventory[car.id]?.units > 0)) continue;
      if (car.status === 'retired' && !(G.inventory[car.id]?.units > 0)) continue;
      const p = S.evalPair(G, car, car.year);
      const trims = S.trimsOf(car).map(t => {
        const pt = t.id === 'std' && !car.trims ? p : S.evalPair(G, car, car.year, t);
        const r = { ...pt.ev.r };
        r.reliability = U.clamp(r.reliability - ((car.escaped ?? S.eraDefect(G.t)) - S.eraDefect(G.t)) * 300, 0, 100);
        r.prestige = U.clamp(r.prestige + (G.rep - 50) * .25, 0, 100);
        const price = (t.price || car.price) * (1 - (car.rebate || 0));
        return { r, price, value: S.residual(r, G.rep, car.corrosion ?? .5, car.rebate || 0, car.fleet || 0, car.powertrain, G.t), trim: t, ev: pt.ev };
      });
      const presence = {}, local = {};
      for (const R of D.REGIONS) {
        const legal = !S.legalIn(G, car, p.ev, p.er, R.id).length;
        const d = G.dealers[R.id], needD = Math.max(20, U.table(R.market, y) * 1e6 / 1500);
        presence[R.id] = (car.regions || []).includes(R.id) && legal ? U.clamp(d.count / needD, 0, 1) * (.15 + .85 * Math.pow(G.aware[R.id] / 100, .8)) : 0;
        local[R.id] = made[car.id]?.local[R.id] || G.factories.some(f => f.region === R.id && f.lines.some(l => l.modelId === car.id));
      }
      offers.push({ owner: 'player', car, p, trims, pt: car.powertrain || 'ice', range: p.ev.range, rep: G.rep, presence, local });
    }
    G._rivalOffers = S.rivalOffers(G);
    const mk = S.marketMonth(G, offers.concat(G._rivalOffers, S.fringeOffers(G)));
    G.lastMarket = mk;
    S.rivalsMonth(G);
    // seller's market: buyers turned away by capacity-limited rivals look at our cars instead
    for (const R of D.REGIONS) {
      const unfilled = U.sum(G._rivalOffers.map(o => (o.demand[R.id] || 0) * (1 - (o.owner.fill ?? 1))));
      const mine = offers.filter(o => (o.demand[R.id] || 0) > 0), tot = U.sum(mine.map(o => o.demand[R.id]));
      if (unfilled > 0 && tot > 0) for (const o of mine) { const add = Math.min(o.demand[R.id] * 1.5, unfilled * .5 * o.demand[R.id] / tot); o.demand[R.id] += add; o.spill = (o.spill || 0) + add; }
    }
    // player sales
    const fl = G.ytd.fleet;
    for (const o of offers) {
      const car = o.car, inv = G.inventory[car.id]; if (!inv) continue;
      const retail = U.sum(Object.values(o.demand));
      const fleetQ = retail * (car.fleet || 0) / (1 - (car.fleet || 0));
      const want = retail + fleetQ, sell = Math.min(inv.units, Math.floor(want)), ratio = want > 0 ? sell / want : 0;
      let rev = 0, tariff = 0;
      const tShare = U.sum(o.trimDemand) || 1;
      const avgPrice = U.sum(o.trims.map((t, i) => t.price * o.trimDemand[i])) / tShare || car.price;
      for (const rid in o.demand) {
        const u = o.demand[rid] * ratio * (1 + (car.fleet || 0) / (1 - (car.fleet || 0)) * .999);
        const fleetPart = u * (car.fleet || 0);
        rev += (u - fleetPart) * avgPrice * (1 - D.DEALER_MARGIN) + fleetPart * avgPrice * .82;
        if (!o.local[rid]) tariff += u * (avgPrice * U.table(regionOf(rid).tariff, y) + 60 * cpi);
        const F = fl[rid] || (fl[rid] = { units: 0, gpm: 0, co2: 0 });
        const t0 = o.trims[0].ev; F.units += u; F.gpm += u / Math.max(1, t0.mpg); F.co2 += u * (t0.co2 || 0);
      }
      inv.units -= sell;
      G.cash += rev - tariff; L.rev += rev; L.tariff += tariff; L.units += sell; L.fleet += fleetQ * ratio;
      car.lastSales = sell; car.lastDemand = want; car.sold = (car.sold || 0) + sell; car.segDemand = o.segDemand; car.regDemand = o.demand;
      car.trimMix = o.trimDemand.map(v => v / tShare);
      car.salesHist = (car.salesHist || []).concat([sell]).slice(-120);
      car.residual = o.trims[0].value;
      const hold = inv.units * inv.cost * .01; G.cash -= hold; L.hold += hold;
      const rel = o.trims[0].r.reliability;
      const pRecall = (.006 + Math.max(0, (car.escaped ?? 0) - S.eraDefect(y)) * 2 + Math.max(0, 55 - rel) * .002) * Math.min(1, car.sold / 3000) * (y < 1966 ? .35 : 1);
      if (sell > 0 && rng() < pRecall) {
        const units = Math.round(car.sold * (.1 + rng() * .4)), cost = units * (25 + rng() * 55) * cpi;
        G.cash -= cost; L.recall += cost; G.rep = Math.max(0, G.rep - 1.5 - rng() * 3);
        const causes = ['연료 펌프', '브레이크 라인', '조향 링키지', '배선 하니스', '도어 래치', '서스펜션 암', '냉각수 호스', '변속기 링키지'].concat(y > 1985 ? ['에어백 인플레이터', 'ECU 소프트웨어'] : [], car.powertrain !== 'ice' ? ['BMS 소프트웨어', '고전압 커넥터'] : []);
        S.log(G, `${y < 1966 ? '보증수리 캠페인' : '리콜'}: ${car.name} ${U.num(units)}대 (${causes[Math.floor(rng() * causes.length)]} 결함) — ${U.money(cost)}`, 'bad');
      }
      if (car.launchT && G.t - car.launchT > 4 && (car.corrosion ?? .5) < .45 && rng() < .02) { G.rep = Math.max(0, G.rep - 1.5); S.log(G, `소비자 불만: ${car.name} 차체 부식 사례 확산`, 'bad'); }
    }
    // dealers & marketing
    for (const R of D.REGIONS) {
      const d = G.dealers[R.id];
      if (d.count) {
        const c = d.count * D.DEALER_MONTH * cpi; G.cash -= c; L.mkt += c;
        const unitsHere = U.sum(offers.map(o => (o.demand[R.id] || 0)));
        d.perDealer = unitsHere / d.count;
        if (G.firstLaunch && G.t - G.firstLaunch > .5 && d.perDealer < 1.5 && rng() < .2 && G.t - (d.lastChurn || 0) > .5) { const lost = Math.ceil(d.count * .05); d.count -= lost; d.lastChurn = G.t; S.log(G, `${R.name}: 판매 부진으로 딜러 ${lost}곳 이탈`, 'warn'); }
      }
      const spend = G.marketing[R.id] || 0; G.cash -= spend; L.mkt += spend;
      const mktSize = U.table(R.market, y) * 1e6;
      const eff = spend / (cpi * mktSize * .02 + 1);
      const wom = U.sum(offers.map(o => (o.demand[R.id] || 0))) / (mktSize / 12) * 60;
      G.aware[R.id] = U.clamp(G.aware[R.id] * .985 + eff * 2.2 + wom * .4, 0, 100);
    }
    if (offers.length) { let w = 0, s = 0; for (const o of offers) { const u = (o.car.sold || 0) + 1; w += u; s += u * (o.trims[0].r.reliability * .6 + (o.car.reviewAvg || 5) * 4); } G.rep = U.lerp(G.rep, s / w, .015); }
    // loans
    for (const ln of G.loans) { const int = ln.principal * ln.rate / 1200, princ = Math.min(ln.principal, ln.pay - int); G.cash -= int + princ; ln.principal -= princ; ln.left--; L.int += int; }
    G.loans = G.loans.filter(l => l.principal > 1 && l.left > 0);
    // December: CAFE / CO2 fines, awards, surveys, dividends; taxes
    if (G.month === 11) S.yearEnd(G, L);
    const ebt = L.rev - L.cogs - L.mkt - L.rd - L.staff - L.fac - L.dep - L.int - L.tooling - L.recall - L.hold - L.tariff - L.fines;
    G.ytd.profit += ebt;
    let tax = 0;
    if (G.month === 11) {
      const taxable = G.ytd.profit + G.taxCarry;
      if (taxable > 0) { tax = taxable * D.TAX; G.taxCarry = 0; } else G.taxCarry = taxable;
      if (taxable > 0 && G.shares.payout > 0) { const div = (taxable - tax) * G.shares.payout; G.cash -= div; L.div = div; S.log(G, `배당 지급 ${U.money(div)}`); }
      G.ytd.profit = 0; G.ytd.fleet = {}; G.cash -= tax;
    }
    L.tax = tax; L.net = ebt - tax; L.ebt = ebt;
    if (G.month === 0) {
      const inf = D.cpi(G.t) / D.cpi(G.t - 1);
      for (const r of G.rivals) for (const m of r.models) m.price *= inf;
      for (const c of G.cars) if (c.indexPrice !== false && c.price) { c.price = Math.round(c.price * inf / 10) * 10; if (c.trims) c.trims.forEach(t => t.price = Math.round(t.price * inf / 10) * 10); }
      S.rivalsYear(G);
    }
    // share price
    const fund = S.fundamental(G);
    G.shares.price = G.shares.public ? Math.max(.01, U.lerp(G.shares.price, fund * (1 + (rng() - .5) * .08), .2)) : fund;
    const bs = S.balance(G);
    G.hist.push({ t: G.t, cash: G.cash, rev: L.rev, net: L.net, units: L.units, prod: L.prod, equity: bs.equity, rep: G.rep, px: G.shares.price, L });
    if (G.hist.length > 1200) G.hist.shift();
    G.lastL = L;
    if (G.cash < 0) { G.negMonths = (G.negMonths || 0) + 1; if (G.negMonths === 1) S.log(G, '경고: 현금이 바닥났습니다. 3개월 안에 해결하지 않으면 파산합니다.', 'bad'); if (G.negMonths >= 4) { G.over = 'bankrupt'; S.log(G, '파산. 채권단이 회사를 인수했습니다.', 'bad'); } }
    else G.negMonths = 0;
    G.month = (G.month + 1) % 12; G.t = Math.round((G.t + 1 / 12) * 12) / 12;
    if (G.t >= 2036) G.over = 'end';
  };

  S.yearEnd = (G, L) => {
    const y = Math.floor(G.t), cpi = D.cpi(G.t);
    // fleet fuel-economy / CO2 regulation
    for (const rid in G.ytd.fleet) {
      const F = G.ytd.fleet[rid]; if (!F.units) continue;
      const rule = D.CAFE[rid]; if (!rule) continue;
      let fine = 0;
      if (rule.mpg) { const req = U.table(rule.mpg, y); const avg = F.units / F.gpm; if (req && avg < req) fine = (req - avg) * 10 * U.table(rule.fine, y) * F.units; if (req) S.log(G, `${regionOf(rid).name} CAFE: 평균 ${avg.toFixed(1)}mpg / 기준 ${req.toFixed(1)}mpg${fine ? ` — 벌금 ${U.money(fine)}` : ' — 충족'}`, fine ? 'bad' : ''); }
      if (rule.g) { const req = U.table(rule.g, y); const avg = F.co2 / F.units; if (req && avg > req) fine = (avg - req) * U.table(rule.fine, y) * F.units; if (req) S.log(G, `${regionOf(rid).name} CO₂: 평균 ${avg.toFixed(0)}g/km / 기준 ${req.toFixed(0)}g/km${fine ? ` — 벌금 ${U.money(fine)}` : ' — 충족'}`, fine ? 'bad' : ''); }
      G.cash -= fine; L.fines += fine;
    }
    // Car of the Year: best press average among launches this year (player + rivals)
    const cands = [];
    for (const c of G.cars) if (c.launchT && Math.floor(c.launchT + 1e-6) === y && c.reviewAvg) cands.push({ name: c.name, s: c.reviewAvg, me: 1 });
    for (const r of G.rivals) if (r.alive) for (const m of r.models) if (Math.floor(m.launchT + 1e-6) === y) {
      const seg = D.SEGMENTS.find(s => s.id === m.seg); cands.push({ name: m.name, s: U.sum(D.MAGAZINES.map(M => S.magScore(M, m.r, m.price, seg, G.t).score)) / 3 });
    }
    if (cands.length >= 2) {
      cands.sort((a, b) => b.s - a.s); const w = cands[0];
      G.awards.unshift({ y, name: w.name, me: !!w.me, field: cands.length });
      if (w.me) { G.rep = Math.min(100, G.rep + 4); for (const k in G.aware) G.aware[k] = Math.min(100, G.aware[k] + 4); }
      S.log(G, `${y} 올해의 차: ${w.name}${w.me ? ' — 우리 회사!' : ''} (후보 ${cands.length}대)`, w.me ? 'good' : '');
    }
    // reliability survey (from 1980)
    if (y >= 1980) {
      const brands = G.rivals.filter(r => r.alive && r.models.length).map(r => ({ name: r.name, v: U.sum(r.models.map(m => m.r.reliability)) / r.models.length }));
      const mine = G.cars.filter(c => c.status === 'production');
      if (mine.length) brands.push({ name: G.name, me: 1, v: U.sum(mine.map(c => S.evalPair(G, c, c.year).ev.r.reliability - ((c.escaped ?? 0) - S.eraDefect(G.t)) * 300)) / mine.length });
      brands.sort((a, b) => b.v - a.v);
      G.surveys.unshift({ y, rank: brands.map(b => ({ name: b.name, v: Math.round(b.v), me: !!b.me })) });
      const me = brands.findIndex(b => b.me);
      if (me >= 0) { S.log(G, `${y} 신뢰성 조사: ${brands.length}개 브랜드 중 ${me + 1}위`, me < 3 ? 'good' : me > brands.length - 3 ? 'bad' : ''); G.rep = U.clamp(G.rep + (brands.length / 2 - me) * .3, 0, 100); }
    }
  };

  S.save = G => { try { localStorage.setItem('motorworks_save2', JSON.stringify(G, (k, v) => k.startsWith('_') ? undefined : v)); return true; } catch (e) { return false; } };
  S.load = () => { try { const s = localStorage.getItem('motorworks_save2'); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
})(window.MW);
