// Firing-range scenery (data/range.js): base buildings and barriers in depth layers, range signs, the road.
// Scenery only — nothing here collides. Layers behind the drive line are smaller, hazier and slide slower
// (parallax); the near row stands on the ground plane in front of the line.
Object.assign(DS.Renderer.prototype, {
  loadProps() {
    this.propImg = {}; this.propTint = {};
    return Promise.all(Object.keys(DS.RANGE.sprites).concat('road', 'pole', 'usflag').map(k => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => { this.propImg[k] = im; res(); };
      im.onerror = () => rej(new Error('sprite props/' + k));
      im.src = 'assets/sprites/props/' + k + '.png';
    })));
  },
  // town art (data/town_sprites.js), loaded only when the town map is entered; drawn by the scenery rows
  // as 't:<id>' (city buildings are already loaded as 'city:<k>')
  loadTown() {
    if (this._town) return this._town;
    for (const g of ['lot1', 'lot2', 'alley1', 'alley2', 'road']) { const im = new Image(); im.onload = () => { this.propImg['g:' + g] = im; }; im.src = 'assets/sprites/ground/' + g + '.jpg'; }
    return (this._town = Promise.all(Object.keys(DS.TOWN_SPRITES).map(k => new Promise(res => { const im = new Image(); im.onload = () => { this.propImg['t:' + k] = im; res(); }; im.onerror = () => res(); im.src = 'assets/sprites/town/' + k + '.png'; }))));
  },
  // a parked M1A1 drawn once into a sprite (the vehicle renderer at 48 px/m), used as scenery in the base
  makeParked(world) {
    if (this.propImg.m1a1) return;
    const v = new DS.Vehicle(DS.VEHICLES.m1a1, 500, world.terrain, {}), W = 11.4, H = 4.2, z = 48;
    const c = document.createElement('canvas'); c.width = W * z; c.height = H * z;
    const cam = new DS.Camera(); cam.resize(W * z, H * z, 1); cam.zoom = cam.tzoom = z;
    const base = world.terrain.height(500);
    cam.x = v.pos.x + 0.9; cam.y = base + H / 2 - 0.02;
    const x = c.getContext('2d'), keep = [this.cam, this.opt]; this.cam = cam; this.opt = {};
    for (let i = 0; i < 240; i++) v.step(1 / 240, world);          // settle on its suspension so wheels and track sit right
    cam.apply(x); this.drawVehicle(x, v, cam);
    [this.cam, this.opt] = keep;
    this.propImg.m1a1 = c; DS.RANGE.sprites.m1a1 = W;
    for (const p of world.props) if (p.k === 'm1a1') p.w = W;
  },
  // Stars and Stripes on a pole. The cloth is one mesh (13 x 7 points) held along the hoist by the halyard
  // clips and simulated as a net of links: weight pulls it down the pole, wind drags it out downwind and a
  // travelling gust makes it ripple. The flag picture is laid over the mesh cell by cell, so the top and
  // bottom edges are single continuous curves. State is kept per flagpole.
  flag(ctx, p, x, y, s, grey) {
    const w = this.w, hgt = p.f, pole = this.propImg.pole, fim = this.propImg.usflag;
    const pw = hgt * pole.width / pole.height * s;
    const src = grey != null ? this.propTinted('pole', 't', grey(0.15), 1) : pole;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, -1); ctx.drawImage(src, -pw / 2, -hgt * s, pw, hgt * s); ctx.restore();
    if (grey != null) return;
    const NX = 12, NY = 6, FL = 2.9, FH = 1.5, cw = FL / NX, ch = FH / NY, N = (NX + 1) * (NY + 1);
    // Shape (not a free cloth simulation, which tangles in a flat view): the hoist is fixed down the pole and
    // every row of the mesh follows the same curve from it, so the top and bottom edges are parallel,
    // unbroken lines. Calm: the rows fall away steeply and the flag drapes beside the pole. Wind: they lift
    // toward the horizontal and a wave runs out to the fly. Strength and side are eased, so a change of wind
    // swings the flag round instead of snapping it.
    let c = p.cloth;
    const wind = w.wind || 0, kT = Math.min(1, Math.pow(Math.abs(wind) / 9, 0.75)), sT = wind < -0.3 ? -1 : 1;
    if (!c) c = p.cloth = { x: new Float32Array(N), y: new Float32Array(N), t: w.time, k: kT, s: sT, ph: 0 };
    const dt = Math.max(0, Math.min(0.1, w.time - c.t)); c.t = w.time;
    c.k += (kT - c.k) * Math.min(1, dt * 0.9); c.s += (sT - c.s) * Math.min(1, dt * 1.5);
    c.ph += dt * (1.6 + 7.5 * c.k);
    const k = c.k, droop = (1 - k) * 1.45 + k * 0.1;
    for (let j = 0; j <= NY; j++) {
      let px = 0, py = -j * ch;
      for (let i = 0; i <= NX; i++) {
        const n = j * (NX + 1) + i, u = i / NX;
        c.x[n] = px * c.s; c.y[n] = py;
        const a = -droop * (1 - Math.exp(-u * 5 - 0.25)) - 0.05 * (j / NY) * (1 - k)
          + Math.sin(c.ph - u * 6.5 + j * 0.22 + p.x) * (0.05 + 0.3 * k) * (0.25 + u)
          + Math.sin(c.ph * 0.37 + p.x * 1.7) * 0.06 * (1 - k);
        px += Math.cos(a) * cw; py += Math.sin(a) * cw;
      }
    }
    // draw: each cell of the picture mapped onto its quad (affine from three corners, slightly overlapped)
    const ox = x + 0.05 * s * c.s, oy = y + (hgt * 0.955) * s, iw = fim.width / NX, ih = fim.height / NY;
    ctx.imageSmoothingQuality = 'high';
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * (NX + 1) + i, a = k, b = k + 1, d = k + NX + 1, e = k + NX + 2;
      const ax = ox + c.x[a] * s, ay = oy + c.y[a] * s, bx = ox + c.x[b] * s, by = oy + c.y[b] * s, dx = ox + c.x[d] * s, dy = oy + c.y[d] * s;
      ctx.save();
      ctx.transform((bx - ax) / iw, (by - ay) / iw, (dx - ax) / ih, (dy - ay) / ih, ax, ay);
      ctx.drawImage(fim, i * iw, j * ih, iw, ih, -0.02 * iw, -0.02 * ih, iw * 1.06, ih * 1.06);
      ctx.restore();
      // light and shade on the folds: from how far the cell is turned and squeezed
      const sq = Math.hypot(bx - ax, by - ay) / (cw * s), tilt = (by - ay) / (cw * s), sh = Math.max(-0.3, Math.min(0.3, tilt * 0.35 - (1 - sq) * 0.6));
      if (Math.abs(sh) > 0.03) {
        ctx.fillStyle = sh > 0 ? `rgba(255,250,235,${sh.toFixed(2)})` : `rgba(20,16,30,${(-sh).toFixed(2)})`;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(ox + c.x[e] * s, oy + c.y[e] * s); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill();
      }
    }
  },
  // the sprite washed toward a flat colour (haze by day, a grey level in the thermal picture)
  propTinted(k, key, rgb, a) {
    const id = k + '/' + key; let c = this.propTint[id];
    if (!c) c = this.propTint[id] = { c: document.createElement('canvas'), v: '' };
    const v = rgb + ',' + a;
    if (c.v !== v) {
      const im = this.propImg[k], x = c.c.getContext('2d'); c.v = v;
      c.c.width = im.width; c.c.height = im.height;
      x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = `rgba(${rgb},${a})`; x.fillRect(0, 0, im.width, im.height);
    }
    return c.c;
  },
  // front = false: the layers behind the line (drawn before the vehicles); true: the near row (after the ground)
  props(ctx, cam, front, grey) {
    if (!front) this._litList = null;                // (night lights recorded afresh for this picture)
    const w = this.w, L = w.props; if (!L || !this.propImg) return;
    const T = w.terrain, R = DS.MAP, env = w.env || {}, storm = env.visibility ? 1 : 0;
    const hz = storm ? '205,176,134' : '222,204,172', sun = env.sun && env.sun.el > 0 && (env.night || 0) < 0.5 ? env.sun : null;
    ctx.imageSmoothingQuality = 'high';
    // the base's ground behind the line: a low strip of sand rising toward the far wall, so the rows stand
    // one behind the other instead of all on the same line
    const lift = R.town ? () => 1 : x => { const t = Math.max(0, Math.min(1, (R.road[1] + 70 - x) / 60)); return t * t * (3 - 2 * t); };
    if (!front && R.town) { this.backLot(ctx, cam, grey); this.sidewalk(ctx, cam, grey); }
    else if (!front && cam.left < R.road[1] + 70) {
      const st = Math.max(1, 4 / cam.zoom), a = cam.left - 1, b = Math.min(cam.right + 1, R.road[1] + 72), gy = T.height(Math.min(cam.x, R.road[1]));
      ctx.beginPath(); ctx.moveTo(a, T.height(a) - 0.3);
      for (let x = a; x <= b; x += st) ctx.lineTo(x, T.height(x) + 1.02 * lift(x));
      ctx.lineTo(b, T.height(b) - 0.3); ctx.closePath();
      if (grey != null) ctx.fillStyle = `rgb(${grey(-0.6)})`;
      else { const g = ctx.createLinearGradient(0, gy, 0, gy + 1.02); g.addColorStop(0, storm ? '#d2b080' : '#dcbf90'); g.addColorStop(1, `rgb(${hz})`); ctx.fillStyle = g; }
      ctx.fill();
    }
    const LIFT = { 0.5: 0.12, 1: 0.1, 2: 0.4, 3: 0.7, 4: 0.94, 5: 1.2 };
    for (const p of L) {
      if ((p.z < 0) !== front) continue;
      const [par, haze] = front ? [1 + 0.45 * R.front, 0] : R.layers[p.z];
      const x = cam.x + (p.x - cam.x) * par;
      if (p.k === 'flag') { if (x > cam.left - 5 && x < cam.right + 5) this.flag(ctx, p, x, T.height(p.x) + LIFT[p.z] * lift(x) - 0.05, par, grey); continue; }
      const wd = p.w * par, im = this.propImg[p.k]; if (!im) continue;
      const ht = wd * im.height / im.width;
      if (x + wd / 2 < cam.left - 6 || x - wd / 2 > cam.right + 6) continue;
      const y = T.height(front ? x : p.x) + (front ? (R.town ? -R.roadW - 0.42 : -0.25 - R.front * 7) : LIFT[p.z] * lift(x));      // (town: on the near sidewalk)
      let src = im;
      if (grey != null) src = this.propTinted(p.k, 't' + p.z, grey(front ? 0 : haze), 1);
      else if (haze || storm) src = this.propTinted(p.k, p.z, R.town && !storm ? '198,206,212' : hz, Math.min(0.85, haze + storm * 0.25));      // town: the far rows go blue-grey
      // contact shade: the ground darkens under a building's foot (it sits on the ground, not in front of it)
      if (grey == null && (p.k.startsWith('city:') || /^t:(market|shop|tin|shed|container|quonset|tent|canopy|shelter|ruin|watch)/.test(p.k))) {
        const sh = ctx.createLinearGradient(0, y + 0.05, 0, y - 0.35 * par); sh.addColorStop(0, `rgba(40,30,20,${0.32 * (1 - haze)})`); sh.addColorStop(1, 'rgba(40,30,20,0)');
        ctx.fillStyle = sh; ctx.fillRect(x - wd * 0.53, y - 0.35 * par, wd * 1.06, 0.4 * par);
      }
      // cast shadow: the building's outline laid on the ground away from the sun, toward the viewer
      if (sun && grey == null) {
        const run = -sun.side * Math.min(3.2, sun.cot != null ? sun.cot : 1 / Math.tan(sun.el * Math.PI / 180)) * ht * 0.55, drop = (front ? 0.5 : 0.16 + 0.1 * par) * Math.min(1.6, 0.6 + ht / 4);
        const tall = p.k === 'supply' || p.k === 'sandbag' ? 0.82 : 0.94, e = wd * 0.47 * tall;
        ctx.fillStyle = `rgba(52,36,18,${(storm ? 0.12 : 0.3) * (1 - haze)})`;
        ctx.beginPath(); ctx.moveTo(x - e, y + 0.03); ctx.lineTo(x + e, y + 0.03); ctx.lineTo(x + e + run, y - drop); ctx.lineTo(x - e + run, y - drop); ctx.closePath(); ctx.fill();
      }
      ctx.save(); ctx.translate(x, y); ctx.scale(p.f === -1 ? -1 : 1, -1); ctx.drawImage(src, -wd / 2, -ht * (p.k === 'm1a1' ? 1 : 0.985), wd, ht);
      if (grey == null && haze < 0.3 && (p.k.startsWith('city:') || /^t:(market|shop)/.test(p.k))) this.relief(ctx, p.k, im, -wd / 2, -ht * 0.985, wd, ht, p.f);
      ctx.restore();
      if (grey == null) this.litRecord(p, im, x, y, wd, ht, haze);
      // shaded side: the wall facing away from the sun is darker (a gradient across the sprite's own shape is
      // too costly per frame, so a narrow band at the lee end of the base)
    }
    if (!front) this.rangeSigns(ctx, cam, grey);
  },
  // boards right behind the line at their true position (no parallax): range entrance, warnings, distances
  rangeSigns(ctx, cam, grey) {
    const T = this.w.terrain, R = DS.MAP, env = this.w.env || {}, sun = env.sun && env.sun.el > 0 && (env.night || 0) < 0.5 ? env.sun : null;
    for (const [k, d] of R.signs) {
      const x = R.line + d, wd = R.sprites[k], im = this.propImg[k];
      if (x < cam.left - 4 || x > cam.right + 4 || !im) continue;
      const ht = wd * im.height / im.width, y = T.height(x) - 0.06;
      const src = grey != null ? this.propTinted(k, 't', grey(0.1), 1) : env.visibility ? this.propTinted(k, 's', '205,176,134', 0.2) : im;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, -1); ctx.drawImage(src, -wd / 2, -ht, wd, ht); ctx.restore();
    }
  },
  // gravel road along the line (a strip of the ground plane) with side roads running off toward the viewer
  road(ctx, cam, x0, x1) {
    const T = this.w.terrain, R = DS.MAP; if ((T.kind !== 'range' && T.kind !== 'town') || x0 > R.road[1] + 10) return;
    const D = R.roadW, a = Math.max(x0, R.road[0]), b = Math.min(x1, R.road[1]), bot = cam.bottom - 1, town = !!R.town;
    const storm = (this.w.env || {}).visibility ? 1 : 0, c0 = town ? '#6c6862' : storm ? '#b3a184' : '#b9ad96', c1 = town ? '#7d786f' : storm ? '#9a8a70' : '#9c917c';
    for (const c of R.cross) {                         // side roads first (the main road covers their far end)
      const h = T.height(c), pt = 1 + 0.45 * (D / 7), pb = 1 + 0.45 * Math.min(1.6, (h - bot) / 7);
      const xt = cam.x + (c - cam.x) * pt, xb = cam.x + (c - cam.x) * pb;
      if (Math.max(xt, xb) + 12 < x0 || Math.min(xt, xb) - 12 > x1) continue;
      const g = ctx.createLinearGradient(0, h - D, 0, bot); g.addColorStop(0, c1); g.addColorStop(1, town ? '#5e5a54' : storm ? '#8d7c62' : '#8f8370');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(xt - 3.6 * pt, h - D + 0.3); ctx.lineTo(xt + 3.6 * pt, h - D + 0.3); ctx.lineTo(xb + 3.6 * pb, bot); ctx.lineTo(xb - 3.6 * pb, bot); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(232,208,160,0.7)'; ctx.lineWidth = 0.1;
      ctx.beginPath(); ctx.moveTo(xt - 3.6 * pt, h - D); ctx.lineTo(xb - 3.6 * pb, bot); ctx.moveTo(xt + 3.6 * pt, h - D); ctx.lineTo(xb + 3.6 * pb, bot); ctx.stroke();
    }
    if (b <= a) return;
    const st = Math.max(0.5, 3 / cam.zoom), gy = T.height((a + b) / 2);
    const g = ctx.createLinearGradient(0, gy, 0, gy - D); g.addColorStop(0, c0); g.addColorStop(1, c1);
    const end = !town && b >= R.road[1] - 0.01;
    ctx.beginPath();
    for (let x = a; x < b; x += st) ctx.lineTo(x, T.height(x) + 0.05);
    ctx.lineTo(b, T.height(b) + 0.05);
    if (end) ctx.lineTo(b + 3.5, T.height(b) - D * 0.5);      // the road ends in a worn, rounded apron
    for (let x = b; x > a; x -= st) ctx.lineTo(x, T.height(x) - D);
    ctx.lineTo(a, T.height(a) - D); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    // asphalt texture laid flat on the plane (the photo strip squeezed to the road's depth), then the haze
    // gradient over it so the far edge stays pale
    if (town && this.propImg['g:road']) {
      // the user's asphalt, laid flat on the road (a tile is 7 m square on the ground; the road is about 9 m deep)
      ctx.save(); ctx.clip(); this.groundTex(ctx, cam, this.propImg['g:road'], a, b, 0.05, -D, 7, D * 7 / 9); ctx.restore();
    } else if (this.propImg.road && cam.zoom > 4) {
      // drawn as plain scaled images, one per 30 m of road (a transformed pattern fill is very slow)
      const im = this.propImg.road, per = 30, y0 = gy + 0.08, hh = D + 0.1;
      ctx.save(); ctx.clip(); ctx.globalAlpha = 0.9; ctx.imageSmoothingQuality = 'low';
      for (let k = Math.floor(a / per); k * per < b + 4; k++) { ctx.save(); ctx.translate(k * per, y0); ctx.scale(1, -1); ctx.drawImage(im, 0, 0, per + 0.02, hh); ctx.restore(); }
      const hg = ctx.createLinearGradient(0, gy, 0, gy - D); hg.addColorStop(0, storm ? 'rgba(200,172,130,0.6)' : 'rgba(214,196,164,0.55)'); hg.addColorStop(1, storm ? 'rgba(190,160,118,0.3)' : 'rgba(190,165,125,0.12)');
      ctx.globalAlpha = 1; ctx.fillStyle = hg; ctx.fillRect(a - 1, gy - D - 1, b - a + 6, D + 2); ctx.restore();
    }
    if (town) { this.roadMarks(ctx, cam, a, b, D, st); return; }
    // wheel-worn lanes and the sand-drifted near edge
    ctx.lineCap = 'butt';
    for (const [dy, lw, col] of [[D * 0.3, 0.5, 'rgba(70,60,46,0.16)'], [D * 0.7, 0.6, 'rgba(70,60,46,0.16)'], [D, 0.14, 'rgba(236,212,166,0.8)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      for (let x = a; x < b; x += st) ctx.lineTo(x, T.height(x) - dy);
      ctx.lineTo(b, T.height(b) - dy); ctx.stroke();
    }
  },
  // A ground texture laid flat on the ground plane between dyTop and dyBot below/above the surface line (m),
  // pressed to the plane's depth: tiles tileW metres wide and tileH tall on screen, each sheared to follow the
  // slope of the ground under it. Drawn as plain images (a transformed pattern fill is slow).
  // Cached: the band is painted once, at the screen's resolution, into a strip wider than the view and drawn
  // from there as one image per call (the tile-aligned slice the tiles would have covered); the strip is
  // repainted when the zoom changes, the view runs off its end or the ground under it changes shape.
  groundTex(ctx, cam, im, a, b, dyTop, dyBot, tileW, tileH, ox = 0) {
    if (!im) return;
    const T = this.w.terrain, z = cam.zoom * cam.dpr, H = dyTop - dyBot, rows = Math.max(1, Math.ceil(H / tileH - 0.01));
    const k0 = Math.floor((a - ox) / tileW), k1 = Math.ceil((b - ox) / tileW), xa = ox + k0 * tileW, xb = ox + Math.max(k0 + 1, k1) * tileW;
    const byCv = this.gtx || (this.gtx = new Map()); let M = byCv.get(ctx.canvas); if (!M) byCv.set(ctx.canvas, M = new Map());
    const key = (im.src || im.width) + '|' + dyTop + '|' + dyBot + '|' + tileW + '|' + tileH + '|' + ox;
    let C = M.get(key);
    const hk = (sa, sb) => { let h = 0; for (let x = sa; x <= sb + 1e-6; x += tileW) h = (h * 31 + Math.round(T.height(x) * 100)) | 0; return h; };
    if (!C || Math.abs(C.z - z) > z * 0.015 || xa < C.sa || xb > C.sb || C.hk !== hk(C.sa, C.sb)) {
      const span = cam.right - cam.left, sa = ox + Math.floor((Math.min(a, cam.left - span * 0.3) - ox) / tileW) * tileW, sb = ox + Math.ceil((Math.max(b, cam.right + span * 0.3) - ox) / tileW) * tileW;
      let lo = 1e9, hi = -1e9; for (let x = sa; x <= sb + 1e-6; x += tileW) { const h = T.height(x); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      const ymax = hi + dyTop + 0.05, ymin = lo + dyTop - rows * tileH - 0.05, cw = Math.ceil((sb - sa) * z), ch = Math.ceil((ymax - ymin) * z);
      if (cw * ch > 6e6 || cw < 1 || ch < 1) { M.delete(key); return this.groundTiles(ctx, im, a, b, dyTop, dyBot, tileW, tileH, ox); }   // very close zoom: tiles as before
      C = C || { c: document.createElement('canvas') };
      if (C.c.width !== cw || C.c.height !== ch) { C.c.width = cw; C.c.height = ch; }
      Object.assign(C, { z, sa, sb, ymax, hk: hk(sa, sb) }); M.set(key, C);
      const o = C.c.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, cw, ch);
      o.setTransform(z, 0, 0, -z, -sa * z, ymax * z);
      this.groundTiles(o, im, sa, sb, dyTop, dyBot, tileW, tileH, ox);
    }
    ctx.save(); ctx.translate(xa, C.ymax); ctx.scale(1, -1); ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(C.c, (xa - C.sa) * C.z, 0, (xb - xa) * C.z, C.c.height, 0, 0, xb - xa, C.c.height / C.z);
    ctx.restore();
  },
  groundTiles(ctx, im, a, b, dyTop, dyBot, tileW, tileH, ox = 0) {
    const T = this.w.terrain, k0 = Math.floor((a - ox) / tileW), H = dyTop - dyBot, rows = Math.max(1, Math.ceil(H / tileH - 0.01));
    ctx.imageSmoothingQuality = 'low';
    for (let k = k0; ox + k * tileW < b; k++) {
      const x = ox + k * tileW, h0 = T.height(x), h1 = T.height(x + tileW), sl = (h1 - h0) / tileW;
      for (let r = 0; r < rows; r++) {
        ctx.save(); ctx.translate(x, h0 + dyTop - r * tileH); ctx.transform(1, sl, 0, 1, 0, 0); ctx.scale(1, -1);
        ctx.drawImage(im, 0, 0, tileW + 0.03, tileH + 0.02); ctx.restore();
      }
    }
  },
  // town road: worn wheel paths (no lane markings), the kerb and gutter on the near side; sand drifts over
  // the edges out on the highway
  roadMarks(ctx, cam, a, b, D, st) {
    const T = this.w.terrain, R = DS.TOWN, line = (dy) => { ctx.beginPath(); for (let x = a; x < b; x += st) ctx.lineTo(x, T.height(x) - dy); ctx.lineTo(b, T.height(b) - dy); ctx.stroke(); };
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(40,38,34,0.22)'; ctx.lineWidth = 0.35; line(D * 0.28); line(D * 0.72);
    // the far-side sidewalk in front of the road (toward the viewer) in town
    for (let x = a; x < b;) {
      let e = x; const u = R.urban(x); while (e < b && R.urban(e) === u) e += 2; e = Math.min(e, b);
      // near side: a paved sidewalk in town, open ground beyond it down to the bottom of the view; sand outside
      ctx.save(); ctx.beginPath(); for (let q = x; q <= e; q += st) ctx.lineTo(q, T.height(q) - D - 0.02); ctx.lineTo(e, T.height(e) - D - 0.02);
      ctx.lineTo(e, cam.bottom - 2); ctx.lineTo(x, cam.bottom - 2); ctx.closePath(); ctx.clip();
      const lot = this.propImg['g:lot1'], pav = this.propImg['g:alley2'];
      if (lot) this.groundTex(ctx, cam, lot, x, e, -D - (u ? 0.75 : 0.02), -D - 9, 6, 1.6, 3);
      if (u && pav) this.groundTex(ctx, cam, pav, x, e, -D - 0.02, -D - 0.75, 3.5, 0.75);
      else if (u) { ctx.fillStyle = '#b3a791'; ctx.fillRect(x, T.height(x) - D - 0.75, e - x, 0.73); }
      ctx.restore();
      x = e;
    }
    // near edge: kerb in town, drifted sand out in the desert
    ctx.strokeStyle = '#bdb6a8'; ctx.lineWidth = 0.12; ctx.beginPath(); let on = false;
    for (let x = a; x < b; x += st) { const u = R.urban(x); if (u && !on) { ctx.moveTo(x, T.height(x) - D); on = true; } else if (u) ctx.lineTo(x, T.height(x) - D); else on = false; }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(226,200,150,0.75)'; ctx.lineWidth = 0.22; ctx.beginPath(); on = false;
    for (let x = a; x < b; x += st) { const u = !R.urban(x); if (u && !on) { ctx.moveTo(x, T.height(x) - D); on = true; } else if (u) ctx.lineTo(x, T.height(x) - D); else on = false; }
    ctx.stroke();
  },
  // the ground behind the sidewalk in town: open ground rising toward the back rows (the plane seen at a slant),
  // paler with distance, so the buildings stand on ground and the gaps between them show land, not the dunes
  backLot(ctx, cam, grey) {
    const T = this.w.terrain, R = DS.TOWN, st = Math.max(0.5, 3 / cam.zoom), a = cam.left - 1, b = cam.right + 1, top = 1.45;
    let x = a;
    while (x < b) {
      const u = R.urban(x); let e = x; while (e < b && R.urban(e) === u) e += 2; e = Math.min(e, b);
      if (u) {
        ctx.save(); ctx.beginPath(); ctx.moveTo(x, T.height(x)); for (let q = x; q <= e; q += st) ctx.lineTo(q, T.height(q) + top); ctx.lineTo(e, T.height(e)); ctx.closePath(); ctx.clip();
        if (grey != null) { ctx.fillStyle = `rgb(${grey(-0.4)})`; ctx.fillRect(x, T.height(x) - 1, e - x, top + 3); }
        else {
          const im = this.propImg['g:lot1'], im2 = this.propImg['g:alley1'];
          if (im) this.groundTex(ctx, cam, im, x, e, top + 0.02, 0, 9, 0.38, 0); else { ctx.fillStyle = '#c9b08a'; ctx.fillRect(x, T.height(x) - 1, e - x, top + 3); }
          if (im2) { ctx.globalAlpha = 0.45; this.groundTex(ctx, cam, im2, x, e, 0.75, 0, 5, 0.35, 2); ctx.globalAlpha = 1; }      // worn paving near the street
          const gy = T.height((x + e) / 2), g = ctx.createLinearGradient(0, gy, 0, gy + top);
          g.addColorStop(0, 'rgba(198,206,212,0)'); g.addColorStop(1, 'rgba(198,206,212,0.55)'); ctx.fillStyle = g; ctx.fillRect(x, gy - 1, e - x, top + 3);
        }
        ctx.restore();
      }
      x = e;
    }
  },
  // sidewalk behind the road in town (a strip of the ground plane rising toward the building rows), kerb at its
  // front; out on the highway the desert shoulder instead
  sidewalk(ctx, cam, grey) {
    const T = this.w.terrain, R = DS.TOWN, st = Math.max(0.5, 3 / cam.zoom), a = cam.left - 1, b = cam.right + 1, Wk = R.walk;
    const strip = (x0, x1, col, top) => { if (x1 <= x0) return; ctx.beginPath(); ctx.moveTo(x0, T.height(x0) - 0.05);
      for (let x = x0; x <= x1; x += st) ctx.lineTo(x, T.height(x) + top); ctx.lineTo(x1, T.height(x1) + top); ctx.lineTo(x1, T.height(x1) - 0.05);
      for (let x = x1; x >= x0; x -= st) ctx.lineTo(x, T.height(x) - 0.05); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    // split the view into town / highway runs
    let x = a;
    while (x < b) {
      const u = R.urban(x); let e = x; while (e < b && R.urban(e) === u) e += 2;
      e = Math.min(e, b);
      if (u) {
        strip(x, e, grey != null ? `rgb(${grey(-0.3)})` : '#b7ab95', Wk);
        if (grey == null && this.propImg['g:alley1']) { ctx.save(); ctx.beginPath(); ctx.moveTo(x, T.height(x) - 0.05); for (let q = x; q <= e; q += st) ctx.lineTo(q, T.height(q) + Wk); ctx.lineTo(e, T.height(e) - 0.05); ctx.closePath(); ctx.clip();
          this.groundTex(ctx, cam, this.propImg['g:alley1'], x, e, Wk + 0.02, -0.05, 3, Wk * 0.6); ctx.restore(); }
        ctx.strokeStyle = grey != null ? `rgb(${grey(-0.1)})` : '#d2c8b6'; ctx.lineWidth = 0.1; ctx.beginPath();
        for (let q = x; q <= e; q += st) ctx.lineTo(q, T.height(q) + 0.05); ctx.stroke();                 // kerb top
        if (cam.zoom > 6) { ctx.strokeStyle = 'rgba(90,80,64,0.25)'; ctx.lineWidth = 0.03; ctx.beginPath();        // paving joints
          for (let q = Math.ceil(x / 1.5) * 1.5; q < e; q += 1.5) { const h = T.height(q); ctx.moveTo(q, h + 0.07); ctx.lineTo(q + 0.25, h + Wk); } ctx.stroke(); }
      } else { strip(x, e, grey != null ? `rgb(${grey(-0.4)})` : '#d6b986', Wk * 0.6);
        if (grey == null && this.propImg['g:lot2']) { ctx.save(); ctx.beginPath(); ctx.moveTo(x, T.height(x) - 0.05); for (let q = x; q <= e; q += st) ctx.lineTo(q, T.height(q) + Wk * 0.6); ctx.lineTo(e, T.height(e) - 0.05); ctx.closePath(); ctx.clip();
          this.groundTex(ctx, cam, this.propImg['g:lot2'], x, e, Wk * 0.6 + 0.02, -0.05, 6, Wk * 0.6); ctx.restore(); } }
      x = e;
    }
  },
  // flight paths of the player's last rounds (sandbox option)
  traces(ctx, cam) {
    const L = this.w.traces; if (!L) return;
    ctx.lineWidth = 1.6 / cam.zoom; ctx.setLineDash([6 / cam.zoom, 5 / cam.zoom]);
    L.forEach((t, i) => {
      if (t.length < 4) return;
      ctx.strokeStyle = `rgba(255,${i === L.length - 1 ? 235 : 190},90,${i === L.length - 1 ? 0.9 : 0.4})`;
      ctx.beginPath(); for (let k = 0; k < t.length; k += 2) ctx.lineTo(t[k], t[k + 1]); ctx.stroke();
    });
    ctx.setLineDash([]);
  },
});
