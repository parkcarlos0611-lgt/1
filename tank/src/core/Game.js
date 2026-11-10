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
    await Promise.all(['m1a1', 'm2a2', 't55', 't62', 't72'].map(id => this.rend.load(DS.VEHICLES[id])));
    DS.Armor.calibrate();
    this.resize(); addEventListener('resize', () => this.resize());
    document.getElementById('loading').remove();
    window.__game = this;
    // #m1 / #m2 / #m3 starts that mission directly (used by "다시 시작"); otherwise show the menu
    const m = /^#m(\d)(b?)$/.exec(location.hash), i = m ? +m[1] - 1 : -1;
    if (DS.MISSIONS[i]) this.begin(i, m[2] ? 'm2a2' : 'm1a1'); else this.menu();
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
    el.hidden = false;
  }
  // key guide: H or the ? button; the choice is remembered on this device
  setHelp(on) {
    document.getElementById('help').classList.toggle('hide', !on);
    document.getElementById('helpbtn').classList.toggle('on', on);
    try { localStorage.setItem('ds.help', on ? '1' : '0'); } catch (e) {}
  }
  begin(i, veh = 'm1a1') {
    const M = this.mission = DS.MISSIONS[i], W = this.world;
    document.getElementById('menu').hidden = true; document.body.classList.add('playing');
    let help = true; try { help = localStorage.getItem('ds.help') !== '0'; } catch (e) {}
    this.setHelp(help);
    document.getElementById('helpbtn').onclick = () => this.setHelp(document.getElementById('help').classList.contains('hide'));
    W.env = { ...M.env }; W.wind = M.env.wind;
    const other = veh === 'm2a2' ? 'm1a1' : 'm2a2', nm = { m1a1: 'M1A1', m2a2: '브래들리' };
    const v = new DS.Vehicle(DS.VEHICLES[veh], M.start, W.terrain, { label: nm[veh] + ' (나)' });
    W.vehicles.push(v); this.player = v;
    // the other vehicle is an AI wingman. The tank always leads: with the Bradley, the M1A1 moves 45 m ahead
    // and takes the first contact; with the M1A1, the Bradley follows 45 m behind
    const off = veh === 'm2a2' ? 45 : -45;
    const wm = new DS.Vehicle(DS.VEHICLES[other], Math.max(12, M.start + off), W.terrain, { label: nm[other] + (veh === 'm2a2' ? ' (아군 선두)' : ' (아군)') });
    W.vehicles.push(wm); new DS.TankAI(wm, W, { follow: v, offset: off });
    for (const [id, x, label] of M.enemies) {
      const e = new DS.Vehicle(DS.VEHICLES[id], x, W.terrain, { dir: -1, label });
      W.vehicles.push(e); new DS.TankAI(e, W);
    }
    DS.FireControl.update(W, v, false);
    W.cam.x = v.pos.x; W.cam.y = v.pos.y;
    if (M.env.night) { this.thermal = true; this.sightCv.classList.add('thermal'); }
    document.getElementById('h-title').textContent = `${nm[veh]} · 작전 ${i + 1} ${M.name}`;
    document.getElementById('again').onclick = () => { location.hash = 'm' + (i + 1) + (veh === 'm2a2' ? 'b' : ''); location.reload(); };
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
    // browsers only start audio after a user gesture
    const wake = () => DS.Audio.init();
    addEventListener('pointerdown', wake); addEventListener('keydown', wake);
    addEventListener('keydown', e => {
      if (e.repeat) return;
      if (e.code === 'KeyM') { const on = DS.Audio.toggle(); this.toast(on ? '소리 켬' : '소리 끔'); }
      this.keys.add(e.code);
      if (e.code === 'F9') { this.world.debug = !this.world.debug; e.preventDefault(); }
      if (e.code === 'Digit1') cam.tzoom = P[0];
      if (e.code === 'Digit2') cam.tzoom = P[1];
      if (e.code === 'Digit3') cam.tzoom = P[2];
      if (e.code === 'KeyQ') this.cycleAmmo();
      if (e.code === 'KeyE') this.lase();
      if (e.code === 'KeyV') this.sightMag = this.sightMag === 10 ? 3 : 10;
      if (e.code === 'KeyT') { this.thermal = !this.thermal; this.sightCv.classList.toggle('thermal', this.thermal); }
      if (e.code === 'KeyB') { this.blackHot = !this.blackHot; this.sightCv.classList.toggle('bh', this.blackHot); }
      if (e.code === 'KeyG') this.sightCv.classList.toggle('big');
      if (e.code === 'Tab') {
        e.preventDefault();
        if (!this.player.tow) this.toast('미사일 시점은 브래들리 전용');
        else { this.mcam = !this.mcam; this.mcamHold = null; this.toast(this.mcam ? (this.player.tow.missile ? '미사일 시점' : '미사일 시점 켬 — 다음 발사부터 따라감') : '미사일 시점 끔'); }
      }
      if (e.code === 'KeyX') { if (this.player.tow) this.player.input.tow = true; else this.toast('TOW 미사일은 브래들리 전용'); }
      if (e.code === 'KeyZ') { this.world.xray = this.world.xray === false; this.toast(this.world.xray ? 'TOW 발사관 투시 켬' : 'TOW 발사관 투시 끔'); }
      if (e.code === 'KeyR') this.player.place(this.player.pos.x);
      if (e.code === 'KeyC' && this.mouse) { const m = cam.toWorld(this.mouse.x, this.mouse.y); this.world.terrain.crater(m.x, 1.6, 0.7); this.world.terrain.relax(undefined, undefined, 8); }
      if (e.code === 'KeyH') this.setHelp(document.getElementById('help').classList.contains('hide'));
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    this.cv.addEventListener('mousemove', e => this.mouse = { x: e.clientX, y: e.clientY });
    this.cv.addEventListener('wheel', e => {
      cam.tzoom = Math.max(DS.T.camera.zoomMin, Math.min(DS.T.camera.zoomMax, cam.tzoom * Math.exp(-e.deltaY * 0.0012)));
      e.preventDefault();
    }, { passive: false });
    this.cv.addEventListener('mousedown', e => { if (e.button === 0) this.mouseFire = true; if (e.button === 2) this.mgDown = true; });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouseFire = false; if (e.button === 2) this.mgDown = false; });
    this.cv.addEventListener('contextmenu', e => e.preventDefault());
    // touch buttons
    document.querySelectorAll('[data-t]').forEach(b => {
      const [k, val] = b.dataset.t.split(':'), on = ev => { ev.preventDefault(); if (k === 'fire' || k === 'coax') this.touch[k] = true; else this.touch[k] = +val; b.classList.add('on'); };
      const off = ev => { ev.preventDefault(); if (k === 'fire' || k === 'coax') this.touch[k] = false; else this.touch[k] = 0; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
    document.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => cam.tzoom = P[+b.dataset.z]));
    document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('pointerdown', ev => {
      ev.preventDefault(); const a = b.dataset.act;
      if (a === 'lase') this.lase(); else if (a === 'mcam') { if (this.player.tow) { this.mcam = !this.mcam; this.toast(this.mcam ? '미사일 시점 켬' : '미사일 시점 끔'); } } else if (a === 'ammo') this.cycleAmmo(); else if (a === 'mag') this.sightMag = this.sightMag === 10 ? 3 : 10;
    }));
  }
  toast(msg) {
    const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('on');
    clearTimeout(this._toastT); this._toastT = setTimeout(() => el.classList.remove('on'), 1200);
  }
  // Missile camera (Tab): rides alongside the player's TOW in flight, holds on the impact for a moment,
  // then hands back to the tank. Off by default; when on it picks up every launch.
  missileCam(dt) {
    const cam = this.world.cam, t = this.player.tow, tag = document.getElementById('mcam');
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
    i.coaxFire = k.has('KeyF') || !!this.touch.coax;
    i.mgFire = !!this.mgDown;
    i.mgAim = this.mouse ? this.world.cam.toWorld(this.mouse.x, this.mouse.y) : null;
  }
  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    this.readInput(dt);
    this.world.update(dt);
    this.missileCam(dt);
    DS.Audio.update(this.world, dt);
    this.rend.frame();
    this.sight(dt);
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
      set('h-mg', [v.mg && `M2 ${v.mg.rounds}`, v.coax && `동축 ${v.coax.rounds}`].filter(Boolean).join(' · '));
      if (v.tow) { const t = v.tow; set('h-tow', t.missile ? (t.missile.guided ? '유도 중 — 조준선 유지' : '유선 끊김') : t.loaded ? `장전 ${t.loaded} · 예비 ${t.reserve}` + (t.up > 0 && t.up < 1 ? ' · 발사관 작동' : t.up >= 1 ? ' · 발사 준비' : '') : t.reserve ? `재장전 ${(v.def.tow.reloadTime - t.reload).toFixed(0)} s · 예비 ${t.reserve}` : '소진'); }
      document.getElementById('row-tow').hidden = !v.tow;
      const fc = v.fc;
      set('h-rng', fc.range ? Math.round(fc.range) + ' m' : `— (전투조준 ${fc.bs} m)`);
      set('h-se', (fc.se * 1000).toFixed(2) + ' mil · ' + (fc.se * 180 / Math.PI).toFixed(2) + '°');
      const foes = w.vehicles.filter(x => x.team !== v.team), up = foes.filter(x => x.alive).length;
      const pals = w.vehicles.filter(x => x.team === v.team && x !== v);
      set('h-foe', `${up} / ${foes.length} 대 전투 가능`);
      this.logPanel();
      document.getElementById('foes').innerHTML = pals.map(e => `<div class="pal${e.alive ? '' : ' down'}"><b>${e.label}</b> <span>${e.alive ? e.ai.state : e.status}</span></div>`).join('') + foes.map(e =>
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
      c.fillStyle = !e.alive ? '#6b5f52' : e.team === v.team ? '#5ab0ff' : '#ff5a4a'; c.fillRect((e.pos.x - x0) / span * W - 3, sy(e.pos.y) - 6, 6, 6);
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
    const fov = (this.sightMag === 10 ? 6.5 : 21) * Math.PI / 180, mil = W / (fov * 1000);   // px per mil
    // recoil kick + muzzle blast obscuration after our own shot; hull vibration on the move
    if (v.gun.fired !== this._fired) { if (this._fired != null) this.kick = Math.max(this.kick || 0, DS.AMMO[v.gun.ammo].d >= 0.1 ? 1 : 0.16); this._fired = v.gun.fired; }
    this.kick = Math.max(0, (this.kick || 0) - dt / 1.6);
    const k2 = this.kick * this.kick, shake = (k2 * 6 + Math.min(1, Math.abs(v.vt) / 12) * 0.35) / mil / 1000 * R;
    const o = v.sightOrigin(), a = v.gun.aimW;
    cam.x = o.x + Math.cos(a) * R + (Math.random() - 0.5) * shake; cam.y = o.y + Math.sin(a) * R + (Math.random() - 0.5) * shake - k2 * 14 / mil / 1000 * R;
    cam.zoom = W / (2 * R * Math.tan(fov / 2));
    this.rend.frame(this.sctx, cam, { main: false, thermal: this.thermal });
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
    const gap = Math.max(6, 2 * mil), L = W * 0.36, tick = this.sightMag === 10 ? 5 : 20;
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
    const g = v.gun, A = DS.AMMO[g.ammo], lasing = w.time - v.fc.lasedAt < 0.35;
    c.font = `600 ${Math.max(12, Math.round(W / 30))}px ui-monospace, monospace`; c.textAlign = 'center';
    const sym = this.thermal ? 'rgba(235,255,235,0.95)' : '#ffd34a', by = cy + L + Math.max(16, W / 22);
    c.fillStyle = sym;
    c.fillText(v.fc.range ? String(Math.round(v.fc.range)).padStart(4, '0') : '----', cx, by);
    c.textAlign = 'right'; c.fillText(g.reload > 0 ? '' : '▮ READY', cx - W * 0.1, by);
    c.textAlign = 'left'; c.fillText((v.tow && (v.tow.missile || v.tow.up >= 1) ? 'TOW' : A.sight || (A.type === 'HEAT' ? 'HEAT' : 'SABOT')) + (lasing ? '  ✱' : ''), cx + W * 0.1, by);
    c.textAlign = 'center'; c.font = `600 ${Math.max(10, Math.round(W / 40))}px ui-monospace, monospace`;
    c.fillText(`GPS ×${this.sightMag}  ${this.thermal ? 'TIS ' + (this.blackHot ? 'BH' : 'WH') : 'DAY'}`, cx, cy - L - 6);
  }
};
addEventListener('load', () => new DS.Game().start().catch(e => { document.getElementById('loading').textContent = '로딩 실패: ' + e.message; console.error(e); }));
