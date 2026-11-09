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
  }
  async start() {
    const def = DS.VEHICLES.m1a1;
    await this.rend.load(def);
    const v = new DS.Vehicle(def, 60, this.world.terrain);
    this.world.vehicles.push(v); this.player = v;
    this.world.cam.x = v.pos.x; this.world.cam.y = v.pos.y;
    this.resize(); addEventListener('resize', () => this.resize());
    this.bindInput();
    document.getElementById('loading').remove();
    requestAnimationFrame(t => this.loop(t));
    window.__game = this;
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
      if (e.code === 'KeyQ') { const g = this.player.gun; g.ammo = g.ammo === 'M829A1' ? 'M830' : 'M829A1'; }
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
    this.hud();
    requestAnimationFrame(t2 => this.loop(t2));
  }
  hud() {
    const v = this.player, w = this.world, T = w.terrain, g = v.gun, A = DS.AMMO[g.ammo];
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
      set('h-load', g.reload > 0 ? '장전 중 ' + g.reload.toFixed(1) + ' s' : '장전 완료');
      set('h-pos', (v.pos.x / 1000).toFixed(2) + ' km');
      set('h-zoom', w.cam.zoom.toFixed(0) + ' px/m');
      set('h-fps', Math.round(this.fps) + ' fps');
      const last = w.hits[w.hits.length - 1];
      set('h-hit', last ? `${Math.round(last.range)} m · ${last.t.toFixed(2)} s · ${Math.round(Math.hypot(last.vx, last.vy))} m/s` : '—');
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
  }
};
addEventListener('load', () => new DS.Game().start().catch(e => { document.getElementById('loading').textContent = '로딩 실패: ' + e.message; console.error(e); }));
