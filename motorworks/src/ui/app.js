// Application shell: menubar, workspace switcher, explorer tree, document area,
// inspector, status bar, game loop and shared widgets.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim, R = MW.render, UI = MW.ui, h = U.h;
  UI.screens = {};
  UI.state = { ws: 'overview', speed: 0, acc: 0, last: 0, anim: 0, sel: {}, tab: {} };
  let G;
  UI.G = () => G;

  // ── widgets ──
  UI.toast = (msg, kind = '') => { const t = h('div', { class: 'toast ' + kind, role: 'status' }, msg); document.getElementById('toasts').append(t); setTimeout(() => t.remove(), 4200); };
  UI.err = (r) => { if (r) UI.toast(r, 'bad'); return !r; };
  UI.sel = (list, value, year, onch, opt = {}) => {
    const s = h('select', { class: 'in', id: opt.id, disabled: opt.disabled });
    for (const o of list) {
      const av = (year == null || D.avail(o, year)) && (!opt.filter || opt.filter(o));
      const mat = year == null ? 1 : D.maturity(o, year);
      const op = h('option', { value: o.id, disabled: !av }, o.name + (year != null && !D.avail(o, year) ? `  — ${o.intro}년~` : mat < .6 ? '  · 신기술' : ''));
      if (String(o.id) === String(value)) op.selected = true; s.append(op);
    }
    s.onchange = () => { const v = list.find(o => String(o.id) === s.value)?.id; onch(v); };
    return s;
  };
  UI.range = (value, min, max, step, onin, fmt = v => v, opt = {}) => {
    const out = h('output', {}, fmt(value));
    const r = h('input', { type: 'range', min, max, step, value, disabled: opt.disabled, 'aria-label': opt.label || '' });
    r.oninput = () => { out.textContent = fmt(+r.value); onin(+r.value); };
    return h('div', { class: 'rng' }, r, out);
  };
  UI.prop = (label, el, hint) => h('div', { class: 'prop' }, h('label', {}, label, hint ? h('small', {}, hint) : null), h('div', { class: 'pv' }, el));
  UI.group = (title, ...rows) => h('details', { class: 'grp', open: true }, h('summary', {}, title), h('div', { class: 'grpb' }, ...rows));
  UI.kv = (k, v, cls) => h('div', { class: 'kv ' + (cls || '') }, h('span', {}, k), h('b', {}, v));
  UI.bar = (v, max = 100, cls = '') => h('span', { class: 'bar ' + cls }, h('i', { style: { width: U.clamp(v / max * 100, 0, 100) + '%' } }));
  UI.chip = (txt, cls = '') => h('span', { class: 'chip ' + cls }, txt);
  UI.btn = (txt, on, cls = '', attrs = {}) => h('button', { class: 'b ' + cls, onclick: on, ...attrs }, txt);
  UI.statusChip = o => UI.chip({ dev: '개발 중', ready: '개발 완료', production: '생산 중', retired: '단종' }[o.status] || '설계안', o.status || 'draft');
  UI.ratingRow = (k, v, ref) => h('div', { class: 'rr' }, h('span', {}, D.RATING_NAME[k] || k), UI.bar(v, 100, v >= 65 ? 'g' : v < 35 ? 'r' : ''), h('b', {}, Math.round(v)), ref != null ? h('em', { class: v >= ref ? 'up' : 'dn' }, (v >= ref ? '+' : '') + Math.round(v - ref)) : h('em'));
  UI.tabs = (items, active, onch) => h('div', { class: 'tabs', role: 'tablist' }, items.map(([id, nm]) => h('button', { role: 'tab', 'aria-selected': id === active, class: id === active ? 'on' : '', onclick: () => onch(id) }, nm)));
  UI.kpi = (label, value, sub, cls = '') => h('div', { class: 'kpi ' + cls }, h('span', {}, label), h('b', {}, value), sub ? h('small', {}, sub) : null);
  // sortable table: cols [{k, t, f(row)->node|string, num}]
  UI.table = (cols, rows, opt = {}) => {
    let sortK = opt.sort, dir = opt.dir || -1;
    const wrap = h('div', { class: 'tw' });
    const draw = () => {
      const rs = rows.slice();
      if (sortK != null) { const c = cols.find(c => c.k === sortK); rs.sort((a, b) => { const va = c.v ? c.v(a) : a[c.k], vb = c.v ? c.v(b) : b[c.k]; return (va > vb ? 1 : va < vb ? -1 : 0) * dir; }); }
      wrap.replaceChildren(h('table', { class: 'tb' + (opt.dense ? ' dense' : '') },
        h('thead', {}, h('tr', {}, cols.map(c => h('th', { class: c.num ? 'n' : '', onclick: () => { if (sortK === c.k) dir = -dir; sortK = c.k; draw(); } }, c.t, sortK === c.k ? (dir > 0 ? ' ▲' : ' ▼') : '')))),
        h('tbody', {}, rs.map(r => h('tr', { class: (opt.rowClass ? opt.rowClass(r) : '') + (opt.onRow ? ' click' : ''), onclick: opt.onRow ? () => opt.onRow(r) : null }, cols.map(c => h('td', { class: c.num ? 'n' : '' }, c.f ? c.f(r) : r[c.k])))))));
    };
    draw(); return wrap;
  };
  UI.chart = (series, opt = {}) => {
    const c = h('canvas', { class: 'chart', style: { height: (opt.h || 140) + 'px' } });
    const paint = () => {
      const dpr = window.devicePixelRatio || 1, W = c.clientWidth || 400, H = c.clientHeight || 140;
      c.width = W * dpr; c.height = H * dpr; const x = c.getContext('2d'); x.scale(dpr, dpr);
      const cs = getComputedStyle(document.documentElement), ink = cs.getPropertyValue('--mut').trim(), line = cs.getPropertyValue('--line').trim();
      const all = series.flatMap(s => s.data).filter(v => isFinite(v));
      x.font = '10px "IBM Plex Mono", monospace'; x.fillStyle = ink;
      if (!all.length) { x.fillText('데이터 없음 — 시간을 진행하세요', 8, H / 2); return; }
      let mn = Math.min(0, ...all), mx = Math.max(...all); if (mx === mn) mx = mn + 1;
      const L = 58, Rr = 6, T = 8, B = opt.labels ? 18 : 8, Y = v => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
      x.strokeStyle = line; x.lineWidth = 1;
      for (let i = 0; i <= 3; i++) { const v = mn + (mx - mn) * i / 3; x.beginPath(); x.moveTo(L, Math.round(Y(v)) + .5); x.lineTo(W - Rr, Math.round(Y(v)) + .5); x.stroke(); x.fillText(opt.fmt ? opt.fmt(v) : U.num(v), 2, Y(v) + 3); }
      for (const s of series) {
        const n = s.data.length, X = i => L + i / Math.max(1, n - 1) * (W - L - Rr);
        if (s.area) { x.beginPath(); x.moveTo(X(0), Y(Math.max(mn, 0))); s.data.forEach((v, i) => x.lineTo(X(i), Y(v))); x.lineTo(X(n - 1), Y(Math.max(mn, 0))); x.fillStyle = s.color + '22'; x.fill(); }
        x.beginPath(); s.data.forEach((v, i) => i ? x.lineTo(X(i), Y(v)) : x.moveTo(X(i), Y(v))); x.strokeStyle = s.color; x.lineWidth = 1.6; x.stroke();
        x.fillStyle = s.color; x.beginPath(); x.arc(X(n - 1), Y(s.data[n - 1]), 2.6, 0, 7); x.fill();
      }
      if (opt.labels) { x.fillStyle = ink; x.fillText(opt.labels[0], L, H - 4); const tw = x.measureText(opt.labels[1]).width; x.fillText(opt.labels[1], W - Rr - tw, H - 4); }
      if (opt.legend) { let lx = L + 4; for (const s of series) { x.fillStyle = s.color; x.fillRect(lx, T + 2, 10, 2); x.fillStyle = ink; x.fillText(s.name || '', lx + 14, T + 6); lx += 22 + x.measureText(s.name || '').width; } }
    };
    requestAnimationFrame(paint); c._repaint = paint; return c;
  };
  // live canvas sized to its box
  UI.canvas = (cls, draw) => {
    const c = h('canvas', { class: cls + ' live' });
    c._draw = () => { const dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight; if (!W || !H) return; if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); } const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H); draw(x, W, H); };
    return c;
  };
  UI.STUDIO = { sky0: '#eef0f2', sky1: '#d3d7dc', floor0: '#b9bec4', floor1: '#d9dcdf' };
  // car viewport: side view in a studio with floor reflection
  UI.carSide = (car, year, opt = {}) => UI.canvas('vp', (x, W, H) => {
    const b = car.body, gy = H * (opt.ground || .78);
    R.studio(x, W, H, gy, UI.STUDIO);
    const sc = Math.min((W - 60) / b.L, (gy - 30) / b.H) * (opt.zoom || .92);
    const ox = (W - b.L * sc) / 2;
    R.drawCarSide(x, car, { x: ox, y: gy, scale: sc, year, reflect: 1, floor: UI.STUDIO.floor0 });
    if (opt.after) opt.after(x, { ox, gy, sc, W, H });
  });

  // ── workspaces ──
  const WS = [['overview', '개요'], ['platform', '플랫폼'], ['engine', '엔진'], ['car', '차량'], ['factory', '생산'], ['sales', '판매'], ['market', '시장·경쟁'], ['press', '언론·평가'], ['finance', '재무']];
  UI.go = (ws, sel) => { UI.state.ws = ws; if (sel) Object.assign(UI.state.sel, sel); render(false); try { localStorage.setItem('mw_ws', ws); } catch (e) { } };

  const explorer = () => {
    const sel = UI.state.sel;
    const node = (ws, key, o, label, extra) => h('button', { class: 'tn' + (UI.state.ws === ws && sel[key] === o.id ? ' on' : ''), onclick: () => UI.go(ws, { [key]: o.id }) }, h('span', {}, label), extra || '');
    const sec = (title, items, add) => h('div', { class: 'ts' }, h('div', { class: 'th' }, h('span', {}, title), add ? h('button', { class: 'tadd', title: '새로 만들기', onclick: add }, '+') : null), ...items);
    return h('aside', { class: 'explorer', 'aria-label': '프로젝트 탐색기' },
      sec('플랫폼', G.platforms.map(p => node('platform', 'platform', p, p.name, UI.statusChip(p))), () => UI.newPlatform()),
      sec('엔진', G.engines.map(e => node('engine', 'engine', e, e.name, UI.statusChip(e))), () => UI.newEngine()),
      sec('차량', G.cars.map(c => node('car', 'car', c, c.name, UI.statusChip(c))), () => UI.newCar()),
      sec('공장', G.factories.map(f => node('factory', 'factory', f, f.name, h('small', {}, G.t < f.ready ? '건설 중' : f.lines.length + 'L'))), () => UI.go('factory', { factory: 'new' })),
      sec('경쟁사', G.rivals.filter(r => r.alive).map(r => node('market', 'rival', r, r.name, h('i', { class: 'sw', style: { background: r.color } })))));
  };

  const statusbar = () => {
    const L = G.lastL || {};
    const sp = [['❚❚', 0, '일시정지'], ['▶', 1, '보통'], ['▶▶', 2, '빠르게'], ['▶▶▶', 3, '매우 빠르게']];
    const evs = D.eventsAt(G.t);
    return h('footer', { class: 'status' },
      h('div', { class: 'clock' }, sp.map(([t, v, nm]) => h('button', { class: UI.state.speed === v ? 'on' : '', title: nm, 'aria-label': nm, onclick: () => { UI.state.speed = v; render(); } }, t)), h('button', { onclick: () => { S.step(G); render(); }, title: '한 달 진행' }, '+1개월')),
      h('div', { class: 'sb' }, h('span', {}, '날짜'), h('b', { id: 'sb-date' }, S.ym(G.t))),
      h('div', { class: 'sb' + (G.cash < 0 ? ' neg' : '') }, h('span', {}, '현금'), h('b', { id: 'sb-cash' }, U.money(G.cash))),
      h('div', { class: 'sb' }, h('span', {}, '월 순이익'), h('b', { class: (L.net || 0) < 0 ? 'neg' : '' }, U.money(L.net || 0))),
      h('div', { class: 'sb' }, h('span', {}, '판매'), h('b', {}, U.num(L.units || 0) + '대')),
      h('div', { class: 'sb' }, h('span', {}, 'CPI·금리'), h('b', {}, '×' + D.cpi(G.t).toFixed(2) + ' · ' + U.table(D.PRIME, G.t).toFixed(1) + '%')),
      h('div', { class: 'ticker', title: G.log[0]?.msg }, evs.length ? h('b', { class: 'evt' }, evs.map(e => e.name).join(' · ')) : null, h('span', {}, G.log[0] ? S.ym(G.log[0].t) + '  ' + G.log[0].msg : '')));
  };

  const menubar = () => h('header', { class: 'menubar' },
    h('div', { class: 'app' }, h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, html: '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2.5v6M12 15.5v6M2.5 12h6M15.5 12h6" stroke="currentColor" stroke-width="2"/>' }), h('b', {}, 'MotorWorks')),
    h('div', { class: 'co' }, G.name, h('small', {}, `평판 ${Math.round(G.rep)} · 엔지니어 ${G.eng}명${G.shares.public ? ` · 주가 $${G.shares.price.toFixed(2)}` : ''}`)),
    h('nav', { class: 'ws', 'aria-label': '작업공간' }, WS.map(([id, nm]) => h('button', { class: UI.state.ws === id ? 'on' : '', onclick: () => UI.go(id) }, nm))),
    h('div', { class: 'file' }, UI.btn('저장', () => UI.err(S.save(G) ? null : '저장하지 못했습니다 (브라우저 저장소 차단)') && UI.toast('저장했습니다', 'good'), 'ghost'),
      UI.btn('불러오기', () => { const L = S.load(); if (L && L.v === 2) { G = L; UI.toast('불러왔습니다', 'good'); render(false); } else UI.toast('저장된 게임이 없습니다', 'bad'); }, 'ghost'),
      UI.btn('새 게임', () => UI.newGameDialog(), 'ghost')));

  let root;
  const render = (keep = true) => {
    const docEl = document.getElementById('doc'), sc = keep && docEl ? docEl.scrollTop : 0;
    const ae = document.activeElement, aid = ae && ae.id;
    const doc = h('main', { class: 'doc', id: 'doc' });
    try { doc.append(UI.screens[UI.state.ws](G)); } catch (e) { console.error(e); doc.append(h('pre', { class: 'errbox' }, String(e.stack || e))); }
    root.replaceChildren(menubar(), h('div', { class: 'body' }, explorer(), doc), statusbar());
    doc.scrollTop = sc;
    if (aid) document.getElementById(aid)?.focus();
    if (G.over) root.append(h('div', { class: 'modal' }, h('div', { class: 'dlg' }, h('h2', {}, G.over === 'bankrupt' ? '파산' : '2035년 — 게임 종료'), h('p', {}, `최종 자기자본 ${U.money(S.balance(G).equity)} · 누적 판매 ${U.num(U.sum(G.cars.map(c => c.sold || 0)))}대 · 평판 ${Math.round(G.rep)}`), UI.btn('새 게임', () => UI.newGameDialog(), 'pri'))));
  };
  UI.render = (keep = true) => render(keep);
  UI.newGameDialog = () => {
    const name = h('input', { class: 'in', id: 'ng-name', value: 'Meridian Motor Works' });
    const m = h('div', { class: 'modal' }, h('div', { class: 'dlg' }, h('h2', {}, '새 회사 — 1946년 1월'),
      h('p', {}, '전후 수요가 공급을 앞지르는 판매자 시장입니다. 자본금 $5M(1946년 달러)과 전쟁 전 래더 프레임 플랫폼 하나로 시작합니다. 가격·임금·원자재는 실제 물가(CPI)를 따라 오르고, 경쟁사들은 같은 규칙으로 차를 설계·생산하며 성장하거나 망합니다.'),
      UI.prop('회사 이름', name), h('div', { class: 'row' }, UI.btn('설립', () => { G = S.newGame({ name: name.value || 'Meridian Motor Works' }); UI.state.ws = 'overview'; UI.state.sel = {}; m.remove(); render(false); }, 'pri'), UI.btn('취소', () => m.remove(), 'ghost'))));
    document.body.append(m); name.focus();
  };

  const frame = (ts) => {
    const dt = Math.min(.1, (ts - (UI.state.last || ts)) / 1000); UI.state.last = ts; UI.state.anim += dt;
    const sp = UI.state.speed;
    if (sp && !G.over) {
      UI.state.acc += dt;
      if (UI.state.acc >= [0, 1.4, .6, .2][sp]) {
        UI.state.acc = 0; S.step(G);
        const busy = document.activeElement?.matches('input,select,textarea');
        if (!busy && ['overview', 'finance', 'sales', 'factory', 'market', 'press'].includes(UI.state.ws)) render(true);
        else { const d = document.getElementById('sb-date'); if (d) d.textContent = S.ym(G.t); const c = document.getElementById('sb-cash'); if (c) c.textContent = U.money(G.cash); }
        if (G.month === 0) S.save(G);
      }
    }
    document.querySelectorAll('canvas.live').forEach(c => c._draw && c._draw());
    requestAnimationFrame(frame);
  };
  UI.start = () => {
    root = document.getElementById('app');
    const L = S.load(); G = L && L.v === 2 ? L : S.newGame({});
    if (!G.rivals) S.initRivals(G);
    try { const w = localStorage.getItem('mw_ws'); if (w && UI.screens[w]) UI.state.ws = w; } catch (e) { }
    window.addEventListener('resize', () => document.querySelectorAll('canvas.chart').forEach(c => c._repaint && c._repaint()));
    render(false); requestAnimationFrame(frame);
  };
})(window.MW);
