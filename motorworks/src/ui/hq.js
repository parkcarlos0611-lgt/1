// HQ dashboard, finance statements, market & competition screens.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim, UI = MW.ui, h = U.h;
  const sec = (title, ...kids) => h('section', { class: 'panel' }, h('h3', {}, title), ...kids);

  // guided first steps
  const checklist = G => {
    const steps = [
      ['엔진 개발 착수', G.engines.some(e => e.status), 'engine'],
      ['차량 개발 착수', G.cars.some(c => c.status), 'car'],
      ['공장 건설', G.factories.length > 0, 'factory'],
      ['딜러 모집', Object.values(G.dealers).some(d => d.count > 0), 'sales'],
      ['가격 책정 + 판매 지역 선택', G.cars.some(c => c.price > 0), 'sales'],
      ['개발 완료 차량을 공장 라인에 배정', G.factories.some(f => f.lines.some(l => l.modelId)), 'factory']
    ];
    if (steps.every(s => s[1])) return null;
    return sec('시작 가이드', h('ol', { class: 'steps' }, steps.map(([t, ok, tab]) => h('li', { class: ok ? 'ok' : '' }, h('button', { class: 'lnk', onclick: () => UI.go(tab) }, t)))),
      h('p', { class: 'mut' }, '개발 프로젝트는 엔지니어 인력을 나눠 씁니다. 공장은 착공 후 12개월 뒤 가동됩니다. 개발과 공장 건설을 동시에 진행하세요.'));
  };

  UI.screens.hq = G => {
    const bs = S.balance(G), L = G.lastL || {};
    const hist = G.hist.slice(-120);
    const prod = G.cars.filter(c => c.status === 'production');
    const dev = [...G.engines.filter(e => e.status === 'dev'), ...G.cars.filter(c => c.status === 'dev')];
    const need = U.sum(dev.map(p => p.dev.need));
    return h('div', { class: 'grid hq' },
      h('div', { class: 'col' },
        h('div', { class: 'tiles' },
          h('div', { class: 'tile' }, h('small', {}, '자기자본'), h('b', {}, U.money(bs.equity)), h('i', {}, '부채 ' + U.money(bs.debt))),
          h('div', { class: 'tile' }, h('small', {}, '지난달 매출'), h('b', {}, U.money(L.rev || 0)), h('i', {}, U.num(L.units || 0) + '대 판매')),
          h('div', { class: 'tile' }, h('small', {}, '지난달 순이익'), h('b', { class: (L.net || 0) < 0 ? 'neg' : 'pos' }, U.money(L.net || 0)), h('i', {}, '생산 ' + U.num(L.prod || 0) + '대')),
          h('div', { class: 'tile' }, h('small', {}, '브랜드 평판'), h('b', {}, Math.round(G.rep)), h('i', {}, '북미 인지도 ' + Math.round(G.aware.na) + '%'))),
        checklist(G),
        sec('현금 · 월 매출 (최근 10년)', UI.chart([{ data: hist.map(x => x.cash), color: '#d9a441', area: 1 }, { data: hist.map(x => x.rev), color: '#6aa3d8' }], { fmt: v => U.money(v), labels: hist.length ? [S.ym(hist[0].t), S.ym(hist[hist.length - 1].t)] : null })),
        sec('개발 중 프로젝트 ' + (dev.length ? `(엔지니어 ${G.eng}/${need} 필요 · 속도 ${Math.round(Math.min(1, G.eng / Math.max(1, need)) * 100)}%)` : ''),
          dev.length ? dev.map(p => h('div', { class: 'proj' }, h('span', {}, (p.body ? '차량 · ' : '엔진 · ') + p.name), UI.bar(p.dev.done, p.dev.months), h('b', {}, Math.max(0, Math.ceil(p.dev.months - p.dev.done)) + '개월 남음'))) : h('p', { class: 'mut' }, '진행 중인 프로젝트가 없습니다.'),
          h('div', { class: 'row' }, h('span', { class: 'mut' }, `엔지니어 ${G.eng}명 · 월 ${U.money(G.eng * D.ENG_SALARY * D.cpi(G.t))}`), h('button', { class: 'btn sm', onclick: () => { G.eng += 10; UI.render(); } }, '+10명 채용'), h('button', { class: 'btn sm ghost', onclick: () => { G.eng = Math.max(5, G.eng - 10); UI.render(); } }, '−10명'))),
        sec('생산 모델', prod.length ? h('table', { class: 'tbl' }, h('tr', {}, ['모델', '가격', '원가', '지난달 판매', '수요', '재고', '평점'].map(x => h('th', {}, x))),
          prod.map(c => h('tr', {}, h('td', {}, c.name), h('td', {}, U.money(c.price, false)), h('td', {}, U.money(c.unitCost || 0, false)), h('td', {}, U.num(c.lastSales || 0)), h('td', {}, U.num(c.lastDemand || 0)), h('td', {}, U.num(G.inventory[c.id]?.units || 0)), h('td', {}, c.reviewAvg ? c.reviewAvg.toFixed(1) : '–'))))
          : h('p', { class: 'mut' }, '아직 생산 중인 모델이 없습니다.'))),
      h('div', { class: 'col' }, sec('사내 소식', h('ul', { class: 'log' }, G.log.slice(0, 60).map(l => h('li', { class: l.kind }, h('time', {}, S.ym(l.t)), l.msg)))))
    );
  };

  UI.screens.finance = G => {
    const bs = S.balance(G), hist = G.hist;
    const yr = Math.floor(G.t - 1 / 24);
    const sumYear = y => { const rows = hist.filter(x => Math.floor(x.t + 1e-6) === y); const s = {}; for (const r of rows) for (const k in r.L) s[k] = (s[k] || 0) + r.L[k]; return s; };
    const A = sumYear(yr), B = sumYear(yr - 1);
    const line = (k, nm, neg) => h('tr', {}, h('td', {}, nm), h('td', {}, U.money((neg ? -1 : 1) * (A[k] || 0))), h('td', { class: 'mut' }, U.money((neg ? -1 : 1) * (B[k] || 0))));
    const gp = y => (y.rev || 0) - (y.cogs || 0) - (y.tariff || 0);
    const limit = S.creditLimit(G), rate = S.loanRate(G);
    const amt = h('input', { class: 'inp', type: 'number', id: 'loan-amt', value: Math.round(Math.min(limit, 1e6 * D.cpi(G.t)) / 1000) * 1000, step: 10000 });
    return h('div', { class: 'grid two' },
      sec('손익계산서 (' + yr + '년 누계 / 전년)', h('table', { class: 'tbl fin' },
        h('tr', {}, h('th', {}, ''), h('th', {}, yr + ''), h('th', {}, (yr - 1) + '')),
        line('rev', '매출 (딜러 마진 차감 후)'), line('cogs', '매출원가 (부품+노무)', 1), line('tariff', '관세·운송', 1),
        h('tr', { class: 'sum' }, h('td', {}, '매출총이익'), h('td', {}, U.money(gp(A))), h('td', { class: 'mut' }, U.money(gp(B)))),
        line('rd', '연구개발비', 1), line('tooling', '금형·지그', 1), line('staff', '인건비 (엔지니어·관리직)', 1), line('mkt', '마케팅·딜러 지원', 1), line('fac', '공장 유지비', 1), line('dep', '감가상각', 1), line('hold', '재고 유지비', 1), line('recall', '리콜·보증', 1), line('int', '이자비용', 1), line('tax', '법인세', 1),
        h('tr', { class: 'sum' }, h('td', {}, '당기순이익'), h('td', {}, U.money(A.net || 0)), h('td', { class: 'mut' }, U.money(B.net || 0))))),
      h('div', { class: 'col' },
        sec('재무상태표', UI.kv('현금', U.money(bs.cash)), UI.kv('재고자산', U.money(bs.inv)), UI.kv('유형자산 (공장, 순장부가)', U.money(bs.ppe)), UI.kv('자산 총계', U.money(bs.assets), 'sum'), UI.kv('차입금', U.money(bs.debt)), UI.kv('자기자본', U.money(bs.equity), 'sum')),
        sec('은행 차입', UI.kv('신용 한도', U.money(limit)), UI.kv('적용 금리 (프라임 ' + U.table(D.PRIME, G.t).toFixed(2) + '% + 가산)', rate.toFixed(2) + '%'),
          h('div', { class: 'row' }, amt, h('button', { class: 'btn', onclick: () => UI.err(S.borrow(G, +amt.value)) && UI.render() }, '대출 실행')),
          G.loans.length ? h('table', { class: 'tbl' }, h('tr', {}, ['실행', '잔액', '금리', '월 상환', ''].map(x => h('th', {}, x))), G.loans.map(l => h('tr', {}, h('td', {}, S.ym(l.t)), h('td', {}, U.money(l.principal)), h('td', {}, l.rate.toFixed(2) + '%'), h('td', {}, U.money(l.pay)), h('td', {}, h('button', { class: 'btn sm ghost', onclick: () => UI.err(S.repay(G, l)) && UI.render() }, '상환'))))) : h('p', { class: 'mut' }, '대출 없음')),
        sec('자기자본 추이', UI.chart([{ data: hist.slice(-240).map(x => x.equity), color: '#d9a441', area: 1 }], { fmt: v => U.money(v) })))
    );
  };

  UI.screens.market = G => {
    const mk = G.lastMarket, y = G.t;
    const regionCards = D.REGIONS.map(R => {
      const share = D.segShare(y, R.id), total = U.table(R.market, y);
      const mine = U.sum(G.cars.map(c => (c.regDemand || {})[R.id] || 0)) * 12 / 1e6;
      return h('div', { class: 'rc' }, h('h4', {}, R.name), UI.kv('연간 신차 시장', total.toFixed(1) + 'M대'), UI.kv('중위 가구소득', U.money(D.income(y, R))), UI.kv('휘발유 (갤런)', '$' + (U.table(D.FUEL, y) * R.fuelTax).toFixed(2)), UI.kv('수입 관세', U.pct(U.table(R.tariff, y), 0)), UI.kv('배출 기준', U.table(D.EMISSION_LIMIT[R.id], y) > 900 ? '없음' : U.table(D.EMISSION_LIMIT[R.id], y).toFixed(0)), UI.kv('우리 점유율', U.pct(mine / total, 2)),
        h('div', { class: 'segbars' }, D.SEGMENTS.map((s, i) => h('div', { title: s.name + ' ' + U.pct(share[i]) }, h('span', {}, s.name), UI.bar(share[i], .5), h('b', {}, U.pct(share[i], 0))))));
    });
    const mandates = D.MANDATES.map(m => h('tr', {}, h('td', {}, m.name), ...D.REGIONS.map(R => h('td', { class: y >= m.at[R.id] ? 'on' : 'mut' }, m.at[R.id]))));
    const rivals = G.rivals.filter(r => G.t >= r.from).map(r => h('tr', {}, h('td', {}, h('i', { class: 'dot', style: { background: r.color } }), r.name), h('td', {}, D.REGIONS.find(x => x.id === r.home).name), h('td', {}, U.num(r.sales * 12)), h('td', {}, r.models.map(m => D.SEGMENTS.find(s => s.id === m.seg).name).join(', '))));
    return h('div', { class: 'col' },
      h('div', { class: 'rcs' }, regionCards),
      h('div', { class: 'grid two' },
        sec('경쟁사 (연환산 판매)', h('table', { class: 'tbl' }, h('tr', {}, ['회사', '본거지', '판매/년', '라인업'].map(x => h('th', {}, x))), rivals)),
        sec('규제 일정 (연도)', h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, '규제'), ...D.REGIONS.map(R => h('th', {}, R.name))), mandates))),
      sec('역사적 사건', h('ul', { class: 'log' }, D.EVENTS.map(e => h('li', { class: y >= e.y ? (y < e.y + e.len / 12 ? 'bad' : '') : 'mut' }, h('time', {}, S.ym(e.y)), e.name))))
    );
  };
})(window.MW);
