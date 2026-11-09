// Effect emitters driven by simulation state: track sand / rooster tail, turbine exhaust,
// muzzle flash + blast dust + gun smoke + sabot petals, ground impacts.
DS.Effects = class Effects {
  constructor(world) { this.w = world; this.P = world.particles; this.flashes = []; this.acc = 0; this.shake = 0; }
  rnd(a, b) { return a + Math.random() * (b - a); }
  hex(s) { return parseInt(s.slice(1), 16); }

  vehicle(v, dt) {
    const P = this.P, K = DS.P, T = this.w.terrain, D = v.def;
    const c = Math.cos(v.ang), s = Math.sin(v.ang);
    const speed = Math.hypot(v.vel.x, v.vel.y), soil = T.soilAt(v.pos.x), sc = this.hex(soil.col[1]);
    // rooster tail from the trailing end (rear when moving forward)
    const fwd = v.vt >= 0;
    const end = fwd ? { lx: D.sprocket.x - 0.1, ly: D.sprocket.y - 0.4 } : { lx: D.idler.x + 0.1, ly: D.idler.y - 0.4 };
    const ex = v.pos.x + c * end.lx - s * end.ly, ey = v.pos.y + s * end.lx + c * end.ly;
    const rate = (Math.abs(v.vt) * 9 + v.stats.slip * 70) * soil.dust;
    let n = rate * dt + Math.random();
    const dir = fwd ? -1 : 1;
    while (n-- >= 1) {
      const vv = Math.abs(v.vt) * this.rnd(0.2, 0.75) + v.stats.slip * 1.5;
      P.add(K.GRAIN, ex + this.rnd(-0.3, 0.3), ey + this.rnd(0, 0.4), v.vel.x * 0.4 + dir * vv * 0.6, this.rnd(0.8, 2.2) + vv * 0.45,
        this.rnd(0.5, 1.4), this.rnd(0.025, 0.06), { drag: 0.6, grav: 1, col: Math.random() < 0.5 ? sc : this.hex(soil.col[0]) });
    }
    // dust wake (bigger when dry soft sand, scales with speed)
    let nd = (speed * 2.2 + v.stats.slip * 14) * soil.dust * dt + Math.random() * 0.6;
    while (nd-- >= 1) {
      const lx = this.rnd(-3.6, 3.4) * 0.6 + (fwd ? -1.4 : 1.4);
      P.add(K.DUST, v.pos.x + c * lx, T.height(v.pos.x + c * lx) + this.rnd(0.1, 0.8), v.vel.x * 0.3 + dir * this.rnd(0, 1.5), this.rnd(0.2, 1),
        this.rnd(2.5, 6), this.rnd(0.4, 0.9), { grow: this.rnd(0.35, 0.8), drag: 1.2, grav: 0.0, alpha: 0.22 * Math.min(1, speed / 6 + 0.15), col: sc });
    }
    // AGT1500 exhaust: almost smokeless, hot shimmer blowing rearward + dust kicked behind the hull
    const xh = v.pos.x + c * D.exhaust.x - s * D.exhaust.y, yh = v.pos.y + s * D.exhaust.x + c * D.exhaust.y;
    const pw = 0.25 + v.spool;
    let nh = 26 * pw * dt + Math.random() * 0.5;
    while (nh-- >= 1) P.add(K.HEAT, xh, yh + this.rnd(-0.2, 0.2), v.vel.x - c * this.rnd(4, 9) * pw, this.rnd(-0.5, 1.2), this.rnd(0.4, 0.9), this.rnd(0.25, 0.5),
      { grow: 1.2, drag: 2.5, grav: -0.05, alpha: 0.10, col: 0xe8e4dc });
    if (v.spool > 0.4 && Math.random() < v.spool * dt * 8) {
      const gx = xh - c * this.rnd(1, 3);
      P.add(K.DUST, gx, T.height(gx) + 0.2, v.vel.x - c * this.rnd(2, 5), this.rnd(0.2, 0.8), this.rnd(1.5, 3), 0.5,
        { grow: 0.9, drag: 1.4, grav: 0, alpha: 0.16, col: sc });
    }
    for (const e of v.events) if (e.type === 'fire') this.muzzle(v, e);
    v.events.length = 0;
  }

  muzzle(v, e) {
    const P = this.P, K = DS.P, T = this.w.terrain;
    this.flashes.push({ x: e.x, y: e.y, dx: e.dx, dy: e.dy, t: 0, ttl: 0.085 });
    this.shake = Math.max(this.shake, 0.6);
    // muzzle fireball (secondary flash)
    for (let i = 0; i < 18; i++) {
      const sp = this.rnd(4, 40), a = Math.atan2(e.dy, e.dx) + this.rnd(-0.6, 0.6);
      P.add(K.FIRE, e.x + e.dx * this.rnd(0, 1.5), e.y + e.dy * this.rnd(0, 1.5), Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(0.05, 0.14), this.rnd(0.4, 1.1),
        { grow: 4, drag: 14, grav: 0, alpha: 0.9, col: 0xffa040 });
    }
    // gun smoke: forward jet decelerating, then drifting
    for (let i = 0; i < 46; i++) {
      const f = this.rnd(0, 1), sp = 4 + 55 * f * f, a = Math.atan2(e.dy, e.dx) + this.rnd(-0.35, 0.35) * (1.2 - f);
      P.add(K.SMOKE, e.x, e.y, Math.cos(a) * sp + this.rnd(-2, 2), Math.sin(a) * sp + this.rnd(-2, 2), this.rnd(3, 7), this.rnd(0.3, 0.7),
        { grow: this.rnd(0.5, 1.1), drag: 3.2, grav: -0.015, alpha: 0.38, col: 0xd9d6cf });
    }
    // side blast ring (ring-shaped muzzle brake-less 120 mm still throws a radial cloud)
    for (let i = 0; i < 20; i++) {
      const a = this.rnd(0, Math.PI * 2), sp = this.rnd(8, 22);
      P.add(K.SMOKE, e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(1.5, 3), 0.35, { grow: 0.7, drag: 4, grav: 0, alpha: 0.25, col: 0xcfc9bf });
    }
    // blast obscuration: overpressure lifts sand under and ahead of the muzzle
    const gy = T.height(e.x), hgt = e.y - gy;
    if (hgt < 6) {
      const sc = this.hex(T.soilAt(e.x).col[1]), str = (6 - hgt) / 6;
      for (let i = 0; i < 70 * str; i++) {
        const x = e.x + this.rnd(-3, 9) + e.dx * 2;
        const away = Math.sign(x - e.x + 0.001);
        P.add(K.DUST, x, T.height(x) + this.rnd(0, 0.6), away * this.rnd(2, 10), this.rnd(0.5, 4), this.rnd(3, 7), this.rnd(0.4, 1),
          { grow: this.rnd(0.6, 1.2), drag: 1.5, grav: 0, alpha: 0.3, col: sc });
        if (i % 2 === 0) P.add(K.GRAIN, x, T.height(x) + 0.05, away * this.rnd(2, 8), this.rnd(2, 6), this.rnd(0.4, 1), 0.04, { drag: 0.4, col: sc });
      }
    }
    // sabot petals peel off in the first metres
    if (e.ammo.sabot) for (let i = 0; i < 3; i++) {
      const a = Math.atan2(e.dy, e.dx) + (i - 1) * 0.06 + this.rnd(-0.02, 0.02), sp = this.rnd(250, 600);
      P.add(K.DEBRIS, e.x + e.dx * 3, e.y + e.dy * 3, Math.cos(a) * sp, Math.sin(a) * sp, 3, 0.12, { drag: 0.9, grav: 1 });
    }
  }

  impact(hit) {
    const P = this.P, K = DS.P, T = this.w.terrain, A = hit.ammo;
    const heat = A.type === 'HEAT';
    const sc = this.hex(T.soilAt(hit.x).col[1]), sc2 = this.hex(T.soilAt(hit.x).col[0]);
    const v = Math.hypot(hit.vx, hit.vy), ang = Math.atan2(hit.vy, hit.vx);
    T.crater(hit.x + Math.cos(ang) * 0.4, heat ? 1.3 : 0.8, heat ? 0.55 : 0.3);
    T.relax(undefined, undefined, 4);
    // plume: KE → tall narrow column thrown along the ricochet direction; HE/HEAT → radial
    const n = heat ? 160 : 120;
    for (let i = 0; i < n; i++) {
      let a, sp;
      if (heat) { a = Math.PI / 2 + this.rnd(-1.1, 1.1); sp = this.rnd(5, 30); }
      else { a = Math.PI / 2 + Math.sign(hit.vx) * this.rnd(-0.15, 0.55); sp = this.rnd(8, 45) * Math.min(1.3, v / 1200); }
      P.add(K.GRAIN, hit.x, hit.y + 0.1, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(1, 3.2), this.rnd(0.04, 0.12), { drag: 0.25, col: Math.random() < 0.5 ? sc : sc2 });
    }
    for (let i = 0; i < 30; i++) {
      const a = Math.PI / 2 + this.rnd(-0.9, 0.9), sp = this.rnd(1, heat ? 12 : 9);
      P.add(K.DUST, hit.x + this.rnd(-1, 1), hit.y + this.rnd(0, 2), Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(4, 9), this.rnd(0.6, 1.4),
        { grow: this.rnd(0.6, 1.3), drag: 0.9, grav: 0, alpha: 0.32, col: sc });
    }
    if (heat) {
      for (let i = 0; i < 24; i++) { const a = this.rnd(0, 6.28), sp = this.rnd(3, 20);
        P.add(K.FIRE, hit.x, hit.y + 0.5, Math.cos(a) * sp, Math.abs(Math.sin(a)) * sp, this.rnd(0.06, 0.18), this.rnd(0.5, 1.2), { grow: 5, drag: 10, grav: 0, alpha: 1, col: 0xffa040 }); }
      for (let i = 0; i < 14; i++) P.add(K.DARK, hit.x + this.rnd(-1, 1), hit.y + this.rnd(0.5, 2.5), this.rnd(-1, 1), this.rnd(1, 4), this.rnd(4, 8), this.rnd(0.6, 1.2),
        { grow: 0.9, drag: 1, grav: -0.02, alpha: 0.4, col: 0x2e2a26 });
      this.flashes.push({ x: hit.x, y: hit.y + 0.5, dx: 0, dy: 1, t: 0, ttl: 0.07, boom: true });
    }
    const d = Math.abs(hit.x - this.w.cam.x);
    this.shake = Math.max(this.shake, Math.max(0, 0.5 - d / 300));
  }

  update(dt) { for (const f of this.flashes) f.t += dt; this.flashes = this.flashes.filter(f => f.t < f.ttl); this.shake = Math.max(0, this.shake - dt * 2.5); }

  drawFlashes(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flashes) {
      const k = 1 - f.t / f.ttl, a = Math.atan2(f.dy, f.dx);
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(a);
      // primary/intermediate flash: elongated along the bore, secondary: fat ball ahead of the muzzle
      const L = f.boom ? 2.5 : 3.6 * (0.7 + 0.3 * k);
      let g = ctx.createRadialGradient(L * 0.45, 0, 0, L * 0.45, 0, L);
      g.addColorStop(0, `rgba(255,250,220,${0.95 * k})`); g.addColorStop(0.25, `rgba(255,200,90,${0.85 * k})`);
      g.addColorStop(0.6, `rgba(255,120,30,${0.45 * k})`); g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g; ctx.scale(1, f.boom ? 1 : 0.55); ctx.beginPath(); ctx.arc(L * 0.45, 0, L, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // ambient light splash
      const R = 14;
      g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
      g.addColorStop(0, `rgba(255,180,90,${0.35 * k})`); g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - R, f.y - R, R * 2, R * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
};
