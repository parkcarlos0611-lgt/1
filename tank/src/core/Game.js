// Boot, input (keyboard / mouse / touch), HUD, minimap, main loop.
DS.Game = class Game {
  constructor() {
    this.cv = document.getElementById('view');
    this.world = new DS.World();
    this.rend = new DS.Renderer(this.cv, this.world);
    this.elevDir = 0; this.elevHold = 0;
    this.keys = new Set(); this.touch = { drive: 0, elev: 0, fire: false };
    this.fps = 60; this.last = performance.now();
    this.mini = document.getElementById('mini'); this.mctx = this.mini.getContext('2d');
    this.sightCv = document.getElementById('sight'); this.sctx = this.sightCv.getContext('2d');
    this.sightCam = new DS.Camera(); this.sightMag = 10; this.thermal = false; this.sightR = 2000; this._sightT = 0;
  }
  async start() {
    await Promise.all(['m1a1', 't55', 't62', 't72'].map(id => this.rend.load(DS.VEHICLES[id])));
    DS.Armor.calibrate();
    this.resize(); addEventListener('resize', () => this.resize());
    document.getElementById('loading').remove();
    window.__game = this;
    // #m1 / #m2 / #m3 starts that mission directly (used by "다시 시작"); otherwise show the menu
    const m = /^#m(\d)$/.exec(location.hash), i = m ? +m[1] - 1 : -1;
    if (DS.MISSIONS[i]) this.begin(i); else this.menu();
  }
  menu() {
    const el = document.getElementById('menu'), list = document.getElementById('missions');
    list.innerHTML = DS.MISSIONS.map((m, i) => `<button class="mcard" type="button" data-i="${i}">
      <span class="mno">작전 ${i + 1}</span><b>${m.name}</b><span class="mdate">${m.date}</span>
      <span class="mbrief">${m.brief}</span><span class="mcond">${m.cond} · 적 전차 ${m.enemies.length}대</span></button>`).join('');
    list.querySelectorAll('.mcard').forEach(b => b.addEventListener('click', () => { el.hidden = true; location.hash = 'm' + (+b.dataset.i + 1); this.begin(+b.dataset.i); }));
    el.hidden = false;
  }
  begin(i) {
    const M = this.mission = DS.MISSIONS[i], W = this.world;
    document.getElementById('menu').hidden = true; document.body.classList.add('playing');
    W.env = { ...M.env }; W.wind = M.env.wind;
    const v = new DS.Vehicle(DS.VEHICLES.m1a1, M.start, W.terrain, { label: 'M1A1 (아군)' });
    W.vehicles.push(v); this.player = v;
    for (const [id, x, label] of M.enemies) {
      const e = new DS.Vehicle(DS.VEHICLES[id], x, W.terrain, { dir: -1, label });
      W.vehicles.push(e); new DS.TankAI(e, W);
    }
    DS.FireControl.update(W, v, false);
    W.cam.x = v.pos.x; W.cam.y = v.pos.y;
    if (M.env.night) { this.thermal = true; this.sightCv.classList.add('thermal'); }
    document.getElementById('h-title').textContent = `M1A1 · 작전 ${i + 1} ${M.name}`;
    document.getElementById('again').onclick = () => { location.hash = 'm' + (i + 1); location.reload(); };
    document.getElementById('tomenu').onclick = () => { location.hash = ''; location.reload(); };
    this.bindInput();
    requestAnimationFrame(t => { this.last = t; this.loop(t); });
  }
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    this.cv.width = W * dpr; this.cv.height = H * dpr; this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
    this.world.cam.resize(W, H, dpr);
    this.mini.width = this.mini.clientWidth * dpr; this.mini.height = this.mini.clientHeight * dpr;
  }
  bindInput() {
    const cam = this.world.cam, P = DS.T.camera.presets;
    addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'F9') { this.world.debug = !this.world.debug; e.preventDefault(); }
      if (e.code === 'Digit1') cam.tzoom = P[0];
      if (e.code === 'Digit2') cam.tzoom = P[1];
      if (e.code === 'Digit3') cam.tzoom = P[2];
      if (e.code === 'KeyQ') this.cycleAmmo();
      if (e.code === 'KeyE') this.lase();
      if (e.code === 'KeyV') this.sightMag = this.sightMag === 10 ? 3 : 10;
      if (e.code === 'KeyT') { this.thermal = !this.thermal; this.sightCv.classList.toggle('thermal', this.thermal); }
      if (e.code === 'KeyR') this.player.place(this.player.pos.x);
      if (e.code === 'KeyC' && this.mouse) { const m = cam.toWorld(this.mouse.x, this.mouse.y); this.world.terrain.crater(m.x, 1.6, 0.7); this.world.terrain.relax(undefined, undefined, 8); }
      if (e.code === 'KeyH') document.getElementById('help').classList.toggle('hide');
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    this.cv.addEventListener('mousemove', e => this.mouse = { x: e.clientX, y: e.clientY });
    this.cv.addEventListener('wheel', e => {
      cam.tzoom = Math.max(DS.T.camera.zoomMin, Math.min(DS.T.camera.zoomMax, cam.tzoom * Math.exp(-e.deltaY * 0.0012)));
      e.preventDefault();
    }, { passive: false });
    this.cv.addEventListener('mousedown', e => { if (e.button === 0) this.mouseFire = true; });
    addEventListener('mouseup', () => this.mouseFire = false);
    // touch buttons
    document.querySelectorAll('[data-t]').forEach(b => {
      const [k, val] = b.dataset.t.split(':'), on = ev => { ev.preventDefault(); if (k === 'fire') this.touch.fire = true; else this.touch[k] = +val; b.classList.add('on'); };
      const off = ev => { ev.preventDefault(); if (k === 'fire') this.touch.fire = false; else this.touch[k] = 0; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
    document.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => cam.tzoom = P[+b.dataset.z]));
    document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('pointerdown', ev => {
      ev.preventDefault(); const a = b.dataset.act;
      if (a === 'lase') this.lase(); else if (a === 'ammo') this.cycleAmmo(); else if (a === 'mag') this.sightMag = this.sightMag === 10 ? 3 : 10;
    }));
  }
  lase() { DS.FireControl.update(this.world, this.player, true); }
  cycleAmmo() {
    const v = this.player, list = v.def.ammo, i = list.indexOf(v.gun.ammo);
    v.gun.ammo = list[(i + 1) % list.length];
    DS.FireControl.update(this.world, v, false);           // computer re-solves for the new round
  }
  readInput(dt) {
    const k = this.keys, i = this.player.input;
    i.drive = ((k.has('KeyD') || k.has('ArrowRight')) ? 1 : 0) - ((k.has('KeyA') || k.has('ArrowLeft')) ? 1 : 0) || this.touch.drive;
    // gun elevation: a tap moves 0.1° (Shift: 0.02°); holding starts slow after 0.3 s and ramps
    // up to 6°/s (Shift: 1°/s) so small corrections and big swings both work
    const dir = ((k.has('KeyW') || k.has('ArrowUp')) ? 1 : 0) - ((k.has('KeyS') || k.has('ArrowDown')) ? 1 : 0) || this.touch.elev;
    const fine = k.has('ShiftLeft') || k.has('ShiftRight'), d2r = Math.PI / 180;
    if (dir !== 0 && dir !== this.elevDir) { i.elevStep += dir * (fine ? 0.02 : 0.1) * d2r; this.elevHold = 0; }
    this.elevDir = dir;
    if (dir !== 0) {
      this.elevHold += dt;
      const r = this.elevHold < 0.3 ? 0 : Math.min(fine ? 1 : 6, 0.5 + (this.elevHold - 0.3) * (fine ? 1 : 4));
      i.elevRate = dir * r * d2r;
    } else i.elevRate = 0;
    i.fire = k.has('Space') || !!this.mouseFire || this.touch.fire;
  }
  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    this.readInput(dt);
    this.world.update(dt);
    this.rend.frame();
    this.sight();
    this.hud();
    requestAnimationFrame(t2 => this.loop(t2));
  }
  hud() {
    const v = this.player, w = this.world, T = w.terrain, g = v.gun, A = DS.AMMO[g.ammo];
    const hurt = w.playerHitAt != null ? Math.max(0, 1 - (w.time - w.playerHitAt) / 0.6) : 0;
    document.getElementById('hurt').style.opacity = hurt.toFixed(2);
    if (!this._hudT || performance.now() - this._hudT > 100) {
      this._hudT = performance.now();
      const set = (id, s) => { const e = document.getElementById(id); if (e.textContent !== s) e.textContent = s; };
      set('h-spd', Math.round(v.speedKmh()) + ' km/h');
      set('h-trk', (v.vt * 3.6).toFixed(0) + ' km/h');
      set('h-pwr', Math.round(v.spool * 100) + ' %');
      set('h-slip', (v.stats.slip * 3.6).toFixed(1) + ' km/h');
      set('h-sink', (v.stats.sink * 100).toFixed(1) + ' cm');
      set('h-soil', T.soilAt(v.pos.x).name);
      set('h-pitch', (v.ang * 180 / Math.PI).toFixed(1) + '°');
      set('h-elev', (g.e * 180 / Math.PI).toFixed(2) + '°');
      set('h-ammo', A.name);
      const fc = v.fc;
      set('h-rng', fc.range ? Math.round(fc.range) + ' m' : `— (전투조준 ${fc.bs} m)`);
      set('h-se', (fc.se * 1000).toFixed(2) + ' mil · ' + (fc.se * 180 / Math.PI).toFixed(2) + '°');
      const foes = w.vehicles.filter(x => x !== v), up = foes.filter(x => x.alive).length;
      set('h-foe', `${up} / ${foes.length} 대 전투 가능`);
      this.logPanel();
      document.getElementById('foes').innerHTML = foes.map(e =>
        `<div class="${e.alive ? 'up' : 'down'}"><b>${e.label}</b> <span>${e.alive ? (e.ai ? e.ai.state : '') : e.status}</span></div>`).join('');
      const over = document.getElementById('over');
      if (!v.alive && over.hidden) { over.hidden = false; document.getElementById('over-t').textContent = `격파됨 — ${v.status}`; }
      if (up === 0 && foes.length && over.hidden && !this._won) { this._won = true; over.hidden = false; document.getElementById('over-t').textContent = '적 소대 전멸 — 임무 완료'; }
      set('h-load', g.reload > 0 ? '장전 중 ' + g.reload.toFixed(1) + ' s' : '장전 완료');
      set('h-pos', (v.pos.x / 1000).toFixed(2) + ' km');
      set('h-zoom', w.cam.zoom.toFixed(0) + ' px/m');
      set('h-fps', Math.round(this.fps) + ' fps');
      document.getElementById('h-load').classList.toggle('ready', g.reload <= 0);
      this.minimap();
    }
  }
  minimap() {
    const c = this.mctx, W = this.mini.width, H = this.mini.height, T = this.world.terrain, v = this.player;
    const span = 3000, x0 = Math.max(0, v.pos.x - span * 0.25), x1 = x0 + span;
    let lo = 1e9, hi = -1e9;
    for (let x = x0; x < x1; x += 10) { const h = T.height(x); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    const sy = h => H - 6 - (h - lo) / Math.max(4, hi - lo) * (H - 14);
    c.clearRect(0, 0, W, H); c.fillStyle = 'rgba(20,16,10,0.55)'; c.fillRect(0, 0, W, H);
    c.beginPath(); c.moveTo(0, H);
    for (let i = 0; i <= W; i += 2) c.lineTo(i, sy(T.height(x0 + i / W * span)));
    c.lineTo(W, H); c.fillStyle = '#c9a66f'; c.fill();
    const px = (v.pos.x - x0) / span * W;
    c.fillStyle = '#4fe07a'; c.fillRect(px - 3, sy(v.pos.y) - 6, 6, 6);
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.font = `${10 * this.world.cam.dpr}px sans-serif`;
    for (let k = Math.ceil(x0 / 500) * 500; k < x1; k += 500) { const xx = (k - x0) / span * W; c.fillRect(xx, H - 4, 1, 4); }
    for (const p of this.world.projectiles) { c.fillStyle = '#ffcc66'; c.fillRect((p.x - x0) / span * W - 1, sy(p.y) - 1, 3, 3); }
    for (const e of this.world.vehicles) if (e !== v) {
      c.fillStyle = e.alive ? '#ff5a4a' : '#6b5f52'; c.fillRect((e.pos.x - x0) / span * W - 3, sy(e.pos.y) - 6, 6, 6);
    }
  }

  // hit log: newest first
  logPanel() {
    const el = document.getElementById('log'), w = this.world;
    const key = w.log.map(l => l.at).join(',');
    if (el.dataset.k === key) return;
    el.dataset.k = key;
    const RES = { pen: ['관통', 'pen'], ricochet: ['도탄', 'ric'], nonpen: ['비관통', 'non'], track: ['궤도 피격', 'trk'] };
    el.innerHTML = w.log.map(l => {
      if (l.ground) return `<div class="e"><b>지면 착탄</b> ${Math.round(l.range)} m · ${l.ammo.short}</div>`;
      const [t, c] = RES[l.result];
      const nums = l.result === 'ricochet' ? `경사 ${l.obl.toFixed(0)}°` : `${Math.round(l.pen)} / ${Math.round(l.prot)} mm · 경사 ${l.obl.toFixed(0)}°`;
      const fx = l.effects && l.effects.length ? ' → ' + l.effects.join(', ') : '';
      const who = l.vehicle === this.player ? `<b class="me">피격</b> ${l.shooter ? l.shooter.label + ' → ' : ''}` : '';
      return `<div class="e"><span class="tag ${c}">${t}</span> ${who}<b>${l.vehicle.label}</b> · ${Math.round(l.range)} m · ${l.plate} · ${l.ammo.short} ${nums}${fx}` +
        `<i>${l.vehicle.status}</i></div>`;
    }).join('');
  }

  // gunner's primary sight: second render of the world along the sight line
  sight() {
    const v = this.player, w = this.world, cv = this.sightCv, cam = this.sightCam;
    const W = cv.clientWidth, H = cv.clientHeight, dpr = w.cam.dpr;
    if (!W) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    cam.resize(W, H, dpr);
    // where the sight line meets something (refreshed a few times a second)
    if (performance.now() - this._sightT > 150) {
      this._sightT = performance.now();
      const r = DS.FireControl.lase(w, v, 6000);
      this.sightR = r ? r.range : 3000;
    }
    const R = v.fc.range && w.time - v.fc.lasedAt < 30 ? v.fc.range : this.sightR;
    const o = v.sightOrigin(), a = v.gun.aimW;
    cam.x = o.x + Math.cos(a) * R; cam.y = o.y + Math.sin(a) * R;
    cam.zoom = W / (this.sightMag === 10 ? 60 : 200);
    this.rend.frame(this.sctx, cam, { main: false, thermal: this.thermal });
    // reticle
    const c = this.sctx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = W / 2, cy = H / 2;
    c.strokeStyle = this.thermal ? '#fff' : '#111'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(cx - W * 0.42, cy); c.lineTo(cx - 10, cy); c.moveTo(cx + 10, cy); c.lineTo(cx + W * 0.42, cy);
    c.moveTo(cx, cy + 10); c.lineTo(cx, cy + H * 0.42); c.moveTo(cx, cy - 10); c.lineTo(cx, cy - H * 0.2); c.stroke();
    c.strokeRect(cx - 3, cy - 3, 6, 6);
    c.font = '600 12px ui-monospace, monospace'; c.fillStyle = this.thermal ? '#fff' : '#ffd34a'; c.textAlign = 'left';
    const g = v.gun, A = DS.AMMO[g.ammo];
    c.fillText(v.fc.range ? String(Math.round(v.fc.range)).padStart(4, '0') : '----', 10, H - 12);
    c.textAlign = 'right'; c.fillText(`${A.type === 'HEAT' ? 'HEAT' : 'SABOT'} ${g.reload > 0 ? '' : 'READY'}`, W - 10, H - 12);
    c.textAlign = 'center'; c.fillText(`GPS ${this.sightMag}× ${this.thermal ? 'TIS' : 'DAY'}`, cx, 18);
  }
};
addEventListener('load', () => new DS.Game().start().catch(e => { document.getElementById('loading').textContent = '로딩 실패: ' + e.message; console.error(e); }));
