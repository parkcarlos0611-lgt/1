// Effect emitters driven by simulation state: track sand / rooster tail, turbine exhaust,
// muzzle flash + blast dust + gun smoke + sabot petals, ground impacts.
DS.Effects = class Effects {
  constructor(world) {
    world.particles.onLand = (x, y, sz, vx, vy) => this.landed(x, y, sz, vx, vy);
    this.w = world; this.P = world.particles; this.flashes = []; this.labels = []; this.blasts = []; this.waves = []; this.acc = 0; this.shake = 0; }
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
    const vt = Math.abs(v.vt), rate = (vt * 16 + v.stats.slip * 90) * soil.dust;
    let n = rate * dt + Math.random();
    const dir = fwd ? -1 : 1, sc0 = this.hex(soil.col[0]);
    // rooster tail: grains flung up and back off the trailing end, higher with speed
    while (n-- >= 1) {
      const vv = vt * this.rnd(0.25, 0.8) + v.stats.slip * 1.6;
      P.add(K.GRAIN, ex + this.rnd(-0.3, 0.3), ey + this.rnd(0, 0.5), v.vel.x * 0.35 + dir * vv * 0.55, this.rnd(1.2, 3) + vv * 0.6,
        this.rnd(0.6, 1.6), this.rnd(0.03, 0.07), { drag: 0.55, grav: 1, col: Math.random() < 0.5 ? sc : sc0 });
    }
    // dust tail: billows off the trailing end and along the hull; at speed it swallows the back of the vehicle
    let nd = (speed * 7 + v.stats.slip * 20) * (0.4 + soil.dust) * dt + Math.random() * 0.6 * Math.min(1, speed);
    while (nd-- >= 1) {
      const lx = (fwd ? -1 : 1) * this.rnd(1.2, 4.2) * (speed > 8 ? 1 : 0.7) + (fwd ? end.lx * 0.4 : end.lx * 0.4);
      const x = v.pos.x + c * lx;
      P.add(K.DUST, x, T.height(x) + this.rnd(0.2, 1.4) * (0.6 + speed / 15), v.vel.x * 0.25 + dir * this.rnd(0.5, 2.5), this.rnd(0.3, 1.4),
        this.rnd(4, 9), this.rnd(0.9, 1.8) * (0.7 + speed / 20), { grow: this.rnd(0.7, 1.4), drag: 1.1, grav: 0, alpha: 0.55 * Math.min(1, speed / 6 + 0.1), col: Math.random() < 0.5 ? 0xeadcbf : sc0 });   // airborne dust reads paler than the sand
    }
    // hard braking or a sudden reversal: a lump of sand spills off the leading end
    const dv = (v.vt - (v._vtPrev ?? v.vt)) / Math.max(1e-3, dt); v._vtPrev = v.vt;
    if (Math.abs(dv) > 4 && vt > 1.5) {
      const lead = fwd ? ends[1] : ends[0], q = v.local(lead.x + (fwd ? 0.2 : -0.2), lead.y - 0.3);
      for (let i = 0; i < Math.min(14, Math.abs(dv)); i++) P.add(K.GRAIN, q.x, q.y, v.vel.x + (fwd ? 1 : -1) * this.rnd(1, 4), this.rnd(0.5, 2.5), this.rnd(0.5, 1.2), this.rnd(0.04, 0.08), { drag: 0.5, col: sc });
      if (Math.random() < 0.5) P.add(K.DUST, q.x, q.y, v.vel.x * 0.5, this.rnd(0.3, 1), this.rnd(3, 6), 0.8, { grow: 0.8, drag: 1.2, grav: 0, alpha: 0.3, col: sc });
    }
    // cresting: when an end of the track lifts off the sand, what clung to it pours off
    for (const k of [0, v.st.length - 1]) {
      const w = v.st[k];
      if (!w.contact && vt > 1 && Math.random() < dt * 25) {
        P.add(K.GRAIN, w.wx + this.rnd(-0.3, 0.3), w.wy - D.wheelR, v.vel.x * 0.8, this.rnd(-0.5, 0.5), this.rnd(0.6, 1.2), this.rnd(0.03, 0.06), { drag: 0.3, col: sc });
      }
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
    for (const e of v.events) { if (e.type === 'fire') this.muzzle(v, e); else if (e.type === 'mg') this.mgFire(v, e); else if (e.type === 'tow') this.towLaunch(v, e); else if (e.type === 'explode') this.explode(v); else if (e.type === 'pillar') this.pillar(v); else if (e.type === 'turretLand') this.turretLand(e); }
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
    // thick black smoke: big rolling lumps that keep coming, leaning over in the wind as they climb
    let m = 14 * f * surge * dt + Math.random() * 0.4;
    while (m-- >= 1) P.add(K.DARK, p.x + this.rnd(-0.8, 0.8), p.y + this.rnd(0.6, 1.6), this.rnd(-0.4, 0.4), this.rnd(2.5, 5.5), this.rnd(14, 26), this.rnd(0.9, 1.7),
      { grow: this.rnd(0.7, 1.3), drag: 0.32, grav: -0.03, alpha: 0.58, col: Math.random() < 0.45 ? 0x1a1816 : Math.random() < 0.6 ? 0x2c2825 : 0x45403a });
    // fuel and rubber burning low down: flames lick out between the road wheels
    if (age > 3) {
      let r = 10 * f * dt;
      while (r-- >= 0 && Math.random() < 0.9) {
        const w = v.st[(Math.random() * v.st.length) | 0];
        P.add(K.FIRE, w.wx + this.rnd(-0.4, 0.4), w.wy + this.rnd(-0.1, 0.3), this.rnd(-0.4, 0.4), this.rnd(1, 3), this.rnd(0.2, 0.45), this.rnd(0.25, 0.5),
          { grow: 0.7, drag: 1.5, grav: -0.1, alpha: 0.75, col: Math.random() < 0.5 ? 0xff7a28 : 0xffb050 });
        if (Math.random() < 0.3) P.add(K.DARK, w.wx, w.wy + 0.6, this.rnd(-0.3, 0.3), this.rnd(1.5, 3), this.rnd(8, 14), 0.6, { grow: 0.7, drag: 0.4, grav: -0.03, alpha: 0.45, col: 0x221f1c });
      }
    }
    // the thrown turret burns too
    const tb = v.turretBody;
    if (tb && v.burning < 90) {
      const k2 = Math.max(0, 1 - v.burning / 90);
      if (Math.random() < 14 * k2 * dt) P.add(K.FIRE, tb.x + this.rnd(-0.6, 0.6), tb.y + this.rnd(0, 0.4), this.rnd(-0.4, 0.4), this.rnd(1, 3), this.rnd(0.2, 0.5), this.rnd(0.25, 0.5),
        { grow: 0.6, drag: 1.5, grav: -0.1, alpha: 0.75, col: 0xff8a30 });
      if (Math.random() < 6 * k2 * dt) P.add(K.DARK, tb.x, tb.y + 0.8, this.rnd(-0.3, 0.3), this.rnd(2, 4), this.rnd(10, 18), this.rnd(0.6, 1.1), { grow: 0.8, drag: 0.35, grav: -0.03, alpha: 0.5, col: 0x26221f });
    }
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
    { const q = v.local(v.g.ring.x, v.g.ring.y); DS.Audio.explode(q.x, q.y); }
    const P = this.P, K = DS.P;
    const p = v.local(v.g.ring.x, v.g.ring.y);
    this.blast(p.x, p.y, 2.2, null, null);
    this.flashes.push({ x: p.x, y: p.y + 1, dx: 0, dy: 1, t: 0, ttl: 0.14, boom: true, big: true });
    for (let i = 0; i < 140; i++) {
      const a = this.rnd(0, Math.PI), sp = this.rnd(4, 30);
      P.add(K.FIRE, p.x + this.rnd(-1, 1), p.y + this.rnd(0, 1.5), Math.cos(a) * sp * 0.7, Math.sin(a) * sp, this.rnd(0.2, 0.8), this.rnd(0.5, 1.3),
        { grow: 2.4, drag: 3, grav: -0.05, alpha: 0.7, col: Math.random() < 0.55 ? 0xff7a28 : 0xffc060 });
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

  // machine-gun round leaving the muzzle: small flash, a wisp of smoke, brass thrown clear of the receiver
  mgFire(v, e) {
    const P = this.P, K = DS.P;
    DS.Audio.mg(e.x, e.y, e.heavy);
    this.flashes.push({ x: e.x, y: e.y, dx: e.dx, dy: e.dy, t: 0, ttl: 0.035, small: e.heavy ? 0.9 : 0.6 });
    for (let i = 0; i < 2; i++) P.add(K.SMOKE, e.x + e.dx * 0.3, e.y + e.dy * 0.3, e.dx * this.rnd(3, 8), e.dy * this.rnd(3, 8) + this.rnd(0, 1), this.rnd(0.8, 1.6), 0.12,
      { grow: 0.35, drag: 3, grav: -0.02, alpha: 0.25, col: 0xd9d6cf });
    const bx = e.x - e.dx * (e.heavy ? 1.5 : 0.8), by = e.y - e.dy * (e.heavy ? 1.5 : 0.8);
    P.add(K.GRAIN, bx, by, -e.dy * this.rnd(1.5, 3) + v.vel.x, this.rnd(2, 4), this.rnd(1.5, 2.5), e.heavy ? 0.06 : 0.04, { drag: 0.1, grav: 1, col: 0xd9a63c });
  }
  // 25 mm chain gun: sharp flash, smoke puff, link/case thrown out
  cannon(v, e) {
    const P = this.P, K = DS.P;
    this.blast(e.x, e.y, 0.06, e.dx, e.dy);
    DS.Audio.cannon(e.x, e.y);
    this.flashes.push({ x: e.x, y: e.y, dx: e.dx, dy: e.dy, t: 0, ttl: 0.05, small: 1.5 });
    for (let i = 0; i < 5; i++) P.add(K.SMOKE, e.x, e.y, e.dx * this.rnd(4, 18) + this.rnd(-1, 1), e.dy * this.rnd(4, 18) + this.rnd(-1, 1), this.rnd(1, 2.2), 0.18,
      { grow: 0.5, drag: 3, grav: -0.02, alpha: 0.28, col: 0xd9d6cf });
    P.add(K.GRAIN, e.x - e.dx * 1.6, e.y - e.dy * 1.6 + 0.1, -e.dx * this.rnd(1, 2) + v.vel.x, this.rnd(2, 4), 2, 0.07, { drag: 0.1, grav: 1, col: 0xd9a63c });
    this.shake = Math.max(this.shake, 0.08);
  }
  towLaunch(v, e) {
    const P = this.P, K = DS.P, dx = Math.cos(e.a), dy = Math.sin(e.a);
    this.blast(e.x - dx * 1.2, e.y, 0.25, -dx, -dy);                 // back-blast scours behind the launcher
    DS.Audio.tow(e.x, e.y);
    this.flashes.push({ x: e.x, y: e.y, dx, dy, t: 0, ttl: 0.09, small: 2.2 });
    for (let i = 0; i < 40; i++) { const back = Math.random() < 0.6 ? -1 : 1, sp = this.rnd(3, 22);       // back-blast and front puff
      P.add(K.SMOKE, e.x - dx * (back < 0 ? 1.2 : 0), e.y - dy * (back < 0 ? 1.2 : 0), dx * sp * back + this.rnd(-2, 2), dy * sp * back + this.rnd(-1, 2), this.rnd(2, 4.5), 0.35,
        { grow: 0.9, drag: 2.5, grav: -0.02, alpha: 0.35, col: 0xdedad2 }); }
    this.shake = Math.max(this.shake, 0.25);
  }
  missile(m, dt) {
    const P = this.P, K = DS.P, bx = m.x - Math.cos(m.ang) * 0.6, by = m.y - Math.sin(m.ang) * 0.6;
    if (m.t < 1.7) for (let i = 0; i < 3; i++) P.add(K.FIRE, bx, by, -m.vx * 0.1 + this.rnd(-1, 1), -m.vy * 0.1 + this.rnd(-1, 1), this.rnd(0.06, 0.14), 0.22, { grow: 1, drag: 3, grav: 0, alpha: 0.9, col: 0xffc070 });
    if (Math.random() < dt * 60) P.add(K.SMOKE, bx, by, this.rnd(-0.5, 0.5), this.rnd(-0.2, 0.6), this.rnd(1.2, 2.4), 0.14, { grow: 0.35, drag: 1.5, grav: -0.01, alpha: m.t < 1.7 ? 0.3 : 0.1, col: 0xdedad2 });
  }
  bulletGround(h) {
    const P = this.P, K = DS.P, T = this.w.terrain, sc = this.hex(T.soilAt(h.x).col[1]);
    if (h.ammo.pen.ce) this.smallHE(h.x, h.y + 0.1, true);
    DS.Audio.bullet(h.x, h.y);
    for (let i = 0; i < 5; i++) P.add(K.GRAIN, h.x, h.y + 0.05, this.rnd(-1.5, 1.5) + h.vx * 0.003, this.rnd(1.5, 4), this.rnd(0.3, 0.7), 0.035, { drag: 0.5, col: sc });
    P.add(K.DUST, h.x, h.y + 0.15, this.rnd(-0.5, 0.5), this.rnd(0.3, 1), this.rnd(1, 2), 0.18, { grow: 0.5, drag: 1.5, grav: 0, alpha: 0.35, col: sc });
  }
  bulletArmor(r) {
    const P = this.P, K = DS.P;
    if (r.ammo.pen.ce && r.result !== 'ricochet') this.smallHE(r.x, r.y, false);
    if (r.ammo.d > 0.01 && r.result === 'pen') this.labels.push({ x: r.x, y: r.y + 1, t: 2.6, r });
    DS.Audio.bullet(r.x, r.y);
    for (let i = 0; i < 6; i++) { const a = this.rnd(0, 6.28), sp = this.rnd(3, 14);
      P.add(K.FIRE, r.x, r.y, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(0.05, 0.15), 0.04, { grow: 0, drag: 2, grav: 0.6, alpha: 1, col: 0xffe2a0 }); }
  }

  // 25 mm HEI burst
  smallHE(x, y, ground) {
    const P = this.P, K = DS.P;
    if (ground) this.blast(x, y + 0.1, 0.08, null, null);
    this.flashes.push({ x, y, dx: 0, dy: 1, t: 0, ttl: 0.05, small: 0.9 });
    for (let i = 0; i < 7; i++) { const a = this.rnd(0, Math.PI), sp = this.rnd(2, 9); P.add(K.FIRE, x, y, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(0.05, 0.14), 0.18, { grow: 2, drag: 6, grav: 0, alpha: 0.9, col: 0xffb050 }); }
    P.add(K.DARK, x, y + 0.2, this.rnd(-0.5, 0.5), this.rnd(0.5, 1.5), this.rnd(1.2, 2.2), 0.3, { grow: 0.6, drag: 1.2, grav: -0.02, alpha: 0.35, col: 0x3a3631 });
    if (ground) { this.w.terrain.crater(x, 0.3, 0.06, 0.3, 0); DS.Audio.ground(x, y, false); }
  }

  // armour strike visuals: sparks for ricochet / non-penetration, flash + smoke for penetration
  armor(r) {
    DS.Audio.armor(r, r.vehicle === this.w.vehicles[0]);
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
    if (e.ammo.small) return this.cannon(v, e);                     // 25 mm chain gun (not the M1A1's narrow APFSDS rod)
    const P = this.P, K = DS.P, T = this.w.terrain;
    DS.Audio.gun(e.x, e.y, parseInt((v.def.gun.name.match(/(\d+)mm/) || [0, 120])[1]));
    this.flashes.push({ x: e.x, y: e.y, dx: e.dx, dy: e.dy, t: 0, ttl: 0.085 });
    this.shake = Math.max(this.shake, 0.6);
    const big = v.def.gun.recoilMass > 1500 ? 1 : 0.55, ang = Math.atan2(e.dy, e.dx), sc = this.hex(T.soilAt(e.x).col[1]), sc2 = this.hex(T.soilAt(e.x).col[0]);
    // secondary flash: the propellant gases re-ignite a few metres ahead as a big round fireball
    this.flashes.push({ x: e.x + e.dx * 3.5 * big, y: e.y + e.dy * 3.5 * big, dx: 0, dy: 1, t: 0, ttl: 0.16, boom: true, big: big > 0.9 });
    for (let i = 0; i < 46 * big; i++) {
      const d = this.rnd(0.5, 6.5) * big, a = this.rnd(0, Math.PI * 2), r = this.rnd(0, 1.6) * big, sp = this.rnd(2, 9);
      P.add(K.FIRE, e.x + e.dx * d + Math.cos(a) * r, e.y + e.dy * d + Math.sin(a) * r, Math.cos(a) * sp + e.dx * 12, Math.sin(a) * sp + e.dy * 12,
        this.rnd(0.14, 0.32), this.rnd(0.9, 2.0) * big, { grow: 5, drag: 9, grav: 0, alpha: 0.42, col: Math.random() < 0.3 ? 0xffd890 : Math.random() < 0.6 ? 0xffa548 : 0xe8702a });
    }
    // the fireball turns into a big pale cloud of gun smoke ahead of the muzzle that lingers and drifts
    for (let i = 0; i < 70 * big; i++) {
      const d = this.rnd(0, 11) * big, a = this.rnd(0, Math.PI * 2), r = this.rnd(0, 2.2) * big * Math.min(1, 0.3 + d / 6), sp = this.rnd(1, 7);
      P.add(K.SMOKE, e.x + e.dx * d + Math.cos(a) * r, e.y + e.dy * d + Math.sin(a) * r, Math.cos(a) * sp + e.dx * (14 - d), Math.sin(a) * sp + this.rnd(0, 1.5),
        this.rnd(5, 11), this.rnd(0.7, 1.6) * big, { grow: this.rnd(0.6, 1.3), drag: 2.4, grav: -0.02, alpha: 0.42, col: Math.random() < 0.5 ? 0xe2ddd2 : 0xd6c8ae });
    }
    // side blast: a ring of smoke pushed out around the muzzle
    for (let i = 0; i < 26 * big; i++) {
      const a = this.rnd(0, Math.PI * 2), sp = this.rnd(8, 22);
      P.add(K.SMOKE, e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(2, 4), 0.45 * big, { grow: 0.9, drag: 4, grav: 0, alpha: 0.3, col: 0xcfc9bf });
    }
    // overpressure sweeps the sand under and ahead of the gun: a ring of dust 2-4 m high running outward
    const gy = T.height(e.x), hgt = e.y - gy;
    if (hgt < 6) {
      const k = (6 - hgt) / 6 * big;
      for (let i = 0; i < 90 * k; i++) {
        const x = e.x + this.rnd(-5, 16) * big, away = Math.sign(x - e.x + 0.5), near = 1 - Math.min(1, Math.abs(x - e.x - 4) / 14);
        P.add(K.DUST, x, T.height(x) + this.rnd(0, 0.5), away * this.rnd(3, 14) * (0.5 + near), this.rnd(1.5, 5) * (0.4 + near),
          this.rnd(4, 9), this.rnd(0.7, 1.6), { grow: this.rnd(0.7, 1.4), drag: 1.4, grav: 0, alpha: 0.32 + 0.12 * near, col: Math.random() < 0.6 ? sc : sc2 });
        if (i % 2 === 0) P.add(K.GRAIN, x, T.height(x) + 0.05, away * this.rnd(3, 10), this.rnd(2.5, 7) * (0.4 + near), this.rnd(0.5, 1.2), 0.05, { drag: 0.4, col: sc });
      }
    }
    this.blast(e.x, e.y, big > 0.9 ? 1.6 : 0.35, e.dx, e.dy);
    // sabot petals peel off in the first metres
    if (e.ammo.sabot) for (let i = 0; i < 3; i++) {
      const a = Math.atan2(e.dy, e.dx) + (i - 1) * 0.06 + this.rnd(-0.02, 0.02), sp = this.rnd(250, 600);
      P.add(K.DEBRIS, e.x + e.dx * 3, e.y + e.dy * 3, Math.cos(a) * sp, Math.sin(a) * sp + this.rnd(2, 8), 4, 0.25, { drag: 1.6, grav: 1, sabot: 1 });
    }
  }

  impact(hit) {
    if (!hit.onArmor) DS.Audio.ground(hit.x, hit.y, hit.ammo.type === 'HEAT');
    const P = this.P, K = DS.P, T = this.w.terrain, A = hit.ammo;
    const heat = A.type === 'HEAT';
    const sc = this.hex(T.soilAt(hit.x).col[1]), sc2 = this.hex(T.soilAt(hit.x).col[0]);
    const v = Math.hypot(hit.vx, hit.vy), ang = Math.atan2(hit.vy, hit.vx);
    this.blast(hit.x, hit.y + 0.2, heat ? 0.9 : 0.45, null, null);
    let ej = 0;
    if (!hit.onArmor) { ej = T.crater(hit.x + Math.cos(ang) * 0.4, heat ? 1.3 : 0.8, heat ? 0.55 : 0.3); T.relax(undefined, undefined, 4); }
    // plume: KE → tall narrow column thrown along the ricochet direction; HE/HEAT → radial
    const n = hit.onArmor ? 20 : heat ? 160 : 120;
    for (let i = 0; i < n; i++) {
      let a, sp;
      if (heat) { a = Math.PI / 2 + this.rnd(-1.1, 1.1); sp = this.rnd(5, 30); }
      else { a = Math.PI / 2 + Math.sign(hit.vx) * this.rnd(-0.15, 0.55); sp = this.rnd(8, 45) * Math.min(1.3, v / 1200); }
      P.add(K.GRAIN, hit.x, hit.y + 0.1, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(1, 3.2), this.rnd(0.04, 0.12), { drag: 0.25, col: Math.random() < 0.5 ? sc : sc2, mass: ej / n });   // ejecta lands as sand
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

  // sandstorm: dust sheets and sand streaks blowing through the view
  ambient(dt) {
    const env = this.w.env || {}, cam = this.w.cam, P = this.P, K = DS.P;
    if (!env.visibility) return;
    const span = cam.right - cam.left, wind = this.w.wind;
    let n = 0.6 * span * dt;
    while (n-- >= 0 && Math.random() < 0.95) {
      const x = cam.left - 5 + Math.random() * (span + 10), y = cam.bottom + Math.random() * (cam.top - cam.bottom);
      P.add(K.DUST, x, y, wind * this.rnd(0.7, 1.2), this.rnd(-0.5, 0.8), this.rnd(3, 6), this.rnd(1.5, 4) * Math.max(1, span / 60),
        { grow: 0.3, drag: 0.6, grav: 0, alpha: 0.12, col: 0xc89a62 });
    }
    let g = 3 * span * dt;
    while (g-- >= 0) {
      const x = cam.left + Math.random() * span, h = this.w.terrain.height(x);
      P.add(K.GRAIN, x, h + this.rnd(0, 3), wind * this.rnd(1, 1.6), this.rnd(0, 1.5), this.rnd(0.6, 1.4), this.rnd(0.03, 0.06), { drag: 0.8, grav: 0.3, col: 0xd6b07a });
    }
  }

  // flame pillar straight up out of the open turret ring as the turret leaves
  pillar(v) {
    const P = this.P, K = DS.P, p = v.local(v.g.ring.x, v.g.ring.y);
    for (let i = 0; i < 90; i++) { const sp = this.rnd(10, 32), a = Math.PI / 2 + v.ang + this.rnd(-0.12, 0.12);
      P.add(K.FIRE, p.x + this.rnd(-0.6, 0.6), p.y + this.rnd(0, 2), Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(0.3, 0.8), this.rnd(0.7, 1.5),
        { grow: 2.2, drag: 1.4, grav: -0.05, alpha: 0.7, col: Math.random() < 0.4 ? 0xffd890 : 0xff8a30 }); }
    for (let i = 0; i < 25; i++) P.add(K.DARK, p.x + this.rnd(-1, 1), p.y + this.rnd(4, 14), this.rnd(-1, 1), this.rnd(3, 7), this.rnd(12, 20), this.rnd(1.2, 2.2),
      { grow: 1, drag: 0.4, grav: -0.03, alpha: 0.55, col: 0x1e1b18 });
  }
  // a thrown turret hitting the ground: sand thrown up, a dust cloud, a dull thud
  turretLand(e) {
    const P = this.P, K = DS.P, T = this.w.terrain, sc = this.hex(T.soilAt(e.x).col[1]), k = Math.min(1.5, e.v / 10);
    DS.Audio.ground(e.x, e.y, false);
    for (let i = 0; i < 50 * k; i++) { const a = Math.PI / 2 + this.rnd(-1.1, 1.1), sp = this.rnd(2, 9) * k;
      P.add(K.GRAIN, e.x + this.rnd(-1, 1), e.y + 0.1, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(0.6, 1.4), this.rnd(0.04, 0.09), { drag: 0.4, col: sc }); }
    for (let i = 0; i < 14 * k; i++) P.add(K.DUST, e.x + this.rnd(-1.5, 1.5), e.y + this.rnd(0.2, 1), this.rnd(-3, 3), this.rnd(0.5, 2.5), this.rnd(4, 8), this.rnd(0.8, 1.5),
      { grow: 0.9, drag: 1.2, grav: 0, alpha: 0.4, col: 0xe2d3b4 });
    this.shake = Math.max(this.shake, Math.max(0, 0.4 - Math.abs(e.x - this.w.cam.x) / 200));
  }
  // debris (sabot petals, fragments, a thrown turret's bits) hitting the sand: a small puff and spray
  landed(x, y, sz, vx, vy) {
    const P = this.P, K = DS.P, sc = this.hex(this.w.terrain.soilAt(x).col[1]), e = Math.min(1, Math.abs(vy) / 15) * Math.min(2, sz * 6);
    if (e < 0.05) return;
    for (let i = 0; i < 6 * e; i++) P.add(K.GRAIN, x, y + 0.05, vx * 0.2 + this.rnd(-2, 2), this.rnd(1, 4) * e, this.rnd(0.4, 0.9), 0.04, { drag: 0.5, col: sc });
    P.add(K.DUST, x, y + 0.2, vx * 0.1, this.rnd(0.3, 1), this.rnd(2, 4), 0.35 + 0.4 * e, { grow: 0.6, drag: 1.5, grav: 0, alpha: 0.3, col: sc });
  }

  // ---- blast waves (E7) ----
  // str: 1 ≈ a 120 mm muzzle blast. dx, dy: direction of a muzzle (null = all round). The front advances at
  // 343 m/s; each ground cell it crosses throws up sand in proportion to the overpressure there (falling off
  // with distance), to the soil (soft sand most, salt flat least) and to how squarely the slope faces the blast.
  // Strong blasts also scour the surface and drop the sand a little further out (sand is conserved).
  blast(x, y, str, dx, dy) {
    this.blasts.push({ x, y, str, dx: dx || 0, dy: dy || 0, dir: dx != null && dx !== 0, r: 0, max: 22 * Math.sqrt(str) + 6 });
    if (str >= 0.2) this.waves.push({ x, y, str, t: 0, max: 22 * Math.sqrt(str) + 6 });   // visible air ripple (post-processing)
  }
  stepBlasts(dt) {
    const T = this.w.terrain, P = this.P, K = DS.P, cell = 0.5;
    for (const b of this.blasts) {
      const r0 = b.r, r1 = Math.min(b.max, b.r + DS.T.sound * dt);
      b.r = r1;
      for (const side of [-1, 1]) {
        for (let d = Math.ceil(r0 / cell) * cell; d < r1; d += cell) {
          const x = b.x + side * d, gy = T.height(x), dist = Math.hypot(d, b.y - gy) + 0.6;
          let p = b.str * 40 / Math.pow(dist, 1.4);                         // overpressure, arbitrary units
          if (b.dir) { const c = (side * d * b.dx + (gy - b.y) * b.dy) / dist; p *= 0.25 + 0.75 * Math.max(0, c); }
          const n = -(T.height(x + 0.3) - T.height(x - 0.3)) / 0.6, face = Math.max(0.3, 1 + side * n * 1.5);  // slope facing the source
          const soil = T.soilAt(x), q = p * soil.dust * face;
          if (q < 0.05) continue;
          const sc = this.hex(soil.col[Math.random() < 0.5 ? 0 : 1]), out = side * Math.min(14, 3 + q * 6);
          // fine dust: lifted high, hangs; coarse grains: low, fall back
          let nd = Math.min(3, q * 1.6) + Math.random() - 0.5;
          while (nd-- > 0) P.add(K.DUST, x + this.rnd(-0.25, 0.25), gy + this.rnd(0.05, 0.4), out * this.rnd(0.4, 1), this.rnd(0.6, 2.5) * Math.min(2, 0.6 + q),
            this.rnd(3, 8), this.rnd(0.35, 0.8), { grow: this.rnd(0.5, 1.1), drag: 1.3, grav: 0, alpha: Math.min(0.42, 0.14 + q * 0.12), col: sc });
          let ng = Math.min(4, q * 2.5) + Math.random() - 0.5;
          while (ng-- > 0) P.add(K.GRAIN, x, gy + 0.03, out * this.rnd(0.3, 1), this.rnd(1.5, 5) * Math.min(1.6, 0.5 + q), this.rnd(0.5, 1.2), this.rnd(0.025, 0.05), { drag: 0.45, col: sc });
          if (q > 1.2) {                                                    // scour and redeposit a few cm further out
            const i = T.idx(x), j = T.idx(x + side * this.rnd(1, 3)), e = Math.min(0.03, (q - 1.2) * 0.008);
            T.h[i] -= e; T.h[j] += e; T.disturb[i] = Math.min(1, T.disturb[i] + 0.05); T.mark(i); T.mark(j);
          }
        }
      }
    }
    this.blasts = this.blasts.filter(b => b.r < b.max);
  }

  update(dt) { this.stepBlasts(dt); for (const w of this.waves) w.t += dt; this.waves = this.waves.filter(w => w.t < 0.4); for (const f of this.flashes) f.t += dt; this.flashes = this.flashes.filter(f => f.t < f.ttl);
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
      const L = f.small ? f.small : f.big ? 7 : f.boom ? 2.5 : 3.6 * (0.7 + 0.3 * k);
      let g = ctx.createRadialGradient(L * 0.45, 0, 0, L * 0.45, 0, L);
      g.addColorStop(0, `rgba(255,250,220,${0.95 * k})`); g.addColorStop(0.25, `rgba(255,200,90,${0.85 * k})`);
      g.addColorStop(0.6, `rgba(255,120,30,${0.45 * k})`); g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g; ctx.scale(1, f.boom ? 1 : 0.55); ctx.beginPath(); ctx.arc(L * 0.45, 0, L, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // ambient light splash
      const R = f.small ? 3 : f.big ? 40 : 14;
      g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
      g.addColorStop(0, `rgba(255,180,90,${0.35 * k})`); g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - R, f.y - R, R * 2, R * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
};
