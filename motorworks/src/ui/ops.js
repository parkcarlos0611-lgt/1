// Production (factories) and sales (models, dealers, marketing) workspaces.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim, R = MW.render, UI = MW.ui, h = U.h;
  const draft = { region: 'na', lines: 1, proc: null };
  const DEF = { stamping: 'press', welding: 'spot', paint: 'enamel', assembly: 'line', qa: 'visual' };

  const newFactoryForm = g => {
    if (!draft.proc) draft.proc = {};
    for (const [k] of D.P.stages) { const av = D.list(D.P[k], g.t); if (!draft.proc[k] || !av.find(o => o.id === draft.proc[k])) draft.proc[k] = (av.find(o => o.id === DEF[k]) || av[av.length - 1]).id; }
    const quote = S.factoryQuote(g, draft.region, draft.lines, draft.proc), bn = S.bottleneck(draft.proc);
    return h('div', { class: 'center' },
      h('div', { class: 'dochead' }, h('div', { class: 'dt' }, '신규 공장 건설'), h('div', { class: 'row' }, UI.btn(`착공 · ${U.money(quote)}`, () => UI.err(S.buildFactory(g, draft.region, draft.lines, draft.proc)) && UI.go('factory', { factory: g.factories[g.factories.length - 1].id }), 'pri'))),
      h('div', { class: 'card' },
        h('div', { class: 'grid3' }, UI.prop('지역', UI.sel(D.REGIONS.map(r => ({ id: r.id, name: `${r.name} — 시급 $${D.wage(g.t, r).toFixed(2)}` })), draft.region, null, v => { draft.region = v; UI.render(); })),
          UI.prop('라인 수', UI.sel([1, 2, 3, 4, 6].map(n => ({ id: n, name: n + '라인' })), draft.lines, null, v => { draft.lines = v; UI.render(); }))),
        UI.table([{ k: 'nm', t: '공정' }, { k: 'sel', t: '방식', f: r => UI.sel(D.P[r.k], draft.proc[r.k], g.t, v => { draft.proc[r.k] = v; UI.render(); }) }, { k: 'h', t: '공수/대', num: 1, f: r => { const P = D.byId(D.P[r.k], draft.proc[r.k]); return P.hours != null ? P.hours + ' h' : '—'; } }, { k: 'd', t: '결함·검출', num: 1, f: r => { const P = D.byId(D.P[r.k], draft.proc[r.k]); return P.defect != null ? U.pct(P.defect) : '검출 ' + U.pct(P.catch, 0); } }, { k: 't', t: '처리 능력', num: 1, f: r => { const v = D.P.thru[r.k][draft.proc[r.k]]; return h('span', { class: r.k === bn.k ? 'bad' : '' }, (v * 100).toFixed(0) + '%' + (r.k === bn.k ? ' 병목' : '')); } }, { k: 'c', t: '설비비', num: 1, f: r => '$' + D.byId(D.P[r.k], draft.proc[r.k]).capex + '/대·년' }],
          D.P.stages.map(([k, nm]) => ({ k, nm }))),
        h('p', { class: 'note' }, `라인 능력은 가장 느린 공정(병목: ${bn.nm})이 정합니다 — 1교대 ${U.num(S.lineCap(draft.proc))}대/월. 착공 후 12개월 뒤 가동. 공정 세대: 수작업 판금 → 프레스 → 탠덤 → 트랜스퍼 → 서보·핫스탬핑 / 가스용접 → 스폿 → 로봇 → 레이저 → 기가캐스팅 / 래커 → 에나멜 → 전착 → 로봇 → 수성 도장.`)));
  };

  UI.screens.factory = g => {
    const selId = UI.state.sel.factory;
    const f = selId === 'new' ? null : (g.factories.find(x => x.id === selId) || g.factories[0]);
    if (!f) return newFactoryForm(g);
    const models = g.cars.filter(c => c.status === 'ready' || c.status === 'production');
    const view = UI.canvas('factory', (x, W, H) => R.drawFactory(x, g, f, W, H, UI.state.anim));
    view.style.height = Math.max(170, 64 + f.lines.length * 92) + 'px';
    const bn = S.bottleneck(f.proc), stages = S.stageThru(f.proc), cap = S.lineCap(f);
    const lines = f.lines.map((ln, li) => {
      const car = ln.modelId && S.carOf(g, ln.modelId);
      let econ = null;
      if (car) {
        const p = S.evalPair(g, car, car.year), ue = S.unitEconomics(g, f, car, p);
        econ = h('div', { class: 'econ' }, UI.kv('대당 공수', ue.hours.toFixed(1) + ' h'), UI.kv('학습곡선', '×' + ue.learnH.toFixed(2) + ` (누적 ${U.num(car.built || 0)})`), UI.kv('시급', '$' + ue.wage.toFixed(2)), UI.kv('부품비', U.money(ue.parts, false)), UI.kv('노무비', U.money(ue.labor, false)), UI.kv('제조원가', U.money(ue.unit, false), 'sum'), UI.kv('공정 결함', U.pct(ue.defect)), UI.kv('출고 결함', U.pct(ue.escaped, 2) + ' (시대 평균 ' + U.pct(S.eraDefect(g.t), 1) + ')'), UI.kv('방청', Math.round(ue.corrosion * 100)));
      }
      return h('div', { class: 'line' }, h('div', { class: 'row wrap' }, h('b', {}, `라인 ${li + 1}`),
        UI.prop('생산 모델', UI.sel([{ id: '', name: '— 없음 —' }, ...models.map(c => ({ id: c.id, name: c.name + (ln.tooled === c.id ? '' : ' · 금형 필요') }))], ln.modelId || '', null, v => { UI.err(S.assignLine(g, f, li, v || null)); UI.render(); })),
        UI.prop('목표 가동률', UI.range(ln.rate, 10, 120, 5, v => { ln.rate = v; }, v => v + '%'))), econ);
    });
    const rel = f.labor || { premium: 0, relations: 60 };
    return h('div', { class: 'split' },
      h('section', { class: 'center' },
        h('div', { class: 'dochead' }, h('div', { class: 'dt' }, f.name, h('small', {}, `${D.REGIONS.find(r => r.id === f.region).name} · ${f.lines.length}라인 · ${f.shifts || 1}교대`)), h('div', { class: 'row' }, UI.btn('+ 라인 증설', () => UI.err(S.addLine(g, f)) && UI.render(), 'ghost'), UI.btn('신규 공장', () => UI.go('factory', { factory: 'new' }), 'ghost'))),
        h('div', { class: 'card flush' }, view),
        h('div', { class: 'kpis' }, UI.kpi('라인당 능력', U.num(cap) + '대/월', '병목: ' + bn.nm), UI.kpi('근로자', U.num(f.workers) + '명'), UI.kpi('가동률', U.pct(f.util || 0, 0)), UI.kpi('노사 관계', Math.round(rel.relations), f.labor?.strike ? '파업 중' : '다음 협약 ' + S.ym(f.labor?.contractT || g.t)), UI.kpi('장부가', U.money(f.bookValue))),
        h('div', { class: 'card' }, h('h3', {}, '라인 밸런싱'), h('div', { class: 'balance' }, stages.map(s => h('div', { class: s.k === bn.k ? 'bn' : '' }, h('span', {}, s.nm), UI.bar(s.v, 1.8, s.k === bn.k ? 'r' : ''), h('b', {}, (s.v * 100).toFixed(0) + '%')))),
          h('p', { class: 'note' }, `택트 타임 ${(f.shifts || 1) * 8 * 21 * 60 / cap * 60 < 120 ? ((f.shifts || 1) * 8 * 21 * 60 * 60 / cap).toFixed(0) + '초' : ((f.shifts || 1) * 8 * 21 * 60 / cap).toFixed(1) + '분'} — 병목 공정을 바꾸면 라인 전체 능력이 오릅니다.`)),
        h('div', { class: 'card' }, h('h3', {}, '생산 라인'), ...lines)),
      h('aside', { class: 'insp' },
        UI.group('공정', ...D.P.stages.map(([k, nm]) => UI.prop(nm, UI.sel(D.P[k], f.proc[k], g.t, v => { UI.err(S.retool(g, f, k, v)); UI.render(); })))),
        UI.group('근무 형태', UI.prop('교대', UI.sel(D.SHIFTS.map(s => ({ id: s.n, name: `${s.n}교대 · 능력 ×${s.cap} · 임금 ×${s.wage}` })), f.shifts || 1, null, v => { S.setShifts(g, f, v); UI.render(); }))),
        UI.group('노무', UI.prop('임금 프리미엄', UI.range(rel.premium, -10, 30, 1, v => { f.labor.premium = v; }, v => v + '%'), '높을수록 노사관계·품질↑'), h('p', { class: 'note' }, '단체협약은 3년마다. 노사관계 45 미만에서 협약 시 파업 위험이 생깁니다. 북미·유럽은 노조 영향이 크고 신흥시장은 작습니다. 레이오프(가동률 60% 미만)와 자동화 전환은 관계를 악화시킵니다.')),
        UI.group('부품 조달 (내재화 / 외주)', ...D.COMPONENTS.filter(c => D.avail(c, g.t)).map(c => UI.prop(c.name, UI.sel([{ id: 'buy', name: '외주 (+8%, 공급 차질 위험)' }, { id: 'make', name: `내재화 (−${Math.round(c.save * 100)}%, 설비 투자)` }], f.make?.[c.id] ? 'make' : 'buy', null, v => { UI.err(S.setMake(g, f, c.id, v === 'make')); UI.render(); })))))
    );
  };

  UI.screens.sales = g => {
    const cars = g.cars.filter(c => c.status);
    const rows = cars.map(c => {
      const p = S.evalPair(g, c, c.year);
      const net = c.price * (1 - D.DEALER_MARGIN), margin = c.unitCost ? (net - c.unitCost) / net : null;
      return { c, p, margin };
    });
    const sel = rows.find(r => r.c.id === UI.state.sel.salesCar) || rows[0];
    const detail = sel ? (() => {
      const c = sel.c, sug = S.suggestPrice(g, c);
      const illegal = {}; for (const R of D.REGIONS) illegal[R.id] = S.legalIn(g, c, sel.p.ev, sel.p.er, R.id);
      if (!c.price) c.price = sug;
      return h('div', { class: 'card' },
        h('h3', {}, c.name, h('small', {}, ' ' + ({ dev: '개발 중', ready: '라인 배정 대기', production: '판매 중', retired: '단종' })[c.status])),
        h('div', { class: 'grid3' },
          UI.prop('기본 소비자가', h('input', { class: 'in', type: 'number', id: 'price-' + c.id, value: c.price, step: 10, onchange: ev => { c.price = Math.max(0, +ev.target.value); UI.render(); } }), '권장 ' + U.money(sug, false)),
          UI.prop('주력 세그먼트', UI.sel(D.SEGMENTS, c.segment || 'family', null, v => { c.segment = v; UI.render(); }), '언론 평가 기준'),
          UI.prop('물가 연동', h('input', { type: 'checkbox', checked: c.indexPrice !== false, onchange: ev => { c.indexPrice = ev.target.checked; } }), '매년 1월 CPI 반영'),
          UI.prop('리베이트', UI.range(Math.round((c.rebate || 0) * 100), 0, 25, 1, v => { c.rebate = v / 100; }, v => v + '%'), '수요↑ 마진·잔존가치↓'),
          UI.prop('플릿 판매 비중', UI.range(Math.round((c.fleet || 0) * 100), 0, 50, 1, v => { c.fleet = v / 100; }, v => v + '%'), '렌터카·관공서, 18% 할인'),
          UI.prop('재고 과다 시 자동 감산', h('input', { type: 'checkbox', checked: c.autoThrottle !== false, onchange: ev => { c.autoThrottle = ev.target.checked; } }))),
        h('div', { class: 'row wrap regions' }, D.REGIONS.map(R => h('label', { class: 'chk' + (illegal[R.id].length ? ' bad' : ''), title: illegal[R.id].join(', ') }, h('input', { type: 'checkbox', checked: (c.regions || []).includes(R.id), onchange: ev => { c.regions = (c.regions || []).filter(x => x !== R.id).concat(ev.target.checked ? [R.id] : []); } }), R.name, illegal[R.id].length ? ' — ' + illegal[R.id][0] : ''))),
        h('div', { class: 'kpis' }, UI.kpi('지난달 판매', U.num(c.lastSales || 0) + '대'), UI.kpi('월 수요', U.num(c.lastDemand || 0) + '대'), UI.kpi('재고', U.num(g.inventory[c.id]?.units || 0) + '대'), UI.kpi('제조원가', c.unitCost ? U.money(c.unitCost, false) : '—'), UI.kpi('영업 마진', sel.margin != null ? U.pct(sel.margin) : '—', '', sel.margin != null && sel.margin < 0 ? 'neg' : ''), UI.kpi('3년 잔존가치', c.residual ? U.pct(c.residual, 0) : '—')),
        c.trimMix && c.trims ? h('div', {}, h('h3', {}, '트림 판매 비중'), c.trims.map((t, i) => h('div', { class: 'rr' }, h('span', {}, t.name), UI.bar((c.trimMix[i] || 0) * 100), h('b', {}, U.pct(c.trimMix[i] || 0, 0)), h('em', {}, U.money(t.price, false))))) : null,
        c.regDemand ? h('div', { class: 'cols2' }, h('div', {}, h('h3', {}, '지역별 수요'), Object.entries(c.regDemand).map(([rid, v]) => UI.kv(D.REGIONS.find(r => r.id === rid).name, U.num(v)))), h('div', {}, h('h3', {}, '세그먼트별 수요'), Object.entries(c.segDemand || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sid, v]) => UI.kv(D.SEGMENTS.find(s => s.id === sid).name, U.num(v))))) : null,
        c.salesHist ? UI.chart([{ data: c.salesHist, color: '#1f5fbf', area: 1, name: '월 판매' }], { h: 120 }) : null,
        c.status !== 'retired' ? UI.btn('단종', () => { c.status = 'retired'; for (const f of g.factories) for (const l of f.lines) if (l.modelId === c.id) l.modelId = null; S.log(g, `${c.name} 단종`); UI.render(); }, 'ghost') : null);
    })() : null;
    const dealers = D.REGIONS.map(R => {
      const d = g.dealers[R.id], need = Math.max(20, U.table(R.market, g.t) * 1e6 / 1500);
      return { R, d, need };
    });
    return h('div', { class: 'center wide' },
      h('div', { class: 'dochead' }, h('div', { class: 'dt' }, '판매'), h('div', {})),
      h('div', { class: 'card' }, h('h3', {}, '모델'), rows.length ? UI.table([
        { k: 'n', t: '모델', v: r => r.c.name, f: r => r.c.name }, { k: 's', t: '상태', f: r => UI.statusChip(r.c) },
        { k: 'p', t: '가격', num: 1, v: r => r.c.price, f: r => U.money(r.c.price || 0, false) }, { k: 'u', t: '원가', num: 1, v: r => r.c.unitCost || 0, f: r => r.c.unitCost ? U.money(r.c.unitCost, false) : '—' },
        { k: 'm', t: '마진', num: 1, v: r => r.margin ?? -9, f: r => r.margin != null ? h('span', { class: r.margin < 0 ? 'neg' : '' }, U.pct(r.margin)) : '—' },
        { k: 'sold', t: '지난달', num: 1, v: r => r.c.lastSales || 0, f: r => U.num(r.c.lastSales || 0) }, { k: 'd', t: '수요', num: 1, v: r => r.c.lastDemand || 0, f: r => U.num(r.c.lastDemand || 0) },
        { k: 'inv', t: '재고', num: 1, v: r => g.inventory[r.c.id]?.units || 0, f: r => U.num(g.inventory[r.c.id]?.units || 0) }, { k: 'rv', t: '평점', num: 1, v: r => r.c.reviewAvg || 0, f: r => r.c.reviewAvg ? r.c.reviewAvg.toFixed(1) : '—' }, { k: 'st', t: 'NCAP', f: r => r.c.stars != null ? '★'.repeat(r.c.stars) : '—' }
      ], rows, { onRow: r => { UI.state.sel.salesCar = r.c.id; UI.render(); }, rowClass: r => sel && r.c.id === sel.c.id ? 'on' : '' }) : h('p', { class: 'mut' }, '개발을 시작한 차량이 여기에 표시됩니다.')),
      detail,
      h('div', { class: 'card' }, h('h3', {}, '딜러망 · 마케팅'), UI.table([
        { k: 'r', t: '지역', f: x => x.R.name }, { k: 'n', t: '딜러', num: 1, v: x => x.d.count, f: x => U.num(x.d.count) + ' / ' + U.num(x.need) }, { k: 'c', t: '커버리지', f: x => UI.bar(x.d.count, x.need) },
        { k: 'pd', t: '딜러당 월 판매', num: 1, f: x => x.d.perDealer != null ? x.d.perDealer.toFixed(1) : '—' }, { k: 'aw', t: '인지도', num: 1, v: x => g.aware[x.R.id], f: x => Math.round(g.aware[x.R.id]) + '%' },
        { k: 'act', t: '딜러 모집', f: x => h('div', { class: 'row tight' }, [10, 50, 200].map(n => UI.btn('+' + n, () => UI.err(S.recruitDealers(g, x.R.id, n)) && UI.render(), 'ghost sm')), UI.btn('−10', () => { S.recruitDealers(g, x.R.id, -Math.min(x.d.count, 10)); UI.render(); }, 'ghost sm')) },
        { k: 'mk', t: '월 광고비', f: x => h('input', { class: 'in num', type: 'number', id: 'mkt-' + x.R.id, value: Math.round(g.marketing[x.R.id] || 0), step: 1000, onchange: ev => { g.marketing[x.R.id] = Math.max(0, +ev.target.value); } }) }
      ], dealers), h('p', { class: 'note' }, `딜러 계약금 ${U.money(D.DEALER_SIGN * D.cpi(g.t), false)}/곳 · 월 지원 ${U.money(D.DEALER_MONTH * D.cpi(g.t), false)}/곳 · 딜러 마진 ${D.DEALER_MARGIN * 100}% · 전국망 기준은 연간 판매 1,500대당 딜러 1곳.`))
    );
  };
})(window.MW);
