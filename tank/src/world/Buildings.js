// Buildings for demolition tests (firing range). They stand just behind the drive line: vehicles pass in
// front of them, but shells, missiles, bullets, sight lines and blast meet them. A high-explosive burst within
// its radius brings the building down: every window pane goes at once, the hit corner is blown out, then the
// block sinks into its own footprint, leaning toward the damaged side, shedding slabs and pouring dust out
// along the ground and up over itself; a rubble heap is left.
// about 30 m high (9–10 storeys at this scale); width follows from the drawing's proportions
DS.BUILDINGS = {
  b1: { name: '아파트 A', h: 30, ar: 890 / 596 },
  b2: { name: '아파트 B', h: 31, ar: 892 / 602 },
  b3: { name: '업무용 빌딩', h: 30, ar: 886 / 574 },
  b4: { name: '곡면 아파트', h: 29, ar: 868 / 580 },
};
// It takes several shells: each burst inside the blast radius breaches the wall and drops part of the
// structure (HITS[n] = share of the height lost after n hits); the last one brings the rest down. Each stage
// settles slowly — the floors give way one after another rather than in free fall.
DS.BUILDING_HITS = [0, 0.1, 0.36, 1];
DS.Building = class Building {
  constructor(k, x, world) {
    const B = DS.BUILDINGS[k];
    this.k = k; this.x = x; this.h = B.h; this.w = B.h / B.ar; this.name = B.name;
    this.base = world.terrain.height(x) - 0.15;
    this.reset();
  }
  reset() { this.state = 'ok'; this.hits = 0; this.goal = 0; this.glass = false; this.sink = 0; this.vs = 0; this.tilt = 0; this.side = 1; this.t = 0; this.holes = []; this.slabs = []; this.acc = 0; this.rub = 0; this.texKey = null; }
  get top() { return this.base + this.h - this.sink; }
  // first building met by the segment a→b (entry point), or null
  static ray(world, x0, y0, x1, y1) {
    let best = null;
    for (const b of world.buildings) {
      if (b.state === 'rubble') continue;
      const xa = b.x - b.w / 2, xb = b.x + b.w / 2, ya = b.base, yb = b.top;
      if (Math.max(x0, x1) < xa || Math.min(x0, x1) > xb || Math.max(y0, y1) < ya || Math.min(y0, y1) > yb) continue;
      // Liang–Barsky clip of the segment against the block
      const dx = x1 - x0, dy = y1 - y0; let t0 = 0, t1 = 1, ok = true;
      for (const [p, q] of [[-dx, x0 - xa], [dx, xb - x0], [-dy, y0 - ya], [dy, yb - y0]]) {
        if (p === 0) { if (q < 0) { ok = false; break; } }
        else { const r = q / p; if (p < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; } else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; } }
      }
      if (ok && (!best || t0 < best.t)) best = { b, t: t0, x: x0 + dx * t0, y: y0 + dy * t0 };
    }
    return best;
  }
  dist(x, y) { return Math.hypot(Math.max(0, Math.abs(x - this.x) - this.w / 2), Math.max(0, this.base - y, y - this.top)); }
  // blast of radius r at (x, y): inside it the building comes down; out to a few radii only the glass goes
  blast(W, x, y, r) {
    if (this.state === 'rubble') return;
    const d = this.dist(x, y);
    if (d <= r * 4.5 && !this.glass) this.shatter(W);
    if (d <= r) this.collapse(W, x, y);
  }
  shatter(W) {
    this.glass = true;
    const P = W.particles, r = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 170; i++)                                   // shards burst out of every floor and rain down
      P.add(DS.P.DEBRIS, this.x + r(-0.5, 0.5) * this.w, this.base + r(0.06, 0.97) * (this.h - this.sink), r(-5, 5), r(-1, 4), r(2.5, 6), r(0.04, 0.11), { drag: 0.9, col: Math.random() < 0.6 ? 0xcfe2ec : 0x9db8c6 });
    for (let i = 0; i < 12; i++)
      P.add(DS.P.DUST, this.x + r(-0.5, 0.5) * this.w, this.base + r(0.1, 0.9) * this.h, r(-2, 2), r(-0.5, 1), r(2, 4), r(0.8, 1.6), { grow: 0.8, drag: 1.2, grav: 0, alpha: 0.18, col: 0xd9d2c4 });
    DS.Audio.glass(this.x, this.base + this.h / 2);
  }
  collapse(W, hx, hy) {
    const H = DS.BUILDING_HITS; if (this.hits >= H.length - 1) return;
    this.hits++; this.goal = H[this.hits] * this.h * 0.93;
    if (this.state !== 'falling') { this.t = 0; this.vs = 0; }
    this.state = 'falling'; if (this.hits === 1) this.side = Math.sign(hx - this.x) || 1;
    // scorch mark where it was hit (in the building's own frame, so it rides down with the wall)
    this.holes.push({ x: Math.max(-this.w / 2, Math.min(this.w / 2, hx - this.x)), y: Math.max(1, Math.min(this.h - 1, hy - this.base + this.sink)), r: 3.2 + Math.random() * 1.2 });
    DS.Audio.collapse(this.x, this.base, 2 + (this.goal - this.sink) / 2.2);
    for (let i = 0; i < 7; i++) this.slab(W, hx + (Math.random() - 0.5) * 5, hy + (Math.random() - 0.5) * 5, (Math.random() < 0.75 ? 1 : -1) * this.side * (3 + Math.random() * 13), 2 + Math.random() * 10);
  }
  slab(W, x, y, vx, vy) {
    if (this.slabs.length > 46) return;
    const sw = 1.6 + Math.random() * 3.4, sh = 1.2 + Math.random() * 2.4;
    this.slabs.push({ x, y, vx, vy, a: 0, w: (Math.random() - 0.5) * 5, sw, sh, u: Math.random() * (1 - sw / this.w), v: Math.random() * (1 - sh / this.h), rest: 0 });
  }
  step(dt, W) {
    const P = W.particles, r = (a, b) => a + Math.random() * (b - a), T = W.terrain;
    for (const s of this.slabs) {
      if (s.rest) { s.rest += dt; continue; }
      s.vy -= DS.T.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.w * dt;
      const g = T.height(s.x) + s.sh * 0.3;
      if (s.y < g) { s.y = g; s.rest = 0.001; s.a = Math.round(s.a / (Math.PI / 2)) * (Math.PI / 2) + r(-0.25, 0.25);
        for (let i = 0; i < 2; i++) P.add(DS.P.DUST, s.x, g, r(-3, 3), r(0.5, 3), r(3, 6), r(1, 2), { grow: 1.2, drag: 1, grav: 0, alpha: 0.3, col: 0xc9b79a }); }
    }
    if (this.state !== 'falling') return;
    this.t += dt;
    const near = Math.abs(this.x - W.cam.x) < 600;
    if (this.t > 0.6) {                                             // the structure lets go after the first shock
      // slow, uneven settling: floors fail one by one (speed pulses), never faster than a few metres a second
      const vmax = (this.hits >= DS.BUILDING_HITS.length - 1 ? 3.6 : 2.2) * (0.55 + 0.45 * Math.abs(Math.sin(this.t * 2.3 + this.x)));
      this.vs = Math.min(vmax, this.vs + 1.6 * dt); this.sink = Math.min(this.goal, this.sink + this.vs * dt);
      this.tilt = Math.min(0.14, 0.012 * this.hits + 0.2 * this.sink / this.h);
    }
    const left = this.h - this.sink, rate = 3 + this.vs * 4.5;
    this.acc += dt * rate * (near ? 1 : 0.3);
    while (this.acc >= 1) {
      this.acc -= 1;
      const s = Math.random() < 0.5 ? 1 : -1, sp = 5 + this.vs * 0.9;
      // dust squeezed out along the ground on both sides, and boiling up the face of the falling block
      P.add(DS.P.DUST, this.x + s * r(0.2, 0.6) * this.w, this.base + r(0.5, 4), s * r(0.6, 2.0) * sp, r(0.3, 4.5), r(7, 12), r(3.5, 7), { grow: r(1.2, 2.2), drag: 0.85, grav: 0, alpha: 0.48, col: Math.random() < 0.7 ? 0xcbb99c : 0xb8a888 });
      if (Math.random() < 0.6) P.add(DS.P.DUST, this.x + r(-0.55, 0.55) * this.w, this.base + r(0, Math.min(left, 14)), r(-5, 5), r(2, 8 + this.vs * 0.6), r(6, 11), r(3.2, 6), { grow: r(1.1, 2), drag: 0.8, grav: 0, alpha: 0.44, col: 0xd2c2a6 });
      if (Math.random() < 0.3) P.add(DS.P.DEBRIS, this.x + r(-0.5, 0.5) * this.w, this.base + r(0, Math.min(left, 10)), r(-14, 14), r(2, 14), r(1.5, 3.5), r(0.08, 0.24), { drag: 0.3, col: 0x8f8472 });
      if (Math.random() < 0.09 && left > 6) this.slab(W, this.x + s * this.w * 0.5, this.base + r(1, Math.min(left, 16)), s * r(3, 13), r(1, 9));
    }
    if (near) W.fx.shake = Math.max(W.fx.shake, 0.5 * Math.min(1, this.vs / 12) * Math.max(0, 1 - Math.abs(this.x - W.cam.x) / 400));
    if (this.sink >= this.goal - 0.01 && left >= this.h * 0.08) { this.state = 'damaged'; this.vs = 0; return; }     // this stage has settled
    if (left < this.h * 0.08) {                                     // down: a last surge of dust, and the heap
      this.state = 'rubble'; this.rub = 0.001;
      for (let i = 0; i < (near ? 30 : 8); i++) { const s = Math.random() < 0.5 ? 1 : -1;
        P.add(DS.P.DUST, this.x + r(-0.6, 0.6) * this.w, this.base + r(0.5, 7), s * r(5, 36), r(0.5, 12), r(8, 14), r(4, 8), { grow: r(1.3, 2.4), drag: 0.85, grav: 0, alpha: 0.5, col: 0xcbb99c }); }
      DS.Audio.thud(this.x, this.base, 1.6);
    }
  }
};

// ---- drawing (called from the frame before the vehicles) ----
Object.assign(DS.Renderer.prototype, {
  loadBuildings() {
    this.bldImg = {};
    const names = []; for (const k in DS.BUILDINGS) names.push(k, k + '_broken');
    return Promise.all(names.map(n => new Promise((res, rej) => { const im = new Image(); im.onload = () => { this.bldImg[n] = im; this.propImg[n] = im; res(); }; im.onerror = () => rej(new Error('sprite buildings/' + n)); im.src = 'assets/sprites/buildings/' + n + '.png'; })));
  },
  // the building's drawing with soot burnt on where shells struck — painted 'source-atop', so it stays inside
  // the building's own outline; rebuilt only when a new hit arrives
  scorched(b) {
    const key = b.holes.length + (b.glass ? 'g' : '');
    if (b.tex && b.texKey === key) return b.tex;
    const im = this.bldImg[b.k + (b.glass ? '_broken' : '')], c = b.tex || (b.tex = document.createElement('canvas')), k = im.width / b.w;
    c.width = im.width; c.height = im.height; b.texKey = key;
    const x = c.getContext('2d'), H = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop';
    for (const h of b.holes) {
      // centre pulled a little into the wall from the face that was hit
      const R = h.r * 2.1 * k, cx = (h.x + b.w / 2) * k + (h.x < 0 ? 1 : -1) * R * 0.35, cy = (b.h - h.y) * k;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, 'rgba(18,14,10,0.9)'); g.addColorStop(0.3, 'rgba(26,20,14,0.72)'); g.addColorStop(0.65, 'rgba(38,29,20,0.34)'); g.addColorStop(1, 'rgba(40,30,20,0)');
      x.fillStyle = g; x.fillRect(cx - R, cy - R, R * 2, R * 2);
      // soot drawn upward by the heat, and blotches for an uneven edge
      const up = x.createLinearGradient(0, cy, 0, cy - R * 2.4); up.addColorStop(0, 'rgba(22,16,11,0.5)'); up.addColorStop(1, 'rgba(22,16,11,0)');
      x.fillStyle = up; x.beginPath(); x.moveTo(cx - R * 0.6, cy); x.quadraticCurveTo(cx - R * 0.55, cy - R * 1.4, cx + (H(h.x) - 0.5) * R, cy - R * 2.4); x.quadraticCurveTo(cx + R * 0.55, cy - R * 1.4, cx + R * 0.6, cy); x.closePath(); x.fill();
      for (let i = 0; i < 9; i++) { const a = H(i * 2.7 + h.x) * 6.283, d = R * (0.4 + 0.5 * H(i * 5.3 + h.y)), rr = R * (0.14 + 0.2 * H(i + h.x * 3)), px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
        const bg = x.createRadialGradient(px, py, 0, px, py, rr); bg.addColorStop(0, 'rgba(16,12,8,0.45)'); bg.addColorStop(1, 'rgba(16,12,8,0)'); x.fillStyle = bg; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
    }
    return c;
  },
  buildings(ctx, cam, grey) {
    const w = this.w, L = w.buildings; if (!L || !L.length || !this.bldImg) return;
    const env = w.env || {}, sun = env.night ? null : env.sun, storm = env.visibility ? 1 : 0, H = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    ctx.imageSmoothingQuality = 'high';
    for (const b of L) {
      if (b.x + b.w * 0.9 + 30 < cam.left || b.x - b.w * 0.9 - 30 > cam.right) continue;
      const key = b.k + (b.glass ? '_broken' : ''), im = grey != null ? this.propTinted(key, 't', grey(0.2), 1) : storm ? this.propTinted(key, 's', '205,176,134', 0.22) : this.bldImg[key];
      const left = b.h - b.sink;
      if (b.state !== 'rubble') {
        if (sun && grey == null) {                                  // shadow of what still stands
          const run = -sun.side * Math.min(3.2, 1 / Math.tan(sun.el * Math.PI / 180)) * left * 0.55, e = b.w * 0.48;
          ctx.fillStyle = storm ? 'rgba(52,36,18,0.12)' : 'rgba(52,36,18,0.26)';
          ctx.beginPath(); ctx.moveTo(b.x - e, b.base + 0.2); ctx.lineTo(b.x + e, b.base + 0.2); ctx.lineTo(b.x + e + run, b.base - 2.6); ctx.lineTo(b.x - e + run, b.base - 2.6); ctx.closePath(); ctx.fill();
        }
        ctx.save(); ctx.translate(b.x + b.side * b.w * 0.5 * (b.tilt > 0 ? 0.6 : 0), b.base - b.sink); ctx.rotate(-b.side * b.tilt);
        const ox = -b.side * b.w * 0.5 * (b.tilt > 0 ? 0.6 : 0);
        const tex = b.holes.length && grey == null && !storm ? this.scorched(b) : im;
        ctx.save(); ctx.translate(ox, 0); ctx.scale(1, -1); ctx.drawImage(tex, -b.w / 2, -b.h, b.w, b.h); ctx.restore();
        ctx.restore();
      }
      if (b.state === 'rubble' || b.sink > b.h * 0.08) {             // the heap: broken floor slabs over a mound
        const k = b.state === 'rubble' ? 1 : Math.min(1, b.sink / b.h * 1.1), hw = b.w * 0.72, hh = b.h * 0.085 * k;
        ctx.fillStyle = grey != null ? `rgb(${grey(0.1)})` : '#8f8370'; ctx.beginPath(); ctx.moveTo(b.x - hw, b.base);
        for (let i = 0; i <= 18; i++) { const u = i / 18, e = Math.sin(Math.PI * u); ctx.lineTo(b.x - hw + u * hw * 2, b.base + hh * e * (0.55 + 0.6 * H(i * 1.7 + b.x))); }
        ctx.lineTo(b.x + hw, b.base); ctx.closePath(); ctx.fill();
        if (grey == null) for (let i = 0; i < 16; i++) {
          const u = H(i + b.x * 0.3), e = Math.sin(Math.PI * u), px = b.x - hw + u * hw * 2, py = b.base + hh * e * H(i * 2.3 + 1) * 0.9, sw = 2 + 4 * H(i * 5.1), a = (H(i * 7.7) - 0.5) * 1.1;
          ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.fillStyle = ['#b9aa8c', '#a39478', '#c6b89c', '#7d7262'][i % 4]; ctx.fillRect(-sw / 2, -0.25, sw, 0.5 + 0.5 * H(i));
          ctx.fillStyle = 'rgba(40,32,22,0.35)'; ctx.fillRect(-sw / 2, -0.25, sw, 0.14); ctx.restore();
        }
      }
      // flying and fallen facade pieces: cut-outs of the building's own drawing
      const sim = this.bldImg[b.k + '_broken'];
      for (const s of b.slabs) {
        if (s.rest > 40) continue;
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a); ctx.scale(1, -1);
        if (grey != null) { ctx.fillStyle = `rgb(${grey(0.15)})`; ctx.fillRect(-s.sw / 2, -s.sh / 2, s.sw, s.sh); }
        else ctx.drawImage(sim, s.u * sim.width, s.v * sim.height, s.sw / b.w * sim.width, s.sh / b.h * sim.height, -s.sw / 2, -s.sh / 2, s.sw, s.sh);
        ctx.restore();
      }
    }
  },
});
