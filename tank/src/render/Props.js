// Firing-range scenery (data/range.js): base buildings and barriers in depth layers, range signs, the road.
// Scenery only — nothing here collides. Layers behind the drive line are smaller, hazier and slide slower
// (parallax); the near row stands on the ground plane in front of the line.
Object.assign(DS.Renderer.prototype, {
  loadProps() {
    this.propImg = {}; this.propTint = {};
    return Promise.all(Object.keys(DS.RANGE.sprites).concat('road').map(k => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => { this.propImg[k] = im; res(); };
      im.onerror = () => rej(new Error('sprite props/' + k));
      im.src = 'assets/sprites/props/' + k + '.png';
    })));
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
  // Stars and Stripes on a pole: the cloth is a chain of strips. In still air it hangs down the pole; as the
  // wind rises it lifts, streams downwind and ripples faster.
  flag(ctx, x, y, hgt, s, grey) {
    const w = this.w, wind = w.wind || 0, k = Math.min(1, Math.pow(Math.abs(wind) / 8, 0.7)), sg = wind < 0 ? -1 : 1, t = w.time;
    ctx.fillStyle = grey != null ? `rgb(${grey(0.2)})` : '#c9c5b8'; ctx.fillRect(x - 0.05 * s, y, 0.1 * s, hgt * s);
    ctx.fillStyle = grey != null ? `rgb(${grey(0.3)})` : '#e2c25a'; ctx.beginPath(); ctx.arc(x, y + hgt * s, 0.11 * s, 0, 7); ctx.fill();
    if (grey != null) return;
    const N = 9, L = 2.6 * s, H = 1.45 * s, top = [], bot = [];
    let px = x + 0.05 * s * sg, py = y + (hgt - 0.15) * s;
    for (let i = 0; i <= N; i++) {
      const u = i / N, rip = Math.sin(t * (2.5 + 5 * k) - i * 0.95 + x) * (0.12 + 0.3 * k) * u;
      // direction of this strip: straight down in calm air, toward the wind's lee when it blows
      const a = (1 - k) * (-1.25 - 0.2 * Math.sin(t * 0.7 + x)) + k * (-0.12 * (1 - u)) + rip;
      const dx = Math.cos(a) * sg, dy = Math.sin(a);
      top.push([px, py]); bot.push([px + dy * sg * H * 1, py - dx * sg * H]);
      px += dx * L / N; py += dy * L / N;
    }
    const quad = (i, v0, v1, col) => {
      const a = top[i], b = top[i + 1], c = bot[i + 1], d = bot[i], m = (p, q, v) => [p[0] + (q[0] - p[0]) * v, p[1] + (q[1] - p[1]) * v];
      const p0 = m(a, d, v0), p1 = m(b, c, v0), p2 = m(b, c, v1), p3 = m(a, d, v1);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.closePath(); ctx.fill();
    };
    for (let i = 0; i < N; i++) {
      const sh = Math.round(18 * Math.sin(t * (2.5 + 5 * k) - i * 0.95 + x + 1));      // light and shade on the folds
      quad(i, 0, 1, `rgb(${236 + sh},${232 + sh},${224 + sh})`);
      for (let r = 0; r < 13; r += 2) quad(i, r / 13, (r + 1) / 13, `rgb(${178 + sh},${42 + sh / 2},${48 + sh / 2})`);
      if (i < 4) quad(i, 0, 7 / 13, `rgb(${44 + sh / 2},${58 + sh / 2},${112 + sh})`);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 4; i++) for (let r = 0; r < 3; r++) { const a = top[i], b = top[i + 1], d = bot[i], cx = (a[0] + b[0]) / 2 + (d[0] - a[0]) * (0.1 + r * 0.17), cy = (a[1] + b[1]) / 2 + (d[1] - a[1]) * (0.1 + r * 0.17); ctx.fillRect(cx - 0.04 * s, cy - 0.04 * s, 0.08 * s, 0.08 * s); }
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
    const w = this.w, L = w.props; if (!L || !this.propImg) return;
    const T = w.terrain, R = DS.RANGE, env = w.env || {}, storm = env.visibility ? 1 : 0;
    const hz = storm ? '205,176,134' : '222,204,172', sun = env.night ? null : env.sun;
    ctx.imageSmoothingQuality = 'high';
    // the base's ground behind the line: a low strip of sand rising toward the far wall, so the rows stand
    // one behind the other instead of all on the same line
    const lift = x => { const t = Math.max(0, Math.min(1, (R.road[1] + 70 - x) / 60)); return t * t * (3 - 2 * t); };
    if (!front && cam.left < R.road[1] + 70) {
      const st = Math.max(1, 4 / cam.zoom), a = cam.left - 1, b = Math.min(cam.right + 1, R.road[1] + 72), gy = T.height(Math.min(cam.x, R.road[1]));
      ctx.beginPath(); ctx.moveTo(a, T.height(a) - 0.3);
      for (let x = a; x <= b; x += st) ctx.lineTo(x, T.height(x) + 1.02 * lift(x));
      ctx.lineTo(b, T.height(b) - 0.3); ctx.closePath();
      if (grey != null) ctx.fillStyle = `rgb(${grey(-0.6)})`;
      else { const g = ctx.createLinearGradient(0, gy, 0, gy + 1.02); g.addColorStop(0, storm ? '#d2b080' : '#dcbf90'); g.addColorStop(1, `rgb(${hz})`); ctx.fillStyle = g; }
      ctx.fill();
    }
    const LIFT = { 1: 0.1, 2: 0.4, 3: 0.7, 4: 0.94 };
    for (const p of L) {
      if ((p.z < 0) !== front) continue;
      const [par, haze] = front ? [1 + 0.45 * R.front, 0] : R.layers[p.z];
      const x = cam.x + (p.x - cam.x) * par;
      if (p.k === 'flag') { if (x > cam.left - 4 && x < cam.right + 4) this.flag(ctx, x, T.height(p.x) + LIFT[p.z] * lift(x), p.f, par, grey); continue; }
      const wd = p.w * par, im = this.propImg[p.k]; if (!im) continue;
      const ht = wd * im.height / im.width;
      if (x + wd / 2 < cam.left - 6 || x - wd / 2 > cam.right + 6) continue;
      const y = T.height(front ? x : p.x) + (front ? -0.25 - R.front * 7 : LIFT[p.z] * lift(x));
      let src = im;
      if (grey != null) src = this.propTinted(p.k, 't' + p.z, grey(front ? 0 : haze), 1);
      else if (haze || storm) src = this.propTinted(p.k, p.z, hz, Math.min(0.85, haze + storm * 0.25));
      // cast shadow: the building's outline laid on the ground away from the sun, toward the viewer
      if (sun && grey == null) {
        const run = -sun.side * Math.min(3.2, 1 / Math.tan(sun.el * Math.PI / 180)) * ht * 0.55, drop = (front ? 0.5 : 0.16 + 0.1 * par) * Math.min(1.6, 0.6 + ht / 4);
        const tall = p.k === 'supply' || p.k === 'sandbag' ? 0.82 : 0.94, e = wd * 0.47 * tall;
        ctx.fillStyle = `rgba(52,36,18,${(storm ? 0.12 : 0.3) * (1 - haze)})`;
        ctx.beginPath(); ctx.moveTo(x - e, y + 0.03); ctx.lineTo(x + e, y + 0.03); ctx.lineTo(x + e + run, y - drop); ctx.lineTo(x - e + run, y - drop); ctx.closePath(); ctx.fill();
      }
      ctx.save(); ctx.translate(x, y); ctx.scale(p.f === -1 ? -1 : 1, -1); ctx.drawImage(src, -wd / 2, -ht * (p.k === 'm1a1' ? 1 : 0.985), wd, ht); ctx.restore();
      // shaded side: the wall facing away from the sun is darker (a gradient across the sprite's own shape is
      // too costly per frame, so a narrow band at the lee end of the base)
    }
    if (!front) this.rangeSigns(ctx, cam, grey);
  },
  // boards right behind the line at their true position (no parallax): range entrance, warnings, distances
  rangeSigns(ctx, cam, grey) {
    const T = this.w.terrain, R = DS.RANGE, env = this.w.env || {}, sun = env.night ? null : env.sun;
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
    const T = this.w.terrain, R = DS.RANGE; if (T.kind !== 'range' || x0 > R.road[1] + 10) return;
    const D = R.roadW, a = Math.max(x0, R.road[0]), b = Math.min(x1, R.road[1]), bot = cam.bottom - 1;
    const storm = (this.w.env || {}).visibility ? 1 : 0, c0 = storm ? '#b3a184' : '#b9ad96', c1 = storm ? '#9a8a70' : '#9c917c';
    for (const c of R.cross) {                         // side roads first (the main road covers their far end)
      const h = T.height(c), pt = 1 + 0.45 * (D / 7), pb = 1 + 0.45 * Math.min(1.6, (h - bot) / 7);
      const xt = cam.x + (c - cam.x) * pt, xb = cam.x + (c - cam.x) * pb;
      if (Math.max(xt, xb) + 12 < x0 || Math.min(xt, xb) - 12 > x1) continue;
      const g = ctx.createLinearGradient(0, h - D, 0, bot); g.addColorStop(0, c1); g.addColorStop(1, storm ? '#8d7c62' : '#8f8370');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(xt - 3.6 * pt, h - D + 0.3); ctx.lineTo(xt + 3.6 * pt, h - D + 0.3); ctx.lineTo(xb + 3.6 * pb, bot); ctx.lineTo(xb - 3.6 * pb, bot); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(232,208,160,0.7)'; ctx.lineWidth = 0.1;
      ctx.beginPath(); ctx.moveTo(xt - 3.6 * pt, h - D); ctx.lineTo(xb - 3.6 * pb, bot); ctx.moveTo(xt + 3.6 * pt, h - D); ctx.lineTo(xb + 3.6 * pb, bot); ctx.stroke();
    }
    if (b <= a) return;
    const st = Math.max(0.5, 3 / cam.zoom), gy = T.height((a + b) / 2);
    const g = ctx.createLinearGradient(0, gy, 0, gy - D); g.addColorStop(0, c0); g.addColorStop(1, c1);
    const end = b >= R.road[1] - 0.01;
    ctx.beginPath();
    for (let x = a; x < b; x += st) ctx.lineTo(x, T.height(x) + 0.05);
    ctx.lineTo(b, T.height(b) + 0.05);
    if (end) ctx.lineTo(b + 3.5, T.height(b) - D * 0.5);      // the road ends in a worn, rounded apron
    for (let x = b; x > a; x -= st) ctx.lineTo(x, T.height(x) - D);
    ctx.lineTo(a, T.height(a) - D); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    // asphalt texture laid flat on the plane (the photo strip squeezed to the road's depth), then the haze
    // gradient over it so the far edge stays pale
    if (this.propImg.road && cam.zoom > 4) {
      const im = this.propImg.road, pat = ctx.createPattern(im, 'repeat'), per = 30;      // one strip = 30 m of road
      pat.setTransform(new DOMMatrix([per / im.width, 0, 0, -(D + 0.1) / im.height, 0, gy + 0.08]));
      ctx.save(); ctx.clip(); ctx.fillStyle = pat; ctx.globalAlpha = 0.9; ctx.fillRect(a - 1, gy - D - 1, b - a + 6, D + 2);
      const hg = ctx.createLinearGradient(0, gy, 0, gy - D); hg.addColorStop(0, storm ? 'rgba(200,172,130,0.6)' : 'rgba(214,196,164,0.55)'); hg.addColorStop(1, storm ? 'rgba(190,160,118,0.3)' : 'rgba(190,165,125,0.12)');
      ctx.globalAlpha = 1; ctx.fillStyle = hg; ctx.fillRect(a - 1, gy - D - 1, b - a + 6, D + 2); ctx.restore();
    }
    // wheel-worn lanes and the sand-drifted near edge
    ctx.lineCap = 'butt';
    for (const [dy, lw, col] of [[D * 0.3, 0.5, 'rgba(70,60,46,0.16)'], [D * 0.7, 0.6, 'rgba(70,60,46,0.16)'], [D, 0.14, 'rgba(236,212,166,0.8)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      for (let x = a; x < b; x += st) ctx.lineTo(x, T.height(x) - dy);
      ctx.lineTo(b, T.height(b) - dy); ctx.stroke();
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
