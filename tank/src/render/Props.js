// Firing-range scenery (data/range.js): base buildings and barriers in depth layers, range signs, the road.
// Scenery only — nothing here collides. Layers behind the drive line are smaller, hazier and slide slower
// (parallax); the near row stands on the ground plane in front of the line.
Object.assign(DS.Renderer.prototype, {
  loadProps() {
    this.propImg = {}; this.propTint = {};
    return Promise.all(Object.keys(DS.RANGE.sprites).map(k => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => { this.propImg[k] = im; res(); };
      im.onerror = () => rej(new Error('sprite props/' + k));
      im.src = 'assets/sprites/props/' + k + '.png';
    })));
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
    const hz = storm ? '205,176,134' : '222,204,172';
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
      const x = cam.x + (p.x - cam.x) * par, wd = p.w * par, im = this.propImg[p.k], ht = wd * im.height / im.width;
      if (x + wd / 2 < cam.left || x - wd / 2 > cam.right) continue;
      const y = T.height(front ? x : p.x) + (front ? -0.25 - R.front * 7 : LIFT[p.z] * lift(x));
      let src = im;
      if (grey != null) src = this.propTinted(p.k, 't' + p.z, grey(front ? 0 : haze), 1);
      else if (haze || storm) src = this.propTinted(p.k, p.z, hz, Math.min(0.85, haze + storm * 0.25));
      if (front) {                                   // soft contact shadow on the ground plane
        ctx.fillStyle = grey != null ? 'rgba(0,0,0,0.12)' : 'rgba(60,40,20,0.28)';
        ctx.beginPath(); ctx.ellipse(x, y + 0.02, wd * 0.52, 0.22, 0, 0, 7); ctx.fill();
      }
      ctx.save(); ctx.translate(x, y); ctx.scale(1, -1); ctx.drawImage(src, -wd / 2, -ht * 0.985, wd, ht); ctx.restore();
    }
    if (!front) this.rangeSigns(ctx, cam, grey);
  },
  // range boards every 500 m from the firing line, and the firing-line board itself
  rangeSigns(ctx, cam, grey) {
    const T = this.w.terrain, R = DS.RANGE;
    const board = (x, txt, red) => {
      if (x < cam.left - 3 || x > cam.right + 3) return;
      const y = T.height(x) - 0.05, g = grey != null;
      ctx.fillStyle = g ? `rgb(${grey(0)})` : '#5b4a36'; ctx.fillRect(x - 0.95, y, 0.1, 2.5); ctx.fillRect(x + 0.85, y, 0.1, 2.5);
      ctx.fillStyle = g ? `rgb(${grey(0.1)})` : red ? '#b8322a' : '#f2eee2'; ctx.fillRect(x - 1.25, y + 1.55, 2.5, 1.0);
      if (g) return;
      ctx.strokeStyle = '#2a241c'; ctx.lineWidth = 0.05; ctx.strokeRect(x - 1.25, y + 1.55, 2.5, 1.0);
      if (cam.zoom < 5) return;
      ctx.save(); ctx.translate(x, y + 2.05); ctx.scale(0.01, -0.01);
      ctx.fillStyle = red ? '#fff' : '#1c1a16'; ctx.font = '700 62px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, 0, 4); ctx.restore();
    };
    board(R.line, '사격선', true);
    for (let d = 500; d <= 4500; d += 500) board(R.line + d, String(d), false);
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
