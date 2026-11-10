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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.sky(ctx, cam);
    cam.apply(ctx);
    w.particles.draw(ctx, cam, 0);
    for (const v of w.vehicles) if (cam.visible(v.pos.x, v.pos.y, 14) && this.shown(v)) this.vehicle(ctx, v, cam);
    this.terrain(ctx, cam);
    this.fog(ctx, cam);
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

  // ---- what the player's crew has found (src/ai/Sensor.js) ----
  // enemies are drawn only while in sight and detected; wrecks always
  shown(v) {
    const me = this.w.vehicles[0];
    if (!me || v.team === me.team || !v.alive) return true;
    return DS.Sensor.seenNow(me, v);
  }

  // Ground the player cannot search: beyond the sights' reach, and the dead ground behind crests (from the
  // sight down to the line of sight grazing the highest crest so far). Night / dust bring it closer.
  fog(ctx, cam) {
    const me = this.w.vehicles[0], T = this.w.terrain;
    if (!me || !me.alive || !me.contacts) return;
    const env = this.w.env || {}, reach = DS.Sensor.reach(this.w, me), o = me.sightOrigin();
    const col = env.night ? '6,8,14' : env.visibility ? '120,92,58' : '62,50,34', A = env.night ? 0.55 : 0.5;
    const step = Math.max(0.5, 5 / cam.zoom), top = cam.top + 2, bot = cam.bottom - 2;
    ctx.save();
    for (const side of [1, -1]) {
      const xs = side > 0 ? Math.max(o.x, cam.left) : Math.min(o.x, cam.right), xe = side > 0 ? cam.right + step : cam.left - step;
      if ((xe - o.x) * side <= 0) continue;
      let slope = -1e9, x = o.x + side * 2;
      // crests between us and the screen edge, sampled coarsely
      for (; (xs - x) * side > 0; x += side * Math.max(2, step)) slope = Math.max(slope, (T.height(x) - o.y) / Math.abs(x - o.x));
      for (; (xe - x) * side > 0; x += side * step) {
        const dx = Math.abs(x - o.x), h = T.height(x);
        const a = Math.max(0, Math.min(1, (dx - reach * 0.85) / (reach * 0.15)));
        const yl = o.y + slope * dx;                            // grazing line of sight over the crests
        if (a > 0) { ctx.fillStyle = `rgba(${col},${A * a})`; ctx.fillRect(Math.min(x, x + side * step), bot, step, top - bot); }
        // dead ground: the air pocket under the grazing line plus the hidden surface skin (not the soil section)
        if (a < 1 && yl > h + 0.05) { ctx.fillStyle = `rgba(${col},${A * (1 - a)})`; ctx.fillRect(Math.min(x, x + side * step), h - 0.8, step, yl - h + 0.8); }
        slope = Math.max(slope, (h - o.y) / dx);
      }
    }
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

  sky(ctx, cam) {
    const W = cam.W * cam.dpr, H = cam.H * cam.dpr;
    const env = this.w.env || {}, g = ctx.createLinearGradient(0, 0, 0, H);
    if (this.opt && this.opt.thermal) {             // thermal: the sky is cold and featureless
      g.addColorStop(0, '#1a1a1a'); g.addColorStop(1, '#3a3a3a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return;
    }
    if (env.visibility) { g.addColorStop(0, '#b98d5a'); g.addColorStop(0.55, '#d8b07a'); g.addColorStop(1, '#e2c08c'); }
    else { g.addColorStop(0, '#7fa6cc'); g.addColorStop(0.5, '#c9d3d4'); g.addColorStop(0.75, '#ecdcbc'); g.addColorStop(1, '#e8cf9f'); }
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
    // sun haze
    const sx = W * 0.78, sy = H * 0.18, sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.5);
    sg.addColorStop(0, 'rgba(255,250,230,0.95)'); sg.addColorStop(0.05, 'rgba(255,245,215,0.7)'); sg.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    // parallax dune silhouettes (far → near)
    const hz = H * 0.5 + (cam.y - 14) * cam.zoom * cam.dpr * 0.04;
    const layers = [[0.03, '#d9c9a6', 0.05, 40], [0.08, '#d6bf93', 0.09, 70], [0.18, '#cfb282', 0.14, 110]];
    for (const [f, col, amp, base] of layers) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        const wx = (x - W / 2) / (cam.zoom * cam.dpr) * f * 30 + cam.x * f;
        const y = hz + base * cam.dpr * 0.4 - amp * H * (0.5 + 0.35 * Math.sin(wx * 0.011 + f * 40) + 0.2 * Math.sin(wx * 0.037 + f * 9) + 0.08 * Math.sin(wx * 0.13));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.fill();
    }
  }

  terrain(ctx, cam) {
    const T = this.w.terrain, x0 = cam.left - 1, x1 = cam.right + 1, bot = cam.bottom - 1;
    const step = Math.max(T.dx, 1.5 / cam.zoom);
    ctx.beginPath(); ctx.moveTo(x0, bot);
    for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, T.height(x));
    ctx.lineTo(x1 + step, bot); ctx.closePath();
    const gy = T.height(cam.x);
    const g = ctx.createLinearGradient(0, gy + 2, 0, gy - 14);
    g.addColorStop(0, '#dcb983'); g.addColorStop(0.3, '#c99f68'); g.addColorStop(1, '#a87c4c');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    // grain texture
    ctx.globalAlpha = 0.8; ctx.fillStyle = ctx.createPattern(this.noise, 'repeat');
    ctx.save(); ctx.scale(0.02, 0.02); ctx.fillRect(x0 / 0.02, bot / 0.02, (x1 - x0) / 0.02, (gy + 30 - bot) / 0.02); ctx.restore();
    ctx.globalAlpha = 1;
    // soil band + ruts + disturbed earth along the surface
    const cs = Math.max(T.dx, 2 / cam.zoom);
    const band = 0.35;
    for (let x = x0; x <= x1; x += cs) {
      const i = T.idx(x), h = T.h[i], s = DS.SOILS[T.soil[i]];
      ctx.fillStyle = s.col[0]; ctx.globalAlpha = 0.55; ctx.fillRect(x, h - band, cs + 0.01, band);
      const sk = T.sink[i];
      if (sk > 0.003) { ctx.globalAlpha = Math.min(0.55, sk * 7); ctx.fillStyle = '#6e5232'; ctx.fillRect(x, h - 0.16, cs + 0.01, 0.16);
        ctx.globalAlpha = Math.min(0.5, sk * 5); ctx.fillStyle = '#4a3820'; for (let k = 0; k < 2; k++) ctx.fillRect(x, h - 0.05 - k * 0.07, cs * 0.45, 0.025); }
      const di = T.disturb[i];
      if (di > 0.02) { ctx.globalAlpha = di * 0.5; ctx.fillStyle = '#9b7547'; ctx.fillRect(x, h - 0.6, cs + 0.01, 0.6); }
    }
    ctx.globalAlpha = 1;
    // shadows go inside the ground clip: their top edge is exactly the surface, and they must not
    // touch the surface-line path built below (they used to replace it, outlining the shadow instead)
    this.shadows(ctx, cam);
    ctx.restore();
    // crisp surface line
    ctx.beginPath();
    for (let x = x0; x <= x1 + step; x += step) { const y = T.height(x); if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    // thin ink edge on the ground surface (matches the outlined art), with a sunlit lip just under it
    ctx.save(); ctx.translate(0, -1.6 / cam.zoom);
    ctx.strokeStyle = 'rgba(250,232,195,0.55)'; ctx.lineWidth = 1.2 / cam.zoom; ctx.stroke(); ctx.restore();
    ctx.strokeStyle = 'rgba(64,46,26,0.85)'; ctx.lineWidth = Math.max(0.012, 1.3 / cam.zoom); ctx.lineJoin = 'round'; ctx.stroke();
  }

  // Contact shadow on the ground under each hull and thrown turret. In side view the ground plane runs
  // toward the viewer below the surface line, so the shadow is a soft band just under it, offset away from
  // the sun (upper right) and fading out to the sides.
  shadows(ctx, cam) {
    const env = this.w.env || {}, T = this.w.terrain;
    const k = (1 - 0.85 * (env.night || 0)) * (env.visibility ? 0.6 : 1);
    if (k <= 0.02) return;
    const band = (cx, half, depth, a) => {
      const x0 = cx - half, x1 = cx + half, n = 24;
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, 'rgba(60,40,20,0)'); g.addColorStop(0.18, `rgba(60,40,20,${a})`);
      g.addColorStop(0.85, `rgba(60,40,20,${a})`); g.addColorStop(1, 'rgba(60,40,20,0)');
      ctx.fillStyle = g; ctx.beginPath();
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; ctx.lineTo(x, T.height(x) + 0.5); }   // clipped to the ground
      for (let i = n; i >= 0; i--) { const x = x0 + (x1 - x0) * i / n, t = Math.sin(Math.PI * i / n); ctx.lineTo(x, T.height(x) - depth * (0.35 + 0.65 * t)); }
      ctx.closePath(); ctx.fill();
    };
    for (const v of this.w.vehicles) {
      if (!cam.visible(v.pos.x, v.pos.y, 12) || !this.shown(v)) continue;
      const L = (v.g.idler.x - v.g.sprocket.x) * v.dir;            // track length on the ground
      band(v.pos.x - 0.9, Math.abs(L) / 2 + 1.4, 0.55, 0.34 * k);
      band(v.pos.x - 0.5, Math.abs(L) / 2 + 0.3, 0.22, 0.30 * k);   // darker core right under the tracks
      if (v.turretBody && v.turretBody.rest) band(v.turretBody.x - 0.4, 2.2, 0.3, 0.3 * k);
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
    const D = v.def, S = D.src, I = this.img[D.id], px = 1 / S.ppm, dir = v.dir, id = D.id, Sp = D.sprites;
    // ---- hull frame: underside shadow ----
    ctx.save(); ctx.translate(v.pos.x, v.pos.y); ctx.rotate(v.ang); ctx.scale(dir, 1);
    const U = D.underside;
    ctx.fillStyle = '#2b251d'; ctx.beginPath();
    if (U.poly) { U.poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); }
    else { ctx.moveTo(U.x0, U.y0); ctx.lineTo(U.x1, U.y0); ctx.lineTo(U.x1 - 0.2, U.y1); ctx.lineTo(U.x0 + 0.3, U.y1); }
    ctx.closePath(); ctx.fill();
    if (D.rearFill) { const R = D.rearFill; ctx.fillRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0); }
    if (D.sprocketHole) { ctx.beginPath(); ctx.arc(D.sprocket.x, D.sprocket.y, D.sprocketHole, 0, 7); ctx.fill(); }
    ctx.restore();

    // ---- track ----
    const circles = v.gearCircles();
    let path = DS.Track.buildPath(circles, this.pathBuf, circles.map(c => c.fixed));
    path = DS.Track.conformBottom(path, this.w.terrain, D.track.thick / 2, 0.25);
    v._trackPath = path;
    const info = DS.Track.links(path, D.track.pitch, v.s, this.linkBuf);
    const L = info.pitch, th = D.track.thick, nl = this.linkBuf.length;
    this.linkBuf.forEach(([x, y, a], i) => {
      if (v.trackBroken && i > nl * 0.32 && i < nl * 0.42) return;      // severed run
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#26231f'; ctx.fillRect(-L * 0.5, -th * 0.5, L * 0.93, th);
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
      ctx.restore();
    };
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
    if (!v.turretGone) this.turret(ctx, v, v.gun.e, v.gun.rx, true);
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
