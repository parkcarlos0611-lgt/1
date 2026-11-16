// O2 — building fragments simulated off the main thread.
// The fragments a collapsing building throws (thousands of them) tumble, land, bounce, come to rest and stack on
// one another; stepping them was the largest part of the simulation in a collapse. debrisSim() is that physics on
// typed arrays, with no access to the game: it runs inside a Web Worker made from its own source, or — where a
// worker cannot be made (or does not answer) — on the main thread, the same code.
// Each frame the main thread sends what changed (new fragments, removed ones, the ground's heights under them)
// and the time to step; the worker answers with every fragment's position and what happened (a shard landing
// hard enough to break, a heavy piece kicking up dust). Breaking a shard (new images) and dust (particles) stay
// on the main thread. While the worker is busy the time is saved up and sent with the next message, so messages
// never queue; positions shown are at most a frame old.
function debrisSim() {
  let N = 0, cap = 0;
  const S = {}, slot = new Map();
  const F = ['x', 'y', 'vx', 'vy', 'a', 'w', 'wd', 'h', 'chk'], U = ['rest', 'shard', 'big'];
  const grow = n => {
    if (n <= cap) return; const c = Math.max(n, cap * 2, 256);
    for (const k of F) { const a = new Float32Array(c); if (S[k]) a.set(S[k]); S[k] = a; }
    for (const k of U) { const a = new Uint8Array(c); if (S[k]) a.set(S[k]); S[k] = a; }
    const id = new Int32Array(c); if (S.id) id.set(S.id); S.id = id; cap = c;
  };
  grow(256);
  // ground: heights h[i] at x = (i0 + i) · dx
  let G = { i0: 0, dx: 1, h: new Float32Array(1) };
  const height = x => { const t = x / G.dx - G.i0; let i = Math.floor(t); if (i < 0) return G.h[0]; if (i >= G.h.length - 1) return G.h[G.h.length - 1]; return G.h[i] + (G.h[i + 1] - G.h[i]) * (t - i); };
  function add(p) {                       // [id, x, y, vx, vy, a, w, wd, h, shard, big]
    grow(N + 1); const i = N++;
    S.id[i] = p[0]; S.x[i] = p[1]; S.y[i] = p[2]; S.vx[i] = p[3]; S.vy[i] = p[4]; S.a[i] = p[5]; S.w[i] = p[6]; S.wd[i] = p[7]; S.h[i] = p[8];
    S.shard[i] = p[9]; S.big[i] = p[10]; S.rest[i] = 0; S.chk[i] = 0; slot.set(p[0], i);
  }
  function remove(id) {
    const i = slot.get(id); if (i == null) return; slot.delete(id);
    const j = --N; if (i !== j) { for (const k of F) S[k][i] = S[k][j]; for (const k of U) S[k][i] = S[k][j]; S.id[i] = S.id[j]; slot.set(S.id[i], i); }
  }
  // one step (the main thread's former City.step fragment loop): ev gets [kind, id, a, b] — 1: a shard landed
  // hard (a = vy, b = ground), 2: dust where a heavy piece bounced (a = x, b = ground)
  function step(dt, g, ev) {
    // resting fragments in 1 m columns, for what a falling one may land on
    const cols = new Map(); let maxW = 0;
    for (let i = 0; i < N; i++) if (S.rest[i]) { const k = Math.floor(S.x[i]); let a = cols.get(k); if (!a) cols.set(k, a = []); a.push(i); if (S.wd[i] > maxW) maxW = S.wd[i]; }
    const supp = i => {
      let gy = height(S.x[i]) + S.h[i] * 0.35;
      const reach = (maxW + S.wd[i]) * 0.38, k0 = Math.floor(S.x[i] - reach), k1 = Math.floor(S.x[i] + reach);
      for (let k = k0; k <= k1; k++) { const a = cols.get(k); if (!a) continue;
        for (const j of a) { if (j === i || !S.rest[j] || Math.abs(S.x[j] - S.x[i]) > (S.wd[j] + S.wd[i]) * 0.38) continue;
          const top = S.y[j] + S.h[j] * 0.42 + S.h[i] * 0.4; if (top > gy && top < S.y[i] + 0.3) gy = top; } }
      return gy;
    };
    for (let i = 0; i < N; i++) {
      if (S.rest[i]) {                                  // what it was lying on may have gone: then it falls again
        S.chk[i] = (S.chk[i] || Math.random() * 0.25) - dt;
        if (S.chk[i] <= 0) { S.chk[i] = 0.25; if (S.y[i] > supp(i) + 0.12) { S.rest[i] = 0; S.vy[i] = 0; } }
        continue;
      }
      S.vy[i] -= g * dt; S.x[i] += S.vx[i] * dt; S.y[i] += S.vy[i] * dt; S.a[i] += S.w[i] * dt;
      const gy = supp(i);
      if (S.y[i] < gy) {
        S.y[i] = gy;
        if (S.shard[i] && S.vy[i] < -6 && S.wd[i] > 0.35) ev.push(1, S.id[i], S.vy[i], gy);    // the main thread may break it
        if (S.vy[i] < -2.5) { if (S.big[i] && Math.random() < 0.5) ev.push(2, S.id[i], S.x[i], gy); S.vy[i] *= -0.25; S.vx[i] *= 0.55; S.w[i] *= 0.5; }
        else { S.rest[i] = 1; S.vx[i] = S.vy[i] = 0; S.a[i] = Math.round(S.a[i] / Math.PI) * Math.PI + (Math.random() - 0.5) * 0.5; }
      }
    }
  }
  // a message: { dt, g, i0, dx, h, adds (11 floats each), rem (ids) } → { st: [id, x, y, a, rest] per fragment, ev }
  function run(m) {
    if (m.rem) for (const id of m.rem) remove(id);
    if (m.adds) for (let k = 0; k + 10 < m.adds.length; k += 11) add(m.adds.subarray(k, k + 11));
    if (m.h) G = { i0: m.i0, dx: m.dx, h: m.h };
    const ev = []; let left = m.dt;
    while (left > 1e-4) { const d = Math.min(left, 1 / 30); step(d, m.g, ev); left -= d; }
    const st = new Float32Array(N * 5);
    for (let i = 0, o = 0; i < N; i++, o += 5) { st[o] = S.id[i]; st[o + 1] = S.x[i]; st[o + 2] = S.y[i]; st[o + 3] = S.a[i]; st[o + 4] = S.rest[i]; }
    return { st, ev: new Float32Array(ev) };
  }
  return { run, count: () => N };
}

DS.Debris = class Debris {
  constructor(world) {
    this.w = world; this.byId = new Map(); this.nextId = 1; this.adds = []; this.rem = []; this.acc = 0; this.busy = false; this.reply = null;
    this.mode = 'main';
    if (DS.T.debrisWorker !== false && typeof Worker !== 'undefined') {
      try {
        const src = `${debrisSim.toString()}\nconst sim = debrisSim();\nonmessage = e => { const r = sim.run(e.data); postMessage(r, [r.st.buffer, r.ev.buffer]); };`;
        this.url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        this.wk = new Worker(this.url);
        this.wk.onmessage = e => { this.reply = e.data; this.busy = false; if (this.mode !== 'worker') this.mode = 'worker'; };
        this.wk.onerror = () => this.fallback();
        this.mode = 'starting';
      } catch (e) { this.wk = null; }
    }
    this.sim = null;                                     // (main-thread copy when there is no worker)
  }
  fallback() { if (this.wk) { try { this.wk.terminate(); } catch (e) {} } this.wk = null; this.mode = 'main'; this.busy = false; this.resend = true; }
  // a new fragment of building b (City pushes it into b.pieces and calls this)
  add(b, p) {
    p.wid = this.nextId++; p.owner = b; this.byId.set(p.wid, p);
    this.adds.push(p.wid, p.x, p.y, p.vx, p.vy, p.a, p.w, p.wd, p.h, p.src === 'shard' ? 1 : 0, p.big ? 1 : 0);
  }
  // once a frame, after the buildings have stepped
  frame(dt) {
    const W = this.w;
    if (this.reply) { this.apply(this.reply); this.reply = null; }
    // what the main thread removed: broken shards, and over the cap the smallest resting pieces of a building
    for (const b of W.buildings) {
      if (!b.pieces || !b.pieces.length) continue;
      let gone = false; for (const p of b.pieces) if (p.gone) { gone = true; break; }
      if (gone) b.pieces = b.pieces.filter(p => { if (p.gone) { this.drop(p); return false; } return true; });
      if (b.pieces.length > 1200) { const rest = b.pieces.filter(p => p.rest); rest.sort((a, c) => c.wd - a.wd); const keep = new Set(rest.slice(0, 900)); b.pieces = b.pieces.filter(p => { if (!p.rest || keep.has(p)) return true; this.drop(p); return false; }); }
    }
    // every two seconds: fragments of buildings no longer in the world (deleted in the editor) are let go
    if ((this.recT = (this.recT || 0) + dt) > 2) {
      this.recT = 0; const live = new Set(); for (const b of W.buildings) if (b.pieces) for (const p of b.pieces) live.add(p);
      for (const p of this.byId.values()) if (!live.has(p)) this.drop(p);
    }
    this.acc += dt;
    if (!this.byId.size && !this.adds.length) { this.acc = 0; return; }
    // no answer for a long while: the worker is not working here; carry on on the main thread
    if (this.wk && this.busy && ++this.waitN > 90 && performance.now() - this.sentAt > 3000) this.fallback();      // (frames and time: a slow frame is not a dead worker)
    if (this.wk && this.busy) return;
    const m = this.message();
    if (this.wk) { this.busy = true; this.sentAt = performance.now(); this.waitN = 0; this.wk.postMessage(m, [m.adds.buffer, m.rem.buffer, m.h.buffer]); }
    else { if (!this.sim) { this.sim = debrisSim(); this.resend = true; } if (this.resend) this.resendAll(m); this.apply(this.sim.run(m)); }
  }
  drop(p) { if (p.wid && this.byId.delete(p.wid)) this.rem.push(p.wid); }
  message() {
    const T = this.w.terrain; let lo = 1e9, hi = -1e9;
    for (const p of this.byId.values()) { if (p.x < lo) lo = p.x; if (p.x > hi) hi = p.x; }
    lo -= 8; hi += 8;
    const i0 = Math.max(0, Math.floor(lo / T.dx)), i1 = Math.min(T.n - 1, Math.ceil(hi / T.dx) + 1);
    const m = { dt: this.acc, g: DS.T.g, i0, dx: T.dx, h: T.h.slice(i0, Math.max(i0 + 2, i1 + 1)), adds: new Float32Array(this.adds), rem: new Int32Array(this.rem) };
    this.adds.length = 0; this.rem.length = 0; this.acc = 0;
    return m;
  }
  // after a fall-back: every fragment the main thread still has goes to the new simulation
  resendAll(m) {
    this.resend = false; const a = [];
    for (const p of this.byId.values()) a.push(p.wid, p.x, p.y, p.vx || 0, p.vy || 0, p.a, p.w || 0, p.wd, p.h, p.src === 'shard' ? 1 : 0, p.big ? 1 : 0);
    this.sim = debrisSim(); m.adds = new Float32Array(a); m.rem = new Int32Array(0);
  }
  apply(r) {
    const st = r.st, W = this.w;
    for (let o = 0; o < st.length; o += 5) { const p = this.byId.get(st[o]); if (!p) continue; p.x = st[o + 1]; p.y = st[o + 2]; p.a = st[o + 3]; p.rest = st[o + 4]; }
    const ev = r.ev, t0 = performance.now(); let nb = 0;
    for (let k = 0; k < ev.length; k += 4) {
      const p = this.byId.get(ev[k + 1]); if (!p || p.gone) continue;
      // breaking a shard cuts new images: at most four a frame and a millisecond's work (the rest just bounce)
      if (ev[k] === 1) { const b = p.owner; if (b && nb < 4 && performance.now() - t0 < 1 && b.budget()) { nb++; p.vy = ev[k + 2]; b.breakShard(W, p, ev[k + 3]); } }
      else if (ev[k] === 2) W.particles.add(DS.P.DUST, ev[k + 2], ev[k + 3], (Math.random() - 0.5) * 3, Math.random() * 2, 3 + Math.random() * 3, 0.8 + (p.w0 || 0), { grow: 1, drag: 1, grav: 0, alpha: 0.32, col: 0xc9b79a });
    }
  }
};
