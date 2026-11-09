// World: owns terrain, vehicles, projectiles, particles, fx; fixed-step simulation.
DS.World = class World {
  constructor() {
    this.terrain = new DS.Terrain(7);
    this.cam = new DS.Camera();
    this.particles = new DS.Particles(DS.T.particles.max);
    this.fx = new DS.Effects(this);
    this.vehicles = []; this.projectiles = []; this.hits = []; this.log = [];
    this.wind = 2.5; this.time = 0; this.acc = 0; this.debug = false;
    this.rng = DS.rng(1991);
    this.env = { visibility: 0, night: 0, wind: 2.5 };
  }
  spawnProjectile(x, y, vx, vy, ammo, owner) { const p = new DS.Projectile(x, y, vx, vy, ammo, owner); this.projectiles.push(p); return p; }

  onProjectileHit(p, h) {
    if (p.ammo.type === 'MG') return this.onBulletHit(p, h);
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
    r.t = p.t; r.shooter = p.owner;
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
    if (r.result === 'ricochet') { p.x = r.reflect.x; p.y = r.reflect.y; p.vx = r.reflect.vx; p.vy = r.reflect.vy; p.ignore = h.hit.v; p.ignoreT = 0.05; }
    else p.alive = false;
  }
  addLog(r) { this.log.unshift({ ...r, at: this.time }); if (this.log.length > 6) this.log.pop(); }

  update(frameDt) {
    const h = 1 / DS.T.physicsHz;
    this.acc = Math.min(this.acc + frameDt, h * DS.T.maxSubsteps);
    for (const v of this.vehicles) if (v.ai) v.ai.update(frameDt);
    while (this.acc >= h) {
      for (const v of this.vehicles) v.step(h, this);
      for (const p of this.projectiles) {
        const hit = p.step(h, this.terrain, this);
        if (hit) this.onProjectileHit(p, hit);
      }
      this.projectiles = this.projectiles.filter(p => p.alive);
      this.acc -= h; this.time += h;
    }
    this.terrain.relax(undefined, undefined, 1);
    for (const v of this.vehicles) this.fx.vehicle(v, frameDt);
    this.fx.ambient(frameDt);
    this.particles.update(frameDt, this.terrain, this.wind);
    this.fx.update(frameDt);
    if (this.vehicles[0]) this.cam.follow(this.vehicles[0], frameDt);
    const sh = this.fx.shake; this.cam.sx = (Math.random() - 0.5) * sh * 0.25; this.cam.sy = (Math.random() - 0.5) * sh * 0.25;
  }
};
