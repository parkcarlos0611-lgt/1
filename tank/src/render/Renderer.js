// Canvas2D renderer for the vertical slice (sky, parallax dunes, deformable terrain, vehicle rig,
// projectiles, particles). WebGL2 post (heat haze, bloom, thermal) is planned for M5.
DS.Renderer = class Renderer {
  constructor(canvas, world) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.w = world;
    this.img = {}; this.mips = {}; this.linkBuf = []; this.pathBuf = [];
    this.noise = this.makeNoise();
  }
  load(def) {
    const id = def.id, Sp = def.sprites;
    this.img[id] = this.img[id] || {};
    const names = new Set(['hull', 'turret', 'barrel', Sp.roadwheel.file, Sp.idler.file]);
    if (Sp.flag) names.add(Sp.flag.file);
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
    this.cam = cam;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.sky(ctx, cam);
    cam.apply(ctx);
    w.particles.draw(ctx, cam, 0);
    for (const v of w.vehicles) if (cam.visible(v.pos.x, v.pos.y, 14)) this.vehicle(ctx, v, cam);
    this.terrain(ctx, cam);
    this.projectiles(ctx, cam);
    w.particles.draw(ctx, cam, 1);
    w.fx.drawFlashes(ctx);
    if (opt.main) {
      this.sightLine(ctx, cam);
      if (w.debug) DS.Debug.draw(ctx, w);
      this.labels(ctx, cam);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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

  sky(ctx, cam) {
    const W = cam.W * cam.dpr, H = cam.H * cam.dpr;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7fa6cc'); g.addColorStop(0.5, '#c9d3d4'); g.addColorStop(0.75, '#ecdcbc'); g.addColorStop(1, '#e8cf9f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
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
    ctx.globalAlpha = 1; ctx.restore();
    // crisp surface line
    ctx.beginPath();
    for (let x = x0; x <= x1 + step; x += step) { const y = T.height(x); if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.strokeStyle = 'rgba(245,225,185,0.8)'; ctx.lineWidth = Math.max(0.03, 1.2 / cam.zoom); ctx.stroke();
  }

  vehicle(ctx, v, cam) {
    const D = v.def, S = D.src, I = this.img[D.id], px = 1 / S.ppm, dir = v.dir, id = D.id, Sp = D.sprites;
    const charred = v.burning > 0.6 || v.wreck;
    if (charred) ctx.filter = 'brightness(0.32) saturate(0.35)';
    // ---- hull frame: underside shadow ----
    ctx.save(); ctx.translate(v.pos.x, v.pos.y); ctx.rotate(v.ang); ctx.scale(dir, 1);
    const U = D.underside;
    ctx.fillStyle = '#2b251d'; ctx.beginPath();
    ctx.moveTo(U.x0, U.y0); ctx.lineTo(U.x1, U.y0); ctx.lineTo(U.x1 - 0.2, U.y1); ctx.lineTo(U.x0 + 0.3, U.y1); ctx.closePath(); ctx.fill();
    if (D.rearFill) { const R = D.rearFill; ctx.fillRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0); }
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
    ctx.filter = 'none';
  }

  // barrel + turret + antennas in the vehicle's unmirrored hull frame (metres)
  turret(ctx, v, e, rx, antennas) {
    const D = v.def, S = D.src, I = this.img[D.id], px = 1 / S.ppm, Sp = D.sprites, G = D.gun;
    ctx.save(); ctx.translate(G.trunnion[0], G.trunnion[1]); ctx.rotate(e); ctx.translate(rx, 0);
    ctx.scale(px, -px);
    const tpx = G.trunnion[0] * S.ppm + S.ox, tpy = S.oy - G.trunnion[1] * S.ppm;
    ctx.fillStyle = '#b89464'; ctx.fillRect(-40 * S.ppm / 149, -11 * S.ppm / 149, 110 * S.ppm / 149, 22 * S.ppm / 149);
    ctx.drawImage(I.barrel, Sp.barrel.x - tpx, Sp.barrel.y - tpy);
    ctx.restore();
    ctx.save(); ctx.scale(px, -px); ctx.drawImage(I.turret, Sp.turret.x - S.ox, Sp.turret.y - S.oy);
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
    for (const p of this.w.projectiles) {
      const v = Math.hypot(p.vx, p.vy), L = Math.min(v * 0.025, 40);
      const g = ctx.createLinearGradient(p.x, p.y, p.x - p.vx / v * L, p.y - p.vy / v * L);
      g.addColorStop(0, p.ammo.tracer); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(0.06, 2 / cam.zoom);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / v * L, p.y - p.vy / v * L); ctx.stroke();
    }
  }
};
