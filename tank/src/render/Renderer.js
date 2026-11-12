// Canvas2D renderer for the vertical slice (sky, parallax dunes, deformable terrain, vehicle rig,
// projectiles, particles). WebGL2 post (heat haze, bloom, thermal) is planned for M5.
DS.Renderer = class Renderer {
  constructor(canvas, world) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.w = world;
    this.img = {}; this.mips = {}; this.linkBuf = []; this.pathBuf = []; this.offs = new Map();
    this.noise = this.makeNoise();
  }
  load(def) {
    const id = def.id, Sp = def.sprites;
    this.img[id] = this.img[id] || {};
    const names = new Set(['hull', 'turret', 'barrel', Sp.roadwheel.file, Sp.idler.file]);
    if (Sp.flag) names.add(Sp.flag.file);
    if (Sp.roller) names.add(Sp.roller.file);
    if (Sp.m2) names.add(Sp.m2.file);
    if (Sp.tow) { names.add(Sp.tow.file); names.add(Sp.tow.file + '_xray'); }   // outline made by tools/cut_bradley.py
    if (!Sp.sprocket.procedural) names.add('sprocket');
    else { const c = this.makeSprocket(def); this.img[id].sprocket = c; this.mips[id + '/sprocket'] = this.buildMips(c); }
    return Promise.all([...names].map(n => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => { this.img[id][n] = im; this.mips[id + '/' + n] = this.buildMips(im); res(); };
      im.onerror = () => rej(new Error('sprite ' + id + '/' + n));
      im.src = def.src.dir + n + '.png';
    })));
  }
  // drive sprocket drawn from its tooth count (used where the drawing's sprocket is hidden by track)
  makeSprocket(def) {
    const N = def.sprocket.teeth, S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), R = S / 2 - 2, root = R * 0.8;
    x.translate(S / 2, S / 2);
    x.beginPath();
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, w = Math.PI * 2 / N;
      x.lineTo(Math.cos(a0 - w * 0.5) * root, Math.sin(a0 - w * 0.5) * root);
      x.lineTo(Math.cos(a0 - w * 0.2) * R, Math.sin(a0 - w * 0.2) * R);
      x.lineTo(Math.cos(a0 + w * 0.2) * R, Math.sin(a0 + w * 0.2) * R);
      x.lineTo(Math.cos(a0 + w * 0.5) * root, Math.sin(a0 + w * 0.5) * root);
    }
    x.closePath(); x.fillStyle = '#c9a56c'; x.fill(); x.lineWidth = 5; x.strokeStyle = '#2a241c'; x.stroke();
    x.beginPath(); x.arc(0, 0, root * 0.78, 0, 7); x.fillStyle = '#b8945d'; x.fill(); x.stroke();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; x.beginPath(); x.ellipse(Math.cos(a) * root * 0.5, Math.sin(a) * root * 0.5, root * 0.17, root * 0.11, a, 0, 7); x.fillStyle = '#2b251d'; x.fill(); }
    x.beginPath(); x.arc(0, 0, root * 0.28, 0, 7); x.fillStyle = '#d3b07a'; x.fill(); x.stroke();
    return c;
  }
  // halving chain so heavily minified sprites (wheels at battle zoom) stay smooth
  buildMips(im) {
    const out = [im]; let src = im, w = im.width, h = im.height;
    while (w > 24 && h > 24) {
      w = Math.ceil(w / 2); h = Math.ceil(h / 2);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, w, h);
      out.push(c); src = c;
    }
    return out;
  }
  pick(key, screenW) {                // smallest level still >= on-screen width
    const m = this.mips[key]; let i = 0;
    while (i + 1 < m.length && m[i + 1].width >= screenW) i++;
    return m[i];
  }
  makeStreaks() {                      // horizontal wind streaks, light and dark, laid flat (screen-space texture)
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d'), r = DS.rng(17);
    for (let i = 0; i < 140; i++) {
      const y = Math.floor(r() * 64), w = 30 + r() * 220, px = r() * 512, l = r() < 0.5;
      x.fillStyle = l ? `rgba(255,236,200,${0.10 + r() * 0.14})` : `rgba(90,60,30,${0.08 + r() * 0.12})`;
      for (const o of [0, -512]) x.fillRect(px + o, y, w, 1);
    }
    return c;
  }
  // pebbles, stones and dry scrub lying on the ground plane. Each has a depth d (0 = at the surface line, far;
  // 1 = close to us): closer ones sit lower on screen, are bigger, and slide past faster (parallax).
  groundProps(ctx, cam, low, storm) {
    const T = this.w.terrain, H = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    const D = 7, cell = 0.9, spread = 1 + 0.45;
    const u0 = cam.x + (cam.left - cam.x) * 1.0 - 4, u1 = cam.x + (cam.right - cam.x) * 1.0 + 4;
    const i0 = Math.floor((cam.x - (cam.x - u0)) / cell), i1 = Math.ceil(u1 / cell);
    const pz = Math.max(0.5, 2.2 / cam.zoom);
    // gravel pans and paler drift patches lying flat on the plane
    for (let j = Math.floor((cam.left - 20) / 9); j <= (cam.right + 20) / 9; j++) {
      if (H(j + 5.5) > 0.55) continue;
      const d = H(j + 6.1), par = 1 + 0.45 * d, u = (j + H(j + 6.7)) * 9, x = cam.x + (u - cam.x) * par;
      const w = (2 + 7 * H(j + 7.3)) * (0.6 + d), hh = (0.12 + 0.3 * H(j + 7.9)) * (0.5 + d * 1.6), y = T.height(x) - 0.4 - d * D;
      const pg = ctx.createRadialGradient(x, y, 0, x, y, w);
      const dark = H(j + 8.3) < 0.6;
      pg.addColorStop(0, dark ? 'rgba(112,82,50,0.16)' : 'rgba(255,240,210,0.14)'); pg.addColorStop(1, 'rgba(112,82,50,0)');
      ctx.save(); ctx.translate(x, y); ctx.scale(1, hh / w); ctx.translate(-x, -y); ctx.fillStyle = pg; ctx.fillRect(x - w, y - w, w * 2, w * 2); ctx.restore();
    }
    for (let i = i0; i <= i1; i++) {
      const r = H(i);
      if (r > 0.42) continue;
      const d = H(i + 0.37), par = 1 + 0.45 * d, u = (i + H(i + 0.71)) * cell;
      const x = cam.x + (u - cam.x) * par;
      if (x < cam.left - 2 || x > cam.right + 2) continue;
      if (T.sink[T.idx(x)] > 0.02 && d < 0.15) continue;           // pressed into the ruts
      const y = T.height(x) - 0.25 - d * D, sz = (0.06 + 0.3 * H(i + 0.13) * H(i + 0.29)) * (0.6 + d * 1.8);
      if (sz < pz * 0.5) continue;
      const kind = H(i + 0.91);
      if (kind < 0.16) { continue;                                // dry desert scrub: replaced by the plant sprites (src/render/Flora.js)
        ctx.strokeStyle = storm ? 'rgba(110,86,58,0.6)' : 'rgba(110,92,64,0.7)'; ctx.lineWidth = Math.max(pz * 0.5, sz * 0.07);
        ctx.beginPath(); const hh = sz * 2.6;
        for (let k = 0; k < 9; k++) { const a = -1.1 + k * 0.275 + Math.sin(i + k) * 0.12, l = hh * (0.6 + 0.4 * H(i + k)); ctx.moveTo(x + Math.sin(a) * l * 0.2, y); ctx.quadraticCurveTo(x + Math.sin(a) * l * 0.5, y + l * 0.7, x + Math.sin(a) * l, y + Math.cos(a) * l); }
        ctx.stroke();
      } else {                                                    // stone: dark body, sunlit top, small shadow
        const w = sz * (1 + H(i + 0.53)), hgt = sz * 0.55;
        ctx.fillStyle = 'rgba(70,50,30,0.35)'; ctx.beginPath(); ctx.ellipse(x - 0.4 * w * (low + 0.3), y - hgt * 0.2, w * 1.2, hgt * 0.35, 0, 0, 7); ctx.fill();
        ctx.fillStyle = kind < 0.5 ? '#8a6c4a' : '#9b8264'; ctx.beginPath(); ctx.ellipse(x, y + hgt * 0.3, w, hgt, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,236,200,0.35)'; ctx.beginPath(); ctx.ellipse(x + w * 0.15, y + hgt * 0.65, w * 0.6, hgt * 0.35, 0, 0, 7); ctx.fill();
      }
    }
  }
  // wind ripples on the sand plane: wavy, branching crests, lit on one side and shaded on the other
  makeRipples() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'), r = DS.rng(23);
    for (let row = 0; row < 26; row++) {
      const y0 = row * (256 / 26) + r() * 4, ph = r() * 6.28, amp = 2 + r() * 3, f = 2 + Math.floor(r() * 3);
      for (const [dy, col, lw] of [[0, 'rgba(96,66,34,0.20)', 1.6], [-1.8, 'rgba(255,238,205,0.20)', 1.3]]) {
        x.strokeStyle = col; x.lineWidth = lw; x.beginPath();
        for (let px = 0; px <= 512; px += 8) { const y = y0 + dy + Math.sin(px / 512 * 6.283 * f + ph) * amp + Math.sin(px / 512 * 6.283 * (f * 3 + 1) + ph * 2) * amp * 0.25; px ? x.lineTo(px, y) : x.moveTo(px, y); }
        x.stroke();
      }
    }
    return c;
  }
  makeNoise() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const d = x.createImageData(128, 128), r = DS.rng(3);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = r(); const k = v < 0.5 ? 0 : 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = k; d.data[i + 3] = r() < 0.35 ? 22 : 0;
    }
    x.putImageData(d, 0, 0); return c;
  }

  // draw the world with camera `cam` into ctx. opt.main: the main view (labels, debug, sight line)
  frame(ctx = this.ctx, cam = this.w.cam, opt = { main: true }) {
    const w = this.w;
    this.cam = cam; this.opt = opt;
    if (opt.thermal) return this.thermalFrame(ctx, cam, opt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.sky(ctx, cam);
    cam.apply(ctx);
    this.backGround(ctx, cam);
    this.flora(ctx, cam, 'back');
    this.props(ctx, cam, false);
    this.buildings(ctx, cam);
    w.particles.draw(ctx, cam, 0);
    for (const v of w.vehicles) if (cam.visible(v.pos.x, v.pos.y, 14) && this.shown(v)) this.vehicle(ctx, v, cam);
    this.terrain(ctx, cam);
    for (const b of w.buildings) if (b.drawFront) b.drawFront(ctx, cam, null, this);
    this.flora(ctx, cam, 'line'); this.flora(ctx, cam, 'near');
    this.props(ctx, cam, true);
    this.fog(ctx, cam);
    this.traces(ctx, cam);
    w.fx.drawCases(ctx);
    this.projectiles(ctx, cam);
    w.particles.draw(ctx, cam, 1);
    this.atmosphere(ctx, cam, opt);
    w.fx.drawFlashes(ctx);
    if (opt.main) {
      this.sightLine(ctx, cam);
      if (w.debug) DS.Debug.draw(ctx, w);
      this.labels(ctx, cam);
    }
    this.markers(ctx, cam, !!opt.main);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- thermal picture (gunner's sight only): drawn from temperatures, not colours — paint, markings and
  // flags vanish; hulls are flat grey at their own temperature with engines, exhausts, running gear, hot gun
  // tubes and fires glowing. Automatic gain follows the hottest thing in view, so a fire darkens the rest. ----
  thermalFrame(ctx, cam, opt) {
    const w = this.w, T = w.terrain, th = DS.Thermal, amb = th.ambient(w), me = w.vehicles[0];
    const vis = w.vehicles.filter(v => cam.visible(v.pos.x, v.pos.y, 14) && this.shown(v));
    let peak = 0.7; for (const v of vis) peak = Math.max(peak, th.peak(v));
    this.agc = this.agc ? this.agc + (peak - this.agc) * 0.08 : peak;
    const adj = w.tisAdj || { level: 0, gain: 1 };
    // automatic gain: the window sits on the ground temperature and stretches up to the hottest thing in view
    const lo = Math.max(amb.sky + 0.03, amb.ground - 0.2) + adj.level, hi = lo + (Math.max(amb.ground + 0.3, this.agc * 0.95) - lo) / adj.gain;
    const lum = t => Math.round(255 * Math.pow(Math.max(0, Math.min(1, (t - lo) / (hi - lo))), 0.8));
    const tg = (t, a = 1) => { const c = lum(t); return `rgba(${c},${c},${c},${a})`; };
    const W = cam.W * cam.dpr, H = cam.H * cam.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sg = ctx.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, tg(amb.sky)); sg.addColorStop(1, tg(amb.sky + 0.06));
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    cam.apply(ctx);
    const pg = k => { const c = lum(amb.ground - 0.05 + k * 0.08); return `${c},${c},${c}`; };   // buildings: a little cooler than the sand
    this.backGround(ctx, cam, tg(amb.ground - 0.015));
    { const fg = k => { const c = lum(amb.ground + k); return `${c},${c},${c}`; }; this.flora(ctx, cam, 'back', fg); this._fg = fg; }
    this.props(ctx, cam, false, pg);
    this.buildings(ctx, cam, pg);
    // ground: one temperature, sun-facing slopes a little warmer by day, fresh craters warm
    const x0 = cam.left - 1, x1 = cam.right + 1, bot = cam.bottom - 1, step = Math.max(T.dx, 1.5 / cam.zoom);
    ctx.beginPath(); ctx.moveTo(x0, bot);
    for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, T.height(x));
    ctx.lineTo(x1 + step, bot); ctx.closePath(); ctx.fillStyle = tg(amb.ground); ctx.fill();
    ctx.save(); ctx.clip();
    const cs = Math.max(T.dx, 2 / cam.zoom), sun = (w.env || {}).sun;
    for (let x = x0; x <= x1; x += cs) {
      const i = T.idx(x), h = T.h[i];
      let d = 0.1 * Math.max(0, T.disturb[i] - 0.3);           // fresh crater earth (not crust breaks)
      if (sun && !(w.env || {}).night) d += Math.max(-0.03, Math.min(0.03, (T.height(x + 0.6) - T.height(x - 0.6)) / 1.2 * sun.side * 0.06));
      if (Math.abs(d) > 0.004) { ctx.fillStyle = tg(amb.ground + d); ctx.fillRect(x, h - 0.7, cs + 0.01, 0.7); }
    }
    ctx.restore();
    for (const b of w.buildings) if (b.drawFront) b.drawFront(ctx, cam, pg, this);
    this.flora(ctx, cam, 'line', this._fg); this.flora(ctx, cam, 'near', this._fg);
    this.props(ctx, cam, true, pg);
    for (const v of vis) this.thermalVehicle(ctx, v, cam, amb, tg);
    this.thermalParticles(ctx, cam, amb, lum);
    this.projectiles(ctx, cam);
    w.fx.drawFlashes(ctx);
    // fires bloom out the detector
    ctx.globalCompositeOperation = 'lighter';
    for (const v of vis) if (v.burning) {
      const f = v.fireSource(), R = 7, g = ctx.createRadialGradient(f.x, f.y + 1, 0, f.x, f.y + 1, R);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(f.x - R, f.y + 1 - R, R * 2, R * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    // the air between us and the view: contrast fades with range (dust shortens it)
    if (me) {
      const R = Math.abs(cam.x - me.pos.x), a = 1 - Math.exp(-R / amb.att);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = tg(amb.ground - 0.02, a * 0.85); ctx.fillRect(0, 0, W, H);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  thermalVehicle(ctx, v, cam, amb, tg) {
    const cv = ctx.canvas, store = this.tOffs || (this.tOffs = new Map());
    let off = store.get(cv);
    if (!off || off.width !== cv.width || off.height !== cv.height) { off = document.createElement('canvas'); off.width = cv.width; off.height = cv.height; store.set(cv, off); }
    const o = off.getContext('2d'), m = ctx.getTransform(), z = Math.hypot(m.a, m.b);
    const pts = [v.pos]; if (v.turretBody) pts.push(v.turretBody);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { const sx = m.a * p.x + m.c * p.y + m.e, sy = m.b * p.x + m.d * p.y + m.f, h = 7.5 * z; x0 = Math.min(x0, sx - h); y0 = Math.min(y0, sy - h); x1 = Math.max(x1, sx + h); y1 = Math.max(y1, sy + h); }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(cv.width, Math.ceil(x1)); y1 = Math.min(cv.height, Math.ceil(y1));
    if (x1 <= x0 || y1 <= y0) return;
    const hull = DS.Thermal.hull(v, amb);
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.clearRect(x0, y0, x1 - x0, y1 - y0);
    o.setTransform(m); this.drawVehicle(o, v, cam);
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-in'; o.fillStyle = tg(hull); o.fillRect(x0, y0, x1 - x0, y1 - y0);
    o.globalCompositeOperation = 'source-atop';
    o.setTransform(m); o.globalAlpha = 0.12; this.drawVehicle(o, v, cam); o.globalAlpha = 1;   // faint panel structure (emissivity)
    for (const [x, y, r, t] of DS.Thermal.spots(v)) {
      const g = o.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, tg(hull + t)); g.addColorStop(1, tg(hull + t, 0));
      o.fillStyle = g; o.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const gh = v.heat ? v.heat.gun : 0;
    if (gh > 0.03 && !v.turretGone) {
      const tp = v.local(v.g.trunnion.x, v.g.trunnion.y), mz = v.muzzle();
      o.strokeStyle = tg(hull + gh * 0.65, 0.9); o.lineWidth = 0.22; o.beginPath(); o.moveTo(tp.x, tp.y); o.lineTo(mz.x, mz.y); o.stroke();
    }
    o.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(off, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); ctx.restore();
  }
  thermalParticles(ctx, cam, amb, lum) {
    const P = this.w.particles, K = DS.P, spr = c => P.sprite((c << 16) | (c << 8) | c);
    for (let i = 0; i < P.n; i++) {
      const k = P.kind[i];
      if (k === K.GRAIN || k === K.HEAT) continue;
      const sz = P.size[i]; if (!cam.visible(P.x[i], P.y[i], sz)) continue;
      const t = P.life[i] / P.ttl[i];
      if (k === K.DEBRIS) { const c = lum(0.9 * (1 - t) + amb.ground * t); ctx.globalAlpha = 1 - t; ctx.fillStyle = `rgb(${c},${c},${c})`; ctx.fillRect(P.x[i] - sz / 2, P.y[i] - sz / 2, sz, sz); continue; }
      let T, a;
      if (k === K.SPARK) continue;
      if (k === K.FIRE) { T = 1.4; a = P.alpha[i] * (1 - t) * (1 - t); }
      else if (k === K.FLAME) { T = amb.ground + 0.2 + 1.2 * Math.max(0, 1 - t / 0.34); a = P.alpha[i] * (1 - t); }
      else if (k === K.DARK) { T = amb.ground + 0.14 * (1 - t); a = P.alpha[i] * 0.7 * Math.min(1, t * 8) * (1 - t); }
      else if (k === K.SMOKE) { T = amb.ground + 0.07 * (1 - t); a = P.alpha[i] * 0.5 * Math.min(1, t * 8) * (1 - t); }
      else { T = amb.ground - 0.02; a = P.alpha[i] * 0.45 * Math.min(1, t * 8) * (1 - t); }   // dust: thermal sees through most of it
      if (a < 0.004) continue;
      ctx.globalAlpha = a; ctx.drawImage(spr(lum(T)), P.x[i] - sz, P.y[i] - sz, sz * 2, sz * 2);
    }
    ctx.globalAlpha = 1;
  }

  // armour marks (Effects.mark), in the vehicle's unmirrored hull frame, metres
  marks(ctx, v, part) {
    if (!v.marks) return;
    for (const m of v.marks) {
      if (m.part !== part) continue;
      const r = m.size, rnd = k => { const s = Math.sin(m.seed * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
      ctx.save(); ctx.translate(m.x, m.y);
      // soot around the strike (wide for a shaped charge)
      const sr = r * (m.heat ? 5 : 2.5), sg = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
      sg.addColorStop(0, `rgba(18,13,9,${m.heat ? 0.75 : 0.45})`); sg.addColorStop(1, 'rgba(18,13,9,0)');
      ctx.fillStyle = sg; ctx.beginPath();
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, rr = sr * (0.55 + 0.45 * rnd(k)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }   // ragged star
      ctx.closePath(); ctx.fill();
      if (m.kind === 'hole') {
        ctx.fillStyle = '#0a0806'; ctx.beginPath();
        for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, rr = r * (0.8 + 0.4 * rnd(k + 20)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(190,160,120,0.85)'; ctx.lineWidth = r * 0.18;          // torn edges curling in
        for (let k = 0; k < 6; k++) { const a = rnd(k + 40) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); ctx.lineTo(Math.cos(a + 0.25) * r * 0.55, Math.sin(a + 0.25) * r * 0.55); ctx.stroke(); }
      } else if (m.kind === 'dent') {
        const g = ctx.createRadialGradient(-r * 0.3, r * 0.3, r * 0.1, 0, 0, r * 1.4);       // dished in: dark bowl, lit rim
        g.addColorStop(0, 'rgba(40,30,22,0.9)'); g.addColorStop(0.7, 'rgba(70,55,40,0.7)'); g.addColorStop(0.9, 'rgba(230,205,160,0.7)'); g.addColorStop(1, 'rgba(230,205,160,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.rotate(m.ang + (rnd(60) - 0.5) * 0.5);
        const L = m.kind === 'scrape' ? r * 7 : r * 3.5;
        ctx.strokeStyle = m.kind === 'scrape' ? 'rgba(235,225,205,0.9)' : 'rgba(30,22,16,0.9)'; ctx.lineWidth = m.kind === 'scrape' ? r * 0.25 : r * 0.55;
        ctx.beginPath(); ctx.moveTo(-L * 0.2, 0); ctx.lineTo(L, 0); ctx.stroke();
        if (m.kind === 'gouge') { ctx.strokeStyle = 'rgba(225,215,195,0.8)'; ctx.lineWidth = r * 0.15; ctx.beginPath(); ctx.moveTo(-L * 0.2, r * 0.3); ctx.lineTo(L, r * 0.3); ctx.stroke(); }
      }
      ctx.restore();
    }
  }

  // ---- what the player's crew has found (src/ai/Sensor.js) ----
  // enemies are drawn only while in sight and detected; wrecks always
  shown(v) {
    const me = this.w.vehicles[0];
    if (!me || v.team === me.team || !v.alive || this.w.showAll) return true;
    return DS.Sensor.seenNow(me, v);
  }

  // Ground the player cannot search: beyond the sights' reach, and the dead ground behind crests (from the
  // sight down to the line of sight grazing the highest crest so far). Night / dust bring it closer.
  fog(ctx, cam) {
    const me = this.w.vehicles[0], T = this.w.terrain;
    if (!me || !me.alive || !me.contacts) return;
    const env = this.w.env || {}, reach = DS.Sensor.reach(this.w, me), o = me.sightOrigin();
    // drawn into a layer at 1/10 of the screen and stretched back: the edges melt into the view, and the
    // hidden ground looks veiled in pale haze (dark at night) instead of painted over
    const DS_ = 10, cv = ctx.canvas, fw = Math.ceil(cv.width / DS_) + 2, fh = Math.ceil(cv.height / DS_) + 2;
    let L = this.fogL && this.fogL.get(cv);
    if (!this.fogL) this.fogL = new Map();
    if (!L || L.width !== fw || L.height !== fh) { L = document.createElement('canvas'); L.width = fw; L.height = fh; this.fogL.set(cv, L); }
    const f = L.getContext('2d'), m = ctx.getTransform();
    f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, fw, fh);
    f.setTransform(m.a / DS_, m.b / DS_, m.c / DS_, m.d / DS_, m.e / DS_ + 1, m.f / DS_ + 1);
    const step = Math.max(1, 12 / cam.zoom), top = cam.top + 4, bot = cam.bottom - 4;
    let any = false;
    f.fillStyle = '#fff';
    for (const side of [1, -1]) {
      const xs = side > 0 ? Math.max(o.x, cam.left) : Math.min(o.x, cam.right), xe = side > 0 ? cam.right + step * 2 : cam.left - step * 2;
      if ((xe - o.x) * side <= 0) continue;
      let slope = -1e9, x = o.x + side * 2;
      // crests between us and the screen edge, sampled coarsely
      for (; (xs - x) * side > 0; x += side * Math.max(2, step)) slope = Math.max(slope, (T.height(x) - o.y) / Math.abs(x - o.x));
      for (; (xe - x) * side > 0; x += side * step) {
        const dx = Math.abs(x - o.x), h = T.height(x);
        const a = Math.max(0, Math.min(1, (dx - reach * 0.8) / (reach * 0.2)));
        const yl = o.y + slope * dx;                            // grazing line of sight over the crests
        if (a > 0) { f.globalAlpha = a; f.fillRect(Math.min(x, x + side * step), bot, step * 1.02, top - bot); any = true; }
        // dead ground behind a crest: the pocket under the grazing line (not every crater pit)
        if (a < 1 && yl > h + 0.35) { f.globalAlpha = 1 - a; f.fillRect(Math.min(x, x + side * step), h - 1.2, step * 1.02, yl - h + 1.6); any = true; }
        slope = Math.max(slope, (h - o.y) / dx);
      }
    }
    if (!any) return;
    // tint the mask, then lay it over the picture twice: a wide soft veil and a denser core, drifting slowly
    f.setTransform(1, 0, 0, 1, 0, 0); f.globalAlpha = 1; f.globalCompositeOperation = 'source-in';
    f.fillStyle = env.night ? 'rgb(14,18,30)' : env.visibility ? 'rgb(176,146,104)' : 'rgb(214,203,182)';
    f.fillRect(0, 0, fw, fh); f.globalCompositeOperation = 'source-over';
    const dr = Math.sin(this.w.time * 0.23) * 6 * cam.dpr;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = env.night ? 0.6 : 0.5; ctx.drawImage(L, -DS_ + dr, -DS_, fw * DS_, fh * DS_);
    ctx.globalAlpha = env.night ? 0.35 : 0.3; ctx.drawImage(L, -DS_ * 1.6 - dr, -DS_ * 1.3, fw * DS_ * 1.012, fh * DS_ * 1.012);
    ctx.restore();
  }

  // contact markers above detected enemies, last-known positions, and brackets on the selected target.
  // Main view: everything. Gunner's sight: only the brackets.
  markers(ctx, cam, main) {
    const me = this.w.vehicles[0], g = window.__game;
    if (!me || !me.contacts) return;
    const sel = g && g.target, dpr = cam.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = (x, y) => [(x - cam.x - cam.sx) * cam.zoom + cam.W / 2, -(y - cam.y - cam.sy) * cam.zoom + cam.H / 2];
    ctx.textAlign = 'center'; ctx.lineWidth = 2;
    for (const [b, c] of me.contacts) {
      if (!b.alive || c.seen < -1e8) continue;
      const now = c.los && c.d >= 1, lvl = c.d >= 2 ? 2 : 1;
      const px = now ? b.pos.x : c.x, py = now ? b.pos.y : c.y;
      const [sx, sy] = S(px, py + 3.6);
      if (sx < -80 || sx > cam.W + 80 || sy < -40 || sy > cam.H + 40) continue;
      const isSel = b === sel;
      if (isSel && now) {                                      // corner brackets round the vehicle
        const [x0, y0] = S(px - 4.4, py + 2.9), [x1, y1] = S(px + 4.4, py - 1.6), k = Math.max(6, (x1 - x0) * 0.22);
        ctx.strokeStyle = '#ff5a3c'; ctx.beginPath();
        for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { ctx.moveTo(cx + dx * k, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * k); }
        ctx.stroke();
      }
      if (!main) continue;
      const txt = now ? (lvl === 2 ? `${b.def.name}  ${Math.round(c.range)} m` : `?  ${Math.round(c.range)} m`) : '?  마지막 위치';
      ctx.font = `${isSel ? 700 : 600} 12px 'Share Tech Mono', ui-monospace, monospace`;
      ctx.fillStyle = !now ? 'rgba(200,200,200,0.75)' : isSel ? '#ff7a5c' : lvl === 2 ? '#ffd27a' : '#e8e2d0';
      ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(txt, sx, sy); ctx.fillText(txt, sx, sy);
      ctx.beginPath(); ctx.moveTo(sx - 5, sy + 4); ctx.lineTo(sx + 5, sy + 4); ctx.lineTo(sx, sy + 10); ctx.closePath(); ctx.fill();
    }
  }

  sightLine(ctx, cam) {
    const v = this.w.vehicles[0]; if (!v || !v.alive) return;
    const o = v.sightOrigin(), a = v.gun.aimW, L = 400;
    ctx.save(); ctx.setLineDash([6 / cam.zoom, 6 / cam.zoom]); ctx.lineWidth = 1.2 / cam.zoom; ctx.strokeStyle = 'rgba(255,60,40,0.55)';
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + Math.cos(a) * L, o.y + Math.sin(a) * L); ctx.stroke(); ctx.restore();
    const p = v.fc.point;
    if (p && this.w.time - v.fc.lasedAt < 3) { ctx.strokeStyle = 'rgba(255,60,40,0.9)'; ctx.lineWidth = 2 / cam.zoom; ctx.beginPath(); ctx.arc(p.x, p.y, 8 / cam.zoom, 0, 7); ctx.stroke(); }
  }

  labels(ctx, cam) {
    const dpr = cam.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.font = '700 13px system-ui, sans-serif';
    const tag = { pen: ['관통', '#ff5a4a'], ricochet: ['도탄', '#ffd34a'], nonpen: ['비관통', '#f2f2f2'], track: ['궤도 피격', '#ffa04a'] };
    for (const l of this.w.fx.labels) {
      const [txt, col] = tag[l.r.result] || ['', '#fff'];
      const sx = (l.x - cam.x - cam.sx) * cam.zoom + cam.W / 2, sy = -(l.y + l.t * 0.6 - cam.y - cam.sy) * cam.zoom + cam.H / 2 - 18;
      if (sx < -50 || sx > cam.W + 50 || sy < -20 || sy > cam.H + 20) continue;
      ctx.globalAlpha = Math.min(1, 4 - l.t);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(txt, sx, sy); ctx.fillStyle = col; ctx.fillText(txt, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  // night darkness, blowing dust thickening with distance from our tank, thermal sight
  atmosphere(ctx, cam, opt) {
    const env = this.w.env || {}, W = cam.W * cam.dpr, H = cam.H * cam.dpr, me = this.w.vehicles[0];
    const night = (env.night || 0) * (opt.thermal ? 0 : 1);
    if (!night && !env.visibility && !opt.thermal) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (env.visibility && me) {
      const V = env.visibility * (opt.thermal ? 4 : 1), base = opt.thermal ? 0.05 : 0.2;
      const a = d => 1 - (1 - base) * Math.exp(-Math.abs(d) / V), col = night ? '40,34,28' : '200,164,112';
      if (opt.main) {
        const xs = cam.left, xe = cam.right, px = Math.max(xs, Math.min(xe, me.pos.x));
        const gr = ctx.createLinearGradient(0, 0, W, 0);
        gr.addColorStop(0, `rgba(${col},${a(xs - me.pos.x)})`);
        gr.addColorStop((px - xs) / (xe - xs), `rgba(${col},${a(0)})`);
        gr.addColorStop(1, `rgba(${col},${a(xe - me.pos.x)})`);
        ctx.fillStyle = gr;
      } else ctx.fillStyle = `rgba(${col},${a(cam.x - me.pos.x)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (night) { ctx.fillStyle = `rgba(4,8,22,${0.86 * night})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    if (night) {                                   // light sources stay bright in the dark
      ctx.globalCompositeOperation = 'lighter';
      this.w.particles.draw(ctx, cam, 1, DS.P.FIRE);
      ctx.globalCompositeOperation = 'source-over';
      this.projectiles(ctx, cam);
    }
    if (opt.thermal) {                             // running engines and fires show hot
      ctx.globalCompositeOperation = 'lighter';
      for (const v of this.w.vehicles) {
        const hot = v.alive ? 1 : v.burning ? 1.4 : Math.max(0, 0.6 - (this.w.time - (v.diedAt || 0)) / 300);
        if (hot <= 0 || !cam.visible(v.pos.x, v.pos.y, 12)) continue;
        for (const [lx, ly, r, k] of [[v.g.exhaust.x + v.dir * 0.6, v.g.exhaust.y - 0.2, 2.2, 0.55], [0, -0.2, 3.4, 0.22], [v.g.sprocket.x, v.g.sprocket.y, 0.8, 0.3]]) {
          const p = v.local(lx, ly), gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          gr.addColorStop(0, `rgba(255,255,255,${k * hot})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gr; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // Background (sky, sun, clouds, far dunes): soft by nature, so it is painted at half resolution into a cached
  // canvas and only repainted when the view has moved (or clouds have drifted) since the last paint.
  sky(ctx, cam) {
    const W = cam.W * cam.dpr, H = cam.H * cam.dpr, env = this.w.env || {}, th = this.opt && this.opt.thermal;
    const key = [Math.round(cam.x * 10), Math.round(cam.y * 10), Math.round(cam.zoom), Math.floor(this.w.time * 2), W, H, th ? 1 : 0, env.night, env.visibility, env.sun ? env.sun.el * env.sun.side : 0].join();
    const store = this.bgs || (this.bgs = new Map());
    let bg = store.get(ctx.canvas);
    if (!bg) { bg = { c: document.createElement('canvas'), key: '' }; store.set(ctx.canvas, bg); }
    if (bg.key !== key) {
      bg.key = key; bg.c.width = Math.max(1, Math.round(W / 2)); bg.c.height = Math.max(1, Math.round(H / 2));
      const half = Object.assign({}, cam); half.dpr = cam.dpr / 2;
      this.skyPaint(bg.c.getContext('2d'), half);
    }
    ctx.imageSmoothingQuality = 'low'; ctx.drawImage(bg.c, 0, 0, W, H);
  }
  skyPaint(ctx, cam) {
    const W = cam.W * cam.dpr, H = cam.H * cam.dpr;
    const env = this.w.env || {}, g = ctx.createLinearGradient(0, 0, 0, H);
    if (this.opt && this.opt.thermal) {             // thermal: the sky is cold and featureless
      g.addColorStop(0, '#1a1a1a'); g.addColorStop(1, '#3a3a3a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return;
    }
    if (env.visibility) { g.addColorStop(0, '#b98d5a'); g.addColorStop(0.55, '#d8b07a'); g.addColorStop(1, '#e2c08c'); }
    else { g.addColorStop(0, '#3f78bd'); g.addColorStop(0.3, '#7da9d6'); g.addColorStop(0.52, '#c3d6e2'); g.addColorStop(0.75, '#ecdcbc'); g.addColorStop(1, '#e8cf9f'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (env.night) {
      const n = ctx.createLinearGradient(0, 0, 0, H); n.addColorStop(0, '#05070f'); n.addColorStop(1, '#141826');
      ctx.globalAlpha = env.night; ctx.fillStyle = n; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      if (!this.stars) { const r = DS.rng(9); this.stars = Array.from({ length: 160 }, () => [r(), r() * 0.6, r()]); }
      ctx.fillStyle = '#dfe6ff';
      for (const [x, y, b] of this.stars) { ctx.globalAlpha = 0.3 + 0.6 * b; ctx.fillRect(((x * W - cam.x * cam.dpr * 0.02) % W + W) % W, y * H, 1.5 * cam.dpr, 1.5 * cam.dpr); }
      ctx.globalAlpha = 1;
      return;
    }
    // ---- daylight sky: palette from the sun's height, sun disc and glow, high cirrus ----
    const sun = env.sun || { el: 35, side: 1 }, low = Math.max(0, Math.min(1, (25 - sun.el) / 15)), storm = env.visibility ? 1 : 0;
    const sx = W * (0.5 + 0.32 * sun.side), sy = H * Math.max(0.08, 0.47 - sun.el / 75);
    if (!storm && low > 0) {                       // low morning sun: warm band along the horizon
      const wg = ctx.createLinearGradient(0, H * 0.25, 0, H * 0.62);
      wg.addColorStop(0, 'rgba(255,200,140,0)'); wg.addColorStop(1, `rgba(255,196,140,${0.45 * low})`);
      ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
    }
    let sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.55);
    sg.addColorStop(0, storm ? 'rgba(255,235,200,0.75)' : 'rgba(255,250,232,1)'); sg.addColorStop(0.035, storm ? 'rgba(255,225,180,0.45)' : `rgba(255,${238 - 30 * low},${200 - 60 * low},0.75)`);
    sg.addColorStop(0.25, `rgba(255,${225 - 40 * low},${180 - 70 * low},${storm ? 0.18 : 0.22})`); sg.addColorStop(1, 'rgba(255,220,180,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    if (!storm) {                                  // thin cirrus, drifting very slowly with the view
      if (!this.clouds) { const r = DS.rng(5); this.clouds = Array.from({ length: 9 }, () => ({ x: r(), y: 0.06 + r() * 0.22, w: 0.12 + r() * 0.22, h: 0.006 + r() * 0.01, a: 0.12 + r() * 0.18 })); }
      ctx.save();
      for (const c of this.clouds) {
        const cx = ((c.x * W * 1.6 - cam.x * cam.dpr * 0.01 + this.w.time * 3) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3;
        const cg = ctx.createRadialGradient(cx, c.y * H, 0, cx, c.y * H, c.w * W);
        cg.addColorStop(0, `rgba(255,${246 - 30 * low},${236 - 50 * low},${c.a})`); cg.addColorStop(1, 'rgba(255,245,235,0)');
        ctx.setTransform(1, 0, 0, c.h / c.w * 6, 0, c.y * H * (1 - c.h / c.w * 6)); ctx.fillStyle = cg; ctx.fillRect(cx - c.w * W, c.y * H - c.w * W, c.w * W * 2, c.w * W * 2);
      }
      ctx.restore();
    }
    if (!storm) {
      // cumulus: heaps of lumpy puffs with flat bases, lit from the sun's side, drifting slowly; a few faint
      // shafts of light fan down from the sun through the haze
      const PS = this.w.particles, R5 = n => { const v = Math.sin(n * 91.7 + 13.3) * 43758.5453; return v - Math.floor(v); };
      const span = W * 1.8, warm = low > 0.3 ? 0xffe2c0 : 0xfdfbf6;
      // a soft glare spreading below the sun rather than hard shafts
      { const cg = ctx.createRadialGradient(sx, sy, 0, sx, sy + H * 0.25, H * 0.55); cg.addColorStop(0, 'rgba(255,240,215,0.10)'); cg.addColorStop(1, 'rgba(255,240,215,0)'); ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H); }
      for (let i = 0; i < 8; i++) {
        // each cloud: a flat-bottomed heap of many small puffs, densest and tallest in the middle, the top lit and
        // the underside greyer; far ones smaller, paler and slower
        const far = 0.4 + 0.6 * R5(i + 20), cw = W * (0.1 + 0.2 * R5(i)) * far, by = H * (0.12 + 0.24 * R5(i + 10));
        const cx = ((R5(i + 30) * span - cam.x * cam.dpr * 0.012 * far + this.w.time * 2.2 * far) % span + span) % span - W * 0.4;
        if (cx + cw < 0 || cx - cw > W) continue;
        for (let k = 0; k < 26; k++) {
          const u = R5(i * 31 + k), e = Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2)), r = cw * (0.05 + 0.1 * e) * (0.7 + 0.6 * R5(i * 5 + k * 3));
          const px = cx + (u - 0.5) * cw * 1.6, py = by - r * 0.3 - e * cw * 0.16 * R5(i * 7 + k);
          const lit = py < by - cw * 0.06;
          ctx.globalAlpha = (0.32 + 0.4 * far) * (lit ? 1 : 0.8);
          ctx.drawImage(PS.puff(lit ? warm : 0xc9cdd6, k & 3), px - r, py - r * 0.62, r * 2, r * 1.24);
        }
      }
      ctx.globalAlpha = 1;
    }
    // ---- parallax dunes: asymmetric (long windward slope, short slip face), far layers fade into the haze,
    // faces turned to the sun lit, faces turned away shaded ----
    const hz = H * 0.5 + (cam.y - 14) * cam.zoom * cam.dpr * 0.04;
    const haze = storm ? [214, 176, 122] : [236 - 10 * low, 222 - 12 * low, 196 - 10 * low], sand = storm ? [196, 156, 104] : [204, 170, 116];
    const dune = (t) => { t = ((t % 1) + 1) % 1; const u = t < 0.72 ? t / 0.72 : 1 - (t - 0.72) / 0.28; return u * u * (3 - 2 * u); };
    // far rocky range behind the dunes: a jagged ridge, blue-violet with distance, sunlit flanks
    if (!storm) {
      const N1 = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
      const vn = x => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return N1(i) + (N1(i + 1) - N1(i)) * s; };
      const ridge = (wx, k) => 0.55 * vn(wx / 900 + k) + 0.3 * vn(wx / 260 + k * 3) + 0.15 * vn(wx / 70 + k * 7);
      for (const [f, hgt, col, lit] of [[0.006, 0.17, [150, 152, 176], 0.25], [0.012, 0.11, [176, 160, 158], 0.35]]) {
        const pts = [];
        for (let x = -8; x <= W + 8; x += 8) { const wx = (x - W / 2) / cam.dpr * 1.6 + cam.x * f * 8 + 4000; const r = ridge(wx, f * 1000); pts.push([x, hz + H * 0.02 - H * hgt * Math.max(0, r - 0.32) * 1.9]); }
        ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.moveTo(-8, H);
        for (const [x, y] of pts) ctx.lineTo(x, y);
        ctx.lineTo(W + 8, H); ctx.closePath(); ctx.fill();
        const sg3 = ctx.createLinearGradient(-8, 0, W + 8, 0);
        for (let i = 2; i < pts.length; i += 2) { const sl = (pts[i - 2][1] - pts[i][1]) / 16 * sun.side, a = Math.max(-1, Math.min(1, sl * 1.2)); sg3.addColorStop((pts[i][0] + 8) / (W + 16), a > 0 ? `rgba(255,232,200,${(lit * a).toFixed(3)})` : `rgba(60,56,90,${(-lit * a).toFixed(3)})`); }
        ctx.fillStyle = sg3; ctx.beginPath(); ctx.moveTo(-8, H); for (const [x, y] of pts) ctx.lineTo(x, y); ctx.lineTo(W + 8, H); ctx.closePath(); ctx.fill();
      }
    }
    const layers = [[0.02, 0.85, 0.03, 30, 3200], [0.05, 0.68, 0.05, 55, 2300], [0.10, 0.5, 0.07, 80, 1700], [0.18, 0.32, 0.085, 105, 1300], [0.30, 0.16, 0.1, 125, 1000]];
    for (const [f, fog, amp, base, lam] of layers) {
      const fogK = storm ? Math.min(1, fog * 1.25 + 0.15) : fog;
      const col = sand.map((c, i) => Math.round(c + (haze[i] - c) * fogK));
      const pts = [], px = 1 / cam.dpr;
      for (let x = -8; x <= W + 8; x += 6) {
        // far layers keep their shape whatever the zoom: x is in screen pixels, only the pan moves them
        const wx = (x - W / 2) * px * (0.6 + f * 2) + cam.x * f * 8;
        const y = hz + base * cam.dpr * 0.4 - amp * H * (0.25 + 0.55 * dune(wx / lam + f * 7) + 0.25 * dune(wx / (lam * 0.43) + f * 3) + 0.04 * Math.sin(wx * 0.05));
        pts.push([x, y]);
      }
      ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.moveTo(-8, H);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(W + 8, H); ctx.closePath(); ctx.fill();
      // sun / shade on each facet as one horizontal gradient over a band under the crest line
      const kk = (1 - fogK) * (storm ? 0.4 : 1);
      if (kk > 0.05) {
        const sg2 = ctx.createLinearGradient(-8, 0, W + 8, 0), d = (16 + 46 * (1 - fogK)) * cam.dpr;
        for (let i = 1; i < pts.length; i += 2) {
          const [xa, ya] = pts[i - 1], [, yb] = pts[i], sl = (ya - yb) / 6 * sun.side, a = Math.max(-1, Math.min(1, sl * 1.4)) * kk;
          sg2.addColorStop((xa + 8) / (W + 16), a > 0 ? `rgba(255,${238 - 30 * low},${205 - 50 * low},${(0.34 * a).toFixed(3)})` : `rgba(96,66,36,${(-0.3 * a).toFixed(3)})`);
        }
        ctx.fillStyle = sg2; ctx.beginPath();
        pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + d);
        ctx.closePath(); ctx.fill();
      }
      if (f >= 0.1) {                              // crest highlight line on the nearer layers
        ctx.strokeStyle = `rgba(255,240,210,${0.25 * kk})`; ctx.lineWidth = cam.dpr; ctx.beginPath();
        pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      }
      if (f === 0.05 && !storm) this.farProps(ctx, cam, pts, f, col, px);
    }
    // haze where the land meets the sky
    const hg = ctx.createLinearGradient(0, hz - H * 0.1, 0, hz + H * 0.05);
    hg.addColorStop(0, `rgba(${haze},0)`); hg.addColorStop(0.7, `rgba(${haze},${storm ? 0.35 : 0.22})`); hg.addColorStop(1, `rgba(${haze},0)`);
    ctx.fillStyle = hg; ctx.fillRect(0, hz - H * 0.1, W, H * 0.15);
  }

  // far silhouettes on a mid layer: a line of telegraph poles and the odd burnt-out hulk
  farProps(ctx, cam, pts, f, col, px) {
    const W = cam.W * cam.dpr, dk = `rgba(${col.map(c => Math.round(c * 0.72))})`;
    ctx.fillStyle = dk; ctx.strokeStyle = dk; ctx.lineWidth = Math.max(1, cam.dpr);
    const sc = px * (0.6 + f * 2), span = 40, wx0 = (-W / 2) * sc + cam.x * f * 8, wx1 = (W / 2) * sc + cam.x * f * 8;
    const toX = wx => (wx - cam.x * f * 8) / sc + W / 2;
    const yAt = x => { const i = Math.max(0, Math.min(pts.length - 1, Math.round((x + 8) / 6))); return pts[i][1]; };
    let prev = null;
    for (let k = Math.floor(wx0 / span) - 1; k <= wx1 / span + 1; k++) {
      const x = toX(k * span), y = yAt(x), hgt = 9 * cam.dpr;
      ctx.fillRect(x - 0.5 * cam.dpr, y - hgt, cam.dpr, hgt); ctx.fillRect(x - 2.5 * cam.dpr, y - hgt, 5 * cam.dpr, 0.8 * cam.dpr);
      if (prev) { ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.quadraticCurveTo((prev[0] + x) / 2, (prev[1] + y - hgt) / 2 + 3 * cam.dpr, x, y - hgt); ctx.stroke(); }
      prev = [x, y - hgt];
      const r = Math.abs(Math.sin(k * 91.7) * 43758.5) % 1;
      if (r < 0.12) { const hx = toX(k * span + 17); const hy = yAt(hx); ctx.beginPath(); ctx.moveTo(hx - 7 * cam.dpr, hy); ctx.lineTo(hx - 5 * cam.dpr, hy - 3 * cam.dpr); ctx.lineTo(hx + 2 * cam.dpr, hy - 3.5 * cam.dpr); ctx.lineTo(hx + 6 * cam.dpr, hy); ctx.fill(); }
    }
  }


  // Land behind the drive line (no physics): the original surface, a little higher and paler as it recedes.
  // Craters and ruts cut into the playing surface reveal it as their far wall.
  backGround(ctx, cam, flat) {
    const T = this.w.terrain, x0 = cam.left - 1, x1 = cam.right + 1, bot = cam.bottom - 1, step = Math.max(0.4, 3 / cam.zoom), up = 0.32;
    const env = this.w.env || {}, storm = env.visibility ? 1 : 0, gy = T.height0(cam.x);
    ctx.beginPath(); ctx.moveTo(x0, bot);
    for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, T.height0(x) + up);
    ctx.lineTo(x1 + step, bot); ctx.closePath();
    if (flat) { ctx.fillStyle = flat; ctx.fill(); return; }
    const g = ctx.createLinearGradient(0, gy + up, 0, gy - 5);
    g.addColorStop(0, storm ? '#dcbd8d' : '#e6cc9f'); g.addColorStop(0.2, storm ? '#cfa878' : '#d6b07a'); g.addColorStop(1, storm ? '#b08a58' : '#b88c58');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(120,92,58,0.35)'; ctx.lineWidth = Math.max(0.01, 1 / cam.zoom); ctx.beginPath();
    for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, T.height0(x) + up);
    ctx.stroke();
  }

  terrain(ctx, cam) {
    const T = this.w.terrain, x0 = cam.left - 1, x1 = cam.right + 1, bot = cam.bottom - 1;
    const step = Math.max(T.dx, 1.5 / cam.zoom);
    ctx.beginPath(); ctx.moveTo(x0, bot);
    for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, T.height(x));
    ctx.lineTo(x1 + step, bot); ctx.closePath();
    const gy = T.height(cam.x), env = this.w.env || {}, sun = env.sun || { el: 35, side: 1 };
    const low = Math.max(0, Math.min(1, (25 - sun.el) / 15)), storm = env.visibility ? 1 : 0;
    // ground plane receding toward the viewer: hazed and pale at the far edge (the surface line), warmer and
    // more saturated close to us
    const g = ctx.createLinearGradient(0, gy + 0.5, 0, gy - 16);
    g.addColorStop(0, storm ? '#d9b886' : `rgb(${226 + 6 * low},${196 - 4 * low},${150 - 14 * low})`);
    g.addColorStop(0.25, storm ? '#c9a274' : '#d0a670'); g.addColorStop(1, storm ? '#a8814f' : '#ab7d4a');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    this.road(ctx, cam, x0, x1);
    // wind streaks and grain on the plane: textures laid in screen space (no resampling) and scrolled with the
    // camera, so they cost a plain pattern fill
    if (!this.streaks) this.streaks = this.makeStreaks();
    if (!this.ripples) this.ripples = this.makeRipples();
    {
      const m = ctx.getTransform(), ox = -(cam.x + cam.sx) * cam.zoom * cam.dpr, oy = (cam.y + cam.sy) * cam.zoom * cam.dpr;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const ps = ctx.createPattern(this.streaks, 'repeat'), pn = ctx.createPattern(this.noise, 'repeat');
      ps.setTransform(new DOMMatrix([1, 0, 0, 1, ox % 512, oy % 64])); pn.setTransform(new DOMMatrix([1, 0, 0, 1, ox % 128, oy % 128]));
      const sy = Math.max(0, m.d * (gy + 1) + m.f);                // screen y of the surface, roughly
      ctx.globalAlpha = 0.35; ctx.fillStyle = ps; ctx.fillRect(0, sy, ctx.canvas.width, ctx.canvas.height - sy);
      if (!storm) { const pr = ctx.createPattern(this.ripples, 'repeat'); pr.setTransform(new DOMMatrix([1, 0, 0, 1, ox % 512, oy % 256])); ctx.globalAlpha = 0.5; ctx.fillStyle = pr; ctx.fillRect(0, sy, ctx.canvas.width, ctx.canvas.height - sy); }
      ctx.globalAlpha = 0.6; ctx.fillStyle = pn; ctx.fillRect(0, sy, ctx.canvas.width, ctx.canvas.height - sy);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    // soil band + ruts + disturbed earth along the surface, and sun / shade by slope
    const cs = Math.max(T.dx, 2 / cam.zoom);
    const band = 0.35;
    // soil colour band under the surface: one stroked line per run of the same soil
    {
      let run = -1; ctx.globalAlpha = 0.5; ctx.lineWidth = band; ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      for (let x = x0; x <= x1 + cs; x += cs * 2) {
        const i = T.idx(x), so = T.soil[i];
        if (so !== run) { if (run >= 0) { ctx.lineTo(x, T.h[i] - band / 2); ctx.stroke(); } run = so; ctx.strokeStyle = DS.SOILS[so].col[0]; ctx.beginPath(); ctx.moveTo(x, T.h[i] - band / 2); }
        else ctx.lineTo(x, T.h[i] - band / 2);
      }
      if (run >= 0) ctx.stroke();
    }
    for (let x = x0; x <= x1; x += cs) {
      const i = T.idx(x), h = T.h[i];
      const sk = T.sink[i];
      if (sk > 0.003) { ctx.globalAlpha = Math.min(0.55, sk * 7); ctx.fillStyle = '#6e5232'; ctx.fillRect(x, h - 0.16, cs + 0.01, 0.16);
        ctx.globalAlpha = Math.min(0.5, sk * 5); ctx.fillStyle = '#4a3820'; for (let k = 0; k < 2; k++) ctx.fillRect(x, h - 0.05 - k * 0.07, cs * 0.45, 0.025); }
      const hl = T.h[i] - T.hard[i];                          // hard layer laid bare at the bottom of a crater
      if (hl < 0.12) { ctx.globalAlpha = 0.75 * (1 - hl / 0.12); ctx.fillStyle = '#8c7a62'; ctx.fillRect(x, h - 0.5, cs + 0.01, 0.5); }
      const di = T.disturb[i];
      if (di > 0.02) { ctx.globalAlpha = di * 0.5; ctx.fillStyle = '#9b7547'; ctx.fillRect(x, h - 0.6, cs + 0.01, 0.6); }
    }
    ctx.globalAlpha = 1;
    // sun / shade by slope: one gradient across the screen over a band under the surface line
    {
      const sg = ctx.createLinearGradient(x0, 0, x1, 0), n = Math.min(160, Math.ceil((x1 - x0) * cam.zoom / 8));
      for (let k = 0; k <= n; k++) {
        const x = x0 + (x1 - x0) * k / n, sl = (T.height(x + 0.6) - T.height(x - 0.6)) / 1.2 * sun.side;
        const lit = Math.max(-1, Math.min(1, sl * 2.2)) * (storm ? 0.35 : 1);
        sg.addColorStop(k / n, lit >= 0 ? `rgba(255,${236 - 20 * low},${196 - 40 * low},${(0.34 * lit).toFixed(3)})` : `rgba(100,70,38,${(-0.34 * lit).toFixed(3)})`);
      }
      ctx.fillStyle = sg; ctx.beginPath();
      for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, T.height(x) + 0.02);
      for (let x = x1 + step; x >= x0 - step; x -= step * 2) ctx.lineTo(x, T.height(x) - 1.1);
      ctx.closePath(); ctx.fill();
    }
    this.groundProps(ctx, cam, low, storm);
    // shadows go inside the ground clip: their top edge is exactly the surface, and they must not
    // touch the surface-line path built below (they used to replace it, outlining the shadow instead)
    this.shadows(ctx, cam);
    ctx.restore();
    // crisp surface line, with wind ripples (a few cm, drawn only — the physics surface is unchanged)
    const rip = cam.zoom > 18 ? 0.018 : 0, rs = rip ? Math.min(step, 0.05) : step;
    ctx.beginPath();
    for (let x = x0; x <= x1 + rs; x += rs) {
      const y = T.height(x) + (rip && T.soil[T.idx(x)] <= 1 && T.sink[T.idx(x)] < 0.004 ? rip * (Math.sin(x * 21) * 0.7 + Math.sin(x * 47 + 1.3) * 0.3) : 0);
      if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    // thin ink edge on the ground surface (matches the outlined art), with a sunlit lip just under it
    ctx.save(); ctx.translate(0, -1.6 / cam.zoom);
    ctx.strokeStyle = 'rgba(250,232,195,0.55)'; ctx.lineWidth = 1.2 / cam.zoom; ctx.stroke(); ctx.restore();
    ctx.strokeStyle = 'rgba(64,46,26,0.85)'; ctx.lineWidth = Math.max(0.012, 1.3 / cam.zoom); ctx.lineJoin = 'round'; ctx.stroke();
  }

  // Contact shadow on the ground under each hull and thrown turret. In side view the ground plane runs
  // toward the viewer below the surface line, so the shadow is a soft band just under it, offset away from
  // the sun (upper right) and fading out to the sides.
  // Cast shadows. In the side view the ground plane runs toward the viewer below the surface line, so each
  // vehicle's real silhouette (hull, wheels, turret, gun, antennas, thrown turret) is sheared onto that strip:
  // a point h metres up lands kx·h along the line (away from the sun) and ky·h down onto the near ground.
  // Low parts stay sharp, high parts spread (two passes with different blur); a dark contact band under the
  // tracks gives the occlusion where hull meets sand. Low morning sun: long shadows; dust: faint and diffuse.
  shadows(ctx, cam) {
    const env = this.w.env || {}, T = this.w.terrain, sun = (env.night || 0) > 0.5 ? null : env.sun;
    // light sources: the sun, or at night every fire (burning wreck) lighting vehicles near it
    const lights = [];
    if (sun) lights.push({ el: sun.el, side: sun.side, k: env.visibility ? 0.32 : 1, diffuse: env.visibility ? 1 : 0 });
    else for (const f of this.w.vehicles) if (f.burning > 0.5) lights.push({ fire: f, el: 18, diffuse: 0 });
    if (!lights.length) return;
    for (const L of lights) this.castShadows(ctx, cam, L);
  }
  castShadows(ctx, cam, Lt) {
    const T = this.w.terrain, diffuse = Lt.diffuse;
    const cot = 1 / Math.tan(Math.max(8, Lt.el) * Math.PI / 180);
    const ky = 0.33;
    // every silhouette of this light goes, sheared onto the ground plane, into one layer at 1/3 of the screen
    // (1/8 in dust); the layer is tinted once and stretched back, which is what softens the edges
    const m = ctx.getTransform(), cv = ctx.canvas, q = diffuse ? 8 : 2.5;
    const lw = Math.ceil(cv.width / q), lh = Math.ceil(cv.height / q);
    if (!this.shOff) this.shOff = new Map();
    let off = this.shOff.get(cv);
    if (!off) { off = document.createElement('canvas'); this.shOff.set(cv, off); }
    if (off.width !== lw || off.height !== lh) { off.width = lw; off.height = lh; }
    const o = off.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, lw, lh);
    o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
    const lcam = Object.assign(Object.create(Object.getPrototypeOf(cam)), cam); lcam.zoom = cam.zoom / 1.5;    // sprite levels a step down are enough for a silhouette
    const bands = [];
    let n = 0;
    for (const v of this.w.vehicles) {
      if (!cam.visible(v.pos.x, v.pos.y, 18) || !this.shown(v)) continue;
      let side = Lt.side, k = Lt.k;
      if (Lt.fire) {                                            // firelight: falls off with distance, flickers
        if (Lt.fire === v) continue;
        const d = Math.abs(v.pos.x - Lt.fire.pos.x);
        if (d > 45) continue;
        side = Math.sign(Lt.fire.pos.x - v.pos.x) || 1;
        k = Math.min(1, Lt.fire.burning / 3) * (1 - d / 45) * (0.8 + 0.2 * Math.sin(this.w.time * 11 + d));
      }
      const kx = -side * Math.min(3, cot * 0.55), y0 = T.height(v.pos.x);
      o.setTransform(m.a / q, m.b / q, m.c / q, m.d / q, m.e / q, m.f / q); o.transform(1, 0, kx, -ky, -kx * y0, y0 * (1 + ky));
      o.globalAlpha = Math.max(0, Math.min(1, k));
      this.drawVehicle(o, v, lcam); n++;
      if (!Lt.fire && !v.heli) bands.push([v.pos.x, Math.abs((v.g.idler.x - v.g.sprocket.x) * v.dir) / 2 + 0.25]);
    }
    if (this.shadowExtra) n += this.shadowExtra(o, m, q, Lt, cam) || 0;      // scenery that casts into the same layer
    if (!n) return;
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.globalCompositeOperation = 'source-in'; o.fillStyle = '#281a0c'; o.fillRect(0, 0, lw, lh);
    o.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // two half-strength copies a little apart: a soft penumbra without a blur filter
    const a = diffuse ? 0.34 : 0.46, d = q * 0.9;
    ctx.globalAlpha = a * 0.62; ctx.drawImage(off, 0, 0, lw, lh, -d, 0, lw * q, lh * q);
    ctx.globalAlpha = a * 0.62; ctx.drawImage(off, 0, 0, lw, lh, d, d * 0.5, lw * q, lh * q);
    ctx.restore();
    // contact occlusion right under the tracks keeps the foot of the shadow dark and crisp
    for (const [cx, half] of bands) {
      const x0 = cx - half, x1 = cx + half, nn = 14, a = 0.42 * (diffuse ? 0.6 : 1);
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, 'rgba(40,26,12,0)'); g.addColorStop(0.12, `rgba(40,26,12,${a})`);
      g.addColorStop(0.88, `rgba(40,26,12,${a})`); g.addColorStop(1, 'rgba(40,26,12,0)');
      ctx.fillStyle = g; ctx.beginPath();
      for (let i = 0; i <= nn; i++) { const x = x0 + (x1 - x0) * i / nn; ctx.lineTo(x, T.height(x) + 0.5); }
      for (let i = nn; i >= 0; i--) { const x = x0 + (x1 - x0) * i / nn, t = Math.sin(Math.PI * i / nn); ctx.lineTo(x, T.height(x) - 0.16 * (0.4 + 0.6 * t)); }
      ctx.closePath(); ctx.fill();
    }
  }

  vehicle(ctx, v, cam) {
    const me = this.w.vehicles[0];
    const faint = me && v.alive && v.team !== me.team && DS.Sensor.level(me, v) < 2;   // contact, not yet identified
    if (v.scorch.length || v.burning || faint) this.charred(ctx, v, cam, faint ? 0.38 : 1);
    else this.drawVehicle(ctx, v, cam);
  }

  // Damaged vehicle: drawn to an offscreen layer, then char marks are painted 'source-atop' so they
  // stay inside the vehicle's own silhouette and spread outward from where they started.
  charred(ctx, v, cam, alpha = 1) {
    const cv = ctx.canvas;
    let off = this.offs.get(cv);
    if (!off || off.width !== cv.width || off.height !== cv.height) { off = document.createElement('canvas'); off.width = cv.width; off.height = cv.height; this.offs.set(cv, off); }
    const o = off.getContext('2d'), m = ctx.getTransform(), z = Math.hypot(m.a, m.b);
    const pts = [v.pos]; if (v.turretBody) pts.push(v.turretBody);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) {
      const sx = m.a * p.x + m.c * p.y + m.e, sy = m.b * p.x + m.d * p.y + m.f, h = 7.5 * z;
      x0 = Math.min(x0, sx - h); y0 = Math.min(y0, sy - h); x1 = Math.max(x1, sx + h); y1 = Math.max(y1, sy + h);
    }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(cv.width, Math.ceil(x1)); y1 = Math.min(cv.height, Math.ceil(y1));
    if (x1 <= x0 || y1 <= y0) return;
    o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(x0, y0, x1 - x0, y1 - y0);
    o.setTransform(m);
    this.drawVehicle(o, v, cam);
    o.globalCompositeOperation = 'source-atop';
    // overall soot builds up slowly the longer it burns
    const all = Math.min(0.55, (v.burning || 0) / 50 + (v.wreck ? 0.12 : 0));
    if (all > 0) { o.save(); o.setTransform(1, 0, 0, 1, 0, 0); o.fillStyle = `rgba(16,12,9,${all})`; o.fillRect(x0, y0, x1 - x0, y1 - y0); o.restore(); }
    const t = this.w.time;
    for (const sp of v.scorch) {
      const p = v.spotWorld(sp), r = Math.min(sp.max, 0.3 + sp.t * 0.085), a = Math.min(0.93, 0.3 + sp.t * 0.035);
      const g = o.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.5);
      g.addColorStop(0, `rgba(12,9,7,${a})`); g.addColorStop(0.55, `rgba(22,16,11,${a * 0.85})`); g.addColorStop(1, 'rgba(30,22,14,0)');
      o.fillStyle = g; o.fillRect(p.x - r * 1.5, p.y - r * 1.5, r * 3, r * 3);
      if (v.burning) {                       // glowing paint and metal at the edge of the burn
        const k = 0.18 + 0.12 * Math.sin(t * 9 + sp.lx * 3);
        const e = o.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r * 0.9);
        e.addColorStop(0, `rgba(255,120,40,${k})`); e.addColorStop(1, 'rgba(255,90,20,0)');
        o.fillStyle = e; o.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
    }
    o.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; if (alpha < 1) ctx.filter = 'grayscale(0.7) blur(1px)';
    ctx.drawImage(off, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); ctx.restore();
  }

  drawVehicle(ctx, v, cam) {
    if (v.heli) return this.drawHeli(ctx, v, cam);
    const D = v.def, S = D.src, I = this.img[D.id], px = 1 / S.ppm, dir = v.dir, id = D.id, Sp = D.sprites;
    // ---- hull frame: underside shadow ----
    ctx.save(); ctx.translate(v.pos.x, v.pos.y); ctx.rotate(v.ang); ctx.scale(dir, 1);
    const U = D.underside;
    const OS = D.openSide;                 // no skirts: the hull side shows, painted, with the suspension on it
    ctx.fillStyle = OS ? OS.col : '#2b251d'; ctx.beginPath();
    if (U.poly) { U.poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); }
    else { ctx.moveTo(U.x0, U.y0); ctx.lineTo(U.x1, U.y0); ctx.lineTo(U.x1 - 0.2, U.y1); ctx.lineTo(U.x0 + 0.3, U.y1); }
    ctx.closePath(); ctx.fill();
    if (D.rearFill) { const R = D.rearFill; ctx.fillRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0); }
    if ((v.dust || 0) > 0.03) { ctx.fillStyle = `rgba(205,172,122,${(Math.min(1, v.dust) * 0.4).toFixed(2)})`; ctx.fill(); }
    if (D.sprocketHole) { ctx.beginPath(); ctx.arc(D.sprocket.x, D.sprocket.y, D.sprocketHole, 0, 7); ctx.fill(); }
    if (OS) {
      // shade under the fender, darker toward the belly, a weld seam and the bolted final-drive housing
      const g = ctx.createLinearGradient(0, U.y0, 0, U.y1);
      g.addColorStop(0, 'rgba(20,14,6,0.55)'); g.addColorStop(0.22, 'rgba(20,14,6,0.12)'); g.addColorStop(0.7, 'rgba(20,14,6,0.18)'); g.addColorStop(1, 'rgba(20,14,6,0.5)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(30,22,10,0.55)'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(U.x0 + 0.5, U.y0 - 0.34); ctx.lineTo(U.x1 - 0.5, U.y0 - 0.34); ctx.stroke();
      ctx.fillStyle = OS.dark; ctx.strokeStyle = OS.ink; ctx.lineWidth = 0.025;
      ctx.beginPath(); ctx.arc(D.sprocket.x, D.sprocket.y, 0.26, 0, 7); ctx.fill(); ctx.stroke();
      // return-roller brackets
      for (const r of D.returnRollers) { ctx.beginPath(); ctx.moveTo(r.x - 0.07, r.y + 0.02); ctx.lineTo(r.x + 0.07, r.y + 0.02); ctx.lineTo(r.x + 0.16, r.y - 0.3); ctx.lineTo(r.x - 0.16, r.y - 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
    if (OS) {
      // suspension in world space: each road-wheel arm swings on its hull pivot and follows the wheel's travel;
      // shock absorbers on the end stations; bump stops above the arms
      const P = (lx, ly) => v.local(lx, ly), line = (a, b, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
      ctx.lineCap = 'round';
      v.st.forEach((w, i) => {
        const pv = P(w.lx + dir * OS.arm[0], w.ly + OS.arm[1]), hub = { x: w.wx, y: w.wy };
        if (OS.shocks.includes(i)) {
          const top = P(w.lx + dir * OS.shock[0], w.ly + OS.shock[1]), mid = { x: hub.x + (pv.x - hub.x) * 0.25, y: hub.y + (pv.y - hub.y) * 0.25 };
          line(top, mid, 0.085, OS.ink); line(top, mid, 0.055, OS.dark);
          line({ x: (top.x + mid.x) / 2, y: (top.y + mid.y) / 2 }, mid, 0.035, '#b9b2a0');
        }
        line(pv, hub, 0.17, OS.ink); line(pv, hub, 0.125, OS.lit);
        ctx.fillStyle = OS.lit; ctx.strokeStyle = OS.ink; ctx.lineWidth = 0.025;
        ctx.beginPath(); ctx.arc(pv.x, pv.y, 0.115, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.ink; ctx.beginPath(); ctx.arc(pv.x, pv.y, 0.04, 0, 7); ctx.fill();
      });
      ctx.lineCap = 'butt';
    }

    // ---- track ----
    const circles = v.gearCircles();
    let path = DS.Track.buildPath(circles, this.pathBuf, circles.map(c => c.fixed));
    path = DS.Track.conformBottom(path, this.w.terrain, D.track.thick / 2, 0.25);
    v._trackPath = path;
    const info = DS.Track.links(path, D.track.pitch, v.s, this.linkBuf);
    const L = v.chain ? v.chain.L : info.pitch, th = D.track.thick, nl = this.linkBuf.length;
    let links = this.linkBuf;
    if (v.chain) {                                                   // cut track: draw the chain's links
      const P = v.chain.p; links = [];
      for (let i = 1; i < P.length; i++) links.push([(P[i].x + P[i - 1].x) / 2, (P[i].y + P[i - 1].y) / 2, Math.atan2(P[i - 1].y - P[i].y, P[i - 1].x - P[i].x)]);
    }
    // sand and dust picked up while driving: lightens the track, the wheels and the lower hull side
    const dustA = Math.min(1, v.dust || 0) * 0.6, dustC = '205,172,122';
    links.forEach(([x, y, a], i) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#26231f'; ctx.fillRect(-L * 0.5, -th * 0.5, L * 0.93, th);
      if (dustA > 0.02) { ctx.fillStyle = `rgba(${dustC},${(dustA * 0.75).toFixed(2)})`; ctx.fillRect(-L * 0.5, -th * 0.5, L * 0.93, th); }
      ctx.fillStyle = '#4a4540'; ctx.fillRect(-L * 0.5, -th * 0.5, L * 0.18, th);
      ctx.fillStyle = '#3a3631'; ctx.fillRect(-L * 0.25, th * 0.12, L * 0.6, th * 0.22);
      ctx.fillStyle = '#1d1b18'; ctx.fillRect(-L * 0.12, -th * 0.5 - 0.065, L * 0.28, 0.07);
      ctx.restore();
    });

    // ---- wheels ----
    const zpx = cam.zoom * cam.dpr;
    const wheel = (x, y, ang, r, name, tint) => {
      const im = this.pick(id + '/' + name, r * 2 * zpx), imr = im.width / 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); const k = r / imr; ctx.scale(k, -k);
      ctx.drawImage(im, -imr, -imr, imr * 2, imr * 2);
      if (tint) { ctx.globalAlpha = tint; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, imr, 0, 7); ctx.fill(); }
      if (dustA > 0.02) { ctx.globalAlpha = dustA; const dg = ctx.createRadialGradient(0, 0, imr * 0.2, 0, 0, imr * 0.98); dg.addColorStop(0, `rgba(${dustC},0.35)`); dg.addColorStop(0.75, `rgba(${dustC},0.8)`); dg.addColorStop(1, `rgba(${dustC},1)`); ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(0, 0, imr * 0.98, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.restore();
    };
    // return rollers turn with the track running over them
    if (Sp.roller) for (const r of v.g.rollers) { const q = v.local(r.x, r.y); wheel(q.x, q.y, -v.s / r.r, r.r, Sp.roller.file); }
    for (const w of v.st) wheel(w.wx, w.wy, w.ang, D.wheelR + 0.006, Sp.roadwheel.file);
    const ip = v.local(v.g.idler.x, v.g.idler.y);
    wheel(ip.x, ip.y, v.idlAng, D.idler.r + 0.02, Sp.idler.file, Sp.idler.tint);
    // sprocket: lock tooth phase to the links on its arc (teeth sit in the link joints)
    const sp = v.local(v.g.sprocket.x, v.g.sprocket.y), rc = v.sprR(), pitchA = 2 * Math.PI / D.sprocket.teeth;
    let best = null, bd = 1e9;
    for (const l of this.linkBuf) { const e = Math.abs(Math.hypot(l[0] - sp.x, l[1] - sp.y) - rc); if (e < bd) { bd = e; best = l; } }
    let sa = v.sprAng;
    if (best && bd < 0.05) {
      const joint = Math.atan2(best[1] - sp.y, best[0] - sp.x) + (L / 2) / rc;
      sa = joint - (Sp.sprocket.tooth0 || 0) * Math.PI / 180;
      sa -= Math.round((sa - v.sprAng) / pitchA) * pitchA;
    }
    wheel(sp.x, sp.y, sa, Sp.sprocket.R, 'sprocket');

    // ---- hull, then gun + turret (hull-local, source pixel frame, mirrored by dir) ----
    ctx.save(); ctx.translate(v.pos.x, v.pos.y); ctx.rotate(v.ang); ctx.scale(dir, 1);
    ctx.save(); ctx.scale(px, -px); ctx.drawImage(I.hull, Sp.hull.x - S.ox, Sp.hull.y - S.oy); ctx.restore();
    this.marks(ctx, v, 'hull');
    if (!v.turretGone) this.turret(ctx, v, v.gun.e, v.gun.rx, true);
    else {                                                        // open turret ring: blackened, glowing while it burns
      const r = D.turretRing, w2 = D.track.width * 1.9;
      ctx.fillStyle = '#120e0b'; ctx.beginPath(); ctx.ellipse(r[0], r[1] + 0.02, w2, 0.16, 0, 0, Math.PI * 2); ctx.fill();
      if (v.burning) { const g = ctx.createRadialGradient(r[0], r[1], 0, r[0], r[1], w2); g.addColorStop(0, `rgba(255,120,40,${0.5 + 0.2 * Math.sin(this.w.time * 9)})`); g.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(r[0], r[1] + 0.05, w2, 0.14, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    if (v.turretBody) {
      const b = v.turretBody, r = D.turretRing;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.scale(dir, 1); ctx.translate(-r[0], -r[1]);
      this.turret(ctx, v, b.e, 0, false);
      ctx.restore();
    }
  }

  // barrel + turret + antennas in the vehicle's unmirrored hull frame (metres)
  turret(ctx, v, e, rx, antennas) {
    const D = v.def, S = D.src, I = this.img[D.id], px = 1 / S.ppm, Sp = D.sprites, G = D.gun;
    ctx.save(); ctx.translate(G.trunnion[0], G.trunnion[1]); ctx.rotate(e); ctx.translate(rx, 0);
    ctx.scale(px, -px);
    const tpx = G.trunnion[0] * S.ppm + S.ox, tpy = S.oy - G.trunnion[1] * S.ppm;
    ctx.fillStyle = '#b89464'; ctx.fillRect(-40 * S.ppm / 149, -11 * S.ppm / 149, 110 * S.ppm / 149, 22 * S.ppm / 149);
    if (G.barrelScale) {                      // stretch the tube from its root to the real overall length
      const x0 = Sp.barrel.x - tpx; ctx.translate(x0, 0); ctx.scale(G.barrelScale, 1); ctx.translate(-x0, 0);
    }
    ctx.drawImage(I.barrel, Sp.barrel.x - tpx, Sp.barrel.y - tpy);
    ctx.restore();
    ctx.save(); ctx.scale(px, -px);
    const tw = Sp.tow && v.tow, tt = Sp.turret;
    // TOW launcher on the far side: drawn first, so the turret hides all of it but what rises above the roof
    const towPose = c => {             // raise on the lift arm, then follow the gun's elevation (pivot: rear lower corner)
      const T = D.tow, up = v.tow.up, pv = T.pivotPx;
      c.translate(pv[0], pv[1] - T.lift * S.ppm * up); c.rotate(-e * up); c.translate(-pv[0], -pv[1]);
    };
    if (tw) { ctx.save(); ctx.translate(-S.ox, -S.oy); towPose(ctx); ctx.drawImage(I[Sp.tow.file], Sp.tow.x, Sp.tow.y); ctx.restore(); }
    ctx.drawImage(I.turret, tt.x - S.ox, tt.y - S.oy);
    // X-ray: the launcher is always there on the far side — its outline shows through the turret (Z hides it)
    if (tw && I[Sp.tow.file + '_xray'] && this.w.xray !== false && !v.towBroken) {
      const im = I.turret, oc = this.xo || (this.xo = document.createElement('canvas'));
      if (oc.width !== im.width || oc.height !== im.height) { oc.width = im.width; oc.height = im.height; }
      const o = oc.getContext('2d');
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, oc.width, oc.height);
      o.translate(-tt.x, -tt.y); towPose(o); o.drawImage(I[Sp.tow.file + '_xray'], Sp.tow.x, Sp.tow.y);
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'destination-in'; o.drawImage(im, 0, 0);
      o.globalCompositeOperation = 'source-over';
      const pulse = 0.85 + 0.15 * Math.sin(this.w.time * 6);
      ctx.globalAlpha = pulse; ctx.drawImage(oc, tt.x - S.ox, tt.y - S.oy); ctx.drawImage(oc, tt.x - S.ox, tt.y - S.oy); ctx.globalAlpha = 1;
    }
    if (Sp.m2 && v.mg) {                    // commander's M2 on its mount, at its own elevation / arc
      const m = v.mg, pv = D.mg.pivotPx; ctx.save(); ctx.translate(pv[0] - S.ox, pv[1] - S.oy);
      if (m.side < 0) ctx.scale(-1, 1); ctx.rotate(-m.el);
      ctx.drawImage(I[Sp.m2.file], Sp.m2.x - pv[0], Sp.m2.y - pv[1]); ctx.restore();
    }
    if (Sp.flag && v.dir < 0) {             // un-mirror the national flag decal
      const f = I[Sp.flag.file], fx = Sp.flag.x - S.ox + f.width / 2;
      ctx.translate(fx, 0); ctx.scale(-1, 1); ctx.translate(-fx, 0); ctx.drawImage(f, Sp.flag.x - S.ox, Sp.flag.y - S.oy);
    }
    ctx.restore();
    this.marks(ctx, v, 'turret');
    if (!antennas) return;
    ctx.strokeStyle = '#2e2c29'; ctx.lineCap = 'round';
    (D.antennas || []).forEach((a, i) => {
      const phi = v.antennas[i].phi * v.dir, tx = a.x + Math.sin(phi) * a.len, ty = a.y + Math.cos(phi) * a.len;
      ctx.lineWidth = 0.028; ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(a.x + Math.sin(phi) * a.len * 0.25, a.y + a.len * 0.55, tx, ty); ctx.stroke();
      ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(a.x, a.y - 0.02); ctx.lineTo(a.x + Math.sin(phi) * 0.12, a.y + 0.16); ctx.stroke();
    });
  }

  projectiles(ctx, cam) {
    ctx.lineCap = 'round';
    for (const m of this.w.missiles) {                            // missile body + tail flare (always ≥ 2 px)
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.ang);
      ctx.fillStyle = '#3a3d34'; ctx.fillRect(-0.6, -0.076, 1.2, 0.152); ctx.fillStyle = '#22241f'; ctx.fillRect(-0.55, -0.2, 0.25, 0.4);
      ctx.restore();
      const r = Math.max(0.22, 2.2 / cam.zoom), bx = m.x - Math.cos(m.ang) * 0.6, by = m.y - Math.sin(m.ang) * 0.6;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r * 2.2);
      g.addColorStop(0, 'rgba(255,245,210,1)'); g.addColorStop(0.4, 'rgba(255,170,70,0.8)'); g.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(bx - r * 2.2, by - r * 2.2, r * 4.4, r * 4.4); ctx.globalCompositeOperation = 'source-over';
    }
    for (const p of this.w.projectiles) {
      if (p.ammo.small && !p.tracer) continue;                  // only tracer rounds are visible
      const v = Math.hypot(p.vx, p.vy), L = p.ammo.small ? Math.min(v * 0.012, 12) : Math.min(v * 0.025, 40);
      const g = ctx.createLinearGradient(p.x, p.y, p.x - p.vx / v * L, p.y - p.vy / v * L);
      g.addColorStop(0, p.ammo.tracer); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(0.06, 2 / cam.zoom);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / v * L, p.y - p.vy / v * L); ctx.stroke();
    }
  }
};
