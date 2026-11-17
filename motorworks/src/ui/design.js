// Design workspaces: platform, engine, car.
(function (MW) {
  const U = MW.U, D = MW.data, E = D.E, C = D.C, S = MW.sim, R = MW.render, UI = MW.ui, h = U.h;
  const G = () => UI.G();
  const readImage = (file, max, cb) => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', .86)); }; im.src = fr.result; }; fr.readAsDataURL(file); };
  const head = (title, obj, actions, sub) => h('div', { class: 'dochead' }, h('div', { class: 'dt' }, title, obj ? UI.statusChip(obj) : null, sub ? h('small', {}, sub) : null), h('div', { class: 'row' }, ...actions));
  const nameInput = (o, id, locked) => h('input', { class: 'in name', id, value: o.name, disabled: locked, 'aria-label': '이름', oninput: ev => { o.name = ev.target.value; } });
  const pick = (list, key) => { const s = UI.state.sel[key]; return list.find(o => o.id === s) || list[0]; };

  UI.newPlatform = () => { const g = G(); const p = S.defaultPlatform(Math.floor(g.t)); g.platforms.push(p); UI.go('platform', { platform: p.id }); };
  UI.newEngine = () => { const g = G(); const e = S.defaultEngine(Math.floor(g.t)); e.name = '신형 엔진 ' + (g.engines.length + 1); S.fixEngine(e, g.t); g.engines.push(e); UI.go('engine', { engine: e.id }); };
  UI.newCar = () => { const g = G(); const pf = g.platforms.find(p => p.status) || g.platforms[0]; const e = g.engines.find(x => x.status) || g.engines[0]; const c = S.defaultCar(Math.floor(g.t), e?.id); c.name = '신형 모델 ' + (g.cars.length + 1); c.segment = 'family'; c.regions = ['na']; c.price = 0; c.platformId = pf?.id; g.cars.push(c); UI.go('car', { car: c.id }); };
  const clone = (list, o, ws, key, rename) => { const n = U.deep(o); n.id = U.uid(key); n.name = o.name + rename; for (const k of ['status', 'dev', 'readyT', 'launchT', 'sold', 'reviews', 'reviewAvg', 'salesHist', 'lastSales', 'lastDemand', 'built', 'units', 'acquiredFrom', 'inherited']) delete n[k]; list.push(n); UI.go(ws, { [key]: n.id }); };
  const remove = (list, o, ws, key) => { const i = list.indexOf(o); if (i >= 0 && !o.status) { list.splice(i, 1); UI.state.sel[key] = null; UI.render(false); } };

  // ── PLATFORM ───────────────────────────────────────────────────────
  UI.screens.platform = g => {
    const pf = pick(g.platforms, 'platform'); if (!pf) return h('div', { class: 'empty' }, UI.btn('새 플랫폼', UI.newPlatform, 'pri'));
    const locked = !!pf.status, y = locked ? pf.year : g.t;
    const E = S.evalPlatform(pf, y);
    const set = (k, v) => { if (locked) return; pf[k] = v; UI.render(); };
    const cars = g.cars.filter(c => c.platformId === pf.id);
    const diagram = UI.canvas('vp short', (x, W, H) => {
      R.studio(x, W, H, H, { sky0: '#f4f5f6', sky1: '#e6e8eb', floor0: '#fff', floor1: '#fff' });
      const L = pf.wbMax + 1900, sc = Math.min((W - 60) / L, (H - 96) / (pf.wMax + 200)), ox = (W - L * sc) / 2 + 900 * sc, cy = 34 + (pf.wMax + 200) * sc / 2;
      const X = mm => ox + mm * sc, Y = mm => cy + mm * sc;
      x.strokeStyle = '#8a9099'; x.lineWidth = 1.2; x.setLineDash([]);
      const ladder = pf.chassis === 'ladder';
      x.fillStyle = ladder ? 'rgba(60,64,70,.18)' : 'rgba(31,95,191,.08)';
      x.beginPath(); x.roundRect(X(-800), Y(-pf.wMax * .42), (pf.wbMax + 1600) * sc, pf.wMax * .84 * sc, 40 * sc); x.fill(); x.stroke();
      if (ladder) { x.fillStyle = '#5b6068'; for (const sg of [-1, 1]) x.fillRect(X(-750), Y(sg * pf.wMax * .3 - 40), (pf.wbMax + 1500) * sc, 80 * sc); for (const xm of [-500, 400, pf.wbMin * .5, pf.wbMin, pf.wbMax + 500]) x.fillRect(X(xm), Y(-pf.wMax * .3), 70 * sc, pf.wMax * .6 * sc); }
      if (pf.ev) { x.fillStyle = 'rgba(46,125,91,.25)'; x.fillRect(X(250), Y(-pf.wMin * .38), (pf.wbMin - 500) * sc, pf.wMin * .76 * sc); x.fillStyle = '#2e7d5b'; x.font = '11px "IBM Plex Sans KR"'; x.fillText('배터리 팩 (바닥)', X(300), Y(0)); }
      x.fillStyle = 'rgba(179,38,30,.12)'; x.strokeStyle = '#b3261e'; const bay0 = pf.drive === 'MR' ? pf.wbMin * .55 : pf.drive === 'RR' ? pf.wbMax + 100 : -pf.bayLen + 300;
      if (!pf.ev) { x.beginPath(); x.rect(X(bay0), Y(-320), pf.bayLen * sc, 640 * sc); x.fill(); x.stroke(); x.fillStyle = '#b3261e'; x.font = '11px "IBM Plex Sans KR"'; x.fillText(`엔진룸 ${pf.bayLen}mm`, X(bay0) + 4, Y(-330)); }
      // wheels at min & max wheelbase
      for (const [wb, a] of [[pf.wbMin, 1], [pf.wbMax, .35]]) for (const xm of [0, wb]) for (const sg of [-1, 1]) { x.fillStyle = `rgba(20,22,25,${a})`; x.fillRect(X(xm - 330), Y(sg * pf.wMin * .5 - (sg > 0 ? 0 : 220)), 660 * sc, 220 * sc); }
      // dimension lines
      const dim = (x0, x1, yy, label) => { x.strokeStyle = '#1f5fbf'; x.fillStyle = '#1f5fbf'; x.lineWidth = 1; x.beginPath(); x.moveTo(X(x0), yy); x.lineTo(X(x1), yy); x.stroke(); for (const xx of [x0, x1]) { x.beginPath(); x.moveTo(X(xx), yy - 5); x.lineTo(X(xx), yy + 5); x.stroke(); } x.font = '11px "IBM Plex Mono"'; x.fillText(label, (X(x0) + X(x1)) / 2 - 40, yy - 6); };
      dim(0, pf.wbMin, Y(pf.wMax * .5) + 20, `휠베이스 ${pf.wbMin}`); dim(0, pf.wbMax, Y(pf.wMax * .5) + 40, `최대 ${pf.wbMax} mm`);
      x.fillStyle = '#3b4048'; x.font = '11px "IBM Plex Sans KR"';
      x.fillText(`앞 ${D.byId(C.suspF, pf.suspF).name}  ·  뒤 ${D.byId(C.suspR, pf.suspR).name}  ·  ${D.byId(C.drive, pf.drive).name}  ·  전폭 ${pf.wMin}–${pf.wMax} mm`, 10, 16);
    });
    const grp = (t, ...k) => h('fieldset', { disabled: locked }, UI.group(t, ...k));
    return h('div', { class: 'split' },
      h('section', { class: 'center' },
        head(nameInput(pf, 'pf-name', locked), pf, [
          !locked ? UI.btn(`개발 착수 · ${E.devMonths}개월 · ${U.money(S.nominal(g, E.devCost))}`, () => UI.err(S.startPlatformDev(g, pf)) && UI.render(), 'pri') : null,
          UI.btn('복제', () => clone(g.platforms, pf, 'platform', 'platform', ' 개량'), 'ghost'), !locked ? UI.btn('삭제', () => remove(g.platforms, pf, 'platform', 'platform'), 'ghost') : null], pf.inherited ? '회사 설립 시 보유한 전쟁 전 섀시' : pf.status === 'dev' ? `개발 ${Math.floor(pf.dev.done)}/${pf.dev.months}개월` : ''),
        h('div', { class: 'card' }, diagram),
        h('div', { class: 'kpis' }, UI.kpi('개발비', U.money(S.nominal(g, E.devCost))), UI.kpi('개발 기간', E.devMonths + '개월'), UI.kpi('공장당 하부 금형·지그', U.money(S.nominal(g, E.tooling))), UI.kpi('누적 생산', U.num(pf.units || 0) + '대', `학습곡선 부품비 ×${S.platformLearning(pf).toFixed(3)}`)),
        h('div', { class: 'card' }, h('h3', {}, '이 플랫폼의 차량'), cars.length ? UI.table([{ k: 'name', t: '모델' }, { k: 'wb', t: '휠베이스', num: 1, v: c => c.body.wb, f: c => c.body.wb + ' mm' }, { k: 'st', t: '상태', f: c => UI.statusChip(c) }, { k: 'fit', t: '범위', f: c => S.carFitsPlatform(c, pf) ? '적합' : UI.chip('범위 밖', 'bad') }], cars, { onRow: c => UI.go('car', { car: c.id }) }) : h('p', { class: 'mut' }, '아직 없습니다. 차량 설계에서 이 플랫폼을 선택하세요.'),
          h('p', { class: 'note' }, '개발이 끝난 플랫폼 위에 만드는 차는 상부(톱햇)만 새로 개발합니다: 개발비 55%, 개발 기간 70%, 차체 금형 60%. 같은 공장에서 같은 플랫폼 모델끼리는 하부 금형을 공유하고, 플랫폼 누적 생산량이 두 배가 될 때마다 부품비가 약 5% 내려갑니다.')),
        E.issues.length ? h('div', { class: 'card warnbox' }, E.issues.map(i => h('p', {}, i))) : null),
      h('aside', { class: 'insp' },
        grp('레이아웃', UI.prop('구동 방식', UI.sel(C.drive, pf.drive, y, v => set('drive', v))), UI.prop('프레임', UI.sel(C.chassis, pf.chassis, y, v => set('chassis', v))),
          UI.prop('EV 전용 스케이트보드', h('input', { type: 'checkbox', checked: !!pf.ev, disabled: g.t < 2008, onchange: ev => set('ev', ev.target.checked) }), '2008~')),
        grp('서스펜션', UI.prop('앞', UI.sel(C.suspF, pf.suspF, y, v => set('suspF', v))), UI.prop('뒤', UI.sel(C.suspR, pf.suspR, y, v => set('suspR', v)))),
        grp('치수 범위', UI.prop('휠베이스 최소', UI.range(pf.wbMin, 2000, 3600, 10, v => { pf.wbMin = v; }, v => v + ' mm', { disabled: locked })), UI.prop('휠베이스 최대', UI.range(pf.wbMax, 2100, 3800, 10, v => { pf.wbMax = v; }, v => v + ' mm', { disabled: locked })),
          UI.prop('전폭 최소', UI.range(pf.wMin, 1400, 2100, 10, v => { pf.wMin = v; }, v => v + ' mm', { disabled: locked })), UI.prop('전폭 최대', UI.range(pf.wMax, 1500, 2200, 10, v => { pf.wMax = v; }, v => v + ' mm', { disabled: locked })),
          UI.prop('엔진룸 길이', UI.range(pf.bayLen, 500, 1500, 10, v => { pf.bayLen = v; }, v => v + ' mm', { disabled: locked })), h('p', { class: 'note' }, '범위가 넓을수록 여러 차종을 얹을 수 있지만 개발비가 늘어납니다. 값 변경 후 다른 곳을 누르면 비용이 다시 계산됩니다.')),
        grp('품질', UI.prop('설계 품질', UI.range(pf.quality || 0, -5, 5, 1, v => { pf.quality = v; }, v => v, { disabled: locked }))))
    );
  };

  // ── ENGINE ─────────────────────────────────────────────────────────
  UI.screens.engine = g => {
    const e = pick(g.engines, 'engine'); if (!e) return h('div', { class: 'empty' }, UI.btn('새 엔진', UI.newEngine, 'pri'));
    UI.state.sel.engine = e.id;
    const locked = !!e.status, y = locked ? (e.year || g.t) : g.t;
    let er = S.evalEngine(e, y);
    const stats = h('div', {}), curve = UI.canvas('curve', (x, W, H) => drawCurve(x, W, H, er));
    const set = (k, v, full) => { if (locked) return; e[k] = v; const iss = S.fixEngine(e, g.t); if (iss.length) UI.toast(iss[0], 'warn'); er = S.evalEngine(e, y); if (full) UI.render(); else fill(); };
    const fill = () => stats.replaceChildren(
      h('div', { class: 'kpis' }, UI.kpi('배기량', er.cc.toFixed(0) + ' cc', er.dispL.toFixed(2) + ' L · ' + e.layout + e.cyl), UI.kpi('최고출력', Math.round(er.peakHp) + ' hp', `@${er.peakHpRpm} rpm · ${Math.round(er.ps)} PS`), UI.kpi('최대토크', Math.round(er.peakTq) + ' Nm', `@${er.peakTqRpm} rpm`), UI.kpi('레드라인', er.redline + ' rpm', `기계적 한계 ${Math.round(er.rpmMax)}`), UI.kpi('중량', er.mass + ' kg', `${er.length}×${Math.round(er.width)}×${Math.round(er.height)} mm`), UI.kpi('신뢰성', Math.round(er.rel), '정숙성 ' + Math.round(er.smooth * 100))),
      h('div', { class: 'cols2' },
        h('div', {}, UI.kv('비출력', er.hpPerL.toFixed(1) + ' hp/L'), UI.kv('최저 BSFC', er.bsfc.toFixed(0) + ' g/kWh'), UI.kv('피스톤 평균속도', er.pistonSpeed.toFixed(1) + ' m/s'), UI.kv('시판 옥탄가 / 노킹 한계 CR', er.octane.toFixed(0) + ' RON / ' + er.knockCR.toFixed(1)), UI.kv('부스트', er.boostBar ? er.boostBar.toFixed(2) + ' bar · 스풀 ' + Math.round(er.spool) + ' rpm' : '—')),
        h('div', {}, UI.kv('배출가스 지수', er.emissions.toFixed(0)), UI.kv('생산원가', U.money(er.cost * D.cpi(g.t), false) + ' / 대'), UI.kv('조립 공수', er.hours.toFixed(1) + ' h'), UI.kv('개발', er.devMonths + '개월 · ' + U.money(er.devCost * D.cpi(g.t))), UI.kv('지역별 배출 기준', D.REGIONS.map(R => `${R.name} ${U.table(D.EMISSION_LIMIT[R.id], g.t) > 900 ? '—' : U.table(D.EMISSION_LIMIT[R.id], g.t).toFixed(0)}`).join(' · ')))),
      er.warnings.map(w => h('p', { class: 'warn' }, w)));
    fill();
    const front = UI.canvas('vp eng', (x, W, H) => { R.studio(x, W, H, H, UI.STUDIO); const sc = Math.min(W / (er.width * 1.25), H / (er.height * 1.3)); R.drawEngineFront(x, e, er, { x: W / 2, y: H * .66, scale: sc, crank: UI.state.anim * (e.rpmView ?? 4) }); });
    const side = UI.canvas('vp eng', (x, W, H) => { R.studio(x, W, H, H, UI.STUDIO); const sc = Math.min(W / (er.length * 1.5), H / (er.height * 1.3)); R.drawEngineSide(x, e, er, { x: W / 2, y: H * .78, scale: sc, crank: UI.state.anim * (e.rpmView ?? 4), cutaway: e.cutaway }); });
    const L = D.byId(E.layouts, e.layout);
    const grp = (t, ...k) => h('fieldset', { disabled: locked }, UI.group(t, ...k));
    const segUp = h('input', { type: 'file', accept: 'image/*', id: 'eng-tex', onchange: ev => { const f = ev.target.files[0]; if (f) readImage(f, 240, url => { e.customSeg = url; R.userImage(url, () => UI.render()); UI.render(); }); } });
    return h('div', { class: 'split' },
      h('section', { class: 'center' },
        head(nameInput(e, 'eng-name', locked), e, [
          !locked ? UI.btn(`개발 착수 · ${er.devMonths}개월 · ${U.money(er.devCost * D.cpi(g.t))}`, () => UI.err(S.startEngineDev(g, e)) && UI.render(), 'pri') : null,
          UI.btn('복제', () => clone(g.engines, e, 'engine', 'engine', ' 개량'), 'ghost'), !locked ? UI.btn('삭제', () => remove(g.engines, e, 'engine', 'engine'), 'ghost') : null], e.status === 'dev' ? `개발 ${Math.floor(e.dev.done)}/${e.dev.months}개월` : locked ? '설계 확정 — 수정하려면 복제' : ''),
        h('div', { class: 'vps two' }, h('figure', {}, front, h('figcaption', {}, '정면 단면 — 점화 순서대로 움직이는 피스톤')), h('figure', {}, side, h('figcaption', {}, '측면 — 1기통 블록 텍스처 × ' + er.perBank + (e.cutaway ? ' (컷어웨이)' : '')))),
        h('div', { class: 'toolrow' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!e.cutaway, onchange: ev => { e.cutaway = ev.target.checked; UI.render(); } }), '컷어웨이'),
          h('label', { class: 'chk' }, '회전', UI.range(e.rpmView ?? 4, 0, 30, 1, v => { e.rpmView = v; })),
          h('label', { class: 'chk file' }, '1기통 블록 텍스처', segUp), e.customSeg ? UI.btn('기본 텍스처로', () => { delete e.customSeg; UI.render(); }, 'ghost sm') : null),
        h('div', { class: 'card' }, h('h3', {}, '토크·출력 곡선', h('small', {}, ' 파랑 토크 · 주황 출력 · 점선 부스트')), curve),
        h('div', { class: 'card' }, stats)),
      h('aside', { class: 'insp' },
        grp('기본 구조', UI.prop('연료', UI.sel(E.fuelTypes, e.fuel, g.t, v => set('fuel', v, 1))), UI.prop('레이아웃', UI.sel(E.layouts, e.layout, g.t, v => set('layout', v, 1))),
          UI.prop('기통 수', UI.sel(L.cyls.map(n => ({ id: n, name: n + '기통' })), e.cyl, null, v => set('cyl', v, 1))),
          e.layout === 'V' || e.layout === 'W' ? UI.prop('뱅크각', UI.sel((L.angles || [60]).map(a => ({ id: a, name: a + '°' })), e.vAngle, null, v => set('vAngle', v, 1))) : null,
          UI.prop('보어', UI.range(e.bore, 50, 140, .5, v => set('bore', v), v => v + ' mm')), UI.prop('스트로크', UI.range(e.stroke, 45, 140, .5, v => set('stroke', v), v => v + ' mm')),
          UI.prop('블록 재질', UI.sel(E.blockMat, e.blockMat, g.t, v => set('blockMat', v, 1))), UI.prop('헤드 재질', UI.sel(E.headMat, e.headMat, g.t, v => set('headMat', v, 1))),
          UI.prop('밸런스 샤프트', h('input', { type: 'checkbox', checked: e.balanceShaft, onchange: ev => set('balanceShaft', ev.target.checked) }))),
        grp('밸브트레인', UI.prop('헤드 형식', UI.sel(E.heads, e.head, g.t, v => set('head', v, 1))), UI.prop('기통당 밸브', UI.sel(E.valves, e.valves, g.t, v => set('valves', v, 1), { filter: o => D.byId(E.heads, e.head).valves.includes(o.id) })),
          UI.prop('가변 밸브', UI.sel(E.vvt, e.vvt, g.t, v => set('vvt', v, 1))), UI.prop('캠 프로파일', UI.range(e.cam, 0, 100, 1, v => set('cam', v), v => v < 35 ? '저속형 ' + v : v > 65 ? '고속형 ' + v : v)), UI.prop('레드라인', UI.range(e.redline, 0, 12000, 100, v => set('redline', v), v => v ? v + ' rpm' : '자동'))),
        grp('보텀엔드', UI.prop('크랭크샤프트', UI.sel(E.crank, e.crank, g.t, v => set('crank', v, 1))), UI.prop('커넥팅로드', UI.sel(E.rods, e.rods, g.t, v => set('rods', v, 1))), UI.prop('피스톤', UI.sel(E.pistons, e.pistons, g.t, v => set('pistons', v, 1))),
          UI.prop('압축비', UI.range(e.compression, e.fuel === 'diesel' ? 14 : 5.5, e.fuel === 'diesel' ? 24 : 14.5, .1, v => set('compression', v), v => v.toFixed(1) + ':1'))),
        grp('흡기·연료', UI.prop('연료 공급', UI.sel(E.fuelSys, e.fuelSys, g.t, v => set('fuelSys', v, 1), { filter: o => o.fuel === e.fuel })), UI.prop('공연비', UI.range(e.mixture, 0, 100, 1, v => set('mixture', v), v => v < 40 ? '농후 ' + v : v > 60 ? '희박 ' + v : v)),
          UI.prop('과급', UI.sel(E.asp, e.asp, g.t, v => set('asp', v, 1))), e.asp !== 'na' ? UI.prop('부스트', UI.range(e.boost, 2, 30, .5, v => set('boost', v), v => v + ' psi')) : null,
          e.asp !== 'na' ? UI.prop('인터쿨러', h('input', { type: 'checkbox', checked: e.intercooler, disabled: g.t < 1977, onchange: ev => set('intercooler', ev.target.checked) }), g.t < 1977 ? '1977~' : '') : null),
        grp('점화·배기', UI.prop('점화', UI.sel(E.ignition, e.ignition, g.t, v => set('ignition', v, 1))), UI.prop('배기 매니폴드', UI.sel(E.exhaust, e.exhaust, g.t, v => set('exhaust', v, 1))), UI.prop('촉매', UI.sel(E.cat, e.cat, g.t, v => set('cat', v, 1)))),
        grp('품질', UI.prop('설계 품질', UI.range(e.quality, -5, 5, 1, v => set('quality', v), v => (v > 0 ? '+' : '') + v))))
    );
  };
  const drawCurve = (x, W, H, er) => {
    const cs = getComputedStyle(document.documentElement), c = er.curve; if (!c.length) return;
    const L = 46, Rr = 46, T = 10, B = 22, mxT = Math.max(...c.map(p => p.tq)) * 1.15, mxP = Math.max(...c.map(p => p.hp)) * 1.15, mxR = er.redline + 500;
    const X = r => L + r / mxR * (W - L - Rr);
    x.strokeStyle = cs.getPropertyValue('--line'); x.fillStyle = cs.getPropertyValue('--mut'); x.font = '10px "IBM Plex Mono", monospace'; x.lineWidth = 1;
    for (let r = 0; r <= mxR; r += 1000) { x.beginPath(); x.moveTo(Math.round(X(r)) + .5, T); x.lineTo(Math.round(X(r)) + .5, H - B); x.stroke(); x.fillText(r / 1000 + 'k', X(r) - 6, H - 6); }
    x.fillStyle = 'rgba(179,38,30,.08)'; x.fillRect(X(er.redline), T, W - Rr - X(er.redline), H - T - B);
    const plot = (k, mx, col) => { x.beginPath(); c.forEach((p, i) => { const yy = T + (1 - p[k] / mx) * (H - T - B); i ? x.lineTo(X(p.rpm), yy) : x.moveTo(X(p.rpm), yy); }); x.strokeStyle = col; x.lineWidth = 2; x.stroke(); };
    plot('tq', mxT, '#1f5fbf'); plot('hp', mxP, '#c46a12');
    x.fillStyle = '#1f5fbf'; x.fillText(Math.round(mxT / 1.15) + ' Nm', 4, T + 10); x.fillStyle = '#c46a12'; x.fillText(Math.round(mxP / 1.15) + ' hp', W - Rr + 4, T + 10);
    if (er.boostBar) { x.beginPath(); c.forEach((p, i) => { const yy = T + (1 - p.boost / (er.boostBar * 1.6)) * (H - T - B); i ? x.lineTo(X(p.rpm), yy) : x.moveTo(X(p.rpm), yy); }); x.setLineDash([4, 4]); x.strokeStyle = cs.getPropertyValue('--mut'); x.lineWidth = 1; x.stroke(); x.setLineDash([]); }
  };

  // ── CAR ─────────────────────────────────────────────────────────────
  UI.screens.car = g => {
    const car = pick(g.cars, 'car'); if (!car) return h('div', { class: 'empty' }, UI.btn('새 차량', UI.newCar, 'pri'));
    UI.state.sel.car = car.id;
    const locked = !!car.status, y = locked ? car.year : g.t, b = car.body;
    let pair = S.evalPair(g, car, y);
    const analysis = h('div', {});
    // rival reference for comparison
    const rivalsSeg = g.rivals.filter(r => r.alive).flatMap(r => r.models.map(m => ({ r, m }))).filter(x => x.m.seg === (car.segment || 'family'));
    const refSel = UI.state.sel.ref && rivalsSeg.find(x => x.m.id === UI.state.sel.ref) || rivalsSeg.sort((a, b) => (b.m.last || 0) - (a.m.last || 0))[0];
    const recalc = () => { car._rev = (car._rev || 0) + 1; pair = S.evalPair(g, car, y); fill(); };
    const set = (path, v, full) => { if (locked) return; const ks = path.split('.'); let o = car; while (ks.length > 1) o = o[ks.shift()] = o[ks[0]] ?? {}; o[ks[0]] = v; car._rev = (car._rev || 0) + 1; if (full) UI.render(); else recalc(); };
    const fill = () => {
      if (!pair) { analysis.replaceChildren(h('p', { class: 'warn' }, '엔진 또는 파워트레인을 선택하세요')); return; }
      const { ev } = pair, r = ev.r, ref = refSel ? refSel.m.r : null;
      const inc = D.income(g.t, D.REGIONS[0]);
      const fit = D.SEGMENTS.map(sg => ({ sg, u: S.utility(r, S.priceScore(car.price || S.suggestPrice(g, car), sg.price * inc), sg, g.rep) })).sort((a, b) => b.u - a.u);
      analysis.replaceChildren(
        h('div', { class: 'kpis' },
          UI.kpi('0→100 km/h', ev.t100 > 90 ? '—' : ev.t100.toFixed(1) + ' s', '400 m ' + (ev.t400 ? ev.t400.toFixed(1) + ' s' : '—')),
          UI.kpi('최고속도', Math.round(ev.topSpeed) + ' km/h', ev.ratios.length + '단 · 최종 ' + ev.ratios[ev.ratios.length - 1].toFixed(2)),
          ev.pt === 'bev' ? UI.kpi('주행거리', Math.round(ev.range) + ' km', ev.kwh100.toFixed(1) + ' kWh/100km') : UI.kpi('복합 연비', ev.lpk.toFixed(1) + ' L/100km', ev.mpg.toFixed(1) + ' mpg · CO₂ ' + Math.round(ev.co2) + ' g/km'),
          UI.kpi('공차중량', ev.mass + ' kg', '후륜 하중 ' + Math.round(ev.rearFrac * 100) + '%'),
          UI.kpi('공기저항', 'Cd ' + ev.A.cd.toFixed(3), '전면적 ' + ev.A.frontal.toFixed(2) + ' m²'),
          UI.kpi('충돌 평가', '★'.repeat(ev.stars) + '☆'.repeat(5 - ev.stars), '제동 ' + ev.brake100.toFixed(1) + ' m · ' + ev.latG.toFixed(2) + ' g')),
        h('div', { class: 'cols2' },
          h('div', {}, h('h3', {}, '평가 (시대 기준)', refSel ? h('small', {}, ` 비교: ${refSel.m.name}`) : null), D.RATING_KEYS.map(k => UI.ratingRow(k, r[k], ref ? ref[k] : null)),
            rivalsSeg.length ? UI.prop('비교 대상', UI.sel(rivalsSeg.map(x => ({ id: x.m.id, name: `${x.m.name} (${x.r.name})` })), refSel?.m.id, null, v => { UI.state.sel.ref = v; UI.render(); })) : null),
          h('div', {}, h('h3', {}, '세그먼트 적합도'), h('div', { class: 'fit' }, fit.slice(0, 5).map((f, i) => h('div', { class: i ? '' : 'top' }, h('span', {}, f.sg.name), UI.bar(f.u, 80), h('b', {}, f.u.toFixed(0))))),
            h('h3', {}, '원가·개발'), UI.kv('부품원가 (현재 물가)', U.money(ev.partsCost * D.cpi(g.t), false)), UI.kv('차체 금형·지그' + (pair.pf ? ' (톱햇)' : ''), U.money(ev.tooling * D.cpi(g.t))), UI.kv('성형 난이도', ev.A.complexity.toFixed(2)), UI.kv('실내 / 적재', ev.A.cabinVol.toFixed(2) + ' m³ / ' + Math.round(ev.A.cargo * 1000) + ' L'),
            UI.kv('개발', ev.devMonths + '개월 · ' + U.money(ev.devCost * D.cpi(g.t))), UI.kv('권장 소비자가', U.money(S.suggestPrice(g, car), false)))),
        h('h3', {}, '패널별 소재 · 성형'), UI.table([{ k: 'name', t: '패널' }, { k: 'mat', t: '소재', f: p => p.SH.name + ' ' + p.GR.id }, { k: 'depth', t: '성형 깊이', num: 1, f: p => p.depth.toFixed(2) }, { k: 'form', t: '성형 한계', num: 1, f: p => p.form.toFixed(2) }, { k: 'scrap', t: '스크랩', num: 1, f: p => p.scrap > 0 ? UI.chip(Math.round(p.scrap * 100) + '%', 'bad') : '—' }, { k: 'share', t: '면적', num: 1, f: p => Math.round(p.share * 100) + '%' }], ev.panels, { dense: 1 }),
        ev.warn.length ? h('div', { class: 'warnbox' }, ev.warn.map(w => h('p', {}, w))) : null);
    };
    fill();
    // side viewport with draggable outline handles
    let drag = null, hover = null, showH = UI.state.handles !== false && !locked;
    const side = UI.carSide(car, y, { after: (x, v) => { side._v = v; UI.bpDrawSide(x, car, v); if (!showH) return; for (const [k, list] of [['side', b.side], ['glass', b.glass]]) list.forEach((p, i) => { const px = v.ox + p.x * b.L * v.sc, py = v.gy - p.y * b.H * v.sc; x.fillStyle = k === 'glass' ? '#1f5fbf' : '#ffffff'; x.strokeStyle = k === 'glass' ? '#ffffff' : '#1f5fbf'; x.lineWidth = 1.5; x.beginPath(); const rr = hover && hover[0] === k && hover[1] === i ? 6 : 3.8; if (p.s) x.rect(px - rr, py - rr, rr * 2, rr * 2); else x.arc(px, py, rr, 0, 7); x.fill(); x.stroke(); }); } });
    const top = UI.canvas('vp top', (x, W, H) => { R.studio(x, W, H, H, UI.STUDIO); const sc = Math.min((W - 60) / b.L, (H - 30) / b.W) * .92, ox = (W - b.L * sc) / 2; top._v = { ox, cy: H / 2, sc }; R.drawCarTop(x, car, { x: ox, y: H / 2, scale: sc, year: y }); UI.bpDrawTop(x, car, top._v); if (showH) b.top.forEach((p, i) => { const px = ox + p.x * b.L * sc, py = H / 2 + p.y * b.W / 2 * sc; x.fillStyle = '#fff'; x.strokeStyle = '#1f5fbf'; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, hover && hover[0] === 'top' && hover[1] === i ? 6 : 3.8, 0, 7); x.fill(); x.stroke(); }); });
    const hit = (cv, ev, keys) => {
      const rct = cv.getBoundingClientRect(), mx = ev.clientX - rct.left, my = ev.clientY - rct.top, v = cv._v; if (!v) return null;
      let best = null, bd = 12;
      for (const k of keys) b[k].forEach((p, i) => { const px = v.ox + p.x * b.L * v.sc, py = k === 'top' ? v.cy + p.y * b.W / 2 * v.sc : v.gy - p.y * b.H * v.sc; const d = Math.hypot(px - mx, py - my); if (d < bd) { bd = d; best = [k, i]; } });
      return { best, mx, my, v };
    };
    const bind = (cv, keys) => {
      cv.addEventListener('pointerdown', ev => { if (!showH) return; const q = hit(cv, ev, keys); if (q?.best) { drag = q.best; cv.setPointerCapture(ev.pointerId); ev.preventDefault(); } });
      cv.addEventListener('pointermove', ev => {
        const q = hit(cv, ev, keys); if (!q) return;
        if (!drag) { hover = q.best; cv.style.cursor = q.best && showH ? 'grab' : 'default'; return; }
        const p = b[drag[0]][drag[1]], v = q.v;
        p.x = U.clamp((q.mx - v.ox) / (b.L * v.sc), 0, 1);
        if (drag[0] === 'top') p.y = U.clamp(Math.abs(q.my - v.cy) / (b.W / 2 * v.sc), .3, 1);
        else p.y = U.clamp((v.gy - q.my) / (b.H * v.sc), (b.clr + 40) / b.H, 1);
        car._rev = (car._rev || 0) + 1;
      });
      const end = () => { if (drag) { drag = null; recalc(); } };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      cv.addEventListener('dblclick', ev => {
        if (!showH || drag) return; const q = hit(cv, ev, keys); if (!q) return;
        if (q.best && q.best[0] === 'side') { const p = b.side[q.best[1]]; p.s = p.s ? undefined : 1; recalc(); return; }
        if (q.best) return;
        // insert a point on the nearest segment of the side outline / glass / plan
        const v = q.v, toS = (k, p) => k === 'top' ? [v.ox + p.x * b.L * v.sc, v.cy + p.y * b.W / 2 * v.sc] : [v.ox + p.x * b.L * v.sc, v.gy - p.y * b.H * v.sc];
        let bestK = null, bestI = -1, bd = 14;
        for (const k of keys) { const L = b[k], closed = k === 'glass'; for (let i = 0; i < L.length - (closed ? 0 : 1); i++) { const [ax, ay] = toS(k, L[i]), [bx, by] = toS(k, L[(i + 1) % L.length]); const t = U.clamp(((q.mx - ax) * (bx - ax) + (q.my - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1), 0, 1); const dd = Math.hypot(ax + t * (bx - ax) - q.mx, ay + t * (by - ay) - q.my); if (dd < bd) { bd = dd; bestK = k; bestI = i; } } }
        if (!bestK) return;
        const np = bestK === 'top' ? { x: U.clamp((q.mx - v.ox) / (b.L * v.sc), 0, 1), y: U.clamp(Math.abs(q.my - v.cy) / (b.W / 2 * v.sc), .3, 1) } : { x: U.clamp((q.mx - v.ox) / (b.L * v.sc), 0, 1), y: U.clamp((v.gy - q.my) / (b.H * v.sc), 0, 1) };
        b[bestK].splice(bestI + 1, 0, np); recalc();
      });
      cv.addEventListener('contextmenu', ev => { if (!showH) return; const q = hit(cv, ev, keys); if (q?.best && b[q.best[0]].length > (q.best[0] === 'glass' ? 4 : 6)) { ev.preventDefault(); b[q.best[0]].splice(q.best[1], 1); recalc(); } });
    };
    bind(side, ['side', 'glass']); bind(top, ['top']);
    // inspector
    const tab = UI.state.tab.car || 'body';
    const grp = (t, ...k) => h('fieldset', { disabled: locked }, UI.group(t, ...k));
    const sheet = D.byId(C.sheet, b.sheet);
    const texUp = h('input', { type: 'file', accept: 'image/*', id: 'car-tex', onchange: ev => { const f = ev.target.files[0]; if (f) readImage(f, 512, url => { b.customTex = url; R.userImage(url, () => { car._rev = (car._rev || 0) + 1; }); UI.render(); }); } });
    const pf = S.platformOf(g, car.platformId);
    const pt = car.powertrain || 'ice';
    const featName = { radio: '오디오', ac: '공조', steer: '조향 보조', belts: '안전벨트', airbag: '에어백', abs: 'ABS', esc: '자세제어', adas: '운전자 보조', crumple: '충돌 구조' };
    const insp = {
      body: () => [
        grp('형상', UI.prop('기준 형상', UI.sel(Object.entries(D.BODY_REF).map(([id, p]) => ({ id, name: `${p.name} (${p.era})` })), b.preset, null, v => { const nb = S.bodyFromPreset(v); for (const k of ['sheet', 'grade', 'paint', 'customTex', 'rawSheet', 'metallic', 'panels']) nb[k] = b[k]; car.body = nb; S.applyPresetTyre(car); car._rev = (car._rev || 0) + 1; UI.render(); })),
          h('p', { class: 'note' }, D.BODY_REF[b.preset]?.ref ? '실측 기준: ' + D.BODY_REF[b.preset].ref : ''),
          UI.prop('전장', UI.range(b.L, 3000, 6200, 10, v => { b.L = v; b.wb = Math.min(b.wb, v - 600); recalc(); }, v => v + ' mm')), UI.prop('전폭', UI.range(b.W, 1400, 2200, 10, v => { b.W = v; recalc(); }, v => v + ' mm')),
          UI.prop('전고', UI.range(b.H, 1000, 2100, 10, v => { b.H = v; recalc(); }, v => v + ' mm')), UI.prop('휠베이스', UI.range(b.wb, 2000, 3800, 10, v => { b.wb = v; recalc(); }, v => v + ' mm', {}), pf ? `플랫폼 ${pf.wbMin}–${pf.wbMax}` : ''),
          UI.prop('최저지상고', UI.range(b.clr, 80, 320, 5, v => { b.clr = v; recalc(); }, v => v + ' mm')), UI.prop('앞 오버행 비율', UI.range(b.foh, .2, .75, .01, v => { b.foh = v; recalc(); }, v => Math.round(v * 100) + '%')),
          UI.prop('도어', UI.sel([{ id: 2, name: '2도어' }, { id: 4, name: '4도어' }], b.doors, null, v => set('body.doors', v, 1))), UI.prop('좌석', UI.range(b.seats, 2, 9, 1, v => { b.seats = v; recalc(); }))),
        grp('외장', UI.prop('도장색', h('input', { type: 'color', value: b.paint, id: 'car-paint', oninput: ev => { b.paint = ev.target.value; car._rev = (car._rev || 0) + 1; } })), UI.prop('메탈릭', h('input', { type: 'checkbox', checked: !!b.metallic, disabled: g.t < 1958, onchange: ev => { b.metallic = ev.target.checked; car._rev++; } })),
          UI.prop('크롬 장식', UI.range(b.chrome ?? .3, 0, 1, .05, v => { b.chrome = v; recalc(); }, v => Math.round(v * 100) + '%')), UI.prop('캐릭터 라인 높이', UI.range(b.charLine ?? .5, .3, .7, .01, v => { b.charLine = v; car._rev++; }, v => Math.round(v * 100) + '%')),
          UI.prop('디자인 연대', UI.sel([{ id: '', name: '자동 (설계 연도)' }, { id: 1950, name: '1950s' }, { id: 1965, name: '1960s' }, { id: 1978, name: '1970s' }, { id: 1986, name: '1980s' }, { id: 1998, name: '1990s' }, { id: 2008, name: '2000s' }, { id: 2020, name: '2010s~' }], b.styleYear || '', null, v => { b.styleYear = v ? +v : null; b.style = v ? (({ lamp, tail, bumper, wheel, trim }) => ({ lamp, tail, bumper, wheel, trim }))(R.styleFor({ ...car, body: { ...b, style: {} } }, +v)) : null; car._rev++; UI.render(); }), '램프·범퍼·휠·몰딩')),
        grp('강판', UI.prop('기본 소재', UI.sel(C.sheet, b.sheet, g.t, v => { b.sheet = v; recalc(); UI.render(); })), UI.prop('등급 (가격)', UI.sel(sheet.grades.map(gr => ({ id: gr.id, name: `${gr.name} ×${gr.cm}` })), b.grade, null, v => set('body.grade', v, 1))),
          UI.prop('원소재 보기', h('input', { type: 'checkbox', checked: !!b.rawSheet, onchange: ev => { b.rawSheet = ev.target.checked; car._rev++; } }), '도장 전 상태'),
          UI.prop('강판 텍스처', texUp, '차체 곡면에 맞춰 변형'), b.customTex ? UI.btn('텍스처 해제', () => { b.customTex = null; car._rev++; UI.render(); }, 'ghost sm') : null,
          h('p', { class: 'note' }, '편집: 점을 끌어 형상 변경, 차체 점을 더블클릭하면 각진 모서리(■)와 곡선(●)이 바뀝니다.'))],
      bp: () => UI.blueprintTab(g, car, locked),
      panels: () => [grp('패널별 강판 (테일러드 블랭크)', ...(pair ? pair.ev.panels : []).map(p => {
        const cur = (b.panels && b.panels[p.id]) || null;
        return UI.prop(p.name, h('div', { class: 'row tight' }, UI.sel([{ id: '', name: '기본 소재와 동일' }, ...C.sheet], cur?.sheet || '', g.t, v => { b.panels = b.panels || {}; if (!v) delete b.panels[p.id]; else b.panels[p.id] = { sheet: v, grade: cur?.grade || 'B' }; recalc(); UI.render(); }),
          cur ? UI.sel(D.byId(C.sheet, cur.sheet).grades.map(gr => ({ id: gr.id, name: gr.id })), cur.grade, null, v => { b.panels[p.id].grade = v; recalc(); UI.render(); }) : null), `깊이 ${p.depth.toFixed(2)} / 한계 ${p.form.toFixed(2)}`);
      }), h('p', { class: 'note' }, '깊게 당기는 패널(펜더·리어 쿼터)은 성형성이 좋은 강판이, 평평한 패널(루프·후드)은 가볍고 강한 고장력강이 유리합니다. 한계를 넘으면 스크랩이 원가에 붙습니다.'))],
      power: () => [
        grp('파워트레인', UI.prop('형식', UI.sel(D.PT.types, pt, g.t, v => { car.powertrain = v; if (v !== 'ice' && !car.ev) car.ev = S.evDefaults(g.t, v); if (v !== 'ice') car.ev = { ...S.evDefaults(g.t, v), ...car.ev, kWh: S.evDefaults(g.t, v).kWh }; recalc(); UI.render(); })),
          pt !== 'bev' ? UI.prop('엔진', UI.sel(g.engines.map(e => ({ id: e.id, name: e.name + (e.status ? '' : ' (설계안)') })), car.engineId, null, v => set('engineId', v, 1))) : null,
          pt !== 'bev' ? UI.prop('변속기', UI.sel(C.gearbox, car.gearbox, g.t, v => set('gearbox', v))) : null,
          UI.prop('기어비', UI.range(car.gearing, 0, 100, 1, v => set('gearing', v), v => v < 35 ? '연비형 ' + v : v > 65 ? '가속형 ' + v : v))),
        pt !== 'ice' ? grp('전동화', UI.prop('셀 화학', UI.sel(D.PT.cells, car.ev.cell, g.t, v => set('ev.cell', v, 1))), UI.prop('배터리 용량', UI.range(car.ev.kWh, .8, 160, .1, v => set('ev.kWh', v), v => v.toFixed(1) + ' kWh')),
          UI.prop('모터', UI.sel(D.PT.motors, car.ev.motor, g.t, v => set('ev.motor', v, 1))), UI.prop('모터 출력', UI.range(car.ev.kw, 20, 400, 5, v => set('ev.kw', v), v => v + ' kW')),
          pt === 'bev' ? UI.prop('모터 수', UI.sel([{ id: 1, name: '1 (2WD)' }, { id: 2, name: '2 (듀얼모터 AWD)' }], car.ev.motors || 1, null, v => set('ev.motors', v, 1))) : null,
          UI.prop('인버터', UI.sel(D.PT.inverters, car.ev.inverter, g.t, v => set('ev.inverter', v, 1))),
          h('p', { class: 'note' }, `팩 가격 ${U.money(U.table(D.PACK_PRICE[car.ev.cell] || D.PACK_PRICE.nmc, g.t), false)}/kWh · 에너지밀도 ${Math.round(U.table(D.PACK_DENS[car.ev.cell] || D.PACK_DENS.nmc, g.t))} Wh/kg (BloombergNEF 시계열 기준)`)) : null],
      chassis: () => [
        grp('플랫폼', UI.prop('플랫폼', UI.sel(g.platforms.map(p => ({ id: p.id, name: p.name + (p.status ? '' : ' (설계안)') })), car.platformId, null, v => set('platformId', v, 1))),
          pf ? h('div', { class: 'note' }, `${D.byId(C.chassis, pf.chassis).name} · ${D.byId(C.drive, pf.drive).name}`, h('br'), `앞 ${D.byId(C.suspF, pf.suspF).name} / 뒤 ${D.byId(C.suspR, pf.suspR).name}`, h('br'), UI.btn('플랫폼 열기', () => UI.go('platform', { platform: pf.id }), 'ghost sm')) : null),
        grp('하체 튜닝', UI.prop('스프링/댐퍼', UI.range(car.springs, 0, 100, 1, v => set('springs', v), v => v < 35 ? '승차감 ' + v : v > 65 ? '핸들링 ' + v : v)), UI.prop('브레이크', UI.sel(C.brakes, car.brakes, g.t, v => set('brakes', v, 1)))),
        grp('타이어·휠', UI.prop('타이어', UI.sel(C.tires, car.tires, g.t, v => set('tires', v))), UI.prop('단면폭', UI.range(car.tireW, 125, 345, 5, v => set('tireW', v), v => v + ' mm')), UI.prop('편평비', UI.range(car.tireAR, 25, 95, 5, v => set('tireAR', v), v => v + '%')), UI.prop('림', UI.range(car.rim, 12, 22, 1, v => set('rim', v), v => v + '"')),
          h('p', { class: 'note' }, `${car.tireW}/${car.tireAR}R${car.rim} · 외경 ${Math.round(car.rim * 25.4 + 2 * car.tireW * car.tireAR / 100)} mm`))],
      cabin: () => [grp('실내', UI.prop('인테리어', UI.sel(C.interior, car.interior, g.t, v => set('interior', v)))),
        grp('편의·안전 장비', ...Object.keys(C.features).map(k => UI.prop(featName[k], UI.sel(C.features[k], car.features[k] || 0, g.t, v => set('features.' + k, v))))),
        grp('품질', UI.prop('설계·조립 품질', UI.range(car.quality, -5, 5, 1, v => set('quality', v), v => (v > 0 ? '+' : '') + v)))],
      trims: () => {
        const trims = car.trims || [];
        return [h('fieldset', {}, UI.group('트림', h('p', { class: 'note' }, '트림을 추가하면 같은 차를 사양과 가격을 달리해 여러 구매층에 판매합니다. 트림이 없으면 기본 사양 하나로 판매합니다. 트림은 판매 중에도 바꿀 수 있습니다.'),
          ...trims.map((t, i) => h('div', { class: 'trim' }, h('div', { class: 'row tight' }, h('input', { class: 'in', value: t.name, 'aria-label': '트림 이름', oninput: ev => { t.name = ev.target.value; } }), UI.btn('삭제', () => { trims.splice(i, 1); if (!trims.length) car.trims = null; UI.render(); }, 'ghost sm')),
            UI.prop('가격', h('input', { class: 'in', type: 'number', value: t.price, step: 10, onchange: ev => { t.price = +ev.target.value; } })),
            UI.prop('인테리어', UI.sel(C.interior, t.interior, g.t, v => { t.interior = v; UI.render(); })),
            UI.prop('오디오', UI.sel(C.features.radio, t.features.radio ?? car.features.radio, g.t, v => { t.features.radio = v; })), UI.prop('공조', UI.sel(C.features.ac, t.features.ac ?? car.features.ac, g.t, v => { t.features.ac = v; })),
            UI.prop('에어백', UI.sel(C.features.airbag, t.features.airbag ?? car.features.airbag, g.t, v => { t.features.airbag = v; })), UI.prop('운전자 보조', UI.sel(C.features.adas, t.features.adas ?? car.features.adas, g.t, v => { t.features.adas = v; })))),
          h('fieldset', {}, UI.btn('+ 트림 추가', () => { car.trims = car.trims || [{ id: 'base', name: '기본형', price: car.price || S.suggestPrice(g, car), interior: car.interior, features: {} }]; const last = car.trims[car.trims.length - 1]; const ip = C.interior.findIndex(o => o.id === last.interior); car.trims.push({ id: U.uid('tr'), name: ['고급형', '최고급형', '스포츠'][car.trims.length - 1] || '트림 ' + (car.trims.length + 1), price: Math.round(last.price * 1.18 / 10) * 10, interior: (C.interior[Math.min(ip + 1, C.interior.length - 1)]).id, features: { ...last.features } }); UI.render(); }, 'ghost'))))];
      }
    };
    const rival = refSel;
    return h('div', { class: 'split' },
      h('section', { class: 'center' },
        head(nameInput(car, 'car-name', locked), car, [
          !locked ? UI.btn(`개발 착수${pair ? ` · ${pair.ev.devMonths}개월 · ${U.money(pair.ev.devCost * D.cpi(g.t))}` : ''}`, () => UI.err(S.startCarDev(g, car)) && UI.render(), 'pri') : null,
          !locked ? UI.btn('자동 설계 제안', () => { const { engine, car: c2 } = S.autoDesign({ seg: car.segment || 'family', year: g.t, region: (car.regions || ['na'])[0], traits: { tech: .6, quality: .2 } }); if (engine && car.powertrain !== 'bev' && c2.powertrain !== 'bev') { engine.name = '제안 엔진 ' + engine.name; g.engines.push(engine); } Object.assign(car, { ...c2, id: car.id, name: car.name, platformId: car.platformId, engineId: c2.powertrain === 'bev' ? car.engineId : engine?.id || car.engineId, regions: car.regions, price: 0 }); recalc(); UI.render(); UI.toast('같은 물리 모델로 자동 설계한 제안을 불러왔습니다. 플랫폼 범위를 확인하세요.'); }, 'ghost') : null,
          UI.btn(locked ? '페이스리프트 (복제)' : '복제', () => clone(g.cars, car, 'car', 'car', locked ? ' 페이스리프트' : ' 사본'), 'ghost'), !locked ? UI.btn('삭제', () => remove(g.cars, car, 'car', 'car'), 'ghost') : null],
          `${D.SEGMENTS.find(s => s.id === car.segment)?.name || ''} · ${pf ? pf.name : '플랫폼 없음'}${car.acquiredFrom ? ' · ' + car.acquiredFrom + '에서 인수' : ''}${car.status === 'dev' ? ` · 개발 ${Math.floor(car.dev.done)}/${car.dev.months}개월` : ''}`),
        h('div', { class: 'vps' }, h('figure', {}, side, h('figcaption', {}, `측면 · 전장 ${b.L} · 휠베이스 ${b.wb} · 전고 ${b.H} mm`, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: showH, disabled: locked, onchange: ev => { UI.state.handles = ev.target.checked; UI.render(); } }), '편집 핸들'))),
          h('figure', {}, top, h('figcaption', {}, `평면 · 전폭 ${b.W} mm`))),
        rival ? h('details', { class: 'card cmp' }, h('summary', {}, `경쟁차와 나란히 보기 — ${rival.m.name}`), UI.carSide(rival.m.car, Math.floor(rival.m.launchT), {}), h('p', { class: 'note' }, `${rival.r.name} · ${Math.round(rival.m.spec.hp)} hp · 0→100 ${rival.m.spec.t100.toFixed(1)} s · ${rival.m.pt === 'bev' ? Math.round(rival.m.range) + ' km' : rival.m.spec.lpk.toFixed(1) + ' L/100km'} · ${U.money(rival.m.price, false)}`)) : null,
        h('div', { class: 'card' }, analysis)),
      h('aside', { class: 'insp' }, UI.tabs([['body', '차체'], ['bp', '청사진'], ['panels', '패널'], ['power', '파워트레인'], ['chassis', '섀시'], ['cabin', '실내·안전'], ['trims', '트림']], tab, t => { UI.state.tab.car = t; UI.render(); }), ...insp[tab]())
    );
  };
})(window.MW);
