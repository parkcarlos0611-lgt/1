// Desert plants, rocks and small dunes from the vegetation sheet (data/city.js DS.PLANTS), scattered over the
// land in three bands: behind the drive line (small, hazy, sliding slower), on the line itself (run over by
// tracks and blown away by blasts) and on the near ground plane (bigger, sliding faster). Placement is a fixed
// hash of the position, so the same plants are always in the same place. Bushes and grass sway in the wind.
DS.Flora = {
  // id: [height m (range), sways?]
  KINDS: {
    bush1: [0.5, 0.8, 1], bush2: [0.8, 1.3, 1], bush3: [0.7, 1.1, 1], bush4: [0.9, 1.4, 1], bush5: [0.7, 1.1, 1], bush6: [0.7, 1.1, 1], bush7: [0.6, 1.0, 1],
    tree: [2.2, 3.4, 0], grass1: [0.45, 0.8, 1], grass2: [0.4, 0.7, 1], grass3: [0.35, 0.6, 1], grass4: [0.35, 0.6, 1], grass5: [0.3, 0.5, 1],
    rock1: [0.5, 0.9, 0], rock2: [0.3, 0.5, 0], rock3: [0.5, 0.9, 0], rock4: [0.25, 0.4, 0], rock5: [0.35, 0.6, 0], rock6: [0.35, 0.55, 0], rock7: [0.45, 0.75, 0],
    dune1: [0.8, 1.4, 0], dune2: [0.9, 1.5, 0],
  },
  POOL: ['bush1', 'bush2', 'bush3', 'bush4', 'bush5', 'bush6', 'bush7', 'grass1', 'grass2', 'grass3', 'grass4', 'grass5', 'grass1', 'grass3', 'bush1', 'bush3',
         'rock1', 'rock2', 'rock3', 'rock4', 'rock5', 'rock6', 'rock7', 'rock2', 'rock4', 'tree', 'dune1', 'dune2'],
  // bands: [cell size m, chance, depth on the ground plane (negative = behind the line), parallax, haze, scale]
  BANDS: { back: [5, 0.8, -1, 0.9, 0.2, 1.1], line: [8, 0.5, 0, 1, 0, 1.35], near: [4.5, 0.72, 0.45, 1.2, 0, 1.6] },
  H(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); },
  // how thick the plants grow at x (fewer on the base, the road and the firing lanes, none on the level far range)
  density(T, x) {
    if (T.kind !== 'range') return 1;
    const R = DS.RANGE;
    if (x < R.road[1] + 20) return 0.35;
    if (x < R.laneEnd) return 0.55;
    if (x > R.far) return 0.25;
    return 1;
  },
  item(T, band, j) {
    const [cell, chance, , , , sc] = this.BANDS[band], s = j * 7.31 + (band === 'back' ? 101 : band === 'line' ? 211 : 307);
    if (this.H(s) > chance * this.density(T, j * cell)) return null;
    let k = this.POOL[Math.floor(this.H(s + 1) * this.POOL.length)];
    if (band === 'line' && (k === 'tree' || k.startsWith('dune') || k === 'rock1' || k === 'rock3')) k = 'grass' + (1 + Math.floor(this.H(s + 2) * 5));
    const K = this.KINDS[k], hgt = (K[0] + (K[1] - K[0]) * this.H(s + 3)) * sc;
    return { id: band + j, k, x: (j + 0.15 + 0.7 * this.H(s + 4)) * cell, h: hgt, d: this.H(s + 5), flip: this.H(s + 6) < 0.5, sway: K[2] };
  },
};

Object.assign(DS.Renderer.prototype, {
  loadFlora() {
    this.flImg = {};
    return Promise.all(Object.keys(DS.Flora.KINDS).map(k => new Promise(res => { const im = new Image(); im.onload = () => { this.flImg[k] = im; this.mips['fl/' + k] = this.buildMips(im); res(); }; im.onerror = () => res(); im.src = 'assets/sprites/city/' + k + '.webp'; })));
  },
  // band 'back' is drawn before the vehicles; 'line' and 'near' after the ground
  flora(ctx, cam, band, grey) {
    if (!this.flImg) return;
    const F = DS.Flora, w = this.w, T = w.terrain, [cell, , depth, par0, haze0] = F.BANDS[band];
    const st = w.flora || (w.flora = { crushed: new Map(), gone: new Set() });
    const env = w.env || {}, storm = env.visibility ? 1 : 0, wind = w.wind || 0, t = w.time, zp = cam.zoom * cam.dpr;
    const D = Math.max(1.2, Math.min(7, T.height(cam.x) - cam.bottom - 0.8)), R = DS.RANGE;   // the near ground that is on screen
    const span = (cam.right - cam.left) / 2 + 12, j0 = Math.floor((cam.x - span * 1.3) / cell), j1 = Math.ceil((cam.x + span * 1.3) / cell);
    for (let j = j0; j <= j1; j++) {
      const it = F.item(T, band, j); if (!it || st.gone.has(it.id)) continue;
      const im0 = this.flImg[it.k]; if (!im0) continue;
      let x, y, par, haze = haze0;
      if (band === 'back') {                                   // behind the line, on the land that does not change
        par = 0.82 + 0.12 * it.d; haze = haze0 * (1 - it.d * 0.6);
        x = cam.x + (it.x - cam.x) * par; y = T.height0(it.x) + 0.32 + 0.25 * it.d;
      } else if (band === 'line') {
        par = 1; x = it.x; y = T.height(x) - 0.04;
        if (T.kind === 'range' && x > R.road[0] && x < R.road[1]) continue;
      } else {
        const d = depth + (1 - depth) * it.d; par = 1 + 0.45 * d; x = cam.x + (it.x - cam.x) * par; y = T.height(x) - 0.25 - d * D;
      }
      const hgt = it.h * (band === 'back' ? par : par0 * (band === 'near' ? par / 1.2 : 1)), wd = hgt * im0.width / im0.height;
      if (x + wd < cam.left - 2 || x - wd > cam.right + 2) continue;
      // run over: a vehicle's tracks on this spot flatten it
      let crush = st.crushed.get(it.id) || 0;
      if (band === 'line' && it.sway) for (const v of w.vehicles) {
        if (v.heli || Math.abs(v.vel.x) < 0.3) continue;
        const half = Math.abs(v.g.idler.x - v.g.sprocket.x) / 2 + 0.3;
        if (Math.abs(v.pos.x - x) < half) { crush = 1; st.crushed.set(it.id, 1); }
      }
      if (!this.propImg['fl:' + it.k]) this.propImg['fl:' + it.k] = im0;
      const im = grey != null ? this.propTinted('fl:' + it.k, 't', grey(it.k.startsWith('rock') ? 0.12 : 0.04), 1)
        : (haze || storm) ? this.propTinted('fl:' + it.k, haze > 0.15 ? 'h2' : 'h', storm ? '205,176,134' : '222,204,172', Math.min(0.75, haze + storm * 0.3)) : this.pick('fl/' + it.k, wd * zp);
      ctx.save(); ctx.translate(x, y);
      if (it.sway && !crush) {                                 // sway: lean the top downwind, a little gusty
        const k = Math.min(1, Math.abs(wind) / 10) * 0.18 + 0.03, sw = Math.sin(t * (1.3 + 0.6 * it.d) + it.x * 0.7) * k + Math.sign(wind || 1) * k * 0.6;
        ctx.transform(1, 0, sw, 1, 0, 0);
      }
      if (crush) ctx.scale(1.15, 0.32);
      ctx.scale(it.flip ? -1 : 1, -1);
      ctx.drawImage(im, -wd / 2, -hgt, wd, hgt);
      ctx.restore();
    }
  },
});
