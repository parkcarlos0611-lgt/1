// Interface: compact HUD with a details toggle, pause menu with settings (kept on this device), and touch
// controls for tablets — a thumb joystick on the left and a button set on the right that changes with the
// vehicle (tank, Bradley, howitzer, MLRS, helicopter). Touch buttons press the same keys the keyboard does, so
// every control has one implementation. On the main view one finger aims (helicopter sight, machine gun) and
// two fingers zoom; on the artillery map one finger picks the target and two fingers zoom the map.
DS.UI = {
  KEY: 'ds.ui',
  defaults: { post: 2, resAuto: true, flyFx: true, vol: 0.8, btn: 1, hudFull: false, help: true, touch: 'auto', keys: {} },
  // remappable actions: [name, the key the game listens for]
  ACTIONS: [['전진', 'KeyD'], ['후진', 'KeyA'], ['포 올림 · 상승', 'KeyW'], ['포 내림 · 하강', 'KeyS'], ['사격', 'Space'], ['탄종', 'KeyQ'], ['거리측정', 'KeyE'],
    ['표적 선택', 'Backspace'], ['동축 기관총 · 로켓', 'KeyF'], ['미사일 (TOW · 헬파이어)', 'KeyX'], ['조준경 배율', 'KeyV'], ['열상 · 야간 조준경', 'KeyT'],
    ['미사일 · 포탄 시점', 'Tab'], ['해치', 'KeyU'], ['헬기 방향 전환', 'KeyC'], ['곡사 모드', 'KeyI'], ['조준경 크게', 'KeyG']],
  keyName(c) { return c.replace(/^Key/, '').replace(/^Digit/, '').replace('Space', 'Space').replace('Backspace', '⌫').replace('Arrow', '').replace('Left', '◀').replace('Right', '▶').replace('Up', '▲').replace('Down', '▼'); },
  load() { let s = {}; try { s = JSON.parse(localStorage.getItem(this.KEY) || '{}'); } catch (e) {} return Object.assign({}, this.defaults, s); },
  save(s) { try { localStorage.setItem(this.KEY, JSON.stringify(s)); } catch (e) {} },
};

Object.assign(DS.Game.prototype, {
  uiInit() {
    const S = this.ui = DS.UI.load();
    this.uiApply();
    // HUD: the rows a driver needs at a glance; the rest behind 'details'
    const core = ['h-spd', 'h-ammo', 'h-load', 'h-rng', 'h-foe', 'h-tow', 'h-zoom'];
    document.querySelectorAll('#hud .r').forEach(r => { const b = r.querySelector('b'); if (!b || !core.some(id => r.querySelector('#' + id))) r.classList.add('x'); });
    document.getElementById('hudmore').onclick = () => { S.hudFull = !S.hudFull; this.uiApply(); DS.UI.save(S); };
    // pause menu
    const pm = document.getElementById('pause');
    document.getElementById('pausebtn').onclick = () => this.setPause(!this.paused);
    pm.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const a = b.dataset.p;
      if (a === 'resume') this.setPause(false);
      if (a === 'restart') document.getElementById('again').click();
      if (a === 'menu') document.getElementById('tomenu').click();
      if (a === 'post') { S.post = +b.dataset.v; }
      if (a === 'res') S.resAuto = !S.resAuto;
      if (a === 'flyfx') S.flyFx = !S.flyFx;
      if (a === 'btn') S.btn = +b.dataset.v;
      if (a === 'hud') S.hudFull = !S.hudFull;
      if (a === 'help') S.help = !S.help;
      if (a === 'touch') S.touch = b.dataset.v;
      DS.UI.save(S); this.uiApply();
    });
    // key bindings: S.keys maps a physical key to the key the game listens for. Pressed keys are translated before
    // anything else sees them (capture phase), so every handler keeps reading the original codes.
    const remap = e => {
      if (!e.isTrusted || this.binding) return;
      const to = S.keys[e.code]; if (!to || to === e.code) return;
      e.stopImmediatePropagation(); e.preventDefault();
      dispatchEvent(new KeyboardEvent(e.type, { code: to, shiftKey: e.shiftKey, repeat: e.repeat, bubbles: true }));
    };
    addEventListener('keydown', remap, true); addEventListener('keyup', remap, true);
    addEventListener('keydown', e => {
      if (!this.binding || !e.isTrusted) return;
      e.stopImmediatePropagation(); e.preventDefault();
      if (e.code !== 'Escape') { const to = this.binding; for (const k in S.keys) if (S.keys[k] === to || k === e.code) delete S.keys[k]; if (e.code !== to) S.keys[e.code] = to; DS.UI.save(S); }
      this.binding = null; this.keyList();
    }, true);
    pm.querySelector('#p-keys').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.reset) { S.keys = {}; DS.UI.save(S); this.binding = null; }
      else this.binding = b.dataset.to;
      this.keyList();
    });
    this.keyList();
    pm.querySelector('#p-vol').addEventListener('input', e => { S.vol = +e.target.value / 100; DS.UI.save(S); this.uiApply(); });
    addEventListener('keydown', e => { if (e.code === 'Escape' && !(this.sbx && this.sbx.edit)) this.setPause(!this.paused); });
    this.touchInit();
  },
  uiApply() {
    const S = this.ui, $ = s => document.querySelector(s);
    if (this.post && this.post.ok) { this.post.setQuality(S.post); try { localStorage.setItem('ds.post', S.post); } catch (e) {} }
    DS.T.resAuto = S.resAuto; DS.T.flyFx = S.flyFx !== false; if (!S.resAuto && this.rs !== 1) { this.rs = 1; this.resize(); }
    DS.Audio.vol = S.vol; if (DS.Audio.master && DS.Audio.on) DS.Audio.master.gain.value = S.vol;
    document.documentElement.style.setProperty('--tb', (64 * S.btn).toFixed(0) + 'px');
    $('#hud').classList.toggle('compact', !S.hudFull); $('#hudmore').textContent = S.hudFull ? '간단히 ▴' : '자세히 ▾';
    this.setHelp(S.help);
    const touch = S.touch === 'on' || (S.touch === 'auto' && matchMedia('(pointer: coarse)').matches);
    document.body.classList.toggle('touchui', touch);
    // reflect in the menu
    const pm = $('#pause'), on = (sel, v) => pm.querySelectorAll(sel).forEach(b => b.classList.toggle('on', v(b)));
    on('[data-p=post]', b => +b.dataset.v === S.post); on('[data-p=btn]', b => +b.dataset.v === S.btn); on('[data-p=touch]', b => b.dataset.v === S.touch);
    on('[data-p=res]', () => S.resAuto); on('[data-p=flyfx]', () => S.flyFx !== false); on('[data-p=hud]', () => S.hudFull); on('[data-p=help]', () => S.help);
    pm.querySelector('#p-vol').value = Math.round(S.vol * 100); pm.querySelector('#p-volv').textContent = Math.round(S.vol * 100) + ' %';
  },
  keyList() {
    const S = this.ui, el = document.getElementById('p-keys');
    const phys = to => { for (const k in S.keys) if (S.keys[k] === to) return k; return to; };
    el.innerHTML = DS.UI.ACTIONS.map(([n, to]) => `<div class="krow"><span>${n}</span><button type="button" data-to="${to}" class="${this.binding === to ? 'on' : ''}">${this.binding === to ? '키를 누르세요… (Esc 취소)' : DS.UI.keyName(phys(to))}</button></div>`).join('') +
      '<div class="krow"><span></span><button type="button" data-reset="1">기본값으로</button></div>';
  },
  setPause(on) {
    this.paused = on; document.getElementById('pause').hidden = !on; document.body.classList.toggle('paused', on);
    if (on) { this.keys.clear(); this.mouseFire = false; this.mgDown = false; }
    if (DS.Audio.ctx) { if (on) DS.Audio.ctx.suspend(); else DS.Audio.ctx.resume(); }
  },

  // ---- touch ----
  touchInit() {
    const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    this.tkey = key;
    // joystick: x drives (or leans the helicopter), y lays the gun (or climbs)
    const js = document.getElementById('joy'), knob = js.querySelector('i');
    let jid = null, c0 = null;
    const move = e => {
      const R = js.clientWidth / 2, dx = e.clientX - c0.x, dy = e.clientY - c0.y, L = Math.hypot(dx, dy), k = L > R ? R / L : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      const x = dx * k / R, y = -dy * k / R;
      this.touch.drive = Math.abs(x) > 0.18 ? Math.sign(x) * Math.min(1, (Math.abs(x) - 0.18) / 0.62) : 0;
      this.touch.elev = Math.abs(y) > 0.35 ? Math.sign(y) : 0;
    };
    js.addEventListener('pointerdown', e => { e.preventDefault(); jid = e.pointerId; js.setPointerCapture(jid); const r = js.getBoundingClientRect(); c0 = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; move(e); });
    js.addEventListener('pointermove', e => { if (e.pointerId === jid) move(e); });
    const end = e => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; this.touch.drive = 0; this.touch.elev = 0; };
    js.addEventListener('pointerup', end); js.addEventListener('pointercancel', end);
    // right-hand buttons: built per vehicle
    const pad = document.getElementById('tpad');
    pad.addEventListener('pointerdown', e => {
      const b = e.target.closest('button'); if (!b) return; e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on');
      if (b.dataset.m2) { this.mgDown = true; return; }
      if (b.dataset.hold) key(b.dataset.k, true); else { key(b.dataset.k, true); key(b.dataset.k, false); }
    });
    const up = e => { const b = e.target.closest('button'); if (!b) return; b.classList.remove('on'); if (b.dataset.m2) { this.mgDown = false; return; } if (b.dataset.hold) key(b.dataset.k, false); };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    // the main view: one finger aims, two fingers zoom
    const pts = new Map(), cv = this.cv, cam = this.world.cam;
    let pinch = null;
    cv.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || (this.sbx && this.sbx.edit)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.tzoom }; this.touchAim = false; }
      else { this.mouse = { x: e.clientX, y: e.clientY }; this.touchAim = true; }
    });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); cam.tzoom = Math.max(this.zoomMin(), Math.min(DS.T.camera.zoomMax, pinch.z * d / pinch.d)); }
      else if (this.touchAim) this.mouse = { x: e.clientX, y: e.clientY };
    });
    const lift = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
    cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
    // the artillery map: two fingers zoom it
    const am = document.getElementById('artymap'), mp = new Map(); let mz = null;
    am.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') return; mp.set(e.pointerId, e.clientX); if (mp.size === 2 && this.arty && this.arty.view) { const [a, b] = [...mp.values()]; mz = { d: Math.abs(a - b) || 1, v: { ...this.arty.view }, c: (a + b) / 2 }; } });
    am.addEventListener('pointermove', e => {
      if (!mp.has(e.pointerId)) return; mp.set(e.pointerId, e.clientX);
      if (mz && mp.size >= 2) {
        const [a, b] = [...mp.values()], k = mz.d / (Math.abs(a - b) || 1), r = am.getBoundingClientRect(), u = (mz.c - r.left) / r.width, V = mz.v, xm = V.x0 + u * (V.x1 - V.x0);
        const x0 = xm - (xm - V.x0) * k, x1 = xm + (V.x1 - xm) * k, L = this.world.terrain.length;
        if (x1 - x0 > 300) this.arty.span = { x0: Math.max(0, x0), x1: Math.min(L, x1) };
      }
    });
    const ml = e => { mp.delete(e.pointerId); if (mp.size < 2) mz = null; };
    am.addEventListener('pointerup', ml); am.addEventListener('pointercancel', ml);
  },
  // button set for the vehicle being driven: [label, key, hold?, class]
  touchLayout() {
    const v = this.player, id = v.def.id; if (this._tl === id) return; this._tl = id;
    const B = [];
    if (v.heli) B.push(['표적', 'Backspace'], ['시야', 'KeyV'], ['열상', 'KeyT'], ['방향', 'KeyC'], ['M캠', 'Tab'], ['헬파이어', 'KeyX', 0, 'wide'], ['로켓', 'KeyF', 1], ['기관포', 'Space', 1, 'fire']);
    else if (v.def.indirectOnly) B.push(['고/저각', 'KeyO'], ['정렬', 'KeyJ'], ['탄시점', 'Tab'], ['발사', 'Space', 1, 'fire']);
    else if (v.def.howitzer) B.push(['곡사', 'KeyI'], ['장약', 'KeyK'], ['고/저각', 'KeyO'], ['정렬', 'KeyJ'], ['탄', 'KeyQ'], ['탄시점', 'Tab'], ['사격', 'Space', 1, 'fire']);
    else {
      B.push(['표적', 'Backspace'], [v.def.sight.manual ? '눈금+' : '거리', v.def.sight.manual ? 'Equal' : 'KeyE'], ...(v.def.sight.manual ? [['눈금−', 'Minus']] : []), ['탄', 'KeyQ'], ['배율', 'KeyV'], ['열상', 'KeyT']);
      if (v.tow) B.push(['M캠', 'Tab'], ['TOW', 'KeyX', 0, 'wide']);
      B.push(['동축', 'KeyF', 1]);
      if (v.def.mg) B.push([v.def.mg.short || 'M2', 'm2', 1]);       // commander's gun: aim with a finger on the view
      B.push(['사격', 'Space', 1, 'fire']);
    }
    B.sort((a, b) => (b[3] === 'fire') - (a[3] === 'fire'));        // the trigger first: it takes the corner
    document.getElementById('tpad').innerHTML = B.map(([t, k, h, c]) => `<button type="button" data-k="${k}"${k === 'm2' ? ' data-m2="1"' : ''}${h ? ' data-hold="1"' : ''}${c ? ` class="${c}"` : ''}>${t}</button>`).join('');
    document.getElementById('joy').dataset.mode = v.heli ? '이동 · 상승/하강' : v.def.indirectOnly || v.def.howitzer ? '이동' : '이동 · 포 앙각';
  },
});
