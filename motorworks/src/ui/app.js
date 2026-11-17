// App shell: top bar (company, date, cash, speed), navigation, game loop, shared widgets.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim, UI = MW.ui, h = U.h;
  UI.screens = {};
  UI.state = { tab: 'hq', speed: 0, acc: 0, last: 0, anim: 0 };
  let G;
  UI.G = () => G;
  UI.toast = (msg, kind = '') => { const t = h('div', { class: 'toast ' + kind }, msg); document.getElementById('toasts').append(t); setTimeout(() => t.remove(), 3800); };
  UI.err = (r) => { if (r) UI.toast(r, 'bad'); return !r; };

  // catalogue select with era availability
  UI.sel = (list, value, year, onch, opt = {}) => {
    const s = h('select', { class: 'sel', id: opt.id });
    for (const o of list) {
      const av = D.avail(o, year) && (!opt.filter || opt.filter(o));
      const mat = D.maturity(o, year);
      const lab = o.name + (!D.avail(o, year) ? `  (${o.intro}년~)` : mat < .6 ? '  · 신기술' : '');
      const op = h('option', { value: o.id, disabled: !av }, lab); if (String(o.id) === String(value)) op.selected = true; s.append(op);
    }
    s.onchange = () => onch(isNaN(+s.value) || typeof list[0].id === 'string' ? s.value : +s.value);
    return s;
  };
  UI.slider = (label, value, min, max, step, onin, fmt = v => v) => {
    const out = h('b', {}, fmt(value));
    const r = h('input', { type: 'range', min, max, step, value });
    r.oninput = () => { out.textContent = fmt(+r.value); onin(+r.value); };
    return h('label', { class: 'fld' }, h('span', {}, label, out), r);
  };
  UI.field = (label, el, hint) => h('label', { class: 'fld' }, h('span', {}, label, hint ? h('i', {}, hint) : null), el);
  UI.bar = (v, max = 100, cls = '') => h('div', { class: 'bar ' + cls }, h('s', { style: { width: U.clamp(v / max * 100, 0, 100) + '%' } }));
  UI.ratingRow = (k, v, cmp) => h('div', { class: 'rr' }, h('span', {}, D.RATING_NAME[k] || k), UI.bar(v, 100, v >= 65 ? 'g' : v < 35 ? 'r' : ''), h('b', {}, Math.round(v)), cmp != null ? h('em', { class: v - cmp >= 0 ? 'up' : 'dn' }, (v - cmp >= 0 ? '+' : '') + Math.round(v - cmp)) : null);
  UI.kv = (k, v, cls) => h('div', { class: 'kv ' + (cls || '') }, h('span', {}, k), h('b', {}, v));
  UI.money = v => U.money(v);

  // tiny line chart
  UI.chart = (series, opt = {}) => {
    const c = h('canvas', { class: 'chart', width: opt.w || 520, height: opt.h || 150 });
    requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1, W = c.clientWidth || opt.w || 520, H = c.clientHeight || opt.h || 150;
      c.width = W * dpr; c.height = H * dpr; const x = c.getContext('2d'); x.scale(dpr, dpr);
      const cs = getComputedStyle(document.documentElement);
      const all = series.flatMap(s => s.data); if (!all.length) { x.fillStyle = cs.getPropertyValue('--mut'); x.font = '12px sans-serif'; x.fillText('데이터 없음 — 시간을 진행하세요', 10, H / 2); return; }
      let mn = Math.min(0, ...all), mx = Math.max(...all); if (mx === mn) mx = mn + 1;
      const L = 56, Rr = 8, T = 10, B = 20, Y = v => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
      x.strokeStyle = cs.getPropertyValue('--line'); x.fillStyle = cs.getPropertyValue('--mut'); x.font = '10px "IBM Plex Mono", monospace';
      for (let i = 0; i <= 3; i++) { const v = mn + (mx - mn) * i / 3; x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(W - Rr, Y(v)); x.stroke(); x.fillText(opt.fmt ? opt.fmt(v) : U.num(v), 2, Y(v) + 3); }
      if (mn < 0) { x.strokeStyle = cs.getPropertyValue('--mut'); x.beginPath(); x.moveTo(L, Y(0)); x.lineTo(W - Rr, Y(0)); x.stroke(); }
      for (const s of series) {
        const n = s.data.length, X = i => L + i / Math.max(1, n - 1) * (W - L - Rr);
        if (s.area) { x.beginPath(); x.moveTo(X(0), Y(Math.max(mn, 0))); s.data.forEach((v, i) => x.lineTo(X(i), Y(v))); x.lineTo(X(n - 1), Y(Math.max(mn, 0))); x.fillStyle = s.color + '30'; x.fill(); }
        x.beginPath(); s.data.forEach((v, i) => i ? x.lineTo(X(i), Y(v)) : x.moveTo(X(i), Y(v))); x.strokeStyle = s.color; x.lineWidth = 1.8; x.stroke();
        x.fillStyle = s.color; x.beginPath(); x.arc(X(n - 1), Y(s.data[n - 1]), 3, 0, 7); x.fill();
      }
      if (opt.labels) { x.fillStyle = cs.getPropertyValue('--mut'); x.fillText(opt.labels[0], L, H - 4); const tw = x.measureText(opt.labels[1]).width; x.fillText(opt.labels[1], W - Rr - tw, H - 4); }
    });
    return c;
  };

  // canvas helper sized to its box with DPR
  UI.canvas = (cls, draw) => {
    const c = h('canvas', { class: cls });
    c._draw = () => { const dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight; if (!W) return; if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; } const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H); draw(x, W, H); };
    c.classList.add('live');
    return c;
  };

  const TABS = [['hq', '본사'], ['engine', '엔진 설계'], ['car', '차량 설계'], ['factory', '공장·생산'], ['sales', '판매·딜러'], ['market', '시장·경쟁'], ['finance', '재무']];
  UI.go = (tab) => { UI.state.tab = tab; render(); try { localStorage.setItem('mw_tab', tab); } catch (e) { } };

  const topbar = () => {
    const L = G.lastL || {};
    const speeds = [['❚❚', 0], ['▶', 1], ['▶▶', 2], ['▶▶▶', 3]];
    return h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('div', { class: 'logo' }, 'MW'), h('div', {}, h('b', {}, G.name), h('small', {}, '평판 ' + Math.round(G.rep) + ' · 엔지니어 ' + G.eng + '명'))),
      h('div', { class: 'date' }, h('b', { id: 'tb-date' }, S.ym(G.t)), h('small', {}, D.eventsAt(G.t).map(e => e.name).join(' · ') || ('CPI ×' + D.cpi(G.t).toFixed(2) + ' · 금리 ' + U.table(D.PRIME, G.t).toFixed(1) + '%'))),
      h('div', { class: 'cash' + (G.cash < 0 ? ' neg' : '') }, h('small', {}, '현금'), h('b', { id: 'tb-cash' }, U.money(G.cash)), h('small', {}, '지난달 순이익 ' + U.money(L.net || 0))),
      h('div', { class: 'speed' }, speeds.map(([t, v]) => h('button', { class: UI.state.speed === v ? 'on' : '', onclick: () => { UI.state.speed = v; render(); }, title: v ? '속도 ' + v : '일시정지' }, t)), h('button', { class: 'step', onclick: () => { S.step(G); render(); } }, '+1개월'))
    );
  };
  const nav = () => h('nav', { class: 'nav' }, TABS.map(([id, nm]) => h('button', { class: UI.state.tab === id ? 'on' : '', onclick: () => UI.go(id) }, nm)),
    h('div', { class: 'navx' }, h('button', { onclick: () => { UI.err(S.save(G) ? null : '저장 실패') && UI.toast('저장했습니다', 'good'); } }, '저장'), h('button', { onclick: () => { const L = S.load(); if (L) { G = L; S.initRivals && !G.rivals && S.initRivals(G); UI.toast('불러왔습니다', 'good'); render(); } else UI.toast('저장 파일이 없습니다', 'bad'); } }, '불러오기'), h('button', { onclick: () => { UI.newGameDialog(); } }, '새 게임')));

  let root;
  const render = () => {
    const main = h('main', { class: 'main', id: 'main' });
    const scr = UI.screens[UI.state.tab]; try { main.append(scr(G)); } catch (e) { console.error(e); main.append(h('pre', { class: 'errbox' }, String(e.stack || e))); }
    const sc = document.getElementById('main')?.scrollTop || 0;
    root.replaceChildren(topbar(), nav(), main);
    main.scrollTop = UI.state.keepScroll ? sc : 0; UI.state.keepScroll = false;
    if (G.over) root.append(h('div', { class: 'modal' }, h('div', { class: 'card' }, h('h2', {}, G.over === 'bankrupt' ? '파산' : '2035년 — 게임 종료'), h('p', {}, `최종 자기자본 ${U.money(S.balance(G).equity)} · 누적 판매 ${U.num(U.sum(G.cars.map(c => c.sold || 0)))}대 · 평판 ${Math.round(G.rep)}`), h('button', { class: 'btn', onclick: () => UI.newGameDialog() }, '새 게임'))));
  };
  UI.render = (keep = true) => { UI.state.keepScroll = keep; render(); };
  UI.newGameDialog = () => {
    const name = h('input', { class: 'inp', id: 'ng-name', value: 'Meridian Motor Works' });
    const m = h('div', { class: 'modal' }, h('div', { class: 'card' }, h('h2', {}, '새 회사 설립 — 1946년 1월'), h('p', {}, '전후 호황기. 자본금 $5M(1946년 달러)으로 엔진과 차를 설계하고, 공장을 짓고, 딜러망을 꾸려 2035년까지 살아남으세요. 가격·임금·원자재는 실제 인플레이션(CPI)을 따라 오릅니다.'),
      UI.field('회사 이름', name), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { G = S.newGame({ name: name.value || 'Meridian Motor Works' }); UI.state.tab = 'hq'; m.remove(); render(); } }, '설립'), h('button', { class: 'btn ghost', onclick: () => m.remove() }, '취소'))));
    document.body.append(m);
  };

  // loop
  const frame = (ts) => {
    const dt = Math.min(.1, (ts - (UI.state.last || ts)) / 1000); UI.state.last = ts; UI.state.anim += dt;
    const sp = UI.state.speed;
    if (sp && !G.over) {
      UI.state.acc += dt;
      const per = [0, 1.4, .6, .2][sp];
      if (UI.state.acc >= per) { UI.state.acc = 0; S.step(G); const hot = ['hq', 'finance', 'sales', 'factory', 'market'].includes(UI.state.tab); if (hot && !document.activeElement?.matches('input,select')) UI.render(true); else { const d = document.getElementById('tb-date'); if (d) d.textContent = S.ym(G.t); const c = document.getElementById('tb-cash'); if (c) c.textContent = U.money(G.cash); } if (G.month === 0) S.save(G); }
    }
    document.querySelectorAll('canvas.live').forEach(c => c._draw && c._draw());
    requestAnimationFrame(frame);
  };
  UI.start = () => {
    root = document.getElementById('app');
    G = S.load() || S.newGame({});
    if (!G.rivals) S.initRivals(G);
    try { const t = localStorage.getItem('mw_tab'); if (t && UI.screens[t]) UI.state.tab = t; } catch (e) { }
    render(); requestAnimationFrame(frame);
  };
})(window.MW);
