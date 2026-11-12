// Firing-range sandbox: an editor over the running world. L pauses the simulation and opens the panel;
// targets are placed, dragged, re-faced and given a behaviour; the player's vehicle, the weather and the
// test aids are switched here; layouts are kept in the browser (localStorage).
// Every vehicle carries its editor record in v.sb = { id, x, dir, team, mode, span, speed, player }.
DS.Sandbox = class Sandbox {
  constructor(game) {
    this.g = game; this.w = game.world; this.edit = false; this.tool = null; this.sel = null; this.drag = null;
    this.opt = { god: false, ammo: true, reload: false, trace: true, show: true };
    this.w.showAll = true; this.w.traces = [];
    this.el = document.getElementById('sbx'); this.n = 0;
    this.bind();
  }
  static MODES = { dummy: '무인 표적', watch: '정지 관측', hold: '정지 사격', combat: '기동 전투', patrol: '왕복 주행' };
  static NAMES = { m1a1: 'M1A1', m2a2: 'M2A2', m60a1: 'M60A1', m109a3: 'M109A3', m270: 'MLRS', ah64a: 'AH-64A', ah1w: 'AH-1W',  t55: 'T-55', t62: 'T-62', t72: 'T-72' };

  // ---- vehicles ----
  spawn(it) {
    const W = this.w, def = DS.VEHICLES[it.id], N = Sandbox.NAMES[it.id];
    if (!it.label) it.label = it.player ? N + ' (나)' : `${N} #${++this.n}`;
    // sides are relative to my vehicle: a target marked 'IQ' is a foe, 'US' a friend, whatever I am driving
    const mine = it.player ? def.side : this.g.player.team, foe = mine === 'US' ? 'IQ' : 'US';
    const v = new (def.heli ? DS.Heli : DS.Vehicle)(def, it.x, W.terrain, { dir: it.dir || 1, team: it.player ? mine : it.team === 'US' ? mine : foe, label: it.label });
    v.sb = it;
    if (def.heli && !it.player) { v.hoverAlt = 40; v.rpm = 1; v.place(it.x); it.mode = 'dummy'; }       // target helicopters hover at 40 m
    if (it.player) { W.vehicles.unshift(v); this.g.player = v; }
    else { W.vehicles.push(v); if (it.mode !== 'dummy' && !def.heli) new DS.TankAI(v, W, { mode: it.mode, patrol: it.mode === 'patrol' ? { a: it.x - (it.span || 150) / 2, b: it.x + (it.span || 150) / 2, speed: it.speed || 5 } : null }); }
    return v;
  }
  items() { return this.w.vehicles.map(v => v.sb).filter(Boolean); }
  // ---- buildings (demolition targets): placed, dragged, deleted and rebuilt like vehicles ----
  isB(k) { return !!(k && (DS.CITY[k] || DS.BUILDINGS[k])); }
  addBuilding(k, x) { if (DS.CITY[k]) { const b = new DS.Structure(k, Math.max(40, Math.min(DS.MAP.length - 40, x)), this.w); this.w.buildings.push(b); return b; } const b = new DS.Building(k, Math.max(40, Math.min(DS.MAP.length - 40, x)), this.w); this.w.buildings.push(b); return b; }
  pickB(m) { for (const b of this.w.buildings) if (Math.abs(m.x - b.x) < b.w / 2 && m.y > b.base - 2 && m.y < b.base + Math.max(6, b.h - b.sink)) return b; return null; }
  // rebuild every vehicle from its record: repairs, re-arms and puts the targets back (the player stays put)
  rebuild(items = this.items(), keepPlayerX = true) {
    const W = this.w, g = this.g;
    const me = items.find(i => i.player) || { player: true, id: 'm1a1', x: DS.MAP.start, dir: 1 };
    if (keepPlayerX && g.player) me.x = g.player.pos.x;
    for (const b of W.buildings) { b.base = W.terrain.height(b.x) - (b.D ? 0.12 : 0.15); b.reset(); }       // buildings stand again
    this.selB = null;
    W.vehicles.length = 0; W.projectiles.length = 0; W.missiles.length = 0; W.traces.length = 0; W.log.length = 0; this.n = 0; W.fx.cases = []; W.flora = null;
    this.spawn(me);
    for (const it of items) if (!it.player) { it.label = null; this.spawn(it); }
    this.sel = null; g.target = null; g.mcam = false; g.mcamHold = null;
    DS.FireControl.update(W, g.player, false);
    g.ranging = null; if (g.arty) { g.arty.tgt = null; g.arty.sol = null; g.arty.imp.length = 0; g.artySet(false); g.scam = false; }
    g.nightSight(!!W.env.night || (g.thermal && !!g.player.def.sight.thermal));
    document.getElementById('h-title').textContent = `${Sandbox.NAMES[me.id]} · 사격장`;
    this.refresh();
  }
  remove(v) { const L = this.w.vehicles, i = L.indexOf(v); if (i > 0) L.splice(i, 1); for (const o of L) if (o.contacts) o.contacts.delete(v); if (this.sel === v) this.sel = null; if (this.g.target === v) this.g.target = null; }
  respawn(v) { const it = v.sb; this.remove(v); it.label = v.label; const n = this.spawn(it); this.sel = n; return n; }
  setPlayer(id) { const it = this.g.player.sb; if (it.id === id) return; it.id = id; it.label = null; this.rebuild(); this.g.toast(`내 장비: ${Sandbox.NAMES[id]}`); }

  // ---- environment ----
  setEnv(e) {
    const W = this.w, env = W.env;
    if (e.time) { env.time = e.time; env.night = e.time === 'night' ? 1 : 0; env.sun = e.time === 'night' ? null : e.time === 'dusk' ? { el: 7, side: -1 } : { el: 35, side: 1 }; }
    if (e.visibility != null) env.visibility = +e.visibility;
    if (e.wind != null) { env.wind = +e.wind; W.wind = +e.wind; }
    const g = this.g; if (e.time && g.player) g.nightSight(!!env.night);
  }

  // ---- layouts ----
  layout() {
    const L = DS.MAP.line, e = this.w.env;
    return { v: 1, env: { time: e.time || 'day', visibility: e.visibility || 0, wind: e.wind || 0 },
      blds: this.w.buildings.map(b => ({ k: b.k, d: Math.round(b.x - L) })),
      items: this.items().map(i => ({ id: i.id, d: Math.round(((i.player ? this.g.player.pos.x : i.x) - L) * 10) / 10, dir: i.dir, team: i.team, mode: i.mode, span: i.span, speed: i.speed, player: i.player || undefined })) };
  }
  apply(lay) {
    const L = DS.MAP.line;
    const items = lay.items.map(i => ({ ...i, x: Math.max(15, Math.min(DS.MAP.length - 50, L + i.d)) }));
    if (!items.some(i => i.player)) items.unshift({ ...this.g.player.sb });           // presets keep my vehicle where it is
    if (lay.env) this.setEnv(lay.env);
    for (const b of this.w.buildings) b.unheap && b.unheap(); this.w.buildings.length = 0; for (const b of lay.blds || []) if (DS.CITY[b.k]) this.addBuilding(b.k, L + b.d);
    this.rebuild(items, !lay.items.some(i => i.player));
  }
  saved() { try { return JSON.parse(localStorage.getItem('ds.' + DS.MAP.id + '.layouts') || '{}'); } catch (e) { return {}; } }
  store(o) { try { localStorage.setItem('ds.' + DS.MAP.id + '.layouts', JSON.stringify(o)); return true; } catch (e) { return false; } }

  // ---- per frame ----
  toggle(on = !this.edit) {
    this.edit = on; this.el.hidden = !on; document.body.classList.toggle('editing', on);
    this.drag = null; this.g.mouseFire = false; this.g.mgDown = false;
    if (on) this.refresh(); else { this.tool = null; }
    this.g.toast(on ? '편집 모드 — 시뮬레이션 일시정지' : '편집 종료');
  }
  // while editing: the simulation is stopped, the camera pans freely
  frame(dt) {
    const g = this.g, cam = this.w.cam, k = g.keys, T = this.w.terrain;
    cam.zoom += (cam.tzoom - cam.zoom) * Math.min(1, dt * 6);
    const pan = ((k.has('KeyD') || k.has('ArrowRight')) ? 1 : 0) - ((k.has('KeyA') || k.has('ArrowLeft')) ? 1 : 0);
    cam.x = Math.max(0, Math.min(DS.MAP.length, cam.x + pan * dt * cam.W / cam.zoom * (k.has('ShiftLeft') ? 2.5 : 0.9)));
    cam.y += (T.height(cam.x) + cam.H / cam.zoom * (0.5 - DS.T.camera.ground) - cam.y) * Math.min(1, dt * 6);
    cam.sx = cam.sy = 0;
  }
  // while playing: test aids
  tick() {
    const g = this.g, v = g.player, o = this.opt, W = this.w;
    v.god = o.god;
    if (o.ammo) { if (v.heli && (v.cannon < 200 || v.rk + v.hf === 0)) v.rearm();
      if (v.mg) v.mg.rounds = v.def.mg.rounds; if (v.coax) v.coax.rounds = v.def.coax.rounds; if (v.tow && v.tow.loaded + v.tow.reserve < 2 && !v.tow.missile) v.tow.reserve = v.def.tow.reserve; }
    if (o.reload) { v.gun.reload = Math.min(v.gun.reload, 0.4); if (v.tow && v.tow.loaded === 0 && v.tow.reserve) v.tow.reload = Math.max(v.tow.reload, v.def.tow.reloadTime - 1); }
    W.showAll = o.show;
    if (o.trace) {
      for (const p of W.projectiles.concat(W.missiles)) {
        if (p.owner !== v || (p.ammo && p.ammo.small)) continue;
        if (!p._tr) { p._tr = [v.pos.x, p.y]; W.traces.push(p._tr); if (W.traces.length > 4) W.traces.shift(); }
        p._tr.push(p.x, p.y);
      }
    } else if (W.traces.length) W.traces.length = 0;
  }
  // selection ring, patrol span and the placement ghost (screen space, after the frame)
  overlay(ctx) {
    if (!this.edit) return;
    const cam = this.w.cam, T = this.w.terrain, dpr = cam.dpr;
    const sx = x => (cam.W / 2 + (x - cam.x) * cam.zoom) * dpr, sy = y => (cam.H / 2 - (y - cam.y) * cam.zoom) * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.lineWidth = 2 * dpr; ctx.font = `600 ${12 * dpr}px ui-monospace, monospace`; ctx.textAlign = 'center';
    for (const v of this.w.vehicles) {
      const x = sx(v.pos.x), y = sy(v.pos.y), on = v === this.sel, it = v.sb; if (!it || x < -200 || x > cam.W * dpr + 200) continue;
      ctx.strokeStyle = it.player ? '#7fe08f' : it.team === 'US' ? '#6fb8ff' : '#ff7a5c'; ctx.globalAlpha = on ? 1 : 0.55;
      const r = Math.max(14 * dpr, 4.2 * cam.zoom * dpr);
      ctx.setLineDash(on ? [] : [6 * dpr, 5 * dpr]); ctx.strokeRect(x - r, y - r * 0.55, r * 2, r * 1.05); ctx.setLineDash([]);
      ctx.globalAlpha = 1; ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(`${v.label} · ${it.player ? '내 장비' : Sandbox.MODES[it.mode]} · ${Math.round(v.pos.x - DS.MAP.line)} m`, x, y - r * 0.55 - 6 * dpr);
      ctx.fillText(v.dir > 0 ? '▶' : '◀', x + v.dir * (r + 10 * dpr), y + 4 * dpr);
      if (it.mode === 'patrol') { const a = sx(it.x - it.span / 2), b = sx(it.x + it.span / 2), yy = y + r * 0.7; ctx.beginPath(); ctx.moveTo(a, yy); ctx.lineTo(b, yy); ctx.moveTo(a, yy - 6 * dpr); ctx.lineTo(a, yy + 6 * dpr); ctx.moveTo(b, yy - 6 * dpr); ctx.lineTo(b, yy + 6 * dpr); ctx.stroke(); }
    }
    for (const b of this.w.buildings) {
      const x0 = sx(b.x - b.w / 2), x1 = sx(b.x + b.w / 2); if (x1 < 0 || x0 > cam.W * dpr) continue;
      ctx.strokeStyle = ctx.fillStyle = '#ffd34a'; ctx.globalAlpha = b === this.selB ? 1 : 0.5; ctx.setLineDash(b === this.selB ? [] : [6 * dpr, 5 * dpr]);
      ctx.strokeRect(x0, sy(b.base + Math.max(4, b.h - b.sink)), x1 - x0, sy(b.base) - sy(b.base + Math.max(4, b.h - b.sink))); ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.fillText(`${b.name} · ${Math.round(b.x - DS.MAP.line)} m` + (b.state !== 'ok' ? ' · 붕괴' : ''), (x0 + x1) / 2, sy(b.base) + 16 * dpr);
    }
    if (this.tool && this.mouse && !this.drag) {
      const m = cam.toWorld(this.mouse.x, this.mouse.y), x = sx(m.x), y = sy(T.height(m.x));
      ctx.strokeStyle = ctx.fillStyle = '#ffd34a'; ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath(); ctx.moveTo(x, y - 60 * dpr); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillText(`${Sandbox.NAMES[this.tool] || (DS.CITY[this.tool] || DS.BUILDINGS[this.tool]).name} 배치 · ${Math.round(m.x - DS.MAP.line)} m`, x, y - 66 * dpr);
    }
  }

  // ---- input ----
  pick(m) { let best = null, bd = 5; for (const v of this.w.vehicles) { const d = Math.abs(v.pos.x - m.x); if (d < bd && Math.abs(v.pos.y + 1 - m.y) < 4) { bd = d; best = v; } } return best; }
  moveTo(v, x) { x = Math.max(15, Math.min(DS.MAP.length - 50, x)); v.sb.x = x; v.place(x); if (v.ai && v.ai.patrol) { v.ai.patrol.a = x - v.sb.span / 2; v.ai.patrol.b = x + v.sb.span / 2; } }
  bind() {
    const cv = this.g.cv, cam = this.w.cam, $ = s => this.el.querySelector(s);
    // pointer events: the same handlers serve the mouse and a finger on a tablet
    cv.addEventListener('pointerdown', e => {
      if (!this.edit || (e.pointerType === 'touch' && !e.isPrimary)) return;
      const m = cam.toWorld(e.clientX, e.clientY);
      if (e.button === 2) { this.tool = null; this.refresh(); return; }
      const v = this.pick(m), bld = !v && !(this.tool && !this.isB(this.tool)) ? this.pickB(m) : null;
      this.selB = null;
      if (bld) { this.sel = null; this.selB = bld; this.dragB = { b: bld, dx: bld.x - m.x }; }
      else if (!v && this.tool && this.isB(this.tool)) { this.sel = null; this.selB = this.addBuilding(this.tool, m.x); }
      else if (v) { this.sel = v; this.drag = { v, dx: v.pos.x - m.x }; }
      else if (this.tool) { this.sel = this.spawn({ id: this.tool, x: Math.max(15, Math.min(DS.MAP.length - 50, m.x)), dir: this.dir || -1, team: this.team || 'IQ', mode: this.mode || 'dummy', span: 150, speed: 5 }); }
      else this.sel = null;
      this.refresh();
    });
    addEventListener('pointermove', e => {
      this.mouse = { x: e.clientX, y: e.clientY };
      if (this.edit && this.drag) this.moveTo(this.drag.v, cam.toWorld(e.clientX, e.clientY).x + this.drag.dx);
      if (this.edit && this.dragB) { const b = this.dragB.b; b.unheap && b.unheap(); b.x = Math.max(40, Math.min(DS.MAP.length - 40, cam.toWorld(e.clientX, e.clientY).x + this.dragB.dx)); b.base = this.w.terrain.height(b.x) - (b.D ? 0.12 : 0.15); b.reset(); }
    });
    addEventListener('pointerup', () => { this.dragB = null; if (this.drag) { this.drag = null; this.refresh(); } });
    addEventListener('keydown', e => {
      if (!this.edit || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const v = this.sel;
      if ((e.code === 'Delete' || e.code === 'KeyX') && v && !v.sb.player) { this.remove(v); this.refresh(); }
      if ((e.code === 'Delete' || e.code === 'KeyX') && this.selB) { this.selB.unheap && this.selB.unheap(); this.w.buildings.splice(this.w.buildings.indexOf(this.selB), 1); this.selB = null; this.refresh(); }
      if (e.code === 'Escape') { this.tool = null; this.sel = null; this.refresh(); }
      if (v && (e.code === 'Comma' || e.code === 'Period')) { this.moveTo(v, v.sb.x + (e.code === 'Comma' ? -1 : 1) * (e.shiftKey ? 10 : 1)); this.refresh(); }
    });
    this.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const d = b.dataset, v = this.sel;
      if (d.tool) this.tool = this.tool === d.tool ? null : d.tool;
      if (d.bld) { const k = this.el.querySelector('#sb-bld').value; this.tool = this.tool === k ? null : k; }
      if (d.me) this.setPlayer(d.me);
      if (d.go) { const x = d.go === 'me' ? this.g.player.pos.x : d.go === 'base' ? 420 : DS.MAP.line + +d.go; cam.x = x; cam.y = this.w.terrain.height(x) + 3; }
      if (d.time) this.setEnv({ time: d.time });
      if (d.opt) this.opt[d.opt] = !this.opt[d.opt];
      if (d.act === 'flip' && v) { v.sb.dir = -v.sb.dir; this.respawn(v); }
      if (d.act === 'team' && v && !v.sb.player) { v.sb.team = v.sb.team === 'US' ? 'IQ' : 'US'; this.respawn(v); }
      if (d.act === 'del' && v && !v.sb.player) this.remove(v);
      if (d.act === 'del' && this.selB) { this.selB.unheap && this.selB.unheap(); this.w.buildings.splice(this.w.buildings.indexOf(this.selB), 1); this.selB = null; }
      if (d.act === 'fix' && this.selB) this.selB.reset();
      if (d.act === 'clearb') { for (const b of this.w.buildings) b.unheap && b.unheap(); this.w.buildings.length = 0; this.selB = null; }
      if (d.act === 'fix' && v) { if (v.sb.player) this.rebuild(); else this.respawn(v); }
      if (d.act === 'reset') { this.rebuild(); this.g.toast('모두 수리 · 원위치'); }
      if (d.act === 'clear') { this.rebuild(this.items().filter(i => i.player)); }
      if (d.act === 'ground') { const W = this.w; W.terrain = new DS.Terrain(7, DS.MAP.id); W.particles = new DS.Particles(DS.T.particles.max); W.fx.P = W.particles; this.rebuild(); this.g.toast('지형 복구'); }
      if (d.act === 'load') { const n = $('#sb-lay').value, lay = DS.MAP.presets[n] || this.saved()[n]; if (lay) { this.apply(lay); this.g.toast('배치 불러옴: ' + n); } }
      if (d.act === 'save') { const n = $('#sb-name').value.trim(); if (!n) this.g.toast('저장할 이름을 입력'); else if (DS.MAP.presets[n]) this.g.toast('기본 배치 이름은 쓸 수 없음'); else { const s = this.saved(); s[n] = this.layout(); this.g.toast(this.store(s) ? '저장: ' + n : '이 브라우저에서는 저장할 수 없음'); this.layN = n; } }
      if (d.act === 'drop') { const n = $('#sb-lay').value, s = this.saved(); if (s[n]) { delete s[n]; this.store(s); this.g.toast('삭제: ' + n); } else this.g.toast('기본 배치는 지울 수 없음'); }
      if (d.act === 'close') return this.toggle(false);
      this.refresh();
    });
    this.el.addEventListener('change', e => {
      const t = e.target, v = this.sel;
      if (t.id === 'sb-vis') this.setEnv({ visibility: t.value });
      if (t.id === 'sb-wind') this.setEnv({ wind: t.value });
      if (t.id === 'sb-mode') { if (v && !v.sb.player) { v.sb.mode = t.value; this.respawn(v); } else this.mode = t.value; }
      if (t.id === 'sb-span' && v) { v.sb.span = Math.max(20, +t.value || 150); this.respawn(v); }
      if (t.id === 'sb-speed' && v) { v.sb.speed = Math.max(1, Math.min(15, +t.value || 5)); this.respawn(v); }
      if (t.id === 'sb-lay') this.layN = t.value;
      if (t.id === 'sb-bld') { this.tool = t.value; }
      this.refresh();
    });
    this.el.addEventListener('input', e => { if (e.target.id === 'sb-vis' || e.target.id === 'sb-wind') this.labels(); });
  }
  labels() {
    const $ = s => this.el.querySelector(s), vis = +$('#sb-vis').value, wi = +$('#sb-wind').value;
    $('#sb-visv').textContent = vis ? `${vis} m (모래폭풍)` : '맑음';
    $('#sb-windv').textContent = `${wi > 0 ? '→' : wi < 0 ? '←' : ''} ${Math.abs(wi)} m/s`;
  }
  refresh() {
    const $ = s => this.el.querySelector(s), on = (b, k) => b.classList.toggle('on', !!k), v = this.sel, env = this.w.env;
    this.el.querySelectorAll('[data-tool]').forEach(b => on(b, this.tool === b.dataset.tool)); { const bb = this.el.querySelector('[data-bld]'); if (bb) on(bb, !!(this.tool && DS.CITY[this.tool])); }
    this.el.querySelectorAll('[data-me]').forEach(b => on(b, this.g.player.sb.id === b.dataset.me));
    this.el.querySelectorAll('[data-time]').forEach(b => on(b, (env.time || 'day') === b.dataset.time));
    this.el.querySelectorAll('[data-opt]').forEach(b => on(b, this.opt[b.dataset.opt]));
    $('#sb-vis').value = env.visibility || 0; $('#sb-wind').value = env.wind || 0; this.labels();
    const it = v && v.sb, tgt = it && !it.player;
    $('#sb-selname').textContent = this.selB ? `${this.selB.name} · ${DS.MAP.lineName || '사격선'}에서 ${Math.round(this.selB.x - DS.MAP.line)} m · ${this.selB.state === 'ok' ? '온전' : this.selB.state === 'rubble' ? '완전 붕괴' : `피격 ${this.selB.hits}회`}` : v ? `${v.label} · ${DS.MAP.lineName || '사격선'}에서 ${Math.round(v.pos.x - DS.MAP.line)} m · ${v.status}` : this.tool ? `${Sandbox.NAMES[this.tool] || (DS.CITY[this.tool] || DS.BUILDINGS[this.tool]).name}: 지면을 클릭해 배치 (우클릭 취소)` : '표적을 고르고 지면을 클릭 · 놓인 차량은 끌어서 이동';
    $('#sb-mode').value = tgt ? it.mode : this.mode || 'dummy';
    $('#sb-pat').hidden = !(tgt && it.mode === 'patrol');
    if (tgt) { $('#sb-span').value = it.span || 150; $('#sb-speed').value = it.speed || 5; }
    this.el.querySelectorAll('[data-need]').forEach(b => b.disabled = this.selB ? !['fix', 'del'].includes(b.dataset.act) : (!v || (b.dataset.need === 'tgt' && !tgt)));
    $('[data-act=team]').textContent = tgt ? (it.team === 'US' ? '아군 (피격 안 됨)' : '적군 (표적)') : '적군 / 아군';
    const sel = $('#sb-lay'), names = Object.keys(DS.MAP.presets).concat(Object.keys(this.saved()));
    sel.innerHTML = names.map(n => `<option${n === this.layN ? ' selected' : ''}>${n.replace(/[<&]/g, '')}</option>`).join('');
    $('#sb-count').textContent = `표적 ${this.w.vehicles.length - 1}대 · 건물 ${this.w.buildings.length}동`;
  }
};
