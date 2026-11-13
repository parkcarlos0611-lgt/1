// Indirect fire for the howitzer (M109A3). I switches between direct fire (telescope) and indirect fire.
// Indirect: the terrain map opens large; a click on it sets the target point; the charge is chosen and the
// two firing solutions (low and high angle) are computed with the same trajectory model the shells use; the
// gun is laid by hand (W / S against the required elevation) or automatically (J). The map shows the computed
// arc, the shell in flight and where it burst, with the miss distance; Tab follows the shell.
Object.assign(DS.Game.prototype, {
  artyInit() {
    this.arty = { on: false, tgt: null, high: false, auto: true, sol: null, imp: [], span: null, t: 0, live: [] };
    const cv = this.amap = document.getElementById('artymap');
    cv.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' && !e.isPrimary) return;
      const A = this.arty; if (!A.on || !A.view) return;
      const r = cv.getBoundingClientRect(), u = (e.clientX - r.left) / r.width;
      const x = A.view.x0 + u * (A.view.x1 - A.view.x0);
      this.artyTarget(Math.max(20, Math.min(this.world.terrain.length - 20, x)));
    });
    cv.addEventListener('wheel', e => {
      const A = this.arty; if (!A.on || !A.view) return; e.preventDefault();
      const r = cv.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, V = A.view, xm = V.x0 + u * (V.x1 - V.x0);
      const k = Math.exp(e.deltaY * 0.0015), L = this.world.terrain.length;
      let x0 = xm - (xm - V.x0) * k, x1 = xm + (V.x1 - xm) * k;
      if (x1 - x0 < 300) return;
      A.span = { x0: Math.max(0, x0), x1: Math.min(L, x1) };
    }, { passive: false });
  },
  artyKey(e) {
    const v = this.player, A = this.arty;
    if (!v.def.howitzer) { if (e.code === 'KeyI') this.toast('곡사 모드는 자주포 전용'); return false; }
    if (e.code === 'KeyI') { if (v.def.indirectOnly) this.toast('MLRS는 곡사 전용'); else this.artySet(!A.on); return true; }
    if (e.code === 'KeyK') { const C = v.def.gun.charges; if (!C) { this.toast('로켓은 장약 선택 없음'); return true; } v.gun.charge = ((v.gun.charge == null ? C.length - 1 : v.gun.charge) + (e.shiftKey ? C.length - 1 : 1)) % C.length; A.autoCharge = false; this.artySolve(); this.toast(`장약 ${C[v.gun.charge].n} · 포구속도 ${C[v.gun.charge].v0} m/s`); if (!A.on) DS.FireControl.update(this.world, v, false); return true; }
    if (!A.on) return false;
    if (e.code === 'KeyO') { A.high = !A.high; this.toast(A.high ? '고각 사격' : '저각 사격'); return true; }
    if (e.code === 'KeyJ') { A.auto = !A.auto; this.toast(A.auto ? '자동 정렬' : '수동 정렬 — W / S로 요구 앙각에 맞춤'); return true; }
    return false;
  },
  artySet(on) {
    const v = this.player, A = this.arty;
    A.on = on && !!v.def.howitzer; document.body.classList.toggle('arty', A.on);
    v.fc.indirect = A.on;
    if (A.on) { v.fc.se = 0; A.span = null; if (A.tgt) this.artySolve(); this.toast('곡사 모드 — 지도에서 표적 지점을 클릭'); }
    else { v.gun.charge = v.def.gun.directCharge || 0; v.gun.aimW = v.baseAng(); DS.FireControl.update(this.world, v, false); this.toast('직사 모드 — 포를 수평으로'); }
  },
  // where a shell fired at elevation `el` (rad above horizontal, toward the target) comes down to height ty
  artyShot(el, ty, keep) {
    const v = this.player, A = DS.AMMO[v.gun.ammo], v0 = v.muzzleV(A), s = this.arty.dir;
    const tp = v.local(v.g.trunnion.x, v.g.trunnion.y), L = v.def.gun.muzzle;
    const flat = { height: () => -1e9, n: 1e9, dx: 1 };
    const p = new DS.Projectile(tp.x + s * Math.cos(el) * L, tp.y + Math.sin(el) * L, s * Math.cos(el) * v0, Math.sin(el) * v0, A, null);
    const path = keep ? [p.x, p.y] : null; let px = p.x, py = p.y, n = 0;
    while (p.t < 160) {
      px = p.x; py = p.y;
      // while a rocket motor burns the game's own step is used, so the prediction matches the real flight
      if (A.rocket && p.t < A.rocket.at + A.rocket.burn + 0.05 && p.t >= A.rocket.at - 0.05) { for (let k = 0; k < 12; k++) p.step(1 / 240, flat); } else p.step(1 / 20, flat);
      if (keep && ++n % 8 === 0) path.push(p.x, p.y);
      if (p.vy < 0 && p.y <= ty) break;
    }
    const f = (py - ty) / ((py - p.y) || 1e-9), x = px + (p.x - px) * f;
    if (keep) path.push(x, ty);
    return { r: Math.abs(x - tp.x), tof: p.t, path, apex: 0 };
  },
  artyTarget(x) {
    const v = this.player, A = this.arty, T = this.world.terrain;
    A.tgt = { x, y: T.height(x) }; A.autoCharge = true; A.imp.length = 0;
    this.artySolve();
  },
  artySolve() {
    const v = this.player, A = this.arty; if (!A.tgt || !v.def.howitzer) { A.sol = null; return; }
    const C = v.def.gun.charges || [{ n: '—', v0: 0 }], G = v.def.gun, d2r = Math.PI / 180, ty = A.tgt.y;
    const tp = v.local(v.g.trunnion.x, v.g.trunnion.y), D = Math.abs(A.tgt.x - tp.x);
    A.dir = Math.sign(A.tgt.x - tp.x) || 1; A.at = v.pos.x;
    if (A.dir !== v.dir) { A.sol = { err: '표적이 차량 뒤쪽 — 포를 돌릴 수 없음 (차량 방향 고정)' }; return; }
    const peak = () => { let a = 25 * d2r, b = 58 * d2r; for (let i = 0; i < 16; i++) { const m1 = a + (b - a) * 0.382, m2 = a + (b - a) * 0.618; if (this.artyShot(m1, ty).r < this.artyShot(m2, ty).r) a = m1; else b = m2; } return (a + b) / 2; };
    if (v.gun.charge == null) v.gun.charge = C.length - 1;
    let pk = peak(), max = this.artyShot(pk, ty).r;
    if (A.autoCharge && v.def.gun.charges) {                               // smallest charge that reaches with a little to spare
      for (let c = 0; c < C.length; c++) { v.gun.charge = c; pk = peak(); max = this.artyShot(pk, ty).r; if (max >= D * 1.04) break; }
    }
    const lo = G.elevMin * d2r, hi = G.elevMax * d2r, sol = { D, max, charge: v.gun.charge };
    if (D > max) { sol.err = `사거리 밖 — 장약 ${C[v.gun.charge].n} 최대 ${(max / 1000).toFixed(1)} km`; A.sol = sol; return; }
    const bis = (a, b, rising) => { for (let i = 0; i < 26; i++) { const m = (a + b) / 2, r = this.artyShot(m, ty).r; if ((r < D) === rising) a = m; else b = m; } return (a + b) / 2; };
    if (this.artyShot(lo, ty).r <= D) { const e = bis(lo, pk, true); sol.low = { el: e, ...this.artyShot(e, ty, true) }; }
    if (this.artyShot(hi, ty).r <= D) { const e = bis(pk, hi, false); sol.high = { el: e, ...this.artyShot(e, ty, true) }; }
    A.sol = sol;
  },
  // every frame: lay the gun if asked, track the shells for the map, report bursts
  artyStep(dt) {
    const v = this.player, A = this.arty, W = this.world;
    if (!v.def.howitzer) { if (A.on) this.artySet(false); return; }
    if (A.on && A.tgt && Math.abs(v.pos.x - A.at) > 3 && Math.abs(v.vt) < 0.3) this.artySolve();   // moved: new solution
    const S = A.on && A.sol && !A.sol.err ? (A.high ? A.sol.high || A.sol.low : A.sol.low || A.sol.high) : null;
    A.cur = S;
    if (S && A.auto && v.alive) v.gun.aimW = v.dir > 0 ? S.el + v.ang * 0 : Math.PI - S.el;
    // shells in flight (for the map) and their bursts
    A.live = W.projectiles.filter(p => p.owner === v && p.ammo.blast);
    if (v.def.indirectOnly && !A.on) this.artySet(true);
    for (const p of A.live) { if (!p._tr2) p._tr2 = []; if ((p._n = (p._n || 0) + 1) % 6 === 0) p._tr2.push(p.x, p.y); A.lastShell = p; }
    if (W.lastBurst && W.lastBurst !== A.seen) {
      A.seen = W.lastBurst;
      const b = W.lastBurst, miss = A.tgt ? (b.x - A.tgt.x) * v.dir : null;
      A.imp.push({ x: b.x, y: b.y, miss, path: A.lastShell && A.lastShell._tr2 }); if (A.imp.length > 6) A.imp.shift();
      if (miss != null && A.on) this.toast(Math.abs(miss) < 5 ? `탄착 — 표적 지점 명중 (${Math.abs(miss).toFixed(1)} m)` : `탄착 — 표적에서 ${Math.round(Math.abs(miss))} m ${miss < 0 ? '가까움' : '멂'}`);
      this.scamHold = { x: b.x, y: b.y, t: 4 };
    }
    // shell camera (while it is following, the map shrinks to a strip so the shell stays in view)
    const tag = document.getElementById('mcam'), cam = W.cam;
    document.body.classList.toggle('scam', !!(this.scam && A.on && (A.live.length || (this.scamHold && this.scamHold.t > 0))));
    if (this.scam) {
      const p = A.live[A.live.length - 1];
      if (p) {
        if (!this.scamZoom) this.scamZoom = cam.tzoom;
        const sp = Math.hypot(p.vx, p.vy); cam.x = p.x + p.vx / sp * 14; cam.y = p.y + p.vy / sp * 14; cam.tzoom = 9;
        tag.hidden = false; tag.textContent = `포탄 시점 · ${(Math.abs(p.x - p.x0) / 1000).toFixed(2)} km · 고도 ${Math.round(p.y - W.terrain.height(p.x))} m · ${Math.round(sp)} m/s` + (p.burning ? ' · 로켓 연소' : '');
        this.scamHold = null;
      } else if (this.scamHold && this.scamHold.t > 0) { this.scamHold.t -= dt; cam.x = this.scamHold.x; cam.y = this.scamHold.y + 12; cam.tzoom = 9; tag.hidden = false; tag.textContent = '포탄 시점 · 탄착'; }
      else if (this.scamZoom) { cam.tzoom = this.scamZoom; this.scamZoom = null; tag.hidden = true; }
    }
    if (A.on) { A.t -= dt; if (A.t <= 0) { A.t = 0.08; this.artyDraw(); } }
  },
  artyDraw() {
    const v = this.player, A = this.arty, W = this.world, T = W.terrain, cv = this.amap, dpr = W.cam.dpr;
    const w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const G = v.def.gun, C = G.charges || [{ n: '—', v0: 0 }], Am = DS.AMMO[v.gun.ammo], S = A.cur, sol = A.sol;
    // window: from behind the gun to past the target (or the charge's reach), unless zoomed by hand
    let x0, x1;
    if (A.span) ({ x0, x1 } = A.span);
    else { const far = A.tgt ? Math.max(A.tgt.x, v.pos.x) + 600 : v.pos.x + 9000 * v.dir, near = A.tgt ? Math.min(A.tgt.x, v.pos.x) - 300 : v.pos.x - 300; x0 = Math.max(0, Math.min(near, far)); x1 = Math.min(T.length, Math.max(near, far)); }
    A.view = { x0, x1 };
    const draw = (px, py, pw, ph, a, b, withArc) => {
      let lo = 1e9, hi = -1e9; for (let i = 0; i <= 80; i++) { const y = T.height(a + (b - a) * i / 80); lo = Math.min(lo, y); hi = Math.max(hi, y); }
      if (withArc && S && S.path) for (let i = 1; i < S.path.length; i += 2) hi = Math.max(hi, S.path[i]);
      if (withArc) for (const p of A.live) hi = Math.max(hi, p.y);
      hi = Math.max(hi, lo + (withArc ? 60 : 50)) + (hi - lo) * 0.08;
      const X = x => px + (x - a) / (b - a) * pw, Y = y => py + ph - 14 - (y - lo) / (hi - lo) * (ph - 26);
      c.save(); c.beginPath(); c.rect(px, py, pw, ph); c.clip();
      c.fillStyle = 'rgba(16,20,14,0.9)'; c.fillRect(px, py, pw, ph);
      // distance grid from the gun
      const step = (b - a) > 9000 ? 2000 : (b - a) > 3500 ? 1000 : (b - a) > 1200 ? 500 : 100;
      c.font = '11px ui-monospace, monospace'; c.textAlign = 'center';
      for (let d = Math.ceil((a - v.pos.x) / step) * step; v.pos.x + d < b; d += step) { const xx = X(v.pos.x + d); c.fillStyle = 'rgba(255,255,255,0.09)'; c.fillRect(xx, py, 1, ph); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillText(step >= 1000 ? (d / 1000) + ' km' : d + ' m', xx, py + ph - 2); }
      c.beginPath(); c.moveTo(px, py + ph);
      for (let i = 0; i <= pw; i += 2) c.lineTo(px + i, Y(T.height(a + (b - a) * i / pw)));
      c.lineTo(px + pw, py + ph); c.closePath(); c.fillStyle = '#b89a66'; c.fill();
      for (const bl of W.buildings) { if (bl.state === 'rubble') continue; const xa = X(bl.x - bl.w / 2), xb = X(bl.x + bl.w / 2); c.fillStyle = '#e8d9b0'; c.fillRect(xa, Y(bl.top), Math.max(2, xb - xa), Y(bl.base) - Y(bl.top)); }
      for (const e of W.vehicles) {
        if (e !== v && e.team !== v.team && e.alive && !(W.showAll || DS.Sensor.seenNow(v, e))) continue;
        c.fillStyle = e === v ? '#4fe07a' : !e.alive ? '#6b5f52' : e.team === v.team ? '#5ab0ff' : '#ff5a4a';
        c.fillRect(X(e.pos.x) - 3, Y(e.pos.y) - 6, 6, 6);
      }
      const arc = (P, col, lw, dash) => { if (!P || P.length < 4) return; c.strokeStyle = col; c.lineWidth = lw; c.setLineDash(dash || []); c.beginPath(); for (let i = 0; i < P.length; i += 2) c.lineTo(X(P[i]), Y(P[i + 1])); c.stroke(); c.setLineDash([]); };
      if (sol && !sol.err) { arc(sol.low && sol.low.path, A.high ? 'rgba(255,204,102,0.3)' : '#ffcc66', A.high ? 1 : 2, [6, 5]); arc(sol.high && sol.high.path, A.high ? '#8ff0ff' : 'rgba(143,240,255,0.3)', A.high ? 2 : 1, [6, 5]); }
      for (const im of A.imp) { arc(im.path, 'rgba(255,255,255,0.25)', 1); const xx = X(im.x), yy = Y(im.y); c.strokeStyle = '#ff8a5c'; c.lineWidth = 2; c.beginPath(); c.moveTo(xx - 5, yy - 5); c.lineTo(xx + 5, yy + 5); c.moveTo(xx + 5, yy - 5); c.lineTo(xx - 5, yy + 5); c.stroke(); }
      for (const p of A.live) { arc(p._tr2, 'rgba(255,255,255,0.7)', 1.5); c.fillStyle = '#fff'; c.beginPath(); c.arc(X(p.x), Y(p.y), 3, 0, 7); c.fill(); }
      if (A.tgt) { const xx = X(A.tgt.x), yy = Y(A.tgt.y); c.strokeStyle = '#ffd34a'; c.lineWidth = 1.5; c.beginPath(); c.arc(xx, yy, 8, 0, 7); c.moveTo(xx - 13, yy); c.lineTo(xx + 13, yy); c.moveTo(xx, yy - 13); c.lineTo(xx, yy + 13); c.stroke(); }
      c.restore(); c.strokeStyle = 'rgba(255,204,102,0.5)'; c.lineWidth = 1; c.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    };
    const iw = Math.min(360, w * 0.34);
    draw(0, 0, w, h, x0, x1, true);
    if (A.tgt && h > 220) { draw(w - iw - 8, 8, iw, Math.min(150, h * 0.42), A.tgt.x - 150, A.tgt.x + 150, false); c.fillStyle = '#ffd34a'; c.font = '11px ui-monospace, monospace'; c.textAlign = 'left'; c.fillText('표적 주변 300 m', w - iw - 2, 22); }
    // read-out
    const d2 = r => (r * 180 / Math.PI).toFixed(2) + '°', cur = v.gun.e, el = document.getElementById('artyinfo');
    const ch = C[v.gun.charge == null ? C.length - 1 : v.gun.charge];
    let s = `<b>곡사 모드</b> · ${Am.short} · ` + (G.charges ? `장약 ${ch.n} (${ch.v0} m/s)${A.autoCharge ? ' 자동' : ''}` : `로켓 ${v.gun.pod == null ? G.pod : v.gun.pod} / ${G.pod}`) + ` · `;
    s += `${A.high ? '고각' : '저각'} · ${A.auto ? '자동 정렬' : '수동 정렬'}<br>`;
    if (!A.tgt) s += '지도를 클릭해 표적 지점을 지정';
    else if (sol && sol.err) s += `<span class="bad">${sol.err}</span>`;
    else if (sol) {
      const f = k => sol[k] ? `${d2(sol[k].el)} · 비행 ${sol[k].tof.toFixed(0)} 초` : '불가';
      const need = S ? S.el - (v.dir > 0 ? v.ang : -v.ang) : null, off = need != null ? cur - need : null;
      s += `표적 거리 <b>${(sol.D / 1000).toFixed(2)} km</b> (이 장약 최대 ${(sol.max / 1000).toFixed(1)} km) · 저각 ${f('low')} · 고각 ${f('high')}<br>`;
      s += `요구 앙각 <b>${need != null ? d2(need) : '—'}</b> · 현재 <b>${d2(cur)}</b> · ` + (off == null ? '' : Math.abs(off) < 0.0009 ? '<span class="ok">정렬됨</span>' : `<span class="bad">${off > 0 ? '내리기' : '올리기'} ${d2(Math.abs(off))}</span>`) + ` · ${v.gun.reload > 0 ? (v.gun.podChange ? '포드 교체 ' : '장전 ') + v.gun.reload.toFixed(0) + ' 초' : '<span class="ok">발사 준비</span>'}`;
    }
    s += '<br><span class="k">I 직사/곡사 · K 장약 · O 저각/고각 · J 자동/수동 정렬 · Q 탄종 · Tab 포탄 시점 · 휠 지도 확대</span>';
    if (el.innerHTML !== s) el.innerHTML = s;
  },
});
