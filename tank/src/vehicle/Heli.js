// Attack helicopter (AH-64A, AH-1W). A Vehicle subclass so sensors, armour, damage, fire and the HUD work unchanged,
// but it flies: side-view flight model, a chin gun that follows the mouse, unguided rockets fired along the
// nose, Hellfire missiles that fly a lofted path onto the designated target, and it can turn round at will.
//   input.drive  −1…+1  lean toward −x / +x (accelerate that way; drag limits the speed)
//   input.climb  −1…+1  descend / climb (released: holds height)
//   input.aim    world point the sight and gun follow;  fire: cannon, coaxFire: rockets, hf: Hellfire
DS.Heli = class Heli extends DS.Vehicle {
  constructor(def, x, terrain, opt = {}) {
    super(def, x, terrain, opt);
    this.heli = true; this.rpm = 0; this.turnT = 0; this.rot = 0; this.onGround = true; this.lean = 0;
    this.input.climb = 0; this.input.aim = null; this.input.hf = false;
    this.rearm(); this.hfState = { missile: null, cool: 0 }; this.rkCool = 0;
    this.gun.ammo = def.ammo[0]; this.gun.charge = undefined;
  }
  rearm() { const D = this.def; this.cannon = D.gun.rounds; this.rk = D.rockets.n; this.hf = D.hellfire.n; this.hfSide = [D.hellfire.n / 2, D.hellfire.n / 2]; this.hfNext = 0; }
  place(x) {
    this.pos.x = x; this.pos.y = this.terrain.height(x) + this.def.flight.gearH + (this.hoverAlt || 0);
    this.ang = 0; this.vel.x = this.vel.y = this.w = this.vt = 0; this.lean = 0;
    if (this.gun) this.gun.aimW = this.baseAng();
  }
  // geometry that depends on the facing is rebuilt when the helicopter turns round
  setDir(d) {
    const D = this.def; this.dir = d;
    this.g.trunnion = { x: D.gun.trunnion[0] * d, y: D.gun.trunnion[1] }; this.g.ring = { x: D.turretRing[0] * d, y: D.turretRing[1] };
    this.g.exhaust = { x: D.exhaust.x * d, y: D.exhaust.y }; this.g.sprocket.x = -4.5 * d; this.g.idler.x = 4.5 * d;
    this._platesT = -1;
  }
  // turning round (C only): a short pause for the pedal turn, then it faces the other way at once
  turn() { if (this.alive && this.turnT <= 0) this.turnT = 0.35; }
  alt() { return this.pos.y - this.def.flight.gearH - this.terrain.height(this.pos.x); }
  sightOrigin() { const S = this.def.sightAt; return this.local(this.dir * S[0], S[1]); }
  gunWorld() { return this.baseAng() + this.dir * this.gun.e; }
  muzzleV(A) { return A.v0; }
  speedKmh() { return Math.hypot(this.vel.x, this.vel.y) * 3.6; }
  damage(id, at) {
    if (id === 'track') return '';
    const m = this.mod(id), had = m && this.modState[id];
    if (this.god) return '피해 없음 (무적)';
    if (m && m.type === 'crew') {                       // either crewman can fly it: it goes down only with both lost
      if (had) return m.name + ' (이미 손상)';
      this.modState[id] = true;
      let o = m.name + ' 전사';
      if (this.crewAlive() === 0) { this.knockOut('승무원 전사'); o += ' → 추락'; } else if (id === 'gunner') o += ' (조종사가 계속 비행)'; else o += ' (부조종사가 조종 인계)';
      this.setStatus(); return o;
    }
    let out = super.damage(id, at);
    if (m && !had && m.type === 'rotor') { this.knockOut('로터 파손'); out += ' → 추락'; }
    if (m && !had && m.type === 'engine') out = m.name + ' 피해 → 자동회전 강하';
    if (!this.alive && !this.koReason) this.koReason = '격추';
    return out;
  }

  step(dt, world) {
    const D = this.def, F = D.flight, I = this.input, T = this.terrain, g = DS.T.g, d2r = Math.PI / 180;
    this.simT += dt;
    const powered = this.alive && this.mobile;
    // rotor speed
    const want = this.alive ? (this.parked ? 0 : 1) : 0;
    this.rpm += (want - this.rpm) * Math.min(1, dt / (want > this.rpm ? 6 : 12)); this.rot += this.rpm * 30 * dt;
    this.spool += ((this.alive ? 0.45 + 0.4 * Math.abs(I.climb || 0) + 0.3 * Math.abs(I.drive || 0) : 0) - this.spool) * Math.min(1, dt / 1.2);
    // turning round (C): after a short pause the facing flips
    if (this.turnT > 0) { this.turnT -= dt; if (this.turnT <= 0) { this.turnT = 0; this.setDir(-this.dir); } }
    const lift = this.rpm > 0.85;
    let alt = this.alt();
    if (this.alive) {
      // lean → horizontal acceleration; drag sets the top speed
      const leanT = lift ? (I.drive || 0) * F.tilt * d2r : 0;
      this.lean += (leanT - this.lean) * Math.min(1, dt * 2.2);
      const amax = g * Math.tan(F.tilt * d2r), kd = amax / (F.vmax * F.vmax);
      let ax = lift ? g * Math.tan(this.lean) - kd * this.vel.x * Math.abs(this.vel.x) : 0;
      if (!I.drive && lift) ax -= this.vel.x * 0.25;                       // eases to a hover when the stick is centred
      // height: climb / descend on command, hold otherwise; a dead engine means autorotation
      let vyT = (I.climb || 0) > 0 ? F.climb * I.climb : (I.climb || 0) * F.sink;
      if (this.hoverAlt != null && !I.climb) vyT = Math.max(-3, Math.min(3, (this.hoverAlt - alt) * 0.6));
      if (!powered) vyT = Math.min(-7, vyT - 7);
      if (!lift) vyT = this.onGround ? 0 : -F.sink;
      const ay = Math.max(-7, Math.min(6, (vyT - this.vel.y) * 2.5));
      this.vel.x += ax * dt; this.vel.y += ay * dt;
      this.ang = -this.lean * 0.9;
    } else {
      // shot down: falls, tumbling
      this.vel.y -= g * dt; this.vel.x *= 1 - 0.1 * dt; this.ang += this.w * dt;
      if (!this.wreck && Math.abs(this.w) < 0.2) this.w = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random());
    }
    this.pos.x = Math.max(20, Math.min(T.length ? T.length - 20 : T.n * T.dx - 20, this.pos.x + this.vel.x * dt));
    this.pos.y += this.vel.y * dt; this.vt = this.vel.x;
    alt = this.alt();
    if (alt <= 0) {
      const hard = !this.alive || this.vel.y < -8 || Math.abs(this.vel.x) > 20;
      this.pos.y -= alt;
      if (hard && !this.wreck) this.crash();
      this.vel.y = 0; this.vel.x *= 1 - Math.min(1, dt * (this.wreck ? 6 : 2)); this.onGround = true;
      if (this.wreck) { this.w = 0; }
    } else this.onGround = false;
    if (this.burning) this.burning += dt;
    this.stepWeapons(dt, world);
  }
  crash() {
    this.alive = false; this.wreck = true; this.koReason = this.koReason || '추락'; this.burning = Math.max(this.burning, 0.01); this.rpm = 0;
    this.ang = (Math.random() - 0.5) * 0.5; this.setStatus();
    this.events.push({ type: 'explode' });
  }
  stepWeapons(dt, world) {
    const D = this.def, G = D.gun, gs = this.gun, I = this.input, d2r = Math.PI / 180, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    const ok = this.alive && this.firepower && this.turnT <= 0;
    // sight line follows the aim point (the mouse); the gun follows the sight inside its arc
    const o = this.sightOrigin();
    if (I.aim && this.alive) gs.aimW = Math.atan2(I.aim.y - o.y, I.aim.x - o.x);
    const base = this.baseAng();
    let et = wrap(this.dir * (gs.aimW - base)); et = Math.max(G.elevMin * d2r, Math.min(G.elevMax * d2r, et));
    const mx = G.rate * dt; gs.e += Math.max(-mx, Math.min(mx, et - gs.e));
    gs.reload = Math.max(0, gs.reload - dt);
    if (I.fire && ok && this.cannon > 0 && gs.reload <= 0) {
      gs.reload = G.reload; gs.fired++; this.cannon--; this.lastFired = world.time;
      const m = this.muzzle();
      this.shootBullet(world, m.x, m.y, Math.atan2(m.dy, m.dx), DS.AMMO[gs.ammo], G.spread, gs.fired, true);
    }
    // rockets: ripple fire along the nose
    this.rkCool -= dt;
    if (I.coaxFire && ok && this.rk > 0 && this.rkCool <= 0) {
      this.rkCool = D.rockets.interval; this.rk--; this.lastFired = world.time;
      // with a target locked the pod is laid on it (a little above, for the drop); the ripple keeps its spread
      const A = DS.AMMO[D.rockets.ammo], p = this.local(this.dir * D.rockets.at[0], D.rockets.at[1]), L = this.lock && this.lock.alive ? this.lock : null;
      const aim = L ? Math.atan2(L.pos.y + 1.2 - p.y + Math.hypot(L.pos.x - p.x, L.pos.y - p.y) * 0.0035, L.pos.x - p.x) : base, a = aim + (Math.random() - 0.5) * 0.012;
      const pr = world.spawnProjectile(p.x, p.y, Math.cos(a) * A.v0 + this.vel.x, Math.sin(a) * A.v0 + this.vel.y, A, this); pr.tracer = true; pr.locked = !!L;
      this.events.push({ type: 'rocket', x: p.x + Math.cos(a) * 3, y: p.y + Math.sin(a) * 3, dx: Math.cos(a), dy: Math.sin(a), ammo: A, light: true });
    }
    // Hellfire
    const H = this.hfState; H.cool -= dt; if (H.missile && !H.missile.alive) H.missile = null;
    if (I.hf) {
      I.hf = false;
      if (ok && this.hf > 0 && H.cool <= 0) {
        // launched from the two stub wings in turn (near side, far side); the far pylon sits a little behind
        // and above in this view
        let sd = this.hfNext; if (this.hfSide[sd] <= 0) sd = 1 - sd;
        this.hfNext = 1 - sd;
        H.cool = D.hellfire.interval; this.lastFired = world.time;
        // each side carries 8: the upper rail empties first, then the lower. On the near side the drawn missile
        // leaves its rail; the far side's come out from behind the fuselage, a little behind and above.
        const slot = this.hfSide[sd] > D.hellfire.n / 4 ? 'up' : 'lo', R = D.src.hf && D.src.hf[slot];
        const [OX, OY] = D.src.origin || [680, 190], sc = R ? [-(R[0] + R[2] / 2 - OX) / D.src.ppm, -(R[1] + R[3] / 2 - OY) / D.src.ppm] : D.hellfire.at;
        const p = this.local(this.dir * (sc[0] - (sd ? 0.35 : 0)), sc[1] + (sd ? 0.22 : 0));
        let tgt = this.lock && this.lock.alive ? { v: this.lock } : null;
        if (!tgt) { const r = DS.FireControl.lase(world, this, D.hellfire.range); tgt = r ? (r.vehicle ? { v: r.vehicle } : { x: r.x, y: r.y }) : { x: o.x + Math.cos(gs.aimW) * 3000, y: o.y + Math.sin(gs.aimW) * 3000 }; }
        this.hfSide[sd]--; this.hf = this.hfSide[0] + this.hfSide[1];
        const q = this.local(this.dir * (sc[0] + 1), sc[1]), p0 = this.local(this.dir * sc[0], sc[1]), rail = Math.atan2(q.y - p0.y, q.x - p0.x);
        const m = H.missile = new DS.Hellfire(p.x, p.y, rail, this, DS.AMMO[D.hellfire.ammo], tgt); world.missiles.push(m); m.locked = !!tgt.v;
        if (R) { m.spr = D.id + '/hf_' + slot; m.len = R[2] / D.src.ppm; m.wid = R[3] / D.src.ppm; }
        m.far = sd === 1; m.burn = 2.6;
        const bx = p.x - Math.cos(rail) * 1, by = p.y - Math.sin(rail) * 1;
        this.events.push({ type: 'rocket', x: bx, y: by, dx: Math.cos(rail), dy: Math.sin(rail), light: true });
      }
    }
  }
  hudLine() { return `고도 ${Math.max(0, Math.round(this.alt()))} m · ${this.def.gun.short || '30mm'} ${this.cannon} · 로켓 ${this.rk} · 헬파이어 ${this.hfSide[0]}+${this.hfSide[1]}` + (this.hfState.missile ? ' · 유도 중' : '') + (this.lock ? ' · 표적 고정' : ''); }
};

// AGM-114 Hellfire: accelerates to about 425 m/s and homes on the designated vehicle or point, flying above the
// line to the target while it is far and tipping over onto it at the end (top attack).
DS.Hellfire = class Hellfire {
  constructor(x, y, ang, owner, ammo, tgt) {
    this.x = x; this.y = y; this.ang = ang; this.owner = owner; this.ammo = ammo; this.tgt = tgt;
    this.speed = 40; this.t = 0; this.alive = true; this.x0 = x; this.y0 = y; this.guided = true;
    this.vx = Math.cos(ang) * this.speed + owner.vel.x; this.vy = Math.sin(ang) * this.speed + owner.vel.y;
  }
  step(dt, world) {
    const terrain = world.terrain, o = this.owner, T = this.tgt;
    this.t += dt;
    this.speed = this.t < 3 ? Math.min(425, this.speed + 160 * dt) : Math.max(180, this.speed - 9 * dt);
    let tx, ty;
    if (T.v) { const q = T.v.local(T.v.g.ring.x, T.v.g.ring.y + 0.5); tx = q.x; ty = q.y; if (T.v.heli) ty = T.v.pos.y; } else { tx = T.x; ty = T.y; }
    const dh = Math.abs(tx - this.x);
    if (this.t > 0.25) {
      const loft = T.v && T.v.heli ? 0 : Math.min(350, Math.max(0, dh - 300) * 0.5);      // climbs only while far; inside 300 m it goes straight in
      let d = Math.atan2(ty + loft - this.y, tx - this.x) - this.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
      const mx = 2.6 * dt; this.ang += Math.max(-mx, Math.min(mx, d));
      this.vx = Math.cos(this.ang) * this.speed; this.vy = Math.sin(this.ang) * this.speed;
    }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    const hit = DS.Armor.raycast(world, this.x, this.y, nx, ny, o, o.team);
    if (hit) { this.x = hit.x; this.y = hit.y; this.alive = false; return { kind: 'armor', hit }; }
    const flown = Math.hypot(this.x - this.x0, this.y - this.y0);
    if (ny < terrain.height(nx)) {
      this.x = nx; this.y = terrain.height(nx); this.alive = false;
      return { kind: 'ground', x: this.x, y: this.y, vx: this.vx, vy: this.vy, ammo: this.ammo, range: flown, t: this.t };
    }
    this.x = nx; this.y = ny;
    if (this.t > 40 || nx < 0 || nx > terrain.n * terrain.dx) this.alive = false;
    return null;
  }
};

// ---- drawing and effects ----
Object.assign(DS.Renderer.prototype, {
  loadHeli(def) {
    this.img[def.id] = this.img[def.id] || {};
    return Promise.all(['body', 'body_l', 'rotor', 'tailrotor'].concat(def.flight.wheels.length ? ['wheel'] : [], def.src.hf ? ['hf_up', 'hf_lo'] : [], def.src.gun ? ['gun'] : []).map(n => new Promise((res, rej) => { const im = new Image(); im.onload = () => { this.img[def.id][n] = im; this.mips[def.id + '/' + n] = this.buildMips(im); res(); }; im.onerror = () => rej(new Error('sprite ' + def.id + '/' + n)); im.src = def.src.dir + n + '.png'; })));
  },
  drawHeli(ctx, v, cam) {
    const D = v.def, S = D.src, F = D.flight, px = 1 / S.ppm, zp = cam.zoom * cam.dpr, [OX, OY] = S.origin || [680, 190], TH = S.tailHub || [1336, 100];
    // turning round: the airframe is seen end-on halfway through
    const sx = v.dir;                                  // (no squeeze: the turn is a straight flip after a pause)
    // a far-side Hellfire just off its rail is still behind the fuselage
    for (const m of this.w.missiles) if (m.owner === v && m.far && m.t < 0.45) this.drawMissile(ctx, m, cam);
    ctx.save(); ctx.translate(v.pos.x, v.pos.y); ctx.rotate(v.ang); ctx.scale(sx, 1);
    ctx.imageSmoothingQuality = 'high';
    // local frame: x forward, y up; a sheet pixel (X, Y) sits at (-(X - 680), -(Y - 190)) / ppm.
    // Facing left the mirrored-as-drawn sprite is used, so lettering and tail number read correctly.
    const im = this.pick(D.id + (v.dir < 0 ? '/body_l' : '/body'), S.w * px * zp);
    ctx.save(); ctx.scale(1, -1); ctx.drawImage(im, -(S.ox + S.w - OX) * px, (S.oy - OY) * px, S.w * px, S.h * px); ctx.restore();
    // the near launcher's Hellfires still on their rails (upper rail fires first)
    // (an emptied rail shows the bare launcher channel with its two hold-back shoes)
    if (S.hf) for (const [slot, need] of [['up', D.hellfire.n / 4], ['lo', 0]]) {
      const R = S.hf[slot], x0 = -(R[0] + R[2] - OX) * px, y0 = (R[1] - OY) * px, w = R[2] * px;
      ctx.save(); ctx.scale(1, -1);
      if (v.hfSide[0] > need) ctx.drawImage(this.pick(D.id + '/hf_' + slot, R[2] * px * zp), x0, y0, w, R[3] * px);
      else {
        ctx.fillStyle = '#232321'; ctx.fillRect(x0 + 0.04, y0 - 0.02, w - 0.08, 0.075);
        ctx.fillStyle = '#4a4a45'; ctx.fillRect(x0 + 0.06, y0 - 0.015, w - 0.12, 0.018);
        ctx.fillStyle = '#1a1a19'; for (const f of [0.3, 0.68]) ctx.fillRect(x0 + w * f, y0 + 0.04, 0.09, 0.06);
      }
      ctx.restore();
    }
    // wheels (their own art; the drawn ones are cut out of the airframe)
    for (const [c, r] of F.wheels) { const w = this.pick(D.id + '/wheel', r * 2 * zp); ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(1, -1); ctx.drawImage(w, -r, -r, r * 2, r * 2); ctx.restore(); }
    // chin gun barrel at its own elevation
    const gp = D.gun.trunnion; ctx.save(); ctx.translate(gp[0], gp[1]); ctx.rotate(v.gun.e);
    if (S.gun) {                        // the drawn barrels, laid about the turret pivot
      const R = S.gun, P = S.gunPivot; ctx.scale(1, -1);
      ctx.drawImage(this.pick(D.id + '/gun', R[2] * px * zp), -(R[0] + R[2] - P[0]) * px, (R[1] - P[1]) * px, R[2] * px, R[3] * px);
    } else { ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-0.1, -0.05, D.gun.muzzle + 0.1, 0.1); ctx.fillRect(D.gun.muzzle - 0.18, -0.07, 0.18, 0.14); }
    ctx.restore();
    const k = Math.min(1, v.rpm);
    // Main rotor: the drawn head and blades turn as one about the mast — seen from the side that is the
    // drawing squeezed by cos(angle), flipping as it passes end-on. At speed several positions along the arc
    // swept during one frame are laid over each other (motion blur) with a faint disc.
    {
      const R = S.rotor, im2 = this.pick(D.id + '/rotor', R[2] * px * zp), ax = -(S.rotorAxis - OX) * px;
      const x0 = (S.rotorAxis - R[0]) * px, y0 = (R[1] - OY) * px, w = R[2] * px, h = R[3] * px;
      const n = k > 0.15 ? 2 + Math.round(6 * k) : 1, sweep = 0.75 * k, al = n === 1 ? 1 : Math.min(1, 1.9 / n + 0.12);
      if (k > 0.3) { ctx.fillStyle = `rgba(36,36,40,${0.1 * k})`; ctx.beginPath(); ctx.ellipse(ax, F.hub[1], F.rotorR, 0.13, 0, 0, 7); ctx.fill(); }
      ctx.globalAlpha = al;
      for (let i = 0; i < n; i++) {
        let c = Math.cos(v.rot - i * sweep / n); if (Math.abs(c) < 0.06) c = c < 0 ? -0.06 : 0.06;
        // the drawing shows the blades fore and aft at full span; widen it to the true radius
        const wide = F.rotorR / (Math.max(S.rotorAxis - R[0], R[0] + R[2] - S.rotorAxis) * px);
        ctx.save(); ctx.translate(ax, 0); ctx.scale(-c * wide, -1); ctx.drawImage(im2, -x0, y0, w, h); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // tail rotor: faces the viewer, so the drawn blades simply spin about their hub, blurred the same way
    {
      const R = S.tailrotor, im3 = this.pick(D.id + '/tailrotor', R[2] * px * zp), tr = F.tail;
      const cx = (TH[0] - R[0]) * px, cy = (TH[1] - R[1]) * px, w = R[2] * px, h = R[3] * px;
      const n = k > 0.15 ? 2 + Math.round(12 * k) : 1, al = n === 1 ? 1 : Math.min(1, 1.5 / n + 0.05);
      if (k > 0.3) { ctx.fillStyle = `rgba(36,36,40,${0.12 * k})`; ctx.beginPath(); ctx.arc(tr[0], tr[1], F.tailR, 0, 7); ctx.fill(); }
      ctx.globalAlpha = al;
      for (let i = 0; i < n; i++) { ctx.save(); ctx.translate(tr[0], tr[1]); ctx.rotate(v.rot * 2.3 - i * 1.57 * k / n); ctx.scale(-1, -1); ctx.drawImage(im3, -cx, -cy, w, h); ctx.restore(); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  },
});
Object.assign(DS.Effects.prototype, {
  heliFx(v, dt) {
    const P = this.P, K = DS.P, T = this.w.terrain, r = (a, b) => this.rnd(a, b);
    const alt = v.alt(), x = v.pos.x, gy = T.height(x);
    // rotor wash: a ring of dust blown outward along the ground, strongest close to it
    if (v.rpm > 0.6 && alt < 28) {
      const soil = T.soilAt(x), sc = this.hex(soil.col[1]), k = (1 - alt / 28) * v.rpm * (0.3 + soil.dust);
      let n = 26 * k * dt + Math.random() * 0.4;
      while (n-- >= 1) { const s = Math.random() < 0.5 ? 1 : -1, d = r(3, 9);
        P.add(K.DUST, x + s * d, T.height(x + s * d) + r(0.1, 0.9), s * r(4, 13) * (0.5 + k), r(0.2, 2.2), r(2.5, 6), r(0.8, 1.8), { grow: r(0.8, 1.6), drag: 1.1, grav: 0, alpha: 0.3 * Math.min(1, k + 0.3), col: sc }); }
      if (Math.random() < 30 * k * dt) { const s = Math.random() < 0.5 ? 1 : -1; P.add(K.GRAIN, x + s * r(2, 7), gy + 0.1, s * r(4, 12), r(1, 4), r(0.5, 1.2), r(0.03, 0.06), { drag: 0.5, col: sc }); }
    }
    // engine exhaust shimmer; smoke once hit or falling
    const e = v.local(v.g.exhaust.x, v.g.exhaust.y);
    if (v.alive && Math.random() < 20 * dt) P.add(K.HEAT, e.x, e.y, v.vel.x - v.dir * r(3, 7), r(-0.5, 1), r(0.4, 0.9), r(0.3, 0.6), { grow: 1.2, drag: 2.5, grav: -0.05, alpha: 0.1, col: 0xe8e4dc });
    if ((!v.alive && !v.onGround) || (v.alive && !v.mobile)) for (let i = 0; i < 2; i++) P.add(K.DARK, e.x + r(-0.4, 0.4), e.y + r(-0.2, 0.4), v.vel.x * 0.3 + r(-1, 1), r(0.5, 2), r(2.5, 5), r(0.5, 1), { grow: 1, drag: 1, grav: -0.02, alpha: 0.5, col: 0x2a2623 });
    if (v.burning) this.burning(v, dt);
    // blade beat
    v._beat = (v._beat || 0) - dt * v.rpm;
    if (v._beat <= 0 && v.rpm > 0.2) { v._beat = v.def.flight.beat || 0.105; DS.Audio.rotorBeat(v.pos.x, v.pos.y, v.rpm, v.def.flight.blades === 2); }
    this.dispatch(v);
  },
});
