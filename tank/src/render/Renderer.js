// Canvas2D renderer for the vertical slice (sky, parallax dunes, deformable terrain, vehicle rig,
// projectiles, particles). WebGL2 post (heat haze, bloom, thermal) is planned for M5.
DS.Renderer = class Renderer {
  constructor(canvas, world) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.w = world;
    this.img = {}; this.linkBuf = []; this.pathBuf = [];
    this.noise = this.makeNoise();
  }
  load(def) {
    const names = ['hull', 'turret', 'barrel', 'roadwheel', 'sprocket'];
    return Promise.all(names.map(n => new Promise((res, rej) => {
      const im = new Image(); im.onload = () => { this.img[n] = im; res(); }; im.onerror = () => rej(new Error('sprite ' + n));
      im.src = def.src.dir + n + '.png';
    })));
  }
  makeNoise() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const d = x.createImageData(128, 128), r = DS.rng(3);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = r(); const k = v < 0.5 ? 0 : 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = k; d.data[i + 3] = r() < 0.35 ? 22 : 0;
    }
    x.putImageData(d, 0, 0); return c;
  }

  frame() {
    const { ctx, w } = this, cam = w.cam, dpr = cam.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.sky(ctx, cam);
    cam.apply(ctx);
    w.particles.draw(ctx, cam, 0);
    for (const v of w.vehicles) this.vehicle(ctx, v);
    this.terrain(ctx, cam);
    this.projectiles(ctx);
    w.particles.draw(ctx, cam, 1);
    w.fx.drawFlashes(ctx);
    if (w.debug) DS.Debug.draw(ctx, w);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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

  vehicle(ctx, v) {
    const D = v.def, S = D.src, I = this.img, px = 1 / S.ppm;
    // ---- hull frame: underside shadow ----
    ctx.save(); ctx.translate(v.pos.x, v.pos.y); ctx.rotate(v.ang);
    const U = D.underside;
    ctx.fillStyle = '#2b251d'; ctx.beginPath();
    ctx.moveTo(U.x0, U.y0); ctx.lineTo(U.x1, U.y0); ctx.lineTo(U.x1 - 0.2, U.y1); ctx.lineTo(U.x0 + 0.3, U.y1); ctx.closePath(); ctx.fill();
    ctx.restore();

    // ---- track ----
    const circles = v.gearCircles();
    const fixed = circles.map((c, i) => i === 0 || i === 1 + D.returnRollers.length);
    let path = DS.Track.buildPath(circles, this.pathBuf, fixed);
    path = DS.Track.conformBottom(path, this.w.terrain, D.track.thick / 2, 0.25);
    v._trackPath = path;
    const info = DS.Track.links(path, D.track.pitch, v.s, this.linkBuf);
    const L = info.pitch, th = D.track.thick;
    for (const [x, y, a] of this.linkBuf) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#26231f'; ctx.fillRect(-L * 0.5, -th * 0.5, L * 0.93, th);          // pad + shoe
      ctx.fillStyle = '#4a4540'; ctx.fillRect(-L * 0.5, -th * 0.5, L * 0.18, th);          // end connector
      ctx.fillStyle = '#3a3631'; ctx.fillRect(-L * 0.25, th * 0.12, L * 0.6, th * 0.22);   // pad face highlight
      ctx.fillStyle = '#1d1b18'; ctx.fillRect(-L * 0.12, -th * 0.5 - 0.065, L * 0.28, 0.07); // guide horn (inner side, -y = inside the loop)
      ctx.restore();
    }

    // ---- wheels ----
    const wheel = (x, y, ang, r, im, imr, tint) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); const k = r / imr; ctx.scale(k, -k);
      ctx.drawImage(im, -imr, -imr, imr * 2 + 1, imr * 2 + 1);
      if (tint) { ctx.globalAlpha = tint; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, imr, 0, 7); ctx.fill(); }
      ctx.restore();
    };
    for (const w of v.st) wheel(w.wx, w.wy, w.ang, D.wheelR + 0.006, I.roadwheel, D.sprites.roadwheel.r);
    const ip = v.local(D.idler.x, D.idler.y);
    wheel(ip.x, ip.y, v.idlAng, D.idler.r + 0.02, I.roadwheel, D.sprites.roadwheel.r, 0.18);
    const sp = v.local(D.sprocket.x, D.sprocket.y);
    wheel(sp.x, sp.y, v.sprAng, 52 / S.ppm, I.sprocket, D.sprites.sprocket.r);

    // ---- hull, gun, turret (hull-local, source pixel frame) ----
    ctx.save(); ctx.translate(v.pos.x, v.pos.y); ctx.rotate(v.ang);
    const blit = (im, sx, sy) => { ctx.save(); ctx.scale(px, -px); ctx.drawImage(im, sx - S.ox, sy - S.oy); ctx.restore(); };
    blit(I.hull, D.sprites.hull.x, D.sprites.hull.y);
    const G = D.gun;
    ctx.save(); ctx.translate(G.trunnion[0], G.trunnion[1]); ctx.rotate(v.gun.e); ctx.translate(v.gun.rx, 0);
    ctx.scale(px, -px);
    const tpx = G.trunnion[0] * S.ppm + S.ox, tpy = S.oy - G.trunnion[1] * S.ppm;
    ctx.fillStyle = '#b89464'; ctx.fillRect(-40, -11, 110, 22);                   // breech end / barrel root (hidden by mantlet at rest)
    ctx.drawImage(I.barrel, D.sprites.barrel.x - tpx, D.sprites.barrel.y - tpy);
    ctx.restore();
    blit(I.turret, D.sprites.turret.x, D.sprites.turret.y);
    // antennas: spring masts
    ctx.strokeStyle = '#2e2c29'; ctx.lineCap = 'round';
    D.antennas.forEach((a, i) => {
      const phi = v.antennas[i].phi, tx = a.x + Math.sin(phi) * a.len, ty = a.y + Math.cos(phi) * a.len;
      ctx.lineWidth = 0.028; ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(a.x + Math.sin(phi) * a.len * 0.25, a.y + a.len * 0.55, tx, ty); ctx.stroke();
      ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(a.x, a.y - 0.02); ctx.lineTo(a.x + Math.sin(phi) * 0.12, a.y + 0.16); ctx.stroke();
    });
    ctx.restore();
  }

  projectiles(ctx) {
    ctx.lineCap = 'round';
    for (const p of this.w.projectiles) {
      const v = Math.hypot(p.vx, p.vy), L = Math.min(v * 0.025, 40);
      const g = ctx.createLinearGradient(p.x, p.y, p.x - p.vx / v * L, p.y - p.vy / v * L);
      g.addColorStop(0, p.ammo.tracer); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(0.06, 2 / this.w.cam.zoom);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / v * L, p.y - p.vy / v * L); ctx.stroke();
    }
  }
};
