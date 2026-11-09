// Effect emitters driven by simulation state: track sand / rooster tail, turbine exhaust,
// muzzle flash + blast dust + gun smoke + sabot petals, ground impacts.
DS.Effects = class Effects {
  constructor(world) { this.w = world; this.P = world.particles; this.flashes = []; this.labels = []; this.acc = 0; this.shake = 0; }
  rnd(a, b) { return a + Math.random() * (b - a); }
  hex(s) { return parseInt(s.slice(1), 16); }

  vehicle(v, dt) {
    const P = this.P, K = DS.P, T = this.w.terrain, D = v.def, G = v.g;
    const c = Math.cos(v.ang), s = Math.sin(v.ang);
    const speed = Math.hypot(v.vel.x, v.vel.y), soil = T.soilAt(v.pos.x), sc = this.hex(soil.col[1]);
    // rooster tail from the trailing end of the track
    const fwd = v.vt >= 0;
    const ends = [G.sprocket, G.idler].sort((a, b) => a.x - b.x);
    const e0 = fwd ? ends[0] : ends[1];
    const end = { lx: e0.x + (fwd ? -0.1 : 0.1), ly: e0.y - 0.4 };
    const ex = v.pos.x + c * end.lx - s * end.ly, ey = v.pos.y + s * end.lx + c * end.ly;
    const rate = (Math.abs(v.vt) * 9 + v.stats.slip * 70) * soil.dust;
    let n = rate * dt + Math.random();
    const dir = fwd ? -1 : 1;
    while (n-- >= 1) {
      const vv = Math.abs(v.vt) * this.rnd(0.2, 0.75) + v.stats.slip * 1.5;
      P.add(K.GRAIN, ex + this.rnd(-0.3, 0.3), ey + this.rnd(0, 0.4), v.vel.x * 0.4 + dir * vv * 0.6, this.rnd(0.8, 2.2) + vv * 0.45,
        this.rnd(0.5, 1.4), this.rnd(0.025, 0.06), { drag: 0.6, grav: 1, col: Math.random() < 0.5 ? sc : this.hex(soil.col[0]) });
    }
    let nd = (speed * 2.2 + v.stats.slip * 14) * soil.dust * dt + Math.random() * 0.6 * Math.min(1, speed);
    while (nd-- >= 1) {
      const lx = this.rnd(-3.6, 3.4) * 0.6 + (fwd ? -1.4 : 1.4);
      P.add(K.DUST, v.pos.x + c * lx, T.height(v.pos.x + c * lx) + this.rnd(0.1, 0.8), v.vel.x * 0.3 + dir * this.rnd(0, 1.5), this.rnd(0.2, 1),
        this.rnd(2.5, 6), this.rnd(0.4, 0.9), { grow: this.rnd(0.35, 0.8), drag: 1.2, grav: 0.0, alpha: 0.22 * Math.min(1, speed / 6 + 0.15), col: sc });
    }
    // exhaust: AGT1500 turbine = hot shimmer blowing rearward; diesel = dark puffs under load
    const xh = v.pos.x + c * G.exhaust.x - s * G.exhaust.y, yh = v.pos.y + s * G.exhaust.x + c * G.exhaust.y;
    const back = -v.dir;
    if (v.alive) {
      const pw = 0.25 + v.spool;
      if (D.engine.type === 'turbine') {
        let nh = 26 * pw * dt + Math.random() * 0.5;
        while (nh-- >= 1) P.add(K.HEAT, xh, yh + this.rnd(-0.2, 0.2), v.vel.x + back * c * this.rnd(4, 9) * pw, this.rnd(-0.5, 1.2), this.rnd(0.4, 0.9), this.rnd(0.25, 0.5),
          { grow: 1.2, drag: 2.5, grav: -0.05, alpha: 0.10, col: 0xe8e4dc });
        if (v.spool > 0.4 && Math.random() < v.spool * dt * 8) {
          const gx = xh + back * c * this.rnd(1, 3);
          P.add(K.DUST, gx, T.height(gx) + 0.2, v.vel.x + back * c * this.rnd(2, 5), this.rnd(0.2, 0.8), this.rnd(1.5, 3), 0.5,
            { grow: 0.9, drag: 1.4, grav: 0, alpha: 0.16, col: sc });
        }
      } else {
        const dsp = Math.max(0, v.spool - (v._lastSpool || 0)) / dt;  // black puff when the throttle opens
        v._lastSpool = v.spool;
        let nh = (3 + 14 * v.spool + dsp * 20) * dt + Math.random() * 0.3;
        while (nh-- >= 1) P.add(K.DARK, xh, yh, v.vel.x + back * this.rnd(0.5, 2), this.rnd(0.5, 1.5), this.rnd(2, 4), this.rnd(0.15, 0.3),
          { grow: 0.5, drag: 1.5, grav: -0.03, alpha: 0.18 + 0.25 * v.spool, col: 0x3a3631 });
      }
    }
    // damage: burning hull, bustle blow-out panels venting
    if (v.burning) this.burning(v, dt);
    if (v.jet > 0) this.flameJet(v, dt);
    for (const h of v.holes) this.holeFlame(v, h, dt);
    if (v.vent > 0) {
      const p = v.local(v.g.ring.x - v.dir * 2.1, v.g.ring.y + 0.6);
      for (let i = 0; i < 40 * dt * 10; i++) P.add(K.FIRE, p.x + this.rnd(-0.6, 0.6), p.y, this.rnd(-1, 1), this.rnd(10, 22), this.rnd(0.15, 0.35), this.rnd(0.3, 0.6),
        { grow: 2, drag: 2, grav: 0, alpha: 0.9, col: 0xffa040 });
      if (Math.random() < 0.5) P.add(K.DARK, p.x, p.y + 2, this.rnd(-1, 1), this.rnd(3, 6), this.rnd(5, 9), 0.8, { grow: 1.1, drag: 0.8, grav: -0.03, alpha: 0.4, col: 0x2a2724 });
    }
    for (const e of v.events) { if (e.type === 'fire') this.muzzle(v, e); else if (e.type === 'explode') this.explode(v); }
    v.events.length = 0;
  }

  burning(v, dt) {
    const P = this.P, K = DS.P;
    const age = v.burning, f = Math.min(1, age / 2.5) * (v.wreck ? 1.4 : 1);
    // flare-ups: the fire breathes, with occasional surges
    v._flare = Math.max(0, (v._flare || 0) - dt);
    if (Math.random() < dt * 0.35) v._flare = this.rnd(0.6, 1.6);
    const surge = 1 + (v._flare > 0 ? 1.8 : 0) + 0.35 * Math.sin(age * 7.3) * Math.sin(age * 3.1);
    const p = v.fireSource(), wide = v.turretGone ? 1.0 : 0.6;
    let n = 70 * f * surge * dt + Math.random() * 0.5;
    while (n-- >= 1) P.add(K.FIRE, p.x + this.rnd(-wide, wide), p.y + this.rnd(-0.1, 0.3), this.rnd(-0.8, 0.8) + this.w.wind * 0.25, this.rnd(2.5, 6.5) * (0.8 + 0.3 * surge),
      this.rnd(0.25, 0.7), this.rnd(0.3, 0.8) * (0.85 + 0.2 * surge), { grow: 0.8, drag: 1.4, grav: -0.1, alpha: 0.9, col: Math.random() < 0.4 ? 0xff7a28 : Math.random() < 0.6 ? 0xffb050 : 0xffe08a });
    // licking flames from the engine deck once the fire has spread
    if (age > 6) {
      const e = v.local(v.g.exhaust.x + v.dir * 0.8, 0.2);
      let m = 22 * f * dt;
      while (m-- >= 0 && Math.random() < 0.9) P.add(K.FIRE, e.x + this.rnd(-0.8, 0.8), e.y, this.rnd(-0.5, 0.5), this.rnd(1.5, 4), this.rnd(0.2, 0.5), this.rnd(0.25, 0.5),
        { grow: 0.6, drag: 1.5, grav: -0.1, alpha: 0.8, col: 0xff8a30 });
    }
    let m = 9 * f * dt + Math.random() * 0.4;
    while (m-- >= 1) P.add(K.DARK, p.x + this.rnd(-0.6, 0.6), p.y + 1.0, this.rnd(-0.4, 0.4), this.rnd(3, 6), this.rnd(10, 18), this.rnd(0.6, 1.0),
      { grow: this.rnd(0.45, 0.9), drag: 0.35, grav: -0.02, alpha: 0.42, col: Math.random() < 0.5 ? 0x201d1a : 0x37322d });
    if (v.wreck && Math.random() < dt * 0.6) {
      for (let i = 0; i < 16; i++) { const a = this.rnd(0.3, 2.8), sp = this.rnd(5, 20);
        P.add(K.FIRE, p.x, p.y + 0.5, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(0.1, 0.3), this.rnd(0.2, 0.5), { grow: 2, drag: 4, grav: 0.2, alpha: 1, col: 0xffb050 }); }
    }
  }

  // cook-off: propellant venting through the turret ring as a roaring vertical jet
  flameJet(v, dt) {
    const P = this.P, K = DS.P, p = v.local(v.g.ring.x, v.g.ring.y + 0.1);
    const k = Math.min(1, v.jet / 2) * (0.75 + 0.25 * Math.sin(v.jet * 23));
    let n = 170 * k * dt;
    while (n-- >= 0) {
      const a = Math.PI / 2 + v.ang + this.rnd(-0.16, 0.16), sp = this.rnd(14, 34) * (0.6 + 0.4 * k);
      const hot = Math.random() < 0.2;
      P.add(K.FIRE, p.x + this.rnd(-0.45, 0.45), p.y, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(0.25, 0.6), this.rnd(0.35, 0.9),
        { grow: 1.8, drag: 1.6, grav: -0.05, alpha: hot ? 0.75 : 0.5, col: hot ? 0xffe6a0 : Math.random() < 0.55 ? 0xff9a30 : 0xe8561a });
    }
    if (Math.random() < 9 * dt) P.add(K.DARK, p.x, p.y + this.rnd(5, 10), this.rnd(-1, 1), this.rnd(4, 8), this.rnd(9, 15), this.rnd(0.9, 1.4),
      { grow: 0.7, drag: 0.5, grav: -0.03, alpha: 0.42, col: 0x1e1b18 });
    if (Math.random() < 20 * dt) { const a = Math.PI / 2 + this.rnd(-0.6, 0.6), sp = this.rnd(15, 40);
      P.add(K.DEBRIS, p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(1.5, 3), this.rnd(0.05, 0.12), { drag: 0.2, grav: 1 }); }
  }

  // flame and spall blowing back out of a penetration hole
  holeFlame(v, h, dt) {
    if (h.t <= 0) return;
    const P = this.P, K = DS.P, p = v.spotWorld(h), k = Math.min(1, h.t);
    let n = 90 * k * dt;
    while (n-- >= 0) {
      const sp = this.rnd(4, 16) * k;
      P.add(K.FIRE, p.x, p.y, h.nx * sp + this.rnd(-2, 2), h.ny * sp + this.rnd(0, 3), this.rnd(0.12, 0.35), this.rnd(0.2, 0.5),
        { grow: 1.5, drag: 2.5, grav: -0.1, alpha: 1, col: Math.random() < 0.5 ? 0xffc060 : 0xff8030 });
    }
    if (Math.random() < 10 * dt) P.add(K.DARK, p.x, p.y + 0.3, h.nx * 2, this.rnd(1, 3), this.rnd(4, 8), 0.5, { grow: 0.8, drag: 0.8, grav: -0.03, alpha: 0.4, col: 0x2a2622 });
  }

  explode(v) {
    const P = this.P, K = DS.P;
    const p = v.local(v.g.ring.x, v.g.ring.y);
    this.flashes.push({ x: p.x, y: p.y + 1, dx: 0, dy: 1, t: 0, ttl: 0.18, boom: true, big: true });
    for (let i = 0; i < 140; i++) {
      const a = this.rnd(0, Math.PI), sp = this.rnd(4, 30);
      P.add(K.FIRE, p.x + this.rnd(-1, 1), p.y + this.rnd(0, 1.5), Math.cos(a) * sp * 0.7, Math.sin(a) * sp, this.rnd(0.2, 0.9), this.rnd(0.6, 1.6),
        { grow: 3, drag: 3, grav: -0.05, alpha: 1, col: Math.random() < 0.5 ? 0xff9a3c : 0xffd27a });
    }
    for (let i = 0; i < 40; i++) {
      const a = this.rnd(0.2, Math.PI - 0.2), sp = this.rnd(3, 14);
      P.add(K.DARK, p.x + this.rnd(-1, 1), p.y + this.rnd(0.5, 3), Math.cos(a) * sp * 0.6, Math.sin(a) * sp, this.rnd(7, 13), this.rnd(1, 1.8),
        { grow: 0.8, drag: 0.7, grav: -0.03, alpha: 0.45, col: 0x24201c });
    }
    for (let i = 0; i < 45; i++) {
      const a = this.rnd(0.2, Math.PI - 0.2), sp = this.rnd(8, 35);
      P.add(K.DEBRIS, p.x, p.y + 0.5, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(2, 5), this.rnd(0.06, 0.25), { drag: 0.15, grav: 1 });
    }
    this.shake = Math.max(this.shake, Math.max(0.2, 1.2 - Math.abs(p.x - this.w.cam.x) / 400));
  }

  // armour strike visuals: sparks for ricochet / non-penetration, flash + smoke for penetration
  armor(r) {
    const P = this.P, K = DS.P, x = r.x, y = r.y;
    const n = r.result === 'pen' ? 30 : 45;
    for (let i = 0; i < n; i++) {
      const a = this.rnd(0, Math.PI * 2), sp = this.rnd(5, 40);
      P.add(K.FIRE, x, y, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(0.05, 0.25), this.rnd(0.05, 0.15), { grow: 0, drag: 2, grav: 0.6, alpha: 1, col: 0xffe2a0 });
    }
    if (r.ammo.type === 'HEAT' && r.result !== 'ricochet') {
      this.flashes.push({ x, y, dx: 0, dy: 1, t: 0, ttl: 0.08, boom: true });
      for (let i = 0; i < 16; i++) P.add(K.DARK, x + this.rnd(-0.5, 0.5), y + this.rnd(0, 1), this.rnd(-1, 1), this.rnd(0.5, 3), this.rnd(3, 6), 0.6, { grow: 0.8, drag: 1, grav: -0.02, alpha: 0.4, col: 0x35302b });
    }
    if (r.result === 'pen') {
      this.flashes.push({ x, y, dx: 0, dy: 1, t: 0, ttl: 0.06, boom: true });
      for (let i = 0; i < 10; i++) P.add(K.SMOKE, x, y, this.rnd(-2, 2), this.rnd(0, 3), this.rnd(2, 4), 0.4, { grow: 0.6, drag: 1, grav: -0.02, alpha: 0.35, col: 0x8a857c });
    }
    this.labels.push({ x, y: y + 1.2, t: 0, r });
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
    if (!hit.onArmor) { T.crater(hit.x + Math.cos(ang) * 0.4, heat ? 1.3 : 0.8, heat ? 0.55 : 0.3); T.relax(undefined, undefined, 4); }
    // plume: KE → tall narrow column thrown along the ricochet direction; HE/HEAT → radial
    const n = hit.onArmor ? 20 : heat ? 160 : 120;
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

  update(dt) { for (const f of this.flashes) f.t += dt; this.flashes = this.flashes.filter(f => f.t < f.ttl);
    for (const l of this.labels) l.t += dt; this.labels = this.labels.filter(l => l.t < 4); this.shake = Math.max(0, this.shake - dt * 2.5); }

  drawFlashes(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    // flickering light cast by fires on the hull and the sand around them
    for (const v of this.w.vehicles) {
      if (!v.burning && !(v.jet > 0)) continue;
      const p = v.fireSource(), t = this.w.time;
      const k = Math.min(1, v.burning / 2 + (v.jet > 0 ? 1 : 0)) * (0.75 + 0.25 * Math.sin(t * 13) * Math.sin(t * 5.7));
      const R = v.jet > 0 ? 16 : 9;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
      g.addColorStop(0, `rgba(255,150,60,${0.32 * k})`); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2);
    }
    for (const f of this.flashes) {
      const k = 1 - f.t / f.ttl, a = Math.atan2(f.dy, f.dx);
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(a);
      // primary/intermediate flash: elongated along the bore, secondary: fat ball ahead of the muzzle
      const L = f.big ? 7 : f.boom ? 2.5 : 3.6 * (0.7 + 0.3 * k);
      let g = ctx.createRadialGradient(L * 0.45, 0, 0, L * 0.45, 0, L);
      g.addColorStop(0, `rgba(255,250,220,${0.95 * k})`); g.addColorStop(0.25, `rgba(255,200,90,${0.85 * k})`);
      g.addColorStop(0.6, `rgba(255,120,30,${0.45 * k})`); g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g; ctx.scale(1, f.boom ? 1 : 0.55); ctx.beginPath(); ctx.arc(L * 0.45, 0, L, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // ambient light splash
      const R = f.big ? 40 : 14;
      g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
      g.addColorStop(0, `rgba(255,180,90,${0.35 * k})`); g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - R, f.y - R, R * 2, R * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
};
