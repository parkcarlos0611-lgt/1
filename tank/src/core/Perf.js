// Performance: frame timing, the on-screen overlay and frame pacing.
//   Frame pacing (DS.Perf.mode): '60' renders every 1/60 s whatever the display's rate (a 120 Hz iPad skips every
//   other refresh), '120' every 1/120 s, 'free' every refresh the browser gives. iPad Safari hands pages 60
//   refreshes a second unless "Prefer Page Rendering Updates near 60fps" is turned off (Settings › Apps ›
//   Safari › Advanced › Feature Flags); the overlay shows the rate it actually gets.
//   Timing: the main loop marks its stages (lap); the overlay shows the frame interval (what the eye sees,
//   including the GPU) against the script's own work, so a frame that is slow with little work points at the GPU.
//   Draw calls are counted only while the overlay is open.
DS.Perf = {
  N: 300,
  mode: '60', on: false,
  iv: new Float32Array(300), wk: new Float32Array(300), i: 0, n: 0,     // rendered frames: interval, work (ms)
  raw: new Float32Array(120), ri: 0, rn: 0, lastRaf: 0, lastDraw: 0,    // every browser refresh (for the display's rate)
  sec: {}, secAvg: {}, t0: 0, tl: 0, calls: 0, callsAvg: 0, _fr: 0,
  // pacing: should this refresh be rendered?
  due(t) {
    if (this.lastRaf) { this.raw[this.ri] = t - this.lastRaf; this.ri = (this.ri + 1) % 120; this.rn = Math.min(120, this.rn + 1); }
    this.lastRaf = t;
    const tgt = this.mode === '60' ? 1000 / 60 : this.mode === '120' ? 1000 / 120 : 0;
    if (!tgt || !this.lastDraw) { this.lastDraw = t; return true; }
    if (t - this.lastDraw < tgt - 2.5) return false;
    // keep to the grid of the target interval so the cadence stays even; after a stall start again from now
    this.lastDraw = t - this.lastDraw < tgt * 1.5 ? this.lastDraw + tgt : t;
    return true;
  },
  hz() { if (this.rn < 30) return 0; const a = Array.from(this.raw.subarray(0, this.rn)).sort((p, q) => p - q), m = a[a.length >> 1]; return m > 0 ? Math.round(1000 / m / 10) * 10 : 0; },
  begin(t, iv) {
    this.t0 = this.tl = performance.now(); this.calls = 0;
    if (iv > 0) { this.iv[this.i] = iv; }
  },
  lap(name) { const t = performance.now(); this.sec[name] = (this.sec[name] || 0) + t - this.tl; this.tl = t; },
  end() {
    const w = performance.now() - this.t0; this.wk[this.i] = w;
    this.i = (this.i + 1) % this.N; this.n = Math.min(this.N, this.n + 1);
    if (++this._fr >= 30) {                                   // section averages over the last 30 frames
      for (const k in this.sec) { this.secAvg[k] = this.sec[k] / this._fr; this.sec[k] = 0; }
      this.callsAvg = this.calls; this._fr = 0;
    }
    if (this.on) this.callsSum = (this.callsSum || 0) + this.calls;
  },
  // statistics over the last n rendered frames
  stats(n = this.n) {
    n = Math.min(n, this.n); if (!n) return null;
    const iv = [], wk = [];
    for (let k = 1; k <= n; k++) { const j = (this.i - k + this.N) % this.N; if (this.iv[j] > 0) iv.push(this.iv[j]); wk.push(this.wk[j]); }
    return DS.Perf.summary(iv, wk);
  },
  summary(iv, wk) {
    const s = iv.slice().sort((a, b) => a - b), mean = a => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
    const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
    const m = mean(iv), p99 = pct(s, 0.99), worst = s[s.length - 1] || 0;
    // 1 % low: the frame rate over the slowest 1 % of frames
    const k = Math.max(1, Math.ceil(s.length * 0.01)), low = mean(s.slice(s.length - k));
    const ws = wk.slice().sort((a, b) => a - b);
    return { fps: m ? 1000 / m : 0, low1: low ? 1000 / low : 0, p99, worst, work: mean(wk), workP99: pct(ws, 0.99), n: iv.length,
      over: iv.filter(x => x > (this.mode === '120' ? 9.5 : 18)).length };
  },
  // Is the hardware doing the drawing? The WebGL renderer's name (the post-processing layer runs there), and a
  // 2D fill test: 120 full draws on a 1024² canvas (126 megapixels), timed to the end with one pixel read back.
  // A GPU-backed canvas does that in a few milliseconds, software takes a hundred or more.
  gpu(g) {
    if (this._gpu) return this._gpu;
    let name = '없음 (WebGL 불가)';
    try {
      let gl = g && g.post && g.post.ok ? g.post.gl : null;
      if (!gl) { const c = document.createElement('canvas'); gl = c.getContext('webgl2') || c.getContext('webgl'); }
      if (gl) { const e = gl.getExtension('WEBGL_debug_renderer_info'); name = String(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); }
    } catch (e) {}
    let ms = 0;
    try {
      const src = document.createElement('canvas'); src.width = src.height = 256; const sx = src.getContext('2d');
      const gr = sx.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#c8a070'); gr.addColorStop(1, '#3060a0'); sx.fillStyle = gr; sx.fillRect(0, 0, 256, 256);
      const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
      for (let i = 0; i < 4; i++) x.drawImage(src, 0, 0, 1024, 1024);
      const t = performance.now(); x.globalAlpha = 0.5;
      for (let i = 0; i < 120; i++) x.drawImage(src, (i & 3) - 2, 0, 1024, 1024);
      x.getImageData(512, 512, 1, 1); ms = performance.now() - t;
    } catch (e) { ms = -1; }
    const sw = /swiftshader|llvmpipe|software|basic render/i.test(name);
    return (this._gpu = { name: name.replace(/^ANGLE \(|\)$/g, ''), ms, accel: ms >= 0 && ms < 40 && !sw });
  },
  gpuLine(g) { const G = this.gpu(g); return `GPU ${G.name.slice(0, 40)} · 2D ${G.accel ? '가속' : '소프트웨어 추정'} (126MP ${G.ms.toFixed(1)}ms)`; },
  // draw-call counting (wraps the 2D context once; counts only while the overlay is open)
  hook() {
    if (this._hooked) return; this._hooked = true;
    const P = CanvasRenderingContext2D.prototype, me = this;
    for (const k of ['drawImage', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'clearRect']) {
      const f = P[k]; P[k] = function () { if (me.on) me.calls++; return f.apply(this, arguments); };
    }
  },
  toggle(on = !this.on) {
    this.on = on; if (on) { this.hook(); this._gpuTxt = null; }
    let el = document.getElementById('perf');
    if (!el) { el = document.createElement('canvas'); el.id = 'perf'; document.body.appendChild(el); }
    el.hidden = !on;
    try { localStorage.setItem('ds.perf', on ? '1' : '0'); } catch (e) {}
  },
  // ---- the overlay: graph of the last 300 frame intervals, numbers, stages ----
  draw(g) {
    if (!this.on) return;
    if ((this._dr = (this._dr || 0) + 1) % 4) return;           // 15 times a second is plenty
    const el = document.getElementById('perf'); if (!el) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = 300, H = 212;
    if (el.width !== W * dpr) { el.width = W * dpr; el.height = H * dpr; el.style.width = W + 'px'; el.style.height = H + 'px'; }
    const c = el.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H); c.fillStyle = 'rgba(12,14,16,0.78)'; c.fillRect(0, 0, W, H);
    // graph: 0–40 ms, lines at the 60 and 120 Hz budgets
    const gy = 80, gh = 56, ms = v => gy + gh - Math.min(1, v / 40) * gh;
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
    for (const [v, col] of [[16.67, 'rgba(120,220,120,0.6)'], [8.33, 'rgba(120,180,255,0.45)'], [33.3, 'rgba(255,120,100,0.45)']]) { c.strokeStyle = col; c.beginPath(); c.moveTo(4, ms(v)); c.lineTo(W - 4, ms(v)); c.stroke(); }
    const n = this.n, bw = (W - 8) / this.N;
    for (let k = 0; k < n; k++) {
      const j = (this.i - n + k + this.N) % this.N, v = this.iv[j], w = this.wk[j];
      const x = 4 + (this.N - n + k) * bw;
      c.fillStyle = v > 18 ? '#ff6a50' : v > 9.5 && this.mode === '120' ? '#ffc040' : '#6fd86f'; c.fillRect(x, ms(v), Math.max(1, bw - 0.2), gy + gh - ms(v));
      c.fillStyle = 'rgba(120,180,255,0.9)'; c.fillRect(x, ms(w) - 0.5, Math.max(1, bw - 0.2), 1.5);
    }
    const s = this.stats() || {}, cam = g.world.cam, cv = g.cv;
    c.fillStyle = '#e8e8e0'; c.font = '600 12px ui-monospace, Menlo, monospace'; c.textBaseline = 'top';
    c.fillText(`${(s.fps || 0).toFixed(1)} fps  1%저 ${(s.low1 || 0).toFixed(1)}  p99 ${(s.p99 || 0).toFixed(1)}ms`, 6, 5);
    c.font = '11px ui-monospace, Menlo, monospace'; c.fillStyle = '#b8c0c8';
    const hz = this.hz();
    c.fillText(`작업 ${(s.work || 0).toFixed(1)}ms (p99 ${(s.workP99 || 0).toFixed(1)}) · 화면 ${hz || '?'}Hz · 제한 ${this.mode === 'free' ? '자유' : this.mode}`, 6, 22);
    c.fillText(`${cv.width}×${cv.height} (×${(g.rs || 1).toFixed(2)}) · 효과 ${['끔', '낮음', '높음'][g.post && g.post.ok ? g.post.q : 0]} · 그리기 ${this.callsAvg}`, 6, 37);
    c.fillText(`파티클 ${g.world.particles.n} · 차량 ${g.world.vehicles.length} · 줌 ${cam.zoom.toFixed(0)}`, 6, 50);
    if (!this._gpuTxt) this._gpuTxt = this.gpuLine(g);
    c.fillStyle = this.gpu(g).accel ? '#8fe08f' : '#ff8a70'; c.fillText(this._gpuTxt, 6, 64); c.fillStyle = '#b8c0c8';
    const A = this.secAvg, keys = Object.keys(A);
    c.fillStyle = '#d8d0b8';
    keys.forEach((k, i) => c.fillText(`${k} ${A[k].toFixed(2)}`, 6 + (i % 3) * 98, gy + gh + 6 + Math.floor(i / 3) * 14));
  },
};
