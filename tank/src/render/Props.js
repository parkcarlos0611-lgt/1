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
    if (!front && R.town) this.sidewalk(ctx, cam, grey);
    else if (!front && cam.left < R.road[1] + 70) {
      const st = Math.max(1, 4 / cam.zoom), a = cam.left - 1, b = Math.min(cam.right + 1, R.road[1] + 72), gy = T.height(Math.min(cam.x, R.road[1]));
      ctx.beginPath(); ctx.moveTo(a, T.height(a) - 0.3);
      for (let x = a; x <= b; x += st) ctx.lineTo(x, T.height(x) + 1.02 * lift(x));
      ctx.lineTo(b, T.height(b) - 0.3); ctx.closePath();
      if (grey != null) ctx.fillStyle = `rgb(${grey(-0.6)})`;
      else { const g = ctx.createLinearGradient(0, gy, 0, gy + 1.02); g.addColorStop(0, storm ? '#d2b080' : '#dcbf90'); g.addColorStop(1, `rgb(${hz})`); ctx.fillStyle = g; }
      ctx.fill();
    }
    const LIFT = { 1: 0.1, 2: 0.4, 3: 0.7, 4: 0.94, 5: 1.2 };
    for (const p of L) {
      if ((p.z < 0) !== front) continue;
      const [par, haze] = front ? [1 + 0.45 * R.front, 0] : R.layers[p.z];
      const x = cam.x + (p.x - cam.x) * par;
      if (p.k === 'flag') { if (x > cam.left - 5 && x < cam.right + 5) this.flag(ctx, p, x, T.height(p.x) + LIFT[p.z] * lift(x) - 0.05, par, grey); continue; }
      const wd = p.w * par, im = this.propImg[p.k]; if (!im) continue;
      const ht = wd * im.height / im.width;
      if (x + wd / 2 < cam.left - 6 || x - wd / 2 > cam.right + 6) continue;
      const y = T.height(front ? x : p.x) + (front ? -0.25 - R.front * 7 : LIFT[p.z] * lift(x));
      let src = im;
      if (grey != null) src = this.propTinted(p.k, 't' + p.z, grey(front ? 0 : haze), 1);
      else if (haze || storm) src = this.propTinted(p.k, p.z, hz, Math.min(0.85, haze + storm * 0.25));
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
    if (this.propImg.road && cam.zoom > 4) {
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
  // town road: dashed centre line, worn wheel paths, the kerb and gutter on the near side; sand drifts over
  // the edges out on the highway
  roadMarks(ctx, cam, a, b, D, st) {
    const T = this.w.terrain, R = DS.TOWN, line = (dy) => { ctx.beginPath(); for (let x = a; x < b; x += st) ctx.lineTo(x, T.height(x) - dy); ctx.lineTo(b, T.height(b) - dy); ctx.stroke(); };
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(40,38,34,0.22)'; ctx.lineWidth = 0.35; line(D * 0.28); line(D * 0.72);
    ctx.strokeStyle = 'rgba(232,226,210,0.75)'; ctx.lineWidth = 0.07; ctx.setLineDash([3, 6]); ctx.lineDashOffset = 0; line(D * 0.5); ctx.setLineDash([]);
    // the far-side sidewalk in front of the road (toward the viewer) in town
    for (let x = a; x < b;) {
      let e = x; const u = R.urban(x); while (e < b && R.urban(e) === u) e += 2; e = Math.min(e, b);
      if (u) { ctx.beginPath(); for (let q = x; q <= e; q += st) ctx.lineTo(q, T.height(q) - D - 0.02); ctx.lineTo(e, T.height(e) - D - 0.02);
        for (let q = e; q >= x; q -= st) ctx.lineTo(q, T.height(q) - D - 0.75); ctx.closePath(); ctx.fillStyle = '#b3a791'; ctx.fill(); }
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
        ctx.strokeStyle = grey != null ? `rgb(${grey(-0.1)})` : '#d2c8b6'; ctx.lineWidth = 0.1; ctx.beginPath();
        for (let q = x; q <= e; q += st) ctx.lineTo(q, T.height(q) + 0.05); ctx.stroke();                 // kerb top
        if (cam.zoom > 6) { ctx.strokeStyle = 'rgba(90,80,64,0.25)'; ctx.lineWidth = 0.03; ctx.beginPath();        // paving joints
          for (let q = Math.ceil(x / 1.5) * 1.5; q < e; q += 1.5) { const h = T.height(q); ctx.moveTo(q, h + 0.07); ctx.lineTo(q + 0.25, h + Wk); } ctx.stroke(); }
      } else strip(x, e, grey != null ? `rgb(${grey(-0.4)})` : '#d6b986', Wk * 0.6);
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
