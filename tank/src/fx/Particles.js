// Particle pool (typed arrays). Kinds: GRAIN (sand grains, ballistic), DUST (soft puffs, drift with wind),
// SMOKE (gun smoke), DARK (black smoke), FIRE (additive), HEAT (exhaust shimmer), DEBRIS (dark chunks).
// FLAME: a ball of fire that cools into smoke of colour `col`. SPARK: a glowing streak of hot metal.
DS.P = { GRAIN: 0, DUST: 1, SMOKE: 2, DARK: 3, FIRE: 4, HEAT: 5, DEBRIS: 6, FLAME: 7, SPARK: 8 };
DS.Particles = class Particles {
  constructor(max) {
    this.max = max; this.n = 0;
    const F = () => new Float32Array(max);
    this.x = F(); this.y = F(); this.vx = F(); this.vy = F(); this.life = F(); this.ttl = F();
    this.size = F(); this.grow = F(); this.drag = F(); this.grav = F(); this.alpha = F(); this.rot = F();
    this.kind = new Uint8Array(max); this.col = new Uint32Array(max); this.mass = new Float32Array(max);   // sand volume carried (m²)
    this.sprites = {}; this.hexC = {};
  }
  add(kind, x, y, vx, vy, ttl, size, o = {}) {
    let i = this.n;
    if (i >= this.max) { i = (Math.random() * this.max) | 0; } else this.n++;
    // (a recycled slot loses its sand: negligible, and keeps the pool bounded)
    this.kind[i] = kind; this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = 0; this.ttl[i] = ttl; this.size[i] = size; this.grow[i] = o.grow || 0;
    this.drag[i] = o.drag != null ? o.drag : 0.5; this.grav[i] = o.grav != null ? o.grav : 1;
    this.alpha[i] = o.alpha != null ? o.alpha : 1; this.col[i] = o.col != null ? o.col : 0xd8b67c;
    this.rot[i] = Math.random() * 6.28; this.mass[i] = o.mass || 0;
    if (o.age) this.life[i] = o.age * ttl;          // born part-way into its life: no fade-in (a jet's trail is dense at once)
  }
  update(dt, terrain, wind) {
    const g = DS.T.g;
    for (let i = 0; i < this.n; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.ttl[i]) { if (this.mass[i]) terrain.deposit(this.x[i], this.mass[i]); this.kill(i); i--; continue; }
      const k = this.kind[i], dr = this.drag[i];
      // drag toward wind velocity
      const f = Math.min(1, dr * dt);
      // wind picks up with height: smoke columns lean over as they rise
      const wk = (k === DS.P.DARK || k === DS.P.SMOKE || k === DS.P.FLAME) ? 1 + Math.max(0, this.y[i] - terrain.height(this.x[i])) / 12 : 1;
      this.vx[i] += (wind * wk - this.vx[i]) * f; this.vy[i] += (0 - this.vy[i]) * f;
      this.vy[i] -= g * this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      if (this.size[i] < 13) this.size[i] += this.grow[i] * dt;     // puffs stop spreading at 13 m: beyond that they only cost fill rate
      if (k === DS.P.GRAIN || k === DS.P.DEBRIS || k === DS.P.SPARK) {
        const h = terrain.height(this.x[i]);
        if (this.y[i] < h) {
          if (k === DS.P.DEBRIS && this.vy[i] < -2) { if (this.onLand) this.onLand(this.x[i], h, this.size[i], this.vx[i], this.vy[i]); this.vy[i] *= -0.25; this.vx[i] *= 0.5; this.y[i] = h; }
          else { if (this.mass[i]) terrain.deposit(this.x[i], this.mass[i]); this.kill(i); i--; continue; }
        }
      } else if (k === DS.P.DUST || k === DS.P.SMOKE || k === DS.P.DARK || k === DS.P.FLAME) {
        const h = terrain.height(this.x[i]) + this.size[i] * 0.3;
        if (this.y[i] < h) { this.y[i] = h; this.vy[i] = Math.abs(this.vy[i]) * 0.3; }
      }
    }
  }
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    for (const a of ['x', 'y', 'vx', 'vy', 'life', 'ttl', 'size', 'grow', 'drag', 'grav', 'alpha', 'rot', 'kind', 'col', 'mass']) this[a][i] = this[a][j];
  }

  // plain soft disc (thermal picture, heat shimmer)
  sprite(col) {
    let s = this.sprites[col];
    if (s) return s;
    s = document.createElement('canvas'); s.width = s.height = 64;
    const c = s.getContext('2d'), r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255;
    const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.45, `rgba(${r},${g},${b},0.55)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    return (this.sprites[col] = s);
  }
  // lumpy cloud shapes (four of them): overlapping soft balls. Smoke and dust are these, tinted and shaded —
  // lit from above, darker underneath — so a cloud of them reads as billowing volume, not as blurred dots.
  mask(v, ragged) {
    const key = (ragged ? 'r' : 'm') + v; let m = this.sprites[key]; if (m) return m;
    const S = 96, r = DS.rng(31 + v * 7 + (ragged ? 100 : 0)); m = document.createElement('canvas'); m.width = m.height = S;
    const c = m.getContext('2d'), n = ragged ? 22 : 13;
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, d = r() * S * (ragged ? 0.3 : 0.24), rad = S * (ragged ? 0.07 + r() * 0.13 : 0.15 + r() * 0.13);
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.55, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    return (this.sprites[key] = m);
  }
  puff(col, v) {
    const key = 'p' + col + '/' + v; let s = this.sprites[key]; if (s) return s;
    const S = 96; s = document.createElement('canvas'); s.width = s.height = S;
    const c = s.getContext('2d');
    c.drawImage(this.mask(v), 0, 0); c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#' + col.toString(16).padStart(6, '0'); c.fillRect(0, 0, S, S);
    c.globalCompositeOperation = 'source-atop';
    const g = c.createLinearGradient(S * 0.3, S * 0.15, S * 0.6, S * 0.9);
    g.addColorStop(0, 'rgba(255,250,235,0.26)'); g.addColorStop(0.5, 'rgba(255,250,235,0)'); g.addColorStop(1, 'rgba(20,14,8,0.34)');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    return (this.sprites[key] = s);
  }
  // fire: ragged shape, white-hot core through the given colour to deep red at the edge
  flame(col, v) {
    const key = 'f' + col + '/' + v; let s = this.sprites[key]; if (s) return s;
    const S = 96; s = document.createElement('canvas'); s.width = s.height = S;
    const c = s.getContext('2d'), r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255;
    c.drawImage(this.mask(v, true), 0, 0); c.globalCompositeOperation = 'source-in';
    const gr = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgb(255,252,225)'); gr.addColorStop(0.22, `rgb(${Math.min(255, r + 30)},${Math.min(255, g + 50)},${Math.min(255, b + 40)})`);
    gr.addColorStop(0.55, `rgb(${r},${g},${b})`); gr.addColorStop(1, `rgb(${Math.round(r * 0.7)},${Math.round(g * 0.3)},${Math.round(b * 0.15)})`);
    c.fillStyle = gr; c.fillRect(0, 0, S, S);
    return (this.sprites[key] = s);
  }
  hex(col) { return this.hexC[col] || (this.hexC[col] = '#' + col.toString(16).padStart(6, '0')); }

  // layer: 0 = behind vehicles, 1 = front
  // only: one kind; glowOnly: just the light-emitting part (a FLAME's fire, not the smoke it turns into)
  draw(ctx, cam, layer, only, glowOnly) {
    const P = DS.P, pz = 1.2 / cam.zoom;
    if (!this.bk) this.bk = new Map();
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) {
        for (const b of this.bk.values()) {
          if (!b.xy.length) continue;
          ctx.globalAlpha = b.a; ctx.fillStyle = this.hex(b.col); ctx.beginPath();
          const q = b.xy; for (let j = 0; j < q.length; j += 3) ctx.rect(q[j], q[j + 1], q[j + 2], q[j + 2]);
          ctx.fill(); q.length = 0;
        }
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      }
      for (let i = 0; i < this.n; i++) {
        const k = this.kind[i];
        if (only != null && k !== only) continue;
        const add = k === P.FIRE || k === P.SPARK;
        if (k !== P.FLAME && add !== (pass === 1)) continue;
        if (glowOnly && pass === 0) continue;
        const front = k === P.GRAIN || k === P.DEBRIS || add || k === P.FLAME || (this.rot[i] > 3.14);
        if ((layer === 1) !== front) continue;
        const t = this.life[i] / this.ttl[i], sz = this.size[i], x = this.x[i], y = this.y[i];
        if (!cam.visible(x, y, sz + 2)) continue;
        if (k === P.GRAIN || k === P.DEBRIS) {
          // specks: gathered by colour and (stepped) opacity, each group filled as one path after this pass
          const al = this.alpha[i] * (1 - t * t), ab = Math.round(al * 12); if (ab <= 0) continue;
          const key = (k === P.DEBRIS ? 0x3b342b : this.col[i]) * 16 + ab, m = Math.max(sz, pz);
          let b = this.bk.get(key); if (!b) { b = { col: k === P.DEBRIS ? 0x3b342b : this.col[i], a: ab / 12, xy: [] }; this.bk.set(key, b); }
          b.xy.push(x - m / 2, y - m / 2, m);
        } else if (k === P.SPARK) {
          const a = this.alpha[i] * (1 - t * t * t); if (a < 0.02) continue;
          ctx.globalAlpha = a; ctx.strokeStyle = this.hex(this.col[i]); ctx.lineWidth = Math.max(sz, pz * 1.1);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - this.vx[i] * 0.028, y - this.vy[i] * 0.028); ctx.stroke();
        } else if (k === P.FLAME) {
          const v = ((this.rot[i] * 7) | 0) & 3;
          if (pass === 0) {                      // the smoke it turns into
            const a = this.alpha[i] * Math.min(1, Math.max(0, (t - 0.1) * 4)) * (1 - t) * 1.25; if (a < 0.01) continue;
            ctx.globalAlpha = a; ctx.drawImage(this.puff(this.col[i], v), x - sz, y - sz, sz * 2, sz * 2);
          } else {                               // the fire, gone by a third of its life
            const f = 1 - t / 0.34; if (f <= 0) continue;
            ctx.globalAlpha = Math.min(1, f * 1.3) * 0.55; const fs = sz * (0.75 + 0.25 * f);
            ctx.drawImage(this.flame(0xff8c2e, v), x - fs, y - fs, fs * 2, fs * 2);
          }
        } else {
          let a = this.alpha[i];
          if (k === P.FIRE) a *= (1 - t) * (1 - t);
          else if (k === P.HEAT) a *= Math.sin(Math.PI * t);
          else a *= Math.min(1, t * 8) * (1 - t);
          if (a < 0.004) continue;
          ctx.globalAlpha = a;
          const v = ((this.rot[i] * 7) | 0) & 3;
          const im = k === P.HEAT ? this.sprite(this.col[i]) : k === P.FIRE ? this.flame(this.col[i], v) : this.puff(this.col[i], v);
          ctx.drawImage(im, x - sz, y - sz, sz * 2, sz * 2);
        }
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
};
