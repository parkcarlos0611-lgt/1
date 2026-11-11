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
    this.post = new DS.Post(this.cv);
    let q = 2; try { const s = localStorage.getItem('ds.post'); if (s != null) q = +s; } catch (e) {}
    this.post.setQuality(this.post.ok ? q : 0); this.lowFps = 0;
    await Promise.all(['m1a1', 'm2a2', 'm60a1', 'm109a3', 'm270', 't55', 't62', 't72'].map(id => this.rend.load(DS.VEHICLES[id])).concat(this.rend.loadProps()));
    await this.rend.loadBuildings();
    await this.rend.loadHeli(DS.VEHICLES.ah64a);
    DS.Armor.calibrate();
    this.resize(); addEventListener('resize', () => this.resize());
    document.getElementById('loading').remove();
    window.__game = this;
    // #m1 / #m2 / #m3 starts that mission directly (used by "다시 시작"); otherwise show the menu
    const m = /^#m(\d)(b?)$/.exec(location.hash), i = m ? +m[1] - 1 : -1, rg = /^#range(b?)$/.exec(location.hash);
    if (rg) this.begin('range', rg[1] ? 'm2a2' : 'm1a1'); else if (DS.MISSIONS[i]) this.begin(i, m[2] ? 'm2a2' : 'm1a1'); else this.menu();
  }
  menu() {
    const el = document.getElementById('menu'), list = document.getElementById('missions');
    list.innerHTML = DS.MISSIONS.map((m, i) => `<article class="mcard">
      <span class="mno">${String(i + 1).padStart(2, '0')}</span><span class="mname">${m.name}</span>
      <span class="mmeta"><span>${m.date}</span><span>${m.cond}</span><span>적 전차 ${m.enemies.length}대</span></span>
      <span class="mbtns"><button class="mbtn" type="button" data-brief="${i}" aria-expanded="false">브리핑 ▾</button><button class="mbtn go" type="button" data-go="${i}">출격</button></span>
      <p class="mbrief" id="brief-${i}" hidden><b>BRIEFING</b>${m.brief}</p></article>`).join('');
    let veh = 'm1a1';
    document.querySelectorAll('.vpick').forEach(b => b.addEventListener('click', () => { veh = b.dataset.v; document.querySelectorAll('.vpick').forEach(x => x.classList.toggle('on', x === b)); }));
    list.querySelectorAll('[data-brief]').forEach(b => b.addEventListener('click', () => {
      const p = document.getElementById('brief-' + b.dataset.brief), open = p.hidden;
      p.hidden = !open; b.setAttribute('aria-expanded', open); b.textContent = open ? '브리핑 ▴' : '브리핑 ▾';
    }));
    list.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { DS.Audio.init(); el.hidden = true; location.hash = 'm' + (+b.dataset.go + 1) + (veh === 'm2a2' ? 'b' : ''); this.begin(+b.dataset.go, veh); }));
    document.getElementById('gorange').onclick = () => { DS.Audio.init(); el.hidden = true; location.hash = 'range' + (veh === 'm2a2' ? 'b' : ''); this.begin('range', veh); };
    el.hidden = false;
  }
  // key guide: H or the ? button; the choice is remembered on this device
  setHelp(on) {
    document.getElementById('help').classList.toggle('hide', !on);
    document.getElementById('helpbtn').classList.toggle('on', on);
    try { localStorage.setItem('ds.help', on ? '1' : '0'); } catch (e) {}
  }
  begin(i, veh = 'm1a1') {
    const range = i === 'range', M = this.mission = range ? DS.RANGE : DS.MISSIONS[i], W = this.world;
    if (range) { W.terrain = new DS.Terrain(7, 'range'); W.props = DS.RANGE.layout(); this.rend.makeParked(W); }
    document.getElementById('menu').hidden = true; document.body.classList.add('playing');
    let help = true; try { help = localStorage.getItem('ds.help') !== '0'; } catch (e) {}
    this.setHelp(help);
    document.getElementById('helpbtn').onclick = () => this.setHelp(document.getElementById('help').classList.contains('hide'));
    W.env = { ...M.env }; W.wind = M.env.wind;
    const other = veh === 'm2a2' ? 'm1a1' : 'm2a2', nm = { m1a1: 'M1A1', m2a2: '브래들리' };
    if (range) {
      // sandbox: my vehicle alone on the range, the first preset's targets down the lanes
      this.sbx = new DS.Sandbox(this);
      this.sbx.setEnv({ time: 'day' });
      this.player = this.sbx.spawn({ player: true, id: veh, x: M.start, dir: 1 });
      this.sbx.layN = '거리별 표적'; this.sbx.apply(DS.RANGE.presets['거리별 표적']);
      document.getElementById('editbtn').hidden = false;
      document.getElementById('editbtn').onclick = () => this.sbx.toggle();
    }
    const v = range ? this.player : new DS.Vehicle(DS.VEHICLES[veh], M.start, W.terrain, { label: nm[veh] + ' (나)' });
    if (!range) { W.vehicles.push(v); this.player = v; }
    // the other vehicle is an AI wingman. The tank always leads: with the Bradley, the M1A1 moves 45 m ahead
    // and takes the first contact; with the M1A1, the Bradley follows 45 m behind
    const off = veh === 'm2a2' ? 45 : -45;
    if (!range) {
    const wm = new DS.Vehicle(DS.VEHICLES[other], Math.max(12, M.start + off), W.terrain, { label: nm[other] + (veh === 'm2a2' ? ' (아군 선두)' : ' (아군)') });
    W.vehicles.push(wm); new DS.TankAI(wm, W, { follow: v, offset: off });
    for (const [id, x, label] of M.enemies) {
      const e = new DS.Vehicle(DS.VEHICLES[id], x, W.terrain, { dir: -1, label });
      W.vehicles.push(e); new DS.TankAI(e, W);
    }
    }
    DS.FireControl.update(W, v, false);
    W.cam.x = v.pos.x; W.cam.y = v.pos.y;
    if (M.env.night) this.nightSight(true);
    document.getElementById('h-title').textContent = range ? `${nm[veh] === '브래들리' ? 'M2A2' : nm[veh]} · 사격장` : `${nm[veh]} · 작전 ${i + 1} ${M.name}`;
    document.getElementById('again').onclick = () => { location.hash = range ? 'range' : 'm' + (i + 1) + (veh === 'm2a2' ? 'b' : ''); location.reload(); };
    document.getElementById('tomenu').onclick = () => { location.hash = ''; location.reload(); };
    this.artyInit();
    this.bindInput();
    this.resize();                       // the minimap has no size until the HUD is shown
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
    // browsers only start audio after a user gesture
    const wake = () => DS.Audio.init();
    addEventListener('pointerdown', wake); addEventListener('keydown', wake);
    addEventListener('keydown', e => {
      if (e.repeat) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'KeyL' && this.sbx) return this.sbx.toggle();
      if (this.sbx && this.sbx.edit && !['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'Digit1', 'Digit2', 'Digit3', 'KeyM', 'KeyP', 'KeyH'].includes(e.code)) return;
      if (e.code === 'KeyP') {
        if (!this.post.ok) this.toast('이 브라우저는 화면 효과(WebGL2)를 지원하지 않음');
        else { const q = (this.post.q + 2) % 3; this.post.setQuality(q); try { localStorage.setItem('ds.post', q); } catch (er) {} this.toast('화면 효과: ' + ['끔', '낮음', '높음'][q]); }
      }
      if (e.code === 'KeyU') { DS.Audio.hatch = !DS.Audio.hatch; this.toast(DS.Audio.hatch ? '해치 열림 — 바깥 소리 그대로' : '해치 닫힘 — 바깥 소리가 장갑 너머로'); }
      if (e.code === 'KeyM') { const on = DS.Audio.toggle(); this.toast(on ? '소리 켬' : '소리 끔'); }
      this.keys.add(e.code);
      if (e.code === 'F9') { this.world.debug = !this.world.debug; e.preventDefault(); }
      if (e.code === 'Digit1') cam.tzoom = P[0];
      if (e.code === 'Digit2') cam.tzoom = P[1];
      if (e.code === 'Digit3') cam.tzoom = this.zoomMin();
      if (e.code === 'KeyQ') this.cycleAmmo();
      if (e.code === 'KeyE') this.lase();
      if (e.code === 'KeyV') { this.sightMag = this.sightMag === 10 ? 3 : 10; this.fovI = (this.fovI || 0) + (e.shiftKey ? -1 : 1); if (this.tis) this.tis.blur = 0.45; const f = this.sightField(); if (f.n) this.toast(`${this.player.def.sight.name} ${f.n} · 시야각 ${f.fov}° · ×${f.mag}`); }
      if (e.code === 'KeyT') this.nightSight(!(this.thermal || this.nv));
      if (e.code === 'KeyB') { this.blackHot = !this.blackHot; this.sightCv.classList.toggle('bh', this.blackHot); if (this.tis) this.tis.cal = 0.3; }
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        const a = this.world.tisAdj || (this.world.tisAdj = { level: 0, gain: 1 }), up = e.code === 'BracketRight';
        if (e.shiftKey) a.gain = Math.max(0.5, Math.min(3, a.gain * (up ? 1.12 : 1 / 1.12))); else a.level = Math.max(-0.2, Math.min(0.3, a.level + (up ? -0.02 : 0.02)));
        this.toast(`열상 밝기 ${Math.round(-a.level * 50)} · 대비 ${a.gain.toFixed(2)}`);
      }
      if (e.code === 'KeyG') this.sightCv.classList.toggle('big');
      // sights without a rangefinder (T-55 / T-62): the gunner sets the range on the sight scale by hand
      if ((e.code === 'Minus' || e.code === 'Equal') && this.player.def.sight.manual) {
        const fc = this.player.fc; fc.range = null; fc.bs = Math.max(200, Math.min(3000, fc.bs + (e.code === 'Equal' ? 100 : -100) * (e.shiftKey ? 5 : 1)));
        DS.FireControl.update(this.world, this.player, false); this.toast(`조준경 거리 눈금 ${fc.bs} m`);
      }
      if (e.code === 'Backspace') { e.preventDefault(); this.cycleTarget(e.shiftKey ? -1 : 1); }
      if (['KeyI', 'KeyK', 'KeyO', 'KeyJ'].includes(e.code) && this.artyKey(e)) return;
      if (e.code === 'Tab') {
        e.preventDefault();
        if (this.player.def.howitzer) { this.scam = !this.scam; this.toast(this.scam ? '포탄 시점 켬 — 발사한 포탄을 따라감' : '포탄 시점 끔'); }
        else if (!this.player.tow && !this.player.heli) this.toast('미사일 시점은 브래들리 · 포탄 시점은 자주포 전용');
        else { this.mcam = !this.mcam; this.mcamHold = null; this.toast(this.mcam ? ((this.player.tow || this.player.hfState).missile ? '미사일 시점' : '미사일 시점 켬 — 다음 발사부터 따라감') : '미사일 시점 끔'); }
      }
      if (e.code === 'KeyX') { if (this.player.heli) this.player.input.hf = true; else if (this.player.tow) this.player.input.tow = true; else this.toast('미사일은 브래들리(TOW) · 아파치(헬파이어) 전용'); }
      if (e.code === 'KeyC' && this.player.heli) { this.player.turn(); return; }
      if (e.code === 'KeyZ') { this.world.xray = this.world.xray === false; this.toast(this.world.xray ? 'TOW 발사관 투시 켬' : 'TOW 발사관 투시 끔'); }
      if (e.code === 'KeyR') this.player.place(this.player.pos.x);
      if (e.code === 'KeyC' && this.mouse) { const m = cam.toWorld(this.mouse.x, this.mouse.y); this.world.terrain.crater(m.x, 1.6, 0.7, 0.35, 0); this.world.terrain.relax(undefined, undefined, 8); }
      if (e.code === 'KeyH') this.setHelp(document.getElementById('help').classList.contains('hide'));
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    this.cv.addEventListener('mousemove', e => this.mouse = { x: e.clientX, y: e.clientY });
    this.cv.addEventListener('wheel', e => {
      cam.tzoom = Math.max(this.zoomMin(), Math.min(DS.T.camera.zoomMax, cam.tzoom * Math.exp(-e.deltaY * 0.0012)));
      e.preventDefault();
    }, { passive: false });
    this.cv.addEventListener('mousedown', e => { if (this.sbx && this.sbx.edit) return; if (e.button === 0) this.mouseFire = true; if (e.button === 2) this.mgDown = true; });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouseFire = false; if (e.button === 2) this.mgDown = false; });
    this.cv.addEventListener('contextmenu', e => e.preventDefault());
    // touch buttons
    document.querySelectorAll('[data-t]').forEach(b => {
      const [k, val] = b.dataset.t.split(':'), on = ev => { ev.preventDefault(); if (k === 'fire' || k === 'coax') this.touch[k] = true; else this.touch[k] = +val; b.classList.add('on'); };
      const off = ev => { ev.preventDefault(); if (k === 'fire' || k === 'coax') this.touch[k] = false; else this.touch[k] = 0; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
    document.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => cam.tzoom = +b.dataset.z === 2 ? this.zoomMin() : P[+b.dataset.z]));
    document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('pointerdown', ev => {
      ev.preventDefault(); const a = b.dataset.act;
      if (a === 'lase') this.lase(); else if (a === 'tgt') this.cycleTarget(1); else if (a === 'mcam') { if (this.player.tow) { this.mcam = !this.mcam; this.toast(this.mcam ? '미사일 시점 켬' : '미사일 시점 끔'); } } else if (a === 'ammo') this.cycleAmmo(); else if (a === 'mag') this.sightMag = this.sightMag === 10 ? 3 : 10;
    }));
  }
  // widest view: the screen never shows more than camera.maxWidth metres (far ground is for the sights and maps)
  zoomMin() { return Math.max(DS.T.camera.zoomMin, this.world.cam.W / (this.player && this.player.heli ? 700 : DS.T.camera.maxWidth)); }
  toast(msg) {
    const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('on');
    clearTimeout(this._toastT); this._toastT = setTimeout(() => el.classList.remove('on'), 1200);
  }
  // Missile camera (Tab): rides alongside the player's TOW in flight, holds on the impact for a moment,
  // then hands back to the tank. Off by default; when on it picks up every launch.
  missileCam(dt) {
    const cam = this.world.cam, t = this.player.tow || this.player.hfState, tag = document.getElementById('mcam');
    let on = false;
    if (this.mcam && t) {
      const m = t.missile;
      if (m) {
        if (!this.mcamZoom) this.mcamZoom = cam.tzoom;
        const lead = Math.min(30, m.speed * 0.06);
        cam.x = m.x + Math.cos(m.ang) * lead; cam.y = m.y + Math.sin(m.ang) * lead + 1.5;
        cam.tzoom = 22; on = true;
        this.mcamHold = { x: m.x, y: m.y, t: 2.2 };
        tag.textContent = `미사일 시점 · ${Math.round(Math.hypot(m.x - m.x0, m.y - m.y0))} m · ${Math.round(m.speed)} m/s` + (m.guided ? ' · 유도 중' : ' · 유선 끊김');
      } else if (this.mcamHold && this.mcamHold.t > 0) {            // watch the impact
        this.mcamHold.t -= dt; cam.x = this.mcamHold.x; cam.y = this.mcamHold.y + 2; on = true;
        tag.textContent = '미사일 시점 · 착탄';
      } else if (this.mcamZoom) { cam.tzoom = this.mcamZoom; this.mcamZoom = null; }
    }
    tag.hidden = !on;
  }
  // ---- target selection: Backspace cycles through enemies in sight (nearest first), Shift+Backspace back.
  // The gunner then lays the sight onto it at the turret's own speed; ranging and firing stay manual.
  cycleTarget(step) {
    const v = this.player, list = DS.Sensor.list(v, true);
    if (!list.length) { this.target = null; this.toast('탐지된 표적 없음'); return; }
    let i = list.indexOf(this.target);
    i = i < 0 ? (step > 0 ? 0 : list.length - 1) : (i + step + list.length) % list.length;
    this.target = list[i]; this.slew = { t: 0 };
    const c = v.contacts.get(this.target);
    this.toast(`표적 ${i + 1}/${list.length} · ${c.d >= 2 ? this.target.def.name : '미식별'} · ${Math.round(c.range)} m`);
  }
  trackTarget(dt) {
    const v = this.player, t = this.target;
    if (!t) return;
    if (!t.alive || !DS.Sensor.seenNow(v, t)) { this.target = null; this.slew = null; this.toast(t.alive ? '표적 상실' : '표적 격파'); return; }
    if (!this.slew) return;
    if (this.elevDir) { this.slew = null; return; }          // the gunner takes over with W/S
    this.slew.t += dt;
    if (this.slew.t < 0.45) return;                          // hand-off: the gunner finds it in the sight first
    const o = v.sightOrigin(), q = t.local(t.g.ring.x, t.g.ring.y + 0.3);
    const want = Math.atan2(q.y - o.y, q.x - o.x), d = Math.atan2(Math.sin(want - v.gun.aimW), Math.cos(want - v.gun.aimW));
    const mx = Math.max(0.05, v.def.gun.rate) * dt;
    v.gun.aimW += Math.max(-mx, Math.min(mx, d));
    if (Math.abs(d) < 0.0002) this.slew = null;
  }
  // ---- post-processing inputs, all in device pixels of the main canvas ----
  postFrame(dt) {
    const P = this.post, w = this.world, cam = w.cam, env = w.env || {}, dpr = cam.dpr;
    if (!P.ok || !P.q) { document.getElementById('hurt').style.display = ''; return; }
    document.getElementById('hurt').style.display = 'none';
    // drop a level when the frame rate stays low (DS.T.postAuto = false turns this off)
    if (DS.T.postAuto !== false) {
      this.lowFps = this.fps < 40 ? this.lowFps + dt : 0;
      if (this.lowFps > 3) { this.lowFps = 0; P.setQuality(P.q - 1); this.toast('프레임 저하 — 화면 효과 ' + ['끔', '낮음'][P.q]); }
    }
    const z = cam.zoom * dpr, S = (x, y) => [(x - cam.x - cam.sx) * z + cam.W * dpr / 2, -(y - cam.y - cam.sy) * z + cam.H * dpr / 2];
    const hot = [], night = env.night || 0, storm = env.visibility ? 1 : 0, sun = env.sun;
    for (const v of w.vehicles) {
      if (!cam.visible(v.pos.x, v.pos.y, 20) || !this.rend.shown(v)) continue;
      if (v.alive) {
        const e = v.local(v.g.exhaust.x, v.g.exhaust.y), k = (0.18 + 0.5 * v.spool) * (v.def.engine.type === 'turbine' ? 1.3 : 0.8);
        hot.push([...S(e.x - v.dir * 1.2, e.y + 0.4), 2.2 * z, k]);
      }
      if (v.burning) { const f = v.fireSource(); hot.push([...S(f.x, f.y + 1.5), 4.5 * z, Math.min(1.3, v.burning / 2)]); }
      if (v.jet > 0) { const f = v.local(v.g.ring.x, v.g.ring.y); hot.push([...S(f.x, f.y + 4), 6 * z, 1.8]); }
      if (v.lastFired != null && w.time - v.lastFired < 0.6) { const m = v.muzzle(); hot.push([...S(m.x + m.dx * 1.5, m.y + 0.5), 3 * z, (0.6 - (w.time - v.lastFired)) * 2.2]); }
    }
    for (const m of w.missiles) hot.push([...S(m.x - Math.cos(m.ang) * 1.5, m.y), 1.2 * z, 0.5]);
    hot.sort((a, b) => b[3] - a[3]);
    const waves = w.fx.waves.map(b => { const f = b.t / 0.4, r = Math.min(b.max, 4 + 110 * b.t); return [...S(b.x, b.y), r * z, b.str * 0.5 * (1 - f) * (1 - f)]; });
    const hz = cam.H * dpr * 0.5 + (cam.y - 14) * cam.zoom * dpr * 0.04 + cam.H * dpr * 0.03;
    const hit = w.playerHitAt != null ? Math.max(0, 1 - (w.time - w.playerHitAt) / 0.6) : 0;
    // grade by conditions: low morning sun warm, sandstorm ochre and flat, night cool and desaturated
    const low = sun ? Math.max(0, Math.min(1, (25 - sun.el) / 15)) : 0;
    let lift = [0.0, 0.0, 0.01], gain = [1.0, 1.0, 1.0], sat = 1.05, contrast = 1.05;
    if (night) { lift = [0.0, 0.004, 0.02]; gain = [0.92, 0.97, 1.1]; sat = 0.75; contrast = 1.08; }
    else if (storm) { lift = [0.03, 0.015, 0.0]; gain = [1.04, 0.98, 0.86]; sat = 0.85; contrast = 0.92; }
    else if (low) { lift = [0.0, 0.0, 0.025 * low]; gain = [1.0 + 0.06 * low, 1.0, 1.0 - 0.08 * low]; sat = 1.05; contrast = 1.06; }
    P.render({
      time: w.time, threshold: night ? 0.62 : storm ? 0.88 : 0.86, bloom: night ? 0.75 : storm ? 0.4 : 0.55,
      haze: night ? 0 : sun ? (storm ? 0.25 : 0.35 + 0.65 * (1 - low)) : 0.3, horizon: hz, hot, waves, hit,
      grain: night ? 0.045 : 0.022, vig: 0.38, lift, gain, sat, contrast,
    });
  }
  // field of view of the gunner's sight: tanks have ×3 / ×10; a sight with its own list (TADS) steps through it,
  // with separate lists for the day TV and the FLIR
  sightField() {
    const F = this.player.def.sightFov;
    if (!F) return this.sightMag === 10 ? { fov: 6.5, mag: 10 } : { fov: 21, mag: 3 };
    const L = this.thermal ? F.flir : F.day, i = (((this.fovI == null ? 1 : this.fovI) % L.length) + L.length) % L.length;
    return L[i];
  }
  // First-generation scanning thermal imager: the scene is rendered at the detector's ~180 lines and scaled up
  // (soft, blocky), the previous frame lingers (lag), each scan line has its own slight offset (fixed-pattern
  // noise), grain shimmers; refocus blur after a magnification change, re-calibration flash after polarity.
  tisRender(cam, dt) {
    const cv = this.sightCv, c = this.sctx, rows = this.sightField().fov < 12 ? 180 : 150;
    const t = this.tis || (this.tis = { lo: document.createElement('canvas'), prev: document.createElement('canvas'), cam: new DS.Camera(), blur: 0, cal: 0, fpn: null, grain: null });
    const k = rows / cam.H, lw = Math.max(1, Math.round(cam.W * k));
    for (const x of [t.lo, t.prev]) if (x.width !== lw || x.height !== rows) { x.width = lw; x.height = rows; }
    Object.assign(t.cam, cam); t.cam.dpr = k;
    const lc = t.lo.getContext('2d');
    this.rend.frame(lc, t.cam, { main: false, thermal: true });
    lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalAlpha = 0.35; lc.drawImage(t.prev, 0, 0); lc.globalAlpha = 1;
    t.prev.getContext('2d').drawImage(t.lo, 0, 0);
    if (!t.fpn || t.fpn.height !== rows) {
      t.fpn = document.createElement('canvas'); t.fpn.width = 1; t.fpn.height = rows; const f = t.fpn.getContext('2d'), r = DS.rng(rows);
      for (let y = 0; y < rows; y++) { const v = (r() - 0.5) * 0.08; f.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; f.fillRect(0, y, 1, 1); }
      t.grain = document.createElement('canvas'); t.grain.width = t.grain.height = 128; const g = t.grain.getContext('2d'), d = g.createImageData(128, 128);
      for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 18; }
      g.putImageData(d, 0, 0);
    }
    lc.drawImage(t.fpn, 0, 0, lw, rows);
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true;
    t.blur = Math.max(0, t.blur - dt);
    if (t.blur > 0) c.filter = `blur(${(t.blur * 10 * cam.dpr).toFixed(1)}px)`;
    c.drawImage(t.lo, 0, 0, cv.width, cv.height); c.filter = 'none';
    c.globalAlpha = 0.6; c.drawImage(t.grain, (Math.random() * 128) | 0, (Math.random() * 128) | 0, 64, 64, 0, 0, cv.width, cv.height); c.globalAlpha = 1;
    t.cal = Math.max(0, t.cal - dt);
    if (t.cal > 0) { c.fillStyle = `rgba(255,255,255,${(t.cal / 0.3 * 0.8).toFixed(2)})`; c.fillRect(0, 0, cv.width, cv.height); }
    this.rend.markers(c, cam, false);
  }
  // range to the aiming point. Laser: at once. Optical coincidence rangefinder (M60A1): the gunner needs a
  // couple of seconds to bring the two images together and the reading is off by a few per cent at long range
  lase() {
    const v = this.player, S = v.def.sight;
    if (S.manual) return this.toast('거리측정기 없음 — − / = 로 조준경 거리 눈금 설정');
    if (!S.optical) return DS.FireControl.update(this.world, v, true);
    if (this.ranging) return;
    this.ranging = { t: 2.2 }; this.toast('광학 거리 측정 중…');
  }
  rangingStep(dt) {
    const R = this.ranging, v = this.player, w = this.world; if (!R) return;
    if (!v.def.sight.optical || !v.alive) { this.ranging = null; return; }
    R.t -= dt; if (R.t > 0) return;
    this.ranging = null;
    DS.FireControl.update(w, v, true);
    if (v.fc.range) {
      const err = 0.006 + 0.011 * v.fc.range / 1000;                      // ≈ ±0.6 % up close, ±3 % at 2 km
      v.fc.range *= 1 + DS.AI.gauss(w.rng) * err;
      DS.FireControl.update(w, v, false);
      this.toast(`거리 ${Math.round(v.fc.range / 10) * 10} m (광학 측정)`);
    } else this.toast('측정 실패 — 조준점에 물체 없음');
  }
  // gunner's night sight: thermal imager where fitted, otherwise the passive image intensifier
  nightSight(on) {
    const th = !!this.player.def.sight.thermal;
    this.thermal = on && th; this.nv = on && !th;
    this.sightCv.classList.toggle('thermal', this.thermal); this.sightCv.classList.toggle('nv', this.nv);
    if (!th && on) this.toast('미광증폭 야간 조준경 (열상 없음)');
  }
  cycleAmmo() {
    const v = this.player, list = v.def.ammo, i = list.indexOf(v.gun.ammo);
    v.gun.ammo = list[(i + 1) % list.length];
    if (this.arty && this.arty.on) this.artySolve();
    DS.FireControl.update(this.world, v, false);           // computer re-solves for the new round
  }
  readInput(dt) {
    const k = this.keys, i = this.player.input;
    i.drive = ((k.has('KeyD') || k.has('ArrowRight')) ? 1 : 0) - ((k.has('KeyA') || k.has('ArrowLeft')) ? 1 : 0) || this.touch.drive;
    // gun elevation: a tap moves 0.05° (about 1 mil; Shift: 0.01°); holding starts very slowly after 0.35 s
    // and ramps up to 6°/s (Shift: 0.5°/s) so fine corrections and big swings both work
    const dir = ((k.has('KeyW') || k.has('ArrowUp')) ? 1 : 0) - ((k.has('KeyS') || k.has('ArrowDown')) ? 1 : 0) || this.touch.elev;
    const fine = k.has('ShiftLeft') || k.has('ShiftRight'), d2r = Math.PI / 180;
    if (dir !== 0 && dir !== this.elevDir) { i.elevStep += dir * (fine ? 0.01 : 0.05) * d2r; this.elevHold = 0; }
    this.elevDir = dir;
    if (dir !== 0) {
      this.elevHold += dt;
      const h = this.elevHold - 0.35, r = h < 0 ? 0 : fine ? Math.min(0.5, 0.05 + h * 0.25) : Math.min(6, 0.15 + h * h * 3);
      i.elevRate = dir * r * d2r;
    } else i.elevRate = 0;
    i.fire = k.has('Space') || !!this.mouseFire || this.touch.fire;
    i.coaxFire = k.has('KeyF') || !!this.touch.coax;
    i.mgFire = !!this.mgDown;
    i.mgAim = this.mouse ? this.world.cam.toWorld(this.mouse.x, this.mouse.y) : null;
    if (this.player.heli) {                 // helicopter: W / S climb and descend, the mouse lays sight and gun
      i.climb = dir; i.elevRate = 0; i.elevStep = 0;
      // a selected target (Backspace) locks the sight and gun onto it; the right mouse button lets go and
      // hands the sight back to the mouse
      if (this.mgDown && this.target) { this.target = null; this.toast('표적 고정 해제 — 마우스 조준'); }
      const L = this.player.lock = this.target && this.target.alive && DS.Sensor.seenNow(this.player, this.target) ? this.target : null;
      i.aim = L ? (L.heli ? { x: L.pos.x, y: L.pos.y } : L.local(L.g.ring.x, L.g.ring.y + 0.3)) : i.mgAim;
    }
  }
  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    const ed = this.sbx && this.sbx.edit;
    this.readInput(dt);
    if (ed) this.sbx.frame(dt);
    else { this.trackTarget(dt); this.rangingStep(dt); this.world.update(dt); this.missileCam(dt); this.artyStep(dt); if (this.sbx) this.sbx.tick(); }
    DS.Audio.update(this.world, dt);
    this.rend.frame();
    if (ed) this.sbx.overlay(this.rend.ctx);
    this.postFrame(dt);
    // the gunner's sight is a second render of the world: refreshed every other frame unless it is enlarged
    this._sdt = (this._sdt || 0) + dt;
    if (this.sightCv.classList.contains('big') || (this._sf = !this._sf)) { this.sight(this._sdt); this._sdt = 0; }
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
      set('h-mg', [v.mg && `${v.def.mg.short || 'M2'} ${v.mg.rounds}`, v.coax && `동축 ${v.coax.rounds}`].filter(Boolean).join(' · '));
      if (v.tow && !v.heli) { const t = v.tow; set('h-tow', t.missile ? (t.missile.guided ? '유도 중 — 조준선 유지' : '유선 끊김') : t.loaded ? `장전 ${t.loaded} · 예비 ${t.reserve}` + (t.up > 0 && t.up < 1 ? ' · 발사관 작동' : t.up >= 1 ? ' · 발사 준비' : '') : t.reserve ? `재장전 ${(v.def.tow.reloadTime - t.reload).toFixed(0)} s · 예비 ${t.reserve}` : '소진'); }
      if (v.heli) set('h-tow', v.hudLine());
      { const lb = document.querySelector('#row-tow span'), t = v.heli ? '비행·무장' : 'TOW'; if (lb.textContent !== t) lb.textContent = t; }
      document.getElementById('row-tow').hidden = !v.tow && !v.heli;
      const fc = v.fc;
      set('h-rng', fc.range ? Math.round(fc.range) + ' m' : v.def.sight.manual ? `눈금 ${fc.bs} m` : `— (전투조준 ${fc.bs} m)`);
      set('h-se', (fc.se * 1000).toFixed(2) + ' mil · ' + (fc.se * 180 / Math.PI).toFixed(2) + '°');
      const foes = w.vehicles.filter(x => x.team !== v.team), up = foes.filter(x => x.alive).length;
      const pals = w.vehicles.filter(x => x.team === v.team && x !== v);
      const found = DS.Sensor.list(v, false), inSight = found.filter(e => DS.Sensor.seenNow(v, e)).length;
      set('h-foe', `탐지 ${inSight}` + (found.length > inSight ? ` (+${found.length - inSight} 상실)` : '') + ` · 격파 ${foes.length - up}`);
      this.logPanel();
      document.getElementById('foes').innerHTML = pals.map(e => `<div class="pal${e.alive ? '' : ' down'}"><b>${e.label}</b> <span>${e.alive ? (e.ai ? e.ai.state : '무인') : e.status}</span></div>`).join('') + found.map(e => {
          const c = v.contacts.get(e), now = DS.Sensor.seenNow(v, e), id = c.d >= 2;
          return `<div class="up${e === this.target ? ' sel' : ''}${now ? '' : ' lost'}"><b>${id ? e.def.name : '미식별'}</b> <span>${now ? Math.round(c.range) + ' m' : '상실'}</span></div>`;
        }).join('') + foes.filter(e => !e.alive).map(e => `<div class="down"><b>${e.def.name}</b> <span>격파</span></div>`).join('');
      const over = document.getElementById('over');
      if (this.sbx) { if (!v.alive && !this._dead) this.toast('격파됨 — L 편집 모드에서 「모두 수리」'); this._dead = !v.alive; }
      else if (!v.alive && over.hidden) { over.hidden = false; document.getElementById('over-t').textContent = `격파됨 — ${v.status}`; }
      if (!this.sbx && up === 0 && foes.length && over.hidden && !this._won) { this._won = true; over.hidden = false; document.getElementById('over-t').textContent = '적 소대 전멸 — 임무 완료'; }
      set('h-load', g.reload > 0 ? (g.locked ? '자동장전 — 포 고정 ' : '장전 중 ') + g.reload.toFixed(1) + ' s' : '장전 완료');
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
      let ex = e.pos.x, ey = e.pos.y;
      if (e.team !== v.team && e.alive) {                       // enemies: only what we have found, where we last saw them
        const ct = v.contacts && v.contacts.get(e);
        if (!ct || ct.seen < -1e8) continue;
        ex = ct.x; ey = ct.y; c.fillStyle = DS.Sensor.seenNow(v, e) ? (e === this.target ? '#ffd0a0' : '#ff5a4a') : '#9a8f80';
      } else c.fillStyle = !e.alive ? '#6b5f52' : '#5ab0ff';
      c.fillRect((ex - x0) / span * W - 3, sy(ey) - 6, 6, 6);
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
      if (l.blast) return `<div class="e"><span class="tag trk">폭압</span> ${l.vehicle === this.player ? '<b class="me">피격</b> ' : ''}<b>${l.vehicle.label}</b> · ${l.direct ? '직격' : '폭발 중심에서 ' + l.dist.toFixed(1) + ' m'} · ${l.ammo.short} → ${l.effects.join(', ')}<i>${l.vehicle.status}</i></div>`;
      const [t, c] = RES[l.result];
      let nums = l.result === 'ricochet' ? `경사 ${l.obl.toFixed(0)}°` : `${Math.round(l.pen)} / ${Math.round(l.prot)} mm · 경사 ${l.obl.toFixed(0)}°`;
      if (this.sbx) nums += ` · 착탄 ${Math.round(l.speed)} m/s · 실효 두께 ${Math.round(l.los)} mm` + (l.resid != null ? ` · 잔여 ${Math.round(l.resid)} mm` : '');   // range: full numbers
      const fx = l.effects && l.effects.length ? ' → ' + l.effects.join(', ') : '';
      const who = l.vehicle === this.player ? `<b class="me">피격</b> ${l.shooter ? l.shooter.label + ' → ' : ''}` : '';
      return `<div class="e"><span class="tag ${c}">${t}</span> ${who}<b>${l.vehicle.label}</b> · ${Math.round(l.range)} m · ${l.plate} · ${l.ammo.short} ${nums}${fx}` +
        `<i>${l.vehicle.status}</i></div>`;
    }).join('');
  }

  // Gunner's primary sight: a second render of the world along the sight line with a fixed angular
  // field of view (×10 = 6.5°, ×3 = 21°), so distant targets look small as they do through the real GPS.
  sight(dt) {
    const v = this.player, w = this.world, cv = this.sightCv, cam = this.sightCam;
    const W = cv.clientWidth, H = cv.clientHeight, dpr = w.cam.dpr;
    if (!W) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    cam.resize(W, H, dpr);
    // where the sight line meets something (refreshed a few times a second), eased so the picture
    // does not jump when the line slides off a hull onto the ground behind it
    if (performance.now() - this._sightT > 150) {
      this._sightT = performance.now();
      const r = DS.FireControl.lase(w, v, 6000);
      this.sightR = r ? r.range : 3000;
    }
    const Rt = v.fc.range && w.time - v.fc.lasedAt < 30 ? v.fc.range : this.sightR;
    this.sightRs = this.sightRs ? this.sightRs + (Rt - this.sightRs) * Math.min(1, dt * 7) : Rt;
    const R = Math.max(25, this.sightRs);
    const fld = this.sightField(), fov = fld.fov * Math.PI / 180, mil = W / (fov * 1000);   // px per mil
    // recoil kick + muzzle blast obscuration after our own shot; hull vibration on the move
    if (v.gun.fired !== this._fired) { if (this._fired != null) this.kick = Math.max(this.kick || 0, DS.AMMO[v.gun.ammo].small ? 0.16 : 1); this._fired = v.gun.fired; }
    this.kick = Math.max(0, (this.kick || 0) - dt / 1.6);
    const k2 = this.kick * this.kick, shake = (k2 * 6 + Math.min(1, Math.abs(v.vt) / 12) * 0.35) / mil / 1000 * R;
    const o = v.sightOrigin(), a = v.gun.aimW;
    cam.x = o.x + Math.cos(a) * R + (Math.random() - 0.5) * shake; cam.y = o.y + Math.sin(a) * R + (Math.random() - 0.5) * shake - k2 * 14 / mil / 1000 * R;
    cam.zoom = W / (2 * R * Math.tan(fov / 2));
    if (this.thermal) this.tisRender(cam, dt); else this.rend.frame(this.sctx, cam, { main: false });
    const c = this.sctx, cx = W / 2, cy = H / 2, env = w.env || {};
    // heat shimmer over long ranges in daylight: rows of the picture wobble sideways
    if (!this.thermal && !env.night && R > 500) {
      const amp = Math.min(1.8, R / 1500) * dpr, t = w.time, hpx = cv.height, st = Math.max(2, Math.round(2 * dpr));
      c.setTransform(1, 0, 0, 1, 0, 0);
      for (let y = Math.round(hpx * 0.25); y < hpx * 0.85; y += st) c.drawImage(cv, 0, y, cv.width, st, Math.sin(y * 0.11 / dpr + t * 9) * amp * (0.5 + 0.5 * Math.sin(y * 0.031 / dpr - t * 3)), y, cv.width, st);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // our own muzzle blast and dust blind the sight for a moment (less in thermal)
    if (this.kick > 0) { c.fillStyle = `rgba(${this.thermal ? '150,150,150' : '205,180,140'},${Math.min(0.92, this.kick * (this.thermal ? 0.45 : 1.1))})`; c.fillRect(0, 0, W, H); }
    if (this.thermal) { c.fillStyle = 'rgba(0,0,0,0.13)'; for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1); }   // scan lines
    // eyepiece vignette
    const vg = c.createRadialGradient(cx, cy, W * 0.42, cx, cy, W * 0.51);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.88)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
    // reticle: broken cross with mil ticks, aiming dot; range, round and ready symbols under it
    const ink = this.thermal ? 'rgba(235,255,235,0.95)' : 'rgba(10,10,10,0.9)';
    c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = 1.2;
    const gap = Math.min(W * 0.05, Math.max(6, 2 * mil)), L = W * 0.36, tick = fld.fov < 1.5 ? 1 : fld.fov < 5 ? 2 : fld.fov < 8 ? 5 : fld.fov < 25 ? 20 : 100;
    c.beginPath();
    c.moveTo(cx - L, cy); c.lineTo(cx - gap, cy); c.moveTo(cx + gap, cy); c.lineTo(cx + L, cy);
    c.moveTo(cx, cy + gap); c.lineTo(cx, cy + L); c.moveTo(cx, cy - gap); c.lineTo(cx, cy - L * 0.35);
    for (let m = tick; m * mil < L; m += tick) {
      const d = m * mil, h = (m / tick) % 2 ? 3 : 6;
      c.moveTo(cx - d, cy - h); c.lineTo(cx - d, cy + h); c.moveTo(cx + d, cy - h); c.lineTo(cx + d, cy + h);
      c.moveTo(cx - h, cy + d); c.lineTo(cx + h, cy + d);
    }
    c.stroke();
    c.beginPath(); c.arc(cx, cy, 1.4, 0, 7); c.fill();
    if (v.heli) {                             // TADS: corner brackets round the aiming point
      const q = W * 0.2, e = W * 0.05; c.beginPath();
      for (const [sx2, sy2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.moveTo(cx + sx2 * q, cy + sy2 * (q - e)); c.lineTo(cx + sx2 * q, cy + sy2 * q); c.lineTo(cx + sx2 * (q - e), cy + sy2 * q); }
      c.stroke();
    }
    cv.classList.toggle('mono', !!v.heli);
    const g = v.gun, A = DS.AMMO[g.ammo], lasing = w.time - v.fc.lasedAt < 0.35;
    c.font = `600 ${Math.max(12, Math.round(W / 30))}px ui-monospace, monospace`; c.textAlign = 'center';
    const sym = this.thermal ? 'rgba(235,255,235,0.95)' : '#ffd34a', by = cy + L + Math.max(16, W / 22);
    c.fillStyle = sym;
    c.fillText(v.fc.range ? String(Math.round(v.fc.range)).padStart(4, '0') : '----', cx, by);
    c.textAlign = 'right'; c.fillText(g.reload > 0 ? '' : '▮ READY', cx - W * 0.1, by);
    c.textAlign = 'left'; c.fillText((v.tow && (v.tow.missile || v.tow.up >= 1) ? 'TOW' : A.sight || (A.type === 'HEAT' ? 'HEAT' : 'SABOT')) + (lasing ? '  ✱' : ''), cx + W * 0.1, by);
    c.textAlign = 'center'; c.font = `600 ${Math.max(10, Math.round(W / 40))}px ui-monospace, monospace`;
    c.fillText(`${v.def.sight.name || (v.def.sight.optical ? 'M32' : 'GPS')} ${fld.n ? fld.n + ' ' : ''}×${fld.mag}  ${this.thermal ? (v.heli ? 'FLIR ' : 'TIS ') + (this.blackHot ? 'BH' : 'WH') : this.nv ? 'PASSIVE' : 'DAY'}${v.heli && v.lock ? '  LOCK' : ''}${this.ranging ? '  RANGING' : ''}`, cx, cy - L - 6);
  }
};
addEventListener('load', () => new DS.Game().start().catch(e => { document.getElementById('loading').textContent = '로딩 실패: ' + e.message; console.error(e); }));
