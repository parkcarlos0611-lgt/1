// Engine designer and car designer screens.
(function (MW) {
  const U = MW.U, D = MW.data, E = D.E, C = D.C, S = MW.sim, R = MW.render, UI = MW.ui, h = U.h;
  const sel = { engine: null, car: null };
  const sec = (title, ...kids) => h('section', { class: 'panel' }, h('h3', {}, title), ...kids);
  const statusChip = o => h('em', { class: 'chip ' + (o.status || 'draft') }, { dev: '개발 중', ready: '개발 완료', production: '생산 중', retired: '단종' }[o.status] || '설계안');

  // read an image file, downscale (keeps saves small), return dataURL
  const readImage = (file, max, cb) => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', .85)); }; im.src = fr.result; }; fr.readAsDataURL(file); };

  const listCol = (items, cur, onPick, onNew, onClone, label) => h('div', { class: 'list' },
    h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: onNew }, '+ 새 ' + label), cur ? h('button', { class: 'btn sm ghost', onclick: onClone }, '복제') : null),
    items.map(o => h('button', { class: 'li' + (o === cur ? ' on' : ''), onclick: () => onPick(o) }, h('b', {}, o.name), statusChip(o))));

  // ── ENGINE ─────────────────────────────────────────────────────────
  UI.screens.engine = G => {
    let e = sel.engine && G.engines.includes(sel.engine) ? sel.engine : G.engines[0];
    sel.engine = e;
    const y = e && e.status ? (e.year || G.t) : G.t;
    const locked = !!(e && e.status);
    const newE = () => { const n = S.defaultEngine(Math.floor(G.t)); n.name = '신형 엔진 ' + (G.engines.length + 1); S.fixEngine(n, G.t); G.engines.push(n); sel.engine = n; UI.render(); };
    const cloneE = () => { const n = U.deep(e); n.id = U.uid('eng'); n.name = e.name + ' (개량)'; delete n.status; delete n.dev; delete n.readyT; S.fixEngine(n, G.t); G.engines.push(n); sel.engine = n; UI.render(); };
    if (!e) return h('div', {}, h('button', { class: 'btn', onclick: newE }, '새 엔진'));
    let er = S.evalEngine(e, y);
    const statsBox = h('div', {}), curve = UI.canvas('curve', (x, W, H) => drawCurve(x, W, H, er));
    const set = (k, v, full) => { if (locked) return; e[k] = v; const iss = S.fixEngine(e, G.t); if (iss.length) UI.toast(iss[0], 'warn'); er = S.evalEngine(e, y); if (full) UI.render(); else stats(); };
    const stats = () => {
      statsBox.replaceChildren(
        h('div', { class: 'bigs' },
          h('div', {}, h('small', {}, '배기량'), h('b', {}, er.cc.toFixed(0) + 'cc'), h('i', {}, er.dispL.toFixed(2) + ' L')),
          h('div', {}, h('small', {}, '최고출력'), h('b', {}, Math.round(er.peakHp) + ' hp'), h('i', {}, '@' + er.peakHpRpm + 'rpm · ' + Math.round(er.ps) + 'PS')),
          h('div', {}, h('small', {}, '최대토크'), h('b', {}, Math.round(er.peakTq) + ' Nm'), h('i', {}, '@' + er.peakTqRpm + 'rpm')),
          h('div', {}, h('small', {}, '레드라인'), h('b', {}, er.redline), h('i', {}, '한계 ' + Math.round(er.rpmMax)))),
        UI.kv('중량', er.mass + ' kg'), UI.kv('크기 L×W×H', `${er.length}×${Math.round(er.width)}×${Math.round(er.height)} mm`), UI.kv('비출력', er.hpPerL.toFixed(1) + ' hp/L'),
        UI.kv('최저 BSFC', er.bsfc.toFixed(0) + ' g/kWh'), UI.kv('피스톤 평균속도', er.pistonSpeed.toFixed(1) + ' m/s'), UI.kv('배출가스 지수', er.emissions.toFixed(0)),
        UI.kv('옥탄가 (시판)', er.octane.toFixed(0) + ' RON · 노킹한계 CR ' + er.knockCR.toFixed(1)), UI.kv('부스트', er.boostBar ? er.boostBar.toFixed(2) + ' bar · 스풀 ' + Math.round(er.spool) + 'rpm' : '—'),
        h('div', { class: 'rr2' }, UI.ratingRow('reliability', er.rel), h('div', { class: 'rr' }, h('span', {}, '정숙성/밸런스'), UI.bar(er.smooth * 100), h('b', {}, Math.round(er.smooth * 100)))),
        UI.kv('생산원가', U.money(er.cost * D.cpi(G.t), false) + ' / 대'), UI.kv('조립 공수', er.hours.toFixed(1) + ' h'), UI.kv('개발', er.devMonths + '개월 · ' + U.money(er.devCost * D.cpi(G.t))),
        er.warnings.map(w => h('p', { class: 'warn' }, w)));
    };
    stats();
    const front = UI.canvas('eng-front', (x, W, H) => { const sc = Math.min(W / (er.width * 1.2), H / (er.height * 1.25)); R.drawEngineFront(x, e, er, { x: W / 2, y: H * .66, scale: sc, crank: UI.state.anim * (e.rpmView || 4) }); });
    const side = UI.canvas('eng-side', (x, W, H) => { const sc = Math.min(W / (er.length * 1.45), H / (er.height * 1.25)); R.drawEngineSide(x, e, er, { x: W / 2, y: H * .78, scale: sc, crank: UI.state.anim * (e.rpmView || 4), cutaway: e.cutaway }); });
    const L = D.byId(E.layouts, e.layout);
    const grp = (t, ...k) => h('fieldset', { disabled: locked }, h('legend', {}, t), ...k);
    const segUp = h('input', { type: 'file', accept: 'image/*', onchange: ev => { const f = ev.target.files[0]; if (f) readImage(f, 240, url => { e.customSeg = url; R.userImage(url, () => UI.render()); UI.render(); }); } });
    return h('div', { class: 'grid design' },
      listCol(G.engines, e, o => { sel.engine = o; UI.render(false); }, newE, cloneE, '엔진'),
      h('div', { class: 'col' },
        h('div', { class: 'stage engine' }, h('div', { class: 'cv' }, front, h('label', {}, '정면 단면')), h('div', { class: 'cv' }, side, h('label', {}, '측면 ' + (e.cutaway ? '(컷어웨이)' : '')))),
        h('div', { class: 'row wrap' },
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!e.cutaway, onchange: ev => { e.cutaway = ev.target.checked; } }), '컷어웨이'),
          UI.slider('회전 속도', e.rpmView || 4, 0, 30, 1, v => { e.rpmView = v; }),
          h('label', { class: 'fld file' }, h('span', {}, '블록 1기통 텍스처 업로드', h('i', {}, '기통 수만큼 코드로 타일링')), segUp),
          e.customSeg ? h('button', { class: 'btn sm ghost', onclick: () => { delete e.customSeg; UI.render(); } }, '기본 텍스처') : null),
        sec('토크 / 출력 곡선', curve),
        h('div', { class: 'row' }, h('input', { class: 'inp', id: 'eng-name', value: e.name, disabled: locked, oninput: ev => { e.name = ev.target.value; } }), statusChip(e),
          !locked ? h('button', { class: 'btn', onclick: () => { UI.err(S.startEngineDev(G, e)) && UI.render(); } }, `개발 착수 (${er.devMonths}개월, ${U.money(er.devCost * D.cpi(G.t))})`) : h('span', { class: 'mut' }, e.status === 'dev' ? `개발 ${Math.floor(e.dev.done)}/${e.dev.months}개월` : '설계 확정됨 — 수정하려면 복제'))
      ),
      h('div', { class: 'col params' },
        grp('기본 구조',
          UI.field('연료', UI.sel(E.fuelTypes, e.fuel, G.t, v => set('fuel', v, 1))),
          UI.field('레이아웃', UI.sel(E.layouts, e.layout, G.t, v => set('layout', v, 1))),
          UI.field('기통 수', UI.sel(L.cyls.map(n => ({ id: n, name: n + '기통' })), e.cyl, G.t, v => set('cyl', v, 1))),
          e.layout === 'V' || e.layout === 'W' ? UI.field('뱅크각', UI.sel(L.angles ? L.angles.map(a => ({ id: a, name: a + '°' })) : [{ id: 60, name: '60°' }], e.vAngle, G.t, v => set('vAngle', v, 1))) : null,
          UI.slider('보어 (mm)', e.bore, 50, 140, .5, v => set('bore', v)), UI.slider('스트로크 (mm)', e.stroke, 45, 140, .5, v => set('stroke', v)),
          UI.field('블록 재질', UI.sel(E.blockMat, e.blockMat, G.t, v => set('blockMat', v, 1))), UI.field('헤드 재질', UI.sel(E.headMat, e.headMat, G.t, v => set('headMat', v, 1))),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: e.balanceShaft, onchange: ev => set('balanceShaft', ev.target.checked) }), '밸런스 샤프트')),
        grp('밸브트레인',
          UI.field('헤드 형식', UI.sel(E.heads, e.head, G.t, v => set('head', v, 1))),
          UI.field('기통당 밸브', UI.sel(E.valves, e.valves, G.t, v => set('valves', v, 1), { filter: o => D.byId(E.heads, e.head).valves.includes(o.id) })),
          UI.field('가변 밸브', UI.sel(E.vvt, e.vvt, G.t, v => set('vvt', v, 1))),
          UI.slider('캠 프로파일 (저속↔고속)', e.cam, 0, 100, 1, v => set('cam', v)),
          UI.slider('레드라인 지정 (0=자동)', e.redline, 0, 12000, 100, v => set('redline', v))),
        grp('보텀엔드', UI.field('크랭크샤프트', UI.sel(E.crank, e.crank, G.t, v => set('crank', v, 1))), UI.field('커넥팅로드', UI.sel(E.rods, e.rods, G.t, v => set('rods', v, 1))), UI.field('피스톤', UI.sel(E.pistons, e.pistons, G.t, v => set('pistons', v, 1))),
          UI.slider('압축비', e.compression, e.fuel === 'diesel' ? 14 : 5.5, e.fuel === 'diesel' ? 24 : 14.5, .1, v => set('compression', v), v => v.toFixed(1) + ':1')),
        grp('흡기·연료', UI.field('연료 공급', UI.sel(E.fuelSys, e.fuelSys, G.t, v => set('fuelSys', v, 1), { filter: o => o.fuel === e.fuel })),
          UI.slider('공연비 (농후↔희박)', e.mixture, 0, 100, 1, v => set('mixture', v)),
          UI.field('과급', UI.sel(E.asp, e.asp, G.t, v => set('asp', v, 1))),
          e.asp !== 'na' ? UI.slider('부스트 (psi)', e.boost, 2, 30, .5, v => set('boost', v)) : null,
          e.asp !== 'na' ? h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: e.intercooler, disabled: G.t < 1977, onchange: ev => set('intercooler', ev.target.checked) }), '인터쿨러' + (G.t < 1977 ? ' (1977~)' : '')) : null),
        grp('점화·배기', UI.field('점화', UI.sel(E.ignition, e.ignition, G.t, v => set('ignition', v, 1))), UI.field('배기 매니폴드', UI.sel(E.exhaust, e.exhaust, G.t, v => set('exhaust', v, 1))), UI.field('촉매', UI.sel(E.cat, e.cat, G.t, v => set('cat', v, 1)))),
        grp('품질', UI.slider('설계 품질 (원가↔신뢰성)', e.quality, -5, 5, 1, v => set('quality', v))),
        sec('성능 요약', statsBox))
    );
  };
  const drawCurve = (x, W, H, er) => {
    const cs = getComputedStyle(document.documentElement), c = er.curve; if (!c.length) return;
    const L = 40, Rr = 40, T = 10, B = 22, mxT = Math.max(...c.map(p => p.tq)) * 1.15, mxP = Math.max(...c.map(p => p.hp)) * 1.15, mxR = er.redline + 500;
    const X = r => L + r / mxR * (W - L - Rr);
    x.strokeStyle = cs.getPropertyValue('--line'); x.fillStyle = cs.getPropertyValue('--mut'); x.font = '10px "IBM Plex Mono", monospace';
    for (let r = 0; r <= mxR; r += 1000) { x.beginPath(); x.moveTo(X(r), T); x.lineTo(X(r), H - B); x.stroke(); x.fillText(r / 1000 + 'k', X(r) - 6, H - 6); }
    x.fillStyle = 'rgba(200,60,50,.12)'; x.fillRect(X(er.redline), T, W - Rr - X(er.redline), H - T - B);
    const plot = (k, mx, col) => { x.beginPath(); c.forEach((p, i) => { const yy = T + (1 - p[k] / mx) * (H - T - B); i ? x.lineTo(X(p.rpm), yy) : x.moveTo(X(p.rpm), yy); }); x.strokeStyle = col; x.lineWidth = 2; x.stroke(); };
    plot('tq', mxT, '#6aa3d8'); plot('hp', mxP, '#d9a441');
    x.fillStyle = '#6aa3d8'; x.fillText(Math.round(mxT / 1.15) + ' Nm', 2, T + 10); x.fillStyle = '#d9a441'; x.fillText(Math.round(mxP / 1.15) + ' hp', W - Rr + 2, T + 10);
    if (er.boostBar) { x.beginPath(); c.forEach((p, i) => { const yy = T + (1 - p.boost / (er.boostBar * 1.6)) * (H - T - B); i ? x.lineTo(X(p.rpm), yy) : x.moveTo(X(p.rpm), yy); }); x.setLineDash([4, 4]); x.strokeStyle = cs.getPropertyValue('--mut'); x.stroke(); x.setLineDash([]); }
  };

  // ── CAR ─────────────────────────────────────────────────────────────
  UI.screens.car = G => {
    let car = sel.car && G.cars.includes(sel.car) ? sel.car : G.cars[0];
    sel.car = car;
    const newC = () => { const e = G.engines.find(x => x.status) || G.engines[0]; const n = S.defaultCar(Math.floor(G.t), e?.id); n.name = '신형 모델 ' + (G.cars.length + 1); n.segment = 'family'; n.regions = ['na']; n.price = 0; G.cars.push(n); sel.car = n; UI.render(); };
    const cloneC = () => { const n = U.deep(car); n.id = U.uid('car'); n.name = car.name + ' (페이스리프트)'; for (const k of ['status', 'dev', 'readyT', 'launchT', 'sold', 'reviews', 'reviewAvg', 'salesHist', 'lastSales', 'lastDemand', 'frozen']) delete n[k]; G.cars.push(n); sel.car = n; UI.render(); };
    if (!car) return h('div', {}, h('button', { class: 'btn', onclick: newC }, '새 차량'));
    const locked = !!car.status, y = locked ? car.year : G.t, b = car.body;
    let pair = S.evalPair(G, car, y);
    const statsBox = h('div', {});
    const recalc = () => { pair = S.evalPair(G, car, y); stats(); };
    const set = (path, v, full) => { if (locked) return; const ks = path.split('.'); let o = car; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = v; if (full) UI.render(); else recalc(); };
    const stats = () => {
      if (!pair) { statsBox.replaceChildren(h('p', { class: 'warn' }, '엔진을 선택하세요')); return; }
      const { ev, er } = pair, r = ev.r;
      const inc = D.income(G.t, D.REGIONS[0]);
      const fit = D.SEGMENTS.map(sg => ({ sg, u: S.utility(r, S.priceScore(car.price || S.suggestPrice(G, car), sg.price * inc), sg, G.rep) })).sort((a, b) => b.u - a.u);
      statsBox.replaceChildren(
        h('div', { class: 'bigs' },
          h('div', {}, h('small', {}, '0→100 km/h'), h('b', {}, ev.t100 > 90 ? '—' : ev.t100.toFixed(1) + 's'), h('i', {}, '400m ' + (ev.t400 ? ev.t400.toFixed(1) + 's' : '—'))),
          h('div', {}, h('small', {}, '최고속도'), h('b', {}, Math.round(ev.topSpeed)), h('i', {}, 'km/h')),
          h('div', {}, h('small', {}, '복합 연비'), h('b', {}, ev.lpk.toFixed(1)), h('i', {}, 'L/100km · ' + ev.mpg.toFixed(1) + 'mpg')),
          h('div', {}, h('small', {}, '공차중량'), h('b', {}, ev.mass), h('i', {}, 'kg · 후륜 ' + Math.round(ev.rearFrac * 100) + '%'))),
        UI.kv('공기저항 Cd / 전면적', ev.A.cd.toFixed(3) + ' / ' + ev.A.frontal.toFixed(2) + ' m²'), UI.kv('제동 100→0', ev.brake100.toFixed(1) + ' m'), UI.kv('최대 횡가속도', ev.latG.toFixed(2) + ' g'),
        UI.kv('실내 / 적재', ev.A.cabinVol.toFixed(2) + ' m³ / ' + Math.round(ev.A.cargo * 1000) + ' L'), UI.kv('윈드실드 경사', Math.round(ev.A.wsAngle) + '°'), UI.kv('기어비 (최종)', ev.ratios.map(x => x.toFixed(2)).join(' · ')),
        h('div', { class: 'rr2' }, D.RATING_KEYS.map(k => UI.ratingRow(k, r[k]))),
        UI.kv('부품원가 (현재 물가)', U.money(ev.partsCost * D.cpi(G.t), false)), UI.kv('금형·지그 (공정 전)', U.money(ev.tooling * D.cpi(G.t))), UI.kv('차체 성형 난이도', ev.A.complexity.toFixed(2)), UI.kv('개발', ev.devMonths + '개월 · ' + U.money(ev.devCost * D.cpi(G.t))),
        h('h4', {}, '세그먼트 적합도 (현재가 기준)'), h('div', { class: 'fit' }, fit.slice(0, 4).map((f, i) => h('div', { class: i ? '' : 'top' }, h('span', {}, f.sg.name), UI.bar(f.u, 80), h('b', {}, f.u.toFixed(0))))),
        ev.warn.map(w => h('p', { class: 'warn' }, w)));
    };
    stats();
    // ── body editor canvases ──
    let drag = null, hover = null;
    const sideCv = UI.canvas('car-side', (x, W, H) => {
      const sc = Math.min((W - 40) / b.L, (H - 50) / b.H);
      const o = { x: (W - b.L * sc) / 2, y: H - 22, scale: sc, year: y, tireD: pair?.ev.tireD * 1000, spin: 0, redraw: () => { } };
      sideCv._o = o;
      // ground & dimension lines (real mm)
      x.strokeStyle = 'rgba(150,160,175,.35)'; x.beginPath(); x.moveTo(0, o.y); x.lineTo(W, o.y); x.stroke();
      R.drawCarSide(x, car, o);
      x.fillStyle = 'rgba(200,205,215,.8)'; x.font = '11px "IBM Plex Mono", monospace';
      x.fillText(`전장 ${b.L} · 휠베이스 ${b.wb} · 전고 ${b.H} mm`, 8, 14);
      if (!locked) {
        const pts = [...b.side.map((p, i) => ['side', i, p]), ...b.glass.map((p, i) => ['glass', i, p])];
        for (const [k, i, p] of pts) { const px = o.x + p.x * b.L * sc, py = o.y - p.y * b.H * sc; x.fillStyle = k === 'glass' ? '#6aa3d8' : '#d9a441'; x.strokeStyle = '#111'; x.beginPath(); x.arc(px, py, hover && hover[0] === k && hover[1] === i ? 7 : 4.5, 0, 7); x.fill(); x.stroke(); }
      }
    });
    const topCv = UI.canvas('car-top', (x, W, H) => {
      const sc = Math.min((W - 40) / b.L, (H - 20) / b.W);
      const o = { x: (W - b.L * sc) / 2, y: H / 2, scale: sc, year: y };
      topCv._o = o; R.drawCarTop(x, car, o);
      x.fillStyle = 'rgba(200,205,215,.8)'; x.font = '11px "IBM Plex Mono", monospace'; x.fillText(`전폭 ${b.W} mm`, 8, 14);
      if (!locked) for (let i = 0; i < b.top.length; i++) { const p = b.top[i]; const px = o.x + p.x * b.L * sc, py = o.y + p.y * b.W / 2 * sc; x.fillStyle = '#d9a441'; x.strokeStyle = '#111'; x.beginPath(); x.arc(px, py, hover && hover[0] === 'top' && hover[1] === i ? 7 : 4.5, 0, 7); x.fill(); x.stroke(); }
    });
    const hit = (cv, ev, keys) => {
      const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, o = cv._o; if (!o) return null;
      let best = null, bd = 14;
      for (const k of keys) b[k].forEach((p, i) => { const px = o.x + p.x * b.L * o.scale, py = k === 'top' ? o.y + p.y * b.W / 2 * o.scale : o.y - p.y * b.H * o.scale; const d = Math.hypot(px - mx, py - my); if (d < bd) { bd = d; best = [k, i]; } });
      return { best, mx, my, o };
    };
    const bindDrag = (cv, keys) => {
      cv.addEventListener('pointerdown', ev => { if (locked) return; const q = hit(cv, ev, keys); if (q?.best) { drag = { cv, k: q.best[0], i: q.best[1] }; cv.setPointerCapture(ev.pointerId); ev.preventDefault(); } });
      cv.addEventListener('pointermove', ev => {
        const q = hit(cv, ev, keys); if (!q) return;
        if (!drag) { hover = q.best; cv.style.cursor = q.best ? 'grab' : 'default'; return; }
        const p = b[drag.k][drag.i], o = q.o;
        if (drag.k === 'top') { p.x = U.clamp((q.mx - o.x) / (b.L * o.scale), 0, 1); p.y = U.clamp(Math.abs(q.my - o.y) / (b.W / 2 * o.scale), .2, 1); }
        else { p.x = U.clamp((q.mx - o.x) / (b.L * o.scale), 0, 1); p.y = U.clamp((o.y - q.my) / (b.H * o.scale), (b.clr + 40) / b.H, 1); }
      });
      const end = () => { if (drag) { drag = null; recalc(); } };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    };
    bindDrag(sideCv, ['side', 'glass']); bindDrag(topCv, ['top']);
    const sheet = D.byId(C.sheet, b.sheet);
    const texUp = h('input', { type: 'file', accept: 'image/*', onchange: ev => { const f = ev.target.files[0]; if (f) readImage(f, 512, url => { b.customTex = url; R.userImage(url, () => { }); UI.render(); }); } });
    const grp = (t, ...k) => h('fieldset', { disabled: locked }, h('legend', {}, t), ...k);
    const feat = k => UI.field(({ radio: '오디오', ac: '공조', steer: '조향 보조', belts: '안전벨트', airbag: '에어백', abs: 'ABS', esc: '자세제어', adas: '운전자 보조', crumple: '충돌 구조' })[k], UI.sel(C.features[k], car.features[k] || 0, G.t, v => set('features.' + k, v)));
    const engines = G.engines.map(e => ({ id: e.id, name: e.name + (e.status ? '' : ' (설계안)') }));
    return h('div', { class: 'grid design' },
      listCol(G.cars, car, o => { sel.car = o; UI.render(false); }, newC, cloneC, '차량'),
      h('div', { class: 'col' },
        h('div', { class: 'stage car' }, h('div', { class: 'cv' }, sideCv, h('label', {}, '측면도 — 점을 끌어 형상 편집 (주황: 차체, 파랑: 글라스)')), h('div', { class: 'cv' }, topCv, h('label', {}, '평면도 — 점을 끌어 폭 형상 편집'))),
        h('fieldset', { class: 'tools', disabled: locked },
          h('div', { class: 'row wrap' },
            UI.field('차체 형식', UI.sel(Object.entries(D.BODY_PRESETS).map(([id, p]) => ({ id, name: p.name })), b.preset, G.t, v => { const nb = S.bodyFromPreset(v); for (const k of ['sheet', 'grade', 'paint', 'customTex', 'rawSheet', 'metallic']) nb[k] = b[k]; car.body = nb; UI.render(); })),
            UI.field('강판 / 소재', UI.sel(C.sheet, b.sheet, G.t, v => { b.sheet = v; UI.render(); })),
            UI.field('등급 (가격)', UI.sel(sheet.grades.map(g => ({ id: g.id, name: g.name + ` · ×${g.cm}` })), b.grade, G.t, v => set('body.grade', v, 1))),
            UI.field('도장색', h('input', { type: 'color', value: b.paint, oninput: ev => { b.paint = ev.target.value; } })),
            h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: b.rawSheet, onchange: ev => { b.rawSheet = ev.target.checked; } }), '무도장 (원소재 보기)'),
            h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: b.metallic, disabled: G.t < 1958, onchange: ev => { b.metallic = ev.target.checked; } }), '메탈릭'),
            h('label', { class: 'fld file' }, h('span', {}, '강판 텍스처 업로드', h('i', {}, '차체 곡면에 맞게 변형')), texUp),
            b.customTex ? h('button', { class: 'btn sm ghost', onclick: () => { b.customTex = null; UI.render(); } }, '텍스처 해제') : null),
          h('div', { class: 'row wrap sliders' },
            UI.slider('전장', b.L, 3000, 6000, 10, v => { b.L = v; b.wb = Math.min(b.wb, v - 600); recalc(); }, v => v + 'mm'),
            UI.slider('전폭', b.W, 1400, 2200, 10, v => { b.W = v; recalc(); }, v => v + 'mm'),
            UI.slider('전고', b.H, 1000, 2100, 10, v => { b.H = v; recalc(); }, v => v + 'mm'),
            UI.slider('휠베이스', b.wb, 2000, Math.min(3800, b.L - 500), 10, v => { b.wb = v; recalc(); }, v => v + 'mm'),
            UI.slider('지상고', b.clr, 80, 300, 5, v => { b.clr = v; recalc(); }, v => v + 'mm'),
            UI.slider('앞 오버행 비율', b.foh, .25, .7, .01, v => { b.foh = v; recalc(); }, v => Math.round(v * 100) + '%'),
            UI.slider('캐릭터 라인 높이', b.charLine, .35, .75, .01, v => { b.charLine = v; }, v => Math.round(v * 100) + '%'),
            UI.slider('크롬 장식', b.chrome, 0, 1, .05, v => { b.chrome = v; recalc(); }, v => Math.round(v * 100) + '%'),
            UI.slider('좌석', b.seats, 2, 9, 1, v => { b.seats = v; recalc(); }),
            UI.field('도어', UI.sel([{ id: 2, name: '2도어' }, { id: 4, name: '4도어' }], b.doors, G.t, v => set('body.doors', v))))),
        h('div', { class: 'row' }, h('input', { class: 'inp', id: 'car-name', value: car.name, disabled: locked, oninput: ev => { car.name = ev.target.value; } }), statusChip(car),
          !locked ? h('button', { class: 'btn', onclick: () => { UI.err(S.startCarDev(G, car)) && UI.render(); } }, `개발 착수${pair ? ` (${pair.ev.devMonths}개월, ${U.money(pair.ev.devCost * D.cpi(G.t))})` : ''}`) : h('span', { class: 'mut' }, car.status === 'dev' ? `개발 ${Math.floor(car.dev.done)}/${car.dev.months}개월` : '설계 확정 — 개량하려면 복제(페이스리프트)')),
        car.reviews ? sec('언론 평가', h('div', { class: 'reviews' }, car.reviews.map(rv => h('div', { class: 'rv' }, h('b', {}, rv.mag), h('strong', {}, rv.score.toFixed(1)), h('p', {}, '“' + rv.line + '”'), h('small', {}, '장점: ' + rv.pros.join(', ')), h('small', {}, '단점: ' + rv.cons.join(', ')))))) : null),
      h('div', { class: 'col params' },
        grp('파워트레인', UI.field('엔진', UI.sel(engines, car.engineId, G.t, v => set('engineId', v, 1))), UI.field('구동 방식', UI.sel(C.drive, car.drive, G.t, v => set('drive', v))), UI.field('변속기', UI.sel(C.gearbox, car.gearbox, G.t, v => set('gearbox', v))), UI.slider('기어비 (연비↔가속)', car.gearing, 0, 100, 1, v => set('gearing', v))),
        grp('섀시', UI.field('프레임', UI.sel(C.chassis, car.chassis, G.t, v => set('chassis', v))), UI.field('앞 서스펜션', UI.sel(C.suspF, car.suspF, G.t, v => set('suspF', v))), UI.field('뒤 서스펜션', UI.sel(C.suspR, car.suspR, G.t, v => set('suspR', v))), UI.slider('스프링/댐퍼 (승차감↔핸들링)', car.springs, 0, 100, 1, v => set('springs', v)), UI.field('브레이크', UI.sel(C.brakes, car.brakes, G.t, v => set('brakes', v)))),
        grp('타이어·휠', UI.field('타이어', UI.sel(C.tires, car.tires, G.t, v => set('tires', v))), UI.slider('단면폭', car.tireW, 135, 335, 5, v => set('tireW', v), v => v + 'mm'), UI.slider('편평비', car.tireAR, 25, 90, 5, v => set('tireAR', v), v => v + '%'), UI.slider('림', car.rim, 12, 22, 1, v => set('rim', v), v => v + '"')),
        grp('실내·편의·안전', UI.field('인테리어', UI.sel(C.interior, car.interior, G.t, v => set('interior', v))), ...Object.keys(C.features).map(feat)),
        grp('품질', UI.slider('설계·조립 품질', car.quality, -5, 5, 1, v => set('quality', v))),
        sec('성능 · 평가', statsBox))
    );
  };
})(window.MW);
