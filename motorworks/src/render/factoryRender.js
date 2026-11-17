// Top-down factory: one hall per plant, one conveyor per line. Bodies travel through
// press → body shop → paint → trim/final → QA; each station is drawn by its process
// generation (hand benches, presses, robots, booths). Workers scale with man-hours.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim, R = MW.render;
  R.drawFactory = (ctx, G, f, w, h, t) => {
    ctx.fillStyle = '#c7c3b8'; ctx.fillRect(0, 0, w, h);                       // yard (concrete)
    ctx.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < w; i += 40) ctx.fillRect(i, 0, 1, h);
    const pad = 18, hx = pad, hy = 30, hw = w - pad * 2, hh = h - 48;
    ctx.fillStyle = '#e6e2d8'; ctx.fillRect(hx, hy, hw, hh); ctx.strokeStyle = '#6b665c'; ctx.lineWidth = 3; ctx.strokeRect(hx, hy, hw, hh);
    ctx.fillStyle = 'rgba(0,0,0,.06)'; for (let i = hx + 60; i < hx + hw; i += 60) ctx.fillRect(i, hy, 2, hh); // roof columns
    ctx.fillStyle = '#3d3a34'; ctx.font = '600 12px "IBM Plex Sans KR", sans-serif'; ctx.fillText(f.name + (G.t < f.ready ? '  (건설 중 ' + Math.round((1 - (f.ready - G.t)) * 100) + '%)' : ''), hx, 20);
    if (G.t < f.ready) { ctx.fillStyle = 'rgba(240,180,40,.25)'; ctx.fillRect(hx, hy, hw * (1 - (f.ready - G.t)), hh); ctx.strokeStyle = '#d29b16'; ctx.setLineDash([8, 6]); ctx.strokeRect(hx + 4, hy + 4, hw - 8, hh - 8); ctx.setLineDash([]); return; }
    const nL = f.lines.length, laneH = Math.min(110, (hh - 20) / nL);
    const st = D.P.stages, segW = (hw - 40) / st.length;
    st.forEach(([k, nm], i) => { ctx.fillStyle = '#6b665c'; ctx.font = '11px "IBM Plex Sans KR", sans-serif'; ctx.fillText(nm, hx + 20 + i * segW + 4, hy + 14); });
    f.lines.forEach((ln, li) => {
      const ly = hy + 22 + li * laneH + laneH / 2;
      // conveyor
      ctx.fillStyle = '#4b4943'; ctx.fillRect(hx + 20, ly - 9, hw - 40, 18);
      ctx.fillStyle = '#6c6a62'; for (let x = hx + 20 + ((t * 30) % 16); x < hx + hw - 20; x += 16) ctx.fillRect(x, ly - 9, 2, 18);
      st.forEach(([k], i) => {
        const P = D.byId(D.P[k], f.proc[k]), sx = hx + 20 + i * segW, sy = ly - laneH / 2 + 6;
        ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.strokeRect(sx, sy, segW, laneH - 12);
        const cx = sx + segW / 2;
        if (k === 'stamping') {
          const n = P.id === 'hand' ? 0 : P.id === 'press' ? 2 : P.id === 'tandem' ? 4 : 1;
          if (!n) { for (let j = 0; j < 3; j++) { ctx.fillStyle = '#8a6a44'; ctx.fillRect(sx + 10 + j * 30, ly - 30, 22, 12); } }
          for (let j = 0; j < n; j++) { const pw = n === 1 ? segW * .7 : segW / n - 8, px = n === 1 ? sx + segW * .15 : sx + 4 + j * (pw + 8); const hit = Math.sin(t * 4 + j) > .7; ctx.fillStyle = hit ? '#2f5d8a' : '#3b6f9f'; ctx.fillRect(px, ly - 34, pw, 22); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(px + 2, ly - 32, pw - 4, 4); }
        } else if (k === 'welding') {
          const robots = ['robot', 'laser', 'giga'].includes(P.id) ? 4 : 0;
          for (let j = 0; j < robots; j++) { const rx = sx + 14 + j * (segW - 28) / 3, ry = ly + (j % 2 ? 20 : -20); ctx.fillStyle = '#e69b12'; ctx.beginPath(); ctx.arc(rx, ry, 6, 0, 7); ctx.fill(); const a = Math.sin(t * 3 + j * 1.7) * .9 + (j % 2 ? -Math.PI / 2 : Math.PI / 2); ctx.strokeStyle = '#e69b12'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(a) * 14, ry - Math.sin(a) * 14 * (j % 2 ? -1 : 1)); ctx.stroke(); if (Math.sin(t * 9 + j) > .6) { ctx.fillStyle = P.id === 'laser' ? '#ff4040' : '#fff3a0'; ctx.beginPath(); ctx.arc(rx + Math.cos(a) * 14, ry - Math.sin(a) * 14 * (j % 2 ? -1 : 1), 3, 0, 7); ctx.fill(); } }
          if (!robots && Math.sin(t * 7) > .3) { ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(cx + Math.sin(t) * 20, ly - 12, 2.5, 0, 7); ctx.fill(); }
        } else if (k === 'paint') {
          ctx.fillStyle = P.id === 'brush' ? 'rgba(160,140,110,.3)' : 'rgba(90,140,190,.25)'; ctx.fillRect(sx + 6, ly - 22, segW - 12, 44);
          ctx.strokeStyle = 'rgba(40,80,120,.4)'; ctx.strokeRect(sx + 6, ly - 22, segW - 12, 44);
          if (P.id === 'ecoat' || P.id === 'robot' || P.id === 'water') { ctx.fillStyle = 'rgba(60,120,200,.35)'; ctx.fillRect(sx + 6, ly - 8, segW * .3, 16); }
        } else if (k === 'assembly') {
          ctx.fillStyle = '#b9b3a4'; ctx.fillRect(sx + 4, ly - 30, segW - 8, 8); ctx.fillRect(sx + 4, ly + 22, segW - 8, 8); // parts racks
          if (P.id === 'auto' || P.id === 'module') { ctx.fillStyle = '#2f8f6a'; const ax = sx + 10 + ((t * 25) % (segW - 30)); ctx.fillRect(ax, ly + 12, 14, 8); }
        } else {
          ctx.fillStyle = P.id === 'vision' || P.id === 'ai' ? '#1f6a4a' : '#6a6a6a'; ctx.fillRect(cx - 14, ly - 26, 28, 8); ctx.fillRect(cx - 14, ly + 18, 28, 8);
          if (P.id === 'vision' || P.id === 'ai') { ctx.strokeStyle = 'rgba(40,220,140,.5)'; ctx.beginPath(); ctx.moveTo(cx, ly - 18); ctx.lineTo(cx + Math.sin(t * 5) * 14, ly); ctx.stroke(); }
        }
      });
      const car = ln.modelId && S.carOf(G, ln.modelId);
      if (car) {
        const rate = (car.lastSales != null ? 1 : 1) * ln.rate / 100;
        const spacing = 46, speed = 14 * rate;
        for (let x = hx + 20 + ((t * speed) % spacing); x < hx + hw - 30; x += spacing) {
          const stage = Math.floor((x - hx - 20) / segW);
          R.drawCarMini(ctx, car, x + 10, ly, 34, 0, stage >= 2, stage);
        }
        // workers: dots proportional to labour hours
        const workers = Math.min(40, Math.round(f.workers / Math.max(1, nL) / 25));
        const rng = U.rng(li * 99 + 1);
        for (let k = 0; k < workers; k++) { const wx = hx + 24 + rng() * (hw - 48), wy = ly + (rng() < .5 ? -1 : 1) * (14 + rng() * (laneH / 2 - 22)); ctx.fillStyle = '#244f8f'; ctx.beginPath(); ctx.arc(wx + Math.sin(t * 2 + k) * 2, wy, 2.6, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#3d3a34'; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillText(`L${li + 1} ${car.name} · ${ln.rate}%`, hx + 22, ly + laneH / 2 - 8);
      } else { ctx.fillStyle = '#7d786c'; ctx.font = '11px "IBM Plex Sans KR", sans-serif'; ctx.fillText(`L${li + 1} — 배정된 모델 없음`, hx + 22, ly + 4 + laneH / 2 - 14); }
    });
  };
})(window.MW);
