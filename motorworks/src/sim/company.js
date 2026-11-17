// Company simulation: R&D projects, factories & production processes, labour,
// dealers, marketing, inventory, sales, recalls, finance (P&L, balance sheet, loans).
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim;
  D.ENG_SALARY = 280;   // engineer $/month in 1946 dollars
  D.DEALER_SIGN = 3000; D.DEALER_MONTH = 60; D.DEALER_MARGIN = .17;
  D.LINE_BASE = 1500;   // units/month for a moving line at rate 1.0
  D.BUILDING = 350000;  // factory shell & utilities, 1946$
  D.TAX = .3;

  S.newGame = (opt = {}) => {
    const G = {
      v: 1, seed: opt.seed || (Math.random() * 1e9) | 0, t: D.START_YEAR, month: 0, name: opt.name || 'Meridian Motor Works',
      cash: 5e6, equityIn: 5e6, loans: [], rep: 45, aware: { na: 8, eu: 3, ea: 1, em: 1 }, marketing: { na: 0, eu: 0, ea: 0, em: 0 },
      eng: 45, engines: [], cars: [], factories: [], dealers: { na: { count: 0 }, eu: { count: 0 }, ea: { count: 0 }, em: { count: 0 } },
      inventory: {}, hist: [], log: [], over: null, taxCarry: 0, ytd: { profit: 0 }, notices: {}
    };
    // starter designs to edit
    const e = S.defaultEngine(G.t); e.name = '스트레이트-6 3.0 플랫헤드'; S.fixEngine(e, G.t); G.engines.push(e);
    const c = S.defaultCar(G.t, e.id); c.name = '시티 세단'; c.segment = 'family'; c.price = 0; c.regions = ['na']; G.cars.push(c);
    S.initRivals(G);
    S.log(G, `${G.t}년 1월 — ${G.name} 설립. 자본금 ${U.money(G.cash)}.`, 'good');
    return G;
  };
  S.log = (G, msg, kind = '') => { G.log.unshift({ t: G.t, msg, kind }); if (G.log.length > 300) G.log.length = 300; };
  S.ym = t => `${Math.floor(t + 1e-6)}년 ${Math.round((t - Math.floor(t + 1e-6)) * 12) + 1}월`;
  S.nominal = (G, v1946) => v1946 * D.cpi(G.t);
  S.engineOf = (G, id) => G.engines.find(e => e.id === id);
  S.carOf = (G, id) => G.cars.find(c => c.id === id);

  // evaluation cache, keyed by design + year snapshot
  S.evalPair = (G, car, year = G.t) => {
    const e = S.engineOf(G, car.engineId); if (!e) return null;
    const er = S.evalEngine(e, year); const ev = S.evalCar(car, e, er, year, { noHot: !G.factories.some(f => f.proc.stamping === 'servo') });
    return { e, er, ev };
  };

  // ── R&D ──
  S.startEngineDev = (G, e) => {
    const er = S.evalEngine(e, G.t);
    const cost = S.nominal(G, er.devCost);
    if (G.cash < cost * .15) return '초기 개발비(15%)가 부족합니다';
    e.status = 'dev'; e.dev = { months: er.devMonths, done: 0, cost, need: 10 + Math.round(er.complexity * 4) }; e.year = Math.floor(G.t);
    S.log(G, `엔진 개발 착수: ${e.name} (${er.devMonths}개월, ${U.money(cost)})`);
    return null;
  };
  S.startCarDev = (G, car) => {
    const p = S.evalPair(G, car); if (!p) return '엔진을 선택하세요';
    const eng = p.e; if (eng.status !== 'ready' && eng.status !== 'dev') return '엔진 개발을 먼저 시작해야 합니다';
    if (p.ev.warn.length) return '설계 문제: ' + p.ev.warn[0];
    const cost = S.nominal(G, p.ev.devCost);
    car.status = 'dev'; car.dev = { months: p.ev.devMonths, done: 0, cost, need: 24 + Math.round(p.ev.A.complexity * 10) }; car.year = Math.floor(G.t);
    car.frozen = { engine: U.deep(eng) };
    S.log(G, `차량 개발 착수: ${car.name} (${p.ev.devMonths}개월, ${U.money(cost)})`);
    return null;
  };

  // ── factories ──
  S.processCapex = (G, proc) => D.P.stages.reduce((s, [k]) => s + D.techCost(D.byId(D.P[k], proc[k]), G.t) * 0 + (D.byId(D.P[k], proc[k]).capex || 0), 0);
  S.lineCap = (proc) => Math.round(D.LINE_BASE * D.byId(D.P.assembly, proc.assembly).rate);
  S.factoryQuote = (G, region, lines, proc) => {
    const perLine = S.processCapex(G, proc) * S.lineCap(proc) * 12;
    return S.nominal(G, D.BUILDING * (1 + (lines - 1) * .25) + perLine * lines) * (region === 'na' ? 1 : region === 'eu' ? .95 : .7);
  };
  S.buildFactory = (G, region, lines, proc, name) => {
    const cost = S.factoryQuote(G, region, lines, proc);
    if (G.cash < cost) return '자금 부족 (' + U.money(cost) + ' 필요)';
    G.cash -= cost;
    G.factories.push({ id: U.uid('fac'), name: name || (D.REGIONS.find(r => r.id === region).name + ' 공장 ' + (G.factories.length + 1)), region, proc: { ...proc }, lines: Array.from({ length: lines }, () => ({ modelId: null, rate: 100, tooled: null })), built: G.t, ready: G.t + 1, capex: cost, bookValue: cost, workers: 0, util: 0, defect: 0 });
    S.log(G, `공장 건설 착공: ${D.REGIONS.find(r => r.id === region).name}, ${lines}라인 (${U.money(cost)}). 12개월 후 가동.`);
    return null;
  };
  S.retool = (G, f, stage, id) => {
    const old = D.byId(D.P[stage], f.proc[stage]), nw = D.byId(D.P[stage], id);
    const cost = S.nominal(G, Math.max(0, nw.capex - old.capex * .3) * S.lineCap({ ...f.proc, [stage]: id }) * 12 * f.lines.length);
    if (G.cash < cost) return '자금 부족 (' + U.money(cost) + ')';
    G.cash -= cost; f.capex += cost; f.bookValue += cost; f.proc[stage] = id; f.downtime = 1;
    S.log(G, `${f.name}: ${D.P.stages.find(s => s[0] === stage)[1]} 공정을 '${nw.name}'(으)로 교체 (${U.money(cost)}, 1개월 가동 중단)`);
    return null;
  };
  S.addLine = (G, f) => {
    const cost = S.nominal(G, S.processCapex(G, f.proc) * S.lineCap(f.proc) * 12 + D.BUILDING * .2);
    if (G.cash < cost) return '자금 부족 (' + U.money(cost) + ')';
    G.cash -= cost; f.capex += cost; f.bookValue += cost; f.lines.push({ modelId: null, rate: 100, tooled: null });
    S.log(G, `${f.name}: 생산 라인 증설 (${U.money(cost)})`); return null;
  };
  S.assignLine = (G, f, li, modelId) => {
    const line = f.lines[li]; line.modelId = modelId || null;
    if (modelId && line.tooled !== modelId) {
      const car = S.carOf(G, modelId), p = S.evalPair(G, car, car.year);
      const st = D.byId(D.P.stamping, f.proc.stamping);
      const cost = S.nominal(G, p.ev.tooling * st.tool);
      if (G.cash < cost) { line.modelId = null; return '금형/지그 비용 부족 (' + U.money(cost) + ')'; }
      if (p.ev.sheet.needProc === 'hot' && !st.hot) { line.modelId = null; return '이 강판은 핫스탬핑 공정(서보 프레스)이 필요합니다'; }
      G.cash -= cost; line.tooled = modelId; line.toolingT = G.t; G.ledgerTooling = (G.ledgerTooling || 0) + cost;
      S.log(G, `${f.name} 라인 ${li + 1}: ${car.name} 금형·지그 제작 (${U.money(cost)})`);
    }
    return null;
  };
  // production economics of a model on a factory
  S.unitEconomics = (G, f, car, p) => {
    const P = f.proc, st = D.byId(D.P.stamping, P.stamping), we = D.byId(D.P.welding, P.welding), pa = D.byId(D.P.paint, P.paint), as = D.byId(D.P.assembly, P.assembly), qa = D.byId(D.P.qa, P.qa);
    const ev = p.ev, er = p.er, size = (car.body.L * car.body.W) / (4.7e6 * 1.78);
    const hours = st.hours * ev.laborBody * size + we.hours * ev.laborBody * (ev.chassis.labor / 20) * size + pa.hours * size + as.hours * ev.laborAsm + qa.hours + er.hours;
    const region = D.REGIONS.find(r => r.id === f.region);
    const wage = D.wage(G.t, region);
    const steel = D.eventsAt(G.t).reduce((m, e) => m * (e.steel || 1), 1);
    const chip = D.eventsAt(G.t).some(e => e.chip) && G.t > 1990 ? 1.06 : 1;
    const parts = ev.partsCost * D.cpi(G.t) * (1 + (steel - 1) * .35) * chip * (f.region === 'ea' || f.region === 'em' ? .9 : 1);
    const defect = 1 - [st, we, pa, as].reduce((m, x) => m * (1 - x.defect * (1 - (car.quality || 0) * .05)), 1);
    const escaped = defect * (1 - qa.catch);
    const rework = defect * qa.catch * hours * .15;
    const labor = (hours + rework) * wage;
    const corrosion = U.clamp(ev.corr * .55 + pa.corr * .45, 0, 1);
    return { hours: hours + rework, wage, labor, parts, unit: parts + labor + parts * .04, defect, escaped, corrosion, gloss: pa.gloss, fit: st.fit, weldStiff: we.stiff };
  };

  // ── dealers & marketing ──
  S.recruitDealers = (G, rid, n) => {
    const cost = S.nominal(G, D.DEALER_SIGN) * n;
    if (n > 0 && G.cash < cost) return '자금 부족';
    if (n > 0) G.cash -= cost;
    G.dealers[rid].count = Math.max(0, G.dealers[rid].count + n);
    S.log(G, `${D.REGIONS.find(r => r.id === rid).name} 딜러 ${n > 0 ? '+' : ''}${n} (총 ${G.dealers[rid].count})`);
    return null;
  };
  S.creditLimit = G => {
    const bs = S.balance(G);
    return Math.max(0, bs.equity * .7 + bs.ppe * .3 - bs.debt) * (D.eventsAt(G.t).some(e => e.credit) ? .4 : 1);
  };
  S.loanRate = G => { const bs = S.balance(G); const lev = bs.debt / Math.max(1, bs.equity); return U.table(D.PRIME, G.t) + 1.2 + U.clamp(lev * 2.5, 0, 8); };
  S.borrow = (G, amt) => {
    if (amt > S.creditLimit(G) + 1) return '신용 한도 초과';
    const r = S.loanRate(G) / 100 / 12, n = 120;
    const pay = amt * r / (1 - Math.pow(1 + r, -n));
    G.loans.push({ id: U.uid('ln'), principal: amt, rate: r * 1200, pay, left: n, t: G.t });
    G.cash += amt; S.log(G, `대출 실행 ${U.money(amt)} @ ${(r * 1200).toFixed(2)}% (10년 분할상환)`); return null;
  };
  S.repay = (G, ln) => { if (G.cash < ln.principal) return '현금 부족'; G.cash -= ln.principal; G.loans = G.loans.filter(x => x !== ln); S.log(G, `대출 조기상환 ${U.money(ln.principal)}`); return null; };

  S.balance = G => {
    const inv = Object.entries(G.inventory).reduce((s, [id, v]) => s + v.units * (v.cost || 0), 0);
    const ppe = G.factories.reduce((s, f) => s + f.bookValue, 0);
    const debt = G.loans.reduce((s, l) => s + l.principal, 0);
    const assets = G.cash + inv + ppe;
    return { cash: G.cash, inv, ppe, assets, debt, equity: assets - debt };
  };

  S.eraDefect = y => U.table([[1946, .07], [1960, .05], [1975, .035], [1990, .015], [2005, .007], [2020, .004]], y);
  // ── monthly step ──
  S.step = (G) => {
    if (G.over) return;
    const L = { rev: 0, cogs: 0, dealer: 0, mkt: 0, rd: 0, staff: 0, fac: 0, dep: 0, int: 0, tooling: G.ledgerTooling || 0, recall: 0, hold: 0, tariff: 0, units: 0, prod: 0 };
    G.ledgerTooling = 0;
    const cpi = D.cpi(G.t), y = G.t;
    const rng = U.rng((G.seed + Math.round(y * 12)) | 0);
    // events start notices
    for (const e of D.EVENTS) if (y >= e.y && y < e.y + 1 / 12 && !G.notices[e.name]) { G.notices[e.name] = 1; S.log(G, '⚑ ' + e.name, 'bad'); }
    for (const m of D.MANDATES) for (const rid in m.at) if (Math.abs(y - (m.at[rid] - 1)) < 1 / 24 && !G.notices[m.name + rid]) { G.notices[m.name + rid] = 1; S.log(G, `규제 예고: ${D.REGIONS.find(r => r.id === rid).name} ${m.at[rid]}년부터 ${m.name}`, 'warn'); }

    // R&D projects
    const projects = [...G.engines.filter(e => e.status === 'dev'), ...G.cars.filter(c => c.status === 'dev')];
    const need = U.sum(projects.map(p => p.dev.need));
    const speed = need > 0 ? Math.min(1, G.eng / need) : 1;
    for (const p of projects) {
      p.dev.done += speed; const c = p.dev.cost / p.dev.months * speed; G.cash -= c; L.rd += c;
      if (p.dev.done >= p.dev.months) {
        p.status = 'ready'; p.readyT = G.t;
        if (p.body) { p.status = 'ready'; S.log(G, `✓ 차량 개발 완료: ${p.name} — 공장 라인에 배정하면 생산 개시`, 'good'); }
        else S.log(G, `✓ 엔진 개발 완료: ${p.name}`, 'good');
      }
    }
    // staff
    L.staff = G.eng * D.ENG_SALARY * cpi + (60000 + G.factories.length * 25000 + U.sum(Object.values(G.dealers).map(d => d.count)) * 40) * cpi / 12;
    G.cash -= L.staff;

    // production
    const perModel = [];
    const pm = id => {
      let m = perModel.find(x => x.car.id === id);
      if (!m) {
        const car = S.carOf(G, id); const p = S.evalPair(G, car, car.year);
        const illegal = {}; for (const R of D.REGIONS) illegal[R.id] = S.legalIn(G, car, p.ev, p.er, R.id);
        m = { car, p, price: car.price, regions: car.regions || [], illegal, localFab: {}, demand: {}, segDemand: {}, made: 0, cost: 0, escaped: 0, corrosion: .5 };
        m.ratingsFor = (R) => {
          const r = { ...p.ev.r };
          r.reliability = U.clamp(r.reliability - (m.escaped - S.eraDefect(G.t)) * 300, 0, 100);
          r.prestige = U.clamp(r.prestige + (G.rep - 50) * .25, 0, 100);
          r.comfort = U.clamp(r.comfort + (car.body.L > 4800 ? (R.sizePref - 1) * 20 : (1 - R.sizePref) * 10), 0, 100);
          return r;
        };
        perModel.push(m);
      }
      return m;
    };
    for (const car of G.cars) if (car.status === 'production') pm(car.id);
    for (const f of G.factories) {
      if (G.t < f.ready - 1e-6) continue;
      if (Math.abs(G.t - f.ready) < 1e-6) S.log(G, `${f.name} 가동 개시`, 'good');
      let hrs = 0, hrsCap = 0;
      const cap = S.lineCap(f.proc);
      for (const line of f.lines) {
        if (!line.modelId) continue;
        const car = S.carOf(G, line.modelId); if (!car || car.status === 'retired') { line.modelId = null; continue; }
        if (car.status === 'ready') { car.status = 'production'; car.launchT = G.t; S.launch(G, car); }
        const m = pm(car.id);
        const ue = S.unitEconomics(G, f, car, m.p);
        m.localFab[f.region] = 1;
        const inv = G.inventory[car.id] || (G.inventory[car.id] = { units: 0, cost: ue.unit });
        // production planning: target rate %, throttled automatically when stock exceeds 3 months of sales
        const stockMonths = inv.units / Math.max(50, car.lastSales || cap * .3);
        let units = cap * line.rate / 100 * (f.downtime ? .2 : 1) * (stockMonths > 3 && car.autoThrottle !== false ? .4 : 1);
        if (D.eventsAt(G.t).some(e => e.chip) && G.t > 1990) units *= .8;
        units = Math.floor(units);
        hrs += units * ue.hours; hrsCap += cap * ue.hours;
        const c = units * ue.parts * 1.04;
        G.cash -= c; L.cogs += c;
        inv.cost = (inv.cost * inv.units + ue.unit * units) / Math.max(1, inv.units + units);
        inv.units += units; m.made += units; L.prod += units;
        m.escaped = ue.escaped; m.corrosion = ue.corrosion; m.ue = ue;
        car.unitCost = ue.unit;
      }
      // labour: paid for at least 60% of staffed capacity (lay-offs are slow)
      const region = D.REGIONS.find(r => r.id === f.region);
      const paidH = Math.max(hrs, hrsCap * .6);
      const lab = paidH * D.wage(G.t, region);
      G.cash -= lab; L.cogs += lab;
      f.workers = Math.round(paidH / 168); f.util = hrsCap ? hrs / hrsCap : 0;
      const upkeep = f.capex * .003; G.cash -= upkeep; L.fac += upkeep;
      const dep = f.bookValue / 240; f.bookValue -= dep; L.dep += dep;
      f.downtime = 0;
    }
    // also include models without production but with stock
    for (const id in G.inventory) if (G.inventory[id].units > 0) { const car = S.carOf(G, id); if (car && car.status !== 'retired') pm(id); }

    // market
    G.rivals.forEach(r => { r.sales = 0; r.share = {}; });
    const mk = S.marketMonth(G, perModel);
    G.lastMarket = mk;
    for (const m of perModel) {
      const inv = G.inventory[m.car.id]; if (!inv) continue;
      const totalDemand = U.sum(Object.values(m.demand));
      const sell = Math.min(inv.units, Math.floor(totalDemand));
      const ratio = totalDemand > 0 ? sell / totalDemand : 0;
      let rev = 0, tariff = 0;
      for (const rid in m.demand) {
        const u = m.demand[rid] * ratio;
        const net = m.price * (1 - D.DEALER_MARGIN);
        rev += u * net;
        if (!m.localFab[rid]) tariff += u * (m.price * U.table(D.REGIONS.find(r => r.id === rid).tariff, y) + 60 * cpi);
      }
      inv.units -= sell;
      G.cash += rev - tariff; L.rev += rev; L.tariff += tariff; L.units += sell; L.dealer += sell * m.price * D.DEALER_MARGIN;
      m.car.lastSales = sell; m.car.lastDemand = totalDemand; m.car.sold = (m.car.sold || 0) + sell; m.car.segDemand = m.segDemand; m.car.regDemand = m.demand;
      m.car.salesHist = (m.car.salesHist || []).concat([sell]).slice(-120);
      const hold = inv.units * inv.cost * .01; G.cash -= hold; L.hold += hold;
      // recalls: escaped defects + immature tech + low reliability
      // recalls / warranty campaigns: escaped defects above the era norm, low reliability, immature tech
      const pRecall = (.006 + Math.max(0, m.escaped - S.eraDefect(y)) * 2 + Math.max(0, 55 - m.p.ev.r.reliability) * .002) * Math.min(1, m.car.sold / 3000) * (y < 1966 ? .35 : 1);
      if (sell > 0 && rng() < pRecall) {
        const units = Math.round(m.car.sold * (.1 + rng() * .4));
        const cost = units * (25 + rng() * 55) * cpi;
        G.cash -= cost; L.recall += cost; G.rep = Math.max(0, G.rep - 1.5 - rng() * 3);
        S.log(G, `${y < 1966 ? '보증수리 캠페인' : '리콜'}: ${m.car.name} ${U.num(units)}대 (${['연료 펌프', '브레이크 라인', '조향 링키지', '배선 하니스', '도어 래치', '서스펜션 암', '냉각수 호스', '변속기 링키지'][Math.floor(rng() * 8)]} 결함) — ${U.money(cost)}`, 'bad');
      }
      // corrosion reputation effect after ~4 years on the market
      if (m.car.launchT && G.t - m.car.launchT > 4 && m.corrosion < .45 && rng() < .02) { G.rep = Math.max(0, G.rep - 1.5); S.log(G, `소비자 불만: ${m.car.name} 차체 부식 사례 확산`, 'bad'); }
    }
    // dealers: cost and churn when they cannot sell enough
    for (const R of D.REGIONS) {
      const d = G.dealers[R.id]; if (!d.count) continue;
      const c = d.count * D.DEALER_MONTH * cpi; G.cash -= c; L.dealer += 0; L.mkt += c;
      const unitsHere = U.sum(perModel.map(m => (m.demand[R.id] || 0)));
      const perDealer = unitsHere / d.count;
      d.perDealer = perDealer;
      if (G.firstLaunch && G.t - G.firstLaunch > .5 && perDealer < 1.5 && rng() < .2 && G.t - (d.lastChurn || 0) > .5) { const lost = Math.ceil(d.count * .05); d.count -= lost; d.lastChurn = G.t; S.log(G, `${R.name}: 판매 부진으로 딜러 ${lost}곳 계약 해지`, 'warn'); }
    }
    // marketing & awareness
    for (const R of D.REGIONS) {
      const spend = G.marketing[R.id] || 0; G.cash -= spend; L.mkt += spend;
      const mktSize = U.table(R.market, y) * 1e6;
      const eff = spend / (cpi * mktSize * .02 + 1); // spend relative to the size of the market
      const wom = U.sum(perModel.map(m => (m.demand[R.id] || 0))) / (mktSize / 12) * 60;
      G.aware[R.id] = U.clamp(G.aware[R.id] * .985 + eff * 2.2 + wom * .4, 0, 100);
    }
    // reputation drifts toward quality of what is on the road
    if (perModel.length) {
      let w = 0, s = 0; for (const m of perModel) { const u = (m.car.sold || 0) + 1; w += u; s += u * (m.ratingsFor(D.REGIONS[0]).reliability * .6 + (m.car.reviewAvg || 5) * 4); }
      G.rep = U.lerp(G.rep, s / w, .015);
    }
    // loans
    for (const ln of G.loans) {
      const int = ln.principal * ln.rate / 1200; const princ = Math.min(ln.principal, ln.pay - int);
      G.cash -= int + princ; ln.principal -= princ; ln.left--; L.int += int;
    }
    G.loans = G.loans.filter(l => l.principal > 1 && l.left > 0);
    // taxes (annual, on positive accumulated profit)
    const ebt = L.rev - L.cogs - L.mkt - L.rd - L.staff - L.fac - L.dep - L.int - L.tooling - L.recall - L.hold - L.tariff;
    G.ytd.profit += ebt;
    let tax = 0;
    if (G.month === 11) { const taxable = G.ytd.profit + G.taxCarry; if (taxable > 0) { tax = taxable * D.TAX; G.taxCarry = 0; } else G.taxCarry = taxable; G.ytd.profit = 0; G.cash -= tax; }
    L.tax = tax; L.net = ebt - tax + L.dep * 0; L.ebt = ebt;
    // rivals refresh; list prices follow inflation each January unless the player froze them
    if (G.month === 0) { for (const r of G.rivals) S.rivalRefresh(G, r); const inf = D.cpi(G.t) / D.cpi(G.t - 1); for (const r of G.rivals) for (const m of r.models) m.price *= inf; for (const c of G.cars) if (c.indexPrice !== false && c.price) c.price = Math.round(c.price * inf / 10) * 10; }
    // history
    const bs = S.balance(G);
    G.hist.push({ t: G.t, cash: G.cash, rev: L.rev, net: L.net, units: L.units, prod: L.prod, equity: bs.equity, rep: G.rep, L });
    if (G.hist.length > 1200) G.hist.shift();
    G.lastL = L;
    // bankruptcy
    if (G.cash < 0) { G.negMonths = (G.negMonths || 0) + 1; if (G.negMonths === 1) S.log(G, '경고: 현금이 바닥났습니다. 3개월 내 해결하지 않으면 파산합니다. (대출/비용 절감)', 'bad'); if (G.negMonths >= 4) { G.over = 'bankrupt'; S.log(G, '파산. 채권단이 회사를 인수했습니다.', 'bad'); } }
    else G.negMonths = 0;
    // advance clock
    G.month = (G.month + 1) % 12; G.t = Math.round((G.t + 1 / 12) * 12) / 12;
    if (G.t >= 2036) G.over = 'end';
  };

  S.launch = (G, car) => {
    const p = S.evalPair(G, car, car.year);
    const rng = U.rng((G.seed + car.id.length * 31 + Math.round(G.t * 12)) | 0);
    if (!G.firstLaunch) G.firstLaunch = G.t;
    car.reviews = S.reviewCar(G, car, p.ev, rng);
    car.reviewAvg = U.sum(car.reviews.map(r => r.score)) / car.reviews.length;
    S.log(G, `🚗 ${car.name} 출시! 평균 평점 ${car.reviewAvg.toFixed(1)}/10`, car.reviewAvg >= 6 ? 'good' : 'warn');
    for (const R of D.REGIONS) G.aware[R.id] = U.clamp(G.aware[R.id] + (car.regions.includes(R.id) ? 3 : 0), 0, 100);
  };

  S.suggestPrice = (G, car) => {
    const p = S.evalPair(G, car); if (!p) return 0;
    const parts = p.ev.partsCost * D.cpi(G.t);
    const hrs = 120 * p.ev.laborBody + p.er.hours; const wage = D.wage(G.t, D.REGIONS[0]);
    const unit = parts * 1.04 + hrs * wage * .6;
    return Math.round(unit * 1.3 / (1 - D.DEALER_MARGIN) / 10) * 10;
  };

  S.save = G => { try { localStorage.setItem('motorworks_save', JSON.stringify(G)); return true; } catch (e) { return false; } };
  S.load = () => { try { const s = localStorage.getItem('motorworks_save'); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
})(window.MW);
