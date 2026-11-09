// 1D heightfield terrain with soil model: Bekker sinkage, compaction memory, angle-of-repose slumping,
// craters. Cells every dx metres. World y up, x along the drive line.
DS.Terrain = class Terrain {
  constructor(seed = 7) {
    const T = DS.T.terrain;
    this.dx = T.dx;
    this.n = Math.round(T.length / this.dx) + 1;
    this.h = new Float32Array(this.n);      // surface height
    this.sink = new Float32Array(this.n);   // accumulated pressed depth (compaction memory)
    this.disturb = new Float32Array(this.n);// visual: dug / thrown material (craters), fades never
    this.soil = new Uint8Array(this.n);
    this.rng = DS.rng(seed);
    this.dirty0 = Infinity; this.dirty1 = -Infinity;
    this.version = 0;
    this.generate();
  }

  generate() {
    const r = this.rng, n = this.n, dx = this.dx;
    // smooth value noise
    const vn = (scale, amp, seed) => {
      const k = Math.ceil(n * dx / scale) + 3, v = new Float32Array(k);
      const rr = DS.rng(seed); for (let i = 0; i < k; i++) v[i] = rr() * 2 - 1;
      return x => { const t = x / scale, i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f);
        return amp * (v[i] + (v[i + 1] - v[i]) * s); };
    };
    // dunes: asymmetric (gentle windward, steeper lee) — wind from the left
    const dune = (x, lam, amp, ph) => {
      let t = ((x / lam + ph) % 1 + 1) % 1;
      const s = t < 0.72 ? t / 0.72 : 1 - (t - 0.72) / 0.28;   // ramp up 72 %, slip face 28 %
      return amp * (s * s * (3 - 2 * s));
    };
    const n1 = vn(260, 3.2, 11), n2 = vn(70, 0.9, 12), n3 = vn(14, 0.18, 13), n4 = vn(3.1, 0.035, 14);
    const amp = vn(900, 1, 15);
    for (let i = 0; i < n; i++) {
      const x = i * dx;
      const flat = Math.min(1, Math.max(0, (x - 120) / 250));       // flat start area
      const a = 0.5 + 0.5 * amp(x);
      let y = n1(x) + n2(x) * (0.4 + a) + n3(x) + n4(x);
      y += dune(x, 180, 2.6 * a, 0.3) + dune(x, 47, 0.7 * a, 0.1);
      this.h[i] = 10 + y * flat + n4(x) * (1 - flat);
    }
    // soil zones
    const zn = vn(380, 1, 21);
    for (let i = 0; i < n; i++) {
      const x = i * dx, z = zn(x);
      this.soil[i] = x < 300 ? 0 : z > 0.35 ? 2 : z > -0.15 ? 1 : 0;
    }
    // a wadi (dry channel) and a dug-in revetment berm for testing
    this.addProfile(620, 18, -1.6);
    this.addBerm(900, 1.8, 6);
    this.relax(0, n - 1, 6);
  }

  addProfile(x, w, depth) {
    for (let i = this.idx(x - w); i <= this.idx(x + w); i++) {
      const t = (i * this.dx - x) / w; if (Math.abs(t) < 1) this.h[i] += depth * 0.5 * (1 + Math.cos(Math.PI * t));
    }
  }
  addBerm(x, height, w) {
    for (let i = this.idx(x - w * 2); i <= this.idx(x + w * 2); i++) {
      const t = (i * this.dx - x) / w; this.h[i] += height * Math.exp(-t * t * 2.2);
    }
  }

  idx(x) { return Math.max(0, Math.min(this.n - 1, Math.round(x / this.dx))); }
  height(x) {
    const t = x / this.dx; let i = Math.floor(t);
    if (i < 0) return this.h[0]; if (i >= this.n - 1) return this.h[this.n - 1];
    const f = t - i; return this.h[i] + (this.h[i + 1] - this.h[i]) * f;
  }
  slope(x) { return (this.height(x + 0.25) - this.height(x - 0.25)) / 0.5; }
  soilAt(x) { return DS.SOILS[this.soil[this.idx(x)]]; }

  // Highest centre a circle of radius R at horizontal position cx may sit at without penetrating.
  circleRest(cx, R) {
    const dx = this.dx, i0 = Math.max(0, Math.ceil((cx - R) / dx)), i1 = Math.min(this.n - 1, Math.floor((cx + R) / dx));
    let best = -1e9;
    for (let i = i0; i <= i1; i++) {
      const u = i * dx - cx, y = this.h[i] + Math.sqrt(Math.max(0, R * R - u * u));
      if (y > best) best = y;
    }
    return best;
  }

  // Press the surface under a track footprint. N in newtons, area in m², footprint [x0, x1].
  press(x0, x1, N, area, dt) {
    if (N <= 0) return 0;
    const pk = N / area / 1000;                 // kPa
    let zmax = 0;
    const i0 = this.idx(x0), i1 = this.idx(x1), mid = (x0 + x1) / 2, half = (x1 - x0) / 2;
    for (let i = i0; i <= i1; i++) {
      const s = DS.SOILS[this.soil[i]];
      const k = s.kc / 0.635 + s.kphi;
      const prof = 1 - 0.45 * Math.pow(Math.abs(i * this.dx - mid) / half, 2); // peak under the wheel
      const zt = Math.pow(pk * prof / k, 1 / s.n);
      if (zt > zmax) zmax = zt;
      const d = zt - this.sink[i];
      if (d > 0) {
        const step = Math.min(d, 0.6 * dt);      // soil yields at a finite rate
        this.h[i] -= step; this.sink[i] += step; this.mark(i);
      }
    }
    return zmax;
  }

  crater(x, R, depth, rim = 0.35) {
    const i0 = this.idx(x - R * 1.8), i1 = this.idx(x + R * 1.8);
    for (let i = i0; i <= i1; i++) {
      const t = Math.abs(i * this.dx - x) / R;
      let d = 0;
      if (t < 1) d = -depth * (1 - t * t);
      else if (t < 1.8) { const u = (t - 1) / 0.8; d = depth * rim * Math.sin(Math.PI * u) * (1 - u * 0.4); }
      this.h[i] += d; this.disturb[i] = Math.min(1, this.disturb[i] + (t < 1.8 ? 0.8 * (1 - t / 1.8) + 0.2 : 0));
      if (t < 1.2) this.sink[i] = 0;
    }
    this.mark(i0); this.mark(i1);
  }

  mark(i) { if (i < this.dirty0) this.dirty0 = i; if (i > this.dirty1) this.dirty1 = i; }

  // Angle-of-repose relaxation on the dirty range.
  relax(i0 = this.dirty0, i1 = this.dirty1, iters = 2) {
    if (!(i1 >= i0)) return;
    i0 = Math.max(1, i0 - 4); i1 = Math.min(this.n - 2, i1 + 4);
    const maxd = Math.tan(DS.T.terrain.repose * Math.PI / 180) * this.dx, h = this.h;
    for (let it = 0; it < iters; it++) {
      let moved = false;
      for (let i = i0; i < i1; i++) {
        const d = h[i] - h[i + 1];
        if (d > maxd) { const m = (d - maxd) * 0.5; h[i] -= m; h[i + 1] += m; moved = true; }
        else if (d < -maxd) { const m = (-d - maxd) * 0.5; h[i] += m; h[i + 1] -= m; moved = true; }
      }
      if (!moved) break;
    }
    this.dirty0 = Infinity; this.dirty1 = -Infinity; this.version++;
  }
};

// small deterministic RNG (mulberry32)
DS.rng = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
