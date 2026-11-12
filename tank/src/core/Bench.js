// Benchmark: a fixed run through four heavy scenes of the Kuwait mission, 20 s each after 3 s to settle,
// with the player's tank invulnerable and driving slowly forward so the view scrolls:
//   1 dawn contact at the outskirts (05:45) — the platoons in a gun fight with the T-55s and BMPs
//   2 night, many lights (01:00, no moon) — wrecks burning, searchlights, muzzle flashes
//   3 sandstorm (visibility 700 m, wind 9 m/s)
//   4 buildings collapsing (10:00) — two city blocks blown down in front of the camera
// The result lists, per scene, the frame rate, the 1 % low, the 99th-percentile frame time and the script's
// own work per frame, with the device, the render size and the settings. Started from the menu (#bench).
DS.Bench = class Bench {
  constructor(g) {
    this.g = g; this.i = -1; this.t = 0; this.res = []; this.iv = []; this.wk = []; this.done = false;
    this.SC = [
      { name: '새벽 교전', set: () => this.dawn() },
      { name: '야간 · 다수 광원', set: () => this.night() },
      { name: '모래폭풍', set: () => this.storm() },
      { name: '건물 붕괴', set: () => this.collapse() },
    ];
    this.WARM = 3; this.LEN = 20;
    g.player.god = true;
    // the settings stay as chosen for the whole run (no automatic resolution or effect drops)
    DS.T.postAuto = false; DS.T.resAuto = false; if (g.rs !== 1) { g.rs = 1; g.resize(); }
    this.next();
  }
  tag(s) { const el = document.getElementById('benchtag') || Object.assign(document.createElement('div'), { id: 'benchtag' }); if (!el.parentNode) document.body.appendChild(el); el.textContent = s; el.hidden = !s; }
  next() {
    if (this.i >= 0) this.res.push(Object.assign({ name: this.SC[this.i].name }, DS.Perf.summary(this.iv, this.wk)));
    this.i++; this.t = 0; this.iv = []; this.wk = [];
    if (this.i >= this.SC.length) return this.finish();
    const W = this.g.world; W.particles.n = 0; if (W.fx.flashes) W.fx.flashes.length = 0;
    this.SC[this.i].set();
    DS.Sky.update(W, 0);
    this.g.nightSight((W.env.night || 0) > 0.5);
  }
  step(dt) {
    if (this.done) return;
    this.t += dt;
    const p = this.g.player; p.god = true; if (p.alive) p.input.drive = p.dir * 0.35;
    if (this.SC[this.i].tick) this.SC[this.i].tick(this.t);
    this.tag(`벤치마크 ${this.i + 1}/${this.SC.length} · ${this.SC[this.i].name} · ${this.t < this.WARM ? '준비' : Math.ceil(this.WARM + this.LEN - this.t) + ' s'}`);
    if (this.t >= this.WARM + this.LEN) this.next();
  }
  record() {
    if (this.done || this.t < this.WARM) return;
    const P = DS.Perf, j = (P.i - 1 + P.N) % P.N;
    if (P.iv[j] > 0) this.iv.push(P.iv[j]); this.wk.push(P.wk[j]);
  }
  // ---- scenes ----
  front(x0) {
    // friendly tanks pulled up behind the player, the player at x0
    const W = this.g.world, me = this.g.player;
    me.place(x0); let k = 1;
    for (const v of W.vehicles) if (v.team === me.team && !v.heli && v !== me) { if (v.alive) v.place(x0 - 22 * k++); }
    W.cam.x = me.pos.x; W.cam.y = me.pos.y;
  }
  env(clock, vis, wind, moonless) {
    const E = this.g.world.env; E.clock = clock; E.speed = 0; E.visibility = vis; E.moonless = !!moonless;
    this.g.world.wind = wind; E.wind = wind;
  }
  dawn() { this.env(5.75, 0, 3); this.front(1750); this.g.world.cam.tzoom = DS.T.camera.presets[1]; }
  night() {
    this.env(1.0, 0, 1, true); this.front(1900);
    const W = this.g.world;
    // wrecks on fire up ahead (fire light, smoke against the dark)
    let n = 0; for (const v of W.vehicles) if (v.team !== this.g.player.team && !v.heli && Math.abs(v.pos.x - 2350) < 700 && n < 4) { v.ignite(); v.burning = 3; n++; }
    this.g.player.light = 4;                                   // our white flood on
  }
  storm() { this.env(14, 700, 9); this.front(2050); }
  collapse() {
    this.env(10, 0, 2); this.front(2150);
    const W = this.g.world, x = this.g.player.pos.x;
    this.blds = ['m3', 'h2'].map((k, i) => { const b = new DS.Structure(k, x + 24 + i * 30, W); W.buildings.push(b); return b; });
    this.SC[this.i].tick = t => {
      // a blast every 0.6 s for 7 s, climbing each block
      if (t > 2 && t < 9 && Math.floor(t / 0.6) !== this._bk) {
        this._bk = Math.floor(t / 0.6);
        for (const b of this.blds) { const h = Math.max(4, b.top - b.base), y = b.base + ((this._bk * 0.37) % 1) * h * 0.8; b.blast(W, b.x + (Math.random() - 0.5) * b.w * 0.8, y, 7); }
      }
      W.cam.tzoom = DS.T.camera.presets[1];
    };
  }
  finish() {
    this.done = true; this.tag('');
    const g = this.g, P = DS.Perf, cv = g.cv, r = this.res;
    const ok = r.every(s => s.fps >= 59 && s.low1 >= 55 && s.p99 <= 18);
    const f = (v, d = 1) => (v || 0).toFixed(d);
    const rows = r.map(s => `<tr><td>${s.name}</td><td>${f(s.fps)}</td><td>${f(s.low1)}</td><td>${f(s.p99)}</td><td>${f(s.worst)}</td><td>${f(s.work)} / ${f(s.workP99)}</td><td>${s.over}</td></tr>`).join('');
    const ua = navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').replace(/ ?\(KHTML, like Gecko\)/, '');
    const el = document.createElement('div'); el.id = 'benchres';
    el.innerHTML = `<div class="pbox"><h2>벤치마크 결과 ${ok ? '<span class="ok">합격</span>' : '<span class="ng">미달</span>'}</h2>
      <table><thead><tr><th>장면</th><th>평균 fps</th><th>1% 저점</th><th>p99 ms</th><th>최악 ms</th><th>작업 ms 평균/p99</th><th>18ms 초과</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="bmeta">기준: 평균 ≥ 59 · 1% 저점 ≥ 55 · p99 ≤ 18 ms<br>
      화면 ${screen.width}×${screen.height} @${devicePixelRatio} · 렌더 ${cv.width}×${cv.height} (×${f(g.rs || 1, 2)}) · 주사율 ${P.hz() || '?'} Hz · 제한 ${P.mode === 'free' ? '자유' : P.mode} · 화면 효과 ${['끔', '낮음', '높음'][g.post && g.post.ok ? g.post.q : 0]} · 자동 조절 끔(측정 중 고정)<br>${ua}</p>
      <div class="prow"><button type="button" class="big" id="b-again">다시 실행</button><button type="button" id="b-menu">작전 선택</button></div></div>`;
    document.body.appendChild(el);
    el.querySelector('#b-again').onclick = () => { location.hash = 'bench'; location.reload(); };
    el.querySelector('#b-menu').onclick = () => { location.hash = ''; location.reload(); };
    g.paused = true;
    window.__benchResult = r;
  }
};
