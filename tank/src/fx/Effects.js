// Effect emitters driven by simulation state: track sand / rooster tail, turbine exhaust,
// muzzle flash + blast dust + gun smoke + sabot petals, ground impacts.
DS.Effects = class Effects {
  constructor(world) {
    world.particles.onLand = (x, y, sz, vx, vy) => this.landed(x, y, sz, vx, vy);
    this.w = world; this.P = world.particles; this.flashes = []; this.labels = []; this.blasts = []; this.waves = []; this.acc = 0; this.shake = 0; }
  rnd(a, b) { return a + Math.random() * (b - a); }
  hex(s) { return parseInt(s.slice(1), 16); }

  dispatch(v) {
    for (const e of v.events) { if (e.type === 'fire') this.muzzle(v, e); else if (e.type === 'mg') this.mgFire(v, e); else if (e.type === 'tow') this.towLaunch(v, e); else if (e.type === 'explode') this.explode(v); else if (e.type === 'pillar') this.pillar(v); else if (e.type === 'rocket') this.rocketLaunch(v, e); else if (e.type === 'case') this.ejectCase(v, e); else if (e.type === 'autoload') DS.Audio.autoload(v); else if (e.type === 'trackSnap') this.trackSnap(e); else if (e.type === 'turretLand') this.turretLand(e); }
    v.events.length = 0;
  }
  vehicle(v, dt) {
    if (v.heli) return this.heliFx(v, dt);
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
    this.dispatch(v);
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
    // ammunition going up: a rolling fireball that climbs into a mushroom of black smoke, a fountain of sparks
    // (burning propellant), fragments arcing away on smoke trails
    this.fireball(p.x, p.y + 1, 22, 2.4, 15, 0x1f1b18, 7, 0.9);
    this.fireball(p.x, p.y + 3, 12, 2.0, 8, 0x2a2420, 10, 2.0);
    this.sparks(p.x, p.y + 0.8, 150, 62, Math.PI / 2, 2.2); this.sparks(p.x, p.y + 0.8, 60, 30, Math.PI / 2, 1.0, 0xffe9b0);
    this.comets(p.x, p.y + 1, 12, 36);
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
    // sparks: a tight cone back along the shot for a hit that holds or glances off, a fuller burst for a penetration
    const back = Math.atan2(-(r.shotDy || 0), -(r.shotDx || -1));
    if (r.result === 'pen') { this.sparks(x, y, 55, 48); this.sparks(x, y, 25, 30, back, 1.2, 0xfff0c0); }
    else this.sparks(x, y, r.result === 'ricochet' ? 60 : 75, 55, back, r.result === 'ricochet' ? 1.2 : 2.2);
    this.flashes.push({ x, y, dx: 0, dy: 1, t: 0, ttl: 0.05, boom: true });
    if (r.ammo.type === 'HEAT' && r.result !== 'ricochet') {
      this.flashes.push({ x, y, dx: 0, dy: 1, t: 0, ttl: 0.08, boom: true });
      for (let i = 0; i < 16; i++) P.add(K.DARK, x + this.rnd(-0.5, 0.5), y + this.rnd(0, 1), this.rnd(-1, 1), this.rnd(0.5, 3), this.rnd(3, 6), 0.6, { grow: 0.8, drag: 1, grav: -0.02, alpha: 0.4, col: 0x35302b });
    }
    if (r.result === 'pen') {
      this.flashes.push({ x, y, dx: 0, dy: 1, t: 0, ttl: 0.06, boom: true });
      for (let i = 0; i < 10; i++) P.add(K.SMOKE, x, y, this.rnd(-2, 2), this.rnd(0, 3), this.rnd(2, 4), 0.4, { grow: 0.6, drag: 1, grav: -0.02, alpha: 0.35, col: 0x8a857c });
    }
    this.labels.push({ x, y: y + 1.2, t: 0, r });
    // this.mark(r);   // armour marks: switched off for now (user request); code kept below
    // shaped-charge warhead (HEAT shell, TOW): it bursts on the plate whatever the result — fireball, black
    // smoke, and a blast wave that throws sand and rocks the vehicles around it
    if (r.ammo.pen.ce && r.result !== 'ricochet') {
      const tow = r.ammo.d > 0.13, k = tow ? 1.4 : 1;
      this.blast(x, y, tow ? 1.3 : 0.8, null, null);
      this.flashes.push({ x, y, dx: 0, dy: 1, t: 0, ttl: 0.12, boom: true, big: tow });
      this.fireball(x, y + 0.3, Math.round(10 * k), 1.3 * k, 10 * k, 0x2a2622, 5, 0.6); this.comets(x, y, tow ? 5 : 2, 22);
      if (r.result === 'pen') {                                  // the jet and spall carry on into the hull
        const v = r.vehicle, dx = Math.sign(v.pos.x - x) || 1;
        for (let i = 0; i < 24; i++) P.add(K.FIRE, x, y, dx * this.rnd(20, 60), this.rnd(-6, 6), this.rnd(0.03, 0.08), this.rnd(0.06, 0.16), { grow: 0, drag: 3, grav: 0, alpha: 1, col: 0xfff0c0 });
      }
    }
  }

  // Lasting marks on the armour, carried with the hull or the turret (also when the turret is thrown):
  // a shaped charge leaves a scorched star with a dished centre or a burnt-through hole with petals turned
  // inward; a long-rod round leaves a gouge or a clean round hole; a ricochet a bright scrape.
  mark(r) {
    const v = r.vehicle; if (!v || !v.def) return;
    const l = v.toLocal(r.x, r.y), heat = !!r.ammo.pen.ce, small = r.ammo.small;
    if (small && r.result !== 'pen') return;
    const kind = r.result === 'ricochet' ? 'scrape' : r.result === 'pen' ? 'hole' : heat ? 'dent' : 'gouge';
    const size = small ? 0.04 : heat ? (r.ammo.d > 0.13 ? 0.24 : 0.17) : kind === 'hole' ? 0.07 : 0.12;
    const ang = Math.atan2(-Math.sin(v.ang), -Math.cos(v.ang) * v.dir);   // shot travels against the plate, roughly along the hull
    (v.marks || (v.marks = [])).push({ x: l.x * v.dir, y: l.y, part: r.part, kind, size, heat, ang, seed: Math.random() * 100 });
    if (v.marks.length > 30) v.marks.shift();
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
    // muzzle fireball: a jet of flame along the bore that balloons a few metres out and cools into grey-brown smoke
    for (let i = 0; i < 16 * big; i++) {
      const d = this.rnd(0.6, 7) * big, sd = this.rnd(-1, 1) * 0.5 * d * 0.25;
      P.add(K.FLAME, e.x + e.dx * d - e.dy * sd, e.y + e.dy * d + e.dx * sd, e.dx * this.rnd(6, 20) + this.rnd(-3, 3), e.dy * this.rnd(6, 20) + this.rnd(-2, 4),
        this.rnd(2.2, 4.5), this.rnd(0.7, 1.7) * big * (0.5 + d / 8), { grow: this.rnd(1.2, 2.6) * big, drag: 3.2, grav: -0.03, alpha: 0.5, col: Math.random() < 0.5 ? 0x8f8679 : 0x6e665b });
    }
    for (let i = 0; i < 10 * big; i++) {              // muzzle-brake side jets
      const s2 = i % 2 ? 1 : -1, sp = this.rnd(6, 16);
      P.add(K.FLAME, e.x - e.dx * 0.3, e.y - e.dy * 0.3, -e.dy * s2 * sp + e.dx * 3, e.dx * s2 * sp + e.dy * 3, this.rnd(1.2, 2.4), this.rnd(0.4, 0.8) * big, { grow: 1.4, drag: 4, grav: -0.02, alpha: 0.4, col: 0x9a9184 });
    }
    this.sparks(e.x + e.dx * 1.5, e.y + e.dy * 1.5, Math.round(26 * big), 55, ang, 0.5, 0xffc878);
    // the fireball turns into a big pale cloud of gun smoke ahead of the muzzle that lingers and drifts
    for (let i = 0; i < 44 * big; i++) {
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
      this.fireball(hit.x, hit.y + 0.6, 9, 1.2, 9, 0x2e2a26, 4.5, 0.6); this.sparks(hit.x, hit.y + 0.3, 30, 40, Math.PI / 2, 2.4); this.comets(hit.x, hit.y + 0.3, 3, 20);
      this.flashes.push({ x: hit.x, y: hit.y + 0.5, dx: 0, dy: 1, t: 0, ttl: 0.07, boom: true });
    }
    const d = Math.abs(hit.x - this.w.cam.x);
    this.shake = Math.max(this.shake, Math.max(0, 0.5 - d / 300));
  }

  // ---- building blocks for explosions ----
  // fireball that boils up and cools into smoke: n balls, radius r0, thrown outward at up to sp m/s
  fireball(x, y, n, r0, sp, smoke = 0x2b2622, ttl = 4, up = 0.5) {
    const P = this.P, K = DS.P;
    for (let i = 0; i < n; i++) {
      const a = this.rnd(0, 6.283), v = this.rnd(0.15, 1) * sp, d = this.rnd(0, r0 * 0.5);
      P.add(K.FLAME, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, Math.cos(a) * v, Math.sin(a) * v * 0.8 + sp * up * this.rnd(0.2, 1),
        ttl * this.rnd(0.7, 1.3), r0 * this.rnd(0.55, 1.1), { grow: r0 * this.rnd(0.5, 1.1), drag: 2.2, grav: -0.035, alpha: 0.62, col: smoke });
    }
  }
  // shower of glowing sparks (hot metal): fast, heavy, short-lived streaks
  sparks(x, y, n, sp, dir = null, spread = 6.283, col = 0xffd27a) {
    const P = this.P, K = DS.P;
    for (let i = 0; i < n; i++) {
      const a = dir == null ? this.rnd(0, 6.283) : dir + this.rnd(-0.5, 0.5) * spread, v = this.rnd(0.25, 1) * sp;
      P.add(K.SPARK, x, y, Math.cos(a) * v, Math.sin(a) * v, this.rnd(0.35, 1.3), this.rnd(0.02, 0.05), { drag: 0.9, grav: 1, alpha: 1, col: Math.random() < 0.3 ? 0xfff0c0 : col });
    }
  }
  // burning fragments that arc away trailing smoke
  comets(x, y, n, sp, col = 0x2e2924) {
    const L = this.cm || (this.cm = []);
    for (let i = 0; i < n && L.length < 40; i++) { const a = Math.PI / 2 + this.rnd(-1.25, 1.25), v = this.rnd(0.45, 1) * sp; L.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, ttl: this.rnd(1.6, 3.4), col, acc: 0 }); }
  }
  stepComets(dt) {
    const L = this.cm; if (!L || !L.length) return;
    const P = this.P, K = DS.P, T = this.w.terrain;
    for (const c of L) {
      c.t += dt; c.vy -= DS.T.g * dt; c.vx *= 1 - 0.25 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      c.acc += dt * 38;
      while (c.acc >= 1) { c.acc -= 1; const f = 1 - c.t / c.ttl;
        P.add(K.DARK, c.x + this.rnd(-0.1, 0.1), c.y + this.rnd(-0.1, 0.1), this.rnd(-0.4, 0.4), this.rnd(-0.2, 0.6), this.rnd(1.6, 3), 0.28 + 0.3 * f, { grow: 0.5, drag: 1.2, grav: -0.01, alpha: 0.5 * f + 0.12, col: c.col }); }
      if (Math.random() < dt * 20) P.add(K.FIRE, c.x, c.y, 0, 0, 0.12, 0.3, { grow: 0, drag: 1, grav: 0, alpha: 0.9, col: 0xffb050 });
      if (c.y < T.height(c.x)) c.t = c.ttl;
    }
    this.cm = L.filter(c => c.t < c.ttl);
  }

  // 155 mm high-explosive burst: a fireball, a tall column of sand thrown straight up with a wide low skirt,
  // heavy dust that boils up and drifts, dark smoke, a deep crater. Big soft puffs carry the bulk of the cloud
  // so the particle count stays modest.
  heBurst(x, y, A, onHard) {
    const P = this.P, K = DS.P, T = this.w.terrain, r = (a, b) => this.rnd(a, b);
    const gy = T.height(x), sc = this.hex(T.soilAt(x).col[1]), sc2 = this.hex(T.soilAt(x).col[0]);
    const air = y - gy > 3;                                        // burst on a wall high above the ground
    DS.Audio.ground(x, y, true);
    this.blast(x, y + 0.3, 3.5, null, null);
    let ej = 0;
    if (!air) { ej = T.crater(x, 3.1, 1.25, 0.4, 0.5); T.relax(undefined, undefined, 6); }
    const near = Math.abs(x - this.w.cam.x) < 700, k = near ? 1 : 0.35;            // far bursts: a lighter version
    if (!air) {
      const n = Math.round(230 * k);
      for (let i = 0; i < n; i++) {                                 // column: narrow, fast, high
        const a = Math.PI / 2 + r(-0.42, 0.42) * r(0.3, 1), sp = r(14, 78);
        P.add(K.GRAIN, x + r(-1, 1), gy + 0.1, Math.cos(a) * sp, Math.sin(a) * sp, r(1.6, 5.5), r(0.08, 0.3), { drag: 0.32, col: Math.random() < 0.5 ? sc : sc2, mass: ej * 0.7 / n });
      }
      const n2 = Math.round(90 * k);
      for (let i = 0; i < n2; i++) {                                // skirt: flat and wide
        const a = r(0.12, 0.55) * (Math.random() < 0.5 ? 1 : -1), sp = r(10, 42);
        P.add(K.GRAIN, x, gy + 0.2, Math.sin(a > 0 ? Math.PI / 2 - a : -Math.PI / 2 - a) * sp, Math.abs(Math.cos(Math.PI / 2 - Math.abs(a))) * sp * 0.9 + 2, r(1, 3), r(0.05, 0.14), { drag: 0.3, col: sc, mass: ej * 0.3 / n2 });
      }
    }
    const dustCol = air ? 0xc9b79a : sc;
    if (!air) for (let i = 0; i < Math.round(30 * k) + 6; i++) {    // the sand column itself: dense, narrow, 30–40 m high
      const u = Math.random();
      P.add(K.DUST, x + r(-1.2, 1.2), gy + r(0, 2), r(-2.5, 2.5), 12 + u * 52, r(5, 11), r(1.8, 3.4), { grow: r(0.9, 1.9), drag: 1.25, grav: 0.25, alpha: 0.55, col: Math.random() < 0.5 ? sc : sc2 });
    }
    for (let i = 0; i < Math.round(40 * k) + 8; i++)                // rising cloud
      P.add(K.DUST, x + r(-3.5, 3.5), y + r(0, 4), r(-7, 7), r(3, 20), r(9, 18), r(2.4, 5), { grow: r(1.6, 3.4), drag: 0.8, grav: 0, alpha: 0.4, col: dustCol });
    if (!air) for (let i = 0; i < Math.round(26 * k) + 4; i++) {    // ground surge rolling out both ways
      const s = Math.random() < 0.5 ? 1 : -1;
      P.add(K.DUST, x + s * r(0, 3), gy + r(0.3, 1.8), s * r(8, 30), r(0.2, 3), r(7, 14), r(2, 4), { grow: r(1.4, 2.8), drag: 1.0, grav: 0, alpha: 0.36, col: sc });
    }
    // fireball boiling up into black-brown smoke, burning fragments trailing smoke, a shower of sparks
    this.fireball(x, y + 1, Math.round(16 * k) + 5, 2.6, 16, 0x2a2521, 6, 0.7);
    this.fireball(x, y + 2.5, Math.round(8 * k) + 2, 1.8, 9, 0x4a3f33, 8, 1.4);
    if (near) { this.comets(x, y + 0.5, 9, 34); this.sparks(x, y + 0.6, 70, 60, Math.PI / 2, 2.6); }
    for (let i = 0; i < Math.round(18 * k); i++) { const a = Math.PI / 2 + r(-1.2, 1.2), sp = r(12, 45);
      P.add(K.DEBRIS, x, y + 0.5, Math.cos(a) * sp, Math.sin(a) * sp, r(2, 5), r(0.06, 0.2), { drag: 0.2, col: 0x3a342c }); }
    this.flashes.push({ x, y: y + 1, dx: 0, dy: 1, t: 0, ttl: 0.1, boom: true });
    this.flashes.push({ x, y: y + 3, dx: 0, dy: 1, t: 0, ttl: 0.07, boom: true });
    const d = Math.abs(x - this.w.cam.x);
    this.shake = Math.max(this.shake, Math.max(0, 1.4 - d / 500));
  }
  // a solid shot or small round stopping in a building wall: chips of concrete and a puff of dust
  wallHit(h, p) {
    const P = this.P, K = DS.P, small = p.ammo.small, n = small ? 3 : 26, sx = -Math.sign(p.vx || 1);
    if (!small) DS.Audio.ground(h.x, h.y, false);
    for (let i = 0; i < n; i++) P.add(K.DEBRIS, h.x, h.y, sx * this.rnd(1, small ? 6 : 18), this.rnd(-2, small ? 4 : 10), this.rnd(0.8, 2.2), this.rnd(0.04, small ? 0.08 : 0.2), { drag: 0.4, col: 0xb8a888 });
    for (let i = 0; i < (small ? 1 : 8); i++) P.add(K.DUST, h.x, h.y, sx * this.rnd(1, 5), this.rnd(0, 3), this.rnd(1.5, small ? 2.5 : 6), this.rnd(0.3, small ? 0.6 : 1.6), { grow: 1.2, drag: 1.2, grav: 0, alpha: 0.3, col: 0xc9b79a });
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

  // a track parting: sparks and a couple of link fragments
  // rocket leaving the launcher: flame and a long jet of smoke out of the back of the box, dust blown off the
  // ground behind the vehicle
  rocketLaunch(v, e) {
    const P = this.P, K = DS.P, T = this.w.terrain, r = (a, b) => this.rnd(a, b), bx = e.x - e.dx * 3.4, by = e.y - e.dy * 3.4 + 0.6;
    DS.Audio.rocket(e.x, e.y, e.light);
    if (e.light) { for (let i = 0; i < 6; i++) P.add(K.SMOKE, e.x - e.dx * 3, e.y - e.dy * 3, -e.dx * r(4, 16), -e.dy * r(4, 16) + r(-1, 1), r(1, 2.2), r(0.3, 0.6), { grow: 0.8, drag: 1.6, grav: 0, alpha: 0.4, col: 0xe6e0d6 }); return; }
    for (let i = 0; i < 26; i++) { const sp = r(8, 45); P.add(K.SMOKE, bx, by, -e.dx * sp + r(-3, 3), -e.dy * sp + r(-2, 3), r(2.5, 6), r(0.7, 1.6), { grow: r(1.2, 2.4), drag: 1.6, grav: -0.02, alpha: 0.5, col: 0xe6e0d6 }); }
    for (let i = 0; i < 12; i++) { const sp = r(10, 40); P.add(K.FIRE, bx, by, -e.dx * sp, -e.dy * sp, r(0.08, 0.2), r(0.5, 1.1), { grow: 5, drag: 8, grav: 0, alpha: 1, col: 0xffc060 }); }
    const gx = bx - e.dx * 5, gy = T.height(gx), sc = this.hex(T.soilAt(gx).col[1]);
    for (let i = 0; i < 16; i++) P.add(K.DUST, gx + r(-3, 3), gy + r(0.2, 1.2), -Math.sign(e.dx) * r(3, 16), r(0.5, 4), r(4, 8), r(1.2, 2.4), { grow: r(1, 2), drag: 1, grav: 0, alpha: 0.34, col: sc });
    this.flashes.push({ x: bx, y: by, dx: -e.dx, dy: -e.dy, t: 0, ttl: 0.08, boom: true });
    this.blast(bx, by, 0.6, null, null);
  }
  // smoke trail of a burning rocket motor (MLRS rocket, rocket-assisted shell)
  rocketTrail(p, dt) {
    if (!this.w.cam.visible(p.x, p.y, 60)) return;
    const P = this.P, K = DS.P, sp = Math.hypot(p.vx, p.vy), n = Math.min(6, Math.ceil(sp * dt / 6));
    for (let i = 0; i < n; i++) { const f = i / n; P.add(K.SMOKE, p.x - p.vx * dt * f, p.y - p.vy * dt * f, this.rnd(-1, 1), this.rnd(-1, 1), this.rnd(3, 6), this.rnd(0.6, 1.1), { grow: 0.9, drag: 1.5, grav: -0.01, alpha: 0.42, col: 0xe8e2d8 }); }
    P.add(K.FIRE, p.x - p.vx * dt, p.y - p.vy * dt, -p.vx * 0.05, -p.vy * 0.05, 0.08, 0.9, { grow: 3, drag: 4, grav: 0, alpha: 1, col: 0xffd080 });
  }
  // one bomblet going off on the ground: a sharp little burst
  bomblet(x, y, lite) {
    const P = this.P, K = DS.P, sc = this.hex(this.w.terrain.soilAt(x).col[1]);
    if (!this.w.cam.visible(x, y, 30)) return;
    this.flashes.push({ x, y: y + 0.3, dx: 0, dy: 1, t: 0, ttl: 0.05, boom: true });
    if (!lite) this.sparks(x, y + 0.2, 10, 26, Math.PI / 2, 2.4);
    for (let i = 0; i < (lite ? 2 : 5); i++) P.add(K.GRAIN, x, y + 0.1, this.rnd(-5, 5), this.rnd(4, 14), this.rnd(0.6, 1.4), this.rnd(0.04, 0.1), { drag: 0.4, col: sc });
    P.add(K.DUST, x, y + 0.5, this.rnd(-1.5, 1.5), this.rnd(1, 4), this.rnd(2.5, 5), this.rnd(0.7, 1.3), { grow: 1, drag: 1, grav: 0, alpha: 0.3, col: sc });
    if (!lite) P.add(K.DARK, x, y + 0.6, this.rnd(-1, 1), this.rnd(1, 3), this.rnd(2, 4), this.rnd(0.5, 0.9), { grow: 0.8, drag: 1, grav: -0.02, alpha: 0.3, col: 0x3a352f });
  }
  // spent case (T-62) or case stub (T-72): a dull steel cylinder of the gun's calibre tossed up and back out of
  // the turret, tumbling, with a wisp of propellant smoke; it clatters once on the ground and lies there a while
  ejectCase(v, e) {
    const E = e.E, a = (112 + Math.random() * 16) * Math.PI / 180;          // up and to the rear
    (this.cases || (this.cases = [])).push({ x: e.x, y: e.y, vx: v.vel.x + v.dir * Math.cos(a) * E.v, vy: Math.sin(a) * E.v, a: Math.random() * 6, w: (Math.random() - 0.5) * 14, dia: E.dia, len: E.len, t: 0, rest: 0 });
    if (this.cases.length > 24) this.cases.shift();
    for (let i = 0; i < 5; i++) this.P.add(DS.P.SMOKE, e.x, e.y, v.vel.x + (Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.9, 0.8 + Math.random() * 0.8, 0.12 + Math.random() * 0.1, { col: 0xb9b3a8, alpha: 0.28, grow: 0.5 });
    DS.Audio.tick(e.x, e.y, 0.5);
  }
  stepCases(dt) {
    const L = this.cases; if (!L || !L.length) return;
    const T = this.w.terrain;
    for (const c of L) {
      c.t += dt;
      if (c.rest) { c.rest += dt; continue; }
      c.vy -= DS.T.g * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.w * dt;
      const h = T.height(c.x) + c.dia / 2;
      if (c.y < h) {
        c.y = h;
        if (c.vy < -1.5) { DS.Audio.tick(c.x, c.y, Math.min(1.2, 0.4 + c.len)); c.vy = -c.vy * 0.22; c.vx *= 0.45; c.w *= 0.4; }
        else { c.rest = 0.001; c.a = Math.atan(T.slope(c.x)); }
      }
    }
    this.cases = L.filter(c => c.rest < 25);
  }
  drawCases(ctx, grey) {
    const L = this.cases; if (!L) return;
    for (const c of L) {
      const al = c.rest > 22 ? (25 - c.rest) / 3 : 1;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); ctx.globalAlpha = al;
      // dull steel: dark underside, a soft highlight along the top, darker open end
      ctx.fillStyle = grey || '#8d9092'; ctx.fillRect(-c.len / 2, -c.dia / 2, c.len, c.dia);
      if (!grey) {
        ctx.fillStyle = 'rgba(210,214,216,0.55)'; ctx.fillRect(-c.len / 2, c.dia * 0.12, c.len, c.dia * 0.22);
        ctx.fillStyle = 'rgba(40,42,46,0.45)'; ctx.fillRect(-c.len / 2, -c.dia / 2, c.len, c.dia * 0.3);
        ctx.fillStyle = '#5c5f62'; ctx.fillRect(-c.len / 2, -c.dia / 2, Math.min(c.len * 0.18, 0.03), c.dia);
        ctx.fillStyle = '#3b3d40'; ctx.fillRect(c.len / 2 - Math.min(c.len * 0.1, 0.02), -c.dia / 2, Math.min(c.len * 0.1, 0.02), c.dia);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  trackSnap(e) {
    const P = this.P, K = DS.P;
    DS.Audio.trackSnap(e.x, e.y);
    for (let i = 0; i < 26; i++) { const a = this.rnd(0, Math.PI * 2), sp = this.rnd(4, 18); P.add(K.FIRE, e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, this.rnd(0.05, 0.2), 0.05, { grow: 0, drag: 2, grav: 0.6, alpha: 1, col: 0xffe2a0 }); }
    for (let i = 0; i < 3; i++) P.add(K.DEBRIS, e.x, e.y, this.rnd(-6, 6), this.rnd(3, 8), 3, 0.12, { drag: 0.2, grav: 1 });
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
    DS.Audio.thud(e.x, e.y, k);
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
    if (sz > 0.08) DS.Audio.tick(x, y, Math.min(1, e));
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
    if (str >= 0.8) DS.Audio.blastRoll(x, y, Math.min(1.5, str));
    // the overpressure shoves nearby vehicles: hull rocks on its springs, antennas whip
    if (str >= 0.5) for (const v of this.w.vehicles) {
      const d = Math.hypot(v.pos.x - x, v.pos.y - y);
      if (d > 25 * Math.sqrt(str) || d < 0.5) continue;
      const F = str * 2.5e7 / Math.pow(1 + d / 3, 2), ux = (v.pos.x - x) / d;   // one physics step: ~0.1 m/s at 8 m from a TOW
      v.kick = { x: v.pos.x - ux * 2.5, y: v.pos.y + 1.8, fx: ux * F, fy: F * 0.3 };   // high on the near side: the hull rocks away
    }
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

  update(dt) { this.stepBlasts(dt); this.stepCases(dt); this.stepComets(dt); for (const w of this.waves) w.t += dt; this.waves = this.waves.filter(w => w.t < 0.4); for (const f of this.flashes) f.t += dt; this.flashes = this.flashes.filter(f => f.t < f.ttl);
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
