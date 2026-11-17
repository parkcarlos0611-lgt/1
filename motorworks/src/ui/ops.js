// Factory/production and sales/dealer screens.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim, R = MW.render, UI = MW.ui, h = U.h;
  const sec = (title, ...kids) => h('section', { class: 'panel' }, h('h3', {}, title), ...kids);
  const draft = { region: 'na', lines: 1, proc: null };
  const DEF = { stamping: 'press', welding: 'spot', paint: 'enamel', assembly: 'line', qa: 'visual' };

  UI.screens.factory = G => {
    if (!draft.proc) draft.proc = {};
    for (const [k] of D.P.stages) {
      const av = D.list(D.P[k], G.t);
      if (!draft.proc[k] || !av.find(o => o.id === draft.proc[k])) draft.proc[k] = (av.find(o => o.id === DEF[k]) || av[av.length - 1]).id;
    }
    const quote = S.factoryQuote(G, draft.region, draft.lines, draft.proc);
    const models = G.cars.filter(c => c.status === 'ready' || c.status === 'production');
    const facs = G.factories.map(f => {
      const cv = UI.canvas('factory', (x, W, H) => R.drawFactory(x, G, f, W, H, UI.state.anim));
      cv.style.height = Math.max(150, 60 + f.lines.length * 90) + 'px';
      const lines = f.lines.map((ln, li) => {
        const car = ln.modelId && S.carOf(G, ln.modelId);
        let econ = null;
        if (car) {
          const p = S.evalPair(G, car, car.year), ue = S.unitEconomics(G, f, car, p);
          econ = h('div', { class: 'econ' }, UI.kv('대당 공수', ue.hours.toFixed(1) + ' h'), UI.kv('시급', '$' + ue.wage.toFixed(2)), UI.kv('부품비', U.money(ue.parts, false)), UI.kv('노무비', U.money(ue.labor, false)), UI.kv('제조원가', U.money(ue.unit, false), 'sum'),
            UI.kv('공정 결함률', U.pct(ue.defect)), UI.kv('출고 결함 (검사 후)', U.pct(ue.escaped, 2) + ' · 시대평균 ' + U.pct(S.eraDefect(G.t), 1)), UI.kv('방청 등급', Math.round(ue.corrosion * 100)));
        }
        return h('div', { class: 'line' },
          h('div', { class: 'row wrap' }, h('b', {}, '라인 ' + (li + 1) + ' · 최대 ' + U.num(S.lineCap(f.proc)) + '대/월'),
            UI.field('생산 모델', UI.sel([{ id: '', name: '— 없음 —' }, ...models.map(c => ({ id: c.id, name: c.name + (ln.tooled === c.id ? '' : ' (금형 필요)') }))], ln.modelId || '', G.t, v => { UI.err(S.assignLine(G, f, li, v || null)); UI.render(); })),
            UI.slider('가동률 목표', ln.rate, 10, 120, 5, v => { ln.rate = v; }, v => v + '%')),
          econ);
      });
      return sec(f.name + ' — ' + D.REGIONS.find(r => r.id === f.region).name,
        cv,
        h('div', { class: 'row wrap' }, UI.kv('근로자', U.num(f.workers) + '명'), UI.kv('가동률', U.pct(f.util, 0)), UI.kv('장부가', U.money(f.bookValue)), h('button', { class: 'btn sm', onclick: () => UI.err(S.addLine(G, f)) && UI.render() }, '+ 라인 증설')),
        h('div', { class: 'procs' }, D.P.stages.map(([k, nm]) => UI.field(nm, UI.sel(D.P[k], f.proc[k], G.t, v => { UI.err(S.retool(G, f, k, v)); UI.render(); })))),
        ...lines);
    });
    const procInfo = k => {
      const P = D.byId(D.P[k], draft.proc[k]);
      return h('small', { class: 'mut' }, `${P.hours != null ? P.hours + 'h/대 · ' : ''}${P.defect != null ? '결함 ' + U.pct(P.defect) + ' · ' : ''}${P.catch != null ? '검출 ' + U.pct(P.catch, 0) + ' · ' : ''}설비 $${P.capex}/대·년`);
    };
    return h('div', { class: 'col' },
      facs.length ? facs : h('p', { class: 'mut' }, '공장이 없습니다. 아래에서 첫 공장을 건설하세요.'),
      sec('신규 공장 건설',
        h('div', { class: 'row wrap' },
          UI.field('지역', UI.sel(D.REGIONS.map(r => ({ id: r.id, name: `${r.name} (시급 $${D.wage(G.t, r).toFixed(2)})` })), draft.region, G.t, v => { draft.region = v; UI.render(); })),
          UI.field('라인 수', UI.sel([1, 2, 3, 4, 6].map(n => ({ id: n, name: n + '라인' })), draft.lines, G.t, v => { draft.lines = v; UI.render(); }))),
        h('div', { class: 'procs' }, D.P.stages.map(([k, nm]) => h('div', {}, UI.field(nm, UI.sel(D.P[k], draft.proc[k], G.t, v => { draft.proc[k] = v; UI.render(); })), procInfo(k)))),
        h('div', { class: 'row' }, h('b', {}, '견적 ' + U.money(quote) + ' · 라인당 ' + U.num(S.lineCap(draft.proc)) + '대/월 · 착공 후 12개월'),
          h('button', { class: 'btn', onclick: () => UI.err(S.buildFactory(G, draft.region, draft.lines, draft.proc)) && UI.render() }, '착공')),
        h('p', { class: 'mut' }, '시대별 공정: 수작업 판금 → 프레스 → 트랜스퍼 프레스 → 서보/핫스탬핑, 가스용접 → 스폿 → 로봇 → 레이저 → 기가캐스팅, 래커 → 에나멜 → 전착 → 로봇 도장 → 수성. 자동화일수록 공수와 결함은 줄고 설비비는 늘어납니다. 핫스탬핑 보론강은 서보 프레스(핫스탬핑 셀)가 있어야 생산할 수 있습니다.'))
    );
  };

  UI.screens.sales = G => {
    const cars = G.cars.filter(c => c.status);
    const models = cars.map(c => {
      const sug = S.suggestPrice(G, c);
      const p = S.evalPair(G, c, c.year);
      const illegal = {}; for (const R of D.REGIONS) illegal[R.id] = S.legalIn(G, c, p.ev, p.er, R.id);
      if (!c.price) c.price = sug;
      const price = h('input', { class: 'inp', type: 'number', id: 'price-' + c.id, value: c.price, step: 10, onchange: ev => { c.price = Math.max(0, +ev.target.value); UI.render(); } });
      const net = c.price * (1 - D.DEALER_MARGIN);
      const margin = c.unitCost ? (net - c.unitCost) / net : null;
      const status = { dev: '개발 중', ready: '라인 배정 대기', production: '판매 중', retired: '단종' }[c.status];
      return sec(c.name + ' · ' + status,
        h('div', { class: 'row wrap' },
          UI.field('소비자가 ($)', price, '권장 ' + U.money(sug, false)),
          UI.field('주력 세그먼트 (언론 평가 기준)', UI.sel(D.SEGMENTS, c.segment || 'family', G.t, v => { c.segment = v; })),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: c.indexPrice !== false, onchange: ev => { c.indexPrice = ev.target.checked; } }), '물가 연동 가격'),
          c.status !== 'retired' ? h('button', { class: 'btn sm ghost', onclick: () => { c.status = 'retired'; for (const f of G.factories) for (const l of f.lines) if (l.modelId === c.id) l.modelId = null; S.log(G, `${c.name} 단종`); UI.render(); } }, '단종') : null),
        h('div', { class: 'row wrap' }, D.REGIONS.map(R => h('label', { class: 'chk' + (illegal[R.id].length ? ' bad' : ''), title: illegal[R.id].join(', ') },
          h('input', { type: 'checkbox', checked: (c.regions || []).includes(R.id), onchange: ev => { c.regions = (c.regions || []).filter(x => x !== R.id).concat(ev.target.checked ? [R.id] : []); } }),
          R.name + (illegal[R.id].length ? ' ⚠ ' + illegal[R.id][0] : '')))),
        h('div', { class: 'row wrap' }, UI.kv('지난달 판매', U.num(c.lastSales || 0) + '대'), UI.kv('월 수요', U.num(c.lastDemand || 0) + '대'), UI.kv('재고', U.num(G.inventory[c.id]?.units || 0) + '대'), UI.kv('누적', U.num(c.sold || 0) + '대'),
          UI.kv('원가', c.unitCost ? U.money(c.unitCost, false) : '—'), UI.kv('영업 마진', margin != null ? U.pct(margin) : '—', margin != null && margin < 0 ? 'neg' : '')),
        c.regDemand ? h('div', { class: 'row wrap' }, Object.entries(c.regDemand).map(([rid, v]) => UI.kv(D.REGIONS.find(r => r.id === rid).name + ' 수요', U.num(v)))) : null,
        c.segDemand ? h('div', { class: 'row wrap' }, Object.entries(c.segDemand).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([sid, v]) => UI.kv(D.SEGMENTS.find(s => s.id === sid).name, U.num(v)))) : null,
        c.salesHist ? UI.chart([{ data: c.salesHist, color: '#d9a441', area: 1 }], { h: 110 }) : null);
    });
    const dealers = D.REGIONS.map(R => {
      const d = G.dealers[R.id], need = Math.max(20, U.table(R.market, G.t) * 1e6 / 1500);
      const mk = h('input', { class: 'inp', type: 'number', id: 'mkt-' + R.id, value: Math.round(G.marketing[R.id] || 0), step: 1000, onchange: ev => { G.marketing[R.id] = Math.max(0, +ev.target.value); } });
      return h('div', { class: 'rc' }, h('h4', {}, R.name),
        UI.kv('딜러', U.num(d.count) + ' / 전국망 ' + U.num(need)), UI.bar(d.count, need),
        UI.kv('딜러당 월 판매', d.perDealer != null ? d.perDealer.toFixed(1) : '—'), UI.kv('브랜드 인지도', Math.round(G.aware[R.id]) + '%'), UI.bar(G.aware[R.id]),
        h('div', { class: 'row wrap' }, [10, 50, 200].map(n => h('button', { class: 'btn sm', onclick: () => UI.err(S.recruitDealers(G, R.id, n)) && UI.render() }, '+' + n)),
          h('button', { class: 'btn sm ghost', onclick: () => { S.recruitDealers(G, R.id, -Math.min(d.count, 10)); UI.render(); } }, '−10')),
        h('small', { class: 'mut' }, `계약금 ${U.money(D.DEALER_SIGN * D.cpi(G.t), false)}/곳 · 월 지원 ${U.money(D.DEALER_MONTH * D.cpi(G.t), false)}/곳 · 딜러 마진 ${D.DEALER_MARGIN * 100}%`),
        UI.field('월 광고비 ($)', mk));
    });
    return h('div', { class: 'col' }, sec('딜러망 · 마케팅', h('div', { class: 'rcs' }, dealers)), cars.length ? models : h('p', { class: 'mut' }, '개발을 시작한 차량이 여기에 표시됩니다.'));
  };
})(window.MW);
