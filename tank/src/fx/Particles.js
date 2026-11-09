// Particle pool (typed arrays). Kinds: GRAIN (sand grains, ballistic), DUST (soft puffs, drift with wind),
// SMOKE (gun smoke), DARK (black smoke), FIRE (additive), HEAT (exhaust shimmer), DEBRIS (dark chunks).
DS.P = { GRAIN: 0, DUST: 1, SMOKE: 2, DARK: 3, FIRE: 4, HEAT: 5, DEBRIS: 6 };
DS.Particles = class Particles {
  constructor(max) {
    this.max = max; this.n = 0;
    const F = () => new Float32Array(max);
    this.x = F(); this.y = F(); this.vx = F(); this.vy = F(); this.life = F(); this.ttl = F();
    this.size = F(); this.grow = F(); this.drag = F(); this.grav = F(); this.alpha = F(); this.rot = F();
    this.kind = new Uint8Array(max); this.col = new Uint32Array(max);
    this.sprites = {};
  }
  add(kind, x, y, vx, vy, ttl, size, o = {}) {
    let i = this.n;
    if (i >= this.max) { i = (Math.random() * this.max) | 0; } else this.n++;
    this.kind[i] = kind; this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = 0; this.ttl[i] = ttl; this.size[i] = size; this.grow[i] = o.grow || 0;
    this.drag[i] = o.drag != null ? o.drag : 0.5; this.grav[i] = o.grav != null ? o.grav : 1;
    this.alpha[i] = o.alpha != null ? o.alpha : 1; this.col[i] = o.col != null ? o.col : 0xd8b67c;
    this.rot[i] = Math.random() * 6.28;
  }
  update(dt, terrain, wind) {
    const g = DS.T.g;
    for (let i = 0; i < this.n; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.ttl[i]) { this.kill(i); i--; continue; }
      const k = this.kind[i], dr = this.drag[i];
      // drag toward wind velocity
      const f = Math.min(1, dr * dt);
      this.vx[i] += (wind - this.vx[i]) * f; this.vy[i] += (0 - this.vy[i]) * f;
      this.vy[i] -= g * this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      this.size[i] += this.grow[i] * dt;
      if (k === DS.P.GRAIN || k === DS.P.DEBRIS) {
        const h = terrain.height(this.x[i]);
        if (this.y[i] < h) {
          if (k === DS.P.DEBRIS && this.vy[i] < -2) { this.vy[i] *= -0.25; this.vx[i] *= 0.5; this.y[i] = h; }
          else { this.kill(i); i--; continue; }
        }
      } else if (k === DS.P.DUST || k === DS.P.SMOKE || k === DS.P.DARK) {
        const h = terrain.height(this.x[i]) + this.size[i] * 0.3;
        if (this.y[i] < h) { this.y[i] = h; this.vy[i] = Math.abs(this.vy[i]) * 0.3; }
      }
    }
  }
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    for (const a of ['x', 'y', 'vx', 'vy', 'life', 'ttl', 'size', 'grow', 'drag', 'grav', 'alpha', 'rot', 'kind', 'col']) this[a][i] = this[a][j];
  }

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

  // layer: 0 = behind vehicles, 1 = front
  draw(ctx, cam, layer, only) {
    const P = DS.P;
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.n; i++) {
        const k = this.kind[i];
        if (only != null && k !== only) continue;
        const add = k === P.FIRE;
        if (add !== (pass === 1)) continue;
        const front = k === P.GRAIN || k === P.DEBRIS || k === P.FIRE || (this.rot[i] > 3.14);
        if ((layer === 1) !== front) continue;
        const t = this.life[i] / this.ttl[i], sz = this.size[i];
        if (!cam.visible(this.x[i], this.y[i], sz)) continue;
        if (k === P.GRAIN || k === P.DEBRIS) {
          ctx.globalAlpha = this.alpha[i] * (1 - t * t);
          ctx.fillStyle = k === P.DEBRIS ? '#3b342b' : '#' + this.col[i].toString(16).padStart(6, '0');
          const m = Math.max(sz, 1.2 / cam.zoom);
          ctx.fillRect(this.x[i] - m / 2, this.y[i] - m / 2, m, m);
        } else {
          let a = this.alpha[i];
          if (k === P.FIRE) a *= (1 - t) * (1 - t);
          else if (k === P.HEAT) a *= Math.sin(Math.PI * t);
          else a *= Math.min(1, t * 8) * (1 - t);
          if (a < 0.004) continue;
          ctx.globalAlpha = a;
          ctx.drawImage(this.sprite(this.col[i]), this.x[i] - sz, this.y[i] - sz, sz * 2, sz * 2);
        }
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
};
