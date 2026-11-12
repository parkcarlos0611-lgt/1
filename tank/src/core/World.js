// World: owns terrain, vehicles, projectiles, particles, fx; fixed-step simulation.
DS.World = class World {
  constructor() {
    this.terrain = new DS.Terrain(7);
    this.cam = new DS.Camera();
    this.particles = new DS.Particles(DS.T.particles.max);
    this.fx = new DS.Effects(this);
    this.buildings = []; this.sched = [];          // sched: things due later [{ t, fn }] (bomblet bursts)
    this.vehicles = []; this.missiles = []; this.projectiles = []; this.hits = []; this.log = [];
    this.wind = 2.5; this.time = 0; this.acc = 0; this.debug = false;
    this.rng = DS.rng(1991);
    this.env = { visibility: 0, night: 0, wind: 2.5 };
  }
  spawnProjectile(x, y, vx, vy, ammo, owner) { const p = new DS.Projectile(x, y, vx, vy, ammo, owner); this.projectiles.push(p); return p; }

  spawnMissile(x, y, ang, owner, ammo) { const m = new DS.Missile(x, y, ang, owner, ammo); this.missiles.push(m); return m; }
  onMissileHit(m, h) {
    if (h.kind === 'armor') {
      const log0 = this.log[0];
      this.onProjectileHit(m, h);
      if (this.log[0] !== log0 && this.log[0].result === 'ricochet') this.fx.impact({ x: h.hit.x, y: h.hit.y, vx: m.vx, vy: m.vy, ammo: m.ammo, onArmor: true });   // fuze grazed: still bursts
      m.alive = false;
    } else { this.fx.impact(h); if (!m.owner.ai) this.addLog({ ground: true, range: h.range, ammo: h.ammo, t: h.t }); }
  }
  onProjectileHit(p, h) {
    if (h.kind === 'armor' && h.hit && h.hit.v) DS.Searchlight.hit(h.hit.v, h.hit.x, h.hit.y);       // a round near a searchlight breaks it
    if (p.ammo.blast) {                                   // high explosive: bursts on whatever it meets
      const q = h.kind === 'ground' ? h : h.kind === 'building' ? h : h.hit;
      p.alive = false; this.hits.push({ x: q.x, y: q.y }); if (this.hits.length > 20) this.hits.shift();
      return DS.Blast.burst(this, q.x, q.y, p, h.kind === 'armor' ? h.hit : null, h.kind === 'building' ? h.b : null);
    }
    if (h.kind === 'building') { p.alive = false; if (h.b.hit) h.b.hit(this, h.x, h.y, p); return this.fx.wallHit(h, p); }
    if (p.ammo.small) return this.onBulletHit(p, h);
    const ai = p.owner && p.owner.ai;
    if (h.kind === 'ground') {
      this.fx.impact(h); this.hits.push(h); if (this.hits.length > 20) this.hits.shift();
      if (!ai) this.addLog({ ground: true, range: h.range, ammo: h.ammo, t: h.t });
      if (ai) ai.observe({ x: h.x });
      return;
    }
    if (ai) ai.observe({ x: h.hit.x, hitVehicle: h.hit.v });
    if (h.hit.v === this.vehicles[0]) this.playerHitAt = this.time;
    const r = DS.Armor.resolve(this, p, h.hit);
    r.t = p.t; r.shooter = p.owner; { const sp = Math.hypot(p.vx, p.vy) || 1; r.shotDx = p.vx / sp; r.shotDy = p.vy / sp; }
    this.fx.armor(r);
    this.addLog(r);
    if (r.result === 'ricochet') {
      p.x = r.reflect.x; p.y = r.reflect.y; p.vx = r.reflect.vx; p.vy = r.reflect.vy;
      p.ignore = h.hit.v; p.ignoreT = 0.05;
      if (p.ammo.type === 'HEAT') { /* fuze graze: keeps flying, detonates on the next surface */ }
    } else {
      p.alive = false;
      if (p.ammo.type === 'HEAT') this.fx.impact({ x: h.hit.x, y: h.hit.y, vx: p.vx, vy: p.vy, ammo: p.ammo, onArmor: true });
    }
  }
  // small-arms rounds: same armour test, but only sparks / sand — no log entries or hit labels
  onBulletHit(p, h) {
    if (h.kind === 'ground') { this.fx.bulletGround(h); return; }
    const r = DS.Armor.resolve(this, p, h.hit);
    this.fx.bulletArmor(r);
    if (r.result === 'pen' && r.effects.some(e => e !== '파편 피해 경미')) { r.t = p.t; r.shooter = p.owner; this.addLog(r); }
    if (r.result === 'ricochet') { p.x = r.reflect.x; p.y = r.reflect.y; p.vx = r.reflect.vx; p.vy = r.reflect.vy; p.ignore = h.hit.v; p.ignoreT = 0.05; }
    else p.alive = false;
  }
  // Hulls of opposing sides in contact along the drive line push each other apart: overlap is resolved in proportion to mass and
  // the closing speed is shared out as in an inelastic collision (a little bounce). A hard knock rocks the hulls,
  // throws dust and clangs; above 5 m/s the lighter vehicle can lose a track. Aircraft are not included.
  contacts(h) {
    const V = this.vehicles.filter(v => !v.heli);
    for (let a = 0; a < V.length; a++) for (let b = a + 1; b < V.length; b++) {
      const A = V[a], B = V[b], hl = v => Math.max(Math.abs(v.def.belly.x0), Math.abs(v.def.belly.x1)) + 0.15;
      const dx = B.pos.x - A.pos.x, gap = Math.abs(dx) - (hl(A) + hl(B));
      if (gap >= 0 || Math.abs(B.pos.y - A.pos.y) > 3 || A.team === B.team || !A.alive || !B.alive) continue;      // friends drive in another lane; wrecks are driven past
      const s = Math.sign(dx) || 1, mA = A.def.mass, mB = B.def.mass, k = -gap;
      A.pos.x -= s * k * mB / (mA + mB); B.pos.x += s * k * mA / (mA + mB);
      const rel = (B.vel.x - A.vel.x) * s;                               // < 0: closing
      if (rel < 0) {
        const J = -(1 + 0.15) * rel / (1 / mA + 1 / mB);
        A.vel.x -= s * J / mA; B.vel.x += s * J / mB;
        if (-rel > 1.2 && this.time - (A._bump || 0) > 0.4) {
          A._bump = this.time; const px = A.pos.x + s * hl(A), py = Math.max(A.pos.y, B.pos.y) - 0.3;
          A.w += s * Math.min(0.15, -rel * 0.02) * mB / (mA + mB); B.w -= s * Math.min(0.15, -rel * 0.02) * mA / (mA + mB);
          DS.Audio.thud(px, py, Math.min(1.3, -rel / 6)); DS.Audio.tick(px, py, 1);
          for (let i = 0; i < 8; i++) this.particles.add(DS.P.DUST, px, this.terrain.height(px) + 0.5, (Math.random() - 0.5) * 4, Math.random() * 2, 3 + Math.random() * 3, 0.8 + Math.random() * 0.6, { grow: 1, drag: 1.1, grav: 0, alpha: 0.32, col: 0xcbb38a });
          if (-rel > 5) { const L = mA < mB ? A : B; if (L.alive && !L.trackBroken && !L.god && Math.random() < 0.5) L.damage('track', { x: px, y: py - 1 }); }
        }
      }
    }
  }
  addLog(r) { this.log.unshift({ ...r, at: this.time }); if (this.log.length > 6) this.log.pop(); }

  update(frameDt) {
    DS.Sky.update(this, frameDt);
    const h = 1 / DS.T.physicsHz;
    this.acc = Math.min(this.acc + frameDt, h * DS.T.maxSubsteps);
    DS.Thermal.update(this, frameDt);
    DS.Sensor.update(this, frameDt);
    for (const v of this.vehicles) if (v.ai) v.ai.update(frameDt);
    while (this.acc >= h) {
      // Vehicles standing still with nothing to do (no orders, no target, no shot fired or round landing near
      // them for a while) are put to sleep: their suspension has settled and stepping them changes nothing.
      // With twenty-odd vehicles on a map this is most of the physics. Any input, target, nearby round or the
      // player's seat wakes them at once.
      for (const v of this.vehicles) {
        if (v.heli || v === this.vehicles[0] || v.input.drive || v.input.fire || v.input.tow || (v.ai && v.ai.tgt) || Math.abs(v.vt) > 0.03 || Math.abs(v.vel.x) + Math.abs(v.vel.y) > 0.08 || this.time - (v.lastFired == null ? -99 : v.lastFired) < 4) v._quiet = 0;
        else if (v._quiet > 1.5) { let near = false; for (const p of this.projectiles) if (Math.abs(p.x - v.pos.x) < 40 && Math.abs(p.y - v.pos.y) < 40) { near = true; break; } if (near) v._quiet = 0; }
        v._quiet = (v._quiet || 0) + h;
        if (v._quiet > 1.5) continue;
        v.step(h, this);
      }
      this.contacts(h);
      for (const p of this.projectiles) {
        const ox = p.x, oy = p.y;
        let hit = p.step(h, this.terrain, this);
        // a round fired at a locked-on target (missiles, rockets, indirect fire) is let through buildings to it — a
        // rule for play, not physics: the buildings are scenery in depth, the target is on the drive line
        if (this.buildings.length && !p.locked) { const b = DS.Building.ray(this, ox, oy, p.x, p.y); if (b) { p.x = b.x; p.y = b.y; hit = { kind: 'building', x: b.x, y: b.y, b: b.b }; } }
        if (!hit && p.ammo.cluster && p.vy < 0 && p.y - this.terrain.height(p.x) < p.ammo.cluster.alt) { p.alive = false; DS.Blast.cluster(this, p); continue; }
        if (hit) this.onProjectileHit(p, hit);
      }
      this.projectiles = this.projectiles.filter(p => p.alive);
      for (const m of this.missiles) {
        const ox = m.x, oy = m.y, hit = m.step(h, this);
        const b = m.alive && this.buildings.length && !m.locked ? DS.Building.ray(this, ox, oy, m.x, m.y) : null;
        if (b) { m.alive = false; this.fx.impact({ x: b.x, y: b.y, vx: m.vx, vy: m.vy, ammo: m.ammo, onArmor: true }); b.b.blast(this, b.x, b.y, 3); }
        else if (hit) this.onMissileHit(m, hit);
      }
      this.missiles = this.missiles.filter(m => m.alive);
      this.acc -= h; this.time += h;
    }
    for (const b of this.buildings) b.step(frameDt, this);
    for (const p of this.projectiles) { if (p.burning) this.fx.rocketTrail(p, frameDt); if (DS.T.flyFx !== false) this.fx.flight(p, frameDt); }
    if (this.sched.length) { const due = this.sched.filter(s => s.t <= this.time); if (due.length) { this.sched = this.sched.filter(s => s.t > this.time); for (const s of due) s.fn(); } }
    this.terrain.relax(undefined, undefined, 1);
    for (const v of this.vehicles) this.fx.vehicle(v, frameDt);
    this.fx.ambient(frameDt);
    // wind moves sand around the vehicles (strong winds only: the sandstorm)
    if (Math.abs(this.wind) > 4 && this.vehicles.length) {
      let a = 1e9, b = -1e9; for (const v of this.vehicles) { a = Math.min(a, v.pos.x); b = Math.max(b, v.pos.x); }
      this.terrain.windStep(frameDt, this.wind, a - 120, b + 120);
    }
    for (const m of this.missiles) this.fx.missile(m, frameDt);
    this.particles.update(frameDt, this.terrain, this.wind);
    this.fx.update(frameDt);
    if (this.vehicles[0]) this.cam.follow(this.vehicles[0], frameDt);
    const sh = this.fx.shake; this.cam.sx = (Math.random() - 0.5) * sh * 0.25; this.cam.sy = (Math.random() - 0.5) * sh * 0.25;
  }
};
