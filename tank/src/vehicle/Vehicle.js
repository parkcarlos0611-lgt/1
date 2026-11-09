// Tracked vehicle: 2D rigid hull on torsion-bar stations, track drive with soil shear traction,
// terrain sinkage, stabilised gun with recoil/counter-recoil, antenna springs.
DS.Vehicle = class Vehicle {
  constructor(def, x, terrain) {
    this.def = def; this.terrain = terrain;
    const g = def.roadWheels;
    this.pos = { x, y: 0 }; this.ang = 0; this.vel = { x: 0, y: 0 }; this.w = 0;
    this.vt = 0;            // track speed relative to hull (m/s, + forward)
    this.s = 0;             // track travel (link offset)
    this.spool = 0;         // engine power fraction (turbine spools up/down)
    this.input = { drive: 0, elevRate: 0, elevStep: 0, fire: false };   // elev in rad/s and one-shot rad
    this.st = g.map(p => ({ lx: p.x, ly: p.y, d: 0, dPrev: 0, ang: Math.random() * 6, N: 0, wx: 0, wy: 0, contact: false, slip: 0, Ft: 0, sink: 0 }));
    this.sprAng = 0; this.idlAng = 0; this.rollAng = 0;
    this.F0 = def.mass * DS.T.g / g.length;
    // gun
    const G = def.gun;
    this.gun = { e: 0, aimW: 0, rx: 0, rv: 0, aB: 0, reload: 0, ammo: 'M829A1', fired: 0 };
    this.antennas = def.antennas.map(a => ({ phi: 0, dphi: 0 }));
    this.prevBaseV = { x: 0, y: 0 };
    this.stats = { slip: 0, sink: 0, Fdrive: 0, power: 0, contact: 0 };
    this.events = [];       // fx events for this frame (fire, etc.)
    this.place(x);
  }

  place(x) {
    const R = this.def.wheelR + this.def.track.thick;
    const yb = Math.max(this.terrain.circleRest(x - 2, R), this.terrain.circleRest(x + 2, R));
    this.pos.x = x; this.pos.y = yb - this.def.roadWheels[0].y + 0.02;
    this.ang = Math.atan2(this.terrain.circleRest(x + 2, R) - this.terrain.circleRest(x - 2, R), 4);
    this.vel.x = this.vel.y = this.w = this.vt = 0;
  }

  local(lx, ly) { const c = Math.cos(this.ang), s = Math.sin(this.ang); return { x: this.pos.x + c * lx - s * ly, y: this.pos.y + s * lx + c * ly }; }

  step(dt, world) {
    const D = this.def, S = D.suspension, E = D.engine, T = this.terrain, g = DS.T.g;
    const c = Math.cos(this.ang), s = Math.sin(this.ang);
    const ex = { x: c, y: s }, ey = { x: -s, y: c };
    let Fx = 0, Fy = -D.mass * g, tau = 0;
    const apply = (px, py, fx, fy) => { Fx += fx; Fy += fy; tau += (px - this.pos.x) * fy - (py - this.pos.y) * fx; };
    const pv = (px, py) => ({ x: this.vel.x - this.w * (py - this.pos.y), y: this.vel.y + this.w * (px - this.pos.x) });
    const R = D.wheelR + D.track.thick;

    // ---- suspension stations ----
    let contacts = 0, sumFmax = 0;
    const trac = [];
    for (const w of this.st) {
      const ax = this.pos.x + c * w.lx - s * w.ly, ay = this.pos.y + s * w.lx + c * w.ly;
      const yreq = T.circleRest(ax, R);
      const dc = (yreq - ay) / Math.max(0.2, ey.y);
      w.dPrev = w.d;
      let F = 0;
      if (dc < -S.droop) { w.d += (-S.droop - w.d) * Math.min(1, dt * 30); w.contact = false; }
      else {
        w.d = Math.min(dc, S.bump);
        const vd = (w.d - w.dPrev) / dt;
        F = this.F0 + S.k * w.d + S.c * vd;
        if (dc > S.bump) F += S.bumpK * (dc - S.bump) + S.bumpC * Math.max(0, vd);
        F = Math.max(0, F); w.contact = F > 0;
      }
      w.wx = ax + ey.x * w.d; w.wy = ay + ey.y * w.d; w.N = F;
      if (F > 0) {
        apply(w.wx, w.wy - R, ey.x * F, ey.y * F);
        contacts++;
        const soil = T.soilAt(w.wx);
        const Fmax = D.contactArea * soil.c + F * Math.tan(soil.phi * Math.PI / 180);
        const v = pv(w.wx, w.wy - R), vp = v.x * ex.x + v.y * ex.y;
        trac.push({ w, Fmax, vp, soil, px: w.wx, py: w.wy - R });
        sumFmax += Fmax;
        // rolling / compaction resistance
        const rr = (soil.crr + Math.min(0.08, w.sink * 0.6)) * F * Math.tanh(vp / 0.25);
        apply(w.wx, w.wy - R, -ex.x * rr, -ex.y * rr);
      }
    }

    // ---- drive: engine → sprocket → track, implicit in track speed ----
    const u = this.input.drive;
    this.spool += (Math.abs(u) - this.spool) * Math.min(1, dt / E.spool);
    let Fd = 0, B = 0;
    const vt = this.vt;
    if (u !== 0 && (Math.sign(u) === Math.sign(vt) || Math.abs(vt) < 0.4)) {
      const vmax = u > 0 ? E.vmaxF : E.vmaxR;
      const gov = Math.max(0, Math.min(1, (vmax - Math.abs(vt)) / 1.0));
      Fd = Math.sign(u) * Math.min(E.maxTractive, E.power * E.eff * this.spool / Math.max(Math.abs(vt), 0.6)) * gov;
    } else if (u !== 0) B = E.brake * Math.abs(u);
    else B = E.engineBrake + E.brake * 0.18;
    this.stats.Fdrive = Fd; this.stats.power = this.spool;
    const vb = 0.05, th = Math.tanh(vt / vb);
    const Fint = (3000 + 900 * Math.abs(vt)) * Math.tanh(vt / 0.2);
    let Ft = 0, dFt = 0;
    for (const t of trac) {
      t.vref = DS.T.traction.vref + DS.T.traction.vrefSlip * Math.abs(vt);
      const x = (vt - t.vp) / t.vref, tx = Math.tanh(x);
      Ft += t.Fmax * tx; dFt += t.Fmax / t.vref * (1 - tx * tx);
    }
    const mt = D.track.mass + 2500;
    const num = Fd - Fint - B * th - Ft, den = mt + dt * (dFt + B / vb * (1 - th * th));
    this.vt = vt + dt * num / den;
    let slipSum = 0;
    for (const t of trac) {
      const sv = this.vt - t.vp, F = t.Fmax * Math.tanh(sv / t.vref);
      t.w.Ft = F; t.w.slip = sv;
      slipSum += Math.abs(sv);
      apply(t.px, t.py, ex.x * F, ex.y * F);
    }
    this.stats.slip = trac.length ? slipSum / trac.length : 0;
    this.stats.contact = contacts;

    // ---- rigid contacts: sprocket, idler, belly ----
    const rig = [
      [D.sprocket.x, D.sprocket.y, 0.36], [D.idler.x, D.idler.y, D.idler.r + D.track.thick],
    ];
    for (let k = 0; k <= 6; k++) rig.push([D.belly.x0 + (D.belly.x1 - D.belly.x0) * k / 6, D.belly.y + 0.05, 0.05]);
    // turret/hull top (for rolling over)
    rig.push([-3.9, 0.5, 0.1], [3.8, 0.0, 0.1], [0, 1.4, 0.3]);
    for (const [lx, ly, r] of rig) {
      const px = this.pos.x + c * lx - s * ly, py = this.pos.y + s * lx + c * ly;
      const pen = T.circleRest(px, r) - py;
      if (pen > 0) {
        const sl = T.slope(px), nl = Math.hypot(sl, 1), nx = -sl / nl, ny = 1 / nl;
        const v = pv(px, py), vn = v.x * nx + v.y * ny, vtg = v.x * ny - v.y * nx;
        const Fn = Math.max(0, 4e6 * pen - 2.5e5 * vn);
        const Ff = -0.55 * Fn * Math.tanh(vtg / 0.1);
        apply(px, py - r, nx * Fn + ny * Ff, ny * Fn - nx * Ff);
      }
    }

    // ---- gun recoil reaction ----
    const G = D.gun, gs = this.gun;
    const ga = this.ang + gs.e, gdx = Math.cos(ga), gdy = Math.sin(ga);
    if (gs.rv < 0) {
      const tp = this.local(G.trunnion[0], G.trunnion[1]);
      const F = G.recoilMass * gs.aB;
      apply(tp.x, tp.y, -gdx * F, -gdy * F);
    }

    // ---- integrate hull ----
    this.vel.x += Fx / D.mass * dt; this.vel.y += Fy / D.mass * dt;
    this.w += tau / D.inertia * dt;
    this.w *= 1 - 0.02 * dt;
    this.pos.x += this.vel.x * dt; this.pos.y += this.vel.y * dt; this.ang += this.w * dt;

    // ---- terrain sinkage under each loaded station ----
    const half = 0.385;
    let sinkMax = 0;
    for (const w of this.st) {
      if (w.N > 0) { w.sink = T.press(w.wx - half, w.wx + half, w.N, D.contactArea, dt); sinkMax = Math.max(sinkMax, w.sink); }
      else w.sink = 0;
    }
    this.stats.sink = sinkMax;

    // ---- running gear rotation ----
    this.s += this.vt * dt;
    for (const w of this.st) w.ang -= this.vt / D.wheelR * dt;
    this.sprAng -= this.vt / this.sprR() * dt;
    this.idlAng -= this.vt / (D.idler.r + D.track.thick / 2) * dt;
    this.rollAng -= this.vt / 0.145 * dt;

    this.stepGun(dt, world);
    this.stepAntennas(dt);
  }

  sprR() { return this.def.track.pitch * this.def.sprocket.teeth / (2 * Math.PI); }

  stepGun(dt, world) {
    const G = this.def.gun, gs = this.gun, d2r = Math.PI / 180;
    gs.aimW += this.input.elevRate * dt + this.input.elevStep; this.input.elevStep = 0;
    // keep the aim inside the mount limits so reversing direction responds at once
    const base = G.stabilized ? this.ang : 0;
    gs.aimW = Math.max(base + G.elevMin * d2r, Math.min(base + G.elevMax * d2r, gs.aimW));
    const want = gs.aimW - base;
    const de = want - gs.e, mx = G.rate * dt;
    gs.e += Math.max(-mx, Math.min(mx, de));
    if (!G.stabilized) gs.aimW = gs.e;
    gs.reload = Math.max(0, gs.reload - dt);
    // recoil: constant brake force stops the gun at recoilLen, then spring-damper counter-recoil
    if (gs.rv < 0) { gs.rv += gs.aB * dt; gs.rx += gs.rv * dt; if (gs.rv >= 0) gs.rv = 0.0001; }
    else if (gs.rx < 0) { const a = -64 * gs.rx - 15 * gs.rv; gs.rv += a * dt; gs.rx += gs.rv * dt; if (gs.rx > 0) { gs.rx = 0; gs.rv = 0; } }
    if (this.input.fire && gs.reload <= 0 && gs.rx === 0) { this.fire(world); }
  }

  fire(world) {
    const G = this.def.gun, gs = this.gun, A = DS.AMMO[gs.ammo];
    const J = A.launchMass * A.v0 * 1.75;          // projectile + propellant gas momentum
    const v0r = J / G.recoilMass;
    gs.rv = -v0r; gs.aB = v0r * v0r / (2 * G.recoilLen);
    gs.reload = G.reload; gs.fired++;
    const m = this.muzzle();
    world.spawnProjectile(m.x, m.y, m.dx * A.v0 + this.vel.x, m.dy * A.v0 + this.vel.y, A, this);
    this.events.push({ type: 'fire', x: m.x, y: m.y, dx: m.dx, dy: m.dy, ammo: A });
  }

  muzzle() {
    const G = this.def.gun, gs = this.gun, a = this.ang + gs.e, dx = Math.cos(a), dy = Math.sin(a);
    const tp = this.local(G.trunnion[0], G.trunnion[1]), L = G.muzzle + gs.rx;
    return { x: tp.x + dx * L, y: tp.y + dy * L, dx, dy };
  }

  stepAntennas(dt) {
    // base acceleration in hull frame drives a damped spring (whippy masts)
    const ax = (this.vel.x - this.prevBaseV.x) / dt, ay = (this.vel.y - this.prevBaseV.y) / dt;
    this.prevBaseV.x = this.vel.x; this.prevBaseV.y = this.vel.y;
    const c = Math.cos(this.ang), s = Math.sin(this.ang);
    const alx = ax * c + ay * s;
    const recoilKick = this.gun.rv < 0 ? -this.gun.aB * this.def.gun.recoilMass / this.def.mass : 0;
    for (const a of this.antennas) {
      const acc = -90 * a.phi - 1.6 * a.dphi - (alx + recoilKick) * 0.9 - this.w * 0;
      a.dphi += acc * dt + (-this.w) * 0; a.phi += a.dphi * dt;
      a.phi = Math.max(-0.9, Math.min(0.9, a.phi));
    }
  }

  // world-space running gear for rendering/track: circles in loop order (clockwise)
  gearCircles() {
    const D = this.def, h = D.track.thick / 2, out = [];
    const P = (lx, ly, r) => { const p = this.local(lx, ly); return { x: p.x, y: p.y, r }; };
    out.push(P(D.sprocket.x, D.sprocket.y, this.sprR()));
    for (const r of D.returnRollers) out.push(P(r.x, r.y, r.r + h));
    out.push(P(D.idler.x, D.idler.y, D.idler.r + h));
    for (let i = this.st.length - 1; i >= 0; i--) { const w = this.st[i]; out.push({ x: w.wx, y: w.wy, r: D.wheelR + h }); }
    return out;
  }

  speedKmh() { return (this.vel.x * Math.cos(this.ang) + this.vel.y * Math.sin(this.ang)) * 3.6; }
};
