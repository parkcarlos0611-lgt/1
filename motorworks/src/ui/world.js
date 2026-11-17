// Overview, market & competition, press, finance workspaces.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim, R = MW.render, UI = MW.ui, h = U.h;
  const card = (title, ...k) => h('div', { class: 'card' }, title ? h('h3', {}, title) : null, ...k);

  UI.screens.overview = g => {
    const bs = S.balance(g), L = g.lastL || {}, hist = g.hist.slice(-120);
    const dev = [...g.platforms.filter(p => p.status === 'dev'), ...g.engines.filter(e => e.status === 'dev'), ...g.cars.filter(c => c.status === 'dev')];
    const need = U.sum(dev.map(p => p.dev.need));
    const steps = [
      ['차량 설계 확인 (플랫폼·엔진 선택)', g.cars.some(c => c.status), () => UI.go('car')],
      ['엔진 개발 착수', g.engines.some(e => e.status), () => UI.go('engine')],
      ['차량 개발 착수', g.cars.some(c => c.status), () => UI.go('car')],
      ['공장 착공', g.factories.length > 0, () => UI.go('factory', { factory: 'new' })],
      ['딜러 모집 · 판매 지역 선택', Object.values(g.dealers).some(d => d.count > 0), () => UI.go('sales')],
      ['개발 완료 차량을 라인에 배정', g.factories.some(f => f.lines.some(l => l.modelId)), () => UI.go('factory')]
    ];
    const totalMkt = g.lastMarket ? U.sum(Object.values(g.lastMarket.regions).map(r => r.total)) : 1;
    const mine = U.sum(g.cars.map(c => U.sum(Object.values(c.regDemand || {}))));
    const leaders = g.rivals.filter(r => r.alive).map(r => ({ name: r.name, color: r.color, v: (r.salesM || 0) / totalMkt })).concat([{ name: g.name, color: '#1f5fbf', v: mine / totalMkt, me: 1 }]).sort((a, b) => b.v - a.v).slice(0, 8);
    return h('div', { class: 'center wide' },
      h('div', { class: 'dochead' }, h('div', { class: 'dt' }, '개요', h('small', {}, S.ym(g.t)))),
      h('div', { class: 'kpis' }, UI.kpi('자기자본', U.money(bs.equity), '부채 ' + U.money(bs.debt)), UI.kpi('월 매출', U.money(L.rev || 0), U.num(L.units || 0) + '대 판매'), UI.kpi('월 순이익', U.money(L.net || 0), '생산 ' + U.num(L.prod || 0) + '대', (L.net || 0) < 0 ? 'neg' : ''), UI.kpi('세계 점유율', U.pct(mine / totalMkt, 2)), UI.kpi('브랜드 평판', Math.round(g.rep)), UI.kpi(g.shares.public ? '주가' : '기업가치 (추정)', g.shares.public ? '$' + g.shares.price.toFixed(2) : U.money(S.fundamental(g) * g.shares.out))),
      steps.every(s => s[1]) ? null : card('시작 순서', h('ol', { class: 'steps' }, steps.map(([t, ok, go]) => h('li', { class: ok ? 'ok' : '' }, h('button', { class: 'lnk', onclick: go }, t)))), h('p', { class: 'note' }, '플랫폼과 엔진은 이미 하나씩 있습니다. 개발 프로젝트는 엔지니어를 나눠 쓰므로 동시에 많이 돌리면 느려집니다. 공장은 착공 후 12개월 걸리니 개발과 동시에 지으세요. 1946–49년은 공급 부족 시장이라 만드는 대로 팔립니다.')),
      h('div', { class: 'cols2' },
        card('현금 · 월 매출 (최근 10년)', UI.chart([{ data: hist.map(x => x.cash), color: '#1f5fbf', area: 1, name: '현금' }, { data: hist.map(x => x.rev), color: '#c46a12', name: '월 매출' }], { fmt: v => U.money(v), legend: 1, labels: hist.length ? [S.ym(hist[0].t), S.ym(hist[hist.length - 1].t)] : null })),
        card('세계 점유율 상위', h('div', { class: 'share' }, leaders.map(l => h('div', { class: l.me ? 'me' : '' }, h('i', { class: 'sw', style: { background: l.color } }), h('span', {}, l.name), UI.bar(l.v, Math.max(.2, leaders[0].v)), h('b', {}, U.pct(l.v, 1))))))),
      h('div', { class: 'cols2' },
        card(`개발 프로젝트${dev.length ? ` — 엔지니어 ${g.eng}/${need}명 (속도 ${Math.round(Math.min(1, g.eng / Math.max(1, need)) * 100)}%)` : ''}`,
          dev.length ? dev.map(p => h('div', { class: 'proj' }, h('span', {}, (p.body ? '차량 · ' : p.wbMin ? '플랫폼 · ' : '엔진 · ') + p.name), UI.bar(p.dev.done, p.dev.months), h('b', {}, Math.max(0, Math.ceil(p.dev.months - p.dev.done)) + '개월'))) : h('p', { class: 'mut' }, '진행 중인 프로젝트가 없습니다.'),
          h('div', { class: 'row' }, h('span', { class: 'mut' }, `엔지니어 ${g.eng}명 · 월 ${U.money(g.eng * D.ENG_SALARY * D.cpi(g.t))}`), UI.btn('+10명', () => { g.eng += 10; UI.render(); }, 'ghost sm'), UI.btn('−10명', () => { g.eng = Math.max(5, g.eng - 10); UI.render(); }, 'ghost sm'))),
        card('사내 소식', h('ul', { class: 'log' }, g.log.slice(0, 40).map(l => h('li', { class: l.kind }, h('time', {}, S.ym(l.t)), l.msg)))))
    );
  };

  UI.screens.market = g => {
    const y = g.t, mk = g.lastMarket;
    const totalMkt = mk ? U.sum(Object.values(mk.regions).map(r => r.total)) : 1;
    const rv = g.rivals.find(r => r.id === UI.state.sel.rival && r.alive);
    if (rv) {
      const m = rv.models.find(x => x.id === UI.state.sel.rmodel) || rv.models[0];
      const price = rv.forSale ? rv.forSale.price : rv.value * 1.35;
      return h('div', { class: 'center wide' },
        h('div', { class: 'dochead' }, h('div', { class: 'dt' }, h('i', { class: 'sw big', style: { background: rv.color } }), rv.name, h('small', {}, `${D.REGIONS.find(r => r.id === rv.home).name} · ${Math.floor(rv.founded)}년 설립${rv.forSale ? ' · 매각 공고 중' : ''}`)),
          h('div', { class: 'row' }, UI.btn(`인수 · ${U.money(price)}`, () => UI.err(S.acquireRival(g, rv)) && UI.go('overview'), rv.forSale ? 'pri' : 'ghost'), UI.btn('전체 시장으로', () => { UI.state.sel.rival = null; UI.render(); }, 'ghost'))),
        h('div', { class: 'kpis' }, UI.kpi('세계 점유율', U.pct((rv.salesM || 0) / totalMkt, 2)), UI.kpi('월 판매', U.num(rv.salesM || 0) + '대'), UI.kpi('생산 능력', U.num(rv.capacity) + '대/월'), UI.kpi('현금', U.money(rv.cash), '', rv.cash < 0 ? 'neg' : ''), UI.kpi('기업가치', U.money(rv.value)), UI.kpi('평판', Math.round(rv.rep))),
        h('div', { class: 'card' }, h('h3', {}, '라인업'), UI.table([{ k: 'n', t: '모델', f: x => x.name }, { k: 's', t: '세그먼트', f: x => D.SEGMENTS.find(s => s.id === x.seg).name }, { k: 'pt', t: '동력', f: x => ({ ice: '내연', hev: 'HEV', phev: 'PHEV', bev: 'BEV' })[x.pt] }, { k: 'hp', t: '출력', num: 1, v: x => x.spec.hp, f: x => x.spec.hp + ' hp' }, { k: 't', t: '0-100', num: 1, v: x => x.spec.t100, f: x => x.spec.t100.toFixed(1) + ' s' }, { k: 'e', t: '연비/주행거리', num: 1, f: x => x.pt === 'bev' ? Math.round(x.range) + ' km' : x.spec.lpk.toFixed(1) + ' L' }, { k: 'p', t: '가격', num: 1, v: x => x.price, f: x => U.money(x.price, false) }, { k: 'l', t: '월 판매', num: 1, v: x => x.last || 0, f: x => U.num(x.last || 0) }, { k: 'a', t: '출시', num: 1, v: x => x.launchT, f: x => S.ym(x.launchT) }], rv.models, { onRow: x => { UI.state.sel.rmodel = x.id; UI.render(); }, rowClass: x => x === m ? 'on' : '' })),
        m ? h('div', { class: 'card' }, h('h3', {}, m.name, h('small', {}, ` · ${m.car.body.L}×${m.car.body.W}×${m.car.body.H} mm · ${m.spec.mass} kg`)), UI.carSide(m.car, Math.floor(m.launchT), {}), h('div', { class: 'cols2' }, h('div', {}, D.RATING_KEYS.slice(0, 5).map(k => UI.ratingRow(k, m.r[k]))), h('div', {}, D.RATING_KEYS.slice(5).map(k => UI.ratingRow(k, m.r[k]))))) : null,
        rv.hist.length ? h('div', { class: 'card' }, h('h3', {}, '연간 실적'), UI.chart([{ data: rv.hist.map(x => x.sales), color: rv.color, area: 1, name: '판매' }], { fmt: v => U.num(v), labels: [rv.hist[0].y + '', rv.hist[rv.hist.length - 1].y + ''] })) : null);
    }
    const rivals = g.rivals.map(r => ({ r, share: r.alive ? (r.salesM || 0) / totalMkt : 0 }));
    return h('div', { class: 'center wide' },
      h('div', { class: 'dochead' }, h('div', { class: 'dt' }, '시장 · 경쟁', h('small', {}, `세계 신차 시장 ${U.num(totalMkt * 12 / 1e6, 1)}M대/년`))),
      h('div', { class: 'card' }, h('h3', {}, '경쟁사'), UI.table([
        { k: 'n', t: '회사', v: x => x.r.name, f: x => h('span', {}, h('i', { class: 'sw', style: { background: x.r.color } }), x.r.name) },
        { k: 'h', t: '본거지', f: x => D.REGIONS.find(r => r.id === x.r.home).name }, { k: 's', t: '세계 점유율', num: 1, v: x => x.share, f: x => x.r.alive ? U.pct(x.share, 1) : '—' },
        { k: 'm', t: '모델', num: 1, v: x => x.r.models.length, f: x => x.r.alive ? x.r.models.length + (x.r.models.some(m => m.pt === 'bev') ? ' (EV)' : '') : '—' },
        { k: 'c', t: '현금', num: 1, v: x => x.r.cash, f: x => x.r.alive ? h('span', { class: x.r.cash < 0 ? 'neg' : '' }, U.money(x.r.cash)) : '—' },
        { k: 'v', t: '기업가치', num: 1, v: x => x.r.value, f: x => x.r.alive ? U.money(x.r.value) : '—' }, { k: 'p', t: '평판', num: 1, v: x => x.r.rep, f: x => Math.round(x.r.rep) },
        { k: 'st', t: '상태', f: x => x.r.alive ? (x.r.forSale ? UI.chip('매각 공고', 'bad') : UI.chip('영업 중', 'production')) : UI.chip(x.r.mergedInto ? x.r.mergedInto + '에 합병' : '청산', 'draft') }
      ], rivals, { sort: 's', onRow: x => x.r.alive && UI.go('market', { rival: x.r.id, rmodel: null }) })),
      h('div', { class: 'rcs' }, D.REGIONS.map(R => {
        const share = D.segShare(y, R.id), reg = mk?.regions[R.id];
        return h('div', { class: 'card' }, h('h3', {}, R.name, h('small', {}, ` ${U.table(R.market, y).toFixed(1)}M대/년`)),
          UI.kv('중위 가구소득', U.money(D.income(y, R))), UI.kv('휘발유 (갤런)', '$' + (U.table(D.FUEL, y) * R.fuelTax).toFixed(2)), UI.kv('수입 관세', U.pct(U.table(R.tariff, y), 0)), UI.kv('배출 기준', U.table(D.EMISSION_LIMIT[R.id], y) > 900 ? '없음' : U.table(D.EMISSION_LIMIT[R.id], y).toFixed(0)),
          y >= 2008 ? UI.kv('충전 인프라', U.pct(U.table(D.CHARGE_INFRA[R.id], y), 0)) : null, y >= 2008 ? UI.kv('EV 보조금', U.money(U.table(D.EV_INCENTIVE[R.id], y), false)) : null,
          h('div', { class: 'segbars' }, D.SEGMENTS.map((s, i) => h('div', {}, h('span', {}, s.name), UI.bar(share[i], .5), h('b', {}, U.pct(share[i], 0))))));
      })),
      h('div', { class: 'cols2' },
        card('규제 일정', UI.table([{ k: 'n', t: '규제', f: m => m.name }, ...D.REGIONS.map(R => ({ k: R.id, t: R.name, num: 1, f: m => h('span', { class: y >= m.at[R.id] ? 'on' : 'mut' }, m.at[R.id]) }))], D.MANDATES, { dense: 1 })),
        card('역사적 사건', h('ul', { class: 'log' }, D.EVENTS.map(e => h('li', { class: y >= e.y ? (y < e.y + e.len / 12 ? 'bad' : '') : 'mut' }, h('time', {}, S.ym(e.y)), e.name)))))
    );
  };

  UI.screens.press = g => {
    const reviewed = g.cars.filter(c => c.reviews);
    return h('div', { class: 'center wide' },
      h('div', { class: 'dochead' }, h('div', { class: 'dt' }, '언론 · 평가')),
      reviewed.length ? reviewed.map(c => card(`${c.name} — 평균 ${c.reviewAvg.toFixed(1)} · NCAP ${'★'.repeat(c.stars || 0)}`, h('div', { class: 'reviews' }, c.reviews.map(rv => h('article', { class: 'rv' }, h('header', {}, h('b', {}, rv.mag), h('strong', {}, rv.score.toFixed(1))), h('p', {}, rv.line), h('small', {}, '장점 · ' + rv.pros.join(', ')), h('small', {}, '단점 · ' + rv.cons.join(', ')), rv.comparison ? h('small', { class: 'cmpres' }, `비교 테스트 ${rv.comparison.of}대 중 ${rv.comparison.rank}위 — ${rv.comparison.field.join(' / ')}`) : null))))) : card('', h('p', { class: 'mut' }, '출시한 차가 없습니다. 출시하면 세 매체가 평가하고 같은 세그먼트 경쟁차와 비교 테스트를 합니다.')),
      h('div', { class: 'cols2' },
        card('올해의 차', g.awards.length ? UI.table([{ k: 'y', t: '연도', num: 1 }, { k: 'name', t: '수상', f: a => h('span', { class: a.me ? 'me' : '' }, a.name) }, { k: 'field', t: '후보', num: 1 }], g.awards, { dense: 1 }) : h('p', { class: 'mut' }, '매년 12월, 그해 출시된 모든 차(경쟁사 포함) 가운데 언론 평균이 가장 높은 차가 선정됩니다.')),
        card('신뢰성 조사', g.surveys.length ? h('div', {}, h('p', { class: 'note' }, g.surveys[0].y + '년'), UI.table([{ k: 'i', t: '순위', num: 1, f: (b) => g.surveys[0].rank.indexOf(b) + 1 }, { k: 'name', t: '브랜드', f: b => h('span', { class: b.me ? 'me' : '' }, b.name) }, { k: 'v', t: '점수', num: 1 }], g.surveys[0].rank, { dense: 1 })) : h('p', { class: 'mut' }, '1980년부터 매년 브랜드 신뢰성 순위가 발표됩니다.'))));
  };

  UI.screens.finance = g => {
    const bs = S.balance(g), hist = g.hist, yr = Math.floor(g.t - 1 / 24);
    const sumYear = y => { const s = {}; for (const r of hist.filter(x => Math.floor(x.t + 1e-6) === y)) for (const k in r.L) s[k] = (s[k] || 0) + r.L[k]; return s; };
    const A = sumYear(yr), B = sumYear(yr - 1);
    const gp = y => (y.rev || 0) - (y.cogs || 0) - (y.tariff || 0);
    const rows = [['rev', '매출 (딜러 마진 차감 후)'], ['cogs', '매출원가 (부품·노무)', 1], ['tariff', '관세·운송', 1], ['gp', '매출총이익', 0, 1], ['rd', '연구개발', 1], ['tooling', '금형·지그', 1], ['staff', '인건비 (엔지니어·관리)', 1], ['mkt', '마케팅·딜러 지원', 1], ['fac', '공장 유지', 1], ['dep', '감가상각', 1], ['hold', '재고 유지', 1], ['recall', '리콜·보증', 1], ['fines', '연비·CO₂ 벌금', 1], ['int', '이자', 1], ['tax', '법인세', 1], ['net', '당기순이익', 0, 1]];
    const val = (Y, k, neg) => k === 'gp' ? gp(Y) : (neg ? -1 : 1) * (Y[k] || 0);
    const limit = S.creditLimit(g), rate = S.loanRate(g);
    const amt = h('input', { class: 'in num', type: 'number', id: 'loan-amt', value: Math.round(Math.min(limit, 1e6 * D.cpi(g.t)) / 1000) * 1000, step: 10000 });
    const ipoWhy = S.ipoCheck(g);
    return h('div', { class: 'center wide' },
      h('div', { class: 'dochead' }, h('div', { class: 'dt' }, '재무')),
      h('div', { class: 'cols2' },
        card(`손익계산서 — ${yr}년 / ${yr - 1}년`, h('div', { class: 'tw' }, h('table', { class: 'tb fin' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', { class: 'n' }, yr), h('th', { class: 'n' }, yr - 1))), h('tbody', {}, rows.map(([k, nm, neg, sum]) => h('tr', { class: sum ? 'sum' : '' }, h('td', {}, nm), h('td', { class: 'n' }, U.money(val(A, k, neg))), h('td', { class: 'n mut' }, U.money(val(B, k, neg))))))))),
        h('div', {},
          card('재무상태표', UI.kv('현금', U.money(bs.cash)), UI.kv('재고자산', U.money(bs.inv)), UI.kv('유형자산 (순장부가)', U.money(bs.ppe)), UI.kv('자산 총계', U.money(bs.assets), 'sum'), UI.kv('차입금', U.money(bs.debt)), UI.kv('자기자본', U.money(bs.equity), 'sum')),
          card('은행 차입', UI.kv('신용 한도', U.money(limit)), UI.kv(`금리 (프라임 ${U.table(D.PRIME, g.t).toFixed(2)}% + 가산)`, rate.toFixed(2) + '%'), h('div', { class: 'row' }, amt, UI.btn('대출 실행', () => UI.err(S.borrow(g, +amt.value)) && UI.render(), 'pri')),
            g.loans.length ? UI.table([{ k: 't', t: '실행', f: l => S.ym(l.t) }, { k: 'p', t: '잔액', num: 1, f: l => U.money(l.principal) }, { k: 'r', t: '금리', num: 1, f: l => l.rate.toFixed(2) + '%' }, { k: 'pay', t: '월 상환', num: 1, f: l => U.money(l.pay) }, { k: 'x', t: '', f: l => UI.btn('상환', () => UI.err(S.repay(g, l)) && UI.render(), 'ghost sm') }], g.loans, { dense: 1 }) : null))),
      h('div', { class: 'cols2' },
        card('주식 · 자본시장',
          UI.kv('상태', g.shares.public ? `상장 (${S.ym(g.shares.ipoT)})` : '비상장'), UI.kv('발행 주식', U.num(g.shares.out)), UI.kv(g.shares.public ? '주가' : '주당 가치 (추정)', '$' + g.shares.price.toFixed(2)), UI.kv('시가총액', U.money(g.shares.price * g.shares.out)), UI.kv('업종 PER', U.table(D.PE, g.t).toFixed(1)),
          UI.prop('배당 성향', UI.range(Math.round(g.shares.payout * 100), 0, 60, 5, v => { g.shares.payout = v / 100; }, v => v + '%')),
          h('div', { class: 'row wrap' }, !g.shares.public ? UI.btn('기업공개 (IPO)', () => UI.err(S.ipo(g)) && UI.render(), ipoWhy ? 'ghost' : 'pri', { title: ipoWhy || '' }) : null, g.shares.public ? UI.btn('유상증자 10%', () => UI.err(S.issueShares(g, .1)) && UI.render(), 'ghost') : null, g.shares.public ? UI.btn('자사주 매입 (현금 10%)', () => UI.err(S.buyback(g, g.cash * .1)) && UI.render(), 'ghost') : null),
          ipoWhy && !g.shares.public ? h('p', { class: 'note' }, 'IPO 조건: ' + ipoWhy) : null),
        card('자기자본 · 주가 추이', UI.chart([{ data: hist.slice(-240).map(x => x.equity), color: '#1f5fbf', area: 1, name: '자기자본' }], { fmt: v => U.money(v), legend: 1 })))
    );
  };
})(window.MW);
