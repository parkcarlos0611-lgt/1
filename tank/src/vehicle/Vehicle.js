// Tracked vehicle: 2D rigid hull on torsion-bar stations, track drive with soil shear traction,
// terrain sinkage, stabilised gun with fire control + recoil, antenna springs, damage states.
// dir = +1 faces right, −1 faces left (all hull-local x geometry is mirrored at construction).
DS.Vehicle = class Vehicle {
  constructor(def, x, terrain, opt = {}) {
    this.def = def; this.terrain = terrain;
    this.dir = opt.dir || 1; this.label = opt.label || def.name; this.team = opt.team || def.side;
    const d = this.dir, D = def;
    const M = p => ({ x: p.x * d, y: p.y });
    this.g = {
      wheels: D.roadWheels.map(M), sprocket: M(D.sprocket), idler: M(D.idler), rollers: D.returnRollers.map(r => ({ ...M(r), r: r.r })),
      trunnion: { x: D.gun.trunnion[0] * d, y: D.gun.trunnion[1] }, exhaust: M(D.exhaust),
      ring: { x: D.turretRing[0] * d, y: D.turretRing[1] },
      belly: { y: D.belly.y, x0: Math.min(D.belly.x0 * d, D.belly.x1 * d), x1: Math.max(D.belly.x0 * d, D.belly.x1 * d) },
    };
    this.pos = { x, y: 0 }; this.ang = 0; this.vel = { x: 0, y: 0 }; this.w = 0;
    this.vt = 0;            // track speed relative to hull (m/s, + = moving toward +x)
    this.s = 0;             // track travel (link offset)
    this.spool = 0;
    this.input = { drive: 0, elevRate: 0, elevStep: 0, fire: false, mgFire: false, mgAim: null, coaxFire: false };
    this.mg = def.mg ? { el: 0, side: 1, cool: 0, rounds: def.mg.rounds, n: 0, flip: 0 } : null;
    this.tow = def.tow ? { up: 0, armed: false, req: false, loaded: def.tow.loaded, reserve: def.tow.reserve, reload: 0, cool: 0, idle: 0, missile: null } : null;
    this.coax = def.coax ? { cool: 0, rounds: def.coax.rounds, n: 0 } : null;
    this.st = this.g.wheels.map(p => ({ lx: p.x, ly: p.y, d: 0, dPrev: 0, ang: Math.random() * 6, N: 0, wx: 0, wy: 0, contact: false, slip: 0, Ft: 0, sink: 0 }));
    this.sprAng = 0; this.idlAng = 0;
    this.F0 = D.mass * DS.T.g / D.roadWheels.length;
    this.gun = { e: 0, aimW: this.baseAng(), rx: 0, rv: 0, aB: 0, reload: 0, ammo: D.ammo[0], fired: 0, charge: D.gun.directCharge };
    this.fc = { range: null, se: 0, bs: 1200, lasedAt: -1, point: null };   // fire control
    this.antennas = (D.antennas || []).map(() => ({ phi: 0, dphi: 0 }));
    this.prevBaseV = { x: 0, y: 0 };
    this.stats = { slip: 0, sink: 0, Fdrive: 0, power: 0, contact: 0 };
    this.events = [];
    // damage
    this.alive = true; this.mobile = true; this.firepower = true; this.status = '정상';
    this.modState = {}; this.burning = 0; this.cookT = 0; this.wreck = false; this.turretGone = false; this.turretBody = null;
    this.scorch = []; this.jet = 0; this.holes = [];
    this.simT = 0;
    this.place(x);
  }

  baseAng() { return this.dir > 0 ? this.ang : Math.PI + this.ang; }
  gunWorld() { return this.baseAng() + this.dir * this.gun.e; }

  place(x) {
    const R = this.def.wheelR + this.def.track.thick;
    const yb = Math.max(this.terrain.circleRest(x - 2, R), this.terrain.circleRest(x + 2, R));
    this.pos.x = x; this.pos.y = yb - this.def.roadWheels[0].y + 0.02;
    this.ang = Math.atan2(this.terrain.circleRest(x + 2, R) - this.terrain.circleRest(x - 2, R), 4);
    this.vel.x = this.vel.y = this.w = this.vt = 0;
    this.gun.aimW = this.baseAng() + this.dir * this.gun.e - this.fc.se;
  }

  local(lx, ly) { const c = Math.cos(this.ang), s = Math.sin(this.ang); return { x: this.pos.x + c * lx - s * ly, y: this.pos.y + s * lx + c * ly }; }

  step(dt, world) {
    const D = this.def, S = D.suspension, E = D.engine, T = this.terrain, g = DS.T.g, G = this.g;
    this.simT += dt;
    const c = Math.cos(this.ang), s = Math.sin(this.ang);
    const ex = { x: c, y: s }, ey = { x: -s, y: c };
    let Fx = 0, Fy = -D.mass * g, tau = 0;
    const apply = (px, py, fx, fy) => { Fx += fx; Fy += fy; tau += (px - this.pos.x) * fy - (py - this.pos.y) * fx; };
    const pv = (px, py) => ({ x: this.vel.x - this.w * (py - this.pos.y), y: this.vel.y + this.w * (px - this.pos.x) });
    const R = D.wheelR + (this.trackBroken ? 0.02 : D.track.thick);   // a cut track no longer runs under the wheels

    // ---- suspension stations ----
    let contacts = 0;
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
        // grip along the ground under the wheel (on a crater wall that is up the wall, not into it)
        const gs = T.slope(w.wx), gl = Math.hypot(1, gs), tdx = 1 / gl, tdy = gs / gl;
        const v = pv(w.wx, w.wy - R), vp = v.x * ex.x + v.y * ex.y;
        trac.push({ w, Fmax, vp: v.x * tdx + v.y * tdy, px: w.wx, py: w.wy - R, dx: tdx, dy: tdy });
        const rr = (soil.crr + Math.min(0.08, w.sink * 0.6)) * F * Math.tanh(vp / 0.25);
        apply(w.wx, w.wy - R, -ex.x * rr, -ex.y * rr);
      }
    }

    // ---- track belt between the road wheels: the belt bridges crests instead of letting the hull drop
    // into the gap between two wheels (soft spring, so the stations still carry the load on flat ground) ----
    const byX = this.st.slice().sort((p, q) => p.lx - q.lx);
    for (let i = 1; i < byX.length; i++) {
      const a = byX[i - 1], b = byX[i];
      // three points along each span (a ridge off the middle still meets the belt, not the belly)
      for (let q = 0; q < 3; q++) {
        const f = 0.25 + 0.25 * q, bx = a.wx + (b.wx - a.wx) * f, by = a.wy + (b.wy - a.wy) * f - R;
        const pen = T.height(bx) - by;
        if (pen <= 0.005) continue;
        const sl = T.slope(bx), nl = Math.hypot(sl, 1), nx = -sl / nl, ny = 1 / nl;
        const v = pv(bx, by), vn = v.x * nx + v.y * ny;
        const Fn = Math.max(0, (1.6e6 * (pen - 0.005) - 1.2e5 * vn) / 3 * (q === 1 ? 1.4 : 0.8));
        if (Fn <= 0) continue;
        apply(bx, by, nx * Fn, ny * Fn);
        // the belt's grousers grip wherever its bottom run bears on the ground (a tank high-centred on a ridge
        // between two shell holes still drives on the track pressed against the ridge), along the ground
        const k = (i - 1) * 3 + q, bw = (this._beltW || (this._beltW = []))[k] || (this._beltW[k] = { slip: 0, Ft: 0 }), soil = T.soilAt(bx);
        trac.push({ w: bw, Fmax: D.contactArea * 0.17 * soil.c + Fn * Math.tan(soil.phi * Math.PI / 180), vp: v.x * ny - v.y * nx, px: bx, py: by, dx: ny, dy: -nx });
      }
    }

    // ---- sprocket and idler against the ground (a crater wall, a step): the track wrapped round them grips
    // there too. Its drive direction at a contact is along the gear's rim, turning with the track's circulation
    // (forward on the bottom run, upward on the leading face), so a tank whose nose meets a wall climbs it ----
    this._gearC = 0;
    if (!this.trackBroken) for (const [gx, gy, r] of [[G.sprocket.x, G.sprocket.y, 0.36], [G.idler.x, G.idler.y, D.idler.r + D.track.thick]]) {
      const px = this.pos.x + c * gx - s * gy, py = this.pos.y + s * gx + c * gy;
      const pen = T.circleRest(px, r) - py;
      if (pen <= 0) continue;
      const sl = T.slope(px), nl = Math.hypot(sl, 1), nx = -sl / nl, ny = 1 / nl, qx = px - nx * r, qy = py - ny * r;
      const v = pv(qx, qy), vn = v.x * nx + v.y * ny;
      const Fn = Math.max(0, 4e6 * pen - 2.5e5 * vn);
      apply(qx, qy, nx * Fn, ny * Fn); this._gearC++;
      const dx = ny, dy = -nx, soil = T.soilAt(qx);                                    // drive direction at the contact
      const gw = (this._gearW || (this._gearW = [{ slip: 0, Ft: 0 }, { slip: 0, Ft: 0 }]))[this._gearC - 1];
      trac.push({ w: gw, Fmax: D.contactArea * 0.3 * soil.c + Fn * Math.tan(soil.phi * Math.PI / 180), vp: v.x * dx + v.y * dy, px: qx, py: qy, dx, dy });
      // spinning against the wall with the hull held: the track tears the wall down into the hole below it
      const sg = Math.sign(qx - px) || 1, spin = Math.abs(this.vt - (v.x * dx + v.y * dy));
      if (spin > 0.5 && Math.abs(this.vel.x) < 0.6 && Math.abs(nx) > 0.3) T.shift(qx + sg * 0.5, qx - sg * 0.9, Math.min(0.02, spin * 0.008 * (0.5 + soil.dust)) * dt * 30);
    }

    // ---- drive: engine → sprocket → track, implicit in track speed ----
    const u = this.mobile ? this.input.drive : 0;
    this.spool += ((this.alive ? Math.abs(u) : 0) - this.spool) * Math.min(1, dt / E.spool);
    let Fd = 0, B = 0;
    const vt = this.vt;
    if (u !== 0 && (Math.sign(u) === Math.sign(vt) || Math.abs(vt) < 0.4)) {
      const vmax = Math.sign(u) === this.dir ? E.vmaxF : E.vmaxR;
      const gov = Math.max(0, Math.min(1, (vmax - Math.abs(vt)) / 1.0));
      Fd = Math.sign(u) * Math.min(E.maxTractive, E.power * E.eff * this.spool / Math.max(Math.abs(vt), 0.6)) * gov;
    } else if (u !== 0) B = E.brake * Math.abs(u);
    else B = E.engineBrake + E.brake * (this.trackBroken ? 1 : 0.18);
    this.stats.Fdrive = Fd; this.stats.power = this.spool;
    const vb = 0.05, th = Math.tanh(vt / vb);
    const Fint = (3000 + 900 * Math.abs(vt)) * Math.tanh(vt / 0.2);
    let dFt = 0, Ft = 0;
    for (const t of trac) {
      t.vref = DS.T.traction.vref + DS.T.traction.vrefSlip * Math.abs(vt);
      const tx = Math.tanh((vt - t.vp) / t.vref);
      Ft += t.Fmax * tx; dFt += t.Fmax / t.vref * (1 - tx * tx);
    }
    const mt = D.track.mass + 2500;
    this.vt = vt + dt * (Fd - Fint - B * th - Ft) / (mt + dt * (dFt + B / vb * (1 - th * th)));
    let slipSum = 0;
    for (const t of trac) {
      const sv = this.vt - t.vp, F = t.Fmax * Math.tanh(sv / t.vref);
      t.w.Ft = F; t.w.slip = sv; slipSum += Math.abs(sv);
      if (t.dx != null) apply(t.px, t.py, t.dx * F, t.dy * F); else apply(t.px, t.py, ex.x * F, ex.y * F);
    }
    this.stats.slip = trac.length ? slipSum / trac.length : 0;
    this.stats.contact = contacts;

    // ---- rigid contacts: sprocket, idler, belly, hull/turret top ----
    const rig = this.trackBroken ? [[G.sprocket.x, G.sprocket.y, 0.36], [G.idler.x, G.idler.y, D.idler.r + D.track.thick]] : [];      // (whole track: above, with traction)
    // belly: between the outermost road wheels (past them the sprocket and idler, with the track round them, are
    // what meets the ground; a belly corner out there ploughed into crater walls beside the idler)
    { let w0 = 1e9, w1 = -1e9; for (const w of G.wheels) { w0 = Math.min(w0, w.x); w1 = Math.max(w1, w.x); }
      const b0 = Math.max(G.belly.x0, w0), b1 = Math.min(G.belly.x1, w1);
      for (let k = 0; k <= 6; k++) rig.push([b0 + (b1 - b0) * k / 6, G.belly.y + 0.05, 0.05]); }
    // bow and stern: the vehicle's own underside outline (they were fixed points sized for the M1A1, which put a
    // T-55's "bow" 0.7 m ahead of its real one, catching crater walls)
    const ends = this._ends || (this._ends = (() => { const P = D.underside && D.underside.poly; if (!P) return [[-3.9, 0.5], [3.8, 0.0]];
      const f = P.reduce((m, q) => q[0] > m[0] ? q : m, P[0]), r = P.reduce((m, q) => q[0] < m[0] ? q : m, P[0]); return [[r[0], r[1]], [f[0], f[1]]]; })());
    rig.push([ends[0][0] * this.dir, ends[0][1], 0.1], [ends[1][0] * this.dir, ends[1][1], 0.1], [0, 1.4, 0.3]);
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
    const gs = this.gun;
    if (gs.rv < 0) {
      const ga = this.gunWorld(), tp = this.local(G.trunnion.x, G.trunnion.y), F = D.gun.recoilMass * gs.aB;
      apply(tp.x, tp.y, -Math.cos(ga) * F, -Math.sin(ga) * F);
    }
    // ---- explosion impulse (one step) ----
    if (this.kick) { apply(this.kick.x, this.kick.y, this.kick.fx, this.kick.fy); this.kick = null; }

    // ---- integrate hull ----
    this.vel.x += Fx / D.mass * dt; this.vel.y += Fy / D.mass * dt;
    this.w += tau / D.inertia * dt;
    this.w *= 1 - 0.02 * dt;
    this.pos.x += this.vel.x * dt; this.pos.y += this.vel.y * dt; this.ang += this.w * dt;

    // ---- terrain sinkage ----
    const half = D.footHalf || 0.385;            // half the ground each road wheel presses (wider for widely spaced wheels)
    let sinkMax = 0;
    for (const w of this.st) {
      if (w.N > 0) { w.sink = T.press(w.wx - half, w.wx + half, w.N, D.contactArea, dt); sinkMax = Math.max(sinkMax, w.sink); }
      else w.sink = 0;
    }
    this.stats.sink = sinkMax;

    // ---- the tracks work the sand: slipping grousers dig and throw it out behind; the leading wheel pushes
    // a small bow wave of sand ahead of it in soft going (both conserve sand) ----
    this.digAcc = this.digAcc || new Float32Array(this.st.length);
    const lead = this.st.reduce((m, w) => (w.lx * Math.sign(this.vt || 1) > m.lx * Math.sign(this.vt || 1) ? w : m), this.st[0]);
    this.st.forEach((w, k) => {
      if (!(w.N > 0)) return;
      const soil = T.soilAt(w.wx), slip = Math.abs(w.slip), cp = T.compAt(w.wx);
      // spinning against a steep wall (a crater side, a deep rut's end): the grousers claw the wall down into the
      // hole instead of digging deeper, so a tank works its way out
      const dir = Math.sign(this.input.drive || w.slip) || 1, ahead = w.wx + dir * 0.9, wall = (T.height(ahead) - T.height(w.wx)) / 0.9;
      if (slip > 0.35 && wall > 0.3 && Math.abs(this.vel.x) < 1) {
        T.shift(ahead, w.wx - dir * 0.2, Math.min(0.016, (slip - 0.35) * 0.008 * (0.5 + soil.dust)) * dt * 60 / this.st.length);
      } else if (slip > 0.35) {
        this.digAcc[k] += Math.min(0.02, (slip - 0.35) * 0.0035 * soil.dust) * (1 - 0.85 * cp) * dt;     // packed ground hardly digs
        if (this.digAcc[k] > 0.0012) {
          const vol = this.digAcc[k]; this.digAcc[k] = 0;
          T.deposit(w.wx, -vol);
          const back = -Math.sign(w.slip) || -1;
          world.particles.add(DS.P.GRAIN, w.wx + back * 0.3, w.wy - R + 0.12, this.vel.x + back * (1.5 + Math.random() * 3), 1.5 + Math.random() * 2.5, 2, 0.06,
            { drag: 0.3, mass: vol, col: parseInt(soil.col[1].slice(1), 16) });
        }
      }
      if (w === lead && w.sink > 0.025 && Math.abs(this.vt) > 0.5 && cp < 0.6) {
        const dirn = Math.sign(this.vt), vol = Math.min(0.0006, (w.sink - 0.025) * Math.abs(this.vt) * 0.003 * soil.dust) * (1 - cp / 0.6) * dt * 60;   // no bow wave on packed ground
        T.shift(w.wx + dirn * 0.35, w.wx + dirn * (0.9 + Math.random() * 0.4), vol);
      }
    });

    // ---- running gear rotation ----
    if (!this.trackBroken) this.s += this.vt * dt;
    for (const w of this.st) w.ang -= this.vt / D.wheelR * dt;
    this.sprAng -= this.vt / this.sprR() * dt;
    this.idlAng -= this.vt / (D.idler.r + D.track.thick / 2) * dt;

    if (this.chain) DS.TrackChain.step(this, dt);
    this.stepGun(dt, world);
    this.stepMG(dt, world);
    this.stepTow(dt, world);
    this.stepAntennas(dt);
    this.stepDamage(dt, world);
    if (this.turretBody) this.stepTurretBody(dt);
  }

  sprR() { return this.def.track.pitch * this.def.sprocket.teeth / (2 * Math.PI); }

  stepGun(dt, world) {
    const G = this.def.gun, gs = this.gun, d2r = Math.PI / 180;
    if (this.turretGone) return;
    DS.Gunnery.step(this, dt, world);
    if (this.alive && this.firepower) gs.aimW += this.input.elevRate * dt + this.input.elevStep;
    this.input.elevStep = 0;
    // an older stabiliser lets part of the hull's pitching through into the lay (gun.stab: share it holds out)
    // (an AI crew lays its gun afresh each frame, so for it the leak is kept as a drift it works off at its
    // gunner's pace: src/ai/TankAI.js)
    if (G.stab != null) { const leak = this.w * dt * (1 - G.stab); gs.aimW += leak; gs.drift = Math.max(-0.05, Math.min(0.05, (gs.drift || 0) + leak)); }
    // gun target = sight line + superelevation from the fire-control computer; clamp the sight so
    // the gun stays inside its mount limits (reversing direction then responds at once)
    const base = this.baseAng(), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    let et = wrap(this.dir * (gs.aimW + this.fc.se - base));
    et = Math.max(G.elevMin * d2r, Math.min(G.elevMax * d2r, et));
    gs.aimW = base + this.dir * et - this.fc.se;
    // autoloader (T-72): from the shot until `out` seconds before the round is home the gun sits locked at the
    // loading angle; the sight line (aimW) stays free, so the gunner can keep it on the target meanwhile
    const AL = G.autoloader; gs.locked = !!(AL && gs.reload > AL.out && this.alive && this.firepower && gs.fired > 0);
    const eg = gs.locked ? AL.angle * d2r : et, mx = (gs.locked || (AL && gs.fired > 0 && gs.reload > 0 && Math.abs(gs.e - et) > 0.02) ? 0.26 : G.rate) * dt;   // (the autoloader's own drive throws the gun to and from the loading angle)
    gs.e += Math.max(-mx, Math.min(mx, eg - gs.e));
    gs.reload = Math.max(0, gs.reload - dt);
    // spent case / case stub thrown out of the turret rear a moment after the shot
    if (G.eject && gs.ejectT > 0) { gs.ejectT -= dt; if (gs.ejectT <= 0 && this.alive) { const q = this.local(this.dir * G.eject.port[0], G.eject.port[1]); this.events.push({ type: 'case', x: q.x, y: q.y, E: G.eject }); } }
    if (gs.rv < 0) { gs.rv += gs.aB * dt; gs.rx += gs.rv * dt; if (gs.rv >= 0) gs.rv = 0.0001; }
    else if (gs.rx < 0) { const a = -(G.recoilK || 64) * gs.rx - (G.recoilC || 15) * gs.rv; gs.rv += a * dt; gs.rx += gs.rv * dt; if (gs.rx > -1e-4) { gs.rx = 0; gs.rv = 0; } }
    // fire coincidence (M1A1, Challenger, T-72): the trigger is held until the gun has caught up with the sight
    // (within 0.3 mil), a press kept for up to 1.5 s; older tanks fire wherever the gun is when pressed
    const ready = this.alive && this.firepower && gs.ammo && gs.reload <= 0 && gs.rx === 0;
    if (this.input.fire && ready) gs.pend = world.time;
    gs.laying = !!(G.coincide && !gs.locked && Math.abs(eg - gs.e) > 0.0003);
    const want = this.input.fire || (gs.pend != null && world.time - gs.pend < 1.5);
    if (want && ready && !gs.laying) { gs.pend = null; this.fire(world); }
    else if (gs.pend != null && world.time - gs.pend >= 1.5) gs.pend = null;
  }

  // muzzle velocity: fixed ammunition has its own; bagged charges (howitzer) set it by the charge chosen
  muzzleV(A) { const C = this.def.gun.charges; return A.bag && C ? C[Math.min(C.length - 1, this.gun.charge == null ? C.length - 1 : this.gun.charge)].v0 : A.v0; }
  fire(world) {
    const G = this.def.gun, gs = this.gun, A = DS.AMMO[gs.ammo];
    const S = DS.Gunnery.shot(this, A, world), v0 = S.v0, v0r = A.launchMass * v0 * 1.75 / G.recoilMass;     // (dispersion, bend, charge temperature, wear: src/ballistics/Gunnery.js)
    gs.rv = -v0r; gs.aB = v0r * v0r / (2 * G.recoilLen);
    gs.reload = G.reload * (this.wounds && this.wounds.loader ? 1.5 : 1); gs.fired++; this.lastFired = world.time; if (G.eject) gs.ejectT = G.eject.at;
    if (G.autoloader) this.events.push({ type: 'autoload' });
    if (G.pod) { gs.pod = (gs.pod == null ? G.pod : gs.pod) - 1; if (gs.pod <= 0) { gs.pod = G.pod; gs.reload = G.podReload; gs.podChange = true; } else gs.podChange = false; }
    const m = this.muzzle(), da = S.da * this.dir, cd = Math.cos(da), sd = Math.sin(da), ux = m.dx * cd - m.dy * sd, uy = m.dx * sd + m.dy * cd;
    const pr = world.spawnProjectile(m.x, m.y, ux * v0 + this.vel.x, uy * v0 + this.vel.y, A, this); pr.tracer = true;
    DS.Gunnery.fired(this, A);
    // indirect fire laid on a target (the fire-control map) and rockets count as locked on: through buildings
    pr.locked = !!this.indirectLock || (!!A.rocket && !!(this.lockTarget && this.lockTarget.alive));
    this.events.push({ type: G.launcher ? 'rocket' : 'fire', x: m.x, y: m.y, dx: m.dx, dy: m.dy, ammo: A });
  }

  // ---- TOW launcher: raise (vehicle halted) → launch → wire guidance along the sight line ----
  towPos() {
    const T = this.def.tow, t = this.tow, a = this.gunWorld() , p = this.local(this.dir * T.c[0], T.c[1] + T.lift * t.up);
    return { x: p.x + Math.cos(a) * T.len * 0.5, y: p.y + Math.sin(a) * T.len * 0.5, a, cx: p.x, cy: p.y };
  }
  stepTow(dt, world) {
    const t = this.tow; if (!t) return;
    const T = this.def.tow, halted = Math.abs(this.vt) < 0.6, ok = this.alive && this.firepower && !this.turretGone && !this.towBroken;
    if (this.input.tow) { this.input.tow = false; if (ok) { t.armed = true; t.req = true; t.idle = 0; } }
    if (t.missile && !t.missile.alive) { t.missile = null; t.idle = 0; }
    if (!t.missile) t.idle += dt;
    if (Math.abs(this.vt) > 2.5 || !ok || (t.idle > 8 && !t.req)) { t.armed = false; t.req = false; }   // stowed for travel
    t.up = Math.max(0, Math.min(1, t.up + (t.armed && halted ? dt : -dt) / T.raise));
    t.cool -= dt;
    if (t.req && t.up >= 1 && halted && t.loaded > 0 && !t.missile && t.cool <= 0) {
      const p = this.towPos();
      t.missile = world.spawnMissile(p.x, p.y, p.a, this, DS.AMMO[T.ammo]); t.missile.locked = !!(this.lockTarget && this.lockTarget.alive);
      t.loaded--; t.req = false; t.cool = 1.5; this.lastFired = world.time;
      this.events.push({ type: 'tow', x: p.x, y: p.y, a: p.a });
    }
    if (t.loaded === 0 && t.reserve > 0 && !t.missile) {
      t.reload += dt;
      if (t.reload >= T.reloadTime) { const n = Math.min(2, t.reserve); t.loaded = n; t.reserve -= n; t.reload = 0; }
    }
  }

  // ---- machine guns ----
  // commander's M2HB: aims at a world point (forward or rear arc), elevation −10…+65° on its own mount
  mgWorldAng() { const m = this.mg, s = m.side * this.dir; return s > 0 ? this.ang + m.el : Math.PI + this.ang - m.el; }
  mgMuzzle() {
    const D = this.def.mg, m = this.mg, a = this.mgWorldAng(), p = this.local(this.dir * D.pivot[0], D.pivot[1]);
    const L = Math.hypot(D.muzzle[0], D.muzzle[1]), off = Math.atan2(D.muzzle[1], D.muzzle[0]) * (m.side * this.dir > 0 ? 1 : -1);
    return { x: p.x + Math.cos(a + off) * L, y: p.y + Math.sin(a + off) * L, a };
  }
  stepMG(dt, world) {
    const d2r = Math.PI / 180;
    if (this.mg && !this.turretGone) {
      const D = this.def.mg, m = this.mg, aim = this.input.mgAim;
      if (aim && this.alive) {
        const p = this.local(this.dir * D.pivot[0], D.pivot[1]), dx = aim.x - p.x, dy = aim.y - p.y;
        const side = Math.sign(dx * this.dir) || 1;
        if (side !== m.side) { m.flip += dt; if (m.flip > 0.6) { m.side = side; m.flip = 0; } } else m.flip = 0;   // slewing round
        const base = m.side * this.dir > 0 ? this.ang : Math.PI + this.ang;
        let want = Math.atan2(dy, dx) - base; want = Math.atan2(Math.sin(want), Math.cos(want)) * (m.side * this.dir > 0 ? 1 : -1);
        want = Math.max(D.elevMin * d2r, Math.min(D.elevMax * d2r, want));
        const mx = 1.6 * dt; m.el += Math.max(-mx, Math.min(mx, want - m.el));
      }
      m.cool -= dt;
      if (this.input.mgFire && this.alive && !this.mgBroken && m.rounds > 0 && m.flip === 0 && m.cool <= 0) {
        m.cool += 1 / D.rate; if (m.cool < 0) m.cool = 0; m.rounds--; m.n++;
        const q = this.mgMuzzle(); this.shootBullet(world, q.x, q.y, q.a, DS.AMMO[D.ammo], D.spread, m.n, true);
      }
    }
    if (this.coax && !this.turretGone) {
      const D = this.def.coax, c = this.coax;
      c.cool -= dt;
      if (this.input.coaxFire && this.alive && this.firepower && c.rounds > 0 && c.cool <= 0) {
        c.cool += 1 / D.rate; if (c.cool < 0) c.cool = 0; c.rounds--; c.n++;
        const p = this.local(this.dir * D.muzzle[0], D.muzzle[1]);
        this.shootBullet(world, p.x, p.y, this.gun.aimW + (this.fc.seCoax || 0), DS.AMMO[D.ammo], D.spread, c.n, false);
      }
    }
  }
  shootBullet(world, x, y, a, A, spreadMil, n, heavy) {
    const j = ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 2 * spreadMil / 1000;
    const dx = Math.cos(a + j), dy = Math.sin(a + j);
    const p = world.spawnProjectile(x, y, dx * A.v0 + this.vel.x, dy * A.v0 + this.vel.y, A, this);
    p.tracer = n % (A.tracerEvery || 1) === 0;
    this.events.push({ type: 'mg', x, y, dx, dy, heavy });
    this.lastFired = world.time;
  }

  muzzle() {
    const a = this.gunWorld(), dx = Math.cos(a), dy = Math.sin(a);
    const tp = this.local(this.g.trunnion.x, this.g.trunnion.y), L = this.def.gun.muzzle + this.gun.rx;
    return { x: tp.x + dx * L, y: tp.y + dy * L, dx, dy };
  }
  sightOrigin() { return this.local(this.g.trunnion.x - this.dir * 0.4, this.g.trunnion.y + 0.35); }

  stepAntennas(dt) {
    const ax = (this.vel.x - this.prevBaseV.x) / dt, ay = (this.vel.y - this.prevBaseV.y) / dt;
    this.prevBaseV.x = this.vel.x; this.prevBaseV.y = this.vel.y;
    const alx = ax * Math.cos(this.ang) + ay * Math.sin(this.ang);
    const recoil = this.gun.rv < 0 ? -this.dir * this.gun.aB * this.def.gun.recoilMass / this.def.mass : 0;
    for (const a of this.antennas) {
      a.dphi += (-90 * a.phi - 1.6 * a.dphi - (alx + recoil) * 0.9) * dt; a.phi += a.dphi * dt;
      a.phi = Math.max(-0.9, Math.min(0.9, a.phi));
    }
  }

  // ---------------- char marks / flame sources ----------------
  // store a world point in the hull frame (or the turret frame when it sits on the turret)
  toLocal(x, y) { const c = Math.cos(this.ang), s = Math.sin(this.ang), dx = x - this.pos.x, dy = y - this.pos.y; return { x: c * dx + s * dy, y: -s * dx + c * dy }; }
  addScorch(x, y, max, part) {
    const l = this.toLocal(x, y);
    if (!part) part = !this.turretGone && l.y > this.g.ring.y - 0.05 ? 'turret' : 'hull';
    if (this.scorch.length > 10) this.scorch.shift();
    this.scorch.push({ lx: l.x, ly: l.y, part, t: 0, max });
  }
  // world position of a char mark / flame source (follows a thrown turret)
  spotWorld(sp) {
    if (sp.part === 'turret' && this.turretBody) {
      const b = this.turretBody, dx = sp.lx - this.g.ring.x, dy = sp.ly - this.g.ring.y, c = Math.cos(b.a), s = Math.sin(b.a);
      return { x: b.x + c * dx - s * dy, y: b.y + s * dx + c * dy };
    }
    return this.local(sp.lx, sp.ly);
  }
  fireSource() {             // where the fire vents: open turret ring, else the turret roof hatches
    return this.turretGone ? this.local(this.g.ring.x, this.g.ring.y) : this.local(this.g.ring.x - this.dir * 0.5, this.g.ring.y + 0.85);
  }

  // ---------------- damage model ----------------
  mod(id) { return this.def.modules.find(m => m.id === id); }
  crewAlive() { return this.def.modules.filter(m => m.type === 'crew' && !this.modState[m.id]).length; }

  // apply damage to a module (or 'track'); returns a short description for the hit log
  // how: 'crit' (a crewman badly wounded: out of action, not killed) or the fragment energy that reached the
  // module (0–1: a glancing fragment sets stowed rounds off less often)
  damage(id, at, how) {
    const rnd = Math.random, k = typeof how === 'number' ? 0.4 + 0.6 * how : 1;
    if (this.god) return '피해 없음 (무적)';
    if (id === 'track') {
      if (!this.trackBroken) { this.trackBroken = true; this.chain = DS.TrackChain.create(this, at ? at.x : this.pos.x, at ? at.y : this.pos.y - 1); this.events.push({ type: 'trackSnap', x: at ? at.x : this.pos.x, y: at ? at.y : this.pos.y - 1 }); }
      this.mobile = false; this.setStatus(); return '궤도 절단 → 기동 불능';
    }
    const m = this.mod(id);
    if (!m || this.modState[id]) return m ? m.name + ' (이미 손상)' : '';
    this.modState[id] = true;
    let out = m.name + ' 피해';
    switch (m.type) {
      case 'crew':
        out = m.name + (how === 'crit' ? ' 중상 (전투 불능)' : ' 전사');
        if (id === 'driver') this.mobile = false;
        if (id === 'gunner' && this.modState.commander) this.firepower = false;
        if (this.crewAlive() <= 1 || (this.modState.gunner && this.modState.commander)) { this.knockOut('승무원 전투 불능'); out += ' → 승무원 전투 불능'; }
        break;
      case 'tow': this.towBroken = true; out += ' → TOW 사용 불가'; break;
      case 'gun': case 'optics': this.firepower = false; out += ' → 화력 불능'; break;
      case 'engine': this.mobile = false; out += ' → 기동 불능'; if (rnd() < 0.2) out += this.fire2('engine'); break;
      case 'fuel': if (rnd() < 0.45) out += ' →' + this.fire2('fuel'); break;
      case 'ammo': if (rnd() < 0.5 * k) { this.cookoff(); out += ' → 탄약 유폭'; } else if (rnd() < 0.7) { this.ignite(); out += ' → 장약 화재'; } break;
      case 'fuel_ammo': if (rnd() < 0.6 * k) { this.cookoff(); out += ' → 탄약 유폭'; } else { this.ignite(); out += ' → 화재'; } break;
      case 'ammo_carousel': if (rnd() < 0.8 * Math.max(0.7, k)) { this.cookoff(); out += ' → 탄약 유폭, 포탑 이탈'; } else { this.ignite(); out += ' → 장약 화재'; } break;
      case 'ammo_bustle': this.firepower = false; this.vent = 3.5; out += ' → 방폭 패널 배출 (승무원 생존)'; break;
    }
    this.setStatus();
    return out;
  }
  // an engine or fuel fire: a Halon system (M1A1, Challenger, Bradley) puts most of them out — once or twice
  fire2(what) {
    if (this.halon == null) this.halon = { m1a1: 2, challenger1: 1, m2a2: 1 }[this.def.id] || 0;
    if (this.halon > 0) { this.halon--; if (Math.random() < 0.85) return ' 화재 → 자동 소화 장치 작동, 진화'; }
    this.ignite(); return ' 화재';
  }
  // a crewman hurt but still at his post (a second wound puts him out of action): loaders load slower, gunners
  // lay less steadily (src/ballistics/Gunnery.js, src/ai/TankAI.js)
  wound(id) {
    const m = this.mod(id); if (!m || this.modState[id] || this.god) return '';
    const W = this.wounds || (this.wounds = {});
    if (W[id]) return this.damage(id, null, 'crit');
    W[id] = 1; this.setStatus(); return m.name + ' 부상';
  }
  // outside equipment struck (H5): sight head, searchlight, machine gun, gun tube
  extDamage(id) {
    if (this.god) return '';
    if (id === 'optics') { if (this.opticsBroken) return ''; this.opticsBroken = true; this.setStatus(); return '조준경 헤드 파손 → 예비 조준경 (레이저 불능)'; }
    if (id === 'lamp') { if (this.lampBroken) return ''; this.lampBroken = true; this.light = 0; return '탐조등 파손'; }
    if (id === 'mg') { if (this.mgBroken) return ''; this.mgBroken = true; return '기관총 파손'; }
    if (id === 'barrel') { if (this.barrelHit) return ''; this.barrelHit = true; this.firepower = false; this.setStatus(); return '포신 피격 → 주포 사용 불가'; }
    return '';
  }
  setStatus() {
    if (this.wreck) this.status = '유폭 격파';
    else if (this.burning) this.status = '화재';
    else if (!this.alive) this.status = this.koReason || '격파';
    else if (!this.mobile && !this.firepower) this.status = '기동·화력 불능';
    else if (!this.mobile) this.status = '기동 불능';
    else if (!this.firepower) this.status = '화력 불능';
    else this.status = this.crewAlive() < this.def.modules.filter(m => m.type === 'crew').length ? '승무원 전투 불능' : this.wounds && Object.keys(this.wounds).length ? '승무원 부상' : this.opticsBroken ? '조준경 파손' : '정상';
  }
  knockOut(reason) { this.diedAt = this.diedAt || this.simT; this.alive = false; this.koReason = reason; this.input.drive = 0; this.input.fire = false; this.setStatus(); }
  ignite() {
    if (this.burning || this.wreck) return;
    this.burning = 0.01; this.alive = false; this.koReason = '화재';
    const f = this.fireSource(); this.addScorch(f.x, f.y - 0.3, 2.2);
    // a fire reaching stowed charges cooks them off after a while
    const hasAmmo = this.def.modules.some(m => /ammo/.test(m.type) && m.type !== 'ammo_bustle' && !this.modState[m.id]);
    this.cookT = hasAmmo && Math.random() < 0.65 ? 6 + Math.random() * 20 : -1;
    this.setStatus();
  }
  cookoff() {
    if (this.wreck) return;
    this.wreck = true; this.alive = false; this.burning = Math.max(this.burning, 0.01); this.cookT = -1;
    this.mobile = false; this.firepower = false;
    this.events.push({ type: 'explode' });
    this.jet = 4 + Math.random() * 4;            // charges keep venting through the ring as a flame jet
    const rg = this.local(this.g.ring.x, this.g.ring.y);
    this.addScorch(rg.x, rg.y, 2.6, 'hull'); this.addScorch(rg.x, rg.y + 0.1, 2.0, 'turret');
    // turret thrown by the blast (always for the T-72 carousel, often otherwise)
    if (this.def.modules.some(m => m.type === 'ammo_carousel') || Math.random() < 0.5) this.tossTurret();
    const p = this.local(this.g.ring.x, this.g.ring.y - 0.4);
    this.kick = { x: p.x + (Math.random() - 0.5), y: p.y, fx: (Math.random() - 0.5) * 2e6, fy: 6e6 };
    this.setStatus();
  }
  // Turret thrown by the cook-off: the more charges go up at once (carousel autoloader), the higher it flies and
  // the harder it spins. It lands with a thump, digs a scar, bounces, tumbles or slides to rest; a gun tube that
  // ends up pointing at the ground is left stuck in the sand.
  tossTurret(world) {
    const r = this.local(this.g.ring.x, this.g.ring.y);
    const carousel = this.def.modules.some(m => m.type === 'ammo_carousel');
    const up = (carousel ? 13 : 8) + Math.random() * (carousel ? 9 : 6);
    this.turretGone = true;
    const side = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 5);
    this.turretBody = { x: r.x, y: r.y, a: this.ang, e: this.gun.e, vx: this.vel.x + side, vy: up,
      w: (Math.random() - 0.5) * (carousel ? 9 : 5), rest: false, bounces: 0 };
    this.events.push({ type: 'pillar' });                         // flame pillar out of the open ring
  }
  stepTurretBody(dt) {
    const b = this.turretBody, T = this.terrain;
    if (b.rest) return;
    b.vy -= DS.T.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
    const h = T.height(b.x);
    if (b.y < h + 0.35 && b.vy < 0) {
      const impact = -b.vy;
      b.y = h + 0.35; b.bounces++;
      if (impact > 3) this.events.push({ type: 'turretLand', x: b.x, y: h, v: impact });
      if (impact > 4) T.crater(b.x, 0.8 + impact * 0.04, Math.min(0.35, impact * 0.02), 0.5, 0.3);
      b.vy = impact * 0.22; b.vx *= 0.55; b.w = b.w * 0.5 + b.vx * 0.25;     // tumbles along the way it slides
      const gnd = Math.atan(T.slope(b.x));
      if (impact < 2.2 || b.bounces > 4) {
        b.rest = true; b.vy = b.vx = b.w = 0;
        let t = b.a - gnd; t = Math.atan2(Math.sin(t), Math.cos(t));
        const flip = Math.abs(t) > Math.PI / 2 ? Math.PI : 0;
        b.a = gnd + flip + (Math.random() - 0.5) * 0.3;            // resting on its roof or its ring, a little canted
        // muzzle end pointing down into the sand: the tube digs in
        const tip = this.dir * Math.cos(b.a) * 4, tipY = Math.sin(b.a) * this.dir * 4;
        if (tipY < -0.6) T.crater(b.x + tip, 0.4, 0.3, 0.4, 0);
        T.relax(undefined, undefined, 6);
      }
    }
  }
  stepDamage(dt, world) {
    if (this.burning) {
      this.burning += dt;
      if (this.cookT > 0 && this.burning > this.cookT) { this.cookT = -1; this.cookoff(); }
    }
    if (this.vent > 0) this.vent -= dt;
    if (this.jet > 0) this.jet -= dt;
    for (const sp of this.scorch) sp.t += dt;
    for (const h of this.holes) h.t -= dt;
    if (this.holes.length && this.holes[0].t <= 0) this.holes.shift();
  }

  // world-space running gear for rendering/track: circles in clockwise loop order
  gearCircles() {
    const D = this.def, G = this.g, h = D.track.thick / 2, out = [];
    const P = (p, r, fixed) => { const q = this.local(p.x, p.y); return { x: q.x, y: q.y, r, fixed }; };
    const rear = D.frontDrive ? P(G.idler, D.idler.r + h, true) : P(G.sprocket, this.sprR(), true);
    const front = D.frontDrive ? P(G.sprocket, this.sprR(), true) : P(G.idler, D.idler.r + h, true);
    out.push(rear);
    for (const r of G.rollers) out.push(P(r, r.r + h, false));
    // T-55 / T-62: no return rollers — the top run rests on the road wheels (rear → front)
    if (D.topRunOnWheels) for (const w of this.st) out.push({ x: w.wx, y: w.wy, r: D.wheelR + h, fixed: false });
    out.push(front);
    for (let i = this.st.length - 1; i >= 0; i--) { const w = this.st[i]; out.push({ x: w.wx, y: w.wy, r: D.wheelR + h, fixed: false }); }
    if (this.dir < 0) out.reverse();       // mirrored order would run counter-clockwise
    return out;
  }

  speedKmh() { return (this.vel.x * Math.cos(this.ang) + this.vel.y * Math.sin(this.ang)) * 3.6 * this.dir; }
};
