// Hit camera (P6): after the player's main-gun round strikes armour, a small x-ray panel replays the hit in
// slow motion — the target as a cut-away ghost with its armour plates outlined, the round flying in along its
// real path, the plate it struck (thickness along the path against penetration, obliquity), and on a
// penetration the cone of behind-armour debris spreading through the hull with the modules it reached lit up.
// It reads only what DS.Armor.resolve worked out (the replay shows the outcome, it does not decide it).
// Drawn on its own small 2D canvas, only while a replay is showing. The ` key toggles it (setting: hitCam).
DS.HitCam = {
  T: 3.8,                                   // seconds on screen
  COL: { crew: '#7fd0ff', ammo: '#ffb347', fuel_ammo: '#ffb347', fuel: '#ffd36b', engine: '#b9a6ff', gun: '#9fe0a0', optics: '#9fe0a0' },
  // called by World.onProjectileHit for the player's rounds against armour, after the hit is resolved: r.mods
  // lists the modules the debris reached, r.effects what happened to them
  start(world, p, r) {
    if (DS.T.hitCam === false || !r || !r.vehicle || r.vehicle.heli) return;
    const v = r.vehicle, l = v.toLocal(r.x, r.y), c = Math.cos(v.ang), s = Math.sin(v.ang);
    const dx = r.shotDx, dy = r.shotDy, ldx = c * dx + s * dy, ldy = -s * dx + c * dy;   // shot direction in the hull frame
    this.cur = { v, t: 0, hx: l.x, hy: l.y, dx: ldx, dy: ldy, r, mods: new Set(r.mods || []), state: Object.assign({}, v.modState),
      len: r.spallLen || 0, half: r.spallHalf || 0, pl: r.plateLocal || null, hull: v.turretGone };
    // the vehicle as it stood when struck (a cook-off may throw the turret a moment later): its drawing in the
    // hull frame, kept for the replay
    const R = world.rend, K = 48, g = document.createElement('canvas'); g.width = 12 * K; g.height = 6 * K;
    try { const o = g.getContext('2d'); o.setTransform(new DOMMatrix().translate(6 * K, 4.2 * K).scale(K, -K).rotate(-v.ang * 180 / Math.PI).translate(-v.pos.x, -v.pos.y));
      R.drawVehicle(o, v, world.cam);
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-in'; o.fillStyle = 'rgba(90,150,210,0.55)'; o.fillRect(0, 0, g.width, g.height); this.cur.ghost = g; this.cur.K = K; }
    catch (e) { this.cur.ghost = null; }
  },
  update(dt) { const C = this.cur; if (C) { C.t += dt; if (C.t > this.T) this.cur = null; } },
  draw(game, dt) {
    const cv = this.cv || (this.cv = document.getElementById('hitcam'));
    const C = this.cur;
    if (!cv) return;
    if (!C) { if (!cv.hidden) cv.hidden = true; return; }
    if (cv.hidden) cv.hidden = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (!W) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const x = cv.getContext('2d'), v = C.v, R = game.rend, r = C.r, t = C.t;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    // backdrop: blueprint blue with a faint grid
    x.fillStyle = 'rgba(8,16,26,0.92)'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(120,170,220,0.08)'; x.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 16) { x.beginPath(); x.moveTo(gx + 0.5, 0); x.lineTo(gx + 0.5, H); x.stroke(); }
    for (let gy = 0; gy < H; gy += 16) { x.beginPath(); x.moveTo(0, gy + 0.5); x.lineTo(W, gy + 0.5); x.stroke(); }
    // hull frame → panel: the hit point a little left of centre, the vehicle level, facing as it stands
    const len = Math.abs(v.g.idler.x - v.g.sprocket.x) + 3, k = Math.min(W * 0.74 / len, H * 0.5 / 3.4);
    const cx = W * 0.5 - (C.hx - (v.g.idler.x + v.g.sprocket.x) / 2) * k * 0.35, cy = H * 0.5;
    const P = (lx, ly) => [cx + (lx - C.hx * 0.35) * k, cy - (ly - 1.0) * k];
    // ghost of the vehicle as it stood when struck (hull frame, 12 × 6 m around the hull's position)
    if (C.ghost) { const [ox, oy] = P(0, 0), q = k / C.K; x.globalAlpha = 0.85; x.drawImage(C.ghost, ox - 6 * C.K * q, oy - 4.2 * C.K * q, C.ghost.width * q, C.ghost.height * q); x.globalAlpha = 1; }
    // armour plates (hull frame), the struck one picked out
    for (const pl of v.def.armor) {
      if (pl.part === 'turret' && C.hull && !(C.pl && C.pl === pl)) continue;
      const a = P(pl.a[0] * v.dir, pl.a[1]), b = P(pl.b[0] * v.dir, pl.b[1]), hit = C.pl === pl;
      x.strokeStyle = hit ? '#ffffff' : 'rgba(170,205,235,0.55)'; x.lineWidth = hit ? 3 : Math.max(1, Math.min(4, (pl.t || 40) / 60));
      x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
    }
    // the round, slowed: it covers the last few metres in the first second
    const fly = Math.min(1, t / 1.0), ease = 1 - Math.pow(1 - fly, 2), D0 = 6;
    const sx = C.hx - C.dx * D0 * (1 - ease), sy = C.hy - C.dy * D0 * (1 - ease), [hx, hy] = P(C.hx, C.hy);
    { const [ax, ay] = P(C.hx - C.dx * D0, C.hy - C.dy * D0), [bx, by] = P(sx, sy);
      x.strokeStyle = 'rgba(255,220,140,0.5)'; x.setLineDash([4, 4]); x.lineWidth = 1.5; x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); x.setLineDash([]);
      if (fly < 1) { x.fillStyle = '#ffe9b0'; x.beginPath(); x.arc(bx, by, 3.5, 0, Math.PI * 2); x.fill(); } }
    const after = t - 1.0;
    if (after > 0) {
      // impact flash
      if (after < 0.35) { const a = 1 - after / 0.35, gr = x.createRadialGradient(hx, hy, 0, hx, hy, 26); gr.addColorStop(0, `rgba(255,240,200,${a})`); gr.addColorStop(1, 'rgba(255,160,60,0)'); x.fillStyle = gr; x.fillRect(hx - 26, hy - 26, 52, 52); }
      if (r.result === 'pen' && C.len > 0) {
        // debris cone spreading behind the plate
        const u = Math.min(1, after / 1.1), L = C.len * u, a0 = Math.atan2(C.dy, C.dx), h = C.half;
        const [ex1, ey1] = P(C.hx + Math.cos(a0 - h) * L, C.hy + Math.sin(a0 - h) * L), [ex2, ey2] = P(C.hx + Math.cos(a0 + h) * L, C.hy + Math.sin(a0 + h) * L);
        const gr = x.createRadialGradient(hx, hy, 0, hx, hy, L * k); gr.addColorStop(0, 'rgba(255,170,70,0.55)'); gr.addColorStop(1, 'rgba(255,90,30,0.08)');
        x.fillStyle = gr; x.beginPath(); x.moveTo(hx, hy); x.lineTo(ex1, ey1); x.lineTo(ex2, ey2); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(255,200,120,0.8)'; x.lineWidth = 1;
        for (let i = 0; i < 11; i++) { const a = a0 + (i / 10 - 0.5) * 2 * h, f = 0.7 + 0.3 * Math.sin(i * 7.1), [qx, qy] = P(C.hx + Math.cos(a) * L * f, C.hy + Math.sin(a) * L * f); x.beginPath(); x.moveTo(hx, hy); x.lineTo(qx, qy); x.stroke(); }
      } else if (r.result === 'ricochet') {
        const u = Math.min(1, after / 0.8), rv = r.reflect, c = Math.cos(v.ang), s = Math.sin(v.ang), sp = Math.hypot(rv.vx, rv.vy) || 1;
        const lx = (c * rv.vx + s * rv.vy) / sp, ly = (-s * rv.vx + c * rv.vy) / sp, [qx, qy] = P(C.hx + lx * 5 * u, C.hy + ly * 5 * u);
        x.strokeStyle = 'rgba(255,233,176,0.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(hx, hy); x.lineTo(qx, qy); x.stroke();
      }
    }
    // modules: rings in their colours; the ones the debris reached flash, then show what happened
    for (const m of v.def.modules) {
      const [mx, my] = P(m.p[0] * v.dir, m.p[1]), reached = C.mods.has(m.id), dead = !!v.modState[m.id], was = !!C.state[m.id];
      if (C.hull && m.p[1] > 0.2 && !reached) continue;
      const rr = Math.max(4, m.r * k), lit = reached && after > 0.4;
      x.lineWidth = lit ? 2 : 1;
      x.strokeStyle = lit ? (dead && !was ? '#ff4a3a' : '#ffd27a') : was ? 'rgba(255,90,70,0.6)' : (this.COL[m.type] || '#ccc') + '99';
      x.fillStyle = lit && dead && !was ? `rgba(255,60,40,${0.25 + 0.2 * Math.sin(t * 14)})` : 'rgba(0,0,0,0)';
      x.beginPath(); x.arc(mx, my, rr, 0, Math.PI * 2); x.fill(); x.stroke();
      if (lit && dead && !was) { x.fillStyle = dead && !was ? '#ffb0a0' : '#ffe2a0'; x.font = '600 10px ui-sans-serif, system-ui, sans-serif'; x.textAlign = 'center'; x.fillText(m.name, mx, my - rr - 3); }
    }
    // the numbers
    const RES = { pen: ['관통', '#ff6a50'], nonpen: ['불관통', '#9fc4e8'], ricochet: ['도탄', '#ffd27a'], track: ['궤도 손상', '#ffb070'] }, [rt, rc] = RES[r.result] || [r.result, '#ccc'];
    x.textAlign = 'left'; x.font = '700 13px ui-sans-serif, system-ui, sans-serif'; x.fillStyle = rc; x.fillText(`피탄 카메라 · ${rt}`, 10, 18);
    x.font = '600 11px ui-monospace, monospace'; x.fillStyle = '#d8e6f2';
    x.fillText(`${v.def.name} · ${r.plate || ''}`, 10, 34);
    { const gb = x.createLinearGradient(0, H - 44, 0, H); gb.addColorStop(0, 'rgba(8,16,26,0)'); gb.addColorStop(0.4, 'rgba(8,16,26,0.85)'); x.fillStyle = gb; x.fillRect(0, H - 44, W, 44); }
    if (r.pen != null && r.prot != null) {
      x.fillStyle = '#d8e6f2'; x.fillText(`관통력 ${Math.round(r.pen)} mm  vs  실효 두께 ${Math.round(r.prot)} mm`, 10, H - 26);
      // a bar: penetration against protection
      const bw = W - 20, mx = Math.max(r.pen, r.prot) * 1.1, pw = bw * r.pen / mx, qw = bw * r.prot / mx;
      x.fillStyle = 'rgba(160,200,235,0.25)'; x.fillRect(10, H - 18, qw, 4); x.fillStyle = rc; x.fillRect(10, H - 11, pw * Math.min(1, t / 1.2), 4);
    }
    x.textAlign = 'right'; x.fillStyle = '#9fb8cc';
    x.fillText(`경사 ${Math.round(r.obl || 0)}° · ${Math.round(r.range || 0)} m`, W - 10, 18);
    if (after > 0.9 && r.effects && r.effects.length) { x.fillStyle = '#ffd9cf'; x.fillText(r.effects.slice(0, 2).join(' · ').slice(0, 46), W - 10, 34); }
    // fade out
    const fo = Math.max(0, (t - (this.T - 0.4)) / 0.4); cv.style.opacity = String(1 - fo);
  },
};
